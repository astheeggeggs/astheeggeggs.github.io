# Second-loop contract — "Palmer's Progress" (2026-09-26)

Repo: /Users/dpalmer/Repositories/astheeggeggs.github.io (Jekyll site → GitHub Pages). The home page embeds a Three.js
(r160, global `THREE`) third-person → first-person game in `assets/js/quest.js`. Read `README.md` (the game section) and
`.dev/HANDOVER.md` first: they describe every module, the test harness and its traps, and Duncan's taste.
A dev server with auto-regeneration is ALREADY RUNNING at http://127.0.0.1:4321/ — never start or kill Jekyll; never run
git commands that change state; never write into `_site/`. Scratch files ONLY in `.dev/tmp/` (gitignored).

## What Duncan asked for (verbatim)
> I love the intro, but it doesn't match with the initial portion of the game. Let's get rid of it, but keep the title
> font and buildings. When starting the game, I think the music could be more interesting (it's a little annoying at
> the moment).
>
> Also, after initial completion, (last shmup boss) it would be awesome to include a much harder second loop, (initial
> level, boss, and shmup) with associated music. Take inspiration from Zelda OOT: Master quest (initial level), the
> magician from HoTD 2 (boss) and tough second loop for the shmup. For that, take inspiration from DoDonPachi
> DaiOuJou, and the famously brutal True Last Boss (TLB). Retain the academia theme you currently have.

## The plan, module by module (STRICT file ownership — six agents work in parallel; never edit a file you do not own)
| file | owner | job |
|---|---|---|
| `assets/js/intro.js` | intro agent | remove the scored cinematic and MR. E; keep the attract skyline, the logo and the title card |
| `assets/js/riff.js` | music-A agent | rework the overworld piece (`quest`), add its Master Quest variant (`quest2`), retime the title theme, add `Riff.render` |
| `assets/js/riff2.js` (new) | music-B agent | loop-2 tracks registered through the plug-in hook: `magician`, `space2`, `tlb`, plus stingers |
| `assets/js/quest.js` | quest agent | the Master Quest overworld (mirrored map, more and faster reviewers, faster dread, fewer hearts, HUD) |
| `assets/js/magician.js` (new) | magician agent | the loop-2 boss, same interface as `QuestBoss` |
| `assets/js/shmup.js` | shmup agent | the second loop of the shooter (DoDonPachi DaiOuJou style) and the True Last Boss, the loop-1 ending's SECOND LOOP button, the true ending |
| `index.md`, `assets/css/swank.css`, `_layouts/*`, `_includes/*`, `.dev/bundle-artifact.py` | nobody (already wired) | modules inject their own DOM and a `<style>` tag from JS |

Already done by the orchestrator (do not redo, do rely on it):
- `_layouts/default.html` loads, in order: three.min.js, riff.js, riff2.js (defer), intro.js, cave.js, boss.js, magician.js, shmup.js, quest.js (all defer).
  `riff2.js` and `magician.js` do not exist yet: a 404 for them is expected until their owners write them.
- `riff.js` has the plug-in hook (`Riff.addStyle`, `Riff.addStinger`, `Riff.kit`, `Riff.has`), see below.
- `quest.js` has the loop-2 routing (`LOOP`, `api.params.loop`, `api.startLoop2()`, `api.restart()` clears the loop,
  `music()` routes `quest` → `quest2` in loop 2 and any registered plug-in track by name, the boss module is
  `QuestMagician` in loop 2, `shmup.start({loop})`).

## The story
Loop 1 is the game as it exists: town → eight facts → THE EDITOR-IN-CHIEF → blast-off → PUBLISH OR PERISH → PUBLISHED!.
The PUBLISHED! screen now also offers **▶ SECOND LOOP** (calls `api.startLoop2()`: sets `localStorage quest.loop = '2'`,
clears the facts and the fountain prize, reloads). Loop 2 is MASTER QUEST: the same town mirrored left-to-right, nine
faster, cleverer reviewers, dread that rises faster, three hearts instead of five, no floating markers over the
buildings, its own overworld score; then a different boss — an anonymous, teleporting, fire-throwing reviewer in the
mould of the Magician from The House of the Dead 2 — then the shooter's second loop (suicide bullets, denser and faster
patterns, harder bosses) ending in a True Last Boss, then the true ending (**TENURED!**), whose PLAY AGAIN returns to
loop 1 (`api.restart()`). `?loop=2` on the URL forces loop 2 for one session without touching storage.
Dry academic humour throughout: peer review, editors, grant finance, impact factors, h-indices, the REF. Pixel font
("Press Start 2P") for all game text. Box characters (`api.boxMan`) for every person. No spoilers on the page copy.

