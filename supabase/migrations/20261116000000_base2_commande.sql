-- « Base 2 » : nouvelle liste de phares à acheter en Chine (remplacera la Base Chine)
-- « Commande phare » : phares cochés dans la Base 2 et transférés pour être commandés
alter table public.phares add column if not exists base2 boolean not null default false;
alter table public.phares add column if not exists en_commande boolean not null default false;
