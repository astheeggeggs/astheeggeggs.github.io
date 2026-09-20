export const meta = {
  name: 'endgame-build',
  description: 'Build boss fight, bullet-hell shooter, music and reviewer AI in parallel; adversarially review, fix, then playtest end to end',
  phases: [
    { title: 'Build', detail: '4 builders on disjoint files' },
    { title: 'Review', detail: '3 lenses per module' },
    { title: 'Verify', detail: 'skeptics try to refute each finding' },
    { title: 'Fix', detail: 'one fixer per module' },
    { title: 'Playtest', detail: 'end-to-end run, independent audit, final fixes' },
  ],
}

const REPO = '/Users/dpalmer/Repositories/astheeggeggs.github.io'
const SP = '/Users/dpalmer/Repositories/astheeggeggs.github.io/.dev/tmp'
const CONTRACT = '/Users/dpalmer/Repositories/astheeggeggs.github.io/.dev/endgame-contract.md'

const COMMON = `
You are one of several agents working IN PARALLEL on the same repository: ${REPO}
FIRST read the shared contract in full: ${CONTRACT}
Then read assets/js/quest.js in full (about 900 lines; the host game) so you understand the world, the api object near the bottom, the art style and the tone. Skim assets/js/riff.js and index.md as needed.
Obey the file-ownership table in the contract strictly. Another agent may be editing quest.js while you test: if the page is momentarily broken by someone else's file, wait ten seconds and retry rather than touching their file.
The dev server is already running at http://127.0.0.1:4321/ with auto-regeneration (allow ~2 s after saving). Never start or stop Jekyll. No git state changes. Scratch files only in ${SP}.
The end user is a statistical geneticist (Duncan Palmer) who has been delighted by the game so far; the bar is a polished, funny, genuinely playable result, not a tech demo. Finish the WHOLE brief; do not leave TODOs or stubs.
`

