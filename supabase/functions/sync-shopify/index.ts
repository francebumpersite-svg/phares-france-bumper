// Synchro Shopify -> appli, en LECTURE SEULE.
// Lit les phares (stock, prix, image) et les commandes des 60 derniers jours (ventes par pays).
// N'écrit jamais rien dans Shopify : uniquement des requêtes GraphQL "query".
import { admin, appelant, cors, json } from "../_shared/commun.ts";

const VERSION_API = "2025-10";

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
  if (!r.ok) throw new Error(`Connexion à Shopify refusée (${r.status}). Vérifie l'identifiant et le secret de l'appli Shopify.`);
  const d = await r.json();
  return d.access_token as string;
}

function client(boutique: string, jeton: string) {
  return async (query: string, variables: Record<string, unknown>) => {
    if (/^\s*mutation/i.test(query)) throw new Error("Écriture interdite");
    for (let essai = 0; essai < 4; essai++) {
      const r = await fetch(`https://${boutique}.myshopify.com/admin/api/${VERSION_API}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": jeton },
        body: JSON.stringify({ query, variables }),
      });
      if (r.status === 429) {
        await new Promise((ok) => setTimeout(ok, 1500 * (essai + 1)));
        continue;
      }
      const d = await r.json();
      if (d.errors) {
        const msg = JSON.stringify(d.errors);
        if (/THROTTLED/i.test(msg)) {
          await new Promise((ok) => setTimeout(ok, 1500 * (essai + 1)));
          continue;
        }
        throw new Error(msg);
      }
      return d.data;
    }
    throw new Error("Shopify trop sollicité, réessaie dans quelques minutes");
  };
}

const Q_PRODUITS = `query($q: String, $after: String) {
  products(first: 100, query: $q, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle
      featuredMedia { preview { image { url(transform: { maxWidth: 300 }) } } }
      variants(first: 20) { nodes { id title sku price inventoryQuantity } }
    }
  }
}`;

const champsCommande = (avecPays: boolean) => `
  id cancelledAt
  ${avecPays ? "shippingAddress { countryCodeV2 }" : ""}
  lineItems(first: 50) { nodes { quantity variant { id } } }`;

const qCommandes = (avecPays: boolean) => `query($q: String, $after: String) {
  orders(first: 100, query: $q, after: $after, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes { ${champsCommande(avecPays)} }
  }
}`;

const idCourt = (gid: string) => gid.split("/").pop() ?? gid;

// Commandes avec l'option peinture (lecture seule)
const Q_PEINTURE = `query($q: String, $after: String) {
  orders(first: 100, query: $q, after: $after, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name createdAt cancelledAt displayFulfillmentStatus
      lineItems(first: 50) {
        nodes {
          id title quantity unfulfilledQuantity
          customAttributes { key value }
          image { url(transform: { maxWidth: 600 }) }
          product { handle }
        }
      }
    }
  }
}`;
const estOptionPeinture = (t: string) => /option\s+peinture/i.test(t || "");
const norm = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const attr = (li: { customAttributes: { key: string; value: string }[] }, re: RegExp) =>
  li.customAttributes?.find((a) => re.test(norm(a.key)))?.value?.trim() || null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = admin();
  const { data: conf } = await sb.from("config_interne").select("sync_secret").eq("id", 1).maybeSingle();
  const recu = req.headers.get("x-sync-secret");
  const parSecret = !!(conf?.sync_secret && recu && recu === conf.sync_secret);
  if (!parSecret) {
    const moi = await appelant(req, sb);
    if (!moi || moi.role !== "admin") return json({ erreur: "Réservé à l'administrateur" }, 403);
    // Enregistre l'adresse de la synchro pour les mises à jour automatiques toutes les heures
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-shopify`;
    await sb.from("config_interne").update({ url_sync: url }).eq("id", 1);
  }

  const boutique = (Deno.env.get("SHOPIFY_SHOP") ?? "").replace(/\.myshopify\.com$/, "").trim();
  const debut = new Date().toISOString();

  try {
    if (!boutique) throw new Error("Boutique Shopify non configurée");
    const { data: reglages } = await sb.from("reglages").select("filtre_shopify").eq("id", 1).single();
    const filtre = (reglages?.filtre_shopify || "title:phare* AND NOT title:pare*").trim();

    const gql = client(boutique, await jetonShopify(boutique));

    // 1) Produits "phares"
    const lignes = new Map<string, Record<string, unknown>>();
    let after: string | null = null;
    do {
      const d = await gql(Q_PRODUITS, { q: `(${filtre}) AND status:active`, after });
      for (const p of d.products.nodes) {
        // Pas de pare-chocs dans l'appli : uniquement les phares
        if (/pare[\s-]?chocs?/i.test(p.title) || !/phare/i.test(p.title)) continue;
        const image = p.featuredMedia?.preview?.image?.url ?? null;
        for (const v of p.variants.nodes) {
          const vid = idCourt(v.id);
          lignes.set(vid, {
            variant_id: vid,
            product_id: idCourt(p.id),
            titre: p.title,
            variante: v.title === "Default Title" ? null : v.title,
            sku: v.sku || null,
            handle: p.handle,
            image,
            prix: v.price != null ? Number(v.price) : null,
            stock: v.inventoryQuantity,
            ventes_60j: 0,
            ventes_pays: {} as Record<string, number>,
            updated_at: debut,
          });
        }
      }
      after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
    } while (after);

    // 2) Commandes des 60 derniers jours (accès Shopify standard = 60 jours)
    const depuis = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const lireCommandes = async (avecPays: boolean) => {
      for (const l of lignes.values()) { l.ventes_60j = 0; l.ventes_pays = {}; }
      let curseur: string | null = null;
      do {
        const d = await gql(qCommandes(avecPays), { q: `created_at:>=${depuis}`, after: curseur });
        for (const o of d.orders.nodes) {
          if (o.cancelledAt) continue;
          const pays = o.shippingAddress?.countryCodeV2 ?? "??";
          for (const li of o.lineItems.nodes) {
            if (!li.variant) continue;
            const l = lignes.get(idCourt(li.variant.id));
            if (!l) continue;
            l.ventes_60j = (l.ventes_60j as number) + li.quantity;
            const vp = l.ventes_pays as Record<string, number>;
            vp[pays] = (vp[pays] ?? 0) + li.quantity;
          }
        }
        curseur = d.orders.pageInfo.hasNextPage ? d.orders.pageInfo.endCursor : null;
      } while (curseur);
    };
    let paysIndispo = false;
    let ventesIndispo = false;
    try {
      await lireCommandes(true);
    } catch (_e) {
      paysIndispo = true;
      try {
        await lireCommandes(false);
      } catch (_e2) {
        ventesIndispo = true;
        for (const l of lignes.values()) { l.ventes_60j = 0; l.ventes_pays = {}; }
      }
    }

    // 2 bis) Pare-chocs à peindre (option peinture) — n'efface jamais le statut ni le code peinture
    let peinturesIndispo = false;
    let nbPeintures = 0;
    try {
      const aPeindre: Record<string, unknown>[] = [];
      const dejaExpedies: Record<string, unknown>[] = [];
      let curseur: string | null = null;
      do {
        const d = await gql(Q_PEINTURE, { q: `created_at:>=${depuis}`, after: curseur });
        for (const o of d.orders.nodes) {
          const lignesCmd = o.lineItems.nodes;
          for (const opt of lignesCmd) {
            if (!estOptionPeinture(opt.title)) continue;
            const piece = attr(opt, /piece|pare.?choc/);
            const immat = attr(opt, /immatric|plaque/);
            const autres = lignesCmd.filter((x: { title: string }) => !estOptionPeinture(x.title) && !/emballage|carton/i.test(x.title));
            const pc = autres.find((x: { title: string }) => piece && norm(x.title) === norm(piece)) ?? autres.find((x: { title: string }) => /pare.?choc/i.test(x.title)) ?? autres[0];
            // Déjà expédié sur Shopify (commande traitée, ou pare-choc parti) → plus « à peindre »
            const expedie = o.displayFulfillmentStatus === "FULFILLED" || (pc && pc.unfulfilledQuantity === 0);
            (expedie ? dejaExpedies : aPeindre).push({
              ...(expedie ? { statut: "expedie" } : {}),
              line_key: `${idCourt(o.id)}-${idCourt(opt.id)}`,
              source: "shopify",
              commande: o.name,
              date_commande: o.createdAt,
              piece: piece ?? pc?.title ?? null,
              immat: immat ? immat.toUpperCase() : null,
              quantite: opt.quantity ?? 1,
              image: pc?.image?.url ?? null,
              lien: pc?.product?.handle ? `https://france-bumper.com/products/${pc.product.handle}` : null,
              annulee: !!o.cancelledAt,
              updated_at: debut,
            });
          }
        }
        curseur = d.orders.pageInfo.hasNextPage ? d.orders.pageInfo.endCursor : null;
      } while (curseur);
      nbPeintures = aPeindre.length;
      // Deux envois séparés : on ne remet jamais « à peindre » un pare-choc marqué expédié dans l'appli
      for (const groupe of [aPeindre, dejaExpedies]) {
        for (let i = 0; i < groupe.length; i += 500) {
          const { error } = await sb.from("peintures").upsert(groupe.slice(i, i + 500), { onConflict: "line_key" });
          if (error) throw new Error(error.message);
        }
      }
    } catch (e) {
      peinturesIndispo = true;
      console.error("peinture", e);
    }

    // 3) Enregistrement
    const tout = [...lignes.values()];
    for (let i = 0; i < tout.length; i += 500) {
      const { error } = await sb.from("shopify_produits").upsert(tout.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    await sb.from("shopify_produits").delete().lt("updated_at", debut);

    const message = ventesIndispo
      ? "Stock à jour, mais Shopify refuse l'accès aux commandes (droit read_orders à ajouter)."
      : paysIndispo
      ? "Synchro faite, mais Shopify ne donne pas les pays (accès aux données client à activer)."
      : peinturesIndispo
      ? "Stock à jour, mais les commandes avec peinture n'ont pas pu être lues."
      : "Synchro faite";
    await sb.from("synchro").update({ derniere: new Date().toISOString(), ok: true, message, nb_produits: tout.length }).eq("id", 1);
    return json({ ok: true, produits: tout.length, peintures: nbPeintures, message });
  } catch (e) {
    const message = String((e as Error).message ?? e).slice(0, 500);
    await sb.from("synchro").update({ derniere: new Date().toISOString(), ok: false, message }).eq("id", 1);
    return json({ ok: false, erreur: message }, 500);
  }
});
