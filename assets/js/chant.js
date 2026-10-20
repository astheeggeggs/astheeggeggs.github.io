/* The PALMER chant: a synthesised choir singing "PAAAALMEEEEEEERRR" for the logo screen, after the
   "SE-GA" chant of the Mega Drive Sonic games. No samples: a small detuned choir of band-limited
   glottal saws through a Klatt-style cascade of formant resonators whose centres glide through
   /p/ /A:/ /l/ /m/ /3r/, then a little room, then a 1991 console DAC (5.5 kHz band limit, 16 kHz
   sample-and-hold, 8 bits). Synthesis runs once at 16 kHz and is cached.

   window.PalmerChant = {
     duration: seconds,
     render(sampleRate [, variant]) -> Float32Array   mono, pure JS, cached; works under node
     warm([sampleRate])                               render ahead of time (optional; also self-run when idle)
     play(ctx [, dest]) -> { stop(fadeSeconds) }      schedule it on an AudioContext
   }
   variant 0 (default) "PAHL-MER" on E4 -> C#4; 1 = the L left silent ("PAH-MER"); 2 = a lower choir
   (B3 -> G#3). Only variant 0 is used by the site; the others exist for auditioning. */
(function () {
  'use strict';

  var DURATION = 3.0;
  var PEAK = 0.708;                 // -3 dBFS
  var cache = {}, cores = {};

  // ---- phoneme timeline -------------------------------------------------------------------------
  // rows: [t, F1, F2, F3, B1, B2, B3, nasalPole, nasalZero, voiceAmp]; smoothstep between rows.
  // The nasal pole and zero sit together (and cancel) except during /m/.
  var T_BURST = 0.045;              // lips part
  var T_VOICE = 0.085;              // voicing starts: a /p/ is aspirated; too short a lag says "balmer", too long "halmer"
  var T_GLIDE = 1.215;              // the choir steps down between the syllables
  var T_END_V = 2.84;               // voicing has faded out; the room rings on

  function track(variant) {
    var withL = variant !== 1;
    var k = [
      [0.000, 380,  900, 2300, 90, 110, 170, 500, 500, 0.00],   // lips closed
      [T_BURST, 420, 950, 2350, 90, 110, 170, 500, 500, 0.00],  // labial locus
      [T_VOICE, 700, 1080, 2440, 90, 110, 170, 500, 500, 0.00], // the puff of breath is already AH-shaped
      [0.150, 730, 1090, 2440, 90, 110, 170, 500, 500, 0.80],   // AH
      [0.300, 730, 1090, 2440, 90, 110, 170, 500, 500, 1.00],
      [0.985, 730, 1090, 2440, 90, 110, 170, 500, 500, 0.95]
    ];
    if (withL) {
      k.push([1.060, 360, 1300, 2700, 80, 120, 180, 500, 500, 1.30]);   // L
      k.push([1.140, 360, 1300, 2700, 80, 120, 180, 500, 500, 1.30]);
    } else {
      k.push([1.140, 600, 1000, 2400, 90, 120, 180, 500, 500, 0.85]);   // AH closing toward the lips
    }
    k.push([1.170, 300, 1100, 2300, 120, 220, 260, 250, 900, 0.95]);    // M: closed-mouth hum
    k.push([1.295, 300, 1100, 2300, 120, 220, 260, 250, 900, 0.95]);
    k.push([1.330, 450, 1250, 1900, 90, 110, 160, 500, 500, 0.80]);     // lips open
    k.push([1.420, 500, 1350, 1650, 80, 100, 130, 500, 500, 1.30]);     // ER
    k.push([2.150, 500, 1350, 1650, 80, 100, 130, 500, 500, 1.30]);
    k.push([2.450, 480, 1300, 1550, 80, 100, 120, 500, 500, 1.20]);     // RRR: F3 sinks
    k.push([2.700, 460, 1250, 1450, 80, 100, 120, 500, 500, 0.40]);
    k.push([T_END_V, 450, 1230, 1420, 80, 100, 120, 500, 500, 0.00]);
    k.push([DURATION + 1, 450, 1230, 1420, 80, 100, 120, 500, 500, 0.00]);
    return k;
  }

  // ---- the choir: [syllable-1 pitch, syllable-2 pitch, level, detune cents] ---------------------
  function choir(variant) {
    var p1 = variant === 2 ? 246.94 : 329.63;      // B3 or E4
    var p2 = variant === 2 ? 207.65 : 277.18;      // G#3 or C#4
    function st(n) { return Math.pow(2, n / 12); }
    return [
      [p1, p2, 1.00, -7], [p1, p2, 1.00, 6], [p1, p2, 0.90, 13],          // the tune, close unison
      [p1 / 2, p2 / 2, 0.95, -5], [p1 / 2, p2 / 2, 0.85, 9],              // the men, an octave below
      [p1 * st(4), p2 * st(8), 0.26, 4],                                  // halo: E major -> A major
      [p1 * st(-5), p2 * st(-4), 0.34, -4],
      [p1, p2 * st(3), 0.22, -11]
    ];
  }

  function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }

  // ---- render -----------------------------------------------------------------------------------
  // Everything is synthesised at the console's own 16 kHz; finish() then holds each sample out to the
  // AudioContext's rate, which is exactly what the DAC did (and makes the costly part rate-independent).
  var FS = 16000;

  function core(variant) {
    var sr = FS, n = Math.round(DURATION * sr), BL = 8;
    var src = new Float32Array(n), out = new Float32Array(n);
    var i, j, v, t, e;
    var seed = 20261004;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

    // 1. glottal source: a few detuned polyBLEP saws, each with its own vibrato, drift and entry
    var voices = choir(variant), nv = voices.length;
    for (v = 0; v < nv; v++) {
      var V = voices[v];
      var det = Math.pow(2, V[3] / 1200);
      var on = T_VOICE + rnd() * 0.028, glideAt = T_GLIDE - 0.045 + (rnd() - 0.5) * 0.03;
      var vibF = 5.1 + rnd() * 0.9, vibP = rnd() * 6.283, vibD = 0.0045 + rnd() * 0.002;
      var dF1 = 0.6 + rnd() * 0.7, dP1 = rnd() * 6.283, dF2 = 1.7 + rnd() * 1.1, dP2 = rnd() * 6.283;
      var ph = rnd(), lnRatio = Math.log(V[1] / V[0]);
      for (i = 0; i < n; i += BL) {
        t = i / sr;
        if (t < on) continue;
        if (t > T_END_V) break;
        var g = V[2] * smooth((t - on) / 0.035);
        var f = V[0] * det * Math.exp(lnRatio * smooth((t - glideAt) / 0.09));
        f *= 1 - 0.022 * (1 - smooth((t - on) / 0.11));                         // scoop up into the note
        var vib = smooth((t - on - 0.18) / 0.35) * (1 - 0.6 * smooth((t - 1.0) / 0.15) * (1 - smooth((t - 1.5) / 0.3)));
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
    var K = track(variant), ki = 0;
    var PI = Math.PI, TWO_PI_SR = 2 * PI / sr, PI_SR = PI / sr;
    var freq = [0, 0, 0, 0, 0, 3300, 4100], bw = [0, 0, 0, 0, 0, 260, 320];   // [zero, npole, F1, F2, F3, F4, F5]
    var cA = new Float64Array(7), cB = new Float64Array(7), cC = new Float64Array(7);
    var y1 = new Float64Array(7), y2 = new Float64Array(7);
    var zx1 = 0, zx2 = 0, lp = 0, sPrev = 0, PRE = 1.5;                        // brightness of the voice
    var hp = 0, hpx = 0, hpK = Math.exp(-2 * PI * 60 / sr);
    var av = 0, ah = 0, s, r, y, w;
    for (i = 0; i < n; i += BL) {
      t = i / sr;
      while (K[ki + 1][0] <= t) ki++;
      var a = K[ki], b = K[ki + 1], m = smooth((t - a[0]) / (b[0] - a[0]));
      freq[2] = a[1] + (b[1] - a[1]) * m; freq[3] = a[2] + (b[2] - a[2]) * m; freq[4] = a[3] + (b[3] - a[3]) * m;
      bw[2] = a[4] + (b[4] - a[4]) * m; bw[3] = a[5] + (b[5] - a[5]) * m; bw[4] = a[6] + (b[6] - a[6]) * m;
      freq[1] = a[7] + (b[7] - a[7]) * m; freq[0] = a[8] + (b[8] - a[8]) * m;
      bw[0] = bw[1] = 110;
      av = a[9] + (b[9] - a[9]) * m;
      // aspiration: the puff after the /p/, then a trace of breath under the choir
      ah = 0.9 * smooth((t - T_BURST) / 0.006) * (1 - smooth((t - T_VOICE) / 0.05)) + 0.05 * av;
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
        y = zA * lp + zB * zx1 + zC * zx2; zx2 = zx1; zx1 = lp;                // anti-resonator
        for (r = 1; r < 7; r++) {
          w = cA[r] * y + cB[r] * y1[r] + cC[r] * y2[r];
          y2[r] = y1[r]; y1[r] = w; y = w;
        }
        hp = hpK * (hp + y - hpx); hpx = y;                                    // lip radiation / DC block
        out[j] = hp;
      }
    }

    // 3. the /p/: a lip burst of low-passed noise, scaled against the sung level. With silence before
    // it there is no closure to hear, so the burst has to carry the consonant: about as loud as the vowel
    var pk = 0;
    for (i = 0; i < n; i++) { w = out[i] < 0 ? -out[i] : out[i]; if (w > pk) pk = w; }
    if (!(pk > 0)) pk = 1;
    var b0 = Math.round(T_BURST * sr), bn = Math.round(0.06 * sr), bl = 0, bl2 = 0;
    var bK = 1 - Math.exp(-2 * PI * 1500 / sr);
    for (i = 0; i < bn && b0 + i < n; i++) {
      t = i / sr;
      bl += bK * ((rnd() * 2 - 1) - bl); bl2 += bK * (bl - bl2);
      out[b0 + i] += pk * 2.5 * bl2 * smooth(t / 0.0015) * Math.exp(-t / 0.012);
    }

    // 4. a small room, so the release is a tail and not a cut
    var combMs = [29.7, 37.1, 41.1, 43.7], apMs = [5.0, 1.7], wet = new Float32Array(n);
    for (r = 0; r < 4; r++) {
      var cl = Math.round(combMs[r] * sr / 1000), cb = new Float32Array(cl), ci = 0, cf = 0, fb = 0.74;
      for (i = 0; i < n; i++) {
        y = cb[ci]; cf += 0.45 * (y - cf);                                     // damped feedback
        cb[ci] = out[i] + fb * cf; if (++ci === cl) ci = 0;
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
    for (i = 0; i < n; i++) out[i] += 0.05 * wet[i];

    // 5. the console: 4th-order low-pass at 5.5 kHz, then 8 bits
    lowpass(out, sr, 5500, 0.5412); lowpass(out, sr, 5500, 1.3066);
    var fadeN = Math.round(0.06 * sr);
    for (i = 0; i < fadeN; i++) out[n - 1 - i] *= smooth(i / fadeN);
    pk = 0;
    for (i = 0; i < n; i++) { w = out[i] < 0 ? -out[i] : out[i]; if (w > pk) pk = w; }
    if (!(pk > 0)) pk = 1;
    var q = 127 / pk;
    for (i = 0; i < n; i++) out[i] = Math.round(out[i] * q) / 127;
    return out;
  }

  // 16 kHz sample-and-hold up to the output rate, the console's output filter, -3 dBFS
  function finish(c, sr) {
    var n = Math.round(DURATION * sr), out = new Float32Array(n), step = FS / sr, last = c.length - 1;
    var i, k, w, pk = 0;
    for (i = 0; i < n; i++) { k = Math.floor(i * step); out[i] = c[k > last ? last : k]; }
    lowpass(out, sr, 7000, 0.707);
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

  function getCore(variant) {
    if (!cores[variant]) cores[variant] = core(variant);
    return cores[variant];
  }

  // With a sample rate: render that buffer now. Without: just the rate-independent synthesis.
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

  window.PalmerChant = { duration: DURATION, render: render, warm: warm, play: play };

  // do the synthesis in an idle moment after load, so the coin click only pays for the copy
  try {
    if (window.requestIdleCallback) window.requestIdleCallback(function () { warm(); }, { timeout: 4000 });
    else if (window.setTimeout) window.setTimeout(function () { warm(); }, 1200);
  } catch (e) {}
})();
