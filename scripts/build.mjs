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
const legal = read('data/legal.json');
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
const OG = new URL(stamp('assets/og.png'), texts.meta.siteUrl).href;
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
function page({ title, desc, base = '', path = '', bodyClass = '', body, jsonld }) {
  const canonical = new URL(path, texts.meta.siteUrl).href;
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
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="he_IL">
<meta property="og:image" content="${OG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(texts.meta.share.imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
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
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003C')}</script>\n` : ''}</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">דילוג לתוכן</a>
${body}
<script src="${base}${JS}" defer></script>
</body>
</html>
`;
}

/* ── תוכן עניינים ────────────────────────────────────────────────
   מוצג רק במסך רחב, שם ממילא יש מקום פנוי משני צדי עמודת הקריאה.
   הסימון של החלק הנוכחי נעשה ב-app.js.                          */
function toc(title, items) {
  return `    <nav class="toc no-print" aria-labelledby="toc-h">
      <div class="toc__in">
        <p class="toc__h" id="toc-h">${esc(title)}</p>
        <ol class="toc__list">
${join(items, (it) => `          <li><a href="#${esc(it.id)}">${it.n ? `<span class="toc__n" aria-hidden="true">${esc(it.n)}</span>` : ''}<span>${esc(it.label)}</span></a></li>`)}
        </ol>
      </div>
    </nav>`;
}

/* ── תחתית ───────────────────────────────────────────────────────
   הקישורים לנגישות ולפרטיות יושבים בכל עמוד: הצהרת נגישות שאי
   אפשר להגיע אליה מכל מקום אינה שווה הרבה.                      */
function foot({ base = '', here }) {
  const link = (href, label) => `<a href="${href}">${esc(label)}</a>`;
  const nav = [
    here === 'pray' ? null : link(`${base}`, 'הלימוד והתפילה'),
    here === 'study' ? null : link(`${base}study/`, 'העמקה'),
    here === 'accessibility' ? null : link(`${base}${legal.accessibility.slug}`, legal.accessibility.navLabel),
    here === 'privacy' ? null : link(`${base}${legal.privacy.slug}`, legal.privacy.navLabel)
  ].filter(Boolean).join('\n        ');

  return `  <footer class="foot">
    <div class="wrap">
      <nav class="foot__nav no-print" aria-label="קישורי האתר">
        ${nav}
      </nav>
${join(texts.footer.lines, (l) => `      <p>${html(l)}</p>`)}
    </div>
  </footer>`;
}

function topbar({ base = '', here }) {
  const other = here === 'pray'
    ? `<a class="btn btn--ghost" href="${base}study/">העמקה</a>`
    : `<a class="btn btn--ghost" href="${base}">להתפלל</a>`;
  const crumb = { study: 'העמקה', accessibility: legal.accessibility.title, privacy: legal.privacy.title }[here];
  return `<header class="topbar no-print">
  <div class="wrap topbar__in">
    <a class="brand" href="${base || './'}">סגולת הקל וחומר${crumb ? `<span> · ${esc(crumb)}</span>` : ''}</a>
    <div class="topbar__sp"></div>
    <!-- שלוש קבוצות. בדסקטופ הן שקופות (display:contents) והפקדים
         יושבים בשורה אחת כמו קודם; בטלפון הן שלושת האזורים של הפס. -->
    <div class="tools">
      <div class="tools__grp tools__start">
        ${here === 'pray' ? `<button class="btn" type="button" data-print title="הדפסה">${ico.print}<span class="sr">הדפסה</span></button>` : ''}
        <div class="sizes" role="group" aria-label="גודל טקסט">
          <button class="btn" type="button" data-size-btn="1" title="קטן"><span aria-hidden="true" style="font-size:.78rem">א</span><span class="sr">גופן קטן</span></button>
          <button class="btn" type="button" data-size-btn="2" title="בינוני"><span aria-hidden="true" style="font-size:.95rem">א</span><span class="sr">גופן בינוני</span></button>
          <button class="btn" type="button" data-size-btn="3" title="גדול"><span aria-hidden="true" style="font-size:1.15rem">א</span><span class="sr">גופן גדול</span></button>
        </div>
      </div>
      <div class="tools__grp tools__mid">
        <button class="btn" type="button" data-theme-btn aria-pressed="false" title="מצב לילה">${ico.moon}<span class="sr" data-theme-label>מצב לילה</span></button>
      </div>
      <div class="tools__grp tools__end">${other}</div>
    </div>
  </div>
</header>`;
}

/* ══ עמוד "להתפלל" ═════════════════════════════════════════════ */
function renderPray() {
  const t = texts;

  const passages = join(t.passages, (p) => `
      <article class="passage" id="p-${esc(p.id)}">
        <header class="passage__head">
          <span class="num" aria-hidden="true">${p.n}</span>
          <h3 class="passage__label">${esc(p.label)}</h3>
          <p class="passage__lead">${esc(p.lead)}</p>
          <p class="passage__ref">${esc(p.ref)}</p>
        </header>
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

  const tocItems = t.passages
    .map((p) => ({ id: `p-${p.id}`, n: p.n, label: p.label }))
    .concat([{ id: 'request', label: t.request.title }]);

  const body = `
${topbar({ here: 'pray' })}
<main id="main">
  <div class="wrap wrap--rail">

${toc('בעמוד הזה', tocItems)}

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
        <h2 id="name-h">${esc(t.namePrompt.title)}</h2>
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

    <section class="section" id="request" aria-labelledby="req-h">
      <div class="eyebrow"><h2 id="req-h">${esc(t.request.title)}</h2></div>
      <p class="request-lead">${html(t.requestLead)}</p>
      <div class="passage request">
${reqVariant('male')}
${reqVariant('female')}
      </div>
    </section>

  </div>

${foot({ here: 'pray' })}
</main>`;

  const site = new URL('', texts.meta.siteUrl).href;
  return page({
    title: texts.meta.share.title,
    desc: texts.meta.share.desc,
    bodyClass: 'pray',
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${site}#website`,
          url: site,
          name: t.meta.titlePlain,
          description: t.meta.share.desc,
          inLanguage: 'he'
        },
        {
          '@type': 'WebPage',
          '@id': site,
          url: site,
          name: t.meta.share.title,
          description: t.meta.share.desc,
          inLanguage: 'he',
          isPartOf: { '@id': `${site}#website` },
          primaryImageOfPage: { '@type': 'ImageObject', url: OG },
          about: { '@type': 'CreativeWork', name: 'לשון חכמים, חלק ב, סימן טז', author: { '@type': 'Person', name: 'הבן איש חי' } }
        }
      ]
    }
  });
}

