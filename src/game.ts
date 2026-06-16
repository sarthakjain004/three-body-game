/* ============================================================
 * THREE BODY — game.ts
 * The conductor: ties physics, climate, civilization, story and
 * prediction into one tick. Pure JS, no DOM — the whole game can
 * run headlessly (see tools/harness.js).
 * ============================================================ */
import * as P from './physics';
import * as C from './climate';
import * as V from './civ';
import * as S from './story';
import * as PR from './predict';
import * as U from './util';
import type { GameState, Climate, Rng } from './types';

const PLANETS_AT_START = 12;   // the system began with twelve worlds

// ----------------------------------------------------------
// Creation
// ----------------------------------------------------------
function createGame(seed) {
  const rng = U.makeRng(seed == null ? 137 : seed);
  const state = {
    seed: rng.seed,
    rng,
    sys: P.createSystem(rng),
    cl: C.createClimate(),
    civ: V.createCiv(137, { foundedDay: 0 }),
    story: S.create(),
    day: 0,
    planetsLeft: PLANETS_AT_START,
    // All tools are available from the start; the story beats introduce
    // them narratively as the civilization advances.
    flags: { mozi: true, orbit: true, computer: true,
             einstein: true, escape: true, autoUnlocked: true },
    calendar: null,         // the published prediction the populace follows
    log: [],
    pending: [],            // overlays/banners for the UI to consume
    over: false, won: false,
    sunEscaped: false,
    _escCheck: 0,           // day accumulators for rare checks
    stats: { civsLost: 0, planetsLost: 0, proclaimOk: 0, proclaimBad: 0,
             maxAge: 3, startCivNo: 137 },
  };
  addLog(state, 'You have logged in to Three Body. Civilization No. 137.', 'sys');
  checkBeats(state);
  return state;
}

function addLog(state:GameState, text, cls) {
  state.log.push({ day: Math.floor(state.day), text, cls: cls || '' });
  if (state.log.length > 250) state.log.splice(0, state.log.length - 250);
}
function push(state, item) { state.pending.push(item); }
function banner(state, text, style) { push(state, { kind: 'banner', text, style: style || '' }); }

// Queue any story beat due at the current age; apply its unlock at once.
function checkBeats(state) {
  let beat;
  while ((beat = S.dueBeat(state.story, state.civ.ageIdx))) {
    S.markBeat(state.story, beat.id);
    if (beat.unlock) {
      state.flags[beat.unlock] = true;
      if (beat.unlock === 'computer') state.flags.autoUnlocked = true;
    }
    push(state, { kind: 'beat', beat });
  }
}

function showNotice(state, key) {
  const n = S.notice(state.story, key);
  if (n) push(state, { kind: 'notice', notice: n });
}

// An event-triggered story beat (king-wen, …), shown at most once.
function showMoment(state, key) {
  const m = S.moment(state.story, key);
  if (m) push(state, { kind: 'beat', beat: m });
}

// ----------------------------------------------------------
// The tick
// ----------------------------------------------------------
function tick(state:GameState, dtDays) {
  if (state.over) return;
  const rng = state.rng;

  // 1. Physics
  P.advance(state.sys, dtDays / 365.25);
  const obs = P.observe(state.sys);
  obs.minDistTick = state.sys.tickMinPlanetDist;

  // 2. Climate + celestial events. If an event replaces the world
  // (engulf / rip), the remaining events of this tick are STALE — they
  // were computed from the dead world's sky — so stop processing them.
  const planetsBefore = state.planetsLeft;
  const clEvents = C.update(state.cl, obs, state.day, dtDays);
  for (const ev of clEvents) {
    handleClimateEvent(state, ev, rng);
    if (state.over) return;
    if (state.planetsLeft < planetsBefore) break;
  }

  // 3. Rare structural checks (escape of planet or a sun)
  state._escCheck += dtDays;
  if (state._escCheck > 5) {
    state._escCheck = 0;
    if (P.planetEscaping(state.sys)) { planetLost(state, 'eject'); return; }
    if (!state.sunEscaped && P.escapedSun(state.sys) >= 0) {
      state.sunEscaped = true;
      showNotice(state, 'sun-escape');
      addLog(state, 'One of the three suns has escaped the system.', 'event');
    }
  }

  // 4. The Calendar drives the populace and grants a golden-age bonus
  //    while a correctly-predicted Stable Era holds. It supersedes the
  //    auto-protocol so the two can't fight over orders.
  state.flags.scienceMult = 1;
  state.flags.calendarActive = !!state.calendar;
  if (state.calendar) followCalendar(state);

  // 5. Civilization
  const cvEvents = V.update(state.civ, state.cl, state.day, dtDays, rng, state.flags);
  for (const ev of cvEvents) handleCivEvent(state, ev);
  if (state.over) return;

  // 6. Calendar resolution
  if (state.calendar) resolveCalendar(state);

  state.day += dtDays;
  state.stats.maxAge = Math.max(state.stats.maxAge, state.civ.ageIdx);
}

