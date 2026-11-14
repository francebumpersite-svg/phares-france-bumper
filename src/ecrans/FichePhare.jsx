import { useMemo, useState } from 'react';
import { useDonnees, srcPhoto } from '../lib/donnees.jsx';
import { STATUTS_PHARE, euro, libelleCote, lienGoogle, nombre, nomPays } from '../lib/outils.js';
import { BoutonPhoto, ChoixShopify, Champ, Feuille, Icone, LienRef, PhotoGrande, Segments, Vignette } from '../composants/ui.jsx';

// Infos Shopify d'un produit (somme des variantes)
export function infosShopify(shopify, comptoir, productId) {
  if (!productId) return null;
  const v = shopify.filter((s) => s.product_id === productId);
  if (!v.length) return null;
  const pays = {};
  let ventes = 0;
  let stock = 0;
  for (const x of v) {
    ventes += x.ventes_60j || 0;
    stock += x.stock ?? 0;
    for (const [k, n] of Object.entries(x.ventes_pays || {})) pays[k] = (pays[k] || 0) + n;
  }
  return { titre: v[0].titre, image: v[0].image, prix: v[0].prix, stock, ventes, pays, comptoir: comptoir[productId] || 0, handle: v[0].handle };
}

export function PastillesVentes({ info }) {
  if (!info) return null;
  const pays = Object.entries(info.pays).sort((a, b) => b[1] - a[1]);
  return (
    <>
      {pays.map(([c, n]) => (
        <span key={c} className="pastille p-bleu">
          {nomPays(c)} {n}
        </span>
      ))}
      {info.comptoir > 0 && <span className="pastille p-noir">Comptoir {info.comptoir}</span>}
    </>
  );
}

