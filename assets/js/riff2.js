/* =============================================================================
   RIFF2.JS — the second loop's music, plugged into riff.js's synth through
   Riff.addStyle / Riff.addStinger / Riff.kit. Nothing here touches riff.js;
   everything is synthesised at runtime (no samples, no MIDI files).
     Riff.play('magician')  the loop-2 boss: REVIEWER 2 — TYPE 0002. Industrial techno-rock in D minor
                            at 170, the four-note teleport motif on a drawbar organ, the kit's chug through
                            the distortion bus, hoovers, a wailing lead, a choir-and-timpani breakdown.
                            Its first downbeat lands on the crack of the 'reveal' stinger (see CUE).
     Riff.play('space2')    the shooter's second loop: hard trance in E minor at 155 — rolling sixteenth
                            bass, supersaw stabs, a 303, snare builds and sweeps, a lead that lifts.
                            Shares the first loop's key, its Em-C-D-B ground, its arpeggio, its
                            B-C-C#-D# turnaround and its main theme: the break remembers the theme's first
                            half in the first loop's own voice, and the anthem brings the whole of it back
                            in octaves, so it reads as the same game turned up.
     Riff.play('tlb')       the True Last Boss: E minor at 178, sixteenth arpeggios over a chromatic
                            bass, diminished and augmented chords, choir, breakneck hats, a riser every
                            eight bars and no relief.
     Riff.stinger('reveal' | 'tenure' | 'tlbwarn')   one-shots on riff.js's stinger bus (work with the music off)
   Each track is composed once from fixed tables and loops seamlessly after its intro (two bars for the
   magician and the True Last Boss, whose entrances are short). Played again on the same page (a retry, a
   continue, the next stage) a track skips its intro and comes back in at the next section that opens on a
   crash after the point where it stopped. Every level is in one table (MIX). At load this file only
   registers: no AudioContext exists until something plays.
   ============================================================================= */
