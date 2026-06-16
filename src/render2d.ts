/* ============================================================
 * THREE BODY — render2d.ts
 * Cinematic world view: panoramic sky driven by the true sun
 * positions, atmospheric scattering, lens flares, auroras,
 * parallax ridges, the pyramid, the dehydratories, the lake —
 * and later the pendulum monument and the fleet gantries.
 * Post-processed with vignette and film grain. Browser only.
 * ============================================================ */
import * as U from './util';
import * as P from './physics';
import * as C from './climate';

  let canvas, ctx, W = 0, H = 0, DPR = 1;
  let viewDir = 0;
  let stars = [], shootingStar = null;
  let snow = [], embers = [], rocks = [];
  let meteors = [], showerUntil = 0, nextShower = 12000, radiantX = 0, radiantY = 0, curChaos = false;
  let crowd = [];
  let ridges = [];              // parallax mountain layers
  let grain = null;             // pre-rendered noise tile
  let ridgeSeed = 11;
  const srng = U.makeRng(8888);

  // ---- Juice state (purely presentational; never touches the sim) ----
  let trauma = 0;               // 0..1 screen-shake energy; squared for punch
  let flashA = 0, flashColor = '255,255,255';
  let brightSm = 0, gradeA = 0; // eased sky brightness & temperature grade
  let lastFrameMs = 0;
  const reduceMotion = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  // Bump the camera. amount 0..1; big events only.
  function addShake(amount) {
    trauma = Math.min(1, trauma + amount * (reduceMotion ? 0.25 : 1));
  }
  // Full-screen flash, e.g. flash('255,80,80', 0.2).
  function flash(color, a) {
    flashColor = color;
    flashA = Math.max(flashA, a * (reduceMotion ? 0.4 : 1));
  }

  // ----------------------------------------------------------
  function init(cv) {
    canvas = cv;
    // Opaque backing store: the sky always fills the frame, so letting the
    // browser skip alpha compositing is a free fill-rate win.
    ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    stars = [];
    for (let i = 0; i < 320; i++) {
      stars.push({ x: srng.next(), y: srng.next() * 0.85, s: srng.range(0.4, 1.7),
                   tw: srng.range(0, Math.PI * 2), b: srng.range(0.5, 1) });
    }
    const SKINS = ['#e8b88a', '#d9a06b', '#c98a55', '#b27845', '#8d5b34'];
    const CLOTH_OLD = ['#7d4a32', '#5b6470', '#7a6a3c', '#84423c', '#4f5a45', '#6b5340'];
    const CLOTH_NEW = ['#2e3b4e', '#54331f', '#3c4a3a', '#5d2f35', '#27313f', '#6e7681'];
    // Roles: every Trisolaran has a duty.
    //   farmer   — works the furrows, bent over a hoe
    //   carrier  — shuttles water from the lake on a shoulder-pole
    //   mason    — hammers at the pyramid's base
    //   keeper   — patrols and inspects the dehydratories
    //   watcher  — stands at the observatory, reading the sky
    //   townsman — errands between the town and the plaza
    const ROLES = ['farmer', 'farmer', 'farmer', 'carrier', 'carrier', 'mason',
                   'mason', 'keeper', 'townsman', 'townsman', 'watcher'];
    crowd = [];
    for (let i = 0; i < 84; i++) {
      crowd.push({
        x: srng.range(0.30, 0.66),
        row: i % 4,                          // depth row: 0 far … 3 near
        phase: srng.range(0, Math.PI * 2),
        drift: srng.range(0.7, 1.3),
        build: srng.range(0.85, 1.18),       // height/width variation
        skin: srng.pick(SKINS),
        clothOld: srng.pick(CLOTH_OLD),      // robes of the early ages
        clothNew: srng.pick(CLOTH_NEW),      // coats of the late ages
        hat: srng.next() < 0.4,              // conical straw hat (early ages)
        hair: srng.next() < 0.5 ? '#17120d' : '#2a1d12',
        role: ROLES[i % ROLES.length],
        tx: srng.range(0.32, 0.62),          // current destination
        dwellMs: srng.range(0, 2500),        // time left standing/working
        leg: srng.next(),                    // which end of the route we're on
      });
    }
    buildRidges(ridgeSeed);
    buildGrain();
    buildScenery();
  }

  // Static scenery layouts, seeded once (no per-frame allocation).
  let rocksFg = [], tufts = [], townA = [], townB = [];
  function buildScenery() {
    const r = U.makeRng(424242);
    rocksFg = [];
    for (let i = 0; i < 26; i++) rocksFg.push({ x: r.next(), d: r.next(), s: r.range(1.2, 3.6) });
    tufts = [];
    for (let i = 0; i < 64; i++) tufts.push({ x: r.next(), d: r.next(), s: r.range(2.5, 5.5), ph: r.range(0, 6) });
    townA = [];   // low town behind the pyramid
    for (let i = 0; i < 14; i++) townA.push({ dx: 0.255 + i * 0.0135 + r.range(0, 0.006),
      w: r.range(8, 14), h: r.range(10, 26), win: r.int(2, 9) });
    townB = [];   // late-age skyline, taller, further right
    for (let i = 0; i < 10; i++) townB.push({ dx: 0.305 + i * 0.021 + r.range(0, 0.01),
      w: r.range(10, 17), h: r.range(34, 88), win: r.int(2, 9) });
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildRidges(ridgeSeed);
  }

  // Midpoint-displacement ridge lines, three parallax layers.
  function buildRidges(seed) {
    const rr = U.makeRng(seed);
    ridges = [];
    for (let layer = 0; layer < 3; layer++) {
      const n = 129;
      const pts = new Float32Array(n);
      pts[0] = rr.range(0.2, 0.8); pts[n - 1] = rr.range(0.2, 0.8);
      let step = n - 1, amp = 0.55;
      while (step > 1) {
        for (let i = 0; i < n - 1; i += step) {
          const mid = i + step / 2;
          pts[mid] = (pts[i] + pts[i + step]) / 2 + rr.range(-amp, amp);
        }
        step /= 2; amp *= 0.55;
      }
      ridges.push({ pts, h: [0.10, 0.055, 0.028][layer], y: [0.030, 0.016, 0.006][layer] });
    }
  }

  // Pre-render a grain tile (cheap film noise). Degrades gracefully if
  // offscreen canvases are unavailable (e.g. headless smoke tests).
  function buildGrain() {
    try {
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 128;
      const g = cv.getContext('2d');
      const img = g.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 118 + Math.floor(Math.random() * 20);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 14;
      }
      g.putImageData(img, 0, 0);
      grain = cv;
    } catch (e) { grain = null; }
  }

  // New world → new mountains.
  function reseedTerrain(k) { ridgeSeed = 11 + k * 71; buildRidges(ridgeSeed); }

  function wrap(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  }

  // ----------------------------------------------------------
  // Main draw
  // ----------------------------------------------------------
  function render(state, nowMs) {
    const obs = P.observe(state.sys);
    const cl = state.cl;
    const T = cl.tempC;
    curChaos = cl.eraType === 'chaotic';   // chaotic skies rain more debris
    const horizon = H * 0.72;

    let brightest = obs.suns[0];
    for (const o of obs.suns) if (o.flux > brightest.flux) brightest = o;
    viewDir += wrap(brightest.dir - viewDir) * 0.02;

    let fluxVis = 0;
    const sunsView = [];
    for (const o of obs.suns) {
      const off = wrap(o.dir - viewDir);
      const x = W / 2 + (off / (Math.PI * 0.55)) * (W / 2);
      // Integer harmonic ⇒ 2π-periodic in dir: no teleport at the ±π seam,
      // and aligned suns (a syzygy) share the same y — they visibly stack.
      const y = horizon - H * (0.32 + 0.14 * Math.sin(o.dir * 2));
      if (Math.abs(off) < Math.PI * 0.62) fluxVis += o.flux;
      sunsView.push({ o, x, y, off });
    }
    // Frame delta for frame-rate-independent juice.
    const dt = U.clamp((nowMs - lastFrameMs) || 16, 0, 100) / 1000;
    lastFrameMs = nowMs;

    // Eased sky brightness: fast-forward must not strobe.
    brightSm += (U.clamp(Math.pow(fluxVis / 1.2, 0.5), 0, 1) - brightSm) * U.relax(dt, 0.25);
    const bright = brightSm;

    // Ease the syzygy levitation in and out.
    const liftTarget = obs.alignSpread < 0.12 ? 1 : 0;
    syzygyLift += (liftTarget - syzygyLift) * 0.04;
    if (syzygyLift < 0.01) syzygyLift = 0;

    // Screen shake: squared trauma, smooth noise, decays in real time.
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

  // ----------------------------------------------------------
  // Sky
  // ----------------------------------------------------------
  function skyPalette(bright, T) {
    const heat = U.clamp((T + 60) / 160, 0, 1);
    const mix = (a, b, t) => a + (b - a) * t;
    // zenith / mid / horizon triplets, cold→hot, night→day
    const zen = [mix(6, mix(26, 120, heat), bright),
                 mix(8, mix(60, 90, heat), bright),
                 mix(18, mix(140, 90, heat), bright)];
    const mid = [mix(10, mix(70, 200, heat), bright),
                 mix(12, mix(110, 140, heat), bright),
                 mix(24, mix(180, 110, heat), bright)];
    const hor = [mix(16, mix(150, 255, heat), bright),
                 mix(18, mix(170, 170, heat), bright),
                 mix(34, mix(210, 90, heat), bright)];
    return { zen, mid, hor };
  }
  const rgb = (c, a?) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')';

  function drawSky(bright, T, nowMs, sunsView, horizon) {
    const p = skyPalette(bright, T);
    const g = ctx.createLinearGradient(0, 0, 0, horizon * 1.05);
    g.addColorStop(0, rgb(p.zen));
    g.addColorStop(0.55, rgb(p.mid));
    g.addColorStop(1, rgb(p.hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const starA = U.clamp(0.9 - bright * 1.7, 0, 0.9);
    if (starA > 0.02) {
      // Milky-way band.
      ctx.save();
      ctx.globalAlpha = starA * 0.5;
      const mg = ctx.createLinearGradient(0, 0, W, horizon * 0.9);
      mg.addColorStop(0, 'rgba(120,140,190,0)');
      mg.addColorStop(0.45, 'rgba(150,165,210,0.10)');
      mg.addColorStop(0.55, 'rgba(190,180,220,0.16)');
      mg.addColorStop(0.65, 'rgba(150,165,210,0.10)');
      mg.addColorStop(1, 'rgba(120,140,190,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, horizon);
      // Stars.
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(nowMs / 900 + s.tw);
        ctx.globalAlpha = starA * tw * s.b;
        ctx.fillStyle = '#dce8ff';
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

    // Aurora in deep cold.
    if (T < -55 && bright < 0.35) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 2; band++) {
        const baseY = H * (0.12 + band * 0.1);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) {
          const y = baseY + Math.sin(x * 0.004 + nowMs / (2400 + band * 700)) * 34
                  + Math.sin(x * 0.013 - nowMs / 1700) * 12;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
        const ag = ctx.createLinearGradient(0, 0, 0, H * 0.4);
        ag.addColorStop(0, 'rgba(40,255,170,0)');
        ag.addColorStop(1, band ? 'rgba(60,210,255,0.05)' : 'rgba(40,255,170,0.07)');
        ctx.fillStyle = ag;
        ctx.fill();
      }
      ctx.restore();
    }

    // Per-sun horizon scattering glow.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sv of sunsView) {
      if (sv.o.d > C.consts.DISC_DIST * 1.4) continue;
      const closeness = U.clamp(1.6 / sv.o.d, 0, 1.4);
      const gg = ctx.createRadialGradient(sv.x, horizon, 0, sv.x, horizon, W * 0.32);
      gg.addColorStop(0, 'rgba(255,170,90,' + (0.14 * closeness) + ')');
      gg.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(0, 0, W, horizon + 4);
    }
    ctx.restore();
  }

  function maybeShootingStar(nowMs, starA) {
    if (!shootingStar && Math.random() < 0.0012) {
      shootingStar = { x: Math.random() * W, y: Math.random() * H * 0.3,
                       vx: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5),
                       vy: 2 + Math.random() * 2, life: 1 };
    }
    if (shootingStar) {
      const s = shootingStar;
      ctx.save();
      ctx.globalAlpha = starA * s.life;
      ctx.strokeStyle = '#eaf2ff'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 6, s.y - s.vy * 6);
      ctx.stroke();
      ctx.restore();
      s.x += s.vx; s.y += s.vy; s.life -= 0.025;
      if (s.life <= 0) shootingStar = null;
    }
  }

  // Meteor showers — occasional bursts of streaks from a radiant point,
  // more frequent under a chaotic sky. Purely cosmetic.
  function drawMeteorShower(nowMs, starA) {
    if (starA < 0.06) { meteors.length = 0; return; }
    if (nowMs > nextShower) {
      nextShower = nowMs + (curChaos ? 26000 : 52000) + Math.random() * 45000;
      showerUntil = nowMs + 3000 + Math.random() * 3500;
      radiantX = Math.random() * W; radiantY = Math.random() * H * 0.26;
    }
    if (nowMs < showerUntil && Math.random() < 0.5 && meteors.length < 42) {
      const dir = radiantX < W / 2 ? 1 : -1;
      meteors.push({ x: radiantX + (Math.random() - 0.5) * W * 0.5,
                     y: radiantY + (Math.random() - 0.5) * H * 0.12,
                     vx: dir * (5 + Math.random() * 6), vy: 3 + Math.random() * 4,
                     life: 1, len: 5 + Math.random() * 5 });
    }
    if (!meteors.length) return;
    ctx.save();
    ctx.strokeStyle = '#eaf2ff'; ctx.lineCap = 'round';
    for (const m of meteors) {
      ctx.globalAlpha = starA * m.life * 0.9;
      ctx.lineWidth = 1.4 * m.life;
      ctx.beginPath(); ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * m.len, m.y - m.vy * m.len); ctx.stroke();
      m.x += m.vx; m.y += m.vy; m.life -= 0.022;
    }
    ctx.restore();
    meteors = meteors.filter(m => m.life > 0 && m.x > -60 && m.x < W + 60 && m.y < H + 60);
  }

  // ----------------------------------------------------------
  // Suns
  // ----------------------------------------------------------
  function drawSuns(sunsView, horizon, bright) {
    const order = [...sunsView].sort((a, b) => b.o.d - a.o.d);
    for (const sv of order) {
      const { o, x, y } = sv;
      if (x < -W * 0.25 || x > W * 1.25) continue;
      const isDisc = o.d < C.consts.DISC_DIST;
      if (!isDisc) {
        // Flying star.
        const a = U.clamp(2.4 / o.d, 0.22, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 14);
        gg.addColorStop(0, 'rgba(255,255,255,' + a + ')');
        gg.addColorStop(0.25, 'rgba(200,220,255,' + a * 0.5 + ')');
        gg.addColorStop(1, 'rgba(180,200,255,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
        ctx.globalAlpha = a * 0.75;
        ctx.strokeStyle = 'rgba(220,235,255,0.9)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y);
        ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9);
        ctx.stroke();
        ctx.restore();
      } else {
        const rad = U.clamp(o.angSize * 2200, 6, Math.min(W, H) * 0.55);
        const closeness = U.clamp(1 - o.d / C.consts.DISC_DIST, 0, 1);
        const cg = Math.round(U.lerp(246, 130, Math.pow(closeness, 1.6)));
        const cb = Math.round(U.lerp(218, 62, Math.pow(closeness, 1.3)));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Outer corona.
        const halo = ctx.createRadialGradient(x, y, rad * 0.5, x, y, rad * 3.2);
        halo.addColorStop(0, `rgba(255,${cg},${Math.round(cb * 0.7)},0.55)`);
        halo.addColorStop(0.4, `rgba(255,${Math.round(cg * 0.85)},${Math.round(cb * 0.5)},0.16)`);
        halo.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(x, y, rad * 3.2, 0, 7); ctx.fill();
        // Lens streak.
        const streak = ctx.createLinearGradient(x - rad * 5, y, x + rad * 5, y);
        streak.addColorStop(0, 'rgba(255,220,170,0)');
        streak.addColorStop(0.5, `rgba(255,${cg},${cb},0.28)`);
        streak.addColorStop(1, 'rgba(255,220,170,0)');
        ctx.fillStyle = streak;
        ctx.fillRect(x - rad * 5, y - Math.max(1.2, rad * 0.05), rad * 10, Math.max(2.4, rad * 0.1));
        ctx.restore();
        // Disc with limb darkening (normal composite so it has a body).
        const disc = ctx.createRadialGradient(x - rad * 0.25, y - rad * 0.25, 0, x, y, rad);
        disc.addColorStop(0, '#ffffff');
        disc.addColorStop(0.55, `rgb(255,${cg},${cb})`);
        disc.addColorStop(1, `rgb(${Math.round(255 * 0.92)},${Math.round(cg * 0.72)},${Math.round(cb * 0.55)})`);
        ctx.fillStyle = disc;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();

        // Sunspots crawl across big discs (seeded per sun, slow drift).
        if (rad > 26) {
          ctx.save();
          ctx.beginPath(); ctx.arc(x, y, rad * 0.96, 0, 7); ctx.clip();
          ctx.fillStyle = `rgba(120,50,20,0.32)`;
          for (let k = 0; k < 3; k++) {
            const px = x + Math.cos(o.i * 2.7 + k * 2.3) * rad * (0.25 + k * 0.18);
            const py = y + Math.sin(o.i * 1.9 + k * 3.1) * rad * (0.2 + k * 0.14);
            ctx.beginPath();
            ctx.ellipse(px, py, rad * (0.07 - k * 0.012), rad * (0.045 - k * 0.008), k, 0, 7);
            ctx.fill();
          }
          // chromosphere rim
          ctx.strokeStyle = `rgba(255,${Math.max(90, cg - 60)},${Math.max(30, cb - 60)},0.5)`;
          ctx.lineWidth = Math.max(1.5, rad * 0.03);
          ctx.beginPath(); ctx.arc(x, y, rad * 0.985, 0, 7); ctx.stroke();
          ctx.restore();
        }

        // Lens ghosts: faint discs along the sun→screen-center axis.
        if (o.flux > 0.35) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const cxs = W / 2, cys = H / 2;
          for (const k of [1.55, 2.1, 2.75]) {
            const gx = x + (cxs - x) * k, gy = y + (cys - y) * k;
            const gr = Math.max(3, rad * 0.13 * (3.2 - k));
            const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            gg.addColorStop(0, `rgba(255,${cg},${cb},${0.05 * (3.4 - k)})`);
            gg.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.fillStyle = gg;
            ctx.beginPath(); ctx.arc(gx, gy, gr, 0, 7); ctx.fill();
          }
          ctx.restore();
        }
      }
    }
  }

  // ----------------------------------------------------------
  // Terrain & structures
  // ----------------------------------------------------------
  // World biomes (2D) — base ground colour per world (0..255 at full light).
  const BIOMES2 = [
    { name: 'the Ashen Waste',     g: [120, 100, 74] },
    { name: 'the Frostpan',        g: [150, 165, 185] },
    { name: 'the Rustlands',       g: [150, 66, 44] },
    { name: 'the Salt Flats',      g: [185, 178, 160] },
    { name: 'the Basalt Plain',    g: [56, 56, 66] },
    { name: 'the Verdant Remnant', g: [96, 112, 64] },
  ];
  let biome2 = BIOMES2[0];
  function setBiome2d(worldIndex) {
    biome2 = BIOMES2[((worldIndex % BIOMES2.length) + BIOMES2.length) % BIOMES2.length];
    return biome2.name;
  }

  function groundColor(T, bright) {
    if (T < -15) {
      const c = U.lerp(36, 185, U.clamp((-T - 15) / 80, 0, 1));
      return [c * 0.9, c * 0.96, c * 1.05];
    }
    const heat = U.clamp((T - 45) / 250, 0, 1);
    const bf = 0.5 + bright * 0.6;
    const g = biome2.g;
    return [g[0] * bf + heat * 95, g[1] * bf - heat * 6, g[2] * bf - heat * 8];
  }

  function drawTerrain(state, horizon, T, bright, sunsView, nowMs) {
    const civ = state.civ;
    const p = skyPalette(bright, T);

    // Parallax ridges, fog-blended toward the sky color.
    for (let l = 0; l < ridges.length; l++) {
      const r = ridges[l];
      const fog = [0.62, 0.4, 0.2][l];
      const tone = [
        U.lerp(10, p.hor[0], fog),
        U.lerp(12, p.hor[1], fog),
        U.lerp(20, p.hor[2], fog)];
      ctx.fillStyle = rgb(tone);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      const n = r.pts.length;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * W;
        const y = horizon - H * r.y - U.clamp(r.pts[i], 0, 1) * H * r.h;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, horizon);
      ctx.closePath(); ctx.fill();
    }

    // The plain.
    const gc = groundColor(T, bright);
    const gg = ctx.createLinearGradient(0, horizon, 0, H);
    gg.addColorStop(0, rgb([gc[0] * 1.15, gc[1] * 1.15, gc[2] * 1.15]));
    gg.addColorStop(0.25, rgb(gc));
    gg.addColorStop(1, rgb([gc[0] * 0.35, gc[1] * 0.35, gc[2] * 0.35]));
    ctx.fillStyle = gg;
    ctx.fillRect(0, horizon, W, H - horizon);

    // Sun glow pooling on the ground.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sv of sunsView) {
      if (sv.o.d > C.consts.DISC_DIST) continue;
      const closeness = U.clamp(1.3 / sv.o.d, 0, 1.3);
      const rg = ctx.createRadialGradient(sv.x, horizon + 8, 0, sv.x, horizon + 8, W * 0.3);
      rg.addColorStop(0, 'rgba(255,180,110,' + 0.10 * closeness + ')');
      rg.addColorStop(1, 'rgba(255,160,90,0)');
      ctx.fillStyle = rg;
      ctx.save();
      ctx.translate(sv.x, horizon + 10);
      ctx.scale(1, 0.22);
      ctx.translate(-sv.x, -(horizon + 10));
      ctx.beginPath(); ctx.arc(sv.x, horizon + 10, W * 0.3, 0, 7); ctx.fill();
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

  // Two-faced pyramid lit by the brightest visible sun.
  function drawPyramid(civ, horizon, sunsView, bright) {
    const baseX = W * 0.18, baseW = Math.min(W * 0.17, 250);
    const h = baseW * 0.85;
    const x0 = baseX - baseW / 2, x1 = baseX + baseW / 2;
    let lit = 0;   // -1 left, +1 right
    let best = 0;
    for (const sv of sunsView) {
      if (sv.o.flux > best) { best = sv.o.flux; lit = sv.x < baseX ? -1 : 1; }
    }
    const dark = 'rgba(9,11,17,0.96)';
    const lightFace = 'rgba(' + Math.round(26 + bright * 60) + ',' +
      Math.round(22 + bright * 44) + ',' + Math.round(20 + bright * 30) + ',0.96)';

    if (civ.ageIdx < 4) {
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        const f2 = (i + 1) / steps;
        const wA = baseW * (1 - (i / steps) * 0.78);
        ctx.fillStyle = dark;
        ctx.fillRect(baseX - wA / 2, horizon - h * f2, wA, h / steps + 1);
        ctx.fillStyle = lit > 0 ? lightFace : dark;
        ctx.fillRect(baseX + (lit > 0 ? 0 : -wA / 2), horizon - h * f2, wA / 2, h / steps + 1);
      }
    } else {
      // Left face / right face.
      ctx.fillStyle = lit < 0 ? lightFace : dark;
      ctx.beginPath();
      ctx.moveTo(x0, horizon); ctx.lineTo(baseX, horizon - h); ctx.lineTo(baseX, horizon);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = lit > 0 ? lightFace : dark;
      ctx.beginPath();
      ctx.moveTo(baseX, horizon); ctx.lineTo(baseX, horizon - h); ctx.lineTo(x1, horizon);
      ctx.closePath(); ctx.fill();
      if (civ.ageIdx < 8) {
        ctx.fillStyle = dark;
        ctx.fillRect(baseX - 9, horizon - h - 10, 18, 12);
      } else {
        ctx.strokeStyle = dark; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(baseX, horizon - h); ctx.lineTo(baseX, horizon - h - 26); ctx.stroke();
        ctx.fillStyle = 'rgba(255,90,90,' + (0.5 + 0.5 * Math.sin(performance.now() / 500)) + ')';
        ctx.beginPath(); ctx.arc(baseX, horizon - h - 28, 2, 0, 7); ctx.fill();
        // City skyline with windows.
        for (let i = 0; i < 9; i++) {
          const bx = baseX + baseW * 0.62 + i * 15;
          const bh = 16 + ((i * 37) % 34);
          ctx.fillStyle = dark;
          ctx.fillRect(bx, horizon - bh, 10, bh);
          if (bright < 0.45) {
            ctx.fillStyle = 'rgba(255,214,120,0.75)';
            for (let wY = 4; wY < bh - 3; wY += 6) {
              if (((i * 13 + wY) % 17) < 9) ctx.fillRect(bx + 2, horizon - bh + wY, 2, 2);
              if (((i * 7 + wY) % 13) < 6) ctx.fillRect(bx + 6, horizon - bh + wY, 2, 2);
            }
          }
        }
      }
    }
  }

  function drawDehydratories(civ, horizon, bright) {
    const n = U.clamp(2 + civ.ageIdx, 3, 9);
    for (let i = 0; i < n; i++) {
      const x = W * 0.70 + i * 27;
      const r = 9 + (i % 3) * 2;
      const g = ctx.createLinearGradient(x - r, horizon, x + r, horizon);
      g.addColorStop(0, 'rgba(10,13,19,0.95)');
      g.addColorStop(1, 'rgba(' + Math.round(24 + bright * 40) + ',' +
        Math.round(22 + bright * 30) + ',' + Math.round(24 + bright * 24) + ',0.95)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, horizon + 6, r, Math.PI, 0); ctx.fill();
    }
  }

  // ----------------------------------------------------------
  // Ground detail: rocks, grass that lives and dies with the
  // climate, plough furrows once agriculture exists, cracked
  // earth in killing heat.
  // ----------------------------------------------------------
  function drawGroundDetail(civ, horizon, T, bright, nowMs) {
    const depthSpan = H - horizon;
    // Rocks.
    ctx.fillStyle = 'rgba(8,10,14,0.5)';
    for (const r of rocksFg) {
      const y = horizon + 8 + r.d * depthSpan * 0.85;
      const s = r.s * (0.7 + r.d * 1.8);
      ctx.beginPath(); ctx.ellipse(r.x * W, y, s, s * 0.55, 0, 0, 7); ctx.fill();
    }
    // Grass — alive only in a survivable climate, sways in the wind.
    if (T > -25 && T < 60) {
      const vigor = U.clamp(1 - Math.abs(T - 16) / 45, 0.15, 1);
      const gC = Math.round(70 + 60 * vigor), gR = Math.round(70 + 30 * (1 - vigor));
      ctx.strokeStyle = `rgba(${gR},${gC},48,0.55)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const t of tufts) {
        const y = horizon + 6 + t.d * depthSpan * 0.8;
        const s = t.s * (0.6 + t.d * 1.6) * (0.5 + vigor * 0.5);
        const sway = Math.sin(nowMs / 700 + t.ph) * s * 0.35;
        const x = t.x * W;
        ctx.moveTo(x, y); ctx.lineTo(x + sway, y - s);
        ctx.moveTo(x + 2, y); ctx.lineTo(x + 2 + sway * 0.8, y - s * 0.75);
      }
      ctx.stroke();
    }
    // Plough furrows converge on the granary fields (agriculture, age ≥ 2).
    if (civ.ageIdx >= 2 && T > -25 && T < 60) {
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(W * (0.30 + i * 0.10), H);
        ctx.lineTo(W * (0.40 + i * 0.018), horizon + depthSpan * 0.18);
      }
      ctx.stroke();
    }
    // Cracked earth in killing heat.
    if (T > 60) {
      const a = U.clamp((T - 60) / 200, 0, 0.5);
      ctx.strokeStyle = `rgba(20,8,4,${a})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const r = rocksFg[i * 3 % rocksFg.length];
        let x = r.x * W, y = horizon + 14 + r.d * depthSpan * 0.8;
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (((i * 7 + k * 13) % 9) - 4) * 7;
          y += 6 + ((i + k) % 4) * 5;
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  // ----------------------------------------------------------
  // The civilization itself — the skyline is a tech tree.
  //   0–2  huts and night fires
  //   3–4  the stepped pyramid and a walled town
  //   5–7  smooth pyramid, candle-lit town, an observatory
  //   8–9  factories, smoke, power poles, the electric grid
  //  10–11 glass towers, radio mast, cooling tower
  //   12   searchlights sweeping the night over the fleet yards
  // ----------------------------------------------------------
  function drawCivilization(civ, horizon, T, bright, sunsView, nowMs) {
    const age = civ.ageIdx;
    const dark = bright < 0.38;

    // Huts and night fires (the first ages; the huts never quite vanish).
    if (age <= 4) {
      ctx.fillStyle = 'rgba(10,12,17,0.95)';
      for (let i = 0; i < 5 - Math.min(3, age); i++) {
        const x = W * (0.36 + i * 0.045), s = 11 - i;
        ctx.beginPath();
        ctx.moveTo(x - s, horizon + 4); ctx.lineTo(x, horizon - s);
        ctx.lineTo(x + s, horizon + 4);
        ctx.closePath(); ctx.fill();
        if (dark && age <= 2) {
          const f = 0.5 + 0.5 * Math.sin(nowMs / 90 + i * 7);
          const fg = ctx.createRadialGradient(x, horizon + 2, 0, x, horizon + 2, 9 + f * 3);
          fg.addColorStop(0, 'rgba(255,170,70,' + (0.35 + f * 0.2) + ')');
          fg.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(x, horizon + 2, 12, 0, 7); ctx.fill();
          ctx.restore();
        }
      }
    }

    // Late-age skyline first (it sits furthest back). Towers rise one by
    // one as science accumulates within the atomic+ ages.
    if (age >= 10) {
      const nB = U.clamp(Math.floor((civ.tech - 8110) / 450) + 1, 1, townB.length);
      ctx.fillStyle = 'rgba(9,11,16,0.88)';
      for (const b of townB.slice(0, nB)) {
        const x = W * (0.18 + b.dx);
        ctx.fillRect(x, horizon - b.h, b.w, b.h);
        if (dark) {
          ctx.fillStyle = 'rgba(255,214,130,0.7)';
          for (let wy = 5; wy < b.h - 4; wy += 7)
            for (let wx = 2; wx < b.w - 2; wx += 5)
              if (((wx * 13 + wy * 7 + b.win) % 11) < 5) ctx.fillRect(x + wx, horizon - b.h + wy, 1.6, 2.2);
          ctx.fillStyle = 'rgba(9,11,16,0.88)';
        }
        if (age >= 11 && b.h > 70) {  // aviation beacons
          const blink = Math.sin(nowMs / 350 + b.dx * 80) > 0.4;
          if (blink) {
            ctx.fillStyle = 'rgba(255,80,80,0.95)';
            ctx.fillRect(x + b.w / 2 - 1, horizon - b.h - 4, 2, 2);
            ctx.fillStyle = 'rgba(9,11,16,0.88)';
          }
        }
      }
    }

    // Walled town (from the classical ages on). Houses are built one at a
    // time as knowledge grows — the skyline IS the tech tree.
    if (age >= 3) {
      const nA = U.clamp(Math.floor((civ.tech - 190) / 110) + 2, 2, townA.length);
      ctx.fillStyle = 'rgba(10,12,18,0.94)';
      for (const b of townA.slice(0, nA)) {
        const x = W * (0.16 + b.dx);
        const h = b.h * (age >= 8 ? 1.25 : 1);
        ctx.fillRect(x, horizon - h, b.w, h);
        if (dark && age >= 5) {  // candles, then electric light
          ctx.fillStyle = age >= 9 ? 'rgba(255,220,140,0.75)' : 'rgba(255,170,80,0.35)';
          for (let wy = 4; wy < h - 3; wy += 6)
            if (((wy * 7 + b.win) % 9) < (age >= 9 ? 5 : 2))
              ctx.fillRect(x + 2 + ((wy * 5 + b.win) % Math.max(2, b.w - 5)), horizon - h + wy, 1.6, 2);
          ctx.fillStyle = 'rgba(10,12,18,0.94)';
        }
      }
    }

    drawPyramid(civ, horizon, sunsView, bright);

    // Observatory on its rise (the age of measurement).
    if (age >= 5) {
      const ox = W * 0.585, oy = horizon - 16;
      ctx.fillStyle = 'rgba(9,11,16,0.95)';
      ctx.beginPath(); ctx.ellipse(ox, horizon + 2, 34, 9, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(ox, oy + 10, 13, Math.PI, 0); ctx.fill();
      ctx.fillRect(ox - 13, oy + 10, 26, 8);
      ctx.strokeStyle = 'rgba(9,11,16,0.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ox, oy + 6); ctx.lineTo(ox + 9, oy - 6); ctx.stroke();
    }

    // Factories and smoke (industry).
    if (age >= 8) {
      const fx = W * 0.475;
      ctx.fillStyle = 'rgba(10,12,17,0.95)';
      ctx.fillRect(fx, horizon - 18, 44, 18);
      ctx.fillRect(fx + 6, horizon - 34, 5, 16);
      ctx.fillRect(fx + 26, horizon - 40, 5, 22);
      // smoke plumes (stateless particles parameterized by time)
      ctx.save();
      for (let i = 0; i < 10; i++) {
        const t = ((nowMs / 4200) + i / 10) % 1;
        const sx = fx + (i % 2 ? 8.5 : 28.5) + Math.sin(t * 6 + i) * 6 * t;
        const sy = horizon - (i % 2 ? 34 : 40) - t * 52;
        ctx.fillStyle = 'rgba(120,120,128,' + (0.16 * (1 - t)) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, 2 + t * 7, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    // Power poles with sagging wire (the electric age).
    if (age >= 9) {
      ctx.strokeStyle = 'rgba(8,10,14,0.85)'; ctx.lineWidth = 1.5;
      let prevX = null, prevY = null;
      for (let i = 0; i < 4; i++) {
        const px = W * (0.56 + i * 0.05), ph = 26 - i * 2;
        ctx.beginPath(); ctx.moveTo(px, horizon + 4); ctx.lineTo(px, horizon - ph); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px - 5, horizon - ph + 4); ctx.lineTo(px + 5, horizon - ph + 4); ctx.stroke();
        if (prevX != null) {
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.quadraticCurveTo((prevX + px) / 2, prevY + 7, px, horizon - ph + 4);
          ctx.stroke();
        }
        prevX = px; prevY = horizon - ph + 4;
      }
    }

    // Radio mast + cooling tower (the atomic age).
    if (age >= 10) {
      const mx = W * 0.545, mh = Math.min(H * 0.16, 120);
      ctx.strokeStyle = 'rgba(8,10,14,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(mx, horizon); ctx.lineTo(mx, horizon - mh);
      ctx.moveTo(mx - mh * 0.22, horizon); ctx.lineTo(mx, horizon - mh * 0.62);
      ctx.moveTo(mx + mh * 0.22, horizon); ctx.lineTo(mx, horizon - mh * 0.62);
      ctx.stroke();
      if (Math.sin(nowMs / 480) > 0) {
        ctx.fillStyle = 'rgba(255,70,70,0.95)';
        ctx.beginPath(); ctx.arc(mx, horizon - mh - 2, 1.8, 0, 7); ctx.fill();
      }
      // cooling tower with drifting steam
      const cx2 = W * 0.51;
      ctx.fillStyle = 'rgba(10,12,17,0.95)';
      ctx.beginPath();
      ctx.moveTo(cx2 - 12, horizon);
      ctx.bezierCurveTo(cx2 - 7, horizon - 16, cx2 - 8, horizon - 22, cx2 - 7, horizon - 28);
      ctx.lineTo(cx2 + 7, horizon - 28);
      ctx.bezierCurveTo(cx2 + 8, horizon - 22, cx2 + 7, horizon - 16, cx2 + 12, horizon);
      ctx.closePath(); ctx.fill();
      for (let i = 0; i < 5; i++) {
        const t = ((nowMs / 5200) + i / 5) % 1;
        ctx.fillStyle = 'rgba(190,196,206,' + (0.13 * (1 - t)) + ')';
        ctx.beginPath();
        ctx.arc(cx2 + Math.sin(t * 5 + i * 2) * 8 * t, horizon - 30 - t * 42, 3 + t * 8, 0, 7);
        ctx.fill();
      }
    }

    // Searchlights over the fleet yards (the final age, at night).
    if (age >= 12 && dark) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const bx = W * (0.07 + i * 0.05);
        const ang = -Math.PI / 2 + Math.sin(nowMs / (3100 + i * 900) + i * 2) * 0.5;
        const len = H * 0.55;
        const ex = bx + Math.cos(ang) * len, ey = horizon + Math.sin(ang) * len;
        const lg = ctx.createLinearGradient(bx, horizon, ex, ey);
        lg.addColorStop(0, 'rgba(190,215,255,0.10)');
        lg.addColorStop(1, 'rgba(190,215,255,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(bx, horizon);
        ctx.lineTo(ex - 14, ey); ctx.lineTo(ex + 14, ey);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    drawDehydratories(civ, horizon, bright);
  }

  function drawLake(state, horizon, T, sunsView, nowMs) {
    const cx = W * 0.88, cy = horizon + Math.max(26, H * 0.05);
    const rx = Math.min(W * 0.09, 130), ry = rx * 0.28;
    let fill;
    if (T < -2) fill = 'rgba(200,222,240,0.9)';
    else if (T > 70) fill = 'rgba(130,62,40,0.85)';
    else fill = 'rgba(34,76,118,0.9)';
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
    if (T >= -2 && T <= 70) {
      // Sun reflections.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.clip();
      for (const sv of sunsView) {
        if (sv.o.d > C.consts.DISC_DIST || Math.abs(sv.x - cx) > rx * 2.2) continue;
        const rg = ctx.createRadialGradient(sv.x, cy, 0, sv.x, cy, rx * 0.8);
        rg.addColorStop(0, 'rgba(255,220,150,0.5)');
        rg.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      }
      // Ripples.
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#dcebff';
      for (let i = 0; i < 5; i++) {
        const lx = cx - rx * 0.7 + ((nowMs / 36 + i * 53) % (rx * 1.4));
        ctx.fillRect(lx, cy - 2 + i * 2, 16, 0.8);
      }
      ctx.restore();
    }
  }

  function drawPendulum(horizon, nowMs) {
    const px = W * 0.52, h = Math.min(H * 0.2, 170);
    ctx.strokeStyle = 'rgba(8,10,15,0.95)'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px - h * 0.4, horizon); ctx.lineTo(px, horizon - h);
    ctx.lineTo(px + h * 0.4, horizon);
    ctx.stroke();
    const ang = Math.sin(nowMs / 1400) * 0.55;
    const bx = px + Math.sin(ang) * h * 0.62, by = horizon - h + Math.cos(ang) * h * 0.62;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(px, horizon - h); ctx.lineTo(bx, by); ctx.stroke();
    const bg = ctx.createRadialGradient(bx - 2, by - 2, 0, bx, by, 8);
    bg.addColorStop(0, 'rgba(70,80,100,1)');
    bg.addColorStop(1, 'rgba(8,10,15,1)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.fill();
  }

  function drawFleetWorks(civ, horizon, nowMs) {
    const gx = W * 0.06;
    ctx.strokeStyle = 'rgba(8,10,15,0.96)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const x = gx + i * 22;
      ctx.beginPath(); ctx.moveTo(x, horizon); ctx.lineTo(x, horizon - 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, horizon - 44); ctx.lineTo(x + 12, horizon - 38); ctx.stroke();
    }
    if (civ.fleet.building) {
      const t = (nowMs % 2600) / 2600;
      const y = horizon - t * H * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const fg = ctx.createRadialGradient(gx + 22, y, 0, gx + 22, y, 10);
      fg.addColorStop(0, 'rgba(255,230,170,1)');
      fg.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(gx + 22, y, 10, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,110,0.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(gx + 22, y + 6); ctx.lineTo(gx + 22, y + 26); ctx.stroke();
      ctx.restore();
    }
  }

  // ----------------------------------------------------------
  // The people of Trisolaris: small articulated figures with a
  // walk cycle. They march to the dehydratories on a dehydrate
  // order (leaving rolled skins), stream back from the lake on
  // rehydration — and during a syzygy they float helplessly off
  // the ground, as in the book.
  // ----------------------------------------------------------
  let syzygyLift = 0;   // eased 0..1, set per frame in render()

  // A proportioned human: skin, hair, a face on near rows, and clothing
  // that follows the civilization's age — robes and straw hats early,
  // tunics and trousers in the middle ages, coats late.
  // `s` is the half-unit scale: total height ≈ 3.2·s·build.
  function drawFigure(p, x, y, s, age, walking, phase, lifted, bright, action) {
    s *= p.build;
    const Hp = s * 3.2;                  // full height
    const headR = Hp * 0.135;
    const legL = Hp * 0.46;
    const torsoL = Hp * 0.40;
    const hipY = y - legL;
    const shoulderY = hipY - torsoL;
    const headY = shoulderY - headR * 1.15;
    const sway = walking ? Math.sin(phase) : 0;
    let tilt = lifted ? Math.sin(phase * 0.6) * 0.5 : 0;
    if (action === 'bend') tilt = 0.30 + Math.sin(phase * 2.2) * 0.14;   // working the soil
    const robed = age <= 4;
    const cloth = age >= 9 ? p.clothNew : p.clothOld;
    const shade = 1 - U.clamp(0.55 - bright * 0.6, 0, 0.5);   // dusk darkens cloth

    ctx.save();
    ctx.translate(x, y);
    if (tilt) ctx.rotate(tilt);
    ctx.translate(-x, -y);

    if (!lifted) {
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath(); ctx.ellipse(x, y + 1, Hp * 0.18, Hp * 0.05, 0, 0, 7); ctx.fill();
    }

    ctx.lineCap = 'round';

    if (robed) {
      // Long robe: a tapered gown from shoulders to ankles; feet peek out.
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.05, shoulderY);
      ctx.lineTo(x + headR * 1.05, shoulderY);
      ctx.lineTo(x + headR * 1.5 + sway * s * 0.18, y - 1);
      ctx.lineTo(x - headR * 1.5 + sway * s * 0.18, y - 1);
      ctx.closePath(); ctx.fill();
      // sleeves / hands
      ctx.strokeStyle = cloth; ctx.lineWidth = Math.max(1.2, headR * 0.7);
      ctx.beginPath();
      ctx.moveTo(x - headR * 0.7, shoulderY + 1);
      ctx.lineTo(x - headR * 1.3 - sway * s * 0.25, hipY);
      ctx.moveTo(x + headR * 0.7, shoulderY + 1);
      ctx.lineTo(x + headR * 1.3 + sway * s * 0.25, hipY);
      ctx.stroke();
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(x - headR * 1.3 - sway * s * 0.25, hipY + 1, headR * 0.32, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + headR * 1.3 + sway * s * 0.25, hipY + 1, headR * 0.32, 0, 7); ctx.fill();
      // feet
      ctx.fillStyle = '#1a140e';
      ctx.beginPath(); ctx.ellipse(x + sway * legL * 0.3, y, headR * 0.45, headR * 0.2, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - sway * legL * 0.3, y - (lifted ? s * 0.2 : 0), headR * 0.45, headR * 0.2, 0, 0, 7); ctx.fill();
    } else {
      // Trousered legs with a walk cycle.
      ctx.strokeStyle = age >= 9 ? '#1d242e' : '#3a3026';
      ctx.lineWidth = Math.max(1.2, headR * 0.62);
      ctx.beginPath();
      ctx.moveTo(x, hipY); ctx.lineTo(x + sway * legL * 0.42, y);
      ctx.moveTo(x, hipY); ctx.lineTo(x - sway * legL * 0.42, y - (lifted ? s * 0.2 : 0));
      ctx.stroke();
      // feet
      ctx.fillStyle = '#14100b';
      ctx.beginPath(); ctx.ellipse(x + sway * legL * 0.42, y, headR * 0.42, headR * 0.18, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - sway * legL * 0.42, y - (lifted ? s * 0.2 : 0), headR * 0.42, headR * 0.18, 0, 0, 7); ctx.fill();
      // torso: tunic / coat
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(x - headR * 0.95, shoulderY);
      ctx.lineTo(x + headR * 0.95, shoulderY);
      ctx.lineTo(x + headR * 0.8, hipY + 2);
      ctx.lineTo(x - headR * 0.8, hipY + 2);
      ctx.closePath(); ctx.fill();
      // belt
      ctx.fillStyle = 'rgba(20,15,10,0.8)';
      ctx.fillRect(x - headR * 0.8, hipY - 1, headR * 1.6, Math.max(1, headR * 0.18));
      // arms with sleeves and skin hands
      ctx.strokeStyle = cloth; ctx.lineWidth = Math.max(1.1, headR * 0.5);
      ctx.beginPath();
      if (lifted) {
        ctx.moveTo(x - headR * 0.7, shoulderY + 1); ctx.lineTo(x - headR * 1.5, shoulderY - headR * 1.3);
        ctx.moveTo(x + headR * 0.7, shoulderY + 1); ctx.lineTo(x + headR * 1.6, shoulderY - headR);
      } else {
        ctx.moveTo(x - headR * 0.7, shoulderY + 1); ctx.lineTo(x - sway * s * 0.4 - headR * 0.3, hipY);
        ctx.moveTo(x + headR * 0.7, shoulderY + 1); ctx.lineTo(x + sway * s * 0.4 + headR * 0.3, hipY);
      }
      ctx.stroke();
      ctx.fillStyle = p.skin;
      if (!lifted) {
        ctx.beginPath(); ctx.arc(x - sway * s * 0.4 - headR * 0.3, hipY + 1, headR * 0.28, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + sway * s * 0.4 + headR * 0.3, hipY + 1, headR * 0.28, 0, 7); ctx.fill();
      }
    }

    // ---- Duties: tools and gestures ----
    if (action === 'bend') {
      // hoe reaching the soil ahead
      ctx.strokeStyle = '#6e552f'; ctx.lineWidth = Math.max(1, headR * 0.22);
      ctx.beginPath();
      ctx.moveTo(x + headR * 0.9, hipY - headR * 0.2);
      ctx.lineTo(x + headR * 2.2, y + 1);
      ctx.stroke();
    } else if (action === 'hammer') {
      // mallet arm rising and striking
      const swing = Math.abs(Math.sin(phase * 3));
      const ax = x - headR * 0.7, ay = shoulderY + 1;
      const ex = ax - headR * 1.3, ey = ay + headR * 0.7 - swing * headR * 1.6;
      ctx.strokeStyle = cloth; ctx.lineWidth = Math.max(1.1, headR * 0.5);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#555e6a';
      ctx.fillRect(ex - headR * 0.45, ey - headR * 0.35, headR * 0.9, headR * 0.5);
    } else if (action === 'inspect') {
      // a hand raised to the brow, reading sky or seals
      ctx.strokeStyle = cloth; ctx.lineWidth = Math.max(1.1, headR * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + headR * 0.7, shoulderY + 1);
      ctx.lineTo(x + headR * 0.95, headY + headR * 0.2);
      ctx.stroke();
    } else if (action === 'carry') {
      // shoulder-pole with two water buckets, swaying with the stride
      const sw2 = Math.sin(phase) * headR * 0.3;
      ctx.strokeStyle = '#6e552f'; ctx.lineWidth = Math.max(1, headR * 0.2);
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.6, shoulderY - headR * 0.1 + sw2 * 0.3);
      ctx.lineTo(x + headR * 1.6, shoulderY - headR * 0.1 - sw2 * 0.3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(40,32,20,0.85)'; ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.5, shoulderY); ctx.lineTo(x - headR * 1.5, shoulderY + headR * 0.6 + sw2 * 0.4);
      ctx.moveTo(x + headR * 1.5, shoulderY); ctx.lineTo(x + headR * 1.5, shoulderY + headR * 0.6 - sw2 * 0.4);
      ctx.stroke();
      ctx.fillStyle = '#3e4651';
      ctx.fillRect(x - headR * 1.75, shoulderY + headR * 0.6 + sw2 * 0.4, headR * 0.5, headR * 0.55);
      ctx.fillRect(x + headR * 1.25, shoulderY + headR * 0.6 - sw2 * 0.4, headR * 0.5, headR * 0.55);
    }

    // Neck + head with skin, hair, and (when near enough) a face.
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - headR * 0.22, headY + headR * 0.7, headR * 0.44, headR * 0.55);
    ctx.beginPath(); ctx.arc(x, headY, headR, 0, 7); ctx.fill();
    // hair: a cap over the crown
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(x, headY - headR * 0.12, headR * 0.96, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    if (headR >= 2.6) {
      // face: eyes + mouth, readable on the near rows
      ctx.fillStyle = '#231a12';
      ctx.fillRect(x - headR * 0.42, headY - headR * 0.08, headR * 0.22, headR * 0.16);
      ctx.fillRect(x + headR * 0.20, headY - headR * 0.08, headR * 0.22, headR * 0.16);
      ctx.fillStyle = 'rgba(120,60,40,0.85)';
      ctx.fillRect(x - headR * 0.18, headY + headR * 0.42, headR * 0.36, Math.max(0.8, headR * 0.1));
    }
    // conical straw hat in the early ages
    if (p.hat && age <= 6) {
      ctx.fillStyle = '#9a7c43';
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.45, headY - headR * 0.25);
      ctx.lineTo(x, headY - headR * 1.7);
      ctx.lineTo(x + headR * 1.45, headY - headR * 0.25);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawCrowd(state, horizon, nowMs) {
    const civ = state.civ;
    const domeX = 0.715, lakeX = 0.84;

    // Rolled skins stored by the dehydratories — one prop per ~kilo-soul.
    const rolls = Math.round(U.clamp(Math.sqrt(Math.max(civ.popD, 0)) * 5.5, 0, 42));
    for (let i = 0; i < rolls; i++) {
      const rx = W * (0.695 + (i % 14) * 0.0075);
      const ry = horizon + 14 + Math.floor(i / 14) * 7;
      ctx.fillStyle = 'rgba(196,184,158,0.82)';
      ctx.beginPath(); ctx.ellipse(rx, ry, 4.2, 1.7, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(120,108,86,0.6)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(rx - 3, ry); ctx.lineTo(rx + 3, ry); ctx.stroke();
    }

    if (civ.dormant) return;
    const visible = Math.round(U.clamp(Math.sqrt(Math.max(civ.popH, 0)) * 8.5, 0, 84));
    const brightNow = brightSm;
    const dtMs = U.clamp(nowMs - ((drawCrowd as any)._last || nowMs), 0, 100);
    (drawCrowd as any)._last = nowMs;
    const age = civ.ageIdx;
    const WALK = 0.000052;        // normalized x per ms — matched to the leg cycle

    for (let i = 0; i < visible; i++) {
      const p = crowd[i];
      let walking = false, action = null;

      if (civ.order === 'dehydrate') {
        walking = Math.abs(domeX - p.x) > 0.005;
        if (walking) p.x += Math.sign(domeX - p.x) * WALK * 1.5 * p.drift * dtMs;
      } else if (civ.order === 'rehydrate') {
        walking = true;
        if (p.x > 0.80) p.x -= WALK * p.drift * dtMs;            // step out of the lake
        else if (Math.abs(0.46 - p.x) > 0.01) p.x += Math.sign(0.46 - p.x) * WALK * p.drift * dtMs;
        else walking = false;
      } else if (p.dwellMs > 0) {
        // At a duty station: stand and WORK.
        p.dwellMs -= dtMs;
        if (p.role === 'farmer' && age >= 2) action = 'bend';
        else if (p.role === 'mason') action = 'hammer';
        else if (p.role === 'keeper' || p.role === 'watcher') action = 'inspect';
      } else if (Math.abs(p.tx - p.x) > 0.005) {
        walking = true;
        p.x += Math.sign(p.tx - p.x) * WALK * p.drift * dtMs;
        if (p.role === 'carrier' && !p.leg) action = 'carry';  // hauling water home
      } else {
        // Arrived: take up the duty, then pick the next station.
        p.leg = 1 - p.leg;
        const j = (i * 31 + Math.floor(p.phase * 100)) % 7;   // deterministic variety
        switch (p.role) {
          case 'farmer':   p.tx = 0.31 + j * 0.022; p.dwellMs = 2600 + j * 600; break;
          case 'carrier':  p.tx = p.leg ? 0.795 : 0.45 + j * 0.01; p.dwellMs = p.leg ? 700 : 1700; break;
          case 'mason':    p.tx = p.leg ? 0.235 + j * 0.008 : 0.42 + j * 0.012; p.dwellMs = p.leg ? 3400 : 900; break;
          case 'keeper':   p.tx = 0.695 + j * 0.013; p.dwellMs = 1500 + j * 400; break;
          case 'watcher':  p.tx = (age >= 5 ? 0.565 : 0.52) + j * 0.008; p.dwellMs = 4200 + j * 800; break;
          default:         p.tx = p.leg ? 0.345 + j * 0.01 : 0.48 + j * 0.014; p.dwellMs = 1100 + j * 500;
        }
      }

      const s = 4.6 + p.row * 2.1;                       // perspective scale
      const baseY = horizon + 9 + p.row * Math.max(8, H * 0.016);
      p.phase += (walking ? 0.0095 : 0.0022) * dtMs * p.drift;
      // The syzygy lifts them, far rows less, with a slow helpless bob.
      const lift = syzygyLift * (16 + p.row * 7 + Math.sin(p.phase * 0.7 + i) * 6);
      drawFigure(p, p.x * W, baseY - lift, s, age,
                 walking && !syzygyLift, p.phase, syzygyLift > 0.05, brightNow,
                 syzygyLift > 0.05 ? null : action);
    }
  }

  // ----------------------------------------------------------
  // Weather
  // ----------------------------------------------------------
  function drawWeather(state, obs, horizon, T, nowMs) {
    if (T < -22) {
      const want = Math.min(180, Math.round((-T - 20) * 2.4));
      while (snow.length < want) snow.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.5 + 0.6 });
      if (snow.length > want) snow.length = want;
      ctx.fillStyle = 'rgba(228,238,252,0.85)';
      for (const f of snow) {
        f.y += 0.0016 * f.s; f.x += Math.sin(nowMs / 800 + f.y * 9) * 0.0004;
        if (f.y > 1) { f.y = 0; f.x = Math.random(); }
        ctx.fillRect(f.x * W, f.y * H, f.s, f.s);
      }
    } else snow.length = 0;

    if (T > 75) {
      const want = Math.min(130, Math.round((T - 70) / 3));
      while (embers.length < want) embers.push({ x: Math.random(), y: 1, s: Math.random() + 0.5 });
      if (embers.length > want) embers.length = want;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,150,60,0.7)';
      for (const e of embers) {
        e.y -= 0.0022 * e.s; e.x += Math.sin(nowMs / 500 + e.y * 14) * 0.0006;
        if (e.y < 0.3) { e.y = 1; e.x = Math.random(); }
        ctx.fillRect(e.x * W, e.y * H, e.s, e.s * 2);
      }
      ctx.restore();
    } else embers.length = 0;

    if (obs.alignSpread < 0.12) {
      const want = 90;
      while (rocks.length < want) rocks.push({ x: Math.random(), y: 1 + Math.random(), s: Math.random() * 2 + 1 });
      ctx.fillStyle = 'rgba(58,53,48,0.9)';
      for (const r of rocks) {
        r.y -= 0.003;
        if (r.y < -0.1) { r.y = 1.05; r.x = Math.random(); }
        const y = r.y * (H - horizon) + horizon;
        ctx.fillRect(r.x * W, y, r.s, r.s);
      }
    } else rocks.length = 0;
  }

  // ----------------------------------------------------------
  // Post-processing, in camera order:
  // temperature grade → event flash → vignette → film grain.
  // ----------------------------------------------------------
  function postProcess(nowMs, T, bright, dt?) {
    // Color grade: push the whole frame warm in heat, blue in cold (eased).
    const gradeTarget = U.clamp((Math.abs(T - 15) - 25) / 130, 0, 0.13);
    gradeA += (gradeTarget - gradeA) * U.relax(dt || 0.016, 0.8);
    if (gradeA > 0.004) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = T > 15
        ? 'rgba(255,140,70,' + gradeA + ')'
        : 'rgba(110,170,255,' + gradeA + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Event flash (set via TB.render.flash), fast exponential fade.
    if (flashA > 0.005) {
      ctx.fillStyle = 'rgba(' + flashColor + ',' + flashA.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      flashA *= Math.exp(-(dt || 0.016) / 0.16);
    }

    const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.42,
                                       W / 2, H * 0.55, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    if (grain) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      const ox = (nowMs * 0.31) % 128, oy = (nowMs * 0.17) % 128;
      for (let x = -ox; x < W; x += 128)
        for (let y = -oy; y < H; y += 128)
          ctx.drawImage(grain, x, y);
      ctx.restore();
    }
  }

  // ----------------------------------------------------------
  // Title-screen demo: the three-body dance, drawn as art.
  // ----------------------------------------------------------
  let demo = null;
  function titleDemo(nowMs) {
    if (!demo) {
      const rng = U.makeRng(2049);
      demo = { sys: P.createSystem(rng), trails: [[], [], []], pTrail: [] };
    }
    P.advance(demo.sys, 0.004);
    for (let i = 0; i < 3; i++) {
      const s = demo.sys.suns[i];
      demo.trails[i].push(s.x, s.y);
      if (demo.trails[i].length > 1600) demo.trails[i].splice(0, 2);
    }
    demo.pTrail.push(demo.sys.planet.x, demo.sys.planet.y);
    if (demo.pTrail.length > 1600) demo.pTrail.splice(0, 2);

    ctx.fillStyle = '#06080c';
    ctx.fillRect(0, 0, W, H);
    // Faint stars.
    ctx.save();
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(nowMs / 1100 + s.tw);
      ctx.globalAlpha = 0.35 * tw * s.b;
      ctx.fillStyle = '#cdd8f0';
      ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
    }
    ctx.restore();

    let M = 0, cx = 0, cy = 0;
    for (const s of demo.sys.suns) { M += s.m; cx += s.m * s.x; cy += s.m * s.y; }
    cx /= M; cy /= M;
    let rMax = 5;
    for (const s of demo.sys.suns) rMax = Math.max(rMax, Math.hypot(s.x - cx, s.y - cy) * 1.3);
    const scale = Math.min(W, H) * 0.4 / rMax;
    const sx = (x) => W / 2 + (x - cx) * scale;
    const sy = (y) => H * 0.5 + (y - cy) * scale;

    const cols = ['#ffd75e', '#ff9e64', '#7ecbff'];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const t = demo.trails[i];
      ctx.strokeStyle = cols[i] + '2e'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < t.length; k += 2) {
        const x = sx(t[k]), y = sy(t[k + 1]);
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      const s = demo.sys.suns[i];
      const g = ctx.createRadialGradient(sx(s.x), sy(s.y), 0, sx(s.x), sy(s.y), 22);
      g.addColorStop(0, cols[i]);
      g.addColorStop(1, cols[i] + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), 22, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(235,242,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < demo.pTrail.length; k += 2) {
      const x = sx(demo.pTrail[k]), y = sy(demo.pTrail[k + 1]);
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const p = demo.sys.planet;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 2.2, 0, 7); ctx.fill();
    ctx.restore();

    postProcess(nowMs, 0, 0.2);
  }

export const render2d = { init, render, resize, reseedTerrain, titleDemo, addShake, flash,
                setBiome: setBiome2d };
