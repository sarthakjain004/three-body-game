/* ============================================================
 * THREE BODY — tools/bench.js  (Node only, zero-dependency)
 * Measures the simulation's headless throughput so the perf
 * claims in the README are real, reproducible numbers rather
 * than adjectives. Loads only the DOM-free logic modules.
 *   node tools/bench.js [seed]
 * ============================================================ */
'use strict';
const path = require('path');
const J = (f) => path.join(__dirname, '..', 'js', f);
for (const f of ['util.js', 'physics.js', 'climate.js', 'civ.js',
                 'predict.js', 'story.js', 'game.js', 'seeds.js', 'validate.js']) {
  require(J(f));
}
const TB = globalThis.TB;
const now = () => Number(process.hrtime.bigint()) / 1e6;  // ms, monotonic

const seed = process.argv[2] ? +process.argv[2] : 2007;
const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

// --- 1) N-body core: gravitational integration throughput ---
function benchPhysics(years, chunk) {
  const sys = TB.game.createGame(seed).sys;
  for (let y = 0; y < 5; y += chunk) TB.physics.advance(sys, chunk);  // warmup (JIT)
  const t0 = now();
  let done = 0;
  for (; done < years; done += chunk) TB.physics.advance(sys, chunk);
  const ms = now() - t0;
  return { simYears: done, ms, perSec: done / (ms / 1000) };
}

// --- 2) Full game step: physics + climate + civ + story ---
function benchGameTick(days, chunk) {
  let st = TB.game.createGame(seed);
  for (let i = 0; i < 2000; i++) { TB.game.tick(st, chunk); st.pending.length = 0; }  // warmup
  st = TB.game.createGame(seed);
  const t0 = now();
  let d = 0;
  for (; d < days; d += chunk) {
    TB.game.tick(st, chunk);
    st.pending.length = 0;                 // drain events (UI would consume them)
    if (st.over) st = TB.game.createGame(seed + d);  // keep measuring real work
  }
  const ms = now() - t0;
  return { simDays: d, ms, daysPerSec: d / (ms / 1000) };
}

console.log('\nTHREE BODY — performance benchmark  (seed ' + seed + ', Node ' + process.version + ')\n');

const p = benchPhysics(2000, 0.1);
console.log('  N-body core (3-sun Yoshida-4 integration, single thread)');
console.log('    ' + fmt(p.perSec) + ' simulated game-years / sec   (' +
            fmt(p.simYears) + ' yr in ' + p.ms.toFixed(0) + ' ms)\n');

const g = benchGameTick(200000, 0.5);
const yrPerSec = g.daysPerSec / 365.25;
const MAX_SPEED = 365;  // in-game max: days of game time per real second
const cpuMsPerSec = 1000 * MAX_SPEED / g.daysPerSec;   // CPU ms spent per real second at top speed
console.log('  Full game step (physics + climate + civilization + story)');
console.log('    ' + fmt(g.daysPerSec) + ' game-days / sec  (~' + fmt(yrPerSec) + ' game-years / sec)');
console.log('    = ' + fmt(g.daysPerSec / MAX_SPEED) + '× the in-game max speed (' + MAX_SPEED + ' days/s):');
console.log('      at top speed the sim costs ~' + cpuMsPerSec.toFixed(1) +
            ' ms of CPU per real second (~' + (cpuMsPerSec / 10).toFixed(1) +
            '% of one core), leaving the frame budget for rendering.\n');

const mem = process.memoryUsage().heapUsed / 1048576;
console.log('  Heap in use after the runs: ' + mem.toFixed(1) + ' MB\n');
