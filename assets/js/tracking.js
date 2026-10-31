/*
 * Tracking : Meta Pixel (PageView partout, Lead à l'étape 1 uniquement),
 * Google Analytics 4 et Microsoft Clarity si leurs IDs sont renseignés.
 */
(function () {
  var cfg = window.YACOUT_CONFIG || {};
  var pixelId = String(cfg.META_PIXEL_ID || '').trim();
  var ga4Id = String(cfg.GA4_MEASUREMENT_ID || '').trim();
  var clarityId = String(cfg.CLARITY_PROJECT_ID || '').trim();
  var pixelOn = /^\d{6,20}$/.test(pixelId);

  // Meta Pixel (code de base officiel)
  if (pixelOn) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }

  // Google Analytics 4
  if (ga4Id) {
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4Id);
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ga4Id);
  }

  // Microsoft Clarity
  if (clarityId) {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', clarityId);
  }

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
