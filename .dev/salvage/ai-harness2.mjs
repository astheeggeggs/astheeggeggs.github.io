// Deterministic reviewer-AI harness v2: steps updateBaddies(dt=1/60) synchronously inside the page (no rendering in between).
// usage: node ai-harness2.mjs <label> [--baseline]     (--baseline serves the pre-AI quest.js + debug handle to THIS browser only)
// Port 9413 / profile 'ai' only.
import { launch } from './cdp-lib-ai.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
const label = process.argv[2] || 'run', BASE = process.argv.includes('--baseline');
const SP = '/private/tmp/claude-501/-Users-dpalmer-Repositories-astheeggeggs-github-io/f5b11ed9-11aa-462e-928d-9244e9a80e8c/scratchpad';
const DEBUG_BLOCK = `
  (function () {
    var inner = updateBaddies, gt = 0, calls = 0, innerCollide = collide;
    collide = function (x, z, r) { calls++; return innerCollide(x, z, r); };
    updateBaddies = function (dt) { gt += dt; inner(dt); };
    window.__debug = { BADDIES: BADDIES, player: player, pstate: pstate, collide: collide, colliders: colliders,
      set: function (o) { if ('dread' in o) dread = o.dread; if ('dialogOpen' in o) dialogOpen = o.dialogOpen; if ('camYaw' in o) camYaw = o.camYaw; if ('fpPitch' in o) fpPitch = o.fpPitch; },
      get: function () { return { fp: fp, dread: dread, hits: hits, over: over, running: running, gt: gt }; },
      step: function (dt) { inner(dt); }, calls: function () { var c = calls; calls = 0; return c; } };
  })();
`;
const PAGE = String.raw`
window.__aiTest = function (sc) {
  var D = window.__debug, B = D.BADDIES, P = D.player, dt = 1 / 60, T = sc.seconds || 40, N = Math.round(T / dt);
  var dread = sc.dread === undefined ? 1 : sc.dread, range = 14 + 10 * dread;
  function los(ax, az, bx, bz) { var d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25); for (var i = 1; i < n - 3; i++) { var f = i / n; if (D.collide(ax + (bx - ax) * f, az + (bz - az) * f, 0.5)) return false; } return true; }
  function ppos(t) { if (!sc.path) return sc.player; var L = sc.path, sp = sc.pspeed || 9, s = (t * sp), i, tot = 0, segs = [];
    for (i = 0; i < L.length; i++) { var a = L[i], b = L[(i + 1) % L.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push(l); tot += l; }
    s = s % tot; for (i = 0; i < L.length; i++) { if (s <= segs[i]) { var a2 = L[i], b2 = L[(i + 1) % L.length], f = s / segs[i]; return [a2[0] + (b2[0] - a2[0]) * f, a2[1] + (b2[1] - a2[1]) * f]; } s -= segs[i]; } return L[0]; }
  var p0 = ppos(0), out = { name: sc.name, dread: dread, range: range, player: p0, r: [] };
  if (D.collide(p0[0], p0[1], 0.5)) out.playerBlocked = true;
  B.forEach(function (b, i) {
    var s = sc.spawn[i]; b.flee = sc.flee || 0; b.cool = sc.flee ? sc.flee + 2 : 0; b.down = 0; b.hp = 2; b.wander = 0; b.mesh.visible = true;
    if (b.plan !== undefined) { b.plan = 0; b.esc = 0; b.careful = 0; b.stuckN = 0; b.stuckT = 0; b.chase = false; b.goHome = false; b.mode = 0; }
    if (s) b.mesh.position.set(s[0], 0, s[1]); else { b.down = 1e6; b.mesh.visible = false; }
    var d0 = s ? Math.hypot(s[0] - p0[0], s[1] - p0[1]) : null;
    out.r.push({ i: i + 1, spawn: s || null, spawnInside: s ? D.collide(s[0], s[1], 0.5) : null, d0: d0, inRange: s ? d0 < range : false, los0: s ? los(s[0], s[1], p0[0], p0[1]) : null,
      arrive: null, catches: 0, stall: 0, hungry: 0, idle: 0, windows: 0, path: 0, dmin: d0, dEnd: null, vmax: 0, trace: [], insideFrames: 0, homeD0: s ? Math.hypot(s[0] - b.home.x, s[1] - b.home.z) : null, homeAt: null, homeDEnd: null, minSep: 99, overlap: 0 });
  });
  var win = B.map(function (b) { return { x: b.mesh.position.x, z: b.mesh.position.z, ok: true, near: false }; }), lastCool = B.map(function () { return 0; });
  var tCost = 0, worst = 0, over1 = 0, costs = new Float64Array(N), shots = [], shotT = 0, fired = [0, 0, 0], hit = [0, 0, 0], laps = 0, callSum = 0, callMax = 0, slow = []; if (D.calls) D.calls();
  if (sc.camYaw !== undefined) D.set({ camYaw: sc.camYaw, fpPitch: 0 });
  for (var k = 0; k < N; k++) {
    var t = k * dt, pp = ppos(t); P.position.set(pp[0], 0, pp[1]); D.pstate.y = 0; D.set({ dread: dread, dialogOpen: false });
    if (sc.nocatch) B.forEach(function (b) { b.cool = 1e9; });
    if (sc.aimAt !== undefined && B[sc.aimAt].down <= 0) { var am = B[sc.aimAt].mesh.position; D.set({ camYaw: Math.atan2(-(am.x - pp[0]), -(am.z - pp[1])), fpPitch: 0 }); }
    else if (sc.aimAway) D.set({ camYaw: sc.aimAway, fpPitch: 0 });
    var px0 = B.map(function (b) { return [b.mesh.position.x, b.mesh.position.z]; });
    var c0 = performance.now(); D.step(dt); var c1 = performance.now() - c0; tCost += c1; costs[k] = c1; if (c1 > worst) worst = c1; if (c1 >= 1) over1++; if (D.calls) { var cc = D.calls(); callSum += cc; if (cc > callMax) callMax = cc; if (c1 >= 1) slow.push([k, +c1.toFixed(1), cc, D.nav ? +D.nav.flooding() : 0]); }
    if (sc.shots) { var sb = B[0].mesh.position, sd0 = Math.hypot(sb.x - pp[0], sb.z - pp[1]);
      if (sd0 < 4.5) { var ls = sc.spawn[0]; sb.x = ls[0]; sb.z = ls[1]; laps++; }
      else { shotT -= dt; if (shotT <= 0 && sd0 >= 9) { shotT = 0.32; var bin = sd0 < 13 ? 0 : sd0 < 18 ? 1 : 2; shots.push({ x: pp[0], z: pp[1], vx: (sb.x - pp[0]) / sd0 * 30, vz: (sb.z - pp[1]) / sd0 * 30, trav: 0, bin: bin }); fired[bin]++; } }
      for (var q = shots.length - 1; q >= 0; q--) { var sh = shots[q]; sh.x += sh.vx * dt; sh.z += sh.vz * dt; sh.trav += 30 * dt; if (Math.hypot(sh.x - sb.x, sh.z - sb.z) < 1.0) { hit[sh.bin]++; shots.splice(q, 1); } else if (sh.trav > sd0 + 1.5) shots.splice(q, 1); } }
    B.forEach(function (b, i) {
      var R = out.r[i]; if (!R.spawn) return; var m = b.mesh.position, d = Math.hypot(m.x - pp[0], m.z - pp[1]);
      var stepLen = Math.hypot(m.x - px0[i][0], m.z - px0[i][1]); R.path += stepLen;
      if (stepLen < 1.5 && stepLen / dt > R.vmax) R.vmax = stepLen / dt;      // (respawn teleports excluded)
      if (d < R.dmin) R.dmin = d;
      if (R.arrive === null && d < 1.7) R.arrive = +(t + dt).toFixed(2);
      if (!sc.nocatch) { if (b.cool > lastCool[i] + 3) { R.catches++; if (R.arrive === null) R.arrive = +(t + dt).toFixed(2); } lastCool[i] = b.cool; }
      if (D.collide(m.x, m.z, 0.49)) R.insideFrames++;
      var hd = Math.hypot(m.x - b.home.x, m.z - b.home.z); if (R.homeAt === null && hd < 16) R.homeAt = +(t + dt).toFixed(1);
      for (var j = 0; j < B.length; j++) if (j !== i && out.r[j].spawn && B[j].down <= 0) { var sd = Math.hypot(m.x - B[j].mesh.position.x, m.z - B[j].mesh.position.z); if (sd < R.minSep && k > 30) R.minSep = sd; if (sd < 0.7 && k > 30) R.overlap += dt; }
      var hungry = b.flee <= 0 && b.down <= 0 && (sc.nocatch || b.cool <= 0) && d > 2.5 && d < range; if (!hungry) win[i].ok = false;
      if (d < 2.5 || b.down > 0) win[i].near = true;
      if ((k + 1) % 60 === 0) {
        var moved = Math.hypot(m.x - win[i].x, m.z - win[i].z);
        if (win[i].ok) { R.hungry++; if (moved < 0.3) R.stall++; }
        if (!win[i].near) { R.windows++; if (moved < 0.3) R.idle++; }
        win[i] = { x: m.x, z: m.z, ok: true, near: false };
      }
      if (k % 30 === 0) R.trace.push(+d.toFixed(1));
      if (k === N - 1) { R.dEnd = +d.toFixed(1); R.homeDEnd = +hd.toFixed(1); }
    });
  }
  var sorted = Array.prototype.slice.call(costs).sort(function (a, b) { return a - b; });
  out.over1 = over1; out.steps = N; out.collidePerStep = +(callSum / N).toFixed(1); out.collideMax = callMax; out.slow = slow.slice(0, 12); if (sc.shots) out.shots = { fired: fired, hit: hit, laps: laps };
  out.msPerStep = +(tCost / N).toFixed(4); out.p50 = +sorted[Math.floor(N * 0.5)].toFixed(4); out.p99 = +sorted[Math.floor(N * 0.99)].toFixed(3); out.worstStepMs = +worst.toFixed(3);
  out.r.forEach(function (R) { if (!R.spawn) return; R.path = +R.path.toFixed(1); R.dmin = +R.dmin.toFixed(2); R.d0 = R.d0 === null ? null : +R.d0.toFixed(1); R.vmax = +R.vmax.toFixed(2); R.minSep = +R.minSep.toFixed(2); R.overlap = +R.overlap.toFixed(1); R.homeD0 = +R.homeD0.toFixed(1); });
  if (D.nav && D.nav.state) out.state = D.nav.state();
  return JSON.stringify(out);
};
'ok'`;

