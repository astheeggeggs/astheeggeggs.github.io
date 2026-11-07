/* The KONAMI-style boot jingle, sung: "PA PA PA PAL-MER" on the tune of the short jingle that plays over the
   Konami logo when Metal Gear Solid boots (itself the leitmotif of Policenauts, "End of the Dark"). Only the
   Solid Snake skin hears it (intro.js decides). Same DSP as chant.js, generalised to a sung line: a small
   detuned choir of band-limited glottal saws through a Klatt-style cascade of formant resonators, /p/ bursts
   of low-passed noise, a small room and a dotted-eighth echo; synthesised once at 22.05 kHz (a PlayStation
   SPU rate, no 8-bit DAC this time) and cached.

   THE TUNE IS TRANSCRIBED FROM A RECORDING OF THE REAL JINGLE (2026-11-01, .dev/tmp/hum/, the laptop fan's
   whine subtracted) and Duncan confirmed a plain resynthesis of it by ear: notes in thirds, four slow
   (~0.67 s apart) then two quick (~0.33 s). Phrase 1 is A+C x4 then G+B x2; phrase 2 answers with G+B x4
   then A+C x2. Sung "pa pa pa" on the first three, "PAL" on the fourth, "MER" across the quick pair, every
   note a short stab (STAC) with silence between and the room echo behind. The site plays both phrases, the
   second starting GAP (5.32 s, measured) after the first. Variants: 0 both phrases (the site's); 1 phrase 1
   alone; 2 phrase 2 alone. Edit SCORES below to change the tune.

   window.PalmerKonami = {
     duration: seconds,
     render(sampleRate [, variant]) -> Float32Array   mono, pure JS, cached; works under node
     warm([sampleRate])                               render ahead of time (intro.js calls it only when the jingle is due)
     play(ctx [, dest]) -> { stop(fadeSeconds) }      schedule it on an AudioContext
   } */
