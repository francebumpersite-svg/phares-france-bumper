-- Mots de passe des comptes, lisibles seulement par le patron (via la fonction « comptes »)
create table if not exists public.comptes_mdp (
  id uuid primary key references public.profils (id) on delete cascade,
  mot_de_passe text not null,
  maj timestamptz not null default now()
);
alter table public.comptes_mdp enable row level security;
-- Aucune règle : personne ne lit cette table depuis l'appli, seule la fonction serveur y accède.
revoke all on public.comptes_mdp from anon, authenticated;

-- Compte supprimé alors qu'il a déjà enregistré des choses : on le garde caché (pour l'historique)
alter table public.profils add column if not exists supprime boolean not null default false;
