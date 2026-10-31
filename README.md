# Yacout by Graceful : landing pages

Site statique (HTML, CSS et JavaScript sans framework). Aucune base de données ni étape de build.

## Pages

| Page | Fichier | URL |
|---|---|---|
| Page complète, français | `index.html` | https://form.graceful-agency.ma/ |
| Page complète, arabe | `ar/index.html` | https://form.graceful-agency.ma/ar/ |
| Express, français | `express/index.html` | https://form.graceful-agency.ma/express/ |
| Express, arabe | `ar/express/index.html` | https://form.graceful-agency.ma/ar/express/ |
| Vidéo, français | `video/index.html` | https://form.graceful-agency.ma/video/ |
| Vidéo, arabe | `ar/video/index.html` | https://form.graceful-agency.ma/ar/video/ |
| Remerciement, français | `merci/index.html` | https://form.graceful-agency.ma/merci/ |
| Remerciement, arabe | `ar/merci/index.html` | https://form.graceful-agency.ma/ar/merci/ |
| Mentions légales | `mentions-legales/index.html` | https://form.graceful-agency.ma/mentions-legales/ |
| Politique de confidentialité | `politique-de-confidentialite/index.html` | https://form.graceful-agency.ma/politique-de-confidentialite/ |

## Mise en ligne

Publier le dossier tel quel sur un hébergement statique, à la racine du domaine `form.graceful-agency.ma`. Il n'y a rien à compiler.

## Configuration

Tout se règle dans `assets/js/config.js` : URL du webhook, URL de l'assistant n8n, ID du Pixel Meta, GA4 et Clarity.

Le Pixel Meta est géré par `assets/js/tracking.js` sur les 10 pages : PageView partout, Lead à l'étape 1 du formulaire uniquement (`event_id` = `lead_id`, pour la déduplication avec l'API Conversions). Pour ne pas ralentir la page, la bibliothèque de Meta est chargée 2 s après le chargement de la page (4 s au plus tard), ou tout de suite au premier appui ou champ touché ; le PageView part à ce moment-là. Un visiteur qui quitte la page avant ne compte donc pas de PageView. Si l'ID change, le modifier dans `config.js` et dans le `<noscript>` en haut du `<body>` de chaque page.

