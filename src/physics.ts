/* ============================================================
 * THREE BODY — physics.ts
 * Real gravitational simulation of the Trisolaran system:
 * three suns evolved as a mutual N-body problem (symplectic
 * Yoshida-4, adaptive substeps), the planet as a test particle.
 *
 * Units: AU, years, solar masses.  G = 4π².
 * No DOM. Loadable in browser and Node.
 * ============================================================ */
import { clamp } from './util';
import type { Rng, Sun, Planet, System, Observation } from './types';

export const G = 4 * Math.PI * Math.PI;
const SOFT2 = 1e-6;            // gravitational softening (AU²)
export const BASE_DT = 2e-4;   // years (~1.75 hours) at wide separations
export const SUN_RADIUS = 0.00465;    // AU (solar radius)

// ---------------------------------------------------------
// System creation
// ---------------------------------------------------------

// Build a bound triple + planet, from an RNG. The workhorse family is the
// MARGINALLY HIERARCHICAL triple: a close binary plus an outer sun on an
// eccentric orbit near the stability boundary — long-lived yet chaotic.
export function createSystem(rng: Rng): System {
  const suns: Sun[] = [];
  for (let i = 0; i < 3; i++) {
    const m = rng.range(0.75, 1.25);
    suns.push({
      m,
      L: Math.pow(m, 3.5),     // main-sequence mass–luminosity
      x: 0, y: 0, vx: 0, vy: 0,
    });
  }

  if (rng.next() < 0.8) {
    // --- Marginally hierarchical family ---
    const [A, B, Cc] = suns;
    const mIn = A.m + B.m;
    const aIn = rng.range(0.8, 1.6);            // inner binary separation
    const thIn = rng.range(0, 2 * Math.PI);
    const vIn = Math.sqrt(G * mIn / aIn);       // circular relative speed
    const fA = B.m / mIn, fB = A.m / mIn;
    A.x = fA * aIn * Math.cos(thIn);  A.y = fA * aIn * Math.sin(thIn);
    B.x = -fB * aIn * Math.cos(thIn); B.y = -fB * aIn * Math.sin(thIn);
    A.vx = fA * vIn * -Math.sin(thIn); A.vy = fA * vIn * Math.cos(thIn);
    B.vx = -fB * vIn * -Math.sin(thIn); B.vy = -fB * vIn * Math.cos(thIn);
    const ratio = rng.range(2.8, 4.2);
    const aOut = ratio * aIn;
    const eOut = rng.range(0.1, 0.35);
    const thOut = rng.range(0, 2 * Math.PI);
    const rOut = aOut * (1 + eOut);
    const mTot = mIn + Cc.m;
    const vApo = Math.sqrt(G * mTot * (2 / rOut - 1 / aOut));
    const sense = rng.next() < 0.5 ? 1 : -1;
    Cc.x = rOut * Math.cos(thOut); Cc.y = rOut * Math.sin(thOut);
    Cc.vx = sense * -Math.sin(thOut) * vApo;
    Cc.vy = sense * Math.cos(thOut) * vApo;
  } else {
    // --- Random scramble family ---
    const scale = rng.range(2.2, 5.5);
    for (const s of suns) {
      const r = scale * rng.range(0.55, 1.15);
      const th = rng.range(0, 2 * Math.PI);
      s.x = r * Math.cos(th);
      s.y = r * Math.sin(th);
    }
    const sense = rng.next() < 0.5 ? 1 : -1;
    const rotF = rng.range(0.35, 0.8), noise = rng.range(0.25, 0.6);
    for (const s of suns) {
      const r = Math.hypot(s.x, s.y) || 1;
      const vCirc = Math.sqrt(G * 2.0 / r) * rotF;
      s.vx = sense * (-s.y / r) * vCirc + rng.gauss() * noise;
      s.vy = sense * (s.x / r) * vCirc + rng.gauss() * noise;
    }
  }
  zeroMomentum(suns);
  for (let k = 0; k < 40 && tripleEnergy(suns) >= 0; k++) {
    for (const s of suns) { s.vx *= 0.85; s.vy *= 0.85; }
  }

  const sys: System = {
    suns,
    planet: { x: 0, y: 0, vx: 0, vy: 0, alive: true },
    t: 0,
    E0: 0,
  };
  const spawn = chooseSpawn(sys);
  placePlanet(sys, spawn.idx, spawn.r, rng);
  sys.E0 = tripleEnergy(suns);
  return sys;
}

