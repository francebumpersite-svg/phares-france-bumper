import { useEffect, useMemo, useRef, useState } from 'react';
import { srcPhoto, useDonnees } from '../lib/donnees.jsx';
import { normaliser, plageAnnees, lienGoogle } from '../lib/outils.js';

export const Icone = {
  phare: (p) => (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 9c0-2 2-4 6-4h6c4 0 6 3 6 7s-2 7-6 7H9c-4 0-6-2-6-4z" />
      <circle cx="14.5" cy="12" r="3" />
    </svg>
  ),
  photo: (p) => (
    <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  loupe: (p) => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  reglages: (p) => (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  coche: (p) => (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12l5 5 9-10" />
    </svg>
  ),
  plus: (p) => (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  horsLigne: (p) => (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </svg>
  ),
  enLigne: (p) => (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M5 12.5a10 10 0 0 1 14 0" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </svg>
  ),
  cadenas: (p) => (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  whatsapp: (p) => (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
    </svg>
  )
};

export function Vignette({ chemin, url, taille = 64, alt = 'Photo du phare', onClick }) {
  const src = url || srcPhoto(chemin);
  const [ko, setKo] = useState(false);
  const contenu =
    src && !ko ? (
      <img src={src} alt={alt} loading="lazy" onError={() => setKo(true)} />
    ) : (
      <Icone.phare role="img" aria-label={alt} />
    );
  const style = { width: taille, height: taille };
  if (onClick) {
    return (
      <button type="button" className="vignette" style={style} onClick={onClick} aria-label={`Agrandir : ${alt}`}>
        {contenu}
      </button>
    );
  }
  return (
    <div className="vignette" style={style}>
      {contenu}
    </div>
  );
}

export function Feuille({ titre, onFermer, children, pied }) {
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);
  return (
    <div className="voile" onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="feuille" role="dialog" aria-modal="true" aria-label={titre}>
        <div className="feuille-tete">
          <h3>{titre}</h3>
          <button type="button" className="fermer" onClick={onFermer} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="feuille-corps">{children}</div>
        {pied && <div className="feuille-pied">{pied}</div>}
      </div>
    </div>
  );
}

export function PhotoGrande({ chemin, url, onFermer }) {
  return (
    <div className="voile voile-noir" onClick={onFermer}>
      <img className="photo-grande" src={url || srcPhoto(chemin)} alt="Photo agrandie" />
    </div>
  );
}

// Bouton qui ouvre l'appareil photo et renvoie le chemin de la photo préparée
export function BoutonPhoto({ onPhoto, libelle = 'Prendre une photo', grand = false }) {
  const { preparerPhoto } = useDonnees();
  const ref = useRef(null);
  const [occupe, setOccupe] = useState(false);
  return (
    <>
      <button
        type="button"
        className={grand ? 'bouton-photo grand' : 'bouton-photo'}
        onClick={() => ref.current?.click()}
        disabled={occupe}
      >
        <Icone.photo />
        <span>{occupe ? 'Préparation…' : libelle}</span>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setOccupe(true);
          try {
            const r = await preparerPhoto(f);
            onPhoto(r);
          } finally {
            setOccupe(false);
          }
        }}
      />
    </>
  );
}

export function Champ({ label, children, aide }) {
  return (
    <label className="champ">
      <span>{label}</span>
      {children}
      {aide && <small className="aide">{aide}</small>}
    </label>
  );
}

export function Segments({ valeur, options, onChange, petit }) {
  return (
    <div className={petit ? 'segments petit' : 'segments'} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => (
        <button key={v} type="button" className={valeur === v ? 'seg seg-on' : 'seg'} aria-pressed={valeur === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Interrupteur({ actif, onChange, label }) {
  return (
    <button type="button" className={actif ? 'sw sw-on' : 'sw'} aria-pressed={actif} aria-label={label} onClick={() => onChange(!actif)}>
      <span className="rond" />
    </button>
  );
}

export function LienRef({ valeur, suffixe = 'phare' }) {
  if (!valeur) return <span className="ref vide">Pas de référence</span>;
  return (
    <a className="ref" href={lienGoogle(`${valeur} ${suffixe}`)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      {valeur} · Google
    </a>
  );
}

export function Vide({ titre, texte }) {
  return (
    <div className="vide-liste">
      <strong>{titre}</strong>
      {texte}
    </div>
  );
}

// Recherche + filtres Marque / Modèle / Année / Côté
export function useFiltres(phares) {
  const [f, setF] = useState({ q: '', marque: '', modele: '', annee: '', cote: '' });
  const marques = useMemo(() => [...new Set(phares.map((p) => p.marque).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [phares]);
  const modeles = useMemo(
    () =>
      [...new Set(phares.filter((p) => !f.marque || p.marque === f.marque).map((p) => p.modele).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'fr')
      ),
    [phares, f.marque]
  );
  const annees = useMemo(() => {
    const s = new Set();
    for (const p of phares) {
      const r = plageAnnees(p.annees);
      if (r) for (let a = r[0]; a <= r[1] && a - r[0] < 40; a++) s.add(a);
    }
    return [...s].sort((a, b) => b - a);
  }, [phares]);
  const filtres = useMemo(() => {
    const q = normaliser(f.q);
    return phares.filter((p) => {
      if (f.marque && p.marque !== f.marque) return false;
      if (f.modele && p.modele !== f.modele) return false;
      if (f.cote && p.cote !== f.cote && !(p.cote === 'paire')) return false;
      if (f.annee) {
        const r = plageAnnees(p.annees);
        if (!r || Number(f.annee) < r[0] || Number(f.annee) > r[1]) return false;
      }
      if (q) {
        const t = normaliser([p.marque, p.modele, p.annees, p.ref_oe, p.note, p.type_eclairage].join(' '));
        if (!q.split(/\s+/).every((m) => t.includes(m))) return false;
      }
      return true;
    });
  }, [phares, f]);
  return { f, setF, marques, modeles, annees, filtres };
}

export function BarreFiltres({ f, setF, marques, modeles, annees }) {
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value, ...(k === 'marque' ? { modele: '' } : {}) }));
  const actifs = f.q || f.marque || f.modele || f.annee || f.cote;
  return (
    <div className="outils">
      <label className="recherche">
        <Icone.loupe />
        <input type="search" value={f.q} onChange={maj('q')} placeholder="Référence, marque ou modèle" aria-label="Rechercher" />
      </label>
      <div className="filtres">
        <label className="filtre">
          Marque
          <select value={f.marque} onChange={maj('marque')}>
            <option value="">Toutes</option>
            {marques.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="filtre">
          Modèle
          <select value={f.modele} onChange={maj('modele')}>
            <option value="">Tous</option>
            {modeles.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="filtre">
          Année
          <select value={f.annee} onChange={maj('annee')}>
            <option value="">Toutes</option>
            {annees.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="filtre">
          Côté
          <select value={f.cote} onChange={maj('cote')}>
            <option value="">Tous</option>
            <option value="gauche">Gauche</option>
            <option value="droit">Droit</option>
          </select>
        </label>
      </div>
      {actifs && (
        <button type="button" className="lien-btn" onClick={() => setF({ q: '', marque: '', modele: '', annee: '', cote: '' })}>
          Effacer les filtres
        </button>
      )}
    </div>
  );
}

// Choix d'un produit Shopify (pour relier un phare ou une vente)
export function ChoixShopify({ valeur, onChange }) {
  const { shopify } = useDonnees();
  const [q, setQ] = useState('');
  const produits = useMemo(() => {
    const m = new Map();
    for (const s of shopify) if (!m.has(s.product_id)) m.set(s.product_id, s);
    return [...m.values()];
  }, [shopify]);
  const choisi = produits.find((p) => p.product_id === valeur);
  const res = useMemo(() => {
    const n = normaliser(q);
    if (!n) return [];
    return produits.filter((p) => normaliser(`${p.titre} ${p.sku ?? ''}`).includes(n)).slice(0, 15);
  }, [q, produits]);
  if (choisi) {
    return (
      <div className="choix-shopify">
        <Vignette url={choisi.image} taille={44} alt={choisi.titre} />
        <span className="choix-titre">{choisi.titre}</span>
        <button type="button" className="lien-btn" onClick={() => onChange(null)}>
          Retirer
        </button>
      </div>
    );
  }
  return (
    <div className="choix-shopify-col">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={produits.length ? 'Chercher le produit sur ton site' : 'Aucun produit Shopify synchronisé'} />
      {res.map((p) => (
        <button key={p.product_id} type="button" className="choix-ligne" onClick={() => { onChange(p.product_id); setQ(''); }}>
          <Vignette url={p.image} taille={36} alt={p.titre} />
          <span>{p.titre}</span>
        </button>
      ))}
    </div>
  );
}
