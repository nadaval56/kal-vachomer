#!/usr/bin/env node
/* מושך מספריא את שכבת העיון ושומר ל־data/commentary.json.
   רץ ב־GitHub Action בלבד — הדפדפן לעולם אינו פונה לספריא.

   ⚠️ הטקסט הראשי באתר הוא נוסח "לשון חכמים" ואינו מוחלף בנוסח ספריא.

   השיטה: לכל קטע יש מחרוזת איתור. הסקריפט מושך את הדף/המשנה, מוצא את
   הקטע המדויק שבו נמצא הלימוד, ומביא פירושים על אותו קטע בלבד — ולא
   על הדף כולו. כך מתקבלת הרחבה רלוונטית ולא ערימה.

   שימוש:  node scripts/fetch-sefaria.mjs [--dry] [--verbose]                */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/commentary.json');
const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');
const PROBE = process.argv.includes('--probe');
const API = 'https://www.sefaria.org/api';

/* לכל קטע באתר: הרפרנסים בספריא, ומחרוזת לאיתור הקטע המדויק בתוכם */
/* ליקוט. ספריא מחזירה את כל מה שתלוי בקטע, ולא הכול נוגע ללימוד שלנו.
   drop — מפרש שיורד כולו. keep — אילו פריטים נשארים (מדד, שלילי = מהסוף).
   מוחל אחרי התקרה של VOICES, כדי שהמדדים יהיו יציבים.               */
const SOURCES = [
  {
    id: 'chullin',
    curate: { drop: ['tosafot_yt', 'rambam_m'] },
    refs: [
      { ref: 'Mishnah_Chullin.12.5' },
      { ref: 'Chullin.142a', anchors: ['מצוה קלה', 'כאיסר', 'למען ייטב לך'] }
    ]
  },
  {
    id: 'negaim',
    curate: { drop: ['rashi', 'tosafot_yt'], keep: { bartenura: [2], rambam_m: [-1] } },
    refs: [{ ref: 'Mishnah_Negaim.12.5' }]
  },
  { id: 'chagiga', refs: [{ ref: 'Chagigah.27a', anchors: ['מזבח הזהב', 'פושעי ישראל', 'רקתך'] }] },
  {
    id: 'pesachim',
    caps: { steinsaltz: 5 },
    refs: [{
      ref: 'Pesachim.87b',
      anchors: ['שאשתך זונה', 'בני בחוני', 'קנינין'],
      /* הביאור צריך לכסות את כל הדיאלוג, לא רק את שורת הקל וחומר */
      steinSpan: { from: ['לאחר שנולדו', 'ללמוד ממשה'], to: ['ובטל גזירה', 'והתחיל לברכן'] }
    }]
  },
  {
    id: 'brachot',
    caps: { steinsaltz: 2 },
    refs: [{
      ref: 'Berakhot.5a',
      anchors: ['שן ועין', 'ממרקין', 'תיסרנו'],
      steinSpan: { from: ['מה תלמוד לומר ומתורתך', 'אל תקרי'], to: ['שן ועין', 'ממרקין'] }
    }, {
      /* "אשרי הגבר אשר תיסרנו" תלוי בקטע הקודם. משם רק הפסוק. */
      ref: 'Berakhot.5a',
      anchors: ['מה תלמוד לומר ומתורתך', 'אל תקרי'],
      only: ['psukim']
    }]
  }
];