(function () {
  'use strict';
  var R = window.Riff;
  if (!R || typeof R.addStyle !== 'function' || typeof R.addStinger !== 'function' || typeof R.kit !== 'function') return;

  /* --- plumbing ------------------------------------------------------------
     enter(name) fetches the kit (which owns the AudioContext) and points D (dry)
     and W (a tempo-locked dotted-eighth echo) at that track's bus into riff.js's
     master, ahead of its limiter. Buses and waves are kept per AudioContext in a
     WeakMap: the live context's graph is never evicted, and each OfflineAudioContext
     that Riff.render makes gets its own, which goes when that context does. */
  var K = null, AC = null, D = null, W = null, M = null, CTX = null, CTXS = new WeakMap();
  // The mixing desk: each track's bus gain into master, then a linear gain per voice on that bus (1 when not listed).
  // Set from solo renders through Riff.render: the lead (or, where there is none, the hook: the 303, the arpeggios)
  // sits within ~3 dB of the bass and above every other melodic line; the bus gain puts the limiter no harder at work
  // than on the title track.
  var MIX = {
    magician: { bus: 2.2, kick: 0.8, lead: 1.7, organ: 1.8, hoover: 1.8 },
    space2: { bus: 1.95, bass: 0.55, lead: 2, stab: 1.6, acid: 2.8, arp: 2, pad: 1.2, dbl: 0.7 },
    tlb: { bus: 1.65, bass: 0.55, lead: 1.9, stab: 1.5, arp: 3.6, hoover: 1.6, choir: 0.85 },
    sting: {}
  };
  Object.keys(MIX).forEach(function (k) { ['bus', 'kick', 'snare', 'hat', 'bass', 'lead', 'dbl', 'stab', 'acid', 'arp', 'pad', 'organ', 'hoover', 'choir', 'timp'].forEach(function (v) { if (MIX[k][v] === undefined) MIX[k][v] = 1; }); });
  function f(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function enter(name, bpm) {
    K = R.kit(); AC = K.AC;
    CTX = CTXS.get(AC); if (!CTX) { CTX = { bus: {}, wave: {} }; CTXS.set(AC, CTX); }
    M = MIX[name];
    if (name === 'sting') { D = K.stingOut(false); W = K.stingOut(true); return; }
    var b = CTX.bus[name];
    if (!b) {
      b = { dry: AC.createGain(), wet: AC.createGain() };
      b.dry.gain.value = M.bus; b.dry.connect(K.master);
      var d = AC.createDelay(1.0), fb = AC.createGain(), lp = AC.createBiquadFilter(), w = AC.createGain();
      d.delayTime.value = 60 / bpm / 4 * 3; fb.gain.value = 0.34; lp.type = 'lowpass'; lp.frequency.value = 3200; w.gain.value = 0.3;
      b.wet.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(w); w.connect(b.dry);
      CTX.bus[name] = b;
    }
    D = b.dry; W = b.wet;
  }
  function out(g, wet) { g.connect(D); if (wet) g.connect(W); }
  function wave(name) {   // periodic waves, cached per context
    if (CTX.wave[name]) return CTX.wave[name];
    var n = 24, re = new Float32Array(n), im = new Float32Array(n), k;
    if (name === 'organ') { var DRAW = [1, 0.85, 0.5, 0.6, 0.3, 0.25, 0.15, 0.12]; for (k = 1; k <= 8; k++) im[k] = DRAW[k - 1]; }
    else { var duty = name === 'p25' ? 0.25 : 0.125; for (k = 1; k < n; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty); }
    return CTX.wave[name] = AC.createPeriodicWave(re, im);
  }
  function env(g, t, a, peak, d, sus, dur, rel) { return K.env(g, t, a, peak, d, sus, dur, rel); }
  function pluck(g, t, peak, dur, sus, rel) { K.pluck(g, t, peak, dur, sus, rel); }
  function osc(type, fr, t, end, det) { var o = AC.createOscillator(); if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type); o.frequency.value = fr; if (det) o.detune.value = det; o.start(t); o.stop(end); return o; }
  function lfo(t, end, hz, depth, delay, ramp) {   // vibrato source: returns the gain to connect to detune
    var v = AC.createOscillator(), g = AC.createGain(); v.frequency.value = hz;
    g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(0, t + (delay || 0)); g.gain.linearRampToValueAtTime(depth, t + (delay || 0) + (ramp || 0.2));
    v.connect(g); v.start(t); v.stop(end); return g;
  }
  function burst(t, dur, peak, type, fr, q, dest) {   // one filtered noise hit
    var s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = K.noise(); fl.type = type; fl.frequency.value = fr; fl.Q.value = q || 0.7;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(fl); fl.connect(g); g.connect(dest || D); s.start(t); s.stop(t + dur + 0.02);
  }

  /* --- the drum kit: one set, velocity-scaled, dry ------------------------ */
  function kick(t, v, hard) {   // sine drop with a click; `hard` is the industrial one: faster drop, a square knock on the front
    v *= M.kick; var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(hard ? 190 : 150, t); o.frequency.exponentialRampToValueAtTime(hard ? 52 : 48, t + (hard ? 0.035 : 0.05)); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.62, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + (hard ? 0.22 : 0.3));
    o.connect(g); g.connect(D); o.start(t); o.stop(t + 0.32);
    burst(t, 0.02, v * (hard ? 0.3 : 0.2), 'highpass', 1500, 0.7);
    if (hard) { var k = AC.createOscillator(), kg = AC.createGain(); k.type = 'square'; k.frequency.setValueAtTime(900, t); k.frequency.exponentialRampToValueAtTime(120, t + 0.02); kg.gain.setValueAtTime(v * 0.12, t); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.025); k.connect(kg); kg.connect(D); k.start(t); k.stop(t + 0.03); }
  }
  function snare(t, v) {
    v *= M.snare; var s = AC.createBufferSource(), hp = AC.createBiquadFilter(), bp = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = K.noise(); hp.type = 'highpass'; hp.frequency.value = 400; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.6;
    g.gain.setValueAtTime(v * 0.42, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(D); s.start(t); s.stop(t + 0.17);
    var o = AC.createOscillator(), og = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(215, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.05);
    og.gain.setValueAtTime(v * 0.26, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07); o.connect(og); og.connect(D); o.start(t); o.stop(t + 0.09);
  }
  function clap(t, v) {
    v *= M.snare; var bp = AC.createBiquadFilter(), g = AC.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.1; g.gain.value = v * 0.34; bp.connect(g); g.connect(D);
    [0, 0.009, 0.019, 0.03].forEach(function (d, k) {
      var s = AC.createBufferSource(), sg = AC.createGain(); s.buffer = K.noise();
      sg.gain.setValueAtTime(k === 3 ? 0.8 : 1, t + d); sg.gain.exponentialRampToValueAtTime(0.001, t + d + (k === 3 ? 0.14 : 0.014));
      s.connect(sg); sg.connect(bp); s.start(t + d); s.stop(t + d + 0.17);
    });
  }
  function hat(t, open, v) {
    v *= M.hat; var s = AC.createBufferSource(), hp = AC.createBiquadFilter(), pk = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = K.noise(); hp.type = 'highpass'; hp.frequency.value = 8200; pk.type = 'peaking'; pk.frequency.value = 11500; pk.gain.value = 6; pk.Q.value = 1.2;
    g.gain.setValueAtTime(v * (open ? 0.17 : 0.13), t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.19 : 0.035));
    s.connect(hp); hp.connect(pk); pk.connect(g); g.connect(D); s.start(t); s.stop(t + (open ? 0.22 : 0.06));
  }
  function ride(t, v) { v *= M.hat; burst(t, 0.3, v * 0.1, 'highpass', 6000, 0.5); var o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.value = 5273; g.gain.setValueAtTime(v * 0.025, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22); o.connect(g); g.connect(D); o.start(t); o.stop(t + 0.23); }
  function tom(t, fr, v) {
    v *= M.snare; var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(fr * 1.7, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.48, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(g); g.connect(D); o.start(t); o.stop(t + 0.28); burst(t, 0.04, v * 0.14, 'lowpass', 2600, 0.7);
  }
  function crash(t, v) {
    var s = K.loopNoise(), hp = AC.createBiquadFilter(), g = AC.createGain(); hp.type = 'highpass'; hp.frequency.value = 3800;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.24, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.6);
    s.connect(hp); hp.connect(g); g.connect(D); s.start(t, Math.random() * 2.5); s.stop(t + 1.65);
  }
  function rise(t, dur, v, hi) {   // band-passed noise climbing exponentially to `hi` Hz and level v over dur: the build
    var s = K.loopNoise(), bp = AC.createBiquadFilter(), g = AC.createGain(), end = t + dur + 0.09; bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(hi || 7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, end);
    s.connect(bp); bp.connect(g); g.connect(D); s.start(t, Math.random() * 2.5); s.stop(end + 0.03);
  }
  function fall(t, dur, v) {
    var s = K.loopNoise(), bp = AC.createBiquadFilter(), g = AC.createGain(); bp.type = 'bandpass'; bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(7000, t); bp.frequency.exponentialRampToValueAtTime(180, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(bp); bp.connect(g); g.connect(D); s.start(t, Math.random() * 2.5); s.stop(t + dur + 0.08);
  }
  function sub(t, v, dest) {   // the floor dropping out from under a hit
    var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.4, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.2);
    o.connect(g); g.connect(dest || D); o.start(t); o.stop(t + 1.25);
  }
  function roll(t, dt, n, v0, v1, kickToo) {   // n snare hits dt apart, velocity v0 → v1
    for (var k = 0; k < n; k++) { snare(t + k * dt, v0 + (v1 - v0) * k / Math.max(1, n - 1)); if (kickToo && k % 4 === 0) kick(t + k * dt, 0.8, true); }
  }

  /* --- melodic voices ------------------------------------------------------ */
  function organ(note, t, dur, v, wet, room) {   // one oscillator on a drawbar wave, a key click, Leslie wobble on the long notes; `room` adds riff.js's stone hall
    v *= M.organ; var o = osc(wave('organ'), f(note), t, t + dur + 0.12), g = AC.createGain();
    if (room) g.connect(K.hall());
    if (dur > 0.3) lfo(t, t + dur + 0.12, 6.5, 6, 0.05, 0.3).connect(o.detune);
    var pk = v * 0.11;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.006); g.gain.setValueAtTime(pk, t + Math.max(0.01, dur - 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    o.connect(g); out(g, wet);
    burst(t, 0.012, v * 0.06, 'bandpass', 2800, 1.5);
  }
  function hoover(notes, t, dur, v) {   // the rave chord: two saws and a square per note bending in, detuned wide
    v *= M.hoover; var lp = AC.createBiquadFilter(), g = AC.createGain(), lg = lfo(t, t + dur + 0.14, 6.4, 9, 0, 0.01);
    lp.type = 'lowpass'; lp.Q.value = 3.2;
    lp.frequency.setValueAtTime(520, t); lp.frequency.exponentialRampToValueAtTime(4600, t + 0.09); lp.frequency.exponentialRampToValueAtTime(820, t + dur);
    var pk = v * 0.06;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.012); g.gain.setValueAtTime(pk, t + Math.max(0.06, dur * 0.55)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    lp.connect(g); out(g, true);
    notes.forEach(function (n) {
      [-18, 0, 18].forEach(function (det, j) {
        var o = AC.createOscillator(); o.type = j === 1 ? 'square' : 'sawtooth'; o.detune.value = det; lg.connect(o.detune);
        o.frequency.setValueAtTime(f(n) * 1.3, t); o.frequency.exponentialRampToValueAtTime(f(n), t + 0.13);
        o.connect(lp); o.start(t); o.stop(t + dur + 0.14);
      });
    });
  }
  function stab(notes, t, dur, v, cut) {   // supersaw stab: two saws per note either side of the pitch, filter snapping open then shutting
    v *= M.stab; var lp = AC.createBiquadFilter(), g = AC.createGain(); dur = Math.max(0.06, dur); cut = cut === undefined ? 0.8 : cut;
    lp.type = 'lowpass'; lp.Q.value = 2.2;
    lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(900 + 5000 * cut, t + 0.014); lp.frequency.exponentialRampToValueAtTime(500 + 400 * cut, t + dur);
    var pk = v * 0.085;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.005); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * 0.25), t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    lp.connect(g); out(g, true);
    notes.forEach(function (n, k) { [-12, 12].forEach(function (det) { osc('sawtooth', f(n), t, t + dur + 0.14, det + k * 3 - 3).connect(lp); }); });
  }
  function lead(note, t, dur, v, kind, slideFrom) {   // 'wail': a saw and a square through a soft clip, late wide vibrato (the guitarist). 'lift': three saws, the trance singer. 'pulse': the first loop's singer, two pulses
    v *= M.lead; var lp = AC.createBiquadFilter(), g = AC.createGain(), wail = kind === 'wail', pulse = kind === 'pulse', lg = null, endT = t + dur + 0.15, dest = lp;
    lp.type = 'lowpass'; lp.frequency.value = wail ? 3600 : 5200; lp.Q.value = 0.7;
    if (dur > 0.26) lg = lfo(t, endT, wail ? 6.8 : pulse ? 6.2 : 5.6, wail ? 28 : pulse ? 24 : 14, wail ? 0.14 : pulse ? 0.12 : 0.1, 0.3);
    if (wail) { var sh = AC.createWaveShaper(), pre = AC.createGain(); sh.curve = K.curve(6); sh.oversample = '2x'; pre.gain.value = 0.9; pre.connect(sh); sh.connect(lp); dest = pre; }
    (wail ? [[-8, 'sawtooth'], [8, 'square']] : pulse ? [[-5, wave('p25')], [6, 'square']] : [[-12, 'sawtooth'], [0, 'sawtooth'], [12, 'sawtooth']]).forEach(function (p) {
      var o = AC.createOscillator(); if (typeof p[1] === 'string') o.type = p[1]; else o.setPeriodicWave(p[1]); o.detune.value = p[0]; if (lg) lg.connect(o.detune);
      if (slideFrom) { o.frequency.setValueAtTime(f(slideFrom), t); o.frequency.exponentialRampToValueAtTime(f(note), t + Math.min(0.12, dur * 0.4)); } else o.frequency.value = f(note);
      o.connect(dest); o.start(t); o.stop(endT);
    });
    var pk = v * (wail ? 0.09 : pulse ? 0.1 : 0.075);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.01); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * 0.7), t + Math.max(0.05, dur * 0.85)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.06, dur) + 0.1);
    lp.connect(g); out(g, true);
  }
  function acid(note, t, dur, v, acc, slideFrom, cut) {   // the 303: one saw, a high-Q lowpass with a per-note envelope, accents open it further
    v *= M.acid; var o = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain(), fr = f(note);
    o.type = 'sawtooth';
    if (slideFrom) { o.frequency.setValueAtTime(f(slideFrom), t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.06); } else o.frequency.setValueAtTime(fr, t);
    lp.type = 'lowpass'; lp.Q.value = acc ? 15 : 10;
    var base = 150 + 1200 * cut, top = Math.min(8000, base + (acc ? 3600 : 1800) * (0.4 + cut)), fl = acc ? 0.28 : 0.13;
    lp.frequency.setValueAtTime(base, t); lp.frequency.linearRampToValueAtTime(top, t + 0.012); lp.frequency.exponentialRampToValueAtTime(base, t + fl);
    dur = Math.max(0.035, dur);
    var pk = v * (acc ? 0.11 : 0.075);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.004); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * 0.45), t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    o.connect(lp); lp.connect(g); out(g, false); o.start(t); o.stop(t + dur + 0.06);
  }
  function rbass(note, t, dur, v, cut) {   // the rolling bass: a saw with a filter snap over a sine floor
    v *= M.bass; var o = AC.createOscillator(), o2 = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain(); dur = Math.max(0.04, dur);
    o.type = 'sawtooth'; o.frequency.value = f(note); o2.type = 'sine'; o2.frequency.value = f(note);
    lp.type = 'lowpass'; lp.Q.value = 2.4; lp.frequency.setValueAtTime(600 + 2200 * cut, t); lp.frequency.exponentialRampToValueAtTime(220, t + Math.min(0.11, dur));
    pluck(g, t, v * 0.3, dur, 0.55, 0.035); o.connect(lp); lp.connect(g); o2.connect(g); out(g, false);
    o.start(t); o2.start(t); o.stop(t + dur + 0.06); o2.stop(t + dur + 0.06);
  }
  function fmBass(note, t, dur, v, bark) {   // the Mega Drive bark: 2:1 FM with pitch and index envelopes (riff.js's tBass, on this bus)
    v *= M.bass; var fr = f(note), car = AC.createOscillator(), mod = AC.createOscillator(), mg = AC.createGain(), g = AC.createGain(), lp = AC.createBiquadFilter();
    car.type = 'sine'; car.frequency.setValueAtTime(fr * 2.1, t); car.frequency.exponentialRampToValueAtTime(fr, t + 0.026);
    mod.type = 'sine'; mod.frequency.value = fr * 2;
    mg.gain.setValueAtTime(fr * (bark ? 6.5 : 4), t); mg.gain.exponentialRampToValueAtTime(fr * 1.1, t + 0.05); mg.gain.exponentialRampToValueAtTime(fr * 0.1, t + Math.max(0.1, dur * 0.9));
    mod.connect(mg); mg.connect(car.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.7;
    var end = env(g, t, 0.003, v * 0.36, 0.09, 0.5, dur, 0.045);
    car.connect(lp); lp.connect(g); out(g, false); mod.start(t); car.start(t); mod.stop(end + 0.03); car.stop(end + 0.03);
  }
  function pad(notes, t, dur, v, wet) {   // two saws a note, a slow filter, a slow attack
    v *= M.pad; var lp = AC.createBiquadFilter(), g = AC.createGain(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(1600, t + dur * 0.7);
    var pk = v * 0.034;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.3); g.gain.setValueAtTime(pk, t + Math.max(0.4, dur - 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    lp.connect(g); out(g, wet);
    notes.forEach(function (n, k) { [-7, 7].forEach(function (det) { osc('sawtooth', f(n), t, t + dur + 0.4, det + k * 4 - 4).connect(lp); }); });
  }
  function arp(note, t, dur, v, wet) {   // one narrow pulse, plucked
    v *= M.arp; var o = osc(wave('p25'), f(note), t, t + dur + 0.06), g = AC.createGain();
    pluck(g, t, v * 0.07, dur, 0.25, 0.04); o.connect(g); out(g, wet);
  }
  function drone(note, t, dur, v) {   // the sub floor under the True Last Boss: a sine that shivers
    v *= M.bass; var o = osc('sine', f(note), t, t + dur + 0.5), g = AC.createGain(), tr = AC.createOscillator(), tg = AC.createGain();
    env(g, t, 0.4, v * 0.28, 0.3, 0.9, dur - 0.3, 0.5);
    tr.frequency.value = 5.5; tg.gain.value = v * 0.07; tr.connect(tg); tg.connect(g.gain); tr.start(t); tr.stop(t + dur + 0.5);
    o.connect(g); out(g, false);
  }
  function choir(notes, t, dur, v) {   // riff.js's choir (two saws a singer, one vibrato, its formant bus and hall), cut off at the chord's end so chords re-articulate instead of piling up
    v *= M.choir; var bus = K.choirBus(), end = t + dur - 0.02, lg = lfo(t, end, 5.1, 10, 0, 0.7);
    notes.forEach(function (n, k) {
      [-9, 8].forEach(function (det) {
        var o = osc('sawtooth', f(n), t, end, det + k * 3 - 4), g = AC.createGain(); lg.connect(o.detune);
        env(g, t + k * 0.015, 0.2, v * 0.16, 0.3, 0.85, Math.max(0.4, dur - 0.2), 0.14);
        o.connect(g); g.connect(bus);
      });
    });
  }
  function alarm(t, hi, v) {   // one square blip of the two-tone alarm
    var o = osc('square', hi ? 1318.5 : 932.3, t, t + 0.1), g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05, t + 0.004); g.gain.setValueAtTime(v * 0.05, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); out(g, true);
  }

  /* --- shared scheduling ---------------------------------------------------
     A track is { bpm, steps, introSteps, loopSteps, entries }: the intro plays once,
     then step wraps inside the loop, never back into the intro. Late steps are dropped
     (a stalled tab must not fire its backlog as one chord). A track that has already
     played on this page (a retry, a continue, the next stage) skips its intro and comes
     back in at the next entry (a section that opens on a crash) after the point where it
     was stopped, so the piece keeps moving through the game instead of starting over.
     Offline renders (Riff.render) always play exactly the steps they ask for.
     A stinger can leave a CUE, a time its hit lands: a track that starts from its first step within 1.2 s before
     or 2 s after the cue puts its grid on it. Early, the first downbeat waits for the hit; late, the steps already
     past are skipped, so the track comes in on the next sixteenth of a bar that began on the hit. Either way the hit
     IS the downbeat, whatever the frame rate did to the gap between the two calls (the magician's arrival: the
     'reveal' crack, then his track 0.8 s later by the game's clock, which lags the audio clock below 20 fps). */
  var LAST = {}, CUE = null;   // LAST: track name -> the last step scheduled on the live context. CUE: {AC, name, t}
  function drive(name, track, S, playStep) {
    var spb = 60 / track.bpm / 4;
    if (S.step === 0) {
      if (!S.offline && LAST[name] !== undefined) S.step = track.introSteps + nextEntry(track, LAST[name]);
      else if (CUE && CUE.name === name && CUE.AC === AC && CUE.t > S.now - 2 && CUE.t < S.now + 1.2) { S.step = Math.max(0, Math.ceil((S.now + 0.02 - CUE.t) / spb)); S.nextT = CUE.t + S.step * spb; }
      if (CUE && CUE.name === name && CUE.AC === AC) CUE = null;   // used or missed; an offline render leaves the live cue alone
    }
    while (S.nextT < S.now - 0.05) { S.nextT += spb; S.step++; }
    while (S.nextT < S.now + 0.3) {
      var j = S.step < track.introSteps ? S.step : track.introSteps + (S.step - track.introSteps) % track.loopSteps;
      playStep(track.steps[j], S.nextT, spb, j);
      S.nextT += spb; S.step++;
    }
    if (!S.offline && S.step > 0) LAST[name] = S.step;
  }
  function nextEntry(track, step) {   // loop-relative start of the first entry section after `step` (wrapping)
    var p = step < track.introSteps ? -1 : (step - track.introSteps) % track.loopSteps, e = track.entries;
    for (var k = 0; k < e.length; k++) if (e[k] > p) return e[k];
    return e[0];
  }
  // A compose() result: the intro is SEC[0] (its own length), every later section is 8 bars; entries are the loop
  // sections that open on a crash. (Long voices, such as an eight-bar riser, are fine: riff.js's stop() silences every
  // source that has not ended yet.)
  function finish(bpm, SEC, steps) {
    var intro = 16 * (SEC[0].bars || 8), entries = [];
    for (var k = 1; k < SEC.length; k++) if (SEC[k].crash) entries.push((k - 1) * 128);
    return { bpm: bpm, steps: steps, introSteps: intro, loopSteps: steps.length - intro, entries: entries };
  }
  function describe(track, noteKey) {
    var secs = function (n) { return +(n * 60 / track.bpm / 4).toFixed(2); }, notes = 0;
    for (var i = 0; i < track.steps.length; i++) if (track.steps[i][noteKey]) notes++;
    return { bars: track.steps.length / 16, bpm: track.bpm, seconds: secs(track.steps.length), introBars: track.introSteps / 16, loopBars: track.loopSteps / 16, loopSeconds: secs(track.loopSteps), notes: notes, entryBars: track.entries.map(function (e) { return track.introSteps / 16 + e / 16; }) };
  }
  function drums(kind, i, odd, st) {   // shared feels. kk kick (h: hard), sn snare, cp clap, ht {v,o}, tm tom Hz
    var h = null;
    if (kind === 'four') { if (i % 4 === 0) st.kk = 1; if (i === 4 || i === 12) st.sn = 0.9; h = i % 4 === 2 ? 0.55 : i % 2 === 0 ? 0.4 : 0.25; if (i === 14) h = { v: 0.55, o: 1 }; }
    else if (kind === 'double') { if (i % 4 === 0 || i === 10 || i === 14 || (odd && i === 7)) st.kk = i % 4 === 0 ? 1 : 0.7; if (i === 4 || i === 12) st.sn = 0.9; h = i % 2 === 0 ? 0.45 : 0.28; if (i === 14) h = { v: 0.5, o: 1 }; }
    else if (kind === 'gallop') { if (i === 0 || i === 3 || i === 6 || i === 8 || i === 11 || i === 14) st.kk = i % 8 === 0 ? 1 : 0.75; if (i === 4 || i === 12) st.sn = 0.9; h = i % 2 === 0 ? 0.42 : 0.26; }
    else if (kind === 'house') { if (i % 4 === 0) st.kk = 1; if (i === 4 || i === 12) { st.sn = 0.7; st.cp = 0.9; } h = i % 4 === 2 ? { v: 0.6, o: 1 } : i % 2 === 0 ? 0.42 : 0.28; }
    else if (kind === 'houseF') { if (i % 4 === 0 || i === 10 || (odd && i === 14)) st.kk = i % 4 === 0 ? 1 : 0.55; if (i === 4 || i === 12) { st.sn = 0.7; st.cp = 0.9; } if (odd && i === 15) st.sn = 0.3; h = i % 4 === 2 ? { v: 0.6, o: 1 } : i % 2 === 0 ? 0.45 : 0.3; }
    else if (kind === 'intro') { if (i % 4 === 0) st.kk = 0.75; if (i % 2 === 0) h = 0.3; }
    else if (kind === 'pulse') { if (i === 0 || i === 8) st.kk = 0.8; if (i === 4 || i === 12) h = 0.3; }
    else if (kind === 'build8') { if (i % 4 === 0) st.kk = 1; if (i % 2 === 0) st.sn = 0.45 + 0.03 * i; h = i % 2 === 0 ? 0.4 : 0.25; }
    else if (kind === 'build16') { if (i % 4 === 0) st.kk = 1; st.sn = 0.5 + 0.03 * i; h = i % 2 === 0 ? 0.45 : 0.3; }
    else if (kind === 'war') { if (i === 0 || i === 6 || i === 8 || i === 14) st.kk = 1; if (i === 4 || i === 12) st.sn = 0.95; if (i === 3 || i === 11) st.tm = 98; if (i === 7 || i === 15) st.tm = 74; h = i % 2 === 0 ? 0.4 : 0.22; }
    if (h !== null) st.ht = typeof h === 'number' ? { v: h, o: 0 } : h;
  }
  function fillBar(i, st, big) {   // the last bar of a section: snares walking in with two toms. `big`: the whole bar
    if (big) { var c = 's..s..s.ssss1123'.charAt(i); if (c === 's') st.sn = 0.7 + i * 0.02; else if (c !== '.') st.tm = { 1: 196, 2: 147, 3: 98 }[c]; if (i % 8 === 0) st.kk = 1; st.ht = null; return; }
    if (i >= 8) { st.sn = 0.72 + (i - 8) * 0.035; if (i === 12) st.tm = 147; if (i === 14) st.tm = 98; st.ht = null; if (i === 8) st.kk = 1; }
  }
  function hitDrums(st, t, spb, hard) {
    if (st.kk) kick(t, st.kk, hard);
    if (st.sn) snare(t, st.sn);
    if (st.cp) clap(t, st.cp);
    if (st.tm) tom(t, st.tm, 0.9);
    if (st.ht) hat(t, st.ht.o, st.ht.v);
    if (st.rd) ride(t, st.rd);
    if (st.cr) crash(t, st.cr);
    if (st.ri) rise(t, st.ri.len * spb, st.ri.v, st.ri.hi);
    if (st.fa) fall(t, st.fa.d, st.fa.v);
    if (st.su) sub(t, st.su);
    if (st.rl) roll(t, spb * (st.rl.dt || 1), st.rl.n, st.rl.v0, st.rl.v1, st.rl.kick);
  }

  /* --- MAGICIAN: D minor at 170, 82 bars (2 of arrival, then an 80-bar loop) ------------
     REVIEWER 2 — TYPE 0002 teleports; so does the tune. The four-note motif D G# A F (a
     tritone up, a semitone up, a fall to the minor third) opens the piece on a drawbar
     organ in a stone room, answered an octave down, and is then buried in the riff itself (the chug plays
     0 . 6 7 . 3), tagged by the organ between phrases, and finally screamed by the lead
     before the gallop. The chug goes through riff.js's distortion bus. */
  var MAG_BPM = 170, MAGICIAN = null;
  function pick(x, b, dflt) { return x === undefined ? dflt : Object.prototype.toString.call(x) === '[object Array]' ? x[b] : x; }
  function composeMagician() {
    if (MAGICIAN) return MAGICIAN;
    var CH = {   // r: chug and bass root, tri: organ/hoover triad, v: choir voicing, tp: timpani
      Dm: { r: 38, tri: [62, 65, 69], v: [50, 57, 62, 65], tp: 38 },
      Bb: { r: 34, tri: [58, 62, 65], v: [46, 58, 62, 65], tp: 46 },
      Gm: { r: 31, tri: [55, 58, 62], v: [43, 55, 58, 62], tp: 43 },
      A:  { r: 33, tri: [57, 61, 64], v: [45, 57, 61, 64], tp: 45 },
      C:  { r: 36, tri: [60, 64, 67], v: [48, 55, 60, 64], tp: 48 },
      Eb: { r: 39, tri: [63, 67, 70], v: [51, 58, 63, 67], tp: 51 }
    };
    var N = null, RIFF = {   // semitones above the chord root per sixteenth
      A: [0, 0, 0, N, 0, 0, 6, 7, 0, 0, 0, N, 3, N, 0, N],       // the motif inside the riff
      B: [0, N, 0, 0, 0, N, 0, 0, 0, N, 0, 0, 6, N, 7, 3],       // the gallop
      C: [0, 0, 0, N, 0, 0, 0, N, 0, N, 0, 0, 12, N, 7, N],      // broad, for the descent
      P: [0, N, N, N, 0, N, N, N, 0, N, N, N, 0, N, N, N],       // a muted pulse
      H: [0, N, 0, N, 0, N, 0, N, 0, N, 0, N, 0, N, 0, N]        // eighths
    };
    var MOTIF = [74, 80, 81, 77];
    var LEADS = [   // [step, note, sixteenths, slide-from-previous]
      [[[0,74,4],[4,77,2],[6,74,2],[8,81,6],[14,80,2]], [[0,81,8,1],[8,77,4],[12,74,4]], [[0,77,6],[6,74,2],[8,70,4],[12,74,4]], [[0,73,12],[12,76,4]],
       [[0,74,4],[4,77,2],[6,74,2],[8,81,6],[14,80,2]], [[0,81,4,1],[4,84,4],[8,86,8]], [[0,82,6],[6,81,2],[8,79,4],[12,77,4]], [[0,76,8],[8,73,8]]],
      [[[0,86,6],[6,84,2],[8,81,8]], [[0,84,6],[6,82,2],[8,79,8]], [[0,82,6],[6,81,2],[8,77,8]], [[0,80,4],[4,81,12,1]],
       [[0,86,6],[6,84,2],[8,81,8]], [[0,84,4],[4,86,4],[8,88,8]], [[0,89,6],[6,88,2],[8,86,4],[12,84,4]], [[0,81,14]]],
      [[[0,81,2],[2,82,2],[4,81,2],[6,77,2],[8,74,8]], [[0,79,2],[2,81,2],[4,79,2],[6,76,2],[8,72,8]], [[0,77,2],[2,79,2],[4,77,2],[6,74,2],[8,70,8]], [[0,73,4],[4,76,4],[8,81,8,1]],
       [[0,86,3],[3,86,3],[6,86,2],[8,89,4],[12,88,4]], [[0,84,3],[3,84,3],[6,84,2],[8,86,4],[12,84,4]], [[0,82,3],[3,82,3],[6,82,2],[8,86,4],[12,85,4]], [[0,86,16,1]]],
      [[[0,93,4],[4,92,4],[8,89,8]], [[0,88,4],[4,86,4],[8,84,8]], [[0,82,4],[4,81,4],[8,77,8]], [[0,80,6],[6,81,2],[8,76,8]],
       [[0,74,2],[2,77,2],[4,81,2],[6,86,2],[8,89,8]], [[0,84,4],[4,88,4],[8,91,8]], [[0,89,4],[4,86,4],[8,82,8]], [[0,81,12],[12,80,2],[14,81,2]]]
    ];
    // prog: chords · riff: RIFF key per bar · dr: drum feel · org: organ figure per bar · hv: hoovers {bar: [[step, len, vel]]}
    // l: lead phrase · ch: choir · tp: timpani · e: one-shots {bar: [[step, kind, ...]]} · gap: empty the last two sixteenths of the last bar
    // bars: the section's length when it is not 8 (the intro) · crash: open on a crash, which also makes it an entry for a replay
    var SEC = [
      /* 0 ARRIVAL   */ { bars: 2, prog: ['Dm','A'], riff: ['P','H'], dr: ['intro','build16'], org: ['both',N], room: true, hv: { 1: [[0, 10, 0.9]] }, e: { 0: [[0,'rise',32,0.35]] }, fill: false, gap: true },   // no sub on the downbeat: 'reveal' drops the floor there
      /* 1 THE RIFF  */ { prog: ['Dm','Dm','Bb','A','Dm','Dm','Gm','A'], riff: 'A', dr: 'four', org: [N,'comp',N,'comp',N,'comp',N,'comp'], hv: { 2: [[0,4,0.85]], 6: [[0,4,0.85]], 7: [[8,8,0.95]] }, crash: 1 },
      /* 2 RIFF, TAGGED */ { prog: ['Dm','Dm','Bb','A','Dm','Dm','Gm','A'], riff: 'A', dr: 'double', org: ['comp','tag','comp','comp','comp','tag','comp','comp'],
                          hv: { 2: [[0,4,0.85],[8,3,0.7]], 3: [[0,4,0.85]], 6: [[0,4,0.85]], 7: [[0,4,0.85],[8,8,1]] }, crash: 1 },
      /* 3 LEAD I    */ { prog: ['Dm','Dm','Bb','A','Dm','Dm','Gm','A'], riff: 'A', dr: 'four', l: 0, org: [N,N,'comp','comp',N,N,'comp','comp'], hv: { 2: [[0,4,0.8]], 6: [[0,4,0.8]] }, crash: 1 },
      /* 4 LEAD II   */ { prog: ['Dm','C','Bb','A','Dm','C','Bb','A'], riff: 'C', dr: 'double', l: 1, org: 'comp', hv: { 0: [[0,4,0.85]], 4: [[0,4,0.85]], 7: [[0,6,1]] }, e: { 7: [[8,'rise',8,0.35]] }, gap: true },
      /* 5 THE ROOM  */ { prog: ['Dm','Dm','Bb','Bb','Gm','Gm','A','A'], riff: 'P', dr: 'none', org: ['slow',N,'slow',N,'slow',N,N,N], room: true, ch: { vel: 0.85, vow: 'ooh' }, tp: true,
                          e: { 0: [[0,'crash',0.6],[0,'fall',1.2,0.35]] }, fill: false },
      /* 6 THE BUILD */ { prog: ['Dm','Dm','Bb','Bb','Gm','Gm','A','A'], riff: ['P','P','H','H','H','H','A','A'], dr: ['pulse','pulse','intro','intro','four','four','build8','build16'],
                          org: [N,N,N,N,'motif',N,'motif',N], ch: { vel: 1, vow: 'aah', thin: true }, tp: true, hv: { 7: [[0,8,1.1]] }, e: { 0: [[0,'rise',128,0.45,9000]] }, fill: false, gap: true },
      /* 7 THE DESCENT */ { prog: ['Dm','C','Bb','A','Dm','C','Bb','A'], riff: 'C', dr: 'double', org: ['comp','comp','comp','tag','comp','comp','comp','tag'],
                          hv: { 0: [[0,4,1]], 2: [[0,4,0.85]], 4: [[0,4,0.9]], 6: [[0,4,0.85]], 7: [[0,4,0.85],[8,6,1]] }, crash: 1 },
      /* 8 THE WAIL  */ { prog: ['Dm','C','Bb','A','Dm','C','Bb','A'], riff: 'C', dr: 'double', l: 2, org: 'dbl', hv: { 0: [[0,4,0.85]], 4: [[0,4,0.85]] }, crash: 1 },
      /* 9 THE WAIL II */ { prog: ['Dm','C','Bb','A','Dm','C','Bb','A'], riff: 'A', dr: 'four', l: 3, org: 'dbl', hv: { 0: [[0,4,0.85]], 3: [[0,4,0.8]], 7: [[0,8,1]] }, e: { 7: [[8,'rise',8,0.4]] } },
      /* 10 THE GALLOP */ { prog: ['Dm','Dm','Eb','Eb','Dm','Dm','A','A'], riff: 'B', dr: 'gallop', org: ['tag',N,'comp','comp','tag',N,'comp','comp'],
                          hv: { 2: [[0,8,1]], 3: [[0,8,0.9]], 6: [[0,4,0.9]], 7: [[0,4,0.9]] }, crash: 1, e: { 7: [[0,'rise',16,0.45]] }, big: true }
    ];
    var steps = [];
    SEC.forEach(function (sec) {
      var lead = sec.l === undefined ? null : LEADS[sec.l], prevLead = 0, bars = sec.bars || 8;
      for (var b = 0; b < bars; b++) {
        var ch = CH[sec.prog[b]], odd = b % 2 === 1, riff = pick(sec.riff, b, N), dr = pick(sec.dr, b, 'none'), org = pick(sec.org, b, N), last = b === bars - 1;
        var lmap = {}, evs = {}, hvs = {};
        if (lead) lead[b].forEach(function (e) { lmap[e[0]] = e; });
        ((sec.e || {})[b] || []).forEach(function (e) { (evs[e[0]] = evs[e[0]] || []).push(e); });
        ((sec.hv || {})[b] || []).forEach(function (e) { hvs[e[0]] = e; });
        for (var i = 0; i < 16; i++) {
          var st = {}, rf = riff ? RIFF[riff][i] : N;
          drums(dr, i, odd, st);
          if (last && sec.fill !== false) fillBar(i, st, sec.big);
          if (rf !== N) st.rf = { n: ch.r + rf, open: rf !== 0 && rf !== 12 };
          if (riff && (i === 0 || i === 8)) st.fb = { n: ch.r, v: riff === 'P' ? 0.6 : 0.85 };
          if (org === 'motif' && i < 8 && i % 2 === 0) st.og = [{ n: MOTIF[i / 2], len: 1.5, v: 1 }];
          else if (org === 'both' && i % 2 === 0) st.og = [{ n: MOTIF[(i % 8) / 2] - (i < 8 ? 0 : 12), len: 1.5, v: i < 8 ? 1 : 0.85 }];   // the motif, then its echo an octave down
          else if (org === 'slow' && i % 4 === 0) st.og = [{ n: MOTIF[i / 4], len: 3.6, v: 0.9 }];
          else if (org === 'tag' && i >= 8 && i % 2 === 0) st.og = [{ n: MOTIF[(i - 8) / 2] + 12, len: 1.5, v: 0.9 }];
          else if (org === 'comp' && i % 4 === 2) st.og = ch.tri.map(function (n) { return { n: n, len: 1.2, v: 0.7 }; });
          if (sec.room) st.room = true;
          if (lmap[i]) { st.ld = { n: lmap[i][1], len: lmap[i][2], v: i === 0 ? 1 : 0.86, sl: lmap[i][3] ? prevLead : 0, dbl: org === 'dbl' }; prevLead = lmap[i][1]; }
          if (hvs[i]) st.hv = { notes: ch.tri, len: hvs[i][1], v: hvs[i][2] };
          if (sec.ch && i === 0 && b === 0) st.vow = sec.ch.vow;
          if (sec.ch && i === 0 && !odd) st.chr = { notes: sec.ch.thin ? ch.v.slice(1) : ch.v, len: 32, v: sec.ch.vel };
          if (sec.tp) {
            if (last && i >= 8) st.tr = { n: ch.tp, v: 0.4 + 0.6 * (i - 8) / 7 };
            else if (i === 0) st.tp = { n: ch.tp, v: 1 }; else if (i === 6) st.tp = { n: ch.tp, v: 0.5 }; else if (i === 8) st.tp = { n: ch.tp, v: 0.7 }; else if (odd && i === 14) st.tp = { n: ch.tp - 5, v: 0.45 };
          }
          if (i === 0 && b === 0 && sec.crash) st.cr = sec.crash;
          (evs[i] || []).forEach(function (e) {
            if (e[1] === 'crash') st.cr = e[2]; else if (e[1] === 'sub') st.su = e[2]; else if (e[1] === 'rise') st.ri = { len: e[2], v: e[3], hi: e[4] }; else if (e[1] === 'fall') st.fa = { d: e[2], v: e[3] };
          });
          if (sec.gap && last && i >= 14) { st.kk = 0; st.sn = 0; st.tm = 0; st.ht = null; st.rf = null; st.fb = null; st.og = null; }
          steps.push(st);
        }
      }
    });
    return MAGICIAN = finish(MAG_BPM, SEC, steps);
  }
  function playMagician(st, t, spb) {
    hitDrums(st, t, spb, true);
    if (st.vow) K.vowel(st.vow, t, 0.3);
    if (st.chr) choir(st.chr.notes, t, st.chr.len * spb, st.chr.v);
    if (st.tp) K.timp(st.tp.n, t, st.tp.v * M.timp, false);
    if (st.tr) K.timp(st.tr.n, t, st.tr.v * M.timp, true);
    if (st.rf) K.chug(st.rf.n, t, spb * (st.rf.open ? 2 : 0.9), !st.rf.open, true);
    if (st.fb) fmBass(st.fb.n, t, spb * 3.5, st.fb.v, true);
    if (st.og) st.og.forEach(function (n) { organ(n.n, t, n.len * spb, n.v, true, st.room); });
    if (st.ld) { lead(st.ld.n, t, st.ld.len * spb * 0.92, st.ld.v, 'wail', st.ld.sl); if (st.ld.dbl) organ(st.ld.n - 12, t, st.ld.len * spb * 0.85, st.ld.v * 0.6, true); }
    if (st.hv) hoover(st.hv.notes, t, st.hv.len * spb, st.hv.v);
  }

  /* --- SPACE2: E minor at 155, 104 bars (8 of intro, then a 96-bar loop) ------------------
     The shooter's second loop. Four on the floor, a rolling sixteenth bass under the kick,
     supersaw stabs on the off-beats, a 303 that gets its own eight bars, a break with a
     pad and a long riser, and a lead that lifts. It keeps the first loop's key, its
     Em-C-D-B ground, its sixteenth arpeggio, its B-C-C#-D# walk back into E and its theme:
     the break sings the theme's first four bars in the first loop's own pulse voice, and
     the anthem plays all eight on the trance lead with that voice an octave below. */
  var SP2_BPM = 155, SPACE2 = null;
  function composeSpace2() {
    if (SPACE2) return SPACE2;
    var E = 52, EMIN = [0, 2, 3, 5, 7, 8, 10];
    var CH = {   // r: bass root, tri: stab triad, q: third, sh: acid shift in scale steps, s7: raise D to D#, phr: flatten F# to F
      Em: { r: 40, tri: [64, 67, 71], q: 3, sh: 0 }, C: { r: 36, tri: [60, 64, 67], q: 4, sh: -2 }, D: { r: 38, tri: [62, 66, 69], q: 4, sh: -1 },
      B:  { r: 35, tri: [59, 63, 66], q: 4, sh: -3, s7: 1 }, G: { r: 43, tri: [67, 71, 74], q: 4, sh: 2 }, Am: { r: 45, tri: [69, 72, 76], q: 3, sh: 3 },
      F:  { r: 41, tri: [65, 69, 72], q: 4, sh: 1, phr: 1 }
    };
    function sdeg(i, ch) { var o = Math.floor(i / 7), k = ((i % 7) + 7) % 7, n = E + EMIN[k] + 12 * o; if (ch.s7 && k === 6) n++; if (ch.phr && k === 1) n--; return n; }
    var N = null, AP = {   // acid: [scale degree, accent, slide]
      A: [[0,1,0],N,[7,0,0],N,[0,0,0],[2,0,0],[0,1,0],N,[0,0,0],[7,0,0],N,[0,0,0],[4,1,0],[3,0,1],[2,0,0],[0,0,0]],
      B: [[0,1,0],N,[7,0,0],N,[0,0,0],[2,0,0],[0,1,0],N,[0,0,0],[4,0,0],N,[0,0,0],[2,1,0],[1,0,1],[0,0,0],[-3,0,0]],
      C: [[0,0,0],N,N,N,[0,0,0],N,[7,0,0],N,[0,0,0],N,N,N,[4,0,0],N,[2,0,0],N],
      D: [[0,1,0],[0,0,0],[7,0,0],[0,0,0],[4,0,0],N,[7,1,0],N,[2,0,0],[0,0,0],[9,0,0],N,[7,1,0],[4,0,1],[2,0,0],[0,0,0]],
      E: [[0,1,0],N,[0,0,0],[7,1,0],N,N,[4,1,0],N,[0,0,0],[7,0,0],N,[2,1,0],[0,0,0],N,[4,0,1],N],
      S: [[0,1,0],[7,0,1],[0,0,0],[7,0,0],[9,1,0],[7,0,1],[4,0,0],[0,0,0],[0,1,0],[7,0,0],[11,1,1],[7,0,0],[4,0,0],[2,0,1],[0,0,0],[-3,0,0]]
    };
    var ST = { off: '..x...x...x...x.', offX: 'X.x...x...x...x.', eighths: 'x.x.x.x.x.x.x.x.', push: 'X.....x...x...x.' };
    var ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1], WALK = [35, 36, 37, 39];   // the first loop's arpeggio and its turnaround
    var LEADS = [
      [[[0,76,3],[3,79,3],[6,83,2],[8,88,8]], [[0,86,4],[4,83,4],[8,79,8]], [[0,84,6],[6,83,2],[8,79,4],[12,76,4]], [[0,78,12],[12,81,4]],
       [[0,76,3],[3,79,3],[6,83,2],[8,88,8]], [[0,86,4],[4,88,4],[8,91,8]], [[0,88,6],[6,86,2],[8,84,4],[12,83,4]], [[0,87,10],[10,83,2],[12,86,2],[14,87,2]]],
      [[[0,83,2],[2,86,2],[4,88,4],[8,86,2],[10,83,2],[12,79,4]], [[0,84,6],[6,83,2],[8,79,8]], [[0,86,2],[2,83,2],[4,79,2],[6,74,2],[8,79,8]], [[0,81,4],[4,78,4],[8,74,8]],
       [[0,83,2],[2,86,2],[4,88,4],[8,91,8]], [[0,88,2],[2,86,2],[4,84,4],[8,83,8]], [[0,81,4],[4,84,4],[8,88,8]], [[0,87,8],[8,90,4],[12,87,4]]]
    ];
    // the first loop's theme (riff.js composes 'space' theme A from seed 562: B C B | G F# G ...), over its own Em C D Em C D Em B
    var THEME = [[[0,71,3],[3,72,3],[6,71,2],[8,67,3],[11,66,3],[14,67,2]], [[0,72,2],[2,74,2],[4,72,4],[8,76,2],[10,78,2],[12,72,4]],
                 [[0,69,3],[3,71,3],[6,69,2],[8,66,3],[11,67,3],[14,66,2]], [[0,67,2],[2,66,2],[4,67,4],[8,64,2],[10,66,2],[12,67,4]],
                 [[0,72,3],[3,74,3],[6,72,2],[8,67,3],[11,66,3],[14,67,2]], [[0,69,2],[2,71,2],[4,69,4],[8,74,2],[10,76,2],[12,69,4]],
                 [[0,71,3],[3,69,3],[6,67,2],[8,71,3],[11,72,3],[14,71,2]], [[0,71,12]]];
    var MENACE = [[0,64,2],[2,65,2],[4,64,2],[6,59,2],[8,64,6]];
    function under(n, ch) {   // the harmony voice: the chord tone a third to a sixth below
      var best = N; for (var k = n - 10; k <= n - 3; k++) for (var j = 0; j < 3; j++) if ((ch.tri[j] - k) % 12 === 0) best = k;
      return best === N ? n - 12 : best;
    }
    // prog · dr feel · bs bass ('roll' | 'gallop' | 'long' | 'pedal' | 'walk') · sb stab pattern · ac acid pattern per bar · av acid vel · cut filter (0..1)
    // ap arpeggio vel · pd pad vel · l lead phrase, or 'theme' · tb theme bars (from bar 0) · lk lead voice · lo lead octave shift · lv lead vel
    // harm harmony voice · dbl the pulse singer an octave under the lead · rd ride · fill 'roll8' | 'roll16' | 'roll32' · e one-shots · gap
    var SEC = [
      /* 0 IGNITION  */ { prog: ['Em','Em','Em','Em','Em','Em','Em','Em'], dr: ['pulse','pulse','intro','intro','intro','intro','house','build16'], bs: ['pedal','pedal','pedal','pedal','roll','roll','roll','roll'],
                          cut: [0.1,0.15,0.2,0.3,0.4,0.5,0.6,0.7], ap: [0.4,0.5,0.6,0.7,0.8,0.9,1,1], e: { 0: [[0,'crash',0.6]], 4: [[0,'rise',64,0.35]] }, gap: true },
      /* 1 DRIVE     */ { prog: ['Em','Em','C','D','Em','Em','C','B'], dr: 'house', bs: 'roll', sb: 'offX', cut: 0.75, crash: 1, fill: 'roll8' },
      /* 2 THE 303   */ { prog: ['Em','Em','C','D','Em','Em','C','B'], dr: 'house', bs: 'roll', sb: 'off', ac: ['A','B','A','B','A','B','A','D'], av: 0.9, acut: [0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.8], cut: 0.8, fill: 'roll8' },
      /* 3 LEAD      */ { prog: ['Em','Em','C','D','Em','Em','C','B'], dr: 'house', bs: 'roll', sb: 'off', sv: 0.8, l: 0, ac: 'A', av: 0.55, acut: 0.5, cut: 0.85, crash: 1 },
      /* 4 LEAD, HARM */ { prog: ['Em','Em','C','D','Em','Em','C','B'], dr: 'houseF', bs: 'roll', sb: 'offX', l: 0, harm: 1, ac: 'B', av: 0.55, acut: 0.6, cut: 0.9, fill: 'roll16', e: { 6: [[0,'rise',32,0.4]] }, gap: true },
      /* 5 THE BREAK */ { prog: ['Em','C','D','Em','D','D','B','B'], dr: ['none','none','none','none','pulse','pulse','build8','build16'], bs: ['long','long','long','long','long','long','roll','roll'],
                          l: 'theme', tb: 4, lk: 'pulse', lv: 0.33, pd: 1, ap: 0.9, ac: 'C', av: 0.5, acut: [0.2,0.25,0.3,0.35,0.45,0.55,0.7,0.85], cut: [0.2,0.25,0.3,0.35,0.45,0.55,0.7,0.85],
                          e: { 0: [[0,'crash',0.5],[0,'fall',1.5,0.4]], 4: [[0,'rise',64,0.4,9000]] }, gap: true },
      /* 6 THE DROP  */ { prog: ['Em','C','G','D','Em','C','Am','B'], dr: 'house', bs: 'roll', sb: 'offX', l: 1, cut: 0.9, crash: 1, e: { 0: [[0,'sub',1]] }, fill: 'roll8' },
      /* 7 DROP, HARM */ { prog: ['Em','C','G','D','Em','C','Am','B'], dr: 'houseF', bs: 'roll', sb: 'off', l: 1, harm: 1, ac: 'E', av: 0.7, acut: 0.7, cut: 0.95, fill: 'roll16' },
      /* 8 MENACE    */ { prog: ['Em','F','Em','F','Em','F','G','B'], dr: 'gallop', bs: 'gallop', sb: 'eighths', sv: 0.7, ml: [0,2,4], ac: 'S', av: 1, acut: 0.9, cut: 0.7, crash: 1, fill: 'roll8' },
      /* 9 ACID SOLO */ { prog: ['Em','Em','C','D','Em','Em','C','B'], dr: 'house', bs: 'roll', sb: 'push', ac: ['S','D','S','D','S','E','S','D'], av: 1, acut: [0.5,0.57,0.64,0.71,0.78,0.85,0.92,1], cut: 0.8,
                          e: { 6: [[0,'rise',32,0.45]] }, fill: 'roll32', gap: true },
      /* 10 ANTHEM   */ { prog: ['Em','C','D','Em','C','D','Em','B'], dr: 'houseF', bs: 'roll', sb: 'offX', l: 'theme', lo: 12, dbl: 1, ac: 'A', av: 0.6, acut: 0.8, rd: 1, cut: 1, crash: 1, e: { 0: [[0,'sub',1]] }, fill: 'roll8' },
      /* 11 ANTHEM II */ { prog: ['Em','C','G','D','Em','C','Am','B'], dr: 'houseF', bs: 'roll', sb: 'off', l: 1, dbl: 1, ac: 'B', av: 0.6, acut: 0.8, rd: 1, cut: 1, fill: 'roll16', e: { 6: [[0,'rise',32,0.4]] } },
      /* 12 THE TURN */ { prog: ['C','D','Em','Em','C','D','B','B'], dr: 'house', bs: ['roll','roll','roll','roll','roll','roll','roll','walk'], sb: 'eighths', sv: 0.75, ac: 'D', av: 0.7, acut: 0.9, ap: 1.4,
                          cut: [0.9,0.9,0.95,0.95,1,1,1,1], crash: 1, fill: 'roll32', e: { 7: [[0,'rise',16,0.5]] } }
    ];
    var steps = [], prevAcid = 0;
    SEC.forEach(function (sec) {
      var lead = sec.l === undefined ? null : sec.l === 'theme' ? THEME.slice(0, sec.tb || 8) : LEADS[sec.l], prevLead = 0;
      for (var b = 0; b < 8; b++) {
        var ch = CH[sec.prog[b]], odd = b % 2 === 1, last = b === 7, dr = pick(sec.dr, b, 'none'), bs = pick(sec.bs, b, N), sbp = sec.sb ? ST[sec.sb] : N;
        var acn = pick(sec.ac, b, N), acid = acn ? AP[acn] : N, acut = pick(sec.acut, b, 0.5), cut = pick(sec.cut, b, 0.8), apv = pick(sec.ap, b, 0);
        var six = [0, ch.q, 7, 12, 12 + ch.q, 19].map(function (iv) { return ch.r + 24 + iv; });
        var lmap = {}, evs = {};
        if (lead && lead[b]) lead[b].forEach(function (e) { lmap[e[0]] = e; });
        if (sec.ml && sec.ml.indexOf(b) >= 0) MENACE.forEach(function (e) { lmap[e[0]] = e; });
        ((sec.e || {})[b] || []).forEach(function (e) { (evs[e[0]] = evs[e[0]] || []).push(e); });
        for (var i = 0; i < 16; i++) {
          var st = { cut: cut };
          drums(dr, i, odd, st);
          if (bs === 'roll') { if (i % 4 !== 0) st.bs = { n: ch.r + (i % 4 === 3 ? 12 : 0), len: 0.85, v: i % 4 === 2 ? 1 : 0.85 }; }
          else if (bs === 'gallop') st.bs = { n: ch.r + (i % 8 === 6 ? 12 : 0), len: 0.8, v: i % 4 === 0 ? 1 : 0.8 };
          else if (bs === 'pedal') { if (i % 2 === 0) st.bs = { n: ch.r + ((i / 2) % 2 ? 12 : 0), len: 1.5, v: 0.6 + b * 0.08 }; }
          else if (bs === 'long') { if (i === 0) st.bs = { n: ch.r, len: 15, v: 0.35 }; }
          else if (bs === 'walk') { if (i < 8) { if (i % 4 !== 0) st.bs = { n: ch.r + (i % 4 === 3 ? 12 : 0), len: 0.85, v: 0.9 }; } else if (i % 2 === 0) st.bs = { n: WALK[(i - 8) / 2], len: 1.8, v: 1 }; }
          if (sbp && sbp.charAt(i) !== '.') st.sb = { notes: ch.tri, len: sbp.charAt(i) === 'X' ? 3 : 1.4, v: (sbp.charAt(i) === 'X' ? 1 : 0.8) * (sec.sv || 1) };
          if (acid && acid[i]) {
            var n = sdeg(acid[i][0] + ch.sh, ch), gap = 1, k;
            for (k = i + 1; k < 16 && !acid[k]; k++) gap++;
            st.ac = { n: n, len: gap * 0.9, v: sec.av || 1, acc: acid[i][1], sl: acid[i][2] ? prevAcid : 0, cut: acut };
            prevAcid = n;
          }
          if (apv) st.ap = { n: six[ARP[i]], v: apv * (i % 4 === 0 ? 1 : 0.8) };
          if (sec.pd && i === 0 && (b === 0 || sec.prog[b] !== sec.prog[b - 1] || !odd)) st.pd = { notes: [ch.r + 12, ch.r + 12 + ch.q, ch.r + 19], len: b < 7 && sec.prog[b + 1] === sec.prog[b] ? 32 : 16, v: sec.pd };   // a chord a bar or two, re-struck when the harmony moves
          if (lmap[i]) {
            var m = lmap[i], menace = sec.ml && sec.ml.indexOf(b) >= 0, ln = m[1] + (sec.lo || 0);
            st.ld = { n: ln, len: m[2], v: (i === 0 ? 1 : 0.86) * (sec.lv || 1), kind: menace ? 'wail' : sec.lk || 'lift', sl: m[3] ? prevLead : 0, dbl: sec.dbl };
            if (sec.harm && m[2] >= 2) st.ld.h = under(ln, ch);
            prevLead = ln;
          }
          if (sec.rd && i % 2 === 0) st.rd = 0.5;
          if (i === 0 && b === 0 && sec.crash) st.cr = sec.crash;
          if (last && sec.fill) {
            if (sec.fill === 'roll8' && i === 8) st.rl = { n: 8, v0: 0.5, v1: 1 };
            else if (sec.fill === 'roll16' && i === 0) st.rl = { n: 16, v0: 0.4, v1: 1 };
            else if (sec.fill === 'roll32' && i === 8) st.rl = { n: 16, dt: 0.5, v0: 0.5, v1: 1 };
            if (sec.fill === 'roll16' || i >= 8) { st.sn = 0; st.cp = 0; }
          }
          (evs[i] || []).forEach(function (e) {
            if (e[1] === 'crash') st.cr = e[2]; else if (e[1] === 'sub') st.su = e[2]; else if (e[1] === 'rise') st.ri = { len: e[2], v: e[3], hi: e[4] }; else if (e[1] === 'fall') st.fa = { d: e[2], v: e[3] };
          });
          if (sec.gap && last && i >= 14) { st.kk = 0; st.sn = 0; st.cp = 0; st.ht = null; st.bs = null; st.sb = null; st.ac = null; st.ap = null; st.rd = 0; }
          steps.push(st);
        }
      }
    });
    return SPACE2 = finish(SP2_BPM, SEC, steps);
  }
  function playSpace2(st, t, spb) {
    hitDrums(st, t, spb, false);
    if (st.pd) pad(st.pd.notes, t, st.pd.len * spb, st.pd.v, true);
    if (st.sb) stab(st.sb.notes, t, st.sb.len * spb, st.sb.v, st.cut);
    if (st.bs) rbass(st.bs.n, t, st.bs.len * spb, st.bs.v, st.cut);
    if (st.ac) acid(st.ac.n, t, st.ac.len * spb, st.ac.v, st.ac.acc, st.ac.sl, st.ac.cut);
    if (st.ap) arp(st.ap.n, t, spb * 1.1, st.ap.v, true);
    if (st.ld) {
      lead(st.ld.n, t, st.ld.len * spb * 0.92, st.ld.v, st.ld.kind, st.ld.sl);
      if (st.ld.h) lead(st.ld.h, t, st.ld.len * spb * 0.9, st.ld.v * 0.5, 'lift', 0);
      if (st.ld.dbl) lead(st.ld.n - 12, t, st.ld.len * spb * 0.92, st.ld.v * M.dbl, 'pulse', st.ld.sl ? st.ld.sl - 12 : 0);
    }
  }

  /* --- TLB: E minor at 178, 74 bars (2 of alarm, then a 72-bar loop) ---------------------
     PEER REVIEW, the hive. Sixteenth arpeggios over a bass that walks down chromatically
     (E D# D C# C B Bb B) under minor-major-seventh, diminished-seventh and flat-nine
     chords; an augmented climb over an E pedal; a spiral in which everything rises a
     semitone a bar over a chromatic bass; a choir on the cluster E F G B; a riser in
     the last two bars of every section, and no bar without a kick. */
  var TLB_BPM = 178, TLB = null;
  function composeTLB() {
    if (TLB) return TLB;
    var CH = {   // r: bass root, a: arpeggio ladder, v: choir voicing, tri: stab/hoover triad
      Em:   { r: 40, a: [64,67,71,76,79,83], v: [52,59,64,67], tri: [64,67,71] },
      EmM7: { r: 39, a: [63,64,67,71,75,76], v: [51,59,63,67], tri: [63,67,71] },
      Em7:  { r: 38, a: [62,64,67,71,74,76], v: [50,59,62,67], tri: [62,67,71] },
      Cs07: { r: 37, a: [61,64,67,70,73,76], v: [49,58,61,67], tri: [61,64,70] },
      CM7:  { r: 36, a: [60,64,67,71,72,76], v: [48,55,60,64], tri: [60,64,67] },
      B7:   { r: 35, a: [59,63,66,69,71,75], v: [47,57,59,63], tri: [59,63,66] },
      Bb07: { r: 34, a: [58,61,64,67,70,73], v: [46,55,58,61], tri: [58,61,64] },
      B7b9: { r: 35, a: [59,63,66,69,72,75], v: [47,57,60,63], tri: [59,63,72] },
      Eaug: { r: 40, a: [64,68,72,76,80,84], v: [52,56,60,64], tri: [64,68,72] },
      Faug: { r: 40, a: [65,69,73,77,81,85], v: [53,57,61,65], tri: [65,69,73] },
      Fsaug:{ r: 40, a: [66,70,74,78,82,86], v: [54,58,62,66], tri: [66,70,74] },
      Gaug: { r: 40, a: [67,71,75,79,83,87], v: [55,59,63,67], tri: [67,71,75] },
      Emb9: { r: 40, a: [64,65,67,71,76,77], v: [52,59,64,65], tri: [64,65,71] },
      Bb:   { r: 34, a: [58,62,65,70,74,77], v: [46,58,62,65], tri: [58,62,65] }
    };
    var DESC = ['Em','EmM7','Em7','Cs07','CM7','B7','Bb07','B7b9'], AUG = ['Eaug','Faug','Fsaug','Gaug','Eaug','Faug','Fsaug','B7b9'];
    var CHAOS = ['Emb9','Bb','Emb9','Bb','Emb9','Bb','Emb9','Bb'];
    function spiral(b) { var base = 64 + b; return { r: 40 + b, a: [0, 3, 6, 9, 12, 15].map(function (x) { return base + x; }), v: [52 + b, 55 + b, 58 + b, 61 + b], tri: [base, base + 3, base + 6] }; }
    var N = null, ARP = {
      updown: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1],
      up:     [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5],
      cross:  [0, 2, 4, 1, 3, 5, 0, 2, 4, 1, 3, 5, 0, 2, 4, 1]    // threes against the four
    };
    var LEADS = [
      [[[0,88,4],[4,86,2],[6,88,2],[8,91,8]], [[0,87,6],[6,88,2],[8,83,8]], [[0,86,4],[4,83,4],[8,79,8]], [[0,82,4],[4,79,4],[8,76,8]],
       [[0,84,4],[4,88,4],[8,91,4],[12,95,4]], [[0,93,6],[6,90,2],[8,87,8,1]], [[0,85,4],[4,82,4],[8,79,4],[12,76,4]], [[0,87,8,1],[8,84,4],[12,83,4]]],
      [[[0,76,2],[2,79,2],[4,83,2],[6,88,2],[8,91,8]], [[0,87,4],[4,88,4],[8,83,8]], [[0,86,2],[2,83,2],[4,79,2],[6,74,2],[8,79,8]], [[0,82,4],[4,79,4],[8,73,8]],
       [[0,84,4],[4,88,4],[8,91,8]], [[0,93,4],[4,90,4],[8,87,8,1]], [[0,85,2],[2,82,2],[4,79,2],[6,76,2],[8,73,8]], [[0,84,4],[4,87,4],[8,83,8]]]
    ];
    // prog · dr feel · ap arp pattern · apv arp vel · oct: double the arp an octave up · bs bass ('eighths' | 'sixteenths' | 'pedal8' | 'tritone')
    // ch choir {vel, vow} · sb stab pattern · hv hoover {bar:[[step,len,vel]]} · l lead · gliss: a held lead sliding up a semitone a bar
    // tp timpani · rolls {bar: 'roll8'|'roll16'|'roll32'} · rise {bar: [len, vel, hi]} · al alarm bars · dn drone · gap
    // bars: the section's length when it is not 8 (the intro) · crash: open on a crash, which also makes a loop section an entry for a replay
    var SEC = [
      /* 0 ALARM     */ { bars: 2, prog: ['Emb9','Em'], dr: ['four','build16'], ap: 'updown', apv: [0.8,1], bs: 'eighths', ch: { vel: 0.6, vow: 'ooh' }, al: [0], dn: 0.7, tp: [0], rise: { 0: [32,0.45] }, crash: 0.5, gap: true },
      /* 1 ONSLAUGHT */ { prog: DESC, dr: 'double', ap: 'updown', apv: 1.4, bs: 'eighths', sb: 'X.....x.........', tp: true, rolls: { 3: 'roll8', 7: 'roll16' }, rise: { 6: [32,0.45] }, crash: 1 },
      /* 2 ONSLAUGHT II */ { prog: DESC, dr: 'double', ap: 'up', oct: 1, bs: 'eighths', ch: { vel: 0.9, vow: 'aah', thin: true }, sb: 'X.......X.......', tp: true, rolls: { 3: 'roll8', 7: 'roll16' }, rise: { 6: [32,0.45] } },
      /* 3 HAMMER    */ { prog: AUG, dr: ['war','war','war','war','war','war','build8','build16'], ap: [N,N,N,N,'updown','updown','updown','updown'], bs: 'pedal8',
                          hv: { 0: [[0,6,1]], 1: [[0,6,0.9]], 2: [[0,6,0.9]], 3: [[0,6,0.9],[8,3,0.8]], 4: [[0,6,1]], 5: [[0,6,0.9]], 6: [[0,6,0.9]], 7: [[0,8,1.1]] }, rise: { 6: [32,0.5] }, crash: 1 },
      /* 4 SPIRAL    */ { prog: 'spiral', dr: 'double', ap: 'up', oct: 1, bs: 'sixteenths', ch: { vel: 0.7, vow: 'ooh' }, gliss: 88, rolls: { 7: 'roll32' }, rise: { 0: [128,0.5,9000] }, gap: true },
      /* 5 THE WAIL  */ { prog: DESC, dr: 'double', ap: 'updown', bs: 'eighths', l: 0, sb: 'X...............', tp: true, rolls: { 3: 'roll8', 7: 'roll16' }, rise: { 6: [32,0.45] }, crash: 1, sub: 1 },
      /* 6 THE WAIL II */ { prog: DESC, dr: 'double', ap: 'up', bs: 'eighths', l: 1, ch: { vel: 0.85, vow: 'aah', thin: true }, tp: true, rolls: { 3: 'roll8', 7: 'roll16' }, rise: { 6: [32,0.45] } },
      /* 7 CHAOS     */ { prog: CHAOS, dr: ['double','double','double','double','build8','build8','build16','build16'], ap: 'cross', oct: 1, bs: 'tritone', ch: { vel: 1, vow: 'ooh', thin: true },
                          hv: { 0: [[0,4,1],[8,4,0.9]], 2: [[0,4,1],[8,4,0.9]], 4: [[0,4,1],[8,4,0.9]], 6: [[0,4,1],[8,4,1]] }, rolls: { 7: 'roll32' }, rise: { 0: [128,0.55,9000] }, crash: 1, gap: true },
      /* 8 THE END   */ { prog: DESC, dr: 'double', ap: 'up', bs: 'eighths', l: 0, ch: { vel: 1, vow: 'aah', thin: true }, sb: 'X.......X.......', tp: true, rolls: { 3: 'roll8', 7: 'roll16' }, rise: { 6: [32,0.5] }, crash: 1, sub: 1 },
      /* 9 SPIRAL II */ { prog: 'spiral', dr: 'double', ap: 'up', oct: 1, bs: 'sixteenths', ch: { vel: 0.8, vow: 'ooh' }, gliss: 88, tp: true, rolls: { 7: 'roll32' }, rise: { 0: [128,0.55,9000] }, big: true }
    ];
    var steps = [];
    SEC.forEach(function (sec) {
      var lead = sec.l === undefined ? null : LEADS[sec.l], prevLead = 0, bars = sec.bars || 8;
      for (var b = 0; b < bars; b++) {
        var ch = sec.prog === 'spiral' ? spiral(b) : CH[sec.prog[b]], odd = b % 2 === 1, last = b === bars - 1, dr = pick(sec.dr, b, 'none'), ap = pick(sec.ap, b, N), apv = pick(sec.apv, b, 1), bs = pick(sec.bs, b, N);
        var hvs = {}, lmap = {}, rl = sec.rolls && sec.rolls[b], rs = sec.rise && sec.rise[b];
        ((sec.hv || {})[b] || []).forEach(function (e) { hvs[e[0]] = e; });
        if (lead) lead[b].forEach(function (e) { lmap[e[0]] = e; });
        for (var i = 0; i < 16; i++) {
          var st = {};
          drums(dr, i, odd, st);
          if (last && sec.big) fillBar(i, st, true);
          if (ap) st.ap = { n: ch.a[ARP[ap][i]], v: apv * (i % 4 === 0 ? 1 : 0.8), o: sec.oct };
          if (bs === 'eighths') { if (i % 2 === 0) st.bs = { n: ch.r + (odd && i === 14 ? 12 : 0), len: 1.7, v: i % 4 === 0 ? 1 : 0.85 }; }
          else if (bs === 'sixteenths') st.bs = { n: ch.r + (i % 4 === 3 ? 12 : 0), len: 0.85, v: i % 4 === 0 ? 1 : 0.8 };
          else if (bs === 'pedal8') { if (i % 2 === 0) st.bs = { n: 40 + (i === 14 ? (odd ? 3 : 1) : 0), len: 1.6, v: i % 4 === 0 ? 1 : 0.85 }; }
          else if (bs === 'tritone') { if (i % 2 === 0) st.bs = { n: (i / 2) % 2 ? 46 : 40, len: 1.6, v: 1 }; }
          if (sec.sb && sec.sb.charAt(i) !== '.') st.sb = { notes: ch.tri, len: sec.sb.charAt(i) === 'X' ? 3 : 1.5, v: sec.sb.charAt(i) === 'X' ? 1 : 0.8 };
          if (hvs[i]) st.hv = { notes: ch.tri, len: hvs[i][1], v: hvs[i][2] };
          if (sec.ch && i === 0 && b === 0) st.vow = sec.ch.vow;
          if (sec.ch && i === 0 && (sec.prog !== CHAOS ? true : !odd)) st.chr = { notes: sec.ch.thin ? ch.v.slice(1) : ch.v, len: sec.prog === CHAOS ? 32 : 16, v: sec.ch.vel };
          if (lmap[i]) { st.ld = { n: lmap[i][1], len: lmap[i][2], v: i === 0 ? 1 : 0.86, sl: lmap[i][3] ? prevLead : 0 }; prevLead = lmap[i][1]; }
          if (sec.gliss && i === 0) st.ld = { n: sec.gliss + b, len: 16, v: 0.8, sl: b ? sec.gliss + b - 1 : 0 };
          if (sec.tp === true || (sec.tp && sec.tp.indexOf(b) >= 0)) { if (i === 0) st.tp = { n: ch.r + 7, v: 1 }; else if (i === 8 && sec.oct) st.tp = { n: ch.r + 7, v: 0.6 }; }
          if (sec.al && sec.al.indexOf(b) >= 0 && i % 2 === 0) st.al = { hi: i % 4 === 0, v: 0.7 + 0.1 * b };
          if (sec.dn && i === 0 && b === 0) st.dn = { n: 28, len: 16 * bars, v: sec.dn };
          if (rl) {
            if (rl === 'roll8' && i === 8) st.rl = { n: 8, v0: 0.5, v1: 1 };
            else if (rl === 'roll16' && i === 0) st.rl = { n: 16, v0: 0.4, v1: 1 };
            else if (rl === 'roll32' && i === 8) st.rl = { n: 16, dt: 0.5, v0: 0.5, v1: 1 };
            if (rl === 'roll16' || i >= 8) { st.sn = 0; st.tm = 0; }
          }
          if (rs && i === 0) st.ri = { len: rs[0], v: rs[1], hi: rs[2] };
          if (i === 0 && b === 0 && sec.crash) st.cr = sec.crash;
          if (i === 0 && b === 0 && sec.sub) st.su = sec.sub;
          if (sec.gap && last && i >= 14) { st.kk = 0; st.sn = 0; st.tm = 0; st.ht = null; st.bs = null; st.ap = null; st.sb = null; st.hv = null; st.rl = null; }
          steps.push(st);
        }
      }
    });
    return TLB = finish(TLB_BPM, SEC, steps);
  }
  function playTLB(st, t, spb) {
    hitDrums(st, t, spb, true);
    if (st.dn) drone(st.dn.n, t, st.dn.len * spb, st.dn.v);
    if (st.al) alarm(t, st.al.hi, st.al.v);
    if (st.vow) K.vowel(st.vow, t, 0.3);
    if (st.chr) choir(st.chr.notes, t, st.chr.len * spb, st.chr.v);
    if (st.tp) K.timp(st.tp.n, t, st.tp.v * M.timp, false);
    if (st.ap) { arp(st.ap.n, t, spb * 1.1, st.ap.v, true); if (st.ap.o) arp(st.ap.n + 12, t, spb * 1.0, st.ap.v * 0.6, false); }
    if (st.bs) rbass(st.bs.n, t, st.bs.len * spb, st.bs.v, 0.9);
    if (st.sb) stab(st.sb.notes, t, st.sb.len * spb, st.sb.v, 0.9);
    if (st.hv) hoover(st.hv.notes, t, st.hv.len * spb, st.hv.v);
    if (st.ld) lead(st.ld.n, t, st.ld.len * spb * 0.92, st.ld.v, 'wail', st.ld.sl);
  }

  /* --- stingers: one-shots on riff.js's stinger bus, so they sound with the music off ---- */
  function organChord(notes, t, dur, v, dest) {   // the low organ under the magician's arrival: drawbar wave, slow release
    notes.forEach(function (n, k) {
      var o = osc(wave('organ'), f(n), t, t + dur + 0.6, k * 3 - 4), g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.1, t + 0.02); g.gain.setValueAtTime(v * 0.1, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
      o.connect(g); g.connect(dest);
    });
  }
  var STING = {
    // the magician's arrival: a reversed swell (noise and a fifth swelling into an opening filter), a flame-crack hit, a low D minor organ.
    // magician.js starts his track 0.8 s after this (by the game's clock); the crack at t + 0.89 is where play() puts that
    // track's first step (0.12 s after the call), and the CUE keeps the track's grid on the crack if a slow frame moved the call.
    reveal: function (t) {
      var dry = D, wet = W, T = t + 0.89;
      CUE = { AC: AC, name: 'magician', t: T };
      K.duckFor(0.3, T - 0.2 - AC.currentTime, 0.3);   // a track already playing dips under the swell and is back for the crack
      var s = K.loopNoise(), bp = AC.createBiquadFilter(), g = AC.createGain(); bp.type = 'bandpass'; bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5000, T);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, T - 0.01); g.gain.setValueAtTime(0.0001, T);
      s.connect(bp); bp.connect(g); g.connect(wet); s.start(t, Math.random() * 2.5); s.stop(T + 0.02);
      var lp = AC.createBiquadFilter(), cg = AC.createGain(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(3200, T);
      cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.22, T - 0.01); cg.gain.setValueAtTime(0.0001, T); lp.connect(cg); cg.connect(wet);
      [50, 57, 62].forEach(function (n) { [-9, 9].forEach(function (det) { osc('sawtooth', f(n), t, T + 0.02, det).connect(lp); }); });
      burst(T, 0.05, 0.9, 'highpass', 2500, 0.5, dry);                                                  // the crack
      sub(T, 1.2, dry);
      var wh = K.sNoise('lowpass', 1400, 160, 0.8, T, 0.9, 0.5, 0.01, dry); wh.gain.setValueAtTime(0.5, T + 0.05);   // the flame
      for (var k = 0; k < 14; k++) burst(T + 0.06 + k * 0.045 + (k % 3) * 0.011, 0.018, 0.3 * (1 - k / 16), 'bandpass', 3200 + (k % 4) * 700, 2.5, wet);   // crackle
      organChord([38, 45, 50, 53], T + 0.03, 1.1, 1, wet);
    },
    // tenure: the true ending. E major, the shooter's lead quoted straight (E G# B E) by the horns, a IV-V-I with timpani, bells over a held chord
    tenure: function (t) {
      var dry = D, wet = W;
      K.duckFor(0, 6.8, 1.3);
      function bellTone(n, at, len, v) { [1, 2.76, 5.4].forEach(function (r, j) { K.sTone('sine', f(n) * r, at, len - j * 0.4, v * [0.22, 0.06, 0.02][j], 0.003, wet); }); }
      function padc(notes, at, len, v) { notes.forEach(function (n, k) { var o = osc('triangle', f(n), at, at + len + 0.7, k * 4 - 6), g = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(v * 0.07, at + 0.3); g.gain.setValueAtTime(v * 0.07, at + Math.max(0.35, len - 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.6); o.connect(lp); lp.connect(g); g.connect(wet); }); }
      K.sTimp(40, t, 1, dry); K.sTone('sine', f(28), t, 1.4, 0.4, 0.01, dry);
      [[76, 0, 0.2], [80, 0.22, 0.2], [83, 0.44, 0.2], [88, 0.66, 1.0], [87, 1.7, 0.24], [88, 1.96, 0.24], [83, 2.22, 0.5], [80, 2.76, 0.5], [81, 3.3, 0.35], [83, 3.66, 0.35], [88, 4.05, 2.6]].forEach(function (n) { K.sHorns([n[0]], t + n[1], n[2], 0.2, wet); });
      K.sHorns([40, 52, 56, 59, 64], t + 0.66, 1.0, 0.1, wet);   // E
      K.sHorns([45, 57, 61, 64, 69], t + 2.22, 1.0, 0.1, wet);   // A: IV
      K.sHorns([47, 59, 63, 66, 71], t + 3.3, 0.72, 0.11, wet);  // B: V
      K.sHorns([40, 52, 56, 59, 64, 68, 71, 76], t + 4.05, 2.6, 0.12, wet);   // E, with the third and the fifth on top
      padc([52, 56, 59, 64], t + 0.66, 1.5, 1); padc([45, 57, 61, 64], t + 2.22, 1.05, 1); padc([47, 59, 63, 66], t + 3.3, 0.72, 1); padc([52, 56, 59, 64, 68], t + 4.05, 2.7, 1.3);
      K.sTimp(45, t + 2.22, 0.8, dry); K.sTimp(47, t + 3.3, 0.85, dry); K.sTimp(47, t + 3.66, 0.6, dry); K.sTimp(40, t + 4.05, 1, dry);
      for (var k = 1; k < 16; k++) K.sTimp(40, t + 4.05 + k * 0.09, 0.5 * (1 - k / 18), dry);
      K.sNoise('highpass', 5000, 4000, 0.7, t + 4.05, 2.4, 0.3, 0.004, dry);
      [64, 68, 71, 76, 80, 83, 88].forEach(function (n, k) { bellTone(n, t + 4.3 + k * 0.14, 2.2, 1); });
      K.sTone('sine', f(28), t + 4.05, 2.8, 0.42, 0.02, dry);
    },
    // the True Last Boss warning: a huge sub drop, a diminished chord rising and opening, a two-tone alarm through the echo
    tlbwarn: function (t) {
      var dry = D, wet = W;
      K.duckFor(0.2, 2.7, 0.8);
      var o = osc('sine', 150, t, t + 2.4), g = AC.createGain(); o.frequency.exponentialRampToValueAtTime(24, t + 1.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95, t + 0.02); g.gain.setValueAtTime(0.95, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0008, t + 2.3); o.connect(g); g.connect(dry);
      burst(t, 0.06, 0.6, 'lowpass', 900, 0.7, dry);
      var lp = AC.createBiquadFilter(), cg = AC.createGain(); lp.type = 'lowpass'; lp.Q.value = 2.5; lp.frequency.setValueAtTime(260, t + 0.3); lp.frequency.exponentialRampToValueAtTime(5200, t + 2.6);
      cg.gain.setValueAtTime(0.0001, t + 0.3); cg.gain.exponentialRampToValueAtTime(0.32, t + 2.5); cg.gain.setValueAtTime(0.32, t + 2.75); cg.gain.exponentialRampToValueAtTime(0.0001, t + 3.0); lp.connect(cg); cg.connect(wet);
      [52, 55, 58, 61].forEach(function (n, k) { [-9, 9].forEach(function (det) { var x = osc('sawtooth', f(n), t + 0.3 + k * 0.2, t + 3.05, det); x.detune.setValueAtTime(det, t + 2.0); x.detune.linearRampToValueAtTime(det + 100, t + 2.75); x.connect(lp); }); });
      for (var k = 0; k < 15; k++) alarm(t + 0.2 + k * 0.16, k % 2 === 0, 1.3);
    }
  };

  /* --- registration -------------------------------------------------------- */
  R.addStyle('magician', { dreadful: false, schedule: function (S) { enter('magician', MAG_BPM); drive('magician', composeMagician(), S, playMagician); }, info: function () { return describe(composeMagician(), 'ld'); } });
  R.addStyle('space2', { dreadful: false, schedule: function (S) { enter('space2', SP2_BPM); drive('space2', composeSpace2(), S, playSpace2); }, info: function () { return describe(composeSpace2(), 'ld'); } });
  R.addStyle('tlb', { dreadful: false, schedule: function (S) { enter('tlb', TLB_BPM); drive('tlb', composeTLB(), S, playTLB); }, info: function () { return describe(composeTLB(), 'ap'); } });
  Object.keys(STING).forEach(function (name) { R.addStinger(name, function (t) { enter('sting'); STING[name](t); }); });
})();
