-- Onglet « Chiffre d'affaires » + notification quotidienne à 18 h 30 (heure de France)
-- Réservé au patron : le tout premier compte administrateur. Ce droit ne se donne pas à quelqu'un d'autre.

alter table public.profils add column if not exists est_patron boolean not null default false;
update public.profils set est_patron = true
where id = (select id from public.profils where role = 'admin' order by created_at limit 1)
  and not exists (select 1 from public.profils where est_patron);

create or replace function public.est_patron() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select est_patron from public.profils where id = auth.uid() and actif and role = 'admin'), false)
$$;
grant execute on function public.est_patron() to authenticated;

-- Téléphones abonnés aux notifications (seulement ceux du patron)
create table if not exists public.push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  appareil text,
  created_at timestamptz not null default now()
);
alter table public.push_abonnements enable row level security;
drop policy if exists "push patron lecture" on public.push_abonnements;
drop policy if exists "push patron ajout" on public.push_abonnements;
drop policy if exists "push patron modif" on public.push_abonnements;
drop policy if exists "push patron suppr" on public.push_abonnements;
create policy "push patron lecture" on public.push_abonnements for select using (public.est_patron() and user_id = auth.uid());
create policy "push patron ajout" on public.push_abonnements for insert with check (public.est_patron() and user_id = auth.uid());
create policy "push patron modif" on public.push_abonnements for update using (public.est_patron() and user_id = auth.uid()) with check (public.est_patron() and user_id = auth.uid());
create policy "push patron suppr" on public.push_abonnements for delete using (public.est_patron() and user_id = auth.uid());
grant select, insert, update, delete on public.push_abonnements to authenticated;

-- Clés d'envoi des notifications (créées par le serveur) et date du dernier envoi
alter table public.config_interne add column if not exists vapid_public text;
alter table public.config_interne add column if not exists vapid_private text;
alter table public.config_interne add column if not exists notif_ca_derniere date;

-- Appel quotidien : 16 h 30 et 17 h 30 UTC = 18 h 30 à Paris en été / en hiver.
-- La fonction n'envoie que s'il est bien 18 h à Paris, et une seule fois par jour.
create or replace function public.lancer_notif_ca() returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select * into c from public.config_interne where id = 1;
  if c.url_sync is null then
    return;
  end if;
  perform net.http_post(
    url := replace(c.url_sync, '/sync-shopify', '/chiffre-affaires'),
    body := '{"action":"notifier"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', c.sync_secret),
    timeout_milliseconds := 60000
  );
end $$;
revoke execute on function public.lancer_notif_ca() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('notif-chiffre-affaires');
exception when others then null;
end $$;
select cron.schedule('notif-chiffre-affaires', '30 16,17 * * *', 'select public.lancer_notif_ca()');
