/* =============================================================================
   MAGICIAN.JS — "Palmer's Progress", the second loop's reckoning.
   REVIEWER 2 (TYPE 0002): the anonymous reviewer made flesh, in the mould of the
   Magician from The House of the Dead 2: a tall, slender thing that hovers with its
   toes pointed, crimson sinew with patches of segmented bone plate, a crest of
   horns, red tendrils, long claws. A dossier card, an arrival in a column of flame
   on top of the fountain, a fast teleporting fight in the standing town where only
   the three CONFLICTS OF INTEREST count (the bare pink flesh of his chest and hips,
   which his ribbed chest doors and hip plates uncover while he winds up, after a
   dash, and when a manuscript is shot down), then REBUTTAL ACCEPTED and a
   grant-funded blast-off in the departmental shuttle, framed clear of the town.
   Defines window.QuestMagician(api), with QuestBoss's interface
   (start/stop/update/hitTest, active/cinematic/ended), and QuestMagician.grit(kind,
   variant, sampleRate), which renders one grain of his voice's grit offline (tests).
   Everything is procedural: box geometry, canvas textures, and sound from the shared
   first-person kit (window.FPSFX, fpsfx.js: DOOM crossed with THE HOUSE OF THE DEAD)
   plus that grit, synthesised here. ?bossdbg=1 exposes window.__qb.
   ============================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------------ his voice's grit (pure synthesis; QuestMagician.grit renders it offline)
     The host types his lines in HISS, a thin sawtooth, one syllable every second letter. Under each syllable goes a grain
     in the kit's DOOM register: synthesised at 11 kHz, quantised to 8 bits and held up to the output rate with no
     interpolation, so it aliases and crunches. A vowel is a fried rasp (a naive sawtooth an octave under his hiss, chopped
     by vocal fry, through two formants of a small throat, driven); s, z, c, x and j are a crushed sibilant; any other
     letter is a click with a scrap of rasp. Seeded: a grain renders the same every time. */
  var GRIT_SR = 11025, GRIT_N = { v: 4, s: 3, k: 2 };
  var GRIT_FORMANTS = [[870, 1360], [640, 2180], [380, 2750], [690, 1030]];     // a, e, i, o (x1.15)
  function seeded(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function svf(x, f, q, bp) {         // a TPT state-variable filter at GRIT_SR: band-pass (unity peak) or high-pass
    var g = Math.tan(Math.PI * f / GRIT_SR), k = 1 / q, a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2, s1 = 0, s2 = 0, y = new Float32Array(x.length);
    for (var i = 0; i < x.length; i++) { var v3 = x[i] - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3; s1 = 2 * v1 - s1; s2 = 2 * v2 - s2; y[i] = bp ? k * v1 : x[i] - k * v1 - v2; }
    return y;
  }
  function rasp(r, n, f0, fry) {      // a naive sawtooth (it aliases at 11 kHz, which is the point) gliding down, chopped by vocal fry
    var b = new Float32Array(n), ph = 0, fp = 0, L = n / GRIT_SR;
    for (var i = 0; i < n; i++) {
      ph += f0 * (1 - 0.14 * i / GRIT_SR / L) * (1 + 0.04 * (r() - 0.5)) / GRIT_SR; if (ph >= 1) ph -= 1;
      fp += fry / GRIT_SR; b[i] = (2 * ph - 1) * (1 - 0.7 * (0.5 + 0.5 * Math.sin(6.2832 * fp)));
    }
    return b;
  }
  // kind 'v' (vowel; variant 0-3 = a e i o), 's' (sibilant, 0-2) or 'k' (click, 0-1) → Float32Array at sr, peak 1
  function gritRender(kind, v, sr) {
    kind = GRIT_N[kind] ? kind : 'k'; v = Math.max(0, Math.min(GRIT_N[kind] - 1, v | 0)); sr = sr || 48000;
    var r = seeded(kind.charCodeAt(0) * 7919 + v * 104729 + 17), R = GRIT_SR, n = Math.round((kind === 's' ? 0.08 : kind === 'v' ? 0.075 : 0.055) * R);
    var y = new Float32Array(n), i, t, e, p = 0;
    function noise() { var w = new Float32Array(n); for (var j = 0; j < n; j++) w[j] = r() * 2 - 1; return w; }
    if (kind === 'v') {
      var src = rasp(r, n, [150, 165, 138, 172][v], 34), br = noise(), F = GRIT_FORMANTS[v];
      for (i = 0; i < n; i++) src[i] += br[i] * 0.35;                                             // breath
      var f1 = svf(src, F[0], 5, true), f2 = svf(src, F[1], 7, true);
      for (i = 0; i < n; i++) { t = i / R; e = t < 0.004 ? t / 0.004 : Math.exp(-(t - 0.004) / 0.02); y[i] = (f1[i] + 0.7 * f2[i] + 0.08 * src[i]) * e; }
    } else if (kind === 's') {
      var w = svf(noise(), [3300, 3900, 4400][v], 1.6, true), hs = svf(noise(), 3000, 0.7, false), th = rasp(r, n, 170, 30);
      for (i = 0; i < n; i++) { t = i / R; e = t < 0.01 ? t / 0.01 : t < 0.035 ? 1 : Math.exp(-(t - 0.035) / 0.015); y[i] = (w[i] + 0.6 * hs[i] + 0.15 * th[i]) * e; }
    } else {
      var ck = noise(), rp = svf(rasp(r, n, [160, 190][v], 28), 900, 3, true);
      for (i = 0; i < n; i++) { t = i / R; y[i] = ck[i] * Math.min(1, i / 4) * Math.exp(-t / 0.0008) + rp[i] * (t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) / 0.012)); }
    }
    for (i = 0; i < n; i++) p = Math.max(p, Math.abs(y[i]));
    var T = Math.round(0.003 * R), d = Math.tanh(2.6);
    for (i = 0; i < n; i++) {                                                                     // driven, a 3 ms fade out, 8 bits
      var x = Math.tanh(2.6 * y[i] / (p || 1)) / d, k = n - 1 - i;
      if (k < T) x *= 0.5 - 0.5 * Math.cos(Math.PI * k / T);
      y[i] = Math.round(x * 128) / 128;
    }
    var m = Math.max(1, Math.round(n * sr / R)), out = new Float32Array(m);                       // held, sample by sample, up to sr
    for (i = 0; i < m; i++) out[i] = y[Math.min(n - 1, Math.floor(i * R / sr))];
    return out;
  }

  window.QuestMagician = function (api) {
    var THREE = api.THREE, scene = api.scene, camera = api.camera;
    // `ended` goes up the moment the last REVISION is counted off: the host clears anything still in flight.
    var self = { active: false, cinematic: false, ended: false, start: start, stop: stop, update: update, hitTest: hitTest };

    /* ------------------------------------------------------------ constants */
    var S = 2.1;                         // model units → world: horn tips about 6.5 units up, hovering included
    var HOVER = 0.3;                     // model units between his pointed toes and whatever he is over
    var COL_R = 1.1;                     // his footprint while he is on the street
    var SHOT_R = 0.13;                   // a paper ball's radius (quest.js): a shot that touches a box has hit it
    var ARENA_R = 40;                    // the player is held this close to the fountain
    var HISS = { base: 340, wave: 'sawtooth', spread: 0.85 };   // thin, sibilant, never quite a voice (the host speaks it; gritPlay rides under it)
    var FONT = '"Press Start 2P", monospace';
    var NAME = 'REVIEWER 2';

    /* ------------------------------------------------------------ utils */
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length) % arr.length]; }
    function angDiff(a, b) { var d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); }
    function guard(fn) { try { return fn(); } catch (e) { if (window.console) console.error(e); } }
    function say(fn, arg) { try { api[fn](arg); } catch (e) {} }
    var V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3();

    /* ------------------------------------------------------------ sfx: the shared first-person kit, DOOM crossed with THE HOUSE OF THE DEAD
       Every sound but one comes from window.FPSFX (fpsfx.js; the API and every name are in .dev/sfx-contract.md), bound
       to the host's AudioContext and so shared with quest.js: every play is tagged GROUP and stop() cuts only those.
       What comes from him (his hiss and voice, teleports, a shot landing on him, his fire) is positioned: panned from
       the camera, full level within 14 units, never below half. The one voice the kit has not got is the grit under
       his lines (gritPlay). Without FPSFX the kit's sounds are silent and the grit goes straight to the destination. */
    var GROUP = 'magician';
    function ac() { try { return api.audio(); } catch (e) { return null; } }
    function kit() { var a = window.FPSFX && ac(); return a ? window.FPSFX.kit(a) : null; }
    function play(name, o) {
      try { var k = kit(); if (!k) return null; o = o || {}; o.group = GROUP; var h = k.play(name, o); return h && h.ok ? h : null; } catch (e) { return null; }
    }
    function at(x, y, z, o) { o = o || {}; o.pos = { x: x, y: y, z: z }; o.listener = camera; o.ref = 14; o.floor = 0.5; return o; }
    function him(o) { return boss ? at(boss.x, boss.y + 3.4, boss.z, o) : (o || {}); }
    var sfxGate = {};
    function gate(name, secs) {      // wall-clock rate limit: a hail of shots must not stack a hundred voices
      var now = Date.now(); if (sfxGate[name] && now - sfxGate[name] < secs * 1000) return false; sfxGate[name] = now; return true;
    }
    // rendered while the dossier card is up (or through the omen, after ?skipintro), in the order they are first needed
    var WARM = ['ui.type', 'plasma', 'hit.weak', 'click', 'wind', 'appear', 'flame', 'boss.laugh', 'teleport', { name: 'hiss', dur: 0.5 },
                'fireball.launch', 'crackle', 'fireball.burst', 'whoosh', 'pickup', { name: 'windup', dur: 0.75 }, { name: 'windup', dur: 0.45 }, 'dash',
                'hit.flesh', 'hit.armour', 'hit.crit', { name: 'hiss', dur: 0.75 }, { name: 'hiss', dur: 0.7 }, { name: 'hiss', dur: 0.65 }, { name: 'hiss', dur: 0.4 },
                'slam', 'boss.screech', 'drone', 'dispel', 'shatter', 'snap', 'gib', 'ui.tick', 'ui.go', 'ui.confirm', { name: 'windup', dur: 2.2 }, { name: 'rocket', dur: 4.2 }];
    // his voice's grit: a grain (gritRender) under each syllable the host speaks in HISS, into the kit's bus
    var GRIT_GAIN = { v: 0.13, s: 0.08, k: 0.1 }, GRIT_VOWEL = { a: 0, e: 1, i: 2, y: 2, o: 3, u: 3 }, gritBank = null, grits = [], gritN = 0;
    function gritWarm(a) {           // the nine grains as buffers on this context (about 6 ms): done at start(), not on his first syllable
      if (gritBank && gritBank.ac === a) return;
      gritBank = { ac: a, v: [], s: [], k: [] };
      ['v', 's', 'k'].forEach(function (kd) {
        for (var i = 0; i < GRIT_N[kd]; i++) { var d = gritRender(kd, i, a.sampleRate), B = a.createBuffer(1, d.length, a.sampleRate); B.getChannelData(0).set(d); gritBank[kd].push(B); }
      });
    }
    function gritPlay(ch) {
      try {
        var c = String(ch || '').toLowerCase(); if (!/^[a-z]$/.test(c)) return;
        var a = ac(); if (!a) return;
        gritWarm(a);
        var kd = GRIT_VOWEL[c] !== undefined ? 'v' : 'szcxj'.indexOf(c) >= 0 ? 's' : 'k', list = gritBank[kd], k = kit();
        var src = a.createBufferSource(), g = a.createGain();
        src.buffer = list[kd === 'v' ? GRIT_VOWEL[c] : Math.floor(Math.random() * list.length) % list.length];
        src.playbackRate.value = Math.pow(2, (Math.random() * 2 - 1) * 2 / 12);   // Doom's small random pitch: the repetition never grates
        g.gain.value = GRIT_GAIN[kd]; src.connect(g); g.connect(k && k.bus ? k.bus : a.destination);
        src.onended = function () { var i = grits.indexOf(src); if (i >= 0) grits.splice(i, 1); try { src.disconnect(); g.disconnect(); } catch (e) {} };
        src.start(); grits.push(src); gritN++;
      } catch (e) {}
    }
    function killSfx() {
      var k = kit(); if (k) k.stopAll(0.1, GROUP);
      grits.forEach(function (s) { try { s.stop(); } catch (e) {} }); grits.length = 0;
    }
    // the desperation ring's fire: its gain as the ring opens (7.5 units) and as it has closed (1.5)
    var RING_FIRE = [0.45, 0.8];
    var SFX = {
      clank: function (x, y, z) { if (gate('clank', 0.07)) play('hit.flesh', at(x, y, z)); },                   // sinew: a wet slap, and nothing counts
      /* bone plate: a clank, never the ricochet whine (paper on bone), and at most every 0.22 s. A clank takes about a
         quarter of a second to fall 20 dB, so at the gun's 0.13 s one on every shot rang on without a break, louder than
         the gun itself; every second shot, a little under the gun, lets each one land and die away */
      plate: function (x, y, z, o) { if (gate('plate', 0.22)) play('hit.armour', at(x, y, z, o || { variant: 0, gain: 0.7 })); },
      // a plate landing when he comes apart: bone on stone, as loud as it lands hard (v = impact speed), smaller bits higher
      clatter: function (x, y, z, v, pitch) { if (gate('clatter', 0.07)) play('hit.armour', at(x, y, z, { variant: 0, gain: 0.55 * clamp(v / 9, 0.15, 1), pitch: pitch })); },
      // a weak hit: the squelch of a paper ball into bare flesh under the confirmation tone, which climbs the scale as the
      // REVISIONS fall (k = 1 - hp / max); every fourth chained hit is the crit's triple strike and shriek
      ping: function (k, crit, x, y, z) { play('hit.flesh', at(x, y, z, { gain: 0.45 })); play(crit ? 'hit.crit' : 'hit.weak', { k: clamp(k, 0, 1) }); },
      // a chain-gun round into him (twelve a second): the slap, small, never the confirmation tone - the REVISIONS count is the confirmation
      tick: function (x, y, z) { if (gate('tick', 0.07)) play('hit.flesh', at(x, y, z, { gain: 0.35, pitch: 2 })); },
      whoosh: function () { play('teleport', him()); },                                                         // gone: a reversed swell that stops dead
      appear: function () { play('appear', him()); },
      // a column of flame: the burst of his arrival and the fire standing in it for as long as the column burns
      column: function (dur, x, y, z) {
        var o = x === undefined ? him : function (p) { return at(x, y + 1.5, z, p); };
        play('appear', o()); play('flame', o({ dur: dur + 0.3, fade: 0.35 }));
      },
      crackle: function (o) { if (gate('crackle', 0.12)) play('crackle', o); },
      launch: function (x, y, z) { play('fireball.launch', at(x, y, z)); SFX.crackle(at(x, y, z, { gain: 0.7 })); },   // a burning manuscript thrown
      pop: function (x, y, z) { if (gate('pop', 0.05)) play('fireball.burst', at(x, y, z)); },
      flyby: function (x, y, z) { play('whoosh', at(x, y, z, { gain: 0.8 })); },                             // a manuscript past your ear
      chime: function () { play('pickup'); },                                                                   // one shot down: he flinches open
      dash: function () { play('dash', him()); },
      // the crouch before a dash: the kit's attack wind-up, timed to end as he lunges. Not the hiss: he is shut while he
      // crouches, and the hiss is kept for the moments he is open (the throw and fire wind-ups, the recovery)
      crouch: function (dur) { play('windup', him({ dur: dur, gain: 0.8 })); },
      hiss: function (dur, x, y, z) { play('hiss', x === undefined ? him({ dur: dur }) : at(x, y, z, { dur: dur })); },
      laugh: function (delay) { play('boss.laugh', him({ delay: delay || 0 })); },
      screech: function (o) { play('boss.screech', him(o)); },
      buzz: function () { if (gate('buzz', 0.05)) play('plasma', { gain: 0.4 }); },                           // the lights failing
      wind: function (dur) { play('wind', { dur: dur, attack: dur * 0.5, fade: dur * 0.3 }); },
      slam: function (x, z) { play('slam', at(x, 0.5, z)); },
      roar: function (dur, x, z) { return play('flame', at(x, 0.5, z, { dur: dur, fade: 0.4 })); },           // the line of fire; moved along with its front
      dispel: function () { play('dispel'); },
      /* the desperation ring: the drone, and the fire the ring is made of. Most of the drone is under 200 Hz, so over the
         music (and on any small speaker) the fire is what you hear; it swells as the ring closes (k 0 → 1). Both live only
         while they are fed (every frame of the ring): if frames stop (REJECTED!, a hidden tab) the kit's ttl watchdog fades
         them within about a second instead of droning on over the game-over screen, and once one has gone a fresh one
         starts if the ring is still burning. The fire skips the kit's rate gate so the ring's opening burst cannot drop it. */
      hum: function (s, k) {
        s = s || {};
        if (s.drone && s.drone.playing()) s.drone.feed(); else s.drone = play('drone', { ttl: 0.7 });
        k = clamp(k || 0, 0, 1);
        var f = lerp(RING_FIRE[0], RING_FIRE[1], k);
        if (s.fire && s.fire.playing()) { s.fire.feed(); if (f !== s.f && (Math.abs(f - s.f) > 0.03 || k >= 1)) { s.f = f; s.fire.fade(f / s.f0, 0.3); } }
        else { s.fire = play('flame', { ttl: 0.7, gain: f, gate: 0 }); s.f0 = s.f = f; }
        return s;
      },
      hush: function (s, fade) { if (s) { if (s.drone) s.drone.stop(fade); if (s.fire) s.fire.stop(fade); } },
      snap: function () { play('snap', him()); play('snap', him({ delay: 0.13 })); },                         // two dry cracks: the horns
      shatter: function () { play('shatter', him()); },
      gone: function () { play('fireball.burst', him({ pitch: -7, vary: 0.5 })); play('gib', him({ gain: 0.8 })); },   // the last of him goes up
      count: function (go) { play(go ? 'ui.go' : 'ui.tick'); },
      spool: function (dur) { return play('windup', { dur: dur, gain: 0.7 }); },                            // the shuttle's engines, before ignition
      rocket: function (dur) { play('rocket', { dur: dur }); },
      type: function () { if (gate('type', 0.045)) play('ui.type'); },
      ui: function (name, o) { play(name, o); },
      grit: gritPlay
    };

    /* ------------------------------------------------------------ DOM: style, HP bar, banner, countdown, caption, flash */
    var dom = {};
    var CSS = [
      '.qm-card{position:absolute;inset:0;z-index:8;background:#040203;cursor:pointer;overflow:hidden;transform-origin:50% 50%}',
      '.qm-card canvas{width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges}',
      '.qm-card.is-off{transition:transform .2s ease-in,filter .2s;transform:scale(1,.004);filter:brightness(4)}',
      '.qm-hp{position:absolute;left:50%;bottom:1.1rem;transform:translateX(-50%);width:min(64%,640px);z-index:5;pointer-events:none;font-family:' + FONT + ';color:#e8e2d0;opacity:0;transition:opacity .9s,bottom .25s}',
      '.qm-hp.is-on{opacity:1}.qm-hp.is-up{bottom:9.2rem}',
      '.qm-hp__row{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;font-size:.58rem;letter-spacing:.08em;text-shadow:2px 2px 0 #000;margin-bottom:.4rem}',
      '.qm-hp__h{font-size:.48rem;color:#ffb347;white-space:nowrap}',
      '.qm-hp__c{font-size:.42rem;color:#8fffc0;white-space:nowrap;opacity:0;transition:opacity .2s}.qm-hp__c.is-on{opacity:1}',
      '.qm-hp__bar{position:relative;height:7px;background:rgba(12,4,6,.82);border:2px solid #cdbf9a;box-shadow:2px 2px 0 #000}',
      '.qm-hp__bar i{position:absolute;left:0;top:0;bottom:0;width:100%}',
      '.qm-hp__ghost{background:#e9c341}.qm-hp__fill{background:linear-gradient(#ff8a2a,#a3300c)}',
      '.qm-hp.is-hit .qm-hp__fill{background:#fff}',
      '.qm-banner{position:absolute;left:0;right:0;top:46%;transform:translateY(-50%);z-index:5;pointer-events:none;text-align:center;padding:1.4rem 0 1.2rem;font-family:' + FONT + ';font-size:clamp(.8rem,3.4vw,2.3rem);letter-spacing:.14em;color:#f3d469;text-shadow:3px 3px 0 #000,0 0 26px rgba(243,212,105,.65);background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.8) 16%,rgba(0,0,0,.8) 84%,rgba(0,0,0,0));opacity:0}',
      '.qm-banner small{display:block;margin-top:1rem;font-size:.32em;color:#e8e2d0;letter-spacing:.22em;text-shadow:2px 2px 0 #000}',
      '.qm-count{position:absolute;inset:0;z-index:5;display:grid;place-items:center;pointer-events:none;font-family:' + FONT + ';font-size:clamp(3rem,14vw,9rem);color:#fff;text-shadow:6px 6px 0 #000,0 0 40px rgba(255,120,40,.8)}',
      '.qm-cap{position:absolute;left:0;right:0;bottom:4.4rem;z-index:7;text-align:center;pointer-events:none;font-family:' + FONT + ';font-size:clamp(.45rem,1.3vw,.7rem);letter-spacing:.1em;color:#fff;text-shadow:2px 2px 0 #000}',
      '.qm-cap small{display:block;margin-top:.55rem;font-size:.8em;opacity:.7}',
      '.qm-flash{position:absolute;inset:0;z-index:12;background:#fff;opacity:0;pointer-events:none}',
      // his lines on a phone: a small box in the free patch right of the d-pad and above B, never over a control
      '.qm-say{position:absolute;top:5.4rem;right:4px;width:52%;z-index:6;pointer-events:none;background:rgba(10,12,20,.92);border:2px solid #fff;box-shadow:2px 2px 0 #000;padding:.3rem .4rem;font-family:' + FONT + ';font-size:.36rem;line-height:1.6;letter-spacing:.02em;color:#f4f6fb}',
      '.qm-say b{display:block;font-weight:normal;color:#fcd34d;font-size:.32rem;margin-bottom:.15rem}',
      '.qm-cine .q-pad,.qm-cine .q-act{display:none!important}',
      '.q-view .qm-hp{transition:opacity .3s,bottom .25s}.q-view .qm-cap{transition:opacity .3s,bottom .2s}',
      '.quest.is-over .qm-hp,.quest.is-over .qm-cap,.quest.is-over .qm-say{opacity:0!important}',   // REJECTED! owns the screen
      // Touch layout, last so it wins. A phone view is about 260 px tall: the quest HUD ends near y 46 and the
      // d-pad starts near y 105, so the bar and the attack caption live in that band, clear of every control.
      '@media (hover:none),(max-width:700px){',
      '.qm-hp,.qm-hp.is-up{bottom:auto;top:4.25rem;width:92%;z-index:6}',
      '.qm-hp__row{font-size:.4rem;gap:.4rem;margin-bottom:.15rem}.qm-hp__h{font-size:.34rem}.qm-hp__c{font-size:.3rem}.qm-hp__bar{height:4px}',
      '.qm-cap{top:5.4rem;bottom:auto;padding:0 .5rem;font-size:.4rem;line-height:1.2}',
      '.qm-cap small{display:none}',
      '.qm-on .q-toast{top:6.3rem;left:auto;right:.6rem;transform:none;max-width:52%;font-size:.42rem;line-height:1.6;padding:.35rem .5rem}',
      '.qm-on .q-dialog{pointer-events:none}',   // any host notice that still turns up lets every tap through to the pad and A/B
      '.qm-cine .qm-cap{top:auto;bottom:2.4rem;font-size:.5rem}.qm-cine .qm-cap small{display:block;margin-top:.45rem}',
      '}'
    ].join('\n');
    function rootClass(name, on) { guard(function () { if (api.root && api.root.classList) api.root.classList.toggle(name, !!on); }); }
    function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; api.view.appendChild(e); return e; }
    function rm(name) { var e = dom[name]; if (e && e.parentNode) e.parentNode.removeChild(e); dom[name] = null; }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function ensureStyle() {
      if (dom.style) return;
      dom.style = document.createElement('style'); dom.style.setAttribute('data-quest-magician', ''); dom.style.textContent = CSS; document.head.appendChild(dom.style);
    }
    function showHpBar(hp, max) {
      if (!dom.hp) {
        dom.hp = el('div', 'qm-hp', '<div class="qm-hp__row"><span>' + NAME + '</span><span class="qm-hp__c"></span><span class="qm-hp__h">REVISIONS <b></b></span></div><div class="qm-hp__bar"><i class="qm-hp__ghost"></i><i class="qm-hp__fill"></i></div>');
        dom.hpFill = dom.hp.querySelector('.qm-hp__fill'); dom.hpGhost = dom.hp.querySelector('.qm-hp__ghost'); dom.hpNum = dom.hp.querySelector('b'); dom.hpChain = dom.hp.querySelector('.qm-hp__c');
        dom.dlg = api.root.querySelector('.q-dialog');
      }
      setHpBar(hp, max, hp / max);
      var bar = dom.hp; setTimeout(function () { if (bar) bar.classList.add('is-on'); }, 30);
    }
    function setHpBar(hp, max, ghost) {
      if (!dom.hp) return;
      dom.hpFill.style.width = (100 * hp / max) + '%'; dom.hpGhost.style.width = (100 * ghost) + '%'; dom.hpNum.textContent = hp;
    }
    function setChain(n) {
      if (!dom.hpChain) return;
      if (n >= 3) { dom.hpChain.textContent = 'CHAIN x' + n; dom.hpChain.classList.add('is-on'); } else dom.hpChain.classList.remove('is-on');
    }
    function hideHpBar() { rm('hp'); dom.hpFill = dom.hpGhost = dom.hpNum = dom.hpChain = null; }
    function narrowView() {
      var w = 0; guard(function () { w = api.view.clientWidth || 0; });
      if (w && w < 700) return true;
      try { return !!(window.matchMedia && window.matchMedia('(hover:none)').matches); } catch (e) { return false; }
    }
    function remPx() { var r = 16; guard(function () { r = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }); return r; }
    /* On a desktop the bar lifts over the host dialog by CSS (is-up) and the attack caption is lifted above the bar, so
       neither prints on his own lines. On a phone the bar and the caption live under the host HUD, and in loop 2 that
       HUD wraps to two rows (the MASTER QUEST pill), so their tops are measured rather than assumed; his lines go in a
       small box of their own right of the d-pad (the host dialog would cover the pad and A/B). Cleared in the cinematic,
       where the caption sits at the bottom. */
    function layoutStep(h) {
      dom.layoutT = (dom.layoutT || 0) - h;
      if (dom.layoutT > 0) return;
      dom.layoutT = dom.say ? 0 : 0.4;                       // while he talks on a phone, every frame: a toast can turn up at any moment
      var hp = dom.hp, cap = dom.cap, box = dom.say, i;
      function clear(e) { if (e) { e.style.top = ''; e.style.bottom = ''; e.style.left = ''; e.style.right = ''; e.style.width = ''; e.style.transform = ''; e.style.transformOrigin = ''; } }
      var v = api.view.getBoundingClientRect(), vw = v.width || 1, vh = v.height || 1;
      if (!narrowView()) {
        clear(hp);
        if (cap) { clear(cap); if (dlgUp()) { var dr = dom.dlg.getBoundingClientRect(); cap.style.bottom = Math.round(Math.max(v.bottom - dr.top, 9.2 * remPx() + (hp ? hp.offsetHeight : 0)) + 10) + 'px'; } }
        return;
      }
      if (self.cinematic) { clear(hp); clear(cap); return; }
      var top = 68, padTop = vh, padLeft = 0, padW = 0, hasPad = false, actBottom = 0, actTop = vh;
      var hud = api.root.querySelector('.q-hud'), pad = api.root.querySelector('.q-pad'), acts = api.root.querySelectorAll('.q-act');
      if (hud) { var r = hud.getBoundingClientRect(); if (r.height > 0) top = Math.max(top, Math.round(r.bottom - v.top) + 6); }
      if (pad) { var pr = pad.getBoundingClientRect(); if (pr.height > 0) { hasPad = true; padTop = pr.top - v.top; padLeft = pr.left - v.left; padW = pr.width; } }
      for (i = 0; i < acts.length; i++) { var ar = acts[i].getBoundingClientRect(); if (ar.height > 0) { actBottom = Math.max(actBottom, ar.bottom - v.top); actTop = Math.min(actTop, ar.top - v.top); } }
      var barH = hp ? hp.offsetHeight : 17;
      if (!hasPad || top + barH + 2 <= padTop) {                                     // the band between the HUD and the d-pad, as designed
        if (hp) { clear(hp); hp.style.top = top + 'px'; }
        if (cap) { clear(cap); cap.style.top = Math.max(top + barH + 2, Math.min(top + barH + 8, padTop - (cap.offsetHeight || 8) - 2)) + 'px'; }
      } else {
        // no band left (the loop-2 HUD reaches the d-pad): the bar takes the strip right of the pad and under the A/B buttons
        // (shrunk if they reach too low), the caption the patch right of the UP button; both are still pointer-events: none
        var room = vh - 2 - actBottom;
        if (hp) {
          clear(hp); hp.style.top = 'auto'; hp.style.bottom = '2px'; hp.style.left = Math.round(padLeft + padW + 6) + 'px'; hp.style.right = '4px'; hp.style.width = 'auto';
          hp.style.transform = room < barH ? 'scale(' + Math.max(0.6, room / barH).toFixed(2) + ')' : 'none'; hp.style.transformOrigin = '100% 100%';
        }
        if (cap) { clear(cap); cap.style.top = Math.round(padTop + 2) + 'px'; cap.style.left = Math.round(padLeft + padW * 2 / 3 + 4) + 'px'; cap.style.right = '4px'; }
      }
      if (!box) return;
      // his box: right of the pad, under whatever of the bar and caption sits in that column, above A/B. A toast in the
      // same patch wins (it is teaching you something): the line drops under it, or waits out of sight until it goes
      var sL = hasPad ? Math.round(padLeft + padW + 6) : 8, sW = Math.max(120, Math.min(vw - sL - 4, 300)), sTop = top;
      [hp, cap].forEach(function (e) { if (!e) return; var er = e.getBoundingClientRect(); if (er.height > 0 && er.top - v.top < vh * 0.5 && er.right - v.left > vw - 4 - sW) sTop = Math.max(sTop, Math.round(er.bottom - v.top) + 4); });
      box.style.left = 'auto'; box.style.right = '4px'; box.style.width = sW + 'px'; box.style.top = sTop + 'px'; box.style.visibility = '';
      var toast = api.root.querySelector('.q-toast');
      if (toast && !toast.hidden) {
        var tr = toast.getBoundingClientRect(), sr = box.getBoundingClientRect();
        if (tr.height > 0 && tr.bottom > sr.top && tr.top < sr.bottom && tr.right > sr.left && tr.left < sr.right) {
          var below = Math.round(tr.bottom - v.top) + 4;
          if (below + sr.height <= actTop - 3) box.style.top = below + 'px'; else box.style.visibility = 'hidden';
        }
      }
    }
    // his lines on a phone, typed in game time with the same hiss the host dialog gives him, and the grit under it
    function sayShow(text) {
      if (!dom.say) dom.say = el('div', 'qm-say', '');
      dom.say.innerHTML = '<b>' + esc(NAME) + '</b><span></span>'; dom.sayBody = dom.say.lastChild;
      dom.sayText = String(text); dom.sayK = 0; dom.sayT = dom.sayText.length / 42 + 2.6; dom.layoutT = 0;
    }
    function sayStep(h) {
      if (!dom.say || !dom.sayText) return;
      var n0 = Math.floor(dom.sayK); dom.sayK += h * 42;
      var n1 = Math.min(dom.sayText.length, Math.floor(dom.sayK));
      if (n1 > n0) { dom.sayBody.textContent = dom.sayText.slice(0, n1); if (gate('say', 0.045)) { var ch = dom.sayText[n1 - 1]; guard(function () { api.speak(HISS, ch); }); SFX.grit(ch); } }
      dom.sayT -= h; if (dom.sayT <= 0) sayHide();
    }
    function sayHide() { rm('say'); dom.sayText = ''; dom.sayBody = null; }
    /* On a desktop the host types his lines (api.notice) a letter at a time and speaks every second one in HISS, in the
       same task as it types it. The grit goes under exactly those syllables: a MutationObserver on the dialog body runs
       straight after each typed letter (not at the next frame), and a grain plays when the host has just spoken, that is
       when the text has an even length and ends in a letter, classed by that letter. */
    function voiceWatch(on) {
      if (dom.vObs) { dom.vObs.disconnect(); dom.vObs = null; }
      if (!on || !dom.dlgB || typeof MutationObserver !== 'function') return;
      dom.vObs = new MutationObserver(voiceTick);
      dom.vObs.observe(dom.dlgB, { childList: true, characterData: true, subtree: true });
    }
    function voiceTick() {
      var d = dom.dlg, T = dom.dlgT, B = dom.dlgB;
      if (!self.active || !d || !T || !B || d.hidden || T.textContent !== NAME) return;
      var s = B.textContent || '', n = s.length;
      if (n && n % 2 === 0 && /[a-z]/i.test(s[n - 1])) SFX.grit(s[n - 1]);
    }
    function sayUp() { return !!(dom.say && dom.sayText); }
    function showBanner(main, sub) { rm('banner'); dom.banner = el('div', 'qm-banner', esc(main) + (sub ? '<small>' + esc(sub) + '</small>' : '')); }
    function setBanner(a) { if (dom.banner) dom.banner.style.opacity = clamp(a, 0, 1); }
    function showCount(txt) { if (!dom.count) dom.count = el('div', 'qm-count', ''); dom.count.textContent = txt; }
    function hideCount() { rm('count'); }
    function showCap(txt, sub) {
      if (!dom.cap) dom.cap = el('div', 'qm-cap', '');
      dom.cap.innerHTML = esc(txt) + (sub ? '<small>' + esc(sub) + '</small>' : '');
      dom.cap.style.opacity = '1'; dom.capT = 2.6; dom.layoutT = 0;
      guard(function () { layoutStep(0); });                   // placed now: a caption must not appear inside his dialog, even for a frame
    }
    function capStep(h) {
      if (!dom.cap || !dom.capT) return;
      dom.capT -= h;
      if (dom.capT <= 0) rm('cap'); else if (dom.capT < 0.5) dom.cap.style.opacity = String(dom.capT / 0.5);
    }
    function setFlash(k) {
      if (k <= 0.001) { rm('flash'); return; }
      if (!dom.flash) dom.flash = el('div', 'qm-flash', '');
      dom.flash.style.opacity = String(clamp(k, 0, 1));
    }

    /* ------------------------------------------------------------ intro card: a House of the Dead 2 dossier
       The schematic is the Magician's rest pose in model units [x, y, z, w, h, d, kind, roll], toes at y = 0 (the card
       draws him HOVER above the turntable, as he is). Horn and spike entries also carry their two 3D end points and are
       drawn as a stroke between them as the turntable turns; they come from hornChain(), CREST and SPIKES, which the 3D
       model is built from as well. */
    var HEAD_Y = 2.28;
    function hornChain(sd) {          // each long horn: up and out off the brow, sweeping back over the skull, the tip curling up
      var dirs = [[0.35, 0.85, -0.15], [0.3, 0.6, -0.7], [0.15, 0.12, -1.0], [0.06, 0.55, -0.85]], lens = [0.15, 0.16, 0.17, 0.14], ths = [0.075, 0.06, 0.045, 0.03];
      var x = sd * 0.08, y = 0.25, z = 0.05, out = [], i;
      for (i = 0; i < 4; i++) {
        var d = dirs[i], L = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]), dx = sd * d[0] / L, dy = d[1] / L, dz = d[2] / L;
        out.push({ x: x, y: y, z: z, dx: dx, dy: dy, dz: dz, len: lens[i], th: ths[i] });
        x += dx * lens[i]; y += dy * lens[i]; z += dz * lens[i];
      }
      return out;
    }
    var CREST = [[0, 0.26, 0.07, 0.13], [0, 0.265, 0.0, 0.12], [0, 0.25, -0.07, 0.1], [0, 0.21, -0.12, 0.08]];   // [x, y, z, length]: small spikes raked back along the skull
    var CREST_DIR = [0, 0.55, -0.85];
    function spikes(sd) { return [sd * 0.1, 0.19, -0.02, sd * 0.9, 0.3, -0.5, 0.09, 0.03]; }   // the two short spikes over the ears: [x, y, z, dx, dy, dz, length, thickness]
    function hornSeg(x, y, z, dx, dy, dz, len, th) {                                   // a schematic entry with its end points (head space → model)
      var L = Math.sqrt(dx * dx + dy * dy + dz * dz), ex = x + dx / L * len, ey = y + dy / L * len, ez = z + dz / L * len;
      return [(x + ex) / 2, HEAD_Y + (y + ey) / 2, (z + ez) / 2, th, 0, th, 'horn', 0, [x, HEAD_Y + y, z, ex, HEAD_Y + ey, ez]];
    }
    var SCHEMA = (function () {
      var s = [], k, f, sd;
      for (k = 0; k < 2; k++) {                                                          // legs together, toes pointed
        sd = k ? 1 : -1;
        s.push([sd * 0.09, 1.0, 0, 0.17, 0.56, 0.19], [sd * 0.09, 0.47, 0, 0.13, 0.5, 0.15],
               [sd * 0.135, 1.13, 0.112, 0.08, 0.17, 0.045, 'plate'], [sd * 0.14, 0.94, 0.114, 0.07, 0.15, 0.045, 'plate'],
               [sd * 0.12, 0.64, 0.088, 0.065, 0.12, 0.04, 'plate'], [sd * 0.122, 0.495, 0.092, 0.06, 0.12, 0.04, 'plate'], [sd * 0.12, 0.35, 0.088, 0.058, 0.115, 0.04, 'plate'],
               [sd * 0.09, 0.07, 0.04, 0.09, 0.26, 0.1, 'plate']);
      }
      s.push([0, 1.3, 0, 0.36, 0.22, 0.24], [0, 1.56, 0.02, 0.26, 0.32, 0.2], [0, 1.9, -0.01, 0.46, 0.44, 0.26], [0, 2.2, 0, 0.1, 0.18, 0.1]);
      for (k = 0; k < 2; k++) {                                                          // rib doors, hip flaps, the arms and their claws
        sd = k ? 1 : -1;
        for (f = 0; f < 4; f++) s.push([sd * 0.067, 1.965 - f * 0.15, 0.195, 0.13, 0.042, 0.03, 'plate', sd * 0.14]);   // the ribs over the sinew doors
        s.push([sd * 0.075, 1.74, 0.165, 0.15, 0.6, 0.04], [sd * 0.135, 1.31, 0.16, 0.13, 0.19, 0.036, 'plate'],
               [sd * 0.37, 1.88, 0, 0.12, 0.46, 0.13, 0, sd * 0.28], [sd * 0.35, 2.08, 0, 0.21, 0.16, 0.21, 'plate', sd * 0.28],
               [sd * 0.49, 1.45, 0.03, 0.1, 0.44, 0.11, 0, sd * 0.28], [sd * 0.5, 1.47, 0.03, 0.07, 0.4, 0.13, 'plate', sd * 0.28],
               [sd * 0.565, 1.17, 0.04, 0.1, 0.13, 0.06, 'plate', sd * 0.28]);
        for (f = 0; f < 4; f++) { var a = sd * 0.28 + (f - 1.5) * 0.2; s.push([sd * 0.585 + (f - 1.5) * 0.026 + Math.sin(a) * 0.12, 1.1 - Math.cos(a) * 0.12, 0.05, 0.022, 0.24, 0.022, 'plate', a]); }
      }
      s.push([0, 2.42, 0.01, 0.2, 0.24, 0.24, 'plate'], [0, 2.33, 0.1, 0.14, 0.1, 0.1, 'plate'], [-0.05, 2.445, 0.13, 0.055, 0.036, 0.02, 'eye'], [0.05, 2.445, 0.13, 0.055, 0.036, 0.02, 'eye']);
      CREST.forEach(function (c) { s.push(hornSeg(c[0], c[1], c[2], CREST_DIR[0], CREST_DIR[1], CREST_DIR[2], c[3], 0.034)); });
      for (k = 0; k < 2; k++) {
        var sp = spikes(k ? 1 : -1); s.push(hornSeg(sp[0], sp[1], sp[2], sp[3], sp[4], sp[5], sp[6], sp[7]));
        hornChain(k ? 1 : -1).forEach(function (hc) { s.push(hornSeg(hc.x, hc.y, hc.z, hc.dx, hc.dy, hc.dz, hc.len + 0.02, hc.th)); });
      }
      s.push([0, 1.74, 0.22, 0.24, 0.56, 0.02, 'weak'], [-0.13, 1.3, 0.22, 0.1, 0.15, 0.02, 'weak'], [0.13, 1.3, 0.22, 0.1, 0.15, 0.02, 'weak']);
      return s;
    })();
    var TENDRIL_SCHEMA = [[-0.44, 1.66, -0.06, 7, 0.16, -0.05], [0.44, 1.66, -0.06, 7, 0.16, 0.05], [-0.08, 2.0, -0.18, 8, 0.17, -0.045], [0.08, 2.0, -0.18, 8, 0.17, 0.045],
                          [-0.09, 0.58, -0.08, 5, 0.12, -0.03], [0.09, 0.58, -0.08, 5, 0.12, 0.03]];   // [x, y, z, segments, drop, outward]
    var CARD_LEN = 6.4;
    function openCard() {
      var r = api.view.getBoundingClientRect(), W = r.width < 560 ? 480 : 640, H = Math.round(W * (r.height || 9) / (r.width || 16));
      H = clamp(H, 270, 480);
      dom.card = el('div', 'qm-card'); var cv = document.createElement('canvas'); cv.width = W; cv.height = H; dom.card.appendChild(cv);
      var scan = document.createElement('canvas'); scan.width = W; scan.height = H; var sx = scan.getContext('2d');
      sx.fillStyle = 'rgba(0,0,0,0.30)'; for (var y = 0; y < H; y += 2) sx.fillRect(0, y, W, 1);
      var vg = sx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      sx.fillStyle = vg; sx.fillRect(0, 0, W, H);
      dom.cardCv = cv; dom.cardScan = scan; dom.cardTyped = 0; dom.cardWeak = false;
      SFX.ui('plasma', { gain: 0.55, pitch: -5, vary: 0 });      // the monitor comes on
      dom.card.addEventListener('pointerdown', onSkip);
    }
    function typed(text, T, t0, cps) { var n = clamp(Math.floor((T - t0) * (cps || 38)), 0, text.length); return text.slice(0, n); }
    function drawCard(T) {
      var cv = dom.cardCv; if (!cv) return;
      var x = cv.getContext('2d'), W = cv.width, H = cv.height, wide = W >= 600, k, i;
      var AMBER = '#ffb347', DIM = '#5a3410', PALE = '#ffe6c4', RED = '#ff3348';
      x.fillStyle = '#0a0503'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(120,70,20,0.35)'; x.lineWidth = 1; x.beginPath();
      for (i = 24; i < W; i += 24) { x.moveTo(i + 0.5, 34); x.lineTo(i + 0.5, H - 30); }
      for (i = 34; i < H - 28; i += 24) { x.moveTo(10, i + 0.5); x.lineTo(W - 10, i + 0.5); }
      x.stroke();
      x.strokeStyle = AMBER; x.lineWidth = 2; x.strokeRect(7, 7, W - 14, H - 14);
      x.fillStyle = AMBER; x.fillRect(7, 7, W - 14, 22);
      x.fillStyle = '#1a0a02'; x.font = '8px ' + FONT; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText('EDITORIAL THREAT FILE  ·  SECOND ROUND', 16, 19);
      x.textAlign = 'right'; x.fillText(wide ? 'IDENTITY: WITHHELD' : 'WITHHELD', W - 16, 19);
      // the rotating schematic: he hovers over the turntable
      var cx = Math.round(W * 0.27), base = H - 44, sc = (H - 96) / 3.45, lift = HOVER * sc, th = -0.75 + T * 1.15, c = Math.cos(th), s = Math.sin(th);
      x.strokeStyle = DIM; x.lineWidth = 1;
      for (k = 1; k <= 3; k++) { x.beginPath(); x.ellipse(cx, base, sc * 0.5 * k, sc * 0.13 * k, 0, 0, 6.283); x.stroke(); }
      x.beginPath(); x.moveTo(cx, base); x.lineTo(cx + Math.cos(T * 2.2) * sc * 1.5, base + Math.sin(T * 2.2) * sc * 0.39); x.stroke();
      function sx(px, pz) { return cx + (px * c + pz * s) * sc; }
      if (T > 0.7) {                                                  // the tendrils, behind him: red chains that sway
        x.strokeStyle = 'rgba(255,51,72,0.85)'; x.lineWidth = 3; x.lineJoin = 'round';
        TENDRIL_SCHEMA.forEach(function (a, n) {
          var px = a[0], py = a[1], pz = a[2], j;
          x.beginPath(); x.moveTo(sx(px, pz), base - lift - py * sc);
          for (j = 1; j <= a[3]; j++) { py -= a[4]; pz -= 0.03 + 0.025 * Math.sin(T * 2.3 + n + j * 0.8); px += a[5] + 0.03 * Math.sin(T * 1.7 + n * 2 + j * 0.9); x.lineTo(sx(px, pz), base - lift - py * sc); }
          x.stroke();
        });
        x.lineWidth = 1;
      }
      var order = SCHEMA.map(function (p, n) { return { p: p, z: -p[0] * s + p[2] * c + (p[6] === 'weak' ? 9 : 0), n: n }; }).sort(function (a, b) { return a.z - b.z; });   // the blinking weak points go on top, like an x-ray
      var weakPts = [], bFront = c > 0.05;
      var show = clamp(T / 1.1, 0, 1) * SCHEMA.length;          // parts assemble one by one
      var blink = Math.floor(T * 5) % 2 === 0;
      order.forEach(function (o) {
        var p = o.p; if (o.n >= show) return;
        var px = sx(p[0], p[2]), hw = (Math.abs(p[3] * c) + Math.abs(p[5] * s)) / 2 * sc, py = base - lift - p[1] * sc, hh = p[4] * sc, kind = p[6], roll = (p[7] || 0) * c;
        if (kind === 'weak') { weakPts.push({ x: px, y: py }); if (!bFront || !blink) return; }
        if (kind === 'eye' && !bFront) return;
        if (p[8]) {                                                 // a horn or spike: a stroke between its projected ends
          var e = p[8];
          x.strokeStyle = 'rgba(255,236,200,0.92)'; x.lineWidth = Math.max(2, p[3] * sc); x.lineCap = 'round';
          x.beginPath(); x.moveTo(sx(e[0], e[2]), base - lift - e[1] * sc); x.lineTo(sx(e[3], e[5]), base - lift - e[4] * sc); x.stroke();
          x.lineCap = 'butt'; x.lineWidth = 1; return;
        }
        var rw = Math.max(1, Math.round(hw * 2)), rh = Math.max(1, Math.round(hh));
        x.save(); x.translate(Math.round(px), Math.round(py)); if (roll) x.rotate(-roll);
        x.fillStyle = kind === 'weak' ? 'rgba(255,105,160,0.95)' : kind === 'plate' ? 'rgba(236,214,172,0.8)' : kind === 'horn' ? 'rgba(255,236,200,0.92)' : kind === 'eye' ? '#000' : 'rgba(96,14,28,0.95)';
        x.fillRect(-rw / 2, -rh / 2, rw, rh);
        if (kind !== 'weak' && kind !== 'eye') { x.strokeStyle = kind ? PALE : AMBER; x.strokeRect(-rw / 2 + 0.5, -rh / 2 + 0.5, rw - 1, rh - 1); }
        if (!kind && rw > 6) {                                     // sinew: fibres down the muscle
          x.strokeStyle = 'rgba(255,110,140,0.5)'; x.beginPath();
          for (var q = 1; q < 3; q++) { var fx = Math.round(-rw / 2 + rw * q / 3) + 0.5; x.moveTo(fx, -rh / 2 + 2); x.lineTo(fx, rh / 2 - 2); }
          x.stroke();
        }
        x.restore();
      });
      // text column
      var tx = Math.round(W * 0.54), big = wide ? 24 : 16, y0 = 62;
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = AMBER; x.font = big + 'px ' + FONT; x.fillText(typed('TYPE 0002', T, 0.5, 22), tx, y0);
      x.fillStyle = PALE; x.font = '16px ' + FONT; x.fillText(typed('REVIEWER 2', T, 1.0, 26), tx, y0 + 34);
      x.fillStyle = AMBER; x.font = '8px ' + FONT;
      x.fillText(typed('ANONYMOUS. UNACCOUNTABLE.', T, 1.5), tx, y0 + 60); x.fillText(typed('UNFAILINGLY LATE.', T, 2.0), tx, y0 + 74);
      var rows = ['HEIGHT ........ 1.9 M', 'IDENTITY ...... REDACTED', 'TURNAROUND .... 11 MONTHS', 'DECLARED COI .. NONE', 'ARMOUR: SELF-CITATIONS'];
      x.fillStyle = '#c98a3a'; for (i = 0; i < rows.length; i++) x.fillText(typed(rows[i], T, 2.4 + i * 0.26, 60), tx, y0 + 100 + i * 15);
      // weak points: three blinking reticles, leader lines to one label
      if (T > 2.7 && weakPts.length) {
        var ly = Math.min(H - 62, y0 + 100 + rows.length * 15 + 18), lw = W - tx - 18, lk = clamp((T - 2.7) / 0.5, 0, 1);
        x.strokeStyle = RED; x.fillStyle = RED; x.lineWidth = bFront ? 2 : 1; x.globalAlpha = bFront ? 1 : 0.45;
        weakPts.forEach(function (w) {
          if (blink || !bFront) { x.beginPath(); x.arc(w.x, w.y, 10, 0, 6.283); x.stroke(); x.beginPath(); x.moveTo(w.x - 15, w.y); x.lineTo(w.x - 5, w.y); x.moveTo(w.x + 5, w.y); x.lineTo(w.x + 15, w.y); x.moveTo(w.x, w.y - 15); x.lineTo(w.x, w.y - 5); x.moveTo(w.x, w.y + 5); x.lineTo(w.x, w.y + 15); x.stroke(); }
        });
        x.globalAlpha = 1; x.lineWidth = 1;
        weakPts.forEach(function (w) {
          var midx = lerp(w.x + 11, tx - 22, Math.min(1, lk * 1.4));
          x.beginPath(); x.moveTo(w.x + 11, w.y); x.lineTo(midx, w.y); if (lk > 0.7) { x.lineTo(tx - 22, ly + 16); x.lineTo(tx - 4, ly + 16); } x.stroke();
        });
        if (lk >= 1) {
          if (!dom.cardWeak) { dom.cardWeak = true; SFX.ui('hit.weak', { k: 0, gain: 0.7 }); }   // the tone a hit on one will make
          x.fillStyle = blink ? 'rgba(120,8,22,0.9)' : 'rgba(50,4,10,0.9)'; x.fillRect(tx - 4, ly, lw, 34); x.strokeRect(tx - 3.5, ly + 0.5, lw, 34);
          x.fillStyle = '#ffd0d4'; x.font = '8px ' + FONT; x.fillText('WEAK POINT  x3', tx + 4, ly + 13);
          x.fillStyle = blink ? '#fff' : RED; x.font = (wide ? 11 : 8) + 'px ' + FONT; x.fillText(wide ? 'CONFLICTS OF INTEREST' : '>> CONFLICTS OF INTEREST', tx + 4, ly + (wide ? 29 : 27));
        }
      }
      x.fillStyle = PALE; x.font = '8px ' + FONT; x.textAlign = 'left';
      x.fillText(typed(wide ? 'SHOOT THE CONFLICTS OF INTEREST. ONLY WHILE THEY GLOW.' : 'SHOOT THE CONFLICTS. WHILE THEY GLOW.', T, 3.6, 30), 16, H - 17);
      if (T > 1 && Math.floor(T * 2) % 2 === 0) { x.textAlign = 'right'; x.fillStyle = AMBER; x.fillText(wide ? 'F / TAP: SKIP' : 'TAP: SKIP', W - 16, H - 17); }
      var chars = Math.floor(clamp(T - 0.5, 0, 4.8) * 12); if (chars !== dom.cardTyped) { dom.cardTyped = chars; if (T < 5.1) SFX.type(); }
      var sb = (T * 90) % (H + 60) - 30; x.fillStyle = 'rgba(255,180,80,0.06)'; x.fillRect(0, sb, W, 26);
      x.drawImage(dom.cardScan, 0, 0);
      if (T < 0.3) { var open = smooth(T / 0.3) * H / 2; x.fillStyle = '#000'; x.fillRect(0, 0, W, H / 2 - open); x.fillRect(0, H / 2 + open, W, H / 2 - open); x.fillStyle = '#ffe6c4'; x.fillRect(0, H / 2 - open - 1, W, 2); x.fillRect(0, H / 2 + open - 1, W, 2); }
    }
    function closeCard() {
      var c = dom.card; if (!c) return;
      SFX.ui('click'); c.removeEventListener('pointerdown', onSkip); c.classList.add('is-off'); dom.card = null; dom.cardCv = null; dom.cardScan = null;
      dom.cardDying = c; dom.cardTimer = setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); if (dom.cardDying === c) dom.cardDying = null; dom.cardTimer = null; }, 260);
    }
    function killCard() {
      if (dom.card) { dom.card.removeEventListener('pointerdown', onSkip); rm('card'); dom.cardCv = dom.cardScan = null; }
      if (dom.cardTimer) { clearTimeout(dom.cardTimer); dom.cardTimer = null; } rm('cardDying');
    }

    /* ------------------------------------------------------------ the Magician: box art, 6.5 hovering units of withheld identity
       Every rigid part is ONE mesh: its boxes are merged into a single vertex-coloured geometry (one shared material for the
       whole creature), and the bounds of each box, in that part's own frame, are kept for the hit test, so what a shot can
       hit is exactly what is drawn. Crimson and pink fibres laid over a black core read as sinew with shadow between the
       strands; the off-white plates are stacked a little offset from each other, so they read as segments. */
    var POSES = {   // shoulders (x: negative raises the arm forward and up; z: outward is negative on the left), elbows, wrists, the legs (together), lean, bob, head
      idle:    { lax: -0.25, laz: -0.28, lex: -0.35, rax: -0.25, raz: 0.28, rex: -0.35, wr: -0.2, legs: 0.08, knee: 0.12, lean: 0.04, bob: 0, headx: 0.1 },
      windup:  { lax: -2.2, laz: -0.55, lex: -0.7, rax: -2.75, raz: 0.3, rex: -0.9, wr: -0.7, legs: 0.18, knee: 0.25, lean: -0.12, bob: 0.06, headx: -0.2 },
      throw:   { lax: -1.9, laz: -0.5, lex: -0.8, rax: -1.35, raz: 0.1, rex: -0.2, wr: 0.2, legs: 0.1, knee: 0.15, lean: 0.2, bob: 0, headx: 0.15 },
      slam:    { lax: -1.25, laz: -0.2, lex: -0.5, rax: -1.25, raz: 0.2, rex: -0.5, wr: 0.4, legs: 0.35, knee: 0.45, lean: 0.35, bob: -0.12, headx: 0.35 },
      crouch:  { lax: 0.6, laz: -0.45, lex: -0.9, rax: 0.6, raz: 0.45, rex: -0.9, wr: -0.3, legs: 0.5, knee: 0.9, lean: 0.45, bob: -0.12, headx: 0.3 },
      dash:    { lax: 1.3, laz: -0.25, lex: -0.1, rax: 1.3, raz: 0.25, rex: -0.1, wr: 0.3, legs: 0.5, knee: 0.1, lean: 1.05, bob: -0.2, headx: -0.7 },
      recover: { lax: -0.5, laz: -1.15, lex: -0.25, rax: -0.5, raz: 1.15, rex: -0.25, wr: 0.3, legs: 0.1, knee: 0.3, lean: -0.25, bob: -0.04, headx: -0.45 },
      laugh:   { lax: -1.5, laz: -0.95, lex: -0.9, rax: -1.5, raz: 0.95, rex: -0.9, wr: -0.6, legs: 0.05, knee: 0.1, lean: -0.2, bob: 0.05, headx: -0.55 },
      perch:   { lax: -1.0, laz: -0.3, lex: -0.9, rax: -0.55, raz: 0.35, rex: -0.6, wr: -0.4, legs: -0.5, knee: 1.3, lean: 0.35, bob: -0.12, headx: 0.25 },
      dying:   { lax: -0.6, laz: -1.4, lex: -0.4, rax: -0.6, raz: 1.4, rex: -0.4, wr: 0.5, legs: 0, knee: 0.2, lean: -0.4, bob: -0.02, headx: -0.7 }
    };
    var PAL = { black: 0x160409, deep: 0x5e0c1b, crimson: 0x9a1c31, red: 0xc02a42, pink: 0xde748e, bone: 0xebe3d2, bone2: 0xc8bfac, bone3: 0x988e7e, tip: 0x1c1416 };
    var FIB = [PAL.crimson, PAL.pink, PAL.red, PAL.deep];
    var BM = new THREE.Matrix4(), BQ = new THREE.Quaternion(), BE = new THREE.Euler(), BV = new THREE.Vector3(), BS = new THREE.Vector3(1, 1, 1), BC = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
    function Parts() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.n = 0; this.hit = []; }
    Parts.prototype.q = function (w, h, d, c, x, y, z, q) {
      var g = new THREE.BoxGeometry(w, h, d), p, nn, ix, i;
      BV.set(x, y, z); BM.compose(BV, q, BS); g.applyMatrix4(BM);
      p = g.attributes.position.array; nn = g.attributes.normal.array; ix = g.index.array; BC.setHex(c);
      for (i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(nn[i]); }
      for (i = 0; i < p.length / 3; i++) this.col.push(BC.r, BC.g, BC.b);
      for (i = 0; i < ix.length; i++) this.idx.push(this.n + ix[i]);
      this.n += p.length / 3;
      g.computeBoundingBox(); this.hit.push(g.boundingBox.clone()); g.dispose();
      return this;
    };
    Parts.prototype.box = function (w, h, d, c, x, y, z, rx, ry, rz) { BE.set(rx || 0, ry || 0, rz || 0); BQ.setFromEuler(BE); return this.q(w, h, d, c, x, y, z, BQ); };
    Parts.prototype.along = function (x, y, z, dx, dy, dz, len, th, c) {          // a box from a point along a direction: horns, spikes, claws
      BV.set(dx, dy, dz).normalize(); BQ.setFromUnitVectors(UP, BV);
      return this.q(th, len, th, c, x + BV.x * len / 2, y + BV.y * len / 2, z + BV.z * len / 2, BQ);
    };
    Parts.prototype.chain = function (x, y, z, segs) {                            // segs: [dx, dy, dz, len, thickness, colour], end to end
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i], L = Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
        this.along(x, y, z, s[0], s[1], s[2], s[3], s[4], s[5]);
        x += s[0] / L * s[3]; y += s[1] / L * s[3]; z += s[2] / L * s[3];
      }
      return this;
    };
    // a limb or trunk segment: a black core, n fibres down the front and the back with shadow between them, two down each side
    Parts.prototype.sinew = function (w, h, d, x, y, z, n, k0) {
      var i, sw = w / n;
      this.box(w, h, d, PAL.black, x, y, z);
      for (i = 0; i < n; i++) {
        var fx = x - w / 2 + sw * (i + 0.5);
        this.box(sw * 0.7, h * (i % 2 ? 0.86 : 0.94), 0.026, FIB[(i + k0) % 4], fx, y + (i % 2 ? h * 0.03 : 0), z + d / 2 + 0.01);
        this.box(sw * 0.7, h * 0.9, 0.026, FIB[(i + k0 + 2) % 4], fx, y, z - d / 2 - 0.01);
      }
      for (i = -1; i <= 1; i += 2) {
        this.box(0.026, h * 0.9, d * 0.38, FIB[(k0 + (i > 0 ? 3 : 1)) % 4], x + i * (w / 2 + 0.01), y, z + d * 0.2);
        this.box(0.026, h * 0.82, d * 0.36, PAL.deep, x + i * (w / 2 + 0.01), y - h * 0.02, z - d * 0.22);
      }
      return this;
    };
    Parts.prototype.mesh = function (mat) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3)); g.setIndex(this.idx); g.computeBoundingSphere();
      var m = new THREE.Mesh(g, mat); m.castShadow = true; m.userData.hit = this.hit; return m;
    };
    var boss = null;
    function buildBoss(hp) {
      var b = { g: new THREE.Group(), rig: new THREE.Group(), x: 0, y: 0, z: 0, yaw: 0, hp: hp, max: hp, cur: {}, tgt: {}, rate: 6, pose: 'idle',
                glide: 0, side: 0, flinch: 0, open: 0, hitFlash: 0, charge: 0, wild: 0, parts: null,
                covers: [], patches: [], hands: [], bones: [], horns: [], targets: [], tendrils: [], hips: [], knees: [], arms: [], elbows: [], wrists: [] };
      var P = PAL, sd, k, f;
      b.g.add(b.rig); b.rig.scale.set(S, S, S);
      b.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      b.patchMat = new THREE.MeshBasicMaterial({ color: 0xff5a90, vertexColors: true, fog: false });
      var hc = document.createElement('canvas'); hc.width = hc.height = 64; var hx = hc.getContext('2d'), gr = hx.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,210,230,1)'); gr.addColorStop(0.4, 'rgba(255,80,150,0.45)'); gr.addColorStop(1, 'rgba(255,40,110,0)'); hx.fillStyle = gr; hx.fillRect(0, 0, 64, 64);
      b.haloTex = new THREE.CanvasTexture(hc);
      b.haloMat = new THREE.MeshBasicMaterial({ map: b.haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 });
      b.glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      b.glowGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      function pivot(x, y, z, parent) { var p = new THREE.Group(); p.position.set(x, y, z); (parent || b.rig).add(p); return p; }
      function put(parts, parent, list, kind) { var m = parts.mesh(b.mat); parent.add(m); if (list) list.push(m); b.targets.push({ m: m, k: kind || 'body' }); return m; }
      function patch(w, h, x, y, z, n) {                  // a conflict of interest: bare pink flesh, and a halo that shows only while it is bare
        var pp = new Parts().box(w, h, 0.016, 0x5c4650, 0, 0, -0.004), sw = w / n;   // the same fibres as the rest of him, in pink, with the shadow between
        for (var i = 0; i < n; i++) pp.box(sw * 0.74, h * (i % 2 ? 0.9 : 0.97), 0.014, i % 2 ? 0xe2c8d2 : 0xfff0f5, -w / 2 + sw * (i + 0.5), i % 2 ? h * 0.02 : 0, 0.006);
        var m = pp.mesh(b.patchMat); m.castShadow = false; m.position.set(x, y, z); b.rig.add(m);
        m.geometry.computeBoundingBox(); m.userData.hit = [m.geometry.boundingBox.clone()];   // one box: the whole patch counts
        b.patches.push(m); b.targets.push({ m: m, k: 'weak' });
        var halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, h * 1.7), b.haloMat); halo.position.set(x, y, z + 0.02); b.rig.add(halo);
      }
      // ---- the legs: held together, toes pointed, never touching anything
      for (k = 0; k < 2; k++) {
        sd = k ? 1 : -1;
        var hip = pivot(sd * 0.09, 1.28, 0), knee = pivot(0, -0.56, 0, hip);
        put(new Parts().sinew(0.17, 0.56, 0.19, 0, -0.28, 0, 3, k), hip);
        put(new Parts().box(0.08, 0.17, 0.045, P.bone, sd * 0.045, -0.15, 0.112).box(0.07, 0.15, 0.045, P.bone2, sd * 0.05, -0.34, 0.114)
                       .box(0.035, 0.3, 0.08, P.bone3, sd * 0.1, -0.25, 0.05), hip, b.bones);
        put(new Parts().sinew(0.13, 0.5, 0.15, 0, -0.25, 0, 3, k + 1).box(0.09, 0.2, 0.1, P.deep, 0, -0.6, 0.015, 0.12), knee);
        put(new Parts().box(0.065, 0.12, 0.04, P.bone, sd * 0.03, -0.08, 0.088).box(0.06, 0.12, 0.04, P.bone2, sd * 0.032, -0.225, 0.092).box(0.058, 0.115, 0.04, P.bone, sd * 0.03, -0.37, 0.088)
                       .box(0.1, 0.19, 0.05, P.bone2, 0, -0.58, 0.058, 0.12).chain(0, -0.66, 0.05, [[0, -1, 0.3, 0.13, 0.05, P.bone], [0, -1, 0.35, 0.05, 0.028, P.tip]]), knee, b.bones);
        b.hips.push(hip); b.knees.push(knee);
        b.tendrils.push({ a: knee, x: 0, y: -0.14, z: -0.085, n: 5, len: 0.3, th: 0.13, p0: 0.3, r0: sd * 0.3, ph: k * 2.1 + 0.5, f: 2.1 });
      }
      // ---- the trunk: pelvis, a narrow waist, the chest, the neck; bone down the spine
      var tb = new Parts()
        .box(0.36, 0.22, 0.24, P.black, 0, 1.3, 0).box(0.075, 0.19, 0.026, P.crimson, 0, 1.3, 0.128)
        .box(0.26, 0.32, 0.2, P.black, 0, 1.56, 0.02)
        .box(0.028, 0.34, 0.15, P.red, -0.135, 1.56, 0.02, 0, 0, -0.22).box(0.028, 0.34, 0.15, P.red, 0.135, 1.56, 0.02, 0, 0, 0.22)
        .box(0.46, 0.44, 0.26, P.black, 0, 1.9, -0.01);
      for (k = 0; k < 2; k++) {
        sd = k ? 1 : -1;
        tb.box(0.035, 0.4, 0.026, P.crimson, sd * 0.168, 1.9, 0.125, 0, 0, sd * 0.12).box(0.035, 0.36, 0.026, P.pink, sd * 0.207, 1.92, 0.12, 0, 0, sd * 0.2)
          .box(0.19, 0.04, 0.1, P.red, sd * 0.12, 2.15, 0, 0, 0, -sd * 0.38).box(0.026, 0.4, 0.2, P.deep, sd * 0.235, 1.9, 0);
      }
      for (k = 0; k < 5; k++) tb.box(0.075, 0.4, 0.026, FIB[(k + 1) % 4], -0.16 + k * 0.08, 1.9, -0.15);
      tb.box(0.1, 0.18, 0.1, P.black, 0, 2.2, 0).box(0.03, 0.16, 0.022, P.pink, -0.025, 2.2, 0.055).box(0.03, 0.16, 0.022, P.crimson, 0.025, 2.2, 0.055);
      put(tb, b.rig);
      var sp = new Parts().box(0.3, 0.05, 0.07, P.bone2, 0, 2.12, 0.1);
      for (k = 0; k < 6; k++) sp.box(0.09 - k * 0.006, 0.075, 0.05, k % 2 ? P.bone2 : P.bone, 0, 2.08 - k * 0.1, -0.175 + (k % 2) * 0.006);
      put(sp, b.rig, b.bones);
      // ---- the conflicts of interest, and the plates over them: rib plates that part and fold back against his flanks
      //      (swung toward you they hid the flesh from any angle but dead ahead), hip flaps that lift up and out
      //      Shut, a door is crimson sinew with four ribs of bone across it: the sinew is just him, the ribs are plate.
      patch(0.24, 0.56, 0, 1.74, 0.13, 5);
      for (k = 0; k < 2; k++) {
        sd = k ? 1 : -1;
        patch(0.1, 0.15, sd * 0.13, 1.3, 0.13, 2);
        var door = pivot(sd * 0.145, 1.74, 0.165), wall = new Parts().box(0.15, 0.62, 0.026, P.black, -sd * 0.075, 0, -0.006), ribs = new Parts();
        for (f = 0; f < 3; f++) wall.box(0.036, 0.6 * (f % 2 ? 0.9 : 0.97), 0.014, [P.crimson, P.red, P.deep][(f + k) % 3], -sd * (0.028 + f * 0.047), f % 2 ? 0.012 : 0, 0.012);
        for (f = 0; f < 4; f++) ribs.box(0.13 - f * 0.006, 0.042, 0.03, f % 2 ? P.bone2 : P.bone, -sd * (0.078 - f * 0.003), 0.225 - f * 0.15, 0.03, 0, 0, sd * 0.14);
        ribs.box(0.022, 0.62, 0.046, P.bone3, -sd * 0.134, 0, 0.014);                   // the sternum, half on each door
        b.covers.push({ hinge: door, ms: [put(wall, door), put(ribs, door, null, 'plate')], axis: 'y', sign: sd, ang: -0.9, x0: door.position.x, slide: sd * 0.13 });
        var flap = pivot(sd * 0.2, 1.4, 0.16);
        b.covers.push({ hinge: flap, ms: [put(new Parts().box(0.135, 0.1, 0.036, P.bone, -sd * 0.066, -0.05, 0).box(0.125, 0.095, 0.036, P.bone2, -sd * 0.062, -0.13, 0.006), flap, null, 'plate')], axis: 'z', sign: sd, ang: 1.9, x0: flap.position.x, slide: sd * 0.05 });
      }
      // ---- the arms: long, thin, plated at the shoulder and forearm, four claws and a thumb on each hand
      for (k = 0; k < 2; k++) {
        sd = k ? 1 : -1;
        var sh = pivot(sd * 0.31, 2.1, 0), el = pivot(0, -0.46, 0, sh), wr = pivot(0, -0.44, 0, el);
        put(new Parts().sinew(0.12, 0.46, 0.13, 0, -0.23, 0, 2, k + 1), sh);
        put(new Parts().box(0.21, 0.08, 0.21, P.bone, sd * 0.02, 0.03, 0).box(0.19, 0.08, 0.2, P.bone2, sd * 0.04, -0.045, 0.006).box(0.16, 0.07, 0.18, P.bone, sd * 0.055, -0.115, 0.012)
                       .along(sd * 0.06, 0.07, -0.02, sd * 0.3, 1, -0.4, 0.12, 0.035, P.bone2), sh, b.bones);
        put(new Parts().sinew(0.1, 0.44, 0.11, 0, -0.22, 0, 2, k), el);
        put(new Parts().box(0.07, 0.15, 0.13, P.bone, sd * 0.035, -0.08, -0.004).box(0.065, 0.15, 0.125, P.bone2, sd * 0.04, -0.22, 0.004).box(0.06, 0.14, 0.12, P.bone, sd * 0.036, -0.36, -0.004), el, b.bones);
        var hand = new Parts().box(0.1, 0.13, 0.055, P.bone2, 0, -0.065, 0).box(0.07, 0.06, 0.07, P.black, 0, -0.005, 0);
        for (f = 0; f < 4; f++) {
          var fx = (f - 1.5) * 0.026, a = (f - 1.5) * 0.2, dx = Math.sin(a), dy = -Math.cos(a);
          hand.chain(fx, -0.12, 0.01, [[dx, dy, 0.15, 0.15, 0.024, P.bone], [dx, dy, 0.5, 0.1, 0.019, P.bone2], [dx, dy, 0.9, 0.06, 0.014, P.tip]]);
        }
        hand.chain(-sd * 0.05, -0.05, 0.02, [[-sd * 0.6, -0.8, 0.4, 0.1, 0.022, P.bone], [-sd * 0.3, -0.8, 0.8, 0.05, 0.015, P.tip]]);
        put(hand, wr);
        var glow = new THREE.Mesh(b.glowGeo, b.glowMat); glow.position.set(0, -0.2, 0.03); wr.add(glow); b.hands.push(glow);
        b.arms.push(sh); b.elbows.push(el); b.wrists.push(wr);
        b.tendrils.push({ a: el, x: 0, y: -0.02, z: -0.065, n: 7, len: 0.36, th: 0.16, p0: 0.15, r0: sd * 0.45, ph: k * 1.7, f: 2.4 });
      }
      // ---- the head: a bone skull, black sockets, a slit of a mouth, a crest of spikes and two long horns
      b.head = pivot(0, HEAD_Y, 0);
      var hd = new Parts()
        .box(0.2, 0.24, 0.24, P.bone, 0, 0.14, 0).box(0.22, 0.05, 0.08, P.bone2, 0, 0.2, 0.095)
        .box(0.055, 0.036, 0.03, P.black, -0.05, 0.165, 0.122).box(0.055, 0.036, 0.03, P.black, 0.05, 0.165, 0.122)
        .box(0.14, 0.09, 0.1, P.bone2, 0, 0.06, 0.09).box(0.12, 0.014, 0.02, P.black, 0, 0.05, 0.141).box(0.11, 0.05, 0.1, P.bone3, 0, 0, 0.07)
        .box(0.026, 0.2, 0.2, P.crimson, -0.108, 0.1, -0.01).box(0.026, 0.2, 0.2, P.crimson, 0.108, 0.1, -0.01);
      CREST.forEach(function (c) { hd.along(c[0], c[1], c[2], CREST_DIR[0], CREST_DIR[1], CREST_DIR[2], c[3], 0.034, P.bone2); });
      for (k = 0; k < 2; k++) { var spk = spikes(k ? 1 : -1); hd.along(spk[0], spk[1], spk[2], spk[3], spk[4], spk[5], spk[6], spk[7], P.bone3); }
      put(hd, b.head);
      for (k = 0; k < 2; k++) {
        var hn = new Parts();
        hornChain(k ? 1 : -1).forEach(function (s, i) { hn.along(s.x, s.y, s.z, s.dx, s.dy, s.dz, s.len + 0.02, s.th, i === 3 ? P.bone3 : i % 2 ? P.bone2 : P.bone); });
        b.horns.push(put(hn, b.head));
      }
      // ---- the tendrils: thin red chains from the elbows, the back and the calves; one instanced mesh, posed every frame
      b.tendrils.push({ a: b.rig, x: -0.08, y: 2.0, z: -0.19, n: 8, len: 0.4, th: 0.16, p0: 0.4, r0: -0.4, ph: 0.9, f: 1.8 },
                      { a: b.rig, x: 0.08, y: 2.0, z: -0.19, n: 8, len: 0.4, th: 0.16, p0: 0.4, r0: 0.4, ph: 2.6, f: 1.9 });
      var nT = 0; b.tendrils.forEach(function (t) { nT += t.n; });
      b.tMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x7a0a1c }), nT);
      b.tMesh.frustumCulled = false;
      for (k = 0; k < nT; k++) { BC.setHex(k % 3 ? 0xff2a3c : 0xc0182c); b.tMesh.setColorAt(k, BC); }
      b.g.add(b.tMesh);
      for (var n in POSES.idle) { b.cur[n] = POSES.idle[n]; b.tgt[n] = POSES.idle[n]; }
      return b;
    }
    function setPose(name, rate) { if (!boss) return; boss.pose = name; boss.rate = rate || 6; var p = POSES[name]; for (var k in p) boss.tgt[k] = p[k]; }
    function applyPose(h, t) {
      var b = boss, c = b.cur, k = 1 - Math.exp(-b.rate * h), i;
      for (var n in c) c[n] += (b.tgt[n] - c[n]) * k;
      var drift = Math.sin(t * 1.3), bob = Math.sin(t * 1.9) * 0.04 + (b.pose === 'recover' ? Math.sin(t * 7) * 0.015 : 0);
      b.arms[0].rotation.set(c.lax + drift * 0.05, 0, c.laz - 0.03 * (1 + drift)); b.arms[1].rotation.set(c.rax - drift * 0.05, 0, c.raz + 0.03 * (1 + drift));
      b.elbows[0].rotation.x = c.lex; b.elbows[1].rotation.x = c.rex;
      b.wrists[0].rotation.x = b.wrists[1].rotation.x = c.wr + Math.sin(t * 2.3) * 0.08;          // the claws never quite stop moving
      for (i = 0; i < 2; i++) { b.hips[i].rotation.x = c.legs + drift * 0.025; b.knees[i].rotation.x = c.knee; }
      b.rig.rotation.x = c.lean - b.flinch * 0.15; b.rig.rotation.z = -b.side * b.glide * 0.14;   // he banks into a glide; he does not walk
      b.rig.position.y = (HOVER + c.bob + bob) * S;
      b.head.rotation.x = c.headx; b.head.rotation.y = Math.sin(t * 0.7) * 0.12;
      if (b.flinch > 0) b.flinch = Math.max(0, b.flinch - h * 3);
      // the plates: open while he is exposed (and for good once he is dying); the flesh behind them pulses
      var want = exposedNow() || phase === 'death' ? 1 : 0;
      b.open += (want - b.open) * (1 - Math.exp(-9 * h));
      for (i = 0; i < b.covers.length; i++) { var cv = b.covers[i]; cv.hinge.rotation[cv.axis] = cv.sign * cv.ang * b.open; cv.hinge.position.x = cv.x0 + cv.slide * b.open; }
      var pulse = 0.5 + 0.5 * Math.sin(t * 9);
      if (b.hitFlash > 0) { b.hitFlash -= h; b.patchMat.color.setHex(0xffffff); }
      else { var lit = 0.45 + 0.55 * b.open; b.patchMat.color.setRGB(lit, lerp(0.16, 0.42, pulse * b.open) * lit, lerp(0.36, 0.62, pulse * b.open) * lit); }   // dull while shut, hot to pale pink as it opens, never white
      b.haloMat.opacity = b.open * (0.25 + 0.3 * pulse);
      b.glowMat.opacity = b.charge || 0;
      b.g.position.set(b.x, b.y, b.z); b.g.rotation.y = b.yaw;
    }
    /* A cold key light that follows him: under the red dusk nothing else lets the bone read off-white. A narrow spot from
       eight units out, in front and above, so no wall he stands against is ever close to the source (a point light at arm's
       length blew white patches onto them). Added once, at start() (behind the card), and held at intensity 0 while he is
       away, so the scene's light count, and with it every material's shader program, never changes during the fight. */
    var KEY_I = 115, key = null;
    function keyStep() {
      var b = boss, k = key; if (!k) return;
      if (!b || !b.g.visible) { k.intensity = 0; return; }
      k.position.set(b.x + Math.sin(b.yaw) * 6.5, b.y + 8.5, b.z + Math.cos(b.yaw) * 6.5);
      k.target.position.set(b.x, b.y + 3.6, b.z);
      k.intensity = KEY_I * (1 - b.wild) * Math.min(1, b.g.scale.y);
    }
    /* The tendrils hang from their anchors under gravity rather than with them, trail behind a lean, sway on their own, and
       when he is coming apart (b.wild) they lengthen, thrash and rise like the flames. Needs current world matrices. */
    var TW = new THREE.Matrix4(), TI = new THREE.Matrix4(), TP = new THREE.Vector3(), TD = new THREE.Vector3(), TC = new THREE.Vector3(), TSC = new THREE.Vector3(), TQ = new THREE.Quaternion(), TE = new THREE.Euler();
    var TV = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
    function tendrilStep(t) {
      var b = boss, k = 0, i, j, c = b.cur;
      TI.copy(b.g.matrixWorld).invert();
      for (i = 0; i < b.tendrils.length; i++) {
        var tr = b.tendrils[i], L = tr.len * (1 + b.wild), pitch = tr.p0 + c.lean * 0.9 + b.wild * 2.6, roll = tr.r0 - b.side * b.glide * 0.35;
        TP.set(tr.x, tr.y, tr.z).applyMatrix4(tr.a.matrixWorld).applyMatrix4(TI);
        for (j = 0; j < tr.n; j++) {
          var w = Math.sin(t * tr.f * (1 + b.wild) + tr.ph - j * 0.75), amp = (0.1 + j * 0.06) * (1 + b.wild * 4), th = tr.th * (1 - 0.55 * j / tr.n);
          pitch += 0.1 + w * amp * 0.5; roll += w * amp * 0.35;
          TE.set(pitch, 0, roll); TQ.setFromEuler(TE); TD.set(0, -L, 0).applyQuaternion(TQ);
          if (TP.y + TD.y < 0.12) {                 // never through the ground (or his roof): the rest of the chain trails along it
            var hy = Math.min(0, 0.12 - TP.y), hl = Math.sqrt(Math.max(0, L * L - hy * hy)), hx = TD.x, hz = TD.z, hn = Math.hypot(hx, hz);
            if (hn < 1e-4) { hx = 0; hz = -1; hn = 1; }
            TD.set(hx / hn * hl, hy, hz / hn * hl); TQ.setFromUnitVectors(DOWN, TV.copy(TD).multiplyScalar(1 / L));
          }
          TC.copy(TP).addScaledVector(TD, 0.5); TSC.set(th, L * 1.08, th);
          TW.compose(TC, TQ, TSC); b.tMesh.setMatrixAt(k++, TW);
          TP.add(TD);
        }
      }
      b.tMesh.instanceMatrix.needsUpdate = true;
    }
    function disposeTree(o) {
      o.traverse(function (m) {
        if (m.geometry && m.geometry.dispose && !m.isSprite) m.geometry.dispose();
        if (m.material) { if (m.material.map && m.material.map.dispose) m.material.map.dispose(); if (m.material.dispose) m.material.dispose(); }
      });
    }
    function removeBoss() {
      if (!boss) return;
      if (boss.g.parent) boss.g.parent.remove(boss.g);
      disposeTree(boss.g); if (boss.haloTex) boss.haloTex.dispose(); if (boss.tMesh && boss.tMesh.dispose) boss.tMesh.dispose();
      boss = null;
    }
    /* He blocks the player, but he is NOT in api.colliders: the host tests every rebuttal by its end point against
       that list, and a 1.4-unit circle round him would swallow shots in the very frame they reach a thigh plate. We
       keep him solid ourselves by pushing the player out, and only while he is on the street and not dashing. */
    var solid = false;
    function setSolid(on) { solid = !!on; }
    function pushPlayerOut() {
      if (!solid || !boss || !boss.g.visible || self.cinematic) return;
      var p = api.player.position, dx = p.x - boss.x, dz = p.z - boss.z, d = Math.hypot(dx, dz);
      if (d >= COL_R) return;
      if (d < 1e-3) { dx = Math.sin(boss.yaw); dz = Math.cos(boss.yaw); d = 1; }
      var nx = boss.x + dx / d * COL_R, nz = boss.z + dz / d * COL_R;
      if (!api.collide(nx, nz, 0.5)) { p.x = nx; p.z = nz; }
    }
    // a building's sign floats exactly where a man perched on its roof would stand; it is hidden while he is up there
    var roofSign = null;
    function hideRoofSign(place) {
      showRoofSign();
      if (!place || !place.group) return;
      place.group.children.forEach(function (c) { if (c.isSprite && c.visible) { roofSign = c; c.visible = false; } });
    }
    function showRoofSign() { if (roofSign) { roofSign.visible = true; roofSign = null; } }

    /* ------------------------------------------------------------ particles: one unit box, a handful of shared materials */
    var FX = null;
    function fxInit() {
      function basic(c) { return new THREE.MeshBasicMaterial({ color: c, fog: false }); }
      FX = { geo: new THREE.BoxGeometry(1, 1, 1), pool: [], live: [], cap: 240, made: 0,
        mats: { dust: api.flat(0x8a7a66), smoke: api.flat(0x5a5560), soot: api.flat(0x2a262c), fire: basic(0xff8a2a), flame: basic(0xffe27a), ember: basic(0xff5a1a), spark: basic(0xfff2b0), gold: basic(0xfcd34d), red: basic(0xff3344), white: basic(0xffffff), paper: basic(0xf3ecd8), sinew: api.flat(0xa3182c), bone: api.flat(0xe0d8c6) } };
    }
    function fxSpawn(kind, x, y, z, vx, vy, vz, o) {
      if (!FX) return null;
      var p = FX.pool.pop();
      if (!p) {
        if (FX.made < FX.cap) { p = { m: new THREE.Mesh(FX.geo, FX.mats.dust) }; FX.made++; }
        else { p = FX.live.shift(); if (!p) return null; }
      }
      p.m.material = FX.mats[kind] || FX.mats.dust; p.m.position.set(x, y, z); p.m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      p.vx = vx; p.vy = vy; p.vz = vz; p.max = p.life = o.life || 1; p.s0 = o.s0 || 0.3; p.s1 = o.s1 === undefined ? p.s0 : o.s1; p.grav = o.grav || 0; p.drag = o.drag || 0; p.spin = o.spin || 2; p.thin = !!o.thin;
      fxScale(p, p.s0); if (!p.m.parent) scene.add(p.m); FX.live.push(p); return p;
    }
    function fxScale(p, s) { if (p.thin) p.m.scale.set(s * 0.14, s, s * 0.14); else p.m.scale.setScalar(s); }
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
        p.m.rotation.x += p.spin * h; p.m.rotation.y += p.spin * 0.7 * h; fxScale(p, Math.max(0.001, s));
      }
    }
    function fxKill() {
      if (!FX) return;
      FX.live.forEach(function (p) { scene.remove(p.m); }); FX.pool.forEach(function (p) { scene.remove(p.m); });
      FX.geo.dispose(); for (var k in FX.mats) FX.mats[k].dispose(); FX = null;
    }
    function flames(x, y, z, n, spd) { burst('fire', x, y, z, n, { spd: spd || 3, up: rand(6, 10), life: 0.6, s0: 0.45, s1: 0.05, drag: 1.2, jit: 0.5 }); burst('flame', x, y + 0.3, z, Math.ceil(n / 2), { spd: 2, up: 9, life: 0.45, s0: 0.3, s1: 0.04, jit: 0.4 }); }

    /* ------------------------------------------------------------ projectiles and fire: manuscripts, ground fire, rings, columns
       Everything that can hurt is sub-stepped in prjStep: a timescaled frame can be half a second long and nothing may
       tunnel through the player capsule. */
    var PRJ = null;
    function makeManuscriptTex() {
      var c = document.createElement('canvas'); c.width = 48; c.height = 64; var x = c.getContext('2d'), i;
      x.fillStyle = '#f3ecd8'; x.fillRect(0, 0, 48, 64);
      x.fillStyle = '#c9c2ae'; for (i = 0; i < 9; i++) x.fillRect(6, 9 + i * 6, i === 8 ? 20 : 36, 2);
      x.fillStyle = '#3a1a08';                                   // scorched edges
      for (i = 0; i < 14; i++) { x.fillRect(rand(-3, 44), rand(-3, 2), rand(2, 7), rand(2, 5)); x.fillRect(rand(-3, 44), 60 + rand(-2, 3), rand(2, 7), rand(2, 5)); x.fillRect(rand(-2, 2), rand(0, 60), rand(1, 4), rand(2, 6)); x.fillRect(45 + rand(-2, 2), rand(0, 60), rand(1, 4), rand(2, 6)); }
      x.save(); x.translate(24, 36); x.rotate(-0.3); x.strokeStyle = '#e0192c'; x.lineWidth = 2; x.strokeRect(-19, -8, 38, 16);
      x.fillStyle = '#e0192c'; x.font = '6px ' + FONT; x.textAlign = 'center'; x.fillText('MAJOR', 0, -1); x.fillText('REVS', 0, 6); x.restore();
      var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t;
    }
    function prjInit() {
      if (PRJ) return;
      PRJ = {
        ms: [], msPool: [], msMade: 0, msCap: 16, sweeps: [], rings: [], strips: [], columns: [], scorch: [], flamePool: [], flameMade: 0, flameCap: 60, desp: null,
        tex: makeManuscriptTex(),
        paperGeo: new THREE.BoxGeometry(0.64, 0.86, 0.12), glowGeo: new THREE.BoxGeometry(1.0, 1.25, 0.5), flameGeo: new THREE.BoxGeometry(1, 1, 1),
        ringGeo: new THREE.RingGeometry(0.9, 1.0, 44), wallGeo: new THREE.CylinderGeometry(1, 1, 1, 44, 1, true),
        scorchGeo: new THREE.CircleGeometry(1.3, 14), stripGeo: new THREE.BoxGeometry(1, 1, 1), colGeo: new THREE.CylinderGeometry(0.5, 1.4, 1, 14, 1, true)
      };
      PRJ.paperMat = new THREE.MeshBasicMaterial({ map: PRJ.tex, fog: false });
      PRJ.glowMat = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      PRJ.flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      PRJ.ringMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false });
      PRJ.scorchMat = new THREE.MeshBasicMaterial({ color: 0x1a0806, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, fog: false });
      PRJ.stripMat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
      PRJ.colMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      PRJ.despMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    }
    function flameGet() {
      if (!PRJ) return null;
      var m = PRJ.flamePool.pop();
      if (!m) { if (PRJ.flameMade >= PRJ.flameCap) return null; m = new THREE.Mesh(PRJ.flameGeo, PRJ.flameMat); PRJ.flameMade++; }
      if (!m.parent) scene.add(m); return m;
    }
    function flameFree(m) { if (!m) return; if (m.parent) m.parent.remove(m); PRJ.flamePool.push(m); }
    function flameFlick(m, x, y, z, s, t, k) {
      m.position.set(x, y + Math.abs(Math.sin(t * 13 + k)) * s * 0.4, z);
      m.scale.set(s * (0.6 + 0.4 * Math.abs(Math.sin(t * 17 + k * 2))), s * (1.2 + Math.abs(Math.sin(t * 11 + k))), s * 0.6);
      m.rotation.y = t * 3 + k;
    }
    // manuscripts: a burning paper that homes for a while, then commits to a line
    function msGet() {
      var p = PRJ.msPool.pop();
      if (!p) {
        if (PRJ.msMade >= PRJ.msCap) { p = PRJ.ms.shift(); if (!p) return null; }
        else {
          var g = new THREE.Group(), body = new THREE.Mesh(PRJ.paperGeo, PRJ.paperMat), glow = new THREE.Mesh(PRJ.glowGeo, PRJ.glowMat);
          g.add(body); g.add(glow); PRJ.msMade++; p = { g: g, body: body, glow: glow };
        }
      }
      if (!p.g.parent) scene.add(p.g);
      PRJ.ms.push(p); return p;
    }
    function msFree(p, i) {
      if (i === undefined) i = PRJ.ms.indexOf(p);
      if (i >= 0) PRJ.ms.splice(i, 1);
      if (p.g.parent) p.g.parent.remove(p.g);
      PRJ.msPool.push(p);
    }
    function throwManuscript(x, y, z, speed, turn, homeT) {
      var p = msGet(); if (!p) return;
      var pp = api.player.position, tx = pp.x, ty = pp.y + 1.4, tz = pp.z;
      var dx = tx - x, dy = ty - y, dz = tz - z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      p.vx = dx / L * speed; p.vy = dy / L * speed; p.vz = dz / L * speed; p.spd = speed; p.turn = turn; p.homeT = homeT; p.life = 4.5; p.hp = 1; p.r = 0.62; p.hurtR = 0.5; p.spin = rand(5, 9); p.trail = 0;
      p.g.position.set(x, y, z); p.g.rotation.set(0, 0, 0); p.passed = false;
      SFX.launch(x, y, z);
    }
    function msPop(p, shot) {
      var pos = p.g.position;
      burst('ember', pos.x, pos.y, pos.z, shot ? 12 : 6, { spd: 7, up: 5, life: 0.7, s0: 0.22, s1: 0.03, grav: 9 });
      burst('paper', pos.x, pos.y, pos.z, shot ? 8 : 3, { spd: 5, up: 4, life: 0.8, s0: 0.2, s1: 0.06, grav: 6, drag: 1.5 });
      if (shot) fxSpawn('white', pos.x, pos.y, pos.z, 0, 0, 0, { life: 0.14, s0: 0.6, s1: 2.6 });
      SFX.pop(pos.x, pos.y, pos.z);
    }
    // ground fire: a front of flame sweeping along a line, dropping scorch marks behind it
    function startSweep(x0, z0, dx, dz, w, len, spd) {
      var sw = { x0: x0, z0: z0, dx: dx, dz: dz, w: w, len: len, s: 0, spd: spd, hit: false, flames: [], trail: 0, k: rand(0, 6), snd: null, sp: { x: x0, y: 0.5, z: z0 }, sndT: 0 };
      for (var i = 0; i < 9; i++) { var m = flameGet(); if (m) sw.flames.push(m); }
      PRJ.sweeps.push(sw);
      SFX.slam(x0, z0); sw.snd = SFX.roar(len / spd + 0.4, x0, z0);
    }
    function sweepKill(sw, cut) { sw.flames.forEach(flameFree); sw.flames.length = 0; if (cut && sw.snd) sw.snd.stop(0.3); sw.snd = null; }   // run to its end, the roar dies on its own tail
    function addStrip(x0, z0, x1, z1, w, dur) {
      var m = new THREE.Mesh(PRJ.stripGeo, PRJ.stripMat), L = Math.hypot(x1 - x0, z1 - z0) || 1;
      m.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2); m.rotation.y = Math.atan2(x1 - x0, z1 - z0); m.scale.set(w, 0.02, L); scene.add(m);
      PRJ.strips.push({ m: m, t: 0, dur: dur });
    }
    function addScorch(x, z, s) {
      var m = new THREE.Mesh(PRJ.scorchGeo, PRJ.scorchMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.055, z); m.scale.setScalar(s || rand(0.8, 1.3)); scene.add(m);
      PRJ.scorch.push({ m: m, t: 0 });
      if (PRJ.scorch.length > 40) { var o = PRJ.scorch.shift(); scene.remove(o.m); }
    }
    // a ring of flame on the ground: the teleport's destination mark, or a blast
    function addRing(x, z, r0, speed, max, dur, y) {
      var mat = PRJ.ringMat.clone(), m = new THREE.Mesh(PRJ.ringGeo, mat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, (y || 0) + 0.09, z); m.scale.setScalar(r0); scene.add(m);
      var ring = { m: m, mat: mat, x: x, z: z, r: r0, v: speed, max: max, t: 0, dur: dur || 9 };
      PRJ.rings.push(ring); return ring;
    }
    // a column of flame: the arrival, every teleport, and the way he leaves for good
    function addColumn(x, y, z, h, dur, big) {
      var m = new THREE.Mesh(PRJ.colGeo, PRJ.colMat);
      m.position.set(x, y + h / 2, z); m.scale.set(big ? 2.2 : 1.3, h, big ? 2.2 : 1.3); scene.add(m);
      PRJ.columns.push({ m: m, t: 0, dur: dur, x: x, y: y, z: z, h: h, big: !!big });
      flames(x, y + 0.3, z, big ? 18 : 8, big ? 6 : 3);
    }
    // the desperation: a ring of fire round the player that closes until he takes a weak hit
    function despStart(x, z) {
      if (PRJ.desp) despKill();
      var m = new THREE.Mesh(PRJ.ringGeo, PRJ.despMat), wall = new THREE.Mesh(PRJ.wallGeo, PRJ.despMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.09, z); scene.add(m);
      wall.position.set(x, 0.7, z); scene.add(wall);
      var d = { x: x, z: z, r: 7.5, m: m, wall: wall, flames: [], t: 0, minT: 0, hum: null, dead: false, dispelled: false };
      for (var i = 0; i < 14; i++) { var f = flameGet(); if (f) d.flames.push(f); }
      PRJ.desp = d;
      addRing(x, z, 7.5, 6, 11, 0.8); SFX.column(0.8, x, 0, z);
      d.hum = SFX.hum(null, 0);                  // after the column's burst, which the ring's fire then carries on from
    }
    function despKill(fade) {                    // dispelled or cleared: a quick stop; burnt out on its own, it dies down
      var d = PRJ && PRJ.desp; if (!d) return;
      scene.remove(d.m); scene.remove(d.wall); d.flames.forEach(flameFree); SFX.hush(d.hum, fade == null ? 0.3 : fade); PRJ.desp = null;
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
    function prjSub(h, live) {
      var i, p, pos, pp = api.player.position;
      for (i = PRJ.ms.length - 1; i >= 0; i--) {
        p = PRJ.ms[i]; pos = p.g.position;
        p.life -= h;
        if (p.homeT > 0) {                       // homing: bend the velocity toward the chest, at most `turn` rad/s
          p.homeT -= h;
          var tx = pp.x - pos.x, ty = pp.y + 1.4 - pos.y, tz = pp.z - pos.z, L = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
          var k = Math.min(1, p.turn * h); p.vx += (tx / L * p.spd - p.vx) * k; p.vy += (ty / L * p.spd - p.vy) * k; p.vz += (tz / L * p.spd - p.vz) * k;
          var vl = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz) || 1; p.vx *= p.spd / vl; p.vy *= p.spd / vl; p.vz *= p.spd / vl;
        }
        pos.x += p.vx * h; pos.y += p.vy * h; pos.z += p.vz * h;
        p.g.rotation.x += p.spin * h; p.g.rotation.y += p.spin * 0.7 * h;
        p.trail += h; if (p.trail > 0.06) { p.trail = 0; fxSpawn(Math.random() < 0.5 ? 'ember' : 'fire', pos.x, pos.y, pos.z, rand(-1, 1), rand(1, 3), rand(-1, 1), { life: 0.4, s0: 0.22, s1: 0.03 }); }
        if (live && !p.passed) {                  // past your ear: the whoosh of a near miss, from the side it went by
          var ex = pp.x - pos.x, ey = pp.y + 1.6 - pos.y, ez = pp.z - pos.z;
          if (ex * ex + ey * ey + ez * ez < 10 && ex * p.vx + ey * p.vy + ez * p.vz < 0) { p.passed = true; SFX.flyby(pos.x, pos.y, pos.z); }
        }
        if (live && hitsPlayer(pos.x, pos.y, pos.z, p.hurtR)) { hitPlayer(pos.x, pos.y, pos.z); msPop(p, false); msFree(p, i); continue; }
        if (pos.y <= 0.2) { addScorch(pos.x, pos.z, 0.6); msPop(p, false); msFree(p, i); continue; }
        if (p.life <= 0 || Math.abs(pos.x) > api.WORLD + 6 || Math.abs(pos.z) > api.WORLD + 6 || pos.y > 60) { msFree(p, i); continue; }
      }
      for (i = PRJ.sweeps.length - 1; i >= 0; i--) {
        var sw = PRJ.sweeps[i]; sw.s += sw.spd * h;
        if (live && !sw.hit) {
          var ax = pp.x - sw.x0, az = pp.z - sw.z0, along = ax * sw.dx + az * sw.dz, perp = Math.abs(ax * sw.dz - az * sw.dx);
          if (Math.abs(along - sw.s) < 1.0 && perp < sw.w / 2 && pp.y < 0.9) { sw.hit = true; hitPlayer(pp.x, pp.y + 0.8, pp.z); }
        }
        if (sw.s >= sw.len) { sweepKill(sw); PRJ.sweeps.splice(i, 1); }
      }
      var d = PRJ.desp;
      if (d && !d.dead) {
        d.t += h;
        if (d.r > 1.5) d.r = Math.max(1.5, d.r - 0.75 * h); else d.minT += h;
        if (live) { var dd = Math.hypot(pp.x - d.x, pp.z - d.z); if (Math.abs(dd - d.r) < 0.85 && pp.y < 1.0) hitPlayer(pp.x, pp.y + 0.8, pp.z); }
        if (d.minT > 3.5) { d.dead = true; }
      }
    }
    function prjStep(dt, live) {
      if (!PRJ) return;
      var left = dt, n = 0, i, k;
      while (left > 1e-4 && n < 40) { var h = left > 0.025 ? 0.025 : left; prjSub(h, live); left -= h; n++; }
      var t = total;
      // sweeps: flames ride the front, scorch trails behind
      for (i = 0; i < PRJ.sweeps.length; i++) {
        var sw = PRJ.sweeps[i], fx = sw.x0 + sw.dx * sw.s, fz = sw.z0 + sw.dz * sw.s, px = sw.dz, pz = -sw.dx;
        for (k = 0; k < sw.flames.length; k++) { var off = (k / (sw.flames.length - 1) - 0.5) * sw.w; flameFlick(sw.flames[k], fx + px * off, 0.1, fz + pz * off, 1.1, t, sw.k + k); }
        sw.trail += dt; if (sw.trail > 0.12) { sw.trail = 0; addScorch(fx + rand(-sw.w / 2, sw.w / 2) * px, fz + rand(-sw.w / 2, sw.w / 2) * pz, rand(0.5, 0.9)); flames(fx + rand(-1, 1) * sw.w / 2 * px, 0.2, fz + rand(-1, 1) * sw.w / 2 * pz, 2, 2); SFX.crackle(at(fx, 0.3, fz)); }
        // its roar follows the front (and the camera's turn) twenty times a second, and is let go once its voice has ended
        if (sw.snd && (sw.sndT -= dt) <= 0) { sw.sndT = 0.05; if (sw.snd.playing()) { sw.sp.x = fx; sw.sp.z = fz; sw.snd.place(sw.sp, camera); } else sw.snd = null; }
      }
      for (i = PRJ.rings.length - 1; i >= 0; i--) {
        var g = PRJ.rings[i]; g.t += dt; g.r += g.v * dt; g.m.scale.setScalar(g.r);
        g.mat.opacity = 0.9 * clamp(1 - g.r / g.max, 0, 1) * (Math.floor(g.t * 12) % 2 ? 0.6 : 1);
        if (g.r >= g.max || g.t >= g.dur) { scene.remove(g.m); g.mat.dispose(); PRJ.rings.splice(i, 1); }
      }
      for (i = PRJ.strips.length - 1; i >= 0; i--) {
        var st = PRJ.strips[i]; st.t += dt;
        st.m.material = PRJ.stripMat; PRJ.stripMat.opacity = 0.35 + 0.35 * Math.abs(Math.sin(t * 14));
        if (st.t >= st.dur) { scene.remove(st.m); PRJ.strips.splice(i, 1); }
      }
      for (i = PRJ.columns.length - 1; i >= 0; i--) {
        var c = PRJ.columns[i]; c.t += dt; var ck = c.t / c.dur;
        var sc = (c.big ? 2.2 : 1.3) * (ck < 0.2 ? ck / 0.2 : 1) * (1 + Math.sin(t * 19) * 0.15);
        c.m.scale.set(sc, c.h * (ck < 0.15 ? ck / 0.15 : 1) * (1 - ck * 0.4), sc); c.m.position.y = c.y + c.m.scale.y / 2; c.m.rotation.y += dt * 4;
        c.m.material.opacity = 0.55 * (1 - ck * ck);
        if (Math.random() < dt * (c.big ? 30 : 14)) flames(c.x + rand(-1, 1) * sc * 0.5, c.y + rand(0, c.h * 0.5), c.z + rand(-1, 1) * sc * 0.5, 2, 2);
        if (ck >= 1) { scene.remove(c.m); PRJ.columns.splice(i, 1); }
      }
      for (i = PRJ.scorch.length - 1; i >= 0; i--) {
        var s2 = PRJ.scorch[i]; s2.t += dt;
        if (s2.t > 8) { scene.remove(s2.m); PRJ.scorch.splice(i, 1); } else s2.m.material.opacity = 0.85 * clamp((8 - s2.t) / 3, 0, 1);
      }
      var d = PRJ.desp;
      if (d) {
        if (d.dead) { despKill(d.dispelled ? 0.3 : 1.2); }
        else {
          d.m.scale.setScalar(d.r); d.wall.scale.set(d.r, 1.4, d.r);
          PRJ.despMat.opacity = 0.55 + 0.3 * Math.abs(Math.sin(t * 9));
          for (k = 0; k < d.flames.length; k++) { var a = k / d.flames.length * 6.283 + t * 0.6; flameFlick(d.flames[k], d.x + Math.cos(a) * d.r, 0.1, d.z + Math.sin(a) * d.r, 1.3, t, k); }
          if (Math.random() < dt * 8) { var a2 = rand(0, 6.283); flames(d.x + Math.cos(a2) * d.r, 0.2, d.z + Math.sin(a2) * d.r, 2, 2); }
          if (Math.random() < dt * 3) SFX.crackle({ pan: rand(-0.7, 0.7) });
          d.hum = SFX.hum(d.hum, (7.5 - d.r) / 6);
        }
      }
    }
    function prjClear() {          // everything that can still hurt: manuscripts, fire fronts, the desperation ring
      if (!PRJ) return;
      for (var i = PRJ.ms.length - 1; i >= 0; i--) msFree(PRJ.ms[i], i);
      PRJ.sweeps.forEach(function (sw) { sweepKill(sw, true); }); PRJ.sweeps.length = 0;
      PRJ.strips.forEach(function (s) { scene.remove(s.m); }); PRJ.strips.length = 0;
      despKill();
    }
    function prjKill() {
      if (!PRJ) return;
      prjClear();
      PRJ.rings.forEach(function (g) { scene.remove(g.m); g.mat.dispose(); }); PRJ.rings.length = 0;
      PRJ.columns.forEach(function (c) { scene.remove(c.m); }); PRJ.columns.length = 0;
      PRJ.scorch.forEach(function (s) { scene.remove(s.m); }); PRJ.scorch.length = 0;
      PRJ.msPool.forEach(function (p) { if (p.g.parent) p.g.parent.remove(p.g); });
      PRJ.flamePool.forEach(function (m) { if (m.parent) m.parent.remove(m); });
      ['paperGeo', 'glowGeo', 'flameGeo', 'ringGeo', 'wallGeo', 'scorchGeo', 'stripGeo', 'colGeo'].forEach(function (k) { if (PRJ[k]) PRJ[k].dispose(); });
      ['paperMat', 'glowMat', 'flameMat', 'ringMat', 'scorchMat', 'stripMat', 'colMat', 'despMat'].forEach(function (k) { if (PRJ[k]) PRJ[k].dispose(); });
      if (PRJ.tex) PRJ.tex.dispose();
      PRJ = null;
    }

    /* ------------------------------------------------------------ sequencer state, skipping */
    var phase = '', pT = 0, total = 0, maxHp = 100, fired = false, env = null, musicOn = false, F = null, out = null;
    function music(name) { musicOn = (name !== 'silence'); say('music', name); }
    function setPhase(name) { phase = name; pT = 0; guard(function () { enterPhase(name); }); }
    function canSkip() { return self.active && pT >= 1.0 && (phase === 'card' || phase === 'outro'); }
    function onSkip(e) {
      if (!canSkip()) return;
      if (e && e.preventDefault) e.preventDefault();
      if (phase === 'card') { closeCard(); SFX.ui('ui.confirm'); setPhase('omen'); return; }
      if (phase === 'outro' && out && !out.skipped && out.c < OUT_FLASH) { skipOutro(); SFX.ui('ui.confirm'); }
    }
    function onSkipKey(e) {
      if (!e || e.repeat) return;
      if (e.code !== 'KeyF' && e.code !== 'Space' && e.code !== 'Enter') return;
      if (!canSkip()) return;
      e.stopPropagation(); onSkip(e);
    }
    function bossSay(text) {
      if (narrowView()) { sayShow(text); return; }          // on a phone the host dialog would lie over the d-pad and A/B
      guard(function () { api.notice({ title: NAME, text: text, voice: HISS }); });
    }
    function dlgUp() { return !!(dom.dlg && !dom.dlg.hidden); }

    /* ------------------------------------------------------------ the fight: fast, telegraphed, three phases
       He is only open (rib plates parted, hip flaps lifted, the flesh glowing) while he winds up a throw or a fire line,
       for 1.5 s after a dash, and for a moment whenever one of his manuscripts is shot down. The rest of the time the
       bone is shut over it, and the count does not move. */
    var PH = [
      null,
      { idle: 1.3, wind: 0.75, msN: 4, volleys: 1, msGap: 0.28, msSpd: 15, msTurn: 1.4, msHome: 1.6, rec: 1.5, teleGap: 0.5, dashN: 1, dashSpd: 30, roofP: 0.35, strafe: 2.6, lineSpd: 10, teleP: 0.55, tauntGap: 14 },
      { idle: 0.9, wind: 0.68, msN: 4, volleys: 2, msGap: 0.22, msSpd: 17, msTurn: 1.8, msHome: 1.7, rec: 1.45, teleGap: 0.4, dashN: 2, dashSpd: 34, roofP: 0.3, strafe: 3.4, lineSpd: 12, teleP: 0.75, tauntGap: 12 },
      { idle: 0.7, wind: 0.65, msN: 4, volleys: 2, msGap: 0.2, msSpd: 18, msTurn: 2.0, msHome: 1.8, rec: 1.4, teleGap: 0.35, dashN: 3, dashSpd: 36, roofP: 0.25, strafe: 3.8, lineSpd: 13, teleP: 0.8, tauntGap: 11 }
    ];
    var ATTACK_CAP = {
      volley: ['MAJOR REVISIONS', 'shoot them down or step aside'],
      dash: ['DESK REJECT', 'sidestep, or jump the slide'],
      line: ['REVIEWER 3 CONCURS', 'jump the fire']
    };
    var BODY_LINES = ['NO EFFECT. THE REVIEW IS ANONYMOUS.', 'PLATED. HE OPENS AFTER A DASH AND WHILE HE WINDS UP.', 'SHOOT A MANUSCRIPT DOWN: THAT OPENS HIM TOO.'];
    var PLATE_LINES = ['THE PLATE HOLDS. WAIT FOR THE GLOW.', 'CONFLICTS OF INTEREST ONLY COUNT WHILE EXPOSED.'];
    var TAUNTS = [
      'MINOR REVISIONS. FORTY-TWO OF THEM.', 'I WAS NOT ANONYMOUS. I WAS ABSENT.', 'THE NOVELTY IS UNCLEAR. SO IS MY IDENTITY.',
      'I WOULD HAVE DONE IT DIFFERENTLY. I WOULD NOT HAVE DONE IT.', 'A THIRD REVIEWER HAS BEEN CONSULTED. HE IS ALSO ME.',
      'REJECT. ALSO, IT IS VERY GOOD.', 'I HAVE SOME SMALL CONCERNS. THEY ARE ON PAGES ONE TO FORTY.', 'SPRAY AND PRAY IS NOT A METHOD.',
      'PLEASE ADDRESS THE POINT I HAVE NOT MADE.', 'THE FIGURES ARE FINE. REMOVE THEM.'
    ];
    function fightInit() {
      F = { mode: 'idle', t: 0, dur: 0.8, atk: '', last: '', phase: 1, where: 'street', place: null, lastPlace: null, attacksHere: 0,
            exposeT: 0, sched: [], step: 0, bodyHits: 0, weakHits: 0, plateHits: 0, taught: 0, plateTaught: 0, msTaught: false,
            chain: 0, seen: (typeof WeakSet === 'function') ? new WeakSet() : null, nShots: 0, hits: 0,
            ghost: 1, hitFlash: 0, strafeDir: 1, strafeT: 0, tauntT: 6, ann: -9, dash: null, tele: null, despT: -1 };
    }
    function phaseFor(hp) { var k = hp / maxHp; return k <= 0.2 ? 3 : k <= 0.5 ? 2 : 1; }
    function exposedNow() { return !!(F && boss && boss.g.visible && phase === 'fight' && F.mode !== 'tele' && F.exposeT > 0); }
    function expose(s) { if (F) F.exposeT = Math.max(F.exposeT, s); }
    function facePlayer(h, rate) {
      var p = api.player.position, want = Math.atan2(p.x - boss.x, p.z - boss.z);
      boss.yaw += clamp(angDiff(want, boss.yaw), -rate * h, rate * h);
    }
    function roofY(p) { return p.h * 1.45 + 0.02; }
    /* Where to go next. Rooftops are the buildings' pyramid peaks (api.places), street spots a ring round the player,
       always clear of every collider and inside the arena; he never lands closer than six units to the player. */
    function pickSpot(kind) {
      var p = api.player.position, i, x, z, a, r, best = null;
      if (kind === 'roof') {
        var cands = (api.places || []).filter(function (pl) { var d = Math.hypot(pl.x - p.x, pl.z - p.z); return pl.group && pl !== F.lastPlace && d > 8 && d < 30 && Math.hypot(pl.x, pl.z) < ARENA_R - 2; });
        if (!cands.length) cands = (api.places || []).filter(function (pl) { return pl.group && pl !== F.lastPlace; });
        if (cands.length) { var pl = pick(cands); return { x: pl.x, y: roofY(pl), z: pl.z, where: 'roof', place: pl }; }
      }
      var base = boss ? Math.atan2(boss.x - p.x, boss.z - p.z) : rand(0, 6.283);
      for (i = 0; i < 18; i++) {
        a = base + (Math.random() < 0.5 ? 1 : -1) * rand(0.7, 2.4); r = rand(9, 14);
        x = p.x + Math.sin(a) * r; z = p.z + Math.cos(a) * r;
        if (Math.hypot(x, z) > ARENA_R - 4) continue;
        if (api.collide(x, z, 1.5)) continue;
        best = { x: x, y: 0, z: z, where: 'street', place: null }; break;
      }
      if (!best) {
        var s = null; guard(function () { s = api.safeSpot(p.x + Math.sin(base) * 11, p.z + Math.cos(base) * 11); });
        best = { x: s ? s.x : p.x + 11, y: 0, z: s ? s.z : p.z, where: 'street', place: null };
      }
      return best;
    }
    function placeBoss(spot) {
      boss.x = spot.x; boss.y = spot.y; boss.z = spot.z; F.where = spot.where; F.place = spot.place || null; F.attacksHere = 0;
      if (spot.where === 'roof') { F.lastPlace = spot.place; hideRoofSign(spot.place); } else showRoofSign();
      setSolid(spot.where === 'street');
      boss.yaw = Math.atan2(api.player.position.x - boss.x, api.player.position.z - boss.z);
      boss.g.position.set(boss.x, boss.y, boss.z); boss.g.rotation.y = boss.yaw;
      setPose(spot.where === 'roof' ? 'perch' : 'idle', 8);
    }
    function startTeleport(kind) {
      var P = PH[F.phase];
      F.mode = 'tele'; F.t = 0; F.exposeT = 0;
      F.tele = { stage: 'vanish', t: 0, gap: P.teleGap, spot: pickSpot(kind || (Math.random() < P.roofP ? 'roof' : 'street')), marked: false };
      setSolid(false); SFX.whoosh();
      addColumn(boss.x, boss.y, boss.z, 5.5, 0.6, false);
      burst('sinew', boss.x, boss.y + 3, boss.z, 7, { spd: 4, up: 3, life: 0.7, s0: 0.7, s1: 0.1, drag: 1.5, jit: 0.6, thin: true });
    }
    function teleStep(h) {
      var T = F.tele; T.t += h;
      if (T.stage === 'vanish') {
        boss.g.scale.y = Math.max(0.001, 1 - T.t / 0.3); boss.g.scale.x = boss.g.scale.z = 1 + T.t * 0.5;
        if (T.t >= 0.3) { T.stage = 'gone'; T.t = 0; boss.g.visible = false; boss.g.scale.set(1, 1, 1); showRoofSign(); }
        return;
      }
      if (T.stage === 'gone') {
        if (!T.marked && T.t >= T.gap) { T.marked = true; addRing(T.spot.x, T.spot.z, 2.2, 0, 99, 0.55, T.spot.y); flames(T.spot.x, T.spot.y + 0.2, T.spot.z, 6, 2); SFX.hiss(0.5, T.spot.x, T.spot.y + 3.4, T.spot.z); if (T.spot.where === 'roof') hideRoofSign(T.spot.place); }
        if (T.t >= T.gap + 0.5) {
          T.stage = 'appear'; T.t = 0;
          placeBoss(T.spot); boss.g.visible = true; boss.g.scale.set(1, 0.001, 1);
          addColumn(boss.x, boss.y, boss.z, 6, 0.55, false); SFX.appear(); SFX.crackle(him());
        }
        return;
      }
      boss.g.scale.y = Math.min(1, T.t / 0.25);
      if (T.t >= 0.25) {
        boss.g.scale.set(1, 1, 1); F.tele = null;
        F.mode = 'idle'; F.t = 0; F.dur = PH[F.phase].idle * rand(0.6, 1.0);
      }
    }
    function chooseAttack() {
      var bag;
      if (F.where === 'roof') bag = ['volley', 'line', 'volley'];
      else if (F.phase === 1) bag = ['volley', 'dash', 'line', 'volley', 'dash'];
      else bag = ['volley', 'dash', 'dash', 'line', 'volley', 'dash'];
      var i = Math.floor(Math.random() * bag.length) % bag.length, p = bag[i];
      if (p === F.last && Math.random() < 0.7) p = bag[(i + 1) % bag.length];
      return p;
    }
    function startAttack(name) {
      var P = PH[F.phase];
      F.atk = name; F.last = name; F.mode = 'windup'; F.t = 0; F.dur = Math.max(0.6, P.wind); F.step = 0; F.sched.length = 0; F.attacksHere++;
      var cap = ATTACK_CAP[name]; if (cap) showCap(cap[0], cap[1]);
      if (name === 'dash' && !dashOk()) { name = 'volley'; F.atk = F.last = name; cap = ATTACK_CAP[name]; showCap(cap[0], cap[1]); }
      if (name === 'dash') {
        F.mode = 'dash'; F.dash = { stage: 'crouch', t: 0, n: 0, hit: false, dx: 0, dz: 0, left: 0 };
        dashAim(0.75);
        return;
      }
      expose(F.dur + 0.12);                       // the wind-up is the opening
      SFX.hiss(F.dur);
      if (name === 'volley') setPose('windup', 7);
      else {
        setPose('slam', 5);
        var o = lineOrigin(), p = api.player.position, dx = p.x - o.x, dz = p.z - o.z, L = Math.hypot(dx, dz) || 1;
        F.line = { x0: o.x, z0: o.z, dx: dx / L, dz: dz / L, len: clamp(L + 12, 20, 36) };
        addStrip(o.x, o.z, o.x + F.line.dx * F.line.len, o.z + F.line.dz * F.line.len, 6.5, F.dur + 0.2);
      }
    }
    function lineOrigin() {                     // the fire starts under him, or at the foot of his building
      if (F.where !== 'roof' || !F.place) return { x: boss.x, z: boss.z };
      var pl = F.place, p = api.player.position, dx = p.x - pl.x, dz = p.z - pl.z, L = Math.hypot(dx, dz) || 1, R = Math.max(pl.w, pl.d) / 2 + 1.5;
      return { x: pl.x + dx / L * R, z: pl.z + dz / L * R };
    }
    /* The slide goes through lamp posts, bushes and trees (he is not entirely a man) and stops only for a
       building, the fountain or the arena edge, so a telegraphed line is a line he will actually travel. */
    function inBox(c, x, z, pad) {                     // a host box collider, turned by c.yaw (the buildings face the fountain)
      var dx = x - c.x, dz = z - c.z, s, cs;
      if (c.yaw) { s = Math.sin(c.yaw); cs = Math.cos(c.yaw); var lx = dx * cs - dz * s; dz = dx * s + dz * cs; dx = lx; }
      return Math.abs(dx) < c.hw + pad && Math.abs(dz) < c.hd + pad;
    }
    function dashBlocked(x, z) {
      if (Math.hypot(x, z) > ARENA_R - 1) return true;
      for (var i = 0; i < api.colliders.length; i++) {
        var c = api.colliders[i];
        if (c.r !== undefined) { if (c.r >= 2 && Math.hypot(x - c.x, z - c.z) < c.r + 1.0) return true; }
        else if (inBox(c, x, z, 1.0)) return true;
      }
      return false;
    }
    /* Is the straight line to the player free of buildings, with room to slide at least four units past him? A run cut
       short just behind you would spend the opening with his pelvis in your face; he throws instead. */
    function dashOk() {
      var p = api.player.position, dx = p.x - boss.x, dz = p.z - boss.z, L = Math.hypot(dx, dz) || 1, n = Math.ceil(L / 0.8), i;
      for (i = 1; i <= n; i++) { var k = i / n; if (dashBlocked(boss.x + dx * k, boss.z + dz * k)) return false; }
      return clearRun(dx / L, dz / L, L + 4) >= L + 3.9;
    }
    function clearRun(dx, dz, max) {            // how far he can slide along (dx, dz) before something stops him
      for (var s = 0.8; s <= max; s += 0.8) if (dashBlocked(boss.x + dx * s, boss.z + dz * s)) return s - 0.8;
      return max;
    }
    function dashAim(crouch) {                  // through the player and on past; the strip shows exactly the run he will make
      var D = F.dash, p = api.player.position, dx = p.x - boss.x, dz = p.z - boss.z, L = Math.hypot(dx, dz) || 1;
      D.dx = dx / L; D.dz = dz / L; D.stage = 'crouch'; D.t = 0; D.dur = crouch; D.hit = false;
      D.left = Math.max(2, clearRun(D.dx, D.dz, clamp(L + 7, 12, 30)));
      setPose('crouch', 9); SFX.crouch(crouch);
      addStrip(boss.x, boss.z, boss.x + D.dx * D.left, boss.z + D.dz * D.left, 1.6, crouch + 0.1);
    }
    function dashStep(h) {
      var D = F.dash, P = PH[F.phase], p = api.player.position;
      D.t += h;
      if (D.stage === 'crouch') {
        facePlayer(h, 4);
        if (D.t >= D.dur) { D.stage = 'run'; D.t = 0; setPose('dash', 14); SFX.dash(); setSolid(false); burst('dust', boss.x, 0.3, boss.z, 6, { spd: 5, up: 3, life: 0.8, s0: 0.5, s1: 1.6, drag: 2 }); }
        return;
      }
      if (D.stage === 'run') {
        var left = h, n = 0;
        while (left > 1e-4 && D.stage === 'run' && n < 40) {
          var s = Math.min(left, 0.02), step = Math.min(D.left, P.dashSpd * s), nx = boss.x + D.dx * step, nz = boss.z + D.dz * step;
          left -= s; n++;
          if (dashBlocked(nx, nz)) { D.left = 0; F.dashEnd = 'blocked'; burst('spark', boss.x, 1.5, boss.z, 8, { spd: 8, up: 5, life: 0.4, s0: 0.2, s1: 0.03, grav: 18 }); SFX.plate(boss.x, 1.5, boss.z, { variant: 0 }); }
          else { boss.x = nx; boss.z = nz; D.left -= step; }
          if (!D.hit && Math.hypot(p.x - boss.x, p.z - boss.z) < 1.6 && p.y < 1.25) { D.hit = true; hitPlayer(p.x, p.y + 1.0, p.z); guard(function () { api.shake(0.5, 0.3); }); }
          if (D.left <= 0.01) {
            D.stage = 'skid'; D.t = 0; if (F.dashEnd !== 'blocked') F.dashEnd = 'done';
            setPose('recover', 10); burst('dust', boss.x, 0.3, boss.z, 5, { spd: 4, up: 2, life: 0.6, s0: 0.4, s1: 1.3, drag: 2 });
          }
        }
        if (Math.random() < h * 30) fxSpawn(Math.random() < 0.5 ? 'fire' : 'ember', boss.x + rand(-0.6, 0.6), 0.6 + rand(0, 1.5), boss.z + rand(-0.6, 0.6), 0, rand(1, 3), 0, { life: 0.45, s0: 0.35, s1: 0.04 });
        return;
      }
      // the skid: he whips round to face you before anything else, so the opening that follows is to the front
      facePlayer(h, 18);
      if (D.t < 0.2) return;
      // then another dash in the chain, or the exposed recovery
      D.n++;
      if (D.n < P.dashN && dashOk()) { dashAim(0.45); return; }
      F.dash = null; setSolid(true);
      F.mode = 'recover'; F.t = 0; F.dur = P.rec; setPose('recover', 5); expose(P.rec); SFX.hiss(0.4);
      burst('smoke', boss.x, 2, boss.z, 5, { spd: 2, up: 2, life: 1.0, s0: 0.5, s1: 1.8, drag: 1.5 });
    }
    function fireAttack() {
      var P = PH[F.phase], name = F.atk, i, v;
      F.mode = 'fire'; F.t = 0; F.step = 0; F.sched.length = 0;
      if (name === 'volley') {
        setPose('throw', 10);
        for (v = 0; v < P.volleys; v++) for (i = 0; i < P.msN; i++) F.sched.push({ t: v * (P.msN * P.msGap + 0.45) + i * P.msGap, k: 'ms' });
        F.dur = F.sched[F.sched.length - 1].t + 0.3;
      } else {
        var L = F.line; startSweep(L.x0, L.z0, L.dx, L.dz, 6.5, L.len, P.lineSpd);
        burst('fire', L.x0, 0.5, L.z0, 10, { spd: 6, up: 8, life: 0.7, s0: 0.5, s1: 0.06, grav: 12 });
        guard(function () { api.shake(0.4, 0.3); });
        F.dur = 0.5; F.line = null;
      }
    }
    function runSchedule() {
      var P = PH[F.phase];
      while (F.step < F.sched.length && F.sched[F.step].t <= F.t) {
        var s = F.sched[F.step++];
        if (s.k === 'ms') {
          boss.hands[1].getWorldPosition(V2);
          throwManuscript(V2.x, V2.y, V2.z, P.msSpd, P.msTurn, P.msHome);
          boss.rate = 12; boss.cur.rax = -2.0; setPose('throw', 10);
        }
      }
    }
    function afterAttack() {
      var P = PH[F.phase];
      if (F.atk === 'dash') { startTeleport(); return; }
      if (F.where === 'roof' && F.attacksHere >= (F.phase >= 2 ? 2 : 1)) { startTeleport(Math.random() < 0.7 ? 'street' : 'roof'); return; }
      if (F.where === 'fountain' || Math.random() < P.teleP) { startTeleport(F.where === 'fountain' ? 'street' : undefined); return; }
      F.mode = 'idle'; F.t = 0; F.dur = P.idle * rand(0.85, 1.15); setPose(F.where === 'roof' ? 'perch' : 'idle', 4);
    }
    function strafe(h) {
      var P = PH[F.phase], b = boss, p = api.player.position, dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1;
      F.strafeT -= h; if (F.strafeT <= 0) { F.strafeT = rand(1.4, 3.0); F.strafeDir = -F.strafeDir; }
      var tx = -dz / d * F.strafeDir, tz = dx / d * F.strafeDir, radial = d < 6 ? -1 : d > 18 ? 1 : 0;
      var mx = tx * 0.85 + dx / d * radial * 0.6, mz = tz * 0.85 + dz / d * radial * 0.6, ml = Math.hypot(mx, mz) || 1;
      var sp = P.strafe * h, nx = b.x + mx / ml * sp, nz = b.z + mz / ml * sp;
      if (!api.collide(nx, nz, 1.2) && Math.hypot(nx, nz) < ARENA_R - 3) { b.x = nx; b.z = nz; b.side = -F.strafeDir; b.glide = Math.min(1, b.glide + h * 4); }
      else { F.strafeDir = -F.strafeDir; F.strafeT = rand(1.4, 3.0); b.glide = Math.max(0, b.glide - h * 4); }
    }
    function fightStep(h, t) {
      var b = boss, P, p = api.player.position;
      var ph = phaseFor(b.hp);
      if (ph > F.phase) {
        F.phase = ph; P = PH[ph];
        bossSay(ph === 2 ? 'THE AUTHORS SHOULD CITE MY WORK. ALL OF IT.' : 'PLEASE SEE MY PREVIOUS COMMENTS.');
        SFX.screech(); SFX.laugh(0.9); setPose('laugh', 7); guard(function () { api.shake(ph === 2 ? 0.4 : 0.7, 0.6); });   // stung into the next phase: a screech, then the laugh
        if (F.mode !== 'tele') {
          if (F.dash) { F.dash = null; setSolid(F.where === 'street'); }
          F.line = null; F.exposeT = 0; F.mode = 'recover'; F.t = 0; F.dur = 1.1; F.atk = 'phase'; F.step = F.sched.length;
        }
        if (ph === 3) F.despT = 1.6;
      }
      P = PH[F.phase];
      if (F.exposeT > 0) F.exposeT -= h;
      // the desperation ring: spawns, and respawns a while after it has been dispelled
      if (F.phase === 3 && F.despT >= 0) { F.despT -= h; if (F.despT < 0 && !(PRJ && PRJ.desp)) { despStart(p.x, p.z); showCap('PLEASE SEE MY PREVIOUS COMMENTS', 'a weak hit dispels it'); F.despT = -1; } }
      if (F.phase === 3 && F.despT < 0 && !(PRJ && PRJ.desp) && F.mode !== 'recover') F.despT = 8.5;
      // the state machine
      F.t += h;
      if (F.mode === 'tele') { teleStep(h); }
      else if (F.mode === 'dash') { dashStep(h); }
      else {
        facePlayer(h, F.mode === 'fire' ? 6 : 3.5);
        if (F.mode === 'idle' && F.where === 'street') strafe(h); else b.glide = Math.max(0, b.glide - h * 4);
        if (F.mode === 'fire') runSchedule();
        if (F.t >= F.dur) {
          if (F.mode === 'idle') { if (F.where === 'fountain') startTeleport('street'); else startAttack(chooseAttack()); }
          else if (F.mode === 'windup') fireAttack();
          else if (F.mode === 'fire') { F.mode = 'recover'; F.t = 0; F.dur = 0.55; setPose(F.where === 'roof' ? 'perch' : 'idle', 4); }
          else afterAttack();
        }
      }
      // the hands: fire builds through a wind-up
      b.charge = F.mode === 'windup' ? 0.9 * smooth(F.t / Math.max(0.01, F.dur)) : F.mode === 'fire' ? Math.max(0, 0.9 - F.t * 2) : 0;
      if (b.charge > 0.3 && Math.random() < h * 20) { b.hands[1].getWorldPosition(V2); fxSpawn('fire', V2.x + rand(-0.3, 0.3), V2.y, V2.z + rand(-0.3, 0.3), 0, rand(1, 3), 0, { life: 0.35, s0: 0.3, s1: 0.03 }); }
      // taunts, spaced out, never over his own caption
      F.tauntT -= h;
      if (F.tauntT <= 0 && (F.mode === 'idle' || F.mode === 'recover') && !dlgUp() && !sayUp()) { F.tauntT = P.tauntGap * rand(0.8, 1.3); bossSay(pick(TAUNTS)); }
      // the arena: he has not finished with you
      var pr = Math.hypot(p.x, p.z);
      if (pr > ARENA_R) {
        var k2 = ARENA_R / pr; p.x *= k2; p.z *= k2;
        if (total - F.ann > 4) { F.ann = total; say('showToast', 'REVIEWER 2 HAS NOT FINISHED WITH YOU'); }
      }
      // hp bar: the lagging yellow ghost, the chain badge
      F.ghost += (b.hp / maxHp - F.ghost) * (1 - Math.exp(-2.2 * h));
      if (F.ghost < b.hp / maxHp) F.ghost = b.hp / maxHp;
      setHpBar(b.hp, maxHp, F.ghost);
      if (F.hitFlash > 0) { F.hitFlash -= h; if (F.hitFlash <= 0 && dom.hp) dom.hp.classList.remove('is-hit'); }
      if (F.capMsg) { F.capWait -= h; if (F.capWait <= 0 || !dlgUp()) { showCap(F.capMsg[0], F.capMsg[1]); F.capMsg = null; } }
    }
    /* ------------------------------------------------------------ taking fire: a swept test against exactly what is drawn, then the consequences */
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
    /* The first point where the segment a→b touches one of mesh m's boxes (kept in m's own frame, grown by `pad` in that
       frame), as a fraction of a→b, or -1. Ratios along a line survive the affine change of frame, so the fraction is the
       world one. */
    var HM = new THREE.Matrix4(), HA = new THREE.Vector3(), HB = new THREE.Vector3(), HP = new THREE.Vector3(), HR = new THREE.Ray(), HX = new THREE.Box3();
    function segBoxes(m, ax, ay, az, bx, by, bz, pad) {
      var list = m.userData.hit; if (!list) return -1;
      HM.copy(m.matrixWorld).invert(); HA.set(ax, ay, az).applyMatrix4(HM); HB.set(bx, by, bz).applyMatrix4(HM);
      var len = HA.distanceTo(HB), best = -1, i, d;
      if (len > 1e-7) { HR.origin.copy(HA); HR.direction.copy(HB).sub(HA).multiplyScalar(1 / len); }
      for (i = 0; i < list.length; i++) {
        HX.copy(list[i]).expandByScalar(pad);
        if (HX.containsPoint(HA)) return 0;
        if (len > 1e-7 && HR.intersectBox(HX, HP)) { d = HP.distanceTo(HA); if (d <= len && (best < 0 || d < best)) best = d; }
      }
      return best < 0 ? -1 : best / len;
    }
    function weakHit(x, y, z) {
      var b = boss, crit = false;
      F.weakHits++; F.hits++; F.chain++;
      if (F.chain % 4 === 0) crit = true;                     // every fourth chained hit lands twice: aim is rewarded
      b.hp = Math.max(0, b.hp - (crit ? 2 : 1)); b.flinch = 1; b.hitFlash = 0.08;
      SFX.ping(1 - b.hp / maxHp, crit, x, y, z);
      burst('gold', x, y, z, crit ? 9 : 5, { spd: 7, up: 5, life: 0.45, s0: 0.28, s1: 0.04, grav: 16 });
      burst('ember', x, y, z, 4, { spd: 5, up: 4, life: 0.5, s0: 0.2, s1: 0.03, grav: 12 });
      fxSpawn('white', x, y, z, 0, 0, 0, { life: crit ? 0.2 : 0.12, s0: 0.5, s1: crit ? 3.4 : 2.2 });
      if (dom.hp) { dom.hp.classList.add('is-hit'); F.hitFlash = 0.07; }
      setChain(F.chain);
      if (PRJ && PRJ.desp && !PRJ.desp.dead) { PRJ.desp.dead = PRJ.desp.dispelled = true; SFX.dispel(); say('showToast', 'COMMENT ADDRESSED'); F.despT = 8.5; }
      setHpBar(b.hp, maxHp, F.ghost);
      if (b.hp <= 0) setPhase('death');
    }
    function plateHit(x, y, z) {
      SFX.plate(x, y, z);
      burst('spark', x, y, z, 4, { spd: 8, up: 5, life: 0.3, s0: 0.2, s1: 0.03, grav: 20 });
      F.plateHits++; F.hits++;
      if (F.plateTaught < PLATE_LINES.length && (F.plateHits === 3 || F.plateHits === 22)) say('showToast', PLATE_LINES[F.plateTaught++]);
    }
    function bodyHit(x, y, z) {
      SFX.clank(x, y, z);
      burst('spark', x, y, z, 3, { spd: 8, up: 5, life: 0.3, s0: 0.2, s1: 0.03, grav: 20 });
      F.bodyHits++; F.hits++;
      if (F.chain) { F.chain = 0; setChain(0); }
      if (F.taught < BODY_LINES.length && (F.bodyHits === 2 || F.bodyHits === 9 || F.bodyHits === 26)) say('showToast', BODY_LINES[F.taught++]);
    }
    /* The Warthog's chain gun ({kind:'chain'}): two REVISIONS off for every round that lands on him, flesh or bare patch,
       plates open or shut - only a plate that is physically in the round's path holds (the nearest-box test above is
       the physical one; a shut state on its own is not). Two, not the Editor's one: his plates hold a good third of
       the rounds that reach him and his teleports and dashes waste most of the rest, so at one a round a hundred
       REVISIONS took ~28 s of sustained fire against the 10-15 s the gun is meant to need; at two it is ~14 s.
       A spark and a tick where it struck, no combo, no crit, no confirmation tone: at twelve rounds a second the
       tone would never stop. Chain rounds are not shots for the accuracy stat (the gun fires a hundred and fifty
       of them in the time a ball takes to arrive, through pooled tracers). The last round kills him as a ball would. */
    var CHAIN_DMG = 2;
    function chainHit(x, y, z, weak) {
      var b = boss;
      F.chainRounds = (F.chainRounds || 0) + 1;
      b.hp = Math.max(0, b.hp - CHAIN_DMG); b.flinch = Math.max(b.flinch, 0.3); if (weak) b.hitFlash = Math.max(b.hitFlash, 0.05);
      SFX.tick(x, y, z);
      burst(weak ? 'gold' : 'spark', x, y, z, 2, { spd: 7, up: 5, life: 0.3, s0: 0.2, s1: 0.03, grav: 18 });
      fxSpawn('white', x, y, z, 0, 0, 0, { life: 0.07, s0: 0.3, s1: 1.1 });
      if (dom.hp) { dom.hp.classList.add('is-hit'); F.hitFlash = Math.max(F.hitFlash, 0.05); }
      if (weak && PRJ && PRJ.desp && !PRJ.desp.dead) { PRJ.desp.dead = PRJ.desp.dispelled = true; SFX.dispel(); say('showToast', 'COMMENT ADDRESSED'); F.despT = 8.5; }
      setHpBar(b.hp, maxHp, F.ghost);
      if (b.hp <= 0) setPhase('death');
    }
    function chainPlate(x, y, z) {
      SFX.plate(x, y, z, { variant: 0, gain: 0.5 });
      burst('spark', x, y, z, 2, { spd: 8, up: 5, life: 0.25, s0: 0.16, s1: 0.03, grav: 20 });
    }
    function hitTest(pos, prev, kind) {
      if (!self.active || phase !== 'fight' || !boss || !F || boss.hp <= 0 || !pos) return null;
      // `kind` is 'bfg' | 'paper' from the host, or an options object: {kind:'chain'} is the Warthog's chain gun
      var chain = !!(kind && typeof kind === 'object' && kind.kind === 'chain');
      // every live ball passes through here every frame: a distinct position object is one shot. Chain rounds reuse
      // pooled tracer positions and land by the hundred, so they stay out of the accuracy stat (shots and hits both)
      if (!chain && F.seen && !F.seen.has(pos)) { F.seen.add(pos); F.nShots++; }
      var ax = prev ? prev.x : pos.x, ay = prev ? prev.y : pos.y, az = prev ? prev.z : pos.z;
      var bx = pos.x, by = pos.y, bz = pos.z, t, i, hx, hy, hz, big = kind === 'bfg';
      // his manuscripts first: they are between you and him, and popping one opens him up
      if (PRJ) for (i = PRJ.ms.length - 1; i >= 0; i--) {
        var m = PRJ.ms[i], mp = m.g.position;
        t = segSphere(ax, ay, az, bx, by, bz, mp.x, mp.y, mp.z, m.r + (big ? 1.5 : 0));
        if (t >= 0) {
          msPop(m, true); msFree(m, i); if (!chain) F.hits++;
          expose(F.phase >= 3 ? 0.6 : 0.85); SFX.chime();
          if (!F.msTaught) { F.msTaught = true; say('showToast', 'MANUSCRIPT DOWN. HE FLINCHES.'); }
          return 'body';
        }
      }
      if (!boss.g.visible || F.mode === 'tele') return null;
      /* On a roof he is inside his own building's footprint, and the host ends any shot whose end point enters a footprint
         (its colliders are columns with no top). A shot that got there above the eaves is flying over the roof, not into a
         wall, so follow its line on to him: otherwise nothing could ever reach him up there. */
      var pl = F.where === 'roof' ? F.place : null, c = pl && pl.collider;
      if (c && by > pl.h + 0.3 && inBox(c, bx, bz, 0.05)) {
        var ex = bx - ax, ey = by - ay, ez = bz - az, el = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1, reach = Math.hypot(boss.x - ax, boss.z - az) + 4;
        if (reach > el) { bx = ax + ex / el * reach; by = ay + ey / el * reach; bz = az + ez / el * reach; }
      }
      if (segSphere(ax, ay, az, bx, by, bz, boss.x, boss.y + 3.4, boss.z, 5.6) < 0) return null;   // nowhere near him
      /* everything he is made of, nearest first: bare flesh counts, a plate over it holds, anything else is just him. The
         shot's centre line decides (what the crosshair was on); only a shot whose line misses every box is tried again
         with the ball's radius, so a graze still lands, but a padded plate edge never steals a shot that went into the pink */
      var pad = (big ? 0.8 : SHOT_R) / S, best = 2, hit = null, T = boss.targets, pass;
      for (pass = 0; pass < 2 && !hit; pass++) {
        for (i = 0; i < T.length; i++) {
          t = segBoxes(T[i].m, ax, ay, az, bx, by, bz, pass ? pad : 0);
          if (t >= 0 && t < best) { best = t; hit = T[i]; }
        }
      }
      if (!hit) return null;
      hx = lerp(ax, bx, best); hy = lerp(ay, by, best); hz = lerp(az, bz, best);
      if (chain) { if (hit.k === 'plate') chainPlate(hx, hy, hz); else chainHit(hx, hy, hz, hit.k === 'weak'); return 'chain'; }
      if (hit.k === 'weak' && boss.open > 0.3) { weakHit(hx, hy, hz); return 'weak'; }
      if (hit.k !== 'body') { plateHit(hx, hy, hz); return 'body'; }   // a plate, or a sliver of flesh past a shut one: it counts only while the plates are open
      bodyHit(hx, hy, hz); return 'body';
    }

    /* ------------------------------------------------------------ death: the plates fall off, the horns snap, and he comes apart into tendrils and fire */
    var DEATH_LEN = 5.6;
    function detach(m, up) {           // into the world, re-centred on its own middle so it tumbles and lies flat like a thing
      var b = boss; m.updateMatrixWorld(true);
      m.geometry.computeBoundingBox(); var c = m.geometry.boundingBox.getCenter(V3), sz = m.geometry.boundingBox.getSize(V4), big = Math.max(sz.x, sz.y, sz.z);
      V4.copy(c).applyMatrix4(m.matrixWorld); m.geometry.translate(-c.x, -c.y, -c.z);
      scene.attach(m); m.position.copy(V4);
      var lx = m.position.x - b.x, lz = m.position.z - b.z, L = Math.hypot(lx, lz) || 1;
      b.parts.push({ o: m, rest: false, vx: lx / L * rand(2, 5) + rand(-1, 1), vy: rand(3, 7) + (up || 0), vz: lz / L * rand(2, 5) + rand(-1, 1), sx: rand(-8, 8), sy: rand(-8, 8), sz: rand(-8, 8),
                     pitch: clamp(8 - 12 * big, 0, 6) });   // its clatter: a rib door (0.62 model units) lands at pitch 0, a hip flap (0.18) almost six semitones up
    }
    function dropPlates() {
      var b = boss; if (!b || b.parts) return;
      b.g.updateMatrixWorld(true); b.parts = [];
      b.covers.forEach(function (c) { c.ms.forEach(function (m) { detach(m); }); }); b.bones.forEach(function (m) { detach(m); });
    }
    function partsStep(h) {
      var b = boss; if (!b || !b.parts) return;
      for (var i = 0; i < b.parts.length; i++) {
        var p = b.parts[i], o = p.o;
        if (p.rest) continue;
        p.vy -= 14 * h;
        o.position.x += p.vx * h; o.position.y += p.vy * h; o.position.z += p.vz * h;
        o.rotation.x += p.sx * h; o.rotation.y += p.sy * h; o.rotation.z += p.sz * h;
        if (o.position.y < 0.12 && p.vy < 0) {
          SFX.clatter(o.position.x, 0.12, o.position.z, -p.vy, p.pitch);
          o.position.y = 0.12; p.vy = -p.vy * 0.3; p.vx *= 0.6; p.vz *= 0.6; p.sx *= 0.4; p.sy *= 0.4; p.sz *= 0.4;
          if (Math.abs(p.vy) < 0.8) { p.rest = true; p.vy = 0; o.rotation.set(rand(-0.2, 0.2) - Math.PI / 2, o.rotation.y, 0); }
        }
      }
    }
    function killParts() {
      var b = boss; if (!b || !b.parts) return;
      b.parts.forEach(function (p) { if (p.o.parent) p.o.parent.remove(p.o); if (p.o.geometry) p.o.geometry.dispose(); if (p.o.material) { if (p.o.material.map) p.o.material.map.dispose(); p.o.material.dispose(); } }); b.parts = null;
    }
    function rank(acc) { return acc >= 0.5 ? 'S' : acc >= 0.35 ? 'A' : acc >= 0.22 ? 'B' : acc >= 0.12 ? 'C' : 'D'; }
    function deathStep(h, T) {
      var b = boss; if (!b) return;
      b.charge = 0;
      if (!b.parts) { dropPlates(); SFX.shatter(); }
      partsStep(h);
      if (T >= 0.9 && !b.snapped) {                    // the horns go, two dry cracks, and the head drops
        b.snapped = true; b.g.updateMatrixWorld(true);
        b.horns.forEach(function (m) { detach(m, 3); });
        b.tgt.headx = 0.8; b.rate = 3;
        b.head.getWorldPosition(V2); burst('bone', V2.x, V2.y + 0.8, V2.z, 8, { spd: 5, up: 5, life: 0.8, s0: 0.2, s1: 0.05, grav: 12 });
        SFX.snap(); bossSay('I WAS NEVER HERE.');
      }
      if (T >= 2.0 && !F.banner) {
        F.banner = true;
        hideHpBar(); rm('cap'); sayHide();
        var acc = F.nShots > 0 ? (F.weakHits + (F.hits - F.weakHits - F.bodyHits - F.plateHits)) / F.nShots : 0;
        // not one ball thrown, only the Warthog's chain gun: no accuracy to speak of, and he said so himself
        var score = (F.nShots === 0 && F.chainRounds) ? 'SPRAY AND PRAY  ·  RANK S' : 'ACCURACY ' + Math.round(clamp(acc, 0, 1) * 100) + '%  ·  RANK ' + rank(acc);
        showBanner('REBUTTAL ACCEPTED', NAME + ' HAS NO FURTHER COMMENTS  ·  ' + score);
        say('stinger', 'victory');
      }
      if (F.banner) setBanner(clamp((T - 2.0) / 0.7, 0, 1));
      if (T >= 2.8 && !b.burning) { b.burning = true; addColumn(b.x, b.y, b.z, 8, 1.6, true); SFX.column(1.6); SFX.laugh(); }
      if (b.burning && b.g.visible) {                  // the body unravels into its tendrils, and they go up with the fire
        var k = clamp((T - 2.8) / 1.2, 0, 1);
        b.wild = k;
        b.rig.scale.set(S * (1 - k * 0.5), S * Math.max(0.001, 1 - k * k), S * (1 - k * 0.5));
        if (Math.random() < h * 40) burst('soot', b.x, b.y + rand(0, 5), b.z, 2, { spd: 3, up: 6, life: 1.4, s0: 0.5, s1: 2.2, drag: 1.2 });
        if (Math.random() < h * 45) fxSpawn('sinew', b.x + rand(-0.8, 0.8), b.y + rand(0.5, 5), b.z + rand(-0.8, 0.8), rand(-2, 2), rand(3, 8), rand(-2, 2), { life: 1.1, s0: 1.1, s1: 0.2, thin: true, spin: 5, drag: 0.8 });
        if (k >= 1) { b.g.visible = false; SFX.gone(); burst('ember', b.x, b.y + 1, b.z, 20, { spd: 8, up: 9, life: 1.2, s0: 0.25, s1: 0.03, grav: 6 }); burst('sinew', b.x, b.y + 2, b.z, 14, { spd: 6, up: 8, life: 1.2, s0: 1, s1: 0.1, thin: true, grav: 4 }); }
      }
      if (T >= DEATH_LEN) setPhase('outro');
    }

    /* ------------------------------------------------------------ the arrival: omen, then a column of flame on the fountain */
    var OMEN_LEN = 2.6, ARRIVE_LEN = 3.6, VANTAGE_D = 13;
    var lights = null;
    function findLights() {
      lights = { hemi: null, sun: null };
      scene.children.forEach(function (o) { if (o.isHemisphereLight && !lights.hemi) lights.hemi = o; if (o.isDirectionalLight && !lights.sun) lights.sun = o; });
    }
    function omenStep(h, T) {
      // the lights fail. The host has already set them for this frame from dread; we scale them, so nothing accumulates.
      var f = 1, flick = Math.sin(T * 31 + Math.sin(T * 7) * 6);
      if (T > 0.4) f = flick > 0.55 ? 0.08 : flick < -0.85 ? 0.35 : 1;
      if (T > OMEN_LEN - 0.6) f = 0.08 + 0.92 * Math.abs(Math.sin(T * 40));
      if (lights) { if (lights.hemi) lights.hemi.intensity *= f; if (lights.sun) lights.sun.intensity *= f; }
      if (f < 0.5 && Math.random() < h * 10) SFX.buzz();
      var k = clamp(T / OMEN_LEN, 0, 1);
      guard(function () { api.lookAt(0, lerp(4, 2.6, k), 0); });
      if (Math.random() < h * 9) burst('paper', rand(-14, 14), 0.3, rand(-14, 14), 1, { spd: 2.5, up: 4, life: 1.2, s0: 0.2, s1: 0.16, drag: 1.2, spin: 6 });
      if (Math.random() < h * 5) burst('ember', rand(-3, 3), 0.7, rand(-3, 3), 1, { spd: 1, up: 3, life: 1.0, s0: 0.15, s1: 0.03 });
    }
    function arriveStep(h, T) {
      var b = boss; if (!b) return;
      if (T >= 0.6 && !b.g.visible) {
        b.g.visible = true; b.g.scale.set(1, 0.001, 1); SFX.column(1.2);
        if (!api.stinger('reveal')) say('stinger', 'impact');
        guard(function () { api.shake(0.6, 0.5); });
      }
      if (b.g.visible) b.g.scale.y = Math.min(1, b.g.scale.y + h / 0.3);
      if (T >= 1.0 && !b.laughed) { b.laughed = true; setPose('laugh', 6); SFX.laugh(); }
      if (T >= 1.4 && !b.announced) {
        b.announced = true; music('magician'); showHpBar(maxHp, maxHp);
        bossSay('I HAVE NOT READ IT. I HAVE CONCERNS.');
      }
      if (T < 2.6) guard(function () { api.lookAt(0, 5.5, 0); });
      if (T >= ARRIVE_LEN) setPhase('fight');
    }

    /* ------------------------------------------------------------ blast-off: the departmental shuttle, grant-funded and never insured */
    var OUT_FLASH = 6.4, OUT_END = 7.1, ship = null, stars = null, BLACK = new THREE.Color(0x000000);
    function buildShip(x, z) {
      var g = new THREE.Group(), tilt = new THREE.Group(); g.position.set(x, 0, z); g.add(tilt);
      var geos = [], mats = [];
      function lam(c, e) { var m = new THREE.MeshLambertMaterial({ color: c }); m.emissive = new THREE.Color(e === undefined ? c : e); if (e === undefined) m.emissive.multiplyScalar(0.4); mats.push(m); return m; }
      function box(w, h, d, mat, x2, y2, z2, parent) { var ge = new THREE.BoxGeometry(w, h, d); geos.push(ge); var m = new THREE.Mesh(ge, mat); m.position.set(x2, y2, z2); m.castShadow = true; (parent || tilt).add(m); return m; }
      var white = lam(0xf0efe8), blue = lam(0x1f3f8a), glass = lam(0x7fc4ff, 0x244a66), dark = lam(0x2b303c, 0x14171d), steel = lam(0xb8bcc8, 0x3a3d44), red = lam(0xd0222f, 0x6a0e16);
      box(2.6, 1.5, 5.0, white, 0, 1.55, 0);                                         // the minibus
      box(2.62, 0.55, 3.6, glass, 0, 1.95, 0.3); box(2.64, 0.18, 5.02, blue, 0, 1.15, 0);
      box(2.2, 0.5, 0.4, glass, 0, 1.9, 2.55); box(2.4, 0.3, 0.2, dark, 0, 0.95, 2.6);
      [[-1.1, 1.6], [1.1, 1.6], [-1.1, -1.6], [1.1, -1.6]].forEach(function (w) { box(0.3, 0.7, 0.7, dark, w[0], 0.55, w[1]); });
      box(2.4, 0.2, 4.4, steel, 0, 2.4, -0.2);                                        // the roof rack
      [-1, 1].forEach(function (sd) {                                                 // two boosters, bolted on
        box(0.7, 0.7, 3.4, steel, sd * 1.0, 2.9, -0.4); box(0.5, 0.5, 0.6, red, sd * 1.0, 2.9, 1.6); box(0.8, 0.8, 0.3, dark, sd * 1.0, 2.9, -2.2);
      });
      var sign = null;
      guard(function () { sign = api.labelSprite('DEPT SHUTTLE · 100% FEC', '#fcd34d', '#1a1d26'); });
      if (sign) { sign.scale.set(4.2, 0.8, 1); sign.position.set(0, 3.9, 0); tilt.add(sign); }
      var flameMat = new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.95, fog: false }); mats.push(flameMat);
      var flames2 = [];
      [-1, 1].forEach(function (sd) { var fg = new THREE.ConeGeometry(0.34, 2.4, 10); geos.push(fg); var f = new THREE.Mesh(fg, flameMat); f.position.set(sd * 1.0, 2.9, -3.4); f.rotation.x = -Math.PI / 2; f.visible = false; tilt.add(f); flames2.push(f); });
      var lamp = new THREE.PointLight(0xffb867, 2.4, 30, 1.6); lamp.position.set(0, 2.5, -3); tilt.add(lamp);
      var rider = null;
      guard(function () {
        rider = api.boxMan({});
        rider.traverse(function (m) { if (m.material && m.material.emissive) m.material.emissive.copy(m.material.color).multiplyScalar(0.45); });
        rider.scale.setScalar(0.6); rider.position.set(-0.7, 1.35, 1.6); rider.rotation.y = 0;
        rider.userData.la.rotation.x = -1.4; rider.userData.ra.rotation.x = -1.4; rider.userData.ll.rotation.x = -1.4; rider.userData.rl.rotation.x = -1.4;
        tilt.add(rider);
      });
      scene.add(g);
      ship = { g: g, tilt: tilt, flames: flames2, flameMat: flameMat, rider: rider, lamp: lamp, mats: mats, geos: geos, sign: sign };
      return ship;
    }
    function shipKill() {
      if (!ship) return;
      if (ship.lamp && ship.lamp.parent) ship.lamp.parent.remove(ship.lamp);
      if (ship.rider) disposeTree(ship.rider);
      if (ship.sign) { if (ship.sign.material.map) ship.sign.material.map.dispose(); ship.sign.material.dispose(); }
      scene.remove(ship.g);
      ship.geos.forEach(function (g) { g.dispose(); }); ship.mats.forEach(function (m) { m.dispose(); });
      ship = null;
    }
    function starsInit() {
      if (stars) return;
      var geo = new THREE.BoxGeometry(0.16, 1, 0.16), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      var g = new THREE.Group(); scene.add(g);
      var list = [];
      for (var i = 0; i < 110; i++) { var m = new THREE.Mesh(geo, mat), a = rand(0, 6.283), r = 5 + rand(0, 42); m.position.set(Math.cos(a) * r, rand(-80, 80), Math.sin(a) * r); g.add(m); list.push(m); }
      stars = { g: g, geo: geo, mat: mat, list: list };
    }
    function starsKill() { if (!stars) return; scene.remove(stars.g); stars.geo.dispose(); stars.mat.dispose(); stars = null; }
    function starsStep(h, speed, stretch) {
      if (!stars) return;
      for (var i = 0; i < stars.list.length; i++) { var m = stars.list[i]; m.position.y -= speed * h; if (m.position.y < -80) m.position.y += 160; m.scale.y = stretch; }
    }
    /* The camera circles the shuttle, climbing with it. He dies in the standing town, so where it stands and how the
       orbit starts are chosen: a few pads round the player (and toward the open plaza) with room for a minibus, each
       with 24 orbits (twelve starting bearings, either way round) from three framings (15 units out and low, as
       designed, or closer and higher to clear the trees), scored by sampling the first 4.6 s of the camera's path
       against the buildings (walls, eaves, roofs) and, at a lower weight, the trees; the clearest wins, the designed
       framing nearest the player on a tie. outroCam() is the one path both the planner and outroStep use. */
    var FRAMINGS = [[15, 4.6, 0], [11, 6.5, 0.4], [9, 3.8, 0.6]];     // [distance, height, penalty]
    function outroCam(c, sx, sz, a0, dir, fr, v) {
      var k = clamp(Math.max(0, c - 3.2) / 4, 0, 1), tau = Math.max(0, c - 3.2), ry = c >= 3.2 ? 2.6 * tau * tau + 0.7 * tau * tau * tau : 0, a = a0 + dir * c * 0.24, dist = lerp(fr[0], 32, k);
      v.set(sx + Math.sin(a) * dist, ry * 0.86 + lerp(fr[1], 9, k), sz + Math.cos(a) * dist);
      return ry;
    }
    function sightCost(ox, oy, oz, cx, cy, cz, bld, trees) {      // 1 if a building is in the way (or the camera is in one), 0.6 for a tree
      var dx = cx - ox, dy = cy - oy, dz = cz - oz, n = Math.max(2, Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz) / 0.8)), i, j, t, cost = 0;
      if (Math.hypot(cx, cz) > api.WORLD - 5) return 1;                 // out among the border hills
      for (i = 1; i <= n; i++) {
        var k = i / n, x = ox + dx * k, y = oy + dy * k, z = oz + dz * k;
        for (j = 0; j < bld.length; j++) {           // walls and eaves to just over h; the square roof pyramid (wider than a long building) to 1.45 h
          var b = bld[j], wx = x - b.x, wz = z - b.z, ax = Math.abs(wx * b.c - wz * b.s), az = Math.abs(wx * b.s + wz * b.c);   // in the building's frame
          if ((ax < b.hw && az < b.hd && y < b.h + 0.3) || (ax < b.rr && az < b.rr && y > b.h && y < b.h * (1 + 0.45 * (1 - Math.max(ax, az) / b.rr)))) return 1;
        }
        if (!cost) for (j = 0; j < trees.length; j++) { t = trees[j]; if (y > t.lo && y < t.top && Math.hypot(x - t.x, z - t.z) < t.R) { cost = 0.6; break; } }
      }
      if (!cost) for (j = 0; j < trees.length; j++) { t = trees[j]; if (cy < t.top + 0.5 && Math.hypot(cx - t.x, cz - t.z) < t.R + 0.8) { cost = 0.6; break; } }   // a canopy against the lens
      return cost;
    }
    function outroPlan() {
      var p = api.player.position, pads = [], bld = [], trees = [], best = null, i, j, c, V = V3;
      var pr = Math.hypot(p.x, p.z) || 1, ux = p.x / pr, uz = p.z / pr, inw = clamp(pr - 6, 0, 10);   // and toward the open plaza
      [[2.2, 0], [0, 2.4], [-2.4, 0], [0, -2.4], [-ux * inw * 0.6, -uz * inw * 0.6], [-ux * inw, -uz * inw], [4.6, 0], [-4.6, 0], [0, 4.6], [0, -4.6]].forEach(function (o) {
        var x = p.x + o[0], z = p.z + o[1];
        if (pads.length < 7 && Math.hypot(x, z) < ARENA_R && Math.hypot(x, z) > 5 && !api.collide(x, z, 2.6)) pads.push({ x: x, z: z });
      });
      if (!pads.length) { var s0 = null; guard(function () { s0 = api.safeSpot(p.x + 2.2, p.z); }); pads.push(s0 || { x: p.x, z: p.z }); }
      (api.places || []).forEach(function (pl) { var cl = pl.collider; if (cl && Math.hypot(cl.x - p.x, cl.z - p.z) < 48) bld.push({ x: cl.x, z: cl.z, hw: cl.hw, hd: cl.hd, s: Math.sin(cl.yaw || 0), c: Math.cos(cl.yaw || 0), h: pl.h, rr: 0.552 * Math.max(pl.w || 0, pl.d || 0) + 0.2 }); });
      scene.children.forEach(function (g) {                           // the town's trees: a group standing on its trunk (a 0.22/0.42 cylinder)
        var tk = g.isGroup && g.children[0], pa = tk && tk.geometry && tk.geometry.parameters;
        if (pa && pa.radiusTop === 0.22 && pa.radiusBottom === 0.42 && Math.hypot(g.position.x - p.x, g.position.z - p.z) < 40) {
          var ts = g.scale.x || 1; trees.push({ x: g.position.x, z: g.position.z, R: 2.0 * ts, lo: 1.0 * ts, top: 4.8 * ts });
        }
      });
      for (var f = 0; f < FRAMINGS.length; f++) for (i = 0; i < pads.length; i++) {
        var pd = pads[i], fr = FRAMINGS[f], near = 0.03 * Math.hypot(pd.x - p.x, pd.z - p.z) + fr[2];
        for (j = 0; j < 24; j++) {
          var a0 = (j >> 1) * Math.PI / 6, dir = j & 1 ? -1 : 1, sc = near;
          for (c = 0; c <= 4.6 && (!best || sc < best.sc); c += 0.3) {
            var ry = outroCam(c, pd.x, pd.z, a0, dir, fr, V);
            sc += (c < 3.2 ? 1.5 : 1) * sightCost(pd.x, ry + 1.6, pd.z, V.x, V.y, V.z, bld, trees);
          }
          if (!best || sc < best.sc) best = { x: pd.x, z: pd.z, a0: a0, dir: dir, fr: fr, sc: sc };
        }
      }
      return best;
    }
    function outroInit() {
      self.cinematic = true;
      env = null; saveEnv();
      say('setHud', false); say('lockEnvironment', true);
      rootClass('qm-cine', true); sayHide();
      prjClear();
      var plan = null, t0 = performance.now(); guard(function () { plan = outroPlan(); });
      if (!plan) { var p = api.player.position; plan = { x: p.x, z: p.z, a0: 0.9, dir: 1, fr: FRAMINGS[0], sc: -1 }; }
      buildShip(plan.x, plan.z);
      showCap('FUNDING CONFIRMED  ·  THE SHUTTLE IS COSTED AT 100% FEC', 'F / SPACE / TAP: SKIP');
      out = { c: 0, count: -1, lit: false, skipped: false, puff: 0, a0: plan.a0, dir: plan.dir, fr: plan.fr, cost: plan.sc, ms: performance.now() - t0 };
    }
    function skipOutro() {
      if (!out || out.skipped) return;
      // skipped before ignition, the engines still light: the kit's rocket (its ignition thump and roar), not the launch
      // stinger, whose five-second riser and music duck would run on over the shooter's opening
      if (!out.lit) SFX.rocket(4.2);
      out.skipped = true; out.lit = true; out.count = 4; out.c = OUT_FLASH - 0.15;
      if (out.spool && out.spool.stop) out.spool.stop(0.1); out.spool = true;
      hideCount(); rm('cap'); rm('banner');
      if (ship) ship.flames.forEach(function (f) { f.visible = true; });
    }
    function outroStep(h) {
      if (!out) { outroInit(); if (!out) return; }
      out.c += h;
      var c = out.c, tau = Math.max(0, c - 3.2);
      if (dom.banner) { var ba = clamp(1 - (c - 0.2) / 0.8, 0, 1); setBanner(ba); if (ba <= 0) rm('banner'); }
      var want = c < 0.8 ? -1 : c < 1.6 ? 0 : c < 2.4 ? 1 : c < 3.2 ? 2 : c < 4.0 ? 3 : 4;
      if (want !== out.count) {
        out.count = want;
        if (want >= 0 && want <= 2) { showCount(String(3 - want)); SFX.count(false); }
        else if (want === 3) { showCount('GO'); SFX.count(true); }
        else if (want === 4) hideCount();
      }
      if (!out.spool && c >= 1.0) out.spool = SFX.spool(2.2) || true;          // the engines wind up while it shakes itself
      if (!out.lit && c >= 3.2) { out.lit = true; rm('cap'); say('stinger', 'launch'); SFX.rocket(4.2); if (ship) ship.flames.forEach(function (f) { f.visible = true; }); }
      var sx = ship ? ship.g.position.x : 0, sz = ship ? ship.g.position.z : 0, ry = outroCam(c, sx, sz, out.a0, out.dir, out.fr, camera.position);
      if (ship) {
        ship.g.position.y = ry;
        ship.tilt.rotation.x = -clamp(tau / 1.6, 0, 1) * 1.2;                    // nose up, the way a minibus was never meant to point
        ship.g.rotation.y += h * (0.2 + tau * 0.25);
        if (ship.lamp) ship.lamp.intensity = out.lit ? 3.4 + Math.sin(c * 40) * 0.8 : 1.2;
        if (!out.lit && c > 1.0) { ship.g.position.x += Math.sin(c * 50) * 0.01 * (c - 1); }   // it shakes itself, well before ignition
        if (out.lit) {
          ship.flames.forEach(function (f) { f.scale.set(1 + Math.sin(c * 40) * 0.12, 1.1 + Math.min(2.2, tau * 0.5) + Math.sin(c * 33) * 0.2, 1 + Math.cos(c * 37) * 0.12); });
          ship.flameMat.color.setRGB(1, 0.55 + Math.sin(c * 51) * 0.15, 0.2);
          out.puff += h;
          while (out.puff > 0.04) {
            out.puff -= 0.04;
            fxSpawn(Math.random() < 0.45 ? 'flame' : 'smoke', ship.g.position.x + rand(-1.2, 1.2), ry + 0.5, ship.g.position.z + rand(-1.2, 1.2), rand(-4, 4), -rand(2, 9) - tau * 2, rand(-4, 4), { life: rand(0.8, 1.8), s0: 0.7, s1: 4.2, drag: 1.2 });
          }
        }
      }
      camera.up.set(0, 1, 0);
      camera.lookAt(sx, ry + lerp(2.0, 1.6, clamp(tau / 1.5, 0, 1)), sz);
      var amp = out.lit ? clamp(1.0 - tau * 0.12, 0.18, 1.0) : 0;
      if (amp) { camera.position.x += (Math.random() - 0.5) * amp; camera.position.y += (Math.random() - 0.5) * amp; camera.position.z += (Math.random() - 0.5) * amp; camera.rotation.z += (Math.random() - 0.5) * amp * 0.02; }
      var k = clamp((c - 3.8) / 2.4, 0, 1);
      if (env) {
        if (scene.background && scene.background.copy) scene.background.copy(env.bg).lerp(BLACK, k);
        if (scene.fog) { scene.fog.color.copy(env.fogC).lerp(BLACK, k); scene.fog.near = lerp(env.near, 900, k); scene.fog.far = Math.max(scene.fog.near + 10, lerp(env.far, 2600, k)); }
        if (env.hemi) env.hemi.intensity = env.hemiI * (1 - 0.8 * k);
        if (env.sun) env.sun.intensity = env.sunI * (1 - 0.55 * k);
      }
      if (k > 0.22) { starsInit(); if (stars) stars.g.position.set(sx, ry, sz); starsStep(h, 40 + tau * 34, lerp(1, 9, clamp((k - 0.22) / 0.6, 0, 1))); }
      if (c >= OUT_FLASH) setFlash((c - OUT_FLASH) / (OUT_END - OUT_FLASH));
      if (c >= OUT_END && !fired) {                     // the white-out, then the hand-over. Exactly once.
        fired = true; setFlash(1);
        self.cinematic = false;
        guard(function () { api.onBossDefeated(); });
        if (self.active) guard(stop);
      }
    }

    /* ------------------------------------------------------------ phases */
    function vantage() {
      var p = api.player.position, d = Math.hypot(p.x, p.z);
      if (d >= 9) return;
      var ux = d > 0.01 ? p.x / d : 0.3, uz = d > 0.01 ? p.z / d : 0.95;
      guard(function () { api.teleport(ux * VANTAGE_D, uz * VANTAGE_D); });
    }
    function enterPhase(name) {
      if (name === 'card') { self.cinematic = true; openCard(); return; }
      if (name === 'omen') {
        self.cinematic = false;
        if (dom.card) killCard();
        music('silence'); SFX.wind(OMEN_LEN); findLights();
        vantage();
        showCap('SOMETHING HAS BEEN ASSIGNED TO YOUR MANUSCRIPT', 'the fountain');
        return;
      }
      if (name === 'arrive') {
        boss = buildBoss(maxHp); boss.g.visible = false;
        boss.x = 0; boss.y = 2.55; boss.z = 0;                         // on the fountain's finial, of all places
        boss.yaw = Math.atan2(api.player.position.x, api.player.position.z);
        boss.g.position.set(0, 2.55, 0); boss.g.rotation.y = boss.yaw;
        scene.add(boss.g); setSolid(false);
        fightInit(); F.where = 'fountain';
        addColumn(0, 0.65, 0, 9, 1.4, true); SFX.column(1.4);
        addRing(0, 0, 3, 14, 30, 1.4);
        guard(function () { api.shake(0.5, 0.6); });
        return;
      }
      if (name === 'fight') {
        if (!F) fightInit();
        F.mode = 'idle'; F.t = 0; F.dur = F.where === 'fountain' ? 0.7 : 0.9;
        F.capMsg = ['SHOOT THE CONFLICTS OF INTEREST', 'the pink flesh, while the plates are open']; F.capWait = 6.0;
        return;
      }
      if (name === 'death') {
        self.ended = true;
        setSolid(false); prjClear();
        music('silence');
        rootClass('qm-cine', true);
        if (F) { F.banner = false; F.exposeT = 0; F.dash = null; F.tele = null; }
        if (boss) { boss.g.visible = true; boss.g.scale.set(1, 1, 1); setPose('dying', 2.5); boss.glide = 0; boss.hp = 0; boss.charge = 0; }
        rm('cap');
        guard(function () { api.shake(1.0, 1.0); });
        if (boss) { SFX.slam(boss.x, boss.z); SFX.screech({ pitch: -4, delay: 0.1 }); }   // the last blow lands; his death cry
        if (boss) burst('gold', boss.x, boss.y + 3, boss.z, 18, { spd: 9, up: 10, life: 1.1, s0: 0.3, s1: 0.05, grav: 9, jit: 0.8 });
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

    /* ------------------------------------------------------------ the debug handle (?bossdbg=1): what a harness needs to aim */
    var DBG = /[?&]bossdbg=1/.test(location.search);
    function dbgInstall() {
      if (!DBG) return;
      window.__qb = {
        info: function () {
          return { phase: phase, mode: F ? F.mode : '', where: F ? F.where : '', fphase: F ? F.phase : 0, hp: boss ? boss.hp : -1, body: F ? F.bodyHits : 0, weak: F ? F.weakHits : 0, plate: F ? F.plateHits : 0,
                   exposed: exposedNow(), pos: boss ? { x: +boss.x.toFixed(2), y: +boss.y.toFixed(2), z: +boss.z.toFixed(2) } : null, visible: !!(boss && boss.g.visible),
                   cols: api.colliders.length, cine: self.cinematic, ended: self.ended, active: self.active, ms: PRJ ? PRJ.ms.length : 0, shots: F ? F.nShots : 0, chain: F ? F.chain : 0, desp: !!(PRJ && PRJ.desp), dashEnd: F ? F.dashEnd || '' : '',
                   open: boss ? +boss.open.toFixed(2) : 0, meshes: boss ? countMeshes(boss.g) : 0, grit: gritN,
                   face: boss ? Math.round(Math.abs(angDiff(Math.atan2(api.player.position.x - boss.x, api.player.position.z - boss.z), boss.yaw)) * 180 / Math.PI) : -1,   // degrees off facing you
                   outro: out ? { a0: +out.a0.toFixed(2), dir: out.dir, fr: out.fr, cost: +out.cost.toFixed(2), planMs: Math.round(out.ms), c: +out.c.toFixed(2) } : null };
        },
        // aim(deg, i): look at conflict of interest i (0 chest, 1 left hip, 2 right hip), with `deg` degrees of pitch added
        aim: function (deg, i) {
          if (!boss) return null;
          boss.patches[clamp(i | 0, 0, boss.patches.length - 1)].getWorldPosition(V1);
          var p = api.player.position, eye = p.y + api.EYE, dh = Math.hypot(V1.x - p.x, V1.z - p.z) || 1;
          var pitch = Math.atan2(V1.y - eye, dh) + (deg || 0) * Math.PI / 180;
          guard(function () { api.lookAt(V1.x, eye + Math.tan(pitch) * dh, V1.z); });
          return { x: V1.x, y: V1.y, z: V1.z };
        },
        open: function (s) { expose(s || 3); },
        attack: function (name) { if (F && phase === 'fight' && F.where !== 'fountain' && (F.mode === 'idle' || F.mode === 'recover') && ATTACK_CAP[name] && !(F.where === 'roof' && name === 'dash')) { startAttack(name); return true; } return false; },
        ts: function (n) { if (api.params && n > 0) api.params.timescale = Math.max(0.1, Math.min(20, n)); return api.params ? api.params.timescale : null; }
      };
    }
    function countMeshes(o) { var n = 0; o.traverse(function (m) { if (m.isMesh) n++; }); return n; }
    function dbgRemove() { if (DBG && window.__qb) { try { delete window.__qb; } catch (e) { window.__qb = undefined; } } }

    /* ------------------------------------------------------------ lifecycle */
    function start(opts) {
      opts = opts || {};
      if (self.active) guard(stop);
      guard(function () {
        ensureStyle(); fxInit(); prjInit(); saveEnv(); findLights();
        key = new THREE.SpotLight(0xe8e6ff, 0, 26, 0.55, 0.45, 2); scene.add(key); scene.add(key.target);
        maxHp = Math.max(1, Math.min(9999, parseInt(opts.hp, 10) || 100));
        total = 0; pT = 0; fired = false; out = null; boss = null; F = null; phase = '';
        self.active = true; self.cinematic = false; self.ended = false; musicOn = false;
        dom.dlg = api.root.querySelector('.q-dialog');
        dom.dlgT = dom.dlg && dom.dlg.querySelector('.q-dialog__title'); dom.dlgB = dom.dlg && dom.dlg.querySelector('.q-dialog__body'); voiceWatch(true);
        rootClass('qm-on', true); rootClass('qm-cine', false);
        window.addEventListener('keydown', onSkipKey, true);
        api.view.addEventListener('pointerdown', onSkip);
        dbgInstall();
        guard(function () { var k = kit(), a = ac(); if (k) k.warm(WARM); if (a) gritWarm(a); });
        if (opts.retry) {
          boss = buildBoss(maxHp); scene.add(boss.g);
          fightInit();
          placeBoss(pickSpot('street'));
          for (var k in boss.cur) boss.cur[k] = boss.tgt[k];
          addColumn(boss.x, boss.y, boss.z, 6, 0.6, false); SFX.column(0.6);
          music('magician'); showHpBar(maxHp, maxHp);
          bossSay('THE REVISED VERSION DOES NOT ADDRESS MY CONCERNS. I HAVE NOT READ IT EITHER.');
          setPhase('fight');
          guard(function () { api.lookAt(boss.x, boss.y + 3.4, boss.z); });   // the REJECTED! tilt left the camera on the ground
        } else if (opts.skipIntro) setPhase('omen');
        else setPhase('card');
      });
    }
    function stop() {
      guard(function () { window.removeEventListener('keydown', onSkipKey, true); api.view.removeEventListener('pointerdown', onSkip); });
      guard(killCard); guard(hideHpBar);
      guard(function () { rm('banner'); rm('count'); rm('cap'); rm('flash'); sayHide(); dom.capT = 0; dom.dlgWas = false; voiceWatch(false); });
      guard(function () { if (dom.style && dom.style.parentNode) dom.style.parentNode.removeChild(dom.style); dom.style = null; });
      guard(shipKill); guard(starsKill);
      guard(prjKill);
      guard(showRoofSign);
      guard(function () { setSolid(false); killParts(); removeBoss(); });
      guard(fxKill);
      guard(function () { if (key) { scene.remove(key); scene.remove(key.target); if (key.dispose) key.dispose(); key = null; } });
      guard(killSfx);
      guard(restoreEnv);
      guard(function () { camera.rotation.z = 0; camera.up.set(0, 1, 0); });
      rootClass('qm-on', false); rootClass('qm-cine', false);
      if (musicOn) music('silence');
      say('setHud', true); say('lockEnvironment', false);
      dbgRemove();
      self.active = false; self.cinematic = false; self.ended = false;
      phase = ''; pT = 0; out = null; F = null; fired = false; lights = null;
    }
    function update(dt, t) {
      if (!self.active) return;
      var h = dt > 0.5 ? 0.5 : dt < 0 ? 0 : dt;
      total += h; pT += h;
      guard(function () {
        fxStep(h); capStep(h); sayStep(h);
        var up = dlgUp(); if (up !== !!dom.dlgWas) { dom.dlgWas = up; dom.layoutT = 0; }
        if (dom.hp) dom.hp.classList.toggle('is-up', up);
        pushPlayerOut(); layoutStep(h);
        if (boss && boss.g.visible) { applyPose(h, total); boss.g.updateMatrixWorld(true); tendrilStep(total); }
        keyStep();
        if (phase === 'card') { drawCard(pT); if (pT >= CARD_LEN) { closeCard(); setPhase('omen'); } return; }
        if (phase === 'omen') { omenStep(h, pT); prjStep(h, false); if (pT >= OMEN_LEN) setPhase('arrive'); return; }
        if (phase === 'arrive') { arriveStep(h, pT); prjStep(h, false); return; }
        if (phase === 'fight') { if (F) fightStep(h, total); prjStep(h, true); return; }
        if (phase === 'death') { deathStep(h, pT); prjStep(h, false); return; }
        if (phase === 'outro') { outroStep(h); prjStep(h, false); return; }
      });
    }
    return self;
  };
  window.QuestMagician.grit = gritRender;
})();
