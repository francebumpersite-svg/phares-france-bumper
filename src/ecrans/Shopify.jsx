import { useMemo, useState } from 'react';
import { useDonnees } from '../lib/donnees.jsx';
import { appelFonction } from '../lib/supabase.js';
import { dateHeure, devinerDepuisTitre, euro, nomPays, normaliser } from '../lib/outils.js';
import { analyserTitre, estBestSeller, grouperVentes } from '../lib/groupes.js';
import { Feuille, Icone, PhotoGrande, Vide, Vignette } from '../composants/ui.jsx';
import FichePhare, { infosShopify } from './FichePhare.jsx';

function useProduits() {
  const d = useDonnees();
  return useMemo(() => {
    const ids = [...new Set(d.shopify.map((s) => s.product_id))];
    return ids.map((id) => ({ id, ...infosShopify(d.shopify, d.comptoir, id) }));
  }, [d.shopify, d.comptoir]);
}

export function BandeauSynchro() {
  const d = useDonnees();
  const admin = d.profil?.role === 'admin';
  const [occupe, setOccupe] = useState(false);
  const s = d.synchro;
  return (
    <div className={s && s.ok === false ? 'bandeau erreur' : 'bandeau'} style={{ display: 'grid', gap: 6 }}>
      <span>
        Lu sur Shopify, en lecture seule. Dernière mise à jour : {dateHeure(s?.derniere)}.
        {s?.message && s.message !== 'Synchro faite' ? ` ${s.message}` : ''}
        {s?.historique_message ? ` ${s.historique_message}` : ''}
      </span>
      {admin && (
        <button
          type="button"
          className="lien-btn"
          disabled={occupe || !d.enLigne}
          onClick={async () => {
            setOccupe(true);
            try {
              await appelFonction('sync-shopify', {});
            } catch (e) {
              d.setErreur(e.message);
            }
            await d.recharger();
            setOccupe(false);
          }}
        >
          {occupe ? 'Mise à jour en cours… (ça peut prendre une minute)' : d.enLigne ? 'Mettre à jour maintenant' : 'Mise à jour impossible hors connexion'}
        </button>
      )}
    </div>
  );
}


const dateLongue = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

// Ventes regroupées par modèle + lien produit Shopify actuel → groupe
function useGroupes() {
  const d = useDonnees();
  return useMemo(() => {
    const groupes = grouperVentes(d.ventesPhares);
    const parProduit = new Map();
    const parCle = new Map();
    const parBase = new Map();
    for (const g of groupes) {
      parCle.set(g.cle, g);
      if (!parBase.has(g.base)) parBase.set(g.base, []);
      parBase.get(g.base).push(g);
      for (const id of g.produits) if (!parProduit.has(id)) parProduit.set(id, g);
    }
    // Retrouve le groupe d'une fiche produit : par son identifiant, sinon par le modèle
    const groupeDe = (productId, titre) => {
      if (parProduit.has(productId)) return parProduit.get(productId);
      const a = analyserTitre(titre);
      if (parCle.has(a.cle)) return parCle.get(a.cle);
      const memes = parBase.get(a.base) || [];
      return !a.techno && memes.length === 1 ? memes[0] : null;
    };
    return { groupes, groupeDe };
  }, [d.ventesPhares]);
}

function Pays({ pays }) {
  return Object.entries(pays || {})
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => (
      <span key={c} className="pastille p-bleu">
        {nomPays(c)} {n}
      </span>
    ));
}

const prixVendu = (g) =>
  g.prix == null ? '—' : g.prixMin != null && g.prixMax != null && g.prixMin !== g.prixMax ? `${euro(g.prix)} (de ${euro(g.prixMin)} à ${euro(g.prixMax)})` : euro(g.prix);