/* מי נכנס, ובאיזה סדר יוצג */
const VOICES = [
  { key: 'psukim',    he: 'הפסוקים',          max: 3, category: 'Tanakh' },
  { key: 'steinsaltz', he: 'ביאור שטיינזלץ',  max: 1, title: /steinsaltz|שטיינזלץ/i },
  { key: 'rashi',     he: 'רש״י',             max: 3, title: /^rashi on |^רש"י על/i },
  { key: 'bartenura', he: 'ברטנורא',          max: 3, title: /^bartenura on /i },
  { key: 'tosafot_yt', he: 'תוספות יום טוב',  max: 3, title: /^tosafot yom tov on /i },
  { key: 'rambam_m',  he: 'רמב״ם על המשנה',   max: 2, title: /^rambam on mishnah /i },
  { key: 'tosafot',   he: 'תוספות',           max: 2, title: /^tosafot on /i },
  { key: 'maharsha',  he: 'מהרש״א',           max: 2, title: /^chidushei (agadot|halachot) on |maharsha/i }
];

/* ── שמות בעברית ───────────────────────────────────────────────────
   ספריא לא מחזירה heRef בתשובת הקישורים, אז ממירים בעצמנו.
   כל מה שלא מזוהה נשאר באנגלית — עדיף מאשר לנחש.               */
const TRACTATES = {
  Berakhot: 'ברכות', Pesachim: 'פסחים', Chagigah: 'חגיגה', Chullin: 'חולין',
  'Bava Kamma': 'בבא קמא', Negaim: 'נגעים'
};
const SCRIPTURE = {
  Genesis: 'בראשית', Exodus: 'שמות', Leviticus: 'ויקרא', Numbers: 'במדבר',
  Deuteronomy: 'דברים', Hosea: 'הושע', Psalms: 'תהלים', Proverbs: 'משלי',
  'Song of Songs': 'שיר השירים', Isaiah: 'ישעיהו', Jeremiah: 'ירמיהו'
};
const BOOKS = { ...TRACTATES, ...SCRIPTURE };
const WRITERS = [
  [/^Steinsaltz on /, 'ביאור שטיינזלץ'],
  [/^Rashi on /, 'רש״י'], [/^Bartenura on /, 'ברטנורא'],
  [/^Tosafot Yom Tov on /, 'תוספות יום טוב'], [/^Rambam on Mishnah /, 'רמב״ם'],
  [/^Tosafot on /, 'תוספות'], [/^Chidushei Agadot on /, 'מהרש״א'],
  [/^Chidushei Halachot on /, 'מהרש״א'], [/^Mishnah /, 'משנה']
];
const TANAKH = new RegExp('on (' + Object.keys(SCRIPTURE).join('|') + ')\\b');

/* מספר לאותיות */
function gim(n) {
  if (!n || n > 499) return String(n);
  const H = [[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],[90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],
             [50,'נ'],[40,'מ'],[30,'ל'],[20,'כ'],[10,'י'],[9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],
             [5,'ה'],[4,'ד'],[3,'ג'],[2,'ב'],[1,'א']];
  let out = '', r = n;
  for (const [v, l] of H) while (r >= v) { out += l; r -= v; }
  return out.replace(/יה$/, 'טו').replace(/יו$/, 'טז');
}
const quote = (t) => t.length > 1 ? t.slice(0, -1) + '״' + t.slice(-1) : t + '׳';

/* "Rashi on Chagigah 27a:1:1" → {he:"רש״י, חגיגה כ״ז ע״א", loc:"חגיגה כ״ז ע״א"} */
function refParts(ref) {
  if (!ref) return null;
  const raw = String(ref).replace(/[_.]/g, ' ');
  let writer = null, rest = raw;
  for (const [re, he] of WRITERS) {
    if (re.test(raw)) { writer = he; rest = raw.replace(re, ''); break; }
  }
  rest = rest.replace(/^Mishnah /, '');
  const m = rest.match(/^(.+?) (\d+)([ab])?(?::(\d+))?/);
  if (!m) return null;
  const book = BOOKS[m[1].trim()];
  if (!book) return null;
  const where = m[3]
    ? `${quote(gim(+m[2]))} ${m[3] === 'a' ? 'ע״א' : 'ע״ב'}`
    : `${quote(gim(+m[2]))}${m[4] ? ', ' + gim(+m[4]) : ''}`;
  const loc = `${book} ${where}`;
  return { he: `${writer ? writer + ', ' : ''}${loc}`, loc };
}
const hebrewRef = (r) => refParts(r)?.he || null;
const hebrewLoc = (r) => refParts(r)?.loc || null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s)
  .replace(/<[^>]+>/g, ' ')
  .replace(/[֑-ׇ]/g, '')          /* ניקוד וטעמים */
  .replace(/[^א-ת ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function clean(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(b|strong|big|small|span|i)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|thinsp|ensp|emsp|#160|#8201);/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\*\([^)]*\)/g, '')      /* הערות נוסח של ספריא בתוך הפסוק */
    .replace(/[\u0591-\u05AF\u05BD]/g, '')  /* טעמי מקרא — הגופן שבאתר בלעדיהם */
    .replace(/^[א-ת] (?=\S)/, '')     /* אות סימון קטע של ספריא */
    .replace(/[\u2014\u2013]/g, '-')  /* רק מקפים קצרים באתר */
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw err;
      await sleep(700 * i);
    }
  }
}

/* v3 מחזיר {versions:[{text:[...]}]} — text הוא מערך קטעים או מחרוזת */
function versionsOf(payload) {
  const vs = payload?.versions || [];
  return vs.map((v) => ({
    title: v.versionTitle || '',
    lang: v.language || v.actualLanguage || '',
    segments: Array.isArray(v.text) ? v.text.flat(Infinity) : [v.text].filter(Boolean)
  }));
}

/* מאתר את הקטע (1-based) שבו מופיעים הכי הרבה עוגנים. דורש שניים לפחות,
   או אחד אם זה כל מה שיש — שינוי כתיב אחד לא אמור להפיל את האיתור. */
