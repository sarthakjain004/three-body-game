/* ============================================================
 * THREE BODY — climate.ts
 * Surface temperature, era classification (Stable vs Chaotic),
 * and celestial event detection. Everything here is DERIVED
 * from the physics — nothing is scripted.
 * Pure JS, no DOM.
 * ============================================================ */
import * as U from './util';
import type { Climate, Observation } from './types';

// --- Tunables (vetted by tools/harness.js) ---
const CAL_T = 287;          // K at combined flux f = 1 (one sun, 1 AU)
const T_FLOOR = -178;       // °C — geothermal / atmospheric floor
const TAU_WARM = 2.0;       // days, thermal lag while heating
const TAU_COOL = 7.0;       // days, thermal lag while cooling
const PERT_STABLE = 0.12;   // perturbation ratio below ⇒ orderly orbit
const PERT_BREAK = 0.22;    // above ⇒ orbit being torn up
const STABLE_AFTER = 25;    // days of order before a Stable Era is declared
const CHAOS_AFTER = 6;      // days of disorder before Chaos is declared
// In the novel a Stable Era is the predictable AND livable time a civilization
// can grow — so "orderly" requires not just a dominant sun but a survivable
// sky. A stable-but-lethal orbit (e.g. a tight orbit around a hot sun) is a
// Chaotic Era. Bands track civ.ts's hydrated survival range (−10…45 °C), with
// hysteresis so the era doesn't flap at the edge.
const LIVABLE_LO = -10, LIVABLE_HI = 45;   // °C — within ⇒ a Stable Era may be declared
const LETHAL_LO = -16, LETHAL_HI = 50;     // °C — beyond ⇒ a Stable Era breaks (Chaotic)
const LETHAL_AFTER = 6;     // days of persistent lethal sky before a Stable Era breaks
const DISC_DIST = 2.2;      // AU — nearer than this, a sun shows a disc
const FLY_DIST = 2.8;       // AU — farther than this, a sun is a "flying star"
const ENGULF_DIST = 0.03;   // AU — the planet skims the photosphere
const SYZ_SPREAD = 0.10;    // rad (~5.7°) — angular fan for a syzygy
// Severity thresholds for the ALIGNMENT-INDUCED tide: Σ m/d³ over the
// companion suns only. The primary's own tide is a constant of the
// orbit, not a syzygy spike (counting it caused catastrophe spam on
// close orbits — found by adversarial review).
const SYZ_MINOR = 0.5, SYZ_MAJOR = 4, SYZ_RIP = 60;

function createClimate() {
  return {
    tempC: 5,
    eraType: 'chaotic',       // 'stable' | 'chaotic'
    stableEraNo: 0,           // count of Stable Eras this civilization
    chaoticEraNo: 1,
    eraStartDay: 0,           // game day the current era began
    orderDays: 0,             // consecutive days the orbit looked orderly
    disorderDays: 0,
    livableDays: 0,           // consecutive days the sky was survivable
    lethalDays: 0,            // consecutive days the sky was lethal
    // event latches / cooldowns (game-day timestamps)
    latch3fs: false,          // three flying stars currently showing
    latchTriDay: false,
    latchDouble: false,
    latchEclipse: false,
    lastSyzygyDay: -1e9,
    // daily history for charts: arrays of {day, tempC, flux, d:[d0,d1,d2]}
    history: [],
    lastSampleDay: -1,
    // cached observation summary for the renderer
    view: null,
  };
}

// Equilibrium surface temperature (°C) for combined stellar flux f
// (in units of "one solar luminosity at 1 AU").
function equilibriumTemp(f) {
  const tK = CAL_T * Math.pow(Math.max(f, 0), 0.25);
  return Math.max(tK - 273.15, T_FLOOR);
}

/**
 * Advance climate by dtDays given the current physics observation.
 * Returns an array of event objects: {type, severity?, text-relevant data}.
 * @param cl   climate state
 * @param obs  TB.physics.observe(sys) result
 * @param day  current absolute game day
 */
