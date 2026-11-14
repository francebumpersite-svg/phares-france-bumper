// Données de l'appli + fonctionnement hors connexion.
// - Tout ce qui est lu est gardé dans le téléphone (IndexedDB) pour être consulté sans réseau.
// - Tout ce qui est ajouté/modifié part dans une file d'attente, envoyée dès que le réseau revient.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { get, set, del } from 'idb-keyval';
import { supabase, urlPhoto } from './supabase.js';
import { compresserPhoto, uid } from './outils.js';

const Ctx = createContext(null);
export const useDonnees = () => useContext(Ctx);

const VIDE = {
  profil: null,
  reglages: null,
  synchro: null,
  phares: [],
  prive: {},
  ventes: [],
  dropship: [],
  chine: [],
  retours: [],
  shopify: [],
  comptoir: {},
  equipe: []
};

const CLE_CACHE = 'donnees-v1';
const CLE_FILE = 'file-attente-v1';

// Photos prises hors connexion : affichées depuis le téléphone en attendant l'envoi
const photosLocales = new Map();
export const srcPhoto = (chemin) => (chemin ? photosLocales.get(chemin) || urlPhoto(chemin) : null);

const estErreurReseau = (e) =>
  !navigator.onLine || /fetch|network|réseau|Load failed|timeout/i.test(String(e?.message ?? e));

