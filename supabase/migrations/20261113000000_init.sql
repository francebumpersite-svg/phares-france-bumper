-- Appli Phares France Bumper : base de données
-- Rôles : admin (le patron), vendeur (employés), chine (collègue en Chine)


-- ---------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------
create table public.profils (
  id uuid primary key references auth.users on delete cascade,
  nom text not null,
  identifiant text not null unique,
  role text not null check (role in ('admin', 'vendeur', 'chine')),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.mon_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profils where id = auth.uid() and actif
$$;

create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mon_role() = 'admin', false)
$$;

create or replace function public.est_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mon_role() in ('admin', 'vendeur'), false)
$$;

create or replace function public.admin_existe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profils where role = 'admin')
$$;
grant execute on function public.admin_existe() to anon, authenticated;

alter table public.profils enable row level security;
create policy "profils lecture" on public.profils for select
  using (id = auth.uid() or public.est_admin());

-- ---------------------------------------------------------------
-- Réglages (une seule ligne)
-- ---------------------------------------------------------------
create table public.reglages (
  id int primary key default 1 check (id = 1),
  onglets_vendeur jsonb not null default
    '{"a_commander": true, "dropshipping": true, "base": true, "ruptures": true, "meilleures_ventes": false, "non_compatibles": true, "retours": true}',
  champs_vendeur jsonb not null default
    '{"prix_vente": false, "prix_achat": false, "marge": false, "fournisseur": false}',
  filtre_shopify text not null default 'phare*',
  updated_at timestamptz not null default now()
);
insert into public.reglages (id) values (1);

alter table public.reglages enable row level security;
create policy "reglages lecture" on public.reglages for select using (public.mon_role() is not null);
create policy "reglages admin" on public.reglages for update using (public.est_admin()) with check (public.est_admin());

