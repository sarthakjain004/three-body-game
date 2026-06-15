/* ============================================================
 * THREE BODY — civ.js
 * The Trisolaran civilization: population, hydration state,
 * technological ages, trust in the calendar, destruction and
 * rebirth, and (eventually) the Trisolaran Fleet.
 * Pure JS, no DOM.
 * ============================================================ */
'use strict';
var TB = globalThis.TB = globalThis.TB || {};

(function () {
  const U = TB.util;

  // Technological ages. `cum` = cumulative science points required.
  const AGES = [
    { name: 'Neolithic Age',           cum: 0 },
    { name: 'Bronze Age',              cum: 40 },
    { name: 'Iron Age',                cum: 100 },
    { name: 'Warring States Level',    cum: 190 },
    { name: 'Imperial Level',          cum: 330 },
    { name: 'Medieval Level',          cum: 550 },
    { name: 'Renaissance Level',       cum: 890 },
    { name: 'Scientific Revolution',   cum: 1410 },
    { name: 'Industrial Revolution',   cum: 2710 },
    { name: 'Electrical Age',          cum: 4910 },
    { name: 'Atomic Age',              cum: 8110 },
    { name: 'Information Age',         cum: 12910 },
    { name: 'Space Age',               cum: 19910 },
  ];

  // --- Population / climate tunables (vetted by tools/harness.js) ---
  const SAFE_LO = -10, SAFE_HI = 45;      // hydrated survival band (°C)
  const GROW_LO = -5,  GROW_HI = 40;      // growth band
  const GROWTH_RATE = 0.00009;            // per day (~3.3%/yr)
  const HARM_SCALE = 35;                  // °C beyond band for 50%/day deaths
  const DEHYDRATE_RATE = 0.30;            // fraction of pool per day (max)
  const REHYDRATE_LO = -15, REHYDRATE_HI = 50;
  const BURN_T1 = 150, BURN_T2 = 320;     // dehydratories scorch thresholds
  const TECH_RATE = 0.012;                // science pts/day scale
  const SEED_RETAIN = 0.90;               // tech kept across destructions
  const EXTINCT_BELOW = 0.02;             // millions — civilization fails
  const FLEET_SHIPS = 1000;

  // --- Reserve economy (water gates rehydration; grain sustains the
  //     hydrated; both are stockpiled in good times, spent in chaos) ---
  const WET_LO = 0, WET_HI = 62;          // °C band in which lakes refill cisterns
  const WATER_PER_CAPITA = 1;             // water units to rehydrate 1M people
  const WATER_RECLAIM = 0.5;              // fraction of body-water recovered on dehydration
  const FOOD_PER_CAPITA = 0.02;           // grain/day consumed per 1M hydrated
  const FAMINE_RATE = 0.06;               // hydrated deaths/day when grain is gone

  function ageOf(tech) {
    let idx = 0;
    for (let i = 0; i < AGES.length; i++) if (tech >= AGES[i].cum) idx = i;
    return idx;
  }

  // ----------------------------------------------------------
  // DOCTRINES — a branching investment tree. The civilization earns
  // "Insight" (1 per age reached, +1 per Calendar kept) and spends it
  // on one of three competing schools. Tiers must be bought in order.
  // Doctrines are institutional knowledge: they persist across rebirth.
  // ----------------------------------------------------------
  const DOCTRINES = [
    { key: 'predict', name: 'The Calendrical School', blurb: 'Read the sky farther and stake it harder.',
      tiers: [
        { id: 'p1', name: 'Sharper Instruments', cost: 1, desc: 'Forecasts begin from far finer measurements — the chaos horizon reaches markedly farther.' },
        { id: 'p2', name: 'The Standard Calendar', cost: 2, desc: 'A kept Calendar earns +50% trust; a broken one costs far less faith.' },
        { id: 'p3', name: 'The Long Ephemeris', cost: 3, desc: 'The Computer integrates a 60% longer window into the future.' },
      ] },
    { key: 'survive', name: 'The Dehydratory School', blurb: 'Outlast any sky in the deep vaults.',
      tiers: [
        { id: 's1', name: 'Deep Rock Vaults', cost: 1, desc: 'Dehydratories are sheltered far earlier; the stored scorch at less than half the rate.' },
        { id: 's2', name: 'The Great Cisterns', cost: 2, desc: 'Water capacity and lake inflow both +60% — rehydrate faster, ration less.' },
        { id: 's3', name: 'Granary Reserves', cost: 3, desc: 'Grain stores +50% and harvests +30% — keep far more of the people awake.' },
      ] },
    { key: 'expand', name: 'The Engine School', blurb: 'Drive science and the fleet.',
      tiers: [
        { id: 'e1', name: 'Disciplined Compliance', cost: 1, desc: 'Orders are obeyed swiftly whatever the people\'s trust — dehydration and rehydration run faster.' },
        { id: 'e2', name: 'The Industrial Base', cost: 2, desc: 'Science accrues 30% faster in every era.' },
        { id: 'e3', name: 'Stellar Shipyards', cost: 3, desc: 'The Trisolaran Fleet is built at double speed.' },
      ] },
  ];

  // Merge the multipliers/bonuses for a civilization's owned doctrines.
  function mods(civ) {
    const d = (civ && civ.doctrines) || {};
    const m = {
      forecastEps: 1, ensembleDaysMul: 1, calTrustGain: 1, calTrustPenalty: 1,
      scorchMul: 1, shelterAgeBonus: 0, waterCapMul: 1, waterInflowMul: 1,
      grainCapMul: 1, foodProdMul: 1, complianceBonus: 0, scienceMul: 1, fleetMul: 1,
    };
    if (d.p1) m.forecastEps *= 0.55;
    if (d.p2) { m.calTrustGain *= 1.5; m.calTrustPenalty *= 0.55; }
    if (d.p3) m.ensembleDaysMul *= 1.6;
    if (d.s1) { m.scorchMul *= 0.4; m.shelterAgeBonus = 2; }
    if (d.s2) { m.waterCapMul *= 1.6; m.waterInflowMul *= 1.6; }
    if (d.s3) { m.grainCapMul *= 1.5; m.foodProdMul *= 1.3; }
    if (d.e1) m.complianceBonus += 0.22;
    if (d.e2) m.scienceMul *= 1.3;
    if (d.e3) m.fleetMul *= 2;
    return m;
  }

  // The next purchasable tier of a branch (or null if maxed), given owned set.
  function nextTier(branch, doctrines) {
    for (const t of branch.tiers) if (!doctrines[t.id]) return t;
    return null;
  }
  function tierById(id) {
    for (const b of DOCTRINES) for (const t of b.tiers) if (t.id === id) return { branch: b, tier: t };
    return null;
  }

  function popCap(ageIdx)   { return 80 + ageIdx * ageIdx * 30; }   // carrying capacity (M)
  function waterCap(civ)    { return (40 + 0.4 * popCap(civ.ageIdx)) * mods(civ).waterCapMul; }
  function grainCap(civ)    { return (60 + 0.6 * popCap(civ.ageIdx)) * mods(civ).grainCapMul; }
  function waterInflow(civ) { return (4 + civ.ageIdx * 2) * mods(civ).waterInflowMul; }
  function foodProd(civ)    { return (0.14 + civ.ageIdx * 0.01) * mods(civ).foodProdMul; }

  // Hydrated population the land can feed in the current era (production =
  // consumption). Production is sublinear, so a huge populace cannot all
  // stay awake — the surplus must sleep in the dehydratories.
  function sustainablePop(civ, cl) {
    const stab = (cl && cl.eraType === 'stable') ? 1 : 0.35;
    const k = foodProd(civ) * stab / FOOD_PER_CAPITA;   // popH^0.3 == k at balance
    return Math.pow(Math.max(k, 0.01), 1 / 0.3);
  }
  // Days of food remaining at the current hydrated headcount.
  function foodDays(civ) {
    const burn = civ.popH * FOOD_PER_CAPITA;
    return burn > 1e-6 ? civ.grain / burn : Infinity;
  }

  // Forward-looking deadlines for the current state (no forecast needed —
  // these are the rates already baked into update()). Returns the data the
  // HUD advisory needs plus a single prioritized `threat`.
  function outlook(civ, cl) {
    const T = cl.tempC;
    const r = {
      foodNet: 0, daysToFamine: Infinity,
      climateLossPerDay: 0, daysToHalf: Infinity, climateKind: null,
      burnLossPerDay: 0, daysToHalfStored: Infinity,
      orderEta: Infinity,
      threat: null,   // { label, days, severity, advice }
    };
    if (civ.dormant || !civ.alive) return r;

    // Food: net production minus consumption → days until the granary empties.
    const stab = cl.eraType === 'stable' ? 1 : 0.35;
    const prod = (T >= GROW_LO && T <= GROW_HI)
      ? foodProd(civ) * Math.pow(Math.max(civ.popH, 0), 0.7) * stab : 0;
    r.foodNet = prod - civ.popH * FOOD_PER_CAPITA;
    if (civ.popH > 0) {
      if (civ.grain <= 0) r.daysToFamine = 0;
      else if (r.foodNet < -1e-6) r.daysToFamine = civ.grain / (-r.foodNet);
    }

    // Climate: deaths to the hydrated when outside the survival band.
    let dT = 0;
    if (T < SAFE_LO) { dT = SAFE_LO - T; r.climateKind = 'cold'; }
    else if (T > SAFE_HI) { dT = T - SAFE_HI; r.climateKind = 'heat'; }
    if (dT > 0 && civ.popH > 0) {
      r.climateLossPerDay = Math.min(0.95, 0.5 * Math.pow(dT / HARM_SCALE, 2));
      if (r.climateLossPerDay > 1e-6) r.daysToHalf = Math.log(2) / r.climateLossPerDay;
    }

    // Scorching of the dehydratories when stored bodies are too hot.
    // Mirror update()'s doctrine-aware rates so the advisory doesn't lie.
    if (civ.popD > 0 && T > BURN_T1) {
      const M = mods(civ);
      const sheltered = civ.ageIdx >= (6 - M.shelterAgeBonus);
      r.burnLossPerDay = (T > BURN_T2 ? (sheltered ? 0.05 : 0.20) : (sheltered ? 0.008 : 0.04)) * M.scorchMul;
      if (r.burnLossPerDay > 1e-6) r.daysToHalfStored = Math.log(2) / r.burnLossPerDay;
    }

    // ETA of the standing order to reach its target.
    if (civ.order === 'dehydrate' && civ.popH > (civ.orderTarget || 0)) {
      const k = DEHYDRATE_RATE * (0.45 + 0.65 * civ.trust);
      r.orderEta = Math.log(civ.popH / Math.max(civ.orderTarget || 0, 1e-3)) / k;
    } else if (civ.order === 'rehydrate' && civ.popD > (civ.orderTarget || 0)) {
      const k = DEHYDRATE_RATE * (0.45 + 0.65 * civ.trust);
      let eta = Math.log(civ.popD / Math.max(civ.orderTarget || 0, 1e-3)) / k;
      const need = (civ.popD - (civ.orderTarget || 0)) * WATER_PER_CAPITA;
      if (civ.water < need * 0.5) eta = Infinity;   // cisterns can't cover it
      r.orderEta = eta;
    }

    // Prioritize the single most pressing concern.
    const cand = [];
    if (r.daysToHalf < 60)
      cand.push({ label: r.climateKind === 'cold' ? 'KILLING COLD' : 'KILLING HEAT',
        days: r.daysToHalf, severity: r.daysToHalf < 5 ? 'crit' : 'warn',
        advice: 'Dehydrate the hydrated.' });
    if (r.daysToFamine < 60)
      cand.push({ label: 'FAMINE', days: r.daysToFamine,
        severity: r.daysToFamine < 5 ? 'crit' : 'warn',
        advice: civ.grain <= 0 ? 'The granaries are empty — dehydrate now.'
          : 'Dehydrate part of the populace or wait for a harvest.' });
    if (r.daysToHalfStored < 60)
      cand.push({ label: 'DEHYDRATORIES SCORCHING', days: r.daysToHalfStored,
        severity: r.daysToHalfStored < 5 ? 'crit' : 'warn',
        advice: 'The stored are burning — nothing can be done but endure.' });
    cand.sort((a, b) => a.days - b.days);
    if (cand.length) r.threat = cand[0];
    return r;
  }

  function createCiv(no, opts) {
    opts = opts || {};
    const tech = opts.tech != null ? opts.tech : AGES[3].cum + 20; // Civ 137 reached the Warring States level
    const ageIdx = ageOf(tech);
    const wCap = 40 + 0.4 * popCap(ageIdx), gCap = 60 + 0.6 * popCap(ageIdx);
    return {
      no,
      foundedDay: opts.foundedDay || 0,
      popH: opts.popH != null ? opts.popH : 42,   // millions, hydrated
      popD: opts.popD != null ? opts.popD : 3,    // millions, dehydrated
      peakPop: 0,
      tech,
      ageIdx,
      trust: 0.6,            // faith in the calendar / the player's word
      order: 'none',         // 'none' | 'dehydrate' | 'rehydrate'
      orderTarget: 0,        // pool level (M) the standing order moves toward
      calRewardEra: -1,      // chaoticEraNo last paid a Stable-calendar reward
      // --- reserves ---
      water: opts.water != null ? opts.water : 0.6 * wCap,   // rehydration water
      grain: opts.grain != null ? opts.grain : 0.6 * gCap,   // food stores
      starving: false,       // grain exhausted (latch for one-time warning)
      insight: opts.insight != null ? opts.insight : 0,      // doctrine points to spend
      doctrines: opts.doctrines ? Object.assign({}, opts.doctrines) : {}, // owned upgrades
      autoProtocol: false,   // civil-defense automation (late-game unlock)
      comfortStreak: 0,      // days of livable weather (for auto-rehydrate)
      alive: true,
      dormant: false,
      germDays: 0,
      deathCause: null,
      // decaying death tallies, for attributing the destruction cause
      tally: { cold: 0, heat: 0, fire: 0, syzygy: 0, famine: 0, calendar: 0 },
      fleet: { building: false, ships: 0 },
      stats: { bornDay: opts.foundedDay || 0, deaths: 0 },
    };
  }

  function totalPop(civ) { return civ.popH + civ.popD; }

  /**
   * Advance the civilization by dtDays.
   * @param civ    civilization state
   * @param cl     climate state (TB.climate)
   * @param day    absolute game day
   * @param rng    seeded RNG
   * @param flags  game flags: {autoUnlocked, fleetUnlocked}
   * @returns      array of events: {type:'age'|'extinct'|'fleet-done'|'order-done', ...}
   */
  function update(civ, cl, day, dtDays, rng, flags) {
    const events = [];
    if (!civ.alive) return events;
    const T = cl.tempC;

    // ---- Dormant seed: buried deep, invulnerable, waiting for a sky
    //      it can live under. Germinates after 5 livable days. ----
    if (civ.dormant) {
      if (T >= 0 && T <= 38) civ.germDays += dtDays; else civ.germDays = 0;
      if (civ.germDays >= 5 && day - civ.foundedDay >= 30) {
        civ.dormant = false;
        civ.dormantDays = 0;
        civ.order = 'rehydrate';
        events.push({ type: 'germinate' });
        return events;
      }
      // Backstop against a frozen-forever world: after 40 sleeping years
      // the vault's automatons carry the seed toward a kinder orbit.
      civ.dormantDays = (civ.dormantDays || 0) + dtDays;
      if (civ.dormantDays > 40 * 365.25) {
        civ.dormantDays = 0;
        events.push({ type: 'long-sleep' });
      }
      return events;
    }

    // ---- Water cisterns refill while the lakes run liquid ----
    const wCap = waterCap(civ);
    if (T >= WET_LO && T <= WET_HI) {
      const inflow = waterInflow(civ) * (cl.eraType === 'stable' ? 1.5 : 1) * dtDays;
      civ.water = Math.min(wCap, civ.water + inflow);
    }

    const M = mods(civ);   // doctrine multipliers

    // ---- Standing orders: dehydrate / rehydrate (toward orderTarget) ----
    const compliance = Math.min(1.25, 0.45 + 0.65 * civ.trust + M.complianceBonus);
    const target = civ.orderTarget || 0;
    if (civ.order === 'dehydrate' && civ.popH > target + 1e-4) {
      // Wringing out the water banks it back into the cisterns.
      const moved = Math.min(civ.popH - target, civ.popH * DEHYDRATE_RATE * compliance * dtDays);
      civ.popH -= moved; civ.popD += moved;
      civ.water = Math.min(wCap, civ.water + moved * WATER_PER_CAPITA * WATER_RECLAIM);
      if (civ.popH <= target + 1e-4) { civ.order = 'none';
        events.push({ type: 'order-done', order: 'dehydrate' }); }
    } else if (civ.order === 'dehydrate') {
      civ.order = 'none';
    } else if (civ.order === 'rehydrate' && civ.popD > target + 1e-4) {
      if (T >= REHYDRATE_LO && T <= REHYDRATE_HI) {
        // Soaking the rolled back to life spends water from the cisterns.
        let moved = Math.min(civ.popD - target, civ.popD * DEHYDRATE_RATE * compliance * dtDays);
        const affordable = civ.water / WATER_PER_CAPITA;
        if (moved > affordable) {                  // the cisterns run dry mid-soak
          moved = Math.max(0, affordable);
          if (!civ.waterDry && civ.popD - target > 1) { civ.waterDry = true;
            events.push({ type: 'water-dry' }); }
        } else if (civ.water > 1) civ.waterDry = false;
        civ.popD -= moved; civ.popH += moved;
        civ.water = Math.max(0, civ.water - moved * WATER_PER_CAPITA);
        if (civ.popD <= target + 1e-4) { civ.order = 'none'; civ.waterDry = false;
          events.push({ type: 'order-done', order: 'rehydrate' }); }
      }
      // outside the band, the soaking lakes are frozen or boiling: order stalls
    } else if (civ.order === 'rehydrate') {
      civ.order = 'none';
    }

    // ---- Auto-protocol (late-game civil defense; yields to the Calendar) ----
    if (civ.autoProtocol && flags.autoUnlocked && !flags.calendarActive) {
      if (T >= GROW_LO && T <= GROW_HI) civ.comfortStreak += dtDays; else civ.comfortStreak = 0;
      const sust = sustainablePop(civ, cl);
      if ((T < SAFE_LO + 4 || T > SAFE_HI - 4) && civ.popH > 0 && civ.order !== 'dehydrate') {
        civ.order = 'dehydrate'; civ.orderTarget = 0;
        events.push({ type: 'auto-order', order: 'dehydrate' });
      } else if (foodDays(civ) < 10 && civ.popH > sust * 1.25 && civ.order !== 'dehydrate') {
        // Famine looming: shed the populace down to what the land can feed.
        civ.order = 'dehydrate'; civ.orderTarget = sust;
        events.push({ type: 'auto-order', order: 'dehydrate' });
      } else if (civ.comfortStreak > 12 && civ.popD > 0.01 && civ.order !== 'rehydrate'
                 && cl.eraType === 'stable' && foodDays(civ) > 30 && civ.water > civ.popD * 0.5) {
        civ.order = 'rehydrate'; civ.orderTarget = 0;
        events.push({ type: 'auto-order', order: 'rehydrate' });
      }
    }

    // ---- Climate deaths (hydrated population) ----
    if (civ.popH > 0) {
      let dT = 0;
      if (T < SAFE_LO) dT = SAFE_LO - T;
      else if (T > SAFE_HI) dT = T - SAFE_HI;
      if (dT > 0) {
        const rate = Math.min(0.95, 0.5 * Math.pow(dT / HARM_SCALE, 2));
        const dead = civ.popH * Math.min(0.98, rate * dtDays);
        civ.popH -= dead;
        civ.stats.deaths += dead;
        if (T < SAFE_LO) civ.tally.cold += dead; else civ.tally.heat += dead;
      }
    }

    // ---- Scorching of the dehydratories (stored bodies burn) ----
    if (civ.popD > 0 && T > BURN_T1) {
      const sheltered = civ.ageIdx >= (6 - M.shelterAgeBonus);   // deep rock dehydratories
      let rate = (T > BURN_T2 ? (sheltered ? 0.05 : 0.20) : (sheltered ? 0.008 : 0.04)) * M.scorchMul;
      const dead = civ.popD * Math.min(0.95, rate * dtDays);
      civ.popD -= dead;
      civ.stats.deaths += dead;
      civ.tally.fire += dead;
    }

    // ---- Food: the hydrated eat; the fields feed them; the rest starve ----
    if (civ.popH > 0) {
      const gCap = grainCap(civ);
      const stab = cl.eraType === 'stable' ? 1 : 0.35;
      // Harvest only in the growth band; consumption is always on.
      if (T >= GROW_LO && T <= GROW_HI) {
        civ.grain += foodProd(civ) * Math.pow(civ.popH, 0.7) * stab * dtDays;
      }
      civ.grain -= civ.popH * FOOD_PER_CAPITA * dtDays;
      if (civ.grain > gCap) civ.grain = gCap;
      if (civ.grain <= 0) {
        civ.grain = 0;
        const dead = civ.popH * Math.min(0.9, FAMINE_RATE * dtDays);
        civ.popH -= dead; civ.stats.deaths += dead; civ.tally.famine += dead;
        if (!civ.starving) { civ.starving = true; events.push({ type: 'famine-begin' }); }
      } else if (civ.starving && foodDays(civ) > 12) {
        civ.starving = false;
      }
    }

    // ---- Growth & science ----
    if (civ.popH > 0 && T >= GROW_LO && T <= GROW_HI) {
      // Logistic growth toward an age-dependent carrying capacity.
      const cap = popCap(civ.ageIdx);   // millions
      const room = U.clamp(1 - totalPop(civ) / cap, 0, 1);
      civ.popH *= 1 + GROWTH_RATE * room * dtDays;
      const stab = cl.eraType === 'stable' ? 1 : 0.35;
      // Science saturates with population — beyond ~400M, more bodies
      // don't mean faster thought. A held Calendar adds a golden-age bonus.
      civ.tech += TECH_RATE * Math.pow(Math.min(civ.popH, 400), 0.6) *
                  (0.4 + 0.6 * civ.trust) * stab * (flags.scienceMult || 1) * M.scienceMul * dtDays;
      const newAge = ageOf(civ.tech);
      if (newAge > civ.ageIdx) {
        civ.insight += (newAge - civ.ageIdx);   // each new age grants doctrine Insight
        civ.ageIdx = newAge;
        events.push({ type: 'age', idx: newAge, name: AGES[newAge].name, insight: true });
      }
    }

    // ---- Fleet construction (endgame) ----
    if (civ.fleet.building && civ.ageIdx >= 12 && civ.popH > 0
        && T >= GROW_LO && T <= GROW_HI) {
      const rate = (0.05 + civ.popH * 0.0009) * M.fleetMul;   // ships per day
      civ.fleet.ships += rate * dtDays;
      if (civ.fleet.ships >= FLEET_SHIPS) {
        civ.fleet.ships = FLEET_SHIPS;
        civ.fleet.building = false;
        events.push({ type: 'fleet-done' });
      }
    }

    civ.peakPop = Math.max(civ.peakPop, totalPop(civ));

    // ---- Decay of cause tallies (attribute recent causes, not ancient ones) ----
    const dk = Math.exp(-dtDays / 90);
    civ.tally.cold *= dk; civ.tally.heat *= dk; civ.tally.fire *= dk;
    civ.tally.syzygy *= dk; civ.tally.famine *= dk; civ.tally.calendar *= dk;

    // ---- Extinction check ----
    if (totalPop(civ) < EXTINCT_BELOW) {
      civ.alive = false;
      civ.deathCause = dominantCause(civ);
      events.push({ type: 'extinct', cause: civ.deathCause });
    }
    return events;
  }

  function dominantCause(civ) {
    const t = civ.tally;
    const entries = [['extreme cold', t.cold], ['blazing heat', t.heat],
                     ['the scorching of the dehydratories', t.fire],
                     ['a tri-solar syzygy', t.syzygy], ['famine', t.famine],
                     ['a calendar that promised calm', t.calendar]];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][1] > 0 ? entries[0][0] : 'the merciless sky';
  }

  // Sudden mass-death from a catastrophe (syzygy quakes, etc.).
  function applyCatastrophe(civ, frac, cause) {
    if (civ.dormant) return [];   // the deep vaults ride it out
    const deadH = civ.popH * frac, deadD = civ.popD * frac;
    civ.popH -= deadH; civ.popD -= deadD;
    civ.stats.deaths += deadH + deadD;
    if (cause === 'syzygy') civ.tally.syzygy += deadH + deadD;
    else if (cause === 'calendar') civ.tally.calendar += deadH + deadD;
    if (totalPop(civ) < EXTINCT_BELOW && civ.alive) {
      civ.alive = false;
      civ.deathCause = cause === 'syzygy' ? 'a tri-solar syzygy' : dominantCause(civ);
      return [{ type: 'extinct', cause: civ.deathCause }];
    }
    return [];
  }

  // The seed of civilization remains: build the successor.
  // It begins DORMANT — fully dehydrated in deep vaults — and only
  // germinates when the climate allows (see update()).
  function rebirth(civ, day, rng) {
    const seedPop = Math.max(0.8, totalPop(civ) + 0.8);  // survivors + buried seed vaults
    const next = createCiv(civ.no + rng.int(1, 9), {
      foundedDay: day,
      tech: civ.tech * SEED_RETAIN,
      popH: 0,
      popD: seedPop,
      insight: civ.insight,        // institutional knowledge survives the seed
      doctrines: civ.doctrines,
    });
    next.dormant = true;
    next.germDays = 0;
    next.autoProtocol = civ.autoProtocol;
    return next;
  }

  TB.civ = {
    AGES, DOCTRINES, createCiv, update, applyCatastrophe, rebirth, totalPop, ageOf,
    popCap, waterCap, grainCap, sustainablePop, foodDays, outlook,
    mods, nextTier, tierById,
    consts: { SAFE_LO, SAFE_HI, GROW_LO, GROW_HI, REHYDRATE_LO, REHYDRATE_HI,
              FLEET_SHIPS, EXTINCT_BELOW, SEED_RETAIN,
              WATER_PER_CAPITA, FOOD_PER_CAPITA, WET_LO, WET_HI },
  };
})();
