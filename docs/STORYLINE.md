# THREE BODY — Storyline Design Document

A research-grounded map of the narrative of Liu Cixin's *The Three-Body Problem*
(Book 1 of *Remembrance of Earth's Past*), focused on the in-novel VR game
**"Three Body,"** and a proposed **Story Mode** for our game that recreates it.

> **How to read this doc.** Sections 1–5 are *research* — what the book actually
> contains, with citations. Section 6 is the *gap analysis* against our current
> build. Section 7 is the *proposed Story Mode* — the actionable design.
> Throughout, **CANON** marks faithful-to-the-book material and **EXTENSION**
> marks our own faithful invention (the book never specifies it, but it fits).
>
> All book content below is **paraphrased**; only short iconic phrases (a few
> words) are quoted, for tone reference.

---

## 0. The single most important structural fact

The book's "Three Body" is a story told on **two layers at once**, and our game
currently only renders the inner one. Getting the story right means deciding how
much of the outer layer to expose.

| Layer | What it is | Who is "the player" | Our game today |
|---|---|---|---|
| **Inner game** | A VR survival sim of a planet under an unpredictable sun, dressed in *Earth* history (King Wen, Newton, Einstein…) as a costume | An in-fiction avatar (Copernicus, Hairen…) | ✅ This is our whole game |
| **Outer frame** | The novel's reality: the game is **propaganda** built by the Earth-Trisolaris Organization to find and recruit sympathizers; Wang Miao plays it while investigating a scientist suicide wave | Wang Miao (and us, vicariously) | ❌ Absent |

The dramatic engine of the book is the **collision** of the two: the slow dawning
that the "game" is describing a *real* alien world that is *really coming*. A
faithful Story Mode should at minimum *gesture* at the outer frame, even if the
core remains the inner sim. ([LitCharts: ETO](https://www.litcharts.com/lit/the-three-body-problem/terms/earth-trisolaris-organization-eto), [Fandom: Three Body game](https://three-body-problem.fandom.com/wiki/Three_Body_(game)))

---

## 1. The inner game, login by login

The game uses **Earth's historical/mythical figures as a "shell"** to depict the
alien world of Trisolaris — the people *look* human and bear Earth names, but the
world and its fate are Trisolaran. (This is canon, and it's *why* it's correct for
our game to render human figures.) ([GradeSaver Part II](https://www.gradesaver.com/the-three-body-problem/study-guide/summary-part-ii-three-body-chapters-14-20))

Wang Miao logs in repeatedly; each session is a **new civilization** that rises,
attempts to master the sun, and is annihilated. The civilizations are **numbered**
and the deaths are announced by a cold "registrar" voice, then: *log in again.*

### 1.1 Level-by-level map (CANON)

| # | Level (book ch.) | Figures | The attempt to read the sun | How it ends | Registrar |
|---|---|---|---|---|---|
| 1 | **King Wen & the Long Night** (ch. 7) | Follower; **King Wen of Zhou**; King Zhou of Shang | King Wen's **I Ching / yin-yang calendar** — predicts a Stable Era; it holds a few days, then fails (~8 days) | The predicted calm breaks; **three flying stars** appear → killing cold; everyone freezes | *Civ **No. 137**, destroyed by extreme cold* |
| 2 | **Mozi's model** (mid-game) | **Mozi** | A literal **mechanical model of the cosmos** — a great sphere afloat in a sea of fire, pinholes for stars, one hole for the sun; wind the gears to "run" the sky | The clockwork assumes one orbit; the real sky doesn't obey; burns/fails | (civilization destroyed; number varies by edition) |
| 3 | **Copernicus & the Three Suns** (ch. 15–16) | Player as **Copernicus**; **Aristotle, Galileo**, Pope/da Vinci flavor | The player *reveals the truth*: **three suns**, mutual gravity, no pattern — Stable Eras = bound to one sun, Chaotic = adrift among three | A **tri-solar day** (3 suns up) burns the world | *Civ **No. 183** destroyed*; **"Three Body has entered the second level."** |
| 4 | **The Human Computer** (ch. 17) | **Newton, Leibniz, von Neumann** (a real player), **Qin Shi Huang** | **30,000,000 soldiers** as a **human-formation computer** — flags = bits, three soldiers = a gate, a cavalry detachment = the **"system bus,"** booting **"Qin 1.0"**; integrates the orbits and prints a calendar predicting a 1-year Stable Era | Before the calm is enjoyed, a **tri-solar syzygy** (3 suns in a line) stacks gravity; people and buildings float up and are torn loose | *Civ **No. 184**, destroyed by a tri-solar syzygy* |
| 5 | **Einstein, the Pendulum & the Unsolvable** (ch. 19) | **Einstein** (a destitute violinist); **Wei Cheng**'s analogue; the UN | A giant **pendulum monument** (a prayer for periodicity); an **evolutionary-algorithm** model finds 100+ configurations — but the verdict lands: **the three-body problem has no solution** | Reveal: the "great rip" already destroyed **11 of 12 planets**; Trisolaris faces annihilation; **~the last planet** falls | *Civ **No. 192** destroyed* (lasted ~452 years) |
| 6 | **The Exodus** (ch. 20) | All of Trisolaris | *There is nothing left to predict.* The goal **changes**: leave. | The **Trisolaran Fleet** launches toward the stars (~1/10 light speed) | The game's true purpose surfaces |

> **Order caveat & common misconception.** Some online summaries (especially
> Netflix-show recaps) **relabel** the levels — e.g. calling Copernicus "Level 1"
> — and the show changes avatars and adds characters. For *our* purposes the
> **book order** above is canon: **King Wen is the first level**, Copernicus the
> pivotal middle, the Human Computer the showpiece, Einstein the turn to despair.
> ([LitCharts ch. 7](https://www.litcharts.com/lit/the-three-body-problem/chapter-7-three-body-king-wen-of-zhou-and-the-long-night), [LitCharts ch. 17](https://www.litcharts.com/lit/the-three-body-problem/chapter-17-three-body-newton-von-neumann-the-first-emperor-and-tri-solar-syzygy), [Bleeding Cool: Chinese vs Netflix](https://bleedingcool.com/tv/3-body-problem-comparing-the-vr-game-in-chinese-netflix-versions/))

### 1.2 Core mechanics, as the book describes them (CANON)

- **Dehydration / rehydration.** When the sky turns deadly, people **wring out
  their own water** and collapse into dry, rolled "wisps," stored in
  **dehydratories**; fire and flood pass over them harmlessly. In a Stable Era
  they are soaked in water and **rehydrate** to walk again. ([LitCharts ch. 7](https://www.litcharts.com/lit/the-three-body-problem/chapter-7-three-body-king-wen-of-zhou-and-the-long-night))
- **Stable Era vs Chaotic Era.** The defining cycle. Stable = livable, the world
  builds; Chaotic = the sun keeps no schedule (it may not rise for a century, or
  three may rise at once). ([Fandom: Chaotic Era](https://three-body-problem.fandom.com/wiki/Chaotic_Era))
- **Flying stars.** A distant sun looks like a fast-moving star. **One** = far but
  survivable. **Three flying stars at once** = all suns distant = the dreaded
  **long, deep cold**. ([LitCharts ch. 7](https://www.litcharts.com/lit/the-three-body-problem/chapter-7-three-body-king-wen-of-zhou-and-the-long-night))
- **Tri-solar day / tri-solar syzygy.** Three suns close = furnace; three suns in
  a *line* = stacked tides that rip the surface skyward. ([LitCharts ch. 17](https://www.litcharts.com/lit/the-three-body-problem/chapter-17-three-body-newton-von-neumann-the-first-emperor-and-tri-solar-syzygy))
- **The calendar.** Each civilization's central gamble is **predicting the eras
  and publishing a calendar** the people live by. When the calendar is wrong,
  everyone is caught in the open. (King Wen's failed calendar is the prototype.)

---

## 2. The Trisolaran civilization's in-fiction history (CANON)

What the game *depicts* is the real history of Trisolaris:

- A world with **three suns** and (originally) **twelve planets**; over the eons
  the suns **swallowed eleven**, leaving one. ([GradeSaver](https://www.gradesaver.com/the-three-body-problem/study-guide/summary-part-ii-three-body-chapters-14-20))
- Civilization there has **risen and been annihilated ~200 times** (the game's
  numbered civilizations — 137, 183, 184, 192… — are samples of this cycle), each
  destroyed by cold, fire, syzygy tides, or being swallowed. ([eNotes ch. 16–20](https://www.enotes.com/topics/three-body-problem/chapter-summaries/chapters-16-20))
- The Trisolarans **evolved dehydration** to ride out the chaos — a biological
  survival adaptation, not a game gimmick.
- They eventually **prove the three-body problem unsolvable**, conclude their
  world is doomed, and resolve to **abandon Trisolaris** and seize a stable new
  home. Earth — which has just broadcast its location — becomes the target. They
  build a **fleet** and depart on a centuries-long voyage. ([LitCharts: ETO](https://www.litcharts.com/lit/the-three-body-problem/terms/earth-trisolaris-organization-eto))

---

## 3. The outer frame — what the game *is* (CANON)

- **The ETO (Earth-Trisolaris Organization)** is a secret human movement that
  *wants* the Trisolarans to come. Founded by **Ye Wenjie** and **Mike Evans**. ([LitCharts: ETO](https://www.litcharts.com/lit/the-three-body-problem/terms/earth-trisolaris-organization-eto), [Fandom: ETO](https://three-body-problem.fandom.com/wiki/Earth-Trisolaris_Organization))
- **Factions:** **Adventists** (humanity is irredeemable; let it be destroyed —
  Evans's faction), **Redemptionists** (humanity can be saved by learning from
  Trisolaris; they revere "the Lord"), and later **Survivors** (collaborate to
  buy their descendants a place). ([Fandom: ETO](https://three-body-problem.fandom.com/wiki/Earth-Trisolaris_Organization), [GradeSaver glossary](https://www.gradesaver.com/the-three-body-problem/study-guide/glossary-of-terms))
- **The game is a recruiting net.** Built (largely by Redemptionists), "Three
  Body" is seeded to find rare minds who can grasp — and *sympathize with* — the
  Trisolaran predicament. Surviving and understanding the game flags you as a
  candidate. ([LitCharts: ETO](https://www.litcharts.com/lit/the-three-body-problem/terms/earth-trisolaris-organization-eto), [Fandom: ETO](https://three-body-problem.fandom.com/wiki/Earth-Trisolaris_Organization))
- **Wang Miao**, a nanomaterials researcher pulled into investigating scientists'
  suicides, plays via a **full-immersion V-suit** under a handle (*Hairen*). His
  arc: curiosity → mastery → the unnerving realization the world is *real* → a
  **player meet-up** where the ETO and the truth are unveiled. After the game has
  served its purpose, an administrator contacts players and summons them. ([LitCharts ch. 7](https://www.litcharts.com/lit/the-three-body-problem/chapter-7-three-body-king-wen-of-zhou-and-the-long-night), [LitCharts ch. 17](https://www.litcharts.com/lit/the-three-body-problem/chapter-17-three-body-newton-von-neumann-the-first-emperor-and-tri-solar-syzygy))

---

## 4. Tone & text (for our registrar voice)

The voice is **clinical, vast, and indifferent** — a cosmic registrar that records
extinctions like weather. The recurring shape (paraphrased; keep our own wording):

- On death: *"Civilization No. N was destroyed by ⟨cause⟩. It had advanced to
  ⟨age⟩. The seed of civilization remains… We invite you to log in again."*
- On the pivot: *"Three Body has entered the second level."*
- On the verdict: *the problem has no solution; there is nothing to predict.*
- On the turn: *there is only somewhere to go.*

Our `js/story.js` already matches this register well — keep it.

---

## 5. Canon vs. extension — quick legend for Section 7

- **CANON** — depicted or strongly implied in Book 1.
- **EXTENSION** — not in the book, but a faithful elaboration that serves play
  (e.g. our reserves economy, the playable Calendar, procedural civilizations).

---

## 6. Gap analysis — our current build vs. the book

What we already have (in `js/story.js`, `js/game.js`, `js/civ.js`):

| Element | Status |
|---|---|
| Dehydration / rehydration, Stable/Chaotic eras, flying stars, tri-solar day, syzygy | ✅ Modeled from real physics |
| Numbered civilizations, registrar death notices, "log in again," rebirth | ✅ Procedural |
| Beats: intro (King Wen), Mozi, Copernicus ("second level"), Human Computer, Einstein/pendulum, goal-change | ✅ Present |
| Playable **Calendar** + golden-age/disaster consequences | ✅ (our EXTENSION; matches King Wen's arc) |
| The Trisolaran Fleet endgame (1,000 ships) | ✅ |

What's **missing** (the work this doc enables):

1. **A staged King Wen calendar disaster** as a *scripted, first-time* dramatic
   beat (we have the mechanic, not the set-piece).
2. **Fu Xi** (a shaman-king who tries to *appease* the sun-god by sacrifice) — an
   iconic early, pre-scientific failure. **CANON-adjacent** (appears in the game's
   early mythic layer).
3. **Named, guaranteed civilization milestones** (137 cold, 183 tri-solar day, 184
   syzygy, 192 unsolvable) layered onto our procedural ones for *recognition*.
4. **Wei Cheng's evolutionary-algorithm** model as a late beat (optional).
5. **The outer frame**: a light **ETO meta-layer** — player-count framing, an
   administrator contact, and a post-victory **reveal** that "this was real."
6. **The emotional through-line** made explicit: hope → hubris → despair → resolve
   → unease.

---

## 7. PROPOSED STORY MODE (the actionable design)

### 7.1 The emotional arc (the spine)

```
ACT I  HOPE      "Surely the sky has a pattern; we just need the right method."
ACT II HUBRIS    Each method (divination → clockwork → computation) works… then
                 fails worse than the last.
ACT III DESPAIR  Proof: there is no pattern. The world is doomed.
ACT IV  RESOLVE  Stop predicting. Leave. Build the fleet.
EPILOGUE UNEASE  (Outer frame) It was never a game. They are real, and coming.
```

### 7.2 Beat sheet — keyed to our existing trigger system

Our `story.js` fires beats by **technological age**; we extend with **event
triggers** (first extinction, first syzygy, fleet-complete). Beats below are
ordered; **NEW** marks additions.

| Beat | Trigger | Act | Type | Content (paraphrased design intent) |
|---|---|---|---|---|
| `intro` | game start | I | CANON | Frozen dawn, the Follower, King Wen; teach dehydrate/rehydrate + the goal. *(have)* |
| `king-wen-calendar` **NEW** | first time the player issues a Stable **Calendar** that then **fails** | I→II | EXTENSION of CANON | Stage the King Wen disaster in the registrar's voice: the people rehydrated on the calendar's promise and were caught by the cold. Ties our Calendar mechanic to the book's prototype. |
| `fuxi` **NEW (optional)** | first extinction by heat | I | CANON-adjacent | A shaman-king (Fu Xi) climbs the pyramid to *call the sun back* with sacrifice — superstition fails where measurement must follow. Short, mythic. |
| `mozi` | age ≈ Iron/Warring States | II | CANON | Mozi's sphere-in-a-sea-of-fire clockwork; gift the Observatory model; warn it trusts one orbit. *(have)* |
| `copernicus` | age ≈ Renaissance | II | CANON | Reveal three suns before Aristotle/Galileo; unlock the Orbit Map; **"second level."** *(have)* |
| `human-computer` | age ≈ Industrial | II | CANON | Von Neumann + Newton + Qin Shi Huang; **Qin 1.0**, 30M soldiers, cavalry bus; the forecast/Computer; the syzygy that follows. *(have)* |
| `einstein` | age ≈ Atomic | III | CANON | The pendulum monument; finer instruments, the fan still opens; **violin** image (EXTENSION flavor). *(have, add violin)* |
| `wei-cheng` **NEW (optional)** | age ≈ Information | III | CANON | An evolutionary-algorithm model finds many configurations — and is still defeated. Reinforces "no method suffices." |
| `unsolvable` | age ≈ Information→Space | III→IV | CANON | The announcement: no solution; 11 of 12 worlds already gone; goal changes to **escape**. *(have)* |
| `exodus` **NEW** | fleet complete (win) | IV | CANON | The fleet departs for a steady star four light-years off — *which has just revealed itself.* *(partly in ending; sharpen the destination irony)* |
| `the-meet-up` **NEW (optional epilogue)** | after win OR after N civilizations lost | EPILOGUE | CANON (outer frame) | The screen breaks frame: an "administrator" thanks the player; reveals the world was **real**; invites them to the gathering. The unease the book ends the game on. |

### 7.3 Named civilization milestones (recognition layer) — **NEW, EXTENSION**

Overlay the four famous deaths onto our procedural stream so book-readers get the
jolt of recognition, without scripting the physics:

| When (our trigger) | Card shown |
|---|---|
| First extinction by **cold** | "Civilization No. **137** … extreme cold." |
| First extinction by a **tri-solar day** (heat w/ 3 discs) | "Civilization No. **183** …" + the **"second level"** line |
| First extinction by **syzygy** | "Civilization No. **184** … tri-solar syzygy." |
| The **unsolvable** beat | frame it as the legacy of **Civilization No. 192** (~452 years) |

(Implementation: tag these in `story.js` as one-time, cause-keyed notices; our
civ numbering already starts at 137, so the first is automatic.)

### 7.4 The outer-frame layer — **NEW, design options**

Three dial settings; pick per taste (recommend **B** as default):

- **A — Pure sim (current).** No frame. The game never admits it's a game.
- **B — Whispers (light).** Occasional out-of-frame "system" lines (a player
  count; an "administrator" note after milestones); a single post-victory reveal
  beat (`the-meet-up`) that the world was real. Low effort, big thematic payoff.
- **C — Full frame (heavy).** A wrapping Wang-Miao layer: between sessions, brief
  real-world investigation interstitials, the ETO factions, the meet-up as a
  scene. High effort; risks diluting the clean sim. Document as a stretch goal.

### 7.5 Triggers we need (engine work)

- Age-based (exists).
- **Event-based**: `first-extinction(cause)`, `first-syzygy`, `calendar-failed`,
  `fleet-complete`. (We already emit most of these as events in `game.js`; route
  them to `story.dueBeat`-style checks.)
- **One-time guards** (exists via `seenBeats`/`seenNotices`).

---

## 8. Implementation notes

- All beats live as data in `js/story.js`; add the **NEW** beats there and extend
  the trigger check in `game.js#checkBeats` to also accept event keys (not only
  `ageIdx`). Keep prose in **our own words** (the doc's quotes are short tone refs).
- The `king-wen-calendar` beat should fire from the existing Calendar-failure path
  (`resolveCalendar` in `game.js`) the **first** time a stable calendar fails —
  reusing the disaster we already simulate.
- The recognition cards reuse the `NOTICES` mechanism (cause-keyed, one-time).
- The optional `the-meet-up` epilogue can hook the `ending`/`silence` overlays.
- Keep **CANON vs EXTENSION** labels in code comments so future edits stay honest.

---

## 9. Citations

- The Three-Body Problem Wiki — *Three Body (game)*: https://three-body-problem.fandom.com/wiki/Three_Body_(game)
- The Three-Body Problem Wiki — *Earth-Trisolaris Organization*: https://three-body-problem.fandom.com/wiki/Earth-Trisolaris_Organization
- The Three-Body Problem Wiki — *Chaotic Era*: https://three-body-problem.fandom.com/wiki/Chaotic_Era
- LitCharts — *Ch. 7: King Wen of Zhou and the Long Night*: https://www.litcharts.com/lit/the-three-body-problem/chapter-7-three-body-king-wen-of-zhou-and-the-long-night
- LitCharts — *Ch. 17: Newton, Von Neumann, the First Emperor, and Tri-Solar Syzygy*: https://www.litcharts.com/lit/the-three-body-problem/chapter-17-three-body-newton-von-neumann-the-first-emperor-and-tri-solar-syzygy
- LitCharts — *ETO term analysis*: https://www.litcharts.com/lit/the-three-body-problem/terms/earth-trisolaris-organization-eto
- GradeSaver — *Part II: Three Body (Chapters 14–20) Summary*: https://www.gradesaver.com/the-three-body-problem/study-guide/summary-part-ii-three-body-chapters-14-20
- GradeSaver — *Glossary of Terms*: https://www.gradesaver.com/the-three-body-problem/study-guide/glossary-of-terms
- eNotes — *Chapters 16–20 Summary*: https://www.enotes.com/topics/three-body-problem/chapter-summaries/chapters-16-20
- Bleeding Cool — *Comparing the VR Game in Chinese & Netflix Versions*: https://bleedingcool.com/tv/3-body-problem-comparing-the-vr-game-in-chinese-netflix-versions/
- The Ringer — *Unpacking the VR Game in '3 Body Problem'*: https://www.theringer.com/2024/03/22/tv/3-body-problem-netflix-video-game-vr-virtual-reality-explained
- TV Tropes — *The Three-Body Problem (Literature)*: https://tvtropes.org/pmwiki/pmwiki.php/Literature/TheThreeBodyProblem

> *Fan tribute / study aid. All storyline facts are paraphrased from secondary
> summaries of Liu Cixin's novel; no substantial verbatim text is reproduced.*
