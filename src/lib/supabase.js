import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configOk = Boolean(SUPABASE_URL && CLE);

export const supabase = configOk
  ? createClient(SUPABASE_URL, CLE, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'phares-fb-session' }
    })
  : null;

export const DOMAINE_COMPTES = 'phares.france-bumper.com';
export const emailDe = (identifiant) => `${identifiant.trim().toLowerCase()}@${DOMAINE_COMPTES}`;

export const urlPhoto = (chemin) =>
  chemin ? `${SUPABASE_URL}/storage/v1/object/public/photos/${chemin}` : null;

// Appel d'une fonction serveur (comptes, synchro Shopify)
export async function appelFonction(nom, corps) {
  const { data: s } = await supabase.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${nom}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: CLE,
      Authorization: `Bearer ${s?.session?.access_token ?? CLE}`
    },
    body: JSON.stringify(corps ?? {})
  });
  let d = {};
  try {
    d = await r.json();
  } catch {
    /* réponse vide */
  }
  if (!r.ok || d.erreur) throw new Error(d.erreur || `Erreur ${r.status}`);
  return d;
}