function locateSegment(versions, anchors) {
  const needles = anchors.map(norm);
  let best = { score: 0, seg: null };
  for (const v of versions) {
    v.segments.forEach((seg, i) => {
      const hay = norm(seg);
      const score = needles.reduce((a, n) => a + (n && hay.includes(n) ? 1 : 0), 0);
      if (score > best.score) best = { score, seg: i + 1 };
    });
  }
  const need = Math.min(2, needles.length);
  return best.score >= need ? best.seg : null;
}

/* v3 לא תמיד מחזיר גרסאות; נופלים ל-v1 שמחזיר he ישירות */
async function segmentsFor(ref) {
  const enc = encodeURIComponent(ref);
  try {
    const v3 = await getJSON(`${API}/v3/texts/${enc}?version=all`);
    const vs = versionsOf(v3).filter((v) => v.segments.length);
    if (vs.length) return vs;
  } catch (err) { if (VERBOSE) console.log(`      v3 נכשל: ${err.message}`); }
  const v1 = await getJSON(`${API}/texts/${enc}?context=0&commentary=0&pad=0`);
  const he = Array.isArray(v1.he) ? v1.he.flat(Infinity) : [v1.he].filter(Boolean);
  return he.length ? [{ title: v1.heVersionTitle || 'hebrew', lang: 'he', segments: he }] : [];
}

const sefariaUrl = (ref) => `https://www.sefaria.org/${String(ref).replace(/[ ,]/g, '_')}`;

async function collect(refSpec) {
  const { ref, anchors } = refSpec;
  const versions = await segmentsFor(ref);
  if (VERBOSE) console.log(`      גרסאות: ${versions.map((v) => `${v.title}(${v.segments.length})`).join(', ') || 'אין'}`);

  let target = ref;
  if (anchors) {
    const seg = locateSegment(versions, anchors);
    if (!seg) {
      const sample = versions[0]?.segments.slice(0, 3).map((x) => norm(x).slice(0, 70)).join(' ⏐ ') || '—';
      throw new Error(`לא אותר [${anchors.join(', ')}] בתוך ${ref}. דוגמית: ${sample}`);
    }
    target = `${ref}.${seg}`;
    if (VERBOSE) console.log(`      אותר קטע ${seg}`);
  }

  const out = {};

  /* ביאור שטיינזלץ — גרסה של הטקסט עצמו, לא קישור */
  const stein = versions.find((v) => /steinsaltz|שטיינזלץ/i.test(v.title));
  if (stein) {
    const segIdx = anchors ? Number(target.split('.').pop()) - 1 : 0;
    const txt = clean(stein.segments[segIdx] || (anchors ? '' : stein.segments.join(' ')));
    if (txt.length > 12) out.steinsaltz = { he: 'ביאור שטיינזלץ', items: [{ ref: target, heRef: hebrewRef(target), loc: hebrewLoc(target), url: sefariaUrl(target), text: txt }] };
  }

  /* שם החיבור שאנו עומדים בו — פירוש על מסכת אחרת הוא הפניה, לא פירוש */
  const baseBook = ref.replace(/_/g, ' ').replace(/^Mishnah /, '').replace(/[ .]\d.*$/, '').trim();

  /* ביאור שטיינזלץ מגיע כקישור לכל קטע בנפרד. כשהלימוד שלנו משתרע על
     כמה קטעים, איסוף של קטע אחד נותן ביאור חתוך.                     */
  if (refSpec.steinSpan) {
    const a = locateSegment(versions, refSpec.steinSpan.from);
    const b = locateSegment(versions, refSpec.steinSpan.to);
    if (a && b) {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      if (VERBOSE) console.log(`      ביאור שטיינזלץ: קטעים ${lo}-${hi}`);
      for (let i = lo; i <= hi; i++) {
        const segRef = `${ref}.${i}`;
        try {
          const segLinks = await getJSON(`${API}/links/${encodeURIComponent(segRef)}?with_text=1`);
          for (const l of Array.isArray(segLinks) ? segLinks : []) {
            if (!/steinsaltz|שטיינזלץ/i.test(l.index_title || '')) continue;
            const txt = clean(Array.isArray(l.he) ? l.he.flat(Infinity).join(' ') : l.he || '');
            if (txt.length < 12) continue;
            (out.steinsaltz ||= { he: 'ביאור שטיינזלץ', items: [] });
            if (!out.steinsaltz.items.some((x) => x.ref === l.ref)) {
              out.steinsaltz.items.push({ ref: l.ref, heRef: hebrewRef(l.ref), loc: hebrewLoc(l.ref), url: sefariaUrl(l.ref), text: txt });
            }
          }
          await sleep(300);
        } catch (err) { if (VERBOSE) console.log(`      קטע ${i} נכשל: ${err.message}`); }
      }
    } else if (VERBOSE) console.log('      טווח הביאור לא אותר');
  }

  const links = await getJSON(`${API}/links/${encodeURIComponent(target)}?with_text=1`);
  for (const link of Array.isArray(links) ? links : []) {
    const title = link.index_title || link.collectiveTitle?.en || '';
    const voice = VOICES.find((v) =>
      (v.title && v.title.test(title)) ||
      (v.category && link.category === v.category));
    if (!voice) continue;
    if (refSpec.only && !refSpec.only.includes(voice.key)) continue;
    /* מתקבל: פסוקים, פירוש על החיבור שלפנינו, או פירוש על פסוק שהוא מצטט */
    const relevant = link.category === 'Tanakh' || title.includes(baseBook) || TANAKH.test(title);
    if (!relevant) { if (VERBOSE) console.log(`      נדחה כלא שייך: ${link.ref}`); continue; }
    const he = Array.isArray(link.he) ? link.he.flat(Infinity).join(' ') : link.he;
    const text = clean(he || '');
    if (text.length < 8) continue;
    (out[voice.key] ||= { he: voice.he, items: [] });
    if (out[voice.key].items.some((i) => i.ref === link.ref)) continue;
    out[voice.key].items.push({ ref: link.ref, heRef: link.heRef || hebrewRef(link.ref), loc: hebrewLoc(link.ref) || link.heRef || link.ref, url: sefariaUrl(link.ref), text });
  }
  return out;
}

