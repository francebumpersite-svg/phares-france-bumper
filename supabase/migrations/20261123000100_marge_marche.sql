-- Prix du marché de l'occasion d'origine (€ TTC) pour calculer la marge, visible seulement par l'administrateur.
-- Frais d'arrivée d'un phare de Chine jusqu'à Taverny (€), réglables dans Réglages.
alter table public.phares_prive add column if not exists prix_marche numeric;
alter table public.reglages add column if not exists frais_arrivee numeric not null default 15;

drop function if exists public.phares_prive_visible();
create function public.phares_prive_visible()
returns table (phare_id uuid, prix_achat numeric, prix_vente numeric, marge numeric,
               fournisseur text, lien text, ref_fournisseur text,
               prix_achat_rmb numeric, prix_achat_variantes text, prix_marche numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  r text := public.mon_role();
  c jsonb;
begin
  if r is null then
    return;
  end if;
  if r = 'chine' then
    return query select p.phare_id, null::numeric, null::numeric, null::numeric,
                        null::text, null::text, p.ref_fournisseur, null::numeric, null::text, null::numeric
                 from public.phares_prive p join public.phares f on f.id = p.phare_id
                 where f.chine;
    return;
  end if;
  if r = 'admin' then
    return query select p.phare_id, p.prix_achat, p.prix_vente, p.prix_vente - p.prix_achat,
                        p.fournisseur, p.lien, p.ref_fournisseur, p.prix_achat_rmb, p.prix_achat_variantes, p.prix_marche
                 from public.phares_prive p;
    return;
  end if;
  if r = 'lecteur' then
    -- le prix du marché et la marge marché restent réservés à l'administrateur
    return query select p.phare_id, p.prix_achat, p.prix_vente, p.prix_vente - p.prix_achat,
                        p.fournisseur, p.lien, p.ref_fournisseur, p.prix_achat_rmb, p.prix_achat_variantes, null::numeric
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
    case when coalesce((c ->> 'fournisseur')::boolean, false) then p.ref_fournisseur end,
    case when coalesce((c ->> 'prix_achat')::boolean, false) then p.prix_achat_rmb end,
    case when coalesce((c ->> 'prix_achat')::boolean, false) then p.prix_achat_variantes end,
    null::numeric
  from public.phares_prive p;
end $$;
grant execute on function public.phares_prive_visible() to authenticated;
