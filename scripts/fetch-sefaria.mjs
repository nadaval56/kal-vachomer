#!/usr/bin/env node
/* מושך פירושים מספריא ושומר אותם ב־data/commentary.json.
   רץ ב־GitHub Action בלבד. הדפדפן לעולם אינו פונה לספריא —
   האתר קורא את ה־JSON שנשמר בריפו.

   ⚠️ הטקסט הראשי באתר הוא נוסח "לשון חכמים" ואינו מוחלף בנוסח ספריא.
      מה שנמשך כאן הוא שכבת עיון בלבד.

   שימוש:  node scripts/fetch-sefaria.mjs
           node scripts/fetch-sefaria.mjs --dry     (בלי כתיבה)          */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/commentary.json');
const DRY = process.argv.includes('--dry');
const API = 'https://www.sefaria.org/api';

/* המקורות שהאתר נשען עליהם */
const REFS = [
  { ref: 'Chullin.142a',    label: 'חולין קמב ע״א' },
  { ref: 'Mishnah_Negaim.12.5', label: 'משנה נגעים יב, ה' },
  { ref: 'Chagigah.27a',    label: 'חגיגה כז ע״א' },
  { ref: 'Pesachim.87b',    label: 'פסחים פז ע״ב' },
  { ref: 'Berakhot.5a',     label: 'ברכות ה ע״א' },
  { ref: 'Numbers.12',      label: 'במדבר יב' },
  { ref: 'Bava_Kamma.25a',  label: 'בבא קמא כה ע״א' }
];

/* הפירושים הרצויים, לפי תחילת שם החיבור בספריא */
const WANTED = [
  { key: 'rashi',      match: /^Rashi on /,                     he: 'רש״י' },
  { key: 'bartenura',  match: /^Bartenura on /,                 he: 'ברטנורא' },
  { key: 'tosafot_yt', match: /^Tosafot Yom Tov on /,           he: 'תוספות יום טוב' },
  { key: 'maharsha',   match: /^Chidushei Agadot on |^Maharsha/, he: 'מהרש״א' }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw err;
      await sleep(600 * i);
    }
  }
}

/* ספריא מחזירה HTML קל; משאירים הדגשה ומורידים את השאר */
function clean(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(b|strong)>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function commentsFor(ref) {
  const links = await getJSON(`${API}/links/${encodeURIComponent(ref)}?with_text=1`);
  const out = {};
  for (const link of Array.isArray(links) ? links : []) {
    const title = link.index_title || link.collectiveTitle?.en || '';
    const want = WANTED.find((w) => w.match.test(title));
    if (!want) continue;
    const he = Array.isArray(link.he) ? link.he.join(' ') : link.he;
    const text = clean(he || '');
    if (text.length < 4) continue;
    (out[want.key] ||= { he: want.he, items: [] }).items.push({
      on: link.anchorRefExpanded?.[0] || link.anchorRef || ref,
      ref: link.ref,
      url: `https://www.sefaria.org/${String(link.ref).replace(/[ ,]/g, '_')}`,
      text
    });
  }
  for (const k of Object.keys(out)) out[k].items = out[k].items.slice(0, 12);
  return out;
}

const result = { generatedAt: new Date().toISOString(), note: 'שכבת עיון בלבד. הטקסט הראשי הוא נוסח לשון חכמים.', refs: {} };
let failures = 0;

for (const { ref, label } of REFS) {
  try {
    process.stdout.write(`${label} … `);
    const comments = await commentsFor(ref);
    const n = Object.values(comments).reduce((a, c) => a + c.items.length, 0);
    result.refs[ref] = { label, comments };
    console.log(`${n} פירושים`);
    await sleep(350);                       /* עדינות כלפי ספריא */
  } catch (err) {
    failures++;
    console.log(`נכשל — ${err.message}`);
  }
}

if (failures === REFS.length) {
  /* אין רשת או שספריא חסומה — משאירים את הקובץ הקיים ולא הורסים build */
  console.error('\nכל הבקשות נכשלו. data/commentary.json לא שונה.');
  process.exit(0);
}

if (DRY) {
  console.log('\n--dry: לא נכתב קובץ.');
} else {
  const prev = (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')); } catch { return null; } })();
  if (prev && JSON.stringify(prev.refs) === JSON.stringify(result.refs)) {
    console.log('\nאין שינוי בתוכן.');
  } else {
    writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`\nנכתב data/commentary.json (${REFS.length - failures}/${REFS.length} מקורות).`);
  }
}
