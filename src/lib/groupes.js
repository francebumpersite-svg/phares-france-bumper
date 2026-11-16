// Regroupe les phares vendus sous des fiches produit différentes mais qui sont le même modèle.
// Clé = position + côté + marque/modèle/code + phase + techno, en ignorant : dates, références,
// numéros de stock, « occasion / neuf / d'origine »…

const MOIS = 'janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre';
const VIDES = new Set(
  (
    'phare phares optique optiques avant av arriere ar droit droite gauche avd avg ard arg occasion origine origines ' +
    'd de du des la le les l et a au aux partir pour neuf neuve piece pieces ref reference complet complete oem original originale ' +
    'avec sans modele version vehicule voiture jusqu en ou qualite tres bon etat cote conducteur passager ' +
    'classe full led leds xenon bi bixenon matrix laser halogene halogenes directionnel directionnelle adaptatif adaptative ' +
    'ils high performance h7 h4 h1 phase ph lci fond noir chrome anti brouillard antibrouillard 100 ' + MOIS
  ).split(' ')
);
const MARQUES = { vw: 'volkswagen', mercedesbenz: 'mercedes', 'mercedes-benz': 'mercedes', citroen: 'citroen', bmw: 'bmw' };

const sansAccents = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function analyserTitre(titre) {
  let t = sansAccents(titre).replace(/[’'`´]/g, ' ');

  const cote = /\b(gauche|avg|arg|conducteur)\b/.test(t) ? 'G' : /\b(droite?|avd|ard|passager)\b/.test(t) ? 'D' : '';
  const position = /anti.?brouillard/.test(t) ? 'antibrouillard' : /\b(arriere|ard|arg)\b/.test(t) ? 'arriere' : 'avant';
  const techno = /matrix/.test(t) ? 'matrix' : /laser/.test(t) ? 'laser' : /\bleds?\b/.test(t) ? 'led' : /xenon/.test(t) ? 'xenon' : /halogene|\bh[147]\b/.test(t) ? 'halogene' : '';
  const ph = t.match(/\b(?:phase|ph)\s*\.?\s*([1-4])\b/) || t.match(/\bph([1-4])\b/);
  const phase = ph ? `ph${ph[1]}` : /\blci\b/.test(t) ? 'ph2' : '';

  // Références après « ref » / « réf. »
  t = t.replace(/\bref(erence)?\s*[:.]?\s*[a-z0-9]+(\s*-\s*[a-z0-9]+)*/g, ' ');
  // Numéro de stock à la fin (« … d'origine 062 », « 7414142-11 »)
  t = t.replace(/(origine|occasion|neuf|neuve|complet)\s+[\d\s/\-]+$/, '$1');
  t = t.replace(/\s0\d{2}(\s*\/\s*\d{2,3})*\s*$/, ' ');
  // Dates et périodes
  t = t.replace(/\(([^)]*)\)/g, (m, dedans) => (/\d{4}|\/|partir|jusqu/.test(dedans) ? ' ' : ` ${dedans} `));
  t = t.replace(/\b(a partir|depuis|jusqu)\s*(de|du|d|en|au|a)?\s*(\d{1,2}\s*\/\s*)?(\w+\s+)?(19|20)\d{2}\b/g, ' ');
  t = t.replace(/\b\d{1,2}\s*\/\s*(19|20)?\d{2}\b/g, ' ');
  t = t.replace(/\b(19|20)\d{2}\s*[-a]\s*(19|20)\d{2}\b/g, ' ');
  t = t.replace(/\bph(ase)?\s*\.?\s*[1-4]\b/g, ' ');
  t = t.replace(/[^a-z0-9]+/g, ' ');

  const mots = [];
  for (let m of t.split(' ')) {
    if (!m || VIDES.has(m)) continue;
    m = MARQUES[m] || m;
    // Références constructeur (au moins 6 caractères dont 4 chiffres)
    if (m.length >= 6 && (m.match(/\d/g) || []).length >= 4) continue;
    if (/^0\d+$/.test(m)) continue;
    mots.push(m);
  }
  const modele = [...new Set(mots)].sort().join(' ');
  const base = [position, cote, modele, phase].join('|');
  return { cote, position, techno, phase, modele, base, cle: `${base}|${techno}` };
}

// Jours entre deux dates
const JOUR = 86400000;

// Regroupe les lignes de ventes par modèle et calcule les chiffres utiles
export function grouperVentes(ventes, maintenant = Date.now()) {
  const groupes = new Map();
  const valides = ventes.filter((v) => !v.annulee && v.quantite > 0);
  const analyses = new Map(valides.map((v) => [v.line_key, analyserTitre(v.titre)]));
  // Fiche sans techno (LED, xénon…) : rattachée au même modèle si une seule techno existe pour lui
  const technos = new Map();
  for (const a of analyses.values()) {
    if (!a.techno) continue;
    if (!technos.has(a.base)) technos.set(a.base, new Set());
    technos.get(a.base).add(a.techno);
  }
  for (const v of valides) {
    let a = analyses.get(v.line_key);
    if (!a.techno && technos.get(a.base)?.size === 1) {
      const techno = [...technos.get(a.base)][0];
      a = { ...a, techno, cle: `${a.base}|${techno}` };
    }
    let g = groupes.get(a.cle);
    if (!g) {
      g = { cle: a.cle, ...a, ventes: [], fiches: new Map(), produits: new Set(), qte: 0, pays: {}, premiere: null, derniere: null, titre: v.titre, image: null, prix: null };
      groupes.set(a.cle, g);
    }
    g.ventes.push(v);
    g.qte += v.quantite;
    if (v.product_id) g.produits.add(v.product_id);
    const f = g.fiches.get(v.titre) || { titre: v.titre, qte: 0 };
    f.qte += v.quantite;
    g.fiches.set(v.titre, f);
    const p = v.pays || '??';
    g.pays[p] = (g.pays[p] || 0) + v.quantite;
    if (!g.premiere || v.date_vente < g.premiere) g.premiere = v.date_vente;
    if (!g.derniere || v.date_vente >= g.derniere) {
      g.derniere = v.date_vente;
      g.titre = v.titre;
      if (v.prix != null) g.prix = Number(v.prix);
      if (v.image) g.image = v.image;
    }
    if (!g.image && v.image) g.image = v.image;
  }
  for (const g of groupes.values()) {
    g.ventes.sort((a, b) => (a.date_vente < b.date_vente ? 1 : -1));
    g.fiches = [...g.fiches.values()].sort((a, b) => b.qte - a.qte);
    const prix = g.ventes.map((v) => Number(v.prix)).filter((n) => n > 0);
    g.prixMin = prix.length ? Math.min(...prix) : null;
    g.prixMax = prix.length ? Math.max(...prix) : null;
    // Rapidité : une vente tous les X jours, depuis la première vente jusqu'à aujourd'hui
    const periode = Math.max(30, (maintenant - new Date(g.premiere).getTime()) / JOUR);
    g.joursParVente = Math.round(periode / g.qte);
    g.qte12mois = g.ventes.filter((v) => maintenant - new Date(v.date_vente).getTime() <= 365 * JOUR).reduce((s, v) => s + v.quantite, 0);
    g.joursDepuisDerniere = Math.round((maintenant - new Date(g.derniere).getTime()) / JOUR);
  }
  return [...groupes.values()];
}

// Un best-seller : vendu au moins 3 fois, au moins une vente tous les 120 jours en moyenne,
// et encore vendu dans l'année
export const estBestSeller = (g) => g.qte >= 3 && g.joursParVente <= 120 && g.joursDepuisDerniere <= 365;
