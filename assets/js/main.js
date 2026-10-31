/*
 * Yacout by Graceful — formulaire en 2 étapes, appels à l'action, barre collante,
 * FAQ et galerie.
 */
(function () {
  'use strict';

  var cfg = window.YACOUT_CONFIG || {};
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var WEBHOOK_URL = (isLocal && cfg.USE_DEV_WEBHOOK_ON_LOCALHOST) ? '/__dev/webhook' : cfg.GETLEADS_WEBHOOK_URL;
  var THANK_YOU_URL = document.documentElement.getAttribute('data-thanks') || 'merci/'; // pages /express/ : data-thanks="../merci/"
  var SEND_TIMEOUT_MS = 15000;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Langue : page française (/) ou arabe (/ar/, <html lang="ar" dir="rtl" data-root="../">) ----------
  var LANG = document.documentElement.lang === 'ar' ? 'ar' : 'fr';
  var RTL = document.documentElement.dir === 'rtl';
  var ROOT = document.documentElement.getAttribute('data-root') || ''; // chemin vers assets/ depuis la page
  var TXT = {
    fr: {
      phoneMissing: 'Indiquez votre numéro WhatsApp.',
      phoneMa: 'Numéro invalide : 10 chiffres commençant par 06 ou 07.',
      phoneOtherCode: 'Indiquez le numéro complet avec l\'indicatif (ex. +33 6 12 34 56 78).',
      phoneOther: 'Numéro invalide. Vérifiez l\'indicatif et le numéro.',
      phoneBad: 'Numéro invalide. Vérifiez le numéro saisi.',
      name: 'Indiquez votre nom complet.',
      city: 'Indiquez votre ville de résidence.',
      sendError: 'L\'envoi n\'a pas abouti. Vérifiez votre connexion puis réessayez : vos informations sont conservées.',
      sending: 'Envoi en cours…',
      phOther: '+ indicatif et numéro',
      phMobile: 'Numéro de mobile',
      videoCaption: 'Visite intérieure · vidéo non contractuelle',
      planAlt: 'Plan d\'étage de la résidence Yacout, 37 lots numérotés',
      planCaption: 'Plan d\'étage · document non contractuel',
      mapHome: 'Résidence <em>Yacout</em>',
      illustration: ' · illustration',
      slideOf: ' / ',
      why: ['Emplacement', 'Prix', 'Paiement', 'Parking'],
      countries: null
    },
    ar: {
      phoneMissing: 'أدخلوا رقم واتساب الخاص بكم.',
      phoneMa: 'رقم غير صحيح: 10 أرقام تبدأ بـ 06 أو 07.',
      phoneOtherCode: 'أدخلوا الرقم كاملاً مع رمز البلد (مثال: ‎+33 6 12 34 56 78).',
      phoneOther: 'رقم غير صحيح. تحققوا من رمز البلد والرقم.',
      phoneBad: 'رقم غير صحيح. تحققوا من الرقم المُدخل.',
      name: 'أدخلوا اسمكم الكامل.',
      city: 'أدخلوا مدينة إقامتكم.',
      sendError: 'لم يتم الإرسال. تحققوا من اتصالكم بالإنترنت ثم أعيدوا المحاولة: معلوماتكم محفوظة.',
      sending: 'جارٍ الإرسال…',
      phOther: '+ رمز البلد والرقم',
      phMobile: 'رقم الهاتف المحمول',
      videoCaption: 'جولة داخلية · فيديو غير تعاقدي',
      planAlt: 'تصميم الطابق في إقامة ياقوت، 37 وحدة مرقّمة',
      planCaption: 'تصميم الطابق · وثيقة غير تعاقدية',
      mapHome: 'إقامة <em>ياقوت</em>',
      illustration: ' · صورة توضيحية',
      slideOf: ' من ',
      why: ['الموقع', 'السعر', 'الأداء', 'المرآب'],
      countries: {
        MA: 'المغرب', FR: 'فرنسا', ES: 'إسبانيا', BE: 'بلجيكا', NL: 'هولندا', DE: 'ألمانيا', IT: 'إيطاليا',
        GB: 'المملكة المتحدة', CH: 'سويسرا', CA: 'كندا / الولايات المتحدة', AE: 'الإمارات العربية المتحدة',
        SA: 'السعودية', QA: 'قطر', OTHER: 'بلد آخر'
      }
    }
  }[LANG];

  // ---------- Stockage (peut être indisponible : navigation privée, etc.) ----------
  function storageGet(key, session) {
    try { var v = (session ? sessionStorage : localStorage).getItem(key); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function storageSet(key, value, session) {
    try { (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value)); } catch (e) { /* ignoré */ }
  }
  function storageRemove(key, session) {
    try { (session ? sessionStorage : localStorage).removeItem(key); } catch (e) { /* ignoré */ }
  }

  var DRAFT_KEY = 'yacout_draft';      // ce que le visiteur a saisi (localStorage)
  var PENDING_KEY = 'yacout_pending';  // envois échoués, renvoyés au prochain chargement (localStorage)
  var LEAD_KEY = 'yacout_lead';        // état du lead pour cette visite (sessionStorage)
  var ATTR_KEY = 'yacout_attr';        // UTM et fbclid de la visite (sessionStorage)
  var FIRST_NAME_KEY = 'yacout_first_name';
  var THANKS_KEY = 'yacout_thanks';    // lead_id, prénom et réponses de l'étape 2 pour la page merci (sessionStorage)

  // Valeurs en mémoire : servent de repli si le stockage du navigateur est bloqué.
  var draft = storageGet(DRAFT_KEY) || {};
  var lead = storageGet(LEAD_KEY, true) || {};
  function saveDraft() { storageSet(DRAFT_KEY, draft); }
  function saveLead() { storageSet(LEAD_KEY, lead, true); }

  // ---------- Attribution (UTM, fbclid) ----------
  var ATTR_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  var attribution = (function () {
    var saved = storageGet(ATTR_KEY, true) || {};
    var params = new URLSearchParams(location.search);
    var hasNew = ATTR_FIELDS.some(function (k) { return params.get(k); });
    if (hasNew || !saved.landing_url) {
      saved = { landing_url: location.href };
      ATTR_FIELDS.forEach(function (k) { saved[k] = params.get(k) || ''; });
      storageSet(ATTR_KEY, saved, true);
    }
    return saved;
  })();

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function localDateTime() {
    try {
      return new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
    } catch (e) { return new Date().toString(); }
  }

  // ---------- Pays et validation du numéro ----------
  var COUNTRIES = [
    ['MA', 'Maroc', '212'],
    ['FR', 'France', '33'],
    ['ES', 'Espagne', '34'],
    ['BE', 'Belgique', '32'],
    ['NL', 'Pays-Bas', '31'],
    ['DE', 'Allemagne', '49'],
    ['IT', 'Italie', '39'],
    ['GB', 'Royaume-Uni', '44'],
    ['CH', 'Suisse', '41'],
    ['CA', 'Canada / États-Unis', '1'],
    ['AE', 'Émirats arabes unis', '971'],
    ['SA', 'Arabie saoudite', '966'],
    ['QA', 'Qatar', '974'],
    ['OTHER', 'Autre pays', '']
  ];
  function countryByIso(iso) {
    for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i][0] === iso) return COUNTRIES[i];
    return COUNTRIES[0];
  }

  function validatePhone(iso, raw) {
    var value = String(raw || '').trim();
    var digits = value.replace(/\D/g, '');
    if (!digits) return { error: TXT.phoneMissing };
    var country = countryByIso(iso);
    var code = country[2];

    if (iso === 'MA') {
      if (digits.indexOf('00212') === 0) digits = digits.slice(5);
      else if (digits.indexOf('212') === 0 && digits.length === 12) digits = digits.slice(3);
      if (/^[67]\d{8}$/.test(digits)) digits = '0' + digits;
      if (/^0[67]\d{8}$/.test(digits)) return { e164: '+212' + digits.slice(1), code: '+212' };
      return { error: TXT.phoneMa };
    }

    if (iso === 'OTHER') {
      if (!/^(\+|00)/.test(value)) return { error: TXT.phoneOtherCode };
      if (digits.indexOf('00') === 0) digits = digits.slice(2);
      if (digits.length < 8 || digits.length > 15) return { error: TXT.phoneOther };
      return { e164: '+' + digits, code: '' };
    }

    if (digits.indexOf('00' + code) === 0) digits = digits.slice(2 + code.length);
    else if (value.charAt(0) === '+' && digits.indexOf(code) === 0) digits = digits.slice(code.length);
    digits = digits.replace(/^0+/, '');
    if (digits.length < 6 || digits.length > 12) return { error: TXT.phoneBad };
    return { e164: '+' + code + digits, code: '+' + code };
  }

  function validateName(raw) {
    var v = String(raw || '').replace(/\s+/g, ' ').trim();
    if (v.length < 2 || !/[A-Za-zÀ-ÿ؀-ۿ]/.test(v)) return { error: TXT.name };
    return { value: v };
  }

  function validateCity(raw) {
    var v = String(raw || '').replace(/\s+/g, ' ').trim();
    if (v.length < 2 || !/[A-Za-zÀ-ÿ؀-ۿ]/.test(v)) return { error: TXT.city };
    return { value: v };
  }

  function firstNameOf(fullName) {
    var first = String(fullName || '').trim().split(' ')[0] || '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
  }

  // ---------- Envoi au webhook ----------
  function send(payload) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, SEND_TIMEOUT_MS) : null;
    return fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  // Envois échoués : gardés en local et renvoyés au prochain chargement de page.
  function pendingKeyOf(p) { return p.lead_id + ':' + p.step; }
  function addPending(payload) {
    var list = (storageGet(PENDING_KEY) || []).filter(function (p) { return pendingKeyOf(p) !== pendingKeyOf(payload); });
    list.push(payload);
    storageSet(PENDING_KEY, list);
  }
  function removePending(payload) {
    var list = (storageGet(PENDING_KEY) || []).filter(function (p) { return pendingKeyOf(p) !== pendingKeyOf(payload); });
    if (list.length) storageSet(PENDING_KEY, list); else storageRemove(PENDING_KEY);
  }
  function flushPending() {
    var list = storageGet(PENDING_KEY) || [];
    list.forEach(function (payload) {
      payload.retried_at = new Date().toISOString();
      send(payload).then(function () {
        removePending(payload);
        if (payload.step === 1 && window.YacoutTrack) window.YacoutTrack.lead(payload.lead_id);
      }, function () { /* on réessaiera au prochain chargement */ });
    });
  }

  // ---------- Formulaires ----------
  // Le formulaire du bas de page est une copie de celui du hero (un seul code HTML à maintenir).
  Array.prototype.forEach.call(document.querySelectorAll('[data-form-slot]'), function (slot) {
    var source = document.querySelector('.lead-form[data-location="hero"]');
    if (!source) return;
    var prefix = slot.getAttribute('data-form-slot');
    var clone = source.cloneNode(true);
    clone.setAttribute('data-location', prefix);
    Array.prototype.forEach.call(clone.querySelectorAll('[id], [for], [aria-describedby]'), function (el) {
      ['id', 'for', 'aria-describedby'].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (v && v.indexOf('hero-') === 0) el.setAttribute(attr, prefix + v.slice(4));
      });
    });
    // Sous le titre de section h2, les titres du formulaire deviennent des h3.
    Array.prototype.forEach.call(clone.querySelectorAll('h2.form-title'), function (h2) {
      var h3 = document.createElement('h3');
      Array.prototype.forEach.call(h2.attributes, function (a) { h3.setAttribute(a.name, a.value); });
      h3.innerHTML = h2.innerHTML;
      h2.parentNode.replaceChild(h3, h2);
    });
    slot.appendChild(clone);
  });

  var forms = Array.prototype.slice.call(document.querySelectorAll('.lead-form'));
  var STEP2_FIELDS = ['property_type', 'goal', 'timeline'];
  var SEND_ERROR = TXT.sendError;

  function q(form, sel) { return form.querySelector(sel); }

  function fillCountrySelect(select) {
    COUNTRIES.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c[0];
      opt.textContent = (TXT.countries ? TXT.countries[c[0]] : c[1]) + (c[2] ? ' (+' + c[2] + ')' : '');
      select.appendChild(opt);
    });
  }

  function updateCountryUi(form) {
    var iso = q(form, '[data-country]').value;
    var c = countryByIso(iso);
    q(form, '.cc-label').textContent = c[2] ? '+' + c[2] : '+…';
    var phone = q(form, 'input[name="phone"]');
    phone.placeholder = iso === 'MA' ? '06 12 34 56 78' : (iso === 'OTHER' ? TXT.phOther : TXT.phMobile);
    phone.autocomplete = iso === 'OTHER' ? 'tel' : 'tel-national';
  }

  // Les deux formulaires (haut et bas de page) partagent les mêmes valeurs.
  function syncForms(except) {
    forms.forEach(function (form) {
      if (form === except) return;
      var name = q(form, 'input[name="full_name"]');
      var phone = q(form, 'input[name="phone"]');
      var country = q(form, '[data-country]');
      var city = q(form, 'input[name="residence"]');
      if (document.activeElement !== name) name.value = draft.full_name || '';
      if (document.activeElement !== phone) phone.value = draft.phone || '';
      if (document.activeElement !== city) city.value = draft.residence || '';
      country.value = draft.phone_country || 'MA';
      updateCountryUi(form);
    });
    forms.forEach(function (form) {
      STEP2_FIELDS.forEach(function (field) {
        Array.prototype.forEach.call(form.querySelectorAll('input[name="' + field + '"]'), function (r) {
          r.checked = draft[field] === r.value;
        });
      });
      var chosen = q(form, '[data-chosen]');
      if (draft.property_type) {
        // valeur envoyée au CRM (toujours en français) ; libellé affiché dans la langue de la page
        var label = draft.property_type;
        Array.prototype.forEach.call(form.querySelectorAll('input[name="property_type"]'), function (r) {
          if (r.value === draft.property_type && r.nextElementSibling) label = r.nextElementSibling.textContent;
        });
        q(form, '[data-chosen-label]').textContent = label;
        chosen.hidden = false;
      } else {
        chosen.hidden = true;
      }
    });
  }

  function setBusy(button, busy) {
    var label = button.querySelector('[data-label]') || button;
    if (busy) { button.setAttribute('data-idle-label', label.textContent); label.textContent = TXT.sending; }
    else if (button.getAttribute('data-idle-label')) label.textContent = button.getAttribute('data-idle-label');
    button.disabled = busy;
  }

  // Maroc : affiche le numéro par paires (06 12 34 56 78) pendant la saisie.
  function formatMoroccanPhone(input) {
    var v = input.value;
    if (/[^\d\s]/.test(v) || input.selectionStart !== v.length) return;
    var d = v.replace(/\D/g, '').slice(0, 10);
    var out = d.replace(/(\d{2})(?=\d)/g, '$1 ');
    if (out !== v) input.value = out;
  }

  function setFieldError(input, errEl, message) {
    errEl.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  function showStep2(focusForm) {
    forms.forEach(function (form) {
      q(form, '[data-step="1"]').hidden = true;
      q(form, '[data-step="2"]').hidden = false;
    });
    if (focusForm) {
      var title = q(focusForm, '[data-step2-title]');
      title.focus({ preventScroll: true });
      var top = focusForm.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) {
        focusForm.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }

  function goToThankYou() {
    // Contexte pour l'assistant de la page de remerciement (même onglet uniquement)
    var context = { lead_id: lead.lead_id || '', first_name: lead.first_name || '' };
    STEP2_FIELDS.forEach(function (f) { context[f] = draft[f] || ''; });
    context.residence = draft.residence || '';
    storageSet(THANKS_KEY, context, true);
    storageRemove(DRAFT_KEY);
    storageRemove(LEAD_KEY, true);
    location.href = THANK_YOU_URL;
  }

  function buildStep1Payload(form, name, phoneResult, city) {
    var fbclid = attribution.fbclid || '';
    var payload = {
      event: 'yacout_lead_step1',
      step: 1,
      status: 'partiel', // formulaire de contact envoyé, questions de l'étape 2 pas encore remplies
      lead_id: lead.lead_id,
      project: 'Yacout',
      full_name: name,
      first_name: firstNameOf(name),
      phone: phoneResult.e164,
      phone_country: draft.phone_country || 'MA',
      phone_country_code: phoneResult.code,
      phone_as_typed: draft.phone || '',
      residence: city,
      property_type: draft.property_type || '',
      form_location: form.getAttribute('data-location'),
      page_lang: LANG,
      page_url: location.href,
      landing_url: attribution.landing_url || location.href,
      referrer: document.referrer || '',
      submitted_at: new Date().toISOString(),
      submitted_at_local: localDateTime(),
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc') || (fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : '')
    };
    ATTR_FIELDS.forEach(function (k) { payload[k] = attribution[k] || ''; });
    return payload;
  }

  function onStep1Submit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var nameInput = q(form, 'input[name="full_name"]');
    var phoneInput = q(form, 'input[name="phone"]');
    var cityInput = q(form, 'input[name="residence"]');
    var nameErr = document.getElementById(nameInput.getAttribute('aria-describedby'));
    var phoneErr = document.getElementById(phoneInput.getAttribute('aria-describedby'));
    var cityErr = document.getElementById(cityInput.getAttribute('aria-describedby'));
    var status = q(form, '[data-status]');
    var button = q(form, '[data-submit]');
    if (button.disabled) return;

    var nameRes = validateName(nameInput.value);
    var phoneRes = validatePhone(q(form, '[data-country]').value, phoneInput.value);
    var cityRes = validateCity(cityInput.value);
    setFieldError(nameInput, nameErr, nameRes.error);
    setFieldError(phoneInput, phoneErr, phoneRes.error);
    setFieldError(cityInput, cityErr, cityRes.error);
    status.textContent = '';
    if (nameRes.error || phoneRes.error || cityRes.error) {
      (nameRes.error ? nameInput : phoneRes.error ? phoneInput : cityInput).focus();
      return;
    }

    // Un même lead_id est réutilisé tant que l'étape 1 n'a pas abouti (renvois sans doublon).
    if (!lead.lead_id || lead.step1_sent) lead = { lead_id: uuid() };
    lead.first_name = firstNameOf(nameRes.value);
    saveLead();

    var payload = buildStep1Payload(form, nameRes.value, phoneRes, cityRes.value);
    lead.step1 = payload; // repris tel quel dans l'envoi « complete » de l'étape 2
    saveLead();
    setBusy(button, true);

    send(payload).then(function () {
      removePending(payload);
      lead.step1_sent = true;
      saveLead();
      storageSet(FIRST_NAME_KEY, lead.first_name, true);
      if (window.YacoutTrack) window.YacoutTrack.lead(lead.lead_id);
      setBusy(button, false);
      showStep2(form);
    }, function () {
      addPending(payload);
      setBusy(button, false);
      status.textContent = SEND_ERROR;
    });
  }

  function onFinish(form) {
    var button = q(form, '[data-finish]');
    var status = q(form, '[data-status2]');
    if (button.disabled) return;
    // Fiche complète : toutes les infos de l'étape 1 (nom, téléphone, ville, UTM…) + les réponses de l'étape 2
    var payload = {};
    var step1 = lead.step1 || {};
    for (var k in step1) if (Object.prototype.hasOwnProperty.call(step1, k)) payload[k] = step1[k];
    payload.event = 'yacout_lead_step2';
    payload.step = 2;
    payload.status = 'complete';
    payload.lead_id = lead.lead_id;
    payload.project = 'Yacout';
    payload.form_location = form.getAttribute('data-location');
    payload.page_lang = LANG;
    payload.page_url = location.href;
    payload.submitted_at = new Date().toISOString();
    payload.submitted_at_local = localDateTime();
    STEP2_FIELDS.forEach(function (f) { payload[f] = draft[f] || ''; });
    payload.residence = draft.residence || step1.residence || '';

    setBusy(button, true);
    status.textContent = '';
    send(payload).then(function () {
      removePending(payload);
      goToThankYou();
    }, function () {
      addPending(payload);
      setBusy(button, false);
      status.textContent = SEND_ERROR;
    });
  }

  forms.forEach(function (form) {
    fillCountrySelect(q(form, '[data-country]'));

    form.addEventListener('submit', onStep1Submit);

    q(form, 'input[name="full_name"]').addEventListener('input', function (e) {
      draft.full_name = e.target.value; saveDraft(); syncForms(form);
      if (e.target.getAttribute('aria-invalid')) setFieldError(e.target, document.getElementById(e.target.getAttribute('aria-describedby')), '');
    });
    q(form, 'input[name="phone"]').addEventListener('input', function (e) {
      if (q(form, '[data-country]').value === 'MA') formatMoroccanPhone(e.target);
      draft.phone = e.target.value; saveDraft(); syncForms(form);
      if (e.target.getAttribute('aria-invalid')) setFieldError(e.target, document.getElementById(e.target.getAttribute('aria-describedby')), '');
    });
    q(form, 'input[name="residence"]').addEventListener('input', function (e) {
      draft.residence = e.target.value; saveDraft(); syncForms(form);
      if (e.target.getAttribute('aria-invalid')) setFieldError(e.target, document.getElementById(e.target.getAttribute('aria-describedby')), '');
    });
    q(form, '[data-country]').addEventListener('change', function (e) {
      draft.phone_country = e.target.value; saveDraft(); updateCountryUi(form); syncForms(form);
    });
    STEP2_FIELDS.forEach(function (field) {
      Array.prototype.forEach.call(form.querySelectorAll('input[name="' + field + '"]'), function (r) {
        r.addEventListener('change', function () { draft[field] = r.value; saveDraft(); syncForms(form); });
      });
    });

    q(form, '[data-finish]').addEventListener('click', function () { onFinish(form); });
    q(form, '[data-skip]').addEventListener('click', goToThankYou);
  });

  syncForms(null);
  if (lead.step1_sent) showStep2(null);
  flushPending();

  // ---------- Appels à l'action : tous ramènent au formulaire ----------
  var formAnchor = document.getElementById('formulaire');
  var lightbox = document.querySelector('[data-lightbox]');
  Array.prototype.forEach.call(document.querySelectorAll('[data-cta]'), function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var type = link.getAttribute('data-type');
      if (type) { draft.property_type = type; saveDraft(); syncForms(null); }
      if (lightbox && lightbox.open) lightbox.close();
      scrollToForm();
    });
  });

  // Formulaire déjà affiché (ex. celui des chiffres géants) : on n'envoie pas le visiteur en haut de page.
  function formOnScreen() {
    return forms.filter(function (f) {
      if (!f.offsetParent) return false;
      var r = f.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) return false;
      var slide = f.closest('.giant-slide');
      return !slide || slide.style.visibility !== 'hidden' && parseFloat(slide.style.opacity || 1) > .5;
    })[0];
  }

  function scrollToForm() {
    var shown = formOnScreen();
    if (shown) {
      var field = shown.querySelector('[data-step="1"]:not([hidden]) input:not([type="hidden"])');
      if (field) { field.focus({ preventScroll: true }); return; }
    }
    var behavior = reduceMotion ? 'auto' : 'smooth';
    // Sur ordinateur, le formulaire est collant dans le hero : on remonte en haut de page.
    if (window.matchMedia('(min-width: 1024px)').matches) window.scrollTo({ top: 0, behavior: behavior });
    else formAnchor.scrollIntoView({ behavior: behavior, block: 'start' });
    formAnchor.focus({ preventScroll: true });
  }

  // ---------- Barre collante mobile ----------
  // Cachée tant que le visiteur n'a pas dépassé le formulaire du hero (arrivée, retour en haut),
  // et quand un formulaire est à l'écran.
  var sticky = document.querySelector('[data-sticky]');
  var heroForm = document.getElementById('formulaire');
  if (sticky && heroForm && 'IntersectionObserver' in window) {
    var visible = new Set();
    var passedForm = false;
    var updateSticky = function () { sticky.classList.toggle('is-hidden', !passedForm || visible.size > 0); };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
      updateSticky();
    }, { threshold: 0.3 });
    forms.forEach(function (f) { io.observe(f); });
    new IntersectionObserver(function (entries) {
      var en = entries[0];
      // formulaire sorti par le haut de l'écran : le visiteur l'a dépassé
      passedForm = !en.isIntersecting && en.boundingClientRect.top < 0;
      updateSticky();
    }).observe(heroForm);
  } else if (sticky) {
    sticky.classList.remove('is-hidden');
  }

  // ---------- FAQ : une seule question ouverte à la fois ----------
  var faqItems = Array.prototype.slice.call(document.querySelectorAll('[data-faq] details'));
  faqItems.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      faqItems.forEach(function (o) { if (o !== d && o.open) o.open = false; });
    });
  });

  // ---------- Galerie : carrousel mobile (compteur et flèches) ----------
  var gallery = document.querySelector('[data-gallery]');
  var galleryItems = gallery ? Array.prototype.slice.call(gallery.children) : [];
  var counter = document.querySelector('[data-gallery-count]');
  // De droite à gauche (page arabe) : la première image est à droite, scrollLeft va de 0 à une valeur négative.
  function currentSlide() {
    var gRect = gallery.getBoundingClientRect();
    var best = 0, bestDist = Infinity;
    galleryItems.forEach(function (item, i) {
      var r = item.getBoundingClientRect();
      var dist = RTL ? Math.abs(r.right - gRect.right) : Math.abs(r.left - gRect.left);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    if (Math.abs(gallery.scrollLeft) + gallery.clientWidth >= gallery.scrollWidth - 4) best = galleryItems.length - 1;
    return best;
  }
  function goToSlide(i) {
    var item = galleryItems[Math.max(0, Math.min(galleryItems.length - 1, i))];
    var behavior = reduceMotion ? 'auto' : 'smooth';
    if (RTL) {
      var delta = item.getBoundingClientRect().right - (gallery.getBoundingClientRect().right - parseFloat(getComputedStyle(gallery).paddingRight));
      gallery.scrollTo({ left: gallery.scrollLeft + delta, behavior: behavior });
      return;
    }
    gallery.scrollTo({ left: item.offsetLeft - parseFloat(getComputedStyle(gallery).paddingLeft), behavior: behavior });
  }
  if (gallery && counter) {
    var ticking = false;
    gallery.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; counter.textContent = (currentSlide() + 1) + ' / ' + galleryItems.length; });
    }, { passive: true });
    document.querySelector('[data-gallery-prev]').addEventListener('click', function () { goToSlide(currentSlide() - 1); });
    document.querySelector('[data-gallery-next]').addEventListener('click', function () { goToSlide(currentSlide() + 1); });
  }

  // ---------- Visionneuse plein écran (galerie et plan) ----------
  var lbImg = lightbox && lightbox.querySelector('[data-lb-img]');
  var lbCaption = lightbox && lightbox.querySelector('[data-lb-caption]');
  var lbIndex = 0;
  var slides = galleryItems.map(function (item) {
    var img = item.querySelector('img');
    return { full: img.getAttribute('src'), alt: img.alt, caption: item.querySelector('.g-cap').textContent };
  });
  function setLightboxImage(src, alt) {
    if (lbImg.getAttribute('src') === src) return;
    lbImg.classList.add('is-loading');
    lbImg.onload = function () { lbImg.classList.remove('is-loading'); };
    lbImg.src = src; lbImg.alt = alt;
  }
  function showSlide(i) {
    lbIndex = (i + slides.length) % slides.length;
    var s = slides[lbIndex];
    setLightboxImage(s.full, s.alt);
    lbCaption.textContent = s.caption + ' · ' + (lbIndex + 1) + TXT.slideOf + slides.length;
  }
  var lbVideo = lightbox && lightbox.querySelector('[data-lb-video]');
  function stopLightboxVideo() {
    if (!lbVideo) return;
    lbVideo.pause();
    lbVideo.hidden = true;
    lightbox.classList.remove('is-video');
  }
  function openVideo() {
    if (!lightbox || !lbVideo || typeof lightbox.showModal !== 'function') return;
    lightbox.classList.remove('is-plan');
    lightbox.classList.add('is-video');
    lbCaption.textContent = TXT.videoCaption;
    if (!lbVideo.getAttribute('src')) lbVideo.src = ROOT + 'assets/vid/yacout-interieur.mp4';
    lbVideo.hidden = false;
    lightbox.showModal();
    var p = lbVideo.play();
    if (p && p.catch) p.catch(function () { /* lecture manuelle via les contrôles */ });
  }
  function openLightbox(key) {
    if (!lightbox || typeof lightbox.showModal !== 'function') return;
    stopLightboxVideo();
    if (key === 'plan') {
      lightbox.classList.add('is-plan');
      setLightboxImage(ROOT + 'assets/img/plan-yacout.webp', TXT.planAlt);
      lbCaption.textContent = TXT.planCaption;
    } else {
      lightbox.classList.remove('is-plan');
      showSlide(parseInt(key, 10) || 0);
    }
    lightbox.showModal();
  }
  if (lightbox) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-zoom]'), function (el) {
      el.addEventListener('click', function () { openLightbox(el.getAttribute('data-zoom')); });
    });
    lightbox.querySelector('[data-lb-close]').addEventListener('click', function () { lightbox.close(); });
    lightbox.querySelector('[data-lb-prev]').addEventListener('click', function () { showSlide(lbIndex - 1); });
    lightbox.querySelector('[data-lb-next]').addEventListener('click', function () { showSlide(lbIndex + 1); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-video-open]'), function (el) {
      el.addEventListener('click', openVideo);
    });
    lightbox.addEventListener('close', stopLightboxVideo);
    lightbox.addEventListener('keydown', function (e) {
      if (lightbox.classList.contains('is-plan') || lightbox.classList.contains('is-video')) return;
      // de droite à gauche, la flèche gauche avance
      if (e.key === 'ArrowLeft') showSlide(lbIndex + (RTL ? 1 : -1));
      if (e.key === 'ArrowRight') showSlide(lbIndex + (RTL ? -1 : 1));
    });
    // Glisser pour changer d'image
    var startX = null;
    lightbox.addEventListener('touchstart', function (e) { startX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      if (startX === null || lightbox.classList.contains('is-plan') || lightbox.classList.contains('is-video')) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) showSlide(lbIndex + ((dx < 0) !== RTL ? 1 : -1));
      startX = null;
    }, { passive: true });
    // Clic sur le fond : fermer
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox || e.target.hasAttribute('data-lb-stage')) lightbox.close(); });
  }

  // ---------- Typologies : onglets Studio / 2 chambres et vignettes photo ----------
  var typesBox = document.querySelector('[data-types]');
  if (typesBox) {
    var typeTabs = Array.prototype.slice.call(typesBox.querySelectorAll('[role="tab"]'));
    var typePanels = typeTabs.map(function (tab) { return document.getElementById(tab.getAttribute('aria-controls')); });
    var selectType = function (i, focus) {
      typeTabs.forEach(function (tab, k) {
        var on = k === i;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        typePanels[k].hidden = !on;
      });
      if (focus) typeTabs[i].focus();
    };
    typeTabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { selectType(i); });
      tab.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); selectType((i + (e.key === 'ArrowRight' ? 1 : typeTabs.length - 1)) % typeTabs.length, true); }
      });
    });
    selectType(0);
    // Vignettes : la grande photo et sa légende changent en fondu
    typePanels.forEach(function (panel) {
      var img = panel.querySelector('.type-img'), cap = panel.querySelector('.type-cap');
      var thumbs = Array.prototype.slice.call(panel.querySelectorAll('.type-thumbs button'));
      thumbs.forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.classList.contains('is-on')) return;
          thumbs.forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
          var swap = function () {
            img.onload = function () { img.classList.remove('is-out'); };
            img.srcset = b.getAttribute('data-srcset'); img.src = b.getAttribute('data-src'); img.alt = b.getAttribute('data-alt');
            cap.textContent = b.getAttribute('data-label') + TXT.illustration;
            if (img.complete) img.classList.remove('is-out');
          };
          if (reduceMotion) { swap(); return; }
          img.classList.add('is-out');
          setTimeout(swap, 200);
        });
      });
    });
  }

  // ---------- Carte de localisation ----------
  // Leaflet (auto-hébergé) n'est chargé qu'à l'approche de la section. Fond OpenStreetMap teinté en CSS ;
  // la résidence vient de data-lat/data-lng de .map, les lieux de data-lat/data-lng des encadrés « À proximité ».
  var mapBox = document.querySelector('[data-map]');
  function escapeHtml(t) { return t.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function initMap() {
    if (!window.L || mapBox.classList.contains('is-ready')) return;
    var L = window.L;
    var home = [parseFloat(mapBox.getAttribute('data-lat')), parseFloat(mapBox.getAttribute('data-lng'))];
    var canvas = document.createElement('div');
    canvas.className = 'map-canvas';
    mapBox.appendChild(canvas);
    mapBox.classList.add('is-ready');
    // Carte figée : ni glisser, ni zoom, ni boutons (seul le crédit OpenStreetMap reste cliquable)
    var map = L.map(canvas, {
      zoomControl: false, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false,
      boxZoom: false, keyboard: false, tap: false, zoomSnap: 0.25
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(map);
    L.marker(home, {
      icon: L.divIcon({ className: 'mk', html: '<div class="mk-home"><i></i><b>' + TXT.mapHome + '</b></div>', iconSize: [0, 0] }),
      zIndexOffset: 1000, keyboard: false, interactive: false
    }).addTo(map);
    var points = [home];
    var lines = [];
    Array.prototype.forEach.call(document.querySelectorAll('.loc-list [data-lat]'), function (li, idx) {
      var ll = [parseFloat(li.getAttribute('data-lat')), parseFloat(li.getAttribute('data-lng'))];
      // nom sans le numéro de l'encadré ; numéro repris sur la pastille. Souk El Had (à ~400 m) est décalé pour ne pas recouvrir la résidence
      var nb = li.querySelector('.loc-nb');
      var name = li.querySelector('b').lastChild.textContent;
      var num = nb ? '<em class="mk-nb">' + escapeHtml(nb.textContent) + '</em>' : '';
      // Fil doré de la résidence vers le lieu (sous les repères)
      var line = L.polyline([home, ll], { color: '#B08850', weight: 2, opacity: .85, className: 'map-line', interactive: false }).addTo(map);
      lines.push(line);
      var marker = L.marker(ll, {
        icon: L.divIcon({ className: 'mk', html: '<div class="mk-place' + (idx === 0 ? ' is-near' : '') + '"><span><img src="' + escapeHtml(li.querySelector('img').getAttribute('src')) + '" alt="">' + num + '</span><b>' + escapeHtml(name) + '</b></div>', iconSize: [0, 0] }),
        keyboard: false, interactive: false
      }).addTo(map);
      points.push(ll);
      // Survol d'un encadré : sa pastille grossit et son fil s'épaissit sur la carte
      var highlight = function (on) {
        var el = marker.getElement();
        if (el) el.classList.toggle('is-hl', on);
        var path = line.getElement();
        if (path) path.classList.toggle('is-hl', on);
        li.classList.toggle('is-hl', on);
      };
      li.addEventListener('mouseenter', function () { highlight(true); });
      li.addEventListener('mouseleave', function () { highlight(false); });
    });
    var bounds = L.latLngBounds(points);
    var fit = function () { map.invalidateSize(); var small = !window.matchMedia('(min-width: 768px)').matches; map.fitBounds(bounds, small ? { paddingTopLeft: [30, 60], paddingBottomRight: [30, 40] } : { paddingTopLeft: [50, 45], paddingBottomRight: [60, 125] }); };
    fit();
    var resizeTimer;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 200); });

    // Les fils se tracent une fois, l'un après l'autre, quand la carte arrive à l'écran
    var linesDrawn = reduceMotion || !('IntersectionObserver' in window);
    var hideLines = function () {
      if (linesDrawn) return;
      lines.forEach(function (l) {
        var p = l.getElement();
        if (!p) return;
        var len = p.getTotalLength();
        p.style.transition = 'none';
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
      });
    };
    hideLines();
    map.on('zoomend moveend', hideLines);
    if (!linesDrawn) {
      var linesIo = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        linesIo.disconnect();
        linesDrawn = true;
        lines.forEach(function (l, i) {
          var p = l.getElement();
          p.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.2, .7, .2, 1) ' + (0.3 + i * 0.2) + 's';
          p.style.strokeDashoffset = '0';
        });
        // ensuite, les fils redeviennent des traits simples (le redimensionnement les redessine)
        setTimeout(function () {
          lines.forEach(function (l) { var p = l.getElement(); p.style.transition = ''; p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
        }, 3200);
      }, { threshold: 0.5 });
      linesIo.observe(mapBox);
    }
  }
  function loadMap() {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = ROOT + 'assets/vendor/leaflet/leaflet.css';
    document.head.appendChild(css);
    var lib = document.createElement('script');
    lib.src = ROOT + 'assets/vendor/leaflet/leaflet.js';
    lib.onload = initMap;
    document.head.appendChild(lib);
  }
  if (mapBox) {
    if ('IntersectionObserver' in window) {
      var mapIo = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        mapIo.disconnect();
        loadMap();
      }, { rootMargin: '400px 0px' });
      mapIo.observe(mapBox);
    } else {
      loadMap();
    }
  }

  // ---------- Vidéo de fond du hero ----------
  // Chargée après la page, seulement si l'utilisateur accepte les animations et n'économise pas ses données.
  var heroVideo = document.querySelector('[data-hero-video]');
  var saveData = navigator.connection && navigator.connection.saveData;
  if (heroVideo && !reduceMotion && !saveData) {
    var startHeroVideo = function () {
      heroVideo.src = heroVideo.getAttribute('data-src');
      heroVideo.addEventListener('playing', function () { heroVideo.classList.add('is-playing'); }, { once: true });
      var p = heroVideo.play();
      if (p && p.catch) p.catch(function () { /* lecture automatique bloquée : l'image reste affichée */ });
    };
    if (document.readyState === 'complete') setTimeout(startHeroVideo, 600);
    else window.addEventListener('load', function () { setTimeout(startHeroVideo, 600); });
    // Pause hors écran : la boucle ne décode plus pendant que le visiteur regarde la vue 3D
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (!heroVideo.getAttribute('src')) return;
        if (entries[0].isIntersecting) {
          var p = heroVideo.play();
          if (p && p.catch) p.catch(function () {});
        } else heroVideo.pause();
      }).observe(heroVideo);
    }
  }

  // ---------- Visite intérieure : vidéo muette, chargée à l'approche, lue seulement à l'écran ----------
  // Lecture seule : jamais les commandes du navigateur (pas de téléchargement, plein écran ni menu).
  var interiorVideo = document.querySelector('[data-interior-video]');
  if (interiorVideo) {
    var interiorFrame = interiorVideo.closest('[data-interior-frame]');
    var interiorPlay = interiorFrame.querySelector('[data-interior-play]');
    var interiorStarted = false; // une fois lancée par le visiteur, elle suit le défilement comme en lecture auto
    ['contextmenu', 'dragstart', 'dblclick'].forEach(function (type) {
      interiorFrame.addEventListener(type, function (e) { e.preventDefault(); });
    });
    interiorVideo.addEventListener('play', function () { interiorStarted = true; interiorPlay.hidden = true; });
    interiorPlay.addEventListener('click', function () {
      var p = interiorVideo.play();
      if (p && p.catch) p.catch(function () {});
    });
    var showPlayButton = function () { if (!interiorStarted) interiorPlay.hidden = false; };
    var loadInterior = function () {
      if (!interiorVideo.getAttribute('src')) interiorVideo.src = interiorVideo.getAttribute('data-src');
    };
    if (reduceMotion || saveData || !('IntersectionObserver' in window)) {
      // Pas de lecture automatique : le visiteur lance la vidéo lui-même
      loadInterior();
      showPlayButton();
    } else {
      var loadObserver = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        loadInterior();
        loadObserver.disconnect();
      }, { rootMargin: '400px 0px' });
      loadObserver.observe(interiorVideo);
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          loadInterior();
          var p = interiorVideo.play();
          if (p && p.catch) p.catch(showPlayButton);
        } else interiorVideo.pause();
      }, { threshold: .35 }).observe(interiorVideo);
    }
  }

  // ---------- Vue 3D : glisser pour tourner autour du bâtiment ----------
  var orbit = document.querySelector('[data-orbit]');
  if (orbit) {
    var orbitImg = orbit.querySelector('[data-orbit-img]');
    var orbitRange = document.querySelector('[data-orbit-range]');
    var orbitBar = orbit.querySelector('[data-orbit-progress]');
    var total = parseInt(orbit.getAttribute('data-frames'), 10);
    var base = orbit.getAttribute('data-path');
    var frames = new Array(total);
    var ready = new Array(total); // image téléchargée ET décodée
    var loadedCount = 0;
    var pos = 0; // position dans le tour, fractionnaire (0 à total)
    var touched = false;
    var MS_PER_FRAME = 100; // rotation automatique : 10 s par tour
    var frameSrc = function (i) { return base + String(i + 1).padStart(3, '0') + '.webp'; };
    var wrap = function (i) { return ((i % total) + total) % total; };

    // Les images sont dessinées dans un canvas posé sur l'<img> (qui reste pour le texte alternatif et sans JS).
    // Changer le src d'une <img> relance un décodage à chaque image : c'était la cause des saccades.
    var canvas = document.createElement('canvas');
    canvas.className = 'orbit-canvas';
    canvas.width = parseInt(orbitImg.getAttribute('width'), 10);
    canvas.height = parseInt(orbitImg.getAttribute('height'), 10);
    canvas.setAttribute('aria-hidden', 'true');
    orbitImg.insertAdjacentElement('afterend', canvas);
    var ctx = canvas.getContext('2d');

    var nearest = function (i) {
      for (var d = 0; d < total; d++) {
        var k = wrap(i + (d % 2 ? -(d + 1) / 2 : d / 2));
        if (ready[k]) return k;
      }
      return -1;
    };

    // Fondu entre deux images voisines : la rotation paraît continue malgré 100 images seulement
    var drawnKey = '';
    var draw = function () {
      var a = wrap(Math.floor(pos)), b = wrap(a + 1), t = pos - Math.floor(pos);
      t = t * t * (3 - 2 * t);
      if (!ready[a] || !ready[b]) { a = nearest(Math.round(pos)); t = 0; }
      if (a < 0) return;
      var key = a + ':' + Math.round(t * 32);
      if (key === drawnKey) return;
      drawnKey = key;
      ctx.globalAlpha = 1;
      ctx.drawImage(frames[a], 0, 0, canvas.width, canvas.height);
      if (t > 0.03) { ctx.globalAlpha = t; ctx.drawImage(frames[b], 0, 0, canvas.width, canvas.height); }
    };
    var drawPending = false;
    var requestDraw = function () {
      if (drawPending) return;
      drawPending = true;
      requestAnimationFrame(function () { drawPending = false; draw(); });
    };

    var lastRangeValue = '';
    var setPos = function (p) {
      pos = ((p % total) + total) % total;
      var v = String(wrap(Math.round(pos)) + 1);
      if (orbitRange && v !== lastRangeValue) { orbitRange.value = v; lastRangeValue = v; }
    };

    var loadAll = function () {
      // d'abord une image sur 5 (tour complet rapide), puis les autres
      var order = [];
      for (var s = 0; s < 5; s++) for (var i = s; i < total; i += 5) order.push(i);
      order.forEach(function (i) {
        var im = new Image();
        var counted = function () {
          loadedCount++;
          if (orbitBar) {
            orbitBar.firstElementChild.style.width = Math.round(loadedCount / total * 100) + '%';
            if (loadedCount === total) orbitBar.classList.add('is-done');
          }
        };
        im.onload = function () {
          var ok = function () { ready[i] = true; counted(); if (!playing) requestDraw(); };
          if (im.decode) im.decode().then(ok, ok); else ok();
        };
        im.onerror = counted;
        im.src = frameSrc(i);
        frames[i] = im;
      });
    };

    var markTouched = function () { touched = true; orbit.classList.add('is-touched'); };

    // Glisser (souris, doigt, stylet). La rotation automatique ne s'arrête qu'au premier vrai glissement,
    // pas quand le doigt se pose pour faire défiler la page.
    var dragging = false, moved = false, startX = 0, startPos = 0, pxPerFrame = 1;
    orbit.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false; startX = e.clientX; startPos = pos;
      pxPerFrame = orbit.clientWidth / (total * 0.9);
    });
    orbit.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) < 6) return;
        moved = true; markTouched();
        orbit.classList.add('is-dragging');
        if (orbit.setPointerCapture) orbit.setPointerCapture(e.pointerId);
      }
      setPos(startPos - dx / pxPerFrame);
      requestDraw();
    });
    var endDrag = function () { dragging = false; orbit.classList.remove('is-dragging'); };
    orbit.addEventListener('pointerup', endDrag);
    orbit.addEventListener('pointercancel', endDrag);
    if (orbitRange) orbitRange.addEventListener('input', function () { markTouched(); setPos(parseInt(orbitRange.value, 10) - 1); requestDraw(); });

    // Rotation automatique tant que le visiteur n'a pas touché, et seulement à l'écran.
    // Avance selon le temps écoulé (et non une image toutes les 120 ms), une seule boucle à la fois.
    var orbitVisible = false, playing = false, lastT = 0;
    var tick = function (t) {
      if (!orbitVisible || touched) { playing = false; return; }
      if (lastT) setPos(pos + Math.min(t - lastT, 50) / MS_PER_FRAME);
      lastT = t;
      draw();
      requestAnimationFrame(tick);
    };
    var play = function () {
      if (playing || touched || reduceMotion) return;
      playing = true; lastT = 0;
      requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window) {
      var preload = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { preload.disconnect(); loadAll(); }
      }, { rootMargin: '600px 0px' });
      preload.observe(orbit);
      var seen = new IntersectionObserver(function (entries) {
        orbitVisible = entries[0].isIntersecting;
        if (orbitVisible) play();
      }, { threshold: 0.5 });
      seen.observe(orbit);
    } else {
      loadAll();
    }
  }

  // ---------- Pourquoi Yacout : l'étape au milieu de l'écran pilote l'image collante ----------
  var whyStory = document.querySelector('[data-why-story]');
  if (whyStory && 'IntersectionObserver' in window) {
    var whyNames = TXT.why;
    var whyCount = whyStory.querySelector('[data-why-count]');
    var whyCap = whyStory.querySelector('[data-why-cap]');
    var whyParts = whyStory.querySelectorAll('[data-why]');
    var whySteps = whyStory.querySelectorAll('[data-why-step]');
    var showWhy = function (i) {
      Array.prototype.forEach.call(whyParts, function (el) {
        var k = parseInt(el.getAttribute('data-why'), 10);
        el.classList.toggle('is-on', k === i);
        el.classList.toggle('is-past', k < i);
      });
      if (whyCount) whyCount.textContent = '0' + (i + 1);
      if (whyCap) whyCap.textContent = whyNames[i];
      whyStory.style.setProperty('--why-p', (i + 1) / whySteps.length);
    };
    var whyIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) showWhy(parseInt(en.target.getAttribute('data-why-step'), 10)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    Array.prototype.forEach.call(whySteps, function (s) { whyIo.observe(s); });
  }

  // ---------- Chiffres géants : un chiffre par écran au défilement ----------
  var giant = document.querySelector('[data-giant]');
  var giantFormSlide = giant && giant.querySelector('.giant-slide--form');
  var giantForm = giantFormSlide && giantFormSlide.querySelector('.lead-form');
  if (giantForm) {
    var giantStep2 = q(giantForm, '[data-step="2"]');
    // Étape 2 déjà ouverte (visiteur qui revient) : pas de formulaire dans les chiffres, le bouton du 41–73 m² reprend sa place
    if (!giantStep2.hidden) giantFormSlide.hidden = true;
    else giant.classList.add('has-form');
  } else if (giantFormSlide) {
    giantFormSlide.hidden = true;
  }
  if (giant && !reduceMotion) {
    giant.classList.add('is-live');
    var giantSlides = [];
    var giantDots = giant.querySelectorAll('.giant-dots i');
    var giantTick = false;
    var setGiantSlides = function () {
      giantSlides = Array.prototype.filter.call(giant.querySelectorAll('.giant-slide'), function (s) { return !s.hidden; });
      Array.prototype.forEach.call(giantDots, function (d, i) { d.hidden = i >= giantSlides.length; });
    };
    setGiantSlides();
    var drawGiant = function () {
      giantTick = false;
      if (!giant.classList.contains('is-live')) return;
      var r = giant.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var p = Math.max(0, Math.min(1, -r.top / (r.height - window.innerHeight)));
      var n = giantSlides.length;
      Array.prototype.forEach.call(giantSlides, function (s, i) {
        var d = p * n - i - .5;
        if (i === n - 1 && d > 0) d = 0; // le dernier chiffre (avec le bouton) reste à l'écran
        if (i === 0 && d < 0) d = 0; // le premier est déjà là à l'arrivée
        var a = Math.abs(d);
        s.style.opacity = Math.max(0, Math.min(1, 1 - (a - .28) / .2));
        s.style.transform = 'translateY(' + (-d * 90) + 'px) scale(' + (1 + d * .3) + ')';
        s.style.filter = a > .26 ? 'blur(' + (a - .26) * 40 + 'px)' : 'none';
        s.style.visibility = a < .5 ? 'visible' : 'hidden';
      });
      var cur = Math.min(n - 1, Math.floor(p * n));
      Array.prototype.forEach.call(giantDots, function (d, i) { d.classList.toggle('is-on', i === cur); });
      giant.classList.toggle('is-at-form', giantSlides[cur] === giantFormSlide);
    };
    var reqGiant = function () { if (!giantTick) { giantTick = true; requestAnimationFrame(drawGiant); } };
    window.addEventListener('scroll', reqGiant, { passive: true });
    window.addEventListener('resize', reqGiant);
    drawGiant();

    // L'étape 2 (3 questions) est trop haute pour un écran figé : on sort du mode animé
    if (giantForm && !giantFormSlide.hidden && 'MutationObserver' in window) {
      new MutationObserver(function () {
        if (q(giantForm, '[data-step="2"]').hidden || !giant.classList.contains('has-form')) return;
        var r = giant.getBoundingClientRect();
        var onGiantForm = r.top < 0 && r.bottom > window.innerHeight * .5 && giantFormSlide.style.visibility !== 'hidden';
        giant.classList.remove('has-form');
        if (onGiantForm) {
          // envoyé depuis ce formulaire : on garde uniquement le formulaire, à l'écran
          giant.classList.remove('is-live');
          giant.classList.add('is-form-only');
          Array.prototype.forEach.call(giant.querySelectorAll('.giant-slide'), function (s) { s.removeAttribute('style'); });
          var headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 0;
          window.scrollTo({ top: giantForm.getBoundingClientRect().top + window.pageYOffset - headerH - 16, behavior: 'instant' });
        } else {
          // envoyé depuis le haut de page : les chiffres restent, sans le formulaire
          giantFormSlide.hidden = true;
          setGiantSlides();
          reqGiant();
        }
      }).observe(q(giantForm, '[data-step="2"]'), { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  // ---------- Apparitions au défilement ----------
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); revealIo.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(reveals, function (el) { revealIo.observe(el); });
  } else {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
  }
})();
