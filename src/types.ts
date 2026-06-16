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
  [k: string]: any;
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
