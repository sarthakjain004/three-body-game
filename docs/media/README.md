# Media

Screenshots used by the root `README.md`. **These are captured from real
gameplay** — the simulation drives everything, so the scenes below actually
happened in a run.

| File | What it is |
|---|---|
| `orbit-map.png` | The Orbit Map — the true three-sun configuration with the planet's chaotic traced orbit (the hero image) |
| `cover.png` | Social / Open Graph preview image (a copy of `orbit-map.png`) |
| `stable.png` | A Stable Era — populace awake, building and farming |
| `heat.png` | A Chaotic Era furnace (+221 °C, "killing heat") |
| `cold.png` | A Chaotic Era deep freeze (−79 °C, "killing cold") |
| `observatory.png` | The Observatory — surface-temperature and three-sun-distance charts |

## Regenerating

The images are produced by a headless-Chrome capture script:

```bash
npm i puppeteer-core          # optional dev dependency
npm run screenshots           # = node tools/screenshots.js
```

It boots the game, clicks through the intro, runs the simulation at max speed,
and grabs frames when a Stable / killing-heat / killing-cold era occurs. Set
`CHROME=/path/to/chrome` if Chrome isn't at the default Windows location. The
game falls back to its 2D renderer when WebGL is unavailable (as in headless),
which keeps the stills clean and deterministic.
