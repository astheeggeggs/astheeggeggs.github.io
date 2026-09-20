/* =============================================================================
   RIFF.JS — procedurally generated chip-metal. No samples, no MIDI files,
   no copyright: every note is synthesised in WebAudio at runtime.
   Riff.play('quest'), Riff.stop(), Riff.toggle(style), Riff.setDread(0..1), Riff.playing
   ============================================================================= */
(function () {
  'use strict';
  var AC = null, master = null, tone = null, dist = null, timer = null, playing = false, style = null;
  var dread = 0, fbGain = null, wetGain = null, KEYPC = 67 % 12;
  var owMix = null, metalMix = null, boost = 0, mstep = 0;
  var step = 0, nextT = 0, buttons = [];
  var gate = null, duck = null, stingBus = null, lastStyle = null;
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
  function curve(k) { var n = 1024, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
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
        var a = (mute ? 0.55 : 0.35) * (lean ? 1.7 : 1), d = mute ? Math.min(dur, 0.11) : dur;
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
  var noiseBuf = null;
  function noise() { if (noiseBuf) return noiseBuf; var b = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noiseBuf = b; }
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
  function env(g, t, a, peak, d, sus, dur, rel) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0002, peak * sus), t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  }
  function marimba(note, t, dur, vel) {
    var o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), g2 = AC.createGain();
    o.type = 'sine'; o.frequency.value = f(note); o2.type = 'sine'; o2.frequency.value = f(note) * 4.0;
    env(g, t, 0.003, vel * 0.5, 0.25, 0.08, Math.min(dur, 0.5), 0.15); env(g2, t, 0.002, vel * 0.12, 0.06, 0.01, 0.08, 0.05);
    o.connect(g); o2.connect(g2); g.connect(softBus()); g2.connect(softBus()); o.start(t); o2.start(t); o.stop(t + dur + 0.4); o2.stop(t + 0.3);
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
      env(g, t, 0.002, vel * [0.35, 0.12, 0.05][i], 0.4 / (i + 1), 0.05, Math.min(dur, 0.9), 0.3);
      o.connect(g); g.connect(softBus()); o.start(t); o.stop(t + dur + 0.6);
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
      env(g, t, 0.8, vel * [0.16, 0.06, 0.04][i], 0.5, 0.9, dur - 0.5, 1.2);
      o.connect(lp); lp.connect(g); g.connect(owMix); o.start(t); o.stop(t + dur + 1.5);
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
    var out = AC.createGain(); out.gain.value = 0.3; out.connect(master);
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
    var out = AC.createGain(); out.gain.value = 2.4; out.connect(master); out.connect(hall());
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
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.7, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    o.connect(g); g.connect(metalMix); g.connect(hall()); o.start(t); o.stop(t + d + 0.02);
    if (!roll) {
      var o2 = AC.createOscillator(), g2 = AC.createGain(); o2.type = 'triangle'; o2.frequency.value = fr * 1.5;
      g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(vel * 0.16, t + 0.004); g2.gain.exponentialRampToValueAtTime(0.0008, t + 0.5);
      o2.connect(g2); g2.connect(metalMix); o2.start(t); o2.stop(t + 0.52);
    }
    var s = AC.createBufferSource(), sg = AC.createGain(), lp = AC.createBiquadFilter(); s.buffer = noise(); lp.type = 'lowpass'; lp.frequency.value = 700;
    sg.gain.setValueAtTime(vel * (roll ? 0.2 : 0.4), t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.06); s.connect(lp); lp.connect(sg); sg.connect(metalMix); s.start(t); s.stop(t + 0.08);
  }
  function brass(notes, t, dur, vel, stab) {   // low brass: saws behind a low-pass that opens as the players lean in
    var lp = AC.createBiquadFilter(), g = AC.createGain(), top = 500 + 1300 * vel, pk = stab ? 0.03 : dur * 0.62;
    lp.type = 'lowpass'; lp.Q.value = 1.4; lp.frequency.setValueAtTime(stab ? top : 160, t); if (!stab) lp.frequency.linearRampToValueAtTime(top, t + pk); lp.frequency.exponentialRampToValueAtTime(240, t + dur + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * (stab ? 0.2 : 0.17), t + pk); g.gain.setValueAtTime(vel * (stab ? 0.2 : 0.17), t + Math.max(pk, dur * 0.8)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    lp.connect(g); g.connect(metalMix); g.connect(hall());
    notes.forEach(function (n, k) {
      (k ? [4] : [-7, 7]).forEach(function (det) { var o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f(n); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.3); });
    });
  }
  function tubular(note, t, vel) {   // tubular bell: stretched partials with the minor-third "church" partial at 2.4
    [[1, 0.5, 3.6], [2, 0.34, 2.8], [2.4, 0.2, 2.2], [3, 0.2, 1.7], [4.5, 0.1, 1.1], [6.3, 0.05, 0.7]].forEach(function (p) {
      var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f(note) * p[0];
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * p[1] * 0.5, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + p[2]);
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
    if (i16 === 0 || i16 === 8) bass(st.root, t, spb * 8, 1.1);
    // the gallop and the boots stay, now following the harmony
    if (full) {
      if (i16 % 2 === 0 || i16 % 4 === 3) chug(st.root, t, spb * 0.9, true, true);
      if (i16 === 0 || i16 === 8 || i16 === 10 || (st.bar % 2 && i16 >= 14)) kick(t);
      if (i16 === 4 || i16 === 12 || (st.last && i16 >= 10 && i16 % 2 === 0) || (st.last && i16 >= 13)) snare(t);
      if (i16 % 2 === 0) hat(t, i16 === 14);
    } else {
      if (i16 === 0 || i16 === 8) chug(st.root, t, spb * 0.9, true, true);
      if (st.last && i16 >= 8) { snare(t); if (i16 % 2 === 0) kick(t); }
    }
  }
  function applyTone(now, quick) {
    if (!AC) return;
    var space = style === 'space', d = space ? 0 : dread, cut = 18000 - 14500 * Math.pow(d, 1.5), tc = quick ? 0.03 : 0.5;
    if (bossOn && !space) cut = Math.max(cut, 7500);           // a boss needs air: choir formants and cymbals live up there
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
      if (window.__riffLog) window.__riffLog.push([step, bossOn ? bossStep : -1, t, AC.currentTime]); /*TEMP*/
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
    var s = AC.createBufferSource(), hp = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noise(); s.loop = true; hp.type = 'highpass'; hp.frequency.value = 4500;
    g.gain.setValueAtTime(0.3 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5); s.connect(hp); hp.connect(g); g.connect(metalMix); s.start(t); s.stop(t + 1.55);
  }
  function riser(t, dur, v) {   // the build: band-passed noise climbing four octaves
    var s = AC.createBufferSource(), bp = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noise(); s.loop = true; bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    s.connect(bp); bp.connect(g); g.connect(metalMix); s.start(t); s.stop(t + dur + 0.1);
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
      if (window.__riffLog) window.__riffLog.push([step, step % n, t, AC.currentTime]); /*TEMP*/
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
    var s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noise(); s.loop = true; fl.type = kind; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.05); return g;
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
  function tick() { try { prune(); if (style === 'space') scheduleSpace(); else scheduleOverworld(); } catch (e) { if (window.console) console.error(e); } }
  var Riff = {
    get playing() { return playing; },
    get style() { return style; },
    play: function (st) {
      var fresh = !AC; ctx(); if (fresh) track(AC);
      if (AC.state === 'suspended') AC.resume();
      st = st || 'quest';
      if (playing && style === st) return;
      Riff.stop(); style = lastStyle = st; playing = true; step = 0; bossOn = bossWant && st !== 'space'; bossStep = 0;
      var now = AC.currentTime; nextT = now + 0.12;
      gate.gain.setTargetAtTime(1, now + 0.07, 0.01);           // stop() above has just shut the gate; open it again once the old voices are gone
      duck.gain.cancelScheduledValues(now); duck.gain.setTargetAtTime(1, now, 0.15);
      applyTone(now, true);                                     // space: filter fully open, dread ignored. quest: whatever dread says
      if (bossOn) vowel('ooh', now, 0.01);
      timer = setInterval(tick, 100); tick(); sync();
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
      var s = composeOverworld(), sp = composeSpace(), b = composeBoss(), secs = function (x) { return Math.round(x.steps.length * 60 / x.bpm / 4); };
      return { steps: s.steps.length, seconds: secs(s), notes: s.steps.filter(function (x) { return x.mel; }).length,
        spaceSeconds: secs(sp), space: { steps: sp.steps.length, bars: sp.steps.length / 16, bpm: sp.bpm, seconds: secs(sp), notes: sp.steps.filter(function (x) { return x.lead; }).length },
        boss: { steps: b.steps.length, bars: b.steps.length / 16, bpm: b.bpm, seconds: secs(b) } };
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
  document.addEventListener('visibilitychange', function () { if (document.hidden && playing) Riff.stop(); });
  Riff.__dbg = function () { return { step: step, nextT: nextT, bossOn: bossOn, bossWant: bossWant, bossStep: bossStep, live: live.length, now: AC ? AC.currentTime : 0, tone: tone ? tone.frequency.value : 0, gate: gate ? gate.gain.value : -1, duck: duck ? duck.gain.value : -1 }; }; /*TEMP*/
  Riff.__short = function (a, b) { var sp = composeSpace(); sp.steps = sp.steps.slice(0, a).concat(sp.steps.slice(sp.steps.length - b)); return sp.steps.length; }; /*TEMP*/
  window.Riff = Riff;
})();