-- ---------------------------------------------------------------
-- Phares (base de données + à commander)
-- ---------------------------------------------------------------
create table public.phares (
  id uuid primary key default gen_random_uuid(),
  marque text not null,
  modele text,
  annees text,
  cote text check (cote in ('gauche', 'droit', 'paire')),
  position text default 'avant',
  type_eclairage text,
  ref_oe text,
  statut text not null default 'base' check (statut in ('base', 'a_commander', 'commande', 'recu')),
  quantite int not null default 1,
  non_compatible boolean not null default false,
  note text,
  photos text[] not null default '{}',
  photos_fiche text[] not null default '{}',
  shopify_product_id text,
  cree_par uuid references public.profils (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.phares (statut);
create index on public.phares (marque);

alter table public.phares enable row level security;
create policy "phares lecture" on public.phares for select using (public.est_equipe());
create policy "phares admin" on public.phares for all using (public.est_admin()) with check (public.est_admin());

-- Infos sensibles : uniquement l'admin en direct, les vendeurs via phares_prive_visible()
create table public.phares_prive (
  phare_id uuid primary key references public.phares on delete cascade,
  prix_achat numeric,
  prix_vente numeric,
  fournisseur text,
  lien text,
  ref_fournisseur text,
  updated_at timestamptz not null default now()
);
alter table public.phares_prive enable row level security;
create policy "prive admin" on public.phares_prive for all using (public.est_admin()) with check (public.est_admin());

create or replace function public.phares_prive_visible()
returns table (phare_id uuid, prix_achat numeric, prix_vente numeric, marge numeric,
               fournisseur text, lien text, ref_fournisseur text)
language plpgsql stable security definer set search_path = public as $$
declare
  r text := public.mon_role();
  c jsonb;
begin
  if r is null or r = 'chine' then
    return;
  end if;
  if r = 'admin' then
    return query select p.phare_id, p.prix_achat, p.prix_vente, p.prix_vente - p.prix_achat,
                        p.fournisseur, p.lien, p.ref_fournisseur
                 from public.phares_prive p;
    return;
  end if;
  select champs_vendeur into c from public.reglages where id = 1;
  return query select p.phare_id,
    case when coalesce((c ->> 'prix_achat')::boolean, false) then p.prix_achat end,
    case when coalesce((c ->> 'prix_vente')::boolean, false) then p.prix_vente end,
    case when coalesce((c ->> 'marge')::boolean, false) then p.prix_vente - p.prix_achat end,
    case when coalesce((c ->> 'fournisseur')::boolean, false) then p.fournisseur end,
    case when coalesce((c ->> 'fournisseur')::boolean, false) then p.lien end,
    case when coalesce((c ->> 'fournisseur')::boolean, false) then p.ref_fournisseur end
  from public.phares_prive p;
end $$;
grant execute on function public.phares_prive_visible() to authenticated;

-- ---------------------------------------------------------------
-- Ventes déclarées par les vendeurs (photo + type comptoir / en ligne)
-- ---------------------------------------------------------------
create table public.ventes_declarees (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('comptoir', 'en_ligne')),
  marque text,
  modele text,
  annee text,
  cote text,
  ref text,
  photo text,
  shopify_product_id text,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'ajoute', 'commande', 'ignore')),
  vendeur_id uuid references public.profils (id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.ventes_declarees enable row level security;
create policy "ventes lecture" on public.ventes_declarees for select
  using (public.est_admin() or (public.est_equipe() and vendeur_id = auth.uid()));
create policy "ventes ajout" on public.ventes_declarees for insert
  with check (public.est_equipe() and vendeur_id = auth.uid());
create policy "ventes admin" on public.ventes_declarees for update using (public.est_admin()) with check (public.est_admin());
create policy "ventes suppr" on public.ventes_declarees for delete using (public.est_admin());

-- Nombre de ventes comptoir par produit Shopify sur 60 jours (visible par l'équipe)
create or replace function public.comptoir_par_produit()
returns table (shopify_product_id text, nb bigint)
language sql stable security definer set search_path = public as $$
  select v.shopify_product_id, count(*)
  from public.ventes_declarees v
  where public.est_equipe() and v.type = 'comptoir' and v.shopify_product_id is not null
    and v.created_at > now() - interval '60 days'
  group by v.shopify_product_id
$$;
grant execute on function public.comptoir_par_produit() to authenticated;

-- ---------------------------------------------------------------
-- Dropshipping
-- ---------------------------------------------------------------
create table public.dropship (
  id uuid primary key default gen_random_uuid(),
  photo text,
  ref text,
  vehicule text,
  client_nom text,
  client_tel text,
  client_adresse text,
  paiement text not null default 'acompte' check (paiement in ('acompte', 'total')),
  prix_total numeric,
  acompte numeric,
  livraison text not null default 'depot' check (livraison in ('depot', 'client')),
  statut text not null default 'a_commander' check (statut in ('a_commander', 'commande', 'expedie', 'recu', 'livre', 'annule')),
  suivi text,
  note text,
  cree_par uuid references public.profils (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dropship enable row level security;
create policy "dropship equipe" on public.dropship for select using (public.est_equipe());
create policy "dropship ajout" on public.dropship for insert with check (public.est_equipe());
create policy "dropship maj" on public.dropship for update using (public.est_equipe()) with check (public.est_equipe());
create policy "dropship suppr" on public.dropship for delete using (public.est_admin());

-- Vue pour le collègue en Chine : coordonnées du client seulement si livraison chez le client, jamais les montants
create or replace function public.dropship_chine()
returns table (id uuid, photo text, ref text, vehicule text, livraison text,
               client_nom text, client_tel text, client_adresse text,
               statut text, suivi text, note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.photo, d.ref, d.vehicule, d.livraison,
    case when d.livraison = 'client' then d.client_nom end,
    case when d.livraison = 'client' then d.client_tel end,
    case when d.livraison = 'client' then d.client_adresse end,
    d.statut, d.suivi, d.note, d.created_at
  from public.dropship d
  where public.mon_role() in ('chine', 'admin') and d.statut <> 'annule'
  order by d.created_at desc
$$;
grant execute on function public.dropship_chine() to authenticated;

create or replace function public.dropship_maj_chine(p_id uuid, p_statut text, p_suivi text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.mon_role() not in ('chine', 'admin') then
    raise exception 'Accès refusé';
  end if;
  if p_statut not in ('a_commander', 'commande', 'expedie') then
    raise exception 'Statut non autorisé';
  end if;
  update public.dropship set statut = p_statut, suivi = p_suivi, updated_at = now() where id = p_id;
end $$;
grant execute on function public.dropship_maj_chine(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------
-- Retours client
-- ---------------------------------------------------------------
create table public.retours (
  id uuid primary key default gen_random_uuid(),
  vehicule text,
  ref text,
  client text,
  motif text,
  photo text,
  statut text not null default 'ouvert' check (statut in ('ouvert', 'traite')),
  cree_par uuid references public.profils (id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.retours enable row level security;
create policy "retours lecture" on public.retours for select using (public.est_equipe());
create policy "retours ajout" on public.retours for insert with check (public.est_equipe());
create policy "retours admin" on public.retours for update using (public.est_admin()) with check (public.est_admin());
create policy "retours suppr" on public.retours for delete using (public.est_admin());

-- ---------------------------------------------------------------
-- Copie en lecture seule des phares Shopify (remplie par la synchro)
-- ---------------------------------------------------------------
create table public.shopify_produits (
  variant_id text primary key,
  product_id text not null,
  titre text,
  variante text,
  sku text,
  handle text,
  image text,
  prix numeric,
  stock int,
  ventes_60j int not null default 0,
  ventes_pays jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create index on public.shopify_produits (product_id);
alter table public.shopify_produits enable row level security;
create policy "shopify lecture" on public.shopify_produits for select using (public.est_equipe());

create table public.synchro (
  id int primary key default 1 check (id = 1),
  derniere timestamptz,
  ok boolean,
  message text,
  nb_produits int
);
insert into public.synchro (id) values (1);
alter table public.synchro enable row level security;
create policy "synchro lecture" on public.synchro for select using (public.mon_role() is not null);

-- ---------------------------------------------------------------
-- Photos (bucket public, noms de fichiers aléatoires)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.mon_role() is not null);
create policy "photos suppr" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.est_admin());
