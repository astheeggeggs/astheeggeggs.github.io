/* =============================================================================
   QUEST.JS — "Palmer's Progress", a 64-bit adventure in the N64 sense.
   Three.js third-person world. WASD / arrows to run, Space to jump, F to talk,
   drag to orbit the camera, Esc closes a sign. Touch pad on mobile.
   The longer you play, the less pleasant it gets. That is intentional.
   ============================================================================= */
(function () {
  'use strict';
  var root = document.getElementById('quest');
  if (!root || typeof THREE === 'undefined') return;

  var view = root.querySelector('.q-view');
  var hudFound = root.querySelector('[data-hud="found"]');
  var hudTotal = root.querySelector('[data-hud="total"]');
  var dlg = root.querySelector('.q-dialog');
  var dlgTitle = dlg.querySelector('.q-dialog__title');
  var dlgBody = dlg.querySelector('.q-dialog__body');
  var dlgLink = dlg.querySelector('.q-dialog__link');
  var dlgHint = dlg.querySelector('.q-dialog__hint');
  var start = root.querySelector('.q-start');
  var prompt = root.querySelector('.q-prompt');
  var toast = root.querySelector('.q-toast');

  /* ------------------------------------------------------------ content */
  var PLACES = [
    { id: 'warwick', short: 'WARWICK', x: -34, z: -18, w: 9, d: 7, h: 5, wall: 0xb8503f, roof: 0x7a2e24,
      title: 'Warwick, ca. the beginning',
      text: 'An integrated master’s in Mathematics and Statistics at the University of Warwick. Learned that the interesting part of a model is the bit that’s wrong.' },
    { id: 'stats', short: 'STATS DEPT', x: -12, z: -22, w: 11, d: 8, h: 6, wall: 0xd9c39a, roof: 0x6b5a3c,
      title: 'DPhil in Statistics, Oxford',
      text: 'Supervised by Dame Angela McLean and Gil McVean. Built Bayesian models of how HIV-1 escapes the immune system and reverts, within and between hosts, then scaled them to enormous sequence databases.',
      link: { href: 'https://doi.org/10.1038/s41467-019-10724-w', label: 'Nature Communications, 2019' } },
    { id: 'boston', short: 'BROAD / MGH', x: 12, z: -24, w: 13, d: 9, h: 9, wall: 0x5c6b85, roof: 0x2f3a4f,
      title: 'Postdoc, Boston',
      text: 'With Ben Neale and Nick Patterson at the Analytic and Translational Genetics Unit and the Broad Institute. Led the bipolar disorder exome study that named AKAP11, and scanned the whole UK Biobank for genetic dominance.',
      link: { href: 'https://doi.org/10.1038/s41588-022-01034-x', label: 'AKAP11 paper, Nature Genetics' } },
    { id: 'bdi', short: 'BIG DATA INST.', x: 36, z: -20, w: 12, d: 8, h: 7, wall: 0x7fb7c9, roof: 0x2b5c6b,
      title: 'Big Data Institute, now',
      text: 'SMARTbiomed Senior Research Fellow, jointly at the BDI and the Department of Statistics. Co-lead of the (gen)omics theme. Previously a postdoc here with Cecilia Lindgren on infertility, adiposity and compound heterozygosity.',
      link: { href: 'https://www.stats.ox.ac.uk/people/dr-duncan-palmer', label: 'Oxford profile' } },
    { id: 'brava', short: 'BRaVa HQ', x: -30, z: 16, w: 12, d: 8, h: 8, wall: 0xa78bfa, roof: 0x4c3a8f,
      title: 'Biobank Rare-Variant Consortium',
      text: 'Co-lead of BRaVa: sixteen biobanks and cohorts, over 1.2 million sequenced people, one shared protocol. A third of the gene-level hits are invisible in any single biobank. That is the whole point.',
      link: { href: 'https://brava-genetics.github.io/BRaVa/', label: 'brava-genetics.github.io' } },
    { id: 'library', short: 'LIBRARY', x: -6, z: 20, w: 11, d: 9, h: 7, wall: 0xc99a6b, roof: 0x5a3a22,
      title: 'The Library',
      text: 'Papers in Nature, Science, Cell, Nature Genetics and friends. Thirty-eight of them are shelved here, filterable by theme. Google Scholar keeps the rest, and the citation count.',
      link: { href: '/publications/', label: 'Browse the publications', internal: true } },
    { id: 'server', short: 'SERVER ROOM', x: 18, z: 20, w: 9, d: 8, h: 6, wall: 0x3b4252, roof: 0x1f2430,
      title: 'Server Room',
      text: 'The BRaVa pipelines, UKBB_ldsc, a PHESANT fork and mcqueen, the HIV code. It hums. Somewhere a Hail job is still running.',
      link: { href: '/code/', label: 'See the code', internal: true } },
    { id: 'post', short: 'POST OFFICE', x: 36, z: 18, w: 8, d: 6, h: 5, wall: 0xe3625b, roof: 0x8f2f2a,
      title: 'Post Office',
      text: 'Letters reach Duncan at duncan.palmer@stats.ox.ac.uk. Students, postdocs and collaborators especially welcome.',
      link: { href: 'mailto:duncan.palmer@stats.ox.ac.uk', label: 'Send an email' } }
  ];
  var NPCS = [
    { x: 4, z: -4, color: 0xfb7185, title: 'Reviewer 2', voice: { base: 150, wave: 'sawtooth', spread: 0.3 },
      text: '"Interesting, but have the authors considered that the h-index is 28 and citations are around 15,800? Also please cite my paper."' },
    { x: -18, z: 2, color: 0x34d399, title: 'A lost postdoc', voice: { base: 430, wave: 'square', spread: 0.45 },
      text: '"Is this the way to the Big Data Institute? I have a Hail job that has been running since 2021."' },
    { x: 44, z: -8, color: 0x1f2430, tie: 0xfcd34d, title: 'Research Finance', voice: { base: 105, wave: 'sawtooth', spread: 0.18 },
      text: '"All your grant money are belong to us. Please complete form FIN-7b in triplicate to request your own overheads back."' }
  ];
  // Baddies: peer reviewers. They roam, they chase, they demand corrections.
  var DEMANDS = [
    'Reviewer 1: "The authors should repeat the entire analysis in a second, unrelated cohort."',
    'Reviewer 2: "Minor comment: please rewrite sections 2 through 6."',
    'Reviewer 3: "I am not convinced. Please add 40 supplementary figures."',
    'Reviewer 2: "Have the authors considered a completely different study design?"',
    'Reviewer 4: "This is out of scope. Also, cite my paper. Twice."',
    'Reviewer 1: "The p-value on page 12 has too many decimal places."',
    'Reviewer 3: "Please provide the raw data, the code, and a blood sample."',
    'Editor: "We have secured a fifth reviewer. They have concerns."'
  ];
  var BADDIES = [
    { x: -20, z: -6 }, { x: 22, z: -4 }, { x: -14, z: 30 }, { x: 30, z: 30 }, { x: 8, z: 12 }, { x: -44, z: 4 }
  ];

  /* ------------------------------------------------------------ rng */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var rnd = mulberry32(20130696);

  /* ------------------------------------------------------------ scene */
  var WORLD = 52;                                   // half-extent
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec9ff);
  scene.fog = new THREE.Fog(0x8ec9ff, 55, 120);

  var camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 300);
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('tabindex', '0');
  view.appendChild(renderer.domElement);

  var RETRO = 0.9;                                   // render scale: N64 chic
  function resize() {
    var w = view.clientWidth, h = view.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * RETRO);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  var hemi = new THREE.HemisphereLight(0xbfe4ff, 0x3a7a3a, 0.85); scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
  sun.position.set(40, 60, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 160; sun.shadow.bias = -0.0015;
  scene.add(sun);

  var flat = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
  var dread = parseFloat((location.search.match(/[?&]dread=([\d.]+)/) || [0, 0])[1]) || 0, DREAD_TIME = 90 / 0.7, FP_AT = 0.7;      // seconds of play until the world is fully wrong
  var DAY = { sky: new THREE.Color(0x8ec9ff), hemiSky: new THREE.Color(0xbfe4ff), hemiGround: new THREE.Color(0x3a7a3a), sun: new THREE.Color(0xfff2d0) };
  var DUSK = { sky: new THREE.Color(0x2a0a1e), hemiSky: new THREE.Color(0x5a1a2a), hemiGround: new THREE.Color(0x140a0a), sun: new THREE.Color(0xff3b2a) };
  var fading = [];   // { mat, from, to }
  function fade(mat, to) { fading.push({ mat: mat, from: mat.color.clone(), to: new THREE.Color(to) }); return mat; }

  // ground
  var groundGeo = new THREE.PlaneGeometry(WORLD * 2 + 40, WORLD * 2 + 40, 140, 140);
  (function () {
    var pos = groundGeo.attributes.position, col = [];
    for (var i = 0; i < pos.count; i++) {
      var gx = pos.getX(i), gz = -pos.getY(i);
      var edge = Math.max(0, Math.max(Math.abs(gx), Math.abs(gz)) - WORLD + 2) / 14;   // only rise near the border
      var h = edge * (2 + Math.sin(gx * 0.21) * Math.cos(gz * 0.17) * 1.5) * edge;
      pos.setZ(i, h);
      var v = 0.9 + Math.sin(gx * 0.9) * Math.cos(gz * 0.7) * 0.06;
      col.push(0.25 * v, 0.6 * v, 0.36 * v);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    groundGeo.computeVertexNormals();
  })();
  var groundMat = fade(new THREE.MeshLambertMaterial({ vertexColors: true }), 0x6a3a44);
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // patchy grass
  for (var i = 0; i < 90; i++) {
    var g = new THREE.Mesh(new THREE.CircleGeometry(2 + rnd() * 5, 7), flat(rnd() < 0.5 ? 0x3a8f54 : 0x47a664));
    g.rotation.x = -Math.PI / 2; g.position.set((rnd() * 2 - 1) * WORLD, 0.01, (rnd() * 2 - 1) * WORLD); g.receiveShadow = true; scene.add(g);
  }

  // roads
  function road(x, z, w, d) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), flat(0xcbb47e));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true; scene.add(m);
  }
  road(0, -10, 90, 4); road(0, 10, 90, 4); road(0, 0, 4, 24); road(-40, 0, 4, 24); road(40, 0, 4, 24);
  function kerb(x, z, w, d) { var k = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), flat(0xb8b09a)); k.position.set(x, 0.06, z); k.receiveShadow = true; k.castShadow = true; scene.add(k); }
  [-12.2, -7.8, 7.8, 12.2].forEach(function (z) { kerb(0, z, 90, 0.35); });
  var bushGeo = new THREE.IcosahedronGeometry(0.7, 2), bushMat = fade(flat(0x2f8f4e), 0x2a1a10);

  // lake
  var lakeMat = fade(new THREE.MeshLambertMaterial({ color: 0x3c86e6, transparent: true, opacity: 0.9 }), 0x4a0a14);
  var lake = new THREE.Mesh(new THREE.CircleGeometry(9, 12), lakeMat);
  lake.rotation.x = -Math.PI / 2; lake.position.set(0, 0.03, 40); scene.add(lake);
  var sand = new THREE.Mesh(new THREE.RingGeometry(9, 11, 12), flat(0xe5d59a));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.015, 40); sand.receiveShadow = true; scene.add(sand);

  var colliders = [];  // {x,z,hw,hd} axis-aligned boxes, or {x,z,r}
  colliders.push({ x: 0, z: 40, r: 11 });

  // hills at the border
  for (i = 0; i < 40; i++) {
    var a = (i / 40) * Math.PI * 2, R = WORLD + 12 + rnd() * 8;
    var hill = new THREE.Mesh(new THREE.IcosahedronGeometry(9 + rnd() * 9, 2), flat(rnd() < .5 ? 0x2f7d4a : 0x35895a));
    hill.scale.y = 0.6 + rnd() * 0.6; hill.position.set(Math.cos(a) * R, -2, Math.sin(a) * R); hill.castShadow = true; scene.add(hill);
  }

  // trees
  var trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 1.6, 10);
  var pineGeo = [new THREE.ConeGeometry(1.7, 2.2, 12), new THREE.ConeGeometry(1.35, 1.9, 12), new THREE.ConeGeometry(0.95, 1.6, 12)];
  var puffGeo = new THREE.IcosahedronGeometry(1, 2);
  var trunkMat = flat(0x5a3a22), leafMats = [fade(flat(0x1f5e34), 0x2a1a12), fade(flat(0x2a7a44), 0x3a2416), fade(flat(0x3b9556), 0x4a2a18), fade(flat(0x4aa862), 0x3a2010)];
  function tree(x, z) {
    var t = new THREE.Group();
    var trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 0.8; trunk.castShadow = true; t.add(trunk);
    var mat = leafMats[Math.floor(rnd() * leafMats.length)];
    if (rnd() < 0.5) {
      pineGeo.forEach(function (g, k) { var leaf = new THREE.Mesh(g, mat); leaf.position.y = 2.0 + k * 1.0; leaf.castShadow = true; t.add(leaf); });
    } else {
      for (var k = 0; k < 5; k++) {
        var puff = new THREE.Mesh(puffGeo, k ? mat : leafMats[(leafMats.indexOf(mat) + 1) % leafMats.length]);
        var r = k ? 0.75 + rnd() * 0.45 : 1.25;
        puff.scale.set(r, r * 0.85, r); puff.position.set(k ? (rnd() - .5) * 1.6 : 0, 2.6 + (k ? (rnd() - .5) * 0.8 : 0.2), k ? (rnd() - .5) * 1.6 : 0);
        puff.castShadow = true; t.add(puff);
      }
    }
    var s = 0.8 + rnd() * 0.7; t.scale.set(s, s, s);
    t.position.set(x, 0, z); t.rotation.y = rnd() * 6.28; scene.add(t);
    colliders.push({ x: x, z: z, r: 0.6 * s });
  }
  function blocked(x, z, pad) {
    if (Math.abs(x) < 3 && Math.abs(z) < 14) return true;
    if (Math.abs(z + 10) < 3 || Math.abs(z - 10) < 3) return true;
    if (Math.abs(Math.abs(x) - 40) < 3 && Math.abs(z) < 14) return true;
    if (Math.hypot(x, z - 40) < 13) return true;
    for (var k = 0; k < PLACES.length; k++) { var p = PLACES[k]; if (Math.abs(x - p.x) < p.w / 2 + pad && Math.abs(z - p.z) < p.d / 2 + pad + 3) return true; }
    for (k = 0; k < NPCS.length; k++) if (Math.hypot(x - NPCS[k].x, z - NPCS[k].z) < 3) return true;
    if (Math.hypot(x, z) < 5) return true;
    return false;
  }
  for (i = 0; i < 170; i++) {
    var tx = (rnd() * 2 - 1) * WORLD, tz = (rnd() * 2 - 1) * WORLD;
    if (!blocked(tx, tz, 2.5)) tree(tx, tz);
  }
  // flowers
  var flowerGeo = new THREE.SphereGeometry(0.18, 8, 6), stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5);
  var flowerMats = [fade(flat(0xf5e663), 0x3a2a10), fade(flat(0xf78fb3), 0x3a1018), fade(flat(0xffffff), 0x2a2020), fade(flat(0x8ad4ff), 0x1a1a2a), fade(flat(0xfb7185), 0x3a0a10)];
  var stemMat = flat(0x2f7d4a);
  for (i = 0; i < 260; i++) {
    tx = (rnd() * 2 - 1) * WORLD; tz = (rnd() * 2 - 1) * WORLD;
    if (blocked(tx, tz, 1)) continue;
    var fl = new THREE.Group();
    var st = new THREE.Mesh(stemGeo, stemMat); st.position.y = 0.2; fl.add(st);
    var f = new THREE.Mesh(flowerGeo, flowerMats[i % 5]); f.position.y = 0.42; fl.add(f);
    fl.position.set(tx, 0, tz); fl.rotation.y = rnd(); scene.add(fl);
  }
  // rocks
  var rockGeo = new THREE.DodecahedronGeometry(0.6, 1), rockMat = flat(0x8b8f9a);
  for (i = 0; i < 40; i++) {
    tx = (rnd() * 2 - 1) * WORLD; tz = (rnd() * 2 - 1) * WORLD;
    if (blocked(tx, tz, 1.5)) continue;
    var rk = new THREE.Mesh(rockGeo, rockMat); var rs = 0.5 + rnd(); rk.scale.set(rs, rs * 0.6, rs); rk.position.set(tx, 0.1, tz); rk.rotation.set(rnd(), rnd(), rnd()); rk.castShadow = true; scene.add(rk);
    colliders.push({ x: tx, z: tz, r: 0.6 * rs });
  }
  // lamp posts along the roads
  var postGeo = new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8), lampGeo = new THREE.SphereGeometry(0.28, 12, 10);
  var postMat = flat(0x2b303c), lampMat = new THREE.MeshLambertMaterial({ color: 0xfff1b0, emissive: 0xffd77a, emissiveIntensity: 0.8 });
  var lampEm0 = lampMat.emissive.clone(), lampEm1 = new THREE.Color(0xff2a1a);
  function lamp(x, z) {
    var g = new THREE.Group();
    var po = new THREE.Mesh(postGeo, postMat); po.position.y = 1.6; po.castShadow = true; g.add(po);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), postMat); arm.position.set(0.3, 3.1, 0); g.add(arm);
    var la = new THREE.Mesh(lampGeo, lampMat); la.position.set(0.62, 3.0, 0); g.add(la);
    g.position.set(x, 0, z); scene.add(g); colliders.push({ x: x, z: z, r: 0.25 });
  }
  for (i = -36; i <= 36; i += 12) { lamp(i, -13); lamp(i, 13); }
  // benches
  var benchSeat = new THREE.BoxGeometry(1.8, 0.1, 0.5), benchLeg = new THREE.BoxGeometry(0.1, 0.45, 0.45), woodMat = flat(0x8a5a2b);
  function bench(x, z, rot) {
    var g = new THREE.Group();
    var seat = new THREE.Mesh(benchSeat, woodMat); seat.position.y = 0.5; seat.castShadow = true; g.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), woodMat); back.position.set(0, 0.78, -0.22); g.add(back);
    [-0.8, 0.8].forEach(function (lx) { var l = new THREE.Mesh(benchLeg, postMat); l.position.set(lx, 0.25, 0); g.add(l); });
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); colliders.push({ x: x, z: z, r: 0.9 });
  }
  bench(-6, -7, 0); bench(6, -7, 0); bench(-6, 7, Math.PI); bench(6, 7, Math.PI);
  // fountain at the crossroads
  var fountain = { group: new THREE.Group(), collider: { x: 0, z: 0, r: 3.0 } };
  scene.add(fountain.group);
  (function () {
    var scene = fountain.group;   // everything below lands in the group, so the whole fountain can be removed at once
    var basin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.6, 24), flat(0xb8bcc8)); basin.position.set(0, 0.3, 0); basin.castShadow = true; basin.receiveShadow = true; scene.add(basin);
    var water = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 24), new THREE.MeshLambertMaterial({ color: 0x4a9be8, transparent: true, opacity: 0.85 })); water.position.set(0, 0.62, 0); scene.add(water);
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.6, 12), flat(0xb8bcc8)); col.position.set(0, 1.2, 0); col.castShadow = true; scene.add(col);
    var top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), flat(0xd6dae6)); top.position.set(0, 2.1, 0); top.castShadow = true; scene.add(top);
    var drops = new THREE.Group();
    for (var k = 0; k < 14; k++) { var d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshLambertMaterial({ color: 0x9fd0ff })); d.userData.k = k; drops.add(d); }
    scene.add(drops); window.__fountain = drops;
    colliders.push(fountain.collider);
  })();
  // clouds
  var cloudMat = fade(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), 0x2a1018), clouds = [];
  for (i = 0; i < 14; i++) {
    var cg = new THREE.Group();
    for (var k = 0; k < 5; k++) { var cp = new THREE.Mesh(new THREE.SphereGeometry(2 + rnd() * 2.5, 10, 8), cloudMat); cp.position.set((rnd() - .5) * 8, (rnd() - .5) * 1.5, (rnd() - .5) * 4); cg.add(cp); }
    cg.position.set((rnd() * 2 - 1) * 90, 28 + rnd() * 10, (rnd() * 2 - 1) * 90); cg.userData.v = 0.4 + rnd() * 0.6; scene.add(cg); clouds.push(cg);
  }

  /* ------------------------------------------------------------ signs */
  function labelSprite(text, bg, fg) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 96;
    var x = c.getContext('2d');
    x.fillStyle = '#1a1d26'; x.fillRect(0, 0, 512, 96);
    x.fillStyle = bg; x.fillRect(6, 6, 500, 84);
    x.fillStyle = fg; x.font = 'bold 40px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 52);
    var tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
    sp.scale.set(8, 1.5, 1);
    return sp;
  }

  /* ------------------------------------------------------------ buildings */
  var markers = [], winMats = [];
  PLACES.forEach(function (p) {
    var grp = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), flat(p.wall));
    body.position.y = p.h / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(p.w, p.d) * 0.78, p.h * 0.45, 4), flat(p.roof));
    roof.position.y = p.h + p.h * 0.225; roof.rotation.y = Math.PI / 4; roof.castShadow = true; grp.add(roof);
    var eave = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.8, 0.25, p.d + 0.8), flat(p.roof)); eave.position.y = p.h + 0.1; eave.castShadow = true; grp.add(eave);
    var chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), flat(0x6b5a4a)); chimney.position.set(p.w * 0.3, p.h + 1.0, -p.d * 0.2); chimney.castShadow = true; grp.add(chimney);
    // plinth and steps
    var plinth = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.6, 0.3, p.d + 0.6), flat(0x9aa0ad)); plinth.position.y = 0.15; plinth.receiveShadow = true; grp.add(plinth);
    var steps = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 1.2), flat(0xb8bcc8)); steps.position.set(0, 0.1, p.d / 2 + 0.8); steps.receiveShadow = true; grp.add(steps);
    // door with frame, on the +z face
    var frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.7, 0.35), flat(0xf4f6fb)); frame.position.set(0, 1.35, p.d / 2 + 0.05); grp.add(frame);
    var door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.3), flat(0x1a1d26)); door.position.set(0, 1.2, p.d / 2 + 0.12); grp.add(door);
    var knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), flat(0xfcd34d)); knob.position.set(0.55, 1.2, p.d / 2 + 0.3); grp.add(knob);
    // windows
    var winMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd77a, emissiveIntensity: 0.5 }); winMats.push(winMat);
    for (var wx = -p.w / 2 + 1.5; wx <= p.w / 2 - 1.5; wx += 2.2) {
      if (Math.abs(wx) < 1.6) continue;
      for (var wy = 1.8; wy < p.h - 1; wy += 2.4) {
        var wf = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.45, 0.14), flat(0xf4f6fb)); wf.position.set(wx, wy, p.d / 2 + 0.04); grp.add(wf);
        var win = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.2), winMat); win.position.set(wx, wy, p.d / 2 + 0.05); grp.add(win);
        var bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.05), flat(0x2b303c)); bar1.position.set(wx, wy, p.d / 2 + 0.18); grp.add(bar1);
        var sill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.3), flat(0xd6dae6)); sill.position.set(wx, wy - 0.7, p.d / 2 + 0.12); grp.add(sill);
      }
    }
    var sign = labelSprite(p.short, '#f1d7b0', '#1a1d26'); sign.position.set(0, p.h + p.h * 0.45 + 1.4, 0); grp.add(sign);
    grp.position.set(p.x, 0, p.z); scene.add(grp);
    p.group = grp; p.collider = { x: p.x, z: p.z, hw: p.w / 2 + 0.4, hd: p.d / 2 + 0.4 }; p.bushes = [];
    colliders.push(p.collider);
    p.door = { x: p.x, z: p.z + p.d / 2 + 1.6 };
    [-1, 1].forEach(function (sd) { var bsh = new THREE.Mesh(bushGeo, bushMat); bsh.position.set(p.x + sd * 1.9, 0.45, p.z + p.d / 2 + 0.6); bsh.scale.set(1, 0.8, 1); bsh.castShadow = true; scene.add(bsh); p.bushes.push(bsh); });
    // marker
    var mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0xfcd34d, emissive: 0xfcd34d, emissiveIntensity: 0.5 }));
    mk.position.set(p.door.x, 3.6, p.door.z - 1.0); mk.castShadow = true; scene.add(mk);
    p.marker = mk; markers.push(mk);
  });

  /* ------------------------------------------------------------ people */
  function boxMan(o) {
    var g = new THREE.Group();
    var skin = flat(0xf6d3b0), suit = flat(o.suit || 0x6f7787), dark = flat(0x2b303c), hairM = flat(o.hair || 0xf2d16b);
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), suit); body.position.y = 1.35; body.castShadow = true; g.add(body);
    var shirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.0, 0.08), flat(0xf4f6fb)); shirt.position.set(0, 1.38, 0.27); g.add(shirt);
    var tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.05), flat(o.tie || 0xc9a1c9)); tie.position.set(0, 1.35, 0.33); g.add(tie);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skin); head.position.y = 2.35; head.castShadow = true; g.add(head);
    var hair = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.32, 0.88), hairM); hair.position.y = 2.68; g.add(hair);
    var hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.5, 0.25), hairM); hairBack.position.set(0, 2.45, -0.34); g.add(hairBack);
    if (o.glasses !== false) {
      var lens = new THREE.BoxGeometry(0.26, 0.2, 0.06), lensMat = flat(0x1f2430);
      var l1 = new THREE.Mesh(lens, lensMat); l1.position.set(-0.19, 2.36, 0.42); g.add(l1);
      var l2 = new THREE.Mesh(lens, lensMat); l2.position.set(0.19, 2.36, 0.42); g.add(l2);
      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), lensMat); bridge.position.set(0, 2.38, 0.42); g.add(bridge);
    }
    if (o.angry) {
      [-0.19, 0.19].forEach(function (ex, i) { var b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.06), flat(0x2b1a10)); b.position.set(ex, 2.5, 0.43); b.rotation.z = i ? 0.35 : -0.35; g.add(b); });
    }
    var armGeo = new THREE.BoxGeometry(0.26, 1.0, 0.26), legGeo = new THREE.BoxGeometry(0.34, 0.9, 0.34);
    var la = new THREE.Mesh(armGeo, suit), ra = new THREE.Mesh(armGeo, suit);
    la.position.set(-0.6, 1.4, 0); ra.position.set(0.6, 1.4, 0); la.castShadow = ra.castShadow = true;
    var ll = new THREE.Mesh(legGeo, dark), rl = new THREE.Mesh(legGeo, dark);
    ll.position.set(-0.22, 0.45, 0); rl.position.set(0.22, 0.45, 0); ll.castShadow = rl.castShadow = true;
    [la, ra].forEach(function (m) { m.geometry.translate(0, -0.45, 0); m.position.y += 0.45; });
    [ll, rl].forEach(function (m) { m.geometry.translate(0, -0.4, 0); m.position.y += 0.4; });
    g.add(la); g.add(ra); g.add(ll); g.add(rl);
    g.userData = { la: la, ra: ra, ll: ll, rl: rl };
    return g;
  }
  var rig = boxMan;
  function pose(char, m) {
    var u = char.userData, sp = m.speed || 0;
    if (m.air) { u.la.rotation.x = -2.4; u.ra.rotation.x = -2.4; u.ll.rotation.x = 0.5; u.rl.rotation.x = -0.4; return; }
    if (sp > 0.05) { var sw = Math.sin(m.walk) * 0.9 * Math.min(1, sp * 1.5); u.la.rotation.x = -sw; u.ra.rotation.x = sw; u.ll.rotation.x = sw; u.rl.rotation.x = -sw; }
    else { u.la.rotation.x *= 0.8; u.ra.rotation.x *= 0.8; u.ll.rotation.x *= 0.8; u.rl.rotation.x *= 0.8; }
  }
  scene.add(camera);
  var weapon = new THREE.Group(); camera.add(weapon); weapon.visible = false;
  (function () {
    var lit = function (c) { return new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.45 }); };
    var hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.3), lit(0xf6d3b0)); hand.position.set(0, -0.08, 0.05); weapon.add(hand);
    var sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.35), lit(0x6f7787)); sleeve.position.set(0, -0.12, 0.32); weapon.add(sleeve);
    var paper = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.02), lit(0xf4f6fb)); paper.position.set(0.02, 0.2, -0.1); paper.rotation.x = -0.25; weapon.add(paper);
    for (var k = 0; k < 6; k++) { var ln = new THREE.Mesh(new THREE.BoxGeometry(0.22 - (k % 2) * 0.06, 0.02, 0.005), lit(k ? 0x9aa3b8 : 0xb91c1c)); ln.position.set(0.0, 0.15 - k * 0.055, 0.013); paper.add(ln); }
    weapon.scale.set(0.42, 0.42, 0.42);
    weapon.position.set(0.3, -0.16, -0.62);
  })();
  var shotGeo = new THREE.IcosahedronGeometry(0.13, 0), shotMat = new THREE.MeshLambertMaterial({ color: 0xf4f6fb, emissive: 0xf4f6fb, emissiveIntensity: 0.5 });
  var player = boxMan({});
  player.position.set(0, 0, 4);
  scene.add(player);
  var pstate = { yaw: 0, speed: 0, walkT: 0, y: 0, vy: 0, air: false, land: 0 };

  NPCS.forEach(function (n) {
    var m = rig({ suit: n.color, hair: 0x2b303c, glasses: false, tie: n.tie || 0xffffff, spiky: false, satchel: false });
    m.position.set(n.x, 0, n.z); m.rotation.y = rnd() * 6.28; m.scale.set(0.85, 0.85, 0.85); scene.add(m);
    n.mesh = m; colliders.push({ x: n.x, z: n.z, r: 0.8 });
  });

  BADDIES.forEach(function (b, i) {
    var m = rig({ suit: 0xb91c1c, hair: 0x4a2a1a, glasses: true, tie: 0x111111, angry: true, spiky: false, satchel: false });
    m.position.set(b.x, 0, b.z); m.scale.set(0.95, 0.95, 0.95); scene.add(m);
    var badge = labelSprite('REVIEWER ' + (i + 1), '#b91c1c', '#fff'); badge.scale.set(2.2, 0.42, 1); badge.position.y = 3.3; m.add(badge);
    b.mesh = m; b.yaw = rnd() * 6.28; b.wander = 0; b.flee = 0; b.cool = 0; b.walkT = 0; b.home = { x: b.x, z: b.z }; b.hp = 2; b.down = 0;
    // navigation state (see "reviewer navigation"): smoothed heading, plan/waypoint, approach slot, zigzag, stuck detector, escape, homing
    b.head = b.yaw; b.mode = 0; b.plan = i * 0.03; b.wx = b.x; b.wz = b.z; b.chase = false; b.slot = 0; b.slotOn = false; b.fleeA = 0;
    b.side = i % 2 ? 1 : -1; b.zig = b.side; b.zigT = 0; b.aimed = 0; b.stuckT = 0; b.stuckN = 0; b.sx = b.x; b.sz = b.z; b.careful = 0; b.probe = 0;
    b.esc = 0; b.ex = b.x; b.ez = b.z; b.goHome = false; b.homeField = null; b.homeSerial = -1; b.moved = 0;
  });

  /* ------------------------------------------------------------ state */
  var found = {};
  var revisions = 0, rebuttals = 0;
  var hudRev = root.querySelector('[data-hud="revisions"]');
  try { found = JSON.parse(localStorage.getItem('quest.found') || '{}') || {}; } catch (e) { found = {}; }
  hudTotal.textContent = PLACES.length;
  function countFound() { return PLACES.filter(function (p) { return found[p.id]; }).length; }
  function updateHud() { hudFound.textContent = countFound(); PLACES.forEach(function (p) { p.marker.material.color.set(found[p.id] ? 0x34d399 : 0xfcd34d); p.marker.material.emissive.set(found[p.id] ? 0x34d399 : 0xfcd34d); }); }
  updateHud();

  var running = false, dialogOpen = false, typing = null, toastT = 0, clock = new THREE.Clock();
  var keys = {};
  var camYaw = 0, camPitch = 0.52, camDist = 14, dragging = false, lastPX = 0, lastPY = 0, dragMoved = 0;
  var fp = false, fpBlend = 0, fpPitch = 0, fireCool = 0, shots = [], accepted = 0, hits = 0, MAX_HITS = parseInt((location.search.match(/[?&]maxhits=(\d+)/) || [0, 5])[1], 10) || 5, over = false, overT = 0;
  var hurtEl = root.querySelector('.q-hurt'), overEl = root.querySelector('.q-over'), hudHits = root.querySelector('[data-hud="hits"]'), hudHitsWrap = root.querySelector('.q-hits');
  var hudAcc = root.querySelector('[data-hud="accepted"]'), cross = root.querySelector('.q-cross');
  // ---- endgame state + test hooks (?endgame=1 ?bosshp=5 ?skipintro=1 ?god=1 ?shmup=1 ?timescale=4)
  function qp(name, dflt) { var m = location.search.match(new RegExp('[?&]' + name + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : dflt; }
  var PARAMS = { endgame: qp('endgame') === '1', bossHp: parseInt(qp('bosshp', '100'), 10) || 100, skipIntro: qp('skipintro') === '1', god: qp('god') === '1', shmup: qp('shmup') === '1', timescale: Math.max(0.1, Math.min(20, parseFloat(qp('timescale', '1')) || 1)) };
  var endgame = false, pendingEndgame = false, boss = null, shmup = null;
  var fireRate = 0.32, shotSpeed = 30, shotGrav = 9, fireHeld = false, hurtCool = 0, envLocked = false, hudOn = true, shakeAmp = 0, shakeT = 0, shakeDur = 1;

  /* ------------------------------------------------------------ input */
  var KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'rotl', KeyE: 'rotr' };
  var ACT = { Enter: 1, KeyF: 1 };
  window.addEventListener('keydown', function (e) {
    if (!running || !visible || (shmup && shmup.active)) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (ACT[e.code]) { e.preventDefault(); if (!e.repeat) action(); if (fp) fireHeld = true; }
    if (e.code === 'Space') { e.preventDefault(); if (dialogOpen) action(); else jump(); }
    if (e.code === 'Escape' && dialogOpen) closeDialog();
  });
  window.addEventListener('keyup', function (e) { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; if (ACT[e.code]) fireHeld = false; });
  window.addEventListener('blur', function () { fireHeld = false; for (var k in keys) keys[k] = false; });
  function jump() { if (!running || dialogOpen || pstate.air || over || (endgame && boss && boss.active && boss.cinematic)) return; pstate.vy = 9.5; pstate.air = true; blip(520, .07); setTimeout(function () { blip(780, .06); }, 50); }

  root.querySelectorAll('[data-pad]').forEach(function (b) {
    var d = b.dataset.pad;
    function on(e) { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); if (d === 'act') { action(); if (fp) fireHeld = true; } else if (d === 'jump') jump(); else keys[d] = true; }
    function off(e) { e.preventDefault(); if (d === 'act') fireHeld = false; else if (d !== 'jump') keys[d] = false; }
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  });

  // drag to orbit
  var el = renderer.domElement;
  function locked() { return document.pointerLockElement === el; }
  el.addEventListener('pointerdown', function (e) {
    if (locked()) { if (running && !dialogOpen) { action(); fireHeld = true; } return; }
    if (fp && running && !dialogOpen && e.pointerType === 'mouse' && el.requestPointerLock) { try { el.requestPointerLock(); } catch (err) {} }
    dragging = true; dragMoved = 0; lastPX = e.clientX; lastPY = e.clientY; el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', function (e) {
    if (locked()) { camYaw -= e.movementX * 0.0025; fpPitch = Math.max(-1.2, Math.min(1.2, fpPitch - e.movementY * 0.0022)); return; }
    if (!dragging) return;
    var dx = e.clientX - lastPX, dy = e.clientY - lastPY; lastPX = e.clientX; lastPY = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
    if (fp) { camYaw -= dx * 0.005; fpPitch = Math.max(-1.2, Math.min(1.2, fpPitch - dy * 0.004)); }
    else { camYaw -= dx * 0.008; camPitch = Math.max(0.2, Math.min(1.2, camPitch + dy * 0.005)); }
  });
  el.addEventListener('pointerup', function () { fireHeld = false; if (dragging && dragMoved < 6 && running && !locked()) action(); dragging = false; });
  document.addEventListener('pointerlockchange', function () { root.classList.toggle('is-locked', locked()); });
  el.addEventListener('wheel', function (e) { if (!running) return; e.preventDefault(); camDist = Math.max(6, Math.min(24, camDist + e.deltaY * 0.01)); }, { passive: false });

  dlg.addEventListener('click', function (e) { if (e.target.tagName !== 'A') action(); });
  start.addEventListener('click', begin);
  start.addEventListener('keydown', function (e) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); begin(); } });

  function begin() {
    if (running) return;
    running = true; start.hidden = true; el.focus(); blip(440, .06);
    if (window.Riff && musicWanted) { try { Riff.play('quest'); } catch (e) {} }
    if (PARAMS.shmup) { setTimeout(launchShmup, 300); return; }
    if (PARAMS.endgame) { setTimeout(startEndgame, 300); return; }
    // a returning player who already holds every fact goes straight to the reckoning
    if (countFound() === PLACES.length) { showToast('ALL FACTS FOUND. SOMETHING IS COMING.'); setTimeout(function () { if (!endgame && !over) startEndgame(); }, 3500); }
  }
  var musicWanted = true;
  var musicBtn = root.querySelector('[data-music]');
  if (musicBtn && window.Riff) { Riff.bind(musicBtn, 'quest'); musicBtn.addEventListener('click', function () { musicWanted = Riff.playing; }); }

  /* ------------------------------------------------------------ audio */
  var AC = null;
  function blip(freq, dur, type) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.value = .035; g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + dur);
      o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
    } catch (e) {}
  }

  /* ------------------------------------------------------------ voices */
  var SIGN_VOICE = { base: 250, wave: 'triangle', spread: 0.25 }, BADDIE_VOICE = { base: 125, wave: 'sawtooth', spread: 0.5 };
  function speak(voice, ch) {
    if (!/[a-z]/i.test(ch)) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var vowel = /[aeiou]/i.test(ch), o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
      var freq = voice.base * (1 + (Math.random() - 0.5) * voice.spread) * (vowel ? 1.25 : 0.95);
      o.type = voice.wave; o.frequency.setValueAtTime(freq, AC.currentTime); o.frequency.exponentialRampToValueAtTime(freq * (vowel ? 0.8 : 1.15), AC.currentTime + 0.07);
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(vowel ? 0.38 : 0.22, AC.currentTime + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.11);
      lp.frequency.value = 2200;
      o.connect(lp); lp.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + 0.13);
    } catch (e) {}
  }

  /* ------------------------------------------------------------ dialog */
  function nearbyTarget() {
    if (endgame) return null;
    var px = player.position.x, pz = player.position.z;
    for (var i = 0; i < PLACES.length; i++) { var p = PLACES[i]; if (Math.hypot(px - p.door.x, pz - p.door.z) < 2.6) return { kind: 'place', obj: p }; }
    for (i = 0; i < NPCS.length; i++) { var n = NPCS[i]; if (Math.hypot(px - n.x, pz - n.z) < 2.4) return { kind: 'npc', obj: n }; }
    for (i = 0; i < BADDIES.length; i++) { var b = BADDIES[i]; if (b.flee <= 0 && b.down <= 0 && Math.hypot(px - b.mesh.position.x, pz - b.mesh.position.z) < 3.2) return { kind: 'baddie', obj: b }; }
    return null;
  }
  function openDialog(target) {
    var o = target.obj; if (noticeT) { clearTimeout(noticeT); noticeT = null; }
    dialogOpen = true; dlg.hidden = false;
    dlgTitle.textContent = o.title; dlgBody.textContent = ''; dlgLink.hidden = true; dlgHint.textContent = '';
    if (o.link) {
      dlgLink.href = o.link.href; dlgLink.textContent = o.link.label + ' →';
      if (!o.link.internal && o.link.href.indexOf('mailto:') !== 0) { dlgLink.target = '_blank'; dlgLink.rel = 'noopener'; }
      else { dlgLink.removeAttribute('target'); dlgLink.removeAttribute('rel'); }
    }
    var text = o.text, i = 0, voice = o.voice || (target.kind === 'place' ? SIGN_VOICE : BADDIE_VOICE); blip(660, .05);
    typing = setInterval(function () {
      i += 1; dlgBody.textContent = text.slice(0, i);
      if (i % 2 === 0) speak(voice, text[i - 1] || '');
      if (i >= text.length) finishTyping(o);
    }, 28);
    if (target.kind === 'npc' && o.mesh) { o.mesh.lookAt(player.position.x, 0, player.position.z); }
    if (target.kind === 'place' && !found[o.id]) {
      found[o.id] = true;
      try { localStorage.setItem('quest.found', JSON.stringify(found)); } catch (e) {}
      updateHud(); showToast('FACT FOUND  ' + countFound() + '/' + PLACES.length);
      if (countFound() === PLACES.length) pendingEndgame = true;
    }
  }
  function finishTyping(o) {
    if (typing) { clearInterval(typing); typing = null; }
    dlgBody.textContent = o.text; if (o.link) dlgLink.hidden = false;
    dlgHint.textContent = 'F / SPACE / TAP TO CLOSE';
  }
  var current = null;
  var noticeT = null;
  function notice(o) {
    // same box, but it does not stop you: types out, then clears itself
    if (typing) { clearInterval(typing); typing = null; }
    if (noticeT) { clearTimeout(noticeT); noticeT = null; }
    dialogOpen = false; dlg.hidden = false; dlgTitle.textContent = o.title; dlgBody.textContent = ''; dlgLink.hidden = true; dlgHint.textContent = '';
    var text = o.text, i = 0;
    typing = setInterval(function () {
      i += 1; dlgBody.textContent = text.slice(0, i);
      if (i % 2 === 0) speak(o.voice || BADDIE_VOICE, text[i - 1] || '');
      if (i >= text.length) { clearInterval(typing); typing = null; noticeT = setTimeout(function () { if (!dialogOpen) dlg.hidden = true; }, 2600); }
    }, 24);
  }
  function closeDialog() { dialogOpen = false; dlg.hidden = true; if (typing) { clearInterval(typing); typing = null; } blip(330, .05); if (pendingEndgame && !endgame) { pendingEndgame = false; startEndgame(); } }
  function action() {
    if (!running) { begin(); return; }
    if (dialogOpen) { if (typing && current) finishTyping(current); else closeDialog(); return; }
    var t = nearbyTarget();
    if (fp) { if (t && t.kind !== 'baddie') { current = t.obj; openDialog(t); } else fire(); return; }
    if (t && t.kind === 'baddie') { rebut(t.obj); return; }
    if (t) { current = t.obj; openDialog(t); }
  }
  /* ------------------------------------------------------------ first person + rebuttal fire */
  var fwd = new THREE.Vector3();
  function viewDir() { return fwd.set(-Math.sin(camYaw) * Math.cos(fpPitch), Math.sin(fpPitch), -Math.cos(camYaw) * Math.cos(fpPitch)); }
  function enterFP() {
    fp = true; fpPitch = 0; camYaw = pstate.yaw + Math.PI;   // look where he was facing
    if (cross) cross.hidden = false;
    showToast('FIRST PERSON. RETURN FIRE.'); blip(220, .3, 'sawtooth'); setTimeout(function () { blip(440, .2); }, 200);
    if (window.Riff) Riff.takeover(true);
    hits = 0; if (hudHitsWrap) hudHitsWrap.hidden = false; drawHearts();
    if (prompt) prompt.textContent = 'F';
  }
  function fire() {
    if (!fp || dialogOpen || fireCool > 0 || over || !hudOn) return;
    fireCool = fireRate; weapon.userData.recoil = 1;
    var d = viewDir().clone(), m = new THREE.Mesh(shotGeo, shotMat);
    m.position.copy(camera.position).add(d.clone().multiplyScalar(0.9)).add(new THREE.Vector3(0.15, -0.15, 0));
    m.castShadow = true; scene.add(m);
    shots.push({ m: m, v: d.multiplyScalar(shotSpeed), life: 2.2, spin: Math.random() * 6, prev: m.position.clone() });
    blip(1200, .04, 'triangle'); blip(300, .08, 'sawtooth');
  }
  function shotHit(b) {
    b.hp--; b.flee = 3; b.cool = 1.5;
    var m = b.mesh;
    if (b.hp <= 0) {
      accepted++; if (hudAcc) hudAcc.textContent = accepted;
      showToast(['ACCEPTED WITHOUT CHANGES', 'REVIEWER ' + (BADDIES.indexOf(b) + 1) + ' WITHDRAWS', 'WE THANK THE REVIEWER', 'EDITOR: "PROCEED TO PRODUCTION"'][accepted & 3]);
      b.down = 22; b.hp = 2; m.visible = false; blip(523, .1); setTimeout(function () { blip(784, .18); }, 100);
    } else { showToast('REVIEWER ' + (BADDIES.indexOf(b) + 1) + ': "I REMAIN UNCONVINCED"'); blip(660, .08); }
  }
  function updateShots(dt) {
    for (var i = shots.length - 1; i >= 0; i--) {
      var sh = shots[i], m = sh.m;
      sh.prev.copy(m.position);
      sh.v.y -= shotGrav * dt; m.position.addScaledVector(sh.v, dt); m.rotation.x += dt * 12; m.rotation.z += dt * 9; sh.life -= dt;
      var gone = false;
      if (boss && boss.active) { try { if (boss.hitTest(m.position, sh.prev)) gone = true; } catch (err) { console.error(err); } }   // the boss module applies its own damage and feedback
      gone = gone || sh.life <= 0 || m.position.y < 0.05 || collide(m.position.x, m.position.z, 0.05);
      if (!gone) {
        for (var k = 0; k < BADDIES.length; k++) { var b = BADDIES[k]; if (b.down > 0) continue; var bp = b.mesh.position; if (Math.hypot(m.position.x - bp.x, m.position.z - bp.z) < 1.0 && m.position.y > 0 && m.position.y < 3.2) { shotHit(b); gone = true; break; } }
        if (!gone) for (k = 0; k < NPCS.length; k++) { var n = NPCS[k]; if (Math.hypot(m.position.x - n.x, m.position.z - n.z) < 1.0 && m.position.y < 3.2) { showToast('THAT WAS A COLLEAGUE'); blip(200, .1); gone = true; break; } }
      }
      if (gone) { scene.remove(m); shots.splice(i, 1); }
    }
    if (fireCool > 0) fireCool -= dt;
    // weapon bob + recoil
    var r = weapon.userData.recoil || 0; if (r > 0) weapon.userData.recoil = r = Math.max(0, r - dt * 5);
    weapon.position.set(0.3 + Math.sin(pstate.walkT) * 0.02 * Math.min(1, pstate.speed / 9), -0.16 + Math.abs(Math.cos(pstate.walkT)) * 0.025 * Math.min(1, pstate.speed / 9) + r * 0.07, -0.62 + r * 0.15);
    weapon.rotation.x = -r * 0.6;
  }
  function rebut(b) {
    b.flee = 7; b.cool = 2; rebuttals++;
    showToast(['REBUTTED!', 'RESPONSE TO REVIEWERS SENT', 'SEE SUPPLEMENTARY NOTE 4', 'WE THANK THE REVIEWER'][rebuttals & 3]);
    blip(880, .08); setTimeout(function () { blip(1174, .1); }, 90);
  }
  function caught(b) {
    b.cool = 5; b.flee = 2.5; revisions++;
    if (hudRev) hudRev.textContent = revisions;
    current = { text: DEMANDS[Math.floor(Math.random() * DEMANDS.length)], title: 'REVISIONS REQUESTED (' + revisions + ')', voice: BADDIE_VOICE };
    if (fp) { notice(current); hurt(1); }
    else openDialog({ kind: 'baddie', obj: current });
    // knockback
    var dx = player.position.x - b.mesh.position.x, dz = player.position.z - b.mesh.position.z, l = Math.hypot(dx, dz) || 1;
    var nx = player.position.x + dx / l * 2.5, nz = player.position.z + dz / l * 2.5;
    if (!collide(nx, nz, 0.5)) player.position.set(nx, 0, nz);
    blip(160, .18); setTimeout(function () { blip(120, .25); }, 150);
  }
  // One place for taking damage in first person: red flash, grunt, a heart, and REJECTED! at zero.
  function hurt(n) {
    if (over || hurtCool > 0 || !fp) return false;
    hurtCool = 0.9; grunt();
    if (hurtEl) { hurtEl.hidden = false; hurtEl.style.transition = 'none'; hurtEl.style.opacity = 1; setTimeout(function () { hurtEl.style.transition = 'opacity .6s ease-out'; hurtEl.style.opacity = 0; }, 90); }
    if (PARAMS.god) return true;
    hits = Math.min(MAX_HITS, hits + (n || 1)); drawHearts();
    if (hits >= MAX_HITS) rejected();
    return true;
  }
  function drawHearts() { if (hudHits) hudHits.textContent = Array(MAX_HITS - hits + 1).join('♥') + Array(hits + 1).join('♡'); }
  function rejected() {
    over = true; overT = 0; dialogOpen = true; dlg.hidden = true; prompt.hidden = true; if (cross) cross.hidden = true; toast.hidden = true;
    if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) {}
    root.classList.add('is-over'); if (overEl) overEl.hidden = false;
    if (window.Riff) Riff.stop(); fireHeld = false;
    // the thud
    blip(70, 1.2, 'sawtooth'); setTimeout(function () { blip(52, 1.6, 'sawtooth'); }, 250);
  }
  function resubmit() {
    if (endgame) { retryBoss(); return; }
    over = false; root.classList.remove('is-over'); if (overEl) overEl.hidden = true;
    dialogOpen = false; dread = 0; fp = false; fpBlend = 0; fpPitch = 0; hits = 0; revisions = 0; if (hudRev) hudRev.textContent = 0;
    if (hudHitsWrap) hudHitsWrap.hidden = true; if (cross) cross.hidden = true; weapon.visible = false; player.visible = true; player.scale.set(1, 1, 1);
    player.position.set(0, 0, 4); pstate.yaw = 0; pstate.y = 0; pstate.vy = 0; pstate.air = false; camYaw = 0; camPitch = 0.52;
    shots.forEach(function (sh) { scene.remove(sh.m); }); shots.length = 0;
    BADDIES.forEach(function (b) { b.mesh.visible = true; b.mesh.position.set(b.home.x, 0, b.home.z); b.flee = 0; b.cool = 3; b.down = 0; b.hp = 2; });
    if (window.Riff) { Riff.setDread(0); Riff.takeover(false); if (musicWanted) { try { Riff.play('quest'); } catch (e) {} } }
    applyDread(clock.elapsedTime); blip(440, .06); showToast('RESUBMITTED. VERSION 2.');
  }
  if (overEl) overEl.addEventListener('click', function () { if (over && overT > 1.2) resubmit(); });
  window.addEventListener('keydown', function (e) { if (over && overT > 1.2 && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF')) { e.preventDefault(); resubmit(); } });
  function grunt() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var t = AC.currentTime, o = AC.createOscillator(), f1 = AC.createBiquadFilter(), f2 = AC.createBiquadFilter(), g = AC.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.28);
      f1.type = 'bandpass'; f1.frequency.setValueAtTime(700, t); f1.frequency.exponentialRampToValueAtTime(380, t + 0.25); f1.Q.value = 2.5;
      f2.type = 'lowpass'; f2.frequency.value = 1800;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      var n = AC.createBufferSource(), nb = AC.createBuffer(1, AC.sampleRate * 0.3, AC.sampleRate), nd = nb.getChannelData(0); for (var i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.5;
      n.buffer = nb; var ng = AC.createGain(); ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(f1); f1.connect(f2); f2.connect(g); g.connect(AC.destination); n.connect(f1); n.connect(ng); ng.connect(f2);
      o.start(t); o.stop(t + 0.35); n.start(t); n.stop(t + 0.3);
    } catch (e) {}
  }
  /* ------------------------------------------------------------ reviewer navigation
     The reviewers used to run straight at the player and wedge themselves against the first wall they met.
     - navCell  : a 1-unit grid over the playable square (0 wide open, 1 walkable, 2 blocked), filled lazily from
                  collide() and refilled whenever colliders.length changes (the boss flattens the town).
     - navField : ONE shared flood-fill distance field from the player's cell (8-connected, no corner cutting,
                  5/7 step costs), refreshed at most ~3x a second and only when somebody cannot see him.
                  Each reviewer also owns a static field that leads home.
     - behaviour: clear line of sight -> run straight, at a personal approach slot so they fan out and flank;
                  otherwise follow the field downhill, string-pulled to the farthest cell they can see. Wall sliding,
                  a stuck detector, separation, and a zigzag when you stare at one down the barrel in first person.
     Nobody got faster. They merely read the map. */
  var NAV_R = 0.5, NAV_N = 2 * (WORLD + 5), NAV_MIN = -(WORLD + 5), NAV_CELLS = NAV_N * NAV_N, NAV_INF = 65535, NAV_EVERY = 0.33;
  var navCell = new Uint8Array(NAV_CELLS), navField = new Uint16Array(NAV_CELLS), navBack = new Uint16Array(NAV_CELLS), navQueue = new Int32Array(NAV_CELLS), navInQ = new Uint8Array(NAV_CELLS);
  var NAV_OFF = [1, -1, NAV_N, -NAV_N, NAV_N + 1, NAV_N - 1, -NAV_N + 1, -NAV_N - 1];           // four straight neighbours, then four diagonal
  var NAV_OX = [0, 0, 0, 0, 1, -1, 1, -1], NAV_OZ = [0, 0, 0, 0, NAV_N, NAV_N, -NAV_N, -NAV_N];   // the two cells a diagonal step squeezes between
  var navBuiltFor = -1, navSerial = 0, navT = 0, navFieldAt = -1e9, navFieldCell = -1, navFieldSerial = -1, navSlotAt = -1e9;
  var navQHead = 0, navQTail = 0, navQCount = 0, navFlooding = false, navBackCell = -1, navPath = new Int32Array(16), navBudget = 0;
  var navWx = 0, navWz = 0, navPvx = 0, navPvz = 0, navLastPx = 0, navLastPz = 0, navAimX = 0, navAimZ = 1;
  var navOrder = BADDIES.map(function () { return 0; }), navBear = BADDIES.map(function () { return 0; });

  function navTurn(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }   // signed shortest way round from b to a
  function navIdx(x, z) {
    var i = Math.floor(x - NAV_MIN), j = Math.floor(z - NAV_MIN);
    if (i < 0) i = 0; else if (i >= NAV_N) i = NAV_N - 1;
    if (j < 0) j = 0; else if (j >= NAV_N) j = NAV_N - 1;
    return j * NAV_N + i;
  }
  // collide() for a reviewer-sized body, skipping the collider loop wherever the grid already knows the answer
  function navHit(x, z) { return navCell[navIdx(x, z)] === 0 ? false : collide(x, z, NAV_R); }
  function navLos(ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az, n = Math.ceil(Math.hypot(dx, dz) / 0.5), i;
    for (i = 1; i <= n; i++) if (navHit(ax + dx * i / n, az + dz * i / n)) return false;
    return true;
  }
  // the same question asked of the map alone (array lookups, no collide()): centre line plus both shoulders once clear of the start
  function navGridLos(ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), n = Math.ceil(l / 0.5), i, x, z, ox, oz;
    if (l < 1e-6) return true;
    ox = -dz / l * 0.4; oz = dx / l * 0.4;
    for (i = 1; i <= n; i++) {
      x = ax + dx * i / n; z = az + dz * i / n;
      if (navCell[navIdx(x, z)] === 2) return false;
      if (i > 2 && (navCell[navIdx(x + ox, z + oz)] === 2 || navCell[navIdx(x - ox, z - oz)] === 2)) return false;
    }
    return true;
  }
  // quadtree fill: a single collide() call clears a whole open block, so the full grid costs a few thousand calls, not 26,000
  function navFill(i0, j0, s) {
    if (i0 >= NAV_N || j0 >= NAV_N) return;
    var x = NAV_MIN + i0 + s / 2, z = NAV_MIN + j0 + s / 2, i, j, i1, j1, h;
    if (!collide(x, z, NAV_R + s * 0.7072)) {        // nothing within reach of any point of the block
      i1 = Math.min(NAV_N, i0 + s); j1 = Math.min(NAV_N, j0 + s);
      for (j = j0; j < j1; j++) for (i = i0; i < i1; i++) navCell[j * NAV_N + i] = 0;
      return;
    }
    if (s === 1) { navCell[j0 * NAV_N + i0] = collide(x, z, 0.55) ? 2 : 1; return; }
    h = s / 2; navFill(i0, j0, h); navFill(i0 + h, j0, h); navFill(i0, j0 + h, h); navFill(i0 + h, j0 + h, h);
  }
  function navBuild() {
    var i, s = 1;
    while (s < NAV_N) s *= 2;
    navFill(0, 0, s);
    for (i = 0; i < NAV_N; i++) navCell[i] = navCell[NAV_CELLS - 1 - i] = navCell[i * NAV_N] = navCell[i * NAV_N + NAV_N - 1] = 2;   // a solid rim: the flood fill needs no bounds checks
    navBuiltFor = colliders.length; navSerial++; navFlooding = false;
    BADDIES.forEach(function (b) {                     // a desk inside a tree is no desk at all (Reviewer 1 had one)
      if (collide(b.home.x, b.home.z, 0.6) && navNearest(b.home.x, b.home.z, true)) { b.home.x = navWx; b.home.z = navWz; }
    });
  }
  // -> navWx/navWz: centre of the closest open cell (wide: one with elbow room)
  function navNearest(x, z, wide) {
    var ci = Math.floor(x - NAV_MIN), cj = Math.floor(z - NAV_MIN), R, i, j, c, ex, ez, d, best;
    for (R = 3; R <= 12; R += 9) {
      best = 1e9;
      for (j = cj - R; j <= cj + R; j++) for (i = ci - R; i <= ci + R; i++) {
        if (i < 1 || j < 1 || i > NAV_N - 2 || j > NAV_N - 2) continue;
        c = navCell[j * NAV_N + i]; if (c === 2 || (wide && c === 1)) continue;
        ex = NAV_MIN + i + 0.5 - x; ez = NAV_MIN + j + 0.5 - z; d = ex * ex + ez * ez;
        if (d < best) { best = d; navWx = x + ex; navWz = z + ez; }
      }
      if (best < 1e9) return true;
    }
    return false;
  }
  // breadth-first flood from a point: FIFO queue, straight steps cost 5, diagonal 7, +2 for brushing past an obstacle.
  // Seed, then run: the player's field is flooded into a back buffer a few thousand cells a frame and swapped in when done.
  function navFloodSeed(field, sx, sz) {
    var ci = Math.floor(sx - NAV_MIN), cj = Math.floor(sz - NAV_MIN), R, i, j, c;
    field.fill(NAV_INF); navInQ.fill(0); navQHead = navQTail = navQCount = 0;
    for (R = 0; R <= 3 && !navQCount; R++)             // pressed against a wall the grid calls blocked? start from the open cells around instead
      for (j = cj - R; j <= cj + R; j++) for (i = ci - R; i <= ci + R; i++) {
        if (i < 1 || j < 1 || i > NAV_N - 2 || j > NAV_N - 2) continue;
        c = j * NAV_N + i; if (navCell[c] === 2) continue;
        field[c] = Math.round(5 * Math.hypot(NAV_MIN + i + 0.5 - sx, NAV_MIN + j + 0.5 - sz));
        navInQ[c] = 1; navQueue[navQTail++] = c; navQCount++;
      }
  }
  function navFloodRun(field, budget) {                // true once the queue has drained
    var head = navQHead, tail = navQTail, count = navQCount, c, k, n, d, nd;
    while (count && budget-- > 0) {
      c = navQueue[head]; head = head + 1 === NAV_CELLS ? 0 : head + 1; count--; navInQ[c] = 0; d = field[c];
      for (k = 0; k < 8; k++) {
        n = c + NAV_OFF[k];
        if (navCell[n] === 2 || (k > 3 && (navCell[c + NAV_OX[k]] === 2 || navCell[c + NAV_OZ[k]] === 2))) continue;   // no cutting corners
        nd = d + (k > 3 ? 7 : 5) + (navCell[n] ? 2 : 0);
        if (nd < field[n]) { field[n] = nd; if (!navInQ[n]) { navInQ[n] = 1; navQueue[tail] = n; tail = tail + 1 === NAV_CELLS ? 0 : tail + 1; count++; } }
      }
    }
    navQHead = head; navQTail = tail; navQCount = count;
    return count === 0;
  }
  function navFieldSwap() { var f = navField; navField = navBack; navBack = f; navFieldCell = navBackCell; navFieldAt = navT; navFieldSerial = navSerial; navFlooding = false; }
  function navFlood(field, sx, sz) {                   // all in one go (first field, home fields)
    if (navFlooding) { navFloodRun(navBack, 1e9); navFieldSwap(); }
    navFloodSeed(field, sx, sz); navFloodRun(field, 1e9);
  }
  function navPlayerField(px, pz) {                    // shared by all six; about 3 floods a second at most, none while he stands still
    var c = navIdx(px, pz);
    if (navFieldSerial !== navSerial) { navFlood(navField, px, pz); navFieldCell = c; navFieldAt = navT; navFieldSerial = navSerial; return; }
    if (navFlooding || c === navFieldCell || navT - navFieldAt < NAV_EVERY) return;
    navFloodSeed(navBack, px, pz); navBackCell = c; navFlooding = true;
  }
  function navHomeField(b) {
    if (!b.homeField) b.homeField = new Uint16Array(NAV_CELLS);
    if (b.homeSerial !== navSerial) { navFlood(b.homeField, b.home.x, b.home.z); b.homeSerial = navSerial; }
  }
  // walk a field downhill from (x, z) and keep the farthest cell still in plain sight -> navWx/navWz.
  // The pulling is done on the map (cheap); only the chosen corner is confirmed with real collide() sampling.
  function navDescend(x, z, field, steps) {
    var c = navIdx(x, z), k, n, s, best, bd, len = 0, pick;
    if (navCell[c] === 2 || field[c] === NAV_INF) {    // hugging something: first step onto the best open cell next door
      best = -1; bd = NAV_INF;
      for (k = 0; k < 8; k++) { n = c + NAV_OFF[k]; if (n >= 0 && n < NAV_CELLS && navCell[n] !== 2 && field[n] < bd) { bd = field[n]; best = n; } }
      if (best < 0) return false;
      c = best; navPath[len++] = c;
    }
    for (s = len; s < steps; s++) {
      best = -1; bd = field[c];
      for (k = 0; k < 8; k++) {
        n = c + NAV_OFF[k];
        if (navCell[n] === 2 || field[n] >= bd || (k > 3 && (navCell[c + NAV_OX[k]] === 2 || navCell[c + NAV_OZ[k]] === 2))) continue;
        bd = field[n]; best = n;
      }
      if (best < 0) break;
      if (len && !navGridLos(x, z, NAV_MIN + best % NAV_N + 0.5, NAV_MIN + Math.floor(best / NAV_N) + 0.5)) break;
      c = best; navPath[len++] = c;
    }
    if (!len) return false;
    pick = len - 1;                                      // farthest corner; if the real check disagrees try halfway, else just the cell next door
    for (k = 0; k < 2 && pick > 0; k++) {
      n = navPath[pick];
      if (navLos(x, z, NAV_MIN + n % NAV_N + 0.5, NAV_MIN + Math.floor(n / NAV_N) + 0.5)) break;
      pick = k ? 0 : pick >> 1;
    }
    n = navPath[pick]; navWx = NAV_MIN + n % NAV_N + 0.5; navWz = NAV_MIN + Math.floor(n / NAV_N) + 0.5;
    return true;
  }
  // one movement step with wall sliding: whole move, else whichever axis is open, else lean the heading round the obstacle
  function navStep(b, ang, dist) {
    var p = b.mesh.position, s = Math.sin(ang), c = Math.cos(ang), nx = p.x + s * dist, nz = p.z + c * dist, k, a, tx, tz, okx, okz;
    if (dist <= 0) return true;
    if (!navHit(nx, nz)) { p.x = nx; p.z = nz; return true; }
    okx = Math.abs(s) > 0.2 && !collide(nx, p.z, NAV_R); okz = Math.abs(c) > 0.2 && !collide(p.x, nz, NAV_R);
    if (okx && (!okz || Math.abs(s) >= Math.abs(c))) { p.x = nx; return true; }
    if (okz) { p.z = nz; return true; }
    for (k = 1; k <= 5; k++) {                         // keep to one side so it does not dither in front of a tree
      a = ang + b.side * k * 0.5; tx = p.x + Math.sin(a) * dist; tz = p.z + Math.cos(a) * dist;
      if (!collide(tx, tz, NAV_R)) { p.x = tx; p.z = tz; return true; }
      a = ang - b.side * k * 0.5; tx = p.x + Math.sin(a) * dist; tz = p.z + Math.cos(a) * dist;
      if (!collide(tx, tz, NAV_R)) { b.side = -b.side; p.x = tx; p.z = tz; return true; }
    }
    return false;
  }
  // approach slots: keep the chasers' order round the player, spread them evenly, rotate the ring to disturb them least
  function navSlots(px, pz) {
    var n = 0, i, j, k, b, a, sx = 0, sz = 0, step;
    for (i = 0; i < BADDIES.length; i++) {
      b = BADDIES[i]; b.slotOn = false;
      if (b.down <= 0 && b.flee <= 0 && b.chase) { navBear[i] = Math.atan2(b.mesh.position.x - px, b.mesh.position.z - pz); navOrder[n++] = i; }
    }
    if (n < 2) return;
    for (i = 1; i < n; i++) { k = navOrder[i]; for (j = i - 1; j >= 0 && navBear[navOrder[j]] > navBear[k]; j--) navOrder[j + 1] = navOrder[j]; navOrder[j + 1] = k; }
    step = 6.2832 / n;
    for (i = 0; i < n; i++) { a = navBear[navOrder[i]] - i * step; sx += Math.sin(a); sz += Math.cos(a); }
    a = Math.atan2(sx, sz);
    for (i = 0; i < n; i++) { b = BADDIES[navOrder[i]]; b.slot = a + i * step; b.slotOn = true; }
  }
  // -> navWx/navWz: where this reviewer wants to be: a little ahead of where he is running, out on its own spoke, closing in as it nears
  function navSlotPoint(b, px, pz, d) {
    var lead = Math.min(1, d / 14) * 0.8, R = b.slotOn ? Math.min(5.5, Math.max(0, (d - 3) * 0.55)) : 0;
    navWx = px + navPvx * lead + Math.sin(b.slot) * R; navWz = pz + navPvz * lead + Math.cos(b.slot) * R;
  }
  function navPlan(b, i, px, pz, d) {
    var p = b.mesh.position;
    b.plan = 0.14 + (i % 3) * 0.03;
    if (b.careful <= 0 || d < 4) {                     // (careful = was stuck a moment ago: trust the map, not the eyes)
      if (d > 3 && b.careful <= 0) { navSlotPoint(b, px, pz, d); if (navLos(p.x, p.z, navWx, navWz)) { b.mode = 1; return; } }
      if (navLos(p.x, p.z, px, pz)) { b.mode = 2; return; }
    }
    navPlayerField(px, pz);
    if (navDescend(p.x, p.z, navField, b.careful > 0 ? 1 : 12)) { b.mode = 3; b.wx = navWx; b.wz = navWz; return; }
    b.mode = 2;                                        // no way through on the map (or already on top of him): go straight and slide
  }
  // running away: the open heading that gains the most distance-by-foot from him, with a little momentum
  function navFleeYaw(b, px, pz) {
    var p = b.mesh.position, away = Math.atan2(p.x - px, p.z - pz), best = away, bs = -1e9, k, a, c1, c2, f, s;
    navPlayerField(px, pz);
    for (k = 0; k < 12; k++) {
      a = away + k * 0.5236; c1 = navIdx(p.x + Math.sin(a) * 1.6, p.z + Math.cos(a) * 1.6);
      if (navCell[c1] === 2) continue;
      c2 = navIdx(p.x + Math.sin(a) * 3.2, p.z + Math.cos(a) * 3.2);
      f = navCell[c2] !== 2 && navField[c2] !== NAV_INF ? navField[c2] : navField[c1] !== NAV_INF ? navField[c1] - 8 : 0;
      s = f / 5 + 2 * Math.cos(a - away) + 1.2 * Math.cos(a - b.head);
      if (s > bs) { bs = s; best = a; }
    }
    return best;
  }
  function navOpenYaw(x, z) {                          // a random heading with some room in front of it
    var k, a = 0;
    for (k = 0; k < 8; k++) {
      a = rnd() * 6.283;
      if (navCell[navIdx(x + Math.sin(a) * 1.4, z + Math.cos(a) * 1.4)] !== 2 && navCell[navIdx(x + Math.sin(a) * 2.8, z + Math.cos(a) * 2.8)] !== 2) break;
    }
    return a;
  }
  function navReviewer(b, i, h) {
    var m = b.mesh, p = m.position, px = player.position.x, pz = player.position.z;
    var dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz), range = 14 + 10 * dread;
    var speed = 0, want = b.head, face = b.head, raw = false, turn = 9, cap, k, o, rx, rz, rl, q, f, sx = 0, sz = 0, vx, vz, ox = p.x, oz = p.z;
    if (b.flee > 0) b.flee -= h; if (b.cool > 0) b.cool -= h;
    if (b.careful > 0) b.careful -= h; if (b.probe > 0) b.probe -= h;
    b.plan -= h;
    var think = b.plan <= 0 && navBudget > 0, fleeing = b.flee > 0, chasing = !fleeing && !dialogOpen && d < range + (b.chase ? 4 : 0);   // once on the scent they give up a little later than they notice
    b.chase = chasing;
    // standing inside something solid (a bad desk, or the world changed underfoot): walk out to the nearest open cell
    if (think && b.esc <= 0 && navCell[navIdx(p.x, p.z)] !== 0 && collide(p.x, p.z, 0.45) && navNearest(p.x, p.z, false)) { b.esc = 1.5; b.ex = navWx; b.ez = navWz; }

    if (b.esc > 0) {
      b.esc -= h; rl = Math.hypot(b.ex - p.x, b.ez - p.z); speed = 5; b.mode = 0;
      if (rl < 0.15) { b.esc = 0; speed = 0; }
      else { want = Math.atan2(b.ex - p.x, b.ez - p.z); b.head = want; raw = collide(p.x, p.z, 0.45); if (think) b.plan = 0.2; }
    } else if (fleeing) {
      speed = 7; turn = 14;
      if (think || b.mode !== 4) { navBudget--; b.mode = 4; b.plan = 0.2; b.fleeA = navFleeYaw(b, px, pz); }
      want = b.fleeA;
    } else if (chasing) {
      speed = d < 1.2 ? 0 : (4.6 + (i % 3) * 0.4) * (1 + 0.5 * dread);
      if (d < 1.7 && b.cool <= 0 && pstate.y < 1.2) caught(b);
      if (think) { navBudget--; navPlan(b, i, px, pz, d); } else if (b.mode < 1 || b.mode > 3) { b.mode = 2; b.plan = 0; }   // no thinking time left this frame: go straight for now
      if (b.mode === 1) { navSlotPoint(b, px, pz, d); want = Math.atan2(navWx - p.x, navWz - p.z); }
      else if (b.mode === 2) want = Math.atan2(dx, dz);
      else { want = Math.atan2(b.wx - p.x, b.wz - p.z); if (Math.hypot(b.wx - p.x, b.wz - p.z) < 0.45) b.plan = 0; }
      // first person: if he is sighting along the barrel at you, do not run down the barrel
      if (fp && speed > 0 && d > 4 && b.mode !== 3) {
        q = -dx * navAimX - dz * navAimZ;
        if (q > 0 && Math.abs(-dx * navAimZ + dz * navAimX) < 1.2 + q * 0.05) b.aimed = 0.4;
      }
      if (b.aimed > 0) {
        b.aimed -= h; b.zigT -= h;
        if (b.zigT <= 0) { b.zig = -b.zig; b.zigT = 0.45 + rnd() * 0.55; }
        if (speed > 0 && d > 4 && b.mode !== 3) {
          f = want + b.zig * 0.55;
          if (navHit(p.x + Math.sin(f) * 1.5, p.z + Math.cos(f) * 1.5)) { b.zig = -b.zig; f = want + b.zig * 0.55; if (navHit(p.x + Math.sin(f) * 1.5, p.z + Math.cos(f) * 1.5)) f = want; }
          want = f;
        }
      }
      if (speed === 0) face = Math.atan2(dx, dz);
    } else {
      speed = 1.8; b.wander -= h; if (think && b.plan < 0) b.plan = 0.25;
      rl = Math.hypot(b.home.x - p.x, b.home.z - p.z);
      if (b.goHome ? rl < 10 : rl > 16) { b.goHome = !b.goHome; think = true; }
      if (b.goHome) {                                  // strayed: walk home by the map rather than into the back of the Library
        if (think || b.mode !== 5) {
          navBudget--; b.mode = 5; b.plan = 0.4; b.wx = b.home.x; b.wz = b.home.z;
          if (!navLos(p.x, p.z, b.wx, b.wz)) { navHomeField(b); if (navDescend(p.x, p.z, b.homeField, b.careful > 0 ? 1 : 10)) { b.wx = navWx; b.wz = navWz; } }
        }
        want = Math.atan2(b.wx - p.x, b.wz - p.z); if (Math.hypot(b.wx - p.x, b.wz - p.z) < 0.45) b.plan = 0;
      } else {
        if (b.mode !== 6) { b.mode = 6; b.yaw = b.head; }
        if (b.wander <= 0) { b.wander = 2 + rnd() * 3; b.yaw = navOpenYaw(p.x, p.z); }
        else if (b.probe <= 0 && navCell[navIdx(p.x + Math.sin(b.yaw) * 1.4, p.z + Math.cos(b.yaw) * 1.4)] === 2) { b.probe = 0.6; b.yaw = navOpenYaw(p.x, p.z); }   // wall ahead: turn before walking into it
        want = b.yaw;
      }
    }

    cap = speed > 0 ? speed : chasing ? 2 : 0;         // standing next to him they may still shuffle apart
    if (cap > 0) {
      if (raw) { q = Math.min(rl, speed * h) / rl; p.x += (b.ex - p.x) * q; p.z += (b.ez - p.z) * q; }
      else {
        for (k = 0; k < BADDIES.length; k++) {         // separation: lean away from colleagues, never stack
          o = BADDIES[k]; if (o === b || o.down > 0) continue;
          rx = p.x - o.mesh.position.x; rz = p.z - o.mesh.position.z; rl = Math.hypot(rx, rz);
          if (rl < 1.6) { if (rl < 0.01) { rx = i > k ? 1 : -1; rz = 0.3; rl = 1.044; } q = (1.6 - rl) / (1.6 * rl); sx += rx * q; sz += rz * q; }
        }
        f = navTurn(want, b.head); q = turn * h; b.head += f > q ? q : f < -q ? -q : f;
        f = Math.abs(navTurn(want, b.head)); f = f > 1 ? 0.45 : f > 0.5 ? 1 - (f - 0.5) * 1.1 : 1;      // brake into a sharp turn rather than orbit the waypoint
        vx = Math.sin(b.head) * speed * f + sx * 7; vz = Math.cos(b.head) * speed * f + sz * 7; q = Math.hypot(vx, vz);
        if (q > cap) { vx *= cap / q; vz *= cap / q; q = cap; }                                          // never faster than the rules allow
        if (q > 0.01 && !navStep(b, Math.atan2(vx, vz), q * h) && b.plan > 0.05) b.plan = 0.05;         // walked into something: think again, soon
      }
      q = Math.hypot(p.x - ox, p.z - oz); b.moved += q; b.walkT += q * 1.6;
    }
    if (speed > 0) face = b.head;
    m.rotation.y += navTurn(face, m.rotation.y) * Math.min(1, h * 10);

    // stuck detector: wants to move, has not covered 0.3 units in a second -> go by the map; twice running -> shuffle to open ground
    if (speed > 0 && !(chasing && d < 2.5)) {
      b.stuckT += h;
      if (b.stuckT >= 1) {
        if (Math.hypot(p.x - b.sx, p.z - b.sz) < 0.3) {
          b.stuckN++; b.side = -b.side; b.plan = 0; b.careful = 2.5; b.wander = 0;
          if (b.stuckN > 1 && b.esc <= 0 && navNearest(p.x, p.z, true)) { b.esc = 1.2; b.ex = navWx; b.ez = navWz; }
        } else b.stuckN = 0;
        b.stuckT = 0; b.sx = p.x; b.sz = p.z;
      }
    } else { b.stuckT = 0; b.stuckN = 0; b.sx = p.x; b.sz = p.z; }
  }
  function updateBaddies(dt) {
    if (navBuiltFor !== colliders.length) navBuild();
    if (!(dt > 0)) return;
    var px = player.position.x, pz = player.position.z, n, s, k, b, m, v;
    navT += dt;
    // where he is heading, for cutting him off (teleports and knockbacks are not running)
    v = Math.hypot(px - navLastPx, pz - navLastPz) / dt; k = Math.min(1, dt * 6);
    if (v < 12) { navPvx += ((px - navLastPx) / dt - navPvx) * k; navPvz += ((pz - navLastPz) / dt - navPvz) * k; } else { navPvx = 0; navPvz = 0; }
    navLastPx = px; navLastPz = pz;
    if (fp) { v = viewDir(); k = Math.hypot(v.x, v.z) || 1; navAimX = v.x / k; navAimZ = v.z / k; }
    if (navT - navSlotAt >= NAV_EVERY) { navSlotAt = navT; navSlots(px, pz); }
    if (navFlooding && navFloodRun(navBack, Math.max(3500, dt * 210000))) navFieldSwap();   // ~0.2 ms of flood a frame, done within four
    n = Math.max(1, Math.min(30, Math.ceil(dt * 18))); navBudget = 2 * n;                     // at most two reviewers re-plan per step: no thundering herd   // big frames (timescale, tab switches) are sub-stepped: under half a unit a step, nothing tunnels
    for (k = 0; k < BADDIES.length; k++) {
      b = BADDIES[k]; m = b.mesh;
      if (b.down > 0) { b.down -= dt; if (b.down <= 0) { m.visible = true; m.position.set(b.home.x, 0, b.home.z); b.flee = 0; b.chase = false; b.plan = 0; b.esc = 0; } continue; }
      b.moved = 0;
      for (s = 0; s < n; s++) navReviewer(b, k, dt / n);
      v = b.moved / dt;                                  // animate what the legs actually did, so a blocked reviewer does not moonwalk
      pose(m, { walk: b.walkT, speed: v / 7 });
      m.position.y = v > 0.35 ? Math.abs(Math.sin(b.walkT)) * 0.06 : 0;
    }
  }
  /* TEMP-DEBUG-BEGIN (reviewer-AI test handle; removed before hand-over) */
  (function () {
    var inner = updateBaddies, gt = 0, cost = 0, frames = 0, worst = 0, calls = 0, innerCollide = collide;
    collide = function (x, z, r) { calls++; return innerCollide(x, z, r); };
    updateBaddies = function (dt) { gt += dt; var t0 = performance.now(); inner(dt); t0 = performance.now() - t0; if (dt > 0) { cost += t0; frames++; if (t0 > worst) worst = t0; } };
    window.__debug = { BADDIES: BADDIES, player: player, pstate: pstate, collide: collide, colliders: colliders,
      set: function (o) { if ('dread' in o) dread = o.dread; if ('dialogOpen' in o) dialogOpen = o.dialogOpen; if ('camYaw' in o) camYaw = o.camYaw; if ('fpPitch' in o) fpPitch = o.fpPitch; },
      get: function () { return { fp: fp, dread: dread, hits: hits, over: over, running: running, revisions: revisions, accepted: accepted, dialogOpen: dialogOpen, gt: gt, camYaw: camYaw, endgame: endgame }; },
      perf: function (reset) { var r = { ms: frames ? cost / frames : 0, worst: worst, frames: frames }; if (reset) { cost = 0; frames = 0; worst = 0; } return r; },
      step: function (dt) { inner(dt); }, calls: function () { var c = calls; calls = 0; return c; },
      nav: { N: NAV_N, MIN: NAV_MIN, cell: navCell, field: function () { return navField; }, flooding: function () { return navFlooding; },
        build: function () { var t0 = performance.now(); navBuild(); return performance.now() - t0; },
        flood: function (x, z, reps) { var t0 = performance.now(), k; for (k = 0; k < (reps || 1); k++) navFlood(navField, x, z); navFieldCell = -1; return (performance.now() - t0) / (reps || 1); },
        los: navLos, descend: function (x, z) { navFieldCell = -1; navFieldAt = -1e9; navPlayerField(player.position.x, player.position.z); return navDescend(x, z, navField, 12) ? [navWx, navWz] : null; },
        state: function () { return BADDIES.map(function (b) { return { mode: b.mode, chase: b.chase, slotOn: b.slotOn, slot: b.slot, esc: b.esc, stuckN: b.stuckN, careful: b.careful, home: b.home, aimed: b.aimed, goHome: b.goHome }; }); } } };
  })();
  /* TEMP-DEBUG-END */
  function showToast(msg) { toast.textContent = msg; toast.hidden = false; toastT = 2.6; }
  /* ------------------------------------------------------------ physics */
  function collide(x, z, r) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (c.r !== undefined) { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true; }
      else if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return true;
    }
    return Math.abs(x) > WORLD + 4 || Math.abs(z) > WORLD + 4;
  }

  var tmp = new THREE.Vector3(), tmpC = new THREE.Color();
  function applyDread(t) {
    var d = dread, e = d;
    scene.background.lerpColors(DAY.sky, DUSK.sky, e); scene.fog.color.copy(scene.background);
    scene.fog.near = 55 - 35 * e; scene.fog.far = 120 - 70 * e;
    hemi.color.lerpColors(DAY.hemiSky, DUSK.hemiSky, e); hemi.groundColor.lerpColors(DAY.hemiGround, DUSK.hemiGround, e); hemi.intensity = 0.85 - 0.5 * e;
    sun.color.lerpColors(DAY.sun, DUSK.sun, e); sun.intensity = 1.1 - 0.45 * e;
    fading.forEach(function (f) { f.mat.color.lerpColors(f.from, f.to, e); });
    lampMat.emissive.lerpColors(lampEm0, lampEm1, e); lampMat.emissiveIntensity = 0.8 + e * (0.6 + Math.sin(t * 9) * 0.3);
    var flicker = e > 0.3 && Math.sin(t * 23 + Math.sin(t * 7) * 5) > 0.75 ? 0.05 : 1;
    winMats.forEach(function (m, i) { m.emissiveIntensity = (0.5 + e * 0.8) * ((i % 3 === 0) ? flicker : 1); m.emissive.setHex(e > 0.6 ? 0xff5a2a : 0xffd77a); });
    cloudMat.opacity = 0.92 - 0.3 * e;
    markers.forEach(function (m) { m.material.emissiveIntensity = 0.5 + e * (0.5 + Math.sin(t * 12) * 0.5); });
  }
  function update(dt) {
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.hidden = true; }
    var t = clock.elapsedTime;
    if (running && dt > 0) { dread = Math.min(1, dread + dt / (endgame ? 4 : DREAD_TIME)); if (window.Riff) Riff.setDread(dread); if (!envLocked) applyDread(t); if (!fp && dread >= FP_AT) enterFP(); }
    if (hurtCool > 0) hurtCool -= dt;
    if (over) {
      overT += dt;   // slow tilt to the ground, GTA style
      fpPitch = Math.max(-1.1, fpPitch - dt * 0.5); camera.position.y = Math.max(0.6, camera.position.y - dt * 0.9);
      camera.lookAt(camera.position.x - Math.sin(camYaw) * 3, camera.position.y - 1.5, camera.position.z - Math.cos(camYaw) * 3);
      camera.rotation.z += dt * 0.15;
      return;
    }
    // the boss module runs inside our clock; while it is `cinematic` it owns the camera and we stand still
    var bossOn = endgame && boss && boss.active, cine = false;
    if (bossOn) { try { boss.update(dt, t); } catch (err) { console.error(err); } cine = !!boss.cinematic; }
    if (fp) { fpBlend = Math.min(1, fpBlend + dt / 1.2); updateShots(dt); player.visible = fpBlend < 0.85 && !cine; weapon.visible = fpBlend >= 1 && !cine && hudOn; if (fireHeld && !cine) fire(); }
    markers.forEach(function (m, i) { m.rotation.y += dt * 2; m.position.y = 3.6 + Math.sin(t * 3 + i) * 0.25; });
    NPCS.forEach(function (n, i) { n.mesh.position.y = Math.abs(Math.sin(t * 4 + i)) * 0.12; });
    if (!endgame) updateBaddies(dt);
    if (cine) {
      clouds.forEach(function (c) { c.position.x += c.userData.v * dt; if (c.position.x > 110) c.position.x = -110; });
      prompt.hidden = true; pstate.speed = 0;
      return;
    }

    if (keys.rotl) camYaw += dt * 2; if (keys.rotr) camYaw -= dt * 2;

    var ix = 0, iz = 0;
    if (!dialogOpen) {
      if (keys.up) iz -= 1; if (keys.down) iz += 1; if (keys.left) ix -= 1; if (keys.right) ix += 1;
    }
    var moving = ix !== 0 || iz !== 0;
    if (moving) {
      // camera-relative movement
      var len = Math.hypot(ix, iz); ix /= len; iz /= len;
      var s = Math.sin(camYaw), c = Math.cos(camYaw);
      var wx = ix * c + iz * s, wz = -ix * s + iz * c;
      var target = Math.atan2(wx, wz);
      var d = target - pstate.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      pstate.yaw += d * Math.min(1, dt * 14);
      pstate.speed = Math.min(9, pstate.speed + dt * 40);
      var nx = player.position.x + wx * pstate.speed * dt, nz = player.position.z + wz * pstate.speed * dt;
      if (!collide(nx, player.position.z, 0.5)) player.position.x = nx;
      if (!collide(player.position.x, nz, 0.5)) player.position.z = nz;
    } else pstate.speed = Math.max(0, pstate.speed - dt * 50);
    player.rotation.y = pstate.yaw;

    // jump physics
    if (pstate.air) { pstate.vy -= 26 * dt; pstate.y += pstate.vy * dt; if (pstate.y <= 0) { pstate.y = 0; pstate.vy = 0; pstate.air = false; pstate.land = 0.18; blip(200, .05); } }
    if (pstate.land > 0) pstate.land -= dt;
    if (pstate.speed > 0.5) pstate.walkT += dt * pstate.speed * 1.5;
    pose(player, { walk: pstate.walkT, speed: pstate.speed / 9, air: pstate.air, vy: pstate.vy, t: t });
    player.position.y = pstate.air ? pstate.y : (pstate.speed > 0.5 ? Math.abs(Math.sin(pstate.walkT)) * 0.08 : 0);
    // landing squash
    var sq = pstate.land > 0 ? Math.sin(pstate.land / 0.18 * Math.PI) * 0.18 : 0; player.scale.set(1 + sq, 1 - sq, 1 + sq);
    // fountain drops + clouds
    if (window.__fountain) window.__fountain.children.forEach(function (d) { var ph = (t * 1.6 + d.userData.k / 14) % 1; var ang = d.userData.k / 14 * 6.283; d.position.set(Math.cos(ang) * ph * 2.0, 2.3 + Math.sin(ph * 3.14) * 1.4 - ph * 1.2, Math.sin(ang) * ph * 2.0); });
    clouds.forEach(function (c) { c.position.x += c.userData.v * dt; if (c.position.x > 110) c.position.x = -110; });

    // camera
    var cx = player.position.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist;
    var cz = player.position.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
    var cy = 1.5 + Math.sin(camPitch) * camDist;
    if (!fp) {
      camera.position.lerp(tmp.set(cx, cy, cz), Math.min(1, dt * 6));
      camera.lookAt(player.position.x, 1.6 + player.position.y * 0.5, player.position.z);
    } else {
      var k = fpBlend * fpBlend * (3 - 2 * fpBlend), dir = viewDir();
      var hx = player.position.x, hy = 2.25 + player.position.y, hz = player.position.z;
      camera.position.set(cx + (hx - cx) * k, cy + (hy - cy) * k, cz + (hz - cz) * k);
      var lx = player.position.x + (hx + dir.x * 6 - player.position.x) * k, ly = 1.6 + (hy + dir.y * 6 - 1.6) * k, lz = player.position.z + (hz + dir.z * 6 - player.position.z) * k;
      camera.lookAt(lx, ly, lz);
      pstate.yaw = camYaw + Math.PI; player.rotation.y = pstate.yaw;
    }
    if (shakeT > 0) {
      shakeT -= dt; var sa = shakeAmp * Math.max(0, shakeT / shakeDur);
      camera.position.x += (Math.random() - 0.5) * sa; camera.position.y += (Math.random() - 0.5) * sa; camera.position.z += (Math.random() - 0.5) * sa;
      camera.rotation.z += (Math.random() - 0.5) * sa * 0.04;
    }

    // prompt
    var near = nearbyTarget();
    if (fp && near && near.kind === 'baddie') near = null;
    prompt.hidden = !near || dialogOpen;
    if (near && !dialogOpen) {
      prompt.textContent = near.kind === 'baddie' ? 'F: REBUT' : 'F: TALK';
      if (fp) { var o = near.obj, ox = o.door ? o.door.x : o.x, oz = o.door ? o.door.z : o.z; tmp.set(ox, 3.2, oz).project(camera); if (tmp.z > 1) prompt.hidden = true; }
      else tmp.set(player.position.x, 3.4, player.position.z).project(camera);
      prompt.style.left = ((tmp.x + 1) / 2 * 100) + '%'; prompt.style.top = ((1 - tmp.y) / 2 * 100) + '%';
    }
    sun.position.set(player.position.x + 40, 60, player.position.z + 20); sun.target.position.copy(player.position); sun.target.updateMatrixWorld();
  }

  /* ------------------------------------------------------------ endgame: boss, then space */
  function safeSpot(x, z) {
    if (!collide(x, z, 0.6)) return { x: x, z: z };
    for (var r = 1; r < 30; r += 1) for (var a = 0; a < 12; a++) { var sx = x + Math.cos(a / 12 * 6.283) * r, sz = z + Math.sin(a / 12 * 6.283) * r; if (!collide(sx, sz, 0.6)) return { x: sx, z: sz }; }
    return { x: x, z: z };
  }
  function faceTo(x, y, z) {
    var dx = x - player.position.x, dy = y - (2.25 + player.position.y), dz = z - player.position.z;
    camYaw = Math.atan2(-dx, -dz); fpPitch = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz))));
  }
  function setHud(on) {
    hudOn = !!on;
    var hud = root.querySelector('.q-hud'); if (hud) hud.style.visibility = on ? '' : 'hidden';
    if (cross) cross.hidden = !on || !fp; if (!on) { prompt.hidden = true; toast.hidden = true; if (!dialogOpen) dlg.hidden = true; }
  }
  function music(name) {
    var R = window.Riff; if (!R) return;
    try {
      if (name === 'silence') { R.stop(); return; }
      if (name === 'boss') { R.setDread(1); if (R.boss) R.boss(true); if (musicWanted && !R.playing) R.play('quest'); return; }
      if (name === 'space') { if (R.boss) R.boss(false); if (musicWanted) R.play('space'); return; }
      if (name === 'quest') { if (R.boss) R.boss(false); if (musicWanted) R.play('quest'); return; }
    } catch (e) { console.error(e); }
  }
  var api = {
    THREE: THREE, root: root, view: view, scene: scene, camera: camera, renderer: renderer,
    WORLD: WORLD, EYE: 2.25, colliders: colliders, collide: collide, safeSpot: safeSpot,
    player: player, pstate: pstate,
    places: PLACES, fountain: fountain, npcs: NPCS,
    flat: flat, boxMan: boxMan, pose: pose, labelSprite: labelSprite,
    blip: blip, speak: speak, grunt: grunt, audio: function () { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); return AC; },
    showToast: showToast, notice: notice,
    hurt: hurt, heal: function (n) { hits = Math.max(0, hits - (n || MAX_HITS)); drawHearts(); },
    hearts: function () { return MAX_HITS - hits; },
    teleport: function (x, z) { var p = safeSpot(x, z); player.position.set(p.x, 0, p.z); pstate.y = 0; pstate.vy = 0; pstate.air = false; pstate.speed = 0; },
    lookAt: faceTo, shake: function (amp, secs) { shakeAmp = amp; shakeT = shakeDur = secs || 0.5; },
    setHud: setHud, lockEnvironment: function (on) { envLocked = !!on; },
    setWeapon: function (o) { if (o.rate) fireRate = o.rate; if (o.speed) shotSpeed = o.speed; if (o.gravity !== undefined) shotGrav = o.gravity; },
    music: music, musicWanted: function () { return musicWanted; }, setMusicWanted: function (on) { musicWanted = !!on; if (!on && window.Riff) Riff.stop(); },
    stinger: function (name) { try { if (window.Riff && Riff.stinger && musicWanted) Riff.stinger(name); } catch (e) {} },
    isOver: function () { return over; },
    params: PARAMS,
    links: { publications: '/publications/', research: '/research/', code: '/code/', scholar: 'https://scholar.google.com/citations?user=-OiUY4kAAAAJ&hl=en', email: 'mailto:duncan.palmer@stats.ox.ac.uk' },
    onBossDefeated: function () { launchShmup(); },
    restart: function () { try { localStorage.removeItem('quest.found'); } catch (e) {} location.hash = '#play'; location.reload(); }
  };
  try { boss = window.QuestBoss ? window.QuestBoss(api) : null; } catch (e) { console.error(e); boss = null; }
  try { shmup = window.QuestShmup ? window.QuestShmup(api) : null; } catch (e) { console.error(e); shmup = null; }

  function startEndgame() {
    if (endgame) return;
    endgame = true; pendingEndgame = false;
    if (dialogOpen) { dialogOpen = false; dlg.hidden = true; if (typing) { clearInterval(typing); typing = null; } }
    if (!fp) enterFP();
    hits = 0; drawHearts(); if (hudHitsWrap) hudHitsWrap.hidden = false;
    BADDIES.forEach(function (b) { b.down = 1e9; b.mesh.visible = false; });     // the ordinary reviewers know when to leave
    markers.forEach(function (m) { m.visible = false; });
    api.setWeapon({ rate: 0.13, speed: 70, gravity: 2.5 });                        // a hundred hits needs a faster arm
    if (!boss) { showToast('YOU FOUND EVERYTHING. (THE BOSS IS MISSING.)'); return; }
    try { boss.start({ hp: PARAMS.bossHp, skipIntro: PARAMS.skipIntro }); } catch (e) { console.error(e); }
  }
  function retryBoss() {
    over = false; root.classList.remove('is-over'); if (overEl) overEl.hidden = true;
    dialogOpen = false; dlg.hidden = true; hits = 0; drawHearts(); hurtCool = 1.5; fireHeld = false;
    shots.forEach(function (sh) { scene.remove(sh.m); }); shots.length = 0;
    camera.rotation.z = 0; setHud(true);
    if (boss) { try { boss.stop(); boss.start({ hp: PARAMS.bossHp, skipIntro: true, retry: true }); } catch (e) { console.error(e); } }
    blip(440, .06); showToast('RESUBMITTED. THE EDITOR IS WAITING.');
  }
  function launchShmup() {
    if (!shmup) { showToast('SPACE IS CLOSED TODAY.'); return; }
    if (boss && boss.active) { try { boss.stop(); } catch (e) {} }
    if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) {}
    fireHeld = false; for (var k in keys) keys[k] = false;
    setHud(false); root.classList.add('is-space');
    try { shmup.start({}); } catch (e) { console.error(e); }
  }
  var resetLink = document.querySelector('[data-quest-reset]');
  if (resetLink) resetLink.addEventListener('click', function (e) { e.preventDefault(); api.restart(); });

  var visible = true, vframe = 0, rendered = 0;
  function checkVisible() {
    vframe++;
    var r = root.getBoundingClientRect();
    visible = r.bottom > 0 && r.top < (window.innerHeight || 800);
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, clock.getDelta()) * PARAMS.timescale;
    checkVisible();
    if (shmup && shmup.active) return;          // the 2D shooter has the screen; stop paying for WebGL
    if (!visible && rendered++ > 2) return;
    if (running) update(dt); else { camYaw += dt * 0.15; update(0); }
    renderer.render(scene, camera);
  }
  resize();
  camera.position.set(0, 8, 18);
  loop();
})();
