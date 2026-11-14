-- Onglet « Fournisseurs » (salon Automechanika Shanghai) :
-- visible seulement par les comptes qui ont l'accès (le patron, et ceux à qui il le donne).
-- Les autres administrateurs ne le voient pas.

alter table public.profils add column if not exists acces_fournisseurs boolean not null default false;

-- Le patron = le tout premier compte administrateur (créé au premier lancement)
update public.profils set acces_fournisseurs = true
where id = (select id from public.profils where role = 'admin' order by created_at limit 1);

create or replace function public.acces_fournisseurs() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select acces_fournisseurs from public.profils where id = auth.uid() and actif), false)
$$;
grant execute on function public.acces_fournisseurs() to authenticated;

create table if not exists public.fournisseurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  salon text,
  contact_nom text,
  whatsapp text,
  wechat text,
  adresse text,
  ville text,
  lat double precision,
  lng double precision,
  categories text[] not null default '{}',
  note int check (note between 1 and 5),
  photos text[] not null default '{}',
  catalogue jsonb not null default '[]',
  cree_par uuid references public.profils (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fournisseurs_ville on public.fournisseurs (ville);

alter table public.fournisseurs enable row level security;
drop policy if exists "fournisseurs lecture" on public.fournisseurs;
drop policy if exists "fournisseurs ajout" on public.fournisseurs;
drop policy if exists "fournisseurs modif" on public.fournisseurs;
drop policy if exists "fournisseurs suppr" on public.fournisseurs;
create policy "fournisseurs lecture" on public.fournisseurs for select using (public.acces_fournisseurs());
create policy "fournisseurs ajout" on public.fournisseurs for insert with check (public.acces_fournisseurs());
create policy "fournisseurs modif" on public.fournisseurs for update
  using (public.acces_fournisseurs()) with check (public.acces_fournisseurs());
-- Supprimer : seulement le patron (compte admin avec l'accès)
create policy "fournisseurs suppr" on public.fournisseurs for delete
  using (public.acces_fournisseurs() and public.est_admin());

grant select, insert, update, delete on public.fournisseurs to authenticated;