function handleClimateEvent(state, ev, rng:Rng) {
  const cl = state.cl;
  switch (ev.type) {
    case 'era': {
      const label = C.eraLabel(cl);
      addLog(state, 'The registrar proclaims: ' + label + ' begins.', 'era');
      banner(state, label.toUpperCase(), ev.era);
      showNotice(state, ev.era === 'stable' ? 'era-stable' : 'era-chaotic');
      break;
    }
    case 'three-flying-stars':
      addLog(state, 'Three flying stars hang in the sky at once.', 'event');
      banner(state, 'THREE FLYING STARS', 'cold');
      showNotice(state, 'three-flying-stars');
      break;
    case 'tri-solar-day':
      addLog(state, 'Tri-solar day! Three suns blaze overhead.', 'event');
      banner(state, 'TRI-SOLAR DAY', 'hot');
      showNotice(state, 'tri-solar-day');
      break;
    case 'double-sun':
      addLog(state, 'Two suns rise together. The heat mounts.', 'event');
      showNotice(state, 'double-sun');
      break;
    case 'eclipse':
      addLog(state, 'An eclipse: one sun slips behind another, a ring of fire about a shadow.', 'event');
      showNotice(state, 'eclipse');
      break;
    case 'syzygy': {
      addLog(state, 'TRI-SOLAR SYZYGY — the suns stack into a line. (tide ' +
             ev.tidal.toFixed(1) + ')', 'event');
      banner(state, 'TRI-SOLAR SYZYGY', 'syzygy');
      showNotice(state, 'syzygy');
      if (ev.severity === 'rip') { planetLost(state, 'rip'); break; }
      const frac = ev.severity === 'major' ? rng.range(0.35, 0.6) : rng.range(0.05, 0.15);
      const exEvents = V.applyCatastrophe(state.civ, frac, 'syzygy');
      addLog(state, 'The tide takes ' + Math.round(frac * 100) + '% of all the stored and the living.', 'bad');
      showNotice(state, 'chronicle-184');   // the legend of Civilization No. 184
      for (const e of exEvents) handleCivEvent(state, e);
      break;
    }
    case 'engulf':
      planetLost(state, 'engulf');
      break;
  }
}

