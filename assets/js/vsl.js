/*
 * Versions vidéo (/video/, /ar/video/) : lecteur de la VSL.
 * L'affiche suffit au premier affichage : la vidéo n'est demandée qu'après le chargement de la page.
 * - Bonne connexion : lecture muette automatique en 480p ; « Activer le son » reprend au début, avec le son, en 720p.
 * - Connexion lente, économie de données ou animations réduites : rien n'est téléchargé avant l'appui sur lecture.
 */
(function () {
  'use strict';

  var box = document.querySelector('[data-vsl]');
  if (!box) return;
  var video = box.querySelector('video');
  var playBtn = box.querySelector('[data-vsl-play]');
  var soundBtn = box.querySelector('[data-vsl-sound]');
  var endBox = box.querySelector('[data-vsl-end]');
  var replayBtn = box.querySelector('[data-vsl-replay]');
  var bar = box.querySelector('[data-vsl-bar]');
  var HD = video.getAttribute('data-src');
  var LOW = video.getAttribute('data-src-low');

  var connection = navigator.connection || {};
  var slow = !!connection.saveData || /2g|3g/.test(connection.effectiveType || '');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var withSound = false;

  function start(src, sound) {
    withSound = sound;
    video.muted = !sound;
    if (video.getAttribute('src') !== src) video.src = src;
    else video.currentTime = 0;
    endBox.hidden = true;
    playBtn.hidden = true;
    soundBtn.hidden = sound;
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {
        // lecture refusée (ex. mode économie d'énergie sur iPhone) : le visiteur la lance lui-même
        playBtn.hidden = false;
        soundBtn.hidden = true;
      });
    }
  }
  function startWithSound() { start(slow ? LOW : HD, true); }

  playBtn.addEventListener('click', function () {
    if (video.getAttribute('src') && withSound && !video.ended) video.play();
    else startWithSound();
  });
  soundBtn.addEventListener('click', startWithSound);
  replayBtn.addEventListener('click', startWithSound);
  // Pas de menu du navigateur sur la vidéo (télécharger, vitesse de lecture…)
  ['contextmenu', 'dragstart'].forEach(function (type) {
    box.addEventListener(type, function (e) { e.preventDefault(); });
  });
  // Appui sur l'image (ou espace, entrée au clavier) : active le son en lecture muette, sinon lecture ou pause
  function onVideoTap() {
    if (!withSound) startWithSound();
    else if (video.paused) video.play();
    else video.pause();
  }
  video.addEventListener('click', onVideoTap);
  video.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onVideoTap(); }
  });

  video.addEventListener('playing', function () {
    video.classList.add('is-on');
    box.classList.remove('is-waiting');
    playBtn.hidden = true;
  });
  video.addEventListener('waiting', function () { box.classList.add('is-waiting'); });
  video.addEventListener('pause', function () {
    box.classList.remove('is-waiting');
    if (withSound && !video.ended) playBtn.hidden = false;
  });
  video.addEventListener('timeupdate', function () {
    if (video.duration) bar.style.transform = 'scaleX(' + video.currentTime / video.duration + ')';
  });
  video.addEventListener('ended', function () {
    soundBtn.hidden = true;
    playBtn.hidden = true;
    endBox.hidden = false;
  });

  // Lecture muette : en pause hors écran, reprise au retour. Avec le son, elle continue pendant que le visiteur remplit le formulaire.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (withSound || !video.getAttribute('src') || video.ended) return;
      if (entries[0].isIntersecting) {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } else video.pause();
    }, { threshold: 0.25 }).observe(video);
  }

  if (!slow && !reduceMotion) {
    var autoStart = function () {
      setTimeout(function () { if (!video.getAttribute('src')) start(LOW, false); }, 800);
    };
    if (document.readyState === 'complete') autoStart();
    else window.addEventListener('load', autoStart);
  }
})();
