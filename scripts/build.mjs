#!/usr/bin/env node
/* בונה את index.html ואת study/index.html מתוך data/*.json.
   מקור אמת אחד לתוכן; ה־HTML נוצר ונשמר בריפו כדי ש־GitHub Pages
   יגיש קבצים סטטיים בלי שום fetch בזמן ריצה.                       */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

const texts = read('data/texts.json');
const study = read('data/study.json');
const middot = read('data/middot.json');
const commentary = (() => { try { return read('data/commentary.json'); } catch { return { refs: {} }; } })();

/* חתימת תוכן על הנכסים. בלעדיה דפדפן שכבר ביקר באתר מקבל CSS ישן
   מול HTML חדש — וזה נראה כאילו האתר נשבר.                        */
const stamp = (rel) => {
  try {
    const h = createHash('sha1').update(readFileSync(resolve(ROOT, rel))).digest('hex').slice(0, 8);
    return `${rel}?v=${h}`;
  } catch { return rel; }
};
const CSS = stamp('assets/style.css');
const JS = stamp('assets/app.js');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const html = (s) => String(s);               /* שדות שמותר בהם תגיות — נכתבים בידינו */
const join = (a, f) => (a || []).map(f).join('\n');

/* ── icons ─────────────────────────────────────────────────────── */
const ico = {
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>'
};

/* ── שכבת עיון מספריא ──────────────────────────────────────────
   נטענת רק אם data/commentary.json מלא. כל מפרש נפתח בנפרד,
   והראשון (ביאור שטיינזלץ) פתוח — הוא ההסבר הפשוט.
   בלי קישורים החוצה: מי שנכנס ללמוד לא צריך ללכת לאיבוד.        */
const CHEV = '<span class="chev" aria-hidden="true"></span>';

const voices = (id) => {
  const g = commentary.passages && commentary.passages[id];
  return g ? Object.values(g).filter((v) => v.items && v.items.length) : [];
};

/* כותרת המשנה אומרת מי; השורה שמתחתיה אומרת מאיפה. */
const voiceBlock = (g, i) => `            <details class="voice"${i === 0 ? ' open' : ''}>
              <summary>${CHEV}<span>${esc(g.he)}</span>${g.items.length > 1 ? `<span class="voice__n">${g.items.length}</span>` : ''}</summary>
              <div class="voice__body">
${join(g.items, (it, n) => {
  /* ציון חוזר על עצמו הוא רעש: מוצג רק כשהוא משתנה */
  const show = it.loc && it.loc !== g.items[n - 1]?.loc;
  return `                <div class="cite">${show ? `<p class="cite__loc">${esc(it.loc)}</p>` : ''}<p class="voice__t">${esc(it.text)}</p></div>`;
})}
              </div>
            </details>`;

const expandFor = (id) => {
  const list = voices(id);
  if (!list.length) return '';
  return `        <details class="expand no-print" id="x-${esc(id)}">
          <summary>
            <span class="expand__label">${CHEV}<span class="expand__word">להרחיב</span></span>
            <span class="expand__names">${list.map((g) => esc(g.he)).join(' · ')}</span>
          </summary>
          <div class="expand__body">
${list.map(voiceBlock).join('\n')}
          </div>
        </details>`;
};

/* ── shell ─────────────────────────────────────────────────────── */
function page({ title, desc, base = '', bodyClass = '', body }) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#FAF9F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1013" media="(prefers-color-scheme: dark)">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="he_IL">
<link rel="stylesheet" href="${base}${CSS}">
<link rel="preload" as="font" type="font/woff2" href="${base}assets/fonts/assistant-hebrew-400-normal.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="${base}assets/fonts/assistant-hebrew-600-normal.woff2" crossorigin>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%233B6675'/%3E%3Cpath d='M11 22V10m0 6h10m0-6v12' stroke='%23FAF9F6' stroke-width='2' stroke-linecap='round' fill='none'/%3E%3C/svg%3E">
<script>
/* מונע הבזק לבן במצב לילה ומחיל את מדרגת הגופן לפני הציור הראשון */
(function(){try{var r=document.documentElement,d=localStorage;
var s=d.getItem('kv:size');r.setAttribute('data-size',/^[123]$/.test(s)?s:'2');
var t=d.getItem('kv:theme');if(t==='night'||t==='day')r.setAttribute('data-theme',t);}catch(e){}})();
</script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">דילוג לתוכן</a>
${body}
<script src="${base}${JS}" defer></script>
</body>
</html>
`;
}

function topbar({ base = '', here }) {
  const other = here === 'pray'
    ? ''                                   /* הקישור למצב הלימוד מוסתר לעת עתה */
    : `<a class="btn btn--ghost" href="${base}">להתפלל</a>`;
  return `<header class="topbar no-print">
  <div class="wrap topbar__in">
    <a class="brand" href="${base}">סגולת הקל וחומר${here === 'pray' ? '' : '<span> · להבין</span>'}</a>
    <div class="topbar__sp"></div>
    <div class="tools">
      ${here === 'pray' ? `<button class="btn" type="button" data-print title="הדפסה">${ico.print}<span class="sr">הדפסה</span></button>` : ''}
      <div class="sizes" role="group" aria-label="גודל טקסט">
        <button class="btn" type="button" data-size-btn="1" title="קטן"><span aria-hidden="true" style="font-size:.78rem">א</span><span class="sr">גופן קטן</span></button>
        <button class="btn" type="button" data-size-btn="2" title="בינוני"><span aria-hidden="true" style="font-size:.95rem">א</span><span class="sr">גופן בינוני</span></button>
        <button class="btn" type="button" data-size-btn="3" title="גדול"><span aria-hidden="true" style="font-size:1.15rem">א</span><span class="sr">גופן גדול</span></button>
      </div>
      <button class="btn" type="button" data-theme-btn aria-pressed="false" title="מצב לילה">${ico.moon}<span class="sr" data-theme-label>מצב לילה</span></button>
      ${other}
    </div>
  </div>
