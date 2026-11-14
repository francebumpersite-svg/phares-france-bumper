-- Onglet « Peinture » : pare-chocs commandés avec l'option peinture (Shopify) ou au comptoir
create table if not exists public.peintures (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'comptoir' check (source in ('shopify', 'comptoir')),
  line_key text unique,              -- commande Shopify + ligne (pour ne pas créer de doublon)
  commande text,                     -- ex. #5736
  date_commande timestamptz not null default now(),
  piece text,                        -- ex. Pare-choc arrière Opel Astra K phase 1…
  immat text,
  quantite int not null default 1,
  image text,                        -- photo Shopify du pare-choc
  photo text,                        -- photo prise par l'équipe (comptoir)
  lien text,                         -- fiche produit sur le site
  code_peinture text,
  note text,
  annulee boolean not null default false,
  statut text not null default 'a_peindre' check (statut in ('a_peindre', 'expedie')),
  expedie_le timestamptz,
  cree_par uuid references public.profils (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists peintures_statut on public.peintures (statut, date_commande);

alter table public.peintures enable row level security;
drop policy if exists "peintures lecture" on public.peintures;
drop policy if exists "peintures ajout" on public.peintures;
drop policy if exists "peintures modif" on public.peintures;
drop policy if exists "peintures suppr" on public.peintures;
create policy "peintures lecture" on public.peintures for select using (public.peut_lire());
create policy "peintures ajout" on public.peintures for insert with check (public.est_equipe());
create policy "peintures modif" on public.peintures for update using (public.est_equipe()) with check (public.est_equipe());
create policy "peintures suppr" on public.peintures for delete using (public.est_admin());
grant select, insert, update, delete on public.peintures to authenticated;

-- Les vendeurs (le peintre) voient l'onglet par défaut ; l'admin peut le cacher dans Réglages
update public.reglages set onglets_vendeur = coalesce(onglets_vendeur, '{}'::jsonb) || '{"peinture": true}'::jsonb where id = 1;
