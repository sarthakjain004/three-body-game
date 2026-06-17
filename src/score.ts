/* ============================================================
 * THREE BODY — score.ts
 * Levels, objectives and scoring. Pure logic, no DOM — the same
 * code runs in the browser and headless in Node (it is part of
 * the deterministic game state, so verify/smoke exercise it).
 *
 * Three layers:
 *   • LEVELS    — a ladder of vetted systems, each with a goal that
 *                 the engine already detects (an age milestone / the
 *                 fleet launch). Completing one unlocks the next.
 *   • objectives— live guidance: the level's goal + the single most
 *                 useful next step + four one-time "teach the loop"
 *                 objectives.
 *   • score     — a pure function of game state, recomputed each tick.
 * ============================================================ */
import * as V from './civ';
import type { GameState, Level, Objective } from './types';

// ---- Scoring weights (tunable) ----
export const SCORE = {
  AGE: 1000,         // per age advanced beyond the Warring-States start
  PEAKPOP: 8,        // per million at peak population
  YEAR: 3,           // per game-year survived
  CAL_OK: 600,       // per calendar kept
  CAL_BAD: 150,      // per calendar broken (penalty)
  TRUST: 600,        // × current trust (0..1)
  DOCTRINE: 250,     // per doctrine adopted
  OBJECTIVE: 200,    // per one-time teaching objective completed
  CIV_LOST: 300,     // per civilization lost (penalty)
  PLANET_LOST: 800,  // per world consumed (penalty)
  LEVEL: 5000,       // bonus for completing the level's goal
  WIN: 15000,        // bonus for launching the fleet
};

const START_AGE = 3;   // civilizations begin at the Warring States Level (civ.ts)

// ---- The level ladder ----
// Seeds are the kinder→crueler vetted pool (src/seeds.ts). Each goal is a
// milestone the engine already tracks via state.stats.maxAge / state.won.
function ageGoal(target: number, name: string, id: string, nm: string, seed: number,
                 stars: [number, number, number],
                 figure: { name: string; glyph: string; line: string }): Level {
  return {
    id, name: nm, seed,
    goalText: 'Advance your civilization to the ' + name + '.',
    done: (s: GameState) => s.stats.maxAge >= target,
    stars, figure,
  };
}

// Each level is the chapter of the figure it ends on (the beat that fires at
// its goal age — see story.ts). The figure speaks on the level-complete card.
export const LEVELS: Level[] = [
  ageGoal(4,  'Imperial Level',        'l1', "Mozi's Machine",       6021, [1500, 3000, 5000],
    { name: 'Mozi', glyph: '墨', line: 'You kept them alive to the age of measurement. Take my celestial sphere — but trust it only while the sky keeps its track.' }),
  ageGoal(5,  'Medieval Level',        'l2', 'The Almanac',          4014, [3000, 6000, 10000],
    { name: 'Friar Bacon', glyph: '✚', line: 'Your people have an Almanac of the sun now. Read it in the calm — and shut it the moment the suns run wild.' }),
  ageGoal(6,  'Renaissance Level',     'l3', 'The Three Suns',       8021, [6000, 11000, 18000],
    { name: 'Copernicus', glyph: '☉', line: 'You have seen what no Trisolaran eye has seen: three suns, and no solution. The Second Level is yours.' }),
  ageGoal(8,  'Industrial Revolution', 'l4', 'The Human Computer',   4238, [12000, 20000, 30000],
    { name: 'Von Neumann', glyph: '⚙', line: 'Thirty million flags rose at your command and computed the heavens. Calculation has a dynasty now.' }),
  ageGoal(10, 'Atomic Age',            'l5', 'The Pendulum',         5063, [20000, 32000, 46000],
    { name: 'Einstein', glyph: '𝑒', line: 'Finer instruments, longer sight — and still the fan opens. Prediction has a horizon, and now you know it.' }),
  ageGoal(11, 'Information Age',        'l6', 'The Goal Has Changed', 7014, [30000, 45000, 62000],
    { name: 'The Announcement', glyph: '三', line: 'There is nothing left to predict. There is only somewhere to go. Build the fleet.' }),
  {
    id: 'l7', name: 'Escape', seed: 6035,
    goalText: 'Reach the Space Age and launch the 1,000-ship Trisolaran Fleet.',
    done: (s: GameState) => !!s.won,
    stars: [45000, 65000, 90000],
    figure: { name: 'The Administrator', glyph: '◉', line: 'You went as far as anyone. Now leave the game, and decide whose side the sky is on.' },
  },
];

export const WILD_LEVEL = -1;

export function levelOf(state: GameState): Level | null {
  return state.level >= 0 && state.level < LEVELS.length ? LEVELS[state.level] : null;
}
export function isLastLevel(level: number): boolean { return level === LEVELS.length - 1; }