const HOMES = [[-20, -6], [22, -4], [-14, 30], [30, 30], [8, 12], [-44, 4]];
const SC = [
  { name: 'S0 control: open ground, clear LOS (positive) + out of range (negative)', player: [-16, 2.5], seconds: 20,
    spawn: [[-16, -9.5], [-27, 4], [-4.5, 3.5], null, null, [40, -44]] },
  { name: 'S1 Library door; reviewers behind the building row', player: [-6, 26.1], seconds: 40,
    spawn: [[-6, 12], [-9, 11], [-2, 13.6], [2, 14], [-11, 13.5], [-16, 36]] },
  { name: 'S2 Fountain / bench / NPC in the way', player: [0, 7.5], seconds: 40,
    spawn: [[0, -9], [1, -12], [-1.5, -8], [-14, 7], [8, -15], [0.3, -5]] },
  { name: 'S3 Across the lake', player: [0, 28.3], seconds: 40,
    spawn: [[3, 51.8], [-8, 50], [8, 50], [12.5, 45], [-12.5, 45], [0, 52]] },
  { name: 'S4 Stats dept door; reviewers north of the row', player: [-12, -16.4], seconds: 40,
    spawn: [[-12, -30], [-16, -29], [-8, -29.5], [-12, -34], [-4, -28], [-20, -28.5]] },
  { name: 'S5 Default homes, player at start', player: [0, 4], seconds: 40, spawn: HOMES },
  { name: 'S6 Moving player: laps round Broad/MGH at speed 7.5', path: [[2, -16], [22, -16], [22, -32], [2, -32]], pspeed: 7.5, seconds: 60, spawn: HOMES },
  { name: 'S7 Moving player: town circuit at speed 8.5', path: [[0, 5], [-20, 8], [-22, 24], [-14, 28], [8, 28], [26, 26], [28, 10], [10, 6]], pspeed: 8.5, seconds: 60, spawn: HOMES },
  { name: 'S8 Aimed at: player stares down reviewer 1 along the north road and fires at where it IS every 0.32 s (laps: reset at 4.5 u)', player: [-32, -10], seconds: 90, aimAt: 0, shots: true, nocatch: true, kind: 'shots',
    spawn: [[-9, -10], null, null, null, null, null] },
  { name: 'S8b control for S8: same shots, but the view points away (no zigzag expected)', player: [-32, -10], seconds: 90, aimAway: 0.001, shots: true, nocatch: true, kind: 'shots',
    spawn: [[-9, -10], null, null, null, null, null] },
  { name: 'S9 Flee 7 s from the Library door (open side)', player: [-6, 26.1], seconds: 7, flee: 7, kind: 'flee',
    spawn: [[-6, 28.5], [-3.5, 26.5], [-8.5, 26.5], [-4, 29], [-8, 29], [-6, 30.5]] },
  { name: 'S10 Flee 7 s INTO a wall: reviewers between the player and the Stats dept front', player: [-12, -14.7], seconds: 7, flee: 7, kind: 'flee',
    spawn: [[-12, -16.6], [-9.5, -16.6], [-14.5, -16.6], [-7.5, -16.4], [-16.5, -16.4], [-10.8, -16.2]] },
  { name: 'S11 Walk home (dread 0, player far away in the NE corner): each spawned behind a building from its desk', player: [50, -50], dread: 0, seconds: 120, kind: 'home',
    spawn: [[-34, -30], [12, -34], [-30, 8], [36, 8], [-6, 32], [-30, 26]] },
  { name: 'S12 Cost: six chasing a moving player round the town, catching disabled', path: [[0, 5], [-20, 8], [-22, 24], [-14, 28], [8, 28], [26, 26], [28, 10], [10, 6]], pspeed: 8.5, seconds: 60, nocatch: true, kind: 'cost',
    spawn: [[-6, 12], [-9, 11], [-2, 13.6], [2, 14], [-11, 13.5], [-16, 36]] }
];

