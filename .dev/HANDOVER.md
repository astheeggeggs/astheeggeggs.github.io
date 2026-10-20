# Handover — astheeggeggs.github.io (updated 2026-10-12; the 2026-10-11, 2026-10-10, 2026-10-04 and 2026-09-21 text follows below)

## 2026-10-12: Warthog follow-ups after Duncan drove it (DONE, verified, NOT committed)
Duncan: steering was mirrored going forward -> `warthog.js` stepDrive `yawRate = -vF / WB * tan(steer)` (right swings
the nose right forward and the tail right in reverse, both per his call); front wheels drawn with `-S.steer`. Then
"benches etc destructible" and "go over the water": lamp/bench colliders carry `prop: {group, kind}`; `PROPS` (flowers,
building bushes, no colliders) is read only by the car; the lake collider has `water: 9` and `collide(x, z, r, car)` skips
it for the car only (on foot unchanged). The car smashes tagged props at > 5 u/s (pieces burst, tumble, sink, gone at
~4.5 s; shared geometries not disposed), flattens flowers, and is amphibious on the lake (60% cap, drag, bob/roll,
spray, 'splash' on entry); the fountain basin and trees/buildings stay solid. Tests: `.dev/tmp/warthog-final/steer.mjs`,
`smash.mjs` (37/37 both loops, 0 errors; needs the TEMP hook from `hook.txt`), regress green. Shots `smash.png`,
`lake.png`. Smashed props do not come back within a session. Psycho Mantis: NOT started (its build died on a DNS
outage before writing anything); spec is in the 01:00 notes of the session, nothing on disk.

## 2026-10-12 (final check): the Warthog, the chain gun and the fountain dive (CHECKED, NOT committed, NOT seen by Duncan)
Duncan, verbatim: "allow the master chief to get in a warthog and run over all the reviewers", "allow master chief to get
in and use it against the boss (allow use of the chain gun to rapidly dispatch the boss)", and on the cave: "currently,
just when moving to the fountain, we enter the bonus level. Can we make it an option and add more of a transition?"
Files: `assets/js/warthog.js` (new, `window.QuestWarthog(host)`, header documents the whole interface), `assets/js/quest.js`
(the car block after the hats block, `carEnter/carExit`, the drive input, the turret in the endgame, run-overs in
`updateBaddies`, `nearbyTarget` skips reviewers while driving and flat ones, the fountain: `fountainNear/startDive/
diveFrame/diveEnd`), `assets/js/boss.js` and `assets/js/magician.js` (`hitTest(pos, prev, {kind:'chain'})`),
`assets/js/fpsfx.js` (seven sounds: engine, skid, thud, bump, chaingun, door, splash), `_layouts/default.html` (loads
warthog.js), `.dev/endgame-contract.md`, `.dev/sfx-contract.md` (the seven names), README (one vague fountain line; the
car is a surprise, nothing about it in page copy). The cave side of the transition is cave.js (another workflow; not touched here).