// ---- Score ----
export function computeScore(state: GameState): number {
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

const TITLES = ['Survivor', 'Steward of Trisolaris', 'Calendar-Keeper', 'Master of the Three Suns'];
export function rankFor(level: number, score: number): { stars: number; title: string } {
  const thr = (LEVELS[level] && LEVELS[level].stars) || [20000, 45000, 80000];
  let stars = 0;
  for (const t of thr) if (score >= t) stars++;
  return { stars, title: TITLES[stars] };
}

// ---- Objectives ----

// One-time "learn the core loop" objectives. Each completes once, awards score,
// and is latched in state.objsDone.
const TEACH = [
  { id: 'dehydrate', label: 'Dehydrate your people before the killing sky',
    cond: (s: GameState) => s.civ.order === 'dehydrate' || (s.civ.popD || 0) > 0.5 },
  { id: 'rehydrate', label: 'Rehydrate in a Stable Era and let them grow',
    cond: (s: GameState) => s.civ.order === 'rehydrate' },
  { id: 'calendar', label: 'Publish a Calendar to earn the people’s trust',
    cond: (s: GameState) => !!s.calendar },
  { id: 'doctrine', label: 'Spend Insight on a Doctrine',
    cond: (s: GameState) => Object.keys(s.civ.doctrines || {}).length > 0 },
];

// The single most useful action right now (guidance, not scored).
export function nowStep(state: GameState): Objective | null {
  const civ = state.civ, cl = state.cl;
  if (state.over) return null;
  if (!civ.alive || civ.dormant)
    return { id: 'wait', kind: 'do', text: 'A seed waits underground. Speed up time [2–4] until the sky is livable.' };
  const T = cl.tempC;
  if (civ.popH > 0.001 && civ.order !== 'dehydrate' && (T < -6 || T > 43))
    return { id: 'do-dehydrate', kind: 'do', danger: true, text: 'KILLING SKY — Dehydrate [D] now, before cold or heat takes them.' };
  const fd = V.foodDays(civ), sust = V.sustainablePop(civ, cl);
  if (civ.popH > sust * 1.4 && fd < 22 && fd > 0)
    return { id: 'do-shed', kind: 'do', danger: true, text: 'Famine looms — set order size to ⅓ and Dehydrate to save your grain.' };
  if (cl.eraType === 'stable' && (civ.popD || 0) > 0.5 && T > 2 && T < 36 && civ.order !== 'rehydrate' && civ.water > civ.popD * 0.3)
    return { id: 'do-rehydrate', kind: 'do', text: 'A Stable Era — Rehydrate [R] your stored people to live and grow.' };
  if (cl.eraType === 'stable' && !state.calendar)
    return { id: 'do-calendar', kind: 'do', text: 'The sky is calm — run the Computer [C], then publish a Calendar [P].' };
  if ((civ.insight || 0) > 0)
    return { id: 'do-doctrine', kind: 'do', text: 'You have Insight ◆ — spend it on a Doctrine [V].' };
  if (state.flags.escape && civ.ageIdx >= 12 && !civ.fleet.building)
    return { id: 'do-fleet', kind: 'do', text: 'Build the Trisolaran Fleet — escape the three suns.' };
  return null;
}

// The level's primary objective, with current progress.
export function primaryObjective(state: GameState): Objective {
  const lvl = levelOf(state);
  const here = V.AGES[state.civ.ageIdx] ? V.AGES[state.civ.ageIdx].name : '';
  if (!lvl)
    return { id: 'primary', kind: 'primary', text: 'WILD SYSTEM — survive, advance, and launch the Fleet. (now: ' + here + ')' };
  return { id: 'primary', kind: state.levelDone ? 'done' : 'primary',
           text: lvl.goalText + (state.levelDone ? ' ✓' : '  (now: ' + here + ')') };
}

export function teaching(state: GameState): Objective[] {
  return TEACH.map(t => ({ id: t.id, kind: (state.objsDone || {})[t.id] ? 'done' : 'do', text: t.label } as Objective));
}

// Stateful per-tick hook (called from game.tick): latch newly-met teaching
// objectives and detect level completion. Returns events to surface.
export function tickProgress(state: GameState): Array<{ kind: string; [k: string]: any }> {
  const events: Array<{ kind: string; [k: string]: any }> = [];
  if (!state.objsDone) state.objsDone = {};
  for (const t of TEACH) {
    if (!state.objsDone[t.id] && t.cond(state)) {
      state.objsDone[t.id] = true;
      events.push({ kind: 'objective', id: t.id, text: t.label });
    }
  }
  const lvl = levelOf(state);
  if (lvl && !state.levelDone && lvl.done(state)) {
    state.levelDone = true;
    // The final level's victory is celebrated by the existing 'ending' overlay,
    // so only earlier levels push the level-complete card here.
    if (!isLastLevel(state.level)) {
      const score = computeScore(state);
      const r = rankFor(state.level, score);
      events.push({ kind: 'level-complete', level: state.level, name: lvl.name,
                    score, stars: r.stars, title: r.title });
    }
  }
  return events;
}