function update(cl: Climate, obs: Observation, day, dtDays) {
  const events = [];

  // ---- Temperature with thermal inertia ----
  const tTarget = equilibriumTemp(obs.fluxTotal);
  const tau = tTarget > cl.tempC ? TAU_WARM : TAU_COOL;
  cl.tempC += (tTarget - cl.tempC) * U.relax(dtDays, tau);

  // ---- Era classification with hysteresis ----
  // Orbit regularity (reacts fast) and sky livability (reacts slower) are
  // tracked separately: a Stable Era needs BOTH a dominant sun AND a survivable
  // sky for STABLE_AFTER days, and it breaks the moment the orbit is torn up —
  // but only on PERSISTENT killing heat/cold, so it doesn't flicker on brief
  // temperature spikes. (`|| 0` guards saves written before these counters.)
  const orderly = obs.primary >= 0 && obs.pert < PERT_STABLE;
  const disorderly = obs.primary < 0 || obs.pert > PERT_BREAK;
  const livable = cl.tempC > LIVABLE_LO && cl.tempC < LIVABLE_HI;
  const lethal = cl.tempC < LETHAL_LO || cl.tempC > LETHAL_HI;
  cl.orderDays = orderly ? (cl.orderDays || 0) + dtDays : 0;
  cl.disorderDays = disorderly ? (cl.disorderDays || 0) + dtDays : 0;
  cl.livableDays = livable ? (cl.livableDays || 0) + dtDays : 0;
  cl.lethalDays = lethal ? (cl.lethalDays || 0) + dtDays : 0;

  if (cl.eraType === 'chaotic' &&
      cl.orderDays >= STABLE_AFTER && cl.livableDays >= STABLE_AFTER) {
    cl.eraType = 'stable';
    cl.stableEraNo += 1;
    cl.eraStartDay = day;
    events.push({ type: 'era', era: 'stable', no: cl.stableEraNo });
  } else if (cl.eraType === 'stable' &&
      (cl.disorderDays >= CHAOS_AFTER || cl.lethalDays >= LETHAL_AFTER)) {
    cl.eraType = 'chaotic';
    cl.chaoticEraNo += 1;
    cl.eraStartDay = day;
    events.push({ type: 'era', era: 'chaotic', no: cl.chaoticEraNo });
  }

  // ---- Celestial events ----
  const flying = obs.suns.filter(o => o.d > FLY_DIST).length;
  const discs = obs.suns.filter(o => o.d < DISC_DIST).length;

  // Three flying stars: all suns receding — the omen of a long freeze.
  const threeFS = flying === 3;
  if (threeFS && !cl.latch3fs) events.push({ type: 'three-flying-stars' });
  cl.latch3fs = threeFS;

  // Tri-solar day: three discs at once, world on fire.
  const triDay = discs === 3 && cl.tempC > 50;
  if (triDay && !cl.latchTriDay) events.push({ type: 'tri-solar-day' });
  cl.latchTriDay = triDay;

  // Double-sun day: two discs, severe heat.
  const dbl = discs === 2 && cl.tempC > 55;
  if (dbl && !cl.latchDouble && !triDay) events.push({ type: 'double-sun' });
  cl.latchDouble = dbl;

  // Eclipse: one sun passes before another — their discs overlap in the
  // sky. Deterministic from true sky angles (no RNG); purely a portent.
  let eclipse = false;
  for (let i = 0; i < 3 && !eclipse; i++)
    for (let j = i + 1; j < 3; j++) {
      const a = obs.suns[i], b = obs.suns[j];
      if (a.d < DISC_DIST && b.d < DISC_DIST) {
        let dd = Math.abs(a.dir - b.dir) % (2 * Math.PI);
        if (dd > Math.PI) dd = 2 * Math.PI - dd;
        if (dd < (a.angSize + b.angSize) * 0.5) { eclipse = true; break; }
      }
    }
  if (eclipse && !cl.latchEclipse) events.push({ type: 'eclipse' });
  cl.latchEclipse = eclipse;

  // Tri-solar syzygy: the suns stack into a line — tides rip the surface.
  if (obs.alignSpread < SYZ_SPREAD && day - cl.lastSyzygyDay > 45) {
    const ti = obs.tidalSum - (obs.primary >= 0 ? obs.suns[obs.primary].tidal : 0);
    if (ti > SYZ_MINOR) {
      cl.lastSyzygyDay = day;
      const sev = ti > SYZ_RIP ? 'rip' : ti > SYZ_MAJOR ? 'major' : 'minor';
      events.push({ type: 'syzygy', severity: sev, tidal: ti });
    }
  }

  // Engulfment: the planet falls into a sun's photosphere. Uses the
  // deepest approach of the whole tick (obs.minDistTick), not just the
  // end-of-tick snapshot, so fast passes cannot tunnel through.
  const dEng = obs.minDistTick != null ? Math.min(obs.minDist, obs.minDistTick) : obs.minDist;
  if (dEng < ENGULF_DIST) events.push({ type: 'engulf' });

  // ---- Daily history sample (for the Observatory charts) ----
  if (Math.floor(day) !== cl.lastSampleDay) {
    cl.lastSampleDay = Math.floor(day);
    cl.history.push({
      day: Math.floor(day),
      tempC: Math.round(cl.tempC * 10) / 10,
      flux: obs.fluxTotal,
      d: obs.suns.map(o => Math.round(o.d * 1000) / 1000),
    });
    if (cl.history.length > 1500) cl.history.splice(0, cl.history.length - 1500);
  }

  // Renderer summary.
  cl.view = {
    flying, discs,
    pert: obs.pert,
    primary: obs.primary,
    alignSpread: obs.alignSpread,
    tidalSum: obs.tidalSum,
  };

  return events;
}

// Human-readable era label, in the voice of the game's registrar.
function eraLabel(cl: Climate) {
  return cl.eraType === 'stable'
    ? 'Stable Era No. ' + cl.stableEraNo
    : 'Chaotic Era No. ' + cl.chaoticEraNo;
}

export {
  createClimate, update, equilibriumTemp, eraLabel,
};
export const consts = { CAL_T, T_FLOOR, DISC_DIST, FLY_DIST, ENGULF_DIST,
          SYZ_MINOR, SYZ_MAJOR, SYZ_RIP, PERT_STABLE };
