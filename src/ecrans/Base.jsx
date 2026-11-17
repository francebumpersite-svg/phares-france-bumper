import { useMemo, useState } from 'react';
import { srcPhoto, useDonnees } from '../lib/donnees.jsx';
import { libelleCote, nombre } from '../lib/outils.js';
import { BarreFiltres, Champ, Feuille, Interrupteur, Segments, Vide, useFiltres } from '../composants/ui.jsx';
import FichePhare, { CartePhare } from './FichePhare.jsx';

// Range les phares par marque, modèle, années et éclairage, puis le gauche juste avant le droit du même modèle.
// Si un même modèle est présent plusieurs fois, on garde les paires : gauche, droit, gauche, droit…
const rangCote = (c) => (/gauche|conducteur/i.test(c || '') ? 0 : /droit|passager/i.test(c || '') ? 1 : 2);
const cmpTexte = (a, b) => (a || '').localeCompare(b || '', 'fr', { numeric: true, sensitivity: 'base' });
export function trierParModele(liste) {
  const cleModele = (p) => [p.marque, p.modele, p.annees, p.type_eclairage].map((x) => (x || '').trim().toLowerCase()).join('|');
  // Rang d'apparition de chaque phare parmi ceux du même modèle et du même côté (ordre d'ajout)
  const parAjout = [...liste].sort((a, b) => cmpTexte(a.created_at, b.created_at) || cmpTexte(String(a.id), String(b.id)));
  const compteur = new Map();
  const rang = new Map();
  for (const p of parAjout) {
    const k = `${cleModele(p)}#${rangCote(p.cote)}`;
    const n = compteur.get(k) || 0;
    rang.set(p.id, n);
    compteur.set(k, n + 1);
  }
  return [...liste].sort(
    (a, b) =>
      cmpTexte(a.marque, b.marque) ||
      cmpTexte(a.modele, b.modele) ||
      cmpTexte(a.annees, b.annees) ||
      cmpTexte(a.type_eclairage, b.type_eclairage) ||
      rang.get(a.id) - rang.get(b.id) ||
      rangCote(a.cote) - rangCote(b.cote)
  );
}

