-- Base 2 : la quantité ne compte que dans Commande phare.
-- Les phares de Base 2 qui ne sont pas dans la commande repartent à 1.
update public.phares set quantite = 1 where base2 and not en_commande and quantite > 1;
