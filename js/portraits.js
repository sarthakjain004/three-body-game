/* ============================================================
 * THREE BODY — portraits.js
 * Procedural SVG portrait medallions for the story speakers.
 * Original stylized gold line-art (generic figures + thematic
 * props), drawn in code — no external assets, no real likenesses.
 * Color comes from `currentColor` so the frame's gold flows in.
 * Browser + Node safe (returns strings only).
 * ============================================================ */
'use strict';
var TB = globalThis.TB = globalThis.TB || {};

(function () {
  // Map a story speaker string → a portrait key.
  const KEY = {
    'SYSTEM': 'system',
    'ADMINISTRATOR': 'administrator',
    'Follower of King Wen': 'follower',
    'King Wen of Zhou': 'kingwen',
    'Mozi': 'mozi',
    'You (Copernicus)': 'copernicus',
    'Galileo': 'galileo',
    'Aristotle': 'aristotle',
    'Newton': 'newton',
    'Von Neumann': 'vonneumann',
    'Qin Shi Huang': 'qin',
    'Einstein': 'einstein',
  };

  // Shared pieces (100×100 viewBox). Stroke = currentColor.
  const bust =
    '<path d="M24 96 Q26 72 50 70 Q74 72 76 96" fill="rgba(227,187,95,0.07)"/>' +
    '<path d="M24 96 Q26 72 50 70 Q74 72 76 96"/>';
  const head = '<circle cx="50" cy="46" r="13"/>';
  const neck = '<path d="M44 58 L44 66 M56 58 L56 66"/>';

  // Per-key inner art (added on top of an optional bust).
  const ART = {
    // The registrar / system: the three suns, no body — a cold authority.
    system:
      '<circle cx="50" cy="40" r="9" fill="rgba(227,187,95,0.18)"/>' +
      '<circle cx="36" cy="60" r="7" fill="rgba(227,187,95,0.12)"/>' +
      '<circle cx="64" cy="60" r="7" fill="rgba(227,187,95,0.12)"/>' +
      '<circle cx="50" cy="40" r="9"/><circle cx="36" cy="60" r="7"/><circle cx="64" cy="60" r="7"/>' +
      '<path d="M50 40 L36 60 M50 40 L64 60 M36 60 L64 60" opacity="0.4"/>',

    // The administrator: an eye outside the game — digital, watching.
    administrator:
      '<path d="M22 50 Q50 30 78 50 Q50 70 22 50 Z"/>' +
      '<circle cx="50" cy="50" r="9"/><circle cx="50" cy="50" r="3.5" fill="currentColor"/>' +
      '<path d="M50 18 L50 26 M50 74 L50 82 M18 50 L26 50 M74 50 L82 50" opacity="0.5"/>' +
      '<circle cx="50" cy="50" r="32" opacity="0.25"/>',

    // A hooded acolyte, head bowed.
    follower: bust +
      '<path d="M34 50 Q34 26 50 26 Q66 26 66 50 Q58 44 50 44 Q42 44 34 50 Z" fill="rgba(0,0,0,0.25)"/>' +
      '<path d="M34 50 Q34 26 50 26 Q66 26 66 50"/>' +
      '<circle cx="50" cy="48" r="9"/>',

    // King Wen: tall crown + the broken/solid lines of a hexagram.
    kingwen: bust + neck +
      '<circle cx="50" cy="46" r="12"/>' +
      '<path d="M38 34 L40 22 L46 30 L50 20 L54 30 L60 22 L62 34 Z"/>' +
      '<g opacity="0.85" transform="translate(14,40)">' +
      '<path d="M0 0 H12 M0 5 H12 M0 10 H5 M7 10 H12 M0 15 H12 M0 20 H5 M7 20 H12 M0 25 H12"/></g>',

    // Mozi: topknot scholar + an armillary sphere.
    mozi: bust + neck + head +
      '<path d="M50 33 L50 27 M46 29 H54" />' +            // topknot
      '<g transform="translate(64,42)" opacity="0.9">' +
      '<circle cx="0" cy="0" r="13"/><ellipse cx="0" cy="0" rx="13" ry="5"/>' +
      '<path d="M0 -13 L0 13"/></g>',

    // Copernicus (you): a heliocentric ring diagram beside the figure.
    copernicus: bust + neck + head +
      '<g transform="translate(64,44)" opacity="0.95">' +
      '<circle cx="0" cy="0" r="2.5" fill="currentColor"/>' +
      '<ellipse cx="0" cy="0" rx="7" ry="3" transform="rotate(20)"/>' +
      '<ellipse cx="0" cy="0" rx="13" ry="6" transform="rotate(20)"/>' +
      '<circle cx="11" cy="3" r="1.8" fill="currentColor"/></g>',

    // Galileo: bearded scholar tilting a long glass to the sky.
    galileo: bust + neck +
      '<circle cx="46" cy="46" r="12"/>' +
      '<path d="M40 54 Q46 60 52 54" opacity="0.7"/>' +              // beard
      '<path d="M58 56 L84 30" stroke-width="4"/>' +                 // telescope
      '<circle cx="84" cy="30" r="3"/>',

    // Aristotle: laurel + the Ω of first principles.
    aristotle: bust + neck + head +
      '<path d="M37 40 Q32 34 38 30 M63 40 Q68 34 62 30" opacity="0.8"/>' +  // laurel
      '<text x="50" y="52" font-size="14" text-anchor="middle" fill="currentColor" opacity="0.9" font-family="Georgia,serif">&#937;</text>',

    // Newton: long hair, a prism splitting light, an apple falling.
    newton: bust +
      '<path d="M34 44 Q34 28 50 28 Q66 28 66 44 Q66 64 58 66 L42 66 Q34 64 34 44 Z" fill="rgba(0,0,0,0.18)"/>' +
      '<circle cx="50" cy="46" r="11"/>' +
      '<path d="M72 30 L80 44 L64 44 Z" opacity="0.9"/>' +           // prism
      '<path d="M64 44 L84 48 M64 46 L84 52 M64 48 L84 56" opacity="0.5"/>' + // spectrum
      '<circle cx="24" cy="34" r="3"/><path d="M24 31 Q22 28 25 27" opacity="0.7"/>', // apple

    // Von Neumann: round glasses + a lattice of logic cells.
    vonneumann: bust + neck +
      '<path d="M37 44 Q37 30 50 30 Q63 30 63 44" opacity="0.8"/>' + // receding hair
      '<circle cx="50" cy="47" r="11"/>' +
      '<circle cx="45" cy="46" r="3"/><circle cx="55" cy="46" r="3"/><path d="M48 46 H52"/>' +
      '<g transform="translate(66,58)" opacity="0.85">' +
      '<rect x="0" y="0" width="22" height="14"/><path d="M7 0 V14 M14 0 V14 M0 7 H22"/></g>',

    // Qin Shi Huang: beaded flat crown (mianguan) + a grid of soldier-flags.
    qin: bust + neck + head +
      '<path d="M34 32 H66 L62 26 H38 Z"/>' +                        // mortarboard crown
      '<path d="M38 26 V20 M50 26 V18 M62 26 V20" opacity="0.7"/>' + // beads
      '<g transform="translate(64,56)" opacity="0.85">' +
      '<rect x="0" y="0" width="20" height="14"/>' +
      '<path d="M3 3 v6 M3 3 h3 v3 h-3" /><path d="M10 3 v6 M10 3 h3 v3 h-3"/>' +
      '<path d="M3 10 h4 M10 10 h4 M17 6 v4"/></g>',

    // Einstein: wild hair, mustache, and a swinging pendulum.
    einstein: bust + neck +
      '<circle cx="48" cy="47" r="11"/>' +
      '<path d="M34 40 Q30 30 40 32 M66 42 Q70 32 60 32 M37 36 Q34 30 42 30 M63 36 Q66 30 58 30" opacity="0.85"/>' +  // hair
      '<path d="M42 54 Q48 58 54 54" opacity="0.8"/>' +              // mustache
      '<path d="M76 26 L70 52" /><circle cx="70" cy="54" r="3.5" fill="currentColor"/>', // pendulum

    // Generic scholar fallback.
    scholar: bust + neck + head,
  };

  function keyFor(speaker) {
    return KEY[speaker] || (/^(SYSTEM|REGISTRAR)/i.test(speaker || '') ? 'system' : 'scholar');
  }

  // Return an <svg> medallion string for a speaker.
  function svg(speaker) {
    const inner = ART[keyFor(speaker)] || ART.scholar;
    return '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner + '</svg>';
  }

  TB.portraits = { svg, keyFor };
})();
