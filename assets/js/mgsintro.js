/* =============================================================================
   MGSINTRO.JS - "METAL GEAR PALMER 3: PEER EATER". An homage to the opening of Metal Gear Solid 3 (the Virtuous
   Mission): a title card, a transport plane under red light, a codec briefing that will not end, a HALO jump and a
   long fall over the town with the opening credits rolling, a parachute, and a landing on the player's spawn.
   About three minutes if left alone; the self-indulgence is the joke. Defines window.QuestMGSIntro(api) only.

   var mgs = window.QuestMGSIntro(api);       // api: the host api of quest.js (scene, camera, renderer, view, player,
                                              // pstate, speak, audio, music, musicWanted, setHud, showToast, pose, THREE)
   mgs.play({ onDone, orbit, hats, skin })    // -> true if it started. The host must then stop updating its own world and
                                              // call mgs.update(dt) every frame instead of rendering (this module renders).
                                              // onDone({skipped}) once, after everything is put back: the man stands at the
                                              // spawn he had when play() was called, the HUD is on, the town fog and camera
                                              // far plane are restored. The host then starts the game exactly as it would have.
                                              // orbit() -> {x,y,z,lx,ly,lz}: where the host's third-person camera will sit (the
                                              // last shot ends there); hats(dt, state): the host's hats.update; skin: 'snake'...
   mgs.update(dt)                             // per host frame (dt already timescaled). Never throws.
   mgs.skip()                                 // straight to the landing state, then onDone. Never throws.
   mgs.active                                 // true from play() until onDone
   window.QuestMGSIntro.state                 // {phase, sub, t, line, skipped, total}: read by tests; updated in place

   Input while it plays: F / Space / a click advance a codec line; Enter, Esc or the PRESS START TO SKIP button is a
   skip press (after the first second): the first asks ARE YOU SURE?, a second within four seconds skips.
   The plane is its own small scene; the fall happens in the real town (api.scene) with the host frozen. Everything is
   boxes (one shared BoxGeometry, scaled) with flat Lambert materials; the codec portraits are pixel art on a canvas.
   Sound: synthesised SFX on api.audio(); the score ('mgsbond', an original 60s spy-title piece in E minor, registered with
   Riff.addStyle the first time it plays) only through api.music(), so only when the player wants music.
   Plain ES5. Every entry point is guarded: a failure puts the world back and calls onDone, so the game starts normally.
   ============================================================================= */
