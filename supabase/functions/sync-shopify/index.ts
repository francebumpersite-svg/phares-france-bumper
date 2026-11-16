// Synchro Shopify -> appli, en LECTURE SEULE.
// Lit les phares (stock, prix, image), les commandes des 60 derniers jours (ventes par pays) et l'historique des ventes de phares.
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
// Historique de toutes les commandes (droit read_all_orders), trié par date de vente réelle.
// processedAt = vraie date de la vente (les anciennes commandes importées ont un createdAt faux).
const qHistorique = (avecPays: boolean) => `query($q: String, $after: String) {
  orders(first: 100, query: $q, after: $after, sortKey: PROCESSED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name processedAt cancelledAt
      ${avecPays ? "shippingAddress { countryCodeV2 }" : ""}
      lineItems(first: 50) {
        nodes {
          id title sku quantity currentQuantity
          variant { id } product { id }
          image { url(transform: { maxWidth: 300 }) }
          discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount } }
        }
      }
    }
  }
}`;
// Un article est un phare si son titre le dit (et que ce n'est pas un pare-choc, une option ou une pièce détachée)
const estPhare = (titre: string) => {
  const t = (titre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!/\bphares?\b|\boptiques?\b/.test(t)) return false;
  return !/pare.?chocs?|\bpc\b|peinture|\bpattes?\b|\bkit\b|reparation|ampoule|lave.?phare|nettoyeur|cache|grille|support|emballage|carton/.test(t);
};
const Q_PLUS_ANCIENNE = `query { orders(first: 1, sortKey: CREATED_AT) { nodes { createdAt } } }`;

const estOptionPeinture =(t: string) => /option\s+peinture/i.test(t || "");
const norm = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const attr = (li: { customAttributes: { key: string; value: string }[] }, re: RegExp) =>
  li.customAttributes?.find((a) => re.test(norm(a.key)))?.value?.trim() || null;

type Gql = (query: string, variables: Record<string, unknown>) => Promise<any>;
type Sb = ReturnType<typeof admin>;

async function lireHistorique(gql: Gql, sb: Sb, lignes: Map<string, Record<string, unknown>>, t0: number) {
  const BUDGET_MS = 95_000; // on s'arrête avant la limite de temps, la suite se fait à la prochaine synchro
  const { data: etat } = await sb.from("synchro").select("historique_jusqua, historique_debut, historique_complet").eq("id", 1).single();

  // Shopify donne-t-il bien accès aux commandes de plus de 60 jours ?
  const plusAncienne = (await gql(Q_PLUS_ANCIENNE, {})).orders.nodes[0]?.createdAt;
  const accesTout = plusAncienne && Date.now() - new Date(plusAncienne).getTime() > 65 * 86400000;
  if (!accesTout) {
    const m = "Shopify ne donne pas encore l'accès à tout l'historique des commandes (droit read_all_orders à accepter).";
    await sb.from("synchro").update({ historique_message: m }).eq("id", 1);
    return m;
  }

  // Une fois tout l'historique lu, on relit les 30 derniers jours à chaque fois (annulations, remboursements)
  let depuis: string = etat?.historique_jusqua ?? "2000-01-01T00:00:00Z";
  if (etat?.historique_complet) {
    const recent = new Date(Date.now() - 30 * 86400000).toISOString();
    if (recent < depuis) depuis = recent;
  }
  let debutVu: string | null = etat?.historique_debut ?? null;
  let avecPays = true;
  let curseur: string | null = null;
  let derniere = depuis;
  let nbLignes = 0;
  let fini = false;

  while (true) {
    let d;
    try {
      d = await gql(qHistorique(avecPays), { q: `processed_at:>='${depuis}'`, after: curseur });
    } catch (e) {
      if (avecPays && /shippingAddress|access|denied|protected/i.test(String((e as Error).message))) {
        avecPays = false;
        continue;
      }
      throw e;
    }
    const rows: Record<string, unknown>[] = [];
    for (const o of d.orders.nodes) {
      if (!debutVu || o.processedAt < debutVu) debutVu = o.processedAt;
      if (o.processedAt > derniere) derniere = o.processedAt;
      const pays = o.shippingAddress?.countryCodeV2 ?? null;
      for (const li of o.lineItems.nodes) {
        const vid = li.variant ? idCourt(li.variant.id) : null;
        if (!estPhare(li.title) && !(vid && lignes.has(vid))) continue;
        rows.push({
          line_key: idCourt(li.id),
          commande: o.name,
          date_vente: o.processedAt,
          product_id: li.product ? idCourt(li.product.id) : null,
          variant_id: vid,
          titre: li.title,
          sku: li.sku || null,
          image: li.image?.url ?? null,
          quantite: li.currentQuantity ?? li.quantity ?? 0,
          quantite_initiale: li.quantity ?? 0,
          prix: li.discountedUnitPriceAfterAllDiscountsSet?.shopMoney?.amount != null ? Number(li.discountedUnitPriceAfterAllDiscountsSet.shopMoney.amount) : null,
          pays,
          annulee: !!o.cancelledAt,
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (rows.length) {
      const { error } = await sb.from("ventes_phares").upsert(rows, { onConflict: "line_key" });
      if (error) throw new Error(error.message);
      nbLignes += rows.length;
    }
    curseur = d.orders.pageInfo.hasNextPage ? d.orders.pageInfo.endCursor : null;
    // On note où on en est après chaque page
    await sb.from("synchro").update({ historique_jusqua: derniere, historique_debut: debutVu }).eq("id", 1);
    if (!curseur) { fini = true; break; }
    if (Date.now() - t0 > BUDGET_MS) break;
  }

  const m = fini
    ? `Historique des ventes à jour (depuis le ${debutVu ? new Date(debutVu).toLocaleDateString("fr-FR") : "début"}).`
    : `Historique des ventes en cours de lecture (arrivé au ${new Date(derniere).toLocaleDateString("fr-FR")}), la suite à la prochaine mise à jour.`;
  await sb.from("synchro").update({
    historique_complet: fini || !!etat?.historique_complet,
    historique_message: m + (avecPays ? "" : " Pays non disponibles."),
  }).eq("id", 1);
  return `${m} ${nbLignes} lignes de phares lues.`;
}

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
  const t0 = Date.now();

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

    // 4) Historique des ventes de phares depuis la création du site (par morceaux, reprend où il s'était arrêté)
    let historique = "";
    try {
      historique = await lireHistorique(gql, sb, lignes, t0);
    } catch (e) {
      historique = `Historique des ventes non lu : ${String((e as Error).message ?? e).slice(0, 200)}`;
      console.error("historique", e);
    }

    const message = ventesIndispo
      ? "Stock à jour, mais Shopify refuse l'accès aux commandes (droit read_orders à ajouter)."
      : paysIndispo
      ? "Synchro faite, mais Shopify ne donne pas les pays (accès aux données client à activer)."
      : peinturesIndispo
      ? "Stock à jour, mais les commandes avec peinture n'ont pas pu être lues."
      : "Synchro faite";
    await sb.from("synchro").update({ derniere: new Date().toISOString(), ok: true, message, nb_produits: tout.length }).eq("id", 1);
    return json({ ok: true, produits: tout.length, peintures: nbPeintures, message, historique });
  } catch (e) {
    const message = String((e as Error).message ?? e).slice(0, 500);
    await sb.from("synchro").update({ derniere: new Date().toISOString(), ok: false, message }).eq("id", 1);
    return json({ ok: false, erreur: message }, 500);
  }
});
