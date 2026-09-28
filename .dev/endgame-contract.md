# Endgame contract — "Palmer's Progress"

Repo: /Users/dpalmer/Repositories/astheeggeggs.github.io (Jekyll site, GitHub Pages). The home page embeds a
Three.js (r160, global `THREE`) third-person → first-person game in `assets/js/quest.js`. Music is synthesised
by `assets/js/riff.js` (`window.Riff`). A dev server with auto-regeneration is ALREADY RUNNING at
http://127.0.0.1:4321/ — never start or kill Jekyll; never run git commands that change state.

## Story so far (what exists and works)
The player (a blond, bespectacled BOX-ART man in a grey suit: `boxMan()`; the user explicitly prefers these
blocky box characters — do not make rounded/organic models) runs round a low-poly town collecting 8 "facts"
from building signs while 6 red-suited peer reviewers chase him. A `dread` value rises; sky reddens, music
darkens; at dread 0.7 the camera drops into first person and F / click throws paper-ball "rebuttals".
5 hits in first person → a GTA-style pixel "REJECTED!" screen. HUD and all captions use the pixel font
"Press Start 2P" (already loaded on the page). Humour is dry and academic: peer review, editors, grant
finance, impact factors, h-indices.

## The new endgame (what we are building now)
1. All 8 facts found → quest.js `startEndgame()`: forces first person, dread ramps to 1, ordinary reviewers vanish,
   weapon is buffed (rate 0.13 s, speed 70, gravity 2.5, hold-to-fire works), hearts refill, then `boss.start()`.
2. `assets/js/boss.js`: House of the Dead 2-style boss intro card that reveals the WEAK POINT → a huge Dark
   Souls-style boss drops from the sky; THE LANDING DESTROYS EVERY BUILDING (and crushes the fountain) →
   it fires projectiles at the player → only weak-spot hits count → 100 hits to win → death → the player
   BLASTS OFF INTO SPACE → `api.onBossDefeated()`.
3. `assets/js/shmup.js`: the game becomes a vertical bullet-hell shooter (DoDonPachi × Truxton) → ending screen.
4. `assets/js/riff.js`: boss music layer, a space-shooter track, and one-shot stingers.
5. quest.js reviewer AI: they currently get stuck on obstacles; give them real pathfinding.

