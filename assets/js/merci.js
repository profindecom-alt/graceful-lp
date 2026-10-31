/*
 * Page de remerciement : prénom, message adapté aux horaires du bureau (heure du Maroc)
 * et assistant relié au nœud « Chat Trigger » de n8n.
 *
 * Requête envoyée à n8n (POST JSON) :
 *   { action: 'sendMessage', sessionId, chatInput, metadata: { lead_id, first_name, property_type, goal, timeline, residence, page } }
 * Réponse attendue : { output: '…' } (réponse du nœud AI Agent). { text }, { message } ou du texte brut sont aussi acceptés.
 */
(function () {
  var cfg = window.YACOUT_CONFIG || {};
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var CHAT_URL = (isLocal && cfg.USE_DEV_WEBHOOK_ON_LOCALHOST) ? '/__dev/chat' : String(cfg.CHAT_WEBHOOK_URL || '').trim();
  var CHAT_KEY = 'yacout_chat';      // conversation de l'onglet (sessionStorage)
  var MAX_USER_MESSAGES = 20;        // au-delà, on renvoie vers le conseiller
  var TIMEOUT_MS = 30000;

  // Page française (/merci/) ou arabe (/ar/merci/, <html lang="ar">)
  var AR = document.documentElement.lang === 'ar';
  var T = AR ? {
    title: function (n) { return 'شكرًا ' + n + '، تم تسجيل طلبكم!'; },
    openLead: 'سيراسلكم مستشار من Graceful عبر واتساب خلال الدقائق القادمة، مع أسعار وتصاميم الوحدات المتوفرة.',
    openWhen: 'جارٍ الآن: أبقوا هاتفكم بالقرب منكم.',
    pauseLead: 'مستشارونا في استراحة حتى الساعة 14:00. ستصلكم رسالة واتساب فور عودتهم، مع الأسعار والتصاميم.',
    pauseWhen: 'ابتداءً من الساعة 14:00 اليوم.',
    closedLead: function (d) { return 'مكاتبنا مغلقة حاليًا. سيراسلكم مستشاركم عبر واتساب فور إعادة الفتح، ' + d + ' على الساعة 9:00، مع الأسعار والتصاميم.'; },
    closedWhen: function (d) { return d + '، ابتداءً من الساعة 9:00.'; },
    today: 'اليوم', monday: 'يوم الإثنين', tomorrow: 'غدًا',
    welcome: function (n) { return 'مرحبًا' + (n ? ' ' + n : '') + '! أنا مساعد ياقوت. في انتظار مستشاركم، اطرحوا عليّ أسئلتكم حول المشروع: الأسعار، المساحات، الأداء، المرآب، التسليم…'; },
    stop: 'شكرًا على أسئلتكم! لمعرفة المزيد، سيجيبكم مستشاركم من Graceful مباشرة عبر واتساب.',
    typing: 'المساعد يكتب',
    error: 'عذرًا، لا أستطيع الإجابة في الوقت الحالي. ',
    retry: 'إعادة المحاولة'
  } : {
    title: function (n) { return 'Merci ' + n + ', c\'est bien noté !'; },
    openLead: 'Un conseiller Graceful vous écrit sur WhatsApp dans les prochaines minutes, avec les prix et les plans des lots disponibles.',
    openWhen: 'En cours : gardez votre téléphone à portée de main.',
    pauseLead: 'Nos conseillers sont en pause jusqu\'à 14h00. Vous recevez votre message WhatsApp dès leur retour, avec les prix et les plans.',
    pauseWhen: 'Dès 14h00 aujourd\'hui.',
    closedLead: function (d) { return 'Nos bureaux sont fermés pour le moment. Votre conseiller vous écrit sur WhatsApp dès la réouverture, ' + d + ' à 9h00, avec les prix et les plans.'; },
    closedWhen: function (d) { return 'Dès ' + d + ', 9h00.'; },
    today: 'aujourd\'hui', monday: 'lundi', tomorrow: 'demain',
    welcome: function (n) { return 'Bonjour' + (n ? ' ' + n : '') + ' ! Je suis l\'assistant Yacout. En attendant votre conseiller, posez-moi vos questions sur le projet : prix, surfaces, paiement, parking, livraison…'; },
    stop: 'Merci pour vos questions ! Pour aller plus loin, votre conseiller Graceful vous répond directement sur WhatsApp.',
    typing: 'L\'assistant écrit',
    error: 'Désolé, je n\'arrive pas à répondre pour le moment. ',
    retry: 'Réessayer'
  };

  function get(key) { try { var v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignoré */ } }

  var lead = get('yacout_thanks') || {};
  var first = lead.first_name || get('yacout_first_name') || '';

  // ---------- Prénom ----------
  if (first) document.getElementById('thanks-title').textContent = T.title(first);

  // ---------- Horaires du bureau (lun.–sam., 9h–12h et 14h–17h30, heure du Maroc) ----------
  // Heure du Maroc = UTC+1 (hors ramadan, où le pays passe à UTC+0). Calcul direct : les données
  // de fuseau horaire des navigateurs ne sont pas fiables pour Africa/Casablanca.
  function moroccoNow() {
    var d = new Date(Date.now() + 3600000);
    return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  (function () {
    var leadEl = document.querySelector('[data-thanks-lead]');
    var whenEl = document.querySelector('[data-thanks-when]');
    var now = moroccoNow();
    var workday = now.day >= 1 && now.day <= 6;
    var open = workday && ((now.min >= 540 && now.min < 720) || (now.min >= 840 && now.min < 1050));
    if (open) {
      leadEl.textContent = T.openLead;
      whenEl.textContent = T.openWhen;
    } else if (workday && now.min >= 720 && now.min < 840) {
      leadEl.textContent = T.pauseLead;
      whenEl.textContent = T.pauseWhen;
    } else {
      // prochaine ouverture : aujourd'hui 9h, demain 9h ou lundi 9h
      var next = (workday && now.min < 540) ? T.today : (now.day === 6 || now.day === 0) ? T.monday : T.tomorrow;
      leadEl.textContent = T.closedLead(next);
      whenEl.textContent = T.closedWhen(next);
    }
  })();

  // ---------- Assistant ----------
  var box = document.querySelector('[data-chat]');
  if (!box || !CHAT_URL || /example\.com/.test(CHAT_URL)) return;
  box.hidden = false;

  var log = box.querySelector('[data-chat-log]');
  var form = box.querySelector('[data-chat-form]');
  var input = box.querySelector('[data-chat-input]');
  var sendBtn = box.querySelector('[data-chat-send]');
  var chips = box.querySelector('[data-chat-chips]');

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  }

  var state = get(CHAT_KEY) || { sessionId: lead.lead_id || uuid(), messages: [] };
  var busy = false;
  function save() { set(CHAT_KEY, state); }

  // Texte du bot : échappé, puis **gras**, liens et retours à la ligne
  function format(text) {
    var esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    esc = esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    esc = esc.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    esc = esc.replace(/^\s*[-*•]\s+/gm, '• ');
    return esc.replace(/\n/g, '<br>');
  }

  function addBubble(role, text, extraClass) {
    var b = document.createElement('div');
    b.className = 'chat-msg chat-' + role + (extraClass ? ' ' + extraClass : '');
    if (role === 'bot') b.innerHTML = format(text); else b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function welcome() {
    return T.welcome(first);
  }

  // Conversation existante (retour sur la page) ou message d'accueil
  addBubble('bot', welcome());
  state.messages.forEach(function (m) { addBubble(m.role, m.text); });
  if (state.messages.length) chips.hidden = true;

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    box.classList.toggle('is-busy', on);
  }

  function readReply(res) {
    return res.text().then(function (raw) {
      var data; try { data = JSON.parse(raw); } catch (e) { return raw.trim(); }
      if (Array.isArray(data)) data = data[0] || {};
      if (typeof data === 'string') return data;
      return data.output || data.text || data.message || data.response || data.reply || '';
    });
  }

  function ask(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    var userCount = state.messages.filter(function (m) { return m.role === 'user'; }).length;
    chips.hidden = true;
    addBubble('user', text);
    state.messages.push({ role: 'user', text: text });
    save();

    if (userCount >= MAX_USER_MESSAGES) {
      var stop = T.stop;
      addBubble('bot', stop);
      state.messages.push({ role: 'bot', text: stop });
      save();
      return;
    }

    setBusy(true);
    var typing = addBubble('bot', '', 'chat-typing');
    typing.innerHTML = '<span></span><span></span><span></span>';
    typing.setAttribute('aria-label', T.typing);

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        sessionId: state.sessionId,
        chatInput: text,
        metadata: {
          lead_id: lead.lead_id || '', first_name: first, property_type: lead.property_type || '', goal: lead.goal || '',
          timeline: lead.timeline || '', residence: lead.residence || '', project: 'Yacout', page: 'merci', page_lang: AR ? 'ar' : 'fr'
        }
      }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return readReply(res);
    }).then(function (reply) {
      if (!reply) throw new Error('empty');
      typing.remove();
      addBubble('bot', reply);
      state.messages.push({ role: 'bot', text: reply });
      save();
      if (window.gtag) window.gtag('event', 'chat_message', { lead_id: lead.lead_id || '' });
    }).catch(function () {
      typing.remove();
      var err = addBubble('bot', T.error, 'chat-error');
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = T.retry;
      retry.addEventListener('click', function () {
        err.remove();
        // la question reste dans l'historique : on la retire avant de la renvoyer
        var last = state.messages[state.messages.length - 1];
        if (last && last.role === 'user' && last.text === text) { state.messages.pop(); save(); }
        var bubbles = log.querySelectorAll('.chat-user');
        if (bubbles.length) bubbles[bubbles.length - 1].remove();
        ask(text);
      });
      err.appendChild(retry);
    }).then(function () {
      clearTimeout(timer);
      setBusy(false);
    });
  }

  // Zone de saisie : grandit jusqu'à 4 lignes, Entrée envoie, Maj+Entrée va à la ligne
  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }
  input.addEventListener('input', grow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var t = input.value;
    input.value = '';
    grow();
    ask(t);
  });
  chips.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ask]');
    if (b) ask(b.textContent.replace(/ /g, ' '));
  });
})();