// Pick the best sun to spawn the planet around, and an orbital radius.
export function chooseSpawn(sys: System) {
  const b = sys.suns;
  const cand: Array<{ idx: number; r: number; quality: number; dNear: number; bound: boolean }> = [];
  for (let i = 0; i < 3; i++) {
    let Mo = 0, ox = 0, oy = 0, ovx = 0, ovy = 0;
    for (let j = 0; j < 3; j++) {
      if (j === i) continue;
      Mo += b[j].m; ox += b[j].m * b[j].x; oy += b[j].m * b[j].y;
      ovx += b[j].m * b[j].vx; ovy += b[j].m * b[j].vy;
    }
    ox /= Mo; oy /= Mo; ovx /= Mo; ovy /= Mo;
    const rO = Math.hypot(b[i].x - ox, b[i].y - oy);
    const v2 = (b[i].vx - ovx) ** 2 + (b[i].vy - ovy) ** 2;
    const bound = 0.5 * v2 - G * (Mo + b[i].m) / Math.max(rO, 1e-6) < 0;
    let dNear = Infinity;
    for (let j = 0; j < 3; j++) {
      if (j === i) continue;
      const d = Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y);
      if (d < dNear) dNear = d;
    }
    const rTemp = Math.sqrt(b[i].L);          // flux = 1 ⇒ ~14°C
    const hillMax = 0.2 * dNear;
    const r = clamp(Math.min(rTemp, hillMax), Math.min(0.3, hillMax), 2.0);
    const quality = r / rTemp;
    cand.push({ idx: i, r, quality, dNear, bound });
  }
  let pool = cand.filter(c => c.bound);
  if (pool.length === 0) pool = cand;
  pool.sort((a, b2) => (b2.quality - a.quality) || (b2.dNear - a.dNear));
  return pool[0];
}

function zeroMomentum(suns: Sun[]): void {
  let M = 0, px = 0, py = 0, cx = 0, cy = 0;
  for (const s of suns) { M += s.m; px += s.m * s.vx; py += s.m * s.vy; cx += s.m * s.x; cy += s.m * s.y; }
  for (const s of suns) { s.vx -= px / M; s.vy -= py / M; s.x -= cx / M; s.y -= cy / M; }
}

export function tripleEnergy(suns: Sun[]): number {
  let E = 0;
  for (const s of suns) E += 0.5 * s.m * (s.vx * s.vx + s.vy * s.vy);
  for (let i = 0; i < suns.length; i++)
    for (let j = i + 1; j < suns.length; j++) {
      const dx = suns[i].x - suns[j].x, dy = suns[i].y - suns[j].y;
      E -= G * suns[i].m * suns[j].m / Math.sqrt(dx * dx + dy * dy + SOFT2);
    }
  return E;
}

// Put the planet on a (near-)circular orbit around sun `idx`.
export function placePlanet(sys: System, idx: number, r: number, rng?: Rng): void {
  const s = sys.suns[idx];
  const th = rng ? rng.range(0, 2 * Math.PI) : 0;
  const v = Math.sqrt(G * s.m / r);
  const sense = (rng && rng.next() < 0.5) ? -1 : 1;
  sys.planet.x = s.x + r * Math.cos(th);
  sys.planet.y = s.y + r * Math.sin(th);
  sys.planet.vx = s.vx + sense * (-Math.sin(th)) * v;
  sys.planet.vy = s.vy + sense * (Math.cos(th)) * v;
  sys.planet.alive = true;
}

// ---------------------------------------------------------
// Integration — 4th-order Yoshida symplectic composition of
// drift-kick-drift leapfrogs, on [3 suns + planet].
// ---------------------------------------------------------

const CBRT2 = Math.cbrt(2);
const YOSH_W1 = 1 / (2 - CBRT2);          //  1.35120719...
const YOSH_W0 = -CBRT2 / (2 - CBRT2);     // -1.70241438...

