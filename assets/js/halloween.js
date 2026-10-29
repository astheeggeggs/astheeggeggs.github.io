/* halloween.js - three nights a year the town dresses up. Defines window.QuestHalloween(api) only; nothing happens until
   the host calls it, and outside the window it hands back a kit that does nothing.

   The window: 30 October, 31 October and 1 November in the visitor's own calendar (local time, any year).
   ?halloween=1 forces it on, ?halloween=0 forces it off (test hooks).

   var hw = window.QuestHalloween({ THREE: THREE, sfx: sfx });  // hw.on: false outside the window (every call a no-op)
   hw.dress(player)            -> true: the plain man is now a Ghostbuster (the host only asks when no earned skin is on)
   hw.reviewer(mesh, i)        the i-th reviewer's costume (0 Freddy, 1 Jason, 2 Frankenstein's monster, 3 Dracula,
                               4 Michael Myers, 5 Ghostface, 6 the Mummy, 7 Pinhead, 8 the Wolfman)
   hw.capture(b)               the rebut, dressed up: proton streams, a trap, in he goes. -> seconds the host should hold
                               him still (b.ko), 0 if nothing started. b is the host's reviewer record (b.mesh, b.ko, b.flee):
                               he stays hidden until the host's own rebut timers (ko, then flee) run out, then reappears.
   hw.decorate({ scene, places, placeAt, fountain, collide, mx })   pumpkins, graves, dead trees, bats, fog, a moon
   hw.update(dt, { t, endgame })                                     per frame (after the man's pose)

   Everything is a box with a flat Lambert material, like the man himself (boxMan in quest.js: +z is his front, -x is
   his right, so his right arm "la" is the one at -x). Costumes swap a mesh's material for one of ours (never touching
   the host's) and hang extra boxes off the head, body and limbs. Plain ES5, never throws into the host. */
