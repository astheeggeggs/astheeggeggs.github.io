
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
        h += '<a href="' + String(L[p[0]]).replace(/"/g, '&quot;') + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + p[1] + (ext ? ' ↗' : '') + '</a>';
      });
      h += '</div><div class="qs-end__btns"><button type="button" data-qs="again">▶ PLAY AGAIN</button><button type="button" data-qs="site">BACK TO THE SITE ↓</button></div></div>';
      endEl.innerHTML = h; overlay.appendChild(endEl);
      endEl.querySelector('[data-qs="again"]').addEventListener('click', function () { try { api.restart(); } catch (e) {} });
      endEl.querySelector('[data-qs="site"]').addEventListener('click', function () {
        setFixed(false);                                                              // hand the page back, keep the ending where the game was
        var el = document.getElementById('boring'); if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } }
      });
    }
