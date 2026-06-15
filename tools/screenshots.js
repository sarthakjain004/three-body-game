/* ============================================================
 * THREE BODY — tools/screenshots.js  (Node + headless Chrome)
 * Captures the README screenshots from REAL gameplay: boots the
 * game in headless Chrome, clicks through the intro, runs the
 * simulation at max speed, and grabs frames at a Stable Era, a
 * killing-heat and a killing-cold Chaotic Era, plus the
 * Observatory and the (signature) Orbit Map.
 *
 * Optional dev tool — unlike the other tools/ scripts it is NOT
 * zero-dependency. Install the driver and ensure Chrome exists:
 *     npm i puppeteer-core
 *     node tools/screenshots.js
 *
 * Override Chrome's path with CHROME=/path/to/chrome if needed.
 * Output: docs/media/*.png
 * ============================================================ */
'use strict';
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch { console.error("Run `npm i puppeteer-core` first (optional dev dependency)."); process.exit(1); }

const CHROME = process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const root = path.join(__dirname, '..');
const GAME = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
const OUT = path.join(root, 'docs', 'media');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) }).then(() => console.log('  shot', name));

const read = (page) => page.evaluate(() => {
  const t = (id) => (document.getElementById(id)?.textContent || '').trim();
  const A = (window.TB && TB.app) ? TB.app : null;
  return {
    era: t('hud-era'), date: t('hud-date'),
    op: A ? A.overlayPause : -1,
    tempC: A && A.state && A.state.cl ? Math.round(A.state.cl.tempC) : null,
  };
});
const dismiss = (page) => page.evaluate(() => {
  const ov = document.getElementById('overlay');
  const b = ov ? [...ov.querySelectorAll('button')] : [];
  if (b.length) { b[b.length - 1].click(); return true; }
  return false;
});

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    // No GPU flag -> WebGL is unavailable -> the game uses its 2D
    // cinematic renderer, which makes for clean, deterministic stills.
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1320,760', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

  await page.goto(GAME, { waitUntil: 'load' });
  await sleep(1300);
  await page.click('#t-new').catch(() => {});
  await sleep(1000);

  for (let i = 0; i < 14; i++) {            // click through the 5-step intro
    if ((await read(page)).op === 0) break;
    await dismiss(page); await sleep(450);
  }
  await page.evaluate(() => TB.app.setSpeed(4));

  // Evolve and grab era-specific frames as they occur.
  let heat = false, cold = false, stable = false;
  for (let i = 0; i < 80 && !(heat && cold && stable); i++) {
    await sleep(700);
    const s = await read(page);
    if (s.op > 0) { await dismiss(page); continue; }
    const e = s.era.toUpperCase(), tc = s.tempC == null ? 0 : s.tempC;
    if (!stable && e.includes('STABLE')) { await shot(page, 'stable.png'); stable = true; }
    if (!heat && tc >= 90) { await shot(page, 'heat.png'); heat = true; }
    if (!cold && tc <= -50) { await shot(page, 'cold.png'); cold = true; }
  }

  // Panels — force-unlock the signature views for the captures.
  await page.evaluate(() => { TB.app.state.flags.orbit = true; TB.app.state.flags.computer = true; });
  for (const [btn, name] of [['#btn-observatory', 'observatory.png'], ['#btn-orbit', 'orbit-map.png']]) {
    await page.click(btn).catch(() => {});
    await sleep(1400);
    await shot(page, name);
    await page.click('#panel-close').catch(() => {});
    await sleep(500);
  }
  await page.evaluate(() => { /* nudge a redraw */ });

  await browser.close();
  console.log('Done. Wrote screenshots to docs/media/. (cover.png is a copy of orbit-map.png.)');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
