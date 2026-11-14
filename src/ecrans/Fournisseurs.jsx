// Onglet Fournisseurs : base des fournisseurs rencontrés dans les salons (Automechanika Shanghai…)
// Visible seulement par les comptes qui ont l'accès (le patron et ceux à qui il le donne).
import { useMemo, useRef, useState } from 'react';
import { srcPhoto, useDonnees } from '../lib/donnees.jsx';
import { dateCourte, lireQr, normaliser } from '../lib/outils.js';
import { Champ, Feuille, Icone, PhotoGrande, Vide, Vignette } from '../composants/ui.jsx';

export const CATEGORIES = ['Pare-choc adaptable', 'Phare adaptable', 'Matériel garage', 'Robot', 'Accessoires'];
const SALON_DEFAUT = 'Automechanika Shanghai 2026';
const CLE_SALON = 'dernier-salon';

const lireSalon = () => {
  try {
    return localStorage.getItem(CLE_SALON) || SALON_DEFAUT;
  } catch {
    return SALON_DEFAUT;
  }
};
const garderSalon = (s) => {
  try {
    if (s) localStorage.setItem(CLE_SALON, s);
  } catch {
    /* rien */
  }
};

const chiffres = (t) => String(t || '').replace(/[^\d]/g, '');
export const lienWhatsapp = (num) => `https://wa.me/${chiffres(num)}`;
const lienCarte = (f) =>
  f.lat != null && f.lng != null
    ? `https://maps.apple.com/?ll=${f.lat},${f.lng}&q=${encodeURIComponent(f.nom || 'Fournisseur')}`
    : `https://maps.apple.com/?q=${encodeURIComponent([f.adresse, f.ville, 'China'].filter(Boolean).join(', '))}`;

