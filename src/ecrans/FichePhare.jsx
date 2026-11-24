import { useMemo, useState } from 'react';
import { useDonnees, srcPhoto } from '../lib/donnees.jsx';
import { STATUTS_PHARE, euro, yuan, margeMarche, niveauMarge, qte, libelleCote, lienGoogle, nombre, nomPays } from '../lib/outils.js';
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

export function CartePhare({ phare, onOuvrir, selection, onSelection, extra }) {
  const { prive, shopify, comptoir, profil, reglages } = useDonnees();
  const pv = prive[phare.id];
  const info = infosShopify(shopify, comptoir, phare.shopify_product_id);
  const sel = selection?.has(phare.id);
  const prixVente = pv?.prix_vente ?? (info?.prix != null ? Number(info.prix) : null);
  const marge = pv?.marge != null ? pv.marge : pv?.prix_achat != null && prixVente != null ? prixVente - pv.prix_achat : null;
  const pctMarge = marge != null && prixVente ? Math.round((marge / prixVente) * 100) : null;
  const [grande, setGrande] = useState(false);
  const [depart, setDepart] = useState(0);
  const toutes = [...(phare.photos || []), ...(phare.photos_fiche || [])];
  return (
    <div className={sel ? 'carte sel' : 'carte'}>
      {grande && <PhotoGrande chemins={toutes.length ? toutes : [info?.image]} depart={depart} onFermer={() => setGrande(false)} />}
      {onSelection && (
        <button type="button" className={sel ? 'case on' : 'case'} aria-pressed={!!sel} aria-label={`Sélectionner ${phare.marque} ${phare.modele || ''}`} onClick={() => onSelection(phare.id)}>
          {sel && <Icone.coche />}
        </button>
      )}
      <Vignette
        chemin={phare.photos?.[0] || phare.photos_fiche?.[0]}
        url={!phare.photos?.[0] && !phare.photos_fiche?.[0] ? info?.image : null}
        taille={64}
        onClick={() => {
          setDepart(0);
          toutes.length || info?.image ? setGrande(true) : onOuvrir(phare);
        }}
      />
      <div className="corps">
        <button type="button" className="ouvrir" onClick={() => onOuvrir(phare)}>
          <span className="titre">
            {phare.marque}
            {/* Base 2 / Commande phare : la quantité est affichée à part, seulement dans la commande */}
            {!phare.base2 && !phare.en_commande && phare.quantite > 1 ? ` · x${phare.quantite}` : ''}
          </span>
          <span className="mvc">
            <span>
              <span className="lab">Modèle</span>
              <span className="val">
                {profil?.role === 'admin' && pv?.prix_marche != null && <PointMarge pv={pv} frais={reglages?.frais_arrivee ?? 15} />}
                {phare.modele || '—'}
              </span>
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
          {phare.type_eclairage && (
            <span className="options-phare">
              <span className="lab">Options</span> <span className="val">{phare.type_eclairage}</span>
            </span>
          )}
        </button>
        <LienRef valeur={phare.ref_oe} />
        <PastillesPhare phare={phare} />
        {profil?.role === 'admin' && pv?.prix_marche != null && <PastilleMarge pv={pv} frais={reglages?.frais_arrivee ?? 15} />}
        {(pv?.prix_achat != null || pv?.prix_achat_rmb != null || pv?.prix_achat_variantes) && (
          <div className="prix-achat">
            <span className="lab">Achat</span>{' '}
            {pv.prix_achat != null || pv.prix_achat_rmb != null
              ? [pv.prix_achat != null ? euro(pv.prix_achat) : null, pv.prix_achat_rmb != null ? yuan(pv.prix_achat_rmb) : null].filter(Boolean).join(' · ')
              : null}
            {pv.prix_achat_variantes && <span className="variantes">{pv.prix_achat_variantes}</span>}
          </div>
        )}
        {toutes.length > 1 && (
          <div className="mini-photos" aria-label={`${toutes.length} photos`}>
            {toutes.map((c, i) => (
              <button
                key={c}
                type="button"
                className="mini-photo"
                onClick={() => {
                  setDepart(i);
                  setGrande(true);
                }}
                aria-label={`Photo ${i + 1}${phare.photos_legendes?.[c] ? ` : ${phare.photos_legendes[c]}` : ''}`}
              >
                <img src={srcPhoto(c)} alt="" loading="lazy" />
                {phare.photos_legendes?.[c] && <span>{phare.photos_legendes[c]}</span>}
              </button>
            ))}
          </div>
        )}
        {extra}
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

// Petit point de couleur devant le modèle (administrateur seulement)
function PointMarge({ pv, frais }) {
  const m = margeMarche(pv, frais);
  const n = niveauMarge(m) || 'gris';
  return <span className={`point-marge pm-${n}`} title={m != null ? `Marge marché ${Math.round(m * 100)} %` : "Marge marché : prix d'achat manquant"} aria-label={m != null ? `Marge marché ${Math.round(m * 100)} %` : 'Marge marché inconnue'} />;
}

// Marge marché, seulement pour l'administrateur : 🟢 80 % et plus · 🟠 50 à 80 % · 🔴 moins de 50 %
export function PastilleMarge({ pv, frais }) {
  const m = margeMarche(pv, frais);
  const n = niveauMarge(m);
  if (!n) return <div className="pastilles"><span className="pastille p-gris">Marge marché : prix d'achat manquant</span></div>;
  return (
    <div className="pastilles">
      <span className={`pastille p-${n}`}>Marge marché {Math.round(m * 100)} %</span>
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
      {phare.en_commande && (phare.base2 || phare.chine !== false) && <span className={qte(phare) > 0 ? 'pastille p-bleu' : 'pastille p-gris'}>{qte(phare) > 0 ? `En commande · x${qte(phare)}` : 'Quantité 0 · pas commandé'}</span>}
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
  shopify_product_id: null,
  chine: true,
  base2: false
};

export default function FichePhare({ phare, initial, onFermer, onEnregistre }) {
  const d = useDonnees();
  const admin = d.profil?.role === 'admin';
  // Le collègue en Chine peut gérer les phares des bases Chine (sans prix, fournisseur ni Shopify)
  const equipeChine = d.profil?.role === 'chine';
  const peutModifier = admin || equipeChine;
  const existant = phare?.id ? phare : null;
  const [p, setP] = useState(() => ({ ...VIDE, ...(existant || {}), ...(initial || {}) }));
  const [pv, setPv] = useState(() => {
    const x = existant ? d.prive[existant.id] : null;
    return {
      prix_achat: x?.prix_achat ?? '',
      prix_achat_rmb: x?.prix_achat_rmb ?? '',
      prix_achat_variantes: x?.prix_achat_variantes ?? '',
      prix_marche: x?.prix_marche ?? '',
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
      quantite: qte(p)
    };
    const prive = admin
      ? {
          prix_achat: achat,
          prix_achat_rmb: nombre(pv.prix_achat_rmb),
          prix_achat_variantes: pv.prix_achat_variantes?.trim() || null,
          prix_marche: nombre(pv.prix_marche),
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

  if (!peutModifier || mode === 'voir') {
    // Consultation : grandes photos qu'on peut agrandir et zoomer. L'admin peut passer en modification.
    const toutes = [...p.photos, ...p.photos_fiche];
    const principale = toutes[vue] || null;
    return (
      <Feuille
        titre={`${p.marque} ${p.modele || ''}`}
        onFermer={onFermer}
        pied={
          peutModifier ? (
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
            {p.photos_legendes?.[principale] && <div className="legende-photo">{p.photos_legendes[principale]}</div>}
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
        {(pvVisible.prix_vente != null || pvVisible.prix_achat != null || pvVisible.prix_achat_rmb != null || (admin && pvVisible.prix_marche != null) || pvVisible.prix_achat_variantes || pvVisible.marge != null || pvVisible.fournisseur) && (
          <div className="bloc">
            <div className="trois">
              {pvVisible.prix_achat != null && <Info l="Achat" v={euro(pvVisible.prix_achat)} />}
              {pvVisible.prix_achat_rmb != null && <Info l="Achat (¥)" v={yuan(pvVisible.prix_achat_rmb)} />}
              {pvVisible.prix_vente != null && <Info l="Vente" v={euro(pvVisible.prix_vente)} />}
              {pvVisible.marge != null && <Info l="Marge" v={euro(pvVisible.marge)} />}
            </div>
            {pvVisible.prix_achat_variantes && <Info l="Prix selon la version" v={pvVisible.prix_achat_variantes} />}
            {admin && pvVisible.prix_marche != null && (
              <div className="trois">
                <Info l="Prix marché occasion" v={euro(pvVisible.prix_marche)} />
                <Info l="Marge marché" v={margeMarche(pvVisible, d.reglages?.frais_arrivee ?? 15) != null ? `${Math.round(margeMarche(pvVisible, d.reglages?.frais_arrivee ?? 15) * 100)} %` : '—'} />
              </div>
            )}
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
                  if (!window.confirm(existant.en_commande ? 'Supprimer ce phare de la base ? Il sera aussi retiré de Commande phare.' : 'Supprimer ce phare de la base ?')) return;
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
          <Champ label="Options (éclairage)">
            {/* Texte libre : Full LED, Matrix LED, Bi-Xénon, Pixel LED… */}
            <input list="types-eclairage" value={p.type_eclairage || ''} onChange={maj('type_eclairage')} placeholder="Ex. Full LED, Matrix LED" />
            <datalist id="types-eclairage">
              <option value="Halogène" />
              <option value="Xénon" />
              <option value="Bi-Xénon" />
              <option value="LED" />
              <option value="Full LED" />
              <option value="Matrix LED" />
              <option value="Pixel LED" />
              <option value="Laser" />
            </datalist>
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
        {admin && (
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
        )}
        {admin && (
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
        )}
      </div>

      {admin && (
        <>
      <div className="bloc">
        <h4>
          <Icone.cadenas /> Prix · visible seulement par toi (sauf si tu l'autorises)
        </h4>
        <div className="trois">
          <Champ label="Achat (€)">
            <input value={pv.prix_achat} onChange={majPv('prix_achat')} inputMode="decimal" />
          </Champ>
          <Champ label="Achat (¥)">
            <input value={pv.prix_achat_rmb} onChange={majPv('prix_achat_rmb')} inputMode="decimal" />
          </Champ>
        </div>
        <Champ label="Prix marché occasion (€ TTC)" aide={`Prix d'un phare d'origine d'occasion en Europe. La marge marché = ce prix hors TVA moins ton prix d'achat et ${d.reglages?.frais_arrivee ?? 15} € de frais d'arrivée.`}>
          <input value={pv.prix_marche} onChange={majPv('prix_marche')} inputMode="decimal" />
        </Champ>
        <Champ label="Prix selon la version (si plusieurs prix)">
          <input value={pv.prix_achat_variantes} onChange={majPv('prix_achat_variantes')} placeholder="Ex. Avec ventilateur : 600 ¥ · Sans ventilateur : 850 ¥" />
        </Champ>
        <div className="trois">
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
        </>
      )}

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
        {admin && (
        <Champ label="Où ranger ce phare ?">
          <Segments
            petit
            valeur={p.chine === false ? 'site' : p.base2 ? 'base2' : 'chine'}
            onChange={(v) => setP((x) => ({ ...x, chine: v !== 'site', base2: v === 'base2', en_commande: v === 'base2' ? !!x.en_commande : false }))}
            options={[
              ['chine', 'Base Chine'],
              ['base2', 'Base 2'],
              ['site', 'Phare du site']
            ]}
          />
        </Champ>
        )}
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
