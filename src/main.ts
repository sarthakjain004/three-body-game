/* ============================================================
 * THREE BODY — main.ts
 * Entry point: wire boot() to the document lifecycle. The esbuild
 * bundle's entry is this file. All real logic lives in app.ts.
 * ============================================================ */
import { boot } from './app';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
