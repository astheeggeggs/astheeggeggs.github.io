/* hats.js - the hat tower, and the two skins a man earns by finishing his paper too many times.
   Defines window.QuestHats(api) only; nothing happens until apply() is called.

   One more hat for every loop-1 clear, stacked bottom to top:
     1 Mario cap (with a P)   2 Oxford mortarboard   3 Indiana Jones fedora   4 wizard hat   5 Kirby's nightcap
     6 Viking helmet          7 Layton top hat       8 cowboy hat             9 propeller beanie
   clears >= 10: SOLID SNAKE (the tower starts again on his head for 11..19).
   clears >= 20: MASTER CHIEF (and again on the helmet for 21+, nine hats at most).

   var hats = window.QuestHats({ THREE: THREE, flat: flat });
   hats.apply(player, clears, { baseY: 3.18, mq: true });    // idempotent; apply(player, 0) restores the plain man
   hats.update(dt, { speed: pstate.speed, air: pstate.air, vy: pstate.vy, yaw: pstate.yaw, moving: bool, t: t });
   hats.setVisible(on); hats.height(); hats.skin();
   Extras: hats.top() (y of the top of the tower on the player group), hats.boxed() (Snake is under his box),
   hats.count() (hats in the tower), hats.dispose().

   hats.palette() ({sleeve, hand, cuff} hex colours for the host's first-person arm, or null for the plain man).
   update() also takes state.box === false (or state.busy) to keep Snake's box off during dialogue / first person.

   Everything is a BoxGeometry with a flat Lambert material. +z is his front, so -x is his right (boxMan's "la" and
   "ll" are the ones at -x); sides are always taken from the limb's own position. Plain ES5, never throws. */