**What it does.** Only while `hats.skin() === 'chief'` (`?clears=20`): a box Warthog parked at `(mx(14), 2)` nosed
`mx(1.96)` on the grass east of the fountain square (30 u of clear run before an NPC's circle at (±44, -8); both loops).
`F: WARTHOG` within reach (town; `E: WARTHOG` / `B:` on a pad in the fight, since F fires there) climbs in; F or E gets
out beside it. WASD drives (ACC 14, TOP 22, steering shrinks with speed, lateral grip with a slide, Space handbrake,
kerb bounce, engine pitch with speed, sub-stepped chassis collisions with every collider via edge samples, a nudge-out
when stuck, a bump SFX + shake on a hard hit). A reviewer inside the footprint at speed > 4 is launched (random tumble,
`thud` + `skid`), lies flat 5.5 s (`b.ko`, the flight included), then stands and flees; it counts as a rebuttal. No catching or rebutting from
the car; a flat reviewer cannot be rebutted again. Chase camera pulls in ahead of buildings and the edge hills. The car
survives the boss landing; in the fight E climbs in, the camera goes behind the turret (driver hidden when he is in the
sights), mouse aims, F/click holds the chain gun (12 tracers/s, flash, spent links); every round that lands anywhere
calls `hitTest(pos, prev, {kind:'chain'})`: 1 off the Editor, 2 REVISIONS off Reviewer 2 (`CHAIN_DMG`, his plates and
teleports eat half the rounds; both ~10-15 s of sustained fire for 100 hp), a light tick, no accuracy stat (a chain-only
win reads SPRAY AND PRAY · RANK S). The boss's attacks still hurt him. On the boss's death the shooter launch leaves the car.
**The fountain (all skins):** touching it does nothing. Within 2.5 u of the rim `F: DIVE IN?`; F is a 0.7 s scripted arc
into the basin, `splash` + the fountain's own drops, the camera dips, then `cave.start({ onDone: leaveCave, skin,
transition: true })`; `leaveCave` puts him on the rim as before. `?cave=1` still goes straight in. A boxed Snake cannot
dive; no dialogue opens mid-hop; a reviewer cannot open one on a moving car.

**Verified today** (only agent running; served bytes hash-matched disk; one headless Chrome on port 9599, profile
warthog-final; scratch `.dev/tmp/warthog-final/`; the temporary `window.__wh`/`__simT` handle was added for the runs and
removed again, quest.js md5 66e527f7... before and after):
- All 12 `assets/js/*.js` parse; `grep -n "__dbg\|__debug\|TEMP" assets/js/*.js` clean; `node .dev/regress.mjs` all
  passed, 0 errors incl. 404s (`regress.log`), run on the handle-free bytes.
- `town.mjs 1`: 26/26 (`town-l1.log`): parked pose, F: WARTHOG, pull-out to 22 u/s, chase camera never inside a collider
  across four road drives (0/32), camera inside the edge mound line, F: REBUT beats the car and F rebuts, E climbs in
  with the reviewer fleeing, a reviewer 7 u ahead at 18 u/s is run over (rebuttals +1, flat, no second rebuttal), up
  and fleeing after the ko; 0 console errors. `town.mjs 2`: 25/26, the one FAIL is the harness's pull-out sampling: the
  probe `pullout.mjs` shows the SAME run in both loops (22 u/s, first bump at 30-32 u on the NPC circle at (±44, -8);
  loop 1 just happened to be sampled before it). Not a code asymmetry.
- `endgame.mjs 1 40` 12/12 (`eg-l1.log`): car still at (14, 2) after the landing, E: WARTHOG prompt, F beside it does
  not enter, E enters with no tracer, driver hidden for the three aims, 40 'chain' of 45 calls kill the editor,
  MANUSCRIPT ACCEPTED, shooter started with driving=false. `endgame.mjs 2 40` 11/12: the FAIL is the stale assertion
  `chain >= HP` (20 'chain' returns × CHAIN_DMG 2 = 40 hp, by design); the other 11 pass, shooter started, 0 errors.
- `fountain.mjs` 24/24 across `?clears=0` (no car, no collider, 2.5 s against the rim: no cave, prompt at 2 u from the
  rim and none at 3.5, the hop, cave.start({skin:'palmer', transition:true, onDone}), leaveCave on the rim), `?clears=20`
  (skin 'chief'), `?cave=1`, `?clears=10` (no car, F: DIVE IN? on foot, none under the box, F does not dive boxed).
- The seven WAVs in `.dev/tmp/render/sfx-fps/` re-rendered from the final fpsfx.js (md5 c74e22d2...) by
  `.dev/tmp/warthog/render.mjs`; `_chaingun-held.wav` is 3 s at 12/s. Nobody has heard any of them.
- Screenshots looked at: `warthog.png` (the Chief beside the parked car, F: WARTHOG), `runover.png` (a reviewer flat
  on the road), `turret.png` (behind the gun, the editor in the crosshair, no visor in view), `dive.png` (the hop over
  the basin), `eg-l2-dead.png`, `l1-pullout.png`, `l2-road.png`, `cave-transition.png`.

**Open / not verified.** Nobody has played it: the jeep feel, the push-out nudges, the chase camera at corners, the
driver popping in/out of the gun view, the sounds and the mix meter. `CHAIN_DMG = 2` on Reviewer 2 and the SPRAY AND
PRAY banner are design calls made without Duncan. The parked heading meets an NPC after ~30 u at full throttle (a bump,
not a crash). After `leaveCave` the camera sits inside the tree crown south of the fountain for a moment (pre-existing,
the "tree-wedge" noted on 10-11; it was there before the dive). Touch (B: WARTHOG, the d-pad drive) is code-read only.
`sfx-contract.md` rows for the seven sounds have no bus/loud measurement. The harness suites need the TEMP handle
re-added (see the 2026-10-11 notes / the warthog-fix-host handover text: `window.__wh = {...}` before `var resetLink`
and `window.__simT` at the top of `update(dt)`, both tagged `// TEMP`; `grep -v "// TEMP$"` strips them).

## 2026-10-11 (final check): Snake mode: MGS stealth reviewers (CHECKED, NOT committed, NOT seen by Duncan)
The build and review fixes below were re-verified as the only agent running, on served bytes hash-matching disk, one
headless Chrome at a time (port 9541, profile mgs-final; the stale chrome-slide Chrome on 9453 is not mine and was left).
Scratch: `.dev/tmp/mgs-final/`. Working tree unchanged except `.dev/HANDOVER.md`; nothing committed.
- All 11 `assets/js/*.js` parse; `grep -n "__dbg\|__debug\|__mgs\|TEMP" assets/js/*.js` is clean (the `window.__mgs`
  handle was re-added for the run and removed again: `quest.js` md5 31c061a6... before and after).
- `t.mjs 1` and `t.mjs 2` (the mgs-fix harness, 31 checks: patrol, cones drawn, "!" + `alert`, catch, building blocks the
  cone, lost -> "?" + `lost` at the last-seen point, box hides, box suspicion, no rebut under the box, eye stagger, lazy
  mark texture, fan opacity): 31/31 in both loops, 0 console errors (`t-l1.log`, `t-l2.log`).
- `?clears=0` control (`trace.mjs "clears=0&timescale=4"`, 120 fixed-clock frames of every reviewer): identical to the
  pre-build baseline `mgs/pre-c0-a.json` 120/120 at shift 0 (119/119 differ at +-1, so the match is not trivial).
- `node .dev/regress.mjs`: all passed, 0 errors (`regress.log`), run after the handle was removed.
- `alert.wav` / `lost.wav` in `.dev/tmp/render/sfx-fps/` re-rendered from the final `fpsfx.js` (`mgs/render.mjs`):
  alert 0.390 s peak 0.311 rms -17.3 dBFS, lost 0.420 s peak 0.090 rms -31.2 dBFS. Still unheard by anyone.
- Screenshots for Duncan (`shots.mjs [loop]`, timescale 1, 8/8 checks per loop): `patrol.png` (Reviewer 1 walking the
  north road, his wedge on the tarmac), `spotted.png` (red "!" over him, the brighter wedge, before the catch),
  `boxed.png` ("?" beside the PREPRINTS box, no catch), `lost.png` ("?" at the last-seen point; in loop 1 he is partly
  behind a tree, `l2-lost.png` is clearer); `l2-*.png` the mirrored town. Staging lesson: a full-page capture costs
  ~0.5 s wall, so at timescale 2 a chasing reviewer closes 5-6 units during the shot and catches the man.
- Open, unchanged from the review: nobody has played it or heard the two sounds; the mix meter was not run; the loop-2
  close pass (reviewers 4 and 8) and the pre-existing tree-wedge are untouched; `SN_SUSD` = 2 is Duncan's call
  (the spec said ~1.5). README and page copy say nothing about the skin (a surprise), on purpose.

## 2026-10-11: SNAKE MODE: reviewers patrol with cones of vision at ten clears (BUILT, reviewed, fixed, NOT committed, NOT seen)
**Review fixes (same day, after the build below):** (1) out of sight, an alerted reviewer now runs to where he LAST SAW
him (`b.lsx/b.lsz`, while `b.lostT > 0`) instead of homing on the live position through walls, so a corner shakes him;
when he reaches that point he stands facing it until the 4 s "?" (which then goes straight to the look-round, sn 3).
(2) The box-suspicion radius is `SN_SUSD` = 2 units (was 4; the spec said ~1.5). (3) No `F: REBUT` from inside the box:
`nearbyTarget()` returns null while `SNAKE && snBoxed`. (4) The patrol fan's opacity is `0.22 + 0.12 * dread` (0.22 was
lost on the red-lit dusk ground). (5) The "!"/"?" textures are drawn on first use, and redrawn once from
`document.fonts.ready` (`snakeRefont`), so a slow pixel font no longer leaves a fallback-face "!" cached forever.
(6) The eye clock (`b.see`) only runs while the reviewer is free and resets with `+= SN_LOOK`, so the ticks keep their
stagger after a dialogue instead of phase-locking. (7) `alert` is `len: 0.39` so its second note ends inside the buffer.
Verified: `.dev/tmp/mgs-fix/t.mjs` (the build harness plus S3/S5-S8 FIX checks, polling with sim timestamps; needs the
temporary `window.__mgs` handle re-added, see the build notes) 31/31 in loop 1 and loop 2, 0 console errors; `node
.dev/regress.mjs` all passed; non-Snake trace `clears=0` unchanged against the build's `pre-c0-a.json`. NOT done: nobody
has heard the sounds or run the mix meter; the loop-2 close pass (reviewers 4 and 8, 1.39 units) and the player's
tree-wedge are untouched (pre-existing / cosmetic).

Duncan, verbatim: "I noticed that when the snake skin is on, the reviewers don't spot you with an exclamation above
their heads and the classic MGS noise. Can you update that behaviour? Note that it might make more sense in this
context for the reviewers to have set paths and cones of vision, where they can't spot you if you're in the box."
Files: `assets/js/quest.js` (SNAKE flag + SN_ROUTES after the hats block; the "SNAKE MODE" block after navReviewer;
`navReviewer` branches once at its top, `if (SNAKE) return navSnake(b, i, h)`, and is otherwise byte-identical),
`assets/js/hats.js` (one constant: the box drops after 1.2 s idle, was 2.5), `assets/js/fpsfx.js` (two sounds, `alert`
and `lost`), `.dev/sfx-contract.md` (the two names). Nothing committed; nothing in README or page copy (the skin is a surprise).

**What it does** (only while `hats.skin() === 'snake'`, i.e. `?clears=10..19`; any other skin, no hats.js or a throw
leaves the reviewers exactly as before):
- Each reviewer walks a fixed loop of 3-4 waypoints (`SN_ROUTES`, unmirrored; `mx()` flips them for MASTER QUEST, loop 1
  uses the first six, loop 2 all nine) at 2.6 u/s with the old nav/collision movement; a third element marks a corner
  he pauses at (2.2-3 s) and turns to look left and right. Any point inside a tree is moved to the nearest open cell
  once the grid is built (`b.routeSerial`). Every point and every leg was checked against the colliders of both towns,
  offline (`.dev/tmp/mgs/design.mjs` on the dumps) and in the game (`wp.mjs`: 0 bad points, 0 blocked legs, both loops).
  Reviewer 5 circles the fountain square ANTICLOCKWISE on purpose: clockwise, his cone swept the spawn within a second.
- Cone: half-angle 0.70 rad (80 degrees wide), range `(12.5 + 2.5 * dread) * (MQ ? 1.1 : 1)`, blocked by anything
  `navLos` sees (buildings, trees, lamps, benches, NPCs). Drawn as a flat `CircleGeometry` fan under a `MeshBasicMaterial`
  in the suit red, opacity 0.22 on patrol / 0.38 while alerted / 0.30 searching, `depthWrite` off, following his face
  (`b.look = mesh.rotation.y`). The eyes are asked every 0.15 s per reviewer (`SN_LOOK`), not per frame.
- Spotted (in the cone, line clear, not boxed): a red pixel "!" sprite (canvas, unfogged) pops above his badge for
  1.5 s, `alert` plays positioned at him, he chases with the OLD chase code (speeds, slots, navPlan, caught()), and
  colleagues within 10 units join silently. Out of sight for 4 s: "?" (pale yellow), `lost`, he walks to the last
  seen point (3.6 u/s, by the map if need be), looks round 2.6 s, resumes the route at its nearest point. Rebutted
  (flee 7 s) he returns to the route when the flee ends, no "?".
- Boxed (`hats.boxed()`): nobody sees him. A patrolling reviewer within `SN_SUSD` (2) units with the box in the middle third of
  his cone and a clear line for 3 s gets curious: "?", `lost`, walks to within 1.6 units, looks, resumes; never a
  catch. A reviewer already chasing within 3.2 units when the box lands keeps `b.boxCatch` and still catches (the box
  is no escape from a catch in progress; the rest of a chase cannot catch a boxed man). Not staged in a test (code read only).
- Unchanged: dread growth and the reviewers' dread speed, MQ grace (an alerted reviewer stands and watches while
  `graceT > 0` or a dialogue is open), CAUGHT_REST, flee after a rebuttal, catching (`caught()`), F: REBUT, navSlots.
- Audio (fpsfx.js): `alert` 0.39 s, a 6 ms click then a 1976 Hz square snapping to 1318 Hz and ringing off, at
  `hit.crit`'s tier (MIX.ding - 3, peak 0.311), unducked; `lost` 0.42 s, 587 then 784 Hz square+triangle, MIX.ord
  (peak 0.09). Warmed on the first Snake-mode frame. No siren while chased (not built: the optional item).
  **Nobody has heard them.** Renders: `.dev/tmp/render/sfx-fps/alert.wav`, `lost.wav` (48 kHz mono, in-game level).

**Verified** (headless Chrome, one at a time, port 9511, served bytes hash-matched; scripts and PNGs in `.dev/tmp/mgs/`):
- `t.mjs 1` and `t.mjs 2`: 25/25 each (logs `t-l1.log`, `t-l2.log`). Idle at the spawn 25 game-s: not spotted; parked
  far away 12 game-s: nobody alerts, all six/nine walk, cones drawn; posted reviewer + player 6 units in front: "!" and
  `alert` within 0.6 s, REVISIONS dialogue follows; STATS DEPT between them: no alert in 3 s, then seen 7 units in the
  open (positive control); teleported away: still chasing at 3.2 s, "?" + `lost` at ~4 s, walks to the last seen point,
  back on patrol; box down after idling, reviewer posted 3 units away staring at it: no alert, suspicion builds, "?" +
  `lost` at ~3 s, walks over, no dialogue; 0 console errors. A rerun of loop 1 (`t-l1b.log`) had one timing flake: the
  "?" had fired and `lost` played but the 1.5 s mark had expired when sampled.
- Non-Snake behaviour unchanged: per-frame traces of every reviewer's x/z/rotation for 120 frames (24 game-s) with a
  fake 100 ms frame clock (deterministic: two baseline runs matched 120/120) BEFORE and AFTER the edit, no input, for
  `clears=0`, `clears=20`, `clears=0&loop=2`, `clears=20&loop=2&dread=0.8` (`trace.mjs`, `diff.mjs`): three identical
  frame for frame, the fourth identical after a one-frame sampling-phase shift (119/119).
- `node .dev/regress.mjs` all passed, 0 errors. No `__mgs`/`__dbg`/TEMP left (`grep`). All three files parse.
- Screenshots: `l1-start.png` (Reviewer 5's wedge across the road), `l1-alert.png` (red "!" over REVIEWER 1, his
  brighter wedge), `l1-patrol.png` (the box down at the world's edge), `l1-lost.png`, `l1-box.png`, `l2-*.png`.
- The in-game sim clock: `clock.elapsedTime` is WALL time; the simulation advances min(0.05, dt) * timescale per
  frame, so a harness must read a sim accumulator (`navT`) for game seconds. `t.mjs` does; earlier runs did not.

**Open / not verified**: nobody has played it, seen the cones move, or heard the two sounds; the box-drop catch rule
(`boxCatch`) is code-read only; the sounds were not run through the shared mix meter; cone look in dread/dusk and on a
phone not checked; the "!" is small at the default camera distance (0.9 units); a reviewer who flees into another's
cone range re-alerts at once when the flee ends (by design, MGS-like, untested in play); patrol routes are fixed, so
after the boss flattens the town they are moot (updateBaddies stops in the endgame anyway). `.dev/tmp/mgs/` is scratch.
A stale headless Chrome from an earlier session sat on port 9453 (profile chrome-slide) throughout; not killed (not mine).


## 2026-10-10: buildings face the fountain; old title card removed (BUILT, tested, NOT committed, NOT seen by Duncan)
Duncan, verbatim: "can you turn building around so that all doors for the facts are facing the centre?" and then
"please remove remnants of the original title screen". Nothing committed (also still uncommitted: everything from 10-04).

**Facing** (quest.js): `p.yaw = atan2(-p.x, -p.z)` per building, set right after the MASTER QUEST mirror, is the group's
`rotation.y`, so the +z model face (door, steps, windows, knob) looks down the line to the fountain. `placeAt(p, lx, lz)`
maps the building frame to the world (Three.js Ry: x = lx cos + lz sin, z = -lx sin + lz cos); door point, bushes and
marker use it. Box colliders carry `yaw`; `collide()`, `navBuild()` (the reviewers' grid) and `blocked()` (tree placement)
test in the box's own frame (`lx = dx cos - dz sin`, `lz = dx sin + dz cos`). boss.js `burstBuilding` turns the children
and wall chunks into world space with the group's yaw; magician.js has `inBox()` (dash lines, roof shots) and `sightCost`
works in the building frame. `.dev/endgame-contract.md` documents `yaw` on colliders and places.
Knock-on changes from the review: **warwick z -18 -> -19.5, bdi z -20 -> -22, brava z 16 -> 21** (turned corners were on
the z=+-12.2 kerbs and brava's stood in the south road and swallowed the lamp at (-36,13)); lamps are skipped inside a
turned footprint (`inPlace`, 0.8 margin; with the nudges none is skipped); the **player's wall slide** is new: full step,
else the heading swings 15..75 degrees away from the wall (nearest side first, tangent speed kept), else the old x/z split.
The reviewers' `navMove` already probed angles and needed nothing.
Tests (`.dev/tmp/facing/`, port 9451-9453, one Chrome at a time): `t.mjs d|m` 43 checks per loop (yaw, door line, bushes,
marker, door clear / centre solid, rotated corners solid inside and free outside with other colliders excluded, F at three
doors, loop-1 demolition bursts all 8 and drops the yawed colliders, loop-2 Magician fight, 0 console errors) plus top-down
renders `top-l*.png` (one off-loop render read back with toDataURL); `slide.mjs` wall slide with open-ground and head-on
controls (a reviewer catching the player opens a dialog and freezes him: the test dismisses it and retries); `title.mjs`.
Review (42 agents, read-only) found no transform error; all numbered findings were layout consequences, fixed above.
Open: nobody has looked at the turned town in the real game (doors now open onto grass diagonally, no path to them);
magician roof perches use the building centre and were not re-checked in play; the cave and shooter are untouched.

**Title card** (index.md, swank.css, quest.js, README): the old DOM card inside `.q-start` (PALMER'S PROGRESS /
A 64-BIT* ADVENTURE / PRESS START, `.q-logo .q-sub .q-press`) and its CSS are gone; `.q-start` is empty markup that
intro.js fills. Without intro.js (missing or `start()` failing) quest.js writes one `▶ PRESS START` into it (the
overlay blinks via `.q-start`'s own animation, off under `.is-intro`); tested with intro.js blocked: the click starts the game.


**22:27 addendum:** the a1 logo flow test was re-run alone on an idle machine: 0 FAILED (E4/E5 pass). The earlier 2 failures were load from concurrent headless Chromes, not a product bug. a3 (six destinations) and a5 (clears counter) were last green at about 21:35, before the hats/Andross/dread edits, and were not re-run after them.

## 2026-10-04 (22:20) FINAL CHECK of tonight's four changes: all in, all working, NOTHING COMMITTED
Working tree (intended, nothing else): `M _layouts/default.html` (chant.js + hats.js script tags), `M assets/js/intro.js`,
`M assets/js/quest.js`, `M assets/js/shmup.js`, `?? assets/js/chant.js`, `?? assets/js/hats.js`, `M README.md`, this file.
The final check changed no game file. Pre-hats/pre-Andross snapshot of every file: `.dev/tmp/snap-2139/` (its quest.js
lacks `DREAD_TIME = 240`; keep that if restoring). Back out Andross alone: copy the snapshot's shmup.js over the live one.

1. **PALMER logo + chant + Konami level select + 50 lives**: section below (unchanged tonight after its integration run).
2. **`DREAD_TIME = 240`** (quest.js, one constant, both loops; the endgame still uses its own 4 s). Measured live with
   `?timescale=20&god=1`, reading `Riff.dread` against a test-side game clock (sum of `min(0.05, frame dt) * 20` per rAF,
   the host's own dt formula): loop 1 dread 0.5 at 120.0 game-s, 1.0 at 241.9; loop 2 (`&loop=2`) 0.5 at 120.0, 1.0 at
   244.5; fitted slope 240.0 s per unit dread in both. The 1.0 readings are late by up to one sample (about 5 game-s).
3. **Hats/skins wired** (hats.js, quest.js): see "hats WIRED" at the end of the next section. Test hook: **`?clears=N`**
   overrides localStorage `quest.clears` for one page load (0 = plain man, 1..9 hat tower, 10+ Snake, 20+ Chief).
4. **Andross reskin of PEER REVIEW** (the loop-2 true last boss, shmup.js): the hive sprite is replaced by a grey
   polygon face with two hands (`androssBuild()`, `drawAndross(...)`); the entity is still `ET.hive` / `updateHive`, and
   hit boxes, patterns, beams, sfx and music are untouched. Reach it: `/?shmup=1&shmupstage=tlb&shmupgod=1&shmupdbg=1&loop=2`.

Final-check results (headless Chrome, served bytes hash-matched to disk, scripts and shots in `.dev/tmp/final-check/`):
- every `assets/js/*.js` parses; no `__dbg/__debug/__warpdbg/TEMP`; `node .dev/regress.mjs` all passed, 0 errors.
- plain title -> town with 0 clears: no hat (`town_plain-run.png`); `?clears=9` tower, `?clears=10` Snake, `?clears=20`
  Chief, `?clears=9&loop=2` in the real town (`town_clears_*.png`); 0 console errors.
- TLB via a seeded level-select warp (`quest.warp` = loop 2 shmup, plus `?shmupstage=tlb&shmupgod=1&shmupdbg=1`): the
  Andross face draws (`tlb-face-p0.png`, `tlb-face-p2.png`), the bot kills it from phase 4, TENURED! ending reached
  (`tlb-ending-b.png`), 0 console errors, `quest.clears` not written by the cheat run.
- logo suite re-run: `a1` 36 pass, 2 fail (E4 "Enter after a partial code starts the game" and E5, which depends on it).
  A targeted repro (`e4.mjs`: two arrows then Enter on the title card) started the game 3/3, and intro.js is byte-identical
  to the version that passed 38/38 earlier tonight. [ASSUMPTION: timing flake under machine load; not pinned down.]
  `a3` (six destinations) and `a5` (clears counter) were NOT re-run to completion: out of time. Re-run all three, one at a time.

Open issues (tonight's additions; the logo's list of 15 is below, its item 15 "hats unwired" is now obsolete):
- Duncan has seen and heard none of it: chant, hats, Snake/Chief skins, the Andross face.
- Hats: the Snake box is rarely seen in town (reviewers catch an idle man in about 2 s); "F: REBUT" can overlap a tall
  tower; at 20+ clears in Master Quest the Link cap sits on the Chief helmet; a possible small look-at step at the
  first-person switch with 7-9 hats; the fallback with hats.js missing was checked by reading the guards, not run;
  BFG cuffs under a skin, Chief in first person, the cave and the shooter with hats were not looked at.
- Andross: on a phone the boss name and HP bar overlay the top of the face (same rest position as the old hive); the hit
  flash was not clearly told apart from the normal face in the real game; README does not mention the new look.
- Test harness trap met tonight: two headless Chromes running at once on this machine starve each other (pages not
  loaded when `startGame()` clicks, false failures). Run harnesses one at a time.

## 2026-10-04: PALMER logo screen, Konami level select (BUILT, integration-tested, NOT committed, NOT heard)
Duncan, verbatim: "Can you add an homage to the sega logo screen in sonic 2. You can use the sega font, but have it say
PALMER. And instead of the classic 'SEEEGGAAAA', have it say 'PAAAALMEEEEEEERRR'. Also, I would like the user to be able
to input the 'konami code'. If they do, they'll get a level select (the various levels we've talked about - boss, shmup,
overworld for both standard and master quest), and 50 lives when they start."

**Nothing is committed.** Working tree: `M _layouts/default.html` (one script tag), `M assets/js/intro.js`,
`M assets/js/quest.js`, `M assets/js/shmup.js`, `?? assets/js/chant.js`, plus `M README.md` and this file.
`?? assets/js/hats.js` is a separate, unwired draft (see "Hats" below). **Nobody has listened to the chant**: every audio
claim below is a level measurement or a scheduling check, not an ear.

### What was built
- **Flow**: attract (silent, unchanged) -> first click/key = coin -> new phase `logo` -> `title` card -> PRESS START.
  The title theme now starts when the title phase begins (`onScore('title')`), not at the coin.
- **PALMER logo** (`intro.js`, `drawLogo`): white screen, the box-art man dashes across both ways as a blur and leaves
  PALMER in the SEGA logotype (procedural, 275 px wide in the 320x224 buffer), blue shimmer, dissolve to white.
  Wall-clock timed. `CHANT_AT = 1.22` s: the dashes are silent and the chant lands on the finished logo, so the phase
  is chant + 1.62 s = **about 4.6 s** (3.4 s with no chant / music off). The contract said ~3.4 s; set `CHANT_AT = 0`
  for the short version. A click/key skips it after the first 350 ms and cuts the chant. If the chant timer fires late
  (busy main thread) the logo waits for the chant instead of cutting it (integrator fix, capped at +3 s).
- **Chant** (`assets/js/chant.js`, `window.PalmerChant = { duration: 3.0, render(sr[, variant]), warm(), play(ctx[, dest]) -> {stop(fade)} }`):
  detuned choir of glottal saws through formant resonators, /p/ /A:/ /l/ /m/ /3r/, then an 8-bit 16 kHz DAC model. Pure
  JS, renders under node. Loaded `defer` just before intro.js. intro.js calls it guarded (`window.PalmerChant &&
  api.musicWanted()`); with chant.js blocked the logo and the game still work (tested).
- **Konami code** (SECRET: not in README or any page copy, keep it that way): up up down down left right left right B A
  during attract, logo or title. Keyboard: with focus on the game every key of the code is eaten; without focus UP/DOWN
  still scroll the page (a reader tapping UP must not be swallowed) and only the later LEFT/RIGHT/B/A of a code in
  progress are taken. A wrong key resets and behaves normally. Touch: four-direction swipes on the box, then any two
  taps. 4 s allowed between steps. Success plays a four-note square-wave cue and opens phase `select`.
- **Level select** (phase `select`, in the 320x224 buffer): STANDARD: OVERWORLD / THE EDITOR-IN-CHIEF / PUBLISH OR PERISH;
  MASTER QUEST: OVERWORLD / REVIEWER 2 / PUBLISH OR PERISH 2; `LIVES x50`; a small preview; `< BACK`. Arrows/WASD move
  (left/right swaps column), Enter/Space/F/click/tap choose, Esc/Backspace/BACK returns to the title card. Choosing
  calls `opts.onWarp({loop, level})`.
- **Host** (`quest.js`): `onWarp` in the same loop stops the intro and begins there with no reload; the other loop
  stores the warp and reloads (`#play`), and the page opens directly on the title card, silent, with one extra line
  ("LEVEL SELECT - REVIEWER 2"); one click starts. `api.params.cheat` (bool) and `api.params.warp` ({loop, level} or
  null); `api.params.loop` is the effective loop. 'boss' = what `?endgame=1` does, 'shmup' = what `?shmup=1` does.
- **50 lives**: `MAX_HITS = 50`, hearts HUD shows `♥x50` (any MAX_HITS > 12 shows a count); shooter starts with 50
  ships and gets 50 again after a continue; both shooter HUD layouts show `x50` when lives > 6.

### sessionStorage keys (both die with the tab; a warp never writes localStorage)
- `quest.warp` = JSON `{loop: 1|2, level: 'town'|'boss'|'shmup'}`: a pending cross-loop warp. Overrides LOOP for that
  page load only, is passed to `intro.start` as `opts.warp`, and is removed when the game begins.
- `quest.cheat` = `'1'`: set by a warp. **A page load with no pending `quest.warp` removes it**, so the cheat lasts for
  the warped run only (in-page chains boss -> shooter -> ending keep it in memory).
- A cheat session neither reads nor writes `quest.found` / `quest.cave`: its town starts fresh and the save is untouched.

### `quest.clears` (localStorage, integer): groundwork for hats
`shmup.js countClear()` adds 1 when the loop-1 shooter reaches PUBLISHED! and the run used no cheat, warp, `?god`,
`?shmupgod`, `?shmup`, `?endgame`, `?shmupstage`, `?shmupdbg` or the bot. `api.restart()`, `api.startLoop2()` and
"Reset progress" do not clear it. Intended use: one hat per completed loop-1 run.
**Hats**: NOT in the game. `assets/js/hats.js` (`window.QuestHats`, untracked) is a draft module that no script tag
loads and nothing calls; the integration run did not test it. Which hats/skins to ship is awaiting Duncan's pick.

### Departures from the written contract (deliberate, from review findings)
- In a cheat session `api.restart()` (PLAY AGAIN) only clears the two session keys and reloads to the saved game, and
  `api.startLoop2()` (SECOND LOOP) is a cheat warp to the Master Quest overworld; neither writes localStorage. Outside a
  cheat session both are as before. "Reset progress" always wipes (`wipeSave()`), and keeps `quest.clears`.
- The logo is 4.6 s, not 3.4 s (above).

### Test hooks
- intro object: `.phase`, `.active`, `.drawErrors` / `.drawError`, `._seek(sec)` (freezes the clock on a frame; a click
  unfreezes), `._setPhase(name)`, `._buffer()` (the 320x224 canvas). The object lives inside quest.js; a harness reaches
  it by wrapping `window.QuestIntro` before load: see the shim in `.dev/tmp/logo-final/h.mjs` (also records
  `PalmerChant.play/stop`, `onScore`, `onWarp` with timestamps). No debug handle was added to the repo's JS.
- The Konami keys are only taken while the game box is on screen: after a `goto` without `#play`, scroll to `#quest` first.
- Seed a warp directly: `sessionStorage.setItem('quest.warp','{"loop":2,"level":"boss"}')` then load the page.
  `quest.cheat` alone does nothing now (dropped at load).
- Suite (scratch, port 9441): `.dev/tmp/logo-final/` `t1` logo/chant timing, `a1` flow + keyboard code + wrong codes,
  `a3 d|m [savedLoop]` the six destinations, `a4` real touch events on 390x844, `t3 d|m` shooter lives, `a5` the clears
  counter with positive/negative controls (patches the served shmup.js in flight to reach the ending), `a6` storage
  blocked / music off / chant.js missing, `t4` screenshots + MQ overworld with saved finds.

### Final integration results (2026-10-04, headless Chrome, served bytes hash-matched to disk)
All green on the final files (logs in `.dev/tmp/logo-final/*.log`), zero console errors and zero draw errors in every run:
- `a1` 38/38: attract -> coin -> logo -> title -> PRESS START -> town; skip by click and by key; `startGame()`; the
  code in attract, logo and title; broken/partial codes; Esc back to the title.
- `t1` in-page timestamps: chant `play` 1.23 to 2.2 s after the coin (see open issue 4), title theme at logo end, an
  early skip never starts the chant, a late skip stops it at the click. (Its three FAIL lines are the old fixed-time
  thresholds; the logo now moves with a late chant by design.)
- `a3 d` 43/43: all six destinations by keyboard from a loop-1 save; `♥x50`; `quest.found`/`quest.loop` untouched;
  a plain reload afterwards is a normal five-heart session. `a3 d 2` (from a saved Master Quest): green except the two
  checks that assume issue 10's in-place start; `t4` clicks that path through. `a3 m`: both bosses on a phone.
- `a4` 10/10 real touch events at 390x844: swipes + two taps -> select, tap REVIEWER 2 -> reload -> one tap -> boss
  with `♥x50`; broken swipes then a tap is a normal coin; no page scroll from swipes on the box.
- `t3 d|m`: shooter starts on 50 ships in both loops, both HUD layouts show `x50`.
- `a5`: positive control (an honest loop-1 ending) counts 1 then 2, once per ending; seven negative controls (loop 2,
  warp, level-select run, `?god`, `?shmupgod`, `?endgame`, `?shmupstage=ending`) do not count; restart/startLoop2 keep it.
- `a6`: sessionStorage blocked (menu recovers, same-loop warp still works), music off (no chant), chant.js blocked.
- `node .dev/regress.mjs`: all passed, non-cheat hearts `♥♥♥♥♥`, 0 errors.

### Audition files (WAV, 16-bit mono 48 kHz, byte-identical to a re-render of the final chant.js)
- `.dev/tmp/render/palmer-chant.wav`: the wired-in chant (variant 0, sounded L, E4 -> C#4).
- `.dev/tmp/render/palmer-chant-alt1.wav`: silent L ("PAH-mer"). `.dev/tmp/render/palmer-chant-alt2.wav`: lower choir.
  To switch, change the default variant in `render()` in chant.js. Re-render: `node .dev/tmp/logo-fix-chant/m.mjs assets/js/chant.js <outdir>`.
- Screenshots for Duncan: `.dev/tmp/logo-final/` `logo-mid.png`, `logo-full.png`, `select.png`, `select-phone.png`,
  `hearts50.png`, `lives50.png` (+ `hearts50-phone.png`, `lives50-phone.png`, `warp-card.png`).

### Open issues (all of them)
1. **The chant has not been heard by anyone.** Whether it reads as "PALMER", whether the strengthened /p/ burst is a P or
   a pop (burst peak 0.653 vs vowel peak 0.708; lower the `2.5` burst multiplier if it pops), and the pronunciation
   (sounded L vs British "PAH-mer", alt1) are Duncan's call. The last 150 ms of the tail sits in the bottom bits of the
   8-bit quantiser and may fizz. The AH vowel was only moderately pinned by formant measurement.
2. Chant level against the title theme and the SFX mix was never balanced by ear (-3 dBFS peak, -16.2 dBFS RMS).
3. Logo length 4.6 s vs the 3.4 s asked for in the contract: Duncan's call (`CHANT_AT`).
4. In headless Chrome under load the chant timer fired 0.3 to 1.0 s late on some loads (on time, 1.23 s, on others). The
   logo now waits for it. [ASSUMPTION: harness/machine load, load average was 12+; not reproduced in a real browser.]
5. Desktop: the 320x224 frame is stretched non-uniformly and by a non-integer factor into the wide game box (also true
   of the attract and title card, which predate this); the logotype looks wider on desktop than in `logo-full.png`.
6. Phone: while the intro is up, a swipe that starts on the game box does not scroll the page (`touch-action: none`);
   the page scrolls from above/below it. Restored when the intro stops.
7. Keyboard without focus on the game: the UP/DOWN of the code scroll the page as typed (net zero for the full code).
8. The shooter high score (`quest.shmup.hi`) is still written in a cheat session (one-line guard in `saveHi` if unwanted).
9. A reload in the middle of a warped run drops the cheat and returns to the saved game on the attract screen.
10. Master Quest OVERWORLD chosen from a saved Master Quest that already has finds reloads through the title card
    instead of starting in place (works, save intact; tested).
11. Without the cheat, the shooter HUD shows `x7` instead of icons once lives exceed 6 (extends); previously icons capped.
12. After a declined warp (sessionStorage blocked) the menu re-arms after 1.2 s; the host guard makes a repeat harmless.
13. Real devices, Safari and iOS are untested: the audio wake on the warp card, touch-action, and the swipes were only
    run in headless Chrome with emulated touch.
14. `.dev/tmp/orch-verify/v9-title.mjs` predates the logo phase and assumes the old title timing; `cdp-lib.mjs
    startGame()` still works (tested).
15. hats.js is unwired and unreviewed here (above).

### 2026-10-04 (late): hats WIRED into the game (not committed)
- `_layouts/default.html` loads `hats.js` (defer, before quest.js). `quest.js`: `CLEARS` = localStorage `quest.clears`
  (guarded), overridden for one page load by the test hook `?clears=N`; `hats.apply/update/setVisible` next to the MQ cap
  code, all in try/catch. With 0 clears the module is never instantiated and the camera is untouched (`hatLift = 0`).
- 1..9 tower, 10+ Snake, 20+ Chief; MQ passes `baseY 3.18` (tower above the Link cap); Chief + MQ moves the cap to
  y 2.93 and uses `baseY 3.27`. Camera look-at lifts by `height() * 0.18` only when `height() > 3`. First-person arm
  materials (`armMats`) take `hats.palette()`. Snake's box is held off unless `running && !dialogOpen && !fp && !over && !endgame`.
- Seen in screenshots (`.dev/tmp/hats-wire/final/`): clears 0/1/5/9 loop 1, 9 and 25 in loop 2, 10, 20, box drop + lift,
  no box after 5 s in a dialogue, endgame first person with 9 and with 10 (blue sleeve, dark glove). `regress.mjs` green.
- Open: reviewers catch an idle man within a couple of seconds, so the box is rarely seen in the town unless he rebuts
  first; BFG cuffs under a skin not looked at; the cave and the shooter were not checked with hats; Duncan has not seen any of it.

## 2026-09-29: shooter SFX on a YM2612 model; SFX levelled under the music: DONE, APPROVED, committed
Duncan, verbatim: "the sound effects aren't yamaha enough on the shooter section. Also, now the soundtrack is too
quiet by comparison." riff.js / riff2.js are untouched (hash-checked); the fix is all on the SFX side.
Workflow `wf_a44e617c-daa` (session 142cdeff) finished: meter, YM2612 rebuild, level passes, 5 reviews, 9 skeptics,
2 fixers, integration. All results: `.dev/tmp/resume/wf_a44e617c-results.json` (to the verify stage) and
`.dev/tmp/resume/yamaha-summary.txt` (fixes and integration). Duncan approved the
sound on 2026-10-04 and the WIPs were squashed into four commits after `8a063df` (shooter SFX, first-person levels,
removal of unused leftovers, docs); the pre-squash history is on branch `backup/pre-squash-2026-10-04`. Not pushed.

- shmup.js: SMPS-style effect scores on a YM2612 model (53,267 Hz, ladder effect, Model 1 low-pass then linear
  resampling, FM-feedback noise, DAC booms); modulators now sustain through each sound (no near-sine cues); a soft
  ceiling after the bus limiter; hitHard's carriers at 2.6 kHz; beamWarn sweeps 784-1663 Hz.
- fpsfx.js: MIX tiers per sound (gun -19.5 dB, routine -10.5, BFG -13, hurt -10/-12, one-offs -4 to -8), a
  brighter weak-point tone at low steps, a 2.6 kHz edge on heart.lost, hit.crit as an unducked accent.
- Shared meter: `node .dev/tmp/mixmeter/mix.mjs editor|reviewer2|shmup1|shmup2|tlb --port <p> --profile <n>`.

| section (SFX minus music, median / p90 dB; rule <= -9 / <= -4) | what Duncan heard | now |
|---|---|---|
| EDITOR fight (paper) | +0.4 / +2.1 | -14.7 / -6.0 PASS |
| EDITOR fight, BFG held | about -3 / -0.3 | -9.8 to -10.1 / -5.0 to -5.3 PASS |
| REVIEWER 2 fight | +0.7 / +4.4 | -13.0 / -4.3 PASS (thin) |
| shooter stage 1 | -10.0 / -2.8 | -14.5 / -9.7 PASS |
| shooter loop 2 | -9.4 / -2.2 | -10.1 / -6.3 loudness PASS; hits masked 4-9 of 223 (was 121) |
| True Last Boss | -11.8 / -5.3 | -11.9 / -7.1 loudness PASS; hitHard masked 58-62 of 208 (was 107) |

**Decisions for Duncan:** (1) the TLB boss-hit sound is still masked about 30% of the time in the brightest
passages; +3.5 dB on hitHard cuts that to 8% but costs 2.7 dB of the music's lead (`mix.mjs tlb --gain
hitHard=3.5`). (2) Timbre changes needing his OK: hitHard up an octave is APPROVED, tentatively (2026-10-04: "I
like after I think"; already the shipped voicing, no change; `_hitHard-AB` was never rendered). Also APPROVED
2026-10-04 ("keep the new"), all already shipped: the brighter weak-point tone (`sfx-fps/_hit.weak-before-after.wav`),
the heart-lost edge (`sfx-fps/_heart.lost-before-after.wav`), and the shooter fix pass (`sfx-shmup-ym/_fix-AB.wav`).
Decision (1) DECIDED 2026-10-04: no hitHard gain; "keeping the music loud is fine". Accept the ~30% TLB masking.
**Duncan can only play .wav, not .m4a:** every audition file below has a .wav twin beside it; point him at those,
and render any new audition as .wav.
**Minor, open:** first-person music + SFX can exceed 1.0 for under 0.1 ms (EDITOR 3 samples, REVIEWER 2 up to 4);
a soft ceiling on the FPSFX bus like the shooter's would likely remove it (untested). The meter's editor log lacks
held BFG fire (the fixer's `.dev/tmp/fpsfx/fix3/lib.mjs` has it) and its shooter replay overstates loop-2 misses
(use `--engine`).
**Audition:** `.dev/tmp/render/mix/*-mix.m4a` vs `*-mix-before.m4a` (five sections, 60 s each); the shooter bank
before/after at matched loudness: `.dev/tmp/integ3/audition/shmup-short-montage-A-before.m4a` vs
`shmup-short-montage-B-new-matched.m4a`.

## 2026-09-28: SFX upgrade + first person only after eight facts (built, tested, committed, not pushed)
Duncan (after playing): "upgrade the sound effects for each section. For the shmup section, take inspiration from
m.u.s.h.a aleste. Similarly for the fps section - take inspiration from doom and house of the dead for sound
effects. Finally - we currently zoom into fps mode after a little while. Let's stop doing that and only do it after
the 8 items are collected." He likes the music: riff.js and riff2.js are unchanged (hash-checked).
Built by workflow `wf_754b5f5b-ee7` (session 142cdeff; journal under its subagents/workflows folder), then review,
verify, fix and an integration pass that was green in both loops end to end.
- `assets/js/fpsfx.js` (window.FPSFX): shared first-person kit, 49 sounds, contract and as-shipped wiring in
  `.dev/sfx-contract.md`. Wired into quest.js, boss.js and magician.js (tagged groups, stopAll per group).
- `shmup.js`: its own Mega Drive FM/PSG bank (about 47 effects), idle-time warm-up, a 16-voice cap; `__qs.sfx` under
  ?shmupdbg=1.
- quest.js: first person only via startEndgame; dread, the music and the world still darken over time. Reviewers
  can no longer be shot, so the ACCEPTED counter is gone from index.md. CAUGHT_REST (1.5 s without catches after a
  demand closes) applies to BOTH loops, a deliberate change to loop 1 for fairness at dread 1 in third person.
Duncan auditioned the two short montages on 2026-09-28: "they sound good to me". Audition `.dev/tmp/render/sfx-fps/_short-montage.m4a` and
`.dev/tmp/render/sfx-shmup/_short-montage.m4a` (full montages and per-sound files beside them; per-host mixes in
`sfx-quest/`, `sfx-boss/`, `.dev/tmp/magsfx/render/`). Known limits: music and SFX run on separate AudioContexts and
can sum past full scale for a fraction of a millisecond (the real fix is a shared final limiter via riff.js, which
was off limits); the first play of a big kit sound can block 60-130 ms if not warmed (both bosses warm during the
card); boss.js has no `__qb` debug handle.

## 2026-09-27: the second loop is BUILT, reviewed, integration-tested and COMMITTED (not pushed)
Duncan's 2026-09-26 request (verbatim in `.dev/loop2-contract.md`, with his two addenda) is done: the title
cinematic and MR. E are gone, the overworld theme is rewritten by hand, and the SECOND LOOP exists end to end
(Master Quest town with the Link cap, REVIEWER 2 as the HotD2 Magician, the DOJ-style shooter loop, the True Last
Boss PEER REVIEW, TENURED!, and four new tracks plus three stingers). README.md documents all of it.

How it got here: build workflow `wf_3309ac86-532` (session b826815a) died on a session limit; resume workflow
`wf_1d11e7a9-59c` (session 142cdeff) finished everything. That run: a completion pass per file (magician restyle,
Link hat and HUD/fairness fixes, riff2 mix, shmup finish), 2-3 review lenses per module, a skeptic per major
finding, one fixer per module, then an integration checker. Its full per-agent results are in
`~/.claude/projects/-Users-dpalmer-Repositories-astheeggeggs-github-io/142cdeff-73f4-46e5-8051-db574e26e336/subagents/workflows/wf_1d11e7a9-59c/journal.jsonl`.

Integration (all green): regress.mjs, w1 title 13/13, w2 town 14/14, w5 music 41/41, w6 static 44/44, and the
whole loop-2 chain title → town → 8th fact → magician → shooter loop 2 → TLB → TENURED! → PLAY AGAIN → loop 1 with
0 console errors. w3 and w4 in `.dev/tmp/orch-verify/` are STALE (they read canvas-drawn shooter text from the
DOM); use the adapted `.dev/tmp/integ/w3b-magician.mjs` and `w4b-shmup2.mjs`. `orch-verify/helper.mjs` pumpUntil
never returns early (it burns its whole budget); `.dev/tmp/integ/fast.mjs` has a fixed `until()`.

**Git:** committed on `rebuild-with-game` as seven commits, `050b917` (title) through the docs commit; the WIP
commit `237ea8f` was squashed into them. Nothing is pushed; push only when Duncan asks. Never add Co-Authored-By.
The preview artifact is not republished (only on request).

**Open, for Duncan to judge (he has since played it and called the soundtrack great):**
- Music: all verified by measurement only. Audition files: `.dev/tmp/render/*.m4a` (overworld, master quest,
  title, magician, space2 with the full form, true last boss).
- Magician time-to-kill: 177 game-s with a scripted aimer at 100 HP (target 90-180), about 133 s simulated for a
  60 fps human. If it feels long, lengthen the exposure windows (PH wind/rec in magician.js).
- Loop-2 shooter is brutal: an idle ship loses a life every ~4-5 s in stage 2-1; for the dodging bot the loop-2
  IMPACT FACTOR phase 0 is harsher than any TLB phase. The tlbwarn stinger covers ~3 s of the 5.6 s WARNING card.
- Pre-existing, loop 1, left alone so loop 1 stays identical: a reviewer catches a standing player 2-3 s after
  PRESS START; phone toasts overlap the FACTS pill and the d-pad UP. The MQ layout (mqFit) would fix the latter.
- quest.js collide() deletes shots at trees, lamps and benches at any height; the magician's plates fall to
  street level when he dies on a roof.
- The BFG's four quality problems (section below) are still unaddressed.

## What this repo is
Duncan Palmer's personal site (Jekyll → GitHub Pages, `https://astheeggeggs.github.io/`). The live site is
still the 2019 version: **nothing here has been pushed.** Everything below is committed on the local branch
`rebuild-with-game`. Push only when Duncan asks. His global rule: never add `Co-Authored-By` lines.

Pages: `index.md` (home: intro, the game, About, selected work), `research.md`, `publications.md` (filterable,
from `_data/publications.yml`), `code.md`. Styling in `assets/css/swank.css`. No theme gem.
**README.md now documents all of the game properly — read it before this file.**

## State: everything is committed and the smoke test is green.

Thirteen commits on `rebuild-with-game`, oldest first:

| commit | what |
|---|---|
| `a298b47` | the rebuild + endgame host plumbing (pre-existing) |
| `6e31e99` | `shmup.js` — the bullet-hell shooter |
| `f75f7fd` | `boss.js` — THE EDITOR-IN-CHIEF |
| `d7f6889` | reviewer AI: nav grid + review pass |
| `e2f5d97` | `riff.js`: boss layer, space track, stingers + review pass |
| `2800e19` | shooter review pass |
| `a40fb49` | Moonlight Sonata for the cave |
| `87924cd` | boss review pass |
| `34ed99e` | the fountain secret level (`cave.js`) |
| `fee02cb` | the title screen (`intro.js`) + integration |
| `0beb966` | the Koshiro title theme, scored to the cinematic |
| `fd4678d` | mobile header fix + README |
| (last) | the BFG: the professor and the gun — see below |

### THE BFG: committed, WORKS, but has four known quality problems
Duncan asked: when the boss lands, an NPC says *"it's dangerous to go alone - take this"* and gives you
the BFG from Doom, making the fight much easier. It is built and committed (`boss.js` + `quest.js`): a
PROFESSOR EMERITUS appears in the rubble at the end of the landing, says the line verbatim, and hands
over a BFG9000 that punches through the journal-cover guard and has a blast radius, so aiming is far more
forgiving. An independent checker confirmed he appears reliably, the plasma ball reads, and the fight is
still fair and winnable if you ignore him.

A fix pass for the four problems below was RUNNING AND WAS STOPPED when Duncan had to leave. The code on
disk is structurally complete (every function present and called, everything parses, no debug handles,
`.dev/regress.mjs` green) but the fix pass did not finish, so assume NONE of these are fixed and re-check
each one:
1. **Nobody will find him.** He spawns 84.5 degrees off the line from the player to the boss — completely
   off screen — and nothing points you round. Needs to be 30-45 degrees off, plus an off-screen chevron
   at the edge of the view (`cave.js` already does exactly this for its underspend; copy that).
2. **Too strong.** Time-to-kill measured 14 game-seconds against a 35-60 s target, and the fight becomes
   "point at the torso and hold F". 10 damage on a ~1 s refire puts an arithmetic floor near 13 s, so cut
   damage to ~4-5 and keep the blast radius and the guard-punch — those remove frustration, not challenge.
3. **The talk prompt eats the phone d-pad.** At 390x844 the prompt is x119-271 y194-221 and the d-pad is
   x35-177 y178-319: it covers UP outright and has `pointer-events: auto`.
4. **The gun reads as a flat slab** from the only angle you ever see it — you fight pitched 20-25 degrees
   up at the badge but the held pose is pitched +0.11 rad, so you look down onto the top rail.
Smaller, all confirmed: plasma balls in flight survive into the victory cinematic; a single F tap near him
never fires; `s.inRange` is not cleared when he is behind you; `hitTest`'s `big` fallback would give a
paper ball 10 damage if any caller omitted the third argument; and every plasma ball carries its own
PointLight, so three.js recompiles shaders as the count oscillates 1-4.
The stopped fix pass and its full brief are at
`.claude/.../workflows/scripts/bfg-fix-wf_54622ecb-d7e.js` — relaunch it with `Workflow({scriptPath})`.
Both reviewers' full reports are in `wf_f840f0ef-470/journal.jsonl`.

## What is NOT done
1. **Nobody has heard any of the music.** Five tracks, all verified by measurement only — pitches against
   the Mutopia engraving, onsets against the beat grid, levels against the limiter. Whether it *sounds*
   good is unverified and Duncan settles it in ten seconds. Known open questions: the title theme leans
   hardest on the shared master chain (pre-limiter peak ~2.2-2.6, worst gain reduction -11.6 dB, output
   peak 0.76-0.81 so nothing clips); its dynamic arc measures flatter at the output than intended (the
   drop is only ~0.5 dB above the build); and the cave theme may still be too quiet and too dark.
2. **The full nine-point checklist has not been re-run end to end since the title screen went in.** The
   pieces have each been verified in isolation and `.dev/regress.mjs` passes, but the whole chain
   (title → town → 8 facts → boss → BFG → blast-off → shooter → ending) has not been played in one go.
3. The preview artifact has not been republished (correct — only on request).

## Traps that cost real time here
- **Headless Chrome throttles `requestAnimationFrame` to about 1 Hz** unless something asks the compositor
  for a frame. The game clock therefore barely advances during a plain `sleep`, and a test can report
  green while exercising almost nothing. `.dev/tmp/lib-pump.mjs` forces frames by capturing tiny
  screenshots — use it for every wait meant to advance game time, with `?timescale=`. This invalidated
  several early measurements before it was found.
- **Jekyll's rebuild lags an edit by tens of seconds**, so a harness can silently measure the *previous*
  version of a file and return plausible, unchanged numbers. Block until the bytes the server returns
  hash-match the bytes on disk. Disabling the CDP cache is not sufficient — the cache was never the issue.
- `b.startGame()` now clicks through the title sequence (coin → skip → start), so it takes up to ten
  clicks. Any bespoke harness that clicks `.q-start` once will sit on the attract screen.
- Stale headless Chromes squatting a debugging port make `launch()` attach to the wrong page and produce
  confusing failures. `pkill -f remote-debugging-port` before a run if things look strange.
- A user interrupt (Esc) kills a running Workflow and its agents stop mid-edit. Afterwards, check every JS
  file parses and `grep -n "__dbg\|__debug\|TEMP" assets/js/*.js`.

## Dev environment
- Server: `export PATH="/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/4.0.0/bin:$PATH"; bundle exec jekyll serve --port 4321`
  (Homebrew Ruby 4; system Ruby 2.6 is too old). Auto-regenerates; NEVER write into `_site/`.
- Test harness: `.dev/cdp-lib.mjs` (Node 22+, no deps). `.dev/regress.mjs` is the smoke test.
  The orchestrator's own checklist scripts are in `.dev/tmp/orch-verify/` (v1 regression, v2 the real
  8-fact trigger, v3 the boss fight, v4 the shooter, v5 music, v6 static hygiene, v7 reviewer-AI stalls,
  v8 the fountain, v9 the title sequence). `.dev/tmp/` is gitignored, so they are scratch, not deliverables.
- Private preview artifact: https://claude.ai/artifact/59tSZLwvnTzgK5Kto7Gr43 (published 2026-09-28; the older
  previews were deleted at Duncan's request). jekyll serve keeps `_site/` current, so rebuild with
  `python3 .dev/bundle-artifact.py`, then Artifact publish with that `url`. **Only when Duncan asks.**
- Numbers hard-coded on pages (citations 15,821, h-index 28, 16 biobanks, 1.2M) came from Scholar on
  2026-09-02 and drift.

## Duncan's taste (learned the hard way — respect these)
- KEEP the blocky BOX characters (`boxMan`). A rounded "Mario 64" rig was tried and rejected ("oof, terrible").
- Pixel font for ALL game text. Dry academic humour (reviewers, editors, finance, h-index).
- Do not spoil surprises in page copy (the first-person switch is unannounced: "Don't stay too long.").
- Site chrome minimal and clean so the game pops. A Doom-style alt game was built then removed on request.
- Music must be ONE evolving piece for the 3D world (he rejected a two-jingle crossfade). Voices LOUD.
- Short, efficient comms. Separate observed from assumed.
- On the MR. E caricature: he alludes to a real, living, Jewish public figure. Tech-mogul grotesque is the
  target — bloat, vanity, teeth, the corporate monolith. The antisemitic visual vocabulary is off the
  table: no hooked nose, no moneybags, no puppet strings, no octopus or grasping hands over the city.
  This is why the Streets of Rage 2 frame's cupped hands became a giant cheque. Duncan agreed the line
  explicitly ("absolutely - that's completely fair"). **Do not undo that substitution.**
