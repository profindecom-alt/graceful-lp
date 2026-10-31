/*
 * Configuration de la landing page Yacout.
 * C'est le seul fichier à modifier avant la mise en ligne.
 */
window.YACOUT_CONFIG = {
  // URL qui reçoit chaque étape du formulaire en POST JSON.
  // Webhook n8n des leads : status « partiel » à l'étape 1, « complete » à l'étape 2 (même lead_id).
  GETLEADS_WEBHOOK_URL: 'https://n8n.srv1019025.hstgr.cloud/webhook/068bfced-7752-45d0-9ec4-b523d2022374',

  // Assistant de la page de remerciement : URL du nœud « Chat Trigger » de n8n (mode webhook),
  // ex. 'https://votre-n8n.com/webhook/xxxx/chat'. Laisser vide pour masquer l'assistant.
  // Voir README, section « Assistant n8n ».
  CHAT_WEBHOOK_URL: 'https://n8n.srv1019025.hstgr.cloud/webhook/8db9c2c2-29df-49fd-a070-9ffdca139334',

  // Meta Pixel. Tant que la valeur n'est pas un nombre, le Pixel n'est pas chargé.
  // Le repli sans JavaScript (<noscript>, en haut du <body> de chaque page) contient aussi cet ID.
  META_PIXEL_ID: '1772189427400389',

  // Google Analytics 4 (ex. 'G-XXXXXXXXXX'). Laisser vide pour désactiver.
  GA4_MEASUREMENT_ID: '',

  // Microsoft Clarity (ex. 'abcd1234ef'). Laisser vide pour désactiver.
  CLARITY_PROJECT_ID: '',

  // Tests en local uniquement : sur localhost, les leads et les messages de l'assistant partent
  // vers les faux webhooks du serveur de développement (voir README) au lieu des URL ci-dessus.
  // Sans effet une fois le site en ligne.
  USE_DEV_WEBHOOK_ON_LOCALHOST: true
};
