/* ============================================================
 * THREE BODY — tools/bundle.js  (Node only)
 * Inlines css/ and js/ into a single portable ThreeBody.html.
 *   node tools/bundle.js
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return '<style>\n' + css + '\n</style>';
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  // Guard against accidental script-tag termination inside the source.
  return '<script>\n' + js.replace(/<\/script>/g, '<\\/script>') + '\n</script>';
});

const out = path.join(root, 'ThreeBody.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');