export default function Fournisseurs() {
  const d = useDonnees();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [ville, setVille] = useState('');
  const [salon, setSalon] = useState('');
  const [fiche, setFiche] = useState(null);

  const liste = d.fournisseurs || [];
  const toutesCats = useMemo(() => [...new Set([...CATEGORIES, ...liste.flatMap((f) => f.categories || [])])], [liste]);
  const villes = useMemo(() => [...new Set(liste.map((f) => f.ville).filter(Boolean))].sort(), [liste]);
  const salons = useMemo(() => [...new Set(liste.map((f) => f.salon).filter(Boolean))].sort(), [liste]);

  const filtres = useMemo(() => {
    const n = normaliser(q);
    return liste.filter((f) => {
      if (cat && !(f.categories || []).includes(cat)) return false;
      if (ville && f.ville !== ville) return false;
      if (salon && f.salon !== salon) return false;
      if (n && !normaliser([f.nom, f.contact_nom, f.ville, f.adresse, f.salon, f.wechat, f.whatsapp, ...(f.categories || [])].join(' ')).includes(n)) return false;
      return true;
    });
  }, [liste, q, cat, ville, salon]);

  const ouverte = fiche && fiche.id ? liste.find((f) => f.id === fiche.id) || fiche : fiche;

  return (
    <>
      <div className="outils">
        <label className="recherche">
          <Icone.loupe />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, contact, ville, WeChat…" aria-label="Rechercher un fournisseur" />
        </label>
        <div className="puces" role="group" aria-label="Catégories">
          <button type="button" className={!cat ? 'puce on' : 'puce'} onClick={() => setCat('')}>
            Toutes
          </button>
          {toutesCats.map((c) => (
            <button key={c} type="button" className={cat === c ? 'puce on' : 'puce'} onClick={() => setCat(cat === c ? '' : c)}>
              {c}
            </button>
          ))}
        </div>
        {(villes.length > 1 || salons.length > 1) && (
          <div className="deux">
            <select value={ville} onChange={(e) => setVille(e.target.value)} aria-label="Ville">
              <option value="">Toutes les villes</option>
              {villes.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <select value={salon} onChange={(e) => setSalon(e.target.value)} aria-label="Salon">
              <option value="">Tous les salons</option>
              {salons.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <main>
        <div className="liste">
          {filtres.map((f) => (
            <button type="button" className="carte" key={f.id} onClick={() => setFiche(f)}>
              <Vignette chemin={f.photos?.[0]} taille={72} alt={`Stand ${f.nom}`} />
              <div className="corps">
                <div className="titre">{f.nom}</div>
                <div className="details">{[f.ville, f.salon].filter(Boolean).join(' · ') || dateCourte(f.created_at)}</div>
                {f.note ? <Etoiles valeur={f.note} petit /> : null}
                <div className="pastilles">
                  {(f.categories || []).map((c) => (
                    <span key={c} className="pastille p-bleu">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
        {!filtres.length && (
          <Vide
            titre={liste.length ? 'Aucun fournisseur avec ces filtres' : 'Aucun fournisseur pour l’instant'}
            texte={liste.length ? '' : 'Au salon, appuie sur « + Nouveau fournisseur » et prends le stand en photo.'}
          />
        )}
      </main>
      <div className="barre">
        <div className="barre-in">
          <button type="button" className="btn btn-rouge" onClick={() => setFiche({})}>
            + Nouveau fournisseur
          </button>
        </div>
      </div>
      {ouverte && <FicheFournisseur f={ouverte} toutesCats={toutesCats} salons={salons} onFermer={() => setFiche(null)} />}
    </>
  );
}

function Etoiles({ valeur, onChange, petit }) {
  if (!onChange) {
    return (
      <div className={petit ? 'etoiles petit' : 'etoiles'} aria-label={`Note ${valeur} sur 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= valeur ? 'on' : ''}>
            ★
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="etoiles" role="radiogroup" aria-label="Note sur 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valeur === n} aria-label={`${n} étoile${n > 1 ? 's' : ''}`} className={n <= (valeur || 0) ? 'on' : ''} onClick={() => onChange(valeur === n ? null : n)}>
          ★
        </button>
      ))}
    </div>
  );
}

function FicheFournisseur({ f, toutesCats, salons, onFermer }) {
  const d = useDonnees();
  const [mode, setMode] = useState(f.id ? 'voir' : 'modifier');
  if (mode === 'voir') return <VoirFournisseur f={f} onFermer={onFermer} onModifier={() => setMode('modifier')} />;
  return <ModifierFournisseur f={f} toutesCats={toutesCats} salons={salons} onFermer={f.id ? () => setMode('voir') : onFermer} onSupprime={onFermer} peutSupprimer={d.profil?.role === 'admin'} />;
}

function VoirFournisseur({ f, onFermer, onModifier }) {
  const [vue, setVue] = useState(0);
  const [grande, setGrande] = useState(null);
  const [copie, setCopie] = useState(false);
  const photos = f.photos || [];
  const images = (f.catalogue || []).filter((x) => x.type !== 'pdf');
  const pdfs = (f.catalogue || []).filter((x) => x.type === 'pdf');

  const ouvrirWechat = async () => {
    try {
      await navigator.clipboard.writeText(f.wechat);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      /* rien */
    }
    window.location.href = 'weixin://';
  };

  return (
    <Feuille
      titre={f.nom}
      onFermer={onFermer}
      pied={
        <button type="button" className="btn btn-rouge btn-plein" onClick={onModifier}>
          Modifier ce fournisseur
        </button>
      }
    >
      {photos.length > 0 && (
        <>
          <button type="button" className="galerie-grande" onClick={() => setGrande({ liste: photos, i: vue })} aria-label="Agrandir la photo du stand">
            <img src={srcPhoto(photos[Math.min(vue, photos.length - 1)])} alt={`Stand ${f.nom}`} />
          </button>
          {photos.length > 1 && (
            <div className="galerie-mini">
              {photos.map((c, i) => (
                <div key={c} className={i === vue ? 'on' : ''} style={{ flex: 'none' }}>
                  <Vignette chemin={c} taille={64} onClick={() => setVue(i)} alt={`Photo ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="contacts">
        {f.whatsapp && (
          <a className="btn btn-vert" href={lienWhatsapp(f.whatsapp)} target="_blank" rel="noreferrer">
            <Icone.whatsapp /> WhatsApp
          </a>
        )}
        {f.wechat_qr ? (
          <button type="button" className="btn btn-wechat" onClick={() => setGrande({ liste: [f.wechat_qr], i: 0 })}>
            QR WeChat
          </button>
        ) : f.wechat ? (
          <button type="button" className="btn btn-wechat" onClick={ouvrirWechat}>
            {copie ? 'ID copié ✓' : 'WeChat'}
          </button>
        ) : null}
        {(f.adresse || f.ville || f.lat != null) && (
          <a className="btn" href={lienCarte(f)} target="_blank" rel="noreferrer">
            Itinéraire
          </a>
        )}
      </div>
      {f.wechat_qr && (
        <div className="bloc qr-bloc">
          <Vignette chemin={f.wechat_qr} taille={96} onClick={() => setGrande({ liste: [f.wechat_qr], i: 0 })} alt="QR code WeChat" />
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="aide" style={{ margin: 0 }}>
              Pour l'ajouter : enregistre le QR dans tes photos, puis dans WeChat › Scanner › icône photo, choisis-le. Ou affiche-le en grand et scanne-le avec un autre téléphone.
            </div>
            <button type="button" className="petit-bouton neutre" onClick={() => enregistrerQr(f)}>
              Enregistrer dans Photos
            </button>
          </div>
        </div>
      )}
      {!f.wechat_qr && f.wechat && <div className="aide">WeChat : l'identifiant est copié, colle-le dans « Ajouter un contact ».</div>}

      <div className="bloc">
        {f.note ? <Etoiles valeur={f.note} /> : null}
        <div className="deux">
          <Info l="Contact" v={f.contact_nom} />
          <Info l="Salon" v={f.salon} />
          <Info l="WhatsApp" v={f.whatsapp} />
          <Info l="WeChat" v={f.wechat} />
        </div>
        <Info l="Adresse" v={[f.adresse, f.ville].filter(Boolean).join(', ')} />
        {f.lat != null && <div className="aide">Position GPS enregistrée.</div>}
        {(f.categories || []).length > 0 && (
          <div className="pastilles" style={{ marginTop: 0 }}>
            {f.categories.map((c) => (
              <span key={c} className="pastille p-bleu">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {(images.length > 0 || pdfs.length > 0 || f.catalogue_qr || f.catalogue_lien) && (
        <div className="bloc">
          <h4>Catalogue</h4>
          {f.catalogue_lien && (
            <a className="btn btn-noir btn-plein" href={lienValide(f.catalogue_lien)} target="_blank" rel="noreferrer">
              Ouvrir le catalogue en ligne
            </a>
          )}
          {f.catalogue_qr && (
            <div className="qr-bloc" style={{ display: 'grid', gap: 10 }}>
              <Vignette chemin={f.catalogue_qr} taille={96} onClick={() => setGrande({ liste: [f.catalogue_qr], i: 0 })} alt="QR code du catalogue" />
              <div className="aide" style={{ margin: 0 }}>
                {f.catalogue_lien ? 'QR code du catalogue (le lien a été lu automatiquement).' : 'QR code du catalogue : appuie dessus pour l’afficher en grand et le scanner.'}
              </div>
            </div>
          )}
          {images.length > 0 && (
            <div className="galerie-mini" style={{ flexWrap: 'wrap' }}>
              {images.map((x, i) => (
                <Vignette key={x.chemin} chemin={x.chemin} taille={76} onClick={() => setGrande({ liste: images.map((y) => y.chemin), i })} alt={`Page ${i + 1} du catalogue`} />
              ))}
            </div>
          )}
          {pdfs.map((x) => (
            <a key={x.chemin} className="lien-pdf" href={srcPhoto(x.chemin)} target="_blank" rel="noreferrer">
              📄 {x.nom || 'Catalogue PDF'}
            </a>
          ))}
        </div>
      )}
      <div className="aide">Ajouté le {dateCourte(f.created_at)}</div>
      {grande && <PhotoGrande chemins={grande.liste} depart={grande.i} onFermer={() => setGrande(null)} />}
    </Feuille>
  );
}

const lienValide = (t) => (/^https?:\/\//i.test(t) ? t : `https://${t}`);

// Partage du QR WeChat vers « Enregistrer l'image » (iPhone) ; sinon ouverture de l'image
async function enregistrerQr(f) {
  const url = srcPhoto(f.wechat_qr);
  try {
    const blob = await (await fetch(url)).blob();
    const fichier = new File([blob], `wechat-${(f.nom || 'fournisseur').replace(/[^\w-]+/g, '-')}.jpg`, { type: blob.type || 'image/jpeg' });
    if (navigator.canShare?.({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: `QR WeChat ${f.nom}` });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  window.open(url, '_blank');
}

function Info({ l, v }) {
  return (
    <div>
      <div className="lab">{l}</div>
      <div className="val">{v || '—'}</div>
    </div>
  );
}

function AjoutFichiers({ libelle, accept, onFichiers, grand, unSeul }) {
  const { preparerFichier } = useDonnees();
  const ref = useRef(null);
  const [occupe, setOccupe] = useState(false);
  return (
    <>
      <button type="button" className={grand ? 'bouton-photo grand' : 'bouton-photo'} onClick={() => ref.current?.click()} disabled={occupe}>
        <Icone.photo />
        <span>{occupe ? 'Préparation…' : libelle}</span>
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={!unSeul}
        hidden
        onChange={async (e) => {
          const fichiers = [...(e.target.files || [])];
          e.target.value = '';
          if (!fichiers.length) return;
          setOccupe(true);
          try {
            const res = [];
            for (const fi of fichiers) res.push({ ...(await preparerFichier(fi)), original: fi });
            onFichiers(res);
          } finally {
            setOccupe(false);
          }
        }}
      />
    </>
  );
}

function ModifierFournisseur({ f, toutesCats, salons, onFermer, onSupprime, peutSupprimer }) {
  const d = useDonnees();
  const [x, setX] = useState(() => ({
    nom: '',
    salon: lireSalon(),
    contact_nom: '',
    whatsapp: '',
    wechat: '',
    wechat_qr: null,
    adresse: '',
    ville: '',
    lat: null,
    lng: null,
    categories: [],
    note: null,
    photos: [],
    catalogue: [],
    catalogue_qr: null,
    catalogue_lien: '',
    ...f
  }));
  const [ops, setOps] = useState([]);
  const [erreur, setErreur] = useState('');
  const [autreCat, setAutreCat] = useState('');
  const [gps, setGps] = useState('');
  const [qrMsg, setQrMsg] = useState('');
  const maj = (k) => (e) => setX((y) => ({ ...y, [k]: e.target.value }));
  const cats = [...new Set([...toutesCats, ...x.categories])];

  const basculerCat = (c) => setX((y) => ({ ...y, categories: y.categories.includes(c) ? y.categories.filter((z) => z !== c) : [...y.categories, c] }));

  const maPosition = () => {
    if (!navigator.geolocation) return setGps('Localisation indisponible sur ce téléphone.');
    setGps('Recherche de la position…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setX((y) => ({ ...y, lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }));
        setGps('');
      },
      () => setGps('Position refusée ou introuvable. Autorise la localisation pour l’appli dans les réglages du téléphone.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  async function enregistrer() {
    if (!x.nom.trim()) return setErreur('Le nom du fournisseur est obligatoire.');
    const ligne = {
      ...x,
      nom: x.nom.trim(),
      salon: x.salon.trim() || null,
      catalogue_lien: (x.catalogue_lien || '').trim() || null,
      note: x.note || null
    };
    garderSalon(ligne.salon);
    await d.enregistrerFournisseur(ligne, ops);
    onFermer();
  }

  return (
    <Feuille
      titre={f.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
      onFermer={onFermer}
      pied={
        <>
          {erreur && <div className="bandeau erreur">{erreur}</div>}
          <div className={f.id && peutSupprimer ? 'deux' : ''}>
            {f.id && peutSupprimer && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  if (!window.confirm(`Supprimer ${f.nom} ?`)) return;
                  await d.supprimerFournisseur(f.id);
                  onSupprime();
                }}
              >
                Supprimer
              </button>
            )}
            <button type="button" className="btn btn-rouge btn-plein" onClick={enregistrer}>
              Enregistrer
            </button>
          </div>
        </>
      }
    >
      <div className="lab">Photos du stand</div>
      {x.photos.length > 0 && (
        <div className="galerie-mini" style={{ flexWrap: 'wrap' }}>
          {x.photos.map((c) => (
            <div key={c} className="avec-x">
              <Vignette chemin={c} taille={76} alt="Photo du stand" />
              <button type="button" className="retirer" aria-label="Retirer cette photo" onClick={() => setX((y) => ({ ...y, photos: y.photos.filter((z) => z !== c) }))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <AjoutFichiers
        grand={!x.photos.length}
        accept="image/*"
        libelle={x.photos.length ? 'Ajouter des photos' : 'Photo du stand'}
        onFichiers={(res) => {
          setX((y) => ({ ...y, photos: [...y.photos, ...res.map((r) => r.chemin)] }));
          setOps((o) => [...o, ...res.map((r) => r.op)]);
        }}
      />

      <Champ label="Nom du fournisseur">
        <input value={x.nom} onChange={maj('nom')} placeholder="Ex. Danyang Auto Lamp Co." />
      </Champ>
      <Champ label="Salon où tu l'as rencontré">
        <input value={x.salon || ''} onChange={maj('salon')} list="liste-salons" />
        <datalist id="liste-salons">
          {[...new Set([SALON_DEFAUT, ...salons])].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Champ>

      <div className="lab">Catégories</div>
      <div className="puces">
        {cats.map((c) => (
          <button key={c} type="button" className={x.categories.includes(c) ? 'puce on' : 'puce'} aria-pressed={x.categories.includes(c)} onClick={() => basculerCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <Champ label="Autre catégorie">
      <div className="avec-bouton">
        <input value={autreCat} onChange={(e) => setAutreCat(e.target.value)} placeholder="Ex. Rétroviseurs" />
        <button
          type="button"
          className="petit-bouton neutre"
          disabled={!autreCat.trim()}
          onClick={() => {
            const c = autreCat.trim();
            setX((y) => ({ ...y, categories: y.categories.includes(c) ? y.categories : [...y.categories, c] }));
            setAutreCat('');
          }}
        >
          Ajouter
        </button>
      </div>
      </Champ>

      <Champ label="Nom du contact">
        <input value={x.contact_nom || ''} onChange={maj('contact_nom')} />
      </Champ>
      <div className="deux">
        <Champ label="WhatsApp">
          <input value={x.whatsapp || ''} onChange={maj('whatsapp')} inputMode="tel" placeholder="+86 138…" />
        </Champ>
        <Champ label="WeChat (ID, si tu l'as)">
          <input value={x.wechat || ''} onChange={maj('wechat')} autoCapitalize="off" autoCorrect="off" />
        </Champ>
      </div>
      <div className="lab">QR code WeChat</div>
      {x.wechat_qr ? (
        <div className="avec-x" style={{ justifySelf: 'start' }}>
          <Vignette chemin={x.wechat_qr} taille={110} alt="QR code WeChat" />
          <button type="button" className="retirer" aria-label="Retirer le QR code" onClick={() => setX((y) => ({ ...y, wechat_qr: null }))}>
            ×
          </button>
        </div>
      ) : (
        <AjoutFichiers
          accept="image/*"
          unSeul
          libelle="Photo ou capture du QR WeChat"
          onFichiers={(res) => {
            setX((y) => ({ ...y, wechat_qr: res[0].chemin }));
            setOps((o) => [...o, res[0].op]);
          }}
        />
      )}
      <div className="aide" style={{ marginTop: -4 }}>Prends en photo le QR affiché sur son téléphone (ou fais une capture d'écran).</div>
      <Champ label="Adresse">
        <textarea value={x.adresse || ''} onChange={maj('adresse')} rows={2} />
      </Champ>
      <Champ label="Ville">
        <input value={x.ville || ''} onChange={maj('ville')} placeholder="Ex. Danyang, Guangzhou, Ningbo…" list="liste-villes" />
        <datalist id="liste-villes">
          {[...new Set((d.fournisseurs || []).map((y) => y.ville).filter(Boolean))].map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </Champ>
      <div className="avec-bouton">
        <span style={{ flex: 1, fontSize: 14 }}>{x.lat != null ? '📍 Position GPS enregistrée' : 'Pas de position GPS'}</span>
        {x.lat != null ? (
          <button type="button" className="petit-bouton neutre" onClick={() => setX((y) => ({ ...y, lat: null, lng: null }))}>
            Retirer
          </button>
        ) : (
          <button type="button" className="petit-bouton neutre" onClick={maPosition}>
            Ma position ici
          </button>
        )}
      </div>
      {gps && <div className="aide">{gps}</div>}

      <div className="lab">Note</div>
      <Etoiles valeur={x.note} onChange={(n) => setX((y) => ({ ...y, note: n }))} />

      <div className="lab">Catalogue</div>
      {x.catalogue_qr ? (
        <div className="avec-x" style={{ justifySelf: 'start' }}>
          <Vignette chemin={x.catalogue_qr} taille={110} alt="QR code du catalogue" />
          <button type="button" className="retirer" aria-label="Retirer le QR code du catalogue" onClick={() => setX((y) => ({ ...y, catalogue_qr: null }))}>
            ×
          </button>
        </div>
      ) : (
        <AjoutFichiers
          accept="image/*"
          unSeul
          libelle="Photo du QR code du catalogue"
          onFichiers={async (res) => {
            setX((y) => ({ ...y, catalogue_qr: res[0].chemin }));
            setOps((o) => [...o, res[0].op]);
            setQrMsg('Lecture du QR code…');
            const lu = await lireQr(res[0].original);
            if (lu) {
              setX((y) => ({ ...y, catalogue_lien: y.catalogue_lien || lu }));
              setQrMsg('Lien du catalogue trouvé ✓');
            } else {
              setQrMsg('Je n’arrive pas à lire ce QR code : la photo est gardée, tu pourras le scanner plus tard.');
            }
          }}
        />
      )}
      {qrMsg && <div className="aide">{qrMsg}</div>}
      <Champ label="Lien du catalogue">
        <input value={x.catalogue_lien || ''} onChange={maj('catalogue_lien')} inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="Rempli tout seul si le QR est lu" />
      </Champ>
      <div className="lab">Pages ou PDF du catalogue</div>
      {x.catalogue.length > 0 && (
        <div className="galerie-mini" style={{ flexWrap: 'wrap' }}>
          {x.catalogue.map((c) => (
            <div key={c.chemin} className="avec-x">
              {c.type === 'pdf' ? <div className="vignette pdf">PDF</div> : <Vignette chemin={c.chemin} taille={76} alt="Page du catalogue" />}
              <button type="button" className="retirer" aria-label="Retirer" onClick={() => setX((y) => ({ ...y, catalogue: y.catalogue.filter((z) => z.chemin !== c.chemin) }))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <AjoutFichiers
        accept="image/*,application/pdf"
        libelle="Ajouter des pages ou un PDF"
        onFichiers={(res) => {
          setX((y) => ({ ...y, catalogue: [...y.catalogue, ...res.map((r) => ({ chemin: r.chemin, type: r.type, nom: r.nom }))] }));
          setOps((o) => [...o, ...res.map((r) => r.op)]);
        }}
      />
    </Feuille>
  );
}
