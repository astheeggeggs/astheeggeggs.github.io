
    /* ------------------------------------------------------------ particles: one unit box, a handful of shared materials */
    var FX = null;
    function fxInit() {
      function basic(c) { return new THREE.MeshBasicMaterial({ color: c, fog: false }); }
      FX = { geo: new THREE.BoxGeometry(1, 1, 1), pool: [], live: [], cap: 230, made: 0,
        mats: { dust: api.flat(0x8a7a66), smoke: api.flat(0x5a5560), soot: api.flat(0x2a262c), water: api.flat(0x7fb8f0), fire: basic(0xff8a2a), flame: basic(0xffe27a), spark: basic(0xfff2b0), gold: basic(0xfcd34d), red: basic(0xff3344), white: basic(0xffffff) } };
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
      var d0 = Math.hypot(p.x, p.z) || 1, rx = p.x / d0, rz = p.z / d0, wallMat = null, roofMat = null;
      grp.children.forEach(function (c) { var P = c.geometry && c.geometry.parameters; if (c.geometry && c.geometry.type === 'ConeGeometry') roofMat = c.material; else if (P && P.width === p.w && P.height === p.h && P.depth === p.d) wallMat = c.material; });
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
        var vol = isBox ? P.width * P.height * P.depth : 1, tiny = (isBox && (vol < 0.2 || P.width === 1.25)) || (g && g.type === 'SphereGeometry');
        if (isBody || tiny || instant) { if (g && !c.isSprite) g.dispose(); if (!shared && c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } }
        if (isBody && !instant) {
          var nx = clamp(Math.round(p.w / 3.5), 2, 4), ny = clamp(Math.round(p.h / 3), 2, 3), nz = clamp(Math.round(p.d / 3.5), 2, 3), cw = p.w / nx, ch = p.h / ny, cd = p.d / nz;
          var cg = new THREE.BoxGeometry(cw * 0.95, ch * 0.95, cd * 0.95); town.geos.push(cg);
          for (var ix = 0; ix < nx; ix++) for (var iy = 0; iy < ny; iy++) for (var iz = 0; iz < nz; iz++) {
            var m = new THREE.Mesh(cg, wallMat); m.position.set(p.x - p.w / 2 + cw * (ix + 0.5), ch * (iy + 0.5), p.z - p.d / 2 + cd * (iz + 0.5)); scene.add(m);
            fling(m, Math.min(cw, ch, cd) * 0.4, false, false);
          }
        } else if (!isBody && !tiny && !instant) {
          c.position.x += p.x; c.position.z += p.z; scene.add(c);
          fling(c, isBox ? Math.min(P.width, P.height, P.depth) * 0.5 : 0.6, true, !shared);
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
        var near = clamp(1.2 - Math.hypot(p.x - api.player.position.x, p.z - api.player.position.z) / 70, 0.25, 1);
        SFX.thud(0.55 * near); noise({ f0: 2400, f1: 300, dur: 0.9, type: 'bandpass', q: 0.7, gain: 0.16 * near });
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
        if (f.t > 2.6) { fxSpawn('white', f.m.position.x, f.m.position.y, f.m.position.z, 0, 0, 0, { life: 0.5, s0: 0.5, s1: 5 }); tone({ f0: 2400, f1: 3200, dur: 0.25, type: 'sine', gain: 0.05 }); scene.remove(f.m); disposeTree(f.m); town.flyers.splice(i, 1); }
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
