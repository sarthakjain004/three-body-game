/* ============================================================
 * THREE BODY — tools/verify.js  (Node only)
 * The verifiability gate runner. Exercises the whole simulation
 * and asserts a battery of gates; prints a report and exits
 * non-zero if ANY gate fails (CI-style).
 *
 *   node tools/verify.js            # full battery
 *   node tools/verify.js quick      # fewer seeds / shorter runs
 *
 * Gates:
 *   1. STATIC      — story/data/content well-formed (validate.staticChecks)
 *   2. INVARIANTS  — every few ticks over long bot-played runs, the live
 *                    state satisfies its physical/logical invariants
 *   3. ENERGY      — symplectic integrator energy drift stays bounded
 *   4. DETERMINISM — same seed + same steps ⇒ identical state fingerprint
 *   5. SAVE/LOAD   — a save round-trips and continues identically
 *   6. STORY       — beats/chronicles/moments actually fire when they should
 * ============================================================ */
'use strict';
const path = require('path');
const J = (f) => path.join(__dirname, '..', 'js', f);
for (const m of ['util', 'physics', 'climate', 'civ', 'predict', 'story', 'game', 'seeds', 'validate'])
  require(J(m + '.js'));
const TB = globalThis.TB;
const V = TB.civ;

const QUICK = process.argv[2] === 'quick';
const DT = 0.5;

// ---- reporting ----
let failures = 0, gates = 0;
function gate(name, errs) {
  gates++;
  if (errs && errs.length) {
    failures += errs.length;
    console.log('  ✗ ' + name + '  (' + errs.length + ' issue' + (errs.length > 1 ? 's' : '') + ')');
    for (const e of errs.slice(0, 12)) console.log('      - ' + e);
    if (errs.length > 12) console.log('      … and ' + (errs.length - 12) + ' more');
  } else {
    console.log('  ✓ ' + name);
  }
}

// ---- the reserve-aware bot (mirrors tools/harness.js) ----
function bot(state) {
  const civ = state.civ, T = state.cl.tempC, cl = state.cl;
  if (!civ.alive || civ.dormant) return;
  const sust = V.sustainablePop(civ, cl), fd = V.foodDays(civ);
  if (T < -4 || T > 42) {
    if (civ.popH > 0.001 && civ.order !== 'dehydrate') TB.game.cmdDehydrate(state, 1);
  } else if (fd < 12 && civ.popH > sust * 1.3 && civ.order !== 'dehydrate') {
    TB.game.cmdDehydrate(state, TB.util.clamp(1 - sust / civ.popH, 0.15, 1));
  } else if (cl.eraType === 'stable' && T > 0 && T < 38 && civ.popD > 0.01
             && civ.order !== 'rehydrate' && fd > 25 && civ.water > civ.popD * 0.3) {
    TB.game.cmdRehydrate(state, 1);
  }
  if (state.flags.escape && civ.ageIdx >= 12 && !civ.fleet.building && civ.fleet.ships < 1000)
    TB.game.cmdFleet(state);
  if (civ.insight > 0) {
    for (const id of ['s1', 's2', 'e1', 'e2', 's3', 'p1', 'e3', 'p2', 'p3'])
      if (!civ.doctrines[id] && TB.game.cmdBuyDoctrine(state, id)) break;
  }
}

// ============================================================
console.log('\nTHREE BODY — verifiability gates' + (QUICK ? ' (quick)' : '') + '\n');

// ---- Gate 1: STATIC ----
gate('STATIC: content & data well-formed', TB.validate.staticChecks());

// ---- Gates 2+3: INVARIANTS over long runs, + energy drift ----
{
  const seeds = (TB.SEEDS || [137]).slice(0, QUICK ? 4 : 10);
  const years = QUICK ? 400 : 1200;
  const invErrs = [], energyErrs = [];
  for (const seed of seeds) {
    const state = TB.game.createGame(seed);
    let t = 0, guard = 0;
    const maxT = years * 365.25;
    while (state.day < maxT && !state.over && guard++ < 4e6) {
      TB.game.tick(state, DT);
      bot(state);
      state.pending.length = 0;
      if ((++t % 40) === 0) {                       // sample invariants periodically
        const e = TB.validate.stateInvariants(state);
        for (const v of e) invErrs.push('seed ' + seed + ' day ' + Math.floor(state.day) + ': ' + v);
        if (invErrs.length > 40) break;
      }
    }
    const drift = TB.physics.energyDrift(state.sys);
    if (!(drift < 1e-2)) energyErrs.push('seed ' + seed + ': energy drift ' + drift.toExponential(2));
  }
  gate('INVARIANTS: state stays consistent across ' + seeds.length + ' long runs', invErrs);
  gate('ENERGY: integrator drift < 1e-2 over the run', energyErrs);
}

