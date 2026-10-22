/* =============================================================================
   CAVE.JS — "THE UNDERSPEND", the secret level under the fountain.
   Walk into the fountain and you are flushed into the digestive tract of the
   University's finance office. You are a pale, blind cave salamander in little
   round glasses. DO NOT TOUCH THE WALLS: they are lined with villi and the
   villi absorb your budget. Collect COMPUTE CREDITS, get pinballed by
   OVERHEADS and VAT, find the unclaimed cloud-compute UNDERSPEND, then answer
   one quiz question per credit on "SPEND IT OR LOSE IT!" and take the money
   back up to the boss fight as extra hearts.
   An affectionate homage to Earthworm Jim 2's "Jim's Now a Blind Cave
   Salamander" (and to the two cows). Every pixel and every sound here is
   generated from scratch: no external art, audio or data.
   Interface: window.QuestCave(api) -> { start(opts), stop(), active }
     opts.onDone({credits, hearts})   called once, when the level is over (after the climb-out if transition is on)
     opts.skin        'palmer' (default) | 'snake' | 'chief': the salamander and the stage dressing. Same map,
                      same rules, same quiz, same cows; only the sprite, the palette, the props and the captions change.
     opts.transition  true: play the flush-in (fountain seen from inside, the swirl down the drain, the title
                      punch) before the level, and the climb-out (bubbles, light, plop) before onDone.
                      false/absent: today's start, onDone the moment the level ends.
   Test hooks (query string, read inside start()):
     ?caveskin=snake|chief   force a skin (wins over opts.skin)
     ?cavein=1               force the transitions on
     ?cavebudget=N           start with N pounds instead of 16,000 (to reach the drowning quickly)
     ?cavequiz=1      skip straight to the quiz with every credit collected
     ?cavecow=1       skip straight to the two-cow WELL DONE screen
     ?cavegod=1       the villi and the auditors take nothing
     ?caveat=col,row  drop the salamander at that cell of the 27x17 map, no title card
     ?cavelit=1       turn the lights on (for looking at the maze)
   plus the host's ?cave=1 (start this level after PRESS START) and ?timescale=N.
   ============================================================================= */
