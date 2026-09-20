
    /* ------------------------------------------------------------ the boss: box art, 17.7 units of editorial authority */
    var POSES = {
      guard:     { lax: -0.55, laz: 1.05, rax: -0.78, raz: -1.05, llx: 0, rlx: 0, lean: 0.04, bob: 0, headx: 0.12 },
      open:      { lax: 0.14, laz: -0.16, rax: 0.14, raz: 0.16, llx: 0, rlx: 0, lean: 0.24, bob: -0.05, headx: 0.32 },
      volleyUp:  { lax: -0.3, laz: -0.8, rax: -2.45, raz: 0.2, llx: 0, rlx: 0, lean: -0.1, bob: 0.02, headx: -0.1 },
      volleyGo:  { lax: -0.3, laz: -0.6, rax: -1.1, raz: 0.1, llx: 0, rlx: 0, lean: 0.16, bob: 0, headx: 0.15 },
      stompUp:   { lax: -2.9, laz: -0.45, rax: -2.9, raz: 0.45, llx: 0, rlx: -1.15, lean: -0.16, bob: 0.04, headx: -0.2 },
      stompUpL:  { lax: -2.9, laz: -0.45, rax: -2.9, raz: 0.45, llx: -1.15, rlx: 0, lean: -0.16, bob: 0.04, headx: -0.2 },
      stompDown: { lax: -0.5, laz: -0.5, rax: -0.5, raz: 0.5, llx: 0, rlx: 0, lean: 0.34, bob: -0.12, headx: 0.35 },
      rainUp:    { lax: -1.35, laz: 0.25, rax: -3.0, raz: 0.12, llx: 0, rlx: 0, lean: -0.12, bob: 0.03, headx: -0.35 },
      sweepBack: { lax: -0.2, laz: -0.45, rax: -0.55, raz: 1.3, llx: 0, rlx: 0, lean: 0.1, bob: -0.04, headx: 0.1 },
      sweepGo:   { lax: -0.2, laz: -0.7, rax: -1.25, raz: -0.7, llx: 0, rlx: 0, lean: 0.22, bob: -0.06, headx: 0.2 },
      roar:      { lax: -0.5, laz: -1.35, rax: -0.5, raz: 1.35, llx: 0, rlx: 0, lean: -0.3, bob: 0.03, headx: -0.55 },
      crouch:    { lax: -0.35, laz: -0.5, rax: -0.35, raz: 0.5, llx: 0, rlx: 0, lean: 0.55, bob: -0.42, headx: 0.5 },
      dying:     { lax: -0.9, laz: -1.5, rax: -0.9, raz: 1.5, llx: 0, rlx: 0, lean: -0.42, bob: -0.02, headx: -0.7 }
    };
    var boss = null;
    function buildBoss(hp) {
      var b = { g: new THREE.Group(), rig: new THREE.Group(), x: 0, z: 0, yaw: 0, hp: hp, max: hp, cur: {}, tgt: {}, rate: 5, pose: 'guard', walkT: 0, walking: 0, flinch: 0, flashT: 0 };
      b.g.add(b.rig); b.rig.scale.set(S, S, S);
      function lam(c, em) { var m = new THREE.MeshLambertMaterial({ color: c }); if (em !== undefined) m.emissive = new THREE.Color(em); return m; }
      var robe = lam(0x1b1726, 0x07060c), robe2 = lam(0x2c2540, 0x0b0912), crimson = lam(0x9a1224, 0x3a040c), gold = lam(0xd9a520, 0x6b4a08), skin = lam(0xb8b2a0, 0x14120e);
      var beard = lam(0xd9d6cc, 0x1a1a18), dark = lam(0x050507), penRed = lam(0xd21f2f, 0x6a000a), steel = lam(0xc8ccd6, 0x222428);
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });
      function box(w, h, d, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; (parent || b.rig).add(m); return m; }
      function pivot(x, y, z, parent) { var p = new THREE.Group(); p.position.set(x, y, z); (parent || b.rig).add(p); return p; }
      // legs (pivot at the hip) and boots
      b.ll = pivot(-0.27, 0.95, 0); b.rl = pivot(0.27, 0.95, 0);
      [b.ll, b.rl].forEach(function (leg) { box(0.36, 0.75, 0.4, robe2, 0, -0.38, 0, leg); box(0.42, 0.26, 0.66, dark, 0, -0.82, 0.1, leg); });
      // robes
      box(1.12, 0.62, 0.74, robe, 0, 0.98, 0); box(1.16, 0.07, 0.78, crimson, 0, 0.7, 0);
      box(1.0, 0.9, 0.58, robe, 0, 1.62, 0);
      [-1, 1].forEach(function (sd) { box(0.16, 0.86, 0.04, crimson, sd * 0.36, 1.62, 0.305); box(0.18, 0.1, 0.05, gold, sd * 0.36, 1.22, 0.31); });
      box(0.9, 0.36, 0.3, crimson, 0, 2.02, -0.24);                       // the academic hood, hanging at the back
      box(0.5, 0.5, 0.06, crimson, 0, 1.6, -0.31);
      box(1.62, 0.24, 0.74, robe2, 0, 2.1, 0);                            // shoulders: the silhouette does the talking
      [-1, 1].forEach(function (sd) { box(0.08, 0.27, 0.77, gold, sd * 0.81, 2.1, 0); });
      // head: a hood, two red eyes, a long beard, a mortarboard
      b.head = pivot(0, 2.2, 0);
      box(0.72, 0.72, 0.72, robe, 0, 0.36, 0.02, b.head); box(0.5, 0.46, 0.06, dark, 0, 0.34, 0.37, b.head);
      [-1, 1].forEach(function (sd) {
        var e = box(0.13, 0.07, 0.05, eyeMat, sd * 0.13, 0.4, 0.405, b.head); e.castShadow = false;
        var br = box(0.22, 0.05, 0.05, crimson, sd * 0.13, 0.475, 0.41, b.head); br.rotation.z = sd * -0.42;
      });
      box(0.34, 0.5, 0.1, beard, 0, -0.03, 0.37, b.head); box(0.2, 0.22, 0.08, beard, 0, -0.36, 0.37, b.head);
      box(0.56, 0.16, 0.56, dark, 0, 0.78, 0, b.head);
      var board = box(1.12, 0.06, 1.12, robe2, 0, 0.88, 0, b.head); board.rotation.y = 0.18; box(0.1, 0.06, 0.1, gold, 0, 0.93, 0, b.head);
      b.tassel = pivot(0.46, 0.88, 0.5, b.head); box(0.04, 0.5, 0.04, gold, 0, -0.25, 0, b.tassel); box(0.09, 0.15, 0.09, gold, 0, -0.55, 0, b.tassel);
      // arms (pivot at the shoulder): wide sleeves, gold cuffs, pale hands
      b.la = pivot(-0.74, 2.0, 0.12); b.ra = pivot(0.74, 2.0, 0.12);
      [b.la, b.ra].forEach(function (arm) {
        box(0.3, 1.2, 0.3, robe, 0, -0.6, 0, arm); box(0.46, 0.5, 0.46, robe2, 0, -0.95, 0, arm); box(0.48, 0.07, 0.48, gold, 0, -1.2, 0, arm); box(0.26, 0.22, 0.26, skin, 0, -1.33, 0, arm);
      });
      // the giant red pen, held like a sword in the right hand
      b.pen = pivot(0, -1.33, 0.02, b.ra);
      box(0.15, 0.15, 1.9, penRed, 0, 0, 0.55, b.pen); box(0.17, 0.17, 0.3, gold, 0, 0, -0.42, b.pen); box(0.04, 0.05, 0.7, gold, 0, 0.1, -0.05, b.pen);
      box(0.11, 0.11, 0.22, steel, 0, 0, 1.6, b.pen);
      b.nibMat = new THREE.MeshBasicMaterial({ color: 0xff5a4a, fog: false });
      b.penTip = box(0.06, 0.06, 0.18, b.nibMat, 0, 0, 1.79, b.pen); b.penTip.castShadow = false;
      // the H-INDEX badge: the only thing that matters
      b.badge = pivot(0, 1.62, 0.3);
      box(0.52, 0.52, 0.06, gold, 0, 0, 0.01, b.badge);
      b.faceCv = document.createElement('canvas'); b.faceCv.width = b.faceCv.height = 128;
      b.faceTex = new THREE.CanvasTexture(b.faceCv); b.faceTex.magFilter = THREE.NearestFilter;
      b.faceMat = new THREE.MeshBasicMaterial({ map: b.faceTex, fog: false });
      b.face = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), b.faceMat); b.face.position.set(0, 0, 0.045); b.badge.add(b.face);
      var hc = document.createElement('canvas'); hc.width = hc.height = 64; var hx = hc.getContext('2d'), gr = hx.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,220,120,1)'); gr.addColorStop(0.4, 'rgba(255,120,40,0.45)'); gr.addColorStop(1, 'rgba(255,60,20,0)'); hx.fillStyle = gr; hx.fillRect(0, 0, 64, 64);
      b.haloTex = new THREE.CanvasTexture(hc);
      b.haloMat = new THREE.MeshBasicMaterial({ map: b.haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 });
      b.halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), b.haloMat); b.halo.position.set(0, 0, -0.004); b.badge.add(b.halo);
      for (var k in POSES.guard) { b.cur[k] = POSES.guard[k]; b.tgt[k] = POSES.guard[k]; }
      drawBadge(b, hp, false);
      return b;
    }
    function drawBadge(b, n, flash) {
      var x = b.faceCv.getContext('2d');
      x.fillStyle = flash ? '#fff6d8' : '#2a0508'; x.fillRect(0, 0, 128, 128);
      x.strokeStyle = '#fcd34d'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = flash ? '#7a0d16' : '#fcd34d'; x.font = '13px ' + FONT; x.fillText('H-INDEX', 65, 28);
      x.fillStyle = flash ? '#300' : '#fff'; x.font = (n >= 100 ? 32 : 46) + 'px ' + FONT; x.fillText(String(n), 66, 80);
      b.faceTex.needsUpdate = true;
    }
    function setPose(name, rate) { if (!boss) return; boss.pose = name; boss.rate = rate || 5; var p = POSES[name]; for (var k in p) boss.tgt[k] = p[k]; }
    function applyPose(h, t) {
      var b = boss, c = b.cur, k = 1 - Math.exp(-b.rate * h);
      for (var n in c) c[n] += (b.tgt[n] - c[n]) * k;
      var sw = b.walking > 0.05 ? Math.sin(b.walkT) * 0.5 * b.walking : 0;
      b.la.rotation.set(c.lax, 0, c.laz); b.ra.rotation.set(c.rax, 0, c.raz);
      b.ll.rotation.x = c.llx + sw; b.rl.rotation.x = c.rlx - sw;
      var breathe = Math.sin(t * (b.pose === 'open' ? 5 : 1.6)) * (b.pose === 'open' ? 0.012 : 0.006);
      b.rig.rotation.x = c.lean + breathe * 2 - b.flinch * 0.12; b.rig.rotation.z = b.walking * Math.sin(b.walkT) * 0.035;
      b.rig.position.y = (c.bob + breathe - Math.abs(Math.cos(b.walkT)) * 0.03 * b.walking) * S;
      b.head.rotation.x = c.headx; b.tassel.rotation.z = Math.sin(t * 2.3) * 0.25 + b.rig.rotation.z * 4; b.tassel.rotation.x = Math.cos(t * 1.7) * 0.15 - c.headx;
      if (b.flinch > 0) b.flinch = Math.max(0, b.flinch - h * 3);
      b.g.position.x = b.x; b.g.position.z = b.z; b.g.rotation.y = b.yaw;
    }
    function disposeTree(o) {
      o.traverse(function (m) {
        if (m.geometry && m.geometry.dispose) m.geometry.dispose();
        if (m.material) { if (m.material.map && m.material.map.dispose) m.material.map.dispose(); if (m.material.dispose) m.material.dispose(); }
      });
    }
    function removeBoss() {
      if (!boss) return;
      if (boss.g.parent) boss.g.parent.remove(boss.g);
      disposeTree(boss.g);
      var i = api.colliders.indexOf(bossCol); if (i >= 0) api.colliders.splice(i, 1);
      boss = null;
    }
    var bossCol = { x: 0, z: 0, r: COL_R };
    function setBossCollider(on) {
      var i = api.colliders.indexOf(bossCol);
      if (on && i < 0) api.colliders.push(bossCol); else if (!on && i >= 0) api.colliders.splice(i, 1);
    }