</header>`;
}

/* ══ עמוד "להתפלל" ═════════════════════════════════════════════ */
function renderPray() {
  const t = texts;

  const passages = join(t.passages, (p) => `
      <article class="passage" id="p-${esc(p.id)}">
        <div class="passage__head">
          <span class="num" aria-hidden="true">${p.n}</span>
          <h3 class="passage__label">${esc(p.label)}</h3>
          <span class="passage__ref" data-ref-for="${esc(p.id)}">${esc(p.ref)}</span>
        </div>
        <p class="passage__lead">${esc(p.lead)}</p>
        <div class="text">
${join(p.lines, (l) => `          <p>${html(l)}</p>`)}
        </div>
${expandFor(p.id)}
      </article>`);

  const reqVariant = (key) => `
        <div class="text" data-request="${key}"${key === 'female' ? ' hidden' : ''}>
${join(t.request[key], (l) => `          <p>${html(l)}</p>`)}
${key === 'female' ? `          <p class="note" style="margin-top:.4rem">${esc(t.request.femaleNote)}</p>` : ''}
        </div>`;

  const body = `
${topbar({ here: 'pray' })}
<main id="main">
  <div class="wrap">

    <section class="hero">
      <p class="hero__kicker">${esc(t.meta.source)}</p>
      <h1>${esc(t.meta.title)}</h1>
      <p class="hero__sub">${esc(t.meta.subtitle)}</p>
      <div class="hero__rule"></div>
      <div class="lede">
${join(t.intro.lines, (l) => `        <p>${html(l)}</p>`)}
      </div>
    </section>

    <section class="section no-print" aria-labelledby="name-h">
      <div class="card namebox">
        <h3 id="name-h">${esc(t.namePrompt.title)}</h3>
        <div class="fields">
          <div class="field">
            <label for="patient-name">${esc(t.namePrompt.fieldName)}</label>
            <input id="patient-name" type="text" autocomplete="off" spellcheck="false"
                   enterkeyhint="done" placeholder="${esc(t.namePrompt.placeholderName)}">
          </div>
          <div class="field">
            <label for="mother-name">${esc(t.namePrompt.fieldMother)}</label>
            <input id="mother-name" type="text" autocomplete="off" spellcheck="false"
                   enterkeyhint="done" placeholder="${esc(t.namePrompt.placeholderMother)}">
          </div>
        </div>
        <div class="namebox__row">
          <div class="field">
            <span class="sr" id="gender-h">${esc(t.namePrompt.genderLabel)}</span>
            <div class="seg" role="group" aria-labelledby="gender-h">
              <button type="button" data-gender="male" aria-pressed="true">${esc(t.namePrompt.genderMale)}</button>
              <button type="button" data-gender="female" aria-pressed="false">${esc(t.namePrompt.genderFemale)}</button>
            </div>
          </div>
        </div>
        <p class="note namebox__hint">${esc(t.namePrompt.hint)}</p>
      </div>
    </section>

    <section class="section" aria-labelledby="texts-h">
      <div class="eyebrow"><h2 id="texts-h">${esc(t.passagesTitle)}</h2></div>
      <div class="passages">${passages}
      </div>
    </section>

    <section class="section" aria-labelledby="req-h">
      <div class="eyebrow"><h2 id="req-h">${esc(t.request.title)}</h2></div>
      <p class="request-lead">${html(t.requestLead)}</p>
      <div class="passage request">
