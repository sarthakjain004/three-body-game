/* ============================================================
 * THREE BODY — charts.js
 * The Observatory (temperature & sun-distance history, Mozi's
 * model, divination), the Orbit Map (the true three-body dance),
 * and the Computer (ensemble forecasts + the human-computer
 * motherboard animation). Browser only.
 * ============================================================ */
'use strict';
var TB = globalThis.TB = globalThis.TB || {};

(function () {
  const U = TB.util, P = TB.physics, C = TB.climate, PR = TB.predict;

  const SUN_COLORS = ['#ffd75e', '#ff9e64', '#7ecbff'];

  // Orbit trails, sampled from the live system.
  const trail = { suns: [[], [], []], planet: [], lastDay: -1e9 };
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
    trail.suns = [[], [], []]; trail.planet = []; trail.lastDay = -1e9;
    // A new game (or new world) must not inherit the old one's prophecy.
    forecast = null; computing = null; lastDivination = null; lastMozi = null;
  }

  // Forecast cache + motherboard animation state.
  let forecast = null;          // {result, day, eps}
  let computing = null;         // {startMs, durMs} while the "computer runs"
  let lastDivination = null;
  let lastMozi = null;

  function requestForecast(state) {
    if (computing) return;
    computing = { startMs: performance.now(), durMs: 2600 };
    // The real numbers are crunched when the animation finishes.
    setTimeout(() => {
      // The player may have started a new game mid-computation.
      if (TB.app && TB.app.state !== state) { computing = null; return; }
      // Doctrines sharpen the instruments and lengthen the ephemeris window.
      const m = TB.civ.mods(state.civ);
      const eps = PR.epsForAge(state.civ.ageIdx) * m.forecastEps;
      const days = Math.round(540 * m.ensembleDaysMul);
      // Use a derived RNG, NOT the live game RNG — running the forecast tool
      // must not perturb the reality it predicts (found by review).
      const frng = TB.util.makeRng(((state.seed >>> 0) ^ Math.floor(state.day * 7)) >>> 0);
      const res = PR.ensembleForecast(state.sys, days, 7, eps, frng);
      forecast = { result: res, day: state.day, eps };
      computing = null;
    }, 2650);
  }

  function rollDivination(state) {
    lastDivination = PR.divination(state.cl, state.rng);
  }
  function runMozi(state) {
    lastMozi = { res: PR.moziModel(state.sys, state.cl), day: state.day };
  }

  // ----------------------------------------------------------
  // Drawing helpers
  // ----------------------------------------------------------
  function frame(ctx, x, y, w, h, title) {
    ctx.strokeStyle = '#2a3548'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    if (title) {
      ctx.fillStyle = '#7a8aa0'; ctx.font = '10px Menlo, monospace';
      ctx.fillText(title.toUpperCase(), x + 8, y + 14);
    }
  }

  // ----------------------------------------------------------
  // OBSERVATORY
  // ----------------------------------------------------------
  function drawObservatory(ctx, state, w, h) {
    const cl = state.cl;
    const hist = cl.history;
    const pad = 12;
    const chartH = Math.floor((h - pad * 3) * 0.46);

    // --- Temperature history ---
    frame(ctx, pad, pad, w - pad * 2, chartH, 'Surface temperature — last ' +
      Math.min(hist.length, 1095) + ' days');
    if (hist.length > 1) {
      const view = hist.slice(-1095);
      const x0 = pad + 6, x1 = w - pad - 6, y0 = pad + 22, y1 = pad + chartH - 8;
      const tLo = -130, tHi = 160;
      const ty = (t) => y1 - (U.clamp(t, tLo, tHi) - tLo) / (tHi - tLo) * (y1 - y0);
      // Survivable band.
      ctx.fillStyle = 'rgba(105,240,174,0.07)';
      ctx.fillRect(x0, ty(45), x1 - x0, ty(-10) - ty(45));
      ctx.strokeStyle = 'rgba(105,240,174,0.25)';
      ctx.beginPath(); ctx.moveTo(x0, ty(0)); ctx.lineTo(x1, ty(0)); ctx.stroke();
      // Trace.
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < view.length; i++) {
        const x = x0 + (i / (view.length - 1)) * (x1 - x0);
        const y = ty(view[i].tempC);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Now marker + labels.
      ctx.fillStyle = '#c8d4e0'; ctx.font = '10px Menlo, monospace';
      ctx.fillText(U.fmtTemp(cl.tempC) + ' now', x1 - 78, y0 + 10);
      ctx.fillStyle = '#7a8aa0';
      ctx.fillText('+150°', x0 + 2, ty(150) + 4);
      ctx.fillText('0°', x0 + 2, ty(0) - 3);
      ctx.fillText('−100°', x0 + 2, ty(-100) + 4);
    }

    // --- Sun distances ---
    const y2 = pad * 2 + chartH;
    frame(ctx, pad, y2, w - pad * 2, chartH, 'Distance of the three suns (AU)');
    if (hist.length > 1) {
      const view = hist.slice(-1095);
      const x0 = pad + 6, x1 = w - pad - 6, y0 = y2 + 22, y1 = y2 + chartH - 8;
      const dMax = Math.max(8, ...view.map(s => Math.max(s.d[0], s.d[1], s.d[2]))) * 1.05;
      const dy = (d) => y1 - (1 - Math.min(d, dMax) / dMax) * 0 - (Math.min(d, dMax) / dMax) * (y1 - y0);
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = SUN_COLORS[k]; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < view.length; i++) {
          const x = x0 + (i / (view.length - 1)) * (x1 - x0);
          const y = dy(view[i].d[k]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Flying-star threshold.
      ctx.strokeStyle = 'rgba(128,216,255,0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x0, dy(C.consts.FLY_DIST)); ctx.lineTo(x1, dy(C.consts.FLY_DIST)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#80d8ff'; ctx.font = '9px Menlo, monospace';
      ctx.fillText('flying-star line', x0 + 6, dy(C.consts.FLY_DIST) - 4);
    }

    // --- Texts: divination & Mozi ---
    let ty0 = y2 + chartH + 10;
    ctx.font = '11px Menlo, monospace';
    if (lastDivination) {
      ctx.fillStyle = '#d4af37';
      ctx.fillText(lastDivination.hexagram + ' — "' + lastDivination.verse + '"', pad + 2, ty0);
      ctx.fillStyle = '#7a8aa0';
      ctx.fillText('The hexagram suggests: ' + lastDivination.guess.toUpperCase() +
        ' skies for ~' + lastDivination.horizon + ' days. (Divination is... divination.)',
        pad + 2, ty0 + 16);
      ty0 += 36;
    }
    if (state.flags.mozi && lastMozi) {
      ctx.fillStyle = '#69f0ae';
      wrapText(ctx, 'MOZI\'S MODEL: ' + lastMozi.res.text, pad + 2, ty0, w - pad * 2 - 8, 15);
    }
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '', yy = y;
    for (const word of words) {
      if (ctx.measureText(line + word).width > maxW && line) {
        ctx.fillText(line, x, yy); line = word + ' '; yy += lineH;
      } else line += word + ' ';
    }
    ctx.fillText(line, x, yy);
    return yy + lineH;
  }

  // ----------------------------------------------------------
  // ORBIT MAP
  // ----------------------------------------------------------
  function drawOrbit(ctx, state, w, h) {
    const sys = state.sys;
    // Auto-scale around the barycenter.
    let M = 0, cx = 0, cy = 0;
    for (const s of sys.suns) { M += s.m; cx += s.m * s.x; cy += s.m * s.y; }
    cx /= M; cy /= M;
    let rMax = 4;
    for (const s of sys.suns) rMax = Math.max(rMax, Math.hypot(s.x - cx, s.y - cy) * 1.25);
    rMax = Math.max(rMax, Math.hypot(sys.planet.x - cx, sys.planet.y - cy) * 1.25);
    const scale = Math.min(w, h) * 0.46 / rMax;
    const sx = (x) => w / 2 + (x - cx) * scale;
    const sy = (y) => h / 2 + (y - cy) * scale;

    // Range rings.
    ctx.strokeStyle = 'rgba(42,53,72,0.6)'; ctx.lineWidth = 1;
    ctx.font = '9px Menlo, monospace'; ctx.fillStyle = '#4a5870';
    for (const rr of [1, 2, 5, 10, 20, 40]) {
      if (rr > rMax * 1.1) break;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, rr * scale, 0, 7); ctx.stroke();
      ctx.fillText(rr + ' AU', w / 2 + rr * scale + 3, h / 2 - 3);
    }

    // Trails.
    for (let k = 0; k < 3; k++) {
      const t = trail.suns[k];
      ctx.strokeStyle = SUN_COLORS[k] + '55'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < t.length; i += 2) {
        const x = sx(t[i]), y = sy(t[i + 1]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(220,230,245,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < trail.planet.length; i += 2) {
      const x = sx(trail.planet[i]), y = sy(trail.planet[i + 1]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Bodies.
    for (let k = 0; k < 3; k++) {
      const s = sys.suns[k];
      ctx.fillStyle = SUN_COLORS[k];
      ctx.shadowColor = SUN_COLORS[k]; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), 4 + s.m * 3, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(sx(sys.planet.x), sy(sys.planet.y), 2.5, 0, 7); ctx.fill();
    ctx.font = '10px Menlo, monospace';
    ctx.fillText('Trisolaris', sx(sys.planet.x) + 6, sy(sys.planet.y) + 3);

    // Caption.
    ctx.fillStyle = '#7a8aa0'; ctx.font = '10px Menlo, monospace';
    ctx.fillText('THE TRUE CONFIGURATION — three suns, one world, no solution.', 12, h - 12);
  }

  // ----------------------------------------------------------
  // COMPUTER (Qin I) — motherboard + ensemble forecast
  // ----------------------------------------------------------
  function drawComputer(ctx, state, w, h, nowMs) {
    if (computing) { drawMotherboard(ctx, w, h, nowMs); return; }
    const pad = 12;
    if (!forecast) {
      ctx.fillStyle = '#7a8aa0'; ctx.font = '12px Menlo, monospace';
      wrapText(ctx,
        'COMPUTER "QIN I" — thirty million soldiers stand in formation on the plain, ' +
        'flags down, awaiting the order to compute. Press RUN FORECAST to integrate ' +
        'the motion of the three suns from the latest measurements.',
        pad + 4, pad + 24, w - pad * 2 - 8, 18);
      ctx.fillStyle = '#d4af37';
      ctx.fillText('Instrument error: ±' + PR.epsForAge(state.civ.ageIdx).toExponential(1) +
        ' (improves with technology)', pad + 4, pad + 130);
      return;
    }

    const res = forecast.result;
    const age = Math.floor(state.day - forecast.day);
    frame(ctx, pad, pad, w - pad * 2, h - pad * 2 - 30,
      'Ensemble forecast — 7 integrations, ±' + forecast.eps.toExponential(1) +
      ' measurement error' + (age > 0 ? ' (' + age + ' days old)' : ''));
    const x0 = pad + 8, x1 = w - pad - 10, y0 = pad + 26, y1 = h - pad - 44;
    const tLo = -130, tHi = 160;
    const ty = (t) => y1 - (U.clamp(t, tLo, tHi) - tLo) / (tHi - tLo) * (y1 - y0);
    const tx = (d) => x0 + (d / res.days) * (x1 - x0);

    // Survivable band.
    ctx.fillStyle = 'rgba(105,240,174,0.07)';
    ctx.fillRect(x0, ty(45), x1 - x0, ty(-10) - ty(45));

    // Ensemble spread.
    ctx.fillStyle = 'rgba(212,175,55,0.18)';
    ctx.beginPath();
    for (let d = 0; d < res.days; d++) {
      const x = tx(d), y = ty(res.tMax[d]);
      if (d === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let d = res.days - 1; d >= 0; d--) ctx.lineTo(tx(d), ty(res.tMin[d]));
    ctx.closePath(); ctx.fill();

    // Mean.
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let d = 0; d < res.days; d++) {
      const x = tx(d), y = ty(res.tMean[d]);
      if (d === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Chaos horizon.
    if (res.horizonDay < res.days) {
      const hx = tx(res.horizonDay);
      ctx.strokeStyle = '#ff5252'; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(hx, y0); ctx.lineTo(hx, y1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff5252'; ctx.font = '10px Menlo, monospace';
      ctx.fillText('CHAOS HORIZON: day ' + res.horizonDay, Math.min(hx + 6, w - 170), y0 + 12);
      ctx.fillStyle = '#7a8aa0';
      wrapText(ctx, 'Beyond this line the seven futures disagree. More flags will not help;' +
        ' the fault is the universe\'s.', Math.min(hx + 6, w - 230), y0 + 28, 200, 13);
    } else {
      ctx.fillStyle = '#69f0ae'; ctx.font = '10px Menlo, monospace';
      ctx.fillText('All futures agree across the window. A calendar may be printed.', x0 + 6, y0 + 12);
    }
    // Axis labels.
    ctx.fillStyle = '#7a8aa0'; ctx.font = '9px Menlo, monospace';
    ctx.fillText('today', x0, y1 + 12);
    ctx.fillText('+540 days', x1 - 56, y1 + 12);
    ctx.fillText('0°C', x0 + 2, ty(0) - 3);
  }

  // The human computer at work: thirty million soldiers raising and
  // lowering flags, gate waves sweeping the motherboard.
  function drawMotherboard(ctx, w, h, nowMs) {
    const t = computing ? (performance.now() - computing.startMs) / computing.durMs : 0;
    ctx.fillStyle = '#070a0f';
    ctx.fillRect(0, 0, w, h);
    const cols = Math.floor(w / 9), rows = Math.floor((h - 60) / 9);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wave = Math.sin(c * 0.25 - nowMs / 90 + Math.sin(r * 0.5) * 2);
        const gate = Math.sin(r * 13.7 + c * 7.3);
        const on = wave + gate * 0.6 > 0.55;
        ctx.fillStyle = on ? (gate > 0.5 ? '#69f0ae' : '#2d7a55') : '#10161f';
        ctx.fillRect(c * 9 + 2, r * 9 + 2, 6, 6);
      }
    }
    // Bus cavalry: a bright pulse riding the central row.
    const busY = Math.floor(rows / 2) * 9 + 2;
    const busX = ((nowMs / 3) % (w + 80)) - 40;
    ctx.fillStyle = '#ffd75e';
    ctx.fillRect(busX, busY, 26, 6);
    ctx.fillStyle = '#d4af37'; ctx.font = '11px Menlo, monospace';
    ctx.fillText('QIN I COMPUTING — phalanx ' + Math.min(99, Math.floor(t * 100)) + '%', 12, h - 34);
    ctx.fillStyle = '#7a8aa0'; ctx.font = '10px Menlo, monospace';
    ctx.fillText('System bus: light cavalry. Fault protocol: beheading.', 12, h - 16);
  }

  // For the Calendar dialog: the chaos horizon of the latest forecast.
  function lastForecastInfo(nowDay) {
    if (!forecast) return null;
    return {
      horizonDay: forecast.result.horizonDay,
      days: forecast.result.days,
      ageDays: nowDay != null ? Math.max(0, Math.floor(nowDay - forecast.day)) : 0,
      confident: forecast.result.horizonDay >= forecast.result.days,
    };
  }

  TB.charts = {
    drawObservatory, drawOrbit, drawComputer,
    sampleTrail, resetTrail, requestForecast, rollDivination, runMozi,
    isComputing: () => !!computing, lastForecastInfo,
  };
})();
