/* =============================================================================
   WARTHOG.JS — the Master Chief's ride. A box-built Halo Warthog that exists only while the Chief skin is on
   (twenty clears, hats.js). Olive body, black tyres, a roll cage, headlights and the chain gun on the back.
   Defines window.QuestWarthog(host) only; the host (quest.js) builds it, drives it and owns every rule about
   when it can be used. Everything is procedural: shared box/cylinder geometry, flat Lambert materials, and
   sounds from the shared first-person kit (fpsfx.js) through host.sfx.

   var W = window.QuestWarthog({ THREE, scene, flat, collide, colliders, safeSpot, sfx, shake, WORLD, hills, props });
       collide(x, z, r, car)      the host's collide; the car asks with car = true, which skips any collider tagged
                                  { water: R }: the car is amphibious (slow, bobbing, spraying inside R of its centre; a splash
                                  going in). Everyone on foot is still kept off by the same collider.
       colliders                  a collider tagged { prop: { group, kind } } (a bench, a lamp) is SMASHED when the chassis
                                  reaches it at more than 5 u/s: the collider is spliced out of the list, the group's children
                                  fly apart along the car's heading, tumble, land and sink away after ~4 s ('bump' on the hit,
                                  'thud' as the first piece lands). Untagged colliders (trees, buildings, the fountain) stay solid.
       props                      optional: soft dressing with no collider, [{ x, z, r, kind, mesh | group }]. 'flower': flattened
                                  (scale.y 0.1) as the footprint passes over it at any speed; anything else ('bush'): smashed as
                                  above at more than 5 u/s, driven through below it. An entry is marked gone and never looked at again.
   W.build({ x, z, yaw })          parks the car there (one per host); pushes its box collider onto host.colliders
   W.enter()                       climb in: the collider comes out of the list, the engine starts. -> true
   W.exit()                        climb out: the collider goes back; -> {x, z} a clear spot beside the car
   W.update(dt, input)             the drive, the turret, the tracers, the spent links, the tumbling reviewers.
       input = { x: -1..1 steer (right +), y: -1..1 throttle (forward +), hb: handbrake, turret: bool (the chain gun
                 is manned), aimYaw, aimPitch (the host's first-person camYaw / fpPitch: the gun follows them),
                 fire: bool (the trigger is held this frame), hit: function (pos, prev) -> truthy if a tracer is
                 spent (the host asks its boss; 'world' for the ground or a wall) }
       Sub-stepped so that nothing tunnels at a large dt; collisions are host.collide(x, z, r, true) on samples round the
       chassis edge (never through a wall, a tree, the fountain, a colleague, or the world's edge; a lamp or a bench only
       by smashing it).
   W.seat(player)                  puts the player group in the driver's seat (position, heading, limbs). Call it
                                   every frame while driving, after update().
   W.seatAt()                      -> {x, z} where seat() last put him (so a host teleport can be noticed; a relocate()
                                   is not one). The object is reused between calls.
   W.shift(dx, dz)                 the car and everything in it moves by (dx, dz): a boss pushed the man in the seat.
                                   The chassis lands on the nearest clear pose (a spiral search), velocity zeroed.
   W.relocate(x, z[, yaw])         park it somewhere else (clear spot found by the host), velocity zeroed. While driving,
                                   the host's next seat() moves the man with it.
   W.placeCamera(camera, dt, mode, camYaw, pitch) -> {yaw, pitch}
                                   mode 'drive': a chase camera behind and above the car; the returned yaw is the
                                   orbit yaw the host should keep (it eases round behind the car).
                                   mode 'turret': behind the chain gun, looking down its barrels; pitch comes back clamped.
   W.inside(x, z, pad)             -> true if the point is within the chassis footprint (+pad)
   W.launch(mesh, speed)           a box man run over: he tumbles up and away along the car's heading, lands flat
   W.down(mesh)                    -> true while he is still flying or lying flat
   W.stand(mesh)                   puts him back on his feet (the host decides when)
   W.trigger()                     the chain gun's trigger, held this frame (hold-to-fire: call it every frame it is held)
   W.clearShots()                  removes every tracer in flight (a retry)
   W.afloat()                      -> true while the chassis centre is on water (a tagged collider, see below)
   W.driving (bool), W.pos (THREE.Vector3, the chassis centre on the ground), W.yaw, W.speed (signed, u/s), W.group
   Keys and prompts are the host's. ES5, never throws into the host. */