(function () {
  'use strict';
  window.QuestCave = function (api) {
    var self = { start: start, stop: stop, active: false };
    var VW = 400, VH = 225, TAU = Math.PI * 2, FONT = '"Press Start 2P", monospace';
    function qp(n, d) { var m = location.search.match(new RegExp('[?&]' + n + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : d; }
    var GOD = false, JUMP = '', AT = '', LIT = false, SKIN = 'palmer', TRANS = false, TH = null, BUD = 0;
    function readHooks(opts) {
      GOD = qp('cavegod') === '1'; LIT = qp('cavelit') === '1'; AT = qp('caveat', ''); JUMP = qp('cavecow') === '1' ? 'cow' : qp('cavequiz') === '1' ? 'quiz' : '';
      var sk = qp('caveskin', '') || (opts && opts.skin) || 'palmer';
      SKIN = (sk === 'snake' || sk === 'chief') ? sk : 'palmer';
      TRANS = qp('cavein') === '1' || !!(opts && opts.transition);
      BUD = parseInt(qp('cavebudget', '0'), 10) || 0;
      TH = THEMES[SKIN];
    }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function pounds(n) { return '£' + fmt(n); }

    /* ------------------------------------------------------------ audio: every sound synthesised on the host's AudioContext */
    var AC = null, out = null, noiseBuf = null, gates = {};
    function audioInit() {
      try {
        AC = api.audio(); if (!AC) return;
        out = AC.createGain(); out.gain.value = 0.5; out.connect(AC.destination);
        var n = (AC.sampleRate * 0.7) | 0; noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
        var d = noiseBuf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { AC = null; out = null; }
    }
    function gate(name, gap) { if (!AC) return false; var t = AC.currentTime; if (gates[name] !== undefined && t - gates[name] < gap && t >= gates[name]) return false; gates[name] = t; return true; }
    function tone(f0, f1, dur, vol, type, delay) {
      if (!AC || !out) return;
      try {
        var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), a = AC.createGain();
        o.type = type || 'square'; o.frequency.setValueAtTime(f0, t);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(12, f1), t + dur);
        a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(vol, t + 0.008); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(a); a.connect(out); o.start(t); o.stop(t + dur + 0.03);
      } catch (e) {}
    }
    function noise(dur, vol, f0, f1, delay, q, type) {
      if (!AC || !out || !noiseBuf) return;
      try {
        var t = AC.currentTime + (delay || 0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), a = AC.createGain();
        s.buffer = noiseBuf; s.loop = true; f.type = type || 'lowpass'; if (q) f.Q.value = q;
        f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
        a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.3)); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(a); a.connect(out); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.03);
      } catch (e) {}
    }
    function moo(delay, base) {
      if (!AC || !out) return;
      try {
        var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), o2 = AC.createOscillator(), lp = AC.createBiquadFilter(), a = AC.createGain(), v = AC.createOscillator(), vg = AC.createGain();
        base = base || 150;
        o.type = 'sawtooth'; o2.type = 'square';
        o.frequency.setValueAtTime(base * 0.82, t); o.frequency.linearRampToValueAtTime(base * 1.12, t + 0.22); o.frequency.linearRampToValueAtTime(base * 0.6, t + 1.05);
        o2.frequency.setValueAtTime(base * 0.41, t); o2.frequency.linearRampToValueAtTime(base * 0.56, t + 0.22); o2.frequency.linearRampToValueAtTime(base * 0.3, t + 1.05);
        v.type = 'sine'; v.frequency.value = 6.5; vg.gain.value = base * 0.045; v.connect(vg); vg.connect(o.frequency);
        lp.type = 'lowpass'; lp.Q.value = 7; lp.frequency.setValueAtTime(420, t); lp.frequency.linearRampToValueAtTime(900, t + 0.3); lp.frequency.linearRampToValueAtTime(320, t + 1.05);
        a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(0.16, t + 0.09); a.gain.setValueAtTime(0.16, t + 0.7); a.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
        o.connect(lp); o2.connect(lp); lp.connect(a); a.connect(out);
        o.start(t); o2.start(t); v.start(t); o.stop(t + 1.2); o2.stop(t + 1.2); v.stop(t + 1.2);
      } catch (e) {}
    }
    var sfx = {
      splash: function () { noise(0.5, 0.34, 3800, 320, 0, 0.7); noise(0.9, 0.16, 900, 160, 0.1); tone(300, 90, 0.4, 0.07, 'sine'); },
      swim: function () { if (gate('swim', 0.42)) noise(0.16, 0.05, 700, 230, 0, 1.2); },
      nibble: function () { noise(0.16, 0.28, 1500, 260, 0, 1.4); tone(360, 120, 0.13, 0.11, 'sawtooth'); tone(880, 300, 0.07, 0.05, 'square', 0.03); },
      yelp: function () { if (gate('yelp', 0.35)) { tone(700, 1250, 0.07, 0.10, 'square'); tone(1250, 520, 0.14, 0.08, 'square', 0.07); } },
      thunk: function () { tone(150, 52, 0.3, 0.30, 'sine'); tone(300, 108, 0.16, 0.13, 'triangle'); noise(0.1, 0.2, 5200, 900, 0, 0.6); tone(1180, 1700, 0.09, 0.07, 'square', 0.01); },
      credit: function () { tone(784, 0, 0.06, 0.09, 'square'); tone(1047, 0, 0.06, 0.09, 'square', 0.055); tone(1568, 0, 0.16, 0.08, 'square', 0.11); tone(2093, 0, 0.1, 0.04, 'triangle', 0.11); },
      audit: function () { tone(96, 62, 0.4, 0.16, 'sawtooth'); noise(0.3, 0.12, 700, 180); },
      current: function () { if (gate('current', 1.1)) noise(0.75, 0.09, 420, 1500, 0, 0.9, 'bandpass'); },
      low: function () { if (gate('low', 1.05)) { tone(78, 58, 0.16, 0.16, 'sine'); tone(78, 54, 0.2, 0.12, 'sine', 0.2); } },
      claim: function () { for (var i = 0; i < 7; i++) tone(392 * Math.pow(1.1892, i), 0, 0.14, 0.085, 'square', i * 0.075); noise(1.1, 0.1, 6000, 900, 0.1, 0.8); tone(98, 196, 0.9, 0.09, 'triangle', 0.1); },
      drown: function () { noise(1.4, 0.3, 1200, 90); tone(300, 42, 1.2, 0.14, 'sawtooth'); tone(150, 30, 1.4, 0.1, 'sine', 0.1); },
      fanfare: function () { var n = [523, 659, 784, 1047, 784, 1047, 1319]; for (var i = 0; i < n.length; i++) tone(n[i], 0, i === 6 ? 0.5 : 0.13, 0.085, 'square', i * 0.12); },
      ding: function () { tone(1319, 0, 0.1, 0.09, 'square'); tone(1976, 0, 0.3, 0.07, 'triangle', 0.09); noise(0.5, 0.11, 2400, 1100, 0.04, 0.6, 'bandpass'); },
      buzz: function () { tone(112, 104, 0.52, 0.16, 'sawtooth'); tone(87, 82, 0.52, 0.13, 'square'); },
      clap: function () { for (var i = 0; i < 16; i++) noise(0.1, 0.055, 4200, 1100, i * 0.045 + Math.random() * 0.03, 0.8, 'bandpass'); },
      oooh: function () { tone(300, 190, 0.85, 0.055, 'sine'); tone(302, 188, 0.85, 0.05, 'triangle', 0.04); tone(151, 96, 0.85, 0.035, 'sine', 0.02); },
      tick: function () { if (gate('tick', 0.18)) tone(1500, 1200, 0.025, 0.035, 'square'); },
      ui: function () { tone(880, 0, 0.05, 0.06, 'square'); },
      /* the Shadow Moses "!" ping: a click, then a square snapping down a fifth and ringing off */
      alert: function () { noise(0.012, 0.12, 6000, 3000); tone(1976, 0, 0.055, 0.13, 'square'); tone(1318, 0, 0.34, 0.11, 'square', 0.055); },
      /* a Forerunner shield taking a hit: a rising saw and a splash of band-passed hiss */
      zap: function () { tone(520, 1600, 0.12, 0.08, 'sawtooth'); noise(0.2, 0.08, 2600, 700, 0, 1.3, 'bandpass'); tone(2400, 900, 0.18, 0.04, 'triangle', 0.03); },
      /* the flush: gurgle (noise, low-passed, with a 7 Hz wobble on its gain), glugs and pipe echoes */
      gurgle: function (dur) {
        if (!AC || !out || !noiseBuf) return;
        try {
          var t = AC.currentTime, sN = AC.createBufferSource(), f = AC.createBiquadFilter(), a = AC.createGain(), trem = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
          sN.buffer = noiseBuf; sN.loop = true; f.type = 'lowpass'; f.Q.value = 1.6;
          f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
          a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(0.22, t + 0.15); a.gain.setValueAtTime(0.22, t + dur * 0.7); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          /* the wobble lives on its own gain (trem) in series: an LFO summed onto a.gain would hold the noise at tremolo level after the envelope reached silence */
          trem.gain.value = 1; lg.gain.value = 0.5;
          lfo.type = 'sine'; lfo.frequency.setValueAtTime(5.5, t); lfo.frequency.linearRampToValueAtTime(9, t + dur);
          lfo.connect(lg); lg.connect(trem.gain);
          sN.connect(f); f.connect(trem); trem.connect(a); a.connect(out); sN.start(t, Math.random() * 0.3); lfo.start(t); sN.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
          flushSrc = { a: a, sN: sN, lfo: lfo };
        } catch (e) {}
      },
      glug: function (base) { tone(base || 230, (base || 230) * 0.4, 0.17, 0.11, 'sine'); tone((base || 230) * 2.1, (base || 230) * 0.9, 0.08, 0.05, 'triangle', 0.02); },
      echo: function (vol) { tone(820, 560, 0.06, vol, 'square'); tone(410, 280, 0.09, vol * 0.7, 'triangle', 0.01); noise(0.12, vol * 0.8, 900, 300, 0, 2, 'bandpass'); },
      punch: function () { tone(130, 36, 0.4, 0.3, 'sine'); noise(0.14, 0.24, 4000, 500, 0, 0.6); tone(60, 30, 0.6, 0.18, 'triangle', 0.02); },
      rise: function () { noise(1.3, 0.14, 300, 2400, 0, 1.1, 'bandpass'); for (var i = 0; i < 6; i++) tone(300 + i * 90, 600 + i * 120, 0.05, 0.035, 'sine', 0.15 + i * 0.19); },
      plop: function () { tone(160, 520, 0.09, 0.16, 'sine'); noise(0.08, 0.2, 2400, 400, 0, 1.2, 'bandpass'); tone(330, 110, 0.14, 0.07, 'triangle', 0.08); },
      moo: moo
    };
    var flushSrc = null;
    function flushHush() {
      try {
        if (flushSrc && AC) {
          var a = flushSrc.a, t = AC.currentTime;
          a.gain.cancelScheduledValues(t); a.gain.setValueAtTime(Math.max(0.0001, a.gain.value), t); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          flushSrc.sN.stop(t + 0.15); flushSrc.lfo.stop(t + 0.15);
        }
      } catch (e) {}
      flushSrc = null;
    }

    /* ------------------------------------------------------------ the map (generated offline, connectivity verified, then frozen)
       # wall  . water  S start  E the underspend  c compute credit  o bumper  L lamp  x audit drone  > < ^ v current */
    var MAP = [
      '###########################',
      '#S#....L#.....#c..........#',
      '#L..#####..##.##..######x.#',
      '#v..#c............#E......#',
      '#v#####.#..o..xo.##########',
      '#v#...#.#.......c.........#',
      '#v#..L###....o..####.o.##.#',
      '#v#.#...#...L...........#.#',
      '#L#.###c##..#...o.#####...#',
      '#.#...#v#..c#.....#...#.o.#',
      '#.##c.#v#..##.o...#.......#',
      '#...L.#v#...#...x.#.#...#.#',
      '#######v#..L##..o.#.#####.#',
      '#L#...#v#c#.#.....#.#c....#',
      '#......L###.#..####.####o.#',
      '#...#.......#.............#',
      '###########################'
    ];
    var TS = 32, MW = MAP[0].length, MH = MAP.length, WW = MW * TS, WH = MH * TS;
    var BUMPER_NAMES = ['OVERHEADS', 'VAT', 'RESUBMIT', 'PROCUREMENT', 'FEC', 'INDIRECTS', 'ETHICS', 'TRAVEL CLAIM', 'ESTATES'];

    /* ------------------------------------------------------------ pixel kit */
    var PAL = {
      k: '#23121a', w: '#e9dcd0', p: '#c0ad9f', s: '#9c8879', y: '#f2d16b', Y: '#b88a1e', b: '#15151f', c: '#ffffff',
      r: '#ef9fb0', R: '#c4667e', g: '#7d8496', n: '#fcd34d', m: '#9aa3b8', d: '#0d0810', f: '#43141f', F: '#7a2a3a'
    };
    function R(x, col, a, b, w, h) { x.fillStyle = col; x.fillRect(a | 0, b | 0, w | 0, h | 0); }
    function art(rows, pal) {
      var h = rows.length, w = rows[0].length, c = mk(w, h), x = c.getContext('2d'), i, j, ch;
      for (j = 0; j < h; j++) for (i = 0; i < w; i++) { ch = rows[j].charAt(i); if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); } }
      return c;
    }
    function flipH(src) { var c = mk(src.width, src.height), x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
    function glowSprite(rad, col, hard) {
      var d = rad * 2, c = mk(d, d), x = c.getContext('2d'), gr = x.createRadialGradient(rad, rad, 0.5, rad, rad, rad);
      gr.addColorStop(0, col + '1)'); gr.addColorStop(hard || 0.42, col + '0.92)'); gr.addColorStop(0.72, col + '0.4)'); gr.addColorStop(0.9, col + '0.12)'); gr.addColorStop(1, col + '0)');
      x.fillStyle = gr; x.fillRect(0, 0, d, d); return c;
    }

    /* ---- the three stages: the same map and rules, dressed three ways. 'palmer' is the cave exactly as it was;
       'snake' is Shadow Moses (steel ducts, snow-blue light, tripwires for villi, cameras for bumpers, codec green);
       'chief' is a Forerunner interior (purple-blue metal, hard-light panels, plasma conduits, shields, Cortana blue). */
    var THEMES = {
      palmer: {
        water: '#0b0710', speck: ['#150c14', '#1b1018'], wallBase: '#3c1420', wallSpk: ['#4d1b29', '#2e0e18'], wallLine: '#571f2e', rim: '#7a2a3a',
        fil: ['#43141f', '#5d2231'], chev: ['#5e86a8', '#3d5a76'], curve: true,
        villi: [['#4c1421', '#b8556a', '#eda3b0'], ['#611322', '#e2506c', '#ffd0d8']],
        warmLamp: 'rgba(255,168,74,', warmYou: 'rgba(150,205,255,', warmBump: 'rgba(255,190,90,', tint: null, scan: false,
        title: '#f2d16b', body: '#f4f6fb', sub: '#c8899a', dim: '#9aa3b8', go: '#7ef0a8', rule: '#7a2a3a', box: 'rgba(6,3,10,.72)',
        dept: 'DEPT. OF FINANCE', place: 'LOWER INTESTINE · SUB-LEVEL 3', l1: 'THE WALLS ABSORB YOUR BUDGET.', l2: 'FIND THE CLOUD COMPUTE NOBODY CLAIMED.',
        hint: 'DO NOT TOUCH THE WALLS', drown1: 'THE VILLI HAVE ABSORBED EVERY PENNY.', ewj: "Dunc's  now", name: 'DUNC', bumpSfx: null,
        pipe: ['#2a1a26', '#4a2a3a'], light: 'rgba(160,210,255,'
      },
      snake: {
        water: '#070b12', speck: ['#0e1520', '#121a28'], wallBase: '#3a4452', wallSpk: ['#4a5566', '#2a323e'], wallLine: '#283040', rim: '#8a97a8',
        fil: ['#2a323e', '#4a5566'], chev: ['#7ab8e8', '#3d6a96'], curve: false,
        villi: [['#1e2630', '#6a7a8c', '#ff3b3b'], ['#2a3340', '#8a9aac', '#ff9090']],
        warmLamp: 'rgba(170,210,255,', warmYou: 'rgba(190,220,255,', warmBump: 'rgba(255,90,90,', tint: 'rgba(120,170,255,.07)', scan: true,
        title: '#7bd88f', body: '#bff5c8', sub: '#5fae70', dim: '#6f9c7c', go: '#7bd88f', rule: '#2fbf6a', box: 'rgba(2,14,8,.84)',
        dept: 'FOXHOUND · DEPT. OF FINANCE', place: 'SHADOW MOSES · FINANCE B1', l1: 'THE TRIPWIRES ABSORB YOUR BUDGET.', l2: 'YOU ARE NOT A SALAMANDER. YOU ARE A LEGEND.',
        hint: 'DO NOT TRIP THE WIRES', drown1: 'THE TRIPWIRES HAVE ABSORBED EVERY PENNY.', ewj: "Snake's  now", name: 'SNAKE', bumpSfx: 'alert', laser: true,
        pipe: ['#1e2630', '#3a4452'], light: 'rgba(190,220,255,'
      },
      chief: {
        water: '#0a0716', speck: ['#14102a', '#1a1434'], wallBase: '#2a2458', wallSpk: ['#3a3270', '#1e1a40'], wallLine: '#4a3e8a', rim: '#6a5ad0',
        fil: ['#1e1a40', '#3a3270'], chev: ['#7ad8ff', '#3d7a96'], curve: true,
        villi: [['#1a1240', '#7b5cff', '#9df4ff'], ['#241a58', '#9d80ff', '#dffbff']],
        warmLamp: 'rgba(120,200,255,', warmYou: 'rgba(150,205,255,', warmBump: 'rgba(100,200,255,', tint: 'rgba(90,70,255,.06)', scan: false,
        title: '#6fc3ff', body: '#d8f0ff', sub: '#8ab8e0', dim: '#7f9fc0', go: '#9ad8ff', rule: '#4aa8ff', box: 'rgba(4,8,24,.84)',
        dept: 'UNSC · DEPT. OF FINANCE', place: 'FORERUNNER VAULT · SUB-LEVEL 3', l1: 'THE CONDUITS ABSORB YOUR BUDGET.', l2: 'FINISH THE FIGHT. CLAIM THE UNDERSPEND.',
        hint: 'DO NOT TOUCH THE CONDUITS', drown1: 'THE CONDUITS HAVE DRAINED EVERY PENNY.', ewj: "Chief's  now", name: 'CHIEF', bumpSfx: 'zap',
        pipe: ['#1e1a40', '#3a3270'], light: 'rgba(140,200,255,'
      }
    };
    var SALA = [], SALAL = [], VILL = [], CRED = [], BUMP = [], AUDIT = [], LAMP = null, EXITS = [], HOST = [], HEAD = null, BOX = null;
    var PUNCH = {}, WARM = {}, WALLT = [], VIG = null, SPOT = null, spritesBuilt = false;
    var NA = 32, NLEN = 3;

    var SALA_BASE = [
      '.................rr...kkkkkk..',
      '................rRr.kkyyyyyykk',
      '...........kkkkkRkkkkwwyyyyywk',
      '.........kkwwwwwwwwwwwwwwwwwwk',
      '........kwwwwwwwwwwwwwwwwwwwwk',
      '.......kwwwwwwwwwwwwwkbbbbbbbk',
      '.......kwwwwwwwwwwwwwkbccbccbk',
      '.......kwwwwwwwwwwwwwkbccbccbk',
      '.......kwwwwwwwwwwwwwkbbbbbbbk',
      '........kwwwwwwwwwwwwwwwwwwwk.',
      '.........kppwwwwwwwwwwwwwwwwk.',
      '..........kkpppppppppppppppk..',
      '............kkkkkkkkkkkkkkk...',
      '..............................',
      '..............................',
      '..............................'
    ];
    function buildSalamander() {
      var f, i, c, x, ph, hgt, oy, base = art(SALA_BASE, PAL);
      for (f = 0; f < 4; f++) {
        c = mk(30, 16); x = c.getContext('2d'); x.imageSmoothingEnabled = false; ph = f / 4 * TAU;
        /* far legs first, in shade, then the tail, then the body, then the near legs */
        legOf(x, 13, ph + 1.9, PAL.s, '#6a4e50', 1);
        legOf(x, 21, ph + 0.4, PAL.s, '#6a4e50', 1);
        for (i = 0; i <= 9; i++) {
          hgt = Math.min(4, (1 + i * 0.45) | 0);
          oy = Math.round(Math.sin(ph - (9 - i) * 0.55) * (9 - i) * 0.28);
          R(x, PAL.k, 1 + i, 7 - hgt - 1 + oy, 1, hgt * 2 + 3);
          R(x, i > 5 ? PAL.w : PAL.p, 1 + i, 7 - hgt + oy, 1, hgt * 2 + 1);
        }
        x.drawImage(base, 0, 0);
        legOf(x, 12, ph, PAL.w, PAL.k, 0);
        legOf(x, 20, ph + 2.4, PAL.w, PAL.k, 0);
        R(x, PAL.k, 16, 1 + ((Math.sin(ph) > 0) ? 0 : 1), 3, 2); R(x, PAL.r, 16, 1 + ((Math.sin(ph) > 0) ? 0 : 1), 2, 1);
        R(x, PAL.k, 17, 12 - ((Math.sin(ph) > 0) ? 1 : 0), 3, 2); R(x, PAL.R, 17, 12 - ((Math.sin(ph) > 0) ? 1 : 0), 2, 1);
        SALA.push(c); SALAL.push(flipH(c));
      }
    }
    function legOf(x, x0, ph, col, dark, far) {
      var sw = Math.sin(ph) > 0 ? 1 : -1, y0 = far ? 10 : 11;
      R(x, dark, x0 - 1, y0, 4, 5);
      R(x, col, x0, y0, 2, 3);
      R(x, col, x0 + sw, y0 + 3, 2, 1);
      R(x, dark, x0 + sw, y0 + 4, 2, 1);
    }
    /* the same salamander, re-dressed: Snake (grey sneaking suit, bandana with tails, stubble) and the
       Chief (olive armour, a gold visor where the glasses were). Same 30x16 frames, same walk, same flip. */
    function buildSalamanderSkin(sk) {
      var f, i, c, x, ph, hgt, oy, pal = {}, k, base, bx, bw, bp, far, farD, ln;
      for (k in PAL) pal[k] = PAL[k];
      var BAND = '#5f7fb8', BANDH = '#8fb0ff', BANDD = '#2e4474', SUITH = '#b6bec9';
      if (sk === 'snake') { bw = '#8e97a6'; bp = '#6a7382'; far = '#5c6472'; farD = '#3a3f4a'; pal.w = bw; pal.p = bp; pal.y = BAND; pal.r = BAND; pal.R = BANDD; }
      else { bw = '#6b7a3f'; bp = '#4e5a2e'; far = '#3d4624'; farD = '#262c18'; pal.w = bw; pal.p = bp; pal.y = '#55632f'; pal.r = '#55632f'; pal.R = '#3d4624'; pal.b = '#1c1c14'; pal.c = '#e8a020'; }
      base = art(SALA_BASE, pal); bx = base.getContext('2d');
      bx.clearRect(16, 0, 3, 3);                                       /* the pink crest goes: a knot or a helmet ridge lives there now */
      if (sk === 'snake') {
        var pale = art(SALA_BASE, PAL);                                 /* the face stays the salamander's own pale skin */
        bx.clearRect(21, 3, 9, 9); bx.drawImage(pale, 21, 3, 9, 9, 21, 3, 9, 9);
        R(bx, BANDD, 21, 1, 8, 2); R(bx, BAND, 21, 1, 8, 1); R(bx, BANDH, 22, 1, 5, 1); R(bx, PAL.k, 20, 1, 1, 3); R(bx, BAND, 20, 2, 1, 2);
        R(bx, SUITH, 9, 4, 12, 1); R(bx, SUITH, 11, 3, 9, 1);              /* a lit stripe along the back so the suit is not one grey */
        R(bx, '#8a8078', 23, 9, 1, 1); R(bx, '#8a8078', 25, 9, 1, 1); R(bx, '#8a8078', 27, 9, 1, 1); R(bx, '#8a8078', 24, 10, 1, 1); R(bx, '#8a8078', 26, 10, 1, 1);
      } else {
        R(bx, '#55632f', 21, 1, 8, 2); R(bx, '#8a9c58', 22, 1, 6, 1); R(bx, '#8a9c58', 21, 3, 8, 1);
        R(bx, '#1c1c14', 21, 5, 8, 1); R(bx, '#e8a020', 21, 6, 8, 2); R(bx, '#ffe08a', 22, 6, 5, 1); R(bx, '#9a6410', 21, 8, 8, 1);
        R(bx, '#4e5a2e', 23, 9, 5, 2); R(bx, '#8a9c58', 9, 5, 7, 1); R(bx, '#4e5a2e', 9, 9, 10, 1);
      }
      for (f = 0; f < 4; f++) {
        c = mk(30, 16); x = c.getContext('2d'); x.imageSmoothingEnabled = false; ph = f / 4 * TAU;
        legOf(x, 13, ph + 1.9, far, farD, 1);
        legOf(x, 21, ph + 0.4, far, farD, 1);
        for (i = 0; i <= 9; i++) {
          hgt = Math.min(4, (1 + i * 0.45) | 0);
          oy = Math.round(Math.sin(ph - (9 - i) * 0.55) * (9 - i) * 0.28);
          R(x, PAL.k, 1 + i, 7 - hgt - 1 + oy, 1, hgt * 2 + 3);
          R(x, i > 5 ? bw : bp, 1 + i, 7 - hgt + oy, 1, hgt * 2 + 1);
        }
        x.drawImage(base, 0, 0);
        legOf(x, 12, ph, bw, PAL.k, 0);
        legOf(x, 20, ph + 2.4, bw, PAL.k, 0);
        if (sk === 'snake') {
          for (ln = 0; ln < 2; ln++) for (i = 0; i < 7 - ln; i++) {   /* the bandana tails stream back and ripple with the stroke */
            oy = ln * 2 + Math.round(Math.sin(ph + i * 0.9 + ln * 1.4) * 1.3 + i * 0.25);
            R(x, PAL.k, 19 - i, oy - 1, 1, 4); R(x, BAND, 19 - i, oy, 1, 2); if (i % 2 === 0) R(x, BANDH, 19 - i, oy, 1, 1);
          }
        } else { R(x, PAL.k, 16, 1 + ((Math.sin(ph) > 0) ? 0 : 1), 3, 2); R(x, '#55632f', 16, 1 + ((Math.sin(ph) > 0) ? 0 : 1), 2, 1); }
        R(x, PAL.k, 17, 12 - ((Math.sin(ph) > 0) ? 1 : 0), 3, 2); R(x, bp, 17, 12 - ((Math.sin(ph) > 0) ? 1 : 0), 2, 1);
        SALA.push(c); SALAL.push(flipH(c));
      }
      /* Snake's cardboard box: his idle under the quiz desk, and his drowning pose */
      BOX = mk(16, 11); x = BOX.getContext('2d');
      R(x, '#3a2a14', 0, 0, 16, 11); R(x, '#b08a52', 1, 1, 14, 9); R(x, '#c9a46a', 1, 1, 14, 3); R(x, '#7a5a32', 1, 4, 14, 1); R(x, '#7a5a32', 8, 1, 1, 3);
      R(x, '#7a5a32', 3, 6, 5, 1); R(x, '#7a5a32', 3, 8, 7, 1); R(x, '#e8d8b0', 11, 6, 3, 3);
    }
    function buildVilli() {
      var a, L, t, i, c, x, len, ang, px0, py0, cur, w, col, dark, tip;
      for (t = 0; t < 2; t++) for (L = 0; L < NLEN; L++) for (a = 0; a < NA; a++) {
        len = 6 + L * 3; c = mk(30, 30); x = c.getContext('2d'); ang = a / NA * TAU;
        dark = TH.villi[t][0]; col = TH.villi[t][1]; tip = TH.villi[t][2];
        cur = TH.curve ? (a % 3 - 1) * 0.06 : 0;
        if (TH.laser) {                                              /* a tripwire: emitter box on the wall, a 1 px red beam to a bright tip; same extents as the villus */
          for (i = 2; i <= len; i++) { px0 = 15 + Math.cos(ang) * i; py0 = 15 + Math.sin(ang) * i; R(x, dark, px0 - 1.5, py0 - 1.5, 3, 3); }
          for (i = 2; i <= len; i++) { px0 = 15 + Math.cos(ang) * i; py0 = 15 + Math.sin(ang) * i; R(x, tip, px0 - 0.5, py0 - 0.5, 1, 1); }
          R(x, dark, 12, 12, 7, 7); R(x, col, 13, 13, 5, 5); R(x, dark, 14, 14, 3, 3);
          R(x, tip, 15 + Math.cos(ang) * 1.5 - 0.5, 15 + Math.sin(ang) * 1.5 - 0.5, 1, 1);
          px0 = 15 + Math.cos(ang) * len; py0 = 15 + Math.sin(ang) * len; R(x, '#fff0f0', px0 - 1, py0 - 1, 2, 2);
          VILL.push(c); continue;
        }
        for (i = 0; i <= len; i++) {                                 /* dark outline pass */
          px0 = 15 + Math.cos(ang + cur * i) * i; py0 = 15 + Math.sin(ang + cur * i) * i;
          w = i < len * 0.35 ? 4 : i < len * 0.72 ? 3 : 2;
          R(x, dark, px0 - w / 2, py0 - w / 2, w, w);
        }
        for (i = 0; i <= len; i++) {
          px0 = 15 + Math.cos(ang + cur * i) * i; py0 = 15 + Math.sin(ang + cur * i) * i;
          w = i < len * 0.35 ? 3 : i < len * 0.72 ? 2 : 1;
          R(x, i > len - 2 ? tip : col, px0 - w / 2, py0 - w / 2, w, w);
        }
        VILL.push(c);
      }
    }
    function buildProps() {
      var i, j, c, x, k, d, r, fr;
      /* compute credit: a spinning gold token, pound side and cloud side */
      var PND = ['.###.', '#...#', '#....', '###..', '#....', '#....', '#####'];
      for (fr = 0; fr < 6; fr++) {
        var wdt = [15, 15, 11, 5, 11, 15][fr];
        c = mk(17, 17); x = c.getContext('2d');
        for (j = 0; j < 17; j++) for (i = 0; i < 17; i++) {
          var ex = (i - 8) / (wdt / 2), ey = (j - 8) / 7.5, ed = ex * ex + ey * ey;
          if (ed > 1.05) continue;
          R(x, ed > 0.78 ? PAL.k : ed > 0.58 ? (j > 8 ? '#8a6410' : '#ffeaa8') : (j > 9 ? PAL.Y : PAL.n), i, j, 1, 1);
        }
        if (wdt >= 11) {
          if (fr === 5 || fr === 4) { R(x, '#7a5608', 6, 8, 6, 2); R(x, '#7a5608', 7, 7, 3, 1); R(x, '#7a5608', 9, 6, 3, 2); R(x, '#7a5608', 5, 9, 8, 1); }
          else for (j = 0; j < 7; j++) for (i = 0; i < 5; i++) if (PND[j].charAt(i) === '#') R(x, '#7a5608', 6 + i * (wdt >= 15 ? 1 : 1) - (wdt >= 15 ? 0 : 1), 5 + j, 1, 1);
          R(x, '#fff8e0', 5, 4, 2, 1);
        }
        CRED.push(c);
      }
      /* bumper: a lit disc that fires you across the cavern (a security camera at Shadow Moses, a shield in the vault) */
      for (fr = 0; fr < 2; fr++) {
        c = mk(30, 30); x = c.getContext('2d');
        for (j = 0; j < 30; j++) for (i = 0; i < 30; i++) {
          d = Math.hypot(i - 14.5, j - 14.5);
          if (d > 14.6) continue;
          if (SKIN === 'snake') {
            if (d > 12.4) R(x, PAL.k, i, j, 1, 1);
            else if (d > 9.6) R(x, fr ? '#ffffff' : (((i + j) & 3) < 2 ? '#6a7a8c' : '#3a4452'), i, j, 1, 1);
            else if (d > 8) R(x, '#0a0c10', i, j, 1, 1);
            else if (d > 5) R(x, fr ? '#ff3b3b' : '#1c2430', i, j, 1, 1);
            else R(x, fr ? '#ff3b3b' : '#0a0c10', i, j, 1, 1);
          } else if (SKIN === 'chief') {
            if (d > 12.4) R(x, '#0a0a1e', i, j, 1, 1);
            else if (d > 9.6) R(x, fr ? '#ffffff' : (((i + j) & 3) < 2 ? '#4ad0ff' : '#2a7ab0'), i, j, 1, 1);
            else if (d > 8) R(x, '#102040', i, j, 1, 1);
            else if (d > 5) R(x, fr ? '#dffbff' : '#1a3a6a', i, j, 1, 1);
            else R(x, fr ? '#ffffff' : '#9df4ff', i, j, 1, 1);
          } else {
            if (d > 12.4) R(x, PAL.k, i, j, 1, 1);
            else if (d > 9.6) R(x, fr ? '#ffffff' : (((i + j) & 3) < 2 ? '#f2d16b' : '#b88a1e'), i, j, 1, 1);
            else if (d > 8) R(x, '#2a1420', i, j, 1, 1);
            else if (d > 5) R(x, fr ? '#fff6d8' : '#6a2b3c', i, j, 1, 1);
            else R(x, fr ? '#ffffff' : '#ffd98a', i, j, 1, 1);
          }
        }
        if (SKIN === 'snake') {
          if (fr) { R(x, '#ffffff', 14, 7, 3, 9); R(x, '#ffffff', 14, 18, 3, 3); }                 /* "!" */
          else { R(x, '#ffffff', 11, 10, 2, 2); R(x, '#ff3b3b', 20, 8, 2, 2); }                     /* lens glint and the little red LED */
        } else if (SKIN === 'chief') { R(x, fr ? '#ffffff' : '#dffbff', 11, 10, 2, 2); R(x, fr ? '#ffffff' : '#4ad0ff', 14, 4, 2, 2); R(x, fr ? '#ffffff' : '#4ad0ff', 14, 24, 2, 2); }
        else R(x, fr ? '#ffffff' : '#fff5cf', 11, 10, 2, 2);
        BUMP.push(c);
      }
      /* SPOT AUDIT drone: a dark diamond with one red eye */
      for (fr = 0; fr < 2; fr++) {
        c = mk(22, 22); x = c.getContext('2d');
        for (j = 0; j < 22; j++) for (i = 0; i < 22; i++) {
          d = Math.abs(i - 10.5) + Math.abs(j - 10.5);
          if (d > 10.5) continue;
          R(x, d > 8.5 ? '#160a10' : d > 7 ? '#5b1b26' : '#2a1018', i, j, 1, 1);
        }
        R(x, fr ? '#ff5a5a' : '#8a1f24', 8, 9, 5, 3); R(x, fr ? '#ffd9d9' : '#c4444a', 10, 10, 2, 1);
        R(x, '#3a2430', 5, 5, 2, 1); R(x, '#3a2430', 15, 16, 2, 1);
        AUDIT.push(c);
      }
      /* petty-cash lamp bolted to the wall (a vent light at Shadow Moses, a hard-light panel in the vault) */
      c = mk(18, 16); x = c.getContext('2d');
      if (SKIN === 'snake') {
        R(x, PAL.k, 3, 0, 12, 4); R(x, '#4a5566', 4, 1, 10, 2); R(x, '#6a7a8c', 4, 1, 10, 1);
        R(x, PAL.k, 5, 3, 8, 3); R(x, '#283040', 6, 4, 6, 1);
        R(x, PAL.k, 2, 5, 14, 8); R(x, '#1c2430', 3, 6, 12, 6);
        R(x, '#9fd0ff', 4, 6, 10, 5); R(x, '#d6ecff', 5, 7, 8, 3); R(x, '#ffffff', 7, 7, 4, 2);
        R(x, '#283040', 4, 8, 10, 1); R(x, '#283040', 4, 10, 10, 1);
        R(x, PAL.k, 4, 12, 10, 2); R(x, '#3a4452', 5, 12, 8, 1);
      } else if (SKIN === 'chief') {
        R(x, '#0a0a1e', 3, 0, 12, 4); R(x, '#3a3270', 4, 1, 10, 2); R(x, '#6a5ad0', 4, 1, 10, 1);
        R(x, '#0a0a1e', 5, 3, 8, 3); R(x, '#241a58', 6, 4, 6, 1);
        R(x, '#0a0a1e', 2, 5, 14, 8); R(x, '#1e1a40', 3, 6, 12, 6);
        R(x, '#4ad0ff', 4, 6, 10, 5); R(x, '#9df4ff', 5, 7, 8, 3); R(x, '#ffffff', 7, 7, 4, 2);
        R(x, '#0a0a1e', 4, 12, 10, 2); R(x, '#3a3270', 5, 12, 8, 1);
      } else {
        R(x, PAL.k, 3, 0, 12, 4); R(x, '#4a3b2a', 4, 1, 10, 2); R(x, '#6b5738', 4, 1, 10, 1);
        R(x, PAL.k, 5, 3, 8, 3); R(x, '#33291c', 6, 4, 6, 1);
        R(x, PAL.k, 2, 5, 14, 8); R(x, '#241c14', 3, 6, 12, 6);
        R(x, '#ffb35c', 4, 6, 10, 5); R(x, '#ffd79a', 5, 7, 8, 3); R(x, '#fff6e0', 7, 7, 4, 2);
        R(x, PAL.k, 4, 12, 10, 2); R(x, '#3a2e1e', 5, 12, 8, 1);
      }
      LAMP = c;
      /* the underspend: a rusted outflow valve stuffed with unclaimed cloud compute */
      for (fr = 0; fr < 2; fr++) {
        c = mk(44, 44); x = c.getContext('2d');
        for (j = 0; j < 44; j++) for (i = 0; i < 44; i++) {
          d = Math.hypot(i - 21.5, j - 21.5);
          if (d > 21) continue;
          if (d > 18) R(x, '#1b1016', i, j, 1, 1);
          else if (d > 15) R(x, ((i + j) & 3) < 2 ? '#4a5a4e' : '#33403a', i, j, 1, 1);
          else if (d > 13) R(x, '#0f1512', i, j, 1, 1);
          else R(x, d > 9 ? (fr ? '#8ef5b6' : '#5fd694') : (fr ? '#eafff2' : '#a8f7c8'), i, j, 1, 1);
        }
        for (k = 0; k < 6; k++) { var aa = k / 6 * TAU + fr * 0.26; R(x, '#26302a', 21 + Math.cos(aa) * 16 - 1, 21 + Math.sin(aa) * 16 - 1, 3, 3); }
        R(x, '#0f1512', 15, 18, 13, 8); R(x, fr ? '#eafff2' : '#c9ffdf', 16, 19, 11, 6);
        R(x, '#0f1512', 18, 20, 2, 4); R(x, '#0f1512', 22, 20, 2, 4); R(x, '#0f1512', 20, 22, 2, 2);
        EXITS.push(c);
      }
      /* wall tiles: fleshy, mottled, two variants (riveted steel / glyph-striped metal on the other stages) */
      for (fr = 0; fr < 3; fr++) {
        c = mk(TS, TS); x = c.getContext('2d');
        R(x, TH.wallBase, 0, 0, TS, TS);
        for (k = 0; k < 42; k++) { var bx0 = (Math.random() * TS) | 0, by0 = (Math.random() * TS) | 0, bs = 1 + ((Math.random() * 3) | 0); R(x, Math.random() < 0.5 ? TH.wallSpk[0] : TH.wallSpk[1], bx0, by0, bs, bs); }
        for (k = 0; k < 7; k++) { var vy0 = (Math.random() * TS) | 0; R(x, TH.wallLine, 0, vy0, TS, 1); }
        if (SKIN === 'snake') { R(x, '#222a34', 0, 15, TS, 2); R(x, '#5a6878', 2, 2, 2, 2); R(x, '#5a6878', 28, 2, 2, 2); R(x, '#5a6878', 2, 28, 2, 2); R(x, '#5a6878', 28, 28, 2, 2); R(x, '#222a34', 15, 0, 2, TS); }
        else if (SKIN === 'chief') { R(x, '#1a1434', 0, 13, TS, 4); for (k = 0; k < 5; k++) R(x, (k + fr) % 3 ? '#5a7ad0' : '#9df4ff', 2 + k * 6, 14, 3, 2); }
        WALLT.push(c);
      }
      /* light punches and warm blooms, pre-rendered once */
      PUNCH.you = glowSprite(86, 'rgba(255,255,255,', 0.3);
      PUNCH.lamp = glowSprite(58, 'rgba(255,255,255,', 0.3);
      PUNCH.credit = glowSprite(34, 'rgba(255,255,255,', 0.3);
      PUNCH.bumper = glowSprite(40, 'rgba(255,255,255,', 0.3);
      PUNCH.exit = glowSprite(70, 'rgba(255,255,255,', 0.32);
      PUNCH.audit = glowSprite(30, 'rgba(255,255,255,', 0.3);
      WARM.you = glowSprite(66, TH.warmYou, 0.1);
      WARM.lamp = glowSprite(52, TH.warmLamp, 0.1);
      WARM.credit = glowSprite(26, 'rgba(255,208,96,', 0.1);
      WARM.bumper = glowSprite(30, TH.warmBump, 0.1);
      WARM.exit = glowSprite(58, 'rgba(110,240,170,', 0.1);
      WARM.audit = glowSprite(24, 'rgba(255,70,70,', 0.1);
      WARM.hit = glowSprite(46, 'rgba(255,255,255,', 0.1);
      SPOT = mk(140, 190); var sp2 = SPOT.getContext('2d');
      var sgr = sp2.createLinearGradient(0, 0, 0, 190);
      sgr.addColorStop(0, 'rgba(255,214,140,.22)'); sgr.addColorStop(1, 'rgba(255,214,140,0)');
      sp2.fillStyle = sgr; sp2.beginPath(); sp2.moveTo(62, 0); sp2.lineTo(78, 0); sp2.lineTo(134, 190); sp2.lineTo(6, 190); sp2.closePath(); sp2.fill();
      VIG = mk(VW, VH); var vg = VIG.getContext('2d');
      var vgr = vg.createRadialGradient(VW / 2, VH / 2, VH * 0.18, VW / 2, VH / 2, VH * 0.78);
      vgr.addColorStop(0, 'rgba(150,12,30,0)'); vgr.addColorStop(0.55, 'rgba(150,12,30,.35)'); vgr.addColorStop(1, 'rgba(190,20,36,1)');
      vg.fillStyle = vgr; vg.fillRect(0, 0, VW, VH);
    }
    function buildCast() {
      var c, x, fr, k;
      /* THE HOST of "SPEND IT OR LOSE IT!": a box man, a jacket you can hear, and a microphone */
      for (fr = 0; fr < 3; fr++) {
        c = mk(64, 108); x = c.getContext('2d'); var Kk = '#12101a', my = fr === 0 ? 0 : fr === 1 ? -3 : -6;
        R(x, Kk, 16, 82, 14, 24); R(x, '#2b2536', 18, 82, 10, 22);
        R(x, Kk, 34, 82, 14, 24); R(x, '#2b2536', 36, 82, 10, 22);
        R(x, Kk, 12, 100, 19, 8); R(x, '#0a0810', 13, 101, 17, 6);
        R(x, Kk, 33, 100, 19, 8); R(x, '#0a0810', 34, 101, 17, 6);
        R(x, Kk, 7, 44, 50, 44); R(x, '#8d2f7a', 9, 46, 46, 40);
        for (k = 0; k < 34; k++) R(x, k % 3 ? '#c559ab' : '#ffe6f8', 11 + ((k * 13) % 42), 49 + ((k * 17) % 34), 2, 2);
        R(x, '#f4f6fb', 24, 46, 16, 34); R(x, '#d6dae6', 24, 74, 16, 6);
        R(x, '#6d1f5e', 18, 46, 7, 38); R(x, '#6d1f5e', 39, 46, 7, 38);
        R(x, Kk, 23, 50, 18, 11); R(x, '#e3625b', 24, 51, 7, 9); R(x, '#e3625b', 33, 51, 7, 9); R(x, '#9f2f2a', 30, 53, 4, 5);
        R(x, Kk, 2, 46, 11, 36); R(x, '#8d2f7a', 3, 47, 9, 34); R(x, Kk, 2, 80, 11, 9); R(x, '#f6d3b0', 3, 81, 9, 7);
        R(x, Kk, 51, 50 + my, 12, 30); R(x, '#8d2f7a', 52, 51 + my, 10, 28);
        R(x, Kk, 49, 44 + my, 13, 10); R(x, '#f6d3b0', 50, 45 + my, 11, 8); R(x, '#d9ab88', 50, 50 + my, 11, 3);
        R(x, Kk, 48, 30 + my, 9, 18); R(x, '#3b4252', 49, 31 + my, 7, 16); R(x, '#6d7688', 49, 31 + my, 2, 16);
        R(x, Kk, 44, 18 + my, 17, 16); R(x, '#9aa3b8', 45, 19 + my, 15, 14); R(x, '#d6dae6', 47, 21 + my, 6, 6);
        for (k = 0; k < 4; k++) R(x, '#4a5164', 46, 20 + my + k * 3, 13, 1);
        R(x, '#5c6478', 45, 30 + my, 15, 4);
        R(x, Kk, 15, 12, 34, 36); R(x, '#f6d3b0', 17, 14, 30, 32); R(x, '#d9ab88', 17, 42, 30, 4);
        R(x, Kk, 11, 0, 42, 18); R(x, '#5a4330', 13, 2, 38, 14); R(x, '#8a6c4e', 15, 3, 16, 5); R(x, '#3c2c1e', 13, 13, 38, 3);
        R(x, Kk, 43, 0, 14, 10); R(x, '#5a4330', 44, 1, 12, 8);
        R(x, Kk, 20, 18, 10, 3); R(x, Kk, 34, 18, 10, 3);
        R(x, Kk, 21, 22, 8, 8); R(x, '#ffffff', 22, 23, 6, 6); R(x, Kk, 24, 25, 3, 3);
        R(x, Kk, 35, 22, 8, 8); R(x, '#ffffff', 36, 23, 6, 6); R(x, Kk, 38, 25, 3, 3);
        if (fr === 2) { R(x, Kk, 22, 33, 20, 12); R(x, '#4a1620', 24, 35, 16, 9); R(x, '#ffffff', 24, 35, 16, 4); R(x, '#c4677a', 27, 41, 10, 3); }
        else { R(x, Kk, 21, 34, 22, 6); R(x, '#ffffff', 22, 35, 20, 4); R(x, Kk, 19, 31, 3, 3); R(x, Kk, 42, 31, 3, 3); }
        HOST.push(c);
      }
      /* an audience, in silhouette, ready to go ooooh */
      HEAD = [];
      for (fr = 0; fr < 4; fr++) {
        c = mk(20, 26); x = c.getContext('2d');
        var hc = ['#1c2338', '#28304c', '#151b2c', '#323b5e'][fr], rim = ['#39456a', '#4a5680', '#2c3552', '#525f8c'][fr];
        R(x, hc, 5, 3, 10, 10); R(x, hc, 4, 4, 12, 8); R(x, rim, 5, 3, 10, 2);
        if (fr === 1) R(x, hc, 4, 0, 12, 4);
        if (fr === 3) { R(x, hc, 2, 5, 16, 7); R(x, rim, 3, 5, 14, 2); }
        if (fr === 2) { R(x, hc, 3, 2, 14, 4); R(x, rim, 4, 2, 12, 1); }
        R(x, hc, 1, 15, 18, 11); R(x, hc, 4, 12, 12, 4); R(x, rim, 3, 15, 14, 2);
        HEAD.push(c);
      }
    }
    function pixHeart(cx0, cy0, sc, col) {
      var ROWS = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], j, i;
      for (j = 0; j < ROWS.length; j++) for (i = 0; i < 7; i++) if (ROWS[j].charAt(i) === '#') { g.fillStyle = col; g.fillRect(cx0 + i * sc, cy0 + j * sc, sc, sc); }
    }
    var builtSkin = null;
    function buildSprites() {
      SALA.length = SALAL.length = VILL.length = CRED.length = BUMP.length = AUDIT.length = EXITS.length = HOST.length = WALLT.length = 0; HEAD = null; LAMP = null; BOX = null;
      if (SKIN === 'palmer') buildSalamander(); else buildSalamanderSkin(SKIN);
      buildVilli(); buildProps(); buildCast(); builtSkin = SKIN;
    }

    /* ------------------------------------------------------------ the world, built once from MAP */
    var solid = null, cur = null, STATIC = null, vbx = null, vby = null, vang = null, vlen = null, vph = null, vStart = null, vCount = null;
    var CREDS = [], BUMPS = [], LAMPS = [], AUDITS = [], EXIT = { x: 0, y: 0 }, START = { x: 0, y: 0 }, worldBuilt = false;
    function tileSolid(tx, ty) { return (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? 1 : solid[ty * MW + tx]; }
    function solidAtPx(x, y) { return tileSolid((x / TS) | 0, (y / TS) | 0); }
    function buildWorld() {
      var tx, ty, ch, i, k, idx, x, y;
      solid = new Uint8Array(MW * MH); cur = new Uint8Array(MW * MH);
      CREDS.length = 0; BUMPS.length = 0; LAMPS.length = 0; AUDITS.length = 0;
      for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {
        ch = MAP[ty].charAt(tx); idx = ty * MW + tx; x = tx * TS + TS / 2; y = ty * TS + TS / 2;
        if (ch === '#') { solid[idx] = 1; continue; }
        if (ch === 'S') { START.x = x; START.y = y; }
        else if (ch === 'E') { EXIT.x = x; EXIT.y = y; }
        else if (ch === 'c') CREDS.push({ x: x, y: y, got: 0, ph: Math.random() * TAU });
        else if (ch === 'o') BUMPS.push({ x: x, y: y, name: BUMPER_NAMES[BUMPS.length % BUMPER_NAMES.length], flash: 0, ring: 0 });
        else if (ch === 'L') LAMPS.push({ x: x, y: y, ph: Math.random() * TAU });
        else if (ch === 'x') AUDITS.push({ x: x, y: y, x0: x, y0: y, vx: 0, vy: 0, ph: Math.random() * TAU });
        else if (ch === '>') cur[idx] = 1; else if (ch === '<') cur[idx] = 2;
        else if (ch === 'v') cur[idx] = 3; else if (ch === '^') cur[idx] = 4;
      }
      for (i = 0; i < AUDITS.length; i++) {                           /* each drone patrols the longer of its two open runs */
        var a = AUDITS[i], atx = (a.x / TS) | 0, aty = (a.y / TS) | 0, hn = 0, vn = 0;
        for (k = 1; k < 4; k++) { if (!tileSolid(atx - k, aty) || !tileSolid(atx + k, aty)) hn++; if (!tileSolid(atx, aty - k) || !tileSolid(atx, aty + k)) vn++; }
        if (hn >= vn) { a.vx = Math.random() < 0.5 ? -21 : 21; a.vy = 0; } else { a.vx = 0; a.vy = Math.random() < 0.5 ? -21 : 21; }
      }
      /* villi: four per wall face that looks out on water, indexed by tile so only the visible ones are drawn */
      var bx = [], by = [], ba = [], bl = [], bp = [];
      vStart = new Int32Array(MW * MH); vCount = new Uint8Array(MW * MH);
      var DX = [1, -1, 0, 0], DY = [0, 0, 1, -1], AN = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
      for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {
        idx = ty * MW + tx; vStart[idx] = bx.length;
        if (!solid[idx]) { vCount[idx] = 0; continue; }
        for (k = 0; k < 4; k++) {
          if (tileSolid(tx + DX[k], ty + DY[k])) continue;
          for (i = 0; i < 4; i++) {
            var off = 4 + i * 8 + (Math.random() * 3 - 1);
            var px0 = tx * TS + (DX[k] ? (DX[k] > 0 ? TS - 1 : 1) : off);
            var py0 = ty * TS + (DY[k] ? (DY[k] > 0 ? TS - 1 : 1) : off);
            bx.push(px0); by.push(py0); ba.push(AN[k] + (Math.random() - 0.5) * 0.5); bl.push((Math.random() * NLEN) | 0); bp.push(Math.random() * TAU);
          }
        }
        vCount[idx] = Math.min(255, bx.length - vStart[idx]);
      }
      vbx = new Float32Array(bx); vby = new Float32Array(by); vang = new Float32Array(ba); vlen = new Uint8Array(bl); vph = new Float32Array(bp);
      /* the static layer: water, flesh, rims, chevrons and the lamps bolted to the wall */
      STATIC = mk(WW, WH); var s = STATIC.getContext('2d'); s.imageSmoothingEnabled = false;
      s.fillStyle = TH.water; s.fillRect(0, 0, WW, WH);
      for (k = 0; k < 1400; k++) { var mx0 = (Math.random() * WW) | 0, my0 = (Math.random() * WH) | 0; R(s, Math.random() < 0.5 ? TH.speck[0] : TH.speck[1], mx0, my0, 1, 1); }
      for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {
        idx = ty * MW + tx; if (!solid[idx]) continue;
        s.drawImage(WALLT[(tx * 5 + ty * 3) % 3], tx * TS, ty * TS);
      }
      for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {
        idx = ty * MW + tx; if (!solid[idx]) continue;
        for (k = 0; k < 4; k++) {
          if (tileSolid(tx + DX[k], ty + DY[k])) continue;
          for (i = 0; i < TS; i++) {
            var th = 2 + ((Math.sin(i * 0.5 + tx + ty * 1.7) > 0.3) ? 1 : 0);
            if (DX[k]) R(s, TH.rim, tx * TS + (DX[k] > 0 ? TS - th : 0), ty * TS + i, th, 1);
            else R(s, TH.rim, tx * TS + i, ty * TS + (DY[k] > 0 ? TS - th : 0), 1, th);
          }
        }
      }
      for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {       /* fillets soften the square corners into something gut-like */
        if (tileSolid(tx, ty)) continue;
        for (k = 0; k < 4; k++) {
          var ax = k < 2 ? (k ? -1 : 1) : 0, ay = k < 2 ? 0 : (k === 2 ? 1 : -1);
          var bx2 = k < 2 ? 0 : 1, by2 = k < 2 ? 1 : 0;
          if (!tileSolid(tx + ax, ty + ay)) continue;
          if (!tileSolid(tx + bx2, ty + by2) || !tileSolid(tx - bx2, ty - by2)) continue;
        }
        var cnrs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (k = 0; k < 4; k++) {
          var cx0 = cnrs[k][0], cy0 = cnrs[k][1];
          if (!tileSolid(tx + cx0, ty) || !tileSolid(tx, ty + cy0)) continue;
          var ox = tx * TS + (cx0 > 0 ? TS - 7 : 0), oy = ty * TS + (cy0 > 0 ? TS - 7 : 0);
          for (i = 0; i < 7; i++) for (var j2 = 0; j2 < 7; j2++) {
            var rx = cx0 > 0 ? i : 6 - i, ry = cy0 > 0 ? j2 : 6 - j2;
            if (rx + ry > 6) R(s, rx + ry > 8 ? TH.fil[0] : TH.fil[1], ox + i, oy + j2, 1, 1);
          }
        }
      }
      for (ty = 0; ty < MH; ty++) for (tx = 0; tx < MW; tx++) {       /* current chevrons */
        idx = ty * MW + tx; if (!cur[idx]) continue;
        var d = cur[idx], cx1 = tx * TS + TS / 2, cy1 = ty * TS + TS / 2;
        var ux = d === 1 ? 1 : d === 2 ? -1 : 0, uy = d === 3 ? 1 : d === 4 ? -1 : 0;
        for (i = -1; i <= 1; i++) for (k = -6; k <= 6; k++) {
          var lead = 5 - Math.abs(k) * 0.8;                              /* chevron: a V pointing downstream */
          var qx = cx1 + ux * (i * 11 + lead) - uy * k, qy = cy1 + uy * (i * 11 + lead) + ux * k;
          R(s, Math.abs(k) < 2 ? TH.chev[0] : TH.chev[1], qx - 1, qy - 1, 2, 2);
        }
      }
      for (i = 0; i < LAMPS.length; i++) {                             /* bolt each lamp to the nearest wall */
        var L = LAMPS[i], ltx = (L.x / TS) | 0, lty = (L.y / TS) | 0, dx0 = 0, dy0 = 0;
        for (k = 0; k < 4; k++) if (tileSolid(ltx + DX[k], lty + DY[k])) { dx0 = DX[k]; dy0 = DY[k]; break; }
        L.x = ltx * TS + TS / 2 + dx0 * 10; L.y = lty * TS + TS / 2 + dy0 * 10;
        s.drawImage(LAMP, (L.x - 9) | 0, (L.y - 8) | 0);
      }
      worldBuilt = true;
    }

    /* ------------------------------------------------------------ state */
    var G = null, opts0 = null;
    var P = { x: 0, y: 0, vx: 0, vy: 0, face: 1, iT: 0, flingT: 0, ph: 0, hitT: 0, touch: 0 };
    var keys = { l: false, r: false, u: false, d: false }, stick = { on: false, id: -1, ax: 0, ay: 0, x0: 0, y0: 0 };
    var NPT = 240, ptx = new Float32Array(NPT), pty = new Float32Array(NPT), ptvx = new Float32Array(NPT), ptvy = new Float32Array(NPT),
      ptl = new Float32Array(NPT), ptm = new Float32Array(NPT), ptc = new Uint8Array(NPT), pts = new Uint8Array(NPT), ptCur = 0;
    var PTC = ['#ffffff', '#fcd34d', '#ef9fb0', '#8ad4ff', '#7ef0a8', '#e3625b', '#b8556a'];
    var BUDGET0 = 16000, NIBBLE = 320, CLING = 120, AUDIT_COST = 520, PR = 4.6, BR = 14.5, ACC = 250, DRAG = 2.3, MAXV = 105, FLING = 250;
    var BASE_PRIZE = 5000, PER_CREDIT = 1200, PER_ANSWER = 2500, PER_BOUNCE = 50, MAX_BOUNCE = 20;

    var NFT = 10, FT = [];
    for (var iF = 0; iF < NFT; iF++) FT.push({ on: false, s: '', x: 0, y: 0, life: 0, col: '#fff' });
    function floatText(str, x, y, col) {
      for (var i = 0; i < NFT; i++) if (!FT[i].on) { FT[i].on = true; FT[i].s = str; FT[i].x = x; FT[i].y = y; FT[i].life = 1.1; FT[i].col = col; return; }
    }
    function spark(x, y, vx, vy, life, col, size) {
      var i = ptCur; ptCur = (ptCur + 1) % NPT;
      ptx[i] = x; pty[i] = y; ptvx[i] = vx; ptvy[i] = vy; ptl[i] = life; ptm[i] = life; ptc[i] = col; pts[i] = size;
    }
    function puff(x, y, n, col, spd) { for (var k = 0; k < n; k++) { var a = Math.random() * TAU, v = rnd(spd * 0.3, spd); spark(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.25, 0.6), col, 1 + ((Math.random() * 2) | 0)); } }
    function newRun() {
      G = {
        mode: TRANS ? 'flush' : 'ewj', t: 0, cardT: 0, flCue: 0, outT: 0, outCue: 0, outRes: null, budget: BUDGET0, got: 0, bounces: 0, shake: 0, flash: 0, vig: 0,
        camx: 0, camy: 0, paused: false, doneSent: false, claimT: 0, drownT: 0, hint: 6,
        qi: 0, qt: 0, qphase: 'in', qsel: -1, qright: 0, qlist: null, qflash: 0, qcheer: 0, cowT: 0, tallyT: 0, prize: 0, hearts: 0
      };
      P.x = START.x; P.y = START.y - 6; P.vx = 0; P.vy = 70; P.face = 1; P.iT = 0; P.flingT = 0; P.ph = 0; P.hitT = 0; P.touch = 0;
      for (var i = 0; i < CREDS.length; i++) CREDS[i].got = 0;
      for (i = 0; i < BUMPS.length; i++) { BUMPS[i].flash = 0; BUMPS[i].ring = 0; }
      for (i = 0; i < AUDITS.length; i++) { AUDITS[i].x = AUDITS[i].x0; AUDITS[i].y = AUDITS[i].y0; }
      for (i = 0; i < NPT; i++) ptl[i] = 0;
      G.camx = clamp(P.x, VW / 2, WW - VW / 2); G.camy = clamp(P.y, VH / 2, WH - VH / 2);
    }

    /* ------------------------------------------------------------ the swim */
    function hitsWall(x, y, r) {
      r = r || PR;
      var tx0 = ((x - r) / TS) | 0, tx1 = ((x + r) / TS) | 0, ty0 = ((y - r) / TS) | 0, ty1 = ((y + r) / TS) | 0, tx, ty, cx, cy, dx, dy;
      for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
        if (!tileSolid(tx, ty)) continue;
        cx = clamp(x, tx * TS, tx * TS + TS); cy = clamp(y, ty * TS, ty * TS + TS);
        dx = x - cx; dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
      return false;
    }
    /* the villi only take a bite if you actually swim into them: drifting against the flesh is free,
       a careless run at it costs, a bumper-speed slam costs full. Nothing bleeds you while you rest. */
    var GRAZE = 26, SLAM = 70;
    function scrape(nx, ny, spd) {
      if (spd < 9) return;
      G.shake = Math.max(G.shake, Math.min(0.5, spd / 240));
      puff(P.x + nx * 5, P.y + ny * 5, spd < SLAM ? 3 : 6, 2, 50 + spd * 0.4);
      if (spd < GRAZE || P.iT > 0 || P.flingT > 0 || GOD || G.mode !== 'swim') { sfx.swim(); return; }
      var hard = spd > SLAM, cost = hard ? NIBBLE : Math.round(NIBBLE * 0.45 / 10) * 10;
      P.iT = hard ? 1 : 0.6; P.hitT = 0.4; G.budget -= cost; G.vig = hard ? 1 : 0.55;
      sfx.nibble(); if (hard) sfx.yelp();
      puff(P.x + nx * 6, P.y + ny * 6, hard ? 9 : 4, 6, 95);
      floatText('-' + pounds(cost), P.x, P.y - 16, '#ff8f92');
      if (G.budget <= 0) { G.budget = 0; drown(); }
    }
    function unwedge() {
      if (!hitsWall(P.x, P.y)) return;
      var tx = (P.x / TS) | 0, ty = (P.y / TS) | 0, k, r, bx0, by0;
      for (r = 0; r < 4; r++) for (k = 0; k < 8; k++) {
        bx0 = (tx + [1, -1, 0, 0, 1, 1, -1, -1][k] * r) * TS + TS / 2;
        by0 = (ty + [0, 0, 1, -1, 1, -1, 1, -1][k] * r) * TS + TS / 2;
        if (!hitsWall(bx0, by0)) { P.x = bx0; P.y = by0; P.vx *= 0.3; P.vy *= 0.3; return; }
      }
    }
    var touching = false;
    function moveP(dt) {
      var steps = 1, i, nx, ny, sd = Math.hypot(P.vx, P.vy) * dt;
      touching = false;
      unwedge();
      if (sd > 3) steps = Math.min(8, Math.ceil(sd / 3));
      var sdt = dt / steps;
      for (i = 0; i < steps; i++) {
        nx = P.x + P.vx * sdt;
        if (hitsWall(nx, P.y)) { touching = true; scrape(P.vx > 0 ? 1 : -1, 0, Math.abs(P.vx)); P.vx = -P.vx * 0.42; }
        else P.x = nx;
        ny = P.y + P.vy * sdt;
        if (hitsWall(P.x, ny)) { touching = true; scrape(0, P.vy > 0 ? 1 : -1, Math.abs(P.vy)); P.vy = -P.vy * 0.42; }
        else P.y = ny;
      }
      P.x = clamp(P.x, PR, WW - PR); P.y = clamp(P.y, PR, WH - PR);
    }
    function fling(b) {
      var dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy) || 1, nx = b.x + dx / d * (BR + PR + 1), ny = b.y + dy / d * (BR + PR + 1);
      P.vx = dx / d * FLING; P.vy = dy / d * FLING;
      if (!hitsWall(nx, ny)) { P.x = nx; P.y = ny; }                 /* never shove the player inside the flesh */
      else if (!hitsWall(nx, P.y)) P.x = nx; else if (!hitsWall(P.x, ny)) P.y = ny;
      b.flash = 0.22; b.ring = 0.45; P.flingT = 0.6; G.shake = Math.max(G.shake, 0.9); G.bounces++;
      sfx.thunk(); if (TH.bumpSfx) sfx[TH.bumpSfx](); puff(b.x + dx / d * BR, b.y + dy / d * BR, 12, 1, 190);
      if (G.bounces <= MAX_BOUNCE) floatText('+' + pounds(PER_BOUNCE), b.x, b.y - 18, '#fcd34d');
    }
    function collectCredit(cd) {
      cd.got = 1; G.got++; sfx.credit(); G.flash = Math.max(G.flash, 0.18);
      puff(cd.x, cd.y, 14, 1, 130); spark(cd.x, cd.y, 0, -30, 0.9, 1, 3);
      floatText('+' + pounds(PER_CREDIT) + ' COMPUTE', cd.x, cd.y - 14, '#fcd34d');
    }
    function drown() {
      if (G.mode === 'drown') return;
      G.mode = 'drown'; G.drownT = 0; G.shake = 1.2; sfx.drown();
      try { api.music('silence'); } catch (e) {}
    }
    function claim() {
      if (G.mode !== 'swim') return;
      G.mode = 'claim'; G.claimT = 0; G.flash = 1; G.shake = 0.8; sfx.claim();
      puff(EXIT.x, EXIT.y, 40, 4, 180);
      try { api.music('silence'); } catch (e) {}
    }
    function updateSwim(dt) {
      var i, ix = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), iy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), m;
      if (stick.on) { ix = stick.ax; iy = stick.ay; }
      m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
      if (m > 0.05) { sfx.swim(); if (Math.abs(ix) > 0.15) P.face = ix > 0 ? 1 : -1; }
      P.vx += ix * ACC * dt; P.vy += iy * ACC * dt;
      var ti = (((P.y / TS) | 0) * MW + ((P.x / TS) | 0)), cd = (ti >= 0 && ti < cur.length) ? cur[ti] : 0;
      if (cd) {
        P.vx += (cd === 1 ? 1 : cd === 2 ? -1 : 0) * 150 * dt; P.vy += (cd === 3 ? 1 : cd === 4 ? -1 : 0) * 150 * dt;
        sfx.current();
        if (Math.random() < dt * 22) spark(P.x + rnd(-14, 14), P.y + rnd(-14, 14), (cd === 1 ? 70 : cd === 2 ? -70 : 0), (cd === 3 ? 70 : cd === 4 ? -70 : 0), 0.5, 3, 1);
      }
      P.vy += 15 * dt;                                                  /* you are heavier than the fluid; keep paddling */
      var k = 1 - DRAG * dt; if (k < 0) k = 0;
      P.vx *= k; P.vy *= k;
      var sp = Math.hypot(P.vx, P.vy), lim = P.flingT > 0 ? FLING + 20 : MAXV;
      if (sp > lim) { P.vx = P.vx / sp * lim; P.vy = P.vy / sp * lim; }
      moveP(dt);
      if (touching || hitsWall(P.x, P.y, PR + 1.6)) P.touch += dt; else P.touch = Math.max(0, P.touch - dt * 4);
      if (P.touch > 0.45 && P.flingT <= 0 && !GOD) {                    /* the villi latch on and absorb while you lie against them */
        G.budget -= CLING * dt; G.vig = Math.max(G.vig, 0.4); P.hitT = Math.max(P.hitT, 0.15);
        if (gate('cling', 0.45)) { sfx.nibble(); puff(P.x + rnd(-5, 5), P.y + rnd(-5, 5), 2, 6, 45); }
        if (G.budget <= 0) { G.budget = 0; drown(); }
      }
      P.ph += dt * (2.6 + Math.min(sp, 120) * 0.04);
      if (P.iT > 0) P.iT -= dt;
      if (P.flingT > 0) P.flingT -= dt;
      if (P.hitT > 0) P.hitT -= dt;
      if (Math.random() < dt * 7) spark(P.x - P.face * 10, P.y + rnd(-3, 3), rnd(-8, 8), rnd(-26, -12), rnd(0.6, 1.4), 3, 1);
      for (i = 0; i < BUMPS.length; i++) {
        var b = BUMPS[i];
        if (b.flash > 0) b.flash -= dt;
        if (b.ring > 0) b.ring -= dt;
        if (Math.abs(b.x - P.x) < BR + PR + 2 && Math.abs(b.y - P.y) < BR + PR + 2 && Math.hypot(b.x - P.x, b.y - P.y) < BR + PR) fling(b);
      }
      for (i = 0; i < CREDS.length; i++) { var c2 = CREDS[i]; if (!c2.got && Math.abs(c2.x - P.x) < 13 && Math.abs(c2.y - P.y) < 13) collectCredit(c2); }
      for (i = 0; i < AUDITS.length; i++) {
        var a = AUDITS[i];
        a.ph += dt;
        var ax = a.x + a.vx * dt, ay = a.y + a.vy * dt;
        if (hitsWallAt(ax, ay, 12) || Math.abs(ax - a.x0) > 30 || Math.abs(ay - a.y0) > 30 || nearBumper(ax, ay)) { a.vx = -a.vx; a.vy = -a.vy; }
        else { a.x = ax; a.y = ay; }
        if (Math.hypot(a.x - P.x, a.y - P.y) < 12 + PR && P.iT <= 0 && P.flingT <= 0 && !GOD) {
          P.iT = 1.1; P.hitT = 0.5; G.budget -= AUDIT_COST; G.vig = 1; G.shake = Math.max(G.shake, 0.8);
          var dx2 = P.x - a.x, dy2 = P.y - a.y, dd = Math.hypot(dx2, dy2) || 1;
          P.vx = dx2 / dd * 175; P.vy = dy2 / dd * 175; P.flingT = 0.4;
          sfx.audit(); sfx.yelp(); puff(P.x, P.y, 10, 5, 110);
          floatText('-' + pounds(AUDIT_COST) + ' AUDITED', P.x, P.y - 16, '#ff8f92');
          if (G.budget <= 0) { G.budget = 0; drown(); }
        }
      }
      if (Math.abs(EXIT.x - P.x) < 22 && Math.abs(EXIT.y - P.y) < 22) claim();
      if (G.budget < BUDGET0 * 0.25) sfx.low();
      if (G.hint > 0) G.hint -= dt;
    }
    function nearBumper(x, y) {
      for (var i = 0; i < BUMPS.length; i++) if (Math.abs(BUMPS[i].x - x) < BR + 16 && Math.abs(BUMPS[i].y - y) < BR + 16) return true;
      return false;
    }
    function hitsWallAt(x, y, r) {
      var tx0 = ((x - r) / TS) | 0, tx1 = ((x + r) / TS) | 0, ty0 = ((y - r) / TS) | 0, ty1 = ((y + r) / TS) | 0, tx, ty;
      for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) if (tileSolid(tx, ty)) return true;
      return false;
    }

    /* ------------------------------------------------------------ SPEND IT OR LOSE IT! — one question per compute credit */
    var QBANK = [
      { q: 'WHAT DOES AN IMPACT FACTOR MEASURE?', a: ['THE QUALITY OF THE PAPER', 'A MEAN OF A SKEWED DISTRIBUTION', 'HOW HARD IT HITS THE DESK', 'YOUR WORTH AS A PERSON'], r: 1 },
      { q: 'REVIEWER 2 WANTS 11 MORE CITATIONS. WHY?', a: ['THEY ARE CENTRAL TO THE ARGUMENT', 'RIGOUR', 'THEY WROTE ALL ELEVEN', 'AN HONEST CLERICAL ERROR'], r: 2 },
      { q: '"MINOR REVISIONS" MEANS:', a: ['SIX WEEKS AND TWO NEW EXPERIMENTS', 'MINOR REVISIONS', 'IT IS BASICALLY ACCEPTED', 'YOU MAY NOW RELAX'], r: 0 },
      { q: 'WHAT ARE OVERHEADS?', a: ['THE LIGHTS AND THE HEATING', 'ESTATES AND INDIRECT COSTS', 'THE PART YOU NEVER SEE', 'A MYTH, LIKE THE SABBATICAL'], r: 1 },
      { q: 'THREE QUOTES FOR A 400 POUND LAPTOP COSTS:', a: ['TEN MINUTES', '900 POUNDS OF ACADEMIC TIME', 'ONE FORM', 'THE REST OF THE FINANCIAL YEAR'], r: 1 },
      { q: 'WHAT IS THE PLURAL OF "DATA"?', a: ['DATA', 'DATUM', '"THE DATA ARE". YOU WILL BE TOLD', 'DATAS'], r: 2 },
      { q: 'THE CLOUD BILL ARRIVES. IT IS:', a: ['AS QUOTED', 'AS QUOTED, PLUS THE UNQUOTED BIT', 'SMALLER', 'A LEARNING EXPERIENCE'], r: 1 },
      { q: 'A CONFERENCE ABSTRACT DEADLINE IS:', a: ['A DEADLINE', 'A SUGGESTION', 'MIDNIGHT, TIME ZONE TO BE CONFIRMED', 'EXTENDED'], r: 2 }
    ];
    var QRIGHT = ['CORRECT! THE MONEY IS NOTIONAL. THE JOY IS REAL.', 'CORRECT! YOU HAVE CLEARLY SUFFERED.', 'CORRECT! THE PANEL IS DELIGHTED.', 'CORRECT! AND WITH NO DECLARED CONFLICT.'];
    var QWRONG = ['NO. AND YOU DO THIS FOR A LIVING.', 'NO. THE PANEL WILL NOTE YOUR OPTIMISM.', 'NO. BUT IT IS LOVELY THAT YOU THINK SO.', 'NO. WE WILL PUT THAT IN THE ANNUAL REPORT.', 'NO. HAVE YOU CONSIDERED A ROLE IN ADMIN?'];
    var QTIME = ['TIME! THE PANEL RECORDS A NON-RESPONSE.', 'TIME! SILENCE IS ALSO AN ANSWER. A WRONG ONE.'];
    function shuffled(n) {
      var pool = [], i, j, t;
      for (i = 0; i < QBANK.length; i++) pool.push(i);
      for (i = pool.length - 1; i > 0; i--) { j = (Math.random() * (i + 1)) | 0; t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      pool.length = Math.min(n, pool.length);
      var out = [];
      for (i = 0; i < pool.length; i++) {
        var src = QBANK[pool[i]], ord = [0, 1, 2, 3], k, tt;
        for (k = ord.length - 1; k > 0; k--) { j = (Math.random() * (k + 1)) | 0; tt = ord[k]; ord[k] = ord[j]; ord[j] = tt; }
        var ans = [], rr = 0;
        for (k = 0; k < ord.length; k++) { ans.push(src.a[ord[k]]); if (ord[k] === src.r) rr = k; }
        out.push({ q: src.q, a: ans, r: rr, lines: wrap(src.q, 41) });
      }
      return out;
    }
    function startQuiz() {
      G.mode = 'quiz'; G.qlist = shuffled(G.got); G.qi = 0; G.qt = 0; G.qphase = 'in'; G.qsel = -1; G.qright = 0; G.qflash = 0; G.qcheer = 0; G.say = '';
      if (!G.qlist.length) { G.qphase = 'out'; G.qt = 0; tally(); }
      else sfx.fanfare();
    }
    var ANSR = [];
    function qdur() { return G.qi === 0 ? 7.5 : 5.8; }
    function layoutAnswers() {
      var q = G.qlist ? G.qlist[G.qi] : null, i;
      ANSR.length = 0;
      if (!q) return;
      /* on a phone the host steps aside during the question so the answers get the whole width */
      var x0 = narrow ? 8 : 70, w0 = narrow ? 384 : 324, h0 = narrow ? 24 : 22, st = narrow ? 28 : 26, y = narrow ? 78 : 76;
      q.lines = wrap(q.q, narrow ? 38 : 41);
      for (i = 0; i < q.a.length; i++) { ANSR.push({ x: x0, y: y, w: w0, h: h0 }); y += st; }
    }
    function answer(i) {
      if (G.mode !== 'quiz' || G.qphase !== 'ask' || !G.qlist[G.qi] || i < 0 || i >= G.qlist[G.qi].a.length) return;
      G.qsel = i; G.qphase = 'reveal'; G.qt = 0;
      if (i === G.qlist[G.qi].r) { G.qright++; G.qflash = 1; G.qcheer = 1.6; sfx.ding(); sfx.clap(); G.say = QRIGHT[G.qi % QRIGHT.length]; }
      else { sfx.buzz(); sfx.oooh(); G.qcheer = -1.6; G.say = QWRONG[G.qi % QWRONG.length]; }
    }
    function updateQuiz(dt) {
      G.qt += dt;
      if (G.qflash > 0) G.qflash -= dt * 2;
      if (G.qcheer > 0) G.qcheer = Math.max(0, G.qcheer - dt); else if (G.qcheer < 0) G.qcheer = Math.min(0, G.qcheer + dt);
      if (G.qphase === 'in') { if (G.qt > 2.2) { G.qphase = 'ask'; G.qt = 0; G.qsel = -1; layoutAnswers(); } return; }
      if (G.qphase === 'ask') {
        if (G.qt < qdur()) { if (G.qt > qdur() - 2.6) sfx.tick(); return; }
        G.qsel = -2; G.qphase = 'reveal'; G.qt = 0; G.qcheer = -1.4; sfx.buzz(); sfx.oooh(); G.say = QTIME[G.qi % QTIME.length];
        return;
      }
      if (G.qphase === 'reveal') {
        if (G.qt < 1.75) return;
        G.qi++;
        if (G.qi >= G.qlist.length) { G.qphase = 'out'; G.qt = 0; tally(); sfx.fanfare(); }
        else { G.qphase = 'ask'; G.qt = 0; G.qsel = -1; G.say = ''; layoutAnswers(); }
        return;
      }
      if (G.qphase === 'out') hiStep();
      if (G.qphase === 'out' && G.qt > 2.8) { G.mode = 'cow'; G.cowT = 0; sfx.moo(0, 148); sfx.moo(0.5, 118); }
    }
    function tally() {
      G.prize = BASE_PRIZE + G.got * PER_CREDIT + G.qright * PER_ANSWER + Math.min(G.bounces, MAX_BOUNCE) * PER_BOUNCE;
      G.hearts = G.prize >= 29000 ? 3 : G.prize >= 18000 ? 2 : G.prize >= 8000 ? 1 : 0;
    }
    function finish(pounds0, hearts) {
      if (!G || G.doneSent) return;
      G.doneSent = true;
      if (TRANS) {                                                      /* the climb-out plays first; the host hears about it at the top */
        G.mode = 'out'; G.outT = 0; G.outCue = 0; G.outRes = { credits: pounds0, hearts: hearts }; G.flash = 0;
        try { api.music('quest'); } catch (e) {}
        sfx.rise();
        return;
      }
      G.mode = 'done';
      try { api.music('quest'); } catch (e) {}
      sendDone({ credits: pounds0, hearts: hearts });
    }
    function sendDone(res) {
      try { if (opts0 && typeof opts0.onDone === 'function') opts0.onDone(res); } catch (e) { oops(e); }
    }
    /* ---- the flush in and the climb out: timings in level seconds, cues fired once each from step() */
    var FL_LEN = 3.2, FL_PUNCH = 2.5, OUT_LEN = 1.8, OUT_PLOP = 1.35;
    var FL_CUES = [[0.35, 'glug', 260], [0.8, 'glug', 200], [1.25, 'glug', 170], [1.55, 'echo', 0.09], [1.8, 'echo', 0.07], [2.05, 'echo', 0.05], [2.3, 'echo', 0.035]];
    function flushCues() {
      while (G.flCue < FL_CUES.length && G.cardT >= FL_CUES[G.flCue][0]) { var cue = FL_CUES[G.flCue++]; sfx[cue[1]](cue[2]); }
      if (G.flCue === FL_CUES.length && G.cardT >= FL_PUNCH) { G.flCue++; G.flash = 0.55; G.shake = 1; sfx.punch(); flushHush(); }
    }
    function flushSkip() { if (G.mode !== 'flush') return; G.mode = 'ewj'; G.cardT = 0; G.flash = 0; flushHush(); sfx.ui(); }
    function outCues() {
      if (G.outCue === 0 && G.outT >= OUT_PLOP) { G.outCue = 1; sfx.plop(); G.flash = 0.6; }
      if (G.outT >= OUT_LEN) { G.mode = 'done'; sendDone(G.outRes || { credits: 0, hearts: 0 }); }
    }

    /* ------------------------------------------------------------ the step */
    function step(dt) {
      var i;
      G.t += dt;
      if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 1.7);
      if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2.2);
      if (G.vig > 0) G.vig = Math.max(0, G.vig - dt * 1.4);
      for (i = 0; i < NPT; i++) if (ptl[i] > 0) { ptl[i] -= dt; ptx[i] += ptvx[i] * dt; pty[i] += ptvy[i] * dt; ptvx[i] *= 0.96; ptvy[i] = ptvy[i] * 0.96 - 8 * dt; }
      for (i = 0; i < NFT; i++) if (FT[i].on) { FT[i].life -= dt; FT[i].y -= 19 * dt; if (FT[i].life <= 0) FT[i].on = false; }
      if (G.mode === 'flush') { G.cardT += dt; flushCues(); if (G.mode === 'flush' && G.cardT > FL_LEN) { G.mode = 'ewj'; G.cardT = 0; } }
      if (G.mode === 'ewj') { G.cardT += dt; if (G.cardT > EWJ_LEN) { G.mode = 'title'; G.cardT = 0; } }
      if (G.mode === 'title') { G.cardT += dt; if (G.cardT > 5.5) G.mode = 'swim'; }
      else if (G.mode === 'swim') updateSwim(dt);
      else if (G.mode === 'claim') { G.claimT += dt; if (G.claimT > 2.6) startQuiz(); }
      else if (G.mode === 'drown') { G.drownT += dt; P.y = Math.min(P.y + 26 * dt, WH - 8); P.vx *= 0.9; }
      else if (G.mode === 'quiz') updateQuiz(dt);
      else if (G.mode === 'cow') { G.cowT += dt; if (Math.random() < dt * 0.24) sfx.moo(0, 120 + Math.random() * 60); }
      else if (G.mode === 'out') { G.outT += dt; outCues(); if (!G) return; }   /* onDone may have stopped us: the host calls stop() inside it */
      if (G.mode === 'title' || G.mode === 'swim' || G.mode === 'claim' || G.mode === 'drown') {
        var k = Math.min(1, dt * 5.5);
        G.camx += (clamp(P.x + P.vx * 0.22, VW / 2, WW - VW / 2) - G.camx) * k;
        G.camy += (clamp(P.y + P.vy * 0.22, VH / 2, WH - VH / 2) - G.camy) * k;
      }
    }
    function advance() {                                              /* any key / any tap, wherever we are */
      if (!G) return;
      if (G.mode === 'flush') { if (G.cardT > 0.25) flushSkip(); return; }
      if (G.mode === 'out' || G.mode === 'done') return;
      if (G.mode === 'ewj') { if (G.cardT > 0.6) { G.mode = 'title'; G.cardT = 0; sfx.ui(); } return; }
      if (G.mode === 'title') { G.mode = 'swim'; sfx.ui(); return; }
      if (G.mode === 'drown' && G.drownT > 1.6) { finish(0, 0); return; }
      if (G.mode === 'cow' && G.cowT > 1.2) { finish(G.prize, G.hearts); return; }
    }

    /* ------------------------------------------------------------ drawing */
    var overlay = null, styleEl = null, scr = null, sx = null, pf = null, g = null, darkC = null, dg = null, hintEl = null;
    var dpr = 1, U = 1, pfX = 0, pfY = 0, pfW = 0, pfH = 0, scrW = 0, scrH = 0, gFont = 0, camX0 = 0, camY0 = 0, lastCW = 0, lastCH = 0, narrow = false;
    function txt(s, x, y, size, col, align) {
      if (gFont !== size) { g.font = size + 'px ' + FONT; gFont = size; }
      g.textAlign = align || 'center';
      g.fillStyle = '#06030a'; g.fillText(s, x + 1, y + 1);
      g.fillStyle = col; g.fillText(s, x, y);
    }
    function wrap(text, max) {
      var words = String(text).split(' '), lines = [], curl = '', i;
      for (i = 0; i < words.length; i++) { if (curl && (curl + ' ' + words[i]).length > max) { lines.push(curl); curl = words[i]; } else curl = curl ? curl + ' ' + words[i] : words[i]; }
      if (curl) lines.push(curl); return lines;
    }
    function punch(spr, wx, wy, a) {
      var px1 = wx - camX0, py1 = wy - camY0, hw = spr.width / 2;
      if (px1 < -hw || py1 < -hw || px1 > VW + hw || py1 > VH + hw) return;
      dg.globalAlpha = a; dg.drawImage(spr, (px1 - hw) | 0, (py1 - hw) | 0);
    }
    function warm(spr, wx, wy, a) {
      var px1 = wx - camX0, py1 = wy - camY0, hw = spr.width / 2;
      if (px1 < -hw || py1 < -hw || px1 > VW + hw || py1 > VH + hw) return;
      g.globalAlpha = a; g.drawImage(spr, (px1 - hw) | 0, (py1 - hw) | 0);
    }
    function drawCave() {
      var t = G.t, i, k, o, px1, py1, fr = ((t * 9) | 0) % 2;
      camX0 = Math.round(G.camx - VW / 2) + (G.shake > 0 ? Math.round((Math.random() - 0.5) * G.shake * 7) : 0);
      camY0 = Math.round(G.camy - VH / 2) + (G.shake > 0 ? Math.round((Math.random() - 0.5) * G.shake * 7) : 0);
      camX0 = clamp(camX0, 0, WW - VW); camY0 = clamp(camY0, 0, WH - VH);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = false; g.textBaseline = 'top'; g.globalCompositeOperation = 'source-over';
      g.drawImage(STATIC, camX0, camY0, VW, VH, 0, 0, VW, VH);
      /* villi: only the tiles on screen, each strand a pre-rendered sprite */
      var tx0 = (camX0 / TS) | 0, tx1 = Math.min(MW - 1, ((camX0 + VW) / TS) | 0), ty0 = (camY0 / TS) | 0, ty1 = Math.min(MH - 1, ((camY0 + VH) / TS) | 0), tx, ty, idx, s0, n0, ai, L, tint, ang, dx, dy, d2, diff;
      for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
        idx = ty * MW + tx; if (!solid[idx] || !vCount[idx]) continue;
        s0 = vStart[idx]; n0 = vCount[idx];
        for (i = s0; i < s0 + n0; i++) {
          dx = P.x - vbx[i]; dy = P.y - vby[i]; d2 = dx * dx + dy * dy;
          ang = vang[i] + Math.sin(t * 2.7 + vph[i]) * 0.3; L = vlen[i]; tint = 0;
          if (d2 < 2000 && G.mode !== 'title') {
            diff = Math.atan2(dy, dx) - vang[i];
            while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
            if (diff < 1.5 && diff > -1.5) { ang = vang[i] + diff * (1 - Math.sqrt(d2) / 45) * 0.85; L = L < NLEN - 1 ? L + 1 : L; tint = 1; }
          }
          ai = Math.round(ang / TAU * NA) % NA; if (ai < 0) ai += NA;
          g.drawImage(VILL[(tint * NLEN + L) * NA + ai], (vbx[i] - camX0 - 15) | 0, (vby[i] - camY0 - 15) | 0);
        }
      }
      var ex1 = EXIT.x - camX0, ey1 = EXIT.y - camY0;
      g.drawImage(EXITS[fr], (ex1 - 22) | 0, (ey1 - 22) | 0);
      if (Math.abs(EXIT.x - P.x) < 170 && Math.abs(EXIT.y - P.y) < 120 && ey1 > 30 && ey1 < VH) txt('THE UNDERSPEND', clamp(ex1, 60, VW - 60) | 0, clamp(ey1 - 34, 26, VH - 10) | 0, 8, ((t * 2) | 0) % 2 ? '#7ef0a8' : '#4fbf85');
      for (i = 0; i < BUMPS.length; i++) {
        o = BUMPS[i]; px1 = o.x - camX0; py1 = o.y - camY0;
        if (px1 < -40 || py1 < -40 || px1 > VW + 40 || py1 > VH + 40) continue;
        g.drawImage(BUMP[o.flash > 0 ? 1 : 0], (px1 - 15) | 0, (py1 - 15) | 0);
        if (o.ring > 0) { g.globalAlpha = o.ring / 0.45; g.strokeStyle = '#fff6d8'; g.lineWidth = 2; g.beginPath(); g.arc(px1, py1, 16 + (0.45 - o.ring) * 90, 0, TAU); g.stroke(); g.globalAlpha = 1; }
        if (Math.abs(o.x - P.x) < 118 && Math.abs(o.y - P.y) < 86 && py1 > 34 && py1 < VH - 4) txt(o.name, clamp(px1, o.name.length * 4 + 4, VW - o.name.length * 4 - 4) | 0, (py1 - 27) | 0, 8, o.flash > 0 ? '#ffffff' : '#c99a4a');
      }
      for (i = 0; i < CREDS.length; i++) {
        o = CREDS[i]; if (o.got) continue;
        px1 = o.x - camX0; py1 = o.y - camY0 + Math.sin(t * 2 + o.ph) * 2.5;
        if (px1 < -20 || py1 < -20 || px1 > VW + 20 || py1 > VH + 20) continue;
        g.drawImage(CRED[((t * 6 + o.ph) | 0) % 6], (px1 - 8) | 0, (py1 - 8) | 0);
      }
      for (i = 0; i < AUDITS.length; i++) {
        o = AUDITS[i]; px1 = o.x - camX0; py1 = o.y - camY0 + Math.sin(o.ph * 2) * 1.5;
        if (px1 < -30 || py1 < -30 || px1 > VW + 30 || py1 > VH + 30) continue;
        g.drawImage(AUDIT[((t * 4) | 0) % 2], (px1 - 11) | 0, (py1 - 11) | 0);
        if (px1 > 44 && px1 < VW - 44 && py1 > 36 && py1 < VH - 14) txt('SPOT AUDIT', px1 | 0, (py1 - 24) | 0, 8, '#a8434a');
      }
      /* the salamander */
      if (G.mode !== 'claim' || G.claimT < 1) {
        px1 = Math.round(P.x - camX0); py1 = Math.round(P.y - camY0);
        var frm = ((P.ph) | 0) % 4, blink = P.iT > 0 && ((t * 16) | 0) % 2 === 0 && P.hitT > 0;
        g.save(); g.translate(px1, py1);
        var rot = clamp(P.vy * 0.007, -0.38, 0.38);
        g.rotate(P.face > 0 ? rot : -rot);
        g.globalAlpha = blink ? 0.35 : 1;
        g.drawImage(P.face > 0 ? SALA[frm] : SALAL[frm], P.face > 0 ? -17 : -13, -7);
        g.globalAlpha = 1; g.restore();
        if (G.mode === 'drown' && SKIN === 'snake' && BOX) g.drawImage(BOX, px1 - 8, py1 - 10 + Math.round(Math.sin(t * 5) * 1.5));   /* he hides. it does not help. */
      }
      for (i = 0; i < NPT; i++) {
        if (ptl[i] <= 0) continue;
        px1 = ptx[i] - camX0; py1 = pty[i] - camY0;
        if (px1 < -4 || py1 < -4 || px1 > VW + 4 || py1 > VH + 4) continue;
        g.globalAlpha = Math.min(1, ptl[i] / ptm[i] * 1.5); g.fillStyle = PTC[ptc[i]]; g.fillRect(px1 | 0, py1 | 0, pts[i], pts[i]);
      }
      g.globalAlpha = 1;
      /* darkness: one black sheet, holes punched where there is light */
      dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.globalAlpha = 1;
      dg.fillStyle = '#000000'; dg.fillRect(0, 0, VW, VH);
      dg.globalCompositeOperation = 'destination-out';
      for (i = 0; i < LAMPS.length; i++) punch(PUNCH.lamp, LAMPS[i].x, LAMPS[i].y, 0.86 + Math.sin(t * 4.2 + LAMPS[i].ph) * 0.09);
      for (i = 0; i < BUMPS.length; i++) punch(PUNCH.bumper, BUMPS[i].x, BUMPS[i].y, BUMPS[i].flash > 0 ? 1 : 0.78);
      for (i = 0; i < CREDS.length; i++) if (!CREDS[i].got) punch(PUNCH.credit, CREDS[i].x, CREDS[i].y, 0.82);
      for (i = 0; i < AUDITS.length; i++) punch(PUNCH.audit, AUDITS[i].x, AUDITS[i].y, 0.7);
      punch(PUNCH.exit, EXIT.x, EXIT.y, 0.95);
      if (G.mode !== 'drown' || G.drownT < 1.4) punch(PUNCH.you, P.x, P.y, (G.mode === 'title' ? 0.7 : 0.97) - Math.sin(t * 3.1) * 0.03);
      g.globalAlpha = LIT ? 0.12 : (G.mode === 'title' ? 0.88 : 0.935);
      g.drawImage(darkC, 0, 0); g.globalAlpha = 1;
      if (TH.tint) { g.fillStyle = TH.tint; g.fillRect(0, 0, VW, VH); }
      /* warm bloom over the top */
      g.globalCompositeOperation = 'lighter';
      for (i = 0; i < LAMPS.length; i++) warm(WARM.lamp, LAMPS[i].x, LAMPS[i].y, 0.3 + Math.sin(t * 4.2 + LAMPS[i].ph) * 0.06);
      for (i = 0; i < BUMPS.length; i++) warm(WARM.bumper, BUMPS[i].x, BUMPS[i].y, BUMPS[i].flash > 0 ? 0.85 : 0.3);
      for (i = 0; i < CREDS.length; i++) if (!CREDS[i].got) warm(WARM.credit, CREDS[i].x, CREDS[i].y, 0.34 + Math.sin(t * 3 + CREDS[i].ph) * 0.08);
      for (i = 0; i < AUDITS.length; i++) warm(WARM.audit, AUDITS[i].x, AUDITS[i].y, 0.22);
      warm(WARM.exit, EXIT.x, EXIT.y, 0.32 + Math.sin(t * 2.4) * 0.07);
      warm(WARM.you, P.x, P.y, 0.14);
      if (P.hitT > 0) warm(WARM.hit, P.x, P.y, P.hitT * 0.5);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      for (i = 0; i < NFT; i++) {
        o = FT[i]; if (!o.on) continue;
        px1 = o.x - camX0; py1 = o.y - camY0;
        if (px1 < -60 || py1 < -12 || px1 > VW + 60 || py1 > VH + 12) continue;
        g.globalAlpha = Math.min(1, o.life * 1.6);
        txt(o.s, clamp(px1, o.s.length * 4 + 3, VW - o.s.length * 4 - 3) | 0, py1 | 0, 8, o.col);
        g.globalAlpha = 1;
      }
    }
    function drawGauge() {
      var i, b = Math.max(0, G.budget / BUDGET0), low = b < 0.25;
      g.fillStyle = 'rgba(6,3,10,.66)'; g.fillRect(0, 0, VW, 22);
      txt('BUDGET', 6, 4, 8, '#9aa3b8', 'left');
      g.fillStyle = '#23121a'; g.fillRect(6, 14, 122, 6);
      g.fillStyle = low && ((G.t * 7) | 0) % 2 ? '#ffffff' : low ? '#e3625b' : '#7ef0a8';
      g.fillRect(7, 15, Math.max(0, (120 * b) | 0), 4);
      txt(pounds(G.budget), 134, 4, 8, low ? '#e3625b' : '#f4f6fb', 'left');
      txt('CREDITS ' + G.got + '/' + CREDS.length, VW - 6, 4, 8, '#fcd34d', 'right');
      for (i = 0; i < CREDS.length; i++) { g.fillStyle = i < G.got ? '#fcd34d' : '#3a2a18'; g.fillRect(VW - 6 - (CREDS.length - i) * 6, 14, 4, 6); }
      if (G.vig > 0 && VIG) { g.globalAlpha = Math.min(0.85, G.vig * 0.8); g.drawImage(VIG, 0, 0); g.globalAlpha = 1; }
      if (G.hint > 0 && G.mode === 'swim') {
        g.globalAlpha = Math.min(1, G.hint);
        txt(narrow ? 'DRAG ANYWHERE TO SWIM' : 'ARROWS / WASD / DRAG TO SWIM', VW / 2, VH - 30, 8, '#9aa3b8');
        txt(TH.hint, VW / 2, VH - 18, 8, '#e3625b');
        g.globalAlpha = 1;
      }
      if (low && G.mode === 'swim') txt('BUDGET CRITICAL', VW / 2, 30, 8, ((G.t * 4) | 0) % 2 ? '#e3625b' : '#7a1020');
      /* lost for a minute and a half? finance points the way. a good run never sees this. */
      if (G.mode === 'swim' && G.t > 95) {
        var ex2 = EXIT.x - camX0, ey2 = EXIT.y - camY0;
        if (ex2 < 10 || ex2 > VW - 10 || ey2 < 26 || ey2 > VH - 10) {
          var ang = Math.atan2(EXIT.y - P.y, EXIT.x - P.x), ca = Math.cos(ang), sa = Math.sin(ang);
          var sc = Math.min((VW / 2 - 20) / Math.max(0.0001, Math.abs(ca)), (VH / 2 - 26) / Math.max(0.0001, Math.abs(sa)));
          g.save(); g.translate((VW / 2 + ca * sc) | 0, (VH / 2 + sa * sc) | 0); g.rotate(ang);
          g.fillStyle = ((G.t * 3) | 0) % 2 ? '#7ef0a8' : '#2f7f57';
          g.beginPath(); g.moveTo(9, 0); g.lineTo(-5, -6); g.lineTo(-5, 6); g.closePath(); g.fill();
          g.fillStyle = '#06030a'; g.fillRect(-5, -1, 3, 2);
          g.restore();
        }
        if (G.t < 102) txt('FINANCE TIP: FOLLOW THE MONEY', VW / 2, VH - 44, 8, '#7ef0a8');
      }
    }
    /* ---- the level card: an homage to Earthworm Jim 2's, which is a hand-lettered
       sign held up by the hero against flat grey. Every letter its own colour, black
       outlined, wobbling off the baseline. Drawn from scratch, nothing traced. ---- */
    var EWJ_PAL = ['#f2a0a0', '#e03c3c', '#ffffff', '#5a7ce0', '#e8821e', '#5aa84a', '#b07ad0', '#f2d24a'];
    var EWJ_LINES = ["Dunc's  now", 'a Blind Cave', 'Salamander!'];
    var EWJ_LEN = 3.6;
    function ewjRect(a, b, c, d, col) { g.fillStyle = col; g.fillRect(a | 0, b | 0, c | 0, d | 0); }
    function drawEwjCard() {
      var SKIN = '#e8b98a', SKIN_D = '#c89468', HAIR = '#e8c85a', HAIR_D = '#b89a34', SUIT = '#8a8f9e',
          SUIT_D = '#5f6472', SHIRT = '#f0f2f6', TIE = '#c0392b', GLASS = '#2a2d36', LENS = '#dff0ff', EDGE = '#20222a';
      var k = G.cardT, cx = VW / 2, i;
      ewjRect(0, 0, VW, VH, '#4a4a4a');
      // he arrives from below over the first third of a second
      var slide = k < 0.34 ? (1 - k / 0.34) * 70 : 0;
      g.save(); g.translate(0, Math.round(slide));
      var hx = cx - 26, hy = 16, hw = 52, hh = 44;
      ewjRect(hx + 4, hy + 4, hw, hh, 'rgba(0,0,0,.27)');
      ewjRect(hx, hy, hw, hh, SKIN);
      ewjRect(hx, hy, hw, 13, HAIR);
      ewjRect(hx, hy + 13, 7, 5, HAIR_D); ewjRect(hx + hw - 7, hy + 13, 7, 5, HAIR_D);
      ewjRect(hx + hw - 4, hy, 4, hh, SKIN_D);
      ewjRect(hx + 5, hy + 19, 17, 13, GLASS); ewjRect(hx + 30, hy + 19, 17, 13, GLASS);
      ewjRect(hx + 7, hy + 21, 13, 9, LENS);  ewjRect(hx + 32, hy + 21, 13, 9, LENS);
      ewjRect(hx + 22, hy + 23, 8, 3, GLASS);
      ewjRect(hx + 18, hy + 37, 16, 4, EDGE);
      ewjRect(cx - 9, hy + hh, 18, 10, SKIN_D);
      ewjRect(cx - 62, hy + hh + 8, 124, 46, SUIT);
      ewjRect(cx - 14, hy + hh + 8, 28, 30, SHIRT);
      ewjRect(cx - 5, hy + hh + 12, 10, 26, TIE);
      ewjRect(cx - 62, hy + hh + 8, 6, 46, SUIT_D); ewjRect(cx + 56, hy + hh + 8, 6, 46, SUIT_D);
      ewjRect(cx - 84, hy + hh + 22, 26, 58, SUIT);  ewjRect(cx + 58, hy + hh + 22, 26, 58, SUIT);
      ewjRect(cx - 86, hy + hh + 22, 2, 58, EDGE);   ewjRect(cx + 84, hy + hh + 22, 2, 58, EDGE);
      // the sign
      var signW = 250, signH = 100, signY = 116;
      g.save(); g.translate(cx, signY + signH / 2 - 8); g.rotate(-0.025);
      ewjRect(-signW / 2 + 6, -signH / 2 + 7, signW, signH, 'rgba(0,0,0,.45)');
      g.fillStyle = '#e3bb55';
      g.beginPath(); g.moveTo(-signW / 2 + 6, -signH / 2); g.lineTo(signW / 2 - 4, -signH / 2 + 3);
      g.lineTo(signW / 2, signH / 2 - 6); g.lineTo(-signW / 2 + 3, signH / 2); g.closePath(); g.fill();
      g.fillStyle = '#c99c3c';
      g.beginPath(); g.moveTo(signW / 2 - 4, -signH / 2 + 3); g.lineTo(signW / 2 - 15, -signH / 2 + 1);
      g.lineTo(signW / 2, -signH / 2 + 13); g.closePath(); g.fill();
      var gi = 0;
      for (var li = 0; li < EWJ_LINES.length; li++) {
        var ln = li ? EWJ_LINES[li] : TH.ewj;
        g.font = '23px "Luckiest Guy", ' + FONT; gFont = -1;
        var adv = function (ch) { return ch === ' ' ? 9 : Math.max(g.measureText(ch).width, 9) - 1; };
        var tw = 0, n;
        for (n = 0; n < ln.length; n++) tw += adv(ln.charAt(n));
        var px = -tw / 2, py = -signH / 2 + 34 + li * 28;
        for (n = 0; n < ln.length; n++) {
          var ch = ln.charAt(n), w = adv(ch);
          if (ch !== ' ' && k > 0.22 + gi * 0.021) {
            var wob = Math.round(Math.sin(gi * 1.9) * 3.6), rot = Math.sin(gi * 2.7 + 1) * 0.13;
            g.save(); g.translate(Math.round(px + w / 2), Math.round(py + wob)); g.rotate(rot);
            g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
            g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeText(ch, 0, 0);
            g.fillStyle = EWJ_PAL[gi % EWJ_PAL.length]; g.fillText(ch, 0, 0);
            g.restore();
          }
          px += w; gi++;
        }
      }
      g.restore();
      // hands gripping over the front of the sign
      for (i = 0; i < 2; i++) {
        var hxp = i ? cx + 84 : cx - 122, hy2 = signY - 14, f;
        ewjRect(hxp - 3, hy2 - 3, 40, 40, 'rgba(0,0,0,.35)');
        ewjRect(hxp, hy2, 38, 20, SKIN); ewjRect(hxp, hy2, 38, 4, SKIN_D);
        for (f = 0; f < 4; f++) {
          var fx = hxp + 2 + f * 9, len = 22 - Math.abs(f - 1.5) * 3;
          ewjRect(fx, hy2 + 16, 8, len, SKIN);
          ewjRect(fx, hy2 + 16 + len - 4, 8, 4, SKIN_D);
          ewjRect(fx + 7, hy2 + 16, 1, len, SKIN_D);
        }
        ewjRect(hxp, hy2, 1, 20, SKIN_D); ewjRect(hxp + 37, hy2, 1, 20, SKIN_D);
      }
      g.restore();
      gFont = -1;
      if (k > 1.6 && ((G.t * 2) | 0) % 2) txt(narrow ? 'TAP' : 'ANY KEY', VW - 34, VH - 10, 8, '#d8d8d8');
    }
    function drawTitle() {
      var a = G.cardT < 0.5 ? G.cardT * 2 : G.cardT > 5 ? (5.5 - G.cardT) * 2 : 1;
      g.globalAlpha = Math.max(0, Math.min(1, a));
      g.fillStyle = TH.box; g.fillRect(0, 44, VW, 130);
      if (TH.scan) { g.fillStyle = 'rgba(0,0,0,.28)'; for (var sy = 45; sy < 174; sy += 3) g.fillRect(0, sy, VW, 1); }
      g.fillStyle = TH.rule; g.fillRect(0, 44, VW, 2); g.fillRect(0, 172, VW, 2);
      txt(TH.dept, VW / 2, 56, 8, TH.dim);
      txt('THE UNDERSPEND', VW / 2, 74, 24, TH.title);
      txt(TH.place, VW / 2, 106, 8, TH.sub);
      txt(TH.l1, VW / 2, 126, 8, TH.body);
      txt(TH.l2, VW / 2, 140, 8, TH.body);
      if (((G.t * 2) | 0) % 2) txt(narrow ? 'TAP TO BEGIN' : 'PRESS ANY KEY', VW / 2, 158, 8, TH.go);
      g.globalAlpha = 1;
    }
    function drawClaim() {
      var a = Math.min(1, G.claimT * 2.5);
      g.globalAlpha = a; g.fillStyle = 'rgba(6,3,10,.8)'; g.fillRect(0, 62, VW, 96);
      g.fillStyle = '#7ef0a8'; g.fillRect(0, 62, VW, 2); g.fillRect(0, 156, VW, 2);
      txt('UNDERSPEND CLAIMED', VW / 2, 76, 16, '#7ef0a8');
      txt(pounds(BASE_PRIZE) + ' OF CLOUD COMPUTE', VW / 2, 102, 8, '#f4f6fb');
      txt('NOBODY SPENT IT. NOBODY WILL MISS IT.', VW / 2, 116, 8, '#9aa3b8');
      txt(G.got ? G.got + ' COMPUTE CREDITS = ' + G.got + ' QUESTIONS' : 'NO CREDITS. NO QUESTIONS. STRAIGHT ON.', VW / 2, 136, 8, '#fcd34d');
      g.globalAlpha = 1;
    }
    function drawDrown() {
      var a = Math.min(1, G.drownT * 0.7);
      g.globalAlpha = a * 0.95; g.fillStyle = '#06030a'; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1;
      if (G.drownT < 0.9) return;
      txt('BUDGET EXHAUSTED', VW / 2, 60, 16, '#e3625b');
      txt(TH.drown1, VW / 2, 92, 8, '#f4f6fb');
      txt('THE UNDERSPEND HAS BEEN CLAWED BACK', VW / 2, 108, 8, '#9aa3b8');
      txt('BY THE CENTRE. IT ALWAYS IS.', VW / 2, 122, 8, '#9aa3b8');
      txt('YOU WASH OUT OF THE FOUNTAIN, DAMP', VW / 2, 144, 8, '#c8899a');
      txt('AND NO RICHER.', VW / 2, 158, 8, '#c8899a');
      if (G.drownT > 1.6 && ((G.t * 2) | 0) % 2) txt('PRESS ANY KEY', VW / 2, 186, 8, '#7ef0a8');
    }
    function drawStudio(t) {
      var i, k;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false; g.textBaseline = 'top';
      g.fillStyle = '#0c0a1a'; g.fillRect(0, 0, VW, VH);
      for (k = 0; k < 3; k++) g.drawImage(SPOT, (70 + k * 130 + Math.sin(t * 0.7 + k) * 16 - 70) | 0, 0);   /* three spotlights, swinging */
      g.fillStyle = '#17132c'; g.fillRect(0, 178, VW, 47);
      g.fillStyle = '#241d40'; g.fillRect(0, 178, VW, 2);
      for (i = 0; i < VW; i += 16) { g.fillStyle = (i / 16) % 2 ? '#1b1633' : '#141027'; g.fillRect(i, 180, 16, 4); }
      /* the sign */
      g.fillStyle = '#1a1030'; g.fillRect(58, 2, 284, 22); g.fillStyle = '#3c2263'; g.fillRect(58, 2, 284, 2); g.fillStyle = '#3c2263'; g.fillRect(58, 22, 284, 2);
      for (i = 0; i < 20; i++) { var on = ((t * 6 + i) | 0) % 3 === 0; g.fillStyle = on ? '#fff3c4' : '#7a5a1e'; g.fillRect(60 + i * 14, 3, 3, 3); g.fillRect(60 + i * 14, 20, 3, 3); }
      txt('SPEND IT OR LOSE IT!', VW / 2, 9, 12, '#fcd34d');
    }
    function drawAudience(t) {
      var i, cheer = G.qcheer, n = 22, hx, hy, hd;
      if (cheer > -0.05 && cheer < 0.05) cheer = 0;
      for (i = 0; i < n; i++) {
        hd = (i * 7 + 3) % 4; hx = -6 + i * 19 + (i % 2 ? 5 : 0);
        hy = 188 + (i % 3) * 6 + Math.sin(t * 2.4 + i * 1.3) * 1.6 + (cheer > 0 ? -Math.abs(Math.sin(t * 13 + i)) * 7 : 0) + (cheer < 0 ? 3 : 0);
        g.drawImage(HEAD[hd], hx | 0, hy | 0);
        if (cheer > 0) { g.fillStyle = '#242b44'; g.fillRect(hx + 1, (hy | 0) - 6 + ((Math.sin(t * 15 + i) > 0) ? 0 : 2), 3, 8); g.fillRect(hx + 12, (hy | 0) - 6 + ((Math.sin(t * 15 + i) > 0) ? 2 : 0), 3, 8); }
      }
      if (cheer < -0.05) txt('o o o o o h', VW / 2, 208, 8, '#6b7495');
      else if (cheer > 0.05) txt('* CLAP CLAP CLAP *', VW / 2, 208, 8, '#8a95bb');
    }
    function drawQuiz() {
      var t = G.t, q = G.qlist ? G.qlist[G.qi] : null, i, k, hf;
      drawStudio(t);
      var af = narrow ? 9 : 8;
      hf = G.qphase === 'reveal' ? (((t * 7) | 0) % 2 ? 2 : 1) : (G.qphase === 'ask' && G.qt < 1.4 ? 2 : (((t * 3) | 0) % 2 ? 1 : 0));
      if (!narrow || (G.qphase !== 'ask' && G.qphase !== 'reveal')) g.drawImage(HOST[hf], 1, 72);
      drawAudience(t);
      if (SKIN !== 'palmer' && (G.qphase === 'in' || G.qphase === 'out')) drawPodium();
      if (G.qphase === 'in') {
        txt('AN IMPROMPTU GAME SHOW', VW / 2, 52, 8, '#9aa3b8');
        txt('ONE QUESTION PER COMPUTE CREDIT', VW / 2, 74, 8, '#f4f6fb');
        txt(G.qlist.length + ' QUESTION' + (G.qlist.length === 1 ? '' : 'S'), VW / 2, 96, 24, '#7ef0a8');
        txt(pounds(PER_ANSWER) + ' OF COMPUTE PER CORRECT ANSWER', VW / 2, 132, 8, '#fcd34d');
        return;
      }
      if (G.qphase === 'out') {
        txt('THAT IS ALL WE HAVE TIME FOR', VW / 2, 52, 8, '#9aa3b8');
        txt(G.qright + ' / ' + G.qlist.length + ' CORRECT', VW / 2, 74, 24, G.qright > G.qlist.length / 2 ? '#7ef0a8' : '#e3625b');
        txt('YOU LEAVE WITH', VW / 2, 112, 8, '#9aa3b8');
        txt(pounds(G.prize), VW / 2, 128, 24, '#fcd34d');
        txt('OF CLOUD COMPUTE', VW / 2, 160, 8, '#f4f6fb');
        return;
      }
      if (!q) return;
      txt('QUESTION ' + (G.qi + 1) + ' OF ' + G.qlist.length, 6, 30, 8, '#9aa3b8', 'left');
      txt('BANKED ' + pounds(G.qright * PER_ANSWER), VW - 6, 30, 8, '#fcd34d', 'right');
      var frac = G.qphase === 'ask' ? Math.max(0, 1 - G.qt / qdur()) : (G.qsel === -2 ? 0 : 1);
      g.fillStyle = '#231a3a'; g.fillRect(6, 42, VW - 12, 5);
      g.fillStyle = frac < 0.3 ? (((t * 8) | 0) % 2 ? '#ffffff' : '#e3625b') : '#7ef0a8';
      g.fillRect(7, 43, ((VW - 14) * frac) | 0, 3);
      for (i = 0; i < q.lines.length; i++) txt(q.lines[i], VW / 2, 54 + i * (af + 4), af, '#f4f6fb');
      for (i = 0; i < q.a.length; i++) {
        var r0 = ANSR[i]; if (!r0) continue;
        var right = i === q.r, sel = i === G.qsel, rev = G.qphase === 'reveal';
        var bg = rev ? (right ? '#14532d' : sel ? '#4a1620' : '#160f2c') : (G.qhover === i ? '#2a2050' : '#160f2c');
        var bd = rev ? (right ? '#7ef0a8' : sel ? '#e3625b' : '#2f2752') : (G.qhover === i ? '#9d8bff' : '#3c3470');
        g.fillStyle = '#06030a'; g.fillRect(r0.x + 2, r0.y + 2, r0.w, r0.h);
        g.fillStyle = bd; g.fillRect(r0.x, r0.y, r0.w, r0.h);
        g.fillStyle = bg; g.fillRect(r0.x + 2, r0.y + 2, r0.w - 4, r0.h - 4);
        g.fillStyle = rev && right ? '#7ef0a8' : bd; g.fillRect(r0.x + 2, r0.y + 2, 18, r0.h - 4);
        txt('ABCD'.charAt(i), r0.x + 11, r0.y + (r0.h - af) / 2, af, rev && right ? '#06030a' : '#f4f6fb');
        txt(q.a[i], r0.x + 26, r0.y + (r0.h - af) / 2, af, rev && !right && !sel ? '#6b7495' : '#f4f6fb', 'left');
        if (rev && right) mark(r0.x + r0.w - 16, r0.y + (r0.h - 10) / 2, 1, '#7ef0a8');
        else if (rev && sel) mark(r0.x + r0.w - 16, r0.y + (r0.h - 10) / 2, 0, '#e3625b');
      }
      if (G.qphase === 'reveal' && G.say) {
        var by0 = narrow ? 192 : 182, bx1 = narrow ? 8 : 66;
        g.fillStyle = 'rgba(6,3,10,.9)'; g.fillRect(bx1, by0, VW - bx1 - 4, 18);
        g.fillStyle = '#fcd34d'; g.fillRect(bx1, by0, VW - bx1 - 4, 1);
        txt(G.say, bx1 + (VW - bx1 - 4) / 2, by0 + 5, 8, G.qsel === q.r ? '#7ef0a8' : '#e3625b');
      }
      if (G.qflash > 0) { g.globalAlpha = Math.min(0.5, G.qflash * 0.5); g.fillStyle = '#ffffff'; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1; }
    }
    function mark(x0, y0, tick, col) {
      var i;
      g.fillStyle = col;
      if (tick) { for (i = 0; i < 3; i++) g.fillRect(x0 + i, y0 + 3 + i, 2, 2); for (i = 0; i < 6; i++) g.fillRect(x0 + 2 + i, y0 + 5 - i, 2, 2); }
      else { for (i = 0; i < 7; i++) { g.fillRect(x0 + i, y0 + i, 2, 2); g.fillRect(x0 + 6 - i, y0 + i, 2, 2); } }
    }
    /* ---- THE TWO COWS, inked at twice the game's resolution. WELL DONE is the one screen drawn into its own
       800x450 buffer (hb), composed in place of the playfield. A tiny raster painter (superellipses and capsules,
       clip masks, part ids for depth) lays flat colour in four hard cel-shade bands, then inks every silhouette and
       every overlap with a thick black line. Hard pixel edges, no anti-aliasing, no gradients. Built on the first
       WELL DONE and kept. Text and the game's own sprites are drawn through a 2x transform, so they look unchanged. */
    var HK = 2, HW = VW * HK, HH = VH * HK, hb = null, hg = null, hiFrame = false, HICOW = null, HIWD = null, wdWait = false;
    var INK = 0x120e16, SHV = [0, 0];
    function hx(s) { return parseInt(s.slice(1), 16); }
    function mat(a, b, c, d) { return [hx(a), hx(b), hx(c), hx(d || c)]; }
    function painter(w, h, lx) {
      var n = w * h, c = new Int32Array(n), i;
      for (i = 0; i < n; i++) c[i] = -1;
      return { w: w, h: h, c: c, p: new Uint8Array(n), z: 0, lx: lx || -1 };
    }
    function sEll(cx, cy, rx, ry, ang, pw) {
      var ca = Math.cos(ang || 0), sa = Math.sin(ang || 0), q = pw || 2, R = Math.max(rx, ry) * 1.12 + 1;
      return { x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R, f: function (x, y, o) {
        var dx = x - cx, dy = y - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        if (Math.pow(Math.abs(u), q) + Math.pow(Math.abs(v), q) > 1) return false;
        o[0] = u * ca - v * sa; o[1] = u * sa + v * ca; return true;
      } };
    }
    function sCap(x0, y0, x1, y1, r0, r1) {
      var dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, R = Math.max(r0, r1) + 1;
      return { x0: Math.min(x0, x1) - R, y0: Math.min(y0, y1) - R, x1: Math.max(x0, x1) + R, y1: Math.max(y0, y1) + R, f: function (x, y, o) {
        var t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1), qx = x - (x0 + dx * t), qy = y - (y0 + dy * t), r = r0 + (r1 - r0) * t;
        if (qx * qx + qy * qy > r * r) return false;
        o[0] = qx / r; o[1] = qy / r; return true;
      } };
    }
    /* paint shape s in material m. opt: clip (part id or list: only over those), keep (leave part ids alone: no ink
       line, e.g. patches), pid (join an existing part), flat (one band), bias (lighter/darker), cut(x, y) (extra mask) */
    function paint(P, s, m, opt) {
      opt = opt || {};
      var id = opt.keep ? 0 : opt.pid || ++P.z, x, y, i, u, v, r2, b, lv, cl = opt.clip, lx = P.lx * 0.5, bias = opt.bias || 0;
      var X0 = Math.max(0, Math.floor(s.x0)), Y0 = Math.max(0, Math.floor(s.y0)), X1 = Math.min(P.w - 1, Math.ceil(s.x1)), Y1 = Math.min(P.h - 1, Math.ceil(s.y1));
      for (y = Y0; y <= Y1; y++) for (x = X0; x <= X1; x++) {
        i = y * P.w + x;
        if (cl !== undefined && (typeof cl === 'number' ? P.p[i] !== cl : cl.indexOf(P.p[i]) < 0)) continue;
        if (opt.cut && !opt.cut(x + 0.5, y + 0.5)) continue;
        if (!s.f(x + 0.5, y + 0.5, SHV)) continue;
        if (opt.flat !== undefined) lv = opt.flat;
        else {
          u = SHV[0]; v = SHV[1]; r2 = u * u + v * v;
          b = u * lx - v * 0.6 + (r2 < 1 ? Math.sqrt(1 - r2) : 0) * 0.62 + bias;
          lv = b > 0.9 ? 0 : b > 0.28 ? 1 : b > -0.1 ? 2 : 3;
        }
        P.c[i] = m[lv];
        if (id) P.p[i] = id;
      }
      return id;
    }
    function ink(P, T, Ti, col) {
      var w = P.w, h = P.h, p = P.p, o = new Int32Array(P.c), ext = [], inr = [], x, y, i, k, a, q, ax, ay;
      for (ay = -T; ay <= T; ay++) for (ax = -T; ax <= T; ax++) if ((ax || ay) && ax * ax + ay * ay <= T * T + 1) ext.push(ax, ay);
      for (ay = -Ti; ay <= Ti; ay++) for (ax = -Ti; ax <= Ti; ax++) if ((ax || ay) && ax * ax + ay * ay <= Ti * Ti) inr.push(ax, ay);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x; a = p[i];
        if (!a) {
          for (k = 0; k < ext.length; k += 2) { ax = x + ext[k]; ay = y + ext[k + 1]; if (ax >= 0 && ay >= 0 && ax < w && ay < h && p[ay * w + ax]) { o[i] = col; break; } }
        } else {
          for (k = 0; k < inr.length; k += 2) { ax = x + inr[k]; ay = y + inr[k + 1]; if (ax >= 0 && ay >= 0 && ax < w && ay < h) { q = p[ay * w + ax]; if (q && q < a) { o[i] = col; break; } } }
        }
      }
      P.c = o;
    }
    function pcanvas(P) {
      var cv = mk(P.w, P.h), x = cv.getContext('2d'), im = x.createImageData(P.w, P.h), d = im.data, i, v;
      for (i = 0; i < P.w * P.h; i++) { v = P.c[i]; if (v < 0) continue; d[i * 4] = (v >> 16) & 255; d[i * 4 + 1] = (v >> 8) & 255; d[i * 4 + 2] = v & 255; d[i * 4 + 3] = 255; }
      x.putImageData(im, 0, 0); return cv;
    }
    var CW_ = 300, CH_ = 214;
    /* one cow, facing right, head turned to camera. face: 'grin' | 'talk'; mouth 0..2; tail 0..1; blink */
    function cowArt(face, mouth, tail, blink, mirror) {
      var P = painter(CW_, CH_, mirror ? 1 : -1), ox = 14, oy = 8;
      function e(cx, cy, rx, ry, a, q) { return sEll(cx + ox, cy + oy, rx, ry, a, q); }
      function k(x0, y0, x1, y1, r0, r1) { return sCap(x0 + ox, y0 + oy, x1 + ox, y1 + oy, r0, r1); }
      function below(yy) { return function (x, y) { return y >= yy + oy; }; }
      function above(yy) { return function (x, y) { return y < yy + oy; }; }
      var WH = mat('#ffffff', '#f1ece2', '#c4b9cc', '#9286a6'), FAR = mat('#e4ddd2', '#b8adc2', '#9286a6', '#6e6286');
      var BK = mat('#5c5674', '#2c2734', '#1c1922', '#141218'), PK = mat('#ffdbe4', '#f6a4b8', '#d6728e', '#a8506e');
      var HF = mat('#9c8c84', '#6a5a54', '#46383a', '#2e2428'), HN = mat('#fffcee', '#eee2b6', '#c6b17e', '#927c52');
      var AU = mat('#fff6b4', '#f8c838', '#cc901c', '#8c5c0e'), RD = mat('#ff9488', '#e0404a', '#a62432', '#6c1422');
      var MW = mat('#8a3044', '#621c30', '#461224', '#2e0a18'), TT = mat('#ffffff', '#fbf8ee', '#d8cebc', '#aca08c');
      var EY = mat('#ffffff', '#ffffff', '#ddd6e6', '#b8b0c8');
      var lg = [], i, sw = tail ? 7 : -5;
      /* far legs, then the tail, the udder, the near legs: the body overlaps all their tops */
      lg.push(paint(P, k(76, 126, 78, 178, 12, 10), FAR)); paint(P, e(78, 183, 12, 8, 0, 3), HF, { bias: -0.3 });
      lg.push(paint(P, k(174, 126, 176, 178, 12, 10), FAR)); paint(P, e(176, 183, 12, 8, 0, 3), HF, { bias: -0.3 });
      paint(P, k(14, 82, 8 + sw * 0.4, 112, 4, 3), WH, { pid: paint(P, k(8 + sw * 0.4, 112, 6 + sw, 140, 3, 3), WH) });
      paint(P, e(6 + sw, 150, 7, 12, -sw * 0.03, 2), BK);
      for (i = 0; i < 3; i++) paint(P, k(84 + i * 11, 150, 83 + i * 12, 165 - (i === 1 ? 0 : 2), 4, 3.2), PK);
      paint(P, e(96, 142, 24, 14), PK, { bias: 0.1 });
      lg.push(paint(P, k(50, 128, 48, 182, 16, 13), WH)); paint(P, e(48, 186, 15, 8, 0, 3), HF);
      lg.push(paint(P, k(152, 128, 154, 182, 16, 13), WH)); paint(P, e(154, 186, 15, 8, 0, 3), HF);
      paint(P, e(44, 160, 11, 14), BK, { clip: lg[2], keep: true });
      /* the body: a fat rounded box */
      var body = paint(P, e(102, 100, 90, 45, 0, 2.6), WH, { bias: 0.08 });
      paint(P, e(182, 82, 30, 34, -0.6), WH, { pid: body, bias: 0.08 });
      var pt = [[54, 74, 28, 22, 0.3], [78, 96, 18, 15, 0], [24, 112, 16, 18, 0], [140, 114, 24, 17, -0.2], [160, 94, 14, 13, 0], [118, 56, 13, 8, 0]];
      for (i = 0; i < pt.length; i++) paint(P, e(pt[i][0], pt[i][1], pt[i][2], pt[i][3], pt[i][4]), BK, { clip: body, keep: true });
      /* the collar: a strap sagging round the neck, under the chin */
      var cIn = e(186, 112, 24, 17, 0.45), tmp = [0, 0];
      paint(P, e(186, 120, 24, 17, 0.45), RD, { cut: function (x, y) { return !cIn.f(x, y, tmp); } });
      /* ears, horns, the head, its patch and a mop of hair */
      var ear1 = paint(P, e(166, 48, 24, 10, 0.42), WH), ear2 = paint(P, e(264, 41, 24, 10, -0.42), WH);
      paint(P, e(163, 49, 15, 5, 0.42), PK, { clip: ear1 }); paint(P, e(267, 42, 15, 5, -0.42), PK, { clip: ear2 });
      paint(P, k(194, 30, 180, 5, 7, 3), HN); paint(P, k(236, 28, 252, 3, 7, 3), HN);
      var skull = paint(P, e(215, 60, 42, 38, 0, 2.2), WH, { bias: 0.05 });
      paint(P, e(250, 46, 22, 21, 0.3), BK, { clip: skull, keep: true });
      paint(P, e(206, 25, 6, 10, -0.5), BK); paint(P, e(215, 22, 7, 11, 0), BK); paint(P, e(225, 25, 6, 10, 0.5), BK);
      var snout = paint(P, e(225, 103, 49, 33, 0, 2.3), PK, { bias: 0.05 });
      /* eyes: bulging, dopey lids; the grinning cow is wall-eyed */
      var ex = [197, 231], ey = [50, 48], pdx = face === 'grin' ? [-5, 5] : [1, 1], pdy = face === 'grin' ? [5, 3] : [4, 4];
      for (i = 0; i < 2; i++) {
        var sc = paint(P, e(ex[i], ey[i], 13, 16), EY);
        paint(P, e(ex[i] + pdx[i], ey[i] + pdy[i], 6, 7.5), BK, { clip: sc, keep: true });
        paint(P, e(ex[i], ey[i], 13, 16), WH, { clip: sc, cut: above(ey[i] - (blink ? -11 : face === 'grin' ? 1 : 5)) });
      }
      paint(P, e(207, 97, 7, 10, 0.35), MW, { clip: snout, flat: 1 }); paint(P, e(244, 95, 7, 10, -0.35), MW, { clip: snout, flat: 1 });
      if (face === 'grin') {
        var mo = paint(P, e(225, 111, 36, 19), MW, { clip: snout, cut: below(111), flat: 1 });
        paint(P, e(215, 112, 8, 10, 0, 3), TT, { clip: mo }); paint(P, e(233, 112, 8, 10, 0, 3), TT, { clip: mo });
        paint(P, e(231, 130, 15, 7), PK, { clip: mo });
      } else {
        var ry = [2.4, 8, 12.5][mouth], m2 = paint(P, e(225, 119, 20 - (mouth ? 0 : 4), ry), MW, { clip: snout, flat: 1 });
        if (mouth) { paint(P, e(225, 119 - ry, 13, 5.5, 0, 3), TT, { clip: m2 }); paint(P, e(227, 119 + ry, 12, ry * 0.55), PK, { clip: m2 }); }
      }
      /* the bell */
      var bell = paint(P, e(182, 146, 11, 12), AU);
      paint(P, e(182, 157, 16, 5.5, 0, 2.4), AU, { pid: bell, bias: -0.1 });
      paint(P, e(182, 164, 4.5, 3.5), MW, { flat: 2 });
      ink(P, 3, 2, INK);
      /* shines, after the ink */
      for (i = 0; i < 2; i++) if (!blink) paint(P, sEll(ex[i] + pdx[i] - 2.5 + ox, ey[i] + pdy[i] - 2.5 + oy, 2, 2), EY, { keep: true, flat: 0 });
      paint(P, sEll(176 + ox, 140 + oy, 2.2, 3.4, -0.4), AU, { keep: true, flat: 0 });
      return pcanvas(P);
    }
    var WD_COL = [['#fff7b0', '#ffd23a', '#e89a18', '#a86008'], ['#ffb4a4', '#f04c3e', '#b82632', '#7a1020'], ['#cddcff', '#5c88f2', '#3656c2', '#1e3088'],
      ['#cdf7a4', '#5ec24c', '#2f8c36', '#1a5c24'], ['#ffdaa4', '#f4922c', '#c2621c', '#84380c'], ['#f2ccff', '#b87ce2', '#824ab2', '#58287e']];
    /* WELL DONE in the EWJ card's cartoon face, thresholded to hard pixels, bevelled, inked, dropped a shadow */
    function buildWD() {
      var ok = false, i, ch, fs, fam, list = [], ci = 0, ln, li, LINES = ['WELL', 'DONE'], wid = [], fit = 216;
      try { ok = !!(document.fonts && document.fonts.check('70px "Luckiest Guy"')); } catch (e) { ok = false; }
      if (!ok && !wdWait) { wdWait = true; try { document.fonts.load('70px "Luckiest Guy"').then(function () { HIWD = null; }, function () {}); } catch (e) {} }
      fam = ok ? '"Luckiest Guy", ' + FONT : FONT;
      var mc = mk(8, 8), mx = mc.getContext('2d'), sq = ok ? 0.9 : 1;
      fs = ok ? 84 : 44; mx.font = fs + 'px ' + fam;
      for (li = 0; li < 2; li++) { var w0 = 0; for (i = 0; i < 4; i++) w0 += mx.measureText(LINES[li].charAt(i)).width * sq; wid.push(w0); }
      fs = Math.floor(fs * Math.min(1, fit / Math.max(wid[0], wid[1])));
      var S = (fs * 1.7) | 0; mc = mk(S, S); mx = mc.getContext('2d');
      for (li = 0; li < 2; li++) {
        ln = LINES[li]; mx.setTransform(1, 0, 0, 1, 0, 0); mx.font = fs + 'px ' + fam;
        var adv = [], tw = 0;
        for (i = 0; i < ln.length; i++) { adv.push(mx.measureText(ln.charAt(i)).width * sq); tw += adv[i]; }
        var px = HW / 2 - tw / 2, cy = li ? 52 + fs * 0.98 : 52;
        for (i = 0; i < ln.length; i++) {
          ch = ln.charAt(i);
          mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, S, S);
          mx.translate(S / 2, S / 2); mx.rotate(Math.sin(ci * 2.7 + 1) * 0.11);
          mx.font = fs + 'px ' + fam; mx.textAlign = 'center'; mx.textBaseline = 'middle'; mx.fillStyle = '#000';
          mx.fillText(ch, 0, ok ? fs * 0.08 : 0);
          var d = mx.getImageData(0, 0, S, S).data, P = painter(S, S, -1), m = WD_COL[ci % WD_COL.length], y0 = S, y1 = 0, x, y, j, on = new Uint8Array(S * S);
          for (j = 0; j < S * S; j++) if (d[j * 4 + 3] >= 120) { on[j] = 1; y = (j / S) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          var mm = [hx(m[0]), hx(m[1]), hx(m[2]), hx(m[3])];
          for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
            j = y * S + x; if (!on[j]) continue;
            var lv = (y - y0) / Math.max(1, y1 - y0) < 0.5 ? 1 : 2;
            if (x < 3 || y < 3 || !on[j - 3 * S - 3] || !on[j - 3 * S]) lv = 0;
            else if (x > S - 4 || y > S - 4 || !on[j + 3 * S + 2] || !on[j + 3 * S]) lv = 3;
            P.c[j] = mm[lv]; P.p[j] = 1;
          }
          ink(P, 4, 1, INK);
          var sh = hx('#1a1236'), cpy = new Int32Array(P.c);
          for (y = 0; y < S; y++) for (x = 0; x < S; x++) { j = y * S + x; if (cpy[j] < 0 && x >= 5 && y >= 6 && cpy[j - 6 * S - 5] >= 0) P.c[j] = sh; }
          list.push({ cv: pcanvas(P), x: Math.round(px + adv[i] / 2 - S / 2), y: Math.round(cy - S / 2), i: ci });
          ci++; px += adv[i];
        }
      }
      return list;
    }
    function hiStep() {                                               /* one sprite per call: spread over the quiz's last frames */
      if (!HICOW) HICOW = { a: [], b: [] };
      var n = HICOW.a.length;
      if (n < 3) { HICOW.a.push(cowArt('grin', 0, n === 1 ? 1 : 0, n === 2, false)); return false; }
      n = HICOW.b.length;
      if (n < 3) { HICOW.b.push(flipH(cowArt('talk', n, 1, false, true))); return false; }
      if (!HIWD) { HIWD = buildWD(); return false; }
      return true;
    }
    function hiBuild() { while (!hiStep()) {} }
    /* hard-edged ellipse, row by row (shadows on the grass) */
    function flatEll(cx, cy, rx, ry, col) {
      g.fillStyle = col;
      for (var y = -ry; y < ry; y += 2) { var w = Math.round(rx * Math.sqrt(1 - Math.pow((y + 1) / ry, 2))); g.fillRect(cx - w, cy + y, w * 2, 2); }
    }
    function drawCow() {                                                /* g is hg here, see draw() */
      var t = G.t, i, y, rows, ct = G.cowT;
      hiBuild();
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false; g.textBaseline = 'top';
      var SKY = ['#2a5fc8', '#3470d4', '#3f82e0', '#4c95ea', '#5ba8f2', '#6cbaf8'], GY = 238;
      for (i = 0; i < SKY.length; i++) { g.fillStyle = SKY[i]; g.fillRect(0, (i * GY / SKY.length) | 0, HW, Math.ceil(GY / SKY.length) + 1); }
      g.fillStyle = '#3f9e3c'; g.fillRect(0, GY, HW, 12); g.fillStyle = '#2a7a30'; g.fillRect(0, GY + 8, HW, 4);
      g.fillStyle = '#120e16'; g.fillRect(0, GY - 2, HW, 2); g.fillRect(0, GY + 12, HW, 2);
      g.fillStyle = '#05060f'; g.fillRect(0, GY + 14, HW, HH - GY - 14);
      flatEll(150, GY + 2, 112, 7, '#2a7a30'); flatEll(HW - 150, GY + 2, 112, 7, '#2a7a30');
      var bob = Math.sin(t * 2.2) > 0 ? 0 : 2, bob2 = Math.sin(t * 2.2 + 1.3) > 0 ? 0 : 2;
      var fa = ((t * 0.9) % 1) > 0.93 ? 2 : ((t * 1.6) | 0) % 2;
      var talk = ct < 1.8 || ((t * 0.45) % 1) < 0.28, fb = talk ? [1, 2, 1, 0][((t * 9) | 0) % 4] : 0;
      g.drawImage(HICOW.a[fa], 4, GY + 11 - CH_ - bob);
      g.drawImage(HICOW.b[fb], HW - 4 - CW_, GY + 11 - CH_ - bob2);
      for (i = 0; i < HW; i += 10) { g.fillStyle = (i % 30) ? '#57b84a' : '#2a7a30'; g.fillRect(i + ((i * 7) % 5), GY - 4 - ((i * 13) % 3) * 2, 2, 4); }
      g.setTransform(HK, 0, 0, HK, 0, 0);
      if (SKIN !== 'palmer') { drawContestant(196, 90, 1); if (SKIN === 'snake' && BOX) g.drawImage(BOX, 208, 108); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (i = 0; i < HIWD.length; i++) {
        var L = HIWD[i], pop = ct * 7 - L.i * 0.55;
        if (pop <= 0) continue;
        var dy = pop < 1 ? Math.round((1 - pop) * -40) : pop < 1.6 ? Math.round(Math.sin((pop - 1) / 0.6 * Math.PI) * 6) : Math.round(Math.sin(t * 4 - L.i * 0.8) * 3);
        g.drawImage(L.cv, L.x, L.y + dy);
      }
      g.setTransform(HK, 0, 0, HK, 0, 0);
      rows = [
        ['THE UNDERSPEND', pounds(BASE_PRIZE), '#f4f6fb'],
        [G.got + ' COMPUTE CREDIT' + (G.got === 1 ? '' : 'S'), pounds(G.got * PER_CREDIT), '#f4f6fb'],
        [G.qright + ' CORRECT ANSWER' + (G.qright === 1 ? '' : 'S'), pounds(G.qright * PER_ANSWER), '#f4f6fb'],
        ['BUMPER EXPENSES (' + Math.min(G.bounces, MAX_BOUNCE) + ')', pounds(Math.min(G.bounces, MAX_BOUNCE) * PER_BOUNCE), '#9aa3b8']
      ];
      y = 130;
      for (i = 0; i < rows.length; i++) {
        txt(rows[i][0], 26, y, 8, rows[i][2], 'left');
        txt(rows[i][1], VW - 26, y, 8, rows[i][2], 'right');
        g.fillStyle = '#2a2436';
        for (var d = 26 + rows[i][0].length * 8 + 6; d < VW - 26 - rows[i][1].length * 8 - 6; d += 6) g.fillRect(d, y + 6, 2, 1);
        y += 12;
      }
      g.fillStyle = '#2a2436'; g.fillRect(26, y + 1, VW - 52, 1); y += 6;
      txt('TOTAL CLOUD COMPUTE', 26, y, 8, '#fcd34d', 'left');
      txt(pounds(G.prize), VW - 26, y, 8, '#fcd34d', 'right');
      y += 16;
      if (G.hearts) {
        var lbl = '+ ' + G.hearts + ' HEART' + (G.hearts === 1 ? '' : 'S') + ' FOR THE BOSS', tot = G.hearts * 18 + 10 + lbl.length * 8, hx0 = ((VW - tot) / 2) | 0;
        for (i = 0; i < G.hearts; i++) pixHeart(hx0 + i * 18, y - 2, 2, '#e3625b');
        txt(lbl, hx0 + G.hearts * 18 + 10, y, 8, '#f4f6fb', 'left');
      } else txt('NOT ENOUGH FOR A SINGLE HEART', VW / 2, y, 8, '#9aa3b8');
      if (G.cowT > 1.2 && ((t * 2) | 0) % 2) txt(narrow ? 'TAP TO CLIMB OUT' : 'PRESS ANY KEY TO CLIMB OUT', VW / 2, VH - 13, 8, '#7ef0a8');
    }
    /* the contestant (skins only: the plain cave is left exactly as it was). Stood on his tail, head up. */
    function drawContestant(x, y, sc) {
      var frm = ((G.t * 3) | 0) % 4;
      g.save(); g.translate(x, y); g.scale(sc || 1, sc || 1); g.rotate(-Math.PI / 2); g.drawImage(SALA[frm], -28, -8); g.restore();
    }
    function drawPodium() {
      var px = 374, py = 148;
      drawContestant(px, py - 8, 1);
      g.fillStyle = '#06030a'; g.fillRect(px - 24, py + 2, 52, 40);
      g.fillStyle = '#3c3470'; g.fillRect(px - 26, py, 52, 40); g.fillStyle = '#1a1030'; g.fillRect(px - 24, py + 3, 48, 35);
      g.fillStyle = '#9d8bff'; g.fillRect(px - 26, py, 52, 2);
      txt(TH.name, px, py + 10, 8, '#fcd34d');
      if (SKIN === 'snake' && BOX) g.drawImage(BOX, px - 8, py + 26);
    }
    function bubbles(t, n, speed, alpha, x0, w, y0, h, grow) {
      var i, bx, by, br;
      g.strokeStyle = '#dff4ff'; g.lineWidth = 1;
      for (i = 0; i < n; i++) {
        br = 1 + (i % 4) * (grow ? 1.2 : 0.7);
        bx = x0 + ((i * 97) % w) + Math.sin(t * 2 + i) * 4;
        by = y0 + h - ((t * speed * (0.6 + (i % 5) * 0.2) + i * 53) % (h + 10));
        g.globalAlpha = alpha * (0.4 + (i % 3) * 0.3);
        g.beginPath(); g.arc(bx, by, br, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
    }
    /* the flush: the fountain from underneath, then the drain, then the title lands */
    function drawFlush() {
      var k = G.cardT, cx = VW / 2, cy = VH / 2 + 8, i, j, u, r, spin = k * 2.4;
      var dive = clamp((k - 0.55) / 1.1, 0, 1), dv = dive * dive * (3 - 2 * dive), fall = Math.min(1, k / 2.3), dark = clamp((k - 1.2) / 1.1, 0, 1);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false; g.textBaseline = 'top';
      if (G.shake > 0) g.translate(Math.round((Math.random() - 0.5) * G.shake * 7), Math.round((Math.random() - 0.5) * G.shake * 7));   /* the title's thud */
      g.fillStyle = '#03040a'; g.fillRect(-8, -8, VW + 16, VH + 16);
      /* the drain: rings rushing out past us toward the edge, two shades, spinning spokes between them; it opens from a
         small dark eye under the surface and swallows the screen as we go down */
      var RM = 26 + dv * 284;
      for (i = 11; i >= 0; i--) {
        u = ((i / 12) + k * 0.5) % 1; r = 5 + u * u * RM;
        g.globalAlpha = Math.min(1, u * 2.5) * (0.35 + dv * 0.65) * (1 - fall * 0.3);
        g.strokeStyle = TH.pipe[i % 2]; g.lineWidth = 2 + u * 9 * (0.4 + dv * 0.6);
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
      }
      g.lineWidth = 2; g.strokeStyle = TH.rim; g.globalAlpha = 0.55 * (0.3 + dv * 0.7);
      for (j = 0; j < 7; j++) {
        g.beginPath();
        for (i = 0; i <= 16; i++) { u = i / 16; r = 5 + u * u * RM; var an = j / 7 * TAU + spin + u * 2.4; if (i) g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); else g.moveTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); }
        g.stroke();
      }
      g.globalAlpha = 1;
      /* the water above us: the fountain seen from inside, bright and rippled, the spout coming down, the coins people
         threw in; it holds for a moment, then shrinks away as the drain takes us */
      var top = Math.round(118 * (1 - dv));
      if (top > 0) {
        g.fillStyle = TH.light + '0.55)'; g.fillRect(-8, -8, VW + 16, top + 8);
        g.fillStyle = TH.light + '0.3)';
        for (i = 0; i < 22; i++) { var cxx = ((i * 71 + k * 26) % (VW + 20)) - 10, cyy = (i * 37) % Math.max(1, top - 4) + Math.sin(k * 3 + i) * 2; g.fillRect(cxx | 0, cyy | 0, 8 + (i % 3) * 4, 2); }   /* caustics */
        g.fillStyle = 'rgba(6,4,14,0.6)'; g.fillRect(cx - 6, -8, 12, (top * 0.72 + 8) | 0); g.fillRect(cx - 16, -8, 32, 14);           /* the spout, in silhouette */
        g.fillStyle = TH.light + '0.8)'; for (i = 0; i < 6; i++) g.fillRect((cx - 5 + Math.sin(k * 9 + i * 2) * 3 + i * 2) | 0, ((top * 0.72) + (i * 5 + k * 60) % 18) | 0, 2, 2);   /* its bubbles */
        if (CRED.length) for (i = 0; i < 5; i++) g.drawImage(CRED[(i + ((k * 4) | 0)) % 6], (cx - 84 + i * 40 + Math.sin(k * 2 + i) * 4) | 0, (top - 14 + Math.sin(k * 1.7 + i * 2) * 2) | 0);   /* the coins */
        g.fillStyle = TH.light + '0.9)'; for (i = 0; i < VW; i += 4) g.fillRect(i, (top - 4 + Math.sin(i * 0.11 + k * 9) * 3) | 0, 4, 2);
      }
      bubbles(k, 34, 90 + fall * 160, 0.7 - fall * 0.3, 0, VW, 0, VH, false);
      /* the salamander: in with the splash, tumbling down into the dark, smaller and smaller */
      if (k < 2.45) {
        var e = Math.min(1, k / 2.2), ee = e * e, sc = 2.4 - 2.1 * ee, sy = -14 + (cy + 14) * e * (0.45 + 0.55 * e), swx = cx + Math.sin(k * 3.1) * (1 - ee) * 46;
        g.save(); g.translate(swx, sy); g.rotate(k * 6.5); g.scale(sc, sc); g.globalAlpha = k > 2.2 ? Math.max(0, (2.45 - k) / 0.25) : 1;
        g.drawImage(SALA[((k * 9) | 0) % 4], -15, -8); g.restore(); g.globalAlpha = 1;
      }
      /* closing in: the edges go dark as the drain swallows us */
      if (dark > 0) { g.fillStyle = 'rgba(0,0,0,' + (dark * 0.8).toFixed(3) + ')'; g.fillRect(-8, -8, VW + 16, VH + 16); }
      /* the title punches out of the swirl */
      if (k > FL_PUNCH - 0.22) {
        var p = Math.min(1, (k - (FL_PUNCH - 0.22)) / 0.22), ps = 3.2 - 2.2 * p * p;
        g.save(); g.translate(cx, cy - 10); g.scale(ps, ps); g.globalAlpha = p;
        txt('THE UNDERSPEND', 0, -12, 24, TH.title); g.restore(); g.globalAlpha = 1;
        if (k > FL_PUNCH + 0.3) { txt(TH.dept, cx, cy + 22, 8, TH.dim); }
      }
      if (k < 0.4) { g.fillStyle = TH.light + (0.95 * (1 - k / 0.4)).toFixed(3) + ')'; g.fillRect(-8, -8, VW + 16, VH + 16); }   /* the splash itself */
      if (k > 0.8 && ((G.t * 2) | 0) % 2) txt(narrow ? 'TAP' : 'ANY KEY', VW - 34, VH - 10, 8, '#d8d8d8');
    }
    /* the climb-out: up through the dark toward the light, bubbles streaming, a plop at the surface */
    function drawOut() {
      var k = G.outT, cx = VW / 2, u = Math.min(1, k / OUT_LEN), i;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false; g.textBaseline = 'top';
      g.fillStyle = '#03040a'; g.fillRect(0, 0, VW, VH);
      var gr = g.createRadialGradient(cx, -30, 4, cx, -30, 60 + u * u * 420);
      gr.addColorStop(0, TH.light + (0.35 + u * 0.6).toFixed(3) + ')'); gr.addColorStop(0.5, TH.light + (u * 0.35).toFixed(3) + ')'); gr.addColorStop(1, TH.light + '0)');
      g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
      for (i = 0; i < VW; i += 4) { g.fillStyle = TH.light + (0.3 + u * 0.6).toFixed(3) + ')'; g.fillRect(i, (14 - u * 20 + Math.sin(i * 0.09 + k * 7) * 3) | 0, 4, 2); }
      bubbles(k + 3, 40, 260, 0.9, 0, VW, 0, VH, true);
      var sy = VH + 20 - (VH + 60) * u * u, sc = 1 + u * 0.9;
      g.save(); g.translate(cx + Math.sin(k * 5) * 10, sy); g.scale(sc, sc); g.rotate(-Math.PI / 2 + Math.sin(k * 6) * 0.18);
      g.drawImage(SALA[((k * 10) | 0) % 4], -15, -8); g.restore();
      if (k > OUT_PLOP) { g.fillStyle = TH.light + Math.min(1, (k - OUT_PLOP) / (OUT_LEN - OUT_PLOP)).toFixed(3) + ')'; g.fillRect(0, 0, VW, VH); }
    }
    function drawDone() {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#05060f'; g.fillRect(0, 0, VW, VH);
      txt('CLIMBING OUT OF THE FOUNTAIN...', VW / 2, VH / 2 - 6, 8, '#9aa3b8');
    }
    function draw() {
      hiFrame = G.mode === 'cow' && !!hg;
      if (!hiFrame) { draw_(); return; }
      g = hg; gFont = 0; g.setTransform(HK, 0, 0, HK, 0, 0);
      try { draw_(); } finally { if (hg) hg.setTransform(1, 0, 0, 1, 0, 0); g = pf ? pf.getContext('2d') : null; gFont = 0; }
    }
    function draw_() {
      if (G.mode === 'flush') { drawFlush(); }
      else if (G.mode === 'out') { drawOut(); }
      else if (G.mode === 'ewj') { drawEwjCard(); }
      else if (G.mode === 'quiz') { drawQuiz(); }
      else if (G.mode === 'cow') { drawCow(); }
      else if (G.mode === 'done') { drawDone(); }
      else {
        drawCave();
        if (G.mode === 'title') drawTitle(); else if (G.mode === 'claim') drawClaim();
        if (G.mode === 'swim' || G.mode === 'claim') drawGauge();
        if (G.mode === 'drown') drawDrown();
      }
      if (G.flash > 0.004) { g.globalAlpha = Math.min(1, G.flash); g.fillStyle = '#ffffff'; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1; }
      if (G.paused) {
        g.fillStyle = 'rgba(6,3,10,.78)'; g.fillRect(0, 0, VW, VH);
        txt('PAUSED', VW / 2, VH / 2 - 26, 24, '#f4f6fb');
        txt('P OR ESC TO RESUME', VW / 2, VH / 2 + 10, 8, '#fcd34d');
        txt('THE FINANCE SYSTEM WILL WAIT. IT HAS TIME.', VW / 2, VH / 2 + 28, 8, '#9aa3b8');
      }
    }
    function compose() {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.imageSmoothingEnabled = false;
      sx.fillStyle = '#05060f'; sx.fillRect(0, 0, scrW, scrH);
      if (hiFrame && hb) sx.drawImage(hb, 0, 0, HW, HH, pfX, pfY, pfW, pfH); else sx.drawImage(pf, 0, 0, VW, VH, pfX, pfY, pfW, pfH);
      var b = Math.max(2, (dpr * 2) | 0);
      sx.fillStyle = '#1b1020';
      sx.fillRect(pfX - b, pfY - b, pfW + b * 2, b); sx.fillRect(pfX - b, pfY + pfH, pfW + b * 2, b);
      sx.fillRect(pfX - b, pfY, b, pfH); sx.fillRect(pfX + pfW, pfY, b, pfH);
    }

    /* ------------------------------------------------------------ the cabinet */
    var CSS = '.qc-ov{position:absolute;inset:0;z-index:9;overflow:hidden;background:#05060f;font-family:' + FONT + ';' +
      'letter-spacing:.04em;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none;}' +
      '.qc-ov canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;outline:none;touch-action:none;cursor:crosshair;}';
    var raf = 0, lastT = 0, acc = 0, STEP = 1 / 60, MAXSTEP = 40, frameN = 0, crashed = false, autoPaused = false;
    function oops(err) { if (!crashed) { crashed = true; try { console.error('cave: ', err && err.message ? err.message : err); } catch (e) {} } }
    function nowSec() { return (window.performance && performance.now ? performance.now() : Date.now()) / 1000; }
    function tscale() { var p = api.params, t = p && p.timescale ? p.timescale : 1; return t > 0 ? t : 1; }
    function buildDom() {
      if (!document.getElementById('qc-style')) {
        styleEl = document.createElement('style'); styleEl.id = 'qc-style'; styleEl.textContent = CSS;
        (document.head || document.documentElement).appendChild(styleEl);
      } else styleEl = document.getElementById('qc-style');
      overlay = document.createElement('div'); overlay.className = 'qc-ov';
      overlay.setAttribute('role', 'application'); overlay.setAttribute('aria-label', 'The Underspend: a blind cave salamander in the finance system');
      scr = document.createElement('canvas'); scr.setAttribute('tabindex', '0'); overlay.appendChild(scr);
      sx = scr.getContext('2d', { alpha: false });
      if (!pf) pf = mk(VW, VH);
      g = pf.getContext('2d'); g.imageSmoothingEnabled = false; gFont = 0;
      if (!hb) hb = mk(HW, HH);
      hg = hb.getContext('2d'); hg.imageSmoothingEnabled = false;
      if (!darkC) darkC = mk(VW, VH);
      dg = darkC.getContext('2d'); dg.imageSmoothingEnabled = false;
      (api.view || api.root || document.body).appendChild(overlay);
    }
    function layout() {
      if (!overlay || !scr) return;
      var cw = Math.max(120, overlay.clientWidth || 320), ch = Math.max(120, overlay.clientHeight || 200);
      lastCW = cw; lastCH = ch;
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      scrW = Math.round(cw * dpr); scrH = Math.round(ch * dpr);
      if (scr.width !== scrW) scr.width = scrW;
      if (scr.height !== scrH) scr.height = scrH;
      scr.style.width = '100%'; scr.style.height = '100%';
      narrow = cw < 560;
      var u = Math.min(scrW / VW, scrH / VH), iu = Math.floor(u);
      U = (iu >= 1 && iu / u > 0.86) ? iu : u;
      pfW = Math.round(VW * U); pfH = Math.round(VH * U);
      pfX = Math.round((scrW - pfW) / 2); pfY = Math.round((scrH - pfH) / 2);
      sx.textBaseline = 'top';
      if (G && G.mode === 'quiz' && G.qphase !== 'in') layoutAnswers();
    }
    function checkSize() { if (overlay && (overlay.clientWidth !== lastCW || overlay.clientHeight !== lastCH)) layout(); }
    function toLogical(e) {
      var r = scr.getBoundingClientRect(), kx = scrW / (r.width || 1), ky = scrH / (r.height || 1);
      return { x: ((e.clientX - r.left) * kx - pfX) / (U || 1), y: ((e.clientY - r.top) * ky - pfY) / (U || 1) };
    }
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!self.active || !G || !scr) return;
      if (document.hidden) { lastT = 0; return; }
      var dtr = lastT ? (ts - lastT) / 1000 : 0; lastT = ts;
      if (!(dtr > 0)) dtr = 0; else if (dtr > 0.1) dtr = 0.1;
      if ((frameN++ % 12) === 0) { checkVis(); checkSize(); }
      if (!G.paused) {
        acc += dtr * tscale();
        var n = 0;
        while (acc >= STEP && n < MAXSTEP && G && self.active) { acc -= STEP; n++; try { step(STEP); } catch (err) { oops(err); acc = 0; break; } }
        if (acc > 0.75) acc = 0;
      } else acc = 0;
      if (!G || !self.active || !scr) return;
      try { draw(); compose(); } catch (err) { oops(err); }
    }
    function setPaused(v) { if (!G || G.mode === 'done' || G.mode === 'out') return; v = !!v; if (v === G.paused) return; G.paused = v; autoPaused = false; sfx.ui(); }
    function checkVis() {
      if (!G || G.mode === 'done' || G.mode === 'out') return;
      var gone = !!document.hidden;
      if (!gone && api.root && api.root.getBoundingClientRect) {
        var r = api.root.getBoundingClientRect(), vh = window.innerHeight || 800;
        var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        gone = vis < Math.min(r.height, vh) * 0.35;
      }
      if (gone && !G.paused) { G.paused = true; autoPaused = true; }
      else if (!gone && G.paused && autoPaused) { G.paused = false; autoPaused = false; }
    }

    /* ------------------------------------------------------------ input */
    var MOVEK = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
    var QKEY = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3 };
    function onKey(e) { try { onKey_(e); } catch (err) { oops(err); } }
    function onKey_(e) {
      if (!self.active || !G) return;
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var down = e.type === 'keydown', c = e.code, used = true;
      if (c === 'KeyM') { if (down && !e.repeat) toggleMusic(); }
      else if (c === 'KeyP' || c === 'Escape') { if (down && !e.repeat) setPaused(!G.paused); }
      else if (G.paused) { if (down && !e.repeat) setPaused(false); }
      else if (G.mode === 'quiz' && G.qphase === 'ask') {
        if (down && !e.repeat && QKEY[c] !== undefined) answer(QKEY[c]);
        else if (down && (c === 'ArrowUp' || c === 'ArrowDown')) { var n = G.qlist[G.qi].a.length; G.qhover = ((G.qhover === undefined ? 0 : G.qhover) + (c === 'ArrowDown' ? 1 : n - 1)) % n; sfx.ui(); }
        else if (down && !e.repeat && (c === 'Enter' || c === 'Space')) answer(G.qhover === undefined ? 0 : G.qhover);
        else used = false;
      }
      else if (G.mode === 'flush') { if (down && !e.repeat) advance(); }
      else if (MOVEK[c] && G.mode === 'swim') keys[MOVEK[c]] = down;
      else if (down && !e.repeat && (c === 'Space' || c === 'Enter' || MOVEK[c])) advance();
      else used = false;
      if (used) e.preventDefault();
    }
    function toggleMusic() {
      try {
        if (typeof api.setMusicWanted !== 'function') return;
        var on = !api.musicWanted();
        api.setMusicWanted(on);
        if (on) api.music(G && (G.mode === 'quiz' || G.mode === 'cow' || G.mode === 'done' || G.mode === 'out') ? 'quest' : 'cave');
      } catch (e) {}
    }
    function ptDown(e) { try { ptDown_(e); } catch (err) { oops(err); } }
    function ptDown_(e) {
      if (!self.active || !G) return;
      if (e.target !== scr && e.target !== overlay) return;
      e.preventDefault();
      try { scr.focus(); } catch (err) {}
      if (G.paused) { setPaused(false); return; }
      var p = toLogical(e), i;
      if (G.mode === 'quiz' && G.qphase === 'ask') {
        for (i = 0; i < ANSR.length; i++) if (p.x >= ANSR[i].x && p.x <= ANSR[i].x + ANSR[i].w && p.y >= ANSR[i].y && p.y <= ANSR[i].y + ANSR[i].h) { answer(i); return; }
        return;
      }
      if (G.mode === 'swim') {
        if (stick.id !== -1) return;
        stick.id = e.pointerId; stick.on = true; stick.x0 = p.x; stick.y0 = p.y; stick.ax = 0; stick.ay = 0;
        try { scr.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
      advance();
    }
    function ptMove(e) { try { ptMove_(e); } catch (err) { oops(err); } }
    function ptMove_(e) {
      if (!self.active || !G) return;
      if (G.mode === 'quiz' && G.qphase === 'ask' && stick.id === -1) {
        var q = toLogical(e), k;
        G.qhover = undefined;
        for (k = 0; k < ANSR.length; k++) if (q.x >= ANSR[k].x && q.x <= ANSR[k].x + ANSR[k].w && q.y >= ANSR[k].y && q.y <= ANSR[k].y + ANSR[k].h) G.qhover = k;
        return;
      }
      if (e.pointerId !== stick.id) return;
      var p = toLogical(e), dx = p.x - stick.x0, dy = p.y - stick.y0, d = Math.hypot(dx, dy);
      if (d > 26) { stick.x0 = p.x - dx / d * 26; stick.y0 = p.y - dy / d * 26; d = 26; }
      stick.ax = d > 3 ? dx / 26 : 0; stick.ay = d > 3 ? dy / 26 : 0;
      e.preventDefault();
    }
    function ptUp(e) { if (e.pointerId !== stick.id) return; stick.id = -1; stick.on = false; stick.ax = 0; stick.ay = 0; }
    function onBlur() { keys.l = keys.r = keys.u = keys.d = false; stick.on = false; stick.id = -1; stick.ax = 0; stick.ay = 0; }
    function onVis() { if (document.hidden) { onBlur(); if (G && !G.paused && G.mode !== 'done' && G.mode !== 'out') { G.paused = true; autoPaused = true; } } lastT = 0; }
    function onResize() { try { layout(); } catch (e) { oops(e); } }
    function onScroll() { try { checkVis(); } catch (e) {} }
    function swallow(e) { e.preventDefault(); e.stopPropagation(); }
    function listen(on) {
      var m = on ? 'addEventListener' : 'removeEventListener';
      window[m]('keydown', onKey, true); window[m]('keyup', onKey, true);
      window[m]('blur', onBlur); window[m]('resize', onResize); window[m]('orientationchange', onResize);
      window[m]('scroll', onScroll, { passive: true });
      window[m]('pointermove', ptMove, { passive: false }); window[m]('pointerup', ptUp); window[m]('pointercancel', ptUp);
      document[m]('visibilitychange', onVis);
      if (overlay) { overlay[m]('pointerdown', ptDown, { passive: false }); overlay[m]('contextmenu', swallow); }
    }

    /* ------------------------------------------------------------ test hooks */
    function applyHooks() {
      var i;
      if (AT) {
        var p = AT.split(','), tx = parseInt(p[0], 10), ty = parseInt(p[1], 10);
        if (isFinite(tx) && isFinite(ty) && !tileSolid(tx, ty)) {
          P.x = tx * TS + TS / 2; P.y = ty * TS + TS / 2; P.vx = P.vy = 0;
          G.camx = clamp(P.x, VW / 2, WW - VW / 2); G.camy = clamp(P.y, VH / 2, WH - VH / 2);
        }
        G.mode = 'swim'; G.hint = 0;
      }
      if (BUD > 0) G.budget = Math.min(BUDGET0, BUD);
      if (JUMP === 'quiz' || JUMP === 'cow') {
        for (i = 0; i < CREDS.length; i++) CREDS[i].got = 1;
        G.got = CREDS.length; G.bounces = 14; G.budget = 8150;
      }
      if (JUMP === 'quiz') startQuiz();
      else if (JUMP === 'cow') { G.qlist = shuffled(G.got); G.qright = Math.max(0, G.got - 1); tally(); G.mode = 'cow'; G.cowT = 0; }
    }

    /* ------------------------------------------------------------ start / stop */
    function start(opts) {
      if (self.active) return;
      try {
        opts0 = opts || {};
        crashed = false; autoPaused = false;
        readHooks(opts0);
        if (!spritesBuilt || builtSkin !== SKIN) { buildSprites(); spritesBuilt = true; worldBuilt = false; }
        if (!worldBuilt) buildWorld();
        audioInit();
        buildDom();
        newRun();
        self.active = true;
        listen(true);
        layout();
        applyHooks();
        try { if (!api.musicWanted || api.musicWanted()) api.music(G.mode === 'quiz' || G.mode === 'cow' ? 'quest' : 'cave'); } catch (e) {}
        if (G.mode === 'ewj' || G.mode === 'title' || G.mode === 'swim') { sfx.splash(); puff(P.x, P.y - 6, 22, 3, 150); }
        else if (G.mode === 'flush') { sfx.splash(); sfx.gurgle(2.4); }
        lastT = 0; acc = 0; frameN = 0;
        raf = requestAnimationFrame(frame);
        try { scr.focus(); } catch (e) {}
      } catch (err) { oops(err); try { stop(); } catch (e) {} }
    }
    function stop() {
      self.active = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      listen(false);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      overlay = styleEl = scr = sx = g = dg = hg = hintEl = null; hiFrame = false;
      try { if (out) out.disconnect(); } catch (e) {}
      out = null; gates = {}; flushGain = null;
      onBlur();
      G = null; opts0 = null; ANSR.length = 0;
    }

    return self;
  };
})();
