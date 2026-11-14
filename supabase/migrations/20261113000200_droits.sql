-- Droits explicites pour l'API (au cas où l'exposition automatique des tables est désactivée).
-- Les règles RLS restent la vraie protection.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profils, public.reglages, public.phares, public.phares_prive, public.ventes_declarees,
  public.dropship, public.retours, public.shopify_produits, public.synchro
to authenticated;
revoke all on public.config_interne from anon, authenticated;