function DetailGroupe({ g, onFermer }) {
  const d = useDonnees();
  const voirPrix = d.profil?.role !== 'chine';
  return (
    <Feuille titre="Détail des ventes" onFermer={onFermer}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="carte" style={{ border: 'none', padding: 0 }}>
          <Vignette url={g.image} taille={72} alt={g.titre} />
          <div className="corps">
            <div className="titre" style={{ fontSize: 15 }}>{g.titre}</div>
            <div className="details">
              Vendu {g.qte} fois · 1 vente tous les {g.joursParVente} jours · {g.qte12mois} sur les 12 derniers mois
            </div>
            <div className="details">Première vente le {dateLongue(g.premiere)} · dernière le {dateLongue(g.derniere)}</div>
            {voirPrix && <div className="details">Prix de vente : {prixVendu(g)}</div>}
            <div className="pastilles"><Pays pays={g.pays} /></div>
          </div>
        </div>
        {g.fiches.length > 1 && (
          <div>
            <h4 style={{ margin: '4px 0 6px' }}>{g.fiches.length} fiches produit regroupées (même modèle)</h4>
            <div style={{ display: 'grid', gap: 4 }}>
              {g.fiches.map((f) => (
                <div key={f.titre} className="details">• {f.titre} — {f.qte} vendu{f.qte > 1 ? 's' : ''}</div>
              ))}
            </div>
          </div>
        )}
        <div>
          <h4 style={{ margin: '4px 0 6px' }}>Toutes les ventes (de la plus récente à la plus ancienne)</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {g.ventes.map((v) => (
              <div key={v.line_key} className="details" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--ligne)', paddingTop: 6 }}>
                <b>{dateLongue(v.date_vente)}</b>
                <span>Commande {v.commande}</span>
                <span>{nomPays(v.pays || '??')}</span>
                <span>× {v.quantite}</span>
                {voirPrix && <span>{euro(v.prix)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Feuille>
  );
}

function BoutonACommander({ productId, titre }) {
  const d = useDonnees();
  const [fiche, setFiche] = useState(null);
  if (d.profil?.role !== 'admin') return null;
  const deja = productId && d.phares.find((p) => p.shopify_product_id === productId && ['a_commander', 'commande'].includes(p.statut));
  return (
    <>
      {deja ? (
        <span className="pastille p-vert" style={{ alignSelf: 'center' }}>{deja.statut === 'commande' ? 'Commandé' : 'Dans la liste'}</span>
      ) : (
        <button
          type="button"
          className="petit-bouton"
          style={{ alignSelf: 'center' }}
          onClick={(e) => {
            e.stopPropagation();
            setFiche({ ...devinerDepuisTitre(titre), shopify_product_id: productId || null, statut: 'a_commander', chine: false });
          }}
        >
          + À commander
        </button>
      )}
      {fiche && <FichePhare initial={fiche} onFermer={() => setFiche(null)} />}
    </>
  );
}

function Recherche({ q, setQ }) {
  return (
    <label className="recherche">
      <Icone.loupe />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marque, modèle…" aria-label="Rechercher" />
    </label>
  );
}

function AttenteHistorique() {
  const d = useDonnees();
  if (d.ventesPhares.length) return null;
  return (
    <div className="bandeau">
      L’historique des ventes depuis la création du site n’est pas encore lu. Il se remplit tout seul à la prochaine mise à jour Shopify.
    </div>
  );
}

// ---------------------------------------------------------------
// Rupture phares : tous les phares du site à 0, avec les pays et le prix de vente
// ---------------------------------------------------------------
export function Ruptures() {
  const d = useDonnees();
  const { groupeDe } = useGroupes();
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [detail, setDetail] = useState(null);
  const [grande, setGrande] = useState(null);
  const [limite, setLimite] = useState(60);

  const liste = useMemo(() => {
    const ids = [...new Set(d.shopify.map((s) => s.product_id))];
    return ids
      .map((id) => ({ id, ...infosShopify(d.shopify, d.comptoir, id) }))
      .filter((p) => p.stock <= 0)
      .map((p) => ({ ...p, g: groupeDe(p.id, p.titre) }))
      .sort((a, b) => (b.g?.derniere || '').localeCompare(a.g?.derniere || '') || a.titre.localeCompare(b.titre, 'fr'));
  }, [d.shopify, d.comptoir, groupeDe]);

  const nbVendus = liste.filter((p) => p.g).length;
  const filtres = useMemo(() => {
    const n = normaliser(q);
    return liste.filter((p) => (filtre === 'vendus' ? p.g : filtre === 'jamais' ? !p.g : true) && (!n || normaliser(p.titre).includes(n)));
  }, [liste, q, filtre]);

  return (
    <>
      <div className="outils">
        <Recherche q={q} setQ={setQ} />
        <div className="puces">
          {[
            ['tous', `Tous (${liste.length})`],
            ['vendus', `Déjà vendus (${nbVendus})`],
            ['jamais', `Jamais vendus (${liste.length - nbVendus})`]
          ].map(([k, l]) => (
            <button key={k} type="button" className={filtre === k ? 'puce on' : 'puce'} onClick={() => setFiltre(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <main>
        <BandeauSynchro />
        <AttenteHistorique />
        <div className="liste">
          {filtres.slice(0, limite).map((p) => (
            <div className="carte" key={p.id} role="button" tabIndex={0} style={{ cursor: p.g ? 'pointer' : 'default' }} onClick={() => p.g && setDetail(p.g)}>
              <Vignette url={p.image} taille={56} alt={p.titre} onClick={p.image ? (e) => { e?.stopPropagation?.(); setGrande(p.image); } : undefined} />
              <div className="corps">
                <div className="titre" style={{ fontSize: 14 }}>{p.titre}</div>
                <div className="details">
                  Prix sur le site : <b>{euro(p.prix)}</b>
                  {p.g ? ` · vendu ${p.g.qte} fois · dernière vente le ${dateLongue(p.g.derniere)}` : ' · jamais vendu sur le site'}
                </div>
                {p.g && <div className="details">Prix de vente payé : {prixVendu(p.g)}</div>}
                <div className="pastilles">
                  <span className="pastille p-rouge">Stock 0</span>
                  {p.g && <Pays pays={p.g.pays} />}
                  {p.g && estBestSeller(p.g) && <span className="pastille p-noir">Best-seller</span>}
                </div>
              </div>
              <BoutonACommander productId={p.id} titre={p.titre} />
            </div>
          ))}
        </div>
        {filtres.length > limite && (
          <button type="button" className="btn btn-plein" style={{ marginTop: 12 }} onClick={() => setLimite((l) => l + 100)}>
            Voir plus
          </button>
        )}
        {!filtres.length && <Vide titre="Aucun phare en rupture" texte={!d.shopify.length ? 'Aucun phare Shopify synchronisé pour l’instant.' : ''} />}
      </main>
      {detail && <DetailGroupe g={detail} onFermer={() => setDetail(null)} />}
      {grande && <PhotoGrande url={grande} onFermer={() => setGrande(null)} />}
    </>
  );
}

// ---------------------------------------------------------------
// Meilleures ventes phares site : les vrais best-sellers depuis la création du site
// ---------------------------------------------------------------
export function MeilleuresVentes() {
  const d = useDonnees();
  const { groupes } = useGroupes();
  const [q, setQ] = useState('');
  const [tous, setTous] = useState(false);
  const [tri, setTri] = useState('recente');
  const [detail, setDetail] = useState(null);
  const [limite, setLimite] = useState(60);

  // Stock et photo actuels du site pour chaque groupe
  const site = useMemo(() => {
    const m = new Map();
    const ids = [...new Set(d.shopify.map((s) => s.product_id))];
    for (const id of ids) m.set(id, infosShopify(d.shopify, d.comptoir, id));
    return m;
  }, [d.shopify, d.comptoir]);

  const best = useMemo(() => groupes.filter(estBestSeller), [groupes]);
  const liste = useMemo(() => {
    const n = normaliser(q);
    const l = (tous ? groupes : best)
      .filter((g) => !n || g.fiches.some((f) => normaliser(f.titre).includes(n)))
      .map((g) => {
        let stock = null;
        let image = null;
        let produit = null;
        for (const id of g.produits) {
          const s = site.get(id);
          if (!s) continue;
          stock = (stock ?? 0) + Math.max(0, s.stock);
          image = image || s.image;
          produit = produit || id;
        }
        return { ...g, stock, image: image || g.image, produit };
      });
    const cmp = {
      recente: (a, b) => b.derniere.localeCompare(a.derniere),
      quantite: (a, b) => b.qte - a.qte || b.derniere.localeCompare(a.derniere),
      rapide: (a, b) => a.joursParVente - b.joursParVente || b.qte - a.qte
    }[tri];
    return l.sort(cmp);
  }, [groupes, best, tous, q, tri, site]);

  return (
    <>
      <div className="outils">
        <Recherche q={q} setQ={setQ} />
        <div className="puces">
          <button type="button" className={!tous ? 'puce on' : 'puce'} onClick={() => setTous(false)}>Best-sellers ({best.length})</button>
          <button type="button" className={tous ? 'puce on' : 'puce'} onClick={() => setTous(true)}>Tous les phares vendus ({groupes.length})</button>
        </div>
        <div className="puces">
          {[
            ['recente', 'Vente la plus récente'],
            ['quantite', 'Les plus vendus'],
            ['rapide', 'Les plus rapides']
          ].map(([k, l]) => (
            <button key={k} type="button" className={tri === k ? 'puce on' : 'puce'} onClick={() => setTri(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <main>
        <BandeauSynchro />
        <AttenteHistorique />
        {!tous && d.ventesPhares.length > 0 && (
          <div className="details" style={{ margin: '0 0 8px' }}>
            Best-seller = vendu au moins 3 fois, au moins une vente tous les 4 mois en moyenne, et encore vendu cette année. Les fiches différentes du même modèle (même côté, phase et éclairage) sont regroupées.
          </div>
        )}
        <div className="liste">
          {liste.slice(0, limite).map((g) => (
            <div className="carte" key={g.cle} role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setDetail(g)}>
              <Vignette url={g.image} taille={56} alt={g.titre} />
              <div className="corps">
                <div className="titre" style={{ fontSize: 14 }}>{g.titre}</div>
                <div className="details">
                  Vendu <b>{g.qte} fois</b> · 1 vente tous les {g.joursParVente} j · dernière le {dateLongue(g.derniere)}
                </div>
                <div className="details">Prix de vente : {prixVendu(g)}</div>
                <div className="pastilles">
                  {g.stock == null ? (
                    <span className="pastille">Plus en ligne</span>
                  ) : g.stock <= 0 ? (
                    <span className="pastille p-rouge">Rupture</span>
                  ) : (
                    <span className="pastille p-vert">Stock {g.stock}</span>
                  )}
                  {g.fiches.length > 1 && <span className="pastille p-orange">{g.fiches.length} fiches regroupées</span>}
                  <Pays pays={g.pays} />
                </div>
              </div>
              <BoutonACommander productId={g.produit} titre={g.titre} />
            </div>
          ))}
        </div>
        {liste.length > limite && (
          <button type="button" className="btn btn-plein" style={{ marginTop: 12 }} onClick={() => setLimite((l) => l + 100)}>
            Voir plus
          </button>
        )}
        {!liste.length && d.ventesPhares.length > 0 && <Vide titre="Aucun phare trouvé" texte="" />}
      </main>
      {detail && <DetailGroupe g={detail} onFermer={() => setDetail(null)} />}
    </>
  );
}
