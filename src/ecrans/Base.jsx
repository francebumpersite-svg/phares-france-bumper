import { useMemo, useState } from 'react';
import { useDonnees } from '../lib/donnees.jsx';
import { nombre } from '../lib/outils.js';
import { BarreFiltres, Champ, Feuille, Segments, Vide, useFiltres } from '../composants/ui.jsx';
import FichePhare, { CartePhare } from './FichePhare.jsx';

export default function Base({ mode }) {
  const d = useDonnees();
  const admin = d.profil?.role === 'admin';
  const phares = useMemo(() => (mode === 'non_compatibles' ? d.phares.filter((p) => p.non_compatible) : d.phares), [d.phares, mode]);
  const filtre = useFiltres(phares);
  const [fiche, setFiche] = useState(null);
  const [coller, setColler] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [limite, setLimite] = useState(80);

  const basculer = (id) =>
    setSelection((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const visibles = filtre.filtres.slice(0, limite);

  return (
    <>
      <BarreFiltres {...filtre} />
      <main>
        {mode === 'non_compatibles' && (
          <div className="bandeau">Phares qui ne vont pas sur le véhicule annoncé, ou à ne plus commander. Note la raison dans chaque fiche.</div>
        )}
        <h2 className="groupe">
          {filtre.filtres.length} phare{filtre.filtres.length > 1 ? 's' : ''}
        </h2>
        <div className="liste">
          {visibles.map((p) => (
            <CartePhare
              key={p.id}
              phare={p}
              onOuvrir={(x) => setFiche({ phare: x })}
              selection={admin && mode === 'base' ? selection : null}
              onSelection={admin && mode === 'base' ? basculer : null}
            />
          ))}
        </div>
        {filtre.filtres.length > limite && (
          <button type="button" className="btn btn-plein" style={{ marginTop: 12 }} onClick={() => setLimite((l) => l + 100)}>
            Voir plus ({filtre.filtres.length - limite} restants)
          </button>
        )}
        {!filtre.filtres.length && (
          <Vide
            titre={phares.length ? 'Aucun phare avec ces filtres' : mode === 'non_compatibles' ? 'Aucun phare non compatible' : 'La base est vide'}
            texte={admin && !phares.length ? 'Ajoute tes phares un par un, ou colle une liste depuis ChatGPT ou Excel.' : ''}
          />
        )}
      </main>
      {admin && (
        <div className="barre">
          <div className="barre-in">
            {selection.size > 0 ? (
              <div className="deux">
                <button
                  type="button"
                  className="btn btn-rouge"
                  onClick={async () => {
                    await d.majPhares([...selection], { statut: 'a_commander' });
                    setSelection(new Set());
                  }}
                >
                  À commander ({selection.size})
                </button>
                <button type="button" className="btn" onClick={() => setSelection(new Set())}>
                  Annuler
                </button>
              </div>
            ) : (
              <div className="deux">
                <button type="button" className="btn btn-rouge" onClick={() => setFiche({ initial: mode === 'non_compatibles' ? { non_compatible: true } : {} })}>
                  + Ajouter un phare
                </button>
                <button type="button" className="btn" onClick={() => setColler(true)}>
                  Coller une liste
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {fiche && <FichePhare phare={fiche.phare} initial={fiche.initial} onFermer={() => setFiche(null)} />}
      {coller && <CollerListe onFermer={() => setColler(false)} nonCompatible={mode === 'non_compatibles'} />}
    </>
  );
}

const COLONNES = ['marque', 'modele', 'annees', 'cote', 'ref_oe', 'ref_fournisseur', 'prix_achat', 'fournisseur'];

function lireCote(v) {
  const t = String(v || '').toLowerCase();
  if (/^g|gauche|left|conducteur/.test(t)) return 'gauche';
  if (/^d|droit|right|passager/.test(t)) return 'droit';
  if (/paire|pair|g\s*\+\s*d/.test(t)) return 'paire';
  return null;
}

function analyser(texte) {
  const lignes = texte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const res = [];
  for (const l of lignes) {
    const sep = l.includes('\t') ? '\t' : l.includes(';') ? ';' : l.includes('|') ? '|' : ',';
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
    if (/^marque$/i.test(c[0])) continue; // ligne de titres
    const o = Object.fromEntries(COLONNES.map((k, i) => [k, c[i] || '']));
    if (!o.marque) continue;
    res.push(o);
  }
  return res;
}

function CollerListe({ onFermer, nonCompatible }) {
  const d = useDonnees();
  const [texte, setTexte] = useState('');
  const [statut, setStatut] = useState('base');
  const lignes = useMemo(() => analyser(texte), [texte]);

  async function importer() {
    await d.importerPhares(
      lignes.map((o) => ({
        phare: {
          marque: o.marque,
          modele: o.modele || null,
          annees: o.annees || null,
          cote: lireCote(o.cote),
          ref_oe: o.ref_oe || null,
          statut,
          quantite: 1,
          non_compatible: !!nonCompatible,
          photos: [],
          photos_fiche: [],
          position: 'avant'
        },
        prive:
          o.ref_fournisseur || o.prix_achat || o.fournisseur
            ? { ref_fournisseur: o.ref_fournisseur || null, prix_achat: nombre(o.prix_achat), fournisseur: o.fournisseur || null }
            : null
      }))
    );
    onFermer();
  }

  return (
    <Feuille
      titre="Coller une liste"
      onFermer={onFermer}
      pied={
        <button type="button" className="btn btn-rouge btn-plein" disabled={!lignes.length} onClick={importer}>
          Ajouter {lignes.length} phare{lignes.length > 1 ? 's' : ''}
        </button>
      }
    >
      <div className="bandeau">
        Une ligne par phare, colonnes séparées par point-virgule ou tabulation, dans cet ordre :
        <br />
        <strong>marque ; modèle ; années ; côté ; réf. OE ; réf. fournisseur ; prix d'achat ; fournisseur</strong>
        <br />
        Seule la marque est obligatoire. Tu peux demander à ChatGPT de te sortir la liste dans ce format.
      </div>
      <Champ label="Liste">
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={8} placeholder={'Peugeot;208 II;2019-2023;gauche;9823XXXXXX;;85;\nRenault;Clio V;2019-2023;droit;260108XXXX;;;'} />
      </Champ>
      <Champ label="Ajouter comme">
        <Segments valeur={statut} onChange={setStatut} options={[['base', 'Base seulement'], ['a_commander', 'À commander']]} />
      </Champ>
      {lignes.length > 0 && (
        <div className="details">
          Aperçu : {lignes.slice(0, 5).map((o) => `${o.marque} ${o.modele}`.trim()).join(', ')}
          {lignes.length > 5 ? '…' : ''}
        </div>
      )}
    </Feuille>
  );
}
