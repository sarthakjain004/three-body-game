/* ============================================================
 * THREE BODY — app.ts
 * The application singleton: shared run state, title screen, the master
 * loop, time control, save/load, and boot(). Browser only.
 * ============================================================ */
import * as G from './game';
import * as Charts from './charts';
import * as Audio from './audio';
import * as UI from './ui';
import * as Story from './story';
import { render } from './renderer';
import { SEEDS } from './seeds';
import type { App } from './types';

  const SAVE_KEY = 'threebody.save.v1';
  const SPEEDS = [0, 2, 10, 60, 365];      // days of game time per real second
  const CHUNK = 0.5;                        // days per tick
  const MAX_DAYS_PER_FRAME = 12;

  export const app: App = {
    state: null,
    speedIdx: 2,
    lastSpeedIdx: 2,
    overlayPause: 0,
    setSpeed, pauseForOverlay, resumeFromOverlay,
    newGame, wildGame, continueGame, sandboxContinue, showTitle,
  };

  // Console / automated-screenshot debug handle (no effect on gameplay).
  if (typeof window !== 'undefined') (window as any).TB = { app };

  let lastMs = 0, acc = 0, saveTimer = 0;

  // ----------------------------------------------------------
  function setSpeed(i) {
    if (i < 0 || i >= SPEEDS.length) return;
    if (app.speedIdx > 0) app.lastSpeedIdx = app.speedIdx;
    app.speedIdx = i;
    for (let k = 0; k < SPEEDS.length; k++) {
      const b = document.getElementById('spd-' + k);
      if (b) b.classList.toggle('active', k === i);
    }
  }
  function pauseForOverlay() { app.overlayPause++; }
  function resumeFromOverlay() { app.overlayPause = Math.max(0, app.overlayPause - 1); }

  // ----------------------------------------------------------
  function newGame() {
    const seeds = (SEEDS && SEEDS.length) ? SEEDS : null;
    const seed = seeds
      ? seeds[Math.floor(Math.random() * seeds.length)]
      : (Math.random() * 0xFFFFFFFF) >>> 0;
    startWith(G.createGame(seed));
  }
  function wildGame() {
    startWith(G.createGame((Math.random() * 0xFFFFFFFF) >>> 0));
  }
  function continueGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return newGame();
      startWith(G.load(JSON.parse(raw)));
      G.addLog(app.state, 'You have logged back in to Three Body.', 'sys');
    } catch (e) {
      console.warn('Save corrupted, starting fresh.', e);
      newGame();
    }
  }
  function startWith(state) {
    app.state = state;
    Charts.resetTrail();
    if (render.setBiome) render.setBiome(12 - state.planetsLeft);  // this world's face
    document.getElementById('title').classList.add('hidden');
    document.getElementById('hud').style.display = '';
    setSpeed(2);
    Audio.init();
  }
  function sandboxContinue() {
    if (app.state) app.state.over = false;
  }
  function showTitle() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    app.state = null;
    refreshTitleButtons();
    document.getElementById('title').classList.remove('hidden');
    document.getElementById('hud').style.display = 'none';
  }

  function saveNow() {
    if (!app.state || app.state.over) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save(app.state))); }
    catch (e) { /* storage full or blocked — play on */ }
  }

  function refreshTitleButtons() {
    let has = false;
    try { has = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
    document.getElementById('t-continue').style.display = has ? 'block' : 'none';
  }

  // ----------------------------------------------------------
  // Master loop
  // ----------------------------------------------------------
  function frame(nowMs) {
    requestAnimationFrame(frame);
    const dtMs = Math.min(100, nowMs - lastMs || 16);
    lastMs = nowMs;
    const st = app.state;
    if (!st) { render.titleDemo(nowMs); return; }   // three-body dance behind the title

    // Simulate.
    const running = app.overlayPause === 0 && app.speedIdx > 0 && !st.over;
    if (running) {
      acc += (dtMs / 1000) * SPEEDS[app.speedIdx];
      if (acc > MAX_DAYS_PER_FRAME) acc = MAX_DAYS_PER_FRAME;
      while (acc >= CHUNK) {
        G.tick(st, CHUNK);
        acc -= CHUNK;
        if (st.pending.length) break;   // surface events immediately
      }
      Charts.sampleTrail(st);
    }

    // Present.
    UI.handlePending(st);
    render.render(st, nowMs);
    UI.update(st, nowMs);
    Audio.update(st);

    // Autosave once a minute.
    saveTimer += dtMs;
    if (saveTimer > 60000) { saveTimer = 0; saveNow(); }
  }

  // ----------------------------------------------------------
  export function boot() {
    render.init(document.getElementById('world'));
    UI.init();

    document.getElementById('t-continue').onclick = continueGame;
    document.getElementById('t-new').onclick = newGame;
    document.getElementById('t-wild').onclick = wildGame;
    refreshTitleButtons();
    document.getElementById('hud').style.display = 'none';   // hidden behind the title

    // Dev/testing flags: ThreeBody.html#autostart[,skipintro][,seed=NNN]
    const hash = (typeof location !== 'undefined' && location.hash) || '';
    if (hash.includes('autostart')) {
      const m = hash.match(/seed=(\d+)/);
      startWith(G.createGame(m ? +m[1] : (SEEDS && SEEDS.length
        ? SEEDS[Math.floor(Math.random() * SEEDS.length)]
        : (Math.random() * 0xFFFFFFFF) >>> 0)));
      if (hash.includes('skipintro')) {
        app.state.pending.length = 0;
        for (const k in Story.NOTICES) app.state.story.seenNotices[k] = true;
      }
      const bm = hash.match(/biome=(\d+)/);
      if (bm && render.setBiome) render.setBiome(+bm[1]);   // dev: preview a biome
    }

    try {
      if (localStorage.getItem('threebody.muted') === '1') Audio.setMuted(true);
    } catch (e) {}
    document.getElementById('btn-sound').textContent = Audio.isMuted() ? '♪ off' : '♪ on';
    // Audio requires a user gesture — and may be re-suspended later, so
    // every pointerdown routes through init() (idempotent, resumes).
    window.addEventListener('pointerdown', () => Audio.init());

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
    window.addEventListener('beforeunload', saveNow);

    requestAnimationFrame(frame);
  }

