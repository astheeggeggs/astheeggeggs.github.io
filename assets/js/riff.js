/* =============================================================================
   RIFF.JS — procedurally generated chip-metal. No samples, no MIDI files,
   no copyright: every note is synthesised in WebAudio at runtime.
   Riff.play('quest' | 'quest2' | 'space' | 'cave' | 'title'), Riff.stop(), Riff.toggle(style), Riff.setDread(0..1), Riff.playing,
   Riff.boss(on), Riff.stinger(name), Riff.render(style, seconds, opts) -> Promise<AudioBuffer>, Riff.analyse(buffer);
   plug-in tracks through Riff.addStyle / addStinger / kit / has (see STYLES below).
   ============================================================================= */
(function () {
  'use strict';
  var AC = null, master = null, tone = null, dist = null, timer = null, playing = false, style = null;
  var dread = 0, fbGain = null, wetGain = null;
  var owMix = null, metalMix = null, boost = 0, rendering = false;
  var step = 0, nextT = 0, buttons = [];
  var gate = null, duck = null, stingBus = null, lastStyle = null, parked = false;
  var bossWant = false, bossOn = false, bossStep = 0;
  /* --- plug-in styles and stingers: riff2.js registers whole tracks here without touching this file.
     Riff.addStyle(name, {schedule: fn(S), dreadful: bool, info: fn}) — schedule(S) is called every 100 ms with
     S = {now, nextT, step, dread, boost}; it must schedule audio from S.nextT up to S.now + 0.3 and advance
     S.nextT / S.step (drop what is already late, like the schedulers below). Voices built on Riff.kit().AC are
     tracked, so Riff.stop() kills them. `dreadful` styles get the dread filter; the rest play fully open. ---- */
  var STYLES = {}, XSTING = {};

  function ctx() {
    if (AC) return AC;
    AC = new (window.AudioContext || window.webkitAudioContext)();
    buildBuses();
    return AC;
  }
  // the fixed part of the graph, built once per context: the live one, or an OfflineAudioContext under Riff.render
  function buildBuses() {
    master = AC.createGain(); master.gain.value = 0.5;
    tone = AC.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 18000; tone.Q.value = 0.7;
    // output stage: music → dread filter → gate (stop) → duck (stingers) → limiter → soft clip → speakers.
    // The old chain went straight to the destination and peaked at about 1.5 at full dread, which is hard clipping.
    gate = AC.createGain(); gate.gain.value = 1; duck = AC.createGain(); duck.gain.value = 1;
    var comp = AC.createDynamicsCompressor();
    comp.threshold.value = -9; comp.knee.value = 6; comp.ratio.value = 14; comp.attack.value = 0.002; comp.release.value = 0.16;
    var trim = AC.createGain(); trim.gain.value = 0.5 * 0.8;          // 0.5 maps ±2 into the shaper's ±1 domain; 0.8 takes back the compressor's make-up gain
    var clip = AC.createWaveShaper(); clip.curve = softClip(); clip.oversample = '2x';
    master.connect(tone); tone.connect(gate); gate.connect(duck); duck.connect(comp); comp.connect(trim); trim.connect(clip); clip.connect(AC.destination);
    stingBus = AC.createGain(); stingBus.gain.value = 0.9; stingBus.connect(comp);   // one-shots skip the dread filter, the gate and the duck
    owMix = AC.createGain(); owMix.gain.value = 1; owMix.connect(master);
    metalMix = AC.createGain(); metalMix.gain.value = 1; metalMix.connect(master);
    // distortion bus for guitars
    var pre = AC.createGain(); pre.gain.value = 1.0;
    var shaper = AC.createWaveShaper(); shaper.curve = curve(120); shaper.oversample = '4x';
    var post = AC.createBiquadFilter(); post.type = 'lowpass'; post.frequency.value = 3200; post.Q.value = 0.8;
    var body = AC.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 180; body.gain.value = 5;
    var g = AC.createGain(); g.gain.value = 0.22;
    pre.connect(shaper); shaper.connect(post); post.connect(body); body.connect(g); g.connect(metalMix);
    dist = pre;
  }
  // n - 1, not n: a WaveShaper maps input 0 to index (n-1)/2, so an off-centre table leaks a
  // constant DC offset into the whole mix (softClip() below gets this right with an odd length).
  function curve(k) { var n = 1025, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i * 2 / (n - 1) - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  // transparent below 0.6, then a tanh shoulder that can never exceed 0.97. Input domain is ±2 (see `trim`).
  function softClip() {
    var n = 4097, c = new Float32Array(n), K = 0.6, H = 0.37;
    for (var i = 0; i < n; i++) { var x = (i / (n - 1) * 2 - 1) * 2, a = Math.abs(x), y = a <= K ? a : K + H * tanh((a - K) / H); c[i] = x < 0 ? -y : y; }
    return c;
  }
  function tanh(x) { var e = Math.exp(2 * x); return (e - 1) / (e + 1); }
  function f(n) { return 440 * Math.pow(2, (n - 69) / 12); }   // midi note → Hz

  /* --- instruments ------------------------------------------------------- */
  function chug(note, t, dur, mute, lean, ivs) {
    // power chord: root + fifth + octave (or the semitones in `ivs`), two detuned saws each, palm-muted envelope
    // lean (boss fight): one saw per chord tone, a little louder, so the choir has oscillators to spare
    (ivs || [0, 7, 12]).forEach(function (iv, k) {
      (lean ? [k * 7 - 7] : [-6, 6]).forEach(function (det) {
        var o = AC.createOscillator(), g = AC.createGain();
        o.type = 'sawtooth'; o.frequency.value = f(note + iv); o.detune.value = det;
        var a = (mute ? 0.55 : 0.35) * (lean ? 1.1 : 1), d = mute ? Math.min(dur, 0.11) : dur;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a / (k + 1), t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0008, t + d);
        o.connect(g); g.connect(dist); o.start(t); o.stop(t + d + 0.02);
      });
    });
  }
  function lead(note, t, dur) {
    var o = AC.createOscillator(), g = AC.createGain(), v = AC.createOscillator(), vg = AC.createGain();
    o.type = 'square'; o.frequency.value = f(note);
    v.frequency.value = 6; vg.gain.value = 4; v.connect(vg); vg.connect(o.detune); v.start(t); v.stop(t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dist); o.start(t); o.stop(t + dur + 0.02);
  }
  var noiseBufs = {}, LOOPN = 3;
  function noise(sec) {
    sec = sec || 0.5; var k = 'b' + sec; if (noiseBufs[k]) return noiseBufs[k];
    var b = AC.createBuffer(1, Math.round(AC.sampleRate * sec), AC.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBufs[k] = b;
  }
  // Transients (kick, snare, hats, thumps) are shorter than the half-second buffer. Anything that
  // LOOPS for seconds — the crash, the riser, every stinger bed — takes the long buffer and starts
  // at a random offset, so the same noise does not repeat at 2 Hz under the blast-off.
  function loopNoise() { var s = AC.createBufferSource(); s.buffer = noise(LOOPN); s.loop = true; return s; }
  function loopAt() { return Math.random() * (LOOPN - 0.25); }
  function kick(t, v) {
    v = v === undefined ? 1 : v;
    var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(metalMix); o.start(t); o.stop(t + 0.25);
    var c = AC.createBufferSource(), cg = AC.createGain(), hp = AC.createBiquadFilter(); c.buffer = noise(); hp.type = 'highpass'; hp.frequency.value = 2000;
    cg.gain.setValueAtTime(0.25 * v, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03); c.connect(hp); hp.connect(cg); cg.connect(metalMix); c.start(t); c.stop(t + 0.05);
  }
  function snare(t, v) {
    v = v === undefined ? 1 : v;
    var s = AC.createBufferSource(), g = AC.createGain(), bp = AC.createBiquadFilter(); s.buffer = noise(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); s.connect(bp); bp.connect(g); g.connect(metalMix); s.start(t); s.stop(t + 0.2);
    var o = AC.createOscillator(), og = AC.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    og.gain.setValueAtTime(0.4 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(og); og.connect(metalMix); o.start(t); o.stop(t + 0.1);
  }
  function hat(t, open, v) {
    v = v === undefined ? 1 : v;
    var s = AC.createBufferSource(), g = AC.createGain(), hp = AC.createBiquadFilter(); s.buffer = noise(); hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime((open ? 0.22 : 0.14) * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.18 : 0.04)); s.connect(hp); hp.connect(g); g.connect(metalMix); s.start(t); s.stop(t + 0.2);
  }


  /* --- overworld instruments (N64 pastoral kit) ------------------------- */
  var soft = null;   // gentle bus with a little reverb-ish delay
  function softBus() {
    if (soft) return soft;
    soft = AC.createGain(); soft.gain.value = 0.9;
    var delay = AC.createDelay(1.0), fb = AC.createGain(), wet = AC.createGain(), lp = AC.createBiquadFilter(); fbGain = fb; wetGain = wet;
    delay.delayTime.value = 0.31; fb.gain.value = 0.32; wet.gain.value = 0.22; lp.type = 'lowpass'; lp.frequency.value = 2400;
    soft.connect(owMix); soft.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(owMix);
    return soft;
  }
  // A note shorter than its own attack + decay still has to be scheduled in time order: an event
  // that sorts before the decay ramp cancels it, and the note jumps from peak to sustain in one
  // sample — a flat top and a click instead of a decay. Hold the sustain until the decay has run.
  // Notes longer than a + d are unchanged. Returns the time the envelope reaches silence.
  function env(g, t, a, peak, d, sus, dur, rel) {
    var s = Math.max(0.0002, peak * sus), hold = Math.max(dur, a + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(s, t + a + d);
    g.gain.setValueAtTime(s, t + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + hold + rel);
    return t + hold + rel;
  }
  function marimba(note, t, dur, vel) {
    var o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), g2 = AC.createGain();
    o.type = 'sine'; o.frequency.value = f(note); o2.type = 'sine'; o2.frequency.value = f(note) * 4.0;
    var end = env(g, t, 0.003, vel * 0.5, 0.25, 0.08, Math.min(dur, 0.5), 0.15); env(g2, t, 0.002, vel * 0.12, 0.06, 0.01, 0.08, 0.05);
    o.connect(g); o2.connect(g2); g.connect(softBus()); g2.connect(softBus()); o.start(t); o2.start(t); o.stop(Math.max(t + dur + 0.4, end + 0.03)); o2.stop(t + 0.3);
  }
  function ocarina(note, t, dur, vel) {
    var o = AC.createOscillator(), g = AC.createGain(), v = AC.createOscillator(), vg = AC.createGain(), lp = AC.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f(note); lp.type = 'lowpass'; lp.frequency.value = 1800;
    v.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(7, t + 0.25); v.connect(vg); vg.connect(o.detune); v.start(t); v.stop(t + dur + 0.3);
    env(g, t, 0.05, vel * 0.32, 0.1, 0.8, dur, 0.12);
    o.connect(lp); lp.connect(g); g.connect(softBus()); o.start(t); o.stop(t + dur + 0.3);
  }
  function bell(note, t, dur, vel) {
    [1, 2.76, 5.4].forEach(function (r, i) {
      var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f(note) * r;
      var end = env(g, t, 0.002, vel * [0.35, 0.12, 0.05][i], 0.4 / (i + 1), 0.05, Math.min(dur, 0.9), 0.3);
      o.connect(g); g.connect(softBus()); o.start(t); o.stop(Math.max(t + dur + 0.6, end + 0.03));
    });
  }
  // a triangle with a sine an octave below it. `sub` is that octave's level (default 1, the boss layer's floor); the
  // town passes a light one, because at full level the octave alone was most of the mix and buried the tune
  function bass(note, t, dur, vel, sub) {
    var o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), sg = AC.createGain(), lp = AC.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f(note); o2.type = 'sine'; o2.frequency.value = f(note) / 2; sg.gain.value = sub === undefined ? 1 : sub;
    lp.type = 'lowpass'; lp.frequency.value = 500;
    env(g, t, 0.006, vel * 0.55, 0.1, 0.7, dur * 0.9, 0.08);
    o.connect(lp); o2.connect(sg); sg.connect(lp); lp.connect(g); g.connect(owMix); o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }
  function pad(notes, t, dur, vel) {
    notes.forEach(function (n) {
      [-5, 5].forEach(function (det) {
        var o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = f(n); o.detune.value = det; lp.type = 'lowpass'; lp.frequency.value = 900;
        env(g, t, 0.4, vel * 0.07, 0.3, 0.9, dur - 0.3, 0.5);
        o.connect(lp); lp.connect(g); g.connect(softBus()); o.start(t); o.stop(t + dur + 0.8);
      });
    });
  }
  function softKick(t) { var o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.08); g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(owMix); o.start(t); o.stop(t + 0.2); }
  function brush(t, v) { var s = AC.createBufferSource(), g = AC.createGain(), bp = AC.createBiquadFilter(); s.buffer = noise(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.9; g.gain.setValueAtTime(0.16 * (v === undefined ? 1 : v), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(bp); bp.connect(g); g.connect(owMix); s.start(t); s.stop(t + 0.15); }
  function shaker(t, acc) { var s = AC.createBufferSource(), g = AC.createGain(), hp = AC.createBiquadFilter(); s.buffer = noise(); hp.type = 'highpass'; hp.frequency.value = 8000; g.gain.setValueAtTime(acc ? 0.09 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(hp); hp.connect(g); g.connect(owMix); s.start(t); s.stop(t + 0.07); }
  // the town lead: a quarter-width pulse under a triangle, a breathy low-pass, vibrato that arrives late and only on notes long enough to want it
  function flute(note, t, dur, vel) {
    var g = AC.createGain(), lp = AC.createBiquadFilter(), v = AC.createOscillator(), vg = AC.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 2300; lp.Q.value = 0.6;
    v.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.setValueAtTime(0, t + 0.16); vg.gain.linearRampToValueAtTime(dur > 0.4 ? 9 : 3, t + 0.5); v.connect(vg); v.start(t); v.stop(t + dur + 0.3);
    [[0.25, -3, 0.55], [0, 3, 0.5]].forEach(function (p) {
      var o = AC.createOscillator(), og = AC.createGain(); if (p[0]) o.setPeriodicWave(pulse(p[0])); else o.type = 'triangle';
      o.frequency.value = f(note); o.detune.value = p[1]; og.gain.value = p[2]; vg.connect(o.detune);
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.3);
    });
    env(g, t, 0.035, vel * 0.45, 0.12, 0.85, dur, 0.1);
    lp.connect(g); g.connect(softBus());
  }
  // the Master Quest plectrum: a saw and a square an octave up, a fast decay, high-passed so it stays wiry
  function harpsi(note, t, dur, vel) {
    var g = AC.createGain(), hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260;
    var end = env(g, t, 0.002, vel * 0.45, 0.22, 0.12, Math.min(dur, 0.5), 0.12);
    [['sawtooth', 0, 1], ['square', 12, 0.35]].forEach(function (p) { var o = AC.createOscillator(), og = AC.createGain(); o.type = p[0]; o.frequency.value = f(note + p[1]); og.gain.value = p[2]; o.connect(og); og.connect(hp); o.start(t); o.stop(end + 0.03); });
    hp.connect(g); g.connect(softBus());
  }
  // the mirrored lead: a quarter pulse and a saw a few cents apart through a soft clip, so it has teeth
  var GRIT = null;
  function gritLead(note, t, dur, vel) {
    var g = AC.createGain(), sh = AC.createWaveShaper(), lp = AC.createBiquadFilter(), lg = null;
    sh.curve = GRIT || (GRIT = curve(3)); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.8;
    if (dur > 0.3) { var v = AC.createOscillator(); lg = AC.createGain(); v.frequency.value = 5.8; lg.gain.setValueAtTime(0, t + 0.12); lg.gain.linearRampToValueAtTime(12, t + 0.45); v.connect(lg); v.start(t); v.stop(t + dur + 0.2); }
    [[0.25, -6], [0, 6]].forEach(function (p) {
      var o = AC.createOscillator(), og = AC.createGain(); if (p[0]) o.setPeriodicWave(pulse(p[0])); else o.type = 'sawtooth';
      o.frequency.value = f(note); o.detune.value = p[1]; og.gain.value = 0.5; if (lg) lg.connect(o.detune);
      o.connect(og); og.connect(sh); o.start(t); o.stop(t + dur + 0.2);
    });
    env(g, t, 0.012, vel * 0.28, 0.1, 0.8, dur, 0.08);
    sh.connect(lp); lp.connect(g); g.connect(softBus());
  }

  /* --- the overworld piece: a town theme in G, 108 BPM, twelve 8-bar sections (3 min 33 s), loops ------
     Written as note data, not generated. Pitches are DEGREES of the key on a sixteenth grid,
     "pos.degree.length" (0 = G4, 7 = G5, -7 = G3; a trailing + or - is a chromatic alteration,
     honoured only while the world is still major). Degrees are what let one tune be re-read
     through darker modes as dread rises (SHADES: a whole four-bar phrase switches on its first
     bar line, never a single note) and, for the Master Quest ('quest2'), be mirrored: every
     interval inverted about the tonic and the harmony inverted with it, in the parallel minor. */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var OW_KEY = 67, OW_BPM = 108, OW_LOW = 96, OW_TOP = 160, OW2_BPM = 132, OW2_TOP = 176;
  var MODES = { major: [0, 2, 4, 5, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10] };
  var SHADE_AT = [0.3, 0.5, 0.7, 0.85], SHADES = ['major', 'mixo', 'dorian', 'aeolian', 'phrygian'], SHADES2 = ['aeolian', 'aeolian', 'phrygian', 'phrygian', 'locrian'];
  function shadeOf(d) { var k = 0; while (k < SHADE_AT.length && d >= SHADE_AT[k]) k++; return k; }
  function pitch(deg, alt, mode) { var o = Math.floor(deg / 7); return OW_KEY + MODES[mode][deg - o * 7] + 12 * o + (alt || 0); }
  // chords: [root degree, alterations of the chord tones (major only), seventh, bass degree when not the root]
  var CHORD = {
    G: [0], Am: [1], Bm: [2], C: [3], D: [4], Em: [5],
    G7: [0, 0, 1], Am7: [1, 0, 1], D7: [4, 0, 1], Em7: [5, 0, 1],
    A7: [1, [0, 1, 0, 0], 1], B7: [2, [0, 1, 0, 0], 1], E7: [5, [0, 1, 0, 0], 1],
    Cm: [3, [0, -1, 0]], F: [6, [-1, 0, 0]],
    'G/B': [0, 0, 0, 2], 'D/F#': [4, 0, 0, 6], 'C/E': [3, 0, 0, 5]
  };
  // the themes. ch: one chord per bar, or two split by a dot. mel: the lead. ans: the bell's answers (by bar), which
  // enter as the lead lands on a long note and move only while it holds or rests: a reply, never a second voice in its rhythm.
  // hook: the bars whose 3-3-2 figure the marimba doubles an octave down when a section asks for accents.
  var SEC = {
    A: { ch: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C.D', 'G'],                                   // the town theme: antecedent to the half close, consequent home
         mel: ['0.0.3 3.2.3 6.4.2 8.7.4 12.6.2 14.5.2', '0.4.3 3.5.3 6.4.2 8.2.6 14.1.2', '0.3.3 3.5.3 6.7.2 8.8.4 12.7.2 14.6.2', '0.5.3 3.4.3 6.3.2 8.4.2 10.5.2 12.6.4',
               '0.0.3 3.2.3 6.4.2 8.7.4 12.6.2 14.5.2', '0.4.3 3.5.3 6.4.2 8.2.4 12.4.2 14.5.2', '0.7.3 3.8.3 6.7.2 8.6.2 10.5.2 12.4.2 14.3.2', '0.2.2 2.1.2 4.0.6 14.4.2'],
         ans: { 1: '8.7.2 10.6.2 12.5.1 13.4.1', 3: '12.8.1 13.9.1 14.11.2', 5: '9.11.1 10.9.1 11.7.1', 7: '4.4.2 6.7.2 8.9.2 10.11.4' }, hook: [0, 4] },
    B: { ch: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'D7'],                                   // the relative minor, lifting onto G in its third bar
         mel: ['0.5.4 4.7.2 6.5.2 8.4.6 14.2.2', '0.3.4 4.5.2 6.3.2 8.1.6 14.3.2', '0.4.4 4.7.2 6.9.2 8.7.6 14.6.2', '0.6.4 4.5.2 6.4.2 8.5.8',
               '0.5.4 4.7.2 6.5.2 8.4.6 14.2.2', '0.3.4 4.5.2 6.3.2 8.1.6 14.3.2', '0.4.4 4.5.2 6.7.2 8.8.4 12.9.4', '0.10.4 4.8.2 6.6.2 8.5.4 12.4.4'] },
    C: { ch: ['C', 'A7', 'D', 'B7', 'Em', 'Cm', 'Am7.D7', 'G'],                              // the bridge: V of V, V of vi, the borrowed iv, ii-V home
         mel: ['0.7.4 4.8.2 6.7.2 8.5.4 12.3.4', '0.1.4 4.3+.2 6.5.2 8.8.6 14.7.2', '0.6.4 4.8.2 6.6.2 8.4.4 12.2.4', '0.4+.4 4.6.2 6.8.2 8.9.8',
               '0.7.4 4.5.2 6.4.2 8.2.6 14.4.2', '0.5-.4 4.7.2 6.5-.2 8.3.6 14.2.2', '0.1.4 4.3.2 6.5.2 8.6.4 12.8.4', '0.7.6 6.6.2 8.7.8'] },
    D: { ch: ['C', 'G/B', 'Am', 'D', 'C', 'G/B', 'Am', 'D7'],                                 // the wistful bit: long notes over a descending bass
         mel: ['0.7.6 6.8.2 8.7.4 12.5.4', '0.4.6 6.5.2 8.4.4 12.2.4', '0.3.6 6.4.2 8.3.4 12.1.4', '0.2.4 4.4.4 8.6.8',
               '0.7.6 6.8.2 8.7.4 12.5.4', '0.4.6 6.5.2 8.4.4 12.2.4', '0.3.4 4.4.4 8.5.4 12.6.4', '0.7.6 6.8.2 8.4.8'] },
    Z: { ch: ['C', 'D', 'G', 'Em', 'C', 'D', 'Am', 'D7'],                                     // the coda: the hook thrown between chords, ii-V, and round again
         mel: ['0.3.3 3.5.3 6.7.2 8.10.8', '0.4.3 3.6.3 6.8.2 8.11.8', '0.0.3 3.2.3 6.4.2 8.7.4 12.6.2 14.5.2', '0.4.3 3.5.3 6.4.2 8.2.8',
               '0.3.3 3.5.3 6.7.2 8.10.4 12.9.2 14.8.2', '0.4.3 3.6.3 6.8.2 8.11.4 12.10.2 14.9.2', '0.8.4 4.7.4 8.5.4 12.4.4', '0.3.4 4.2.4 8.1.4 12.-1.4'],
         ans: { 1: '10.8.2 12.9.2 14.10.2', 3: '8.7.2 10.6.2 12.5.2 14.4.2' }, hook: [0, 1, 2] }
  };
  // the form: which theme, and how it is dressed. lead: flute | ocarina. bass: pizz | walk | synco | long.
  // dr: brush | light | kit | none | brush4 (brushes from the fifth bar). pad: velocity or 0. ans: the bell answers.
  // harm: a voice in thirds below the strong notes ('bell'). arp: marimba | bell eighths as colour. acc: marimba on the hook.
  // dbl: the tune doubled an octave below (the ocarina under the flute; the grit lead under itself in the Master Quest).
  // vel: the tune's dynamic, which grows (with the dressing) to the ninth section and dips for the seventh and eighth.
  var FORM = [
    { s: 'A', lead: 'flute',   bass: 'pizz',  dr: 'brush',  pad: 0,   ans: 0, harm: 0,      arp: 0,         vel: 0.85 },             // 1  the statement: tune, bass, brushes
    { s: 'A', lead: 'flute',   bass: 'pizz',  dr: 'light',  pad: 0.8, ans: 1, harm: 0,      arp: 0,         vel: 0.9 },               // 2  the bells answer
    { s: 'B', lead: 'flute',   bass: 'walk',  dr: 'kit',    pad: 0.9, ans: 0, harm: 0,      arp: 'marimba', vel: 0.9 },               // 3  relative minor, marimba colour
    { s: 'A', lead: 'flute',   bass: 'synco', dr: 'kit',    pad: 0.8, ans: 1, harm: 'bell', arp: 0,         vel: 0.95, acc: 1 },       // 4  the return, in thirds
    { s: 'C', lead: 'ocarina', bass: 'walk',  dr: 'light',  pad: 1,   ans: 0, harm: 0,      arp: 'bell',    vel: 0.88 },            // 5  the bridge
    { s: 'B', lead: 'flute',   bass: 'walk',  dr: 'kit',    pad: 0.9, ans: 0, harm: 'bell', arp: 'marimba', vel: 0.95 },               // 6
    { s: 'A', lead: 'flute',   bass: 'long',  dr: 'none',   pad: 0,   ans: 0, harm: 0,      arp: 0,         vel: 0.8 },             // 7  thin: the tune and the bass alone
    { s: 'D', lead: 'ocarina', bass: 'long',  dr: 'brush4', pad: 1.2, ans: 0, harm: 0,      arp: 0,         vel: 0.85 },            // 8  wistful
    { s: 'A', lead: 'flute',   bass: 'synco', dr: 'kit',    pad: 0.9, ans: 1, harm: 'bell', arp: 'marimba', vel: 1, acc: 1, dbl: 1 }, // 9  the build: everything, the tune doubled an octave down
    { s: 'B', lead: 'flute',   bass: 'walk',  dr: 'kit',    pad: 0.9, ans: 0, harm: 'bell', arp: 'marimba', vel: 0.95 },               // 10
    { s: 'C', lead: 'flute',   bass: 'walk',  dr: 'kit',    pad: 1,   ans: 0, harm: 0,      arp: 'bell',    vel: 0.95 },               // 11 the bridge, driven
    { s: 'Z', lead: 'flute',   bass: 'pizz',  dr: 'kit',    pad: 0.8, ans: 1, harm: 0,      arp: 0,         vel: 0.95, acc: 1 }        // 12 the coda, round into 1
  ];
  var ARP = [[0, 1, 2, 3, 2, 1, 0, 1], [0, 2, 1, 3, 0, 2, 1, 3]];
  var OW = null, OW2 = null;
  // mirror: the Master Quest reading. Melody degree d becomes 7 - d (inverted about the tonic octave), a chord
  // on degree d becomes the chord on 3 - d (the inversion of its tones), the kit hardens: see FORM2 below.
  function composeOverworld(mirror) {
    if (mirror ? OW2 : OW) return mirror ? OW2 : OW;
    var rnd = mulberry32(mirror ? 128 : 64), steps = [], spans = [], form = mirror ? FORM2() : FORM;
    function notes(str) {
      var out = [];
      (str || '').split(' ').forEach(function (tok) {
        if (!tok) return;
        var p = tok.split('.'), d = p[1], alt = /\+$/.test(d) ? 1 : /-$/.test(d) ? -1 : 0, deg = parseInt(d, 10);
        if (mirror) { deg = 7 - deg; alt = -alt; }
        out.push({ p: +p[0], d: deg, alt: alt, len: +p[2] });
      });
      return out;
    }
    function chord(name) {
      var c = CHORD[name], d = c[0], alts = c[1] || [], bd = c[3] === undefined ? d : c[3];
      if (mirror) { bd = c[3] === undefined ? ((3 - d) % 7 + 7) % 7 : ((7 - bd) % 7 + 7) % 7; d = ((3 - d) % 7 + 7) % 7; alts = []; }
      var tones = [0, 2, 4].concat(c[2] ? [6] : []).map(function (iv, k) { return { d: d + iv, alt: alts[k] || 0 }; }), low = ((bd % 7) + 7) % 7 - 14;   // G2..F#3
      return { tones: tones, bass: { d: low, alt: bd === d ? (alts[0] || 0) : 0 }, third: { d: low + 2, alt: alts[1] || 0 }, fifth: { d: low + 4, alt: alts[2] || 0 } };
    }
    form.forEach(function (fm, si) {
      SEC[fm.s].ch.forEach(function (bar, b) { var names = bar.split('.'), L = 16 / names.length; names.forEach(function (nm, k) { spans.push({ at: si * 128 + b * 16 + k * L, len: L, c: chord(nm) }); }); });
    });
    // the bass line under one chord span: it walks or bounces and always approaches the next root by step (or sits on the fifth when the next root is a step away)
    function bassLine(kind, sp, next) {
      var c = sp.c, r = c.bass, n = next.c.bass, far = Math.abs(n.d - r.d), app = far <= 1 ? c.fifth : { d: n.d > r.d ? n.d - 1 : n.d + 1, alt: 0 }, oct = { d: r.d + 7, alt: r.alt };
      if (sp.len === 8) return kind === 'long' ? [[0, r, 7]] : kind === 'walk' ? [[0, r, 4], [4, app, 4]] : kind === 'chug' ? [[0, r, 2], [2, r, 2], [4, c.fifth, 2], [6, app, 2]]
                              : kind === 'synco' ? [[0, r, 3], [3, oct, 1], [4, c.fifth, 2], [6, app, 2]] : [[0, r, 3], [3, r, 1], [4, c.fifth, 2], [6, app, 2]];
      return kind === 'long' ? [[0, r, 15]] : kind === 'walk' ? [[0, r, 4], [4, c.third, 4], [8, c.fifth, 4], [12, app, 4]]
           : kind === 'chug' ? [[0, r, 2], [2, r, 2], [4, r, 2], [6, r, 2], [8, r, 2], [10, r, 2], [12, c.fifth, 2], [14, app, 2]]
           : kind === 'synco' ? [[0, r, 3], [3, oct, 3], [6, r, 2], [8, c.fifth, 3], [11, oct, 1], [12, c.fifth, 2], [14, app, 2]]
           : [[0, r, 3], [3, r, 1], [6, c.fifth, 2], [8, oct, 3], [12, c.fifth, 2], [14, app, 2]];   // pizz
    }
    function drums(kind, b, i, st) {
      var last = b === 7, fill = last && i >= 12;
      if (kind === 'half4') kind = b < 4 ? 'half' : 'hard';            // half time for four bars, then the whole kit
      if (kind === 'none' || (kind === 'brush4' && b < 4)) return;
      if (kind === 'brush' || kind === 'brush4') { if (i === 0 || i === 8) st.sk = 1; if (i === 4 || i === 12) st.br = 0.8; if (fill) st.br = 0.5 + (i - 12) * 0.17; }
      else if (kind === 'light') { if (i === 0 || i === 8 || (i === 10 && b % 2)) st.sk = 1; if (i === 4 || i === 12) st.br = 1; if (i % 2 === 0) st.shk = i % 4 === 0 ? 1 : 0.6; if (fill) { st.br = 0.5 + (i - 12) * 0.17; st.shk = 0; } }
      else if (kind === 'kit') {
        if (i === 0 || i === 6 || i === 8 || (i === 11 && b % 2)) st.sk = 1; if (i === 4 || i === 12) st.sn = 0.7;
        if (i % 2 === 0) st.ht = { o: i === 14 && b % 2 === 1 ? 1 : 0, v: i % 4 === 0 ? 1.1 : 0.8 };
        if (fill) { st.sn = 0.6 + (i - 12) * 0.12; st.ht = null; if (i === 13) st.tm = 147; if (i === 15) st.tm = 98; }
      }
      else if (kind === 'hard') {
        if (i === 0 || i === 6 || i === 8 || i === 10) st.kk = 0.85; if (i === 4 || i === 12) st.sn = 0.75;
        if (i % 2 === 0) st.ht = { o: i === 14 ? 1 : 0, v: 0.7 };
        if (last && i >= 8) { st.sn = 0.5 + (i - 8) * 0.07; st.ht = null; if (i === 12) st.tm = 147; if (i === 14) st.tm = 98; }
      }
      else if (kind === 'half') { if (i === 0) st.kk = 0.8; if (i === 8) st.sn = 0.6; if (i % 4 === 0) st.ht = { o: 0, v: 0.5 }; }
    }
    form.forEach(function (fm, si) {
      var sec = SEC[fm.s];
      for (var b = 0; b < 8; b++) {
        var at = si * 128 + b * 16, row = [], i;
        for (i = 0; i < 16; i++) row.push({ r: rnd(), sec: si, bar: b, lead: fm.lead, svel: fm.vel, arpv: fm.arp, harmv: fm.harm, bv: fm.bv, dbl: fm.dbl });
        var answered = fm.ans && sec.ans && sec.ans[b];      // the thirds sit out the bars the bells answer in: call in thirds, reply in bells
        notes(sec.mel[b]).forEach(function (m) {
          var st = row[m.p]; st.mel = { d: m.d, alt: m.alt, len: m.len, vel: m.p % 4 === 0 ? 1 : 0.8 };
          if (fm.harm && !answered && m.p % 4 === 0 && m.len >= 2) st.harm = { d: m.d - 2, alt: 0, len: m.len };
          if (fm.acc && sec.hook && sec.hook.indexOf(b) >= 0 && m.p < 8) st.acc = { d: m.d - 7, alt: m.alt };
        });
        if (fm.ans && sec.ans) notes(sec.ans[b]).forEach(function (a) { row[a.p].ans = { d: a.d, alt: a.alt, len: a.len }; });
        spans.forEach(function (sp, idx) {
          if (sp.at < at || sp.at >= at + 16) return;
          var next = spans[(idx + 1) % spans.length], off = sp.at - at;
          if (fm.pad) row[off].pad = { tones: sp.c.tones.map(function (tn) { var x = tn.d; while (x > -1) x -= 7; return { d: x, alt: tn.alt }; }), len: sp.len, vel: fm.pad };   // folded into G3..F#4
          bassLine(fm.bass, sp, next).forEach(function (bn) { row[off + bn[0]].bass = { d: bn[1].d, alt: bn[1].alt, len: bn[2], p: off + bn[0] }; });
          if (fm.arp) for (i = off; i < off + sp.len; i += 2) { var tn = sp.c.tones, ix = ARP[si % 2][(i / 2) % 8], tone = ix === 3 ? { d: tn[0].d + 7, alt: tn[0].alt } : tn[ix]; row[i].arp = { d: tone.d - 7, alt: tone.alt }; }
        });
        for (i = 0; i < 16; i++) drums(fm.dr, b, i, row[i]);
        steps = steps.concat(row);
      }
    });
    var song = { bpm: mirror ? OW2_BPM : OW_BPM, steps: steps, bars: steps.length / 16 };
    if (mirror) OW2 = song; else OW = song;
    return song;
  }
  // the Master Quest dressing of the same form: the hard kit and palm-muted chugs from bar one, a harpsichord for the marimba,
  // the lead with grit. The two long-bass sections stay the breath before the last push: the soft bass instead of chugs,
  // half-time drums (the seventh throughout, the eighth for four bars before the whole kit comes back)
  function FORM2() {
    return FORM.map(function (fm) {
      var thin = fm.bass === 'long';
      return { s: fm.s, lead: 'grit', bass: thin ? 'long' : 'chug', bv: thin ? 'soft' : 'chug', dr: fm.dr === 'none' ? 'half' : fm.dr === 'brush4' ? 'half4' : 'hard',
               pad: fm.pad, ans: fm.ans, harm: fm.harm, arp: fm.arp ? 'harpsi' : 0, vel: fm.vel, acc: fm.acc, dbl: fm.dbl };
    });
  }
  var OCT = [0, 12];   // a chug with no fifth, for the notes whose fifth in the mode is not perfect
  function drone(note, t, dur, vel) {
    [0, 7, 12].forEach(function (iv, i) {
      var o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
      o.type = i ? 'triangle' : 'sawtooth'; o.frequency.value = f(note + iv); o.detune.value = (i - 1) * 9 * dread;
      lp.type = 'lowpass'; lp.frequency.value = 260 + 300 * dread;
      var end = env(g, t, 0.8, vel * [0.16, 0.06, 0.04][i], 0.5, 0.9, dur - 0.5, 1.2);
      o.connect(lp); lp.connect(g); g.connect(owMix); o.start(t); o.stop(Math.max(t + dur + 1.5, end + 0.05));
    });
  }
  function heartbeat(t) { softKick(t); softKick(t + 0.17); }
  /* --- the boss kit: a cathedral on an oscillator budget ------------------- */
  var hallIn = null, choirIn = null, choirF = null;
  function hall() {   // three feedback delays at unrelated lengths: a cheap stone room
    if (hallIn) return hallIn;
    hallIn = AC.createGain(); hallIn.gain.value = 1;
    var out = AC.createGain(); out.gain.value = 0.2; out.connect(master);
    [0.113, 0.179, 0.263].forEach(function (s) {
      var d = AC.createDelay(0.5), fb = AC.createGain(), lp = AC.createBiquadFilter();
      d.delayTime.value = s; fb.gain.value = 0.56; lp.type = 'lowpass'; lp.frequency.value = 2600;
      hallIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out);
    });
    return hallIn;
  }
  // The choir is saws sung through three shared formant band-passes; the vowel is moved by retuning the filters.
  var VOWEL = { aah: [[800, 1.0], [1150, 0.6], [2900, 0.25]], ooh: [[400, 1.0], [780, 0.35], [2700, 0.08]] };
  function choirBus() {
    if (choirIn) return choirIn;
    choirIn = AC.createGain(); choirIn.gain.value = 1; choirF = [];
    var out = AC.createGain(); out.gain.value = 1.0; out.connect(master); out.connect(hall());
    VOWEL.aah.forEach(function (v, i) {
      var bp = AC.createBiquadFilter(), g = AC.createGain(); bp.type = 'bandpass'; bp.frequency.value = v[0]; bp.Q.value = 4 + i * 2; g.gain.value = v[1];
      choirIn.connect(bp); bp.connect(g); g.connect(out); choirF.push({ bp: bp, g: g });
    });
    var lp = AC.createBiquadFilter(), lg = AC.createGain(); lp.type = 'lowpass'; lp.frequency.value = 450; lg.gain.value = 0.3;   // chest: keeps the basses audible between formants
    choirIn.connect(lp); lp.connect(lg); lg.connect(out);
    return choirIn;
  }
  function vowel(name, t, glide) { choirBus(); VOWEL[name].forEach(function (v, i) { choirF[i].bp.frequency.setTargetAtTime(v[0], t, glide); choirF[i].g.gain.setTargetAtTime(v[1], t, glide); }); }
  function choir(notes, t, dur, vel) {   // 2 saws per singer + one shared vibrato LFO
    var bus = choirBus(), lfo = AC.createOscillator(), lg = AC.createGain();
    lfo.frequency.value = 5.1; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(10, t + 0.7); lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.5);
    notes.forEach(function (n, k) {
      [-9, 8].forEach(function (det) {
        var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = f(n); o.detune.value = det + k * 3 - 4; lg.connect(o.detune);
        env(g, t + k * 0.015, 0.2, vel * 0.16, 0.3, 0.85, Math.max(0.55, dur - 0.12), 0.4);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.5);
      });
    });
  }
  function chant(note, t, dur, vel) {   // the melody line of the choir: two saws, vibrato only when the note is long enough to need it
    var bus = choirBus(), lg = null;
    if (dur > 0.55) { var lfo = AC.createOscillator(); lg = AC.createGain(); lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(14, t + 0.4); lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.3); }
    [-7, 7].forEach(function (det) {
      var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = f(note); o.detune.value = det; if (lg) lg.connect(o.detune);
      env(g, t, 0.07, vel * 0.3, 0.1, 0.8, Math.max(0.18, dur - 0.05), 0.22);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.3);
    });
  }
  function timp(note, t, vel, roll) {   // kettle drum: a sine that settles onto its pitch, a fifth above it for the kettle, a felt thump
    var fr = f(note), d = roll ? 0.26 : 1.0, o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(fr * 1.4, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.52, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    o.connect(g); g.connect(metalMix); g.connect(hall()); o.start(t); o.stop(t + d + 0.02);
    if (!roll) {
      var o2 = AC.createOscillator(), g2 = AC.createGain(); o2.type = 'triangle'; o2.frequency.value = fr * 1.5;
      g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(vel * 0.12, t + 0.004); g2.gain.exponentialRampToValueAtTime(0.0008, t + 0.5);
      o2.connect(g2); g2.connect(metalMix); o2.start(t); o2.stop(t + 0.52);
    }
    var s = AC.createBufferSource(), sg = AC.createGain(), lp = AC.createBiquadFilter(); s.buffer = noise(); lp.type = 'lowpass'; lp.frequency.value = 700;
    sg.gain.setValueAtTime(vel * (roll ? 0.15 : 0.3), t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.06); s.connect(lp); lp.connect(sg); sg.connect(metalMix); s.start(t); s.stop(t + 0.08);
  }
  function brass(notes, t, dur, vel, stab) {   // low brass: saws behind a low-pass that opens as the players lean in
    var lp = AC.createBiquadFilter(), g = AC.createGain(), top = 500 + 1300 * vel, pk = stab ? 0.03 : dur * 0.62;
    lp.type = 'lowpass'; lp.Q.value = 1.4; lp.frequency.setValueAtTime(stab ? top : 160, t); if (!stab) lp.frequency.linearRampToValueAtTime(top, t + pk); lp.frequency.exponentialRampToValueAtTime(240, t + dur + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * (stab ? 0.15 : 0.13), t + pk); g.gain.setValueAtTime(vel * (stab ? 0.15 : 0.13), t + Math.max(pk, dur * 0.8)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    lp.connect(g); g.connect(metalMix); g.connect(hall());
    notes.forEach(function (n, k) {
      (k ? [4] : [-7, 7]).forEach(function (det) { var o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f(n); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.3); });
    });
  }
  function tubular(note, t, vel) {   // tubular bell: stretched partials with the minor-third "church" partial at 2.4
    [[1, 0.5, 3.6], [2, 0.34, 2.8], [2.4, 0.2, 2.2], [3, 0.2, 1.7], [4.5, 0.1, 1.1], [6.3, 0.05, 0.7]].forEach(function (p) {
      var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f(note) * p[0];
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * p[1] * 0.36, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + p[2]);
      o.connect(g); g.connect(master); g.connect(hall()); o.start(t); o.stop(t + p[2] + 0.05);
    });
  }

  /* --- the boss theme: G harmonic minor, 32 bars at 150, loops ------------- */
  var BOSS = null, BOSS_BPM = 150;
  function composeBoss() {
    if (BOSS) return BOSS;
    // v: choir voicing (smooth voice leading round a held G), r: guitar/bass root, tp: timpani, br: brass
    var CH = {
      i:   { v: [55, 58, 62, 67], r: 43, tp: 43, br: [43, 55] },
      VI:  { v: [55, 58, 63, 67], r: 39, tp: 51, br: [39, 51] },
      iv:  { v: [55, 60, 63, 67], r: 36, tp: 48, br: [36, 48] },
      V:   { v: [54, 57, 62, 66], r: 38, tp: 50, br: [38, 50] },     // D major: the raised leading tone, F sharp
      VII: { v: [53, 57, 60, 65], r: 41, tp: 53, br: [41, 53] }
    };
    var SECS = [
      { prog: ['i', 'i', 'VI', 'VI', 'iv', 'iv', 'V', 'V'], vow: 'ooh', vel: 0.8, mode: 'full', mv: 0.7,        // P: the ground is laid, men chant low
        mel: [[55, 12, 58, 4], [57, 8, 55, 8], [58, 12, 63, 4], [62, 8, 58, 8], [60, 12, 63, 4], [62, 8, 60, 8], [62, 16], [57, 8, 54, 8]] },
      { prog: ['i', 'iv', 'VI', 'V', 'i', 'iv', 'V', 'V'], vow: 'aah', vel: 0.9, mode: 'full', mv: 0.85,        // Q: the theme
        mel: [[67, 8, 70, 4, 69, 4], [72, 8, 75, 4, 74, 4], [70, 8, 67, 4, 70, 4], [69, 12, 66, 4], [67, 8, 70, 4, 74, 4], [75, 8, 74, 4, 72, 4], [74, 8, 72, 4, 69, 4], [66, 16]] },
      { prog: ['VI', 'VII', 'i', 'i', 'VI', 'VII', 'V', 'V'], vow: 'aah', vel: 1, mode: 'full', mv: 1, stabs: true,   // R: VI-VII-i, sopranos at the top of the stave
        mel: [[79, 8, 75, 4, 79, 4], [81, 8, 77, 4, 81, 4], [82, 12, 81, 2, 79, 2], [74, 8, 79, 8], [79, 8, 75, 4, 79, 4], [81, 8, 77, 4, 81, 4], [74, 4, 78, 4, 81, 8], [78, 16]] },
      { prog: ['i', 'i', 'iv', 'iv', 'VI', 'VI', 'V', 'V'], vow: 'ooh', vel: 0.6, mode: 'hush', mv: 0,            // S: it circles you. Then the roll.
        mel: null }
    ];
    var steps = [];
    SECS.forEach(function (sec, si) {
      for (var bar = 0; bar < 8; bar++) {
        var name = sec.prog[bar], ch = CH[name], changed = bar === 0 || sec.prog[bar - 1] !== name, run = 1;
        while (bar + run < 8 && sec.prog[bar + run] === name) run++;
        var mel = sec.mel ? sec.mel[bar] : null, mp = {}, pos = 0;
        if (mel) for (var m = 0; m < mel.length; m += 2) { mp[pos] = { n: mel[m], len: mel[m + 1] }; pos += mel[m + 1]; }
        for (var i = 0; i < 16; i++) {
          var st = { root: ch.r, mode: sec.mode, last: bar === 7, bar: bar };
          if (i === 0 && bar === 0) { st.bell = true; st.vow = sec.vow; }
          if (i === 0 && changed) { st.choir = { notes: ch.v, len: run * 16, vel: sec.vel }; st.brass = { notes: ch.br, len: Math.min(run * 16, 24), vel: sec.vel }; }
          if (mp[i]) st.chant = { n: mp[i].n, len: mp[i].len, vel: sec.mv };
          if (sec.stabs && (bar % 2 ? [0, 3, 6, 12, 14] : [0, 6, 12]).indexOf(i) >= 0) st.stab = ch.br;
          // timpani: a downbeat and a three-note pickup, a lighter answer on the even bars, a roll into every new section
          if (sec.mode === 'hush') { if (bar === 7) st.roll = { n: ch.tp, vel: 0.25 + 0.75 * i / 15 }; else if (i === 0) st.timp = { n: ch.tp, vel: 0.7 }; else if (i === 3) st.timp = { n: ch.tp, vel: 0.4 }; }
          else if (bar === 7 && i >= 8) st.roll = { n: ch.tp, vel: 0.4 + 0.6 * (i - 8) / 7 };
          else if (i === 0) st.timp = { n: ch.tp, vel: 1 };
          else if (bar % 2 === 0 && (i === 10 || i === 12 || i === 14)) st.timp = { n: i === 14 ? ch.tp : ch.tp - 5, vel: 0.45 + (i - 10) * 0.08 };
          else if (bar % 2 === 1 && i === 8) st.timp = { n: ch.tp, vel: 0.65 };
          steps.push(st);
        }
      }
    });
    return BOSS = { bpm: BOSS_BPM, steps: steps };
  }
  function scheduleBossStep(t, spb) {
    var song = composeBoss(), st = song.steps[bossStep % song.steps.length], i16 = bossStep % 16, full = st.mode === 'full';
    if (st.vow) vowel(st.vow, t, 0.25);
    if (st.bell) tubular(55, t, 1);
    if (st.choir) choir(st.choir.notes, t, st.choir.len * spb, st.choir.vel);
    if (st.chant) chant(st.chant.n, t, st.chant.len * spb * 0.96, st.chant.vel);
    if (st.brass) brass(st.brass.notes, t, st.brass.len * spb, st.brass.vel, false);
    if (st.stab) brass(st.stab, t, spb * 1.6, 1, true);
    if (st.timp) timp(st.timp.n, t, st.timp.vel, false);
    if (st.roll) timp(st.roll.n, t, st.roll.vel, true);
    if (i16 === 0 || i16 === 8) bass(st.root, t, spb * 8, 0.95);
    // the gallop and the boots stay, now following the harmony
    if (full) {
      if (i16 % 2 === 0 || i16 % 4 === 3) chug(st.root, t, spb * 0.9, true, true);
      if (i16 === 0 || i16 === 8 || i16 === 10 || (st.bar % 2 && i16 >= 14)) kick(t, 0.78);
      if (i16 === 4 || i16 === 12 || (st.last && i16 >= 10 && i16 % 2 === 0) || (st.last && i16 >= 13)) snare(t, 0.72);
      if (i16 % 2 === 0) hat(t, i16 === 14, 0.8);
    } else {
      if (i16 === 0 || i16 === 8) chug(st.root, t, spb * 0.9, true, true);
      if (st.last && i16 >= 8) { snare(t, 0.72); if (i16 % 2 === 0) kick(t, 0.78); }
    }
  }
  function applyTone(now, quick) {
    if (!AC) return;
    var open = style === 'space' || style === 'cave' || style === 'title' || (STYLES[style] && !STYLES[style].dreadful), d = open ? 0 : dread, cut = 18000 - 14500 * Math.pow(d, 1.5), tc = quick ? 0.03 : 0.5;
    if (bossOn && !open) cut = Math.max(cut, 7500);           // a boss needs air: choir formants and cymbals live up there
    tone.frequency.setTargetAtTime(cut, now, tc);
    if (fbGain) fbGain.gain.setTargetAtTime(0.32 + 0.4 * d, now, tc);
    if (wetGain) wetGain.gain.setTargetAtTime(0.22 + 0.3 * d, now, tc);
  }

  var owShade = -1;   // the mode the current four-bar phrase is read in, chosen on its first bar line (-1: choose now)
  function owNote(n, mode, major) { return pitch(n.d, major ? n.alt : 0, mode); }
  function scheduleOverworld() {
    var two = style === 'quest2', song = composeOverworld(two), d = two ? Math.min(1, 0.15 + dread) : dread;   // the Master Quest starts uneasy: its modes and shading run 0.15 ahead
    // tempo, from the raw dread: the town sags queasily from 108 to 96 by dread 0.4, then an accelerating pulse to 160 by the end;
    // the Master Quest has no sag (it holds its 132, the tempo info() reports) and then drives on to 176
    var base = two ? OW2_BPM : OW_BPM, low = two ? OW2_BPM : OW_LOW, top = two ? OW2_TOP : OW_TOP;
    var bpm = dread < 0.4 ? base - (base - low) * dread / 0.4 : low + (dread - 0.4) / 0.6 * (top - low) + boost * 6;
    var spb = 60 / bpm / 4, now = AC.currentTime, grim = Math.max(0, (d - 0.5) * 2);   // grim: 0..1 over the back half
    while (nextT < now - 0.05) { nextT += bossOn ? 60 / BOSS_BPM / 4 : spb; step++; if (bossOn) bossStep++; }   // the tab stalled: drop what is already late
    while (nextT < now + 0.3) {
      var st = song.steps[step % song.steps.length], t = nextT, i16 = step % 16;
      // --- the boss layer joins and leaves on a bar line; while it is on, it owns the tempo and the harmony
      if (!two && i16 === 0 && bossWant !== bossOn) { bossOn = bossWant; bossStep = 0; applyTone(t, false); }
      if (bossOn) { var bs = 60 / BOSS_BPM / 4; scheduleBossStep(t, bs); nextT += bs; step++; bossStep++; continue; }
      if (!two && bossWant) timp(43, t, 0.3 + 0.7 * i16 / 15, true);      // it is coming: a roll up to the bar line
      // --- the mode: chosen per four-bar phrase on its first bar line. No note is ever soured on its own.
      if (owShade < 0 || step % 64 === 0) owShade = shadeOf(d);
      var sh = owShade, mode = (two ? SHADES2 : SHADES)[sh], major = !two && sh === 0, v0 = st.svel * (1 - grim * 0.35);
      // --- the tune: whole while the world is bright; only its calls once things are grim; then fragments
      if (st.mel && (sh < 3 || (sh === 3 ? st.bar % 4 < 2 : st.bar % 4 === 0))) {
        var n = owNote(st.mel, mode, major), dur = st.mel.len * spb * 0.95, v = st.mel.vel * v0;
        if (two) gritLead(n, t, dur, v); else if (sh >= 2 || st.lead === 'ocarina') ocarina(n, t, dur, v); else flute(n, t, dur, v);
        if (st.dbl && sh <= 1) (two ? gritLead : ocarina)(n - 12, t, dur, v * 0.6);
      }
      if (st.acc && sh <= 1) (two ? harpsi : marimba)(owNote(st.acc, mode, major), t, spb * 2, 0.6);
      if (st.ans && sh === 0) bell(owNote(st.ans, mode, major), t, st.ans.len * spb * 1.5, 0.6);
      if (st.harm && sh <= 1) (st.harmv === 'bell' ? bell : ocarina)(owNote(st.harm, mode, major), t, st.harm.len * spb * 0.9, 0.3);
      if (st.arp && sh <= 1) (two ? harpsi : st.arpv === 'bell' ? bell : marimba)(owNote(st.arp, mode, major), t, spb * 1.8, (st.arpv === 'bell' ? 0.32 : 0.5) * (1 - d));
      if (st.bass && (sh < 3 || st.bass.p % 8 === 0)) {     // the walking stops once it is grim: roots and fifths on the beat
        var bn = owNote(st.bass, mode, major), bd = st.bass.len * spb;
        if (st.bv === 'chug') {   // Master Quest: a power chord where the mode has a perfect fifth over the note, root and octave where it does not
          var up = owNote({ d: st.bass.d + 4, alt: 0 }, mode, false) - bn;
          chug(bn, t, bd * 0.9, st.bass.len <= 2, true, up === 7 ? null : OCT);
        } else bass(bn, t, bd, 0.75 + 0.3 * d, 0.35);
      }
      if (st.pad) pad(st.pad.tones.map(function (tn) { return owNote(tn, mode, major); }), t, st.pad.len * spb, st.pad.vel * 1.6 * (1 + d));
      // --- the things underneath
      if (i16 === 0 && d > 0.45) drone(43, t, spb * 16, (d - 0.45) * 1.8);
      if (i16 === 8 && d > 0.65) drone(49, t, spb * 8, (d - 0.6) * 1.5);   // the tritone arrives
      // industrial pulse: palm-muted root stabs on the off-8ths, then every 8th, then a gallop. st.r is seeded, so the same every loop.
      if (grim > 0) {
        var root = 43, gallop = grim > 0.7 && i16 % 4 === 3;
        if (!two && i16 % 2 === 0 && st.r < grim) chug(root, t, spb * 0.9, true);
        if (gallop) chug(root, t, spb * 0.9, true);
        if (i16 === 12 && grim > 0.5 && st.r < 0.5) chug(root + 6, t, spb * 2, false);          // tritone hit
        if (i16 === 6 && grim > 0.8 && st.r < 0.4) lead(root + 30 + (st.r < 0.2 ? 0 : 1), t, spb * 3);   // a dissonant shriek
      }
      // --- drums: brushes to boots
      if (st.sk) { if (grim > 0.3) kick(t); else if (d > 0.5 && i16 === 0) heartbeat(t); else softKick(t); }
      if (st.kk) kick(t, st.kk);
      if (grim > 0.5 && !st.sk && !st.kk && (i16 === 0 || i16 === 8 || (i16 === 10 && grim > 0.8))) kick(t);
      if (st.br) { if (grim > 0.4) snare(t, 0.8); else if (d < 0.6) brush(t, st.br); }
      if (st.sn) snare(t, grim > 0.4 ? 1 : st.sn);
      if (st.shk && d < 0.5) shaker(t, st.shk >= 1);
      if (st.ht && (two || sh <= 1)) hat(t, !!st.ht.o, st.ht.v);
      else if (grim > 0.6 && i16 % 2 === 0) hat(t, i16 === 14);
      if (st.tm) tom(t, st.tm, 0.6);
      nextT += spb; step++;
    }
  }

  /* --- the space kit: an arcade board at full tilt. Pulse waves, echo, no mercy ---- */
  var SPACE_BPM = 172, pulseWaves = {}, spaceIn = null;
  function pulse(duty) {   // a real narrow pulse (25 % and 12.5 % duty), which the stock 'square' cannot do
    if (pulseWaves[duty]) return pulseWaves[duty];
    var n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (var k = 1; k < n; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty);
    return pulseWaves[duty] = AC.createPeriodicWave(re, im);
  }
  function spaceBus() {    // dry plus a dotted-eighth echo locked to the tempo
    if (spaceIn) return spaceIn;
    spaceIn = AC.createGain(); spaceIn.gain.value = 1;
    var d = AC.createDelay(1.0), fb = AC.createGain(), wet = AC.createGain(), lp = AC.createBiquadFilter();
    d.delayTime.value = 60 / SPACE_BPM / 4 * 3; fb.gain.value = 0.34; wet.gain.value = 0.28; lp.type = 'lowpass'; lp.frequency.value = 3600;
    spaceIn.connect(owMix); spaceIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(owMix);
    return spaceIn;
  }
  function pluck(g, t, peak, dur, sus, rel) {   // an envelope that stays in order however short the note is
    dur = Math.max(0.02, dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  }
  function sLead(note, t, dur, vel, thin) {   // the singer: two pulses, vibrato that arrives late on the long notes
    var g = AC.createGain(), lp = AC.createBiquadFilter(), lg = null;
    lp.type = 'lowpass'; lp.frequency.value = thin ? 3200 : 5200; lp.Q.value = 0.5;
    if (!thin && dur > 0.3) { var v = AC.createOscillator(); lg = AC.createGain(); v.frequency.value = 6.2; lg.gain.setValueAtTime(0, t + 0.12); lg.gain.linearRampToValueAtTime(24, t + 0.32); v.connect(lg); v.start(t); v.stop(t + dur + 0.1); }
    (thin ? [[0.5, 0]] : [[0.25, -5], [0.5, 6]]).forEach(function (p) {
      var o = AC.createOscillator(); o.setPeriodicWave(pulse(p[0])); o.frequency.value = f(note); o.detune.value = p[1]; if (lg) lg.connect(o.detune);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    });
    pluck(g, t, vel * (thin ? 0.1 : 0.085), dur, 0.65, 0.07); lp.connect(g); g.connect(spaceBus());
  }
  function sArp(note, t, dur, vel) {
    var o = AC.createOscillator(), g = AC.createGain(); o.setPeriodicWave(pulse(0.125)); o.frequency.value = f(note);
    pluck(g, t, vel * 0.075, dur, 0.25, 0.04); o.connect(g); g.connect(spaceBus()); o.start(t); o.stop(t + dur + 0.06);
  }
  function sBass(note, t, dur, vel) {   // saw with a filter snap, plus a sine underneath for the floor
    var o = AC.createOscillator(), o2 = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain();
    o.type = 'sawtooth'; o.frequency.value = f(note); o2.type = 'sine'; o2.frequency.value = f(note);
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(260, t + Math.min(0.12, dur));
    pluck(g, t, vel * 0.34, dur, 0.6, 0.04); o.connect(lp); lp.connect(g); o2.connect(g); g.connect(owMix); o.start(t); o2.start(t); o.stop(t + dur + 0.06); o2.stop(t + dur + 0.06);
  }
  function sPad(notes, t, dur, vel) {
    var lp = AC.createBiquadFilter(), g = AC.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.05, t + 0.12); g.gain.setValueAtTime(vel * 0.05, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    lp.connect(g); g.connect(spaceBus());
    notes.forEach(function (n, k) { var o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f(n); o.detune.value = k * 7 - 7; o.connect(lp); o.start(t); o.stop(t + dur + 0.35); });
  }
  function tom(t, fr, v) {
    var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(fr * 1.6, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.09);
    g.gain.setValueAtTime(0.75 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24); o.connect(g); g.connect(metalMix); o.start(t); o.stop(t + 0.26);
  }
  function crash(t, v) {
    var s = loopNoise(), hp = AC.createBiquadFilter(), g = AC.createGain(); hp.type = 'highpass'; hp.frequency.value = 4500;
    g.gain.setValueAtTime(0.3 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5); s.connect(hp); hp.connect(g); g.connect(metalMix); s.start(t, loopAt()); s.stop(t + 1.55);
  }
  function riser(t, dur, v) {   // the build: band-passed noise climbing four octaves
    var s = loopNoise(), bp = AC.createBiquadFilter(), g = AC.createGain(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    s.connect(bp); bp.connect(g); g.connect(metalMix); s.start(t, loopAt()); s.stop(t + dur + 0.1);
  }

  /* --- the space piece: E minor with lifts to G, composed once from a seed, 112 bars, loops into bar 1 ---- */
  var SPACE = null, SPACE_SEED = 562;
  function composeSpace() {
    if (SPACE) return SPACE;
    var rnd = mulberry32(SPACE_SEED), E = 64, NAT = [0, 2, 3, 5, 7, 8, 10];
    // chords as pitch classes above E. alt: the scale note a chord bends (B major sharpens D, F major flattens F sharp)
    var CH = { Em: { r: 0, q: 3 }, C: { r: 8, q: 4 }, D: { r: 10, q: 4 }, G: { r: 3, q: 4 }, Am: { r: 5, q: 3 }, Bm: { r: 7, q: 3 }, B: { r: 7, q: 4, alt: [10, 11] }, F: { r: 1, q: 4, alt: [2, 1] } };
    var SEC = {
      I:  { prog: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'], feel: 'intro', bass: 'pedal', arp: 0, arpV: 1, pad: 0.8 },
      A:  { prog: ['Em', 'C', 'D', 'Em', 'C', 'D', 'Em', 'B'], feel: 'drive', bass: 'pump', arp: 1, arpV: 0.5, lead: 1, start: 71, lo: 64, hi: 81 },
      B:  { prog: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'], feel: 'drive', bass: 'pump', arp: 0, arpV: 0.55, pad: 0.7, lead: 1, start: 74, lo: 67, hi: 84 },
      C:  { prog: ['Am', 'D', 'G', 'C', 'Am', 'B', 'Em', 'B'], feel: 'drive', bass: 'pump', arp: 3, arpV: 0.5, lead: 1, start: 72, lo: 64, hi: 81 },
      K:  { prog: ['C', 'D', 'Em', 'Em', 'C', 'D', 'Bm', 'Bm'], feel: 'half', bass: 'long', arp: 2, arpV: 0.75, pad: 1, lead: 1, slow: true, start: 67, lo: 62, hi: 76 },
      K2: { prog: ['C', 'C', 'D', 'D', 'Em', 'Em', 'B', 'B'], feel: 'build', bass: 'pedal', arp: 0, arpV: 0.8, pad: 0.9 },
      X:  { prog: ['Em', 'F', 'Em', 'F', 'Em', 'F', 'G', 'B'], feel: 'gallop', bass: 'gallop', arp: 2, arpV: 0.4, lead: 1, start: 64, lo: 59, hi: 74 },
      Z:  { prog: ['C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'], feel: 'drive', bass: 'pump', arp: 1, arpV: 0.5, pad: 0.7, lead: 1, start: 76, lo: 67, hi: 84, finale: true }
    };
    var FORM = [['I'], ['A'], ['A', { harm: 1 }], ['B'], ['A'], ['C'], ['K'], ['K2'], ['X'], ['X', { up: 12, harm: 1 }], ['B', { harm: 1 }], ['A'], ['A', { harm: 1 }], ['Z']];
    var RHY = [[0, 6, 8, 12], [0, 4, 6, 8, 12, 14], [0, 3, 6, 8, 11, 14], [0, 8, 12, 14], [0, 2, 4, 8, 10, 12], [0, 6, 12], [0, 4, 8, 10, 12, 14]];
    var SLOW = [[0], [0, 8], [0, 12], [0, 8, 12]];
    var ARP = [[0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 3, 2, 1, 3, 4, 3, 2, 4, 5, 4, 3, 2, 1, 0], [3, 2, 1, 0, 3, 2, 1, 0, 4, 3, 2, 1, 4, 3, 2, 1], [0, 3, 1, 4, 2, 5, 1, 4, 0, 3, 1, 4, 2, 5, 1, 4]];
    var FILLS = ['s.ss1123', 'ssss1233', 's.s1s2s3', '11s22s33'], TOM = { 1: 196, 2: 147, 3: 98 };
    function tones(c) { return [c.r % 12, (c.r + c.q) % 12, (c.r + 7) % 12]; }
    function scale(c) { return NAT.map(function (p) { return c.alt && p === c.alt[0] ? c.alt[1] : p; }); }
    function ladder(set, lo, hi) { var out = []; for (var n = lo; n <= hi; n++) if (set.indexOf(((n - E) % 12 + 12) % 12) >= 0) out.push(n); return out; }
    function move(cur, lad, delta) {   // walk `delta` rungs from the rung nearest `cur`
      var k = 0, best = 99; for (var i = 0; i < lad.length; i++) { var d = Math.abs(lad[i] - cur); if (d < best) { best = d; k = i; } }
      if (delta > 0 && lad[k] > cur) delta--; if (delta < 0 && lad[k] < cur) delta++;
      return lad[Math.max(0, Math.min(lad.length - 1, k + delta))];
    }
    function delta(big) { var r = rnd(); return big ? (r < 0.14 ? -2 : r < 0.42 ? -1 : r < 0.5 ? 0 : r < 0.84 ? 1 : 2) : (r < 0.42 ? -1 : r < 0.54 ? 0 : 1); }
    function bar(lib) { var on = lib[Math.floor(rnd() * lib.length)]; return { on: on, d: on.map(function (p, k) { var len = (k + 1 < on.length ? on[k + 1] : 16) - p; return delta(p % 4 === 0 || len >= 4); }) }; }
    // A theme is four two-bar units: a b / a c / a b one rung higher / cadence onto a long note. Same rhythm, same contour,
    // re-read through whatever chord is underneath: that repetition is what makes it hummable.
    var themes = {};
    function theme(name) {
      if (themes[name]) return themes[name];
      var sec = SEC[name], lib = sec.slow ? SLOW : RHY, a = bar(lib), b = bar(lib), c = bar(lib), d = bar(lib), out = [], cur = sec.start;
      var plan = [[a, b], [a, c], [a, b], [d, { on: [0], d: [0], fin: true }]];
      plan.forEach(function (unit, u) {
        if (u === 2) cur = move(sec.start, ladder(tones(CH[sec.prog[4]]), sec.lo, sec.hi), 1);
        unit.forEach(function (br, half) {
          var bi = u * 2 + half, ch = CH[sec.prog[bi]], ct = ladder(tones(ch), sec.lo, sec.hi), sc = ladder(scale(ch), sec.lo, sec.hi), row = [];
          for (var i = 0; i < 16; i++) row.push(null);
          br.on.forEach(function (p, k) {
            var len = (k + 1 < br.on.length ? br.on[k + 1] : 16) - p, strong = p % 4 === 0 || len >= 4, dl = (u === 0 || u === 2) && half === 0 && k === 0 ? 0 : br.d[k];
            if (cur >= sec.hi - 2) dl = -Math.max(1, Math.abs(dl)); if (cur <= sec.lo + 2) dl = Math.max(1, Math.abs(dl));
            cur = move(cur, strong ? ct : sc, dl);
            if (br.fin) len = 12;
            row[p] = { n: cur, len: len, vel: p % 8 === 0 ? 1 : strong ? 0.88 : 0.72 };
          });
          out = out.concat(row);
        });
      });
      return themes[name] = out;
    }
    function under(n, ch) { var lad = ladder(tones(ch), n - 10, n - 3); return lad.length ? lad[lad.length - 1] : n - 12; }   // harmony voice: the chord tone a third to a sixth below
    var steps = [];
    FORM.forEach(function (fm, si) {
      var sec = SEC[fm[0]], opt = fm[1] || {}, mel = sec.lead ? theme(fm[0]) : null, fill = FILLS[Math.floor(rnd() * FILLS.length)];
      for (var b = 0; b < 8; b++) {
        var ch = CH[sec.prog[b]], tn = tones(ch), lowRoot = ch.r <= 5 ? 40 + ch.r : 28 + ch.r, arpRoot = ch.r <= 5 ? 64 + ch.r : 52 + ch.r;
        var six = [0, ch.q, 7, 12, 12 + ch.q, 19].map(function (iv) { return arpRoot + iv; }), last = b === 7, odd = b % 2 === 1;
        var walk = sec.finale && last ? [47, 48, 49, 51] : null;   // B, C, C sharp, D sharp → E: the turnaround into bar 1
        for (var i = 0; i < 16; i++) {
          var st = {}, fl = sec.feel, m = mel ? mel[b * 16 + i] : null;
          if (m) { st.lead = { n: m.n + (opt.up || 0), len: m.len, vel: m.vel * (sec.slow ? 0.8 : 1) }; if (opt.harm && m.len >= 2) st.harm = under(st.lead.n, ch); }
          // arpeggio: sixteenths through two octaves of the chord; it thins to eighths under a busy lead in the gallop
          if (fl !== 'gallop' || i % 2 === 0) { st.arp = six[ARP[sec.arp][i]] - (fl === 'gallop' ? 12 : 0); st.arpV = sec.arpV * (i % 4 === 0 ? 1 : 0.8) * (fl === 'intro' ? Math.min(1, 0.35 + b * 0.12) : 1); }
          // bass
          if (walk && i >= 8) { if (i % 2 === 0) st.bass = { n: walk[(i - 8) / 2], len: 1.8, vel: 1 }; }
          else if (sec.bass === 'pump') { if (i % 2 === 0) st.bass = { n: lowRoot + ((i / 2) % 2 ? 12 : 0) + (i === 14 && odd ? 7 - 12 : 0), len: 1.7, vel: i % 4 === 0 ? 1 : 0.85 }; }
          else if (sec.bass === 'pedal') { if (i % 2 === 0) st.bass = { n: lowRoot + (fl === 'intro' && b < 4 ? 0 : ((i / 2) % 2 ? 12 : 0)), len: 1.5, vel: fl === 'intro' ? Math.min(1, 0.5 + b * 0.1) : 0.6 + b * 0.05 }; }
          else if (sec.bass === 'gallop') { if (i % 4 !== 1) st.bass = { n: lowRoot + (i % 8 === 6 ? 12 : 0), len: 0.9, vel: i % 4 === 0 ? 1 : 0.8 }; }
          else if (i === 0) st.bass = { n: lowRoot, len: 14, vel: 0.9 };
          if (sec.pad && i === 0) st.pad = { notes: [arpRoot - 12, arpRoot - 12 + ch.q, arpRoot - 5], vel: sec.pad };
          // drums
          var fillNow = last && i >= 8 && fl !== 'build' && fl !== 'half';
          if (i === 0 && b === 0) st.crash = si === 0 ? 0.7 : 1;
          if (sec.finale && last) {                                       // a whole bar of fill to end the form
            var big = 's..s..s.ssss1123'.charAt(i); if (big === 's') st.snare = 0.7 + i * 0.02; else if (TOM[big]) st.tom = TOM[big]; if (i % 8 === 0) st.kick = 1;
          } else if (fillNow) {
            var c = fill.charAt(i - 8); if (c === 's') st.snare = 0.75 + (i - 8) * 0.03; else if (TOM[c]) st.tom = TOM[c]; if (i === 8) st.kick = 1;
          } else if (fl === 'drive') { if (i === 0 || i === 6 || i === 8 || (i === 10 && odd)) st.kick = 1; if (i === 4 || i === 12) st.snare = 1; }
          else if (fl === 'gallop') { if (i === 0 || i === 3 || i === 6 || i === 8 || i === 11 || i === 14) st.kick = 1; if (i === 4 || i === 12) st.snare = 1; }
          else if (fl === 'half') { if (i === 0 || i === 10) st.kick = 0.9; if (i === 8) st.snare = 0.8; if (last && i >= 12) st.tom = TOM[i < 14 ? 2 : 3]; }
          else if (fl === 'intro') { if (i % 4 === 0) st.kick = 0.9; if (b >= 4 && (i === 4 || i === 12)) st.snare = 0.9; }
          else if (fl === 'build') { if (i % 4 === 0) st.kick = 1; if (b < 4 ? (i === 4 || i === 12) : b < 6 ? i % 2 === 0 : true) st.snare = b < 4 ? 0.9 : 0.35 + 0.65 * ((b - 4) * 16 + i) / 63; if (b === 4 && i === 0) st.riser = 64; }
          if (!fillNow && !(sec.finale && last)) {
            if (fl === 'half' || fl === 'build' || (fl === 'intro' && b < 4)) { if (i % 2 === 0) st.hat = { v: 0.6, open: false }; }
            else if (i === 14 && odd) st.hat = { v: 1, open: true };
            else st.hat = { v: i % 4 === 0 ? 1 : i % 2 === 0 ? 0.7 : 0.4, open: false };
          }
          steps.push(st);
        }
      }
    });
    return SPACE = { bpm: SPACE_BPM, steps: steps, themes: themes };
  }
  function scheduleSpace() {
    var song = composeSpace(), spb = 60 / song.bpm / 4, now = AC.currentTime, n = song.steps.length;
    while (nextT < now - 0.05) { nextT += spb; step++; }        // the tab stalled: drop what is already late rather than fire it as one chord
    while (nextT < now + 0.3) {
      var st = song.steps[step % n], t = nextT;
      if (st.crash) crash(t, st.crash);
      if (st.riser) riser(t, st.riser * spb, 1);
      if (st.pad) sPad(st.pad.notes, t, spb * 16, st.pad.vel);
      if (st.lead) { sLead(st.lead.n, t, st.lead.len * spb * 0.92, st.lead.vel, false); if (st.harm) sLead(st.harm, t, st.lead.len * spb * 0.92, st.lead.vel * 0.6, true); }
      if (st.arp) sArp(st.arp, t, spb * 1.1, st.arpV);
      if (st.bass) sBass(st.bass.n, t, st.bass.len * spb, st.bass.vel);
      if (st.kick) kick(t, st.kick);
      if (st.snare) snare(t, st.snare);
      if (st.tom) tom(t, st.tom, 0.9);
      if (st.hat) hat(t, st.hat.open, st.hat.v);
      nextT += spb; step++;
    }
  }


  /* --- the cave kit: Beethoven on a Mega Drive ----------------------------
     Piano Sonata No. 14 in C sharp minor, Op. 27 No. 2, first movement (Adagio sostenuto,
     1801: public domain, and synthesised here from scratch, so there is nothing to license).
     The voices are a Genesis arrangement, not a piano: an FM bell for the triplet stream, a
     warm sine/triangle octave for the left hand, a detuned lead with late vibrato for the tune. */
  var CAVE_BPM = 60, caveIn = null;        // BPM is crotchets; the movement is alla breve at about this pulse
  function caveBus() {
    if (caveIn) return caveIn;
    caveIn = AC.createGain(); caveIn.gain.value = 1; caveIn.connect(owMix);
    var send = AC.createGain(); send.gain.value = 0.30; caveIn.connect(send); send.connect(hall());   // flooded stone
    return caveIn;
  }
  // 2:1 FM with a fast index decay: bell on the attack, near-sine by the tail. `acc` is the crotchet.
  function fmBell(note, t, dur, vel, acc) {
    var fr = f(note), car = AC.createOscillator(), mod = AC.createOscillator(), mg = AC.createGain(), g = AC.createGain();
    car.type = 'sine'; car.frequency.value = fr;
    mod.type = 'sine'; mod.frequency.value = fr * 2;
    mg.gain.setValueAtTime(fr * (acc ? 3.4 : 2.5), t);          // depth in Hz = index x modulator frequency
    mg.gain.exponentialRampToValueAtTime(fr * 0.16, t + 0.17);
    mod.connect(mg); mg.connect(car.frequency);
    var end = env(g, t, 0.004, vel * CAVE_BELL, 0.22, 0.2, dur, 0.3);
    car.connect(g); g.connect(caveBus());
    mod.start(t); mod.stop(end + 0.03); car.start(t); car.stop(end + 0.03);
  }
  function caveBass(note, t, dur, vel) {   // the left-hand octave: sine below, triangle above, dry
    var lp = AC.createBiquadFilter(), g = AC.createGain(), g2 = AC.createGain(),
        o1 = AC.createOscillator(), o2 = AC.createOscillator();
    lp.type = 'lowpass'; lp.frequency.value = 430; lp.Q.value = 0.5;
    o1.type = 'sine'; o1.frequency.value = f(note);
    o2.type = 'triangle'; o2.frequency.value = f(note + 12); o2.detune.value = 5;
    g2.gain.value = 0.5; o2.connect(g2); g2.connect(lp); o1.connect(lp);
    var end = env(g, t, 0.05, vel * CAVE_BASS, 0.45, 0.66, dur, 0.45);
    lp.connect(g); g.connect(owMix);
    o1.start(t); o2.start(t); o1.stop(end + 0.04); o2.stop(end + 0.04);
  }
  function caveLead(note, t, dur, vel) {   // two triangles seven cents apart; the vibrato arrives late
    var g = AC.createGain(), lp = AC.createBiquadFilter(), lg = null;
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.4;
    if (dur > 0.5) {
      var v = AC.createOscillator(); lg = AC.createGain(); v.frequency.value = 4.9;
      lg.gain.setValueAtTime(0, t + 0.2); lg.gain.linearRampToValueAtTime(8, t + 0.85);
      v.connect(lg); v.start(t); v.stop(t + dur + 0.3);
    }
    [-7, 7].forEach(function (det) {
      var o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f(note); o.detune.value = det;
      if (lg) lg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + 0.4);
    });
    env(g, t, 0.035, vel * CAVE_LEAD, 0.25, 0.8, dur, 0.22);
    lp.connect(g); g.connect(caveBus());
  }

  /* --- the cave piece: 32 bars of the Adagio sostenuto, ending on its own dominant -------
     Score bars 1-9 (the introduction and the first phrase, cadencing in E major), 10-15 (the
     E minor turn down to B), 16-22 (the B pedal and the chromatic slide into F sharp), 23-27
     (F sharp minor, C sharp seven, the crescendo) and 28-31 of the long G sharp pedal, then
     bar 28 again as the turnaround: G sharp seven flat nine resolving into bar 1's tonic.
     Grid: 48 steps to the bar, a twelfth of a crotchet, which is both a triplet quaver (4
     steps) and a semiquaver (3), so the triplet stream and the dotted melody share one table.
     Pitches are transcribed from the score, not invented: see the harmony in TRIP below. */
  var CAVE = null, CAVE_BELL = 0.34, CAVE_BASS = 0.30, CAVE_LEAD = 0.38;
  function composeCave() {
    if (CAVE) return CAVE;
    var FORM = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,28];
    var TRIP = [
      [56,61,64,56,61,64,56,61,64,56,61,64],
      [56,61,64,56,61,64,56,61,64,56,61,64],
      [57,61,64,57,61,64,57,62,66,57,62,66],
      [56,60,66,56,61,64,56,61,63,54,60,63],
      [52,56,61,56,61,64,56,61,64,56,61,64],
      [56,63,66,56,63,66,56,63,66,56,63,66],
      [56,61,64,56,61,64,57,61,66,57,61,66],
      [56,59,64,56,59,64,57,59,63,57,59,63],
      [56,59,64,56,59,64,56,59,64,56,59,64],
      [55,59,64,55,59,64,55,59,64,55,59,64],
      [55,59,65,55,59,65,55,59,65,55,59,65],
      [55,60,64,55,59,64,55,61,64,54,61,64],
      [54,59,62,54,59,62,55,59,61,52,59,61],
      [54,59,62,54,59,62,54,58,61,54,58,61],
      [59,62,66,59,62,66,59,63,66,59,63,66],
      [59,64,67,59,64,67,59,64,67,59,64,67],
      [59,63,66,59,63,66,59,63,66,59,63,66],
      [59,64,67,59,64,67,59,64,67,59,64,67],
      [59,63,66,59,63,66,59,62,65,59,62,65],
      [59,61,68,59,61,68,57,61,66,57,61,66],
      [55,59,62,55,59,62,54,57,63,54,57,63],
      [49,54,57,49,54,57,49,54,56,49,53,56],
      [54,57,61,57,61,66,61,66,69,61,66,69],
      [61,68,71,61,68,71,61,68,71,61,68,71],
      [61,66,69,61,66,69,60,66,69,61,66,69],
      [63,66,68,63,66,68,63,66,68,63,66,68],
      [64,68,73,64,68,73,63,66,69,61,64,70],
      [72,60,63,68,60,63,69,60,63,66,60,63],
      [0,60,63,56,60,63,57,60,63,54,60,63],
      [52,64,68,73,64,68,76,64,68,73,64,68],
      [0,52,56,61,52,56,64,52,56,61,52,56],
      [72,60,63,68,60,63,69,60,63,66,60,63]];
    var BASS = [
      [0,37,48],
      [0,35,48],
      [0,33,24,24,30,24],
      [0,32,24,24,32,24],
      [0,37,48],
      [0,36,48],
      [0,37,24,24,30,24],
      [0,35,24,24,35,24],
      [0,40,48],
      [0,40,48],
      [0,38,48],
      [0,36,12,12,35,12,24,34,24],
      [0,35,24,24,40,12,36,43,12],
      [0,42,24,24,30,24],
      [0,35,48],
      [0,35,12,12,40,12,24,43,12,36,40,12],
      [0,35,48],
      [0,35,12,12,40,12,24,43,12,36,40,12],
      [0,35,24,24,32,24],
      [0,29,24,24,30,24],
      [0,35,24,24,36,24],
      [0,37,24,24,37,24],
      [0,30,48],
      [0,41,48],
      [0,42,24,24,39,12,36,37,12],
      [0,36,36,36,36,12],
      [0,37,24,24,30,12,36,31,12],
      [0,32,48],
      [0,32,48],
      [0,32,48],
      [0,32,48],
      [0,32,48]];
    var MEL = [
      [],
      [],
      [],
      [],
      [36,68,9,45,68,3],
      [0,68,36,36,68,9,45,68,3],
      [0,68,24,24,69,24],
      [0,68,24,24,66,12,36,71,12],
      [0,64,12],
      [36,67,9,45,67,3],
      [0,67,36,36,67,9,45,67,3],
      [0,67,36,36,66,12],
      [0,66,24,24,67,12,36,64,12],
      [0,66,24,24,66,24],
      [0,59,12,36,71,12],
      [0,72,36,36,70,12],
      [0,71,36,36,71,12],
      [0,72,36,36,70,12],
      [0,71,24,24,71,24],
      [0,71,24,24,69,24],
      [0,67,24,24,66,24],
      [0,61,24,24,61,12,36,61,12],
      [0,54,12,36,73,9,45,73,3],
      [0,73,36,36,73,9,45,73,3],
      [0,73,24,24,72,12,36,73,12],
      [0,75,36,36,75,12],
      [0,76,24,24,75,12,36,73,12],
      [12,68,12,24,69,12,36,66,12],
      [12,56,12,24,57,12,36,54,12],
      [12,73,12,24,76,12,36,73,12],
      [12,61,12,24,64,12,36,61,12],
      [12,68,12,24,69,12,36,66,12]];
    var DYN = [0.62,0.64,0.66,0.66,0.7,0.7,0.72,0.72,0.7,0.7,0.7,0.72,0.72,0.72,0.7,0.72,0.72,0.74,0.76,0.78,0.78,0.76,0.78,0.8,0.84,0.9,0.95,0.78,0.72,0.72,0.68,0.62];
    var steps = [], SPB = 48;
    for (var b = 0; b < FORM.length; b++) {
      var vel = DYN[b], row = new Array(SPB), i, s;
      for (i = 0; i < SPB; i++) row[i] = null;
      for (i = 0; i < 12; i++) {                                  // the unbroken triplet stream
        if (!TRIP[b][i]) continue;                                // bars 29 and 31 rest on the first one
        s = row[i * 4] || (row[i * 4] = {});
        s.t3 = { n: TRIP[b][i], v: vel * (i % 3 === 0 ? 1 : 0.82), a: i % 3 === 0 };
      }
      for (i = 0; i < BASS[b].length; i += 3) {                   // [step, lowest note, length in steps]
        s = row[BASS[b][i]] || (row[BASS[b][i]] = {});
        s.bass = { n: BASS[b][i + 1], len: BASS[b][i + 2], v: vel };
      }
      for (i = 0; i < MEL[b].length; i += 3) {
        s = row[MEL[b][i]] || (row[MEL[b][i]] = {});
        s.mel = { n: MEL[b][i + 1], len: MEL[b][i + 2], v: vel * (b >= 27 ? 0.6 : 1) };   // the pedal bars only lean on the arpeggio top
      }
      for (i = 0; i < SPB; i++) steps.push(row[i]);
    }
    return CAVE = { bpm: CAVE_BPM, steps: steps, bars: FORM.length };
  }
  function scheduleCave() {
    var song = composeCave(), spb = 60 / song.bpm / 12, now = AC.currentTime, n = song.steps.length;
    while (nextT < now - 0.05) { nextT += spb; step++; }          // the tab stalled: drop what is already late
    while (nextT < now + 0.3) {
      var st = song.steps[step % n], t = nextT;                   // step % n is the whole loop: no reset, no seam
      if (st) {
        if (st.t3) fmBell(st.t3.n, t, spb * 3.9, st.t3.v, st.t3.a);
        if (st.bass) caveBass(st.bass.n, t, st.bass.len * spb * 0.96, st.bass.v);
        if (st.mel) caveLead(st.mel.n, t, st.mel.len * spb * 0.94, st.mel.v);
      }
      nextT += spb; step++;
    }
  }

  /* --- the title kit: a Mega Drive dance floor ----------------------------
     Yuzo Koshiro's Streets of Rage sound, as far as WebAudio will carry it.
     The bass is FM: a sine carrier whose frequency is modulated by a second
     sine an octave up, with BOTH a pitch envelope on the carrier and a
     modulation-index envelope on the modulator — that pair is what makes a
     YM2612 bark rather than hum (the cave's fmBell does the same trick, more
     gently). The hook is a 303: one sawtooth into a high-Q lowpass with a
     per-note cutoff envelope, accents that open it further, and slides. Round
     them: detuned saw stabs and hoovers through a dotted-eighth dub delay, and
     a house kit with sixteenth swing on the hats. */
  var TITLE_BPM = 128, titleIn = null, titleEch = null, TITLE_GAIN = 2.45, TITLE_SWING = 0.15;
  function titleBus() {
    if (titleIn) return titleIn;
    titleIn = AC.createGain(); titleIn.gain.value = TITLE_GAIN; titleIn.connect(master);
    return titleIn;
  }
  function titleEcho() {   // a dotted eighth at 128 BPM, feeding itself: the dub on the stabs
    if (titleEch) return titleEch;
    var out = titleBus();
    titleEch = AC.createGain(); titleEch.gain.value = 1;
    var d = AC.createDelay(1.0), fb = AC.createGain(), lp = AC.createBiquadFilter(), w = AC.createGain();
    d.delayTime.value = 60 / TITLE_BPM / 4 * 3; fb.gain.value = 0.36;
    lp.type = 'lowpass'; lp.frequency.value = 3000; w.gain.value = 0.34;
    titleEch.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(w); w.connect(out);
    return titleEch;
  }
  function tBass(note, t, dur, vel, bark) {
    var fr = f(note), car = AC.createOscillator(), mod = AC.createOscillator(),
        mg = AC.createGain(), g = AC.createGain(), lp = AC.createBiquadFilter();
    car.type = 'sine';
    car.frequency.setValueAtTime(fr * 2.1, t);                       // the pitch envelope: the attack snaps down onto the note
    car.frequency.exponentialRampToValueAtTime(fr, t + 0.026);
    mod.type = 'sine'; mod.frequency.value = fr * 2;                 // 2:1, the Mega Drive staple
    mg.gain.setValueAtTime(fr * (bark ? 6.5 : 4), t);                // index x modulator frequency, in Hz
    mg.gain.exponentialRampToValueAtTime(fr * 1.1, t + 0.05);
    mg.gain.exponentialRampToValueAtTime(fr * 0.1, t + Math.max(0.1, dur * 0.9));
    mod.connect(mg); mg.connect(car.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.7;
    var end = env(g, t, 0.003, vel * 0.38, 0.09, 0.5, dur, 0.045);
    car.connect(lp); lp.connect(g); g.connect(titleBus());
    mod.start(t); car.start(t); mod.stop(end + 0.03); car.stop(end + 0.03);
  }
  function tAcid(note, t, dur, vel, acc, slideFrom, cut) {
    var o = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain(), fr = f(note);
    o.type = 'sawtooth';
    if (slideFrom) { o.frequency.setValueAtTime(f(slideFrom), t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.06); }
    else o.frequency.setValueAtTime(fr, t);
    lp.type = 'lowpass'; lp.Q.value = acc ? 16 : 11;
    var base = 140 + 1250 * cut, top = Math.min(8500, base + (acc ? 3800 : 1900) * (0.4 + cut)), fall = acc ? 0.30 : 0.14;
    lp.frequency.setValueAtTime(base, t);
    lp.frequency.linearRampToValueAtTime(top, t + 0.012);
    lp.frequency.exponentialRampToValueAtTime(base, t + fall);
    dur = Math.max(0.035, dur);
    var pk = vel * (acc ? 0.115 : 0.078);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.004);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * 0.45), t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    o.connect(lp); lp.connect(g); g.connect(titleBus());
    o.start(t); o.stop(t + dur + 0.06);
  }
  function tStab(notes, t, dur, vel) {
    var lp = AC.createBiquadFilter(), g = AC.createGain();
    dur = Math.max(0.06, dur);
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(340, t); lp.frequency.exponentialRampToValueAtTime(4000, t + 0.016); lp.frequency.exponentialRampToValueAtTime(760, t + dur);
    var pk = vel * 0.088;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.006);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * 0.2), t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    lp.connect(g); g.connect(titleBus()); g.connect(titleEcho());
    notes.forEach(function (n, k) {
      [-11, 11].forEach(function (det) {
        var o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f(n); o.detune.value = det + k * 3 - 3;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.14);
      });
    });
  }
  function tHoover(notes, t, dur, vel) {   // the rave chord: saws bending in, detuned to within an inch of their lives
    var lp = AC.createBiquadFilter(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
    lp.type = 'lowpass'; lp.Q.value = 3.5;
    lp.frequency.setValueAtTime(520, t); lp.frequency.exponentialRampToValueAtTime(4800, t + 0.09); lp.frequency.exponentialRampToValueAtTime(820, t + dur);
    var pk = vel * 0.062;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.012);
    g.gain.setValueAtTime(pk, t + Math.max(0.06, dur * 0.55)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    lp.connect(g); g.connect(titleBus()); g.connect(titleEcho());
    lfo.frequency.value = 6.4; lg.gain.value = 9; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.2);
    notes.forEach(function (n) {
      [-18, 0, 18].forEach(function (det, j) {
        var o = AC.createOscillator(); o.type = j === 1 ? 'square' : 'sawtooth'; o.detune.value = det; lg.connect(o.detune);
        o.frequency.setValueAtTime(f(n) * 1.3, t); o.frequency.exponentialRampToValueAtTime(f(n), t + 0.13);
        o.connect(lp); o.start(t); o.stop(t + dur + 0.22);
      });
    });
  }
  function tLead(note, t, dur, vel) {
    var lp = AC.createBiquadFilter(), g = AC.createGain(), lg = null;
    lp.type = 'lowpass'; lp.frequency.value = 4400; lp.Q.value = 0.8;
    if (dur > 0.28) {
      var v = AC.createOscillator(); lg = AC.createGain(); v.frequency.value = 5.8;
      lg.gain.setValueAtTime(0, t + 0.1); lg.gain.linearRampToValueAtTime(11, t + 0.42); v.connect(lg); v.start(t); v.stop(t + dur + 0.12);
    }
    [[-9, 'sawtooth'], [9, 'square']].forEach(function (p) {
      var o = AC.createOscillator(); o.type = p[1]; o.frequency.value = f(note); o.detune.value = p[0];
      if (lg) lg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + 0.14);
    });
    var pk = vel * 0.082;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.008);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * 0.7), t + Math.max(0.05, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.06, dur) + 0.1);
    lp.connect(g); g.connect(titleBus()); g.connect(titleEcho());
  }
  function tPad(notes, t, dur, vel) {
    var lp = AC.createBiquadFilter(), g = AC.createGain();
    lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(620, t); lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.7);
    var pk = vel * 0.036;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.3);
    g.gain.setValueAtTime(pk, t + Math.max(0.4, dur - 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    lp.connect(g); g.connect(titleBus());
    notes.forEach(function (n, k) {
      [-7, 7].forEach(function (det) {
        var o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f(n); o.detune.value = det + k * 4 - 4;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.4);
      });
    });
  }
  function tKick(t, v) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(152, t); o.frequency.exponentialRampToValueAtTime(49, t + 0.045); o.frequency.exponentialRampToValueAtTime(41, t + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.62, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.28);
    o.connect(g); g.connect(titleBus()); o.start(t); o.stop(t + 0.3);
    var c = AC.createBufferSource(), cg = AC.createGain(), hp = AC.createBiquadFilter();
    c.buffer = noise(); hp.type = 'highpass'; hp.frequency.value = 1500;
    cg.gain.setValueAtTime(v * 0.22, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    c.connect(hp); hp.connect(cg); cg.connect(titleBus()); c.start(t); c.stop(t + 0.04);
  }
  function tSnare(t, v) {
    var s = AC.createBufferSource(), hp = AC.createBiquadFilter(), bp = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noise(); hp.type = 'highpass'; hp.frequency.value = 380; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.6;
    g.gain.setValueAtTime(v * 0.42, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(titleBus()); s.start(t); s.stop(t + 0.16);
    var o = AC.createOscillator(), og = AC.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.05);
    og.gain.setValueAtTime(v * 0.26, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(og); og.connect(titleBus()); o.start(t); o.stop(t + 0.09);
  }
  function tClap(t, v) {   // four bursts a few milliseconds apart, the last one with the tail
    var bp = AC.createBiquadFilter(), g = AC.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.1; g.gain.value = v * 0.34;
    bp.connect(g); g.connect(titleBus());
    [0, 0.009, 0.019, 0.03].forEach(function (d, k) {
      var s = AC.createBufferSource(), sg = AC.createGain(); s.buffer = noise();
      sg.gain.setValueAtTime(k === 3 ? 0.8 : 1, t + d); sg.gain.exponentialRampToValueAtTime(0.001, t + d + (k === 3 ? 0.14 : 0.014));
      s.connect(sg); sg.connect(bp); s.start(t + d); s.stop(t + d + 0.17);
    });
  }
  function tHat(t, open, v) {
    var s = AC.createBufferSource(), hp = AC.createBiquadFilter(), pk = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noise(); hp.type = 'highpass'; hp.frequency.value = 8200;
    pk.type = 'peaking'; pk.frequency.value = 11500; pk.gain.value = 6; pk.Q.value = 1.2;
    g.gain.setValueAtTime(v * (open ? 0.17 : 0.13), t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.19 : 0.035));
    s.connect(hp); hp.connect(pk); pk.connect(g); g.connect(titleBus()); s.start(t); s.stop(t + (open ? 0.22 : 0.06));
  }
  function tTom(t, fr, v) {
    var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(fr * 1.7, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.48, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(g); g.connect(titleBus()); o.start(t); o.stop(t + 0.28);
    var s = AC.createBufferSource(), sg = AC.createGain(), lp = AC.createBiquadFilter();
    s.buffer = noise(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    sg.gain.setValueAtTime(v * 0.14, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(lp); lp.connect(sg); sg.connect(titleBus()); s.start(t); s.stop(t + 0.06);
  }
  function tCrash(t, v) {
    var s = loopNoise(), hp = AC.createBiquadFilter(), g = AC.createGain();
    hp.type = 'highpass'; hp.frequency.value = 3800;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.24, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.6);
    s.connect(hp); hp.connect(g); g.connect(titleBus()); s.start(t, loopAt()); s.stop(t + 1.65);
  }
  function tRise(t, dur, v) {
    var s = loopNoise(), bp = AC.createBiquadFilter(), g = AC.createGain();
    bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.09);
    s.connect(bp); bp.connect(g); g.connect(titleBus()); s.start(t, loopAt()); s.stop(t + dur + 0.12);
  }
  function tFall(t, dur, v) {
    var s = loopNoise(), bp = AC.createBiquadFilter(), g = AC.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(7000, t); bp.frequency.exponentialRampToValueAtTime(180, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(bp); bp.connect(g); g.connect(titleBus()); s.start(t, loopAt()); s.stop(t + dur + 0.08);
  }
  function tSub(t, v) {   // the floor dropping out from under a hit
    var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.55);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.38, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.1);
    o.connect(g); g.connect(titleBus()); o.start(t); o.stop(t + 1.15);
  }
  function tRumble(t, dur) {   // a tremor: a sub that climbs and shakes faster as it goes (the title no longer uses it; plug-ins may, through kit())
    var o = AC.createOscillator(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(30, t); o.frequency.linearRampToValueAtTime(44, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + dur * 0.88); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    lfo.type = 'sine'; lfo.frequency.setValueAtTime(7, t); lfo.frequency.linearRampToValueAtTime(19, t + dur); lg.gain.value = 0.14;
    lfo.connect(lg); lg.connect(g.gain);
    o.connect(g); g.connect(titleBus()); o.start(t); o.stop(t + dur + 0.2); lfo.start(t); lfo.stop(t + dur + 0.2);
  }
  function tCoin(t) {   // one credit. Two square blips, the way a cabinet answers a coin
    [[1319, 0, 0.055], [1976, 0.07, 0.13]].forEach(function (p) {
      var o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.value = p[0];
      g.gain.setValueAtTime(0.0001, t + p[1]); g.gain.linearRampToValueAtTime(0.13, t + p[1] + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0002, t + p[1] + p[2]);
      o.connect(g); g.connect(titleBus()); g.connect(titleEcho()); o.start(t + p[1]); o.stop(t + p[1] + p[2] + 0.03);
    });
  }

  /* --- the title piece: A minor, 128 BPM, a two-bar intro then a 40-bar loop --
     The title card is already on screen when the coin goes in, so the intro is
     the coin, a riser and a snare roll into the logo slam: two bars. After them
     the piece is a 40-bar loop (75 s) that ends on the dominant and resolves
     back into bar 2 — never into bar 0's coin.
     The acid line is written as scale degrees and shifted per chord (a triad is
     three scale steps apart, so shifting the whole pattern by `sh` re-reads the
     same riff through the new chord), which is how it can pedal and still move. */
  var TITLE = null, TITLE_INTRO_BARS = 2, TITLE_LOOP_BARS = 40;
  function composeTitle() {
    if (TITLE) return TITLE;
    var TR = 45, AMIN = [0, 2, 3, 5, 7, 8, 10];                      // A2, A natural minor
    function sdeg(i, s7) {
      var o = Math.floor(i / 7), k = ((i % 7) + 7) % 7, n = TR + AMIN[k] + 12 * o;
      return s7 && k === 6 ? n + 1 : n;                              // the dominant raises its leading tone: G sharp
    }
    var CH = {
      Am: { r: 33, tri: [57, 60, 64], sh: 0 },
      F:  { r: 29, tri: [57, 60, 65], sh: -2 },
      G:  { r: 31, tri: [55, 59, 62], sh: -1 },
      C:  { r: 36, tri: [55, 60, 64], sh: 2 },
      Dm: { r: 38, tri: [57, 62, 65], sh: 3 },
      E:  { r: 28, tri: [56, 59, 64], sh: -3, s7: 1 }
    };
    // acid patterns: 16 sixteenths of [scale degree, accent, slide-from-previous]
    var AP = {
      A: [[0,1,0], null, [7,0,0], null, [0,0,0], [2,0,0], [0,1,0], null, [0,0,0], [7,0,0], null, [0,0,0], [4,1,0], [3,0,1], [2,0,0], [0,0,0]],
      B: [[0,1,0], null, [7,0,0], null, [0,0,0], [2,0,0], [0,1,0], null, [0,0,0], [4,0,0], null, [0,0,0], [2,1,0], [1,0,1], [0,0,0], [-3,0,0]],
      C: [[0,0,0], null, null, null, [0,0,0], null, [7,0,0], null, [0,0,0], null, null, null, [4,0,0], null, [2,0,0], null],
      D: [[0,1,0], [0,0,0], [7,0,0], [0,0,0], [4,0,0], null, [7,1,0], null, [2,0,0], [0,0,0], [9,0,0], null, [7,1,0], [4,0,1], [2,0,0], [0,0,0]],
      E: [[0,1,0], null, [0,0,0], [7,1,0], null, null, [4,1,0], null, [0,0,0], [7,0,0], null, [2,1,0], [0,0,0], null, [4,0,1], null]
    };
    // bass patterns: [semitones above the chord root, length in sixteenths, velocity, bark]
    var BP = {
      I: [[0,3.4,0.7,1], null,null,null, null,null,null,null, [0,1.7,0.6,0], null,null,null, [12,1.7,0.6,0], null,null,null],
      L: [[0,7,0.9,1], null,null,null, null,null,null,null, [0,7,0.8,0], null,null,null, null,null,null,null],
      P: [[0,1.7,1,1], null, [0,1.7,0.78,0], null, [12,1.7,0.8,0], null, [0,1.7,0.85,0], null, [0,1.7,0.95,1], null, [0,1.7,0.78,0], null, [12,1.7,0.8,0], null, [0,1.7,0.88,0], null],
      D: [[0,1.25,1,1], null,null, [0,1.25,0.75,0], [12,1.25,0.8,0], null, [0,1.25,0.9,1], null, [0,1.25,0.95,1], null,null, [0,1.25,0.75,0], [12,1.25,0.8,0], null, [7,1.25,0.85,0], null]
    };
    // the lead: four two-bar answers over Am F C G / Am F E E. [step, note, length]
    var LEADS = [
      [[0,69,6], [6,72,2], [8,76,6], [14,74,2]],
      [[0,72,8], [8,69,8]],
      [[0,71,6], [6,72,2], [8,74,4], [12,76,4]],
      [[0,79,4], [4,76,4], [8,74,6], [14,71,2]],
      [[0,69,6], [6,72,2], [8,76,6], [14,77,2]],
      [[0,81,8], [8,79,8]],
      [[0,80,8], [8,76,8]],
      [[0,76,4], [4,74,4], [8,72,4], [12,71,4]]
    ];
    // ch chord · dr drums · b bass · a acid · c/c2 acid cutoff (ramped across the bar)
    // s stabs · sv stab velocity · l lead phrase · p pad · hv hoover · gp a gap: the last sixteenths emptied · e one-shots
    var BARS = [
      /* 0  0.000  coin       */ { ch:'Am', dr:'roll',   gp:1, e:[[0,'coin'],[0,'sub',0.8],[0,'rise',15,0.42]] },
      /* 1  1.875  LOGO SLAM  */ { ch:'Am', dr:'houseF', b:'D', a:'E', c:1, s:'down', sv:1.35, hv:1.3, e:[[0,'crash',1],[0,'sub',1]] },
      /* --- 3.750: the loop. 40 bars, 75 s, turning back into this bar ------ */
      /* 2 */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.62, s:'down', e:[[0,'crash',0.7]] },
      /* 3 */ { ch:'Am', dr:'house',  b:'D', a:'B', c:0.66, s:'off' },
      /* 4 */ { ch:'F',  dr:'house',  b:'D', a:'A', c:0.7,  s:'off' },
      /* 5 */ { ch:'G',  dr:'house',  b:'D', a:'B', c:0.74, s:'off', e:[[14,'tom',150]] },
      /* 6 */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.78, s:'down' },
      /* 7 */ { ch:'Am', dr:'house',  b:'D', a:'B', c:0.82, s:'off' },
      /* 8 */ { ch:'F',  dr:'house',  b:'D', a:'A', c:0.86, s:'off' },
      /* 9 */ { ch:'E',  dr:'houseF', b:'D', a:'B', c:0.9,  s:'off', e:[[8,'rise',8,0.35]] },
      /* 10 */ { ch:'Am', dr:'house',  b:'P', a:'A', c:0.6,  s:'off', l:0, e:[[0,'crash',0.55]] },
      /* 11 */ { ch:'F',  dr:'house',  b:'P', a:'B', c:0.6,  s:'off', l:1 },
      /* 12 */ { ch:'C',  dr:'house',  b:'P', a:'A', c:0.64, s:'off', l:2 },
      /* 13 */ { ch:'G',  dr:'house',  b:'P', a:'B', c:0.68, s:'off', l:3, e:[[14,'tom',150]] },
      /* 14 */ { ch:'Am', dr:'house',  b:'P', a:'A', c:0.7,  s:'off', l:4 },
      /* 15 */ { ch:'F',  dr:'house',  b:'P', a:'B', c:0.72, s:'off', l:5 },
      /* 16 */ { ch:'E',  dr:'house',  b:'P', a:'A', c:0.74, s:'off', l:6 },
      /* 17 */ { ch:'E',  dr:'houseF', b:'P', a:'B', c:0.76, s:'off', l:7, e:[[8,'rise',8,0.4]] },
      /* 18 */ { ch:'Dm', dr:'break',  b:'L', a:'D', c:0.25, p:0.5, e:[[0,'fall',0.9,0.4]] },
      /* 19 */ { ch:'Dm', dr:'break',  b:'L', a:'D', c:0.35, p:0.5 },
      /* 20 */ { ch:'Am', dr:'break',  b:'L', a:'D', c:0.45, p:0.5 },
      /* 21 */ { ch:'Am', dr:'break',  b:'L', a:'D', c:0.55, p:0.5 },
      /* 22 */ { ch:'F',  dr:'pulse2', b:'L', a:'D', c:0.65, s:'off', p:0.4 },
      /* 23 */ { ch:'F',  dr:'pulse2', b:'L', a:'D', c:0.75, s:'off', p:0.4 },
      /* 24 */ { ch:'E',  dr:'four',   b:'P', a:'D', c:0.85, s:'off', p:0.3, e:[[0,'rise',16,0.4]] },
      /* 25 */ { ch:'E',  dr:'roll',   b:'P', a:'D', c:0.5, c2:1, p:0.2, gp:1, e:[[0,'rise',15,0.45]] },
      /* 26 */ { ch:'Am', dr:'houseF', b:'D', a:'E', c:1,    s:'down', l:0, hv:0.8, e:[[0,'crash',0.9]] },
      /* 27 */ { ch:'F',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:1 },
      /* 28 */ { ch:'C',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:2 },
      /* 29 */ { ch:'G',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:3, e:[[14,'tom',150]] },
      /* 30 */ { ch:'Am', dr:'houseF', b:'D', a:'E', c:0.95, s:'down', l:4, hv:0.8 },
      /* 31 */ { ch:'F',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:5 },
      /* 32 */ { ch:'E',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:6 },
      /* 33 */ { ch:'E',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:7, e:[[8,'rise',8,0.4]] },
      /* 34 */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.8,  s:'down', e:[[0,'crash',0.6]] },
      /* 35 */ { ch:'Am', dr:'house',  b:'D', a:'B', c:0.8,  s:'off' },
      /* 36 */ { ch:'F',  dr:'house',  b:'D', a:'A', c:0.84, s:'off' },
      /* 37 */ { ch:'G',  dr:'house',  b:'D', a:'B', c:0.84, s:'off', e:[[14,'tom',150]] },
      /* 38 */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.88, s:'down', l:4 },
      /* 39 */ { ch:'F',  dr:'house',  b:'D', a:'B', c:0.88, s:'off', l:5 },
      /* 40 */ { ch:'E',  dr:'house',  b:'D', a:'A', c:0.9,  s:'off', l:6 },
      /* 41 */ { ch:'E',  dr:'fill',   b:'D', a:'B', c:0.95, s:'off', l:7, e:[[8,'rise',8,0.5]] }
    ];
    function drums(kind, i, odd, st) {
      var h = null;
      if (kind === 'pulse2') { if (i % 4 === 0) st.kk = 0.72; if (i % 4 === 2) h = 0.36; }
      else if (kind === 'four') {
        if (i % 4 === 0) st.kk = 0.72;
        if (i % 2 === 0) h = i % 4 === 0 ? 0.5 : 0.34;
        if (i === 14) h = { v: 0.5, o: 1 };
      }
      else if (kind === 'house' || kind === 'houseF') {
        if (i % 4 === 0) st.kk = 1;
        if (kind === 'houseF' && (i === 10 || (odd && i === 14))) st.kk = 0.5;
        if (i === 4 || i === 12) { st.sn = 0.8; st.cp = 0.9; }
        if (kind === 'houseF' && odd && i === 15) st.sn = 0.28;
        h = i % 4 === 2 ? 0.5 : i % 2 === 0 ? 0.4 : 0.25;
        if (i === 14) h = { v: 0.55, o: 1 };
      }
      else if (kind === 'break') { if (i === 0 || i === 8) st.kk = 0.9; if (i === 4 || i === 12) h = 0.3; if (i === 12) st.cp = 0.5; }
      else if (kind === 'roll') { if (i === 0 || i === 8) st.kk = 0.85; if (i >= 8 || i % 2 === 0) st.sn = 0.1 + 0.36 * (i / 15); }
      else if (kind === 'fill') {
        if (i % 4 === 0) st.kk = 1;
        if (i === 4) { st.sn = 0.8; st.cp = 0.9; }
        if (i >= 8) { st.sn = 0.55 + 0.45 * (i - 8) / 7; if (i === 12) st.tm = 130; if (i === 14) st.tm = 100; }
        else h = i % 4 === 2 ? 0.5 : i % 2 === 0 ? 0.4 : 0.25;
      }
      if (h !== null) st.ht = typeof h === 'number' ? { v: h, o: 0 } : h;
    }
    var steps = [], prevAcid = 0;
    BARS.forEach(function (B, bi) {
      var ch = CH[B.ch], acid = B.a ? AP[B.a] : null, bp = B.b ? BP[B.b] : null, odd = bi % 2 === 1;
      var lead = B.l === undefined ? null : LEADS[B.l], lmap = {};
      if (lead) lead.forEach(function (e) { lmap[e[0]] = e; });
      var stabAt = B.s === 'down' ? [0, 3, 6, 11, 14] : B.s === 'off' ? [3, 6, 11, 14] : [];
      var ev = {}; (B.e || []).forEach(function (e) { (ev[e[0]] = ev[e[0]] || []).push(e); });
      var c0 = B.c === undefined ? 0.5 : B.c, c1 = B.c2 === undefined ? c0 : B.c2;
      for (var i = 0; i < 16; i++) {
        var st = { cut: c0 + (c1 - c0) * (i / 15) };
        drums(B.dr || 'none', i, odd, st);
        if (bp && bp[i]) st.bs = { n: ch.r + bp[i][0], len: bp[i][1], vel: bp[i][2], bark: bp[i][3] };
        if (acid && acid[i]) {
          var n = sdeg(acid[i][0] + ch.sh, ch.s7), gap = 1, k;
          for (k = i + 1; k < 16 && !acid[k]; k++) gap++;
          st.ac = { n: n, len: gap * 0.92, vel: 1, acc: acid[i][1], sl: acid[i][2] ? prevAcid : 0 };
          prevAcid = n;
        }
        if (stabAt.indexOf(i) >= 0) st.sb = { notes: ch.tri, len: i === 0 ? 2.2 : 1.4, vel: (i === 0 ? 1 : 0.78) * (B.sv || 1) };
        if (lmap[i]) st.ld = { n: lmap[i][1], len: lmap[i][2], vel: i === 0 ? 1 : 0.86 };
        if (i === 0 && B.p) st.pd = { notes: ch.tri.map(function (x) { return x - 12; }), len: 16, vel: B.p };
        if (i === 0 && B.hv) st.hv = { notes: ch.tri, len: 6, vel: B.hv };
        // a build that runs right up to the drop masks it, and leaves the limiter clamped down
        // over the very hit it is building to. Empty the last sixteenths instead: the silence
        // lets the compressor breathe out, and the drop arrives into a hole.
        if (B.gp && i >= 16 - B.gp) { st.kk = 0; st.sn = 0; st.cp = 0; st.tm = 0; st.ht = null; st.bs = null; st.ac = null; st.sb = null; }
        (ev[i] || []).forEach(function (e) {
          if (e[1] === 'coin') st.cn = 1;
          else if (e[1] === 'sub') st.su = e[2];
          else if (e[1] === 'crash') st.cr = e[2];
          else if (e[1] === 'rise') st.ri = { len: e[2], v: e[3] };
          else if (e[1] === 'fall') st.fa = { d: e[2], v: e[3] };
          else if (e[1] === 'tom') st.tm = e[2];
        });
        steps.push(st);
      }
    });
    return TITLE = { bpm: TITLE_BPM, steps: steps, bars: BARS.length,
                     introSteps: TITLE_INTRO_BARS * 16, loopSteps: TITLE_LOOP_BARS * 16 };
  }
  function scheduleTitle() {
    var song = composeTitle(), spb = 60 / song.bpm / 4, now = AC.currentTime, swg = TITLE_SWING * spb;
    while (nextT < now - 0.05) { nextT += spb; step++; }              // the tab stalled: drop what is already late
    while (nextT < now + 0.3) {
      // the two intro bars play once; after them the piece wraps inside the loop, never back into bar 0
      var j = step < song.introSteps ? step : song.introSteps + (step - song.introSteps) % song.loopSteps;
      var st = song.steps[j], t = nextT, sw = (j % 2) ? swg : 0;
      if (st.cn) tCoin(t);
      if (st.su) tSub(t, st.su);
      if (st.cr) tCrash(t, st.cr);
      if (st.ri) tRise(t, st.ri.len * spb, st.ri.v);
      if (st.fa) tFall(t, st.fa.d, st.fa.v);
      if (st.pd) tPad(st.pd.notes, t, st.pd.len * spb, st.pd.vel);
      if (st.hv) tHoover(st.hv.notes, t, st.hv.len * spb, st.hv.vel);
      if (st.sb) tStab(st.sb.notes, t, st.sb.len * spb, st.sb.vel);
      if (st.ld) tLead(st.ld.n, t, st.ld.len * spb * 0.94, st.ld.vel);
      if (st.bs) tBass(st.bs.n, t, st.bs.len * spb, st.bs.vel, st.bs.bark);
      if (st.ac) tAcid(st.ac.n, t + sw, st.ac.len * spb, st.ac.vel, st.ac.acc, st.ac.sl, st.cut);
      if (st.kk) tKick(t, st.kk);
      if (st.sn) tSnare(t, st.sn);
      if (st.cp) tClap(t, st.cp);
      if (st.tm) tTom(t, st.tm, 0.9);
      if (st.ht) tHat(t + sw, st.ht.o, st.ht.v);
      nextT += spb; step++;
    }
  }

  /* --- stingers: one-shots on their own bus, so they sound with the music off and ignore the dread filter ---- */
  var stingFx = null, inSting = false;
  function stingOut(wet) {
    if (!stingFx) {
      stingFx = AC.createGain(); stingFx.gain.value = 1;
      var d = AC.createDelay(1.0), fb = AC.createGain(), lp = AC.createBiquadFilter(), w = AC.createGain();
      d.delayTime.value = 0.29; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2800; w.gain.value = 0.3;
      stingFx.connect(stingBus); stingFx.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(w); w.connect(stingBus);
    }
    return wet ? stingFx : stingBus;
  }
  // tone: attack a, then an exponential fall to silence at t + dur. Returns the oscillator so callers can bend it.
  function sTone(type, fr, t, dur, peak, a, dest, det) {
    var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(fr, t); if (det) o.detune.value = det;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function sNoise(kind, f0, f1, q, t, dur, peak, a, dest) {   // filtered noise whose filter slides from f0 to f1. Returns the gain for extra shaping.
    var s = loopNoise(), fl = AC.createBiquadFilter(), g = AC.createGain(); fl.type = kind; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, loopAt()); s.stop(t + dur + 0.05); return g;
  }
  function sHorns(notes, t, dur, peak, dest) {   // fanfare brass: saws behind a filter that blats open on the attack
    var lp = AC.createBiquadFilter(), g = AC.createGain(); lp.type = 'lowpass'; lp.Q.value = 1.8;
    lp.frequency.setValueAtTime(350, t); lp.frequency.exponentialRampToValueAtTime(3400, t + 0.045); lp.frequency.exponentialRampToValueAtTime(1500, t + Math.max(0.1, dur));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.02); g.gain.setValueAtTime(peak * 0.85, t + Math.max(0.03, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.18);
    lp.connect(g); g.connect(dest);
    var lg = null; if (dur > 0.5) { var v = AC.createOscillator(); lg = AC.createGain(); v.frequency.value = 5.4; lg.gain.setValueAtTime(0, t + 0.25); lg.gain.linearRampToValueAtTime(12, t + 0.6); v.connect(lg); v.start(t); v.stop(t + dur + 0.2); }
    notes.forEach(function (n) { [-6, 6].forEach(function (det) { var o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f(n); o.detune.value = det; if (lg) lg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + 0.25); }); });
  }
  function sTimp(note, t, vel, dest) { var o = sTone('sine', f(note) * 1.4, t, 0.9, vel * 0.8, 0.004, dest); o.frequency.exponentialRampToValueAtTime(f(note), t + 0.05); sNoise('lowpass', 700, 300, 0.7, t, 0.07, vel * 0.4, 0.002, dest); }
  function duckFor(level, hold, back) { var now = AC.currentTime; duck.gain.cancelScheduledValues(now); duck.gain.setTargetAtTime(level, now, 0.04); duck.gain.setTargetAtTime(1, now + hold, back / 3); }
  var STINGERS = {
    // the landing: a sub that falls through the floor, a boom, the sky tearing, and rubble
    impact: function (t) {
      var dry = stingOut(false);
      duckFor(0.25, 1.3, 1.5);
      sTone('sine', 120, t, 2.5, 0.95, 0.006, dry).frequency.exponentialRampToValueAtTime(26, t + 1.3);
      sTone('triangle', 62, t, 1.6, 0.5, 0.004, dry).frequency.exponentialRampToValueAtTime(34, t + 0.7);
      sTone('square', 300, t, 0.09, 0.3, 0.001, dry).frequency.exponentialRampToValueAtTime(60, t + 0.08);
      sNoise('lowpass', 9000, 180, 0.7, t, 2.4, 0.75, 0.004, dry);
      sNoise('bandpass', 2400, 500, 1.2, t + 0.12, 1.6, 0.25, 0.02, stingOut(true));
      [0.35, 0.62, 0.8, 1.15, 1.5].forEach(function (dt, k) { sTone('sine', 90 - k * 9, t + dt, 0.3, 0.3 - k * 0.04, 0.004, dry).frequency.exponentialRampToValueAtTime(40, t + dt + 0.2); });   // masonry
    },
    // accepted: a G major fanfare. Pickup, held fifth, IV-V, and home with timpani and a cymbal
    victory: function (t) {
      var wet = stingOut(true), dry = stingOut(false);
      duckFor(0, 3.9, 0.9);
      [[62, 0, 0.11], [67, 0.12, 0.11], [71, 0.24, 0.11], [74, 0.36, 0.6], [72, 1.0, 0.16], [71, 1.18, 0.16], [72, 1.36, 0.32], [74, 1.72, 0.32], [79, 2.08, 1.75]].forEach(function (n) { sHorns([n[0]], t + n[1], n[2], 0.2, wet); });
      [[[43, 55, 59, 62], 0.36, 0.95], [[48, 55, 60, 64], 1.36, 0.32], [[50, 57, 62, 66], 1.72, 0.32], [[43, 55, 62, 67, 71], 2.08, 1.75]].forEach(function (c) { sHorns(c[0], t + c[1], c[2], 0.11, wet); });
      sTimp(43, t + 0.36, 0.9, dry); sTimp(48, t + 1.36, 0.7, dry); sTimp(50, t + 1.72, 0.8, dry); sTimp(50, t + 1.9, 0.6, dry); sTimp(43, t + 2.08, 1, dry);
      for (var k = 1; k < 14; k++) sTimp(43, t + 2.08 + k * 0.095, 0.5 * (1 - k / 16), dry);
      sNoise('highpass', 5000, 4000, 0.7, t + 2.08, 1.9, 0.3, 0.004, dry);
    },
    // blast-off: ignition thump, a rumble that swells, noise sweeping up and a pitch riser that leaves through the ceiling
    launch: function (t) {
      var dry = stingOut(false), wet = stingOut(true);
      duckFor(0.4, 4.2, 1.2);
      sTone('sine', 90, t, 0.7, 0.8, 0.005, dry).frequency.exponentialRampToValueAtTime(35, t + 0.4);
      var rum = sNoise('lowpass', 90, 420, 0.8, t, 5.0, 0.0002, 0.01, dry); rum.gain.cancelScheduledValues(t); rum.gain.setValueAtTime(0.0001, t); rum.gain.exponentialRampToValueAtTime(0.85, t + 2.6); rum.gain.setValueAtTime(0.85, t + 3.6); rum.gain.exponentialRampToValueAtTime(0.0001, t + 5.0);
      var sw = sNoise('bandpass', 250, 7000, 1.6, t + 0.2, 4.6, 0.0002, 0.01, wet); sw.gain.cancelScheduledValues(t); sw.gain.setValueAtTime(0.0001, t + 0.2); sw.gain.exponentialRampToValueAtTime(0.4, t + 3.9); sw.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
      [[0, 0.16], [7, 0.1]].forEach(function (p, k) {
        var o = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.detune.value = k * 9;
        o.frequency.setValueAtTime(55 * Math.pow(2, p[0] / 12), t + 0.3); o.frequency.exponentialRampToValueAtTime(1320 * Math.pow(2, p[0] / 12), t + 4.7);
        lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(300, t + 0.3); lp.frequency.exponentialRampToValueAtTime(5000, t + 4.7);
        g.gain.setValueAtTime(0.0001, t + 0.3); g.gain.exponentialRampToValueAtTime(p[1], t + 3.4); g.gain.setValueAtTime(p[1], t + 4.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.95);
        o.connect(lp); lp.connect(g); g.connect(wet); o.start(t + 0.3); o.stop(t + 5.0);
      });
      var sub = AC.createOscillator(), sg = AC.createGain(); sub.type = 'sine'; sub.frequency.setValueAtTime(36, t); sub.frequency.linearRampToValueAtTime(62, t + 4.6);
      sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.5, t + 2.4); sg.gain.setValueAtTime(0.5, t + 3.8); sg.gain.exponentialRampToValueAtTime(0.0001, t + 5.0);
      sub.connect(sg); sg.connect(dry); sub.start(t); sub.stop(t + 5.05);
    },
    // home: the town theme's hook (bars 1-2) and its cadence (bars 7-8) at walking pace, in G major whatever the dread was, then G left ringing
    ending: function (t) {
      var wet = stingOut(true), song = composeOverworld(false), sp = 0.125;
      duckFor(0, 9.5, 1.2);
      function mar(n, at, len, v) { sTone('sine', f(n), at, Math.max(0.5, len), v * 0.3, 0.004, wet); sTone('sine', f(n) * 4, at, 0.12, v * 0.06, 0.002, wet); }
      function padc(notes, at, len, v) { notes.forEach(function (n, k) { var o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = f(n); o.detune.value = k * 4 - 6; lp.type = 'lowpass'; lp.frequency.value = 1100; g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(v * 0.07, at + 0.3); g.gain.setValueAtTime(v * 0.07, at + Math.max(0.35, len - 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.6); o.connect(lp); lp.connect(g); g.connect(wet); o.start(at); o.stop(at + len + 0.7); }); }
      [0, 1, 6, 7].forEach(function (bar, k) { for (var i = 0; i < (bar === 7 ? 14 : 16); i++) { var m = song.steps[bar * 16 + i].mel; if (m) mar(pitch(m.d, m.alt, 'major'), t + (k * 16 + i) * sp, m.len * sp * 1.6, m.vel); } });   // bar 8's pickup back into the tune is left out: this ends
      [[[55, 59, 62, 67], 43, 0, 16], [[52, 55, 59, 64], 40, 16, 16], [[55, 60, 64, 67], 48, 32, 8], [[54, 57, 62, 66], 50, 40, 8]].forEach(function (c) {   // G, Em, C, D
        padc(c[0], t + c[2] * sp, c[3] * sp, 1); sTone('triangle', f(c[1]), t + c[2] * sp, c[3] * sp, 0.2, 0.02, wet);
      });
      var e = t + 48 * sp;
      padc([55, 59, 62, 67, 71], e, 1.6, 1.2); sTone('triangle', f(43), e, 2.4, 0.26, 0.02, wet);
      [67, 71, 74, 79, 83].forEach(function (n, k) { var at = e + k * 0.13; [1, 2.76, 5.4].forEach(function (r, j) { sTone('sine', f(n) * r, at, 1.9 - j * 0.5, [0.2, 0.06, 0.02][j], 0.003, wet); }); });
    }
  };

  /* --- API ---------------------------------------------------------------- */
  // every music voice, so stop() can actually stop them (stingers are exempt). A voice leaves the list when it has
  // ended, not when it is old: a plug-in's eleven-second riser must still answer stop(). The 60 s cap only catches
  // a source that was created and never started (it would never end).
  var live = [];
  function track(ac) {
    ['createOscillator', 'createBufferSource'].forEach(function (k) {
      var mk = ac[k].bind(ac);
      ac[k] = function () {
        var n = mk();
        if (!inSting) { var v = { n: n, born: ac.currentTime, done: false }; n.addEventListener('ended', function () { v.done = true; }); live.push(v); }
        return n;
      };
    });
  }
  function prune() { var now = AC.currentTime, j = 0; for (var i = 0; i < live.length; i++) { var v = live[i]; if (!v.done && now - v.born < 60) live[j++] = v; } live.length = j; }
  function scheduleCustom() {
    var def = STYLES[style], S = { now: AC.currentTime, nextT: nextT, step: step, dread: dread, boost: boost, offline: rendering };
    def.schedule(S);
    // Keep the plug-in's grid whenever it is not behind the clock: a tick with nothing due leaves S.nextT alone, and
    // that is correct. Only a scheduler that fell behind (or returned garbage) is put back 300 ms ahead. tick() runs
    // on a timer and never loops, so a plug-in that never advances cannot spin either way.
    var nt = S.nextT, now = AC.currentTime;
    nextT = typeof nt === 'number' && isFinite(nt) && nt >= now ? nt : now + 0.3;
    if (typeof S.step === 'number' && isFinite(S.step)) step = S.step;
  }
  function schedule() { if (style === 'space') scheduleSpace(); else if (style === 'cave') scheduleCave(); else if (style === 'title') scheduleTitle(); else if (STYLES[style]) scheduleCustom(); else scheduleOverworld(); }
  function tick() { try { if (parked) return; prune(); schedule(); } catch (e) { if (window.console) console.error(e); } }

  /* --- offline render: the same schedulers, the offline context's own clock, a throwaway graph ------
     Riff.render(style, seconds, {dread, boss, boost}) builds an OfflineAudioContext, rebuilds every bus
     on it, drives the style's scheduler exactly as the live tick does (the context suspends itself every
     100 ms of render time and each stop schedules the next 300 ms) and resolves to the AudioBuffer. `dread` is a number or a function of
     seconds, fed through setDread as the clock advances; `step` starts the scheduler part-way through
     a piece (a loop seam can then be measured without rendering the loop). The live context and everything cached on it
     are put back after every step, so whatever is playing keeps playing meanwhile. */
  function snap() {
    return { AC: AC, master: master, tone: tone, dist: dist, gate: gate, duck: duck, stingBus: stingBus, owMix: owMix, metalMix: metalMix,
             fbGain: fbGain, wetGain: wetGain, soft: soft, hallIn: hallIn, choirIn: choirIn, choirF: choirF, spaceIn: spaceIn, pulseWaves: pulseWaves,
             caveIn: caveIn, titleIn: titleIn, titleEch: titleEch, stingFx: stingFx, noiseBufs: noiseBufs, rendering: rendering, owShade: owShade,
             playing: playing, style: style, step: step, nextT: nextT, dread: dread, boost: boost, bossWant: bossWant, bossOn: bossOn, bossStep: bossStep, inSting: inSting };
  }
  function load(s) {
    AC = s.AC; master = s.master; tone = s.tone; dist = s.dist; gate = s.gate; duck = s.duck; stingBus = s.stingBus; owMix = s.owMix; metalMix = s.metalMix;
    fbGain = s.fbGain; wetGain = s.wetGain; soft = s.soft; hallIn = s.hallIn; choirIn = s.choirIn; choirF = s.choirF; spaceIn = s.spaceIn; pulseWaves = s.pulseWaves;
    caveIn = s.caveIn; titleIn = s.titleIn; titleEch = s.titleEch; stingFx = s.stingFx; noiseBufs = s.noiseBufs; rendering = s.rendering; owShade = s.owShade;
    playing = s.playing; style = s.style; step = s.step; nextT = s.nextT; dread = s.dread; boost = s.boost; bossWant = s.bossWant; bossOn = s.bossOn; bossStep = s.bossStep; inSting = s.inSting;
  }
  function render(st, seconds, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Off) { reject(new Error('no OfflineAudioContext')); return; }
      if (!Riff.has(st)) { reject(new Error('unknown style ' + st)); return; }
      seconds = Math.max(1, +seconds || 10);
      var off = new Off(2, Math.ceil(seconds * 44100), 44100), STEP = 0.1;
      var dfn = typeof opts.dread === 'function' ? opts.dread : function () { return +opts.dread || 0; };
      var R = { AC: off, master: null, tone: null, dist: null, gate: null, duck: null, stingBus: null, owMix: null, metalMix: null, fbGain: null, wetGain: null,
                soft: null, hallIn: null, choirIn: null, choirF: null, spaceIn: null, pulseWaves: {}, caveIn: null, titleIn: null, titleEch: null, stingFx: null, noiseBufs: {}, rendering: true, owShade: -1,
                playing: true, style: st, step: Math.max(0, opts.step | 0), nextT: 0, dread: 0, boost: opts.boost ? 1 : 0, bossWant: !!opts.boss && st === 'quest', bossOn: false, bossStep: 0, inSting: false };
      // one scheduler step at render time `time`, on the offline graph, with the live state put back before anything else can run
      function tickAt(time) {
        var keep = snap(); load(R);
        try { Riff.setDread(dfn(time)); schedule(); } finally { R = snap(); load(keep); }
      }
      // the context stops every 100 ms of its own time; each stop schedules the next 300 ms, exactly like the live tick,
      // so the graph only ever holds the voices in flight (scheduling a whole piece up front makes Chrome pull every
      // node of it on every render quantum, and a three-minute piece then renders at a tenth of real time)
      // A step that throws (a plug-in's schedule, an opts.dread function) rejects the render and lets the context run
      // out with nothing more scheduled: left suspended it would never finish, and its buffer and graph would never go.
      function arm(k) {
        if (k * STEP >= seconds) return;
        off.suspend(k * STEP).then(function () {
          try { tickAt(off.currentTime); arm(k + 1); } catch (e) { reject(e); }
          off.resume();
        }, reject);
      }
      try { var keep = snap(); load(R); buildBuses(); R = snap(); load(keep); tickAt(0); arm(1); }
      catch (e) { load(keep); reject(e); return; }
      off.startRendering().then(resolve, reject);
    });
  }
  // {peak, rms, envelope (RMS per second), onsetsPerSecond, seconds} of a rendered buffer: enough to measure a track without hearing it
  function analyse(buf) {
    var L = buf.getChannelData(0), R2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = L.length, sr = buf.sampleRate;
    var peak = 0, sum = 0, env = [], acc = 0, cnt = 0, i, k, v;
    for (i = 0; i < n; i++) { v = Math.max(Math.abs(L[i]), Math.abs(R2[i])); if (v > peak) peak = v; v = L[i] * L[i]; sum += v; acc += v; if (++cnt === sr) { env.push(+Math.sqrt(acc / cnt).toFixed(4)); acc = 0; cnt = 0; } }
    if (cnt > sr / 2) env.push(+Math.sqrt(acc / cnt).toFixed(4));
    // onsets: 10 ms frames of first-difference energy (a high-pass, so attacks count and held pads do not); a frame
    // 3 dB above the mean of the previous three counts, at most one every 50 ms. Checked against the town theme's
    // note data: 3.2 onsets/s detected in its first minute against 3.1-4.1/s scheduled.
    var fl = Math.round(sr / 100), nf = Math.floor(n / fl), e = new Float32Array(nf), ons = [], last = -9;
    for (k = 0; k < nf; k++) { acc = 0; for (i = Math.max(1, k * fl); i < (k + 1) * fl; i++) { v = L[i] - L[i - 1]; acc += v * v; } e[k] = acc / fl; }
    for (k = 0; k < Math.ceil(n / sr); k++) ons.push(0);
    for (k = 3; k < nf; k++) { var m = (e[k - 1] + e[k - 2] + e[k - 3]) / 3; if (e[k] > m * 2 && e[k] > 1e-7 && k - last >= 5) { last = k; ons[Math.floor(k * fl / sr)]++; } }
    return { seconds: n / sr, peak: +peak.toFixed(4), rms: +Math.sqrt(sum / n).toFixed(4), envelope: env, onsetsPerSecond: ons };
  }
  var Riff = {
    get playing() { return playing; },
    get style() { return style; },
    play: function (st) {
      var fresh = !AC; ctx(); if (fresh) track(AC);
      if (AC.state === 'suspended') AC.resume();
      st = st || 'quest';
      if (playing && style === st) return;
      Riff.stop(); style = lastStyle = st; playing = true; step = 0; bossOn = bossWant && st === 'quest'; bossStep = 0; owShade = -1;
      var now = AC.currentTime; nextT = now + 0.12;
      gate.gain.setTargetAtTime(1, now + 0.07, 0.01);           // stop() above has just shut the gate; open it again once the old voices are gone
      duck.gain.cancelScheduledValues(now); duck.gain.setTargetAtTime(1, now, 0.15);
      applyTone(now, true);                                     // space: filter fully open, dread ignored. quest: whatever dread says
      if (bossOn) vowel('ooh', now, 0.01);
      timer = setInterval(tick, 100); tick(); park(); sync();     // park() re-parks if this started while the tab is hidden
    },
    setDread: function (d) {
      dread = Math.max(0, Math.min(1, d));
      if (!AC) return;
      applyTone(AC.currentTime, false);
    },
    // the boss-fight layer. Joins (and leaves) on the next bar line; harmless to call when nothing is playing.
    boss: function (on) { bossWant = !!on; if (!playing) bossOn = false; },
    get bossing() { return bossWant; },
    // one-shots: 'impact' | 'victory' | 'launch' | 'ending' plus addStinger names. Unknown names are ignored (returns false). Work with the music stopped.
    stinger: function (name) {
      var has = Object.prototype.hasOwnProperty, fn = has.call(STINGERS, name) ? STINGERS[name] : has.call(XSTING, name) ? XSTING[name] : null;
      if (!fn) return false;
      var fresh = !AC; ctx(); if (fresh) track(AC);
      if (!rendering && AC.state === 'suspended') AC.resume();   // under Riff.render the context is the offline one, paused between steps
      inSting = true; try { fn(AC.currentTime + 0.03); } finally { inSting = false; }
      return true;
    },
    // tell the ♫ button which track it should start next, without starting it (for when the player has the music off)
    cue: function (st) { if (st) lastStyle = st; },
    // plug-ins (riff2.js): whole tracks and one-shots registered from another file. See the note by STYLES above.
    has: function (st) { return st === 'quest' || st === 'quest2' || st === 'space' || st === 'cave' || st === 'title' || Object.prototype.hasOwnProperty.call(STYLES, st); },
    addStyle: function (name, def) { if (typeof name === 'string' && def && typeof def.schedule === 'function') STYLES[name] = def; },
    addStinger: function (name, fn) { if (typeof name === 'string' && typeof fn === 'function') XSTING[name] = fn; },
    // the synth kit for plug-ins: the shared context and buses plus every voice in this file. Creates the
    // AudioContext, so call it from inside schedule()/stinger functions, never at load.
    kit: function () {
      var fresh = !AC; ctx(); if (fresh) track(AC);
      return { AC: AC, master: master, out: owMix, metal: metalMix, dist: dist, sting: stingBus, gate: gate, duck: duck,
               f: f, noise: noise, loopNoise: loopNoise, env: env, pluck: pluck, pulse: pulse, tanh: tanh, curve: curve, mulberry32: mulberry32,
               kick: kick, snare: snare, hat: hat, tom: tom, crash: crash, riser: riser, softKick: softKick, brush: brush, shaker: shaker,
               chug: chug, lead: lead, marimba: marimba, ocarina: ocarina, bell: bell, bass: bass, pad: pad, drone: drone, heartbeat: heartbeat, flute: flute, harpsi: harpsi, gritLead: gritLead,
               choir: choir, chant: chant, vowel: vowel, timp: timp, brass: brass, tubular: tubular,
               sLead: sLead, sArp: sArp, sBass: sBass, sPad: sPad,
               tBass: tBass, tAcid: tAcid, tStab: tStab, tHoover: tHoover, tLead: tLead, tPad: tPad, tKick: tKick, tSnare: tSnare, tClap: tClap, tHat: tHat, tTom: tTom, tCrash: tCrash, tRise: tRise, tFall: tFall, tSub: tSub, tRumble: tRumble, tCoin: tCoin,
               fmBell: fmBell, caveBass: caveBass, caveLead: caveLead,
               stingOut: stingOut, sTone: sTone, sNoise: sNoise, sHorns: sHorns, sTimp: sTimp, duckFor: duckFor,
               softBus: softBus, spaceBus: spaceBus, caveBus: caveBus, titleBus: titleBus, titleEcho: titleEcho, hall: hall, choirBus: choirBus };
    },
    takeover: function (on) { boost = on ? 1 : 0; },
    // offline measurement: render(style, seconds, {dread: number | function(seconds), boss, boost, step}) -> Promise<AudioBuffer>; analyse(buffer) -> numbers
    render: render,
    analyse: analyse,
    get metal() { return boost > 0; },
    get dread() { return dread; },
    info: function () {
      var s = composeOverworld(false), s2 = composeOverworld(true), sp = composeSpace(), b = composeBoss(), cv = composeCave(), ti = composeTitle(),
          secs = function (x) { return Math.round(x.steps.length * 60 / x.bpm / 4); },
          caveSecs = Math.round(cv.steps.length * 60 / cv.bpm / 12),   // the cave grid is twelfths, not sixteenths
          ow = function (x, bpm) { return { steps: x.steps.length, bars: x.bars, bpm: bpm, seconds: secs(x), notes: x.steps.filter(function (q) { return q.mel; }).length, form: FORM.map(function (fm) { return fm.s; }).join(''), shades: SHADE_AT }; };
      var out = { steps: s.steps.length, seconds: secs(s), notes: s.steps.filter(function (x) { return x.mel; }).length, quest: ow(s, OW_BPM), quest2: ow(s2, OW2_BPM),
        spaceSeconds: secs(sp), space: { steps: sp.steps.length, bars: sp.steps.length / 16, bpm: sp.bpm, seconds: secs(sp), notes: sp.steps.filter(function (x) { return x.lead; }).length },
        boss: { steps: b.steps.length, bars: b.steps.length / 16, bpm: b.bpm, seconds: secs(b) },
        caveSeconds: caveSecs, cave: { steps: cv.steps.length, bars: cv.bars, bpm: cv.bpm, seconds: caveSecs, notes: cv.steps.filter(function (x) { return x && x.mel; }).length },
        titleSeconds: secs(ti), title: { steps: ti.steps.length, bars: ti.bars, bpm: ti.bpm, seconds: secs(ti),
          introBars: ti.introSteps / 16, introSeconds: +(ti.introSteps * 60 / ti.bpm / 4).toFixed(3),
          loopBars: ti.loopSteps / 16, loopSeconds: +(ti.loopSteps * 60 / ti.bpm / 4).toFixed(3),
          notes: ti.steps.filter(function (x) { return x.ac; }).length } };
      for (var k in STYLES) if (STYLES[k].info) { try { out[k] = STYLES[k].info(); } catch (e) {} }
      return out;
    },
    stop: function () {
      playing = false; if (timer) clearInterval(timer); timer = null;
      if (AC && gate) {
        var now = AC.currentTime; gate.gain.cancelScheduledValues(now); gate.gain.setTargetAtTime(0, now, 0.012);
        live.forEach(function (v) { try { v.n.stop(now + 0.07); } catch (e) {} }); live.length = 0;      // nothing scheduled ahead survives, no tails hang on
      }
      sync();
    },
    toggle: function (st) { if (playing && (!st || st === style)) Riff.stop(); else Riff.play(st); },
    // a bound button is THE music switch: lit whenever anything plays, stops whatever plays, and restarts the track that was last asked for
    bind: function (btn, st) {
      buttons.push({ b: btn, s: st });
      btn.addEventListener('click', function (e) { e.stopPropagation(); if (playing) Riff.stop(); else Riff.play(lastStyle || st); });
      sync();
    }
  };
  function sync() { buttons.forEach(function (o) { var on = playing; o.b.setAttribute('aria-pressed', String(on)); o.b.textContent = on ? '♫ ON' : '♫ OFF'; }); }
  // A hidden tab throttles setInterval, which would wreck the look-ahead scheduler — so park the
  // audio clock rather than tear the score down. AC.currentTime freezes while the context is
  // suspended, so nextT stays valid and the music resumes exactly where it stopped; `playing`
  // stays true, so the pill and the host's musicWanted flag still describe what the player hears.
  function park() {
    if (!AC) return;
    try {
      if (document.hidden) {
        if (playing) { parked = true; var sp = AC.suspend(); if (sp && sp.catch) sp.catch(function () { parked = false; }); }   // idempotent, and beats a resume() that has not settled yet
      } else if (parked) {
        parked = false; var rp = AC.resume(); if (rp && rp.then) rp.then(function () { if (playing) tick(); }, function () {});
      }
    } catch (e) { parked = false; }
  }
  document.addEventListener('visibilitychange', park);
  window.Riff = Riff;
})();