export function DonneesProvider({ session, children }) {
  const [d, setD] = useState(VIDE);
  const [pret, setPret] = useState(false);
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [file, setFile] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);
  const fileRef = useRef([]);
  const enCours = useRef(false);
  const userId = session?.user?.id;

  // --- file d'attente ---
  const enregistrerFile = useCallback(async (f) => {
    fileRef.current = f;
    setFile(f);
    await set(CLE_FILE, f);
  }, []);

  const vider = useCallback(async () => {
    if (enCours.current || !navigator.onLine) return;
    enCours.current = true;
    try {
      while (fileRef.current.length) {
        const op = fileRef.current[0];
        try {
          await executerOp(op);
        } catch (e) {
          if (estErreurReseau(e)) break;
          setErreur(`Un envoi a été refusé : ${e.message || e}`);
        }
        if (op.k === 'photo') {
          await del(`photo:${op.chemin}`);
        }
        await enregistrerFile(fileRef.current.slice(1));
      }
    } finally {
      enCours.current = false;
    }
  }, [enregistrerFile]);

  const ajouterOps = useCallback(
    async (ops) => {
      await enregistrerFile([...fileRef.current, ...ops]);
      vider();
    },
    [enregistrerFile, vider]
  );

  // --- lecture ---
  const recharger = useCallback(async () => {
    if (!userId) return;
    if (!navigator.onLine) return;
    setChargement(true);
    try {
      const { data: profil, error: eP } = await supabase.from('profils').select('*').eq('id', userId).maybeSingle();
      if (eP) throw eP;
      if (!profil) {
        setD((x) => ({ ...x, profil: null }));
        return;
      }
      const role = profil.role;
      const r = { ...VIDE, profil };
      const [reglages, synchro] = await Promise.all([
        supabase.from('reglages').select('*').eq('id', 1).maybeSingle(),
        supabase.from('synchro').select('*').eq('id', 1).maybeSingle()
      ]);
      r.reglages = reglages.data;
      r.synchro = synchro.data;

      if (role === 'admin' || role === 'vendeur' || role === 'lecteur') {
        const q = await Promise.all([
          supabase.from('phares').select('*').order('marque').limit(10000),
          supabase.rpc('phares_prive_visible'),
          supabase.from('ventes_declarees').select('*').order('created_at', { ascending: false }).limit(2000),
          supabase.from('dropship').select('*').order('created_at', { ascending: false }).limit(2000),
          supabase.from('retours').select('*').order('created_at', { ascending: false }).limit(2000),
          supabase.from('shopify_produits').select('*').limit(20000),
          supabase.rpc('comptoir_par_produit')
        ]);
        const err = q.find((x) => x.error);
        if (err) throw err.error;
        r.phares = q[0].data;
        r.prive = Object.fromEntries((q[1].data || []).map((p) => [p.phare_id, p]));
        r.ventes = q[2].data;
        r.dropship = q[3].data;
        r.retours = q[4].data;
        r.shopify = q[5].data;
        r.comptoir = Object.fromEntries((q[6].data || []).map((c) => [c.shopify_product_id, Number(c.nb)]));
      }
      if (role === 'admin') {
        const { data } = await supabase.from('profils').select('id, nom, identifiant, role, actif').order('created_at');
        r.equipe = data || [];
      }
      if (role === 'chine') {
        const [c1, c2, c3, c4] = await Promise.all([
          supabase.rpc('dropship_chine'),
          supabase.from('phares').select('*').order('marque').limit(10000),
          supabase.rpc('phares_prive_visible'),
          supabase.rpc('retours_chine')
        ]);
        const err = [c1, c2, c3, c4].find((x) => x.error);
        if (err) throw err.error;
        r.chine = c1.data;
        r.phares = c2.data;
        r.prive = Object.fromEntries((c3.data || []).map((p) => [p.phare_id, p]));
        r.retours = c4.data || [];
      }
      setD(r);
      await set(`${CLE_CACHE}:${userId}`, r);
      prechargerPhotos(r);
      setErreur(null);
    } catch (e) {
      if (!estErreurReseau(e)) setErreur(e.message || String(e));
    } finally {
      setChargement(false);
    }
  }, [userId]);

  // Démarrage : cache du téléphone d'abord, puis réseau
  useEffect(() => {
    let fini = false;
    (async () => {
      const cache = await get(`${CLE_CACHE}:${userId}`);
      const f = (await get(CLE_FILE)) || [];
      for (const op of f) {
        if (op.k === 'photo') {
          const blob = await get(`photo:${op.chemin}`);
          if (blob) photosLocales.set(op.chemin, URL.createObjectURL(blob));
        }
      }
      if (fini) return;
      fileRef.current = f;
      setFile(f);
      if (cache) setD(cache);
      setPret(true);
      await vider();
      await recharger();
    })();
    return () => {
      fini = true;
    };
  }, [userId, recharger, vider]);

  useEffect(() => {
    const on = async () => {
      setEnLigne(true);
      await vider();
      recharger();
    };
    const off = () => setEnLigne(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(() => {
      if (navigator.onLine && fileRef.current.length) vider();
    }, 30000);
    const visible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        vider().then(recharger);
      }
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', visible);
      clearInterval(t);
    };
  }, [vider, recharger]);

  // Mise à jour immédiate de l'écran (sans attendre le réseau) + sauvegarde dans le téléphone
  const modifierLocal = useCallback(
    (fn) => {
      setD((x) => {
        const n = fn(x);
        if (userId) set(`${CLE_CACHE}:${userId}`, n);
        return n;
      });
    },
    [userId]
  );

  // --- actions ---
  const actions = useMemo(() => {
    // Prépare une photo : gardée dans le téléphone, envoyée dès que possible
    async function preparerPhoto(fichier) {
      const blob = await compresserPhoto(fichier);
      const chemin = `${new Date().toISOString().slice(0, 7)}/${uid()}.jpg`;
      await set(`photo:${chemin}`, blob);
      photosLocales.set(chemin, URL.createObjectURL(blob));
      return { chemin, op: { k: 'photo', chemin } };
    }

    const listeMaj = (liste, ligne, cle = 'id') => {
      const i = liste.findIndex((x) => x[cle] === ligne[cle]);
      if (i < 0) return [ligne, ...liste];
      const n = liste.slice();
      n[i] = { ...n[i], ...ligne };
      return n;
    };

    return {
      preparerPhoto,

      async enregistrerPhare(phare, prive, opsPhotos = []) {
        const ligne = { ...phare, id: phare.id || uid(), updated_at: new Date().toISOString() };
        const ops = [...opsPhotos, { k: 'upsert', table: 'phares', ligne }];
        if (prive) {
          const p = { ...prive, phare_id: ligne.id, updated_at: new Date().toISOString() };
          delete p.marge;
          ops.push({ k: 'upsert', table: 'phares_prive', ligne: p });
        }
        modifierLocal((x) => ({
          ...x,
          phares: listeMaj(x.phares, ligne),
          prive: prive
            ? {
                ...x.prive,
                [ligne.id]: {
                  ...prive,
                  phare_id: ligne.id,
                  marge: prive.prix_vente != null && prive.prix_achat != null ? prive.prix_vente - prive.prix_achat : null
                }
              }
            : x.prive
        }));
        await ajouterOps(ops);
        return ligne;
      },

      async majPhares(ids, champs) {
        const maintenant = new Date().toISOString();
        modifierLocal((x) => ({
          ...x,
          phares: x.phares.map((p) => (ids.includes(p.id) ? { ...p, ...champs, updated_at: maintenant } : p))
        }));
        await ajouterOps(ids.map((id) => ({ k: 'update', table: 'phares', id, champs: { ...champs, updated_at: maintenant } })));
      },

      async supprimerPhare(id) {
        modifierLocal((x) => ({ ...x, phares: x.phares.filter((p) => p.id !== id) }));
        await ajouterOps([{ k: 'delete', table: 'phares', id }]);
      },

      async importerPhares(lignes) {
        const ops = [];
        const nouveaux = [];
        const prives = {};
        for (const l of lignes) {
          const id = uid();
          const phare = { ...l.phare, id };
          nouveaux.push(phare);
          ops.push({ k: 'upsert', table: 'phares', ligne: phare });
          if (l.prive) {
            prives[id] = { ...l.prive, phare_id: id };
            ops.push({ k: 'upsert', table: 'phares_prive', ligne: { ...l.prive, phare_id: id } });
          }
        }
        modifierLocal((x) => ({ ...x, phares: [...nouveaux, ...x.phares], prive: { ...x.prive, ...prives } }));
        await ajouterOps(ops);
      },

      async declarerVente(vente, opPhoto) {
        const ligne = {
          ...vente,
          id: uid(),
          vendeur_id: userId,
          statut: 'en_attente',
          created_at: new Date().toISOString()
        };
        modifierLocal((x) => ({ ...x, ventes: [ligne, ...x.ventes] }));
        await ajouterOps([...(opPhoto ? [opPhoto] : []), { k: 'insert', table: 'ventes_declarees', ligne }]);
      },

      async majVente(id, champs) {
        modifierLocal((x) => ({ ...x, ventes: x.ventes.map((v) => (v.id === id ? { ...v, ...champs } : v)) }));
        await ajouterOps([{ k: 'update', table: 'ventes_declarees', id, champs }]);
      },

      async enregistrerDropship(drop, opsPhotos = []) {
        const nouveau = !drop.id;
        const ligne = {
          ...drop,
          id: drop.id || uid(),
          updated_at: new Date().toISOString(),
          ...(nouveau ? { created_at: new Date().toISOString(), cree_par: userId } : {})
        };
        modifierLocal((x) => ({ ...x, dropship: listeMaj(x.dropship, ligne) }));
        await ajouterOps([...opsPhotos, { k: 'upsert', table: 'dropship', ligne }]);
      },

      async majChine(id, statut, suivi) {
        modifierLocal((x) => ({ ...x, chine: x.chine.map((c) => (c.id === id ? { ...c, statut, suivi } : c)) }));
        await ajouterOps([{ k: 'rpc', fn: 'dropship_maj_chine', args: { p_id: id, p_statut: statut, p_suivi: suivi || null } }]);
      },

      async enregistrerRetour(retour, opsPhotos = []) {
        const nouveau = !retour.id;
        const ligne = {
          ...retour,
          id: retour.id || uid(),
          ...(nouveau ? { created_at: new Date().toISOString(), cree_par: userId } : {})
        };
        modifierLocal((x) => ({ ...x, retours: listeMaj(x.retours, ligne) }));
        if (nouveau) {
          await ajouterOps([...opsPhotos, { k: 'insert', table: 'retours', ligne }]);
        } else {
          const { id, ...champs } = ligne;
          delete champs.created_at;
          delete champs.cree_par;
          await ajouterOps([...opsPhotos, { k: 'update', table: 'retours', id, champs }]);
        }
      },

      async enregistrerReglages(champs) {
        modifierLocal((x) => ({ ...x, reglages: { ...x.reglages, ...champs } }));
        await ajouterOps([{ k: 'update', table: 'reglages', id: 1, champs: { ...champs, updated_at: new Date().toISOString() } }]);
      }
    };
  }, [modifierLocal, ajouterOps, userId]);

  const valeur = { ...d, pret, enLigne, file, erreur, setErreur, chargement, recharger, ...actions };
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