(function () {
  'use strict';
  var HAIR_TOP = 2.84;                               // boxMan: hair box centre 2.68, 0.32 tall
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fin(v) { v = +v; return isFinite(v) ? v : 0; }

  window.QuestHats = function (api) {
    api = api || {};
    var T = api.THREE || window.THREE;
    var cur = null;                                  // everything the last apply() built
    var want = true;                                 // setVisible state survives rebuilds
    var sim = { walkT: 0, pSpeed: 0, pYaw: 0, pAir: false, clock: 0, idle: 0, bx: 0, bz: 0, vx: 0, vz: 0 };

    /* ---------------------------------------------------------------- resources */
    function newRes() { return { geo: {}, mat: {}, list: [] }; }
    function mat(R, hex) {
      var k = 'm' + hex, m = R.mat[k];
      if (!m) { m = api.flat ? api.flat(hex) : new T.MeshLambertMaterial({ color: hex }); R.mat[k] = m; R.list.push(m); }
      return m;
    }
    function glow(R, hex, k) {                        // still a flat Lambert, but it carries some of its own light (the visor)
      var key = 'g' + hex, m = R.mat[key];
      if (!m) { m = new T.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: k }); R.mat[key] = m; R.list.push(m); }
      return m;
    }
    function geo(R, w, h, d) {
      var k = w + '_' + h + '_' + d, g = R.geo[k];
      if (!g) { g = new T.BoxGeometry(w, h, d); R.geo[k] = g; R.list.push(g); }
      return g;
    }
    function box(R, w, h, d, c, x, y, z, parent) {
      var m = new T.Mesh(geo(R, w, h, d), typeof c === 'number' ? mat(R, c) : c);
      m.position.set(x, y, z); m.castShadow = true; m.userData.questHat = true; parent.add(m); return m;
    }
    function grp(parent, x, y, z) { var g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); g.userData.questHat = true; parent.add(g); return g; }

    /* ---------------------------------------------------------------- the nine hats
       Each builder fills the group g (origin at the hat's base, centred on the head) and returns
       { h: the height the next hat sits at, top: how far its ornament pokes above that when it is the last hat }.
       Moving parts push a function (s) onto A; s is the per-frame state worked out in update(). */
    var HATS = [
      function mario(R, g) {
        var red = 0xe02a22, white = 0xf7f7f2;
        box(R, 0.96, 0.3, 0.94, red, 0, 0.15, 0, g);
        box(R, 0.8, 0.08, 0.78, red, 0, 0.33, -0.02, g);
        box(R, 0.84, 0.07, 0.36, 0xb81d17, 0, 0.06, 0.62, g);                     // the peak
        box(R, 0.4, 0.2, 0.04, white, 0, 0.19, 0.48, g); box(R, 0.28, 0.3, 0.04, white, 0, 0.19, 0.48, g);   // roundel
        var c = 0.046, z = 0.505, cy = 0.19;                                       // a P, three cells by five (-x is the viewer's left)
        box(R, c, 5 * c, 0.02, red, -c, cy, z, g);
        box(R, 2 * c, c, 0.02, red, 0.5 * c, cy + 2 * c, z, g);
        box(R, 2 * c, c, 0.02, red, 0.5 * c, cy, z, g);
        box(R, c, c, 0.02, red, c, cy + c, z, g);
        return { h: 0.36, top: 0.01 };
      },
      function mortarboard(R, g, A, isTop) {
        var black = 0x1c1e26, gold = 0xf2c230;
        box(R, 0.82, 0.24, 0.82, black, 0, 0.12, 0, g);
        var board = grp(g, 0, 0.27, 0); board.rotation.y = Math.PI / 4;           // worn corner-forward
        box(R, 1.12, 0.06, 1.12, 0x23262f, 0, 0, 0, board);
        box(R, 0.12, 0.05, 0.12, gold, 0, 0.05, 0, board);
        box(R, 0.04, 0.03, 0.56, gold, 0, 0.04, 0.28, board);                     // cord from the button to the edge
        var piv = grp(g, 0.4, 0.27, 0.4);
        box(R, 0.05, 0.3, 0.05, gold, 0, -0.15, 0, piv);
        box(R, 0.13, 0.2, 0.13, gold, 0, -0.38, 0, piv);
        var ax = 0, az = 0, vx = 0, vz = 0;
        A.push(function (s) {                                                       // a pendulum: streams back on the run, swings on
          var tx = s.run * 0.95 + s.acc * 0.5 + s.sw * 0.2 + Math.sin(s.t * 1.7) * 0.05, tz = s.sw * 0.3 + s.yr * 0.6;
          vx += ((tx - ax) * 46 - vx * 3.2) * s.dt; vz += ((tz - az) * 46 - vz * 3.2) * s.dt;
          ax = clamp(ax + vx * s.dt, -1.3, 1.5); az = clamp(az + vz * s.dt, -1.2, 1.2);
          piv.rotation.x = ax; piv.rotation.z = az;
        });
        if (!isTop) box(R, 0.6, 0.13, 0.6, black, 0, 0.365, 0, g);                 // a spacer, so the board and tassel show under the next hat
        return { h: isTop ? 0.3 : 0.42, top: isTop ? 0.08 : 0 };
      },
      function fedora(R, g) {
        var felt = 0x8a5a2e, deep = 0x6f4522, band = 0x2e1c10;
        box(R, 1.16, 0.05, 0.9, deep, 0, 0.03, -0.13, g);
        var fb = grp(g, 0, 0.03, 0.32); fb.rotation.x = 0.17; box(R, 1.16, 0.05, 0.36, deep, 0, 0, 0.17, fb);   // the brim dips at the front
        box(R, 0.86, 0.3, 0.9, felt, 0, 0.2, 0, g);
        box(R, 0.9, 0.11, 0.94, band, 0, 0.115, 0, g);
        box(R, 0.3, 0.1, 0.8, felt, -0.26, 0.39, -0.05, g); box(R, 0.3, 0.1, 0.8, felt, 0.26, 0.39, -0.05, g);   // the crease
        box(R, 0.2, 0.1, 0.3, felt, -0.16, 0.39, 0.3, g); box(R, 0.2, 0.1, 0.3, felt, 0.16, 0.39, 0.3, g);       // pinched at the front
        return { h: 0.44, top: 0 };
      },
      function wizard(R, g, A, isTop) {
        var blue = 0x2f55c4, deep = 0x213f99, star = 0xffd93b;
        box(R, 1.34, 0.06, 1.34, deep, 0, 0.03, 0, g);
        box(R, 0.84, 0.22, 0.84, blue, 0, 0.17, 0, g);
        box(R, 0.64, 0.2, 0.64, deep, 0, 0.38, 0, g);
        box(R, 0.46, 0.16, 0.46, blue, 0, 0.56, 0, g);
        function st(x, y, z, face, k) {                                             // a plus-shaped star on one face
          var a = 0.15 * k, b = 0.055 * k;
          if (face) { box(R, 0.03, b, a, star, x, y, z, g); box(R, 0.03, a, b, star, x, y, z, g); }
          else { box(R, a, b, 0.03, star, x, y, z, g); box(R, b, a, 0.03, star, x, y, z, g); }
        }
        st(-0.2, 0.17, 0.425, 0, 1); st(0.24, 0.19, 0.425, 0, 0.7); st(0.1, 0.38, 0.325, 0, 0.8);
        st(0.18, 0.17, -0.425, 0, 1); st(-0.12, 0.38, -0.325, 0, 0.8);
        st(0.425, 0.17, 0.12, 1, 1); st(0.325, 0.38, -0.1, 1, 0.8); st(-0.425, 0.17, -0.12, 1, 1); st(-0.325, 0.38, 0.1, 1, 0.8);
        // the bent tip: stands up and curls over when it is the top of the tower, sticks out behind when something sits on it
        var REST = isTop ? [1.25, -0.75, -0.7] : [0.1, -0.55, -0.5], LEN = [0.3, 0.26, 0.2], SZ = [0.3, 0.2, 0.12], joints = [], p = g, k, j;
        for (k = 0; k < 3; k++) {
          j = grp(p, 0, 0, 0);
          if (k) j.position.set(0, 0, -LEN[k - 1] + 0.03); else j.position.set(0, isTop ? 0.58 : 0.5, isTop ? 0.02 : -0.12);
          j.rotation.x = REST[k]; box(R, SZ[k], SZ[k], LEN[k], k % 2 ? deep : blue, 0, 0, -LEN[k] / 2, j);
          joints.push(j); p = j;
        }
        box(R, 0.1, 0.1, 0.1, star, 0, 0, -LEN[2], joints[2]);
        A.push(function (s) {
          for (var i = 0; i < 3; i++) joints[i].rotation.x += (REST[i] + s.lift * (isTop ? [-0.5, 0.5, 0.5] : [0.3, 0.7, 0.6])[i] - joints[i].rotation.x) * s.k;
          joints[1].rotation.z += (s.sw * 0.25 - joints[1].rotation.z) * s.k;
        });
        return { h: 0.64, top: isTop ? 0.36 : 0 };
      },
      function nightcap(R, g, A, isTop) {
        var teal = 0x35c2a8, deep = 0x24a18a, dot = 0xffe45c, white = 0xf7f7f2;
        box(R, 0.96, 0.14, 0.96, white, 0, 0.07, 0, g);
        box(R, 0.84, 0.18, 0.84, teal, 0, 0.23, 0, g);                              // the crown tapers in steps
        box(R, 0.62, 0.14, 0.62, deep, 0, 0.39, 0, g);
        [[-0.2, 0.25, 0.425, 0], [0.22, 0.21, 0.425, 0], [0.1, 0.25, -0.425, 0], [-0.25, 0.21, -0.425, 0], [-0.425, 0.24, 0.1, 1], [-0.425, 0.21, -0.24, 1],
          [0.05, 0.39, 0.315, 0], [-0.1, 0.39, -0.315, 0], [-0.315, 0.39, -0.05, 1]].forEach(function (d) {
          if (d[3]) box(R, 0.03, 0.09, 0.09, dot, d[0], d[1], d[2], g); else box(R, 0.09, 0.09, 0.03, dot, d[0], d[1], d[2], g);
        });
        // the floppy end: from the top centre it arcs up, over and down his left when this is the top hat; with a hat
        // sitting on it, it hangs out of the side instead. Each box is hung off the end of the last, like the Link cap.
        var REST = isTop ? [1.0, -0.95, -0.95, -0.5] : [0.1, -0.6, -0.6, -0.4], SHARE = [0.12, 0.4, 0.4, 0.3];
        var LEN = [0.34, 0.32, 0.28, 0.24], SZ = isTop ? [0.42, 0.34, 0.26, 0.19] : [0.28, 0.24, 0.2, 0.16], joints = [], p = g, k, j;
        for (k = 0; k < 4; k++) {
          j = grp(p, 0, 0, 0);
          if (k) j.position.set(LEN[k - 1] - 0.05, 0, 0); else if (isTop) j.position.set(-0.04, 0.42, 0); else j.position.set(0.28, 0.32, 0);
          j.rotation.z = REST[k]; box(R, LEN[k], SZ[k], SZ[k], k % 2 ? deep : teal, LEN[k] / 2, 0, 0, j);
          joints.push(j); p = j;
        }
        box(R, 0.26, 0.26, 0.26, white, LEN[3] + 0.07, 0, 0, joints[3]);          // pom-pom
        A.push(function (s) {
          for (var i = 0; i < 4; i++) joints[i].rotation.z += (REST[i] + s.lift * SHARE[i] + Math.sin(s.t * 1.3 + i) * 0.03 - joints[i].rotation.z) * s.k;
          joints[isTop ? 1 : 0].rotation.y += (s.run * 0.8 + s.sw * 0.2 - joints[isTop ? 1 : 0].rotation.y) * s.k;   // trails behind on the run
          joints[3].rotation.y += (s.sw * 0.3 - joints[3].rotation.y) * s.k;
        });
        return { h: 0.46, top: isTop ? 0.38 : 0 };
      },
      function viking(R, g) {
        var iron = 0x8d949e, dark = 0x596069, horn = 0xefe6cc, tip = 0xcfc3a0, sd;
        box(R, 0.96, 0.14, 0.96, dark, 0, 0.07, 0, g);
        box(R, 0.86, 0.22, 0.86, iron, 0, 0.25, 0, g);
        box(R, 0.62, 0.1, 0.62, iron, 0, 0.39, 0, g);
        box(R, 0.16, 0.36, 0.9, dark, 0, 0.27, 0, g); box(R, 0.9, 0.36, 0.16, dark, 0, 0.27, 0, g);   // the straps over the dome
        box(R, 0.2, 0.06, 0.2, 0xd9b54a, 0, 0.44, 0, g);
        for (sd = -1; sd <= 1; sd += 2) {                                           // stepped horns: out, up, in a little, to a point
          box(R, 0.3, 0.22, 0.22, horn, sd * 0.58, 0.2, 0, g);
          box(R, 0.2, 0.26, 0.18, horn, sd * 0.74, 0.38, 0, g);
          box(R, 0.14, 0.22, 0.13, horn, sd * 0.78, 0.6, 0, g);
          box(R, 0.08, 0.14, 0.08, tip, sd * 0.76, 0.77, 0, g);
        }
        return { h: 0.44, top: 0.4 };
      },
      function tophat(R, g) {
        var silk = 0x262932, band = 0xe0651c;
        box(R, 1.18, 0.06, 1.18, silk, 0, 0.03, 0, g);
        box(R, 0.78, 0.56, 0.78, silk, 0, 0.34, 0, g);
        box(R, 0.82, 0.16, 0.82, band, 0, 0.15, 0, g);
        box(R, 0.86, 0.05, 0.86, silk, 0, 0.615, 0, g);
        return { h: 0.64, top: 0 };
      },
      function cowboy(R, g) {
        var tan = 0xc28a45, deep = 0xa3702f, band = 0x4a2c14, sd, f;
        box(R, 0.9, 0.06, 1.34, deep, 0, 0.03, 0, g);
        for (sd = -1; sd <= 1; sd += 2) {                                           // the brim turns up at the sides
          f = grp(g, sd * 0.43, 0.03, 0); f.rotation.z = sd * 0.48;
          box(R, 0.42, 0.06, 1.0, deep, sd * 0.21, 0, 0, f);
        }
        box(R, 0.76, 0.3, 0.86, tan, 0, 0.2, 0, g);
        box(R, 0.8, 0.09, 0.9, band, 0, 0.105, 0, g);
        box(R, 0.16, 0.07, 0.03, 0xd9d9d9, 0, 0.105, 0.455, g);                    // buckle
        box(R, 0.26, 0.1, 0.8, tan, -0.23, 0.38, 0, g); box(R, 0.26, 0.1, 0.8, tan, 0.23, 0.38, 0, g);
        return { h: 0.42, top: 0.02 };
      },
      function beanie(R, g, A) {
        var C = [0xe53935, 0xfdd835, 0x1e88e5, 0x43a047], i, sx, sz;
        for (i = 0; i < 4; i++) {                                                   // four coloured quarters
          sx = i % 2 ? 1 : -1; sz = i < 2 ? 1 : -1;
          box(R, 0.46, 0.24, 0.46, C[i], sx * 0.23, 0.12, sz * 0.23, g);
          box(R, 0.33, 0.12, 0.33, C[3 - i], sx * 0.165, 0.3, sz * 0.165, g);
        }
        box(R, 0.5, 0.05, 0.22, 0xe53935, 0, 0.04, 0.56, g);                       // a little bill
        box(R, 0.08, 0.16, 0.08, 0xf7f7f2, 0, 0.43, 0, g);
        var prop = grp(g, 0, 0.53, 0), b1, b2;
        box(R, 0.14, 0.07, 0.14, 0xfdd835, 0, 0, 0, prop);
        b1 = box(R, 0.56, 0.04, 0.2, 0xe53935, 0.35, 0, 0, prop); b1.rotation.x = 0.35;
        b2 = box(R, 0.56, 0.04, 0.2, 0x1e88e5, -0.35, 0, 0, prop); b2.rotation.x = -0.35;
        A.push(function (s) { prop.rotation.y = (prop.rotation.y + s.dt * (1.2 + s.speed * 3.2 + (s.air ? 14 : 0))) % 6.2832; });
        return { h: 0.37, top: 0.2 };
      }
    ];

    /* ---------------------------------------------------------------- the plain man's parts */
    function near(a, b) { return Math.abs(a - b) < 0.02; }
    function isBox(m, w, h, d) { var p = m.geometry && m.geometry.parameters; return !!p && near(p.width, w) && near(p.height, h) && near(p.depth, d); }
    function parts(player) {
      var u = player.userData || {}, P = { la: u.la, ra: u.ra, ll: u.ll, rl: u.rl, lens: [], brows: [] }, i, m;
      for (i = 0; i < player.children.length; i++) {
        m = player.children[i];
        if (!m.isMesh || m.userData.questHat || m === u.la || m === u.ra || m === u.ll || m === u.rl) continue;
        if (isBox(m, 0.9, 1.1, 0.5)) P.body = m;
        else if (isBox(m, 0.32, 1.0, 0.08)) P.shirt = m;
        else if (isBox(m, 0.12, 0.7, 0.05)) P.tie = m;
        else if (isBox(m, 0.8, 0.8, 0.8)) P.head = m;
        else if (isBox(m, 0.88, 0.32, 0.88)) P.hair = m;
        else if (isBox(m, 0.88, 0.5, 0.25)) P.hairBack = m;
        else if (isBox(m, 0.26, 0.2, 0.06) || isBox(m, 0.14, 0.05, 0.05)) P.lens.push(m);
        else if (isBox(m, 0.3, 0.07, 0.06)) P.brows.push(m);
      }
      return P;
    }

    /* ---------------------------------------------------------------- skins */
    // fn(mesh, sd, arm, top, bot, gnd): sd is +1/-1 pointing outward from the body (taken from where the limb is, not
    // its name); top and bot are the real extents of the limb in its own space (boxMan shifts the shared geometry
    // twice, so they are measured, never assumed); gnd is where the ground cuts a standing leg.
    function limbs(P, fn) {
      [[P.la, true], [P.ra, true], [P.ll, false], [P.rl, false]].forEach(function (e) {
        var m = e[0], top = e[1] ? -0.4 : -0.35, bot = e[1] ? -1.4 : -1.25, bb;
        if (!m) return;
        try {
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          bb = m.geometry.boundingBox;
          if (isFinite(bb.max.y) && isFinite(bb.min.y) && bb.max.y > bb.min.y) { top = bb.max.y; bot = bb.min.y; }
        } catch (e2) {}
        fn(m, m.position.x < 0 ? -1 : 1, e[1], top, bot, clamp(-m.position.y, bot, top));
      });
    }
    function skinSnake(C) {
      var R = C.res, P = C.parts, g = C.bodyG, hd = C.headG, A = C.anims;
      var suit = 0x5b7089, legs = 0x4b5d76, strap = 0x1d2229, pad = 0x8ea1b6, band = 0x9db4ca, hair = 0x3a2616, stub = 0xc7aa92;
      C.paint(P.body, suit); C.paint(P.la, suit); C.paint(P.ra, suit); C.paint(P.ll, legs); C.paint(P.rl, legs);
      C.paint(P.hair, hair); C.paint(P.hairBack, hair);
      C.hide(P.shirt); C.hide(P.tie); P.lens.forEach(C.hide);
      // harness
      box(R, 0.13, 1.12, 0.56, strap, -0.25, 1.36, 0, g); box(R, 0.13, 1.12, 0.56, strap, 0.25, 1.36, 0, g);
      box(R, 0.93, 0.1, 0.55, strap, 0, 1.56, 0, g);
      box(R, 0.95, 0.15, 0.57, strap, 0, 0.9, 0, g);
      box(R, 0.18, 0.11, 0.04, 0x9aa3ad, 0, 0.9, 0.295, g);
      box(R, 0.2, 0.2, 0.12, 0x5a6350, -0.31, 1.02, 0.33, g); box(R, 0.2, 0.2, 0.12, 0x5a6350, 0.31, 1.02, 0.33, g);
      box(R, 0.34, 0.26, 0.14, 0x5a6350, 0, 1.0, -0.33, g);
      box(R, 0.5, 0.1, 0.52, legs, 0, 1.93, 0, g);                                 // collar
      limbs(P, function (m, sd, arm, top, bot, gnd) {
        var bt;
        if (arm) {
          box(R, 0.3, 0.16, 0.3, pad, 0, top - 0.07, 0, m);                          // shoulder pad
          box(R, 0.3, 0.13, 0.3, pad, 0, (top + bot) / 2 - 0.02, 0, m);              // elbow
          box(R, 0.3, 0.32, 0.3, strap, 0, bot + 0.15, 0, m);                        // glove
        } else {
          bt = Math.min(top - 0.2, gnd + 0.3);                                       // the boot shows 0.3 above the ground
          box(R, 0.39, bt - bot + 0.01, 0.42, strap, 0, (bt + bot) / 2 - 0.005, 0.02, m);
          box(R, 0.38, 0.12, 0.39, pad, 0, bt + 0.06, 0.01, m);                      // knee pad
          if (sd < 0) box(R, 0.12, 0.26, 0.22, strap, sd * 0.2, top - 0.13, 0, m);   // holster on the outside of his right thigh
        }
      });
      // face: stubble, eyes, a frown
      box(R, 0.83, 0.22, 0.5, stub, 0, 2.06, 0.17, hd);                            // front half only: not round the nape
      box(R, 0.1, 0.08, 0.04, 0x1c1c22, -0.18, 2.37, 0.41, hd); box(R, 0.1, 0.08, 0.04, 0x1c1c22, 0.18, 2.37, 0.41, hd);
      var b1 = box(R, 0.22, 0.05, 0.04, hair, -0.18, 2.455, 0.41, hd), b2 = box(R, 0.22, 0.05, 0.04, hair, 0.18, 2.455, 0.41, hd);
      b1.rotation.z = 0.18; b2.rotation.z = -0.18;
      // the bandana and its two tails
      box(R, 0.93, 0.14, 0.96, band, 0, 2.57, 0, hd);
      box(R, 0.2, 0.18, 0.1, band, 0, 2.57, -0.5, hd);
      var REST = [-1.05, -0.2, -0.12], SHARE = [2.3, 0.4, 0.25], LEN = [0.36, 0.32, 0.28], tails = [];
      [-1, 1].forEach(function (sd) {
        var p = hd, js = [], k, j;
        for (k = 0; k < 3; k++) {
          j = grp(p, 0, 0, 0);
          if (k) j.position.set(0, 0, -LEN[k - 1] + 0.03); else j.position.set(sd * 0.07, 2.57, -0.52);
          j.rotation.x = REST[k]; if (!k) j.rotation.y = -sd * 0.22;
          box(R, 0.13 - k * 0.01, 0.1 - k * 0.015, LEN[k], band, 0, 0, -LEN[k] / 2, j);
          js.push(j); p = j;
        }
        tails.push({ js: js, sd: sd });
      });
      A.push(function (s) {
        tails.forEach(function (tl) {
          for (var i = 0; i < 3; i++) {
            var fl = Math.sin(s.t * 13 + i * 1.4 + tl.sd) * 0.22 * s.run * (i ? 1 : 0.4);
            tl.js[i].rotation.x += (REST[i] + s.lift * SHARE[i] + fl - tl.js[i].rotation.x) * s.k;
          }
          tl.js[0].rotation.y += (-tl.sd * (0.22 + s.run * 0.1) + s.sw * 0.25 - s.yr * 0.5 - tl.js[0].rotation.y) * s.k;
        });
      });
      snakeBox(C);
      return HAIR_TOP;
    }

    // The cardboard box. It drops over him after 2.5 s of standing still and lifts off when he moves.
    var GLYPH = {
      P: '11110100011000111110100001000010000', R: '11110100011000111110101001001010001', E: '11111100001000011110100001000011111',
      I: '11111001000010000100001000010011111', N: '10001110011010110011100011000110001', T: '11111001000010000100001000010000100',
      S: '01111100001000001110000010000111110', O: '01110100011000110001100011000101110', V: '10001100011000110001100010101000100',
      W: '10001100011000110101101011101110001', D: '11110100011000110001100011000111110'
    };
    function label(R) {
      try {
        var cv = document.createElement('canvas'); cv.width = 128; cv.height = 48;
        var c = cv.getContext('2d');
        c.fillStyle = '#b98a55'; c.fillRect(0, 0, 128, 48);
        c.fillStyle = '#4a3018';
        var put = function (str, x, y, k) {
          for (var i = 0; i < str.length; i++) {
            var gl = GLYPH[str.charAt(i)], r, q;
            if (gl) for (r = 0; r < 7; r++) for (q = 0; q < 5; q++) if (gl.charAt(r * 5 + q) === '1') c.fillRect(x + (i * 6 + q) * k, y + r * k, k, k);
          }
        };
        put('PREPRINTS', 11, 8, 2);
        put('NOT PEER REVIEWED', 14, 32, 1);
        c.fillRect(8, 3, 112, 2); c.fillRect(8, 43, 112, 2);
        var tx = new T.CanvasTexture(cv);
        tx.magFilter = T.NearestFilter; tx.minFilter = T.LinearFilter; tx.generateMipmaps = false;
        if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
        var m = new T.MeshLambertMaterial({ map: tx });
        R.list.push(tx); R.list.push(m);
        return m;
      } catch (e) { return null; }
    }
    function snakeBox(C) {
      var R = C.res, W = 1.9, H = 3.0, D = 1.7, card = 0xb98a55, tape = 0xd9b98a, dark = 0x3b2a18;
      var g = grp(C.player, 0, 0, 0); g.visible = false; C.boxG = g;
      box(R, W, H, D, card, 0, H / 2, 0, g);
      box(R, 0.22, 0.02, D + 0.02, tape, 0, H + 0.005, 0, g);                       // tape over the top and a little way down
      box(R, 0.22, 0.5, 0.02, tape, 0, H - 0.25, D / 2 + 0.005, g); box(R, 0.22, 0.5, 0.02, tape, 0, H - 0.25, -D / 2 - 0.005, g);
      box(R, 0.5, 0.12, 0.03, dark, 0, 2.36, D / 2 + 0.01, g);                      // the slot he looks out of
      box(R, 0.03, 0.12, 0.4, dark, W / 2 + 0.01, 2.1, 0, g); box(R, 0.03, 0.12, 0.4, dark, -W / 2 - 0.01, 2.1, 0, g);   // hand holds
      var lm = label(R), l;
      if (lm) {
        l = box(R, 1.8, 0.68, 0.02, lm, 0, 1.3, D / 2 + 0.012, g);
        l = box(R, 1.8, 0.68, 0.02, lm, 0, 1.3, -D / 2 - 0.012, g); l.rotation.y = Math.PI;
        l = box(R, 1.6, 0.6, 0.02, lm, W / 2 + 0.012, 1.3, 0, g); l.rotation.y = Math.PI / 2;
        l = box(R, 1.6, 0.6, 0.02, lm, -W / 2 - 0.012, 1.3, 0, g); l.rotation.y = -Math.PI / 2;
      }
      C.box = { y: 6, v: 0, on: false, top: H + 0.02 };
    }
    function boxStep(C, s) {
      var b = C.box, g = C.boxG;
      if (!b) return;
      var onNow = sim.idle > 1.2;                                                 // he hides fast: the reviewers' cones sweep by (quest.js SNAKE MODE)
      if (onNow && !b.on) { b.y = Math.max(b.y, 4.5); b.v = 0; }
      b.on = onNow;
      if (b.on) {                                                                    // falls, lands, one small bounce
        b.v -= 30 * s.dt; b.y += b.v * s.dt;
        if (b.y <= 0) { b.y = 0; b.v = b.v < -4 ? -b.v * 0.22 : 0; }
        g.visible = C.vis;
      } else if (b.y < 6) { b.v = 0; b.y += s.dt * 16; g.visible = C.vis && b.y < 6; }
      else g.visible = false;
      g.position.y = b.y;
      g.rotation.z = b.on ? 0 : Math.min(0.25, b.y * 0.05);
      // while he is boxed the hats sit on the lid, not through it
      var ty = (b.on && g.visible && b.y < 0.3) ? Math.max(C.baseY, b.top) : C.baseY;
      C.tower.position.y += (ty - C.tower.position.y) * Math.min(1, s.dt * 18);
    }

    function skinChief(C) {
      var R = C.res, P = C.parts, g = C.bodyG, hd = C.headG;
      var olive = 0x8fae4e, deep = 0x66823a, under = 0x1b1f24, visor = glow(R, 0xffab1f, 0.5), shine = glow(R, 0xffe9a8, 0.6), sd;
      C.paint(P.body, under); C.paint(P.la, under); C.paint(P.ra, under); C.paint(P.ll, under); C.paint(P.rl, under); C.paint(P.head, under);
      C.hide(P.shirt); C.hide(P.tie); C.hide(P.hair); C.hide(P.hairBack); P.lens.forEach(C.hide);
      // helmet
      box(R, 0.98, 0.9, 0.98, olive, 0, 2.39, 0, hd);
      box(R, 0.76, 0.34, 0.06, visor, 0, 2.43, 0.5, hd);
      box(R, 0.22, 0.07, 0.03, shine, 0.2, 2.52, 0.535, hd);
      box(R, 0.9, 0.13, 0.2, deep, 0, 2.66, 0.46, hd);                              // brow
      box(R, 0.44, 0.2, 0.14, deep, 0, 2.1, 0.47, hd);                              // mouth guard
      for (sd = -1; sd <= 1; sd += 2) {
        box(R, 0.16, 0.5, 0.14, deep, sd * 0.42, 2.26, 0.47, hd);                   // cheek
        box(R, 0.07, 0.34, 0.4, deep, sd * 0.5, 2.36, -0.04, hd);                   // ear plate
      }
      box(R, 0.4, 0.1, 0.94, deep, 0, 2.88, -0.02, hd);                             // crest
      box(R, 0.56, 0.24, 0.07, deep, 0, 2.3, -0.5, hd);
      // torso
      box(R, 1.0, 0.56, 0.64, olive, 0, 1.63, 0, g);
      box(R, 0.56, 0.12, 0.6, deep, 0, 1.95, 0, g);
      box(R, 0.12, 0.34, 0.04, deep, 0, 1.63, 0.33, g);
      box(R, 0.3, 0.12, 0.04, deep, -0.27, 1.76, 0.33, g); box(R, 0.3, 0.12, 0.04, deep, 0.27, 1.76, 0.33, g);
      box(R, 0.66, 0.44, 0.16, deep, 0, 1.62, -0.38, g);                            // the pack
      box(R, 0.96, 0.2, 0.58, deep, 0, 0.9, 0, g);
      box(R, 0.32, 0.28, 0.06, olive, 0, 0.92, 0.3, g);
      limbs(P, function (m, sd, arm, top, bot, gnd) {
        var lo, bt;
        if (arm) {
          lo = top - 0.14;                                                           // pauldron: from the shoulder pivot down over the top of the arm
          box(R, 0.46, 0.1 - lo, 0.48, olive, sd * 0.11, (0.1 + lo) / 2, 0, m);
          box(R, 0.48, 0.08, 0.5, deep, sd * 0.11, 0.12, 0, m);
          box(R, 0.37, 0.44, 0.38, olive, sd * 0.02, bot + 0.3, 0, m);               // gauntlet, a black glove below it
          box(R, 0.39, 0.08, 0.4, deep, sd * 0.02, bot + 0.5, 0, m);
        } else {
          bt = Math.min(top - 0.2, gnd + 0.3);
          box(R, 0.4, top - bt - 0.06, 0.42, olive, 0, (top + bt - 0.06) / 2 + 0.03, 0, m);   // thigh plate
          box(R, 0.37, 0.08, 0.39, deep, 0, bt, 0.01, m);                            // knee
          box(R, 0.42, bt - bot - 0.03, 0.48, olive, 0, (bt - 0.04 + bot + 0.01) / 2, 0.03, m);   // greave and boot
          box(R, 0.44, 0.1, 0.52, deep, 0, bot + 0.05, 0.04, m);                     // sole
        }
      });
      return 2.93;                                                                   // the top of the crest
    }

    /* ---------------------------------------------------------------- apply */
    function strip() {
      var C = cur, i;
      if (!C) return;
      cur = null;
      try {
        for (i = 0; i < C.saved.length; i++) { C.saved[i].m.material = C.saved[i].mat; C.saved[i].m.visible = C.saved[i].vis; }
        for (i = 0; i < C.roots.length; i++) if (C.roots[i].parent) C.roots[i].parent.remove(C.roots[i]);
        limbs(C.parts, function (m) { for (var k = m.children.length - 1; k >= 0; k--) if (m.children[k].userData.questHat) m.remove(m.children[k]); });
        for (i = 0; i < C.res.list.length; i++) if (C.res.list[i] && C.res.list[i].dispose) C.res.list[i].dispose();
      } catch (e) {}
    }
    function build(player, clears, opts) {
      var R = newRes(), C = { player: player, res: R, saved: [], roots: [], anims: [], joints: [], sx: [], sz: [], vis: want, box: null, boxG: null };
      C.parts = parts(player);
      function remember(m) { for (var i = 0; i < C.saved.length; i++) if (C.saved[i].m === m) return; C.saved.push({ m: m, mat: m.material, vis: m.visible }); }
      C.paint = function (m, hex) { if (m) { remember(m); m.material = mat(R, hex); } };
      C.hide = function (m) { if (m) { remember(m); m.visible = false; } };
      C.skin = clears >= 20 ? 'chief' : clears >= 10 ? 'snake' : 'palmer';
      C.n = clears >= 20 ? Math.min(9, clears - 20) : clears >= 10 ? clears - 10 : Math.min(9, clears);
      cur = C;                                                                        // from here strip() can undo a half-built man
      C.bodyG = grp(player, 0, 0, 0); C.headG = grp(player, 0, 0, 0); C.roots.push(C.bodyG, C.headG);
      var top = HAIR_TOP, sink = 0.1;
      if (C.skin === 'snake') top = skinSnake(C);
      else if (C.skin === 'chief') { top = skinChief(C); sink = 0.03; }
      if (C.boxG) C.roots.push(C.boxG);
      var by = opts.baseY;
      if (typeof by !== 'number' || !isFinite(by)) by = opts.mq ? HAIR_TOP + 0.34 : top - sink;   // over the Link cap's crown, or down onto the hair
      if (C.skin === 'chief') by = Math.max(by, top - sink);
      C.baseY = by; C.h = 0; C.headTop = top;
      C.tower = grp(player, 0, by, 0); C.roots.push(C.tower);
      var p = C.tower, y = 0, i, g, r;
      for (i = 0; i < C.n; i++) {
        g = grp(p, 0, y, 0);
        r = HATS[i](R, g, C.anims, i === C.n - 1) || { h: 0.4, top: 0 };
        C.joints.push(g); C.sx.push(0); C.sz.push(0);
        C.h += r.h; if (i === C.n - 1) C.h += r.top || 0;
        p = g; y = r.h;
      }
      C.headG.visible = C.vis; C.tower.visible = C.vis;
    }
    function apply(player, clears, opts) {
      try {
        strip();
        clears = Math.max(0, Math.floor(+clears || 0));
        sim.bx = sim.bz = sim.vx = sim.vz = 0; sim.idle = 0; sim.walkT = 0; sim.pSpeed = 0; sim.pYaw = 0; sim.pAir = false;
        if (!T || !player || !player.add || clears === 0) return;                    // nothing to wear: the plain man, untouched
        build(player, clears, opts || {});
      } catch (e) { try { strip(); } catch (e2) {} if (window.console && console.warn) console.warn('QuestHats.apply', e); }
    }

    /* ---------------------------------------------------------------- update */
    function update(dt, st) {
      try {
        var C = cur; if (!C) return;
        st = st || {}; dt = clamp(fin(dt), 0, 0.1);
        var speed = clamp(fin(st.speed), 0, 30), air = !!st.air, vy = clamp(fin(st.vy), -60, 60), yaw = fin(st.yaw);
        if (!isFinite(sim.walkT) || !isFinite(sim.clock)) { sim.walkT = 0; sim.clock = 0; }
        var moving = st.moving != null ? !!st.moving : speed > 0.5;
        sim.clock += dt;
        var s = { dt: dt, t: (st.t != null && isFinite(+st.t)) ? +st.t : sim.clock, speed: speed, air: air, vy: vy, run: clamp(speed / 9, 0, 1), k: Math.min(1, dt * 9) };
        if (speed > 0.5) sim.walkT += dt * speed * 1.5;
        s.sw = Math.sin(sim.walkT) * s.run;
        s.acc = dt > 0 ? clamp((speed - sim.pSpeed) / dt / 50, -1, 1) : 0;
        var dy = yaw - sim.pYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        s.yr = dt > 0 ? clamp(dy / dt / 10, -1, 1) : 0;
        s.lift = clamp(s.run * 0.42 - (air ? vy * 0.035 : 0), -0.6, 0.9);            // the same lift the Link cap uses
        sim.idle = (moving || air || speed > 0.5 || st.box === false || st.busy || !C.vis) ? 0 : sim.idle + dt;

        // The tower: one damped spring per axis drives the bottom hat, and every hat above follows the one below
        // a beat late. Each hat is hung off the last, so it bends like a fishing rod and cannot come apart.
        var n = C.joints.length, i, lim = 0.085;
        if (n) {
          var tx = -s.run * 0.022 - s.acc * 0.06 - (air ? clamp(vy * 0.005, -0.06, 0.06) : 0) + Math.cos(sim.walkT * 2) * s.run * 0.008;
          var tz = s.sw * 0.032 - s.yr * 0.05 + Math.sin(s.t * 1.1) * 0.004;
          if (sim.pAir && !air) sim.vx += 0.55;                                       // landing: the whole stack nods
          if (!sim.pAir && air) sim.vx -= 0.35;
          var steps = Math.max(1, Math.ceil(dt / 0.017)), h = dt / steps, q;
          for (q = 0; q < steps; q++) {
            sim.vx += ((tx - sim.bx) * 70 - sim.vx * 4.2) * h; sim.bx += sim.vx * h;
            sim.vz += ((tz - sim.bz) * 70 - sim.vz * 4.2) * h; sim.bz += sim.vz * h;
          }
          sim.bx = clamp(sim.bx, -lim, lim); sim.bz = clamp(sim.bz, -lim, lim);
          var lag = Math.min(1, dt * 16);
          C.sx[0] = sim.bx; C.sz[0] = sim.bz;
          for (i = n - 1; i >= 1; i--) { C.sx[i] += (C.sx[i - 1] - C.sx[i]) * lag; C.sz[i] += (C.sz[i - 1] - C.sz[i]) * lag; }
          for (i = 0; i < n; i++) { C.joints[i].rotation.x = C.sx[i] * (i ? 1 : 0.5); C.joints[i].rotation.z = C.sz[i] * (i ? 1 : 0.5); }
        }
        for (i = 0; i < C.anims.length; i++) C.anims[i](s);
        boxStep(C, s);
        sim.pSpeed = speed; sim.pYaw = yaw; sim.pAir = air;
      } catch (e) {}
    }

    return {
      apply: apply,
      update: update,
      setVisible: function (on) {
        want = !!on;
        try { if (cur) { cur.vis = want; cur.headG.visible = want; cur.tower.visible = want; if (cur.boxG && !want) cur.boxG.visible = false; } } catch (e) {}
      },
      height: function () { return cur ? cur.h : 0; },
      top: function () { return cur ? (cur.n ? cur.baseY + cur.h : cur.headTop) : HAIR_TOP; },
      count: function () { return cur ? cur.n : 0; },
      skin: function () { return cur ? cur.skin : 'palmer'; },
      boxed: function () { return !!(cur && cur.vis && cur.box && cur.box.on && cur.box.y < 0.4); },
      palette: function () {
        var k = cur ? cur.skin : 'palmer';
        return k === 'snake' ? { sleeve: 0x5b7089, hand: 0x1d2229, cuff: 0x8ea1b6 } : k === 'chief' ? { sleeve: 0x8fae4e, hand: 0x1b1f24, cuff: 0x66823a } : null;
      },
      dispose: function () { try { strip(); } catch (e) {} }
    };
  };
})();