const MODULES = [
  {
    key: 'boss', file: 'assets/js/boss.js', port: 9410,
    brief: `
YOUR JOB: write ${REPO}/assets/js/boss.js implementing window.QuestBoss exactly per the contract.

THE USER'S WORDS: "If the player successfully collects all of the facts, immediately move into first person (if not in it already), and increase dread. Have a huge dark souls style boss drop from the sky. It shoots projectiles at you. The only way you can win is if you hit it in its weak spot (you can hint at it somehow - maybe have a house of the dead 2 style intro to the boss). In order to win, you have to hit it 100 times. At that point, you blast off into space and the game changes into a bullet hell shooter." and later: "when the boss lands, have it destroy all of the buildings".
(The host already handles: first person, dread ramp, weapon buff, hold-to-fire, hearts, REJECTED! and retry. You own everything from start() to api.onBossDefeated().)

CREATIVE DIRECTION (follow it; add your own flourishes):
- The boss: THE EDITOR-IN-CHIEF. Box-art like every character in this game (build from boxes; you may scale api.boxMan or build custom), roughly 16-18 units tall, black academic robes, mortarboard or crown, glowing red eyes, a giant red pen. Slow, heavy, telegraphed: Dark Souls weight.
- WEAK POINT: its H-INDEX: a glowing badge on its chest that literally displays the number (start at opts.hp, normally 100) and counts down by one with every weak-spot hit. Only those hits count. Body hits clank, spark and do nothing; the first few body hits should teach the player (a toast such as NO EFFECT. AIM FOR THE H-INDEX). Give the fight texture: the badge is not always exposed (for example it is guarded by crossed arms or an orbiting shield of journal covers, and opens up during attack wind-ups and recovery). Balance so a competent player wins in roughly 1.5-3 minutes: the weapon fires every 0.13 s, shots travel 70 u/s with slight drop. The badge must be hittable from the ground at sensible ranges (view pitch limit is +-1.2 rad).
- HOUSE OF THE DEAD 2 STYLE INTRO CARD (the hint): in that game each boss is introduced by a dossier screen: the boss shown as a rotating schematic, its name, a TYPE code number, and the WEAK POINT flashing on the diagram with a leader line and label. Do that: a full-panel overlay in the pixel font, dark CRT green/teal on black with scanlines, a rotating schematic of the boss (a 2D canvas drawing built from the same box proportions works well: fake the rotation by scaling x with a cosine and swapping front/side silhouettes), text like TYPE 0100 / THE EDITOR-IN-CHIEF / a dry epithet, and a blinking red reticle on the chest badge with a line to WEAK POINT: H-INDEX. About 5-6 s, skippable with F / Space / Enter / click after 1 s. Skip the whole intro when opts.skipIntro.
- THE DROP: omen first (music to silence via api.music('silence'), a growing shadow on the ground at the world origin, camera tilts to the sky), then the boss falls from high above onto the origin in about a second with a whistle, and lands: api.shake(2.5, 1.6), api.stinger('impact'), an expanding ground shockwave ring, dust. THE LANDING DESTROYS EVERY BUILDING: each api.places[i].group bursts into its component boxes (detach the child meshes, give them velocities away from the impact plus upward, gravity, tumble, one bounce, then settle/fade and get removed), staggered by distance from the origin so the wave visibly rolls outward; remove each place.collider from api.colliders; hide place.marker; flatten or remove place.bushes; leave low non-colliding rubble where each building stood. The fountain at the origin is crushed (remove api.fountain.group and its collider). Optional comic touches with api.npcs are welcome but keep their colliders consistent. Must be idempotent: on opts.retry the town is already flat and the boss simply stands there at full HP.
- Then api.music('boss'), a Dark Souls style boss name + wide thin HP bar bottom centre (with the lagging yellow damage ghost), moved out of the way of the touch controls on small screens.
- ATTACKS (it shoots projectiles at the player, all telegraphed at least 0.7 s, all dodgeable by strafing or jumping with Space): e.g. MAJOR REVISIONS (aimed volley of glowing red manuscripts/orbs, around 14-18 u/s), DESK REJECT (stomp, a ground shockwave ring you must jump), REVIEWER COMMENTS (red-pen strokes raining down with ground markers, or a sweeping fan). Phase 2 at 50 percent HP and a desperation phase at 20 percent with faster cadence and combined patterns; announce phases with api.notice using a deep slow voice (e.g. {base: 70, wave: 'sawtooth', spread: 0.2}) and dry editor lines. Player collision: capsule at api.player.position, radius about 0.6, height 2.6 above position.y. Damage through api.hurt(1) only. Keep the player inside a sensible arena; the boss may turn slowly to face the player and stride about, and needs a collider so the player cannot walk through it.
- DEATH AND BLAST-OFF: at zero the badge shatters, light bursts out, the boss comes apart into boxes, a Dark Souls VICTORY ACHIEVED style banner reads MANUSCRIPT ACCEPTED (pixel font, gold, fading band), api.stinger('victory'). Then the player BLASTS OFF INTO SPACE: a short cinematic you drive (cinematic = true, api.setHud(false), api.lockEnvironment(true)): the manuscript becomes the rocket, a 3-2-1, api.stinger('launch'), flames and smoke below, a violent accelerating ascent with shake, the ruined town shrinking, fog pushed back, sky to black with streaking stars, then a full-screen white flash, and exactly once call api.onBossDefeated() (the shooter fades in from white). Whole outro at most about 10 s and skippable.
- SFX: synthesise your own with api.audio() (impacts, clanks, roars, projectile whoosh, badge hit ping that rises in pitch as the count falls). Keep levels sane.
- Lifecycle: stop() must leave nothing behind (meshes, DOM, listeners, timers), and start() must work again afterwards. Never leave cinematic stuck true. While api.isOver() the host stops calling update(); tolerate that.

TEST (port 9410, profile 'boss'): with ?endgame=1&timescale=3 watch the intro card, the drop and the destruction (screenshots; LOOK at them: is the card legible, is the boss huge and in frame, are the buildings gone, is the HP bar right?). With ?endgame=1&skipintro=1&bosshp=3&god=1&timescale=4 verify body hits do nothing, weak-spot hits count down, death leads to blast-off and api.onBossDefeated fires exactly once (shmup.js may not exist yet: the host then shows a toast, that is fine). Verify projectiles actually hit a stationary player without god mode, REJECTED! appears, and pressing Space after it restarts the fight with the boss present and no intro. You will need to aim: use api.lookAt through a temporary debug handle or compute camera aim; remove debug handles before finishing.
`,
    lensNotes: 'Checklist of user requirements: HotD2-style intro that hints the weak spot; huge Dark Souls style boss that DROPS FROM THE SKY; landing DESTROYS ALL BUILDINGS; boss SHOOTS PROJECTILES at the player; ONLY weak-spot hits count; 100 hits to win; then BLAST OFF INTO SPACE and hand over via api.onBossDefeated() exactly once. Retry after REJECTED! must work. Box-art style, pixel font.',
  },
  {
    key: 'shmup', file: 'assets/js/shmup.js', port: 9411,
    brief: `
YOUR JOB: write ${REPO}/assets/js/shmup.js implementing window.QuestShmup exactly per the contract: after the boss dies the player blasts off into space and "the game changes into a bullet hell shooter". The user's inspiration, verbatim: "I'm thinking dodonpachi mixed with truxton."

DESIGN (a complete, finishable arcade game of about 4-6 minutes; 2D canvas, everything procedural):
- Vertical scroller. Logical playfield about 360x480 (3:4), rendered to an offscreen canvas and scaled up with nearest-neighbour (imageSmoothingEnabled = false) inside the 16:9 api.view, with arcade side panels either side carrying score, hi-score, lives, bombs, chain, weapon and level in the pixel font, like a cabinet bezel. On viewports narrower than 700 px make the overlay position: fixed; inset: 0 (full viewport, page scroll locked while active) so the portrait playfield is big enough, with HUD overlaid on the playfield instead of side panels. The overlay starts WHITE and fades out (the boss cinematic ends on a white flash), then a STAGE 1 title card.
- The ship: the game's protagonist (blond hair, glasses, grey suit, box-art) riding a rolled-up manuscript rocket; pixel sprite drawn procedurally to an offscreen canvas. Tiny hitbox (about 2 px radius) shown as a glowing dot while focusing or lasering. Banking frames when moving sideways, thruster flame.
- DODONPACHI DNA: tap fire = wide spread SHOT at full ship speed; HOLD fire = concentrated LASER with the aura around the ship, and the ship slows (precision dodging). HIT chain counter with a draining gauge that keeps the chain alive, chain drives the score multiplier; dense but fair danmaku (aimed streams, n-way fans, rings, spirals, curtains with readable gaps, slow bullets mixed with fast); bullets pink and blue with bright white cores and dark outlines for readability; on boss phase breaks and bombs all bullets cancel into collectible score medals (call them citations); big multi-phase bosses with health bars and a warning klaxon card (WARNING: A HUGE EDITORIAL BOARD IS APPROACHING or similar).
- TRUXTON DNA: three colour-coded weapons swapped by collecting drifting colour-cycling pickups: RED power shot (wide spread), BLUE thunder laser (lock-on lightning that arcs to enemies), GREEN sniper beam (piercing straight beam); P pickups raise weapon level (4 levels), S pickups raise speed, B adds a bomb, rare 1UP; the BOMB is the Truxton skull: a giant pixel skull blooms from the ship, clears every bullet and scorches everything on screen; big mechanical boss ships, scrolling space backdrop with parallax starfields, nebulae and passing station girders.
- Theme and humour: you are flying the accepted manuscript through the publication pipeline. Stage 1 COPYEDITING (popcorn enemies: red pens, staples, query marks, track-changes brackets), mid-boss THE TYPESETTER; Stage 2 PROOFS / PRODUCTION (paywalls, embargo satellites, open-access fees), and the final boss THE IMPACT FACTOR (a huge rotating numeric core with orbiting journal covers, three phases, a Hibachi-grade last phase). Enemy names and boss taunts in the side panel or a caption line.
- Controls: move WASD / arrows; fire Z or Space or J (tap vs hold as above); bomb X or K or B; focus Shift (optional slow); P or Escape pause; M toggles music via api.setMusicWanted / api.music('space'). preventDefault on the keys you use so the page does not scroll. Touch: drag anywhere moves the ship by relative offset (not teleport), auto-fire laser while touching, an on-screen BOMB button (also two-finger tap). 
- Rules: 3 lives, 3 bombs (restocked on death), brief invulnerability on respawn, auto-bomb is NOT required. Game over shows an arcade CONTINUE? 9..0 countdown with unlimited continues (score resets, a continues counter shows on the ending) so that everyone can reach the end.
- ENDING: after the final boss a proper ending screen: PUBLISHED! with stats (score, max chain, continues), a line of dry humour, real links taken from api.links (publications, research, code, email; open external ones in a new tab), PLAY AGAIN (api.restart()) and BACK TO THE SITE (scroll the page to the element with id 'boring', leave the ending screen up). api.stinger('ending').
- Audio: api.music('space') at start; synthesise SFX with api.audio() (very quiet shots since they are constant, crunchy explosions, a huge bomb, pickup arpeggios, chain-break blip, boss warning klaxon). Respect api.musicWanted().
- Engineering: fixed-capacity object pools (typed arrays or reused objects) for bullets (about 800), enemy shots, particles, medals; zero allocations in the hot loops; sprites pre-rendered to offscreen canvases; own requestAnimationFrame loop with dt clamped and multiplied by api.params.timescale; pause automatically when the tab is hidden or the game panel is scrolled out of view; stage scripts as data tables (time, enemy type, x, pattern). stop() removes everything (DOM, listeners, rAF).
- Test hooks you must add (query string): ?shmupstage=2 | boss | ending to jump ahead, ?shmupgod=1 for invulnerability.

TEST (port 9411, profile 'shmup'): http://127.0.0.1:4321/?shmup=1&timescale=2 then startGame(). Screenshot stage 1, a mid-boss, the skull bomb, the final boss (via ?shmupstage=boss&shmupgod=1), the continue screen, and the ending (?shmupstage=ending); LOOK at each: is it readable, is the playfield centred and crisp, do the side panels fit, does it look like an arcade shooter? Verify tap vs hold behaviour, weapon swapping, the chain counter, death and continue, pause, and that a full run from stage 1 to the ending is possible with god mode and held fire at a high timescale with zero console errors. Test the narrow layout with b.mobile().
`,
    lensNotes: 'Checklist of user requirements: a BULLET HELL shooter, inspired by DODONPACHI (tap shot vs hold laser with slowdown, chain counter, tiny hitbox, dense readable patterns, big bosses, bullet-cancel medals) mixed with TRUXTON (red/blue/green weapons from pickups, P/S power-ups, the skull bomb, space backdrop). Must be finishable (continues), have an ending screen with real links from api.links, work with touch, not scroll the page, pause when hidden.',
  },
  {
    key: 'music', file: 'assets/js/riff.js', port: 9412,
    brief: `
YOUR JOB: extend ${REPO}/assets/js/riff.js (read ALL of it first; it is a small WebAudio synth with a composed, seed-generated overworld piece that mutates with a dread value: parallel minor, tempo curve, drone, tritone, industrial stabs, heavy drums). Everything is synthesised at runtime: no samples, no MIDI files, nothing to license. Keep every existing API member working exactly as now.

ADD:
1. Riff.boss(on): the boss-fight layer for a Dark Souls style boss (the host calls setDread(1) then boss(true) when the boss lands, boss(false) when leaving). Joined on the next bar line so it is seamless. It should feel like a FromSoftware boss theme played on this synth: a choir (formant-filtered detuned saws singing aah/ooh chords, G minor, e.g. i - VI - iv - V with the raised leading tone), timpani hits and rolls, low brass-like saw swells, tubular bell on section starts, the existing gallop chug and heavy drums kept, tempo held around 150 regardless of the dread tempo curve, and the remaining cute overworld melody, arpeggios and bell harmonies silenced while it is on. Watch the polyphony: budget the number of simultaneously sounding oscillators so laptops do not crackle.
2. Riff.play('space'): a SEPARATE composed track for a vertical bullet-hell shooter in the spirit of DoDonPachi and Truxton arcade soundtracks: fast (about 165-175 bpm), heroic and driving: octave-pumping bass, arpeggiated pulse leads, a singable lead melody with vibrato, snare on 2 and 4 with sixteenth hats and fills, key E minor with lifts to G major, an intro, A, B, a breakdown and a boss-ish section, at least 2.5 minutes before it loops, and the loop must be seamless (end on a turnaround into bar 1). Compose it once from a fixed seed the way composeOverworld does (form + progressions + generated themes reused on section returns). play('space') must reset the dread filter to fully open and ignore dread; play('quest') must restore normal behaviour. Make Riff.play choose the scheduler by style, keep Riff.bind button sync correct for both styles, and make stop() clean.
3. Riff.stinger(name): one-shots that work whether or not a track is playing: 'impact' (a cataclysmic landing: sub drop, low boom, noise crash, about 2.5 s), 'victory' (triumphant brass-like fanfare in G major, about 4 s), 'launch' (rocket: rising filtered noise sweep plus rumble and a pitch riser, about 5 s), 'ending' (a gentle resolved cadence reprising the overworld A theme, about 6 s). Unknown names are ignored.
4. Riff.info() should also report the space track length in seconds.

TEST (port 9412, profile 'music'): syntax check; then in headless Chrome on the real page (autoplay is allowed by the harness) exercise: play('quest') with setDread stepping 0 → 1, boss(true) for 20 s, boss(false), play('space') for 30 s, each stinger, stop(), toggle; assert no exceptions and that Riff.playing reports correctly. Measure, do not guess: tap the master output with an AnalyserNode (a temporary hook is fine, remove it after) and report peak and RMS for each mode so nothing clips (peak under 1.0) and nothing is silent; count scheduled voices per second in the densest mode and keep it reasonable (report the number). Verify the space loop boundary by temporarily shortening the form and listening for scheduling gaps via timing logs (nextT continuity). Report the numbers you measured.
`,
    lensNotes: 'Checklist: Riff.boss(on) Dark Souls style layer joined on a bar line; Riff.play("space") separate DoDonPachi/Truxton style track, at least 2.5 min, seamless loop, ignores dread; Riff.stinger for impact/victory/launch/ending; existing API intact (play quest, stop, toggle, bind, setDread, takeover, info, playing, dread, metal); no clipping, no oscillator explosion, timers cleaned on stop.',
  },
  {
    key: 'ai', file: 'assets/js/quest.js', port: 9413,
    brief: `
YOUR JOB: fix and improve the AI of the six chasing reviewers in ${REPO}/assets/js/quest.js. The user's words: "can you improve the ai of the reviewers (enemies) - currently they just get stuck".
You may edit ONLY the baddie AI code in quest.js: the BADDIES setup block, updateBaddies(), and new navigation helper functions/vars you add next to them. Do NOT touch the api object, the endgame section, input handling, or anything else (three other agents are reading this file as their contract right now). Make each edit atomically (apply with a script or single Edit, then immediately syntax-check) so the file is never left broken.

DIAGNOSIS TO CONFIRM FIRST: updateBaddies() makes each reviewer beeline at the player; when collide() blocks a move it just picks a random yaw, so they jam against buildings, trees, the fountain, benches, lamp posts, rocks and the lake. Reproduce it and measure it before changing anything (baseline), so you can prove the improvement (after).

WHAT TO BUILD:
- A navigation grid over the playable area (about 1 unit cells across +-(WORLD+4)); a cell is blocked if collide(cx, cz, about 0.55) is true. Build lazily, and rebuild if colliders.length changes (the boss fight later removes building colliders).
- A shared breadth-first distance field from the player's cell, recomputed about 3 times a second (not per reviewer, not per frame), 8-connected without cutting corners. Typed arrays, no per-frame allocation.
- Behaviour: with a clear line of sight (sample collide along the segment) a reviewer runs straight at its target; otherwise it follows the field downhill with smoothed steering. Wall sliding when a move is blocked (try each axis, then rotate the heading) instead of random spinning. A stuck detector (wants to move but has covered under about 0.3 units in a second) that re-paths or nudges to the nearest free cell centre. If a reviewer is ever inside a collider (after knockback or respawn) move it to the nearest free cell. Separation so they do not stack on one another. Fleeing (b.flee > 0) uses the field uphill or a slid away-vector so fleeing reviewers do not jam either. Wandering near home stays as is but must not jam.
- Make them smarter, not just unstuck: give each reviewer an approach slot around the player so they surround and flank rather than conga-line; in first person (the fp variable) let them zigzag a little when the player is aiming at them (use viewDir()) so rebuttals are not free; keep them fair (no speed above what exists now beyond the dread scaling already present).
- Keep all existing semantics: the catch test (distance under 1.7, b.cool, pstate.y under 1.2 so jumping over them works), caught(), rebut(), shotHit(), b.down respawn, the dread scaling of speed and detection range, the walk animation via pose(), and that reviewers are skipped entirely once endgame is true.
- Performance: budget well under 1 ms per frame for all six on a laptop; report the measured BFS time.

TEST (port 9413, profile 'ai'): use a temporary window.__debug handle (removed before you finish) to place the player and reviewers: e.g. player in front of the Library door with reviewers spawned behind the building row, behind the fountain, and across the lake; at ?timescale=4 log each reviewer's distance-to-player over game time and assert every reviewer that is within detection range reaches catching distance within a sensible time, and that no chasing reviewer's displacement stalls. Report baseline versus after numbers. Also run a normal minute of play for zero console errors and confirm REJECTED!/resubmit still works (?dread=0.71&maxhits=1).
`,
    lensNotes: 'Checklist: reviewers must no longer get stuck on buildings, trees, the fountain, benches, lamps, rocks or the lake; shared BFS field not per-frame per-agent; existing catch/rebut/shot/respawn semantics intact; endgame skip intact; ONLY baddie AI code in quest.js was touched (diff against ' + SP + '/quest.pre-endgame.js is NOT valid for this since the host integration also changed; instead check that the api object and endgame section still match the contract).',
  },
]

