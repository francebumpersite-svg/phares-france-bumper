export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

export const lienGoogle = (texte) => `https://www.google.com/search?q=${encodeURIComponent(texte)}`;

const fmtEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
export const euro = (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? '—' : fmtEuro.format(Number(n)));

const fmtYuan = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const yuan = (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? '—' : `${fmtYuan.format(Number(n))} ¥`);

export const nombre = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

let nomsPays;
try {
  nomsPays = new Intl.DisplayNames(['fr'], { type: 'region' });
} catch {
  nomsPays = null;
}
export const nomPays = (code) => {
  if (!code || code === '??') return 'Retrait / sans livraison';
  try {
    return nomsPays ? nomsPays.of(code) : code;
  } catch {
    return code;
  }
};

export const dateCourte = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';
export const dateHeure = (d) =>
  d
    ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'jamais';

export const COTES = { gauche: 'Gauche', droit: 'Droit', paire: 'Paire (G + D)' };
export const libelleCote = (c) => COTES[c] || '—';

export const STATUTS_PHARE = {
  base: 'Dans la base',
  a_commander: 'À commander',
  commande: 'Commandé',
  recu: 'Reçu'
};

export const STATUTS_DROP = {
  a_commander: 'À commander',
  commande: 'Commandé',
  expedie: 'Expédié',
  recu: 'Reçu au dépôt',
  livre: 'Livré au client',
  annule: 'Annulé'
};

// Années "2019–2023", "2019-2023", "2020" -> [2019, 2023]
export function plageAnnees(texte) {
  if (!texte) return null;
  const n = String(texte).match(/\d{4}/g);
  if (!n) return null;
  const a = n.map(Number);
  return [Math.min(...a), Math.max(...a)];
}

const MARQUES = [
  'Alfa Romeo', 'Audi', 'BMW', 'Citroën', 'Citroen', 'Dacia', 'DS', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Jeep',
  'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes', 'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Porsche',
  'Renault', 'Seat', 'Skoda', 'Smart', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'VW', 'Volvo', 'Cupra', 'Jaguar'
];

// Devine marque / côté / années à partir d'un titre Shopify
export function devinerDepuisTitre(titre = '') {
  const t = titre.toLowerCase();
  let marque = '';
  let modele = '';
  for (const m of MARQUES) {
    const i = t.indexOf(m.toLowerCase());
    if (i >= 0) {
      marque = m === 'Citroen' ? 'Citroën' : m === 'VW' ? 'Volkswagen' : m;
      const apres = titre.slice(i + m.length).trim().split(/\s+/);
      modele = apres.filter((x) => !/^\(|^\d{4}|gauche|droit|avant|arri/i.test(x)).slice(0, 2).join(' ');
      break;
    }
  }
  const cote = /gauche|conducteur/.test(t) ? 'gauche' : /droit|passager/.test(t) ? 'droit' : null;
  const annees = (titre.match(/\d{4}\s*[-–à]\s*\d{4}|\d{4}/) || [''])[0].replace(/\s*[-à]\s*/, '–');
  const type_eclairage = /led/.test(t) ? 'LED' : /x[ée]non/.test(t) ? 'Xénon' : /halog/.test(t) ? 'Halogène' : null;
  return { marque, modele, cote, annees, type_eclairage };
}

// Réduit une photo avant envoi (max 1280 px, JPEG)
export async function compresserPhoto(fichier, max = 1280, qualite = 0.8) {
  try {
    const bitmap = await createImageBitmap(fichier);
    const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', qualite));
    return blob || fichier;
  } catch {
    return fichier;
  }
}

export const normaliser = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Lit le QR code d'une photo (renvoie le texte du QR, ou null)
export async function lireQr(fichier) {
  const { default: jsQR } = await import('jsqr');
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    for (const max of [1200, 800, 1800]) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k);
      const h = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
      if (r?.data) return r.data.trim();
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