// Accelerations at current positions: suns mutual + planet test particle.
function accelerations(sys: System, acc: Float64Array): void {
  const b = sys.suns, p = sys.planet;
  for (let i = 0; i < 3; i++) {
    let ax = 0, ay = 0;
    for (let j = 0; j < 3; j++) {
      if (j === i) continue;
      const dx = b[j].x - b[i].x, dy = b[j].y - b[i].y;
      const r2 = dx * dx + dy * dy + SOFT2;
      const inv = G * b[j].m / (r2 * Math.sqrt(r2));
      ax += dx * inv; ay += dy * inv;
    }
    acc[i * 2] = ax; acc[i * 2 + 1] = ay;
  }
  let ax = 0, ay = 0;
  for (let j = 0; j < 3; j++) {
    const dx = b[j].x - p.x, dy = b[j].y - p.y;
    const r2 = dx * dx + dy * dy + SOFT2;
    const inv = G * b[j].m / (r2 * Math.sqrt(r2));
    ax += dx * inv; ay += dy * inv;
  }
  acc[6] = ax; acc[7] = ay;
}

const _acc = new Float64Array(8);

// One DKD leapfrog of size h (1 force evaluation).
function leapfrog(sys: System, h: number): void {
  const b = sys.suns, p = sys.planet;
  const h2 = h / 2;
  for (let i = 0; i < 3; i++) { b[i].x += b[i].vx * h2; b[i].y += b[i].vy * h2; }
  p.x += p.vx * h2; p.y += p.vy * h2;
  accelerations(sys, _acc);
  for (let i = 0; i < 3; i++) { b[i].vx += _acc[i * 2] * h; b[i].vy += _acc[i * 2 + 1] * h; }
  p.vx += _acc[6] * h; p.vy += _acc[7] * h;
  for (let i = 0; i < 3; i++) { b[i].x += b[i].vx * h2; b[i].y += b[i].vy * h2; }
  p.x += p.vx * h2; p.y += p.vy * h2;
}

// One Yoshida-4 step (3 force evaluations).
function yoshida4Step(sys: System, dt: number): void {
  leapfrog(sys, YOSH_W1 * dt);
  leapfrog(sys, YOSH_W0 * dt);
  leapfrog(sys, YOSH_W1 * dt);
  sys.t += dt;
}

// Smallest separation among sun–sun and planet–sun pairs (AU).
export function minSeparation(sys: System): number {
  let m = Infinity;
  const b = sys.suns, p = sys.planet;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const d = Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y);
      if (d < m) m = d;
    }
    if (p.alive) {
      const d = Math.hypot(b[i].x - p.x, b[i].y - p.y);
      if (d < m) m = d;
    }
  }
  return m;
}

// Advance the system by dtYears using adaptive substeps.
export function advance(sys: System, dtYears: number): void {
  let remaining = dtYears;
  const maxSteps = Math.ceil(dtYears / (BASE_DT / 4096)) + 64;
  let guard = 0;
  let minP = Infinity;
  const p = sys.planet;
  while (remaining > 1e-12 && guard++ < maxSteps) {
    const sep = minSeparation(sys);
    let dt = BASE_DT * clamp(Math.pow(sep / 0.5, 1.5), 1 / 4096, 1);
    if (dt > remaining) dt = remaining;
    yoshida4Step(sys, dt);
    remaining -= dt;
    for (let i = 0; i < 3; i++) {
      const d = Math.hypot(sys.suns[i].x - p.x, sys.suns[i].y - p.y);
      if (d < minP) minP = d;
    }
  }
  sys.tickMinPlanetDist = minP;
}

// ---------------------------------------------------------
// Observables (used by climate, prediction, rendering)
// ---------------------------------------------------------