## File ownership (STRICT — parallel agents are working; never edit a file you do not own)
| file | owner |
|---|---|
| assets/js/boss.js (new) | boss agent |
| assets/js/shmup.js (new) | shmup agent |
| assets/js/riff.js | music agent |
| assets/js/quest.js | reviewer-AI agent, and ONLY the baddie AI code (`updateBaddies`, `BADDIES` setup, new nav helpers). Nobody else edits quest.js. The `api` object / endgame section is frozen. |
| index.md, assets/css/swank.css, _layouts/*, _includes/* | nobody. Modules inject their own DOM and a `<style>` tag from JS. |
Scratch files (test scripts, screenshots) go ONLY in the scratchpad:
/Users/dpalmer/Repositories/astheeggeggs.github.io/.dev/tmp
Never write into `_site/` (Jekyll wipes it on every regeneration).

## Code rules
- Plain browser JS in an IIFE, ES5 style like the existing files (`var`, `function`), no build step, no new
  dependencies, no external assets (everything procedural: geometry, canvas-drawn sprites, WebAudio SFX).
- Never throw into the host: guard optional things, wrap callbacks. Zero console errors.
- 60 fps on a laptop: reuse geometries/materials, pool objects, cap particle counts, dispose what you remove.
- `dt` can be large (timescale test hook, tab switches): clamp or sub-step physics so nothing tunnels or explodes.
- UI text: font-family "Press Start 2P", monospace. Pixel/arcade look. Must also be usable on touch devices.
- Load order (already wired in the layout): three.min.js, riff.js, boss.js (defer), shmup.js (defer), quest.js (defer).
  boss.js/shmup.js must only DEFINE `window.QuestBoss` / `window.QuestShmup` at load; do all work inside.

## The host API (`api`, built in quest.js — read the "endgame" section near the bottom of quest.js)
```
api.THREE, api.root (#quest element, position:relative), api.view (.q-view: the 16:9 box holding the WebGL canvas;
      4:3 under 640px wide), api.scene, api.camera (PerspectiveCamera fov 55, far 300), api.renderer
api.WORLD = 52            // playable half-extent; ground plane y = 0; hills beyond
api.EYE = 2.25            // first-person eye height above player.position.y
api.colliders             // live array used by collide(): circles {x,z,r} and boxes {x,z,hw,hd}. 2D (infinite height). You may push/splice.
api.collide(x, z, r)      // true if a circle of radius r at (x,z) hits any collider or leaves the world
api.safeSpot(x, z)        // nearest free point {x,z}
api.player                // THREE.Group; position.x/z on the ground, position.y = jump height (0 on ground). api.pstate = {yaw, speed, y, vy, air,...}
api.places                // the 8 buildings: {id, short, x, z, w, d, h, wall, roof, group: THREE.Group, collider, bushes: [Mesh], marker: Mesh, door:{x,z}}
api.fountain              // {group: THREE.Group at world origin, collider}
api.npcs                  // 3 talkative NPCs: {x, z, mesh, title, text, voice}; they have circle colliders in api.colliders (not referenced; find by x/z if needed)
api.flat(hex)             // MeshLambertMaterial
api.boxMan(opts)          // box character ~2.9 units tall. opts {suit, hair, tie, glasses:false, angry:true}. userData {la, ra, ll, rl} limb meshes pivoted at shoulder/hip
api.pose(char, {walk, speed, air})
api.labelSprite(text, bgCss, fgCss)   // pixel-font THREE.Sprite sign
api.speak(voice, char)                // Banjo-Kazooie syllable blip; voice = {base: Hz, wave, spread}
api.audio()                           // shared AudioContext for your own synthesised SFX
api.showToast(text)                   // green pixel toast, top centre, ~2.6 s
api.notice({title, text, voice})      // non-blocking typed caption box at the bottom with gibberish voice
api.hurt(n) → bool                    // player takes n hits: red flash + pain grunt and heart sting (FPSFX); has 0.9 s i-frames; shows REJECTED! at 0 hearts. Returns false if ignored.
api.heal(n), api.hearts()             // hearts are 5 by default
api.teleport(x, z)                    // to nearest safe spot
api.lookAt(x, y, z)                   // turn the first-person view to a world point
api.shake(amplitude, seconds)         // first-person camera shake (amplitude ~0.3 light, ~2.5 cataclysmic)
api.setHud(bool)                      // hide/show quest HUD, crosshair, weapon (also blocks firing while hidden)
api.lockEnvironment(bool)             // true: quest.js stops driving sky/fog/light colours each frame so YOU can
api.setWeapon({rate, speed, gravity})
api.music('boss' | 'space' | 'quest' | 'silence'), api.stinger(name), api.musicWanted(), api.setMusicWanted(bool)
api.isOver()                          // REJECTED! screen is up (host stops calling boss.update while true)
api.params = {endgame, bossHp, skipIntro, god, shmup, timescale}
api.links = {publications, research, code, scholar, email}   // use these for any links you show
api.onBossDefeated()                  // boss.js calls this once, when the blast-off cinematic ends → host launches the shooter
api.restart()                         // clear saved progress and reload the page
```

## boss.js interface
```
window.QuestBoss = function (api) { return {
  start: function (opts) {},   // opts {hp: 100, skipIntro: bool, retry: bool}. May be called again after stop() (retry after REJECTED!: retry=true, skipIntro=true → no intro, no re-destruction; boss already landed, full HP)
  stop: function () {},        // remove boss, projectiles, DOM, listeners; restore setHud(true), lockEnvironment(false); active=false, cinematic=false. Rubble may stay.
  update: function (dt, t) {}, // called by the host every frame while active and not game-over. dt seconds (already timescaled), t = elapsed seconds
  hitTest: function (pos, prev) {},  // host calls for every live player shot every frame (THREE.Vector3 world positions; do not mutate). Do a swept test prev→pos. Return 'weak' | 'body' | null. YOU apply damage + feedback. Truthy → host deletes the shot.
  active: false,               // true from start() until the blast-off has finished or stop()
  cinematic: false             // while true the host freezes the player, hides him and the weapon, and does NOT touch the camera: you drive api.camera
}; };
```
`active`/`cinematic` are read as plain properties every frame — keep them current (or use getters).

## shmup.js interface
```
window.QuestShmup = function (api) { return {
  start: function (opts) {},   // build a full-cover overlay inside api.view (z-index ≥ 8), own 2D canvas, own input + rAF loop
  stop: function () {},
  active: false                // while true the host skips all WebGL rendering and ignores keyboard input
}; };
```
Host hook `?shmup=1` jumps straight into the shooter after PRESS START.

## riff.js additions (existing API must keep working: play('quest'), stop, toggle, bind, setDread, takeover, info, playing, dread, metal)
```
Riff.boss(on)          // boss-fight layer on the existing evolving score (Dark Souls grandeur), joined on a bar line
Riff.play('space')     // a separate composed, seamlessly looping arcade-shooter track
Riff.stinger(name)     // one-shots: 'impact' | 'victory' | 'launch' | 'ending'
```

## Test hooks (query string, all optional)
`?endgame=1` start the boss sequence right after PRESS START · `?bosshp=5` · `?skipintro=1` · `?god=1` (no heart loss) ·
`?shmup=1` · `?timescale=4` (simulation speed) · `?dread=0.71` · `?maxhits=1`

## How to test (required before you report done)
1. `node -e "new Function(require('fs').readFileSync('FILE','utf8'))"` for syntax.
2. Drive the real page in headless Chrome with the helper (read its header comment):
   `/Users/dpalmer/Repositories/astheeggeggs.github.io/.dev/cdp-lib.mjs` → `launch({port, profile})`, `goto`, `startGame`, `keyDown/keyUp/tap`, `mouse`, `ev(js)`, `waitFor`, `shot(path)`, `errors`.
   Use ONLY the debugging port and profile name given in your prompt (other agents run Chrome at the same time). Always `close()`.
   Headless WebGL is slow (5–10 fps): use `?timescale=` and generous waits. Take screenshots and LOOK at them with the Read tool.
   A temporary `window.__debug` handle is fine while testing, but remove it before you finish.
3. `b.errors` must be empty (ignore 404s for a module file another agent has not written yet).
