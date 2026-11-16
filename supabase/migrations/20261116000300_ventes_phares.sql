-- Historique des ventes de phares sur le site (lu sur Shopify, en lecture seule)
-- Une ligne par article « phare » d'une commande, depuis la création du site.
create table if not exists public.ventes_phares (
  line_key text primary key,
  commande text,
  date_vente timestamptz not null,
  product_id text,
  variant_id text,
  titre text not null,
  sku text,
  image text,
  quantite int not null default 0,          -- quantité restante (après remboursements / retraits)
  quantite_initiale int not null default 0,
  prix numeric,                             -- prix payé par pièce (après remises)
  pays text,
  annulee boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists ventes_phares_date on public.ventes_phares (date_vente desc);
create index if not exists ventes_phares_produit on public.ventes_phares (product_id);
alter table public.ventes_phares enable row level security;
drop policy if exists "ventes phares lecture" on public.ventes_phares;
create policy "ventes phares lecture" on public.ventes_phares for select using (public.peut_lire());

-- Avancement de la lecture de l'historique
alter table public.synchro add column if not exists historique_jusqua timestamptz;
alter table public.synchro add column if not exists historique_debut timestamptz;
alter table public.synchro add column if not exists historique_complet boolean not null default false;
alter table public.synchro add column if not exists historique_message text;
grant select on public.ventes_phares to authenticated;
