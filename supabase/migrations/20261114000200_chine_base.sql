-- Le collègue en Chine voit aussi la Base Chine (photos, modèles, références), jamais les prix ni le fournisseur
drop policy if exists "phares lecture" on public.phares;
create policy "phares lecture" on public.phares for select
  using (public.peut_lire() or public.mon_role() = 'chine');

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
    -- ni prix, ni fournisseur, ni lien : il ne doit pas savoir chez qui on achète
    return query select p.phare_id, null::numeric, null::numeric, null::numeric,
                        null::text, null::text, p.ref_fournisseur
                 from public.phares_prive p;
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

-- Retours client pour le collègue en Chine : lecture seule, sans le nom du client
create or replace function public.retours_chine()
returns table (id uuid, vehicule text, ref text, motif text, photo text, statut text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.vehicule, r.ref, r.motif, r.photo, r.statut, r.created_at
  from public.retours r
  where public.mon_role() = 'chine'
  order by r.created_at desc
  limit 2000;
$$;
revoke all on function public.retours_chine() from public, anon;
grant execute on function public.retours_chine() to authenticated;