const BUILD_SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' }, tested: { type: 'string', description: 'what you ran and what you observed, with numbers' },
  knownIssues: { type: 'array', items: { type: 'string' } }, apiRequests: { type: 'array', items: { type: 'string' } } },
  required: ['summary', 'tested', 'knownIssues'] }
const FINDINGS_SCHEMA = { type: 'object', properties: { findings: { type: 'array', maxItems: 6, items: { type: 'object', properties: {
  title: { type: 'string' }, line: { type: 'integer' }, severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
  scenario: { type: 'string', description: 'concrete inputs/state → wrong behaviour' }, suggestedFix: { type: 'string' } },
  required: ['title', 'severity', 'scenario'] } } }, required: ['findings'] }
const VERDICT_SCHEMA = { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object', properties: {
  title: { type: 'string' }, real: { type: 'boolean' }, severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, reason: { type: 'string' } },
  required: ['title', 'real', 'reason'] } } }, required: ['verdicts'] }
const FIX_SCHEMA = { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } }, tests: { type: 'string' } }, required: ['fixed', 'skipped', 'tests'] }
const PLAY_SCHEMA = { type: 'object', properties: {
  stages: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, pass: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['name', 'pass', 'evidence'] } },
  fixesApplied: { type: 'array', items: { type: 'string' } }, remainingIssues: { type: 'array', items: { type: 'string' } }, screenshots: { type: 'array', items: { type: 'string' } } },
  required: ['stages', 'fixesApplied', 'remainingIssues'] }

