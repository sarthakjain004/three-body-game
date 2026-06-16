/* Ambient declarations for globals that are not ES-module imports.
 * This file has NO top-level import/export on purpose, so it stays a
 * global script and these declarations are visible to every module. */

// THREE.js is vendored as a plain <script> (lib/three.min.js) and used as a
// runtime global by the 3D renderer, not bundled. Typed loosely on purpose.
declare const THREE: any;

// Some browsers expose the prefixed constructor.
interface Window {
  webkitAudioContext?: typeof AudioContext;
}

// Headless test flag: when set, dialog text fills instantly (no timers).
declare var __TB_NOTYPE__: boolean | undefined;
