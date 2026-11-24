-- Retire « avant restylage » des modèles et des années de tous les phares (demande du patron)
update public.phares
set modele = nullif(btrim(regexp_replace(regexp_replace(modele, '\s*[·—–,\-]?\s*\(?avant[ -]restylage\)?', '', 'gi'), '\s{2,}', ' ', 'g')), '')
where modele ~* 'avant[ -]restylage';
update public.phares
set annees = nullif(btrim(regexp_replace(regexp_replace(annees, '\s*[·—–,\-]?\s*\(?avant[ -]restylage\)?', '', 'gi'), '\s{2,}', ' ', 'g')), '')
where annees ~* 'avant[ -]restylage';
