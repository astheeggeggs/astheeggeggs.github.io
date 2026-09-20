
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
    function say(who, text) { G.who = who; G.say = text; G.sayT = 5.5; G.sayN = 0; }
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
        if (o.t < 9 && o.y > H * 0.7) o.vy = -Math.abs(o.vy); if (o.y < 40 && o.vy < 0) o.vy = Math.abs(o.vy);
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
