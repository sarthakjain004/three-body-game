/* ============================================================
 * THREE BODY — validate.js
 * Verifiability layer: pure, deterministic checks that the game
 * data and a running state satisfy their invariants. No DOM —
 * loadable in the browser (optional self-check) and in Node
 * (tools/verify.js gate runner).
 *
 * Every function RETURNS a list of human-readable violation
 * strings; an empty list means "passed". Nothing throws, so a
 * caller can aggregate and report all failures at once.
 * ============================================================ */
'use strict';
var TB = globalThis.TB = globalThis.TB || {};

(function () {
  const V = TB.civ, P = TB.physics, S = TB.story, U = TB.util;

  const isNum = (x) => typeof x === 'number' && isFinite(x);

  // ----------------------------------------------------------
  // STATIC gates — the content/data is well-formed.
  // ----------------------------------------------------------
  function staticChecks() {
    const errs = [];
    const seenIds = {};
    const flagNames = ['mozi', 'orbit', 'computer', 'einstein', 'escape', 'autoUnlocked'];

    function checkPages(where, pages) {
      if (!Array.isArray(pages) || pages.length === 0) {
        errs.push(where + ': missing/empty pages'); return;
      }
      pages.forEach((pg, i) => {
        if (!pg || typeof pg.text !== 'string' || !pg.text.trim())
          errs.push(where + ' page ' + i + ': empty text');
        if (typeof pg.speaker !== 'string' || !pg.speaker)
          errs.push(where + ' page ' + i + ': missing speaker');
        if (typeof pg.glyph !== 'string' || !pg.glyph)
          errs.push(where + ' page ' + i + ': missing glyph');
      });
    }

    // Age-based beats.
    if (!Array.isArray(S.BEATS) || !S.BEATS.length) errs.push('BEATS empty');
    for (const b of (S.BEATS || [])) {
      if (!b.id) { errs.push('beat with no id'); continue; }
      if (seenIds[b.id]) errs.push('duplicate beat id: ' + b.id);
      seenIds[b.id] = true;
      if (typeof b.title !== 'string' || !b.title) errs.push('beat ' + b.id + ': no title');
      if (typeof b.age !== 'number') errs.push('beat ' + b.id + ': age not a number');
      if (b.unlock != null && flagNames.indexOf(b.unlock) < 0)
        errs.push('beat ' + b.id + ': unknown unlock flag "' + b.unlock + '"');
      checkPages('beat ' + b.id, b.pages);
    }

    // Event-triggered moments.
    for (const k in (S.MOMENTS || {})) {
      const m = S.MOMENTS[k];
      if (m.id !== k) errs.push('moment "' + k + '": id mismatch (' + m.id + ')');
      if (seenIds[k]) errs.push('moment id collides with a beat: ' + k);
      seenIds[k] = true;
      if (!m.title) errs.push('moment ' + k + ': no title');
      checkPages('moment ' + k, m.pages);
    }

    // Notices + chronicles (single-card).
    for (const k in (S.NOTICES || {})) {
      const n = S.NOTICES[k];
      if (!n.title || !n.text) errs.push('notice ' + k + ': missing title/text');
    }
    // The chronicle cards we reference by key must exist.
    for (const key of ['chronicle-137', 'chronicle-183', 'chronicle-184'])
      if (!S.NOTICES[key]) errs.push('missing chronicle notice: ' + key);
    // The event moment we reference must exist.
    if (!S.MOMENTS || !S.MOMENTS['king-wen']) errs.push('missing moment: king-wen');
    // The frame-break epilogue beat must exist at the final age.
    if (!(S.BEATS || []).some(b => b.id === 'meet-up')) errs.push('missing beat: meet-up');

    // Technological ages: 13, strictly increasing thresholds from 0.
    const A = V.AGES || [];
    if (A.length !== 13) errs.push('expected 13 ages, got ' + A.length);
    if (A[0] && A[0].cum !== 0) errs.push('first age cum must be 0');
    for (let i = 1; i < A.length; i++)
      if (!(A[i].cum > A[i - 1].cum)) errs.push('age ' + i + ' (' + A[i].name + ') cum not increasing');

    // Physics constants sane.
    if (!(P.G > 0)) errs.push('G not positive');
    if (!(P.SUN_RADIUS > 0)) errs.push('SUN_RADIUS not positive');

    return errs;
  }

  // ----------------------------------------------------------
  // STATE invariants — a single live snapshot is physically and
  // logically consistent. Called every few ticks by the gate runner.
  // ----------------------------------------------------------
  function stateInvariants(state) {
    const e = [];
    const civ = state.civ, cl = state.cl, sys = state.sys;

    // Population.
    if (!isNum(civ.popH) || civ.popH < -1e-6) e.push('popH bad: ' + civ.popH);
    if (!isNum(civ.popD) || civ.popD < -1e-6) e.push('popD bad: ' + civ.popD);

    // Reserves within their capacities (small tolerance for float drift).
    if (!isNum(civ.water) || civ.water < -1e-6) e.push('water bad: ' + civ.water);
    if (!isNum(civ.grain) || civ.grain < -1e-6) e.push('grain bad: ' + civ.grain);
    if (isNum(civ.water) && civ.water > V.waterCap(civ) * 1.02)
      e.push('water over cap: ' + civ.water.toFixed(2) + ' > ' + V.waterCap(civ).toFixed(2));
    if (isNum(civ.grain) && civ.grain > V.grainCap(civ) * 1.02)
      e.push('grain over cap: ' + civ.grain.toFixed(2) + ' > ' + V.grainCap(civ).toFixed(2));

    // Trust, order, age.
    if (!isNum(civ.trust) || civ.trust < 0.04 || civ.trust > 1.0001) e.push('trust out of range: ' + civ.trust);
    if (['none', 'dehydrate', 'rehydrate'].indexOf(civ.order) < 0) e.push('bad order: ' + civ.order);
    if (!isNum(civ.orderTarget) || civ.orderTarget < -1e-6) e.push('orderTarget bad: ' + civ.orderTarget);
    if (!(civ.ageIdx >= 0 && civ.ageIdx < V.AGES.length)) e.push('ageIdx out of range: ' + civ.ageIdx);
    if (!isNum(civ.tech) || civ.tech < 0) e.push('tech bad: ' + civ.tech);

    // Climate.
    if (!isNum(cl.tempC) || cl.tempC < -300 || cl.tempC > 5000) e.push('tempC implausible: ' + cl.tempC);
    if (['stable', 'chaotic'].indexOf(cl.eraType) < 0) e.push('bad eraType: ' + cl.eraType);

    // Worlds.
    if (!(state.planetsLeft >= 0 && state.planetsLeft <= 12)) e.push('planetsLeft out of range: ' + state.planetsLeft);

    // Suns finite.
    for (let i = 0; i < 3; i++) {
      const s = sys.suns[i];
      if (!isNum(s.x) || !isNum(s.y) || !isNum(s.vx) || !isNum(s.vy)) e.push('sun ' + i + ' non-finite');
    }
    if (!isNum(sys.planet.x) || !isNum(sys.planet.y)) e.push('planet non-finite');

    // Calendar shape, if any.
    if (state.calendar) {
      const c = state.calendar;
      if (['stable', 'chaos'].indexOf(c.kind) < 0) e.push('calendar bad kind: ' + c.kind);
      if (!(c.endDay > c.startDay)) e.push('calendar endDay<=startDay');
    }

    // Fleet.
    if (!isNum(civ.fleet.ships) || civ.fleet.ships < -1e-6 || civ.fleet.ships > V.consts.FLEET_SHIPS + 1)
      e.push('fleet.ships out of range: ' + civ.fleet.ships);

    return e;
  }

  // A compact deterministic fingerprint of the simulation state, for the
  // determinism gate (same seed + same steps ⇒ identical fingerprint).
  function fingerprint(state) {
    const civ = state.civ, sys = state.sys;
    const q = (x) => Math.round((x || 0) * 1e6) / 1e6;   // quantize float noise
    const parts = [
      q(state.day), state.planetsLeft, civ.no, civ.ageIdx, civ.order,
      q(civ.popH), q(civ.popD), q(civ.water), q(civ.grain), q(civ.tech), q(civ.trust),
      q(state.cl.tempC), state.cl.eraType,
    ];
    for (const s of sys.suns) parts.push(q(s.x), q(s.y), q(s.vx), q(s.vy));
    parts.push(q(sys.planet.x), q(sys.planet.y), q(sys.planet.vx), q(sys.planet.vy));
    return U.hashString(parts.join('|'));
  }

  TB.validate = { staticChecks, stateInvariants, fingerprint };
})();
