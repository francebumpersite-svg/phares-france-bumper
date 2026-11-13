// Gestion des comptes : premier compte admin, création et blocage des comptes employés.
import { admin, appelant, cors, emailDe, json } from "../_shared/commun.ts";

const ROLES = ["admin", "vendeur", "chine"];

function identifiantValide(id: string) {
  return /^[a-z0-9][a-z0-9._-]{1,30}$/.test(id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée" }, 405);

  const sb = admin();
  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return json({ erreur: "Requête invalide" }, 400);
  }
  const action = String(corps.action ?? "");

  // Premier lancement : création du compte administrateur (seulement s'il n'y en a aucun)
  if (action === "init") {
    const { count } = await sb.from("profils").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) return json({ erreur: "Le compte administrateur existe déjà" }, 403);
    return await creer(sb, { ...corps, role: "admin" });
  }

  const moi = await appelant(req, sb);
  if (!moi || moi.role !== "admin") return json({ erreur: "Réservé à l'administrateur" }, 403);

  if (action === "creer") return await creer(sb, corps);

  if (action === "modifier") {
    const id = String(corps.id ?? "");
    if (!id) return json({ erreur: "Compte manquant" }, 400);
    if (id === moi.id && (corps.actif === false || (corps.role && corps.role !== "admin"))) {
      return json({ erreur: "Tu ne peux pas bloquer ou rétrograder ton propre compte" }, 400);
    }
    const maj: Record<string, unknown> = {};
    if (typeof corps.nom === "string" && corps.nom.trim()) maj.nom = corps.nom.trim();
    if (typeof corps.role === "string") {
      if (!ROLES.includes(corps.role)) return json({ erreur: "Rôle inconnu" }, 400);
      maj.role = corps.role;
    }
    if (typeof corps.actif === "boolean") maj.actif = corps.actif;

    const authMaj: Record<string, unknown> = {};
    if (typeof corps.mot_de_passe === "string" && corps.mot_de_passe) {
      if (corps.mot_de_passe.length < 8) return json({ erreur: "Mot de passe : 8 caractères minimum" }, 400);
      authMaj.password = corps.mot_de_passe;
    }
    if (typeof corps.actif === "boolean") authMaj.ban_duration = corps.actif ? "none" : "876000h";
    if (Object.keys(authMaj).length) {
      const { error } = await sb.auth.admin.updateUserById(id, authMaj);
      if (error) return json({ erreur: error.message }, 400);
    }
    if (Object.keys(maj).length) {
      const { error } = await sb.from("profils").update(maj).eq("id", id);
      if (error) return json({ erreur: error.message }, 400);
    }
    return json({ ok: true });
  }

  if (action === "liste") {
    const { data, error } = await sb.from("profils").select("*").order("created_at");
    if (error) return json({ erreur: error.message }, 400);
    return json({ comptes: data });
  }

  return json({ erreur: "Action inconnue" }, 400);
});

async function creer(sb: ReturnType<typeof admin>, corps: Record<string, unknown>) {
  const nom = String(corps.nom ?? "").trim();
  const identifiant = String(corps.identifiant ?? "").trim().toLowerCase();
  const motDePasse = String(corps.mot_de_passe ?? "");
  const role = String(corps.role ?? "vendeur");
  if (!nom) return json({ erreur: "Nom manquant" }, 400);
  if (!identifiantValide(identifiant)) {
    return json({ erreur: "Identifiant : lettres minuscules, chiffres, point ou tiret (2 à 31 caractères)" }, 400);
  }
  if (motDePasse.length < 8) return json({ erreur: "Mot de passe : 8 caractères minimum" }, 400);
  if (!ROLES.includes(role)) return json({ erreur: "Rôle inconnu" }, 400);

  const { data, error } = await sb.auth.admin.createUser({
    email: emailDe(identifiant),
    password: motDePasse,
    email_confirm: true,
  });
  if (error || !data.user) {
    const msg = /already|registered|exists/i.test(error?.message ?? "") ? "Cet identifiant est déjà pris" : (error?.message ?? "Erreur");
    return json({ erreur: msg }, 400);
  }
  const { error: e2 } = await sb.from("profils").insert({ id: data.user.id, nom, identifiant, role, actif: true });
  if (e2) {
    await sb.auth.admin.deleteUser(data.user.id);
    return json({ erreur: e2.message }, 400);
  }
  return json({ ok: true, id: data.user.id });
}