const LENSES = [
  { key: 'runtime', text: 'RUNTIME CORRECTNESS AND LIFECYCLE: exceptions, undefined access, wrong maths, state machines that can wedge (a flag that never clears, a cinematic that never ends, a callback that fires twice or never), start/stop/restart idempotence, leaked listeners/timers/rAF loops/meshes/DOM, behaviour under large dt (timescale 4-8) and under pause (REJECTED!, hidden tab), and exact compliance with the interface in the contract. Run it.' },
  { key: 'gameplay', text: 'DOES IT DELIVER WHAT THE USER ASKED FOR, AND IS IT GOOD: go through the checklist of user requirements line by line and find what is missing, half-done, unfair, unreadable, unwinnable, too easy to cheese, or visually broken. Run it, take screenshots, LOOK at them. Judge text legibility, framing, HUD overlap with the existing HUD and touch controls, difficulty and pacing against the brief.' },
  { key: 'perf', text: 'PERFORMANCE AND HOST INTEGRATION: allocations in per-frame loops, unbounded arrays, geometry/material/texture/audio-node leaks, excessive draw calls or oscillators, z-index and layout clashes with the host page, pointer-lock and keyboard conflicts (page scrolling on Space/arrows, keys leaking to the host or vice versa), touch usability, anything that would break when the page is bundled into a single HTML file (root-relative URLs other than api.links, reliance on _site paths), and any violation of the file-ownership rules.' },
]

