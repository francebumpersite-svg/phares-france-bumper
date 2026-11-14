import { useMemo, useState } from 'react';
import { useDonnees } from '../lib/donnees.jsx';
import { STATUTS_DROP, dateCourte, euro, nombre, normaliser } from '../lib/outils.js';
import { BoutonPhoto, Champ, Feuille, Icone, LienRef, PhotoGrande, Segments, Vide, Vignette } from '../composants/ui.jsx';

const COULEUR = { a_commander: 'p-orange', commande: 'p-bleu', expedie: 'p-bleu', recu: 'p-vert', livre: 'p-vert', annule: '' };

export default function Dropshipping() {
  const d = useDonnees();
  const lecture = d.profil?.role === 'lecteur';
  const [filtre, setFiltre] = useState('en_cours');
  const [q, setQ] = useState('');
  const [fiche, setFiche] = useState(null);
  const liste = useMemo(() => {
    const n = normaliser(q);
    return d.dropship.filter((x) => {
      if (filtre === 'en_cours' && !['a_commander', 'commande', 'expedie'].includes(x.statut)) return false;
      if (filtre === 'termine' && ['a_commander', 'commande', 'expedie'].includes(x.statut)) return false;
      if (n && !normaliser([x.vehicule, x.ref, x.client_nom, x.client_tel, x.suivi].join(' ')).includes(n)) return false;
      return true;
    });
  }, [d.dropship, filtre, q]);

  return (
    <>
      <div className="outils">
        <Segments valeur={filtre} onChange={setFiltre} options={[['en_cours', 'En cours'], ['termine', 'Terminées'], ['tout', 'Toutes']]} />
        <label className="recherche">
          <Icone.loupe />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client, véhicule, référence…" aria-label="Rechercher" />
        </label>
      </div>
      <main>
        <div className="liste">
          {liste.map((x) => {
            const reste = x.paiement === 'total' ? 0 : (x.prix_total ?? 0) - (x.acompte ?? 0);
            return (
              <button type="button" className="carte" key={x.id} onClick={() => setFiche(x)}>
                <Vignette chemin={x.photo} taille={64} />
                <span className="corps">
                  <span className="titre" style={{ display: 'block' }}>{x.vehicule || 'Phare'}</span>
                  <span className="details" style={{ display: 'block' }}>
                    {x.client_nom || 'Client'} · {x.livraison === 'client' ? 'Livraison chez le client' : 'Livraison au dépôt'} · {dateCourte(x.created_at)}
                  </span>
                  {x.ref && <span className="ref" style={{ display: 'block' }}>{x.ref}</span>}
                  <span className="pastilles">
                    <span className={`pastille ${COULEUR[x.statut]}`}>{STATUTS_DROP[x.statut]}</span>
                    {x.paiement === 'total' ? (
                      <span className="pastille p-vert">Payé</span>
                    ) : (
                      <span className="pastille p-orange">Reste {euro(reste)}</span>
                    )}
                    {x.suivi && <span className="pastille">Suivi {x.suivi}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {!liste.length && <Vide titre="Aucune commande" texte={filtre === 'en_cours' ? 'Les commandes dropshipping en cours apparaîtront ici.' : ''} />}
      </main>
      {!lecture && (
        <div className="barre">
          <div className="barre-in">
            <button type="button" className="btn btn-rouge" onClick={() => setFiche({})}>
              + Nouvelle commande client
            </button>
          </div>
        </div>
      )}
      {fiche && <FicheDropship drop={fiche} lecture={lecture} onFermer={() => setFiche(null)} />}
    </>
  );
}

function FicheDropship({ drop, onFermer, lecture }) {
  const d = useDonnees();
  const nouveau = !drop.id;
  const [x, setX] = useState(() => ({
    photo: null,
    ref: '',
    vehicule: '',
    client_nom: '',
    client_tel: '',
    client_adresse: '',
    paiement: 'acompte',
    prix_total: '',
    acompte: '',
    livraison: 'depot',
    statut: 'a_commander',
    suivi: '',
    note: '',
    ...drop
  }));
  const [ops, setOps] = useState([]);
  const [erreur, setErreur] = useState('');
  const [grande, setGrande] = useState(false);
  const maj = (k) => (e) => setX((v) => ({ ...v, [k]: e?.target ? e.target.value : e }));
  const total = nombre(x.prix_total);
  const acompte = x.paiement === 'total' ? total : nombre(x.acompte);
  const reste = total != null ? total - (acompte ?? 0) : null;

  async function enregistrer() {
    if (!x.photo && !x.ref) return setErreur('Mets au moins une photo ou une référence.');
    if (!x.client_nom || !x.client_tel) return setErreur('Le nom et le téléphone du client sont obligatoires.');
    if (x.livraison === 'client' && !x.client_adresse) return setErreur("L'adresse du client est obligatoire pour une livraison chez lui.");
    await d.enregistrerDropship(
      {
        ...x,
        prix_total: total,
        acompte: x.paiement === 'total' ? total : nombre(x.acompte),
        suivi: x.suivi || null,
        note: x.note || null
      },
      ops
    );
    onFermer();
  }

  return (
    <Feuille
      titre={nouveau ? 'Nouvelle commande client' : 'Commande dropshipping'}
      onFermer={onFermer}
      pied={
        lecture ? null : (
          <>
            {erreur && <div className="bandeau erreur">{erreur}</div>}
            <button type="button" className="btn btn-rouge btn-plein" onClick={enregistrer}>
              {nouveau ? 'Envoyer à la Chine' : 'Enregistrer'}
            </button>
          </>
        )
      }
    >
      <fieldset disabled={lecture} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: 12 }}>
      <div className="bloc">
        <h4>Le phare</h4>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {x.photo ? (
            <div className="photo-mini">
              <Vignette chemin={x.photo} taille={96} onClick={() => setGrande(true)} />
              <button type="button" className="retirer" aria-label="Retirer la photo" onClick={() => setX((v) => ({ ...v, photo: null }))}>
                ×
              </button>
            </div>
          ) : (
            <BoutonPhoto
              libelle="Photo"
              onPhoto={({ chemin, op }) => {
                setX((v) => ({ ...v, photo: chemin }));
                setOps((o) => [...o, op]);
              }}
            />
          )}
          <div style={{ flex: 1, display: 'grid', gap: 8, minWidth: 0 }}>
            <Champ label="Référence">
              <input value={x.ref || ''} onChange={maj('ref')} style={{ fontFamily: 'var(--mono)' }} />
            </Champ>
            <Champ label="Véhicule">
              <input value={x.vehicule || ''} onChange={maj('vehicule')} placeholder="Ex. Peugeot 208 II · Avant gauche" />
            </Champ>
          </div>
        </div>
      </div>
      <div className="bloc">
        <h4>Le client</h4>
        <Champ label="Nom">
          <input value={x.client_nom || ''} onChange={maj('client_nom')} autoComplete="off" />
        </Champ>
        <Champ label="Téléphone">
          <div className="avec-bouton">
            <input type="tel" value={x.client_tel || ''} onChange={maj('client_tel')} autoComplete="off" />
            {x.client_tel && (
              <a className="petit-bouton neutre" style={{ display: 'inline-flex', alignItems: 'center' }} href={`tel:${x.client_tel.replace(/\s/g, '')}`}>
                Appeler
              </a>
            )}
          </div>
        </Champ>
        <Champ label="Adresse">
          <textarea value={x.client_adresse || ''} onChange={maj('client_adresse')} rows={2} placeholder="Rue, code postal, ville" />
        </Champ>
      </div>
      <div className="bloc">
        <h4>Paiement</h4>
        <Segments valeur={x.paiement} onChange={maj('paiement')} options={[['acompte', 'Acompte'], ['total', 'Payé en totalité']]} />
        <div className="deux">
          <Champ label="Prix total (€)">
            <input value={x.prix_total ?? ''} onChange={maj('prix_total')} inputMode="decimal" />
          </Champ>
          {x.paiement === 'acompte' && (
            <Champ label="Acompte versé (€)">
              <input value={x.acompte ?? ''} onChange={maj('acompte')} inputMode="decimal" />
            </Champ>
          )}
        </div>
        <div className="val">Reste à payer : {reste != null ? euro(Math.max(0, reste)) : '—'}</div>
      </div>
      <div className="bloc">
        <h4>Livraison du phare</h4>
        <Segments valeur={x.livraison} onChange={maj('livraison')} options={[['depot', 'Dépôt Taverny'], ['client', 'Chez le client']]} />
      </div>
      {!nouveau && (
        <div className="bloc">
          <h4>Suivi</h4>
          <Segments petit valeur={x.statut} onChange={maj('statut')} options={Object.entries(STATUTS_DROP).slice(0, 3)} />
          <Segments petit valeur={x.statut} onChange={maj('statut')} options={Object.entries(STATUTS_DROP).slice(3)} />
          <Champ label="N° de suivi du colis">
            <input value={x.suivi || ''} onChange={maj('suivi')} />
          </Champ>
        </div>
      )}
      <Champ label="Note pour la Chine (facultatif)">
        <textarea value={x.note || ''} onChange={maj('note')} rows={2} />
      </Champ>
      </fieldset>
      {grande && <PhotoGrande chemin={x.photo} onFermer={() => setGrande(false)} />}
    </Feuille>
  );
}

// Vue du collègue en Chine : uniquement les commandes à traiter
export function VueChine() {
  const d = useDonnees();
  const [filtre, setFiltre] = useState('a_faire');
  const [grande, setGrande] = useState(null);
  const liste = useMemo(
    () => d.chine.filter((x) => (filtre === 'a_faire' ? ['a_commander', 'commande'].includes(x.statut) : true)),
    [d.chine, filtre]
  );
  return (
    <main>
      <div style={{ margin: '10px 0' }}>
        <Segments valeur={filtre} onChange={setFiltre} options={[['a_faire', `À traiter (${d.chine.filter((x) => ['a_commander', 'commande'].includes(x.statut)).length})`], ['tout', 'Toutes']]} />
      </div>
      <div className="liste">
        {liste.map((x) => (
          <CarteChine key={x.id} x={x} onPhoto={() => x.photo && setGrande(x.photo)} />
        ))}
      </div>
      {!liste.length && <Vide titre="Rien à traiter" texte="Les nouvelles commandes apparaîtront ici." />}
      {grande && <PhotoGrande chemin={grande} onFermer={() => setGrande(null)} />}
    </main>
  );
}

function CarteChine({ x, onPhoto }) {
  const d = useDonnees();
  const [statut, setStatut] = useState(x.statut);
  const [suivi, setSuivi] = useState(x.suivi || '');
  const modifie = statut !== x.statut || (suivi || '') !== (x.suivi || '');
  const modifiable = ['a_commander', 'commande', 'expedie'].includes(x.statut);
  return (
    <article className="carte" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <Vignette chemin={x.photo} taille={88} onClick={x.photo ? onPhoto : undefined} alt="Photo prise au comptoir" />
        <div className="corps">
          <div className="titre">{x.vehicule || 'Phare'}</div>
          <LienRef valeur={x.ref} suffixe="headlight" />
          <div className="details">Commande du {dateCourte(x.created_at)}</div>
          <div className="pastilles">
            <span className={`pastille ${COULEUR[x.statut]}`}>{STATUTS_DROP[x.statut]}</span>
          </div>
        </div>
      </div>
      <div className="bloc" style={{ background: 'var(--fond)', border: 0 }}>
        {x.livraison === 'client' ? (
          <>
            <div className="lab">Livrer chez le client</div>
            <div className="val">{x.client_nom}</div>
            <div style={{ whiteSpace: 'pre-line' }}>{x.client_adresse}</div>
            {x.client_tel && <a href={`tel:${x.client_tel.replace(/\s/g, '')}`}>{x.client_tel}</a>}
          </>
        ) : (
          <>
            <div className="lab">Livrer au</div>
            <div className="val">Dépôt France Bumper · Taverny</div>
          </>
        )}
        {x.note && <div className="details">Note : {x.note}</div>}
      </div>
      {modifiable && (
        <>
          <Segments petit valeur={statut} onChange={setStatut} options={[['a_commander', 'À commander'], ['commande', 'Commandé'], ['expedie', 'Expédié']]} />
          <Champ label="N° de suivi du colis">
            <input value={suivi} onChange={(e) => setSuivi(e.target.value)} placeholder="À remplir à l'envoi" />
          </Champ>
          {modifie && (
            <button type="button" className="btn btn-rouge" onClick={() => d.majChine(x.id, statut, suivi)}>
              Enregistrer
            </button>
          )}
        </>
      )}
    </article>
  );
}
