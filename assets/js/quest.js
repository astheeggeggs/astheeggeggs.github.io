/* =============================================================================
   QUEST.JS — "Palmer's Progress", a 64-bit adventure in the N64 sense.
   Three.js third-person world. WASD / arrows to run, Space to jump, F to talk,
   drag to orbit the camera, Esc closes a sign. Touch pad on mobile.
   The longer you play, the less pleasant it gets. That is intentional.
   Finish it and the ending offers a second loop, MASTER QUEST: the same town
   mirrored left to right, nine faster reviewers who have read version 1 (never
   quite as fast as he is, and they give him a few seconds' start), dread that
   comes sooner, three hearts, no markers over the buildings (a building's door
   and roof sign turn green once it has been read), its own score, a green cap
   from Hyrule on his head, and a different boss at the end of it.
   LOOP / MQ / mx() below decide all that.
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

  /* ------------------------------------------------------------ which loop
     ?loop=2 for one session, else localStorage quest.loop (set by api.startLoop2() from the shooter's first ending).
     Decided before the town exists, because in MASTER QUEST the town is built mirrored: mx() flips every x that is
     placed below (buildings, people, desks, props), so colliders, doors, signs and the reviewers' map all follow. */
  function qp(name, dflt) { var m = location.search.match(new RegExp('[?&]' + name + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : dflt; }
  var LOOP = 1; try { LOOP = parseInt(qp('loop') || localStorage.getItem('quest.loop') || '1', 10); } catch (e) { LOOP = 1; } if (LOOP !== 2) LOOP = 1;
  var MQ = LOOP === 2;
  function mx(x) { return MQ ? -x : x; }

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
  // MASTER QUEST: the same reviewers, having read version 1, plus three more desks; then the whole town flips.
  var DEMANDS2 = [
    'Reviewer 2: "I reviewed this last time. It has not improved."',
    'Reviewer 1: "The authors have addressed none of my concerns, including the ones I did not raise."',
    'Reviewer 3: "Please repeat the analysis in a cohort that does not yet exist."',
    'Reviewer 5: "I was not a reviewer on the first submission. I have concerns about it anyway."',
    'Reviewer 2: "The response to reviewers is longer than the manuscript. Please shorten both."',
    'Reviewer 4: "Minor comment: the entire premise."',
    'Reviewer 6: "Cite my paper. I am aware that you did. Cite it again."',
    'Reviewer 7: "The p-value is now too small. I do not believe it."',
    'Reviewer 8: "I have read Supplementary Note 4. It has not helped."',
    'Reviewer 9: "Reject. I will explain my reasons in my review of the resubmission."',
    'Editor: "We have secured nine reviewers. They have met."'
  ];
  if (MQ) { DEMANDS = DEMANDS2; BADDIES.push({ x: 0, z: -34 }, { x: 46, z: 10 }, { x: -36, z: 36 }); }
  PLACES.forEach(function (p) { p.x = mx(p.x); }); NPCS.forEach(function (n) { n.x = mx(n.x); }); BADDIES.forEach(function (b) { b.x = mx(b.x); });

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
  var dread = parseFloat((location.search.match(/[?&]dread=([\d.]+)/) || [0, 0])[1]) || 0, DREAD_TIME = (MQ ? 57 : 90) / 0.7, FP_AT = 0.7;      // seconds of play until the world is fully wrong (first person at 90 s; 57 s in MASTER QUEST)
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
    g.rotation.x = -Math.PI / 2; g.position.set(mx((rnd() * 2 - 1) * WORLD), 0.01, (rnd() * 2 - 1) * WORLD); g.receiveShadow = true; scene.add(g);
  }

  // roads
  function road(x, z, w, d) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), flat(0xcbb47e));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true; scene.add(m);
  }
  road(0, -10, 90, 4); road(0, 10, 90, 4); road(0, 0, 4, 24); road(mx(-40), 0, 4, 24); road(mx(40), 0, 4, 24);
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
    hill.scale.y = 0.6 + rnd() * 0.6; hill.position.set(mx(Math.cos(a) * R), -2, Math.sin(a) * R); hill.castShadow = true; scene.add(hill);
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
    var tx = mx((rnd() * 2 - 1) * WORLD), tz = (rnd() * 2 - 1) * WORLD;
    if (!blocked(tx, tz, 2.5)) tree(tx, tz);
  }
  // flowers
  var flowerGeo = new THREE.SphereGeometry(0.18, 8, 6), stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5);
  var flowerMats = [fade(flat(0xf5e663), 0x3a2a10), fade(flat(0xf78fb3), 0x3a1018), fade(flat(0xffffff), 0x2a2020), fade(flat(0x8ad4ff), 0x1a1a2a), fade(flat(0xfb7185), 0x3a0a10)];
  var stemMat = flat(0x2f7d4a);
  for (i = 0; i < 260; i++) {
    tx = mx((rnd() * 2 - 1) * WORLD); tz = (rnd() * 2 - 1) * WORLD;
    if (blocked(tx, tz, 1)) continue;
    var fl = new THREE.Group();
    var st = new THREE.Mesh(stemGeo, stemMat); st.position.y = 0.2; fl.add(st);
    var f = new THREE.Mesh(flowerGeo, flowerMats[i % 5]); f.position.y = 0.42; fl.add(f);
    fl.position.set(tx, 0, tz); fl.rotation.y = rnd(); scene.add(fl);
  }
  // rocks
  var rockGeo = new THREE.DodecahedronGeometry(0.6, 1), rockMat = flat(0x8b8f9a);
  for (i = 0; i < 40; i++) {
    tx = mx((rnd() * 2 - 1) * WORLD); tz = (rnd() * 2 - 1) * WORLD;
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
    var arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), postMat); arm.position.set(mx(0.3), 3.1, 0); g.add(arm);
    var la = new THREE.Mesh(lampGeo, lampMat); la.position.set(mx(0.62), 3.0, 0); g.add(la);
    g.position.set(x, 0, z); scene.add(g); colliders.push({ x: x, z: z, r: 0.25 });
  }
  for (i = -36; i <= 36; i += 12) { lamp(mx(i), -13); lamp(mx(i), 13); }
  // benches
  var benchSeat = new THREE.BoxGeometry(1.8, 0.1, 0.5), benchLeg = new THREE.BoxGeometry(0.1, 0.45, 0.45), woodMat = flat(0x8a5a2b);
  function bench(x, z, rot) {
    var g = new THREE.Group();
    var seat = new THREE.Mesh(benchSeat, woodMat); seat.position.y = 0.5; seat.castShadow = true; g.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), woodMat); back.position.set(0, 0.78, -0.22); g.add(back);
    [-0.8, 0.8].forEach(function (lx) { var l = new THREE.Mesh(benchLeg, postMat); l.position.set(lx, 0.25, 0); g.add(l); });
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); colliders.push({ x: x, z: z, r: 0.9 });
  }
  bench(mx(-6), -7, 0); bench(mx(6), -7, 0); bench(mx(-6), 7, Math.PI); bench(mx(6), 7, Math.PI);
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
    cg.position.set(mx((rnd() * 2 - 1) * 90), 28 + rnd() * 10, (rnd() * 2 - 1) * 90); cg.userData.v = 0.4 + rnd() * 0.6; scene.add(cg); clouds.push(cg);
  }

  /* ------------------------------------------------------------ signs */
  function labelTex(text, bg, fg) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 96;
    var x = c.getContext('2d');
    x.fillStyle = '#1a1d26'; x.fillRect(0, 0, 512, 96);
    x.fillStyle = bg; x.fillRect(6, 6, 500, 84);
    x.fillStyle = fg; x.font = 'bold 40px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 52);
    var tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }
  function labelSprite(text, bg, fg) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, bg, fg), depthTest: true }));
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
    var chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), flat(0x6b5a4a)); chimney.position.set(mx(p.w * 0.3), p.h + 1.0, -p.d * 0.2); chimney.castShadow = true; grp.add(chimney);
    // plinth and steps
    var plinth = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.6, 0.3, p.d + 0.6), flat(0x9aa0ad)); plinth.position.y = 0.15; plinth.receiveShadow = true; grp.add(plinth);
    var steps = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 1.2), flat(0xb8bcc8)); steps.position.set(0, 0.1, p.d / 2 + 0.8); steps.receiveShadow = true; grp.add(steps);
    // door with frame, on the +z face
    var frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.7, 0.35), flat(0xf4f6fb)); frame.position.set(0, 1.35, p.d / 2 + 0.05); grp.add(frame);
    var door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.3), flat(0x1a1d26)); door.position.set(0, 1.2, p.d / 2 + 0.12); grp.add(door);
    var knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), flat(0xfcd34d)); knob.position.set(mx(0.55), 1.2, p.d / 2 + 0.3); grp.add(knob);
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
    p.group = grp; p.sign = sign; p.doorMesh = door; p.collider = { x: p.x, z: p.z, hw: p.w / 2 + 0.4, hd: p.d / 2 + 0.4 }; p.bushes = [];
    colliders.push(p.collider);
    p.door = { x: p.x, z: p.z + p.d / 2 + 1.6 };
    [-1, 1].forEach(function (sd) { var bsh = new THREE.Mesh(bushGeo, bushMat); bsh.position.set(p.x + sd * 1.9, 0.45, p.z + p.d / 2 + 0.6); bsh.scale.set(1, 0.8, 1); bsh.castShadow = true; scene.add(bsh); p.bushes.push(bsh); });
    // marker (MASTER QUEST hides them: the signs stay, so the player has to read the town)
    var mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0xfcd34d, emissive: 0xfcd34d, emissiveIntensity: 0.5 }));
    mk.position.set(p.door.x, 3.6, p.door.z - 1.0); mk.castShadow = true; mk.visible = !MQ; scene.add(mk);
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
  // Two weapons live in the same group and take turns: the crumpled rebuttal, and the thing the emeritus
  // professor keeps in the rubble. api.setWeapon({kind}) swaps them; WPOSE holds each one's hold and recoil.
  var wPaper = new THREE.Group(), wBfg = new THREE.Group();
  weapon.add(wPaper); weapon.add(wBfg); wBfg.visible = false;
  var bfgGlowMat = null, bfgHalo = null, bfgLamp = null;
  var WPOSE = {
    paper: { x: 0.3, y: -0.16, z: -0.62, s: 0.42, rx: 0, ry: 0, ky: 0.07, kz: 0.15, krot: 0.6, bob: 1, tight: 0 },
    // The BFG is only ever seen from one angle - stood in the rubble, pitched up at the badge - and at the old
    // +0.11 rad it presented its top rail and read as a pale olive board. Nose well up and canted across the
    // view instead: the barrel runs up out of the bottom-right corner and ends in the muzzle block, which is
    // the thing the eye lands on.
    bfg:   { x: 0.20, y: -0.28, z: -0.84, s: 0.215, rx: 0.44, ry: 0.28, ky: 0.06, kz: 0.24, krot: 0.8, bob: 0.5, tight: 1 }
  };
  (function () {
    var lit = function (c) { return new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.45 }); };
    var hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.3), lit(0xf6d3b0)); hand.position.set(0, -0.08, 0.05); wPaper.add(hand);
    var sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.35), lit(0x6f7787)); sleeve.position.set(0, -0.12, 0.32); wPaper.add(sleeve);
    var paper = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.02), lit(0xf4f6fb)); paper.position.set(0.02, 0.2, -0.1); paper.rotation.x = -0.25; wPaper.add(paper);
    for (var k = 0; k < 6; k++) { var ln = new THREE.Mesh(new THREE.BoxGeometry(0.22 - (k % 2) * 0.06, 0.02, 0.005), lit(k ? 0x9aa3b8 : 0xb91c1c)); ln.position.set(0.0, 0.15 - k * 0.055, 0.013); paper.add(ln); }
    weapon.scale.set(0.42, 0.42, 0.42);
    weapon.position.set(0.3, -0.16, -0.62);
  })();
  // THE BFG: a green-grey box cannon, both hands on it, a wide muzzle and an aperture that lights up as it winds.
  (function () {
    // held up against a first-person view, a Lambert box is whatever the sky happens to be: self-lit, like the
    // paper ball, so the thing reads the same in a red dread sky as it does in space.
    var lit = function (c) { var m = new THREE.MeshLambertMaterial({ color: c }); m.emissive = new THREE.Color(c); m.emissiveIntensity = 0.62; return m; };
    function box(w, h, d, mat, x, y, z, p) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); (p || wBfg).add(m); return m; }
    var shell = lit(0x7c8c6e), shell2 = lit(0x566349), trim = lit(0xa9b69f), dark = lit(0x2b3327);
    var skin = lit(0xf6d3b0), cuff = lit(0x6f7787), copper = lit(0xc08a46);
    box(0.78, 0.6, 1.9, shell, 0, -0.04, -0.1);                                   // receiver
    box(0.9, 0.16, 1.2, shell2, 0, 0.28, -0.22);                                  // hump along the top
    // Ribs, not stripes. At y 0.3 the vents were buried inside the hump, which is why the whole top of the gun
    // came out as one unbroken pale board from the only angle anybody looks at it. They stand proud of it now.
    var v; for (v = 0; v < 5; v++) box(1.04, 0.16, 0.1, dark, 0, 0.38, -0.62 + v * 0.2);   // vents
    for (v = -1; v <= 1; v += 2) { box(0.1, 0.5, 0.86, shell2, v * 0.46, -0.02, -0.28); box(0.14, 0.14, 1.1, copper, v * 0.44, 0.16, 0.18); }  // fins and cooling pipes
    box(1.12, 0.92, 0.5, shell, 0, -0.02, -1.22);                                 // the muzzle block: deliberately too big
    box(1.2, 0.14, 0.56, trim, 0, 0.44, -1.22); box(1.2, 0.14, 0.56, trim, 0, -0.48, -1.22);
    for (v = -1; v <= 1; v += 2) box(0.16, 0.7, 0.56, trim, v * 0.56, -0.02, -1.22);
    box(0.62, 0.62, 0.1, dark, 0, -0.02, -1.44);                                  // aperture recess
    // one shared glow material: the muzzle aperture (which the player never sees), a strip down the vents and
    // the core at the back of the receiver (which he sees the whole time). All three brighten as it winds up.
    bfgGlowMat = new THREE.MeshBasicMaterial({ color: 0x2f6b3f, fog: false });
    box(0.46, 0.46, 0.06, bfgGlowMat, 0, -0.02, -1.49);
    // The business end, stacked so it reads from BEHIND - the only place the man holding it stands. Nearest
    // him a pale lip, then a glowing collar a finger's width proud of it, then the muzzle block itself: a
    // bright rim, a green rim, and a fat block, which is what a cannon looks like from the wrong end.
    box(1.24, 1.04, 0.07, trim, 0, -0.02, -1.0);
    box(1.34, 1.14, 0.06, bfgGlowMat, 0, -0.02, -0.93);
    box(0.3, 0.1, 1.06, bfgGlowMat, 0, 0.44, -0.22);                              // the lit seam down the spine
    box(0.36, 0.36, 0.06, bfgGlowMat, 0, -0.04, 1.29);                            // the core, facing the player
    bfgHalo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ color: 0x5cff8a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    bfgHalo.position.set(0, -0.02, -0.86); wBfg.add(bfgHalo);   // behind the collar, where it can be seen
    box(0.5, 0.52, 0.44, shell2, 0, -0.04, 0.96); box(0.42, 0.42, 0.16, copper, 0, -0.04, 1.22);   // battery pack at the back
    box(0.26, 0.42, 0.3, dark, 0.02, -0.5, 0.42);                                 // pistol grip
    box(0.22, 0.2, 0.28, skin, 0.02, -0.72, 0.42); box(0.26, 0.24, 0.34, cuff, 0.02, -0.78, 0.7);        // right hand on the grip
    box(0.24, 0.22, 0.3, skin, -0.48, -0.42, -0.62); box(0.28, 0.26, 0.36, cuff, -0.56, -0.5, -0.36);    // left hand under the barrel
    box(0.2, 0.3, 0.26, dark, -0.48, -0.24, -0.62);                               // the foregrip it is holding
    bfgLamp = new THREE.PointLight(0x4dff8a, 0, 6, 2); bfgLamp.position.set(0, -0.02, -1.7); wBfg.add(bfgLamp);
  })();
  var shotGeo = new THREE.IcosahedronGeometry(0.13, 0), shotMat = new THREE.MeshLambertMaterial({ color: 0xf4f6fb, emissive: 0xf4f6fb, emissiveIntensity: 0.5 });
  // the plasma ball: fat, slow, expensive-looking. One shared geometry/material set, three meshes per shot.
  var bfgGeo = new THREE.IcosahedronGeometry(0.5, 1), bfgMat = new THREE.MeshBasicMaterial({ color: 0xcaffd8, fog: false });
  var bfgSkinGeo = new THREE.IcosahedronGeometry(0.72, 1), bfgSkinMat = new THREE.MeshBasicMaterial({ color: 0x3dff7a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  var bfgAuraGeo = new THREE.IcosahedronGeometry(1.0, 0), bfgAuraMat = new THREE.MeshBasicMaterial({ color: 0x18d95a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  // One PointLight for every plasma ball there will ever be. A light per shot swung the scene's light count
  // between one and four, and three.js recompiles every material the first time it sees each count, so the
  // opening shots of the fight each cost a stutter. This one is made once, when the gun arrives, and follows
  // whichever ball is newest.
  var plasmaLamp = null;
  function plasmaLight() {
    if (!plasmaLamp) { plasmaLamp = new THREE.PointLight(0x3dff7a, 0, 30, 1.8); plasmaLamp.position.set(0, -60, 0); scene.add(plasmaLamp); }
    return plasmaLamp;
  }
  var sparkGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2), sparkMat = new THREE.MeshBasicMaterial({ color: 0x7dff9e, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  var sparks = [], sparkPool = [], SPARK_CAP = 70;
  var player = boxMan({});
  player.position.set(0, 0, 4);
  scene.add(player);
  // MASTER QUEST: he has been here before, so he dresses for it. A green cap from Hyrule: a band over the hair, a
  // crown, then three shrinking boxes and a tip, each hung off the end of the last so the whole thing flops back
  // and down off his head. It streams out behind when he runs and flips over when he jumps (capFlop, in update).
  // Loop 1 never builds it. In first person the camera ends up inside his head, so it goes before the lens reaches it.
  var cap = null;
  if (MQ) (function () {
    var green = flat(0x43a047), deep = flat(0x2e7d32);
    function box(w, h, d, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
    var base = new THREE.Group(); base.position.set(0, 2.84, 0); player.add(base);          // the top of his hair
    box(0.94, 0.18, 0.84, deep, 0, 0.05, -0.06, base);                                      // band: the fringe still shows in front
    box(0.8, 0.2, 0.66, green, 0, 0.22, -0.12, base);                                       // crown
    var joints = [], parent = base, LEN = [0.44, 0.38, 0.32, 0.24], SIZE = [[0.66, 0.24], [0.5, 0.2], [0.36, 0.16], [0.2, 0.12]];
    var REST = [0.12, -0.42, -0.5, -0.45], LEAN = [0, 0.3, 0.22, 0.14];                     // radians about x (+ lifts, - droops), and a lean to his left
    for (var k = 0; k < 4; k++) {
      var j = new THREE.Group();
      if (k) j.position.set(0, 0, -LEN[k - 1] + 0.04); else j.position.set(0, 0.24, -0.34);
      j.rotation.x = REST[k]; j.rotation.y = LEAN[k]; parent.add(j);
      box(SIZE[k][0], SIZE[k][1], LEN[k], k % 2 ? deep : green, 0, 0, -LEN[k] / 2, j);
      joints.push(j); parent = j;
    }
    cap = { base: base, joints: joints, rest: REST, share: [0.35, 0.8, 0.9, 0.7], at: new THREE.Vector3() };
  })();
  function capFlop(dt) {
    var run = Math.min(1, pstate.speed / 9), k = Math.min(1, dt * 9), sw = Math.sin(pstate.walkT) * run, i, j;
    var lift = run * 0.42 - (pstate.air ? pstate.vy * 0.035 : 0);        // running: out behind him; going up: it lags and flops; coming down: it rises
    lift = Math.max(-0.6, Math.min(0.9, lift));
    for (i = 0; i < cap.joints.length; i++) { j = cap.joints[i]; j.rotation.x += (cap.rest[i] + lift * cap.share[i] - j.rotation.x) * k; }
    cap.joints[0].rotation.y += (sw * 0.22 - cap.joints[0].rotation.y) * k;                // swings with his stride
    cap.joints[2].rotation.z += (-sw * 0.16 - cap.joints[2].rotation.z) * k;
  }
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
    b.esc = 0; b.ex = b.x; b.ez = b.z; b.goHome = false; b.homeSerial = -1; b.moved = 0;   // b.homeField is allocated with the other nav arrays, below
  });

  /* ------------------------------------------------------------ state */
  var found = {};
  var revisions = 0, rebuttals = 0;
  var hudRev = root.querySelector('[data-hud="revisions"]');
  try { found = JSON.parse(localStorage.getItem('quest.found') || '{}') || {}; } catch (e) { found = {}; }
  hudTotal.textContent = PLACES.length;
  if (MQ) {
    // The gold pill: this is the second loop, and the town knows it. Anyone here has finished the game once and knows
    // the keys, so the pill takes the keys pill's place. It stays only while the HUD still fits on one row: the moment
    // anything would wrap (a phone, a narrow window, the hearts arriving in first person, double-digit counters) mqFit()
    // swaps it for a gold MQ sticker on the FACTS pill's corner, out of the text flow. Toasts shrink to their text and
    // hang just below the HUD, however tall it has become; with the d-pad on screen they move right, clear of the pad,
    // in a smaller font. The fights place their own toasts (.qb-on / .qm-on), so these rules stand aside for them.
    root.classList.add('is-mq');
    var mqStyle = document.createElement('style');
    mqStyle.textContent = '.quest.is-mq .q-hud .q-keys{display:none}' +
      '.quest.is-mq .q-hud .q-loop{background:#fcd34d;color:#1a1d26;border-color:#1a1d26;text-shadow:none;white-space:nowrap}' +
      '.quest.is-mq .q-hud > .q-pill:first-child{position:relative}' +
      '.quest.is-mq .q-loop-tag{display:none;position:absolute;left:.55rem;top:-.62rem;font-size:.5rem;line-height:1;padding:.18rem .3rem;background:#fcd34d;color:#1a1d26;border:2px solid #1a1d26;box-shadow:2px 2px 0 #000;text-shadow:none}' +
      '.quest.is-mq-tight .q-hud .q-loop{display:none}.quest.is-mq-tight .q-loop-tag{display:block}' +
      '.quest.is-mq:not(.qm-on):not(.qb-on) .q-toast{top:var(--mq-toast-top,3.4rem);width:max-content;max-width:min(86%,44ch);text-align:center;line-height:1.6}' +
      // With the pad showing (the same breakpoint as the pad in swank.css) the HUD drops to the pixel font's native 8 px, so
      // FACTS takes two lines of a phone's 4:3 view rather than three, and a toast sits in the column between the pad
      // (.9rem + 3 x 44 px + gaps = 156 px) and the crosshair on one side and the edge on the other, above B and A.
      '@media (max-width:700px){.quest.is-mq .q-hud .q-pill{font-size:.5rem;padding:.4rem .55rem}.quest.is-mq .q-loop-tag{top:-.8rem}' +
      '.quest.is-mq:not(.qm-on):not(.qb-on) .q-toast{left:auto;right:.6rem;transform:none;max-width:min(100% - 11rem,50% - 1.5rem);font-size:.5rem;line-height:1.5;padding:.4rem .5rem}}';
    document.head.appendChild(mqStyle);
    var mqPill = document.createElement('span'); mqPill.className = 'q-pill q-loop'; mqPill.textContent = 'LOOP 2 \u00b7 MASTER QUEST';
    var mqHud = root.querySelector('.q-hud'), mqFirst = mqHud && mqHud.querySelector('.q-pill');
    if (mqHud) mqHud.insertBefore(mqPill, mqFirst ? mqFirst.nextSibling : null);
    if (mqFirst) { var mqTag = document.createElement('span'); mqTag.className = 'q-loop-tag'; mqTag.textContent = 'MQ'; mqFirst.insertBefore(mqTag, mqFirst.firstChild); }
    window.addEventListener('resize', function () {                // a wider window may have room again (a phone's URL bar
      if (!mqHud || mqHud.offsetWidth === mqW) return;                // changing only the height fires this too: nothing to redo)
      mqW = mqHud.offsetWidth; mqTight = false; root.classList.remove('is-mq-tight'); mqFit();
    });
  }
  // Asked a few times a second from update() and on every toast. Reads layout only (plus one class and one custom
  // property when they change). The HUD is display:none in the cave and the shooter: nothing to measure then.
  var mqTight = false, mqTop = -1, mqTick = 0, mqW = -1;
  function mqFit() {
    if (!MQ || !mqHud || !mqPill || !mqHud.offsetHeight) return;
    if (!mqTight && mqPill.offsetHeight && mqHud.offsetHeight > mqPill.offsetHeight + 4) { mqTight = true; root.classList.add('is-mq-tight'); }
    var top = mqHud.offsetTop + mqHud.offsetHeight + 6;
    if (top !== mqTop) { mqTop = top; root.style.setProperty('--mq-toast-top', top + 'px'); }
  }
  function countFound() { return PLACES.filter(function (p) { return found[p.id]; }).length; }
  function updateHud() {
    hudFound.textContent = countFound();
    PLACES.forEach(function (p) {
      p.marker.material.color.set(found[p.id] ? 0x34d399 : 0xfcd34d); p.marker.material.emissive.set(found[p.id] ? 0x34d399 : 0xfcd34d);
      // MASTER QUEST has no markers, so a building that has been read says so itself, in the found green: its door (seen
      // walking up to it) and its roof sign (seen across town, and in first person)
      if (MQ && found[p.id] && !p.signRead) {
        p.signRead = true; p.doorMesh.material.color.setHex(0x2fae7a);
        var old = p.sign.material.map; p.sign.material.map = labelTex(p.short, '#34d399', '#1a1d26'); if (old) old.dispose();
      }
    });
  }
  updateHud();

  var running = false, dialogOpen = false, typing = null, toastT = 0, clock = new THREE.Clock();
  var keys = {};
  var camYaw = 0, camPitch = 0.52, camDist = 14, dragging = false, lastPX = 0, lastPY = 0, dragMoved = 0;
  var HEARTS = MQ ? 3 : 5;                             // three in MASTER QUEST; ?maxhits= overrides, the fountain's prize adds on top
  var fp = false, fpBlend = 0, fpPitch = 0, fireCool = 0, shots = [], accepted = 0, hits = 0, MAX_HITS = parseInt((location.search.match(/[?&]maxhits=(\d+)/) || [0, HEARTS])[1], 10) || HEARTS, over = false, overT = 0;
  var hurtEl = root.querySelector('.q-hurt'), overEl = root.querySelector('.q-over'), hudHits = root.querySelector('[data-hud="hits"]'), hudHitsWrap = root.querySelector('.q-hits');
  var hudAcc = root.querySelector('[data-hud="accepted"]'), cross = root.querySelector('.q-cross');
  // ---- endgame state + test hooks (?endgame=1 ?bosshp=5 ?skipintro=1 ?god=1 ?shmup=1 ?timescale=4 ?loop=2)
  var PARAMS = { endgame: qp('endgame') === '1', bossHp: parseInt(qp('bosshp', '100'), 10) || 100, skipIntro: qp('skipintro') === '1', god: qp('god') === '1', shmup: qp('shmup') === '1', cave: qp('cave') === '1', timescale: Math.max(0.1, Math.min(20, parseFloat(qp('timescale', '1')) || 1)), loop: LOOP };
  var endgame = false, pendingEndgame = false, boss = null, shmup = null;
  // the fountain hides a secret level; its prize is extra hearts for the boss
  var cave = null, caveOn = false, caveTaken = false, caveArmed = false;
  try { var cvSave = JSON.parse(localStorage.getItem('quest.cave') || 'null'); if (cvSave && cvSave.hearts > 0) { caveTaken = true; MAX_HITS += cvSave.hearts | 0; } } catch (e) {}
  var fireRate = 0.32, shotSpeed = 30, shotGrav = 9, fireHeld = false, hurtCool = 0, envLocked = false, hudOn = true, shakeAmp = 0, shakeT = 0, shakeDur = 1;
  // MASTER QUEST fairness. The reviewers are quicker, but never quicker than he is (9 u/s): on open ground he can always
  // outrun any one of them. And after PRESS START or a resubmission they stay at their desks for a few seconds, so
  // nobody is caught while reading the toast (the nearest mirrored desk is 11 units from the spawn). Loop 1: neither.
  // The orbit camera starts (and restarts after REJECTED!) at MQ_YAW, a little round to his right: at yaw 0 it sits
  // against the mirrored Library's eave, which then filled the lower half of the view.
  var MQ_TOP = 8.5, MQ_GRACE = 6, graceT = 0, MQ_YAW = -0.5;

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
  // the title sequence gets first refusal on the overlay: insert coin, skip the cinematic, then start
  function startPress() {
    if (intro && intro.active) { try { if (intro.click()) return; } catch (e) { console.error(e); } }
    begin();
  }
  start.addEventListener('click', startPress);
  start.addEventListener('keydown', function (e) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); startPress(); } });

  function begin() {
    if (running) return;
    running = true; start.hidden = true; el.focus(); blip(440, .06);
    music('quest');
    if (MQ) { graceT = MQ_GRACE; camYaw = MQ_YAW; showToast('MASTER QUEST. THE TOWN IS MIRRORED.', 3.5, ['THE REVIEWERS HAVE READ VERSION 1.', 3.5]); }
    if (PARAMS.cave) { caveArmed = true; setTimeout(enterCave, 300); return; }
    if (PARAMS.shmup) { setTimeout(launchShmup, 300); return; }
    if (PARAMS.endgame) { setTimeout(startEndgame, 300); return; }
    // a returning player who already holds every fact goes straight to the reckoning
    if (countFound() === PLACES.length) { showToast('ALL FACTS FOUND. SOMETHING IS COMING.'); setTimeout(function () { if (!endgame && !over) startEndgame(); }, 3500); }
  }
  var musicWanted = true;
  var musicBtn = root.querySelector('[data-music]');
  if (musicBtn && window.Riff) { Riff.bind(musicBtn, 'quest'); musicBtn.addEventListener('click', function () { musicWanted = Riff.playing; }); if (LOOP === 2 && Riff.has && Riff.has('quest2') && Riff.cue) Riff.cue('quest2'); }

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
    if (!running) { startPress(); return; }
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
  /* ---- the BFG: kind switching, the wind-up, and the plasma ball -------------------------------- */
  var weaponKind = 'paper', bfgCharge = -1, paperBallistics = null, BFG_WIND = 0.3;
  function setWeaponKind(kind) {
    kind = kind === 'bfg' ? 'bfg' : 'paper';
    bfgCharge = -1;                       // any weapon call cancels a half-finished wind-up
    if (kind === weaponKind) return;
    // remember the ballistics the paper ball was using, so kind:'paper' puts everything back exactly
    if (kind === 'bfg') paperBallistics = { rate: fireRate, speed: shotSpeed, gravity: shotGrav };
    else if (paperBallistics) { fireRate = paperBallistics.rate; shotSpeed = paperBallistics.speed; shotGrav = paperBallistics.gravity; paperBallistics = null; }
    weaponKind = kind; bfgCharge = -1; weapon.userData.recoil = 0;
    if (kind === 'bfg') plasmaLight(); else if (plasmaLamp) plasmaLamp.intensity = 0;
    wPaper.visible = kind === 'paper'; wBfg.visible = kind === 'bfg';
    if (bfgHalo) bfgHalo.material.opacity = 0;
    if (bfgLamp) bfgLamp.intensity = 0;
    if (bfgGlowMat) bfgGlowMat.color.setHex(0x2f6b3f);
  }
  function bfgTone(f0, f1, dur, type, gain, delay) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sawtooth'; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.05, dur * 0.4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function bfgSpark(x, y, z, sp, life) {
    var s = sparkPool.pop();
    if (!s) { if (sparks.length >= SPARK_CAP) return; s = { m: new THREE.Mesh(sparkGeo, sparkMat) }; }
    s.m.position.set(x, y, z); s.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    s.vx = (Math.random() - 0.5) * sp; s.vy = (Math.random() - 0.5) * sp; s.vz = (Math.random() - 0.5) * sp;
    s.life = s.max = life; s.s0 = 0.4 + Math.random() * 0.7;
    s.m.scale.setScalar(s.s0); if (!s.m.parent) scene.add(s.m); sparks.push(s);
  }
  function bfgBurst(x, y, z, n, sp, life) { for (var i = 0; i < n; i++) bfgSpark(x, y, z, sp, life); }
  function sparkStep(dt) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i]; s.life -= dt;
      if (s.life <= 0) { scene.remove(s.m); sparks.splice(i, 1); sparkPool.push(s); continue; }
      s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
      s.m.rotation.x += dt * 5; s.m.rotation.y += dt * 4;
      s.m.scale.setScalar(Math.max(0.001, s.s0 * (s.life / s.max)));
    }
  }
  function fireBfg() {
    fireCool = fireRate; weapon.userData.recoil = 1;
    var d = viewDir().clone(), m = new THREE.Mesh(bfgGeo, bfgMat);
    m.position.copy(camera.position).add(d.clone().multiplyScalar(2.4)).add(new THREE.Vector3(0, -0.28, 0));
    m.add(new THREE.Mesh(bfgSkinGeo, bfgSkinMat)); m.add(new THREE.Mesh(bfgAuraGeo, bfgAuraMat));
    plasmaLight();
    scene.add(m);
    shots.push({ m: m, v: d.multiplyScalar(shotSpeed), life: 3.6, spin: 1.5, prev: m.position.clone(), bfg: true, trail: 0 });
    bfgBurst(m.position.x, m.position.y, m.position.z, 8, 7, 0.35);
    bfgTone(180, 46, 0.55, 'sawtooth', 0.1); bfgTone(74, 30, 0.9, 'square', 0.07); bfgTone(1500, 320, 0.18, 'triangle', 0.05);
    shakeAmp = 0.42; shakeT = shakeDur = 0.22;
  }
  function fire() {
    if (!fp || dialogOpen || fireCool > 0 || over || !hudOn) return;
    if (weaponKind === 'bfg') {                       // heavy, deliberate: it winds up first and goes off by itself
      if (bfgCharge < 0) { bfgCharge = 0; bfgTone(120, 900, BFG_WIND, 'sawtooth', 0.055); bfgTone(300, 1800, BFG_WIND, 'square', 0.02); }
      return;
    }
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
      b.down = MQ ? 12 : 22; b.hp = 2; m.visible = false; blip(523, .1); setTimeout(function () { blip(784, .18); }, 100);   // retired for a while; less of a while in loop 2
    } else { showToast('REVIEWER ' + (BADDIES.indexOf(b) + 1) + ': "I REMAIN UNCONVINCED"'); blip(660, .08); }
  }
  function updateShots(dt) {
    for (var i = shots.length - 1; i >= 0; i--) {
      var sh = shots[i], m = sh.m;
      sh.prev.copy(m.position);
      sh.v.y -= shotGrav * dt; m.position.addScaledVector(sh.v, dt); m.rotation.x += dt * 12; m.rotation.z += dt * 9; sh.life -= dt;
      // the editor is down, or the blast-off has the screen: a plasma ball must not go on glowing through it
      var gone = !!(boss && boss.active && (boss.ended || boss.cinematic));
      if (!gone && boss && boss.active) { try { if (boss.hitTest(m.position, sh.prev, sh.bfg ? 'bfg' : 'paper')) gone = true; } catch (err) { console.error(err); } }   // the boss module applies its own damage and feedback
      gone = gone || sh.life <= 0 || m.position.y < 0.05 || collide(m.position.x, m.position.z, 0.05);
      if (!gone && sh.bfg) {                     // the plasma ball trails sparks and lights what it passes
        sh.trail += dt;
        while (sh.trail > 0.035) { sh.trail -= 0.035; bfgSpark(m.position.x + (Math.random() - 0.5) * 0.5, m.position.y + (Math.random() - 0.5) * 0.5, m.position.z + (Math.random() - 0.5) * 0.5, 2.5, 0.45); }
        var grow = Math.min(1, (3.6 - sh.life) / 0.14);      // swells out of the muzzle instead of filling the view
        m.scale.setScalar((0.3 + 0.7 * grow) * (1 + Math.sin(sh.life * 26) * 0.07));
      }
      if (!gone) {
        for (var k = 0; k < BADDIES.length; k++) { var b = BADDIES[k]; if (b.down > 0) continue; var bp = b.mesh.position; if (Math.hypot(m.position.x - bp.x, m.position.z - bp.z) < (sh.bfg ? 1.8 : 1.0) && m.position.y > 0 && m.position.y < 3.2) { shotHit(b); gone = true; break; } }
        if (!gone) for (k = 0; k < NPCS.length; k++) { var n = NPCS[k]; if (Math.hypot(m.position.x - n.x, m.position.z - n.z) < 1.0 && m.position.y < 3.2) { showToast('THAT WAS A COLLEAGUE'); blip(200, .1); gone = true; break; } }
      }
      if (gone) {
        if (sh.bfg) { bfgBurst(m.position.x, m.position.y, m.position.z, 12, 11, 0.5); bfgTone(140, 40, 0.4, 'square', 0.06); }
        scene.remove(m); shots.splice(i, 1);
      }
    }
    // the shared plasma light rides the newest ball in flight, and goes out when there is none
    if (plasmaLamp) {
      var newest = null;
      for (var q = shots.length - 1; q >= 0; q--) if (shots[q].bfg) { newest = shots[q]; break; }
      if (newest) { plasmaLamp.position.copy(newest.m.position); plasmaLamp.intensity = 3.6 + Math.sin(newest.life * 40) * 0.8; }
      else plasmaLamp.intensity = 0;
    }
    sparkStep(dt);
    if (fireCool > 0) fireCool -= dt;
    // the BFG wind-up: F starts it, it goes off on its own a beat later whether or not you are still holding
    if (bfgCharge >= 0) {
      if (weaponKind !== 'bfg' || over || !fp || !hudOn || dialogOpen) bfgCharge = -1;
      else { bfgCharge += dt; if (bfgCharge >= BFG_WIND) { bfgCharge = -1; fireBfg(); } }
    }
    // weapon bob + recoil
    var r = weapon.userData.recoil || 0; if (r > 0) weapon.userData.recoil = r = Math.max(0, r - dt * (weaponKind === 'bfg' ? 2.6 : 5));
    var W = WPOSE[weaponKind] || WPOSE.paper, sway = Math.min(1, pstate.speed / 9) * W.bob;
    var tight = W.tight && (camera.aspect || 1.78) < 1.5 ? 1 : 0;   // a 4:3 phone view: hold the BFG smaller and further off
    weapon.scale.setScalar(W.s * (tight ? 0.8 : 1));
    weapon.position.set(W.x + Math.sin(pstate.walkT) * 0.02 * sway, W.y + Math.abs(Math.cos(pstate.walkT)) * 0.025 * sway + r * W.ky, W.z - tight * 0.1 + r * W.kz);
    weapon.rotation.set(W.rx - r * W.krot, W.ry, 0);
    if (weaponKind === 'bfg') {                              // the core and the vents brighten through the wind-up
      var ch = bfgCharge >= 0 ? Math.min(1, bfgCharge / BFG_WIND) : Math.max(0, r - 0.55) * 2.2;
      // it idles lit, not dark: the collar round the muzzle block is the one piece of the aperture the man
      // holding it can see, and at the old floor it read as paint rather than as something switched on
      var g2 = Math.max(0.38 + 0.09 * Math.sin(clock.elapsedTime * 3), ch);
      if (bfgGlowMat) bfgGlowMat.color.setRGB(0.18 + 0.8 * g2 * g2, 0.35 + 0.65 * g2, 0.22 + 0.5 * g2 * g2);
      if (bfgHalo) { bfgHalo.material.opacity = 0.3 + 0.7 * ch; bfgHalo.scale.setScalar(0.95 + ch * 0.85); }
      if (bfgLamp) bfgLamp.intensity = 0.35 + 5 * ch;
    }
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
    player.position.set(0, 0, 4); pstate.yaw = 0; pstate.y = 0; pstate.vy = 0; pstate.air = false; camYaw = MQ ? MQ_YAW : 0; camPitch = 0.52;
    caveArmed = false;                                   // he respawns inside the fountain's trigger: walk away first, as after PRESS START
    shots.forEach(function (sh) { scene.remove(sh.m); }); shots.length = 0;
    BADDIES.forEach(function (b) { b.mesh.visible = true; b.mesh.position.set(b.home.x, 0, b.home.z); b.flee = 0; b.cool = 3; b.down = 0; b.hp = 2; });
    if (MQ) graceT = MQ_GRACE;
    if (window.Riff) { Riff.setDread(0); Riff.takeover(false); music('quest'); }
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
     - navCell  : a 1-unit grid over the playable square (0 wide open, 1 walkable, 2 blocked), stamped from the
                  collider list (a fraction of a millisecond) the first frame anybody walks, and again whenever
                  colliders.length changes (the boss flattens the town).
     - navField : ONE shared flood-fill distance field from the player's cell (8-connected, no corner cutting,
                  5/7 step costs), refreshed at most ~3x a second and only when somebody cannot see him.
                  Each reviewer also owns a static field that leads home. One flood is in flight at a time and it
                  is poured a few thousand cells per frame, so no single frame ever carries a whole one.
     - behaviour: clear line of sight -> run straight, at a personal approach slot so they fan out and flank;
                  otherwise follow the field downhill, string-pulled to the farthest cell they can see. Wall sliding,
                  a stuck detector, separation, and a zigzag when you stare at one down the barrel in first person.
     Nobody got faster. They merely read the map. */
  var NAV_R = 0.5, NAV_NEAR = 0.5 + 0.7072, NAV_N = 2 * (WORLD + 5), NAV_MIN = -(WORLD + 5), NAV_CELLS = NAV_N * NAV_N, NAV_INF = 65535, NAV_EVERY = 0.33;
  var navCell = new Uint8Array(NAV_CELLS), navField = new Uint16Array(NAV_CELLS), navBack = new Uint16Array(NAV_CELLS), navQueue = new Int32Array(NAV_CELLS), navInQ = new Uint8Array(NAV_CELLS);
  var NAV_OFF = [1, -1, NAV_N, -NAV_N, NAV_N + 1, NAV_N - 1, -NAV_N + 1, -NAV_N - 1];           // four straight neighbours, then four diagonal
  var NAV_OX = [0, 0, 0, 0, 1, -1, 1, -1], NAV_OZ = [0, 0, 0, 0, NAV_N, NAV_N, -NAV_N, -NAV_N];   // the two cells a diagonal step squeezes between
  var navBuiltFor = -1, navSerial = 0, navT = 0, navFieldAt = -1e9, navFieldCell = -1, navFieldSerial = -1, navSlotAt = -1e9;
  var navQHead = 0, navQTail = 0, navQCount = 0, navJob = 0, navJobB = null, navBackCell = -1, navPath = new Int32Array(16), navBudget = 0;   // navJob: 0 nothing flooding, 1 the shared player field into navBack, 2 navJobB's field home
  var navWx = 0, navWz = 0, navPvx = 0, navPvz = 0, navLastPx = 0, navLastPz = 0, navAimX = 0, navAimZ = 1;
  var navOrder = BADDIES.map(function () { return 0; }), navBear = BADDIES.map(function () { return 0; });
  BADDIES.forEach(function (b) { b.homeField = new Uint16Array(NAV_CELLS); });   // 26 KB each, once: never a new field in the middle of a frame

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
  // Stamp the obstacles into the grid rather than interrogating the grid about the obstacles: each collider writes
  // only the cells it can reach, so the fill is O(colliders) and costs a fraction of a millisecond. Cell by cell it
  // says exactly what asking collide() at the cell centre would have said:
  //   2 = a reviewer standing in the middle of it is inside something (radius 0.55)
  //   1 = he fits, but something is within NAV_NEAR, so some corner of the cell is not clear
  //   0 = nothing can touch him anywhere in the cell (NAV_NEAR = body radius + half a cell diagonal), so navHit()
  //       may answer from the grid alone without walking the collider list.
  function navBuild() {
    var k, i, j, i0, i1, j0, j1, c, hw, hd, dx, dz, dd, r0, r1, row, v;
    navCell.fill(0);
    for (k = 0; k < colliders.length; k++) {
      c = colliders[k];
      hw = c.r !== undefined ? c.r : c.hw; hd = c.r !== undefined ? c.r : c.hd;
      i0 = Math.max(1, Math.floor(c.x - hw - NAV_NEAR - NAV_MIN - 0.5)); i1 = Math.min(NAV_N - 2, Math.ceil(c.x + hw + NAV_NEAR - NAV_MIN - 0.5));
      j0 = Math.max(1, Math.floor(c.z - hd - NAV_NEAR - NAV_MIN - 0.5)); j1 = Math.min(NAV_N - 2, Math.ceil(c.z + hd + NAV_NEAR - NAV_MIN - 0.5));
      if (c.r !== undefined) {
        r0 = (c.r + 0.55) * (c.r + 0.55); r1 = (c.r + NAV_NEAR) * (c.r + NAV_NEAR);
        for (j = j0; j <= j1; j++) {
          row = j * NAV_N; dz = NAV_MIN + j + 0.5 - c.z; dz *= dz;
          for (i = i0; i <= i1; i++) {
            dx = NAV_MIN + i + 0.5 - c.x; dd = dx * dx + dz;
            if (dd < r1) { v = dd < r0 ? 2 : 1; if (v > navCell[row + i]) navCell[row + i] = v; }
          }
        }
      } else {
        for (j = j0; j <= j1; j++) {
          row = j * NAV_N; dz = Math.abs(NAV_MIN + j + 0.5 - c.z);
          if (dz >= hd + NAV_NEAR) continue;
          for (i = i0; i <= i1; i++) {
            dx = Math.abs(NAV_MIN + i + 0.5 - c.x);
            v = dx < hw + 0.55 && dz < hd + 0.55 ? 2 : dx < hw + NAV_NEAR ? 1 : 0;
            if (v > navCell[row + i]) navCell[row + i] = v;
          }
        }
      }
    }
    for (i = 0; i < NAV_N; i++) navCell[i] = navCell[NAV_CELLS - 1 - i] = navCell[i * NAV_N] = navCell[i * NAV_N + NAV_N - 1] = 2;   // outside the world (collide() rejects |x| > WORLD + 4): also a solid rim, so the flood needs no bounds checks
    navBuiltFor = colliders.length; navSerial++; navJob = 0; navJobB = null;                   // any flood in flight was of the old town
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
  function navFieldSwap() { var f = navField; navField = navBack; navBack = f; navFieldCell = navBackCell; navFieldAt = navT; navFieldSerial = navSerial; navJob = 0; navJobB = null; }
  // one flood at a time (they share the queue), a slice of it per frame. -> true the step it drains.
  function navJobRun(budget) {
    var f = navJob === 1 ? navBack : navJob === 2 && navJobB ? navJobB.homeField : null;
    if (!f) { navJob = 0; navJobB = null; return false; }
    if (!navFloodRun(f, budget)) return false;
    if (navJob === 1) navFieldSwap();
    else { navJobB.homeSerial = navSerial; navJob = 0; navJobB = null; }
    return true;
  }
  function navPlayerField(px, pz) {                    // shared by all six; about 3 floods a second at most, none while he stands still
    var c = navIdx(px, pz), stale = navFieldSerial !== navSerial;
    if (navJob) { if (!stale || navJob === 1) return; navJob = 0; navJobB = null; }   // a map this old is nobody's friend: the chase comes before somebody's walk home
    if (!stale && (c === navFieldCell || navT - navFieldAt < NAV_EVERY)) return;
    navFloodSeed(navBack, px, pz); navBackCell = c; navJob = 1;
  }
  // a reviewer walking home is under no time pressure, so his field queues behind the player's on the same budget
  // instead of flooding 13,000 cells mid-frame. -> true when it is ready; until then he simply heads for his desk.
  function navHomeField(b) {
    if (b.homeSerial === navSerial) return true;
    if (!navJob) { navFloodSeed(b.homeField, b.home.x, b.home.z); navJob = 2; navJobB = b; }
    return false;
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
  // (MASTER QUEST: further ahead of him and further out, so the ring closes from the sides rather than from behind)
  function navSlotPoint(b, px, pz, d) {
    var lead = Math.min(1, d / 14) * (MQ ? 1.15 : 0.8), R = b.slotOn ? Math.min(MQ ? 7 : 5.5, Math.max(0, (d - 3) * (MQ ? 0.7 : 0.55))) : 0;
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
    if (navFieldSerial === navSerial && navDescend(p.x, p.z, navField, b.careful > 0 ? 1 : 12)) { b.mode = 3; b.wx = navWx; b.wz = navWz; return; }
    b.mode = 2;                                        // no way through on the map (or the map is still filling, or already on top of him): go straight and slide
  }
  // running away: the open heading that gains the most distance-by-foot from him, with a little momentum
  function navFleeYaw(b, px, pz) {
    var p = b.mesh.position, away = Math.atan2(p.x - px, p.z - pz), best = away, bs = -1e9, k, a, c1, c2, f, s, ready;
    navPlayerField(px, pz);
    ready = navFieldSerial === navSerial;              // no field yet: judge the headings on open ground and momentum alone
    for (k = 0; k < 12; k++) {
      a = away + k * 0.5236; c1 = navIdx(p.x + Math.sin(a) * 1.6, p.z + Math.cos(a) * 1.6);
      if (navCell[c1] === 2) continue;
      c2 = navIdx(p.x + Math.sin(a) * 3.2, p.z + Math.cos(a) * 3.2);
      f = !ready ? 0 : navCell[c2] !== 2 && navField[c2] !== NAV_INF ? navField[c2] : navField[c1] !== NAV_INF ? navField[c1] - 8 : 0;
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
    var dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz), range = (14 + 10 * dread) * (MQ ? 1.3 : 1);
    var speed = 0, want = b.head, face = b.head, raw = false, turn = MQ ? 11 : 9, cap, k, o, rx, rz, rl, q, f, sx = 0, sz = 0, vx, vz, ox = p.x, oz = p.z;
    if (b.flee > 0) b.flee -= h; if (b.cool > 0) b.cool -= h;
    if (b.careful > 0) b.careful -= h; if (b.probe > 0) b.probe -= h;
    b.plan -= h;
    var think = b.plan <= 0 && navBudget > 0, fleeing = b.flee > 0, chasing = !fleeing && !dialogOpen && graceT <= 0 && d < range + (b.chase ? (MQ ? 8 : 4) : 0);   // once on the scent they give up a little later than they notice
    b.chase = chasing;
    // standing inside something solid (a bad desk, or the world changed underfoot): walk out to the nearest open cell
    if (think && b.esc <= 0 && navCell[navIdx(p.x, p.z)] !== 0 && collide(p.x, p.z, 0.45) && navNearest(p.x, p.z, false)) { b.esc = 1.5; b.ex = navWx; b.ez = navWz; }

    if (b.esc > 0) {
      b.esc -= h; rl = Math.hypot(b.ex - p.x, b.ez - p.z); speed = 5; b.mode = 0;
      if (rl < 0.15) { b.esc = 0; speed = 0; }
      else { want = Math.atan2(b.ex - p.x, b.ez - p.z); b.head = want; raw = collide(p.x, p.z, 0.45); if (think) b.plan = 0.2; }
    } else if (fleeing) {
      speed = 7; turn = 14;
      if (think) { navBudget--; b.mode = 4; b.plan = 0.2; b.fleeA = navFleeYaw(b, px, pz); }
      else if (b.mode !== 4) { b.mode = 4; b.plan = 0; b.fleeA = Math.atan2(p.x - px, p.z - pz); }   // no thinking time this step: straight away from him, and ask the map on the next one
      want = b.fleeA;
    } else if (chasing) {
      // loop 1: 4.6-5.4 rising to 6.9-8.1 at full dread. MASTER QUEST: 5.75-6.75 rising to 7.5-8.5, never past MQ_TOP
      speed = d < 1.2 ? 0 : MQ ? Math.min(MQ_TOP, (4.6 + (i % 3) * 0.4) * 1.25 * (1 + 0.3 * dread)) : (4.6 + (i % 3) * 0.4) * (1 + 0.5 * dread);
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
      if (b.goHome ? rl < 10 : rl > 16) { b.goHome = !b.goHome; b.plan = 0; think = navBudget > 0; }
      if (b.goHome) {                                  // strayed: walk home by the map rather than into the back of the Library
        if (think) {
          navBudget--; b.mode = 5; b.plan = 0.4; b.wx = b.home.x; b.wz = b.home.z;
          if (!navLos(p.x, p.z, b.wx, b.wz)) {
            if (navHomeField(b)) { if (navDescend(p.x, p.z, b.homeField, b.careful > 0 ? 1 : 10)) { b.wx = navWx; b.wz = navWz; } }
            else b.plan = 0.15;                        // his field is still flooding: head for the desk and ask again shortly
          }
        } else if (b.mode !== 5) { b.mode = 5; b.plan = 0; b.wx = b.home.x; b.wz = b.home.z; }
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
    if (!(dt > 0)) return;
    if (navBuiltFor !== colliders.length) navBuild();   // lazily: nobody is walking anywhere on a frame that lasts no time, and a visitor who never starts the game never pays for a map
    var px = player.position.x, pz = player.position.z, n, s, k, b, m, v;
    navT += dt;
    // where he is heading, for cutting him off (teleports and knockbacks are not running)
    v = Math.hypot(px - navLastPx, pz - navLastPz) / dt; k = Math.min(1, dt * 6);
    if (v < 12) { navPvx += ((px - navLastPx) / dt - navPvx) * k; navPvz += ((pz - navLastPz) / dt - navPvz) * k; } else { navPvx = 0; navPvz = 0; }
    navLastPx = px; navLastPz = pz;
    if (fp) { v = viewDir(); k = Math.hypot(v.x, v.z) || 1; navAimX = v.x / k; navAimZ = v.z / k; }
    if (navT - navSlotAt >= NAV_EVERY) { navSlotAt = navT; navSlots(px, pz); }
    if (navJob) navJobRun(Math.max(3500, dt * 210000));   // ~0.2 ms of flood a frame, whoever it belongs to: done within four
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
  // showToast(msg, secs, then): then = [msg, secs] follows when this one runs out, unless another toast replaces it first
  var toastNext = null;
  function showToast(msg, secs, then) { if (MQ) mqFit(); toast.textContent = msg; toast.hidden = false; toastT = secs || 2.6; toastNext = then || null; }
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
    if (MQ && !(mqTick++ & 7)) mqFit();
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) { if (toastNext && hudOn && !over) showToast(toastNext[0], toastNext[1]); else { toast.hidden = true; toastNext = null; } } }
    if (graceT > 0 && running) graceT -= dt;
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
    if (cap) capFlop(dt);
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

    if (cave && running && !caveOn && !endgame && !over && !dialogOpen) {
      var fd2 = player.position.x * player.position.x + player.position.z * player.position.z;
      if (fd2 > 49) caveArmed = true;                      // he spawns 4 units out; walk away first
      else if (caveArmed && fd2 < 16.8) enterCave();       // then walking back into it drops you in
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
    // the first-person camera swoops into his head from behind: the cap goes before the lens reaches it (asked of this frame's camera)
    if (cap) { cap.base.getWorldPosition(cap.at); cap.base.visible = camera.position.distanceTo(cap.at) > 1.9; }
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
      if (name === 'quest' && LOOP === 2 && R.has && R.has('quest2')) name = 'quest2';          // the second loop has its own overworld score
      if (name === 'space') { if (R.boss) R.boss(false); if (musicWanted) R.play('space'); return; }
      if (name === 'quest') { if (R.boss) R.boss(false); if (musicWanted) R.play('quest'); return; }
      if (name === 'cave') { if (R.boss) R.boss(false); if (musicWanted && R.play) R.play('cave'); return; }
      if (name === 'title') { if (R.boss) R.boss(false); if (musicWanted) { try { R.play('title'); } catch (e) { R.play('quest'); } } return; }
      if (R.has && R.has(name)) { if (R.boss) R.boss(false); if (musicWanted) R.play(name); return; }   // plug-in tracks from riff2.js: quest2, magician, space2, tlb
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
    // setWeapon({kind:'bfg'|'paper', rate, speed, gravity}). kind is applied first: 'bfg' stashes the ballistics
    // in force, 'paper' puts them back, and anything named in the same call then overrides.
    setWeapon: function (o) { o = o || {}; if (o.kind) setWeaponKind(o.kind); if (o.rate) fireRate = o.rate; if (o.speed) shotSpeed = o.speed; if (o.gravity !== undefined) shotGrav = o.gravity; },
    music: music, musicWanted: function () { return musicWanted; }, setMusicWanted: function (on) { musicWanted = !!on; if (!on && window.Riff) Riff.stop(); },
    stinger: function (name) { try { return !!(window.Riff && Riff.stinger && musicWanted && Riff.stinger(name)); } catch (e) { return false; } },   // true if it fired, so a caller can fall back
    isOver: function () { return over; },
    params: PARAMS,
    links: { publications: '/publications/', research: '/research/', code: '/code/', scholar: 'https://scholar.google.com/citations?user=-OiUY4kAAAAJ&hl=en', email: 'mailto:duncan.palmer@stats.ox.ac.uk' },
    onBossDefeated: function () { launchShmup(); },
    // the shooter's first ending offers the second loop: everything is re-earned, and the world remembers which loop it is on
    startLoop2: function () { try { localStorage.setItem('quest.loop', '2'); localStorage.removeItem('quest.found'); localStorage.removeItem('quest.cave'); } catch (e) {} location.hash = '#play'; location.reload(); },
    restart: function () { try { localStorage.removeItem('quest.found'); localStorage.removeItem('quest.cave'); localStorage.removeItem('quest.loop'); } catch (e) {} location.hash = '#play'; location.reload(); }
  };
  // loop 2 fights a different boss module with the same interface (magician.js); it falls back to the editor if that file is missing
  try { boss = (LOOP === 2 && window.QuestMagician) ? window.QuestMagician(api) : window.QuestBoss ? window.QuestBoss(api) : null; } catch (e) { console.error(e); boss = null; }
  try { shmup = window.QuestShmup ? window.QuestShmup(api) : null; } catch (e) { console.error(e); shmup = null; }
  try { cave = window.QuestCave ? window.QuestCave(api) : null; } catch (e) { console.error(e); cave = null; }

  /* ---- the title sequence lives inside the start overlay: attract, then a scored cinematic, then PRESS START ---- */
  var intro = null;
  try { intro = window.QuestIntro ? window.QuestIntro(api) : null; } catch (e) { console.error(e); intro = null; }
  if (intro && start) {
    (function () {
      var kids = [], i;
      for (i = 0; i < start.children.length; i++) kids.push(start.children[i]);
      kids.forEach(function (k) { k.hidden = true; });          // the module draws its own logo and prompt
      start.classList.add('is-intro');
      try {
        intro.start({
          host: start,
          onScore: function (name) { try { music(name === 'title' ? 'title' : name); } catch (e) {} },
          onDone: function () { try { intro.stop(); } catch (e) {} start.classList.remove('is-intro'); begin(); }
        });
      } catch (e) { console.error(e); }
      if (!intro || !intro.active) {                             // fall back to the plain overlay
        if (intro && intro.startError) console.error('QuestIntro failed to start: ' + intro.startError);
        try { if (intro) intro.stop(); } catch (e2) {}
        intro = null;
        kids.forEach(function (k) { k.hidden = false; });
        start.classList.remove('is-intro');
      }
    })();
  }

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
    blip(440, .06); showToast(MQ && window.QuestMagician ? 'RESUBMITTED. SENT BACK TO REVIEWER 2.' : 'RESUBMITTED. THE EDITOR IS WAITING.');
  }
  function launchShmup() {
    if (!shmup) { showToast('SPACE IS CLOSED TODAY.'); return; }
    if (boss && boss.active) { try { boss.stop(); } catch (e) {} }
    if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) {}
    fireHeld = false; for (var k in keys) keys[k] = false;
    setHud(false); root.classList.add('is-space');
    try { shmup.start({ loop: LOOP }); } catch (e) { console.error(e); }
  }
  function enterCave() {
    if (!cave || caveOn || endgame || over) return;
    caveOn = true;
    if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) {}
    fireHeld = false; for (var ck in keys) keys[ck] = false;
    setHud(false); root.classList.add('is-space');
    try { cave.start({ onDone: leaveCave }); } catch (e) { console.error(e); caveOn = false; setHud(true); root.classList.remove('is-space'); }
  }
  function leaveCave(res) {
    if (!caveOn) return;
    caveOn = false;
    try { cave.stop(); } catch (e) {}
    root.classList.remove('is-space'); setHud(true);
    api.teleport(0, 7);                                   // climbs out at the fountain's edge, clear of the trigger
    var got = res && res.hearts ? res.hearts | 0 : 0;
    if (got > 0 && !caveTaken) {
      caveTaken = true; MAX_HITS += got; drawHearts();
      if (hudHitsWrap) hudHitsWrap.hidden = false;
      try { localStorage.setItem('quest.cave', JSON.stringify({ hearts: got, credits: res.credits | 0 })); } catch (e) {}
      showToast('CLOUD COMPUTE SECURED  ·  +' + got + (got > 1 ? ' HEARTS' : ' HEART'));
    } else if (!caveTaken) {
      showToast('THE UNDERSPEND WAS CLAWED BACK.');
    }
    try { music('quest'); } catch (e) {}
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
    if ((shmup && shmup.active) || (cave && cave.active)) return;   // a 2D overlay has the screen; stop paying for WebGL
    if (!visible && rendered++ > 2) return;
    if (running) update(dt); else { camYaw += dt * 0.15; update(0); }
    renderer.render(scene, camera);
  }
  resize();
  camera.position.set(0, 8, 18);
  loop();
})();