function handleCivEvent(state, ev) {
  switch (ev.type) {
    case 'age':
      addLog(state, 'Civilization No. ' + state.civ.no + ' advances to the ' + ev.name + '.', 'age');
      banner(state, ev.name.toUpperCase(), 'age');
      checkBeats(state);
      break;
    case 'long-sleep': {
      // Forty years of unbroken sleep: relocate the vault to the best
      // available orbit so a hostile spawn cannot soft-lock the game.
      const spawn = P.chooseSpawn(state.sys);
      P.placePlanet(state.sys, spawn.idx, spawn.r, state.rng);
      state.cl = C.createClimate();
      state.cl.eraStartDay = state.day;
      addLog(state, 'Forty years of silence. The vault\'s automatons wake, ' +
        'and carry the seed in a slow ark toward a kinder sun.', 'sys');
      banner(state, 'THE LONG SLEEP ENDS', 'good');
      break;
    }
    case 'germinate':
      addLog(state, 'The seed of Civilization No. ' + state.civ.no +
        ' germinates beneath a livable sky. Rehydration begins.', 'sys');
      banner(state, 'THE SEED GERMINATES', 'good');
      break;
    case 'order-done':
      addLog(state, ev.order === 'dehydrate'
        ? 'The last bodies are rolled and shelved. The world holds its breath.'
        : 'The lakes give back the living. The civilization breathes again.', 'order');
      break;
    case 'auto-order':
      addLog(state, 'Civil-defense protocol: ' + ev.order + ' order issued automatically.', 'order');
      break;
    case 'famine-begin':
      addLog(state, 'The granaries are empty. Famine walks among the hydrated — ' +
        'dehydrate the populace or feed them, quickly.', 'bad');
      banner(state, 'FAMINE', 'bad');
      break;
    case 'water-dry':
      addLog(state, 'The cisterns run dry; the rehydration stalls until the lakes refill.', 'bad');
      break;
    case 'extinct':
      civilizationDestroyed(state);
      break;
    case 'fleet-done': {
      state.over = true; state.won = true;
      push(state, { kind: 'ending', ending: S.ENDING, stats: summary(state) });
      break;
    }
  }
}

function civilizationDestroyed(state) {
  const civ = state.civ;
  state.stats.civsLost += 1;
  const ageName = V.AGES[civ.ageIdx].name;
  addLog(state, 'Civilization No. ' + civ.no + ' was destroyed by ' + civ.deathCause + '.', 'bad');
  push(state, { kind: 'destroyed', text: S.destructionText(civ, ageName), civNo: civ.no });
  // Recognition cards: the first death of each legendary kind recalls the
  // famous civilization that shares its fate.
  const cause = civ.deathCause || '';
  if (cause.indexOf('cold') >= 0) showNotice(state, 'chronicle-137');
  else if (cause.indexOf('heat') >= 0) showNotice(state, 'chronicle-183');
  else if (cause.indexOf('syzygy') >= 0) showNotice(state, 'chronicle-184');
  // The seed germinates.
  state.civ = V.rebirth(civ, state.day, state.rng);
  state.calendar = null;
  addLog(state, 'From the seed, Civilization No. ' + state.civ.no + ' begins.', 'sys');
  checkBeats(state);
}

function planetLost(state, kind) {
  state.planetsLeft -= 1;
  state.stats.planetsLost += 1;
  state.stats.civsLost += 1;
  const civ = state.civ;
  civ.alive = false;
  // The world dies with its people: only the deep vault seed crosses over.
  civ.stats.deaths += V.totalPop(civ);
  civ.popH = 0; civ.popD = 0;
  civ.deathCause = kind === 'engulf' ? 'the sun itself'
                 : kind === 'eject' ? 'the eternal night between the stars'
                 : 'the tearing tides of a tri-solar syzygy';
  addLog(state, 'THE PLANET IS LOST (' + kind + '). Worlds remaining: ' + state.planetsLeft + '.', 'bad');
  push(state, { kind: 'planet-lost', lostKind: kind,
                text: S.planetLostText(kind, state.planetsLeft),
                planetsLeft: state.planetsLeft });
  if (state.planetsLeft <= 0) {
    state.over = true; state.won = false;
    push(state, { kind: 'silence', text: S.SILENCE.text, stats: summary(state) });
    return;
  }
  // Seed vault crosses to the next world: a Hill-safe orbit around
  // the most isolated sun.
  const spawn = P.chooseSpawn(state.sys);
  P.placePlanet(state.sys, spawn.idx, spawn.r * state.rng.range(0.95, 1.05), state.rng);
  state.cl = C.createClimate();
  state.cl.eraStartDay = state.day;
  state.civ = V.rebirth(civ, state.day, state.rng);
  state.calendar = null;
  addLog(state, 'On the next world, Civilization No. ' + state.civ.no + ' begins.', 'sys');
  checkBeats(state);
}

