import { useMemo, useState } from 'react';
import { srcPhoto, useDonnees } from '../lib/donnees.jsx';
import { libelleCote, nombre } from '../lib/outils.js';
import { BarreFiltres, Champ, Feuille, Segments, Vide, useFiltres } from '../composants/ui.jsx';
import FichePhare, { CartePhare } from './FichePhare.jsx';

export default function Base({ mode }) {
  const d = useDonnees();
  const admin = d.profil?.role === 'admin';
  // Base Chine = seulement les phares à acheter en Chine (pas les phares du site)
  // Base Chine = la 1re liste ; Base 2 = la nouvelle liste (hors phares déjà transférés en commande)
  const phares = useMemo(() => {
    if (mode === 'non_compatibles') return d.phares.filter((p) => p.non_compatible);
    if (mode === 'base2') return d.phares.filter((p) => p.base2 && !p.en_commande);
    if (mode === 'commande') return d.phares.filter((p) => p.base2 && p.en_commande);
    return d.phares.filter((p) => p.chine !== false && !p.base2);
  }, [d.phares, mode]);
  const cochable = admin && ['base', 'base2', 'commande'].includes(mode);
  const filtre = useFiltres(phares);
  const [fiche, setFiche] = useState(null);
  const [coller, setColler] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [limite, setLimite] = useState(80);
  const [partage, setPartage] = useState('');

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
        {mode === 'commande' ? (
          <>
          {phares.length > 0 && (
            <button type="button" className="btn btn-plein" style={{ marginBottom: 10 }} onClick={() => partagerListe(phares, setPartage)} disabled={!!partage}>
              {partage || 'Envoyer la liste (WeChat, WhatsApp…)'}
            </button>
          )}
          <h2 className="groupe">
            {phares.reduce((n, x) => n + (Number(x.quantite) || 1), 0)} phare
            {phares.reduce((n, x) => n + (Number(x.quantite) || 1), 0) > 1 ? 's' : ''} à commander ({phares.length} référence{phares.length > 1 ? 's' : ''})
          </h2>
          </>
        ) : (
          <h2 className="groupe">
            {filtre.filtres.length} phare{filtre.filtres.length > 1 ? 's' : ''}
          </h2>
        )}
        <div className="liste">
          {visibles.map((p) => (
            <CartePhare
              key={p.id}
              phare={p}
              onOuvrir={(x) => setFiche({ phare: x })}
              selection={cochable ? selection : null}
              onSelection={cochable ? basculer : null}
              extra={mode === 'commande' ? <Quantite phare={p} modifiable={admin} /> : null}
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
            titre={
              phares.length
                ? 'Aucun phare avec ces filtres'
                : mode === 'non_compatibles'
                ? 'Aucun phare non compatible'
                : mode === 'commande'
                ? 'Aucun phare en commande'
                : 'La base est vide'
            }
            texte={
              admin && !phares.length
                ? mode === 'commande'
                  ? 'Dans Base 2, coche les phares à commander puis appuie sur « Transférer dans Commande phare ».'
                  : 'Ajoute tes phares un par un, ou colle une liste depuis ChatGPT ou Excel.'
                : ''
            }
          />
        )}
      </main>
      {admin && (
        <div className="barre">
          <div className="barre-in">
            {selection.size > 0 ? (
              <div className="deux">
                {mode === 'base2' ? (
                  <button
                    type="button"
                    className="btn btn-rouge"
                    onClick={async () => {
                      await d.majPhares([...selection], { en_commande: true });
                      setSelection(new Set());
                    }}
                  >
                    Transférer dans Commande phare ({selection.size})
                  </button>
                ) : mode === 'commande' ? (
                  <button
                    type="button"
                    className="btn btn-rouge"
                    onClick={async () => {
                      await d.majPhares([...selection], { en_commande: false });
                      setSelection(new Set());
                    }}
                  >
                    Remettre dans Base 2 ({selection.size})
                  </button>
                ) : (
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
                )}
                <button type="button" className="btn" onClick={() => setSelection(new Set())}>
                  Annuler
                </button>
              </div>
            ) : mode === 'commande' ? (
              <div className="details" style={{ textAlign: 'center' }}>
                Coche un phare pour le remettre dans Base 2.
              </div>
            ) : (
              <div className="deux">
                <button
                  type="button"
                  className="btn btn-rouge"
                  onClick={() => setFiche({ initial: mode === 'non_compatibles' ? { non_compatible: true } : mode === 'base2' ? { base2: true, chine: true } : {} })}
                >
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
      {coller && <CollerListe onFermer={() => setColler(false)} nonCompatible={mode === 'non_compatibles'} base2={mode === 'base2'} />}
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

function CollerListe({ onFermer, nonCompatible, base2 }) {
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
          ...(base2 ? { base2: true, chine: true } : {}),
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

// Quantité à commander : sélecteur − / + pour l'admin, simple affichage pour les autres
function Quantite({ phare, modifiable }) {
  const d = useDonnees();
  const q = Math.max(1, Number(phare.quantite) || 1);
  if (!modifiable) return <div className="quantite-lecture">Quantité : <strong>{q}</strong></div>;
  const changer = (n) => d.majPhares([phare.id], { quantite: Math.max(1, Math.min(999, n)) });
  return (
    <div className="quantite" role="group" aria-label={`Quantité de ${phare.marque} ${phare.modele || ''}`}>
      <span className="lab">Quantité</span>
      <button type="button" aria-label="Enlever un" disabled={q <= 1} onClick={() => changer(q - 1)}>
        −
      </button>
      <input
        inputMode="numeric"
        value={q}
        aria-label="Quantité"
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          if (n) changer(n);
        }}
      />
      <button type="button" aria-label="Ajouter un" onClick={() => changer(q + 1)}>
        +
      </button>
    </div>
  );
}

// Liste pour le fournisseur : photo principale + texte (modèle, côté, réf., quantité). Ni prix, ni liens Google.
export function texteListe(phares) {
  const lignes = [`France Bumper — commande phares — ${new Date().toLocaleDateString('fr-FR')}`, ''];
  phares.forEach((p, i) => {
    const titre = [p.marque, p.modele].filter(Boolean).join(' ');
    const details = [p.annees, libelleCote(p.cote), p.type_eclairage].filter(Boolean).join(' · ');
    lignes.push(`${i + 1}. ${titre}`, `   ${details}`, `   Réf. ${p.ref_oe || '—'} — Quantité : ${Math.max(1, Number(p.quantite) || 1)}`, '');
  });
  return lignes.join('\n').trim();
}

async function partagerListe(phares, setEtat) {
  const texte = texteListe(phares);
  setEtat('Préparation des photos…');
  const fichiers = [];
  for (const [i, p] of phares.entries()) {
    const chemin = p.photos?.[0] || p.photos_fiche?.[0];
    if (!chemin) continue;
    try {
      const b = await (await fetch(srcPhoto(chemin))).blob();
      fichiers.push(new File([b], `${i + 1}-${p.marque}-${p.ref_oe || ''}.jpg`.replace(/[^\w.-]+/g, '-'), { type: 'image/jpeg' }));
    } catch {
      /* photo indisponible */
    }
  }
  setEtat('');
  try {
    if (fichiers.length && navigator.canShare?.({ files: fichiers })) return await navigator.share({ files: fichiers, text: texte });
    if (navigator.share) return await navigator.share({ text: texte });
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(texte);
    window.alert('Liste copiée : colle-la dans WeChat.');
  } catch {
    window.prompt('Copie cette liste :', texte);
  }
}
