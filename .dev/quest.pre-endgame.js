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
  (function () {
    var basin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.6, 24), flat(0xb8bcc8)); basin.position.set(0, 0.3, 0); basin.castShadow = true; basin.receiveShadow = true; scene.add(basin);
    var water = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 24), new THREE.MeshLambertMaterial({ color: 0x4a9be8, transparent: true, opacity: 0.85 })); water.position.set(0, 0.62, 0); scene.add(water);
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.6, 12), flat(0xb8bcc8)); col.position.set(0, 1.2, 0); col.castShadow = true; scene.add(col);
    var top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), flat(0xd6dae6)); top.position.set(0, 2.1, 0); top.castShadow = true; scene.add(top);
    var drops = new THREE.Group();
    for (var k = 0; k < 14; k++) { var d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshLambertMaterial({ color: 0x9fd0ff })); d.userData.k = k; drops.add(d); }
    scene.add(drops); window.__fountain = drops;
    colliders.push({ x: 0, z: 0, r: 3.0 });
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
    colliders.push({ x: p.x, z: p.z, hw: p.w / 2 + 0.4, hd: p.d / 2 + 0.4 });
    p.door = { x: p.x, z: p.z + p.d / 2 + 1.6 };
    [-1, 1].forEach(function (sd) { var bsh = new THREE.Mesh(bushGeo, bushMat); bsh.position.set(p.x + sd * 1.9, 0.45, p.z + p.d / 2 + 0.6); bsh.scale.set(1, 0.8, 1); bsh.castShadow = true; scene.add(bsh); });
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

  /* ------------------------------------------------------------ input */
  var KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'rotl', KeyE: 'rotr' };
  var ACT = { Enter: 1, KeyF: 1 };
  window.addEventListener('keydown', function (e) {
    if (!running || !visible) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (ACT[e.code]) { e.preventDefault(); action(); }
    if (e.code === 'Space') { e.preventDefault(); if (dialogOpen) action(); else jump(); }
    if (e.code === 'Escape' && dialogOpen) closeDialog();
  });
  window.addEventListener('keyup', function (e) { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
  function jump() { if (!running || dialogOpen || pstate.air) return; pstate.vy = 9.5; pstate.air = true; blip(520, .07); setTimeout(function () { blip(780, .06); }, 50); }

  root.querySelectorAll('[data-pad]').forEach(function (b) {
    var d = b.dataset.pad;
    function on(e) { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); if (d === 'act') action(); else if (d === 'jump') jump(); else keys[d] = true; }
    function off(e) { e.preventDefault(); if (d !== 'act' && d !== 'jump') keys[d] = false; }
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  });

  // drag to orbit
  var el = renderer.domElement;
  function locked() { return document.pointerLockElement === el; }
  el.addEventListener('pointerdown', function (e) {
    if (locked()) { if (running && !dialogOpen) action(); return; }
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
  el.addEventListener('pointerup', function () { if (dragging && dragMoved < 6 && running && !locked()) action(); dragging = false; });
  document.addEventListener('pointerlockchange', function () { root.classList.toggle('is-locked', locked()); });
  el.addEventListener('wheel', function (e) { if (!running) return; e.preventDefault(); camDist = Math.max(6, Math.min(24, camDist + e.deltaY * 0.01)); }, { passive: false });

  dlg.addEventListener('click', function (e) { if (e.target.tagName !== 'A') action(); });
  start.addEventListener('click', begin);
  start.addEventListener('keydown', function (e) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); begin(); } });

  function begin() {
    if (running) return;
    running = true; start.hidden = true; el.focus(); blip(440, .06);
    if (window.Riff && musicWanted) { try { Riff.play('quest'); } catch (e) {} }
  }
  var musicWanted = true;
  var musicBtn = root.querySelector('[data-music]');
  if (musicBtn && window.Riff) { Riff.bind(musicBtn, 'quest'); musicBtn.addEventListener('click', function () { musicWanted = Riff.playing; }); }

  /* ------------------------------------------------------------ audio */
  var AC = null;
  function blip(freq, dur) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = 'square'; o.frequency.value = freq;
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
      if (countFound() === PLACES.length) setTimeout(victory, 1200);
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
  function closeDialog() { dialogOpen = false; dlg.hidden = true; if (typing) { clearInterval(typing); typing = null; } blip(330, .05); }
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
    if (!fp || dialogOpen || fireCool > 0) return;
    fireCool = 0.32; weapon.userData.recoil = 1;
    var d = viewDir().clone(), m = new THREE.Mesh(shotGeo, shotMat);
    m.position.copy(camera.position).add(d.clone().multiplyScalar(0.9)).add(new THREE.Vector3(0.15, -0.15, 0));
    m.castShadow = true; scene.add(m);
    shots.push({ m: m, v: d.multiplyScalar(30), life: 2.2, spin: Math.random() * 6 });
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
      sh.v.y -= 9 * dt; m.position.addScaledVector(sh.v, dt); m.rotation.x += dt * 12; m.rotation.z += dt * 9; sh.life -= dt;
      var gone = sh.life <= 0 || m.position.y < 0.05 || collide(m.position.x, m.position.z, 0.05);
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
    if (fp) {
      notice(current); hits++; drawHearts(); grunt();
      if (hurtEl) { hurtEl.hidden = false; hurtEl.style.transition = 'none'; hurtEl.style.opacity = 1; setTimeout(function () { hurtEl.style.transition = 'opacity .6s ease-out'; hurtEl.style.opacity = 0; }, 90); }
      if (hits >= MAX_HITS) rejected();
    } else openDialog({ kind: 'baddie', obj: current });
    // knockback
    var dx = player.position.x - b.mesh.position.x, dz = player.position.z - b.mesh.position.z, l = Math.hypot(dx, dz) || 1;
    var nx = player.position.x + dx / l * 2.5, nz = player.position.z + dz / l * 2.5;
    if (!collide(nx, nz, 0.5)) player.position.set(nx, 0, nz);
    blip(160, .18); setTimeout(function () { blip(120, .25); }, 150);
  }
  function drawHearts() { if (hudHits) hudHits.textContent = Array(MAX_HITS - hits + 1).join('♥') + Array(hits + 1).join('♡'); }
  function rejected() {
    over = true; overT = 0; dialogOpen = true; dlg.hidden = true; prompt.hidden = true; if (cross) cross.hidden = true; toast.hidden = true;
    if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) {}
    root.classList.add('is-over'); if (overEl) overEl.hidden = false;
    if (window.Riff) Riff.stop();
    // the thud
    blip(70, 1.2, 'sawtooth'); setTimeout(function () { blip(52, 1.6, 'sawtooth'); }, 250);
  }
  function resubmit() {
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
  function updateBaddies(dt) {
    var px = player.position.x, pz = player.position.z, t = clock.elapsedTime;
    BADDIES.forEach(function (b, i) {
      var m = b.mesh;
      if (b.down > 0) { b.down -= dt; if (b.down <= 0) { m.visible = true; m.position.set(b.home.x, 0, b.home.z); b.flee = 0; } return; }
      var dx = px - m.position.x, dz = pz - m.position.z, d = Math.hypot(dx, dz);
      if (b.flee > 0) b.flee -= dt; if (b.cool > 0) b.cool -= dt;
      var speed = 0, ang = b.yaw;
      if (b.flee > 0) { ang = Math.atan2(-dx, -dz); speed = 7; }
      else if (d < 14 + 10 * dread && !dialogOpen) { ang = Math.atan2(dx, dz); speed = d < 1.2 ? 0 : (4.6 + (i % 3) * 0.4) * (1 + 0.5 * dread); if (d < 1.7 && b.cool <= 0 && pstate.y < 1.2) caught(b); }
      else {
        b.wander -= dt;
        if (b.wander <= 0) { b.wander = 2 + rnd() * 3; var hx = b.home.x - m.position.x, hz = b.home.z - m.position.z; b.yaw = Math.hypot(hx, hz) > 16 ? Math.atan2(hx, hz) : rnd() * 6.28; }
        ang = b.yaw; speed = 1.8;
      }
      if (speed > 0) {
        var nx = m.position.x + Math.sin(ang) * speed * dt, nz = m.position.z + Math.cos(ang) * speed * dt;
        if (!collide(nx, m.position.z, 0.5)) m.position.x = nx; else b.yaw = rnd() * 6.28;
        if (!collide(m.position.x, nz, 0.5)) m.position.z = nz; else b.yaw = rnd() * 6.28;
        var cur = m.rotation.y, dd = Math.atan2(Math.sin(ang - cur), Math.cos(ang - cur)); m.rotation.y = cur + dd * Math.min(1, dt * 10);
        b.walkT += dt * speed * 1.6;
      }
      pose(m, { walk: b.walkT, speed: speed / 7 });
      m.position.y = speed > 0 ? Math.abs(Math.sin(b.walkT)) * 0.06 : 0;
    });
  }
  function showToast(msg) { toast.textContent = msg; toast.hidden = false; toastT = 2.6; }
  function victory() {
    dialogOpen = true; dlg.hidden = false; current = { text: 'You found every fact. Title acquired: Senior Research Fellow. There is no tenure in this game either. Go and read the publications.', link: true };
    dlgTitle.textContent = 'ACHIEVEMENT UNLOCKED'; dlgBody.textContent = current.text;
    dlgLink.href = '/publications/'; dlgLink.textContent = 'Publications →'; dlgLink.removeAttribute('target'); dlgLink.hidden = false;
    dlgHint.textContent = 'F / SPACE / TAP TO CLOSE';
    blip(523, .1); setTimeout(function () { blip(659, .1); }, 110); setTimeout(function () { blip(784, .18); }, 220);
  }

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
    if (running && dt > 0) { dread = Math.min(1, dread + dt / DREAD_TIME); if (window.Riff) Riff.setDread(dread); applyDread(t); if (!fp && dread >= FP_AT) enterFP(); }
    if (over) {
      overT += dt;   // slow tilt to the ground, GTA style
      fpPitch = Math.max(-1.1, fpPitch - dt * 0.5); camera.position.y = Math.max(0.6, camera.position.y - dt * 0.9);
      camera.lookAt(camera.position.x - Math.sin(camYaw) * 3, camera.position.y - 1.5, camera.position.z - Math.cos(camYaw) * 3);
      camera.rotation.z += dt * 0.15;
      return;
    }
    if (fp) { fpBlend = Math.min(1, fpBlend + dt / 1.2); updateShots(dt); player.visible = fpBlend < 0.85; weapon.visible = fpBlend >= 1; }
    markers.forEach(function (m, i) { m.rotation.y += dt * 2; m.position.y = 3.6 + Math.sin(t * 3 + i) * 0.25; });
    NPCS.forEach(function (n, i) { n.mesh.position.y = Math.abs(Math.sin(t * 4 + i)) * 0.12; });
    updateBaddies(dt);

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

  var visible = true, vframe = 0, rendered = 0;
  function checkVisible() {
    vframe++;
    var r = root.getBoundingClientRect();
    visible = r.bottom > 0 && r.top < (window.innerHeight || 800);
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, clock.getDelta());
    checkVisible();
    if (!visible && rendered++ > 2) return;
    if (running) update(dt); else { camYaw += dt * 0.15; update(0); }
    renderer.render(scene, camera);
  }
  resize();
  camera.position.set(0, 8, 18);
  loop();
})();
