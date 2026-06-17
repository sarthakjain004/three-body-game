"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/util.ts
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seed) {
    const s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
    let a = s >>> 0;
    const f = function() {
      a |= 0;
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    return {
      seed: s,
      getState: () => a >>> 0,
      // for exact save/load continuity
      setState: (v) => {
        a = v >>> 0;
      },
      next: f,
      // [0,1)
      range: (lo, hi) => lo + (hi - lo) * f(),
      // [lo,hi)
      int: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
      // [lo,hi] inclusive
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      gauss: function() {
        let u = 0, v = 0;
        while (u === 0) u = f();
        while (v === 0) v = f();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      }
    };
  }
  function fmtTemp(tC) {
    if (!isFinite(tC)) return "—";
    return (tC > 0 ? "+" : "") + tC.toFixed(0) + "°C";
  }
  function fmtPop(millions) {
    if (millions <= 0) return "0";
    if (millions < 1e-3) return Math.round(millions * 1e6).toLocaleString();
    if (millions < 1) return (millions * 1e3).toFixed(0) + " thousand";
    if (millions < 1e3) return millions.toFixed(millions < 10 ? 1 : 0) + " million";
    return (millions / 1e3).toFixed(2) + " billion";
  }
  function fmtDays(d) {
    if (d < 90) return Math.floor(d) + " days";
    if (d < 365 * 2) return (d / 30.4).toFixed(0) + " months";
    return (d / 365.25).toFixed(1) + " years";
  }
  function fmtDate(dayOfCiv) {
    const y = Math.floor(dayOfCiv / 365.25);
    const d = Math.floor(dayOfCiv - y * 365.25) + 1;
    return "Year " + (y + 1) + ", Day " + d;
  }
  var clamp, lerp, smoothstep, relax;
  var init_util = __esm({
    "src/util.ts"() {
      "use strict";
      clamp = (x, a, b) => x < a ? a : x > b ? b : x;
      lerp = (a, b, t) => a + (b - a) * t;
      smoothstep = (a, b, x) => {
        const t = clamp((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };
      relax = (dt, tau) => 1 - Math.exp(-dt / tau);
    }
  });

  // src/physics.ts
  function createSystem(rng) {
    const suns = [];
    for (let i = 0; i < 3; i++) {
      const m = rng.range(0.75, 1.25);
      suns.push({
        m,
        L: Math.pow(m, 3.5),
        // main-sequence mass–luminosity
        x: 0,
        y: 0,
        vx: 0,
        vy: 0
      });
    }
    if (rng.next() < 0.8) {
      const [A, B, Cc] = suns;
      const mIn = A.m + B.m;
      const aIn = rng.range(0.8, 1.6);
      const thIn = rng.range(0, 2 * Math.PI);
      const vIn = Math.sqrt(G * mIn / aIn);
      const fA = B.m / mIn, fB = A.m / mIn;
      A.x = fA * aIn * Math.cos(thIn);
      A.y = fA * aIn * Math.sin(thIn);
      B.x = -fB * aIn * Math.cos(thIn);
      B.y = -fB * aIn * Math.sin(thIn);
      A.vx = fA * vIn * -Math.sin(thIn);
      A.vy = fA * vIn * Math.cos(thIn);
      B.vx = -fB * vIn * -Math.sin(thIn);
      B.vy = -fB * vIn * Math.cos(thIn);
      const ratio = rng.range(2.8, 4.2);
      const aOut = ratio * aIn;
      const eOut = rng.range(0.1, 0.35);
      const thOut = rng.range(0, 2 * Math.PI);
      const rOut = aOut * (1 + eOut);
      const mTot = mIn + Cc.m;
      const vApo = Math.sqrt(G * mTot * (2 / rOut - 1 / aOut));
      const sense = rng.next() < 0.5 ? 1 : -1;
      Cc.x = rOut * Math.cos(thOut);
      Cc.y = rOut * Math.sin(thOut);
      Cc.vx = sense * -Math.sin(thOut) * vApo;
      Cc.vy = sense * Math.cos(thOut) * vApo;
    } else {
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
        const vCirc = Math.sqrt(G * 2 / r) * rotF;
        s.vx = sense * (-s.y / r) * vCirc + rng.gauss() * noise;
        s.vy = sense * (s.x / r) * vCirc + rng.gauss() * noise;
      }
    }
    zeroMomentum(suns);
    for (let k = 0; k < 40 && tripleEnergy(suns) >= 0; k++) {
      for (const s of suns) {
        s.vx *= 0.85;
        s.vy *= 0.85;
      }
    }
    const sys = {
      suns,
      planet: { x: 0, y: 0, vx: 0, vy: 0, alive: true },
      t: 0,
      E0: 0
    };
    const spawn = chooseSpawn(sys);
    placePlanet(sys, spawn.idx, spawn.r, rng);
    sys.E0 = tripleEnergy(suns);
    return sys;
  }
  function chooseSpawn(sys) {
    const b = sys.suns;
    const cand = [];
    for (let i = 0; i < 3; i++) {
      let Mo = 0, ox = 0, oy = 0, ovx = 0, ovy = 0;
      for (let j = 0; j < 3; j++) {
        if (j === i) continue;
        Mo += b[j].m;
        ox += b[j].m * b[j].x;
        oy += b[j].m * b[j].y;
        ovx += b[j].m * b[j].vx;
        ovy += b[j].m * b[j].vy;
      }
      ox /= Mo;
      oy /= Mo;
      ovx /= Mo;
      ovy /= Mo;
      const rO = Math.hypot(b[i].x - ox, b[i].y - oy);
      const v2 = (b[i].vx - ovx) ** 2 + (b[i].vy - ovy) ** 2;
      const bound = 0.5 * v2 - G * (Mo + b[i].m) / Math.max(rO, 1e-6) < 0;
      let dNear = Infinity;
      for (let j = 0; j < 3; j++) {
        if (j === i) continue;
        const d = Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y);
        if (d < dNear) dNear = d;
      }
      const rTemp = Math.sqrt(b[i].L);
      const hillMax = 0.2 * dNear;
      const r = clamp(Math.min(rTemp, hillMax), Math.min(0.3, hillMax), 2);
      const quality = r / rTemp;
      cand.push({ idx: i, r, quality, dNear, bound });
    }
    let pool = cand.filter((c) => c.bound);
    if (pool.length === 0) pool = cand;
    pool.sort((a, b2) => b2.quality - a.quality || b2.dNear - a.dNear);
    return pool[0];
  }
  function zeroMomentum(suns) {
    let M = 0, px = 0, py = 0, cx = 0, cy = 0;
    for (const s of suns) {
      M += s.m;
      px += s.m * s.vx;
      py += s.m * s.vy;
      cx += s.m * s.x;
      cy += s.m * s.y;
    }
    for (const s of suns) {
      s.vx -= px / M;
      s.vy -= py / M;
      s.x -= cx / M;
      s.y -= cy / M;
    }
  }
  function tripleEnergy(suns) {
    let E = 0;
    for (const s of suns) E += 0.5 * s.m * (s.vx * s.vx + s.vy * s.vy);
    for (let i = 0; i < suns.length; i++)
      for (let j = i + 1; j < suns.length; j++) {
        const dx = suns[i].x - suns[j].x, dy = suns[i].y - suns[j].y;
        E -= G * suns[i].m * suns[j].m / Math.sqrt(dx * dx + dy * dy + SOFT2);
      }
    return E;
  }
  function placePlanet(sys, idx, r, rng) {
    const s = sys.suns[idx];
    const th = rng ? rng.range(0, 2 * Math.PI) : 0;
    const v = Math.sqrt(G * s.m / r);
    const sense = rng && rng.next() < 0.5 ? -1 : 1;
    sys.planet.x = s.x + r * Math.cos(th);
    sys.planet.y = s.y + r * Math.sin(th);
    sys.planet.vx = s.vx + sense * -Math.sin(th) * v;
    sys.planet.vy = s.vy + sense * Math.cos(th) * v;
    sys.planet.alive = true;
  }
  function accelerations(sys, acc2) {
    const b = sys.suns, p = sys.planet;
    for (let i = 0; i < 3; i++) {
      let ax2 = 0, ay2 = 0;
      for (let j = 0; j < 3; j++) {
        if (j === i) continue;
        const dx = b[j].x - b[i].x, dy = b[j].y - b[i].y;
        const r2 = dx * dx + dy * dy + SOFT2;
        const inv = G * b[j].m / (r2 * Math.sqrt(r2));
        ax2 += dx * inv;
        ay2 += dy * inv;
      }
      acc2[i * 2] = ax2;
      acc2[i * 2 + 1] = ay2;
    }
    let ax = 0, ay = 0;
    for (let j = 0; j < 3; j++) {
      const dx = b[j].x - p.x, dy = b[j].y - p.y;
      const r2 = dx * dx + dy * dy + SOFT2;
      const inv = G * b[j].m / (r2 * Math.sqrt(r2));
      ax += dx * inv;
      ay += dy * inv;
    }
    acc2[6] = ax;
    acc2[7] = ay;
  }
  function leapfrog(sys, h) {
    const b = sys.suns, p = sys.planet;
    const h2 = h / 2;
    for (let i = 0; i < 3; i++) {
      b[i].x += b[i].vx * h2;
      b[i].y += b[i].vy * h2;
    }
    p.x += p.vx * h2;
    p.y += p.vy * h2;
    accelerations(sys, _acc);
    for (let i = 0; i < 3; i++) {
      b[i].vx += _acc[i * 2] * h;
      b[i].vy += _acc[i * 2 + 1] * h;
    }
    p.vx += _acc[6] * h;
    p.vy += _acc[7] * h;
    for (let i = 0; i < 3; i++) {
      b[i].x += b[i].vx * h2;
      b[i].y += b[i].vy * h2;
    }
    p.x += p.vx * h2;
    p.y += p.vy * h2;
  }
  function yoshida4Step(sys, dt) {
    leapfrog(sys, YOSH_W1 * dt);
    leapfrog(sys, YOSH_W0 * dt);
    leapfrog(sys, YOSH_W1 * dt);
    sys.t += dt;
  }
  function minSeparation(sys) {
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
  function advance(sys, dtYears) {
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
  function observe(sys) {
    const p = sys.planet;
    const out = { suns: [], fluxTotal: 0, minDist: Infinity, tidalSum: 0, primary: -1, pert: 0, alignSpread: 0 };
    for (let i = 0; i < 3; i++) {
      const s = sys.suns[i];
      const dx = s.x - p.x, dy = s.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy + 1e-12);
      const flux = s.L / (d * d);
      const dvx = p.vx - s.vx, dvy = p.vy - s.vy;
      const eOrb = 0.5 * (dvx * dvx + dvy * dvy) - G * s.m / d;
      const o = {
        i,
        d,
        dir: Math.atan2(dy, dx),
        flux,
        angSize: 2 * Math.atan2(SUN_RADIUS * Math.pow(s.m, 0.8), d),
        bound: eOrb < 0,
        eOrb,
        m: s.m,
        L: s.L,
        tidal: s.m / (d * d * d)
      };
      out.suns.push(o);
      out.fluxTotal += flux;
      out.tidalSum += o.tidal;
      if (d < out.minDist) out.minDist = d;
    }
    let prim = -1, eMin = 0;
    for (const o of out.suns) if (o.eOrb < eMin) {
      eMin = o.eOrb;
      prim = o.i;
    }
    out.primary = prim;
    if (prim >= 0) {
      const dp = out.suns[prim];
      let pert = 0;
      for (const o of out.suns) if (o.i !== prim) pert += o.m / (o.d * o.d);
      out.pert = pert / (dp.m / (dp.d * dp.d));
    } else {
      out.pert = Infinity;
    }
    const dirs = out.suns.map((o) => o.dir);
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
  function planetEscaping(sys) {
    const p = sys.planet;
    let minD = Infinity;
    for (const s of sys.suns) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < minD) minD = d;
      const v22 = (p.vx - s.vx) ** 2 + (p.vy - s.vy) ** 2;
      if (0.5 * v22 - G * s.m / Math.max(d, 1e-6) < 0) return false;
    }
    if (minD < 20) return false;
    let M = 0, cx = 0, cy = 0, cvx = 0, cvy = 0;
    for (const s of sys.suns) {
      M += s.m;
      cx += s.m * s.x;
      cy += s.m * s.y;
      cvx += s.m * s.vx;
      cvy += s.m * s.vy;
    }
    cx /= M;
    cy /= M;
    cvx /= M;
    cvy /= M;
    const r = Math.hypot(p.x - cx, p.y - cy);
    if (r < 40) return false;
    const v2 = (p.vx - cvx) ** 2 + (p.vy - cvy) ** 2;
    return 0.5 * v2 - G * M / r > 0;
  }
  function escapedSun(sys) {
    const b = sys.suns;
    let M = 0, cx = 0, cy = 0, cvx = 0, cvy = 0;
    for (const s of b) {
      M += s.m;
      cx += s.m * s.x;
      cy += s.m * s.y;
      cvx += s.m * s.vx;
      cvy += s.m * s.vy;
    }
    cx /= M;
    cy /= M;
    cvx /= M;
    cvy /= M;
    for (let i = 0; i < 3; i++) {
      const s = b[i];
      const r = Math.hypot(s.x - cx, s.y - cy);
      if (r < 100) continue;
      const v2 = (s.vx - cvx) ** 2 + (s.vy - cvy) ** 2;
      if (0.5 * v2 - G * (M - s.m) / r > 0) return i;
    }
    return -1;
  }
  function cloneSystem(sys) {
    return {
      suns: sys.suns.map((s) => ({ m: s.m, L: s.L, x: s.x, y: s.y, vx: s.vx, vy: s.vy })),
      planet: { x: sys.planet.x, y: sys.planet.y, vx: sys.planet.vx, vy: sys.planet.vy, alive: sys.planet.alive },
      t: sys.t,
      E0: sys.E0
    };
  }
  function serialize(sys) {
    return cloneSystem(sys);
  }
  function deserialize(obj) {
    return cloneSystem(obj);
  }
  var G, SOFT2, BASE_DT, SUN_RADIUS, CBRT2, YOSH_W1, YOSH_W0, _acc;
  var init_physics = __esm({
    "src/physics.ts"() {
      "use strict";
      init_util();
      G = 4 * Math.PI * Math.PI;
      SOFT2 = 1e-6;
      BASE_DT = 2e-4;
      SUN_RADIUS = 465e-5;
      CBRT2 = Math.cbrt(2);
      YOSH_W1 = 1 / (2 - CBRT2);
      YOSH_W0 = -CBRT2 / (2 - CBRT2);
      _acc = new Float64Array(8);
    }
  });

  // src/climate.ts
  function createClimate() {
    return {
      tempC: 5,
      eraType: "chaotic",
      // 'stable' | 'chaotic'
      stableEraNo: 0,
      // count of Stable Eras this civilization
      chaoticEraNo: 1,
      eraStartDay: 0,
      // game day the current era began
      orderDays: 0,
      // consecutive days the orbit looked orderly
      disorderDays: 0,
      livableDays: 0,
      // consecutive days the sky was survivable
      lethalDays: 0,
      // consecutive days the sky was lethal
      // event latches / cooldowns (game-day timestamps)
      latch3fs: false,
      // three flying stars currently showing
      latchTriDay: false,
      latchDouble: false,
      latchEclipse: false,
      lastSyzygyDay: -1e9,
      // daily history for charts: arrays of {day, tempC, flux, d:[d0,d1,d2]}
      history: [],
      lastSampleDay: -1,
      // cached observation summary for the renderer
      view: null
    };
  }
  function equilibriumTemp(f) {
    const tK = CAL_T * Math.pow(Math.max(f, 0), 0.25);
    return Math.max(tK - 273.15, T_FLOOR);
  }
  function update(cl, obs, day, dtDays) {
    const events = [];
    const tTarget = equilibriumTemp(obs.fluxTotal);
    const tau = tTarget > cl.tempC ? TAU_WARM : TAU_COOL;
    cl.tempC += (tTarget - cl.tempC) * relax(dtDays, tau);
    const orderly = obs.primary >= 0 && obs.pert < PERT_STABLE;
    const disorderly = obs.primary < 0 || obs.pert > PERT_BREAK;
    const livable = cl.tempC > LIVABLE_LO && cl.tempC < LIVABLE_HI;
    const lethal = cl.tempC < LETHAL_LO || cl.tempC > LETHAL_HI;
    cl.orderDays = orderly ? (cl.orderDays || 0) + dtDays : 0;
    cl.disorderDays = disorderly ? (cl.disorderDays || 0) + dtDays : 0;
    cl.livableDays = livable ? (cl.livableDays || 0) + dtDays : 0;
    cl.lethalDays = lethal ? (cl.lethalDays || 0) + dtDays : 0;
    if (cl.eraType === "chaotic" && cl.orderDays >= STABLE_AFTER && cl.livableDays >= STABLE_AFTER) {
      cl.eraType = "stable";
      cl.stableEraNo += 1;
      cl.eraStartDay = day;
      events.push({ type: "era", era: "stable", no: cl.stableEraNo });
    } else if (cl.eraType === "stable" && (cl.disorderDays >= CHAOS_AFTER || cl.lethalDays >= LETHAL_AFTER)) {
      cl.eraType = "chaotic";
      cl.chaoticEraNo += 1;
      cl.eraStartDay = day;
      events.push({ type: "era", era: "chaotic", no: cl.chaoticEraNo });
    }
    const flying = obs.suns.filter((o) => o.d > FLY_DIST).length;
    const discs = obs.suns.filter((o) => o.d < DISC_DIST).length;
    const threeFS = flying === 3;
    if (threeFS && !cl.latch3fs) events.push({ type: "three-flying-stars" });
    cl.latch3fs = threeFS;
    const triDay = discs === 3 && cl.tempC > 50;
    if (triDay && !cl.latchTriDay) events.push({ type: "tri-solar-day" });
    cl.latchTriDay = triDay;
    const dbl = discs === 2 && cl.tempC > 55;
    if (dbl && !cl.latchDouble && !triDay) events.push({ type: "double-sun" });
    cl.latchDouble = dbl;
    let eclipse = false;
    for (let i = 0; i < 3 && !eclipse; i++)
      for (let j = i + 1; j < 3; j++) {
        const a = obs.suns[i], b = obs.suns[j];
        if (a.d < DISC_DIST && b.d < DISC_DIST) {
          let dd = Math.abs(a.dir - b.dir) % (2 * Math.PI);
          if (dd > Math.PI) dd = 2 * Math.PI - dd;
          if (dd < (a.angSize + b.angSize) * 0.5) {
            eclipse = true;
            break;
          }
        }
      }
    if (eclipse && !cl.latchEclipse) events.push({ type: "eclipse" });
    cl.latchEclipse = eclipse;
    if (obs.alignSpread < SYZ_SPREAD && day - cl.lastSyzygyDay > 45) {
      const ti = obs.tidalSum - (obs.primary >= 0 ? obs.suns[obs.primary].tidal : 0);
      if (ti > SYZ_MINOR) {
        cl.lastSyzygyDay = day;
        const sev = ti > SYZ_RIP ? "rip" : ti > SYZ_MAJOR ? "major" : "minor";
        events.push({ type: "syzygy", severity: sev, tidal: ti });
      }
    }
    const dEng = obs.minDistTick != null ? Math.min(obs.minDist, obs.minDistTick) : obs.minDist;
    if (dEng < ENGULF_DIST) events.push({ type: "engulf" });
    if (Math.floor(day) !== cl.lastSampleDay) {
      cl.lastSampleDay = Math.floor(day);
      cl.history.push({
        day: Math.floor(day),
        tempC: Math.round(cl.tempC * 10) / 10,
        flux: obs.fluxTotal,
        d: obs.suns.map((o) => Math.round(o.d * 1e3) / 1e3)
      });
      if (cl.history.length > 1500) cl.history.splice(0, cl.history.length - 1500);
    }
    cl.view = {
      flying,
      discs,
      pert: obs.pert,
      primary: obs.primary,
      alignSpread: obs.alignSpread,
      tidalSum: obs.tidalSum
    };
    return events;
  }
  function eraLabel(cl) {
    return cl.eraType === "stable" ? "Stable Era No. " + cl.stableEraNo : "Chaotic Era No. " + cl.chaoticEraNo;
  }
  var CAL_T, T_FLOOR, TAU_WARM, TAU_COOL, PERT_STABLE, PERT_BREAK, STABLE_AFTER, CHAOS_AFTER, LIVABLE_LO, LIVABLE_HI, LETHAL_LO, LETHAL_HI, LETHAL_AFTER, DISC_DIST, FLY_DIST, ENGULF_DIST, SYZ_SPREAD, SYZ_MINOR, SYZ_MAJOR, SYZ_RIP, consts;
  var init_climate = __esm({
    "src/climate.ts"() {
      "use strict";
      init_util();
      CAL_T = 287;
      T_FLOOR = -178;
      TAU_WARM = 2;
      TAU_COOL = 7;
      PERT_STABLE = 0.12;
      PERT_BREAK = 0.22;
      STABLE_AFTER = 25;
      CHAOS_AFTER = 6;
      LIVABLE_LO = -10;
      LIVABLE_HI = 45;
      LETHAL_LO = -16;
      LETHAL_HI = 50;
      LETHAL_AFTER = 6;
      DISC_DIST = 2.2;
      FLY_DIST = 2.8;
      ENGULF_DIST = 0.03;
      SYZ_SPREAD = 0.1;
      SYZ_MINOR = 0.5;
      SYZ_MAJOR = 4;
      SYZ_RIP = 60;
      consts = {
        CAL_T,
        T_FLOOR,
        DISC_DIST,
        FLY_DIST,
        ENGULF_DIST,
        SYZ_MINOR,
        SYZ_MAJOR,
        SYZ_RIP,
        PERT_STABLE
      };
    }
  });

  // src/civ.ts
  function ageOf(tech) {
    let idx = 0;
    for (let i = 0; i < AGES.length; i++) if (tech >= AGES[i].cum) idx = i;
    return idx;
  }
  function mods(civ) {
    const d = civ && civ.doctrines || {};
    const m = {
      forecastEps: 1,
      ensembleDaysMul: 1,
      calTrustGain: 1,
      calTrustPenalty: 1,
      scorchMul: 1,
      shelterAgeBonus: 0,
      waterCapMul: 1,
      waterInflowMul: 1,
      grainCapMul: 1,
      foodProdMul: 1,
      complianceBonus: 0,
      scienceMul: 1,
      fleetMul: 1
    };
    if (d.p1) m.forecastEps *= 0.55;
    if (d.p2) {
      m.calTrustGain *= 1.5;
      m.calTrustPenalty *= 0.55;
    }
    if (d.p3) m.ensembleDaysMul *= 1.6;
    if (d.s1) {
      m.scorchMul *= 0.4;
      m.shelterAgeBonus = 2;
    }
    if (d.s2) {
      m.waterCapMul *= 1.6;
      m.waterInflowMul *= 1.6;
    }
    if (d.s3) {
      m.grainCapMul *= 1.5;
      m.foodProdMul *= 1.3;
    }
    if (d.e1) m.complianceBonus += 0.22;
    if (d.e2) m.scienceMul *= 1.3;
    if (d.e3) m.fleetMul *= 2;
    return m;
  }
  function nextTier(branch, doctrines) {
    for (const t of branch.tiers) if (!doctrines[t.id]) return t;
    return null;
  }
  function tierById(id) {
    for (const b of DOCTRINES) for (const t of b.tiers) if (t.id === id) return { branch: b, tier: t };
    return null;
  }
  function popCap(ageIdx) {
    return 80 + ageIdx * ageIdx * 30;
  }
  function waterCap(civ) {
    return (40 + 0.4 * popCap(civ.ageIdx)) * mods(civ).waterCapMul;
  }
  function grainCap(civ) {
    return (60 + 0.6 * popCap(civ.ageIdx)) * mods(civ).grainCapMul;
  }
  function waterInflow(civ) {
    return (4 + civ.ageIdx * 2) * mods(civ).waterInflowMul;
  }
  function foodProd(civ) {
    return (0.14 + civ.ageIdx * 0.01) * mods(civ).foodProdMul;
  }
  function sustainablePop(civ, cl) {
    const stab = cl && cl.eraType === "stable" ? 1 : 0.35;
    const k = foodProd(civ) * stab / FOOD_PER_CAPITA;
    return Math.pow(Math.max(k, 0.01), 1 / 0.3);
  }
  function foodDays(civ) {
    const burn = civ.popH * FOOD_PER_CAPITA;
    return burn > 1e-6 ? civ.grain / burn : Infinity;
  }
  function outlook(civ, cl) {
    const T = cl.tempC;
    const r = {
      foodNet: 0,
      daysToFamine: Infinity,
      climateLossPerDay: 0,
      daysToHalf: Infinity,
      climateKind: null,
      burnLossPerDay: 0,
      daysToHalfStored: Infinity,
      orderEta: Infinity,
      threat: null
      // { label, days, severity, advice }
    };
    if (civ.dormant || !civ.alive) return r;
    const stab = cl.eraType === "stable" ? 1 : 0.35;
    const prod = T >= GROW_LO && T <= GROW_HI ? foodProd(civ) * Math.pow(Math.max(civ.popH, 0), 0.7) * stab : 0;
    r.foodNet = prod - civ.popH * FOOD_PER_CAPITA;
    if (civ.popH > 0) {
      if (civ.grain <= 0) r.daysToFamine = 0;
      else if (r.foodNet < -1e-6) r.daysToFamine = civ.grain / -r.foodNet;
    }
    let dT = 0;
    if (T < SAFE_LO) {
      dT = SAFE_LO - T;
      r.climateKind = "cold";
    } else if (T > SAFE_HI) {
      dT = T - SAFE_HI;
      r.climateKind = "heat";
    }
    if (dT > 0 && civ.popH > 0) {
      r.climateLossPerDay = Math.min(0.95, 0.5 * Math.pow(dT / HARM_SCALE, 2));
      if (r.climateLossPerDay > 1e-6) r.daysToHalf = Math.log(2) / r.climateLossPerDay;
    }
    if (civ.popD > 0 && T > BURN_T1) {
      const M = mods(civ);
      const sheltered = civ.ageIdx >= 6 - M.shelterAgeBonus;
      r.burnLossPerDay = (T > BURN_T2 ? sheltered ? 0.05 : 0.2 : sheltered ? 8e-3 : 0.04) * M.scorchMul;
      if (r.burnLossPerDay > 1e-6) r.daysToHalfStored = Math.log(2) / r.burnLossPerDay;
    }
    if (civ.order === "dehydrate" && civ.popH > (civ.orderTarget || 0)) {
      const k = DEHYDRATE_RATE * (0.45 + 0.65 * civ.trust);
      r.orderEta = Math.log(civ.popH / Math.max(civ.orderTarget || 0, 1e-3)) / k;
    } else if (civ.order === "rehydrate" && civ.popD > (civ.orderTarget || 0)) {
      const k = DEHYDRATE_RATE * (0.45 + 0.65 * civ.trust);
      let eta = Math.log(civ.popD / Math.max(civ.orderTarget || 0, 1e-3)) / k;
      const need = (civ.popD - (civ.orderTarget || 0)) * WATER_PER_CAPITA;
      if (civ.water < need * 0.5) eta = Infinity;
      r.orderEta = eta;
    }
    const cand = [];
    if (r.daysToHalf < 60)
      cand.push({
        label: r.climateKind === "cold" ? "KILLING COLD" : "KILLING HEAT",
        days: r.daysToHalf,
        severity: r.daysToHalf < 5 ? "crit" : "warn",
        advice: "Dehydrate the hydrated."
      });
    if (r.daysToFamine < 60)
      cand.push({
        label: "FAMINE",
        days: r.daysToFamine,
        severity: r.daysToFamine < 5 ? "crit" : "warn",
        advice: civ.grain <= 0 ? "The granaries are empty — dehydrate now." : "Dehydrate part of the populace or wait for a harvest."
      });
    if (r.daysToHalfStored < 60)
      cand.push({
        label: "DEHYDRATORIES SCORCHING",
        days: r.daysToHalfStored,
        severity: r.daysToHalfStored < 5 ? "crit" : "warn",
        advice: "The stored are burning — nothing can be done but endure."
      });
    cand.sort((a, b) => a.days - b.days);
    if (cand.length) r.threat = cand[0];
    return r;
  }
  function createCiv(no, opts) {
    opts = opts || {};
    const tech = opts.tech != null ? opts.tech : AGES[3].cum + 20;
    const ageIdx = ageOf(tech);
    const wCap = 40 + 0.4 * popCap(ageIdx), gCap = 60 + 0.6 * popCap(ageIdx);
    return {
      no,
      foundedDay: opts.foundedDay || 0,
      popH: opts.popH != null ? opts.popH : 42,
      // millions, hydrated
      popD: opts.popD != null ? opts.popD : 3,
      // millions, dehydrated
      peakPop: 0,
      tech,
      ageIdx,
      trust: 0.6,
      // faith in the calendar / the player's word
      order: "none",
      // 'none' | 'dehydrate' | 'rehydrate'
      orderTarget: 0,
      // pool level (M) the standing order moves toward
      calRewardEra: -1,
      // chaoticEraNo last paid a Stable-calendar reward
      // --- reserves ---
      water: opts.water != null ? opts.water : 0.6 * wCap,
      // rehydration water
      grain: opts.grain != null ? opts.grain : 0.6 * gCap,
      // food stores
      starving: false,
      // grain exhausted (latch for one-time warning)
      insight: opts.insight != null ? opts.insight : 0,
      // doctrine points to spend
      doctrines: opts.doctrines ? Object.assign({}, opts.doctrines) : {},
      // owned upgrades
      autoProtocol: false,
      // civil-defense automation (late-game unlock)
      comfortStreak: 0,
      // days of livable weather (for auto-rehydrate)
      alive: true,
      dormant: false,
      germDays: 0,
      deathCause: null,
      // decaying death tallies, for attributing the destruction cause
      tally: { cold: 0, heat: 0, fire: 0, syzygy: 0, famine: 0, calendar: 0 },
      fleet: { building: false, ships: 0 },
      stats: { bornDay: opts.foundedDay || 0, deaths: 0 }
    };
  }
  function totalPop(civ) {
    return civ.popH + civ.popD;
  }
  function update2(civ, cl, day, dtDays, rng, flags) {
    const events = [];
    if (!civ.alive) return events;
    const T = cl.tempC;
    if (civ.dormant) {
      if (T >= 0 && T <= 38) civ.germDays += dtDays;
      else civ.germDays = 0;
      if (civ.germDays >= 5 && day - civ.foundedDay >= 30) {
        civ.dormant = false;
        civ.dormantDays = 0;
        civ.order = "rehydrate";
        events.push({ type: "germinate" });
        return events;
      }
      civ.dormantDays = (civ.dormantDays || 0) + dtDays;
      if (civ.dormantDays > 40 * 365.25) {
        civ.dormantDays = 0;
        events.push({ type: "long-sleep" });
      }
      return events;
    }
    const wCap = waterCap(civ);
    if (T >= WET_LO && T <= WET_HI) {
      const inflow = waterInflow(civ) * (cl.eraType === "stable" ? 1.5 : 1) * dtDays;
      civ.water = Math.min(wCap, civ.water + inflow);
    }
    const M = mods(civ);
    const compliance = Math.min(1.25, 0.45 + 0.65 * civ.trust + M.complianceBonus);
    const target = civ.orderTarget || 0;
    if (civ.order === "dehydrate" && civ.popH > target + 1e-4) {
      const moved = Math.min(civ.popH - target, civ.popH * DEHYDRATE_RATE * compliance * dtDays);
      civ.popH -= moved;
      civ.popD += moved;
      civ.water = Math.min(wCap, civ.water + moved * WATER_PER_CAPITA * WATER_RECLAIM);
      if (civ.popH <= target + 1e-4) {
        civ.order = "none";
        events.push({ type: "order-done", order: "dehydrate" });
      }
    } else if (civ.order === "dehydrate") {
      civ.order = "none";
    } else if (civ.order === "rehydrate" && civ.popD > target + 1e-4) {
      if (T >= REHYDRATE_LO && T <= REHYDRATE_HI) {
        let moved = Math.min(civ.popD - target, civ.popD * DEHYDRATE_RATE * compliance * dtDays);
        const affordable = civ.water / WATER_PER_CAPITA;
        if (moved > affordable) {
          moved = Math.max(0, affordable);
          if (!civ.waterDry && civ.popD - target > 1) {
            civ.waterDry = true;
            events.push({ type: "water-dry" });
          }
        } else if (civ.water > 1) civ.waterDry = false;
        civ.popD -= moved;
        civ.popH += moved;
        civ.water = Math.max(0, civ.water - moved * WATER_PER_CAPITA);
        if (civ.popD <= target + 1e-4) {
          civ.order = "none";
          civ.waterDry = false;
          events.push({ type: "order-done", order: "rehydrate" });
        }
      }
    } else if (civ.order === "rehydrate") {
      civ.order = "none";
    }
    if (civ.autoProtocol && flags.autoUnlocked && !flags.calendarActive) {
      if (T >= GROW_LO && T <= GROW_HI) civ.comfortStreak += dtDays;
      else civ.comfortStreak = 0;
      const sust = sustainablePop(civ, cl);
      if ((T < SAFE_LO + 4 || T > SAFE_HI - 4) && civ.popH > 0 && civ.order !== "dehydrate") {
        civ.order = "dehydrate";
        civ.orderTarget = 0;
        events.push({ type: "auto-order", order: "dehydrate" });
      } else if (foodDays(civ) < 10 && civ.popH > sust * 1.25 && civ.order !== "dehydrate") {
        civ.order = "dehydrate";
        civ.orderTarget = sust;
        events.push({ type: "auto-order", order: "dehydrate" });
      } else if (civ.comfortStreak > 12 && civ.popD > 0.01 && civ.order !== "rehydrate" && cl.eraType === "stable" && foodDays(civ) > 30 && civ.water > civ.popD * 0.5) {
        civ.order = "rehydrate";
        civ.orderTarget = 0;
        events.push({ type: "auto-order", order: "rehydrate" });
      }
    }
    if (civ.popH > 0) {
      let dT = 0;
      if (T < SAFE_LO) dT = SAFE_LO - T;
      else if (T > SAFE_HI) dT = T - SAFE_HI;
      if (dT > 0) {
        const rate = Math.min(0.95, 0.5 * Math.pow(dT / HARM_SCALE, 2));
        const dead = civ.popH * Math.min(0.98, rate * dtDays);
        civ.popH -= dead;
        civ.stats.deaths += dead;
        if (T < SAFE_LO) civ.tally.cold += dead;
        else civ.tally.heat += dead;
      }
    }
    if (civ.popD > 0 && T > BURN_T1) {
      const sheltered = civ.ageIdx >= 6 - M.shelterAgeBonus;
      let rate = (T > BURN_T2 ? sheltered ? 0.05 : 0.2 : sheltered ? 8e-3 : 0.04) * M.scorchMul;
      const dead = civ.popD * Math.min(0.95, rate * dtDays);
      civ.popD -= dead;
      civ.stats.deaths += dead;
      civ.tally.fire += dead;
    }
    if (civ.popH > 0) {
      const gCap = grainCap(civ);
      const stab = cl.eraType === "stable" ? 1 : 0.35;
      if (T >= GROW_LO && T <= GROW_HI) {
        civ.grain += foodProd(civ) * Math.pow(civ.popH, 0.7) * stab * dtDays;
      }
      civ.grain -= civ.popH * FOOD_PER_CAPITA * dtDays;
      if (civ.grain > gCap) civ.grain = gCap;
      if (civ.grain <= 0) {
        civ.grain = 0;
        const dead = civ.popH * Math.min(0.9, FAMINE_RATE * dtDays);
        civ.popH -= dead;
        civ.stats.deaths += dead;
        civ.tally.famine += dead;
        if (!civ.starving) {
          civ.starving = true;
          events.push({ type: "famine-begin" });
        }
      } else if (civ.starving && foodDays(civ) > 12) {
        civ.starving = false;
      }
    }
    if (civ.popH > 0 && T >= GROW_LO && T <= GROW_HI) {
      const cap = popCap(civ.ageIdx);
      const room = clamp(1 - totalPop(civ) / cap, 0, 1);
      civ.popH *= 1 + GROWTH_RATE * room * dtDays;
      const stab = cl.eraType === "stable" ? 1 : 0.35;
      civ.tech += TECH_RATE * Math.pow(Math.min(civ.popH, 400), 0.6) * (0.4 + 0.6 * civ.trust) * stab * (flags.scienceMult || 1) * M.scienceMul * dtDays;
      const newAge = ageOf(civ.tech);
      if (newAge > civ.ageIdx) {
        civ.insight += newAge - civ.ageIdx;
        civ.ageIdx = newAge;
        events.push({ type: "age", idx: newAge, name: AGES[newAge].name, insight: true });
      }
    }
    if (civ.fleet.building && civ.ageIdx >= 12 && civ.popH > 0 && T >= GROW_LO && T <= GROW_HI) {
      const rate = (0.05 + civ.popH * 9e-4) * M.fleetMul;
      civ.fleet.ships += rate * dtDays;
      if (civ.fleet.ships >= FLEET_SHIPS) {
        civ.fleet.ships = FLEET_SHIPS;
        civ.fleet.building = false;
        events.push({ type: "fleet-done" });
      }
    }
    civ.peakPop = Math.max(civ.peakPop, totalPop(civ));
    const dk = Math.exp(-dtDays / 90);
    civ.tally.cold *= dk;
    civ.tally.heat *= dk;
    civ.tally.fire *= dk;
    civ.tally.syzygy *= dk;
    civ.tally.famine *= dk;
    civ.tally.calendar *= dk;
    if (totalPop(civ) < EXTINCT_BELOW) {
      civ.alive = false;
      civ.deathCause = dominantCause(civ);
      events.push({ type: "extinct", cause: civ.deathCause });
    }
    return events;
  }
  function dominantCause(civ) {
    const t = civ.tally;
    const entries = [
      ["extreme cold", t.cold],
      ["blazing heat", t.heat],
      ["the scorching of the dehydratories", t.fire],
      ["a tri-solar syzygy", t.syzygy],
      ["famine", t.famine],
      ["a calendar that promised calm", t.calendar]
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][1] > 0 ? entries[0][0] : "the merciless sky";
  }
  function applyCatastrophe(civ, frac, cause) {
    if (civ.dormant) return [];
    const deadH = civ.popH * frac, deadD = civ.popD * frac;
    civ.popH -= deadH;
    civ.popD -= deadD;
    civ.stats.deaths += deadH + deadD;
    if (cause === "syzygy") civ.tally.syzygy += deadH + deadD;
    else if (cause === "calendar") civ.tally.calendar += deadH + deadD;
    if (totalPop(civ) < EXTINCT_BELOW && civ.alive) {
      civ.alive = false;
      civ.deathCause = cause === "syzygy" ? "a tri-solar syzygy" : dominantCause(civ);
      return [{ type: "extinct", cause: civ.deathCause }];
    }
    return [];
  }
  function rebirth(civ, day, rng) {
    const seedPop = Math.max(0.8, totalPop(civ) + 0.8);
    const next = createCiv(civ.no + rng.int(1, 9), {
      foundedDay: day,
      tech: civ.tech * SEED_RETAIN,
      popH: 0,
      popD: seedPop,
      insight: civ.insight,
      // institutional knowledge survives the seed
      doctrines: civ.doctrines
    });
    next.dormant = true;
    next.germDays = 0;
    next.autoProtocol = civ.autoProtocol;
    return next;
  }
  var AGES, SAFE_LO, SAFE_HI, GROW_LO, GROW_HI, GROWTH_RATE, HARM_SCALE, DEHYDRATE_RATE, REHYDRATE_LO, REHYDRATE_HI, BURN_T1, BURN_T2, TECH_RATE, SEED_RETAIN, EXTINCT_BELOW, FLEET_SHIPS, WET_LO, WET_HI, WATER_PER_CAPITA, WATER_RECLAIM, FOOD_PER_CAPITA, FAMINE_RATE, DOCTRINES, consts2;
  var init_civ = __esm({
    "src/civ.ts"() {
      "use strict";
      init_util();
      AGES = [
        { name: "Neolithic Age", cum: 0 },
        { name: "Bronze Age", cum: 40 },
        { name: "Iron Age", cum: 100 },
        { name: "Warring States Level", cum: 190 },
        { name: "Imperial Level", cum: 330 },
        { name: "Medieval Level", cum: 550 },
        { name: "Renaissance Level", cum: 890 },
        { name: "Scientific Revolution", cum: 1410 },
        { name: "Industrial Revolution", cum: 2710 },
        { name: "Electrical Age", cum: 4910 },
        { name: "Atomic Age", cum: 8110 },
        { name: "Information Age", cum: 12910 },
        { name: "Space Age", cum: 19910 }
      ];
      SAFE_LO = -10;
      SAFE_HI = 45;
      GROW_LO = -5;
      GROW_HI = 40;
      GROWTH_RATE = 9e-5;
      HARM_SCALE = 35;
      DEHYDRATE_RATE = 0.3;
      REHYDRATE_LO = -15;
      REHYDRATE_HI = 50;
      BURN_T1 = 150;
      BURN_T2 = 320;
      TECH_RATE = 0.012;
      SEED_RETAIN = 0.9;
      EXTINCT_BELOW = 0.02;
      FLEET_SHIPS = 1e3;
      WET_LO = 0;
      WET_HI = 62;
      WATER_PER_CAPITA = 1;
      WATER_RECLAIM = 0.5;
      FOOD_PER_CAPITA = 0.02;
      FAMINE_RATE = 0.06;
      DOCTRINES = [
        {
          key: "predict",
          name: "The Calendrical School",
          blurb: "Read the sky farther and stake it harder.",
          tiers: [
            { id: "p1", name: "Sharper Instruments", cost: 1, desc: "Forecasts begin from far finer measurements — the chaos horizon reaches markedly farther." },
            { id: "p2", name: "The Standard Calendar", cost: 2, desc: "A kept Calendar earns +50% trust; a broken one costs far less faith." },
            { id: "p3", name: "The Long Ephemeris", cost: 3, desc: "The Computer integrates a 60% longer window into the future." }
          ]
        },
        {
          key: "survive",
          name: "The Dehydratory School",
          blurb: "Outlast any sky in the deep vaults.",
          tiers: [
            { id: "s1", name: "Deep Rock Vaults", cost: 1, desc: "Dehydratories are sheltered far earlier; the stored scorch at less than half the rate." },
            { id: "s2", name: "The Great Cisterns", cost: 2, desc: "Water capacity and lake inflow both +60% — rehydrate faster, ration less." },
            { id: "s3", name: "Granary Reserves", cost: 3, desc: "Grain stores +50% and harvests +30% — keep far more of the people awake." }
          ]
        },
        {
          key: "expand",
          name: "The Engine School",
          blurb: "Drive science and the fleet.",
          tiers: [
            { id: "e1", name: "Disciplined Compliance", cost: 1, desc: "Orders are obeyed swiftly whatever the people's trust — dehydration and rehydration run faster." },
            { id: "e2", name: "The Industrial Base", cost: 2, desc: "Science accrues 30% faster in every era." },
            { id: "e3", name: "Stellar Shipyards", cost: 3, desc: "The Trisolaran Fleet is built at double speed." }
          ]
        }
      ];
      consts2 = {
        SAFE_LO,
        SAFE_HI,
        GROW_LO,
        GROW_HI,
        REHYDRATE_LO,
        REHYDRATE_HI,
        FLEET_SHIPS,
        EXTINCT_BELOW,
        SEED_RETAIN,
        WATER_PER_CAPITA,
        FOOD_PER_CAPITA,
        WET_LO,
        WET_HI
      };
    }
  });

  // src/story.ts
  function destructionText(civ, ageName) {
    return "Civilization No. " + civ.no + " was destroyed by " + civ.deathCause + ". This civilization had advanced to the " + ageName + ".\n\nThe seed of civilization remains. It will germinate and again progress through the unpredictable world of Three Body.\n\nWe invite you to log in again.";
  }
  function planetLostText(kind, planetsLeft) {
    const what = kind === "engulf" ? "The planet brushed the photosphere of a sun. For a moment it hung there, a dark grain against the fire — then it was drawn down and consumed." : kind === "eject" ? "Slung by the suns' final encounter, the planet has been cast out of the system, falling forever through starless cold." : "At the syzygy's peak the stacked tides exceeded the planet's own grip upon itself. The world tore in two, like a heart breaking.";
    const tail = planetsLeft > 0 ? "\n\nThis star system once held twelve worlds. " + planetsLeft + (planetsLeft === 1 ? " remains" : " remain") + ". The seed of civilization is carried to the next, and the game continues." : "\n\nIt was the last world of Trisolaris.";
    return what + tail;
  }
  function create() {
    return { seenBeats: {}, seenNotices: {} };
  }
  function dueBeat(story, ageIdx) {
    for (const b of BEATS) {
      if (b.age <= ageIdx && !story.seenBeats[b.id]) return b;
    }
    return null;
  }
  function markBeat(story, id) {
    story.seenBeats[id] = true;
  }
  function notice(story, key) {
    if (!NOTICES[key] || story.seenNotices[key]) return null;
    story.seenNotices[key] = true;
    return Object.assign({ key }, NOTICES[key]);
  }
  function moment(story, key) {
    if (!MOMENTS[key] || story.seenBeats[key]) return null;
    story.seenBeats[key] = true;
    return MOMENTS[key];
  }
  var BEATS, MOMENTS, CHRONICLES, NOTICES, ENDING, SILENCE;
  var init_story = __esm({
    "src/story.ts"() {
      "use strict";
      BEATS = [
        {
          id: "intro",
          age: -1,
          unlock: null,
          title: "Three Body · Level One",
          pages: [
            { speaker: "SYSTEM", glyph: "三", text: "Dawn. A plain so desolate it seems abstract: frozen earth in dim, mauve light, beneath a sky where no sun has yet risen. In the distance stands a great pyramid." },
            { speaker: "Follower of King Wen", glyph: "文", text: "Hail, traveler. Cold, isn't it? This is a Chaotic Era — the sun keeps no schedule. It may rise in an hour, or in a century. When the cold deepens, we dehydrate." },
            { speaker: "Follower of King Wen", glyph: "文", text: "The body is wrung of its water and rolled up like a mat, to be stored in the dehydratories. Fire and flood pass over us; we feel nothing. When a Stable Era comes, we are soaked in the lakes and walk again." },
            { speaker: "King Wen of Zhou", glyph: "王", text: "I journey to Zhao Ge with my hexagrams, to read the sun's will. You seem a person of learning — stay, and help this civilization endure. Watch the sky. Order the dehydrations. Time them well, and we may yet outlive the chaos." },
            { speaker: "SYSTEM", glyph: "三", text: "YOUR GOAL — keep the civilization alive through Stable and Chaotic Eras, and advance it age by age. Use DEHYDRATE before the deadly cold or heat arrives; REHYDRATE when the weather turns livable. The truth of this world's sun is yours to uncover." }
          ]
        },
        {
          id: "mozi",
          age: 4,
          unlock: "mozi",
          title: "The Celestial Machine",
          pages: [
            { speaker: "Mozi", glyph: "墨", text: "Up here, on the pyramid's summit, I have watched the sky for a lifetime. The shamans burned, the Confucians froze — their rites read nothing. I do not divine. I MEASURE." },
            { speaker: "Mozi", glyph: "墨", text: "I have built a machine of the universe: a hollow sphere afloat upon a sea of fire. Its shell is pierced — countless pinholes for the stars, and one great hole through which the fire-sea shines: the sun. Turn the shell upon its gears, and the sky's future unrolls like silk." },
            { speaker: "Mozi", glyph: "墨", text: "It is yours. But heed me: the machine believes the sun rides ONE track. When the sky holds to one track, the machine speaks true. When the sky forgets its track… so does the machine." },
            { speaker: "SYSTEM", glyph: "三", text: "UNLOCKED — Mozi's Celestial Model (Observatory panel): fits a clockwork orbit to the present sky and names its period. Trust it exactly as far as the sky stays clockwork." }
          ]
        },
        {
          id: "almanac",
          age: 5,
          unlock: null,
          title: "The Almanac",
          pages: [
            { speaker: "Friar Bacon", glyph: "✚", text: "I am a friar; I ought to pray for the sun's return. Instead I have spent thirty years tabulating it — every rising, every freeze — into a great Almanac of brass and vellum." },
            { speaker: "Friar Bacon", glyph: "✚", text: "Mozi gave us a wheel of the heavens; I give you a TABLE of them. Look up the day, read the sky. While the heavens repeat, the Almanac is a lamp held against the dark." },
            { speaker: "SYSTEM", glyph: "三", text: "But a table only remembers — it cannot foresee a sky that has never repeated. Trust the Almanac through a Stable Era; close it the moment the suns forget their order." }
          ]
        },
        {
          id: "copernicus",
          age: 6,
          unlock: "orbit",
          title: "The Three Suns",
          pages: [
            { speaker: "SYSTEM", glyph: "三", text: "A great hall of stone. Aristotle in his robes, Galileo with his calloused hands, and a throne above them. You have asked to speak, under the name you logged in with: COPERNICUS." },
            { speaker: "Galileo", glyph: "☾", text: "Speak, then. But I warn you — we reject prophets here. Show us reasoning built on observation, or be burned like the rest." },
            { speaker: "You (Copernicus)", glyph: "☉", text: "Our world has not one sun, but THREE. They orbit one another under mutual gravity, in a dance with no pattern. When our planet is held by one sun, it is a Stable Era. When we are torn loose and fall through the open field of three — it is a Chaotic Era." },
            { speaker: "You (Copernicus)", glyph: "☉", text: "The flying stars are no omen. A flying star IS a sun — seen from far away. One sun near, we live. Three flying stars at once means all three suns are distant: the great cold is upon us." },
            { speaker: "Aristotle", glyph: "Ω", text: "Absurd… and yet it saves every appearance. The frozen civilizations, the burned ones, the days of two suns… all of it. All of it!" },
            { speaker: "SYSTEM", glyph: "三", text: "The ORBIT MAP now shows what no Trisolaran eye has seen: the true configuration of the three suns and your world. The problem is named: THREE BODIES, no general solution.\n\nIn this civilization, Copernicus revealed the basic structure of the universe. Three Body has entered the SECOND LEVEL." }
          ]
        },
        {
          id: "computer",
          age: 8,
          unlock: "computer",
          title: "The Human Computer",
          pages: [
            { speaker: "Von Neumann", glyph: "⚙", text: "Your Imperial Majesty: we cannot solve the three-body problem with brushes and silk. But Newton here has given us the laws of motion, and the laws ask only one thing — calculation. Oceans of calculation." },
            { speaker: "Qin Shi Huang", glyph: "秦", text: "I have thirty million soldiers. You shall have every one of them." },
            { speaker: "Von Neumann", glyph: "⚙", text: "Each soldier holds a flag. Raised, he is ONE; lowered, ZERO. Three soldiers make a gate; gates make adders; adders make a machine. Majesty — behold the computer QIN I, thirty million strong, its system bus a cavalry detachment riding down the motherboard!" },
            { speaker: "Newton", glyph: "∇", text: "With my laws and this engine, we shall integrate the suns' motion forward and print a calendar of the eras. The dynasty of prediction begins today." },
            { speaker: "SYSTEM", glyph: "三", text: "UNLOCKED — the COMPUTER panel: a true numerical forecast of the suns. It runs an ensemble of integrations from slightly different measurements. Where the futures agree, trust the calendar. Where they fan apart — that is chaos, and no engine helps you." }
          ]
        },
        {
          id: "einstein",
          age: 10,
          unlock: "einstein",
          title: "The Pendulum Monument",
          pages: [
            { speaker: "Einstein", glyph: "𝑒", text: "You see the monument? A pendulum, swinging above the plain. To earlier ages it was a prayer — a plea that the universe be a clock after all, that somewhere beneath the madness there beats a period." },
            { speaker: "Einstein", glyph: "𝑒", text: "Our instruments are finer now than Qin I ever dreamed. I can hand you the suns' positions to one part in a million. And still — measure as finely as you like — the error GROWS. Doubles, and doubles, and doubles. The fan always opens." },
            { speaker: "Einstein", glyph: "𝑒", text: "Poincaré was right. The three-body problem has no closed solution; prediction decays like radium. God does not merely play dice — he throws them where we cannot see." },
            { speaker: "SYSTEM", glyph: "三", text: "UPGRADED — Atomic-age instruments: ensemble forecasts now start from far sharper measurements. The horizon is longer. It is still finite. It will always be finite." }
          ]
        },
        {
          id: "unsolvable",
          age: 11,
          unlock: "escape",
          title: "The Goal Has Changed",
          pages: [
            { speaker: "SYSTEM", glyph: "三", text: "ANNOUNCEMENT TO ALL PLAYERS. Civilization No. 192 has fallen after four hundred and fifty-two years — the longest reign yet recorded, and still it was not spared. With it, the accumulated computation of every civilization before it is complete. The conclusion is final: the three-body problem cannot be solved." },
            { speaker: "SYSTEM", glyph: "三", text: "The motion of the three suns admits no stable pattern. Every civilization, however wise, will sooner or later be destroyed — by cold, by fire, by the stacked tides of a syzygy, or by falling into a sun. One day the last planet of this system will be consumed." },
            { speaker: "SYSTEM", glyph: "三", text: "Therefore the goal of the game has changed. There is no longer anything to predict. There is only somewhere to GO. Trisolaris must leave. Build the fleet. Cross the sea of stars." },
            { speaker: "SYSTEM", glyph: "三", text: "UNLOCKED — THE TRISOLARAN FLEET. Reach the Space Age and construct 1,000 interstellar ships. This is the final task. There will be no other." }
          ]
        },
        {
          // CANON (outer frame): the recruiter steps out from behind the game.
          id: "meet-up",
          age: 12,
          unlock: null,
          title: "A Message Outside the Game",
          pages: [
            { speaker: "ADMINISTRATOR", glyph: "◉", text: "A line of text appears that does not belong to any era — no registrar, no civilization. It addresses YOU, the one holding the controls. You have outlasted nearly every other player. They have been watching how far you would go." },
            { speaker: "ADMINISTRATOR", glyph: "◉", text: "Understand what you have been shown. This world was not invented to amuse you. Somewhere it is real — its three suns are real, its long freezes and its burning days are real, and its dying is not a score in a game." },
            { speaker: "ADMINISTRATOR", glyph: "◉", text: "There are others who have seen it and understood. We meet, quietly, beyond the game. You are invited. Finish what you began here first — then decide whose side the sky is on." },
            { speaker: "SYSTEM", glyph: "三", text: "The frame closes again. The plain, the pyramid, the unbuilt fleet — all of it waits. (The game says nothing more of this. But you will not forget it.)" }
          ]
        }
      ];
      MOMENTS = {
        // EXTENSION of CANON: stages the King Wen calendar disaster the first time
        // the player's own published Stable calendar is broken by chaos.
        "king-wen": {
          id: "king-wen",
          title: "The Calendar of King Wen",
          pages: [
            { speaker: "SYSTEM", glyph: "三", text: "On the strength of your published calendar, the people came out of the dehydratories in their millions. They soaked in the lakes, walked again, sowed the fields, lit the cities — they trusted the promise of calm." },
            { speaker: "King Wen of Zhou", glyph: "文", text: "My hexagrams read the calm true… for a while. The lines do not lie. But the sky keeps no covenant with any line I cast. I am sorry. They were awake when it came." },
            { speaker: "SYSTEM", glyph: "三", text: "A calendar is the oldest gamble of Three Body: you stake every living body on a prediction, and the three suns honor no prophecy. The bolder the promise, the greater the dead when it breaks. Predict only as far as you truly see." }
          ]
        }
      };
      CHRONICLES = {
        "chronicle-137": { title: "From the Chronicles · No. 137", text: "The registrar adds a note from the old records: Civilization No. 137 also ended in a long freeze, in the age of King Wen, when a calendar promised a calm that the cold did not keep. The first lesson of Three Body, written again." },
        "chronicle-183": { title: "From the Chronicles · No. 183", text: "The old records stir: Civilization No. 183 burned on the day three suns crowded the same sky — the very age in which an astronomer named the truth aloud, that there were three suns and no pattern at all." },
        "chronicle-184": { title: "From the Chronicles · No. 184", text: "The records remember No. 184: torn upward into the sky by a tri-solar syzygy on the very day its grand computation printed a calendar of hope. Knowledge bought the prediction; it could not buy the world." }
      };
      NOTICES = {
        "era-stable": { title: "Stable Era", text: "The registrar proclaims a STABLE ERA. The sun keeps a schedule; crops can grow and cities can rise. Rehydrate the stored, and build while the calm lasts — no Stable Era is eternal." },
        "era-chaotic": { title: "Chaotic Era", text: "The registrar proclaims a CHAOTIC ERA. The sun answers to nothing now. Watch the temperature; when it runs for the extremes, give the order: DEHYDRATE." },
        "three-flying-stars": { title: "Three Flying Stars", text: "Three flying stars hang in the sky at once — the most dreaded of omens. All the suns are far away. The long, deep cold is coming. Dehydrate while you can." },
        "tri-solar-day": { title: "Tri-Solar Day", text: "THREE SUNS stand in the sky together. The world is a furnace; stone glows and seas boil. Those still hydrated are already gone. Pray the dehydratories hold." },
        "double-sun": { title: "Twin Suns", text: "Two suns blaze overhead. The heat climbs fast. If a third joins them, nothing on the surface will remain." },
        "syzygy": { title: "Tri-Solar Syzygy", text: "The three suns have stacked into a single line above the world. Their gravities add; the tide reaches down like a hand and pulls the surface toward the sky." },
        "sun-escape": { title: "A Sun Departs", text: "Impossibly, one of the three suns has been flung from the dance and recedes into the deep night. The registrar is silent. The remaining two settle toward an orderly waltz." },
        "eclipse": { title: "An Eclipse of Suns", text: "Two suns cross paths in the sky and one slides behind the other — a ring of fire about a disc of shadow. The astronomers note it carefully: a fleeting alignment, harmless in itself, but proof that even the suns' paths intersect. Beautiful, and a little terrible." }
      };
      ENDING = {
        title: "The Fleet Departs",
        pages: [
          "On the thousandth day of the final Stable Era, the Trisolaran Fleet stood complete: one thousand ships in a phalanx across the sky, each a teardrop of stellar fire.",
          "There was no ceremony. A civilization that has died two hundred times does not celebrate; it simply leaves. The fleet accelerated outward, and the three mad suns shrank behind it into the dance that no mind will ever predict.",
          "The destination was already chosen. Four light-years away shines a single, steady, merciful star — and around it a world whose civilization has just revealed its position to the universe.",
          "They will arrive in four hundred and fifty years.\n\nTHE THREE BODY GAME IS OVER."
        ]
      };
      SILENCE = {
        title: "The Silence of Trisolaris",
        text: "The last world of the three suns is gone. Two hundred civilizations, every hexagram, every sphere of Mozi, every soldier of the human computer — all of it now belongs to the fire.\n\nTrisolaris has fallen silent forever."
      };
      Object.assign(NOTICES, CHRONICLES);
    }
  });

  // src/predict.ts
  function divination(cl, rng) {
    const [name, verse] = rng.pick(HEXAGRAMS);
    const persist = rng.next() < 0.55;
    const guessStable = persist ? cl.eraType === "stable" : cl.eraType !== "stable";
    return {
      hexagram: name,
      verse,
      guess: guessStable ? "stable" : "chaotic",
      horizon: rng.int(20, 120)
    };
  }
  function moziModel(sys, cl) {
    const obs = observe(sys);
    if (obs.primary < 0 || obs.pert > 0.5) {
      return {
        ok: false,
        text: "The spheres will not mesh — the sun refuses every gear I build. No period fits the present sky."
      };
    }
    const o = obs.suns[obs.primary];
    const a = -G * o.m / (2 * o.eOrb);
    const period = a > 0 ? 2 * Math.PI * Math.sqrt(a * a * a / (G * o.m)) : NaN;
    const tNow = equilibriumTemp(o.flux);
    return {
      ok: true,
      primary: obs.primary,
      periodDays: period * 365.25,
      a,
      tPredicted: tNow,
      pert: obs.pert,
      text: "The machine of the sky is wound: our world rides a sphere about one sun, period " + (isFinite(period) ? (period * 365.25).toFixed(0) : "?") + " days, at " + a.toFixed(2) + " units of distance. By this model the current weather shall repeat for ten thousand years." + (obs.pert > 0.08 ? " (Yet the other suns tug at the gears...)" : "")
    };
  }
  function ensembleForecast(sys, days, members, eps, rng) {
    const clones = [];
    for (let k = 0; k < members; k++) {
      const c = cloneSystem(sys);
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
    const SPREAD_LIMIT = 25;
    for (let d = 0; d < days; d++) {
      let lo = Infinity, hi = -Infinity, sum = 0;
      for (const c of clones) {
        advance(c, 1 / 365.25);
        const t = equilibriumTemp(observe(c).fluxTotal);
        if (t < lo) lo = t;
        if (t > hi) hi = t;
        sum += t;
      }
      tMin.push(lo);
      tMax.push(hi);
      tMean.push(sum / clones.length);
      if (horizonDay === days && hi - lo > SPREAD_LIMIT) horizonDay = d;
    }
    return { days, tMean, tMin, tMax, horizonDay };
  }
  function epsForAge(ageIdx) {
    if (ageIdx >= 11) return 25e-5;
    if (ageIdx >= 10) return 7e-4;
    return 25e-4;
  }
  function createProclamation(kind, days, day, cl) {
    return {
      kind,
      startDay: day,
      endDay: day + days,
      state: "pending",
      startChaoticNo: cl ? cl.chaoticEraNo : 0
    };
  }
  function checkProclamation(proc, cl, day) {
    if (proc.state !== "pending") return proc.state;
    const newChaos = cl.chaoticEraNo > (proc.startChaoticNo != null ? proc.startChaoticNo : 0);
    if (proc.kind === "stable") {
      if (newChaos) proc.state = "failure";
      else if (day >= proc.endDay) proc.state = "success";
    } else {
      if (newChaos) proc.state = "success";
      else if (day >= proc.endDay) proc.state = "failure";
    }
    return proc.state;
  }
  var HEXAGRAMS;
  var init_predict = __esm({
    "src/predict.ts"() {
      "use strict";
      init_physics();
      init_climate();
      HEXAGRAMS = [
        ["䷀ The Creative", "Heaven moves with vigor. The sun shall keep its course."],
        ["䷁ The Receptive", "Earth lies still and patient. Endure, and await the dawn."],
        ["䷃ Youthful Folly", "Mists obscure the mountain spring. The sky cannot be read."],
        ["䷊ Peace", "Heaven and earth unite. A gentle age approaches."],
        ["䷋ Standstill", "Heaven and earth do not meet. The suns withdraw their favor."],
        ["䷜ The Abysmal", "Water flows into the deep. Cold upon cold descends."],
        ["䷝ The Clinging Fire", "Brightness doubled blazes forth. Beware the twinned light."],
        ["䷲ The Arousing", "Thunder shakes the firmament. The order of the sky breaks."]
      ];
    }
  });

  // src/score.ts
  function ageGoal(target, name, id, nm, seed, stars2, figure) {
    return {
      id,
      name: nm,
      seed,
      goalText: "Advance your civilization to the " + name + ".",
      done: (s) => s.stats.maxAge >= target,
      stars: stars2,
      figure
    };
  }
  function levelOf(state) {
    return state.level >= 0 && state.level < LEVELS.length ? LEVELS[state.level] : null;
  }
  function isLastLevel(level) {
    return level === LEVELS.length - 1;
  }
  function computeScore(state) {
    const st = state.stats, civ = state.civ;
    let s = 0;
    s += SCORE.AGE * Math.max(0, st.maxAge - START_AGE);
    s += SCORE.PEAKPOP * (civ.peakPop || 0);
    s += SCORE.YEAR * (state.day / 365.25);
    s += SCORE.CAL_OK * (st.proclaimOk || 0) - SCORE.CAL_BAD * (st.proclaimBad || 0);
    s += SCORE.TRUST * (civ.trust || 0);
    s += SCORE.DOCTRINE * Object.keys(civ.doctrines || {}).length;
    s += SCORE.OBJECTIVE * Object.keys(state.objsDone || {}).length;
    s -= SCORE.CIV_LOST * (st.civsLost || 0);
    s -= SCORE.PLANET_LOST * (st.planetsLost || 0);
    if (state.levelDone) s += SCORE.LEVEL;
    if (state.won) s += SCORE.WIN;
    return Math.max(0, Math.round(s));
  }
  function rankFor(level, score) {
    const thr = LEVELS[level] && LEVELS[level].stars || [2e4, 45e3, 8e4];
    let stars2 = 0;
    for (const t of thr) if (score >= t) stars2++;
    return { stars: stars2, title: TITLES[stars2] };
  }
  function nowStep(state) {
    const civ = state.civ, cl = state.cl;
    if (state.over) return null;
    if (!civ.alive || civ.dormant)
      return { id: "wait", kind: "do", text: "A seed waits underground. Speed up time [2–4] until the sky is livable." };
    const T = cl.tempC;
    if (civ.popH > 1e-3 && civ.order !== "dehydrate" && (T < -6 || T > 43))
      return { id: "do-dehydrate", kind: "do", danger: true, text: "KILLING SKY — Dehydrate [D] now, before cold or heat takes them." };
    const fd = foodDays(civ), sust = sustainablePop(civ, cl);
    if (civ.popH > sust * 1.4 && fd < 22 && fd > 0)
      return { id: "do-shed", kind: "do", danger: true, text: "Famine looms — set order size to ⅓ and Dehydrate to save your grain." };
    if (cl.eraType === "stable" && (civ.popD || 0) > 0.5 && T > 2 && T < 36 && civ.order !== "rehydrate" && civ.water > civ.popD * 0.3)
      return { id: "do-rehydrate", kind: "do", text: "A Stable Era — Rehydrate [R] your stored people to live and grow." };
    if (cl.eraType === "stable" && !state.calendar)
      return { id: "do-calendar", kind: "do", text: "The sky is calm — run the Computer [C], then publish a Calendar [P]." };
    if ((civ.insight || 0) > 0)
      return { id: "do-doctrine", kind: "do", text: "You have Insight ◆ — spend it on a Doctrine [V]." };
    if (state.flags.escape && civ.ageIdx >= 12 && !civ.fleet.building)
      return { id: "do-fleet", kind: "do", text: "Build the Trisolaran Fleet — escape the three suns." };
    return null;
  }
  function primaryObjective(state) {
    const lvl = levelOf(state);
    const here = AGES[state.civ.ageIdx] ? AGES[state.civ.ageIdx].name : "";
    if (!lvl)
      return { id: "primary", kind: "primary", text: "WILD SYSTEM — survive, advance, and launch the Fleet. (now: " + here + ")" };
    return {
      id: "primary",
      kind: state.levelDone ? "done" : "primary",
      text: lvl.goalText + (state.levelDone ? " ✓" : "  (now: " + here + ")")
    };
  }
  function tickProgress(state) {
    const events = [];
    if (!state.objsDone) state.objsDone = {};
    for (const t of TEACH) {
      if (!state.objsDone[t.id] && t.cond(state)) {
        state.objsDone[t.id] = true;
        events.push({ kind: "objective", id: t.id, text: t.label });
      }
    }
    const lvl = levelOf(state);
    if (lvl && !state.levelDone && lvl.done(state)) {
      state.levelDone = true;
      if (!isLastLevel(state.level)) {
        const score = computeScore(state);
        const r = rankFor(state.level, score);
        events.push({
          kind: "level-complete",
          level: state.level,
          name: lvl.name,
          score,
          stars: r.stars,
          title: r.title
        });
      }
    }
    return events;
  }
  var SCORE, START_AGE, LEVELS, TITLES, TEACH;
  var init_score = __esm({
    "src/score.ts"() {
      "use strict";
      init_civ();
      SCORE = {
        AGE: 1e3,
        // per age advanced beyond the Warring-States start
        PEAKPOP: 8,
        // per million at peak population
        YEAR: 3,
        // per game-year survived
        CAL_OK: 600,
        // per calendar kept
        CAL_BAD: 150,
        // per calendar broken (penalty)
        TRUST: 600,
        // × current trust (0..1)
        DOCTRINE: 250,
        // per doctrine adopted
        OBJECTIVE: 200,
        // per one-time teaching objective completed
        CIV_LOST: 300,
        // per civilization lost (penalty)
        PLANET_LOST: 800,
        // per world consumed (penalty)
        LEVEL: 5e3,
        // bonus for completing the level's goal
        WIN: 15e3
        // bonus for launching the fleet
      };
      START_AGE = 3;
      LEVELS = [
        ageGoal(
          4,
          "Imperial Level",
          "l1",
          "Mozi's Machine",
          6021,
          [1500, 3e3, 5e3],
          { name: "Mozi", glyph: "墨", line: "You kept them alive to the age of measurement. Take my celestial sphere — but trust it only while the sky keeps its track." }
        ),
        ageGoal(
          5,
          "Medieval Level",
          "l2",
          "The Almanac",
          4014,
          [3e3, 6e3, 1e4],
          { name: "Friar Bacon", glyph: "✚", line: "Your people have an Almanac of the sun now. Read it in the calm — and shut it the moment the suns run wild." }
        ),
        ageGoal(
          6,
          "Renaissance Level",
          "l3",
          "The Three Suns",
          8021,
          [6e3, 11e3, 18e3],
          { name: "Copernicus", glyph: "☉", line: "You have seen what no Trisolaran eye has seen: three suns, and no solution. The Second Level is yours." }
        ),
        ageGoal(
          8,
          "Industrial Revolution",
          "l4",
          "The Human Computer",
          4238,
          [12e3, 2e4, 3e4],
          { name: "Von Neumann", glyph: "⚙", line: "Thirty million flags rose at your command and computed the heavens. Calculation has a dynasty now." }
        ),
        ageGoal(
          10,
          "Atomic Age",
          "l5",
          "The Pendulum",
          5063,
          [2e4, 32e3, 46e3],
          { name: "Einstein", glyph: "𝑒", line: "Finer instruments, longer sight — and still the fan opens. Prediction has a horizon, and now you know it." }
        ),
        ageGoal(
          11,
          "Information Age",
          "l6",
          "The Goal Has Changed",
          7014,
          [3e4, 45e3, 62e3],
          { name: "The Announcement", glyph: "三", line: "There is nothing left to predict. There is only somewhere to go. Build the fleet." }
        ),
        {
          id: "l7",
          name: "Escape",
          seed: 6035,
          goalText: "Reach the Space Age and launch the 1,000-ship Trisolaran Fleet.",
          done: (s) => !!s.won,
          stars: [45e3, 65e3, 9e4],
          figure: { name: "The Administrator", glyph: "◉", line: "You went as far as anyone. Now leave the game, and decide whose side the sky is on." }
        }
      ];
      TITLES = ["Survivor", "Steward of Trisolaris", "Calendar-Keeper", "Master of the Three Suns"];
      TEACH = [
        {
          id: "dehydrate",
          label: "Dehydrate your people before the killing sky",
          cond: (s) => s.civ.order === "dehydrate" || (s.civ.popD || 0) > 0.5
        },
        {
          id: "rehydrate",
          label: "Rehydrate in a Stable Era and let them grow",
          cond: (s) => s.civ.order === "rehydrate"
        },
        {
          id: "calendar",
          label: "Publish a Calendar to earn the people’s trust",
          cond: (s) => !!s.calendar
        },
        {
          id: "doctrine",
          label: "Spend Insight on a Doctrine",
          cond: (s) => Object.keys(s.civ.doctrines || {}).length > 0
        }
      ];
    }
  });

  // src/game.ts
  function createGame(seed, opts) {
    const rng = makeRng(seed == null ? 137 : seed);
    const state = {
      seed: rng.seed,
      rng,
      sys: createSystem(rng),
      cl: createClimate(),
      civ: createCiv(137, { foundedDay: 0 }),
      story: create(),
      day: 0,
      planetsLeft: PLANETS_AT_START,
      // All tools are available from the start; the story beats introduce
      // them narratively as the civilization advances.
      flags: {
        mozi: true,
        orbit: true,
        computer: true,
        einstein: true,
        escape: true,
        autoUnlocked: true
      },
      calendar: null,
      // the published prediction the populace follows
      log: [],
      pending: [],
      // overlays/banners for the UI to consume
      over: false,
      won: false,
      sunEscaped: false,
      _escCheck: 0,
      // day accumulators for rare checks
      stats: {
        civsLost: 0,
        planetsLost: 0,
        proclaimOk: 0,
        proclaimBad: 0,
        maxAge: 3,
        startCivNo: 137
      },
      // Levels / objectives / score (see score.ts). level -1 = Wild System.
      level: opts && opts.level != null ? opts.level : -1,
      score: 0,
      objsDone: {},
      levelDone: false
    };
    addLog(state, "You have logged in to Three Body. Civilization No. 137.", "sys");
    checkBeats(state);
    return state;
  }
  function addLog(state, text, cls) {
    state.log.push({ day: Math.floor(state.day), text, cls: cls || "" });
    if (state.log.length > 250) state.log.splice(0, state.log.length - 250);
  }
  function push(state, item) {
    state.pending.push(item);
  }
  function banner(state, text, style) {
    push(state, { kind: "banner", text, style: style || "" });
  }
  function checkBeats(state) {
    let beat;
    while (beat = dueBeat(state.story, state.civ.ageIdx)) {
      markBeat(state.story, beat.id);
      if (beat.unlock) {
        state.flags[beat.unlock] = true;
        if (beat.unlock === "computer") state.flags.autoUnlocked = true;
      }
      push(state, { kind: "beat", beat });
    }
  }
  function showNotice(state, key) {
    const n = notice(state.story, key);
    if (n) push(state, { kind: "notice", notice: n });
  }
  function showMoment(state, key) {
    const m = moment(state.story, key);
    if (m) push(state, { kind: "beat", beat: m });
  }
  function tick(state, dtDays) {
    if (state.over) return;
    const rng = state.rng;
    advance(state.sys, dtDays / 365.25);
    const obs = observe(state.sys);
    obs.minDistTick = state.sys.tickMinPlanetDist;
    const planetsBefore = state.planetsLeft;
    const clEvents = update(state.cl, obs, state.day, dtDays);
    for (const ev of clEvents) {
      handleClimateEvent(state, ev, rng);
      if (state.over) return;
      if (state.planetsLeft < planetsBefore) break;
    }
    state._escCheck += dtDays;
    if (state._escCheck > 5) {
      state._escCheck = 0;
      if (planetEscaping(state.sys)) {
        planetLost(state, "eject");
        return;
      }
      if (!state.sunEscaped && escapedSun(state.sys) >= 0) {
        state.sunEscaped = true;
        showNotice(state, "sun-escape");
        addLog(state, "One of the three suns has escaped the system.", "event");
      }
    }
    state.flags.scienceMult = 1;
    state.flags.calendarActive = !!state.calendar;
    if (state.calendar) followCalendar(state);
    const cvEvents = update2(state.civ, state.cl, state.day, dtDays, rng, state.flags);
    for (const ev of cvEvents) handleCivEvent(state, ev);
    if (state.over) return;
    if (state.calendar) resolveCalendar(state);
    if (state.over) return;
    state.day += dtDays;
    state.stats.maxAge = Math.max(state.stats.maxAge, state.civ.ageIdx);
    for (const ev of tickProgress(state)) push(state, ev);
    state.score = computeScore(state);
  }
  function handleClimateEvent(state, ev, rng) {
    const cl = state.cl;
    switch (ev.type) {
      case "era": {
        const label = eraLabel(cl);
        addLog(state, "The registrar proclaims: " + label + " begins.", "era");
        banner(state, label.toUpperCase(), ev.era);
        showNotice(state, ev.era === "stable" ? "era-stable" : "era-chaotic");
        break;
      }
      case "three-flying-stars":
        addLog(state, "Three flying stars hang in the sky at once.", "event");
        banner(state, "THREE FLYING STARS", "cold");
        showNotice(state, "three-flying-stars");
        break;
      case "tri-solar-day":
        addLog(state, "Tri-solar day! Three suns blaze overhead.", "event");
        banner(state, "TRI-SOLAR DAY", "hot");
        showNotice(state, "tri-solar-day");
        break;
      case "double-sun":
        addLog(state, "Two suns rise together. The heat mounts.", "event");
        showNotice(state, "double-sun");
        break;
      case "eclipse":
        addLog(state, "An eclipse: one sun slips behind another, a ring of fire about a shadow.", "event");
        showNotice(state, "eclipse");
        break;
      case "syzygy": {
        addLog(state, "TRI-SOLAR SYZYGY — the suns stack into a line. (tide " + ev.tidal.toFixed(1) + ")", "event");
        banner(state, "TRI-SOLAR SYZYGY", "syzygy");
        showNotice(state, "syzygy");
        if (ev.severity === "rip") {
          planetLost(state, "rip");
          break;
        }
        const frac = ev.severity === "major" ? rng.range(0.35, 0.6) : rng.range(0.05, 0.15);
        const exEvents = applyCatastrophe(state.civ, frac, "syzygy");
        addLog(state, "The tide takes " + Math.round(frac * 100) + "% of all the stored and the living.", "bad");
        showNotice(state, "chronicle-184");
        for (const e of exEvents) handleCivEvent(state, e);
        break;
      }
      case "engulf":
        planetLost(state, "engulf");
        break;
    }
  }
  function handleCivEvent(state, ev) {
    switch (ev.type) {
      case "age":
        addLog(state, "Civilization No. " + state.civ.no + " advances to the " + ev.name + ".", "age");
        banner(state, ev.name.toUpperCase(), "age");
        checkBeats(state);
        break;
      case "long-sleep": {
        const spawn = chooseSpawn(state.sys);
        placePlanet(state.sys, spawn.idx, spawn.r, state.rng);
        state.cl = createClimate();
        state.cl.eraStartDay = state.day;
        addLog(state, "Forty years of silence. The vault's automatons wake, and carry the seed in a slow ark toward a kinder sun.", "sys");
        banner(state, "THE LONG SLEEP ENDS", "good");
        break;
      }
      case "germinate":
        addLog(state, "The seed of Civilization No. " + state.civ.no + " germinates beneath a livable sky. Rehydration begins.", "sys");
        banner(state, "THE SEED GERMINATES", "good");
        break;
      case "order-done":
        addLog(state, ev.order === "dehydrate" ? "The last bodies are rolled and shelved. The world holds its breath." : "The lakes give back the living. The civilization breathes again.", "order");
        break;
      case "auto-order":
        addLog(state, "Civil-defense protocol: " + ev.order + " order issued automatically.", "order");
        break;
      case "famine-begin":
        addLog(state, "The granaries are empty. Famine walks among the hydrated — dehydrate the populace or feed them, quickly.", "bad");
        banner(state, "FAMINE", "bad");
        break;
      case "water-dry":
        addLog(state, "The cisterns run dry; the rehydration stalls until the lakes refill.", "bad");
        break;
      case "extinct":
        civilizationDestroyed(state);
        break;
      case "fleet-done": {
        state.over = true;
        state.won = true;
        push(state, { kind: "ending", ending: ENDING, stats: summary(state) });
        break;
      }
    }
  }
  function civilizationDestroyed(state) {
    const civ = state.civ;
    state.stats.civsLost += 1;
    const ageName = AGES[civ.ageIdx].name;
    addLog(state, "Civilization No. " + civ.no + " was destroyed by " + civ.deathCause + ".", "bad");
    push(state, { kind: "destroyed", text: destructionText(civ, ageName), civNo: civ.no });
    const cause = civ.deathCause || "";
    if (cause.indexOf("cold") >= 0) showNotice(state, "chronicle-137");
    else if (cause.indexOf("heat") >= 0) showNotice(state, "chronicle-183");
    else if (cause.indexOf("syzygy") >= 0) showNotice(state, "chronicle-184");
    state.civ = rebirth(civ, state.day, state.rng);
    state.calendar = null;
    addLog(state, "From the seed, Civilization No. " + state.civ.no + " begins.", "sys");
    checkBeats(state);
  }
  function planetLost(state, kind) {
    state.planetsLeft -= 1;
    state.stats.planetsLost += 1;
    state.stats.civsLost += 1;
    const civ = state.civ;
    civ.alive = false;
    civ.stats.deaths += totalPop(civ);
    civ.popH = 0;
    civ.popD = 0;
    civ.deathCause = kind === "engulf" ? "the sun itself" : kind === "eject" ? "the eternal night between the stars" : "the tearing tides of a tri-solar syzygy";
    addLog(state, "THE PLANET IS LOST (" + kind + "). Worlds remaining: " + state.planetsLeft + ".", "bad");
    push(state, {
      kind: "planet-lost",
      lostKind: kind,
      text: planetLostText(kind, state.planetsLeft),
      planetsLeft: state.planetsLeft
    });
    if (state.planetsLeft <= 0) {
      state.over = true;
      state.won = false;
      push(state, { kind: "silence", text: SILENCE.text, stats: summary(state) });
      return;
    }
    const spawn = chooseSpawn(state.sys);
    placePlanet(state.sys, spawn.idx, spawn.r * state.rng.range(0.95, 1.05), state.rng);
    state.cl = createClimate();
    state.cl.eraStartDay = state.day;
    state.civ = rebirth(civ, state.day, state.rng);
    state.calendar = null;
    addLog(state, "On the next world, Civilization No. " + state.civ.no + " begins.", "sys");
    checkBeats(state);
  }
  function cmdDehydrate(state, frac) {
    if (state.over || !state.civ.alive || state.civ.dormant) return false;
    const civ = state.civ;
    if (civ.popH <= 0) return false;
    frac = frac == null ? 1 : clamp(frac, 0, 1);
    const targetPop = civ.popH * (1 - frac);
    if (civ.popH - targetPop < 1e-3) return false;
    civ.order = "dehydrate";
    civ.orderTarget = targetPop;
    addLog(state, frac >= 0.999 ? '"DEHYDRATE!" — the order rolls across the plain. All must sleep.' : '"DEHYDRATE the ' + pctWord(frac) + '" — a workforce is kept awake.', "order");
    return true;
  }
  function cmdRehydrate(state, frac) {
    if (state.over || !state.civ.alive || state.civ.dormant) return false;
    const civ = state.civ;
    if (civ.popD <= 0) return false;
    frac = frac == null ? 1 : clamp(frac, 0, 1);
    const targetPop = civ.popD * (1 - frac);
    if (civ.popD - targetPop < 1e-3) return false;
    civ.order = "rehydrate";
    civ.orderTarget = targetPop;
    addLog(state, frac >= 0.999 ? "The rehydration begins: the rolled are carried to the lakes." : "A partial rehydration: the " + pctWord(frac) + " are soaked back to life.", "order");
    return true;
  }
  function pctWord(frac) {
    if (frac >= 0.7) return "greater part";
    if (frac >= 0.45) return "half";
    return "third";
  }
  function cmdHoldOrder(state) {
    if (state.civ.order === "none") return false;
    addLog(state, "The " + state.civ.order + " order is rescinded.", "order");
    state.civ.order = "none";
    return true;
  }
  function cmdProclaim(state, kind, days) {
    if (state.over || state.calendar || !state.civ.alive || state.civ.dormant) return false;
    if (state.cl.eraType !== "stable") {
      addLog(state, "The registrar refuses: the sky is already chaos. Wait for a Stable Era to publish a calendar.", "proc");
      return false;
    }
    state.calendar = createProclamation(kind, days, state.day, state.cl);
    if (kind === "stable") {
      addLog(state, 'THE CALENDAR is published: "The Stable Era will hold for ' + fmtDays(days) + '. Rehydrate; live and build."', "proc");
      if (state.civ.popD > 0) {
        state.civ.order = "rehydrate";
        state.civ.orderTarget = 0;
      }
    } else {
      addLog(state, 'THE CALENDAR is published: "Chaos will come within ' + fmtDays(days) + '. Dehydrate; take shelter."', "proc");
      if (state.civ.popH > 0) {
        state.civ.order = "dehydrate";
        state.civ.orderTarget = 0;
      }
    }
    return true;
  }
  function followCalendar(state) {
    const cal = state.calendar, civ = state.civ, cl = state.cl;
    if (!civ.alive || civ.dormant) return;
    if (cal.kind === "stable") {
      if (civ.popD > 0.01 && civ.order !== "rehydrate") {
        civ.order = "rehydrate";
        civ.orderTarget = 0;
      }
      if (cl.eraType === "stable") state.flags.scienceMult = 1.4;
    } else {
      if (civ.popH > 0.01 && civ.order !== "dehydrate") {
        civ.order = "dehydrate";
        civ.orderTarget = 0;
      }
    }
  }
  function resolveCalendar(state) {
    const cal = state.calendar, civ = state.civ;
    const r = checkProclamation(cal, state.cl, state.day);
    if (r === "pending") return;
    const lengthYrs = (cal.endDay - cal.startDay) / 365.25;
    const M = mods(civ);
    if (r === "success") {
      state.stats.proclaimOk += 1;
      const gain = Math.min(0.3, (0.08 + lengthYrs * 0.05) * M.calTrustGain);
      if (cal.kind === "stable") {
        if (civ.calRewardEra !== state.cl.chaoticEraNo) {
          civ.calRewardEra = state.cl.chaoticEraNo;
          civ.trust = Math.min(1, civ.trust + gain);
          civ.insight += 1;
          civ.tech += 30 + 120 * lengthYrs;
          addLog(state, "THE CALENDAR HELD. A golden age: faith and knowledge both deepen (trust " + Math.round(civ.trust * 100) + "%).", "good");
          banner(state, "THE CALENDAR HELD", "good");
        } else {
          civ.trust = Math.min(1, civ.trust + 0.02);
          addLog(state, "The calendar held once more; the people's confidence steadies.", "good");
        }
      } else {
        civ.trust = Math.min(1, civ.trust + Math.min(0.2, gain));
        civ.insight += 1;
        addLog(state, "The warned chaos came as foretold. The people were sheltered; trust deepens (" + Math.round(civ.trust * 100) + "%).", "good");
        banner(state, "THE WARNING WAS TRUE", "good");
      }
    } else {
      state.stats.proclaimBad += 1;
      if (cal.kind === "stable") {
        const T = state.cl.tempC;
        const extremity = clamp((Math.abs(T - 15) - 25) / 90, 0, 1);
        const frac = clamp(0.12 + 0.4 * extremity, 0.05, 0.6);
        civ.trust = Math.max(0.08, civ.trust - 0.32 * M.calTrustPenalty);
        addLog(state, "THE CALENDAR HAS FAILED — chaos fell upon a waking world. " + Math.round(frac * 100) + "% are lost; faith collapses (" + Math.round(civ.trust * 100) + "%).", "bad");
        banner(state, "THE CALENDAR HAS FAILED", "bad");
        const ex = applyCatastrophe(civ, frac, "calendar");
        for (const e of ex) handleCivEvent(state, e);
        showMoment(state, "king-wen");
      } else {
        civ.trust = Math.max(0.1, civ.trust - 0.14 * M.calTrustPenalty);
        addLog(state, "The foretold chaos never came; the people slept through calm and clear skies. The calendar is doubted (" + Math.round(civ.trust * 100) + "%).", "bad");
        banner(state, "A FALSE ALARM", "bad");
      }
    }
    state.calendar = null;
  }
  function cmdFleet(state) {
    if (!state.flags.escape || state.civ.ageIdx < 12 || state.civ.fleet.building) return false;
    state.civ.fleet.building = true;
    addLog(state, "The construction of the Trisolaran Fleet begins: 1,000 ships.", "sys");
    return true;
  }
  function cmdToggleAuto(state) {
    if (!state.flags.autoUnlocked) return false;
    state.civ.autoProtocol = !state.civ.autoProtocol;
    addLog(state, "Civil-defense automation " + (state.civ.autoProtocol ? "ENGAGED" : "suspended") + ".", "order");
    return true;
  }
  function cmdBuyDoctrine(state, id) {
    if (state.over || !state.civ.alive) return false;
    const civ = state.civ;
    const found = tierById(id);
    if (!found) return false;
    const { branch, tier } = found;
    if (civ.doctrines[id]) return false;
    if (nextTier(branch, civ.doctrines) !== tier) return false;
    if (civ.insight < tier.cost) return false;
    civ.insight -= tier.cost;
    civ.doctrines[id] = true;
    addLog(state, "DOCTRINE adopted: " + tier.name + " (" + branch.name + ").", "good");
    banner(state, tier.name.toUpperCase(), "good");
    return true;
  }
  function summary(state) {
    const score = computeScore(state);
    const rank = rankFor(state.level, score);
    return {
      years: Math.floor(state.day / 365.25),
      civsLost: state.stats.civsLost,
      planetsLost: state.stats.planetsLost,
      lastCivNo: state.civ.no,
      proclaimOk: state.stats.proclaimOk,
      proclaimBad: state.stats.proclaimBad,
      maxAge: AGES[state.stats.maxAge].name,
      score,
      stars: rank.stars,
      title: rank.title,
      level: state.level
    };
  }
  function save(state) {
    return {
      v: 1,
      seed: state.seed,
      rngState: state.rng.getState(),
      // exact continuity, no RNG mutation
      day: state.day,
      planetsLeft: state.planetsLeft,
      sunEscaped: state.sunEscaped,
      flags: state.flags,
      sys: serialize(state.sys),
      cl: Object.assign({}, state.cl, { history: state.cl.history.slice(-400), view: null }),
      civ: state.civ,
      story: state.story,
      calendar: state.calendar,
      stats: state.stats,
      log: state.log.slice(-60),
      over: state.over,
      won: state.won,
      level: state.level,
      score: state.score,
      objsDone: state.objsDone,
      levelDone: state.levelDone
    };
  }
  function load(data) {
    const rng = makeRng(data.seed);
    rng.setState((data.rngState != null ? data.rngState : data.rngSeed) >>> 0);
    const state = {
      seed: data.seed,
      rng,
      sys: deserialize(data.sys),
      cl: Object.assign(createClimate(), data.cl),
      civ: data.civ,
      story: data.story,
      day: data.day,
      planetsLeft: data.planetsLeft,
      sunEscaped: !!data.sunEscaped,
      flags: data.flags,
      calendar: data.calendar || data.proclamation || null,
      log: data.log || [],
      pending: [],
      over: !!data.over,
      won: !!data.won,
      _escCheck: 0,
      stats: data.stats,
      level: data.level == null ? -1 : data.level,
      score: data.score || 0,
      objsDone: data.objsDone || {},
      levelDone: !!data.levelDone
    };
    const c = state.civ;
    if (c && c.water == null) {
      c.water = 0.6 * waterCap(c);
      c.grain = 0.6 * grainCap(c);
      c.orderTarget = 0;
      c.starving = false;
      if (!c.tally) c.tally = {};
      if (c.tally.famine == null) c.tally.famine = 0;
    }
    if (c && c.insight == null) {
      c.insight = 0;
      c.doctrines = {};
    }
    if (c && c.calRewardEra == null) c.calRewardEra = -1;
    if (c && c.tally && c.tally.calendar == null) c.tally.calendar = 0;
    return state;
  }
  var PLANETS_AT_START;
  var init_game = __esm({
    "src/game.ts"() {
      "use strict";
      init_physics();
      init_climate();
      init_civ();
      init_story();
      init_predict();
      init_util();
      init_score();
      PLANETS_AT_START = 12;
    }
  });

  // src/charts.ts
  function sampleTrail(state) {
    if (state.day - trail.lastDay < 2) return;
    trail.lastDay = state.day;
    for (let i = 0; i < 3; i++) {
      const s = state.sys.suns[i];
      trail.suns[i].push(s.x, s.y);
      if (trail.suns[i].length > 2400) trail.suns[i].splice(0, trail.suns[i].length - 2400);
    }
    trail.planet.push(state.sys.planet.x, state.sys.planet.y);
    if (trail.planet.length > 2400) trail.planet.splice(0, trail.planet.length - 2400);
  }
  function resetTrail() {
    trail.suns = [[], [], []];
    trail.planet = [];
    trail.lastDay = -1e9;
    forecast = null;
    computing = null;
    lastDivination = null;
    lastMozi = null;
  }
  function requestForecast(state) {
    if (computing) return;
    computing = { startMs: performance.now(), durMs: 2600 };
    setTimeout(() => {
      if (app && app.state !== state) {
        computing = null;
        return;
      }
      const m = mods(state.civ);
      const eps = epsForAge(state.civ.ageIdx) * m.forecastEps;
      const days = Math.round(540 * m.ensembleDaysMul);
      const frng = makeRng((state.seed >>> 0 ^ Math.floor(state.day * 7)) >>> 0);
      const res = ensembleForecast(state.sys, days, 7, eps, frng);
      forecast = { result: res, day: state.day, eps };
      computing = null;
    }, 2650);
  }
  function rollDivination(state) {
    lastDivination = divination(state.cl, state.rng);
  }
  function runMozi(state) {
    lastMozi = { res: moziModel(state.sys, state.cl), day: state.day };
  }
  function frame(ctx2, x, y, w, h, title) {
    ctx2.strokeStyle = "#2a3548";
    ctx2.lineWidth = 1;
    ctx2.strokeRect(x + 0.5, y + 0.5, w, h);
    if (title) {
      ctx2.fillStyle = "#7a8aa0";
      ctx2.font = "10px Menlo, monospace";
      ctx2.fillText(title.toUpperCase(), x + 8, y + 14);
    }
  }
  function drawObservatory(ctx2, state, w, h) {
    const cl = state.cl;
    const hist = cl.history;
    const pad2 = 12;
    const chartH = Math.floor((h - pad2 * 3) * 0.46);
    frame(ctx2, pad2, pad2, w - pad2 * 2, chartH, "Surface temperature — last " + Math.min(hist.length, 1095) + " days");
    if (hist.length > 1) {
      const view = hist.slice(-1095);
      const x0 = pad2 + 6, x1 = w - pad2 - 6, y0 = pad2 + 22, y1 = pad2 + chartH - 8;
      const tLo = -130, tHi = 160;
      const ty = (t) => y1 - (clamp(t, tLo, tHi) - tLo) / (tHi - tLo) * (y1 - y0);
      ctx2.fillStyle = "rgba(105,240,174,0.07)";
      ctx2.fillRect(x0, ty(45), x1 - x0, ty(-10) - ty(45));
      ctx2.strokeStyle = "rgba(105,240,174,0.25)";
      ctx2.beginPath();
      ctx2.moveTo(x0, ty(0));
      ctx2.lineTo(x1, ty(0));
      ctx2.stroke();
      ctx2.strokeStyle = "#d4af37";
      ctx2.lineWidth = 1.4;
      ctx2.beginPath();
      for (let i = 0; i < view.length; i++) {
        const x = x0 + i / (view.length - 1) * (x1 - x0);
        const y = ty(view[i].tempC);
        if (i === 0) ctx2.moveTo(x, y);
        else ctx2.lineTo(x, y);
      }
      ctx2.stroke();
      ctx2.fillStyle = "#c8d4e0";
      ctx2.font = "10px Menlo, monospace";
      ctx2.fillText(fmtTemp(cl.tempC) + " now", x1 - 78, y0 + 10);
      ctx2.fillStyle = "#7a8aa0";
      ctx2.fillText("+150°", x0 + 2, ty(150) + 4);
      ctx2.fillText("0°", x0 + 2, ty(0) - 3);
      ctx2.fillText("−100°", x0 + 2, ty(-100) + 4);
    }
    const y2 = pad2 * 2 + chartH;
    frame(ctx2, pad2, y2, w - pad2 * 2, chartH, "Distance of the three suns (AU)");
    if (hist.length > 1) {
      const view = hist.slice(-1095);
      const x0 = pad2 + 6, x1 = w - pad2 - 6, y0 = y2 + 22, y1 = y2 + chartH - 8;
      const dMax = Math.max(8, ...view.map((s) => Math.max(s.d[0], s.d[1], s.d[2]))) * 1.05;
      const dy = (d) => y1 - (1 - Math.min(d, dMax) / dMax) * 0 - Math.min(d, dMax) / dMax * (y1 - y0);
      for (let k = 0; k < 3; k++) {
        ctx2.strokeStyle = SUN_COLORS[k];
        ctx2.lineWidth = 1.2;
        ctx2.beginPath();
        for (let i = 0; i < view.length; i++) {
          const x = x0 + i / (view.length - 1) * (x1 - x0);
          const y = dy(view[i].d[k]);
          if (i === 0) ctx2.moveTo(x, y);
          else ctx2.lineTo(x, y);
        }
        ctx2.stroke();
      }
      ctx2.strokeStyle = "rgba(128,216,255,0.3)";
      ctx2.setLineDash([4, 4]);
      ctx2.beginPath();
      ctx2.moveTo(x0, dy(consts.FLY_DIST));
      ctx2.lineTo(x1, dy(consts.FLY_DIST));
      ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.fillStyle = "#80d8ff";
      ctx2.font = "9px Menlo, monospace";
      ctx2.fillText("flying-star line", x0 + 6, dy(consts.FLY_DIST) - 4);
    }
    let ty0 = y2 + chartH + 10;
    ctx2.font = "11px Menlo, monospace";
    if (lastDivination) {
      ctx2.fillStyle = "#d4af37";
      ctx2.fillText(lastDivination.hexagram + ' — "' + lastDivination.verse + '"', pad2 + 2, ty0);
      ctx2.fillStyle = "#7a8aa0";
      ctx2.fillText(
        "The hexagram suggests: " + lastDivination.guess.toUpperCase() + " skies for ~" + lastDivination.horizon + " days. (Divination is... divination.)",
        pad2 + 2,
        ty0 + 16
      );
      ty0 += 36;
    }
    if (state.flags.mozi && lastMozi) {
      ctx2.fillStyle = "#69f0ae";
      wrapText(ctx2, "MOZI'S MODEL: " + lastMozi.res.text, pad2 + 2, ty0, w - pad2 * 2 - 8, 15);
    }
  }
  function wrapText(ctx2, text, x, y, maxW, lineH) {
    const words = text.split(" ");
    let line = "", yy = y;
    for (const word of words) {
      if (ctx2.measureText(line + word).width > maxW && line) {
        ctx2.fillText(line, x, yy);
        line = word + " ";
        yy += lineH;
      } else line += word + " ";
    }
    ctx2.fillText(line, x, yy);
    return yy + lineH;
  }
  function drawOrbit(ctx2, state, w, h) {
    const sys = state.sys;
    let M = 0, cx = 0, cy = 0;
    for (const s of sys.suns) {
      M += s.m;
      cx += s.m * s.x;
      cy += s.m * s.y;
    }
    cx /= M;
    cy /= M;
    let rMax = 4;
    for (const s of sys.suns) rMax = Math.max(rMax, Math.hypot(s.x - cx, s.y - cy) * 1.25);
    rMax = Math.max(rMax, Math.hypot(sys.planet.x - cx, sys.planet.y - cy) * 1.25);
    const scale = Math.min(w, h) * 0.46 / rMax;
    const sx = (x) => w / 2 + (x - cx) * scale;
    const sy = (y) => h / 2 + (y - cy) * scale;
    ctx2.strokeStyle = "rgba(42,53,72,0.6)";
    ctx2.lineWidth = 1;
    ctx2.font = "9px Menlo, monospace";
    ctx2.fillStyle = "#4a5870";
    for (const rr of [1, 2, 5, 10, 20, 40]) {
      if (rr > rMax * 1.1) break;
      ctx2.beginPath();
      ctx2.arc(w / 2, h / 2, rr * scale, 0, 7);
      ctx2.stroke();
      ctx2.fillText(rr + " AU", w / 2 + rr * scale + 3, h / 2 - 3);
    }
    for (let k = 0; k < 3; k++) {
      const t = trail.suns[k];
      ctx2.strokeStyle = SUN_COLORS[k] + "55";
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      for (let i = 0; i < t.length; i += 2) {
        const x = sx(t[i]), y = sy(t[i + 1]);
        if (i === 0) ctx2.moveTo(x, y);
        else ctx2.lineTo(x, y);
      }
      ctx2.stroke();
    }
    ctx2.strokeStyle = "rgba(220,230,245,0.5)";
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    for (let i = 0; i < trail.planet.length; i += 2) {
      const x = sx(trail.planet[i]), y = sy(trail.planet[i + 1]);
      if (i === 0) ctx2.moveTo(x, y);
      else ctx2.lineTo(x, y);
    }
    ctx2.stroke();
    for (let k = 0; k < 3; k++) {
      const s = sys.suns[k];
      ctx2.fillStyle = SUN_COLORS[k];
      ctx2.shadowColor = SUN_COLORS[k];
      ctx2.shadowBlur = 12;
      ctx2.beginPath();
      ctx2.arc(sx(s.x), sy(s.y), 4 + s.m * 3, 0, 7);
      ctx2.fill();
      ctx2.shadowBlur = 0;
    }
    ctx2.fillStyle = "#ffffff";
    ctx2.beginPath();
    ctx2.arc(sx(sys.planet.x), sy(sys.planet.y), 2.5, 0, 7);
    ctx2.fill();
    ctx2.font = "10px Menlo, monospace";
    ctx2.fillText("Trisolaris", sx(sys.planet.x) + 6, sy(sys.planet.y) + 3);
    ctx2.fillStyle = "#7a8aa0";
    ctx2.font = "10px Menlo, monospace";
    ctx2.fillText("THE TRUE CONFIGURATION — three suns, one world, no solution.", 12, h - 12);
  }
  function drawComputer(ctx2, state, w, h, nowMs) {
    if (computing) {
      drawMotherboard(ctx2, w, h, nowMs);
      return;
    }
    const pad2 = 12;
    if (!forecast) {
      ctx2.fillStyle = "#7a8aa0";
      ctx2.font = "12px Menlo, monospace";
      wrapText(
        ctx2,
        'COMPUTER "QIN I" — thirty million soldiers stand in formation on the plain, flags down, awaiting the order to compute. Press RUN FORECAST to integrate the motion of the three suns from the latest measurements.',
        pad2 + 4,
        pad2 + 24,
        w - pad2 * 2 - 8,
        18
      );
      ctx2.fillStyle = "#d4af37";
      ctx2.fillText("Instrument error: ±" + epsForAge(state.civ.ageIdx).toExponential(1) + " (improves with technology)", pad2 + 4, pad2 + 130);
      return;
    }
    const res = forecast.result;
    const age = Math.floor(state.day - forecast.day);
    frame(
      ctx2,
      pad2,
      pad2,
      w - pad2 * 2,
      h - pad2 * 2 - 30,
      "Ensemble forecast — 7 integrations, ±" + forecast.eps.toExponential(1) + " measurement error" + (age > 0 ? " (" + age + " days old)" : "")
    );
    const x0 = pad2 + 8, x1 = w - pad2 - 10, y0 = pad2 + 26, y1 = h - pad2 - 44;
    const tLo = -130, tHi = 160;
    const ty = (t) => y1 - (clamp(t, tLo, tHi) - tLo) / (tHi - tLo) * (y1 - y0);
    const tx = (d) => x0 + d / res.days * (x1 - x0);
    ctx2.fillStyle = "rgba(105,240,174,0.07)";
    ctx2.fillRect(x0, ty(45), x1 - x0, ty(-10) - ty(45));
    ctx2.fillStyle = "rgba(212,175,55,0.18)";
    ctx2.beginPath();
    for (let d = 0; d < res.days; d++) {
      const x = tx(d), y = ty(res.tMax[d]);
      if (d === 0) ctx2.moveTo(x, y);
      else ctx2.lineTo(x, y);
    }
    for (let d = res.days - 1; d >= 0; d--) ctx2.lineTo(tx(d), ty(res.tMin[d]));
    ctx2.closePath();
    ctx2.fill();
    ctx2.strokeStyle = "#d4af37";
    ctx2.lineWidth = 1.4;
    ctx2.beginPath();
    for (let d = 0; d < res.days; d++) {
      const x = tx(d), y = ty(res.tMean[d]);
      if (d === 0) ctx2.moveTo(x, y);
      else ctx2.lineTo(x, y);
    }
    ctx2.stroke();
    if (res.horizonDay < res.days) {
      const hx = tx(res.horizonDay);
      ctx2.strokeStyle = "#ff5252";
      ctx2.setLineDash([5, 4]);
      ctx2.beginPath();
      ctx2.moveTo(hx, y0);
      ctx2.lineTo(hx, y1);
      ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.fillStyle = "#ff5252";
      ctx2.font = "10px Menlo, monospace";
      ctx2.fillText("CHAOS HORIZON: day " + res.horizonDay, Math.min(hx + 6, w - 170), y0 + 12);
      ctx2.fillStyle = "#7a8aa0";
      wrapText(ctx2, "Beyond this line the seven futures disagree. More flags will not help; the fault is the universe's.", Math.min(hx + 6, w - 230), y0 + 28, 200, 13);
    } else {
      ctx2.fillStyle = "#69f0ae";
      ctx2.font = "10px Menlo, monospace";
      ctx2.fillText("All futures agree across the window. A calendar may be printed.", x0 + 6, y0 + 12);
    }
    ctx2.fillStyle = "#7a8aa0";
    ctx2.font = "9px Menlo, monospace";
    ctx2.fillText("today", x0, y1 + 12);
    ctx2.fillText("+540 days", x1 - 56, y1 + 12);
    ctx2.fillText("0°C", x0 + 2, ty(0) - 3);
  }
  function drawMotherboard(ctx2, w, h, nowMs) {
    const t = computing ? (performance.now() - computing.startMs) / computing.durMs : 0;
    ctx2.fillStyle = "#070a0f";
    ctx2.fillRect(0, 0, w, h);
    const cols = Math.floor(w / 9), rows = Math.floor((h - 60) / 9);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wave = Math.sin(c * 0.25 - nowMs / 90 + Math.sin(r * 0.5) * 2);
        const gate = Math.sin(r * 13.7 + c * 7.3);
        const on = wave + gate * 0.6 > 0.55;
        ctx2.fillStyle = on ? gate > 0.5 ? "#69f0ae" : "#2d7a55" : "#10161f";
        ctx2.fillRect(c * 9 + 2, r * 9 + 2, 6, 6);
      }
    }
    const busY = Math.floor(rows / 2) * 9 + 2;
    const busX = nowMs / 3 % (w + 80) - 40;
    ctx2.fillStyle = "#ffd75e";
    ctx2.fillRect(busX, busY, 26, 6);
    ctx2.fillStyle = "#d4af37";
    ctx2.font = "11px Menlo, monospace";
    ctx2.fillText("QIN I COMPUTING — phalanx " + Math.min(99, Math.floor(t * 100)) + "%", 12, h - 34);
    ctx2.fillStyle = "#7a8aa0";
    ctx2.font = "10px Menlo, monospace";
    ctx2.fillText("System bus: light cavalry. Fault protocol: beheading.", 12, h - 16);
  }
  function lastForecastInfo(nowDay) {
    if (!forecast) return null;
    return {
      horizonDay: forecast.result.horizonDay,
      days: forecast.result.days,
      ageDays: nowDay != null ? Math.max(0, Math.floor(nowDay - forecast.day)) : 0,
      confident: forecast.result.horizonDay >= forecast.result.days
    };
  }
  var SUN_COLORS, trail, forecast, computing, lastDivination, lastMozi, isComputing;
  var init_charts = __esm({
    "src/charts.ts"() {
      "use strict";
      init_util();
      init_climate();
      init_predict();
      init_civ();
      init_app();
      SUN_COLORS = ["#ffd75e", "#ff9e64", "#7ecbff"];
      trail = { suns: [[], [], []], planet: [], lastDay: -1e9 };
      forecast = null;
      computing = null;
      lastDivination = null;
      lastMozi = null;
      isComputing = () => !!computing;
    }
  });

  // src/audio.ts
  function init() {
    if (ready) {
      if (ac && ac.state === "suspended") ac.resume().catch(() => {
      });
      return;
    }
    if (muted) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    windFilter = ac.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 300;
    windFilter.Q.value = 0.8;
    windGain = ac.createGain();
    windGain.gain.value = 0.05;
    src.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    src.start();
    droneGain = ac.createGain();
    droneGain.gain.value = 0.05;
    droneGain.connect(master);
    for (const f of [55, 82.5]) {
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(droneGain);
      o.start();
      droneOsc.push(o);
    }
    musicGain = ac.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(master);
    padFilter = ac.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 600;
    padFilter.Q.value = 0.6;
    padFilter.connect(musicGain);
    pad = [];
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator();
      o.type = "triangle";
      o.frequency.value = midi(50 + [0, 4, 7][i]);
      const g = ac.createGain();
      g.gain.value = [0.5, 0.32, 0.4][i];
      o.connect(g);
      g.connect(padFilter);
      o.start();
      pad.push(o);
    }
    nextNote = ac.currentTime + 1.5;
    ready = true;
  }
  function bell(freq, vol) {
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(1e-4, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 3.2);
    o.connect(g);
    g.connect(musicGain);
    o.start(t);
    o.stop(t + 3.4);
  }
  function update3(state) {
    if (!ready || !state) return;
    const now = ac.currentTime;
    const T = state.cl.tempC;
    const chaos = state.cl.eraType === "chaotic";
    const dormant = !state.civ || !state.civ.alive || state.civ.dormant;
    const extremity = clamp((Math.abs(T - 15) - 25) / 80, 0, 1);
    const coldness = clamp((5 - T) / 55, 0, 1);
    const heat = clamp((T - 30) / 130, 0, 1);
    const wTarget = 0.03 + extremity * 0.16 + (chaos ? 0.05 : 0);
    windGain.gain.setTargetAtTime(wTarget, now, 1.5);
    windFilter.frequency.setTargetAtTime(220 + extremity * 700, now, 2);
    droneOsc[1].frequency.setTargetAtTime(chaos ? 58.3 : 82.5, now, 3);
    droneGain.gain.setTargetAtTime(chaos ? 0.07 : 0.045, now, 2);
    const root = Math.round(50 - coldness * 10 + heat * 5);
    const off = chaos ? [0, 6, 10] : [0, 4, 7];
    for (let i = 0; i < pad.length; i++) {
      pad[i].frequency.setTargetAtTime(midi(root + off[i]), now, 4);
      pad[i].detune.setTargetAtTime(chaos ? (i - 1) * 8 : 0, now, 4);
    }
    padFilter.frequency.setTargetAtTime(
      clamp(300 + (T + 60) / 210 * 1100, 260, 2200),
      now,
      3
    );
    padFilter.Q.setTargetAtTime(chaos ? 2.2 : 0.6, now, 3);
    musicGain.gain.setTargetAtTime(dormant ? 0.012 : chaos ? 0.05 : 0.062, now, 3);
    const ivalTarget = (chaos ? 1.6 : 2.8) - extremity * 0.5;
    noteIval += (ivalTarget - noteIval) * 0.03;
    if (nextNote < now - 5) nextNote = now + noteIval;
    if (!dormant && now >= nextNote) {
      if (Math.random() > 0.22) {
        const scale = chaos ? SCALE_CHAOS : SCALE_STABLE;
        const deg = scale[Math.random() * scale.length | 0];
        const oct = Math.random() < 0.55 ? 12 : Math.random() < 0.5 ? 0 : 24;
        bell(midi(root + deg + oct), (chaos ? 0.04 : 0.055) * (0.7 + Math.random() * 0.5));
      }
      nextNote = now + noteIval * (0.7 + Math.random() * 0.6);
    }
  }
  function tone(freq, t0, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  function sting(kind) {
    if (!ready) return;
    const t = ac.currentTime + 0.02;
    switch (kind) {
      case "stable":
        tone(330, t, 0.9, "sine", 0.1);
        tone(495, t + 0.18, 1.1, "sine", 0.08);
        break;
      case "chaotic":
        tone(220, t, 0.8, "sawtooth", 0.05);
        tone(156, t + 0.15, 1.2, "sawtooth", 0.05);
        break;
      case "hot":
        tone(523, t, 0.4, "square", 0.04);
        tone(659, t + 0.1, 0.4, "square", 0.04);
        tone(784, t + 0.2, 0.7, "square", 0.04);
        break;
      case "cold":
        tone(392, t, 1.4, "sine", 0.07);
        tone(370, t + 0.5, 1.8, "sine", 0.06);
        break;
      case "syzygy": {
        tone(40, t, 2.6, "sine", 0.28);
        const n = ac.createBufferSource();
        const len = ac.sampleRate * 1.2;
        const b = ac.createBuffer(1, len, ac.sampleRate);
        const dd = b.getChannelData(0);
        for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
        n.buffer = b;
        const g = ac.createGain();
        g.gain.value = 0.1;
        const f = ac.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 200;
        n.connect(f);
        f.connect(g);
        g.connect(master);
        n.start(t);
        break;
      }
      case "death":
        tone(294, t, 1.6, "sine", 0.1);
        tone(247, t + 0.5, 1.8, "sine", 0.1);
        tone(196, t + 1, 2.4, "sine", 0.1);
        break;
      case "germinate":
        tone(587, t, 0.5, "sine", 0.07);
        tone(880, t + 0.16, 0.9, "sine", 0.05);
        break;
      // A soft "incoming transmission" chime for story beats — gentle, two
      // rising sine tones with a long tail, so a prompt arrives kindly.
      case "beat":
        tone(396, t, 1.2, "sine", 0.05);
        tone(528, t + 0.18, 1.4, "sine", 0.045);
        tone(792, t + 0.36, 1.1, "sine", 0.025);
        break;
      case "age":
        tone(440, t, 0.35, "triangle", 0.08);
        tone(554, t + 0.12, 0.35, "triangle", 0.08);
        tone(659, t + 0.24, 0.6, "triangle", 0.08);
        break;
      case "fleet":
        [440, 554, 659, 880].forEach((f, i) => tone(f, t + i * 0.16, 1, "triangle", 0.09));
        break;
    }
  }
  function setMuted(m) {
    muted = m;
    if (ready && master) master.gain.value = m ? 0 : 0.5;
    if (!ready && !m) init();
  }
  function isMuted() {
    return muted;
  }
  var ac, master, windGain, windFilter, droneGain, droneOsc, muted, ready, musicGain, padFilter, pad, nextNote, noteIval, midi, SCALE_STABLE, SCALE_CHAOS;
  var init_audio = __esm({
    "src/audio.ts"() {
      "use strict";
      init_util();
      ac = null;
      master = null;
      windGain = null;
      windFilter = null;
      droneGain = null;
      droneOsc = [];
      muted = false;
      ready = false;
      musicGain = null;
      padFilter = null;
      pad = [];
      nextNote = 0;
      noteIval = 2.6;
      midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
      SCALE_STABLE = [0, 2, 4, 7, 9, 12, 14];
      SCALE_CHAOS = [0, 2, 4, 6, 8, 10, 12];
    }
  });

  // src/portraits.ts
  var portraits_exports = {};
  __export(portraits_exports, {
    keyFor: () => keyFor,
    svg: () => svg
  });
  function keyFor(speaker) {
    return KEY[speaker] || (/^(SYSTEM|REGISTRAR)/i.test(speaker || "") ? "system" : "scholar");
  }
  function svg(speaker) {
    const inner = ART[keyFor(speaker)] || ART.scholar;
    return '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  }
  var KEY, bust, head, neck, ART;
  var init_portraits = __esm({
    "src/portraits.ts"() {
      "use strict";
      KEY = {
        "SYSTEM": "system",
        "ADMINISTRATOR": "administrator",
        "Follower of King Wen": "follower",
        "King Wen of Zhou": "kingwen",
        "Mozi": "mozi",
        "You (Copernicus)": "copernicus",
        "Galileo": "galileo",
        "Aristotle": "aristotle",
        "Newton": "newton",
        "Von Neumann": "vonneumann",
        "Qin Shi Huang": "qin",
        "Einstein": "einstein"
      };
      bust = '<path d="M24 96 Q26 72 50 70 Q74 72 76 96" fill="rgba(227,187,95,0.07)"/><path d="M24 96 Q26 72 50 70 Q74 72 76 96"/>';
      head = '<circle cx="50" cy="46" r="13"/>';
      neck = '<path d="M44 58 L44 66 M56 58 L56 66"/>';
      ART = {
        // The registrar / system: the three suns, no body — a cold authority.
        system: '<circle cx="50" cy="40" r="9" fill="rgba(227,187,95,0.18)"/><circle cx="36" cy="60" r="7" fill="rgba(227,187,95,0.12)"/><circle cx="64" cy="60" r="7" fill="rgba(227,187,95,0.12)"/><circle cx="50" cy="40" r="9"/><circle cx="36" cy="60" r="7"/><circle cx="64" cy="60" r="7"/><path d="M50 40 L36 60 M50 40 L64 60 M36 60 L64 60" opacity="0.4"/>',
        // The administrator: an eye outside the game — digital, watching.
        administrator: '<path d="M22 50 Q50 30 78 50 Q50 70 22 50 Z"/><circle cx="50" cy="50" r="9"/><circle cx="50" cy="50" r="3.5" fill="currentColor"/><path d="M50 18 L50 26 M50 74 L50 82 M18 50 L26 50 M74 50 L82 50" opacity="0.5"/><circle cx="50" cy="50" r="32" opacity="0.25"/>',
        // A hooded acolyte, head bowed.
        follower: bust + '<path d="M34 50 Q34 26 50 26 Q66 26 66 50 Q58 44 50 44 Q42 44 34 50 Z" fill="rgba(0,0,0,0.25)"/><path d="M34 50 Q34 26 50 26 Q66 26 66 50"/><circle cx="50" cy="48" r="9"/>',
        // King Wen: tall crown + the broken/solid lines of a hexagram.
        kingwen: bust + neck + '<circle cx="50" cy="46" r="12"/><path d="M38 34 L40 22 L46 30 L50 20 L54 30 L60 22 L62 34 Z"/><g opacity="0.85" transform="translate(14,40)"><path d="M0 0 H12 M0 5 H12 M0 10 H5 M7 10 H12 M0 15 H12 M0 20 H5 M7 20 H12 M0 25 H12"/></g>',
        // Mozi: topknot scholar + an armillary sphere.
        mozi: bust + neck + head + '<path d="M50 33 L50 27 M46 29 H54" /><g transform="translate(64,42)" opacity="0.9"><circle cx="0" cy="0" r="13"/><ellipse cx="0" cy="0" rx="13" ry="5"/><path d="M0 -13 L0 13"/></g>',
        // Copernicus (you): a heliocentric ring diagram beside the figure.
        copernicus: bust + neck + head + '<g transform="translate(64,44)" opacity="0.95"><circle cx="0" cy="0" r="2.5" fill="currentColor"/><ellipse cx="0" cy="0" rx="7" ry="3" transform="rotate(20)"/><ellipse cx="0" cy="0" rx="13" ry="6" transform="rotate(20)"/><circle cx="11" cy="3" r="1.8" fill="currentColor"/></g>',
        // Galileo: bearded scholar tilting a long glass to the sky.
        galileo: bust + neck + '<circle cx="46" cy="46" r="12"/><path d="M40 54 Q46 60 52 54" opacity="0.7"/><path d="M58 56 L84 30" stroke-width="4"/><circle cx="84" cy="30" r="3"/>',
        // Aristotle: laurel + the Ω of first principles.
        aristotle: bust + neck + head + '<path d="M37 40 Q32 34 38 30 M63 40 Q68 34 62 30" opacity="0.8"/><text x="50" y="52" font-size="14" text-anchor="middle" fill="currentColor" opacity="0.9" font-family="Georgia,serif">&#937;</text>',
        // Newton: long hair, a prism splitting light, an apple falling.
        newton: bust + '<path d="M34 44 Q34 28 50 28 Q66 28 66 44 Q66 64 58 66 L42 66 Q34 64 34 44 Z" fill="rgba(0,0,0,0.18)"/><circle cx="50" cy="46" r="11"/><path d="M72 30 L80 44 L64 44 Z" opacity="0.9"/><path d="M64 44 L84 48 M64 46 L84 52 M64 48 L84 56" opacity="0.5"/><circle cx="24" cy="34" r="3"/><path d="M24 31 Q22 28 25 27" opacity="0.7"/>',
        // apple
        // Von Neumann: round glasses + a lattice of logic cells.
        vonneumann: bust + neck + '<path d="M37 44 Q37 30 50 30 Q63 30 63 44" opacity="0.8"/><circle cx="50" cy="47" r="11"/><circle cx="45" cy="46" r="3"/><circle cx="55" cy="46" r="3"/><path d="M48 46 H52"/><g transform="translate(66,58)" opacity="0.85"><rect x="0" y="0" width="22" height="14"/><path d="M7 0 V14 M14 0 V14 M0 7 H22"/></g>',
        // Qin Shi Huang: beaded flat crown (mianguan) + a grid of soldier-flags.
        qin: bust + neck + head + '<path d="M34 32 H66 L62 26 H38 Z"/><path d="M38 26 V20 M50 26 V18 M62 26 V20" opacity="0.7"/><g transform="translate(64,56)" opacity="0.85"><rect x="0" y="0" width="20" height="14"/><path d="M3 3 v6 M3 3 h3 v3 h-3" /><path d="M10 3 v6 M10 3 h3 v3 h-3"/><path d="M3 10 h4 M10 10 h4 M17 6 v4"/></g>',
        // Einstein: wild hair, mustache, and a swinging pendulum.
        einstein: bust + neck + '<circle cx="48" cy="47" r="11"/><path d="M34 40 Q30 30 40 32 M66 42 Q70 32 60 32 M37 36 Q34 30 42 30 M63 36 Q66 30 58 30" opacity="0.85"/><path d="M42 54 Q48 58 54 54" opacity="0.8"/><path d="M76 26 L70 52" /><circle cx="70" cy="54" r="3.5" fill="currentColor"/>',
        // pendulum
        // Generic scholar fallback.
        scholar: bust + neck + head
      };
    }
  });

  // src/render2d.ts
  function addShake(amount) {
    trauma = Math.min(1, trauma + amount * (reduceMotion ? 0.25 : 1));
  }
  function flash(color, a) {
    flashColor = color;
    flashA = Math.max(flashA, a * (reduceMotion ? 0.4 : 1));
  }
  function init2(cv) {
    canvas = cv;
    ctx = canvas.getContext("2d", { alpha: false }) || canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    stars = [];
    for (let i = 0; i < 320; i++) {
      stars.push({
        x: srng.next(),
        y: srng.next() * 0.85,
        s: srng.range(0.4, 1.7),
        tw: srng.range(0, Math.PI * 2),
        b: srng.range(0.5, 1)
      });
    }
    const SKINS = ["#e8b88a", "#d9a06b", "#c98a55", "#b27845", "#8d5b34"];
    const CLOTH_OLD = ["#7d4a32", "#5b6470", "#7a6a3c", "#84423c", "#4f5a45", "#6b5340"];
    const CLOTH_NEW = ["#2e3b4e", "#54331f", "#3c4a3a", "#5d2f35", "#27313f", "#6e7681"];
    const ROLES = [
      "farmer",
      "farmer",
      "farmer",
      "carrier",
      "carrier",
      "mason",
      "mason",
      "keeper",
      "townsman",
      "townsman",
      "watcher"
    ];
    crowd = [];
    for (let i = 0; i < 84; i++) {
      crowd.push({
        x: srng.range(0.3, 0.66),
        row: i % 4,
        // depth row: 0 far … 3 near
        phase: srng.range(0, Math.PI * 2),
        drift: srng.range(0.7, 1.3),
        build: srng.range(0.85, 1.18),
        // height/width variation
        skin: srng.pick(SKINS),
        clothOld: srng.pick(CLOTH_OLD),
        // robes of the early ages
        clothNew: srng.pick(CLOTH_NEW),
        // coats of the late ages
        hat: srng.next() < 0.4,
        // conical straw hat (early ages)
        hair: srng.next() < 0.5 ? "#17120d" : "#2a1d12",
        role: ROLES[i % ROLES.length],
        tx: srng.range(0.32, 0.62),
        // current destination
        dwellMs: srng.range(0, 2500),
        // time left standing/working
        leg: srng.next()
        // which end of the route we're on
      });
    }
    buildRidges(ridgeSeed);
    buildGrain();
    buildScenery();
  }
  function buildScenery() {
    const r = makeRng(424242);
    rocksFg = [];
    for (let i = 0; i < 26; i++) rocksFg.push({ x: r.next(), d: r.next(), s: r.range(1.2, 3.6) });
    tufts = [];
    for (let i = 0; i < 64; i++) tufts.push({ x: r.next(), d: r.next(), s: r.range(2.5, 5.5), ph: r.range(0, 6) });
    townA = [];
    for (let i = 0; i < 14; i++) townA.push({
      dx: 0.255 + i * 0.0135 + r.range(0, 6e-3),
      w: r.range(8, 14),
      h: r.range(10, 26),
      win: r.int(2, 9)
    });
    townB = [];
    for (let i = 0; i < 10; i++) townB.push({
      dx: 0.305 + i * 0.021 + r.range(0, 0.01),
      w: r.range(10, 17),
      h: r.range(34, 88),
      win: r.int(2, 9)
    });
  }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildRidges(ridgeSeed);
  }
  function buildRidges(seed) {
    const rr = makeRng(seed);
    ridges = [];
    for (let layer = 0; layer < 3; layer++) {
      const n = 129;
      const pts = new Float32Array(n);
      pts[0] = rr.range(0.2, 0.8);
      pts[n - 1] = rr.range(0.2, 0.8);
      let step = n - 1, amp = 0.55;
      while (step > 1) {
        for (let i = 0; i < n - 1; i += step) {
          const mid = i + step / 2;
          pts[mid] = (pts[i] + pts[i + step]) / 2 + rr.range(-amp, amp);
        }
        step /= 2;
        amp *= 0.55;
      }
      ridges.push({ pts, h: [0.1, 0.055, 0.028][layer], y: [0.03, 0.016, 6e-3][layer] });
    }
  }
  function buildGrain() {
    try {
      const cv = document.createElement("canvas");
      cv.width = 128;
      cv.height = 128;
      const g = cv.getContext("2d");
      const img = g.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 118 + Math.floor(Math.random() * 20);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 14;
      }
      g.putImageData(img, 0, 0);
      grain = cv;
    } catch (e) {
      grain = null;
    }
  }
  function reseedTerrain(k) {
    ridgeSeed = 11 + k * 71;
    buildRidges(ridgeSeed);
  }
  function wrap(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  }
  function render(state, nowMs) {
    const obs = observe(state.sys);
    const cl = state.cl;
    const T = cl.tempC;
    curChaos = cl.eraType === "chaotic";
    const horizon = H * 0.72;
    let brightest = obs.suns[0];
    for (const o of obs.suns) if (o.flux > brightest.flux) brightest = o;
    viewDir += wrap(brightest.dir - viewDir) * 0.02;
    let fluxVis = 0;
    const sunsView = [];
    for (const o of obs.suns) {
      const off = wrap(o.dir - viewDir);
      const x = W / 2 + off / (Math.PI * 0.55) * (W / 2);
      const y = horizon - H * (0.32 + 0.14 * Math.sin(o.dir * 2));
      if (Math.abs(off) < Math.PI * 0.62) fluxVis += o.flux;
      sunsView.push({ o, x, y, off });
    }
    const dt = clamp(nowMs - lastFrameMs || 16, 0, 100) / 1e3;
    lastFrameMs = nowMs;
    brightSm += (clamp(Math.pow(fluxVis / 1.2, 0.5), 0, 1) - brightSm) * relax(dt, 0.25);
    const bright = brightSm;
    const liftTarget = obs.alignSpread < 0.12 ? 1 : 0;
    syzygyLift += (liftTarget - syzygyLift) * 0.04;
    if (syzygyLift < 0.01) syzygyLift = 0;
    trauma = Math.max(0, trauma - dt * 1.1);
    const s2 = trauma * trauma;
    const ox = s2 * 13 * (Math.sin(nowMs * 0.061) + Math.sin(nowMs * 0.0227) * 0.6);
    const oy = s2 * 11 * (Math.cos(nowMs * 0.053) + Math.sin(nowMs * 0.0313) * 0.6);
    ctx.save();
    ctx.translate(ox, oy);
    drawSky(bright, T, nowMs, sunsView, horizon);
    drawSuns(sunsView, horizon, bright);
    drawTerrain(state, horizon, T, bright, sunsView, nowMs);
    drawWeather(state, obs, horizon, T, nowMs);
    ctx.restore();
    postProcess(nowMs, T, bright, dt);
  }
  function skyPalette(bright, T) {
    const heat = clamp((T + 60) / 160, 0, 1);
    const mix = (a, b, t) => a + (b - a) * t;
    const zen = [
      mix(6, mix(26, 120, heat), bright),
      mix(8, mix(60, 90, heat), bright),
      mix(18, mix(140, 90, heat), bright)
    ];
    const mid = [
      mix(10, mix(70, 200, heat), bright),
      mix(12, mix(110, 140, heat), bright),
      mix(24, mix(180, 110, heat), bright)
    ];
    const hor = [
      mix(16, mix(150, 255, heat), bright),
      mix(18, mix(170, 170, heat), bright),
      mix(34, mix(210, 90, heat), bright)
    ];
    return { zen, mid, hor };
  }
  function drawSky(bright, T, nowMs, sunsView, horizon) {
    const p = skyPalette(bright, T);
    const g = ctx.createLinearGradient(0, 0, 0, horizon * 1.05);
    g.addColorStop(0, rgb(p.zen));
    g.addColorStop(0.55, rgb(p.mid));
    g.addColorStop(1, rgb(p.hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const starA = clamp(0.9 - bright * 1.7, 0, 0.9);
    if (starA > 0.02) {
      ctx.save();
      ctx.globalAlpha = starA * 0.5;
      const mg = ctx.createLinearGradient(0, 0, W, horizon * 0.9);
      mg.addColorStop(0, "rgba(120,140,190,0)");
      mg.addColorStop(0.45, "rgba(150,165,210,0.10)");
      mg.addColorStop(0.55, "rgba(190,180,220,0.16)");
      mg.addColorStop(0.65, "rgba(150,165,210,0.10)");
      mg.addColorStop(1, "rgba(120,140,190,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, horizon);
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(nowMs / 900 + s.tw);
        ctx.globalAlpha = starA * tw * s.b;
        ctx.fillStyle = "#dce8ff";
        ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
        if (s.s > 1.3) {
          ctx.globalAlpha *= 0.4;
          ctx.fillRect(s.x * W - 2, s.y * H, 5, 0.7);
          ctx.fillRect(s.x * W, s.y * H - 2, 0.7, 5);
        }
      }
      ctx.restore();
      maybeShootingStar(nowMs, starA);
      drawMeteorShower(nowMs, starA);
    }
    if (T < -55 && bright < 0.35) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let band = 0; band < 2; band++) {
        const baseY = H * (0.12 + band * 0.1);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) {
          const y = baseY + Math.sin(x * 4e-3 + nowMs / (2400 + band * 700)) * 34 + Math.sin(x * 0.013 - nowMs / 1700) * 12;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        const ag = ctx.createLinearGradient(0, 0, 0, H * 0.4);
        ag.addColorStop(0, "rgba(40,255,170,0)");
        ag.addColorStop(1, band ? "rgba(60,210,255,0.05)" : "rgba(40,255,170,0.07)");
        ctx.fillStyle = ag;
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const sv of sunsView) {
      if (sv.o.d > consts.DISC_DIST * 1.4) continue;
      const closeness = clamp(1.6 / sv.o.d, 0, 1.4);
      const gg = ctx.createRadialGradient(sv.x, horizon, 0, sv.x, horizon, W * 0.32);
      gg.addColorStop(0, "rgba(255,170,90," + 0.14 * closeness + ")");
      gg.addColorStop(1, "rgba(255,150,80,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(0, 0, W, horizon + 4);
    }
    ctx.restore();
  }
  function maybeShootingStar(nowMs, starA) {
    if (!shootingStar && Math.random() < 12e-4) {
      shootingStar = {
        x: Math.random() * W,
        y: Math.random() * H * 0.3,
        vx: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5),
        vy: 2 + Math.random() * 2,
        life: 1
      };
    }
    if (shootingStar) {
      const s = shootingStar;
      ctx.save();
      ctx.globalAlpha = starA * s.life;
      ctx.strokeStyle = "#eaf2ff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 6, s.y - s.vy * 6);
      ctx.stroke();
      ctx.restore();
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.025;
      if (s.life <= 0) shootingStar = null;
    }
  }
  function drawMeteorShower(nowMs, starA) {
    if (starA < 0.06) {
      meteors.length = 0;
      return;
    }
    if (nowMs > nextShower) {
      nextShower = nowMs + (curChaos ? 26e3 : 52e3) + Math.random() * 45e3;
      showerUntil = nowMs + 3e3 + Math.random() * 3500;
      radiantX = Math.random() * W;
      radiantY = Math.random() * H * 0.26;
    }
    if (nowMs < showerUntil && Math.random() < 0.5 && meteors.length < 42) {
      const dir = radiantX < W / 2 ? 1 : -1;
      meteors.push({
        x: radiantX + (Math.random() - 0.5) * W * 0.5,
        y: radiantY + (Math.random() - 0.5) * H * 0.12,
        vx: dir * (5 + Math.random() * 6),
        vy: 3 + Math.random() * 4,
        life: 1,
        len: 5 + Math.random() * 5
      });
    }
    if (!meteors.length) return;
    ctx.save();
    ctx.strokeStyle = "#eaf2ff";
    ctx.lineCap = "round";
    for (const m of meteors) {
      ctx.globalAlpha = starA * m.life * 0.9;
      ctx.lineWidth = 1.4 * m.life;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * m.len, m.y - m.vy * m.len);
      ctx.stroke();
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.022;
    }
    ctx.restore();
    meteors = meteors.filter((m) => m.life > 0 && m.x > -60 && m.x < W + 60 && m.y < H + 60);
  }
  function drawSuns(sunsView, horizon, bright) {
    const order = [...sunsView].sort((a, b) => b.o.d - a.o.d);
    for (const sv of order) {
      const { o, x, y } = sv;
      if (x < -W * 0.25 || x > W * 1.25) continue;
      const isDisc = o.d < consts.DISC_DIST;
      if (!isDisc) {
        const a = clamp(2.4 / o.d, 0.22, 1);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 14);
        gg.addColorStop(0, "rgba(255,255,255," + a + ")");
        gg.addColorStop(0.25, "rgba(200,220,255," + a * 0.5 + ")");
        gg.addColorStop(1, "rgba(180,200,255,0)");
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, 7);
        ctx.fill();
        ctx.globalAlpha = a * 0.75;
        ctx.strokeStyle = "rgba(220,235,255,0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 9, y);
        ctx.lineTo(x + 9, y);
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x, y + 9);
        ctx.stroke();
        ctx.restore();
      } else {
        const rad = clamp(o.angSize * 2200, 6, Math.min(W, H) * 0.55);
        const closeness = clamp(1 - o.d / consts.DISC_DIST, 0, 1);
        const cg = Math.round(lerp(246, 130, Math.pow(closeness, 1.6)));
        const cb = Math.round(lerp(218, 62, Math.pow(closeness, 1.3)));
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const halo = ctx.createRadialGradient(x, y, rad * 0.5, x, y, rad * 3.2);
        halo.addColorStop(0, `rgba(255,${cg},${Math.round(cb * 0.7)},0.55)`);
        halo.addColorStop(0.4, `rgba(255,${Math.round(cg * 0.85)},${Math.round(cb * 0.5)},0.16)`);
        halo.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, rad * 3.2, 0, 7);
        ctx.fill();
        const streak = ctx.createLinearGradient(x - rad * 5, y, x + rad * 5, y);
        streak.addColorStop(0, "rgba(255,220,170,0)");
        streak.addColorStop(0.5, `rgba(255,${cg},${cb},0.28)`);
        streak.addColorStop(1, "rgba(255,220,170,0)");
        ctx.fillStyle = streak;
        ctx.fillRect(x - rad * 5, y - Math.max(1.2, rad * 0.05), rad * 10, Math.max(2.4, rad * 0.1));
        ctx.restore();
        const disc = ctx.createRadialGradient(x - rad * 0.25, y - rad * 0.25, 0, x, y, rad);
        disc.addColorStop(0, "#ffffff");
        disc.addColorStop(0.55, `rgb(255,${cg},${cb})`);
        disc.addColorStop(1, `rgb(${Math.round(255 * 0.92)},${Math.round(cg * 0.72)},${Math.round(cb * 0.55)})`);
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, 7);
        ctx.fill();
        if (rad > 26) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, rad * 0.96, 0, 7);
          ctx.clip();
          ctx.fillStyle = `rgba(120,50,20,0.32)`;
          for (let k = 0; k < 3; k++) {
            const px = x + Math.cos(o.i * 2.7 + k * 2.3) * rad * (0.25 + k * 0.18);
            const py = y + Math.sin(o.i * 1.9 + k * 3.1) * rad * (0.2 + k * 0.14);
            ctx.beginPath();
            ctx.ellipse(px, py, rad * (0.07 - k * 0.012), rad * (0.045 - k * 8e-3), k, 0, 7);
            ctx.fill();
          }
          ctx.strokeStyle = `rgba(255,${Math.max(90, cg - 60)},${Math.max(30, cb - 60)},0.5)`;
          ctx.lineWidth = Math.max(1.5, rad * 0.03);
          ctx.beginPath();
          ctx.arc(x, y, rad * 0.985, 0, 7);
          ctx.stroke();
          ctx.restore();
        }
        if (o.flux > 0.35) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const cxs = W / 2, cys = H / 2;
          for (const k of [1.55, 2.1, 2.75]) {
            const gx = x + (cxs - x) * k, gy = y + (cys - y) * k;
            const gr = Math.max(3, rad * 0.13 * (3.2 - k));
            const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            gg.addColorStop(0, `rgba(255,${cg},${cb},${0.05 * (3.4 - k)})`);
            gg.addColorStop(1, "rgba(255,200,120,0)");
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.arc(gx, gy, gr, 0, 7);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }
  }
  function setBiome2d(worldIndex) {
    biome2 = BIOMES2[(worldIndex % BIOMES2.length + BIOMES2.length) % BIOMES2.length];
    return biome2.name;
  }
  function groundColor(T, bright) {
    if (T < -15) {
      const c = lerp(36, 185, clamp((-T - 15) / 80, 0, 1));
      return [c * 0.9, c * 0.96, c * 1.05];
    }
    const heat = clamp((T - 45) / 250, 0, 1);
    const bf = 0.5 + bright * 0.6;
    const g = biome2.g;
    return [g[0] * bf + heat * 95, g[1] * bf - heat * 6, g[2] * bf - heat * 8];
  }
  function drawTerrain(state, horizon, T, bright, sunsView, nowMs) {
    const civ = state.civ;
    const p = skyPalette(bright, T);
    for (let l = 0; l < ridges.length; l++) {
      const r = ridges[l];
      const fog = [0.62, 0.4, 0.2][l];
      const tone2 = [
        lerp(10, p.hor[0], fog),
        lerp(12, p.hor[1], fog),
        lerp(20, p.hor[2], fog)
      ];
      ctx.fillStyle = rgb(tone2);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      const n = r.pts.length;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * W;
        const y = horizon - H * r.y - clamp(r.pts[i], 0, 1) * H * r.h;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, horizon);
      ctx.closePath();
      ctx.fill();
    }
    const gc = groundColor(T, bright);
    const gg = ctx.createLinearGradient(0, horizon, 0, H);
    gg.addColorStop(0, rgb([gc[0] * 1.15, gc[1] * 1.15, gc[2] * 1.15]));
    gg.addColorStop(0.25, rgb(gc));
    gg.addColorStop(1, rgb([gc[0] * 0.35, gc[1] * 0.35, gc[2] * 0.35]));
    ctx.fillStyle = gg;
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const sv of sunsView) {
      if (sv.o.d > consts.DISC_DIST) continue;
      const closeness = clamp(1.3 / sv.o.d, 0, 1.3);
      const rg = ctx.createRadialGradient(sv.x, horizon + 8, 0, sv.x, horizon + 8, W * 0.3);
      rg.addColorStop(0, "rgba(255,180,110," + 0.1 * closeness + ")");
      rg.addColorStop(1, "rgba(255,160,90,0)");
      ctx.fillStyle = rg;
      ctx.save();
      ctx.translate(sv.x, horizon + 10);
      ctx.scale(1, 0.22);
      ctx.translate(-sv.x, -(horizon + 10));
      ctx.beginPath();
      ctx.arc(sv.x, horizon + 10, W * 0.3, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    drawGroundDetail(civ, horizon, T, bright, nowMs);
    drawCivilization(civ, horizon, T, bright, sunsView, nowMs);
    drawLake(state, horizon, T, sunsView, nowMs);
    if (state.flags.einstein && civ.ageIdx >= 10) drawPendulum(horizon, nowMs);
    if (civ.fleet.building || civ.fleet.ships > 0) drawFleetWorks(civ, horizon, nowMs);
    drawCrowd(state, horizon, nowMs);
  }
  function drawPyramid(civ, horizon, sunsView, bright) {
    const baseX = W * 0.18, baseW = Math.min(W * 0.17, 250);
    const h = baseW * 0.85;
    const x0 = baseX - baseW / 2, x1 = baseX + baseW / 2;
    let lit = 0;
    let best = 0;
    for (const sv of sunsView) {
      if (sv.o.flux > best) {
        best = sv.o.flux;
        lit = sv.x < baseX ? -1 : 1;
      }
    }
    const dark = "rgba(9,11,17,0.96)";
    const lightFace = "rgba(" + Math.round(26 + bright * 60) + "," + Math.round(22 + bright * 44) + "," + Math.round(20 + bright * 30) + ",0.96)";
    if (civ.ageIdx < 4) {
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        const f2 = (i + 1) / steps;
        const wA = baseW * (1 - i / steps * 0.78);
        ctx.fillStyle = dark;
        ctx.fillRect(baseX - wA / 2, horizon - h * f2, wA, h / steps + 1);
        ctx.fillStyle = lit > 0 ? lightFace : dark;
        ctx.fillRect(baseX + (lit > 0 ? 0 : -wA / 2), horizon - h * f2, wA / 2, h / steps + 1);
      }
    } else {
      ctx.fillStyle = lit < 0 ? lightFace : dark;
      ctx.beginPath();
      ctx.moveTo(x0, horizon);
      ctx.lineTo(baseX, horizon - h);
      ctx.lineTo(baseX, horizon);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = lit > 0 ? lightFace : dark;
      ctx.beginPath();
      ctx.moveTo(baseX, horizon);
      ctx.lineTo(baseX, horizon - h);
      ctx.lineTo(x1, horizon);
      ctx.closePath();
      ctx.fill();
      if (civ.ageIdx < 8) {
        ctx.fillStyle = dark;
        ctx.fillRect(baseX - 9, horizon - h - 10, 18, 12);
      } else {
        ctx.strokeStyle = dark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(baseX, horizon - h);
        ctx.lineTo(baseX, horizon - h - 26);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,90,90," + (0.5 + 0.5 * Math.sin(performance.now() / 500)) + ")";
        ctx.beginPath();
        ctx.arc(baseX, horizon - h - 28, 2, 0, 7);
        ctx.fill();
        for (let i = 0; i < 9; i++) {
          const bx = baseX + baseW * 0.62 + i * 15;
          const bh = 16 + i * 37 % 34;
          ctx.fillStyle = dark;
          ctx.fillRect(bx, horizon - bh, 10, bh);
          if (bright < 0.45) {
            ctx.fillStyle = "rgba(255,214,120,0.75)";
            for (let wY = 4; wY < bh - 3; wY += 6) {
              if ((i * 13 + wY) % 17 < 9) ctx.fillRect(bx + 2, horizon - bh + wY, 2, 2);
              if ((i * 7 + wY) % 13 < 6) ctx.fillRect(bx + 6, horizon - bh + wY, 2, 2);
            }
          }
        }
      }
    }
  }
  function drawDehydratories(civ, horizon, bright) {
    const n = clamp(2 + civ.ageIdx, 3, 9);
    for (let i = 0; i < n; i++) {
      const x = W * 0.7 + i * 27;
      const r = 9 + i % 3 * 2;
      const g = ctx.createLinearGradient(x - r, horizon, x + r, horizon);
      g.addColorStop(0, "rgba(10,13,19,0.95)");
      g.addColorStop(1, "rgba(" + Math.round(24 + bright * 40) + "," + Math.round(22 + bright * 30) + "," + Math.round(24 + bright * 24) + ",0.95)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, horizon + 6, r, Math.PI, 0);
      ctx.fill();
    }
  }
  function drawGroundDetail(civ, horizon, T, bright, nowMs) {
    const depthSpan = H - horizon;
    ctx.fillStyle = "rgba(8,10,14,0.5)";
    for (const r of rocksFg) {
      const y = horizon + 8 + r.d * depthSpan * 0.85;
      const s = r.s * (0.7 + r.d * 1.8);
      ctx.beginPath();
      ctx.ellipse(r.x * W, y, s, s * 0.55, 0, 0, 7);
      ctx.fill();
    }
    if (T > -25 && T < 60) {
      const vigor = clamp(1 - Math.abs(T - 16) / 45, 0.15, 1);
      const gC = Math.round(70 + 60 * vigor), gR = Math.round(70 + 30 * (1 - vigor));
      ctx.strokeStyle = `rgba(${gR},${gC},48,0.55)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const t of tufts) {
        const y = horizon + 6 + t.d * depthSpan * 0.8;
        const s = t.s * (0.6 + t.d * 1.6) * (0.5 + vigor * 0.5);
        const sway = Math.sin(nowMs / 700 + t.ph) * s * 0.35;
        const x = t.x * W;
        ctx.moveTo(x, y);
        ctx.lineTo(x + sway, y - s);
        ctx.moveTo(x + 2, y);
        ctx.lineTo(x + 2 + sway * 0.8, y - s * 0.75);
      }
      ctx.stroke();
    }
    if (civ.ageIdx >= 2 && T > -25 && T < 60) {
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(W * (0.3 + i * 0.1), H);
        ctx.lineTo(W * (0.4 + i * 0.018), horizon + depthSpan * 0.18);
      }
      ctx.stroke();
    }
    if (T > 60) {
      const a = clamp((T - 60) / 200, 0, 0.5);
      ctx.strokeStyle = `rgba(20,8,4,${a})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const r = rocksFg[i * 3 % rocksFg.length];
        let x = r.x * W, y = horizon + 14 + r.d * depthSpan * 0.8;
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += ((i * 7 + k * 13) % 9 - 4) * 7;
          y += 6 + (i + k) % 4 * 5;
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }
  function drawCivilization(civ, horizon, T, bright, sunsView, nowMs) {
    const age = civ.ageIdx;
    const dark = bright < 0.38;
    if (age <= 4) {
      ctx.fillStyle = "rgba(10,12,17,0.95)";
      for (let i = 0; i < 5 - Math.min(3, age); i++) {
        const x = W * (0.36 + i * 0.045), s = 11 - i;
        ctx.beginPath();
        ctx.moveTo(x - s, horizon + 4);
        ctx.lineTo(x, horizon - s);
        ctx.lineTo(x + s, horizon + 4);
        ctx.closePath();
        ctx.fill();
        if (dark && age <= 2) {
          const f = 0.5 + 0.5 * Math.sin(nowMs / 90 + i * 7);
          const fg = ctx.createRadialGradient(x, horizon + 2, 0, x, horizon + 2, 9 + f * 3);
          fg.addColorStop(0, "rgba(255,170,70," + (0.35 + f * 0.2) + ")");
          fg.addColorStop(1, "rgba(255,120,40,0)");
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(x, horizon + 2, 12, 0, 7);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    if (age >= 10) {
      const nB = clamp(Math.floor((civ.tech - 8110) / 450) + 1, 1, townB.length);
      ctx.fillStyle = "rgba(9,11,16,0.88)";
      for (const b of townB.slice(0, nB)) {
        const x = W * (0.18 + b.dx);
        ctx.fillRect(x, horizon - b.h, b.w, b.h);
        if (dark) {
          ctx.fillStyle = "rgba(255,214,130,0.7)";
          for (let wy = 5; wy < b.h - 4; wy += 7)
            for (let wx = 2; wx < b.w - 2; wx += 5)
              if ((wx * 13 + wy * 7 + b.win) % 11 < 5) ctx.fillRect(x + wx, horizon - b.h + wy, 1.6, 2.2);
          ctx.fillStyle = "rgba(9,11,16,0.88)";
        }
        if (age >= 11 && b.h > 70) {
          const blink = Math.sin(nowMs / 350 + b.dx * 80) > 0.4;
          if (blink) {
            ctx.fillStyle = "rgba(255,80,80,0.95)";
            ctx.fillRect(x + b.w / 2 - 1, horizon - b.h - 4, 2, 2);
            ctx.fillStyle = "rgba(9,11,16,0.88)";
          }
        }
      }
    }
    if (age >= 3) {
      const nA = clamp(Math.floor((civ.tech - 190) / 110) + 2, 2, townA.length);
      ctx.fillStyle = "rgba(10,12,18,0.94)";
      for (const b of townA.slice(0, nA)) {
        const x = W * (0.16 + b.dx);
        const h = b.h * (age >= 8 ? 1.25 : 1);
        ctx.fillRect(x, horizon - h, b.w, h);
        if (dark && age >= 5) {
          ctx.fillStyle = age >= 9 ? "rgba(255,220,140,0.75)" : "rgba(255,170,80,0.35)";
          for (let wy = 4; wy < h - 3; wy += 6)
            if ((wy * 7 + b.win) % 9 < (age >= 9 ? 5 : 2))
              ctx.fillRect(x + 2 + (wy * 5 + b.win) % Math.max(2, b.w - 5), horizon - h + wy, 1.6, 2);
          ctx.fillStyle = "rgba(10,12,18,0.94)";
        }
      }
    }
    drawPyramid(civ, horizon, sunsView, bright);
    if (age >= 5) {
      const ox = W * 0.585, oy = horizon - 16;
      ctx.fillStyle = "rgba(9,11,16,0.95)";
      ctx.beginPath();
      ctx.ellipse(ox, horizon + 2, 34, 9, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ox, oy + 10, 13, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(ox - 13, oy + 10, 26, 8);
      ctx.strokeStyle = "rgba(9,11,16,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ox, oy + 6);
      ctx.lineTo(ox + 9, oy - 6);
      ctx.stroke();
    }
    if (age >= 8) {
      const fx = W * 0.475;
      ctx.fillStyle = "rgba(10,12,17,0.95)";
      ctx.fillRect(fx, horizon - 18, 44, 18);
      ctx.fillRect(fx + 6, horizon - 34, 5, 16);
      ctx.fillRect(fx + 26, horizon - 40, 5, 22);
      ctx.save();
      for (let i = 0; i < 10; i++) {
        const t = (nowMs / 4200 + i / 10) % 1;
        const sx = fx + (i % 2 ? 8.5 : 28.5) + Math.sin(t * 6 + i) * 6 * t;
        const sy = horizon - (i % 2 ? 34 : 40) - t * 52;
        ctx.fillStyle = "rgba(120,120,128," + 0.16 * (1 - t) + ")";
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + t * 7, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }
    if (age >= 9) {
      ctx.strokeStyle = "rgba(8,10,14,0.85)";
      ctx.lineWidth = 1.5;
      let prevX = null, prevY = null;
      for (let i = 0; i < 4; i++) {
        const px = W * (0.56 + i * 0.05), ph = 26 - i * 2;
        ctx.beginPath();
        ctx.moveTo(px, horizon + 4);
        ctx.lineTo(px, horizon - ph);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px - 5, horizon - ph + 4);
        ctx.lineTo(px + 5, horizon - ph + 4);
        ctx.stroke();
        if (prevX != null) {
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.quadraticCurveTo((prevX + px) / 2, prevY + 7, px, horizon - ph + 4);
          ctx.stroke();
        }
        prevX = px;
        prevY = horizon - ph + 4;
      }
    }
    if (age >= 10) {
      const mx = W * 0.545, mh = Math.min(H * 0.16, 120);
      ctx.strokeStyle = "rgba(8,10,14,0.9)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(mx, horizon);
      ctx.lineTo(mx, horizon - mh);
      ctx.moveTo(mx - mh * 0.22, horizon);
      ctx.lineTo(mx, horizon - mh * 0.62);
      ctx.moveTo(mx + mh * 0.22, horizon);
      ctx.lineTo(mx, horizon - mh * 0.62);
      ctx.stroke();
      if (Math.sin(nowMs / 480) > 0) {
        ctx.fillStyle = "rgba(255,70,70,0.95)";
        ctx.beginPath();
        ctx.arc(mx, horizon - mh - 2, 1.8, 0, 7);
        ctx.fill();
      }
      const cx2 = W * 0.51;
      ctx.fillStyle = "rgba(10,12,17,0.95)";
      ctx.beginPath();
      ctx.moveTo(cx2 - 12, horizon);
      ctx.bezierCurveTo(cx2 - 7, horizon - 16, cx2 - 8, horizon - 22, cx2 - 7, horizon - 28);
      ctx.lineTo(cx2 + 7, horizon - 28);
      ctx.bezierCurveTo(cx2 + 8, horizon - 22, cx2 + 7, horizon - 16, cx2 + 12, horizon);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 5; i++) {
        const t = (nowMs / 5200 + i / 5) % 1;
        ctx.fillStyle = "rgba(190,196,206," + 0.13 * (1 - t) + ")";
        ctx.beginPath();
        ctx.arc(cx2 + Math.sin(t * 5 + i * 2) * 8 * t, horizon - 30 - t * 42, 3 + t * 8, 0, 7);
        ctx.fill();
      }
    }
    if (age >= 12 && dark) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2; i++) {
        const bx = W * (0.07 + i * 0.05);
        const ang = -Math.PI / 2 + Math.sin(nowMs / (3100 + i * 900) + i * 2) * 0.5;
        const len = H * 0.55;
        const ex = bx + Math.cos(ang) * len, ey = horizon + Math.sin(ang) * len;
        const lg = ctx.createLinearGradient(bx, horizon, ex, ey);
        lg.addColorStop(0, "rgba(190,215,255,0.10)");
        lg.addColorStop(1, "rgba(190,215,255,0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(bx, horizon);
        ctx.lineTo(ex - 14, ey);
        ctx.lineTo(ex + 14, ey);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    drawDehydratories(civ, horizon, bright);
  }
  function drawLake(state, horizon, T, sunsView, nowMs) {
    const cx = W * 0.88, cy = horizon + Math.max(26, H * 0.05);
    const rx = Math.min(W * 0.09, 130), ry = rx * 0.28;
    let fill;
    if (T < -2) fill = "rgba(200,222,240,0.9)";
    else if (T > 70) fill = "rgba(130,62,40,0.85)";
    else fill = "rgba(34,76,118,0.9)";
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 7);
    ctx.fill();
    if (T >= -2 && T <= 70) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 7);
      ctx.clip();
      for (const sv of sunsView) {
        if (sv.o.d > consts.DISC_DIST || Math.abs(sv.x - cx) > rx * 2.2) continue;
        const rg = ctx.createRadialGradient(sv.x, cy, 0, sv.x, cy, rx * 0.8);
        rg.addColorStop(0, "rgba(255,220,150,0.5)");
        rg.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      }
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#dcebff";
      for (let i = 0; i < 5; i++) {
        const lx = cx - rx * 0.7 + (nowMs / 36 + i * 53) % (rx * 1.4);
        ctx.fillRect(lx, cy - 2 + i * 2, 16, 0.8);
      }
      ctx.restore();
    }
  }
  function drawPendulum(horizon, nowMs) {
    const px = W * 0.52, h = Math.min(H * 0.2, 170);
    ctx.strokeStyle = "rgba(8,10,15,0.95)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px - h * 0.4, horizon);
    ctx.lineTo(px, horizon - h);
    ctx.lineTo(px + h * 0.4, horizon);
    ctx.stroke();
    const ang = Math.sin(nowMs / 1400) * 0.55;
    const bx = px + Math.sin(ang) * h * 0.62, by = horizon - h + Math.cos(ang) * h * 0.62;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px, horizon - h);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const bg = ctx.createRadialGradient(bx - 2, by - 2, 0, bx, by, 8);
    bg.addColorStop(0, "rgba(70,80,100,1)");
    bg.addColorStop(1, "rgba(8,10,15,1)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, 7);
    ctx.fill();
  }
  function drawFleetWorks(civ, horizon, nowMs) {
    const gx = W * 0.06;
    ctx.strokeStyle = "rgba(8,10,15,0.96)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const x = gx + i * 22;
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(x, horizon - 44);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, horizon - 44);
      ctx.lineTo(x + 12, horizon - 38);
      ctx.stroke();
    }
    if (civ.fleet.building) {
      const t = nowMs % 2600 / 2600;
      const y = horizon - t * H * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - t;
      const fg = ctx.createRadialGradient(gx + 22, y, 0, gx + 22, y, 10);
      fg.addColorStop(0, "rgba(255,230,170,1)");
      fg.addColorStop(1, "rgba(255,160,60,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(gx + 22, y, 10, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,190,110,0.6)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(gx + 22, y + 6);
      ctx.lineTo(gx + 22, y + 26);
      ctx.stroke();
      ctx.restore();
    }
  }
  function drawFigure(p, x, y, s, age, walking, phase, lifted, bright, action) {
    s *= p.build;
    const Hp = s * 3.2;
    const headR = Hp * 0.135;
    const legL = Hp * 0.46;
    const torsoL = Hp * 0.4;
    const hipY = y - legL;
    const shoulderY = hipY - torsoL;
    const headY = shoulderY - headR * 1.15;
    const sway = walking ? Math.sin(phase) : 0;
    let tilt = lifted ? Math.sin(phase * 0.6) * 0.5 : 0;
    if (action === "bend") tilt = 0.3 + Math.sin(phase * 2.2) * 0.14;
    const robed = age <= 4;
    const cloth = age >= 9 ? p.clothNew : p.clothOld;
    const shade = 1 - clamp(0.55 - bright * 0.6, 0, 0.5);
    ctx.save();
    ctx.translate(x, y);
    if (tilt) ctx.rotate(tilt);
    ctx.translate(-x, -y);
    if (!lifted) {
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      ctx.beginPath();
      ctx.ellipse(x, y + 1, Hp * 0.18, Hp * 0.05, 0, 0, 7);
      ctx.fill();
    }
    ctx.lineCap = "round";
    if (robed) {
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.05, shoulderY);
      ctx.lineTo(x + headR * 1.05, shoulderY);
      ctx.lineTo(x + headR * 1.5 + sway * s * 0.18, y - 1);
      ctx.lineTo(x - headR * 1.5 + sway * s * 0.18, y - 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = cloth;
      ctx.lineWidth = Math.max(1.2, headR * 0.7);
      ctx.beginPath();
      ctx.moveTo(x - headR * 0.7, shoulderY + 1);
      ctx.lineTo(x - headR * 1.3 - sway * s * 0.25, hipY);
      ctx.moveTo(x + headR * 0.7, shoulderY + 1);
      ctx.lineTo(x + headR * 1.3 + sway * s * 0.25, hipY);
      ctx.stroke();
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.arc(x - headR * 1.3 - sway * s * 0.25, hipY + 1, headR * 0.32, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + headR * 1.3 + sway * s * 0.25, hipY + 1, headR * 0.32, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#1a140e";
      ctx.beginPath();
      ctx.ellipse(x + sway * legL * 0.3, y, headR * 0.45, headR * 0.2, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - sway * legL * 0.3, y - (lifted ? s * 0.2 : 0), headR * 0.45, headR * 0.2, 0, 0, 7);
      ctx.fill();
    } else {
      ctx.strokeStyle = age >= 9 ? "#1d242e" : "#3a3026";
      ctx.lineWidth = Math.max(1.2, headR * 0.62);
      ctx.beginPath();
      ctx.moveTo(x, hipY);
      ctx.lineTo(x + sway * legL * 0.42, y);
      ctx.moveTo(x, hipY);
      ctx.lineTo(x - sway * legL * 0.42, y - (lifted ? s * 0.2 : 0));
      ctx.stroke();
      ctx.fillStyle = "#14100b";
      ctx.beginPath();
      ctx.ellipse(x + sway * legL * 0.42, y, headR * 0.42, headR * 0.18, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - sway * legL * 0.42, y - (lifted ? s * 0.2 : 0), headR * 0.42, headR * 0.18, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(x - headR * 0.95, shoulderY);
      ctx.lineTo(x + headR * 0.95, shoulderY);
      ctx.lineTo(x + headR * 0.8, hipY + 2);
      ctx.lineTo(x - headR * 0.8, hipY + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(20,15,10,0.8)";
      ctx.fillRect(x - headR * 0.8, hipY - 1, headR * 1.6, Math.max(1, headR * 0.18));
      ctx.strokeStyle = cloth;
      ctx.lineWidth = Math.max(1.1, headR * 0.5);
      ctx.beginPath();
      if (lifted) {
        ctx.moveTo(x - headR * 0.7, shoulderY + 1);
        ctx.lineTo(x - headR * 1.5, shoulderY - headR * 1.3);
        ctx.moveTo(x + headR * 0.7, shoulderY + 1);
        ctx.lineTo(x + headR * 1.6, shoulderY - headR);
      } else {
        ctx.moveTo(x - headR * 0.7, shoulderY + 1);
        ctx.lineTo(x - sway * s * 0.4 - headR * 0.3, hipY);
        ctx.moveTo(x + headR * 0.7, shoulderY + 1);
        ctx.lineTo(x + sway * s * 0.4 + headR * 0.3, hipY);
      }
      ctx.stroke();
      ctx.fillStyle = p.skin;
      if (!lifted) {
        ctx.beginPath();
        ctx.arc(x - sway * s * 0.4 - headR * 0.3, hipY + 1, headR * 0.28, 0, 7);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + sway * s * 0.4 + headR * 0.3, hipY + 1, headR * 0.28, 0, 7);
        ctx.fill();
      }
    }
    if (action === "bend") {
      ctx.strokeStyle = "#6e552f";
      ctx.lineWidth = Math.max(1, headR * 0.22);
      ctx.beginPath();
      ctx.moveTo(x + headR * 0.9, hipY - headR * 0.2);
      ctx.lineTo(x + headR * 2.2, y + 1);
      ctx.stroke();
    } else if (action === "hammer") {
      const swing = Math.abs(Math.sin(phase * 3));
      const ax = x - headR * 0.7, ay = shoulderY + 1;
      const ex = ax - headR * 1.3, ey = ay + headR * 0.7 - swing * headR * 1.6;
      ctx.strokeStyle = cloth;
      ctx.lineWidth = Math.max(1.1, headR * 0.5);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = "#555e6a";
      ctx.fillRect(ex - headR * 0.45, ey - headR * 0.35, headR * 0.9, headR * 0.5);
    } else if (action === "inspect") {
      ctx.strokeStyle = cloth;
      ctx.lineWidth = Math.max(1.1, headR * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + headR * 0.7, shoulderY + 1);
      ctx.lineTo(x + headR * 0.95, headY + headR * 0.2);
      ctx.stroke();
    } else if (action === "carry") {
      const sw2 = Math.sin(phase) * headR * 0.3;
      ctx.strokeStyle = "#6e552f";
      ctx.lineWidth = Math.max(1, headR * 0.2);
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.6, shoulderY - headR * 0.1 + sw2 * 0.3);
      ctx.lineTo(x + headR * 1.6, shoulderY - headR * 0.1 - sw2 * 0.3);
      ctx.stroke();
      ctx.strokeStyle = "rgba(40,32,20,0.85)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.5, shoulderY);
      ctx.lineTo(x - headR * 1.5, shoulderY + headR * 0.6 + sw2 * 0.4);
      ctx.moveTo(x + headR * 1.5, shoulderY);
      ctx.lineTo(x + headR * 1.5, shoulderY + headR * 0.6 - sw2 * 0.4);
      ctx.stroke();
      ctx.fillStyle = "#3e4651";
      ctx.fillRect(x - headR * 1.75, shoulderY + headR * 0.6 + sw2 * 0.4, headR * 0.5, headR * 0.55);
      ctx.fillRect(x + headR * 1.25, shoulderY + headR * 0.6 - sw2 * 0.4, headR * 0.5, headR * 0.55);
    }
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - headR * 0.22, headY + headR * 0.7, headR * 0.44, headR * 0.55);
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, 7);
    ctx.fill();
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.12, headR * 0.96, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    if (headR >= 2.6) {
      ctx.fillStyle = "#231a12";
      ctx.fillRect(x - headR * 0.42, headY - headR * 0.08, headR * 0.22, headR * 0.16);
      ctx.fillRect(x + headR * 0.2, headY - headR * 0.08, headR * 0.22, headR * 0.16);
      ctx.fillStyle = "rgba(120,60,40,0.85)";
      ctx.fillRect(x - headR * 0.18, headY + headR * 0.42, headR * 0.36, Math.max(0.8, headR * 0.1));
    }
    if (p.hat && age <= 6) {
      ctx.fillStyle = "#9a7c43";
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.45, headY - headR * 0.25);
      ctx.lineTo(x, headY - headR * 1.7);
      ctx.lineTo(x + headR * 1.45, headY - headR * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function drawCrowd(state, horizon, nowMs) {
    const civ = state.civ;
    const domeX = 0.715, lakeX = 0.84;
    const rolls = Math.round(clamp(Math.sqrt(Math.max(civ.popD, 0)) * 5.5, 0, 42));
    for (let i = 0; i < rolls; i++) {
      const rx = W * (0.695 + i % 14 * 75e-4);
      const ry = horizon + 14 + Math.floor(i / 14) * 7;
      ctx.fillStyle = "rgba(196,184,158,0.82)";
      ctx.beginPath();
      ctx.ellipse(rx, ry, 4.2, 1.7, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,108,86,0.6)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(rx - 3, ry);
      ctx.lineTo(rx + 3, ry);
      ctx.stroke();
    }
    if (civ.dormant) return;
    const visible = Math.round(clamp(Math.sqrt(Math.max(civ.popH, 0)) * 8.5, 0, 84));
    const brightNow = brightSm;
    const dtMs = clamp(nowMs - (drawCrowd._last || nowMs), 0, 100);
    drawCrowd._last = nowMs;
    const age = civ.ageIdx;
    const WALK = 52e-6;
    for (let i = 0; i < visible; i++) {
      const p = crowd[i];
      let walking = false, action = null;
      if (civ.order === "dehydrate") {
        walking = Math.abs(domeX - p.x) > 5e-3;
        if (walking) p.x += Math.sign(domeX - p.x) * WALK * 1.5 * p.drift * dtMs;
      } else if (civ.order === "rehydrate") {
        walking = true;
        if (p.x > 0.8) p.x -= WALK * p.drift * dtMs;
        else if (Math.abs(0.46 - p.x) > 0.01) p.x += Math.sign(0.46 - p.x) * WALK * p.drift * dtMs;
        else walking = false;
      } else if (p.dwellMs > 0) {
        p.dwellMs -= dtMs;
        if (p.role === "farmer" && age >= 2) action = "bend";
        else if (p.role === "mason") action = "hammer";
        else if (p.role === "keeper" || p.role === "watcher") action = "inspect";
      } else if (Math.abs(p.tx - p.x) > 5e-3) {
        walking = true;
        p.x += Math.sign(p.tx - p.x) * WALK * p.drift * dtMs;
        if (p.role === "carrier" && !p.leg) action = "carry";
      } else {
        p.leg = 1 - p.leg;
        const j = (i * 31 + Math.floor(p.phase * 100)) % 7;
        switch (p.role) {
          case "farmer":
            p.tx = 0.31 + j * 0.022;
            p.dwellMs = 2600 + j * 600;
            break;
          case "carrier":
            p.tx = p.leg ? 0.795 : 0.45 + j * 0.01;
            p.dwellMs = p.leg ? 700 : 1700;
            break;
          case "mason":
            p.tx = p.leg ? 0.235 + j * 8e-3 : 0.42 + j * 0.012;
            p.dwellMs = p.leg ? 3400 : 900;
            break;
          case "keeper":
            p.tx = 0.695 + j * 0.013;
            p.dwellMs = 1500 + j * 400;
            break;
          case "watcher":
            p.tx = (age >= 5 ? 0.565 : 0.52) + j * 8e-3;
            p.dwellMs = 4200 + j * 800;
            break;
          default:
            p.tx = p.leg ? 0.345 + j * 0.01 : 0.48 + j * 0.014;
            p.dwellMs = 1100 + j * 500;
        }
      }
      const s = 4.6 + p.row * 2.1;
      const baseY = horizon + 9 + p.row * Math.max(8, H * 0.016);
      p.phase += (walking ? 95e-4 : 22e-4) * dtMs * p.drift;
      const lift = syzygyLift * (16 + p.row * 7 + Math.sin(p.phase * 0.7 + i) * 6);
      drawFigure(
        p,
        p.x * W,
        baseY - lift,
        s,
        age,
        walking && !syzygyLift,
        p.phase,
        syzygyLift > 0.05,
        brightNow,
        syzygyLift > 0.05 ? null : action
      );
    }
  }
  function drawWeather(state, obs, horizon, T, nowMs) {
    if (T < -22) {
      const want = Math.min(180, Math.round((-T - 20) * 2.4));
      while (snow.length < want) snow.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.5 + 0.6 });
      if (snow.length > want) snow.length = want;
      ctx.fillStyle = "rgba(228,238,252,0.85)";
      for (const f of snow) {
        f.y += 16e-4 * f.s;
        f.x += Math.sin(nowMs / 800 + f.y * 9) * 4e-4;
        if (f.y > 1) {
          f.y = 0;
          f.x = Math.random();
        }
        ctx.fillRect(f.x * W, f.y * H, f.s, f.s);
      }
    } else snow.length = 0;
    if (T > 75) {
      const want = Math.min(130, Math.round((T - 70) / 3));
      while (embers.length < want) embers.push({ x: Math.random(), y: 1, s: Math.random() + 0.5 });
      if (embers.length > want) embers.length = want;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,150,60,0.7)";
      for (const e of embers) {
        e.y -= 22e-4 * e.s;
        e.x += Math.sin(nowMs / 500 + e.y * 14) * 6e-4;
        if (e.y < 0.3) {
          e.y = 1;
          e.x = Math.random();
        }
        ctx.fillRect(e.x * W, e.y * H, e.s, e.s * 2);
      }
      ctx.restore();
    } else embers.length = 0;
    if (obs.alignSpread < 0.12) {
      const want = 90;
      while (rocks.length < want) rocks.push({ x: Math.random(), y: 1 + Math.random(), s: Math.random() * 2 + 1 });
      ctx.fillStyle = "rgba(58,53,48,0.9)";
      for (const r of rocks) {
        r.y -= 3e-3;
        if (r.y < -0.1) {
          r.y = 1.05;
          r.x = Math.random();
        }
        const y = r.y * (H - horizon) + horizon;
        ctx.fillRect(r.x * W, y, r.s, r.s);
      }
    } else rocks.length = 0;
  }
  function postProcess(nowMs, T, bright, dt) {
    const gradeTarget = clamp((Math.abs(T - 15) - 25) / 130, 0, 0.13);
    gradeA += (gradeTarget - gradeA) * relax(dt || 0.016, 0.8);
    if (gradeA > 4e-3) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = T > 15 ? "rgba(255,140,70," + gradeA + ")" : "rgba(110,170,255," + gradeA + ")";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (flashA > 5e-3) {
      ctx.fillStyle = "rgba(" + flashColor + "," + flashA.toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
      flashA *= Math.exp(-(dt || 0.016) / 0.16);
    }
    const v = ctx.createRadialGradient(
      W / 2,
      H * 0.45,
      Math.min(W, H) * 0.42,
      W / 2,
      H * 0.55,
      Math.max(W, H) * 0.78
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    if (grain) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      const ox = nowMs * 0.31 % 128, oy = nowMs * 0.17 % 128;
      for (let x = -ox; x < W; x += 128)
        for (let y = -oy; y < H; y += 128)
          ctx.drawImage(grain, x, y);
      ctx.restore();
    }
  }
  function titleDemo(nowMs) {
    if (!demo) {
      const rng = makeRng(2049);
      demo = { sys: createSystem(rng), trails: [[], [], []], pTrail: [] };
    }
    advance(demo.sys, 4e-3);
    for (let i = 0; i < 3; i++) {
      const s = demo.sys.suns[i];
      demo.trails[i].push(s.x, s.y);
      if (demo.trails[i].length > 1600) demo.trails[i].splice(0, 2);
    }
    demo.pTrail.push(demo.sys.planet.x, demo.sys.planet.y);
    if (demo.pTrail.length > 1600) demo.pTrail.splice(0, 2);
    ctx.fillStyle = "#06080c";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(nowMs / 1100 + s.tw);
      ctx.globalAlpha = 0.35 * tw * s.b;
      ctx.fillStyle = "#cdd8f0";
      ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
    }
    ctx.restore();
    let M = 0, cx = 0, cy = 0;
    for (const s of demo.sys.suns) {
      M += s.m;
      cx += s.m * s.x;
      cy += s.m * s.y;
    }
    cx /= M;
    cy /= M;
    let rMax = 5;
    for (const s of demo.sys.suns) rMax = Math.max(rMax, Math.hypot(s.x - cx, s.y - cy) * 1.3);
    const scale = Math.min(W, H) * 0.4 / rMax;
    const sx = (x) => W / 2 + (x - cx) * scale;
    const sy = (y) => H * 0.5 + (y - cy) * scale;
    const cols = ["#ffd75e", "#ff9e64", "#7ecbff"];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const t = demo.trails[i];
      ctx.strokeStyle = cols[i] + "2e";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < t.length; k += 2) {
        const x = sx(t[k]), y = sy(t[k + 1]);
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      const s = demo.sys.suns[i];
      const g = ctx.createRadialGradient(sx(s.x), sy(s.y), 0, sx(s.x), sy(s.y), 22);
      g.addColorStop(0, cols[i]);
      g.addColorStop(1, cols[i] + "00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx(s.x), sy(s.y), 22, 0, 7);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(235,242,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < demo.pTrail.length; k += 2) {
      const x = sx(demo.pTrail[k]), y = sy(demo.pTrail[k + 1]);
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const p = demo.sys.planet;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), 2.2, 0, 7);
    ctx.fill();
    ctx.restore();
    postProcess(nowMs, 0, 0.2);
  }
  var canvas, ctx, W, H, DPR, viewDir, stars, shootingStar, snow, embers, rocks, meteors, showerUntil, nextShower, radiantX, radiantY, curChaos, crowd, ridges, grain, ridgeSeed, srng, trauma, flashA, flashColor, brightSm, gradeA, lastFrameMs, reduceMotion, rocksFg, tufts, townA, townB, rgb, BIOMES2, biome2, syzygyLift, demo, render2d;
  var init_render2d = __esm({
    "src/render2d.ts"() {
      "use strict";
      init_util();
      init_physics();
      init_climate();
      W = 0;
      H = 0;
      DPR = 1;
      viewDir = 0;
      stars = [];
      shootingStar = null;
      snow = [];
      embers = [];
      rocks = [];
      meteors = [];
      showerUntil = 0;
      nextShower = 12e3;
      radiantX = 0;
      radiantY = 0;
      curChaos = false;
      crowd = [];
      ridges = [];
      grain = null;
      ridgeSeed = 11;
      srng = makeRng(8888);
      trauma = 0;
      flashA = 0;
      flashColor = "255,255,255";
      brightSm = 0;
      gradeA = 0;
      lastFrameMs = 0;
      reduceMotion = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
      rocksFg = [];
      tufts = [];
      townA = [];
      townB = [];
      rgb = (c, a) => "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (a == null ? 1 : a) + ")";
      BIOMES2 = [
        { name: "the Ashen Waste", g: [120, 100, 74] },
        { name: "the Frostpan", g: [150, 165, 185] },
        { name: "the Rustlands", g: [150, 66, 44] },
        { name: "the Salt Flats", g: [185, 178, 160] },
        { name: "the Basalt Plain", g: [56, 56, 66] },
        { name: "the Verdant Remnant", g: [96, 112, 64] }
      ];
      biome2 = BIOMES2[0];
      syzygyLift = 0;
      demo = null;
      render2d = {
        init: init2,
        render,
        resize,
        reseedTerrain,
        titleDemo,
        addShake,
        flash,
        setBiome: setBiome2d
      };
    }
  });

  // src/render3d.ts
  var render2;
  var init_render3d = __esm({
    "src/render3d.ts"() {
      "use strict";
      init_util();
      init_physics();
      init_climate();
      init_render2d();
      render2 = (function build() {
        if (typeof THREE === "undefined") return render2d;
        const NX = (n) => (0.5 - n) * 260;
        let renderer, scene, camera, W2 = 0, H2 = 0;
        let fallback = false, booted = false;
        let skyMat, starPts, sunGroup = [], lights = [], hemi, ambient;
        let terrain, terrainMat, lake, lakeMat;
        let pyramidAncient, pyramidLate, antennaLight;
        let townMesh, skylineMesh, domesGroup, observatory, factoryGroup, smokePts;
        let coolingGroup, steamPts, mastGroup, pendulumGroup, bobMesh, gantryGroup, launchSprite;
        let furrows, searchlights = [];
        let snowPts, emberPts, rockMesh;
        let meteorSeg = null, m3 = [], m3Next = 12e3, m3Until = 0;
        let skinsMesh;
        let people = null;
        let trauma2 = 0, flashEl = null, flashA2 = 0, flashColor2 = "255,255,255";
        let viewYaw = 0, brightSm2 = 0, syzygyLift2 = 0, lastMs2 = 0;
        let crowd2 = [];
        const srng2 = makeRng(8888);
        const reduceMotion2 = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
        const BIOMES = [
          { name: "the Ashen Waste", g: [0.2, 0.17, 0.13], lake: 2247798 },
          { name: "the Frostpan", g: [0.4, 0.44, 0.5], lake: 2775682 },
          { name: "the Rustlands", g: [0.34, 0.15, 0.1], lake: 3033184 },
          { name: "the Salt Flats", g: [0.54, 0.52, 0.47], lake: 3828358 },
          { name: "the Basalt Plain", g: [0.12, 0.12, 0.15], lake: 2043448 },
          { name: "the Verdant Remnant", g: [0.22, 0.27, 0.15], lake: 2382410 }
        ];
        let biome = BIOMES[0];
        function setBiome3d(worldIndex) {
          biome = BIOMES[(worldIndex % BIOMES.length + BIOMES.length) % BIOMES.length];
          return biome.name;
        }
        let demo2 = null, demoScene = null, demoCam = null;
        function radialTexture(stops, size) {
          const cv = document.createElement("canvas");
          cv.width = cv.height = size || 128;
          const g = cv.getContext("2d");
          const grad = g.createRadialGradient(
            cv.width / 2,
            cv.height / 2,
            0,
            cv.width / 2,
            cv.height / 2,
            cv.width / 2
          );
          for (const [t, c] of stops) grad.addColorStop(t, c);
          g.fillStyle = grad;
          g.fillRect(0, 0, cv.width, cv.height);
          const tex = new THREE.CanvasTexture(cv);
          return tex;
        }
        function init3d(cv) {
          renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          renderer.outputEncoding = THREE.sRGBEncoding;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.05;
          scene = new THREE.Scene();
          scene.fog = new THREE.FogExp2(1053725, 13e-4);
          camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2600);
          camera.position.set(0, 6.5, -26);
          resize2();
          window.addEventListener("resize", resize2);
          buildSky();
          buildTerrain(11);
          buildSettlement();
          buildPeople();
          buildWeather();
          buildMeteors();
          buildOverlays();
          booted = true;
        }
        function resize2() {
          if (!renderer) return;
          W2 = window.innerWidth;
          H2 = window.innerHeight;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(W2, H2);
          camera.aspect = W2 / H2;
          camera.updateProjectionMatrix();
        }
        function buildSky() {
          const geo = new THREE.SphereGeometry(1200, 32, 18);
          skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
              zenith: { value: new THREE.Color(461332) },
              horizon: { value: new THREE.Color(1053727) }
            },
            vertexShader: "varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
            fragmentShader: "uniform vec3 zenith; uniform vec3 horizon; varying vec3 vPos;void main(){ float h = clamp(normalize(vPos).y, 0.0, 1.0);vec3 c = mix(horizon, zenith, pow(h, 0.55));gl_FragColor = vec4(c, 1.0); }"
          });
          scene.add(new THREE.Mesh(geo, skyMat));
          const n = 900, pos = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) {
            const az = srng2.range(0, Math.PI * 2), el2 = Math.asin(srng2.next()) * 0.98;
            pos[i * 3] = Math.cos(el2) * Math.sin(az) * 1100;
            pos[i * 3 + 1] = Math.sin(el2) * 1100 + 8;
            pos[i * 3 + 2] = Math.cos(el2) * Math.cos(az) * 1100;
          }
          const sg = new THREE.BufferGeometry();
          sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          starPts = new THREE.Points(sg, new THREE.PointsMaterial({
            color: 13623551,
            size: 2.4,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          }));
          scene.add(starPts);
          const discTex = radialTexture([
            [0, "rgba(255,255,255,1)"],
            [0.5, "rgba(255,244,214,1)"],
            [0.72, "rgba(255,214,150,0.9)"],
            [1, "rgba(255,190,110,0)"]
          ], 256);
          const glowTex = radialTexture([
            [0, "rgba(255,230,170,0.85)"],
            [0.35, "rgba(255,190,110,0.30)"],
            [1, "rgba(255,150,70,0)"]
          ], 256);
          for (let i = 0; i < 3; i++) {
            const disc = new THREE.Sprite(new THREE.SpriteMaterial({
              map: discTex,
              transparent: true,
              depthWrite: false,
              fog: false
            }));
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({
              map: glowTex,
              transparent: true,
              depthWrite: false,
              fog: false,
              blending: THREE.AdditiveBlending
            }));
            scene.add(disc);
            scene.add(glow);
            const light = new THREE.DirectionalLight(16773853, 0);
            scene.add(light);
            scene.add(light.target);
            sunGroup.push({ disc, glow, light });
          }
          const sl = sunGroup[0].light;
          sl.castShadow = true;
          sl.shadow.mapSize.set(1024, 1024);
          sl.shadow.camera.left = -180;
          sl.shadow.camera.right = 180;
          sl.shadow.camera.top = 200;
          sl.shadow.camera.bottom = -120;
          sl.shadow.camera.far = 2400;
          hemi = new THREE.HemisphereLight(2240580, 1709072, 0.35);
          scene.add(hemi);
          ambient = new THREE.AmbientLight(2107443, 0.25);
          scene.add(ambient);
        }
        function buildTerrain(seed) {
          if (terrain) {
            scene.remove(terrain);
            terrain.geometry.dispose();
          }
          const rng = makeRng(seed);
          const a1 = rng.range(4e-3, 7e-3), a2 = rng.range(0.01, 0.016), p1 = rng.range(0, 6), p2 = rng.range(0, 6), p3 = rng.range(0, 6);
          const geo = new THREE.PlaneGeometry(2400, 2400, 96, 96);
          geo.rotateX(-Math.PI / 2);
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            const d = Math.hypot(x, z);
            const basin = smoothstep(170, 420, d);
            let h = (Math.sin(x * a1 + p1) + Math.cos(z * a1 + p2)) * 6 + Math.sin(x * a2 + z * a2 * 0.7 + p3) * 3.2;
            h = h * basin + Math.pow(smoothstep(500, 1150, d), 1.6) * 150 * (0.7 + 0.3 * Math.sin(Math.atan2(z, x) * 5 + p1));
            pos.setY(i, h);
          }
          geo.computeVertexNormals();
          terrainMat = terrainMat || new THREE.MeshStandardMaterial({
            color: 4866358,
            roughness: 1,
            metalness: 0
          });
          terrain = new THREE.Mesh(geo, terrainMat);
          terrain.receiveShadow = true;
          scene.add(terrain);
        }
        const DARK = new THREE.MeshStandardMaterial({ color: 1316381, roughness: 0.95 });
        const DARK2 = new THREE.MeshStandardMaterial({ color: 1777190, roughness: 0.9 });
        function buildSettlement() {
          pyramidAncient = new THREE.Group();
          for (let i = 0; i < 5; i++) {
            const w = 56 * (1 - i * 0.17);
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, 9, w), DARK);
            b.position.set(0, 4.5 + i * 9, 0);
            b.castShadow = true;
            pyramidAncient.add(b);
          }
          pyramidAncient.position.set(NX(0.18), 0, 120);
          scene.add(pyramidAncient);
          pyramidLate = new THREE.Group();
          const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 34, 52, 4), DARK);
          cone.position.y = 26;
          cone.rotation.y = Math.PI / 4;
          cone.castShadow = true;
          pyramidLate.add(cone);
          const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 16), DARK2);
          spire.position.y = 58;
          pyramidLate.add(spire);
          antennaLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.9),
            new THREE.MeshBasicMaterial({ color: 16732240 })
          );
          antennaLight.position.y = 66.5;
          pyramidLate.add(antennaLight);
          pyramidLate.position.copy(pyramidAncient.position);
          scene.add(pyramidLate);
          const houseGeo = new THREE.BoxGeometry(1, 1, 1);
          houseGeo.translate(0, 0.5, 0);
          townMesh = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({
            color: 2303792,
            roughness: 0.9,
            emissive: 0
          }), 16);
          const r1 = makeRng(5151);
          const dummy = new THREE.Object3D();
          for (let i = 0; i < 16; i++) {
            dummy.position.set(
              NX(0.18) + 40 + i % 8 * 13 + r1.range(-3, 3),
              0,
              150 + Math.floor(i / 8) * 18 + r1.range(-4, 4)
            );
            dummy.scale.set(r1.range(7, 11), r1.range(5, 12), r1.range(7, 10));
            dummy.rotation.y = r1.range(-0.2, 0.2);
            dummy.updateMatrix();
            townMesh.setMatrixAt(i, dummy.matrix);
          }
          townMesh.castShadow = true;
          scene.add(townMesh);
          skylineMesh = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({
            color: 1910064,
            roughness: 0.7,
            emissive: 0
          }), 10);
          for (let i = 0; i < 10; i++) {
            dummy.position.set(-30 + i * 12 + r1.range(-3, 3), 0, 215 + r1.range(-8, 8));
            dummy.scale.set(r1.range(7, 10), r1.range(26, 64), r1.range(7, 10));
            dummy.rotation.y = 0;
            dummy.updateMatrix();
            skylineMesh.setMatrixAt(i, dummy.matrix);
          }
          scene.add(skylineMesh);
          domesGroup = new THREE.Group();
          for (let i = 0; i < 9; i++) {
            const r = 4.5 + i % 3;
            const dome = new THREE.Mesh(
              new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
              DARK2
            );
            dome.position.set(NX(0.7) + i * 9.5, 0, 110);
            dome.castShadow = true;
            domesGroup.add(dome);
          }
          scene.add(domesGroup);
          lakeMat = new THREE.MeshStandardMaterial({
            color: 2247798,
            roughness: 0.15,
            metalness: 0.35
          });
          lake = new THREE.Mesh(new THREE.CircleGeometry(23, 28), lakeMat);
          lake.rotation.x = -Math.PI / 2;
          lake.position.set(NX(0.86), 0.25, 120);
          scene.add(lake);
          observatory = new THREE.Group();
          const obase = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 5, 12), DARK);
          obase.position.y = 2.5;
          obase.castShadow = true;
          const odome = new THREE.Mesh(
            new THREE.SphereGeometry(6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            DARK2
          );
          odome.position.y = 5;
          observatory.add(obase, odome);
          observatory.position.set(NX(0.585), 0, 152);
          scene.add(observatory);
          factoryGroup = new THREE.Group();
          const fhall = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 12), DARK);
          fhall.position.y = 4;
          fhall.castShadow = true;
          factoryGroup.add(fhall);
          for (const sx of [-6, 5]) {
            const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 17, 8), DARK2);
            stack.position.set(sx, 12, 0);
            factoryGroup.add(stack);
          }
          factoryGroup.position.set(NX(0.475), 0, 140);
          scene.add(factoryGroup);
          coolingGroup = new THREE.Group();
          const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 18, 14), DARK2);
          tower.position.y = 9;
          tower.castShadow = true;
          coolingGroup.add(tower);
          coolingGroup.position.set(NX(0.51), 0, 152);
          scene.add(coolingGroup);
          mastGroup = new THREE.Group();
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 34, 6), DARK2);
          mast.position.y = 17;
          const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.8),
            new THREE.MeshBasicMaterial({ color: 16729670 })
          );
          beacon.position.y = 34.8;
          beacon.name = "beacon";
          mastGroup.add(mast, beacon);
          mastGroup.position.set(NX(0.545), 0, 158);
          scene.add(mastGroup);
          pendulumGroup = new THREE.Group();
          for (const sx of [-9, 9]) {
            const legM = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 30, 8), DARK);
            legM.position.set(sx * 0.55, 14, 0);
            legM.rotation.z = sx > 0 ? -0.31 : 0.31;
            legM.castShadow = true;
            pendulumGroup.add(legM);
          }
          bobMesh = new THREE.Mesh(
            new THREE.SphereGeometry(2.2, 14, 10),
            new THREE.MeshStandardMaterial({ color: 3752270, roughness: 0.3, metalness: 0.8 })
          );
          bobMesh.castShadow = true;
          pendulumGroup.add(bobMesh);
          pendulumGroup.position.set(NX(0.52), 0, 136);
          scene.add(pendulumGroup);
          gantryGroup = new THREE.Group();
          for (let i = 0; i < 3; i++) {
            const g = new THREE.Mesh(new THREE.BoxGeometry(1.6, 22, 1.6), DARK2);
            g.position.set(i * 9, 11, 0);
            g.castShadow = true;
            gantryGroup.add(g);
          }
          gantryGroup.position.set(NX(0.07), 0, 100);
          scene.add(gantryGroup);
          launchSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: radialTexture([[0, "rgba(255,235,180,1)"], [1, "rgba(255,150,60,0)"]], 64),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          }));
          launchSprite.scale.set(6, 6, 1);
          scene.add(launchSprite);
          for (let i = 0; i < 2; i++) {
            const coneM = new THREE.Mesh(
              new THREE.ConeGeometry(9, 120, 12, 1, true),
              new THREE.MeshBasicMaterial({
                color: 12375807,
                transparent: true,
                opacity: 0.05,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
              })
            );
            coneM.position.set(NX(0.07) + i * 14, 60, 100);
            scene.add(coneM);
            searchlights.push(coneM);
          }
          furrows = new THREE.Group();
          const fm = new THREE.MeshStandardMaterial({ color: 2892312, roughness: 1 });
          for (let i = 0; i < 6; i++) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 46), fm);
            strip.position.set(NX(0.31) + i * 6.5, 0.15, 82);
            furrows.add(strip);
          }
          scene.add(furrows);
          const skinGeo = new THREE.CapsuleGeometry() ? new THREE.CapsuleGeometry(0.5, 1.6, 3, 6) : new THREE.CylinderGeometry(0.5, 0.5, 2.2, 6);
          skinGeo.rotateZ(Math.PI / 2);
          skinsMesh = new THREE.InstancedMesh(skinGeo, new THREE.MeshStandardMaterial({
            color: 12892318,
            roughness: 0.9
          }), 48);
          const r2 = makeRng(7711);
          for (let i = 0; i < 48; i++) {
            dummy.position.set(
              NX(0.695) + i % 14 * 2.1 + r2.range(-0.5, 0.5),
              0.5 + Math.floor(i / 14) * 1.05,
              104 + Math.floor(i / 14) * 1.4
            );
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0, r2.range(-0.2, 0.2), 0);
            dummy.updateMatrix();
            skinsMesh.setMatrixAt(i, dummy.matrix);
          }
          scene.add(skinsMesh);
        }
        const N_PEOPLE = 84;
        function buildPeople() {
          const SKINS = [15251594, 14262379, 13208149, 11696197, 9263924];
          const CLOTH_OLD = [8210994, 5989488, 8022588, 8667708, 5200453, 7033664];
          const CLOTH_NEW = [3029838, 5518111, 3951162, 6106933, 2568511, 7239297];
          const ROLES = [
            "farmer",
            "farmer",
            "farmer",
            "carrier",
            "carrier",
            "mason",
            "mason",
            "keeper",
            "townsman",
            "townsman",
            "watcher"
          ];
          crowd2 = [];
          for (let i = 0; i < N_PEOPLE; i++) {
            crowd2.push({
              x: srng2.range(0.3, 0.66),
              row: i % 4,
              phase: srng2.range(0, Math.PI * 2),
              drift: srng2.range(0.7, 1.3),
              build: srng2.range(0.85, 1.15),
              skin: SKINS[srng2.int(0, SKINS.length - 1)],
              clothOld: CLOTH_OLD[srng2.int(0, CLOTH_OLD.length - 1)],
              clothNew: CLOTH_NEW[srng2.int(0, CLOTH_NEW.length - 1)],
              hat: srng2.next() < 0.4,
              role: ROLES[i % ROLES.length],
              tx: srng2.range(0.32, 0.62),
              dwellMs: srng2.range(0, 2500),
              leg: srng2.next() > 0.5 ? 1 : 0,
              dir: 1
            });
          }
          const mat = (c2) => new THREE.MeshStandardMaterial({ color: c2, roughness: 0.85 });
          const mk = (geo, m) => {
            const im = new THREE.InstancedMesh(geo, m, N_PEOPLE);
            im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            im.castShadow = true;
            scene.add(im);
            return im;
          };
          const headGeo = new THREE.SphereGeometry(0.3, 10, 8);
          const torsoGeo = new THREE.BoxGeometry(0.62, 1.12, 0.34);
          const legGeo = new THREE.BoxGeometry(0.2, 0.95, 0.2);
          legGeo.translate(0, -0.475, 0);
          const armGeo = new THREE.BoxGeometry(0.15, 0.85, 0.15);
          armGeo.translate(0, -0.425, 0);
          const hatGeo = new THREE.ConeGeometry(0.55, 0.35, 10);
          people = {
            head: mk(headGeo, mat(15251594)),
            torso: mk(torsoGeo, mat(8210994)),
            legL: mk(legGeo, mat(2761756)),
            legR: mk(legGeo, mat(2761756)),
            armL: mk(armGeo, mat(7033664)),
            armR: mk(armGeo, mat(7033664)),
            hat: mk(hatGeo, mat(10124355)),
            dummy: new THREE.Object3D(),
            clothEra: -1
          };
          const c = new THREE.Color();
          for (let i = 0; i < N_PEOPLE; i++) {
            people.head.setColorAt(i, c.setHex(crowd2[i].skin));
            people.torso.setColorAt(i, c.setHex(crowd2[i].clothOld));
            people.armL.setColorAt(i, c.setHex(crowd2[i].clothOld));
            people.armR.setColorAt(i, c.setHex(crowd2[i].clothOld));
          }
        }
        function setPart(part, i, x, y, z, rx, ry, rz, s) {
          const d = people.dummy;
          d.position.set(x, y, z);
          d.rotation.set(rx || 0, ry || 0, rz || 0);
          d.scale.setScalar(s);
          d.updateMatrix();
          part.setMatrixAt(i, d.matrix);
        }
        const FAR_AWAY = new THREE.Matrix4().makeTranslation(0, -500, 0);
        function updatePeople(state, nowMs, dtMs) {
          const civ = state.civ;
          const age = civ.ageIdx;
          const domeX = 0.715;
          const visible = civ.dormant ? 0 : Math.round(clamp(Math.sqrt(Math.max(civ.popH, 0)) * 8.5, 0, N_PEOPLE));
          const WALK = 52e-6;
          const eraKey = age >= 9 ? 1 : 0;
          if (people.clothEra !== eraKey) {
            people.clothEra = eraKey;
            const c = new THREE.Color();
            for (let i = 0; i < N_PEOPLE; i++) {
              const hex = eraKey ? crowd2[i].clothNew : crowd2[i].clothOld;
              people.torso.setColorAt(i, c.setHex(hex));
              people.armL.setColorAt(i, c.setHex(hex));
              people.armR.setColorAt(i, c.setHex(hex));
            }
            people.torso.instanceColor.needsUpdate = true;
            people.armL.instanceColor.needsUpdate = true;
            people.armR.instanceColor.needsUpdate = true;
          }
          for (let i = 0; i < N_PEOPLE; i++) {
            if (i >= visible) {
              for (const k of ["head", "torso", "legL", "legR", "armL", "armR", "hat"])
                people[k].setMatrixAt(i, FAR_AWAY);
              continue;
            }
            const p = crowd2[i];
            let walking = false, action = null;
            if (civ.order === "dehydrate") {
              walking = Math.abs(domeX - p.x) > 5e-3;
              if (walking) p.x += Math.sign(domeX - p.x) * WALK * 1.5 * p.drift * dtMs;
            } else if (civ.order === "rehydrate") {
              walking = true;
              if (p.x > 0.8) p.x -= WALK * p.drift * dtMs;
              else if (Math.abs(0.46 - p.x) > 0.01) p.x += Math.sign(0.46 - p.x) * WALK * p.drift * dtMs;
              else walking = false;
            } else if (p.dwellMs > 0) {
              p.dwellMs -= dtMs;
              if (p.role === "farmer" && age >= 2) action = "bend";
              else if (p.role === "mason") action = "hammer";
            } else if (Math.abs(p.tx - p.x) > 5e-3) {
              walking = true;
              p.x += Math.sign(p.tx - p.x) * WALK * p.drift * dtMs;
            } else {
              p.leg = 1 - p.leg;
              const j = (i * 31 + Math.floor(p.phase * 100)) % 7;
              switch (p.role) {
                case "farmer":
                  p.tx = 0.31 + j * 0.022;
                  p.dwellMs = 2600 + j * 600;
                  break;
                case "carrier":
                  p.tx = p.leg ? 0.795 : 0.45 + j * 0.01;
                  p.dwellMs = p.leg ? 700 : 1700;
                  break;
                case "mason":
                  p.tx = p.leg ? 0.235 + j * 8e-3 : 0.42 + j * 0.012;
                  p.dwellMs = p.leg ? 3400 : 900;
                  break;
                case "keeper":
                  p.tx = 0.695 + j * 0.013;
                  p.dwellMs = 1500 + j * 400;
                  break;
                case "watcher":
                  p.tx = (age >= 5 ? 0.565 : 0.52) + j * 8e-3;
                  p.dwellMs = 4200 + j * 800;
                  break;
                default:
                  p.tx = p.leg ? 0.345 + j * 0.01 : 0.48 + j * 0.014;
                  p.dwellMs = 1100 + j * 500;
              }
            }
            if (walking) p.dir = Math.sign((civ.order === "dehydrate" ? domeX : p.tx) - p.x) || p.dir;
            p.phase += (walking ? 95e-4 : 22e-4) * dtMs * p.drift;
            const sc = p.build * (1.05 + p.row * 0.05);
            const wx = NX(p.x);
            const wz = 48 + p.row * 10;
            const lift = syzygyLift2 * (5 + p.row * 1.5 + Math.sin(p.phase * 0.7 + i) * 2);
            const y0 = lift;
            const swing = walking ? Math.sin(p.phase) : 0;
            const bend = action === "bend" ? 0.42 + Math.sin(p.phase * 2.2) * 0.12 : 0;
            const yaw = walking ? p.dir > 0 ? Math.PI / 2 : -Math.PI / 2 : Math.PI;
            const lifted = syzygyLift2 > 0.05;
            setPart(
              people.legL,
              i,
              wx - 0.12 * sc,
              y0 + 0.95 * sc,
              wz,
              lifted ? 0.5 : swing * 0.55,
              yaw,
              0,
              sc
            );
            setPart(
              people.legR,
              i,
              wx + 0.12 * sc,
              y0 + 0.95 * sc,
              wz,
              lifted ? 0.2 : -swing * 0.55,
              yaw,
              0,
              sc
            );
            setPart(
              people.torso,
              i,
              wx,
              y0 + (1.42 - bend * 0.18) * sc,
              wz,
              bend + (lifted ? Math.sin(p.phase * 0.6) * 0.4 : 0),
              yaw,
              0,
              sc
            );
            setPart(
              people.armL,
              i,
              wx - 0.38 * sc,
              y0 + 1.86 * sc,
              wz,
              lifted ? -2.4 : action === "hammer" ? -1.1 - Math.abs(Math.sin(p.phase * 3)) * 1.1 : -swing * 0.5 + bend * 1.6,
              yaw,
              lifted ? 0.4 : 0.08,
              sc
            );
            setPart(
              people.armR,
              i,
              wx + 0.38 * sc,
              y0 + 1.86 * sc,
              wz,
              lifted ? -2.2 : swing * 0.5 + bend * 1.6,
              yaw,
              lifted ? -0.4 : -0.08,
              sc
            );
            const headBendZ = bend * 0.3 * sc;
            setPart(people.head, i, wx, y0 + (2.22 - bend * 0.3) * sc, wz + headBendZ, bend, yaw, 0, sc);
            if (p.hat && age <= 6) {
              setPart(people.hat, i, wx, y0 + (2.48 - bend * 0.32) * sc, wz + headBendZ, bend, yaw, 0, sc);
            } else {
              people.hat.setMatrixAt(i, FAR_AWAY);
            }
          }
          for (const k of ["head", "torso", "legL", "legR", "armL", "armR", "hat"])
            people[k].instanceMatrix.needsUpdate = true;
        }
        function makeCloud(n, color, size, blending) {
          const pos = new Float32Array(n * 3);
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          const pts = new THREE.Points(g, new THREE.PointsMaterial({
            color,
            size,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: blending || THREE.NormalBlending
          }));
          pts.frustumCulled = false;
          scene.add(pts);
          return pts;
        }
        function buildWeather() {
          snowPts = makeCloud(1100, 15134460, 1.5);
          const sp = snowPts.geometry.attributes.position.array;
          for (let i = 0; i < sp.length; i += 3) {
            sp[i] = srng2.range(-220, 220);
            sp[i + 1] = srng2.range(0, 120);
            sp[i + 2] = srng2.range(-60, 260);
          }
          emberPts = makeCloud(420, 16751164, 2.2, THREE.AdditiveBlending);
          const ep = emberPts.geometry.attributes.position.array;
          for (let i = 0; i < ep.length; i += 3) {
            ep[i] = srng2.range(-220, 220);
            ep[i + 1] = srng2.range(0, 90);
            ep[i + 2] = srng2.range(-60, 260);
          }
          smokePts = makeCloud(60, 9080214, 4);
          steamPts = makeCloud(40, 12765394, 5);
          rockMesh = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.5),
            new THREE.MeshStandardMaterial({ color: 3814703, roughness: 1 }),
            70
          );
          rockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          scene.add(rockMesh);
        }
        const MET_N = 26;
        function buildMeteors() {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MET_N * 2 * 3), 3));
          meteorSeg = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
            color: 15397631,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          }));
          meteorSeg.frustumCulled = false;
          for (let i = 0; i < MET_N; i++) m3.push({ active: false, x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, len: 10 });
          scene.add(meteorSeg);
        }
        function updateMeteors3d(nowMs, dark, chaos) {
          if (!meteorSeg) return;
          meteorSeg.material.opacity += ((dark ? 0.85 : 0) - meteorSeg.material.opacity) * 0.08;
          if (nowMs > m3Next) {
            m3Next = nowMs + (chaos ? 26e3 : 52e3) + Math.random() * 45e3;
            m3Until = nowMs + 3e3 + Math.random() * 3500;
          }
          if (dark && nowMs < m3Until && Math.random() < 0.5) {
            const m = m3.find((x) => !x.active);
            if (m) {
              m.active = true;
              m.life = 1;
              m.len = 9 + Math.random() * 9;
              m.x = -420 + Math.random() * 840;
              m.y = 280 + Math.random() * 260;
              m.z = 360 + Math.random() * 420;
              const dir = m.x < 0 ? 1 : -1;
              m.vx = dir * (7 + Math.random() * 7);
              m.vy = -(2 + Math.random() * 3);
              m.vz = (Math.random() - 0.5) * 3;
            }
          }
          const pos = meteorSeg.geometry.attributes.position;
          for (let i = 0; i < m3.length; i++) {
            const m = m3[i];
            if (m.active) {
              m.x += m.vx;
              m.y += m.vy;
              m.z += m.vz;
              m.life -= 0.02;
              const tail = m.len * (0.4 + m.life * 0.6);
              if (m.life <= 0 || m.y < 130) m.active = false;
              pos.setXYZ(i * 2, m.x, m.y, m.z);
              pos.setXYZ(i * 2 + 1, m.x - m.vx * tail, m.y - m.vy * tail, m.z - m.vz * tail);
            } else {
              pos.setXYZ(i * 2, 0, -9999, 0);
              pos.setXYZ(i * 2 + 1, 0, -9999, 0);
            }
          }
          pos.needsUpdate = true;
        }
        function updateWeather(T, obs, nowMs, dtMs) {
          const wantSnow = T < -22;
          snowPts.material.opacity += ((wantSnow ? 0.85 : 0) - snowPts.material.opacity) * 0.03;
          if (snowPts.material.opacity > 0.02) {
            const a = snowPts.geometry.attributes.position;
            for (let i = 0; i < a.count; i++) {
              let y = a.getY(i) - 0.018 * dtMs;
              if (y < 0) y = 120;
              a.setY(i, y);
              a.setX(i, a.getX(i) + Math.sin(nowMs / 800 + i) * 0.02);
            }
            a.needsUpdate = true;
          }
          const wantEmber = T > 75;
          emberPts.material.opacity += ((wantEmber ? 0.8 : 0) - emberPts.material.opacity) * 0.03;
          if (emberPts.material.opacity > 0.02) {
            const a = emberPts.geometry.attributes.position;
            for (let i = 0; i < a.count; i++) {
              let y = a.getY(i) + 0.02 * dtMs;
              if (y > 90) y = 0;
              a.setY(i, y);
            }
            a.needsUpdate = true;
          }
          if (syzygyLift2 > 0.03) {
            const d = people.dummy;
            for (let i = 0; i < 70; i++) {
              const t = (nowMs / 2600 + i / 70) % 1;
              d.position.set(
                -150 + i * 53 % 300,
                t * 55 * syzygyLift2,
                50 + i * 37 % 200
              );
              d.rotation.set(t * 6, i, t * 4);
              d.scale.setScalar(0.6 + i % 5 * 0.3);
              d.updateMatrix();
              rockMesh.setMatrixAt(i, d.matrix);
            }
            rockMesh.visible = true;
            rockMesh.instanceMatrix.needsUpdate = true;
          } else rockMesh.visible = false;
        }
        function buildOverlays() {
          let vg = document.getElementById("vignette3d");
          if (!vg) {
            vg = document.createElement("div");
            vg.id = "vignette3d";
            vg.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:5;background:radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%)";
            document.body.appendChild(vg);
          }
          flashEl = document.getElementById("flash3d");
          if (!flashEl) {
            flashEl = document.createElement("div");
            flashEl.id = "flash3d";
            flashEl.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0";
            document.body.appendChild(flashEl);
          }
        }
        const _zen = new THREE.Color(), _hor = new THREE.Color(), _tmp = new THREE.Color();
        function render3d(state, nowMs) {
          const dtMs = clamp(nowMs - (lastMs2 || nowMs), 0, 100);
          lastMs2 = nowMs;
          const dt = dtMs / 1e3;
          const obs = observe(state.sys);
          const cl = state.cl, T = cl.tempC, civ = state.civ, age = civ.ageIdx;
          let fluxVis = 0, brightest = obs.suns[0];
          for (const o of obs.suns) {
            fluxVis += o.flux;
            if (o.flux > brightest.flux) brightest = o;
          }
          brightSm2 += (clamp(Math.pow(fluxVis / 1.2, 0.5), 0, 1) - brightSm2) * relax(dt, 0.25);
          const bright = brightSm2;
          const heat = clamp((T + 60) / 160, 0, 1);
          _zen.setRGB(
            lerp(0.024, lerp(0.1, 0.47, heat), bright),
            lerp(0.031, lerp(0.24, 0.35, heat), bright),
            lerp(0.071, lerp(0.55, 0.35, heat), bright)
          );
          _hor.setRGB(
            lerp(0.063, lerp(0.59, 1, heat), bright),
            lerp(0.071, lerp(0.67, 0.66, heat), bright),
            lerp(0.13, lerp(0.82, 0.35, heat), bright)
          );
          skyMat.uniforms.zenith.value.copy(_zen);
          skyMat.uniforms.horizon.value.copy(_hor);
          scene.fog.color.copy(_hor).multiplyScalar(0.65);
          scene.fog.density = 1e-3 + (1 - bright) * 4e-4;
          starPts.material.opacity = clamp(0.9 - bright * 1.7, 0, 0.9) * (0.75 + 0.25 * Math.sin(nowMs / 900));
          hemi.color.copy(_zen).multiplyScalar(2.2);
          hemi.groundColor.setRGB(0.16, 0.12, 0.09);
          hemi.intensity = 0.25 + bright * 0.45;
          ambient.intensity = 0.16 + bright * 0.2;
          viewYaw += wrap2(brightest.dir - viewYaw) * 0.02;
          const sorted = [...obs.suns].sort((a, b) => b.flux - a.flux);
          for (let k = 0; k < 3; k++) {
            const o = sorted[k], su = sunGroup[k];
            const az = wrap2(o.dir - viewYaw);
            const el2 = 0.16 + 0.17 * Math.sin(o.dir * 2);
            const R = 1050;
            const x = Math.cos(el2) * Math.sin(az) * R;
            const y = Math.sin(el2) * R;
            const z = Math.cos(el2) * Math.cos(az) * R;
            su.disc.position.set(x, y, z);
            su.glow.position.set(x, y, z);
            const isDisc = o.d < consts.DISC_DIST;
            const closeness = clamp(1 - o.d / consts.DISC_DIST, 0, 1);
            const scale = isDisc ? clamp(o.angSize * 2200, 14, 700) * 1.9 : clamp(9 / o.d, 2.5, 8);
            su.disc.scale.set(scale, scale, 1);
            su.glow.scale.set(scale * 3.2, scale * 3.2, 1);
            _tmp.setRGB(
              1,
              lerp(0.96, 0.45, Math.pow(closeness, 1.6)),
              lerp(0.84, 0.22, Math.pow(closeness, 1.3))
            );
            su.disc.material.color.copy(_tmp);
            su.glow.material.color.copy(_tmp);
            su.glow.material.opacity = isDisc ? 0.9 : 0.45;
            su.light.position.set(x, y, z);
            su.light.target.position.set(0, 0, 110);
            su.light.color.copy(_tmp);
            su.light.intensity = clamp(o.flux * 0.9, 0, 2.2);
          }
          const bg = biome.g;
          if (T < -15) {
            const f = clamp((-T - 15) / 80, 0, 1);
            terrainMat.color.setRGB(lerp(bg[0], 0.72, f), lerp(bg[1], 0.76, f), lerp(bg[2], 0.84, f));
          } else {
            const hf = clamp((T - 45) / 250, 0, 1);
            terrainMat.color.setRGB(bg[0] + hf * 0.32, bg[1] - hf * 0.04, bg[2] - hf * 0.05);
          }
          lakeMat.color.setHex(T < -2 ? 13163756 : T > 70 ? 7025700 : biome.lake);
          lakeMat.roughness = T < -2 ? 0.7 : 0.15;
          pyramidAncient.visible = age < 4;
          pyramidLate.visible = age >= 4;
          antennaLight.visible = age >= 8 && Math.sin(nowMs / 500) > 0;
          townMesh.count = age >= 3 ? clamp(Math.floor((civ.tech - 190) / 110) + 2, 2, 16) : 0;
          skylineMesh.count = age >= 10 ? clamp(Math.floor((civ.tech - 8110) / 450) + 1, 1, 10) : 0;
          const dark = bright < 0.38;
          townMesh.material.emissive.setHex(dark && age >= 9 ? 4864532 : 0);
          skylineMesh.material.emissive.setHex(dark ? 5587480 : 0);
          observatory.visible = age >= 5;
          factoryGroup.visible = age >= 8;
          coolingGroup.visible = age >= 10;
          mastGroup.visible = age >= 10;
          mastGroup.getObjectByName("beacon").visible = Math.sin(nowMs / 480) > 0;
          pendulumGroup.visible = state.flags.einstein && age >= 10;
          if (pendulumGroup.visible) {
            const ang = Math.sin(nowMs / 1400) * 0.55;
            bobMesh.position.set(Math.sin(ang) * 16, 28 - Math.cos(ang) * 16 * 0.9, 0);
          }
          gantryGroup.visible = age >= 12 || civ.fleet.ships > 0;
          furrows.visible = age >= 2;
          const rolls = Math.round(clamp(Math.sqrt(Math.max(civ.popD, 0)) * 5.5, 0, 48));
          skinsMesh.count = rolls;
          if (civ.fleet.building) {
            const t = nowMs % 2600 / 2600;
            launchSprite.visible = true;
            launchSprite.position.set(NX(0.07) + 9, 4 + t * 130, 100);
            launchSprite.material.opacity = 1 - t;
          } else launchSprite.visible = false;
          for (let i = 0; i < searchlights.length; i++) {
            const s = searchlights[i];
            s.visible = age >= 12 && dark;
            if (s.visible) s.rotation.z = Math.sin(nowMs / (3100 + i * 900) + i * 2) * 0.5;
          }
          updatePlume(smokePts, factoryGroup.visible, factoryGroup.position, 17, nowMs);
          updatePlume(steamPts, coolingGroup.visible, coolingGroup.position, 19, nowMs);
          const liftTarget = obs.alignSpread < 0.12 ? 1 : 0;
          syzygyLift2 += (liftTarget - syzygyLift2) * 0.04;
          if (syzygyLift2 < 0.01) syzygyLift2 = 0;
          updatePeople(state, nowMs, dtMs);
          updateWeather(T, obs, nowMs, dtMs);
          updateMeteors3d(nowMs, bright < 0.42, cl.eraType === "chaotic");
          trauma2 = Math.max(0, trauma2 - dt * 1.1);
          const s2 = trauma2 * trauma2;
          camera.position.set(
            Math.sin(nowMs / 9e3) * 1.4 + s2 * 2.4 * Math.sin(nowMs * 0.061),
            6.5 + Math.sin(nowMs / 7e3) * 0.4 + s2 * 2 * Math.cos(nowMs * 0.053),
            -26
          );
          camera.lookAt(
            Math.sin(nowMs / 13e3) * 9,
            18 + s2 * 1.5 * Math.sin(nowMs * 0.045),
            110
          );
          renderer.toneMappingExposure = 1.05 + bright * 0.18 - (1 - bright) * 0.12;
          if (flashEl) {
            if (flashA2 > 5e-3) {
              flashEl.style.background = "rgb(" + flashColor2 + ")";
              flashEl.style.opacity = flashA2.toFixed(3);
              flashA2 *= Math.exp(-dt / 0.16);
            } else flashEl.style.opacity = "0";
          }
          renderer.render(scene, camera);
        }
        function updatePlume(pts, on, basePos, topY, nowMs) {
          pts.material.opacity += ((on ? 0.45 : 0) - pts.material.opacity) * 0.04;
          if (pts.material.opacity < 0.02) return;
          const a = pts.geometry.attributes.position;
          for (let i = 0; i < a.count; i++) {
            const t = (nowMs / 5200 + i / a.count) % 1;
            a.setXYZ(
              i,
              basePos.x + Math.sin(t * 5 + i) * 4 * t + (i % 2 ? 5 : -6),
              topY + t * 36,
              basePos.z + Math.cos(t * 3 + i) * 3 * t
            );
          }
          a.needsUpdate = true;
        }
        function wrap2(a) {
          while (a > Math.PI) a -= 2 * Math.PI;
          while (a <= -Math.PI) a += 2 * Math.PI;
          return a;
        }
        function titleDemo3d(nowMs) {
          if (!demo2) {
            const rng = makeRng(2049);
            demoScene = new THREE.Scene();
            demoCam = new THREE.PerspectiveCamera(50, W2 / H2, 0.1, 4e3);
            const cols = [16766814, 16752228, 8309759];
            const glowTex = radialTexture([
              [0, "rgba(255,255,255,1)"],
              [0.3, "rgba(255,230,170,0.6)"],
              [1, "rgba(255,190,110,0)"]
            ], 128);
            demo2 = { sys: createSystem(rng), suns: [], trails: [], pTrail: null, n: 0 };
            for (let i = 0; i < 3; i++) {
              const sp = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTex,
                color: cols[i],
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
              }));
              sp.scale.set(26, 26, 1);
              demoScene.add(sp);
              demo2.suns.push(sp);
              const tg = new THREE.BufferGeometry();
              tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2400 * 3), 3));
              const line = new THREE.Line(tg, new THREE.LineBasicMaterial({
                color: cols[i],
                transparent: true,
                opacity: 0.35
              }));
              line.frustumCulled = false;
              demoScene.add(line);
              demo2.trails.push({ line, n: 0 });
            }
            const pg = new THREE.BufferGeometry();
            pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2400 * 3), 3));
            demo2.pTrail = { line: new THREE.Line(pg, new THREE.LineBasicMaterial({
              color: 15266047,
              transparent: true,
              opacity: 0.5
            })), n: 0 };
            demo2.pTrail.line.frustumCulled = false;
            demoScene.add(demo2.pTrail.line);
            const n = 700, pos = new Float32Array(n * 3);
            const r2 = makeRng(31);
            for (let i = 0; i < n; i++) {
              pos[i * 3] = r2.range(-900, 900);
              pos[i * 3 + 1] = r2.range(-500, 500);
              pos[i * 3 + 2] = r2.range(-900, -200);
            }
            const sg = new THREE.BufferGeometry();
            sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
            demoScene.add(new THREE.Points(sg, new THREE.PointsMaterial({
              color: 12175592,
              size: 1.6,
              sizeAttenuation: false,
              transparent: true,
              opacity: 0.7
            })));
          }
          advance(demo2.sys, 4e-3);
          const SC = 26;
          const pushPt = (tr, x, y) => {
            const a = tr.line.geometry.attributes.position;
            if (tr.n < 2400) {
              a.setXYZ(tr.n, x, y, 0);
              tr.n++;
            } else {
              a.array.copyWithin(0, 3);
              a.setXYZ(2399, x, y, 0);
            }
            tr.line.geometry.setDrawRange(0, tr.n);
            a.needsUpdate = true;
          };
          for (let i = 0; i < 3; i++) {
            const s = demo2.sys.suns[i];
            demo2.suns[i].position.set(s.x * SC, s.y * SC, 0);
            pushPt(demo2.trails[i], s.x * SC, s.y * SC);
          }
          pushPt(demo2.pTrail, demo2.sys.planet.x * SC, demo2.sys.planet.y * SC);
          demoCam.aspect = W2 / H2;
          demoCam.updateProjectionMatrix();
          const t = nowMs / 26e3;
          demoCam.position.set(Math.sin(t) * 240, 90 + Math.sin(nowMs / 9e3) * 30, Math.cos(t) * 240);
          demoCam.lookAt(0, 0, 0);
          renderer.render(demoScene, demoCam);
        }
        function fall2d(err) {
          console.warn("3D renderer unavailable — switching to the 2D renderer.", err);
          fallback = true;
          try {
            const old = document.getElementById("world");
            const cv = document.createElement("canvas");
            cv.id = "world";
            old.parentNode.replaceChild(cv, old);
            const vg = document.getElementById("vignette3d");
            if (vg) vg.style.display = "none";
            render2d.init(cv);
          } catch (e2) {
            console.error(e2);
          }
        }
        return {
          init(cv) {
            try {
              init3d(cv);
            } catch (e) {
              fall2d(e);
            }
          },
          render(state, nowMs) {
            if (fallback) return render2d.render(state, nowMs);
            try {
              render3d(state, nowMs);
            } catch (e) {
              fall2d(e);
            }
          },
          resize() {
            fallback ? render2d.resize() : resize2();
          },
          reseedTerrain(k) {
            if (fallback) render2d.reseedTerrain(k);
            else buildTerrain(11 + k * 71);
          },
          setBiome(worldIndex) {
            const name = setBiome3d(worldIndex);
            if (fallback && render2d.setBiome) render2d.setBiome(worldIndex);
            return name;
          },
          titleDemo(nowMs) {
            if (fallback) return render2d.titleDemo(nowMs);
            try {
              titleDemo3d(nowMs);
            } catch (e) {
              fall2d(e);
            }
          },
          addShake(a) {
            if (fallback) return render2d.addShake(a);
            trauma2 = Math.min(1, trauma2 + a * (reduceMotion2 ? 0.25 : 1));
          },
          flash(c, a) {
            if (fallback) return render2d.flash(c, a);
            flashColor2 = c;
            flashA2 = Math.max(flashA2, a * (reduceMotion2 ? 0.4 : 1));
          }
        };
      })();
    }
  });

  // src/renderer.ts
  var init_renderer = __esm({
    "src/renderer.ts"() {
      "use strict";
      init_render3d();
    }
  });

  // src/ui.ts
  function init3() {
    el = {
      hudCiv: $("hud-civ"),
      hudEra: $("hud-era"),
      hudDate: $("hud-date"),
      hudTemp: $("hud-temp"),
      hudPop: $("hud-pop"),
      hudAge: $("hud-age"),
      hudTrust: $("hud-trust"),
      hudWorlds: $("hud-worlds"),
      hudScore: $("hud-score"),
      hudWater: $("hud-water"),
      hudGrain: $("hud-grain"),
      advisory: $("advisory"),
      objectives: $("objectives"),
      banner: $("banner"),
      log: $("log"),
      procStatus: $("proc-status"),
      overlay: $("overlay"),
      panel: $("panel"),
      panelBody: $("panel-body"),
      panelControls: $("panel-controls"),
      fleetbar: $("fleetbar"),
      btnDe: $("btn-dehydrate"),
      btnRe: $("btn-rehydrate"),
      btnHold: $("btn-hold"),
      btnProc: $("btn-proclaim"),
      btnObs: $("btn-observatory"),
      btnOrbit: $("btn-orbit"),
      btnComp: $("btn-computer"),
      btnAuto: $("btn-auto"),
      btnFleet: $("btn-fleet"),
      btnHelp: $("btn-help"),
      btnSound: $("btn-sound"),
      btnCodex: $("btn-codex"),
      btnDoctrine: $("btn-doctrine"),
      tabObs: $("tab-obs"),
      tabOrbit: $("tab-orbit"),
      tabComp: $("tab-comp"),
      tabCodex: $("tab-codex"),
      codex: $("codex"),
      coach: $("coach")
    };
    pcv = $("panel-canvas");
    pctx = pcv.getContext("2d");
    el.btnDe.onclick = () => cmdDehydrate(app.state, orderFrac);
    el.btnRe.onclick = () => cmdRehydrate(app.state, orderFrac);
    el.btnHold.onclick = () => cmdHoldOrder(app.state);
    document.querySelectorAll("#frac-group .frac").forEach((b) => {
      b.onclick = () => {
        orderFrac = parseFloat(b.dataset.f);
        document.querySelectorAll("#frac-group .frac").forEach((x) => x.classList.toggle("active", x === b));
      };
    });
    el.btnProc.onclick = () => openProclaim();
    el.btnObs.onclick = () => togglePanel("obs");
    el.btnOrbit.onclick = () => {
      if (app.state.flags.orbit) togglePanel("orbit");
    };
    el.btnComp.onclick = () => {
      if (app.state.flags.computer) togglePanel("comp");
    };
    el.btnCodex.onclick = () => togglePanel("codex");
    el.btnDoctrine.onclick = () => openDoctrines();
    el.btnAuto.onclick = () => cmdToggleAuto(app.state);
    el.btnFleet.onclick = () => cmdFleet(app.state);
    el.btnHelp.onclick = () => openHelp();
    el.btnSound.onclick = () => {
      setMuted(!isMuted());
      el.btnSound.textContent = isMuted() ? "♪ off" : "♪ on";
      try {
        localStorage.setItem("threebody.muted", isMuted() ? "1" : "");
      } catch (e) {
      }
    };
    el.tabObs.onclick = () => setTab("obs");
    el.tabOrbit.onclick = () => setTab("orbit");
    el.tabComp.onclick = () => setTab("comp");
    if (el.tabCodex) el.tabCodex.onclick = () => setTab("codex");
    $("panel-close").onclick = () => togglePanel(panelTab, true);
    if (el.coach) el.coach.onclick = () => hideCoach();
    for (let i = 0; i <= 4; i++) {
      const b = $("spd-" + i);
      if (b) b.onclick = () => app.setSpeed(i);
    }
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (overlayOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          const btn = el.overlay.querySelector("button.primary");
          if (btn) {
            btn.click();
            e.preventDefault();
          }
        }
        return;
      }
      const st = app.state;
      if (!st) return;
      switch (e.key.toLowerCase()) {
        case " ":
          app.setSpeed(app.speedIdx === 0 ? app.lastSpeedIdx || 1 : 0);
          e.preventDefault();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
          app.setSpeed(+e.key);
          break;
        case "d":
          cmdDehydrate(st, orderFrac);
          break;
        case "r":
          cmdRehydrate(st, orderFrac);
          break;
        case "x":
          cmdHoldOrder(st);
          break;
        case "p":
          openProclaim();
          break;
        case "o":
          togglePanel("obs");
          break;
        case "m":
          if (st.flags.orbit) togglePanel("orbit");
          break;
        case "c":
          if (st.flags.computer) togglePanel("comp");
          break;
        case "l":
          togglePanel("codex");
          break;
        case "v":
          openDoctrines();
          break;
        case "a":
          cmdToggleAuto(st);
          break;
        case "h":
          openHelp();
          break;
      }
    });
    el.overlay.addEventListener("click", (e) => {
      if (e.target === el.overlay) {
        const btn = el.overlay.querySelector("button.primary");
        if (btn) btn.click();
      }
    });
    const ab = $("actionbar");
    const root = document.documentElement;
    const setDock = () => {
      if (ab && root && root.style) root.style.setProperty("--dock-h", ab.offsetHeight + "px");
      sizePanelCanvas();
    };
    if (ab && window.ResizeObserver) new ResizeObserver(setDock).observe(ab);
    window.addEventListener("resize", setDock);
    setDock();
  }
  function sizePanelCanvas() {
    if (!pcv) return;
    const r = el.panelBody.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pcv.width = r.width * dpr;
    pcv.height = r.height * dpr;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function update4(state, nowMs) {
    updateHud(state);
    updateAdvisory(state);
    updateObjectives(state);
    updateTutorial(state, nowMs);
    updateLog(state);
    updateBanner(nowMs);
    if (panelOpen) drawPanel(state, nowMs);
  }
  function updateObjectives(state) {
    if (!el.objectives) return;
    if (state.over) {
      el.objectives.className = "";
      return;
    }
    const prim = primaryObjective(state);
    const now = nowStep(state);
    let html = '<div class="obj-goal"><span class="obj-k">Goal</span>' + escapeHtml(prim.text) + "</div>";
    if (now) {
      html += '<div class="obj-now' + (now.danger ? " danger" : "") + '"><span class="obj-k">Now</span>' + now.text + "</div>";
    }
    el.objectives.innerHTML = html;
    el.objectives.className = "show" + (now && now.danger ? " danger" : "");
  }
  function tipsSeen() {
    try {
      return new Set((localStorage.getItem(TIP_KEY) || "").split(",").filter(Boolean));
    } catch (e) {
      return /* @__PURE__ */ new Set();
    }
  }
  function markTip(id) {
    try {
      const s = tipsSeen();
      s.add(id);
      localStorage.setItem(TIP_KEY, [...s].join(","));
    } catch (e) {
    }
  }
  function hideCoach() {
    coachShowing = null;
    coachUntil = 0;
    if (coachPaused && app && app.resumeFromOverlay) app.resumeFromOverlay();
    coachPaused = false;
    if (el.coach) el.coach.className = "";
  }
  function showCoach(id, html, ms, nowMs) {
    markTip(id);
    coachShowing = id;
    el.coach.innerHTML = '<span class="coach-x">✕</span>' + html;
    el.coach.className = "show";
    coachUntil = Infinity;
    if (!coachPaused && app && app.pauseForOverlay) {
      app.pauseForOverlay();
      coachPaused = true;
    }
  }
  function updateTutorial(state, nowMs) {
    if (!el.coach) return;
    const civ = state.civ, cl = state.cl;
    if (coachShowing && nowMs > coachUntil) hideCoach();
    if (coachShowing === "t-dehydrate" && civ.order === "dehydrate") hideCoach();
    if (coachShowing === "t-rehydrate" && civ.order === "rehydrate") hideCoach();
    if (coachShowing === "t-calendar" && state.calendar) hideCoach();
    if (coachShowing && (state.over || !civ.alive || civ.dormant)) hideCoach();
    if (overlayOpen || state.over || !civ.alive || civ.dormant || coachShowing) return;
    const seen = tipsSeen();
    const sust = sustainablePop(civ, cl), fd = foodDays(civ);
    const fire = (id, cond, html, ms) => {
      if (!seen.has(id) && cond) {
        showCoach(id, html, ms, nowMs);
        return true;
      }
      return false;
    };
    if (fire(
      "t-dehydrate",
      civ.popH > 0 && civ.order !== "dehydrate" && (cl.tempC < -6 || cl.tempC > 43),
      "The sky has turned deadly. Press <kbd>D</kbd> — <b>Dehydrate</b> — to wring your people into dry seed before the cold or heat takes them. The stored feel nothing."
    )) return;
    if (fire(
      "t-rehydrate",
      cl.eraType === "stable" && civ.popD > 0.5 && cl.tempC > 2 && cl.tempC < 36 && civ.order !== "rehydrate" && civ.water > civ.popD * 0.3,
      "A <b>Stable Era</b> — the sky is kind. Press <kbd>R</kbd> to <b>Rehydrate</b> the stored, and let your people live, grow, and learn."
    )) return;
    if (fire(
      "t-reserves",
      civ.popH > sust * 1.4 && fd < 25 && fd > 0,
      "You cannot keep everyone awake — the fields can't feed them. Set the order size to <b>⅓</b>, then <b>Dehydrate</b>: keep a workforce, store the rest, and your grain will last."
    )) return;
    if (fire(
      "t-calendar",
      cl.eraType === "stable" && state.day - cl.eraStartDay > 60 && !state.calendar && civ.popH > 1,
      "Confident the calm will hold? Run the <b>Computer</b> <kbd>C</kbd> to forecast, then publish a <b>Calendar</b> <kbd>P</kbd>. Be right and a golden age follows — be wrong, and the people are caught in the open."
    )) return;
    if (fire(
      "t-records",
      civ.ageIdx >= 5 && state.day > 400,
      "Open <b>Records</b> <kbd>L</kbd> any time to re-read the story, review your chronicle, and see how far this civilization has come."
    )) return;
  }
  function updateAdvisory(state) {
    const civ = state.civ;
    if (state.over) {
      el.advisory.className = "";
      return;
    }
    if (!civ.alive || civ.dormant) {
      el.advisory.className = "show calm";
      const T = Math.round(state.cl.tempC);
      const livable = T >= 0 && T <= 38;
      el.advisory.innerHTML = '<b>SEED DORMANT</b> &nbsp;<span class="adv-advice">' + (livable ? "The sky is livable — the buried seed of Civilization No. " + civ.no + " will germinate within days. Let time run." : "A buried seed of Civilization No. " + civ.no + " waits for a livable sky (0–38°C). Speed up time [2–4] and watch the temperature.") + "</span>";
      return;
    }
    const o = outlook(civ, state.cl);
    let cls = "calm", html;
    if (o.threat) {
      cls = o.threat.severity === "crit" ? "crit" : "warn";
      const when = o.threat.days < 1 ? "now" : "in ~" + fmtDays(o.threat.days);
      html = "<b>" + o.threat.label + '</b> &nbsp;<span class="adv-when">' + when + '</span> &nbsp;<span class="adv-advice">' + o.threat.advice + "</span>";
    } else if (civ.order !== "none" && isFinite(o.orderEta)) {
      cls = "calm";
      html = "<b>" + (civ.order === "dehydrate" ? "DEHYDRATING" : "REHYDRATING") + '</b> &nbsp;<span class="adv-when">done in ~' + fmtDays(Math.max(o.orderEta, 0.5)) + "</span>";
    } else if (civ.order === "rehydrate" && !isFinite(o.orderEta)) {
      cls = "warn";
      html = '<b>REHYDRATION STALLED</b> &nbsp;<span class="adv-advice">' + (civ.water < 1 ? "the cisterns are dry" : "the lakes are frozen or boiling") + "</span>";
    } else {
      cls = "calm";
      const sust = sustainablePop(civ, state.cl);
      const note = state.cl.eraType === "stable" ? "Stable skies — build and grow while it lasts." : "Chaotic, but survivable for now. Watch the sky.";
      html = '<b>STEADY</b> &nbsp;<span class="adv-advice">' + note + "</span>";
    }
    el.advisory.className = "show " + cls;
    el.advisory.innerHTML = html;
  }
  function updateHud(state) {
    const civ = state.civ, cl = state.cl;
    el.hudCiv.innerHTML = '<span class="label">Civilization</span>No. ' + civ.no + (civ.dormant ? " · seed" : "");
    const eraDays = Math.floor(state.day - cl.eraStartDay);
    el.hudEra.innerHTML = '<span class="label">' + eraLabel(cl) + "</span>" + (cl.eraType === "stable" ? "STABLE" : "CHAOTIC") + " · day " + eraDays;
    el.hudEra.className = "hud-block " + cl.eraType;
    el.hudDate.innerHTML = '<span class="label">Calendar</span>' + fmtDate(state.day - civ.foundedDay);
    el.hudTemp.innerHTML = '<span class="label">Surface</span>' + fmtTemp(cl.tempC);
    el.hudTemp.className = "hud-block " + (cl.tempC < -10 ? "t-cold" : cl.tempC > 45 ? "t-hot" : "t-ok");
    el.hudPop.innerHTML = '<span class="label">Population</span>' + fmtPop(civ.popH) + " · " + fmtPop(civ.popD) + " stored";
    const wCap = waterCap(civ), gCap = grainCap(civ);
    const wFrac = clamp(civ.water / wCap, 0, 1);
    const gFrac = clamp(civ.grain / gCap, 0, 1);
    const fdays = foodDays(civ);
    const dormant = civ.dormant || !civ.alive;
    el.hudWater.innerHTML = '<span class="label">Water</span>' + (dormant ? "—" : Math.round(civ.water) + " / " + Math.round(wCap)) + '<span class="meter"><i style="width:' + (wFrac * 100).toFixed(0) + '%"></i></span>';
    el.hudWater.className = "hud-block" + (!dormant && wFrac < 0.12 ? " low" : "");
    el.hudGrain.innerHTML = '<span class="label">Grain</span>' + (dormant ? "—" : isFinite(fdays) ? Math.round(fdays) + "d food" : "ample") + '<span class="meter"><i style="width:' + (gFrac * 100).toFixed(0) + '%"></i></span>';
    el.hudGrain.className = "hud-block" + (!dormant && civ.popH > 0 && fdays < 15 ? " low" : "");
    el.hudAge.innerHTML = '<span class="label">Era of</span>' + AGES[civ.ageIdx].name;
    el.hudTrust.innerHTML = '<span class="label">Trust</span>' + Math.round(civ.trust * 100) + "%";
    el.hudWorlds.innerHTML = '<span class="label">Worlds left</span>' + state.planetsLeft + " / 12";
    if (el.hudScore) {
      const lvl = state.level >= 0 && LEVELS[state.level];
      el.hudScore.innerHTML = '<span class="label">' + (lvl ? "Lvl " + (state.level + 1) + " · Score" : "Score") + "</span>" + (state.score || 0).toLocaleString();
    }
    const noCiv = !civ.alive || civ.dormant || state.over;
    el.btnDe.disabled = noCiv || civ.popH <= 0 || civ.order === "dehydrate";
    el.btnRe.disabled = noCiv || civ.popD <= 0 || civ.order === "rehydrate";
    el.btnHold.disabled = noCiv || civ.order === "none";
    el.btnDe.className = civ.order === "dehydrate" ? "engaged" : "";
    el.btnRe.className = civ.order === "rehydrate" ? "engaged" : "";
    el.btnProc.disabled = noCiv || !!state.calendar || cl.eraType !== "stable";
    el.btnOrbit.classList.toggle("locked", !state.flags.orbit);
    el.btnComp.classList.toggle("locked", !state.flags.computer);
    el.btnAuto.classList.toggle("locked", !state.flags.autoUnlocked);
    el.btnAuto.classList.toggle("engaged", !!civ.autoProtocol);
    el.btnAuto.disabled = !state.flags.autoUnlocked;
    el.btnDoctrine.disabled = noCiv;
    el.btnDoctrine.classList.toggle("attention", !noCiv && civ.insight > 0);
    const fleetReady = state.flags.escape && civ.ageIdx >= 12;
    el.btnFleet.classList.toggle("hidden", !fleetReady || civ.fleet.ships >= consts2.FLEET_SHIPS);
    el.btnFleet.disabled = civ.fleet.building || noCiv;
    el.btnFleet.classList.toggle("attention", fleetReady && !civ.fleet.building);
    const danger = !noCiv && civ.popH > 0 && civ.order !== "dehydrate" && (cl.tempC < -5 || cl.tempC > 42);
    el.btnDe.classList.toggle("attention", danger);
    if (civ.fleet.building || fleetReady && civ.fleet.ships > 0) {
      el.fleetbar.style.display = "block";
      el.fleetbar.textContent = "TRISOLARAN FLEET: " + Math.floor(civ.fleet.ships) + " / " + consts2.FLEET_SHIPS + " ships";
    } else el.fleetbar.style.display = "none";
    if (state.calendar) {
      const p = state.calendar;
      el.procStatus.style.display = "block";
      el.procStatus.textContent = "CALENDAR: " + (p.kind === "stable" ? "Stable Era holds" : "Chaos foretold") + " · " + fmtDays(Math.max(0, p.endDay - state.day)) + " to verdict";
    } else el.procStatus.style.display = "none";
  }
  function updateLog(state) {
    const log = state.log;
    const stamp = log.length + ":" + (log.length ? log[log.length - 1].day + log[log.length - 1].text : "");
    if (stamp === lastLogStamp) return;
    lastLogStamp = stamp;
    let html = "";
    for (let i = log.length - 1; i >= Math.max(0, log.length - 40); i--) {
      const e = log[i];
      html += '<div class="entry ' + e.cls + '"><span class="d">d' + e.day + "</span>" + escapeHtml(e.text) + "</div>";
    }
    el.log.innerHTML = html;
  }
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function pushBanner(text, style) {
    bannerQueue.push({ text, style });
    if (bannerQueue.length > 4) bannerQueue.splice(0, bannerQueue.length - 4);
  }
  function updateBanner(nowMs) {
    if (bannerUntil > nowMs) return;
    if (el.banner.classList.contains("show")) {
      el.banner.classList.remove("show");
      bannerUntil = nowMs + 350;
      return;
    }
    const b = bannerQueue.shift();
    if (!b) return;
    el.banner.textContent = b.text;
    el.banner.className = "show " + (b.style || "");
    bannerUntil = nowMs + 2400;
  }
  function handlePending(state) {
    if (!state.pending.length) return;
    const items = state.pending.splice(0);
    for (const it of items) {
      switch (it.kind) {
        case "banner":
          pushBanner(it.text, it.style);
          sting(stingFor(it.style));
          if (it.style === "syzygy") {
            render2.addShake(0.55);
            render2.flash("255,90,90", 0.16);
          } else if (it.style === "hot") {
            render2.addShake(0.25);
            render2.flash("255,180,100", 0.12);
          } else if (it.style === "cold") {
            render2.flash("150,200,255", 0.1);
          } else if (it.style === "bad") {
            render2.addShake(0.3);
          }
          if (["hot", "syzygy", "cold"].includes(it.style) && app.speedIdx > 2) {
            app.setSpeed(1);
          }
          break;
        case "beat":
          overlayQueue.push({ type: "beat", beat: it.beat });
          break;
        case "notice":
          overlayQueue.push({ type: "notice", notice: it.notice });
          break;
        case "destroyed":
          sting("death");
          render2.addShake(0.45);
          render2.flash("255,70,70", 0.2);
          overlayQueue.push({ type: "destroyed", text: it.text, civNo: it.civNo });
          break;
        case "planet-lost": {
          sting("death");
          render2.addShake(0.9);
          render2.flash("255,255,255", 0.3);
          resetTrail();
          render2.reseedTerrain(it.planetsLeft);
          let txt = it.text;
          if (it.planetsLeft > 0 && render2.setBiome) {
            const wname = render2.setBiome(12 - it.planetsLeft);
            if (wname) txt += "\n\nThe seed is carried down to a new world: " + wname + ".";
          }
          overlayQueue.push({ type: "planet-lost", text: txt, planetsLeft: it.planetsLeft });
          break;
        }
        case "ending":
          sting("fleet");
          render2.flash("150,255,190", 0.18);
          app.recordResult(state.level, it.stats && it.stats.score || 0);
          overlayQueue.push({ type: "ending", ending: it.ending, stats: it.stats });
          break;
        case "silence":
          sting("death");
          overlayQueue.push({ type: "silence", text: it.text, stats: it.stats });
          break;
        case "objective":
          pushBanner("✓ " + it.text, "good");
          sting("germinate");
          break;
        case "level-complete":
          app.recordResult(it.level, it.score);
          sting("age");
          render2.flash("150,255,190", 0.16);
          overlayQueue.push({ type: "level-complete", item: it });
          break;
      }
    }
    if (overlayQueue.length && !overlayOpen) showNextOverlay();
  }
  function stingFor(style) {
    return {
      stable: "stable",
      chaotic: "chaotic",
      hot: "hot",
      cold: "cold",
      syzygy: "syzygy",
      age: "age",
      good: "germinate",
      bad: "chaotic"
    }[style] || null;
  }
  function showNextOverlay() {
    const item = overlayQueue.shift();
    if (!item) {
      closeOverlay();
      return;
    }
    if (!overlayOpen) app.pauseForOverlay();
    overlayOpen = true;
    if (item.type === "beat" || item.type === "notice") sting("beat");
    if (item.type === "beat") renderBeat(item.beat, 0);
    else if (item.type === "notice") renderSimple(item.notice.title, item.notice.text, "notice-d", "Continue");
    else if (item.type === "destroyed") renderSimple("CIVILIZATION DESTROYED", item.text, "registrar", "Log in again");
    else if (item.type === "planet-lost") renderSimple("THE WORLD IS LOST", item.text, "registrar", "Continue");
    else if (item.type === "ending") renderEnding(item, 0);
    else if (item.type === "silence") renderSilence(item);
    else if (item.type === "level-complete") renderLevelComplete(item.item);
  }
  function closeOverlay() {
    cancelTyper();
    if (overlayQueue.length) {
      showNextOverlay();
      return;
    }
    overlayOpen = false;
    el.overlay.classList.remove("show");
    setTimeout(() => {
      if (!overlayOpen) el.overlay.innerHTML = "";
    }, 260);
    app.resumeFromOverlay();
  }
  function dialogShell(cls, inner) {
    cancelTyper();
    el.overlay.innerHTML = '<div class="dialog ' + cls + '">' + inner + "</div>";
    el.overlay.classList.add("show");
  }
  function startType(elText, text) {
    cancelTyper();
    if (!elText) return;
    if (globalThis.__TB_NOTYPE__) {
      elText.textContent = text;
      return;
    }
    elText.textContent = "";
    elText.classList.add("typing");
    let i = 0;
    const tick2 = () => {
      i = Math.min(text.length, i + 2);
      elText.textContent = text.slice(0, i);
      if (i >= text.length) finishTyper();
    };
    typer = { el: elText, full: text, timer: setInterval(tick2, 16) };
  }
  function finishTyper() {
    if (typer && typer.timer) {
      clearInterval(typer.timer);
      typer.timer = null;
    }
    if (typer && typer.el) typer.el.classList.remove("typing");
  }
  function cancelTyper() {
    if (typer && typer.timer) clearInterval(typer.timer);
    typer = null;
  }
  function isTyping() {
    return !!(typer && typer.timer);
  }
  function finishTypingNow() {
    if (typer) {
      typer.el.textContent = typer.full;
      finishTyper();
    }
  }
  function portraitHtml(speaker) {
    return portraits_exports ? '<div class="portrait">' + svg(speaker) + "</div>" : '<div class="glyph">三</div>';
  }
  function renderBeat(beat, page) {
    const p = beat.pages[page];
    const last = page === beat.pages.length - 1;
    dialogShell("", `
      ${beat.id ? art("docs/media/beats/" + beat.id + ".jpg", "beat-art") : ""}
      <h2>${escapeHtml(beat.title)}</h2>
      <div class="speaker">
        ${portraitHtml(p.speaker)}
        <div class="who">${escapeHtml(p.speaker)}</div>
      </div>
      <div class="text"></div>
      <div class="btnrow">
        <span class="pageno">${page + 1} / ${beat.pages.length}</span>
        <button class="primary">${last ? "Close" : "Next"}</button>
      </div>`);
    startType(el.overlay.querySelector(".text"), p.text);
    el.overlay.querySelector("button.primary").onclick = () => {
      if (isTyping()) {
        finishTypingNow();
        return;
      }
      if (last) closeOverlay();
      else renderBeat(beat, page + 1);
    };
  }
  function renderSimple(title, text, cls, btnLabel) {
    dialogShell(cls, `
      <h2>${escapeHtml(title)}</h2>
      <div class="text"></div>
      <div class="btnrow"><button class="primary">${btnLabel}</button></div>`);
    startType(el.overlay.querySelector(".text"), text);
    el.overlay.querySelector("button.primary").onclick = () => {
      if (isTyping()) {
        finishTypingNow();
        return;
      }
      closeOverlay();
    };
  }
  function renderEnding(item, page) {
    const pages = item.ending.pages;
    if (page < pages.length) {
      dialogShell("ending-d", `
        <h2>${escapeHtml(item.ending.title)}</h2>
        <div class="text">${escapeHtml(pages[page])}</div>
        <div class="btnrow">
          <span class="pageno">${page + 1} / ${pages.length + 1}</span>
          <button class="primary">Next</button>
        </div>`);
      el.overlay.querySelector("button.primary").onclick = () => renderEnding(item, page + 1);
      return;
    }
    const s = item.stats;
    dialogShell("ending-d", `
      ${art("docs/media/end/fleet.jpg", "end-art")}
      <h2>YOU HAVE UNDERSTOOD TRISOLARIS</h2>
      <div class="stats">
        Years beneath the three suns: <b>${s.years}</b><br>
        Civilizations destroyed: <b>${s.civsLost}</b> (last: No. ${s.lastCivNo})<br>
        Worlds consumed: <b>${s.planetsLost}</b><br>
        Calendars fulfilled / failed: <b>${s.proclaimOk} / ${s.proclaimBad}</b><br>
        Highest age: <b>${s.maxAge}</b><br>
        Final score: <b>${(s.score || 0).toLocaleString()}</b> — ${escapeHtml(s.title || "")} ${starStr(s.stars || 0)}
      </div>
      <div class="btnrow">
        <button id="end-watch">Keep watching the suns</button>
        <button class="primary" id="end-new">Title</button>
      </div>`);
    $("end-watch").onclick = () => {
      app.sandboxContinue();
      closeOverlay();
    };
    $("end-new").onclick = () => {
      closeOverlay();
      app.showTitle();
    };
  }
  function renderSilence(item) {
    const s = item.stats;
    dialogShell("registrar", `
      ${art("docs/media/end/silence.jpg", "end-art")}
      <h2>${escapeHtml(SILENCE.title)}</h2>
      <div class="text">${escapeHtml(item.text)}</div>
      <div class="stats">
        Years beneath the three suns: <b>${s.years}</b> ·
        Civilizations: <b>${s.civsLost}</b> ·
        Highest age: <b>${s.maxAge}</b> ·
        Score: <b>${(s.score || 0).toLocaleString()}</b>
      </div>
      <div class="btnrow"><button class="primary" id="end-new">Begin again</button></div>`);
    $("end-new").onclick = () => {
      closeOverlay();
      app.showTitle();
    };
  }
  function art(src, cls) {
    return '<img class="' + cls + '" src="' + src + '" alt="" onerror="this.remove()">';
  }
  function starStr(n) {
    return "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));
  }
  function bestFor(level) {
    const p = app.getProgress();
    const id = (LEVELS[level] || {}).id;
    return p.best && id && p.best[id] || 0;
  }
  function renderLevelComplete(item) {
    const next = item.level + 1;
    const hasNext = next < LEVELS.length;
    const fig = (LEVELS[item.level] || {}).figure;
    dialogShell("notice-d", `
      ${art("docs/media/levels/l" + (item.level + 1) + ".jpg", "lc-art")}
      <h2>LEVEL ${item.level + 1} COMPLETE — ${escapeHtml(item.name)}</h2>
      <div class="stars-big">${starStr(item.stars)}</div>
      ${fig ? '<div class="speaker"><div class="glyph">' + fig.glyph + '</div><div class="who">' + escapeHtml(fig.name) + '</div></div><div class="text lc-line">' + escapeHtml(fig.line) + "</div>" : ""}
      <div class="stats">
        Score: <b>${item.score.toLocaleString()}</b> — ${escapeHtml(item.title)}<br>
        Best for this level: <b>${bestFor(item.level).toLocaleString()}</b>
        ${hasNext ? "<br>Unlocked: <b>Level " + (next + 1) + " · " + escapeHtml(LEVELS[next].name) + "</b>" : ""}
      </div>
      <div class="btnrow">
        <button id="lc-stay">Keep playing</button>
        ${hasNext ? '<button class="primary" id="lc-next">Next level</button>' : '<button class="primary" id="lc-title">Title</button>'}
      </div>`);
    if ($("lc-stay")) $("lc-stay").onclick = closeOverlay;
    if ($("lc-next")) $("lc-next").onclick = () => {
      closeOverlay();
      app.startLevel(next);
    };
    if ($("lc-title")) $("lc-title").onclick = () => {
      closeOverlay();
      app.showTitle();
    };
  }
  function openProclaim() {
    const st = app.state;
    if (!st || st.calendar || st.over || st.civ.dormant || overlayOpen) return;
    if (st.cl.eraType !== "stable") {
      app.pauseForOverlay();
      overlayOpen = true;
      renderSimple(
        "NO CALENDAR UNDER A CHAOTIC SKY",
        "The sky is already chaos — there is nothing to predict about it. Wait for a Stable Era; then publish a calendar declaring how long the calm will hold, or warning when it will break.",
        "notice-d",
        "Understood"
      );
      return;
    }
    app.pauseForOverlay();
    overlayOpen = true;
    const fc = lastForecastInfo(st.day);
    let guide;
    if (!fc) {
      guide = "No forecast stands. Run the COMPUTER [C] first to see how far the futures agree before you stake the people on a calendar.";
    } else if (fc.confident) {
      guide = "The Computer's ensemble agrees across its whole " + fc.days + "-day window" + (fc.ageDays > 60 ? " (but that reading is " + fc.ageDays + " days old)" : "") + ". A bold Stable calendar looks safe.";
    } else {
      guide = "The Computer's chaos horizon is ~" + fc.horizonDay + " days out" + (fc.ageDays > 60 ? " (reading " + fc.ageDays + " days old)" : "") + ". Beyond it the futures disagree — predict past it at your peril.";
    }
    dialogShell("notice-d", `
      <h2>PUBLISH THE CALENDAR</h2>
      <div class="text">Stake the civilization on a prediction. While the calendar stands the people FOLLOW it — rehydrating to live and build, or sheltering — with no further orders from you.

A Stable Era that holds rewards a golden age of trust and science. But if chaos breaks while the people are awake, they are caught in the open: the longer and bolder the failed promise, the greater the catastrophe.</div>
      <div class="text" style="font-size:12px; font-family:var(--mono); color:var(--ink-dim); border-left:2px solid var(--gold-soft); padding-left:12px;">FORECAST — ${escapeHtml(guide)}</div>
      <div class="choices">
        <button data-k="stable" data-d="120">Declare the Stable Era will hold 120 days</button>
        <button data-k="stable" data-d="365">Declare the Stable Era will hold 1 year</button>
        <button data-k="stable" data-d="1095">Declare the Stable Era will hold 3 years</button>
        <button data-k="chaos" data-d="120">Warn: chaos will break within 120 days</button>
        <button data-k="chaos" data-d="365">Warn: chaos will break within 1 year</button>
      </div>
      <div class="btnrow"><button class="primary" id="proc-cancel">Cancel</button></div>`);
    el.overlay.querySelectorAll(".choices button").forEach((b) => {
      b.onclick = () => {
        cmdProclaim(st, b.dataset.k, +b.dataset.d);
        closeOverlay();
      };
    });
    $("proc-cancel").onclick = closeOverlay;
  }
  function openHelp() {
    if (overlayOpen) return;
    app.pauseForOverlay();
    overlayOpen = true;
    dialogShell("notice-d", `
      <h2>HOW TO SURVIVE THREE BODY</h2>
      <div class="text" style="font-size:13px; font-family: var(--mono); line-height:1.9;">WORLD — This is the game from the novel: a planet in a true three-sun system, simulated with real gravity. Stable and Chaotic Eras are not scripted; they emerge from the orbits.

SURVIVE — Hydrated people live, grow, and do science, but die outside −10…+45°C. DEHYDRATE [D] before the extremes arrive; REHYDRATE [R] when the sky turns kind (needs −15…+50°C). Stored bodies survive anything except fire (≳150°C).

RESERVES — Rehydration spends WATER from your cisterns; dehydration wrings water back into them; lakes refill them in mild weather. GRAIN feeds the hydrated — it is harvested only in the growth band (−5…+40°C) and the harvest is sublinear, so you cannot keep everyone awake at once. When grain runs out, FAMINE kills. The lesson of the book: stockpile in Stable Eras, sleep through the Chaotic ones.

ORDER SIZE — The All / ¾ / ½ / ⅓ selector sets how much of the populace a Dehydrate or Rehydrate order moves. Keep a third awake to work the fields and the cisterns while the rest sleep safely — the core trade of the game.

READ THE SKY — Distant suns look like flying stars. Three flying stars at once: all suns far, deep freeze coming. Two or three discs at once: furnace. Suns stacked in a line: syzygy tides.

PREDICT — Read the sky with the instruments, all open from the start: Mozi's model [O], the Orbit Map [M], and the ensemble-forecast Computer [C] with its honest chaos horizon. Forecast precision sharpens as technology advances.

THE CALENDAR [P] — Under a Stable sky, publish a calendar: declare how long the calm will hold (or warn when it will break). The people then FOLLOW it on their own. A calendar that holds brings a golden age of trust and science; one that fails — chaos while everyone is awake — brings catastrophe and collapse. This is the game's central gamble; let the Computer's horizon guide how far you dare predict.

WATCH THE ADVISORY — The pill below the top bar names your most pressing deadline: killing cold/heat, famine, or a stalled order, with the days remaining.

DOCTRINES [V] — Each new age and each kept Calendar grants Insight ◆. Spend it on three competing schools — the Calendrical (predict farther, stake harder), the Dehydratory (outlast any sky), or the Engine (drive science and the fleet). Doctrines outlive the seed, so a long line of civilizations compounds its choices.

PREVAIL — Advance to the Space Age and launch the Trisolaran Fleet: 1,000 ships.

KEYS — Space pause · 1–4 speed · D/R/X orders · All/¾/½/⅓ order size · P calendar · O observatory · M orbit map · C computer · V doctrines · L records · A auto-protocol · H help.</div>
      <div class="btnrow"><button class="primary">Close</button></div>`);
    el.overlay.querySelector("button.primary").onclick = closeOverlay;
  }
  function openDoctrines() {
    const st = app.state;
    if (!st || st.over || !st.civ.alive || overlayOpen) return;
    app.pauseForOverlay();
    overlayOpen = true;
    renderDoctrines(st);
  }
  function renderDoctrines(st) {
    const civ = st.civ;
    const branches = DOCTRINES.map((b) => {
      const next = nextTier(b, civ.doctrines);
      const tiers = b.tiers.map((t) => {
        const owned = !!civ.doctrines[t.id];
        const buyable = !owned && next === t && civ.insight >= t.cost;
        const cls = owned ? "owned" : buyable ? "buyable" : "locked";
        const tag = owned ? '<span class="dt-tag">ADOPTED</span>' : '<span class="dt-cost">' + t.cost + " ◆</span>";
        return '<div class="dtier ' + cls + '" data-id="' + t.id + '"><div class="dt-head"><b>' + escapeHtml(t.name) + "</b>" + tag + '</div><div class="dt-desc">' + escapeHtml(t.desc) + "</div></div>";
      }).join("");
      return '<div class="branch"><h4>' + escapeHtml(b.name) + '</h4><div class="bblurb">' + escapeHtml(b.blurb) + "</div>" + tiers + "</div>";
    }).join("");
    dialogShell("notice-d", `
      <h2>DOCTRINES <span class="ins-bal">${civ.insight} ◆ Insight</span></h2>
      <div class="text" style="font-size:12px; font-family:var(--mono); line-height:1.7; margin-bottom:16px;">Each new age — and each Calendar you keep — grants <b>Insight ◆</b>. Spend it to shape the civilization: read the sky farther, outlast it longer, or drive harder toward escape. Tiers unlock in order, and a doctrine, once learned, outlives the seed.</div>
      <div class="doctrines">${branches}</div>
      <div class="btnrow"><button class="primary" id="dx-close">Close</button></div>`);
    el.overlay.querySelectorAll(".dtier.buyable").forEach((d) => {
      d.onclick = () => {
        if (cmdBuyDoctrine(st, d.dataset.id)) renderDoctrines(st);
      };
    });
    $("dx-close").onclick = closeOverlay;
  }
  function togglePanel(tab, forceClose) {
    if (panelOpen && (panelTab === tab || forceClose)) {
      panelOpen = false;
      el.panel.classList.remove("open");
      return;
    }
    panelTab = tab;
    panelOpen = true;
    el.panel.classList.add("open");
    setTab(tab);
    setTimeout(sizePanelCanvas, 280);
  }
  function setTab(tab) {
    panelTab = tab;
    el.tabObs.classList.toggle("active", tab === "obs");
    el.tabOrbit.classList.toggle("active", tab === "orbit");
    el.tabComp.classList.toggle("active", tab === "comp");
    if (el.tabCodex) el.tabCodex.classList.toggle("active", tab === "codex");
    el.panel.classList.toggle("codex-open", tab === "codex");
    const st = app.state;
    el.tabOrbit.disabled = !st.flags.orbit;
    el.tabComp.disabled = !st.flags.computer;
    let html = "";
    if (tab === "obs") {
      html = '<button id="pc-div">Cast the hexagrams</button>' + (st.flags.mozi ? `<button id="pc-mozi">Wind Mozi's machine</button>` : "") + "<span>Watch the suns. Patterns are a hope; measurement is a beginning.</span>";
    } else if (tab === "orbit") {
      html = "<span>The true configuration, as no Trisolaran eye has seen it.</span>";
    } else if (tab === "comp") {
      html = '<button id="pc-run">RUN FORECAST</button><span>Qin I: 30,000,000 soldiers · ensemble of 7 futures</span>';
    } else if (tab === "codex") {
      html = "<span>The records of every life lived beneath the three suns.</span>";
    }
    el.panelControls.innerHTML = html;
    const bDiv = $("pc-div"), bMozi = $("pc-mozi"), bRun = $("pc-run");
    if (bDiv) bDiv.onclick = () => rollDivination(app.state);
    if (bMozi) bMozi.onclick = () => runMozi(app.state);
    if (bRun) bRun.onclick = () => {
      if (!isComputing()) requestForecast(app.state);
    };
    if (tab === "codex") renderCodex(st);
  }
  function drawPanel(state, nowMs) {
    if (panelTab === "codex") {
      renderCodex(state);
      return;
    }
    const r = el.panelBody.getBoundingClientRect();
    const w = r.width, h = r.height;
    if (w < 10 || h < 10) return;
    pctx.clearRect(0, 0, w, h);
    if (panelTab === "obs") drawObservatory(pctx, state, w, h);
    else if (panelTab === "orbit") drawOrbit(pctx, state, w, h);
    else if (panelTab === "comp") drawComputer(pctx, state, w, h, nowMs);
  }
  function renderCodex(state) {
    const civ = state.civ;
    const stamp = Object.keys(state.story.seenBeats).length + ":" + state.log.length + ":" + state.stats.civsLost + ":" + civ.ageIdx + ":" + civ.insight + ":" + Object.keys(civ.doctrines).length;
    if (stamp === codexStamp) return;
    codexStamp = stamp;
    const yrs = Math.floor(state.day / 365.25);
    const allBeats = BEATS.concat(Object.keys(MOMENTS).map((k) => MOMENTS[k]));
    const seen = allBeats.filter((b) => state.story.seenBeats[b.id]);
    let html = '<h3>This Run</h3><div class="stat-grid">' + row("Civilization", "No. " + civ.no) + row("Age", AGES[civ.ageIdx].name) + row("Years endured", yrs) + row("Worlds left", state.planetsLeft + " / 12") + row("Civilizations lost", state.stats.civsLost) + row("Worlds consumed", state.stats.planetsLost) + row("Calendars kept / broken", state.stats.proclaimOk + " / " + state.stats.proclaimBad) + row("Peak population", fmtPop(civ.peakPop)) + "</div>";
    html += "<h3>Doctrines &nbsp;·&nbsp; " + civ.insight + " ◆ Insight</h3>";
    const owned = [];
    for (const b of DOCTRINES) for (const t of b.tiers) if (civ.doctrines[t.id]) owned.push(t.name);
    if (!owned.length) html += '<div class="empty">No doctrines adopted. Press V to spend Insight.</div>';
    else html += '<div style="line-height:1.9">' + owned.map(escapeHtml).join(" · ") + "</div>";
    html += "<h3>The Story So Far</h3>";
    if (!seen.length) html += '<div class="empty">No revelations yet. Play on.</div>';
    else html += seen.map((b) => '<button class="beat-btn" data-beat="' + b.id + '"><span class="bk">' + (MOMENTS[b.id] ? "moment" : "chapter") + "</span><br>" + escapeHtml(b.title) + "</button>").join("");
    html += '<h3>Chronicle</h3><div class="chron">';
    const log = state.log.slice(-60).reverse();
    if (!log.length) html += '<div class="empty">—</div>';
    else html += log.map((e) => '<div class="row ' + (e.cls || "") + '"><span class="d">d' + e.day + "</span>" + escapeHtml(e.text) + "</div>").join("");
    html += "</div>";
    el.codex.innerHTML = html;
    el.codex.querySelectorAll(".beat-btn").forEach((b) => {
      b.onclick = () => openBeatForReading(b.dataset.beat);
    });
  }
  function row(k, v) {
    return "<div><span>" + k + "</span><b>" + v + "</b></div>";
  }
  function openBeatForReading(id) {
    if (overlayOpen) return;
    const beat = BEATS.find((b) => b.id === id) || (MOMENTS || {})[id];
    if (!beat) return;
    app.pauseForOverlay();
    overlayOpen = true;
    renderBeat(beat, 0);
  }
  var $, el, bannerQueue, bannerUntil, overlayQueue, overlayOpen, lastLogStamp, panelTab, panelOpen, pcv, pctx, orderFrac, typer, TIP_KEY, coachShowing, coachUntil, coachPaused, codexStamp;
  var init_ui = __esm({
    "src/ui.ts"() {
      "use strict";
      init_util();
      init_climate();
      init_civ();
      init_game();
      init_audio();
      init_charts();
      init_portraits();
      init_story();
      init_score();
      init_app();
      init_renderer();
      $ = (id) => document.getElementById(id);
      el = {};
      bannerQueue = [];
      bannerUntil = 0;
      overlayQueue = [];
      overlayOpen = false;
      lastLogStamp = "";
      panelTab = "obs";
      panelOpen = false;
      pcv = null;
      pctx = null;
      orderFrac = 1;
      typer = null;
      TIP_KEY = "threebody.tips";
      coachShowing = null;
      coachUntil = 0;
      coachPaused = false;
      codexStamp = "";
    }
  });

  // src/seeds.ts
  var SEEDS;
  var init_seeds = __esm({
    "src/seeds.ts"() {
      "use strict";
      SEEDS = [
        6021,
        4014,
        8021,
        4238,
        5063,
        7014,
        4182,
        8189,
        5028,
        9203,
        4077,
        5077,
        7259,
        5133,
        6035
      ];
    }
  });

  // src/app.ts
  function setSpeed(i) {
    if (i < 0 || i >= SPEEDS.length) return;
    if (app.speedIdx > 0) app.lastSpeedIdx = app.speedIdx;
    app.speedIdx = i;
    for (let k = 0; k < SPEEDS.length; k++) {
      const b = document.getElementById("spd-" + k);
      if (b) b.classList.toggle("active", k === i);
    }
  }
  function pauseForOverlay() {
    app.overlayPause++;
  }
  function resumeFromOverlay() {
    app.overlayPause = Math.max(0, app.overlayPause - 1);
  }
  function startLevel(n) {
    const lvl = LEVELS[n];
    if (!lvl) return wildGame();
    startWith(createGame(lvl.seed, { level: n }));
  }
  function newGame() {
    startLevel(0);
  }
  function wildGame() {
    startWith(createGame(Math.random() * 4294967295 >>> 0, { level: -1 }));
  }
  function getProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function unlockedCount() {
    return Math.max(0, getProgress().unlocked || 0);
  }
  function bestFor2(id) {
    const p = getProgress();
    return p.best && p.best[id] || 0;
  }
  function recordResult(level, score) {
    if (level < 0 || level >= LEVELS.length) return;
    const p = getProgress();
    p.best = p.best || {};
    const id = LEVELS[level].id;
    if (score > (p.best[id] || 0)) p.best[id] = score;
    p.unlocked = Math.min(LEVELS.length - 1, Math.max(p.unlocked || 0, level + 1));
    if (score > (p.bestOverall || 0)) p.bestOverall = score;
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    } catch (e) {
    }
  }
  function buildLevelSelect() {
    const host = document.getElementById("level-select");
    if (!host) return;
    const unlocked = unlockedCount();
    let html = "";
    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      const locked = i > unlocked;
      const best = bestFor2(lvl.id);
      const r = rankFor(i, best);
      const stars2 = best > 0 ? "★".repeat(r.stars) + "☆".repeat(3 - r.stars) : "";
      html += '<button class="level-btn' + (locked ? " locked" : "") + '" data-lv="' + i + '"' + (locked ? " disabled" : "") + ">" + (locked ? "" : '<img class="lv-thumb" src="docs/media/levels/l' + (i + 1) + '.jpg" alt="" onerror="this.remove()">') + '<span class="lv-no">' + (locked ? "🔒" : i + 1) + '</span><span class="lv-name">' + lvl.name + '</span><span class="lv-stars">' + (locked ? "locked" : stars2 + (best > 0 ? "  " + best : "")) + "</span></button>";
    }
    host.innerHTML = html;
    host.querySelectorAll(".level-btn").forEach((b) => {
      if (b.classList.contains("locked")) return;
      b.onclick = () => startLevel(+b.dataset.lv);
    });
  }
  function continueGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return newGame();
      startWith(load(JSON.parse(raw)));
      addLog(app.state, "You have logged back in to Three Body.", "sys");
    } catch (e) {
      console.warn("Save corrupted, starting fresh.", e);
      newGame();
    }
  }
  function startWith(state) {
    app.state = state;
    resetTrail();
    if (render2.setBiome) render2.setBiome(12 - state.planetsLeft);
    document.getElementById("title").classList.add("hidden");
    document.getElementById("hud").style.display = "";
    setSpeed(2);
    init();
  }
  function sandboxContinue() {
    if (app.state) app.state.over = false;
  }
  function showTitle() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
    }
    app.state = null;
    refreshTitleButtons();
    buildLevelSelect();
    document.getElementById("title").classList.remove("hidden");
    document.getElementById("hud").style.display = "none";
  }
  function saveNow() {
    if (!app.state || app.state.over) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save(app.state)));
    } catch (e) {
    }
  }
  function refreshTitleButtons() {
    let has = false;
    try {
      has = !!localStorage.getItem(SAVE_KEY);
    } catch (e) {
    }
    document.getElementById("t-continue").style.display = has ? "block" : "none";
  }
  function frame2(nowMs) {
    requestAnimationFrame(frame2);
    const dtMs = Math.min(100, nowMs - lastMs || 16);
    lastMs = nowMs;
    const st = app.state;
    if (!st) {
      render2.titleDemo(nowMs);
      return;
    }
    const running = app.overlayPause === 0 && app.speedIdx > 0 && !st.over;
    if (running) {
      acc += dtMs / 1e3 * SPEEDS[app.speedIdx];
      if (acc > MAX_DAYS_PER_FRAME) acc = MAX_DAYS_PER_FRAME;
      while (acc >= CHUNK) {
        tick(st, CHUNK);
        acc -= CHUNK;
        if (st.pending.length) break;
      }
      sampleTrail(st);
    }
    handlePending(st);
    render2.render(st, nowMs);
    update4(st, nowMs);
    update3(st);
    saveTimer += dtMs;
    if (saveTimer > 6e4) {
      saveTimer = 0;
      saveNow();
    }
  }
  function boot() {
    render2.init(document.getElementById("world"));
    init3();
    document.getElementById("t-continue").onclick = continueGame;
    document.getElementById("t-wild").onclick = wildGame;
    refreshTitleButtons();
    buildLevelSelect();
    document.getElementById("hud").style.display = "none";
    const hash = typeof location !== "undefined" && location.hash || "";
    if (hash.includes("autostart")) {
      const m = hash.match(/seed=(\d+)/);
      startWith(createGame(m ? +m[1] : SEEDS && SEEDS.length ? SEEDS[Math.floor(Math.random() * SEEDS.length)] : Math.random() * 4294967295 >>> 0));
      if (hash.includes("skipintro")) {
        app.state.pending.length = 0;
        for (const k in NOTICES) app.state.story.seenNotices[k] = true;
      }
      const bm = hash.match(/biome=(\d+)/);
      if (bm && render2.setBiome) render2.setBiome(+bm[1]);
    }
    try {
      if (localStorage.getItem("threebody.muted") === "1") setMuted(true);
    } catch (e) {
    }
    document.getElementById("btn-sound").textContent = isMuted() ? "♪ off" : "♪ on";
    window.addEventListener("pointerdown", () => init());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveNow();
    });
    window.addEventListener("beforeunload", saveNow);
    requestAnimationFrame(frame2);
  }
  var SAVE_KEY, PROGRESS_KEY, SPEEDS, CHUNK, MAX_DAYS_PER_FRAME, app, lastMs, acc, saveTimer;
  var init_app = __esm({
    "src/app.ts"() {
      "use strict";
      init_game();
      init_charts();
      init_audio();
      init_ui();
      init_story();
      init_score();
      init_renderer();
      init_seeds();
      SAVE_KEY = "threebody.save.v1";
      PROGRESS_KEY = "threebody.progress.v1";
      SPEEDS = [0, 2, 10, 60, 365];
      CHUNK = 0.5;
      MAX_DAYS_PER_FRAME = 12;
      app = {
        state: null,
        speedIdx: 2,
        lastSpeedIdx: 2,
        overlayPause: 0,
        setSpeed,
        pauseForOverlay,
        resumeFromOverlay,
        newGame,
        wildGame,
        continueGame,
        sandboxContinue,
        showTitle,
        startLevel,
        recordResult,
        getProgress
      };
      if (typeof window !== "undefined") window.TB = { app };
      lastMs = 0;
      acc = 0;
      saveTimer = 0;
    }
  });

  // src/main.ts
  var require_main = __commonJS({
    "src/main.ts"() {
      init_app();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
      } else {
        boot();
      }
    }
  });
  require_main();
})();
