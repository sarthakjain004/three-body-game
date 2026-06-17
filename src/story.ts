/* ============================================================
 * THREE BODY — story.ts
 * The scripted encounters of the game-within-the-book:
 * King Wen, Mozi, the Copernicus revelation, the Human
 * Computer of Qin Shi Huang, Einstein and the pendulum,
 * and the departure of the Trisolaran Fleet.
 * Pure data + trigger logic, no DOM (the UI renders beats).
 * ============================================================ */
import type { Civ } from './types';

// ----------------------------------------------------------
// Story beats, triggered by technological age.
// ----------------------------------------------------------
const BEATS = [
  {
    id: 'intro', age: -1, unlock: null, title: 'Three Body · Level One',
    pages: [
      { speaker: 'SYSTEM', glyph: '三', text: 'Dawn. A plain so desolate it seems abstract: frozen earth in dim, mauve light, beneath a sky where no sun has yet risen. In the distance stands a great pyramid.' },
      { speaker: 'Follower of King Wen', glyph: '文', text: 'Hail, traveler. Cold, isn\'t it? This is a Chaotic Era — the sun keeps no schedule. It may rise in an hour, or in a century. When the cold deepens, we dehydrate.' },
      { speaker: 'Follower of King Wen', glyph: '文', text: 'The body is wrung of its water and rolled up like a mat, to be stored in the dehydratories. Fire and flood pass over us; we feel nothing. When a Stable Era comes, we are soaked in the lakes and walk again.' },
      { speaker: 'King Wen of Zhou', glyph: '王', text: 'I journey to Zhao Ge with my hexagrams, to read the sun\'s will. You seem a person of learning — stay, and help this civilization endure. Watch the sky. Order the dehydrations. Time them well, and we may yet outlive the chaos.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'YOUR GOAL — keep the civilization alive through Stable and Chaotic Eras, and advance it age by age. Use DEHYDRATE before the deadly cold or heat arrives; REHYDRATE when the weather turns livable. The truth of this world\'s sun is yours to uncover.' },
    ],
  },
  {
    id: 'mozi', age: 4, unlock: 'mozi', title: 'The Celestial Machine',
    pages: [
      { speaker: 'Mozi', glyph: '墨', text: 'Up here, on the pyramid\'s summit, I have watched the sky for a lifetime. The shamans burned, the Confucians froze — their rites read nothing. I do not divine. I MEASURE.' },
      { speaker: 'Mozi', glyph: '墨', text: 'I have built a machine of the universe: a hollow sphere afloat upon a sea of fire. Its shell is pierced — countless pinholes for the stars, and one great hole through which the fire-sea shines: the sun. Turn the shell upon its gears, and the sky\'s future unrolls like silk.' },
      { speaker: 'Mozi', glyph: '墨', text: 'It is yours. But heed me: the machine believes the sun rides ONE track. When the sky holds to one track, the machine speaks true. When the sky forgets its track… so does the machine.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'UNLOCKED — Mozi\'s Celestial Model (Observatory panel): fits a clockwork orbit to the present sky and names its period. Trust it exactly as far as the sky stays clockwork.' },
    ],
  },
  {
    id: 'almanac', age: 5, unlock: null, title: 'The Almanac',
    pages: [
      { speaker: 'Friar Bacon', glyph: '✚', text: 'I am a friar; I ought to pray for the sun\'s return. Instead I have spent thirty years tabulating it — every rising, every freeze — into a great Almanac of brass and vellum.' },
      { speaker: 'Friar Bacon', glyph: '✚', text: 'Mozi gave us a wheel of the heavens; I give you a TABLE of them. Look up the day, read the sky. While the heavens repeat, the Almanac is a lamp held against the dark.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'But a table only remembers — it cannot foresee a sky that has never repeated. Trust the Almanac through a Stable Era; close it the moment the suns forget their order.' },
    ],
  },
  {
    id: 'copernicus', age: 6, unlock: 'orbit', title: 'The Three Suns',
    pages: [
      { speaker: 'SYSTEM', glyph: '三', text: 'A great hall of stone. Aristotle in his robes, Galileo with his calloused hands, and a throne above them. You have asked to speak, under the name you logged in with: COPERNICUS.' },
      { speaker: 'Galileo', glyph: '☾', text: 'Speak, then. But I warn you — we reject prophets here. Show us reasoning built on observation, or be burned like the rest.' },
      { speaker: 'You (Copernicus)', glyph: '☉', text: 'Our world has not one sun, but THREE. They orbit one another under mutual gravity, in a dance with no pattern. When our planet is held by one sun, it is a Stable Era. When we are torn loose and fall through the open field of three — it is a Chaotic Era.' },
      { speaker: 'You (Copernicus)', glyph: '☉', text: 'The flying stars are no omen. A flying star IS a sun — seen from far away. One sun near, we live. Three flying stars at once means all three suns are distant: the great cold is upon us.' },
      { speaker: 'Aristotle', glyph: 'Ω', text: 'Absurd… and yet it saves every appearance. The frozen civilizations, the burned ones, the days of two suns… all of it. All of it!' },
      { speaker: 'SYSTEM', glyph: '三', text: 'The ORBIT MAP now shows what no Trisolaran eye has seen: the true configuration of the three suns and your world. The problem is named: THREE BODIES, no general solution.\n\nIn this civilization, Copernicus revealed the basic structure of the universe. Three Body has entered the SECOND LEVEL.' },
    ],
  },
  {
    id: 'computer', age: 8, unlock: 'computer', title: 'The Human Computer',
    pages: [
      { speaker: 'Von Neumann', glyph: '⚙', text: 'Your Imperial Majesty: we cannot solve the three-body problem with brushes and silk. But Newton here has given us the laws of motion, and the laws ask only one thing — calculation. Oceans of calculation.' },
      { speaker: 'Qin Shi Huang', glyph: '秦', text: 'I have thirty million soldiers. You shall have every one of them.' },
      { speaker: 'Von Neumann', glyph: '⚙', text: 'Each soldier holds a flag. Raised, he is ONE; lowered, ZERO. Three soldiers make a gate; gates make adders; adders make a machine. Majesty — behold the computer QIN I, thirty million strong, its system bus a cavalry detachment riding down the motherboard!' },
      { speaker: 'Newton', glyph: '∇', text: 'With my laws and this engine, we shall integrate the suns\' motion forward and print a calendar of the eras. The dynasty of prediction begins today.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'UNLOCKED — the COMPUTER panel: a true numerical forecast of the suns. It runs an ensemble of integrations from slightly different measurements. Where the futures agree, trust the calendar. Where they fan apart — that is chaos, and no engine helps you.' },
    ],
  },
  {
    id: 'einstein', age: 10, unlock: 'einstein', title: 'The Pendulum Monument',
    pages: [
      { speaker: 'Einstein', glyph: '𝑒', text: 'You see the monument? A pendulum, swinging above the plain. To earlier ages it was a prayer — a plea that the universe be a clock after all, that somewhere beneath the madness there beats a period.' },
      { speaker: 'Einstein', glyph: '𝑒', text: 'Our instruments are finer now than Qin I ever dreamed. I can hand you the suns\' positions to one part in a million. And still — measure as finely as you like — the error GROWS. Doubles, and doubles, and doubles. The fan always opens.' },
      { speaker: 'Einstein', glyph: '𝑒', text: 'Poincaré was right. The three-body problem has no closed solution; prediction decays like radium. God does not merely play dice — he throws them where we cannot see.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'UPGRADED — Atomic-age instruments: ensemble forecasts now start from far sharper measurements. The horizon is longer. It is still finite. It will always be finite.' },
    ],
  },
  {
    id: 'unsolvable', age: 11, unlock: 'escape', title: 'The Goal Has Changed',
    pages: [
      { speaker: 'SYSTEM', glyph: '三', text: 'ANNOUNCEMENT TO ALL PLAYERS. Civilization No. 192 has fallen after four hundred and fifty-two years — the longest reign yet recorded, and still it was not spared. With it, the accumulated computation of every civilization before it is complete. The conclusion is final: the three-body problem cannot be solved.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'The motion of the three suns admits no stable pattern. Every civilization, however wise, will sooner or later be destroyed — by cold, by fire, by the stacked tides of a syzygy, or by falling into a sun. One day the last planet of this system will be consumed.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'Therefore the goal of the game has changed. There is no longer anything to predict. There is only somewhere to GO. Trisolaris must leave. Build the fleet. Cross the sea of stars.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'UNLOCKED — THE TRISOLARAN FLEET. Reach the Space Age and construct 1,000 interstellar ships. This is the final task. There will be no other.' },
    ],
  },
  {
    // CANON (outer frame): the recruiter steps out from behind the game.
    id: 'meet-up', age: 12, unlock: null, title: 'A Message Outside the Game',
    pages: [
      { speaker: 'ADMINISTRATOR', glyph: '◉', text: 'A line of text appears that does not belong to any era — no registrar, no civilization. It addresses YOU, the one holding the controls. You have outlasted nearly every other player. They have been watching how far you would go.' },
      { speaker: 'ADMINISTRATOR', glyph: '◉', text: 'Understand what you have been shown. This world was not invented to amuse you. Somewhere it is real — its three suns are real, its long freezes and its burning days are real, and its dying is not a score in a game.' },
      { speaker: 'ADMINISTRATOR', glyph: '◉', text: 'There are others who have seen it and understood. We meet, quietly, beyond the game. You are invited. Finish what you began here first — then decide whose side the sky is on.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'The frame closes again. The plain, the pyramid, the unbuilt fleet — all of it waits. (The game says nothing more of this. But you will not forget it.)' },
    ],
  },
];

// ----------------------------------------------------------
// MOMENTS — beats fired by an EVENT (not by reaching an age).
// Same shape as BEATS; surfaced via moment() and the 'beat' overlay.
// ----------------------------------------------------------
const MOMENTS = {
  // EXTENSION of CANON: stages the King Wen calendar disaster the first time
  // the player's own published Stable calendar is broken by chaos.
  'king-wen': {
    id: 'king-wen', title: 'The Calendar of King Wen',
    pages: [
      { speaker: 'SYSTEM', glyph: '三', text: 'On the strength of your published calendar, the people came out of the dehydratories in their millions. They soaked in the lakes, walked again, sowed the fields, lit the cities — they trusted the promise of calm.' },
      { speaker: 'King Wen of Zhou', glyph: '文', text: 'My hexagrams read the calm true… for a while. The lines do not lie. But the sky keeps no covenant with any line I cast. I am sorry. They were awake when it came.' },
      { speaker: 'SYSTEM', glyph: '三', text: 'A calendar is the oldest gamble of Three Body: you stake every living body on a prediction, and the three suns honor no prophecy. The bolder the promise, the greater the dead when it breaks. Predict only as far as you truly see.' },
    ],
  },
};

// ----------------------------------------------------------
// CHRONICLES — one-time lore cards recalling the legendary
// civilizations, fired the first time a matching fate occurs.
// ----------------------------------------------------------
const CHRONICLES = {
  'chronicle-137': { title: 'From the Chronicles · No. 137', text: 'The registrar adds a note from the old records: Civilization No. 137 also ended in a long freeze, in the age of King Wen, when a calendar promised a calm that the cold did not keep. The first lesson of Three Body, written again.' },
  'chronicle-183': { title: 'From the Chronicles · No. 183', text: 'The old records stir: Civilization No. 183 burned on the day three suns crowded the same sky — the very age in which an astronomer named the truth aloud, that there were three suns and no pattern at all.' },
  'chronicle-184': { title: 'From the Chronicles · No. 184', text: 'The records remember No. 184: torn upward into the sky by a tri-solar syzygy on the very day its grand computation printed a calendar of hope. Knowledge bought the prediction; it could not buy the world.' },
};

// ----------------------------------------------------------
// One-time event notices (taught in the registrar's voice).
// ----------------------------------------------------------
const NOTICES = {
  'era-stable': { title: 'Stable Era', text: 'The registrar proclaims a STABLE ERA. The sun keeps a schedule; crops can grow and cities can rise. Rehydrate the stored, and build while the calm lasts — no Stable Era is eternal.' },
  'era-chaotic': { title: 'Chaotic Era', text: 'The registrar proclaims a CHAOTIC ERA. The sun answers to nothing now. Watch the temperature; when it runs for the extremes, give the order: DEHYDRATE.' },
  'three-flying-stars': { title: 'Three Flying Stars', text: 'Three flying stars hang in the sky at once — the most dreaded of omens. All the suns are far away. The long, deep cold is coming. Dehydrate while you can.' },
  'tri-solar-day': { title: 'Tri-Solar Day', text: 'THREE SUNS stand in the sky together. The world is a furnace; stone glows and seas boil. Those still hydrated are already gone. Pray the dehydratories hold.' },
  'double-sun': { title: 'Twin Suns', text: 'Two suns blaze overhead. The heat climbs fast. If a third joins them, nothing on the surface will remain.' },
  'syzygy': { title: 'Tri-Solar Syzygy', text: 'The three suns have stacked into a single line above the world. Their gravities add; the tide reaches down like a hand and pulls the surface toward the sky.' },
  'sun-escape': { title: 'A Sun Departs', text: 'Impossibly, one of the three suns has been flung from the dance and recedes into the deep night. The registrar is silent. The remaining two settle toward an orderly waltz.' },
  'eclipse': { title: 'An Eclipse of Suns', text: 'Two suns cross paths in the sky and one slides behind the other — a ring of fire about a disc of shadow. The astronomers note it carefully: a fleeting alignment, harmless in itself, but proof that even the suns\' paths intersect. Beautiful, and a little terrible.' },
};

// ----------------------------------------------------------
// Registrar messages: destruction, rebirth, endings.
// ----------------------------------------------------------
function destructionText(civ: Civ, ageName) {
  return 'Civilization No. ' + civ.no + ' was destroyed by ' + civ.deathCause +
    '. This civilization had advanced to the ' + ageName + '.\n\n' +
    'The seed of civilization remains. It will germinate and again progress ' +
    'through the unpredictable world of Three Body.\n\nWe invite you to log in again.';
}

function planetLostText(kind, planetsLeft) {
  const what = kind === 'engulf'
    ? 'The planet brushed the photosphere of a sun. For a moment it hung there, a dark grain against the fire — then it was drawn down and consumed.'
    : kind === 'eject'
    ? 'Slung by the suns\' final encounter, the planet has been cast out of the system, falling forever through starless cold.'
    : 'At the syzygy\'s peak the stacked tides exceeded the planet\'s own grip upon itself. The world tore in two, like a heart breaking.';
  const tail = planetsLeft > 0
    ? '\n\nThis star system once held twelve worlds. ' + planetsLeft +
      (planetsLeft === 1 ? ' remains' : ' remain') +
      '. The seed of civilization is carried to the next, and the game continues.'
    : '\n\nIt was the last world of Trisolaris.';
  return what + tail;
}

const ENDING = {
  title: 'The Fleet Departs',
  pages: [
    'On the thousandth day of the final Stable Era, the Trisolaran Fleet stood complete: one thousand ships in a phalanx across the sky, each a teardrop of stellar fire.',
    'There was no ceremony. A civilization that has died two hundred times does not celebrate; it simply leaves. The fleet accelerated outward, and the three mad suns shrank behind it into the dance that no mind will ever predict.',
    'The destination was already chosen. Four light-years away shines a single, steady, merciful star — and around it a world whose civilization has just revealed its position to the universe.',
    'They will arrive in four hundred and fifty years.\n\nTHE THREE BODY GAME IS OVER.',
  ],
};

const SILENCE = {
  title: 'The Silence of Trisolaris',
  text: 'The last world of the three suns is gone. Two hundred civilizations, every hexagram, every sphere of Mozi, every soldier of the human computer — all of it now belongs to the fire.\n\nTrisolaris has fallen silent forever.',
};

// ----------------------------------------------------------
// Trigger logic
// ----------------------------------------------------------
function create() {
  return { seenBeats: {}, seenNotices: {} };
}

// Returns the next un-seen beat due at this age (or null).
function dueBeat(story, ageIdx) {
  for (const b of BEATS) {
    if (b.age <= ageIdx && !story.seenBeats[b.id]) return b;
  }
  return null;
}
function markBeat(story, id) { story.seenBeats[id] = true; }

// The chronicle cards share the one-time notice machinery.
Object.assign(NOTICES, CHRONICLES);

// One-time notice for an event type (or null if already shown).
function notice(story, key) {
  if (!NOTICES[key] || story.seenNotices[key]) return null;
  story.seenNotices[key] = true;
  return Object.assign({ key }, NOTICES[key]);
}

// An event-triggered beat (king-wen, …), shown once. Tracked in seenBeats
// alongside the age-based beats so it can never repeat.
function moment(story, key) {
  if (!MOMENTS[key] || story.seenBeats[key]) return null;
  story.seenBeats[key] = true;
  return MOMENTS[key];
}

export {
  BEATS, MOMENTS, NOTICES, CHRONICLES, ENDING, SILENCE,
  create, dueBeat, markBeat, notice, moment,
  destructionText, planetLostText,
};