// ----------------------------------------------------------
// Player commands
// ----------------------------------------------------------
// frac (0..1] = portion of the relevant pool the order affects; the order
// stops once that many have moved (1 = everyone, the default fast path).
function cmdDehydrate(state:GameState, frac) {
  if (state.over || !state.civ.alive || state.civ.dormant) return false;
  const civ = state.civ;
  if (civ.popH <= 0) return false;
  frac = (frac == null) ? 1 : U.clamp(frac, 0, 1);
  const targetPop = civ.popH * (1 - frac);
  if (civ.popH - targetPop < 1e-3) return false;   // nothing to move
  civ.order = 'dehydrate'; civ.orderTarget = targetPop;
  addLog(state, frac >= 0.999
    ? '"DEHYDRATE!" — the order rolls across the plain. All must sleep.'
    : '"DEHYDRATE the ' + pctWord(frac) + '" — a workforce is kept awake.', 'order');
  return true;
}
function cmdRehydrate(state:GameState, frac) {
  if (state.over || !state.civ.alive || state.civ.dormant) return false;
  const civ = state.civ;
  if (civ.popD <= 0) return false;
  frac = (frac == null) ? 1 : U.clamp(frac, 0, 1);
  const targetPop = civ.popD * (1 - frac);
  if (civ.popD - targetPop < 1e-3) return false;
  civ.order = 'rehydrate'; civ.orderTarget = targetPop;
  addLog(state, frac >= 0.999
    ? 'The rehydration begins: the rolled are carried to the lakes.'
    : 'A partial rehydration: the ' + pctWord(frac) + ' are soaked back to life.', 'order');
  return true;
}
function pctWord(frac) {
  if (frac >= 0.7) return 'greater part';
  if (frac >= 0.45) return 'half';
  return 'third';
}
function cmdHoldOrder(state:GameState) {
  if (state.civ.order === 'none') return false;
  addLog(state, 'The ' + state.civ.order + ' order is rescinded.', 'order');
  state.civ.order = 'none';
  return true;
}
// Publish the Calendar: a prediction the whole civilization will live by.
// While it stands, the populace AUTO-FOLLOWS it (see followCalendar) — you
// need not micromanage. Be right and a golden age follows; be wrong and the
// people are caught in the open when the sky turns. (kind: 'stable'|'chaos')
function cmdProclaim(state:GameState, kind, days) {
  if (state.over || state.calendar || !state.civ.alive || state.civ.dormant) return false;
  // A calendar is staked under a calm sky — you predict how long it holds,
  // or when it will break. Declaring chaos while chaos reigns is no prophecy.
  if (state.cl.eraType !== 'stable') {
    addLog(state, 'The registrar refuses: the sky is already chaos. ' +
      'Wait for a Stable Era to publish a calendar.', 'proc');
    return false;
  }
  state.calendar = PR.createProclamation(kind, days, state.day, state.cl);
  if (kind === 'stable') {
    addLog(state, 'THE CALENDAR is published: "The Stable Era will hold for ' +
      U.fmtDays(days) + '. Rehydrate; live and build."', 'proc');
    if (state.civ.popD > 0) { state.civ.order = 'rehydrate'; state.civ.orderTarget = 0; }
  } else {
    addLog(state, 'THE CALENDAR is published: "Chaos will come within ' +
      U.fmtDays(days) + '. Dehydrate; take shelter."', 'proc');
    if (state.civ.popH > 0) { state.civ.order = 'dehydrate'; state.civ.orderTarget = 0; }
  }
  return true;
}

// Each tick, the calendar keeps the populace doing what it promised, and —
// for a held Stable Era — grants a golden-age science bonus.
function followCalendar(state) {
  const cal = state.calendar, civ = state.civ, cl = state.cl;
  if (!civ.alive || civ.dormant) return;
  if (cal.kind === 'stable') {
    // Faith in the calendar: wake everyone to work; confidence speeds science.
    if (civ.popD > 0.01 && civ.order !== 'rehydrate') {
      civ.order = 'rehydrate'; civ.orderTarget = 0;
    }
    if (cl.eraType === 'stable') state.flags.scienceMult = 1.4;
  } else { // 'chaos' — a protective warning: keep the people sheltered
    if (civ.popH > 0.01 && civ.order !== 'dehydrate') {
      civ.order = 'dehydrate'; civ.orderTarget = 0;
    }
  }
}

