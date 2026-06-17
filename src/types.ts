/* ============================================================
 * THREE BODY — types.ts domain types
 * Core simulation shapes are typed precisely; the larger mutable
 * game-state aggregates carry an index signature so this gradual
 * migration type-checks cleanly while still documenting the
 * fields the code actually relies on.
 * ============================================================ */

/** Seeded RNG (mulberry32) — see util.makeRng. */
export interface Rng {
  seed: number;
  getState(): number;
  setState(v: number): void;
  next(): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number;
  pick<T>(arr: T[]): T;
  gauss(): number;
}

/** A sun: mass (M☉), luminosity, position & velocity (AU, AU/yr). */
export interface Sun {
  m: number;
  L: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** The planet — a test particle in the suns' field. */
export interface Planet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

/** The gravitational system: three suns + planet, integrated forward. */
export interface System {
  suns: Sun[];
  planet: Planet;
  t: number;
  E0: number;
  tickMinPlanetDist?: number;
}

/** Per-sun view from the planet (physics.observe). */
export interface SunView {
  i: number;
  d: number;
  dir: number;
  flux: number;
  angSize: number;
  bound: boolean;
  eOrb: number;
  m: number;
  L: number;
  tidal: number;
}

/** Combined observation of the sky from the planet. */
export interface Observation {
  suns: SunView[];
  fluxTotal: number;
  minDist: number;
  tidalSum: number;
  primary: number;
  pert: number;
  alignSpread: number;
  minDistTick?: number;
}

/** Climate state (climate.createClimate). */
export interface Climate {
  tempC: number;
  eraType: string;
  [k: string]: any;
}

/** Civilization state (civ.createCiv). */
export interface Civ {
  popH: number;
  popD: number;
  water: number;
  grain: number;
  order: string;
  alive: boolean;
  [k: string]: any;
}

/** A queued event surfaced to the UI each tick. */
export interface PendingEvent {
  type: string;
  [k: string]: any;
}

/** Top-level game state (game.createGame). */
export interface GameState {
  sys: System;
  cl: Climate;
  civ: Civ;
  day: number;
  over: boolean;
  pending: PendingEvent[];
  flags: { [k: string]: any };
  story: { [k: string]: any };
  // Levels / objectives / score (see score.ts).
  level: number;                  // index into LEVELS, or -1 for Wild System
  score: number;                  // running score, recomputed each tick
  objsDone: { [id: string]: boolean };  // contextual objectives already completed
  levelDone: boolean;             // the level's primary objective has been met
  [k: string]: any;
}

/** A level in the campaign ladder (score.ts LEVELS). */
export interface Level {
  id: string;
  name: string;
  seed: number;
  goalText: string;               // the primary objective, shown to the player
  /** True once this level's goal is met for the given state. */
  done(state: GameState): boolean;
  stars: [number, number, number];  // score thresholds for ★ / ★★ / ★★★
  /** The book figure whose chapter this level is — speaks on completion. */
  figure?: { name: string; glyph: string; line: string };
}

/** A live objective shown in the Objectives panel. */
export interface Objective {
  id: string;
  text: string;
  kind: 'primary' | 'do' | 'done';
  danger?: boolean;               // render with the warn/crit treatment
}

/** Ensemble forecast result (predict.ensembleForecast). */
export interface Forecast {
  tMean: number[];
  tMin: number[];
  tMax: number[];
  horizonDay: number;
  days: number;
}

/** The shared application singleton (app.ts / main.ts). */
export interface App {
  state: GameState | null;
  speedIdx: number;
  lastSpeedIdx: number;
  overlayPause: number;
  setSpeed(i: number): void;
  pauseForOverlay(): void;
  resumeFromOverlay(): void;
  newGame(): void;
  wildGame(): void;
  continueGame(): void;
  sandboxContinue(): void;
  showTitle(): void;
  startLevel(n: number): void;
  recordResult(level: number, score: number): void;
  getProgress(): { unlocked?: number; best?: { [id: string]: number }; bestOverall?: number };
}

/** The renderer interface, implemented by both the 2D and 3D renderers. */
export interface Renderer {
  init(canvas: any): void;
  render(state: GameState, nowMs: number): void;
  resize(): void;
  reseedTerrain(k: number): void;
  titleDemo(nowMs: number): void;
  addShake(a: number): void;
  flash(c: string, a: number): void;
  setBiome?(worldIndex: number): any;
}
