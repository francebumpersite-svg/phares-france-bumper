// Chiffre d'affaires du site (Shopify, en LECTURE SEULE) + notification quotidienne au patron.
// Le chiffre est exactement celui de Shopify « Ventes totales » (TTC, livraison comprise,
// remises et remboursements déduits), lu avec une requête ShopifyQL. Rien n'est jamais écrit dans Shopify.
import webpush from "npm:web-push@3.6.7";
import { admin, appelant, cors, json } from "../_shared/commun.ts";

const VERSION_API = "2026-10";
const SUJET_VAPID = "https://francebumpersite-svg.github.io/phares-france-bumper/";
type Sb = ReturnType<typeof admin>;

async function jetonShopify(boutique: string) {
  const r = await fetch(`https://${boutique}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: Deno.env.get("SHOPIFY_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "",
    }),
  });
  if (!r.ok) throw new Error(`Connexion à Shopify refusée (${r.status}).`);
  return (await r.json()).access_token as string;
}

// Une requête ShopifyQL en lecture seule
async function shopifyql(boutique: string, jeton: string, requete: string) {
  const query = `query($q: String!) { shopifyqlQuery(query: $q) { parseErrors tableData { rows } } }`;
  const r = await fetch(`https://${boutique}.myshopify.com/admin/api/${VERSION_API}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": jeton },
    body: JSON.stringify({ query, variables: { q: requete } }),
  });
  const d = await r.json();
  if (d.errors) {
    const m = JSON.stringify(d.errors);
    if (/access|denied|scope|read_reports|unauthorized/i.test(m)) {
      throw new Error("ACCES_RAPPORTS");
    }
    throw new Error(m.slice(0, 300));
  }
  const res = d.data?.shopifyqlQuery;
  if (res?.parseErrors?.length) throw new Error(res.parseErrors.join(" "));
  return (res?.tableData?.rows ?? []) as Record<string, string>[];
}

// Jour, mois et année en cours, dans le fuseau de la boutique (Europe/Paris)
async function lireChiffres() {
  const boutique = (Deno.env.get("SHOPIFY_SHOP") ?? "").replace(/\.myshopify\.com$/, "").trim();
  if (!boutique) throw new Error("Boutique Shopify non configurée");
  const jeton = await jetonShopify(boutique);
  const periode = async (p: string) => {
    const rows = await shopifyql(boutique, jeton, `FROM sales SHOW total_sales, orders DURING ${p}`);
    const r = rows[0] ?? {};
    return { total: Number(r.total_sales ?? 0), commandes: Number(r.orders ?? 0) };
  };
  const [jour, mois, annee] = await Promise.all([periode("today"), periode("this_month"), periode("this_year")]);
  return { jour, mois, annee, lu_le: new Date().toISOString() };
}

// Heure de Paris
function maintenantParis() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, jourMois: `${p.day}/${p.month}`, heure: Number(p.hour), minute: Number(p.minute) };
}

const euro = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

// Clés d'envoi des notifications : créées une seule fois et gardées côté serveur
async function clesVapid(sb: Sb) {
  const { data: c } = await sb.from("config_interne").select("vapid_public, vapid_private").eq("id", 1).single();
  if (c?.vapid_public && c?.vapid_private) return { publicKey: c.vapid_public, privateKey: c.vapid_private };
  const k = webpush.generateVAPIDKeys();
  await sb.from("config_interne").update({ vapid_public: k.publicKey, vapid_private: k.privateKey }).eq("id", 1).is("vapid_public", null);
  const { data: c2 } = await sb.from("config_interne").select("vapid_public, vapid_private").eq("id", 1).single();
  return { publicKey: c2!.vapid_public as string, privateKey: c2!.vapid_private as string };
}

