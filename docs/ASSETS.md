# Generated media — asset spec & integration map

The game loads optional AI-generated artwork for its narrative beats, level
picker, level-complete cards, and end screens. **Every slot is fallback-safe:**
each `<img>` removes itself if the file is absent (404), so the game looks
exactly as it does today until you drop a file in. Add assets incrementally.

**Where assets are served from:** the `index.html` (GitHub Pages) build, under
`docs/media/`. The single-file offline `ThreeBody.html` intentionally stays
lightweight and keeps the text/SVG fallback.

## Status — what's wired

| Slot | Files (drop here) | Wired? |
|---|---|---|
| Story-beat banner | `docs/media/beats/<id>.jpg` | ✅ images |
| Level-picker thumbnail | `docs/media/levels/l1.jpg … l7.jpg` | ✅ images |
| Level-complete banner | `docs/media/levels/l<N>.jpg` (reused) | ✅ images |
| End screens | `docs/media/end/fleet.jpg`, `silence.jpg` | ✅ images |
| Videos (title loop / transitions / fleet) | `docs/media/video/*.mp4` | ⏳ send the file, I'll wire each per-surface |

Beat `<id>` values: `intro, almanac, mozi, copernicus, computer, einstein, unsolvable, meet-up, king-wen`.

## Shared art direction (prepend to EVERY image/video prompt)

> Cinematic matte painting, dark and painterly, muted desaturated palette with
> cold slate-blue shadows and warm gold/amber highlights; a desolate alien plain
> beneath an enormous sky; three suns of distinct colors — pale gold (#ffd75e),
> deep orange (#ff9e64), icy blue-white (#7ecbff); ancient-Chinese-meets-cosmic
> atmosphere; great stepped stone pyramid motif; dramatic chiaroscuro, volumetric
> light, subtle film grain, awe tinged with dread. 16:9 unless noted.

> **Negative:** no text, letters, captions, watermark, signature, UI; no modern
> objects/vehicles; no real-person likenesses; not cartoonish; not oversaturated.

Lock the look on the **level art + (optional) title loop first**, then reuse the
style line + a style/seed reference for everything else so it all matches.

## Prompts — story beats (16:9 → `docs/media/beats/<id>.jpg`)

- **intro** — Frozen desolate plain at dim mauve pre-dawn, no sun risen; a great stepped pyramid silhouetted far off; a lone robed follower in the foreground; rolled, mummified "dehydrated" human forms stacked like mats; cold, abstract, lonely.
- **almanac** — A medieval friar-astronomer in a candlelit stone scriptorium, surrounded by great brass astronomical tables and an almanac of vellum charting the suns; one window showing a pale sun; scholarly, hopeful, fragile.
- **mozi** — Night atop the great pyramid; an ancient astronomer beside a colossal hollow armillary sphere pierced with countless glowing pinholes lit by an inner sea of fire, one large aperture casting a single sunbeam; obsession and wonder.
- **copernicus** — A vast dim hall of stone, robed philosophers before a raised throne; through a high window hang three suns of different colors over a small fragile world; the instant of cosmic understanding.
- **computer** — Aerial view of a plain where thirty million soldiers in geometric formation form a living motherboard, tiny flags raised/lowered like ones and zeros, signal patterns rippling like circuitry; an emperor and scholars on a dais; staggering scale.
- **einstein** — A monumental pendulum swinging above a barren plain at dusk; a lone archaic-modern scientist gazing up; three suns low on the horizon; melancholy futility.
- **unsolvable** — A dying world under three chaotic suns, a civilization in silhouette looking upward; nowhere safe, only distant stars to flee toward; grim resolve.
- **meet-up** — A surreal threshold where the ancient plain dissolves into cold starlight/data; a faceless administrator of pure light addressing the viewer; the "frame" of a game pulling back; eerie, quiet.
- **king-wen** — Millions newly rehydrated walking and sowing fields under a calm sky just starting to betray them — thin lethal light cracking the horizon; an old sage with hexagram tiles, head bowed; tragedy of a broken promise.

## Prompts — level key art (3:2 → `docs/media/levels/l1.jpg` … `l7.jpg`)

l1 Mozi's Machine: pyramid at first dawn, a pale sun cresting, the celestial sphere atop it. · l2 The Almanac: a medieval observatory of brass tables under two distant flying-star suns. · l3 The Three Suns: three colored suns revealed in a black sky over the world. · l4 The Human Computer: the soldier-motherboard formation from above. · l5 The Pendulum: the pendulum monument under a vast aged sky. · l6 The Goal Has Changed: a civilization gazing at a distant steady star as fleet gantries rise. · l7 Escape: a thousand teardrop-fire ships ascending from the dying world into starlight.

## Prompts — videos (seamless loop where noted → `docs/media/video/<name>.mp4`)

- **title-loop** (8–12s, seamless): slow parallax over the desolate plain and pyramid while three colored suns drift and orbit in a deep star-flecked sky; hypnotic, no cuts.
- **copernicus-reveal** (6–8s): camera pulls back from the small world to reveal three suns wheeling around one another in a chaotic dance.
- **fleet-departs** (6–10s): a thousand teardrop-fire ships rise in a phalanx and accelerate into the stars; behind them the three mad suns shrink into the dark.

## End screens (16:9 → `docs/media/end/`)
- **fleet.jpg** — 1,000 ships in a phalanx leaving the three shrinking suns.
- **silence.jpg** — a dead, ashen-frozen last world, suns gone, utter stillness, deeply desaturated.

## Technical specs
- **Images:** scenes 1280×720 (or 1600×900); level thumbs ~720×480. Export JPG/WebP, web-optimized — scenes < ~400 KB, thumbs < ~150 KB.
- **Video:** 1280×720, H.264 MP4 (a VP9 `.webm` too if easy), 24–30 fps, no/muted audio, each < ~4 MB; loops seamless.
- **Naming:** use the exact paths above so assets drop straight in.
- **Models:** images — Midjourney, Flux, DALL·E 3, Imagen; video — Sora, Runway Gen-3, Kling, Veo, Pika.

## Handoff
Drop files into the paths above (or send them) and they appear automatically for
images. For any video, send it and say which surface (title / a transition / the
ending) — those get wired per-surface to control autoplay/loop/poster.
