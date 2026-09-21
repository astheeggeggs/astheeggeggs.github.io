/* =============================================================================
   INTRO.JS — "PALMER'S PROGRESS" title sequence.
   A Streets of Rage 2 homage: a silent looping Oxford-at-night attract, then on
   the first click a scored cinematic — intertitles, the Institute igniting, the
   photograph burning, and THE REVEAL: a huge MR. E in cold violet against pure
   black, looming over a hot amber Oxford on its own reflection, holding a giant
   cheque made out to the University. Then the title slams in.

   Mega Drive discipline: ONE 320x224 offscreen buffer blitted up with
   imageSmoothingEnabled = false; every channel snapped to 0/36/73/109/146/182/
   219/255; 4x4 ordered dithering, never gradients; integer pixel positions;
   everything procedural, no external assets. Plain ES5.

   Beat grid: 128 BPM, one bar = 1.875 s. Every beat lands on a bar line.
   ============================================================================= */
(function () {
  'use strict';

  window.QuestIntro = function (api) {

    /* ---------------------------------------------------------------- constants */
    var VW = 320, VH = 224;                    // the Mega Drive frame
    var FONT = '"Press Start 2P", monospace';
    var BAR = 1.875;                           // 128 BPM, one bar. every beat lands on a multiple.
    var CIN_END = 20 * BAR;                    // 37.5 s
    var PHOTO_OUT = 10 * BAR;                  // 18.75 s, bar 10: the photograph is gone
    var PHOTO_BURN = PHOTO_OUT - 3 * BAR / 4;  // 17.34375 s, three beats earlier: it catches
    var LBH = 10;                              // letterbox bar height, cinematic only

    /* ---------------------------------------------------------------- 9-bit palette */
    var LV = [0, 36, 73, 109, 146, 182, 219, 255];
    function q(v) { var i = Math.round(v / 255 * 7); return LV[i < 0 ? 0 : i > 7 ? 7 : i]; }
    function hex2(n) { var s = n.toString(16); return s.length < 2 ? '0' + s : s; }
    function S(r, g, b) { return '#' + hex2(q(r)) + hex2(q(g)) + hex2(q(b)); }

    var C = {
      black:  S(0, 0, 0),
      sky0:   S(0, 0, 36),    sky1:  S(36, 0, 73),   sky2:  S(73, 0, 73),
      skyA:   S(0, 0, 73),    skyB:  S(36, 0, 109),  skyC:  S(73, 0, 109),
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
      neonA:  S(255, 182, 36), neonR: S(255, 0, 36),   neonW: S(255, 255, 219),
      glass0: S(36, 73, 109),  glass1: S(73, 109, 146), glass2: S(146, 182, 219),
      steel:  S(109, 109, 146), steelD: S(36, 36, 36),
      red0:   S(255, 0, 36),   red1:  S(182, 0, 36),   red2: S(255, 109, 109),
      skin0:  S(255, 182, 109), skin1: S(219, 146, 73), skin2: S(182, 109, 36),
      skin3:  S(146, 73, 36),   skin4: S(109, 36, 36),
      hair0:  S(36, 36, 36),   hair1: S(73, 73, 73),   hair2: S(109, 109, 109),
      suit0:  S(255, 255, 219), suit1: S(219, 219, 182), suit2: S(182, 182, 146),
      suit3:  S(146, 146, 109),
      tooth:  S(255, 255, 255), toothD: S(219, 219, 219),
      cigar:  S(109, 73, 36),  cigarD: S(109, 36, 36), ash: S(182, 182, 182), ember: S(255, 109, 0),
      white:  S(255, 255, 255), grey: S(182, 182, 182), greyD: S(109, 109, 109),
      gold:   S(255, 219, 73), goldD: S(182, 146, 36),

      /* ---- THE REVEAL: two colour temperatures and nothing between them ---- */
      // cold violet: MR. E, his cheque, his hands. Deep purple shadow, lavender highlight.
      v1: S(36, 0, 73),    v2: S(73, 36, 109),  v3: S(109, 73, 146),
      v4: S(146, 109, 182), v5: S(182, 146, 219), v6: S(219, 182, 255),
      // the inside of his mouth: magenta, so it reads red without turning warm
      mo0: S(73, 0, 36), mo1: S(109, 0, 73), mo2: S(146, 0, 73),
      // hot amber: Oxford, and only Oxford
      h0: S(36, 0, 0),     h1: S(73, 36, 0),    h2: S(146, 73, 0),
      h3: S(219, 109, 0),  h4: S(255, 146, 36), h5: S(255, 182, 73),
      h6: S(255, 219, 146), hw: S(255, 255, 219)
    };
    var VR  = [C.v1, C.v2, C.v3, C.v4, C.v5];              // the face
    var VSU = [C.black, C.v1, C.v2, C.v3, C.v5];           // the suit, dark with lit edges
    var VCH = [C.v1, C.v2, C.v3, C.v4];                    // the cheque's paper
    var HR  = [C.h0, C.h1, C.h2, C.h3, C.h4, C.h5, C.h6];  // Oxford, hot

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
    function disc(ctx, col, cx, cy, rx, ry) {
      if (rx <= 0 || ry <= 0) return;
      for (var j = -ry; j <= ry; j++) {
        var f = 1 - (j * j) / (ry * ry); if (f <= 0) continue;
        var w = Math.round(rx * Math.sqrt(f)); if (w <= 0) continue;
        R(ctx, col, Math.round(cx - w), Math.round(cy + j), w * 2, 1);
      }
    }
    // blit a sprite through the Bayer grid: a hard dissolve that never blends a colour
    var dissC = null;
    function blitDither(dst, src, dx, dy, lvl) {
      if (lvl <= 0) return;
      if (lvl >= 16) { dst.drawImage(src, dx, dy); return; }
      if (!dissC || dissC.width < src.width || dissC.height < src.height) dissC = mk(Math.max(src.width, VW), Math.max(src.height, VH));
      var Q = dissC.getContext('2d'); Q.imageSmoothingEnabled = false;
      Q.globalCompositeOperation = 'source-over';
      Q.clearRect(0, 0, dissC.width, dissC.height);
      Q.drawImage(src, 0, 0);
      Q.globalCompositeOperation = 'destination-in';
      var p = pat(Q, '#ffffff', lvl); if (p) { Q.fillStyle = p; Q.fillRect(0, 0, src.width, src.height); }
      Q.globalCompositeOperation = 'source-over';
      dst.drawImage(dissC, 0, 0, src.width, src.height, dx, dy, src.width, src.height);
    }

    /* ---------------------------------------------------------------- tiny 3x5 font (cheque small print) */
    var TF = {
      A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755',
      I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '57775', O: '25552', P: '65644',
      Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255',
      Y: '55222', Z: '71247', '0': '75557', '1': '26227', '2': '61247', '3': '71317', '4': '55711',
      '5': '74717', '6': '74757', '7': '71222', '8': '75757', '9': '75717', ' ': '00000', '.': '00002',
      '-': '00700', "'": '22000', '!': '22202', ':': '02020', '/': '11244', '+': '02720',
      ',': '00024', '#': '57575', '<': '12421', '>': '42124', '*': '05250'
    };
    function tinyW(s) { return s.length * 4 - 1; }
    function tiny(ctx, s, x, y, col) {
      ctx.fillStyle = col;
      for (var i = 0; i < s.length; i++) {
        var g = TF[s.charAt(i)] || TF[' '];
        for (var r = 0; r < 5; r++) {
          var v = parseInt(g.charAt(r), 8);
          if (v & 4) ctx.fillRect(x + i * 4, y + r, 1, 1);
          if (v & 2) ctx.fillRect(x + i * 4 + 1, y + r, 1, 1);
          if (v & 1) ctx.fillRect(x + i * 4 + 2, y + r, 1, 1);
        }
      }
    }

    /* ---------------------------------------------------------------- Press Start 2P, thresholded to 1-bit masks */
    var maskCache = {}, tintCache = {};
    function maskOf(str, size) {
      var k = str + '|' + size, m = maskCache[k];
      if (m) return m;
      var w = Math.max(1, Math.round(str.length * size)), h = size + Math.ceil(size * 0.6);
      var c = mk(w, h), x = c.getContext('2d');
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
      x.fillStyle = col;
      for (var j = 0; j < m.h; j++) for (var i = 0; i < m.w; i++) if (m.bits[j * m.w + i]) x.fillRect(i, j, 1, 1);
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
    function textC(ctx, str, cx, y, size, col, a) { text(ctx, str, Math.round(cx - txtW(str, size) / 2), y, size, col, a); }
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
    var INST = null, INSTX = 660, INSTW = 104, INSTY = 22;      // the wrong building, in mid-strip coords
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
      for (i = 0; i < 300; i++) {
        var sx = (r() * MW) | 0, sy = (r() * 140) | 0, b = r();
        if (sy > 90 && r() > 0.35) continue;                       // thin them out near the haze
        R(x, b > 0.82 ? C.white : b > 0.5 ? C.star : C.starD, sx, sy, 1, 1);
        if (b > 0.94) { R(x, C.starD, sx - 1, sy, 1, 1); R(x, C.starD, sx + 1, sy, 1, 1); R(x, C.starD, sx, sy - 1, 1, 1); R(x, C.starD, sx, sy + 1, 1, 1); }
      }
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
      // --- THE INSTITUTE: cold glass and steel, unlit here (it ignites at its beat)
      (function () {
        var x0 = INSTX, w = INSTW, y0 = INSTY, h = base - y0;
        R(x, C.black, x0 - 1, y0 - 1, w + 2, h + 2);
        for (i = 0; i < w; i++) for (j = 0; j < h; j++) R(x, ditherPick([C.steelD, C.glass0, C.glass1], 0.72 - i / w * 0.55 - j / h * 0.12, x0 + i, y0 + j), x0 + i, y0 + j, 1, 1);
        for (j = 0; j < h; j += 9) R(x, C.steelD, x0, y0 + j, w, 2);                 // floor slabs
        for (i = 0; i < w; i += 13) R(x, C.steelD, x0 + i, y0, 2, h);                // mullions
        R(x, C.steel, x0, y0, w, 2); R(x, C.steel, x0 + w - 18, y0 - 8, 8, 8);
        R(x, C.glass2, x0 + 2, y0 + 2, 2, h - 4);                                    // one cold highlight
        R(x, C.steelD, x0 - 4, y0 + 2, 4, 3); R(x, C.steelD, x0 + w, y0 + 12, 5, 3);
      })();
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
    // plate, gantry and tube are all drawn live: suppressing a sign leaves nothing behind
    function drawSigns(x, mid, t, mask, full) {
      for (var i = 0; i < SIGNS.length; i++) {
        var n = SIGNS[i], nx = Math.round(n.x - mid), k, on;
        if (nx < -n.w - 10 || nx > VW + 10) continue;
        if ((full || n.v) && (nx < 3 || nx + n.w > VW - 3)) continue;
        if (mask && !(nx + n.w + 4 < mask[0] || nx - 4 > mask[2] || n.y + n.h + 4 < mask[1] || n.y - 4 > mask[3])) continue;
        R(x, C.steelD, nx + 2, n.y + n.h + 2, 2, Math.max(0, 40));               // the gantry it is bolted to
        R(x, C.steelD, nx + n.w - 4, n.y + n.h + 2, 2, Math.max(0, 40));
        on = signOn(n, t) && nx >= 2 && nx + n.w <= VW - 2;   // a sign half off the frame reads as a lit fragment: leave it dark
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

    // everything on the Institute that switches on at its beat, drawn as one overlay
    function buildInstLit() {
      var base = 172, w = INSTW + 14, h = base - INSTY + 14;
      INST = mk(w, h); var x = INST.getContext('2d'), r = rng(8821), i, j, ox = 7, oy = 7;
      for (j = 0; j < base - INSTY - 6; j += 9) for (i = 0; i < INSTW - 6; i += 13) {
        if (r() > 0.62) continue;
        R(x, r() > 0.5 ? C.glass2 : C.white, ox + i + 3, oy + j + 3, 10, 5);
        R(x, C.glass1, ox + i + 3, oy + j + 7, 10, 1);
      }
      R(x, C.black, ox + 20, oy + 6, 74, 16);                                  // SUBSCRIBE, in the crown
      R(x, C.red1, ox + 20, oy + 6, 74, 1); R(x, C.red1, ox + 20, oy + 21, 74, 1);
      text(x, 'SUBSCRIBE', ox + 25, oy + 10, 8, C.neonR, 1);
      // the mark: a red emblem, glowing
      var ex = ox + (INSTW >> 1) - 11, ey = oy + 40;
      for (j = -12; j < 34; j++) for (i = -14; i < 36; i++) {
        var d = Math.max(Math.abs(i - 11) / 22, Math.abs(j - 11) / 20);
        if (d <= 1 && d > 0.05) stip(x, C.red1, (1 - d) * 0.55, ex + i, ey + j, 1, 1);
      }
      R(x, C.red0, ex, ey, 22, 22); R(x, C.red2, ex, ey, 22, 2); R(x, C.red1, ex, ey + 20, 22, 2);
      R(x, C.black, ex + 4, ey + 4, 14, 3); R(x, C.black, ex + 4, ey + 4, 4, 14);
      R(x, C.black, ex + 4, ey + 9, 11, 3); R(x, C.black, ex + 4, ey + 15, 14, 3);
      // light spilling down the facade below the mark
      for (j = 0; j < 40; j++) stip(x, C.red1, 0.34 * (1 - j / 40), ex - 6, ey + 24 + j, 34, 1);
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

    /* =================================================================== THE REVEAL
       Two colour temperatures and nothing between them. The frame is a vertical
       stack: MR. E, huge and cold, cropped by the top edge; pure black; Oxford,
       hot, on its own reflection; and the cheque converging beneath it.        */

    var MRE = [], MRW = 320, MRH = 138;      // his sprite
    var FACE_Y = -8;                         // drawn here, so the crown and the hair are cropped away
    var HOT = null, HOTY = 132, HOTG = 40;   // the hot skyline; HOTG is its ground row in buffer terms
    var HOTPAD = 8;                          // sprite headroom above it, so the Radcliffe cross is not clipped
    var CHEQUE = null, CHQY = 168;           // the cheque sprite's top row in buffer coords

    /* ---- MR. E — THE BENEFACTOR, in the cold violet ramp against black.
       intro-a's Mr X silhouette (cream suit, broad shoulders, lapels, tie, cigar)
       carrying intro-b's face: slab brows, wet heavy lids over tiny pupils in
       large white sclera, etched lines, and the open-mouthed laugh.            */
    function hwOf(y) {
      var b = 1 - Math.pow((y - 36) / 80, 2); if (b <= 0) return 0;
      var v = 96 * Math.sqrt(b);
      var bump = y > 74 ? Math.max(0, 1 - Math.pow((y - 100) / 26, 2)) : 0;         // the jowls
      v *= (1 + 0.20 * bump);
      if (y > 98) v = Math.max(v, 58 - (y - 98) * 5);                               // a jaw like a paving slab
      return v;
    }
    var MHALF = 52;
    function mouthTop(i) { var v = i / MHALF; return Math.round(76 + 12 * (1 - v * v)); }
    // how thick a brow is along its length: a thin tail, a heavy mass over the eye, blunt at the nose
    var BTH = [2, 4, 7, 10, 13, 15, 16, 17, 17, 15, 11];
    function browTh(p) {
      var f = p * 10, a = Math.floor(f);
      if (a >= 10) return BTH[10];
      if (a < 0) return BTH[0];
      return BTH[a] + (BTH[a + 1] - BTH[a]) * (f - a);
    }

    function buildMrE(laugh) {
      var c = mk(MRW, MRH), x = c.getContext('2d'), i, j, k, u, t, X, Y;
      var CX = 160, skin = new Uint8Array(MRW * MRH);

      /* --- the suit: cream in daylight, here the pale end of the violet ramp, and
             dark everywhere else so the shoulders fall away into the black. */
      for (j = 104; j < MRH; j++) {
        var sw = Math.min(154, 30 + (j - 104) * 6.6);
        for (i = -sw; i <= sw; i++) {
          X = CX + i; if (X < 0 || X >= MRW) continue;
          u = Math.abs(i) / sw;
          t = 0.74 - 0.58 * u + 0.10 * ((j - 104) / 26);
          R(x, ditherPick(VSU, t, X, j), X, j, 1, 1);
        }
        R(x, C.black, CX - sw, j, 1, 1); R(x, C.black, CX + sw, j, 1, 1);
      }
      for (j = 106; j < MRH; j++) {                       // wide notch lapels, lit along the fold
        var la = Math.round((j - 106) * 2.3), lb = la + 18;
        R(x, C.black, CX - lb - 1, j, 2, 1); R(x, C.black, CX + lb - 1, j, 2, 1);
        for (i = la; i < lb; i++) {
          R(x, ditherPick(VSU, 0.98 - (i - la) / 19 * 0.44, CX - i, j), CX - i, j, 1, 1);
          R(x, ditherPick(VSU, 0.98 - (i - la) / 19 * 0.44, CX + i, j), CX + i, j, 1, 1);
        }
      }
      for (j = 106; j < MRH; j++) {                       // the shirt V, dark in the shadow of the jaw
        var vw = Math.round((j - 104) * 1.6);
        R(x, C.v1, CX - vw, j, vw * 2, 1);
      }
      // no tie and no lapel pin: the jowls hang over every row either could occupy, and
      // what was left of them fell inside the fade to black. Better absent than a smudge.

      // --- the neck, deep in the shadow of the jaw
      for (j = 92; j < 124; j++) for (i = -50; i <= 50; i++) {
        var nw = 50 - Math.max(0, j - 108) * 1.8; if (Math.abs(i) > nw) continue;
        R(x, ditherPick(VR, 0.04 + 0.16 * (j - 92) / 32 - 0.20 * Math.abs(i) / nw, CX + i, j), CX + i, j, 1, 1);
      }
      for (k = 0; k < 13; k++) {                          // a wing collar, not a stripe
        R(x, C.black, CX - 42 + k, 104 + k, 5, 2); R(x, C.black, CX + 38 - k, 104 + k, 5, 2);
        R(x, C.v4, CX - 41 + k, 104 + k, 3, 2); R(x, C.v4, CX + 38 - k, 104 + k, 3, 2);
      }

      // --- the head. Lit hard from the front and below.
      for (j = 0; j < 120; j++) {
        var w = hwOf(j); if (w < 1) continue;
        for (i = -Math.floor(w); i <= Math.floor(w); i++) {
          X = CX + i; if (X < 0 || X >= MRW) continue;
          u = Math.abs(i) / w;
          t = 0.22 + 0.62 * (j / 116) - 0.52 * u * u;
          R(x, ditherPick(VR, t, X, j), X, j, 1, 1);
          skin[j * MRW + X] = 1;
        }
        R(x, C.black, CX - Math.floor(w) - 1, j, 2, 1); R(x, C.black, CX + Math.floor(w), j, 2, 1);
      }
      // --- hair: a flat dark cap, slicked back, receded at the temples, cropped by the frame
      for (j = 0; j < 40; j++) {
        var w2 = hwOf(j); if (w2 < 1) continue;
        for (i = -Math.floor(w2); i <= Math.floor(w2); i++) {
          X = CX + i; if (X < 0 || X >= MRW) continue;
          var hl = 2 + 16 * Math.pow(Math.min(1, Math.abs(i) / 88), 1.8);
          if (j > hl) continue;
          var sl = ((j * 3 + Math.round(8 * Math.sin(i * 0.05))) % 14) < 2;
          R(x, sl ? C.v2 : C.black, X, j, 1, 1);
          skin[j * MRW + X] = 0;
        }
      }

      // --- the forehead: waxy, and creased twice
      for (k = 0; k < 2; k++) for (i = -58; i <= 58; i++) {
        X = CX + i; Y = 10 + k * 7 + Math.round(Math.sin(i / 21) * 1.6);
        if (Y < 0 || !skin[Y * MRW + X]) continue;
        R(x, C.v2, X, Y, 1, 2); R(x, C.v4, X, Y + 2, 1, 1);
      }

      // --- the eyes: deep-set, wet heavy lids, huge sclera, tiny dead pupils
      function eye(ex, sq) {
        var l, kk, s0 = (ex < CX ? -1 : 1);
        disc(x, C.v1, ex, 56, 34, 23);                                // the socket, in shadow
        disc(x, C.black, ex, 54, 28, 18);
        disc(x, C.v6, ex, 54, 26, 16);                                // the sclera, huge
        disc(x, C.white, ex - 5, 51, 17, 9);
        disc(x, C.v1, ex, 56 + (sq ? 3 : 0), 8, 8);                   // the iris, with no light in it
        disc(x, C.black, ex, 56 + (sq ? 3 : 0), 5, 5);                // and the pupil: tiny, and dead
        R(x, C.white, ex - 3, 53 + (sq ? 3 : 0), 2, 2);
        disc(x, C.v2, ex, 33, 28, 16);                                // the heavy lid comes down over it
        for (kk = -27; kk <= 27; kk++) { var f = 1 - (kk / 28) * (kk / 28); if (f <= 0) continue; R(x, C.black, ex + kk, 33 + Math.round(16 * Math.sqrt(f)) - 2, 1, 4); }
        R(x, C.v4, ex - 16, 36, 32, 1);                               // the wet crease of the lid, low, right above the eye
        R(x, C.v5, ex - 8, 36, 13, 1);
        if (sq) { R(x, C.v2, ex - 24, 46, 48, 10); R(x, C.black, ex - 24, 44, 48, 3); }
        disc(x, C.v3, ex, 72, 29, 8);                                 // the bag under it
        for (kk = -28; kk <= 28; kk++) R(x, C.v1, ex + kk, 67 + Math.round(Math.abs(kk) / 8), 1, 2);
        for (l = 0; l < 3; l++) for (kk = 0; kk < 14; kk++)           // crow's feet, etched
          R(x, C.v1, ex + s0 * (26 + kk), 48 + l * 7 - Math.round(kk * (l - 1) * 0.3), 1, 2);
      }
      eye(CX - 43, laugh); eye(CX + 43, laugh);

      /* --- the brows. NOT two bars over the lids with a lit rim under them: that read
             as wraparound shades, and he is already wearing a pair in the photograph.
             These are hair: thick tapering masses that sit straight down on the brow
             ridge, plunging towards the nose, dissolving into the lid underneath with
             no lit gap, and with stray hairs off the top and bottom.                 */
      (function () {
        var sd, ii, jj, pp, X2, bot2, th2, top2, lit2, hl3, hr3 = rng(3307);
        for (sd = -1; sd <= 1; sd += 2) {
          for (ii = 0; ii <= 80; ii++) {
            pp = ii / 80;                                   // 0 out at the tail, 1 in at the nose
            X2 = CX + sd * (84 - ii);
            bot2 = Math.round(25 + 15 * Math.pow(pp, 1.25));         // the underside drives down to the nose
            th2 = Math.round(browTh(pp)); if (th2 < 1) continue;     // thin tail, heavy medial mass
            top2 = bot2 - th2;
            for (jj = top2; jj <= bot2; jj++) {
              lit2 = ((jj * 3 + Math.round(9 * Math.sin((84 - ii) * 0.07))) % 13) < 2;
              R(x, lit2 ? C.v2 : C.black, X2, jj, 1, 1);             // a few hairs catch the light
            }
            stip(x, C.black, 0.62, X2, top2 - 2, 1, 2);              // the top breaks up into the forehead
            R(x, C.v1, X2, top2 - 1, 1, 1);
            stip(x, C.black, 0.80, X2, bot2 + 1, 1, 1);              // and the underside dissolves onto the lid:
            stip(x, C.black, 0.58, X2, bot2 + 2, 1, 1);              // a soft dithered edge, never a hard bar
            stip(x, C.black, 0.38, X2, bot2 + 3, 1, 1);
            stip(x, C.black, 0.20, X2, bot2 + 4, 1, 1);
            stip(x, C.v1, 0.46, X2, bot2 + 1, 1, 6);                 // and the shadow it throws down the lid
            if (hr3() > 0.84) {                                      // stray hairs, breaking the silhouette
              hl3 = 2 + ((hr3() * 4) | 0);
              R(x, C.black, X2, top2 - 1 - hl3, 1, hl3);
              if (hr3() > 0.45) R(x, C.v1, X2 + sd, bot2 + 1, 1, 2 + ((hr3() * 3) | 0));
            }
          }
        }
        // between them: a furrowed, shadowed glabella, so the gap cannot read as a nose bridge
        for (jj = 14; jj < 48; jj++)
          stip(x, C.v1, 0.70 * Math.min(1, Math.min((jj - 13) / 5, (48 - jj) / 8)), CX - 3, jj, 7, 1);
        R(x, C.v1, CX - 3, 28, 2, 15); R(x, C.v1, CX + 1, 28, 2, 15);
        R(x, C.black, CX - 1, 31, 1, 11);
      })();

      // --- the nose: short, blunt, lit from underneath. No pale muzzle.
      for (j = 50; j < 80; j++) {
        var nwid = 6 + Math.round((j - 50) * 0.40);
        for (i = -nwid; i <= nwid; i++) R(x, ditherPick(VR, 0.36 + 0.40 * ((j - 50) / 30) - 0.26 * Math.max(0, i / nwid), CX + i, j), CX + i, j, 1, 1);
      }
      for (j = 50; j < 80; j++) {                                     // the shadowed flank and the lit ridge
        var nw2 = 6 + Math.round((j - 50) * 0.40);
        R(x, C.v1, CX - nw2 - 2, j, 3, 1); R(x, C.black, CX - nw2 - 3, j, 1, 1);
        R(x, C.v5, CX + nw2 - 1, j, 2, 1);
        R(x, C.v5, CX - 2, j, 3, 1);
      }
      disc(x, C.v2, CX, 76, 20, 9);
      disc(x, C.v4, CX, 76, 16, 7);
      disc(x, C.v6, CX - 2, 75, 9, 4);
      R(x, C.black, CX - 14, 76, 6, 4); R(x, C.black, CX + 9, 76, 6, 4);    // the nostrils
      R(x, C.v1, CX - 15, 75, 8, 1); R(x, C.v1, CX + 8, 75, 8, 1);
      R(x, C.v2, CX - 7, 79, 15, 2);
      for (i = -22; i <= 22; i++) stip(x, C.v1, 0.55, CX + i, 81, 1, 4);

      // --- deep etched lines from the nose to the corners of the grin
      for (j = 0; j < 22; j++) {
        var ox2 = Math.round(18 + j * 1.5), oy2 = 68 + j;
        R(x, C.v1, CX - ox2, oy2, 3, 1); R(x, C.v1, CX + ox2 - 2, oy2, 3, 1);
        if (j % 3 === 0) { R(x, C.v3, CX - ox2 + 3, oy2, 2, 1); R(x, C.v3, CX + ox2 - 4, oy2, 2, 1); }
      }

      // --- jowls, and a chin like a knee (before the mouth, so nothing crosses it)
      for (i = -1; i <= 1; i += 2) for (j = 0; j < 22; j++) stip(x, C.v1, 0.55 - j / 48, CX + i * (60 + Math.round(j * 0.3)), 84 + j, 8, 1);
      for (i = -1; i <= 1; i += 2) for (j = 0; j < 16; j++) {                             // the sheen on the jowls, following the face
        var jw = Math.round(hwOf(88 + j)) - 6; if (jw < 20) continue;
        stip(x, C.v5, 0.40 * (1 - Math.abs(j - 7) / 11), CX + i * (jw - 26), 88 + j, 24, 1);
      }
      for (i = -34; i <= 34; i++) R(x, C.v1, CX + i, 106 + Math.round(4 * Math.pow(i / 34, 2)), 1, 2);
      for (i = -26; i <= 26; i++) R(x, C.v4, CX + i, 102 + Math.round(3 * Math.pow(i / 26, 2)), 1, 1);
      for (i = -40; i <= 40; i++) stip(x, C.v1, 0.6, CX + i, 96 + Math.round(4 * Math.pow(i / 40, 2)), 1, 4);   // shadow under the lip

      // --- the grin: corners turned up, far too many teeth. The laugh opens it.
      var open = laugh ? 26 : 13;
      function ybot(i2) { var v = i2 / MHALF; return Math.round(mouthTop(i2) + open * Math.pow(Math.max(0, 1 - v * v), 0.55)); }
      for (i = -MHALF; i <= MHALF; i++) {
        var px2 = CX + i, a = mouthTop(i), b = ybot(i);
        R(x, C.v1, px2, a - 3, 1, 3); R(x, C.black, px2, a - 1, 1, 3);      // the gum line above the teeth
        for (j = a + 2; j < b; j++) R(x, laugh ? C.mo0 : C.black, px2, j, 1, 1);
        R(x, C.v4, px2, b, 1, 3); R(x, C.black, px2, b - 1, 1, 1);
      }
      if (laugh) {                                                          // the red interior, and the tongue
        for (i = -MHALF + 5; i <= MHALF - 5; i++) {
          var px6 = CX + i, a6 = mouthTop(i) + 9, b6 = ybot(i) - 7;
          if (b6 - a6 < 3) continue;
          for (j = a6; j < b6; j++) R(x, ditherPick([C.mo0, C.mo0, C.mo1], (j - a6) / Math.max(1, b6 - a6), px6, j), px6, j, 1, 1);
        }
        for (i = -26; i <= 26; i++) {                                       // the tongue, down in the back of it
          var px7 = CX + i, ty = ybot(i) - 13, th = Math.round(7 * Math.sqrt(Math.max(0, 1 - (i / 27) * (i / 27))));
          if (th < 1) continue;
          R(x, C.mo2, px7, ty, 1, th);
        }
      }
      for (i = -MHALF + 3; i <= MHALF - 3; i++) {                           // the upper teeth
        var px3 = CX + i, a2 = mouthTop(i) + 2, h2 = Math.max(0, Math.min(laugh ? 7 : 8, ybot(i) - a2 - 3));
        if (h2 <= 1) continue;
        var gap = (((i + MHALF) % 8) < 1);
        R(x, gap ? C.v2 : C.white, px3, a2, 1, h2);
        R(x, gap ? C.black : C.v6, px3, a2 + h2 - 1, 1, 1);
      }
      for (i = -MHALF + 8; i <= MHALF - 8; i++) {                           // and the lower
        var px4 = CX + i, b2 = ybot(i) - (laugh ? 6 : 4);
        if (b2 - mouthTop(i) < 9) continue;
        R(x, (((i + MHALF) % 7) < 1) ? C.v2 : C.v6, px4, b2, 1, laugh ? 5 : 4);
      }

      // --- the cigar, clamped in the corner of the grin. Its ember is the one
      //     warm thing allowed above the skyline.
      (function () {
        var x0 = CX + 46, y0 = mouthTop(46) - 1, kk;
        for (kk = 0; kk < 44; kk++) {
          var px5 = x0 + kk, py = Math.round(y0 - kk * 0.46);
          if (px5 >= MRW) break;
          R(x, C.black, px5, py - 6, 1, 12);
          R(x, kk > 35 ? C.v5 : C.v2, px5, py - 5, 1, 10);
          R(x, kk > 35 ? C.v6 : C.v3, px5, py - 5, 1, 5);
          if (kk > 7 && kk < 12) R(x, C.v6, px5, py - 5, 1, 10);
        }
        var ex2 = Math.min(MRW - 4, x0 + 43), ey2 = Math.round(y0 - 43 * 0.46);
        stip(x, C.ember, 0.26, ex2 - 6, ey2 - 10, 12, 20);
        R(x, C.ember, ex2 - 2, ey2 - 5, 4, 10); R(x, C.gold, ex2 - 1, ey2 - 3, 2, 6);
      })();

      // --- everything below the collar dissolves into the black
      for (j = 122; j < MRH; j++) stip(x, C.black, Math.min(1, (j - 122) / 10), 0, j, MRW, 1);
      for (i = 0; i < 44; i++) {                                           // and so do the far edges
        stip(x, C.black, 1 - i / 44, i, 98, 1, MRH - 98);
        stip(x, C.black, 1 - i / 44, MRW - 1 - i, 98, 1, MRH - 98);
      }
      return c;
    }

    /* ---- OXFORD, HOT: amber and white-hot window light against black, on its
            own mirrored reflection. Thirty rows, the whole city in them.       */
    function hmass(x, x0, y0, w, h, lo, hi) {
      for (var i = 0; i < w; i++) {
        var t = hi - (hi - lo) * (i / Math.max(1, w - 1));
        for (var j = 0; j < h; j++) R(x, ditherPick(HR, t * (1 - 0.34 * (j / Math.max(1, h))), x0 + i, y0 + j), x0 + i, y0 + j, 1, 1);
      }
      R(x, C.h5, x0, y0, w, 1);                        // the ridge takes the light
      R(x, C.black, x0 + w - 1, y0, 1, h);             // and the far side is cut out of the night
      R(x, C.black, x0 - 1, y0, 1, h);
    }
    function hwin(x, x0, y0, w, h, hot) {
      R(x, C.black, x0 - 1, y0 - 1, w + 2, h + 2);
      R(x, hot ? C.hw : C.h5, x0, y0, w, h);
      if (h > 3) R(x, hot ? C.h6 : C.h4, x0, y0 + h - 1, w, 1);
    }
    function hspire(x, cx, ybase, h, w0) {
      for (var j = 0; j < h; j++) {
        var ww = Math.max(1, Math.round(w0 * Math.pow(1 - j / h, 1.1)));
        R(x, ditherPick(HR, 0.40 + 0.22 * (j / h), cx, ybase - j), cx - (ww >> 1), ybase - j, ww, 1);
        if (j % 5 === 2 && ww > 2) { R(x, C.h4, cx - (ww >> 1) - 1, ybase - j, 1, 1); R(x, C.h4, cx + (ww >> 1), ybase - j, 1, 1); }
      }
      R(x, C.h5, cx, ybase - h - 2, 1, 2);
    }
    function hdome(x, cx, ybase, rx, ry) {
      for (var i = -rx; i <= rx; i++) for (var j = -ry; j <= 0; j++) {
        var u = i / rx, v = j / ry; if (u * u + v * v > 1) continue;
        R(x, ditherPick(HR, 0.72 - 0.50 * (u + 1) / 2 - 0.10 * (1 + v), cx + i, ybase + j), cx + i, ybase + j, 1, 1);
      }
    }
    function buildHot() {
      var RH = 14, i, j;
      HOT = mk(VW, HOTPAD + HOTG + RH); var x = HOT.getContext('2d'), G = HOTPAD + HOTG;
      R(x, C.black, 0, 0, VW, HOTPAD + HOTG + RH);
      for (j = 0; j < 16; j++) stip(x, C.h1, Math.pow(j / 16, 2.2) * 0.85, 0, G - 16 + j, VW, 1);   // the town's own glow, low in the sky
      for (j = 0; j < 7; j++) stip(x, C.h2, Math.pow(j / 7, 2.4) * 0.7, 0, G - 7 + j, VW, 1);

      function range(x0, w, h, seed) {                       // an ordinary college range with a tiled roof
        hmass(x, x0, G - h, w, h, 0.22, 0.52);
        for (i = 0; i < w; i += 5) R(x, C.h2, x0 + i, G - h - 2, 3, 2);
        for (i = 3; i < w - 3; i += 7) hwin(x, x0 + i, G - h + 4, 2, 3, ((i + seed) % 3) === 0);
        for (i = 4; i < w - 4; i += 11) hwin(x, x0 + i, G - h + 10, 2, 3, ((i + seed) % 4) === 0);
      }
      function tower(x0, w, h, pin) {                        // a battlemented college tower
        hmass(x, x0, G - h, w, h, 0.28, 0.66);
        for (i = 0; i < w; i += 4) R(x, C.h3, x0 + i, G - h - 3, 2, 3);
        if (pin) { R(x, C.h4, x0 - 1, G - h - 6, 2, 7); R(x, C.h4, x0 + w - 1, G - h - 6, 2, 7); }
        hwin(x, x0 + 2, G - h + 5, 2, 5, 1); if (w > 8) hwin(x, x0 + w - 4, G - h + 5, 2, 5, 0);
        hwin(x, x0 + Math.max(1, (w >> 1) - 1), G - h + 14, 2, 4, 1);
      }
      function chapel(x0, w, h, sh) {                        // a chapel with its spire
        hmass(x, x0, G - h, w, h, 0.24, 0.58);
        hspire(x, x0 + (w >> 1), G - h, sh, Math.max(4, w - 6));
        hwin(x, x0 + 2, G - h + 4, 2, 5, 1);
        if (w > 9) hwin(x, x0 + w - 4, G - h + 4, 2, 5, 0);
      }

      range(0, 18, 11, 1); tower(20, 9, 20, 0); range(31, 14, 9, 2);
      chapel(47, 12, 14, 20);                                // St Peter-in-the-East
      tower(62, 11, 26, 1);                                  // Magdalen
      range(75, 12, 10, 3);
      tower(89, 8, 21, 1); tower(99, 8, 21, 1);              // All Souls, the twins
      hmass(x, 97, G - 9, 2, 9, 0.2, 0.4);
      range(109, 9, 8, 4);
      (function () {                                         // THE RADCLIFFE CAMERA, centre, tallest
        var cx = 134, b = G;
        hmass(x, cx - 17, b - 11, 34, 11, 0.20, 0.50);
        for (i = 0; i < 3; i++) hwin(x, cx - 11 + i * 10, b - 8, 3, 4, i === 1);
        hmass(x, cx - 13, b - 20, 26, 9, 0.30, 0.74);                  // the drum
        for (i = 0; i < 6; i++) { R(x, C.black, cx - 12 + i * 5, b - 19, 2, 8); R(x, C.h5, cx - 10 + i * 5, b - 19, 1, 8); }
        R(x, C.h6, cx - 14, b - 21, 28, 1);
        R(x, C.black, cx - 15, b - 23, 30, 2);                         // balustrade
        for (i = 0; i < 7; i++) R(x, C.h4, cx - 14 + i * 4, b - 22, 2, 1);
        hdome(x, cx, b - 23, 13, 10);                                  // the dome
        for (i = -2; i <= 2; i++) for (j = 0; j < 10; j++) {
          var rx2 = Math.round(cx + i * 5 * (1 - j / 10 * 0.7));
          if (Math.abs(rx2 - cx) > Math.round(13 * Math.sqrt(Math.max(0, 1 - (j / 10) * (j / 10))))) continue;
          R(x, i === 0 ? C.h6 : C.h4, rx2, b - 23 - j, 1, 1);
        }
        R(x, C.black, cx - 4, b - 33, 8, 1);
        R(x, C.h2, cx - 3, b - 38, 6, 5); R(x, C.hw, cx - 2, b - 37, 2, 3); R(x, C.hw, cx + 1, b - 37, 1, 3);
        R(x, C.h5, cx - 4, b - 39, 8, 1);
        R(x, C.h5, cx, b - 43, 1, 4); R(x, C.h5, cx - 2, b - 42, 5, 1);   // the cross
      })();
      range(153, 10, 9, 5);
      chapel(165, 11, 15, 22);                               // St Mary the Virgin
      range(179, 9, 8, 6);
      (function () {                                         // the Sheldonian
        var x0 = 190, b = G;
        hmass(x, x0, b - 11, 22, 11, 0.22, 0.54);
        for (i = 0; i < 3; i++) hwin(x, x0 + 3 + i * 7, b - 8, 2, 4, i === 1);
        hmass(x, x0 + 7, b - 17, 8, 6, 0.36, 0.78);
        hdome(x, x0 + 11, b - 17, 5, 5);
        R(x, C.h5, x0 + 11, b - 25, 1, 4);
      })();
      (function () {                                         // THE INSTITUTE: glass, and the hottest point in the frame
        var x0 = 216, w = 20, h = 30, b = G;
        R(x, C.black, x0 - 2, b - h - 2, w + 4, h + 2);
        for (i = 0; i < w; i++) for (j = 0; j < h; j++) R(x, ditherPick([C.h0, C.h0, C.h1, C.h2], 0.70 - i / w * 0.5, x0 + i, b - h + j), x0 + i, b - h + j, 1, 1);
        for (j = 0; j < h; j += 4) R(x, C.black, x0, b - h + j, w, 1);
        for (i = 0; i < w; i += 5) R(x, C.black, x0 + i, b - h, 1, h);
        for (j = 1; j < h - 2; j += 4) for (i = 1; i < w - 3; i += 5) if (((i * 3 + j * 7) % 11) < 6) R(x, C.h4, x0 + i, b - h + j, 3, 2);
        for (j = -8; j < 20; j++) for (i = -10; i < 24; i++) {
          var d = Math.max(Math.abs(i - 7) / 16, Math.abs(j - 6) / 13);
          if (d <= 1 && d > 0.1) stip(x, C.red1, (1 - d) * 0.5, x0 + i, b - h + j, 1, 1);
        }
        R(x, C.red0, x0 + 3, b - h + 3, 14, 8);                        // the mark
        R(x, C.red2, x0 + 3, b - h + 3, 14, 1);
        R(x, C.black, x0 + 5, b - h + 5, 9, 2); R(x, C.black, x0 + 5, b - h + 5, 3, 4);
        R(x, C.hw, x0 + 9, b - h - 4, 2, 4);
      })();
      range(240, 10, 9, 7);
      (function () {                                         // Tom Tower
        var cx = 262, b = G;
        hmass(x, cx - 11, b - 13, 22, 13, 0.22, 0.56);
        for (i = 0; i < 22; i += 4) R(x, C.h2, cx - 11 + i, b - 15, 2, 2);
        hmass(x, cx - 6, b - 23, 12, 10, 0.34, 0.80);
        hwin(x, cx - 4, b - 20, 2, 6, 1); hwin(x, cx + 1, b - 20, 2, 6, 0);
        hmass(x, cx - 5, b - 28, 10, 5, 0.42, 0.88);
        hdome(x, cx, b - 28, 7, 6);
        R(x, C.h5, cx, b - 38, 1, 4);
      })();
      range(276, 11, 10, 8);
      chapel(290, 10, 13, 18);
      tower(303, 8, 17, 1); range(313, 7, 9, 9);
      R(x, C.h2, 0, G - 1, VW, 1);                           // the ground the city stands on
      R(x, C.black, 0, G, VW, RH);
      var d = null;
      try { d = x.getImageData(0, 0, VW, G).data; } catch (e) { d = null; }
      if (d) for (j = 0; j < RH; j++) {                      // and the water it stands in
        var src = G - 1 - j * 2; if (src < 0) break;
        var wob = Math.round(2.4 * Math.sin(j * 0.75)), lvl = Math.round(16 - j / RH * 10);
        for (i = 0; i < VW; i++) {
          var kk = (src * VW + i) * 4, rr = d[kk], gg = d[kk + 1], bb = d[kk + 2];
          if (rr + gg + bb < 60) continue;
          if (BAYER[((G + j) & 3) * 4 + ((i + wob) & 3)] >= lvl) continue;
          var l = (rr * 2 + gg * 3 + bb) / 1530, idx = Math.round(l * 6 * 0.80) - 1;
          R(x, HR[idx < 0 ? 0 : idx > 6 ? 6 : idx], i + wob, G + j, 1, 1);
        }
      }
    }

    /* ---- THE GIANT CHEQUE. Not hands: a cheque, angled in from both sides so
            its edges converge beneath the skyline exactly where the reference's
            hands do. He only appears as the parts gripping the two corners.    */
    function buildCheque() {
      var SH = 60, TOP = 10, i, j;                                     // sprite row TOP = buffer row CHQY+TOP
      CHEQUE = mk(VW, SH); var x = CHEQUE.getContext('2d');
      function halfw(y) { return 94 + (y - TOP) * 1.8; }
      for (j = TOP; j < SH; j++) {
        var hw2 = Math.round(halfw(j)), x0 = 160 - hw2, w = hw2 * 2;
        if (x0 < 0) { w += x0; x0 = 0; } if (x0 + w > VW) w = VW - x0;
        for (i = 0; i < w; i++) {
          var t = 0.56 - (j - TOP) / 54 * 0.40 + 0.22 * Math.max(0, 1 - Math.abs(x0 + i - 160) / 170);
          R(x, ditherPick(VCH, t, x0 + i, j), x0 + i, j, 1, 1);
        }
        R(x, C.black, x0, j, 1, 1); R(x, C.black, x0 + w - 1, j, 1, 1);
        if (j === TOP) { R(x, C.v6, x0, j, w, 1); R(x, C.v5, x0, j + 1, w, 1); }         // the lit top edge
      }
      // a ruled panel and a watermark band, so it reads as paper not a slab
      for (j = TOP + 3; j < SH; j += 9) stip(x, C.v1, 0.30, 160 - Math.round(halfw(j)) + 4, j, Math.round(halfw(j)) * 2 - 8, 1);
      stip(x, C.v5, 0.12, 20, TOP + 4, 280, SH - TOP - 6);
      function lx(y, pad) { return Math.max(4, Math.round(160 - halfw(y) + pad)); }
      // everything he wrote on it sits clear of the band his hands are holding,
      // and clear of the letterbox bar that crosses the bottom of the sheet
      tiny(x, 'PAY TO THE ORDER OF', 102, TOP + 5, C.v1);   // between the two grips
      tiny(x, 'MT 2026', 186, TOP + 5, C.v1);
      text(x, 'THE UNIVERSITY OF OXFORD', 40, TOP + 15, 8, C.v6, 1);
      R(x, C.black, 150, TOP + 24, 152, 12);                                             // the amount box
      R(x, C.v5, 150, TOP + 24, 152, 1); R(x, C.v5, 150, TOP + 35, 152, 1);
      R(x, C.v5, 150, TOP + 24, 1, 12); R(x, C.v5, 301, TOP + 24, 1, 12);
      text(x, '1,000,000,000', 164, TOP + 26, 8, C.v6, 1);
      tiny(x, 'SIGNED', 26, TOP + 24, C.v1);
      text(x, 'MR. E', 26, TOP + 28, 8, C.v6, 1);
      for (i = 0; i < 56; i++) R(x, C.v4, 24 + i, TOP + 35 + Math.round(2.2 * Math.sin(i * 0.36)), 1, 1);   // the scrawl
      /* --- his hands. A wrist coming in from off frame, the back of the hand over the
             corner, a knuckle line, and four fingers of graded length hooked over the top
             edge so their lower halves lie FLAT on the front of the paper, each throwing a
             dithered shadow onto it. They hold the sheet. They enclose nothing.        */
      var FCOL = [C.v2, C.v4, C.v6, C.v5, C.v3, C.v1];      // one finger, across: a lit cylinder
      var FU = [26, 34, 42, 50], FL = [15, 22, 20, 13];     // where each finger sits and how far down it reaches
      var FLEAN = [-0.14, -0.05, 0.05, 0.15], FW = 6;       // and how it splays as it goes
      var FTOP = TOP - 7;
      function pshade(x0, y0, w3, h3, a3) {                 // a shadow, and only where there is paper to fall on
        var jj, lo, hi3, hwj;
        for (jj = y0; jj < y0 + h3; jj++) {
          if (jj < TOP + 1 || jj > TOP + 14) continue;
          hwj = Math.round(halfw(jj));
          lo = Math.max(x0, 160 - hwj + 1); hi3 = Math.min(x0 + w3, 160 + hwj - 1);
          if (hi3 > lo) stip(x, C.v1, a3, lo, jj, hi3 - lo, 1);
        }
      }
      function hand(ax, dir) {
        var u, k, c, jj, X, hh, cy2, nu, t3, fb, ky, th4, ln, wd;
        function SX(u2, w2) { return dir > 0 ? ax + u2 : ax - u2 - w2 + 1; }
        // the forearm, leaving the frame at the top corner
        for (u = -48; u <= 2; u++) {
          X = SX(u, 1); if (X < -1 || X > VW) continue;
          cy2 = 7 + Math.round(u * 0.10);
          hh = 3 + Math.round(1.2 * Math.max(0, Math.min(1, (u + 26) / 26)));
          for (jj = -hh; jj <= hh; jj++)
            R(x, ditherPick(VSU, 0.20 + 0.30 * (1 - Math.abs(jj + 2) / (hh + 3)), X, cy2 + jj), X, cy2 + jj, 1, 1);
          R(x, C.v4, X, cy2 - hh, 1, 1);
          R(x, C.black, X, cy2 - hh - 1, 1, 1); R(x, C.black, X, cy2 + hh + 1, 1, 2);
        }
        // the back of the hand, over the corner of the sheet, heel of the thumb below it
        for (u = 0; u <= 26; u++) {
          nu = u / 26; X = SX(u, 1);
          hh = 4 + Math.round(3 * Math.sin(Math.min(1, nu * 1.3) * 3.14159));
          th4 = (u > 2 && u < 18) ? Math.round(2 * Math.sin((u - 2) / 16 * 3.14159)) : 0;
          cy2 = 7 + Math.round(nu * 2);
          for (jj = -hh; jj <= hh + th4; jj++) {
            t3 = 0.24 + 0.34 * (1 - Math.abs(jj + 3) / (hh + 4)) - 0.08 * nu - 0.18 * (jj > hh ? 1 : 0);
            R(x, ditherPick(VSU, t3, X, cy2 + jj), X, cy2 + jj, 1, 1);
          }
          R(x, C.v4, X, cy2 - hh, 1, 1); R(x, C.v5, X, cy2 - hh + 1, 1, 1);
          R(x, C.black, X, cy2 - hh - 1, 1, 1); R(x, C.black, X, cy2 + hh + th4 + 1, 1, 2);
          if (th4 > 2) R(x, C.v1, X, cy2 + hh, 1, 2);                    // the crease of the thumb's heel
        }
        // the knuckles, riding over the base of each finger
        for (u = FU[0] - 7; u <= FU[3] + FW + 1; u++)
          R(x, C.v1, SX(u, 1), FTOP - 1 + Math.round((u - FU[0]) * 0.07), 1, 2);
        for (k = 0; k < 4; k++) {
          R(x, C.v5, SX(FU[k] + 1, 4), FTOP - 4, 4, 1);
          R(x, C.v6, SX(FU[k] + 2, 2), FTOP - 5, 2, 1);
        }
        // and the fingers themselves, hooked over the top edge and down the front of the sheet
        for (k = 0; k < 4; k++) {
          fb = FTOP + FL[k] - 1;
          for (jj = FTOP; jj <= fb; jj++) {
            ln = Math.round((jj - FTOP) * FLEAN[k]);
            wd = jj >= fb ? 3 : jj >= fb - 1 ? 4 : jj >= fb - 2 ? 5 : FW;   // the tip, rounded off
            for (c = (FW - wd) >> 1; c < ((FW - wd) >> 1) + wd; c++) {
              R(x, FCOL[c], SX(FU[k] + ln + c, 1), jj, 1, 1);
              if ((jj - FTOP) > FL[k] * 0.55) stip(x, C.v1, (jj - FTOP - FL[k] * 0.55) / FL[k] * 0.7, SX(FU[k] + ln + c, 1), jj, 1, 1);
            }
            R(x, C.black, SX(FU[k] + ln + ((FW - wd) >> 1) - 1, 1), jj, 1, 1);
            R(x, C.black, SX(FU[k] + ln + ((FW - wd) >> 1) + wd, 1), jj, 1, 1);
          }
          R(x, C.v6, SX(FU[k] + 2, 2), FTOP, 2, 4);                      // the light coming over the top edge
          ky = FTOP + Math.round(FL[k] * 0.40); ln = Math.round((ky - FTOP) * FLEAN[k]);
          R(x, C.v1, SX(FU[k] + ln, FW), ky, FW, 1); R(x, C.v5, SX(FU[k] + ln + 1, 4), ky + 1, 4, 1);
          ky = FTOP + Math.round(FL[k] * 0.72); ln = Math.round((ky - FTOP) * FLEAN[k]);
          R(x, C.v1, SX(FU[k] + ln, FW), ky, FW, 1); R(x, C.v4, SX(FU[k] + ln + 1, 4), ky + 1, 4, 1);
          ln = Math.round((fb - FTOP) * FLEAN[k]);
          R(x, C.black, SX(FU[k] + ln + 1, 4), fb + 1, 4, 1);            // and the black under the tip
        }
        // the shadow the grip throws on the sheet, where the paper is open enough to show it
        for (k = 0; k < 4; k++) {
          fb = FTOP + FL[k] - 1; ln = Math.round((fb - FTOP) * FLEAN[k]);
          pshade(SX(FU[k] + ln + 2, FW) + dir, fb + 1, FW, 4, 0.75);
          pshade(SX(FU[k] + ln + 4, FW) + dir * 2, fb + 3, FW, 3, 0.34);
        }
        for (jj = FTOP + 5; jj <= TOP + 14; jj++) {                       // and down its inner side
          ln = Math.round((jj - FTOP) * FLEAN[3]);
          pshade(SX(FU[3] + ln + FW + 1, 5), jj, 5, 1, 0.72);
          pshade(SX(FU[3] + ln + FW + 5, 4), jj + 2, 4, 1, 0.32);
        }
      }
      hand(34, 1); hand(286, -1);
      stip(x, C.black, 0.62, 0, 0, VW, 1);                               // the arms come out of the black, not out of a cut
      stip(x, C.black, 0.34, 0, 1, VW, 1);
    }

    /* ---------------------------------------------------------------- the photograph */
    // intro-b's composition: MR. E in mirrored shades shaking hands with a gowned,
    // mortarboarded figure in front of the scaffolded Institute. And then it burns.
    var PHOTO = null, PHW = 148, PHH = 108, PHBURN = [[96, 44], [30, 66], [124, 24], [56, 14], [138, 82], [12, 26]];
    function buildPhoto() {
      PHOTO = mk(PHW, PHH); var x = PHOTO.getContext('2d'), i, j, r = rng(4242);
      R(x, C.suit0, 0, 0, PHW, PHH); R(x, C.suit2, 0, PHH - 3, PHW, 3);
      R(x, C.black, 0, 0, PHW, 1); R(x, C.black, 0, 0, 1, PHH);
      var ax = 6, ay = 6, aw = PHW - 12, ah = 76, g = ay + ah - 12;
      R(x, C.black, ax - 1, ay - 1, aw + 2, ah + 2);
      ramp(x, ax, ay, aw, ah - 12, [C.suit0, C.grey, C.suit1, C.suit0]);         // a sky blown out by the flash
      for (i = 0; i < 34; i++) R(x, C.suit2, ax + ((r() * aw) | 0), ay + ((r() * 30) | 0), 1, 1);
      // the half-built Institute, in scaffolding
      var bx = ax + 68, bw = 52, by = ay + 12;
      R(x, C.steelD, bx, by, bw, g - by);
      for (j = by; j < g; j += 7) R(x, C.suit0, bx, j, bw, 1);
      for (i = bx; i < bx + bw; i += 7) R(x, C.suit0, i, by, 1, g - by);
      for (j = 0; j < 6; j++) for (i = 0; i < 7; i++) if ((i * 3 + j * 5) % 7 < 3) R(x, C.grey, bx + 1 + i * 7, by + 1 + j * 7, 5, 5);
      R(x, C.greyD, bx + bw - 3, ay + 1, 3, g - ay - 1);                          // the crane
      R(x, C.greyD, bx + 4, ay + 2, 50, 3); R(x, C.greyD, bx + 16, ay + 5, 2, 18); R(x, C.grey, bx + 13, ay + 23, 8, 5);
      R(x, C.steelD, ax, g, aw, 12); for (i = ax; i < ax + aw; i += 8) R(x, C.suit0, i, g, 1, 12);   // the hoarding
      stip(x, C.suit0, 0.5, ax + 18, g - 5, 70, 5);
      // MR. E: cream suit, mirrored lenses, cigar
      var ex = ax + 40, ey = g - 32;
      for (j = 0; j < 26; j++) R(x, C.suit2, ex - 9 - Math.round(j * 0.24), g - 26 + j, 19 + Math.round(j * 0.48), 1);
      R(x, C.black, ex - 9, g - 26, 1, 26); R(x, C.black, ex + 10, g - 26, 1, 26);
      R(x, C.black, ex - 3, g - 26, 7, 26); R(x, C.red1, ex - 2, g - 25, 3, 15);
      R(x, C.suit3, ex - 9, g - 26, 5, 12); R(x, C.suit3, ex + 5, g - 26, 5, 12);
      disc(x, C.skin1, ex, ey, 8, 9);
      R(x, C.hair0, ex - 8, ey - 9, 17, 4); disc(x, C.hair0, ex, ey - 6, 8, 3); R(x, C.black, ex - 8, ey - 10, 17, 2);
      R(x, C.black, ex - 7, ey - 3, 15, 4); R(x, C.glass2, ex - 6, ey - 2, 5, 2); R(x, C.glass2, ex + 2, ey - 2, 5, 2);
      R(x, C.skin2, ex - 4, ey + 1, 9, 2);
      R(x, C.tooth, ex - 5, ey + 4, 11, 3); R(x, C.black, ex - 5, ey + 7, 11, 1);
      R(x, C.cigar, ex + 6, ey + 3, 9, 2); R(x, C.ember, ex + 15, ey + 3, 2, 2);
      // the Vice-Chancellor: gown, mortarboard, chain of office
      var vx = ex + 38, vy = ey + 2;
      for (j = 0; j < 29; j++) R(x, C.black, vx - 11 - Math.round(j * 0.28), g - 29 + j, 23 + Math.round(j * 0.56), 1);
      R(x, C.steelD, vx - 5, g - 24, 10, 18); R(x, C.black, vx - 1, g - 24, 2, 18);
      R(x, C.gold, vx - 5, g - 19, 11, 2); R(x, C.gold, vx - 2, g - 17, 4, 3);
      disc(x, C.skin0, vx, vy, 7, 8); R(x, C.suit0, vx - 7, vy + 4, 15, 3);
      R(x, C.black, vx - 11, vy - 10, 23, 3); R(x, C.black, vx - 5, vy - 8, 11, 5); R(x, C.skin2, vx - 4, vy - 1, 9, 2);
      R(x, C.gold, vx + 12, vy - 8, 2, 9); R(x, C.gold, vx + 11, vy + 1, 4, 3);
      // the handshake, dead centre, where the photographer wanted it
      R(x, C.black, ex + 15, g - 21, 20, 8); R(x, C.skin0, ex + 16, g - 20, 18, 6); R(x, C.skin2, ex + 16, g - 17, 18, 2);
      for (i = 0; i < aw; i++) for (j = 0; j < ah; j++) if (BAYER[((j & 3) << 2) + (i & 3)] < 2) R(x, C.suit0, ax + i, ay + j, 1, 1);   // flash bloom
      R(x, C.black, ax - 1, ay - 1, aw + 2, 1); R(x, C.black, ax - 1, ay + ah, aw + 2, 1);
      R(x, C.black, ax - 1, ay - 1, 1, ah + 2); R(x, C.black, ax + aw, ay - 1, 1, ah + 2);
      tiny(x, 'DONOR RELATIONS, 2026', 8, PHH - 20, C.steelD);
      tiny(x, 'THE BENEFACTION', 8, PHH - 12, C.hair1);
    }
    var burnC = null, shadC = null, PHOFF = 4;          // PHOFF: how far the drop shadow sits behind the print
    // the snapshot catches and curls away in orange and yellow. The shadow it casts is
    // a silhouette of whatever is LEFT of the print, so it burns away with the picture
    // instead of outliving it as a black box.
    function drawPhotoAt(x, px, py, burn) {
      if (!burnC) burnC = mk(PHW, PHH);
      if (!shadC) shadC = mk(PHW, PHH);
      var Q = burnC.getContext('2d'), S = shadC.getContext('2d'), i, hr;
      Q.imageSmoothingEnabled = false; S.imageSmoothingEnabled = false;
      Q.globalCompositeOperation = 'source-over';
      Q.clearRect(0, 0, PHW, PHH); Q.drawImage(PHOTO, 0, 0);
      if (burn > 0) {
        Q.globalCompositeOperation = 'destination-out';
        for (i = 0; i < PHBURN.length; i++) { hr = (burn - i * 0.13) * 74; if (hr > 0) disc(Q, '#fff', PHBURN[i][0], PHBURN[i][1], hr, hr * 0.92); }
        Q.globalCompositeOperation = 'source-atop';
        for (i = 0; i < PHBURN.length; i++) { hr = (burn - i * 0.13) * 74; if (hr > 0) disc(Q, C.cigarD, PHBURN[i][0], PHBURN[i][1], hr + 9, (hr + 9) * 0.92); }
        for (i = 0; i < PHBURN.length; i++) { hr = (burn - i * 0.13) * 74; if (hr > 0) disc(Q, C.ember, PHBURN[i][0], PHBURN[i][1], hr + 5, (hr + 5) * 0.92); }
        for (i = 0; i < PHBURN.length; i++) { hr = (burn - i * 0.13) * 74; if (hr > 0) disc(Q, C.gold, PHBURN[i][0], PHBURN[i][1], hr + 2, (hr + 2) * 0.92); }
        Q.globalCompositeOperation = 'source-over';
      }
      S.globalCompositeOperation = 'source-over';
      S.clearRect(0, 0, PHW, PHH); S.drawImage(burnC, 0, 0);
      S.globalCompositeOperation = 'source-in';                 // keep the alpha, throw the colour away
      S.fillStyle = C.black; S.fillRect(0, 0, PHW, PHH);
      S.globalCompositeOperation = 'source-over';
      x.drawImage(shadC, px + PHOFF, py + PHOFF);
      x.drawImage(burnC, px, py);
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
    var built = false, builtCast = false;
    function buildAll() {                                   // only what the attract needs, so page load stays cheap
      if (built) return; built = true;
      buildSky(); buildStars(); buildFar(); buildMid(); buildInstLit(); buildNear(); buildTitle();
    }
    function buildCast() {                                  // the reveal, built when the cinematic starts
      if (builtCast) return; builtCast = true;
      MRE = [buildMrE(0), buildMrE(1)];
      buildHot(); buildCheque(); buildPhoto();
    }

    var KEYS = [[1.875, 60], [11.25, 240], [20.625, 545], [26.25, 600], [28.125, 620], [37.5, 620]];
    function camAt(t) {
      if (t <= KEYS[0][0]) return KEYS[0][1];
      for (var i = 1; i < KEYS.length; i++) if (t <= KEYS[i][0]) {
        var a = KEYS[i - 1], b = KEYS[i], u = (t - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * u;
      }
      return KEYS[KEYS.length - 1][1];
    }
    function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
    function win(t, a, b, fi, fo) { if (t < a || t > b) return 0; return Math.min(smooth((t - a) / fi), smooth((b - t) / fo)); }

    function smoke(x, sx, sy, t, n, str, col) {
      for (var k = 0; k < n; k++) {
        var age = ((t * 0.155 + k / n) % 1);
        var py = sy - age * 150, px = sx + Math.sin(age * 4.6 + k * 2.1) * 16 + age * 62;
        var rad = 4 + age * 17, a = str * Math.pow(1 - age, 0.75) * (age < 0.1 ? age / 0.1 : 1);
        if (a <= 0.02) continue;
        for (var j = -rad; j <= rad; j++) {
          var w = Math.round(Math.sqrt(Math.max(0, rad * rad - j * j)));
          if (w < 1) continue;
          stip(x, (age > 0.45 ? col[0] : col[1]), a * 0.55, Math.round(px - w), Math.round(py + j), w * 2, 1);
        }
      }
    }

    /* ---------------------------------------------------------------- the beat sheet (128 BPM, one bar = 1.875 s) */
    var beats = [
      { t: 0.000, name: 'black' }, { t: 1.875, name: 'fadeup' }, { t: 5.625, name: 'line1' },
      { t: 9.375, name: 'line2' }, { t: 13.125, name: 'photo' }, { t: 18.750, name: 'photoOut' },
      { t: 20.625, name: 'institute' }, { t: 24.375, name: 'line5' }, { t: 26.250, name: 'rumble' },
      { t: 28.125, name: 'mrE' }, { t: 30.000, name: 'name' }, { t: 31.875, name: 'laugh' },
      { t: 33.750, name: 'logoSlam' }, { t: 35.625, name: 'settle' }, { t: 37.500, name: 'end' }
    ];
    // the driest lines of the three candidates, on intro-a's bar lines.
    // [in, out, [[text, px, colour], ...]]
    var LINES = [
      [5.625, 9.000, [['OXFORD. EIGHT HUNDRED YEARS OF', 8, C.white], ['PEER REVIEW AND BAD PLUMBING.', 8, C.grey]]],
      [9.375, 12.750, [['THEN THE MONEY ARRIVED.', 8, C.white], ['IT DID NOT APPLY FOR ETHICS APPROVAL.', 8, C.grey]]],
      [15.000, 17.850, [['NAMING RIGHTS CEREMONY, 2026.', 8, C.gold], ['HE DID NOT STAY FOR THE LUNCH.', 8, C.white]]],
      [20.625, 24.000, [['PLANNING PERMISSION', 8, C.white], ['GRANTED.', 24, C.gold]]],
      [24.375, 27.375, [['NOBODY VOTED FOR IT.', 8, C.white], ['IT HAS A ROOF TERRACE.', 8, C.grey]]]
    ];

    /* ---------------------------------------------------------------- drawing */
    var buf = null, bx = null, view = null, vx = null, host = null, revC = null;

    function scrim(x, y0, h, a) { stip(x, C.black, a, 0, y0, VW, h); }
    function plate(x, str, cy, size, col, a) {                       // a small fitted bar so text never fights the city
      var w = txtW(str, size) + 12, x0 = Math.round((VW - w) / 2);
      stip(x, C.black, a * 0.72, x0, cy - 3, w, size + 6);
      textOC(x, str, 160, cy, size, col, C.black, a);
      return [x0, cy - 3, x0 + w, cy + size + 3];
    }
    function bars(x, h) {
      if (h <= 0) return;
      R(x, C.black, 0, 0, VW, h); R(x, C.black, 0, VH - h, VW, h);
      R(x, C.steelD, 0, h, VW, 1); R(x, C.steelD, 0, VH - h - 1, VW, 1);
    }

    function drawCity(x, cam, t, ignite, emberOnly, mask, full) {
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
      if (ignite > 0) {
        var ix = INSTX - 7 - mid;
        if (ignite >= 1) x.drawImage(INST, ix, INSTY - 7);
        else { x.save(); x.beginPath(); x.rect(ix, INSTY - 7, INST.width, INST.height); x.clip(); x.drawImage(INST, ix, INSTY - 7); stip(x, C.black, 1 - ignite, ix, INSTY - 7, INST.width, INST.height); x.restore(); }
        for (var gk = 0; gk < 6; gk++) stip(x, C.red1, 0.20 * ignite * Math.pow(1 - gk / 6, 2.4), ix + 20 - gk * 12, 44 - gk * 17, INST.width - 40 + gk * 24, 44 + gk * 32);
      }
      if (emberOnly) {
        R(x, C.ember, 222, 170, 2, 2); stip(x, C.red1, 0.28, 218, 166, 10, 8);
        smoke(x, 223, 168, t, 9, 0.85, [C.greyD, C.grey]);
      }
      x.drawImage(NEAR, -near, 0);
      drawSigns(x, mid, t, mask, full);     // last, so no near rooftop ever cuts a joke in half
    }

    /* ---- the reveal, composed as a vertical stack against pure black ---- */
    function drawReveal(x, t) {
      var u = t - 28.125, i;
      R(x, C.black, 0, 0, VW, VH);
      // Oxford, hot, and its reflection. It is already there; he arrives over it.
      var ha = Math.min(1, Math.max(0, u / 0.65));
      blitDither(x, HOT, 0, HOTY - HOTPAD, Math.round(ha * 16));
      // MR. E: cold violet, cropped by the top edge, dissolving up out of the black
      var fa = Math.min(1, Math.max(0, (u - 0.18) / 1.30));
      var fy = FACE_Y - 22 + Math.round(22 * smooth(fa));
      var lp = t - 31.875, laughF = (lp >= 0 && lp < 1.875) ? (((lp % 0.46875) < 0.26) ? 1 : 0) : 0;
      var flv = Math.min(1, fa * 1.2) * (1 - smooth((t - 35.625) / 1.1));
      blitDither(x, MRE[laughF], 0, fy + (laughF ? 2 : 0), Math.round(flv * 16));
      if (fa > 0.4 && flv > 0.3) smoke(x, 249, fy + 62, t, 11, 0.85 * flv, [C.v1, C.v2]);
      // the nameplate holds the lower third until the laugh; then the cheque takes it
      var np = win(t, 30.0, 31.95, 0.22, 0.20);
      if (np > 0) {
        var ny = 172 + Math.round((1 - smooth(np)) * 56);
        R(x, C.black, 0, ny, VW, VH - ny);
        R(x, C.v4, 0, ny, VW, 1); R(x, C.mo2, 0, ny + 2, VW, 1);
        text(x, 'MR. E', 14, ny + 6, 16, C.white, 1);
        text(x, 'THE BENEFACTOR', 110, ny + 12, 8, C.gold, 1);
        text(x, 'FUNDER. FOUNDER. LANDLORD.', 14, ny + 28, 8, C.grey, 1);
      }
      var cq = t - 31.875;
      if (cq > 0) {
        var cy = CHQY + Math.round((1 - smooth(Math.min(1, cq / 0.5))) * 66);
        x.drawImage(CHEQUE, 0, cy);
      }
      // HA HA, chunky and yellow, floating over the skyline
      if (lp >= 0 && t < 33.9) {
        // gold is warm, so every one of them lives over the hot skyline (rows 134-172),
        // never in the cold upper half and never on the Institute's mark (x 206-246).
        var HA = [[0.00, 250, 150, 20], [0.42, 14, 146, 24], [0.86, 160, 152, 16], [1.28, 66, 146, 24]];
        for (i = 0; i < HA.length; i++) {
          var a = lp - HA[i][0];
          if (a < 0 || a > 1.15) continue;
          textO(x, 'HA', HA[i][1], HA[i][2] - Math.round(a * 11), HA[i][3], a < 0.09 ? C.white : C.gold, C.black, 1);
        }
      }
    }

    function drawAttract(x, t) {
      var cam = 290 + 30 * Math.sin(t / 12 * 6.28318530718);
      drawCity(x, cam, t, 0, false, null, 1);
      x.drawImage(TITLE, Math.round((VW - TITLEW) / 2), 18);
      scrim(x, 150, 58, 0.48);
      if ((t % 1.0) < 0.62) textOC(x, 'INSERT COIN', 160, 158, 16, C.gold, C.black, 1);
      textOC(x, 'CLICK FOR SOUND', 160, 182, 8, C.grey, C.black, 1);
      textOC(x, '1 CREDIT = 1 CAREER', 160, 196, 8, C.greyD, C.black, 1);
    }

    function card(x, t) {
      var i, k, L = null, s = 0;
      for (i = 0; i < LINES.length; i++) if (t >= LINES[i][0] && t < LINES[i][1]) { L = LINES[i]; s = t - LINES[i][0]; }
      if (!L) return;
      var rows = L[2], n = rows.length, hs = 0;
      for (k = 0; k < n; k++) hs += rows[k][1] + (k ? 9 : 0);
      var a = Math.min(smooth(s / 0.42), smooth((L[1] - t) / 0.5));
      if (a <= 0) return;
      var y0 = 186 - hs, jit = s < 0.05 ? 2 : s < 0.1 ? -1 : 0, yy = y0;
      // the band belongs to the words: it arrives with them, at their alpha, and only as
      // deep as the rows that have actually landed. At full alpha it is solid, so no stray
      // ember can ever read as a glyph; at no alpha there is no bare black bar.
      var deep = 0;
      for (k = 0; k < n; k++) if (s >= k * 0.5) deep += rows[k][1] + (k ? 9 : 0);
      stip(x, C.black, a, 0, y0 - 4, VW, deep + 8);
      stip(x, C.black, 0.62 * a, 0, y0 - 11, VW, 7);
      stip(x, C.black, 0.62 * a, 0, y0 + deep + 4, VW, 7);
      stip(x, C.steelD, a, 0, y0 - 11, VW, 1); stip(x, C.steelD, a, 0, y0 + deep + 10, VW, 1);
      for (k = 0; k < n; k++) {
        if (s < k * 0.5) break;
        var fresh = (s - k * 0.5) < 0.09;
        textOC(x, rows[k][0], 160 + (k ? 0 : jit), yy, rows[k][1], fresh ? C.white : rows[k][2], C.black, a);
        yy += rows[k][1] + 9;
      }
    }

    function drawCinematic(x, t) {
      var cam = camAt(t), i;
      var ignite = t < 20.625 ? 0 : (((t - 20.625) < 0.3 || ((t - 20.625) > 0.55 && (t - 20.625) < 0.75)) ? 0.35 : Math.min(1, (t - 20.625) / 1.4));
      var lp = t - 31.875, laughF = (lp >= 0 && lp < 1.875) ? (((lp % 0.46875) < 0.26) ? 1 : 0) : 0;
      var shake = 0;
      if (t > 26.25 && t < 28.125) shake = 1 + smooth((t - 26.25) / 1.875) * 2;
      if (t >= 28.125 && t < 30.0) shake = 2;
      if (laughF) shake = 3;
      if (t >= 33.75 && t < 34.35) shake = 6 * (1 - (t - 33.75) / 0.6);
      var sx = shake ? Math.round(Math.sin(t * 91) * shake) : 0, sy = shake ? Math.round(Math.cos(t * 73) * shake * 0.7) : 0;
      R(x, C.black, 0, 0, VW, VH);
      x.save(); x.translate(sx, sy);
      if (t < 28.125) {
        drawCity(x, cam, t, ignite, false, null, 1);   // full: a sign crossing the frame edge is culled, never half-drawn
        if (t > 27.25) stip(x, C.black, smooth((t - 27.25) / 0.875), 0, 0, VW, VH);   // and then the town goes out
      } else {
        if (!builtCast) buildCast();
        drawReveal(x, t);
      }
      x.restore();
      // the photograph, and the fire that takes it
      var pa = win(t, 13.125, PHOTO_OUT, 0.3, 0.30);
      if (pa > 0) {
        if (!builtCast) buildCast();
        var slide = Math.round(158 + 180 * (1 - smooth((t - 13.125) / 0.5)));
        x.save(); x.beginPath(); x.rect(0, 0, VW, VH); x.clip();
        drawPhotoAt(x, slide, 32, Math.max(0, t - PHOTO_BURN));
        if (pa < 1 && t < 15) stip(x, C.black, 1 - pa, slide, 32, PHW, PHH);
        x.restore();
      }
      card(x, t);
      // the title slams in
      if (t >= 33.75) {
        stip(x, C.black, 0.20 * (1 - smooth((t - 33.9) / 2.2)), 0, 0, VW, VH);
        var u = (t - 33.75) / 0.22, ty;
        if (u < 1) ty = Math.round(-TITLEH + (18 + TITLEH) * smooth(u));
        else ty = 18 + (t - 33.97 < 0.12 ? 4 : 0);
        x.drawImage(TITLE, Math.round((VW - TITLEW) / 2), ty);
        plate(x, 'THE ROAD TO PUBLICATION', 118, 8, C.gold, win(t, 35.625, 44, 0.35, 0.5));
        var fa = 1 - (t - 33.75) / 0.42;
        if (fa > 0) stip(x, C.white, fa, 0, 0, VW, VH);
      }
      // fade up from black, and back down into it for the cut to the title card
      if (t < 3.75) stip(x, C.black, t < 1.875 ? 1 : 1 - (t - 1.875) / 1.875, 0, 0, VW, VH);
      if (t > 36.4) stip(x, C.black, Math.min(1, (t - 36.4) / 1.0), 0, 0, VW, VH);
      // the letterbox: this is a cinematic, and the intertitles live in it
      bars(x, Math.round(LBH * Math.min(smooth((t - 0.2) / 0.6), smooth((CIN_END - t) / 0.6))));
      if (t > 2.2 && t < 33.0 && ((t % 2.4) < 1.9)) text(x, 'SKIP >>', VW - 62, VH - LBH + 1, 8, C.grey, 1);
    }

    function drawTitleCard(x, t) {
      var cam = 560 + 7 * Math.sin(t / 19 * 6.28318530718);
      var pl = [62, 123, 258, 137];                                 // where the subtitle plate lands
      drawCity(x, cam, t + 40, 1, true, pl, 1);                        // the Institute stays lit; it is not going anywhere
      x.drawImage(TITLE, Math.round((VW - TITLEW) / 2), 18 + (Math.sin(t * 1.1) > 0.97 ? 1 : 0));
      plate(x, 'THE ROAD TO PUBLICATION', 126, 8, C.gold, 1);
      scrim(x, 138, 78, 0.80);
      textOC(x, 'MR. E IS WAITING IN THE ATRIUM', 160, 146, 8, C.grey, C.black, 1);
      if ((t % 1.0) < 0.62) textOC(x, 'PRESS START', 160, 162, 16, C.white, C.black, 1);
      textOC(x, '© 2026 D. PALMER', 160, 186, 8, C.grey, C.black, 1);
      textOC(x, 'ETHICS APPROVAL PENDING', 160, 196, 8, C.greyD, C.black, 1);
      text(x, 'CREDIT 01', 8, 205, 8, C.greyD, 1);
      if (t < 0.7) stip(x, C.black, 1 - t / 0.7, 0, 0, VW, VH);
      if (flourish > 0) {
        textOC(x, 'PRESS START', 160, 162, 16, C.gold, C.black, 1);
        stip(x, C.white, Math.max(0, 1 - flourish / 0.30), 0, 0, VW, VH);
      }
    }

    /* ---------------------------------------------------------------- the machine */
    // _seek / _setPhase / _buffer are test hooks: they let a harness land on an exact
    // frame deterministically. Nothing in the host needs them.
    var self = { start: start, click: click, stop: stop, phase: 'attract', active: false, beats: beats, startError: null,
                 drawErrors: 0, drawError: null,
                 _seek: seek, _setPhase: setPhase, _buffer: function () { return buf; } };
    var opts = null, raf = 0, last = 0, T = 0, audioClock = null, audioT0 = 0, flourish = 0, doneTimer = 0, doneSent = false, scoreSent = false, onRes = null, frozen = false;

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
        else if (self.phase === 'cinematic') drawCinematic(bx, T);
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
      if (self.phase === 'cinematic' && T >= CIN_END) setPhase('title');
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
      if (name !== 'attract' && name !== 'cinematic' && name !== 'title') return;
      self.phase = name; T = 0; flourish = 0;
      if (name === 'cinematic') { try { buildCast(); } catch (e) { } }
      if (name === 'cinematic' && !scoreSent) {
        scoreSent = true;
        try { if (opts && opts.onScore) opts.onScore('title'); } catch (e) { }
        // The cinematic is scored to picture: fifteen beats on bar lines at 128 BPM. Wall-clock frame
        // deltas drift against the audio clock, and a few dropped frames would put the picture
        // permanently behind the music, so from here the cinematic is driven BY the audio clock.
        try {
          var ac0 = api && api.audio && api.audio();
          if (ac0 && typeof ac0.currentTime === 'number') { audioClock = ac0; audioT0 = ac0.currentTime; }
        } catch (e) { audioClock = null; }
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
      if (audioClock && self.phase === 'cinematic') {          // lock the picture to the score
        var want = audioClock.currentTime - audioT0, drift = want - T;
        if (drift > -2 && drift < 8) dt = drift > 0 ? drift : 0;   // a suspended or reset context falls back to dt
        else audioT0 = audioClock.currentTime - T;
      }
      update(dt);
      render();
    }

    function click() {
      if (!self.active) return false;
      frozen = false;
      try {
        if (self.phase === 'attract') { setPhase('cinematic'); return true; }
        if (self.phase === 'cinematic') { audioClock = null; setPhase('title'); return true; }
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
        opts = o || {}; host = opts.host;
        if (!host) return;
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
          document.fonts.ready.then(function () {
            try {
              clearText(); TITLE = null; buildTitle();
              if (builtCast) { CHEQUE = null; PHOTO = null; buildCheque(); buildPhoto(); }
              render();
            } catch (e) { }
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
        if (view && view.parentNode) view.parentNode.removeChild(view);
        view = null; vx = null; host = null;
      } catch (e) { }
    }

    return self;
  };
})();