(function () {
  'use strict';
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }   // 0..1, no host rnd() is ever drawn
  function gate() {
    var q = null;
    try { var m = String(window.location.search || '').match(/[?&]halloween=([^&]*)/); q = m ? m[1] : null; } catch (e) { q = null; }
    if (q === '1') return true;
    if (q === '0') return false;
    var d = new Date(), mo = d.getMonth(), dd = d.getDate();
    return (mo === 9 && dd >= 30) || (mo === 10 && dd === 1);
  }

  window.QuestHalloween = function (api) {
    api = api || {};
    var T = api.THREE || window.THREE, on = false;
    try { on = !!T && gate(); } catch (e) { on = false; }
    var nop = function () {};
    if (!on) return { on: false, dress: function () { return false; }, reviewer: nop, capture: function () { return 0; }, decorate: nop, update: nop };

    /* ---------------------------------------------------------------- resources (ours, shared between our meshes, kept for the page) */
    var MAT = {}, GEO = {};
    function mat(hex) { var k = 'm' + hex; return MAT[k] || (MAT[k] = new T.MeshLambertMaterial({ color: hex })); }
    function glow(hex, em, k) { var key = 'g' + hex + '_' + em + '_' + k; return MAT[key] || (MAT[key] = new T.MeshLambertMaterial({ color: hex, emissive: em, emissiveIntensity: k })); }
    function geo(w, h, d) { var k = w + '_' + h + '_' + d; return GEO[k] || (GEO[k] = new T.BoxGeometry(w, h, d)); }
    function box(w, h, d, c, x, y, z, parent, shadow) {
      var m = new T.Mesh(geo(w, h, d), typeof c === 'number' ? mat(c) : c);
      m.position.set(x, y, z); if (shadow) m.castShadow = true; m.userData.questHween = true; parent.add(m); return m;
    }
    function grp(parent, x, y, z) { var g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); g.userData.questHween = true; parent.add(g); return g; }
    function canvasMat(w, h, draw) {
      try {
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        draw(cv.getContext('2d'), w, h);
        var tx = new T.CanvasTexture(cv); tx.magFilter = T.NearestFilter; tx.minFilter = T.LinearFilter; tx.generateMipmaps = false;
        if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
        return new T.MeshLambertMaterial({ map: tx });
      } catch (e) { return null; }
    }

    /* ---------------------------------------------------------------- boxMan's parts (the same identification hats.js uses) */
    function near(a, b) { return Math.abs(a - b) < 0.02; }
    function isBox(m, w, h, d) { var p = m.geometry && m.geometry.parameters; return !!p && near(p.width, w) && near(p.height, h) && near(p.depth, d); }
    function parts(man) {
      var u = man.userData || {}, P = { la: u.la, ra: u.ra, ll: u.ll, rl: u.rl, lens: [], brows: [] }, i, m;
      for (i = 0; i < man.children.length; i++) {
        m = man.children[i];
        if (!m.isMesh || m.userData.questHat || m.userData.questHween || m === u.la || m === u.ra || m === u.ll || m === u.rl) continue;
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
    // fn(mesh, sd, arm, top, bot, gnd): sd +1/-1 outward (from where the limb is), top/bot its real extent in its own space
    // (boxMan shifts the shared limb geometry twice, so it is measured), gnd where the ground cuts a standing leg.
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
    function paint(m, c) { if (m) m.material = typeof c === 'number' ? mat(c) : c; }
    function hide(m) { if (m) m.visible = false; }
    function bare(P) { hide(P.shirt); hide(P.tie); P.lens.forEach(hide); P.brows.forEach(hide); }
    function suit(P, body, arms, legs) { paint(P.body, body); paint(P.la, arms); paint(P.ra, arms); paint(P.ll, legs); paint(P.rl, legs); }
    function hands(P, c, w) { limbs(P, function (m, sd, arm, top, bot) { if (arm) box(w || 0.29, 0.2, w || 0.29, c, 0, bot + 0.1, 0, m); }); }
    function boots(P, c, h) { limbs(P, function (m, sd, arm, top, bot, gnd) { if (!arm) box(0.38, h || 0.2, 0.42, c, 0, gnd + (h || 0.2) / 2 - 0.02, 0.03, m); }); }
    var steel = null;
    function steelMat() { return steel || (steel = glow(0xdfe4ea, 0x8a95a3, 0.45)); }

    /* ---------------------------------------------------------------- the nine reviewers */
    var CAST = [
      function freddy(P, g, hd) {
        var red = 0xa3201b, green = 0x2f6e2c, burnt = 0xa85a40, scar = 0x6a2a1c, felt = 0x6b4526, band = 0x2a190d, brown = 0x4a3a2a;
        suit(P, red, red, brown); paint(P.head, burnt); bare(P); hide(P.hair); hide(P.hairBack);
        [0.97, 1.22, 1.47, 1.72].forEach(function (y) { box(0.93, 0.12, 0.53, green, 0, y, 0, g); });           // the sweater's stripes
        box(1.14, 0.05, 1.1, felt, 0, 2.78, 0.03, hd, true);                                                   // fedora: brim
        box(0.84, 0.26, 0.84, felt, 0, 2.935, 0, hd, true);                                                    //         crown
        box(0.86, 0.08, 0.86, band, 0, 2.845, 0, hd);                                                          //         band
        box(0.26, 0.04, 0.6, 0x5a3a1f, 0, 3.07, -0.04, hd);                                                    //         the dent
        box(0.12, 0.07, 0.04, 0x1a0c06, -0.17, 2.4, 0.42, hd); box(0.12, 0.07, 0.04, 0x1a0c06, 0.17, 2.4, 0.42, hd);
        box(0.16, 0.12, 0.03, scar, -0.24, 2.2, 0.41, hd); box(0.12, 0.16, 0.03, scar, 0.22, 2.56, 0.41, hd); box(0.1, 0.08, 0.03, scar, 0.06, 2.27, 0.41, hd);
        box(0.12, 0.08, 0.03, scar, -0.05, 2.62, 0.41, hd);
        box(0.3, 0.05, 0.04, 0x2a0e08, 0.03, 2.1, 0.42, hd);                                                   // the grin
        limbs(P, function (m, sd, arm, top, bot) {
          if (!arm) return;
          [0.25, 0.5, 0.75].forEach(function (f) { box(0.28, 0.1, 0.28, green, 0, top - (top - bot) * f, 0, m); });
          if (sd < 0) {                                                                                         // his right: the glove
            box(0.31, 0.26, 0.31, 0x5a3418, 0, bot + 0.1, 0, m);
            for (var k = 0; k < 4; k++) box(0.035, 0.56, 0.05, steelMat(), -0.105 + k * 0.07, bot - 0.27, 0.09, m);
          } else box(0.29, 0.2, 0.29, burnt, 0, bot + 0.1, 0, m);
        });
      },
      function jason(P, g, hd) {
        var jacket = 0x5e5a36, deep = 0x44412a, white = 0xefece2, hole = 0x18181a, red = 0xd0161e;
        suit(P, jacket, jacket, 0x2e2b24); paint(P.shirt, 0x34332b); hide(P.tie); P.lens.forEach(hide); P.brows.forEach(hide);
        paint(P.head, 0x8a7f6c); paint(P.hair, 0x5c5446); paint(P.hairBack, 0x4a4236);
        box(0.24, 0.2, 0.04, deep, -0.25, 1.55, 0.27, g); box(0.24, 0.2, 0.04, deep, 0.25, 1.55, 0.27, g);    // pockets
        var c1 = box(0.22, 0.14, 0.05, deep, -0.17, 1.84, 0.27, g), c2 = box(0.22, 0.14, 0.05, deep, 0.17, 1.84, 0.27, g); c1.rotation.z = 0.5; c2.rotation.z = -0.5;
        // the hockey mask: a slab, a narrower chin, dark eyes, a grid of breathing holes, three red chevrons
        box(0.72, 0.62, 0.05, white, 0, 2.41, 0.43, hd); box(0.52, 0.2, 0.05, white, 0, 2.03, 0.43, hd);
        box(0.18, 0.12, 0.03, hole, -0.16, 2.43, 0.46, hd); box(0.18, 0.12, 0.03, hole, 0.16, 2.43, 0.46, hd);
        [[-0.12, 2.12], [-0.04, 2.12], [0.04, 2.12], [0.12, 2.12], [-0.08, 2.02], [0, 2.02], [0.08, 2.02], [-0.27, 2.24], [0.27, 2.24], [-0.27, 2.32], [0.27, 2.32], [0, 2.3]]
          .forEach(function (h) { box(0.04, 0.04, 0.02, hole, h[0], h[1], 0.46, hd); });
        function chev(x, y) {
          var a = box(0.13, 0.045, 0.02, red, x - 0.04, y, 0.461, hd), b = box(0.13, 0.045, 0.02, red, x + 0.04, y, 0.461, hd);
          a.rotation.z = -0.65; b.rotation.z = 0.65;
        }
        chev(-0.15, 2.62); chev(0.15, 2.62); chev(-0.22, 2.21);
        limbs(P, function (m, sd, arm, top, bot, gnd) {
          if (!arm) { box(0.38, 0.2, 0.42, 0x1f1c18, 0, gnd + 0.08, 0.03, m); return; }
          box(0.29, 0.2, 0.29, 0x7d725f, 0, bot + 0.1, 0, m);
          if (sd < 0) {                                                                                         // the machete, forward and down
            var h = grp(m, 0, bot + 0.08, 0.04); h.rotation.x = 0.9;
            box(0.08, 0.08, 0.24, 0x1a1a1a, 0, 0, 0.12, h);
            box(0.04, 0.16, 0.86, steelMat(), 0, -0.02, 0.66, h);
          }
        });
      },
      function frankenstein(P, g, hd) {
        var green = 0x7fa35a, deep = 0x5c7a40, hair = 0x111114, jacket = 0x26262c, dark = 0x17171b;
        suit(P, jacket, green, dark); paint(P.head, green); paint(P.hair, hair); paint(P.hairBack, hair); paint(P.shirt, 0x56564e);
        hide(P.tie); P.lens.forEach(hide); P.brows.forEach(hide);
        box(0.9, 0.18, 0.9, hair, 0, 2.93, 0, hd, true);                                                       // the flat top
        box(0.88, 0.08, 0.05, hair, 0, 2.5, 0.43, hd);                                                         // a blunt fringe, with ragged ends
        [-0.3, -0.1, 0.12, 0.3].forEach(function (x, k) { box(0.1, 0.08 + (k % 2) * 0.05, 0.05, hair, x, 2.43 - (k % 2) * 0.02, 0.43, hd); });
        box(0.72, 0.08, 0.06, deep, 0, 2.36, 0.43, hd);                                                        // heavy brow
        box(0.12, 0.06, 0.03, 0x15150f, -0.17, 2.29, 0.42, hd); box(0.12, 0.06, 0.03, 0x15150f, 0.17, 2.29, 0.42, hd);
        box(0.32, 0.04, 0.03, 0x2b3a20, 0, 2.08, 0.42, hd);
        box(0.03, 0.22, 0.03, 0x2b3a20, -0.27, 2.14, 0.42, hd);                                                // stitched cheek
        [2.07, 2.14, 2.21].forEach(function (y) { box(0.09, 0.02, 0.03, 0x2b3a20, -0.27, y, 0.425, hd); });
        [-1, 1].forEach(function (sd) { box(0.2, 0.1, 0.1, 0x9ca3aa, sd * 0.47, 2.03, 0, hd); box(0.06, 0.15, 0.15, 0x8a9198, sd * 0.58, 2.03, 0, hd); });   // neck bolts
        box(0.15, 0.55, 0.04, dark, -0.21, 1.62, 0.27, g); box(0.15, 0.55, 0.04, dark, 0.21, 1.62, 0.27, g);   // lapels
        [-0.32, -0.05, 0.25].forEach(function (x, k) { box(0.16, 0.12, 0.52, jacket, x, 0.76 - (k % 2) * 0.04, 0, g); });   // ragged hem
        limbs(P, function (m, sd, arm, top, bot, gnd) {
          if (!arm) { box(0.42, 0.3, 0.48, 0x0d0d0f, 0, gnd + 0.13, 0.04, m); return; }                       // the big boots
          box(0.31, 0.56, 0.31, jacket, 0, top - 0.26, 0, m);                                                  // sleeves too short for him
          box(0.1, 0.1, 0.31, jacket, sd * 0.08, top - 0.58, 0, m);
          box(0.31, 0.22, 0.31, deep, 0, bot + 0.1, 0, m);
        });
      },
      function dracula(P, g, hd) {
        var pale = 0xdfe4d8, hair = 0x0c0c12, black = 0x141418, red = 0xa3121f, redD = 0x6e0a14;
        suit(P, black, black, black); paint(P.head, pale); paint(P.hair, hair); paint(P.hairBack, hair);
        hide(P.tie); P.lens.forEach(hide); P.brows.forEach(function (b) { paint(b, hair); });
        var wp = box(0.22, 0.22, 0.05, hair, 0, 2.52, 0.425, hd); wp.rotation.z = Math.PI / 4;                 // widow's peak
        box(0.12, 0.06, 0.03, 0x111111, -0.17, 2.37, 0.42, hd); box(0.12, 0.06, 0.03, 0x111111, 0.17, 2.37, 0.42, hd);
        box(0.05, 0.05, 0.03, glow(0xff2020, 0xff0000, 0.6), -0.17, 2.37, 0.43, hd); box(0.05, 0.05, 0.03, glow(0xff2020, 0xff0000, 0.6), 0.17, 2.37, 0.43, hd);
        box(0.26, 0.035, 0.03, 0x5a0a10, 0, 2.13, 0.42, hd);
        box(0.04, 0.08, 0.03, 0xffffff, -0.07, 2.09, 0.425, hd); box(0.04, 0.08, 0.03, 0xffffff, 0.07, 2.09, 0.425, hd);   // fangs
        box(0.28, 0.1, 0.05, red, 0, 1.82, 0.32, g);                                                           // bow tie
        box(0.13, 0.13, 0.04, 0xd9a520, 0, 1.52, 0.32, g);                                                     // medallion
        var r1 = box(0.04, 0.3, 0.03, red, -0.07, 1.68, 0.31, g), r2 = box(0.04, 0.3, 0.03, red, 0.07, 1.68, 0.31, g); r1.rotation.z = -0.35; r2.rotation.z = 0.35;
        // the cape: black outside, red inside, flaring out at the sides, and the high collar round his head
        box(1.56, 1.76, 0.06, black, 0, 1.06, -0.34, g, true); box(1.44, 1.66, 0.02, red, 0, 1.08, -0.3, g);
        [-1, 1].forEach(function (sd) {
          var f = grp(g, sd * 0.78, 1.06, -0.34); f.rotation.y = sd * 0.55;
          box(0.03, 1.74, 0.5, black, sd * 0.02, 0, 0.25, f); box(0.02, 1.64, 0.46, red, -sd * 0.01, 0.02, 0.25, f);
          var c = grp(hd, sd * 0.52, 2.28, -0.46); c.rotation.y = sd * 0.5; c.rotation.z = -sd * 0.12;
          box(0.04, 0.78, 0.42, black, sd * 0.02, 0, 0.21, c); box(0.02, 0.72, 0.38, red, -sd * 0.01, 0, 0.21, c);
        });
        box(1.08, 0.74, 0.05, black, 0, 2.25, -0.5, hd); box(0.98, 0.66, 0.02, redD, 0, 2.27, -0.47, hd);
        hands(P, pale, 0.28);
      },
      function myers(P, g, hd) {
        var mask = 0xf3f0e6, hair = 0x4a3020, navy = 0x27324d, deep = 0x1a2236;
        suit(P, navy, navy, navy); paint(P.head, mask); paint(P.hair, hair); paint(P.hairBack, hair); bare(P);
        box(0.17, 0.1, 0.03, 0x0e0e10, -0.17, 2.39, 0.42, hd); box(0.17, 0.1, 0.03, 0x0e0e10, 0.17, 2.39, 0.42, hd);
        box(0.07, 0.15, 0.04, 0xd8d4c6, 0, 2.27, 0.42, hd);
        box(0.18, 0.025, 0.03, 0xa9a394, 0, 2.11, 0.41, hd);
        [-1, 1].forEach(function (sd) { box(0.06, 0.44, 0.7, hair, sd * 0.45, 2.47, -0.06, hd); });
        box(0.86, 0.3, 0.1, hair, 0, 2.1, -0.41, hd);                                                          // down to the nape
        box(0.22, 0.09, 0.05, hair, -0.2, 2.49, 0.43, hd); box(0.16, 0.07, 0.05, hair, 0.12, 2.5, 0.43, hd);
        box(0.64, 0.1, 0.54, deep, 0, 1.88, 0, g);                                                             // coverall collar
        box(0.04, 1.02, 0.03, 0x8d96a8, 0, 1.36, 0.26, g);                                                     // zip
        box(0.2, 0.16, 0.03, deep, 0.24, 1.63, 0.26, g);
        boots(P, 0x111114, 0.2);
        limbs(P, function (m, sd, arm, top, bot) {
          if (!arm) return;
          box(0.28, 0.2, 0.28, 0xe2c6a4, 0, bot + 0.1, 0, m);
          if (sd < 0) {                                                                                         // the kitchen knife, blade down
            box(0.08, 0.18, 0.09, 0x2a1a10, 0, bot - 0.06, 0.03, m);
            box(0.03, 0.5, 0.12, steelMat(), 0, bot - 0.4, 0.05, m);
          }
        });
      },
      function ghostface(P, g, hd) {
        var black = 0x0f0f12, deep = 0x1e1e26, white = 0xf4f2ea, ink = 0x050505;
        suit(P, black, black, black); paint(P.head, black); paint(P.hair, black); paint(P.hairBack, black); bare(P);
        box(0.98, 0.1, 0.98, black, 0, 2.86, -0.01, hd); box(0.44, 0.12, 0.56, black, 0, 2.95, -0.12, hd);   // the hood
        [-1, 1].forEach(function (sd) { box(0.08, 1.0, 0.92, black, sd * 0.47, 2.36, -0.02, hd); });
        box(0.98, 0.1, 0.06, deep, 0, 2.82, 0.46, hd);
        box(1.04, 0.2, 0.62, black, 0, 1.86, 0, g);                                                            // shoulder cape
        box(0.6, 0.62, 0.05, white, 0, 2.42, 0.43, hd);                                                        // the long white face
        box(0.52, 0.16, 0.05, white, 0, 2.06, 0.43, hd); box(0.38, 0.14, 0.05, white, 0, 1.92, 0.43, hd);
        var e1 = box(0.14, 0.24, 0.03, ink, -0.15, 2.44, 0.46, hd), e2 = box(0.14, 0.24, 0.03, ink, 0.15, 2.44, 0.46, hd); e1.rotation.z = 0.22; e2.rotation.z = -0.22;
        box(0.14, 0.3, 0.03, ink, 0, 2.06, 0.46, hd); box(0.1, 0.06, 0.03, ink, 0, 2.23, 0.46, hd);
        box(1.0, 0.86, 0.62, black, 0, 0.44, 0, g, true);                                                      // robe to the ground
        [-0.36, -0.08, 0.2].forEach(function (x, k) { box(0.18, 0.1, 0.64, deep, x, 0.05 + (k % 2) * 0.05, 0, g); });
        limbs(P, function (m, sd, arm, top, bot) { if (arm) { box(0.38, 0.34, 0.38, black, 0, bot + 0.22, 0, m); box(0.24, 0.14, 0.24, deep, 0, bot - 0.02, 0, m); } });
      },
      function mummy(P, g, hd) {
        var band = 0xe6dcc0, deep = 0xcfc3a3, shade = 0xa99c79, eye = 0x140e08;
        suit(P, band, band, band); paint(P.head, band); paint(P.hair, deep); paint(P.hairBack, band); bare(P);
        [0.88, 1.06, 1.25, 1.44, 1.64, 1.83].forEach(function (y, k) { var s = box(0.93, 0.05, 0.53, shade, 0, y, 0, g); s.rotation.z = k % 2 ? 0.07 : -0.06; });
        [2.03, 2.18, 2.52, 2.66].forEach(function (y, k) { var s = box(0.82, 0.04, 0.82, shade, 0, y, 0, hd); s.rotation.z = k % 2 ? -0.08 : 0.06; });
        box(0.2, 0.06, 0.03, eye, 0.17, 2.37, 0.415, hd);                                                     // one eye
        var w = box(0.42, 0.1, 0.04, deep, -0.15, 2.38, 0.42, hd); w.rotation.z = 0.32;                        // the other wrapped over
        box(0.3, 0.04, 0.03, shade, 0.02, 2.1, 0.415, hd);
        limbs(P, function (m, sd, arm, top, bot, gnd) {
          var w2 = arm ? 0.28 : 0.36, y, k = 0;
          for (y = top - 0.12; y > (arm ? bot : gnd) + 0.02; y -= 0.19) { var s = box(w2, 0.045, w2, shade, 0, y, 0, m); s.rotation.x = (k++ % 2) ? 0.12 : -0.1; }
          if (arm && sd > 0) box(0.07, 0.36, 0.02, deep, sd * 0.1, bot - 0.12, 0.13, m);                        // a loose end
        });
      },
      function pinhead(P, g, hd) {
        var pale = 0xd8d1c6, line = 0x8e8079, pin = 0x16161b, leather = 0x1f1b1c, hi = 0x3a3433;
        suit(P, leather, leather, leather); paint(P.head, pale); hide(P.hair); hide(P.hairBack); bare(P);
        var X = [-0.27, -0.09, 0.09, 0.27], Y = [2.06, 2.24, 2.42, 2.6];
        X.forEach(function (x) { box(0.018, 0.78, 0.01, line, x, 2.35, 0.403, hd); box(0.018, 0.01, 0.78, line, x, 2.752, 0, hd); });
        Y.forEach(function (y) { box(0.78, 0.018, 0.01, line, 0, y, 0.403, hd); });
        X.forEach(function (z) { box(0.78, 0.01, 0.018, line, 0, 2.752, z, hd); });
        X.forEach(function (x) {
          Y.forEach(function (y) { box(0.05, 0.05, 0.09, pin, x, y, 0.43, hd); });
          X.forEach(function (z) { box(0.05, 0.09, 0.05, pin, x, 2.78, z, hd); });
          [2.15, 2.4, 2.62].forEach(function (y) { box(0.09, 0.05, 0.05, pin, -0.43, y, x, hd); box(0.09, 0.05, 0.05, pin, 0.43, y, x, hd); box(0.05, 0.05, 0.09, pin, x, y, -0.43, hd); });
        });
        box(0.12, 0.05, 0.02, pin, -0.18, 2.33, 0.405, hd); box(0.12, 0.05, 0.02, pin, 0.18, 2.33, 0.405, hd);
        box(0.66, 0.16, 0.56, hi, 0, 1.94, 0, g);                                                              // a high leather collar
        var s1 = box(0.08, 1.12, 0.03, hi, -0.14, 1.36, 0.265, g), s2 = box(0.08, 1.12, 0.03, hi, 0.14, 1.36, 0.265, g); s1.rotation.z = 0.32; s2.rotation.z = -0.32;
        box(0.14, 0.14, 0.04, steelMat(), 0, 1.36, 0.29, g);
        box(0.98, 0.62, 0.58, leather, 0, 0.55, 0, g, true);                                                   // the long coat
        box(0.03, 0.62, 0.03, hi, 0, 0.55, 0.3, g);
        hands(P, pale, 0.28);
      },
      function wolfman(P, g, hd) {
        var fur = 0x6b4a2c, deep = 0x4b331f, light = 0x93704a, shirt = 0x5d7089, trousers = 0x3a332c;
        suit(P, shirt, shirt, trousers); paint(P.head, fur); paint(P.hair, deep); paint(P.hairBack, deep); paint(P.shirt, fur);
        hide(P.tie); P.lens.forEach(hide); P.brows.forEach(function (b) { paint(b, deep); });
        box(0.38, 0.24, 0.28, light, 0, 2.2, 0.52, hd, true);                                                  // snout
        box(0.15, 0.1, 0.06, 0x120d0b, 0, 2.29, 0.67, hd);
        box(0.05, 0.07, 0.03, 0xf3efe2, -0.12, 2.06, 0.6, hd); box(0.05, 0.07, 0.03, 0xf3efe2, 0.12, 2.06, 0.6, hd);
        box(0.11, 0.07, 0.03, glow(0xf5c242, 0xd08a10, 0.7), -0.17, 2.4, 0.415, hd); box(0.11, 0.07, 0.03, glow(0xf5c242, 0xd08a10, 0.7), 0.17, 2.4, 0.415, hd);
        [-1, 1].forEach(function (sd) {
          var e = box(0.18, 0.28, 0.1, deep, sd * 0.3, 2.95, -0.04, hd); e.rotation.z = -sd * 0.28;            // ears
          var i2 = box(0.08, 0.15, 0.02, 0x9a5a50, sd * 0.29, 2.93, 0.02, hd); i2.rotation.z = -sd * 0.28;
          box(0.1, 0.34, 0.34, deep, sd * 0.44, 2.14, 0.12, hd);                                              // mutton chops
        });
        box(0.24, 0.16, 0.03, fur, -0.27, 1.18, 0.26, g); box(0.16, 0.22, 0.03, fur, 0.28, 0.98, 0.26, g);      // the shirt torn open
        [-0.3, 0.02, 0.3].forEach(function (x, k) { box(0.14, 0.1, 0.52, shirt, x, 0.77 - (k % 2) * 0.05, 0, g); });
        limbs(P, function (m, sd, arm, top, bot, gnd) {
          if (arm) {
            box(0.3, 0.44, 0.3, fur, 0, bot + 0.2, 0, m);
            box(0.1, 0.12, 0.31, shirt, sd * 0.06, bot + 0.46, 0, m);
            for (var k = 0; k < 3; k++) box(0.04, 0.08, 0.04, 0xeeeadd, -0.08 + k * 0.08, bot - 0.03, 0.1, m);
          } else box(0.38, 0.18, 0.46, deep, 0, gnd + 0.08, 0.05, m);
        });
      }
    ];
    function reviewer(man, i) {
      try {
        if (!man || !man.add) return;
        var P = parts(man), g = grp(man, 0, 0, 0), hd = grp(man, 0, 0, 0);
        CAST[((i | 0) % CAST.length + CAST.length) % CAST.length](P, g, hd);
      } catch (e) { if (window.console && console.warn) console.warn('QuestHalloween.reviewer', e); }
    }

    /* ---------------------------------------------------------------- the Ghostbuster */
    var wand = null, tip = null, pack = null, rig = null, man0 = null;
    function logoMat() {
      return canvasMat(32, 32, function (c) {
        c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, 32, 32);
        c.fillStyle = '#f4f2ea'; c.beginPath(); c.arc(16, 16, 14, 0, 6.3); c.fill();
        c.fillStyle = '#1a1a1a'; c.fillRect(12, 9, 9, 13); c.fillRect(10, 13, 13, 8);
        c.fillStyle = '#f4f2ea'; c.fillRect(13, 12, 2, 3); c.fillRect(18, 12, 2, 3);
        c.strokeStyle = '#d4141c'; c.lineWidth = 4; c.beginPath(); c.arc(16, 16, 12, 0, 6.3); c.stroke();
        c.beginPath(); c.moveTo(7, 7); c.lineTo(25, 25); c.stroke();
      });
    }
    function dress(man) {
      try {
        if (!man || !man.add || rig) return !!rig;
        var P = parts(man), g = grp(man, 0, 0, 0);
        var tan = 0xc9b58c, deep = 0xa48f68, black = 0x1d1e22, grey = 0x5d6168, metal = 0x8d9299;
        suit(P, tan, tan, tan); paint(P.shirt, deep); hide(P.tie);
        box(0.66, 0.1, 0.55, deep, 0, 1.89, 0, g);                                                             // collar
        box(0.04, 1.0, 0.03, 0x7c6a4a, 0, 1.36, 0.27, g);                                                      // zip
        box(0.2, 0.07, 0.03, 0xf4f2ea, -0.24, 1.66, 0.265, g); box(0.16, 0.03, 0.02, 0x222222, -0.24, 1.66, 0.28, g);   // name tag
        box(0.94, 0.11, 0.54, black, 0, 0.98, 0, g);                                                           // belt and its kit
        box(0.16, 0.16, 0.12, grey, -0.3, 0.96, 0.29, g); box(0.12, 0.14, 0.1, 0xe8c020, 0.3, 0.97, 0.29, g);
        box(0.14, 0.12, 0.08, grey, 0.4, 0.95, -0.2, g);
        box(0.1, 0.5, 0.04, black, -0.23, 1.66, 0.27, g); box(0.1, 0.5, 0.04, black, 0.23, 1.66, 0.27, g);    // pack straps
        // the proton pack: a frame, the box, the cyclotron with its four lights, a bumper, the gun hose
        pack = grp(g, 0, 0, 0);
        box(0.86, 1.02, 0.08, black, 0, 1.38, -0.3, pack);
        box(0.74, 0.72, 0.32, 0x2c2e33, 0, 1.52, -0.5, pack, true);
        box(0.56, 0.28, 0.34, metal, 0, 1.05, -0.5, pack, true);                                               // cyclotron
        var cyc = [];
        for (var k = 0; k < 4; k++) cyc.push(box(0.09, 0.09, 0.03, glow(0x5a0a0a, 0x000000, 0), -0.18 + k * 0.12, 1.05, -0.675, pack));
        box(0.84, 0.08, 0.16, grey, 0, 0.88, -0.48, pack);                                                     // bumper
        box(0.08, 0.62, 0.08, 0xb8bec6, 0.42, 1.45, -0.5, pack);                                               // the silver tube
        box(0.18, 0.12, 0.1, 0xe8c020, -0.25, 1.83, -0.5, pack); box(0.14, 0.1, 0.1, 0xc7312a, 0.2, 1.84, -0.48, pack);
        box(0.06, 0.06, 0.03, glow(0x7ec8ff, 0x3a9cff, 0.9), 0.24, 1.7, -0.665, pack);
        box(0.3, 0.3, 0.04, grey, -0.12, 1.5, -0.675, pack);
        box(0.06, 0.06, 0.03, glow(0xffd84a, 0xffb000, 0.8), -0.2, 1.58, -0.7, pack);
        [[-0.42, 1.0, -0.42], [-0.5, 0.92, -0.26], [-0.54, 0.86, -0.1]].forEach(function (h) { box(0.12, 0.12, 0.18, 0x26272b, h[0], h[1], h[2], pack); });   // hose to his right hip
        limbs(P, function (m, sd, arm, top, bot, gnd) {
          if (!arm) { box(0.38, 0.24, 0.43, black, 0, gnd + 0.1, 0.03, m); return; }
          box(0.29, 0.2, 0.29, 0x2e2f33, 0, bot + 0.1, 0, m);                                                  // gloves
          box(0.3, 0.06, 0.3, deep, 0, bot + 0.22, 0, m);
          if (sd > 0) { var lm = logoMat(); if (lm) box(0.02, 0.2, 0.2, lm, sd * 0.14, top - 0.22, 0, m); }   // the patch on his left arm
          if (sd < 0) {                                                                                         // the wand in his right hand
            wand = grp(m, 0, bot + 0.08, 0.06); wand.rotation.x = 0.4;
            box(0.13, 0.14, 0.58, grey, 0, 0, 0.2, wand);
            box(0.08, 0.2, 0.08, black, 0, -0.12, 0.06, wand);
            box(0.15, 0.08, 0.2, black, 0, 0.1, 0.12, wand);
            box(0.1, 0.1, 0.16, 0xd0a24a, 0, 0, 0.55, wand);
            box(0.06, 0.06, 0.08, 0x111111, 0, 0, 0.66, wand);
            box(0.04, 0.04, 0.03, glow(0xff3030, 0xff0000, 0.8), 0.05, 0.08, 0.3, wand);
            box(0.1, 0.1, 0.26, 0x26272b, 0, -0.04, -0.14, wand);                                              // the hose leaves the back of it
            tip = grp(wand, 0, 0, 0.72);
          }
        });
        rig = { cyc: cyc, cycT: 0, arm: P.la };
        man0 = man;
        return true;
      } catch (e) { if (window.console && console.warn) console.warn('QuestHalloween.dress', e); return false; }
    }

    /* ---------------------------------------------------------------- the capture: streams, trap, in he goes */
    var scene = api.scene || null, caps = [], puffs = [], tmpA = new T.Vector3(), tmpB = new T.Vector3(), tmpC = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
    var HOLD = 2.25, LIFT_T = 1.0, OPEN_AT = 1.05, SUCK_AT = 1.3, SHUT_AT = 2.15, BEAM_END = 2.0, TRAP_GONE = 4.2;
    var beamGeo = null, BEAM_MATS = null, coneGeo = null;
    function beamMats() {
      if (BEAM_MATS) return BEAM_MATS;
      function add(c, o) { return new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false, fog: false }); }
      BEAM_MATS = [add(0xff7a1a, 0.9), add(0xff9a2a, 0.75), add(0x4aa8ff, 0.85), add(0xfff2d8, 0.95)];
      return BEAM_MATS;
    }
    var BEAMS = [[0, 0.13, 0], [1, 0.1, 2.1], [2, 0.09, 4.2], [3, 0.05, 1.0]], SEG = 11;
    function makeBeams() {
      if (!beamGeo) beamGeo = new T.BoxGeometry(1, 1, 1);
      var M = beamMats(), g = new T.Group(), list = [], j, k, s;
      for (j = 0; j < BEAMS.length; j++) {
        var segs = [];
        for (k = 0; k < SEG; k++) { s = new T.Mesh(beamGeo, M[BEAMS[j][0]]); s.frustumCulled = false; g.add(s); segs.push(s); }
        list.push(segs);
      }
      scene.add(g);
      return { g: g, list: list, pts: [] };
    }
    function drawBeams(B, a, b, t, life) {
      var dir = tmpC.subVectors(b, a), len = dir.length() || 1, j, k, u, amp, p, q, px, py, pz;
      dir.multiplyScalar(1 / len);
      var s1 = new T.Vector3().crossVectors(dir, UP); if (s1.lengthSq() < 1e-4) s1.set(1, 0, 0); s1.normalize();
      var s2 = new T.Vector3().crossVectors(s1, dir).normalize();
      for (j = 0; j < B.list.length; j++) {
        var segs = B.list[j], th = BEAMS[j][1] * (0.7 + 0.6 * Math.random()), ph = BEAMS[j][2], prev = null;
        for (k = 0; k <= SEG; k++) {
          u = k / SEG;
          amp = Math.sin(u * Math.PI) * (0.18 + 0.12 * Math.sin(t * 9 + ph)) * (j === 3 ? 0.4 : 1);
          var wob1 = Math.sin(u * 13 + t * 31 + ph) * amp + (Math.random() - 0.5) * amp * 0.9;
          var wob2 = Math.cos(u * 11 - t * 27 + ph * 1.7) * amp + (Math.random() - 0.5) * amp * 0.9;
          px = a.x + (b.x - a.x) * u + s1.x * wob1 + s2.x * wob2;
          py = a.y + (b.y - a.y) * u + s1.y * wob1 + s2.y * wob2;
          pz = a.z + (b.z - a.z) * u + s1.z * wob1 + s2.z * wob2;
          if (u > 0.8) {                                                         // the last stretch wraps round him
            var w = (u - 0.8) / 0.2, ang = t * 14 + ph + w * 5.5, r = 0.55 * w;
            px += Math.cos(ang) * r; pz += Math.sin(ang) * r; py += Math.sin(ang * 0.7) * 0.35 * w;
          }
          p = { x: px, y: py, z: pz };
          if (prev) {
            q = segs[k - 1];
            var dx = p.x - prev.x, dy = p.y - prev.y, dz = p.z - prev.z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
            q.position.set((p.x + prev.x) / 2, (p.y + prev.y) / 2, (p.z + prev.z) / 2);
            q.lookAt(p.x, p.y, p.z);
            q.scale.set(th, th, L + th);
            q.visible = life;
          }
          prev = p;
        }
      }
    }
    function freeBeams(B) { if (B && B.g && B.g.parent) B.g.parent.remove(B.g); }
    function makeTrap() {
      var g = new T.Group(), grey = 0x8d9096, yel = 0xf2c230, blk = 0x1c1c1c, k;
      box(0.62, 0.16, 0.44, grey, 0, 0.08, 0, g, true);
      for (k = 0; k < 6; k++) { box(0.1, 0.1, 0.02, k % 2 ? blk : yel, -0.25 + k * 0.1, 0.08, 0.225, g); box(0.1, 0.1, 0.02, k % 2 ? yel : blk, -0.25 + k * 0.1, 0.08, -0.225, g); }
      box(0.66, 0.04, 0.46, 0x5d6168, 0, 0.005, 0, g);
      var lamp = box(0.06, 0.05, 0.06, glow(0xff3030, 0xff0000, 0.9), 0.24, 0.185, 0.16, g);
      var flaps = [];
      [-1, 1].forEach(function (sd) {
        var f = new T.Group(); f.position.set(0, 0.16, sd * 0.21); g.add(f);
        box(0.58, 0.04, 0.2, 0xa9adb3, 0, 0.02, -sd * 0.1, f); box(0.5, 0.045, 0.04, 0x2c2c2c, 0, 0.025, -sd * 0.17, f);
        flaps.push({ g: f, sd: sd });
      });
      if (!coneGeo) coneGeo = new T.CylinderGeometry(0.95, 0.24, 3.2, 10, 1, true);
      var cone = new T.Mesh(coneGeo, new T.MeshBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide }));
      cone.position.y = 1.75; cone.visible = false; g.add(cone);
      g.visible = false; scene.add(g);
      return { g: g, flaps: flaps, cone: cone, lamp: lamp };
    }
    function freeTrap(tr) { if (!tr) return; if (tr.g.parent) tr.g.parent.remove(tr.g); try { tr.cone.material.dispose(); } catch (e) {} }
    function puff(x, y, z, n, big) {
      if (!scene) return;
      var g = new T.Group(), m = new T.MeshLambertMaterial({ color: 0xd8dbe2, transparent: true, opacity: 0.8, depthWrite: false }), list = [], k;
      for (k = 0; k < n; k++) {
        var s = new T.Mesh(geo(0.3, 0.3, 0.3), m), a = k / n * 6.283 + hash(k + x) * 0.6;
        s.position.set(Math.cos(a) * 0.15, 0.1 + hash(k * 3 + z) * 0.3, Math.sin(a) * 0.15); g.add(s);
        list.push({ s: s, vx: Math.cos(a) * (big ? 1.4 : 0.9), vy: 0.8 + hash(k * 7) * 1.0, vz: Math.sin(a) * (big ? 1.4 : 0.9) });
      }
      g.position.set(x, y, z); scene.add(g);
      puffs.push({ g: g, m: m, list: list, t: 0, life: big ? 1.1 : 0.9 });
    }
    function capture(b) {
      try {
        if (!scene || !rig || !b || !b.mesh) return 0;
        for (var i = 0; i < caps.length; i++) if (caps[i].b === b) return 0;
        var m = b.mesh, u = m.userData || {};
        var c = { b: b, m: m, t: 0, s0: m.scale.x, ry: m.rotation.y, x: m.position.x, z: m.position.z, beams: makeBeams(), trap: makeTrap(), phase: 0, hidden: false, gone: false, u: u };
        if (tip) { tip.getWorldPosition(tmpA); c.tx = tmpA.x; c.ty = tmpA.y; c.tz = tmpA.z; } else { c.tx = c.x; c.ty = 1; c.tz = c.z; }
        caps.push(c);
        snd('plasma', c, { gain: 0.5, gate: 0 }); snd('plasma', c, { gain: 0.4, delay: 0.3, gate: 0 }); snd('plasma', c, { gain: 0.4, delay: 0.65, gate: 0 });
        return HOLD;
      } catch (e) { return 0; }
    }
    function snd(name, c, o) { try { if (api.sfx) { o = o || {}; o.pos = { x: c.x, y: 1.4, z: c.z }; api.sfx(name, o); } } catch (e) {} }
    function resetMan(c) {
      var m = c.m, u = c.u;
      m.scale.set(c.s0, c.s0, c.s0); m.rotation.x = 0; m.rotation.z = 0; m.rotation.y = c.ry; m.position.y = 0;
      [u.la, u.ra, u.ll, u.rl].forEach(function (l) { if (l) { l.rotation.x = 0; l.rotation.z = 0; } });
    }
    function capStep(c, dt, t, endgame) {
      var m = c.m, u = c.u, k, f;
      c.t += dt;
      if (endgame) {                                                          // the town is over: tidy up, leave him to the host
        if (!c.hidden) resetMan(c);
        freeBeams(c.beams); c.beams = null; freeTrap(c.trap); c.trap = null; c.gone = true; return;
      }
      var tt = c.t;
      // the stream
      if (c.beams) {
        if (tt < BEAM_END && tip) {
          tip.getWorldPosition(tmpA);
          var sc = m.scale.x / (c.s0 || 1);
          tmpB.set(m.position.x, m.position.y + 1.45 * c.s0 * sc, m.position.z);
          drawBeams(c.beams, tmpA, tmpB, t, true);
          if (rig && rig.arm) rig.arm.rotation.x = -0.55 + Math.sin(t * 40) * 0.04;   // aiming: the arm up, shaking with the recoil
        } else { freeBeams(c.beams); c.beams = null; }
      }
      // the man: lifts and flails, then shrinks and spins down into the trap
      if (!c.hidden) {
        if (tt < SUCK_AT) {
          var lift = smooth(tt / LIFT_T);
          m.position.y = lift * 0.95 + Math.sin(tt * 7) * 0.06 * lift;
          m.rotation.z = Math.sin(tt * 9) * 0.18 * lift; m.rotation.x = Math.sin(tt * 6.3) * 0.1 * lift;
          m.position.x = c.x + Math.sin(tt * 23) * 0.04 * lift; m.position.z = c.z + Math.cos(tt * 19) * 0.04 * lift;
          if (u.la) { u.la.rotation.x = -2.3 + Math.sin(tt * 21) * 0.9; u.la.rotation.z = -0.4 + Math.sin(tt * 17) * 0.3; }
          if (u.ra) { u.ra.rotation.x = -2.0 + Math.sin(tt * 19 + 2) * 0.9; u.ra.rotation.z = 0.4 + Math.sin(tt * 15) * 0.3; }
          if (u.ll) u.ll.rotation.x = Math.sin(tt * 16) * 0.7;
          if (u.rl) u.rl.rotation.x = -Math.sin(tt * 16) * 0.7;
        } else if (tt < SHUT_AT) {
          f = (tt - SUCK_AT) / (SHUT_AT - SUCK_AT);
          var s = c.s0 * Math.max(0.02, Math.pow(1 - f, 1.6));
          m.scale.set(s, s, s);
          m.position.set(c.x, 0.95 * (1 - f * f) + 0.18 * f * f, c.z);
          m.rotation.y += dt * (6 + 34 * f); m.rotation.z *= 0.9;
          if (u.la) u.la.rotation.x = -2.6; if (u.ra) u.ra.rotation.x = -2.6;
        } else {
          m.visible = false; c.hidden = true; resetMan(c); m.position.x = c.x; m.position.z = c.z;
          puff(c.x, 0.25, c.z, 7, false); snd('click', c, { gain: 0.9, gate: 0 });
        }
      }
      // the trap: thrown from his hand, lands at the reviewer's feet, opens, light, shuts, sits, sinks away
      var tr = c.trap;
      if (tr) {
        if (tt >= 0.5) tr.g.visible = true;
        if (tt < 0.95) {
          f = clamp((tt - 0.5) / 0.45, 0, 1);
          tr.g.position.set(c.tx + (c.x - c.tx) * f, (c.ty - 0.6) * (1 - f) + Math.sin(f * Math.PI) * 1.2, c.tz + (c.z - c.tz) * f);
          tr.g.rotation.y = f * 6.0; tr.g.rotation.x = (1 - f) * 2.0;
        } else {
          if (!c.landed) { c.landed = true; tr.g.position.set(c.x, 0, c.z); tr.g.rotation.set(0, Math.atan2(c.tx - c.x, c.tz - c.z), 0); snd('click', c, { gain: 0.6, gate: 0 }); }
          var open = tt < OPEN_AT ? 0 : tt < SHUT_AT ? smooth((tt - OPEN_AT) / 0.2) : Math.max(0, 1 - (tt - SHUT_AT) / 0.06);
          for (k = 0; k < tr.flaps.length; k++) tr.flaps[k].g.rotation.x = -tr.flaps[k].sd * 1.9 * open;
          var lit = tt >= OPEN_AT && tt < SHUT_AT ? Math.min(1, (tt - OPEN_AT) / 0.15) * (0.75 + 0.25 * Math.sin(t * 37)) : 0;
          tr.cone.visible = lit > 0; tr.cone.material.opacity = 0.42 * lit; tr.cone.scale.set(0.8 + 0.2 * lit, 1, 0.8 + 0.2 * lit);
          if (tt >= SUCK_AT && !c.whoosh) { c.whoosh = true; snd('teleport', c, { gain: 0.55, gate: 0 }); }
          tr.lamp.visible = tt < SHUT_AT || Math.floor(tt * 4) % 2 === 0;
          if (tt > SHUT_AT && tt < SHUT_AT + 0.4) tr.g.position.y = Math.abs(Math.sin((tt - SHUT_AT) * 16)) * 0.06;   // it rattles
          if (tt > TRAP_GONE - 0.5) { var sk = Math.max(0.001, (TRAP_GONE - tt) / 0.5); tr.g.scale.set(sk, sk, sk); }
          if (tt >= TRAP_GONE) { freeTrap(tr); c.trap = null; }
        }
      }
      // back again: once the host's own rebut timers have run out he walks out of thin air
      if (c.hidden && !c.trap && !(c.b.ko > 0) && !(c.b.flee > 0)) {
        m.visible = true; puff(m.position.x, 0.4, m.position.z, 9, true); c.gone = true;
      }
    }

    /* ---------------------------------------------------------------- the spooky town */
    var deco = { bats: [], fog: [], moon: null, glowMat: null, flick: [] };
    function pumpkin(parent, x, y, z, yaw, s, R) {
      var g = new T.Group(); g.position.set(x, y, z); g.rotation.y = yaw; g.scale.set(s, s, s); parent.add(g);
      var mk = R ? function (w, h, d, c, px, py, pz) { var mm = new T.Mesh(new T.BoxGeometry(w, h, d), typeof c === 'number' ? new T.MeshLambertMaterial({ color: c }) : c); mm.position.set(px, py, pz); g.add(mm); R.push(mm.geometry, mm.material); return mm; }
        : function (w, h, d, c, px, py, pz) { return box(w, h, d, c, px, py, pz, g); };
      var gm = R ? new T.MeshLambertMaterial({ color: 0xffd060, emissive: 0xff9a1a, emissiveIntensity: 0.9 }) : deco.glowMat;
      if (R) deco.flick.push(gm);
      mk(0.34, 0.52, 0.62, 0xf08a1c, 0, 0.26, 0); mk(0.18, 0.46, 0.58, 0xd9701a, -0.25, 0.24, 0); mk(0.18, 0.46, 0.58, 0xd9701a, 0.25, 0.24, 0);
      mk(0.08, 0.36, 0.48, 0xc4611a, -0.37, 0.21, 0); mk(0.08, 0.36, 0.48, 0xc4611a, 0.37, 0.21, 0);
      mk(0.08, 0.14, 0.08, 0x4f7a28, 0.02, 0.58, 0);
      mk(0.12, 0.09, 0.03, gm, -0.12, 0.34, 0.31); mk(0.12, 0.09, 0.03, gm, 0.12, 0.34, 0.31);
      mk(0.3, 0.06, 0.03, gm, 0, 0.17, 0.31); mk(0.06, 0.04, 0.03, gm, -0.12, 0.215, 0.31); mk(0.06, 0.04, 0.03, gm, 0.1, 0.215, 0.31);
      return g;
    }
    var RIP = ['RIP', 'H₀', 'p=.051', 'N=3', 'R2', 'v1.0'];
    var ripMats = {};
    function ripMat(i) {
      var s = RIP[i % RIP.length];
      if (ripMats[s] !== undefined) return ripMats[s];
      ripMats[s] = canvasMat(48, 32, function (c, w, h) {
        c.fillStyle = '#9a9ea6'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#3a3c42'; c.font = 'bold 13px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, w / 2, h / 2 + 1);
      });
      return ripMats[s];
    }
    function grave(sc, x, z, yaw, i) {
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; sc.add(g);
      var stone = 0x9a9ea6, dark = 0x6e7279, kind = Math.floor(hash(i * 5.3) * 3);
      if (kind === 2) { box(0.14, 0.95, 0.14, stone, 0, 0.47, 0, g, true); box(0.52, 0.14, 0.14, stone, 0, 0.68, 0, g); }   // a cross
      else {
        box(0.6, 0.74, 0.16, stone, 0, 0.37, 0, g, true); box(0.42, 0.12, 0.16, stone, 0, 0.8, 0, g);
        if (kind === 0) box(0.22, 0.08, 0.16, stone, 0, 0.9, 0, g);
        var rm = ripMat(i); if (rm) box(0.4, 0.27, 0.01, rm, 0, 0.5, 0.085, g);
        box(0.6, 0.06, 0.18, dark, 0, 0.03, 0, g);
      }
      box(0.56, 0.08, 0.9, 0x4a3a2a, 0, 0.04, 0.6, g);                                                          // the mound
      g.rotation.z = (hash(i * 2.1) - 0.5) * 0.18; g.rotation.x = (hash(i * 3.7) - 0.5) * 0.14;
    }
    function deadTree(sc, x, z, i) {
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = hash(i * 9.1) * 6.28; sc.add(g);
      var bark = 0x2a2226, s = 0.9 + hash(i * 4.4) * 0.5;
      g.scale.set(s, s, s);
      box(0.3, 2.6, 0.3, bark, 0, 1.3, 0, g, true);
      [[0.9, 1.5, 0.7, 0], [1.0, 2.0, -0.8, 1.6], [0.8, 2.4, 0.6, 3.2], [0.7, 2.7, -0.5, 4.4]].forEach(function (b, k) {
        var p = new T.Group(); p.position.set(0, b[1], 0); p.rotation.set(0, b[3], b[2]); g.add(p);
        box(0.14, b[0], 0.14, bark, 0, b[0] / 2, 0, p, true);
        var q = new T.Group(); q.position.set(0, b[0] * 0.75, 0); q.rotation.z = -b[2] * 0.9; p.add(q);
        box(0.08, b[0] * 0.5, 0.08, bark, 0, b[0] * 0.25, 0, q);
      });
    }
    function bat(sc, i) {
      var g = new T.Group(), body = 0x16141a, wing = 0x231f29; sc.add(g);
      box(0.18, 0.14, 0.32, body, 0, 0, 0, g); box(0.14, 0.12, 0.12, body, 0, 0.04, 0.2, g);
      box(0.04, 0.08, 0.03, body, -0.05, 0.13, 0.22, g); box(0.04, 0.08, 0.03, body, 0.05, 0.13, 0.22, g);
      var w = [];
      [-1, 1].forEach(function (sd) {
        var p = new T.Group(); p.position.set(sd * 0.09, 0.02, 0); g.add(p);
        box(0.42, 0.03, 0.26, wing, sd * 0.21, 0, -0.02, p); box(0.24, 0.03, 0.14, wing, sd * 0.5, 0, -0.08, p);
        w.push({ p: p, sd: sd });
      });
      deco.bats.push({ g: g, w: w, r: 4.5 + hash(i * 1.3) * 5, h: 6 + hash(i * 2.9) * 4, sp: (0.5 + hash(i * 3.3) * 0.5) * (i % 3 ? 1 : -1), ph: hash(i * 4.1) * 6.28, fl: 11 + hash(i) * 5 });
    }
    function roadish(x, z) {                                   // the roads, the fountain square, the lake: keep the dressing off them
      if (Math.abs(z + 10) < 3.4 || Math.abs(z - 10) < 3.4) return true;
      if (Math.abs(x) < 3.4 && Math.abs(z) < 14) return true;
      if (Math.abs(Math.abs(x) - 40) < 3.4 && Math.abs(z) < 14) return true;
      if (Math.hypot(x, z - 40) < 13) return true;
      return Math.hypot(x, z) < 6;
    }
    function decorate(o) {
      try {
        o = o || {}; var sc = o.scene; if (!sc) return;
        scene = sc;
        var mx = o.mx || function (x) { return x; }, free = function (x, z, r) { try { return !(o.collide && o.collide(x, z, r)) && !roadish(x, z); } catch (e) { return false; } };
        deco.glowMat = new T.MeshLambertMaterial({ color: 0xffd060, emissive: 0xff9a1a, emissiveIntensity: 0.9 }); deco.flick.push(deco.glowMat);
        // pumpkins either side of every door, facing the fountain with the door
        (o.places || []).forEach(function (p, i) {
          if (!o.placeAt || !(p.d > 0)) return;
          [-1, 1].forEach(function (sd) {
            var at = o.placeAt(p, sd * 2.85, p.d / 2 + 0.55);
            pumpkin(sc, at.x, 0, at.z, p.yaw + (hash(i * 7 + sd) - 0.5) * 0.5, sd > 0 ? 1 : 0.8, null);
          });
        });
        // and on the fountain's rim (its own resources: the editor's landing throws the whole fountain away and disposes it)
        if (o.fountain && o.fountain.add) {
          var R = [];
          [0.6, 2.2, 3.9, 5.3].forEach(function (a, k) { pumpkin(o.fountain, Math.cos(a) * 2.45, 0.6, Math.sin(a) * 2.45, -a + Math.PI / 2 + Math.PI, k % 2 ? 0.55 : 0.65, R); });
        }
        // two small graveyards and their dead trees, on open grass (each stone checked against the colliders and the roads)
        var yards = [[-27, 1.5], [24, 2.5], [-44, -30], [44, 34]], n = 0;
        yards.forEach(function (y, yi) {
          var cx = mx(y[0]), cz = y[1], r, c, x, z;
          for (r = 0; r < 2; r++) for (c = 0; c < 3; c++) {
            x = cx + (c - 1) * 1.7 + (hash(n * 1.7) - 0.5) * 0.4; z = cz + (r - 0.5) * 2.4;
            n++;
            if (free(x, z, 0.9)) grave(sc, x, z, Math.PI * (yi % 2 ? 0.5 : -0.5) * (cx < 0 ? -1 : 1) + (hash(n) - 0.5) * 0.3, n);
          }
          for (var tk = 0; tk < 6; tk++) {                      // a dead tree just past the stones, where there is room
            x = cx + (hash(yi * 13 + tk) - 0.5) * 9; z = cz + (tk % 2 ? 3.6 : -3.6) + (hash(yi * 17 + tk) - 0.5);
            if (free(x, z, 1.4)) { deadTree(sc, x, z, yi * 10 + tk); break; }
          }
        });
        // bats round the fountain
        for (var bi = 0; bi < 7; bi++) bat(sc, bi);
        // a few low drifts of green-white fog
        var fogGeo = new T.CircleGeometry(1, 18);
        for (var fi = 0; fi < 8; fi++) {
          var fm = new T.MeshBasicMaterial({ color: 0xc8f0d4, transparent: true, opacity: 0.12, depthWrite: false });
          var fp = new T.Mesh(fogGeo, fm), fr = 4 + hash(fi * 2.2) * 4;
          fp.rotation.x = -Math.PI / 2; fp.scale.set(fr, fr * (0.6 + hash(fi) * 0.4), 1); fp.renderOrder = 2;
          fp.position.set((hash(fi * 5.5) * 2 - 1) * 42, 0.18 + fi * 0.012, (hash(fi * 6.6) * 2 - 1) * 36); sc.add(fp);
          deco.fog.push({ m: fp, v: 0.25 + hash(fi * 8.8) * 0.4, ph: hash(fi * 9.9) * 6.28, base: 0.1 + hash(fi * 3.1) * 0.06 });
        }
        // a full moon, low over the north row
        var moon = new T.Group();
        moon.add(new T.Mesh(new T.CircleGeometry(11, 32), new T.MeshBasicMaterial({ color: 0xf6efcf, fog: false })));
        var halo = new T.Mesh(new T.CircleGeometry(19, 32), new T.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
        halo.position.z = -0.5; moon.add(halo);
        [[-3, 3, 2.2], [4, -1, 1.6], [-1, -5, 1.3], [5, 5, 0.9]].forEach(function (cr) { var cm = new T.Mesh(new T.CircleGeometry(cr[2], 16), new T.MeshBasicMaterial({ color: 0xd9d1b0, fog: false })); cm.position.set(cr[0], cr[1], 0.1); moon.add(cm); });
        moon.position.set(mx(-40), 45, -200); moon.lookAt(0, 0, 0); sc.add(moon); deco.moon = moon;
      } catch (e) { if (window.console && console.warn) console.warn('QuestHalloween.decorate', e); }
    }
    function decoStep(dt, t, endgame) {
      var i, b, a;
      if (endgame && !deco.batsGone) { deco.batsGone = true; for (i = 0; i < deco.bats.length; i++) deco.bats[i].g.visible = false; }   // the boss lands where they circle
      for (i = 0; i < (deco.batsGone ? 0 : deco.bats.length); i++) {
        b = deco.bats[i]; a = b.ph + t * b.sp;
        b.g.position.set(Math.cos(a) * b.r, b.h + Math.sin(t * 1.7 + b.ph) * 0.6, Math.sin(a) * b.r);
        b.g.rotation.y = -a + (b.sp > 0 ? Math.PI : 0);
        var fl = Math.sin(t * b.fl + b.ph) * 0.9;
        b.w[0].p.rotation.z = fl; b.w[1].p.rotation.z = -fl;
      }
      for (i = 0; i < deco.fog.length; i++) {
        var f = deco.fog[i]; f.m.position.x += f.v * dt; if (f.m.position.x > 50) f.m.position.x = -50;
        f.m.material.opacity = f.base * (0.75 + 0.25 * Math.sin(t * 0.4 + f.ph));
      }
      var fk = 0.75 + 0.2 * Math.sin(t * 11) * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 23);
      for (i = 0; i < deco.flick.length; i++) deco.flick[i].emissiveIntensity = fk;
    }

    /* ---------------------------------------------------------------- per frame */
    function update(dt, st) {
      try {
        st = st || {}; dt = clamp(+dt || 0, 0, 0.1);
        var t = isFinite(+st.t) ? +st.t : 0, i;
        if (rig) {                                                                // the cyclotron turns
          rig.cycT += dt * (caps.length ? 14 : 3.5);
          var on = Math.floor(rig.cycT) % 4;
          for (i = 0; i < 4; i++) { rig.cyc[i].material = glow(i === on ? 0xff4a3a : 0x5a0a0a, i === on ? 0xff2010 : 0x000000, i === on ? 1 : 0); }
        }
        for (i = caps.length - 1; i >= 0; i--) {
          try { capStep(caps[i], dt, t, !!st.endgame); }
          catch (e) { try { caps[i].m.visible = true; } catch (e2) {} caps[i].gone = true; }   // a capture that throws gives the reviewer back rather than leave him invisible
          if (caps[i].gone) caps.splice(i, 1);
        }
        for (i = puffs.length - 1; i >= 0; i--) {
          var p = puffs[i], k; p.t += dt;
          var f = p.t / p.life;
          for (k = 0; k < p.list.length; k++) { var q = p.list[k]; q.s.position.x += q.vx * dt; q.s.position.y += q.vy * dt; q.s.position.z += q.vz * dt; q.s.scale.setScalar(1 + f * 2.2); }
          p.m.opacity = 0.8 * (1 - f);
          if (f >= 1) { if (p.g.parent) p.g.parent.remove(p.g); p.m.dispose(); puffs.splice(i, 1); }
        }
        decoStep(dt, t, !!st.endgame);
      } catch (e) {}
    }

    return { on: true, dress: dress, reviewer: reviewer, capture: capture, decorate: decorate, update: update };
  };
})();
