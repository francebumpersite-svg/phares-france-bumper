-- Uniquement les produits dont le TITRE contient « phare », jamais de pare-chocs
alter table public.reglages alter column filtre_shopify set default 'title:phare* AND NOT title:pare*';
update public.reglages set filtre_shopify = 'title:phare* AND NOT title:pare*' where filtre_shopify = 'phare*';
