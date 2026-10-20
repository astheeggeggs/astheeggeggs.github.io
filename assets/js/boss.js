/* =============================================================================
   BOSS.JS — "Palmer's Progress", the reckoning.
   THE EDITOR-IN-CHIEF: a House of the Dead style dossier card, a Dark Souls style
   drop from the sky that flattens the town, a fight where only the H-INDEX counts,
   then MANUSCRIPT ACCEPTED and a blast-off into space.
   Defines window.QuestBoss(api) only; all work happens inside start()/update().
   Everything is procedural: box geometry, canvas textures, and synthesised sound effects, all from the shared
   first-person kit (fpsfx.js, window.FPSFX) except the item-get jingle, six NES-style oscillator notes of our own.
   ============================================================================= */
(function () {
  'use strict';

  window.QuestBoss = function (api) {
    var THREE = api.THREE, scene = api.scene, camera = api.camera;
    // `ended` goes up the moment the H-INDEX hits zero: the host reads it to clear anything still in flight,
    // so no plasma ball goes on glowing through MANUSCRIPT ACCEPTED.
    var self = { active: false, cinematic: false, ended: false, start: start, stop: stop, update: update, hitTest: hitTest };

    /* ------------------------------------------------------------ constants */
    var S = 5.6;                        // model units (a 3.16-unit box man) → world: about 17.7 units tall
    var COL_R = 3.4;                    // boss collider radius (2D)
    var BODY_R = 3.0, BODY_TOP = 13.4;  // body cylinder for shot tests
    var HEAD_Y = 14.4, HEAD_R = 2.7;
    var WEAK_R = 1.65;                  // generous sphere round the badge
    var ARENA_R = 46;
    var VANTAGE = { x: 4, z: 24 };
    var WAVE = 26;                      // landing shockwave speed (u/s): buildings burst as it reaches them
    var DEEP = { base: 70, wave: 'sawtooth', spread: 0.2 };
    var SAGE_VOICE = { base: 172, wave: 'triangle', spread: 0.55 };
    var FONT = '"Press Start 2P", monospace';
    /* The BFG the emeritus professor keeps in the rubble. It is a gift, not a cheat code: what it removes is
       frustration, not the fight. The blast radius means you do not have to thread the badge, it goes straight
       through the editorial board, and it lands like a bomb — but five off the H-INDEX is twenty good shots,
       so the editor still gets his phases and you still have to keep out of the way while you take them. */
    var BFG = { rate: 1.0, speed: 34, dmg: 5, bodyDmg: 1, R: 3.4 };

    /* ------------------------------------------------------------ utils */
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function angDiff(a, b) { var d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); }
    function guard(fn) { try { return fn(); } catch (e) { if (window.console) console.error(e); } }
    function say(fn, arg) { try { api[fn](arg); } catch (e) {} }
    var V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), Q1 = new THREE.Quaternion();

    /* ------------------------------------------------------------ sfx: the shared first-person kit
       Every sound but one comes from window.FPSFX (fpsfx.js): DOOM crossed with THE HOUSE OF THE DEAD, synthesised there
       and played from cached buffers. Names, lengths and levels are in .dev/sfx-contract.md. api.audio() is quest.js's own
       context, so this is the very kit quest.js plays on: every play here is tagged 'boss', and stop() silences that
       group only. The one exception is the item-get jingle (getItem, below), which stop() and REJECTED! silence by hand.
       Without FPSFX, or without audio, every call below is a silent no-op. */
    var SFX_GROUP = 'boss', K = null, sfxGate = {}, deathCry = null, jingle = null;
    function kit() {
      if (!K && window.FPSFX) { try { K = window.FPSFX.kit(api.audio()); } catch (e) { K = null; } }
      return K;
    }
    function play(name, o) {
      var k = kit(); if (!k) return null;
      o = o || {}; o.group = SFX_GROUP;
      try { return k.play(name, o); } catch (e) { return null; }
    }
    function gate(name, secs) {      // rate limit by wall clock so a hail of shots cannot stack a hundred voices
      var now = Date.now(); if (sfxGate[name] && now - sfxGate[name] < secs * 1000) return false; sfxGate[name] = now; return true;
    }
    // A sound from a place in the town: panned from the camera, full level inside `ref` units, then ref/d. The editor
    // is seventeen metres tall and holds 13-22 units off, so his own noises use a wide ref (loud, but you can hear
    // which side he is on); a shot's feedback uses the widest, because an arcade hit is never quiet.
    function at(x, y, z, ref, o) { o = o || {}; o.pos = { x: x, y: y, z: z }; o.listener = camera; o.ref = ref; o.floor = 0.3; return o; }
    var REF_HIT = 40, REF_BOSS = 30;
    // Rendered ahead while the dossier card types itself out, so the landing never waits on a cold render. Every
    // length-baked sound at the exact length it is played at, including the wind-up of each of the three phases.
    function warmSfx() {
      var k = kit(); if (!k || !k.warm) return;
      var list = ['ui.type', 'ui.confirm', { name: 'omen', dur: OMEN_LEN }, { name: 'whistle', dur: WHISTLE_LEN }, 'quake', 'boss.roar', 'slam', 'dispel', 'pickup', 'stomp'];
      for (var i = 1; i < PH.length; i++) list.push({ name: 'windup', dur: Math.max(0.7, PH[i].wind) });
      list.push('fireball.launch', 'fireball.burst', 'whoosh', 'ui.tick', 'hit.block', 'hit.armour', 'hit.weak', 'powerup', 'hit.crit', 'bfg.blast', 'enemy.pain',
        'shatter', { name: 'omen', dur: BLOW_T }, { name: 'windup', dur: BLOW_T }, 'explosion', 'gib', 'ui.go', { name: 'rocket', dur: ROCKET_LEN });
      try { k.warm(list); } catch (e) {}
    }
    var SFX = {
      // taking fire. The ping is House of the Dead's confirmation: it climbs as the H-INDEX falls, and it is the loudest
      // of the three, so a scoring shot stands out. Measured over sustained fire (the gun every 0.13 s), A-weighted 50 ms
      // max: ping -11.8 dB, cover -15.1, ricochet -19.2. The cover is at full level because a held trigger mostly hits
      // covers: at 0.7 it sat under the fight music (best-band margin over music + gun, median 1.4 dB, 66 of 181 below 0).
      clank: function (x, y, z) { if (gate('clank', 0.07)) play('hit.armour', at(x, y, z, REF_HIT, { gain: 0.7 })); },   // tenure: a ricochet off plate
      block: function (x, y, z) { if (gate('block', 0.07)) play('hit.block', at(x, y, z, REF_HIT)); },                   // a journal cover: cardboard
      ping: function (k, x, y, z) { play('hit.weak', at(x, y, z, REF_HIT, { k: clamp(k, 0, 1), gain: 1.25 })); },
      // a chain-gun round landing (twelve a second): the ricochet, small, never the ping - the badge count is the confirmation
      tick: function (x, y, z) { if (gate('tick', 0.07)) play('hit.armour', at(x, y, z, REF_HIT, { gain: 0.45, pitch: 3 })); },
      // the BFG on the H-INDEX: the critical confirmation on the same scale, the plasma going off, and he feels it
      plasma: function (k, x, y, z) {
        play('hit.crit', at(x, y, z, REF_HIT, { k: clamp(k, 0, 1) }));
        play('bfg.blast', at(x, y, z, REF_BOSS));
        if (boss) play('enemy.pain', at(boss.x, HEAD_Y, boss.z, REF_BOSS, { pitch: -8 }));
      },
      blast: function (x, y, z) {                              // the BFG on the body: tenure does not entirely absorb this
        if (!gate('blast', 0.06)) return;
        play('bfg.blast', at(x, y, z, REF_BOSS));
        if (boss) play('enemy.pain', at(boss.x, HEAD_Y, boss.z, REF_BOSS, { pitch: -9, gain: 0.7 }));
      },
      // his attacks: the wind-up is the telegraph, pitched to end exactly as the attack fires. It returns the handle, so a
      // wind-up cut short by a phase change or the killing shot is stopped with it (F.windH) instead of whining on.
      charge: function (dur) { return boss ? play('windup', at(boss.x, 10, boss.z, REF_BOSS, { dur: dur })) : null; },
      launch: function (x, y, z) { if (gate('launch', 0.09)) play('fireball.launch', at(x, y, z, 20)); },       // a manuscript thrown
      whoosh: function (x, z) { if (gate('whoosh', 0.09)) play('whoosh', at(x, 6, z, 12)); },                    // an ink stroke falling
      stroke: function (x, z) { if (gate('stroke', 0.06)) play('fireball.burst', at(x, 0.5, z, 10)); },          // ... and landing
      puff: function (x, y, z) { if (gate('puff', 0.1)) play('fireball.burst', at(x, y, z, 10, { gain: 0.6 })); },  // a manuscript bursting
      // where a stroke will land: a low warning beep (D4), an octave and more below the lowest ping (660 Hz), because the
      // marks and the pings alternate in the rain's open window and danger must never sound like a score
      mark: function (x, z) { play('ui.tick', at(x, 0, z, REF_HIT, { pitch: -7, gain: 0.8, gate: 0.1 })); },
      ring: function () { if (boss) play('slam', at(boss.x, 0, boss.z, REF_BOSS)); },                          // DESK REJECT's shockwave
      step: function () { if (boss) play('stomp', at(boss.x, 0, boss.z, 16)); },                               // his stride, at full weight: he is coming
      roar: function () { return boss ? play('boss.roar', at(boss.x, HEAD_Y, boss.z, REF_BOSS)) : null; },
      // the arrival: silence, the rumble, the whistle, the town coming down
      omen: function (dur) { play('omen', { dur: dur }); },
      whistle: function (dur) { play('whistle', { dur: dur }); },
      impact: function () { play('quake'); },
      building: function (x, z) { play('slam', at(x, 0, z, 14, { gate: 0.03 })); },
      twinkle: function () { play('dispel', { gain: 0.5, pitch: 5 }); },                                          // a colleague, gone over the horizon
      // the end of him: the badge shatters, he screams, the rumble swells, and he blows apart. The swell is two layers
      // that both peak on the explosion: the omen's sub rumble, and his own wind-up at half level, which is what carries
      // it on small speakers (the omen is 83% below 150 Hz). gate 0: a BFG kill can land within 0.2 s of an attack's wind-up.
      shatter: function () { play('shatter'); },
      cry: function () { return boss ? play('boss.roar', at(boss.x, HEAD_Y, boss.z, REF_BOSS, { pitch: -5 })) : null; },
      swell: function (dur) {
        play('omen', { dur: dur });
        if (boss) play('windup', at(boss.x, 10, boss.z, REF_BOSS, { dur: dur, gain: 0.5, gate: 0 }));
      },
      boom: function () { if (boss) { play('explosion', at(boss.x, 8, boss.z, REF_BOSS)); play('gib', at(boss.x, 8, boss.z, REF_BOSS, { delay: 0.05 })); } },
      debris: function () { if (boss && gate('debris', 0.12)) play('stomp', at(boss.x, 0, boss.z, REF_BOSS, { gain: 0.22, pitch: 5 })); },
      count: function (go) { play(go ? 'ui.go' : 'ui.tick'); },
      rocket: function (dur) { play('rocket', { dur: dur }); },
      // the card and the prompts
      type: function () { if (gate('type', 0.045)) play('ui.type'); },
      confirm: function () { play('ui.confirm'); },
      sage: function (x, z) { play('pickup', at(x, 1.6, z, REF_HIT)); },                                       // somebody is holding something
      // the hand-over. The one sound the kit does not make, on purpose: Link's item-get, because the line he says it
      // with is Zelda's. Plain NES squares through one gain of ours into the kit's own bus (so its limiter holds them),
      // Doom's power-up under it. The kit's stopAll cannot reach nodes it did not make, so the jingle is silenced here:
      // by stop(), and by REJECTED! (quest.js stops every kit voice then, and no longer runs update(): a 50 ms wall-clock
      // watch on api.isOver() lives for the jingle's 1.07 s).
      getItem: function () {
        var k = kit(); if (!k || !k.bus) return;
        play('powerup', { gain: 0.55 });
        jingleStop(0.02);
        try {
          var a = k.ac, t = a.currentTime, bus = a.createGain(), j = { ac: a, g: bus, osc: [], end: t, poll: 0 }, left = 0;
          bus.connect(k.bus);
          [[523.25, 0, 0.16, 'square', 0.16], [659.25, 0.11, 0.16, 'square', 0.16], [783.99, 0.22, 0.16, 'square', 0.16], [1046.5, 0.33, 0.16, 'square', 0.16],
           [1568, 0.44, 0.6, 'square', 0.17], [783.99, 0.44, 0.6, 'triangle', 0.12]].forEach(function (n) {
            var o = a.createOscillator(), g = a.createGain(), t0 = t + n[1], t1 = t0 + n[2] + 0.03;
            o.type = n[3]; o.frequency.value = n[0];
            g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(n[4], t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[2]);
            o.connect(g); g.connect(bus); o.start(t0); o.stop(t1); left++;
            o.onended = function () { try { o.disconnect(); g.disconnect(); if (--left === 0) bus.disconnect(); } catch (e) {} };
            j.osc.push([o, t1]); if (t1 > j.end) j.end = t1;
          });
          jingle = j;
          j.poll = setInterval(function () {
            var over = false; try { over = api.isOver(); } catch (e) {}
            if (over) jingleStop(0.08);
            else if (a.currentTime > j.end) { clearInterval(j.poll); if (jingle === j) jingle = null; }
          }, 50);
        } catch (e) {}
      }
    };
    // Fade the item-get squares out over `fade` s and end every note by then (a note not yet started never plays).
    function jingleStop(fade) {
      var j = jingle; if (!j) return;
      jingle = null; clearInterval(j.poll);
      try {
        var t = j.ac.currentTime, until = t + fade + 0.02;
        j.g.gain.cancelScheduledValues(t); j.g.gain.setValueAtTime(1, t); j.g.gain.setTargetAtTime(0, t, Math.max(0.002, fade / 5));
        j.osc.forEach(function (x) { if (x[1] > until) { x[1] = until; x[0].stop(until); } });   // stop() only ever shortens here
      } catch (e) {}
    }


    /* ------------------------------------------------------------ DOM: style, HP bar, banner, countdown, flash */
    var dom = {};
    var CSS = [
      '.qb-card{position:absolute;inset:0;z-index:8;background:#010504;cursor:pointer;overflow:hidden;transform-origin:50% 50%}',
      '.qb-card canvas{width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges}',
      '.qb-card.is-off{transition:transform .2s ease-in,filter .2s;transform:scale(1,.004);filter:brightness(4)}',
      '.qb-hp{position:absolute;left:50%;bottom:1.1rem;transform:translateX(-50%);width:min(72%,760px);z-index:5;pointer-events:none;font-family:' + FONT + ';color:#e8e2d0;opacity:0;transition:opacity .9s,bottom .25s}',
      '.qb-hp.is-on{opacity:1}.qb-hp.is-up{bottom:9.2rem}',
      '.qb-hp__row{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;font-size:.62rem;letter-spacing:.08em;text-shadow:2px 2px 0 #000;margin-bottom:.45rem}',
      '.qb-hp__h{font-size:.5rem;color:#fcd34d;white-space:nowrap}',
      '.qb-hp__bar{position:relative;height:10px;background:rgba(12,4,6,.82);border:2px solid #cdbf9a;box-shadow:2px 2px 0 #000}',
      '.qb-hp__bar i{position:absolute;left:0;top:0;bottom:0;width:100%}',
      '.qb-hp__ghost{background:#e9c341}.qb-hp__fill{background:linear-gradient(#d0222f,#7a0d16)}',
      '.qb-hp.is-hit .qb-hp__fill{background:#fff}',
      '.qb-banner{position:absolute;left:0;right:0;top:46%;transform:translateY(-50%);z-index:5;pointer-events:none;text-align:center;padding:1.4rem 0 1.2rem;font-family:' + FONT + ';font-size:clamp(.8rem,3.4vw,2.3rem);letter-spacing:.14em;color:#f3d469;text-shadow:3px 3px 0 #000,0 0 26px rgba(243,212,105,.65);background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.8) 16%,rgba(0,0,0,.8) 84%,rgba(0,0,0,0));opacity:0}',
      '.qb-banner small{display:block;margin-top:1rem;font-size:.32em;color:#e8e2d0;letter-spacing:.22em;text-shadow:2px 2px 0 #000}',
      '.qb-count{position:absolute;inset:0;z-index:5;display:grid;place-items:center;pointer-events:none;font-family:' + FONT + ';font-size:clamp(3rem,14vw,9rem);color:#fff;text-shadow:6px 6px 0 #000,0 0 40px rgba(255,120,40,.8)}',
      '.qb-cap{position:absolute;left:0;right:0;bottom:4.4rem;z-index:7;text-align:center;pointer-events:none;font-family:' + FONT + ';font-size:clamp(.45rem,1.3vw,.7rem);letter-spacing:.1em;color:#fff;text-shadow:2px 2px 0 #000}',
      '.qb-cap small{display:block;margin-top:.55rem;font-size:.8em;opacity:.7}',
      '.qb-flash{position:absolute;inset:0;z-index:12;background:#fff;opacity:0;pointer-events:none}',
      // the old man in the rubble: his floating prompt, which is also the tap target on a phone
      '.qb-talk{position:absolute;z-index:7;transform:translate(-50%,-50%);padding:.45rem .62rem;border:2px solid #7cf9b0;background:rgba(3,22,13,.88);color:#dcffe9;font-family:' + FONT + ';font-size:.52rem;line-height:1;letter-spacing:.12em;text-shadow:2px 2px 0 #000;box-shadow:3px 3px 0 #000;white-space:nowrap;cursor:pointer;pointer-events:auto;-webkit-user-select:none;user-select:none;touch-action:manipulation;animation:qb-talkb 1s steps(2,end) infinite}',
      '@keyframes qb-talkb{50%{border-color:#2f8a5c;color:#8fe9b6}}',
      // Pinned instead of floating on a phone. A 390-wide view is 348x260: the d-pad owns x 35-177 / y 177-319
      // and the A/B buttons x 231-355 / y 240-315, so a prompt that follows him lands squarely on UP. This
      // corner - hard right, just above B - is the only hole big enough, and it stays tappable.
      '.qb-talk.is-pin{left:auto!important;top:auto!important;right:.6rem;bottom:6.1rem;transform:none;font-size:.46rem;padding:.4rem .55rem;max-width:56%}',
      // the off-screen pointer: he is behind you, and nothing else in a flattened town is that green
      '.qb-ind{position:absolute;z-index:6;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:.24rem;pointer-events:none;padding:.3rem .42rem;background:rgba(3,22,13,.82);border:2px solid #2f8a5c;box-shadow:3px 3px 0 #000;font-family:' + FONT + ';font-size:.44rem;letter-spacing:.14em;color:#8fffc0;text-shadow:2px 2px 0 #000;white-space:nowrap;animation:qb-indb 1.1s steps(2,end) infinite}',
      '.qb-ind i{display:block;width:0;height:0;border-left:.42rem solid transparent;border-right:.42rem solid transparent;border-bottom:.62rem solid #8fffc0;filter:drop-shadow(2px 2px 0 #000)}',
      '@keyframes qb-indb{50%{opacity:.42}}',
      '.qb-on.is-over .qb-talk,.qb-cine .qb-talk,.qb-on.is-over .qb-ind,.qb-cine .qb-ind{display:none!important}',
      // The blast-off is a cinematic: the host hides its HUD for it but not the touch pad, which is its own layer.
      '.qb-cine .q-pad,.qb-cine .q-act{display:none!important}',
      // Touch layout, last so it wins. A phone view is only about 260 px tall: the quest HUD ends around y 46
      // and the d-pad starts around y 105, so the bar and the attack caption have to live inside that band, and
      // the host toast is moved into the clear corner above the A/B buttons instead of sitting on the H-INDEX.
      '@media (hover:none),(max-width:700px){',
      '.qb-hp,.qb-hp.is-up{bottom:auto;top:4.25rem;width:92%;z-index:6}',
      '.qb-hp__row{font-size:.42rem;gap:.5rem;margin-bottom:.15rem}.qb-hp__h{font-size:.36rem}.qb-hp__bar{height:5px}',
      '.qb-cap{top:5.5rem;bottom:auto;padding:0 .5rem;font-size:.4rem;line-height:1.2}',
      '.qb-talk{font-size:.46rem;padding:.5rem .6rem;letter-spacing:.1em}',
      // a compass strip on a phone, not a stacked sign: the only clear band is the 19 px between the H-INDEX
      // bar and the top of the d-pad, so it lies down on its side and keeps its own backing plate
      '.qb-ind{flex-direction:row;gap:.24rem;font-size:.34rem;padding:.08rem .26rem;border-width:1px;box-shadow:2px 2px 0 #000;letter-spacing:.1em}',
      '.qb-ind i{border-left-width:.22rem;border-right-width:.22rem;border-bottom-width:.36rem}',
      '.qb-cap small{display:none}',
      '.qb-on .q-toast{top:6.3rem;left:auto;right:.6rem;transform:none;max-width:52%;font-size:.42rem;line-height:1.6;padding:.35rem .5rem}',
      // the blast-off takes the pad away, so the caption gets the room back and keeps its skip hint
      '.qb-cine .qb-cap{top:auto;bottom:2.4rem;font-size:.5rem}.qb-cine .qb-cap small{display:block;margin-top:.45rem}',
      '}'
    ].join('\n');
    function rootClass(name, on) { guard(function () { if (api.root && api.root.classList) api.root.classList.toggle(name, !!on); }); }
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

    /* ------------------------------------------------------------ the boss: box art, 17.7 units of editorial authority */
    var POSES = {
      guard:     { lax: -0.55, laz: 1.05, rax: -0.78, raz: -1.05, llx: 0, rlx: 0, lean: 0.04, bob: 0, headx: 0.12 },
      open:      { lax: 0.14, laz: -0.16, rax: 0.14, raz: 0.16, llx: 0, rlx: 0, lean: 0.24, bob: -0.05, headx: 0.32 },
      volleyUp:  { lax: -0.3, laz: -0.8, rax: -2.45, raz: 0.2, llx: 0, rlx: 0, lean: -0.1, bob: 0.02, headx: -0.1 },
      volleyGo:  { lax: -0.3, laz: -0.6, rax: -1.1, raz: 0.1, llx: 0, rlx: 0, lean: 0.16, bob: 0, headx: 0.15 },
      stompUp:   { lax: -2.9, laz: -0.45, rax: -2.9, raz: 0.45, llx: 0, rlx: -1.15, lean: -0.16, bob: 0.04, headx: -0.2 },
      stompUpL:  { lax: -2.9, laz: -0.45, rax: -2.9, raz: 0.45, llx: -1.15, rlx: 0, lean: -0.16, bob: 0.04, headx: -0.2 },
      stompDown: { lax: -0.5, laz: -0.5, rax: -0.5, raz: 0.5, llx: 0, rlx: 0, lean: 0.34, bob: -0.12, headx: 0.35 },
      rainUp:    { lax: -1.35, laz: 0.25, rax: -3.0, raz: 0.12, llx: 0, rlx: 0, lean: -0.12, bob: 0.03, headx: -0.35 },
      sweepBack: { lax: -0.2, laz: -0.45, rax: -0.55, raz: 1.3, llx: 0, rlx: 0, lean: 0.1, bob: -0.04, headx: 0.1 },
      sweepGo:   { lax: -0.2, laz: -0.7, rax: -1.25, raz: -0.7, llx: 0, rlx: 0, lean: 0.22, bob: -0.06, headx: 0.2 },
      roar:      { lax: -0.5, laz: -1.35, rax: -0.5, raz: 1.35, llx: 0, rlx: 0, lean: -0.3, bob: 0.03, headx: -0.55 },
      crouch:    { lax: -0.35, laz: -0.5, rax: -0.35, raz: 0.5, llx: 0, rlx: 0, lean: 0.55, bob: -0.42, headx: 0.5 },
      dying:     { lax: -0.9, laz: -1.5, rax: -0.9, raz: 1.5, llx: 0, rlx: 0, lean: -0.42, bob: -0.02, headx: -0.7 }
    };
    var boss = null;
    function buildBoss(hp) {
      var b = { g: new THREE.Group(), rig: new THREE.Group(), x: 0, z: 0, yaw: 0, hp: hp, max: hp, cur: {}, tgt: {}, rate: 5, pose: 'guard', walkT: 0, walking: 0, flinch: 0, flashT: 0 };
      b.g.add(b.rig); b.rig.scale.set(S, S, S);
      function lam(c, em) { var m = new THREE.MeshLambertMaterial({ color: c }); if (em !== undefined) m.emissive = new THREE.Color(em); return m; }
      var robe = lam(0x1b1726, 0x07060c), robe2 = lam(0x2c2540, 0x0b0912), crimson = lam(0x9a1224, 0x3a040c), gold = lam(0xd9a520, 0x6b4a08), skin = lam(0xb8b2a0, 0x14120e);
      var beard = lam(0xd9d6cc, 0x1a1a18), dark = lam(0x050507), penRed = lam(0xd21f2f, 0x6a000a), steel = lam(0xc8ccd6, 0x222428);
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });
      function box(w, h, d, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; (parent || b.rig).add(m); return m; }
      function pivot(x, y, z, parent) { var p = new THREE.Group(); p.position.set(x, y, z); (parent || b.rig).add(p); return p; }
      // legs (pivot at the hip) and boots
      b.ll = pivot(-0.27, 0.95, 0); b.rl = pivot(0.27, 0.95, 0);
      [b.ll, b.rl].forEach(function (leg) { box(0.36, 0.75, 0.4, robe2, 0, -0.38, 0, leg); box(0.42, 0.26, 0.66, dark, 0, -0.82, 0.1, leg); });
      // robes
      box(1.12, 0.62, 0.74, robe, 0, 0.98, 0); box(1.16, 0.07, 0.78, crimson, 0, 0.7, 0);
      box(1.0, 0.9, 0.58, robe, 0, 1.62, 0);
      [-1, 1].forEach(function (sd) { box(0.16, 0.86, 0.04, crimson, sd * 0.36, 1.62, 0.305); box(0.18, 0.1, 0.05, gold, sd * 0.36, 1.22, 0.31); });
      box(0.9, 0.36, 0.3, crimson, 0, 2.02, -0.24);                       // the academic hood, hanging at the back
      box(0.5, 0.5, 0.06, crimson, 0, 1.6, -0.31);
      box(1.62, 0.24, 0.74, robe2, 0, 2.1, 0);                            // shoulders: the silhouette does the talking
      [-1, 1].forEach(function (sd) { box(0.08, 0.27, 0.77, gold, sd * 0.81, 2.1, 0); });
      // head: a hood, two red eyes, a long beard, a mortarboard
      b.head = pivot(0, 2.2, 0);
      box(0.72, 0.72, 0.72, robe, 0, 0.36, 0.02, b.head); box(0.5, 0.46, 0.06, dark, 0, 0.34, 0.37, b.head);
      [-1, 1].forEach(function (sd) {
        var e = box(0.13, 0.07, 0.05, eyeMat, sd * 0.13, 0.4, 0.405, b.head); e.castShadow = false;
        var br = box(0.22, 0.05, 0.05, crimson, sd * 0.13, 0.475, 0.41, b.head); br.rotation.z = sd * -0.42;
      });
      box(0.34, 0.5, 0.1, beard, 0, -0.03, 0.37, b.head); box(0.2, 0.22, 0.08, beard, 0, -0.36, 0.37, b.head);
      box(0.56, 0.16, 0.56, dark, 0, 0.78, 0, b.head);
      var board = box(1.12, 0.06, 1.12, robe2, 0, 0.88, 0, b.head); board.rotation.y = 0.18; box(0.1, 0.06, 0.1, gold, 0, 0.93, 0, b.head);
      b.tassel = pivot(0.46, 0.88, 0.5, b.head); box(0.04, 0.5, 0.04, gold, 0, -0.25, 0, b.tassel); box(0.09, 0.15, 0.09, gold, 0, -0.55, 0, b.tassel);
      // arms (pivot at the shoulder): wide sleeves, gold cuffs, pale hands
      b.la = pivot(-0.74, 2.0, 0.12); b.ra = pivot(0.74, 2.0, 0.12);
      [b.la, b.ra].forEach(function (arm) {
        box(0.3, 1.2, 0.3, robe, 0, -0.6, 0, arm); box(0.46, 0.5, 0.46, robe2, 0, -0.95, 0, arm); box(0.48, 0.07, 0.48, gold, 0, -1.2, 0, arm); box(0.26, 0.22, 0.26, skin, 0, -1.33, 0, arm);
      });
      // the giant red pen, held like a sword in the right hand
      b.pen = pivot(0, -1.33, 0.02, b.ra);
      box(0.15, 0.15, 1.9, penRed, 0, 0, 0.55, b.pen); box(0.17, 0.17, 0.3, gold, 0, 0, -0.42, b.pen); box(0.04, 0.05, 0.7, gold, 0, 0.1, -0.05, b.pen);
      box(0.11, 0.11, 0.22, steel, 0, 0, 1.6, b.pen);
      b.nibMat = new THREE.MeshBasicMaterial({ color: 0xff5a4a, fog: false });
      b.penTip = box(0.06, 0.06, 0.18, b.nibMat, 0, 0, 1.79, b.pen); b.penTip.castShadow = false;
      // the H-INDEX badge: the only thing that matters
      b.badge = pivot(0, 1.62, 0.3);
      box(0.52, 0.52, 0.06, gold, 0, 0, 0.01, b.badge);
      b.faceCv = document.createElement('canvas'); b.faceCv.width = b.faceCv.height = 128;
      b.faceTex = new THREE.CanvasTexture(b.faceCv); b.faceTex.magFilter = THREE.NearestFilter;
      b.faceMat = new THREE.MeshBasicMaterial({ map: b.faceTex, fog: false });
      b.face = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), b.faceMat); b.face.position.set(0, 0, 0.045); b.badge.add(b.face);
      var hc = document.createElement('canvas'); hc.width = hc.height = 64; var hx = hc.getContext('2d'), gr = hx.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,220,120,1)'); gr.addColorStop(0.4, 'rgba(255,120,40,0.45)'); gr.addColorStop(1, 'rgba(255,60,20,0)'); hx.fillStyle = gr; hx.fillRect(0, 0, 64, 64);
      b.haloTex = new THREE.CanvasTexture(hc);
      b.haloMat = new THREE.MeshBasicMaterial({ map: b.haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 });
      b.halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), b.haloMat); b.halo.position.set(0, 0, -0.004); b.badge.add(b.halo);
      for (var k in POSES.guard) { b.cur[k] = POSES.guard[k]; b.tgt[k] = POSES.guard[k]; }
      drawBadge(b, hp, false);
      return b;
    }
    function drawBadge(b, n, flash) {
      var x = b.faceCv.getContext('2d');
      x.fillStyle = flash ? '#fff6d8' : '#2a0508'; x.fillRect(0, 0, 128, 128);
      x.strokeStyle = '#fcd34d'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = flash ? '#7a0d16' : '#fcd34d'; x.font = '13px ' + FONT; x.fillText('H-INDEX', 65, 28);
      x.fillStyle = flash ? '#300' : '#fff'; x.font = (n >= 100 ? 32 : 46) + 'px ' + FONT; x.fillText(String(n), 66, 80);
      b.faceTex.needsUpdate = true;
    }
    function setPose(name, rate) { if (!boss) return; boss.pose = name; boss.rate = rate || 5; var p = POSES[name]; for (var k in p) boss.tgt[k] = p[k]; }
    function applyPose(h, t) {
      var b = boss, c = b.cur, k = 1 - Math.exp(-b.rate * h);
      for (var n in c) c[n] += (b.tgt[n] - c[n]) * k;
      var sw = b.walking > 0.05 ? Math.sin(b.walkT) * 0.5 * b.walking : 0;
      b.la.rotation.set(c.lax, 0, c.laz); b.ra.rotation.set(c.rax, 0, c.raz);
      b.ll.rotation.x = c.llx + sw; b.rl.rotation.x = c.rlx - sw;
      var breathe = Math.sin(t * (b.pose === 'open' ? 5 : 1.6)) * (b.pose === 'open' ? 0.012 : 0.006);
      b.rig.rotation.x = c.lean + breathe * 2 - b.flinch * 0.12; b.rig.rotation.z = b.walking * Math.sin(b.walkT) * 0.035;
      b.rig.position.y = (c.bob + breathe - Math.abs(Math.cos(b.walkT)) * 0.03 * b.walking) * S;
      b.head.rotation.x = c.headx; b.tassel.rotation.z = Math.sin(t * 2.3) * 0.25 + b.rig.rotation.z * 4; b.tassel.rotation.x = Math.cos(t * 1.7) * 0.15 - c.headx;
      if (b.flinch > 0) b.flinch = Math.max(0, b.flinch - h * 3);
      b.g.position.x = b.x; b.g.position.z = b.z; b.g.rotation.y = b.yaw;
    }
    function disposeTree(o) {
      o.traverse(function (m) {
        if (m.geometry && m.geometry.dispose) m.geometry.dispose();
        if (m.material) { if (m.material.map && m.material.map.dispose) m.material.map.dispose(); if (m.material.dispose) m.material.dispose(); }
      });
    }
    function removeBoss() {
      if (!boss) return;
      if (boss.g.parent) boss.g.parent.remove(boss.g);
      disposeTree(boss.g);
      var i = api.colliders.indexOf(bossCol); if (i >= 0) api.colliders.splice(i, 1);
      boss = null;
    }
    /* The boss blocks the player, but it must NOT go into api.colliders: the host tests every live rebuttal
       against that list by its end point alone (quest.js updateShots), so a 3.4-unit circle round the boss
       swallows shots in the very frame they would have reached the H-INDEX - the badge sits inside it whenever
       the rig leans back. We keep the boss solid ourselves instead, by pushing the player out each frame. */
    var bossCol = { x: 0, z: 0, r: COL_R }, bossSolid = false;
    function setBossCollider(on) {
      bossSolid = !!on;
      var i = api.colliders.indexOf(bossCol); if (i >= 0) api.colliders.splice(i, 1);
    }
    function pushPlayerOut() {
      if (!bossSolid || !boss || boss.exploded || self.cinematic) return;
      var p = api.player.position, dx = p.x - bossCol.x, dz = p.z - bossCol.z, d = Math.hypot(dx, dz);
      if (d >= COL_R) return;
      if (d < 1e-3) { dx = Math.sin(boss.yaw); dz = Math.cos(boss.yaw); d = 1; }
      var nx = bossCol.x + dx / d * COL_R, nz = bossCol.z + dz / d * COL_R;
      if (!api.collide(nx, nz, 0.5)) { p.x = nx; p.z = nz; }
    }

    /* ------------------------------------------------------------ particles: one unit box, a handful of shared materials */
    var FX = null;
    function fxInit() {
      function basic(c) { return new THREE.MeshBasicMaterial({ color: c, fog: false }); }
      FX = { geo: new THREE.BoxGeometry(1, 1, 1), pool: [], live: [], cap: 230, made: 0,
        mats: { dust: api.flat(0x8a7a66), smoke: api.flat(0x5a5560), soot: api.flat(0x2a262c), water: api.flat(0x7fb8f0), fire: basic(0xff8a2a), flame: basic(0xffe27a), spark: basic(0xfff2b0), gold: basic(0xfcd34d), red: basic(0xff3344), white: basic(0xffffff), plasma: basic(0x5cff8a), plasmaDim: basic(0x18b551) } };
    }
    function fxSpawn(kind, x, y, z, vx, vy, vz, o) {
      if (!FX) return null;
      var p = FX.pool.pop();
      if (!p) {
        if (FX.made < FX.cap) { p = { m: new THREE.Mesh(FX.geo, FX.mats.dust) }; FX.made++; }
        else { p = FX.live.shift(); if (!p) return null; }
      }
      p.m.material = FX.mats[kind] || FX.mats.dust; p.m.position.set(x, y, z); p.m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      p.vx = vx; p.vy = vy; p.vz = vz; p.max = p.life = o.life || 1; p.s0 = o.s0 || 0.3; p.s1 = o.s1 === undefined ? p.s0 : o.s1; p.grav = o.grav || 0; p.drag = o.drag || 0; p.spin = o.spin || 2;
      p.m.scale.setScalar(p.s0); if (!p.m.parent) scene.add(p.m); FX.live.push(p); return p;
    }
    function burst(kind, x, y, z, n, o) {
      for (var i = 0; i < n; i++) {
        var a = rand(0, 6.283), sp = rand(o.spd * 0.4, o.spd), up = rand(o.up * 0.3, o.up);
        fxSpawn(kind, x + rand(-1, 1) * (o.jit || 0), y + rand(-1, 1) * (o.jit || 0) * 0.5, z + rand(-1, 1) * (o.jit || 0), Math.cos(a) * sp, up, Math.sin(a) * sp, o);
      }
    }
    function fxStep(h) {
      if (!FX) return;
      for (var i = FX.live.length - 1; i >= 0; i--) {
        var p = FX.live[i]; p.life -= h;
        if (p.life <= 0) { scene.remove(p.m); FX.live.splice(i, 1); FX.pool.push(p); continue; }
        var k = 1 - p.life / p.max, s = lerp(p.s0, p.s1, k) * (k > 0.65 ? (1 - k) / 0.35 : 1), dr = Math.max(0, 1 - p.drag * h);
        p.vy -= p.grav * h; p.vx *= dr; p.vz *= dr; if (p.drag) p.vy *= dr;
        p.m.position.x += p.vx * h; p.m.position.y += p.vy * h; p.m.position.z += p.vz * h;
        if (p.m.position.y < 0.05 && p.grav > 0) { p.m.position.y = 0.05; p.vy = Math.abs(p.vy) * 0.3; }
        p.m.rotation.x += p.spin * h; p.m.rotation.y += p.spin * 0.7 * h; p.m.scale.setScalar(Math.max(0.001, s));
      }
    }
    function fxKill() {
      if (!FX) return;
      FX.live.forEach(function (p) { scene.remove(p.m); }); FX.pool.forEach(function (p) { scene.remove(p.m); });
      FX.geo.dispose(); for (var k in FX.mats) FX.mats[k].dispose(); FX = null;
    }

    /* ------------------------------------------------------------ the town: persistent across stop()/start(), destroyed exactly once */
    var town = { destroyed: false, clock: 0, queue: [], debris: [], topples: [], flyers: [], geos: [], unit: null, DEBRIS_CAP: 340 };
    function dropCollider(c) { var i = api.colliders.indexOf(c); if (i >= 0) api.colliders.splice(i, 1); }
    function addDebris(m, vx, vy, vz, r, ownGeo, ownMat) {
      if (town.debris.length >= town.DEBRIS_CAP) { freeDebris({ m: m, ownGeo: ownGeo, ownMat: ownMat }); return; }
      m.castShadow = false;
      town.debris.push({ m: m, vx: vx, vy: vy, vz: vz, sx: rand(-5, 5), sy: rand(-4, 4), sz: rand(-5, 5), r: Math.max(0.15, r), bounced: false, rest: -1, ownGeo: ownGeo, ownMat: ownMat, s: m.scale.clone() });
    }
    function freeDebris(d) {
      if (d.m.parent) d.m.parent.remove(d.m);
      if (d.ownGeo && d.m.geometry && !d.m.isSprite) d.m.geometry.dispose();
      if (d.ownMat && d.m.material) { if (d.m.material.map) d.m.material.map.dispose(); d.m.material.dispose(); }
    }
    function debrisStep(h) {
      for (var i = town.debris.length - 1; i >= 0; i--) {
        var d = town.debris[i], m = d.m;
        if (d.rest >= 0) {
          d.rest += h; var k = (d.rest - d.hold) / 0.5;
          if (k >= 1) { freeDebris(d); town.debris.splice(i, 1); } else if (k > 0) m.scale.copy(d.s).multiplyScalar(1 - k);
          continue;
        }
        d.vy -= 30 * h; m.position.x += d.vx * h; m.position.y += d.vy * h; m.position.z += d.vz * h;
        m.rotation.x += d.sx * h; m.rotation.y += d.sy * h; m.rotation.z += d.sz * h;
        if (m.position.y < d.r && d.vy < 0) {
          m.position.y = d.r;
          if (!d.bounced && d.vy < -4) { d.bounced = true; d.vy = -d.vy * 0.32; d.vx *= 0.55; d.vz *= 0.55; d.sx *= 0.5; d.sy *= 0.5; d.sz *= 0.5; }
          else { d.rest = 0; d.hold = rand(1.0, 2.4); }
        }
      }
      if (!town.debris.length && town.geos.length) { town.geos.forEach(function (g) { g.dispose(); }); town.geos.length = 0; }
    }
    function burstBuilding(p, instant) {
      var grp = p.group; if (!grp || p.__burst) return; p.__burst = true;
      dropCollider(p.collider); if (p.marker) p.marker.visible = false;
      (p.bushes || []).forEach(function (b) { b.scale.set(1.25, 0.14, 1.25); b.position.y = 0.08; });
      var d0 = Math.hypot(p.x, p.z) || 1, rx = p.x / d0, rz = p.z / d0, wallMat = null, roofMat = null, use = {};
      var yaw = grp.rotation.y || 0, ys = Math.sin(yaw), yc = Math.cos(yaw);   // the building faces the fountain: local -> world
      function toWorld(m, lx, lz) { m.position.x = p.x + lx * yc + lz * ys; m.position.z = p.z - lx * ys + lz * yc; m.rotation.y += yaw; }
      grp.children.forEach(function (c) { var P = c.geometry && c.geometry.parameters; if (c.geometry && c.geometry.type === 'ConeGeometry') roofMat = c.material; else if (P && P.width === p.w && P.height === p.h && P.depth === p.d) wallMat = c.material; });
      // How many children share each material. The host gives every pane of a building ONE winMat (and keeps
      // writing to it in applyDread), so anything used more than once here is not ours to retire.
      grp.children.forEach(function (c) { if (c.material && c.material.uuid) use[c.material.uuid] = (use[c.material.uuid] || 0) + 1; });
      wallMat = wallMat || api.flat(p.wall); roofMat = roofMat || api.flat(p.roof);
      function fling(m, r, ownGeo, ownMat) {
        var lx = m.position.x - p.x, lz = m.position.z - p.z, ll = Math.hypot(lx, lz) || 1, out = rand(7, 15);
        addDebris(m, rx * out + lx / ll * rand(1, 6), rand(9, 19) + m.position.y * 0.5, rz * out + lz / ll * rand(1, 6), r, ownGeo, ownMat);
      }
      grp.children.slice().forEach(function (c) {
        var g = c.geometry, P = (g && g.parameters) || {}, isBox = g && g.type === 'BoxGeometry';
        if (isBox && ((P.height === 0.3 && c.position.y === 0.15) || (P.height === 0.2 && c.position.y === 0.1))) return;   // plinth and steps survive as the foundation
        grp.remove(c);
        var isBody = c.material === wallMat && isBox && P.width === p.w, shared = c.material === wallMat || c.material === roofMat;
        // ours to retire only if nothing else in the building still renders it AND the host is not still driving
        // it: every glowing material here (the window panes) lives in quest.js's winMats and applyDread writes
        // to it for the rest of the session, shared between every pane of the building.
        var mine = !shared && !!c.material && use[c.material.uuid] === 1 && !(c.material.emissive && c.material.emissive.getHex() !== 0);
        var vol = isBox ? P.width * P.height * P.depth : 1, tiny = (isBox && (vol < 0.2 || P.width === 1.25)) || (g && g.type === 'SphereGeometry');
        if (isBody || tiny || instant) { if (g && !c.isSprite) g.dispose(); if (mine) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } }
        if (isBody && !instant) {
          var nx = clamp(Math.round(p.w / 3.5), 2, 4), ny = clamp(Math.round(p.h / 3), 2, 3), nz = clamp(Math.round(p.d / 3.5), 2, 3), cw = p.w / nx, ch = p.h / ny, cd = p.d / nz;
          var cg = new THREE.BoxGeometry(cw * 0.95, ch * 0.95, cd * 0.95); town.geos.push(cg);
          for (var ix = 0; ix < nx; ix++) for (var iy = 0; iy < ny; iy++) for (var iz = 0; iz < nz; iz++) {
            var m = new THREE.Mesh(cg, wallMat); m.position.y = ch * (iy + 0.5); toWorld(m, -p.w / 2 + cw * (ix + 0.5), -p.d / 2 + cd * (iz + 0.5)); scene.add(m);
            fling(m, Math.min(cw, ch, cd) * 0.4, false, false);
          }
        } else if (!isBody && !tiny && !instant) {
          toWorld(c, c.position.x, c.position.z); scene.add(c);
          fling(c, isBox ? Math.min(P.width, P.height, P.depth) * 0.5 : 0.6, true, mine);
        }
      });
      // low rubble where it stood: walk-over, shoot-over, no colliders
      town.unit = town.unit || new THREE.BoxGeometry(1, 1, 1);
      var n = 9 + Math.round(p.w * p.d / 14);
      for (var i = 0; i < n; i++) {
        var sy = rand(0.35, 1.3), r = new THREE.Mesh(town.unit, i % 3 === 0 ? roofMat : wallMat);
        r.scale.set(rand(0.9, 2.8), sy, rand(0.8, 2.4)); r.position.set(rand(-1, 1) * (p.w / 2 + 0.4), 0.2 + sy / 2, rand(-1, 1) * (p.d / 2 + 0.4));
        r.rotation.set(rand(-0.25, 0.25), rand(0, 3.14), rand(-0.25, 0.25)); r.castShadow = true; r.receiveShadow = true; grp.add(r);
      }
      if (!instant) {
        burst('dust', p.x, 2, p.z, 12, { spd: 9, up: 7, life: 2.2, s0: 1.2, s1: 4.5, drag: 1.6, jit: p.w * 0.4 });
        burst('fire', p.x, 2.5, p.z, 6, { spd: 12, up: 16, life: 0.9, s0: 0.5, s1: 0.1, grav: 22, jit: 2 });
        SFX.building(p.x, p.z);
      }
    }
    function crushFountain(instant) {
      var f = api.fountain; if (!f || !f.group) return;
      dropCollider(f.collider);
      if (f.group.parent) { f.group.parent.remove(f.group); f.group.traverse(function (m) { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); }
      town.unit = town.unit || new THREE.BoxGeometry(1, 1, 1);
      var g = new THREE.Group(), darkM = new THREE.MeshLambertMaterial({ color: 0x140c10 }), stone = api.flat(0x8f939e), i;
      var crater = new THREE.Mesh(new THREE.CircleGeometry(9.5, 22), darkM); crater.rotation.x = -Math.PI / 2; crater.position.y = 0.045; crater.receiveShadow = true; g.add(crater);
      for (i = 0; i < 9; i++) { var a = i / 9 * 6.283 + rand(-0.2, 0.2), L = rand(7, 15), ck = new THREE.Mesh(town.unit, darkM); ck.scale.set(rand(0.18, 0.4), 0.02, L); ck.position.set(Math.sin(a) * (6 + L / 2), 0.05, Math.cos(a) * (6 + L / 2)); ck.rotation.y = a; g.add(ck); }
      for (i = 0; i < 12; i++) { var b2 = i / 12 * 6.283 + rand(-0.2, 0.2), R = rand(4.2, 8.5), sy = rand(0.25, 0.8), st2 = new THREE.Mesh(town.unit, stone); st2.scale.set(rand(0.6, 1.6), sy, rand(0.6, 1.4)); st2.position.set(Math.sin(b2) * R, sy / 2, Math.cos(b2) * R); st2.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3)); st2.castShadow = true; g.add(st2); }
      scene.add(g); town.crater = g;
      if (!instant) burst('water', 0, 1, 0, 16, { spd: 14, up: 20, life: 1.3, s0: 0.35, s1: 0.2, grav: 26 });
    }
    function flattenFlora(instant) {
      var map = {}, skip = {};
      function key(x, z) { return x.toFixed(3) + '|' + z.toFixed(3); }
      scene.children.forEach(function (o) { if (o !== api.player && o !== camera && (o.isGroup || o.isMesh)) map[key(o.position.x, o.position.z)] = o; });
      (api.npcs || []).forEach(function (n) { skip[key(n.x, n.z)] = true; });
      api.colliders.slice().forEach(function (c) {
        if (c.r === undefined || c.r > 1.2 || c === bossCol || c === api.fountain.collider) return;
        var k = key(c.x, c.z), o = map[k]; if (skip[k] || !o) return;
        var d = Math.hypot(c.x, c.z) || 1;
        town.queue.push({ t: d / WAVE, fn: function (inst) {
          dropCollider(c);
          if (o.isMesh) { o.scale.multiplyScalar(0.55); o.position.y = 0.04; return; }                // rocks: cracked and sunk
          var tp = { o: o, q0: o.quaternion.clone(), ax: new THREE.Vector3(c.z / d, 0, -c.x / d), t: 0, dur: rand(0.5, 0.85), ang: rand(1.38, 1.5) };
          if (inst) { o.quaternion.setFromAxisAngle(tp.ax, tp.ang).multiply(tp.q0); return; }
          town.topples.push(tp);
          if (Math.random() < 0.3 && Math.hypot(c.x - api.player.position.x, c.z - api.player.position.z) < 40) burst('dust', c.x, 0.6, c.z, 2, { spd: 3, up: 2, life: 1.2, s0: 0.5, s1: 1.6, drag: 2 });
        } });
      });
    }
    function launchNpcs(instant) {
      (api.npcs || []).forEach(function (n) {
        var d = Math.hypot(n.x, n.z); if (d > 9 || !n.mesh) return;
        for (var i = api.colliders.length - 1; i >= 0; i--) { var c = api.colliders[i]; if (c.r === 0.8 && c.x === n.x && c.z === n.z) api.colliders.splice(i, 1); }
        n.mesh.visible = false;
        if (!instant) {
          var fl = api.boxMan({ suit: n.color, hair: 0x2b303c, glasses: false, tie: n.tie || 0xffffff }); fl.scale.set(0.85, 0.85, 0.85); fl.position.set(n.x, 0.2, n.z); scene.add(fl);
          fl.userData.la.rotation.x = -2.6; fl.userData.ra.rotation.x = -2.9; fl.userData.ll.rotation.x = 0.6; fl.userData.rl.rotation.x = -0.5;
          town.flyers.push({ m: fl, vx: n.x / (d || 1) * 15, vy: 44, vz: n.z / (d || 1) * 15, t: 0, said: false, name: String(n.title || 'A COLLEAGUE').toUpperCase() });
        }
        n.x = n.z = 1e5;      // the host's "that was a colleague" check should no longer find anyone standing here
      });
    }
    function destroyTown(instant) {
      if (town.destroyed) return;
      town.destroyed = true; town.clock = 0;
      crushFountain(instant); launchNpcs(instant);
      api.places.forEach(function (p) { town.queue.push({ t: Math.max(0.15, (Math.hypot(p.x, p.z) - 4) / WAVE), fn: function (inst) { burstBuilding(p, inst); } }); });
      flattenFlora(instant);
      town.queue.sort(function (a, b) { return a.t - b.t; });
      if (instant) finishDestruction();
    }
    function townStep(h) {
      if (town.queue.length) { town.clock += h; while (town.queue.length && town.queue[0].t <= town.clock) { var q = town.queue.shift(); guard(function () { q.fn(false); }); } }
      var i;
      for (i = town.topples.length - 1; i >= 0; i--) {
        var tp = town.topples[i]; tp.t += h; var k = tp.t / tp.dur, a = k < 1 ? tp.ang * k * k : tp.ang * (1 - 0.07 * Math.exp(-5 * (k - 1)) * Math.abs(Math.sin(12 * (k - 1))));
        tp.o.quaternion.setFromAxisAngle(tp.ax, a).multiply(tp.q0); if (k > 2.2) town.topples.splice(i, 1);
      }
      for (i = town.flyers.length - 1; i >= 0; i--) {
        var f = town.flyers[i]; f.t += h; f.vy -= 9 * h; f.m.position.x += f.vx * h; f.m.position.y += f.vy * h; f.m.position.z += f.vz * h; f.m.rotation.x += 7 * h; f.m.rotation.z += 3 * h;
        if (!f.said && f.t > 1.0) { f.said = true; say('showToast', f.name + ' HAS LEFT THE REVIEW PROCESS'); }
        if (f.t > 2.6) { fxSpawn('white', f.m.position.x, f.m.position.y, f.m.position.z, 0, 0, 0, { life: 0.5, s0: 0.5, s1: 5 }); SFX.twinkle(); scene.remove(f.m); disposeTree(f.m); town.flyers.splice(i, 1); }
      }
      debrisStep(h);
    }
    function finishDestruction() {         // snap everything still in flight to its final state (stop() mid-wave, or retry)
      var q = town.queue.slice(); town.queue.length = 0; q.forEach(function (e) { guard(function () { e.fn(true); }); });
      town.topples.forEach(function (tp) { tp.o.quaternion.setFromAxisAngle(tp.ax, tp.ang).multiply(tp.q0); }); town.topples.length = 0;
      town.flyers.forEach(function (f) { scene.remove(f.m); disposeTree(f.m); }); town.flyers.length = 0;
      town.debris.forEach(freeDebris); town.debris.length = 0;
      town.geos.forEach(function (g) { g.dispose(); }); town.geos.length = 0;
    }
    /* ------------------------------------------------------------ the professor emeritus
       The old man in the cave, relocated to a flattened university town. He appears when the dust settles,
       holds out a piece of decommissioned departmental equipment, and is entirely unbothered by the
       seventeen-metre editor behind him. Take it or do not: the paper balls still work. */
    var sage = null, gaveGun = false, VS = new THREE.Vector3();
    var SAGE_TITLE = 'PROFESSOR EMERITUS';
    var SAGE_LINE = "IT'S DANGEROUS TO GO ALONE! TAKE THIS.";
    var SAGE_CODA = 'IT WAS COSTED INTO A 2011 EQUIPMENT GRANT. NOBODY EVER CAME TO COLLECT IT. DO TRY TO CITE ME.';
    var SAGE_AGAIN = [
      'ONE SHOT. ONE REBUTTAL. MIND THE RECOIL.',
      'I AM EMERITUS. I NO LONGER ATTEND MEETINGS, AND I NO LONGER DIE.',
      'AIM FOR THE H-INDEX. IT IS THE ONLY NUMBER HE HAS.',
      'I REVIEWED FOR HIM ONCE. IN 1994. I AM STILL AWAITING A DECISION.'
    ];
    function glowTex() {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, 'rgba(190,255,215,0.95)'); g.addColorStop(0.45, 'rgba(70,235,140,0.35)'); g.addColorStop(1, 'rgba(30,200,110,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      var t = new THREE.CanvasTexture(c); return t;
    }
    function buildGunProp(parent) {                    // the same box cannon the player ends up holding, held out flat
      var g = new THREE.Group();
      function lam(c) { var m = new THREE.MeshLambertMaterial({ color: c }); m.emissive = new THREE.Color(c).multiplyScalar(0.4); return m; }
      function box(w, h, d, mat, x, y, z) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }
      var shell = lam(0x7c8c6e), shell2 = lam(0x566349), trim = lam(0xa9b69f), dark = lam(0x2b3327), copper = lam(0xc08a46);
      box(0.3, 0.24, 0.78, shell, 0, 0, 0);
      box(0.36, 0.07, 0.5, shell2, 0, 0.14, -0.06);
      box(0.46, 0.38, 0.2, shell, 0, 0, -0.5);
      box(0.5, 0.06, 0.23, trim, 0, 0.19, -0.5); box(0.5, 0.06, 0.23, trim, 0, -0.19, -0.5);
      box(0.2, 0.2, 0.05, dark, 0, 0, -0.61);
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0x5cff8a, fog: false });
      var eye = box(0.15, 0.15, 0.04, eyeMat, 0, 0, -0.64); eye.castShadow = false;
      box(0.2, 0.2, 0.18, shell2, 0, 0, 0.44); box(0.12, 0.12, 0.07, copper, 0, 0, 0.55);
      box(0.05, 0.06, 0.44, copper, 0.18, 0.07, 0.07); box(0.05, 0.06, 0.44, copper, -0.18, 0.07, 0.07);
      if (parent) parent.add(g);
      g.userData.eyeMat = eyeMat;
      return g;
    }
    function buildSage(x, z) {
      var man = null;
      guard(function () { man = api.boxMan({ suit: 0x6f6148, hair: 0xf1ede2, tie: 0x7d2b33, glasses: true }); });
      if (!man) return null;
      var g = new THREE.Group(); g.add(man);
      // the town is a burnt red silhouette by now; he is lit from inside so he reads as the one thing still alive
      man.traverse(function (m) { if (m.material && m.material.emissive) m.material.emissive.copy(m.material.color).multiplyScalar(0.42); });
      function lam(c, e) { var m = new THREE.MeshLambertMaterial({ color: c }); m.emissive = new THREE.Color(e === undefined ? c : e); if (e === undefined) m.emissive.multiplyScalar(0.42); return m; }
      function box(w, h, d, mat, px, py, pz, parent) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(px, py, pz); m.castShadow = true; (parent || man).add(m); return m; }
      var tweed = lam(0x5b4f39), tweed2 = lam(0x4a4030), white = lam(0xf1ede2), glass = lam(0xbfe6ff, 0x24343f), frame = lam(0x231c16), horn = lam(0xd8c7a0);
      // ancient cardigan: two hanging front panels, a shawl collar, three buttons down the middle
      box(0.28, 1.06, 0.1, tweed, -0.32, 1.35, 0.24); box(0.28, 1.06, 0.1, tweed, 0.32, 1.35, 0.24);
      box(0.94, 0.16, 0.6, tweed2, 0, 1.86, 0.05);
      var bt; for (bt = 0; bt < 3; bt++) box(0.07, 0.07, 0.05, horn, 0, 1.62 - bt * 0.3, 0.29);
      box(0.96, 0.14, 0.56, tweed2, 0, 0.82, 0);                       // the hem, worn flat
      [man.userData.la, man.userData.ra].forEach(function (arm) {      // elbow patches, of course
        if (arm) { var p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), tweed2); p.position.set(0, -0.52, 0); arm.add(p); }
      });
      // wild white hair: the standard block, plus tufts that have given up
      box(0.24, 0.3, 0.5, white, -0.5, 2.6, -0.05).rotation.z = 0.5;
      box(0.24, 0.3, 0.5, white, 0.5, 2.6, -0.05).rotation.z = -0.5;
      box(0.5, 0.26, 0.26, white, 0.1, 2.86, -0.1).rotation.x = 0.4;
      box(0.34, 0.3, 0.14, white, 0, 2.03, 0.36);                      // and a beard
      // thick glasses: real bottle ends, over the host's thin ones
      [-0.2, 0.2].forEach(function (ex) { box(0.3, 0.28, 0.12, glass, ex, 2.36, 0.46); box(0.34, 0.06, 0.14, frame, ex, 2.51, 0.46); box(0.34, 0.06, 0.14, frame, ex, 2.21, 0.46); });
      box(0.16, 0.06, 0.1, frame, 0, 2.36, 0.48);
      if (man.userData.la) man.userData.la.rotation.x = -1.28;
      if (man.userData.ra) man.userData.ra.rotation.x = -1.28;
      var gun = buildGunProp(g); gun.position.set(0, 1.62, 0.82); gun.rotation.y = Math.PI / 2; gun.rotation.z = 0.12;   // held out flat across both hands
      // a soft glow on the ground so he reads across a flattened town, and a sign so you know he wants you
      var glowMat = new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      var glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.07; glow.scale.setScalar(4.6); g.add(glow);
      var aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat); aura.position.set(0, 1.5, -0.4); aura.scale.setScalar(5.2); g.add(aura);
      var lamp = new THREE.PointLight(0x9fffc8, 1.5, 11, 1.6); lamp.position.set(0, 1.9, 0.9); g.add(lamp);
      var marker = null;
      guard(function () { marker = api.labelSprite('OFFICE HOURS', '#0b2b1c', '#8fffc0'); });
      if (marker) { marker.scale.set(4.6, 0.86, 1); marker.position.y = 4.6; g.add(marker); }
      var arrowMat = new THREE.MeshBasicMaterial({ color: 0x8fffc0, fog: false });
      var arrow = new THREE.Group();
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), arrowMat); head.rotation.z = Math.PI / 4; arrow.add(head);
      var stem = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.2), arrowMat); stem.position.y = 0.4; arrow.add(stem);
      arrow.position.y = 3.8; g.add(arrow);
      g.position.set(x, 0, z);
      scene.add(g);
      return { g: g, man: man, gun: gun, glow: glow, aura: aura, glowMat: glowMat, marker: marker, arrow: arrow, lamp: lamp,
               eyeMat: gun.userData.eyeMat, x: x, z: z, yaw: 0, t: 0, talkCool: 0, again: 0, inRange: false, col: null, followT: null };
    }
    /* At the edge of vision, not behind you. The old version put him perpendicular to the player's bearing from
       the town centre, which measured 84 degrees off the line to the editor: completely off screen, so nobody
       ever found him. This one works off the firing line itself - the line from the player to the boss - and
       lands him 35-40 degrees round it, which with a 55-degree vertical FOV is just inside the frame while you
       are looking at the badge. Twelve to fifteen units out: close enough to walk to, far enough that the
       editor's stride (it holds 13-22 units from the player, inside a 27-unit ring) never comes down on him. */
    // 32 degrees. The view is 55 degrees vertical, so a phone in portrait has about 35 degrees of horizontal
    // half-angle and a desktop about 39: at 32 he is inside the frame on both while you are sighting the badge.
    var SAGE_OFF = 0.56;                 // opening out to 45 if every spot at that angle is taken
    function sageSpot() {
      var p = api.player.position;
      var bx = boss ? boss.x : 0, bz = boss ? boss.z : 0;
      var aim = Math.atan2(bx - p.x, bz - p.z);            // the firing line, as a yaw
      var side = (p.x * bz - p.z * bx) >= 0 ? 1 : -1;      // prefer the side with more arena behind it
      var k, sd, d, a, x, z;
      for (k = 0; k < 8; k++) {
        for (sd = 0; sd < 2; sd++) {
          a = aim + (sd ? -side : side) * (SAGE_OFF + k * 0.033);
          for (d = 12; d <= 15.1; d += 1.05) {
            x = p.x + Math.sin(a) * d; z = p.z + Math.cos(a) * d;
            if (Math.hypot(x, z) > ARENA_R - 5) continue;                  // inside the ring you are held in
            if (Math.hypot(x - bx, z - bz) < 9.5) continue;                // out from under the editor
            if (api.collide(x, z, 1.1)) continue;
            return { x: x, z: z };
          }
        }
      }
      var fx = p.x + Math.sin(aim + side * SAGE_OFF) * 13, fz = p.z + Math.cos(aim + side * SAGE_OFF) * 13, s = null;
      guard(function () { s = api.safeSpot(fx, fz); });
      return s || { x: fx, z: fz };
    }
    function spawnSage() {
      if (sage || gaveGun) return;
      var s = sageSpot();
      sage = buildSage(s.x, s.z);
      if (!sage) return;
      sage.yaw = Math.atan2(api.player.position.x - s.x, api.player.position.z - s.z);
      sage.col = { x: s.x, z: s.z, r: 0.75 }; api.colliders.push(sage.col);
      burst('dust', s.x, 0.6, s.z, 8, { spd: 4, up: 3, life: 1.3, s0: 0.5, s1: 2.0, drag: 1.8, jit: 0.8 });
      SFX.sage(s.x, s.z);
      say('showToast', 'SOMEBODY IS STILL STANDING IN THE RUBBLE');
      sageCall(9);                       // and he shouts, so there is a direction to turn towards
    }
    // His voice with no caption attached: the Banjo-Kazooie burble, used as a sound cue when he turns up
    // behind you. Wall-clock, like the coda, because it is a noise and not part of the simulation.
    var callT = null;
    function sageCall(n) {
      if (callT) { clearInterval(callT); callT = null; }
      var i = 0, N = n || 7, syl = 'hoaeimu';
      callT = setInterval(function () {
        if (!self.active || !sage) { clearInterval(callT); callT = null; return; }
        guard(function () { api.speak(SAGE_VOICE, syl.charAt(i % syl.length)); });
        if (++i >= N) { clearInterval(callT); callT = null; }
      }, 95);
    }
    function callKill() { if (callT) { clearInterval(callT); callT = null; } }
    function sageSay(text) { guard(function () { api.notice({ title: SAGE_TITLE, text: text, voice: SAGE_VOICE }); }); }
    // isOver(): on the REJECTED! screen F and Space resubmit, and standing next to him must not eat that key
    function sageReady() {
      if (!sage || !sage.inRange || sage.talkCool > 0 || !self.active || phase !== 'fight' || self.cinematic) return false;
      var over = false; guard(function () { over = api.isOver(); });
      return !over;
    }
    /* The only thing worth swallowing a key press for is the gift itself. Once he has handed it over, F and the
       A button go back to firing the weapon he just gave you - standing near an old man must never jam the gun -
       and his remaining opinions are on the prompt, which you click or tap. */
    function sageGift() { return !gaveGun && !!dom.talk && sageReady(); }
    function giveGun() {
      if (gaveGun) return;
      gaveGun = true;
      guard(function () { api.setWeapon({ kind: 'bfg', rate: BFG.rate, speed: BFG.speed, gravity: 0 }); });
      var s = sage;
      if (s) {
        if (s.gun) s.gun.visible = false;
        if (s.marker) s.marker.visible = false;
        if (s.arrow) s.arrow.visible = false;
        if (s.man && s.man.userData.la) s.man.userData.la.rotation.x = -0.25;
        if (s.man && s.man.userData.ra) s.man.userData.ra.rotation.x = -0.25;
        burst('plasma', s.x, 1.7, s.z, 18, { spd: 9, up: 8, life: 0.8, s0: 0.35, s1: 0.05, grav: 10, jit: 0.6 });
        fxSpawn('white', s.x, 1.7, s.z, 0, 0, 0, { life: 0.3, s0: 0.8, s1: 5.5 });
      }
      SFX.getItem();
      guard(function () { api.shake(0.25, 0.3); });
      say('showToast', 'BFG-9000 ACQUIRED  ·  SEE SUPPLEMENTARY METHODS');
    }
    function sageTalk() {
      if (!sageReady()) return;
      sage.talkCool = 0.7;
      if (gaveGun) { sageSay(SAGE_AGAIN[sage.again++ % SAGE_AGAIN.length]); return; }
      sageSay(SAGE_LINE);
      giveGun();
      // the coda waits in wall-clock time: the caption types itself out at 24 ms a character whatever the timescale
      if (sage.followT) clearTimeout(sage.followT);
      sage.followT = setTimeout(function () { if (sage) { sage.followT = null; if (self.active) sageSay(SAGE_CODA); } }, 3400);
    }
    function sageStep(h, t) {
      var s = sage; if (!s) return;
      s.t += h;
      if (s.talkCool > 0) s.talkCool -= h;
      var p = api.player.position, dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz);
      if (d < 14) s.yaw += angDiff(Math.atan2(dx, dz), s.yaw) * (1 - Math.exp(-3 * h));
      s.g.position.y = 0.04 + Math.sin(s.t * 1.7) * 0.07;
      s.g.rotation.y = s.yaw + Math.sin(s.t * 0.8) * 0.06;
      var pulse = 0.5 + 0.5 * Math.sin(s.t * 2.2);
      s.glowMat.opacity = 0.3 + 0.22 * pulse;
      s.glow.scale.setScalar(4.4 + pulse * 0.6);
      if (s.lamp) s.lamp.intensity = 1.2 + pulse * 0.7;
      if (s.marker && s.marker.visible) s.marker.position.y = 4.6 + Math.sin(s.t * 2.4) * 0.16;
      if (s.arrow && s.arrow.visible) { s.arrow.position.y = 3.8 + Math.sin(s.t * 2.4 + 0.5) * 0.2; s.arrow.rotation.y += h * 1.5; }
      if (s.gun && s.gun.visible) { s.gun.position.y = 1.62 + Math.sin(s.t * 1.9) * 0.05; s.eyeMat.color.setRGB(0.25, 0.6 + 0.35 * Math.abs(Math.sin(s.t * 2.6)), 0.35); }
      indStep(s);
      // the prompt: only when he is worth talking to, and only when he is actually on screen
      // just below eye level, not the marker over his head: at three units the marker is off the top of the
      // screen, and on a phone the top band already holds the H-INDEX bar and the attack caption
      VS.set(s.x, 2.15, s.z).project(camera);
      var seen = VS.z <= 1 && Math.abs(VS.x) < 1 && Math.abs(VS.y) < 1;
      // inRange drives every talk path, so it has to mean "you can see who you are talking to". Left true while
      // he was behind you, F used to open a conversation with a man off the back of the screen.
      var want = seen && d < 3.2 && phase === 'fight' && !self.cinematic;
      s.inRange = want;
      if (!want) { if (dom.talk) rm('talk'); return; }
      var pin = narrowView(), label = (pin ? 'A' : 'F / CLICK') + (gaveGun ? ': SPEAK' : ': TAKE IT');
      if (!dom.talk) {
        dom.talk = el('div', 'qb-talk', label);
        dom.talk.addEventListener('pointerdown', onSagePrompt);
        dom.talkLabel = label;
      } else if (dom.talkLabel !== label) { dom.talk.textContent = label; dom.talkLabel = label; }
      // on a phone it is parked in the one corner the touch controls do not use; elsewhere it floats by his head
      dom.talk.classList.toggle('is-pin', pin);
      if (pin) { dom.talk.style.left = ''; dom.talk.style.top = ''; }
      else {
        dom.talk.style.left = clamp((VS.x + 1) / 2 * 100, 14, 86) + '%';
        dom.talk.style.top = clamp((1 - VS.y) / 2 * 100, 32, 74) + '%';
      }
    }
    function narrowView() {
      var w = 0; guard(function () { w = api.view.clientWidth || 0; });
      if (w && w < 700) return true;
      try { return !!(window.matchMedia && window.matchMedia('(hover:none)').matches); } catch (e) { return false; }
    }
    /* The off-screen indicator, the same trick the cave plays with THE UNDERSPEND: while he is alive, still
       holding it and outside the frame, a chevron rides the edge of the view pointing at him. It is his green,
       it carries his sign, it never takes a tap, and it goes the instant he is on screen or has handed it over. */
    function indStep(s) {
      var ok = s && !gaveGun && self.active && phase === 'fight' && !self.cinematic;
      if (ok) { var ov = false; guard(function () { ov = api.isOver(); }); ok = !ov; }
      if (!ok) { if (dom.ind) rm('ind'); return; }
      VS.set(s.x, 1.9, s.z).project(camera);
      var behind = VS.z > 1, vx = behind ? -VS.x : VS.x, vy = behind ? -VS.y : VS.y;
      if (!behind && Math.abs(vx) < 0.93 && Math.abs(vy) < 0.93) { if (dom.ind) rm('ind'); return; }   // on screen
      var dx = vx, dy = -vy;                                     // screen space, y downwards
      if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) dy = 1;
      // the band the chevron is allowed to ride. On a phone the d-pad owns everything below y ~0.40 of the
      // view on the left and the A/B buttons the bottom right, so it stays in the strip above them.
      var nar = narrowView(), hx = nar ? 0.40 : 0.44, y0 = nar ? -0.135 : -0.34, y1 = nar ? -0.135 : 0.30;
      var tx = dx > 0 ? hx / dx : dx < 0 ? -hx / dx : 1e9;
      var ty = dy > 0 ? y1 / dy : dy < 0 ? y0 / dy : 1e9;
      var tt = tx; if (ty > 0 && ty < tt) tt = ty;
      var px = clamp(0.5 + dx * tt, 0.5 - hx, 0.5 + hx), py = clamp(0.5 + dy * tt, 0.5 + y0, 0.5 + y1);
      if (!dom.ind) dom.ind = el('div', 'qb-ind', '<i></i><span>OFFICE HOURS</span>');
      // .q-view does not clip, so the label has to keep itself inside the frame: on a phone the band alone
      // would hang half of OFFICE HOURS out over the page
      var vw = api.view.clientWidth || 1, vh = api.view.clientHeight || 1;
      var mx = (dom.ind.offsetWidth / 2 + 4) / vw, my = (dom.ind.offsetHeight / 2 + 4) / vh;
      dom.ind.style.left = (clamp(px, mx, 1 - mx) * 100).toFixed(2) + '%';
      dom.ind.style.top = (clamp(py, my, 1 - my) * 100).toFixed(2) + '%';
      var arrow = dom.ind.firstChild;
      if (arrow && arrow.style) arrow.style.transform = 'rotate(' + (Math.atan2(dx, -dy) * 180 / Math.PI).toFixed(1) + 'deg)';
    }
    function onSagePrompt(e) { if (e) { e.preventDefault(); e.stopPropagation(); } guard(sageTalk); }
    function onSagePad(e) {                 // the touch A button, intercepted before the host turns it into a shot
      if (!sageGift() || !e || !e.target || !e.target.closest) return;
      if (!e.target.closest('[data-pad="act"]')) return;
      e.preventDefault(); e.stopPropagation(); guard(sageTalk);
    }
    function killSage() {
      callKill();
      var s = sage; if (!s) { rm('talk'); rm('ind'); return; }
      sage = null;
      if (s.followT) { clearTimeout(s.followT); s.followT = null; }
      if (dom.talk) { dom.talk.removeEventListener('pointerdown', onSagePrompt); rm('talk'); }
      rm('ind');
      dom.talkLabel = undefined;
      var i = api.colliders.indexOf(s.col); if (i >= 0) api.colliders.splice(i, 1);
      if (s.g.parent) s.g.parent.remove(s.g);
      // not disposeTree: THREE.Sprite shares one BufferGeometry across every sprite on the page, and his
      // marker is a sprite. Materials and canvas textures are ours; the geometry is not.
      s.g.traverse(function (m) {
        if (m.geometry && m.geometry.dispose && !m.isSprite) m.geometry.dispose();
        if (m.material) { if (m.material.map && m.material.map.dispose) m.material.map.dispose(); if (m.material.dispose) m.material.dispose(); }
      });
    }

    /* ------------------------------------------------------------ sequencer state, skipping, banners */
    var phase = '', pT = 0, total = 0, maxHp = 100, fired = false, env = null, musicOn = false;
    function music(name) { musicOn = (name === 'boss'); say('music', name); }
    var omen = null, out = null, F = null;
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function setPhase(name) { phase = name; pT = 0; guard(function () { enterPhase(name); }); }

    function canSkip() { return self.active && pT >= 1.0 && (phase === 'card' || phase === 'outro'); }
    function onSkip(e) {
      if (!canSkip()) return;                      // every tap on the view comes through here: only eat the ones we use
      if (e && e.preventDefault) e.preventDefault();
      if (phase === 'card') { closeCard(); SFX.confirm(); setPhase('omen'); return; }
      if (phase === 'outro' && out && !out.skipped && out.c < OUT_FLASH) { skipOutro(); SFX.confirm(); }
    }
    function onSkipKey(e) {
      if (!e || e.repeat) return;
      if (e.code !== 'KeyF' && e.code !== 'Space' && e.code !== 'Enter') return;
      if (e.code === 'KeyF' && sageGift()) {       // taking it beats firing into the rubble; afterwards, F fires
        e.stopPropagation(); if (e.preventDefault) e.preventDefault();
        guard(sageTalk); return;
      }
      if (!canSkip()) return;
      e.stopPropagation();          // window capture: the host must not also fire or jump on this one
      onSkip(e);
    }

    function showBanner(main, sub) {
      rm('banner');
      dom.banner = el('div', 'qb-banner', esc(main) + (sub ? '<small>' + esc(sub) + '</small>' : ''));
      dom.bannerA = 0;
    }
    function setBanner(a) { if (dom.banner) dom.banner.style.opacity = clamp(a, 0, 1); }
    function showCount(txt) {
      if (!dom.count) dom.count = el('div', 'qb-count', '');
      dom.count.textContent = txt;
    }
    function hideCount() { rm('count'); }
    function showCap(txt, sub) {
      if (!dom.cap) dom.cap = el('div', 'qb-cap', '');
      dom.cap.innerHTML = esc(txt) + (sub ? '<small>' + esc(sub) + '</small>' : '');
      dom.cap.style.opacity = '1'; dom.capT = 2.4;
    }
    function capStep(h) {
      if (!dom.cap || !dom.capT) return;
      dom.capT -= h;
      if (dom.capT <= 0) rm('cap'); else if (dom.capT < 0.5) dom.cap.style.opacity = String(dom.capT / 0.5);
    }
    function setFlash(k) {
      if (k <= 0.001) { rm('flash'); return; }
      if (!dom.flash) dom.flash = el('div', 'qb-flash', '');
      dom.flash.style.opacity = String(clamp(k, 0, 1));
    }

    /* ------------------------------------------------------------ projectiles: manuscripts, pen strokes, shockwave rings
       Everything here is sub-stepped (see prjStep): a timescaled frame can be 0.5 s long and nothing may tunnel
       through the player capsule or the ground. */
    var PRJ = null;
    function makeManuscriptTex() {
      var c = document.createElement('canvas'); c.width = 48; c.height = 64; var x = c.getContext('2d'), i;
      x.fillStyle = '#f7f2e4'; x.fillRect(0, 0, 48, 64);
      x.fillStyle = '#c9c2ae'; for (i = 0; i < 9; i++) x.fillRect(6, 9 + i * 6, i === 8 ? 20 : 36, 2);
      x.strokeStyle = '#e0192c'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(8, 14); x.lineTo(40, 40); x.moveTo(40, 14); x.lineTo(8, 40); x.stroke();
      x.beginPath(); x.arc(24, 50, 8, 0, 6.283); x.stroke();
      var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t;
    }
    function prjInit() {
      if (PRJ) return;
      PRJ = {
        live: [], pool: [], made: 0, cap: 70, rings: [], marks: [], scorch: [],
        tex: makeManuscriptTex(),
        paperGeo: new THREE.BoxGeometry(0.64, 0.86, 0.12),
        strokeGeo: new THREE.BoxGeometry(0.3, 3.0, 0.3),
        glowGeo: new THREE.BoxGeometry(1.0, 1.25, 0.5),
        markGeo: new THREE.RingGeometry(1.05, 1.5, 20),
        colGeo: new THREE.CylinderGeometry(1.05, 1.35, 30, 12, 1, true),
        wallGeo: new THREE.CylinderGeometry(1, 1, 1, 44, 1, true),
        ringGeo: new THREE.RingGeometry(0.9, 1.0, 44),
        scorchGeo: new THREE.CircleGeometry(1.3, 14)
      };
      PRJ.paperMat = new THREE.MeshBasicMaterial({ map: PRJ.tex, fog: false });
      PRJ.strokeMat = new THREE.MeshBasicMaterial({ color: 0xff2233, fog: false });
      PRJ.glowMat = new THREE.MeshBasicMaterial({ color: 0xff3a22, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      PRJ.markMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, fog: false });
      PRJ.scorchMat = new THREE.MeshBasicMaterial({ color: 0x3a0810, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, fog: false });
      PRJ.colMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    }
    function prjGet() {
      if (!PRJ) return null;
      var p = PRJ.pool.pop();
      if (!p) {
        if (PRJ.made >= PRJ.cap) { p = PRJ.live.shift(); if (!p) return null; }
        else {
          var g = new THREE.Group();
          var body = new THREE.Mesh(PRJ.paperGeo, PRJ.paperMat), glow = new THREE.Mesh(PRJ.glowGeo, PRJ.glowMat);
          g.add(body); g.add(glow); PRJ.made++;
          p = { g: g, body: body, glow: glow };
        }
      }
      p.g.scale.set(1, 1, 1); p.g.rotation.set(0, 0, 0);
      if (!p.g.parent) scene.add(p.g);
      PRJ.live.push(p); return p;
    }
    function prjFree(p, i) {
      if (i === undefined) i = PRJ.live.indexOf(p);
      if (i >= 0) PRJ.live.splice(i, 1);
      if (p.g.parent) p.g.parent.remove(p.g);
      PRJ.pool.push(p);
    }
    function shootOrb(x, y, z, tx, ty, tz, speed) {
      var p = prjGet(); if (!p) return;
      p.kind = 'orb'; p.body.geometry = PRJ.paperGeo; p.body.material = PRJ.paperMat;
      p.body.scale.set(1, 1, 1); p.glow.scale.set(1, 1, 1);
      var dx = tx - x, dy = ty - y, dz = tz - z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      p.vx = dx / L * speed; p.vy = dy / L * speed; p.vz = dz / L * speed;
      p.grav = 0.8; p.life = 6; p.r = 0.42; p.spin = rand(4, 9); p.hurtR = 0.42;
      p.g.position.set(x, y, z);
      SFX.launch(x, y, z);
    }
    function dropStroke(tx, tz, fromY) {
      var p = prjGet(); if (!p) return;
      p.kind = 'stroke'; p.body.geometry = PRJ.strokeGeo; p.body.material = PRJ.strokeMat;
      p.body.scale.set(1, 1, 1); p.glow.scale.set(0.42, 3.0, 0.42);
      p.vx = 0; p.vy = -46; p.vz = 0; p.grav = 0; p.life = 3; p.r = 0.4; p.spin = 0; p.hurtR = 0.55;
      p.g.position.set(tx, fromY === undefined ? 34 : fromY, tz);
    }
    function addMark(x, z, dur) { if (PRJ) PRJ.marks.push({ x: x, z: z, t: 0, dur: dur }); }
    function addScorch(x, z) {
      if (!PRJ) return;
      var m = new THREE.Mesh(PRJ.scorchGeo, PRJ.scorchMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.055, z); m.scale.setScalar(rand(0.8, 1.3)); scene.add(m);
      PRJ.scorch.push({ m: m, t: 0, s: m.scale.x });
      if (PRJ.scorch.length > 26) { var o = PRJ.scorch.shift(); scene.remove(o.m); }
    }
    function addRing(x, z, r0, speed, max, harm, colour) {
      if (!PRJ) return null;
      var mat = new THREE.MeshBasicMaterial({ color: colour || 0xffb347, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false });
      var m = new THREE.Mesh(PRJ.ringGeo, mat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.09, z); m.scale.setScalar(r0); scene.add(m);
      var wall = null;
      if (harm) {                                   // a knee-high wall of light: visible even when you are looking up at the badge
        wall = new THREE.Mesh(PRJ.wallGeo, mat); wall.position.set(x, 0.9, z); wall.scale.set(r0, 1.8, r0); scene.add(wall);
      }
      var ring = { m: m, wall: wall, mat: mat, x: x, z: z, r: r0, v: speed, max: max, harm: !!harm, hit: false };
      PRJ.rings.push(ring); return ring;
    }
    function hitsPlayer(x, y, z, r) {
      var p = api.player.position, dx = x - p.x, dz = z - p.z;
      var cy = clamp(y, p.y + 0.6, p.y + 2.0), dy = y - cy, rr = r + 0.6;
      return dx * dx + dy * dy + dz * dz < rr * rr;
    }
    function hitPlayer(x, y, z) {
      var got = false;
      guard(function () { got = api.hurt(1); });
      burst('red', x, y, z, 5, { spd: 5, up: 4, life: 0.5, s0: 0.3, s1: 0.05, grav: 9 });
      return got;
    }
    function orbPop(p) {
      burst('fire', p.g.position.x, p.g.position.y, p.g.position.z, 4, { spd: 5, up: 3, life: 0.45, s0: 0.35, s1: 0.05, grav: 14 });
      SFX.puff(p.g.position.x, p.g.position.y, p.g.position.z);
    }
    function prjSub(h, live) {
      var i, p, pos;
      for (i = PRJ.live.length - 1; i >= 0; i--) {
        p = PRJ.live[i]; pos = p.g.position;
        p.life -= h; p.vy -= p.grav * h;
        pos.x += p.vx * h; pos.y += p.vy * h; pos.z += p.vz * h;
        if (p.kind === 'orb') { p.g.rotation.x += p.spin * h; p.g.rotation.y += p.spin * 0.7 * h; }
        if (live && hitsPlayer(pos.x, pos.y, pos.z, p.hurtR)) { hitPlayer(pos.x, pos.y, pos.z); orbPop(p); prjFree(p, i); continue; }
        if (pos.y <= (p.kind === 'stroke' ? 1.0 : 0.25)) {
          if (p.kind === 'stroke') {
            addScorch(pos.x, pos.z); SFX.stroke(pos.x, pos.z);
            burst('red', pos.x, 0.4, pos.z, 7, { spd: 9, up: 7, life: 0.6, s0: 0.35, s1: 0.06, grav: 18 });
            if (live && hitsPlayer(pos.x, 1.0, pos.z, 1.1)) hitPlayer(pos.x, 1.2, pos.z);
          } else orbPop(p);
          prjFree(p, i); continue;
        }
        if (p.life <= 0 || Math.abs(pos.x) > api.WORLD + 6 || Math.abs(pos.z) > api.WORLD + 6 || pos.y > 90) { prjFree(p, i); continue; }
      }
      for (i = PRJ.rings.length - 1; i >= 0; i--) {
        var g = PRJ.rings[i];
        g.r += g.v * h; g.m.scale.setScalar(g.r);
        if (g.wall) g.wall.scale.set(g.r, 1.8, g.r);
        g.mat.opacity = 0.9 * clamp(1 - g.r / g.max, 0, 1);
        if (g.harm && !g.hit && live) {
          var pp = api.player.position, d = Math.hypot(pp.x - g.x, pp.z - g.z);
          if (Math.abs(d - g.r) < 1.5 && pp.y < 1.45) { g.hit = true; hitPlayer(pp.x, pp.y + 0.8, pp.z); }
        }
        if (g.r >= g.max) { scene.remove(g.m); if (g.wall) scene.remove(g.wall); g.mat.dispose(); PRJ.rings.splice(i, 1); }
      }
    }
    function prjStep(dt, live) {
      if (!PRJ) return;
      var left = dt, n = 0;
      while (left > 1e-4 && n < 36) { var h = left > 0.025 ? 0.025 : left; prjSub(h, live); left -= h; n++; }
      // ground markers and scorch marks: cosmetic, no sub-stepping needed
      var i, k;
      for (i = PRJ.marks.length - 1; i >= 0; i--) {
        var mk = PRJ.marks[i]; mk.t += dt;
        if (mk.t >= mk.dur) { PRJ.marks.splice(i, 1); }
      }
      for (i = PRJ.scorch.length - 1; i >= 0; i--) {
        var sc = PRJ.scorch[i]; sc.t += dt;
        if (sc.t > 6) { scene.remove(sc.m); PRJ.scorch.splice(i, 1); }
        else sc.m.material.opacity = 0.85 * clamp((6 - sc.t) / 2.5, 0, 1);
      }
      // draw the live markers with one shared pool of meshes
      if (!PRJ.markMeshes) { PRJ.markMeshes = []; PRJ.colMeshes = []; }
      for (i = 0; i < PRJ.marks.length; i++) {
        var m = PRJ.markMeshes[i], col = PRJ.colMeshes[i];
        if (!m) { m = new THREE.Mesh(PRJ.markGeo, PRJ.markMat); m.rotation.x = -Math.PI / 2; PRJ.markMeshes[i] = m; }
        if (!col) { col = new THREE.Mesh(PRJ.colGeo, PRJ.colMat); PRJ.colMeshes[i] = col; }
        if (!m.parent) scene.add(m);
        if (!col.parent) scene.add(col);
        k = PRJ.marks[i].t / PRJ.marks[i].dur;
        m.position.set(PRJ.marks[i].x, 0.07, PRJ.marks[i].z);
        m.scale.setScalar(lerp(1.5, 0.75, k) * (1 + Math.sin(k * 34) * 0.06));
        col.position.set(PRJ.marks[i].x, 15, PRJ.marks[i].z);
        col.scale.set(lerp(1.1, 0.7, k), 1, lerp(1.1, 0.7, k));
        m.visible = col.visible = true;
      }
      for (i = PRJ.marks.length; i < PRJ.markMeshes.length; i++) {
        if (PRJ.markMeshes[i].parent) scene.remove(PRJ.markMeshes[i]);
        if (PRJ.colMeshes[i] && PRJ.colMeshes[i].parent) scene.remove(PRJ.colMeshes[i]);
      }
      PRJ.colMat.opacity = 0.1 + 0.12 * Math.abs(Math.sin(total * 11));
      PRJ.markMat.opacity = 0.55 + 0.35 * Math.abs(Math.sin(total * 11));
    }
    function prjClear() {
      if (!PRJ) return;
      for (var i = PRJ.live.length - 1; i >= 0; i--) prjFree(PRJ.live[i], i);
      PRJ.rings.forEach(function (g) { scene.remove(g.m); if (g.wall) scene.remove(g.wall); g.mat.dispose(); }); PRJ.rings.length = 0;
      PRJ.marks.length = 0;
      (PRJ.markMeshes || []).forEach(function (m) { if (m.parent) scene.remove(m); });
      (PRJ.colMeshes || []).forEach(function (m) { if (m.parent) scene.remove(m); });
    }
    function prjKill() {
      if (!PRJ) return;
      prjClear();
      PRJ.scorch.forEach(function (s) { scene.remove(s.m); }); PRJ.scorch.length = 0;
      PRJ.pool.forEach(function (p) { if (p.g.parent) p.g.parent.remove(p.g); });
      (PRJ.markMeshes || []).forEach(function (m) { if (m.parent) scene.remove(m); });
      (PRJ.colMeshes || []).forEach(function (m) { if (m.parent) scene.remove(m); });
      ['paperGeo', 'strokeGeo', 'glowGeo', 'markGeo', 'colGeo', 'wallGeo', 'ringGeo', 'scorchGeo'].forEach(function (k) { if (PRJ[k]) PRJ[k].dispose(); });
      ['paperMat', 'strokeMat', 'glowMat', 'markMat', 'colMat', 'scorchMat'].forEach(function (k) { if (PRJ[k]) PRJ[k].dispose(); });
      if (PRJ.tex) PRJ.tex.dispose();
      PRJ = null;
    }
    /* ------------------------------------------------------------ spawning: the boss, its pen charge, its shield of covers */
    var COVERS = [
      { c: '#1d3f7a', t: '#8fc0ff', a: 'ANNALS OF', b: 'MINOR', d: 'REVISIONS' },
      { c: '#6b1430', t: '#ffb3c6', a: 'THE JOURNAL', b: 'OF DESK', d: 'REJECTION' },
      { c: '#134a35', t: '#9df0c6', a: 'PROCEEDINGS', b: 'OF THE OTHER', d: 'REVIEWER' }
    ];
    function coverTex(o) {
      var c = document.createElement('canvas'); c.width = 64; c.height = 80; var x = c.getContext('2d'), i;
      x.fillStyle = o.c; x.fillRect(0, 0, 64, 80);
      x.fillStyle = '#0a0a10'; x.fillRect(0, 0, 64, 4); x.fillRect(0, 76, 64, 4);
      x.fillStyle = o.t; x.font = '6px ' + FONT; x.textAlign = 'center';
      x.fillText(o.a, 32, 16); x.fillText(o.b, 32, 26); x.fillText(o.d, 32, 36);
      x.fillStyle = 'rgba(255,255,255,0.22)'; for (i = 0; i < 5; i++) x.fillRect(10, 46 + i * 5, 44 - i * 6, 2);
      x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2; x.strokeRect(1, 1, 62, 78);
      var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t;
    }
    function spawnBoss(hp) {
      boss = buildBoss(hp);
      boss.guard = 1;
      // the pen nib charges before every attack: the telegraph you can read from across the town
      boss.chargeGeo = new THREE.IcosahedronGeometry(0.55, 0);
      boss.chargeMat = new THREE.MeshBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      boss.charge = new THREE.Mesh(boss.chargeGeo, boss.chargeMat);
      boss.charge.position.set(0, 0, 1.85); boss.charge.scale.setScalar(0.001); boss.pen.add(boss.charge);
      // the editorial board: three journal covers orbiting the H-INDEX. The reason you cannot simply hold fire.
      boss.shield = new THREE.Group(); boss.shield.position.set(0, 1.62, 0.44); boss.rig.add(boss.shield);
      boss.covers = []; boss.coverGeo = new THREE.BoxGeometry(0.5, 0.62, 0.05);
      COVERS.forEach(function (o) {
        var mat = new THREE.MeshBasicMaterial({ map: coverTex(o), transparent: true, opacity: 1, fog: false, side: THREE.DoubleSide });
        var m = new THREE.Mesh(boss.coverGeo, mat); boss.shield.add(m); boss.covers.push(m);
      });
      boss.g.position.set(0, 0, 0);
      bossCol.x = 0; bossCol.z = 0;
      scene.add(boss.g);
      return boss;
    }
    function shieldStep(t) {
      var b = boss; if (!b || !b.covers) return;
      var g = b.guard === undefined ? 1 : b.guard, bl = b.blast || 0;
      b.shield.visible = g > 0.02 || bl > 0.02;
      for (var i = 0; i < b.covers.length; i++) {
        var a = t * 1.5 + i * 2.0944, r = lerp(1.35, 0.3, g) + bl * bl * 3.2, m = b.covers[i];
        m.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.85 + bl * 1.2, Math.sin(a * 1.7) * 0.1 + bl * 2.2);
        m.rotation.set(Math.sin(a * 0.9) * 0.3 + bl * 7, a * 0.7 + bl * 11, a * 0.4 + bl * 9);
        m.scale.setScalar(0.35 + 0.95 * g);
        m.material.opacity = Math.max(0, g * (1 - bl) + bl * 0.55 * (1 - bl));
      }
      b.haloMat.opacity = (1 - g) * (0.55 + 0.45 * Math.sin(t * 7));
    }

    /* ------------------------------------------------------------ the fight: a slow, telegraphed, three-phase editor
       Every attack spends at least 0.7 s winding up. The H-INDEX is only open from the end of that wind-up to part
       way through the recovery: hold the trigger down all fight and you will mostly be shooting journal covers. */
    var PH = [
      null,
      { idle: 2.00, wind: 0.95, rec: 1.50, open: 0.50, orbs: 4, orbSpd: 15.0, rain: 5, rings: 1, walk: 3.2, turn: 1.05, spread: 0.22, gap: 0.15 },
      { idle: 1.25, wind: 0.85, rec: 1.15, open: 0.60, orbs: 6, orbSpd: 16.5, rain: 7, rings: 2, walk: 3.8, turn: 1.35, spread: 0.26, gap: 0.13 },
      { idle: 1.00, wind: 0.75, rec: 0.90, open: 0.70, orbs: 8, orbSpd: 18.0, rain: 9, rings: 2, walk: 4.4, turn: 1.70, spread: 0.32, gap: 0.12 }
    ];
    var ATTACK_CAP = {
      volley: ['MAJOR REVISIONS', 'point by point, at speed'],
      stomp: ['DESK REJECT', 'jump it'],
      rain: ['REVIEWER COMMENTS', 'do not stand under them'],
      sweep: ['REVIEWER 2 SWEEPS THE FIELD', 'get out of the arc']
    };
    var BODY_LINES = ['NO EFFECT. AIM FOR THE H-INDEX.', 'TENURE ABSORBS IT. AIM FOR THE H-INDEX.', 'THE H-INDEX. NOTHING ELSE COUNTS.'];
    var BLOCK_LINES = ['THE BOARD BLOCKS IT. WAIT FOR THE OPENING.', 'GUARDED. SHOOT WHEN IT WINDS UP.'];
    function fightInit() {
      F = { mode: 'idle', t: 0, dur: 1.2, atk: 'volley', last: '', combo: null, phase: 1, step: 0, sched: [], falls: [],
            bodyHits: 0, taught: 0, blocked: 0, blockTaught: 0, ghost: 1, hitFlash: 0, guardStun: 0, taughtBfg: 0, windH: null,
            px: api.player.position.x, pz: api.player.position.z, pvx: 0, pvz: 0, ann: -9 };
      if (boss) boss.guard = 1;
    }
    function phaseFor(hp) { var k = hp / maxHp; return k <= 0.2 ? 3 : k <= 0.5 ? 2 : 1; }
    function bossSay(text) { guard(function () { api.notice({ title: 'THE EDITOR-IN-CHIEF', text: text, voice: DEEP }); }); }

    function trackPlayer(h) {
      var p = api.player.position, k = clamp(h * 5, 0, 1);
      if (h > 0.0005) { F.pvx += ((p.x - F.px) / h - F.pvx) * k; F.pvz += ((p.z - F.pz) / h - F.pvz) * k; }
      if (!isFinite(F.pvx) || Math.abs(F.pvx) > 14) F.pvx = 0;
      if (!isFinite(F.pvz) || Math.abs(F.pvz) > 14) F.pvz = 0;
      F.px = p.x; F.pz = p.z;
    }
    function aimAt(speed) {
      var p = api.player.position, d = Math.hypot(p.x - boss.x, p.z - boss.z), tt = clamp(d / speed, 0, 1.2) * 0.7;
      return V3.set(p.x + F.pvx * tt, p.y + 1.35, p.z + F.pvz * tt);
    }
    function penTip() { if (boss && boss.penTip) boss.penTip.getWorldPosition(V2); else V2.set(boss.x, 10, boss.z); return V2; }

    var COMBO = { volley: 'stomp', stomp: 'rain', rain: 'volley', sweep: 'stomp' };
    function startAttack(name) {
      var P = PH[F.phase];
      F.atk = name; F.last = name; F.mode = 'windup'; F.t = 0; F.dur = Math.max(0.7, P.wind); F.step = 0; F.sched.length = 0;
      F.combo = (F.phase >= 3 && Math.random() < 0.7) ? COMBO[name] : null;     // desperation: two patterns at once
      var cap = ATTACK_CAP[name], cap2 = F.combo && ATTACK_CAP[F.combo];
      if (cap) showCap(cap2 ? cap[0] + ' + ' + cap2[0] : cap[0], cap2 ? 'the editor has stopped being polite' : cap[1]);
      F.windH = SFX.charge(F.dur);
      if (name === 'volley') setPose('volleyUp', 4.5);
      else if (name === 'stomp') { setPose(Math.random() < 0.5 ? 'stompUp' : 'stompUpL', 4.0); addRing(boss.x, boss.z, 1.0, 5.6, 7.4, false, 0xff3344); }
      else if (name === 'rain') setPose('rainUp', 4.0);
      else setPose('sweepBack', 4.0);
      if (F.combo === 'stomp' && name !== 'stomp') addRing(boss.x, boss.z, 1.0, 5.6, 7.4, false, 0xff3344);   // the layered stomp gets its own tell
    }
    function schedFor(name, t0, out) {           // one pattern's shots, appended to `out`; returns when it ends
      var P = PH[F.phase], p = api.player.position, i, a, r;
      if (name === 'volley') {
        for (i = 0; i < P.orbs; i++) out.push({ t: t0 + i * (0.5 / P.orbs), k: 'orb', a: P.orbs < 2 ? 0 : (i / (P.orbs - 1) - 0.5) * 2 * P.spread });
        return t0 + 0.62;
      }
      if (name === 'stomp') {
        for (i = 0; i < P.rings; i++) out.push({ t: t0 + 0.08 + i * 0.6, k: 'ring' });
        return t0 + 0.85;
      }
      if (name === 'rain') {
        for (i = 0; i < P.rain; i++) {
          a = rand(0, 6.283); r = rand(0, 2.6 + i * 0.85);
          out.push({ t: t0 + i * P.gap, k: 'mark', x: clamp(p.x + Math.cos(a) * r + F.pvx * 0.3, -ARENA_R, ARENA_R), z: clamp(p.z + Math.sin(a) * r + F.pvz * 0.3, -ARENA_R, ARENA_R) });
        }
        return t0 + P.rain * P.gap + 0.12;
      }
      // the sweep: an arc of manuscripts thrown along the ring the player is standing on, so it arrives at chest
      // height there instead of sailing over his head. Step in or out of the ring and the whole arc misses.
      var base = Math.atan2(p.x - boss.x, p.z - boss.z), sd = Math.random() < 0.5 ? 1 : -1;
      var R = clamp(Math.hypot(p.x - boss.x, p.z - boss.z) + 0.5, 9, 40);
      for (i = 0; i < 13; i++) out.push({ t: t0 + i * 0.08, k: 'fan', a: base + sd * (-0.85 + i * (1.7 / 12)), R: R });
      return t0 + 1.15;
    }
    function fireAttack() {
      var name = F.atk;
      F.mode = 'fire'; F.t = 0; F.step = 0; F.sched.length = 0; F.windH = null;   // the wind-up ends by itself as the attack fires
      if (name === 'volley') setPose('volleyGo', 9);
      else if (name === 'stomp') setPose('stompDown', 14);
      else if (name === 'rain') setPose('rainUp', 5);
      else setPose('sweepGo', 7);
      F.dur = schedFor(name, 0, F.sched);
      if (F.combo) F.dur = Math.max(F.dur, schedFor(F.combo, 0.25, F.sched));
      F.sched.sort(function (a, b) { return a.t - b.t; });
    }
    function runSchedule() {
      var P = PH[F.phase], s, tip, tgt, ca, sa, dx, dz, pp, R, ty, fl, gx, gz;
      while (F.step < F.sched.length && F.sched[F.step].t <= F.t) {
        s = F.sched[F.step++];
        if (s.k === 'orb') {
          tip = penTip(); tgt = aimAt(P.orbSpd);
          ca = Math.cos(s.a); sa = Math.sin(s.a); dx = tgt.x - tip.x; dz = tgt.z - tip.z;
          shootOrb(tip.x, tip.y, tip.z, tip.x + dx * ca - dz * sa, tgt.y + rand(-0.3, 0.7), tip.z + dx * sa + dz * ca, P.orbSpd);
        } else if (s.k === 'fan') {
          tip = penTip(); pp = api.player.position;
          R = s.R || clamp(Math.hypot(pp.x - boss.x, pp.z - boss.z) + 0.5, 9, 40);
          ty = pp.y + 1.35;
          gx = boss.x + Math.sin(s.a) * R; gz = boss.z + Math.cos(s.a) * R;
          fl = Math.hypot(Math.hypot(gx - tip.x, gz - tip.z), tip.y - ty) / 14.5;   // from the PEN, not the boss's axis
          shootOrb(tip.x, tip.y, tip.z, gx, ty + 0.4 * fl * fl, gz, 14.5);          // lobbed: p.grav is 0.8
        } else if (s.k === 'ring') {
          api.shake(1.1, 0.45); SFX.ring();
          burst('dust', boss.x, 0.4, boss.z, 10, { spd: 16, up: 5, life: 1.2, s0: 0.6, s1: 2.6, drag: 1.6, jit: 2 });
          addRing(boss.x, boss.z, 2.2, 17.5, 34, true, 0xffb347);
        } else if (s.k === 'mark') {
          addMark(s.x, s.z, 0.85);
          F.falls.push({ t: total + 0.85, x: s.x, z: s.z });
          SFX.mark(s.x, s.z);
        }
      }
    }
    function runFalls() {
      for (var i = F.falls.length - 1; i >= 0; i--) {
        if (F.falls[i].t <= total) { dropStroke(F.falls[i].x, F.falls[i].z); SFX.whoosh(F.falls[i].x, F.falls[i].z); F.falls.splice(i, 1); }
      }
    }
    function chooseAttack() {
      var d = Math.hypot(api.player.position.x - boss.x, api.player.position.z - boss.z), bag;
      if (F.phase === 1) bag = d < 15 ? ['stomp', 'volley', 'rain', 'volley'] : ['volley', 'rain', 'volley', 'stomp'];
      else if (F.phase === 2) bag = d < 15 ? ['stomp', 'volley', 'sweep', 'rain', 'volley'] : ['volley', 'rain', 'sweep', 'volley', 'stomp'];
      else bag = ['volley', 'rain', 'sweep', 'stomp', 'volley', 'rain'];
      var i = Math.floor(Math.random() * bag.length) % bag.length, pick = bag[i];
      if (pick === F.last && Math.random() < 0.7) pick = bag[(i + 1) % bag.length];
      return pick;
    }
    function wantOpen() {
      if (F.mode === 'windup') return F.t > F.dur - 0.45;
      if (F.mode === 'fire') return true;
      if (F.mode === 'recover') return F.t < PH[F.phase].open;
      return false;
    }
    function fightStep(h, t) {
      var b = boss, P = PH[F.phase], p = api.player.position;
      trackPlayer(h);
      var ph = phaseFor(b.hp);
      if (ph > F.phase) {
        F.phase = ph; P = PH[ph];
        bossSay(ph === 2 ? '"I have consulted a further reviewer. They are enthusiastic."'
                         : '"You leave me no choice. I shall handle this personally."');
        if (F.windH) { F.windH.stop(0.08); F.windH = null; }   // the attack it was winding up is cancelled, so is its whine
        setPose('roar', 6); SFX.roar(); api.shake(ph === 2 ? 0.6 : 0.95, 0.8);
        F.mode = 'recover'; F.t = 0; F.dur = 1.3; F.step = F.sched.length;
      }
      // face the player; stride if the distance is wrong
      var dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz);
      b.yaw += clamp(angDiff(want, b.yaw), -P.turn * h, P.turn * h);
      var move = 0;
      if (F.mode === 'idle' || F.mode === 'recover') { if (d > 22) move = 1; else if (d < 13) move = -0.7; }
      if (move) {
        var sp = P.walk * move * h, nx = b.x + dx / d * sp, nz = b.z + dz / d * sp, rr = Math.hypot(nx, nz);
        if (rr > 27) { nx *= 27 / rr; nz *= 27 / rr; }
        var w0 = b.walkT; b.x = nx; b.z = nz; bossCol.x = nx; bossCol.z = nz;
        b.walkT += h * 3.4; b.walking = Math.min(1, b.walking + h * 4);
        if (Math.sin(b.walkT) * Math.sin(w0) < 0) {
          SFX.step();
          if (Math.random() < 0.6) burst('dust', b.x + rand(-2, 2), 0.2, b.z + rand(-2, 2), 2, { spd: 3, up: 2, life: 0.9, s0: 0.5, s1: 1.9, drag: 2 });
        }
      } else b.walking = Math.max(0, b.walking - h * 4);
      // the guard: shut while it waits, open while it swings — and blown wide open by a plasma ball
      if (F.guardStun > 0) F.guardStun -= h;
      if (b.blast > 0) b.blast = Math.max(0, b.blast - h * 1.5);
      b.guard += (((wantOpen() || F.guardStun > 0) ? 0 : 1) - b.guard) * (1 - Math.exp(-7 * h));
      shieldStep(t);
      // the charging nib
      var ch = F.mode === 'windup' ? smooth(F.t / Math.max(0.01, F.dur)) : F.mode === 'fire' ? Math.max(0, 1 - F.t * 3) : 0;
      b.charge.scale.setScalar(Math.max(0.001, ch * (1 + Math.sin(t * 22) * 0.12)));
      b.chargeMat.opacity = 0.85 * ch;
      b.nibMat.color.setRGB(1, 0.35 - ch * 0.3, 0.29 - ch * 0.25);
      // the state machine
      F.t += h;
      if (F.mode === 'fire') runSchedule();
      runFalls();
      if (F.t >= F.dur) {
        if (F.mode === 'idle') startAttack(chooseAttack());
        else if (F.mode === 'windup') fireAttack();
        else if (F.mode === 'fire') { F.mode = 'recover'; F.t = 0; F.dur = PH[F.phase].rec; setPose('open', 3.2); }
        else { F.mode = 'idle'; F.t = 0; F.dur = PH[F.phase].idle * rand(0.85, 1.15); setPose('guard', 3.0); }
      }
      // the arena: the editor has not released you
      var pr = Math.hypot(p.x, p.z);
      if (pr > ARENA_R) {
        var k2 = ARENA_R / pr; p.x *= k2; p.z *= k2;
        if (total - F.ann > 4) { F.ann = total; say('showToast', 'THE EDITOR HAS NOT RELEASED YOU'); }
      }
      // hp bar: the lagging yellow ghost
      F.ghost += (b.hp / maxHp - F.ghost) * (1 - Math.exp(-2.2 * h));
      if (F.ghost < b.hp / maxHp) F.ghost = b.hp / maxHp;
      setHpBar(b.hp, maxHp, F.ghost);
      if (F.hitFlash > 0) { F.hitFlash -= h; if (F.hitFlash <= 0 && dom.hp) dom.hp.classList.remove('is-hit'); }
      if (F.badgeFlash > 0) { F.badgeFlash -= h; if (F.badgeFlash <= 0) drawBadge(b, b.hp, false); }
      // the opening caption waits for the editor to stop talking, so the two beats do not stack up
      if (F.capMsg) {
        F.capWait -= h;
        if (F.capWait <= 0 || !dom.dlg || dom.dlg.hidden) { showCap(F.capMsg[0], F.capMsg[1]); F.capMsg = null; }
      }
    }
    /* ------------------------------------------------------------ taking fire: a swept test, then the consequences
       The host hands us prev -> pos for every live rebuttal every frame. At 70 u/s and a timescaled frame that
       segment can be metres long, so nothing here uses the end point alone. */
    function segSphere(ax, ay, az, bx, by, bz, cx, cy, cz, r) {
      var dx = bx - ax, dy = by - ay, dz = bz - az, fx = ax - cx, fy = ay - cy, fz = az - cz;
      var A = dx * dx + dy * dy + dz * dz, C = fx * fx + fy * fy + fz * fz - r * r;
      if (A < 1e-9) return C <= 0 ? 0 : -1;
      var B = 2 * (fx * dx + fy * dy + fz * dz), disc = B * B - 4 * A * C;
      if (disc < 0) return -1;
      disc = Math.sqrt(disc);
      var t1 = (-B - disc) / (2 * A), t2 = (-B + disc) / (2 * A);
      if (t1 >= 0 && t1 <= 1) return t1;
      if (t2 >= 0 && t2 <= 1) return t2;
      return (t1 < 0 && t2 > 1) ? 0 : -1;
    }
    function inBody(x, y, z) {
      var dx = x - boss.x, dz = z - boss.z, d2 = dx * dx + dz * dz;
      if (y > 0.25 && y < BODY_TOP && d2 < BODY_R * BODY_R) return true;
      var hy = y - HEAD_Y;
      return d2 + hy * hy < HEAD_R * HEAD_R;
    }
    function weakHit(x, y, z, big) {
      var b = boss;
      b.hp = Math.max(0, b.hp - (big ? BFG.dmg : 1)); b.flinch = 1;
      drawBadge(b, b.hp, true); F.badgeFlash = big ? 0.2 : 0.08;
      if (big) {
        // five off the h-index, the board scattered, and a hole in the middle of the fight
        SFX.plasma(1 - b.hp / maxHp, x, y, z);
        burst('plasma', x, y, z, 16, { spd: 15, up: 11, life: 0.85, s0: 0.5, s1: 0.06, grav: 14, jit: 0.4 });
        burst('plasmaDim', x, y, z, 8, { spd: 9, up: 7, life: 1.2, s0: 0.7, s1: 2.4, drag: 1.5, jit: 0.5 });
        burst('gold', x, y, z, 8, { spd: 11, up: 8, life: 0.6, s0: 0.35, s1: 0.05, grav: 16 });
        fxSpawn('white', x, y, z, 0, 0, 0, { life: 0.26, s0: 1.4, s1: 7.5 });
        addRing(b.x, b.z, 1.2, 30, 18, false, 0x5cff8a);
        b.blast = 1; F.guardStun = Math.max(F.guardStun, 1.2);
        if (b.covers) b.covers.forEach(function (m) { m.getWorldPosition(V2); burst('white', V2.x, V2.y, V2.z, 2, { spd: 7, up: 5, life: 0.4, s0: 0.25, s1: 0.03, grav: 12 }); });
        guard(function () { api.shake(0.75, 0.4); });
        if (dom.hp) { dom.hp.classList.add('is-hit'); F.hitFlash = 0.2; }
      } else {
        SFX.ping(1 - b.hp / maxHp, x, y, z);
        burst('gold', x, y, z, 5, { spd: 7, up: 5, life: 0.45, s0: 0.28, s1: 0.04, grav: 16 });
        fxSpawn('white', x, y, z, 0, 0, 0, { life: 0.12, s0: 0.5, s1: 2.2 });
        if (dom.hp) { dom.hp.classList.add('is-hit'); F.hitFlash = 0.07; }
      }
      setHpBar(b.hp, maxHp, F.ghost);
      if (b.hp <= 0) setPhase('death');
    }
    function blockHit(x, y, z) {
      SFX.block(x, y, z);
      burst('white', x, y, z, 3, { spd: 6, up: 4, life: 0.3, s0: 0.22, s1: 0.03, grav: 14 });
      F.blocked++;
      if (F.blockTaught < BLOCK_LINES.length && (F.blocked === 6 || F.blocked === 40)) say('showToast', BLOCK_LINES[F.blockTaught++]);
    }
    function bodyHit(x, y, z, big) {
      if (big) {
        // tenure absorbs paper. It does not entirely absorb this.
        var b = boss;
        b.hp = Math.max(0, b.hp - BFG.bodyDmg); b.flinch = 0.7;
        drawBadge(b, b.hp, false); setHpBar(b.hp, maxHp, F.ghost);
        SFX.blast(x, y, z);
        burst('plasma', x, y, z, 12, { spd: 13, up: 9, life: 0.7, s0: 0.45, s1: 0.05, grav: 16 });
        burst('soot', x, y, z, 8, { spd: 9, up: 8, life: 1.3, s0: 0.5, s1: 2.2, drag: 1.4 });
        burst('flame', x, y, z, 5, { spd: 10, up: 10, life: 0.5, s0: 0.5, s1: 0.06, grav: 18 });
        fxSpawn('white', x, y, z, 0, 0, 0, { life: 0.18, s0: 1.0, s1: 5.0 });
        guard(function () { api.shake(0.45, 0.28); });
        F.bodyHits++;
        if (!F.taughtBfg) { F.taughtBfg = 1; say('showToast', 'BODY SHOT. THE H-INDEX IS WORTH FIVE OF THOSE.'); }
        if (b.hp <= 0) setPhase('death');
        return;
      }
      SFX.clank(x, y, z);
      burst('spark', x, y, z, 3, { spd: 8, up: 5, life: 0.3, s0: 0.2, s1: 0.03, grav: 20 });
      F.bodyHits++;
      if (F.taught < BODY_LINES.length && (F.bodyHits === 2 || F.bodyHits === 9 || F.bodyHits === 26)) say('showToast', BODY_LINES[F.taught++]);
    }
    /* The Warthog's chain gun ({kind:'chain'}): one off the H-INDEX for every round that lands anywhere on him, with a
       spark and a tick where it struck and none of the weak hit's ceremony - at twelve rounds a second the stinger
       would never stop. The covers still stop a round when they are physically over the badge (the same threshold as
       a paper ball), and nowhere else is there a closed state to honour. The hundredth round kills him as the
       hundredth ball would. */
    function chainHit(x, y, z, weak) {
      var b = boss;
      b.hp = Math.max(0, b.hp - 1); b.flinch = Math.max(b.flinch, 0.3);
      if (weak) { drawBadge(b, b.hp, true); F.badgeFlash = Math.max(F.badgeFlash || 0, 0.05); } else drawBadge(b, b.hp, (F.badgeFlash || 0) > 0);
      SFX.tick(x, y, z);
      burst(weak ? 'gold' : 'spark', x, y, z, 2, { spd: 7, up: 5, life: 0.3, s0: 0.2, s1: 0.03, grav: 18 });
      fxSpawn('white', x, y, z, 0, 0, 0, { life: 0.07, s0: 0.3, s1: 1.1 });
      if (dom.hp) { dom.hp.classList.add('is-hit'); F.hitFlash = Math.max(F.hitFlash, 0.05); }
      setHpBar(b.hp, maxHp, F.ghost);
      if (b.hp <= 0) setPhase('death');
    }
    function chainBlock(x, y, z) {
      SFX.block(x, y, z);
      burst('white', x, y, z, 2, { spd: 6, up: 4, life: 0.25, s0: 0.18, s1: 0.03, grav: 14 });
    }
    function hitTest(pos, prev, kind) {
      if (!self.active || phase !== 'fight' || !boss || boss.hp <= 0 || !pos) return null;
      // `kind` comes from the host for every shot. No fallback: an omitted kind is a paper ball, never ten
      // times the damage on the strength of a flag that only says the gun exists somewhere in the level.
      // An options object ({kind:'chain'}) is the Warthog's chain gun; anything else that is not 'bfg' is paper.
      var chain = !!(kind && typeof kind === 'object' && kind.kind === 'chain');
      var big = kind === 'bfg';
      var ax = prev ? prev.x : pos.x, ay = prev ? prev.y : pos.y, az = prev ? prev.z : pos.z;
      var bx = pos.x, by = pos.y, bz = pos.z, t, hx, hy, hz;
      // the H-INDEX first: its sphere sits inside the body, so the body must never shadow it
      boss.badge.getWorldPosition(V1);
      boss.badge.getWorldQuaternion(Q1);
      V4.set(0, 0, 1).applyQuaternion(Q1);                     // the badge's own forward normal, leans and all
      if (big) {
        // a blast radius, not a pinhole: pass anywhere near the badge and it still counts, guard or no guard
        t = segSphere(ax, ay, az, bx, by, bz, V1.x, V1.y, V1.z, BFG.R);
        if (t >= 0) { weakHit(lerp(ax, bx, t), lerp(ay, by, t), lerp(az, bz, t), true); return 'weak'; }
      }
      t = segSphere(ax, ay, az, bx, by, bz, V1.x, V1.y, V1.z, WEAK_R);
      if (t >= 0) {
        hx = lerp(ax, bx, t); hy = lerp(ay, by, t); hz = lerp(az, bz, t);
        // ... and only from the front: you cannot shoot a man's h-index through his back. Measured against the
        // badge itself, never a fixed offset from the boss's axis - the rig rocks back when it roars and when it
        // flinches, which used to swing the badge behind such a line and bounce perfectly aimed shots.
        if ((hx - V1.x) * V4.x + (hy - V1.y) * V4.y + (hz - V1.z) * V4.z > -0.55) {
          if (chain) { if (boss.guard < 0.45) chainHit(hx, hy, hz, true); else chainBlock(hx, hy, hz); return 'chain'; }
          if (boss.guard < 0.45) weakHit(hx, hy, hz); else blockHit(hx, hy, hz);
          return boss.guard < 0.45 ? 'weak' : 'body';
        }
      }
      // body and head: sampled along the sweep, fine enough that a 70 u/s shot cannot step over a 3-unit cylinder
      var dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var n = clamp(Math.ceil(len / 0.45), 1, 90), i, k;
      for (i = 0; i <= n; i++) {
        k = i / n; hx = ax + dx * k; hy = ay + dy * k; hz = az + dz * k;
        if (inBody(hx, hy, hz)) { if (chain) { chainHit(hx, hy, hz, false); return 'chain'; } bodyHit(hx, hy, hz, big); return 'body'; }
      }
      return null;
    }

    /* ------------------------------------------------------------ death: the badge goes, then the man */
    function explodeBoss() {
      var b = boss; if (!b || b.exploded) return;
      b.exploded = true;
      b.g.updateMatrixWorld(true);
      var list = [];
      b.rig.traverse(function (o) { if (o.isMesh) list.push(o); });
      b.parts = [];
      list.forEach(function (m) {
        b.rig.attach(m);
        var lx = m.position.x, ly = m.position.y, lz = m.position.z, L = Math.hypot(lx, ly - 1.5, lz) || 1;
        b.parts.push({ o: m, rest: -1,
          vx: lx / L * rand(1.4, 3.6) + rand(-0.6, 0.6), vy: rand(2.0, 4.6) + Math.max(0, 2.6 - ly) * 0.4, vz: lz / L * rand(1.4, 3.6) + rand(-0.6, 0.6),
          sx: rand(-6, 6), sy: rand(-6, 6), sz: rand(-6, 6) });
      });
      b.rig.rotation.set(0, 0, 0); b.rig.position.y = 0;
      burst('soot', b.x, 8, b.z, 26, { spd: 16, up: 13, life: 2.4, s0: 1.0, s1: 3.6, drag: 1.1, jit: 3 });
      burst('flame', b.x, 7, b.z, 14, { spd: 13, up: 18, life: 0.9, s0: 0.8, s1: 0.1, grav: 16, jit: 2 });
    }
    function partsStep(h) {
      var b = boss; if (!b || !b.parts) return;
      for (var i = 0; i < b.parts.length; i++) {
        var p = b.parts[i], o = p.o;
        if (p.rest >= 0) continue;
        p.vy -= 5.6 * h;
        o.position.x += p.vx * h; o.position.y += p.vy * h; o.position.z += p.vz * h;
        o.rotation.x += p.sx * h; o.rotation.y += p.sy * h; o.rotation.z += p.sz * h;
        if (o.position.y < 0.09 && p.vy < 0) {
          if (!p.landed) { p.landed = true; SFX.debris(); }           // the pieces coming down, a few at a time
          o.position.y = 0.09; p.vy = -p.vy * 0.24; p.vx *= 0.6; p.vz *= 0.6; p.sx *= 0.4; p.sy *= 0.4; p.sz *= 0.4;
          if (Math.abs(p.vy) < 0.7) { p.rest = 0; p.vy = 0; }
        }
      }
    }
    var DEATH_LEN = 5.0, BLOW_T = 1.2;       // he comes apart 1.2 s in; the death swell is baked to peak on that instant
    function deathStep(h, T) {
      var b = boss; if (!b) return;
      b.guard = 0; if (b.shield) b.shield.visible = false;
      if (!b.exploded) {
        // the H-INDEX cracks open and pours light for a beat before the man comes apart
        b.rig.rotation.z = Math.sin(T * 9) * 0.05 * (1 - T / 1.2);
        b.rig.position.y = -T * 0.3 * S;
        b.haloMat.opacity = 1;
        b.halo.scale.setScalar(1 + Math.min(T, 1.2) * 2.2);
        if (Math.random() < h * 26) burst('gold', b.x + rand(-1, 1), 9 + rand(-1, 1), b.z + 1.6, 2, { spd: 6, up: 9, life: 0.7, s0: 0.3, s1: 0.05, grav: 10 });
        if (T >= BLOW_T) {
          explodeBoss(); SFX.boom(); api.shake(2.0, 1.3); setFlash(0.55);
          if (deathCry) { deathCry.fade(0, 0.35); deathCry = null; }   // the explosion swallows the scream
        }
      } else {
        partsStep(h);
        if (T < 1.55) setFlash(0.55 * (1 - (T - 1.2) / 0.35)); else setFlash(0);
      }
      if (T >= 1.85 && !F.banner) {
        F.banner = true;
        hideHpBar(); rm('cap');
        showBanner('MANUSCRIPT ACCEPTED', 'THE EDITOR-IN-CHIEF HAS NO FURTHER COMMENTS');
        say('stinger', 'victory');
      }
      if (F.banner) setBanner(clamp((T - 1.85) / 0.7, 0, 1));
      if (T >= DEATH_LEN) setPhase('outro');
    }
    /* ------------------------------------------------------------ the arrival: omen, drop, landing */
    var OMEN_LEN = 2.4, DROP_LEN = 1.05, LAND_LEN = 2.0;
    var WHISTLE_LEN = 1.0;                   // the whistle is gone ~20 ms before he lands (1.0 s + its 0.03 s fade, of 1.05): the quake comes out of silence
    function omenInit() {
      var m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: 0x050308, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(0, 0.075, 0); scene.add(m);
      omen = { m: m };
    }
    function omenKill() {
      if (!omen) return;
      scene.remove(omen.m); omen.m.geometry.dispose(); omen.m.material.dispose(); omen = null;
    }
    function omenStep(h, T) {
      var k = clamp(T / OMEN_LEN, 0, 1);
      if (omen) { omen.m.scale.setScalar(lerp(1.5, 10.5, k * k)); omen.m.material.opacity = 0.7 * k; }
      guard(function () { api.lookAt(0, lerp(16, 80, k), 0); });
      if (Math.random() < h * 8) burst('dust', rand(-14, 14), 0.2, rand(-14, 14), 1, { spd: 1.5, up: 3.5, life: 1.1, s0: 0.3, s1: 1.1, drag: 1.5 });
    }
    function dropStep(h, T) {
      var k = clamp(T / DROP_LEN, 0, 1), y = 132 * (1 - k * k);
      if (boss) boss.g.position.y = y;
      if (omen) { omen.m.scale.setScalar(lerp(10.5, 13, k)); omen.m.material.opacity = 0.7 + 0.2 * k; }
      guard(function () { api.lookAt(0, clamp(y + 6, 6, 90), 0); });
    }
    function landStep(h, T) {
      var b = boss; if (!b) return;
      if (T >= 0.5 && !b.roared) { b.roared = true; setPose('roar', 4.5); SFX.roar(); }
      if (T >= 1.2 && !b.announced) {
        b.announced = true;
        music('boss'); showHpBar(maxHp, maxHp);
        bossSay('"Thank you for your submission. I have read it myself. Unfortunately."');
      }
      if (T >= LAND_LEN) { setPose('guard', 3); setBossCollider(true); setPhase('fight'); }
    }

    /* ------------------------------------------------------------ blast-off: the manuscript becomes the rocket */
    var OUT_FLASH = 8.3, OUT_END = 9.0, ROCKET_LEN = 5.4, rocket = null, stars = null, BLACK = new THREE.Color(0x000000);
    function buildRocket(x, z) {
      var g = new THREE.Group(); g.position.set(x, 0, z);
      var paper = new THREE.MeshLambertMaterial({ color: 0xf4f0e2, emissive: 0xb0aa98 });
      var red = new THREE.MeshLambertMaterial({ color: 0xd0222f, emissive: 0x8e1420 });
      var dark = new THREE.MeshLambertMaterial({ color: 0x2b303c, emissive: 0x20242e });
      function add(geo, mat, y, rx) { var m = new THREE.Mesh(geo, mat); m.position.y = y; if (rx) m.rotation.x = rx; m.castShadow = true; g.add(m); return m; }
      var geos = [];
      function G(x2) { geos.push(x2); return x2; }
      add(G(new THREE.CylinderGeometry(0.55, 0.55, 3.4, 12)), paper, 2.0);
      add(G(new THREE.ConeGeometry(0.56, 1.2, 12)), paper, 4.3);
      [1.1, 2.1, 3.1].forEach(function (y) { add(G(new THREE.CylinderGeometry(0.575, 0.575, 0.13, 12)), red, y); });
      var finGeo = G(new THREE.BoxGeometry(0.1, 1.15, 0.95));
      for (var i = 0; i < 3; i++) {
        var f = new THREE.Mesh(finGeo, red); f.position.set(Math.sin(i * 2.094) * 0.5, 0.75, Math.cos(i * 2.094) * 0.5);
        f.rotation.y = i * 2.094 + Math.PI / 2; f.castShadow = true; g.add(f);
      }
      add(G(new THREE.CylinderGeometry(0.42, 0.56, 0.4, 12)), dark, 0.2);
      var flameMat = new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.95, fog: false });
      var flame = new THREE.Mesh(G(new THREE.ConeGeometry(0.5, 2.6, 10)), flameMat);
      flame.position.y = -1.3; flame.rotation.x = Math.PI; flame.visible = false; g.add(flame);
      var lamp = new THREE.PointLight(0xffb867, 2.4, 30, 1.6); lamp.position.y = -0.6; g.add(lamp);
      var rider = null;
      guard(function () {
        rider = api.boxMan({});
        rider.traverse(function (m) { if (m.material && m.material.emissive) m.material.emissive.copy(m.material.color).multiplyScalar(0.45); });
        rider.scale.setScalar(0.78); rider.position.set(0, 2.55, 0); rider.rotation.y = Math.PI;
        rider.userData.la.rotation.x = -2.5; rider.userData.ra.rotation.x = -2.5;
        rider.userData.ll.rotation.x = 0.9; rider.userData.rl.rotation.x = 0.9;
        rider.userData.ll.rotation.z = 0.5; rider.userData.rl.rotation.z = -0.5;
        g.add(rider);
      });
      scene.add(g);
      rocket = { g: g, flame: flame, flameMat: flameMat, rider: rider, lamp: lamp, mats: [paper, red, dark, flameMat], geos: geos, y: 0, puff: 0 };
      return rocket;
    }
    function rocketKill() {
      if (!rocket) return;
      if (rocket.lamp) { rocket.lamp.parent && rocket.lamp.parent.remove(rocket.lamp); if (rocket.lamp.dispose) rocket.lamp.dispose(); }
      if (rocket.rider) disposeTree(rocket.rider);
      scene.remove(rocket.g);
      rocket.geos.forEach(function (g) { g.dispose(); });
      rocket.mats.forEach(function (m) { m.dispose(); });
      rocket = null;
    }
    function starsInit() {
      if (stars) return;
      var geo = new THREE.BoxGeometry(0.16, 1, 0.16), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      var g = new THREE.Group(); scene.add(g);
      var list = [];
      for (var i = 0; i < 110; i++) {
        var m = new THREE.Mesh(geo, mat), a = rand(0, 6.283), r = 5 + rand(0, 42);
        m.position.set(Math.cos(a) * r, rand(-80, 80), Math.sin(a) * r);
        g.add(m); list.push(m);
      }
      stars = { g: g, geo: geo, mat: mat, list: list };
    }
    function starsKill() {
      if (!stars) return;
      scene.remove(stars.g); stars.geo.dispose(); stars.mat.dispose(); stars = null;
    }
    function starsStep(h, speed, stretch) {
      if (!stars) return;
      for (var i = 0; i < stars.list.length; i++) {
        var m = stars.list[i];
        m.position.y -= speed * h;
        if (m.position.y < -80) m.position.y += 160;
        m.scale.y = stretch;
      }
    }
    function outroInit() {
      self.cinematic = true;
      env = null; saveEnv();                       // fade out of the sky as it stands now, not as it was at start()
      say('setHud', false); say('lockEnvironment', true);
      rootClass('qb-cine', true);                  // setHud() leaves the touch pad alone; the launch needs the screen
      prjClear(); if (F) F.falls.length = 0;
      var p = api.player.position;
      buildRocket(p.x, p.z);
      showCap('CLEARED FOR PUBLICATION', 'F / SPACE / TAP: SKIP');
      out = { c: 0, count: -1, lit: false, skipped: false, puff: 0 };
    }
    function skipOutro() {
      if (!out || out.skipped) return;
      if (!out.lit) SFX.rocket(ROCKET_LEN);        // skipped before ignition: it is lit now, so it roars (stop() cuts it at the white-out)
      out.skipped = true; out.lit = true; out.count = 4; out.c = OUT_FLASH - 0.15;
      hideCount(); rm('cap'); rm('banner');
      if (rocket) rocket.flame.visible = true;
    }
    function outroStep(h) {
      if (!out) { outroInit(); if (!out) return; }
      out.c += h;
      var c = out.c, tau = Math.max(0, c - 3.2);
      // banner fades out as the rocket is built
      if (dom.banner) { var ba = clamp(1 - (c - 0.2) / 0.8, 0, 1); setBanner(ba); if (ba <= 0) rm('banner'); }
      // 3 - 2 - 1 - GO
      var want = c < 0.8 ? -1 : c < 1.6 ? 0 : c < 2.4 ? 1 : c < 3.2 ? 2 : c < 4.0 ? 3 : 4;
      if (want !== out.count) {
        out.count = want;
        if (want >= 0 && want <= 2) { showCount(String(3 - want)); SFX.count(false); }
        else if (want === 3) { showCount('GO'); SFX.count(true); }
        else if (want === 4) hideCount();
      }
      if (!out.lit && c >= 3.2) {
        out.lit = true; rm('cap');
        say('stinger', 'launch'); SFX.rocket(ROCKET_LEN);
        if (rocket) rocket.flame.visible = true;
      }
      // the ascent
      var ry = out.lit ? 2.4 * tau * tau + 0.62 * tau * tau * tau : 0;
      if (rocket) {
        rocket.g.position.y = ry;
        rocket.g.rotation.y += h * (0.6 + tau * 0.35);
        if (rocket.lamp) rocket.lamp.intensity = out.lit ? 3.4 + Math.sin(c * 40) * 0.8 : 1.2;
        if (out.lit) {
          rocket.flame.scale.set(1 + Math.sin(c * 40) * 0.12, 1.1 + Math.min(2.2, tau * 0.5) + Math.sin(c * 33) * 0.2, 1 + Math.cos(c * 37) * 0.12);
          rocket.flameMat.color.setRGB(1, 0.55 + Math.sin(c * 51) * 0.15, 0.2);
          out.puff += h;
          while (out.puff > 0.045) {
            out.puff -= 0.045;
            var px = rocket.g.position.x, pz = rocket.g.position.z;
            fxSpawn(Math.random() < 0.45 ? 'flame' : 'smoke', px + rand(-0.6, 0.6), ry - 1.4, pz + rand(-0.6, 0.6),
              rand(-4, 4), -rand(2, 9) - tau * 2, rand(-4, 4), { life: rand(0.8, 1.8), s0: 0.7, s1: 4.2, drag: 1.2 });
          }
        }
      }
      // the camera: trailing, shaking, watching the town shrink
      var a = 0.7 + c * 0.26, dist = lerp(11, 32, clamp(tau / 5, 0, 1));
      var cx = (rocket ? rocket.g.position.x : 0) + Math.sin(a) * dist, cz = (rocket ? rocket.g.position.z : 0) + Math.cos(a) * dist;
      var cy = ry * 0.86 + lerp(4.4, 9, clamp(tau / 5, 0, 1));
      camera.position.set(cx, cy, cz);
      camera.up.set(0, 1, 0);
      camera.lookAt(rocket ? rocket.g.position.x : 0, ry + lerp(3.4, 1.6, clamp(tau / 1.5, 0, 1)), rocket ? rocket.g.position.z : 0);
      var amp = out.lit ? clamp(1.0 - tau * 0.09, 0.18, 1.0) : 0;
      if (amp) {
        camera.position.x += (Math.random() - 0.5) * amp; camera.position.y += (Math.random() - 0.5) * amp; camera.position.z += (Math.random() - 0.5) * amp;
        camera.rotation.z += (Math.random() - 0.5) * amp * 0.02;
      }
      // sky to black, fog pushed back, lights down
      var k = clamp((c - 4.2) / 3.6, 0, 1);
      if (env) {
        if (scene.background && scene.background.copy) scene.background.copy(env.bg).lerp(BLACK, k);
        if (scene.fog) { scene.fog.color.copy(env.fogC).lerp(BLACK, k); scene.fog.near = lerp(env.near, 900, k); scene.fog.far = lerp(env.far, 2600, k); }
        if (scene.fog) scene.fog.far = Math.max(scene.fog.near + 10, scene.fog.far);
        if (env.hemi) env.hemi.intensity = env.hemiI * (1 - 0.8 * k);
        if (env.sun) env.sun.intensity = env.sunI * (1 - 0.55 * k);
      }
      if (k > 0.22) { starsInit(); if (stars) stars.g.position.set(rocket ? rocket.g.position.x : 0, ry, rocket ? rocket.g.position.z : 0); starsStep(h, 40 + tau * 34, lerp(1, 9, clamp((k - 0.22) / 0.6, 0, 1))); }
      // the white-out, then the hand-over. Exactly once.
      if (c >= OUT_FLASH) setFlash((c - OUT_FLASH) / (OUT_END - OUT_FLASH));
      if (c >= OUT_END && !fired) {
        fired = true; setFlash(1);
        self.cinematic = false;
        guard(function () { api.onBossDefeated(); });
        if (self.active) guard(stop);
      }
    }

    /* ------------------------------------------------------------ phases */
    function enterPhase(name) {
      if (name === 'card') { self.cinematic = true; openCard(); return; }   // the host freezes him behind the dossier
      if (name === 'omen') {
        self.cinematic = false;                    // the card had the player frozen; he gets his legs back for the drop
        if (dom.card) killCard();                  // a card that closed itself is left to finish its 0.26 s CRT collapse
        music('silence'); SFX.omen(OMEN_LEN); omenInit();
        var p = api.player.position;
        if (Math.hypot(p.x, p.z) < 13) guard(function () { api.teleport(VANTAGE.x, VANTAGE.z); });
        showCap('THE EDITOR IS HANDLING THIS PERSONALLY', 'look up');
        return;
      }
      if (name === 'drop') {
        spawnBoss(maxHp); setBossCollider(false);
        boss.g.position.y = 132; setPose('crouch', 9);
        for (var k in boss.cur) boss.cur[k] = boss.tgt[k];
        boss.yaw = Math.atan2(api.player.position.x, api.player.position.z);
        SFX.whistle(WHISTLE_LEN);
        return;
      }
      if (name === 'land') {
        var pp = api.player.position, d = Math.hypot(pp.x, pp.z);
        if (boss) boss.g.position.y = 0;
        if (d < 9) { var ux = d > 0.01 ? pp.x / d : 0.7, uz = d > 0.01 ? pp.z / d : 0.7; guard(function () { api.teleport(ux * 16, uz * 16); }); }
        omenKill();
        guard(function () { api.shake(2.5, 1.6); }); say('stinger', 'impact'); SFX.impact();
        destroyTown(false);
        addRing(0, 0, 2, 58, 95, false, 0xfff0c0);
        burst('dust', 0, 1.5, 0, 26, { spd: 26, up: 10, life: 2.6, s0: 1.4, s1: 6.5, drag: 1.3, jit: 4 });
        burst('soot', 0, 3, 0, 14, { spd: 14, up: 20, life: 2.2, s0: 1.0, s1: 5.0, drag: 1.1, jit: 3 });
        setPose('crouch', 14);
        fightInit();
        guard(function () { api.lookAt(0, 9, 0); });
        return;
      }
      if (name === 'fight') {
        if (!F) fightInit();
        if (boss) setBossCollider(true);
        F.capMsg = ['SHOOT THE H-INDEX', 'nothing else counts']; F.capWait = 9.0;
        // the dust settles and there is somebody still standing in it, holding something
        if (!gaveGun) guard(spawnSage);
        return;
      }
      if (name === 'death') {
        self.ended = true;
        setBossCollider(false); prjClear();
        music('silence');                          // the score drops out; the victory stinger lands on nothing
        rootClass('qb-cine', true);                // and the touch pad gets off the banner and the blast-off
        if (F) { F.falls.length = 0; F.banner = false; if (F.windH) { F.windH.stop(0.08); F.windH = null; } }   // no attack follows this wind-up
        if (boss) { boss.guard = 0; setPose('dying', 2.2); boss.walking = 0; boss.hp = 0; }
        rm('cap');
        SFX.shatter(); deathCry = SFX.cry(); SFX.swell(BLOW_T); guard(function () { api.shake(1.2, 1.2); });
        if (boss) burst('gold', boss.x, 9, boss.z + 1.6, 18, { spd: 11, up: 12, life: 1.2, s0: 0.35, s1: 0.06, grav: 9, jit: 0.8 });
        return;
      }
      if (name === 'outro') { outroInit(); return; }
    }

    /* ------------------------------------------------------------ environment book-keeping */
    function saveEnv() {
      if (env) return;
      var hemi = null, sun = null;
      scene.children.forEach(function (o) { if (o.isHemisphereLight && !hemi) hemi = o; if (o.isDirectionalLight && !sun) sun = o; });
      env = {
        bg: scene.background && scene.background.clone ? scene.background.clone() : new THREE.Color(0x000000),
        fogC: scene.fog ? scene.fog.color.clone() : new THREE.Color(0x000000),
        near: scene.fog ? scene.fog.near : 1, far: scene.fog ? scene.fog.far : 200,
        hemi: hemi, hemiI: hemi ? hemi.intensity : 0, sun: sun, sunI: sun ? sun.intensity : 0
      };
    }
    function restoreEnv() {
      if (!env) return;
      if (scene.background && scene.background.copy) scene.background.copy(env.bg);
      if (scene.fog) { scene.fog.color.copy(env.fogC); scene.fog.near = env.near; scene.fog.far = env.far; }
      if (env.hemi) env.hemi.intensity = env.hemiI;
      if (env.sun) env.sun.intensity = env.sunI;
      env = null;
    }

    /* ------------------------------------------------------------ lifecycle */
    function start(opts) {
      opts = opts || {};
      if (self.active) guard(stop);
      guard(function () {
        ensureStyle(); fxInit(); prjInit(); saveEnv(); warmSfx();
        maxHp = Math.max(1, Math.min(9999, parseInt(opts.hp, 10) || 100));
        total = 0; pT = 0; fired = false; out = null; boss = null; F = null; phase = '';
        self.active = true; self.cinematic = false; self.ended = false; musicOn = false;
        dom.dlg = api.root.querySelector('.q-dialog');
        rootClass('qb-on', true); rootClass('qb-cine', false);
        window.addEventListener('keydown', onSkipKey, true);
        api.view.addEventListener('pointerdown', onSkip);
        if (api.root && api.root.addEventListener) api.root.addEventListener('pointerdown', onSagePad, true);
        // a restarted fight does not confiscate the gun: losing it to a rejection would be cruel
        if (gaveGun) api.setWeapon({ kind: 'bfg', rate: BFG.rate, speed: BFG.speed, gravity: 0 });
        if (opts.retry) {
          destroyTown(true); finishDestruction();
          spawnBoss(maxHp); setBossCollider(true);
          setPose('guard', 9); for (var k in boss.cur) boss.cur[k] = boss.tgt[k];
          boss.yaw = Math.atan2(api.player.position.x, api.player.position.z);
          fightInit();
          music('boss'); showHpBar(maxHp, maxHp);
          bossSay('"We received your revised manuscript. Our concerns remain."');
          setPhase('fight');
          guard(function () { api.lookAt(boss.x, 9, boss.z); });   // the REJECTED! tilt left the camera in the rubble
        } else if (opts.skipIntro) setPhase('omen');
        else setPhase('card');
      });
    }
    function stop() {
      guard(function () {
        window.removeEventListener('keydown', onSkipKey, true); api.view.removeEventListener('pointerdown', onSkip);
        if (api.root && api.root.removeEventListener) api.root.removeEventListener('pointerdown', onSagePad, true);
      });
      guard(killSage);
      guard(function () { api.setWeapon({ kind: 'paper' }); });   // nobody carries a BFG round the ordinary town
      guard(killCard); guard(hideHpBar);
      guard(function () { rm('banner'); rm('count'); rm('cap'); rm('flash'); rm('ind'); dom.capT = 0; });
      guard(function () { if (dom.style && dom.style.parentNode) dom.style.parentNode.removeChild(dom.style); dom.style = null; });
      guard(omenKill); guard(rocketKill); guard(starsKill);
      guard(prjKill);
      guard(finishDestruction);
      guard(function () { setBossCollider(false); removeBoss(); });
      guard(fxKill);
      guard(function () { deathCry = null; jingleStop(0.1); if (K) K.stopAll(0.1, SFX_GROUP); });   // ours only: the kit is shared with quest.js
      guard(restoreEnv);
      guard(function () { camera.rotation.z = 0; camera.up.set(0, 1, 0); });
      rootClass('qb-on', false); rootClass('qb-cine', false);
      if (musicOn) music('silence');               // never leave the boss layer grinding after we are gone
      say('setHud', true); say('lockEnvironment', false);
      self.active = false; self.cinematic = false; self.ended = false;
      phase = ''; pT = 0; out = null; F = null; fired = false;
    }
    function update(dt, t) {
      if (!self.active) return;
      var h = dt > 0.5 ? 0.5 : dt < 0 ? 0 : dt;
      total += h; pT += h;
      guard(function () {
        fxStep(h); townStep(h); capStep(h); pushPlayerOut(); sageStep(h, total);
        if (dom.hp && dom.dlg) dom.hp.classList.toggle('is-up', !dom.dlg.hidden);   // every phase, not just the fight
        if (boss) { if (!boss.exploded) applyPose(h, total); boss.g.updateMatrixWorld(true); }
        if (phase === 'card') { drawCard(pT); if (pT >= CARD_LEN) { closeCard(); setPhase('omen'); } return; }
        if (phase === 'omen') { omenStep(h, pT); if (pT >= OMEN_LEN) setPhase('drop'); return; }
        if (phase === 'drop') { dropStep(h, pT); if (pT >= DROP_LEN) setPhase('land'); return; }
        if (phase === 'land') { landStep(h, pT); prjStep(h, false); return; }
        if (phase === 'fight') { if (F) fightStep(h, total); prjStep(h, true); return; }
        if (phase === 'death') { deathStep(h, pT); prjStep(h, false); return; }
        if (phase === 'outro') { outroStep(h); return; }
      });
    }
    return self;
  };
})();
