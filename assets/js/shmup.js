/* =============================================================================
   SHMUP.JS — "PUBLISH OR PERISH", the space stage of Palmer's Progress.
   After the boss falls the accepted manuscript is flown through the publication
   pipeline as a vertical bullet-hell shooter: DoDonPachi (tap = spread SHOT,
   hold = LASER + slow ship, HIT chain, bullet-cancel medals) crossed with
   Truxton (three colour weapons, P/S/B pickups, the skull bomb).
   2D canvas, everything procedural, fixed pools, no allocation in the hot loops.
   The first ending, PUBLISHED!, offers > SECOND LOOP (api.startLoop2(): the host reloads into Master Quest).
   THE SECOND LOOP (start({loop: 2}), DoDonPachi DaiOuJou's ura mode): the same stages with suicide bullets, faster and
   denser fire, a RANK that climbs with the chain and falls with a death, doubled scores, both bosses with an extra
   layer and new taunts, and after THE IMPACT FACTOR a WARNING and the True Last Boss, PEER REVIEW (a Hibachi homage in
   five phases: washing machine, needle streams, whip lasers, rank curtain, everything; it is its own continue checkpoint),
   then the true ending, TENURED!, whose PLAY AGAIN goes back to loop 1 (api.restart()).
   Sound: every effect is written for and rendered on a model of the Mega Drive's YM2612 in this file (the audio section says how); the music is riff.js / riff2.js.
   Test hooks: ?shmupstage=2|mid|boss|tlb|ending  ?shmupgod=1 (counts the deaths it spares)
   ?shmupdbg=1 (window.__qs: info(), bot(on), phase(n), pos(x, y), give(kind, colour), rank(0..1), sim(seconds), reset(), and __qs.sfx: names(), spec(name),
   render(name, rate, parts, raw), ym(score, seconds, lfo), play(name, rate), bus(ctx), log(), stats(), reset())  (and the host's ?shmup=1 ?loop=2 ?timescale=N)
   ============================================================================= */