/* ══ עמוד "להבין" ═══════════════════════════════════════════════
   ארבעה חלקים, כל אחד נפתח ונסגר בפני עצמו.                     */
function renderStudy() {
  const s = study;

  const part = ({ n, title, lead, body, open }) => `
    <details class="part"${open ? ' open' : ''} id="part-${esc(n)}">
      <summary>
        <span class="part__n" aria-hidden="true">${esc(n)}</span>
        <span class="part__head">
          <span class="part__title">${CHEV}${esc(title)}</span>
          <span class="part__lead">${esc(lead)}</span>
        </span>
      </summary>
      <div class="part__body">
${body}
      </div>
    </details>`;

  /* ציטוט: מקור מעל, טקסט מתחת — כמו בשכבת העיון שבעמוד הראשי */
  const quote = (lines, source) => `        <blockquote class="say">
          ${source ? `<p class="say__src">${esc(source)}</p>` : ''}
${join(lines, (l) => `          <p>${html(l)}</p>`)}
        </blockquote>`;

  const prose = (lines) => join(lines, (l) => `        <p class="prose">${html(l)}</p>`);

  const more = (title, lines) => `        <details class="more">
          <summary>${CHEV}<span>${esc(title)}</span></summary>
          <div class="more__body">
${join(lines, (l) => `            <p class="prose prose--quote">${html(l)}</p>`)}
          </div>
        </details>`;

  /* ── א ── */
  const inst = s.instructions;
  const partA = part({ n: inst.n, title: inst.title, lead: inst.lead, body:
    join(inst.items, (it) => `        <section class="instr">
          <p class="kicker">${esc(it.kicker)}</p>
${it.quote ? quote([it.quote], it.source) : ''}
${it.raw ? `        <p class="micro">${esc(it.raw)}</p>` : ''}
${prose(it.body)}
${it.status ? `        <p class="flag">${esc(it.status)}</p>` : ''}
        </section>`) });

  /* ── ב ── */
  const idea = s.idea;
  const partB = part({ n: idea.n, title: idea.title, lead: idea.lead, body: [
    prose(idea.explain),
    quote(idea.core, idea.source),
    `        <p class="micro">${html(idea.maggid)}</p>`,
    more(idea.fullTitle, idea.full),
    `        <p class="kicker" style="margin-top:1.6rem">${esc(idea.pairsTitle)}</p>`,
    `        <div class="pairs">
${join(idea.pairs, (pr) => `          <div class="pair">
            <p class="pair__top"><span class="pair__d">${html(pr.derash)}</span><span class="pair__arrow" aria-hidden="true">←</span><span class="pair__r">${html(pr.rachamim)}</span></p>
            <p class="pair__why">${html(pr.why)}</p>
          </div>`)}
        </div>`,
    `        <details class="more">
          <summary>${CHEV}<span>${esc(idea.listTitle)}</span></summary>
          <div class="more__body">
            <p class="micro" style="margin-bottom:.8rem">${esc(idea.listNote)}</p>
            <ol class="midlist">
${join(idea.list, (x, i) => `              <li${i < 3 ? ' class="is-paired"' : ''}>${html(x)}</li>`)}
            </ol>
          </div>
        </details>`
  ].filter(Boolean).join('\n') });

  /* ── ג ── */
  const demo = s.demo;
  const partC = part({ n: demo.n, title: demo.title, lead: demo.lead, body: [
    prose(demo.intro),
    quote(demo.gemara, demo.gemaraSource),
    prose(demo.explain),
    quote(demo.core, demo.source)
  ].join('\n') });

  /* ── ד ── ההשמטה. פירוק הלימודים ירד בינתיים (breakdown.hidden). */
  const om = s.omission;
  const partD = part({ n: om.n, title: om.title, lead: om.lead, body: [
    prose(om.explain.slice(0, 2)),
    quote(om.quote, om.source),
    prose(om.explain.slice(2))
  ].join('\n') });

  const tocItems = [inst, idea, demo, om].map((x) => ({ id: `part-${x.n}`, n: x.n, label: x.title }));

  const body = `
${topbar({ base: '../', here: 'study' })}
<main id="main" class="study">
  <div class="wrap wrap--rail">

${toc('ארבעת החלקים', tocItems)}

    <section class="hero">
      <p class="hero__kicker">${esc(texts.meta.source)}</p>
      <h1>${esc(s.meta.title)}</h1>
      <p class="hero__sub">${esc(s.meta.subtitle)}</p>
      <div class="hero__rule"></div>
    </section>

    <section class="parts">
${partA}
${partB}
${partC}
${partD}
    </section>

  </div>

${foot({ base: '../', here: 'study' })}
</main>`;

  const site = new URL('', texts.meta.siteUrl).href;
  const url = new URL('study/', texts.meta.siteUrl).href;
  const desc = 'שתי ההנחיות של מרן הבן איש חי, הרעיון שמאחורי הסדר לפי הבני יששכר בשם המגיד ממעזריטש, הגילוי שבספר בן יהוידע, וההשמטה.';
  return page({
    title: `העמקה - ${texts.meta.titlePlain}`,
    desc,
    base: '../',
    path: 'study/',
    bodyClass: 'study',
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': url,
      url,
      name: `העמקה - ${texts.meta.titlePlain}`,
      description: desc,
      inLanguage: 'he',
      isPartOf: { '@id': `${site}#website` }
    }
  });
}

