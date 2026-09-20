
    /* ------------------------------------------------------------ DOM: style, HP bar, banner, countdown, flash */
    var dom = {};
    var CSS = [
      '.qb-card{position:absolute;inset:0;z-index:8;background:#010504;cursor:pointer;overflow:hidden;transform-origin:50% 50%}',
      '.qb-card canvas{width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges}',
      '.qb-card.is-off{transition:transform .2s ease-in,filter .2s;transform:scale(1,.004);filter:brightness(4)}',
      '.qb-hp{position:absolute;left:50%;bottom:1.1rem;transform:translateX(-50%);width:min(72%,760px);z-index:3;pointer-events:none;font-family:' + FONT + ';color:#e8e2d0;opacity:0;transition:opacity .9s,bottom .25s}',
      '.qb-hp.is-on{opacity:1}.qb-hp.is-up{bottom:9.2rem}',
      '.qb-hp__row{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;font-size:.62rem;letter-spacing:.08em;text-shadow:2px 2px 0 #000;margin-bottom:.45rem}',
      '.qb-hp__h{font-size:.5rem;color:#fcd34d;white-space:nowrap}',
      '.qb-hp__bar{position:relative;height:10px;background:rgba(12,4,6,.82);border:2px solid #cdbf9a;box-shadow:2px 2px 0 #000}',
      '.qb-hp__bar i{position:absolute;left:0;top:0;bottom:0;width:100%}',
      '.qb-hp__ghost{background:#e9c341}.qb-hp__fill{background:linear-gradient(#d0222f,#7a0d16)}',
      '.qb-hp.is-hit .qb-hp__fill{background:#fff}',
      '@media (hover:none),(max-width:700px){.qb-hp,.qb-hp.is-up{bottom:auto;top:5.8rem;width:80%}.qb-hp__row{font-size:.45rem}.qb-hp__h{font-size:.4rem}.qb-hp__bar{height:7px}}',
      '.qb-banner{position:absolute;left:0;right:0;top:46%;transform:translateY(-50%);z-index:5;pointer-events:none;text-align:center;padding:1.4rem 0 1.2rem;font-family:' + FONT + ';font-size:clamp(.8rem,3.4vw,2.3rem);letter-spacing:.14em;color:#f3d469;text-shadow:3px 3px 0 #000,0 0 26px rgba(243,212,105,.65);background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.8) 16%,rgba(0,0,0,.8) 84%,rgba(0,0,0,0));opacity:0}',
      '.qb-banner small{display:block;margin-top:1rem;font-size:.32em;color:#e8e2d0;letter-spacing:.22em;text-shadow:2px 2px 0 #000}',
      '.qb-count{position:absolute;inset:0;z-index:5;display:grid;place-items:center;pointer-events:none;font-family:' + FONT + ';font-size:clamp(3rem,14vw,9rem);color:#fff;text-shadow:6px 6px 0 #000,0 0 40px rgba(255,120,40,.8)}',
      '.qb-cap{position:absolute;left:0;right:0;bottom:1.4rem;z-index:5;text-align:center;pointer-events:none;font-family:' + FONT + ';font-size:clamp(.45rem,1.3vw,.7rem);letter-spacing:.1em;color:#fff;text-shadow:2px 2px 0 #000}',
      '.qb-cap small{display:block;margin-top:.7rem;font-size:.8em;opacity:.7}',
      '.qb-flash{position:absolute;inset:0;z-index:12;background:#fff;opacity:0;pointer-events:none}'
    ].join('\n');
    function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; api.view.appendChild(e); return e; }
    function rm(name) { var e = dom[name]; if (e && e.parentNode) e.parentNode.removeChild(e); dom[name] = null; }
    function ensureStyle() {
      if (dom.style) return;
      dom.style = document.createElement('style'); dom.style.setAttribute('data-quest-boss', ''); dom.style.textContent = CSS; document.head.appendChild(dom.style);
    }
    function showHpBar(hp, max) {
      if (!dom.hp) {
        dom.hp = el('div', 'qb-hp', '<div class="qb-hp__row"><span>THE EDITOR-IN-CHIEF</span><span class="qb-hp__h">H-INDEX <b></b></span></div><div class="qb-hp__bar"><i class="qb-hp__ghost"></i><i class="qb-hp__fill"></i></div>');
        dom.hpFill = dom.hp.querySelector('.qb-hp__fill'); dom.hpGhost = dom.hp.querySelector('.qb-hp__ghost'); dom.hpNum = dom.hp.querySelector('b');
        dom.dlg = api.root.querySelector('.q-dialog');
      }
      setHpBar(hp, max, hp / max);
      var bar = dom.hp; setTimeout(function () { if (bar) bar.classList.add('is-on'); }, 30);
    }
    function setHpBar(hp, max, ghost) {
      if (!dom.hp) return;
      dom.hpFill.style.width = (100 * hp / max) + '%'; dom.hpGhost.style.width = (100 * ghost) + '%'; dom.hpNum.textContent = hp;
    }
    function hideHpBar() { rm('hp'); dom.hpFill = dom.hpGhost = dom.hpNum = null; }

    /* ------------------------------------------------------------ intro card: a House of the Dead 2 dossier */
    // Box proportions of the boss in model units [x, y, z, w, h, d, kind]; the 3D model below uses the same numbers.
    var SCHEMA = [
      [-0.27, 0.13, 0.1, 0.42, 0.26, 0.66], [0.27, 0.13, 0.1, 0.42, 0.26, 0.66], [-0.27, 0.58, 0, 0.36, 0.75, 0.4], [0.27, 0.58, 0, 0.36, 0.75, 0.4],
      [0, 0.98, 0, 1.12, 0.62, 0.74], [0, 1.62, 0, 1.0, 0.9, 0.58], [0, 2.1, 0, 1.62, 0.24, 0.74],
      [-0.9, 1.5, 0.06, 0.32, 1.2, 0.32], [0.9, 1.5, 0.06, 0.32, 1.2, 0.32], [-0.9, 1.08, 0.06, 0.46, 0.5, 0.46], [0.9, 1.08, 0.06, 0.46, 0.5, 0.46],
      [0, 2.56, 0.02, 0.72, 0.72, 0.72], [0, 2.17, 0.37, 0.34, 0.5, 0.1], [0, 2.98, 0, 0.56, 0.16, 0.56], [0, 3.08, 0, 1.12, 0.06, 1.12],
      [0.9, 1.75, 0.42, 0.14, 2.5, 0.14, 'pen'], [-0.13, 2.6, 0.4, 0.13, 0.07, 0.04, 'eye'], [0.13, 2.6, 0.4, 0.13, 0.07, 0.04, 'eye'],
      [0, 1.62, 0.31, 0.5, 0.5, 0.06, 'badge']
    ];
    var CARD_LEN = 6.0;
    function openCard() {
      var r = api.view.getBoundingClientRect(), W = r.width < 560 ? 480 : 640, H = Math.round(W * (r.height || 9) / (r.width || 16));
      H = clamp(H, 270, 480);
      dom.card = el('div', 'qb-card'); var cv = document.createElement('canvas'); cv.width = W; cv.height = H; dom.card.appendChild(cv);
      var scan = document.createElement('canvas'); scan.width = W; scan.height = H; var sx = scan.getContext('2d');
      sx.fillStyle = 'rgba(0,0,0,0.30)'; for (var y = 0; y < H; y += 2) sx.fillRect(0, y, W, 1);
      var vg = sx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      sx.fillStyle = vg; sx.fillRect(0, 0, W, H);
      dom.cardCv = cv; dom.cardScan = scan; dom.cardTyped = 0;
      dom.card.addEventListener('pointerdown', onSkip);
    }
    function typed(x, text, T, t0, cps) {            // returns the revealed part of `text`, blipping as it grows
      var n = clamp(Math.floor((T - t0) * (cps || 38)), 0, text.length);
      return text.slice(0, n);
    }
    function drawCard(T) {
      var cv = dom.cardCv; if (!cv) return;
      var x = cv.getContext('2d'), W = cv.width, H = cv.height, wide = W >= 600, k, i;
      var TEAL = '#35f0b0', DIM = '#0e5a48', PALE = '#b8ffe6', RED = '#ff3348';
      x.fillStyle = '#010a08'; x.fillRect(0, 0, W, H);
      // grid + frame
      x.strokeStyle = 'rgba(20,110,88,0.35)'; x.lineWidth = 1; x.beginPath();
      for (i = 24; i < W; i += 24) { x.moveTo(i + 0.5, 34); x.lineTo(i + 0.5, H - 30); }
      for (i = 34; i < H - 28; i += 24) { x.moveTo(10, i + 0.5); x.lineTo(W - 10, i + 0.5); }
      x.stroke();
      x.strokeStyle = TEAL; x.lineWidth = 2; x.strokeRect(7, 7, W - 14, H - 14);
      x.fillStyle = TEAL; x.fillRect(7, 7, W - 14, 22);
      x.fillStyle = '#01140f'; x.font = '8px ' + FONT; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText('EDITORIAL THREAT FILE', 16, 19);
      x.textAlign = 'right'; x.fillText(wide ? 'CLASSIFIED: DESK ONLY' : 'CLASSIFIED', W - 16, 19);
      // the rotating schematic
      var cx = Math.round(W * 0.27), base = H - 44, sc = (H - 96) / 3.2, th = -0.75 + T * 1.15, c = Math.cos(th), s = Math.sin(th);
      x.strokeStyle = DIM; x.lineWidth = 1;
      for (k = 1; k <= 3; k++) { x.beginPath(); x.ellipse(cx, base, sc * 0.5 * k, sc * 0.13 * k, 0, 0, 6.283); x.stroke(); }
      x.beginPath(); x.moveTo(cx, base); x.lineTo(cx + Math.cos(T * 2.2) * sc * 1.5, base + Math.sin(T * 2.2) * sc * 0.39); x.stroke();
      var order = SCHEMA.map(function (p, n) { return { p: p, z: -p[0] * s + p[2] * c, n: n }; }).sort(function (a, b) { return a.z - b.z; });
      var bx = 0, by = 0, bFront = c > 0.05;
      var show = clamp(T / 1.1, 0, 1) * SCHEMA.length;          // parts assemble one by one
      order.forEach(function (o) {
        var p = o.p; if (o.n >= show) return;
        var px = cx + (p[0] * c + p[2] * s) * sc, hw = (Math.abs(p[3] * c) + Math.abs(p[5] * s)) / 2 * sc, top = base - (p[1] + p[4] / 2) * sc, hh = p[4] * sc;
        var kind = p[6];
        if (kind === 'badge') { bx = px; by = top + hh / 2; }
        if ((kind === 'badge' || kind === 'eye') && !bFront) return;
        x.fillStyle = kind === 'badge' ? 'rgba(90,8,18,0.95)' : kind === 'eye' ? RED : kind === 'pen' ? 'rgba(60,8,14,0.95)' : 'rgba(2,26,20,0.94)';
        x.strokeStyle = kind === 'badge' || kind === 'pen' ? RED : TEAL; x.lineWidth = 1;
        x.fillRect(Math.round(px - hw), Math.round(top), Math.max(1, Math.round(hw * 2)), Math.max(1, Math.round(hh)));
        if (kind !== 'eye') x.strokeRect(Math.round(px - hw) + 0.5, Math.round(top) + 0.5, Math.max(1, Math.round(hw * 2)), Math.max(1, Math.round(hh)));
        if (!kind && hw > 5) {       // the nearest vertical edge: what sells the rotation
          var ex = (s < 0 ? 1 : -1) * p[3] / 2, ez = (c > 0 ? 1 : -1) * p[5] / 2, epx = cx + ((p[0] + ex) * c + (p[2] + ez) * s) * sc;
          x.strokeStyle = 'rgba(53,240,176,0.45)'; x.beginPath(); x.moveTo(Math.round(epx) + 0.5, top); x.lineTo(Math.round(epx) + 0.5, top + hh); x.stroke();
        }
      });
      // text column
      var tx = Math.round(W * 0.54), big = wide ? 24 : 16, y0 = 62;
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = TEAL; x.font = big + 'px ' + FONT; x.fillText(typed(x, 'TYPE 0100', T, 0.5, 22), tx, y0);
      x.fillStyle = PALE; x.font = '16px ' + FONT; x.fillText(typed(x, 'THE EDITOR-', T, 1.0, 26), tx, y0 + 34); x.fillText(typed(x, 'IN-CHIEF', T, 1.45, 26), tx, y0 + 56);
      x.fillStyle = TEAL; x.font = '8px ' + FONT; x.fillText(typed(x, '"THE DECISION IS FINAL"', T, 1.9), tx, y0 + 82);
      var rows = ['HEIGHT ........ 17 M', 'IMPACT FACTOR . 64.8', 'TURNAROUND .... 14 MONTHS', 'REPLIES TO EMAIL: NEVER', 'ARMOUR: TENURE (TOTAL)'];
      x.fillStyle = '#1fae84'; for (i = 0; i < rows.length; i++) x.fillText(typed(x, rows[i], T, 2.3 + i * 0.28, 60), tx, y0 + 108 + i * 15);
      // weak point: blinking reticle, leader line, label
      if (T > 2.6) {
        var blink = Math.floor(T * 5) % 2 === 0, ly = Math.min(H - 62, y0 + 108 + rows.length * 15 + 22), lw = W - tx - 18;
        x.strokeStyle = RED; x.fillStyle = RED; x.lineWidth = bFront ? 2 : 1; x.globalAlpha = bFront ? 1 : 0.45;
        if (blink || !bFront) {
          x.beginPath(); x.arc(bx, by, 13, 0, 6.283); x.stroke();
          x.beginPath(); x.moveTo(bx - 20, by); x.lineTo(bx - 7, by); x.moveTo(bx + 7, by); x.lineTo(bx + 20, by); x.moveTo(bx, by - 20); x.lineTo(bx, by - 7); x.moveTo(bx, by + 7); x.lineTo(bx, by + 20); x.stroke();
        }
        x.globalAlpha = 1; x.lineWidth = 1;
        var lk = clamp((T - 2.6) / 0.5, 0, 1), midx = lerp(bx + 14, tx - 22, Math.min(1, lk * 1.4));
        x.beginPath(); x.moveTo(bx + 14, by); x.lineTo(midx, by); if (lk > 0.7) { x.lineTo(tx - 22, ly + 16); x.lineTo(tx - 4, ly + 16); } x.stroke();
        if (lk >= 1) {
          x.fillStyle = blink ? 'rgba(120,8,22,0.9)' : 'rgba(50,4,10,0.9)'; x.fillRect(tx - 4, ly, lw, 34); x.strokeRect(tx - 3.5, ly + 0.5, lw, 34);
          x.fillStyle = '#ffd0d4'; x.font = '8px ' + FONT; x.fillText('WEAK POINT', tx + 4, ly + 13);
          x.fillStyle = blink ? '#fff' : RED; x.font = (wide ? 16 : 8) + 'px ' + FONT; x.fillText(wide ? 'H-INDEX' : '>> H-INDEX <<', tx + 4, ly + (wide ? 31 : 27));
        }
      }
      x.fillStyle = PALE; x.font = '8px ' + FONT; x.textAlign = 'left';
      x.fillText(typed(x, wide ? 'SHOOT THE H-INDEX. NOTHING ELSE COUNTS.' : 'SHOOT THE H-INDEX.', T, 3.5, 30), 16, H - 17);
      if (T > 1 && Math.floor(T * 2) % 2 === 0) { x.textAlign = 'right'; x.fillStyle = TEAL; x.fillText(wide ? 'F / TAP: SKIP' : 'TAP: SKIP', W - 16, H - 17); }
      // type blips while anything is still appearing
      var chars = Math.floor(clamp(T - 0.5, 0, 4.6) * 12); if (chars !== dom.cardTyped) { dom.cardTyped = chars; if (T < 4.9) SFX.type(); }
      // CRT: moving scan bar, scanlines, power-on
      var sb = (T * 90) % (H + 60) - 30; x.fillStyle = 'rgba(80,255,200,0.06)'; x.fillRect(0, sb, W, 26);
      x.drawImage(dom.cardScan, 0, 0);
      if (T < 0.3) { var open = smooth(T / 0.3) * H / 2; x.fillStyle = '#000'; x.fillRect(0, 0, W, H / 2 - open); x.fillRect(0, H / 2 + open, W, H / 2 - open); x.fillStyle = '#d8fff2'; x.fillRect(0, H / 2 - open - 1, W, 2); x.fillRect(0, H / 2 + open - 1, W, 2); }
    }
    function closeCard() {
      var c = dom.card; if (!c) return;
      c.removeEventListener('pointerdown', onSkip); c.classList.add('is-off'); dom.card = null; dom.cardCv = null; dom.cardScan = null;
      dom.cardDying = c; dom.cardTimer = setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); if (dom.cardDying === c) dom.cardDying = null; dom.cardTimer = null; }, 260);
    }
    function killCard() {
      if (dom.card) { dom.card.removeEventListener('pointerdown', onSkip); rm('card'); dom.cardCv = dom.cardScan = null; }
      if (dom.cardTimer) { clearTimeout(dom.cardTimer); dom.cardTimer = null; } rm('cardDying');
    }
