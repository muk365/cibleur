# Cibleur Prédictif — Marché Caché × Entreprises OETH (20+ salariés)

Application web hybride (**Netlify Functions** + **PHP 8.2 / XAMPP**) croisant les APIs publiques françaises pour identifier les employeurs de **20 salariés et plus** (assujettis OETH / RQTH) ayant un fort potentiel d'embauche et un site web actif vérifié en direct.

## Sources & Architecture
- **France Travail — La Bonne Boîte v2** (`api_labonneboitev2`) : score de potentiel d'embauche par code ROME et périmètre géographique.
- **API Recherche d'entreprises** (`recherche-entreprises.api.gouv.fr` / base SIRENE) : filtrage strict sur les entreprises actives de **20+ salariés**, extraction des dirigeants, données financières et labels RSE (`est_societe_mission`, `est_ess`, `est_achats_responsables`, `egapro_renseigne`).
- **API Géo Communes** (`geo.api.gouv.fr`) : autocomplétion des communes et codes postaux.
- **Vérification Live de site web** : sondage HTTP/SSL concurrent pour filtrer les structures dotées d'un site actif + scan optionnel de page Carrières/Recrutement.

## Déploiement sur Netlify (URL HTTPS en ligne pour `francetravail.io`)
1. Importez ce dépôt GitHub dans **Netlify** (`Add new site` → `Import an existing project`).
2. Aucune commande de build n'est nécessaire (`Publish directory`: `.`, `Functions directory`: `netlify/functions`, déjà configurés via `netlify.toml`).
3. Une fois déployé, utilisez l'URL HTTPS `https://<votre-site>.netlify.app` comme URL d'application dans le portail développeur `francetravail.io`.
4. Dans Netlify (`Site configuration → Environment variables`), ajoutez optionnellement :
   - `FT_CLIENT_ID`
   - `FT_CLIENT_SECRET`
   *(Vous pouvez aussi saisir et tester vos clés directement dans l'icône Réglages de l'interface.)*

## Exécution locale (XAMPP / PHP 8.2)
- Via XAMPP Apache : `http://localhost/cibleur/`
- Via PHP CLI : `php -S 127.0.0.1:8088`