/* ══ נגישות ופרטיות ═════════════════════════════════════════════
   שני עמודי טקסט רצוף מאותו תבנית. עמודה אחת, בלי פס צד: אין כאן
   לאן לקפוץ, וזה מה שקוראים מלמעלה למטה.                        */
function renderLegal(key) {
  const d = legal[key];
  const mail = legal.contact.email;

  const contactBlock = `        <p class="prose"><strong>${esc(legal.contact.label)}:</strong> <a href="mailto:${esc(mail)}">${esc(mail)}</a></p>`;

  const section = (s) => [
    `        <h2>${esc(s.h)}</h2>`,
    join(s.p, (l) => `        <p class="prose">${html(l)}</p>`),
    s.list ? `        <ul>\n${join(s.list, (l) => `          <li>${html(l)}</li>`)}\n        </ul>` : '',
    join(s.after, (l) => `        <p class="prose" style="margin-top:.9rem">${html(l)}</p>`),
    s.contact ? contactBlock : ''
  ].filter(Boolean).join('\n');

  const body = `
${topbar({ base: '../', here: key })}
<main id="main">
  <div class="wrap">

    <section class="hero">
      <p class="hero__kicker">${esc(texts.meta.titlePlain)}</p>
      <h1>${esc(d.title)}</h1>
      <p class="hero__sub">${esc(d.subtitle)}</p>
      <div class="hero__rule"></div>
    </section>

    <section class="section">
${join(d.sections, section)}
      <p class="note legal__updated">העמוד עודכן ב-${esc(d.updated)}.</p>
    </section>

  </div>

${foot({ base: '../', here: key })}
</main>`;

  const site = new URL('', texts.meta.siteUrl).href;
  const url = new URL(d.slug, texts.meta.siteUrl).href;
  const title = `${d.title} - ${texts.meta.titlePlain}`;
  return page({
    title,
    desc: d.desc,
    base: '../',
    path: d.slug,
    bodyClass: 'legal',
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': url,
      url,
      name: title,
      description: d.desc,
      inLanguage: 'he',
      isPartOf: { '@id': `${site}#website` }
    }
  });
}

