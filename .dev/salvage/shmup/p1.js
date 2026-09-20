/* =============================================================================
   SHMUP.JS — "PUBLISH OR PERISH", the space stage of Palmer's Progress.
   After the boss falls the accepted manuscript is flown through the publication
   pipeline as a vertical bullet-hell shooter: DoDonPachi (tap = spread SHOT,
   hold = LASER + slow ship, HIT chain, bullet-cancel medals) crossed with
   Truxton (three colour weapons, P/S/B pickups, the skull bomb).
   2D canvas, everything procedural, fixed pools, no allocation in the hot loops.
   Test hooks: ?shmupstage=2|boss|ending  ?shmupgod=1
   ============================================================================= */
(function () {
  'use strict';
  window.QuestShmup = function (api) {
    var self = { start: start, stop: stop, active: false };
    var W = 360, H = 480, TAU = Math.PI * 2, FONT = '"Press Start 2P", monospace';
    function qp(n, d) { var m = location.search.match(new RegExp('[?&]' + n + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : d; }
    var GOD = qp('shmupgod') === '1', JUMP = qp('shmupstage', '');
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

    /* ------------------------------------------------------------ audio (all synthesised) */
    var AC = null, out = null, noiseBuf = null, gates = {};
    function audioInit() {
      try {
        AC = api.audio(); out = AC.createGain(); out.gain.value = 0.55; out.connect(AC.destination);
        var n = AC.sampleRate; noiseBuf = AC.createBuffer(1, n, n);
        var d = noiseBuf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { AC = null; }
    }
    function gate(name, gap) { if (!AC) return false; var t = AC.currentTime; if (gates[name] !== undefined && t - gates[name] < gap && t >= gates[name]) return false; gates[name] = t; return true; }
    function tone(f0, f1, dur, vol, type, delay) {
      if (!AC) return;
      try {
        var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), a = AC.createGain();
        o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        a.gain.setValueAtTime(vol, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(a); a.connect(out); o.start(t); o.stop(t + dur + 0.02);
      } catch (e) {}
    }
    function noise(dur, vol, f0, f1, delay) {
      if (!AC || !noiseBuf) return;
      try {
        var t = AC.currentTime + (delay || 0), s = AC.createBufferSource(), lp = AC.createBiquadFilter(), a = AC.createGain();
        s.buffer = noiseBuf; s.loop = true; lp.type = 'lowpass'; lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        a.gain.setValueAtTime(vol, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(lp); lp.connect(a); a.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
      } catch (e) {}
    }
    var sfx = {
      shot: function () { if (gate('shot', 0.075)) tone(1400, 800, 0.03, 0.010, 'square'); },
      laser: function () { if (gate('laser', 0.1)) tone(196, 185, 0.11, 0.016, 'sawtooth'); },
      hit: function () { if (gate('hit', 0.06)) tone(880, 520, 0.03, 0.014, 'triangle'); },
      boom: function () { if (gate('boom', 0.05)) { noise(0.22, 0.2, 2600, 180); tone(190, 45, 0.18, 0.12, 'square'); } },
      bigBoom: function () { if (gate('bigBoom', 0.12)) { noise(0.8, 0.45, 2000, 70); tone(130, 28, 0.7, 0.3, 'sawtooth'); tone(61, 30, 0.9, 0.3, 'sine'); } },
      bomb: function () { noise(2.2, 0.6, 5000, 50); tone(70, 24, 2.2, 0.55, 'sine'); tone(420, 38, 1.3, 0.2, 'sawtooth'); tone(880, 55, 0.5, 0.12, 'square'); },
      pickup: function () { tone(523, 0, 0.07, 0.07, 'square'); tone(659, 0, 0.07, 0.07, 'square', 0.06); tone(784, 0, 0.07, 0.07, 'square', 0.12); tone(1047, 0, 0.14, 0.07, 'square', 0.18); },
      extend: function () { for (var i = 0; i < 6; i++) tone(440 * Math.pow(1.189, i), 0, 0.09, 0.08, 'square', i * 0.07); },
      medal: function () { if (gate('medal', 0.045)) tone(1760, 2100, 0.04, 0.018, 'triangle'); },
      cancel: function () { for (var i = 0; i < 5; i++) tone(1200 + i * 220, 0, 0.06, 0.035, 'triangle', i * 0.035); },
      chainBreak: function () { tone(330, 110, 0.2, 0.08, 'square'); },
      death: function () { noise(1.1, 0.5, 3200, 90); tone(520, 36, 0.95, 0.3, 'sawtooth'); },
      klaxon: function () { for (var i = 0; i < 6; i++) { tone(392, 392, 0.24, 0.13, 'sawtooth', i * 0.56); tone(294, 294, 0.24, 0.13, 'sawtooth', i * 0.56 + 0.28); } },
      count: function () { tone(660, 0, 0.09, 0.08, 'square'); },
      start: function () { tone(440, 0, 0.08, 0.08, 'square'); tone(880, 0, 0.16, 0.08, 'square', 0.08); },
      pause: function () { tone(600, 0, 0.06, 0.06, 'square'); tone(400, 0, 0.08, 0.06, 'square', 0.07); }
    };

    /* ------------------------------------------------------------ pools (fixed capacity, nothing allocated while playing) */
    var NB = 800, bx = new Float32Array(NB), by = new Float32Array(NB), bvx = new Float32Array(NB), bvy = new Float32Array(NB),
      bt = new Uint8Array(NB), bal = new Uint8Array(NB), brot = new Uint8Array(NB), bCur = 0, bLive = 0;
    var BHIT = [2.2, 2.2, 4.2, 4.2, 1.9, 1.9];                      // far smaller than they look: that is the genre
    var NM = 320, mx = new Float32Array(NM), my = new Float32Array(NM), mvx = new Float32Array(NM), mvy = new Float32Array(NM), mal = new Uint8Array(NM), mmag = new Uint8Array(NM), mCur = 0;
    var NP = 420, px = new Float32Array(NP), py = new Float32Array(NP), pvx = new Float32Array(NP), pvy = new Float32Array(NP), pl = new Float32Array(NP), pml = new Float32Array(NP), pc = new Uint8Array(NP), ps = new Uint8Array(NP), pCur = 0;
    var PCOL = ['#ffffff', '#fcd34d', '#fb923c', '#e3625b', '#8ad4ff', '#a78bfa', '#34d399', '#9aa3b8', '#ff4fa3'];
    var NS = 140, sx_ = new Float32Array(NS), sy_ = new Float32Array(NS), svx = new Float32Array(NS), svy = new Float32Array(NS), sdm = new Float32Array(NS), sk = new Uint8Array(NS), sal = new Uint8Array(NS), sCur = 0;
    var NE = 48, EN = [], NK = 8, PK = [], NT = 20, TX = [], NR = 14, RG = [], NSP = 14, SP = [], i0;
    for (i0 = 0; i0 < NE; i0++) EN.push({ on: false, type: '', def: null, x: 0, y: 0, x0: 0, vx: 0, vy: 0, hp: 0, mhp: 0, t: 0, ft: 0, ft2: 0, ft3: 0, a: 0, a2: 0, path: 0, ty: 0, stay: 0, flash: 0, drop: '', n: 0, phase: 0, boss: false, dying: 0, fired: 0, hw: 0, hh: 0, lt: 0 });
    for (i0 = 0; i0 < NK; i0++) PK.push({ on: false, kind: '', x: 0, y: 0, vx: 0, vy: 0, t: 0 });
    for (i0 = 0; i0 < NT; i0++) TX.push({ on: false, s: '', x: 0, y: 0, life: 0, col: '#fff' });
    for (i0 = 0; i0 < NR; i0++) RG.push({ on: false, x: 0, y: 0, r: 0, vr: 0, life: 0, ml: 1, col: '#fff' });
    for (i0 = 0; i0 < NSP; i0++) SP.push({ on: false, type: '', x: 0, path: '', n: 0, gap: 0, dx: 0, drop: '', timer: 0, k: 0 });

    function fireB(x, y, ang, spd, type) {
      if (bLive >= NB || x < -6 || x > W + 6 || y < -6 || y > H * 0.8) return;       // nothing fires from off screen or from under your feet
      for (var n = 0; n < NB; n++) {
        var i = bCur; bCur = (bCur + 1) % NB;
        if (!bal[i]) { bal[i] = 1; bx[i] = x; by[i] = y; bvx[i] = Math.cos(ang) * spd; bvy[i] = Math.sin(ang) * spd; bt[i] = type; brot[i] = ((Math.round(ang / TAU * 16) % 16) + 16) % 16; bLive++; return; }
      }
    }
    function medal(x, y, mag) {
      for (var n = 0; n < NM; n++) { var i = mCur; mCur = (mCur + 1) % NM; if (!mal[i]) { mal[i] = 1; mx[i] = x; my[i] = y; mvx[i] = rnd(-30, 30); mvy[i] = rnd(-90, -30); mmag[i] = mag ? 1 : 0; return; } }
    }
    function spark(x, y, vx, vy, life, col, size) {
      var i = pCur; pCur = (pCur + 1) % NP;                                           // particles just overwrite the oldest
      px[i] = x; py[i] = y; pvx[i] = vx; pvy[i] = vy; pl[i] = life; pml[i] = life; pc[i] = col; ps[i] = size;
    }
    function ring(x, y, r, vr, life, col) { for (var i = 0; i < NR; i++) if (!RG[i].on) { var o = RG[i]; o.on = true; o.x = x; o.y = y; o.r = r; o.vr = vr; o.life = o.ml = life; o.col = col; return; } }
    function boom(x, y, size) {                                                         // size 1 popcorn .. 4 boss chunk
      var n = 5 + size * 5, k, a, v;
      for (k = 0; k < n; k++) { a = Math.random() * TAU; v = rnd(20, 60 + size * 45); spark(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.25, 0.4 + size * 0.15), (Math.random() * 4) | 0, 1 + ((Math.random() * (1 + size)) | 0)); }
      ring(x, y, 3, 60 + size * 40, 0.25 + size * 0.06, size > 2 ? '#fff' : '#fcd34d');
      if (size > 2) { sfx.bigBoom(); G.shake = Math.max(G.shake, 0.35); } else sfx.boom();
    }
    function floatText(s, x, y, col) { for (var i = 0; i < NT; i++) if (!TX[i].on) { var o = TX[i]; o.on = true; o.s = s; o.x = clamp(x, 30, W - 30); o.y = y; o.life = 0.9; o.col = col || '#fff'; return; } }
    function cancelBullets(toMedals) {
      var n = 0;
      for (var i = 0; i < NB; i++) if (bal[i]) { bal[i] = 0; if (toMedals) { medal(bx[i], by[i], true); n++; } else spark(bx[i], by[i], 0, 0, 0.2, 4, 2); }
      bLive = 0; if (n > 3) sfx.cancel(); return n;
    }
    function clearPools() {
      var i; for (i = 0; i < NB; i++) bal[i] = 0; bLive = 0; for (i = 0; i < NM; i++) mal[i] = 0; for (i = 0; i < NP; i++) pl[i] = 0; for (i = 0; i < NS; i++) sal[i] = 0;
      for (i = 0; i < NE; i++) EN[i].on = false; for (i = 0; i < NK; i++) PK[i].on = false; for (i = 0; i < NT; i++) TX[i].on = false; for (i = 0; i < NR; i++) RG[i].on = false; for (i = 0; i < NSP; i++) SP[i].on = false;
    }

    /* patterns: angles are radians, 0 = right, PI/2 = straight down the screen */
    function aimAt(x, y) { return Math.atan2(P.y - y, P.x - x); }
    function fan(x, y, ang, n, spread, spd, type) { for (var k = 0; k < n; k++) fireB(x, y, ang + (n > 1 ? (k / (n - 1) - 0.5) * spread : 0), spd, type); }
    function circle(x, y, n, spd, off, type) { for (var k = 0; k < n; k++) fireB(x, y, off + k / n * TAU, spd, type); }
    function burst(x, y, ang, n, spd, step, type) { for (var k = 0; k < n; k++) fireB(x, y, ang, spd + k * step, type); }   // a line of bullets at staggered speeds
    function curtain(y, gapX, gapW, spd, type) { for (var x = 9; x < W; x += 18) if (Math.abs(x - gapX) > gapW / 2) fireB(x, y, Math.PI / 2, spd, type); }