Le webhook reçoit deux POST JSON par lead, reliés par le même `lead_id` :
- `step: 1`, `status: "partiel"` : nom, téléphone au format international (+212…), ville de résidence (`residence`, saisie libre), UTM, fbclid, fbp/fbc, URL, date et heure ;
- `step: 2`, `status: "complete"` : la fiche entière (tous les champs de l'étape 1) + type de bien, objectif et délai.

Les 3 questions de l'étape 2 sont obligatoires : il n'y a pas de lien pour passer l'étape, et « Terminer » refuse l'envoi tant qu'une réponse manque. Le lead reste « partiel » seulement si le visiteur quitte la page sans répondre. Une fois l'étape 1 envoyée, le formulaire reste sur l'étape 2 pendant 7 jours (rechargement, nouvel onglet, retour depuis la publicité). Après « Terminer », la page de remerciement remplace la page dans l'historique : le bouton retour ne ramène pas au formulaire.

Le webhook doit accepter les requêtes CORS venant de `https://form.graceful-agency.ma` (réponse à `OPTIONS` et en-tête `Access-Control-Allow-Origin`). Sans ces en-têtes, le navigateur considère l'envoi comme échoué.

## Assistant n8n (page de remerciement)

La page `merci/` affiche un assistant qui répond aux questions en attendant le conseiller. Il reste masqué tant que `CHAT_WEBHOOK_URL` est vide dans `assets/js/config.js`.

Chaque message envoie en POST JSON : `action: "sendMessage"`, `sessionId` (= `lead_id` du formulaire, pour relier la conversation au lead), `chatInput` (la question) et `metadata` (prénom, type de bien, objectif, délai, ville de résidence). La réponse attendue est `{ "output": "…" }`. Les réponses peuvent contenir du **gras**, des listes `- …` et des liens. Au-delà de 20 questions, la page renvoie vers le conseiller.

## Versions de la page

Ce sont des copies : toute modification (texte, prix, images, sections) est à reporter à la main sur les autres versions.

- **Arabe (`ar/`)** : de droite à gauche, avec `assets/css/rtl.css` en plus (police IBM Plex Sans Arabic auto-hébergée, inversion de la mise en page). `main.js` et `merci.js` choisissent leurs textes selon `<html lang>` ; `data-root` sur `<html>` indique le chemin vers `assets/`. Les réponses du formulaire sont envoyées au webhook avec les mêmes valeurs qu'en français, plus `page_lang` (`fr` ou `ar`). Les pages légales restent en français.
- **Express (`express/`, `ar/express/`)** : versions courtes pour la publicité (hero avec formulaire, Localisation, Paiement, pied de page court), non indexées (`noindex`). Même formulaire et mêmes webhooks ; `page_url` indique la page d'origine du lead, et `data-thanks` sur `<html>` la page de remerciement.
- **Vidéo (`video/`, `ar/video/`)** : versions pour la publicité, non indexées : la vidéo de présentation (VSL), le formulaire et un carrousel de 6 photos des intérieurs. En-tête, formulaire et pied de page sont ceux des versions express. Elles chargent `core.css`, `vsl.css` et `vsl.js`, pas `style.css`.

## Vidéos

- **VSL (versions vidéo)** : la vidéo du conseiller (en darija), `Yacout_Agadir_reel_1080x1920.mp4` compressée en `assets/vid/yacout-vsl-720.mp4` (5,5 Mo) et `yacout-vsl-480.mp4` (2,6 Mo), affiche `assets/img/yacout-vsl-poster-*.webp`. Après le chargement de la page, lecture muette automatique en 480p ; « Activer le son » reprend au début, avec le son, en 720p. Sur connexion lente ou en économie de données, rien n'est téléchargé avant l'appui sur lecture.
- **Hero des pages complète et express** : `assets/vid/yacout-interieur-hero.mp4`, extrait muet de 12 s (200 Ko), chargé après la page, jamais sur connexion lente.
- **« Voir la vidéo du projet »** (section Vue 3D) : `assets/vid/yacout-interieur.mp4`, sans les commandes du navigateur (ni téléchargement, ni vitesse, ni image dans l'image) : appui pour lire ou mettre en pause, barre de progression.

## Carte de localisation

La carte (section « Au cœur d'Agadir ») utilise Leaflet et le fond OpenStreetMap, teinté en CSS. Les positions sont dans le HTML des 4 pages qui ont la carte (complètes et express) :
- la résidence : `data-lat` / `data-lng` de `<div class="map">` (**position approximative** sur le boulevard de la Résistance / Al Moukaouama, à remplacer par la position exacte du terrain, ainsi que le lien « Voir la carte » juste dessous) ;
- les lieux à proximité : `data-lat` / `data-lng` de chaque encadré `.loc-list li`.

Les tuiles viennent directement des serveurs d'OpenStreetMap, qui les tolèrent pour un trafic modeste. Si le trafic devient important, passer à un fournisseur avec clé gratuite (Stadia Maps, MapTiler…) en changeant l'URL des tuiles dans `assets/js/main.js`.

## Vitesse : à garder en tête en modifiant le site

- **CSS en deux fichiers.** `assets/css/core.css` bloque l'affichage : base, en-tête, hero, formulaire, galerie, visionneuse, pied de page court. `assets/css/style.css` contient les sections sous le premier écran ; sur les pages complète et express, il est chargé sans bloquer le premier affichage. Une nouvelle règle pour le haut de page va dans `core.css`, une règle pour une section plus bas dans `style.css`.
- **Sections hors écran.** Galerie, Pourquoi Yacout, Vue 3D, Typologies, Paiement, CTA final, Promoteur et FAQ ne sont mises en page qu'à l'approche (`content-visibility`). Leur hauteur estimée est la variable `--h` (« Sections hors écran », dans `core.css` et `style.css`) : si une section change beaucoup de hauteur, mettre sa valeur à jour.
- **Vue 3D.** 20 images sur 100 sont chargées à l'approche de la section, les 80 autres seulement quand la vue est à l'écran.
- **Images.** En WebP, avec une version réduite pour les téléphones quand l'image est grande.
- **Polices arabes.** Réduites aux caractères arabes utilisés (13 Ko au lieu de 44 Ko par graisse). Les fichiers complets sont dans l'historique Git et dans `Graceful-LP-archive/unused-assets/fonts/`.

## Tester en local

Le serveur de développement et les fichiers de travail ne sont pas dans ce dépôt. Ils sont dans le dossier voisin `Graceful-LP-archive/`, sur le poste de travail : serveur local, fichiers d'origine, pages de choix de design, captures, scripts Higgsfield, message système de l'assistant n8n, images non utilisées.

```
node ../Graceful-LP-archive/server.js
```

Ouvrir ensuite http://localhost:4321. Sur localhost, les leads et l'assistant partent vers de faux webhooks et n'atteignent pas le CRM : les leads s'affichent dans le terminal et s'ajoutent à `Graceful-LP-archive/_dev-leads.jsonl`, l'assistant donne des réponses de test.

Pour tester avec les vrais webhooks (le lead arrive dans le CRM, l'assistant n8n répond vraiment), lancer un second serveur, puis ouvrir http://localhost:4322 :

```
$env:LIVE_WEBHOOKS=1; $env:PORT=4322; node ../Graceful-LP-archive/server.js
```

Dans les deux cas, le Pixel Meta reste actif : le chargement d'une page en local envoie un vrai PageView.