const b = await launch({ port: 9413, profile: 'ai' });
const results = [];
try {
  if (BASE) {
    let src = readFileSync(`${SP}/quest.pre-ai.js`, 'utf8');
    const at = src.indexOf('  function showToast(msg) {'); if (at < 0) throw new Error('marker');
    src = src.slice(0, at) + DEBUG_BLOCK + src.slice(at);
    new Function(src);
    await b.send('Fetch.enable', { patterns: [{ urlPattern: '*assets/js/quest.js*' }] });
    b.on('Fetch.requestPaused', p => { b.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: Buffer.from(src).toString('base64') }); });
  }
  await b.goto('http://127.0.0.1:4321/?dread=0.71&god=1&timescale=1');
  await b.waitFor(`!!window.__debug`, 20000);
  console.log('variant:', BASE ? 'BASELINE (pre-AI quest.js served by interception)' : 'CURRENT quest.js', '| has nav:', await b.ev(`!!window.__debug.nav`));
  await b.startGame();
  await b.waitFor(`window.__debug.get().fp === true`, 20000);
  await b.ev(PAGE);
  for (const sc of SC) {
    const r = JSON.parse(await b.ev(`window.__aiTest(${JSON.stringify(sc)})`)); r.kind = sc.kind || 'chase';
    results.push(r);
    console.log(`\n== ${r.name}  [dread ${r.dread}, range ${r.range}]  cost mean ${r.msPerStep} p99 ${r.p99} worst ${r.worstStepMs} ms/step, steps>=1ms ${r.over1}/${r.steps}, collide calls/step mean ${r.collidePerStep} max ${r.collideMax}${r.playerBlocked ? '  PLAYER SPOT BLOCKED!' : ''}`);
    if (r.slow && r.slow.length) console.log('  slow steps [step, ms, collide calls, flooding]: ' + JSON.stringify(r.slow));
    for (const R of r.r) {
      if (!R.spawn) continue;
      if (r.kind === 'shots') console.log(`  R${R.i} laps=${r.shots.laps} naive-aim hits/fired  9-13u ${r.shots.hit[0]}/${r.shots.fired[0]}  13-18u ${r.shots.hit[1]}/${r.shots.fired[1]}  18-24u ${r.shots.hit[2]}/${r.shots.fired[2]}  path=${R.path} vmax=${R.vmax}`);
      else if (r.kind === 'flee') console.log(`  R${R.i} spawn(${R.spawn}) d0=${R.d0}${R.spawnInside ? ' SPAWN-INSIDE' : ''} -> dEnd=${R.dEnd} path=${R.path} idle=${R.idle}/${R.windows}s vmax=${R.vmax} minSep=${R.minSep} inside=${R.insideFrames}f`);
      else if (r.kind === 'home') console.log(`  R${R.i} spawn(${R.spawn}) homeD0=${R.homeD0}${R.spawnInside ? ' SPAWN-INSIDE' : ''} -> within16ofHome=${R.homeAt === null ? 'NEVER' : R.homeAt + 's'} homeDEnd=${R.homeDEnd} path=${R.path} idle=${R.idle}/${R.windows}s vmax=${R.vmax}`);
      else {
        console.log(`  R${R.i} spawn(${R.spawn}) d0=${R.d0} inRange=${R.inRange} LOS=${R.los0}${R.spawnInside ? ' SPAWN-INSIDE' : ''} -> arrive=${R.arrive === null ? 'NEVER' : R.arrive + 's'} catches=${R.catches} dmin=${R.dmin} path=${R.path} stall=${R.stall}/${R.hungry}s idle=${R.idle}/${R.windows}s vmax=${R.vmax} minSep=${R.minSep} overlap=${R.overlap}s inside=${R.insideFrames}f`);
        console.log(`       d(t) every 0.5s: ${R.trace.slice(0, 40).join(' ')}`);
      }
    }
  }
  const errs = b.errors.filter(e => !/404|Failed to load resource/.test(e));
  console.log('\nerrors:', errs.length ? errs : 'none');
  let callsTot = 0; let inR = 0, arrived = 0, stall = 0, hungry = 0, inside = 0, idle = 0, windows = 0, vmax = 0, overlap = 0, over1 = 0, steps = 0;
  for (const r of results) for (const R of r.r) { if (!R.spawn) continue; if (r.kind === 'chase' && R.inRange && !/Moving|Aimed|control for S8/.test(r.name)) { inR++; if (R.arrive !== null) arrived++; } stall += R.stall; hungry += R.hungry; inside += R.insideFrames; idle += R.idle; windows += R.windows; overlap += R.overlap; if (R.vmax > vmax) vmax = R.vmax; }
  for (const r of results) { over1 += r.over1; steps += r.steps; callsTot += (r.collidePerStep || 0) * r.steps; }
  console.log(`\nSUMMARY ${label}: static chase scenarios: ${arrived}/${inR} in-range reviewers reached catching distance; stalled ${stall}/${hungry} hungry-seconds; idle ${idle}/${windows} away-from-player seconds; frames-inside-collider ${inside}; max speed seen ${vmax}; pair-overlap(<0.7u) ${overlap.toFixed(1)} reviewer-seconds; steps>=1ms ${over1}/${steps}; collide calls/step overall ${(callsTot / steps).toFixed(1)}`);
  writeFileSync(`${SP}/ai-results-${label}.json`, JSON.stringify(results, null, 1));
} finally { await b.close(); }
process.exit(0);
