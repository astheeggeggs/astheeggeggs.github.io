
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
