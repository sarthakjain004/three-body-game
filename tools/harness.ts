/* ============================================================
 * THREE BODY — tools/harness.ts  (Node only)
 * Headless playtesting & seed vetting.
 *
 *   tsx tools/harness.ts sweep <nSeeds> [years]   — bot-plays many seeds
 *   tsx tools/harness.ts seed <seed> [years]      — detailed single run
 *   tsx tools/harness.ts energy <seed> [years]    — integrator drift check
 *   tsx tools/harness.ts vet <nSeeds> [years]     — emit src/seeds.ts with good seeds
 * ============================================================ */
import * as util from '../src/util';
import * as physics from '../src/physics';
import * as climate from '../src/climate';
import * as civ from '../src/civ';
import * as predict from '../src/predict';
import * as story from '../src/story';
import * as game from '../src/game';
import { SEEDS } from '../src/seeds';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __toolsDir = dirname(fileURLToPath(import.meta.url));
const TB: any = { util, physics, climate, civ, predict, story, game, SEEDS };

const DT = 0.5; // days per tick (matches the in-browser chunk size)

// A competent-but-not-perfect bot: mirrors what an attentive player does,
// including managing the water/grain reserves and keeping a working core
// awake rather than the whole populace.
function botAct(state) {
  const civ = state.civ, T = state.cl.tempC, cl = state.cl;
  if (!civ.alive || civ.dormant) return;
  const V = TB.civ;
  const sust = V.sustainablePop(civ, cl);
  const fdays = V.foodDays(civ);

  if (T < -4 || T > 42) {
    // Lethal sky: everyone sleeps.
    if (civ.popH > 0.001 && civ.order !== 'dehydrate') TB.game.cmdDehydrate(state, 1);
  } else if (fdays < 12 && civ.popH > sust * 1.3 && civ.order !== 'dehydrate') {
    // Famine looming: shed the populace down to what the land can feed.
    const frac = TB.util.clamp(1 - sust / civ.popH, 0.15, 1);
    TB.game.cmdDehydrate(state, frac);
  } else if (cl.eraType === 'stable' && T > 0 && T < 38 && civ.popD > 0.01
             && civ.order !== 'rehydrate' && fdays > 25 && civ.water > civ.popD * 0.3) {
    // Calm, fed, and watered: wake the people to work and grow.
    TB.game.cmdRehydrate(state, 1);
  }
  if (state.flags.autoUnlocked && !civ.autoProtocol) TB.game.cmdToggleAuto(state);
  if (state.flags.escape && civ.ageIdx >= 12 && !civ.fleet.building
      && civ.fleet.ships < 1000) TB.game.cmdFleet(state);
  // Spend Insight: survival first (stay alive), then the engine, then prediction.
  if (civ.insight > 0) {
    for (const id of ['s1', 's2', 'e1', 'e2', 's3', 'p1', 'e3', 'p2', 'p3'])
      if (!civ.doctrines[id] && TB.game.cmdBuyDoctrine(state, id)) break;
  }
}

function runSeed(seed, years, opts) {
  opts = opts || {};
  const state = TB.game.createGame(seed);
  const eras = [];           // {type, startDay, len}
  let lastEra = state.cl.eraType, eraStart = 0;
  const counts = { syzygy: 0, triday: 0, threefs: 0, engulf: 0, eject: 0, rip: 0 };
  let tMin = 99, tMax = -99;
  const days = years * 365.25;
  let firstPlanetLossYr = null, wonYear = null, sunEscapeYr = null;

  while (state.day < days && !state.over) {
    TB.game.tick(state, DT);
    botAct(state);
    for (const p of state.pending) {
      if (p.kind === 'planet-lost') {
        if (firstPlanetLossYr == null) firstPlanetLossYr = Math.floor(state.day / 365.25);
        if (counts[p.lostKind] != null) counts[p.lostKind]++;
      }
      if (p.kind === 'ending') wonYear = Math.floor(state.day / 365.25);
      if (p.kind === 'banner') {
        if (p.text === 'TRI-SOLAR SYZYGY') counts.syzygy++;
        if (p.text === 'TRI-SOLAR DAY') counts.triday++;
        if (p.text === 'THREE FLYING STARS') counts.threefs++;
      }
    }
    state.pending.length = 0;
    if (state.cl.eraType !== lastEra) {
      eras.push({ type: lastEra, len: state.day - eraStart });
      lastEra = state.cl.eraType; eraStart = state.day;
    }
    const T = state.cl.tempC;
    if (T < tMin) tMin = T;
    if (T > tMax) tMax = T;
    if (state.sunEscaped && sunEscapeYr == null) sunEscapeYr = Math.floor(state.day / 365.25);
    // count events from the log we haven't seen
  }
  eras.push({ type: lastEra, len: state.day - eraStart });

  const stableDays = eras.filter(e => e.type === 'stable').reduce((a, e) => a + e.len, 0);
  const totalDays = Math.max(1, state.day);
  const drift = TB.physics.energyDrift(state.sys);

  return {
    seed,
    years: Math.floor(state.day / 365.25),
    won: state.won, wonYear,
    over: state.over,
    civsLost: state.stats.civsLost,
    planetsLost: state.stats.planetsLost,
    firstPlanetLossYr,
    maxAge: state.stats.maxAge,
    maxAgeName: TB.civ.AGES[state.stats.maxAge].name,
    finalPop: TB.civ.totalPop(state.civ),
    stableFrac: stableDays / totalDays,
    nStable: eras.filter(e => e.type === 'stable').length,
    meanStableYr: eras.filter(e => e.type === 'stable').length
      ? stableDays / eras.filter(e => e.type === 'stable').length / 365.25 : 0,
    tMin: Math.round(tMin), tMax: Math.round(tMax),
    counts, sunEscapeYr,
    drift,
    eras,
  };
}

