/* ============================================================
 * THREE BODY — renderer.ts
 * The single renderer consumers import. It is the 3D (Three.js)
 * renderer, which transparently falls back to the 2D canvas
 * renderer when WebGL/THREE is unavailable (e.g. headless). Having
 * one import point means no other module has to choose a renderer.
 * ============================================================ */
export { render } from './render3d';