(function () {
  'use strict';
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fin(v) { v = +v; return isFinite(v) ? v : 0; }
  function sm(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  /* ------------------------------------------------------------------ the codec script
     who: snake | major | para | sig. A line by someone other than the caller on screen first retunes (static, the new
     frequency). {ring} opens the codec from the plane, {close} shuts it (and, with more to come, the plane sits there
     for a moment before the next {ring}). big: the line is shouted. */
  var WHO = {
    snake: { name: 'SNAKE', voice: { base: 88, wave: 'sawtooth', spread: 0.15 } },
    major: { name: 'MAJOR REVISIONS', freq: '140.85', voice: { base: 140, wave: 'square', spread: 0.22 } },
    para: { name: 'PARA-METRIC', freq: '145.73', voice: { base: 300, wave: 'triangle', spread: 0.35 } },
    sig: { name: 'SIG-FIG', freq: '148.41', voice: { base: 470, wave: 'square', spread: 0.55 } }
  };
  var SCRIPT = [
    { ring: 'major' },
    { who: 'major', t: 'Snake, this is Major Revisions. Do you read me?' },
    { who: 'snake', t: 'Loud and clear, Major.' },
    { who: 'major', t: 'Welcome to Operation Virtuous Submission. Infiltrate the town, find the eight facts and get them past peer review.' },
    { who: 'snake', t: 'Eight facts. That\'s it?' },
    { who: 'major', t: 'That\'s it. Plus a data management plan, a statement of public impact and a Gantt chart.' },
    { who: 'snake', t: '...' },
    { who: 'major', t: 'The reviewers walk set routes and they have cones of vision. If one of them sees you, you\'ll hear about it.' },
    { who: 'major', t: 'If you\'re cornered, stand still. Your standard-issue cardboard box deploys automatically.' },
    { who: 'snake', t: 'A cardboard box.' },
    { who: 'major', t: 'Don\'t knock it, Snake. It\'s the only kit this department has ever bought on time. It came out of the underspend.' },
    { who: 'snake', t: 'The underspend?' },
    { who: 'major', t: 'Officially it doesn\'t exist. Unofficially it\'s somewhere wet. Don\'t ask. I\'m putting you through to your support team.' },
    { who: 'para', t: 'Hi Snake, Para-Metric here. I advise on anything that\'s normally distributed.' },
    { who: 'snake', t: 'And anything that isn\'t?' },
    { who: 'para', t: 'Everything is normal if you squint. Have you ever seen a Q-Q plot at three in the morning? Every point on the line. Not a tail in sight.' },
    { who: 'para', t: 'My favourite is the Gaussian. Symmetric, unimodal, finite variance. They don\'t make them like that any more.' },
    { who: 'para', t: 'People keep telling me to try a Wilcoxon test. I did, once. It\'s just not cinema.' },
    { who: 'para', t: 'No mean. No variance. No character arc. Just ranks, Snake. Ranks.' },
    { who: 'snake', t: '...' },
    { who: 'para', t: 'Snake?' },
    { who: 'major', t: 'Snake? SNAKE?!' },
    { who: 'major', t: 'SNAAAAAAKE!', big: true },
    { who: 'snake', t: 'I\'m awake. I was ranking my options.' },
    { who: 'sig', t: 'Sig-Fig, cutting in. Your briefing quotes p = 0.04999999. That is eight decimal places, Snake.' },
    { who: 'snake', t: 'There is no p-value in my briefing.' },
    { who: 'sig', t: 'There is now. And you\'re at 30,000.00 feet? That implies a precision I simply do not believe.' },
    { who: 'major', t: 'Sig-Fig, get off this frequency. Snake, did you know a grant takes 34 days to write and four minutes to reject?' },
    { who: 'sig', t: 'Four minutes. One significant figure. Lovely.' },
    { who: 'major', t: 'SIG-FIG. ... That\'s all, Snake. Good luck. Over and out.' },
    { close: 1 },
    { ring: 'major' },
    { who: 'major', t: 'Snake, one more thing. Don\'t forget to save your progress. Para-Metric?' },
    { who: 'para', t: 'Saving... Do you want to overwrite your previous data?' },
    { who: 'snake', t: 'Sure.' },
    { who: 'para', t: 'I can\'t, it was pre-registered. The game saves itself anyway, Snake. This was purely ceremonial.' },
    { who: 'major', t: 'The ramp is opening. Go and get them, Snake.' },
    { close: 1 }
  ];
  // the radio chatter over the jump (bottom bar, no codec screen)
  var RAMP_SUB = { who: 'major', t: 'Snake, before you jump, one last thing about the underspend. It\'s actually -' };
  var FALL_SUB = { who: 'major', t: 'Snake? SNAKE?! SNAAAAAAAKE!' };
  // the opening credits over the fall: a card every 2.25 s from 0.8 s, 2.15 s each, in the lower part of the frame
  var CREDITS = [
    ['A DUNCAN PALMER GAME'],
    ['A DUNCAN PALMER PRODUCTION'],
    ['METAL GEAR PALMER 3', 'PEER EATER'],
    ['STARRING', 'DUNCAN PALMER', 'AS SNAKE'],
    ['MAJOR REVISIONS', 'AS HIMSELF'],
    ['PARA-METRIC', '(ASSUMED NORMAL)'],
    ['SIG-FIG', '(3 S.F.)'],
    ['WRITTEN BY', 'DUNCAN PALMER'],
    ['ADDITIONAL CITATIONS BY', 'REVIEWER 2'],
    ['FUNDED IN PART BY', 'AN UNDERSPEND'],
    ['NO REVIEWERS WERE HARMED', 'SEVERAL WERE REBUTTED'],
    ['DIRECTED BY', 'DUNCAN PALMER'],
    ['A DUNCAN PALMER GAME', 'BY DUNCAN PALMER'],
    ['DUNCAN PALMER\'S', 'A DUNCAN PALMER PRODUCTION', 'OF A DUNCAN PALMER GAME', 'BY DUNCAN PALMER']
  ];
  var BOND_COL = ['#ff2a6d', '#ffb000', '#00c2a8', '#8a5cff', '#ff6a00', '#2ad1ff'];
  // phase lengths (game seconds)
  var D_TITLE = 11, D_PLANE = 7.6, D_RAMP = 6.8, D_FALL = 33, D_CHUTE = 12, D_LAND = 4.4;
  var Y_TOP = 240, Y_CHUTE = 50;
  var CHAR = 0.018;                                   // seconds a character takes to type

  /* ------------------------------------------------------------------ the score (Riff plug-in 'mgsbond')
     An original spy-title cue, 120 BPM in E minor, written in the 60s idiom (brass stabs, a muted-trumpet line with
     scoops and fall-offs, a line cliche in the strings, a twangy guitar figure, brushes, timpani) and quoting nothing:
     intro (4 bars: timpani roll, a held Em(maj9) blast, the guitar figure), then A (8) and B (8) round and round until
     the parachute opens (BOND.end), when it finishes on the next bar line with a 2-bar Em(maj9) ending. */
  var BPM = 120, BOND = { end: false, endStep: -1 }, BUSES = [];
  function f(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  var CH = {
    Em: [59, 64, 67], EmM7: [59, 63, 67], Em7: [59, 62, 67], Em6: [59, 61, 67], C7: [59, 64, 67], Am7: [57, 60, 64],
    Fs: [57, 60, 64], B7: [57, 60, 63, 66], Am: [57, 60, 64], E9: [52, 55, 59, 63, 66]
  };
  var SEC_A = {
    ch: ['Em', 'EmM7', 'Em7', 'Em6', 'C7', 'Am7', 'Fs', 'B7'], root: [40, 40, 40, 40, 36, 33, 30, 35],
    mel: [[4, 71, 2], [6, 76, 2], [8, 79, 6], [14, 78, 2],
          [16, 76, 4], [20, 75, 2], [22, 76, 2], [24, 71, 8, 'fall'],
          [34, 74, 2], [36, 76, 2], [38, 79, 2], [40, 81, 4], [44, 82, 2], [46, 81, 2],
          [48, 79, 6], [54, 76, 2], [56, 73, 8],
          [64, 83, 4], [68, 76, 2], [70, 79, 2], [72, 83, 6], [78, 81, 2],
          [80, 79, 4], [84, 76, 4], [88, 72, 4], [92, 69, 4],
          [96, 72, 4], [100, 69, 2], [102, 66, 2], [104, 69, 4], [108, 72, 4],
          [112, 75, 6], [118, 72, 2], [120, 71, 8, 'fall']],
    stab: [1, 3, 5, 7]
  };
  var SEC_B = {
    ch: ['Am', 'Em', 'Am', 'Em', 'C7', 'B7', 'Em', 'B7'], root: [33, 40, 33, 40, 36, 35, 40, 35],
    mel: [[0, 76, 2], [2, 81, 6], [8, 79, 2], [10, 81, 2], [12, 84, 4],
          [16, 83, 8], [24, 79, 4], [28, 76, 4],
          [32, 76, 2], [34, 81, 6], [40, 83, 2], [42, 84, 2], [44, 86, 4],
          [48, 88, 8], [56, 86, 2], [58, 83, 2], [60, 79, 4],
          [64, 79, 4], [68, 76, 4], [72, 83, 8],
          [80, 81, 4], [84, 78, 4], [88, 75, 8, 'fall'],
          [96, 76, 16, 'shake']],
    stab: [5, 7]
  };
  var GTR = [[0, 52], [2, 55], [4, 57], [6, 58], [7, 57], [8, 55], [10, 52], [12, 50], [14, 52]];
  function bondBus(K) {
    var A = K.AC, i;
    for (i = 0; i < BUSES.length; i++) if (BUSES[i].ac === A) return BUSES[i];
    var b = { ac: A, dry: A.createGain(), wet: A.createGain() };
    b.dry.gain.value = 2.2; b.dry.connect(K.master);              // levelled by Riff.render against the town theme (see HANDOVER)
    b.wet.gain.value = 0.7; b.wet.connect(K.hall ? K.hall() : K.master);
    BUSES.push(b); if (BUSES.length > 4) BUSES.shift();
    return b;
  }
  function bondVoices(K, B) {
    var A = K.AC;
    function out(g, wet) { g.connect(B.dry); if (wet) g.connect(B.wet); }
    function osc(type, fr, t, end, det) { var o = A.createOscillator(); o.type = type; o.frequency.value = fr; if (det) o.detune.value = det; o.start(t); o.stop(end); return o; }
    function vib(t, end, hz, cents, delay) {
      var v = A.createOscillator(), g = A.createGain(); v.frequency.value = hz;
      g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(0, t + delay); g.gain.linearRampToValueAtTime(cents, t + delay + 0.25);
      v.connect(g); v.start(t); v.stop(end); return g;
    }
    return {
      trumpet: function (n, t, dur, vel, kind) {          // muted-ish trumpet: a scoop into the note, a filter that blooms, a late vibrato
        var end = t + dur + 0.2, fr = f(n), lp = A.createBiquadFilter(), g = A.createGain();
        lp.type = 'lowpass'; lp.Q.value = 2.2;
        lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1600 + 1600 * vel, t + 0.05); lp.frequency.exponentialRampToValueAtTime(1500, t + Math.max(0.08, dur));
        var pk = vel * 0.085;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.03); g.gain.setValueAtTime(pk * 0.85, t + Math.max(0.04, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.16);
        var lf = vib(t, end, kind === 'shake' ? 7.5 : 5.6, kind === 'shake' ? 60 : 14, dur > 0.5 ? 0.22 : 9);
        [['sawtooth', 0, 1], ['square', 7, 0.45]].forEach(function (p) {
          var o = osc(p[0], fr, t, end, p[1]), og = A.createGain(); og.gain.value = p[2];
          o.frequency.setValueAtTime(fr * 0.95, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.06);
          if (kind === 'fall') { o.frequency.setValueAtTime(fr, t + dur * 0.7); o.frequency.exponentialRampToValueAtTime(fr * 0.62, t + dur + 0.15); }
          lf.connect(o.detune); o.connect(og); og.connect(lp);
        });
        lp.connect(g); out(g, true);
      },
      section: function (notes, t, dur, vel, stab) {      // the brass section: two saws a note, a filter that blats open
        var end = t + dur + 0.35, lp = A.createBiquadFilter(), g = A.createGain();
        lp.type = 'lowpass'; lp.Q.value = 1.6;
        lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(1200 + 2600 * vel, t + 0.04); lp.frequency.exponentialRampToValueAtTime(stab ? 600 : 1300, t + Math.max(0.12, dur));
        var pk = vel * (stab ? 0.07 : 0.055) / Math.sqrt(notes.length / 3);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.02); g.gain.setValueAtTime(pk * 0.8, t + Math.max(0.03, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
        notes.forEach(function (n) { [-8, 8].forEach(function (d) { var o = osc('sawtooth', f(n), t, end, d); o.connect(lp); }); });
        lp.connect(g); out(g, true);
      },
      strings: function (notes, t, dur, vel, trem) {       // three saws a note, a slow bow, vibrato; trem: a fast bowed tremolo
        var end = t + dur + 0.6, lp = A.createBiquadFilter(), g = A.createGain(), amp = A.createGain();
        lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
        var pk = vel * 0.03 / Math.sqrt(notes.length / 3);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + (trem ? dur * 0.9 : 0.3)); g.gain.setValueAtTime(pk, t + Math.max(0.31, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
        if (trem) { var tl = A.createOscillator(), tg = A.createGain(); tl.type = 'square'; tl.frequency.value = 13; tg.gain.value = 0.45; amp.gain.value = 0.55; tl.connect(tg); tg.connect(amp.gain); tl.start(t); tl.stop(end); }
        var lf = vib(t, end, 5.2, 9, 0.15);
        notes.forEach(function (n) { [-11, 0, 11].forEach(function (d) { var o = osc('sawtooth', f(n), t, end, d); lf.connect(o.detune); o.connect(lp); }); });
        lp.connect(amp); amp.connect(g); out(g, true);
      },
      bass: function (n, t, dur, vel) {                    // electric bass, picked
        var end = t + dur + 0.1, lp = A.createBiquadFilter(), g = A.createGain();
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(380, t + Math.min(0.25, dur));
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.2, t + 0.006); g.gain.exponentialRampToValueAtTime(vel * 0.09, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
        osc('triangle', f(n), t, end).connect(lp); var o2 = osc('sawtooth', f(n), t, end), o2g = A.createGain(); o2g.gain.value = 0.25; o2.connect(o2g); o2g.connect(lp);
        lp.connect(g); out(g, false);
      },
      twang: function (n, t, dur, vel) {                   // a baritone guitar through a spring: bright pluck, a dip of the bar
        var end = t + dur + 0.5, lp = A.createBiquadFilter(), g = A.createGain();
        lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.35);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.1, t + 0.004); g.gain.exponentialRampToValueAtTime(vel * 0.03, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
        var lf = vib(t, end, 6, 22, 0.12);
        [['sawtooth', 0], ['square', -5]].forEach(function (p) { var o = osc(p[0], f(n), t, end, p[1]); lf.connect(o.detune); o.connect(lp); });
        lp.connect(g); out(g, true);
      }
    };
  }
  function bondStep(K, V, step, t, spb, endStep) {
    var bar, s, sec, j, k, m, chn, i;
    var sw = (step & 1) ? spb * 0.18 : 0;                // a little swing on the off-sixteenths
    if (endStep >= 0 && step >= endStep) {               // the ending: 2 bars, then silence
      j = step - endStep; if (j >= 32) return;
      if (j === 0) {
        K.crash(t, 0.8); K.timp(40, t, 1.0); K.softKick(t);
        V.section(CH.E9.map(function (n) { return n + 12; }), t, spb * 24, 1.0);
        V.strings([64, 67, 71, 75, 78], t, spb * 28, 1.0, true);
        V.trumpet(83, t, spb * 22, 1.0, 'shake');
        V.bass(28, t, spb * 24, 1.0);
      }
      if (j >= 16 && j < 24) K.timp(40, t, 0.3 + (j - 16) * 0.07, true);
      if (j === 24) { K.timp(40, t, 1.0); K.crash(t, 0.5); V.section([64, 67, 71, 76], t, spb * 2, 1.0, true); V.bass(28, t, spb * 2, 1.0); }
      return;
    }
    if (step < 64) {                                      // the intro
      bar = step >> 4; s = step & 15;
      if (bar < 2) {
        K.timp(40, t, 0.12 + (step / 32) * 0.6, true);
        if (step === 0) V.strings([52, 59], t, spb * 32, 0.9, true);
      }
      if (bar === 2 && s === 0) {
        K.crash(t, 0.9); K.timp(40, t, 1.0);
        V.section(CH.E9.map(function (n) { return n + 12; }), t, spb * 14, 1.0);
        V.bass(28, t, spb * 14, 1.0);
        V.trumpet(83, t, spb * 12, 0.9, 'fall');
      }
      if (bar === 3) {
        for (k = 0; k < GTR.length; k++) if (GTR[k][0] === s) V.twang(GTR[k][1], t + sw, spb * 2, 1.0);
        if (s >= 8 && (s & 1) === 0) K.snare(t, 0.15 + (s - 8) * 0.05);
      }
      return;
    }
    j = (step - 64) % 256; sec = j < 128 ? SEC_A : SEC_B; j = j & 127; bar = j >> 4; s = j & 15;
    chn = CH[sec.ch[bar]];
    // drums: brushes and a soft kick, a backbeat that leans in for B, a fill into each section
    if (s === 0 || s === 8) K.softKick(t);
    if (s === 4 || s === 12) K.snare(t, sec === SEC_B ? 0.32 : 0.22);
    if ((s & 1) === 0) K.hat(t + sw, s === 14, 0.35);
    if (s === 14 || s === 7) K.brush(t + sw, 0.6);
    if (j === 0) { K.crash(t, sec === SEC_B ? 0.6 : 0.4); if (sec === SEC_B) K.timp(40, t, 0.8); }
    if (bar === 7 && s >= 8) K.snare(t, 0.12 + (s - 8) * 0.04);
    // bass: root, root, fifth, octave, fifth, root, third, on a pushed eighth figure
    var r = sec.root[bar], BASS = { 0: r, 3: r, 6: r + 7, 8: r + 12, 10: r + 7, 12: r, 14: r + 3 };
    if (BASS[s] !== undefined) V.bass(BASS[s], t + sw, spb * (s === 0 || s === 8 ? 2.6 : 1.6), s === 0 ? 1 : 0.8);
    // strings: the whole bar (the line cliche walks down inside them in A)
    if (s === 0) V.strings(chn, t, spb * 16, sec === SEC_B ? 1.0 : 0.85, false);
    // brass stabs on the off-beats where the tune is holding
    for (i = 0; i < sec.stab.length; i++) if (sec.stab[i] === bar && (s === 6 || s === 10 || s === 14)) V.section(chn.map(function (n) { return n + 5 > 71 ? n : n + 12; }), t + sw, spb * 1.2, s === 14 ? 1 : 0.75, true);
    if (sec === SEC_B && bar === 7 && (s === 0 || s === 6 || s === 12)) V.section([69, 72, 75, 78], t + sw, spb * 1.5, 1, true);
    // the tune: a trumpet in A; in B the section doubles it an octave down
    for (k = 0; k < sec.mel.length; k++) {
      m = sec.mel[k]; if (m[0] !== j) continue;
      V.trumpet(m[1], t + sw, spb * m[2], sec === SEC_B ? 1.0 : 0.85, m[3]);
      if (sec === SEC_B) V.section([m[1] - 12], t + sw, spb * m[2] * 0.9, 0.7, false);
    }
  }
  function bondSchedule(S) {
    var R = window.Riff; if (!R || !R.kit) return;
    var K = R.kit(), B = bondBus(K), V = bondVoices(K, B), spb = 60 / BPM / 4;
    if (!S.offline && BOND.end && BOND.endStep < 0) BOND.endStep = Math.ceil(S.step / 16) * 16;
    var endStep = S.offline ? 320 : BOND.endStep;          // an offline render (Riff.render) plays the intro, A, B and the ending
    while (S.nextT < S.now - 0.05) { S.nextT += spb; S.step++; }
    while (S.nextT < S.now + 0.3) {
      try { bondStep(K, V, S.step, S.nextT, spb, endStep); } catch (e) {}
      S.nextT += spb; S.step++;
    }
  }
  function registerScore() {
    try {
      var R = window.Riff;
      if (R && R.addStyle && R.kit && !(R.has && R.has('mgsbond'))) R.addStyle('mgsbond', { dreadful: false, schedule: bondSchedule });
      return !!(R && R.has && R.has('mgsbond'));
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ pixel text */
  var PAL = ['#000000', '#08301a', '#17683a', '#33b064', '#8dffb6'];
  var CSS = '.qmgs{position:absolute;inset:0;z-index:8;overflow:hidden;cursor:pointer;-webkit-user-select:none;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
    '.qmgs canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges}' +
    '.qmgs-skip{position:absolute;right:.7rem;bottom:.7rem;max-width:70%;font:8px/1.6 "Press Start 2P",monospace;color:#fff;background:rgba(0,0,0,.6);' +
    'border:2px solid #fff;padding:.45rem .6rem;box-shadow:2px 2px 0 #000;cursor:pointer;text-align:right;letter-spacing:.04em}' +
    '.qmgs-skip.is-sure{color:#fcd34d;border-color:#fcd34d;animation:qmgsblink .5s steps(2) infinite}' +
    '@keyframes qmgsblink{50%{opacity:.55}}' +
    '.qmgs-skip .qmgs-s{display:none}' +
    '@media (min-width:900px){.qmgs-skip{font-size:10px}}' +
    '@media (max-width:640px){.qmgs-skip{right:.45rem;bottom:.45rem;padding:.3rem .4rem;font-size:7px}.qmgs-skip:not(.is-sure) .qmgs-l{display:none}.qmgs-skip:not(.is-sure) .qmgs-s{display:inline}}' +
    // the touch pad and the A / B buttons have nothing to do while it plays (taps go to the picture and the skip button)
    '.quest.is-mgs .q-pad,.quest.is-mgs .q-act{display:none!important}';

  window.QuestMGSIntro = function (api) {
    api = api || {};
    var T = api.THREE || window.THREE;
    var S = { active: false, phase: '', pt: 0, t: 0, sure: 0, shot: '', ci: 0, cs: '', ct: 0, caller: 'major', shownFreq: '140.85',
              line: null, typed: 0, spoke: 0, hold: 0, armUp: 0, sub: null, subT: 0, skipped: false, failed: false };
    var O = {}, D = {}, R3 = null, F3 = null, SV = null, SFX = null, onKeyRef = null;
    var state = window.QuestMGSIntro.state = window.QuestMGSIntro.state || {};
    var VW = 384, VH = 216, g = null, cc = null, cg = null;
    var tmpV = null;

    /* -------------------------------------------------------------- resources: one box, cached materials, everything listed */
    var LIST = [], BOX = null, MATS = {};
    function keep(x) { LIST.push(x); return x; }
    function mat(hex, em, extra) {
      var k = hex + '_' + (em || 0) + (extra ? '_' + extra : ''), m = MATS[k];
      if (m) return m;
      m = new T.MeshLambertMaterial({ color: hex });
      if (em) { m.emissive = new T.Color(hex); m.emissiveIntensity = em; }
      if (extra === 'glass') { m.transparent = true; m.opacity = 0.85; }
      MATS[k] = m; return keep(m);
    }
    function basic(hex, op) { var m = new T.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false, fog: false }); return keep(m); }
    function bx(parent, w, h, d, m, x, y, z) {
      var me = new T.Mesh(BOX, typeof m === 'number' ? mat(m) : m);
      me.scale.set(w, h, d); me.position.set(x || 0, y || 0, z || 0); parent.add(me); return me;
    }
    function grp(parent, x, y, z) { var gg = new T.Group(); gg.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(gg); return gg; }
    function canvasTex(w, h, draw, repeat) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); draw(x, w, h);
      var tx = new T.CanvasTexture(c); tx.magFilter = T.NearestFilter; tx.minFilter = T.LinearFilter; tx.generateMipmaps = false;
      if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
      if (repeat) { tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(repeat, repeat); }
      return keep(tx);
    }
    function texMat(tx) { return keep(new T.MeshLambertMaterial({ map: tx })); }
    function stencil(text, bg, fg) {
      return texMat(canvasTex(128, 32, function (x, w, h) {
        x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = '8px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(text, w / 2, h / 2 + 1); x.fillRect(4, 3, w - 8, 1); x.fillRect(4, h - 4, w - 8, 1);
      }));
    }
    function patchwork() {                            // Oxfordshire from the air: fields, hedges, the odd lane
      return canvasTex(256, 256, function (x, w, h) {
        var cols = ['#4f8a3c', '#5e9a46', '#77a64a', '#a8b55a', '#c9b860', '#8a9a52', '#3f7a3a', '#9c8a50', '#6aa04c'], i, j, n = 0;
        var xs = [0], ys = [0], v;
        for (v = 0; v < w;) { v += 18 + Math.floor(hash(++n) * 30); xs.push(Math.min(w, v)); }
        for (v = 0; v < h;) { v += 18 + Math.floor(hash(++n) * 30); ys.push(Math.min(h, v)); }
        for (i = 0; i < xs.length - 1; i++) for (j = 0; j < ys.length - 1; j++) {
          var split = hash(i * 31 + j * 7) < 0.35, cx = xs[i], cy = ys[j], cw = xs[i + 1] - cx, ch = ys[j + 1] - cy;
          x.fillStyle = cols[Math.floor(hash(i * 13 + j * 17 + 3) * cols.length)]; x.fillRect(cx, cy, cw, ch);
          if (split) { x.fillStyle = cols[Math.floor(hash(i * 5 + j * 29 + 1) * cols.length)]; x.fillRect(cx, cy, Math.floor(cw / 2), ch); }
          if (hash(i * 3 + j * 11) < 0.4) { x.fillStyle = 'rgba(255,255,255,0.08)'; for (var k = 2; k < ch; k += 4) x.fillRect(cx + 1, cy + k, cw - 2, 1); }   // ploughed
        }
        x.fillStyle = '#2f5a2a';
        for (i = 0; i < xs.length; i++) x.fillRect(xs[i], 0, 1, h);
        for (j = 0; j < ys.length; j++) x.fillRect(0, ys[j], w, 1);
        x.fillStyle = '#c9b88e'; x.fillRect(0, 120, w, 2); x.fillRect(90, 0, 2, h);
        for (i = 0; i < 40; i++) { x.fillStyle = '#2a5a2c'; x.fillRect(Math.floor(hash(i + 90) * w), Math.floor(hash(i + 190) * h), 3, 3); }   // copses
      }, 10);
    }

    /* -------------------------------------------------------------- sound effects (api.audio(), our own bus) */
    function sfxInit() {
      try {
        var A = api.audio && api.audio(); if (!A) return;
        if (A.state === 'suspended' && A.resume) { var p = A.resume(); if (p && p.catch) p.catch(function () {}); }
        var bus = A.createGain(); bus.gain.value = 1; bus.connect(A.destination);
        SFX = { A: A, bus: bus, live: [], noise: null };
        var n = Math.floor(A.sampleRate * 2), b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        SFX.noise = b;
      } catch (e) { SFX = null; }
    }
    function sNode(o) { if (SFX) { SFX.live.push(o); if (SFX.live.length > 200) SFX.live.splice(0, 100); } return o; }
    function tone(type, f0, f1, t0, dur, peak, a) {
      if (!SFX) return;
      try {
        var A = SFX.A, t = A.currentTime + (t0 || 0), o = sNode(A.createOscillator()), gg = A.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(peak, t + (a || 0.005)); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(gg); gg.connect(SFX.bus); o.start(t); o.stop(t + dur + 0.05);
      } catch (e) {}
    }
    function hiss(type, fr, q, t0, dur, peak, a, f1) {
      if (!SFX) return;
      try {
        var A = SFX.A, t = A.currentTime + (t0 || 0), s = sNode(A.createBufferSource()), fl = A.createBiquadFilter(), gg = A.createGain();
        s.buffer = SFX.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(fr, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q;
        gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(peak, t + (a || 0.005)); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(fl); fl.connect(gg); gg.connect(SFX.bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
      } catch (e) {}
    }
    function loopSfx(build) {                         // a held sound with a settable level: {set(level, secs), stop(secs)}
      if (!SFX) return null;
      try {
        var A = SFX.A, gg = A.createGain(); gg.gain.value = 0.0001; gg.connect(SFX.bus);
        var nodes = build(A, gg);
        nodes.forEach(function (n) { sNode(n); try { n.start(); } catch (e) {} });
        return {
          set: function (v, secs) { try { gg.gain.setTargetAtTime(Math.max(0.0001, v), A.currentTime, Math.max(0.01, secs || 0.3) / 3); } catch (e) {} },
          stop: function (secs) { try { gg.gain.setTargetAtTime(0.0001, A.currentTime, Math.max(0.01, secs || 0.2) / 3); nodes.forEach(function (n) { try { n.stop(A.currentTime + (secs || 0.2) + 0.1); } catch (e) {} }); } catch (e) {} }
        };
      } catch (e) { return null; }
    }
    function engineLoop() {
      return loopSfx(function (A, out) {
        var lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.connect(out);
        var o1 = A.createOscillator(), o2 = A.createOscillator(), og = A.createGain(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = 47; o2.frequency.value = 49.3; og.gain.value = 0.5;
        o1.connect(og); o2.connect(og); og.connect(lp);
        var s = A.createBufferSource(), nl = A.createBiquadFilter(), ng = A.createGain(); s.buffer = SFX.noise; s.loop = true; nl.type = 'lowpass'; nl.frequency.value = 420; ng.gain.value = 1.4;
        s.connect(nl); nl.connect(ng); ng.connect(out);
        return [o1, o2, s];
      });
    }
    function windLoop() {
      return loopSfx(function (A, out) {
        var s = A.createBufferSource(), bp = A.createBiquadFilter(), lfo = A.createOscillator(), lg = A.createGain();
        s.buffer = SFX.noise; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.5;
        lfo.frequency.value = 0.31; lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency);
        s.connect(bp); bp.connect(out);
        return [s, lfo];
      });
    }
    var snd = {
      ring: function () { for (var k = 0; k < 4; k++) { tone('square', 1240, 1240, k * 0.34, 0.05, 0.05, 0.003); tone('square', 1660, 1660, k * 0.34 + 0.07, 0.05, 0.05, 0.003); } },
      open: function () { tone('sine', 300, 1900, 0, 0.14, 0.07, 0.004); tone('square', 2400, 2400, 0.13, 0.03, 0.03); },
      close: function () { tone('sine', 1900, 220, 0, 0.16, 0.06, 0.004); },
      static: function (d) { hiss('bandpass', 2600, 0.8, 0, d || 0.3, 0.05, 0.01); },
      tick: function () { tone('square', 1500, 1500, 0, 0.018, 0.02, 0.002); },
      boom: function () { tone('sine', 62, 28, 0, 2.2, 0.32, 0.01); hiss('lowpass', 900, 0.7, 0, 1.6, 0.16, 0.01, 120); hiss('highpass', 5200, 0.7, 0.02, 0.9, 0.05, 0.002); },
      slam: function () { tone('sine', 120, 45, 0, 0.5, 0.22, 0.004); hiss('lowpass', 1400, 0.8, 0, 0.35, 0.12, 0.002, 200); },
      buzzer: function () { tone('square', 220, 220, 0, 0.55, 0.045, 0.01); tone('square', 223, 223, 0, 0.55, 0.035, 0.01); },
      hydraulic: function () { tone('sawtooth', 85, 140, 0, 3.1, 0.035, 0.3); hiss('bandpass', 300, 1.5, 0, 3.1, 0.04, 0.3, 500); tone('square', 60, 40, 3.1, 0.25, 0.12, 0.004); },
      whump: function () { hiss('lowpass', 500, 0.9, 0, 0.6, 0.3, 0.004, 90); tone('sine', 80, 38, 0, 0.5, 0.26, 0.004); for (var k = 0; k < 8; k++) hiss('bandpass', 900, 1.2, 0.25 + k * 0.07, 0.06, 0.06 * (1 - k / 9), 0.004); },
      thud: function () { tone('sine', 95, 42, 0, 0.32, 0.3, 0.003); hiss('lowpass', 700, 0.8, 0, 0.25, 0.18, 0.002, 150); }
    };
    function sfxStop() {
      if (!SFX) return;
      try {
        var A = SFX.A; SFX.bus.gain.setTargetAtTime(0.0001, A.currentTime, 0.05);
        SFX.live.forEach(function (n) { try { n.stop(A.currentTime + 0.25); } catch (e) {} });
        var bus = SFX.bus; setTimeout(function () { try { bus.disconnect(); } catch (e) {} }, 600);
      } catch (e) {}
      SFX = null;
    }

    /* -------------------------------------------------------------- the overlay (one low-res canvas + the skip button) */
    function overlayBuild() {
      if (!document.getElementById('qmgs-style')) { var st = document.createElement('style'); st.id = 'qmgs-style'; st.textContent = CSS; document.head.appendChild(st); D.style = st; }
      var wrap = document.createElement('div'); wrap.className = 'qmgs';
      var cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); wrap.appendChild(cv);
      var sk = document.createElement('button'); sk.type = 'button'; sk.className = 'qmgs-skip'; sk.hidden = true; sk.setAttribute('aria-label', 'Skip the intro'); wrap.appendChild(sk); D.skip = sk; skipLabel(false);
      api.view.appendChild(wrap);
      try { if (api.root && api.root.classList) api.root.classList.add('is-mgs'); } catch (e) {}
      D.wrap = wrap; D.cv = cv; g = cv.getContext('2d');
      cc = document.createElement('canvas'); cg = cc.getContext('2d');
      // act on the lift, not the press, so a swipe that scrolls the page is not a tap
      D.down = null;
      D.onDown = function (e) { D.down = { x: e.clientX, y: e.clientY }; };
      D.onCancel = function () { D.down = null; };
      D.onPtr = function (e) {
        try {
          var d0 = D.down; D.down = null;
          if (!d0 || Math.abs(e.clientX - d0.x) + Math.abs(e.clientY - d0.y) > 10) return;
          e.preventDefault(); if (e.target === sk || (sk.contains && sk.contains(e.target))) skipPress(); else advance();
        } catch (err) {}
      };
      wrap.addEventListener('pointerdown', D.onDown);
      wrap.addEventListener('pointerup', D.onPtr);
      wrap.addEventListener('pointercancel', D.onCancel);
      onKeyRef = function (e) {
        try {
          if (!S.active) return;
          // only keys meant for the game: not a focused link or field elsewhere, and not while it is scrolled away
          var tg = e.target;
          if (tg && tg !== document.body && tg !== document.documentElement && !(api.root && api.root.contains(tg))) return;
          if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return;
          var r = api.root && api.root.getBoundingClientRect ? api.root.getBoundingClientRect() : null;
          if (r && !(r.bottom > 0 && r.top < (window.innerHeight || 800))) return;
          var c = e.code;
          // the host must not see these: the Enter that skips would otherwise reach its own key handler with the game
          // already running, and F at the spawn is F: DIVE IN? (the fountain is two units away)
          if (c === 'Enter' || c === 'NumpadEnter' || c === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) skipPress(); return; }
          if (c === 'KeyF' || c === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) advance(); }
        } catch (err) {}
      };
      window.addEventListener('keydown', onKeyRef, true);
      try { if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').catch(function () {}); } catch (e) {}
    }
    function fit() {
      var w = api.view.clientWidth || 640, h = api.view.clientHeight || 360;
      VH = 216; VW = Math.max(288, Math.round(VH * (w / h) / 2) * 2);
      if (D.cv.width !== VW || D.cv.height !== VH) { D.cv.width = VW; D.cv.height = VH; }
      if (cc.width !== VW || cc.height !== VH) { cc.width = VW; cc.height = VH; }
      g.imageSmoothingEnabled = false; cg.imageSmoothingEnabled = false;
    }
    function font(x, size) { x.font = size + 'px "Press Start 2P", monospace'; x.textBaseline = 'top'; }
    function text(x, s, px, py, size, col, align) {
      font(x, size); x.fillStyle = col; var w = s.length * size;
      px = align === 'center' ? px - w / 2 : align === 'right' ? px - w : px;
      x.textAlign = 'left'; x.fillText(s, Math.round(px), Math.round(py));
    }
    function textO(x, s, px, py, size, col, out, align) {
      var k = Math.max(1, size >> 3), o = [[-k, 0], [k, 0], [0, -k], [0, k], [-k, -k], [k, k], [-k, k], [k, -k]];
      for (var i = 0; i < o.length; i++) text(x, s, px + o[i][0], py + o[i][1], size, out, align);
      text(x, s, px, py, size, col, align);
    }
    function wrapLines(s, cols) {
      var words = s.split(' '), out = [], cur = '';
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (!cur.length) cur = w;
        else if (cur.length + 1 + w.length <= cols) cur += ' ' + w;
        else { out.push(cur); cur = w; }
        while (cur.length > cols) { out.push(cur.slice(0, cols)); cur = cur.slice(cols); }
      }
      if (cur.length) out.push(cur);
      return out;
    }
    function bars(k) {                                  // letterbox: k 0..1 of the full bar height
      var h = Math.round(VH * 0.11 * clamp(k, 0, 1)); if (h <= 0) return 0;
      g.fillStyle = '#000'; g.fillRect(0, 0, VW, h); g.fillRect(0, VH - h, VW, h); return h;
    }
    function typed(s, t0, now, rate) { var n = Math.floor((now - t0) / (rate || 0.05)); return n <= 0 ? '' : s.slice(0, n); }

    /* -------------------------------------------------------------- the codec portraits: box people in four greens, 32 x 40 cells, 2 px a cell */
    function portrait(x, who, ox, oy, talk, dim) {
      function P(px, py, w, h, c) { x.fillStyle = PAL[c]; x.fillRect(ox + px * 2, oy + py * 2, w * 2, h * 2); }
      var i, j;
      P(0, 0, 32, 40, 1);
      for (j = 1; j < 40; j += 3) P(0, j, 32, 1, 0);
      P(9, 27, 14, 6, 3); P(9, 27, 14, 1, 2);                                         // neck
      if (who === 'snake') {
        P(1, 31, 30, 9, 2); P(11, 30, 10, 3, 1); P(7, 31, 3, 9, 1); P(22, 31, 3, 9, 1);   // sneaking suit, collar, harness
        P(7, 6, 18, 22, 3); P(21, 6, 4, 22, 2);                                       // the box head
        P(7, 4, 18, 4, 1); P(6, 8, 2, 8, 1); P(24, 8, 2, 8, 1);                        // hair
        P(6, 8, 20, 3, 4); P(26, 9, 3, 2, 4); P(28, 11, 3, 2, 4); P(29, 13, 2, 3, 4);   // the bandana and its tails
        P(9, 13, 5, 1, 1); P(18, 13, 5, 1, 1); P(10, 15, 4, 1, 0); P(18, 15, 4, 1, 0);  // brows, narrowed eyes
        for (j = 20; j < 28; j++) for (i = 8 + (j & 1); i < 24; i += 2) P(i, j, 1, 1, 2);   // stubble
        P(15, 17, 2, 3, 2);                                                           // nose
        if (talk) P(13, 23, 6, 2, 0); else P(13, 24, 6, 1, 0);
      } else if (who === 'major') {
        P(1, 31, 30, 9, 2); P(12, 31, 8, 9, 4); P(15, 31, 2, 9, 1); P(10, 30, 3, 3, 4); P(19, 30, 3, 3, 4);   // tweed, shirt, tie, collar
        P(7, 6, 18, 22, 3); P(21, 6, 4, 22, 2);
        P(7, 3, 18, 5, 4); P(11, 3, 1, 4, 2); P(6, 6, 2, 9, 4); P(24, 6, 2, 9, 4);      // grey hair, a side parting, sideburns
        P(9, 12, 5, 1, 4); P(18, 12, 5, 1, 4);                                        // white eyebrows
        P(10, 14, 3, 2, 0); P(19, 14, 3, 2, 0);
        P(9, 16, 6, 1, 4); P(17, 16, 6, 1, 4); P(15, 16, 2, 1, 4);                     // half-moon reading glasses
        P(15, 17, 2, 3, 2);
        P(10, 20, 12, 2, 4); P(9, 21, 2, 2, 4); P(21, 21, 2, 2, 4);                   // the moustache
        if (talk) P(13, 23, 6, 2, 0); else P(13, 23, 6, 1, 1);
        P(25, 8, 1, 7, 4); P(25, 15, 1, 1, 2);                                        // a red pen behind the ear
      } else if (who === 'para') {
        P(1, 31, 30, 9, 4); P(10, 31, 12, 9, 2); P(1, 31, 2, 9, 3); P(29, 31, 2, 9, 3);   // lab coat over a dark top
        P(8, 7, 16, 21, 3); P(20, 7, 4, 21, 2);
        P(6, 3, 20, 7, 1); P(5, 8, 4, 17, 1); P(23, 8, 4, 17, 1); P(9, 9, 6, 2, 1);      // a bob with a fringe
        P(9, 13, 6, 5, 4); P(10, 14, 4, 3, 3); P(17, 13, 6, 5, 4); P(18, 14, 4, 3, 3); P(15, 14, 2, 1, 4);   // square specs
        P(11, 15, 2, 2, 0); P(19, 15, 2, 2, 0);
        P(15, 19, 2, 2, 2);
        if (talk) P(13, 23, 6, 2, 0); else P(13, 23, 6, 1, 1);
        P(22, 35, 1, 1, 0); P(23, 33, 1, 2, 0); P(24, 32, 2, 1, 0); P(26, 33, 1, 2, 0); P(27, 35, 1, 1, 0);   // a bell-curve pin
      } else {
        P(1, 31, 30, 9, 2); for (j = 31; j < 40; j += 3) for (i = 2 + (j % 2) * 2; i < 30; i += 4) P(i, j, 2, 2, 1);   // argyle
        P(12, 30, 8, 3, 4);
        P(7, 6, 18, 22, 3); P(21, 6, 4, 22, 2);
        P(7, 4, 18, 3, 2);                                                             // a buzz cut
        P(8, 12, 7, 6, 0); P(9, 13, 5, 4, 4); P(17, 12, 7, 6, 0); P(18, 13, 5, 4, 4); P(15, 13, 2, 1, 0);   // thick frames
        P(11, 14, 2, 2, 0); P(20, 14, 2, 2, 0);
        P(5, 11, 2, 9, 1); P(5, 19, 2, 1, 1); P(6, 20, 7, 1, 1); P(12, 20, 2, 2, 0);   // the headset and its boom
        P(15, 18, 2, 2, 2);
        if (talk) P(13, 23, 6, 2, 0); else P(13, 24, 6, 1, 0);
        P(25, 33, 6, 6, 3); P(26, 24, 2, 9, 3); P(26, 24, 2, 1, 4);                    // and one finger, raised
      }
      if (dim) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(ox, oy, 64, 80); }
    }
    function staticNoise(x, ox, oy, w, h) {
      for (var i = 0; i < 260; i++) { x.fillStyle = PAL[1 + Math.floor(Math.random() * 4)]; x.fillRect(ox + Math.floor(Math.random() * w / 2) * 2, oy + Math.floor(Math.random() * h), 2, 1); }
    }

    /* -------------------------------------------------------------- the plane: a C-130-ish hold, all boxes */
    function planeBuild() {
      var P = { scene: new T.Scene(), cam: new T.PerspectiveCamera(55, 16 / 9, 0.05, 3000), clouds: [] };
      var sky = 0x9fd0f5; P.scene.background = new T.Color(sky); P.scene.fog = new T.Fog(sky, 90, 900);
      P.hemi = new T.HemisphereLight(0xff5040, 0x200608, 1.25); P.scene.add(P.hemi);
      P.key = new T.DirectionalLight(0xff4a30, 0.55); P.key.position.set(1, 3, -2); P.scene.add(P.key);
      P.day = new T.DirectionalLight(0xfff4e0, 0); P.day.position.set(-0.4, 1.2, 3); P.scene.add(P.day);
      var H = grp(P.scene), olive = 0x3e4a32, ribC = 0x2b3322, z;
      bx(H, 5.6, 0.2, 26.4, 0x2a2c30, 0, -0.1, -2);                                   // floor
      for (z = -14; z < 10.5; z += 0.9) bx(H, 5.2, 0.03, 0.12, 0x3a3d44, 0, 0.015, z);   // tread
      bx(H, 0.2, 4, 26.4, olive, -2.85, 2, -2); bx(H, 0.2, 4, 26.4, olive, 2.85, 2, -2);   // walls
      bx(H, 5.9, 0.2, 26.4, 0x343d2a, 0, 4, -2);                                      // ceiling
      bx(H, 5.9, 4, 0.2, 0x2e3526, 0, 2, -15.1);                                      // the bulkhead, a door, its window
      bx(H, 1.2, 2.4, 0.06, 0x23281d, 0, 1.2, -14.98); bx(H, 0.5, 0.3, 0.07, 0xffe0a0, 0, 1.9, -14.95).material = mat(0xffe0a0, 0.9);
      for (z = -14.2; z < 10.6; z += 1.6) {                                           // ribs
        bx(H, 0.26, 3.9, 0.22, ribC, -2.66, 1.95, z); bx(H, 0.26, 3.9, 0.22, ribC, 2.66, 1.95, z); bx(H, 5.3, 0.26, 0.22, ribC, 0, 3.82, z);
      }
      bx(H, 0.14, 0.14, 25.5, 0x77776a, -1.9, 3.62, -2); bx(H, 0.14, 0.14, 25.5, 0x77776a, 1.9, 3.62, -2);   // pipes
      bx(H, 0.05, 0.05, 25, 0xb8b8a0, 1.2, 3.5, -2);                                   // the static line
      for (z = -12; z < 9; z += 4) bx(H, 0.34, 0.12, 0.34, 0xff2a20, 0, 3.86, z).material = mat(0xff2a20, 1.4);   // red lamps
      for (z = -12.6; z < 8; z += 3.2) { bx(H, 0.06, 0.34, 0.34, 0x9ccfff, -2.74, 2.4, z).material = mat(0x9ccfff, 0.5); bx(H, 0.06, 0.34, 0.34, 0x9ccfff, 2.74, 2.4, z).material = mat(0x9ccfff, 0.5); }
      [-1, 1].forEach(function (sd) {                                                  // red webbing benches
        bx(H, 0.6, 0.08, 17, 0xa0302a, sd * 2.25, 0.85, 0.8); bx(H, 0.05, 0.75, 17, 0x8a2822, sd * 2.62, 1.35, 0.8);
        for (var k = -7; k <= 9; k += 2.2) bx(H, 0.05, 0.85, 0.05, 0x55585e, sd * 1.98, 0.42, k);
      });
      var crateM = mat(0x6b5a3c);                                                       // cargo: a pallet, crates, stencils
      bx(H, 3.4, 0.2, 3.2, 0x5a4a30, 0, 0.1, -10.5);
      bx(H, 1.5, 1.2, 1.4, crateM, -0.8, 0.8, -11.2); bx(H, 1.5, 1.2, 1.4, crateM, 0.8, 0.8, -11.2); bx(H, 1.5, 1.0, 1.4, crateM, -0.8, 0.7, -9.7);
      bx(H, 1.3, 1.0, 1.3, 0xb98a55, 0.8, 0.7, -9.7); bx(H, 1.3, 1.0, 1.2, crateM, 0, 1.9, -11.2);
      bx(H, 1.2, 0.5, 0.02, stencil('UNDERSPEND', '#6b5a3c', '#1c160c'), -0.8, 0.85, -8.99);
      bx(H, 1.1, 0.4, 0.02, stencil('PREPRINTS', '#b98a55', '#4a3018'), 0.8, 0.8, -9.04);
      bx(H, 1.1, 0.4, 0.02, stencil('DO NOT OPEN', '#6b5a3c', '#1c160c'), 0, 1.95, -10.54);
      for (z = -11.8; z < -9; z += 0.5) bx(H, 3.3, 0.03, 0.03, 0x222222, 0, 2.45, z);   // netting
      P.light = bx(H, 0.3, 0.3, 0.12, 0xff2020, 2.55, 2.8, 10.1); P.light.material = keep(new T.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.3 }));
      P.light.rotation.y = -Math.PI / 2;
      P.ramp = grp(H, 0, 0, 10.6); P.ramp.rotation.x = -Math.PI / 2;                   // closed: stood up as the back wall
      bx(P.ramp, 5.5, 0.22, 4.1, 0x2e3328, 0, 0, 2.05);
      bx(P.ramp, 5.4, 0.02, 0.4, texMat(canvasTex(64, 8, function (x) { for (var i = 0; i < 64; i += 8) { x.fillStyle = '#f2c230'; x.fillRect(i, 0, 4, 8); x.fillStyle = '#16181c'; x.fillRect(i + 4, 0, 4, 8); } })), 0, 0.12, 3.85);
      bx(H, 5.9, 0.6, 0.2, 0x2e3526, 0, 3.75, 10.7);                                   // the lintel over the door
      var cm = mat(0xf4f7fb, 0.75), k;                                                       // outside: clouds streaming past, England far below
      for (k = 0; k < 26; k++) {
        var cl = bx(P.scene, 10 + hash(k) * 16, 2 + hash(k + 40) * 3, 8 + hash(k + 80) * 10, cm, (hash(k + 7) - 0.5) * 140, -14 - hash(k + 9) * 90, 20 + hash(k + 11) * 420);
        P.clouds.push(cl);
      }
      var fields = new T.Mesh(keep(new T.PlaneGeometry(6000, 6000)), mat(0xffffff, 0, 'fields'));
      fields.material.map = patchwork(); fields.material.needsUpdate = true;
      fields.rotation.x = -Math.PI / 2; fields.position.y = -700; P.scene.add(fields); P.fields = fields; P.fieldsMat = fields.material;
      R3 = P;
    }

    /* -------------------------------------------------------------- the fall kit: in the town scene for the jump, the chute and the landing */
    function fallBuild() {
      var F = { root: grp(null), streaks: [], deck: [], dust: [] }, k;
      var under = new T.Mesh(R3.fields.geometry, R3.fieldsMat);
      under.rotation.x = -Math.PI / 2; under.position.y = -0.6; F.root.add(under);
      var stm = basic(0xffffff, 0.45);
      for (k = 0; k < 44; k++) { var s = bx(F.root, 0.05, 3 + hash(k) * 4, 0.05, stm, 0, 0, 0); s.userData.a = hash(k + 3) * 6.283; s.userData.r = 2.5 + hash(k + 5) * 12; s.userData.y = (hash(k + 9) - 0.5) * 50; F.streaks.push(s); }
      var dm = keep(new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdfe8f2, emissiveIntensity: 0.7, transparent: true, opacity: 0.86, side: T.DoubleSide }));
      for (k = 0; k < 22; k++) F.deck.push(bx(F.root, 14 + hash(k + 20) * 16, 2.5 + hash(k + 21) * 3, 10 + hash(k + 22) * 14, dm, (hash(k + 23) - 0.5) * 130, 150 + (hash(k + 24) - 0.5) * 8, (hash(k + 25) - 0.5) * 130));
      var pm = keep(new T.MeshLambertMaterial({ color: 0xc8b48a, transparent: true, opacity: 0.8 }));
      for (k = 0; k < 16; k++) { var d = bx(F.root, 0.22, 0.22, 0.22, pm, 0, -50, 0); d.visible = false; F.dust.push(d); }
      F.dustMat = pm;
      // the canopy and the pack hang off the man himself (removed again at the end)
      F.pack = grp(null, 0, 0, 0); bx(F.pack, 0.78, 0.95, 0.34, 0x4b5a34, 0, 1.45, -0.44); bx(F.pack, 0.8, 0.12, 0.36, 0x2d3520, 0, 1.0, -0.44); bx(F.pack, 0.1, 0.5, 0.1, 0xd8c070, 0.3, 1.25, -0.63);
      F.chute = grp(null, 0, 2.2, 0); var cg2 = grp(F.chute, 0, 0, 0); F.canopy = cg2; var Rr = 4.4;
      for (k = -3; k <= 3; k++) {
        var a = k * 0.21, pnl = bx(cg2, 1.32, 0.14, 2.9, (k & 1) ? 0x5d6b3a : 0xc2b280, Math.sin(a) * Rr, Math.cos(a) * Rr - Rr + 4.1, 0);
        pnl.rotation.z = -a;
      }
      var lm = mat(0x2a2a2a), tq = new T.Quaternion(), zv = new T.Vector3(0, 0, 1), dv = new T.Vector3();
      [[-0.45, 0.0, -3.1, 3.6, -1.3], [0.45, 0.0, 3.1, 3.6, -1.3], [-0.45, 0.0, -3.1, 3.6, 1.3], [0.45, 0.0, 3.1, 3.6, 1.3]].forEach(function (L) {
        dv.set(L[2] - L[0], L[3] - L[1], L[4]); var len = dv.length(); dv.normalize(); tq.setFromUnitVectors(zv, dv);
        var line = bx(cg2, 0.03, 0.03, len, lm, (L[0] + L[2]) / 2, (L[1] + L[3]) / 2, L[4] / 2); line.quaternion.copy(tq);
      });
      F3 = F;
    }

    /* -------------------------------------------------------------- the man (the host's own player group, skin and hats included) */
    function limbs() { var u = (api.player && api.player.userData) || {}; return [u.la, u.ra, u.ll, u.rl]; }
    function setLimb(m, x, z) { if (m) { m.rotation.x = x; m.rotation.z = z; } }
    function hatsTick(dt, st) { if (O.hats) try { O.hats(dt, st); } catch (e) { O.hats = null; } }
    function poseSeat(arm) {                         // seated; arm 0..1 lifts a hand to his ear for the codec (the box arm is
      var L = limbs(); setLimb(L[1], -0.45, 0); setLimb(L[2], -1.2, 0.05); setLimb(L[3], -1.2, -0.05);   // shortened, which reads as a bent elbow;
      setLimb(L[0], lerp(-0.45, -3.06, arm), lerp(0, 0.3, arm)); if (L[0]) L[0].scale.y = lerp(O.limbSy[0], 0.62, arm);   // his right, the camera's side)
    }
    function poseSky(t, k) {                          // spread-eagle; k 0..1 blends in from the dive
      var L = limbs(), fl = Math.sin(t * 9) * 0.06;
      setLimb(L[0], 0.25 * k, -1.95 * k + fl); setLimb(L[1], 0.25 * k, 1.95 * k - fl);
      setLimb(L[2], 0.55 * k, -0.32 * k - fl); setLimb(L[3], 0.55 * k, 0.32 * k + fl);
    }
    function poseChute(t, k) {
      var L = limbs(), sw = Math.sin(t * 1.7) * 0.08;
      setLimb(L[0], lerp(0.25, 0, k), lerp(-1.95, -2.75, k)); setLimb(L[1], lerp(0.25, 0, k), lerp(1.95, 2.75, k));
      setLimb(L[2], lerp(0.55, sw, k), lerp(-0.32, -0.04, k)); setLimb(L[3], lerp(0.55, -sw, k), lerp(0.32, 0.04, k));
    }
    function poseCrouch(k) {
      var L = limbs();
      setLimb(L[0], -0.7 * k, -0.2 * k); setLimb(L[1], -0.7 * k, 0.2 * k); setLimb(L[2], -0.9 * k, 0); setLimb(L[3], 0.35 * k, 0);
    }

    /* -------------------------------------------------------------- phases */
    function go(ph) { S.phase = ph; S.pt = 0; state.phase = ph; state.pt = 0; }
    function cut(shot) { S.shot = shot; S.shotT = 0; }

    function enterPlane() {
      var p = api.player;
      R3.scene.add(p); p.rotation.order = 'YXZ';
      p.position.set(-2.05, 0.09, 8.2); p.rotation.set(0, Math.PI / 2, 0); p.scale.set(1, 1, 1);
      if (F3 && F3.pack && O.skin === 'snake') p.add(F3.pack);
      poseSeat(0);
      S.engine = engineLoop(); if (S.engine) S.engine.set(0.07, 1.5);
      cut('dolly');
    }
    function planeCam(dt) {
      var c = R3.cam, t = S.t, u, k;
      S.shotT += dt;
      c.aspect = api.camera.aspect || 16 / 9;
      var bump = Math.sin(t * 1.3) * 0.02 + Math.sin(t * 3.1) * 0.012;
      if (S.shot === 'dolly') {
        u = sm(S.shotT / 6.2);
        c.position.set(lerp(0.4, 0.9, u), lerp(2.75, 2.05, u) + bump, lerp(-12.8, 2.6, u));
        c.lookAt(lerp(0, -1.6, u), lerp(1.4, 1.7, u), lerp(10, 8.3, u));
      } else if (S.shot === 'snake') {
        k = Math.min(1, S.shotT / 20);
        c.position.set(lerp(0.55, 0.15, k), 2.35 + bump, lerp(10.0, 9.55, k));
        c.lookAt(-2.0, 2.15, 8.25);
      } else {
        c.position.set(1.45, 2.3 + bump, 4.0);
        c.lookAt(-0.1, 1.25, 12.8);
      }
      c.updateProjectionMatrix();
    }
    function planeWorld(dt) {
      var i, cl;
      for (i = 0; i < R3.clouds.length; i++) { cl = R3.clouds[i]; cl.position.z += dt * 46; if (cl.position.z > 460) cl.position.z -= 440; }
      var fl = 1 + Math.sin(S.t * 17) * 0.04 + (Math.sin(S.t * 5.3) > 0.97 ? -0.3 : 0);
      R3.hemi.intensity = (S.green ? 0.85 : 1.25) * fl;
    }
    function renderPlane() { try { api.renderer.render(R3.scene, R3.cam); } catch (e) {} }

    // codec sub-states: ring (the plane, CALL blinking) -> open -> line / tune ... -> close -> gap (the plane) -> ring ...
    function codecNext() {
      S.ci++; S.ct = 0;
      var e = SCRIPT[S.ci];
      if (!e) { go('ramp'); enterRamp(); return; }
      if (e.ring) { S.cs = 'ring'; S.caller = e.ring; S.shownFreq = WHO[e.ring].freq; snd.ring(); return; }
      if (e.close) {
        S.cs = 'close'; snd.close();
        return;
      }
      if (e.who !== 'snake' && e.who !== S.caller) { S.cs = 'tune'; S.tuneTo = e.who; snd.static(0.45); S.ci--; return; }   // retune, then this line
      S.cs = 'line'; S.line = e; S.typed = 0; S.spoke = 0; S.hold = (e.t === '...' ? 1.0 : 0.9 + e.t.length * 0.010); state.line = S.ci;
    }
    function advance() {
      if (!S.active || S.phase !== 'codec' || S.cs !== 'line' || !S.line) return;
      if (S.typed < S.line.t.length) { S.typed = S.line.t.length; S.ct = 0; }
      else codecNext();
    }
    function codecUpdate(dt) {
      S.ct += dt;
      var cs = S.cs;
      if (cs === 'ring') { S.armUp = Math.min(1, S.armUp + dt * 2.5); poseSeat(sm(S.armUp)); if (S.ct > 2.3) { S.cs = 'open'; S.ct = 0; snd.open(); } return; }
      if (cs === 'open') { if (S.ct > 0.42) codecNext(); return; }
      if (cs === 'tune') { if (S.ct > 0.55) { S.caller = S.tuneTo; S.shownFreq = WHO[S.tuneTo].freq; codecNext(); } return; }
      if (cs === 'close') {
        if (S.ct > 0.45) {
          var nx = SCRIPT[S.ci + 1];
          if (nx && nx.ring) { S.cs = 'gap'; S.ct = 0; }
          else codecNext();
        }
        return;
      }
      if (cs === 'gap') { S.armUp = Math.max(0, S.armUp - dt * 1.6); poseSeat(sm(S.armUp)); if (S.ct > 2.8) codecNext(); return; }
      if (cs === 'line') {
        var L = S.line, n = L.t.length, prev = Math.floor(S.typed);
        if (S.typed < n) {
          S.typed = Math.min(n, S.typed + dt / CHAR);
          var now = Math.floor(S.typed);
          if (now > prev && api.speak) { var ch = L.t.charAt(now - 1); if ((now & 1) === 0 || /[AEIOU]/.test(ch)) try { api.speak(WHO[L.who].voice, ch); } catch (e) {} }
          if (S.typed >= n) S.ct = 0;
        } else if (S.ct > S.hold) codecNext();
      }
    }
    function codecDraw() {
      var cs = S.cs, k = 1;
      if (cs === 'ring' || cs === 'gap') { renderPlane(); g.clearRect(0, 0, VW, VH); bars(1); if (cs === 'ring' && Math.floor(S.ct * 4) % 2 === 0) { textO(g, 'CALL', VW / 2, VH - 19, 8, PAL[4], '#000', 'center'); } return; }
      if (cs === 'open') k = sm(S.ct / 0.42);
      if (cs === 'close') k = 1 - sm(S.ct / 0.45);
      var x = cg, W = VW, H = VH, m = 12, py = 22, lx = m + 4, rx = W - m - 4 - 64, i;
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      var talking = cs === 'line' && S.line && S.typed < S.line.t.length;
      var who = cs === 'line' && S.line ? S.line.who : '';
      x.strokeStyle = PAL[2]; x.lineWidth = 1;
      x.strokeRect(lx - 3.5, py - 3.5, 71, 87); x.strokeRect(rx - 3.5, py - 3.5, 71, 87);
      portrait(x, 'snake', lx, py, talking && who === 'snake' && Math.floor(S.typed / 2) % 2 === 0, who !== 'snake' && who !== '');
      if (cs === 'tune') staticNoise(x, rx, py, 64, 80);
      else portrait(x, S.caller, rx, py, talking && who === S.caller && Math.floor(S.typed / 2) % 2 === 0, who === 'snake');
      // the middle: PTT, the frequency, the meter
      var cx = W / 2, fq = S.shownFreq;
      if (cs === 'tune') { fq = (100 + Math.floor(Math.random() * 60)) + '.' + (10 + Math.floor(Math.random() * 89)); }
      text(x, 'PTT', cx, py + 2, 8, PAL[2], 'center');
      text(x, fq, cx, py + 20, 16, PAL[4], 'center');
      var ar = W < 384 ? 54 : 62; x.fillStyle = PAL[3]; for (i = 0; i < 4; i++) { x.fillRect(cx - ar + i, py + 24 - i, 1, 1 + i * 2); x.fillRect(cx + ar - 1 - i, py + 24 - i, 1, 1 + i * 2); }
      var lvl = talking ? 3 + Math.floor(Math.random() * 7) : (cs === 'line' ? 2 : 0);
      for (i = 0; i < 10; i++) { x.fillStyle = i < lvl ? PAL[i > 7 ? 4 : 3] : PAL[1]; x.fillRect(cx - 40 + i * 8, py + 62 - i * 2, 6, 4 + i * 2); }
      text(x, 'MEMORY', cx, py + 70, 8, PAL[2], 'center');
      x.fillStyle = PAL[2]; x.fillRect(m, 118, W - m * 2, 1);
      // the line
      if (cs === 'line' && S.line) {
        var L = S.line, shown = L.t.slice(0, Math.floor(S.typed)), big = !!L.big, size = big ? 16 : 8, cols = Math.floor((W - m * 2 - 8) / size);
        text(x, WHO[L.who].name, m + 2, 124, 8, PAL[3]);
        var lines = wrapLines(L.t, cols), y = big ? 146 : 140, used = 0;
        for (i = 0; i < lines.length && used < shown.length; i++) {
          var part = lines[i].slice(0, Math.max(0, shown.length - used));
          text(x, part, m + 4, y + i * (size + 4), size, '#c6ffd9');
          used += lines[i].length + 1;
        }
        if (!talking && Math.floor(S.ct * 3) % 2 === 0) { x.fillStyle = PAL[4]; var ty = H - 12; x.fillRect(W - m - 10, ty, 7, 1); x.fillRect(W - m - 9, ty + 1, 5, 1); x.fillRect(W - m - 8, ty + 2, 3, 1); x.fillRect(W - m - 7, ty + 3, 1, 1); }
      }
      for (i = 0; i < H; i += 2) { x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(0, i, W, 1); }
      g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH);
      var hh = Math.max(1, Math.round(VH * k));
      g.drawImage(cc, 0, 0, VW, VH, 0, Math.round((VH - hh) / 2), VW, hh);
    }

    function enterRamp() {
      S.green = true; S.rampT = 0; cut('ramp');
      try { R3.light.material.color.setHex(0x20ff40); R3.light.material.emissive.setHex(0x20ff40); } catch (e) {}
      snd.buzzer(); snd.hydraulic();
      S.wind = windLoop(); if (S.wind) S.wind.set(0.02, 0.5);
      BOND.end = false; BOND.endStep = -1;
      if (registerScore() && api.music) try { api.music('mgsbond'); } catch (e) {}
      S.sub = RAMP_SUB; S.subT = -2.4;
    }
    function rampUpdate(dt) {
      var t = S.pt, p = api.player, u;
      u = sm((t - 0.2) / 3.0);
      R3.ramp.rotation.x = lerp(-Math.PI / 2, 0.1, u);
      R3.day.intensity = 1.5 * u; R3.hemi.color.setHex(0xff5040).lerp(tmpV || (tmpV = new T.Color(0xd8e4ff)), u * 0.7);
      if (S.wind) S.wind.set(0.02 + 0.09 * u, 0.3);
      if (S.engine) S.engine.set(0.07 + 0.04 * u, 0.3);
      if (t < 1.6) {                                                                    // he stands
        var k = sm((t - 0.7) / 0.7); S.armUp = Math.max(0, S.armUp - dt * 2);
        var L = limbs(); setLimb(L[0], lerp(-0.45, 0, k), 0); setLimb(L[1], lerp(-0.45, 0, k), 0); if (L[0]) L[0].scale.y = O.limbSy[0]; setLimb(L[2], lerp(-1.2, 0, k), 0); setLimb(L[3], lerp(-1.2, 0, k), 0);
        p.position.set(lerp(-2.05, -1.65, k), lerp(0.09, 0, k), 8.2);
        p.rotation.y = lerp(Math.PI / 2, 0.25, k);
      } else if (t < 4.4) {                                                             // he walks to the edge
        u = clamp((t - 1.6) / 2.8, 0, 1);
        var px = lerp(-1.65, 0, u), pz = lerp(8.2, 12.6, u), y = pz > 10.6 ? -(pz - 10.6) * 0.1 : 0;
        p.position.set(px, y, pz); p.rotation.y = Math.atan2(0 - -1.65, 12.6 - 8.2) * (1 - sm((u - 0.7) / 0.3));
        S.walkT = (S.walkT || 0) + dt * 7; if (api.pose) try { api.pose(p, { walk: S.walkT, speed: 0.55 }); } catch (e) {}
        hatsTick(dt, { speed: 5, air: false, vy: 0, yaw: p.rotation.y, moving: true, t: S.t, box: false });
      } else {                                                                          // and goes
        if (!S.dove) { S.dove = true; S.dz = p.position.z; S.dy = p.position.y; }
        var d = t - 4.4;
        p.position.set(0, S.dy + 1.6 * d - 4.9 * d * d, S.dz + 3.6 * d);
        p.rotation.x = lerp(0, Math.PI / 2, sm(d / 0.8)); p.rotation.y = 0;
        poseSky(S.t, sm(d / 0.6));
        hatsTick(dt, { speed: 9, air: true, vy: -10, yaw: 0, moving: true, t: S.t, box: false });
        if (d > 0.35 && !S.diveSub) { S.diveSub = true; S.sub = FALL_SUB; S.subT = 0; }
      }
      if (t >= D_RAMP) { go('fall'); enterFall(); }
    }

    function enterFall() {
      var p = api.player, sc = api.scene, cam = api.camera;
      if (S.engine) { S.engine.stop(0.4); S.engine = null; }
      sc.add(F3.root); sc.add(p);
      S.fx = O.spawnX - 24; S.fz = O.spawnZ + 34;
      p.position.set(S.fx, Y_TOP, S.fz); p.rotation.set(Math.PI / 2, 0.6, 0);
      sc.fog.near = 420; sc.fog.far = 1700; cam.far = 2200; cam.updateProjectionMatrix();
      if (S.wind) S.wind.set(0.13, 0.6);
      cut('A');
    }
    function fallPos(t) {                             // where he is at t seconds into the fall
      var u = t / D_FALL;
      return { x: lerp(O.spawnX - 24, O.spawnX - 8, u), y: lerp(Y_TOP, Y_CHUTE, u), z: lerp(O.spawnZ + 34, O.spawnZ + 11, u) };
    }
    function fallUpdate(dt) {
      var t = S.pt, p = api.player, cam = api.camera, q = fallPos(t), k;
      p.position.set(q.x, q.y + Math.sin(S.t * 1.3) * 0.15, q.z);
      p.rotation.x = Math.PI / 2 + Math.sin(S.t * 0.9) * 0.08; p.rotation.y = 0.6 + Math.sin(S.t * 0.37) * 0.35; p.rotation.z = Math.sin(S.t * 0.6) * 0.06;
      poseSky(S.t, 1);
      hatsTick(dt, { speed: 9, air: true, vy: -40, yaw: p.rotation.y, moving: true, t: S.t, box: false });
      for (k = 0; k < F3.streaks.length; k++) {                                         // the air going past
        var s = F3.streaks[k], ud = s.userData; ud.y += dt * 70; if (ud.y > 26) ud.y -= 52;
        s.position.set(q.x + Math.cos(ud.a) * ud.r, q.y + ud.y, q.z + Math.sin(ud.a) * ud.r); s.visible = true;
      }
      for (k = 0; k < F3.deck.length; k++) F3.deck[k].position.x += dt * 1.5;
      // the shots: above and behind, beside him, below him against the sky, then straight down at the town
      var sh = t < 8 ? 'A' : t < 15 ? 'B' : t < 22 ? 'C' : 'D';
      if (sh !== S.shot) cut(sh);
      S.shotT += dt; var st = S.shotT, a;
      cam.up.set(0, 1, 0);
      if (sh === 'A') { a = 0.9 + st * 0.05; cam.position.set(q.x + Math.sin(a) * 7, q.y + 11, q.z + Math.cos(a) * 7); cam.lookAt(q.x - Math.sin(a) * 6, q.y - 30, q.z - Math.cos(a) * 6); }
      else if (sh === 'B') { a = 2.2 + st * 0.12; cam.position.set(q.x + Math.cos(a) * 6.5, q.y + 1.2, q.z + Math.sin(a) * 6.5); cam.lookAt(q.x, q.y - 1.5, q.z); }
      else if (sh === 'C') { a = st * 0.1; cam.position.set(q.x + 3 + Math.sin(a), q.y - 9, q.z + 2.5); cam.lookAt(q.x + 1.2, q.y - 3.2, q.z + 1); }
      else { cam.position.set(q.x, q.y + 14 - st * 0.35, q.z - 1.5); cam.up.set(0, 0, -1); cam.lookAt(q.x, q.y - 60, q.z + 16); }
      if (t >= D_FALL) { go('chute'); enterChute(); }
    }

    function enterChute() {
      var p = api.player;
      F3.chute.scale.set(0.15, 0.15, 0.15); p.add(F3.chute);
      F3.streaks.forEach(function (s) { s.visible = false; });
      snd.whump(); BOND.end = true;
      if (S.wind) S.wind.set(0.05, 1.2);
      var q = fallPos(D_FALL); S.c0x = q.x - O.spawnX; S.c0z = q.z - O.spawnZ; S.cR = Math.sqrt(S.c0x * S.c0x + S.c0z * S.c0z); S.cA = Math.atan2(S.c0z, S.c0x);
      api.camera.up.set(0, 1, 0);
      cut('chase');
    }
    function chutePos(t) {
      var u = clamp(t / D_CHUTE, 0, 1), r = S.cR * Math.pow(1 - u, 1.35), a = S.cA + 3.2 * u;
      return { x: O.spawnX + Math.cos(a) * r, y: Y_CHUTE * (1 - u) * (1 - 0.45 * u), z: O.spawnZ + Math.sin(a) * r, a: a, u: u };
    }
    function chuteUpdate(dt) {
      var t = S.pt, p = api.player, cam = api.camera, sc = api.scene, q = chutePos(t), k = sm(t / 0.5), j = sm(t / 0.8);
      F3.chute.scale.set(lerp(0.15, 1, k), lerp(0.15, 1, k), lerp(0.15, 1, k));
      p.position.set(q.x, q.y, q.z);
      var head = Math.atan2(-Math.cos(q.a), -Math.sin(q.a));                             // facing in, the way the spiral carries him
      var yaw = O.yaw + Math.atan2(Math.sin(head - O.yaw), Math.cos(head - O.yaw)) * (1 - sm((q.u - 0.75) / 0.25));
      p.rotation.x = lerp(Math.PI / 2, 0, j) + (t > 0.8 ? Math.sin(S.t * 1.6) * 0.05 * (1 - q.u) : 0); p.rotation.z = Math.sin(S.t * 1.1) * 0.06 * (1 - q.u); p.rotation.y = yaw;
      F3.canopy.rotation.z = Math.sin(S.t * 1.3) * 0.06;
      poseChute(S.t, j);
      hatsTick(dt, { speed: 3, air: true, vy: -3, yaw: yaw, moving: true, t: S.t, box: false });
      // the town's own fog comes back as he comes down
      var fu = sm((Y_CHUTE - q.y) / Y_CHUTE * 1.4);
      sc.fog.near = lerp(420, O.fogNear, fu); sc.fog.far = lerp(1700, O.fogFar, fu);
      // the camera: a chase behind him, then a low shot at the spawn as he flares and lands
      var bx2 = q.x - Math.sin(yaw) * 9, bz2 = q.z - Math.cos(yaw) * 9, by2 = q.y + 3.5;
      var lu = sm((t - (D_CHUTE - 4)) / 3.2), gx = O.spawnX + 6.5, gy = 1.4, gz = O.spawnZ + 8.5;
      cam.position.set(lerp(bx2, gx, lu), lerp(by2, gy, lu), lerp(bz2, gz, lu));
      cam.lookAt(q.x, q.y + lerp(2.6, 2.0, lu), q.z);
      if (t < 0.6) { cam.position.x += (Math.random() - 0.5) * 0.5; cam.position.y += (Math.random() - 0.5) * 0.5; }
      if (t >= D_CHUTE) { go('land'); enterLand(); }
    }

    function enterLand() {
      var p = api.player;
      p.position.set(O.spawnX, 0, O.spawnZ); p.rotation.set(0, O.yaw, 0);
      snd.thud(); if (S.wind) { S.wind.stop(1.2); S.wind = null; }
      for (var k = 0; k < F3.dust.length; k++) { var d = F3.dust[k], a = k / F3.dust.length * 6.283; d.visible = true; d.position.set(O.spawnX + Math.cos(a) * 0.5, 0.2, O.spawnZ + Math.sin(a) * 0.5); d.userData.a = a; }
      S.camFrom = api.camera.position.clone();
      S.sub = { who: 'snake', t: 'Kept you waiting, huh?' }; S.subT = -1.4;
    }
    function landUpdate(dt) {
      var t = S.pt, p = api.player, cam = api.camera, k, d;
      // the crouch, then up; the canopy folds away behind him
      var c = t < 0.15 ? sm(t / 0.15) : t < 1.5 ? 1 : 1 - sm((t - 1.5) / 0.6);
      poseCrouch(c); p.scale.set(1 + 0.04 * c, 1 - 0.12 * c, 1 + 0.04 * c);
      k = sm(t / 1.2);
      F3.chute.rotation.x = -1.55 * k; F3.chute.position.y = lerp(2.2, 0.4, k); F3.chute.position.z = lerp(0, -1.2, k);
      var s2 = t < 1.2 ? 1 : 1 - sm((t - 1.2) / 0.5); F3.chute.scale.set(s2 || 0.001, Math.max(0.001, s2 * (1 - 0.8 * k)), s2 || 0.001);
      if (F3.pack.parent && t > 1.6) F3.pack.parent.remove(F3.pack);
      for (k = 0; k < F3.dust.length; k++) {
        d = F3.dust[k]; var u = clamp(t / 0.9, 0, 1);
        d.visible = u < 1; var rr2 = 0.6 + u * (1.6 + (k % 3) * 0.6); d.position.set(O.spawnX + Math.cos(d.userData.a) * rr2, 0.15 + Math.sin(u * 3.1) * (0.4 + (k % 2) * 0.4), O.spawnZ + Math.sin(d.userData.a) * rr2);
        var sc2 = 0.22 * (1 + u * 1.5); d.scale.set(sc2, sc2, sc2); d.rotation.set(u * 3 + k, u * 2, 0);
      }
      F3.dustMat.opacity = 0.8 * (1 - clamp(t / 0.9, 0, 1));
      hatsTick(dt, { speed: 0, air: false, vy: 0, yaw: O.yaw, moving: true, t: S.t, box: false });
      // the camera cranes up from the low shot into the host's third-person orbit
      var ob = orbitPose(), u2 = sm((t - 0.6) / 3.0);
      cam.position.set(lerp(S.camFrom.x, ob.x, u2), lerp(S.camFrom.y, ob.y, u2), lerp(S.camFrom.z, ob.z, u2));
      cam.lookAt(lerp(O.spawnX, ob.lx, u2), lerp(2.0, ob.ly, u2), lerp(O.spawnZ, ob.lz, u2));
      if (t >= D_LAND) finish(false);
    }
    function orbitPose() {
      var ob = null;
      if (O.orbit) try { ob = O.orbit(); } catch (e) { ob = null; }
      if (!ob || !isFinite(ob.x) || !isFinite(ob.y) || !isFinite(ob.z)) ob = { x: O.spawnX, y: 8.45, z: O.spawnZ + 12.2, lx: O.spawnX, ly: 1.6, lz: O.spawnZ };
      return ob;
    }

    /* -------------------------------------------------------------- 2D layers per phase */
    function drawTitle() {
      var t = S.pt, a, s;
      g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH);
      if (t > 1.2 && t < 5.6) {
        s = typed('TACTICAL ESPIONAGE ACTION', 1.2, t, 0.085);
        if (s.length !== (S.lastTyped || 0)) { S.lastTyped = s.length; if (s.length && s.charAt(s.length - 1) !== ' ') snd.tick(); }
        g.globalAlpha = t > 4.7 ? clamp(1 - (t - 4.7) / 0.8, 0, 1) : 1;
        text(g, s, VW / 2 - 25 * 4, VH / 2 - 4, 8, '#c9d6c0');
        g.globalAlpha = 1;
      }
      if (t > 5.6) {
        if (!S.boomed) { S.boomed = true; snd.boom(); }
        a = t > 10.0 ? clamp(1 - (t - 10.0) / 0.9, 0, 1) : 1;
        g.globalAlpha = a;
        var k = sm((t - 5.6) / 0.22), sc = 1 + (1 - k) * 0.7, cy = VH / 2 - 44;
        logo('METAL GEAR', VW / 2, cy, 24 * sc, '#d9dee8');
        if (t > 6.15) {
          if (!S.slam) { S.slam = true; snd.slam(); }
          var k2 = sm((t - 6.15) / 0.2), sc2 = 1 + (1 - k2) * 0.7;
          logo('PALMER', VW / 2 - 20, cy + 30, 24 * sc2, '#d9dee8');
          textO(g, '3', VW / 2 + 72 + 8, cy + 26, 32, '#e0302a', '#2a0606', 'center');
        }
        if (t > 7.0) textO(g, typed('PEER EATER', 7.0, t, 0.09), VW / 2 - 80, cy + 72, 16, '#e8d27a', '#3a2a06');
        if (t > 8.6) { g.globalAlpha = a * clamp((t - 8.6) / 0.6, 0, 1); text(g, 'BASED ON A TRUE GRANT APPLICATION', VW / 2, VH - 30, 8, '#7f8a7a', 'center'); }
        g.globalAlpha = 1;
      }
    }
    function logo(s, cx, cy, size, col) {             // steel letters with a dark outline and a band of horizontal stripes
      size = Math.round(size / 8) * 8; if (size < 8) size = 8;
      var w = s.length * size + 8, h = size + 8, x = cg;
      if (cc.width < w || cc.height < h) return textO(g, s, cx, cy, size, col, '#1a1d26', 'center');
      x.clearRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
      textO(x, s, 4, 4, size, col, '#14171f');
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = 'rgba(70,80,100,0.55)'; for (var y = 4 + Math.round(size * 0.55); y < h; y += 3) x.fillRect(0, y, w, 1);
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, 4 + Math.round(size * 0.12), w, Math.max(1, size >> 4));
      x.globalCompositeOperation = 'source-over';
      g.drawImage(cc, 0, 0, w, h, Math.round(cx - w / 2), Math.round(cy - 4), w, h);
    }
    function drawPlane2D() {
      var t = S.pt, bh;
      g.clearRect(0, 0, VW, VH); bh = bars(1);
      if (S.phase === 'plane') {
        text(g, typed('OPERATION VIRTUOUS SUBMISSION', 0.6, t, 0.05), 10, Math.round(bh / 2 - 4), 8, '#e8e8e8');
        if (t < 4.6) text(g, typed('OVER OXFORDSHIRE. 30,000 FT.', 1.4, t, 0.05), 10, VH - bh + Math.round(bh / 2 - 4), 8, '#c8c8c8');
        else text(g, typed('48 HOURS BEFORE THE DEADLINE.', 4.7, t, 0.05), 10, VH - bh + Math.round(bh / 2 - 4), 8, '#c8c8c8');
      }
    }
    function drawSub(bh) {                              // radio chatter in the bottom bar
      if (!S.sub || S.subT < 0) return;
      var L = S.sub, cols = Math.floor((VW - 20) / 8), s = L.t.slice(0, Math.floor(S.subT / 0.035));
      var nm = WHO[L.who].name + ': ';
      var all = wrapLines(nm + L.t, cols), used = 0, full = (nm + s), y0 = VH - Math.max(bh, 24) + 4;
      if (all.length > 2) { y0 = VH - 4 - all.length * 10; g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, y0 - 4, VW, VH - y0 + 4); }
      for (var i = 0; i < all.length && used < full.length; i++) { text(g, all[i].slice(0, full.length - used), 10, y0 + i * 10, 8, i === 0 && used === 0 ? '#8dffb6' : '#e8e8e8'); used += all[i].length + 1; }
    }
    function subTick(dt) {
      if (!S.sub) return;
      var prev = Math.floor(S.subT / 0.035); S.subT += dt; var now = Math.floor(S.subT / 0.035);
      if (S.subT >= 0 && now > prev && now <= S.sub.t.length && api.speak && (now & 1) === 0) try { api.speak(WHO[S.sub.who].voice, S.sub.t.charAt(now - 1)); } catch (e) {}
      if (S.subT > S.sub.t.length * 0.035 + 2.2) S.sub = null;
    }
    function drawFall2D() {
      var t = S.pt, bh, i;
      g.clearRect(0, 0, VW, VH);
      // the 60s title sequence: a wash of colour, a halftone ripple, the names
      for (i = 0; i < CREDITS.length; i++) {
        var a0 = 0.8 + i * 2.25, lt = t - a0; if (lt < 0 || lt > 2.15) continue;
        var al = Math.min(1, lt / 0.3, (2.15 - lt) / 0.35), col = BOND_COL[i % BOND_COL.length], L = CREDITS[i];
        g.globalAlpha = 0.16 * al; g.fillStyle = col; g.fillRect(0, 0, VW, VH);
        g.globalAlpha = 0.5 * al;
        var rr = 20 + lt * 70, cx = VW / 2, cy = Math.round(VH * 0.62), d, k;
        for (d = 0; d < 3; d++) { var r = rr - d * 26; if (r < 4) continue; var n = Math.floor(r / 3); for (k = 0; k < n; k++) { var an = k / n * 6.283 + d; g.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r * 0.7), 2, 2); } }
        g.globalAlpha = al;
        var tot = 0, sizes = [];
        for (k = 0; k < L.length; k++) { var sz = (k === 0 || L.length <= 2) && L[k].length * 16 <= VW - 24 ? 16 : 8; if (L.length > 3) sz = 8; sizes.push(sz); tot += sz + 8; }
        var y = Math.round(VH * 0.62 - tot / 2);
        for (k = 0; k < L.length; k++) {
          text(g, L[k], VW / 2 + 2, y + 2, sizes[k], col, 'center');
          textO(g, L[k], VW / 2, y, sizes[k], '#ffffff', '#111111', 'center');
          y += sizes[k] + 8;
        }
        g.globalAlpha = 1;
      }
      bh = bars(1);
      drawSub(bh);
    }
    function drawChute2D() { g.clearRect(0, 0, VW, VH); var bh = bars(1); drawSub(bh); }
    function drawLand2D() {
      g.clearRect(0, 0, VW, VH);
      var bh = bars(1 - sm((S.pt - 2.8) / 1.0));
      drawSub(Math.max(bh, 24));
    }

    /* -------------------------------------------------------------- skip */
    function skipLabel(sure) {
      var b = D.skip; if (!b) return;
      b.className = sure ? 'qmgs-skip is-sure' : 'qmgs-skip';
      b.innerHTML = sure ? '<span class="qmgs-l">ARE YOU SURE? THE MAJOR WORKED VERY HARD ON THIS.</span>' : '<span class="qmgs-l">PRESS START TO SKIP</span><span class="qmgs-s">SKIP &#9654;</span>';
    }
    function skipPress() {
      if (!S.active || S.t < 1) return;
      if (S.sure > 0) { finish(true); return; }
      S.sure = 4; S.sureW = Date.now(); skipLabel(true);
    }
    function skipTick() {                             // the question stands for four seconds of the wall clock (a UI question, not game time)
      if (D.skip && D.skip.hidden && S.t >= 1) D.skip.hidden = false;
      if (S.sure > 0 && Date.now() - S.sureW > 4000) { S.sure = 0; skipLabel(false); }
    }

    /* -------------------------------------------------------------- the frame */
    function step(dt) {                                // advance the current phase (a phase may hand over to the next)
      var ph = S.phase, idle = { speed: 0, air: false, vy: 0, yaw: api.player.rotation.y, moving: true, t: S.t, box: false };
      if (ph === 'title') { if (S.pt >= D_TITLE) { go('plane'); enterPlane(); } }
      else if (ph === 'plane') { if (S.pt > 6.0 && S.shot === 'dolly') cut('snake'); hatsTick(dt, idle); if (S.pt >= D_PLANE) { go('codec'); S.ci = -1; codecNext(); } }
      else if (ph === 'codec') { hatsTick(dt, idle); codecUpdate(dt); }
      else if (ph === 'ramp') rampUpdate(dt);
      else if (ph === 'fall') fallUpdate(dt);
      else if (ph === 'chute') chuteUpdate(dt);
      else if (ph === 'land') landUpdate(dt);
    }
    function draw(dt) {
      var ph = S.phase;
      if (ph === 'title') { drawTitle(); return; }
      if (ph === 'plane' || ph === 'codec' || ph === 'ramp') {
        planeWorld(dt); planeCam(dt);
        if (ph === 'codec') { codecDraw(); return; }
        renderPlane();
        if (ph === 'plane') drawPlane2D(); else { g.clearRect(0, 0, VW, VH); drawSub(bars(1)); }
        return;
      }
      api.renderer.render(api.scene, api.camera);
      if (ph === 'fall') drawFall2D(); else if (ph === 'chute') drawChute2D(); else drawLand2D();
    }
    function update(dt) {
      if (!S.active) return;
      try {
        dt = clamp(fin(dt), 0, 1);
        S.t += dt; S.pt += dt; state.t = S.t; state.pt = S.pt;
        fit(); skipTick(); subTick(dt);
        var ph = S.phase;
        step(dt);
        if (S.active && S.phase !== ph) step(0);       // the new phase sets its camera and pose before its first frame is drawn
        if (!S.active) return;
        state.sub = S.cs;
        draw(dt);
      } catch (e) { S.failed = true; try { if (window.console && console.warn) console.warn('QuestMGSIntro', e); } catch (e2) {} finish(true); }
    }

    /* -------------------------------------------------------------- start and finish */
    function play(opts) {
      if (S.active) return false;
      O = {};
      try {
        opts = opts || {};
        if (!T || !api.scene || !api.camera || !api.renderer || !api.view || !api.player) return false;
        O.onDone = typeof opts.onDone === 'function' ? opts.onDone : null;
        O.orbit = typeof opts.orbit === 'function' ? opts.orbit : null;
        O.hats = typeof opts.hats === 'function' ? opts.hats : null;
        O.skin = opts.skin || 'palmer';
        var p = api.player, sc = api.scene, cam = api.camera;
        O.limbSy = limbs().map(function (m) { return m ? m.scale.y : 1; });
        O.parent = p.parent || sc; O.spawnX = p.position.x; O.spawnZ = p.position.z; O.yaw = p.rotation.y; O.order = p.rotation.order;
        O.fogNear = sc.fog ? sc.fog.near : 55; O.fogFar = sc.fog ? sc.fog.far : 120; O.camFar = cam.far;
        S = { active: true, phase: '', pt: 0, t: 0, sure: 0, shot: '', shotT: 0, ci: -1, cs: '', ct: 0, caller: 'major', shownFreq: '140.85',
              line: null, typed: 0, spoke: 0, hold: 0, armUp: 0, sub: null, subT: 0, skipped: false, failed: false };
        state.phase = ''; state.t = 0; state.line = -1; state.skipped = false; state.total = 0; state.done = false; state.failed = false;
        BOX = keep(new T.BoxGeometry(1, 1, 1));
        overlayBuild(); fit();
        sfxInit();
        planeBuild(); fallBuild();
        try { if (api.setHud) api.setHud(false); } catch (e) {}
        try { if (api.music) api.music('silence'); } catch (e) {}
        registerScore();
        go('title');
        return true;
      } catch (e) {
        try { if (window.console && console.warn) console.warn('QuestMGSIntro', e); } catch (e2) {}
        O.onDone = null; S.active = true; finish(true, true);
        return false;
      }
    }
    function finish(skipped, quiet) {
      if (!S.active) return;
      S.active = false; S.skipped = !!skipped;
      state.total = S.t; state.skipped = !!skipped; state.done = true; state.failed = !!S.failed; state.phase = 'done';
      var p = api.player, sc = api.scene, cam = api.camera, k;
      try { BOND.end = true; } catch (e) {}
      try { if (S.engine) S.engine.stop(0.2); if (S.wind) S.wind.stop(0.3); } catch (e) {}
      try { sfxStop(); } catch (e) {}
      try {                                           // the man: back in the town, on his spawn, standing, as he was
        if (p && O.parent) {
          if (F3) { if (F3.pack && F3.pack.parent) F3.pack.parent.remove(F3.pack); if (F3.chute && F3.chute.parent) F3.chute.parent.remove(F3.chute); }
          if (p.parent !== (O.parent || sc)) (O.parent || sc).add(p);
          p.rotation.order = O.order || 'XYZ'; p.rotation.set(0, isFinite(O.yaw) ? O.yaw : 0, 0); p.scale.set(1, 1, 1);
          p.position.set(fin(O.spawnX), 0, fin(O.spawnZ)); p.visible = true;
          limbs().forEach(function (m, i) { if (m) { m.rotation.x = 0; m.rotation.z = 0; m.scale.y = O.limbSy ? O.limbSy[i] : 1; } });
          hatsTick(0, { speed: 0, air: false, vy: 0, yaw: p.rotation.y, moving: true, t: S.t, box: false });
        }
      } catch (e) {}
      try { if (F3 && F3.root.parent) F3.root.parent.remove(F3.root); } catch (e) {}
      try {
        if (sc && sc.fog) { sc.fog.near = O.fogNear; sc.fog.far = O.fogFar; }
        if (cam && O.parent) {
          cam.far = O.camFar || 300; cam.up.set(0, 1, 0); cam.updateProjectionMatrix();
          var ob = orbitPose(); cam.position.set(ob.x, ob.y, ob.z); cam.lookAt(ob.lx, ob.ly, ob.lz);
        }
      } catch (e) {}
      try { window.removeEventListener('keydown', onKeyRef, true); } catch (e) {}
      try { if (D.wrap) { D.wrap.removeEventListener('pointerdown', D.onDown); D.wrap.removeEventListener('pointerup', D.onPtr); D.wrap.removeEventListener('pointercancel', D.onCancel); if (D.wrap.parentNode) D.wrap.parentNode.removeChild(D.wrap); } } catch (e) {}
      try { if (api.root && api.root.classList) api.root.classList.remove('is-mgs'); } catch (e) {}
      try { if (D.style && D.style.parentNode) D.style.parentNode.removeChild(D.style); } catch (e) {}
      try { for (k = 0; k < LIST.length; k++) if (LIST[k] && LIST[k].dispose) LIST[k].dispose(); } catch (e) {}
      LIST = []; MATS = {}; BOX = null; R3 = null; F3 = null; D = {}; g = null; cc = null; cg = null;
      try { if (api.setHud) api.setHud(true); } catch (e) {}
      var cb = O.onDone; O.onDone = null;
      if (cb) try { cb({ skipped: !!skipped }); } catch (e) {}
    }

    var self = {
      play: function (opts) { try { return play(opts); } catch (e) { return false; } },
      update: function (dt) { try { update(dt); } catch (e) {} },
      skip: function () { try { finish(true); } catch (e) {} },
      get active() { return !!S.active; }
    };
    return self;
  };
  window.QuestMGSIntro.state = {};
})();
