/* =============================================================================
   SHMUP.JS — "PUBLISH OR PERISH", the space stage of Palmer's Progress.
   After the boss falls the accepted manuscript is flown through the publication
   pipeline as a vertical bullet-hell shooter: DoDonPachi (tap = spread SHOT,
   hold = LASER + slow ship, HIT chain, bullet-cancel medals) crossed with
   Truxton (three colour weapons, P/S/B pickups, the skull bomb).
   2D canvas, everything procedural, fixed pools, no allocation in the hot loops.
   Test hooks: ?shmupstage=2|mid|boss|ending  ?shmupgod=1  (and the host's ?shmup=1 ?timescale=N)
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

    /* ------------------------------------------------------------ sprites (pixel art from strings and rectangles, rendered once) */
    var PAL = { k: '#11131c', w: '#f4f6fb', p: '#c9cedb', r: '#e3625b', R: '#9f2f2a', y: '#f2d16b', Y: '#c9a53f', s: '#f6d3b0', g: '#6f7787', G: '#4f5666', b: '#1f2430', c: '#8ad4ff', m: '#9aa3b8', M: '#5c6b85', d: '#2b303c', n: '#fcd34d', N: '#b88a1e' };
    function art(rows, mirror) {
      var h = rows.length, half = rows[0].length, w = mirror ? half * 2 - 1 : half, c = mk(w, h), x = c.getContext('2d');
      for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) { var ch = rows[j].charAt(mirror && i >= half ? w - 1 - i : i); if (PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); } }
      return c;
    }
    function R(x, col, a, b, w, h) { x.fillStyle = col; x.fillRect(a, b, w, h); }
    function whiten(src) { var c = mk(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return c; }
    function tint(src, col, alpha) { var c = mk(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = alpha; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; }
    var SPR = {}, WHT = {}, BS = [], SHIP = [], COVERS = [], GEAR = [], NEB = [], GIRDER = null, SKULL = [], ICON = {};

    function buildSprites() {
      var c, x, i, j, k;
      // the protagonist, prone on a rolled-up manuscript: blond hair, glasses at the leading edge, grey suit
      var ship = art([
        '........k', '.......kw', '.......kw', '......kww', '......kpw', '.....kpww', '....skrrr', '....gkpww', '....gkbcb',
        '....gkyyy', '....gkyyy', '....gkYyy', '...kgkYYY', '...kggggg', '...kggggg', '...kgGggg', '....kGggg', '....kGgGg',
        '..kmkGGGG', '.kmmkpddw', 'kmmMkpddw', 'kmMMkpddw', 'kkkkkpkkw', '....kpwww', '.....kkkk'], true);
      for (k = -1; k <= 1; k++) {
        c = mk(17, 25); x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        if (k === 0) x.drawImage(ship, 0, 0);
        else { x.drawImage(ship, 0, 0, 17, 25, 2, 0, 13, 25); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(8,10,30,.4)'; x.fillRect(k < 0 ? 0 : 9, 0, 8, 25); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(k < 0 ? 11 : 2, 0, 3, 25); }
        SHIP.push(c);
      }
      SPR.pen = art(['..kk', '.kRr', '.kRr', '.kRr', '.krr', '.krr', '.krr', '.krr', '.krr', '.krr', '.kmm', '.kmm', '.kpw', '.kpw', '..kw', '..kw', '...k', '...r'], true);
      SPR.staple = art(['kkkkkkk', 'kmmmmmm', 'kmMMMMM', 'kmk....', 'kmk....', 'kmk....', 'kkk....'], true);
      SPR.query = art(['..kkkkkkk..', '.knnnnnnnk.', 'knnkkkkknnk', 'knnk...knnk', 'kkkk...knnk', '......knnk.', '.....knnk..', '....knNk...', '....knNk...', '....kkkk...', '...........', '....kkkk...', '....knnk...', '....knNk...', '....kkkk...'], false);
      for (k = 0; k < 2; k++) {                                       // track-changes brackets: green insertion, red deletion
        c = mk(9, 20); x = c.getContext('2d'); if (k) { x.translate(9, 0); x.scale(-1, 1); }
        R(x, PAL.k, 0, 0, 5, 20); R(x, PAL.k, 0, 0, 9, 5); R(x, PAL.k, 0, 15, 9, 5);
        R(x, k ? '#ff6b7a' : '#34d399', 1, 1, 3, 18); R(x, k ? '#ff6b7a' : '#34d399', 1, 1, 7, 3); R(x, k ? '#ff6b7a' : '#34d399', 1, 16, 7, 3); R(x, k ? '#a82a3a' : '#1f8a60', 3, 4, 1, 12);
        SPR[k ? 'bracketR' : 'bracket'] = c;
      }
      c = mk(28, 23); x = c.getContext('2d');                           // comment bubble
      R(x, PAL.k, 1, 0, 26, 18); R(x, PAL.k, 0, 1, 28, 16); R(x, PAL.k, 6, 17, 6, 3); R(x, PAL.k, 7, 20, 4, 2); R(x, PAL.k, 8, 22, 2, 1);
      R(x, PAL.n, 2, 1, 24, 16); R(x, PAL.n, 1, 2, 26, 14); R(x, PAL.n, 7, 17, 4, 3); R(x, PAL.n, 8, 20, 2, 2); R(x, PAL.N, 2, 15, 24, 2);
      R(x, PAL.b, 4, 4, 20, 2); R(x, PAL.b, 4, 8, 15, 2); R(x, PAL.R, 4, 12, 18, 2);
      SPR.bubble = c;
      c = mk(20, 16); x = c.getContext('2d');                           // supplementary material: the box that carries pickups
      R(x, PAL.k, 0, 2, 20, 14); R(x, '#c99a6b', 1, 3, 18, 12); R(x, '#a87a4b', 1, 11, 18, 4); R(x, PAL.k, 0, 0, 20, 5); R(x, '#8a5a2b', 1, 1, 18, 3);
      R(x, PAL.w, 5, 7, 10, 5); R(x, PAL.m, 6, 8, 8, 1); R(x, PAL.m, 6, 10, 6, 1); R(x, PAL.c, 9, 1, 2, 2);
      SPR.box = c;
      c = mk(13, 13); x = c.getContext('2d');                           // article processing charge
      for (j = 0; j < 13; j++) for (i = 0; i < 13; i++) { var d = Math.hypot(i - 6, j - 6); if (d <= 6.3) R(x, d > 5.2 ? PAL.k : (i + j > 14 ? PAL.N : PAL.n), i, j, 1, 1); }
      ['..##.', '.#..#', '.#...', '###..', '.#...', '.#...', '#####'].forEach(function (row, jj) { for (var ii = 0; ii < 5; ii++) if (row.charAt(ii) === '#') R(x, '#6b4a08', 4 + ii, 3 + jj, 1, 1); });
      SPR.fee = c;
      c = mk(40, 20); x = c.getContext('2d'); R(x, PAL.k, 0, 0, 40, 20);  // paywall
      for (j = 0; j < 4; j++) for (i = -1; i < 5; i++) { var bxp = 1 + i * 10 + (j % 2) * 5; R(x, (i + j) % 2 ? '#b8503f' : '#a2443a', Math.max(1, bxp), 1 + j * 5, Math.min(9, 39 - Math.max(1, bxp)), 4); R(x, '#d0705f', Math.max(1, bxp), 1 + j * 5, Math.min(9, 39 - Math.max(1, bxp)), 1); }
      R(x, PAL.k, 16, 2, 8, 7); R(x, PAL.m, 17, 3, 6, 6); R(x, '#7a2e24', 19, 5, 2, 4); R(x, PAL.k, 14, 8, 12, 10); R(x, PAL.n, 15, 9, 10, 8); R(x, PAL.N, 15, 15, 10, 2); R(x, PAL.k, 19, 11, 2, 4);
      SPR.paywall = c;
      c = mk(34, 17); x = c.getContext('2d');                           // embargo satellite
      for (k = 0; k < 2; k++) { var ox = k ? 23 : 0; R(x, PAL.k, ox, 4, 11, 9); R(x, '#2f5fb0', ox + 1, 5, 9, 7); for (i = 0; i < 3; i++) R(x, '#60a5fa', ox + 1 + i * 3, 5, 1, 7); R(x, '#60a5fa', ox + 1, 8, 9, 1); }
      R(x, PAL.k, 11, 7, 12, 3); R(x, PAL.k, 12, 1, 10, 13); R(x, PAL.p, 13, 2, 8, 11); R(x, PAL.m, 13, 10, 8, 3); R(x, PAL.b, 14, 4, 6, 3); R(x, PAL.r, 16, 5, 2, 1); R(x, PAL.k, 15, 14, 4, 3); R(x, PAL.m, 16, 14, 2, 2);
      SPR.sat = c;
      c = mk(24, 30); x = c.getContext('2d');                           // galley proof
      R(x, PAL.k, 0, 0, 24, 30); R(x, PAL.w, 1, 1, 22, 28); R(x, PAL.p, 18, 1, 5, 5); R(x, PAL.k, 18, 1, 1, 6); R(x, PAL.k, 18, 6, 6, 1);
      for (i = 0; i < 8; i++) R(x, PAL.m, 3, 4 + i * 3, i % 3 === 2 ? 11 : 16, 1);
      R(x, PAL.r, 2, 9, 14, 1); R(x, PAL.r, 14, 14, 7, 1); R(x, PAL.r, 14, 18, 7, 1); R(x, PAL.r, 14, 14, 1, 5); R(x, PAL.r, 20, 14, 1, 5); R(x, PAL.r, 5, 23, 3, 3); R(x, PAL.r, 9, 24, 9, 1);
      SPR.proof = c;
      // THE TYPESETTER: a flying press
      c = mk(156, 88); x = c.getContext('2d');
      R(x, PAL.k, 8, 20, 140, 62); R(x, '#3b4252', 9, 21, 138, 60); R(x, PAL.M, 9, 21, 138, 4); R(x, PAL.d, 9, 72, 138, 9);
      R(x, PAL.k, 10, 5, 136, 17); R(x, PAL.M, 11, 6, 134, 15); R(x, PAL.k, 22, 3, 112, 20); R(x, PAL.m, 23, 4, 110, 18); R(x, '#d6dae6', 23, 7, 110, 3); R(x, PAL.M, 23, 18, 110, 4);
      R(x, PAL.k, 47, 0, 62, 15); R(x, PAL.w, 48, 0, 60, 14); for (i = 0; i < 4; i++) R(x, PAL.m, 52, 2 + i * 3, i === 3 ? 30 : 52, 1);
      R(x, PAL.k, 46, 26, 64, 24); R(x, '#0b0c14', 47, 27, 62, 22); for (i = 0; i < 12; i++) R(x, i % 2 ? PAL.m : PAL.p, 50 + i * 5, 29 + Math.round(Math.abs(i - 5.5) * 1.6), 2, 15);
      for (j = 0; j < 3; j++) for (i = 0; i < 12 - j; i++) { var kx = 14 + j * 5 + i * 11, ky = 52 + j * 7; if (kx > 42 && kx < 104 && j === 0) continue; R(x, PAL.k, kx, ky, 9, 6); R(x, '#f1e7c9', kx + 1, ky, 7, 4); R(x, '#b9ad8a', kx + 1, ky + 4, 7, 1); }
      for (k = 0; k < 2; k++) { ox = k ? 144 : 0; R(x, PAL.k, ox, 36, 12, 40); R(x, PAL.M, ox + 1, 37, 10, 38); R(x, PAL.m, ox + 1, 37, 3, 38); R(x, PAL.k, ox + 2, 70, 8, 6); R(x, PAL.r, ox + 3, 40, 6, 2); }
      for (i = 0; i < 8; i++) { R(x, PAL.m, 14 + i * 18, 76, 2, 2); }
      SPR.typesetter = c;
      for (k in SPR) if (SPR.hasOwnProperty(k)) WHT[k] = whiten(SPR[k]);
      // THE IMPACT FACTOR: a gear (steel, then furious red) and its orbiting journal covers
      for (k = 0; k < 2; k++) {
        c = mk(113, 113); x = c.getContext('2d');
        for (j = 0; j < 113; j++) for (i = 0; i < 113; i++) {
          var dx = i - 56, dy = j - 56, rr = Math.hypot(dx, dy), th = Math.atan2(dy, dx), lim = 45 + (Math.cos(th * 12) > 0.25 ? 9 : 0);
          if (rr > lim + 1 || rr < 25) continue;
          var col = rr > lim - 1 || rr < 27 ? PAL.k : rr > 40 ? (k ? '#c2413a' : PAL.M) : rr > 38 ? PAL.k : (Math.cos(th * 6) > 0.8 && rr > 30 && rr < 36) ? (k ? PAL.n : PAL.c) : (k ? '#7a1f24' : '#3b4252');
          if (col !== PAL.k && dx + dy < -30 && rr > 40) col = k ? '#e3625b' : PAL.m;
          R(x, col, i, j, 1, 1);
        }
        GEAR.push(c);
      }
      GEAR.push(whiten(GEAR[0]));
      ['#e3625b', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#2dd4bf'].forEach(function (col) {
        var cc = mk(18, 24), xx = cc.getContext('2d'); R(xx, PAL.k, 0, 0, 18, 24); R(xx, col, 1, 1, 16, 22); R(xx, PAL.w, 2, 2, 14, 4); R(xx, PAL.k, 3, 3, 9, 2);
        R(xx, 'rgba(255,255,255,.45)', 3, 8, 12, 9); R(xx, 'rgba(0,0,0,.35)', 5, 10, 8, 5); R(xx, PAL.w, 3, 19, 12, 1); R(xx, PAL.w, 3, 21, 8, 1); COVERS.push(cc);
      });
      // enemy bullets: dark outline, colour, white core. two brightness frames; needles in 16 rotations
      var BC = [['#ff4fa3', '#ff9ccc'], ['#4aa8ff', '#a5d6ff']];
      for (k = 0; k < 6; k++) {
        var set = [], colr = BC[k % 2], big = k === 2 || k === 3, needle = k > 3, rad = big ? 7 : 4, f, sz = needle ? 15 : rad * 2 + 1;
        for (f = 0; f < (needle ? 16 : 2); f++) {
          c = mk(sz, sz); x = c.getContext('2d'); var ca = Math.cos(f / 16 * TAU), sa = Math.sin(f / 16 * TAU);
          for (j = 0; j < sz; j++) for (i = 0; i < sz; i++) {
            var dd;
            if (needle) { var ux = (i - 7) * ca + (j - 7) * sa, vx = -(i - 7) * sa + (j - 7) * ca, cu = clamp(ux, -4, 4); dd = Math.hypot(ux - cu, vx) / 2.9; }
            else dd = Math.hypot(i - rad, j - rad) / (rad + 0.3);
            if (dd <= 1) R(x, dd < (needle ? 0.36 : 0.45) ? '#fff' : dd < (needle ? 0.7 : 0.78) ? colr[needle ? 0 : f] : '#1a0a22', i, j, 1, 1);
          }
          set.push(c);
        }
        BS.push(set);
      }
      // the Truxton skull, bone and ember
      var skull = art(['....kkkk', '..kkwwww', '.kwwwwww', '.kwwwwww', 'kwwwwwww', 'kwwkkkww', 'kwkkrkkw', 'kwkkkkkw', 'kwwkkkww', 'kpwwwwwk', '.kpwwwkk', '.kppwwww', '..kwkwkw', '..kwkwkw', '..kpwpwp', '...kkkkk'], true);
      SKULL = [skull, tint(skull, '#fb923c', 0.55), tint(skull, '#e3625b', 0.6)];
      ICON.life = art(['.kkkk', 'kyyyy', 'kyyyy', 'kbcbc', 'kssss', '.kggg', '.kkkk'], true);
      ICON.bomb = art(['.kkkk', 'kwwww', 'kwkkw', 'kwkkw', 'kwwwk', '.kwkw', '.kkkk'], true);
      ICON.cite = art(['.kkk', 'knnn', 'knNn', 'knnn', '.kkk'], true);
      // background: chunky nebulae (rendered at quarter size), a girder tile
      for (k = 0; k < 2; k++) {
        c = mk(90, 128); x = c.getContext('2d');
        var cols = k ? ['rgba(190,60,140,', 'rgba(250,120,80,', 'rgba(110,60,200,'] : ['rgba(70,60,190,', 'rgba(40,140,170,', 'rgba(150,70,190,'];
        for (i = 0; i < 9; i++) {
          var nx = rnd(0, 90), ny = rnd(0, 128), nr = rnd(14, 34), cl = cols[i % 3];
          for (j = -1; j <= 1; j++) { var gr = x.createRadialGradient(nx, ny + j * 128, 1, nx, ny + j * 128, nr); gr.addColorStop(0, cl + '.30)'); gr.addColorStop(0.6, cl + '.12)'); gr.addColorStop(1, cl + '0)'); x.fillStyle = gr; x.fillRect(0, 0, 90, 128); }
        }
        NEB.push(c);
      }
      c = mk(40, 64); x = c.getContext('2d'); R(x, '#141a2c', 0, 0, 6, 64); R(x, '#141a2c', 34, 0, 6, 64); R(x, '#232c48', 0, 0, 2, 64); R(x, '#232c48', 34, 0, 2, 64);
      for (i = 0; i < 28; i++) { R(x, '#1a2138', 6 + i, i * 2 + 2, 3, 3); R(x, '#1a2138', 31 - i, 32 + i + (i > 27 ? 0 : 0), 3, 2); }
      R(x, '#232c48', 0, 0, 40, 3); R(x, '#232c48', 0, 32, 40, 3); R(x, '#2f3a5c', 2, 1, 2, 1); R(x, '#2f3a5c', 36, 1, 2, 1); R(x, '#2f3a5c', 2, 33, 2, 1); R(x, '#2f3a5c', 36, 33, 2, 1);
      GIRDER = c;
    }

    /* ------------------------------------------------------------ state */
    var G = null;
    var P = { x: 180, y: 400, inv: 0, dead: 0, bank: 0, holdT: 0, shotT: 0, cd: 0, laser: false, top: -10, bombT: 0, bombX: 0, bombY: 0, contact: 0, flame: 0, nLock: 0 };
    var keys = { l: false, r: false, u: false, d: false, fire: false, focus: false }, touch = { on: false, id: -1, lx: 0, ly: 0, count: 0, t0: 0 };
    var lockI = new Int8Array(5), lockD = new Float32Array(5);
    var WEAP = [{ name: 'RED POWER SHOT', col: '#ff5a4a' }, { name: 'BLUE THUNDER', col: '#5ab8ff' }, { name: 'GREEN SNIPER', col: '#4ade80' }];
    function newGame() {
      var hi = 158000; try { hi = Math.max(hi, parseInt(localStorage.getItem('quest.shmup.hi'), 10) || 0); } catch (e) {}
      G = { mode: 'play', t: 0, stage: 1, st: 0, si: 0, script: STAGE1, hold: false, score: 0, hi: hi, lives: 3, bombs: 3, chain: 0, maxChain: 0, gauge: 0, cites: 0, continues: 0, kills: 0,
        weapon: 0, level: 1, speed: 0, extend: 0, paused: false, flash: 1, shake: 0, cardT: 0, cardDur: 1, cardTitle: '', cardSub: '', warnT: 0, boss: null, contT: 0,
        who: '', say: '', sayT: 0, sayN: 0, endT: 0, scroll: 0, girderY: -200, girderSide: 0, girderOn: false, tauntT: 0, tauntI: 0 };
      clearPools(); P.x = W / 2; P.y = H + 30; P.inv = 3; P.dead = 0; P.bombT = 0; P.holdT = 0; P.shotT = 0; P.laser = false;
    }
    function addScore(n) {
      G.score += n; if (G.score > G.hi) G.hi = G.score;
      if (G.extend < 2 && G.score >= (G.extend ? 1500000 : 400000)) { G.extend++; G.lives++; sfx.extend(); floatText('EXTEND!', P.x, P.y - 30, '#34d399'); }
    }
    function mult() { return 1 + Math.min(G.chain, 600) / 20; }
    function chainUp(n) { G.chain += n; G.gauge = 1; if (G.chain > G.maxChain) G.maxChain = G.chain; }
    function chainBreak() { if (G.chain >= 10) { sfx.chainBreak(); floatText('CHAIN LOST', P.x, P.y - 24, '#ff6b7a'); } G.chain = 0; G.gauge = 0; }
    function say(who, text) { G.who = who; G.say = text; G.sayLines = wrap(text, 34); G.sayT = 5.5; G.sayN = 0; }
    function card(title, sub, dur) { G.cardTitle = title; G.cardSub = sub || ''; G.cardT = G.cardDur = dur || 3; }

    /* ------------------------------------------------------------ player */
    function playerShot(x, y, vx, vy, dmg, kind) {
      for (var n = 0; n < NS; n++) { var i = sCur; sCur = (sCur + 1) % NS; if (!sal[i]) { sal[i] = 1; sx_[i] = x; sy_[i] = y; svx[i] = vx; svy[i] = vy; sdm[i] = dmg; sk[i] = kind; return; } }
    }
    function fireShot() {
      var L = G.level, k, n, a;
      if (G.weapon === 0) { n = 1 + L * 2; for (k = 0; k < n; k++) { a = -Math.PI / 2 + (k / (n - 1) - 0.5) * (0.2 + L * 0.2); playerShot(P.x, P.y - 12, Math.cos(a) * 540, Math.sin(a) * 540, 1, 0); } P.cd = 0.085; }
      else if (G.weapon === 1) { n = 1 + L; for (k = 0; k < n; k++) { a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 0.5; playerShot(P.x + (k - (n - 1) / 2) * 5, P.y - 10, Math.cos(a) * 480, Math.sin(a) * 480, 1.2, 1); } P.cd = 0.1; }
      else { n = L < 3 ? 2 : L; for (k = 0; k < n; k++) playerShot(P.x + (k - (n - 1) / 2) * 7, P.y - 12, 0, -720, 0, 2); P.cd = 0.065; }
      sfx.shot();
    }
    function fireLaser(dt) {
      var L = G.level - 1, i, e, hitAny = false, hw, dps;
      P.top = -10; P.nLock = 0;
      if (G.weapon === 0) {                                             // DoDonPachi beam: stops at the first thing it meets
        hw = [5, 6, 7, 9][L]; dps = [64, 84, 106, 130][L]; var best = null, bb = -1e9;
        for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && e.y < P.y && Math.abs(e.x - P.x) < e.hw + hw && e.y + e.hh > bb && e.y > -e.hh) { bb = e.y + e.hh; best = e; } }
        if (best) { P.top = Math.min(P.y - 14, bb - 2); hurt(best, dps * dt, true); hitAny = best.mhp >= 36; if (Math.random() < dt * 40) spark(P.x + rnd(-hw, hw), P.top, rnd(-80, 80), rnd(20, 120), 0.25, 2, 2); }
      } else if (G.weapon === 2) {                                      // sniper beam: goes through everything
        hw = [3, 3, 4, 5][L]; dps = [48, 62, 78, 96][L];
        for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && e.y - e.hh < P.y && Math.abs(e.x - P.x) < e.hw + hw && e.y > -e.hh) { hurt(e, dps * dt, true); if (e.mhp >= 36) hitAny = true; if (Math.random() < dt * 25) spark(P.x, e.y + e.hh, rnd(-90, 90), rnd(-20, 60), 0.2, 6, 2); } }
      } else {                                                          // thunder: arcs to the nearest few, no aiming required
        var want = 2 + L, n = 0, k, d, j;
        for (i = 0; i < NE; i++) {
          e = EN[i]; if (!e.on || e.y < -e.hh + 4 || e.y > H) continue;
          d = Math.hypot(e.x - P.x, e.y - P.y); if (d > 330) continue;
          if (n >= want && lockD[want - 1] <= d) continue;
          k = n < want ? n : want - 1;                                   // insertion into a tiny sorted list, no allocation
          while (k > 0 && lockD[k - 1] > d) { lockD[k] = lockD[k - 1]; lockI[k] = lockI[k - 1]; k--; }
          lockD[k] = d; lockI[k] = i; if (n < want) n++;
        }
        P.nLock = n; dps = [60, 78, 96, 116][L] / Math.sqrt(n || 1);
        for (j = 0; j < n; j++) { e = EN[lockI[j]]; hurt(e, dps * dt, true); if (e.on && e.mhp >= 36) hitAny = true; if (Math.random() < dt * 20) spark(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), rnd(-60, 60), rnd(-60, 60), 0.2, 4, 2); }
      }
      for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && Math.abs(e.x - P.x) < e.hw + 16 && Math.abs(e.y - P.y) < e.hh + 18) hurt(e, 45 * dt, true); }   // the aura bites too
      if (hitAny) { if (G.chain > 0) G.gauge = Math.max(G.gauge, 0.5); P.contact += dt; if (P.contact > 0.22) { P.contact = 0; chainUp(1); addScore(10 * Math.round(mult())); } }
      sfx.laser();
    }
    function useBomb() {
      if (!G || G.mode !== 'play' || G.paused || G.bombs <= 0 || P.bombT > 0 || P.dead > 0) return;
      G.bombs--; P.bombT = 1.9; P.bombX = P.x; P.bombY = P.y - 10; P.inv = Math.max(P.inv, 3); G.shake = 1; G.flash = Math.max(G.flash, 0.7);
      sfx.bomb(); cancelBullets(true);
    }
    function killPlayer() {
      if (P.inv > 0 || P.dead > 0 || P.bombT > 0 || GOD || G.mode !== 'play') return;
      boom(P.x, P.y, 3); ring(P.x, P.y, 4, 260, 0.5, '#8ad4ff'); sfx.death(); cancelBullets(false); chainBreak();
      G.lives--; G.shake = 0.8; P.dead = 1.3; P.laser = false;
      if (G.level > 1) { G.level--; pickup('P', P.x, P.y - 10); }
      if (G.lives < 0) { G.lives = 0; G.mode = 'continue'; G.contT = 9.99; P.dead = 1e9; }
    }
    function respawn() { P.x = W / 2; P.y = H + 24; P.inv = 3; P.dead = 0; P.holdT = 0; G.bombs = Math.max(G.bombs, 3); }
    function updatePlayer(dt) {
      if (P.inv > 0) P.inv -= dt;
      if (P.bombT > 0) updateBomb(dt);
      if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); return; }
      var firing = keys.fire || touch.on;
      if (firing) P.holdT += dt; else P.holdT = 0;
      if (P.shotT > 0) P.shotT -= dt;
      P.laser = touch.on || (keys.fire && P.holdT > 0.2);
      var ix = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), iy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), sp = (152 + G.speed * 24) * ((P.laser || keys.focus) ? 0.5 : 1);
      if (ix && iy) sp *= 0.7071;
      if (P.y > H - 56 && P.inv > 2) { P.y -= 110 * dt; ix = 0; iy = 0; }                   // fly in from below after a respawn
      P.x = clamp(P.x + ix * sp * dt, 9, W - 9); P.y = clamp(P.y + iy * sp * dt, 18, Math.max(H - 12, P.y));
      P.bank += (ix - P.bank) * Math.min(1, dt * 12); P.flame += dt;
      P.cd -= dt;
      if (P.laser) fireLaser(dt); else { P.top = -10; P.nLock = 0; P.contact = 0; if ((keys.fire || P.shotT > 0) && P.cd <= 0) fireShot(); }
    }
    function updateBomb(dt) {
      var k, a, i, e, grow = Math.min(1, (1.9 - P.bombT) / 0.5), rad = 40 + grow * 130;
      P.bombT -= dt;
      if (bLive > 0) { for (i = 0; i < NB; i++) if (bal[i]) { bal[i] = 0; medal(bx[i], by[i], true); } bLive = 0; }
      for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && e.y > -e.hh) hurt(e, (e.boss ? 170 : 260) * dt, false); }
      for (k = 0; k < 3; k++) { a = Math.random() * TAU; spark(P.bombX + Math.cos(a) * rad * 0.8, P.bombY - 60 * grow + Math.sin(a) * rad * 0.8, Math.cos(a) * 90, Math.sin(a) * 90, 0.45, 1 + ((Math.random() * 3) | 0), 3); }
      if (P.bombT <= 0) G.flash = Math.max(G.flash, 0.35);
    }
    function updateShots(dt) {
      var i, j, e, lockX = -1, best = 1e9, d;
      if (G.weapon === 1) for (j = 0; j < NE; j++) { e = EN[j]; if (e.on && e.y > 0 && e.y < P.y) { d = Math.abs(e.x - P.x) + (P.y - e.y) * 0.5; if (d < best) { best = d; lockX = e.x; } } }
      for (i = 0; i < NS; i++) {
        if (!sal[i]) continue;
        if (sk[i] === 1 && lockX >= 0) svx[i] = clamp(svx[i] + (lockX > sx_[i] ? 1 : -1) * 1500 * dt, -260, 260);   // blue bolts lean towards a target
        sx_[i] += svx[i] * dt; sy_[i] += svy[i] * dt;
        if (sy_[i] < -14 || sx_[i] < -8 || sx_[i] > W + 8) { sal[i] = 0; continue; }
        for (j = 0; j < NE; j++) {
          e = EN[j]; if (!e.on || Math.abs(sx_[i] - e.x) > e.hw + 2 || Math.abs(sy_[i] - e.y) > e.hh + 6 || e.y < -e.hh) continue;
          if (sk[i] === 2) { hurt(e, 17 * dt, false); if (Math.random() < 0.1) spark(sx_[i], sy_[i], rnd(-40, 40), rnd(10, 60), 0.15, 6, 1); }   // green pierces: damage while passing through
          else { hurt(e, sdm[i], false); sal[i] = 0; spark(sx_[i], sy_[i], rnd(-50, 50), rnd(10, 80), 0.15, sk[i] ? 4 : 2, 1); break; }
        }
      }
    }
    function pickup(kind, x, y) { for (var i = 0; i < NK; i++) if (!PK[i].on) { var o = PK[i]; o.on = true; o.kind = kind; o.x = x; o.y = y; o.vx = Math.random() < 0.5 ? -26 : 26; o.vy = 24; o.t = 0; return; } }
    function collect(o) {
      var s = '', c = '#fff';
      if (o.kind === 'W') { var w = Math.floor(o.t / 1.1) % 3; c = WEAP[w].col; if (w === G.weapon) { if (G.level < 4) { G.level++; s = 'POWER UP'; } else { addScore(5000); s = '5000'; } } else { G.weapon = w; s = WEAP[w].name; } }
      else if (o.kind === 'P') { c = '#fb923c'; if (G.level < 4) { G.level++; s = 'POWER UP'; } else { addScore(5000); s = '5000'; } }
      else if (o.kind === 'S') { c = '#8ad4ff'; if (G.speed < 3) { G.speed++; s = 'SPEED UP'; } else { addScore(3000); s = '3000'; } }
      else if (o.kind === 'B') { if (G.bombs < 6) { G.bombs++; s = 'BOMB +1'; } else { addScore(5000); s = '5000'; } }
      else { G.lives++; s = '1UP'; c = '#34d399'; sfx.extend(); }
      o.on = false; sfx.pickup(); floatText(s, o.x, o.y - 10, c); ring(o.x, o.y, 4, 120, 0.3, c);
    }
    function updateItems(dt) {
      var i, o, d, dx, dy, alive = P.dead <= 0 && G.mode === 'play';
      for (i = 0; i < NK; i++) {
        o = PK[i]; if (!o.on) continue;
        o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.x < 12) { o.x = 12; o.vx = -o.vx; } if (o.x > W - 12) { o.x = W - 12; o.vx = -o.vx; }
        if (o.t < 9 && o.y > H * 0.82) o.vy = -Math.abs(o.vy); if (o.y < 40 && o.vy < 0) o.vy = Math.abs(o.vy);
        if (o.y > H + 12) { o.on = false; continue; }
        if (alive && Math.abs(o.x - P.x) < 15 && Math.abs(o.y - P.y) < 18) collect(o);
      }
      for (i = 0; i < NM; i++) {
        if (!mal[i]) continue;
        dx = P.x - mx[i]; dy = P.y - my[i]; d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (alive && (mmag[i] || d < 52)) { mmag[i] = 1; var v = 300 + (1 - Math.min(1, d / 300)) * 260; mvx[i] = dx / d * v; mvy[i] = dy / d * v; }
        else { mvy[i] = Math.min(70, mvy[i] + 150 * dt); mvx[i] *= 0.98; }
        mx[i] += mvx[i] * dt; my[i] += mvy[i] * dt;
        if (my[i] > H + 8) { mal[i] = 0; continue; }
        if (alive && d < 13) { mal[i] = 0; G.cites++; addScore(Math.min(2000, 100 * (1 + Math.floor(G.chain / 25)))); sfx.medal(); }
      }
    }

    /* ------------------------------------------------------------ enemies */
    var ET = {
      pen: { name: 'RED PEN', hp: 3, hw: 4, hh: 9, score: 100, cit: 1 },
      staple: { name: 'STAPLE', hp: 2, hw: 7, hh: 4, score: 80, cit: 1 },
      query: { name: 'AUTHOR QUERY', hp: 10, hw: 6, hh: 8, score: 300, cit: 2 },
      bracket: { name: 'TRACKED CHANGE', hp: 16, hw: 5, hh: 10, score: 400, cit: 3 },
      bubble: { name: 'COMMENT BUBBLE', hp: 60, hw: 14, hh: 11, score: 1500, cit: 6 },
      box: { name: 'SUPPLEMENTARY MATERIAL', hp: 12, hw: 10, hh: 8, score: 500, cit: 2 },
      fee: { name: 'PROCESSING CHARGE', hp: 2, hw: 6, hh: 6, score: 120, cit: 2 },
      paywall: { name: 'PAYWALL', hp: 45, hw: 20, hh: 10, score: 1200, cit: 5 },
      sat: { name: 'EMBARGO SATELLITE', hp: 38, hw: 17, hh: 8, score: 1500, cit: 6 },
      proof: { name: 'GALLEY PROOF', hp: 70, hw: 12, hh: 15, score: 2000, cit: 8 },
      typesetter: { name: 'THE TYPESETTER', hp: 1500, hw: 70, hh: 34, score: 30000, cit: 30, boss: true, phases: [1500, 1700],
        taunts: ['YOUR FIGURES ARE 72 DPI.', 'PLEASE SEE THE AUTHOR QUERIES. ALL 214 OF THEM.', 'WIDOWS. ORPHANS. RIVERS. EVERYWHERE.', 'WE HAVE REDRAWN YOUR FIGURE 2. YOU ARE WELCOME.'],
        breaks: ['FULLY JUSTIFIED. MIND THE GAPS.'], last: 'ERROR: FONT NOT EMBEDDED...' },
      impact: { name: 'THE IMPACT FACTOR', hp: 1700, hw: 40, hh: 40, score: 100000, cit: 60, boss: true, phases: [1700, 1800, 2400],
        taunts: ['OF INTEREST ONLY TO SPECIALISTS.', 'WE RECEIVE MANY MORE SUBMISSIONS THAN WE CAN PUBLISH.', 'HAVE YOU CONSIDERED OUR SISTER JOURNAL?', 'I AM A RATIO. YOU CANNOT KILL A RATIO.', 'TWO YEARS. THAT IS ALL YOU GET.'],
        breaks: ['SELF-CITATION ENGAGED.', 'ENOUGH. BEHOLD MY TRUE DENOMINATOR.'], last: 'BUT... MY... QUARTILE...' }
    };
    function spawnEnemy(type, x, path, drop, ty) {
      for (var i = 0; i < NE; i++) {
        var e = EN[i]; if (e.on) continue;
        var d = ET[type]; e.on = true; e.type = type; e.def = d; e.boss = !!d.boss; e.hp = e.mhp = d.hp; e.hw = d.hw; e.hh = d.hh;
        e.path = path || 'down'; e.x = e.x0 = x; e.y = -d.hh - 4; e.ty = ty || 90; e.vx = 0; e.vy = 0; e.t = 0; e.flash = 0; e.drop = drop || ''; e.phase = 0; e.dying = 0; e.lt = 0; e.fired = 0;
        e.ft = rnd(0.5, 1.1); e.ft2 = rnd(1.2, 2); e.ft3 = 2; e.a = Math.random() * TAU; e.a2 = W / 2; e.n = i; e.stay = type === 'sat' ? 9 : 6.5;
        if (path === 'arcR') { e.x = -14; e.y = e.ty; } else if (path === 'arcL') { e.x = W + 14; e.y = e.ty; }
        if (e.boss) { e.y = -d.hh - 10; e.ty = type === 'impact' ? 118 : 84; e.a = 0; e.ft = 1; }
        return e;
      }
      return null;
    }
    function hurt(e, d, fromLaser) {
      if (!e.on || e.dying > 0) return;
      if (e.boss && (e.y < e.ty - 1 || e.lt > 0)) return;                       // no damage while it makes its entrance or catches its breath
      e.hp -= d; e.flash = 0.05; if (!fromLaser) sfx.hit();
      if (e.hp > 0) return;
      if (e.boss && e.phase < e.def.phases.length - 1) {
        e.phase++; e.hp = e.mhp = e.def.phases[e.phase]; e.lt = 1.8; e.ft = 0.6; e.ft2 = 1.5; e.ft3 = 2.5; e.a = 0;
        var n = cancelBullets(true); addScore(Math.round(10000 * mult() / 10) * 10 + n * 100); chainUp(10);
        boom(e.x, e.y, 4); boom(e.x - 30, e.y + 10, 3); boom(e.x + 30, e.y - 6, 3); G.shake = 0.7; G.flash = Math.max(G.flash, 0.5);
        floatText('PHASE BREAK', e.x, e.y + e.hh + 14, '#fcd34d'); say(e.def.name, e.def.breaks[e.phase - 1] || '...');
        if (e.type === 'impact' && e.phase === 2) for (var k = 0; k < 6; k++) boom(e.x + Math.cos(k / 6 * TAU) * 80, e.y + Math.sin(k / 6 * TAU) * 80, 3);
        return;
      }
      if (e.boss) { e.dying = e.type === 'impact' ? 4.2 : 2.6; e.hp = 0; cancelBullets(true); say(e.def.name, e.def.last); api.music('silence'); return; }
      kill(e);
    }
    function kill(e) {
      var d = e.def, k, s = Math.round(d.score * mult() / 10) * 10;
      e.on = false; G.kills++; chainUp(1); addScore(s);
      boom(e.x, e.y, d.hp > 30 ? 3 : d.hp > 8 ? 2 : 1);
      for (k = 0; k < d.cit; k++) medal(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), false);
      if (d.hp >= 10) floatText(String(s), e.x, e.y, '#fcd34d');
      if (e.drop) pickup(e.drop, e.x, e.y);
    }
    function enemyFire(e, dt) {
      e.ft -= dt; e.ft2 -= dt;
      if (e.y < 10 || e.y > H * 0.62 || P.dead > 0) return;
      var t = e.type, hard = G.stage > 1 ? 1 : 0, close = Math.abs(e.x - P.x) + Math.abs(e.y - P.y) < 70, a = aimAt(e.x, e.y);
      if (t === 'bubble') {
        if (e.ft <= 0) { fireB(e.x, e.y, e.a, 70, 1); fireB(e.x, e.y, e.a + Math.PI, 70, 1); e.a += 0.42; e.ft = 0.14; }
        if (e.ft2 <= 0 && !close) { fan(e.x, e.y + 8, a, 5, 0.7, 118, 4); e.ft2 = 2.5; }
        return;
      }
      if (t === 'sat') { if (e.ft <= 0) { for (var k = 0; k < 4; k++) fireB(e.x, e.y + 4, e.a + k * TAU / 4, 72, k % 2); e.a += 0.23; e.ft = 0.18; } return; }
      if (e.ft > 0 || t === 'box') return;
      if (t === 'paywall') { for (var j = -2; j <= 2; j++) fireB(e.x + j * 9, e.y + 10, Math.PI / 2, 68, 0); e.ft = 1.25; return; }
      if (t === 'bracket') { circle(e.x, e.y, 10, 60, e.a, 1); e.a += 0.31; e.ft = 2; return; }
      if (close) return;                                                          // nobody shoots you at point-blank range
      if (t === 'pen') { fan(e.x, e.y + 8, a, 1 + hard * 2, 0.4, 100, 0); e.ft = hard ? 1.7 : 99; }
      else if (t === 'staple') { if (e.n % 3 === 0) fireB(e.x, e.y, a, 86, 1); e.ft = 99; }
      else if (t === 'query') { fan(e.x, e.y, a, 3, 0.5, 80 + hard * 12, 0); e.ft = 1.5; }
      else if (t === 'fee') { burst(e.x, e.y, a, 2, 125, 25, 4); e.ft = 99; }
      else if (t === 'proof') { fan(e.x, e.y + 10, a, 7, 1.25, 60, 1); burst(e.x, e.y + 10, a, 2, 150, 22, 4); e.ft = 1.9; }
    }
    function updateEnemy(e, dt) {
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.boss) { updateBoss(e, dt); return; }
      var p = e.path;
      if (p === 'down') e.y += 52 * dt;
      else if (p === 'fall') e.y += 150 * dt;
      else if (p === 'sine') { e.y += 62 * dt; e.x = e.x0 + Math.sin(e.t * 2.4) * 42; }
      else if (p === 'dive') { if (e.y < 110 && e.vx === 0) e.y += 95 * dt; else { if (e.vx === 0) e.vx = (P.x > e.x ? 1 : -1) * 70; e.x += e.vx * dt; e.y += 155 * dt; } }
      else if (p === 'arcR' || p === 'arcL') { e.x += (p === 'arcR' ? 125 : -125) * dt; e.y = e.ty + Math.sin(e.t * 1.7) * 70; }
      else if (e.t < e.stay) { if (e.y < e.ty) e.y = Math.min(e.ty, e.y + 90 * dt); if (p === 'drift') e.x = e.x0 + Math.sin(e.t * 0.9) * 50; }
      else e.y += (p === 'drift' ? -70 : 75) * dt;
      if (e.y > H + 30 || e.x < -44 || e.x > W + 44 || (e.y < -44 && e.t > 2)) { e.on = false; return; }
      enemyFire(e, dt);
      if (P.dead <= 0 && Math.abs(e.x - P.x) < e.hw * 0.7 + 2 && Math.abs(e.y - P.y) < e.hh * 0.7 + 3) killPlayer();
    }

    /* ------------------------------------------------------------ bosses */
    function coverPos(e, k, o) {                                                   // where journal cover k is right now
      var r = e.phase === 0 ? 66 : 80 + Math.sin(e.t * 1.2) * 22, a = e.a2 + k / 6 * TAU;
      o.x = e.x + Math.cos(a) * r; o.y = e.y + Math.sin(a) * r * 0.8; return o;
    }
    var tmpPos = { x: 0, y: 0 };
    function updateBoss(e, dt) {
      var k;
      if (e.dying > 0) {
        e.dying -= dt; e.ft -= dt;
        if (e.ft <= 0) { e.ft = 0.09; boom(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), (Math.random() * 3 | 0) + 1); medal(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), true); }
        if (e.dying <= 0) {
          e.on = false; G.boss = null; G.shake = 1.2; G.flash = 1; addScore(Math.round(e.def.score * mult() / 10) * 10); chainUp(20);
          for (k = 0; k < 10; k++) boom(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), 4);
          for (k = 0; k < e.def.cit; k++) medal(e.x + rnd(-60, 60), e.y + rnd(-40, 40), true);
          if (e.type === 'impact') { G.mode = 'outro'; G.endT = 0; api.stinger('victory'); } else { G.hold = false; api.music('space'); }
        }
        return;
      }
      if (e.y < e.ty) { e.y = Math.min(e.ty, e.y + 42 * dt); return; }
      var amp = e.type === 'typesetter' ? 62 : e.phase === 2 ? 70 : 36;
      e.x += (W / 2 + Math.sin(e.t * (e.phase === 2 ? 0.45 : 0.55)) * amp - e.x) * Math.min(1, dt * 2);
      e.a2 += dt * (e.type === 'impact' ? (e.phase === 1 ? -1.1 : 0.8) : 0);
      if (Math.abs(e.x - P.x) < e.hw * 0.8 && Math.abs(e.y - P.y) < e.hh * 0.8) killPlayer();
      G.tauntT -= dt; if (G.tauntT <= 0) { G.tauntT = 10; say(e.def.name, e.def.taunts[G.tauntI++ % e.def.taunts.length]); }
      if (e.lt > 0) { e.lt -= dt; return; }
      if (P.dead > 0) return;
      e.ft -= dt; e.ft2 -= dt; e.ft3 -= dt; e.a += dt;
      if (e.type === 'typesetter') {
        if (e.phase === 0) {
          var cyc = e.a % 6.6;
          if (cyc < 3.2) { if (e.ft <= 0) { e.ft = 0.52; e.fired++; var cx = e.x + (e.fired % 2 ? -72 : 72); fan(cx, e.y + 34, aimAt(cx, e.y + 34), 3, 0.4, 116, 4); } }
          else if (cyc < 6.2 && e.ft2 <= 0) {                                       // the carriage return: a broken line swept across the page
            e.ft2 = 0.07; e.fired++;
            if (e.fired % 8 < 5) fireB(e.x, e.y + 20, Math.PI * (0.14 + 0.72 * (0.5 - 0.5 * Math.cos((cyc - 3.2) / 3 * TAU))), 96, 1);
          }
        } else {
          if (e.ft <= 0) { e.ft = 1.5; e.a2 = clamp(e.a2 + rnd(-78, 78), 42, W - 42); curtain(e.y + 40, e.a2, 60, 56, 0); ring(e.a2, e.y + 40, 4, 80, 0.3, '#34d399'); }
          if (e.ft2 <= 0) { e.ft2 = 2.4; burst(e.x, e.y + 26, aimAt(e.x, e.y + 26), 3, 118, 22, 5); }
          if (e.ft3 <= 0) { e.ft3 = 3.3; circle(e.x, e.y + 10, 8, 46, Math.random() * TAU, 3); }
        }
        return;
      }
      if (e.phase === 0) {                                                          // journal rankings
        if (e.ft <= 0) { e.ft = 0.55; coverPos(e, e.fired++ % 6, tmpPos); burst(tmpPos.x, tmpPos.y, aimAt(tmpPos.x, tmpPos.y), 3, 110, 18, 4); }
        if (e.ft2 <= 0) { e.ft2 = 1.9; e.n++; circle(e.x, e.y, 16, 58, e.n * 0.2, e.n % 2); }
      } else if (e.phase === 1) {                                                   // citation cartel: two spirals, turning against each other
        if (e.ft <= 0) { e.ft = 0.115; for (k = 0; k < 3; k++) { fireB(e.x, e.y, e.a * 1.15 + k * TAU / 3, 68, 1); fireB(e.x, e.y, -e.a * 1.5 + k * TAU / 3, 92, 0); } }
        if (e.ft2 <= 0) { e.ft2 = 2.7; fan(e.x, e.y + 20, aimAt(e.x, e.y + 20), 5, 0.9, 84, 2); }
      } else {                                                                      // true form. sorry.
        if (e.ft <= 0) { e.ft = 0.085; e.vx += 0.2 + 0.17 * Math.sin(e.a * 0.9); for (k = 0; k < 4; k++) fireB(e.x, e.y, e.vx + k * TAU / 4, 78, 0); e.fired++; if (e.fired % 2 === 0) for (k = 0; k < 4; k++) fireB(e.x, e.y, -e.vx * 0.6 + k * TAU / 4 + 0.4, 54, 1); }
        if (e.ft2 <= 0) { e.ft2 = 2.3; circle(e.x, e.y, 10, 44, Math.random() * TAU, 3); }
        if (e.ft3 <= 0) { e.ft3 = 1.5; burst(e.x, e.y + 24, aimAt(e.x, e.y + 24), 2, 160, 24, 4); }
      }
    }

    /* ------------------------------------------------------------ stage scripts: [time, what, x, path, count, gap, dx, drop, hoverY] */
    var STAGE1 = [
      [0.5, 'card', 'STAGE 1', 'COPYEDITING'],
      [3.5, 'pen', 80, 'sine', 5, 0.32, 0], [5.5, 'pen', 280, 'sine', 5, 0.32, 0],
      [8, 'staple', 0, 'arcR', 6, 0.22, 0, '', 80], [10, 'staple', 0, 'arcL', 6, 0.22, 0, '', 100],
      [11.5, 'box', 180, 'down', 1, 0, 0, 'W'],
      [13, 'query', 90, 'hover', 1, 0, 0, '', 90], [13.6, 'query', 270, 'hover', 1, 0, 0, '', 90],
      [15, 'msg', 'COPYEDITOR', 'WE HAVE CHANGED EVERY "WHICH" TO "THAT". AND BACK AGAIN.'],
      [16, 'pen', 40, 'dive', 4, 0.28, 22], [17.5, 'pen', 320, 'dive', 4, 0.28, -22],
      [20, 'bracket', 70, 'hover', 1, 0, 0, '', 80], [20, 'bracketR', 290, 'hover', 1, 0, 0, '', 80],
      [22, 'staple', 0, 'arcR', 8, 0.2, 0, '', 120], [24, 'box', 110, 'down', 1, 0, 0, 'P'], [25, 'pen', 180, 'sine', 6, 0.3, 0],
      [27, 'bubble', 180, 'hover', 1, 0, 0, '', 100], [29, 'staple', 0, 'arcL', 8, 0.2, 0, '', 70],
      [31, 'query', 60, 'hover', 1, 0, 0, '', 70], [31.5, 'query', 300, 'hover', 1, 0, 0, '', 70], [32, 'query', 180, 'hover', 1, 0, 0, '', 120],
      [34, 'msg', 'COPYEDITOR', 'AU: PLEASE CONFIRM THAT "DATA" IS PLURAL.'],
      [35, 'pen', 60, 'dive', 5, 0.25, 15], [36, 'pen', 300, 'dive', 5, 0.25, -15], [38, 'box', 250, 'down', 1, 0, 0, 'S'],
      [39, 'bracket', 120, 'hover', 1, 0, 0, '', 100], [39, 'bracketR', 240, 'hover', 1, 0, 0, '', 100],
      [41, 'staple', 0, 'arcR', 6, 0.2, 0, '', 90], [41.5, 'staple', 0, 'arcL', 6, 0.2, 0, '', 140],
      [44, 'bubble', 100, 'hover', 1, 0, 0, '', 90], [45, 'bubble', 260, 'hover', 1, 0, 0, '', 90],
      [47, 'pen', 130, 'sine', 5, 0.3, 0], [48, 'pen', 230, 'sine', 5, 0.3, 0], [51, 'box', 180, 'down', 1, 0, 0, 'B'],
      [52, 'query', 120, 'hover', 1, 0, 0, '', 80], [52, 'query', 240, 'hover', 1, 0, 0, '', 80], [53, 'staple', 0, 'arcR', 8, 0.18, 0, '', 130],
      [57, 'msg', 'PRODUCTION', 'YOUR MANUSCRIPT HAS BEEN SENT TO THE TYPESETTER.'],
      [60, 'midboss'],
      [61.5, 'card', 'STAGE 1 CLEAR', 'MINOR CORRECTIONS ONLY', 3.5], [62, 'box', 180, 'down', 1, 0, 0, 'W'], [66, 'next']
    ];
    var STAGE2 = [
      [0.5, 'card', 'STAGE 2', 'PROOFS / PRODUCTION'],
      [3.5, 'fee', 50, 'fall', 8, 0.17, 34], [5.5, 'fee', 310, 'fall', 8, 0.17, -34],
      [8, 'paywall', 100, 'down'], [8, 'paywall', 260, 'down'], [10, 'box', 180, 'down', 1, 0, 0, 'P'],
      [11, 'sat', 180, 'drift', 1, 0, 0, '', 80], [13, 'pen', 50, 'dive', 5, 0.25, 18], [14, 'pen', 310, 'dive', 5, 0.25, -18],
      [15, 'msg', 'PUBLISHER', 'THE OPEN ACCESS FEE IS 9,500 POUNDS. PER FIGURE.'],
      [17, 'fee', 180, 'fall', 10, 0.15, 0], [18.5, 'paywall', 60, 'down'], [18.5, 'paywall', 180, 'down'], [18.5, 'paywall', 300, 'down'],
      [22, 'proof', 180, 'hover', 1, 0, 0, '', 110], [24, 'staple', 0, 'arcR', 8, 0.18, 0, '', 150], [25, 'staple', 0, 'arcL', 8, 0.18, 0, '', 110],
      [27, 'sat', 90, 'drift', 1, 0, 0, '', 70], [27.5, 'sat', 270, 'drift', 1, 0, 0, '', 100], [29, 'box', 120, 'down', 1, 0, 0, 'W'],
      [31, 'fee', 30, 'fall', 9, 0.16, 36], [32, 'fee', 330, 'fall', 9, 0.16, -36],
      [34, 'proof', 100, 'hover', 1, 0, 0, '', 100], [35, 'proof', 260, 'hover', 1, 0, 0, '', 100],
      [37, 'msg', 'PUBLISHER', 'YOUR PAPER IS UNDER EMBARGO UNTIL YOU HAVE FORGOTTEN IT.'],
      [38, 'paywall', 60, 'down'], [38, 'paywall', 300, 'down'], [39, 'query', 180, 'hover', 1, 0, 0, '', 90], [40, 'pen', 180, 'sine', 8, 0.25, 0],
      [42, 'box', 240, 'down', 1, 0, 0, 'B'], [43, 'bubble', 90, 'hover', 1, 0, 0, '', 90], [43.5, 'bubble', 270, 'hover', 1, 0, 0, '', 90],
      [46, 'sat', 180, 'drift', 1, 0, 0, '', 120], [47, 'fee', 100, 'fall', 8, 0.15, 0], [48, 'fee', 260, 'fall', 8, 0.15, 0],
      [50, 'bracket', 60, 'hover', 1, 0, 0, '', 80], [50, 'bracketR', 300, 'hover', 1, 0, 0, '', 80], [51, 'pen', 40, 'dive', 6, 0.22, 20], [52, 'pen', 320, 'dive', 6, 0.22, -20],
      [54, 'box', 180, 'down', 1, 0, 0, '1'], [55, 'proof', 180, 'hover', 1, 0, 0, '', 120], [56, 'sat', 70, 'drift', 1, 0, 0, '', 70], [56, 'sat', 290, 'drift', 1, 0, 0, '', 70],
      [58, 'paywall', 60, 'down'], [58, 'paywall', 180, 'down'], [58, 'paywall', 300, 'down'], [60, 'box', 100, 'down', 1, 0, 0, 'P'],
      [63, 'msg', 'EDITORIAL OFFICE', 'PLEASE HOLD. YOUR MANUSCRIPT IS IMPORTANT TO US.'],
      [67, 'warn']
    ];
    function runScript(dt) {
      var i, s, o;
      if (!G.hold) G.st += dt;
      while (G.si < G.script.length && G.script[G.si][0] <= G.st) {
        s = G.script[G.si++];
        if (s[1] === 'card') card(s[2], s[3], s[4]);
        else if (s[1] === 'msg') say(s[2], s[3]);
        else if (s[1] === 'midboss') { G.hold = true; G.boss = spawnEnemy('typesetter', W / 2); G.tauntT = 1.5; G.tauntI = 0; card('MID-BOSS', 'THE TYPESETTER', 2.6); }
        else if (s[1] === 'warn') { G.hold = true; G.warnT = 4.4; sfx.klaxon(); api.music('silence'); }
        else if (s[1] === 'next') { G.stage = 2; G.script = STAGE2; G.si = 0; G.st = 0; }
        else for (i = 0; i < NSP; i++) if (!SP[i].on) { o = SP[i]; o.on = true; o.type = s[1]; o.x = s[2]; o.path = s[3]; o.n = s[4] || 1; o.gap = s[5] || 0; o.dx = s[6] || 0; o.drop = s[7] || ''; o.ty = s[8] || 90; o.timer = 0; o.k = 0; break; }
      }
      for (i = 0; i < NSP; i++) {
        o = SP[i]; if (!o.on) continue;
        o.timer -= dt;
        while (o.on && o.timer <= 0) { var e = spawnEnemy(o.type === 'bracketR' ? 'bracket' : o.type, o.x + o.k * o.dx, o.path, o.drop, o.ty); if (e && o.type === 'bracketR') e.a2 = -1; o.k++; o.timer += Math.max(0.01, o.gap); if (o.k >= o.n) o.on = false; }
      }
      if (G.warnT > 0) { G.warnT -= dt; if (G.warnT <= 0) { G.boss = spawnEnemy('impact', W / 2); G.tauntT = 2; G.tauntI = 0; api.music('space'); } }
    }

    /* ------------------------------------------------------------ simulation step (called with small fixed-ish dt) */
    var NSTAR = 120, stx = new Float32Array(NSTAR), sty = new Float32Array(NSTAR), stl = new Uint8Array(NSTAR);
    function updateBullets(dt) {
      var i, dx, dy, r, vul = P.dead <= 0 && P.inv <= 0 && G.mode === 'play';
      for (i = 0; i < NB; i++) {
        if (!bal[i]) continue;
        bx[i] += bvx[i] * dt; by[i] += bvy[i] * dt;
        if (bx[i] < -12 || bx[i] > W + 12 || by[i] < -12 || by[i] > H + 12) { bal[i] = 0; bLive--; continue; }
        if (vul) { dx = bx[i] - P.x; dy = by[i] - P.y; r = BHIT[bt[i]] + 2; if (dx * dx + dy * dy < r * r) { bal[i] = 0; bLive--; killPlayer(); vul = false; } }
      }
      if (bLive < 0) bLive = 0;
    }
    function updateFx(dt) {
      var i, o;
      for (i = 0; i < NP; i++) if (pl[i] > 0) { pl[i] -= dt; px[i] += pvx[i] * dt; py[i] += pvy[i] * dt; pvx[i] *= 0.97; pvy[i] *= 0.97; }
      for (i = 0; i < NR; i++) { o = RG[i]; if (o.on) { o.life -= dt; o.r += o.vr * dt; if (o.life <= 0) o.on = false; } }
      for (i = 0; i < NT; i++) { o = TX[i]; if (o.on) { o.life -= dt; o.y -= 22 * dt; if (o.life <= 0) o.on = false; } }
      var sp = G.mode === 'outro' && G.endT > 2.4 ? 4 : G.warnT > 0 ? 0.4 : 1;
      for (i = 0; i < NSTAR; i++) { sty[i] += (stl[i] === 0 ? 14 : stl[i] === 1 ? 34 : 78) * sp * dt; if (sty[i] > H) { sty[i] -= H; stx[i] = Math.random() * W; } }
      G.scroll += 9 * sp * dt;
      if (G.girderOn) { G.girderY += 46 * sp * dt; if (G.girderY > H + 40) G.girderOn = false; }
      else if (Math.random() < dt * 0.09) { G.girderOn = true; G.girderY = -640; G.girderSide = Math.random() < 0.5 ? 0 : 1; }
      if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 0.9);
      if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.6);
      if (G.cardT > 0) G.cardT -= dt;
      if (G.sayT > 0) { G.sayT -= dt; G.sayN += dt * 38; }
    }
    function step(dt) {
      var i;
      G.t += dt; updateFx(dt);
      if (G.mode === 'continue') { var was = Math.ceil(G.contT); G.contT -= dt; if (Math.ceil(G.contT) !== was) sfx.count(); if (G.contT <= 0) { G.mode = 'gameover'; G.contT = 0; sfx.chainBreak(); } return; }
      if (G.mode === 'gameover') { G.contT += dt; return; }
      if (G.mode === 'ending') { G.endT += dt; if (Math.random() < dt * 2.2) { var fx = rnd(30, W - 30), fy = rnd(40, H * 0.6); boom(fx, fy, 2); for (i = 0; i < 5; i++) medal(fx, fy, false); } updateItems(dt); return; }
      if (G.mode === 'outro') {
        G.endT += dt;
        if (G.endT > 2.6) { P.y -= (120 + (G.endT - 2.6) * 500) * dt; P.laser = false; P.top = -10; P.nLock = 0; P.flame += dt; if (G.endT > 3.5) G.flash = Math.min(1, G.flash + dt * 3); }
        else updatePlayer(dt);
        updateShots(dt); updateItems(dt);
        if (G.endT > 4.3) showEnding();
        return;
      }
      runScript(dt); updatePlayer(dt);
      for (i = 0; i < NE; i++) if (EN[i].on) updateEnemy(EN[i], dt);
      updateShots(dt); updateBullets(dt); updateItems(dt);
      if (G.chain > 0) { G.gauge -= dt / 2.6; if (G.gauge <= 0) chainBreak(); }
    }
    function doContinue() {
      if (G.mode === 'continue') { G.mode = 'play'; G.score = 0; G.continues++; G.lives = 3; G.bombs = 3; respawn(); sfx.start(); floatText('RESUBMITTED', W / 2, H / 2, '#34d399'); }
      else if (G.mode === 'gameover' && G.contT > 1) {                                // the count ran out: the stage starts again, nothing is lost but pride
        var st = G.stage; clearPools(); G.mode = 'play'; G.score = 0; G.continues++; G.lives = 3; G.bombs = 3; G.chain = 0; G.gauge = 0; G.boss = null; G.hold = false; G.warnT = 0;
        G.script = st === 1 ? STAGE1 : STAGE2; G.si = 0; G.st = 0; respawn(); sfx.start(); api.music('space');
      }
    }

    /* ------------------------------------------------------------ the ending (real DOM, because it carries real links) */
    function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function showEnding() {
      if (G.mode === 'ending') return;
      G.mode = 'ending'; G.endT = 0; G.flash = 1; G.boss = null; G.warnT = 0; G.sayT = 0; cancelBullets(false);
      for (var i = 0; i < NE; i++) EN[i].on = false;
      try { localStorage.setItem('quest.shmup.hi', String(G.hi)); } catch (e) {}
      api.music('silence'); api.stinger('ending');
      if (bombBtn) bombBtn.hidden = true; if (pauseBtn) pauseBtn.hidden = true;
      var c = G.continues, L = api.links || {}, year = new Date().getFullYear();
      var quip = c === 0 ? 'ACCEPTED WITHOUT A SINGLE RESUBMISSION. NOBODY WILL BELIEVE YOU.' : c < 3 ? 'ACCEPTED AFTER ' + c + ' RESUBMISSION' + (c > 1 ? 'S' : '') + '. ABOUT AVERAGE, FRANKLY.' : 'ACCEPTED AFTER ' + c + ' RESUBMISSIONS. PERSISTENCE IS ALSO A METHOD.';
      endEl = document.createElement('div'); endEl.className = 'qs-end';
      var h = '<div class="qs-end__in"><div class="qs-end__stamp">PUBLISHED!</div>' +
        '<div class="qs-end__cite">PALMER ET AL. (' + year + ') · IMPACT FACTOR: 0.000</div>' +
        '<div class="qs-end__stats"><span>SCORE<b>' + fmt(G.score) + '</b></span><span>MAX CHAIN<b>' + G.maxChain + ' HIT</b></span><span>CITATIONS<b>' + fmt(G.cites) + '</b></span><span>CONTINUES<b>' + c + '</b></span></div>' +
        '<p class="qs-end__quip">' + quip + '</p><p class="qs-end__quip qs-end__dim">YOUR PAPER IS NOW BEHIND A PAYWALL. YOU DO NOT HAVE ACCESS.</p><div class="qs-end__links">';
      [['publications', 'READ THE REAL PAPERS'], ['research', 'RESEARCH'], ['code', 'CODE'], ['scholar', 'ACTUAL CITATIONS'], ['email', 'EMAIL THE AUTHOR']].forEach(function (p) {
        if (!L[p[0]]) return; var ext = /^https?:/.test(L[p[0]]);
        h += '<a href="' + String(L[p[0]]).replace(/"/g, '&quot;') + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + p[1] + '</a>';
      });
      h += '</div><div class="qs-end__btns"><button type="button" data-qs="again">▶ PLAY AGAIN</button><button type="button" data-qs="site">BACK TO THE SITE ↓</button></div></div>';
      endEl.innerHTML = h; overlay.appendChild(endEl);
      endEl.querySelector('[data-qs="again"]').addEventListener('click', function () { try { api.restart(); } catch (e) {} });
      endEl.querySelector('[data-qs="site"]').addEventListener('click', function () {
        setFixed(false);                                                              // hand the page back, keep the ending where the game was
        var el = document.getElementById('boring'); if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } }
      });
    }

    /* ------------------------------------------------------------ drawing: the playfield (360 x H logical pixels) */
    var overlay = null, styleEl = null, scr = null, sx = null, pf = null, g = null, endEl = null, bombBtn = null, pauseBtn = null;
    var narrow = false, fixedOn = false, bandSay = false, dpr = 1, U = 1, pfX = 0, pfY = 0, pfW = 0, pfH = 0, scrW = 0, scrH = 0, gFont = 0, zig = new Float32Array(16);
    function txt(s, x, y, size, col, align) {
      if (gFont !== size) { g.font = size + 'px ' + FONT; gFont = size; }
      g.textAlign = align || 'center'; g.fillStyle = '#05060f'; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
    }
    function wrap(text, max) { var words = String(text).split(' '), lines = [], cur = ''; for (var i = 0; i < words.length; i++) { if (cur && (cur + ' ' + words[i]).length > max) { lines.push(cur); cur = words[i]; } else cur = cur ? cur + ' ' + words[i] : words[i]; } if (cur) lines.push(cur); return lines; }
    function beam(x, top, bot, hw, c0, c1, c2) {
      var f = (Math.random() * 2) | 0, y, h = bot - top; if (h <= 0) return;
      g.fillStyle = c0; g.fillRect(x - hw - 2 - f, top, (hw + 2 + f) * 2, h); g.fillStyle = c1; g.fillRect(x - hw, top, hw * 2, h);
      g.fillStyle = c2; g.fillRect(x - hw + 2, top, Math.max(2, hw * 2 - 4), h); g.fillStyle = '#fff'; g.fillRect(x - Math.max(1, hw - 4), top, Math.max(2, hw * 2 - 8), h);
      g.fillStyle = c2; for (y = bot - ((G.t * 700) % 24); y > top; y -= 24) g.fillRect(x - hw - 1, y, hw * 2 + 2, 3);
    }
    function drawBoss(e) {
      var k, wh = e.flash > 0 && ((G.t * 8) | 0) % 2 === 0, jx = e.dying > 0 ? ((Math.random() * 5) | 0) - 2 : 0, x = Math.round(e.x) + jx, y = Math.round(e.y);
      if (e.type === 'typesetter') {
        g.drawImage(SPR.typesetter, x - 78, y - 44);
        if (wh) { g.globalAlpha = 0.6; g.drawImage(WHT.typesetter, x - 78, y - 44); g.globalAlpha = 1; }   // hit flash you can still read
        var pulse = 0.5 + 0.5 * Math.sin(G.t * 9); g.fillStyle = e.phase ? '#ff4fa3' : '#e3625b'; g.fillRect(x - 9, y - 14, 18, 12); g.fillStyle = '#fff'; g.globalAlpha = 0.4 + pulse * 0.6; g.fillRect(x - 5, y - 11, 10, 6); g.globalAlpha = 1;
        return;
      }
      for (var pass = 0; pass < 2; pass++) {
        if (pass === 1) {
          g.save(); g.translate(x, y); g.rotate(e.t * (e.phase === 2 ? 2.4 : 0.7)); g.drawImage(GEAR[e.phase === 2 ? 1 : 0], -56, -56); if (wh) { g.globalAlpha = 0.6; g.drawImage(GEAR[2], -56, -56); g.globalAlpha = 1; } g.restore();
          g.fillStyle = '#0b0c14'; g.beginPath(); g.arc(x, y, 26, 0, TAU); g.fill(); g.strokeStyle = e.phase === 2 ? '#ff4fa3' : '#fcd34d'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 25, 0, TAU); g.stroke();
          var rest = e.hp, tot = 0; for (k = 0; k < e.def.phases.length; k++) { tot += e.def.phases[k]; if (k > e.phase) rest += e.def.phases[k]; }
          txt('IF', x, y - 13, 8, e.phase === 2 ? '#ff9ccc' : '#9aa3b8'); txt((Math.max(0, rest) / tot * 64.8).toFixed(3), x, y - 1, 8, e.phase === 2 && ((G.t * 8) | 0) % 2 ? '#ff4fa3' : '#fcd34d');
        }
        if (e.phase < 2) for (k = 0; k < 6; k++) { coverPos(e, k, tmpPos); var front = Math.sin(e.a2 + k / 6 * TAU) > 0; if (front === (pass === 1)) g.drawImage(COVERS[k], Math.round(tmpPos.x) - 9, Math.round(tmpPos.y) - 12); }
      }
    }
    function drawField() {
      var i, k, e, o, y, x, t = G.t, fr = ((t * 12) | 0) % 2;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = false; g.textBaseline = 'top';
      g.fillStyle = G.stage > 1 ? '#0c0614' : '#05060f'; g.fillRect(0, 0, W, H);
      if (G.shake > 0) g.translate(((Math.random() - 0.5) * G.shake * 9) | 0, ((Math.random() - 0.5) * G.shake * 9) | 0);
      for (y = (G.scroll % 512) - 512; y < H; y += 512) g.drawImage(NEB[G.stage > 1 ? 1 : 0], 0, 0, 90, 128, 0, y | 0, 360, 512);
      for (i = 0; i < NSTAR; i++) { g.fillStyle = stl[i] === 0 ? '#4a5470' : stl[i] === 1 ? '#9aa3b8' : '#ffffff'; g.fillRect(stx[i] | 0, sty[i] | 0, 1, stl[i] === 2 ? 2 : 1); }
      if (G.girderOn) { x = G.girderSide ? W - 40 : 0; for (k = 0; k < 10; k++) { y = G.girderY + k * 64; if (y > -64 && y < H) g.drawImage(GIRDER, x, y | 0); } y = G.girderY + 256; if (y > -12 && y < H) { g.fillStyle = '#141a2c'; g.fillRect(0, y | 0, W, 10); g.fillStyle = '#232c48'; g.fillRect(0, y | 0, W, 2); for (k = 0; k < W; k += 24) { g.fillStyle = '#2f3a5c'; g.fillRect(k + 4, (y | 0) + 4, 2, 2); } } }
      for (i = 0; i < NM; i++) if (mal[i]) g.drawImage(ICON.cite, (mx[i] - 3) | 0, (my[i] - 2) | 0);
      for (i = 0; i < NK; i++) {
        o = PK[i]; if (!o.on) continue;
        var w = Math.floor(o.t / 1.1) % 3, col = o.kind === 'W' ? WEAP[w].col : o.kind === 'P' ? '#fb923c' : o.kind === 'S' ? '#8ad4ff' : o.kind === 'B' ? '#f4f6fb' : '#34d399', lab = o.kind === 'W' ? 'RBG'.charAt(w) : o.kind === '1' ? '1UP' : o.kind, pw = o.kind === '1' ? 15 : 8;
        x = Math.round(o.x); y = Math.round(o.y);
        g.fillStyle = ((t * 10) | 0) % 2 ? '#fff' : '#11131c'; g.fillRect(x - pw - 1, y - 8, pw * 2 + 2, 16); g.fillStyle = col; g.fillRect(x - pw, y - 7, pw * 2, 14); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x - pw, y - 7, pw * 2, 3);
        if (gFont !== 8) { g.font = '8px ' + FONT; gFont = 8; } g.textAlign = 'center'; g.fillStyle = '#11131c'; g.fillText(lab, x + 1, y - 3);
      }
      for (i = 0; i < NE; i++) {
        e = EN[i]; if (!e.on) continue;
        if (e.boss) { drawBoss(e); continue; }
        var name = e.type === 'bracket' && e.a2 === -1 ? 'bracketR' : e.type, sp = SPR[name], ex = Math.round(e.x - sp.width / 2), ey = Math.round(e.y - sp.height / 2);
        g.drawImage(sp, ex, ey);
        if (e.flash > 0 && ((t * 8) | 0) % 2 === 0) { g.globalAlpha = 0.7; g.drawImage(WHT[name], ex, ey); g.globalAlpha = 1; }
      }
      for (i = 0; i < NS; i++) {
        if (!sal[i]) continue; x = sx_[i] | 0; y = sy_[i] | 0;
        if (sk[i] === 0) { g.fillStyle = '#ff5a4a'; g.fillRect(x - 2, y - 4, 4, 8); g.fillStyle = '#ffe9c0'; g.fillRect(x - 1, y - 3, 2, 5); }
        else if (sk[i] === 1) { g.fillStyle = '#3f8fff'; g.fillRect(x - 2, y - 5, 3, 10); g.fillStyle = '#d6efff'; g.fillRect(x - 1, y - 4, 1, 7); }
        else { g.fillStyle = '#22c55e'; g.fillRect(x - 1, y - 7, 3, 14); g.fillStyle = '#eafff0'; g.fillRect(x, y - 6, 1, 12); }
      }
      var alive = P.dead <= 0 && G.mode !== 'ending';
      if (alive && P.laser) {
        var L = G.level - 1, x0 = Math.round(P.x), y0 = Math.round(P.y) - 13;
        if (G.weapon === 0) { beam(x0, Math.max(0, P.top), y0, [5, 6, 7, 9][L], '#9f1a1a', '#ff5a4a', '#ffd27a'); if (P.top > 0) { g.fillStyle = ((t * 30) | 0) % 2 ? '#fff' : '#ffd27a'; g.beginPath(); g.arc(x0, P.top, 8 + L * 2 + Math.random() * 3, 0, TAU); g.fill(); } }
        else if (G.weapon === 2) beam(x0, 0, y0, [3, 3, 4, 5][L], '#0f5f2f', '#22c55e', '#b6ffce');
        else {
          var nl = P.nLock || 2;
          for (k = 0; k < nl; k++) {
            var tx = P.nLock ? EN[lockI[k]].x : x0 + (k ? 26 : -26), ty = P.nLock ? EN[lockI[k]].y : y0 - 70, dx = tx - x0, dy = ty - y0, len = Math.hypot(dx, dy) || 1, s;
            for (s = 1; s < 7; s++) { var off = (Math.random() - 0.5) * 22; zig[s * 2] = x0 + dx * s / 7 - dy / len * off; zig[s * 2 + 1] = y0 + dy * s / 7 + dx / len * off; }
            for (var pass = 0; pass < 2; pass++) { g.strokeStyle = pass ? '#ffffff' : '#3f8fff'; g.lineWidth = pass ? 1 : 3 + L; g.beginPath(); g.moveTo(x0, y0); for (s = 1; s < 7; s++) g.lineTo(zig[s * 2], zig[s * 2 + 1]); g.lineTo(tx, ty); g.stroke(); }
            if (P.nLock) { g.fillStyle = '#d6efff'; g.fillRect((tx | 0) - 3, (ty | 0) - 3, 6, 6); }
          }
        }
        g.strokeStyle = WEAP[G.weapon].col; g.lineWidth = 2; g.globalAlpha = 0.45 + 0.3 * Math.sin(t * 40); g.beginPath(); g.arc(x0, P.y, 17 + Math.sin(t * 25) * 2, 0, TAU); g.stroke(); g.globalAlpha = 0.12; g.fillStyle = WEAP[G.weapon].col; g.fill(); g.globalAlpha = 1;
      }
      if (alive && (P.inv <= 0 || ((t * 14) | 0) % 2 || G.mode === 'outro')) {
        x = Math.round(P.x); y = Math.round(P.y); var fl = 5 + ((P.flame * 30) | 0) % 3 * 2 + (keys.u ? 5 : 0) + (G.mode === 'outro' && G.endT > 2.6 ? 14 : 0);
        g.fillStyle = '#fb923c'; g.fillRect(x - 3, y + 13, 7, fl); g.fillStyle = '#fcd34d'; g.fillRect(x - 2, y + 13, 5, fl - 2); g.fillStyle = '#fff'; g.fillRect(x - 1, y + 13, 3, Math.max(2, fl - 5));
        g.drawImage(SHIP[P.bank < -0.35 ? 0 : P.bank > 0.35 ? 2 : 1], x - 8, y - 12);
        if (P.laser || keys.focus) { g.fillStyle = '#11131c'; g.beginPath(); g.arc(x + 0.5, y + 0.5, 4.5, 0, TAU); g.fill(); g.fillStyle = fr ? '#ff4fa3' : '#ff9ccc'; g.beginPath(); g.arc(x + 0.5, y + 0.5, 3.4, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(x - 1, y - 1, 3, 3); }
      }
      for (i = 0; i < NP; i++) if (pl[i] > 0) { g.fillStyle = pl[i] < pml[i] * 0.35 ? '#7a2e24' : PCOL[pc[i]]; g.fillRect(px[i] | 0, py[i] | 0, ps[i], ps[i]); }
      for (i = 0; i < NR; i++) { o = RG[i]; if (o.on) { g.globalAlpha = Math.max(0, o.life / o.ml); g.strokeStyle = o.col; g.lineWidth = 2; g.beginPath(); g.arc(o.x, o.y, o.r, 0, TAU); g.stroke(); } }
      g.globalAlpha = 1;
      if (P.bombT > 0) {                                                                // the skull
        var age = 1.9 - P.bombT, grow = Math.min(1, age / 0.5), ease = 1 - (1 - grow) * (1 - grow), cx = P.bombX + (W / 2 - P.bombX) * ease, cy = P.bombY + (H * 0.42 - P.bombY) * ease, sc = 3 + ease * 17 + Math.sin(t * 30) * 0.6, fade = Math.min(1, P.bombT / 0.4);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * fade; g.fillStyle = '#e3625b'; g.beginPath(); g.arc(cx, cy, sc * 11, 0, TAU); g.fill(); g.fillStyle = '#fb923c'; g.beginPath(); g.arc(cx, cy, sc * 8.5, 0, TAU); g.fill();
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = fade * (0.75 + 0.25 * Math.sin(t * 50));
        g.drawImage(SKULL[((t * 16) | 0) % 3], Math.round(cx - sc * 7.5), Math.round(cy - sc * 8), Math.round(sc * 15), Math.round(sc * 16)); g.globalAlpha = 1;
      }
      for (i = 0; i < NB; i++) if (bal[i]) { k = bt[i]; g.drawImage(BS[k][k > 3 ? brot[i] : fr], (bx[i] - (k > 1 ? 7 : 4)) | 0, (by[i] - (k > 1 ? 7 : 4)) | 0); }
      for (i = 0; i < NT; i++) { o = TX[i]; if (o.on) txt(o.s, o.x | 0, o.y | 0, 8, o.life < 0.3 && ((t * 20) | 0) % 2 ? '#9aa3b8' : o.col); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (G.boss && G.boss.on) {
        e = G.boss; y = narrow ? 30 : 8; txt(e.def.name, 10, y, 8, '#fff', 'left'); var np = e.def.phases.length - 1 - e.phase; for (k = 0; k < np; k++) { g.fillStyle = '#fcd34d'; g.fillRect(W - 16 - k * 8, y + 1, 6, 6); }
        g.fillStyle = '#11131c'; g.fillRect(9, y + 10, W - 18, 7); g.fillStyle = '#3b0d16'; g.fillRect(10, y + 11, W - 20, 5); g.fillStyle = e.hp / e.mhp < 0.25 && fr ? '#fff' : (e.phase === e.def.phases.length - 1 ? '#ff4fa3' : '#e3625b'); g.fillRect(10, y + 11, Math.max(0, (W - 20) * e.hp / e.mhp) | 0, 5);
      }
      if (G.warnT > 0) {
        var on = ((G.warnT * 3) | 0) % 2 === 0; g.fillStyle = 'rgba(120,0,10,' + (on ? 0.42 : 0.25) + ')'; g.fillRect(0, H / 2 - 74, W, 148);
        for (k = -1; k < 17; k++) { g.fillStyle = k % 2 ? '#11131c' : '#fcd34d'; x = k * 24 + ((G.t * 60) % 48); g.fillRect(x, H / 2 - 74, 24, 8); g.fillRect(W - x - 24, H / 2 + 66, 24, 8); }
        txt('WARNING', W / 2, H / 2 - 50, 32, on ? '#ff3b3b' : '#fcd34d'); txt('A HUGE EDITORIAL BOARD', W / 2, H / 2 - 4, 8, '#fff'); txt('IS APPROACHING FAST', W / 2, H / 2 + 10, 8, '#fff');
        txt('NO REFUNDS ON ARTICLE PROCESSING CHARGES', W / 2, H / 2 + 36, 8, '#ff9ccc');
      } else if (G.cardT > 0) {
        g.globalAlpha = Math.min(1, G.cardT * 3, (G.cardDur - G.cardT) * 4); g.fillStyle = 'rgba(5,6,15,.72)'; g.fillRect(0, H / 2 - 40, W, 74); g.fillStyle = '#fcd34d'; g.fillRect(0, H / 2 - 40, W, 2); g.fillRect(0, H / 2 + 32, W, 2);
        txt(G.cardTitle, W / 2, H / 2 - 26, 24, '#fff'); txt(G.cardSub, W / 2, H / 2 + 10, 8, '#fcd34d'); g.globalAlpha = 1;
      }
      if (narrow) drawHudNarrow(fr);
      if (G.mode === 'continue' || G.mode === 'gameover') {
        g.fillStyle = 'rgba(5,6,15,.7)'; g.fillRect(0, 0, W, H);
        if (G.mode === 'continue') { txt('CONTINUE?', W / 2, H / 2 - 90, 24, '#fff'); txt(String(Math.max(0, Math.ceil(G.contT) - 1)), W / 2, H / 2 - 44, 64, '#fcd34d'); if (fr || G.contT % 1 > 0.3) txt(narrow ? 'TAP TO RESUBMIT' : 'PRESS FIRE TO RESUBMIT', W / 2, H / 2 + 44, 8, '#34d399'); txt('THE SCORE RESETS. THE REVIEWS DO NOT.', W / 2, H / 2 + 66, 8, '#9aa3b8'); }
        else { txt('GAME OVER', W / 2, H / 2 - 60, 32, '#e6e6e6'); txt('DESK REJECTED', W / 2, H / 2 - 8, 16, '#ff6b7a'); if (G.contT > 1 && ((t * 2) | 0) % 2) txt(narrow ? 'TAP TO TRY ANOTHER JOURNAL' : 'PRESS FIRE TO TRY ANOTHER JOURNAL', W / 2, H / 2 + 40, 8, '#34d399'); }
      }
      if (G.paused) { g.fillStyle = 'rgba(5,6,15,.72)'; g.fillRect(0, 0, W, H); txt('PAUSED', W / 2, H / 2 - 30, 32, '#fff'); txt(narrow ? 'TAP TO RESUME' : 'P OR ESC TO RESUME', W / 2, H / 2 + 20, 8, '#fcd34d'); txt('OUT TO LUNCH. BACK IN 6-8 WEEKS.', W / 2, H / 2 + 40, 8, '#9aa3b8'); }
    }
    function drawHudNarrow(fr) {
      var k, y = H - 12;
      txt(fmt(G.score), 6, 6, 8, '#fff', 'left'); txt('HI ' + fmt(G.hi), W - 6, 6, 8, '#9aa3b8', 'right');
      if (G.chain > 0) { txt(G.chain + ' HIT', 6, 18, 8, '#fcd34d', 'left'); g.fillStyle = '#11131c'; g.fillRect(6, 28, 62, 4); g.fillStyle = G.gauge < 0.3 && fr ? '#fff' : '#34d399'; g.fillRect(7, 29, (60 * G.gauge) | 0, 2); }
      for (k = 0; k < Math.min(G.lives - 1, 6); k++) g.drawImage(ICON.life, 6 + k * 11, y - 1);
      for (k = 0; k < Math.min(G.bombs, 6); k++) g.drawImage(ICON.bomb, 6 + k * 11, y - 11);
      txt('RBG'.charAt(G.weapon) + ' LV' + G.level, W - 6, y, 8, WEAP[G.weapon].col, 'right');
      if (G.sayT > 0 && G.sayLines && !bandSay) { var n = Math.floor(G.sayN), yy = H - 58 - G.sayLines.length * 10; txt(G.who, W / 2, yy, 8, '#fcd34d'); for (k = 0; k < G.sayLines.length && n > 0; k++) { yy += 11; txt(G.sayLines[k].slice(0, n), W / 2, yy, 8, '#fff'); n -= G.sayLines[k].length; } }
    }

    /* ------------------------------------------------------------ the cabinet: injected style, overlay, canvases */
    var CSS = '.qs-ov{position:absolute;inset:0;z-index:9;overflow:hidden;background:#05060f;font-family:' + FONT + ';' +
      'letter-spacing:.04em;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none;}' +
      '.qs-ov.is-fixed{position:fixed;inset:0;z-index:2147483000;}' +
      '.qs-ov canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;cursor:crosshair;outline:none;touch-action:none;}' +
      '.qs-btn{position:absolute;z-index:3;margin:0;padding:0;font:inherit;font-family:' + FONT + ';color:#f4f6fb;' +
      'background:rgba(8,10,20,.55);border:2px solid rgba(244,246,251,.7);box-shadow:3px 3px 0 rgba(5,6,15,.8);' +
      'cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none;display:grid;place-items:center;}' +
      '.qs-btn:active{background:#fcd34d;color:#11131c;border-color:#fff;}' +
      '.qs-end{position:absolute;inset:0;z-index:12;display:flex;overflow:auto;padding:18px;' +
      'background:radial-gradient(ellipse at center,rgba(5,6,15,.78),rgba(5,6,15,.96));}' +
      '.qs-end__in{margin:auto;width:min(620px,100%);text-align:center;color:#f4f6fb;}' +
      '.qs-end__stamp{font-size:clamp(20px,5.6vw,42px);line-height:1.3;color:#34d399;text-shadow:5px 5px 0 #05060f;transform:rotate(-3deg);}' +
      '.qs-end__cite{margin:18px 0 20px;font-size:8px;line-height:2;color:#9aa3b8;}' +
      '.qs-end__stats{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 22px;margin-bottom:20px;}' +
      '.qs-end__stats span{display:flex;flex-direction:column;gap:8px;font-size:7px;color:#9aa3b8;}' +
      '.qs-end__stats b{font-size:13px;font-weight:400;color:#fcd34d;text-shadow:2px 2px 0 #05060f;}' +
      '.qs-end__quip{margin:0 0 10px;font-size:9px;line-height:2.1;}' +
      '.qs-end__dim{color:#9aa3b8;}' +
      '.qs-end__links{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:20px 0 18px;}' +
      '.qs-end__links a{font-size:8px;line-height:1.6;color:#6ee7ff;text-decoration:none;border:2px solid #6ee7ff;padding:9px 10px;}' +
      '.qs-end__links a:hover,.qs-end__links a:focus{background:#6ee7ff;color:#05060f;}' +
      '.qs-end__btns{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;}' +
      '.qs-end__btns button{font:inherit;font-family:' + FONT + ';font-size:10px;color:#11131c;background:#fcd34d;' +
      'border:2px solid #05060f;box-shadow:4px 4px 0 #05060f;padding:13px 14px;cursor:pointer;}' +
      '.qs-end__btns button:active{transform:translate(2px,2px);box-shadow:2px 2px 0 #05060f;}';

    var raf = 0, lastT = 0, acc = 0, STEP = 1 / 60, MAXSTEP = 40, frameN = 0, lastCW = 0, lastCH = 0;
    var autoPaused = false, crashed = false, released = false, scrollY0 = 0, bodySave = null, htmlSave = '';
    var spritesBuilt = false, pFont = 0, tgtName = '', tgtLines = null, sayKey = '', sayPanel = null;
    var STAGE_NAME = ['', 'COPYEDITING', 'PROOFS / PRODUCTION'];
    var LEGEND = ['Z/SPC  FIRE', 'HOLD   LASER', 'X      BOMB', 'SHIFT  FOCUS', 'P/ESC  PAUSE', 'M      MUSIC'];

    function oops(err) { if (!crashed) { crashed = true; try { console.error('shmup: ', err); } catch (e) {} } }
    function nowSec() { return (window.performance && performance.now ? performance.now() : Date.now()) / 1000; }
    function tscale() { var p = api.params, t = p && p.timescale ? p.timescale : 1; return t > 0 ? t : 1; }

    /* full-viewport mode: the portrait playfield needs the whole phone, and the page must not scroll under it */
    function applyFixed(on) {
      on = !!on;
      if (on === fixedOn || !overlay) return;
      fixedOn = on;
      var b = document.body.style;
      if (on) {
        scrollY0 = window.pageYOffset || document.documentElement.scrollTop || 0;
        bodySave = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
        htmlSave = document.documentElement.style.overflow;
        b.position = 'fixed'; b.top = (-scrollY0) + 'px'; b.left = '0'; b.right = '0'; b.width = '100%'; b.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        overlay.className = 'qs-ov is-fixed';
      } else {
        overlay.className = 'qs-ov';
        if (bodySave) { b.position = bodySave.position; b.top = bodySave.top; b.left = bodySave.left; b.right = bodySave.right; b.width = bodySave.width; b.overflow = bodySave.overflow; bodySave = null; }
        document.documentElement.style.overflow = htmlSave || '';
        try { window.scrollTo(0, scrollY0); } catch (e) {}
      }
    }
    function setFixed(on) { released = !on; applyFixed(!!on); layout(); }

    function buildDom() {
      if (!document.getElementById('qs-style')) {
        styleEl = document.createElement('style'); styleEl.id = 'qs-style'; styleEl.textContent = CSS;
        (document.head || document.documentElement).appendChild(styleEl);
      } else styleEl = document.getElementById('qs-style');
      overlay = document.createElement('div'); overlay.className = 'qs-ov';
      overlay.setAttribute('role', 'application'); overlay.setAttribute('aria-label', 'Publish or Perish: a bullet-hell shooter');
      scr = document.createElement('canvas'); scr.setAttribute('tabindex', '0'); overlay.appendChild(scr);
      sx = scr.getContext('2d', { alpha: false });
      if (!pf) pf = mk(W, H);
      g = pf.getContext('2d'); g.imageSmoothingEnabled = false; gFont = 0;
      bombBtn = document.createElement('button'); bombBtn.type = 'button'; bombBtn.className = 'qs-btn'; bombBtn.textContent = 'BOMB';
      bombBtn.setAttribute('aria-label', 'Use a bomb');
      pauseBtn = document.createElement('button'); pauseBtn.type = 'button'; pauseBtn.className = 'qs-btn'; pauseBtn.textContent = '❚❚';
      pauseBtn.setAttribute('aria-label', 'Pause');
      overlay.appendChild(bombBtn); overlay.appendChild(pauseBtn);
      bombBtn.addEventListener('pointerdown', btnBomb); pauseBtn.addEventListener('pointerdown', btnPause);
      bombBtn.addEventListener('click', swallow); pauseBtn.addEventListener('click', swallow);
      (api.view || api.root || document.body).appendChild(overlay);
    }
    function swallow(e) { e.preventDefault(); e.stopPropagation(); }
    function btnBomb(e) { swallow(e); if (G && G.mode === 'play' && !G.paused) useBomb(); }
    function btnPause(e) { swallow(e); if (!G) return; if (G.mode === 'continue' || G.mode === 'gameover') doContinue(); else setPaused(!G.paused); }

    /* one screen canvas, the logical playfield blown up with nearest-neighbour, panels either side */
    function layout() {
      if (!overlay || !scr) return;
      var want = self.active && !released && (window.innerWidth || 1024) < 700;
      if (want !== fixedOn) applyFixed(want);
      var cw = Math.max(120, overlay.clientWidth || 320), ch = Math.max(120, overlay.clientHeight || 240);
      lastCW = cw; lastCH = ch;
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      scrW = Math.round(cw * dpr); scrH = Math.round(ch * dpr);
      if (scr.width !== scrW) scr.width = scrW;
      if (scr.height !== scrH) scr.height = scrH;
      scr.style.width = '100%'; scr.style.height = '100%';
      pFont = 0; sx.textBaseline = 'top';
      var panelMin = Math.round(104 * dpr), padY = Math.round(6 * dpr);
      narrow = fixedOn || cw < 620 || (scrW - 2 * panelMin) / W < (scrH - 2 * padY) / H * 0.62;
      var availH = scrH - (narrow ? 0 : 2 * padY), availW = narrow ? scrW : scrW - 2 * panelMin;
      var u = Math.min(availH / H, availW / W), iu = Math.floor(u);
      U = (iu >= 1 && iu / u > (narrow ? 0.96 : 0.86)) ? iu : u;     // integer scale when it costs almost nothing
      pfW = Math.round(W * U); pfH = Math.round(H * U);
      pfX = Math.round((scrW - pfW) / 2);
      pfY = Math.round((scrH - pfH) * (narrow && scrH - pfH > 40 * dpr ? 0.34 : 0.5));   // on a phone, leave the thumbs some room
      bandSay = narrow && (scrH - pfY - pfH) > 52 * dpr;      // a taunt over the playfield is a taunt over a bullet
      placeButtons();
    }
    function placeButtons() {
      if (!bombBtn) return;
      var x = pfX / dpr, y = pfY / dpr, w = pfW / dpr, h = pfH / dpr, band = (scrH - pfY - pfH) / dpr;
      var s = narrow ? 64 : 46, fs = narrow ? 10 : 8, below = narrow && band > s + 20;
      bombBtn.style.width = s + 'px'; bombBtn.style.height = s + 'px'; bombBtn.style.borderRadius = '50%'; bombBtn.style.fontSize = fs + 'px';
      bombBtn.style.left = Math.round(x + w - s - (below ? 18 : 10)) + 'px';
      bombBtn.style.top = Math.round(below ? y + h + (band - s) / 2 : y + h - s - (narrow ? 38 : 14)) + 'px';
      pauseBtn.style.width = '34px'; pauseBtn.style.height = '28px'; pauseBtn.style.fontSize = '9px'; pauseBtn.style.borderRadius = '0';
      if (narrow) { pauseBtn.style.left = Math.round(pfY / dpr > 34 ? x + w - 34 : x + w - 44) + 'px'; pauseBtn.style.top = Math.round(pfY / dpr > 34 ? y - 32 : y + 40) + 'px'; }
      else { pauseBtn.style.left = Math.round(scrW / dpr - 46) + 'px'; pauseBtn.style.top = '10px'; }   // out in the bezel, clear of the boss bar
    }
    function checkSize() {
      if (!overlay) return;
      if (overlay.clientWidth !== lastCW || overlay.clientHeight !== lastCH) layout();
    }

    /* ------------------------------------------------------------ the bezel panels (wide screens only) */
    function ptxt(s, x, y, size, col, align) {
      if (pFont !== size) { sx.font = size + 'px ' + FONT; pFont = size; }
      sx.textAlign = align || 'left';
      var o = Math.max(1, (size / 9) | 0);
      sx.fillStyle = '#05060f'; sx.fillText(s, x + o, y + o);
      sx.fillStyle = col; sx.fillText(s, x, y);
    }
    function pips(x, y, n, max, w, h, col) {
      for (var k = 0; k < max; k++) { sx.fillStyle = k < n ? col : 'rgba(244,246,251,.14)'; sx.fillRect(x + k * Math.round(w * 1.4), y, w, h); }
    }
    function icons(img, x, y, n, max, s) {
      for (var k = 0; k < Math.min(n, max); k++) sx.drawImage(img, x + k * (img.width + 3) * s, y, img.width * s, img.height * s);
      if (n > max) ptxt('+' + (n - max), x + max * (img.width + 3) * s + 2, y, Math.max(7, s * 5), '#9aa3b8');
    }
    function panelFrame(x, w, pad) {
      sx.fillStyle = '#0b0f1c'; sx.fillRect(x + pad, pad, w - pad * 2, scrH - pad * 2);
      sx.fillStyle = '#1b2238'; sx.fillRect(x + pad, pad, w - pad * 2, Math.max(2, (dpr * 2) | 0));
      sx.fillStyle = '#141a2c'; sx.fillRect(x + pad, scrH - pad - Math.max(2, (dpr * 2) | 0), w - pad * 2, Math.max(2, (dpr * 2) | 0));
    }
    function drawPanels() {
      var k, i, e, pad = Math.round(8 * dpr), LW = pfX, RX = pfX + pfW, RW = scrW - RX;
      var fr = ((G.t * 6) | 0) % 2;
      var fs = clamp(Math.round(Math.min(LW, RW) / 22), Math.round(7 * dpr), Math.round(13 * dpr));
      var fl = Math.max(Math.round(fs * 0.78), 7), fv = Math.round(fs * 1.7), lh = Math.round(fs * 1.5), si = Math.max(1, Math.round(fs / 4));
      var x, y;

      /* ---- left: the score plate */
      panelFrame(0, LW, pad);
      x = pad * 2; y = pad * 3;
      ptxt('PUBLISH', x, y, fs, '#fcd34d'); y += lh;
      ptxt('OR PERISH', x, y, fs, '#fb7185'); y += Math.round(lh * 1.9);
      ptxt('1P SCORE', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      ptxt(fmt(G.score), x, y, fv, '#ffffff'); y += Math.round(fv * 1.6);
      ptxt('HI-SCORE', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      ptxt(fmt(G.hi), x, y, fs, '#fcd34d'); y += Math.round(lh * 1.8);
      ptxt('STAGE ' + G.stage, x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.7);
      ptxt(STAGE_NAME[G.stage] || '', x, y, fl, '#8ad4ff'); y += Math.round(lh * 1.7);
      ptxt('HIT CHAIN', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      ptxt(G.chain > 0 ? G.chain + ' HIT' : '-', x, y, fs, G.chain > 0 ? (G.gauge < 0.3 && fr ? '#ffffff' : '#fcd34d') : '#4a5470'); y += Math.round(fs * 1.5);
      sx.fillStyle = '#11131c'; sx.fillRect(x, y, LW - pad * 4, Math.max(4, si * 3));
      sx.fillStyle = G.gauge < 0.3 && fr ? '#ffffff' : '#34d399';
      sx.fillRect(x + 1, y + 1, Math.max(0, (LW - pad * 4 - 2) * clamp(G.gauge, 0, 1)) | 0, Math.max(2, si * 3 - 2));
      y += Math.round(lh * 1.7);
      ptxt('CITATIONS', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      ptxt(fmt(G.cites), x, y, fs, '#fcd34d'); y += Math.round(lh * 1.8);
      ptxt('MAX CHAIN', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      ptxt(G.maxChain + ' HIT', x, y, fs, '#9aa3b8'); y += Math.round(lh * 1.9);
      /* nearest thing worth shooting, named */
      var best = null, bs = -1;
      for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && e.def && e.y > -e.hh && e.def.score > bs) { bs = e.def.score; best = e; } }
      ptxt('TARGET', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      var nm = best ? best.def.name : '';
      if (nm !== tgtName) { tgtName = nm; tgtLines = nm ? wrap(nm, Math.max(8, Math.floor((LW - pad * 4) / fl))) : null; }
      if (tgtLines) for (k = 0; k < Math.min(3, tgtLines.length); k++) ptxt(tgtLines[k], x, y + k * Math.round(fl * 1.5), fl, '#f4f6fb');
      else ptxt('-', x, y, fl, '#4a5470');
      y = scrH - pad * 3 - Math.round(fl * 1.4);
      ptxt('CREDIT ' + Math.max(0, 99 - G.continues), x, y, fl, ((G.t * 2) | 0) % 2 ? '#34d399' : '#1f8a60');

      /* ---- right: the ship plate */
      panelFrame(RX, RW, pad);
      x = RX + pad * 2; y = pad * 3;
      ptxt('SHIPS', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.9);
      if (G.lives > 0) icons(ICON.life, x, y, G.lives, 5, si); else ptxt('LAST ONE', x, y, fl, '#ff6b7a');
      y += ICON.life.height * si + Math.round(fl * 1.6);
      ptxt('BOMBS', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.9);
      if (G.bombs > 0) icons(ICON.bomb, x, y, G.bombs, 5, si); else ptxt('NONE', x, y, fl, '#ff6b7a');
      y += ICON.bomb.height * si + Math.round(fl * 1.9);
      ptxt('WEAPON', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      var wl = wrapW(WEAP[G.weapon].name, Math.max(8, Math.floor((RW - pad * 4) / fl)));
      for (k = 0; k < wl.length; k++) ptxt(wl[k], x, y + k * Math.round(fl * 1.5), fl, WEAP[G.weapon].col);
      y += Math.round(fl * 1.5) * wl.length + Math.round(fl * 0.8);
      ptxt('POWER', x, y, fl, '#9aa3b8'); pips(x + Math.round(fl * 6.4), y, G.level, 4, Math.max(4, si * 4), Math.max(4, fl), '#fb923c'); y += Math.round(fl * 1.9);
      ptxt('SPEED', x, y, fl, '#9aa3b8'); pips(x + Math.round(fl * 6.4), y, G.speed + 1, 4, Math.max(4, si * 4), Math.max(4, fl), '#8ad4ff'); y += Math.round(fl * 2.4);
      /* who is talking */
      if (G.sayT > 0 && G.say) {
        if (sayKey !== G.say) { sayKey = G.say; sayPanel = wrap(G.say, Math.max(9, Math.floor((RW - pad * 4) / fl))); }
        sx.fillStyle = 'rgba(5,6,15,.6)'; sx.fillRect(x - pad, y - pad, RW - pad * 2, Math.round(fl * 1.5) * (sayPanel.length + 1) + pad * 2);
        ptxt(G.who, x, y, fl, '#fcd34d'); y += Math.round(fl * 1.7);
        var n = Math.floor(G.sayN);
        for (k = 0; k < sayPanel.length && n > 0; k++) { ptxt(sayPanel[k].slice(0, n), x, y, fl, '#f4f6fb'); n -= sayPanel[k].length; y += Math.round(fl * 1.5); }
      }
      /* controls, down at the bottom of the bezel */
      y = scrH - pad * 3 - Math.round(fl * 1.5) * LEGEND.length;
      for (k = 0; k < LEGEND.length; k++) ptxt(LEGEND[k], x, y + k * Math.round(fl * 1.5), fl, k === 0 || k === 1 ? '#9aa3b8' : '#5c6b85');
    }
    var wrapCache = {}, wrapCacheN = 0;
    function wrapW(text, max) {                                            // wrap(), but memoised: the panel redraws 60 times a second
      var key = max + '|' + text, v = wrapCache[key];
      if (v) return v;
      if (wrapCacheN > 60) { wrapCache = {}; wrapCacheN = 0; }
      wrapCacheN++; return (wrapCache[key] = wrap(text, max));
    }

    /* ------------------------------------------------------------ compose the cabinet */
    function compose() {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.imageSmoothingEnabled = false; sx.textBaseline = 'top';
      sx.fillStyle = '#080a14'; sx.fillRect(0, 0, scrW, scrH);
      if (!narrow && pfX > 40) { try { drawPanels(); } catch (e) { oops(e); narrow = true; } }
      sx.drawImage(pf, 0, 0, W, H, pfX, pfY, pfW, pfH);
      var b = Math.max(2, (dpr * 2) | 0);
      sx.fillStyle = '#1b2238';
      sx.fillRect(pfX - b, pfY - b, pfW + b * 2, b); sx.fillRect(pfX - b, pfY + pfH, pfW + b * 2, b);
      sx.fillRect(pfX - b, pfY, b, pfH); sx.fillRect(pfX + pfW, pfY, b, pfH);
      if (G.flash > 0.004) { sx.globalAlpha = Math.min(1, G.flash); sx.fillStyle = '#ffffff'; sx.fillRect(pfX, pfY, pfW, pfH); sx.globalAlpha = 1; }
      if (bandSay && G.sayT > 0 && G.sayLines) {
        var fb = Math.max(8, Math.round(9 * dpr)), yb = pfY + pfH + Math.round(14 * dpr), nb = Math.floor(G.sayN), kb;
        ptxt(G.who, Math.round(12 * dpr), yb, fb, '#fcd34d', 'left'); yb += Math.round(fb * 1.9);
        for (kb = 0; kb < G.sayLines.length && nb > 0; kb++) { ptxt(G.sayLines[kb].slice(0, nb), Math.round(12 * dpr), yb, fb, '#f4f6fb', 'left'); nb -= G.sayLines[kb].length; yb += Math.round(fb * 1.5); }
      }
      if (G.wipe > 0.004) { sx.globalAlpha = Math.min(1, G.wipe); sx.fillStyle = '#ffffff'; sx.fillRect(0, 0, scrW, scrH); sx.globalAlpha = 1; }
    }

    /* ------------------------------------------------------------ the frame driver */
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!self.active || !G || !scr) return;
      if (document.hidden) { lastT = 0; return; }                           // nothing animates in a tab nobody is looking at
      var dtr = lastT ? (ts - lastT) / 1000 : 0; lastT = ts;
      if (!(dtr > 0)) dtr = 0; else if (dtr > 0.1) dtr = 0.1;
      if ((frameN++ % 12) === 0) { checkVis(); checkSize(); }
      if (G.wipe > 0) G.wipe = Math.max(0, G.wipe - dtr * 1.3);
      if (!G.paused) {
        acc += dtr * tscale();
        var n = 0;
        while (acc >= STEP && n < MAXSTEP) { acc -= STEP; n++; try { step(STEP); } catch (err) { oops(err); acc = 0; break; } }
        if (acc > 0.75) acc = 0;
      } else acc = 0;
      try { drawField(); compose(); } catch (err) { oops(err); }
    }
    function setPaused(v) {
      if (!G || G.mode === 'ending') return;
      v = !!v; if (v === G.paused) return;
      G.paused = v; autoPaused = false; sfx.pause();
    }
    function checkVis() {                                                   // a game nobody is looking at should not run
      if (!G || G.mode === 'ending') return;
      var gone = !!document.hidden;
      if (!gone && !fixedOn && api.root && api.root.getBoundingClientRect) {
        var r = api.root.getBoundingClientRect(), vh = window.innerHeight || 800;
        var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        gone = vis < Math.min(r.height, vh) * 0.35;
      }
      if (gone && !G.paused) { G.paused = true; autoPaused = true; }
      else if (!gone && G.paused && autoPaused) { G.paused = false; autoPaused = false; }
    }

    /* ------------------------------------------------------------ input */
    var MOVEK = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
    var FIREK = { KeyZ: 1, Space: 1, KeyJ: 1 }, BOMBK = { KeyX: 1, KeyK: 1, KeyB: 1 };
    function onKey(e) {
      if (!self.active || !G) return;
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var down = e.type === 'keydown', c = e.code, used = true;
      if (MOVEK[c]) keys[MOVEK[c]] = down;
      else if (FIREK[c]) { keys.fire = down; if (down && !e.repeat) firePressed(); }
      else if (BOMBK[c]) { if (down && !e.repeat && !G.paused) useBomb(); }
      else if (c === 'ShiftLeft' || c === 'ShiftRight') keys.focus = down;
      else if (c === 'KeyP' || c === 'Escape') { if (down && !e.repeat) { if (G.mode === 'continue' || G.mode === 'gameover') doContinue(); else setPaused(!G.paused); } }
      else if (c === 'KeyM') { if (down && !e.repeat) toggleMusic(); }
      else used = false;
      if (used) { e.preventDefault(); }                                     // the page must not scroll under the shooter
    }
    function firePressed() {
      if (G.mode === 'continue' || G.mode === 'gameover') { doContinue(); return; }
      if (G.paused) return;
      if (G.mode === 'play' && P.dead <= 0) P.shotT = 0.04;                 // a tap always spits one volley
    }
    function toggleMusic() {
      try {
        var on = !api.musicWanted();
        api.setMusicWanted(on);
        if (on) api.music('space');
        floatText(on ? 'MUSIC ON' : 'MUSIC OFF', W / 2, H - 140, '#8ad4ff');
      } catch (e) {}
    }
    function ptDown(e) {
      if (!self.active || !G) return;
      var t = e.target;
      if (t !== scr && t !== overlay) return;                               // the buttons and the ending screen look after themselves
      e.preventDefault();
      try { scr.focus(); } catch (err) {}
      if (G.mode === 'ending') return;
      if (G.paused) { setPaused(false); return; }
      if (G.mode === 'continue' || G.mode === 'gameover') { doContinue(); return; }
      if (touch.id === -1) {
        touch.id = e.pointerId; touch.on = true; touch.lx = e.clientX; touch.ly = e.clientY; touch.t0 = nowSec(); touch.count = 1;
        try { scr.setPointerCapture(e.pointerId); } catch (err) {}
      } else { touch.count++; useBomb(); }                                  // second finger down: bomb
    }
    function ptMove(e) {
      if (!self.active || !G || e.pointerId !== touch.id) return;
      var k = pfW > 0 ? (W * dpr / pfW) : 1;
      if (G.mode === 'play' && P.dead <= 0) {
        P.x = clamp(P.x + (e.clientX - touch.lx) * k, 9, W - 9);
        P.y = clamp(P.y + (e.clientY - touch.ly) * k, 18, H - 12);
      }
      touch.lx = e.clientX; touch.ly = e.clientY;
      e.preventDefault();
    }
    function ptUp(e) {
      if (e.pointerId !== touch.id) { if (touch.count > 1) touch.count--; return; }
      touch.id = -1; touch.on = false; touch.count = 0;
    }
    function onBlur() { keys.l = keys.r = keys.u = keys.d = keys.fire = keys.focus = false; touch.on = false; touch.id = -1; touch.count = 0; }
    function onVis() { if (document.hidden) { onBlur(); if (G && !G.paused && G.mode !== 'ending') { G.paused = true; autoPaused = true; } } lastT = 0; }
    function onResize() { layout(); }
    function onScroll() { checkVis(); }                                     // scrolled away mid-fight? pause at once, do not wait for a frame

    function listen(on) {
      var m = on ? 'addEventListener' : 'removeEventListener';
      window[m]('keydown', onKey, true); window[m]('keyup', onKey, true);
      window[m]('blur', onBlur); window[m]('resize', onResize); window[m]('orientationchange', onResize);
      window[m]('scroll', onScroll, { passive: true });
      window[m]('pointermove', ptMove, { passive: false }); window[m]('pointerup', ptUp); window[m]('pointercancel', ptUp);
      document[m]('visibilitychange', onVis);
      if (overlay) overlay[m]('pointerdown', ptDown, { passive: false });
      if (overlay) overlay[m]('contextmenu', swallow);
    }

    /* ------------------------------------------------------------ test hooks: ?shmupstage=2|mid|boss|ending  ?shmupgod=1 */
    function applyJump() {
      if (!JUMP) return;
      if (JUMP === '2') { G.stage = 2; G.script = STAGE2; G.si = 0; G.st = 0; G.level = 2; G.speed = 1; }
      else if (JUMP === 'mid') {
        G.st = 59.9; G.si = 0; G.level = 3; G.speed = 1;
        while (G.si < STAGE1.length && STAGE1[G.si][0] <= G.st) G.si++;
      } else if (JUMP === 'boss') {
        G.stage = 2; G.script = STAGE2; G.si = STAGE2.length; G.st = 0; G.level = 4; G.speed = 2; G.bombs = 3;
        G.hold = true; G.warnT = 4.4; sfx.klaxon(); api.music('silence');
      } else if (JUMP === 'ending') {
        G.score = 1284730; G.hi = Math.max(G.hi, G.score); G.maxChain = 412; G.cites = 933; G.continues = 2; G.stage = 2;
        showEnding();
      }
    }

    /* ------------------------------------------------------------ start / stop */
    function start(opts) {
      if (self.active) return;
      try {
        crashed = false; released = false; autoPaused = false;
        if (!spritesBuilt) { buildSprites(); spritesBuilt = true; }
        audioInit();
        buildDom();
        newGame();
        for (var i = 0; i < NSTAR; i++) { stx[i] = Math.random() * W; sty[i] = Math.random() * H; stl[i] = i % 5 === 0 ? 2 : i % 2; }
        G.wipe = 1; G.flash = 0;                                            // the boss cinematic hands over on a white flash
        self.active = true;
        listen(true);
        layout();
        applyJump();
        sfx.start();
        if (G.mode === 'play' && G.warnT <= 0) api.music('space');
        lastT = 0; acc = 0; frameN = 0;
        raf = requestAnimationFrame(frame);
        try { scr.focus(); } catch (e) {}
      } catch (err) { oops(err); try { stop(); } catch (e) {} }
    }
    function stop() {
      self.active = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      listen(false);
      applyFixed(false);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      overlay = styleEl = scr = sx = g = endEl = bombBtn = pauseBtn = null;
      try { if (out) out.disconnect(); } catch (e) {}
      out = null; gates = {};                                               // the AudioContext belongs to the host: never close it
      try { clearPools(); } catch (e) {}
      G = null; tgtName = ''; tgtLines = null; sayKey = ''; sayPanel = null; released = false;
    }

    return self;
  };
})();
