/* =============================================================================
   RIFF.JS — procedurally generated chip-metal. No samples, no MIDI files,
   no copyright: every note is synthesised in WebAudio at runtime.
   Riff.play('quest' | 'space' | 'cave' | 'title'), Riff.stop(), Riff.toggle(style), Riff.setDread(0..1), Riff.playing
   ============================================================================= */
(function () {
  'use strict';
  var AC = null, master = null, tone = null, dist = null, timer = null, playing = false, style = null;
  var dread = 0, fbGain = null, wetGain = null, KEYPC = 67 % 12;
  var owMix = null, metalMix = null, boost = 0, mstep = 0;
  var step = 0, nextT = 0, buttons = [];
  var gate = null, duck = null, stingBus = null, lastStyle = null, parked = false;
  var bossWant = false, bossOn = false, bossStep = 0;

  function ctx() {
    if (AC) return AC;
    AC = new (window.AudioContext || window.webkitAudioContext)();
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
    return AC;
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
  function chug(note, t, dur, mute, lean) {
    // power chord: root + fifth + octave, two detuned saws each, palm-muted envelope
    // lean (boss fight): one saw per chord tone, a little louder, so the choir has oscillators to spare
    [0, 7, 12].forEach(function (iv, k) {
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
  function bass(note, t, dur, vel) {
    var o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f(note); o2.type = 'sine'; o2.frequency.value = f(note) / 2;
    lp.type = 'lowpass'; lp.frequency.value = 500;
    env(g, t, 0.006, vel * 0.55, 0.1, 0.7, dur * 0.9, 0.08);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(owMix); o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
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
  function brush(t) { var s = AC.createBufferSource(), g = AC.createGain(), bp = AC.createBiquadFilter(); s.buffer = noise(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.9; g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(bp); bp.connect(g); g.connect(owMix); s.start(t); s.stop(t + 0.15); }
  function shaker(t, acc) { var s = AC.createBufferSource(), g = AC.createGain(), hp = AC.createBiquadFilter(); s.buffer = noise(); hp.type = 'highpass'; hp.frequency.value = 8000; g.gain.setValueAtTime(acc ? 0.09 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(hp); hp.connect(g); g.connect(owMix); s.start(t); s.stop(t + 0.07); }

  /* --- the overworld piece: composed once from a seed, ~3.5 min, loops ---- */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var OVERWORLD = null;
  function composeOverworld() {
    if (OVERWORLD) return OVERWORLD;
    var rnd = mulberry32(64), BPM = 126, KEY = 67;                      // G major
    var SCALE = [0, 2, 4, 5, 7, 9, 11];
    // chord degrees (0-based) per 8-bar section; each entry = one bar
    var PROG = {
      A:  [0, 4, 5, 3, 0, 4, 1, 4],           // I V vi IV I V ii V
      B:  [5, 3, 0, 4, 5, 3, 1, 4],           // vi IV I V vi IV ii V
      C:  [3, 4, 2, 5, 3, 4, 0, 0],           // IV V iii vi IV V I I
      D:  [5, 2, 3, 0, 5, 2, 1, 4],           // vi iii IV I vi iii ii V  (the wistful bit)
      Z:  [3, 4, 0, 0, 3, 4, 0, 0]            // coda: IV V I I, resolves into the loop
    };
    var FORM = ['A', 'A', 'B', 'A', 'C', 'B', 'A', 'D', 'D', 'A', 'B', 'C', 'A', 'Z'];   // 14 × 8 bars
    var VOICE = { A: 'marimba', B: 'ocarina', C: 'bell', D: 'ocarina', Z: 'marimba' };
    function deg(d, oct) { return KEY + SCALE[((d % 7) + 7) % 7] + 12 * (oct + Math.floor(d / 7)); }
    function chordTones(root) { return [root, root + 2, root + 4]; }
    var RHY = [
      [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0], [1,0,1,0, 1,0,0,0, 1,0,1,0, 0,0,1,0], [1,0,0,1, 0,0,1,0, 1,0,0,0, 1,0,0,0],
      [1,0,1,1, 0,0,1,0, 1,0,0,0, 0,0,0,0], [1,0,0,0, 0,0,1,0, 1,0,1,0, 1,0,0,0], [1,0,1,0, 1,0,1,0, 1,0,0,0, 0,0,0,0]
    ];
    var themes = {};
    function melody(sec) {
      if (themes[sec]) return themes[sec];
      var out = [], cur = 7;   // scale-degree index relative to tonic, start on the octave
      for (var bar = 0; bar < 8; bar++) {
        var root = PROG[sec][bar], tones = chordTones(root), rhy = RHY[Math.floor(rnd() * RHY.length)];
        if (bar === 7) rhy = [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0];
        var last = -1;
        for (var i = 0; i < 16; i++) {
          if (!rhy[i]) { out.push(null); continue; }
          var strong = i % 4 === 0, choice;
          if (strong || rnd() < 0.6) {           // chord tone near the current pitch
            var cands = [];
            for (var o = -1; o <= 2; o++) tones.forEach(function (tn) { cands.push(tn + 7 * o); });
            cands.sort(function (a, b) { return Math.abs(a - cur) - Math.abs(b - cur); });
            choice = cands[Math.min(cands.length - 1, Math.floor(rnd() * 2.2))];
          } else choice = cur + (rnd() < 0.5 ? 1 : -1);  // passing tone
          if (choice > 13) choice -= 7; if (choice < 3) choice += 7;
          if (choice === last && rnd() < 0.7) choice += rnd() < 0.5 ? 1 : -1;
          cur = choice; last = choice;
          // note length = distance to the next hit
          var len = 1; for (var k = i + 1; k < 16 && !rhy[k]; k++) len++;
          out.push({ n: deg(choice, 1), len: len, vel: strong ? 1 : 0.75 });
        }
      }
      return themes[sec] = out;
    }
    var steps = [];   // one entry per 16th: { mel, arp, bass, pad, kick, snare, shk, voice }
    FORM.forEach(function (sec, si) {
      var mel = melody(sec), voice = VOICE[sec], repeatOfA = sec === 'A' && si > 0, quiet = sec === 'D' && si === 7;
      for (var bar = 0; bar < 8; bar++) {
        var root = PROG[sec][bar], tones = chordTones(root);
        for (var i = 0; i < 16; i++) {
          var st = { voice: voice, quiet: quiet };
          var m = mel[bar * 16 + i]; if (m) st.mel = m;
          // harmony a third above on the returning A sections (bells)
          if (m && repeatOfA && i % 4 === 0) st.harm = deg(chordTones(root)[1] + 7, 1);
          // marimba arpeggio, 8ths, alternating pattern per section
          if (i % 2 === 0 && !quiet) { var pat = si % 2 ? [0, 1, 2, 1, 0, 2, 1, 2] : [0, 2, 1, 2, 0, 1, 2, 1]; st.arp = deg(tones[pat[i / 2]] , 0); }
          if (i === 0 || i === 8) st.bass = deg(root, -1); else if (i === 6 || i === 14) st.bass = deg(root + 4, -1); else if (i === 12 && rnd() < 0.5) st.bass = deg(root + 2, -1);
          if (i === 0) st.pad = tones.map(function (d) { return deg(d, 0); });
          if (!quiet) {
            if (i === 0 || i === 8 || (i === 10 && bar % 2)) st.kick = true;
            if (i === 4 || i === 12) st.snare = true;
            if (i % 2 === 0) st.shk = i % 4 === 0;
            if (bar === 7 && i >= 12) { st.snare = true; st.kick = false; }   // little fill
          }
          steps.push(st);
        }
      }
    });
    return OVERWORLD = { bpm: BPM, steps: steps };
  }
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
  // Bend the major world into its parallel minor as dread grows: flatten 3rds, 6ths and 7ths.
  function dreadify(n) {
    var pc = ((n - KEYPC) % 12 + 12) % 12;
    if (pc === 4 && Math.random() < dread * 1.6) return n - 1;
    if (pc === 9 && Math.random() < dread * 1.3) return n - 1;
    if (pc === 11 && Math.random() < dread) return n - 1;
    return n;
  }
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
    var open = style === 'space' || style === 'cave' || style === 'title', d = open ? 0 : dread, cut = 18000 - 14500 * Math.pow(d, 1.5), tc = quick ? 0.03 : 0.5;
    if (bossOn && !open) cut = Math.max(cut, 7500);           // a boss needs air: choir formants and cymbals live up there
    tone.frequency.setTargetAtTime(cut, now, tc);
    if (fbGain) fbGain.gain.setTargetAtTime(0.32 + 0.4 * d, now, tc);
    if (wetGain) wetGain.gain.setTargetAtTime(0.22 + 0.3 * d, now, tc);
  }

  function scheduleOverworld() {
    // tempo: a queasy slowdown to about 110 around dread 0.4, then an accelerating pulse to 160 by the end
    var song = composeOverworld(), bpm = dread < 0.4 ? song.bpm - 40 * dread : 110 + (dread - 0.4) / 0.6 * 50 + boost * 6;
    var spb = 60 / bpm / 4, now = AC.currentTime, grim = Math.max(0, (dread - 0.5) * 2);   // grim: 0..1 over the back half
    while (nextT < now - 0.05) { nextT += bossOn ? 60 / BOSS_BPM / 4 : spb; step++; if (bossOn) bossStep++; }   // the tab stalled: drop what is already late
    while (nextT < now + 0.3) {
      var st = song.steps[step % song.steps.length], t = nextT, i16 = step % 16;
      // --- the boss layer joins and leaves on a bar line; while it is on, it owns the tempo and the harmony
      if (i16 === 0 && bossWant !== bossOn) { bossOn = bossWant; bossStep = 0; applyTone(t, false); }
      if (bossOn) { var bs = 60 / BOSS_BPM / 4; scheduleBossStep(t, bs); nextT += bs; step++; bossStep++; continue; }
      if (bossWant) timp(43, t, 0.3 + 0.7 * i16 / 15, true);      // it is coming: a roll up to the bar line
      // --- the tune, thinning out as things go wrong
      if (st.mel && Math.random() > grim * 0.6) {
        var d = st.mel.len * spb, v = st.mel.vel * (st.quiet ? 0.7 : 1) * (1 - grim * 0.4), n = dreadify(st.mel.n);
        if (dread > 0.55 && Math.random() < dread - 0.3) ocarina(n - (grim > 0.5 && Math.random() < 0.3 ? 12 : 0), t, d * 0.95, v * 0.9);
        else if (st.voice === 'marimba') marimba(n, t, d, v); else if (st.voice === 'bell') bell(n, t, d, v); else ocarina(n, t, d * 0.95, v);
      }
      if (st.harm && dread < 0.7) bell(dreadify(st.harm), t, spb * 3, 0.5);
      if (st.arp && Math.random() > dread * 0.6) marimba(dreadify(st.arp), t, spb * 1.8, 0.35 * (1 - grim * 0.5));
      if (st.bass) bass(st.bass, t, spb * 2, 0.8 + 0.3 * dread);
      if (st.pad) pad(st.pad.map(dreadify), t, spb * 16, (st.quiet ? 1.4 : 1) * (1 + dread));
      // --- the things underneath
      if (i16 === 0 && dread > 0.2) drone(67 - 24, t, spb * 16, dread);
      if (i16 === 8 && dread > 0.65) drone(67 - 24 + 6, t, spb * 8, (dread - 0.6) * 1.5);   // the tritone arrives
      // industrial pulse: palm-muted root stabs on the off-8ths, then every 8th, then a gallop
      if (grim > 0) {
        var root = 43, stab = (i16 % 2 === 0), gallop = grim > 0.7 && (i16 % 4 === 3);
        if (stab && Math.random() < grim) chug(root, t, spb * 0.9, true);
        if (gallop) chug(root, t, spb * 0.9, true);
        if (i16 === 12 && grim > 0.5 && Math.random() < 0.5) chug(root + 6, t, spb * 2, false);          // tritone hit
        if (i16 === 6 && grim > 0.8 && Math.random() < 0.4) lead(root + 30 + (Math.random() < 0.5 ? 0 : 1), t, spb * 3);   // a dissonant shriek
      }
      // --- drums: brushes to boots
      if (st.kick) { if (grim > 0.3) kick(t); else if (dread > 0.5 && i16 === 0) heartbeat(t); else softKick(t); }
      if (grim > 0.5 && (i16 === 0 || i16 === 8 || (i16 === 10 && grim > 0.8))) kick(t);
      if (st.snare) { if (grim > 0.4) snare(t); else if (Math.random() > dread * 0.7) brush(t); }
      if (st.shk !== undefined && dread < 0.6) shaker(t, st.shk);
      if (grim > 0.6 && i16 % 2 === 0) hat(t, i16 === 14);
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
  function tRumble(t, dur) {   // the tremor under bar 14: a sub that climbs and shakes faster as it goes
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

  /* --- the title piece: A minor, 128 BPM, 20 scored bars then a 40-bar loop --
     The 20 bars are the cinematic (intro.js), beat for beat: every cut in that
     film lands on a bar line, so every bar below is captioned with the frame it
     is under. After bar 19 the piece turns into a 40-bar loop (75 s) that ends
     on the dominant and resolves back into bar 20 — never into bar 0's silence.
     The acid line is written as scale degrees and shifted per chord (a triad is
     three scale steps apart, so shifting the whole pattern by `sh` re-reads the
     same riff through the new chord), which is how it can pedal and still move. */
  var TITLE = null, TITLE_INTRO_BARS = 20, TITLE_LOOP_BARS = 40;
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
    // s stabs · sv stab velocity · l lead phrase · p pad · hv hoover · lg the laugh · e one-shots
    var BARS = [
      /* 0  0.000  black      */ { ch:'Am', dr:'none',   e:[[0,'coin'],[0,'sub',1],[0,'rise',16,0.1]] },
      /* 1  1.875  fadeup     */ { ch:'Am', dr:'pulse',  p:0.55, e:[[0,'crash',0.3]] },
      /* 2  3.750             */ { ch:'Am', dr:'pulse2', p:0.55 },
      /* 3  5.625  line1      */ { ch:'Am', dr:'four',   b:'I', p:0.5, e:[[0,'stab',0.55]] },
      /* 4  7.500             */ { ch:'F',  dr:'four',   b:'I', p:0.5 },
      /* 5  9.375  line2      */ { ch:'Am', dr:'four',   b:'P', a:'C', c:0.1,  s:'off', p:0.45, lv:0.8, e:[[0,'stab',0.6]] },
      /* 6  11.250            */ { ch:'F',  dr:'four',   b:'P', a:'C', c:0.16, s:'off', p:0.45, lv:0.8 },
      /* 7  13.125 photo      */ { ch:'Am', dr:'house',  b:'P', a:'C', c:0.24, s:'off', p:0.4, lv:0.86, e:[[0,'stab',0.85]] },
      /* 8  15.000            */ { ch:'G',  dr:'house',  b:'P', a:'A', c:0.34, s:'off', p:0.4, lv:0.86 },
      /* 9  16.875            */ { ch:'Am', dr:'houseF', b:'P', a:'B', c:0.44, s:'off', p:0.35, lv:0.9, e:[[12,'rise',4,0.3]] },
      /* 10 18.750 photoOut   */ { ch:'Am', dr:'break',  b:'L', p:0.3, lv:0.8, gp:1, e:[[0,'fall',0.9,0.38],[0,'crash',0.4],[8,'rise',7,0.38]] },
      /* 11 20.625 institute  */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.72, s:'down', sv:1.15, e:[[0,'crash',0.9],[0,'sub',0.8]] },
      /* 12 22.500            */ { ch:'Am', dr:'house',  b:'D', a:'B', c:0.72, s:'off' },
      /* 13 24.375 line5      */ { ch:'F',  dr:'house',  b:'D', a:'A', c:0.8,  s:'down', e:[[14,'tom',150]] },
      /* 14 26.250 rumble     */ { ch:'E',  dr:'roll',   b:'I', a:'A', c:0.35, c2:1, lv:0.85, gp:1, e:[[0,'rumble',15],[0,'rise',15,0.42]] },
      /* 15 28.125 MR. E      */ { ch:'Am', dr:'houseF', b:'D', a:'E', c:1,    s:'down', sv:1.2, hv:1.15, e:[[0,'crash',1],[0,'sub',1]] },
      /* 16 30.000 name       */ { ch:'Am', dr:'houseF', b:'D', a:'E', c:0.95, s:'down', hv:0.85, e:[[0,'tom',110],[8,'stab',0.85]] },
      /* 17 31.875 laugh      */ { ch:'Am', dr:'house',  b:'D', c:0.9, lg:1, e:[[0,'tom',150],[4,'tom',130],[8,'tom',110],[12,'tom',95]] },
      /* 18 33.750 LOGO SLAM  */ { ch:'Am', dr:'houseF', b:'D', a:'E', c:1, s:'down', sv:1.35, hv:1.3, e:[[0,'crash',1],[0,'sub',1]] },
      /* 19 35.625 settle     */ { ch:'Am', dr:'fill',   b:'P', a:'B', c:0.6, s:'off', p:0.6, lv:0.88, e:[[0,'stab',0.7],[12,'rise',4,0.4]] },
      /* --- 37.500: the loop. 40 bars, 75 s, turning back into this bar ------ */
      /* 20 */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.62, s:'down', e:[[0,'crash',0.7]] },
      /* 21 */ { ch:'Am', dr:'house',  b:'D', a:'B', c:0.66, s:'off' },
      /* 22 */ { ch:'F',  dr:'house',  b:'D', a:'A', c:0.7,  s:'off' },
      /* 23 */ { ch:'G',  dr:'house',  b:'D', a:'B', c:0.74, s:'off', e:[[14,'tom',150]] },
      /* 24 */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.78, s:'down' },
      /* 25 */ { ch:'Am', dr:'house',  b:'D', a:'B', c:0.82, s:'off' },
      /* 26 */ { ch:'F',  dr:'house',  b:'D', a:'A', c:0.86, s:'off' },
      /* 27 */ { ch:'E',  dr:'houseF', b:'D', a:'B', c:0.9,  s:'off', e:[[8,'rise',8,0.35]] },
      /* 28 */ { ch:'Am', dr:'house',  b:'P', a:'A', c:0.6,  s:'off', l:0, e:[[0,'crash',0.55]] },
      /* 29 */ { ch:'F',  dr:'house',  b:'P', a:'B', c:0.6,  s:'off', l:1 },
      /* 30 */ { ch:'C',  dr:'house',  b:'P', a:'A', c:0.64, s:'off', l:2 },
      /* 31 */ { ch:'G',  dr:'house',  b:'P', a:'B', c:0.68, s:'off', l:3, e:[[14,'tom',150]] },
      /* 32 */ { ch:'Am', dr:'house',  b:'P', a:'A', c:0.7,  s:'off', l:4 },
      /* 33 */ { ch:'F',  dr:'house',  b:'P', a:'B', c:0.72, s:'off', l:5 },
      /* 34 */ { ch:'E',  dr:'house',  b:'P', a:'A', c:0.74, s:'off', l:6 },
      /* 35 */ { ch:'E',  dr:'houseF', b:'P', a:'B', c:0.76, s:'off', l:7, e:[[8,'rise',8,0.4]] },
      /* 36 */ { ch:'Dm', dr:'break',  b:'L', a:'D', c:0.25, p:0.5, e:[[0,'fall',0.9,0.4]] },
      /* 37 */ { ch:'Dm', dr:'break',  b:'L', a:'D', c:0.35, p:0.5 },
      /* 38 */ { ch:'Am', dr:'break',  b:'L', a:'D', c:0.45, p:0.5 },
      /* 39 */ { ch:'Am', dr:'break',  b:'L', a:'D', c:0.55, p:0.5 },
      /* 40 */ { ch:'F',  dr:'pulse2', b:'L', a:'D', c:0.65, s:'off', p:0.4 },
      /* 41 */ { ch:'F',  dr:'pulse2', b:'L', a:'D', c:0.75, s:'off', p:0.4 },
      /* 42 */ { ch:'E',  dr:'four',   b:'P', a:'D', c:0.85, s:'off', p:0.3, e:[[0,'rise',16,0.4]] },
      /* 43 */ { ch:'E',  dr:'roll',   b:'P', a:'D', c:0.5, c2:1, p:0.2, gp:1, e:[[0,'rise',15,0.45]] },
      /* 44 */ { ch:'Am', dr:'houseF', b:'D', a:'E', c:1,    s:'down', l:0, hv:0.8, e:[[0,'crash',0.9]] },
      /* 45 */ { ch:'F',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:1 },
      /* 46 */ { ch:'C',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:2 },
      /* 47 */ { ch:'G',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:3, e:[[14,'tom',150]] },
      /* 48 */ { ch:'Am', dr:'houseF', b:'D', a:'E', c:0.95, s:'down', l:4, hv:0.8 },
      /* 49 */ { ch:'F',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:5 },
      /* 50 */ { ch:'E',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:6 },
      /* 51 */ { ch:'E',  dr:'houseF', b:'D', a:'E', c:0.95, s:'off', l:7, e:[[8,'rise',8,0.4]] },
      /* 52 */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.8,  s:'down', e:[[0,'crash',0.6]] },
      /* 53 */ { ch:'Am', dr:'house',  b:'D', a:'B', c:0.8,  s:'off' },
      /* 54 */ { ch:'F',  dr:'house',  b:'D', a:'A', c:0.84, s:'off' },
      /* 55 */ { ch:'G',  dr:'house',  b:'D', a:'B', c:0.84, s:'off', e:[[14,'tom',150]] },
      /* 56 */ { ch:'Am', dr:'house',  b:'D', a:'A', c:0.88, s:'down', l:4 },
      /* 57 */ { ch:'F',  dr:'house',  b:'D', a:'B', c:0.88, s:'off', l:5 },
      /* 58 */ { ch:'E',  dr:'house',  b:'D', a:'A', c:0.9,  s:'off', l:6 },
      /* 59 */ { ch:'E',  dr:'fill',   b:'D', a:'B', c:0.95, s:'off', l:7, e:[[8,'rise',8,0.5]] }
    ];
    function drums(kind, i, odd, st) {
      var h = null;
      if (kind === 'pulse') { if (i === 0 || i === 8) st.kk = 0.6; if (i === 4 || i === 12) h = 0.3; }
      else if (kind === 'pulse2') { if (i % 4 === 0) st.kk = 0.72; if (i % 4 === 2) h = 0.36; }
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
        if (B.lg) {   // the four laugh bursts, on the quarter note, walking down A G F E
          var LGH = { 0: [[57,60,64], 1.15], 4: [[55,59,62], 1], 8: [[53,57,60], 1.05], 12: [[52,56,59], 1.2] };
          if (LGH[i]) st.hv = { notes: LGH[i][0], len: 3.4, vel: LGH[i][1] };
        }
        // a build that runs right up to the drop masks it, and leaves the limiter clamped down
        // over the very hit it is building to. Empty the last sixteenths instead: the silence
        // lets the compressor breathe out, and the drop arrives into a hole.
        if (B.gp && i >= 16 - B.gp) { st.kk = 0; st.sn = 0; st.cp = 0; st.tm = 0; st.ht = null; st.bs = null; st.ac = null; st.sb = null; }
        if (B.lv) {   // the film is still talking: the groove sits under the hits that are coming
          if (st.kk) st.kk *= B.lv;
          if (st.sn) st.sn *= B.lv;
          if (st.cp) st.cp *= B.lv;
          if (st.ht) st.ht = { v: st.ht.v * B.lv, o: st.ht.o };
          if (st.bs) st.bs.vel *= B.lv;
          if (st.ac) st.ac.vel *= B.lv;
          if (st.sb) st.sb.vel *= B.lv;
          if (st.pd) st.pd.vel *= B.lv;
        }
        (ev[i] || []).forEach(function (e) {
          if (e[1] === 'coin') st.cn = 1;
          else if (e[1] === 'sub') st.su = e[2];
          else if (e[1] === 'crash') st.cr = e[2];
          else if (e[1] === 'rise') st.ri = { len: e[2], v: e[3] };
          else if (e[1] === 'fall') st.fa = { d: e[2], v: e[3] };
          else if (e[1] === 'rumble') st.rm = e[2];
          else if (e[1] === 'tom') st.tm = e[2];
          else if (e[1] === 'stab') st.sb = { notes: ch.tri, len: 2.2, vel: e[2] };
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
      // the scored 20 bars play once; after them the piece wraps inside the loop, never back into bar 0
      var j = step < song.introSteps ? step : song.introSteps + (step - song.introSteps) % song.loopSteps;
      var st = song.steps[j], t = nextT, sw = (j % 2) ? swg : 0;
      if (st.cn) tCoin(t);
      if (st.su) tSub(t, st.su);
      if (st.cr) tCrash(t, st.cr);
      if (st.ri) tRise(t, st.ri.len * spb, st.ri.v);
      if (st.fa) tFall(t, st.fa.d, st.fa.v);
      if (st.rm) tRumble(t, st.rm * spb);
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
    // home: the first bar of the overworld tune at walking pace, its cadence bar over ii-V, and G major left ringing
    ending: function (t) {
      var wet = stingOut(true), song = composeOverworld(), sp = 0.14;
      duckFor(0, 6.0, 1.2);
      function mar(n, at, len, v) { sTone('sine', f(n), at, Math.max(0.5, len), v * 0.3, 0.004, wet); sTone('sine', f(n) * 4, at, 0.12, v * 0.06, 0.002, wet); }
      function padc(notes, at, len, v) { notes.forEach(function (n, k) { var o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = f(n); o.detune.value = k * 4 - 6; lp.type = 'lowpass'; lp.frequency.value = 1100; g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(v * 0.07, at + 0.3); g.gain.setValueAtTime(v * 0.07, at + Math.max(0.35, len - 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.6); o.connect(lp); lp.connect(g); g.connect(wet); o.start(at); o.stop(at + len + 0.7); }); }
      [0, 7].forEach(function (bar, k) { for (var i = 0; i < 16; i++) { var m = song.steps[bar * 16 + i].mel; if (m) mar(m.n, t + (k * 16 + i) * sp, m.len * sp * 1.6, m.vel); } });
      padc([55, 59, 62, 67], t, 16 * sp, 1); sTone('triangle', f(43), t, 16 * sp, 0.2, 0.02, wet);
      padc([57, 60, 64, 69], t + 16 * sp, 8 * sp, 1); sTone('triangle', f(45), t + 16 * sp, 8 * sp, 0.2, 0.02, wet);
      padc([57, 60, 62, 66], t + 24 * sp, 8 * sp, 1); sTone('triangle', f(38), t + 24 * sp, 8 * sp, 0.2, 0.02, wet);
      var e = t + 32 * sp;
      padc([55, 59, 62, 67, 71], e, 1.6, 1.2); sTone('triangle', f(43), e, 2.4, 0.26, 0.02, wet);
      [67, 71, 74, 79, 83].forEach(function (n, k) { var at = e + k * 0.13; [1, 2.76, 5.4].forEach(function (r, j) { sTone('sine', f(n) * r, at, 1.9 - j * 0.5, [0.2, 0.06, 0.02][j], 0.003, wet); }); });
    }
  };

  /* --- API ---------------------------------------------------------------- */
  var live = [];   // every music voice, so stop() can actually stop them (stingers are exempt)
  function track(ac) {
    ['createOscillator', 'createBufferSource'].forEach(function (k) {
      var mk = ac[k].bind(ac);
      ac[k] = function () { var n = mk(); if (!inSting) live.push({ n: n, born: ac.currentTime }); return n; };
    });
  }
  function prune() { var now = AC.currentTime, k = 0; while (k < live.length && now - live[k].born > 9) k++; if (k) live.splice(0, k); }
  function tick() { try { if (parked) return; prune(); if (style === 'space') scheduleSpace(); else if (style === 'cave') scheduleCave(); else if (style === 'title') scheduleTitle(); else scheduleOverworld(); } catch (e) { if (window.console) console.error(e); } }
  var Riff = {
    get playing() { return playing; },
    get style() { return style; },
    play: function (st) {
      var fresh = !AC; ctx(); if (fresh) track(AC);
      if (AC.state === 'suspended') AC.resume();
      st = st || 'quest';
      if (playing && style === st) return;
      Riff.stop(); style = lastStyle = st; playing = true; step = 0; bossOn = bossWant && st !== 'space' && st !== 'cave' && st !== 'title'; bossStep = 0;
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
    // one-shots: 'impact' | 'victory' | 'launch' | 'ending'. Unknown names are ignored. Work with the music stopped.
    stinger: function (name) {
      if (!Object.prototype.hasOwnProperty.call(STINGERS, name)) return;
      var fresh = !AC; ctx(); if (fresh) track(AC);
      if (AC.state === 'suspended') AC.resume();
      inSting = true; try { STINGERS[name](AC.currentTime + 0.03); } finally { inSting = false; }
    },
    // tell the ♫ button which track it should start next, without starting it (for when the player has the music off)
    cue: function (st) { if (st) lastStyle = st; },
    takeover: function (on) { boost = on ? 1 : 0; },
    get metal() { return boost > 0; },
    get dread() { return dread; },
    info: function () {
      var s = composeOverworld(), sp = composeSpace(), b = composeBoss(), cv = composeCave(), ti = composeTitle(),
          secs = function (x) { return Math.round(x.steps.length * 60 / x.bpm / 4); },
          caveSecs = Math.round(cv.steps.length * 60 / cv.bpm / 12);   // the cave grid is twelfths, not sixteenths
      return { steps: s.steps.length, seconds: secs(s), notes: s.steps.filter(function (x) { return x.mel; }).length,
        spaceSeconds: secs(sp), space: { steps: sp.steps.length, bars: sp.steps.length / 16, bpm: sp.bpm, seconds: secs(sp), notes: sp.steps.filter(function (x) { return x.lead; }).length },
        boss: { steps: b.steps.length, bars: b.steps.length / 16, bpm: b.bpm, seconds: secs(b) },
        caveSeconds: caveSecs, cave: { steps: cv.steps.length, bars: cv.bars, bpm: cv.bpm, seconds: caveSecs, notes: cv.steps.filter(function (x) { return x && x.mel; }).length },
        titleSeconds: secs(ti), title: { steps: ti.steps.length, bars: ti.bars, bpm: ti.bpm, seconds: secs(ti),
          introBars: ti.introSteps / 16, introSeconds: +(ti.introSteps * 60 / ti.bpm / 4).toFixed(3),
          loopBars: ti.loopSteps / 16, loopSeconds: +(ti.loopSteps * 60 / ti.bpm / 4).toFixed(3),
          notes: ti.steps.filter(function (x) { return x.ac; }).length } };
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
