-- La Base Chine = uniquement les phares à acheter en Chine (liste du patron).
-- Les phares du site (ajoutés depuis Ruptures / Meilleures ventes / ventes) n'y apparaissent pas.
alter table public.phares add column if not exists chine boolean not null default true;

-- Phares venant du site : liés à un produit Shopify, ou importés de l'ancien onglet « À commander » (note « Priorité : … »)
update public.phares set chine = false
where shopify_product_id is not null or coalesce(note, '') like 'Priorité :%';

-- Le collègue en Chine ne voit que les phares de la Base Chine
drop policy if exists "phares lecture" on public.phares;
create policy "phares lecture" on public.phares for select
  using (public.peut_lire() or (public.mon_role() = 'chine' and chine));

create or replace function public.phares_prive_visible()
returns table (phare_id uuid, prix_achat numeric, prix_vente numeric, marge numeric,
               fournisseur text, lien text, ref_fournisseur text)
language plpgsql stable security definer set search_path = public as $$
declare
  r text := public.mon_role();
  c jsonb;
begin
  if r is null then
    return;
  end if;
  if r = 'chine' then
    -- ni prix, ni fournisseur, ni lien ; seulement les phares de la Base Chine
    return query select p.phare_id, null::numeric, null::numeric, null::numeric,
                        null::text, null::text, p.ref_fournisseur
                 from public.phares_prive p join public.phares f on f.id = p.phare_id
                 where f.chine;
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