${reqVariant('male')}
${reqVariant('female')}
      </div>
    </section>

  </div>

  <footer class="foot">
    <div class="wrap">
${join(t.footer.lines, (l) => `      <p>${html(l)}</p>`)}
    </div>
  </footer>
</main>`;

  return page({
    title: `${texts.meta.titlePlain} - לימוד לרפואת חולה`,
    desc: 'סגולת הבן איש חי לרפואת חולה: חמישה קטעי קל וחומר והבקשה שאחריהם, בנוסח לשון חכמים. עמוד אחד, מנוקד, מתאים להדפסה ולקריאה בחושך.',
    bodyClass: 'pray',
    body
  });
}

/* ══ עמוד "להבין" ══════════════════════════════════════════════ */
function renderStudy() {
  const s = study;


  const step = (st) => `
      <div class="step">
        <span class="step__dot" aria-hidden="true">${st.n}</span>
        <p class="step__kicker">${esc(st.kicker)}</p>
        <h3>${esc(st.title)}</h3>
        <p class="step__lead">${html(st.lead)}</p>
        ${st.quote ? `<blockquote class="quoteblock">${join(st.quote, (q) => `<p>${html(q)}</p>`)}</blockquote>` : ''}
        ${st.summary ? `<ul>${join(st.summary, (q) => `<li>${html(q)}</li>`)}</ul>` : ''}
        ${st.quoteStatus ? `<div class="gap"><p class="gap__tag">${st.quoteStatus.state === 'missing' ? 'חסר מתועד' : 'הערת מקור'}</p><p>${esc(st.quoteStatus.text)}</p></div>` : ''}
        ${st.note ? `<p class="step__note">${html(st.note)}</p>` : ''}
        ${st.link ? `<a class="srclink" href="${esc(st.link.url)}" target="_blank" rel="noopener noreferrer">${esc(st.link.label)} ↗</a>` : ''}
      </div>`;

  const ladder = (it) => `
        <p class="ladder__base">${esc(it.base)}</p>
        <div class="ladder">
${join(it.rungs, (r) => `          <div class="rung">
            <span class="rung__from">${html(r.from)}</span>
            <span class="rung__arrow" aria-hidden="true">←</span>
            <span class="rung__to">${html(r.to)}</span>
            <span class="rung__text">${esc(r.text)}</span>
          </div>`)}
        </div>
        <dl class="slots" style="margin-top:1rem">
          <div class="slot slot--out"><dt>המסקנה</dt><dd>${esc(it.conclusion)}</dd></div>
        </dl>`;

  const slots = (it) => `
        <dl class="slots">
          <div class="slot"><dt>הקל</dt><dd>${esc(it.kal)}</dd></div>
          <div class="slot"><dt>החומר</dt><dd>${esc(it.chomer)}</dd></div>
          <div class="slot"><dt>הצד השווה</dt><dd>${esc(it.shaveh)}</dd></div>
          <div class="slot slot--out"><dt>המסקנה</dt><dd>${esc(it.conclusion)}</dd></div>
        </dl>`;

  const breakdowns = join(s.breakdown.items, (it) => `
      <article class="bd" id="bd-${esc(it.id)}">
        <div class="bd__head">
          <h3 class="bd__label">${esc(it.label)}</h3>
          <span class="bd__ref">${esc(it.ref)}</span>
        </div>
        ${it.lead ? `<p class="bd__lead">${html(it.lead)}</p>` : ''}
${it.isLadder ? ladder(it) : slots(it)}
        ${it.extra ? `<p class="bd__extra">${html(it.extra)}</p>` : ''}
${expandFor(it.id)}
      </article>`);

  const rows = join(middot.rows, (r) => {
    const open = !r.rachamim;
    return `        <tr${open ? ' class="is-open"' : ''}>
          <td class="n">${r.n}</td>
          <td class="derash">${html(r.derash)}</td>
          <td class="rach">${r.rachamim ? html(r.rachamim) : '<span class="dash">-</span>'}</td>
          <td>${r.explanation ? esc(r.explanation) : '<span class="dash">-</span>'}</td>
          <td class="src src--${r.source.kind}">${r.source.url
            ? `<a href="${esc(r.source.url)}" target="_blank" rel="noopener noreferrer">${esc(r.source.text)} ↗</a>`
            : esc(r.source.text)}</td>
        </tr>`;
  });

  const reasons = join(s.omission.reasons, (r) => `
        <article class="reason">
          <p class="reason__kicker">${esc(r.kicker)}</p>
          <h3>${esc(r.title)}</h3>
${join(r.lines, (l) => `          <p>${html(l)}</p>`)}
        </article>`);

  const body = `