// Per-sun view from the planet: distance, direction, flux, bound energy.
export function observe(sys: System): Observation {
  const p = sys.planet;
  const out: Observation = { suns: [], fluxTotal: 0, minDist: Infinity, tidalSum: 0, primary: -1, pert: 0, alignSpread: 0 };
  for (let i = 0; i < 3; i++) {
    const s = sys.suns[i];
    const dx = s.x - p.x, dy = s.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy + 1e-12);
    const flux = s.L / (d * d);
    const dvx = p.vx - s.vx, dvy = p.vy - s.vy;
    const eOrb = 0.5 * (dvx * dvx + dvy * dvy) - G * s.m / d;  // specific orbital energy
    const o = {
      i, d, dir: Math.atan2(dy, dx), flux,
      angSize: 2 * Math.atan2(SUN_RADIUS * Math.pow(s.m, 0.8), d),
      bound: eOrb < 0, eOrb,
      m: s.m, L: s.L,
      tidal: s.m / (d * d * d),
    };
    out.suns.push(o);
    out.fluxTotal += flux;
    out.tidalSum += o.tidal;
    if (d < out.minDist) out.minDist = d;
  }
  let prim = -1, eMin = 0;
  for (const o of out.suns) if (o.eOrb < eMin) { eMin = o.eOrb; prim = o.i; }
  out.primary = prim;
  if (prim >= 0) {
    const dp = out.suns[prim];
    let pert = 0;
    for (const o of out.suns) if (o.i !== prim) pert += o.m / (o.d * o.d);
    out.pert = pert / (dp.m / (dp.d * dp.d));
  } else {
    out.pert = Infinity;
  }
  const dirs = out.suns.map(o => o.dir);
  let maxSpread = 0;
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) {
      let dd = Math.abs(dirs[i] - dirs[j]) % (2 * Math.PI);
      if (dd > Math.PI) dd = 2 * Math.PI - dd;
      if (dd > maxSpread) maxSpread = dd;
    }
  out.alignSpread = maxSpread;
  return out;
}

// Distance of planet from system barycenter.
export function planetBaryDist(sys: System): number {
  let M = 0, cx = 0, cy = 0;
  for (const s of sys.suns) { M += s.m; cx += s.m * s.x; cy += s.m * s.y; }
  cx /= M; cy /= M;
  return Math.hypot(sys.planet.x - cx, sys.planet.y - cy);
}

// Is the planet truly lost?
export function planetEscaping(sys: System): boolean {
  const p = sys.planet;
  let minD = Infinity;
  for (const s of sys.suns) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < minD) minD = d;
    const v2 = (p.vx - s.vx) ** 2 + (p.vy - s.vy) ** 2;
    if (0.5 * v2 - G * s.m / Math.max(d, 1e-6) < 0) return false; // bound to this sun
  }
  if (minD < 20) return false;     // still among the suns (slingshot in progress)
  let M = 0, cx = 0, cy = 0, cvx = 0, cvy = 0;
  for (const s of sys.suns) { M += s.m; cx += s.m * s.x; cy += s.m * s.y; cvx += s.m * s.vx; cvy += s.m * s.vy; }
  cx /= M; cy /= M; cvx /= M; cvy /= M;
  const r = Math.hypot(p.x - cx, p.y - cy);
  if (r < 40) return false;
  const v2 = (p.vx - cvx) ** 2 + (p.vy - cvy) ** 2;
  return 0.5 * v2 - G * M / r > 0;
}

// Has a sun been ejected from the triple? Returns index or -1.
export function escapedSun(sys: System): number {
  const b = sys.suns;
  let M = 0, cx = 0, cy = 0, cvx = 0, cvy = 0;
  for (const s of b) { M += s.m; cx += s.m * s.x; cy += s.m * s.y; cvx += s.m * s.vx; cvy += s.m * s.vy; }
  cx /= M; cy /= M; cvx /= M; cvy /= M;
  for (let i = 0; i < 3; i++) {
    const s = b[i];
    const r = Math.hypot(s.x - cx, s.y - cy);
    if (r < 100) continue;
    const v2 = (s.vx - cvx) ** 2 + (s.vy - cvy) ** 2;
    if (0.5 * v2 - G * (M - s.m) / r > 0) return i;
  }
  return -1;
}

// Relative energy drift since creation (diagnostic).
export function energyDrift(sys: System): number {
  const E = tripleEnergy(sys.suns);
  return Math.abs((E - sys.E0) / sys.E0);
}

// Deep copy (for forecasting without disturbing the real system).
export function cloneSystem(sys: System): System {
  return {
    suns: sys.suns.map(s => ({ m: s.m, L: s.L, x: s.x, y: s.y, vx: s.vx, vy: s.vy })),
    planet: { x: sys.planet.x, y: sys.planet.y, vx: sys.planet.vx, vy: sys.planet.vy, alive: sys.planet.alive },
    t: sys.t,
    E0: sys.E0,
  };
}

// Serialize / restore (save games).
export function serialize(sys: System): System { return cloneSystem(sys); }
export function deserialize(obj: System): System { return cloneSystem(obj); }