function mergeInto(dst, src) {
  for (const [k, group] of Object.entries(src)) {
    (dst[k] ||= { he: group.he, items: [] });
    for (const item of group.items) {
      if (!dst[k].items.some((i) => i.ref === item.ref)) dst[k].items.push(item);
    }
  }
  return dst;
}

if (PROBE) {
  const seen = new Set();
  for (const src of SOURCES) {
    for (const { ref } of src.refs) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      console.log(`\n══ ${ref} ══`);
      try {
        for (const v of await segmentsFor(ref)) {
          console.log(`  גרסה: ${v.title} (${v.segments.length} קטעים)`);
          v.segments.forEach((seg, i) => console.log(`   [${i + 1}] ${norm(seg).slice(0, 110)}`));
        }
      } catch (err) { console.log(`  נכשל: ${err.message}`); }
      await sleep(400);
    }
  }
  process.exit(0);
}

const result = {
  generatedAt: new Date().toISOString(),
  note: 'שכבת עיון בלבד, נמשכת מספריא. הטקסט הראשי באתר הוא נוסח לשון חכמים.',
  passages: {}
};
let ok = 0;

for (const src of SOURCES) {
  const merged = {};
  for (const refSpec of src.refs) {
    try {
      if (VERBOSE) console.log(`   ${refSpec.ref}${refSpec.anchors ? ' + איתור' : ''}`);
      mergeInto(merged, await collect(refSpec));
      await sleep(400);                                  /* עדינות כלפי ספריא */
    } catch (err) {
      console.log(`   ${refSpec.ref} — נכשל: ${err.message}`);
    }
  }
  /* סדר תצוגה קבוע, תקרה לכל מפרש, ואז ליקוט */
  const cur = src.curate || {};
  const ordered = {};
  for (const v of VOICES) {
    if (!merged[v.key]?.items.length) continue;
    if (cur.drop?.includes(v.key)) { console.log(`   ${src.id}: ${merged[v.key].he} — הורד בליקוט`); continue; }
    let items = merged[v.key].items.slice(0, src.caps?.[v.key] ?? v.max ?? 2);
    const pick = cur.keep?.[v.key];
    if (pick) {
      items = pick.map((i) => items.at(i)).filter(Boolean);
      console.log(`   ${src.id}: ${merged[v.key].he} — נשמרו ${items.length} מתוך ${merged[v.key].items.length}`);
    }
    if (items.length) ordered[v.key] = { he: merged[v.key].he, items };
  }
  const n = Object.values(ordered).reduce((a, g) => a + g.items.length, 0);
  if (n) { result.passages[src.id] = ordered; ok++; }
  console.log(`${src.id}: ${n} מקורות — ${Object.values(ordered).map((g) => g.he).join(', ') || 'אין'}`);
}

if (!ok) {
  console.error('\nלא נמשך דבר. data/commentary.json לא שונה.');
  process.exit(0);
}

if (DRY) {
  console.log('\n--dry: לא נכתב קובץ.');
} else {
  const prev = (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')); } catch { return null; } })();
  if (prev && JSON.stringify(prev.passages) === JSON.stringify(result.passages)) {
    console.log('\nאין שינוי בתוכן.');
  } else {
    writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`\nנכתב data/commentary.json — ${ok}/${SOURCES.length} קטעים.`);
  }
}
