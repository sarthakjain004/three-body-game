/* ============================================================
 * THREE BODY — tools/smoke.mts  (Node only)
 * Headless smoke test: stubs the DOM/canvas, loads the FULL
 * browser stack (render/charts/audio/ui/main), boots a game and
 * pumps thousands of frames at max speed, auto-clicking through
 * overlays. Any uncaught exception or non-finite state fails.
 *   tsx tools/smoke.mts [seed] [frames]
 * ============================================================ */
'use strict';

// ---------- DOM stubs ----------
function makeClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    toggle: (c, force) => { const on = force === undefined ? !set.has(c) : force;
      on ? set.add(c) : set.delete(c); return on; },
    contains: (c) => set.has(c),
  };
}

function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 50 });
      if (k === 'getBoundingClientRect') return () => ({ width: 500, height: 400 });
      if (typeof k === 'string') return t[k] !== undefined ? t[k] : noop;
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

const buttons = [];   // every stub element, so we can auto-click overlays
function makeEl(id) {
  const el = {
    id, style: {}, classList: makeClassList(),
    _innerHTML: '', textContent: '', disabled: false, dataset: { k: 'stable', d: '90' },
    onclick: null,
    width: 800, height: 600,
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ width: 520, height: 460 }),
    addEventListener() {}, appendChild() {},
    querySelector: (sel) => { const b = makeEl('q:' + sel); buttons.push(b); return b; },
    querySelectorAll: () => [],
    click() { if (this.onclick) this.onclick(); },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) { this._innerHTML = String(v); },
  });
  buttons.push(el);
  return el;
}

const elements = {};
const rafQueue = [];
let nowMs = 0;

global.window = {
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  addEventListener() {},
  requestAnimationFrame: (fn) => { rafQueue.push(fn); },
  AudioContext: undefined, webkitAudioContext: undefined,
};
global.document = {
  readyState: 'complete',
  documentElement: { style: { setProperty() {} } },
  getElementById: (id) => elements[id] || (elements[id] = makeEl(id)),
  createElement: (tag) => makeEl('created:' + tag),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener() {},
  visibilityState: 'visible',
};
global.requestAnimationFrame = global.window.requestAnimationFrame;
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
global.performance = { now: () => nowMs };
globalThis.__TB_NOTYPE__ = true;   // headless: fill dialog text instantly, no timers

// ---------- Load the full stack (ESM) ----------
// The DOM stubs above MUST be in place before importing the browser modules,
// so these are dynamic imports (not hoisted). Importing main runs boot(),
// which wires the UI and queues the first animation frame.
await import('../src/main');
const { app } = await import('../src/app');
const game: any = await import('../src/game');
const charts: any = await import('../src/charts');
const civ: any = await import('../src/civ');
const TB: any = { app, game, charts, civ };

// ---------- Run ----------
const seed = process.argv[2] ? +process.argv[2] : 4242;
const frames = process.argv[3] ? +process.argv[3] : 6000;

TB.app.state = TB.game.createGame(seed);
TB.charts.resetTrail();
TB.app.setSpeed(4);

let clicked = 0, panelsToggled = false;
for (let f = 0; f < frames; f++) {
  nowMs += 16.7;
  const cb = rafQueue.shift();
  if (!cb) break;
  cb(nowMs);

  // Auto-click any overlay button so beats/notices don't stall the run.
  if (f % 6 === 0) {
    for (const b of buttons.splice(0)) {
      if (b.onclick && String(b.id).startsWith('q:')) { b.click(); clicked++; }
    }
  }
  // The game auto-slows on dramatic events; the smoke bot speeds back up.
  if (f % 50 === 0) TB.app.setSpeed(4);
  // Exercise the panels and tools midway.
  if (!panelsToggled && f === 600) {
    panelsToggled = true;
    TB.charts.rollDivination(TB.app.state);
    TB.charts.runMozi(TB.app.state);
    TB.charts.requestForecast(TB.app.state);
    TB.charts.drawObservatory(makeCtx(), TB.app.state, 500, 440);
    TB.charts.drawOrbit(makeCtx(), TB.app.state, 500, 440);
    TB.charts.drawComputer(makeCtx(), TB.app.state, 500, 440, nowMs);
  }
  // Exercise player commands.
  const st = TB.app.state;
  if (st && !st.over) {
    if (f === 300) TB.game.cmdDehydrate(st);
    if (f === 900) TB.game.cmdRehydrate(st);
    if (f === 1500 && !st.proclamation) TB.game.cmdProclaim(st, 'stable', 90);
    if (f === 2400) TB.game.cmdToggleAuto(st);
    // Invariants.
    if (!isFinite(st.cl.tempC)) throw new Error('NaN temperature at frame ' + f);
    if (!isFinite(st.civ.popH) || st.civ.popH < 0) throw new Error('bad popH at frame ' + f);
    if (!isFinite(st.sys.planet.x)) throw new Error('NaN planet position at frame ' + f);
  }
}

const st = TB.app.state;
if (st) {
  console.log('SMOKE OK — seed ' + seed + ': ' + frames + ' frames, day ' +
    Math.floor(st.day) + ' (' + Math.floor(st.day / 365.25) + ' yr), civ No. ' +
    st.civ.no + ', age ' + TB.civ.AGES[st.civ.ageIdx].name + ', T ' +
    st.cl.tempC.toFixed(0) + '°C, overlays clicked ' + clicked +
    ', over=' + st.over);
  // Save/load round-trip.
  const data = JSON.parse(JSON.stringify(TB.game.save(st)));
  const st2 = TB.game.load(data);
  TB.game.tick(st2, 0.5);
  console.log('SAVE/LOAD OK — resumed day ' + Math.floor(st2.day));
} else {
  console.log('SMOKE OK — game ended and returned to title during run; overlays clicked ' + clicked);
}