function fmtRow(r) {
  return [
    String(r.seed).padEnd(10),
    (r.won ? 'WON@' + r.wonYear : r.over ? 'DEAD@' + r.years : 'alive').padEnd(10),
    ('age:' + r.maxAge).padEnd(8),
    ('civs-:' + r.civsLost).padEnd(9),
    ('plan-:' + r.planetsLost).padEnd(9),
    ('stb:' + (r.stableFrac * 100).toFixed(0) + '%').padEnd(9),
    ('nStb:' + r.nStable).padEnd(9),
    ('T:' + r.tMin + '..' + r.tMax).padEnd(13),
    ('syz:' + r.counts.syzygy).padEnd(7),
    ('3fs:' + r.counts.threefs).padEnd(8),
    ('sunEsc:' + (r.sunEscapeYr == null ? '-' : r.sunEscapeYr)).padEnd(11),
    'drift:' + r.drift.toExponential(1),
  ].join(' ');
}

// Is this a seed we'd hand a new player? It must FEEL like the book:
// real alternation of eras, real extremes, real danger — but winnable.
function isGoodSeed(r, years) {
  if (r.sunEscapeYr != null && r.sunEscapeYr < 1200) return false;  // triple must survive
  if (r.firstPlanetLossYr != null && r.firstPlanetLossYr < 150) return false;
  if (r.planetsLost > 4) return false;
  if (r.stableFrac < 0.35 || r.stableFrac > 0.95) return false;     // mostly livable, but real chaos
  if (r.nStable < 4 || r.nStable > 110) return false;                // eras alternate, but no flapping
  if (r.tMin > -30 || r.tMax < 55) return false;                     // the sky must bite
  if (r.counts.syzygy > 20) return false;                            // syzygy spam
  if (r.civsLost < 1 || r.civsLost > 30) return false;               // some loss, no death spiral
  if (!r.won) return false;                                          // a fine bot player must win...
  if (r.wonYear < 220 || r.wonYear > 1300) return false;             // ...but not trivially
  return true;
}

const [, , cmd, a1, a2] = process.argv;

if (cmd === 'sweep' || cmd === 'vet') {
  const n = parseInt(a1 || '24', 10);
  const years = parseInt(a2 || '1500', 10);
  const offset = parseInt(process.argv[5] || '1000', 10);
  const good = [];
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const seed = offset + i * 7;
    const r = runSeed(seed, years);
    const ok = isGoodSeed(r, years);
    console.log((ok ? 'GOOD ' : '     ') + fmtRow(r));
    if (ok) good.push(r);
  }
  console.log('\n' + good.length + '/' + n + ' good seeds. ' +
    ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if (cmd === 'vet') {
    const list = good.map(r => r.seed);
    const out = '/* AUTO-GENERATED by tools/harness.ts vet — vetted starting systems */\n' +
      'export const SEEDS = ' + JSON.stringify(list) + ';\n';
    writeFileSync(join(__toolsDir, '..', 'src', 'seeds.ts'), out);
    console.log('Wrote src/seeds.ts with ' + list.length + ' seeds.');
  }
} else if (cmd === 'seed') {
  const r = runSeed(isNaN(+a1) ? a1 : +a1, parseInt(a2 || '1500', 10));
  console.log(fmtRow(r));
  console.log('\nEra timeline (first 40):');
  for (const e of r.eras.slice(0, 40)) {
    console.log('  ' + e.type.padEnd(8) + (e.len / 365.25).toFixed(1) + ' yr');
  }
} else if (cmd === 'energy') {
  const years = parseInt(a2 || '2000', 10);
  const rng = TB.util.makeRng(isNaN(+a1) ? a1 : +a1);
  const sys = TB.physics.createSystem(rng);
  const E0 = TB.physics.tripleEnergy(sys.suns);
  for (let y = 0; y <= years; y += 200) {
    console.log('t=' + y + 'yr  drift=' + TB.physics.energyDrift(sys).toExponential(2) +
      '  minSep=' + TB.physics.minSeparation(sys).toFixed(3));
    TB.physics.advance(sys, 200);
  }
} else {
  console.log('usage: tsx tools/harness.ts sweep|vet|seed|energy ...');
}