${topbar({ base: '../', here: 'study' })}
<nav class="toc no-print" aria-label="חלקי העמוד">
  <div class="wrap">
    <ol>
      <li><a href="#chain">שרשרת המסירה</a></li>
      <li><a href="#middot">י״ג מול י״ג</a></li>
      <li><a href="#breakdown">פירוק הקל וחומר</a></li>
      <li><a href="#omission">ההשמטה</a></li>
    </ol>
  </div>
</nav>
<main id="main" class="study">
  <div class="wrap">

    <section class="hero">
      <p class="hero__kicker">${esc(texts.meta.source)}</p>
      <h1>${esc(s.meta.title)}</h1>
      <p class="hero__sub">${esc(s.meta.subtitle)}</p>
      <div class="hero__rule"></div>
      <p class="section__lead" style="margin-top:1.6rem">${esc(s.meta.intro)}</p>
    </section>

    <section class="section" id="chain" aria-labelledby="chain-h">
      <h2 class="h2" id="chain-h">${esc(s.chain.title)}</h2>
      <p class="section__lead">${esc(s.chain.lead)}</p>
      <div class="chain">
${join(s.chain.steps, step)}
      </div>
      <div class="highlight">
        <h3>${esc(s.chain.highlight.title)}</h3>
${join(s.chain.highlight.lines, (l) => `        <p>${html(l)}</p>`)}
      </div>
    </section>

    <section class="section" id="middot" aria-labelledby="middot-h">
      <h2 class="h2" id="middot-h">${esc(middot.title)}</h2>
      <p class="section__lead">${esc(middot.lead)}</p>

      <div class="gap" style="margin-top:1.4rem;max-width:var(--measure)">
        <p class="gap__tag">${esc(middot.warning.title)}</p>
${join(middot.warning.lines, (l) => `        <p>${esc(l)}</p>`)}
      </div>

      <div class="tablewrap">
        <table class="middot">
          <caption class="sr">י״ג מידות שהתורה נדרשת בהן מול י״ג מידות הרחמים</caption>
          <colgroup><col class="c-n"><col class="c-d"><col class="c-r"><col class="c-e"><col class="c-s"></colgroup>
          <thead><tr><th scope="col"><span class="sr">מספר</span></th>${join(middot.columns, (c) => `<th scope="col">${esc(c)}</th>`)}</tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>

      <div style="margin-top:1.6rem;max-width:var(--measure)">
        <p class="step__kicker">${esc(middot.rachamimList.title)}</p>
        <p class="note" style="margin-top:.4rem">${esc(middot.rachamimList.sub)}</p>
        <div class="chips">
${join(middot.rachamimList.items, (x, i) => `          <span class="chip${['אֵ־ל', 'רַחוּם', 'וְחַנּוּן'].includes(x) ? ' chip--on' : ''}">${html(x)}</span>`)}
        </div>
        <p class="step__note" style="margin-top:1.2rem"><strong>${esc(middot.countingNote.title)}.</strong> ${esc(middot.countingNote.text)}</p>
      </div>
    </section>

    <section class="section" id="breakdown" aria-labelledby="bd-h">
      <h2 class="h2" id="bd-h">${esc(s.breakdown.title)}</h2>
      <p class="section__lead">${esc(s.breakdown.lead)}</p>
      <div class="breakdowns">${breakdowns}
      </div>
    </section>

    <section class="section" id="omission" aria-labelledby="om-h">
      <h2 class="h2" id="om-h">${esc(s.omission.title)}</h2>
      <p class="section__lead">${esc(s.omission.lead)}</p>
      <div class="reasons">${reasons}
      </div>
      <p class="close-note">${html(s.omission.close)}</p>
    </section>

  </div>

  <footer class="foot">
    <div class="wrap">
      <div class="foot__nav no-print"><a href="../">חזרה ללימוד ולבקשה</a></div>
      <p class="step__kicker" style="margin-bottom:.7rem">${esc(s.colophon.title)}</p>
${join(s.colophon.lines, (l) => `      <p>${html(l)}</p>`)}
    </div>
  </footer>
</main>`;

  return page({
    title: `להבין - ${texts.meta.titlePlain}`,
    desc: 'שרשרת המסירה מן המגיד ממעזריטש דרך הבני יששכר עד הבן איש חי, טבלת י״ג מידות הדרשה מול י״ג מידות הרחמים, ופירוק הלוגיקה של כל אחד מחמשת הקטעים.',
    base: '../',
    body
  });
}

/* ── write ─────────────────────────────────────────────────────── */
const out = [
  ['index.html', renderPray()],
  ['study/index.html', renderStudy()]
];
for (const [rel, content] of out) {
  const abs = resolve(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  console.log(`נכתב ${rel}  (${(content.length / 1024).toFixed(1)} KB)`);
}
