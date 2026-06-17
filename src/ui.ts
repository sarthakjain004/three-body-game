/* ============================================================
 * THREE BODY — ui.ts
 * HUD, action bar, panels, overlays, banners, input.
 * Reads/writes the running game via app (set by main.js).
 * Browser only.
 * ============================================================ */
import * as U from './util';
import * as C from './climate';
import * as V from './civ';
import * as G from './game';
import * as Audio from './audio';
import * as Charts from './charts';
import * as Portraits from './portraits';
import * as Story from './story';
import * as Sc from './score';
import { app } from './app';
import { render } from './renderer';

  const $ = (id: string): any => document.getElementById(id);
  let el: any = {};
  let bannerQueue = [], bannerUntil = 0;
  let overlayQueue = [], overlayOpen = false;
  let lastLogStamp = '';
  let panelTab = 'obs', panelOpen = false;
  let pcv = null, pctx = null;   // panel canvas
  let orderFrac = 1;             // portion of the populace the next order affects
  let typer = null;              // active typewriter reveal {el, full, timer}

  // ----------------------------------------------------------
  function init() {
    el = {
      hudCiv: $('hud-civ'), hudEra: $('hud-era'), hudDate: $('hud-date'),
      hudTemp: $('hud-temp'), hudPop: $('hud-pop'), hudAge: $('hud-age'),
      hudTrust: $('hud-trust'), hudWorlds: $('hud-worlds'), hudScore: $('hud-score'),
      hudWater: $('hud-water'), hudGrain: $('hud-grain'), advisory: $('advisory'),
      objectives: $('objectives'),
      banner: $('banner'), log: $('log'), procStatus: $('proc-status'),
      overlay: $('overlay'), panel: $('panel'), panelBody: $('panel-body'),
      panelControls: $('panel-controls'), fleetbar: $('fleetbar'),
      btnDe: $('btn-dehydrate'), btnRe: $('btn-rehydrate'), btnHold: $('btn-hold'),
      btnProc: $('btn-proclaim'), btnObs: $('btn-observatory'), btnOrbit: $('btn-orbit'),
      btnComp: $('btn-computer'), btnAuto: $('btn-auto'), btnFleet: $('btn-fleet'),
      btnHelp: $('btn-help'), btnSound: $('btn-sound'), btnCodex: $('btn-codex'),
      btnDoctrine: $('btn-doctrine'),
      tabObs: $('tab-obs'), tabOrbit: $('tab-orbit'), tabComp: $('tab-comp'),
      tabCodex: $('tab-codex'), codex: $('codex'), coach: $('coach'),
    };
    pcv = $('panel-canvas'); pctx = pcv.getContext('2d');

    // Action bar.
    el.btnDe.onclick = () => G.cmdDehydrate(app.state, orderFrac);
    el.btnRe.onclick = () => G.cmdRehydrate(app.state, orderFrac);
    el.btnHold.onclick = () => G.cmdHoldOrder(app.state);

    // Order-fraction selector.
    document.querySelectorAll('#frac-group .frac').forEach((b: any) => {
      b.onclick = () => {
        orderFrac = parseFloat(b.dataset.f);
        document.querySelectorAll('#frac-group .frac').forEach(x =>
          x.classList.toggle('active', x === b));
      };
    });
    el.btnProc.onclick = () => openProclaim();
    el.btnObs.onclick = () => togglePanel('obs');
    el.btnOrbit.onclick = () => { if (app.state.flags.orbit) togglePanel('orbit'); };
    el.btnComp.onclick = () => { if (app.state.flags.computer) togglePanel('comp'); };
    el.btnCodex.onclick = () => togglePanel('codex');
    el.btnDoctrine.onclick = () => openDoctrines();
    el.btnAuto.onclick = () => G.cmdToggleAuto(app.state);
    el.btnFleet.onclick = () => G.cmdFleet(app.state);
    el.btnHelp.onclick = () => openHelp();
    el.btnSound.onclick = () => {
      Audio.setMuted(!Audio.isMuted());
      el.btnSound.textContent = Audio.isMuted() ? '♪ off' : '♪ on';
      try { localStorage.setItem('threebody.muted', Audio.isMuted() ? '1' : ''); } catch (e) {}
    };

    // Panel tabs.
    el.tabObs.onclick = () => setTab('obs');
    el.tabOrbit.onclick = () => setTab('orbit');
    el.tabComp.onclick = () => setTab('comp');
    if (el.tabCodex) el.tabCodex.onclick = () => setTab('codex');
    $('panel-close').onclick = () => togglePanel(panelTab, true);
    if (el.coach) el.coach.onclick = () => hideCoach();

    // Time controls.
    for (let i = 0; i <= 4; i++) {
      const b = $('spd-' + i);
      if (b) b.onclick = () => app.setSpeed(i);
    }

    // Keyboard.
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (overlayOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          const btn = el.overlay.querySelector('button.primary');
          if (btn) { btn.click(); e.preventDefault(); }
        }
        return;
      }
      const st = app.state;
      if (!st) return;   // title screen: no game to command
      switch (e.key.toLowerCase()) {
        case ' ': app.setSpeed(app.speedIdx === 0 ? app.lastSpeedIdx || 1 : 0); e.preventDefault(); break;
        case '1': case '2': case '3': case '4': app.setSpeed(+e.key); break;
        case 'd': G.cmdDehydrate(st, orderFrac); break;
        case 'r': G.cmdRehydrate(st, orderFrac); break;
        case 'x': G.cmdHoldOrder(st); break;
        case 'p': openProclaim(); break;
        case 'o': togglePanel('obs'); break;
        case 'm': if (st.flags.orbit) togglePanel('orbit'); break;
        case 'c': if (st.flags.computer) togglePanel('comp'); break;
        case 'l': togglePanel('codex'); break;
        case 'v': openDoctrines(); break;
        case 'a': G.cmdToggleAuto(st); break;
        case 'h': openHelp(); break;
      }
    });

    // Robustness net: clicking the dimmed backdrop (outside the dialog box)
    // triggers the dialog's primary action, so an overlay can never trap the
    // player even if a button handler somehow fails to attach.
    el.overlay.addEventListener('click', (e) => {
      if (e.target === el.overlay) {
        const btn = el.overlay.querySelector('button.primary');
        if (btn) btn.click();
      }
    });

    // Keep bottom-anchored elements (log, proc-status, coach, panel) clear of
    // the action dock, which wraps to 2+ rows on narrow screens.
    const ab = $('actionbar');
    const root = document.documentElement;
    const setDock = () => {
      if (ab && root && root.style) root.style.setProperty('--dock-h', ab.offsetHeight + 'px');
      sizePanelCanvas();
    };
    if (ab && window.ResizeObserver) new ResizeObserver(setDock).observe(ab);
    window.addEventListener('resize', setDock);
    setDock();
  }

  function sizePanelCanvas() {
    if (!pcv) return;
    const r = el.panelBody.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pcv.width = r.width * dpr; pcv.height = r.height * dpr;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ----------------------------------------------------------
  // Per-frame update
  // ----------------------------------------------------------
  function update(state, nowMs) {
    updateHud(state);
    updateAdvisory(state);
    updateObjectives(state);
    updateTutorial(state, nowMs);
    updateLog(state);
    updateBanner(nowMs);
    if (panelOpen) drawPanel(state, nowMs);
  }

  // ----------------------------------------------------------
  // Objectives panel — the level goal + the single most useful next step.
  // This is the primary "what do I do?" guidance (score.ts is the source).
  // ----------------------------------------------------------
  function updateObjectives(state) {
    if (!el.objectives) return;
    if (state.over) { el.objectives.className = ''; return; }
    const prim = Sc.primaryObjective(state);
    const now = Sc.nowStep(state);
    let html = '<div class="obj-goal"><span class="obj-k">Goal</span>' +
      escapeHtml(prim.text) + '</div>';
    if (now) {
      html += '<div class="obj-now' + (now.danger ? ' danger' : '') + '">' +
        '<span class="obj-k">Now</span>' + now.text + '</div>';
    }
    el.objectives.innerHTML = html;
    el.objectives.className = 'show' + (now && now.danger ? ' danger' : '');
  }

  // ----------------------------------------------------------
  // Onboarding coach — gentle, non-modal, fires each tip once ever
  // (persisted), teaching the core loop during a new player's first run.
  // ----------------------------------------------------------
  const TIP_KEY = 'threebody.tips';
  let coachShowing = null, coachUntil = 0, coachPaused = false;
  function tipsSeen() {
    try { return new Set((localStorage.getItem(TIP_KEY) || '').split(',').filter(Boolean)); }
    catch (e) { return new Set(); }
  }
  function markTip(id) {
    try { const s = tipsSeen(); s.add(id); localStorage.setItem(TIP_KEY, [...s].join(',')); } catch (e) {}
  }
  function hideCoach() {
    coachShowing = null; coachUntil = 0;
    if (coachPaused && app && app.resumeFromOverlay) app.resumeFromOverlay();
    coachPaused = false;
    if (el.coach) el.coach.className = '';
  }
  function showCoach(id, html, ms, nowMs) {
    markTip(id); coachShowing = id;
    el.coach.innerHTML = '<span class="coach-x">✕</span>' + html;
    el.coach.className = 'show';
    // Auto-pause the simulation while a coach prompt is on screen, so game
    // days don't tick past unnoticed. It resumes the moment the player acts
    // on the tip or dismisses it (✕ / click / acting on the lesson).
    coachUntil = Infinity;
    if (!coachPaused && app && app.pauseForOverlay) { app.pauseForOverlay(); coachPaused = true; }
  }

  function updateTutorial(state, nowMs) {
    if (!el.coach) return;
    const civ = state.civ, cl = state.cl;
    if (coachShowing && nowMs > coachUntil) hideCoach();
    // Dismiss a tip early once its lesson is acted on.
    if (coachShowing === 't-dehydrate' && civ.order === 'dehydrate') hideCoach();
    if (coachShowing === 't-rehydrate' && civ.order === 'rehydrate') hideCoach();
    if (coachShowing === 't-calendar' && state.calendar) hideCoach();
    // Never leave a paused coach prompt up if the run ends or the seed goes dormant.
    if (coachShowing && (state.over || !civ.alive || civ.dormant)) hideCoach();
    if (overlayOpen || state.over || !civ.alive || civ.dormant || coachShowing) return;

    const seen = tipsSeen();
    const sust = V.sustainablePop(civ, cl), fd = V.foodDays(civ);
    const fire = (id, cond, html, ms?) => {
      if (!seen.has(id) && cond) { showCoach(id, html, ms, nowMs); return true; }
      return false;
    };
    if (fire('t-dehydrate',
        civ.popH > 0 && civ.order !== 'dehydrate' && (cl.tempC < -6 || cl.tempC > 43),
        'The sky has turned deadly. Press <kbd>D</kbd> — <b>Dehydrate</b> — to wring your people into dry seed before the cold or heat takes them. The stored feel nothing.')) return;
    if (fire('t-rehydrate',
        cl.eraType === 'stable' && civ.popD > 0.5 && cl.tempC > 2 && cl.tempC < 36 &&
        civ.order !== 'rehydrate' && civ.water > civ.popD * 0.3,
        'A <b>Stable Era</b> — the sky is kind. Press <kbd>R</kbd> to <b>Rehydrate</b> the stored, and let your people live, grow, and learn.')) return;
    if (fire('t-reserves',
        civ.popH > sust * 1.4 && fd < 25 && fd > 0,
        'You cannot keep everyone awake — the fields can\'t feed them. Set the order size to <b>⅓</b>, then <b>Dehydrate</b>: keep a workforce, store the rest, and your grain will last.')) return;
    if (fire('t-calendar',
        cl.eraType === 'stable' && (state.day - cl.eraStartDay) > 60 && !state.calendar && civ.popH > 1,
        'Confident the calm will hold? Run the <b>Computer</b> <kbd>C</kbd> to forecast, then publish a <b>Calendar</b> <kbd>P</kbd>. Be right and a golden age follows — be wrong, and the people are caught in the open.')) return;
    if (fire('t-records',
        civ.ageIdx >= 5 && state.day > 400,
        'Open <b>Records</b> <kbd>L</kbd> any time to re-read the story, review your chronicle, and see how far this civilization has come.')) return;
  }

  // The advisory pill: the single most pressing deadline, or a calm note,
  // plus the active calendar's verdict countdown.
  function updateAdvisory(state) {
    const civ = state.civ;
    if (state.over) { el.advisory.className = ''; return; }
    // A reborn civilization waits underground as a dehydrated seed until the
    // sky is livable. Say so plainly, or the world looks dead and "stuck."
    if (!civ.alive || civ.dormant) {
      el.advisory.className = 'show calm';
      const T = Math.round(state.cl.tempC);
      const livable = T >= 0 && T <= 38;
      el.advisory.innerHTML = '<b>SEED DORMANT</b> &nbsp;<span class="adv-advice">' +
        (livable
          ? 'The sky is livable — the buried seed of Civilization No. ' + civ.no +
            ' will germinate within days. Let time run.'
          : 'A buried seed of Civilization No. ' + civ.no + ' waits for a livable sky ' +
            '(0–38°C). Speed up time [2–4] and watch the temperature.') + '</span>';
      return;
    }
    const o = V.outlook(civ, state.cl);
    let cls = 'calm', html;
    if (o.threat) {
      cls = o.threat.severity === 'crit' ? 'crit' : 'warn';
      const when = o.threat.days < 1 ? 'now' : 'in ~' + U.fmtDays(o.threat.days);
      html = '<b>' + o.threat.label + '</b> &nbsp;<span class="adv-when">' + when +
        '</span> &nbsp;<span class="adv-advice">' + o.threat.advice + '</span>';
    } else if (civ.order !== 'none' && isFinite(o.orderEta)) {
      cls = 'calm';
      html = '<b>' + (civ.order === 'dehydrate' ? 'DEHYDRATING' : 'REHYDRATING') +
        '</b> &nbsp;<span class="adv-when">done in ~' + U.fmtDays(Math.max(o.orderEta, 0.5)) +
        '</span>';
    } else if (civ.order === 'rehydrate' && !isFinite(o.orderEta)) {
      cls = 'warn';
      html = '<b>REHYDRATION STALLED</b> &nbsp;<span class="adv-advice">' +
        (civ.water < 1 ? 'the cisterns are dry' : 'the lakes are frozen or boiling') + '</span>';
    } else {
      cls = 'calm';
      const sust = V.sustainablePop(civ, state.cl);
      const note = state.cl.eraType === 'stable'
        ? 'Stable skies — build and grow while it lasts.'
        : 'Chaotic, but survivable for now. Watch the sky.';
      html = '<b>STEADY</b> &nbsp;<span class="adv-advice">' + note + '</span>';
    }
    el.advisory.className = 'show ' + cls;
    el.advisory.innerHTML = html;
  }

  function updateHud(state) {
    const civ = state.civ, cl = state.cl;
    el.hudCiv.innerHTML = '<span class="label">Civilization</span>No. ' + civ.no +
      (civ.dormant ? ' · seed' : '');
    const eraDays = Math.floor(state.day - cl.eraStartDay);
    el.hudEra.innerHTML = '<span class="label">' + C.eraLabel(cl) + '</span>' +
      (cl.eraType === 'stable' ? 'STABLE' : 'CHAOTIC') + ' · day ' + eraDays;
    el.hudEra.className = 'hud-block ' + cl.eraType;
    el.hudDate.innerHTML = '<span class="label">Calendar</span>' +
      U.fmtDate(state.day - civ.foundedDay);
    el.hudTemp.innerHTML = '<span class="label">Surface</span>' + U.fmtTemp(cl.tempC);
    el.hudTemp.className = 'hud-block ' +
      (cl.tempC < -10 ? 't-cold' : cl.tempC > 45 ? 't-hot' : 't-ok');
    el.hudPop.innerHTML = '<span class="label">Population</span>' +
      U.fmtPop(civ.popH) + ' · ' + U.fmtPop(civ.popD) + ' stored';

    // Reserves: water (gates rehydration) and grain (days of food left).
    const wCap = V.waterCap(civ), gCap = V.grainCap(civ);
    const wFrac = U.clamp(civ.water / wCap, 0, 1);
    const gFrac = U.clamp(civ.grain / gCap, 0, 1);
    const fdays = V.foodDays(civ);
    const dormant = civ.dormant || !civ.alive;
    el.hudWater.innerHTML = '<span class="label">Water</span>' +
      (dormant ? '—' : Math.round(civ.water) + ' / ' + Math.round(wCap)) +
      '<span class="meter"><i style="width:' + (wFrac * 100).toFixed(0) + '%"></i></span>';
    el.hudWater.className = 'hud-block' + (!dormant && wFrac < 0.12 ? ' low' : '');
    el.hudGrain.innerHTML = '<span class="label">Grain</span>' +
      (dormant ? '—' : (isFinite(fdays) ? Math.round(fdays) + 'd food' : 'ample')) +
      '<span class="meter"><i style="width:' + (gFrac * 100).toFixed(0) + '%"></i></span>';
    el.hudGrain.className = 'hud-block' + (!dormant && civ.popH > 0 && fdays < 15 ? ' low' : '');

    el.hudAge.innerHTML = '<span class="label">Era of</span>' + V.AGES[civ.ageIdx].name;
    el.hudTrust.innerHTML = '<span class="label">Trust</span>' + Math.round(civ.trust * 100) + '%';
    el.hudWorlds.innerHTML = '<span class="label">Worlds left</span>' + state.planetsLeft + ' / 12';
    if (el.hudScore) {
      const lvl = state.level >= 0 && Sc.LEVELS[state.level];
      el.hudScore.innerHTML = '<span class="label">' +
        (lvl ? 'Lvl ' + (state.level + 1) + ' · Score' : 'Score') + '</span>' +
        (state.score || 0).toLocaleString();
    }

    // Buttons.
    const noCiv = !civ.alive || civ.dormant || state.over;
    el.btnDe.disabled = noCiv || civ.popH <= 0 || civ.order === 'dehydrate';
    el.btnRe.disabled = noCiv || civ.popD <= 0 || civ.order === 'rehydrate';
    el.btnHold.disabled = noCiv || civ.order === 'none';
    el.btnDe.className = civ.order === 'dehydrate' ? 'engaged' : '';
    el.btnRe.className = civ.order === 'rehydrate' ? 'engaged' : '';
    el.btnProc.disabled = noCiv || !!state.calendar || cl.eraType !== 'stable';
    el.btnOrbit.classList.toggle('locked', !state.flags.orbit);
    el.btnComp.classList.toggle('locked', !state.flags.computer);
    el.btnAuto.classList.toggle('locked', !state.flags.autoUnlocked);
    el.btnAuto.classList.toggle('engaged', !!civ.autoProtocol);
    el.btnAuto.disabled = !state.flags.autoUnlocked;
    el.btnDoctrine.disabled = noCiv;
    el.btnDoctrine.classList.toggle('attention', !noCiv && civ.insight > 0);
    const fleetReady = state.flags.escape && civ.ageIdx >= 12;
    el.btnFleet.classList.toggle('hidden', !fleetReady || civ.fleet.ships >= V.consts.FLEET_SHIPS);
    el.btnFleet.disabled = civ.fleet.building || noCiv;
    el.btnFleet.classList.toggle('attention', fleetReady && !civ.fleet.building);

    // Danger hint: pulse Dehydrate when the sky turns lethal.
    const danger = !noCiv && civ.popH > 0 && civ.order !== 'dehydrate' &&
      (cl.tempC < -5 || cl.tempC > 42);
    el.btnDe.classList.toggle('attention', danger);

    // Fleet bar.
    if (civ.fleet.building || (fleetReady && civ.fleet.ships > 0)) {
      el.fleetbar.style.display = 'block';
      el.fleetbar.textContent = 'TRISOLARAN FLEET: ' + Math.floor(civ.fleet.ships) +
        ' / ' + V.consts.FLEET_SHIPS + ' ships';
    } else el.fleetbar.style.display = 'none';

    // Calendar status.
    if (state.calendar) {
      const p = state.calendar;
      el.procStatus.style.display = 'block';
      el.procStatus.textContent = 'CALENDAR: ' +
        (p.kind === 'stable' ? 'Stable Era holds' : 'Chaos foretold') +
        ' · ' + U.fmtDays(Math.max(0, p.endDay - state.day)) + ' to verdict';
    } else el.procStatus.style.display = 'none';
  }

  function updateLog(state) {
    const log = state.log;
    const stamp = log.length + ':' + (log.length ? log[log.length - 1].day + log[log.length - 1].text : '');
    if (stamp === lastLogStamp) return;
    lastLogStamp = stamp;
    let html = '';
    for (let i = log.length - 1; i >= Math.max(0, log.length - 40); i--) {
      const e = log[i];
      html += '<div class="entry ' + e.cls + '"><span class="d">d' + e.day + '</span>' +
        escapeHtml(e.text) + '</div>';
    }
    el.log.innerHTML = html;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ----------------------------------------------------------
  // Banners
  // ----------------------------------------------------------
  function pushBanner(text, style) {
    bannerQueue.push({ text, style });
    // Never fall behind a fast-flapping sky: keep only the newest few.
    if (bannerQueue.length > 4) bannerQueue.splice(0, bannerQueue.length - 4);
  }
  function updateBanner(nowMs) {
    if (bannerUntil > nowMs) return;
    if (el.banner.classList.contains('show')) {
      el.banner.classList.remove('show');
      bannerUntil = nowMs + 350;
      return;
    }
    const b = bannerQueue.shift();
    if (!b) return;
    el.banner.textContent = b.text;
    el.banner.className = 'show ' + (b.style || '');
    bannerUntil = nowMs + 2400;
  }

  // ----------------------------------------------------------
  // Pending events from the game → banners, overlays, stingers
  // ----------------------------------------------------------
  function handlePending(state) {
    if (!state.pending.length) return;
    const items = state.pending.splice(0);
    for (const it of items) {
      switch (it.kind) {
        case 'banner':
          pushBanner(it.text, it.style);
          Audio.sting(stingFor(it.style));
          // Juice: one event, several senses.
          if (it.style === 'syzygy') { render.addShake(0.55); render.flash('255,90,90', 0.16); }
          else if (it.style === 'hot') { render.addShake(0.25); render.flash('255,180,100', 0.12); }
          else if (it.style === 'cold') { render.flash('150,200,255', 0.10); }
          else if (it.style === 'bad') { render.addShake(0.3); }
          if (['hot', 'syzygy', 'cold'].includes(it.style) && app.speedIdx > 2) {
            app.setSpeed(1);
          }
          break;
        case 'beat':
          overlayQueue.push({ type: 'beat', beat: it.beat });
          break;
        case 'notice':
          overlayQueue.push({ type: 'notice', notice: it.notice });
          break;
        case 'destroyed':
          Audio.sting('death');
          render.addShake(0.45);
          render.flash('255,70,70', 0.2);
          overlayQueue.push({ type: 'destroyed', text: it.text, civNo: it.civNo });
          break;
        case 'planet-lost': {
          Audio.sting('death');
          render.addShake(0.9);
          render.flash('255,255,255', 0.3);
          Charts.resetTrail();   // the orbit map starts fresh on the new world
          render.reseedTerrain(it.planetsLeft);   // new world, new mountains
          let txt = it.text;
          if (it.planetsLeft > 0 && render.setBiome) {
            const wname = render.setBiome(12 - it.planetsLeft);   // new world, new face
            if (wname) txt += '\n\nThe seed is carried down to a new world: ' + wname + '.';
          }
          overlayQueue.push({ type: 'planet-lost', text: txt, planetsLeft: it.planetsLeft });
          break;
        }
        case 'ending':
          Audio.sting('fleet');
          render.flash('150,255,190', 0.18);
          app.recordResult(state.level, (it.stats && it.stats.score) || 0);  // final level won
          overlayQueue.push({ type: 'ending', ending: it.ending, stats: it.stats });
          break;
        case 'silence':
          Audio.sting('death');
          overlayQueue.push({ type: 'silence', text: it.text, stats: it.stats });
          break;
        case 'objective':
          // A core lesson learned — gentle, non-modal acknowledgement.
          pushBanner('✓ ' + it.text, 'good');
          Audio.sting('germinate');
          break;
        case 'level-complete':
          app.recordResult(it.level, it.score);
          Audio.sting('age');
          render.flash('150,255,190', 0.16);
          overlayQueue.push({ type: 'level-complete', item: it });
          break;
      }
    }
    if (overlayQueue.length && !overlayOpen) showNextOverlay();
  }

  function stingFor(style) {
    return { stable: 'stable', chaotic: 'chaotic', hot: 'hot', cold: 'cold',
             syzygy: 'syzygy', age: 'age', good: 'germinate', bad: 'chaotic' }[style] || null;
  }

  // ----------------------------------------------------------
  // Overlays
  // ----------------------------------------------------------
  function showNextOverlay() {
    const item = overlayQueue.shift();
    if (!item) { closeOverlay(); return; }
    if (!overlayOpen) app.pauseForOverlay();   // one pause per open session
    overlayOpen = true;
    // A soft chime announces a story beat / notice — the "feels good" cue,
    // distinct from the harsh event stingers.
    if (item.type === 'beat' || item.type === 'notice') Audio.sting('beat');
    if (item.type === 'beat') renderBeat(item.beat, 0);
    else if (item.type === 'notice') renderSimple(item.notice.title, item.notice.text, 'notice-d', 'Continue');
    else if (item.type === 'destroyed') renderSimple('CIVILIZATION DESTROYED', item.text, 'registrar', 'Log in again');
    else if (item.type === 'planet-lost') renderSimple('THE WORLD IS LOST', item.text, 'registrar', 'Continue');
    else if (item.type === 'ending') renderEnding(item, 0);
    else if (item.type === 'silence') renderSilence(item);
    else if (item.type === 'level-complete') renderLevelComplete(item.item);
  }

  function closeOverlay() {
    cancelTyper();
    if (overlayQueue.length) { showNextOverlay(); return; }
    overlayOpen = false;
    el.overlay.classList.remove('show');
    // Clear after the fade-out so the dialog doesn't blink away mid-transition.
    setTimeout(() => { if (!overlayOpen) el.overlay.innerHTML = ''; }, 260);
    app.resumeFromOverlay();
  }

  function dialogShell(cls, inner) {
    cancelTyper();
    el.overlay.innerHTML = '<div class="dialog ' + cls + '">' + inner + '</div>';
    // Force a reflow-free next-frame so the opacity transition actually runs.
    el.overlay.classList.add('show');
  }

  // Typewriter reveal: text arrives like a transmission, not a wall slammed
  // onto the screen. Click/Enter completes it instantly (then advances).
  function startType(elText, text) {
    cancelTyper();
    if (!elText) return;
    if (globalThis.__TB_NOTYPE__) { elText.textContent = text; return; }  // headless
    elText.textContent = '';
    elText.classList.add('typing');
    let i = 0;
    const tick = () => {
      i = Math.min(text.length, i + 2);        // a couple of glyphs per frame
      elText.textContent = text.slice(0, i);
      if (i >= text.length) finishTyper();
    };
    typer = { el: elText, full: text, timer: setInterval(tick, 16) };
  }
  function finishTyper() {
    if (typer && typer.timer) { clearInterval(typer.timer); typer.timer = null; }
    if (typer && typer.el) typer.el.classList.remove('typing');
  }
  function cancelTyper() {
    if (typer && typer.timer) clearInterval(typer.timer);
    typer = null;
  }
  function isTyping() { return !!(typer && typer.timer); }
  function finishTypingNow() { if (typer) { typer.el.textContent = typer.full; finishTyper(); } }

  function portraitHtml(speaker) {
    return Portraits
      ? '<div class="portrait">' + Portraits.svg(speaker) + '</div>'
      : '<div class="glyph">三</div>';
  }

  function renderBeat(beat, page) {
    const p = beat.pages[page];
    const last = page === beat.pages.length - 1;
    dialogShell('', `
      ${beat.id ? art('docs/media/beats/' + beat.id + '.jpg', 'beat-art') : ''}
      <h2>${escapeHtml(beat.title)}</h2>
      <div class="speaker">
        ${portraitHtml(p.speaker)}
        <div class="who">${escapeHtml(p.speaker)}</div>
      </div>
      <div class="text"></div>
      <div class="btnrow">
        <span class="pageno">${page + 1} / ${beat.pages.length}</span>
        <button class="primary">${last ? 'Close' : 'Next'}</button>
      </div>`);
    startType(el.overlay.querySelector('.text'), p.text);
    el.overlay.querySelector('button.primary').onclick = () => {
      if (isTyping()) { finishTypingNow(); return; }   // first press completes the line
      if (last) closeOverlay(); else renderBeat(beat, page + 1);
    };
  }

  function renderSimple(title, text, cls, btnLabel) {
    dialogShell(cls, `
      <h2>${escapeHtml(title)}</h2>
      <div class="text"></div>
      <div class="btnrow"><button class="primary">${btnLabel}</button></div>`);
    startType(el.overlay.querySelector('.text'), text);
    el.overlay.querySelector('button.primary').onclick = () => {
      if (isTyping()) { finishTypingNow(); return; }
      closeOverlay();
    };
  }

  function renderEnding(item, page) {
    const pages = item.ending.pages;
    if (page < pages.length) {
      dialogShell('ending-d', `
        <h2>${escapeHtml(item.ending.title)}</h2>
        <div class="text">${escapeHtml(pages[page])}</div>
        <div class="btnrow">
          <span class="pageno">${page + 1} / ${pages.length + 1}</span>
          <button class="primary">Next</button>
        </div>`);
      el.overlay.querySelector('button.primary').onclick = () => renderEnding(item, page + 1);
      return;
    }
    const s = item.stats;
    dialogShell('ending-d', `
      ${art('docs/media/end/fleet.jpg', 'end-art')}
      <h2>YOU HAVE UNDERSTOOD TRISOLARIS</h2>
      <div class="stats">
        Years beneath the three suns: <b>${s.years}</b><br>
        Civilizations destroyed: <b>${s.civsLost}</b> (last: No. ${s.lastCivNo})<br>
        Worlds consumed: <b>${s.planetsLost}</b><br>
        Calendars fulfilled / failed: <b>${s.proclaimOk} / ${s.proclaimBad}</b><br>
        Highest age: <b>${s.maxAge}</b><br>
        Final score: <b>${(s.score || 0).toLocaleString()}</b> — ${escapeHtml(s.title || '')} ${starStr(s.stars || 0)}
      </div>
      <div class="btnrow">
        <button id="end-watch">Keep watching the suns</button>
        <button class="primary" id="end-new">Title</button>
      </div>`);
    $('end-watch').onclick = () => { app.sandboxContinue(); closeOverlay(); };
    $('end-new').onclick = () => { closeOverlay(); app.showTitle(); };
  }

  function renderSilence(item) {
    const s = item.stats;
    dialogShell('registrar', `
      ${art('docs/media/end/silence.jpg', 'end-art')}
      <h2>${escapeHtml(Story.SILENCE.title)}</h2>
      <div class="text">${escapeHtml(item.text)}</div>
      <div class="stats">
        Years beneath the three suns: <b>${s.years}</b> ·
        Civilizations: <b>${s.civsLost}</b> ·
        Highest age: <b>${s.maxAge}</b> ·
        Score: <b>${(s.score || 0).toLocaleString()}</b>
      </div>
      <div class="btnrow"><button class="primary" id="end-new">Begin again</button></div>`);
    $('end-new').onclick = () => { closeOverlay(); app.showTitle(); };
  }

  // Star string for a 0–3 rank.
  // Optional generated artwork: shows the image if the file exists, and
  // silently removes itself (falling back to text/SVG) if it 404s.
  function art(src, cls) {
    return '<img class="' + cls + '" src="' + src + '" alt="" onerror="this.remove()">';
  }
  function starStr(n) { return '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n)); }
  function bestFor(level) {
    const p = app.getProgress();
    const id = (Sc.LEVELS[level] || ({} as any)).id;
    return (p.best && id && p.best[id]) || 0;
  }

  // The non-terminal "level complete" card: rank, score, best, and where next.
  function renderLevelComplete(item) {
    const next = item.level + 1;
    const hasNext = next < Sc.LEVELS.length;
    const fig = (Sc.LEVELS[item.level] || ({} as any)).figure;
    dialogShell('notice-d', `
      ${art('docs/media/levels/l' + (item.level + 1) + '.jpg', 'lc-art')}
      <h2>LEVEL ${item.level + 1} COMPLETE — ${escapeHtml(item.name)}</h2>
      <div class="stars-big">${starStr(item.stars)}</div>
      ${fig ? '<div class="speaker"><div class="glyph">' + fig.glyph + '</div>' +
              '<div class="who">' + escapeHtml(fig.name) + '</div></div>' +
              '<div class="text lc-line">' + escapeHtml(fig.line) + '</div>' : ''}
      <div class="stats">
        Score: <b>${item.score.toLocaleString()}</b> — ${escapeHtml(item.title)}<br>
        Best for this level: <b>${bestFor(item.level).toLocaleString()}</b>
        ${hasNext ? '<br>Unlocked: <b>Level ' + (next + 1) + ' · ' + escapeHtml(Sc.LEVELS[next].name) + '</b>' : ''}
      </div>
      <div class="btnrow">
        <button id="lc-stay">Keep playing</button>
        ${hasNext ? '<button class="primary" id="lc-next">Next level</button>'
                  : '<button class="primary" id="lc-title">Title</button>'}
      </div>`);
    if ($('lc-stay')) $('lc-stay').onclick = closeOverlay;
    if ($('lc-next')) $('lc-next').onclick = () => { closeOverlay(); app.startLevel(next); };
    if ($('lc-title')) $('lc-title').onclick = () => { closeOverlay(); app.showTitle(); };
  }

  // ----------------------------------------------------------
  // Proclaim & help dialogs (user-invoked overlays)
  // ----------------------------------------------------------
  function openProclaim() {
    const st = app.state;
    if (!st || st.calendar || st.over || st.civ.dormant || overlayOpen) return;
    if (st.cl.eraType !== 'stable') {
      app.pauseForOverlay();
      overlayOpen = true;
      renderSimple('NO CALENDAR UNDER A CHAOTIC SKY', 'The sky is already chaos — there is ' +
        'nothing to predict about it. Wait for a Stable Era; then publish a calendar ' +
        'declaring how long the calm will hold, or warning when it will break.',
        'notice-d', 'Understood');
      return;
    }
    app.pauseForOverlay();
    overlayOpen = true;

    // Forecast guidance from the Computer, if one has been run.
    const fc = Charts.lastForecastInfo(st.day);
    let guide;
    if (!fc) {
      guide = 'No forecast stands. Run the COMPUTER [C] first to see how far the ' +
        'futures agree before you stake the people on a calendar.';
    } else if (fc.confident) {
      guide = 'The Computer\'s ensemble agrees across its whole ' + fc.days +
        '-day window' + (fc.ageDays > 60 ? ' (but that reading is ' + fc.ageDays + ' days old)' : '') +
        '. A bold Stable calendar looks safe.';
    } else {
      guide = 'The Computer\'s chaos horizon is ~' + fc.horizonDay + ' days out' +
        (fc.ageDays > 60 ? ' (reading ' + fc.ageDays + ' days old)' : '') +
        '. Beyond it the futures disagree — predict past it at your peril.';
    }

    dialogShell('notice-d', `
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
    el.overlay.querySelectorAll('.choices button').forEach(b => {
      b.onclick = () => {
        G.cmdProclaim(st, b.dataset.k, +b.dataset.d);
        closeOverlay();
      };
    });
    $('proc-cancel').onclick = closeOverlay;
  }

  function openHelp() {
    if (overlayOpen) return;
    app.pauseForOverlay();
    overlayOpen = true;
    dialogShell('notice-d', `
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
    el.overlay.querySelector('button.primary').onclick = closeOverlay;
  }

  // ----------------------------------------------------------
  // Panels
  // ----------------------------------------------------------
  // ----------------------------------------------------------
  // Doctrines overlay
  // ----------------------------------------------------------
  function openDoctrines() {
    const st = app.state;
    if (!st || st.over || !st.civ.alive || overlayOpen) return;
    app.pauseForOverlay();
    overlayOpen = true;
    renderDoctrines(st);
  }
  function renderDoctrines(st) {
    const civ = st.civ;
    const branches = V.DOCTRINES.map(b => {
      const next = V.nextTier(b, civ.doctrines);
      const tiers = b.tiers.map(t => {
        const owned = !!civ.doctrines[t.id];
        const buyable = !owned && next === t && civ.insight >= t.cost;
        const cls = owned ? 'owned' : (buyable ? 'buyable' : 'locked');
        const tag = owned ? '<span class="dt-tag">ADOPTED</span>'
                          : '<span class="dt-cost">' + t.cost + ' ◆</span>';
        return '<div class="dtier ' + cls + '" data-id="' + t.id + '">' +
          '<div class="dt-head"><b>' + escapeHtml(t.name) + '</b>' + tag + '</div>' +
          '<div class="dt-desc">' + escapeHtml(t.desc) + '</div></div>';
      }).join('');
      return '<div class="branch"><h4>' + escapeHtml(b.name) + '</h4>' +
        '<div class="bblurb">' + escapeHtml(b.blurb) + '</div>' + tiers + '</div>';
    }).join('');
    dialogShell('notice-d', `
      <h2>DOCTRINES <span class="ins-bal">${civ.insight} ◆ Insight</span></h2>
      <div class="text" style="font-size:12px; font-family:var(--mono); line-height:1.7; margin-bottom:16px;">Each new age — and each Calendar you keep — grants <b>Insight ◆</b>. Spend it to shape the civilization: read the sky farther, outlast it longer, or drive harder toward escape. Tiers unlock in order, and a doctrine, once learned, outlives the seed.</div>
      <div class="doctrines">${branches}</div>
      <div class="btnrow"><button class="primary" id="dx-close">Close</button></div>`);
    el.overlay.querySelectorAll('.dtier.buyable').forEach(d => {
      d.onclick = () => { if (G.cmdBuyDoctrine(st, d.dataset.id)) renderDoctrines(st); };
    });
    $('dx-close').onclick = closeOverlay;
  }

  function togglePanel(tab, forceClose?) {
    if (panelOpen && (panelTab === tab || forceClose)) {
      panelOpen = false;
      el.panel.classList.remove('open');
      return;
    }
    panelTab = tab;
    panelOpen = true;
    el.panel.classList.add('open');
    setTab(tab);
    setTimeout(sizePanelCanvas, 280);
  }

  function setTab(tab) {
    panelTab = tab;
    el.tabObs.classList.toggle('active', tab === 'obs');
    el.tabOrbit.classList.toggle('active', tab === 'orbit');
    el.tabComp.classList.toggle('active', tab === 'comp');
    if (el.tabCodex) el.tabCodex.classList.toggle('active', tab === 'codex');
    el.panel.classList.toggle('codex-open', tab === 'codex');
    const st = app.state;
    el.tabOrbit.disabled = !st.flags.orbit;
    el.tabComp.disabled = !st.flags.computer;
    // Per-tab controls.
    let html = '';
    if (tab === 'obs') {
      html = '<button id="pc-div">Cast the hexagrams</button>' +
             (st.flags.mozi ? '<button id="pc-mozi">Wind Mozi\'s machine</button>' : '') +
             '<span>Watch the suns. Patterns are a hope; measurement is a beginning.</span>';
    } else if (tab === 'orbit') {
      html = '<span>The true configuration, as no Trisolaran eye has seen it.</span>';
    } else if (tab === 'comp') {
      html = '<button id="pc-run">RUN FORECAST</button>' +
             '<span>Qin I: 30,000,000 soldiers · ensemble of 7 futures</span>';
    } else if (tab === 'codex') {
      html = '<span>The records of every life lived beneath the three suns.</span>';
    }
    el.panelControls.innerHTML = html;
    const bDiv = $('pc-div'), bMozi = $('pc-mozi'), bRun = $('pc-run');
    if (bDiv) bDiv.onclick = () => Charts.rollDivination(app.state);
    if (bMozi) bMozi.onclick = () => Charts.runMozi(app.state);
    if (bRun) bRun.onclick = () => { if (!Charts.isComputing()) Charts.requestForecast(app.state); };
    if (tab === 'codex') renderCodex(st);
  }

  function drawPanel(state, nowMs) {
    if (panelTab === 'codex') { renderCodex(state); return; }   // DOM, not canvas
    const r = el.panelBody.getBoundingClientRect();
    const w = r.width, h = r.height;
    if (w < 10 || h < 10) return;
    pctx.clearRect(0, 0, w, h);
    if (panelTab === 'obs') Charts.drawObservatory(pctx, state, w, h);
    else if (panelTab === 'orbit') Charts.drawOrbit(pctx, state, w, h);
    else if (panelTab === 'comp') Charts.drawComputer(pctx, state, w, h, nowMs);
  }

  // ----------------------------------------------------------
  // CODEX / RECORDS — re-readable story, run stats, the chronicle
  // ----------------------------------------------------------
  let codexStamp = '';
  function renderCodex(state) {
    const civ = state.civ;
    // Only rebuild when something meaningful changed (cheap throttle).
    const stamp = Object.keys(state.story.seenBeats).length + ':' + state.log.length +
      ':' + state.stats.civsLost + ':' + civ.ageIdx + ':' + civ.insight +
      ':' + Object.keys(civ.doctrines).length;
    if (stamp === codexStamp) return;
    codexStamp = stamp;

    const yrs = Math.floor(state.day / 365.25);
    const allBeats = Story.BEATS.concat(Object.keys(Story.MOMENTS).map(k => Story.MOMENTS[k]));
    const seen = allBeats.filter(b => state.story.seenBeats[b.id]);

    let html = '<h3>This Run</h3><div class="stat-grid">' +
      row('Civilization', 'No. ' + civ.no) +
      row('Age', V.AGES[civ.ageIdx].name) +
      row('Years endured', yrs) +
      row('Worlds left', state.planetsLeft + ' / 12') +
      row('Civilizations lost', state.stats.civsLost) +
      row('Worlds consumed', state.stats.planetsLost) +
      row('Calendars kept / broken', state.stats.proclaimOk + ' / ' + state.stats.proclaimBad) +
      row('Peak population', U.fmtPop(civ.peakPop)) +
      '</div>';

    html += '<h3>Doctrines &nbsp;·&nbsp; ' + civ.insight + ' ◆ Insight</h3>';
    const owned = [];
    for (const b of V.DOCTRINES) for (const t of b.tiers) if (civ.doctrines[t.id]) owned.push(t.name);
    if (!owned.length) html += '<div class="empty">No doctrines adopted. Press V to spend Insight.</div>';
    else html += '<div style="line-height:1.9">' + owned.map(escapeHtml).join(' · ') + '</div>';

    html += '<h3>The Story So Far</h3>';
    if (!seen.length) html += '<div class="empty">No revelations yet. Play on.</div>';
    else html += seen.map(b =>
      '<button class="beat-btn" data-beat="' + b.id + '">' +
      '<span class="bk">' + (Story.MOMENTS[b.id] ? 'moment' : 'chapter') + '</span><br>' +
      escapeHtml(b.title) + '</button>').join('');

    html += '<h3>Chronicle</h3><div class="chron">';
    const log = state.log.slice(-60).reverse();
    if (!log.length) html += '<div class="empty">—</div>';
    else html += log.map(e =>
      '<div class="row ' + (e.cls || '') + '"><span class="d">d' + e.day + '</span>' +
      escapeHtml(e.text) + '</div>').join('');
    html += '</div>';

    el.codex.innerHTML = html;
    el.codex.querySelectorAll('.beat-btn').forEach(b => {
      b.onclick = () => openBeatForReading(b.dataset.beat);
    });
  }
  function row(k, v) { return '<div><span>' + k + '</span><b>' + v + '</b></div>'; }

  // Re-open a story beat from the Codex (read-only; pauses like a normal beat).
  function openBeatForReading(id) {
    if (overlayOpen) return;
    const beat = Story.BEATS.find(b => b.id === id) || (Story.MOMENTS || {})[id];
    if (!beat) return;
    app.pauseForOverlay();
    overlayOpen = true;
    renderBeat(beat, 0);
  }

export const isOverlayOpen = () => overlayOpen;
export { init, update, handlePending, pushBanner };
