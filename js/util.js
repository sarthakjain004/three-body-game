/* ============================================================
 * THREE BODY — util.js
 * Shared helpers: namespace, seeded RNG, math, formatting.
 * Pure JS, no DOM. Loadable in browser and Node.
 * ============================================================ */
'use strict';
var TB = globalThis.TB = globalThis.TB || {};

(function () {

  // ---- Seeded RNG (mulberry32) ----
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seed) {
    const s = (typeof seed === 'string') ? hashString(seed) : (seed >>> 0);
    let a = s >>> 0;
    const f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      seed: s,
      getState: () => a >>> 0,                  // for exact save/load continuity
      setState: (v) => { a = v >>> 0; },
      next: f,                                  // [0,1)
      range: (a, b) => a + (b - a) * f(),       // [a,b)
      int: (a, b) => a + Math.floor(f() * (b - a + 1)), // [a,b] inclusive
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      gauss: function () {                      // Box–Muller
        let u = 0, v = 0;
        while (u === 0) u = f();
        while (v === 0) v = f();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
    };
  }

  // ---- Math helpers ----
  const clamp = (x, a, b) => x < a ? a : (x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  // Exponential relaxation factor for timestep dt and time constant tau.
  const relax = (dt, tau) => 1 - Math.exp(-dt / tau);

  // ---- Formatting ----
  function fmtTemp(tC) {
    if (!isFinite(tC)) return '—';
    return (tC > 0 ? '+' : '') + tC.toFixed(0) + '°C';
  }
  function fmtPop(millions) {
    if (millions <= 0) return '0';
    if (millions < 0.001) return Math.round(millions * 1e6).toLocaleString();
    if (millions < 1) return (millions * 1000).toFixed(0) + ' thousand';
    if (millions < 1000) return millions.toFixed(millions < 10 ? 1 : 0) + ' million';
    return (millions / 1000).toFixed(2) + ' billion';
  }
  function fmtDays(d) {
    if (d < 90) return Math.floor(d) + ' days';
    if (d < 365 * 2) return (d / 30.4).toFixed(0) + ' months';
    return (d / 365.25).toFixed(1) + ' years';
  }
  // In-game calendar: years/days since this civilization's founding.
  function fmtDate(dayOfCiv) {
    const y = Math.floor(dayOfCiv / 365.25);
    const d = Math.floor(dayOfCiv - y * 365.25) + 1;
    return 'Year ' + (y + 1) + ', Day ' + d;
  }

  TB.util = { makeRng, hashString, clamp, lerp, smoothstep, relax,
              fmtTemp, fmtPop, fmtDays, fmtDate };
})();
