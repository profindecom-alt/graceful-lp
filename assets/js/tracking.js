/*
 * Tracking : Meta Pixel (PageView partout, Lead à l'étape 1 uniquement),
 * Google Analytics 4 et Microsoft Clarity si leurs IDs sont renseignés.
 *
 * Les bibliothèques (celle de Meta pèse environ 200 Ko compressés) sont chargées après la page, pour ne retarder
 * ni l'affichage ni les premiers appuis. Les événements attendent dans une file (fbq, dataLayer) jusqu'à leur arrivée.
 * Déclencheurs : 2 s après le chargement de la page, 4 s au plus tard, ou tout de suite au premier appui ou champ touché.
 */
(function () {
  var cfg = window.YACOUT_CONFIG || {};
  var pixelId = String(cfg.META_PIXEL_ID || '').trim();
  var ga4Id = String(cfg.GA4_MEASUREMENT_ID || '').trim();
  var clarityId = String(cfg.CLARITY_PROJECT_ID || '').trim();
  var pixelOn = /^\d{6,20}$/.test(pixelId);

  // Meta Pixel (code de base officiel ; le script est inséré plus bas, par loadLibraries)
  if (pixelOn) {
    !function (f) {
      if (f.fbq) return; var n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = [];
    }(window);
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }

  // Google Analytics 4
  if (ga4Id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ga4Id);
  }

  function addScript(src) {
    var t = document.createElement('script');
    t.async = true;
    t.src = src;
    document.head.appendChild(t);
  }

  var librariesLoaded = false;
  function loadLibraries() {
    if (librariesLoaded) return;
    librariesLoaded = true;
    if (pixelOn) addScript('https://connect.facebook.net/en_US/fbevents.js');
    if (ga4Id) addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4Id));
    // Microsoft Clarity
    if (clarityId) {
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      addScript('https://www.clarity.ms/tag/' + clarityId);
    }
  }
  ['pointerdown', 'keydown', 'focusin'].forEach(function (type) {
    window.addEventListener(type, loadLibraries, { once: true, passive: true });
  });
  if (document.readyState === 'complete') setTimeout(loadLibraries, 2000);
  else window.addEventListener('load', function () { setTimeout(loadLibraries, 2000); });
  setTimeout(loadLibraries, 4000);

  window.YacoutTrack = {
    // Seul événement Meta envoyé en plus du PageView.
    // event_id = lead_id pour la déduplication avec l'API Conversions du CRM.
    lead: function (leadId) {
      if (pixelOn && window.fbq) {
        window.fbq('track', 'Lead', { content_name: 'Yacout' }, { eventID: leadId });
      }
      if (ga4Id && window.gtag) {
        window.gtag('event', 'generate_lead', { lead_id: leadId });
      }
    }
  };
})();