export default function Base({ mode }) {
  const d = useDonnees();
  // L'admin gère tout ; le collègue en Chine gère Base Chine, Base 2 et Commande phare
  const admin = d.profil?.role === 'admin' || (d.profil?.role === 'chine' && mode !== 'non_compatibles');
  // Base Chine = seulement les phares à acheter en Chine (pas les phares du site)
  // Base Chine = la 1re liste ; Base 2 = la nouvelle liste (hors phares déjà transférés en commande)
  const phares = useMemo(() => {
    let l;
    if (mode === 'non_compatibles') l = d.phares.filter((p) => p.non_compatible);
    // Base 2 garde toujours tous ses phares, même ceux transférés dans Commande phare
    else if (mode === 'base2') l = d.phares.filter((p) => p.base2);
    // Commande phare : phares transférés depuis Base 2 ou depuis Base Chine (jamais ceux du site)
    else if (mode === 'commande') l = d.phares.filter((p) => p.en_commande && (p.base2 || p.chine !== false));
    else l = d.phares.filter((p) => p.chine !== false && !p.base2);
    return trierParModele(l);
  }, [d.phares, mode]);
  const cochable = admin && ['base', 'base2', 'commande'].includes(mode);
  const filtre = useFiltres(phares);
  const [fiche, setFiche] = useState(null);
  const [coller, setColler] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [limite, setLimite] = useState(80);
  const [partage, setPartage] = useState('');
  const [avecRef, setAvecRef] = useState(true);

  const basculer = (id) =>
    setSelection((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const visibles = filtre.filtres.slice(0, limite);
  // Envoi : les phares cochés s'il y en a, sinon toute la liste affichée
  const aEnvoyer = selection.size ? filtre.filtres.filter((p) => selection.has(p.id)) : filtre.filtres;

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
            <div className="ligne-r" style={{ marginBottom: 8 }}>
              <span>
                Mettre les références dans la liste
                <small>{avecRef ? 'Les références partent avec la liste et le PDF' : 'Liste et PDF envoyés sans aucune référence'}</small>
              </span>
              <Interrupteur actif={avecRef} label="Mettre les références dans la liste envoyée" onChange={setAvecRef} />
            </div>
          )}
          {phares.length > 0 && (
            <div className="deux" style={{ marginBottom: 10 }}>
              <button type="button" className="btn" onClick={() => partagerListe(aEnvoyer, setPartage, avecRef)} disabled={!!partage}>
                {partage || (selection.size ? `Envoyer la sélection (${aEnvoyer.length})` : 'Envoyer toute la liste')}
              </button>
              <button type="button" className="btn btn-noir" onClick={() => listePdf(aEnvoyer, setPartage, avecRef)} disabled={!!partage}>
                {selection.size ? `PDF de la sélection (${aEnvoyer.length})` : 'Toute la liste en PDF'}
              </button>
            </div>
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
        {cochable && filtre.filtres.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-4px 0 8px' }}>
            {filtre.filtres.every((p) => selection.has(p.id)) ? (
              <button type="button" className="petit-bouton neutre" onClick={() => setSelection(new Set())}>
                Tout désélectionner
              </button>
            ) : (
              <button type="button" className="petit-bouton neutre" onClick={() => setSelection(new Set(filtre.filtres.map((p) => p.id)))}>
                Tout sélectionner ({filtre.filtres.length})
              </button>
            )}
          </div>
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
                  ? 'Dans Base 2 ou Base Chine, coche les phares à commander puis appuie sur « Transférer dans Commande phare ».'
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
                {mode === 'base2' || mode === 'base' ? (
                  <button
                    type="button"
                    className="btn btn-rouge"
                    onClick={async () => {
                      // La quantité se règle ensuite dans Commande phare : on part de 1
                      const nouveaux = phares.filter((p) => selection.has(p.id) && !p.en_commande).map((p) => p.id);
                      if (nouveaux.length) await d.majPhares(nouveaux, { en_commande: true, quantite: 1 });
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
                      await d.majPhares([...selection], { en_commande: false, quantite: 1 });
                      setSelection(new Set());
                    }}
                  >
                    Retirer de la commande ({selection.size})
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
                {mode !== 'commande' && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ gridColumn: '1 / -1' }}
                  onClick={async () => {
                    const n = selection.size;
                    if (!window.confirm(`Supprimer définitivement ${n} phare${n > 1 ? 's' : ''} ? Les photos et les infos de ${n > 1 ? 'ces phares' : 'ce phare'} seront effacées.`)) return;
                    await d.supprimerPhares([...selection]);
                    setSelection(new Set());
                  }}
                >
                  Supprimer ({selection.size})
                </button>
                )}
              </div>
            ) : mode === 'commande' ? (
              <div className="details" style={{ textAlign: 'center' }}>
                Coche un phare pour le retirer de la commande (il reste dans Base 2).
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
  const sansPrive = d.profil?.role !== 'admin';
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
          !sansPrive && (o.ref_fournisseur || o.prix_achat || o.fournisseur)
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

// Liste pour le fournisseur : toutes les photos + texte (modèle, côté, réf., quantité). Ni prix, ni liens Google.
export function texteListe(phares, avecRef = true) {
  const lignes = [`France Bumper — commande phares — ${new Date().toLocaleDateString('fr-FR')}`, ''];
  phares.forEach((p, i) => {
    const titre = [p.marque, p.modele].filter(Boolean).join(' ');
    const details = [p.annees, libelleCote(p.cote), p.type_eclairage].filter(Boolean).join(' · ');
    const qte = `Quantité : ${Math.max(1, Number(p.quantite) || 1)}`;
    lignes.push(`${i + 1}. ${titre}`, `   ${details}`, avecRef ? `   Réf. ${p.ref_oe || '—'} — ${qte}` : `   ${qte}`, '');
  });
  return lignes.join('\n').trim();
}

async function partagerListe(phares, setEtat, avecRef = true) {
  const texte = texteListe(phares, avecRef);
  setEtat('Préparation des photos…');
  const fichiers = [];
  // Toutes les photos de chaque phare (face, arrière, fiche…), numérotées 1a, 1b, 1c…
  for (const [i, p] of phares.entries()) {
    const chemins = [...(p.photos || []), ...(p.photos_fiche || [])];
    for (const [j, chemin] of chemins.entries()) {
      setEtat(`Préparation des photos… phare ${i + 1} / ${phares.length}`);
      try {
        const b = await (await fetch(srcPhoto(chemin))).blob();
        const lettre = chemins.length > 1 ? String.fromCharCode(97 + (j % 26)) : '';
        const nomPhoto = avecRef ? `${i + 1}${lettre}-${p.marque}-${p.ref_oe || ''}.jpg` : `${i + 1}${lettre}-${p.marque}.jpg`;
        fichiers.push(new File([b], nomPhoto.replace(/[^\w.-]+/g, '-'), { type: 'image/jpeg' }));
      } catch {
        /* photo indisponible */
      }
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
    window.alert('Liste copiée.\n\nOuvre WeChat, va dans la discussion du fournisseur et colle (⌘ + V sur Mac, appui long › Coller sur téléphone).');
  } catch {
    window.prompt('Copie cette liste :', texte);
  }
}

// PDF de la commande pour le fournisseur : photo + modèle, années, côté, techno, réf., quantité. Ni prix, ni liens.
// Charge une photo pour le PDF : essaie la copie en mémoire, puis le réseau, puis une simple balise image
async function chargerImage(url) {
  for (const u of [url, url + (url.includes('?') ? '&' : '?') + 'pdf=' + Date.now()]) {
    try {
      const r = await fetch(u, { cache: u === url ? 'default' : 'no-store' });
      if (!r.ok) continue;
      const b = await r.blob();
      if (!b.size) continue;
      return await createImageBitmap(b);
    } catch {
      /* on essaie autrement */
    }
  }
  return await new Promise((ok, ko) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => ok(i);
    i.onerror = () => ko(new Error('photo illisible'));
    i.src = url + (url.includes('?') ? '&' : '?') + 'img=' + Date.now();
  });
}

async function imageEnDataUrl(chemin) {
  const bitmap = await chargerImage(srcPhoto(chemin));
  const max = 700;
  const largeurImg = bitmap.width || bitmap.naturalWidth;
  const hauteurImg = bitmap.height || bitmap.naturalHeight;
  const k = Math.min(1, max / Math.max(largeurImg, hauteurImg));
  const c = document.createElement('canvas');
  c.width = Math.round(largeurImg * k);
  c.height = Math.round(hauteurImg * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
}

async function listePdf(phares, setEtat, avecRef = true) {
  try {
    setEtat('Création du PDF…');
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const L = 210;
    const H = 297;
    const marge = 12;
    const date = new Date().toLocaleDateString('fr-FR');
    const total = phares.reduce((n, p) => n + Math.max(1, Number(p.quantite) || 1), 0);
    const entete = (page) => {
      doc.setFillColor(17, 17, 17);
      doc.rect(0, 0, L, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(224, 58, 58);
      doc.text('FRANCE', marge, 12);
      doc.setTextColor(255, 255, 255);
      doc.text('BUMPER', marge + doc.getTextWidth('FRANCE ') + 1, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Commande phares — ${date} — page ${page}`, L - marge, 12, { align: 'right' });
    };
    let page = 1;
    entete(page);
    doc.setTextColor(17, 17, 17);
    doc.setFontSize(11);
    doc.text(`${total} phare${total > 1 ? 's' : ''} à commander (${phares.length} modèle${phares.length > 1 ? 's' : ''})`, marge, 27);
    let y = 32;
    const cote = 42; // taille d'une photo
    const parLigne = 4; // photos par ligne
    for (const [i, p] of phares.entries()) {
      setEtat(`Création du PDF… ${i + 1} / ${phares.length}`);
      const chemins = [...(p.photos || []), ...(p.photos_fiche || [])];
      const nbLignes = Math.max(1, Math.ceil(chemins.length / parLigne));
      const hBloc = 26 + nbLignes * (cote + 6) + 4;
      if (y + hBloc > H - 10) {
        doc.addPage();
        page += 1;
        entete(page);
        y = 24;
      }
      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(marge, y, L - 2 * marge, hBloc - 4, 2, 2, 'S');
      const x = marge + 4;
      const largeur = L - 2 * marge - 8;
      // En-tête du bloc : modèle, détails, réf. et quantité
      doc.setTextColor(17, 17, 17);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(doc.splitTextToSize(`${i + 1}. ${[p.marque, p.modele].filter(Boolean).join(' ')}`, largeur - 40)[0], x, y + 7);
      doc.setTextColor(201, 42, 42);
      doc.text(`Quantité : ${Math.max(1, Number(p.quantite) || 1)}`, L - marge - 4, y + 7, { align: 'right' });
      doc.setTextColor(17, 17, 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const details = [p.annees ? `Années : ${p.annees}` : null, `Côté : ${libelleCote(p.cote)}`, p.type_eclairage ? `Technologie : ${p.type_eclairage}` : null]
        .filter(Boolean)
        .join('   ·   ');
      doc.text(doc.splitTextToSize(details, largeur)[0], x, y + 13);
      if (avecRef) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Réf. ${p.ref_oe || '—'}`, x, y + 19);
      }
      // Toutes les photos du phare, avec leur légende (face, arrière, fiche…)
      const yPhotos = y + 23;
      if (!chemins.length) {
        doc.setFillColor(245, 245, 245);
        doc.rect(x, yPhotos, cote, cote, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('Pas de photo', x + cote / 2, yPhotos + cote / 2, { align: 'center' });
      }
      for (const [j, chemin] of chemins.entries()) {
        const px = x + (j % parLigne) * (cote + 4);
        const py = yPhotos + Math.floor(j / parLigne) * (cote + 6);
        try {
          const im = await imageEnDataUrl(chemin);
          const k = Math.min(cote / im.w, cote / im.h);
          const w = im.w * k;
          const h = im.h * k;
          doc.addImage(im.data, 'JPEG', px + (cote - w) / 2, py + (cote - h) / 2, w, h);
        } catch {
          doc.setFillColor(245, 245, 245);
          doc.rect(px, py, cote, cote, 'F');
        }
        const legende = p.photos_legendes?.[chemin];
        if (legende) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(90, 90, 90);
          doc.text(doc.splitTextToSize(legende, cote)[0], px + cote / 2, py + cote + 3.5, { align: 'center' });
        }
      }
      y += hBloc;
    }
    const blob = doc.output('blob');
    const nom = `France-Bumper-commande-phares-${date.replace(/\//g, '-')}.pdf`;
    const fichier = new File([blob], nom, { type: 'application/pdf' });
    setEtat('');
    try {
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: nom });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setTimeout(() => window.alert(`PDF enregistré dans tes Téléchargements (« ${nom} »).\n\nPour l'envoyer par WeChat : ouvre WeChat sur l'ordinateur, ouvre la discussion du fournisseur et glisse le fichier dedans.`), 400);
  } catch (e) {
    setEtat('');
    window.alert(`Le PDF n'a pas pu être créé : ${e.message || e}`);
  }
}
