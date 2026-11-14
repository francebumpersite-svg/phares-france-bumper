-- Rôle « lecteur » : voit tout comme l'administrateur, mais ne peut rien modifier
alter table public.profils drop constraint if exists profils_role_check;
alter table public.profils add constraint profils_role_check check (role in ('admin', 'vendeur', 'chine', 'lecteur'));

create or replace function public.peut_lire() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mon_role() in ('admin', 'vendeur', 'lecteur'), false)
$$;

create or replace function public.voit_tout() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mon_role() in ('admin', 'lecteur'), false)
$$;

drop policy if exists "phares lecture" on public.phares;
create policy "phares lecture" on public.phares for select using (public.peut_lire());

drop policy if exists "ventes lecture" on public.ventes_declarees;
create policy "ventes lecture" on public.ventes_declarees for select
  using (public.voit_tout() or (public.est_equipe() and vendeur_id = auth.uid()));

drop policy if exists "dropship equipe" on public.dropship;
create policy "dropship equipe" on public.dropship for select using (public.peut_lire());

drop policy if exists "retours lecture" on public.retours;
create policy "retours lecture" on public.retours for select using (public.peut_lire());

drop policy if exists "shopify lecture" on public.shopify_produits;
create policy "shopify lecture" on public.shopify_produits for select using (public.peut_lire());

drop policy if exists "photos ajout" on storage.objects;
create policy "photos ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.mon_role() in ('admin', 'vendeur', 'chine'));

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
  if r in ('admin', 'lecteur') then
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

create or replace function public.comptoir_par_produit()
returns table (shopify_product_id text, nb bigint)
language sql stable security definer set search_path = public as $$
  select v.shopify_product_id, count(*)
  from public.ventes_declarees v
  where public.peut_lire() and v.type = 'comptoir' and v.shopify_product_id is not null
    and v.created_at > now() - interval '60 days'
  group by v.shopify_product_id
$$;
