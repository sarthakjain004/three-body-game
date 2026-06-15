/* ============================================================
 * THREE BODY — audio.js
 * Procedural ambience (WebAudio): wind that follows the climate, a drone
 * that follows the era, generative per-era music (an evolving pad + a
 * sparse bell motif), and event stingers. All synthesized — no samples.
 * Browser only.
 * ============================================================ */
'use strict';
var TB = globalThis.TB = globalThis.TB || {};

(function () {
  const U = TB.util;
  let ac = null, master = null, windGain = null, windFilter = null,
      droneGain = null, droneOsc = [], muted = false, ready = false;
  // Generative ambient music: a slow pad + sparse bell motif whose mode,
  // register, brightness and tempo follow the era and the sky.
  let musicGain = null, padFilter = null, pad = [], nextNote = 0, noteIval = 2.6;

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // Mode degrees (semitones). Stable = open major pentatonic (hopeful);
  // chaotic = whole-tone (rootless, unsettled).
  const SCALE_STABLE = [0, 2, 4, 7, 9, 12, 14];
  const SCALE_CHAOS = [0, 2, 4, 6, 8, 10, 12];

  function init() {
    if (ready) {
      // Browsers can suspend the context (tab switch, autoplay policy):
      // any later user gesture routes through here and revives it.
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
      return;
    }
    if (muted) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);

    // Wind: looping noise through a wandering bandpass.
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    windFilter = ac.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 300; windFilter.Q.value = 0.8;
    windGain = ac.createGain(); windGain.gain.value = 0.05;
    src.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    src.start();

    // Drone: two detuned low oscillators.
    droneGain = ac.createGain(); droneGain.gain.value = 0.05; droneGain.connect(master);
    for (const f of [55, 82.5]) {
      const o = ac.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      o.connect(droneGain); o.start();
      droneOsc.push(o);
    }

    // Music: a three-voice pad (root / colour-tone / fifth) through a
    // gentle lowpass, plus a scheduled bell motif (see update()).
    musicGain = ac.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
    padFilter = ac.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = 600; padFilter.Q.value = 0.6;
    padFilter.connect(musicGain);
    pad = [];
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator();
      o.type = 'triangle'; o.frequency.value = midi(50 + [0, 4, 7][i]);
      const g = ac.createGain(); g.gain.value = [0.5, 0.32, 0.4][i];
      o.connect(g); g.connect(padFilter); o.start();
      pad.push(o);
    }
    nextNote = ac.currentTime + 1.5;
    ready = true;
  }

  // A soft bell note (sine + quick attack, long exponential tail).
  function bell(freq, vol) {
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 3.4);
  }

  // Smoothly follow the game state. Call every frame.
  function update(state) {
    if (!ready || !state) return;
    const now = ac.currentTime;
    const T = state.cl.tempC;
    const chaos = state.cl.eraType === 'chaotic';
    const dormant = !state.civ || !state.civ.alive || state.civ.dormant;
    const extremity = U.clamp((Math.abs(T - 15) - 25) / 80, 0, 1);
    const coldness = U.clamp((5 - T) / 55, 0, 1);
    const heat = U.clamp((T - 30) / 130, 0, 1);

    const wTarget = 0.03 + extremity * 0.16 + (chaos ? 0.05 : 0);
    windGain.gain.setTargetAtTime(wTarget, now, 1.5);
    windFilter.frequency.setTargetAtTime(220 + extremity * 700, now, 2);
    // Chaotic eras detune the drone into a sour minor second.
    droneOsc[1].frequency.setTargetAtTime(chaos ? 58.3 : 82.5, now, 3);
    droneGain.gain.setTargetAtTime(chaos ? 0.07 : 0.045, now, 2);

    // --- Music: pad chord glides with mode & register; bells are scheduled ---
    const root = Math.round(50 - coldness * 10 + heat * 5);
    const off = chaos ? [0, 6, 10] : [0, 4, 7];   // whole-tone tension vs open major
    for (let i = 0; i < pad.length; i++) {
      pad[i].frequency.setTargetAtTime(midi(root + off[i]), now, 4);
      pad[i].detune.setTargetAtTime(chaos ? (i - 1) * 8 : 0, now, 4);   // unsettled beating
    }
    padFilter.frequency.setTargetAtTime(
      U.clamp(300 + (T + 60) / 210 * 1100, 260, 2200), now, 3);
    padFilter.Q.setTargetAtTime(chaos ? 2.2 : 0.6, now, 3);
    // A buried seed is near-silent; the living world breathes the pad.
    musicGain.gain.setTargetAtTime(dormant ? 0.012 : (chaos ? 0.05 : 0.062), now, 3);

    // Bell motif scheduler (audio-clock driven, with catch-up guard).
    const ivalTarget = (chaos ? 1.6 : 2.8) - extremity * 0.5;
    noteIval += (ivalTarget - noteIval) * 0.03;
    if (nextNote < now - 5) nextNote = now + noteIval;   // tab was backgrounded
    if (!dormant && now >= nextNote) {
      if (Math.random() > 0.22) {                        // sometimes rest, for space
        const scale = chaos ? SCALE_CHAOS : SCALE_STABLE;
        const deg = scale[(Math.random() * scale.length) | 0];
        const oct = Math.random() < 0.55 ? 12 : (Math.random() < 0.5 ? 0 : 24);
        bell(midi(root + deg + oct), (chaos ? 0.04 : 0.055) * (0.7 + Math.random() * 0.5));
      }
      nextNote = now + noteIval * (0.7 + Math.random() * 0.6);
    }
  }

  function tone(freq, t0, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // Event stingers.
  function sting(kind) {
    if (!ready) return;
    const t = ac.currentTime + 0.02;
    switch (kind) {
      case 'stable':   tone(330, t, 0.9, 'sine', 0.1); tone(495, t + 0.18, 1.1, 'sine', 0.08); break;
      case 'chaotic':  tone(220, t, 0.8, 'sawtooth', 0.05); tone(156, t + 0.15, 1.2, 'sawtooth', 0.05); break;
      case 'hot':      tone(523, t, 0.4, 'square', 0.04); tone(659, t + 0.1, 0.4, 'square', 0.04);
                       tone(784, t + 0.2, 0.7, 'square', 0.04); break;
      case 'cold':     tone(392, t, 1.4, 'sine', 0.07); tone(370, t + 0.5, 1.8, 'sine', 0.06); break;
      case 'syzygy': {
        tone(40, t, 2.6, 'sine', 0.28);
        const n = ac.createBufferSource();
        const len = ac.sampleRate * 1.2;
        const b = ac.createBuffer(1, len, ac.sampleRate);
        const dd = b.getChannelData(0);
        for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
        n.buffer = b;
        const g = ac.createGain(); g.gain.value = 0.1;
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
        n.connect(f); f.connect(g); g.connect(master); n.start(t);
        break;
      }
      case 'death':    tone(294, t, 1.6, 'sine', 0.1); tone(247, t + 0.5, 1.8, 'sine', 0.1);
                       tone(196, t + 1.0, 2.4, 'sine', 0.1); break;
      case 'germinate':tone(587, t, 0.5, 'sine', 0.07); tone(880, t + 0.16, 0.9, 'sine', 0.05); break;
      // A soft "incoming transmission" chime for story beats — gentle, two
      // rising sine tones with a long tail, so a prompt arrives kindly.
      case 'beat':     tone(396, t, 1.2, 'sine', 0.05); tone(528, t + 0.18, 1.4, 'sine', 0.045);
                       tone(792, t + 0.36, 1.1, 'sine', 0.025); break;
      case 'age':      tone(440, t, 0.35, 'triangle', 0.08); tone(554, t + 0.12, 0.35, 'triangle', 0.08);
                       tone(659, t + 0.24, 0.6, 'triangle', 0.08); break;
      case 'fleet':    [440, 554, 659, 880].forEach((f, i) => tone(f, t + i * 0.16, 1.0, 'triangle', 0.09)); break;
    }
  }

  function setMuted(m) {
    muted = m;
    if (ready && master) master.gain.value = m ? 0 : 0.5;
    if (!ready && !m) init();
  }
  function isMuted() { return muted; }

  TB.audio = { init, update, sting, setMuted, isMuted };
})();
