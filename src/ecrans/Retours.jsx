import { useState } from 'react';
import { useDonnees } from '../lib/donnees.jsx';
import { dateCourte } from '../lib/outils.js';
import { BoutonPhoto, Champ, Feuille, LienRef, PhotoGrande, Segments, Vide, Vignette } from '../composants/ui.jsx';

export default function Retours() {
  const d = useDonnees();
  const admin = d.profil?.role === 'admin';
  const [filtre, setFiltre] = useState('ouvert');
  const [fiche, setFiche] = useState(null);
  const [grande, setGrande] = useState(null);
  const liste = d.retours.filter((r) => filtre === 'tout' || r.statut === filtre);

  return (
    <>
      <div className="outils">
        <Segments valeur={filtre} onChange={setFiltre} options={[['ouvert', 'À traiter'], ['traite', 'Traités'], ['tout', 'Tous']]} />
      </div>
      <main>
        <div className="liste">
          {liste.map((r) => (
            <div className="carte" key={r.id}>
              <Vignette chemin={r.photo} taille={64} onClick={r.photo ? () => setGrande(r.photo) : undefined} alt="Photo du retour" />
              <div className="corps">
                <div className="titre">{r.vehicule || 'Phare'}</div>
                <div className="details">
                  {r.client ? `${r.client} · ` : ''}
                  {dateCourte(r.created_at)}
                </div>
                {r.ref && <LienRef valeur={r.ref} />}
                {r.motif && <div style={{ fontSize: 14, marginTop: 4 }}>{r.motif}</div>}
                <div className="pastilles">
                  <span className={r.statut === 'ouvert' ? 'pastille p-orange' : 'pastille p-vert'}>{r.statut === 'ouvert' ? 'À traiter' : 'Traité'}</span>
                </div>
              </div>
              {admin && (
                <button
                  type="button"
                  className="petit-bouton neutre"
                  style={{ alignSelf: 'center' }}
                  onClick={() => d.enregistrerRetour({ ...r, statut: r.statut === 'ouvert' ? 'traite' : 'ouvert' })}
                >
                  {r.statut === 'ouvert' ? 'Traité' : 'Rouvrir'}
                </button>
              )}
            </div>
          ))}
        </div>
        {!liste.length && <Vide titre="Aucun retour" texte="" />}
      </main>
      {d.profil?.role !== 'lecteur' && (
        <div className="barre">
          <div className="barre-in">
            <button type="button" className="btn btn-rouge" onClick={() => setFiche({})}>
              + Nouveau retour client
            </button>
          </div>
        </div>
      )}
      {fiche && <FicheRetour onFermer={() => setFiche(null)} />}
      {grande && <PhotoGrande chemin={grande} onFermer={() => setGrande(null)} />}
    </>
  );
}

function FicheRetour({ onFermer }) {
  const d = useDonnees();
  const [r, setR] = useState({ photo: null, vehicule: '', ref: '', client: '', motif: '', statut: 'ouvert' });
  const [ops, setOps] = useState([]);
  const [erreur, setErreur] = useState('');
  const maj = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Feuille
      titre="Nouveau retour client"
      onFermer={onFermer}
      pied={
        <>
          {erreur && <div className="bandeau erreur">{erreur}</div>}
          <button
            type="button"
            className="btn btn-rouge btn-plein"
            onClick={async () => {
              if (!r.vehicule && !r.ref && !r.photo) return setErreur('Mets au moins une photo, le véhicule ou la référence.');
              await d.enregistrerRetour(r, ops);
              onFermer();
            }}
          >
            Enregistrer
          </button>
        </>
      }
    >
      {r.photo ? (
        <Vignette chemin={r.photo} taille={120} />
      ) : (
        <BoutonPhoto
          grand
          libelle="Photo du phare retourné"
          onPhoto={({ chemin, op }) => {
            setR((x) => ({ ...x, photo: chemin }));
            setOps((o) => [...o, op]);
          }}
        />
      )}
      <Champ label="Véhicule">
        <input value={r.vehicule} onChange={maj('vehicule')} placeholder="Ex. Renault Clio V · Avant droit" />
      </Champ>
      <Champ label="Référence">
        <input value={r.ref} onChange={maj('ref')} style={{ fontFamily: 'var(--mono)' }} />
      </Champ>
      <Champ label="Client">
        <input value={r.client} onChange={maj('client')} />
      </Champ>
      <Champ label="Motif du retour">
        <textarea value={r.motif} onChange={maj('motif')} placeholder="Ex. ne va pas sur la voiture, cassé à la livraison…" />
      </Champ>
    </Feuille>
  );
}
