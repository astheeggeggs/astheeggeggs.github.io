
    /* ------------------------------------------------------------ drawing: the playfield (360 x H logical pixels) */
    var overlay = null, styleEl = null, scr = null, sx = null, pf = null, g = null, endEl = null, bombBtn = null, pauseBtn = null;
    var narrow = false, fixedOn = false, dpr = 1, U = 1, pfX = 0, pfY = 0, pfW = 0, pfH = 0, scrW = 0, scrH = 0, gFont = 0, zig = new Float32Array(16);
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
      var k, wh = e.flash > 0 && ((G.t * 40) | 0) % 2 === 0, jx = e.dying > 0 ? ((Math.random() * 5) | 0) - 2 : 0, x = Math.round(e.x) + jx, y = Math.round(e.y);
      if (e.type === 'typesetter') {
        g.drawImage(wh ? WHT.typesetter : SPR.typesetter, x - 78, y - 44);
        var pulse = 0.5 + 0.5 * Math.sin(G.t * 9); g.fillStyle = e.phase ? '#ff4fa3' : '#e3625b'; g.fillRect(x - 9, y - 14, 18, 12); g.fillStyle = '#fff'; g.globalAlpha = 0.4 + pulse * 0.6; g.fillRect(x - 5, y - 11, 10, 6); g.globalAlpha = 1;
        return;
      }
      for (var pass = 0; pass < 2; pass++) {
        if (pass === 1) {
          g.save(); g.translate(x, y); g.rotate(e.t * (e.phase === 2 ? 2.4 : 0.7)); g.drawImage(wh ? GEAR[2] : GEAR[e.phase === 2 ? 1 : 0], -56, -56); g.restore();
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
        var name = e.type === 'bracket' && e.a2 === -1 ? 'bracketR' : e.type, sp = e.flash > 0 ? WHT[name] : SPR[name];
        g.drawImage(sp, Math.round(e.x - sp.width / 2), Math.round(e.y - sp.height / 2));
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
      if (G.sayT > 0 && G.sayLines) { var n = Math.floor(G.sayN), yy = H - 58 - G.sayLines.length * 10; txt(G.who, W / 2, yy, 8, '#fcd34d'); for (k = 0; k < G.sayLines.length && n > 0; k++) { yy += 11; txt(G.sayLines[k].slice(0, n), W / 2, yy, 8, '#fff'); n -= G.sayLines[k].length; } }
    }