// Envoie une notification à tous les téléphones du patron ; retire les abonnements expirés
async function envoyer(sb: Sb, message: Record<string, unknown>, userId?: string) {
  const cles = await clesVapid(sb);
  let q = sb.from("push_abonnements").select("id, endpoint, p256dh, auth, user_id");
  if (userId) q = q.eq("user_id", userId);
  const { data: abos } = await q;
  const { data: patrons } = await sb.from("profils").select("id").eq("est_patron", true).eq("actif", true);
  const idsPatron = new Set((patrons ?? []).map((p) => p.id));
  let ok = 0;
  for (const a of abos ?? []) {
    if (!idsPatron.has(a.user_id)) continue;
    try {
      const det = webpush.generateRequestDetails(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify(message),
        { TTL: 6 * 3600, urgency: "high", vapidDetails: { subject: SUJET_VAPID, publicKey: cles.publicKey, privateKey: cles.privateKey } },
      );
      const r = await fetch(det.endpoint, { method: det.method, headers: det.headers as Record<string, string>, body: det.body });
      if (r.status === 404 || r.status === 410) await sb.from("push_abonnements").delete().eq("id", a.id);
      else if (r.ok) ok++;
      else console.error("push", r.status, await r.text());
    } catch (e) {
      console.error("push", e);
    }
  }
  return ok;
}

function messageCA(c: Awaited<ReturnType<typeof lireChiffres>>, jourMois: string) {
  return {
    titre: `France Bumper · CA du ${jourMois}`,
    corps: `Jour : ${euro(c.jour.total)} (${c.jour.commandes} cmd)\nMois : ${euro(c.mois.total)}\nAnnée : ${euro(c.annee.total)}`,
    url: "./",
  };
}

const texteErreur = (e: unknown) =>
  String((e as Error).message ?? e) === "ACCES_RAPPORTS"
    ? "Shopify n'a pas encore donné l'accès aux rapports de ventes (droit read_reports à accepter dans Shopify)."
    : String((e as Error).message ?? e).slice(0, 300);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = admin();
  let corps: Record<string, unknown> = {};
  try {
    corps = await req.json();
  } catch { /* corps vide */ }
  const action = String(corps.action ?? "lire");

  // Appel automatique de 18 h 30 (planifié dans la base, avec le secret interne)
  if (action === "notifier") {
    const { data: conf } = await sb.from("config_interne").select("sync_secret, notif_ca_derniere").eq("id", 1).single();
    if (!conf?.sync_secret || req.headers.get("x-sync-secret") !== conf.sync_secret) return json({ erreur: "Refusé" }, 403);
    const p = maintenantParis();
    if (p.heure !== 18 && corps.forcer !== true) return json({ ok: true, ignore: "pas 18 h à Paris" });
    if (conf.notif_ca_derniere === p.date && corps.forcer !== true) return json({ ok: true, ignore: "déjà envoyée aujourd'hui" });
    let message;
    try {
      message = messageCA(await lireChiffres(), p.jourMois);
    } catch (e) {
      message = { titre: "France Bumper · CA du jour", corps: `Chiffre indisponible : ${texteErreur(e)}`, url: "./" };
    }
    const n = await envoyer(sb, message);
    await sb.from("config_interne").update({ notif_ca_derniere: p.date }).eq("id", 1);
    return json({ ok: true, envoyees: n });
  }

  // Tout le reste : seulement le patron, connecté
  const moi = await appelant(req, sb);
  if (!moi || moi.role !== "admin" || !moi.est_patron) return json({ erreur: "Réservé au patron" }, 403);

  if (action === "cle_push") {
    const cles = await clesVapid(sb);
    return json({ cle: cles.publicKey });
  }

  if (action === "test_push") {
    let message;
    try {
      message = messageCA(await lireChiffres(), maintenantParis().jourMois);
      message.titre = `Test · ${message.titre}`;
    } catch (e) {
      message = { titre: "France Bumper · test", corps: `Les notifications marchent. Chiffre indisponible : ${texteErreur(e)}`, url: "./" };
    }
    const n = await envoyer(sb, message, moi.id);
    return json({ ok: true, envoyees: n });
  }

  // action « lire »
  try {
    return json({ ok: true, ...(await lireChiffres()) });
  } catch (e) {
    return json({ erreur: texteErreur(e) }, 502);
  }
});