const results = await pipeline(
  MODULES,
  // ---- Build
  (m) => agent(COMMON + m.brief + `\nUse CDP debugging port ${m.port} only. Return a factual report: what you built, what you tested with observed numbers, known issues, and any api additions you wish the host had (do not make them yourself).`,
    { label: 'build:' + m.key, phase: 'Build', schema: BUILD_SCHEMA }),
  // ---- Review (3 lenses in parallel per module)
  async (build, m, i) => {
    const reviews = await parallel(LENSES.map((lens, k) => () =>
      agent(COMMON + `\nYou are a REVIEWER, not an author: do not edit any project file. Review ${m.file} (${m.key} module) through ONE lens:\n${lens.text}\n\n${m.lensNotes}\n\nThe builder reported: ${JSON.stringify(build || {}).slice(0, 3000)}\nDo not trust that report; check for yourself. You may run the game with the CDP helper on debugging port ${9420 + i * 3 + k} (profile 'rev-${m.key}-${lens.key}'); test scripts go in the scratchpad.\nReturn at most 6 findings, most severe first, each with a concrete failure scenario (inputs/state → wrong behaviour) and the line number. Only report things you have actually substantiated in the code or by running it. If the module is genuinely fine through your lens, return an empty list.`,
        { label: `review:${m.key}:${lens.key}`, phase: 'Review', schema: FINDINGS_SCHEMA })
        .then(r => ({ lens: lens.key, findings: (r && r.findings) || [] }))))
    return { build, reviews: reviews.filter(Boolean) }
  },
  // ---- Verify (one skeptic per lens batch)
  async (prev, m, i) => {
    const batches = prev.reviews.filter(r => r.findings.length)
    const verdicts = await parallel(batches.map((r, k) => () =>
      agent(COMMON + `\nYou are a SKEPTIC. Do not edit any project file. Another reviewer claims the following defects in ${m.file} (${m.key} module). For EACH one, try to REFUTE it by reading the actual code and, where useful, running the game (CDP port ${9440 + i * 3 + k}, profile 'ver-${m.key}-${k}'). Mark real=true only if you can confirm the failure scenario really occurs (or the requirement really is unmet); if you cannot substantiate it, mark real=false. Correct the severity if it is overstated. Echo each title exactly.\n\nFindings:\n${JSON.stringify(r.findings, null, 1)}`,
        { label: `verify:${m.key}:${r.lens}`, phase: 'Verify', schema: VERDICT_SCHEMA })
        .then(v => ({ lens: r.lens, findings: r.findings, verdicts: (v && v.verdicts) || [] }))))
    const confirmed = []
    verdicts.filter(Boolean).forEach(b => b.findings.forEach(f => {
      const v = b.verdicts.find(x => x.title === f.title)
      if (v && v.real) confirmed.push({ ...f, severity: v.severity || f.severity, lens: b.lens, verifierNote: v.reason })
    }))
    const raised = prev.reviews.reduce((n, r) => n + r.findings.length, 0)
    log(`${m.key}: ${raised} findings raised, ${confirmed.length} confirmed`)
    return { build: prev.build, confirmed, raised }
  },
  // ---- Fix
  async (prev, m, i) => {
    if (!prev.confirmed.length) return { ...prev, fix: { fixed: [], skipped: [], tests: 'nothing to fix' } }
    const fix = await agent(COMMON + m.brief + `\nYou are now the FIXER for ${m.file}. The module already exists (read it in full). Independent reviewers found the defects below and skeptics confirmed each one. Fix every critical and major finding properly (root cause, not a patch over the symptom) and every minor one that is cheap; do not regress anything else; keep to the file-ownership rules. Then re-run the relevant tests from the brief on CDP port ${9460 + i} (profile 'fix-${m.key}') and report what you observed.\n\nConfirmed findings:\n${JSON.stringify(prev.confirmed, null, 1)}`,
      { label: 'fix:' + m.key, phase: 'Fix', schema: FIX_SCHEMA })
    return { ...prev, fix }
  },
)

