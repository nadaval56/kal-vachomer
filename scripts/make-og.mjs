#!/usr/bin/env node
/* מייצר את assets/og.png מתוך scripts/og-card.html.
   הכרטיס משתמש באותם גופנים וצבעים של האתר, ולכן הוא נראה כמוהו
   ולא כמו נכס שנוצר בנפרד.

   דורש playwright מותקן מקומית. ה-PNG מקומט לריפו, כך שהבנייה
   הרגילה אינה תלויה בו:
       npm i -D playwright && node scripts/make-og.mjs                 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import('playwright');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox']
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(ROOT, 'scripts/og-card.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(ROOT, 'assets/og.png') });
await browser.close();
console.log('נכתב assets/og.png  (1200×630)');
