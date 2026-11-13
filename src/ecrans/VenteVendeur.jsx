import { useState } from 'react';
import { useDonnees } from '../lib/donnees.jsx';
import { dateCourte, libelleCote } from '../lib/outils.js';
import { BoutonPhoto, ChoixShopify, Champ, Icone, Segments, Vide, Vignette } from '../composants/ui.jsx';

const STATUT_VENTE = { en_attente: ['En attente', 'p-orange'], ajoute: ['Vu par le patron', 'p-bleu'], commande: ['Commandé', 'p-vert'], ignore: ['Pas commandé', ''] };

export default function VenteVendeur() {
  const d = useDonnees();
  const vide = { type: 'comptoir', marque: '', modele: '', annee: '', cote: 'gauche', ref: '', photo: null, shopify_product_id: null };
  const [v, setV] = useState(vide);
  const [opPhoto, setOpPhoto] = useState(null);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const maj = (k) => (e) => setV((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const mesVentes = d.ventes.filter((x) => x.vendeur_id === d.profil?.id).slice(0, 20);

  async function envoyer() {
    setErreur('');
    if (!v.photo) return setErreur('Prends d’abord la photo du phare.');
    if (!v.marque) return setErreur('Indique au moins la marque.');
    await d.declarerVente({ ...v, ref: v.ref || null, annee: v.annee || null, modele: v.modele || null }, opPhoto);
    setV(vide);
    setOpPhoto(null);
    setMessage(d.enLigne ? 'Envoyé, merci !' : 'Enregistré. L’envoi partira tout seul au retour du réseau.');
    setTimeout(() => setMessage(''), 3500);
  }

  return (
    <main>
      <section className="bloc" style={{ background: 'var(--carte)', marginTop: 10 }}>
        {v.photo ? (
          <div className="photo-mini" style={{ justifySelf: 'start' }}>
            <Vignette chemin={v.photo} taille={140} />
            <button type="button" className="retirer" aria-label="Retirer la photo" onClick={() => { setV((x) => ({ ...x, photo: null })); setOpPhoto(null); }}>
              ×
            </button>
          </div>
        ) : (
          <BoutonPhoto
            grand
            libelle="Prendre la photo du phare"
            onPhoto={({ chemin, op }) => {
              setV((x) => ({ ...x, photo: chemin }));
              setOpPhoto(op);
            }}
          />
        )}
        <Champ label="Type de vente">
          <Segments valeur={v.type} onChange={maj('type')} options={[['comptoir', 'Comptoir'], ['en_ligne', 'Commande en ligne']]} />
        </Champ>
        <div className="deux">
          <Champ label="Marque">
            <input value={v.marque} onChange={maj('marque')} placeholder="Ex. Peugeot" />
          </Champ>
          <Champ label="Modèle">
            <input value={v.modele} onChange={maj('modele')} placeholder="Ex. 208 II" />
          </Champ>
          <Champ label="Année">
            <input value={v.annee} onChange={maj('annee')} placeholder="Ex. 2020" inputMode="numeric" />
          </Champ>
          <Champ label="Côté">
            <select value={v.cote} onChange={maj('cote')}>
              <option value="gauche">Gauche</option>
              <option value="droit">Droit</option>
              <option value="paire">Paire</option>
            </select>
          </Champ>
        </div>
        <Champ label="Référence (si visible sur le phare)">
          <input value={v.ref} onChange={maj('ref')} placeholder="Facultatif" style={{ fontFamily: 'var(--mono)' }} />
        </Champ>
        {d.shopify.length > 0 && (
          <Champ label="Produit sur le site (facultatif, pour compter la vente comptoir)">
            <ChoixShopify valeur={v.shopify_product_id} onChange={maj('shopify_product_id')} />
          </Champ>
        )}
        {erreur && <div className="bandeau erreur">{erreur}</div>}
        <button type="button" className="btn btn-rouge" onClick={envoyer}>
          Envoyer
        </button>
        <div className="cadenas">
          {d.enLigne ? <Icone.enLigne /> : <Icone.horsLigne />}
          {d.enLigne ? 'En ligne : envoi immédiat.' : 'Sans réseau : l’envoi partira tout seul au retour du réseau.'}
        </div>
        <div className="aide">Pense aussi à baisser le stock dans Shopify comme d’habitude.</div>
      </section>

      <h2 className="groupe">Mes derniers envois</h2>
      <div className="liste">
        {mesVentes.map((x) => (
          <div className="carte" key={x.id}>
            <Vignette chemin={x.photo} taille={52} />
            <div className="corps">
              <div className="titre" style={{ fontSize: 14 }}>
                {[x.marque, x.modele].filter(Boolean).join(' ')} · {libelleCote(x.cote)}
              </div>
              <div className="details">
                {x.type === 'comptoir' ? 'Comptoir' : 'En ligne'} · {dateCourte(x.created_at)}
              </div>
            </div>
            <span className={`pastille ${STATUT_VENTE[x.statut]?.[1] || ''}`} style={{ alignSelf: 'center' }}>
              {STATUT_VENTE[x.statut]?.[0]}
            </span>
          </div>
        ))}
      </div>
      {!mesVentes.length && <Vide titre="Aucun envoi pour l’instant" texte="" />}
      {message && <div className="toast" role="status">{message}</div>}
    </main>
  );
}
