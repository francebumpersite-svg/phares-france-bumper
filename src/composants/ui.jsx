import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

// Visionneuse plein écran : zoom (boutons, double appui, pincement), déplacement, photo suivante/précédente
export function PhotoGrande({ chemin, url, chemins, depart = 0, onFermer }) {
  const liste = chemins && chemins.length ? chemins : [chemin || url];
  const [i, setI] = useState(Math.min(depart, liste.length - 1));
  const [zoom, setZoom] = useState(1);
  const zoneRef = useRef(null);
  const geste = useRef({ dist: 0, zoomDepart: 1, x: null, dernierTap: 0 });
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const src = (c) => {
    if (!c) return null;
    if (/cdn\.shopify\.com/.test(c)) return c.replace(/([?&])width=\d+/, '$1width=1400');
    return /^https?:|^blob:/.test(c) ? c : srcPhoto(c);
  };
  const aller = (d) => {
    setZoom(1);
    setI((x) => (x + d + liste.length) % liste.length);
  };

  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const touche = (e) => {
      if (e.key === 'Escape') onFermer();
      if (e.key === 'ArrowRight' && liste.length > 1) aller(1);
      if (e.key === 'ArrowLeft' && liste.length > 1) aller(-1);
    };
    window.addEventListener('keydown', touche);
    return () => {
      document.body.style.overflow = avant;
      window.removeEventListener('keydown', touche);
    };
  }, []);

  // Zoom au doigt (pincement) et double appui, gérés à la main pour marcher aussi sur iPhone
  useEffect(() => {
    const z = zoneRef.current;
    if (!z) return;
    const distance = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const debut = (e) => {
      if (e.touches.length === 2) {
        geste.current.dist = distance(e.touches);
        geste.current.zoomDepart = zoomRef.current;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        geste.current.x = e.touches[0].clientX;
      }
    };
    const bouge = (e) => {
      if (e.touches.length === 2 && geste.current.dist) {
        e.preventDefault();
        const n = (geste.current.zoomDepart * distance(e.touches)) / geste.current.dist;
        setZoom(Math.max(1, Math.min(5, Math.round(n * 20) / 20)));
      }
    };
    const fin = (e) => {
      if (e.touches.length < 2) geste.current.dist = 0;
      if (e.touches.length === 0 && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const maintenant = Date.now();
        if (maintenant - geste.current.dernierTap < 300) {
          setZoom((v) => (v > 1 ? 1 : 2.5));
          geste.current.dernierTap = 0;
          geste.current.toggleTactile = maintenant;
          return;
        }
        geste.current.dernierTap = maintenant;
        if (zoomRef.current === 1 && geste.current.x != null && liste.length > 1) {
          const dx = t.clientX - geste.current.x;
          if (Math.abs(dx) > 60) aller(dx < 0 ? 1 : -1);
        }
        geste.current.x = null;
      }
    };
    z.addEventListener('touchstart', debut, { passive: false });
    z.addEventListener('touchmove', bouge, { passive: false });
    z.addEventListener('touchend', fin);
    return () => {
      z.removeEventListener('touchstart', debut);
      z.removeEventListener('touchmove', bouge);
      z.removeEventListener('touchend', fin);
    };
  }, [liste.length]);

  return createPortal(
    <div className="visionneuse" role="dialog" aria-modal="true" aria-label="Photo agrandie">
      <div className="vis-barre">
        <span className="vis-compte">{liste.length > 1 ? `${i + 1} / ${liste.length}` : ''}</span>
        <div className="vis-boutons">
          <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label="Dézoomer">−</button>
          <button type="button" onClick={() => setZoom((z) => Math.min(5, z + 0.5))} disabled={zoom >= 5} aria-label="Zoomer">+</button>
          <button type="button" onClick={onFermer} aria-label="Fermer">×</button>
        </div>
      </div>
      <div className="vis-zone" ref={zoneRef}>
        <img
          src={src(liste[i])}
          alt={`Photo ${i + 1}`}
          draggable={false}
          onDoubleClick={() => {
            // Sur téléphone, le double appui est déjà géré au doigt : on ignore le « double-clic » qui suit
            if (Date.now() - (geste.current.toggleTactile || 0) < 800) return;
            setZoom((z) => (z > 1 ? 1 : 2.5));
          }}
          style={zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: 'none', maxHeight: 'none' } : null}
        />
      </div>
      {liste.length > 1 && (
        <div className="vis-nav">
          <button type="button" onClick={() => aller(-1)} aria-label="Photo précédente">‹</button>
          <button type="button" onClick={() => aller(1)} aria-label="Photo suivante">›</button>
        </div>
      )}
    </div>,
    document.body
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
  const { profil } = useDonnees();
  if (!valeur) return <span className="ref vide">Pas de référence</span>;
  // Le collègue en Chine transmet la liste aux fournisseurs : référence seule, sans lien Google
  if (profil?.role === 'chine') return <span className="ref ref-simple">Réf. {valeur}</span>;
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