(function () {
  'use strict';
  window.QuestWarthog = function (host) {
    var THREE = host.THREE, scene = host.scene;
    var HW = 1.3, HL = 2.5, WB = 3.2, WHEEL_R = 0.55;                  // half width, half length, wheelbase
    var ACC = 14, TOP = 22, REV = 8, BRAKE = 28, ROLL = 3;              // u/s^2, u/s
    var FIRE_RATE = 12, TRACER_V = 110, TRACER_LIFE = 0.9, SPREAD = 0.012;
    var PITCH_MIN = -0.32, PITCH_MAX = 0.72;
    var S = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, vF: 0, steer: 0, bounce: 0, bv: 0, pitch: 0, roll: 0, yawRate: 0, skidT: 0, bumpT: 0, thr: 0 };
    var car = null, body = null, wheels = [], front = [], tur = null, gunP = null, barrels = null, flash = null, muzzle = null, eject = null;
    var col = { x: 0, z: 0, hw: HW, hd: HL, yaw: 0 };
    var tracers = [], tracerPool = [], links = [], linkPool = [], hitFx = [], hitPool = [], tumbles = [];
    var debris = [], spray = [], sprayPool = [], sprayGeo = null, sprayMat = null, sprayAcc = 0;   // smashed props in flight; the water thrown up
    var SMASH_V = 5, WATER_K = 0.6, onWater = false, waterT = 0, wob = 0, wroll = 0;              // the smash threshold (u/s); the top speed on water as a share of TOP
    var eng = null, engAt = -9, fireAcc = 0, firing = false, flashT = 0, spin = 0, prevVF = 0;
    var GEO = {}, V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), Q = new THREE.Quaternion();
    var self = { driving: false, pos: new THREE.Vector3(), yaw: 0, speed: 0, group: null };

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function turn(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
    function sfx(name, o) { try { return host.sfx ? host.sfx(name, o) : null; } catch (e) { return null; } }
    function at(x, y, z, o) { o = o || {}; o.pos = { x: x, y: y, z: z }; return o; }
    function geo(w, h, d) { var k = 'b' + w + '_' + h + '_' + d, g = GEO[k]; if (!g) { g = new THREE.BoxGeometry(w, h, d); GEO[k] = g; } return g; }
    function cyl(r, l, n, axis) {
      var k = 'c' + r + '_' + l + '_' + n + axis, g = GEO[k];
      if (!g) { g = new THREE.CylinderGeometry(r, r, l, n); if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2); GEO[k] = g; }
      return g;
    }
    function box(w, h, d, m, x, y, z, p, noShadow) { var o = new THREE.Mesh(geo(w, h, d), m); o.position.set(x, y, z); o.castShadow = !noShadow; p.add(o); return o; }

    /* ------------------------------------------------------------ the chassis edge, as points the host's collide() can test */
    // every 0.3 units at radius 0.25, so a lamp post (r 0.25) anywhere within ~0.48 of the edge line is seen; the sub-step
    // is capped at 0.2 units (update), so nothing thin slips between two samples of two consecutive steps
    var SAMPLE_R = 0.25, STEP_MAX = 0.2;
    var SAMPLES = (function () {
      var p = [], i, n = Math.ceil(2 * HL / 0.3), m = Math.ceil(2 * HW / 0.3);
      for (i = 0; i <= n; i++) { var z = -HL + 2 * HL * i / n; p.push([-HW, z], [HW, z]); }
      for (i = 1; i < m; i++) { var x = -HW + 2 * HW * i / m; p.push([x, -HL], [x, HL]); }
      for (i = 1; i < n; i += 2) for (var j = 1; j < m; j += 2) p.push([-HW + 2 * HW * j / m, -HL + 2 * HL * i / n]);   // a coarse grid inside: a post dropped inside the chassis is seen too
      return p;
    })();
    function carCollide(x, z, r) { return host.collide(x, z, r, true); }   // the car's question: water does not count
    function hits(x, z, yaw) {
      var s = Math.sin(yaw), c = Math.cos(yaw), i, lx, lz;
      for (i = 0; i < SAMPLES.length; i++) { lx = SAMPLES[i][0]; lz = SAMPLES[i][1]; if (carCollide(x + lx * c + lz * s, z - lx * s + lz * c, SAMPLE_R)) return true; }
      return false;
    }
    function overlap(x, z, yaw, cap) {                              // how many edge samples are inside something: the depth of a stuck pose (stops counting at cap)
      var s = Math.sin(yaw), c = Math.cos(yaw), i, lx, lz, n = 0;
      cap = cap || 1e9;
      for (i = 0; i < SAMPLES.length && n < cap; i++) { lx = SAMPLES[i][0]; lz = SAMPLES[i][1]; if (carCollide(x + lx * c + lz * s, z - lx * s + lz * c, SAMPLE_R)) n++; }
      return n;
    }
    var NUDGE = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]], NUDGE_D = [0.2, 0.5, 1.0, 2.0, 3.6];
    function inside(x, z, pad) {
      var dx = x - S.x, dz = z - S.z, s = Math.sin(S.yaw), c = Math.cos(S.yaw);
      pad = pad || 0;
      return Math.abs(dx * c - dz * s) < HW + pad && Math.abs(dx * s + dz * c) < HL + pad;
    }

    /* ------------------------------------------------------------ the model */
    function build(o) {
      o = o || {};
      if (car) return true;
      var olive = host.flat(0x6b7a46), deep = host.flat(0x4c5633), black = host.flat(0x15171b), steel = host.flat(0x8a8f99), rubber = host.flat(0x1c1c1e), tan = host.flat(0xb7a97a), hub = host.flat(0x6f7480);
      var lamp = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
      var red = new THREE.MeshLambertMaterial({ color: 0xff3b3b, emissive: 0xb01010, emissiveIntensity: 0.6 });
      var glass = new THREE.MeshLambertMaterial({ color: 0xa9d6ff, transparent: true, opacity: 0.35 });
      car = new THREE.Group(); body = new THREE.Group(); car.add(body); self.group = car;
      var i, sd;
      box(2.4, 0.5, 4.6, deep, 0, 0.75, 0, body);                                        // chassis tub
      box(2.3, 0.55, 1.5, olive, 0, 1.15, 1.5, body); box(2.1, 0.12, 1.3, deep, 0, 1.46, 1.5, body);   // bonnet
      box(2.6, 0.3, 0.3, steel, 0, 0.6, 2.4, body);                                      // front bumper
      box(0.6, 0.2, 0.6, deep, 0, 1.52, 1.6, body);                                      // air scoop
      for (sd = -1; sd <= 1; sd += 2) {
        box(0.36, 0.26, 0.1, lamp, sd * 0.8, 1.15, 2.3, body, true);                     // headlights
        box(0.3, 0.16, 0.08, red, sd * 0.9, 1.1, -2.35, body, true);                     // tail lights
        box(0.2, 0.6, 1.8, olive, sd * 1.15, 1.25, 0.1, body);                           // cab sides
        box(0.5, 0.5, 1.4, olive, sd * 1.25, 1.2, 1.6, body); box(0.5, 0.5, 1.4, olive, sd * 1.25, 1.2, -1.6, body);   // wheel arches
        box(0.08, 0.8, 0.08, steel, sd * 1.1, 2.0, 0.9, body);                           // windscreen posts
        box(0.1, 1.95, 0.1, steel, sd * 1.1, 2.0, -0.9, body);                           // the main hoop
        var diag = box(0.08, 0.08, 1.9, steel, sd * 1.1, 2.7, 0, body); diag.rotation.x = -2.82;   // from the screen top back to the hoop
        box(0.1, 1.2, 0.1, steel, sd * 1.1, 1.65, -2.1, body);                           // the rear hoop
        box(0.8, 0.2, 0.8, black, sd * 0.6, 0.85, 0.3, body); box(0.8, 0.8, 0.2, black, sd * 0.6, 1.3, -0.1, body);   // seats
      }
      box(2.2, 0.5, 0.3, deep, 0, 1.35, 0.95, body);                                     // dashboard
      box(2.3, 0.08, 0.08, steel, 0, 2.4, 0.9, body); box(2.1, 0.7, 0.04, glass, 0, 2.0, 0.9, body, true);   // screen
      box(2.3, 0.1, 0.1, steel, 0, 3.0, -0.9, body);                                     // the hoop's top bar, behind his head
      box(2.3, 0.1, 0.1, steel, 0, 2.25, -2.1, body);
      box(0.5, 0.12, 0.08, black, -0.6, 1.45, 0.75, body); box(0.08, 0.3, 0.08, steel, -0.6, 1.3, 0.78, body);   // the wheel, on the left
      box(2.4, 0.3, 1.9, olive, 0, 1.05, -1.6, body);                                    // the bed
      box(0.5, 0.6, 0.5, steel, 0, 1.5, -1.4, body);                                     // turret pedestal
      // the chain gun: a turret that yaws on the pedestal, a cradle that pitches, three barrels that spin
      tur = new THREE.Group(); tur.position.set(0, 1.85, -1.4); body.add(tur);
      box(0.9, 0.12, 0.9, deep, 0, 0, 0, tur);
      gunP = new THREE.Group(); gunP.position.set(0, 0.3, 0); tur.add(gunP);
      box(0.5, 0.42, 0.9, steel, 0, 0, -0.1, gunP); box(0.56, 0.1, 0.5, deep, 0, 0.26, -0.2, gunP);
      box(0.3, 0.4, 0.5, tan, 0.42, -0.05, -0.2, gunP);                                  // ammo box
      box(0.14, 0.14, 0.4, black, -0.22, 0.1, -0.7, gunP); box(0.14, 0.14, 0.4, black, 0.22, 0.1, -0.7, gunP);   // the handles
      barrels = new THREE.Group(); barrels.position.set(0, 0, 0.45); gunP.add(barrels);
      for (i = 0; i < 3; i++) { var bar = new THREE.Mesh(cyl(0.065, 1.3, 8, 'z'), black); var a = i / 3 * Math.PI * 2; bar.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.5); bar.castShadow = true; barrels.add(bar); }
      box(0.36, 0.36, 0.18, deep, 0, 0, 0.5, barrels); box(0.34, 0.34, 0.12, deep, 0, 0, 1.0, barrels);   // shroud rings
      muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.2); barrels.add(muzzle);
      eject = new THREE.Object3D(); eject.position.set(0.32, 0.05, -0.1); gunP.add(eject);
      flash = new THREE.Mesh(geo(0.5, 0.5, 0.7), new THREE.MeshBasicMaterial({ color: 0xffd36a, fog: false, transparent: true, opacity: 0.9 }));
      flash.position.set(0, 0, 1.45); flash.visible = false; barrels.add(flash);
      // wheels: a pivot (steering) holding a tyre, a hub and a cap; the tyre spins about the axle (x)
      var tyreG = cyl(WHEEL_R, 0.5, 14, 'x'), hubG = cyl(0.3, 0.52, 8, 'x'), capG = cyl(0.12, 0.56, 6, 'x');
      [[-1.25, 1.6], [1.25, 1.6], [-1.25, -1.6], [1.25, -1.6]].forEach(function (w, k) {
        var pv = new THREE.Group(); pv.position.set(w[0], WHEEL_R, w[1]); car.add(pv);
        var ty = new THREE.Mesh(tyreG, rubber); ty.castShadow = true; pv.add(ty);
        var hb = new THREE.Mesh(hubG, hub); ty.add(hb); var cp = new THREE.Mesh(capG, steel); ty.add(cp);
        for (var q = 0; q < 5; q++) { var lug = box(0.57, 0.07, 0.07, black, 0, 0, 0, ty, true); lug.rotation.x = q / 5 * Math.PI * 2; lug.position.y = Math.cos(q / 5 * Math.PI * 2) * 0.2; lug.position.z = Math.sin(q / 5 * Math.PI * 2) * 0.2; }
        wheels.push(ty); if (k < 2) front.push(pv);
      });
      S.x = +o.x || 0; S.z = +o.z || 0; S.yaw = +o.yaw || 0; S.vx = S.vz = S.vF = 0;
      scene.add(car);
      apply();
      col.x = S.x; col.z = S.z; col.yaw = S.yaw;
      if (host.colliders && host.colliders.indexOf(col) < 0) host.colliders.push(col);
      return true;
    }
    function apply() {
      car.position.set(S.x, wob, S.z); car.rotation.y = S.yaw;   // wob: the whole car, wheels and all, sits lower and rocks on the water
      body.position.y = S.bounce; body.rotation.x = S.pitch; body.rotation.z = S.roll + wroll;
      self.pos.set(S.x, 0, S.z); self.yaw = S.yaw; self.speed = S.vF;
      col.x = S.x; col.z = S.z; col.yaw = S.yaw;
    }
    function setCollider(on) {
      if (!host.colliders) return;
      var i = host.colliders.indexOf(col);
      if (on && i < 0) host.colliders.push(col); else if (!on && i >= 0) host.colliders.splice(i, 1);
    }

    /* ------------------------------------------------------------ the drive: one sub-step */
    function stepDrive(h, inp) {
      var s = Math.sin(S.yaw), c = Math.cos(S.yaw), i;
      var vF = S.vx * s + S.vz * c, vL = S.vx * c - S.vz * s, sp = Math.abs(vF), thr = clamp(+inp.y || 0, -1, 1), hb = !!inp.hb, d;
      // the water: a wallow at ~60% of the speed, the tyres finding little to hold; a splash going in
      var wet = !!waterAt(S.x, S.z);
      if (wet && !onWater && sp > 2) splashIn(sp);
      onWater = wet;
      // throttle, brake-reverse, rolling resistance, the handbrake
      if (thr > 0.05) { if (vF < -0.5) vF += BRAKE * thr * h; else vF = Math.min(TOP, vF + ACC * thr * h * (1 - 0.3 * Math.max(0, vF) / TOP)); }
      else if (thr < -0.05) { if (vF > 0.5) vF -= BRAKE * -thr * h; else vF = Math.max(-REV, vF + ACC * 0.7 * thr * h); }
      else { d = ROLL * h; if (Math.abs(vF) <= d) vF = 0; else vF -= (vF > 0 ? d : -d); }
      if (hb) { d = 22 * h; if (Math.abs(vF) <= d) vF = 0; else vF -= (vF > 0 ? d : -d); }
      if (wet) {                                                     // the drag of the water, and a hard ceiling at WATER_K of the top speed
        vF *= Math.max(0, 1 - 0.9 * h);
        d = (vF >= 0 ? TOP : REV) * WATER_K;
        if (Math.abs(vF) > d) vF = Math.max(d, Math.abs(vF) - 12 * h) * (vF > 0 ? 1 : -1);
      }
      // steering: full lock at rest, a third of it at speed; the handbrake throws the tail
      var maxSt = 0.62 / (1 + sp / 9), want = clamp(+inp.x || 0, -1, 1) * maxSt * (hb ? 1.35 : 1);
      S.steer += (want - S.steer) * Math.min(1, h * 7);
      var yawRate = sp > 0.05 ? -vF / WB * Math.tan(S.steer) : 0;   // right (+) swings the nose right going forward; backing up, right swings the tail right (Duncan's call)
      // lateral grip: the tyres pull the slip in, less when sliding hard or on the handbrake
      var grip = hb ? 2.0 : (sp > 13 && Math.abs(S.steer) > 0.1 ? 4.5 : 9);
      if (wet) grip = Math.min(grip, 3);
      vL *= Math.max(0, 1 - grip * h);
      S.vx = vF * s + vL * c; S.vz = vF * c - vL * s;
      // the turn: a corner swung into a wall stays put
      var ny = S.yaw + yawRate * h, deep = overlap(S.x, S.z, S.yaw), stuck = deep > 0;
      if (yawRate !== 0 && (stuck ? overlap(S.x, S.z, ny) > deep : hits(S.x, S.z, ny))) { ny = S.yaw; yawRate = 0; }
      S.yaw = ny; S.yawRate = yawRate;
      var nx = S.x + S.vx * h, nz = S.z + S.vz * h, ox = S.x, oz = S.z, lost = 0;
      // a bench or a lamp in the way at speed is smashed, not hit: its collider goes before the step is tested
      if (sp > SMASH_V) { d = smashAt(nx, nz, S.yaw, sp); if (d < 1) { S.vx *= d; S.vz *= d; nx = S.x + S.vx * h; nz = S.z + S.vz * h; } }
      if (stuck) {
        // already inside something (a shove, a teleport, a landing): the car is pushed out by the nudge (eight ways, five
        // sizes, in its own frame) that frees the most samples; the driven step is taken only if it frees more than any
        // nudge. It never crawls on through, and the throttle cannot dig it in.
        var best = deep, bx = S.x, bz = S.z, q, r2, ex, ez, o2, lx2, lz2;
        for (r2 = 0; r2 < NUDGE_D.length; r2++) for (q = 0; q < NUDGE.length; q++) {
          lx2 = NUDGE[q][0] * NUDGE_D[r2]; lz2 = NUDGE[q][1] * NUDGE_D[r2]; ex = S.x + lx2 * c + lz2 * s; ez = S.z - lx2 * s + lz2 * c;
          o2 = overlap(ex, ez, S.yaw, best);
          if (o2 < best) { best = o2; bx = ex; bz = ez; }
        }
        o2 = overlap(nx, nz, S.yaw, best);
        if (o2 < best) { best = o2; bx = nx; bz = nz; }
        S.vx *= 0.5; S.vz *= 0.5;
        S.x = bx; S.z = bz;
      }
      else if (!hits(nx, nz, S.yaw)) { S.x = nx; S.z = nz; }
      else if (!hits(nx, S.z, S.yaw)) { S.x = nx; lost = Math.abs(S.vz); S.vz *= 0.1; }
      else if (!hits(S.x, nz, S.yaw)) { S.z = nz; lost = Math.abs(S.vx); S.vx *= 0.1; }
      else {
        // a graze: something touching the flank. Try the step shifted a little to either side; past it, the car scrapes on
        var rx = c, rz = -s, k, q, got = false;
        for (k = 1; k <= 2 && !got; k++) for (q = -1; q <= 1 && !got; q += 2) {
          var gx = nx + rx * q * k * 0.22, gz = nz + rz * q * k * 0.22;
          if (!hits(gx, gz, S.yaw)) { S.x = gx; S.z = gz; S.vx *= 0.75; S.vz *= 0.75; got = true; }
        }
        if (!got) { lost = Math.hypot(S.vx, S.vz); S.vx *= -0.25; S.vz *= -0.25; }
      }
      if (lost > 2.5 && S.bumpT <= 0) {
        S.bumpT = 0.25; S.bv += Math.min(2.5, lost * 0.12);
        sfx('bump', at(S.x, 1, S.z, { gain: Math.min(1, 0.4 + lost / 20) }));
        try { if (host.shake) host.shake(Math.min(0.5, lost * 0.025), 0.25); } catch (e) {}
      }
      // kerbs: a jolt of the suspension when the chassis crosses one of the four at speed
      if (Math.abs(S.x) < 45) { var KZ = [-12.2, -7.8, 7.8, 12.2]; for (i = 0; i < 4; i++) if ((oz - KZ[i]) * (S.z - KZ[i]) < 0) S.bv += 1.4 * Math.min(1, Math.hypot(S.vx, S.vz) / 8); }
      S.vF = S.vx * s + S.vz * c;
      // the skid: lateral slip the tyres cannot hold
      S.skidT -= h;
      if (Math.abs(vL) > 2.6 && sp > 4 && S.skidT <= 0) { S.skidT = 0.45; sfx('skid', at(S.x, 0.5, S.z, { gain: Math.min(1, 0.5 + Math.abs(vL) / 10) })); }
    }
    /* ------------------------------------------------------------ the water and the smashing (see the header: water / prop / props) */
    function waterAt(x, z) {
      var C = host.colliders, i, c;
      if (C) for (i = 0; i < C.length; i++) { c = C[i]; if (c.water > 0 && Math.hypot(x - c.x, z - c.z) < c.water) return c; }
      return null;
    }
    function sprayBit(x, y, z, vx, vy, vz, life) {
      if (!sprayGeo) { sprayGeo = new THREE.BoxGeometry(0.14, 0.09, 0.14); sprayMat = new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.85 }); }
      var b = sprayPool.pop();
      if (!b) { if (spray.length >= 60) return; b = { m: new THREE.Mesh(sprayGeo, sprayMat), vx: 0, vy: 0, vz: 0, life: 0 }; }
      b.m.position.set(x, y, z); b.vx = vx; b.vy = vy; b.vz = vz; b.life = life; b.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      scene.add(b.m); spray.push(b);
    }
    function splashIn(sp) {
      var i, a, r;
      sfx('splash', at(S.x, 0.3, S.z, { gain: Math.min(1, 0.5 + sp / 30) }));
      for (i = 0; i < 18; i++) { a = i / 18 * 6.283 + Math.random() * 0.3; r = 1.5 + Math.random() * 1.5; sprayBit(S.x + Math.cos(a) * r, 0.2, S.z + Math.sin(a) * r, Math.cos(a) * (2 + Math.random() * 3), 3 + sp * 0.18 + Math.random() * 2, Math.sin(a) * (2 + Math.random() * 3), 0.55 + Math.random() * 0.25); }
      S.bv -= 1.2 + sp * 0.05;
      try { if (host.shake) host.shake(0.12, 0.2); } catch (e) {}
    }
    function sprayStep(dt) {                                         // the wake off the wheels while it wallows along
      var sp = Math.abs(S.vF);
      if (onWater && self.driving && sp > 1.5) {
        sprayAcc += sp * dt * 1.1;
        var s = Math.sin(S.yaw), c = Math.cos(S.yaw), dir = S.vF >= 0 ? 1 : -1;
        while (sprayAcc >= 1) {
          sprayAcc -= 1;
          var sd = Math.random() < 0.5 ? -1 : 1, lx = sd * (HW + 0.2), lz = dir * (1.6 - Math.random() * 3);
          sprayBit(S.x + lx * c + lz * s, 0.15, S.z - lx * s + lz * c, sd * c * (1.2 + sp * 0.12) - s * dir * sp * 0.25 + (Math.random() - 0.5), 1.4 + sp * 0.12 + Math.random(), -sd * s * (1.2 + sp * 0.12) - c * dir * sp * 0.25 + (Math.random() - 0.5), 0.35 + Math.random() * 0.2);
        }
      } else sprayAcc = 0;
      bitsStep(dt, spray, sprayPool, 16);
    }
    // the colliders tagged prop inside the chassis footprint at the next pose: each is spliced out and its group burst. -> the speed kept (1 = nothing hit)
    function smashAt(x, z, yaw, sp) {
      var C = host.colliders, keep = 1, i, c, dx, dz, s = Math.sin(yaw), co = Math.cos(yaw), lx, lz;
      if (!C) return 1;
      for (i = C.length - 1; i >= 0; i--) {
        c = C[i];
        if (!c.prop || !(c.r >= 0)) continue;
        dx = c.x - x; dz = c.z - z; if (Math.abs(dx) > HL + c.r + 0.3 || Math.abs(dz) > HL + c.r + 0.3) continue;
        lx = dx * co - dz * s; lz = dx * s + dz * co;
        if (Math.abs(lx) >= HW + c.r + SAMPLE_R || Math.abs(lz) >= HL + c.r + SAMPLE_R) continue;
        C.splice(i, 1);
        burst(c.prop.group || c.prop.mesh, c.x, c.z, sp);
        keep = Math.min(keep, c.prop.kind === 'bench' ? 0.8 : 0.9);
      }
      return keep;
    }
    // the group's children (or a lone mesh) fly up and away along the heading, tumbling; they land, settle and sink away
    function burst(g, x, z, sp) {
      if (!g) return;
      var s = Math.sin(S.yaw), c = Math.cos(S.yaw), dir = S.vF >= 0 ? 1 : -1, kids = g.children && g.children.length ? g.children.slice() : [g], i, k, bk = { thud: false };
      g.updateMatrixWorld(true);
      for (i = 0; i < kids.length; i++) {
        k = kids[i];
        k.getWorldPosition(V); k.getWorldQuaternion(Q);
        if (k.parent) k.parent.remove(k);
        k.position.copy(V); k.quaternion.copy(Q); k.scale.set(1, 1, 1); if (k.position.y < 0.25) k.position.y = 0.25;
        scene.add(k);
        debris.push({ m: k, bk: bk, life: 4 + Math.random() * 0.5, flat: false,
          vx: s * dir * (3 + sp * 0.4) + (Math.random() - 0.5) * 4, vy: 4 + sp * 0.25 + Math.random() * 3, vz: c * dir * (3 + sp * 0.4) + (Math.random() - 0.5) * 4,
          sx: (Math.random() - 0.5) * 12, sy: (Math.random() - 0.5) * 6, sz: (Math.random() - 0.5) * 12 });
      }
      if (kids[0] !== g && g.parent) g.parent.remove(g);
      sfx('bump', at(x, 1, z, { gain: Math.min(1, 0.5 + sp / 20) }));
      S.bv += 0.8 + sp * 0.03;
      try { if (host.shake) host.shake(Math.min(0.35, 0.1 + sp * 0.01), 0.2); } catch (e) {}
    }
    function debrisStep(dt) {
      for (var i = debris.length - 1; i >= 0; i--) {
        var b = debris[i], m = b.m;
        b.life -= dt;
        if (b.life <= 0) { scene.remove(m); debris.splice(i, 1); continue; }
        if (!b.flat) {
          b.vy -= 24 * dt; m.position.x += b.vx * dt; m.position.y += b.vy * dt; m.position.z += b.vz * dt;
          m.rotation.x += b.sx * dt; m.rotation.y += b.sy * dt; m.rotation.z += b.sz * dt;
          if (m.position.y <= 0.2 && b.vy < 0) {
            m.position.y = 0.2;
            if (!b.bk.thud) { b.bk.thud = true; sfx('thud', at(m.position.x, 0.2, m.position.z, { gain: 0.6 })); }
            if (b.vy < -4) { b.vy *= -0.3; b.vx *= 0.6; b.vz *= 0.6; b.sx *= 0.5; b.sz *= 0.5; }   // one small bounce
            else { b.flat = true; b.vx = b.vz = b.vy = 0; }
          }
        } else if (b.life < 0.7) m.position.y -= dt * 0.8;   // sinking into the grass before it goes
      }
    }
    // the soft dressing (host.props): flowers are flattened under the footprint, bushes burst at speed
    function propSweep() {
      var P = host.props, sp = Math.abs(S.vF), s = Math.sin(S.yaw), c = Math.cos(S.yaw), i, p, dx, dz, lx, lz;
      if (!P) return;
      for (i = 0; i < P.length; i++) {
        p = P[i]; if (p.gone) continue;
        dx = p.x - S.x; dz = p.z - S.z; if (Math.abs(dx) > HL + 1 || Math.abs(dz) > HL + 1) continue;
        lx = dx * c - dz * s; lz = dx * s + dz * c;
        if (Math.abs(lx) >= HW + p.r || Math.abs(lz) >= HL + p.r) continue;
        if (p.kind === 'flower') { p.gone = true; if (p.group) p.group.scale.y = 0.1; }
        else if (sp > SMASH_V) { p.gone = true; burst(p.group || p.mesh, p.x, p.z, sp); }
      }
    }
    function tracerStep(dt, inp) {
      var i, t, r;
      for (i = tracers.length - 1; i >= 0; i--) {
        t = tracers[i]; t.prev.copy(t.m.position); t.m.position.addScaledVector(t.v, dt); t.life -= dt;
        r = null;
        if (inp && inp.hit) { try { r = inp.hit(t.m.position, t.prev); } catch (e) { r = null; } }
        if (!r && (t.life <= 0 || t.m.position.y < 0.05)) r = 'world';
        if (r) {
          if (r === 'world' && t.life > 0) hitSpark(t.m.position.x, Math.max(0.1, t.m.position.y), t.m.position.z, 4);
          scene.remove(t.m); tracers.splice(i, 1); tracerPool.push(t);
        }
      }
    }
    var tracerGeo = null, tracerMat = null, linkGeo = null, linkMat = null, sparkMat = null;
    function fireRound(k) {
      if (!tracerGeo) {
        tracerGeo = new THREE.BoxGeometry(0.09, 0.09, 1.0); tracerMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false });
        linkGeo = new THREE.BoxGeometry(0.07, 0.05, 0.1); linkMat = new THREE.MeshLambertMaterial({ color: 0xc8a24a, emissive: 0x6a5020, emissiveIntensity: 0.4 });
        sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, fog: false });
      }
      car.updateMatrixWorld(true);
      muzzle.getWorldPosition(V); V2.set(0, 0, 1); V2.applyQuaternion(muzzle.getWorldQuaternion(Q));
      V2.x += (Math.random() - 0.5) * SPREAD * 2; V2.y += (Math.random() - 0.5) * SPREAD * 2; V2.z += (Math.random() - 0.5) * SPREAD * 2; V2.normalize();
      var t = tracerPool.pop();
      if (!t) { if (tracers.length >= 40) return; t = { m: new THREE.Mesh(tracerGeo, tracerMat), v: new THREE.Vector3(), prev: new THREE.Vector3(), life: 0 }; }
      t.m.position.copy(V); t.prev.copy(V); t.v.copy(V2).multiplyScalar(TRACER_V); t.life = TRACER_LIFE;
      V3.copy(V).add(V2); t.m.lookAt(V3); scene.add(t.m); tracers.push(t);
      // the spent link, flung out of the receiver's side
      eject.getWorldPosition(V3);
      var l = linkPool.pop();
      if (!l) { if (links.length >= 36) l = null; else l = { m: new THREE.Mesh(linkGeo, linkMat), vx: 0, vy: 0, vz: 0, life: 0 }; }
      if (l) {
        V2.set(1, 0, 0).applyQuaternion(gunP.getWorldQuaternion(Q));
        l.m.position.copy(V3); l.vx = V2.x * (2 + Math.random() * 2) + (Math.random() - 0.5); l.vy = 2 + Math.random() * 2; l.vz = V2.z * (2 + Math.random() * 2) + (Math.random() - 0.5);
        l.life = 0.7; l.m.rotation.set(Math.random() * 3, Math.random() * 3, 0); scene.add(l.m); links.push(l);
      }
      flashT = 0.045; flash.visible = true; flash.scale.set(0.7 + Math.random() * 0.6, 0.7 + Math.random() * 0.6, 0.8 + Math.random() * 0.5); flash.rotation.z = Math.random() * 3;
      sfx('chaingun', { delay: k / FIRE_RATE });
    }
    function hitSpark(x, y, z, n) {
      for (var i = 0; i < n; i++) {
        var s = hitPool.pop();
        if (!s) { if (hitFx.length >= 40) return; s = { m: new THREE.Mesh(linkGeo, sparkMat), vx: 0, vy: 0, vz: 0, life: 0 }; }
        s.m.position.set(x, y, z); s.vx = (Math.random() - 0.5) * 9; s.vy = 2 + Math.random() * 5; s.vz = (Math.random() - 0.5) * 9; s.life = 0.28;
        scene.add(s.m); hitFx.push(s);
      }
    }
    function bitsStep(dt, list, pool, grav) {
      for (var i = list.length - 1; i >= 0; i--) {
        var b = list[i]; b.life -= dt;
        if (b.life <= 0) { scene.remove(b.m); list.splice(i, 1); pool.push(b); continue; }
        b.vy -= grav * dt; b.m.position.x += b.vx * dt; b.m.position.y += b.vy * dt; b.m.position.z += b.vz * dt; b.m.rotation.x += dt * 9; b.m.rotation.z += dt * 7;
        if (b.m.position.y < 0.03) { b.m.position.y = 0.03; b.vy = 0; b.vx *= 0.5; b.vz *= 0.5; }
      }
    }
    function tumbleStep(dt) {
      for (var i = 0; i < tumbles.length; i++) {
        var t = tumbles[i], m = t.m;
        if (t.flat) continue;
        t.vy -= 24 * dt; m.position.x += t.vx * dt; m.position.y += t.vy * dt; m.position.z += t.vz * dt;
        m.rotation.x += t.sx * dt; m.rotation.y += t.sy * dt; m.rotation.z += t.sz * dt;
        if (m.position.y <= 0.3 && t.vy < 0) {
          t.flat = true; m.position.y = 0.3; m.rotation.set(t.sx >= 0 ? Math.PI / 2 : -Math.PI / 2, t.yaw0, 0);
          sfx('thud', at(m.position.x, 0.3, m.position.z, { gain: 0.7, pitch: 2 }));
        }
      }
    }
    function update(dt, inp) {
      if (!car) return;
      inp = inp || {};
      try {
        var h, n, i;
        if (self.driving) {
          var sp = Math.hypot(S.vx, S.vz);
          n = Math.max(1, Math.min(60, Math.ceil(sp * dt / STEP_MAX)));
          h = dt / n;
          S.bumpT -= dt;
          for (i = 0; i < n; i++) stepDrive(h, inp);
          S.thr = clamp(+inp.y || 0, -1, 1);
          propSweep();
        } else { S.vx = S.vz = S.vF = 0; S.steer *= Math.max(0, 1 - dt * 6); S.yawRate = 0; S.thr = 0; onWater = !!waterAt(S.x, S.z); }
        // the wallow: lower in the water, rocking with the way on
        waterT += dt * (1 + Math.abs(S.vF) * 0.08);
        wob += ((onWater ? -0.16 + Math.sin(waterT * 4.5) * 0.05 : 0) - wob) * Math.min(1, dt * 4);
        wroll += ((onWater ? Math.sin(waterT * 3.1) * 0.03 : 0) - wroll) * Math.min(1, dt * 4);
        // suspension, pitch and roll
        var acc = dt > 0 ? (S.vF - prevVF) / dt : 0; prevVF = S.vF;
        S.bv += (-S.bounce * 90 - S.bv * 9) * dt; S.bounce += S.bv * dt; S.bounce = clamp(S.bounce, -0.25, 0.35);
        S.pitch += (clamp(-acc * 0.012, -0.12, 0.12) - S.pitch) * Math.min(1, dt * 6);
        S.roll += (clamp(S.yawRate * S.vF * 0.006, -0.1, 0.1) - S.roll) * Math.min(1, dt * 6);
        // wheels: spin with the ground speed, the front pair steer
        for (i = 0; i < wheels.length; i++) wheels[i].rotation.x += S.vF / WHEEL_R * dt;
        for (i = 0; i < front.length; i++) front[i].rotation.y = -S.steer;   // the wheels point where the nose goes
        apply();
        // the engine: a loop fed every frame, its pitch following the speed (and a lift on the throttle)
        if (self.driving) {
          if (eng && !eng.playing()) eng = null;
          engAt += dt;
          if (!eng && engAt > 0.5) { engAt = 0; eng = sfx('engine', { ttl: 0.6, gain: 0.9, attack: 0.15 }); if (eng && !eng.ok) eng = null; }
          if (eng) { eng.feed(); if (eng.pitch) eng.pitch(-1 + 13 * Math.min(1, Math.abs(S.vF) / TOP) + (S.thr > 0 ? 1.5 : 0), 0.25); }
        }
        // the chain gun
        if (inp.turret) {
          var g = turn((+inp.aimYaw || 0) + Math.PI, S.yaw), p = clamp(+inp.aimPitch || 0, PITCH_MIN, PITCH_MAX);
          tur.rotation.y = g; gunP.rotation.x = -p;
          if (firing && self.driving) {
            fireAcc += dt; var k = 0;
            while (fireAcc >= 1 / FIRE_RATE && k < 6) { fireAcc -= 1 / FIRE_RATE; fireRound(k++); }
            if (fireAcc > 1 / FIRE_RATE) fireAcc = 1 / FIRE_RATE;
            spin = 28;
          } else { fireAcc = Math.min(fireAcc + dt, 1 / FIRE_RATE); spin *= Math.max(0, 1 - dt * 3); }
          barrels.rotation.z += spin * dt;
        } else { tur.rotation.y += turn(0, tur.rotation.y) * Math.min(1, dt * 3); gunP.rotation.x *= Math.max(0, 1 - dt * 3); spin = 0; }
        firing = false;
        if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.visible = false; }
        tracerStep(dt, inp);
        bitsStep(dt, links, linkPool, 18); bitsStep(dt, hitFx, hitPool, 14);
        tumbleStep(dt); debrisStep(dt); sprayStep(dt);
      } catch (e) { if (window.console) console.error(e); }
    }

    /* ------------------------------------------------------------ in and out */
    function seatLocal(out) { var s = Math.sin(S.yaw), c = Math.cos(S.yaw), lx = -0.6, lz = 0.3; out.x = S.x + lx * c + lz * s; out.z = S.z - lx * s + lz * c; return out; }
    var seatPt = { x: 0, z: 0 }, lastSeat = { x: 0, z: 0, set: false };
    function seat(player) {
      if (!car || !player) return;
      seatLocal(seatPt);
      player.position.set(seatPt.x, 0.1 + S.bounce + wob, seatPt.z); player.rotation.y = S.yaw; player.scale.set(1, 1, 1);
      lastSeat.x = seatPt.x; lastSeat.z = seatPt.z; lastSeat.set = true;
      var u = player.userData;
      if (u && u.la) { u.la.rotation.x += (-1.05 - u.la.rotation.x) * 0.3; u.ra.rotation.x += (-1.05 - u.ra.rotation.x) * 0.3; u.ll.rotation.x += (-1.35 - u.ll.rotation.x) * 0.3; u.rl.rotation.x += (-1.35 - u.rl.rotation.x) * 0.3; }
    }
    function enter() {
      if (!car || self.driving) return false;
      self.driving = true; setCollider(false); S.vx = S.vz = S.vF = 0; prevVF = 0; fireAcc = 0; engAt = 9; lastSeat.set = false;
      sfx('door', at(S.x, 1, S.z));
      return true;
    }
    function exit() {
      if (!car) return null;
      self.driving = false; S.vx = S.vz = S.vF = 0; S.thr = 0;
      if (eng) { try { eng.stop(0.3); } catch (e) {} eng = null; }
      firing = false; spin = 0; camInit = false;
      var s = Math.sin(S.yaw), c = Math.cos(S.yaw), out = null, k, lx, lz, x, z;
      for (k = 0; k < 4 && !out; k++) {                      // beside the driver's door, else the other side, else behind, else in front
        lx = [-2.3, 2.3, 0, 0][k]; lz = [0.3, 0.3, -3.6, 3.6][k]; x = S.x + lx * c + lz * s; z = S.z - lx * s + lz * c;
        if (!host.collide(x, z, 0.55)) out = { x: x, z: z };
      }
      if (!out) { try { out = host.safeSpot(S.x - 2.3 * c, S.z + 2.3 * s); } catch (e) { out = { x: S.x - 2.3 * c, z: S.z + 2.3 * s }; } }
      setCollider(true); apply();
      sfx('door', at(S.x, 1, S.z, { pitch: -2 }));
      return out;
    }
    function relocate(x, z, yaw) { if (!car) return; S.x = +x || 0; S.z = +z || 0; if (yaw != null) S.yaw = +yaw || 0; S.vx = S.vz = S.vF = 0; lastSeat.set = false; apply(); }
    // a shove or a teleport of the man in the seat: the car goes with him, to the nearest pose its chassis is clear in
    function shift(dx, dz) {
      if (!car) return;
      var x = S.x + (+dx || 0), z = S.z + (+dz || 0), r, a, sx, sz, got = !hits(x, z, S.yaw);
      for (r = 1; r < 14 && !got; r += 1) for (a = 0; a < 12 && !got; a++) { sx = x + Math.cos(a / 12 * 6.283) * r; sz = z + Math.sin(a / 12 * 6.283) * r; if (!hits(sx, sz, S.yaw)) { x = sx; z = sz; got = true; } }
      S.x = x; S.z = z; S.vx = S.vz = S.vF = 0; lastSeat.set = false; apply();
    }

    /* ------------------------------------------------------------ cameras */
    var camAt = new THREE.Vector3(), camWant = new THREE.Vector3(), camInit = false, camDist = 15, W4 = host.WORLD ? host.WORLD + 5 : 57;
    function camBlocked(x, z) {                                  // a collider, the world's rim, or a border hill (host.hills: x, z, r at camera height)
      if (carCollide(x, z, 0.6) || Math.abs(x) > W4 || Math.abs(z) > W4) return true;
      var H = host.hills; if (H) for (var i = 0; i < H.length; i++) if (Math.hypot(x - H[i].x, z - H[i].z) < H[i].r) return true;
      return false;
    }
    function placeCamera(camera, dt, mode, camYaw, pitch) {
      var r = { yaw: camYaw, pitch: pitch };
      if (!car) return r;
      try {
        var s, c;
        if (mode === 'turret') {
          var p = clamp(pitch, PITCH_MIN, PITCH_MAX), g = camYaw + Math.PI;
          r.pitch = p;
          car.updateMatrixWorld(true); gunP.getWorldPosition(V);
          V2.set(-Math.sin(camYaw) * Math.cos(p), Math.sin(p), -Math.cos(camYaw) * Math.cos(p));   // the host's viewDir, so the crosshair is the gun
          V3.set(Math.cos(g), 0, -Math.sin(g));                                                  // the gun's right, over the shoulder
          // high over the gunner's shoulder, so the cab and the driver stay under the line of fire (the host hides him
          // when the lens is still within a few units of his head)
          camera.position.copy(V).addScaledVector(V2, -4.6).addScaledVector(V3, 1.1); camera.position.y += 2.3;
          camera.lookAt(V.x + V2.x * 40, V.y + V2.y * 40, V.z + V2.z * 40);
          camInit = false;
          return r;
        }
        // the chase: ease the orbit round behind the car, then sit 15 back and 6.5 up, looking a little ahead of it.
        // A building, a tree or the edge mound on the line from the car pulls the camera in (and up a little) in front
        // of it, eased so it does not pop: the view is never the inside of a wall.
        var want = S.yaw + Math.PI, k = Math.min(1, dt * (Math.abs(S.vF) > 1 ? 2.6 : 1.2));
        r.yaw = camYaw + turn(want, camYaw) * k;
        s = Math.sin(r.yaw); c = Math.cos(r.yaw);
        var d, clear = 15;
        for (d = 4; d <= 15; d += 1) if (camBlocked(S.x + s * d, S.z + c * d)) { clear = d - 1; break; }
        camDist += (clear - camDist) * Math.min(1, dt * (clear < camDist ? 12 : 2.5));
        camWant.set(S.x + s * camDist, 6.5 + Math.abs(S.vF) * 0.04 + (15 - camDist) * 0.12, S.z + c * camDist);
        if (!camInit) { camInit = true; camAt.copy(camera.position); camDist = clear; }
        camAt.lerp(camWant, Math.min(1, dt * 5));
        // the eased point itself, once more: it lags the tested line through a corner, so it is pulled in until clear
        var cdx = camAt.x - S.x, cdz = camAt.z - S.z, cdd = Math.hypot(cdx, cdz), q2 = 0;
        while (cdd > 3 && q2++ < 24 && camBlocked(camAt.x, camAt.z)) {
          cdd -= 0.5; camAt.x = S.x + cdx / (cdd + 0.5) * cdd; camAt.z = S.z + cdz / (cdd + 0.5) * cdd; cdx = camAt.x - S.x; cdz = camAt.z - S.z;
        }
        camera.position.copy(camAt);
        s = Math.sin(S.yaw); c = Math.cos(S.yaw);
        camera.lookAt(S.x + s * 2.5, 1.6, S.z + c * 2.5);
      } catch (e) {}
      return r;
    }

    /* ------------------------------------------------------------ the run over */
    function launch(mesh, speed) {
      if (!mesh) return;
      for (var i = 0; i < tumbles.length; i++) if (tumbles[i].m === mesh) return;
      var s = Math.sin(S.yaw), c = Math.cos(S.yaw), sp = Math.abs(+speed || 0), dir = S.vF >= 0 ? 1 : -1;
      tumbles.push({ m: mesh, yaw0: mesh.rotation.y, flat: false, vx: s * dir * (5 + sp * 0.45) + (Math.random() - 0.5) * 3, vy: 8 + sp * 0.12, vz: c * dir * (5 + sp * 0.45) + (Math.random() - 0.5) * 3,
        sx: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 6), sy: (Math.random() - 0.5) * 4, sz: (Math.random() - 0.5) * 8 });
      if (mesh.position.y < 0.2) mesh.position.y = 0.2;
      S.bv += 1.2;
      sfx('thud', at(mesh.position.x, 1, mesh.position.z));
      sfx('skid', at(S.x, 0.5, S.z, { gain: 0.6, delay: 0.05, gate: 0 })); S.skidT = 0.5;
    }
    function down(mesh) { for (var i = 0; i < tumbles.length; i++) if (tumbles[i].m === mesh) return true; return false; }
    function stand(mesh) {
      for (var i = tumbles.length - 1; i >= 0; i--) if (tumbles[i].m === mesh) { mesh.rotation.set(0, tumbles[i].yaw0, 0); mesh.position.y = 0; tumbles.splice(i, 1); }
    }
    function clearShots() { while (tracers.length) { var t = tracers.pop(); scene.remove(t.m); tracerPool.push(t); } fireAcc = 1 / FIRE_RATE; flash.visible = false; flashT = 0; }

    self.build = build; self.update = update; self.enter = enter; self.exit = exit; self.seat = seat;
    // where seat() last put him (the current seat before the first seat() of a drive). The object is reused: read, do not keep.
    self.seatAt = function () { return lastSeat.set ? lastSeat : seatLocal(lastSeat); };
    self.shift = shift; self.relocate = relocate; self.placeCamera = placeCamera; self.inside = inside;
    self.launch = launch; self.down = down; self.stand = stand; self.trigger = function () { firing = true; }; self.clearShots = clearShots;
    self.afloat = function () { return onWater; };   // true while the chassis centre is on water
    return self;
  };
})();
