/* ============================================================
 * THREE BODY — util.ts
 * Shared helpers: seeded RNG, math, formatting. No DOM.
 * ============================================================ */
import type { Rng } from './types';

// ---- Seeded RNG (mulberry32) ----
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: number | string): Rng {
  const s = (typeof seed === 'string') ? hashString(seed) : (seed >>> 0);
  let a = s >>> 0;
  const f = function (): number {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed: s,
    getState: () => a >>> 0,                  // for exact save/load continuity
    setState: (v: number) => { a = v >>> 0; },
    next: f,                                  // [0,1)
    range: (lo: number, hi: number) => lo + (hi - lo) * f(),       // [lo,hi)
    int: (lo: number, hi: number) => lo + Math.floor(f() * (hi - lo + 1)), // [lo,hi] inclusive
    pick: <T>(arr: T[]) => arr[Math.floor(f() * arr.length)],
    gauss: function (): number {              // Box–Muller
      let u = 0, v = 0;
      while (u === 0) u = f();
      while (v === 0) v = f();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

// ---- Math helpers ----
export const clamp = (x: number, a: number, b: number): number => x < a ? a : (x > b ? b : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Exponential relaxation factor for timestep dt and time constant tau.
export const relax = (dt: number, tau: number): number => 1 - Math.exp(-dt / tau);

// ---- Formatting ----
export function fmtTemp(tC: number): string {
  if (!isFinite(tC)) return '—';
  return (tC > 0 ? '+' : '') + tC.toFixed(0) + '°C';
}
export function fmtPop(millions: number): string {
  if (millions <= 0) return '0';
  if (millions < 0.001) return Math.round(millions * 1e6).toLocaleString();
  if (millions < 1) return (millions * 1000).toFixed(0) + ' thousand';
  if (millions < 1000) return millions.toFixed(millions < 10 ? 1 : 0) + ' million';
  return (millions / 1000).toFixed(2) + ' billion';
}
export function fmtDays(d: number): string {
  if (d < 90) return Math.floor(d) + ' days';
  if (d < 365 * 2) return (d / 30.4).toFixed(0) + ' months';
  return (d / 365.25).toFixed(1) + ' years';
}
// In-game calendar: years/days since this civilization's founding.
export function fmtDate(dayOfCiv: number): string {
  const y = Math.floor(dayOfCiv / 365.25);
  const d = Math.floor(dayOfCiv - y * 365.25) + 1;
  return 'Year ' + (y + 1) + ', Day ' + d;
}