function resolveCalendar(state) {
  const cal = state.calendar, civ = state.civ;
  const r = PR.checkProclamation(cal, state.cl, state.day);
  if (r === 'pending') return;
  const lengthYrs = (cal.endDay - cal.startDay) / 365.25;

  const M = V.mods(civ);   // doctrine modifiers (Calendrical School)
  if (r === 'success') {
    state.stats.proclaimOk += 1;
    const gain = Math.min(0.3, (0.08 + lengthYrs * 0.05) * M.calTrustGain);
    if (cal.kind === 'stable') {
      // A Stable Era pays its golden-age reward ONCE — re-staking the same
      // calm era can't farm Insight/tech/trust (found by review).
      if (civ.calRewardEra !== state.cl.chaoticEraNo) {
        civ.calRewardEra = state.cl.chaoticEraNo;
        civ.trust = Math.min(1, civ.trust + gain);
        civ.insight += 1;
        civ.tech += 30 + 120 * lengthYrs;     // the golden age, banked
        addLog(state, 'THE CALENDAR HELD. A golden age: faith and knowledge both ' +
          'deepen (trust ' + Math.round(civ.trust * 100) + '%).', 'good');
        banner(state, 'THE CALENDAR HELD', 'good');
      } else {
        // Already proven this era — reassurance only, no further bounty.
        civ.trust = Math.min(1, civ.trust + 0.02);
        addLog(state, 'The calendar held once more; the people\'s confidence steadies.', 'good');
      }
    } else {
      // A chaos warning come true — naturally rate-limited (real chaos must arrive).
      civ.trust = Math.min(1, civ.trust + Math.min(0.2, gain));
      civ.insight += 1;
      addLog(state, 'The warned chaos came as foretold. The people were sheltered; ' +
        'trust deepens (' + Math.round(civ.trust * 100) + '%).', 'good');
      banner(state, 'THE WARNING WAS TRUE', 'good');
    }
  } else {
    state.stats.proclaimBad += 1;
    if (cal.kind === 'stable') {
      // The King Wen disaster: chaos struck while the people were awake and
      // working. Panic and exposure scale with the violence of the new sky.
      const T = state.cl.tempC;
      const extremity = U.clamp((Math.abs(T - 15) - 25) / 90, 0, 1);
      const frac = U.clamp(0.12 + 0.4 * extremity, 0.05, 0.6);
      civ.trust = Math.max(0.08, civ.trust - 0.32 * M.calTrustPenalty);
      addLog(state, 'THE CALENDAR HAS FAILED — chaos fell upon a waking world. ' +
        Math.round(frac * 100) + '% are lost; faith collapses (' +
        Math.round(civ.trust * 100) + '%).', 'bad');
      banner(state, 'THE CALENDAR HAS FAILED', 'bad');
      const ex = V.applyCatastrophe(civ, frac, 'calendar');
      for (const e of ex) handleCivEvent(state, e);
      // The first time a published calendar is broken, stage King Wen's lesson.
      showMoment(state, 'king-wen');
    } else {
      // A false alarm: the people slept through a Stable Era — no growth lost
      // to death, but to opportunity, and the calendar is doubted.
      civ.trust = Math.max(0.1, civ.trust - 0.14 * M.calTrustPenalty);
      addLog(state, 'The foretold chaos never came; the people slept through ' +
        'calm and clear skies. The calendar is doubted (' +
        Math.round(civ.trust * 100) + '%).', 'bad');
      banner(state, 'A FALSE ALARM', 'bad');
    }
  }
  state.calendar = null;
}
function cmdFleet(state:GameState) {
  if (!state.flags.escape || state.civ.ageIdx < 12 || state.civ.fleet.building) return false;
  state.civ.fleet.building = true;
  addLog(state, 'The construction of the Trisolaran Fleet begins: 1,000 ships.', 'sys');
  return true;
}
function cmdToggleAuto(state:GameState) {
  if (!state.flags.autoUnlocked) return false;
  state.civ.autoProtocol = !state.civ.autoProtocol;
  addLog(state, 'Civil-defense automation ' + (state.civ.autoProtocol ? 'ENGAGED' : 'suspended') + '.', 'order');
  return true;
}

