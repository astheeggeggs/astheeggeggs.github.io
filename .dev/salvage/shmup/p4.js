
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
