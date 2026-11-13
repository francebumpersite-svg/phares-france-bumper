import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Renvoie le profil de la personne qui appelle (ou null)
export async function appelant(req: Request, sb: SupabaseClient) {
  const auth = req.headers.get("Authorization") ?? "";
  const jeton = auth.replace(/^Bearer\s+/i, "");
  if (!jeton) return null;
  const { data, error } = await sb.auth.getUser(jeton);
  if (error || !data?.user) return null;
  const { data: profil } = await sb.from("profils").select("*").eq("id", data.user.id).maybeSingle();
  if (!profil || !profil.actif) return null;
  return profil as { id: string; nom: string; role: string; actif: boolean; identifiant: string };
}

export const DOMAINE_COMPTES = "phares.france-bumper.com";
export const emailDe = (identifiant: string) => `${identifiant}@${DOMAINE_COMPTES}`;