// Spend Insight on a doctrine. Tiers within a branch must be bought in order.
function cmdBuyDoctrine(state:GameState, id) {
  if (state.over || !state.civ.alive) return false;
  const civ = state.civ;
  const found = V.tierById(id);
  if (!found) return false;
  const { branch, tier } = found;
  if (civ.doctrines[id]) return false;                       // already owned
  if (V.nextTier(branch, civ.doctrines) !== tier) return false;  // out of order
  if (civ.insight < tier.cost) return false;                 // can't afford
  civ.insight -= tier.cost;
  civ.doctrines[id] = true;
  addLog(state, 'DOCTRINE adopted: ' + tier.name + ' (' + branch.name + ').', 'good');
  banner(state, tier.name.toUpperCase(), 'good');
  return true;
}

// ----------------------------------------------------------
// Summary / save / load
// ----------------------------------------------------------
function summary(state) {
  return {
    years: Math.floor(state.day / 365.25),
    civsLost: state.stats.civsLost,
    planetsLost: state.stats.planetsLost,
    lastCivNo: state.civ.no,
    proclaimOk: state.stats.proclaimOk,
    proclaimBad: state.stats.proclaimBad,
    maxAge: V.AGES[state.stats.maxAge].name,
  };
}

function save(state) {
  return {
    v: 1,
    seed: state.seed,
    rngState: state.rng.getState(),   // exact continuity, no RNG mutation
    day: state.day,
    planetsLeft: state.planetsLeft,
    sunEscaped: state.sunEscaped,
    flags: state.flags,
    sys: P.serialize(state.sys),
    cl: Object.assign({}, state.cl, { history: state.cl.history.slice(-400), view: null }),
    civ: state.civ,
    story: state.story,
    calendar: state.calendar,
    stats: state.stats,
    log: state.log.slice(-60),
    over: state.over, won: state.won,
  };
}

function load(data) {
  const rng = U.makeRng(data.seed);
  rng.setState((data.rngState != null ? data.rngState : data.rngSeed) >>> 0);
  const state = {
    seed: data.seed,
    rng,
    sys: P.deserialize(data.sys),
    cl: Object.assign(C.createClimate(), data.cl),
    civ: data.civ,
    story: data.story,
    day: data.day,
    planetsLeft: data.planetsLeft,
    sunEscaped: !!data.sunEscaped,
    flags: data.flags,
    calendar: data.calendar || data.proclamation || null,
    log: data.log || [],
    pending: [],
    over: !!data.over, won: !!data.won,
    _escCheck: 0,
    stats: data.stats,
  };
  // Migrate pre-economy saves: seed the reserves from current capacities.
  const c = state.civ;
  if (c && c.water == null) {
    c.water = 0.6 * V.waterCap(c);
    c.grain = 0.6 * V.grainCap(c);
    c.orderTarget = 0;
    c.starving = false;
    if (!c.tally) c.tally = {};
    if (c.tally.famine == null) c.tally.famine = 0;
  }
  if (c && c.insight == null) { c.insight = 0; c.doctrines = {}; }
  if (c && c.calRewardEra == null) c.calRewardEra = -1;
  if (c && c.tally && c.tally.calendar == null) c.tally.calendar = 0;
  return state;
}

export {
  createGame, tick, save, load, summary,
  cmdDehydrate, cmdRehydrate, cmdHoldOrder, cmdProclaim, cmdFleet, cmdToggleAuto,
  cmdBuyDoctrine, addLog,
};