export function CartePhare({ phare, onOuvrir, selection, onSelection }) {
  const { prive, shopify, comptoir } = useDonnees();
  const pv = prive[phare.id];
  const info = infosShopify(shopify, comptoir, phare.shopify_product_id);
  const sel = selection?.has(phare.id);
  const prixVente = pv?.prix_vente ?? (info?.prix != null ? Number(info.prix) : null);
  const marge = pv?.marge != null ? pv.marge : pv?.prix_achat != null && prixVente != null ? prixVente - pv.prix_achat : null;
  const pctMarge = marge != null && prixVente ? Math.round((marge / prixVente) * 100) : null;
  const [grande, setGrande] = useState(false);
  const toutes = [...(phare.photos || []), ...(phare.photos_fiche || [])];
  return (
    <div className={sel ? 'carte sel' : 'carte'}>
      {grande && <PhotoGrande chemins={toutes.length ? toutes : [info?.image]} onFermer={() => setGrande(false)} />}
      {onSelection && (
        <button type="button" className={sel ? 'case on' : 'case'} aria-pressed={!!sel} aria-label={`Sélectionner ${phare.marque} ${phare.modele || ''}`} onClick={() => onSelection(phare.id)}>
          {sel && <Icone.coche />}
        </button>
      )}
      <Vignette
        chemin={phare.photos?.[0] || phare.photos_fiche?.[0]}
        url={!phare.photos?.[0] && !phare.photos_fiche?.[0] ? info?.image : null}
        taille={64}
        onClick={() => (toutes.length || info?.image ? setGrande(true) : onOuvrir(phare))}
      />
      <div className="corps">
        <button type="button" className="ouvrir" onClick={() => onOuvrir(phare)}>
          <span className="titre">
            {phare.marque}
            {phare.quantite > 1 ? ` · x${phare.quantite}` : ''}
          </span>
          <span className="mvc">
            <span>
              <span className="lab">Modèle</span>
              <span className="val">{phare.modele || '—'}</span>
            </span>
            <span>
              <span className="lab">Année</span>
              <span className="val">{phare.annees || '—'}</span>
            </span>
            <span>
              <span className="lab">Côté</span>
              <span className="val">{libelleCote(phare.cote)}</span>
            </span>
          </span>
        </button>
        <LienRef valeur={phare.ref_oe} />
        <PastillesPhare phare={phare} />
      </div>
      {pctMarge != null && (
        <div className="droite">
          <div>
            <div className="lab">Marge</div>
            <div className="marge">{pctMarge} %</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PastillesPhare({ phare }) {
  const { shopify, comptoir } = useDonnees();
  const info = infosShopify(shopify, comptoir, phare.shopify_product_id);
  return (
    <div className="pastilles">
      {phare.statut !== 'base' && (
        <span className={phare.statut === 'a_commander' ? 'pastille p-orange' : phare.statut === 'commande' ? 'pastille p-bleu' : 'pastille p-vert'}>
          {STATUTS_PHARE[phare.statut]}
        </span>
      )}
      {phare.non_compatible && <span className="pastille p-rouge">Non compatible</span>}
      {info && info.stock <= 0 && <span className="pastille p-rouge">Rupture</span>}
      {info && info.stock > 0 && <span className="pastille p-vert">Stock {info.stock}</span>}
      <PastillesVentes info={info} />
    </div>
  );
}

const VIDE = {
  marque: '',
  modele: '',
  annees: '',
  cote: 'gauche',
  position: 'avant',
  type_eclairage: '',
  ref_oe: '',
  statut: 'base',
  quantite: 1,
  non_compatible: false,
  note: '',
  photos: [],
  photos_fiche: [],
  shopify_product_id: null
};

export default function FichePhare({ phare, initial, onFermer, onEnregistre }) {
  const d = useDonnees();
  const admin = d.profil?.role === 'admin';
  const existant = phare?.id ? phare : null;
  const [p, setP] = useState(() => ({ ...VIDE, ...(existant || {}), ...(initial || {}) }));
  const [pv, setPv] = useState(() => {
    const x = existant ? d.prive[existant.id] : null;
    return {
      prix_achat: x?.prix_achat ?? '',
      prix_vente: x?.prix_vente ?? '',
      fournisseur: x?.fournisseur ?? '',
      lien: x?.lien ?? '',
      ref_fournisseur: x?.ref_fournisseur ?? '',
      ...(initial?.prive || {})
    };
  });
  const [opsPhotos, setOpsPhotos] = useState([]);
  const [grande, setGrande] = useState(null);
  const [mode, setMode] = useState(existant ? 'voir' : 'modifier');
  const [vue, setVue] = useState(0);
  const [erreur, setErreur] = useState('');
  const info = useMemo(() => infosShopify(d.shopify, d.comptoir, p.shopify_product_id), [d.shopify, d.comptoir, p.shopify_product_id]);
  const maj = (k) => (e) => setP((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const majPv = (k) => (e) => setPv((x) => ({ ...x, [k]: e.target.value }));

  const achat = nombre(pv.prix_achat);
  const vente = nombre(pv.prix_vente) ?? (info?.prix != null ? Number(info.prix) : null);
  const marge = achat != null && vente != null ? vente - achat : null;

  async function enregistrer() {
    if (!p.marque.trim()) return setErreur('La marque est obligatoire.');
    const { prive: _ignore, ...reste } = p;
    const ligne = {
      ...reste,
      marque: p.marque.trim(),
      quantite: Math.max(1, Number(p.quantite) || 1)
    };
    const prive = admin
      ? {
          prix_achat: achat,
          prix_vente: nombre(pv.prix_vente) ?? (info?.prix != null ? Number(info.prix) : null),
          fournisseur: pv.fournisseur || null,
          lien: pv.lien || null,
          ref_fournisseur: pv.ref_fournisseur || null
        }
      : null;
    const r = await d.enregistrerPhare(ligne, prive, opsPhotos);
    onEnregistre?.(r);
    onFermer();
  }

  const ajouterPhoto = (champ) => ({ chemin, op }) => {
    setP((x) => ({ ...x, [champ]: [...(x[champ] || []), chemin] }));
    setOpsPhotos((o) => [...o, op]);
  };
  const retirerPhoto = (champ, chemin) => setP((x) => ({ ...x, [champ]: x[champ].filter((c) => c !== chemin) }));

  const pvVisible = d.prive[existant?.id] || {};

  if (!admin || mode === 'voir') {
    // Consultation : grandes photos qu'on peut agrandir et zoomer. L'admin peut passer en modification.
    const toutes = [...p.photos, ...p.photos_fiche];
    const principale = toutes[vue] || null;
    return (
      <Feuille
        titre={`${p.marque} ${p.modele || ''}`}
        onFermer={onFermer}
        pied={
          admin ? (
            <button type="button" className="btn btn-rouge btn-plein" onClick={() => setMode('modifier')}>
              Modifier ce phare
            </button>
          ) : null
        }
      >
        {toutes.length > 0 ? (
          <>
            <button type="button" className="galerie-grande" onClick={() => setGrande(vue)} aria-label="Agrandir la photo">
              <img src={srcPhoto(principale)} alt={`Photo ${vue + 1} du phare`} />
            </button>
            {toutes.length > 1 && (
              <div className="galerie-mini">
                {toutes.map((c, i) => (
                  <div key={c} className={i === vue ? 'on' : ''} style={{ flex: 'none' }}>
                    <Vignette chemin={c} taille={64} onClick={() => setVue(i)} alt={`Photo ${i + 1}`} />
                  </div>
                ))}
              </div>
            )}
            <div className="aide">Appuie sur la photo pour l'agrandir et zoomer.</div>
          </>
        ) : info?.image ? (
          <button type="button" className="galerie-grande" onClick={() => setGrande(-1)} aria-label="Agrandir la photo">
            <img src={info.image} alt="Photo du site" />
          </button>
        ) : null}
        <div className="bloc">
          <div className="trois">
            <Info l="Modèle" v={p.modele} />
            <Info l="Année" v={p.annees} />
            <Info l="Côté" v={libelleCote(p.cote)} />
            <Info l="Position" v={p.position} />
            <Info l="Type" v={p.type_eclairage} />
            <Info l="Statut" v={STATUTS_PHARE[p.statut]} />
          </div>
          <div>
            <div className="lab">Réf. d'origine (OE)</div>
            <LienRef valeur={p.ref_oe} />
          </div>
          {pvVisible.ref_fournisseur && (
            <div>
              <div className="lab">Réf. fournisseur</div>
              <LienRef valeur={pvVisible.ref_fournisseur} suffixe="headlight" />
            </div>
          )}
          {p.non_compatible && <span className="pastille p-rouge" style={{ justifySelf: 'start' }}>Non compatible</span>}
          {p.note && <Info l="Note" v={p.note} />}
        </div>
        {(pvVisible.prix_vente != null || pvVisible.prix_achat != null || pvVisible.marge != null || pvVisible.fournisseur) && (
          <div className="bloc">
            <div className="trois">
              {pvVisible.prix_achat != null && <Info l="Achat" v={euro(pvVisible.prix_achat)} />}
              {pvVisible.prix_vente != null && <Info l="Vente" v={euro(pvVisible.prix_vente)} />}
              {pvVisible.marge != null && <Info l="Marge" v={euro(pvVisible.marge)} />}
            </div>
            {pvVisible.fournisseur && <Info l="Fournisseur" v={pvVisible.fournisseur} />}
            {pvVisible.lien && (
              <a href={pvVisible.lien} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                Voir le produit chez le fournisseur
              </a>
            )}
          </div>
        )}
        {info && (
          <div className="bloc">
            <div className="trois">
              <Info l="Stock Shopify" v={info.stock <= 0 ? `0 · Rupture` : info.stock} />
              <Info l="Ventes 60 j" v={info.ventes + info.comptoir} />
              <Info l="Prix site" v={euro(info.prix)} />
            </div>
            <div className="pastilles">
              <PastillesVentes info={info} />
            </div>
          </div>
        )}
        {grande !== null && (
          <PhotoGrande
            chemins={grande === -1 ? [info?.image] : toutes}
            depart={grande === -1 ? 0 : grande}
            onFermer={() => setGrande(null)}
          />
        )}
      </Feuille>
    );
  }

  return (
    <Feuille
      titre={existant ? 'Fiche phare' : 'Nouveau phare'}
      onFermer={onFermer}
      pied={
        <>
          {erreur && <div className="bandeau erreur">{erreur}</div>}
          <div className={existant ? 'deux' : ''}>
            {existant && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  if (!window.confirm('Supprimer ce phare de la base ?')) return;
                  await d.supprimerPhare(existant.id);
                  onFermer();
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
      <div className="bloc">
        <h4>Photos du phare</h4>
        <div className="photos-ligne">
          {p.photos.map((c) => (
            <div className="photo-mini" key={c}>
              <Vignette chemin={c} taille={80} onClick={() => setGrande([...p.photos, ...p.photos_fiche].indexOf(c))} />
              <button type="button" className="retirer" aria-label="Retirer la photo" onClick={() => retirerPhoto('photos', c)}>
                ×
              </button>
            </div>
          ))}
          <BoutonPhoto onPhoto={ajouterPhoto('photos')} libelle="Photo" />
        </div>
        <h4>Photos de la fiche fournisseur</h4>
        <div className="photos-ligne">
          {p.photos_fiche.map((c) => (
            <div className="photo-mini" key={c}>
              <Vignette chemin={c} taille={80} onClick={() => setGrande([...p.photos, ...p.photos_fiche].indexOf(c))} />
              <button type="button" className="retirer" aria-label="Retirer la photo" onClick={() => retirerPhoto('photos_fiche', c)}>
                ×
              </button>
            </div>
          ))}
          <BoutonPhoto onPhoto={ajouterPhoto('photos_fiche')} libelle="Fiche" />
        </div>
      </div>

      <div className="bloc">
        <div className="deux">
          <Champ label="Marque *">
            <input value={p.marque} onChange={maj('marque')} placeholder="Ex. Peugeot" />
          </Champ>
          <Champ label="Modèle">
            <input value={p.modele || ''} onChange={maj('modele')} placeholder="Ex. 208 II" />
          </Champ>
          <Champ label="Années">
            <input value={p.annees || ''} onChange={maj('annees')} placeholder="Ex. 2019–2023" />
          </Champ>
          <Champ label="Type">
            <select value={p.type_eclairage || ''} onChange={maj('type_eclairage')}>
              <option value="">—</option>
              <option>Halogène</option>
              <option>Xénon</option>
              <option>LED</option>
              <option>Full LED</option>
            </select>
          </Champ>
        </div>
        <Champ label="Côté">
          <Segments valeur={p.cote} onChange={maj('cote')} options={[['gauche', 'Gauche'], ['droit', 'Droit'], ['paire', 'Paire']]} />
        </Champ>
        <Champ label="Position">
          <Segments valeur={p.position} onChange={maj('position')} options={[['avant', 'Avant'], ['arriere', 'Arrière (feu)']]} />
        </Champ>
      </div>

      <div className="bloc">
        <Champ label="Réf. d'origine (OE)">
          <div className="avec-bouton">
            <input value={p.ref_oe || ''} onChange={maj('ref_oe')} style={{ fontFamily: 'var(--mono)' }} />
            {p.ref_oe && (
              <a className="petit-bouton neutre" style={{ display: 'inline-flex', alignItems: 'center' }} href={lienGoogle(`${p.ref_oe} phare`)} target="_blank" rel="noreferrer">
                Google
              </a>
            )}
          </div>
        </Champ>
        <Champ label="Réf. fournisseur Chine">
          <div className="avec-bouton">
            <input value={pv.ref_fournisseur} onChange={majPv('ref_fournisseur')} style={{ fontFamily: 'var(--mono)' }} />
            {pv.ref_fournisseur && (
              <a className="petit-bouton neutre" style={{ display: 'inline-flex', alignItems: 'center' }} href={lienGoogle(`${pv.ref_fournisseur} headlight`)} target="_blank" rel="noreferrer">
                Google
              </a>
            )}
          </div>
        </Champ>
        <div className="deux">
          <Champ label="Fournisseur">
            <input value={pv.fournisseur} onChange={majPv('fournisseur')} />
          </Champ>
          <Champ label="Lien du produit">
            <div className="avec-bouton">
              <input value={pv.lien} onChange={majPv('lien')} inputMode="url" />
              {pv.lien && (
                <a className="petit-bouton neutre" style={{ display: 'inline-flex', alignItems: 'center' }} href={pv.lien} target="_blank" rel="noreferrer">
                  Voir
                </a>
              )}
            </div>
          </Champ>
        </div>
      </div>

      <div className="bloc">
        <h4>
          <Icone.cadenas /> Prix · visible seulement par toi (sauf si tu l'autorises)
        </h4>
        <div className="trois">
          <Champ label="Achat (€)">
            <input value={pv.prix_achat} onChange={majPv('prix_achat')} inputMode="decimal" />
          </Champ>
          <Champ label="Vente (€)" aide={info?.prix != null && pv.prix_vente === '' ? `Site : ${euro(info.prix)}` : null}>
            <input value={pv.prix_vente} onChange={majPv('prix_vente')} inputMode="decimal" placeholder={info?.prix != null ? String(info.prix) : ''} />
          </Champ>
          <div>
            <div className="lab">Marge</div>
            <div className="marge">
              {marge != null ? `${euro(marge)}${vente ? ` · ${Math.round((marge / vente) * 100)} %` : ''}` : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="bloc">
        <h4>Produit sur ton site (Shopify)</h4>
        <ChoixShopify valeur={p.shopify_product_id} onChange={maj('shopify_product_id')} />
        {info && (
          <>
            <div className="infos-shopify">
              <Info l="Stock" v={info.stock <= 0 ? '0 · Rupture' : info.stock} rouge={info.stock <= 0} />
              <Info l="Ventes 60 j" v={info.ventes} />
              <Info l="Comptoir 60 j" v={info.comptoir} />
            </div>
            <div className="pastilles">
              <PastillesVentes info={info} />
            </div>
          </>
        )}
      </div>

      <div className="bloc">
        <Champ label="Statut">
          <Segments petit valeur={p.statut} onChange={maj('statut')} options={Object.entries(STATUTS_PHARE)} />
        </Champ>
        <div className="deux">
          <Champ label="Quantité">
            <input value={p.quantite} onChange={maj('quantite')} inputMode="numeric" />
          </Champ>
          <Champ label="Non compatible">
            <Segments petit valeur={p.non_compatible ? 'oui' : 'non'} onChange={(v) => setP((x) => ({ ...x, non_compatible: v === 'oui' }))} options={[['non', 'Non'], ['oui', 'Oui']]} />
          </Champ>
        </div>
        <Champ label="Note">
          <textarea value={p.note || ''} onChange={maj('note')} placeholder={p.non_compatible ? 'Pourquoi il n’est pas compatible…' : ''} />
        </Champ>
      </div>
      {grande !== null && grande >= 0 && <PhotoGrande chemins={[...p.photos, ...p.photos_fiche]} depart={grande} onFermer={() => setGrande(null)} />}
    </Feuille>
  );
}

function Info({ l, v, rouge }) {
  return (
    <div>
      <div className="lab">{l}</div>
      <div className="val" style={rouge ? { color: 'var(--rouge-fonce)' } : null}>
        {v === 0 ? 0 : v || '—'}
      </div>
    </div>
  );
}