// ---- Playtest: everything together (barrier is genuine: needs all four modules finished)
phase('Playtest')
const summary = results.map((r, i) => ({ module: MODULES[i].key, build: r && r.build && r.build.summary, knownIssues: r && r.build && r.build.knownIssues, apiRequests: r && r.build && r.build.apiRequests, fixed: r && r.fix && r.fix.fixed, skipped: r && r.fix && r.fix.skipped }))

const play = await agent(COMMON + `
You are the INTEGRATION PLAYTESTER. All four modules are now built and individually fixed. File ownership is lifted for you: you may edit any of assets/js/boss.js, assets/js/shmup.js, assets/js/riff.js and assets/js/quest.js (and, only if truly necessary, index.md or assets/css/swank.css) to fix integration defects. Keep fixes minimal and root-cause.
Module reports: ${JSON.stringify(summary).slice(0, 6000)}
Consider the builders' apiRequests: implement in quest.js only the ones that are clearly needed for correctness.

Drive the REAL page end to end with the CDP helper (port 9470, profile 'play'), take screenshots at every beat, LOOK at them with the Read tool, and check the console is clean throughout:
 1. Regression: a normal start, run about, jump, a reviewer chase (reviewers must navigate round obstacles), first-person switch (?dread=0.69), rebuttal fire, REJECTED! (?maxhits=1) and resubmit.
 2. The real trigger path, not just the hook: collect all 8 facts legitimately (teleporting the player to each door through a temporary debug handle and pressing F is fine), close the last sign, and confirm the endgame starts from there: first person forced, dread ramps, reviewers vanish.
 3. Intro card legible and skippable; the boss drops from the sky; EVERY building is destroyed and their colliders are gone (walk through where the Library stood); fountain crushed; boss HP bar and hearts visible, no overlap with HUD or touch controls.
 4. Boss fight: body hits do nothing and teach; weak-spot hits count; projectiles hurt; hearts drain; REJECTED! then Space restarts the fight without the intro and with the town still flat; with ?bosshp=4 kill it: death, MANUSCRIPT ACCEPTED, blast-off, white flash, and the shooter starts exactly once.
 5. Shooter: fades in from white, controls, tap versus hold, weapons, bomb, chain, death and CONTINUE, pause, final boss (?shmupstage=boss), ending screen links and buttons (PLAY AGAIN really resets progress and reloads).
 6. Music: boss layer on landing, space track in the shooter, stingers fire, the HUD music toggle and M key behave, silence after REJECTED!.
 7. A returning player who already has all 8 facts saved gets the endgame after the toast; Reset progress link works.
 8. Narrow/touch layout via b.mobile(): boss HUD and the shooter are usable.
 9. Also bundle-safety: grep the three module files for root-relative URLs or _site paths other than api.links.
Fix what you find, re-test the affected beat, and report each stage with evidence (what you observed, screenshot path). Remove every temporary debug handle before finishing. Finish with node syntax checks of all four JS files.`,
  { label: 'playtest:integration', phase: 'Playtest', schema: PLAY_SCHEMA })