/* ── robots + sitemap ──────────────────────────────────────────
   מה שאין לו נתיב מוצהר, מנוע חיפוש צריך לנחש. שני הקבצים נוצרים
   מ־siteUrl כדי שלא ייווצר פער בין הכתובת שבמטא לכתובת שבמפה.
   בלי lastmod: תאריך שמשתנה בכל build הוא רעש בהיסטוריה, וגוגל
   ממילא הולך אחרי מה שהוא רואה בעמוד.                           */
const PAGES = ['', 'study/', legal.accessibility.slug, legal.privacy.slug];
const abs = (rel) => new URL(rel, texts.meta.siteUrl).href;

const sitemap = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((rel) => `  <url><loc>${esc(abs(rel))}</loc></url>`).join('\n')}
</urlset>
`;

/* זוחלים קוראים רק את robots.txt שבשורש הדומיין. מאז ש-CNAME מפנה
   את האתר ל-kal-vachomer.co.il, השורש של הריפו הוא שורש הדומיין,
   והקובץ הזה אכן נקרא.                                          */
const robots = () => `User-agent: *
Allow: /

Sitemap: ${abs('sitemap.xml')}
`;

/* ── write ─────────────────────────────────────────────────────── */
const out = [
  ['index.html', renderPray()],
  ['study/index.html', renderStudy()],
  [`${legal.accessibility.slug}index.html`, renderLegal('accessibility')],
  [`${legal.privacy.slug}index.html`, renderLegal('privacy')],
  ['sitemap.xml', sitemap()],
  ['robots.txt', robots()]
];
for (const [rel, content] of out) {
  const dest = resolve(ROOT, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content, 'utf8');
  console.log(`נכתב ${rel}  (${(content.length / 1024).toFixed(1)} KB)`);
}
