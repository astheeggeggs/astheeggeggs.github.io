/* =============================================================================
   INTRO.JS — "PALMER'S PROGRESS" title screen.
   An arcade cabinet's rhythm, set in Oxford at night: a silent looping attract
   with the logo over a parallax skyline; the first click is the coin (the host
   starts the title theme), the frame flashes white and the logo slams back in
   over the title card — THE ROAD TO PUBLICATION, PRESS START, one credit; the
   second click starts the game, but only once the prompt is fully in: a
   double-click or a held key lands on the card, never through it. In loop 2
   the card reads SECOND LOOP · MASTER QUEST and the cabinet is on its second
   credit. stop() frees every canvas; a later start() rebuilds from scratch.

   Mega Drive discipline: ONE 320x224 offscreen buffer blitted up with
   imageSmoothingEnabled = false; every channel snapped to 0/36/73/109/146/182/
   219/255; 4x4 ordered dithering, never gradients; integer pixel positions;
   everything procedural, no external assets. Plain ES5.

   The attract loops every 12 s, pixel-perfect at both ends: the camera sway,
   the twinkle and every neon flicker are 12 s harmonics.
   ============================================================================= */
(function () {
  'use strict';

  window.QuestIntro = function (api) {

    /* ---------------------------------------------------------------- constants */
    var VW = 320, VH = 224;                    // the Mega Drive frame
    var FONT = '"Press Start 2P", monospace';
    var LOOP = 12;                             // the attract loop, seconds
    var CARD_CAM = 170;                        // the title card's camera: the Radcliffe Camera dead centre under the logo
    var LOOP2 = !!(api && api.params && api.params.loop === 2);

    /* ---------------------------------------------------------------- 9-bit palette */
    var LV = [0, 36, 73, 109, 146, 182, 219, 255];
    function q(v) { var i = Math.round(v / 255 * 7); return LV[i < 0 ? 0 : i > 7 ? 7 : i]; }
    function hex2(n) { var s = n.toString(16); return s.length < 2 ? '0' + s : s; }
    function S(r, g, b) { return '#' + hex2(q(r)) + hex2(q(g)) + hex2(q(b)); }

    var C = {
      black:  S(0, 0, 0),
      sky0:   S(0, 0, 36),    sky1:  S(36, 0, 73),   sky2:  S(73, 0, 73),
      skyA:   S(0, 0, 73),    skyB:  S(36, 0, 109),
      sky3:   S(109, 36, 73), sky4:  S(146, 73, 73), sky5:  S(182, 109, 73),
      star:   S(219, 219, 255), starD: S(146, 146, 182),
      moon:   S(255, 255, 219), moonD: S(219, 219, 182), moonS: S(182, 182, 146),
      far0:   S(36, 36, 73),  far1:  S(73, 73, 109),  far2: S(109, 109, 146),
      stoneL: S(182, 146, 109), stoneM: S(146, 109, 73), stoneD: S(109, 73, 73),
      stoneN: S(73, 73, 109),   stoneE: S(219, 182, 146),
      roofD:  S(73, 36, 73),
      win:    S(255, 219, 146), winM: S(255, 182, 73), winD: S(219, 146, 36),
      near0:  S(0, 0, 36),    near1: S(36, 36, 73),   near2: S(73, 36, 73),
      road0:  S(36, 36, 73),  road1: S(73, 73, 109),  road2: S(0, 0, 36),
      lampW:  S(255, 219, 146), lampG: S(255, 182, 109),
      neonC:  S(73, 219, 255), neonM: S(255, 73, 182), neonG: S(73, 255, 146),
      neonA:  S(255, 182, 36), neonR: S(255, 0, 36),
      steelD: S(36, 36, 36),
      red1:   S(182, 0, 36),  ember: S(255, 109, 0),
      white:  S(255, 255, 255), grey: S(182, 182, 182), greyD: S(109, 109, 109),
      gold:   S(255, 219, 73)
    };

    /* ---------------------------------------------------------------- 4x4 ordered dither */
    var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.imageSmoothingEnabled = false; return c; }
    var patCache = {};
    // a 4x4 repeating pattern of `col` covering the `lvl` (0..16) darkest Bayer cells
    function pat(ctx, col, lvl) {
      if (lvl <= 0) return null;
      var k = col + '|' + lvl, p = patCache[k];
      if (!p) {
        var c = mk(4, 4), x = c.getContext('2d');
        x.fillStyle = col;
        for (var i = 0; i < 16; i++) if (BAYER[i] < lvl) x.fillRect(i % 4, (i / 4) | 0, 1, 1);
        p = patCache[k] = c;
      }
      var pc = ctx.__pc || (ctx.__pc = {});                 // one CanvasPattern per context, reused every frame
      return pc[k] || (pc[k] = ctx.createPattern(p, 'repeat'));
    }
    // stipple `col` over a rect at coverage 0..1
    function stip(ctx, col, a, x0, y0, w, h) {
      var lvl = Math.round(a * 16); if (lvl <= 0) return;
      if (lvl >= 16) { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); return; }
      var p = pat(ctx, col, lvl); if (!p) return;
      ctx.fillStyle = p; ctx.fillRect(x0, y0, w, h);
    }
    // a dithered two-colour vertical ramp, drawn straight into ctx
    function ramp(ctx, x0, y0, w, h, cols) {
      var n = cols.length - 1, i, seg = h / n;
      for (i = 0; i < n; i++) {
        var a = Math.round(y0 + i * seg), b = Math.round(y0 + (i + 1) * seg), y;
        ctx.fillStyle = cols[i]; ctx.fillRect(x0, a, w, b - a);
        for (y = a; y < b; y++) stip(ctx, cols[i + 1], (y - a) / (b - a), x0, y, w, 1);
      }
    }
    function R(ctx, col, x, y, w, h) { if (w > 0 && h > 0) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); } }

    /* ---------------------------------------------------------------- Press Start 2P, thresholded to 1-bit masks */
    var maskCache = {}, tintCache = {};
    function maskOf(str, size) {
      var k = str + '|' + size, m = maskCache[k];
      if (m) return m;
      var w = Math.max(1, Math.round(str.length * size)), h = size + Math.ceil(size * 0.6);
      // a CPU-backed scratch canvas: a readback from a GPU one stalls for tens of ms per string
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.font = size + 'px ' + FONT; x.textBaseline = 'top'; x.fillStyle = '#fff';
      x.fillText(str, 0, 0);
      var d, bits = new Uint8Array(w * h), any = 0;
      try { d = x.getImageData(0, 0, w, h).data; } catch (e) { d = null; }
      if (d) for (var i = 0, n = w * h; i < n; i++) { if (d[i * 4 + 3] > 110) { bits[i] = 1; any++; } }
      m = maskCache[k] = { w: w, h: h, bits: bits, any: any };
      return m;
    }
    function tinted(str, size, col) {
      var k = str + '|' + size + '|' + col, c = tintCache[k];
      if (c) return c;
      var m = maskOf(str, size), cv = mk(m.w, m.h), x = cv.getContext('2d');
      var img = x.createImageData(m.w, m.h), p = img.data, n = m.w * m.h, i;
      var r = parseInt(col.substr(1, 2), 16), g = parseInt(col.substr(3, 2), 16), b = parseInt(col.substr(5, 2), 16);
      for (i = 0; i < n; i++) if (m.bits[i]) { p[i * 4] = r; p[i * 4 + 1] = g; p[i * 4 + 2] = b; p[i * 4 + 3] = 255; }
      x.putImageData(img, 0, 0);
      return (tintCache[k] = cv);
    }
    function clearText() { maskCache = {}; tintCache = {}; }
    function txtW(str, size) { return str.length * size; }
    // draw text at integer pixels; a<1 dissolves it through the Bayer grid
    function text(ctx, str, x, y, size, col, a) {
      x = Math.round(x); y = Math.round(y);
      if (a === undefined) a = 1;
      if (a <= 0) return;
      if (a >= 1) { ctx.drawImage(tinted(str, size, col), x, y); return; }
      var m = maskOf(str, size), lvl = Math.round(a * 16);
      ctx.fillStyle = col;
      for (var j = 0; j < m.h; j++) for (var i = 0; i < m.w; i++)
        if (m.bits[j * m.w + i] && BAYER[((y + j) & 3) * 4 + ((x + i) & 3)] < lvl) ctx.fillRect(x + i, y + j, 1, 1);
    }
    // text with a 1px hard outline, for anything sitting over the city
    function textO(ctx, str, x, y, size, col, out, a) {
      var d = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]], i;
      for (i = 0; i < 8; i++) text(ctx, str, x + d[i][0], y + d[i][1], size, out, a);
      text(ctx, str, x, y, size, col, a);
    }
    function textOC(ctx, str, cx, y, size, col, out, a) { textO(ctx, str, Math.round(cx - txtW(str, size) / 2), y, size, col, out, a); }

    /* ---------------------------------------------------------------- shading helpers */
    function ditherPick(rampA, t, x, y) {
      var n = rampA.length - 1, f = t * n, i = Math.floor(f);
      if (i < 0) return rampA[0];
      if (i >= n) return rampA[n];
      return (BAYER[((y & 3) << 2) + (x & 3)] / 16 < (f - i)) ? rampA[i + 1] : rampA[i];
    }
    var STONE = [C.stoneN, C.stoneD, C.stoneM, C.stoneL, C.stoneE];
    var FARR = [C.far0, C.far1, C.far2];
    function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

    // a stone mass: lit from the upper left, dithered across three faces
    function mass(x, x0, y0, w, h, lo, hi) {
      lo = lo === undefined ? 0.28 : lo; hi = hi === undefined ? 0.86 : hi;
      for (var i = 0; i < w; i++) {
        var nx = w > 1 ? i / (w - 1) : 0, t = hi - (hi - lo) * nx;
        for (var j = 0; j < h; j++) {
          var tt = t * (1 - 0.30 * (j / Math.max(1, h)));
          R(x, ditherPick(STONE, tt, x0 + i, y0 + j), x0 + i, y0 + j, 1, 1);
        }
      }
      R(x, C.stoneE, x0, y0, w, 1);                       // moonlit top edge
      R(x, C.black, x0 + w - 1, y0, 1, h);                // hard right shadow
    }
    function halfDome(x, cx, ybase, rx, ry, ogee) {
      for (var i = -rx; i <= rx; i++) for (var j = -ry; j <= 0; j++) {
        var u = i / rx, v = j / ry, d = ogee ? Math.pow(Math.abs(u), 1.7) + Math.pow(Math.abs(v), 2.6) : u * u + v * v;
        if (d > 1) continue;
        var t = 0.86 - 0.60 * (u + 1) / 2 - 0.10 * (1 + v);
        R(x, ditherPick(STONE, t, cx + i, ybase + j), cx + i, ybase + j, 1, 1);
      }
    }
    function pinnacle(x, px, ybase, h) {
      R(x, C.stoneM, px, ybase - h, 2, h);
      R(x, C.stoneL, px, ybase - h, 1, h);
      R(x, C.stoneE, px, ybase - h - 2, 2, 2);
      R(x, C.black, px + 2, ybase - h, 1, h);
    }
    function crenel(x, x0, y0, w, step) {
      for (var i = 0; i < w; i += step) { R(x, C.stoneL, x0 + i, y0 - 3, Math.min(step - 2, w - i), 3); R(x, C.black, x0 + i + Math.min(step - 2, w - i), y0 - 3, 1, 3); }
    }
    function roofRake(x, x0, y0, w, h) {          // a pitched roof, stepped
      for (var i = 0; i < w; i++) {
        var d = Math.abs(i - (w - 1) / 2) / ((w - 1) / 2), hh = Math.round(h * (1 - d));
        R(x, i < w / 2 ? C.stoneD : C.roofD, x0 + i, y0 - hh, 1, hh + 1);
      }
    }
    function windows(x, rr, x0, y0, w, h, cw, ch, gx, gy, chance) {
      for (var wy = y0 + gy; wy + ch <= y0 + h - gy; wy += ch + gy)
        for (var wx = x0 + gx; wx + cw <= x0 + w - gx; wx += cw + gx) {
          var r = rr();
          if (r > chance) continue;
          var c = r < chance * 0.32 ? C.win : r < chance * 0.7 ? C.winM : C.winD;
          R(x, C.black, wx - 1, wy - 1, cw + 2, ch + 2);
          R(x, c, wx, wy, cw, ch);
          if (ch > 3) R(x, C.winD, wx, wy + ch - 1, cw, 1);
        }
    }
    function lancet(x, x0, y0, w, h, col) {       // a pointed gothic window
      R(x, C.black, x0 - 1, y0 - 1, w + 2, h + 2);
      R(x, col, x0, y0 + 2, w, h - 2);
      R(x, col, x0 + 1, y0, w - 2, 2);
    }

    /* ---------------------------------------------------------------- the city, built once */
    var MW = 1024, NW = 1408, SKY = null, STARS = null, MOON = null, MID = null, FAR = null, NEAR = null;
    var SIGNS = [], TWINK = [];

    function buildSky() {
      SKY = mk(VW, VH); var x = SKY.getContext('2d');
      R(x, C.sky0, 0, 0, VW, VH);
      ramp(x, 0, 0, VW, 178, [C.sky0, C.sky0, C.skyA, C.sky1, C.skyB, C.sky2, C.sky3, C.sky4]);
      for (var y = 150; y < 192; y++) stip(x, C.sky5, Math.max(0, (y - 150) / 42) * 0.92, 0, y, VW, 1);   // horizon haze
      R(x, C.sky5, 0, 192, VW, VH - 192);
    }
    function buildStars() {
      STARS = mk(MW, 150); var x = STARS.getContext('2d'), r = rng(9131), i;
      TWINK = [];
      for (i = 0; i < 300; i++) {
        var sx = (r() * MW) | 0, sy = (r() * 140) | 0, b = r();
        if (sy > 90 && r() > 0.35) continue;                       // thin them out near the haze
        R(x, b > 0.82 ? C.white : b > 0.5 ? C.star : C.starD, sx, sy, 1, 1);
        if (b > 0.94) { R(x, C.starD, sx - 1, sy, 1, 1); R(x, C.starD, sx + 1, sy, 1, 1); R(x, C.starD, sx, sy - 1, 1, 1); R(x, C.starD, sx, sy + 1, 1, 1); }
      }
      // twinkle rates are multiples of pi/6, so every star is back where it started at t = 12
      for (i = 0; i < 44; i++) TWINK.push({ x: (r() * MW) | 0, y: (r() * 92) | 0, p: r() * 6.283, s: 0.5235987756 * (3 + ((r() * 11) | 0)) });
      MOON = mk(34, 34); var m = MOON.getContext('2d');
      for (var j = 0; j < 34; j++) for (i = 0; i < 34; i++) {
        var dx = i - 17, dy = j - 17, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 12.5) R(m, ditherPick([C.moonS, C.moonD, C.moon], 1 - (dx + dy + 18) / 40, i, j), i, j, 1, 1);
        else if (d < 16.5) stip(m, C.moonS, (16.5 - d) / 4 * 0.55, i, j, 1, 1);
      }
      R(m, C.moonS, 12, 12, 4, 3); R(m, C.moonS, 19, 18, 3, 4); R(m, C.moonS, 14, 22, 5, 2); R(m, C.moonS, 21, 10, 2, 2);
    }

    /* the far layer: RECEDING DREAMING SPIRES in haze. Not one rectangular tower,
       not one needle. The depth layers have to agree with each other. */
    function buildFar() {
      FAR = mk(MW, VH); var x = FAR.getContext('2d'), r = rng(2207), j;
      var base = 156, bx = -24, col2 = FARR[2];
      while (bx < MW + 24) {
        var w = 11 + ((r() * 24) | 0), h = 7 + ((r() * 15) | 0), t = 0.20 + r() * 0.44, kind = r();
        var cx = bx + (w >> 1);
        for (j = 0; j < w; j++) R(x, ditherPick(FARR, t * (1 - j / w * 0.34), bx + j, base), bx + j, base - h, 1, h);
        R(x, ditherPick(FARR, Math.min(1, t + 0.22), cx, base), bx, base - h, w, 1);          // ridge, catching the moon
        if (kind > 0.50) {                                                                     // a crocketed spire
          var sh = 15 + ((r() * 30) | 0), sw = 4 + ((r() * 5) | 0);
          for (j = 0; j < sh; j++) {
            var ww = Math.max(1, Math.round(sw * Math.pow(1 - j / sh, 1.15)));
            R(x, ditherPick(FARR, Math.min(1, t + 0.1), cx, base), cx - (ww >> 1), base - h - j, ww, 1);
            if (j % 7 === 3 && ww > 2) { R(x, col2, cx - (ww >> 1) - 1, base - h - j, 1, 1); R(x, col2, cx + (ww >> 1), base - h - j, 1, 1); }
          }
          R(x, col2, cx, base - h - sh - 3, 1, 3);
        } else if (kind > 0.33) {                                                              // a lead cupola
          var dr = Math.max(3, (w >> 1) - 2), dw;
          for (j = 0; j <= dr; j++) { dw = Math.round(Math.sqrt(Math.max(0, dr * dr - j * j))); if (dw > 0) R(x, ditherPick(FARR, Math.min(1, t + 0.14), cx, base), cx - dw, base - h - j, dw * 2, 1); }
          R(x, col2, cx, base - h - dr - 4, 1, 4);
        } else if (kind > 0.16) {                                                              // a battlemented college tower
          var th = 11 + ((r() * 20) | 0), tw = 7 + ((r() * 4) | 0);
          for (j = 0; j < tw; j++) R(x, ditherPick(FARR, Math.min(1, t + 0.06), cx, base), cx - (tw >> 1) + j, base - h - th, 1, th);
          for (j = 0; j < tw; j += 3) R(x, col2, cx - (tw >> 1) + j, base - h - th - 2, 2, 2);
        }
        if (r() > 0.64) R(x, C.winD, bx + 2 + ((r() * Math.max(1, w - 4)) | 0), base - h + 2 + ((r() * Math.max(1, h - 3)) | 0), 1, 1);
        bx += w + 1 + ((r() * 7) | 0);
      }
      for (j = 0; j < 46; j++) stip(x, C.sky4, 1 - j / 46 * 0.88, 0, base - j, MW, 1);        // haze eats the distance
      R(x, C.sky5, 0, base, MW, 4);
    }

    function midCollege(x, r, x0, w, h, base) {
      mass(x, x0, base - h, w, h);
      crenel(x, x0, base - h, w, 6);
      windows(x, r, x0, base - h + 6, w, h - 6, 3, 5, 4, 5, 0.52);
    }
    function midTower(x, r, x0, w, h, base, pin) {
      mass(x, x0, base - h, w, h, 0.34, 0.9);
      crenel(x, x0, base - h, w, 5);
      if (pin) { pinnacle(x, x0 - 1, base - h + 2, 10); pinnacle(x, x0 + w - 2, base - h + 2, 10); }
      for (var j = 0; j < 3; j++) lancet(x, x0 + ((w >> 1) - 2), base - h + 12 + j * 16, 4, 10, j === 1 ? C.win : C.winD);
      R(x, C.black, x0, base - h + 9, w, 1); R(x, C.stoneE, x0, base - h + 10, w, 1);
    }

    function buildMid() {
      MID = mk(MW, VH); var x = MID.getContext('2d'), r = rng(4477), i, j, base = 172;
      R(x, C.black, 0, base, MW, 3);
      // --- a generic honey-stone range everywhere, then the landmarks on top
      var bx2 = 0;
      while (bx2 < MW) {
        var w = 24 + ((r() * 40) | 0), h = 26 + ((r() * 26) | 0);
        midCollege(x, r, bx2, w, h, base);
        if (r() > 0.55) { roofRake(x, bx2 + 2, base - h, w - 4, 8 + ((r() * 6) | 0)); }
        for (i = 0; i < 3; i++) if (r() > 0.55) { var cx2 = bx2 + 3 + ((r() * (w - 8)) | 0); R(x, C.black, cx2, base - h - 9, 4, 9); R(x, C.stoneD, cx2, base - h - 8, 3, 8); R(x, C.stoneM, cx2, base - h - 9, 3, 1); }
        bx2 += w + 1 + (r() > 0.78 ? 10 + ((r() * 16) | 0) : 0);
      }
      // Magdalen Tower
      midTower(x, r, 158, 26, 104, base, true);
      pinnacle(x, 160, base - 106, 12); pinnacle(x, 180, base - 106, 12);
      // St Mary the Virgin: tower and spire
      midTower(x, r, 258, 22, 72, base, false);
      for (j = 0; j < 46; j++) { var ww = Math.max(1, Math.round(18 * (1 - j / 46))); R(x, ditherPick(STONE, 0.72 - j / 100, 258, base), 258 + 2 + ((18 - ww) >> 1), base - 72 - j, ww, 1); }
      R(x, C.stoneE, 267, base - 120, 2, 4); pinnacle(x, 256, base - 74, 9); pinnacle(x, 278, base - 74, 9);
      // THE RADCLIFFE CAMERA — drum, colonnade, ribbed dome, lit lantern, cross finial
      (function () {
        var cx = 330, b = base, px;
        mass(x, cx - 33, b - 32, 66, 32, 0.30, 0.82);                      // the square rusticated plinth
        for (i = 0; i < 6; i++) R(x, C.black, cx - 28 + i * 11, b - 30, 1, 30);
        for (i = 0; i < 4; i++) lancet(x, cx - 24 + i * 15, b - 24, 7, 15, i === 1 ? C.win : C.winD);
        R(x, C.black, cx - 35, b - 36, 70, 2); R(x, C.stoneE, cx - 35, b - 38, 70, 2);
        mass(x, cx - 25, b - 68, 50, 32, 0.34, 0.90);                      // the drum
        for (i = 0; i < 7; i++) {                                          // the colonnade, paired shafts in deep shadow
          px = cx - 23 + i * 7;
          R(x, C.black, px, b - 64, 3, 28);
          R(x, C.stoneL, px + 3, b - 64, 2, 28);
          R(x, C.stoneE, px + 3, b - 64, 1, 28);
        }
        R(x, C.winM, cx - 20, b - 58, 2, 9); R(x, C.win, cx - 6, b - 58, 2, 9); R(x, C.winD, cx + 8, b - 58, 2, 9);
        R(x, C.stoneE, cx - 26, b - 68, 52, 2); R(x, C.black, cx - 25, b - 66, 50, 1);   // entablature
        R(x, C.black, cx - 28, b - 74, 56, 4);                             // balustrade
        for (i = 0; i < 13; i++) R(x, C.stoneL, cx - 26 + i * 4, b - 73, 2, 3);
        R(x, C.stoneE, cx - 29, b - 76, 58, 2);
        halfDome(x, cx, b - 76, 23, 21, false);                            // the dome
        for (i = -3; i <= 3; i++) {                                        // and its ribs
          for (j = 0; j < 21; j++) {
            var u = j / 21, rx2 = Math.round(cx + i * 7 * (1 - u * 0.72));
            if (Math.abs(rx2 - cx) > Math.round(23 * Math.sqrt(Math.max(0, 1 - u * u)))) continue;
            R(x, (i === 0 ? C.stoneE : C.stoneL), rx2, b - 76 - j, 1, 1);
          }
        }
        R(x, C.black, cx - 9, b - 98, 18, 3);                              // the lantern
        mass(x, cx - 7, b - 110, 14, 12, 0.5, 0.96);
        R(x, C.black, cx - 5, b - 108, 4, 8); R(x, C.win, cx - 5, b - 107, 3, 7);
        R(x, C.black, cx + 1, b - 108, 4, 8); R(x, C.winM, cx + 1, b - 107, 3, 7);
        R(x, C.stoneE, cx - 9, b - 112, 18, 2);
        halfDome(x, cx, b - 112, 6, 5, true);
        R(x, C.gold, cx - 1, b - 124, 2, 8); R(x, C.gold, cx - 3, b - 121, 6, 2);   // the cross finial
      })();
      // All Souls: the twin gothic towers
      midTower(x, r, 384, 20, 96, base, true); midTower(x, r, 414, 20, 96, base, true);
      mass(x, 404, base - 46, 10, 46, 0.3, 0.6);
      pinnacle(x, 386, base - 98, 13); pinnacle(x, 400, base - 98, 13); pinnacle(x, 416, base - 98, 13); pinnacle(x, 430, base - 98, 13);
      // the Sheldonian: low block, octagonal cupola
      (function () {
        var cx = 466, b = base;
        mass(x, cx - 26, b - 34, 52, 34, 0.34, 0.8);
        for (i = 0; i < 7; i++) R(x, C.black, cx - 23 + i * 7, b - 30, 5, 1);
        R(x, C.roofD, cx - 28, b - 42, 56, 8); R(x, C.black, cx - 28, b - 43, 56, 1);
        mass(x, cx - 9, b - 58, 18, 16, 0.4, 0.88);
        for (i = 0; i < 4; i++) R(x, C.black, cx - 7 + i * 5, b - 56, 1, 14);
        halfDome(x, cx, b - 58, 11, 9, true);
        R(x, C.gold, cx - 1, b - 72, 2, 5);
      })();
      // the covered market / high street terrace
      for (i = 0; i < 4; i++) { var tx = 506 + i * 26; mass(x, tx, base - 30, 24, 30, 0.3, 0.7); R(x, C.roofD, tx - 1, base - 38, 26, 8); windows(x, r, tx + 2, base - 26, 20, 22, 4, 5, 3, 4, 0.7); }
      // the Bodleian-ish range and a library block
      midCollege(x, r, 616, 56, 56, base); crenel(x, 616, base - 56, 56, 7);
      for (i = 0; i < 4; i++) lancet(x, 622 + i * 13, base - 46, 7, 18, i % 2 ? C.win : C.winD);
      // Tom Tower (Christ Church): gate, octagon, ogee dome
      (function () {
        var cx = 856, b = base;
        mass(x, cx - 40, b - 40, 80, 40, 0.3, 0.76); crenel(x, cx - 40, b - 40, 80, 8);
        mass(x, cx - 16, b - 74, 32, 34, 0.36, 0.9);
        R(x, C.black, cx - 10, b - 66, 20, 22); R(x, C.stoneD, cx - 9, b - 64, 18, 20);
        for (j = 0; j < 11; j++) R(x, C.black, cx - 9 + ((18 - Math.max(2, 18 - j * 2)) >> 1), b - 66 - j + 11, Math.max(2, 18 - j * 2), 1);
        mass(x, cx - 13, b - 94, 26, 20, 0.4, 0.92);
        for (i = 0; i < 5; i++) R(x, C.black, cx - 11 + i * 6, b - 92, 2, 18);
        halfDome(x, cx, b - 94, 15, 17, true);
        R(x, C.stoneE, cx - 4, b - 114, 8, 3); R(x, C.gold, cx - 1, b - 121, 2, 7);
        lancet(x, cx - 3, b - 36, 7, 16, C.winM);
      })();
      // dreaming spires to the right
      for (i = 0; i < 5; i++) { var sx2 = 910 + i * 22, sh2 = 40 + ((r() * 40) | 0); mass(x, sx2, base - sh2, 12, sh2, 0.28, 0.72);
        for (j = 0; j < 22; j++) { var w2 = Math.max(1, Math.round(10 * (1 - j / 22))); R(x, ditherPick(STONE, 0.6, sx2, base), sx2 + 1 + ((10 - w2) >> 1), base - sh2 - j, w2, 1); } }
      // --- the neon, in a dry register. Plate and glyph are sized so every joke reads.
      SIGNS = [
        { x: 150, y: 110, s: 'KEBAB VAN',    c: C.neonA, f: 0, v: 0 },
        { x: 340, y: 104, s: 'P<0.05',       c: C.neonM, f: 0, v: 0 },
        { x: 440, y: 116, s: 'LIBRARY 24H',  c: C.neonG, f: 1, v: 0 },
        { x: 548, y: 98,  s: 'VIVA',         c: C.neonM, f: 3, v: 1 },
        { x: 596, y: 92,  s: 'PUNTS',        c: C.neonC, f: 0, v: 0 },
        { x: 770, y: 92,  s: 'OPEN ACCESS',  c: C.neonC, f: 0, v: 0 },
        { x: 930, y: 112, s: 'TUTORIAL 9AM', c: C.neonA, f: 2, v: 0 }
      ];
      for (i = 0; i < SIGNS.length; i++) {
        SIGNS[i].w = SIGNS[i].v ? 14 : SIGNS[i].s.length * 8 + 8;
        SIGNS[i].h = SIGNS[i].v ? SIGNS[i].s.length * 9 + 6 : 16;
      }
    }
    // flicker rates are 12 s harmonics, so the attract loops exactly
    function signOn(n, t) {
      if (n.f === 0) return 1;
      if (n.f === 1) return ((t * 1.5707963 + n.x * 0.11) % 6.2831853) < 0.20 ? 0 : 1;
      if (n.f === 2) return ((t * 0.5235988 + n.x * 0.07) % 6.2831853) < 0.34 ? 0 : 1;
      return Math.sin(t * 0.5235988 + n.x * 0.05) > -0.94 ? 1 : 0;
    }
    // plate, gantry and tube are all drawn live: suppressing a sign leaves nothing behind.
    // A sign crossing the frame edge is culled outright, never drawn as a lit fragment;
    // one that would sit under `mask` (the title card's plate) is left out too.
    function drawSigns(x, mid, t, mask) {
      for (var i = 0; i < SIGNS.length; i++) {
        var n = SIGNS[i], nx = Math.round(n.x - mid), k, on;
        if (nx < 3 || nx + n.w > VW - 3) continue;
        if (mask && !(nx + n.w + 4 < mask[0] || nx - 4 > mask[2] || n.y + n.h + 4 < mask[1] || n.y - 4 > mask[3])) continue;
        R(x, C.steelD, nx + 2, n.y + n.h + 2, 2, 40);               // the gantry it is bolted to
        R(x, C.steelD, nx + n.w - 4, n.y + n.h + 2, 2, 40);
        on = signOn(n, t);
        if (on) {
          var g = 0.18 + 0.08 * Math.sin(t * 1.0471976 + n.x * 0.03);
          stip(x, n.c, g, nx - 6, n.y - 6, n.w + 12, 4);
          stip(x, n.c, g, nx - 6, n.y + n.h + 2, n.w + 12, 4);
          stip(x, n.c, g, nx - 6, n.y - 2, 4, n.h + 4);
          stip(x, n.c, g, nx + n.w + 2, n.y - 2, 4, n.h + 4);
        }
        R(x, C.black, nx - 2, n.y - 2, n.w + 4, n.h + 4);
        R(x, on ? n.c : C.steelD, nx - 2, n.y - 2, n.w + 4, 1);
        R(x, on ? n.c : C.steelD, nx - 2, n.y + n.h + 1, n.w + 4, 1);
        R(x, C.steelD, nx - 2, n.y - 2, 1, n.h + 4); R(x, C.steelD, nx + n.w + 1, n.y - 2, 1, n.h + 4);
        var tc = on ? n.c : C.steelD;                          // unlit, the tube is still there: dark glass, not a hole
        if (n.v) for (k = 0; k < n.s.length; k++) text(x, n.s.charAt(k), nx + 3, n.y + 3 + k * 9, 8, tc, 1);
        else text(x, n.s, nx + 4, n.y + 4, 8, tc, 1);
      }
    }

    function buildNear() {
      NEAR = mk(NW, VH); var x = NEAR.getContext('2d'), r = rng(6113), i, j, k, base = 188;
      ramp(x, 0, base + 4, NW, VH - base - 4, [C.road0, C.road2, C.road2]);          // the wet road
      R(x, C.near1, 0, base, NW, 3); R(x, C.black, 0, base + 3, NW, 1);              // the kerb
      // a low, near-black roofline, with one big mass every so often to frame the shot
      var bx = 0, nextTall = 150;
      while (bx < NW) {
        bx += (r() > 0.58) ? 12 + ((r() * 30) | 0) : 3;
        var tall = bx > nextTall && !(bx > 800 && bx < 1270);
        var w = tall ? 44 + ((r() * 36) | 0) : 20 + ((r() * 58) | 0);
        var low = bx > 780 && bx < 1300;
        var h = tall ? 54 + ((r() * 22) | 0) : (low ? 7 + ((r() * 22) | 0) : 13 + ((r() * 22) | 0));
        if (tall) nextTall = bx + 320 + ((r() * 200) | 0);
        R(x, C.near0, bx, base - h, w, h + 4);
        R(x, C.near1, bx, base - h, w, 1);
        R(x, C.black, bx + w - 1, base - h, 1, h);
        if (r() > 0.45) {
          var rh = 5 + ((r() * 8) | 0);
          for (i = 0; i < w; i++) { var d = Math.abs(i - (w - 1) / 2) / ((w - 1) / 2), hh = Math.round(rh * (1 - d));
            R(x, C.near0, bx + i, base - h - hh, 1, hh + 1); if (hh > 0) R(x, C.near1, bx + i, base - h - hh, 1, 1); }
        }
        for (k = 0; k < 3; k++) if (r() > 0.48) { var cx = bx + 3 + ((r() * Math.max(1, w - 9)) | 0), ch = 6 + ((r() * 10) | 0);
          R(x, C.near0, cx, base - h - ch, 5, ch); R(x, C.near1, cx, base - h - ch, 5, 1);
          R(x, C.near1, cx + 1, base - h - ch - 2, 1, 2); R(x, C.near1, cx + 3, base - h - ch - 2, 1, 2); }
        for (k = 0; k < 5; k++) if (r() > 0.78) { var wx = bx + 3 + ((r() * Math.max(1, w - 8)) | 0), wy = base - h + 4 + ((r() * Math.max(1, h - 10)) | 0);
          R(x, C.black, wx - 1, wy - 1, 5, 7); R(x, r() > 0.55 ? C.winM : C.winD, wx, wy, 3, 5); }
        bx += w;
      }
      // lamp posts: a tight halo, then a long pool of light broken up on the wet road
      for (i = 26; i < NW; i += 150 + ((r() * 70) | 0)) {
        var lx = i, ly = base - 38;
        for (j = -8; j <= 8; j++) { var g = 8 - Math.abs(j); if (g <= 0) continue; stip(x, C.lampG, 0.62 * (1 - Math.abs(j) / 9), lx + 1 - g, ly - 2 + j, g * 2, 1); }
        R(x, C.near0, lx, ly, 3, 42); R(x, C.near1, lx, ly, 1, 42);
        R(x, C.black, lx - 3, ly - 6, 9, 7); R(x, C.lampG, lx - 2, ly - 5, 7, 5); R(x, C.lampW, lx - 1, ly - 4, 5, 3);
        R(x, C.near0, lx - 3, ly - 8, 9, 2);
        for (j = 0; j < 22; j++) {
          var dy = (j - 9) / 11, q2 = 1 - dy * dy; if (q2 <= 0) continue;
          var ww = Math.round(26 * Math.sqrt(q2)), co = Math.round(11 * Math.sqrt(Math.max(0, q2 - 0.42)));
          stip(x, C.lampG, 0.72 * q2, lx + 1 - (ww >> 1), base + 6 + j, ww, 1);
          if (co > 0) R(x, j < 10 ? C.lampW : C.lampG, lx + 1 - (co >> 1), base + 6 + j, co, 1);
        }
        for (j = 0; j < 7; j++) R(x, C.lampW, lx + 1 + (((j * 11) % 9) - 4), base + 8 + j * 3, 1 + (j % 2), 1);
      }
      // iron railings along the pavement, and the bicycles left against them
      R(x, C.near2, 0, base - 10, NW, 1);
      for (i = 0; i < NW; i += 6) R(x, C.near1, i, base - 9, 1, 9);
      for (i = 40; i < NW; i += 150 + ((r() * 110) | 0)) {
        var bkx = i, k2, l2, m2;
        for (k2 = 0; k2 < 2; k2++) {
          var wcx = bkx + k2 * 13, wcy = base - 4;
          for (l2 = -5; l2 <= 5; l2++) for (m2 = -5; m2 <= 5; m2++) {
            var dd = Math.sqrt(l2 * l2 + m2 * m2);
            if (dd > 5.4 || dd < 3.5) continue;
            R(x, C.near2, wcx + l2, wcy + m2, 1, 1);
          }
          R(x, C.near1, wcx - 1, wcy - 1, 2, 2);
        }
        R(x, C.near2, bkx + 2, base - 9, 11, 1); R(x, C.near2, bkx + 6, base - 9, 1, 6);
        R(x, C.near2, bkx + 12, base - 12, 1, 8); R(x, C.near2, bkx + 10, base - 13, 5, 1);
        R(x, C.near2, bkx + 2, base - 12, 5, 2); R(x, C.near2, bkx + 7, base - 4, 5, 1);
        R(x, C.black, bkx - 4, base + 2, 26, 2);
      }
      for (i = 0; i < 46; i++) {                                                     // the sky, lying in the road
        var px = (r() * NW) | 0, py = base + 6 + ((r() * 18) | 0), pw = 8 + ((r() * 26) | 0);
        stip(x, C.sky3, 0.38, px, py, pw, 1); stip(x, C.road1, 0.22, px, py + 1, pw, 1);
      }
    }

    /* ---------------------------------------------------------------- the title, chunky and outlined */
    var TITLE = null, TITLEW = 0, TITLEH = 0;
    var TRAMP = [C.red1, C.neonR, C.ember, C.gold, C.white];
    function buildTitle() {
      var L = ['PALMER’S', 'PROGRESS'], SZ = 24, GAP = 4, i, j, k, n;
      var m0 = maskOf(L[0], SZ), m1 = maskOf(L[1], SZ);
      var bw = Math.max(m0.w, m1.w), lh = SZ + 2;
      var W = bw + 14, H = lh * 2 + GAP + 14;
      var bits = new Uint8Array(W * H), rows = [m0, m1];
      for (n = 0; n < 2; n++) {
        var m = rows[n], ox = 7 + ((bw - m.w) >> 1), oy = 6 + n * (lh + GAP);
        for (j = 0; j < m.h; j++) for (i = 0; i < m.w; i++) if (m.bits[j * m.w + i]) { var yy = oy + j, xx = ox + i; if (yy >= 0 && yy < H && xx >= 0 && xx < W) bits[yy * W + xx] = 1 + n; }
      }
      TITLE = mk(W + 4, H + 4); var x = TITLE.getContext('2d');
      function on(i2, j2) { return (i2 >= 0 && j2 >= 0 && i2 < W && j2 < H) ? bits[j2 * W + i2] : 0; }
      for (j = 0; j < H; j++) for (i = 0; i < W; i++) if (on(i, j)) R(x, C.black, i + 4, j + 4, 1, 1);          // the hard drop shadow
      for (j = 0; j < H; j++) for (i = 0; i < W; i++) {                                                          // 2px black outline
        if (on(i, j)) continue;
        var near = 0;
        for (k = -2; k <= 2 && !near; k++) for (n = -2; n <= 2; n++) if (on(i + k, j + n)) { near = 1; break; }
        if (near) R(x, C.black, i, j, 1, 1);
      }
      for (j = 0; j < H; j++) for (i = 0; i < W; i++) {                                                          // an inner bevel
        if (on(i, j)) continue;
        if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) R(x, C.red1, i, j, 1, 1);
      }
      for (j = 0; j < H; j++) for (i = 0; i < W; i++) {                                                          // dithered bright-to-dark fill
        var v = on(i, j); if (!v) continue;
        var ly = j - (6 + (v - 1) * (24 + 2 + 4)), t = 1 - Math.max(0, Math.min(1, ly / 25));
        R(x, ditherPick(TRAMP, t * 0.94 + 0.06, i, j), i, j, 1, 1);
        if (ly >= 0 && ly <= 1) R(x, C.white, i, j, 1, 1);
      }
      TITLEW = TITLE.width; TITLEH = TITLE.height;
    }

    /* ---------------------------------------------------------------- scene assembly */
    var built = false;
    function buildAll() {
      if (built) return; built = true;
      buildSky(); buildStars(); buildFar(); buildMid(); buildNear(); buildTitle(); warmCard();
    }
    function freeAll() {                           // drop every canvas and cache; buildAll() makes them again
      SKY = STARS = MOON = FAR = MID = NEAR = TITLE = null;
      SIGNS = []; TWINK = []; patCache = {}; clearText(); built = false;
    }

    /* ---------------------------------------------------------------- drawing */
    var buf = null, bx = null, view = null, vx = null, host = null;

    function scrim(x, y0, h, a) { stip(x, C.black, a, 0, y0, VW, h); }
    function plateBox(str, cy, size) {                                // where a plate lands, for the sign mask
      var w = txtW(str, size) + 12, x0 = Math.round((VW - w) / 2);
      return [x0, cy - 3, x0 + w, cy + size + 3];
    }
    function plate(x, str, cy, size, col, a) {                       // a small fitted bar so text never fights the city
      var b = plateBox(str, cy, size);
      stip(x, C.black, a * 0.72, b[0], b[1], b[2] - b[0], size + 6);
      textOC(x, str, 160, cy, size, col, C.black, a);
    }

    function drawCity(x, cam, t, mask) {
      var mid = Math.round(cam), far = Math.round(cam * 0.5), near = Math.round(cam * 1.5), sk = Math.round(cam * 0.12), i;
      x.drawImage(SKY, 0, 0);
      x.drawImage(STARS, -sk, 0);
      for (i = 0; i < TWINK.length; i++) {
        var tw = TWINK[i], s = Math.sin(t * tw.s + tw.p);
        if (s > 0.55) R(x, s > 0.9 ? C.white : C.star, tw.x - sk, tw.y, 1, 1);
      }
      x.drawImage(MOON, 236 - sk, 1);
      x.drawImage(FAR, -far, 0);
      x.drawImage(MID, -mid, 0);
      x.drawImage(NEAR, -near, 0);
      drawSigns(x, mid, t, mask);           // last, so no near rooftop ever cuts a joke in half
    }

    function attractCam(t) { return 290 + 30 * Math.sin(t / LOOP * 6.28318530718); }
    function drawAttract(x, t) {
      drawCity(x, attractCam(t), t, null);
      x.drawImage(TITLE, Math.round((VW - TITLEW) / 2), 18);
      scrim(x, 150, 58, 0.48);
      if ((t % 1.0) < 0.62) textOC(x, 'INSERT COIN', 160, 158, 16, C.gold, C.black, 1);
      textOC(x, 'CLICK FOR SOUND', 160, 182, 8, C.grey, C.black, 1);
      textOC(x, '1 CREDIT = 1 CAREER', 160, 196, 8, C.greyD, C.black, 1);
    }

    /* ---- the title card. t = 0 is the coin: a white flash, a whip pan to the card's
            camera under it, the logo slamming back in from the top of the frame
            with a shake on landing, then the plate and the prompt dissolving in. ---- */
    var SUB = 'THE ROAD TO PUBLICATION', SUB_Y = 128, SUB_BOX = plateBox(SUB, SUB_Y, 8);
    var TAG = LOOP2 ? 'SECOND LOOP · MASTER QUEST' : 'REVIEWER 2 IS ALREADY HERE';
    var CREDIT = LOOP2 ? 'CREDIT 02' : 'CREDIT 01', COPY = '© 2026 D. PALMER', ETHICS = 'ETHICS APPROVAL PENDING';
    var coinCam = 290;                        // where the attract camera stood when the coin went in
    // cut the card's glyphs before the coin, so the frame the logo lands on draws from cache alone
    function warmCard() {
      var s = [[SUB, 8, C.gold], [TAG, 8, LOOP2 ? C.gold : C.grey], ['PRESS START', 16, C.white], ['PRESS START', 16, C.gold],
               [COPY, 8, C.grey], [ETHICS, 8, C.greyD], [CREDIT, 8, C.greyD]], i;
      for (i = 0; i < s.length; i++) { tinted(s[i][0], s[i][1], s[i][2]); tinted(s[i][0], s[i][1], C.black); }
    }
    function drawTitleCard(x, t) {
      var cam = coinCam + (CARD_CAM - coinCam) * smooth(t / 0.6) + 6 * Math.sin(t / 19 * 6.28318530718);
      var land = t - 0.22, shake = (land >= 0 && land < 0.5) ? 6 * (1 - land / 0.5) : 0;
      var sx = shake ? Math.round(Math.sin(t * 91) * shake) : 0, sy = shake ? Math.round(Math.cos(t * 73) * shake * 0.7) : 0;
      var a = smooth((t - 0.30) / 0.35), ty;
      R(x, C.black, 0, 0, VW, VH);
      x.save(); x.translate(sx, sy);
      drawCity(x, cam, t + 40, SUB_BOX);      // +40 s: the neon is mid-cycle, not all lit in unison
      x.restore();
      if (t < 0.22) ty = Math.round(-TITLEH + (18 + TITLEH) * smooth(t / 0.22));
      else ty = 18 + (land < 0.12 ? 4 : (Math.sin(t * 1.1) > 0.97 ? 1 : 0));
      x.drawImage(TITLE, Math.round((VW - TITLEW) / 2), ty);
      if (a > 0) {
        plate(x, SUB, SUB_Y, 8, C.gold, a);
        scrim(x, 140, 76, 0.80 * a);
        textOC(x, TAG, 160, 148, 8, LOOP2 ? C.gold : C.grey, C.black, a);
        if (((t - 0.65) % 1.0) < 0.62) textOC(x, 'PRESS START', 160, 164, 16, C.white, C.black, a);
        textOC(x, COPY, 160, 188, 8, C.grey, C.black, a);
        textOC(x, ETHICS, 160, 198, 8, C.greyD, C.black, a);
        text(x, CREDIT, 8, 207, 8, C.greyD, a);
      }
      if (t < 0.30) stip(x, C.white, 1 - t / 0.30, 0, 0, VW, VH);
      if (flourish > 0) {
        textOC(x, 'PRESS START', 160, 164, 16, C.gold, C.black, 1);
        stip(x, C.white, Math.max(0, 1 - flourish / 0.30), 0, 0, VW, VH);
      }
    }

    /* ---------------------------------------------------------------- the machine */
    // _seek / _setPhase / _buffer are test hooks: they let a harness land on an exact
    // frame deterministically. Nothing in the host needs them.
    var self = { start: start, click: click, stop: stop, phase: 'attract', active: false, startError: null,
                 drawErrors: 0, drawError: null,
                 _seek: seek, _setPhase: setPhase, _buffer: function () { return buf; } };
    var opts = null, raf = 0, last = 0, T = 0, flourish = 0, doneTimer = 0, doneSent = false, scoreSent = false, onRes = null, frozen = false;
    // PRESS START is refused until the card has been DRAWN up to the prompt fully dissolved in (T = 0.65; T only
    // moves on rendered frames, so a second click queued behind a busy main thread is still refused), which also
    // outlasts an OS double-click (about 500 ms). After 2.5 s of wall clock it is taken regardless: a starved rAF
    // must never hold the card hostage.
    var DWELL = 0.65, DWELL_CAP = 2500, coinAt = 0, gen = 0, keyHost = null;
    function onKey(e) { if (e.repeat) { e.stopImmediatePropagation(); e.preventDefault(); } }   // a held key is one press

    function fit() {
      if (!view || !host) return;
      var w = host.clientWidth || 640, h = host.clientHeight || 360;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var cw = Math.max(320, Math.round(w * dpr)), ch = Math.max(224, Math.round(h * dpr));
      if (view.width !== cw || view.height !== ch) { view.width = cw; view.height = ch; }
      view.style.width = '100%'; view.style.height = '100%';
      vx = view.getContext('2d'); vx.imageSmoothingEnabled = false;
    }

    // Nothing in here may throw into the host. But a swallowed exception is a lie, so
    // the first one is kept on the returned object, with a count: self.drawErrors / .drawError.
    function noteDrawError(where, e) {
      self.drawErrors++;
      if (!self.drawError) self.drawError = where + '@' + self.phase + '/' + T.toFixed(2) + ': ' + ((e && (e.stack || e.message)) || String(e));
    }
    function render() {
      if (!bx) return;
      try {
        if (self.phase === 'attract') drawAttract(bx, T);
        else drawTitleCard(bx, T);
      } catch (e) { noteDrawError('draw', e); }
      if (!vx) return;
      try {
        vx.imageSmoothingEnabled = false;
        vx.drawImage(buf, 0, 0, VW, VH, 0, 0, view.width, view.height);
      } catch (e) { noteDrawError('blit', e); }
    }

    function update(dt) {
      T += dt;
      if (flourish > 0) {
        flourish += dt;
        if (flourish > 0.42) finish();
      }
    }

    function finish() {
      if (doneSent) return; doneSent = true;
      if (doneTimer) { clearTimeout(doneTimer); doneTimer = 0; }
      try { if (opts && opts.onDone) opts.onDone(); } catch (e) { }
    }

    function setPhase(name) {
      if (name !== 'attract' && name !== 'title') return;
      if (name === 'title' && self.phase === 'attract') coinCam = attractCam(T);
      if (name === 'title') coinAt = performance.now();
      self.phase = name; T = 0; flourish = 0;
      if (name === 'title' && !scoreSent) {                 // the coin: the host starts the title theme, once
        scoreSent = true;
        try { if (opts && opts.onScore) opts.onScore('title'); } catch (e) { }
      }
      render();
    }

    function seek(sec) {
      frozen = true;
      T = sec;
      render();
      return T;
    }

    function loop(now) {
      raf = window.requestAnimationFrame(loop);
      var dt = last ? (now - last) / 1000 : 1 / 60; last = now;
      if (dt > 0.25) dt = 0.25;
      if (document.hidden || frozen) return;
      update(dt);
      render();
    }

    function click() {
      if (!self.active) return false;
      frozen = false;
      try {
        if (self.phase === 'attract') { setPhase('title'); return true; }
        if (T < DWELL && performance.now() - coinAt < DWELL_CAP) return true;   // too soon: the card is still landing
        if (!doneSent && flourish <= 0) {
          flourish = 0.0001;
          doneTimer = setTimeout(finish, 430);   // belt and braces: a starved rAF must not delay the hand-off
          render();
        }
        return true;
      } catch (e) { finish(); return true; }
    }

    function start(o) {
      try {
        stop();                                              // idempotent: a second start() replaces the first view
        var g = gen;
        opts = o || {}; host = opts.host;
        if (!host) return;
        keyHost = host; host.addEventListener('keydown', onKey, true);   // capture: before the host's own handler
        buf = mk(VW, VH); bx = buf.getContext('2d'); bx.imageSmoothingEnabled = false;
        R(bx, C.black, 0, 0, VW, VH);
        view = document.createElement('canvas');
        view.className = 'q-intro';
        view.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;background:#000;';
        host.appendChild(view);
        fit();
        onRes = function () { fit(); render(); };
        window.addEventListener('resize', onRes);
        buildAll();
        self.active = true; self.phase = 'attract';
        T = 0; flourish = 0; frozen = false; doneSent = false; scoreSent = false;
        if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
          document.fonts.ready.then(function () {                // the logo is cut from the pixel font once it is really here
            if (g !== gen) return;                               // stopped (or restarted) since
            try { clearText(); TITLE = null; buildTitle(); warmCard(); render(); } catch (e) { }
          });
        }
        render();
        last = 0; raf = window.requestAnimationFrame(loop);
      } catch (e) { self.active = false; self.startError = (e && (e.stack || e.message)) || String(e); }
    }

    function stop() {
      try {
        self.active = false;
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
        if (doneTimer) { clearTimeout(doneTimer); doneTimer = 0; }
        if (onRes) { window.removeEventListener('resize', onRes); onRes = null; }
        if (keyHost) { keyHost.removeEventListener('keydown', onKey, true); keyHost = null; }
        if (view && view.parentNode) view.parentNode.removeChild(view);
        view = null; vx = null; host = null; opts = null;
        buf = null; bx = null; freeAll();                   // the host keeps this object for good: keep nothing heavy
        gen++;
      } catch (e) { }
    }

    return self;
  };
})();