// ---- Gate 4: DETERMINISM ----
{
  const errs = [];
  for (const seed of [137, 4077, 5259]) {
    const steps = QUICK ? 1500 : 4000;
    const run = () => { const s = TB.game.createGame(seed);
      for (let i = 0; i < steps; i++) { TB.game.tick(s, DT); s.pending.length = 0; } return TB.validate.fingerprint(s); };
    const a = run(), b = run();
    if (a !== b) errs.push('seed ' + seed + ': fingerprints differ (' + a + ' vs ' + b + ')');
  }
  gate('DETERMINISM: same seed ⇒ identical fingerprint', errs);
}

// ---- Gate 5: SAVE / LOAD round-trip ----
{
  const errs = [];
  for (const seed of [137, 6112]) {
    const a = TB.game.createGame(seed);
    const pre = QUICK ? 800 : 2000, post = 600;
    for (let i = 0; i < pre; i++) { TB.game.tick(a, DT); a.pending.length = 0; }
    const b = TB.game.load(JSON.parse(JSON.stringify(TB.game.save(a))));
    if (TB.validate.fingerprint(a) !== TB.validate.fingerprint(b))
      errs.push('seed ' + seed + ': fingerprint changed across save/load');
    for (let i = 0; i < post; i++) {
      TB.game.tick(a, DT); a.pending.length = 0;
      TB.game.tick(b, DT); b.pending.length = 0;
    }
    if (TB.validate.fingerprint(a) !== TB.validate.fingerprint(b))
      errs.push('seed ' + seed + ': diverged ' + post + ' ticks after save/load');
  }
  gate('SAVE/LOAD: round-trips and continues identically', errs);
}

// ---- Gate 6: STORY coverage ----
{
  const errs = [];

  // (a) A winning run sees every age beat plus the meet-up epilogue.
  const winSeed = 4147;
  const ws = TB.game.createGame(winSeed);
  let won = false, guard = 0;
  while (!ws.over && guard++ < 4e6) { TB.game.tick(ws, DT); bot(ws);
    for (const p of ws.pending) if (p.kind === 'ending') won = true;
    ws.pending.length = 0; }
  if (!won) errs.push('expected seed ' + winSeed + ' to be winnable for the story gate');
  else for (const id of ['intro', 'mozi', 'copernicus', 'computer', 'einstein', 'unsolvable', 'meet-up'])
    if (!ws.story.seenBeats[id]) errs.push('winning run never fired beat: ' + id);

  // (b) The mechanism: each chronicle/moment dispenses once and then not again.
  const st = TB.story.create();
  for (const key of ['chronicle-137', 'chronicle-183', 'chronicle-184']) {
    if (!TB.story.notice(st, key)) errs.push('notice() did not dispense ' + key);
    if (TB.story.notice(st, key)) errs.push('notice() dispensed ' + key + ' twice');
  }
  if (!TB.story.moment(st, 'king-wen')) errs.push('moment() did not dispense king-wen');
  if (TB.story.moment(st, 'king-wen')) errs.push('moment() dispensed king-wen twice');

  // (c) Integration: across varied seeds, the chronicle wiring actually fires.
  const union = {};
  for (let i = 0; i < (QUICK ? 8 : 24); i++) {
    const s = TB.game.createGame(3000 + i * 13);
    let g = 0;
    while (!s.over && s.day < 900 * 365.25 && g++ < 2e6) {
      TB.game.tick(s, DT); bot(s); s.pending.length = 0;
    }
    Object.assign(union, s.story.seenNotices);
  }
  const firedChronicles = ['chronicle-137', 'chronicle-183', 'chronicle-184'].filter(k => union[k]);
  if (firedChronicles.length === 0)
    errs.push('no chronicle card fired across any seed — wiring appears dead');
  else console.log('      (chronicles observed in play: ' + firedChronicles.join(', ') + ')');

  // (d) The King Wen disaster fires when a bold Stable calendar is broken.
  let kingWenFired = false;
  for (const seed of [4126, 4133, 1007, 3000, 5000]) {
    const s = TB.game.createGame(seed);
    let g = 0, issued = false;
    while (!s.over && g++ < 1.2e6 && !kingWenFired) {
      TB.game.tick(s, DT);
      if (!issued && !s.calendar && s.cl.eraType === 'stable' && !s.civ.dormant && s.civ.alive) {
        if (TB.game.cmdProclaim(s, 'stable', 3650)) issued = true;   // a bold promise
      }
      if (!s.calendar && issued) issued = false;                     // resolved; may re-issue
      if (s.story.seenBeats['king-wen']) kingWenFired = true;
      s.pending.length = 0;
    }
    if (kingWenFired) break;
  }
  if (!kingWenFired) errs.push('king-wen moment never fired despite bold failing calendars');

  gate('STORY: beats, chronicles & the King Wen disaster all fire', errs);
}

// ============================================================
console.log('\n' + (failures === 0
  ? '✓ ALL ' + gates + ' GATES PASSED\n'
  : '✗ ' + failures + ' issue(s) across ' + gates + ' gates\n'));
process.exit(failures === 0 ? 0 : 1);