const audit = await agent(COMMON + `
You are an INDEPENDENT AUDITOR. A playtester claims the endgame now works end to end: ${JSON.stringify(play || {}).slice(0, 5000)}
Do not trust it. Do not edit project files. Re-run the critical path yourself with the CDP helper (port 9471, profile 'audit') at a modest timescale: (a) ?endgame=1 intro → drop → all 8 buildings gone → fight; (b) ?endgame=1&skipintro=1&bosshp=3 kill via the weak spot → blast-off → shooter starts once; (c) without god mode get REJECTED! in the boss fight and retry; (d) ?shmup=1&shmupstage=boss&shmupgod=1 → ending screen; (e) a plain regression run with a reviewer chase. Screenshots at each beat, LOOK at them. Also read the diff-prone areas of quest.js (api object, startEndgame, retryBoss, launchShmup, updateBaddies) for anything wedged or half-removed, and confirm no temporary debug handles remain (grep for __debug, __q, console.log).
Report each stage pass/fail with evidence, and list remaining issues precisely (file, line, scenario).`,
  { label: 'playtest:audit', phase: 'Playtest', schema: PLAY_SCHEMA })

let finalFix = null
const failed = ((audit && audit.stages) || []).filter(s => !s.pass)
if (failed.length || ((audit && audit.remainingIssues) || []).length) {
  finalFix = await agent(COMMON + `
You are the FINAL FIXER. File ownership is lifted: you may edit boss.js, shmup.js, riff.js, quest.js (and index.md / swank.css only if essential). An independent audit of the finished endgame found these problems:
Failed stages: ${JSON.stringify(failed)}
Remaining issues: ${JSON.stringify((audit && audit.remainingIssues) || [])}
Reproduce each with the CDP helper (port 9472, profile 'final'), fix the root cause, re-test, remove any debug handles, and syntax-check all four JS files. Report what you fixed, what you could not, and the tests you ran.`,
    { label: 'playtest:final-fix', phase: 'Playtest', schema: FIX_SCHEMA })
} else log('audit clean: no final fix needed')

return { modules: summary, confirmedFindings: results.map((r, i) => ({ module: MODULES[i].key, raised: r && r.raised, confirmed: r && r.confirmed && r.confirmed.map(f => f.severity + ': ' + f.title) })), play, audit, finalFix }