(function () {
  'use strict';
  window.QuestShmup = function (api) {
    var self = { start: start, stop: stop, active: false };
    var W = 360, H = 480, TAU = Math.PI * 2, FONT = '"Press Start 2P", monospace';
    function qp(n, d) { var m = location.search.match(new RegExp('[?&]' + n + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : d; }
    var GOD = qp('shmupgod') === '1', JUMP = qp('shmupstage', ''), DBG = qp('shmupdbg') === '1', botOn = false;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

    /* ------------------------------------------------------------ audio: the effects on a Yamaha YM2612, rendered once
       Written the way a Sega sound designer wrote effects for SMPS or GEMS around 1990 (Compile's M.U.S.H.A. Aleste is the
       model) and played on a model of the Mega Drive's FM chip, in plain JS. Nothing is sampled. The music is riff.js's.
       THE CHIP, from the documented behaviour (Yamaha's OPN manuals, Nemesis's YM2612 measurements): a channel is four
       operators wired in one of the eight algorithms, operator 1 fed back into itself (the average of its last two outputs;
       levels 1-7 = pi/16 .. 4pi). An operator is a 20-bit phase counter stepped by ((F-number << block) >> 1 + DT1) x MUL
       (MUL 0 = 1/2); its top 10 bits read a quarter-wave log-sine table, its envelope attenuation (10 bits of 0.09375 dB,
       plus TL x 0.75 dB and the LFO's tremolo) is added in the log domain, and an exp table turns the sum into a 13-bit
       magnitude with a sign. A modulator's output, halved, is added to the next operator's 10-bit phase. The envelope steps
       every third sample on a global counter: rate = 2R + (keycode >> (3 - KS)) (release 4RR + 2 + the same), capped at 63,
       with the documented counter shift and eight-step increment pattern per rate; the attack is attenuation +=
       (~attenuation x increment) >> 4 (rates 62-63 jump), decay and release are linear, SL 1-14 = 3 dB a step, 15 = 93 dB.
       The LFO (3.8-69 Hz) drives vibrato (PMS) and tremolo (AMS); channel 3's special mode gives each operator a frequency.
       The output rate is 7.67 MHz / 144 = 53,267 Hz with nothing interpolated, so a bright patch aliases as the chip does.
       A channel's carriers are summed, clipped to 14 bits and cut to 9 for the DAC, which has the Model 1's ladder effect:
       the step between -1 and 0 is eight times the others (+4 at or above zero, -3 below), crossover distortion that grits
       every quiet tail. Channel 6 may instead be the DAC: an 8-bit sample (synthesised here) written at 8 kHz (drivers used
       8-13 kHz) and held. The SN76489's noise channel (16-bit LFSR, taps 0 and 3, volume in 2 dB steps a frame) seasons a few
       effects. The Model 1's analogue stage is a first-order low-pass at about 3.4 kHz; after it the sum is brought to the
       AudioContext's rate by linear interpolation (the chip's own aliasing is in the 53,267 Hz stream and stays; a zero-order
       hold would fold images of its own, at 53,267 Hz ± f, into the band), then a DC trap and the level.
       THE DRIVER: an effect is a score of tracks, one per channel, stepped at 60 Hz as SMPS steps them: notes with lengths in
       frames (a new note re-keys, note fill keys off early, a tie does not re-key), the volume as TL on the carriers, SMPS
       modulation (after `wait` frames, every `speed` frames add `change` to the F-number, `steps` times, then reverse) for the
       zippering sweeps, and per-frame pitch and volume tables for the lasers' growl (their periods divide 30 frames).
       Effects are rendered once into AudioBuffers by a queue, the likeliest-needed first: 30 ms of it when the shooter
       starts (under the white flash), then in the browser's idle time (2-10 ms an idle period; without idle callbacks,
       as in Safari, 3 ms after each frame). A channel renders in slices of about CH samples (the DAC synthesises its
       sample a block ahead of what it writes) and the queue stops between slices when its time is up, so a budget
       overruns by one slice at most. Nothing renders inside a keypress: a sound wanted before it is ready jumps the
       queue, the queue gets 10 ms a frame until it is done, and the sound plays then if that is within a quarter of a
       second (a drone starts the first step it is ready). Sounds play as BufferSources, a random variant (never the
       same one twice running; the medal's variant is its rung) with a little random detune (their own PRNG: the game's
       Math.random sequence is untouched), through a fixed pool of NV voices (the cap: a full pool steals its least
       important voice, or drops the new sound) → one bus → a limiter and a soft ceiling → the host's AudioContext. Two
       drones sit beside the pool, each engagement on a gain of its own: the player's held laser and the True Last
       Boss's lethal beams. The simulation keeps them alive: a step without them fades them out, and a gain watchdog
       silences them if the frames stop coming. A drone's loop is about 0.5 s, cut within one period of its lowest tone
       where the waves meet in phase; anything with a rhythm of its own, like the blue beam's arcs, is a one-shot.
       THE MIX: the music leads (the mix meter in .dev/tmp/mixmeter: K-weighted 400 ms windows of each stream as heard):
       in the median window the sustained effects sit 14.5 dB under the space score in loop 1, 10 under space2 and 12
       under the True Last Boss's score. The held fire is lowest: each shot colour about 25 dB under the score, each
       laser drone 21-23; the hit confirmations above them, most of their loudness in 1.5-5 kHz so they are heard in
       that band; kills and explosions under the music; the one-off events at or under its level (the klaxon and a
       boss's break within 2 dB of it, a bomb 4-5 dB and a boss's death 6-7 dB under). Each sound's `pk` is its level,
       because the bus is linear up to its last stage: a -6 dB trim ahead of the limiter keeps every single sound under
       its threshold, and the soft ceiling after it (linear to 0.35, never above 0.42) only shaves the peaks of the
       loudest (the second loop's hit, a bomb, a boss's death) and of pile-ups, for under 0.1 dB of loudness, so a score
       peak has room. The second loop's scores (space2, tlb) are 8-9 dB brighter in that band than loop 1's, so the hits
       there play louder (`l2`): the bank holds a louder copy of each of their variants for the second loop, a copy
       rather than a gain so that the logged variant is what was heard. Even so, about 30% of a loop-2 boss's hits
       (hitHard) fall more than 6 dB under the tlb score's brightest passage in that band: a boss's hits fill most of a
       fight's windows, so their level is the fight's level, and louder puts the music behind them again (3.5 dB louder
       leaves 8% under and takes 2.7 dB off the music's lead). Music and effects play on separate contexts, so an effect
       landing on a score peak can still sum past 1.0 for a sample. */
    var SR = 48000, rr = null, pr0 = rng(0x51f15e), FXN = [], FXI = {}, BANK = {}, bankSR = 0, renderMs = 0, XF = 0.04, CH = 1024;
    var AC = null, bus = null, busOut = null, VOX = [], NV = 16, loopG = null, loopS = null, loopName = '', loopT = -9, loopKick = 0, arcT = 0, stepN = 0, humN = 0, gates = {}, medalN = 0, medalT = -9, LASTV = null;
    var beamG = null, beamS = null, beamN = 0, beamLv = 0, beamKick = 0, WQ = [], CTX = {}, WANT = {}, nWant = 0, PEND = {};
    var vMax = 0, drops = 0, steals = 0, misses = 0, lateMax = 0, overMax = 0, NLOG = 40000, LOGT = DBG ? new Float32Array(NLOG) : null, LOGN = DBG ? new Uint8Array(NLOG) : null, LOGR = DBG ? new Float32Array(NLOG) : null, LOGK = DBG ? new Uint8Array(NLOG) : null, logN = 0;
    function rng(seed) {                                                  // mulberry32; its state lives in a typed array so a call allocates nothing
      var st = new Int32Array(1); st[0] = seed;
      return function () { var s = st[0] = st[0] + 0x6D2B79F5 | 0, t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }
    function hash(s) { for (var h = 2166136261, i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h; }
    /* the chip's tables. FS: the output rate; FR: samples a 60 Hz driver frame; M1: the Model 1's output low-pass (Hz) */
    var FS = 7670453 / 144, FR = FS / 60, M1 = 3400, PSGA = 64;
    var LSIN = new Uint16Array(256), EXPT = new Uint16Array(256), EGI = new Uint8Array(512), EGSH = new Uint8Array(64), DTT = new Uint8Array(96);
    var LFON = [109, 78, 72, 68, 63, 45, 9, 6], PMSC = [0, 3.4, 6.7, 10, 14, 20, 40, 80], AMSH = [8, 3, 1, 0];   // LFO: samples a step (128 steps a cycle); PMS: cents; AMS: shift of the 0-126 tremolo
    var ALGM = [[0, 1, 2, 4], [0, 0, 3, 4], [0, 0, 2, 5], [0, 1, 0, 6], [0, 1, 0, 4], [0, 1, 1, 1], [0, 1, 0, 0], [0, 0, 0, 0]], ALGC = [8, 8, 8, 8, 10, 14, 14, 15];   // per algorithm: which operators modulate operators 2-4 (bit 0 = op 1), and the carriers
    (function () {
      var i, r, k, lo = ['01010101', '01011101', '01110111', '01111111'], hi = ['11111111', '11121112', '12121212', '12221222'];
      for (i = 0; i < 256; i++) { LSIN[i] = Math.round(-Math.log(Math.sin((i + 0.5) / 256 * Math.PI / 2)) / Math.LN2 * 256); EXPT[i] = Math.round((Math.pow(2, i / 256) - 1) * 1024); }
      for (r = 0; r < 64; r++) { EGSH[r] = r < 44 ? 11 - (r >> 2) : 0; for (k = 0; k < 8; k++) EGI[r * 8 + k] = r < 2 ? 0 : r < 48 ? +lo[r & 3][k] : r < 60 ? +hi[r & 3][k] << (r - 48 >> 2) : 8; }
      DTT.set([0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 8, 8, 8,     // DT1 in phase steps by keycode (Yamaha's table in Hz at 8 MHz / 0.053 Hz)
        1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 16, 16, 16, 16,
        2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 22, 22, 22, 22]);
    })();
    function nfb(m, bs) {                                                 // a note (MIDI number, fractions allowed) → [block, F-number], the way a driver's note table sets it; bs lowers the block for sweep headroom
      var b = clamp(Math.floor(m / 12) - 1 - (bs || 0), 0, 7), n = Math.round(440 * Math.pow(2, (m - 69) / 12) * 1048576 / FS / Math.pow(2, b - 1));
      while (n > 2047 && b < 7) { b++; n = Math.round(n / 2); }
      return [b, clamp(n, 1, 2047)];
    }
    function hzfb(hz, b) {                                                // a frequency from a given block up (the drones), to the nearest F-number step
      var n = Math.round(hz * 1048576 / FS / Math.pow(2, b - 1));
      while (n > 2047 && b < 7) { b++; n = Math.round(n / 2); }
      return [b, clamp(n, 1, 2047)];
    }
    /* the driver. A track {p: patch, t: start s, n: steps, v: volume (TL units on the carriers), vs: volume slide a frame, m: modulation
       [wait, speed, change, steps], f: note fill (frames), b: block shift, x3: channel 3 special mode (semitones per operator),
       w / a: per-frame pitch (F-number) / volume tables, cycled}. A step is [note, frames, volume?] (note 0 = a rest; a note may be
       [block, F-number] given as {hz, blk}) or a command {v, vs, m, f, tie}. seq() turns a track into its per-frame registers. */
    function seq(tr) {
      var st = tr.n, nf = 0, i, j, s, f, g;
      for (i = 0; i < st.length; i++) if (st[i].length) nf += st[i][1];
      var K = new Int8Array(nf + 1), FN = new Int16Array(nf * 4), BK = new Int8Array(nf * 4), VO = new Uint8Array(nf), x3 = tr.x3 || [0, 0, 0, 0], w = tr.w, a = tr.a;
      var vol = tr.v || 0, vs = tr.vs || 0, fill = tr.f || 0, m = tr.m, tie = 0, mw = 0, mc = 0, mn = 0, ms = 0, mo = 0, mk = 0, fr = 0, on = 0, nb = [], o;
      for (i = 0; i < st.length; i++) {
        s = st[i];
        if (!s.length) { if (s.v !== undefined) vol = s.v; if (s.vs !== undefined) vs = s.vs; if (s.m !== undefined) m = s.m; if (s.f !== undefined) fill = s.f; if (s.tie) tie = 1; continue; }
        if (s[2] !== undefined) vol = s[2];
        if (s[0]) {
          for (j = 0; j < 4; j++) nb[j] = s[0].hz ? hzfb(s[0].hz * Math.pow(2, x3[j] / 12), s[0].blk) : nfb(s[0] + x3[j], tr.b);
          if (!tie) { K[fr] = 1; mo = 0; if (m) { mw = m[0]; ms = m[1]; mc = m[2]; mn = m[3]; mk = 0; } }
          on = 1;
        } else if (on) { K[fr] = 2; on = 0; }
        tie = 0;
        for (f = 0; f < s[1]; f++, fr++) {
          if (f && s[0] && fill && f === s[1] - fill) K[fr] = 2;
          g = w ? w[fr % w.length] : 0;
          for (j = 0; j < 4; j++) { o = nb[j] || [0, 1]; BK[fr * 4 + j] = o[0]; FN[fr * 4 + j] = clamp(o[1] + mo + g, 1, 2047); }
          vol = clamp(vol + (fr ? vs : 0), 0, 127); VO[fr] = clamp(vol + (a ? a[fr % a.length] : 0), 0, 127);
          if (m && s[0]) { if (mw > 0) mw--; else if (--ms <= 0) { ms = m[1]; mo += mc; if (++mk >= mn) { mk = 0; mc = -mc; } } }   // the modulation moves the next frame
        }
      }
      if (on) K[nf] = 2;
      return { nf: nf, K: K, FN: FN, BK: BK, VO: VO };
    }
    function kcode(b, n) { return b << 2 | (n >> 10 & 1) << 1 | (n & 1024 ? (n & 896 ? 1 : 0) : ((n & 896) === 896 ? 1 : 0)); }   // block and the F-number's top bits: the rate key scale and DT1's column
    function ymInit(tr) {
      var p = tr.p, s0 = Math.round(tr.t * FS);
      return { q: seq(tr), alg: p[0], fs: p[1] ? 10 - p[1] : 0, ams: p[2] || 0, pms: p[3] || 0, op: p.slice(4, 8), lfo: tr.lfo === undefined ? -1 : tr.lfo, s0: s0, n: s0, nx: s0, fr: 0,
        ph: new Int32Array(4), at: new Int32Array([1023, 1023, 1023, 1023]), es: new Int8Array([4, 4, 4, 4]), rt: new Uint8Array(16), sl: new Int32Array(4), tl: new Int32Array(4),
        ea: new Int32Array([4092, 4092, 4092, 4092]), inc: new Int32Array(4), fn: new Int32Array(4), bk: new Int32Array(4), kc: new Int32Array(4), amv: 0, pmv: 0, ls: -1, h0: 0, h1: 0 };
    }
    function ymInc(Z) {                                                   // the phase generator: F-number (bent by the LFO), block, DT1, MUL → a step of the 20-bit counter
      for (var j = 0, o, fn, d, x; j < 4; j++) {
        o = Z.op[j]; fn = Z.fn[j]; if (Z.pmv) fn = Math.round(fn * Math.pow(2, PMSC[Z.pms] * Z.pmv / 1200));
        d = o[1] & 3 ? DTT[((o[1] & 3) - 1) * 32 + Z.kc[j]] : 0;
        x = ((fn << Z.bk[j]) >> 1) + (o[1] & 4 ? -d : d) & 0x1FFFF;
        Z.inc[j] = o[0] ? x * o[0] : x >> 1;
      }
    }
    function ymAtt(Z) { for (var j = 0; j < 4; j++) Z.ea[j] = Math.min(1023, Z.at[j] + Z.tl[j] + (Z.op[j][9] ? Z.amv : 0)) << 2; }
    function ymFrame(Z) {                                                 // a driver frame: key on / off, the frequency registers, the carriers' volume, the envelope rates
      var q = Z.q, f = Z.fr, g = Math.min(f, q.nf - 1), k = f <= q.nf ? q.K[f] : 0, car = ALGC[Z.alg], j, o, ks;
      for (j = 0; j < 4; j++) {
        o = Z.op[j]; Z.fn[j] = q.FN[g * 4 + j]; Z.bk[j] = q.BK[g * 4 + j]; Z.kc[j] = kcode(Z.bk[j], Z.fn[j]); ks = Z.kc[j] >> 3 - (o[8] || 0);
        Z.tl[j] = Math.min(127, (o[2] || 0) + (car >> j & 1 ? q.VO[g] : 0)) << 3;
        Z.rt[j * 4] = o[3] ? Math.min(63, 2 * o[3] + ks) : 0; Z.rt[j * 4 + 1] = o[4] ? Math.min(63, 2 * o[4] + ks) : 0; Z.rt[j * 4 + 2] = o[5] ? Math.min(63, 2 * o[5] + ks) : 0;
        Z.rt[j * 4 + 3] = Math.min(63, 4 * (o[7] || 0) + 2 + ks); Z.sl[j] = (o[6] === 15 ? 31 : o[6] || 0) << 5;
        if (k === 1) { Z.ph[j] = 0; if (Z.rt[j * 4] >= 62) { Z.at[j] = 0; Z.es[j] = 1; } else Z.es[j] = o[3] ? 0 : 4; }
        else if (k === 2 && Z.es[j] < 3) Z.es[j] = 3;
      }
      Z.fr = f + 1; ymInc(Z); ymAtt(Z);
    }
    function ymEG(Z, c) {                                                 // one envelope step (every third sample), c: the global counter
      for (var j = 0, s, r, a, h, i; j < 4; j++) {
        s = Z.es[j]; if (s === 4) continue; a = Z.at[j];
        if (s === 1 && a >= Z.sl[j]) s = Z.es[j] = 2;
        r = Z.rt[j * 4 + s]; h = EGSH[r];
        if (!r || c & (1 << h) - 1) continue;
        i = EGI[r * 8 + (c >> h & 7)];
        if (s === 0) { a += ~a * i >> 4; if (a <= 0) { a = 0; Z.es[j] = 1; } }
        else { a += i; if (a >= 1023) { a = 1023; if (s === 3) Z.es[j] = 4; } }
        Z.at[j] = a;
      }
    }
    function opo(p, e) {                                                  // one operator: a 10-bit phase and an attenuation in log units → a 14-bit signed output
      var l = LSIN[p & 256 ? ~p & 255 : p & 255] + e;
      if (l >= 3328) return 0;
      l = (EXPT[~l & 255] | 1024) << 2 >> (l >> 8);
      return p & 512 ? -l : l;
    }
    /* the renderers work in slices: each renders from where it stopped until the first boundary CH samples on (an envelope step), keeps
       its state in its job (J[4]) and returns false; true when the channel is done. b is the effect's buffer at the chip's rate. */
    function ymR(b, tr, J) {                                              // one FM channel
      var Z = J[4] || (J[4] = ymInit(tr)), N = b.length, n = Z.n, nY = n + CH, q = Z.q, car = ALGC[Z.alg], M = ALGM[Z.alg], fs = Z.fs, lf = Z.lfo, lp = lf >= 0 ? LFON[lf] : 0, P = Z.ph, E = Z.ea, I = Z.inc;
      var m10 = M[1] & 1, m20 = M[2] & 1, m21 = M[2] >> 1 & 1, m30 = M[3] & 1, m31 = M[3] >> 1 & 1, m32 = M[3] >> 2 & 1, c0 = car & 1, c1 = car >> 1 & 1, c2 = car >> 2 & 1, c3 = car >> 3 & 1;
      var p0 = P[0], p1 = P[1], p2 = P[2], p3 = P[3], i0 = I[0], i1 = I[1], i2 = I[2], i3 = I[3], e0 = E[0], e1 = E[1], e2 = E[2], e3 = E[3], h0 = Z.h0, h1 = Z.h1, o0, o1, o2, o3, y, s, pv;
      for (; n < N; n++) {
        if (n >= Z.nx || n % 3 === 0) {
          P[0] = p0; P[1] = p1; P[2] = p2; P[3] = p3;
          if (n >= Z.nx) {                                                // a driver frame; after the last one, the channel is done once its carriers have died away
            if (Z.fr > q.nf && (!c0 || Z.es[0] === 4) && (!c1 || Z.es[1] === 4) && (!c2 || Z.es[2] === 4) && (!c3 || Z.es[3] === 4)) return true;
            ymFrame(Z); Z.nx = Z.s0 + Math.round(Z.fr * FR);
          }
          if (n % 3 === 0) {
            if (n >= nY) { Z.n = n; Z.h0 = h0; Z.h1 = h1; return false; }
            ymEG(Z, (n / 3 | 0) + 1 & 4095);
            if (lp) {                                                     // the LFO: a 7-bit counter, tremolo a triangle 0-126, vibrato 32 steps
              s = (n / lp | 0) & 127;
              if (s !== Z.ls) { Z.ls = s; Z.amv = (s < 64 ? 126 - 2 * s : 2 * s - 128) >> AMSH[Z.ams]; s >>= 2; pv = s < 8 ? s / 8 : s < 24 ? (16 - s) / 8 : (s - 32) / 8; if (Z.pms && pv !== Z.pmv) { Z.pmv = pv; ymInc(Z); } }
            }
            ymAtt(Z);
          }
          p0 = P[0]; p1 = P[1]; p2 = P[2]; p3 = P[3]; i0 = I[0]; i1 = I[1]; i2 = I[2]; i3 = I[3]; e0 = E[0]; e1 = E[1]; e2 = E[2]; e3 = E[3];
        }
        p0 = p0 + i0 & 1048575; p1 = p1 + i1 & 1048575; p2 = p2 + i2 & 1048575; p3 = p3 + i3 & 1048575;
        o0 = e0 < 3328 ? opo((p0 >> 10) + (fs ? h0 + h1 >> fs : 0), e0) : 0; h1 = h0; h0 = o0;
        o1 = e1 < 3328 ? opo((p1 >> 10) + (m10 ? o0 >> 1 : 0), e1) : 0;
        o2 = e2 < 3328 ? opo((p2 >> 10) + (m20 * o0 + m21 * o1 >> 1), e2) : 0;
        o3 = e3 < 3328 ? opo((p3 >> 10) + (m30 * o0 + m31 * o1 + m32 * o2 >> 1), e3) : 0;
        y = c0 * o0 + c1 * o1 + c2 * o2 + c3 * o3; y = (y > 8191 ? 8191 : y < -8192 ? -8192 : y) >> 5;
        b[n] += y < 0 ? y - 7 : y;                                        // 9 bits and the ladder (the idle level, +4, is DC and left out)
      }
      Z.n = n; return true;
    }
    function dacR(b, tr, J) {                                             // channel 6 as the DAC: an 8-bit sample at tr.r Hz, written once a period and held; tr.s() synthesises it a block ahead of the write
      var s0 = Math.round(tr.t * FS), Z = J[4] || (J[4] = { d: new Uint8Array(Math.round(tr.d * tr.r)), g: 0, ph: 0, l1: 0, l2: 0, n: s0 }), d = Z.d, k = tr.r / FS, N = Math.min(b.length, s0 + Math.floor(d.length / k)), n = Z.n, nY = n + 8 * CH, v, j;
      for (; n < N; n++) {
        if (n >= nY) { Z.n = n; return false; }
        j = (n - s0) * k | 0; if (j >= Z.g) tr.s(tr, Z, Math.min(d.length, j + 1024));
        v = d[j] - 128 << 1; b[n] += v < 0 ? v - 7 : v;
      }
      if (Z.g < d.length) tr.s(tr, Z, d.length);                         // the few samples never written, so the variant's PRNG moves on as it always has
      return true;
    }
    function nzR(b, tr, J) {                                              // the PSG's noise channel: {t, z: shift rate Hz (or one a frame: tone 3 driving it), e: attenuation a frame, 0-15 in 2 dB steps}
      var s0 = Math.round(tr.t * FS), Z = J[4] || (J[4] = { n: s0, l: 0x8000 | rr() * 0x7fff, c: 0, f: -1, nx: s0, a: 0, i: 0 }), E = tr.e, N = Math.min(b.length, s0 + Math.round(E.length * FR)), n = Z.n, nY = n + 8 * CH, l = Z.l, c = Z.c, a = Z.a, i = Z.i, z;
      for (; n < N; n++) {
        if (n >= Z.nx) {
          if (n >= nY) { Z.n = n; Z.l = l; Z.c = c; Z.a = a; Z.i = i; return false; }
          Z.f++; Z.nx = s0 + Math.round((Z.f + 1) * FR); z = tr.z.length ? tr.z[Math.min(Z.f, tr.z.length - 1)] : tr.z;
          a = E[Z.f] >= 15 ? 0 : PSGA * Math.pow(10, -E[Z.f] / 10); i = z / FS;
        }
        c += i; while (c >= 1) { c -= 1; l = l >> 1 | ((l ^ l >> 3) & 1) << 15; }
        b[n] += l & 1 ? a : -a;
      }
      return true;
    }
    function boomS(tr, Z, n) {                                            // the DAC's "recording" of a blast: a falling thump under low-passed noise, clipped a little hot, 8-bit unsigned (Z.d from Z.g up to n)
      var r = tr.r, s = Z.d, i, t, ph = Z.ph, l1 = Z.l1, l2 = Z.l2, c, e, x;
      for (i = Z.g; i < n; i++) {
        t = i / r; e = Math.min(1, t / 0.003) * Math.exp(-t / tr.e);
        ph += (tr.f1 + (tr.f0 - tr.f1) * Math.exp(-t / 0.07)) / r;
        c = 1 - Math.exp(-TAU * (150 + tr.c * Math.exp(-t / 0.2)) / r); l1 += c * (rr() * 2 - 1 - l1); l2 += c * (l1 - l2);
        x = (Math.sin(TAU * ph) * (1 - tr.k) + l2 * 4 * tr.k) * e * tr.g;
        s[i] = clamp(Math.round(x * 127) + 128, 0, 255);
      }
      Z.g = n; Z.ph = ph; Z.l1 = l1; Z.l2 = l2;
    }
    function finish(b, f, J) {                                            // the Model 1's output: low-pass, linear interpolation down to the context's rate, a DC trap; then the loop seam or a tail fade, and the level
      var o = J[5], D = J[4] || (J[4] = new Float64Array(12)), i = D[1], e, x, u, v, m, w, y = D[2], yp = D[7], hp = D[3], xp = D[4], pk = D[5], cj = D[6], a = 1 - Math.exp(-TAU * M1 / FS), hk = Math.exp(-TAU * 20 / SR), k = FS / SR, X = Math.round(XF * SR), P = Math.round(SR / 90), n = D[8] || (f.loop ? o.length - X : o.length), q;
      if (D[0] === 0) {
        for (e = Math.min(o.length, i + 4 * CH); i < e; i++) {
          u = i * k; x = u | 0;
          for (; cj <= x + 1 && cj < b.length; cj++) { yp = y; y += a * (b[cj] - y); }   // yp, y: the low-passed chip samples x and x + 1
          v = yp + (u - x) * (y - yp); hp = hk * (hp + v - xp); xp = v; o[i] = hp;
        }
        D[2] = y; D[7] = yp; D[3] = hp; D[4] = xp; D[6] = cj;
        if (i < o.length) { D[1] = i; return false; }
        D[0] = f.loop ? 3 : 1; D[1] = 0; D[9] = n; D[10] = Infinity; return false;
      }
      if (D[0] === 3) {                                                   // a drone's length: of the points up to one period of its lowest tone (P) short of 0.5 s, the one where what follows
        for (e = Math.min(P, i + 24); i < e; i++) {                       // best matches the loop's head, so the crossfade joins waves in phase (the chip's F-numbers never give a whole number of cycles)
          m = o.length - X - i; for (u = 0, w = 0; w < X; w += 2) { v = o[w] - o[m + w]; u += v * v; }
          if (u < D[10]) { D[10] = u; D[9] = m; }
        }
        if (i < P) { D[1] = i; return false; }
        n = D[8] = D[9]; for (i = 0; i < X; i++) o[i] = o[i] * (i / X) + o[n + i] * (1 - i / X);
        D[0] = 1; D[1] = 0; return false;
      }
      if (D[0] === 1) {
        for (e = Math.min(n, i + 8 * CH); i < e; i++) if (Math.abs(o[i]) > pk) pk = Math.abs(o[i]);
        D[5] = pk; D[1] = i; if (i >= n) { D[0] = 2; D[1] = 0; }
        return false;
      }
      q = J[7] ? 1 / 256 : pk > 0 ? f.pk / pk : 0;                        // the level: its peak (raw: one full channel = 1)
      for (e = Math.min(n, i + 4 * CH); i < e; i++) o[i] *= q;
      if (i < n) { D[1] = i; return false; }
      if (!f.loop) { X = Math.min(n, Math.round(0.004 * SR)); for (i = 0; i < X; i++) o[n - 1 - i] *= i / X; }
      J[6].push(f.loop ? o.subarray(0, n) : o);
      return true;
    }
    function begin(name, parts, raw) {                                   // run the recipe for every variant: its channels are queued, not yet heard, then a finish per variant. parts: 1 FM, 2 DAC, 4 PSG
      var f = FX[name], c = { name: name, out: [], jobs: [], ji: 0 }, k, i, t, sc, cb, len = f.len + (f.loop ? XF : 0);
      for (k = 0; k < (f.n || 1); k++) {
        rr = rng(hash(name) + k * 7919); sc = f.make(k); cb = new Float32Array(Math.ceil(len * FS));
        for (i = 0; i < sc.length; i++) {
          t = sc[i]; if (t.p && f.lfo !== undefined) t.lfo = f.lfo;
          if (!parts || parts & (t.p ? 1 : t.s ? 2 : 4)) c.jobs.push([t.p ? ymR : t.s ? dacR : nzR, cb, t, rr, null]);
        }
        c.jobs.push([finish, cb, f, rr, null, new Float32Array(Math.round(len * SR)), c.out, !!raw]);
      }
      if (f.l2) c.jobs.push([louder, null, f, rr, null, c.out]);
      return c;
    }
    function louder(b, f, J) {                                            // the second loop's copy of every variant, l2 dB up (they follow the originals: variant k + n)
      var o = J[5], n = o.length, g = Math.pow(10, f.l2 / 20), i, j, x, y;
      for (i = 0; i < n; i++) { x = o[i]; y = new Float32Array(x.length); for (j = 0; j < x.length; j++) y[j] = x[j] * g; o.push(y); }
      return true;
    }
    function drain(c, until) {                                            // resume the queued jobs a slice at a time until they are done (→ true) or the time is up
      var j;
      while (c.ji < c.jobs.length) {
        j = c.jobs[c.ji]; rr = j[3];
        if (j[0](j[1], j[2], j)) c.jobs[c.ji++] = null;
        if (until && nowSec() > until) break;
      }
      return c.ji >= c.jobs.length;
    }
    function complete(c) {                                                // bank every finished variant as an AudioBuffer
      var out = [], k, x, ab;
      for (k = 0; k < c.out.length; k++) { x = c.out[k]; ab = AC.createBuffer(1, x.length, SR); ab.getChannelData(0).set(x); out.push(ab); }
      BANK[c.name] = out;
    }
    function renderRaw(name, sr, parts, raw) {                            // the debug hook: the finished samples at any rate, the bank untouched
      var keep = SR, c;
      SR = sr;
      try { c = begin(name, parts, raw); drain(c, 0); } finally { SR = keep; }
      return c.out;
    }
    function ymScore(sc, secs, lfo) {                                     // the debug hook: a score straight off the chip, at its own rate, before the output stage (9-bit units)
      var b = new Float32Array(Math.ceil(secs * FS)), i, J, t;
      rr = rng(1);
      for (i = 0; i < sc.length; i++) { t = sc[i]; if (t.p && lfo !== undefined) t.lfo = lfo; J = [t.p ? ymR : t.s ? dacR : nzR, b, t, rr, null]; while (!J[0](b, t, J)); }
      return b;
    }
    /* the patches, register by register: [ALG, FB, AMS, PMS, op 1, op 2, op 3, op 4], an operator [MUL, DT1, TL, AR, D1R, D2R, SL, RR, KS, AM]
       (operators in algorithm order: op 1 is the one fed back) */
    var OFF = [1, 0, 127, 0, 0, 0, 0, 15];
    var PT = {
      zapR: [4, 6, 0, 0, [1, 0, 22, 31, 20, 0, 15, 15], [1, 0, 6, 31, 23, 0, 15, 14], [7, 3, 26, 31, 25, 0, 15, 15], [3, 0, 10, 31, 25, 0, 15, 14]],   // red: a fed-back pair and a bright one, a hard "chk"
      zapB: [0, 6, 0, 0, [1, 0, 26, 31, 18, 0, 15, 15], [2, 0, 32, 31, 19, 0, 15, 15], [1, 3, 26, 31, 19, 0, 15, 15], [1, 0, 4, 31, 20, 0, 15, 13]],  // blue: four in series, a buzz
      zapG: [4, 0, 0, 0, [5, 0, 34, 31, 24, 0, 15, 15], [1, 0, 6, 31, 24, 0, 15, 14], [11, 0, 44, 31, 27, 0, 15, 15], [2, 0, 18, 31, 26, 0, 15, 14]], // green: nearly pure, high
      tink: [4, 3, 0, 0, [14, 3, 30, 31, 26, 0, 15, 15], [4, 0, 4, 31, 24, 0, 15, 15], [11, 7, 34, 31, 27, 0, 15, 15], [3, 0, 8, 31, 25, 0, 15, 15]],
      tank: [4, 4, 0, 0, [15, 3, 26, 31, 22, 0, 15, 14], [1, 0, 2, 31, 22, 0, 15, 13], [5, 7, 24, 31, 22, 0, 15, 14], [2, 0, 6, 31, 22, 0, 15, 13]],
      tonk: [4, 2, 0, 0, [3, 0, 36, 31, 22, 0, 15, 14], [1, 0, 4, 31, 22, 0, 15, 14], OFF, OFF],
      boom: [5, 7, 0, 0, [1, 0, 4, 31, 16, 0, 15, 7], [0, 0, 2, 31, 17, 0, 15, 7], [1, 3, 6, 31, 16, 0, 15, 7], [3, 7, 10, 31, 18, 0, 15, 8]],     // FM noise: op 1 at feedback 7 thrashing three carriers
      pop: [5, 7, 0, 0, [1, 0, 6, 31, 19, 0, 15, 10], [0, 0, 2, 31, 20, 0, 15, 10], [1, 3, 6, 31, 20, 0, 15, 10], [3, 7, 12, 31, 22, 0, 15, 11]],
      hiss: [7, 7, 0, 0, [15, 0, 4, 31, 22, 0, 15, 12], OFF, OFF, OFF],                                                                       // FM noise, high: one operator at feedback 7
      sizz: [4, 7, 0, 0, [2, 0, 20, 31, 20, 0, 15, 12], [5, 0, 4, 31, 20, 0, 15, 12], OFF, OFF],                                               // band-limited FM noise: a fed-back modulator scatters a carrier at 5x (2.6 kHz)
      fizz: [4, 7, 0, 0, [2, 0, 8, 31, 0, 0, 0, 12], [1, 0, 4, 31, 20, 0, 15, 12], OFF, OFF],                                                  // FM noise at any level: op 1 stays loud enough to stay noise (its own output is its feedback), the carrier's TL is the volume
      crack: [4, 7, 0, 0, [3, 0, 16, 31, 22, 0, 15, 12], [7, 0, 4, 31, 22, 0, 15, 12], OFF, OFF],
      kick: [7, 3, 0, 0, [1, 0, 0, 31, 19, 0, 15, 10], OFF, OFF, OFF],                                                                        // a thump: one operator, a little feedback
      bell: [4, 0, 0, 0, [14, 0, 28, 31, 17, 0, 15, 8], [2, 0, 2, 31, 17, 0, 15, 8], [3, 0, 26, 31, 16, 0, 15, 9], [1, 0, 8, 31, 16, 0, 15, 8]],
      ping: [4, 0, 0, 0, [14, 0, 28, 31, 21, 0, 15, 12], [2, 0, 2, 31, 21, 0, 15, 12], [3, 0, 26, 31, 20, 0, 15, 12], [1, 0, 8, 31, 20, 0, 15, 12]],
      brass: [4, 5, 0, 3, [1, 3, 22, 26, 8, 0, 2, 8], [1, 3, 4, 31, 6, 2, 1, 8], [1, 7, 24, 26, 8, 0, 2, 8], [1, 7, 6, 31, 6, 2, 1, 8]],       // two detuned pairs, the modulators a touch slower: the blat
      saw: [7, 6, 0, 0, [1, 0, 8, 31, 0, 0, 0, 12], OFF, OFF, OFF],                                                                           // feedback 6 alone: a sawtooth
      siren: [4, 5, 0, 4, [1, 0, 20, 31, 0, 0, 0, 10], [1, 0, 2, 31, 0, 0, 0, 10], [2, 0, 26, 31, 0, 0, 0, 10], [1, 0, 8, 31, 0, 0, 0, 10]],
      scream: [4, 6, 0, 6, [1, 0, 16, 31, 4, 0, 4, 6], [1, 0, 2, 31, 3, 0, 2, 6], [3, 3, 22, 31, 4, 0, 4, 6], [1, 7, 6, 31, 3, 0, 2, 6]],
      clang: [4, 3, 0, 0, [1, 0, 24, 31, 14, 0, 15, 6], [1, 0, 4, 31, 12, 0, 15, 6], [1, 0, 20, 31, 15, 0, 15, 6], [1, 0, 8, 31, 11, 0, 15, 6]],   // with channel 3's special mode: inharmonic
      beam: [4, 5, 0, 0, [1, 0, 20, 31, 0, 0, 0, 10], [1, 0, 4, 31, 0, 0, 0, 10], [3, 0, 28, 31, 0, 0, 0, 10], [2, 0, 10, 31, 0, 0, 0, 10]],
      buzz: [4, 7, 0, 0, [1, 0, 16, 31, 0, 0, 0, 10], [1, 0, 2, 31, 0, 0, 0, 10], [2, 0, 24, 31, 0, 0, 0, 10], [4, 0, 16, 31, 0, 0, 0, 10]],
      whine: [4, 1, 2, 0, [4, 0, 34, 31, 0, 0, 0, 10], [1, 0, 6, 31, 0, 0, 0, 10, 0, 1], [2, 0, 40, 31, 0, 0, 0, 10], [1, 0, 14, 31, 0, 0, 0, 10, 0, 1]],
      rumble: [0, 7, 0, 0, [1, 0, 8, 31, 12, 0, 15, 6], [1, 0, 24, 31, 12, 0, 15, 6], [1, 0, 30, 31, 12, 0, 15, 6], [1, 0, 0, 31, 13, 0, 15, 6]]
    };
    function pat(p, e) { p = p.map(function (x) { return x.slice ? x.slice() : x; }); e(p); return p; }   // a patch edited for a variant
    function tk(p, t, n, o) { var r = { p: p, t: t, n: n }, k; if (o) for (k in o) r[k] = o[k]; return r; }   // an FM channel: patch, start (s), steps, options
    function dac(t, o) { var r = { s: boomS, t: t, r: 8000, d: 0.8, f0: 150, f1: 38, c: 2500, k: 0.55, e: 0.16, g: 1 }, k; for (k in o) r[k] = o[k]; return r; }   // channel 6 as the DAC
    function psg(t, e, z) { return { t: t, e: e, z: z || 6991 }; }        // the PSG's noise: attenuations a frame; 6991 Hz = its clock / 512
    function ramp(a, b, n) { for (var o = [], i = 0; i < n; i++) o.push(Math.round(a + (b - a) * i / Math.max(1, n - 1))); return o; }
    function kicks(t, s) { return tk(PT.kick, t, s, { m: [0, 1, -70, 255], b: 1, v: 2 }); }   // one thump channel, re-keyed for each blast
    function blast(t, m, fr, v) { return [tk(PT.boom, t, [[m, fr]], { m: [0, 1, -14, 255], b: 1, v: v || 0 }), tk(PT.kick, t, [[m - 12, 8]], { m: [0, 1, -70, 255], b: 1, v: (v || 0) + 2 })]; }   // an explosion: FM noise falling, and its thump
    function brassT(t, s, o) { return tk(PT.brass, t, s, o); }
    /* the effects. p: priority 0-3 (who may steal whose voice), gap: the per-name rate gate (s), len (s), pk: peak into the bus,
       n: variants (one is picked at random, never the last one again; the rapid-fire ones differ in timbre, not in pitch, so a
       stream of them never plays a tune), cents: random detune per play, loop: a seamless drone loop, lfo: the chip's LFO rate,
       l2: dB louder in the second loop (the hits). make(k) returns variant k's score. */
    var FX = {
      start: { p: 3, gap: 0.3, len: 0.8, pk: 0.179, make: function () {
        return [brassT(0, [[67, 4], [79, 4], [86, 22]], { m: [10, 1, 3, 2] }), brassT(8 / 60, [[79, 22]], { v: 6 }), tk(PT.bell, 8 / 60, [[91, 22]], { v: 12 })];
      } },
      shotR: { p: 0, gap: 0.07, len: 0.065, pk: 0.078, n: 3, cents: 20, make: function (k) {     // a spread shot twelve times a second: three frames, falling five semitones
        return [tk(pat(PT.zapR, function (p) { p[1] = [6, 5, 7][k]; p[6][0] = [7, 6, 9][k]; }), 0, [[88, 3]], { m: [0, 1, -200, 255], b: 1 })];
      } },
      hit: { p: 0, gap: 0.055, len: 0.055, pk: 0.226, l2: 4.5, n: 2, cents: 30, make: function (k) {      // three frames of tin, inside the gate
        return [tk(pat(PT.tink, function (p) { p[4][0] = [14, 12][k]; }), 0, [[79, 3]])];
      } },
      pop: { p: 1, gap: 0.045, len: 0.3, pk: 0.141, n: 3, cents: 50, make: function (k) {
        return [tk(PT.pop, 0, [[[64, 62, 66][k], 7]], { m: [0, 1, -60, 255], b: 1 }), tk(PT.kick, 0, [[50, 4]], { m: [0, 1, -90, 255], b: 1, v: 6 })];
      } },
      boom: { p: 1, gap: 0.06, len: 0.6, pk: 0.245, n: 3, cents: 45, make: function (k) {
        return blast(0, [57, 55, 59][k], 16).concat([psg(0, ramp(2, 15, 9), [6991, 6991, 3496][k])]);
      } },
      medal: { p: 0, gap: 0.05, len: 0.1, pk: 0.054, n: 8, make: function (k) {             // one rung of the citation ladder each, its brightness key-scaled down as it climbs
        return [tk(pat(PT.ping, function (p) { p[4][2] = 24 + k; p[6][2] = 22 + k; }), 0, [[79 + LADDER[k], 4]])];
      } },
      laserR: { p: 1, loop: 1, len: 0.5, pk: 0.036, make: function () {                      // drones: every table's period divides 30 frames; finish() cuts the loop where the waves meet
        return [tk(PT.beam, 0, [[{ hz: 146, blk: 3 }, 33]], { a: [0, 4], w: [0, 3, 6, 3, 0, -3] }), tk(pat(PT.fizz, function (p) { p[5][0] = 2; p[5][4] = 0; }), 0, [[{ hz: 1000, blk: 5 }, 33]], { v: 20 })];
      } },
      laserOn: { p: 1, gap: 0.25, len: 0.14, pk: 0.073, make: function () {
        return [tk(PT.beam, 0, [[55, 6]], { m: [0, 1, 180, 255], b: 1, f: 1 })];
      } },
      laserHit: { p: 0, gap: 0.15, len: 0.1, pk: 0.185, l2: 2.5, n: 3, cents: 40, make: function (k) {        // five frames of sizzle, falling
        return [tk(PT.sizz, 0, [[72 + k * 2, 5]], { m: [0, 1, -25, 255] })];
      } },
      shotB: { p: 0, gap: 0.085, len: 0.08, pk: 0.043, n: 3, cents: 20, make: function (k) {    // a buzzier, lower zap: its pitch trills a frame at a time
        return [tk(pat(PT.zapB, function (p) { p[1] = [6, 7, 6][k]; p[5][2] = [32, 30, 34][k]; }), 0, [[62, 4]], { m: [0, 1, [70, 60, 80][k], 1], b: 1 })];
      } },
      shotG: { p: 0, gap: 0.12, len: 0.06, pk: 0.09, n: 3, cents: 20, make: function (k) {     // thin and high: every other needle
        return [tk(pat(PT.zapG, function (p) { p[4][0] = [5, 4, 6][k]; p[4][2] = [34, 32, 36][k]; p[6][0] = [11, 9, 13][k]; }), 0, [[91, 3]], { m: [0, 1, 25, 255] })];
      } },
      laserB: { p: 1, loop: 1, len: 0.5, pk: 0.023, make: function () {                     // the buzz only: its arcs are arcB, thrown at random while the beam is held
        return [tk(PT.buzz, 0, [[{ hz: 120, blk: 2 }, 33]], { a: [0, 6] })];
      } },
      arcB: { p: 0, gap: 0.05, len: 0.22, pk: 0.036, n: 6, cents: 80, make: function () {     // a few cracks of blue thunder, retriggered, a different handful each time
        var n = 2 + (rr() * 2 | 0), i, o = [];
        for (i = 0; i < n; i++) o.push(tk(PT.crack, i * 0.05 + rr() * 0.03, [[74 + rr() * 10, 1], [70 + rr() * 10, 1]], { v: rr() * 6 | 0 }));
        return o;
      } },
      laserG: { p: 1, loop: 1, len: 0.5, pk: 0.019, make: function () {
        return [tk(PT.whine, 0, [[{ hz: 590, blk: 5 }, 33]], { w: [0, 4, 8, 4, 0], a: [0, 2, 0] })];
      } },
      power: { p: 2, gap: 0.1, len: 0.85, pk: 0.22, make: function () {                      // ka-chunk, a clank, then the arpeggio and its echo
        return [tk(PT.kick, 0, [[45, 6]], { m: [0, 1, -60, 255], b: 1 }), tk(PT.tank, 0.012, [[70, 3]]),
          tk(PT.bell, 0.07, [[72, 3], [79, 3], [84, 3], [88, 26]], { m: [12, 1, 4, 2] }), tk(PT.bell, 0.12, [[72, 3], [79, 3], [84, 3], [88, 24]], { v: 10 }), brassT(0.25, [[84, 22]], { v: 8, f: 4 })];
      } },
      weapon: { p: 2, gap: 0.1, len: 0.6, pk: 0.17, make: function () {
        return [tk(PT.kick, 0, [[50, 5]], { m: [0, 1, -50, 255], b: 1 }), tk(PT.bell, 0.05, [[76, 4], [83, 22]]), tk(PT.bell, 0.1, [[76, 4], [83, 20]], { v: 10 })];
      } },
      speed: { p: 2, gap: 0.1, len: 0.5, pk: 0.195, make: function () {
        return [tk(PT.saw, 0, [[60, 13]], { m: [0, 1, 45, 255], b: 1, v: 4 }), tk(PT.ping, 0.2, [[84, 3], [88, 3], [91, 3], [96, 6]])];
      } },
      bombUp: { p: 2, gap: 0.1, len: 0.55, pk: 0.203, make: function () {
        return [tk(PT.kick, 0, [[43, 10]], { m: [0, 1, -40, 255], b: 1 }), brassT(0.06, [[55, 5], [62, 18]], { f: 3 }), brassT(0.14, [[67, 13]], { v: 6, f: 3 })];
      } },
      bonus: { p: 2, gap: 0.1, len: 0.4, pk: 0.163, make: function () {
        return [tk(PT.bell, 0, [[83, 4], [88, 16]]), tk(PT.bell, 0.05, [[83, 4], [88, 14]], { v: 10 })];
      } },
      bigBoom: { p: 2, gap: 0.14, len: 1.4, pk: 0.286, n: 2, cents: 35, make: function (k) {   // two blasts on two channels, one kick channel re-keyed, the DAC's boom under the first
        return [tk(PT.boom, 0, [[57, 40]], { m: [0, 1, -14, 255], b: 1 }), tk(PT.boom, 0.14, [[52, 34]], { m: [0, 1, -14, 255], b: 1, v: 6 }), kicks(0, [[45, 8], [40, 10]]),
          dac(0, { d: 1.1, f0: [150, 130][k], e: 0.2, g: 0.3 }), psg(0, ramp(3, 15, 16))];
      } },
      cancel: { p: 1, gap: 0.2, len: 0.55, pk: 0.137, make: function () {                     // the bullets turn to citations: a cascade, its echo, and a falling fizz
        var s = [[96, 2], [93, 2], [91, 2], [88, 2], [86, 2], [84, 12]];
        return [tk(PT.ping, 0, s), tk(PT.ping, 0.05, s, { v: 10 }), tk(PT.fizz, 0, [[96, 14]], { v: 8, m: [0, 1, -20, 255] })];
      } },
      chainBreak: { p: 1, gap: 0.3, len: 0.42, pk: 0.085, make: function () {
        return [brassT(0, [[67, 8], [60, 13]], { m: [0, 1, -8, 255], f: 2 })];
      } },
      hitHard: { p: 0, gap: 0.075, len: 0.07, pk: 0.139, l2: 1.5, n: 2, cents: 25, make: function (k) {   // the boss's armour at E6: both carriers at 2.6 kHz, sidebands from 4 kHz up, so 80% of its loudness is in 1.5-5 kHz, where the loop-2 scores are bright
        return [tk(pat(PT.tank, function (p) { p[1] = [4, 5][k]; p[4][0] = [5, 7][k]; p[5][0] = 2; }), 0, [[88, 3]], { m: [0, 1, -20, 255] })];
      } },
      deflect: { p: 0, gap: 0.09, len: 0.07, pk: 0.09, n: 2, cents: 30, make: function (k) {
        return [tk(pat(PT.tonk, function (p) { p[1] = [2, 4][k]; }), 0, [[68, 3]], { m: [0, 1, -30, 255] })];
      } },
      revenge: { p: 0, gap: 0.1, len: 0.1, pk: 0.056, n: 2, cents: 30, make: function (k) {      // backwards: it swells, then stops dead
        return [tk(pat(PT.zapG, function (p) { p[4][3] = p[5][3] = p[6][3] = p[7][3] = 17; p[4][4] = p[5][4] = p[6][4] = p[7][4] = 0; p[5][7] = p[7][7] = 15; p[4][2] = [30, 26][k]; p[6][2] = 30; }), 0, [[81, 5]], { m: [0, 1, 40, 255] })];
      } },
      extend: { p: 3, gap: 0.3, len: 1.3, pk: 0.139, make: function () {
        var s = [72, 76, 79, 84, 88, 91, 88, 91].map(function (m) { return [m, 4]; });
        return [brassT(0, s.concat([[96, 32]])), tk(PT.bell, 4 / 60, s.map(function (x) { return [x[0] + 12, 4]; }).concat([[103, 30]]), { v: 12 }), brassT(32 / 60, [[91, 32]], { v: 6 })];
      } },
      death: { p: 3, gap: 0.2, len: 1.7, pk: 0.253, lfo: 3, make: function () {             // a scream falling away, two blasts and the DAC's boom
        return [tk(PT.scream, 0, [[93, 57]], { m: [3, 1, -26, 255], b: 2 }), tk(PT.boom, 0, [[55, 50]], { m: [0, 1, -14, 255], b: 1 }), tk(PT.boom, 0.25, [[50, 40]], { m: [0, 1, -14, 255], b: 1, v: 6 }),
          kicks(0, [[43, 8], [0, 7], [38, 10]]), dac(0, { d: 1.2, f0: 140, e: 0.22, g: 0.4 })];
      } },
      bomb: { p: 3, gap: 0.3, len: 2.8, pk: 0.34, lfo: 7, make: function () {            // the skull swells, then everything goes
        return [tk(pat(PT.boom, function (p) { p[5][3] = p[6][3] = p[7][3] = 14; p[5][7] = p[6][7] = p[7][7] = 13; }), 0, [[36, 27]], { m: [0, 1, 30, 255], b: 2 }),
          tk(PT.boom, 0.45, [[52, 60]], { m: [0, 1, -14, 255], b: 1 }), tk(PT.boom, 0.62, [[47, 50]], { m: [0, 1, -14, 255], b: 1, v: 4 }), kicks(0.45, [[40, 10]]),
          tk(PT.rumble, 0.45, [[31, 70]], { m: [0, 2, -3, 255], b: 1, v: 4 }), dac(0.45, { d: 1.9, f0: 120, f1: 30, e: 0.35, k: 0.6, g: 0.38 }), psg(0.45, ramp(2, 15, 40))];
      } },
      alert: { p: 3, gap: 1, len: 1.0, pk: 0.146, lfo: 5, make: function () {
        var s = [[81, 12], [76, 12], [81, 12], [76, 12]];
        return [tk(PT.siren, 0, s, { f: 1 }), tk(PT.siren, 0, s.map(function (x) { return [x[0] - 12, x[1]]; }), { f: 1, v: 12 })];
      } },
      ding: { p: 1, gap: 0.5, len: 1.0, pk: 0.2, make: function () {                      // the typesetter's carriage-return bell: channel 3 in special mode, its partials 1, 2.76, 5.4
        return [tk(PT.clang, 0, [[91, 4]], { x3: [17.6, 0, 29.2, 12] }), tk(PT.hiss, 0, [[100, 1]], { v: 10 })];
      } },
      klaxon: { p: 3, gap: 1, len: 3.45, pk: 0.212, lfo: 5, make: function () {            // WARNING: two tones, each whooping up, six times
        var s = [], i;
        for (i = 0; i < 6; i++) s.push([78, 17], [73, 17]);
        return [tk(PT.siren, 0, s, { f: 1, m: [0, 1, 4, 255] }), tk(PT.siren, 0, s.map(function (x) { return [x[0] - 12, x[1]]; }), { f: 1, v: 10, m: [0, 1, 2, 255] })];
      } },
      phaseBreak: { p: 3, gap: 0.3, len: 1.6, pk: 0.33, make: function () {
        var s = [79, 83, 86, 91, 95].map(function (m) { return [m, 4]; });
        return blast(0, 55, 50).concat([tk(PT.clang, 0, [[55, 6]], { x3: [17.6, 0, 29.2, 12] }), tk(PT.bell, 0.35, s.concat([[98, 20]]), { v: 4 })]);   // clang: channel 3, special mode
      } },
      bossBreak: { p: 3, gap: 0.3, len: 1.9, pk: 0.284, lfo: 3, make: function () {        // a metal scream over the first blast
        return [tk(PT.scream, 0.05, [[87, 90]], { m: [6, 2, -14, 255], b: 1 }), dac(0, { d: 1.2, f0: 130, e: 0.25, g: 0.4 })].concat(blast(0, 52, 60));
      } },
      bossDie: { p: 3, gap: 0.3, len: 3.4, pk: 0.34, make: function () {                   // four blasts, each bigger, the DAC under the last two, then the rumble and the debris
        var d = [], f = 0, bm = { m: [0, 1, -14, 255], b: 1 };             // two blast channels re-keyed in turn (frames 0, 17, 37, 66), one kick channel, the DAC re-written
        while (f < 120) { d.push([84 + rr() * 16, 1], [0, 1 + (rr() * (2 + f / 12) | 0)]); f += 1 + d[d.length - 1][1]; }
        return [tk(PT.boom, 0, [[57, 20], [0, 17], [52, 30]], bm), tk(PT.boom, 17 / 60, [[55, 24, 2], [0, 25], [47, 80, 0]], bm), kicks(0, [[45, 8], [0, 9], [43, 8], [0, 12], [40, 8], [0, 21], [35, 12]]),
          dac(37 / 60, { d: 29 / 60, f0: 140, e: 0.18, g: 0.3 }), dac(66 / 60, { d: 2.0, f0: 110, f1: 28, e: 0.45, k: 0.6, g: 0.33 }), tk(PT.rumble, 0.9, [[31, 140]], { m: [0, 3, -2, 255], b: 1, v: 6 }),
          tk(PT.hiss, 1.2, d, { v: 8 }), psg(1.1, ramp(3, 15, 50), 3496)];
      } },
      count: { p: 2, gap: 0.3, len: 0.16, pk: 0.183, make: function () {
        return [tk(PT.saw, 0, [[84, 3]], { v: 4 }), tk(PT.ping, 0, [[72, 6]])];
      } },
      gameOver: { p: 3, gap: 1, len: 1.8, pk: 0.241, make: function () {
        return [brassT(0, [[67, 12], [63, 12], [60, 12], [55, 50]], { f: 1 }), brassT(36 / 60, [[51, 50]], { v: 6 })];
      } },
      pause: { p: 2, gap: 0.08, len: 0.17, pk: 0.17, make: function () {
        return [tk(PT.saw, 0, [[88, 4], [81, 5]], { f: 1, v: 2 })];
      } },
      beamWarn: { p: 2, gap: 0.5, len: 1.1, pk: 0.137, lfo: 6, make: function () {            // the True Last Boss's lasers, charging: a whine climbing from G5 (784 Hz) past 1.6 kHz under a
        return [tk(pat(PT.whine, function (p) { p[5][3] = p[7][3] = 14; }), 0, [[79, 62]], { m: [0, 1, 22, 255] }),   // 46 Hz tremolo, its sidebands in 1.5-5 kHz over the tlb score (F-number 965 + 22 a frame to 2047 at 0.8 s)
          tk(pat(PT.hiss, function (p) { p[4][3] = 12; }), 0, [[72, 60]], { m: [0, 1, 18, 255], b: 1, v: 14 })];
      } },
      beamFire: { p: 2, gap: 0.3, len: 0.62, pk: 0.212, make: function () {                  // ... and biting
        return [tk(PT.boom, 0, [[52, 30]], { m: [0, 1, 6, 1], b: 1 }), tk(PT.buzz, 0, [[43, 30]], { a: [0, 6], v: 4 }), tk(PT.hiss, 0, [[96, 3]], { v: 2 })];
      } },
      beamHum: { p: 2, loop: 1, len: 0.5, pk: 0.048, make: function () {                    // ... and the drone while they stay lethal: a 100 Hz growl and an FM-noise sizzle 15 dB under it
        return [tk(PT.beam, 0, [[{ hz: 100, blk: 2 }, 33]], { a: [0, 3, 6] }), tk(pat(PT.fizz, function (p) { p[5][4] = 0; }), 0, [[{ hz: 1600, blk: 5 }, 33]], { v: 18 })];
      } },
      coreOpen: { p: 2, gap: 0.3, len: 0.65, pk: 0.158, make: function () {
        var s = [[76, 3], [80, 3], [83, 3], [88, 22]];
        return [tk(PT.bell, 0, s), tk(PT.bell, 0.05, s, { v: 10 }), tk(pat(PT.hiss, function (p) { p[4][3] = 16; }), 0, [[60, 18]], { m: [0, 1, 40, 255], b: 1, v: 18 })];
      } },
      coreShut: { p: 2, gap: 0.3, len: 0.55, pk: 0.27, make: function () {
        return [tk(PT.clang, 0, [[49, 6]], { x3: [17.6, 0, 29.2, 12] }), tk(PT.kick, 0, [[43, 8]], { m: [0, 1, -40, 255], b: 1 }), tk(PT.hiss, 0.03, [[84, 2]], { v: 12 })];
      } },
      rankUp: { p: 1, gap: 1, len: 0.75, pk: 0.143, make: function () {                     // a minor second, low: the reviewers are getting organised
        return [brassT(0, [[45, 36]], { f: 2 }), brassT(0, [[46, 36]], { f: 2, v: 2 })];
      } },
      respawn: { p: 1, gap: 0.5, len: 0.75, pk: 0.15, make: function () {
        return [tk(pat(PT.hiss, function (p) { p[4][3] = 13; }), 0, [[48, 38]], { m: [0, 1, 30, 255], b: 2, v: 6, f: 6 }), tk(PT.saw, 0, [[55, 36]], { m: [0, 1, 20, 255], b: 2, v: 14, f: 6 })];
      } },
      flyOff: { p: 3, gap: 1, len: 1.95, pk: 0.24, make: function () {
        return [tk(pat(PT.boom, function (p) { p[4][3] = p[5][3] = p[6][3] = p[7][3] = 13; p[4][4] = p[5][4] = p[6][4] = p[7][4] = 0; p[4][2] = 14; }), 0, [[36, 100]], { m: [0, 1, 12, 255], b: 2, f: 20 }),
          tk(PT.saw, 0.2, [[43, 80]], { m: [0, 1, 14, 255], b: 2, v: 16, f: 20 }), tk(PT.bell, 1.35, [[100, 20]], { v: 2 })];
      } },
      stamp: { p: 3, gap: 1, len: 0.5, pk: 0.33, make: function () {                      // PUBLISHED! / TENURED!: the rubber stamp and its rebound
        return [tk(PT.kick, 0, [[43, 14]], { m: [0, 1, -45, 255], b: 1 }), tk(PT.hiss, 0, [[70, 2]], { v: 4, m: [0, 1, -60, 255] }), tk(PT.kick, 0.075, [[50, 6]], { m: [0, 1, -60, 255], b: 1, v: 10 })];
      } },
      firework: { p: 1, gap: 0.15, len: 1.0, pk: 0.2, n: 2, cents: 60, make: function () {  // a pop, then its crackle: FM noise retriggered, thinning out
        var d = [], f = 0;
        while (f < 48) { d.push([86 + rr() * 14, 1], [0, 1 + (rr() * (1 + f / 8) | 0)]); f += 1 + d[d.length - 1][1]; }
        return [tk(PT.pop, 0, [[62, 6]], { m: [0, 1, -60, 255], b: 1 }), tk(PT.hiss, 0.12, d, { v: 6 })];
      } }
    };
    var SHOTS = ['shotR', 'shotB', 'shotG'], LASERS = ['laserR', 'laserB', 'laserG'], LADDER = [0, 2, 4, 7, 9, 12, 14, 16];   // from G5: the top rung is B6, under 2 kHz
    var FIRST = ['start', 'shotR', 'hit', 'bomb', 'death', 'laserOn', 'laserR', 'laserHit', 'pop', 'boom', 'medal', 'bigBoom', 'cancel', 'shotB', 'shotG',
      'laserB', 'arcB', 'laserG', 'power', 'weapon', 'speed', 'bombUp', 'bonus', 'respawn', 'chainBreak', 'extend', 'pause'];   // the head of the queue: what a fresh game can ask for first
    (function () { for (var k in FX) if (FX.hasOwnProperty(k)) { FXI[k] = FXN.length; FXN.push(k); } LASTV = new Int8Array(FXN.length); })();
    var idleReq = 0;
    function warmIdle() {                                                 // the queue works in the browser's idle time; without idle callbacks (Safari), 3 ms after each frame
      if (!self.active || !AC || !WQ.length) return;
      if (!window.requestIdleCallback) { warm(3); return; }
      if (!idleReq) idleReq = requestIdleCallback(idleWarm, { timeout: 250 });   // never idle: 2 ms every quarter second anyway
    }
    function idleWarm(dl) { idleReq = 0; warm(Math.max(2, Math.min(10, dl.timeRemaining()))); warmIdle(); }
    function warm(ms) {                                                   // the head of the queue, until the budget is spent
      if (!self.active || !AC) return;
      var t0 = nowSec(), until = t0 + ms / 1000, nm, c, t;
      while (WQ.length && nowSec() < until) {
        nm = WQ[0];
        if (BANK[nm]) { WQ.shift(); continue; }
        c = CTX[nm] || (CTX[nm] = begin(nm));
        if (drain(c, until)) { complete(c); CTX[nm] = null; WQ.shift(); ready(nm); }
      }
      t = nowSec(); renderMs += t - t0; if (t - until > overMax) overMax = t - until;
    }
    function want(nm, oneShot, r, k) {                                    // wanted before it is rendered: to the front of the queue, and a one-shot waits for it there
      var i = WQ.indexOf(nm), p;
      if (i !== 0) { if (i > 0) WQ.splice(i, 1); WQ.unshift(nm); }
      if (!WANT[nm]) { WANT[nm] = 1; nWant++; misses++; }
      if (oneShot) { p = PEND[nm] || (PEND[nm] = { r: 1, k: -1, t: -1 }); p.r = r || 1; p.k = k === undefined ? -1 : k; p.t = AC.currentTime; }
    }
    function ready(nm) {                                                  // just banked: a sound that waited for it plays now, unless it has gone stale
      var p = PEND[nm], d;
      if (WANT[nm]) { WANT[nm] = 0; nWant--; }
      if (p && p.t >= 0) { d = AC.currentTime - p.t; p.t = -1; if (d <= 0.25) { if (d > lateMax) lateMax = d; play(nm, p.r, p.k); } else drops++; }
    }
    var CEIL = null;
    function mkBus(ctx) {                                                 // trim → limiter → gain (small-signal 1.33: Chrome adds make-up gain) → a soft ceiling, linear to 0.35 and never
      var pre = ctx.createGain(), lim = ctx.createDynamicsCompressor(), o = ctx.createGain(), sh = ctx.createWaveShaper(), n = 4097, i, x, s;
      pre.gain.value = 0.5; lim.threshold.value = -13; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.15; o.gain.value = 1.18;
      if (!CEIL) { CEIL = new Float32Array(n); for (i = 0; i < n; i++) { x = i / 2048 - 1; s = Math.abs(x); CEIL[i] = s <= 0.35 ? x : (x < 0 ? -1 : 1) * (0.35 + 0.07 * Math.tanh((s - 0.35) / 0.07)); } }
      sh.curve = CEIL; pre.connect(lim); lim.connect(o); o.connect(sh); return [pre, sh];   // above 0.42: it shaves the loop-2 hit, a bomb or a pile-up so a score peak has room
    }
    function audioInit() {
      try {
        AC = api.audio(); if (!AC) return;
        if (bankSR !== AC.sampleRate) { BANK = {}; CTX = {}; bankSR = SR = AC.sampleRate; }
        var c = mkBus(AC), i, g; bus = c[0]; busOut = c[1]; busOut.connect(AC.destination);
        VOX = []; for (i = 0; i < NV; i++) { g = AC.createGain(); g.connect(bus); VOX.push({ g: g, s: null, end: 0, pri: 0 }); }
        WQ = FIRST.slice(); for (i = 0; i < FXN.length; i++) if (WQ.indexOf(FXN[i]) < 0) WQ.push(FXN[i]);
        WANT = {}; nWant = 0; PEND = {}; loopG = loopS = beamG = beamS = null; loopName = ''; gates = {};
      } catch (e) { AC = null; bus = null; }
    }
    function logSfx(i, r, k) { if (DBG && logN < NLOG) { LOGT[logN] = G ? G.t : 0; LOGN[logN] = i; LOGR[logN] = r; LOGK[logN] = k || 0; logN++; } }
    function play(name, rate, k) {                                        // → true if it sounded. k: a given variant (the medal's rung), else one at random
      if (!AC || !bus) return false;
      var f = FX[name], fi = FXI[name], t = AC.currentTime, bufs = BANK[name], i, v, best = -1, free = -1, bs = 1e9, sc, alive = 0, nb, s, pr, at = t;
      if (f.gap && gates[name] !== undefined && t - gates[name] < f.gap && t >= gates[name]) return false;
      if (!bufs) { want(name, true, rate, k); return false; }
      for (i = 0; i < NV; i++) {                                          // a free voice, else the least important one nearest its end, if it matters no more than this
        v = VOX[i];
        if (v.end <= t) { if (free < 0) free = i; continue; }
        alive++; sc = v.pri * 100 + v.end - t;
        if (v.pri <= f.p && sc < bs) { bs = sc; best = i; }
      }
      if (free >= 0) best = free; else if (best < 0) { drops++; return false; }
      gates[name] = t; v = VOX[best]; nb = f.l2 ? bufs.length >> 1 : bufs.length;
      if (!(k >= 0)) k = nb > 1 ? (LASTV[fi] + 1 + (pr0() * (nb - 1) | 0)) % nb : 0;
      LASTV[fi] = k; if (f.l2 && L2) k += nb;                           // the second loop's louder copy
      pr = (rate || 1) * (f.cents ? Math.pow(2, (pr0() * 2 - 1) * f.cents / 1200) : 1);
      if (v.end > t) { steals++; alive--; at = t + 0.006; v.g.gain.setTargetAtTime(0, t, 0.0015); try { v.s.stop(at); } catch (e) {} }
      s = AC.createBufferSource(); s.buffer = bufs[k]; s.playbackRate.value = pr; s.connect(v.g); v.g.gain.setValueAtTime(1, at); s.start(at);
      v.s = s; v.end = at + bufs[k].duration / pr; v.pri = f.p;
      alive += 1 + (loopS ? 1 : 0) + (beamS ? 1 : 0); if (alive > vMax) vMax = alive;
      logSfx(fi, pr, k);
      return true;
    }
    function unhook() { try { this.__g.disconnect(); } catch (e) {} }     // a stopped drone takes its gain with it
    function droneOn(buf, t, lv, ramp) {                                  // a new drone on a gain of its own, its watchdog armed from the start
      var g = AC.createGain(), s = AC.createBufferSource();
      g.connect(bus); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + ramp); g.gain.setTargetAtTime(0, t + 0.5, 0.05);
      s.buffer = buf; s.loop = true; s.connect(g); s.__g = g; s.onended = unhook; s.start(t);
      return s;
    }
    function droneOff(s, t, tau, after) {                                 // let a drone go: its own gain fades, its source stops once that is inaudible
      var gn = s.__g.gain;
      gn.cancelScheduledValues(t); gn.setValueAtTime(gn.value, t); gn.setTargetAtTime(0, t, tau);
      try { s.stop(t + after); } catch (e) {}
    }
    function hum(name) {                                                  // every step the laser is held: start, switch or keep alive its drone
      if (!AC || !bus) return;
      var t = AC.currentTime, gn, lt, bufs, fresh;
      humN = stepN;
      if (loopName !== name) {
        bufs = BANK[name]; if (!bufs) { want(name, false); return; }     // not rendered yet: it starts the first step it is
        fresh = !loopS;
        if (loopS) droneOff(loopS, t, 0.008, 0.06);                       // a new colour mid-beam: a quick crossfade
        else if (t - loopT > 0.3) play('laserOn');
        loopS = droneOn(bufs[0], t, 1, fresh ? 0.04 : 0.012); loopG = loopS.__g; loopName = name; loopKick = t; arcT = 0;
        logSfx(FXI[name], 1);
      }
      loopT = t;
      if (name === 'laserB' && t >= arcT) { play('arcB'); arcT = t + 0.06 + pr0() * 0.16; }   // blue thunder: its arcs land at random, never in a pattern
      if (t - loopKick > 0.1) {                                           // the watchdog: no refresh for half a second of audio time and it goes quiet on its own
        lt = t - loopKick > 0.45; loopKick = t; gn = loopG.gain;
        gn.cancelScheduledValues(t); gn.setValueAtTime(lt ? gn.value : 1, t); if (lt) gn.linearRampToValueAtTime(1, t + 0.03);   // back from a stall: fade up, no click
        gn.setTargetAtTime(0, t + 0.5, 0.05);
      }
    }
    function beamSnd() {                                                  // every play step: the True Last Boss's lasers hum faintly while they charge and roar while they bite
      if (!AC || !bus) return;
      var lv = BEAM[2] ? 1 : BEAM[3] * 0.3, t = AC.currentTime, gn, bufs;
      beamN = stepN;
      if (!beamS) {
        if (lv < 0.01) return;
        bufs = BANK.beamHum; if (!bufs) { want('beamHum', false); return; }
        beamS = droneOn(bufs[0], t, lv, 0.05); beamG = beamS.__g; beamLv = lv; beamKick = t; logSfx(FXI.beamHum, lv); return;
      }
      if (lv < 0.01) { beamOff(t); return; }
      if (Math.abs(lv - beamLv) > 0.04 || t - beamKick > 0.1) {           // a new level, or the watchdog's refresh
        gn = beamG.gain; gn.cancelScheduledValues(t); gn.setValueAtTime(gn.value, t); gn.setTargetAtTime(lv, t, lv > beamLv ? 0.01 : 0.04); gn.setTargetAtTime(0, t + 0.5, 0.05);
        if (lv !== beamLv) logSfx(FXI.beamHum, lv);
        beamLv = lv; beamKick = t;
      }
    }
    function beamOff(t) { droneOff(beamS, t, 0.05, 0.4); beamS = beamG = null; beamLv = 0; logSfx(254, 0); }
    function hush(force) {                                                // at the top of every step: a drone the last step did not keep alive fades out
      stepN++;
      if (!AC) return;
      var t = AC.currentTime;
      if (loopS && (force || stepN - humN >= 2)) { droneOff(loopS, t, 0.015, 0.12); loopS = loopG = null; loopName = ''; logSfx(255, 0); }
      if (beamS && (force || stepN - beamN >= 2)) beamOff(t);
    }
    var sfx = {};
    (function () { FXN.forEach(function (k) { if (!FX[k].loop) sfx[k] = function (rate) { play(k, rate); }; }); })();
    sfx.medal = function () {                                             // a run of citations climbs the ladder, then trills on its top two rungs; a pause starts it again
      if (!AC) return;
      var t = AC.currentTime, top = LADDER.length - 1, k = t - medalT < 0.45 ? (medalN < top ? medalN + 1 : top - 1) : 0;
      if (play('medal', Math.pow(2, (pr0() * 2 - 1) * (k >= top - 1 ? 25 : 10) / 1200), k)) { medalN = k; medalT = t; }
    };

    /* ------------------------------------------------------------ pools (fixed capacity, nothing allocated while playing) */
    var NB = 800, bx = new Float32Array(NB), by = new Float32Array(NB), bvx = new Float32Array(NB), bvy = new Float32Array(NB),
      bt = new Uint8Array(NB), bal = new Uint8Array(NB), brot = new Uint8Array(NB), bCur = 0, bLive = 0;
    var BHIT = [2.2, 2.2, 4.2, 4.2, 1.9, 1.9];                      // far smaller than they look: that is the genre
    var NM = 320, mx = new Float32Array(NM), my = new Float32Array(NM), mvx = new Float32Array(NM), mvy = new Float32Array(NM), mal = new Uint8Array(NM), mmag = new Uint8Array(NM), mCur = 0;
    var NP = 420, px = new Float32Array(NP), py = new Float32Array(NP), pvx = new Float32Array(NP), pvy = new Float32Array(NP), pl = new Float32Array(NP), pml = new Float32Array(NP), pc = new Uint8Array(NP), ps = new Uint8Array(NP), pCur = 0;
    var PCOL = ['#ffffff', '#fcd34d', '#fb923c', '#e3625b', '#8ad4ff', '#a78bfa', '#34d399', '#9aa3b8', '#ff4fa3'];
    var NS = 140, sx_ = new Float32Array(NS), sy_ = new Float32Array(NS), svx = new Float32Array(NS), svy = new Float32Array(NS), sdm = new Float32Array(NS), sk = new Uint8Array(NS), sal = new Uint8Array(NS), sCur = 0;
    var NE = 64, EN = [], NK = 8, PK = [], NT = 20, TX = [], NR = 14, RG = [], NSP = 16, SP = [], i0;
    for (i0 = 0; i0 < NE; i0++) EN.push({ on: false, type: '', def: null, x: 0, y: 0, x0: 0, vx: 0, vy: 0, hp: 0, mhp: 0, t: 0, ft: 0, ft2: 0, ft3: 0, ft4: 0, a: 0, a2: 0, a3: 0, path: 0, ty: 0, stay: 0, flash: 0, drop: '', n: 0, phase: 0, boss: false, dying: 0, fired: 0, hw: 0, hh: 0, lt: 0, shut: 0, tl: null, snd: false });
    var L2 = false, BSP = 1, HPM = 1, SM = 1;                        // the second loop: bullet speed (per step), enemy HP and score multipliers (per game)
    var BEAM = new Float32Array(6);                                   // the True Last Boss's two lasers: [angle0, angle1, lethal, alpha, x, y]
    for (i0 = 0; i0 < NK; i0++) PK.push({ on: false, kind: '', x: 0, y: 0, vx: 0, vy: 0, t: 0 });
    for (i0 = 0; i0 < NT; i0++) TX.push({ on: false, s: '', x: 0, y: 0, life: 0, col: '#fff' });
    for (i0 = 0; i0 < NR; i0++) RG.push({ on: false, x: 0, y: 0, r: 0, vr: 0, life: 0, ml: 1, col: '#fff' });
    for (i0 = 0; i0 < NSP; i0++) SP.push({ on: false, type: '', x: 0, path: '', n: 0, gap: 0, dx: 0, drop: '', timer: 0, k: 0 });

    function fireB(x, y, ang, spd, type) {
      if (bLive >= NB || x < -6 || x > W + 6 || y < -6 || y > H * 0.8) return;       // nothing fires from off screen or from under your feet
      spd *= BSP;
      for (var n = 0; n < NB; n++) {
        var i = bCur; bCur = (bCur + 1) % NB;
        if (!bal[i]) { bal[i] = 1; bx[i] = x; by[i] = y; bvx[i] = Math.cos(ang) * spd; bvy[i] = Math.sin(ang) * spd; bt[i] = type; brot[i] = ((Math.round(ang / TAU * 16) % 16) + 16) % 16; bLive++; return; }
      }
    }
    function medal(x, y, mag) {
      for (var n = 0; n < NM; n++) { var i = mCur; mCur = (mCur + 1) % NM; if (!mal[i]) { mal[i] = 1; mx[i] = x; my[i] = y; mvx[i] = rnd(-30, 30); mvy[i] = rnd(-90, -30); mmag[i] = mag ? 1 : 0; return; } }
    }
    function spark(x, y, vx, vy, life, col, size) {
      var i = pCur; pCur = (pCur + 1) % NP;                                           // particles just overwrite the oldest
      px[i] = x; py[i] = y; pvx[i] = vx; pvy[i] = vy; pl[i] = life; pml[i] = life; pc[i] = col; ps[i] = size;
    }
    function ring(x, y, r, vr, life, col) { for (var i = 0; i < NR; i++) if (!RG[i].on) { var o = RG[i]; o.on = true; o.x = x; o.y = y; o.r = r; o.vr = vr; o.life = o.ml = life; o.col = col; return; } }
    function boom(x, y, size, quiet) {                                                  // size 1 popcorn .. 4 boss chunk; quiet: a bigger sound already covers it
      var n = 5 + size * 5, k, a, v;
      for (k = 0; k < n; k++) { a = Math.random() * TAU; v = rnd(20, 60 + size * 45); spark(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.25, 0.4 + size * 0.15), (Math.random() * 4) | 0, 1 + ((Math.random() * (1 + size)) | 0)); }
      ring(x, y, 3, 60 + size * 40, 0.25 + size * 0.06, size > 2 ? '#fff' : '#fcd34d');
      if (size > 2) G.shake = Math.max(G.shake, 0.35);
      if (quiet) return;
      if (G.mode === 'ending') sfx.firework(); else if (size > 2) sfx.bigBoom(); else if (size > 1) sfx.boom(); else sfx.pop();
    }
    function floatText(s, x, y, col) { for (var i = 0; i < NT; i++) if (!TX[i].on) { var o = TX[i]; o.on = true; o.s = s; o.x = clamp(x, 30, W - 30); o.y = y; o.life = 0.9; o.col = col || '#fff'; return; } }
    function cancelBullets(toMedals) {
      var n = 0;
      for (var i = 0; i < NB; i++) if (bal[i]) { bal[i] = 0; if (toMedals) { medal(bx[i], by[i], true); n++; } else spark(bx[i], by[i], 0, 0, 0.2, 4, 2); }
      bLive = 0; if (n > 3) sfx.cancel(); return n;
    }
    function clearPools() {
      var i; for (i = 0; i < NB; i++) bal[i] = 0; bLive = 0; for (i = 0; i < NM; i++) mal[i] = 0; for (i = 0; i < NP; i++) pl[i] = 0; for (i = 0; i < NS; i++) sal[i] = 0;
      for (i = 0; i < NE; i++) EN[i].on = false; for (i = 0; i < NK; i++) PK[i].on = false; for (i = 0; i < NT; i++) TX[i].on = false; for (i = 0; i < NR; i++) RG[i].on = false; for (i = 0; i < NSP; i++) SP[i].on = false;
    }

    /* patterns: angles are radians, 0 = right, PI/2 = straight down the screen */
    function aimAt(x, y) { return Math.atan2(P.y - y, P.x - x); }
    function fan(x, y, ang, n, spread, spd, type) { for (var k = 0; k < n; k++) fireB(x, y, ang + (n > 1 ? (k / (n - 1) - 0.5) * spread : 0), spd, type); }
    function circle(x, y, n, spd, off, type) { for (var k = 0; k < n; k++) fireB(x, y, off + k / n * TAU, spd, type); }
    function burst(x, y, ang, n, spd, step, type) { for (var k = 0; k < n; k++) fireB(x, y, ang, spd + k * step, type); }   // a line of bullets at staggered speeds
    function curtain(y, gapX, gapW, spd, type) { for (var x = 9; x < W; x += 18) if (Math.abs(x - gapX) > gapW / 2) fireB(x, y, Math.PI / 2, spd, type); }

    /* ------------------------------------------------------------ sprites (pixel art from strings and rectangles, rendered once) */
    var PAL = { k: '#11131c', w: '#f4f6fb', p: '#c9cedb', r: '#e3625b', R: '#9f2f2a', y: '#f2d16b', Y: '#c9a53f', s: '#f6d3b0', g: '#6f7787', G: '#4f5666', b: '#1f2430', c: '#8ad4ff', m: '#9aa3b8', M: '#5c6b85', d: '#2b303c', n: '#fcd34d', N: '#b88a1e' };
    function art(rows, mirror) {
      var h = rows.length, half = rows[0].length, w = mirror ? half * 2 - 1 : half, c = mk(w, h), x = c.getContext('2d');
      for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) { var ch = rows[j].charAt(mirror && i >= half ? w - 1 - i : i); if (PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); } }
      return c;
    }
    function R(x, col, a, b, w, h) { x.fillStyle = col; x.fillRect(a, b, w, h); }
    function whiten(src) { var c = mk(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return c; }
    function tint(src, col, alpha) { var c = mk(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = alpha; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; }
    var SPR = {}, WHT = {}, BS = [], SHIP = [], COVERS = [], GEAR = [], NEB = [], GIRDER = null, SKULL = [], ICON = {};

    function buildSprites() {
      var c, x, i, j, k;
      // the protagonist, prone on a rolled-up manuscript: blond hair, glasses at the leading edge, grey suit
      var ship = art([
        '........k', '.......kw', '.......kw', '......kww', '......kpw', '.....kpww', '....skrrr', '....gkpww', '....gkbcb',
        '....gkyyy', '....gkyyy', '....gkYyy', '...kgkYYY', '...kggggg', '...kggggg', '...kgGggg', '....kGggg', '....kGgGg',
        '..kmkGGGG', '.kmmkpddw', 'kmmMkpddw', 'kmMMkpddw', 'kkkkkpkkw', '....kpwww', '.....kkkk'], true);
      for (k = -1; k <= 1; k++) {
        c = mk(17, 25); x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        if (k === 0) x.drawImage(ship, 0, 0);
        else { x.drawImage(ship, 0, 0, 17, 25, 2, 0, 13, 25); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(8,10,30,.4)'; x.fillRect(k < 0 ? 0 : 9, 0, 8, 25); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(k < 0 ? 11 : 2, 0, 3, 25); }
        SHIP.push(c);
      }
      SPR.pen = art(['..kk', '.kRr', '.kRr', '.kRr', '.krr', '.krr', '.krr', '.krr', '.krr', '.krr', '.kmm', '.kmm', '.kpw', '.kpw', '..kw', '..kw', '...k', '...r'], true);
      SPR.staple = art(['kkkkkkk', 'kmmmmmm', 'kmMMMMM', 'kmk....', 'kmk....', 'kmk....', 'kkk....'], true);
      SPR.query = art(['..kkkkkkk..', '.knnnnnnnk.', 'knnkkkkknnk', 'knnk...knnk', 'kkkk...knnk', '......knnk.', '.....knnk..', '....knNk...', '....knNk...', '....kkkk...', '...........', '....kkkk...', '....knnk...', '....knNk...', '....kkkk...'], false);
      for (k = 0; k < 2; k++) {                                       // track-changes brackets: green insertion, red deletion
        c = mk(9, 20); x = c.getContext('2d'); if (k) { x.translate(9, 0); x.scale(-1, 1); }
        R(x, PAL.k, 0, 0, 5, 20); R(x, PAL.k, 0, 0, 9, 5); R(x, PAL.k, 0, 15, 9, 5);
        R(x, k ? '#ff6b7a' : '#34d399', 1, 1, 3, 18); R(x, k ? '#ff6b7a' : '#34d399', 1, 1, 7, 3); R(x, k ? '#ff6b7a' : '#34d399', 1, 16, 7, 3); R(x, k ? '#a82a3a' : '#1f8a60', 3, 4, 1, 12);
        SPR[k ? 'bracketR' : 'bracket'] = c;
      }
      c = mk(28, 23); x = c.getContext('2d');                           // comment bubble
      R(x, PAL.k, 1, 0, 26, 18); R(x, PAL.k, 0, 1, 28, 16); R(x, PAL.k, 6, 17, 6, 3); R(x, PAL.k, 7, 20, 4, 2); R(x, PAL.k, 8, 22, 2, 1);
      R(x, PAL.n, 2, 1, 24, 16); R(x, PAL.n, 1, 2, 26, 14); R(x, PAL.n, 7, 17, 4, 3); R(x, PAL.n, 8, 20, 2, 2); R(x, PAL.N, 2, 15, 24, 2);
      R(x, PAL.b, 4, 4, 20, 2); R(x, PAL.b, 4, 8, 15, 2); R(x, PAL.R, 4, 12, 18, 2);
      SPR.bubble = c;
      c = mk(20, 16); x = c.getContext('2d');                           // supplementary material: the box that carries pickups
      R(x, PAL.k, 0, 2, 20, 14); R(x, '#c99a6b', 1, 3, 18, 12); R(x, '#a87a4b', 1, 11, 18, 4); R(x, PAL.k, 0, 0, 20, 5); R(x, '#8a5a2b', 1, 1, 18, 3);
      R(x, PAL.w, 5, 7, 10, 5); R(x, PAL.m, 6, 8, 8, 1); R(x, PAL.m, 6, 10, 6, 1); R(x, PAL.c, 9, 1, 2, 2);
      SPR.box = c;
      c = mk(13, 13); x = c.getContext('2d');                           // article processing charge
      for (j = 0; j < 13; j++) for (i = 0; i < 13; i++) { var d = Math.hypot(i - 6, j - 6); if (d <= 6.3) R(x, d > 5.2 ? PAL.k : (i + j > 14 ? PAL.N : PAL.n), i, j, 1, 1); }
      ['..##.', '.#..#', '.#...', '###..', '.#...', '.#...', '#####'].forEach(function (row, jj) { for (var ii = 0; ii < 5; ii++) if (row.charAt(ii) === '#') R(x, '#6b4a08', 4 + ii, 3 + jj, 1, 1); });
      SPR.fee = c;
      c = mk(40, 20); x = c.getContext('2d'); R(x, PAL.k, 0, 0, 40, 20);  // paywall
      for (j = 0; j < 4; j++) for (i = -1; i < 5; i++) { var bxp = 1 + i * 10 + (j % 2) * 5; R(x, (i + j) % 2 ? '#b8503f' : '#a2443a', Math.max(1, bxp), 1 + j * 5, Math.min(9, 39 - Math.max(1, bxp)), 4); R(x, '#d0705f', Math.max(1, bxp), 1 + j * 5, Math.min(9, 39 - Math.max(1, bxp)), 1); }
      R(x, PAL.k, 16, 2, 8, 7); R(x, PAL.m, 17, 3, 6, 6); R(x, '#7a2e24', 19, 5, 2, 4); R(x, PAL.k, 14, 8, 12, 10); R(x, PAL.n, 15, 9, 10, 8); R(x, PAL.N, 15, 15, 10, 2); R(x, PAL.k, 19, 11, 2, 4);
      SPR.paywall = c;
      c = mk(34, 17); x = c.getContext('2d');                           // embargo satellite
      for (k = 0; k < 2; k++) { var ox = k ? 23 : 0; R(x, PAL.k, ox, 4, 11, 9); R(x, '#2f5fb0', ox + 1, 5, 9, 7); for (i = 0; i < 3; i++) R(x, '#60a5fa', ox + 1 + i * 3, 5, 1, 7); R(x, '#60a5fa', ox + 1, 8, 9, 1); }
      R(x, PAL.k, 11, 7, 12, 3); R(x, PAL.k, 12, 1, 10, 13); R(x, PAL.p, 13, 2, 8, 11); R(x, PAL.m, 13, 10, 8, 3); R(x, PAL.b, 14, 4, 6, 3); R(x, PAL.r, 16, 5, 2, 1); R(x, PAL.k, 15, 14, 4, 3); R(x, PAL.m, 16, 14, 2, 2);
      SPR.sat = c;
      c = mk(24, 30); x = c.getContext('2d');                           // galley proof
      R(x, PAL.k, 0, 0, 24, 30); R(x, PAL.w, 1, 1, 22, 28); R(x, PAL.p, 18, 1, 5, 5); R(x, PAL.k, 18, 1, 1, 6); R(x, PAL.k, 18, 6, 6, 1);
      for (i = 0; i < 8; i++) R(x, PAL.m, 3, 4 + i * 3, i % 3 === 2 ? 11 : 16, 1);
      R(x, PAL.r, 2, 9, 14, 1); R(x, PAL.r, 14, 14, 7, 1); R(x, PAL.r, 14, 18, 7, 1); R(x, PAL.r, 14, 14, 1, 5); R(x, PAL.r, 20, 14, 1, 5); R(x, PAL.r, 5, 23, 3, 3); R(x, PAL.r, 9, 24, 9, 1);
      SPR.proof = c;
      // THE TYPESETTER: a flying press
      c = mk(156, 88); x = c.getContext('2d');
      R(x, PAL.k, 8, 20, 140, 62); R(x, '#3b4252', 9, 21, 138, 60); R(x, PAL.M, 9, 21, 138, 4); R(x, PAL.d, 9, 72, 138, 9);
      R(x, PAL.k, 10, 5, 136, 17); R(x, PAL.M, 11, 6, 134, 15); R(x, PAL.k, 22, 3, 112, 20); R(x, PAL.m, 23, 4, 110, 18); R(x, '#d6dae6', 23, 7, 110, 3); R(x, PAL.M, 23, 18, 110, 4);
      R(x, PAL.k, 47, 0, 62, 15); R(x, PAL.w, 48, 0, 60, 14); for (i = 0; i < 4; i++) R(x, PAL.m, 52, 2 + i * 3, i === 3 ? 30 : 52, 1);
      R(x, PAL.k, 46, 26, 64, 24); R(x, '#0b0c14', 47, 27, 62, 22); for (i = 0; i < 12; i++) R(x, i % 2 ? PAL.m : PAL.p, 50 + i * 5, 29 + Math.round(Math.abs(i - 5.5) * 1.6), 2, 15);
      for (j = 0; j < 3; j++) for (i = 0; i < 12 - j; i++) { var kx = 14 + j * 5 + i * 11, ky = 52 + j * 7; if (kx > 42 && kx < 104 && j === 0) continue; R(x, PAL.k, kx, ky, 9, 6); R(x, '#f1e7c9', kx + 1, ky, 7, 4); R(x, '#b9ad8a', kx + 1, ky + 4, 7, 1); }
      for (k = 0; k < 2; k++) { ox = k ? 144 : 0; R(x, PAL.k, ox, 36, 12, 40); R(x, PAL.M, ox + 1, 37, 10, 38); R(x, PAL.m, ox + 1, 37, 3, 38); R(x, PAL.k, ox + 2, 70, 8, 6); R(x, PAL.r, ox + 3, 40, 6, 2); }
      for (i = 0; i < 8; i++) { R(x, PAL.m, 14 + i * 18, 76, 2, 2); }
      SPR.typesetter = c;
      androssBuild();                                                                // PEER REVIEW: the polygon face, its hands and the cube (see the block above the drawing section)
      for (k in SPR) if (SPR.hasOwnProperty(k)) WHT[k] = whiten(SPR[k]);
      // THE IMPACT FACTOR: a gear (steel, then furious red) and its orbiting journal covers
      for (k = 0; k < 2; k++) {
        c = mk(113, 113); x = c.getContext('2d');
        for (j = 0; j < 113; j++) for (i = 0; i < 113; i++) {
          var dx = i - 56, dy = j - 56, rr = Math.hypot(dx, dy), th = Math.atan2(dy, dx), lim = 45 + (Math.cos(th * 12) > 0.25 ? 9 : 0);
          if (rr > lim + 1 || rr < 25) continue;
          var col = rr > lim - 1 || rr < 27 ? PAL.k : rr > 40 ? (k ? '#c2413a' : PAL.M) : rr > 38 ? PAL.k : (Math.cos(th * 6) > 0.8 && rr > 30 && rr < 36) ? (k ? PAL.n : PAL.c) : (k ? '#7a1f24' : '#3b4252');
          if (col !== PAL.k && dx + dy < -30 && rr > 40) col = k ? '#e3625b' : PAL.m;
          R(x, col, i, j, 1, 1);
        }
        GEAR.push(c);
      }
      GEAR.push(whiten(GEAR[0]));
      ['#e3625b', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#2dd4bf'].forEach(function (col) {
        var cc = mk(18, 24), xx = cc.getContext('2d'); R(xx, PAL.k, 0, 0, 18, 24); R(xx, col, 1, 1, 16, 22); R(xx, PAL.w, 2, 2, 14, 4); R(xx, PAL.k, 3, 3, 9, 2);
        R(xx, 'rgba(255,255,255,.45)', 3, 8, 12, 9); R(xx, 'rgba(0,0,0,.35)', 5, 10, 8, 5); R(xx, PAL.w, 3, 19, 12, 1); R(xx, PAL.w, 3, 21, 8, 1); COVERS.push(cc);
      });
      // enemy bullets: dark outline, colour, white core. two brightness frames; needles in 16 rotations
      var BC = [['#ff4fa3', '#ff9ccc'], ['#4aa8ff', '#a5d6ff']];
      for (k = 0; k < 6; k++) {
        var set = [], colr = BC[k % 2], big = k === 2 || k === 3, needle = k > 3, rad = big ? 7 : 4, f, sz = needle ? 15 : rad * 2 + 1;
        for (f = 0; f < (needle ? 16 : 2); f++) {
          c = mk(sz, sz); x = c.getContext('2d'); var ca = Math.cos(f / 16 * TAU), sa = Math.sin(f / 16 * TAU);
          for (j = 0; j < sz; j++) for (i = 0; i < sz; i++) {
            var dd;
            if (needle) { var ux = (i - 7) * ca + (j - 7) * sa, vx = -(i - 7) * sa + (j - 7) * ca, cu = clamp(ux, -4, 4); dd = Math.hypot(ux - cu, vx) / 2.9; }
            else dd = Math.hypot(i - rad, j - rad) / (rad + 0.3);
            if (dd <= 1) R(x, dd < (needle ? 0.36 : 0.45) ? '#fff' : dd < (needle ? 0.7 : 0.78) ? colr[needle ? 0 : f] : '#1a0a22', i, j, 1, 1);
          }
          set.push(c);
        }
        BS.push(set);
      }
      // the Truxton skull, bone and ember
      var skull = art(['....kkkk', '..kkwwww', '.kwwwwww', '.kwwwwww', 'kwwwwwww', 'kwwkkkww', 'kwkkrkkw', 'kwkkkkkw', 'kwwkkkww', 'kpwwwwwk', '.kpwwwkk', '.kppwwww', '..kwkwkw', '..kwkwkw', '..kpwpwp', '...kkkkk'], true);
      SKULL = [skull, tint(skull, '#fb923c', 0.55), tint(skull, '#e3625b', 0.6)];
      ICON.life = art(['.kkkk', 'kyyyy', 'kyyyy', 'kbcbc', 'kssss', '.kggg', '.kkkk'], true);
      ICON.bomb = art(['.kkkk', 'kwwww', 'kwkkw', 'kwkkw', 'kwwwk', '.kwkw', '.kkkk'], true);
      ICON.cite = art(['.kkk', 'knnn', 'knNn', 'knnn', '.kkk'], true);
      // background: chunky nebulae (rendered at quarter size), a girder tile
      for (k = 0; k < 2; k++) {
        c = mk(90, 128); x = c.getContext('2d');
        var cols = k ? ['rgba(190,60,140,', 'rgba(250,120,80,', 'rgba(110,60,200,'] : ['rgba(70,60,190,', 'rgba(40,140,170,', 'rgba(150,70,190,'];
        for (i = 0; i < 9; i++) {
          var nx = rnd(0, 90), ny = rnd(0, 128), nr = rnd(14, 34), cl = cols[i % 3];
          for (j = -1; j <= 1; j++) { var gr = x.createRadialGradient(nx, ny + j * 128, 1, nx, ny + j * 128, nr); gr.addColorStop(0, cl + '.30)'); gr.addColorStop(0.6, cl + '.12)'); gr.addColorStop(1, cl + '0)'); x.fillStyle = gr; x.fillRect(0, 0, 90, 128); }
        }
        NEB.push(c);
      }
      c = mk(40, 64); x = c.getContext('2d'); R(x, '#141a2c', 0, 0, 6, 64); R(x, '#141a2c', 34, 0, 6, 64); R(x, '#232c48', 0, 0, 2, 64); R(x, '#232c48', 34, 0, 2, 64);
      for (i = 0; i < 28; i++) { R(x, '#1a2138', 6 + i, i * 2 + 2, 3, 3); R(x, '#1a2138', 31 - i, 32 + i + (i > 27 ? 0 : 0), 3, 2); }
      R(x, '#232c48', 0, 0, 40, 3); R(x, '#232c48', 0, 32, 40, 3); R(x, '#2f3a5c', 2, 1, 2, 1); R(x, '#2f3a5c', 36, 1, 2, 1); R(x, '#2f3a5c', 2, 33, 2, 1); R(x, '#2f3a5c', 36, 33, 2, 1);
      GIRDER = c;
    }

    /* ------------------------------------------------------------ state */
    var G = null;
    var P = { x: 180, y: 400, inv: 0, dead: 0, bank: 0, holdT: 0, shotT: 0, cd: 0, laser: false, top: -10, bombT: 0, bombX: 0, bombY: 0, contact: 0, flame: 0, nLock: 0 };
    var keys = { l: false, r: false, u: false, d: false, fire: false, focus: false }, touch = { on: false, id: -1, lx: 0, ly: 0, count: 0, t0: 0 };
    var lockI = new Int8Array(5), lockD = new Float32Array(5);
    var WEAP = [{ name: 'RED POWER SHOT', col: '#ff5a4a' }, { name: 'BLUE THUNDER', col: '#5ab8ff' }, { name: 'GREEN SNIPER', col: '#4ade80' }];
    var hiSaved = 0;
    function saveHi() {                                                   // the bezel advertises a hi-score all game, so bank it as it happens
      if (!G || JUMP === 'ending') return;                                // the dev jump fakes a score: never let it poison a real one
      if (!(G.hi > hiSaved)) return;
      hiSaved = G.hi;
      try { localStorage.setItem('quest.shmup.hi', String(G.hi)); } catch (e) {}
    }
    function startLives() { return api.params && api.params.cheat ? 50 : 3; }   // the level select's cheat: fifty ships, and fifty again after a continue
    // An honest clear of the first loop is counted (quest.clears: groundwork for a later feature; restart() and
    // startLoop2() leave it alone). Not counted: the level-select cheat or a warp, and any test hook that skips or spares.
    function countClear() {
      var p = api.params || {};
      if (L2 || JUMP || GOD || DBG || botOn || p.cheat || p.warp || p.god || p.shmup || p.endgame) return;
      try { localStorage.setItem('quest.clears', String((parseInt(localStorage.getItem('quest.clears'), 10) || 0) + 1)); } catch (e) {}
    }
    function newGame(loop) {
      var stored = 0; try { stored = parseInt(localStorage.getItem('quest.shmup.hi'), 10) || 0; } catch (e) {}
      hiSaved = stored; var hi = Math.max(158000, stored);
      L2 = loop === 2 || JUMP === 'tlb'; HPM = L2 ? 1.3 : 1; SM = L2 ? 2 : 1; BSP = 1; BEAM[2] = BEAM[3] = 0;
      G = { mode: 'play', t: 0, loop: L2 ? 2 : 1, stage: 1, st: 0, si: 0, script: null, hold: false, score: 0, hi: hi, lives: startLives(), bombs: 3, chain: 0, maxChain: 0, gauge: 0, cites: 0, continues: 0, kills: 0,
        weapon: 0, level: 1, speed: 0, extend: 0, paused: false, wipe: 0, flash: 1, shake: 0, cardT: 0, cardDur: 1, cardTitle: '', cardSub: '', warnT: 0, warnKind: 1, boss: null, contT: 0,
        who: '', say: '', sayT: 0, sayN: 0, endT: 0, scroll: 0, girderY: -200, girderSide: 0, girderOn: false, tauntT: 0, tauntI: 0, rank: 0, tlb: false, tlbLv: 1, ghosts: 0, bPeak: 0, revenge: 0, rankQ: 0 };
      G.script = scriptFor(1);
      clearPools(); P.x = W / 2; P.y = H + 30; P.inv = 3; P.dead = 0; P.bombT = 0; P.holdT = 0; P.shotT = 0; P.laser = false;
    }
    function addScore(n) {
      G.score += n; if (G.score > G.hi) G.hi = G.score;
      if (G.extend < 2 && G.score >= (G.extend ? 1500000 : 400000) * SM) { G.extend++; G.lives++; sfx.extend(); floatText('EXTEND!', P.x, P.y - 30, '#34d399'); }
    }
    function mult() { return 1 + Math.min(G.chain, 600) / 20; }
    function chainUp(n) { G.chain += n; G.gauge = 1; if (G.chain > G.maxChain) G.maxChain = G.chain; }
    function chainBreak() { if (G.chain >= 10) { sfx.chainBreak(); floatText('CHAIN LOST', P.x, P.y - 24, '#ff6b7a'); } G.chain = 0; G.gauge = 0; }
    function say(who, text) { G.who = who; G.say = text; G.sayLines = wrap(text, 34); G.sayT = 5.5; G.sayN = 0; }
    function card(title, sub, dur) { G.cardTitle = title; G.cardSub = sub || ''; G.cardT = G.cardDur = dur || 3; }
    function hasTrack(n) { try { return !!(window.Riff && Riff.has && Riff.has(n)); } catch (e) { return false; } }
    function stageMusic() { return L2 && hasTrack('space2') ? 'space2' : 'space'; }          // riff2.js may or may not have registered the loop-2 tracks
    function bossMusic() { return G.tlb && hasTrack('tlb') ? 'tlb' : stageMusic(); }

    /* ------------------------------------------------------------ player */
    function playerShot(x, y, vx, vy, dmg, kind) {
      for (var n = 0; n < NS; n++) { var i = sCur; sCur = (sCur + 1) % NS; if (!sal[i]) { sal[i] = 1; sx_[i] = x; sy_[i] = y; svx[i] = vx; svy[i] = vy; sdm[i] = dmg; sk[i] = kind; return; } }
    }
    function fireShot() {
      var L = G.level, k, n, a;
      if (G.weapon === 0) { n = 1 + L * 2; for (k = 0; k < n; k++) { a = -Math.PI / 2 + (k / (n - 1) - 0.5) * (0.2 + L * 0.2); playerShot(P.x, P.y - 12, Math.cos(a) * 540, Math.sin(a) * 540, 1, 0); } P.cd = 0.085; }
      else if (G.weapon === 1) { n = 1 + L; for (k = 0; k < n; k++) { a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 0.5; playerShot(P.x + (k - (n - 1) / 2) * 5, P.y - 10, Math.cos(a) * 480, Math.sin(a) * 480, 1.2, 1); } P.cd = 0.1; }
      else { n = L < 3 ? 2 : L; for (k = 0; k < n; k++) playerShot(P.x + (k - (n - 1) / 2) * 7, P.y - 12, 0, -720, 0, 2); P.cd = 0.065; }
      play(SHOTS[G.weapon]);
    }
    function fireLaser(dt) {
      var L = G.level - 1, i, e, hitAny = false, lit = false, hw, dps;
      P.top = -10; P.nLock = 0;
      if (G.weapon === 0) {                                             // DoDonPachi beam: stops at the first thing it meets
        hw = [5, 6, 7, 9][L]; dps = [64, 84, 106, 130][L]; var best = null, bb = -1e9;
        for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && e.y < P.y && Math.abs(e.x - P.x) < e.hw + hw && e.y + e.hh > bb && e.y > -e.hh) { bb = e.y + e.hh; best = e; } }
        if (best) { lit = true; P.top = Math.min(P.y - 14, bb - 2); hurt(best, dps * dt, true); hitAny = best.mhp >= 36; if (Math.random() < dt * 40) spark(P.x + rnd(-hw, hw), P.top, rnd(-80, 80), rnd(20, 120), 0.25, 2, 2); }
      } else if (G.weapon === 2) {                                      // sniper beam: goes through everything
        hw = [3, 3, 4, 5][L]; dps = [48, 62, 78, 96][L];
        for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && e.y - e.hh < P.y && Math.abs(e.x - P.x) < e.hw + hw && e.y > -e.hh) { lit = true; hurt(e, dps * dt, true); if (e.mhp >= 36) hitAny = true; if (Math.random() < dt * 25) spark(P.x, e.y + e.hh, rnd(-90, 90), rnd(-20, 60), 0.2, 6, 2); } }
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
        P.nLock = n; lit = n > 0; dps = [60, 78, 96, 116][L] / Math.sqrt(n || 1);
        for (j = 0; j < n; j++) { e = EN[lockI[j]]; hurt(e, dps * dt, true); if (e.on && e.mhp >= 36) hitAny = true; if (Math.random() < dt * 20) spark(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), rnd(-60, 60), rnd(-60, 60), 0.2, 4, 2); }
      }
      for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && Math.abs(e.x - P.x) < e.hw + 16 && Math.abs(e.y - P.y) < e.hh + 18) hurt(e, 45 * dt, true); }   // the aura bites too
      if (hitAny) { if (G.chain > 0) G.gauge = Math.max(G.gauge, 0.5); P.contact += dt; if (P.contact > 0.22) { P.contact = 0; chainUp(1); addScore(10 * Math.round(mult()) * SM); } }
      hum(LASERS[G.weapon]); if (lit) sfx.laserHit();
    }
    function useBomb() {
      if (!G || G.mode !== 'play' || G.paused || G.bombs <= 0 || P.bombT > 0 || P.dead > 0) return;
      G.bombs--; P.bombT = 1.9; P.bombX = P.x; P.bombY = P.y - 10; P.inv = Math.max(P.inv, 3); G.shake = 1; G.flash = Math.max(G.flash, 0.7);
      sfx.bomb(); cancelBullets(true);
    }
    function killPlayer() {
      if (P.inv > 0 || P.dead > 0 || P.bombT > 0 || G.mode !== 'play') return;
      if (GOD) { G.ghosts++; P.inv = 1; return; }                                  // god mode counts the death it would have been, then a second's grace
      boom(P.x, P.y, 3, true); ring(P.x, P.y, 4, 260, 0.5, '#8ad4ff'); sfx.death(); cancelBullets(false); chainBreak();
      G.lives--; G.shake = 0.8; P.dead = 1.3; P.laser = false; G.rank = Math.max(0, G.rank - 0.3);
      if (G.level > 1) { G.level--; pickup('P', P.x, P.y - 10); }
      if (G.lives < 0) { G.lives = 0; G.mode = 'continue'; G.contT = 9.99; P.dead = 1e9; }
      saveHi();
    }
    function respawn() { P.x = W / 2; P.y = H + 24; P.inv = 3; P.dead = 0; P.holdT = 0; G.bombs = Math.max(G.bombs, 3); }
    function updatePlayer(dt) {
      if (P.inv > 0) P.inv -= dt;
      if (P.bombT > 0) updateBomb(dt);
      if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) { respawn(); sfx.respawn(); } return; }
      if (botOn) botThink();
      var firing = keys.fire || touch.on;
      if (firing) P.holdT += dt; else P.holdT = 0;
      if (P.shotT > 0) P.shotT -= dt;
      P.laser = touch.on || (keys.fire && P.holdT > 0.2);
      var ix = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), iy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), sp = (152 + G.speed * 26) * ((P.laser || keys.focus) ? 0.5 : 1);
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
      var s = '', c = '#fff', snd = 'power', r = 1;
      if (o.kind === 'W') { var w = Math.floor(o.t / 1.1) % 3; c = WEAP[w].col; if (w === G.weapon) { if (G.level < 4) { G.level++; s = 'POWER UP'; } else { addScore(5000); s = '5000'; snd = 'bonus'; } } else { G.weapon = w; s = WEAP[w].name; snd = 'weapon'; r = [1, 1.26, 1.5][w]; } }
      else if (o.kind === 'P') { c = '#fb923c'; if (G.level < 4) { G.level++; s = 'POWER UP'; } else { addScore(5000); s = '5000'; snd = 'bonus'; } }
      else if (o.kind === 'S') { c = '#8ad4ff'; snd = 'speed'; if (G.speed < 3) { G.speed++; s = 'SPEED UP'; } else { addScore(3000); s = '3000'; snd = 'bonus'; } }
      else if (o.kind === 'B') { snd = 'bombUp'; if (G.bombs < 6) { G.bombs++; s = 'BOMB +1'; } else { addScore(5000); s = '5000'; snd = 'bonus'; } }
      else { G.lives++; s = '1UP'; c = '#34d399'; snd = 'extend'; }
      if (snd === 'power') r = Math.pow(2, (G.level - 2) / 6);            // each power level a whole tone higher; a colour change is R, B, G up a major triad
      o.on = false; play(snd, r); floatText(s, o.x, o.y - 10, c); ring(o.x, o.y, 4, 120, 0.3, c);
    }
    function updateItems(dt) {
      var i, o, d, dx, dy, alive = P.dead <= 0 && G.mode === 'play';
      for (i = 0; i < NK; i++) {
        o = PK[i]; if (!o.on) continue;
        o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.x < 12) { o.x = 12; o.vx = -o.vx; } if (o.x > W - 12) { o.x = W - 12; o.vx = -o.vx; }
        if (o.t < 9 && o.y > H * 0.82) o.vy = -Math.abs(o.vy); if (o.y < 40 && o.vy < 0) o.vy = Math.abs(o.vy);
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
        if (alive && d < 13) { mal[i] = 0; G.cites++; addScore(Math.min(2000, 100 * (1 + Math.floor(G.chain / 25))) * SM); sfx.medal(); }
      }
    }

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
        taunts2: ['WE HAVE SEEN THIS MANUSCRIPT BEFORE. IT HAS NOT IMPROVED.', 'YOUR FIGURES ARE STILL 72 DPI.', 'THE KERNING IS PERSONAL NOW.', 'PLEASE SEE THE AUTHOR QUERIES. ALL 428 OF THEM.', 'WIDOWS. ORPHANS. RIVERS. EVERYWHERE.'],
        breaks: ['FULLY JUSTIFIED. MIND THE GAPS.'], last: 'ERROR: FONT NOT EMBEDDED...' },
      impact: { name: 'THE IMPACT FACTOR', hp: 1700, hw: 40, hh: 40, score: 100000, cit: 60, boss: true, phases: [1700, 1800, 2400],
        taunts: ['OF INTEREST ONLY TO SPECIALISTS.', 'WE RECEIVE MANY MORE SUBMISSIONS THAN WE CAN PUBLISH.', 'HAVE YOU CONSIDERED OUR SISTER JOURNAL?', 'I AM A RATIO. YOU CANNOT KILL A RATIO.', 'TWO YEARS. THAT IS ALL YOU GET.'],
        taunts2: ['YOUR LAST PAPER HAS TWO CITATIONS. BOTH ARE YOURS.', 'I HAVE BEEN RECALCULATED. UPWARDS.', 'OF INTEREST ONLY TO SPECIALISTS. STILL.', 'I AM A RATIO. YOU CANNOT KILL A RATIO TWICE.', 'HAVE YOU CONSIDERED A DIFFERENT CAREER?'],
        breaks: ['SELF-CITATION ENGAGED.', 'ENOUGH. BEHOLD MY TRUE DENOMINATOR.'], last: 'BUT... MY... QUARTILE...' },
      // the True Last Boss (type 'hive' for historical reasons; drawn as a polygon face, two hands and a cube, see drawAndross). Its HP is tuned absolutely (HPM leaves it alone); loop 2's bullet speed and rank drive it like everything else
      hive: { name: 'PEER REVIEW', hp: 2200, hw: 64, hh: 46, score: 500000, cit: 120, boss: true, tlb: true, phases: [2200, 2000, 2100, 2100, 1500],
        taunts: ['WE ARE MANY. WE ARE ANONYMOUS. WE HAVE NOT READ IT.', 'REVIEWER 2 HAS CONCERNS. REVIEWER 2 IS ALL OF US.', 'THE SAMPLE SIZE IS INSUFFICIENT. THE SAMPLE IS YOU.', 'PLEASE ADDRESS OUR CONCERNS. WE WILL NOT SAY WHICH.', 'MAJOR REVISIONS. THEN MAJOR REVISIONS.'],
        breaks: ['REJECT. REJECT. REJECT.', 'CITE US.', 'YOUR RESPONSE TO REVIEWERS HAS BEEN NOTED.', 'WE HAVE NOW READ THE ABSTRACT.'], last: 'ACCEPT... REVIEWER 2 DISSENTING...' }
    };
    function spawnEnemy(type, x, path, drop, ty) {
      for (var i = 0; i < NE; i++) {
        var e = EN[i]; if (e.on) continue;
        var d = ET[type]; e.on = true; e.type = type; e.def = d; e.boss = !!d.boss; e.hp = e.mhp = d.hp * (d.tlb ? 1 : HPM); e.hw = d.hw; e.hh = d.hh;
        e.path = path || 'down'; e.x = e.x0 = x; e.y = -d.hh - 4; e.ty = ty || 90; e.vx = 0; e.vy = 0; e.t = 0; e.flash = 0; e.drop = drop || ''; e.phase = 0; e.dying = 0; e.lt = 0; e.fired = 0; e.shut = 0; e.snd = false;
        e.ft = rnd(0.5, 1.1); e.ft2 = rnd(1.2, 2); e.ft3 = 2; e.ft4 = 1; e.a = Math.random() * TAU; e.a2 = W / 2; e.a3 = 0; e.n = i; e.stay = type === 'sat' ? 9 : 6.5; e.tl = L2 && d.taunts2 ? d.taunts2 : d.taunts;
        if (path === 'arcR') { e.x = -14; e.y = e.ty; } else if (path === 'arcL') { e.x = W + 14; e.y = e.ty; }
        if (e.boss) { e.y = -d.hh - 10; e.ty = type === 'impact' ? 118 : type === 'hive' ? 96 : 84; e.a = 0; e.ft = 1; }
        return e;
      }
      return null;
    }
    function hurt(e, d, fromLaser) {
      if (!e.on || e.dying > 0) return;
      if (e.boss && (e.y < e.ty - 1 || e.lt > 0 || e.shut > 0)) { if (!fromLaser && P.bombT <= 0) sfx.deflect(); return; }   // no damage while it makes its entrance, catches its breath or seals its core
      e.hp -= d; e.flash = 0.05; if (!fromLaser && P.bombT <= 0) { if (e.boss) sfx.hitHard(); else sfx.hit(); }            // under a bomb, the bomb is the sound
      if (e.hp > 0) return;
      if (e.boss && e.phase < e.def.phases.length - 1) {
        e.phase++; e.hp = e.mhp = e.def.phases[e.phase] * (e.def.tlb ? 1 : HPM); e.lt = 1.8; e.ft = 0.6; e.ft2 = 1.5; e.ft3 = 2.5; e.ft4 = 1.2; e.a = 0; e.shut = 0; BEAM[2] = BEAM[3] = 0;
        var n = cancelBullets(true); addScore((Math.round(10000 * mult() / 10) * 10 + n * 100) * SM); chainUp(10);
        boom(e.x, e.y, 4, true); boom(e.x - 30, e.y + 10, 3, true); boom(e.x + 30, e.y - 6, 3, true); G.shake = 0.7; G.flash = Math.max(G.flash, 0.5); sfx.phaseBreak();
        floatText('PHASE BREAK', e.x, e.y + e.hh + 14, '#fcd34d'); say(e.def.name, e.def.breaks[e.phase - 1] || '...');
        if ((e.type === 'impact' && e.phase === 2) || e.type === 'hive') for (var k = 0; k < 6; k++) boom(e.x + Math.cos(k / 6 * TAU) * 80, e.y + Math.sin(k / 6 * TAU) * 80, 3, true);
        return;
      }
      if (e.boss) { e.dying = e.type === 'hive' ? 6 : e.type === 'impact' ? 4.2 : 2.6; e.hp = 0; cancelBullets(true); BEAM[2] = BEAM[3] = 0; say(e.def.name, e.def.last); api.music('silence'); sfx.bossBreak(); return; }
      kill(e);
    }
    function kill(e) {
      var d = e.def, k, s = Math.round(d.score * mult() * SM / 10) * 10;
      e.on = false; G.kills++; chainUp(1); addScore(s);
      if (L2 && P.dead <= 0 && e.y < P.y - 24 && Math.abs(e.x - P.x) + Math.abs(e.y - P.y) > 48) {   // ura mode: the dead take a shot at you, more of them as the chain and the rank grow
        var a = aimAt(e.x, e.y), x = G.chain >= 250 ? 2 : G.chain >= 100 ? 1 : 0; G.revenge++; sfx.revenge();
        if (G.rank > 0.7) x++;
        if (d.hp >= 10) { fireB(e.x, e.y, a, 150, 4); fan(e.x, e.y, a, 2 + x, 0.3 + x * 0.1, 128, 0); }
        else fan(e.x, e.y, a, 1 + x, 0.1 * x, 150, 4);
      }
      boom(e.x, e.y, d.hp > 30 ? 3 : d.hp > 8 ? 2 : 1);
      for (k = 0; k < d.cit; k++) medal(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), false);
      if (d.hp >= 10) floatText(String(s), e.x, e.y, '#fcd34d');
      if (e.drop) pickup(e.drop, e.x, e.y);
    }
    function enemyFire(e, dt) {
      e.ft -= dt; e.ft2 -= dt;
      if (e.y < 10 || e.y > H * 0.62 || P.dead > 0) return;
      var t = e.type, hard = G.stage > 1 || L2 ? 1 : 0, close = Math.abs(e.x - P.x) + Math.abs(e.y - P.y) < 70, a = aimAt(e.x, e.y);
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
      enemyFire(e, L2 ? dt * (1.15 + 0.2 * G.rank) : dt);                        // ura: everything reloads faster, faster still as the rank climbs
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
          e.on = false; G.boss = null; G.shake = 1.2; G.flash = 1; addScore(Math.round(e.def.score * mult() * SM / 10) * 10); chainUp(20);
          for (k = 0; k < 10; k++) boom(e.x + rnd(-e.hw, e.hw), e.y + rnd(-e.hh, e.hh), 4, true);
          sfx.bossDie();
          for (k = 0; k < e.def.cit; k++) medal(e.x + rnd(-60, 60), e.y + rnd(-40, 40), true);
          if (e.type === 'hive' || (e.type === 'impact' && !L2)) { G.mode = 'outro'; G.endT = 0; api.stinger('victory'); }
          else if (e.type === 'impact') tlbWarning();                              // the second loop is not over. it has a True Last Boss
          else { G.hold = false; api.music(stageMusic()); }
        }
        return;
      }
      if (e.y < e.ty) { e.y = Math.min(e.ty, e.y + 42 * dt); return; }
      var amp = e.type === 'typesetter' ? 62 : e.type === 'hive' ? 34 : e.phase === 2 ? 70 : 36;
      e.x += (W / 2 + Math.sin(e.t * (e.type === 'hive' ? 0.3 : e.phase === 2 ? 0.45 : 0.55)) * amp - e.x) * Math.min(1, dt * 2);
      e.a2 += dt * (e.type === 'impact' ? (e.phase === 1 ? -1.1 : 0.8) : 0);
      if (Math.abs(e.x - P.x) < e.hw * 0.8 && Math.abs(e.y - P.y) < e.hh * 0.8) killPlayer();
      G.tauntT -= dt; if (G.tauntT <= 0) { G.tauntT = 10; say(e.def.name, e.tl[G.tauntI++ % e.tl.length]); }
      if (e.lt > 0) { e.lt -= dt; return; }
      if (P.dead > 0) return;
      var fdt = L2 ? dt * (1.25 + 0.2 * G.rank) : dt;                          // ura: tighter timings, tighter still as the rank climbs
      e.ft -= fdt; e.ft2 -= fdt; e.ft3 -= fdt; e.ft4 -= fdt; e.a += dt;
      if (e.type === 'hive') { updateHive(e, dt); return; }
      if (e.type === 'typesetter') {
        if (e.phase === 0) {
          var cyc = e.a % 6.6, cr = cyc >= 3.2 && cyc < 6.2;
          if (cr && !e.snd) sfx.ding(); e.snd = cr;
          if (cyc < 3.2) { if (e.ft <= 0) { e.ft = 0.52; e.fired++; var cx = e.x + (e.fired % 2 ? -72 : 72); fan(cx, e.y + 34, aimAt(cx, e.y + 34), 3, 0.4, 116, 4); } }
          else if (cyc < 6.2 && e.ft2 <= 0) {                                       // the carriage return: a broken line swept across the page
            e.ft2 = 0.07; e.fired++;
            if (e.fired % 8 < 5) fireB(e.x, e.y + 20, Math.PI * (0.14 + 0.72 * (0.5 - 0.5 * Math.cos((cyc - 3.2) / 3 * TAU))), 96, 1);
          }
          if (L2 && e.ft4 <= 0) { e.ft4 = 1.15; burst(e.x, e.y + 30, aimAt(e.x, e.y + 30), 3, 125, 24, 5); }   // ura: needles under the fans
        } else {
          if (e.ft <= 0) { e.ft = 1.5; e.a2 = clamp(e.a2 + rnd(-78, 78), 42, W - 42); curtain(e.y + 40, e.a2, 60, 56, 0); ring(e.a2, e.y + 40, 4, 80, 0.3, '#34d399'); }
          if (e.ft2 <= 0) { e.ft2 = 2.4; burst(e.x, e.y + 26, aimAt(e.x, e.y + 26), 3, 118, 22, 5); }
          if (e.ft3 <= 0) { e.ft3 = 3.3; circle(e.x, e.y + 10, 8, 46, Math.random() * TAU, 3); }
          if (L2 && e.ft4 <= 0) { e.ft4 = 0.95; fan(e.x, e.y + 30, aimAt(e.x, e.y + 30), 2, 0.3, 135, 4); }
        }
        return;
      }
      if (e.phase === 0) {                                                          // journal rankings
        if (e.ft <= 0) { e.ft = 0.55; coverPos(e, e.fired++ % 6, tmpPos); burst(tmpPos.x, tmpPos.y, aimAt(tmpPos.x, tmpPos.y), 3, 110, 18, 4); }
        if (e.ft2 <= 0) { e.ft2 = 1.9; e.n++; circle(e.x, e.y, 16, 58, e.n * 0.2, e.n % 2); }
        if (L2 && e.ft4 <= 0) { e.ft4 = 1; burst(e.x, e.y + 20, aimAt(e.x, e.y + 20), 3, 120, 22, 5); }   // ura: needles under the rings
      } else if (e.phase === 1) {                                                   // citation cartel: two spirals, turning against each other
        if (e.ft <= 0) { e.ft = 0.115; for (k = 0; k < 3; k++) { fireB(e.x, e.y, e.a * 1.15 + k * TAU / 3, 68, 1); fireB(e.x, e.y, -e.a * 1.5 + k * TAU / 3, 92, 0); } }
        if (e.ft2 <= 0) { e.ft2 = 2.7; fan(e.x, e.y + 20, aimAt(e.x, e.y + 20), 5, 0.9, 84, 2); }
        if (L2 && e.ft4 <= 0) { e.ft4 = 0.85; fan(e.x, e.y + 20, aimAt(e.x, e.y + 20), 3, 0.36, 128, 4); }
      } else {                                                                      // true form. sorry.
        if (e.ft <= 0) { e.ft = 0.085; e.vx += 0.2 + 0.17 * Math.sin(e.a * 0.9); for (k = 0; k < 4; k++) fireB(e.x, e.y, e.vx + k * TAU / 4, 78, 0); e.fired++; if (e.fired % 2 === 0) for (k = 0; k < 4; k++) fireB(e.x, e.y, -e.vx * 0.6 + k * TAU / 4 + 0.4, 54, 1); }
        if (e.ft2 <= 0) { e.ft2 = 2.3; circle(e.x, e.y, 10, 44, Math.random() * TAU, 3); }
        if (e.ft3 <= 0) { e.ft3 = 1.5; burst(e.x, e.y + 24, aimAt(e.x, e.y + 24), 2, 160, 24, 4); }
        if (L2 && e.ft4 <= 0) { e.ft4 = 0.7; burst(e.x, e.y + 24, aimAt(e.x, e.y + 24), 2, 150, 30, 5); }
      }
    }
    function tlbWarning() {                                                        // THE IMPACT FACTOR was not the end of it
      if (!G.tlb) G.tlbLv = G.level;                                               // the power you brought, which the checkpoint hands back
      G.tlb = true; G.hold = true; G.warnT = 5.6; G.warnKind = 2; G.boss = null;
      if (!api.stinger('tlbwarn')) sfx.klaxon();
      api.music('silence');
    }
    /* PEER REVIEW. Five phases, each a Hibachi pattern made readable: every one leaves a path, and the bot test in .dev proves it */
    function beamHit() {                                                           // is the ship inside either laser?
      if (BEAM[2] < 1) return false;
      for (var k = 0; k < 2; k++) {
        var ux = Math.cos(BEAM[k]), uy = Math.sin(BEAM[k]), dx = P.x - BEAM[4], dy = P.y - BEAM[5];
        if (dx * ux + dy * uy > 0 && Math.abs(dx * uy - dy * ux) < 5) return true;
      }
      return false;
    }
    function wedge(e, t0, ph, on, dt) {                                            // the two lasers: a V that swings and opens. It fades in dim (harmless) before it bites
      var was = BEAM[3], bit = BEAM[2];
      BEAM[0] = t0 - ph; BEAM[1] = t0 + ph; BEAM[4] = e.x; BEAM[5] = e.y + 8;
      BEAM[3] = on ? Math.min(1, BEAM[3] + dt) : Math.max(0, BEAM[3] - dt * 3);
      BEAM[2] = on && BEAM[3] >= 1 ? 1 : 0;
      if (on && was <= 0) sfx.beamWarn();                                          // heard charging, then heard biting
      if (BEAM[2] && !bit) sfx.beamFire();
    }
    var CELLX = [-96, 96, -48, 48];                                                // the four needle cells (the two hands' outer and inner slots), fired in an order that crosses the face
    function cellVolley(e, n, spd) {                                               // an aimed needle stream from the next cell, two strays either side of it
      var x0 = e.x + CELLX[e.fired++ % 4], y0 = e.y + (e.fired % 2 ? 14 : 24), a = aimAt(x0, y0);
      burst(x0, y0, a, n, spd, 28, 5); fan(x0, y0, a, 2, 0.56, spd * 0.75, 4);
    }
    function lattice(e, lane, spd) {                                               // one row of the rank curtain: lanes that sway row by row, so the gaps snake
      e.n++; for (var x = lane / 2 + 17 * Math.sin(e.n * 0.6); x < W; x += lane) fireB(x, e.y + 30, Math.PI / 2, spd, 1);
    }
    function updateHive(e, dt) {
      var k, rk = G.rank, cyc, open;
      if (e.phase === 0) {                                                        // the washing machine: two three-armed spirals turning against each other, a needle spiral that keeps reversing, a slow curtain beneath
        if (e.ft <= 0) { e.ft = 0.07; e.a2 += 0.21; for (k = 0; k < 3; k++) { fireB(e.x, e.y, e.a2 + k * TAU / 3, 100, 0); fireB(e.x, e.y, 0.9 - e.a2 * 0.8 + k * TAU / 3, 80, 1); } }
        if (e.ft3 <= 0) { e.ft3 = 0.11; e.a3 += 0.3 * Math.sin(e.a * 0.8); for (k = 0; k < 4; k++) fireB(e.x, e.y + 8, e.a3 + k * TAU / 4, 118, 4); }
        if (e.ft2 <= 0) { e.ft2 = 2.8; e.fired++; for (k = 0; k < 10; k++) fireB(18 + k * 36 + (e.fired % 2) * 18, e.y + 50, Math.PI / 2, 40, 2); }
        if (e.ft4 <= 0) { e.ft4 = 1.0; burst(e.x, e.y + 24, aimAt(e.x, e.y + 24), 2, 190, 30, 5); }
      } else if (e.phase === 1) {                                                 // needle streams, two cells at a time from opposite sides, under slow rings: keep walking, a big dodge walks into the strays
        if (e.ft <= 0) { e.ft = 0.5; cellVolley(e, 4, 200); cellVolley(e, 4, 200); }
        if (e.ft2 <= 0) { e.ft2 = 1.7; fan(e.x, e.y + 40, Math.PI / 2, 11, 2.2, 55, 0); }
        if (e.ft3 <= 0) { e.ft3 = 0.8; e.a3 += 0.4; circle(e.x, e.y, 24, 62, e.a3, 1); }
      } else if (e.phase === 2) {                                                 // the whip: two lasers swing across the page with pink bullets riding them
        wedge(e, Math.PI / 2 + 0.6 * Math.sin(e.a * 0.45), 0.5 + 0.3 * Math.sin(e.a * 0.8 + 1), true, dt);
        if (e.ft <= 0) { e.ft = 0.08; fireB(BEAM[4], BEAM[5], BEAM[0], 150, 0); fireB(BEAM[4], BEAM[5], BEAM[1], 150, 0); }
        if (e.ft2 <= 0) { e.ft2 = 0.75; fan(e.x, e.y + 20, aimAt(e.x, e.y + 20), 9, 0.9, 105, 1); }
      } else if (e.phase === 3) {                                                 // the rank curtain: the lattice falls faster, closer and more often as the rank climbs; needles punched through it
        if (e.ft <= 0) { e.ft = 0.46 - 0.08 * rk; lattice(e, 34 - 5 * rk, 66 + 20 * rk); }
        if (e.ft2 <= 0) { e.ft2 = 0.6; burst(e.x, e.y + 24, aimAt(e.x, e.y + 24) + rnd(-0.05, 0.05), 2, 230, 40, 5); }
      } else {                                                                    // everything at once, and the core only opens between volleys
        cyc = e.a % 7.4; open = cyc >= 4.8;
        if (open === (e.shut > 0)) { e.shut = open ? 0 : 1; if (open) { floatText('CORE EXPOSED', e.x, e.y + 62, '#34d399'); sfx.coreOpen(); } else sfx.coreShut(); }
        if (open) {
          wedge(e, (BEAM[0] + BEAM[1]) / 2, (BEAM[1] - BEAM[0]) / 2, false, dt);
          if (e.ft3 <= 0) { e.ft3 = 0.11; e.a3 += 0.3 * Math.sin(e.a * 0.8); for (k = 0; k < 4; k++) fireB(e.x, e.y + 8, e.a3 + k * TAU / 4, 118, 4); }
        } else {
          wedge(e, Math.PI / 2 + 0.5 * Math.sin(e.a * 0.4), 0.7 + 0.2 * Math.sin(e.a * 0.7), true, dt);
          if (e.ft <= 0) { e.ft = 0.09; e.a2 += 0.23; for (k = 0; k < 3; k++) { fireB(e.x, e.y, e.a2 + k * TAU / 3, 100, 0); fireB(e.x, e.y, 0.9 - e.a2 * 0.8 + k * TAU / 3, 80, 1); } }
          if (e.ft2 <= 0) { e.ft2 = 0.4; cellVolley(e, 4, 200); }
          if (e.ft3 <= 0) { e.ft3 = 0.16; e.a3 += 0.4 * Math.sin(e.a * 0.8); for (k = 0; k < 4; k++) fireB(e.x, e.y + 8, e.a3 + k * TAU / 4, 118, 4); fireB(BEAM[4], BEAM[5], BEAM[0], 150, 0); fireB(BEAM[4], BEAM[5], BEAM[1], 150, 0); }
          if (e.ft4 <= 0) { e.ft4 = 1.1; lattice(e, 42 - 6 * rk, 54 + 20 * rk); }
        }
      }
      if (beamHit()) killPlayer();
    }

    /* ------------------------------------------------------------ stage scripts: [time, what, x, path, count, gap, dx, drop, hoverY] */
    var STAGE1 = [
      [0.5, 'card', 'STAGE 1', 'COPYEDITING'],
      [3.5, 'pen', 80, 'sine', 5, 0.32, 0], [5.5, 'pen', 280, 'sine', 5, 0.32, 0],
      [8, 'staple', 0, 'arcR', 6, 0.22, 0, '', 80], [10, 'staple', 0, 'arcL', 6, 0.22, 0, '', 100],
      [11.5, 'box', 180, 'down', 1, 0, 0, 'W'],
      [13, 'query', 90, 'hover', 1, 0, 0, '', 90], [13.6, 'query', 270, 'hover', 1, 0, 0, '', 90],
      [15, 'msg', 'COPYEDITOR', 'WE HAVE CHANGED EVERY "WHICH" TO "THAT". AND BACK AGAIN.'],
      [16, 'pen', 40, 'dive', 4, 0.28, 22], [17.5, 'pen', 320, 'dive', 4, 0.28, -22], [18.5, 'box', 200, 'down', 1, 0, 0, 'S'],
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
      [20.5, 'box', 250, 'down', 1, 0, 0, 'S'], [22, 'proof', 180, 'hover', 1, 0, 0, '', 110], [24, 'staple', 0, 'arcR', 8, 0.18, 0, '', 150], [25, 'staple', 0, 'arcL', 8, 0.18, 0, '', 110],
      [27, 'sat', 90, 'drift', 1, 0, 0, '', 70], [27.5, 'sat', 270, 'drift', 1, 0, 0, '', 100], [29, 'box', 120, 'down', 1, 0, 0, 'W'],
      [31, 'fee', 30, 'fall', 9, 0.16, 36], [32, 'fee', 330, 'fall', 9, 0.16, -36],
      [34, 'proof', 100, 'hover', 1, 0, 0, '', 100], [35, 'proof', 260, 'hover', 1, 0, 0, '', 100],
      [37, 'msg', 'PUBLISHER', 'YOUR PAPER IS UNDER EMBARGO UNTIL YOU HAVE FORGOTTEN IT.'],
      [38, 'paywall', 60, 'down'], [38, 'paywall', 300, 'down'], [39, 'query', 180, 'hover', 1, 0, 0, '', 90], [40, 'pen', 180, 'sine', 8, 0.25, 0],
      [42, 'box', 240, 'down', 1, 0, 0, 'B'], [43, 'bubble', 90, 'hover', 1, 0, 0, '', 90], [43.5, 'bubble', 270, 'hover', 1, 0, 0, '', 90],
      [44.5, 'box', 150, 'down', 1, 0, 0, 'S'], [46, 'sat', 180, 'drift', 1, 0, 0, '', 120], [47, 'fee', 100, 'fall', 8, 0.15, 0], [48, 'fee', 260, 'fall', 8, 0.15, 0],
      [50, 'bracket', 60, 'hover', 1, 0, 0, '', 80], [50, 'bracketR', 300, 'hover', 1, 0, 0, '', 80], [51, 'pen', 40, 'dive', 6, 0.22, 20], [52, 'pen', 320, 'dive', 6, 0.22, -20],
      [54, 'box', 180, 'down', 1, 0, 0, '1'], [55, 'proof', 180, 'hover', 1, 0, 0, '', 120], [56, 'sat', 70, 'drift', 1, 0, 0, '', 70], [56, 'sat', 290, 'drift', 1, 0, 0, '', 70],
      [58, 'paywall', 60, 'down'], [58, 'paywall', 180, 'down'], [58, 'paywall', 300, 'down'], [60, 'box', 100, 'down', 1, 0, 0, 'P'],
      [63, 'msg', 'EDITORIAL OFFICE', 'PLEASE HOLD. YOUR MANUSCRIPT IS IMPORTANT TO US.'],
      [67, 'warn']
    ];
    /* the second loop (URA): the same scripts with half again as many enemies per wave, gaps cut to 0.7x, extra waves, new lines and their own cards */
    var URA1_MSG = ['WE HAVE CHANGED EVERY "THAT" BACK TO "WHICH". WE KNOW WHAT YOU DID.', 'AU: PLEASE CONFIRM THAT YOU ARE STILL ALIVE.', 'THE TYPESETTER HAS BEEN TOLD YOU ARE BACK.'];
    var URA2_MSG = ['THE OPEN ACCESS FEE HAS DOUBLED. THE PAYWALL HAS NOT MOVED.', 'YOUR EMBARGO HAS BEEN EXTENDED. INDEFINITELY.', 'PLEASE HOLD. THE REVIEWERS ARE ASSEMBLING.'];
    var URA1_CARDS = [['STAGE 2-1', 'COPYEDITING (URA)'], ['STAGE 2-1 CLEAR', 'MINOR CORRECTIONS. AGAIN.']];
    var URA2_CARDS = [['STAGE 2-2', 'PROOFS / PRODUCTION (URA)']];
    var URA1_EXTRA = [
      [7, 'pen', 180, 'sine', 6, 0.22, 0], [12.5, 'staple', 0, 'arcL', 8, 0.16, 0, '', 60], [19, 'query', 180, 'hover', 1, 0, 0, '', 120],
      [26, 'pen', 300, 'dive', 6, 0.2, -20], [30, 'fee', 180, 'fall', 8, 0.16, 0], [37, 'bracket', 180, 'hover', 1, 0, 0, '', 120],
      [43, 'staple', 0, 'arcR', 8, 0.16, 0, '', 60], [49.5, 'sat', 180, 'drift', 1, 0, 0, '', 110], [55, 'pen', 60, 'dive', 6, 0.2, 18], [55.5, 'pen', 300, 'dive', 6, 0.2, -18]
    ];
    var URA2_EXTRA = [
      [6.5, 'staple', 0, 'arcR', 8, 0.16, 0, '', 90], [12.5, 'fee', 180, 'fall', 8, 0.15, 0], [21, 'bubble', 180, 'hover', 1, 0, 0, '', 130], [30, 'paywall', 180, 'down'],
      [36.5, 'query', 60, 'hover', 1, 0, 0, '', 70], [36.5, 'query', 300, 'hover', 1, 0, 0, '', 70], [45, 'sat', 180, 'drift', 1, 0, 0, '', 130], [49, 'proof', 180, 'hover', 1, 0, 0, '', 130],
      [53, 'fee', 40, 'fall', 9, 0.14, 35], [53, 'fee', 320, 'fall', 9, 0.14, -35], [61, 'bubble', 180, 'hover', 1, 0, 0, '', 100]
    ];
    function uraScript(src, msgs, cards, extra, shift) {
      var out = [], i, s, m = 0, c = 0;
      for (i = 0; i < src.length; i++) {
        s = src[i].slice(); s[0] += shift;
        if (s[1] === 'card') { if (cards[c]) { s[2] = cards[c][0]; s[3] = cards[c][1]; } c++; }
        else if (s[1] === 'msg') { if (msgs[m]) s[3] = msgs[m]; m++; }
        else if (s[4] > 1) { s[4] = Math.ceil(s[4] * 1.5); s[5] = Math.round(s[5] * 70) / 100; }
        out.push(s);
      }
      for (i = 0; i < extra.length; i++) { s = extra[i].slice(); s[0] += shift; out.push(s); }
      out.sort(function (a, b) { return a[0] - b[0]; });
      return out;
    }
    var STAGE1U = uraScript(STAGE1, URA1_MSG, URA1_CARDS, URA1_EXTRA, 2.6), STAGE2U = uraScript(STAGE2, URA2_MSG, URA2_CARDS, URA2_EXTRA, 0);
    STAGE1U.unshift([0.4, 'card', 'SECOND LOOP', 'THE REVIEWERS REMEMBER YOU.', 2.4]);
    function scriptFor(n) { return L2 ? (n === 1 ? STAGE1U : STAGE2U) : (n === 1 ? STAGE1 : STAGE2); }
    function runScript(dt) {
      var i, s, o;
      if (!G.hold) G.st += dt;
      while (G.si < G.script.length && G.script[G.si][0] <= G.st) {
        s = G.script[G.si++];
        if (s[1] === 'card') card(s[2], s[3], s[4]);
        else if (s[1] === 'msg') say(s[2], s[3]);
        else if (s[1] === 'midboss') { G.hold = true; G.boss = spawnEnemy('typesetter', W / 2); G.tauntT = 1.5; G.tauntI = 0; card('MID-BOSS', 'THE TYPESETTER', 2.6); sfx.alert(); }
        else if (s[1] === 'warn') { G.hold = true; G.warnT = 4.4; sfx.klaxon(); api.music('silence'); }
        else if (s[1] === 'next') { G.stage = 2; G.script = scriptFor(2); G.si = 0; G.st = 0; }
        else for (i = 0; i < NSP; i++) if (!SP[i].on) { o = SP[i]; o.on = true; o.type = s[1]; o.x = s[2]; o.path = s[3]; o.n = s[4] || 1; o.gap = s[5] || 0; o.dx = s[6] || 0; o.drop = s[7] || ''; o.ty = s[8] || 90; o.timer = 0; o.k = 0; break; }
      }
      for (i = 0; i < NSP; i++) {
        o = SP[i]; if (!o.on) continue;
        o.timer -= dt;
        while (o.on && o.timer <= 0) { var e = spawnEnemy(o.type === 'bracketR' ? 'bracket' : o.type, o.x + o.k * o.dx, o.path, o.drop, o.ty); if (e && o.type === 'bracketR') e.a2 = -1; o.k++; o.timer += Math.max(0.01, o.gap); if (o.k >= o.n) o.on = false; }
      }
      if (G.warnT > 0) { G.warnT -= dt; if (G.warnT <= 0) { G.boss = spawnEnemy(G.tlb ? 'hive' : 'impact', W / 2); G.tauntT = 2; G.tauntI = 0; api.music(G.tlb ? bossMusic() : stageMusic()); } }
    }

    /* ------------------------------------------------------------ simulation step (called with small fixed-ish dt) */
    var NSTAR = 120, stx = new Float32Array(NSTAR), sty = new Float32Array(NSTAR), stl = new Uint8Array(NSTAR);
    function updateBullets(dt) {
      var i, dx, dy, r, vul = P.dead <= 0 && P.inv <= 0 && P.bombT <= 0 && G.mode === 'play';
      for (i = 0; i < NB; i++) {
        if (!bal[i]) continue;
        bx[i] += bvx[i] * dt; by[i] += bvy[i] * dt;
        if (bx[i] < -12 || bx[i] > W + 12 || by[i] < -12 || by[i] > H + 12) { bal[i] = 0; bLive--; continue; }
        if (vul) { dx = bx[i] - P.x; dy = by[i] - P.y; r = BHIT[bt[i]] + 2; if (dx * dx + dy * dy < r * r) { if (!GOD) { bal[i] = 0; bLive--; } killPlayer(); vul = false; } }   // god mode leaves the bullet flying
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
      G.t += dt; updateFx(dt); hush();
      if (G.mode === 'continue') { var was = Math.ceil(G.contT); G.contT -= dt; if (Math.ceil(G.contT) !== was) sfx.count(Math.pow(2, (Math.ceil(G.contT) - 9) / 12)); if (G.contT <= 0) { G.mode = 'gameover'; G.contT = 0; sfx.gameOver(); } return; }
      if (G.mode === 'gameover') { G.contT += dt; return; }
      if (G.mode === 'ending') { G.endT += dt; if (Math.random() < dt * 2.2) { var fx = rnd(30, W - 30), fy = rnd(40, H * 0.6); boom(fx, fy, 2); for (i = 0; i < 5; i++) medal(fx, fy, false); } updateItems(dt); return; }
      if (G.mode === 'outro') {
        G.endT += dt; if (G.endT > 2.6 && G.endT - dt <= 2.6) sfx.flyOff();
        if (G.endT > 2.6) { P.y -= (120 + (G.endT - 2.6) * 500) * dt; P.laser = false; P.top = -10; P.nLock = 0; P.flame += dt; if (G.endT > 3.5) G.flash = Math.min(1, G.flash + dt * 3); }
        else updatePlayer(dt);
        updateShots(dt); updateItems(dt);
        if (G.endT > 4.3) showEnding();
        return;
      }
      if (L2) {                                                                  // RANK: climbs with a held chain, falls with a death; everything shoots a little faster for it
        if (G.chain > 0) G.rank = Math.min(1, G.rank + dt * (0.008 + Math.min(G.chain, 400) / 40000)); else G.rank = Math.max(0, G.rank - dt * 0.015);
        BSP = 1.3 + 0.12 * G.rank;
        var q = (G.rank * 4) | 0; if (q > G.rankQ) { G.rankQ = q; sfx.rankUp(); } else if (G.rank < G.rankQ * 0.25 - 0.08) G.rankQ = q;   // each new quarter of rank is announced; falling back re-arms it
      } else BSP = 1;
      if (bLive > G.bPeak) G.bPeak = bLive;
      runScript(dt); updatePlayer(dt);
      for (i = 0; i < NE; i++) if (EN[i].on) updateEnemy(EN[i], dt);
      beamSnd();
      updateShots(dt); updateBullets(dt); updateItems(dt);
      if (G.chain > 0) { G.gauge -= dt / 2.6; if (G.gauge <= 0) chainBreak(); }
    }
    function doContinue() {
      saveHi();
      if (G.mode === 'continue') { G.mode = 'play'; G.score = 0; G.continues++; G.lives = startLives(); G.bombs = 3; respawn(); sfx.start(); floatText('RESUBMITTED', W / 2, H / 2, '#34d399'); }
      else if (G.mode === 'gameover' && G.contT > 1) {                                // the count ran out: the stage starts again, nothing is lost but pride
        var st = G.stage; clearPools(); G.mode = 'play'; G.score = 0; G.continues++; G.lives = startLives(); G.bombs = 3; G.chain = 0; G.gauge = 0; G.rank = 0; G.boss = null; G.hold = false; G.warnT = 0; BEAM[2] = BEAM[3] = 0;
        G.script = scriptFor(st); G.si = 0; G.st = 0; respawn(); sfx.start();
        if (G.tlb) { G.si = G.script.length; G.level = Math.max(G.level, G.tlbLv, 3); tlbWarning(); }   // the True Last Boss is its own checkpoint: no stage to replay, so no P boxes to win the power back from
        else api.music(stageMusic());
      }
    }

    /* ------------------------------------------------------------ the ending (real DOM, because it carries real links) */
    function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function showEnding() {
      if (G.mode === 'ending') return;
      G.mode = 'ending'; G.endT = 0; G.flash = 1; G.boss = null; G.warnT = 0; G.sayT = 0; cancelBullets(false); BEAM[2] = BEAM[3] = 0;
      for (var i = 0; i < NE; i++) EN[i].on = false;
      saveHi();
      countClear();
      api.music('silence');
      if (L2) { if (!api.stinger('tenure')) api.stinger('ending'); } else api.stinger('ending');
      sfx.stamp();
      if (bombBtn) bombBtn.hidden = true; if (pauseBtn) pauseBtn.hidden = true; if (exitBtn) exitBtn.hidden = true;
      var c = G.continues, L = api.links || {}, year = new Date().getFullYear();
      var quip = L2 ? 'YOU MAY NOW BE WRONG FOR THE REST OF YOUR CAREER.' : c === 0 ? 'ACCEPTED WITHOUT A SINGLE RESUBMISSION. NOBODY WILL BELIEVE YOU.' : c < 3 ? 'ACCEPTED AFTER ' + c + ' RESUBMISSION' + (c > 1 ? 'S' : '') + '. ABOUT AVERAGE, FRANKLY.' : 'ACCEPTED AFTER ' + c + ' RESUBMISSIONS. PERSISTENCE IS ALSO A METHOD.';
      var dim = L2 ? 'THE PAYWALL REMAINS.' : 'YOUR PAPER IS NOW BEHIND A PAYWALL. YOU DO NOT HAVE ACCESS.';
      var cite = 'PALMER ET AL. (' + year + ') · ' + (L2 ? '2-ALL CLEAR · REVIEWER 2 DISSENTING' : 'IMPACT FACTOR: 0.000');
      endEl = document.createElement('div'); endEl.className = 'qs-end';
      var h = '<div class="qs-end__in"><div class="qs-end__stamp' + (L2 ? ' is-tenure' : '') + '">' + (L2 ? 'TENURED!' : 'PUBLISHED!') + '</div>' +
        '<div class="qs-end__cite">' + cite + '</div>' +
        '<div class="qs-end__stats"><span>SCORE<b>' + fmt(G.score) + '</b></span><span>MAX CHAIN<b>' + G.maxChain + ' HIT</b></span><span>CITATIONS<b>' + fmt(G.cites) + '</b></span><span>CONTINUES<b>' + c + '</b></span></div>' +
        (L2 ? '' : '<p class="qs-end__quip qs-end__tease">THE REVIEWERS HAVE READ YOUR PREVIOUS SUBMISSION.</p>') +
        '<p class="qs-end__quip">' + quip + '</p><p class="qs-end__quip qs-end__dim">' + dim + '</p><div class="qs-end__links">';
      [['publications', 'READ THE REAL PAPERS'], ['research', 'RESEARCH'], ['code', 'CODE'], ['scholar', 'ACTUAL CITATIONS'], ['email', 'EMAIL THE AUTHOR']].forEach(function (p) {
        if (!L[p[0]]) return; var ext = /^https?:/.test(L[p[0]]);
        h += '<a href="' + String(L[p[0]]).replace(/"/g, '&quot;') + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + p[1] + '</a>';
      });
      h += '</div><div class="qs-end__btns"><button type="button" data-qs="again">▶ PLAY AGAIN</button>' +
        (L2 ? '' : '<button type="button" class="qs-l2" data-qs="loop2">▶ SECOND LOOP</button>') +
        '<button type="button" data-qs="site">BACK TO THE SITE ↓</button></div></div>';
      endEl.innerHTML = h; overlay.appendChild(endEl);
      endEl.querySelector('[data-qs="again"]').addEventListener('click', function () { try { api.restart(); } catch (e) {} });
      var l2 = endEl.querySelector('[data-qs="loop2"]'); if (l2) l2.addEventListener('click', function () { try { api.startLoop2(); } catch (e) {} });
      endEl.querySelector('[data-qs="site"]').addEventListener('click', finishToSite);
    }

    function toBoring() {
      var el = document.getElementById('boring');
      if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { try { el.scrollIntoView(); } catch (e2) {} } }
    }
    function finishToSite() {                                                         // the ending is over: give the page, the keyboard and the CPU back
      finished = true;
      setFixed(false);                                                                // hand the page back, keep the ending where the game was
      listen(false);                                                                  // no more preventDefault: the reader owns the arrow keys again
      sleepLoop(true);                                                                // no more rAF, no more firework bangs behind the site
      toBoring();
      if (endEl) setTimeout(function () {                                             // in the 4:3 phone box the full panel does not fit: compact it
        try { if (endEl && endEl.scrollHeight > endEl.clientHeight + 4) endEl.className = 'qs-end is-back'; } catch (e) {}
      }, 90);
    }
    function exitToSite() {                                                           // mid-game escape hatch, mainly for the page-locked phone layout
      if (!G || finished) return;
      if (G.mode !== 'ending') { G.paused = true; autoPaused = false; }               // a deliberate pause: it must not auto-resume behind their back
      setFixed(false);
      dirty = true; wake();
      toBoring();
    }

    /* ------------------------------------------------------------ PEER REVIEW, reskinned: a flat-shaded polygon face, two hands, a cube
       Visuals only. Splices into shmup.js (see SPLICE.md): uses mk(), whiten() and TAU from that scope, adds nothing to the entity.
       What the picture says, and why it is true:
         mouth (e.x, e.y .. e.y+24)  every centre pattern and both lasers leave from it; it gapes while the boss fires, shuts while it cannot be hurt
         hands (e.x -/+ 96 and 48)   the four needle "cells" of cellVolley: the left hand fires at e.y+14, the right at e.y+24, the palm gem flashes.
                                     Open at the outer cells, a fist punched in front of the cheek at the inner ones
         face, +/-67 x -59..+43      the 128 x 92 hit box; facets fall away at each phase break (while e.lt runs) and leave dull magenta hollows: the silhouette never shrinks
         cube (phase 4)              the true form, 84 wide face-on and 119 corner-on in the same hit box. Dark steel face, gold eyes shut, a gold bar across the teeth = sealed
                                     (e.shut or e.lt: shots deflect); the bright bare face, eyes and mouth lit pink = CORE EXPOSED
         death                       the cube bursts into polygons over e.dying 6 -> 0 */
    var AND = { OX: 84, OY: 66, SW: 168, SH: 130, CS: 84, DIE: 6, LT: 1.8, up: [], upW: [], jaw: [], jawW: [], eyes: [], cav: null, hand: [], tex: [], fac: [], cube: [],
      hl: 96, hr: 96, fl: 0, fr: 0, jw: 0, fired: -1, lastT: -1, COL: ['#e3625b', '#e3625b', '#fb923c', '#fb923c', '#ff4fa3'] };
    function androssBuild() {
      var RAMP = [[42, 45, 60], [68, 74, 94], [100, 107, 130], [135, 142, 166], [170, 176, 196], [207, 211, 224], [244, 246, 251]];
      var LX = -0.47, LY = -0.6, LZ = 0.65, K = [17, 19, 28], seed = 0x9e3779, i, j, k, f, p, c, hv, q4, pg;
      function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
      function css(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
      function shade(a, b, d) {                                                     // Lambert on the facet's own normal, snapped to the ramp: hard edges, no gradients
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        return RAMP[Math.max(0, Math.min(6, Math.round((0.12 + 0.88 * Math.max(0, (nx * LX + ny * LY + nz * LZ) / l)) * 6)))];
      }
      function facet(id, part, vs, fall, col, over) {                               // vs: [[x, y, z], ...] around the boss centre
        var pts = [], cx = 0, cy = 0, n = vs.length, q, d, sp;
        for (q = 0; q < n; q++) { pts.push(vs[q][0], vs[q][1]); cx += vs[q][0] / n; cy += vs[q][1] / n; }
        d = Math.sqrt(cx * cx + cy * cy) || 1; sp = 50 + rand() * 90;
        return { id: id, part: part, pts: pts, n: n, cx: cx, cy: cy, fall: fall, col: col || shade(vs[0], vs[1], vs[2]), over: !!over, css: '',
          vx: cx / d * sp + (rand() - 0.5) * 40, vy: cy / d * sp - 20 - rand() * 50, w: (rand() - 0.5) * 9, t0: 0 };
      }
      function inside(pts, n, x, y) {
        var q, r, hit = false;
        for (q = 0, r = n - 1; q < n; r = q++) { var xi = pts[q * 2], yi = pts[q * 2 + 1], xj = pts[r * 2], yj = pts[r * 2 + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit; }
        return hit;
      }
      function raster(list, w, h, ox, oy, pick, outline) {                          // pick(facet) -> colour, 'in' for the hollow behind a fallen facet, or null to skip
        var cv = mk(w, h), x = cv.getContext('2d'), im = x.createImageData(w, h), d = im.data, q, fc, col, a, b, o, x0, x1, y0, y1, e;
        for (q = 0; q < list.length; q++) {
          fc = list[q]; col = pick(fc); if (!col) continue;
          x0 = y0 = 1e9; x1 = y1 = -1e9;
          for (e = 0; e < fc.n; e++) { x0 = Math.min(x0, fc.pts[e * 2]); x1 = Math.max(x1, fc.pts[e * 2]); y0 = Math.min(y0, fc.pts[e * 2 + 1]); y1 = Math.max(y1, fc.pts[e * 2 + 1]); }
          x0 = Math.max(0, Math.floor(x0 + ox)); x1 = Math.min(w - 1, Math.ceil(x1 + ox)); y0 = Math.max(0, Math.floor(y0 + oy)); y1 = Math.min(h - 1, Math.ceil(y1 + oy));
          for (b = y0; b <= y1; b++) for (a = x0; a <= x1; a++) {
            if (!inside(fc.pts, fc.n, a + 0.5 - ox, b + 0.5 - oy)) continue;
            o = (b * w + a) * 4;
            if (col === 'in') { e = ((a + b) % 4) === 0 ? [128, 62, 102] : [80, 38, 68]; d[o] = e[0]; d[o + 1] = e[1]; d[o + 2] = e[2]; }
            else { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; }
            d[o + 3] = 255;
          }
        }
        if (outline) for (b = 0; b < h; b++) for (a = 0; a < w; a++) {              // the house outline: one dark pixel round the silhouette
          o = (b * w + a) * 4; if (d[o + 3]) continue;
          if ((a > 0 && d[o - 1] === 255) || (a < w - 1 && d[o + 7] === 255) || (b > 0 && d[o - w * 4 + 3] === 255) || (b < h - 1 && d[o + w * 4 + 3] === 255)) { d[o] = K[0]; d[o + 1] = K[1]; d[o + 2] = K[2]; d[o + 3] = 254; }
        }
        x.putImageData(im, 0, 0); return cv;
      }
      function line(x, col, pts) {                                                  // a crack: a one-pixel polyline
        x.fillStyle = col;
        for (var q = 0; q + 3 < pts.length; q += 2) { var ax = pts[q], ay = pts[q + 1], bx = pts[q + 2], by = pts[q + 3], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) || 1, s; for (s = 0; s <= n; s++) x.fillRect(Math.round(AND.OX + ax + (bx - ax) * s / n), Math.round(AND.OY + ay + (by - ay) * s / n), 1, 1); }
      }

      /* the face: the right half, mirrored. x, y in playfield pixels round (e.x, e.y); z towards the viewer, only for the shading */
      var V = { c0: [0, -58, 8], r0: [34, -58, 2], r1: [59, -49, -14], r2: [67, -25, -24], r3: [62, -1, -20], r4: [56, 23, -16],
        c1: [0, -41, 20], b1: [22, -43, 25], b2: [49, -37, 12], c2: [0, -28, 15], e1: [9, -25, 9], e2: [46, -32, 3], e3: [42, -21, 2], e4: [14, -18, 10],
        c3: [0, -8, 34], n1: [12, -8, 17], k1: [40, -8, 8], c4: [0, 0, 22], l1: [14, 0, 15], m1: [34, 1, 4],
        j0: [0, 3, 16], jl: [16, 3, 14], j1: [36, 3, 3], j2: [56, 20, -14], j3: [37, 41, 0], j4: [0, 42, 10], j5: [19, 21, 16], jc: [0, 19, 21] };
      var F = [['F1', 'u', 'c0 r0 b1 c1'], ['F2', 'u', 'r0 r1 b2 b1'], ['F3', 'u', 'r1 r2 b2'], ['F4', 'u', 'b1 b2 e2 e1'], ['F5', 'u', 'c1 b1 e1 c2'], ['F6', 'u', 'e1 e2 e3 e4'],
        ['F7', 'u', 'b2 r2 e3 e2'], ['F8', 'u', 'c2 e1 e4'], ['F9', 'u', 'c2 e4 n1 c3'], ['F10', 'u', 'e4 e3 k1 n1'], ['F11', 'u', 'e3 r2 r3 k1'], ['F12', 'u', 'c3 n1 l1 c4'],
        ['F13', 'u', 'n1 k1 m1 l1'], ['F14', 'u', 'k1 r3 r4 m1'], ['J1', 'j', 'j0 jl j5 jc'], ['J2', 'j', 'jl j1 j2 j5'], ['J3', 'j', 'jc j5 j3 j4'], ['J4', 'j', 'j5 j2 j3']];
      var FALL = { F3R: 1, F2L: 1, F14L: 1, F1R: 2, F11R: 2, F7L: 2, J4L: 2, F2R: 3, F10L: 3, F3L: 3, J2R: 3, F14R: 3 };   // which phase each facet is gone by; the rest go when the cube comes out
      var EYE = [17, 19, 28], WHITE = RAMP[6], GOLD = [252, 211, 77], GOLDD = [184, 138, 30], LENS = [150, 178, 204], LENSH = [201, 222, 238];
      AND.fac = [];
      for (k = 0; k < F.length; k++) for (j = 0; j < 2; j++) {
        var names = F[k][2].split(' '), vs = [];
        for (i = 0; i < names.length; i++) { p = V[names[i]]; vs.push([j ? -p[0] : p[0], p[1], p[2]]); }
        var id = F[k][0] + (j ? 'L' : 'R');
        AND.fac.push(facet(id, F[k][1], vs, FALL[id] || 4, F[k][0] === 'F6' ? EYE : null));
      }
      for (j = 0; j < 2; j++) {                                                     // half-moon reading glasses, low on the nose: gold rim, two lens facets. The right lens goes at phase 2, the left at 3
        var s = j ? -1 : 1, fl = j ? 3 : 2;
        AND.fac.push(facet('G0' + j, 'u', [[s * 9, -16, 0], [s * 35, -17, 0], [s * 34, -10, 0], [s * 28, -5, 0], [s * 16, -5, 0], [s * 10, -10, 0]], fl, GOLD, true));
        AND.fac.push(facet('G1' + j, 'u', [[s * 10, -14.5, 0], [s * 34, -15.5, 0], [s * 33, -10.5, 0], [s * 27.5, -6.5, 0], [s * 16.5, -6.5, 0], [s * 11, -10.5, 0]], fl, LENS, true));
        AND.fac.push(facet('G2' + j, 'u', [[s * 10, -14.5, 0], [s * 34, -15.5, 0], [s * 22, -10, 0]], fl, LENSH, true));
      }
      AND.fac.push(facet('G3', 'u', [[-9, -17, 0], [9, -17, 0], [9, -15, 0], [-9, -15, 0]], 3, GOLDD, true));
      for (i = -3; i <= 3; i++) AND.fac.push(facet('TU' + i, 'u', [[i * 9 - 4, 0, 0], [i * 9 + 4, 0, 0], [i * 9, 5.5, 0]], 4, WHITE));               // teeth: upper fangs on the lip, lower ones on the jaw
      for (i = -3; i < 3; i++) AND.fac.push(facet('TL' + i, 'j', [[i * 9 + 0.5, 3.5, 0], [i * 9 + 8.5, 3.5, 0], [i * 9 + 4.5, -1.5, 0]], 4, WHITE));
      for (k = 0; k < AND.fac.length; k++) { f = AND.fac[k]; f.css = css(f.col); }
      var CRACK = [[], [[-20, -58, -15, -49, -19, -42, -13, -36], [38, 2, 44, 9, 41, 15], [20, 26, 25, 33]],
        [[-20, -58, -15, -49, -19, -42, -13, -36], [38, 2, 44, 9, 41, 15], [20, 26, 25, 33], [-2, -56, 3, -47, -1, -42], [-50, -8, -42, -3, -46, 4], [-8, 24, -3, 31, -9, 37]],
        [[-2, -56, 3, -47, -1, -42], [-8, 24, -3, 31, -9, 37], [22, -3, 27, -8], [6, 22, 11, 30, 7, 36], [-30, -40, -24, -36]]];
      function sheet(part, ph) {
        var cv = raster(AND.fac, AND.SW, AND.SH, AND.OX, AND.OY, function (fc) { return fc.part !== part ? null : fc.fall <= ph ? (fc.over ? null : 'in') : fc.col; }, true);
        if (part === 'u') { var x = cv.getContext('2d'); for (var q = 0; q < CRACK[ph].length; q++) line(x, '#2a2d3c', CRACK[ph][q]); }
        return cv;
      }
      for (p = 0; p < 4; p++) { AND.up[p] = sheet('u', p); AND.jaw[p] = sheet('j', p); AND.upW[p] = whiten(AND.up[p]); AND.jawW[p] = whiten(AND.jaw[p]); }
      var cavF = [facet('C', 'c', [[-52, 19, 0], [-36, 4, 0], [36, 4, 0], [52, 19, 0], [52, 3, 0], [36, -14, 0], [-36, -14, 0], [-52, 3, 0]], 9, [11, 12, 20])];   // the dark behind the teeth: it rides on the jaw, hidden under the cheeks until the jaw drops
      AND.cav = raster(cavF, AND.SW, AND.SH, AND.OX, AND.OY, function (fc) { return fc.col; }, false);
      var GLOW = [[227, 98, 91], [251, 146, 60], [255, 79, 163]];                    // the eyes: one glow sheet per colour, the pupils are drawn live
      for (k = 0; k < 3; k++) {
        var ef = [];
        for (j = 0; j < 2; j++) { s = j ? -1 : 1; ef.push(facet('E', 'e', [[s * 12, -24, 0], [s * 44, -30, 0], [s * 41, -22.5, 0], [s * 15, -19.5, 0]], 9, GLOW[k])); }
        AND.eyes[k] = raster(ef, AND.SW, AND.SH, AND.OX, AND.OY, function (fc) { return fc.col; }, false);
      }

      /* the hands: palm towards you, fingers up, thumb on the side of the face. 64 x 64, the palm gem (the muzzle) at the centre */
      for (j = 0; j < 4; j++) {                                                     // 0, 1: right and left of the face, open; 2, 3: the same two as fists (punched in to fire from the inner cells)
        s = j % 2 ? -1 : 1; var hf = [], fist = j > 1, pc = [0, 4, 10], rim = [[-11, -6, 1], [11, -6, 1], [13, 6, 0], [7, 15, -2], [-7, 15, -2], [-13, 6, 0]], tips = fist ? [-11, -13, -13, -11] : [-18, -23, -22, -16];
        hv = function (q) { return [s * q[0] * 1.4, q[1] * 1.4, q[2]]; };
        for (i = 0; i < 6; i++) hf.push(facet('P' + i, 'h', [hv(pc), hv(rim[i]), hv(rim[(i + 1) % 6])], 9));
        for (i = 0; i < 4; i++) { var fx = -11 + i * 5.75; hf.push(facet('N' + i, 'h', [hv([fx, -7, i % 2 ? 4 : 0]), hv([fx + 4.75, -7, i % 2 ? 0 : 5]), hv([fx + 4.25, tips[i], i % 2 ? -5 : -1]), hv([fx + 0.5, tips[i], i % 2 ? -1 : -6])], 9)); }
        if (fist) hf.push(facet('T', 'h', [hv([-14, 7, 4]), hv([-12, 12, 4]), hv([4, 14, 12]), hv([5, 8, 4])], 9));
        else hf.push(facet('T', 'h', [hv([-12, -3, 3]), hv([-13, 6, 0]), hv([-22, 0, -4]), hv([-21, -10, 2])], 9));
        AND.hand[j] = raster(hf, 64, 64, 32, 36, function (fc) { return fc.col; }, true);
      }

      /* the cube's sides, drawn on a 68-unit square and scaled to CS: 0, 1 the bare face, bright (eyes dim / lit); 2, 3 the same face sealed: dark steel, eyes shut, a gold bar across the teeth (dim / lit) */
      var S = AND.CS, D = 68, sc = S / D, tf, STEEL = [[31, 36, 48], [43, 48, 60], [59, 66, 82], [92, 107, 133]];
      for (k = 0; k < 4; k++) {
        tf = [];
        q4 = function (x0, y0, x1, y1, col) { tf.push(facet('q', 't', [[x0 * sc, y0 * sc, 0], [x1 * sc, y0 * sc, 0], [x1 * sc, y1 * sc, 0], [x0 * sc, y1 * sc, 0]], 9, col)); };
        pg = function (a, col) { var vs2 = []; for (var q = 0; q < a.length; q += 2) vs2.push([a[q] * sc, a[q + 1] * sc, 0]); tf.push(facet('p', 't', vs2, 9, col)); };
        if (k < 2) {
          q4(0, 0, D, D, K); q4(1, 1, D - 1, D - 1, RAMP[5]); pg([1, 1, D - 1, 1, D - 5, 5, 5, 5], RAMP[6]); pg([1, D - 1, D - 1, D - 1, D - 5, D - 5, 5, D - 5], RAMP[3]); pg([D - 1, 1, D - 1, D - 1, D - 5, D - 5, D - 5, 5], RAMP[4]);
          pg([6, 10, 31, 18, 31, 26, 6, 19], RAMP[1]); pg([D - 6, 10, D - 31, 18, D - 31, 26, D - 6, 19], RAMP[1]);                       // brows
          pg([7, 19, 31, 26, 29, 35, 10, 31], K); pg([D - 7, 19, D - 31, 26, D - 29, 35, D - 10, 31], K);                                 // eyes: sockets, glow, pupils
          pg([9, 22, 29, 28, 28, 33, 11, 29.5], k ? GLOW[2] : [159, 47, 106]); pg([D - 9, 22, D - 29, 28, D - 28, 33, D - 11, 29.5], k ? GLOW[2] : [159, 47, 106]);
          if (k) { q4(18, 26, 23, 30, WHITE); q4(D - 23, 26, D - 18, 30, WHITE); }
          pg([34, 24, 41, 41, 27, 41], RAMP[6]); pg([34, 24, 41, 41, 34, 41], RAMP[3]);                                                // nose
          q4(14, 45, D - 14, 59, K); q4(15, 46, D - 15, 58, k ? [255, 79, 163] : [122, 31, 36]);                                         // mouth
          for (i = 0; i < 5; i++) { pg([16 + i * 7.4, 46, 23 + i * 7.4, 46, 19.5 + i * 7.4, 51], WHITE); pg([16 + i * 7.4, 58, 23 + i * 7.4, 58, 19.5 + i * 7.4, 53], WHITE); }
        } else {
          q4(0, 0, D, D, K); q4(1, 1, D - 1, D - 1, STEEL[2]); pg([1, 1, D - 1, 1, D - 5, 5, 5, 5], STEEL[3]); pg([1, D - 1, D - 1, D - 1, D - 5, D - 5, 5, D - 5], STEEL[0]); pg([D - 1, 1, D - 1, D - 1, D - 5, D - 5, D - 5, 5], STEEL[1]);
          q4(5, 5, D - 5, 7, GOLDD); q4(5, D - 7, D - 5, D - 5, GOLDD); q4(5, 5, 7, D - 5, GOLDD); q4(D - 7, 5, D - 5, D - 5, GOLDD);       // the shutter's gold rim
          pg([8, 11, 31, 18, 31, 26, 8, 20], STEEL[0]); pg([D - 8, 11, D - 31, 18, D - 31, 26, D - 8, 20], STEEL[0]);                     // brows
          pg([9, 20, 31, 26, 29, 34, 11, 30], K); pg([D - 9, 20, D - 31, 26, D - 29, 34, D - 11, 30], K);                                 // eyes shut: a gold slit
          pg([11, 24.5, 29, 29.5, 28.5, 31.5, 11.5, 26.5], k === 3 ? GOLD : GOLDD); pg([D - 11, 24.5, D - 29, 29.5, D - 28.5, 31.5, D - 11.5, 26.5], k === 3 ? GOLD : GOLDD);
          pg([34, 24, 41, 41, 27, 41], STEEL[3]); pg([34, 24, 41, 41, 34, 41], STEEL[0]);                                              // nose
          q4(13, 44, D - 13, 60, K); q4(14, 45, D - 14, 59, STEEL[0]);                                                                 // teeth clenched, barred
          for (i = 0; i < 5; i++) { pg([16 + i * 7.4, 45, 23 + i * 7.4, 45, 19.5 + i * 7.4, 53], STEEL[3]); pg([16 + i * 7.4, 59, 23 + i * 7.4, 59, 19.5 + i * 7.4, 51], STEEL[2]); }
          q4(10, 49.5, D - 10, 54.5, K); q4(11, 50.5, D - 11, 53.5, k === 3 ? GOLD : GOLDD);
        }
        AND.tex[k] = raster(tf, S, S, 0, 0, function (fc) { return fc.col; }, false);
      }
      AND.cube = [];                                                                // what the cube breaks into: a jittered grid of triangles
      var N = 5, gp = [], h = S / 2 + 4;
      for (j = 0; j <= N; j++) for (i = 0; i <= N; i++) gp.push([(i / N * 2 - 1) * h + (i > 0 && i < N ? (rand() - 0.5) * 9 : 0), (j / N * 2 - 1) * h + (j > 0 && j < N ? (rand() - 0.5) * 9 : 0), 0]);
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
        var a = gp[j * (N + 1) + i], b = gp[j * (N + 1) + i + 1], cc = gp[(j + 1) * (N + 1) + i + 1], d = gp[(j + 1) * (N + 1) + i], flip = (i + j) % 2;
        for (k = 0; k < 2; k++) {
          f = facet('S', 's', flip ? (k ? [a, b, d] : [b, cc, d]) : (k ? [a, b, cc] : [a, cc, d]), 9, rand() < 0.12 ? GLOW[2] : RAMP[2 + ((rand() * 5) | 0)]);
          f.css = css(f.col); f.t0 = rand() < 0.22 ? 0.3 + rand() * 1.7 : 2.2 + rand() * 0.12; AND.cube.push(f);
        }
      }
    }

    function andShards(g, list, x, y, tt, death, only) {                             // facets in flight. Stateless: where each one is depends only on how long ago it left
      var k, q, f, t, life = death ? 3.2 : 1.5, gr = death ? 36 : 260, sp = death ? 0.75 : 1, px, py, sc, cs, sn, dx, dy;
      for (k = 0; k < list.length; k++) {
        f = list[k]; if (only >= 0 && f.fall !== only) continue;
        t = tt - (death ? f.t0 : 0); if (t < 0 || t > life) continue;
        if (t > life - 0.35 && ((t * 30) | 0) % 2) continue;
        px = x + f.cx + f.vx * sp * t; py = y + f.cy + f.vy * sp * t + 0.5 * gr * t * t; sc = death ? 1 - t / life * 0.7 : 1; cs = Math.cos(f.w * t) * sc; sn = Math.sin(f.w * t) * sc;
        g.fillStyle = t < 0.1 ? '#fff' : f.css; g.beginPath();
        for (q = 0; q < f.n; q++) { dx = f.pts[q * 2] - f.cx; dy = f.pts[q * 2 + 1] - f.cy; if (q) g.lineTo(px + dx * cs - dy * sn, py + dx * sn + dy * cs); else g.moveTo(px + dx * cs - dy * sn, py + dx * sn + dy * cs); }
        g.closePath(); g.fill();
      }
    }
    function andCube(g, x, y, th, tex, wh) {                                         // a cube turning about its upright axis, seen from a little above: two sheared sides and the lid
      var S = AND.CS, h = S / 2, r = h * 1.41421, ca = 0.94, sa = 0.34, k, a, b, ax, ay, bx, by, n, lit, cx = [], cy = [];
      for (k = 0; k < 4; k++) { a = th + Math.PI / 4 + k * Math.PI / 2; cx[k] = Math.sin(a) * r; cy[k] = -h * ca + Math.cos(a) * r * sa; }
      for (k = 0; k < 4; k++) {
        n = th + (k + 1) * Math.PI / 2; if (Math.cos(n) <= 0.02) continue;
        ax = cx[k]; ay = cy[k]; bx = cx[(k + 1) % 4]; by = cy[(k + 1) % 4]; lit = 0.5 - 0.5 * Math.sin(n);        // lit from the left
        g.save(); g.transform((bx - ax) / S, (by - ay) / S, 0, ca, x + ax, y + ay);
        g.drawImage(AND.tex[tex], 0, 0);
        g.fillStyle = '#05060f'; g.globalAlpha = 0.5 * (1 - lit); g.fillRect(0, 0, S, S);
        if (wh) { g.fillStyle = '#fff'; g.globalAlpha = 0.6; g.fillRect(0, 0, S, S); }
        g.restore();
      }
      g.globalAlpha = 1; g.fillStyle = wh ? '#fff' : tex > 1 ? '#7686a3' : '#f4f6fb'; g.strokeStyle = '#11131c'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + cx[0], y + cy[0]); for (k = 1; k < 4; k++) g.lineTo(x + cx[k], y + cy[k]); g.closePath(); g.fill(); g.stroke();
    }
    function andHand(g, j, hx, hy, glow, col, fall, down) {                          // j: 0 right of the face, 1 left; down: a fist (at an inner cell). The gem in the palm is the muzzle
      if (fall > 0) { var dy = 150 * fall * fall; if (hy + dy > 520) return; g.save(); g.translate(hx, hy + dy); g.rotate((j ? -1 : 1) * fall * 2.6); g.drawImage(AND.hand[j], -32, -36); g.restore(); return; }
      g.drawImage(AND.hand[down ? j + 2 : j], hx - 32, hy - 36);
      g.fillStyle = '#11131c'; g.fillRect(hx - 4, hy - 1, 8, 6); g.fillRect(hx - 3, hy - 2, 6, 8);
      g.fillStyle = glow > 0.5 ? '#fff' : col; g.fillRect(hx - 3, hy, 6, 4); g.fillRect(hx - 2, hy - 1, 4, 6);
      if (glow > 0) { g.globalAlpha = glow * 0.5; g.fillStyle = col; g.fillRect(hx - 7, hy - 5, 14, 14); g.globalAlpha = 1; }
      else { g.fillStyle = '#fff'; g.fillRect(hx - 1, hy, 2, 2); }
    }
    /* drawAndross(g, e, x, y, wh, px, py, t, beamA): the body of drawBoss's hive branch.
       x, y: the boss centre drawBoss already rounded (and jittered while dying); wh: its hit-flash flag; px, py: the ship; t: G.t; beamA: BEAM[3] (0..1) */
    function drawAndross(g, e, x, y, wh, px, py, t, beamA) {
      var ph = e.phase, hy = y + Math.round(Math.sin(t * 1.7) * 3), col = AND.COL[ph] || AND.COL[4], gi = ph >= 4 ? 2 : ph >= 2 ? 1 : 0, pu = 0.5 + 0.5 * Math.sin(t * (ph >= 4 ? 14 : 9));
      var dying = e.dying > 0, d = dying ? AND.DIE - e.dying : 0, rest = e.lt > 0, live = !rest && !dying && e.y >= e.ty - 1, k, m, dt, n, tl, tr, open, off, ex, ey, cx;
      /* the hands slide to wherever cellVolley will fire from next (CELLX = [-96, 96, -48, 48], next index e.fired % 4), and flash when e.fired says they did */
      dt = t - AND.lastT; if (!(dt >= 0 && dt < 0.25)) { dt = 0; AND.fired = e.fired; AND.hl = AND.hr = 96; AND.fl = AND.fr = AND.jw = 0; } AND.lastT = t;
      m = ((e.fired % 4) + 4) % 4; tl = tr = 96;
      if (live && (ph === 1 || (ph === 4 && e.shut > 0))) { tl = m === 1 || m === 2 ? 48 : 96; tr = m > 1 ? 48 : 96; }
      if (ph === 1 || ph === 4) { n = e.fired - AND.fired; if (n > 0 && n < 5) for (k = 0; k < n; k++) { if ((AND.fired + k) % 2) AND.fr = 1; else AND.fl = 1; } }
      AND.fired = e.fired; k = Math.min(1, dt * 16); AND.hl += (tl - AND.hl) * k; AND.hr += (tr - AND.hr) * k; AND.fl = Math.max(0, AND.fl - dt * 5); AND.fr = Math.max(0, AND.fr - dt * 5);

      if (ph >= 4) {                                           // the true form
        if (dying && d >= 2.2) {                                                    // ... and its end: the light inside gutters while the polygons scatter
          var cr = Math.max(0, 20 * (1 - (d - 2.2) / 3.8)), fk = ((t * 20) | 0) % 2;
          g.globalAlpha = 0.5; g.strokeStyle = fk ? '#fff' : '#ff9ccc'; g.lineWidth = 2; g.beginPath();
          for (k = 0; k < 4; k++) { n = t * 1.3 + k * Math.PI / 2; g.moveTo(x + Math.cos(n) * cr, hy + Math.sin(n) * cr); g.lineTo(x + Math.cos(n) * (cr + 18 + d * 14), hy + Math.sin(n) * (cr + 18 + d * 14)); }
          g.stroke(); g.globalAlpha = 1;
          g.fillStyle = '#ff4fa3'; g.beginPath(); g.moveTo(x, hy - cr - 3); g.lineTo(x + cr + 3, hy); g.lineTo(x, hy + cr + 3); g.lineTo(x - cr - 3, hy); g.closePath(); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, hy - cr * 0.7); g.lineTo(x + cr * 0.7, hy); g.lineTo(x, hy + cr * 0.7); g.lineTo(x - cr * 0.7, hy); g.closePath(); g.fill();
        } else {
          var sealed = !dying && (rest || e.shut > 0), blink = ((t * 6) | 0) % 2;
          if (!sealed) { g.globalAlpha = 0.16 + 0.12 * pu; g.fillStyle = col; g.beginPath(); g.moveTo(x, hy - 72); g.lineTo(x + 82, hy); g.lineTo(x, hy + 72); g.lineTo(x - 82, hy); g.closePath(); g.fill(); g.globalAlpha = 1; }
          andCube(g, x, hy, t * 1.3 + d * d * 2.2, sealed ? 2 + blink : (dying ? ((t * 16) | 0) % 2 : pu > 0.5 ? 1 : 0), wh || (dying && ((t * 12) | 0) % 3 === 0));
        }
        if (rest) andShards(g, AND.fac, x, hy, AND.LT - e.lt, false, 4);            // the last of the face, blown clear
        if (dying) andShards(g, AND.cube, x, hy, d, true, -1);
      } else {
        open = !live ? 0 : Math.min(1, e.a * 5) * (ph === 0 ? 0.7 + 0.3 * Math.min(1, Math.max(0, e.ft4)) : ph === 1 ? 0.35 + 0.65 * Math.min(1, Math.max(0, e.ft3 / 0.8)) : ph === 2 ? 1 : 0.45 + 0.55 * Math.min(1, Math.max(0, e.ft2 / 0.6)));
        AND.jw += (open - AND.jw) * Math.min(1, dt * 14); off = Math.round(AND.jw * 15);                 // the jaw swings, it does not snap
        if (dying) andShards(g, AND.fac, x, hy, d, false, -1);
        else {
          g.drawImage(AND.cav, x - AND.OX, hy - AND.OY + off);
          if (off > 2) {                                                            // the throat: lit in the phase colour, white-hot where the lasers leave
            g.globalAlpha = 0.4 + 0.3 * pu; g.fillStyle = col; g.fillRect(x - 26, hy + 2, 52, off); g.globalAlpha = 1;
            if (ph === 2 && beamA > 0) { g.globalAlpha = beamA; g.fillStyle = '#ff4fa3'; g.fillRect(x - 9, hy + 3, 18, 10); g.fillStyle = '#fff'; g.fillRect(x - 5, hy + 5, 10, 6); g.globalAlpha = 1; }
          }
          g.drawImage(AND.jaw[ph], x - AND.OX, hy - AND.OY + off); g.drawImage(AND.up[ph], x - AND.OX, hy - AND.OY);
          if (wh) { g.globalAlpha = 0.6; g.drawImage(AND.jawW[ph], x - AND.OX, hy - AND.OY + off); g.drawImage(AND.upW[ph], x - AND.OX, hy - AND.OY); g.globalAlpha = 1; }
          g.globalAlpha = rest || !live ? 0.3 : 0.75 + 0.25 * pu; g.drawImage(AND.eyes[gi], x - AND.OX, hy - AND.OY); g.globalAlpha = 1;
          if (live) {                                                               // the pupils follow the ship along the slant of each eye
            ex = Math.max(-1, Math.min(1, (px - x) / 110)) * 8; ey = Math.max(0, Math.min(1, (py - hy) / 260)) * 1.5;
            for (k = -1; k <= 1; k += 2) { cx = k * 28 + ex; g.fillStyle = '#fff'; g.fillRect(Math.round(x + cx - 3), Math.round(hy - 26 - k * (cx - k * 28) * 0.15 - (k * cx - 28) * 0.17 + ey), 6, 4); }
          }
          if (rest && ph > 0) andShards(g, AND.fac, x, hy, AND.LT - e.lt, false, ph);  // this phase's facets, falling away while it catches its breath
        }
      }
      if (dying && d > 3.4) return;
      k = dying ? Math.max(0.001, d - 0.25) : 0;
      andHand(g, 1, Math.round(x - AND.hl), y + 14, AND.fl, col, dying ? (d > 0.25 ? k : 0) : 0, AND.hl < 72);
      andHand(g, 0, Math.round(x + AND.hr), y + 24, AND.fr, col, dying ? (d > 0.55 ? Math.max(0.001, d - 0.55) : 0) : 0, AND.hr < 72);
    }

    /* ------------------------------------------------------------ drawing: the playfield (360 x H logical pixels) */
    var overlay = null, styleEl = null, scr = null, sx = null, pf = null, g = null, endEl = null, bombBtn = null, pauseBtn = null, exitBtn = null;
    var narrow = false, fixedOn = false, bandSay = false, dpr = 1, U = 1, pfX = 0, pfY = 0, pfW = 0, pfH = 0, scrW = 0, scrH = 0, gFont = 0, zig = new Float32Array(16);
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
      var k, wh = e.flash > 0 && ((G.t * 8) | 0) % 2 === 0, jx = e.dying > 0 ? ((Math.random() * 5) | 0) - 2 : 0, x = Math.round(e.x) + jx, y = Math.round(e.y);
      if (e.type === 'typesetter') {
        g.drawImage(SPR.typesetter, x - 78, y - 44);
        if (wh) { g.globalAlpha = 0.6; g.drawImage(WHT.typesetter, x - 78, y - 44); g.globalAlpha = 1; }   // hit flash you can still read
        var pulse = 0.5 + 0.5 * Math.sin(G.t * 9); g.fillStyle = e.phase ? '#ff4fa3' : '#e3625b'; g.fillRect(x - 9, y - 14, 18, 12); g.fillStyle = '#fff'; g.globalAlpha = 0.4 + pulse * 0.6; g.fillRect(x - 5, y - 11, 10, 6); g.globalAlpha = 1;
        return;
      }
      if (e.type === 'hive') { drawAndross(g, e, x, y, wh, P.x, P.y, G.t, BEAM[3]); return; }   // a polygon face, two hands, a cube
      for (var pass = 0; pass < 2; pass++) {
        if (pass === 1) {
          g.save(); g.translate(x, y); g.rotate(e.t * (e.phase === 2 ? 2.4 : 0.7)); g.drawImage(GEAR[e.phase === 2 ? 1 : 0], -56, -56); if (wh) { g.globalAlpha = 0.6; g.drawImage(GEAR[2], -56, -56); g.globalAlpha = 1; } g.restore();
          g.fillStyle = '#0b0c14'; g.beginPath(); g.arc(x, y, 26, 0, TAU); g.fill(); g.strokeStyle = e.phase === 2 ? '#ff4fa3' : '#fcd34d'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 25, 0, TAU); g.stroke();
          var rest = e.hp / HPM, tot = 0; for (k = 0; k < e.def.phases.length; k++) { tot += e.def.phases[k]; if (k > e.phase) rest += e.def.phases[k]; }
          txt('IF', x, y - 13, 8, e.phase === 2 ? '#ff9ccc' : '#9aa3b8'); txt((Math.max(0, rest) / tot * 64.8).toFixed(3), x, y - 1, 8, e.phase === 2 && ((G.t * 8) | 0) % 2 ? '#ff4fa3' : '#fcd34d');
        }
        if (e.phase < 2) for (k = 0; k < 6; k++) { coverPos(e, k, tmpPos); var front = Math.sin(e.a2 + k / 6 * TAU) > 0; if (front === (pass === 1)) g.drawImage(COVERS[k], Math.round(tmpPos.x) - 9, Math.round(tmpPos.y) - 12); }
      }
    }
    function drawBeams() {                                                         // the lasers: dim while they fade in, then a white-cored pink line you can read from anywhere
      var k, a = BEAM[3], ux, uy, x0 = BEAM[4], y0 = BEAM[5], on = BEAM[2] > 0;
      for (k = 0; k < 2; k++) {
        ux = x0 + Math.cos(BEAM[k]) * 700; uy = y0 + Math.sin(BEAM[k]) * 700;
        g.globalAlpha = a * (on ? 0.35 : 0.15); g.strokeStyle = '#ff4fa3'; g.lineWidth = on ? 9 : 5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ux, uy); g.stroke();
        g.globalAlpha = a; g.strokeStyle = on ? '#ff4fa3' : '#9f2f6a'; g.lineWidth = on ? 4 : 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ux, uy); g.stroke();
        if (on) { g.strokeStyle = ((G.t * 30) | 0) % 2 ? '#fff' : '#ffd6ea'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(ux, uy); g.stroke(); }
      }
      g.globalAlpha = 1;
    }
    function drawField() {
      var i, k, e, o, y, x, t = G.t, fr = ((t * 12) | 0) % 2;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = false; g.textBaseline = 'top';
      g.fillStyle = G.tlb ? '#10040c' : G.stage > 1 ? '#0c0614' : '#05060f'; g.fillRect(0, 0, W, H);
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
        var name = e.type === 'bracket' && e.a2 === -1 ? 'bracketR' : e.type, sp = SPR[name], ex = Math.round(e.x - sp.width / 2), ey = Math.round(e.y - sp.height / 2);
        g.drawImage(sp, ex, ey);
        if (e.flash > 0 && ((t * 8) | 0) % 2 === 0) { g.globalAlpha = 0.7; g.drawImage(WHT[name], ex, ey); g.globalAlpha = 1; }
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
      if (BEAM[3] > 0) drawBeams();
      for (i = 0; i < NB; i++) if (bal[i]) { k = bt[i]; g.drawImage(BS[k][k > 3 ? brot[i] : fr], (bx[i] - (k > 1 ? 7 : 4)) | 0, (by[i] - (k > 1 ? 7 : 4)) | 0); }
      for (i = 0; i < NT; i++) { o = TX[i]; if (o.on) txt(o.s, o.x | 0, o.y | 0, 8, o.life < 0.3 && ((t * 20) | 0) % 2 ? '#9aa3b8' : o.col); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (G.boss && G.boss.on) {
        e = G.boss; y = narrow ? (L2 ? 44 : 40) : 8;                     // narrow: clear of the score / chain block (and the rank bar) above
        if (narrow) { g.fillStyle = 'rgba(5,6,15,.62)'; g.fillRect(0, y - 4, W, 24); }
        txt(e.def.name, 10, y, 8, '#fff', 'left'); var np = e.def.phases.length - 1 - e.phase; for (k = 0; k < np; k++) { g.fillStyle = '#fcd34d'; g.fillRect(W - 16 - k * 8, y + 1, 6, 6); }
        g.fillStyle = '#11131c'; g.fillRect(9, y + 10, W - 18, 7); g.fillStyle = '#3b0d16'; g.fillRect(10, y + 11, W - 20, 5); g.fillStyle = e.hp / e.mhp < 0.25 && fr ? '#fff' : (e.phase === e.def.phases.length - 1 ? '#ff4fa3' : '#e3625b'); g.fillRect(10, y + 11, Math.max(0, (W - 20) * e.hp / e.mhp) | 0, 5);
      }
      if (G.warnT > 0) {
        var on = ((G.warnT * 3) | 0) % 2 === 0; g.fillStyle = 'rgba(120,0,10,' + (on ? 0.42 : 0.25) + ')'; g.fillRect(0, H / 2 - 74, W, 148);
        for (k = -1; k < 17; k++) { g.fillStyle = k % 2 ? '#11131c' : '#fcd34d'; x = k * 24 + ((G.t * 60) % 48); g.fillRect(x, H / 2 - 74, 24, 8); g.fillRect(W - x - 24, H / 2 + 66, 24, 8); }
        txt('WARNING', W / 2, H / 2 - 50, 32, on ? '#ff3b3b' : '#fcd34d');
        if (G.warnKind === 2) { txt('THE TRUE LAST BOSS', W / 2, H / 2 - 4, 8, on ? '#fff' : '#ff4fa3'); txt('PEER REVIEW HAS CONVENED', W / 2, H / 2 + 10, 8, '#fff'); txt('THEY HAVE NOT READ IT. THEY HAVE OPINIONS.', W / 2, H / 2 + 36, 8, '#ff9ccc'); }
        else { txt('A HUGE EDITORIAL BOARD', W / 2, H / 2 - 4, 8, '#fff'); txt('IS APPROACHING FAST', W / 2, H / 2 + 10, 8, '#fff'); txt('NO REFUNDS ON ARTICLE PROCESSING CHARGES', W / 2, H / 2 + 36, 8, '#ff9ccc'); }
      } else if (G.cardT > 0) {
        g.globalAlpha = Math.min(1, G.cardT * 3, (G.cardDur - G.cardT) * 4); g.fillStyle = 'rgba(5,6,15,.72)'; g.fillRect(0, H / 2 - 40, W, 74); g.fillStyle = '#fcd34d'; g.fillRect(0, H / 2 - 40, W, 2); g.fillRect(0, H / 2 + 32, W, 2);
        txt(G.cardTitle, W / 2, H / 2 - 26, G.cardTitle.length * 24 > W - 24 ? 16 : 24, '#fff'); txt(G.cardSub, W / 2, H / 2 + 10, 8, '#fcd34d'); g.globalAlpha = 1;
      }
      if (narrow) drawHudNarrow(fr);
      if (G.mode === 'continue' || G.mode === 'gameover') {
        g.fillStyle = 'rgba(5,6,15,.7)'; g.fillRect(0, 0, W, H);
        if (G.mode === 'continue') { txt('CONTINUE?', W / 2, H / 2 - 90, 24, '#fff'); txt(String(Math.max(0, Math.ceil(G.contT) - 1)), W / 2, H / 2 - 44, 64, '#fcd34d'); if (fr || G.contT % 1 > 0.3) txt(narrow ? 'TAP TO RESUBMIT' : 'PRESS FIRE TO RESUBMIT', W / 2, H / 2 + 44, 8, '#34d399'); txt('THE SCORE RESETS. THE REVIEWS DO NOT.', W / 2, H / 2 + 66, 8, '#9aa3b8'); }
        else { txt('GAME OVER', W / 2, H / 2 - 60, 32, '#e6e6e6'); txt('DESK REJECTED', W / 2, H / 2 - 8, 16, '#ff6b7a'); if (G.contT > 1 && ((t * 2) | 0) % 2) txt(narrow ? 'TAP TO TRY ANOTHER JOURNAL' : 'PRESS FIRE TO TRY ANOTHER JOURNAL', W / 2, H / 2 + 40, 8, '#34d399'); }
      }
      if (G.paused && G.mode !== 'ending') {
        g.fillStyle = 'rgba(5,6,15,.72)'; g.fillRect(0, 0, W, H); txt('PAUSED', W / 2, H / 2 - 30, 32, '#fff');
        txt(narrow ? 'TAP TO RESUME' : 'CLICK OR PRESS P TO RESUME', W / 2, H / 2 + 20, 8, '#fcd34d');
        txt('EXIT LEAVES THE GAME AND RETURNS', W / 2, H / 2 + 40, 8, '#9aa3b8'); txt('YOU TO THE SITE. IT KEEPS YOUR PLACE.', W / 2, H / 2 + 52, 8, '#9aa3b8');
        txt('OUT TO LUNCH. BACK IN 6-8 WEEKS.', W / 2, H / 2 + 76, 8, '#4a5470');
      }
    }
    function drawHudNarrow(fr) {
      var k, y = H - 12;
      txt(fmt(G.score), 6, 6, 8, '#fff', 'left'); txt('HI ' + fmt(G.hi), W - 6, 6, 8, '#9aa3b8', 'right');
      if (G.chain > 0) { txt(G.chain + ' HIT', 6, 18, 8, '#fcd34d', 'left'); g.fillStyle = '#11131c'; g.fillRect(6, 28, 62, 4); g.fillStyle = G.gauge < 0.3 && fr ? '#fff' : '#34d399'; g.fillRect(7, 29, (60 * G.gauge) | 0, 2); }
      if (L2) { k = G.chain > 0 ? 34 : 18; g.fillStyle = '#11131c'; g.fillRect(6, k, 62, 4); g.fillStyle = '#ff4fa3'; g.fillRect(7, k + 1, (60 * G.rank) | 0, 2); }   // the rank bar
      if (G.lives > 6) { g.drawImage(ICON.life, 6, y - 1); txt('x' + G.lives, 18, y, 8, '#fff', 'left'); }             // the level select's fifty ships: a count
      else if (G.lives > 0) { for (k = 0; k < Math.min(G.lives, 6); k++) g.drawImage(ICON.life, 6 + k * 11, y - 1); }
      else txt('LAST ONE', 6, y - 1, 8, '#ff6b7a', 'left');
      for (k = 0; k < Math.min(G.bombs, 6); k++) g.drawImage(ICON.bomb, 6 + k * 11, y - 11);
      txt('RBG'.charAt(G.weapon) + ' LV' + G.level, W - 6, y, 8, WEAP[G.weapon].col, 'right');
      if (G.sayT > 0 && G.sayLines && !bandSay) { var n = Math.floor(G.sayN), yy = H - 58 - G.sayLines.length * 10; txt(G.who, W / 2, yy, 8, '#fcd34d'); for (k = 0; k < G.sayLines.length && n > 0; k++) { yy += 11; txt(G.sayLines[k].slice(0, n), W / 2, yy, 8, '#fff'); n -= G.sayLines[k].length; } }
    }

    /* ------------------------------------------------------------ the cabinet: injected style, overlay, canvases */
    var CSS = '.qs-ov{position:absolute;inset:0;z-index:9;overflow:hidden;background:#05060f;font-family:' + FONT + ';' +
      'letter-spacing:.04em;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none;}' +
      '.qs-ov.is-fixed{position:fixed;inset:0;z-index:2147483000;}' +
      '.qs-ov canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;cursor:crosshair;outline:none;touch-action:none;letter-spacing:0;}' +
      '.qs-btn{position:absolute;z-index:3;margin:0;padding:0;font:inherit;font-family:' + FONT + ';color:#f4f6fb;' +
      'background:rgba(8,10,20,.55);border:2px solid rgba(244,246,251,.7);box-shadow:3px 3px 0 rgba(5,6,15,.8);' +
      'cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none;display:grid;place-items:center;}' +
      '.qs-btn:active{background:#fcd34d;color:#11131c;border-color:#fff;}' +
      '.qs-end{position:absolute;inset:0;z-index:12;display:flex;overflow:auto;padding:18px;' +
      'background:radial-gradient(ellipse at center,rgba(5,6,15,.78),rgba(5,6,15,.96));}' +
      '.qs-end__in{margin:auto;width:min(620px,100%);text-align:center;color:#f4f6fb;}' +
      '.qs-end__stamp{font-size:clamp(20px,5.6vw,42px);line-height:1.3;color:#34d399;text-shadow:5px 5px 0 #05060f;transform:rotate(-3deg);}' +
      '.qs-end__cite{margin:18px 0 20px;font-size:8px;line-height:2;color:#9aa3b8;}' +
      '.qs-end__stats{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 22px;margin-bottom:20px;}' +
      '.qs-end__stats span{display:flex;flex-direction:column;gap:8px;font-size:7px;color:#9aa3b8;}' +
      '.qs-end__stats b{font-size:13px;font-weight:400;color:#fcd34d;text-shadow:2px 2px 0 #05060f;}' +
      '.qs-end__quip{margin:0 0 10px;font-size:9px;line-height:2.1;}' +
      '.qs-end__dim{color:#9aa3b8;}' +
      '.qs-end__tease{color:#ff9ccc;}' +
      '.qs-end__stamp.is-tenure{color:#fcd34d;}' +
      '.qs-end__btns button.qs-l2{background:#ff4fa3;}' +
      '.qs-end__links{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:20px 0 18px;}' +
      '.qs-end__links a{font-size:8px;line-height:1.6;color:#6ee7ff;text-decoration:none;border:2px solid #6ee7ff;padding:9px 10px;}' +
      '.qs-end__links a:hover,.qs-end__links a:focus{background:#6ee7ff;color:#05060f;}' +
      '.qs-end__btns{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;}' +
      '.qs-end__btns button{font:inherit;font-family:' + FONT + ';font-size:10px;color:#11131c;background:#fcd34d;' +
      'border:2px solid #05060f;box-shadow:4px 4px 0 #05060f;padding:13px 14px;cursor:pointer;}' +
      '.qs-end__btns button:active{transform:translate(2px,2px);box-shadow:2px 2px 0 #05060f;}' +
      '.qs-end.is-back{padding:8px;}' +
      '.qs-end.is-back .qs-end__stamp{font-size:clamp(13px,4.2vw,24px);}' +
      '.qs-end.is-back .qs-end__cite{margin:6px 0 8px;line-height:1.6;}' +
      '.qs-end.is-back .qs-end__quip{display:none;}' +
      '.qs-end.is-back .qs-end__stats{gap:6px 14px;margin-bottom:10px;}' +
      '.qs-end.is-back .qs-end__stats span{gap:5px;}' +
      '.qs-end.is-back .qs-end__stats b{font-size:10px;}' +
      '.qs-end.is-back .qs-end__links{margin:8px 0 8px;gap:6px;}' +
      '.qs-end.is-back .qs-end__links a{padding:6px 7px;font-size:7px;}' +
      '.qs-end.is-back .qs-end__btns{gap:8px;}' +
      '.qs-end.is-back .qs-end__btns [data-qs="site"]{display:none;}' +                     // already back on the site: room for SECOND LOOP instead
      '.qs-end.is-back .qs-end__btns button{padding:8px 9px;font-size:8px;box-shadow:3px 3px 0 #05060f;}';

    var raf = 0, lastT = 0, acc = 0, STEP = 1 / 60, MAXSTEP = 40, frameN = 0, lastCW = 0, lastCH = 0;
    var autoPaused = false, offScreen = false, crashed = false, released = false, finished = false, dirty = true, idleT = 0, scrollY0 = 0, bodySave = null, htmlSave = '';
    var spritesBuilt = false, pFont = 0, tgtName = '', tgtLines = null, sayKey = '', sayPanel = null, bandChars = 34, bandKey = '', bandN = 0, bandLines = null;
    var STAGE_NAME = ['', 'COPYEDITING', 'PROOFS / PRODUCTION'], STAGE_NAME2 = ['', 'COPYEDITING (URA)', 'PROOFS (URA)'];
    var LEGEND = ['Z/SPC  FIRE', 'HOLD   LASER', 'X      BOMB', 'SHIFT  FOCUS', 'P/ESC  PAUSE', 'M      MUSIC'];

    function oops(err) { if (!crashed) { crashed = true; try { console.error('shmup: ', err); } catch (e) {} } }
    function nowSec() { return (window.performance && performance.now ? performance.now() : Date.now()) / 1000; }
    function tscale() { var p = api.params, t = p && p.timescale ? p.timescale : 1; return t > 0 ? t : 1; }

    /* full-viewport mode: the portrait playfield needs the whole phone, and the page must not scroll under it */
    function applyFixed(on) {
      on = !!on;
      if (on === fixedOn || !overlay) return;
      fixedOn = on;
      var b = document.body.style;
      if (on) {
        scrollY0 = window.pageYOffset || document.documentElement.scrollTop || 0;
        bodySave = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
        htmlSave = document.documentElement.style.overflow;
        b.position = 'fixed'; b.top = (-scrollY0) + 'px'; b.left = '0'; b.right = '0'; b.width = '100%'; b.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        overlay.className = 'qs-ov is-fixed';
      } else {
        overlay.className = 'qs-ov';
        if (bodySave) { b.position = bodySave.position; b.top = bodySave.top; b.left = bodySave.left; b.right = bodySave.right; b.width = bodySave.width; b.overflow = bodySave.overflow; bodySave = null; }
        document.documentElement.style.overflow = htmlSave || '';
        try { window.scrollTo(0, scrollY0); } catch (e) {}
      }
    }
    function setFixed(on) { released = !on; applyFixed(!!on); layout(); }

    function buildDom() {
      if (!document.getElementById('qs-style')) {
        styleEl = document.createElement('style'); styleEl.id = 'qs-style'; styleEl.textContent = CSS;
        (document.head || document.documentElement).appendChild(styleEl);
      } else styleEl = document.getElementById('qs-style');
      overlay = document.createElement('div'); overlay.className = 'qs-ov';
      overlay.setAttribute('role', 'application'); overlay.setAttribute('aria-label', 'Publish or Perish: a bullet-hell shooter');
      scr = document.createElement('canvas'); scr.setAttribute('tabindex', '0'); overlay.appendChild(scr);
      sx = scr.getContext('2d', { alpha: false });
      if (!pf) pf = mk(W, H);
      g = pf.getContext('2d'); g.imageSmoothingEnabled = false; gFont = 0;
      bombBtn = document.createElement('button'); bombBtn.type = 'button'; bombBtn.className = 'qs-btn'; bombBtn.textContent = 'BOMB';
      bombBtn.setAttribute('aria-label', 'Use a bomb');
      pauseBtn = document.createElement('button'); pauseBtn.type = 'button'; pauseBtn.className = 'qs-btn'; pauseBtn.textContent = '❚❚';
      pauseBtn.setAttribute('aria-label', 'Pause');
      exitBtn = document.createElement('button'); exitBtn.type = 'button'; exitBtn.className = 'qs-btn'; exitBtn.textContent = 'EXIT';
      exitBtn.setAttribute('aria-label', 'Leave the game and go back to the site'); exitBtn.hidden = true;
      overlay.appendChild(bombBtn); overlay.appendChild(pauseBtn); overlay.appendChild(exitBtn);
      bombBtn.addEventListener('pointerdown', btnBomb); pauseBtn.addEventListener('pointerdown', btnPause); exitBtn.addEventListener('pointerdown', btnExit);
      bombBtn.addEventListener('click', swallow); pauseBtn.addEventListener('click', swallow); exitBtn.addEventListener('click', swallow);
      (api.view || api.root || document.body).appendChild(overlay);
    }
    function swallow(e) { e.preventDefault(); e.stopPropagation(); }
    function btnBomb(e) { swallow(e); if (G && G.mode === 'play' && !G.paused) useBomb(); }
    function btnPause(e) { swallow(e); if (!G) return; if (G.mode === 'continue' || G.mode === 'gameover') doContinue(); else if (G.paused) resumeFromUser(); else setPaused(true); wake(); }
    function btnExit(e) { swallow(e); exitToSite(); }

    /* one screen canvas, the logical playfield blown up with nearest-neighbour, panels either side */
    function layout() {
      if (!overlay || !scr) return;
      var want = self.active && !released && (window.innerWidth || 1024) < 700;
      if (want !== fixedOn) applyFixed(want);
      var cw = Math.max(120, overlay.clientWidth || 320), ch = Math.max(120, overlay.clientHeight || 240);
      lastCW = cw; lastCH = ch;
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      scrW = Math.round(cw * dpr); scrH = Math.round(ch * dpr);
      if (scr.width !== scrW) scr.width = scrW;
      if (scr.height !== scrH) scr.height = scrH;
      scr.style.width = '100%'; scr.style.height = '100%';
      pFont = 0; sx.textBaseline = 'top';
      var panelMin = Math.round(104 * dpr), padY = Math.round(6 * dpr);
      narrow = fixedOn || cw < 620 || (scrW - 2 * panelMin) / W < (scrH - 2 * padY) / H * 0.62;
      var availH = scrH - (narrow ? 0 : 2 * padY), availW = narrow ? scrW : scrW - 2 * panelMin;
      var u = Math.min(availH / H, availW / W), iu = Math.floor(u);
      U = (iu >= 1 && iu / u > (narrow ? 0.96 : 0.86)) ? iu : u;     // integer scale when it costs almost nothing
      pfW = Math.round(W * U); pfH = Math.round(H * U);
      pfX = Math.round((scrW - pfW) / 2);
      var spare = scrH - pfH;
      pfY = Math.round(narrow && spare > 40 * dpr ? Math.max(spare * 0.34, Math.min(52 * dpr, spare - 86 * dpr)) : spare * 0.5);   // on a phone, leave the thumbs some room (and the pause button a strip above the HUD)
      bandSay = narrow && (scrH - pfY - pfH) > 52 * dpr;      // a taunt over the playfield is a taunt over a bullet
      dirty = true;
      placeButtons();
    }
    function placeButtons() {
      if (!bombBtn) return;
      var x = pfX / dpr, y = pfY / dpr, w = pfW / dpr, h = pfH / dpr, band = (scrH - pfY - pfH) / dpr;
      var s = narrow ? 64 : 46, fs = narrow ? 10 : 8, below = narrow && band > s + 20;
      bombBtn.style.width = s + 'px'; bombBtn.style.height = s + 'px'; bombBtn.style.borderRadius = '50%'; bombBtn.style.fontSize = fs + 'px';
      bombBtn.style.left = Math.round(x + w - s - (below ? 18 : 10)) + 'px';
      bombBtn.style.top = Math.round(below ? y + h + (band - s) / 2 : y + h - s - (narrow ? 38 : 14)) + 'px';
      bandChars = below ? Math.max(12, Math.floor((x + w - s - 18 - 20) * dpr / Math.max(8, Math.round(9 * dpr)))) : 34;   // the band's taunt stops short of the BOMB button
      var ps = narrow ? 44 : 34, pt;                                                  // a thumb needs 44 px, and room for its shadow
      pauseBtn.style.width = ps + 'px'; pauseBtn.style.height = (narrow ? 44 : 28) + 'px'; pauseBtn.style.fontSize = (narrow ? 11 : 9) + 'px'; pauseBtn.style.borderRadius = '0';
      exitBtn.style.height = (narrow ? 44 : 26) + 'px'; exitBtn.style.width = (narrow ? 64 : 62) + 'px'; exitBtn.style.fontSize = (narrow ? 10 : 8) + 'px'; exitBtn.style.borderRadius = '0';
      if (narrow) {
        pt = y >= ps + 6 ? Math.max(2, y - ps - 8) : y + 8;                           // above the playfield if it fits at all: inside, it covers the HI score and the boss's phase pips
        pauseBtn.style.left = Math.round(x + w - ps - 10) + 'px'; pauseBtn.style.top = Math.round(pt) + 'px';
        exitBtn.style.left = Math.round(Math.max(4, x + w - ps - 10 - 72)) + 'px'; exitBtn.style.top = Math.round(pt) + 'px';
      } else {
        pauseBtn.style.left = Math.round(scrW / dpr - 46) + 'px'; pauseBtn.style.top = '10px';           // out in the bezel, clear of the boss bar
        exitBtn.style.left = Math.round(scrW / dpr - 74) + 'px'; exitBtn.style.top = '46px';
      }
    }
    function checkSize() {
      if (!overlay) return;
      if (overlay.clientWidth !== lastCW || overlay.clientHeight !== lastCH) layout();
    }

    /* ------------------------------------------------------------ the bezel panels (wide screens only) */
    function ptxt(s, x, y, size, col, align) {
      if (pFont !== size) { sx.font = size + 'px ' + FONT; pFont = size; }
      sx.textAlign = align || 'left';
      var o = Math.max(1, (size / 9) | 0);
      sx.fillStyle = '#05060f'; sx.fillText(s, x + o, y + o);
      sx.fillStyle = col; sx.fillText(s, x, y);
    }
    function pips(x, y, n, max, w, h, col) {
      for (var k = 0; k < max; k++) { sx.fillStyle = k < n ? col : 'rgba(244,246,251,.14)'; sx.fillRect(x + k * Math.round(w * 1.4), y, w, h); }
    }
    function icons(img, x, y, n, max, s) {
      for (var k = 0; k < Math.min(n, max); k++) sx.drawImage(img, x + k * (img.width + 3) * s, y, img.width * s, img.height * s);
      if (n > max) ptxt('+' + (n - max), x + max * (img.width + 3) * s + 2, y, Math.max(7, s * 5), '#9aa3b8');
    }
    function panelFrame(x, w, pad) {
      sx.fillStyle = '#0b0f1c'; sx.fillRect(x + pad, pad, w - pad * 2, scrH - pad * 2);
      sx.fillStyle = '#1b2238'; sx.fillRect(x + pad, pad, w - pad * 2, Math.max(2, (dpr * 2) | 0));
      sx.fillStyle = '#141a2c'; sx.fillRect(x + pad, scrH - pad - Math.max(2, (dpr * 2) | 0), w - pad * 2, Math.max(2, (dpr * 2) | 0));
    }
    function drawPanels() {
      var k, i, e, pad = Math.round(8 * dpr), LW = pfX, RX = pfX + pfW, RW = scrW - RX;
      var fr = ((G.t * 6) | 0) % 2;
      var fs = clamp(Math.round(Math.min(LW, RW) / 22), Math.round(7 * dpr), Math.round(13 * dpr));
      var fl = Math.max(Math.round(fs * 0.78), 7), fv = Math.round(fs * 1.7), lh = Math.round(fs * 1.5), si = Math.max(1, Math.round(fs / 4));
      var x, y;

      /* ---- left: the score plate */
      panelFrame(0, LW, pad);
      x = pad * 2; y = pad * 3;
      ptxt('PUBLISH', x, y, fs, '#fcd34d'); y += lh;
      ptxt('OR PERISH', x, y, fs, '#fb7185'); y += Math.round(lh * 1.9);
      ptxt('1P SCORE', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      ptxt(fmt(G.score), x, y, fv, '#ffffff'); y += Math.round(fv * 1.6);
      ptxt('HI-SCORE', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      ptxt(fmt(G.hi), x, y, fs, '#fcd34d'); y += Math.round(lh * 1.8);
      ptxt(G.tlb ? 'FINAL' : 'STAGE ' + (L2 ? '2-' : '') + G.stage, x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.7);
      ptxt(G.tlb ? 'PEER REVIEW' : (L2 ? STAGE_NAME2 : STAGE_NAME)[G.stage] || '', x, y, fl, L2 ? '#ff9ccc' : '#8ad4ff'); y += Math.round(lh * 1.7);
      ptxt('HIT CHAIN', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      ptxt(G.chain > 0 ? G.chain + ' HIT' : '-', x, y, fs, G.chain > 0 ? (G.gauge < 0.3 && fr ? '#ffffff' : '#fcd34d') : '#4a5470'); y += Math.round(fs * 1.5);
      sx.fillStyle = '#11131c'; sx.fillRect(x, y, LW - pad * 4, Math.max(4, si * 3));
      sx.fillStyle = G.gauge < 0.3 && fr ? '#ffffff' : '#34d399';
      sx.fillRect(x + 1, y + 1, Math.max(0, (LW - pad * 4 - 2) * clamp(G.gauge, 0, 1)) | 0, Math.max(2, si * 3 - 2));
      y += Math.round(lh * 1.7);
      if (L2) {                                                                   // ura mode wears its rank on its sleeve
        ptxt('RANK', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
        sx.fillStyle = '#11131c'; sx.fillRect(x, y, LW - pad * 4, Math.max(4, si * 3));
        sx.fillStyle = G.rank > 0.85 && fr ? '#ffffff' : '#ff4fa3'; sx.fillRect(x + 1, y + 1, Math.max(0, (LW - pad * 4 - 2) * G.rank) | 0, Math.max(2, si * 3 - 2));
        y += Math.round(lh * 1.7);
      }
      var yc = scrH - pad * 3 - Math.round(fl * 1.4), fit = yc - Math.round(fl * 0.8), ln = Math.round(fl * 1.5);   // CREDIT is pinned to the bottom: a short window drops the blocks that would run into it
      if (y + Math.round(fl * 1.8) + fs <= fit) { ptxt('CITATIONS', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8); ptxt(fmt(G.cites), x, y, fs, '#fcd34d'); y += Math.round(lh * 1.8); }
      if (y + Math.round(fl * 1.8) + fs <= fit) { ptxt('MAX CHAIN', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8); ptxt(G.maxChain + ' HIT', x, y, fs, '#9aa3b8'); y += Math.round(lh * 1.9); }
      if (y + Math.round(fl * 1.8) + fl <= fit) {                              /* nearest thing worth shooting, named */
        var best = null, bs = -1;
        for (i = 0; i < NE; i++) { e = EN[i]; if (e.on && e.def && e.y > -e.hh && e.def.score > bs) { bs = e.def.score; best = e; } }
        ptxt('TARGET', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
        var nm = best ? best.def.name : '';
        if (nm !== tgtName) { tgtName = nm; tgtLines = nm ? wrap(nm, Math.max(8, Math.floor((LW - pad * 4) / fl))) : null; }
        if (tgtLines) for (k = 0; k < Math.min(3, tgtLines.length) && y + k * ln + fl <= fit; k++) ptxt(tgtLines[k], x, y + k * ln, fl, '#f4f6fb');
        else ptxt('-', x, y, fl, '#4a5470');
      }
      ptxt('CREDIT ' + Math.max(0, 99 - G.continues), x, yc, fl, ((G.t * 2) | 0) % 2 ? '#34d399' : '#1f8a60');

      /* ---- right: the ship plate */
      panelFrame(RX, RW, pad);
      x = RX + pad * 2; y = pad * 3;
      ptxt('SHIPS', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.9);
      if (G.lives > 6) { icons(ICON.life, x, y, 1, 1, si); ptxt('x' + G.lives, x + (ICON.life.width + 3) * si, y + Math.max(0, Math.round((ICON.life.height * si - fs) / 2)), fs, '#fff'); }
      else if (G.lives > 0) icons(ICON.life, x, y, G.lives, 5, si); else ptxt('LAST ONE', x, y, fl, '#ff6b7a');
      y += ICON.life.height * si + Math.round(fl * 1.6);
      ptxt('BOMBS', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.9);
      if (G.bombs > 0) icons(ICON.bomb, x, y, G.bombs, 5, si); else ptxt('NONE', x, y, fl, '#ff6b7a');
      y += ICON.bomb.height * si + Math.round(fl * 1.9);
      ptxt('WEAPON', x, y, fl, '#9aa3b8'); y += Math.round(fl * 1.8);
      var wl = wrapW(WEAP[G.weapon].name, Math.max(8, Math.floor((RW - pad * 4) / fl)));
      for (k = 0; k < wl.length; k++) ptxt(wl[k], x, y + k * Math.round(fl * 1.5), fl, WEAP[G.weapon].col);
      y += Math.round(fl * 1.5) * wl.length + Math.round(fl * 0.8);
      ptxt('POWER', x, y, fl, '#9aa3b8'); pips(x + Math.round(fl * 6.4), y, G.level, 4, Math.max(4, si * 4), Math.max(4, fl), '#fb923c'); y += Math.round(fl * 1.9);
      ptxt('SPEED', x, y, fl, '#9aa3b8'); pips(x + Math.round(fl * 6.4), y, G.speed + 1, 4, Math.max(4, si * 4), Math.max(4, fl), '#8ad4ff'); y += Math.round(fl * 2.4);
      /* who is talking */
      if (G.sayT > 0 && G.say) {
        if (sayKey !== G.say) { sayKey = G.say; sayPanel = wrap(G.say, Math.max(9, Math.floor((RW - pad * 4) / fl))); }
        sx.fillStyle = 'rgba(5,6,15,.6)'; sx.fillRect(x - pad, y - pad, RW - pad * 2, Math.round(fl * 1.5) * (sayPanel.length + 1) + pad * 2);
        ptxt(G.who, x, y, fl, '#fcd34d'); y += Math.round(fl * 1.7);
        var n = Math.floor(G.sayN);
        for (k = 0; k < sayPanel.length && n > 0; k++) { ptxt(sayPanel[k].slice(0, n), x, y, fl, '#f4f6fb'); n -= sayPanel[k].length; y += Math.round(fl * 1.5); }
      }
      /* controls, down at the bottom of the bezel */
      y = scrH - pad * 3 - Math.round(fl * 1.5) * LEGEND.length;
      for (k = 0; k < LEGEND.length; k++) ptxt(LEGEND[k], x, y + k * Math.round(fl * 1.5), fl, k === 0 || k === 1 ? '#9aa3b8' : '#5c6b85');
    }
    var wrapCache = {}, wrapCacheN = 0;
    function wrapW(text, max) {                                            // wrap(), but memoised: the panel redraws 60 times a second
      var key = max + '|' + text, v = wrapCache[key];
      if (v) return v;
      if (wrapCacheN > 60) { wrapCache = {}; wrapCacheN = 0; }
      wrapCacheN++; return (wrapCache[key] = wrap(text, max));
    }

    /* ------------------------------------------------------------ compose the cabinet */
    function compose() {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.imageSmoothingEnabled = false; sx.textBaseline = 'top';
      sx.fillStyle = '#080a14'; sx.fillRect(0, 0, scrW, scrH);
      if (!narrow && pfX > 40) { try { drawPanels(); } catch (e) { oops(e); narrow = true; } }
      sx.drawImage(pf, 0, 0, W, H, pfX, pfY, pfW, pfH);
      var b = Math.max(2, (dpr * 2) | 0);
      sx.fillStyle = '#1b2238';
      sx.fillRect(pfX - b, pfY - b, pfW + b * 2, b); sx.fillRect(pfX - b, pfY + pfH, pfW + b * 2, b);
      sx.fillRect(pfX - b, pfY, b, pfH); sx.fillRect(pfX + pfW, pfY, b, pfH);
      if (G.flash > 0.004 && !G.paused) { sx.globalAlpha = Math.min(1, G.flash); sx.fillStyle = '#ffffff'; sx.fillRect(pfX, pfY, pfW, pfH); sx.globalAlpha = 1; }   // a frozen frame must stay readable
      if (bandSay && G.sayT > 0 && G.say) {
        if (bandKey !== G.say || bandN !== bandChars) { bandKey = G.say; bandN = bandChars; bandLines = wrap(G.say, bandChars); }
        var fb = Math.max(8, Math.round(9 * dpr)), yb = pfY + pfH + Math.round(14 * dpr), nb = Math.floor(G.sayN), kb;
        ptxt(G.who, Math.round(12 * dpr), yb, fb, '#fcd34d', 'left'); yb += Math.round(fb * 1.9);
        for (kb = 0; kb < bandLines.length && nb > 0; kb++) { ptxt(bandLines[kb].slice(0, nb), Math.round(12 * dpr), yb, fb, '#f4f6fb', 'left'); nb -= bandLines[kb].length; yb += Math.round(fb * 1.5); }
      }
      if (G.wipe > 0.004) { sx.globalAlpha = Math.min(1, G.wipe); sx.fillStyle = '#ffffff'; sx.fillRect(0, 0, scrW, scrH); sx.globalAlpha = 1; }
    }

    /* ------------------------------------------------------------ the frame driver */
    function paint() {
      if (!G || !scr) return;
      var showExit = !finished && G.mode !== 'ending' && (G.paused || G.mode === 'continue' || G.mode === 'gameover');
      if (exitBtn && exitBtn.hidden === showExit) exitBtn.hidden = !showExit;
      try { drawField(); compose(); } catch (err) { oops(err); }
      dirty = false;
    }
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!self.active || !G || !scr) return;
      if (document.hidden) { lastT = 0; return; }                           // nothing animates in a tab nobody is looking at
      var dtr = lastT ? (ts - lastT) / 1000 : 0; lastT = ts;
      if (!(dtr > 0)) dtr = 0; else if (dtr > 0.1) dtr = 0.1;
      if ((frameN++ % 12) === 0) { checkVis(); checkSize(); }
      if (G.paused) {                                                       // paused or scrolled away: one last frame, then stop burning the machine
        acc = 0; lastT = 0; hush(true);
        if (dirty) paint();
        sleepLoop(false);
        return;
      }
      if (G.wipe > 0) { G.wipe = Math.max(0, G.wipe - dtr * 1.3); dirty = true; }
      acc += dtr * tscale();
      var n = 0;
      while (acc >= STEP && n < MAXSTEP) { acc -= STEP; n++; try { step(STEP); } catch (err) { oops(err); acc = 0; break; } }
      if (acc > 0.75) acc = 0;
      paint();
      if (nWant) warm(10); else warmIdle();                                // a sound is waiting for its render: the queue gets 10 ms a frame until it is done
    }
    function wake() {                                                       // anything that could need a frame calls this; it is free if we are awake
      if (!self.active || finished || !G) return;
      if (idleT) { clearInterval(idleT); idleT = 0; }
      if (!raf) { lastT = 0; acc = 0; raf = requestAnimationFrame(frame); }
    }
    function sleepLoop(forGood) {                                           // stop the rAF loop; a slow timer watches for the game coming back
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (idleT) { clearInterval(idleT); idleT = 0; }
      if (!forGood && self.active && !finished) idleT = setInterval(idleTick, 400);
    }
    function idleTick() {
      if (!self.active || !G || finished) { if (idleT) { clearInterval(idleT); idleT = 0; } return; }
      checkVis(); checkSize();
      if (!G.paused || dirty) wake();
    }
    function setPaused(v) {
      if (!G || G.mode === 'ending') return;
      v = !!v; if (v === G.paused) return;
      G.paused = v; autoPaused = false; dirty = true; sfx.pause();
      if (!v) wake();
    }
    function resumeFromUser() {                                             // they came back: on a phone that means the full screen again
      if (!G || finished) return;
      if (released) { if ((window.innerWidth || 1024) < 700 && G.mode !== 'ending') setFixed(true); else { released = false; layout(); } }
      setPaused(false); wake();
    }
    function checkVis() {                                                   // a game nobody is looking at should not run
      if (!G) return;
      var gone = !!document.hidden;
      if (!gone && !fixedOn && api.root && api.root.getBoundingClientRect) {
        var r = api.root.getBoundingClientRect(), vh = window.innerHeight || 800;
        var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        gone = vis < Math.min(r.height, vh) * 0.35;
      }
      offScreen = gone;
      if (gone && !G.paused) { G.paused = true; autoPaused = true; dirty = true; onBlur(); }   // let go of any held key: the reader has the page now
      else if (!gone && G.paused && autoPaused) { G.paused = false; autoPaused = false; dirty = true; wake(); }
    }

    /* ------------------------------------------------------------ input */
    var MOVEK = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
    var FIREK = { KeyZ: 1, Space: 1, KeyJ: 1 }, BOMBK = { KeyX: 1, KeyK: 1, KeyB: 1 };
    function grabbing() {                                                   // only swallow keys while the shooter really has the screen
      return !!(self.active && G && !released && !finished && !offScreen);
    }
    function onKey(e) {
      if (!grabbing()) return;
      var t = e.target;
      if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var down = e.type === 'keydown', c = e.code, used = true;
      if (MOVEK[c]) keys[MOVEK[c]] = down;
      else if (FIREK[c]) { keys.fire = down; if (down && !e.repeat) firePressed(); }
      else if (BOMBK[c]) { if (down && !e.repeat && !G.paused) useBomb(); }
      else if (c === 'ShiftLeft' || c === 'ShiftRight') keys.focus = down;
      else if (c === 'KeyP' || c === 'Escape') { if (down && !e.repeat) { if (G.mode === 'continue' || G.mode === 'gameover') doContinue(); else if (G.paused) resumeFromUser(); else setPaused(true); } }
      else if (c === 'KeyM') { if (down && !e.repeat) toggleMusic(); }
      else used = false;
      if (used) { e.preventDefault(); wake(); }                             // the page must not scroll under the shooter
    }
    function firePressed() {
      if (G.mode === 'continue' || G.mode === 'gameover') { doContinue(); return; }
      if (G.paused) return;
      if (G.mode === 'play' && P.dead <= 0) P.shotT = 0.04;                 // a tap always spits one volley
    }
    function toggleMusic() {
      try {
        var on = !api.musicWanted();
        api.setMusicWanted(on);
        if (on && (G.mode === 'play' || G.mode === 'continue') && G.warnT <= 0 && !(G.boss && G.boss.dying > 0)) api.music(G.tlb && G.boss ? bossMusic() : stageMusic());   // not over a WARNING, a dying boss or an ending
        floatText(on ? 'MUSIC ON' : 'MUSIC OFF', W / 2, H - 140, '#8ad4ff'); sfx.pause();
      } catch (e) {}
    }
    function ptDown(e) {
      if (!self.active || !G || finished) return;
      var t = e.target;
      if (t !== scr && t !== overlay) return;                               // the buttons and the ending screen look after themselves
      e.preventDefault();
      try { scr.focus(); } catch (err) {}
      if (G.mode === 'ending') return;
      wake();
      if (G.paused) { resumeFromUser(); return; }
      if (released) resumeFromUser();                                       // a deliberate tap on the game takes the screen back
      if (G.mode === 'continue' || G.mode === 'gameover') { doContinue(); return; }
      if (touch.id === -1) {
        touch.id = e.pointerId; touch.on = true; touch.lx = e.clientX; touch.ly = e.clientY; touch.t0 = nowSec(); touch.count = 1;
        try { scr.setPointerCapture(e.pointerId); } catch (err) {}
      } else { touch.count++; useBomb(); }                                  // second finger down: bomb
    }
    function ptMove(e) {
      if (!self.active || !G || finished || e.pointerId !== touch.id) return;
      var k = pfW > 0 ? (W * dpr / pfW) : 1;
      if (G.mode === 'play' && P.dead <= 0) {
        P.x = clamp(P.x + (e.clientX - touch.lx) * k, 9, W - 9);
        P.y = clamp(P.y + (e.clientY - touch.ly) * k, 18, H - 12);
      }
      touch.lx = e.clientX; touch.ly = e.clientY;
      e.preventDefault();
    }
    function ptUp(e) {
      if (e.pointerId !== touch.id) { if (touch.count > 1) touch.count--; return; }
      touch.id = -1; touch.on = false; touch.count = 0;
    }
    function onBlur() { keys.l = keys.r = keys.u = keys.d = keys.fire = keys.focus = false; touch.on = false; touch.id = -1; touch.count = 0; }
    function onVis() {
      if (document.hidden) { onBlur(); saveHi(); hush(true); if (G && !G.paused) { G.paused = true; autoPaused = true; dirty = true; } }
      else { checkVis(); wake(); }
      lastT = 0;
    }
    function onLeave() { saveHi(); }
    function onResize() { layout(); dirty = true; wake(); }
    function onScroll() { checkVis(); }                                     // scrolled away mid-fight? pause at once, do not wait for a frame

    function listen(on) {
      var m = on ? 'addEventListener' : 'removeEventListener';
      window[m]('keydown', onKey, true); window[m]('keyup', onKey, true);
      window[m]('blur', onBlur); window[m]('resize', onResize); window[m]('orientationchange', onResize); window[m]('pagehide', onLeave);
      window[m]('scroll', onScroll, { passive: true });
      window[m]('pointermove', ptMove, { passive: false }); window[m]('pointerup', ptUp); window[m]('pointercancel', ptUp);
      document[m]('visibilitychange', onVis);
      if (overlay) overlay[m]('pointerdown', ptDown, { passive: false });
      if (overlay) overlay[m]('contextmenu', swallow);
    }

    /* ------------------------------------------------------------ test hooks: ?shmupstage=2|mid|boss|tlb|ending  ?shmupgod=1  ?shmupdbg=1 */
    function applyJump() {
      if (!JUMP) return;
      var sc, k;
      if (JUMP === '2') { G.stage = 2; G.script = scriptFor(2); G.si = 0; G.st = 0; G.level = 2; G.speed = 2; }
      else if (JUMP === 'mid') {
        sc = G.script; for (k = 0; k < sc.length && sc[k][1] !== 'midboss'; k++);
        if (k < sc.length) { G.st = sc[k][0] - 0.1; G.si = k; } G.level = 3; G.speed = 2;
      } else if (JUMP === 'boss' || JUMP === 'tlb') {
        G.stage = 2; G.script = scriptFor(2); G.si = G.script.length; G.st = 0; G.level = 4; G.speed = 3; G.bombs = 3;
        if (JUMP === 'tlb') tlbWarning(); else { G.hold = true; G.warnT = 4.4; G.warnKind = 1; sfx.klaxon(); api.music('silence'); }
      } else if (JUMP === 'ending') {
        G.score = L2 ? 4127390 : 1284730; G.hi = Math.max(G.hi, G.score); G.maxChain = L2 ? 733 : 412; G.cites = L2 ? 2210 : 933; G.continues = 2; G.stage = 2; G.level = 4; G.speed = 3; G.tlb = L2;
        showEnding();
      }
    }
    function botThink() {                                                          // the test bot: any bullet or laser predicted to pass within reach gets a side-step perpendicular to its path (dead on: towards the middle); otherwise it drifts back under the boss and focuses when crowded
      var fx = 0, fy = 0, i, k, dx, dy, vx, vy, v2, vl, tc, cx, cy, d2, w, pxn, pyn, side, sg, near = 1e9, ux, uy, pr, pp;
      for (i = 0; i < NB; i++) {
        if (!bal[i]) continue;
        dx = bx[i] - P.x; dy = by[i] - P.y; if (dx * dx + dy * dy > 48400) continue;
        vx = bvx[i]; vy = bvy[i]; v2 = vx * vx + vy * vy || 1;
        tc = -(dx * vx + dy * vy) / v2; if (tc < 0) tc = 0; else if (tc > 0.9) tc = 0.9;
        cx = dx + vx * tc; cy = dy + vy * tc; d2 = cx * cx + cy * cy;
        if (d2 > 400) continue;                                                        // predicted to miss by more than 20 px: not a threat
        if (d2 < near) near = d2;
        w = 1 / ((d2 + 25) * (tc + 0.12));
        vl = Math.sqrt(v2); pxn = -vy / vl; pyn = vx / vl; side = cx * pxn + cy * pyn;
        sg = side > 1.5 ? 1 : side < -1.5 ? -1 : (pxn * (W / 2 - P.x) >= 0 ? -1 : 1);
        fx -= sg * pxn * w; fy -= sg * pyn * w;
      }
      if (BEAM[3] > 0) for (k = 0; k < 2; k++) {
        ux = Math.cos(BEAM[k]); uy = Math.sin(BEAM[k]); dx = P.x - BEAM[4]; dy = P.y - BEAM[5]; pr = dx * ux + dy * uy; pp = dx * uy - dy * ux;
        if (pr > 0 && Math.abs(pp) < 70) { w = 30 / ((Math.abs(pp) + 6) * (Math.abs(pp) + 6)); if (pp < 0) w = -w; fx += uy * w; fy -= ux * w; if (pp * pp < near) near = pp * pp; }
      }
      fx += (W / 2 - P.x) * 0.00005; fy += (390 - P.y) * 0.00004;
      if (P.x < 36) fx += 0.004; if (P.x > W - 36) fx -= 0.004; if (P.y < 220) fy += 0.004; if (P.y > H - 28) fy -= 0.004;
      keys.l = fx < -0.0002; keys.r = fx > 0.0002; keys.u = fy < -0.0002; keys.d = fy > 0.0002; keys.focus = near < 200;
    }
    function dbgInstall() {                                                        // ?shmupdbg=1: a read-out and the bot, the shape ?bossdbg=1 gives the bosses
      if (!DBG) return;
      window.__qs = {
        info: function () {
          if (!G) return null; var e = G.boss && G.boss.on ? G.boss : null, nd = 0, en = 0, i;
          for (i = 0; i < NB; i++) if (bal[i] && bt[i] > 3) nd++;
          for (i = 0; i < NE; i++) if (EN[i].on && !EN[i].boss) en++;
          return { mode: G.mode, loop: G.loop, stage: G.stage, tlb: G.tlb, boss: e ? e.type : '', phase: e ? e.phase : -1, hp: e ? Math.round(e.hp) : 0, shut: e ? e.shut : 0, lt: e ? +e.lt.toFixed(2) : 0,
            ghosts: G.ghosts, bLive: bLive, bPeak: G.bPeak, needles: nd, enemies: en, revenge: G.revenge, t: +G.t.toFixed(1), st: +G.st.toFixed(1), x: Math.round(P.x), y: Math.round(P.y), score: G.score, chain: G.chain, rank: +G.rank.toFixed(2),
            lives: G.lives, continues: G.continues, level: G.level, weapon: G.weapon, dead: P.dead > 0, paused: G.paused, warnT: +G.warnT.toFixed(1), card: G.cardT > 0 ? G.cardTitle : '', say: G.sayT > 0 ? G.say : '' };
        },
        bot: function (on) { botOn = !!on; if (!on) onBlur(); return botOn; },
        phase: function (n) {
          var e = G && G.boss; if (!e || !e.on || e.dying > 0) return false;
          n = clamp(n | 0, 0, e.def.phases.length - 1); e.phase = n; e.hp = e.mhp = e.def.phases[n] * (e.def.tlb ? 1 : HPM); e.lt = 0.5; e.a = 0; e.ft = e.ft2 = e.ft3 = e.ft4 = 0.3; e.shut = 0; BEAM[2] = BEAM[3] = 0;
          cancelBullets(false); G.ghosts = 0; G.bPeak = 0; return true;
        },
        reset: function () { if (G) { G.ghosts = 0; G.bPeak = 0; } },
        rank: function (v) { if (G) G.rank = clamp(+v || 0, 0, 1); return G ? G.rank : 0; },
        pos: function (x, y) { P.x = clamp(x, 9, W - 9); P.y = clamp(y, 18, H - 12); },
        give: function (kind, colour) { if (G) collect({ on: true, kind: kind, t: (colour || 0) * 1.1, x: P.x, y: P.y - 20 }); },   // as if the ship flew into a W (colour 0-2), P, S, B or 1
        sim: function (sec) {                                                  // advance the fixed-step simulation without waiting for frames (a loaded box starves rAF)
          if (!G || G.paused || !scr) return 0; var n = Math.round(sec / STEP), k;
          for (k = 0; k < n && G && G.mode !== 'ending'; k++) { if (G.wipe > 0) G.wipe = Math.max(0, G.wipe - STEP * 1.3); try { step(STEP); } catch (err) { oops(err); break; } }
          dirty = true; paint(); return k * STEP;
        },
        sfx: {                                                                 // the sound bank, for offline measurement
          names: function () { return FXN.slice(); },
          spec: function (n) { var f = FX[n]; return f ? { p: f.p, gap: f.gap || 0, len: f.len, pk: f.pk, l2: f.l2 || 0, lp: M1, n: f.n || 1, cents: f.cents || 0, loop: !!f.loop, lfo: f.lfo === undefined ? -1 : f.lfo } : null; },
          render: function (n, rate, parts, raw) { return FX[n] ? renderRaw(n, rate || 48000, parts || 0, !!raw) : null; },   // parts: 1 FM, 2 DAC, 4 PSG (0: all); raw: one full channel = 1, not levelled; an l2 sound's second-loop copies follow its variants
          ym: function (sc, secs, lfo) { return ymScore(sc, secs, lfo); },     // a score straight off the chip at 53,267 Hz, before the output stage
          chip: { rate: FS, patches: PT },
          play: function (n, rate) { return FX[n] && !FX[n].loop ? play(n, rate) : false; },
          bus: function (ctx) { var c = mkBus(ctx); c[1].connect(ctx.destination); return c[0]; },
          log: function () { var o = [], i; for (i = 0; i < logN; i++) o.push([+LOGT[i].toFixed(3), LOGN[i] === 255 ? 'hush' : LOGN[i] === 254 ? 'beamOff' : FXN[LOGN[i]], +LOGR[i].toFixed(4), LOGK[i]]); return o; },
          stats: function () { var n = 0; for (var k in BANK) if (BANK.hasOwnProperty(k)) n++; return { vMax: vMax, drops: drops, steals: steals, misses: misses, lateMs: Math.round(lateMax * 1000), overMs: +(overMax * 1000).toFixed(2), plays: logN, warm: n + '/' + FXN.length, renderMs: Math.round(renderMs * 1000), rate: bankSR }; },
          reset: function () { logN = 0; vMax = 0; drops = 0; steals = 0; misses = 0; lateMax = 0; overMax = 0; }
        }
      };
    }

    /* ------------------------------------------------------------ start / stop */
    function start(opts) {
      if (self.active) return;
      try {
        crashed = false; released = false; finished = false; autoPaused = false; offScreen = false; dirty = true;
        if (!spritesBuilt) { buildSprites(); spritesBuilt = true; }
        audioInit();
        buildDom();
        newGame(opts && opts.loop ? +opts.loop : api.params && api.params.loop ? +api.params.loop : 1);
        for (var i = 0; i < NSTAR; i++) { stx[i] = Math.random() * W; sty[i] = Math.random() * H; stl[i] = i % 5 === 0 ? 2 : i % 2; }
        G.wipe = 1; G.flash = 0;                                            // the boss cinematic hands over on a white flash
        self.active = true;
        listen(true);
        layout();
        applyJump();
        dbgInstall();
        warm(30);                                                           // the head of the queue now, behind the white flash
        sfx.start();
        if (G.mode === 'play' && G.warnT <= 0) api.music(stageMusic());
        lastT = 0; acc = 0; frameN = 0;
        raf = requestAnimationFrame(frame);
        try { scr.focus(); } catch (e) {}
      } catch (err) { oops(err); try { stop(); } catch (e) {} }
    }
    function stop() {
      self.active = false;
      saveHi();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (idleT) { clearInterval(idleT); idleT = 0; }
      listen(false);
      applyFixed(false);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      overlay = styleEl = scr = sx = g = endEl = bombBtn = pauseBtn = exitBtn = null;
      hush(true); try { if (busOut) busOut.disconnect(); } catch (e) {}
      if (idleReq && window.cancelIdleCallback) cancelIdleCallback(idleReq); idleReq = 0;
      bus = busOut = loopG = null; VOX = []; gates = {};                   // the AudioContext belongs to the host: never close it. The rendered bank is kept
      try { clearPools(); } catch (e) {}
      G = null; tgtName = ''; tgtLines = null; sayKey = ''; sayPanel = null; bandKey = ''; bandLines = null; released = false; finished = false; dirty = true;
      botOn = false; L2 = false; BSP = 1; BEAM[2] = BEAM[3] = 0;
      if (DBG) try { delete window.__qs; } catch (e) {}
    }

    return self;
  };
})();
