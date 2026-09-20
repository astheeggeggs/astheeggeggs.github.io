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
   Interface: window.QuestCave(api) -> { start(opts {onDone({credits, hearts})}), stop(), active }
   Test hooks (query string, read inside start()):
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
    var GOD = false, JUMP = '', AT = '', LIT = false;
    function readHooks() { GOD = qp('cavegod') === '1'; LIT = qp('cavelit') === '1'; AT = qp('caveat', ''); JUMP = qp('cavecow') === '1' ? 'cow' : qp('cavequiz') === '1' ? 'quiz' : ''; }
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
      moo: moo
    };

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

    var SALA = [], SALAL = [], VILL = [], CRED = [], BUMP = [], AUDIT = [], LAMP = null, EXITS = [], COW = [], HOST = [], HEAD = null;
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
    function buildVilli() {
      var a, L, t, i, c, x, len, ang, px0, py0, cur, w, col, dark, tip;
      for (t = 0; t < 2; t++) for (L = 0; L < NLEN; L++) for (a = 0; a < NA; a++) {
        len = 6 + L * 3; c = mk(30, 30); x = c.getContext('2d'); ang = a / NA * TAU;
        dark = t ? '#611322' : '#4c1421'; col = t ? '#e2506c' : '#b8556a'; tip = t ? '#ffd0d8' : '#eda3b0';
        cur = (a % 3 - 1) * 0.06;
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
      /* bumper: a lit disc that fires you across the cavern */
      for (fr = 0; fr < 2; fr++) {
        c = mk(30, 30); x = c.getContext('2d');
        for (j = 0; j < 30; j++) for (i = 0; i < 30; i++) {
          d = Math.hypot(i - 14.5, j - 14.5);
          if (d > 14.6) continue;
          if (d > 12.4) R(x, PAL.k, i, j, 1, 1);
          else if (d > 9.6) R(x, fr ? '#ffffff' : (((i + j) & 3) < 2 ? '#f2d16b' : '#b88a1e'), i, j, 1, 1);
          else if (d > 8) R(x, '#2a1420', i, j, 1, 1);
          else if (d > 5) R(x, fr ? '#fff6d8' : '#6a2b3c', i, j, 1, 1);
          else R(x, fr ? '#ffffff' : '#ffd98a', i, j, 1, 1);
        }
        R(x, fr ? '#ffffff' : '#fff5cf', 11, 10, 2, 2);
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
      /* petty-cash lamp bolted to the wall */
      c = mk(18, 16); x = c.getContext('2d');
      R(x, PAL.k, 3, 0, 12, 4); R(x, '#4a3b2a', 4, 1, 10, 2); R(x, '#6b5738', 4, 1, 10, 1);
      R(x, PAL.k, 5, 3, 8, 3); R(x, '#33291c', 6, 4, 6, 1);
      R(x, PAL.k, 2, 5, 14, 8); R(x, '#241c14', 3, 6, 12, 6);
      R(x, '#ffb35c', 4, 6, 10, 5); R(x, '#ffd79a', 5, 7, 8, 3); R(x, '#fff6e0', 7, 7, 4, 2);
      R(x, PAL.k, 4, 12, 10, 2); R(x, '#3a2e1e', 5, 12, 8, 1);
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
      /* wall tiles: fleshy, mottled, two variants */
      for (fr = 0; fr < 3; fr++) {
        c = mk(TS, TS); x = c.getContext('2d');
        R(x, '#3c1420', 0, 0, TS, TS);
        for (k = 0; k < 42; k++) { var bx0 = (Math.random() * TS) | 0, by0 = (Math.random() * TS) | 0, bs = 1 + ((Math.random() * 3) | 0); R(x, Math.random() < 0.5 ? '#4d1b29' : '#2e0e18', bx0, by0, bs, bs); }
        for (k = 0; k < 7; k++) { var vy0 = (Math.random() * TS) | 0; R(x, '#571f2e', 0, vy0, TS, 1); }
        WALLT.push(c);
      }
      /* light punches and warm blooms, pre-rendered once */
      PUNCH.you = glowSprite(86, 'rgba(255,255,255,', 0.3);
      PUNCH.lamp = glowSprite(58, 'rgba(255,255,255,', 0.3);
      PUNCH.credit = glowSprite(34, 'rgba(255,255,255,', 0.3);
      PUNCH.bumper = glowSprite(40, 'rgba(255,255,255,', 0.3);
      PUNCH.exit = glowSprite(70, 'rgba(255,255,255,', 0.32);
      PUNCH.audit = glowSprite(30, 'rgba(255,255,255,', 0.3);
      WARM.you = glowSprite(66, 'rgba(150,205,255,', 0.1);
      WARM.lamp = glowSprite(52, 'rgba(255,168,74,', 0.1);
      WARM.credit = glowSprite(26, 'rgba(255,208,96,', 0.1);
      WARM.bumper = glowSprite(30, 'rgba(255,190,90,', 0.1);
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
      var c, x, fr, i, k;
      var K = '#141018', Wt = '#f6f2ea', Sh = '#cfc6b8', Pk = '#eba0ae', Bk = '#241c26';
      /* TWO COWS. The left one grins. The right one says WELL DONE. */
      for (fr = 0; fr < 3; fr++) {
        c = mk(96, 86); x = c.getContext('2d');
        for (i = 0; i < 4; i++) { var lx = [16, 32, 58, 74][i]; R(x, K, lx, 60, 12, 26); R(x, i < 2 ? Wt : Sh, lx + 2, 62, 8, 22); R(x, K, lx + 1, 80, 10, 6); R(x, '#4a3f36', lx + 2, 81, 8, 4); }
        R(x, K, 8, 32, 80, 36); R(x, Wt, 10, 34, 76, 32); R(x, Sh, 10, 60, 76, 6);
        R(x, Bk, 14, 36, 20, 16); R(x, Bk, 60, 44, 24, 14); R(x, Bk, 40, 58, 16, 8);
        R(x, K, 86, 34, 8, 4); R(x, Wt, 87, 35, 6, 2); R(x, K, 88, 36, 5, 20); R(x, Wt, 89, 37, 3, 17);
        R(x, K, 87, 54, 7, 9); R(x, Bk, 88, 55, 5, 7);
        R(x, K, 40, 66, 14, 8); R(x, Pk, 42, 66, 10, 6); R(x, '#d9808f', 44, 70, 2, 3); R(x, '#d9808f', 49, 70, 2, 3);
        R(x, K, 6, 14, 22, 18); R(x, Wt, 8, 16, 18, 14); R(x, Pk, 11, 19, 11, 8);
        R(x, K, 68, 14, 22, 18); R(x, Wt, 70, 16, 18, 14); R(x, Pk, 74, 19, 11, 8);
        R(x, K, 29, 2, 10, 10); R(x, '#d9cdb0', 30, 3, 8, 8); R(x, '#a8997a', 30, 8, 8, 3);
        R(x, K, 57, 2, 10, 10); R(x, '#d9cdb0', 58, 3, 8, 8); R(x, '#a8997a', 58, 8, 8, 3);
        R(x, K, 21, 8, 54, 46); R(x, Wt, 23, 10, 50, 42); R(x, Bk, 47, 10, 22, 15);
        R(x, K, 28, 18, 15, 14); R(x, '#ffffff', 30, 20, 11, 10); R(x, K, 32, 22, 6, 7);
        R(x, K, 53, 18, 15, 14); R(x, '#ffffff', 55, 20, 11, 10); R(x, K, 57, 22, 6, 7);
        if (fr === 0) { R(x, '#ffffff', 33, 23, 2, 2); R(x, '#ffffff', 58, 23, 2, 2); }
        R(x, K, 27, 33, 42, 21); R(x, Pk, 29, 35, 38, 17); R(x, '#d9808f', 29, 48, 38, 4);
        R(x, K, 35, 38, 7, 4); R(x, K, 54, 38, 7, 4);
        if (fr === 0) { for (k = 0; k < 7; k++) { var gx = 33 + k * 5, gy = 44 + (k === 0 || k === 6 ? -3 : k === 1 || k === 5 ? -1 : 1); R(x, K, gx, gy, 5, 3); } R(x, K, 32, 41, 3, 3); R(x, K, 64, 41, 3, 3); }
        else { var mo = fr === 1 ? 8 : 12; R(x, K, 37, 43, 23, mo); R(x, '#5c2530', 39, 45, 19, mo - 4); R(x, '#e07c8f', 41, 45 + mo - 8, 15, 4); }
        COW.push(c);
      }
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
    function buildSprites() { buildSalamander(); buildVilli(); buildProps(); buildCast(); }

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
      s.fillStyle = '#0b0710'; s.fillRect(0, 0, WW, WH);
      for (k = 0; k < 1400; k++) { var mx0 = (Math.random() * WW) | 0, my0 = (Math.random() * WH) | 0; R(s, Math.random() < 0.5 ? '#150c14' : '#1b1018', mx0, my0, 1, 1); }
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
            if (DX[k]) R(s, '#7a2a3a', tx * TS + (DX[k] > 0 ? TS - th : 0), ty * TS + i, th, 1);
            else R(s, '#7a2a3a', tx * TS + i, ty * TS + (DY[k] > 0 ? TS - th : 0), 1, th);
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
            if (rx + ry > 6) R(s, rx + ry > 8 ? '#43141f' : '#5d2231', ox + i, oy + j2, 1, 1);
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
          R(s, Math.abs(k) < 2 ? '#5e86a8' : '#3d5a76', qx - 1, qy - 1, 2, 2);
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
        mode: 'ewj', t: 0, cardT: 0, budget: BUDGET0, got: 0, bounces: 0, shake: 0, flash: 0, vig: 0,
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
      sfx.thunk(); puff(b.x + dx / d * BR, b.y + dy / d * BR, 12, 1, 190);
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
      { q: 'AN UNDERSPEND AT YEAR END IS:', a: ['PRUDENT HOUSEKEEPING', 'PROOF YOU DID NOT NEED THE MONEY', 'A GIFT TO YOUR SUCCESSOR', 'A ROUNDING ERROR'], r: 1 },
      { q: 'WHAT IS FULL ECONOMIC COSTING?', a: ['THE FULL COST OF THE ECONOMY', 'A NUMBER THE FUNDER PAYS 80% OF', 'COSTING, BUT ECONOMICAL', 'NOBODY HAS EVER KNOWN'], r: 1 },
      { q: 'HOW MANY BIOBANKS HAS HE ANALYSED?', a: ['ONE, VERY THOROUGHLY', 'SIXTEEN', 'ENOUGH', 'ONE MORE THAN LAST TIME YOU ASKED'], r: 1 },
      { q: 'YOUR H-INDEX GOES UP BY ONE. YOU HAVE:', a: ['ADVANCED HUMAN KNOWLEDGE', 'CITED TEN TIMES BY ONE CONSORTIUM', 'EARNED A PAY RISE', 'PEAKED'], r: 1 },
      { q: 'WHAT ARE OVERHEADS?', a: ['THE LIGHTS AND THE HEATING', 'ESTATES AND INDIRECT COSTS', 'THE PART YOU NEVER SEE', 'A MYTH, LIKE THE SABBATICAL'], r: 1 },
      { q: 'A GRANT IS AWARDED. THE MONEY ARRIVES:', a: ['IMMEDIATELY', 'ON THE START DATE', 'IN THE FINAL QUARTER, ALL AT ONCE', 'IT WAS ALREADY SPENT'], r: 2 },
      { q: 'WHAT IS A NO-COST EXTENSION?', a: ['FREE EXTRA TIME', 'THE SAME WORK, LATER, FOR NOTHING', 'AN EXTENSION, AT NO COST', 'A CRY FOR HELP'], r: 1 },
      { q: 'THREE QUOTES FOR A 400 POUND LAPTOP COSTS:', a: ['TEN MINUTES', '900 POUNDS OF ACADEMIC TIME', 'ONE FORM', 'THE REST OF THE FINANCIAL YEAR'], r: 1 },
      { q: 'WHAT IS THE PLURAL OF "DATA"?', a: ['DATA', 'DATUM', '"THE DATA ARE". YOU WILL BE TOLD', 'DATAS'], r: 2 },
      { q: 'VAT ON CLOUD COMPUTE IS:', a: ['FULLY RECLAIMABLE', '20% AND SOMEHOW YOUR PROBLEM', 'INCLUDED', 'A MATTER FOR THE COURTS'], r: 1 },
      { q: 'PEER REVIEW IS PAID AT A RATE OF:', a: ['THE LIVING WAGE', 'NOTHING, FOREVER', 'ONE FREE JOURNAL ISSUE', '30 POUNDS AND A CERTIFICATE'], r: 1 }
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
      if (G.qphase === 'out' && G.qt > 2.8) { G.mode = 'cow'; G.cowT = 0; sfx.moo(0, 148); sfx.moo(0.5, 118); }
    }
    function tally() {
      G.prize = BASE_PRIZE + G.got * PER_CREDIT + G.qright * PER_ANSWER + Math.min(G.bounces, MAX_BOUNCE) * PER_BOUNCE;
      G.hearts = G.prize >= 29000 ? 3 : G.prize >= 18000 ? 2 : G.prize >= 8000 ? 1 : 0;
    }
    function finish(pounds0, hearts) {
      if (!G || G.doneSent) return;
      G.doneSent = true; G.mode = 'done';
      try { api.music('quest'); } catch (e) {}
      try { if (opts0 && typeof opts0.onDone === 'function') opts0.onDone({ credits: pounds0, hearts: hearts }); } catch (e) { oops(e); }
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
      if (G.mode === 'ewj') { G.cardT += dt; if (G.cardT > EWJ_LEN) { G.mode = 'title'; G.cardT = 0; } }
      if (G.mode === 'title') { G.cardT += dt; if (G.cardT > 5.5) G.mode = 'swim'; }
      else if (G.mode === 'swim') updateSwim(dt);
      else if (G.mode === 'claim') { G.claimT += dt; if (G.claimT > 2.6) startQuiz(); }
      else if (G.mode === 'drown') { G.drownT += dt; P.y = Math.min(P.y + 26 * dt, WH - 8); P.vx *= 0.9; }
      else if (G.mode === 'quiz') updateQuiz(dt);
      else if (G.mode === 'cow') { G.cowT += dt; if (Math.random() < dt * 0.24) sfx.moo(0, 120 + Math.random() * 60); }
      if (G.mode === 'title' || G.mode === 'swim' || G.mode === 'claim' || G.mode === 'drown') {
        var k = Math.min(1, dt * 5.5);
        G.camx += (clamp(P.x + P.vx * 0.22, VW / 2, WW - VW / 2) - G.camx) * k;
        G.camy += (clamp(P.y + P.vy * 0.22, VH / 2, WH - VH / 2) - G.camy) * k;
      }
    }
    function advance() {                                              /* any key / any tap, wherever we are */
      if (!G) return;
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
        txt('DO NOT TOUCH THE WALLS', VW / 2, VH - 18, 8, '#e3625b');
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
        var ln = EWJ_LINES[li];
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
      g.fillStyle = 'rgba(6,3,10,.72)'; g.fillRect(0, 44, VW, 130);
      g.fillStyle = '#7a2a3a'; g.fillRect(0, 44, VW, 2); g.fillRect(0, 172, VW, 2);
      txt('DEPT. OF FINANCE', VW / 2, 56, 8, '#9aa3b8');
      txt('THE UNDERSPEND', VW / 2, 74, 24, '#f2d16b');
      txt('LOWER INTESTINE · SUB-LEVEL 3', VW / 2, 106, 8, '#c8899a');
      txt('THE WALLS ABSORB YOUR BUDGET.', VW / 2, 126, 8, '#f4f6fb');
      txt('FIND THE CLOUD COMPUTE NOBODY CLAIMED.', VW / 2, 140, 8, '#f4f6fb');
      if (((G.t * 2) | 0) % 2) txt(narrow ? 'TAP TO BEGIN' : 'PRESS ANY KEY', VW / 2, 158, 8, '#7ef0a8');
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
      txt('THE VILLI HAVE ABSORBED EVERY PENNY.', VW / 2, 92, 8, '#f4f6fb');
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
    function bubble(x, y, w, h, tipx) {
      g.fillStyle = '#141018'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle = '#f6f2ea'; g.fillRect(x, y, w, h);
      g.fillStyle = '#141018'; g.fillRect(tipx - 2, y + h, 12, 6); g.fillRect(tipx + 1, y + h + 6, 8, 5); g.fillRect(tipx + 4, y + h + 11, 5, 4);
      g.fillStyle = '#f6f2ea'; g.fillRect(tipx, y + h - 2, 8, 6); g.fillRect(tipx + 3, y + h + 6, 4, 4);
    }
    function drawCow() {
      var t = G.t, i, y, rows;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false; g.textBaseline = 'top';
      g.fillStyle = '#05060f'; g.fillRect(0, 0, VW, VH);
      for (i = 0; i < 40; i++) { g.fillStyle = ((i * 7 + ((t * 2) | 0)) % 11) === 0 ? '#2a3450' : '#141a2c'; g.fillRect((i * 37) % VW, (i * 53) % 120, 1, 1); }
      g.fillStyle = '#12361f'; g.fillRect(0, 110, VW, 8); g.fillStyle = '#1b4a2a'; g.fillRect(0, 110, VW, 2);
      for (i = 0; i < VW; i += 7) { g.fillStyle = (i % 14) ? '#1b4a2a' : '#245c34'; g.fillRect(i, 108, 2, 3); }
      var bob = Math.sin(t * 2.2) > 0 ? 0 : 1, bob2 = Math.sin(t * 2.2 + 1.3) > 0 ? 0 : 1;
      g.drawImage(COW[0], 14, 24 + bob);
      g.drawImage(COW[1 + (((t * 2.6) | 0) % 2)], 240, 24 + bob2);
      bubble(186, 0, 206, 24, 268);
      if (gFont !== 16) { g.font = '16px ' + FONT; gFont = 16; }
      g.textAlign = 'center'; g.fillStyle = '#141018'; g.fillText('WELL DONE', 289, 4);
      rows = [
        ['THE UNDERSPEND', pounds(BASE_PRIZE), '#f4f6fb'],
        [G.got + ' COMPUTE CREDIT' + (G.got === 1 ? '' : 'S'), pounds(G.got * PER_CREDIT), '#f4f6fb'],
        [G.qright + ' CORRECT ANSWER' + (G.qright === 1 ? '' : 'S'), pounds(G.qright * PER_ANSWER), '#f4f6fb'],
        ['BUMPER EXPENSES (' + Math.min(G.bounces, MAX_BOUNCE) + ')', pounds(Math.min(G.bounces, MAX_BOUNCE) * PER_BOUNCE), '#9aa3b8']
      ];
      y = 124;
      for (i = 0; i < rows.length; i++) {
        txt(rows[i][0], 26, y, 8, rows[i][2], 'left');
        txt(rows[i][1], VW - 26, y, 8, rows[i][2], 'right');
        g.fillStyle = '#2a2436';
        for (var d = 26 + rows[i][0].length * 8 + 6; d < VW - 26 - rows[i][1].length * 8 - 6; d += 6) g.fillRect(d, y + 6, 2, 1);
        y += 13;
      }
      g.fillStyle = '#2a2436'; g.fillRect(26, y + 1, VW - 52, 1); y += 6;
      txt('TOTAL CLOUD COMPUTE', 26, y, 8, '#fcd34d', 'left');
      txt(pounds(G.prize), VW - 26, y, 8, '#fcd34d', 'right');
      y += 18;
      if (G.hearts) {
        var lbl = '+ ' + G.hearts + ' HEART' + (G.hearts === 1 ? '' : 'S') + ' FOR THE BOSS', tot = G.hearts * 18 + 10 + lbl.length * 8, hx0 = ((VW - tot) / 2) | 0;
        for (i = 0; i < G.hearts; i++) pixHeart(hx0 + i * 18, y - 2, 2, '#e3625b');
        txt(lbl, hx0 + G.hearts * 18 + 10, y, 8, '#f4f6fb', 'left');
      } else txt('NOT ENOUGH FOR A SINGLE HEART', VW / 2, y, 8, '#9aa3b8');
      if (G.cowT > 1.2 && ((t * 2) | 0) % 2) txt(narrow ? 'TAP TO CLIMB OUT' : 'PRESS ANY KEY TO CLIMB OUT', VW / 2, VH - 13, 8, '#7ef0a8');
    }
    function drawDone() {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#05060f'; g.fillRect(0, 0, VW, VH);
      txt('CLIMBING OUT OF THE FOUNTAIN...', VW / 2, VH / 2 - 6, 8, '#9aa3b8');
    }
    function draw() {
      if (G.mode === 'ewj') { drawEwjCard(); }
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
      sx.drawImage(pf, 0, 0, VW, VH, pfX, pfY, pfW, pfH);
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
        while (acc >= STEP && n < MAXSTEP) { acc -= STEP; n++; try { step(STEP); } catch (err) { oops(err); acc = 0; break; } }
        if (acc > 0.75) acc = 0;
      } else acc = 0;
      try { draw(); compose(); } catch (err) { oops(err); }
    }
    function setPaused(v) { if (!G || G.mode === 'done') return; v = !!v; if (v === G.paused) return; G.paused = v; autoPaused = false; sfx.ui(); }
    function checkVis() {
      if (!G || G.mode === 'done') return;
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
        if (on) api.music(G && (G.mode === 'quiz' || G.mode === 'cow' || G.mode === 'done') ? 'quest' : 'cave');
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
    function onVis() { if (document.hidden) { onBlur(); if (G && !G.paused && G.mode !== 'done') { G.paused = true; autoPaused = true; } } lastT = 0; }
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
        readHooks();
        if (!spritesBuilt) { buildSprites(); spritesBuilt = true; }
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
      overlay = styleEl = scr = sx = g = dg = hintEl = null;
      try { if (out) out.disconnect(); } catch (e) {}
      out = null; gates = {};
      onBlur();
      G = null; opts0 = null; ANSR.length = 0;
    }

    return self;
  };
})();
