-- Légende de chaque photo d'un phare (Vue de face, Vue arrière, Fiche connecteur, étiquette…)
alter table public.phares add column if not exists photos_legendes jsonb not null default '{}'::jsonb;
