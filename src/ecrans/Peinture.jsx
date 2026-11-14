// Onglet Peinture : pare-chocs commandés avec l'option peinture.
// Les commandes Shopify arrivent toutes seules (synchro toutes les heures) ; les ventes comptoir s'ajoutent à la main.
import { useMemo, useState } from 'react';
import { srcPhoto, useDonnees } from '../lib/donnees.jsx';
import { dateCourte, normaliser } from '../lib/outils.js';
import { BoutonPhoto, Champ, Feuille, Icone, PhotoGrande, Segments, Vide, Vignette } from '../composants/ui.jsx';

const MARQUES_2 = ['Land Rover', 'Range Rover', 'Alfa Romeo', 'Aston Martin', 'Mercedes Benz', 'Rolls Royce', 'DS Automobiles'];

// « Pare-choc arrière Opel Astra K phase 1 (10/2015 à 05/2020) — neuf » → { marque: 'Opel', modele: 'Astra K phase 1', cote: 'arrière' }
export function lirePiece(titre) {
  const t = String(titre || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(?:demi[\s-])?pare[\s-]?chocs?\s+(avant|arri[eè]re)?\s*(?:(?:gauche|droite?|complet|pour)\s+)*(.*)$/i);
  const cote = m?.[1] ? m[1].toLowerCase().replace('arriere', 'arrière') : '';
  let reste = (m ? m[2] : t)
    .split(/\s[(–—-]\s?|\s\(|,/)[0]
    .replace(/\s(occasion|neuf|d['’]origine|de \d{2}\/\d{4}|à partir|(?:depuis|dès) ).*$/i, '')
    .trim();
  const deux = MARQUES_2.find((b) => normaliser(reste).startsWith(normaliser(b)));
  const marque = deux || reste.split(' ')[0] || '';
  const modele = reste.slice(marque.length).trim();
  return { marque, modele, cote };
}

export default function Peinture() {
  const d = useDonnees();
  const lecture = d.profil?.role === 'lecteur';
  const [vue, setVue] = useState('a_peindre');
  const [q, setQ] = useState('');
  const [fiche, setFiche] = useState(null);
  const [nouveau, setNouveau] = useState(false);

  const liste = useMemo(() => {
    const n = normaliser(q);
    return d.peintures
      .filter((p) => !p.annulee && p.statut === vue)
      .filter((p) => !n || normaliser([p.piece, p.immat, p.commande, p.code_peinture, p.note].join(' ')).includes(n))
      .sort((a, b) => (vue === 'a_peindre' ? 1 : -1) * (new Date(a.date_commande) - new Date(b.date_commande)));
  }, [d.peintures, vue, q]);

  const nb = (s) => d.peintures.filter((p) => !p.annulee && p.statut === s).reduce((t, p) => t + (p.quantite || 1), 0);
  const ouverte = fiche && d.peintures.find((p) => p.id === fiche);

  return (
    <>
      <div className="outils">
        <Segments
          valeur={vue}
          onChange={setVue}
          options={[
            ['a_peindre', `À peindre (${nb('a_peindre')})`],
            ['expedie', `Expédiés (${nb('expedie')})`]
          ]}
        />
        <label className="recherche">
          <Icone.loupe />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marque, modèle, immatriculation, n° commande…" aria-label="Rechercher" />
        </label>
      </div>
      <main>
        {vue === 'a_peindre' && liste.length > 0 && (
          <div className="bandeau" style={{ marginBottom: 10 }}>
            <strong>{nb('a_peindre')}</strong> pare-choc{nb('a_peindre') > 1 ? 's' : ''} à peindre · le plus ancien commandé le {dateCourte(liste[0].date_commande)}
          </div>
        )}
        <div className="liste">
          {liste.map((p) => {
            const { marque, modele, cote } = lirePiece(p.piece);
            return (
              <button type="button" className="carte" key={p.id} onClick={() => setFiche(p.id)}>
                <Vignette url={p.image || undefined} chemin={p.photo} taille={72} alt={p.piece || 'Pare-choc'} />
                <div className="corps">
                  <div className="titre">
                    {marque} {modele}
                    {p.quantite > 1 ? ` ×${p.quantite}` : ''}
                  </div>
                  <div className="details">
                    Pare-choc {cote || ''} · commandé le {dateCourte(p.date_commande)}
                  </div>
                  <div className="pastilles">
                    {p.immat && <span className="plaque">{p.immat}</span>}
                    {p.code_peinture ? <span className="pastille p-vert">Code {p.code_peinture}</span> : <span className="pastille p-orange">Code peinture à trouver</span>}
                    <span className="pastille">{p.source === 'shopify' ? p.commande : 'Comptoir'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {!liste.length && (
          <Vide
            titre={vue === 'a_peindre' ? 'Aucun pare-choc à peindre' : 'Aucun pare-choc expédié'}
            texte={vue === 'a_peindre' ? 'Les commandes du site avec l’option peinture arrivent ici toutes seules.' : ''}
          />
        )}
      </main>
      {!lecture && (
        <div className="barre">
          <div className="barre-in">
            <button type="button" className="btn btn-rouge" onClick={() => setNouveau(true)}>
              + Peinture comptoir
            </button>
          </div>
        </div>
      )}
      {ouverte && <FichePeinture p={ouverte} lecture={lecture} onFermer={() => setFiche(null)} />}
      {nouveau && <NouvellePeinture onFermer={() => setNouveau(false)} />}
    </>
  );
}

function FichePeinture({ p, lecture, onFermer }) {
  const d = useDonnees();
  const [code, setCode] = useState(p.code_peinture || '');
  const [note, setNote] = useState(p.note || '');
  const [grande, setGrande] = useState(false);
  const { marque, modele, cote } = lirePiece(p.piece);
  const image = p.image || p.photo;
  const change = code !== (p.code_peinture || '') || note !== (p.note || '');

  const garder = async (extra = {}) => {
    await d.majPeinture(p.id, { code_peinture: code.trim() || null, note: note.trim() || null, ...extra });
  };

  return (
    <Feuille
      titre={`${marque} ${modele}`.trim() || 'Pare-choc à peindre'}
      onFermer={onFermer}
      pied={
        lecture ? null : p.statut === 'a_peindre' ? (
          <div className={change ? 'deux' : ''}>
            {change && (
              <button type="button" className="btn" onClick={() => garder()}>
                Enregistrer
              </button>
            )}
            <button
              type="button"
              className="btn btn-rouge btn-plein"
              onClick={async () => {
                await garder({ statut: 'expedie', expedie_le: new Date().toISOString() });
                onFermer();
              }}
            >
              Marquer expédié
            </button>
          </div>
        ) : (
          <div className={change ? 'deux' : ''}>
            {change && (
              <button type="button" className="btn btn-rouge" onClick={() => garder()}>
                Enregistrer
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await garder({ statut: 'a_peindre', expedie_le: null });
                onFermer();
              }}
            >
              Remettre « à peindre »
            </button>
          </div>
        )
      }
    >
      {image && (
        <button type="button" className="galerie-grande" onClick={() => setGrande(true)} aria-label="Agrandir la photo">
          <img src={p.image || srcPhoto(p.photo)} alt={p.piece || 'Pare-choc'} />
        </button>
      )}
      {grande && <PhotoGrande url={p.image || undefined} chemin={p.photo} onFermer={() => setGrande(false)} />}

      <div className="bloc">
        <div className="deux">
          <Info l="Marque" v={marque} />
          <Info l="Modèle" v={modele} />
          <Info l="Côté" v={cote ? `Pare-choc ${cote}` : ''} />
          <Info l="Quantité" v={p.quantite || 1} />
          <Info l="Commandé le" v={new Date(p.date_commande).toLocaleDateString('fr-FR')} />
          <Info l="Commande" v={p.source === 'shopify' ? p.commande : 'Comptoir'} />
        </div>
        <Info l="Pièce" v={p.piece} />
        {p.statut === 'expedie' && p.expedie_le && <div className="aide">Expédié le {new Date(p.expedie_le).toLocaleDateString('fr-FR')}</div>}
        {p.lien && (
          <a className="lien-pdf" href={p.lien} target="_blank" rel="noreferrer">
            Voir la fiche sur le site ›
          </a>
        )}
      </div>

      <div className="bloc">
        <div className="lab">Immatriculation</div>
        <div>
          <span className="plaque grande">{p.immat || '—'}</span>
        </div>
      </div>

      {lecture ? (
        <div className="bloc">
          <Info l="Code peinture" v={p.code_peinture} />
          {p.note && <Info l="Note" v={p.note} />}
        </div>
      ) : (
        <>
          <Champ label="Code peinture">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" placeholder="Ex. KTV, 040, LC9X…" />
          </Champ>
          <Champ label="Note (teinte, vernis, remarque…)">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Champ>
        </>
      )}
      {!lecture && d.profil?.role === 'admin' && p.source === 'comptoir' && (
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!window.confirm('Supprimer cette peinture comptoir ?')) return;
            await d.supprimerPeinture(p.id);
            onFermer();
          }}
        >
          Supprimer
        </button>
      )}
    </Feuille>
  );
}

function NouvellePeinture({ onFermer }) {
  const d = useDonnees();
  const [x, setX] = useState({ piece: '', immat: '', code_peinture: '', note: '', quantite: 1, date_commande: new Date().toISOString().slice(0, 10) });
  const [photo, setPhoto] = useState(null);
  const [erreur, setErreur] = useState('');
  const maj = (k) => (e) => setX((y) => ({ ...y, [k]: e.target.value }));

  async function enregistrer() {
    if (!x.piece.trim()) return setErreur('Indique le pare-choc (marque, modèle, avant ou arrière).');
    await d.ajouterPeinture(
      {
        piece: x.piece.trim(),
        immat: x.immat.trim().toUpperCase() || null,
        code_peinture: x.code_peinture.trim().toUpperCase() || null,
        note: x.note.trim() || null,
        quantite: Number(x.quantite) || 1,
        date_commande: new Date(`${x.date_commande}T12:00:00`).toISOString(),
        photo: photo?.chemin || null
      },
      photo ? [photo.op] : []
    );
    onFermer();
  }

  return (
    <Feuille
      titre="Peinture comptoir"
      onFermer={onFermer}
      pied={
        <>
          {erreur && <div className="bandeau erreur">{erreur}</div>}
          <button type="button" className="btn btn-rouge btn-plein" onClick={enregistrer}>
            Ajouter à peindre
          </button>
        </>
      }
    >
      {photo ? (
        <div className="avec-x" style={{ justifySelf: 'start' }}>
          <Vignette chemin={photo.chemin} taille={110} alt="Photo du pare-choc" />
          <button type="button" className="retirer" aria-label="Retirer la photo" onClick={() => setPhoto(null)}>
            ×
          </button>
        </div>
      ) : (
        <BoutonPhoto grand libelle="Photo du pare-choc" onPhoto={setPhoto} />
      )}
      <Champ label="Pare-choc">
        <input value={x.piece} onChange={maj('piece')} placeholder="Ex. Pare-choc avant Peugeot 208 II" />
      </Champ>
      <div className="deux">
        <Champ label="Immatriculation">
          <input value={x.immat} onChange={maj('immat')} autoCapitalize="characters" autoCorrect="off" placeholder="AB-123-CD" />
        </Champ>
        <Champ label="Code peinture">
          <input value={x.code_peinture} onChange={maj('code_peinture')} autoCapitalize="characters" autoCorrect="off" />
        </Champ>
        <Champ label="Date de commande">
          <input type="date" value={x.date_commande} onChange={maj('date_commande')} />
        </Champ>
        <Champ label="Quantité">
          <input type="number" min="1" inputMode="numeric" value={x.quantite} onChange={maj('quantite')} />
        </Champ>
      </div>
      <Champ label="Note">
        <textarea value={x.note} onChange={maj('note')} rows={2} />
      </Champ>
    </Feuille>
  );
}

function Info({ l, v }) {
  return (
    <div>
      <div className="lab">{l}</div>
      <div className="val">{v || '—'}</div>
    </div>
  );
}
