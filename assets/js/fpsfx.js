/* fpsfx.js — window.FPSFX, the first-person sound kit for Palmer's Progress.
   One set of sound effects shared by quest.js (the paper-ball gun, the BFG, the reviewers, hearts, REJECTED!),
   boss.js (THE EDITOR-IN-CHIEF, loop 1) and magician.js (REVIEWER 2, loop 2). The API and every sound name,
   with its length, level and the host event it is meant for, are in .dev/sfx-contract.md.

   The character is DOOM (id Software, 1993) crossed with THE HOUSE OF THE DEAD 1/2 (Sega, 1996/1998). Nothing is
   sampled or copied: every sound is synthesised here, in plain JavaScript, from oscillators, FM, filtered noise and
   formant-filtered voices. The Doom half (the BFG, the plasma, the monsters, the player's grunts, explosions, pickups)
   is synthesised at 11 kHz (a few big ones at 22 kHz), quantised to 8 bits and held sample-by-sample up to the output
   rate with no interpolation, so the highs alias and the tails crunch the way 1993 PC audio did; most of it is played
   with a small random pitch shift so repetition does not grate.
   The House of the Dead half (the gun, reloads, flesh and armour hits, the weak-point confirmation, the Magician's
   screech, hiss and laugh, the damage sting, the fanfare) stays cleaner, like a 1990s arcade board.

   How it runs: nothing happens at load (no AudioContext is created here). FPSFX.kit(ac) binds a kit to the caller's
   AudioContext (cached per context). Each sound is rendered ONCE, lazily on first play or ahead of time with
   kit.warm(), into an AudioBuffer (deterministic: a seeded PRNG per sound, so a render is reproducible), and each play
   costs one BufferSource and one gain (plus a gain and a stereo panner for a positioned sound). Per-name rate gates, per-name
   polyphony and a global voice cap (the oldest one-shot is stolen with a 10 ms fade) keep a hail of shots cheap.
   One bus per context: gain → DynamicsCompressor (a limiter) → trim → a soft ceiling at 0.8 → destination.

     var k = FPSFX.kit(api.audio());
     k.play('gun');                                          // one-shot
     k.play('hit.weak', { k: 1 - hp / maxHp });              // the confirmation tone rises as the counter falls
     var h = k.play('flame', { pos: p, listener: camera });  // a loop: h.stop(0.3) or h.fade(0, 1) when done
     k.play('bfg.charge', { dur: 0.3 });                     // length-baked sounds take dur

   FPSFX.render(name, sampleRate, opts) returns the raw samples without any AudioContext (for offline tests). */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  function noop() {}
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function clock() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  function fn(x) { return typeof x === 'function' ? x : function () { return x; }; }

  /* ------------------------------------------------------------ deterministic randomness */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ------------------------------------------------------------ synthesis: a render context and buffer operations
     Every layer is a Float32Array at the render's sample rate; t inside envelope functions is seconds from the
     start of that layer. add() normalises a layer to peak 1 before mixing it in, so mix gains are relative peaks. */
  function Syn(sr, seed) { this.sr = sr; this.r = mulberry32(seed); this.n = 0; this.out = null; this.v = 0; this.st = 0; this.dur = 0; }
  Syn.prototype.rs = function (a, b) { return a + (b - a) * this.r(); };
  function len(c, dur) { return Math.max(1, Math.round(dur * c.sr)); }

  // breakpoint envelope [t0, v0, t1, v1, ...]; ex → exponential between positive values (use it for pitch)
  function env(pts, ex) {
    var i = 0, n = pts.length;
    return function (t) {
      if (t <= pts[0]) return pts[1];
      if (t >= pts[n - 2]) return pts[n - 1];
      if (t < pts[i]) i = 0;
      while (i < n - 4 && t >= pts[i + 2]) i += 2;
      var t0 = pts[i], v0 = pts[i + 1], t1 = pts[i + 2], v1 = pts[i + 3], u = (t - t0) / ((t1 - t0) || 1);
      if (ex && v0 > 0 && v1 > 0) return v0 * Math.pow(v1 / v0, u);
      return v0 + (v1 - v0) * u;
    };
  }
  // attack a seconds (linear), then an exponential decay with time constant tau
  function perc(a, tau) { return function (t) { return t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / tau); }; }
  // smooth random in [-1, 1]: random points at `rate` per second, smoothstep between them
  function smooth(c, dur, rate) {
    var m = Math.ceil(dur * rate) + 3, p = new Float32Array(m), i;
    for (i = 0; i < m; i++) p[i] = c.r() * 2 - 1;
    return function (t) {
      var x = t * rate, k = Math.floor(x), u = x - k;
      if (k < 0) return p[0]; if (k >= m - 1) return p[m - 1];
      u = u * u * (3 - 2 * u); return p[k] + (p[k + 1] - p[k]) * u;
    };
  }

  // a control signal as a Float32Array: f (a number or a function of t) evaluated every `step` samples and
  // interpolated linearly between, so the per-sample loops below never call through a closure
  function ctl(c, n, f, step) {
    var b = new Float32Array(n), i, k;
    if (typeof f !== 'function') { if (f) for (i = 0; i < n; i++) b[i] = f; return b; }
    step = step || 16;
    var sr = c.sr, prev = f(0);
    for (k = 0; k < n; k += step) {
      var nx = f((k + step) / sr), m = Math.min(step, n - k), d = (nx - prev) / step;
      for (i = 0; i < m; i++) b[k + i] = prev + d * i;
      prev = nx;
    }
    return b;
  }
  function blep(t, dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1; }
    if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
    return 0;
  }
  var W_SIN = 0, W_TRI = 1, W_SAW = 2, W_RAW = 3, W_SQR = 4;
  var WAVES = { sin: W_SIN, tri: W_TRI, saw: W_SAW, raw: W_RAW, sqr: W_SQR };
  // an oscillator layer. shape: sin | tri | saw (band-limited) | raw (naive saw: aliasing grit) | sqr (pulse, o.pw)
  // o.vib {r: Hz, d: depth fraction or fn}, o.jit (random pitch wander, fraction) at o.jr Hz
  function tone(c, dur, shape, f, o) {
    o = o || {};
    var n = len(c, dur), b = new Float32Array(n), sr = c.sr, ph = o.ph || 0, w = WAVES[shape], F = ctl(c, n, f, 8), i, dt;
    if (o.vib) { var vd = ctl(c, n, o.vib.d, 32), vr = o.vib.r / sr, vp = 0; for (i = 0; i < n; i++) { vp += vr; F[i] *= 1 + vd[i] * Math.sin(TAU * vp); } }
    if (o.jit) { var J = ctl(c, n, smooth(c, dur, o.jr || 30), 32), ja = o.jit; for (i = 0; i < n; i++) F[i] *= 1 + ja * J[i]; }
    for (i = 0; i < n; i++) { dt = F[i] / sr; F[i] = dt < 0 ? 0 : dt > 0.49 ? 0.49 : dt; }          // F now holds the phase step
    if (w === W_SIN) for (i = 0; i < n; i++) { ph += F[i]; if (ph >= 1) ph -= 1; b[i] = Math.sin(TAU * ph); }
    else if (w === W_TRI) for (i = 0; i < n; i++) { ph += F[i]; if (ph >= 1) ph -= 1; b[i] = ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph; }
    else if (w === W_SAW) for (i = 0; i < n; i++) { dt = F[i]; ph += dt; if (ph >= 1) ph -= 1; b[i] = 2 * ph - 1 - blep(ph, dt); }
    else if (w === W_RAW) for (i = 0; i < n; i++) { ph += F[i]; if (ph >= 1) ph -= 1; b[i] = 2 * ph - 1; }
    else {
      var PW = ctl(c, n, o.pw || 0.5, 32);
      for (i = 0; i < n; i++) { dt = F[i]; ph += dt; if (ph >= 1) ph -= 1; var q = PW[i], p2 = ph - q; if (p2 < 0) p2 += 1; b[i] = (ph < q ? 1 : -1) + blep(ph, dt) - blep(p2, dt); }
    }
    return b;
  }
  // two-operator FM: sine carrier fc(t), sine modulator at fc * ratio, index idx(t)
  function fm(c, dur, fc, ratio, idx) {
    var n = len(c, dur), b = new Float32Array(n), sr = c.sr, pc = 0, pm = 0, F = ctl(c, n, fc, 8), I = ctl(c, n, idx, 16);
    for (var i = 0; i < n; i++) {
      var f = F[i] / sr;
      pm += f * ratio; if (pm >= 1) pm -= Math.floor(pm); pc += f; if (pc >= 1) pc -= 1;
      b[i] = Math.sin(TAU * pc + I[i] * Math.sin(TAU * pm));
    }
    return b;
  }
  // struck metal: a sum of exponentially decaying sines (damped two-pole resonators)
  function modes(c, dur, f0, ratios, amps, taus) {
    var n = len(c, dur), b = new Float32Array(n), sr = c.sr;
    for (var k = 0; k < ratios.length; k++) {
      var f = f0 * ratios[k]; if (f >= sr * 0.45) continue;
      var w = TAU * f / sr, r = Math.exp(-1 / (taus[k] * sr)), a1 = 2 * r * Math.cos(w), a2 = -r * r, y2 = 0, y1 = amps[k] * r * Math.sin(w);
      if (n > 1) b[1] += y1;
      for (var i = 2; i < n; i++) { var y = a1 * y1 + a2 * y2; b[i] += y; y2 = y1; y1 = y; }
    }
    return b;
  }
  function white(c, dur) { var n = len(c, dur), b = new Float32Array(n); for (var i = 0; i < n; i++) b[i] = c.r() * 2 - 1; return b; }
  // red noise: leaky-integrated white, corner near 60 Hz whatever the sample rate, peak 1
  function brown(c, dur) {
    var b = white(c, dur), a = Math.exp(-TAU * 60 / c.sr), y = 0;
    for (var i = 0; i < b.length; i++) { y = a * y + (1 - a) * b[i]; b[i] = y; }
    return norm(b, 1);
  }
  // sample-and-hold noise: a new random value rate(t) times a second (pitched grit)
  function snh(c, dur, rate) {
    var n = len(c, dur), b = new Float32Array(n), R = ctl(c, n, rate, 32), acc = 1, v = 0;
    for (var i = 0; i < n; i++) { acc += R[i] / c.sr; if (acc >= 1) { acc -= Math.floor(acc); v = c.r() * 2 - 1; } b[i] = v; }
    return b;
  }
  // paper: noise in short hard-edged grains, dens(t) grains a second, each about `grain` seconds long
  function crinkle(c, dur, dens, grain) {
    var n = len(c, dur), b = new Float32Array(n), sr = c.sr, D = ctl(c, n, dens, 32), gl = 0, ga = 0;
    for (var i = 0; i < n; i++) {
      if (gl <= 0 && c.r() < D[i] / sr) { gl = Math.round(grain * sr * (0.5 + c.r())); ga = 0.3 + 0.7 * c.r(); }
      if (gl > 0) { gl--; b[i] = (c.r() * 2 - 1) * ga; }
    }
    return b;
  }
  // fire and debris: pops (a click, a ringing burst and a little noise) arriving dens(t) times a second
  function pop(c, b, i, o) {
    var sr = c.sr, f = c.rs(o.f0 || 1500, o.f1 || 5000), tau = c.rs(o.tau0 || 0.0006, o.tau1 || 0.003) * sr;
    var a = c.rs(o.a0 == null ? 0.3 : o.a0, o.a1 == null ? 1 : o.a1) * (c.r() < 0.5 ? -1 : 1), m = Math.min(b.length - i, Math.round(tau * 6)), w = TAU * f / sr, ph = c.r() * TAU;
    for (var j = 0; j < m; j++) b[i + j] += a * Math.exp(-j / tau) * (0.65 * Math.sin(w * j + ph) + 0.35 * (c.r() * 2 - 1));
  }
  function pops(c, dur, dens, o) {
    var n = len(c, dur), b = new Float32Array(n), D = ctl(c, n, dens, 32);
    for (var i = 0; i < n; i++) if (c.r() < D[i] / c.sr) pop(c, b, i, o);
    return b;
  }

  // TPT state-variable filter (stable under fast sweeps). type lp | bp (unity peak) | hp. f and q may be functions
  var F_LP = 0, F_BP = 1, F_HP = 2;
  function filt(c, b, type, f, q) {
    var sr = c.sr, n = b.length, fF = fn(f), qF = fn(q), ty = type === 'lp' ? F_LP : type === 'bp' ? F_BP : F_HP;
    var s1 = 0, s2 = 0, k = 1, a1 = 0, a2 = 0, a3 = 0;
    for (var i = 0; i < n; i++) {
      if ((i & 15) === 0) {
        var t = i / sr, fc = clamp(fF(t), 10, sr * 0.45), g = Math.tan(Math.PI * fc / sr);
        k = 1 / Math.max(0.1, qF(t)); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
      }
      var x = b[i], v3 = x - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
      s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
      b[i] = ty === F_LP ? v2 : ty === F_BP ? k * v1 : x - k * v1 - v2;
    }
    return b;
  }
  function lp1(c, b, f) { var a = 1 - Math.exp(-TAU * f / c.sr), y = 0; for (var i = 0; i < b.length; i++) { y += a * (b[i] - y); b[i] = y; } return b; }
  function hp1(c, b, f) { var a = Math.exp(-TAU * f / c.sr), y = 0, x1 = 0; for (var i = 0; i < b.length; i++) { var x = b[i]; y = a * (y + x - x1); x1 = x; b[i] = y; } return b; }
  function amp(c, b, e) { var E = ctl(c, b.length, e, 4); for (var i = 0; i < b.length; i++) b[i] *= E[i]; return b; }
  function peak(b) { var p = 0; for (var i = 0; i < b.length; i++) { var a = b[i] < 0 ? -b[i] : b[i]; if (a > p) p = a; } return p; }
  function norm(b, to) { var p = peak(b); if (p > 1e-9) { var g = to / p; for (var i = 0; i < b.length; i++) b[i] *= g; } return b; }
  // saturation: a rational tanh (within 0.5% of Math.tanh, much cheaper), normalised so the output peak is 1
  function th(x) { if (x > 3) return 1; if (x < -3) return -1; var x2 = x * x; return x * (27 + x2) / (27 + 9 * x2); }
  function drive(b, k) { norm(b, 1); var d = th(k); for (var i = 0; i < b.length; i++) b[i] = th(k * b[i]) / d; return b; }
  function mixIn(dst, src, g) { var n = Math.min(dst.length, src.length); for (var i = 0; i < n; i++) dst[i] += src[i] * g; return dst; }
  // every layer ends on a 3 ms cosine, so a decay cut off by its own length never clicks
  function add(c, b, t0, g) {
    var p = peak(b); if (p < 1e-9) return;
    var o = c.out, i0 = Math.round(t0 * c.sr), s = g / p, n = Math.min(b.length, o.length - i0), T = Math.min(Math.round(0.003 * c.sr), b.length >> 2), i;
    for (i = 0; i < n; i++) {
      var k = b.length - 1 - i;
      o[i0 + i] += b[i] * (k < T ? s * (0.5 - 0.5 * Math.cos(Math.PI * k / T)) : s);
    }
  }
  function reverse(b) { for (var i = 0, j = b.length - 1; i < j; i++, j--) { var x = b[i]; b[i] = b[j]; b[j] = x; } return b; }
  // a small room: four damped combs into two allpasses (Schroeder), mixed back in place; o.tone low-passes what feeds it
  var COMB = [0.0297, 0.0371, 0.0411, 0.0437], APD = [0.005, 0.0017];
  function room(c, b, o) {
    var sr = c.sr, size = o.size || 1, rt = o.rt || 0.4, damp = o.damp == null ? 0.4 : o.damp, mix = o.mix || 0.2, i, j;
    var ta = o.tone ? 1 - Math.exp(-TAU * o.tone / sr) : 1, xl = 0;
    var cb = [], ab = [];
    for (j = 0; j < 4; j++) { var d = COMB[j] * size; cb.push({ b: new Float32Array(Math.max(1, Math.round(d * sr))), i: 0, g: Math.pow(10, -3 * d / rt), lp: 0 }); }
    for (j = 0; j < 2; j++) ab.push({ b: new Float32Array(Math.max(1, Math.round(APD[j] * sr))), i: 0 });
    for (i = 0; i < b.length; i++) {
      var x = b[i], s = 0; xl += ta * (x - xl);
      for (j = 0; j < 4; j++) {
        var C = cb[j], out = C.b[C.i];
        C.lp = out * (1 - damp) + C.lp * damp;
        C.b[C.i] = xl + C.g * C.lp; if (++C.i >= C.b.length) C.i = 0;
        s += out;
      }
      s *= 0.25;
      for (j = 0; j < 2; j++) { var A = ab[j], bo = A.b[A.i], y = -0.7 * s + bo; A.b[A.i] = s + 0.7 * y; if (++A.i >= A.b.length) A.i = 0; s = y; }
      b[i] = x + mix * s;
    }
    return b;
  }
  // 1993 PC audio: a sound with crush [hz, bits] is synthesised at hz itself (its oscillators and noise alias there),
  // quantised to `bits`, then held sample-by-sample up to the output rate, so the images above hz/2 stay in (no interpolation)
  function quantise(b, bits) { var L = Math.pow(2, bits - 1); for (var i = 0; i < b.length; i++) b[i] = Math.round(b[i] * L) / L; return b; }
  function lerpUp(b, from, to) {
    var n = Math.max(1, Math.round(b.length * to / from)), y = new Float32Array(n), r = from / to, last = b.length - 1;
    for (var i = 0; i < n; i++) { var x = i * r, j = Math.floor(x), u = x - j; y[i] = j >= last ? b[last] : b[j] + (b[j + 1] - b[j]) * u; }
    return y;
  }
  function zoh(b, from, to) {
    var n = Math.max(1, Math.round(b.length * to / from)), y = new Float32Array(n), r = from / to, last = b.length - 1;
    for (var i = 0; i < n; i++) { var j = Math.floor(i * r); y[i] = b[j > last ? last : j]; }
    return y;
  }
  function fades(sr, b, inMs, outMs) {
    var ni = Math.min(b.length >> 1, Math.round(inMs * sr / 1000)), no = Math.min(b.length >> 1, Math.round(outMs * sr / 1000)), i;
    for (i = 0; i < ni; i++) b[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / ni);
    for (i = 0; i < no; i++) b[b.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / no);
    return b;
  }
  // a seamless loop: the render runs xf seconds long, and that overrun is crossfaded over the head
  // (equal power for noise, linear when the content is periodic and so correlated across the seam)
  function loopify(c, b, xf, linear) {
    var X = len(c, xf), L = b.length - X, z = new Float32Array(L), i;
    for (i = 0; i < L; i++) z[i] = b[i];
    for (i = 0; i < X; i++) {
      var u = i / X, wi = linear ? u : Math.sin(u * Math.PI / 2), wo = linear ? 1 - u : Math.cos(u * Math.PI / 2);
      z[i] = b[i] * wi + b[L + i] * wo;
    }
    return z;
  }

  /* ------------------------------------------------------------ voices: a glottal source through four formants */
  var VOW = {
    a: [730, 1090, 2440, 3400], ae: [660, 1720, 2410, 3300], uh: [640, 1190, 2390, 3300], e: [530, 1840, 2480, 3500],
    i: [270, 2290, 3010, 3700], o: [570, 840, 2410, 3300], u: [300, 870, 2240, 3300], er: [490, 1350, 1690, 3300]
  };
  var FG = [1, 0.63, 0.35, 0.2], FBW = [80, 100, 150, 220];
  // [t0, 'a', t1, 'o', ...] → formant frequencies at t, interpolated linearly between the named vowels
  function vpath(seq) {
    var F = [0, 0, 0, 0], m = seq.length;
    return function (t) {
      var k = 0; while (k < m - 2 && t >= seq[k + 2]) k += 2;
      var A = VOW[seq[k + 1]], nx = k + 2 < m, B = nx ? VOW[seq[k + 3]] : A, t0 = seq[k], t1 = nx ? seq[k + 2] : t0 + 1;
      var u = clamp((t - t0) / ((t1 - t0) || 1), 0, 1);
      for (var j = 0; j < 4; j++) F[j] = A[j] + (B[j] - A[j]) * u;
      return F;
    };
  }
  function formant(c, x, vf, sc, bwm) {
    var sr = c.sr, n = x.length, y = new Float32Array(n), s1 = [0, 0, 0, 0], s2 = [0, 0, 0, 0], A1 = [0, 0, 0, 0], A2 = [0, 0, 0, 0], A3 = [0, 0, 0, 0], KK = [0, 0, 0, 0], j;
    for (var i = 0; i < n; i++) {
      if ((i & 15) === 0) {
        var F = vf(i / sr);
        for (j = 0; j < 4; j++) {
          var fc = clamp(F[j] * sc, 40, sr * 0.45), bw = FBW[j] * bwm * Math.max(0.6, sc), g = Math.tan(Math.PI * fc / sr), k = Math.min(2, bw / fc);
          A1[j] = 1 / (1 + g * (g + k)); A2[j] = g * A1[j]; A3[j] = g * A2[j]; KK[j] = k;
        }
      }
      var xi = x[i], out = 0;
      for (j = 0; j < 4; j++) {
        var v3 = xi - s2[j], v1 = A1[j] * s1[j] + A2[j] * v3, v2 = s2[j] + A2[j] * s1[j] + A3[j] * v3;
        s1[j] = 2 * v1 - s1[j]; s2[j] = 2 * v2 - s2[j];
        out += FG[j] * KK[j] * v1;
      }
      y[i] = out;
    }
    return y;
  }
  // o: f0 (Hz or fn), vowel (vpath), scale (formant scale: < 1 is a bigger throat), bw (bandwidth multiplier),
  // raw (naive saw), tilt (source low-pass Hz), sub (subharmonic amount), rattle {r: Hz, d: depth} (vocal-fry AM),
  // gurgle (random AM amount), breath (aspiration amount), body (dry source mixed in), jit, vib, amp (envelope), drive
  function voice(c, dur, o) {
    var n = len(c, dur), sr = c.sr, f0 = fn(o.f0), jit = o.jit == null ? 0.02 : o.jit, i;
    var src = tone(c, dur, o.raw ? 'raw' : 'saw', f0, { jit: jit, jr: 24, vib: o.vib });
    lp1(c, src, o.tilt || 1800);
    if (o.sub) {
      var S = ctl(c, n, o.sub, 32), sb = tone(c, dur, 'saw', function (tt) { return f0(tt) * 0.5; }, { jit: jit, jr: 24 });
      lp1(c, sb, 700); for (i = 0; i < n; i++) src[i] += sb[i] * S[i];
    }
    if (o.rattle) {
      var RD = ctl(c, n, o.rattle.d, 32), RJ = ctl(c, n, smooth(c, dur, 40), 16), rr = o.rattle.r / sr, rp = 0;
      for (i = 0; i < n; i++) { rp += rr * (1 + 0.25 * RJ[i]); src[i] *= 1 - RD[i] * (0.5 + 0.5 * Math.sin(TAU * rp)); }
    }
    if (o.gurgle) { var GD = ctl(c, n, o.gurgle, 32), GS = ctl(c, n, smooth(c, dur, 34), 16); for (i = 0; i < n; i++) src[i] *= 1 - GD[i] * (0.5 + 0.5 * GS[i]); }
    if (o.breath) { var BF = ctl(c, n, o.breath, 32), nz = white(c, dur); hp1(c, nz, 400); for (i = 0; i < n; i++) src[i] += nz[i] * BF[i] * 0.6; }
    var y = formant(c, src, o.vowel, o.scale || 1, o.bw || 1);
    norm(y, 1);
    var body = o.body == null ? 0.12 : o.body; if (body) { lp1(c, src, 500); norm(src, 1); mixIn(y, src, body); }
    if (o.amp) amp(c, y, o.amp);
    if (o.drive) drive(y, o.drive);
    return norm(y, 1);
  }

  /* ------------------------------------------------------------ shared figures */
  // a gun action: a noise tick, a few inharmonic metal modes and a knock under them
  function action(c, t0, f0, heavy) {
    var n = white(c, 0.01); hp1(c, n, 2500); amp(c, n, perc(0.0002, 0.0012)); add(c, n, t0, 0.9);
    var m = modes(c, 0.09, f0, [1, 1.57, 2.43, 3.44], [1, 0.6, 0.4, 0.25], [0.018, 0.012, 0.009, 0.006]); add(c, m, t0, 0.55 * heavy);
    var k = tone(c, 0.04, 'sin', 260 / heavy); amp(c, k, perc(0.0005, 0.012)); add(c, k, t0, 0.3 * heavy);
  }
  // wet: noise through two sweeping formants with a bubbling amplitude
  function squelch(c, t0, dur, fa, fb, tau, a) {
    var w = white(c, dur), w2 = new Float32Array(w), bub = smooth(c, dur, 60);
    filt(c, w, 'bp', env([0, fa, dur * 0.6, fb], true), 4.5); filt(c, w2, 'bp', env([0, fa * 2.3, dur * 0.6, fb * 2.6], true), 5);
    mixIn(w, w2, 0.6);
    amp(c, w, function (t) { return (t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) / tau)) * (0.55 + 0.45 * bub(t)); });
    drive(w, 1.6); lp1(c, w, 6000); add(c, w, t0, a);
  }
  // the weak-point confirmation: a bright FM strike that chirps up into its pitch and rings with time constant tau
  function ding(c, t0, f, a, tau) {
    var ix = Math.min(1, 1200 / f), L = tau * 4.5;     // the index eases off as the pitch climbs, so no sideband folds over
    var b = fm(c, L, env([0, f * 0.94, 0.012, f], true), 2, env([0, 3 * ix, tau * 0.7, 0.25 * ix], true)); amp(c, b, perc(0.0008, tau)); add(c, b, t0, a);
    var h = tone(c, Math.min(L, 0.1), 'sin', f * 2); amp(c, h, perc(0.0005, tau * 0.45)); add(c, h, t0, 0.35 * a);
    var q = tone(c, Math.min(L, 0.06), 'tri', f * 3); amp(c, q, perc(0.0005, Math.min(0.02, tau * 0.4))); add(c, q, t0, 0.15 * a);
    var n = white(c, 0.006); hp1(c, n, 5000); amp(c, n, perc(0.0002, 0.001)); add(c, n, t0, 0.3 * a);
  }
  // an arcade damage buzzer note: square, a detuned saw and a sub pulse, driven hard
  function sting(c, t0, d, f) {
    var a = tone(c, d, 'sqr', f), b = tone(c, d, 'saw', f * 1.0087), s = tone(c, d, 'sqr', f * 0.5, { pw: 0.25 });
    mixIn(a, b, 0.8); mixIn(a, s, 0.5);
    filt(c, a, 'lp', env([0, 5200, d, 1400], true), 1.2); amp(c, a, env([0, 0, 0.003, 1, d * 0.7, 0.7, d, 0])); drive(a, 3); add(c, a, t0, 0.8);
    var n = white(c, 0.04); filt(c, n, 'bp', 2500, 1); amp(c, n, perc(0.0005, 0.012)); add(c, n, t0, 0.5);
  }
  // a brass-ish note for the fanfare: two saws, a filter that blares open and settles
  function brass(c, t0, d, f, a) {
    var x = tone(c, d, 'saw', f, { vib: { r: 5.5, d: env([0, 0, 0.25, 0.006]) } }), y = tone(c, d, 'saw', f * 1.004);
    mixIn(x, y, 0.8);
    filt(c, x, 'lp', function (t) { return f * (2.2 + 4 * Math.exp(-t / 0.09)) * Math.min(1, 0.4 + t / 0.03); }, 1.1);
    amp(c, x, env([0, 0, 0.015, 1, Math.max(0.02, d - 0.06), 0.8, d, 0])); add(c, x, t0, a);
  }
  var POP = { f0: 1500, f1: 5000, tau0: 0.0005, tau1: 0.0025, a0: 0.3, a1: 1 };
  var DEBRIS = { f0: 700, f1: 2800, tau0: 0.001, tau1: 0.005, a0: 0.2, a1: 0.8 };

  /* ------------------------------------------------------------ the sounds
     def fields: len (s, or fn(c) for length-baked sounds), level (peak of the rendered buffer, or fn(c)), vary (default random
     pitch spread, ± semitones), gate (min s between starts), poly (max live voices of this name), variants,
     crush [hz, bits] (synthesised at hz, quantised, held up to the output rate), rate (the synthesis rate of a clean
     sound, default CLEAN_RATE, interpolated up), loop + xf (crossfade s) + xlin, bake 'dur' (dflt/min/max/q) or 'pitch'
     (k 0..1 → 0..PITCH_SPAN semitones, rendered every PITCH_Q),
     fin/fout (edge fades, ms), use (the host event it is for; the contract repeats it). */
  var DEFS = {}, NAMES = [];
  function def(name, d) {
    d.name = name; d.level = d.level || 0.5; d.vary = d.vary || 0; d.gate = d.gate == null ? 0.03 : d.gate; d.poly = d.poly || 2; d.variants = d.variants || 1;
    DEFS[name] = d; NAMES.push(name);
  }
  var PITCH_SPAN = 19, PITCH_Q = 2;
  // clean sounds are synthesised at no more than 32 kHz: interpolating up to 44.1/48 kHz puts every image above 16 kHz
  var CLEAN_RATE = 32000;
  function durLen(pad) { return function (c) { return c.dur + pad; }; }

  // ---- weapons
  def('gun', { use: 'the paper-ball rebuttal leaving the hand (quest.js fire())', len: 0.3, level: 0.48, vary: 0.7, gate: 0.05, poly: 4, variants: 3, make: function (c) {
    var v = c.v, body = [185, 200, 172][v], fc = [2900, 3300, 2600][v];
    // the crack is the main layer: noise band-passed at 2-4 kHz, falling slightly, driven hard, gone in about 80 ms
    var n = white(c, 0.012); hp1(c, n, 4000); amp(c, n, perc(0.0002, 0.0016)); add(c, n, 0, 0.4);
    n = white(c, 0.14); filt(c, n, 'bp', env([0, fc * 1.2, 0.05, fc * 0.8], true), 1.1); amp(c, n, perc(0.0003, 0.026)); drive(n, 2.6); add(c, n, 0, 1.0);
    n = white(c, 0.08); filt(c, n, 'bp', 1400 + 150 * v, 1.5); amp(c, n, perc(0.0005, 0.016)); drive(n, 1.6); add(c, n, 0, 0.5);
    var s = tone(c, 0.012, 'sin', env([0, 2600, 0.012, 700], true)); amp(c, s, perc(0.0003, 0.004)); add(c, s, 0, 0.15);
    s = tone(c, 0.16, 'sin', env([0, body, 0.05, 62], true)); amp(c, s, perc(0.0006, 0.028)); drive(s, 2.2); add(c, s, 0, 0.35);   // the thump, under it
    s = tone(c, 0.08, 'saw', env([0, 430, 0.06, 150], true)); filt(c, s, 'lp', 2200, 0.8); amp(c, s, perc(0.0008, 0.016)); add(c, s, 0, 0.25);
    // the papery flick in the tail: a fwip as the ball leaves, then sparse crackles as it unfolds its corners, after
    // the crack has died down so each one is heard
    var k = crinkle(c, 0.13, env([0, 700, 0.13, 150]), 0.0008); hp1(c, k, 1900); lp1(c, k, 7000); amp(c, k, perc(0.003, 0.045)); add(c, k, 0.04, 0.45);
    n = white(c, 0.07); filt(c, n, 'bp', env([0, 1400, 0.07, 3800], true), 2.2); amp(c, n, env([0, 0, 0.012, 1, 0.07, 0])); add(c, n, 0.012, 0.16);
    drive(c.out, 1.8);                                                                                       // one saturation over the lot: a denser report
    room(c, c.out, { size: 0.55, rt: 0.3, damp: 0.45, tone: 5000, mix: 0.3 });                               // a short room tail
  } });
  def('reload', { use: 'the gun readied: entering first person, after RESUBMIT', len: 0.36, level: 0.6, vary: 0.5, gate: 0.2, poly: 1, make: function (c) {
    action(c, 0, 2150, 1);
    var s = white(c, 0.07), z = snh(c, 0.07, 190); for (var i = 0; i < s.length; i++) s[i] *= 0.4 + 0.6 * Math.abs(z[i]);
    filt(c, s, 'bp', env([0, 1300, 0.07, 2400], true), 3); amp(c, s, env([0, 0, 0.01, 1, 0.06, 0.6, 0.07, 0])); add(c, s, 0.02, 0.2);
    action(c, 0.105, 1620, 1.3);
    room(c, c.out, { size: 0.5, rt: 0.3, damp: 0.5, mix: 0.12 });
  } });
  def('click', { use: 'a dry click: a trigger that does nothing, a menu tick', len: 0.07, level: 0.35, vary: 1, gate: 0.04, poly: 2, make: function (c) {
    action(c, 0, 3100, 0.6);
  } });
  def('bfg.charge', { use: 'the BFG wind-up; pass dur = the wind-up (BFG_WIND)', bake: 'dur', dflt: 0.7, min: 0.2, max: 3, q: 0.05, len: durLen(0), level: 0.55, vary: 0.3, gate: 0.1, poly: 1, crush: [11025, 8], fout: 6, make: function (c) {
    var D = c.dur, u = function (t) { return Math.min(1, t / D); }, i;
    var f = function (t) { return 90 * Math.pow(12, Math.pow(u(t), 1.3)); };
    var a = tone(c, D, 'raw', f, { vib: { r: 11, d: function (t) { return 0.01 + 0.04 * u(t); } } }), b = tone(c, D, 'sqr', function (t) { return f(t) * 1.498; });
    mixIn(a, b, 0.45);
    filt(c, a, 'lp', function (t) { return 600 + 5000 * u(t); }, 1.5);
    var U = ctl(c, a.length, u, 32), wp = 0;
    for (i = 0; i < a.length; i++) { var uu = U[i]; wp += (8 + 34 * uu) / c.sr; a[i] *= (0.1 + 0.9 * Math.pow(uu, 1.4)) * (0.65 + 0.35 * Math.sin(TAU * wp)); }
    add(c, a, 0, 0.7);
    var n = white(c, D); filt(c, n, 'bp', function (t) { return 300 * Math.pow(14, u(t)); }, function (t) { return 1.5 + 5 * u(t); });
    amp(c, n, function (t) { return u(t) * u(t); }); add(c, n, 0, 0.9);
  } });
  def('bfg.fire', { use: 'the BFG discharging (fireBfg())', len: 1.15, level: 0.8, vary: 0.4, gate: 0.15, poly: 2, crush: [11025, 8], make: function (c) {
    var s = tone(c, 0.9, 'sin', env([0, 96, 0.55, 33], true)); amp(c, s, perc(0.002, 0.28)); drive(s, 2.5); add(c, s, 0, 1.0);
    var b = tone(c, 0.7, 'raw', env([0, 180, 0.55, 46], true)), q = tone(c, 0.95, 'sqr', env([0, 74, 0.9, 30], true));
    mixIn(b, q, 0.7); filt(c, b, 'lp', env([0, 2400, 0.8, 260], true), 1.2); amp(c, b, perc(0.004, 0.3)); drive(b, 3); add(c, b, 0, 0.55);
    var z = tone(c, 0.2, 'tri', env([0, 1500, 0.18, 320], true)); amp(c, z, perc(0.002, 0.06)); add(c, z, 0, 0.35);
    var n = white(c, 0.8); filt(c, n, 'lp', env([0, 5000, 0.6, 180], true), 0.9); amp(c, n, perc(0.003, 0.2)); drive(n, 2); add(c, n, 0, 0.7);
    var k = pops(c, 0.9, env([0, 120, 0.8, 5]), { f0: 1800, f1: 5200, tau0: 0.0005, tau1: 0.002 }); add(c, k, 0.02, 0.35);
  } });
  def('bfg.blast', { use: 'a BFG ball bursting on anything (body, weak point, ground, a reviewer)', len: 1.6, level: 0.8, vary: 0.8, gate: 0.08, poly: 3, crush: [11025, 8], make: function (c) {
    var n = white(c, 0.1); hp1(c, n, 1200); amp(c, n, perc(0.0005, 0.03)); add(c, n, 0, 0.8);
    var f = fm(c, 0.6, env([0, 240, 0.5, 70], true), 1.41, env([0, 8, 0.4, 0.3], true)); amp(c, f, perc(0.002, 0.16)); add(c, f, 0, 0.5);
    var b = white(c, 1.5), r = brown(c, 1.5); mixIn(b, r, 3); filt(c, b, 'lp', env([0, 2600, 1.2, 110], true), 0.8); amp(c, b, perc(0.003, 0.36)); drive(b, 2.5); add(c, b, 0, 1.0);
    var s = tone(c, 1.2, 'sin', env([0, 72, 0.9, 28], true)); amp(c, s, perc(0.003, 0.4)); add(c, s, 0, 0.85);
    var k = pops(c, 1.4, env([0, 80, 1.3, 2]), POP); add(c, k, 0.05, 0.35);
  } });
  def('plasma', { use: 'an electrical zap: BFG sparks, a failing light, a short circuit', len: 0.24, level: 0.45, vary: 1.5, gate: 0.04, poly: 4, variants: 2, crush: [11025, 8], make: function (c) {
    var f0 = [880, 760][c.v], a = tone(c, 0.22, 'sqr', env([0, f0, 0.14, f0 * 0.42], true), { pw: 0.3 }), r = tone(c, 0.22, 'sqr', 57);
    for (var i = 0; i < a.length; i++) a[i] *= r[i] > 0 ? 1 : 0.35;                                    // the buzz: gated at 57 Hz
    amp(c, a, perc(0.002, 0.07)); add(c, a, 0, 0.8);
    var z = fm(c, 0.12, env([0, 2400, 0.1, 900], true), 2.02, 3); amp(c, z, perc(0.001, 0.03)); add(c, z, 0, 0.4);
    var n = white(c, 0.05); filt(c, n, 'bp', 3200, 1.5); amp(c, n, perc(0.0005, 0.008)); add(c, n, 0, 0.5);
  } });

  // ---- hits
  def('hit.flesh', { use: 'a shot into flesh that is not a weak point: a reviewer, the Magician\'s sinew', len: 0.3, level: 0.55, vary: 2, gate: 0.03, poly: 3, variants: 3, make: function (c) {
    var v = c.v, s = tone(c, 0.12, 'sin', env([0, 150 + 20 * v, 0.06, 58], true)); amp(c, s, perc(0.0008, 0.026)); add(c, s, 0, 0.8);
    var n = white(c, 0.02); lp1(c, n, 3500); amp(c, n, perc(0.0003, 0.004)); add(c, n, 0, 0.5);
    squelch(c, 0.002, 0.2, 1100 - 80 * v, 330, 0.045, 0.95);
    for (var i = 0; i < 2 + v % 2; i++) { var d = tone(c, 0.018, 'sin', env([0, c.rs(900, 1300), 0.018, c.rs(280, 420)], true)); amp(c, d, perc(0.001, 0.006)); add(c, d, c.rs(0.04, 0.16), c.rs(0.12, 0.22)); }
  } });
  def('hit.armour', { use: 'a shot off armour: the Magician\'s bone plates, the editor\'s tenure (body)', len: 0.5, level: 0.5, vary: 1.5, gate: 0.04, poly: 3, variants: 3, make: function (c) {
    var v = c.v, f0 = [860, 980, 790][v];
    var n = white(c, 0.01); hp1(c, n, 3000); amp(c, n, perc(0.0002, 0.0015)); add(c, n, 0, 0.7);
    var m = modes(c, 0.4, f0, [1, 2.32, 4.25, 6.63, 9.38], [1, 0.7, 0.5, 0.35, 0.2], [0.12, 0.08, 0.05, 0.035, 0.02]); add(c, m, 0, 0.6);
    var k = tone(c, 0.05, 'sin', 330); amp(c, k, perc(0.0005, 0.012)); add(c, k, 0, 0.3);
    if (v > 0) {                                                                                           // the ricochet whine
      var r = tone(c, 0.34, 'sin', env([0, v === 1 ? 3300 : 2900, 0.34, v === 1 ? 1650 : 2100], true), { vib: { r: 38, d: 0.012 } });
      amp(c, r, perc(0.012, 0.12)); add(c, r, 0.025, 0.28);
    }
    room(c, c.out, { size: 0.5, rt: 0.25, damp: 0.3, mix: 0.1 });
  } });
  def('hit.block', { use: 'a shot stopped by the editor\'s journal-cover guard (cardboard, not metal)', len: 0.2, level: 0.65, vary: 1.5, gate: 0.04, poly: 3, variants: 2, make: function (c) {
    var v = c.v;
    // a dry, papery slap on a hardback: no thump, no room, nothing like the gun's crack-and-boom
    var n = white(c, 0.05); filt(c, n, 'bp', env([0, 1500 + 250 * v, 0.03, 950 + 150 * v], true), 1.8); amp(c, n, perc(0.0003, 0.012)); add(c, n, 0, 1);
    var m = modes(c, 0.08, 310 + 35 * v, [1, 1.62, 2.31], [1, 0.6, 0.35], [0.012, 0.008, 0.006]); add(c, m, 0.001, 0.45);   // the hollow of the cover, heavily damped
    var p = crinkle(c, 0.09, env([0, 2200, 0.09, 300]), 0.0006); hp1(c, p, 2600); amp(c, p, perc(0.001, 0.025)); add(c, p, 0.004, 0.4);   // its pages
    var k = tone(c, 0.06, 'sin', env([0, 108, 0.04, 70], true)); amp(c, k, perc(0.0008, 0.014)); add(c, k, 0, 0.18);
    drive(c.out, 1.4);
  } });
  // hit.weak and hit.crit rise continuously with k: 19 semitones over k 0..1, rendered every PITCH_Q semitones and the
  // rest played as playback rate (at most one semitone, so the length changes by at most 6%). The level falls 3.5 dB
  // over the climb, so the brighter top steps sound no louder than the first
  function tilt(peak) { return function (c) { return peak * Math.pow(10, -3.5 / 20 * c.st / PITCH_SPAN); }; }
  def('hit.weak', { use: 'a weak-point hit (H-INDEX badge, CONFLICTS OF INTEREST); k = 1 - hp/maxHp raises the pitch', bake: 'pitch', len: 0.17, level: tilt(0.44), vary: 0.15, gate: 0.02, poly: 3, make: function (c) {
    ding(c, 0, 660 * Math.pow(2, c.st / 12), 1, 0.035);
  } });
  def('hit.crit', { use: 'a critical weak-point hit (the Magician\'s every-fourth chained hit, the BFG on the badge); same k', bake: 'pitch', len: 0.42, level: tilt(0.46), vary: 0.1, gate: 0.03, poly: 2, make: function (c) {
    var f = 660 * Math.pow(2, c.st / 12);
    ding(c, 0, f, 1, 0.055); ding(c, 0.04, f * 1.5, 0.7, 0.055); ding(c, 0.08, f * 2, 0.6, 0.055);
    var sw = env([0, f * 1.5, 0.16, f * 3], true), s = tone(c, 0.26, 'sin', sw), s2 = tone(c, 0.26, 'sin', function (t) { return sw(t) * 2; });   // the shriek: sines, so nothing folds
    mixIn(s, s2, 0.4); amp(c, s, perc(0.004, 0.07)); add(c, s, 0.04, 0.35);
    room(c, c.out, { size: 0.7, rt: 0.35, damp: 0.3, mix: 0.1 });
  } });

  // ---- monsters
  var PAIN = [
    { f: [0, 112, 0.025, 134, 0.3, 88], vw: [0, 'uh', 0.18, 'o', 0.32, 'u'], rat: 0.35, rr: 31, br: 0.22, sub: 0.25, sc: 0.9, d: 0.36 },
    { f: [0, 150, 0.03, 172, 0.34, 96], vw: [0, 'ae', 0.1, 'a', 0.34, 'o'], rat: 0.6, rr: 37, br: 0.4, sub: 0.35, sc: 0.84, d: 0.4 },
    { f: [0, 205, 0.02, 230, 0.24, 140], vw: [0, 'e', 0.08, 'ae', 0.26, 'uh'], rat: 0.2, rr: 43, br: 0.25, sub: 0.1, sc: 0.95, d: 0.3 }
  ];
  def('enemy.pain', { use: 'a reviewer hit but not retired ("I REMAIN UNCONVINCED"); a boss flinch', len: 0.44, level: 0.6, vary: 2.5, gate: 0.08, poly: 2, variants: 3, crush: [11025, 8], make: function (c) {
    var P = PAIN[c.v];
    add(c, voice(c, P.d + 0.02, { f0: env(P.f, true), vowel: vpath(P.vw), scale: P.sc, rattle: { r: P.rr, d: P.rat }, breath: P.br, sub: P.sub, jit: 0.035,
      amp: env([0, 0, 0.012, 1, P.d * 0.55, 0.85, P.d, 0]), drive: 2 }), 0, 1);
  } });
  def('gib', { use: 'a meaty splat: something coming apart (a boss\'s last hit, a messy retirement)', len: 0.7, level: 0.7, vary: 1.5, gate: 0.1, poly: 2, crush: [11025, 8], make: function (c) {
    var s = tone(c, 0.25, 'sin', env([0, 110, 0.12, 40], true)); amp(c, s, perc(0.001, 0.06)); drive(s, 2); add(c, s, 0, 0.9);
    squelch(c, 0, 0.35, 900, 200, 0.07, 1.0);
    var cr = pops(c, 0.07, 400, { f0: 1800, f1: 3600, tau0: 0.0004, tau1: 0.0012, a0: 0.4, a1: 1 }); add(c, cr, 0.004, 0.5);   // bone
    for (var i = 0; i < 4; i++) squelch(c, c.rs(0.12, 0.5), 0.08, c.rs(1200, 1800), c.rs(300, 500), 0.02, c.rs(0.15, 0.3));    // bits landing
  } });
  def('boss.roar', { use: 'a boss roar: the editor landing and changing phase, a big entrance', len: 2.3, level: 0.8, vary: 1.2, gate: 0.5, poly: 2, crush: [11025, 8], make: function (c) {
    var f0 = env([0, 58, 0.35, 84, 1.2, 70, 2.1, 42], true);
    add(c, voice(c, 2.25, { f0: f0, vowel: vpath([0, 'o', 0.4, 'a', 1.3, 'a', 2.1, 'u']), scale: 0.62, bw: 1.3, rattle: { r: 27, d: 0.45 }, breath: 0.28, sub: 0.55, jit: 0.025, tilt: 1300, body: 0.25,
      amp: env([0, 0, 0.14, 1, 1.35, 0.9, 2.2, 0]), drive: 1.8 }), 0, 1);
    add(c, voice(c, 2.25, { f0: function (t) { return f0(t) * 0.747; }, vowel: vpath([0, 'o', 0.5, 'a', 2.1, 'o']), scale: 0.55, bw: 1.8, rattle: { r: 23, d: 0.6 }, breath: 0.2, jit: 0.06,
      amp: env([0, 0, 0.2, 1, 1.4, 0.85, 2.2, 0]), drive: 3 }), 0.02, 0.6);                                // a second throat for size
    var r = brown(c, 2.25); amp(c, r, env([0, 0, 0.2, 1, 1.5, 0.8, 2.2, 0])); add(c, r, 0, 0.35);
  } });
  def('boss.screech', { use: 'a creature screech (the Magician hurt, enraged, or arriving)', len: 1.35, level: 0.65, vary: 1.2, gate: 0.4, poly: 2, crush: [16000, 10], make: function (c) {
    var y = voice(c, 1.3, { f0: env([0, 520, 0.15, 790, 0.7, 700, 1.25, 430], true), vowel: vpath([0, 'i', 0.3, 'e', 0.9, 'ae', 1.25, 'a']), scale: 1.25, bw: 1.0, breath: 0.3, jit: 0.03,
      vib: { r: 11, d: 0.03 }, tilt: 6000, amp: env([0, 0, 0.03, 1, 0.9, 0.8, 1.3, 0]), drive: 1.8 });
    var rm = tone(c, 1.3, 'sin', 1370); for (var i = 0; i < y.length; i++) y[i] = y[i] * (0.62 + 0.38 * rm[i]);   // part ring-modulated: inhuman
    add(c, y, 0, 1);
    var h = white(c, 1.3); filt(c, h, 'hp', 5000, 0.7); amp(c, h, env([0, 0, 0.05, 1, 1.0, 0.6, 1.3, 0])); add(c, h, 0, 0.12);
  } });
  def('boss.laugh', { use: 'the Magician\'s laugh (arrival, phase change, exit)', len: 1.3, level: 0.65, vary: 1, gate: 0.6, poly: 1, crush: [16000, 10], make: function (c) {
    var T = [0, 0.16, 0.31, 0.45, 0.6];
    for (var i = 0; i < 5; i++) {
      var last = i === 4, d = last ? 0.55 : 0.13, fb = 245 - 20 * i;
      add(c, voice(c, d, { f0: env([0, fb * 1.08, d, fb * (last ? 0.62 : 0.82)], true), vowel: vpath([0, 'a', d, last ? 'o' : 'a']), scale: 0.72, rattle: { r: 33, d: 0.3 },
        breath: env([0, 0.9, 0.03, 0.25, d, 0.3]), sub: 0.45, jit: 0.03, amp: env([0, 0, 0.012, 1, d * 0.6, 0.7, d, 0]), drive: 1.8 }), T[i], last ? 0.95 : 0.85);
    }
    room(c, c.out, { size: 1.1, rt: 0.9, damp: 0.5, mix: 0.18 });
  } });
  def('windup', { use: 'a boss attack winding up; pass dur = the wind-up (boss.js charge(F.dur))', bake: 'dur', dflt: 1.0, min: 0.3, max: 4, q: 0.05, len: durLen(0.06), level: 0.6, vary: 0.5, gate: 0.2, poly: 1, crush: [11025, 8], make: function (c) {
    var D = c.dur, L = D + 0.06, u = function (t) { return Math.min(1, t / D); }, i;
    var f = function (t) { return 52 * Math.pow(3, u(t)); };
    var a = tone(c, L, 'raw', f, { jit: 0.02 }), b = tone(c, L, 'raw', function (t) { return f(t) * 1.5; });
    mixIn(a, b, 0.5); filt(c, a, 'lp', function (t) { return 250 + 2200 * u(t) * u(t); }, 2.5);
    var U = ctl(c, a.length, u, 32), rp = 0; for (i = 0; i < a.length; i++) { rp += (18 + 20 * U[i]) / c.sr; a[i] *= 0.7 + 0.3 * Math.sin(TAU * rp); }
    var sw = function (t) { return t < D ? 0.35 + 0.65 * Math.pow(u(t), 1.2) : Math.max(0, 1 - (t - D) / 0.05); };
    amp(c, a, sw); add(c, a, 0, 0.8);
    var n = white(c, L); filt(c, n, 'bp', function (t) { return 200 * Math.pow(10, u(t)); }, 2); amp(c, n, function (t) { return sw(t) * u(t); }); add(c, n, 0, 0.35);
    // the telegraph the ear catches: a whine climbing 700 Hz → 2.8 kHz, audible from the start, loudest as it fires
    var w = tone(c, L, 'tri', function (t) { return 700 * Math.pow(4, u(t)); }, { vib: { r: 13, d: 0.012 } }); amp(c, w, function (t) { return sw(t) * (0.6 + 0.4 * u(t)); }); add(c, w, 0, 0.45);
  } });
  def('hiss', { use: 'the Magician\'s hiss before an attack or while exposed; pass dur', bake: 'dur', dflt: 0.8, min: 0.2, max: 3, q: 0.05, len: durLen(0.08), level: 0.45, vary: 1, gate: 0.15, poly: 2, make: function (c) {
    var D = c.dur, L = D + 0.08, fl = smooth(c, L, 18);
    var sw = function (t) { return t < D ? 0.15 + 0.85 * Math.pow(t / D, 1.2) : Math.max(0, 1 - (t - D) / 0.08); };
    var n = white(c, L), h = white(c, L); filt(c, n, 'bp', env([0, 3200, D, 5200], true), 1.6); hp1(c, h, 5000); mixIn(n, h, 0.5);
    amp(c, n, function (t) { return sw(t) * (0.75 + 0.25 * fl(t)); }); add(c, n, 0, 1);
    add(c, voice(c, L, { f0: env([0, 330, L, 280], true), vowel: vpath([0, 'i', L, 'e']), scale: 1.1, breath: 0.9, jit: 0.05, amp: sw }), 0, 0.18);   // a throat under it
  } });

  // ---- fire and magic
  def('fireball.launch', { use: 'a fireball thrown (the Magician\'s burning manuscripts, the editor\'s orbs)', len: 0.5, level: 0.55, vary: 2, gate: 0.05, poly: 4, variants: 2, crush: [11025, 8], make: function (c) {
    var n = white(c, 0.45); filt(c, n, 'bp', env([0, 500, 0.06, 2600 - 400 * c.v, 0.4, 800], true), 1.4); amp(c, n, perc(0.015, 0.12)); drive(n, 2); add(c, n, 0, 1);
    var s = tone(c, 0.15, 'sin', env([0, 125, 0.1, 68], true)); amp(c, s, perc(0.003, 0.05)); add(c, s, 0, 0.45);
    var k = pops(c, 0.4, env([0, 90, 0.4, 10]), POP); add(c, k, 0.02, 0.25);
  } });
  def('fireball.burst', { use: 'a fireball bursting: shot down, or landing (orb pop, ink stroke landing)', len: 0.65, level: 0.6, vary: 2, gate: 0.04, poly: 4, variants: 2, crush: [11025, 8], make: function (c) {
    var n = white(c, 0.6); filt(c, n, 'lp', env([0, 6000, 0.4, 700], true), 0.8); amp(c, n, perc(0.001, 0.1)); drive(n, 2.2); add(c, n, 0, 0.85);
    var k = pops(c, 0.6, env([0, 260, 0.55, 8]), POP); add(c, k, 0, 0.6);
    var s = tone(c, 0.14, 'sin', env([0, 115 - 10 * c.v, 0.1, 48], true)); amp(c, s, perc(0.001, 0.04)); add(c, s, 0, 0.55);
  } });
  def('crackle', { use: 'a few pops of flame: a manuscript catching, scorch trails', len: 0.22, level: 0.35, vary: 3, gate: 0.06, poly: 3, variants: 3, make: function (c) {
    var b = new Float32Array(len(c, 0.22)), k = 4 + c.v + Math.floor(c.r() * 2);
    for (var i = 0; i < k; i++) pop(c, b, i ? Math.floor(c.rs(0.01, 0.17) * c.sr) : 0, POP);      // the first pop is on the beat
    add(c, b, 0, 1);
  } });
  def('teleport', { use: 'a teleport out: a reversed swell that stops dead', len: 0.62, level: 0.6, vary: 0.8, gate: 0.15, poly: 2, fout: 3, make: function (c) {
    var L = 0.6, b = new Float32Array(len(c, L));
    var n = white(c, L); filt(c, n, 'bp', env([0, 5200, L, 700], true), 1.3); amp(c, n, perc(0.001, 0.14)); norm(n, 1); mixIn(b, n, 0.8);
    var f = fm(c, L, 820, 2.76, env([0, 5, L, 0.5], true)); amp(c, f, perc(0.001, 0.16)); mixIn(b, f, 0.5);
    var s = tone(c, L, 'sin', env([0, 1700, L, 180], true)); amp(c, s, perc(0.001, 0.2)); mixIn(b, s, 0.35);
    room(c, b, { size: 1.0, rt: 0.6, damp: 0.3, mix: 0.3 });
    add(c, reverse(b), 0, 1);
  } });
  def('appear', { use: 'a teleport in: arrival in a column of flame', len: 0.8, level: 0.65, vary: 1, gate: 0.12, poly: 2, make: function (c) {
    var n = white(c, 0.7); filt(c, n, 'lp', env([0, 3200, 0.5, 220], true), 1); amp(c, n, perc(0.004, 0.14)); drive(n, 1.8); add(c, n, 0, 0.9);
    var s = tone(c, 0.55, 'raw', env([0, 900, 0.5, 60], true)); filt(c, s, 'lp', 2500, 0.9); amp(c, s, perc(0.002, 0.12)); drive(s, 2); add(c, s, 0, 0.35);
    var f = fm(c, 0.5, 1200, 1.5, env([0, 4, 0.5, 0])); amp(c, f, perc(0.002, 0.1)); add(c, f, 0, 0.2);
    var t = tone(c, 0.3, 'sin', env([0, 95, 0.25, 40], true)); amp(c, t, perc(0.002, 0.08)); add(c, t, 0, 0.6);
    var k = pops(c, 0.7, env([0, 60, 0.7, 5]), POP); add(c, k, 0.05, 0.3);
  } });
  def('flame', { use: 'LOOP: burning ground, a flame column, the line of fire; pass dur or stop()', loop: true, len: 2.65, xf: 0.25, rate: 22050, level: 0.6, vary: 1, gate: 0.1, poly: 3, make: function (c) {
    var L = 2.65, r = brown(c, L), wob = smooth(c, L, 3), fw = smooth(c, L, 1.3);
    filt(c, r, 'lp', function (t) { return 520 + 260 * fw(t); }, 0.9); amp(c, r, function (t) { return 0.8 + 0.2 * wob(t); }); add(c, r, 0, 0.9);
    // the roar's hiss and a dense crackle carry it at 1-4 kHz, where it can be heard over the music
    var m = white(c, L); filt(c, m, 'bp', function (t) { return 1500 + 500 * fw(t); }, 0.8); amp(c, m, function (t) { return 0.6 + 0.4 * wob(t); }); add(c, m, 0, 0.6);
    var k = pops(c, L, function (t) { return 40 + 25 * wob(t); }, POP); add(c, k, 0, 0.9);
  } });
  def('drone', { use: 'LOOP: a menacing hum (the desperation ring); play with ttl, feed() every frame', loop: true, len: 2.05, xf: 0.05, xlin: true, rate: 11025, level: 0.45, vary: 0, gate: 0.2, poly: 2, make: function (c) {
    // every partial and LFO completes whole cycles in 2 s, so the loop is phase-continuous
    var L = 2.05, a = tone(c, L, 'saw', 55), b = tone(c, L, 'saw', 55.5), s = tone(c, L, 'sqr', 27.5), f = tone(c, L, 'saw', 82.5);
    mixIn(a, b, 1); mixIn(a, s, 0.6); mixIn(a, f, 0.25);
    filt(c, a, 'lp', function (t) { return 480 + 180 * Math.sin(TAU * 0.5 * t); }, 2.2);
    amp(c, a, function (t) { return 0.85 + 0.15 * Math.sin(TAU * 6 * t); }); drive(a, 1.5); add(c, a, 0, 1);
  } });
  def('wind', { use: 'LOOP: an ill wind before the Magician arrives; pass dur', loop: true, len: 4.3, xf: 0.3, rate: 16000, level: 0.4, vary: 0, gate: 0.5, poly: 1, make: function (c) {
    var L = 4.3, n = white(c, L), n2 = white(c, L);
    filt(c, n, 'bp', function (t) { return 520 + 260 * Math.sin(TAU * 0.25 * t) + 120 * Math.sin(TAU * 0.75 * t + 1); }, 7);
    filt(c, n2, 'bp', function (t) { return 900 + 300 * Math.sin(TAU * 0.5 * t + 2); }, 9); mixIn(n, n2, 0.6);
    amp(c, n, function (t) { return 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(TAU * 0.25 * t + 0.5)); }); add(c, n, 0, 1);
    var r = brown(c, L); lp1(c, r, 200); add(c, r, 0, 0.3);
  } });
  def('dispel', { use: 'a curse lifted (the Magician\'s ring of fire dispelled)', len: 0.8, level: 0.5, vary: 0.5, gate: 0.2, poly: 1, make: function (c) {
    var s = tone(c, 0.35, 'sin', env([0, 1200, 0.3, 2400], true)); amp(c, s, perc(0.005, 0.12)); add(c, s, 0, 0.5);
    [0, 4, 7, 12].forEach(function (x, i) { var b = fm(c, 0.4, 1760 * Math.pow(2, x / 12), 2, env([0, 1.5, 0.3, 0.1], true)); amp(c, b, perc(0.002, 0.14)); add(c, b, 0.03 + i * 0.04, 0.35); });
    var n = white(c, 0.5); filt(c, n, 'lp', env([0, 2200, 0.45, 300], true), 1); amp(c, n, perc(0.003, 0.12)); add(c, n, 0, 0.4);
    room(c, c.out, { size: 0.9, rt: 0.6, damp: 0.3, mix: 0.15 });
  } });

  // ---- movement, impacts, explosions
  def('dash', { use: 'a lunge: the Magician\'s dash', len: 0.55, level: 0.6, vary: 1.5, gate: 0.15, poly: 2, make: function (c) {
    var n = white(c, 0.5); filt(c, n, 'bp', env([0, 600, 0.18, 3000, 0.5, 900], true), 1.2); amp(c, n, env([0, 0, 0.18, 1, 0.5, 0])); add(c, n, 0, 0.9);
    var s = tone(c, 0.5, 'raw', env([0, 320, 0.5, 60], true)); filt(c, s, 'lp', 1400, 1); amp(c, s, perc(0.01, 0.14)); drive(s, 2); add(c, s, 0, 0.45);
    add(c, voice(c, 0.28, { f0: env([0, 190, 0.28, 120], true), vowel: vpath([0, 'a', 0.28, 'o']), scale: 0.8, rattle: { r: 34, d: 0.5 }, breath: 0.5, jit: 0.04,
      amp: env([0, 0, 0.02, 1, 0.28, 0]), drive: 2 }), 0.01, 0.35);
  } });
  def('whoosh', { use: 'something light flying past: an orb lobbed, an ink stroke falling', len: 0.4, level: 0.4, vary: 2, gate: 0.08, poly: 3, variants: 2, make: function (c) {
    var n = white(c, 0.38); filt(c, n, 'bp', env([0, 350 + 100 * c.v, 0.2, 1900 + 300 * c.v, 0.38, 700], true), 1.4);
    amp(c, n, function (t) { var a = 0.05 + 0.03 * c.v; return t < a ? Math.sin(Math.PI / 2 * t / a) : Math.max(0, 1 - (t - a) / (0.38 - a)); }); add(c, n, 0, 1);
  } });
  def('slam', { use: 'a heavy ground hit: the editor\'s shockwave ring, the Magician\'s line of fire starting', len: 0.85, level: 0.8, vary: 1, gate: 0.1, poly: 2, crush: [22050, 10], make: function (c) {
    var s = tone(c, 0.7, 'sin', env([0, 112, 0.35, 30], true)); amp(c, s, perc(0.001, 0.18)); drive(s, 2); add(c, s, 0, 1);
    var n = white(c, 0.6); filt(c, n, 'lp', env([0, 1000, 0.5, 90], true), 0.9); amp(c, n, perc(0.001, 0.12)); drive(n, 1.8); add(c, n, 0, 0.75);
    var d = pops(c, 0.7, env([0, 90, 0.7, 4]), DEBRIS); add(c, d, 0.03, 0.3);
  } });
  def('stomp', { use: 'a giant footstep (the editor walking); scale gain by distance', len: 0.4, level: 0.6, vary: 1.5, gate: 0.1, poly: 2, make: function (c) {
    var s = tone(c, 0.35, 'sin', env([0, 82, 0.2, 38], true)); amp(c, s, perc(0.001, 0.08)); drive(s, 1.6); add(c, s, 0, 1);
    var n = white(c, 0.2); lp1(c, n, 420); lp1(c, n, 420); amp(c, n, perc(0.001, 0.04)); add(c, n, 0, 0.5);
    // the heel coming down: a hard knock at 1-2 kHz and a crunch of paving, so the step reads on small speakers
    var kn = white(c, 0.04); filt(c, kn, 'bp', 1300, 1.3); amp(c, kn, perc(0.0003, 0.008)); add(c, kn, 0, 0.8);
    var m = modes(c, 0.1, 240, [1, 1.71, 2.53], [1, 0.5, 0.3], [0.03, 0.02, 0.012]); add(c, m, 0, 0.4);
    var d = pops(c, 0.3, env([0, 90, 0.3, 2]), DEBRIS); add(c, d, 0.01, 0.3);
  } });
  def('quake', { use: 'the enormous landing (the editor falling on the town)', len: 3.0, level: 0.85, vary: 0.5, gate: 0.5, poly: 1, crush: [11025, 8], make: function (c) {
    var s = tone(c, 2.0, 'sin', env([0, 120, 1.6, 24], true)); amp(c, s, perc(0.002, 0.5)); drive(s, 2.2); add(c, s, 0, 1);
    var w = tone(c, 1.4, 'raw', env([0, 55, 1.2, 28], true)); filt(c, w, 'lp', 320, 1); amp(c, w, perc(0.003, 0.4)); drive(w, 2.5); add(c, w, 0, 0.45);
    var n = white(c, 2.8), b = brown(c, 2.8); mixIn(n, b, 2); filt(c, n, 'lp', env([0, 1500, 2.4, 50], true), 0.8); amp(c, n, perc(0.002, 0.7)); drive(n, 2.5); add(c, n, 0, 0.9);
    var h = white(c, 0.4); filt(c, h, 'hp', env([0, 5000, 0.3, 800], true), 0.7); amp(c, h, perc(0.001, 0.08)); add(c, h, 0, 0.45);
    var d = pops(c, 2.8, env([0, 150, 2.6, 3]), DEBRIS); add(c, d, 0.05, 0.35);
  } });
  def('explosion', { use: 'a big explosion (a boss blowing apart)', len: 1.8, level: 0.85, vary: 1.5, gate: 0.08, poly: 3, variants: 2, crush: [11025, 8], make: function (c) {
    var v = c.v, n = white(c, 0.03); amp(c, n, perc(0.0003, 0.008)); add(c, n, 0, 1);
    var s = tone(c, 1.0, 'sin', env([0, 92 - 8 * v, 0.6, 30], true)); amp(c, s, perc(0.001, 0.3)); drive(s, 2); add(c, s, 0, 0.9);
    var b = white(c, 1.6), r = brown(c, 1.6); mixIn(b, r, 3); filt(c, b, 'lp', env([0, 3200, 1.3, 140], true), 0.8); amp(c, b, perc(0.002, 0.32 + 0.06 * v)); drive(b, 3); add(c, b, 0, 1);
    var k = pops(c, 1.6, env([0, 110, 1.5, 3]), POP); add(c, k, 0.03, 0.4);
    var rr = brown(c, 1.7); lp1(c, rr, 120); amp(c, rr, perc(0.02, 0.6)); add(c, rr, 0, 0.5);
  } });
  def('shatter', { use: 'armour or glass shattering (the editor\'s death, the Magician\'s plates falling)', len: 0.95, level: 0.6, vary: 1, gate: 0.2, poly: 2, make: function (c) {
    var n = white(c, 0.25); hp1(c, n, 2500); amp(c, n, perc(0.0008, 0.05)); add(c, n, 0, 0.7);
    var k = white(c, 0.06); filt(c, k, 'bp', 600, 1.5); amp(c, k, perc(0.001, 0.03)); add(c, k, 0, 0.45);
    for (var i = 0; i < 14; i++) {
      var t = i < 5 ? c.rs(0, 0.06) : c.rs(0.05, 0.62), m = modes(c, 0.3, c.rs(1400, 5200), [1, 1.93, 2.87], [1, 0.5, 0.3], [c.rs(0.03, 0.12), 0.03, 0.02]);
      add(c, m, t, c.rs(0.15, 0.4) * (i < 5 ? 1 : 0.7));
    }
    room(c, c.out, { size: 0.8, rt: 0.5, damp: 0.2, mix: 0.12 });
  } });
  def('snap', { use: 'a finger snap (the Magician: "I WAS NEVER HERE.")', len: 0.2, level: 0.7, vary: 1, gate: 0.08, poly: 2, make: function (c) {
    var n = white(c, 0.02); hp1(c, n, 2000); amp(c, n, perc(0.0002, 0.003)); add(c, n, 0, 1);
    var r = white(c, 0.08); filt(c, r, 'bp', 1850, 8); amp(c, r, perc(0.0003, 0.02)); add(c, r, 0, 0.8);
    var s = tone(c, 0.04, 'sin', 290); amp(c, s, perc(0.0005, 0.008)); add(c, s, 0, 0.4);
    room(c, c.out, { size: 0.9, rt: 0.45, damp: 0.4, mix: 0.2 });
  } });
  def('omen', { use: 'a rumbling swell before a boss arrives (silence, then this); pass dur', bake: 'dur', dflt: 3, min: 0.5, max: 8, q: 0.1, len: durLen(0.1), level: 0.6, vary: 0, gate: 1, poly: 1, crush: [11025, 8], make: function (c) {
    var D = c.dur, L = D + 0.1, u = function (t) { return Math.min(1, t / D); };
    var sw = function (t) { return t < D ? 0.05 + 0.95 * Math.pow(u(t), 2.2) : Math.max(0, 1 - (t - D) / 0.1); };
    var r = brown(c, L); filt(c, r, 'lp', function (t) { return 90 * Math.pow(260 / 90, u(t)); }, 1.4); amp(c, r, sw); add(c, r, 0, 0.9);
    var s = tone(c, L, 'sin', function (t) { return 38 * Math.pow(52 / 38, u(t)); }); amp(c, s, sw); add(c, s, 0, 0.7);
    add(c, voice(c, L, { f0: function (t) { return 41 + 6 * u(t); }, vowel: vpath([0, 'u', D, 'o']), scale: 0.5, bw: 2, rattle: { r: 17, d: 0.5 }, breath: 0.3, jit: 0.05, amp: sw, drive: 2 }), 0, 0.35);
  } });
  def('whistle', { use: 'something falling from the sky (the editor\'s drop); pass dur', bake: 'dur', dflt: 2, min: 0.5, max: 6, q: 0.1, len: durLen(0.03), rate: 16000, level: 0.5, vary: 0, gate: 1, poly: 1, make: function (c) {
    var D = c.dur, L = D + 0.03, u = function (t) { return Math.min(1, t / D); };
    var sw = function (t) { return t < D ? 0.1 + 0.9 * Math.sqrt(u(t)) : Math.max(0, 1 - (t - D) / 0.03); };
    var s = tone(c, L, 'sin', function (t) { return 2600 * Math.pow(0.1, u(t)); }, { vib: { r: 7, d: 0.006 } }); amp(c, s, sw); add(c, s, 0, 0.8);
    var n = white(c, L); filt(c, n, 'bp', function (t) { return 3000 * Math.pow(400 / 3000, u(t)); }, 3); amp(c, n, sw); add(c, n, 0, 0.35);
  } });
  def('rocket', { use: 'ignition and a rocket roar (the blast-off); pass dur', bake: 'dur', dflt: 4, min: 1, max: 8, q: 0.1, len: durLen(0), level: 0.75, vary: 0, gate: 1, poly: 1, crush: [22050, 10], make: function (c) {
    var D = c.dur, fadeT = D * 0.8, rum = smooth(c, D, 12);
    var sw = function (t) { var a = t < 1.1 ? 0.25 + 0.75 * (t / 1.1) : 1; if (t > fadeT) a *= Math.max(0, 1 - (t - fadeT) / (D - fadeT)); return a; };
    var h = white(c, 0.15); hp1(c, h, 1500); amp(c, h, perc(0.0005, 0.04)); add(c, h, 0, 0.6);
    var k = tone(c, 0.3, 'sin', env([0, 90, 0.25, 40], true)); amp(c, k, perc(0.001, 0.08)); add(c, k, 0, 0.7);
    var n = white(c, D), r = brown(c, D); mixIn(n, r, 2); filt(c, n, 'lp', function (t) { return 150 * Math.pow(16, Math.min(1, t / 1.4)); }, 0.9);
    amp(c, n, function (t) { return sw(t) * (0.8 + 0.2 * rum(t)); }); drive(n, 2); add(c, n, 0, 1);
    var s = tone(c, D, 'raw', function (t) { return 45 * Math.pow(160 / 45, Math.min(1, t / D)); }); filt(c, s, 'lp', 400, 1); amp(c, s, sw); drive(s, 2.5); add(c, s, 0, 0.35);
    var p = pops(c, D, 60, POP); amp(c, p, sw); add(c, p, 0, 0.25);
  } });

  // ---- the player
  def('player.pain', { use: 'the player hit (api.hurt): the grunt; pair with heart.lost', len: 0.36, level: 0.7, vary: 1, gate: 0.25, poly: 1, variants: 2, crush: [11025, 8], make: function (c) {
    if (c.v === 0) {                                                                                       // "oof"
      add(c, voice(c, 0.28, { f0: env([0, 150, 0.03, 168, 0.26, 104], true), vowel: vpath([0, 'u', 0.08, 'uh', 0.24, 'uh']), breath: 0.25, rattle: { r: 40, d: 0.15 }, jit: 0.025,
        amp: env([0, 0, 0.006, 1, 0.14, 0.8, 0.26, 0]), drive: 1.8 }), 0, 1);
      var f = white(c, 0.08); hp1(c, f, 2600); amp(c, f, env([0, 0, 0.01, 1, 0.08, 0])); add(c, f, 0.2, 0.18);
    } else {                                                                                               // "uh!"
      var g = white(c, 0.006); lp1(c, g, 1200); amp(c, g, perc(0.0003, 0.0015)); add(c, g, 0, 0.5);
      add(c, voice(c, 0.24, { f0: env([0, 140, 0.02, 158, 0.22, 96], true), vowel: vpath([0, 'uh', 0.22, 'a']), scale: 0.95, breath: 0.35, rattle: { r: 36, d: 0.3 }, jit: 0.03,
        amp: env([0, 0, 0.004, 1, 0.1, 0.75, 0.22, 0]), drive: 2.2 }), 0.002, 1);
    }
  } });
  def('heart.lost', { use: 'a heart gone: the harsh arcade damage sting', len: 0.58, level: 0.45, vary: 0, gate: 0.3, poly: 1, make: function (c) {
    sting(c, 0, 0.13, 740); sting(c, 0.12, 0.42, 370);
  } });
  def('player.death', { use: 'REJECTED!: the death scream and the body hitting the floor', len: 2.0, level: 0.8, vary: 0.5, gate: 1, poly: 1, crush: [11025, 8], make: function (c) {
    add(c, voice(c, 1.55, { f0: env([0, 235, 0.1, 292, 0.6, 205, 1.45, 82], true), vowel: vpath([0, 'a', 0.6, 'a', 1.1, 'o', 1.45, 'u']), breath: env([0, 0.2, 1.4, 0.5]),
      rattle: { r: 31, d: env([0, 0.05, 0.7, 0.2, 1.45, 0.8]) }, sub: env([0, 0, 0.8, 0.1, 1.45, 0.5]), jit: 0.03, vib: { r: 6, d: env([0, 0.005, 1.0, 0.04]) },
      amp: env([0, 0, 0.02, 1, 0.7, 0.95, 1.5, 0]), drive: 2 }), 0, 1);
    var s = tone(c, 0.5, 'sin', env([0, 92, 0.3, 34], true)); amp(c, s, perc(0.001, 0.14)); drive(s, 2); add(c, s, 1.42, 0.95);
    var n = white(c, 0.3); lp1(c, n, 500); lp1(c, n, 500); amp(c, n, perc(0.001, 0.06)); add(c, n, 1.42, 0.6);
  } });
  def('pickup', { use: 'an item picked up (FACT FOUND, a heart)', len: 0.18, level: 0.2, vary: 0, gate: 0.05, poly: 2, crush: [11025, 8], make: function (c) {
    var a = tone(c, 0.06, 'sqr', env([0, 1000, 0.01, 1046], true)); amp(c, a, env([0, 0, 0.002, 1, 0.05, 0.7, 0.06, 0])); add(c, a, 0, 0.8);
    var b = tone(c, 0.1, 'sqr', env([0, 1500, 0.01, 1568], true)); amp(c, b, env([0, 0, 0.002, 1, 0.07, 0.6, 0.1, 0])); add(c, b, 0.06, 0.8);
  } });
  def('powerup', { use: 'a power-up: the BFG handed over', len: 1.05, level: 0.55, vary: 0, gate: 0.5, poly: 1, crush: [22050, 8], make: function (c) {
    [0, 4, 7, 12, 16, 19].forEach(function (x, i) { var b = fm(c, 0.3, 523.25 * Math.pow(2, x / 12), 2, env([0, 2.5, 0.2, 0.2], true)); amp(c, b, perc(0.002, 0.08)); add(c, b, i * 0.055, 0.55); });
    [1046.5, 1568, 2093].forEach(function (f) {
      var s = tone(c, 0.7, 'tri', f, { vib: { r: 12, d: 0.004 } });
      amp(c, s, function (t) { return (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / 0.25)) * (0.75 + 0.25 * Math.sin(TAU * 12 * t)); }); add(c, s, 0.33, 0.3);
    });
  } });

  // ---- cards and stings
  def('victory', { use: 'a boss beaten: the short fanfare under REBUTTAL/MANUSCRIPT ACCEPTED', len: 1.7, level: 0.6, vary: 0, gate: 1, poly: 1, crush: [22050, 10], make: function (c) {
    [392, 523.25, 659.25].forEach(function (f, i) { brass(c, i * 0.09, 0.12, f, 0.7); });
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { brass(c, 0.28, 1.2, f, 0.45); });
    var n = white(c, 1.0); hp1(c, n, 6000); amp(c, n, perc(0.001, 0.35)); add(c, n, 0.28, 0.2);
    room(c, c.out, { size: 1.0, rt: 0.8, damp: 0.4, mix: 0.15 });
  } });
  def('ui.confirm', { use: 'a menu confirm: PRESS START, RESUBMIT, a talk prompt accepted', len: 0.3, level: 0.2, vary: 0, gate: 0.05, poly: 2, make: function (c) {
    var a = tone(c, 0.07, 'sqr', 1318.5); lp1(c, a, 6000); amp(c, a, env([0, 0, 0.002, 1, 0.06, 0.7, 0.07, 0])); add(c, a, 0, 0.7);
    var b = tone(c, 0.22, 'sqr', 1760), f = fm(c, 0.22, 1760, 2, env([0, 1.5, 0.2, 0])); lp1(c, b, 6000); mixIn(b, f, 0.5);
    amp(c, b, perc(0.002, 0.07)); add(c, b, 0.065, 0.75);
  } });
  def('ui.tick', { use: 'a countdown beep (3, 2, 1)', len: 0.18, level: 0.24, vary: 0, gate: 0.2, poly: 1, make: function (c) {
    var a = tone(c, 0.16, 'sqr', 440), f = fm(c, 0.16, 880, 1, 0.8); mixIn(a, f, 0.3); lp1(c, a, 5000); amp(c, a, env([0, 0, 0.003, 1, 0.12, 0.6, 0.16, 0])); add(c, a, 0, 1);
  } });
  def('ui.go', { use: 'the countdown\'s GO', len: 0.55, level: 0.22, vary: 0, gate: 0.2, poly: 1, make: function (c) {
    var a = tone(c, 0.5, 'sqr', 880), b = tone(c, 0.5, 'sqr', 1320); mixIn(a, b, 0.6); lp1(c, a, 6000); amp(c, a, env([0, 0, 0.003, 1, 0.3, 0.7, 0.5, 0])); add(c, a, 0, 1);
  } });
  def('ui.type', { use: 'a keystroke of the dossier card typing out', len: 0.04, level: 0.25, vary: 2, gate: 0.04, poly: 2, fout: 4, make: function (c) {
    var n = white(c, 0.02); filt(c, n, 'bp', 3500, 2); amp(c, n, perc(0.0002, 0.003)); add(c, n, 0, 1);
    var a = tone(c, 0.012, 'sqr', 1320); amp(c, a, perc(0.0005, 0.004)); add(c, a, 0, 0.5);
  } });

  /* ------------------------------------------------------------ render */
  // the semitones a pitch-baked sound is rendered at, covering k 0..1: 0, 2, ... 20
  function pitchSteps() { var s = [], top = PITCH_Q * Math.round(PITCH_SPAN / PITCH_Q); for (var x = 0; x <= top; x += PITCH_Q) s.push(x); return s; }
  // the baked parameters of one render: variant, pitch step (tuned sounds) or length (length-baked sounds); frac is the
  // pitch left to the playback rate (semitones)
  function params(d, o) {
    var v = 0, st = 0, dur = 0, frac = 0, nv = d.variants;
    if (nv > 1 && o.variant != null) v = ((Math.floor(o.variant) % nv) + nv) % nv;
    if (d.bake === 'pitch') {
      var s = o.pitch != null ? +o.pitch : o.k != null ? PITCH_SPAN * clamp(+o.k || 0, 0, 1) : 0;
      s = clamp(s || 0, -12, 24); st = PITCH_Q * Math.round(s / PITCH_Q); frac = s - st;
    } else if (o.pitch != null) frac = +o.pitch || 0;
    if (d.bake === 'dur') { dur = clamp(o.dur != null ? +o.dur || d.dflt : d.dflt, d.min, d.max); dur = +(Math.round(dur / d.q) * d.q).toFixed(3); }
    return { v: v, st: st, dur: dur, frac: frac, key: d.name + '|' + v + '|' + st + '|' + dur };
  }
  function synth(d, sr, p) {
    var R = Math.min(sr, d.crush ? d.crush[0] : d.rate || CLEAN_RATE), c = new Syn(R, hash(p.key));
    c.v = p.v; c.st = p.st; c.dur = p.dur;
    c.n = len(c, typeof d.len === 'function' ? d.len(c) : d.len); c.out = new Float32Array(c.n);
    d.make(c);
    var b = c.out, i;
    if (d.loop) { var m = 0; for (i = 0; i < b.length; i++) m += b[i]; m /= b.length; for (i = 0; i < b.length; i++) b[i] -= m; }
    else hp1(c, b, 15);
    norm(b, 1);
    if (d.crush) quantise(b, d.crush[1]);
    if (d.loop) b = loopify(c, b, d.xf || 0.1, d.xlin);
    if (R < sr) b = d.crush ? zoh(b, R, sr) : lerpUp(b, R, sr);
    if (!d.loop) fades(sr, b, d.fin == null ? 0.5 : d.fin, d.fout == null ? 12 : d.fout);
    return norm(b, typeof d.level === 'function' ? d.level(c) : d.level);
  }

  /* ------------------------------------------------------------ the runtime kit: one per AudioContext */
  var CACHE = {}, STATS = { renders: 0, ms: 0, samples: 0 }, KITS = [], MAX_VOICES = 24;
  // The bus is a limiter: unity below about 0.5, sustained peaks held near 0.6, so a stack of explosions cannot clip.
  // Chrome's DynamicsCompressor adds automatic makeup gain (measured: x1.373 small-signal at these settings); TRIM hands
  // it back. The shaper after it is a soft ceiling: linear to 0.6, never above 0.8.
  var TRIM = 0.728, CEIL = null;
  function ceilCurve() {
    if (CEIL) return CEIL;
    var n = 2049; CEIL = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1, a = Math.abs(x), y = a <= 0.6 ? a : 0.6 + 0.2 * Math.tanh((a - 0.6) / 0.2); CEIL[i] = x < 0 ? -y : y; }
    return CEIL;
  }
  function bufferFor(ac, d, p) {
    var sr = ac.sampleRate, C = CACHE[sr] || (CACHE[sr] = {}), B = C[p.key];
    if (B) return B;
    var t0 = clock(), data = synth(d, sr, p);
    B = ac.createBuffer(1, data.length, sr);
    if (B.copyToChannel) B.copyToChannel(data, 0); else B.getChannelData(0).set(data);
    STATS.renders++; STATS.ms += clock() - t0; STATS.samples += data.length;
    C[p.key] = B; return B;
  }
  // every buffer a name can need: each variant, each scale step of a tuned sound, and the default length of a
  // length-baked one, or the length asked for when the item is {name, dur}
  function warmList(names) {
    var out = [];
    if (names == null) names = NAMES; else if (!Array.isArray(names)) names = [names];      // one name or {name, dur} is a list of one
    names.forEach(function (it) {
      var n = typeof it === 'string' ? it : it && it.name, d = DEFS[n]; if (!d) return;
      for (var v = 0; v < d.variants; v++) {
        if (d.bake === 'pitch') pitchSteps().forEach(function (s) { out.push([d, params(d, { variant: v, pitch: s })]); });
        else out.push([d, params(d, { variant: v, dur: typeof it === 'string' ? null : it.dur })]);
      }
    });
    return out;
  }
  function listenerOf(L) {
    if (!L) return null;
    var x, y, z, rx, rz;
    if (L.matrixWorld && L.matrixWorld.elements) { var e = L.matrixWorld.elements; x = e[12]; y = e[13]; z = e[14]; rx = e[0]; rz = e[2]; }
    else {
      var P = L.position || L, yaw = L.yaw != null ? L.yaw : L.rotation ? L.rotation.y : 0;
      x = P.x; y = P.y || 0; z = P.z; rx = Math.cos(yaw); rz = -Math.sin(yaw);
    }
    var rl = Math.sqrt(rx * rx + rz * rz) || 1;
    return { x: x || 0, y: y || 0, z: z || 0, rx: rx / rl, rz: rz / rl };
  }
  // distance attenuation (1 inside ref, ref/d beyond, never below floor) and a pan from the listener's right vector
  function spatial(pos, L, o) {
    var l = listenerOf(L); if (!pos || !l) return null;
    var dx = (pos.x || 0) - l.x, dy = (pos.y || 0) - l.y, dz = (pos.z || 0) - l.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var ref = o.ref || 6, floor = o.floor == null ? 0.25 : o.floor, h = Math.sqrt(dx * dx + dz * dz);
    var side = h > 1e-6 ? (dx * l.rx + dz * l.rz) / h : 0;
    return { att: d <= ref ? 1 : Math.max(floor, ref / d), pan: clamp(side * 0.85 * Math.min(1, h / 2), -0.85, 0.85) };
  }
  var DEAD = { name: '', ok: false, stop: noop, fade: noop, feed: noop, place: noop, playing: function () { return false; } };
  var NULL_KIT = {
    ac: null, bus: null, play: function () { return DEAD; }, has: function (n) { return !!DEFS[n]; }, names: function () { return NAMES.slice(); },
    warm: function (names, done) { if (done) try { done(0); } catch (e) {} }, prerender: function () { return 0; }, stopAll: noop, volume: noop,
    setListener: noop, setVoices: noop, voices: function () { return 0; }, info: function () { return { voices: 0, cap: 0, nodes: 0, renders: STATS.renders, renderMs: STATS.ms }; }
  };

  function makeKit(ac) {
    var voices = [], last = {}, lastVar = {}, cap = MAX_VOICES, lis = null, hasPan = typeof ac.createStereoPanner === 'function';
    var live = typeof ac.startRendering !== 'function';
    var input = ac.createGain(), comp = ac.createDynamicsCompressor(), trim = ac.createGain(), ceil = ac.createWaveShaper(), t = ac.currentTime;
    var direct = ac.createGain(), dly = ac.createDelay(0.05);
    comp.threshold.value = -6; comp.knee.value = 3; comp.ratio.value = 12; comp.attack.value = 0.001; comp.release.value = 0.12;
    ceil.curve = ceilCurve(); ceil.oversample = 'none';                 // no oversampling filter, so no overshoot past 0.8
    input.connect(comp); comp.connect(trim); trim.connect(ceil); input.connect(dly); dly.connect(direct); direct.connect(ceil); ceil.connect(ac.destination);
    // A new DynamicsCompressor starts in deep gain reduction and releases over ~100 ms (measured in Chrome: a shot at
    // creation came out at a fifth of its level), so the bus opens on a direct path and crossfades onto the limiter.
    // The direct path is delayed by the compressor's 6 ms look-ahead (measured: floor(0.006 * sampleRate) samples)
    // so the two stay in phase through the crossfade.
    dly.delayTime.value = Math.floor(0.006 * ac.sampleRate) / ac.sampleRate;
    direct.gain.setValueAtTime(1, t); direct.gain.linearRampToValueAtTime(0, t + 0.25);
    trim.gain.setValueAtTime(0, t); trim.gain.linearRampToValueAtTime(TRIM, t + 0.25);

    function hold(P, at) {
      if (P.cancelAndHoldAtTime) P.cancelAndHoldAtTime(at);
      else { var v = P.value; P.cancelScheduledValues(at); P.setValueAtTime(v, at); }
    }
    // A voice is alive at time T if it has started by T and is not yet ending (v.cut is when a stop or steal began).
    function alive(v, T) { return !v.done && v.t0 <= T + 1e-6 && T < v.end && T < v.cut; }
    // stop one voice at time `at`, fading over `fade` (never a click). A voice already stopping is left alone unless
    // this stop ends it sooner: a quick stopAll() still cuts a slow fade that is under way.
    function kill(v, fade, at) {
      var now = ac.currentTime; at = Math.max(now, at || 0);
      var until = at + fade + 0.02;
      if (v.done || (v.cut <= at && v.end <= until)) return;
      v.cut = Math.min(v.cut, at);
      try {
        if (v.t0 > at + 0.005) { v.src.stop(at); v.end = at; return; }          // not started by then: it simply never plays
        hold(v.g.gain, at); v.g.gain.setTargetAtTime(0, at, Math.max(0.002, fade / 5));
        v.src.stop(until); v.end = until;
      } catch (e) {}
    }
    // Admission of a voice that will sound over [t0, end) against a limit (`name`: that name's polyphony; null: the
    // global cap). How many sound at once only rises when one starts, so the peak inside the new voice's span is at its
    // own start or at the start of a voice already scheduled inside it: check each of those moments in time order and
    // steal the oldest voice sounding then (never the new one), at that moment. Plays scheduled ahead with delay are
    // judged by when they will actually sound, and an immediate burst cannot stack on top of them.
    function admit(t0, end, name, limit) {
      var pts = [t0], i, j, v;
      for (i = 0; i < voices.length; i++) { v = voices[i]; if (!v.done && v.t0 > t0 && v.t0 < end && v.t0 < v.cut && (!name || v.name === name)) pts.push(v.t0); }
      pts.sort(function (a, b) { return a - b; });
      for (i = 0; i < pts.length; i++) {
        var T = pts[i], n = 1;
        for (j = 0; j < voices.length; j++) { v = voices[j]; if ((!name || v.name === name) && alive(v, T)) n++; }
        while (n > limit) { v = oldest(T, name); if (!v) break; kill(v, 0.01, T); n--; }
      }
    }
    function prune(now) { for (var i = voices.length - 1; i >= 0; i--) { var v = voices[i]; if (v.done || v.end < now - 0.1) voices.splice(i, 1); } }
    function liveCount(T) { var n = 0; for (var i = 0; i < voices.length; i++) if (alive(voices[i], T)) n++; return n; }
    function oldest(T, name) {
      var best = null, bestLoop = null;
      for (var i = 0; i < voices.length; i++) {
        var v = voices[i]; if (!alive(v, T) || (name && v.name !== name)) continue;
        if (v.loop) { if (!bestLoop || v.t0 < bestLoop.t0) bestLoop = v; }
        else if (!best || v.t0 < best.t0) best = v;
      }
      return best || bestLoop;                   // steal a one-shot before a loop
    }
    function arm(v, now) {                       // the ttl watchdog: fade out unless fed again within ttl
      var P = v.g.gain; hold(P, now); P.linearRampToValueAtTime(v.gain * v.lvl, now + 0.03);
      v.tailAt = now + v.ttl; v.tailTau = 0.08; P.setTargetAtTime(0, v.tailAt, v.tailTau);
      v.src.stop(now + v.ttl + 0.6); v.end = now + v.ttl + 0.6; v.fed = now;
    }
    function handle(v) {
      return {
        name: v.name, ok: true, t0: v.t0,
        stop: function (fade) { kill(v, fade == null ? 0.04 : Math.max(0, +fade || 0)); },
        // move the level to `to` (a multiple of the play gain) over about `secs`; to <= 0 fades out and stops.
        // An automatic tail (a looped sound's dur, the ttl watchdog) is scheduled again after the move.
        fade: function (to, secs) {
          try {
            var now = ac.currentTime, sc = secs > 0 ? +secs : 0.1, P = v.g.gain; to = Math.max(0, +to || 0);
            if (to <= 0) { kill(v, sc, now); return; }
            if (v.cut <= now) return;                                          // already stopping: a level change cannot revive it
            hold(P, now); P.setTargetAtTime(to * v.gain, now, Math.max(0.005, sc / 4));
            v.lvl = to; if (v.tailAt < Infinity) P.setTargetAtTime(0, Math.max(now + sc, v.tailAt), v.tailTau);
          } catch (e) {}
        },
        // keep a ttl voice alive for another ttl; a voice already being stopped is not revived
        feed: function () { if (v.cut < Infinity || !v.ttl) return; try { var now = ac.currentTime; if (now - v.fed >= v.ttl * 0.25) arm(v, now); } catch (e) {} },
        place: function (pos, L) {
          if (!v.pg) return;
          try { var s = spatial(pos, L || lis, v.o); if (!s) return; var now = ac.currentTime; v.pg.gain.setTargetAtTime(s.att, now, 0.03); if (v.pn) v.pn.pan.setTargetAtTime(s.pan, now, 0.03); } catch (e) {}
        },
        playing: function () { return alive(v, ac.currentTime); }
      };
    }
    function play(name, o) {
      try {
        var d = DEFS[name]; if (!d || ac.state === 'closed') return DEAD;
        o = o || {};
        if (live && ac.state === 'suspended' && ac.resume) { try { var pr = ac.resume(); if (pr && pr.catch) pr.catch(noop); } catch (e) {} }
        var now = ac.currentTime, t0 = now + Math.max(0, +o.delay || 0), gate = o.gate != null ? +o.gate : d.gate;
        if (gate > 0 && last[name] != null && Math.abs(t0 - last[name]) < gate) return DEAD;
        last[name] = t0;
        if (d.variants > 1 && o.variant == null) {
          var pickV = Math.floor(Math.random() * d.variants);
          if (pickV === lastVar[name]) pickV = (pickV + 1 + Math.floor(Math.random() * (d.variants - 1))) % d.variants;
          o = copy(o); o.variant = pickV;
        }
        var p = params(d, o); lastVar[name] = p.v;
        var buf = bufferFor(ac, d, p);
        var vary = o.vary != null ? +o.vary || 0 : d.vary;
        var rate = Math.pow(2, (p.frac + (vary ? (Math.random() * 2 - 1) * vary : 0)) / 12) * (o.rate > 0 ? +o.rate : 1);
        var span = !d.loop ? t0 + buf.duration / rate : o.dur > 0 && !(o.ttl > 0) ? t0 + +o.dur : Infinity;
        prune(now); admit(t0, span, name, d.poly); admit(t0, span, null, cap);
        var src = ac.createBufferSource(), g = ac.createGain(), gain = o.gain != null ? Math.max(0, +o.gain || 0) : 1;
        src.buffer = buf; src.loop = !!d.loop; src.playbackRate.value = rate;
        src.connect(g);
        var v = { name: name, group: o.group || '', src: src, g: g, pg: null, pn: null, t0: t0, end: Infinity, cut: Infinity, gain: gain, lvl: 1, loop: !!d.loop, done: false, ttl: 0, fed: 0, tailAt: Infinity, tailTau: 0.05, o: o };
        if (o.pos || o.pan != null) {
          v.pg = ac.createGain(); g.connect(v.pg);
          var s = o.pos ? spatial(o.pos, o.listener || lis, o) : null, pan = s ? s.pan : clamp(+o.pan || 0, -1, 1);
          if (s) v.pg.gain.value = s.att;
          if (hasPan) { v.pn = ac.createStereoPanner(); v.pn.pan.value = pan; v.pg.connect(v.pn); v.pn.connect(input); } else v.pg.connect(input);
        } else g.connect(input);
        var atk = o.attack != null ? Math.max(0, +o.attack || 0) : d.loop ? 0.03 : 0;
        if (atk > 0) { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + atk); } else g.gain.value = gain;
        if (!d.loop) v.end = t0 + buf.duration / rate;
        else if (o.dur > 0) {                                  // a loop told how long to run fades itself out
          var fd = Math.min(o.fade != null ? Math.max(0.01, +o.fade || 0.01) : 0.25, +o.dur);
          v.tailAt = Math.max(t0 + atk, t0 + o.dur - fd); v.tailTau = fd / 5; v.end = t0 + +o.dur;
          g.gain.setTargetAtTime(0, v.tailAt, v.tailTau);
        }
        src.onended = function () { v.done = true; try { src.disconnect(); g.disconnect(); if (v.pg) v.pg.disconnect(); if (v.pn) v.pn.disconnect(); } catch (e) {} };
        src.start(t0);
        if (v.end !== Infinity) src.stop(v.end + 0.02);
        voices.push(v);
        if (o.ttl > 0) { v.ttl = +o.ttl; arm(v, Math.max(now, t0)); }
        return handle(v);
      } catch (e) { return DEAD; }
    }
    return {
      ac: ac, bus: input,
      play: play,
      has: function (n) { return !!DEFS[n]; },
      names: function () { return NAMES.slice(); },
      // render ahead a buffer at a time, yielding to the page (setTimeout 0) once 12 ms of work has passed since the last
      // yield. A buffer is never split, so the longest block is the slowest single buffer (see the contract); done(ms)
      warm: function (names, done) {
        var list = [], t0 = clock();
        try { list = warmList(names); } catch (e) {}
        (function step() {
          var t1 = clock();
          while (list.length && clock() - t1 < 12) { var it = list.shift(); try { bufferFor(ac, it[0], it[1]); } catch (e) {} }
          if (list.length) setTimeout(step, 0); else if (done) { try { done(clock() - t0); } catch (e) {} }
        })();
      },
      prerender: function (names) { var t0 = clock(); try { warmList(names).forEach(function (it) { bufferFor(ac, it[0], it[1]); }); } catch (e) {} return clock() - t0; },
      // stop every voice, scheduled ones too; with a group, only the voices played with that opts.group (the kit is
      // shared by every module on the context, so a boss stopping its own sounds passes its group)
      stopAll: function (fade, group) { var f = fade == null ? 0.05 : Math.max(0, +fade || 0); for (var i = 0; i < voices.length; i++) if (group == null || voices[i].group === group) kill(voices[i], f); },
      volume: function (x) { try { input.gain.value = Math.max(0, +x || 0); } catch (e) {} },
      setListener: function (L) { lis = L || null; },
      setVoices: function (n) { cap = clamp(Math.floor(+n) || MAX_VOICES, 1, 64); },
      voices: function () { return liveCount(ac.currentTime); },
      info: function () {
        var now = ac.currentTime, nodes = 0; for (var i = 0; i < voices.length; i++) if (!voices[i].done && voices[i].t0 <= now && voices[i].end > now) nodes++;
        return { voices: liveCount(now), cap: cap, nodes: nodes, renders: STATS.renders, renderMs: Math.round(STATS.ms * 10) / 10, samples: STATS.samples };
      }
    };
  }
  function copy(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function kit(ac) {
    try {
      if (!ac || typeof ac.createGain !== 'function') return NULL_KIT;
      for (var i = 0; i < KITS.length; i++) if (KITS[i].ac === ac) return KITS[i].kit;
      var k = makeKit(ac);
      KITS.push({ ac: ac, kit: k }); if (KITS.length > 8) KITS.shift();
      return k;
    } catch (e) { return NULL_KIT; }
  }
  function meta(n) {
    var d = DEFS[n]; if (!d) return null;
    var p = params(d, {}), c = { dur: p.dur, v: 0, st: 0, sr: 1 };
    return { name: n, use: d.use, len: typeof d.len === 'function' ? d.len(c) : d.loop ? +(d.len - (d.xf || 0.1)).toFixed(3) : d.len,
      level: typeof d.level === 'function' ? +d.level(c).toFixed(3) : d.level, vary: d.vary, gate: d.gate, poly: d.poly,
      variants: d.variants, loop: !!d.loop, bake: d.bake || null, crush: d.crush || null, dur: d.bake === 'dur' ? { dflt: d.dflt, min: d.min, max: d.max } : null,
      pitch: d.bake === 'pitch' ? { span: PITCH_SPAN, step: PITCH_Q } : null };
  }

  window.FPSFX = {
    VERSION: 1,
    kit: kit,
    names: function () { return NAMES.slice(); },
    has: function (n) { return !!DEFS[n]; },
    info: meta,
    list: function () { return NAMES.map(meta); },
    steps: pitchSteps,
    // pure synthesis, no AudioContext: {data: Float32Array, sampleRate, loop, key, rate}. opts: variant, k | pitch, dur.
    // rate is the playback rate the kit would add for the pitch not baked in (before its random vary)
    render: function (name, sampleRate, opts) {
      var d = DEFS[name]; if (!d) return null;
      var p = params(d, opts || {});
      return { data: synth(d, sampleRate || 48000, p), sampleRate: sampleRate || 48000, loop: !!d.loop, key: p.key, rate: Math.pow(2, p.frac / 12) };
    },
    stats: function () { return { renders: STATS.renders, ms: Math.round(STATS.ms * 10) / 10, samples: STATS.samples }; }
  };
})();