async function executerOp(op) {
  let res;
  if (op.k === 'photo') {
    const blob = await get(`photo:${op.chemin}`);
    if (!blob) return;
    res = await supabase.storage.from('photos').upload(op.chemin, blob, { contentType: 'image/jpeg' });
    if (res.error && /exist|duplicate/i.test(res.error.message || '')) return;
  } else if (op.k === 'insert') {
    res = await supabase.from(op.table).upsert(op.ligne, { ignoreDuplicates: true });
  } else if (op.k === 'upsert') {
    res = await supabase.from(op.table).upsert(op.ligne, op.table === 'phares_prive' ? { onConflict: 'phare_id' } : undefined);
  } else if (op.k === 'update') {
    res = await supabase.from(op.table).update(op.champs).eq('id', op.id);
  } else if (op.k === 'delete') {
    res = await supabase.from(op.table).delete().eq('id', op.id);
  } else if (op.k === 'rpc') {
    res = await supabase.rpc(op.fn, op.args);
  }
  if (res?.error) throw res.error;
}

// Télécharge les photos en arrière-plan pour les avoir hors connexion
let dejaPrecharge = new Set();
async function prechargerPhotos(r) {
  const urls = [];
  for (const p of r.phares) for (const c of [...(p.photos || []), ...(p.photos_fiche || [])]) urls.push(urlPhoto(c));
  for (const x of [...r.ventes, ...r.dropship, ...r.retours, ...r.chine]) if (x.photo) urls.push(urlPhoto(x.photo));
  for (const s of r.shopify) if (s.image) urls.push(s.image);
  const aFaire = urls.filter((u) => u && !dejaPrecharge.has(u));
  for (const u of aFaire) {
    if (!navigator.onLine) return;
    dejaPrecharge.add(u);
    try {
      await fetch(u, { mode: u.includes('cdn.shopify.com') ? 'no-cors' : 'cors' });
    } catch {
      /* on réessaiera plus tard */
    }
  }
}