(function () {
  'use strict';

  var FS = 22050;                   // synthesis rate
  var PEAK = 0.708;                 // -3 dBFS
  var STEP = 0.28;                  // one eighth note
  var T0 = 0.06;                    // the first lip burst
  var VOT = 0.035;                  // burst to voicing: an aspirated /p/
  var HOLD = 0.32;                  // the last note, from its onset to the end of voicing
  var DURATION = 3.8;               // one phrase: voicing ends ~3.1 s; the echo rings on
  var GAP = 5.32;                   // phrase 2 starts this long after phrase 1 (measured: 6.42 - 1.10 s)
  var STAC = [0.18, 0.18, 0.18, 0.18, 0.14, 0.32];   // staccato: how long each note sounds before it is cut (Duncan: "quite staccato")
  var cache = {}, cores = {};

  var A4 = 69, G4 = 67, F4 = 65, E4 = 64, B4 = 71, C5 = 72, D5 = 74, E5 = 76;
  var RHYTHM = [0, 0.68, 1.35, 2.01, 2.33, 2.67];   // seconds, measured from the recording (both phrases agree within 0.03 s)
  // six notes on RHYTHM, `notes` the upper voice and `low` the voice a third below; `mer` is the note on which "MER" lands (the notes before it after the third
  // belong to "PAL", the notes after it are "MER" held as a melisma)
  var SCORES = [
    { notes: [C5, C5, C5, C5, B4, B4], low: [A4, A4, A4, A4, G4, G4], mer: 4 },
    { notes: [B4, B4, B4, B4, C5, C5], low: [G4, G4, G4, G4, A4, A4], mer: 4 },
    { notes: [C5 - 12, C5 - 12, C5 - 12, C5 - 12, B4 - 12, B4 - 12], low: [A4 - 12, A4 - 12, A4 - 12, A4 - 12, G4 - 12, G4 - 12], mer: 4 }
  ];
  function onsets() { var o = [], i; for (i = 0; i < 6; i++) o.push(T0 + RHYTHM[i]); return o; }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ---- phoneme timeline -------------------------------------------------------------------------
  // rows: [t, F1, F2, F3, B1, B2, B3, nasalPole, nasalZero, voiceAmp]; smoothstep between rows.
  var CL  = [380,  900, 2300,  90, 110, 170, 500, 500];   // lips closed
  var LOC = [420,  950, 2350,  90, 110, 170, 500, 500];   // labial locus at the burst
  var AH  = [730, 1090, 2440,  90, 110, 170, 500, 500];
  var L   = [360, 1300, 2700,  80, 120, 180, 500, 500];
  var M   = [300, 1100, 2300, 120, 220, 260, 250, 900];   // closed-mouth hum: the nasal pair parts
  var OPN = [450, 1250, 1900,  90, 110, 160, 500, 500];
  var ER  = [500, 1350, 1650,  80, 100, 130, 500, 500];
  var RR  = [470, 1270, 1480,  80, 100, 120, 500, 500];
  var RR2 = [450, 1230, 1420,  80, 100, 120, 500, 500];

  function track(sc) {
    var k = [], on = onsets(), mm = on[sc.mer], vend = on[5] + HOLD, i;
    function row(t, f, av) { k.push([t, f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], av]); }
    row(0, CL, 0);
    for (i = 0; i < 4; i++) {                       // PA PA PA PAL: each a burst, a puff, a sung stab
      row(on[i], LOC, 0);
      row(on[i] + VOT, AH, 0);
      row(on[i] + VOT + 0.05, AH, 1.0);
      if (i < 3) { row(on[i + 1] - 0.075, AH, 0.8); row(on[i + 1] - 0.035, CL, 0); }
    }
    row(mm - 0.17, AH, 0.9);                        // ...AL
    row(mm - 0.11, L, 1.25); row(mm - 0.075, L, 1.25);
    row(mm - 0.05, M, 0.95); row(mm + 0.02, M, 0.95); // M: the hum takes the new note just before the beat
    row(mm + 0.06, OPN, 0.85);
    row(mm + 0.12, ER, 1.3);                        // ER, held
    row(vend - 0.45, ER, 1.3);
    row(vend - 0.2, RR, 1.0);                       // RRR: F3 sinks as it fades
    row(vend, RR2, 0);
    row(DURATION + 1, RR2, 0);
    return k;
  }

  // ---- pitch: the line, gliding into each note; the voices sit on it -----------------------------
  function line(sc, which) {
    var on = onsets(), lg = [], gs = [], gl = [], i, ns = which || sc.notes;
    for (i = 0; i < 6; i++) {
      lg.push(Math.log(hz(ns[i])));
      if (i < 4) { gs.push(on[i] - 0.05); gl.push(0.04); }                  // under the closure: inaudible
      else if (i === sc.mer) { gs.push(on[i] - 0.12); gl.push(0.06); }      // before the M hum
      else { gs.push(on[i] - 0.04); gl.push(0.07); }                        // a melisma: a sung portamento
    }
    return function (t) {
      var v = lg[0];
      for (var j = 1; j < 6; j++) v += (lg[j] - lg[j - 1]) * smooth((t - gs[j]) / gl[j]);
      return Math.exp(v);
    };
  }
  // [ratio to its line, level, detune cents, which line: 0 the upper voice, 1 the voice a third below]. The two
  // parts in thirds are the jingle; the octave under the lower part gives body, a thin octave up the edge.
  function choir() {
    return [
      [1, 1.00, -7, 0], [1, 0.95, 6, 0], [1, 0.85, 13, 0],
      [1, 0.95, -5, 1], [1, 0.85, 9, 1], [1, 0.75, -12, 1],
      [0.5, 0.40, 4, 1],
      [2, 0.14, 3, 0]
    ];
  }

  function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }

  // ---- render -----------------------------------------------------------------------------------
  function core(variant) {
    var sc = SCORES[variant], sr = FS, n = Math.round(DURATION * sr), BL = 8;   // variant here is a SCORES index
    var src = new Float32Array(n), out = new Float32Array(n);
    var on = onsets(), vend = on[5] + HOLD, pitch = line(sc), pitchLo = line(sc, sc.low);
    function gate(t) {                                  // staccato: up 12 ms after the burst, down over 30 ms at the cut
      for (var q = 5; q >= 0; q--) if (t >= on[q]) {
        var end = on[q] + VOT + STAC[q];
        return smooth((t - on[q] - VOT) / 0.012) * (1 - smooth((t - end + 0.03) / 0.03));
      }
      return 0;
    }
    var i, j, v, t, e;
    var seed = 20261101;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

    // 1. glottal source: detuned polyBLEP saws on the line, vibrato only on the held note
    var voices = choir(), nv = voices.length;
    for (v = 0; v < nv; v++) {
      var V = voices[v];
      var det = Math.pow(2, V[2] / 1200) * V[0];
      var start = on[0] + VOT + rnd() * 0.02;
      var vibF = 5.1 + rnd() * 0.9, vibP = rnd() * 6.283, vibD = 0.005 + rnd() * 0.002;
      var dF1 = 0.6 + rnd() * 0.7, dP1 = rnd() * 6.283, dF2 = 1.7 + rnd() * 1.1, dP2 = rnd() * 6.283;
      var ph = rnd();
      for (i = 0; i < n; i += BL) {
        t = i / sr;
        if (t < start) continue;
        if (t > vend) break;
        var g = V[1] * smooth((t - start) / 0.03) * gate(t);
        var f = (V[3] ? pitchLo(t) : pitch(t)) * det;
        var vib = smooth((t - on[5] - 0.2) / 0.4);
        f *= 1 + vibD * vib * Math.sin(6.283185 * vibF * t + vibP) +
             0.0022 * Math.sin(6.283185 * dF1 * t + dP1) + 0.0013 * Math.sin(6.283185 * dF2 * t + dP2);
        var dp = f / sr, lim = 1 - dp, x, u;
        e = i + BL < n ? i + BL : n;
        for (j = i; j < e; j++) {
          ph += dp; if (ph >= 1) ph -= 1;
          x = 2 * ph - 1;
          if (ph < dp) { u = ph / dp; x -= u + u - u * u - 1; }
          else if (ph > lim) { u = (ph - 1) / dp; x -= u * u + u + u + 1; }
          src[j] += g * x;
        }
      }
    }

    // 2. vocal tract: nasal zero + nasal pole + five formant resonators in cascade
    var K = track(sc), ki = 0;
    var PI = Math.PI, TWO_PI_SR = 2 * PI / sr, PI_SR = PI / sr;
    var freq = [0, 0, 0, 0, 0, 3300, 4100], bw = [0, 0, 0, 0, 0, 260, 320];
    var cA = new Float64Array(7), cB = new Float64Array(7), cC = new Float64Array(7);
    var y1 = new Float64Array(7), y2 = new Float64Array(7);
    var zx1 = 0, zx2 = 0, lp = 0, sPrev = 0, PRE = 1.5;
    var hp = 0, hpx = 0, hpK = Math.exp(-2 * PI * 60 / sr);
    var av = 0, ah = 0, s, r, y, w, bi;
    for (i = 0; i < n; i += BL) {
      t = i / sr;
      while (K[ki + 1][0] <= t) ki++;
      var a = K[ki], b = K[ki + 1], m = smooth((t - a[0]) / (b[0] - a[0]));
      freq[2] = a[1] + (b[1] - a[1]) * m; freq[3] = a[2] + (b[2] - a[2]) * m; freq[4] = a[3] + (b[3] - a[3]) * m;
      bw[2] = a[4] + (b[4] - a[4]) * m; bw[3] = a[5] + (b[5] - a[5]) * m; bw[4] = a[6] + (b[6] - a[6]) * m;
      freq[1] = a[7] + (b[7] - a[7]) * m; freq[0] = a[8] + (b[8] - a[8]) * m;
      bw[0] = bw[1] = 110;
      av = a[9] + (b[9] - a[9]) * m;
      ah = 0.05 * av;                                                        // a trace of breath under the choir
      for (bi = 0; bi < 4; bi++) ah += 0.9 * smooth((t - on[bi]) / 0.006) * (1 - smooth((t - on[bi] - VOT) / 0.04));
      for (r = 0; r < 7; r++) {
        cC[r] = -Math.exp(-2 * PI_SR * bw[r]);
        cB[r] = 2 * Math.exp(-PI_SR * bw[r]) * Math.cos(TWO_PI_SR * freq[r]);
        cA[r] = 1 - cB[r] - cC[r];
      }
      var zA = 1 / cA[0], zB = -cB[0] / cA[0], zC = -cC[0] / cA[0];
      e = i + BL < n ? i + BL : n;
      for (j = i; j < e; j++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        s = src[j] * av + (seed / 2147483648 - 1) * ah;
        lp = s + PRE * (s - sPrev); sPrev = s;
        y = zA * lp + zB * zx1 + zC * zx2; zx2 = zx1; zx1 = lp;
        for (r = 1; r < 7; r++) {
          w = cA[r] * y + cB[r] * y1[r] + cC[r] * y2[r];
          y2[r] = y1[r]; y1[r] = w; y = w;
        }
        hp = hpK * (hp + y - hpx); hpx = y;
        out[j] = hp;
      }
    }

    // 3. the four /p/ bursts, scaled against the sung level
    var pk = 0;
    for (i = 0; i < n; i++) { w = out[i] < 0 ? -out[i] : out[i]; if (w > pk) pk = w; }
    if (!(pk > 0)) pk = 1;
    var bK = 1 - Math.exp(-2 * PI * 1500 / sr), bn = Math.round(0.05 * sr);
    for (bi = 0; bi < 4; bi++) {
      var b0 = Math.round(on[bi] * sr), bl = 0, bl2 = 0, amp = pk * (bi === 0 ? 2.2 : 1.6);
      for (i = 0; i < bn && b0 + i < n; i++) {
        t = i / sr;
        bl += bK * ((rnd() * 2 - 1) - bl); bl2 += bK * (bl - bl2);
        out[b0 + i] += amp * bl2 * smooth(t / 0.0015) * Math.exp(-t / 0.010);
      }
    }

    // 4. a small room, then a dotted-eighth echo (the late-80s synth delay of the Policenauts theme)
    var combMs = [29.7, 37.1, 41.1, 43.7], apMs = [5.0, 1.7], wet = new Float32Array(n);
    for (r = 0; r < 4; r++) {
      var cl = Math.round(combMs[r] * sr / 1000), cb = new Float32Array(cl), ci = 0, cf = 0;
      for (i = 0; i < n; i++) {
        y = cb[ci]; cf += 0.45 * (y - cf);
        cb[ci] = out[i] + 0.74 * cf; if (++ci === cl) ci = 0;
        wet[i] += y;
      }
    }
    for (r = 0; r < 2; r++) {
      var al = Math.round(apMs[r] * sr / 1000), ab = new Float32Array(al), ai = 0;
      for (i = 0; i < n; i++) {
        y = ab[ai]; w = wet[i] + 0.5 * y; ab[ai] = w; if (++ai === al) ai = 0;
        wet[i] = y - 0.5 * w;
      }
    }
    for (i = 0; i < n; i++) out[i] += 0.06 * wet[i];
    var dl = Math.round(STEP * 1.5 * sr), db = new Float32Array(dl), di = 0, dlp = 0;
    for (i = 0; i < n; i++) {
      y = db[di]; dlp += 0.35 * (y - dlp);                                  // each repeat a little darker
      db[di] = out[i] + 0.32 * dlp; if (++di === dl) di = 0;
      out[i] += 0.24 * dlp;
    }

    // 5. band limit, fade the echo's tail
    lowpass(out, sr, 9000, 0.5412); lowpass(out, sr, 9000, 1.3066);
    var fadeN = Math.round(0.3 * sr);
    for (i = 0; i < fadeN; i++) out[n - 1 - i] *= smooth(i / fadeN);
    return out;
  }

  // linear interpolation up to the output rate, a gentle output filter, -3 dBFS, 4 ms edges
  function finish(c, sr) {
    var n = Math.round(c.length / FS * sr), out = new Float32Array(n), step = FS / sr, last = c.length - 1;
    var i, k, f, w, pk = 0;
    for (i = 0; i < n; i++) {
      f = i * step; k = Math.floor(f); f -= k;
      out[i] = k >= last ? c[last] : c[k] + (c[k + 1] - c[k]) * f;
    }
    lowpass(out, sr, 10000, 0.707);
    for (i = 0; i < n; i++) { w = out[i] < 0 ? -out[i] : out[i]; if (w > pk) pk = w; }
    if (!(pk > 0)) pk = 1;
    var gain = PEAK / pk, edge = Math.round(0.004 * sr);
    for (i = 0; i < n; i++) out[i] *= gain;
    for (i = 0; i < edge; i++) { w = i / edge; out[i] *= w; out[n - 1 - i] *= w; }
    return out;
  }

  function lowpass(buf, sr, fc, Q) {
    if (fc > sr * 0.45) fc = sr * 0.45;
    var w0 = 2 * Math.PI * fc / sr, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0), a0 = 1 + al;
    var b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = -2 * c / a0, a2 = (1 - al) / a0;
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0, x, y, i, n = buf.length;
    for (i = 0; i < n; i++) {
      x = buf[i]; y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y;
    }
  }

  function render(sampleRate, variant) {
    var sr = Math.round(+sampleRate) || 44100;
    if (sr < 8000) sr = 8000;
    if (sr > 192000) sr = 192000;
    variant = variant === 1 || variant === 2 ? variant : 0;
    var key = sr + ':' + variant;
    if (!cache[key]) cache[key] = finish(getCore(variant), sr);
    return cache[key];
  }
  function getCore(variant) {                           // 0: phrase 1 then phrase 2 GAP later; 1: phrase 1; 2: phrase 2
    if (!cores[variant]) {
      if (variant === 0) {
        var a = getCore(1), b = getCore(2), off = Math.round(GAP * FS), j = new Float32Array(off + b.length), i;
        for (i = 0; i < a.length; i++) j[i] = a[i];
        for (i = 0; i < b.length; i++) j[off + i] += b[i];
        cores[0] = j;
      } else cores[variant] = core(variant - 1);
    }
    return cores[variant];
  }
  function warm(sampleRate) {
    try { if (sampleRate) render(sampleRate); else getCore(0); } catch (e) {}
  }

  function play(ctx, dest) {
    var src = null, gain = null, stopped = false;
    try {
      var data = render(ctx.sampleRate);
      var buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      if (buf.copyToChannel) buf.copyToChannel(data, 0); else buf.getChannelData(0).set(data);
      src = ctx.createBufferSource();
      src.buffer = buf;
      gain = ctx.createGain();
      gain.gain.value = 1;
      src.connect(gain);
      gain.connect(dest || ctx.destination);
      src.onended = function () {
        stopped = true;
        try { src.disconnect(); gain.disconnect(); } catch (e) {}
      };
      src.start();
    } catch (e) { src = null; }
    return {
      stop: function (fade) {
        if (stopped || !src) return;
        stopped = true;
        try {
          var f = fade > 0 ? +fade : 0.03, now = ctx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + f);
          src.stop(now + f + 0.02);
        } catch (e) {
          try { src.stop(); } catch (e2) {}
        }
      }
    };
  }

  window.PalmerKonami = { duration: GAP + DURATION, render: render, warm: warm, play: play };
})();