## Code rules (unchanged from the endgame build)
- Plain browser JS in an IIFE, ES5 style like the existing files (`var`, `function`), no build step, no new
  dependencies, no external assets (everything procedural: geometry, canvas-drawn sprites, WebAudio SFX and music).
- Never throw into the host: guard optional things, wrap callbacks. Zero console errors.
- 60 fps on a laptop: reuse geometries/materials, pool objects, cap particle counts, dispose what you remove.
- `dt` can be large (timescale test hook, tab switches): clamp or sub-step so nothing tunnels or explodes.
- Touch devices must still work (the d-pad and A/B buttons in quest.js; the shooter's drag + bomb button).
- Make each edit atomically (apply with a script or a single Edit, then immediately syntax-check with
  `node -e "new Function(require('fs').readFileSync('FILE','utf8'))"`), so the page is never left broken for the others.

## The host API (`api`, built in quest.js — read the "endgame" section near the bottom of quest.js)
Everything in `.dev/endgame-contract.md` still holds (THREE, root, view, scene, camera, renderer, WORLD, EYE, colliders,
collide, safeSpot, player, pstate, places, fountain, npcs, flat, boxMan, pose, labelSprite, blip, speak, grunt, audio,
showToast, notice, hurt, heal, hearts, teleport, lookAt, shake, setHud, lockEnvironment, setWeapon, music, musicWanted,
setMusicWanted, stinger, isOver, params, links, onBossDefeated, restart). New or changed:
```
api.params.loop            // 1 or 2
api.startLoop2()           // shooter → loop 2 (storage + reload). Only the shooter's loop-1 ending calls it.
api.restart()              // clears quest.found, quest.cave AND quest.loop, reloads: back to loop 1
api.music(name)            // 'quest' | 'boss' | 'space' | 'cave' | 'title' | 'silence' as before; in loop 2 'quest' becomes
                           // 'quest2' when that track exists; ANY name Riff.has() is played directly ('magician', 'space2', 'tlb')
api.stinger(name) → bool   // built-ins (impact, victory, launch, ending) plus anything registered with Riff.addStinger; true if it fired
api.setWeapon({kind:'paper'|'bfg', rate, speed, gravity})
```
In loop 2 the host constructs `window.QuestMagician(api)` instead of `window.QuestBoss(api)` and calls it exactly the
way it calls the editor: `start({hp, skipIntro, retry})`, `stop()`, `update(dt, t)`, `hitTest(pos, prev, kind)`,
reads `active`, `cinematic`, `ended`. The host buffs the weapon before `start()` (rate 0.13 s, speed 70, gravity 2.5)
and does NOT hand out the BFG: loop 2 is paper balls only, that is the point.

## Boss-module interface (boss.js today; magician.js must match it exactly)
```
window.QuestMagician = function (api) { return {
  start: function (opts) {},   // opts {hp, skipIntro, retry}. retry=true, skipIntro=true after REJECTED!: no intro, boss already present, full HP
  stop: function () {},        // remove everything (meshes, projectiles, DOM, listeners, timers); restore setHud(true), lockEnvironment(false); active=false, cinematic=false
  update: function (dt, t) {}, // every frame while active and not game-over. dt seconds (timescaled), t elapsed seconds
  hitTest: function (pos, prev, kind) {},  // every live player shot every frame (THREE.Vector3, do not mutate). kind is 'paper' (loop 2 never gets 'bfg', but tolerate it).
                                            // Swept test prev→pos. Return 'weak' | 'body' | null. YOU apply damage + feedback. Truthy → host deletes the shot.
  active: false, cinematic: false, ended: false   // plain properties read every frame: keep them current
}; };
```
When the boss dies: your own victory beat, then a blast-off (you may be shorter and different from boss.js's rocket,
but the hand-over is the same): `api.onBossDefeated()` exactly once → the host launches the shooter with `{loop: 2}`.

## Shooter interface
`shmup.start({loop: 1|2})`, `stop()`, `active`. Loop 1 unchanged except the ending gains ▶ SECOND LOOP → `api.startLoop2()`.
Loop 2: `api.music('space2')` at the start, `api.music('tlb')` when the True Last Boss arrives (falls back gracefully
if `Riff.has('tlb')` is false: `api.music` ignores unknown names). The true ending: `if (!api.stinger('tenure')) api.stinger('ending')`
(music-B registers `tenure`; the magician may use `if (!api.stinger('reveal')) api.stinger('impact')` for his arrival).

## riff.js plug-in hook (already in riff.js — music-B codes against this; music-A must keep it working)
```
Riff.addStyle(name, { schedule: function (S) {}, dreadful: bool, info: function () {} })
   // schedule(S) runs every 100 ms while that style plays. S = {now, nextT, step, dread, boost}.
   // Schedule audio from S.nextT up to S.now + 0.3 s and advance S.nextT / S.step, exactly like scheduleSpace()
   // in riff.js (drop what is already late: while (S.nextT < S.now - 0.05) { S.nextT += spb; S.step++; }).
   // dreadful:true → the dread low-pass applies (for an overworld-like track); otherwise the filter is fully open.
Riff.addStinger(name, function (t) {})     // one-shot at AudioContext time t; use Riff.kit().sting / stingOut() as the destination
Riff.kit()   // {AC, master, out (=owMix, pre dread-filter), metal, dist, sting, gate, duck, f, noise, loopNoise, env, pluck, pulse,
             //  tanh, curve, mulberry32, kick, snare, hat, tom, crash, riser, softKick, brush, shaker, chug, lead, marimba, ocarina,
             //  bell, bass, pad, drone, heartbeat, choir, chant, vowel, timp, brass, tubular, sLead, sArp, sBass, sPad, tBass, tAcid,
             //  tStab, tHoover, tLead, tPad, tKick, tSnare, tClap, tHat, tTom, tCrash, tRise, tFall, tSub, tRumble, tCoin, fmBell,
             //  caveBass, caveLead, stingOut, sTone, sNoise, sHorns, sTimp, duckFor, softBus, spaceBus, caveBus, titleBus, titleEcho,
             //  hall, choirBus}
             // kit() creates the AudioContext: call it inside schedule()/stinger functions, NEVER at script load.
             // Oscillators and buffer sources created on kit().AC are tracked, so Riff.stop() silences them.
             // Most kit voices route to a fixed bus (sLead → spaceBus → owMix; tBass → titleBus → master; etc.): read riff.js
             // before using one, or build your own voices and connect them to kit().out / your own gain into kit().master.
Riff.has(name)         // true for quest | space | cave | title and every addStyle name
Riff.play(name) / Riff.stop() / Riff.playing / Riff.style   // as before; plug-in styles never get the boss layer
Riff.info()            // includes each plug-in's info() under its name
```
music-A adds `Riff.render(style, seconds, opts)` → `Promise<AudioBuffer>` (offline render: OfflineAudioContext, the
module's buses rebuilt on it, the scheduler driven by a fake clock, then the live state restored untouched). Plug-in
styles must render through it too (drive `schedule(S)` with `S.now` advancing). `opts.dread` may be a number or a
function of seconds. This is how anyone measures a track without listening: RMS envelope, peak, onset density,
spectral centroid over time. music-B: poll for `typeof Riff.render === 'function'` before relying on it; until then
measure with an AnalyserNode on the live output as the endgame build did.

## Test hooks (query string, all optional)
`?loop=2` · `?endgame=1&loop=2` (magician after PRESS START) · `?shmup=1&loop=2` · `?shmupstage=2|mid|boss|tlb|ending`
(`tlb` = jump to the True Last Boss; `ending` in loop 2 = the true ending) · `?shmupgod=1` · `?bosshp=5` · `?skipintro=1`
· `?god=1` · `?timescale=1..20` · `?dread=0.71` · `?maxhits=1` · `?cave=1` · `?bossdbg=1` (boss.js's debug handle; the
magician should offer the same shape under the same flag: `window.__qb = {info(), aim(deg)}`).

## How to test (required before you report done)
1. Syntax: `node -e "new Function(require('fs').readFileSync('FILE','utf8'))"`.
2. Drive the real page in headless Chrome with `.dev/cdp-lib.mjs` (read its header) and `.dev/tmp/lib-pump.mjs`
   (`pumper(b)`: headless Chrome throttles requestAnimationFrame to about 1 Hz unless something asks for a frame, so
   EVERY wait that is meant to let game time pass must pump, not sleep). `.dev/tmp/orch-verify/helper.mjs` has
   `open()`, `pumpUntil()`, `walkTo()`, `seedFacts()`, `aim()`. Use ONLY the debugging port and profile name given in
   your prompt (others run Chrome at the same time). Always `close()`. `pkill -f "remote-debugging-port=YOURPORT"`
   if a stale Chrome squats your port.
3. Jekyll's rebuild lags an edit by several seconds: after saving, wait until `curl -s http://127.0.0.1:4321/assets/js/FILE`
   matches the bytes on disk (compare a hash) before measuring, or you will measure the previous version.
4. Take screenshots and LOOK at them with the Read tool. `b.errors` must be empty (ignore 404s for riff2.js /
   magician.js while their owners have not written them yet).
5. `b.startGame()` clicks through the title (coin → PRESS START); it stops as soon as the overlay is gone.

## Duncan's taste (learned the hard way — respect it)
- KEEP the blocky BOX characters (`boxMan`). A rounded "Mario 64" rig was tried and rejected ("oof, terrible").
- Pixel font for ALL game text. Dry academic humour. Do not spoil surprises in page copy.
- Site chrome minimal and clean so the game pops. Everything synthesised: no samples, no MIDI, no external assets.
- Music must be ONE evolving piece for the 3D world (he rejected a two-jingle crossfade). Voices LOUD.
- Grotesques are fine (bloat, vanity, teeth, the corporate monolith); the antisemitic visual vocabulary is off the
  table: no hooked nose, no moneybags, no puppet strings, no octopus or grasping hands over the city. Anonymous
  reviewers, editors and committees are the villains here, never an ethnic caricature.
- Short, efficient reports. Separate what you observed from what you assume.

## Addenda from Duncan (2026-09-26, mid-build)
1. **The Magician is THIS creature, not a hooded reviewer.** Duncan sent a screenshot of the Magician from The House of
   the Dead 2 (Sega, 1998), standing on a mosaic plaza in front of a stone civic building with steps and glass doors,
   under HOLD YOUR FIRE! / PRESS START BUTTON. What he looks like: a tall, slender, hovering humanoid (pointed toes, legs
   together, he floats rather than stands); the body is mostly EXPOSED SINEW, dark crimson and pink muscle fibres with
   black shadow between them; over it, patches of pale off-white/grey SEGMENTED BONE-LIKE ARMOUR PLATES on the shoulders,
   forearms, hands, thighs, shins and feet; a crest of HORNS from the skull (two long curved horns plus smaller spikes);
   thin RED TENDRILS trailing from the elbows, back and legs; long CLAWED FINGERS raised in a casting gesture. Palette:
   black, crimson, pink, off-white. In the game his WEAK POINTS are exactly the unarmoured pink flesh: shoot the gaps
   between the plates. He teleports, hovers, dashes, and throws fireballs in volleys.
   → magician.js must LOOK like that (built from boxes in this game's style: slender proportions, crimson/pink body
   boxes with black seams, off-white plate boxes bolted over shoulders/forearms/thighs/shins, two horn boxes, thin red
   tendril boxes that sway, claw boxes, hovering with feet together), keep the REVIEWER 2 — TYPE 0002 name, card and
   lines, and make the weak points the exposed pink sections (chest/abdomen and the unplated upper arms or hips), which
   the plates cover and uncover as he moves and attacks. Drop the hood, coat, mosaic face and journal-cover armour.
2. **A green Link hat for the overworld in loop 2.** In Master Quest the player's box man wears a green Zelda cap
   (a pointed, back-flopping green cap built from a few shrinking green boxes plus a tip), visible in third person from
   the start of loop 2 (quest.js: the player model only; loop 1 unchanged).
