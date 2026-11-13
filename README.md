# Appli Phares — France Bumper

Appli mobile (icône sur l'écran d'accueil, marche hors connexion) pour :

- les **phares à commander**, avec filtres marque, modèle, année et côté, sélection et liste photos + références envoyée sur WhatsApp ;
- la **base de données des phares de Chine** (photos, fiches fournisseur, références cliquables vers Google, prix d'achat et de vente, marge) ;
- les **ruptures** et **meilleures ventes**, lues sur Shopify **en lecture seule**, avec le pays de vente et les ventes au comptoir ;
- le **dropshipping** (saisi par le vendeur, traité par le collègue en Chine) ;
- les **phares non compatibles** et les **retours client** ;
- 3 accès : administrateur, vendeur, collègue Chine. C'est l'administrateur qui choisit ce que les vendeurs voient.

L'appli ne modifie jamais rien dans Shopify.

---

## Mise en place (une seule fois, environ 30 minutes, de préférence sur ordinateur)

### 1. Shopify : créer l'accès en lecture seule

1. Dans l'admin Shopify : **Paramètres › Applications › Développer des applications › Créer des applications dans le Dev Dashboard**.
2. **Créer une application**, nom : `Appli Phares`.
3. Dans **Versions**, coche uniquement ces droits : `read_products`, `read_inventory`, `read_orders`. Puis **Release**.
4. Si Shopify propose **« Données client protégées »** (Protected customer data), demande-la, sans les champs nom, adresse, e-mail ou téléphone. Elle sert seulement à connaître le **pays** des ventes. Sans elle, l'appli marche quand même, mais sans les pays.
5. **Installer l'application** sur ta boutique.
6. Dans **Paramètres** de l'application, note le **Client ID** et le **Client secret**.
7. Note aussi le nom de ta boutique en `.myshopify.com` (par exemple `france-bumper` pour `france-bumper.myshopify.com`).

### 2. Supabase : la base de données (gratuit)

1. Crée un compte sur [supabase.com](https://supabase.com) (le plus simple : « Continue with GitHub »).
2. **New project** : nom `phares-france-bumper`, région **Europe (Paris ou Frankfurt)**. Choisis un **mot de passe de base de données** et note-le.
3. Note l'**identifiant du projet** (Project ID), qu'on trouve dans **Project Settings › General** (une suite de lettres, ex. `abcdxyzklmno`).
4. **Authentication › Sign In / Providers** : désactive **« Allow new users to sign up »**. Seul l'administrateur crée les comptes, depuis l'appli.
5. Clique sur ton avatar en haut à droite, puis **Account › Access Tokens › Generate new token**, nom `github`. Note le jeton.

### 3. GitHub : mettre l'appli en ligne

1. Dans le dépôt GitHub de l'appli : **Settings › Secrets and variables › Actions › New repository secret**. Crée ces 6 secrets :

| Nom du secret | Valeur |
|---|---|
| `SUPABASE_PROJECT_REF` | l'identifiant du projet Supabase (étape 2.3) |
| `SUPABASE_DB_PASSWORD` | le mot de passe de la base (étape 2.2) |
| `SUPABASE_ACCESS_TOKEN` | le jeton Supabase (étape 2.5) |
| `SHOPIFY_SHOP` | le nom de la boutique, sans `.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | le Client ID Shopify |
| `SHOPIFY_CLIENT_SECRET` | le Client secret Shopify |

2. **Settings › Pages** : dans **Source**, choisis **GitHub Actions**.
3. **Actions › Mise en ligne › Run workflow**. Au bout de 2 à 3 minutes, l'adresse de l'appli s'affiche (du type `https://ton-compte.github.io/phares-france-bumper/`).

### 4. Premier lancement

1. Ouvre l'adresse sur ton téléphone.
2. L'appli te demande de créer ton **compte administrateur** (nom, identifiant, mot de passe).
3. Ajoute l'appli à l'écran d'accueil :
   - **iPhone (Safari)** : bouton Partager, puis **« Sur l'écran d'accueil »** ;
   - **Android (Chrome)** : menu ⋮, puis **« Ajouter à l'écran d'accueil »** ou **« Installer l'application »**.
4. **Réglages › Comptes › + Ajouter un compte** : crée les comptes de tes vendeurs et de ton collègue en Chine. Donne-leur l'adresse, leur identifiant et leur mot de passe.
5. La première synchro Shopify se lance toute seule. Ensuite, elle tourne **toutes les heures**. Tu peux aussi appuyer sur **« Mettre à jour maintenant »** dans Ruptures ou Réglages.

---

## Bon à savoir

- **Hors connexion** : tout ce qui a été affiché une fois reste consultable sans réseau, photos comprises. Les ajouts faits sans réseau partent tout seuls au retour du réseau (« N envois en attente » en haut de l'écran). La première connexion de chaque téléphone doit se faire avec internet.
- **Ventes au comptoir** : le vendeur déclare la vente dans « J'ai vendu un phare » (type Comptoir) et continue de baisser le stock dans Shopify à la main. S'il choisit le produit du site dans la liste, la vente est comptée dans « Comptoir » à côté des pays.
- **Ventes Shopify** : Shopify donne accès aux commandes des **60 derniers jours**, donc les chiffres de ventes portent sur 60 jours.
- **Quels produits sont des phares** : par défaut, tous les produits actifs dont le titre contient un mot qui commence par « phare ». Ça se change dans Réglages.
- **Prix et fournisseurs** : ils sont réservés à l'administrateur. Ils ne sont jamais envoyés au fournisseur dans la liste WhatsApp. Le collègue en Chine voit l'adresse et le téléphone du client **seulement** si le phare part chez le client, et jamais les montants.
- **Supabase gratuit** : un projet sans aucune activité pendant 7 jours est mis en pause. Il suffit de le relancer depuis supabase.com. Avec une utilisation quotidienne, ça n'arrive pas.
- **GitHub Pages gratuit** : le dépôt doit être public. Le code est donc visible, mais il ne contient **aucune donnée ni aucun mot de passe** (ils sont dans les secrets et dans Supabase).

## Modifier l'appli

Chaque modification envoyée sur la branche `main` remet l'appli en ligne automatiquement. La mise à jour arrive toute seule sur les téléphones à la prochaine ouverture. Les données ne sont pas touchées.

Structure du projet :

- `src/` : l'appli (React) ;
- `supabase/migrations/` : la base de données et les règles d'accès ;
- `supabase/functions/` : la gestion des comptes et la synchro Shopify (lecture seule) ;
- `.github/workflows/mise-en-ligne.yml` : la mise en ligne automatique.
