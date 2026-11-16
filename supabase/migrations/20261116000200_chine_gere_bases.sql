-- Le collègue en Chine peut ajouter, modifier et supprimer les phares des bases Chine
-- (Base Chine, Base 2, Commande phare). Jamais les prix ni le fournisseur (phares_prive reste réservé à l'admin).
drop policy if exists "phares chine ajout" on public.phares;
drop policy if exists "phares chine modif" on public.phares;
drop policy if exists "phares chine suppr" on public.phares;
create policy "phares chine ajout" on public.phares for insert
  with check (public.mon_role() = 'chine' and chine);
create policy "phares chine modif" on public.phares for update
  using (public.mon_role() = 'chine' and chine) with check (public.mon_role() = 'chine' and chine);
create policy "phares chine suppr" on public.phares for delete
  using (public.mon_role() = 'chine' and chine);
