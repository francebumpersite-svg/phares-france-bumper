// Import du fichier exporté depuis l'ancienne appli « Phares France Bumper » (dans Claude)
import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useDonnees } from '../lib/donnees.jsx';

const PRIO = { 1: 'Urgent', 2: 'Vendu, en rupture', 3: 'Bientôt en rupture', 4: 'Idée internet', 5: 'Élargir la gamme' };

async function uuidDepuis(texte) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`fb-import-${texte}`)));
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = [...h.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

function cote(c) {
  const t = String(c || '').toLowerCase();
  const g = t.includes('gauche');
  const d = t.includes('droit');
  if (g && d) return 'paire';
  if (g) return 'gauche';
  if (d) return 'droit';
  return null;
}

const marque = (m) => {
  const s = String(m || '').trim();
  if (/^mercedes/i.test(s)) return 'Mercedes';
  return s || 'Sans marque';
};

const estFiche = (label) => /fiche|étiquette|etiquette|gros plan/i.test(label || '');

function base64EnBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}

export default function ImportAncienne() {
  const d = useDonnees();
  const ref = useRef(null);
  const [etat, setEtat] = useState('');
  const [occupe, setOccupe] = useState(false);

  async function importer(fichier) {
    setOccupe(true);
    try {
      setEtat('Lecture du fichier…');
      const data = JSON.parse(await fichier.text());
      const fiches = Array.isArray(data.fiches) ? data.fiches : [];
      const versBase2 = data.cible === 'base2';
      const photos = data.photos || {};
      if (!fiches.length) throw new Error('Ce fichier ne contient aucun phare.');

      // 1) Photos
      const ids = Object.keys(photos);
      let n = 0;
      for (const id of ids) {
        n++;
        setEtat(`Envoi des photos… ${n} / ${ids.length}`);
        const p = photos[id];
        const { error } = await supabase.storage
          .from('photos')
          .upload(`import/${id}.jpg`, base64EnBlob(p.b64 || p, p.type || 'image/jpeg'), { contentType: p.type || 'image/jpeg' });
        if (error && !/exist|duplicate/i.test(error.message || '')) throw new Error(`Photo ${id} : ${error.message}`);
      }

      // 2) Phares et retours
      setEtat('Enregistrement des phares…');
      const phares = [];
      const retours = [];
      for (const f of fiches) {
        const liste = Array.isArray(f.photos) && f.photos.length ? f.photos : f.photo ? [{ id: f.photo, label: '' }] : [];
        const dispo = liste.filter((p) => p && p.id && photos[p.id]);
        const vues = dispo.filter((p) => !estFiche(p.label)).map((p) => `import/${p.id}.jpg`);
        const vuesFiche = dispo.filter((p) => estFiche(p.label)).map((p) => `import/${p.id}.jpg`);
        const legendes = Object.fromEntries(dispo.filter((p) => p.label).map((p) => [`import/${p.id}.jpg`, p.label]));
        const notes = [
          f.onglet === 'commander' && f.priorite ? `Priorité : ${PRIO[f.priorite] || f.priorite}` : null,
          f.notes || null,
          typeof f.vendus === 'number' && f.vendus > 0 ? `Vendu ${f.vendus} fois (ancienne appli)` : null
        ]
          .filter(Boolean)
          .join(' — ');
        const id = await uuidDepuis(f.id);

        if (f.onglet === 'retours') {
          retours.push({
            id,
            vehicule: [marque(f.marque), f.modele].filter(Boolean).join(' '),
            ref: f.reference || null,
            motif: notes || null,
            photo: vues[0] || vuesFiche[0] || null,
            statut: 'ouvert',
            created_at: f.creeLe || new Date().toISOString()
          });
          continue;
        }
        phares.push({
          id,
          marque: marque(f.marque),
          modele: f.modele || null,
          annees: f.annees || null,
          cote: cote(f.cote),
          position: 'avant',
          type_eclairage: f.type || null,
          ref_oe: f.reference || null,
          statut: f.onglet === 'commander' ? (f.commande ? 'commande' : 'a_commander') : 'base',
          quantite: Math.max(1, Number(f.qte) || 1),
          non_compatible: f.onglet === 'incompatible',
          note: notes || null,
          photos: vues,
          photos_fiche: vuesFiche,
          photos_legendes: legendes,
          ...(versBase2 ? { base2: true, chine: true } : {}),
          created_at: f.creeLe || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      for (let i = 0; i < phares.length; i += 50) {
        setEtat(`Enregistrement des phares… ${Math.min(i + 50, phares.length)} / ${phares.length}`);
        const { error } = await supabase.from('phares').upsert(phares.slice(i, i + 50));
        if (error) throw new Error(error.message);
      }
      if (retours.length) {
        const { error } = await supabase.from('retours').upsert(retours);
        if (error) throw new Error(error.message);
      }
      await d.recharger();
      const nb = (s) => phares.filter((p) => p.statut === s).length;
      if (versBase2) {
        setEtat(`Terminé : ${phares.length} phares importés dans Base 2, ${ids.length} photos.`);
        return;
      }
      setEtat(
        `Terminé : ${phares.length} phares importés (${nb('base')} dans la base, ${nb('a_commander')} à commander, ${nb('commande')} commandés)` +
          `${retours.length ? `, ${retours.length} retours` : ''}, ${ids.length} photos.`
      );
    } catch (e) {
      setEtat(`Erreur : ${e.message || e}`);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="bloc" style={{ background: 'var(--carte)' }}>
      <h4>Importer un fichier de phares</h4>
      <div className="aide">
        Choisis le fichier d'import préparé par Claude (.json). Tu peux le relancer sans risque : les phares déjà importés sont mis à
        jour, pas dupliqués.
      </div>
      <button type="button" className="btn" disabled={occupe || !d.enLigne} onClick={() => ref.current?.click()}>
        {occupe ? 'Import en cours…' : 'Choisir le fichier'}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) importer(f);
        }}
      />
      {etat && <div className={etat.startsWith('Erreur') ? 'bandeau erreur' : 'bandeau'}>{etat}</div>}
    </div>
  );
}
