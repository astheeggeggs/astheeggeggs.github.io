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
