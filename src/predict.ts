/* ============================================================
 * THREE BODY — predict.ts
 * The three generations of prophecy from the book:
 *   1. King Wen's divination (I Ching) — poetry and guesswork
 *   2. Mozi's celestial machine — clockwork extrapolation
 *   3. The Human-Computer ensemble — true numerical integration,
 *      honestly defeated by chaos (sensitive dependence on
 *      initial conditions limits the horizon).
 * Plus proclamations: staking the civilization on a forecast.
 * Pure JS, no DOM.
 * ============================================================ */
import * as P from './physics';
import * as C from './climate';
import * as U from './util';
import type { System, Climate, Rng, Forecast } from './types';

// ----------------------------------------------------------
// 1. Divination — flavor, vagueness, and a coin-flip's wisdom
// ----------------------------------------------------------
const HEXAGRAMS = [
  ['䷀ The Creative', 'Heaven moves with vigor. The sun shall keep its course.'],
  ['䷁ The Receptive', 'Earth lies still and patient. Endure, and await the dawn.'],
  ['䷃ Youthful Folly', 'Mists obscure the mountain spring. The sky cannot be read.'],
  ['䷊ Peace', 'Heaven and earth unite. A gentle age approaches.'],
  ['䷋ Standstill', 'Heaven and earth do not meet. The suns withdraw their favor.'],
  ['䷜ The Abysmal', 'Water flows into the deep. Cold upon cold descends.'],
  ['䷝ The Clinging Fire', 'Brightness doubled blazes forth. Beware the twinned light.'],
  ['䷲ The Arousing', 'Thunder shakes the firmament. The order of the sky breaks.'],
];

function divination(cl: Climate, rng: Rng) {
  const [name, verse] = rng.pick(HEXAGRAMS);
  // Marginally better than chance: weak persistence bias.
  const persist = rng.next() < 0.55;
  const guessStable = persist ? (cl.eraType === 'stable') : (cl.eraType !== 'stable');
  return {
    hexagram: name,
    verse,
    guess: guessStable ? 'stable' : 'chaotic',
    horizon: rng.int(20, 120),
  };
}

// ----------------------------------------------------------
// 2. Mozi's model — assumes the current orbit is a fixed
//    celestial machine that will repeat forever.
// ----------------------------------------------------------
function moziModel(sys: System, cl: Climate) {
  const obs = P.observe(sys);
  if (obs.primary < 0 || obs.pert > 0.5) {
    return {
      ok: false,
      text: 'The spheres will not mesh — the sun refuses every gear I build. ' +
            'No period fits the present sky.',
    };
  }
  const o = obs.suns[obs.primary];
  // Osculating orbit around the primary.
  const a = -P.G * o.m / (2 * o.eOrb);             // semi-major axis (AU)
  const period = (a > 0) ? 2 * Math.PI * Math.sqrt(a * a * a / (P.G * o.m)) : NaN;
  const tNow = C.equilibriumTemp(o.flux);
  return {
    ok: true,
    primary: obs.primary,
    periodDays: period * 365.25,
    a,
    tPredicted: tNow,
    pert: obs.pert,
    text: 'The machine of the sky is wound: our world rides a sphere about one sun, ' +
          'period ' + (isFinite(period) ? (period * 365.25).toFixed(0) : '?') +
          ' days, at ' + a.toFixed(2) + ' units of distance. By this model the ' +
          'current weather shall repeat for ten thousand years.' +
          (obs.pert > 0.08 ? ' (Yet the other suns tug at the gears...)' : ''),
  };
}

// ----------------------------------------------------------
// 3. Ensemble forecast — clone the system, perturb the
//    measured sun states by epsilon, integrate every member,
//    and report where the futures agree.
// ----------------------------------------------------------
/**
 * @param sys      live system (not modified)
 * @param days     forecast horizon in days
 * @param members  ensemble size (first member is unperturbed)
 * @param eps      relative measurement error of sun positions/velocities
 * @param rng      seeded RNG
 */
function ensembleForecast(sys: System, days, members, eps, rng: Rng): Forecast {
  const clones = [];
  for (let k = 0; k < members; k++) {
    const c = P.cloneSystem(sys);
    if (k > 0) {
      for (const s of c.suns) {
        s.x += rng.gauss() * eps * Math.max(1, Math.abs(s.x));
        s.y += rng.gauss() * eps * Math.max(1, Math.abs(s.y));
        s.vx += rng.gauss() * eps * Math.max(1, Math.abs(s.vx));
        s.vy += rng.gauss() * eps * Math.max(1, Math.abs(s.vy));
      }
    }
    clones.push(c);
  }
  const tMean = [], tMin = [], tMax = [];
  let horizonDay = days;
  const SPREAD_LIMIT = 25;   // °C of ensemble disagreement = useless forecast
  for (let d = 0; d < days; d++) {
    let lo = Infinity, hi = -Infinity, sum = 0;
    for (const c of clones) {
      P.advance(c, 1 / 365.25);
      const t = C.equilibriumTemp(P.observe(c).fluxTotal);
      if (t < lo) lo = t;
      if (t > hi) hi = t;
      sum += t;
    }
    tMin.push(lo); tMax.push(hi); tMean.push(sum / clones.length);
    if (horizonDay === days && hi - lo > SPREAD_LIMIT) horizonDay = d;
  }
  return { days, tMean, tMin, tMax, horizonDay };
}

// Measurement precision by technological age (smaller = better).
function epsForAge(ageIdx) {
  if (ageIdx >= 11) return 2.5e-4;   // Information Age instruments
  if (ageIdx >= 10) return 7e-4;     // Atomic Age (Einstein's gift)
  return 2.5e-3;                     // the Human Computer era
}

// ----------------------------------------------------------
// Proclamations — staking the calendar (and lives) on a call.
// A proclamation is a bet on a TRANSITION, not on the current
// weather: it records the chaotic-era counter at creation and
// resolves only when a NEW chaotic era begins (or fails to).
// (Resolving on the instantaneous era allowed an infinite trust
// pump from the opening Chaotic Era — found by adversarial review.)
// ----------------------------------------------------------
function createProclamation(kind, days, day, cl: Climate) {
  return { kind, startDay: day, endDay: day + days, state: 'pending',
           startChaoticNo: cl ? cl.chaoticEraNo : 0 };
}

/** Resolve against current climate. Mutates proc.state; returns it. */
function checkProclamation(proc, cl: Climate, day) {
  if (proc.state !== 'pending') return proc.state;
  const newChaos = cl.chaoticEraNo > (proc.startChaoticNo != null ? proc.startChaoticNo : 0);
  if (proc.kind === 'stable') {
    if (newChaos) proc.state = 'failure';
    else if (day >= proc.endDay) proc.state = 'success';
  } else { // 'chaos'
    if (newChaos) proc.state = 'success';
    else if (day >= proc.endDay) proc.state = 'failure';
  }
  return proc.state;
}

export {
  divination, moziModel, ensembleForecast, epsForAge,
  createProclamation, checkProclamation,
};
