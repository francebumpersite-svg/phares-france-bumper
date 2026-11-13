-- Synchro Shopify automatique toutes les heures (pg_cron + pg_net)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Réglages internes, invisibles depuis l'appli (aucune règle d'accès = personne sauf le serveur)
create table public.config_interne (
  id int primary key default 1 check (id = 1),
  sync_secret text not null,
  url_sync text
);
alter table public.config_interne enable row level security;
revoke all on public.config_interne from anon, authenticated;
insert into public.config_interne (sync_secret)
values (md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text));

create or replace function public.lancer_synchro() returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select * into c from public.config_interne where id = 1;
  if c.url_sync is null then
    return; -- l'adresse est enregistrée à la première synchro lancée depuis l'appli
  end if;
  perform net.http_post(
    url := c.url_sync,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', c.sync_secret),
    timeout_milliseconds := 150000
  );
end $$;
revoke execute on function public.lancer_synchro() from public, anon, authenticated;

select cron.schedule('synchro-shopify', '17 * * * *', 'select public.lancer_synchro()');
