/* ============================================================
 * THREE BODY — tools/build.mjs
 * esbuild build: bundles src/main.ts into a single browser script
 * (dist/three-body.js), then inlines it — with the CSS and the
 * vendored THREE — into the standalone ThreeBody.html.
 *   node tools/build.mjs
 * THREE stays an external runtime global (it is a vendored <script>),
 * so esbuild never tries to resolve or bundle it.
 * ============================================================ */
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => join(root, ...p);

mkdirSync(R('dist'), { recursive: true });

const result = await esbuild.build({
  entryPoints: [R('src/main.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2019'],
  charset: 'utf8',
  legalComments: 'none',
  outfile: R('dist/three-body.js'),
  // THREE is a vendored global (lib/three.min.js loaded before the bundle).
  // Nothing imports it, so there is no module to externalize; it is referenced
  // as a global at runtime and esbuild leaves such references untouched.
});
if (result.warnings.length) for (const w of result.warnings) console.warn(w.text);

const bundleJs = readFileSync(R('dist/three-body.js'), 'utf8');
const css = readFileSync(R('css/style.css'), 'utf8');
const three = readFileSync(R('lib/three.min.js'), 'utf8');

// Build the single-file ThreeBody.html from index.html: inline the stylesheet,
// the vendored THREE, and the app bundle (in that order).
let html = readFileSync(R('index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/,
  '<style>\n' + css + '\n</style>');
html = html.replace(/\s*<script src="lib\/three\.min\.js"><\/script>/, '');
html = html.replace(/<script src="dist\/three-body\.js"><\/script>/,
  '<script>\n' + three.replace(/<\/script>/g, '<\\/script>') + '\n</script>\n' +
  '<script>\n' + bundleJs.replace(/<\/script>/g, '<\\/script>') + '\n</script>');

writeFileSync(R('ThreeBody.html'), html);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log('Wrote dist/three-body.js (' + kb(bundleJs) + ' KB) and ThreeBody.html (' +
  kb(html) + ' KB)');
