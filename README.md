# Yacout by Graceful : landing pages

Site statique (HTML, CSS et JavaScript sans framework). Aucune base de données ni étape de build.

## Pages

| Page | Fichier | URL |
|---|---|---|
| Page complète, français | `index.html` | https://form.graceful-agency.ma/ |
| Page complète, arabe | `ar/index.html` | https://form.graceful-agency.ma/ar/ |
| Express, français | `express/index.html` | https://form.graceful-agency.ma/express/ |
| Express, arabe | `ar/express/index.html` | https://form.graceful-agency.ma/ar/express/ |
| Remerciement, français | `merci/index.html` | https://form.graceful-agency.ma/merci/ |
| Remerciement, arabe | `ar/merci/index.html` | https://form.graceful-agency.ma/ar/merci/ |
| Mentions légales | `mentions-legales/index.html` | https://form.graceful-agency.ma/mentions-legales/ |
| Politique de confidentialité | `politique-de-confidentialite/index.html` | https://form.graceful-agency.ma/politique-de-confidentialite/ |

## Mise en ligne

Publier le dossier tel quel sur un hébergement statique, à la racine du domaine `form.graceful-agency.ma`. Il n'y a rien à compiler.

## Configuration

Tout se règle dans `assets/js/config.js` : URL du webhook, URL de l'assistant n8n, ID du Pixel Meta, GA4 et Clarity.

Le Pixel Meta est chargé par `assets/js/tracking.js` sur les 8 pages : PageView partout, Lead à l'étape 1 du formulaire uniquement (`event_id` = `lead_id`, pour la déduplication avec l'API Conversions). Si l'ID change, le modifier dans `config.js` et dans le `<noscript>` en haut du `<body>` de chaque page.

Le webhook reçoit deux POST JSON par lead, reliés par le même `lead_id` :
- `step: 1`, `status: "partiel"` : nom, téléphone au format international (+212…), ville de résidence (`residence`, saisie libre), UTM, fbclid, fbp/fbc, URL, date et heure ;
- `step: 2`, `status: "complete"` : la fiche entière (tous les champs de l'étape 1) + type de bien, objectif et délai. Envoyé uniquement si le visiteur clique sur « Terminer » ; s'il passe l'étape, le lead reste « partiel ».

Le webhook doit accepter les requêtes CORS venant de `https://form.graceful-agency.ma` (réponse à `OPTIONS` et en-tête `Access-Control-Allow-Origin`). Sans ces en-têtes, le navigateur considère l'envoi comme échoué.

## Assistant n8n (page de remerciement)

La page `merci/` affiche un assistant qui répond aux questions en attendant le conseiller. Il reste masqué tant que `CHAT_WEBHOOK_URL` est vide dans `assets/js/config.js`.

Chaque message envoie en POST JSON : `action: "sendMessage"`, `sessionId` (= `lead_id` du formulaire, pour relier la conversation au lead), `chatInput` (la question) et `metadata` (prénom, type de bien, objectif, délai, ville de résidence). La réponse attendue est `{ "output": "…" }`. Les réponses peuvent contenir du **gras**, des listes `- …` et des liens. Au-delà de 20 questions, la page renvoie vers le conseiller.

## Versions de la page

Ce sont des copies : toute modification (texte, prix, images, sections) est à reporter à la main sur les autres versions.

- **Arabe (`ar/`)** : de droite à gauche, avec `assets/css/rtl.css` en plus (police IBM Plex Sans Arabic auto-hébergée, inversion de la mise en page). `main.js` et `merci.js` choisissent leurs textes selon `<html lang>` ; `data-root` sur `<html>` indique le chemin vers `assets/`. Les réponses du formulaire sont envoyées au webhook avec les mêmes valeurs qu'en français, plus `page_lang` (`fr` ou `ar`). Les pages légales restent en français.
- **Express (`express/`, `ar/express/`)** : versions courtes pour la publicité (hero avec formulaire, Localisation, Paiement, pied de page court), non indexées (`noindex`). Même formulaire et mêmes webhooks ; `page_url` indique la page d'origine du lead, et `data-thanks` sur `<html>` la page de remerciement.

## Carte de localisation

La carte (section « Au cœur d'Agadir ») utilise Leaflet et le fond OpenStreetMap, teinté en CSS. Les positions sont dans le HTML des 4 pages :
- la résidence : `data-lat` / `data-lng` de `<div class="map">` (**position approximative** sur le boulevard de la Résistance / Al Moukaouama, à remplacer par la position exacte du terrain, ainsi que le lien « Voir la carte » juste dessous) ;
- les lieux à proximité : `data-lat` / `data-lng` de chaque encadré `.loc-list li`.

Les tuiles viennent directement des serveurs d'OpenStreetMap, qui les tolèrent pour un trafic modeste. Si le trafic devient important, passer à un fournisseur avec clé gratuite (Stadia Maps, MapTiler…) en changeant l'URL des tuiles dans `assets/js/main.js`.

## Tester en local

Le serveur de développement et les fichiers de travail ne sont pas dans ce dépôt. Ils sont dans le dossier voisin `Graceful-LP-archive/`, sur le poste de travail : serveur local, fichiers d'origine, pages de choix de design, captures, scripts Higgsfield, message système de l'assistant n8n, images non utilisées.

```
node ../Graceful-LP-archive/server.js
```

Ouvrir ensuite http://localhost:4321. Sur localhost, les leads et l'assistant partent vers de faux webhooks et n'atteignent pas le CRM. Le Pixel Meta, lui, reste actif : le chargement d'une page en local envoie un vrai PageView.
