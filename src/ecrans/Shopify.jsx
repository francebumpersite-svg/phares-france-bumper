import { useMemo, useState } from 'react';
import { useDonnees } from '../lib/donnees.jsx';
import { appelFonction } from '../lib/supabase.js';
import { dateHeure, devinerDepuisTitre, euro, normaliser } from '../lib/outils.js';
import { Icone, PhotoGrande, Vide, Vignette } from '../composants/ui.jsx';
import FichePhare, { PastillesVentes, infosShopify } from './FichePhare.jsx';

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

function ListeProduits({ produits, vide }) {
  const d = useDonnees();
  const admin = d.profil?.role === 'admin';
  const [q, setQ] = useState('');
  const [fiche, setFiche] = useState(null);
  const [grande, setGrande] = useState(null);
  const [limite, setLimite] = useState(60);
  const enListe = useMemo(() => {
    const m = {};
    for (const p of d.phares) if (p.shopify_product_id && ['a_commander', 'commande'].includes(p.statut)) m[p.shopify_product_id] = p.statut;
    return m;
  }, [d.phares]);
  const filtres = useMemo(() => {
    const n = normaliser(q);
    return n ? produits.filter((p) => normaliser(p.titre).includes(n)) : produits;
  }, [q, produits]);

  return (
    <>
      <div className="outils">
        <label className="recherche">
          <Icone.loupe />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marque, modèle…" aria-label="Rechercher" />
        </label>
      </div>
      <main>
        <BandeauSynchro />
        <div className="liste">
          {filtres.slice(0, limite).map((p) => (
            <div className="carte" key={p.id}>
              <Vignette url={p.image} taille={56} alt={p.titre} onClick={p.image ? () => setGrande(p.image) : undefined} />
              <div className="corps">
                <div className="titre" style={{ fontSize: 14 }}>{p.titre}</div>
                <div className="details">
                  {p.stock <= 0 ? 'Stock 0' : `Stock ${p.stock}`} · {p.ventes + p.comptoir ? `vendu ${p.ventes + p.comptoir} fois / 60 j` : 'aucune vente / 60 j'} · {euro(p.prix)}
                </div>
                <div className="pastilles">
                  {p.stock <= 0 && <span className="pastille p-rouge">Rupture</span>}
                  <PastillesVentes info={p} />
                </div>
              </div>
              {admin &&
                (enListe[p.id] ? (
                  <span className="pastille p-vert" style={{ alignSelf: 'center' }}>
                    {enListe[p.id] === 'commande' ? 'Commandé' : 'Dans la liste'}
                  </span>
                ) : (
                  <button type="button" className="petit-bouton" style={{ alignSelf: 'center' }} onClick={() => setFiche({ ...devinerDepuisTitre(p.titre), shopify_product_id: p.id, statut: 'a_commander', chine: false })}>
                    + À commander
                  </button>
                ))}
            </div>
          ))}
        </div>
        {filtres.length > limite && (
          <button type="button" className="btn btn-plein" style={{ marginTop: 12 }} onClick={() => setLimite((l) => l + 100)}>
            Voir plus
          </button>
        )}
        {!filtres.length && <Vide titre={vide} texte={!d.shopify.length ? 'Aucun phare Shopify synchronisé pour l’instant.' : ''} />}
      </main>
      {fiche && <FichePhare initial={fiche} onFermer={() => setFiche(null)} />}
      {grande && <PhotoGrande url={grande} onFermer={() => setGrande(null)} />}
    </>
  );
}

export function Ruptures() {
  const produits = useProduits();
  const liste = useMemo(
    () => produits.filter((p) => p.stock <= 0).sort((a, b) => b.ventes + b.comptoir - (a.ventes + a.comptoir) || a.titre.localeCompare(b.titre, 'fr')),
    [produits]
  );
  return <ListeProduits produits={liste} vide="Aucune rupture" />;
}

export function MeilleuresVentes() {
  const produits = useProduits();
  const liste = useMemo(
    () => produits.filter((p) => p.ventes + p.comptoir > 0).sort((a, b) => b.ventes + b.comptoir - (a.ventes + a.comptoir)),
    [produits]
  );
  return <ListeProduits produits={liste} vide="Aucune vente de phare sur 60 jours" />;
}
