/* סגולת הקל וחומר — כל ההתנהגות שבאתר.
   אין תלות חיצונית, אין רשת, אין קוקיז.
   localStorage : העדפות תצוגה (גופן, מצב לילה).
   sessionStorage: שם החולה — נמחק עם סגירת הכרטיסייה.            */
(function () {
  'use strict';

  var root = document.documentElement;
  var LS = { size: 'kv:size', theme: 'kv:theme' };
  var SS = { name: 'kv:name', mother: 'kv:mother', gender: 'kv:gender' };

  function get(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function set(store, key, val) { try { store.setItem(key, val); } catch (e) { /* מצב פרטי */ } }

  /* ── גודל גופן: שלוש מדרגות ──────────────────────────────────── */
  var size = get(localStorage, LS.size);
  if (!/^[123]$/.test(size)) size = '2';
  root.setAttribute('data-size', size);

  function applySize(next) {
    size = next;
    root.setAttribute('data-size', size);
    set(localStorage, LS.size, size);
    sizeButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.size === size));
    });
  }

  var sizeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-size-btn]'));
  sizeButtons.forEach(function (b) {
    b.dataset.size = b.getAttribute('data-size-btn');
    b.setAttribute('aria-pressed', String(b.dataset.size === size));
    b.addEventListener('click', function () { applySize(b.dataset.size); });
  });

  /* ── מצב לילה ─────────────────────────────────────────────────── */
  var themeBtn = document.querySelector('[data-theme-btn]');
  var stored = get(localStorage, LS.theme);
  if (stored === 'night' || stored === 'day') root.setAttribute('data-theme', stored);

  function isNight() {
    var t = root.getAttribute('data-theme');
    if (t === 'night') return true;
    if (t === 'day') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncTheme() {
    if (!themeBtn) return;
    var night = isNight();
    themeBtn.setAttribute('aria-pressed', String(night));
    var label = night ? 'מצב יום' : 'מצב לילה';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.setAttribute('title', label);
    var t = themeBtn.querySelector('[data-theme-label]');
    if (t) t.textContent = label;
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = isNight() ? 'day' : 'night';
      root.setAttribute('data-theme', next);
      set(localStorage, LS.theme, next);
      syncTheme();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (!root.getAttribute('data-theme')) syncTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    syncTheme();
  }

  /* ── הדפסה ───────────────────────────────────────────────────── */
  var printBtn = document.querySelector('[data-print]');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

  /* ── שם החולה ─────────────────────────────────────────────────── */
  var nameIn   = document.getElementById('patient-name');
  var motherIn = document.getElementById('mother-name');
  var genderBtns = Array.prototype.slice.call(document.querySelectorAll('[data-gender]'));
  var slots = Array.prototype.slice.call(document.querySelectorAll('[data-slot="patient"]'));
  var variants = {
    male:   document.querySelector('[data-request="male"]'),
    female: document.querySelector('[data-request="female"]')
  };

  if (nameIn && motherIn) {
    var gender = get(sessionStorage, SS.gender) === 'female' ? 'female' : 'male';
    nameIn.value   = get(sessionStorage, SS.name)   || '';
    motherIn.value = get(sessionStorage, SS.mother) || '';

    var FALLBACK = (slots[0] && slots[0].dataset.fallback) || 'פב״פ';

    function render() {
      var n = nameIn.value.trim();
      var m = motherIn.value.trim();
      var word = gender === 'female' ? 'בַּת' : 'בֶּן';
      var text = FALLBACK, empty = true;

      if (n && m)      { text = n + ' ' + word + ' ' + m; empty = false; }
      else if (n)      { text = n;                        empty = false; }

      slots.forEach(function (s) {
        s.textContent = text;
        s.classList.toggle('nm--empty', empty);
      });

      if (variants.male && variants.female) {
        variants.male.hidden   = gender !== 'male';
        variants.female.hidden = gender !== 'female';
      }
      genderBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-gender') === gender));
      });

      set(sessionStorage, SS.name, n);
      set(sessionStorage, SS.mother, m);
      set(sessionStorage, SS.gender, gender);
    }

    nameIn.addEventListener('input', render);
    motherIn.addEventListener('input', render);
    genderBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        gender = b.getAttribute('data-gender') === 'female' ? 'female' : 'male';
        render();
      });
    });
    render();
  }

  /* ── המקור שבכותרת הקטע פותח את שכבת העיון ────────────────────── */
  Array.prototype.slice.call(document.querySelectorAll('[data-ref-for]')).forEach(function (ref) {
    var box = document.getElementById('x-' + ref.getAttribute('data-ref-for'));
    if (!box) return;
    ref.setAttribute('role', 'button');
    ref.setAttribute('tabindex', '0');
    ref.setAttribute('aria-controls', box.id);
    var sync = function () { ref.setAttribute('aria-expanded', String(box.open)); };
    var toggle = function () {
      box.open = !box.open;
      sync();
      if (box.open) box.scrollIntoView({ block: 'nearest' });
    };
    ref.addEventListener('click', toggle);
    ref.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    box.addEventListener('toggle', sync);
    sync();
  });

  /* ── תוכן עניינים בעמוד הלימוד: סימון החלק הנוכחי ─────────────── */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    var targets = [];
    tocLinks.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) { byId[el.id] = a; targets.push(el); }
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        tocLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
        if (byId[e.target.id]) byId[e.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }
})();
