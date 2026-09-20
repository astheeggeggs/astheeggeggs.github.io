# Handover — astheeggeggs.github.io (written 2026-09-20 ~17:30 by Claude Fable 5.1)

## What this repo is
Duncan Palmer's personal site (Jekyll → GitHub Pages, `https://astheeggeggs.github.io/`). The live site is still
the 2019 version: NOTHING from this work is committed or pushed. `git status` shows the whole rebuild as
working-tree changes. Commit/push only when Duncan asks. His global rule: never add `Co-Authored-By` lines.

Pages: `index.md` (home: intro, the game, About, selected work), `research.md`, `publications.md` (filterable, from
`_data/publications.yml`), `code.md`. Styling in `assets/css/swank.css` (a "minimal mode" block near the end
overrides the earlier swanky styles on purpose: the game is the star). No theme gem. README.md documents it all.

## The game ("Palmer's Progress") — `assets/js/quest.js` + `assets/js/riff.js`
Three.js r160 from cdnjs, loaded only when a page has `quest: true` front matter.
Flow: third-person low-poly town → collect 8 facts from building signs while 6 reviewers chase you →
`dread` rises linearly (0.7 at 90 s): sky reddens, music bends minor/slows/turns industrial → at 0.7 the camera
drops to FIRST PERSON, F/click throws paper-ball rebuttals (hold to auto-fire) → 5 hits = pixel "REJECTED!"
(GTA homage), Space resubmits. NPC speech is Banjo-Kazooie gibberish (`speak()`), captions in "Press Start 2P".
Music is 100% synthesised WebAudio (no samples/MIDI → nothing to license); one continuous seed-composed piece
(`composeOverworld`, ~3.5 min loop) that mutates with `Riff.setDread()`.

### Duncan's taste (learned the hard way — respect these)
- KEEP the blocky BOX characters (`boxMan`). A rounded "Mario 64" rig was tried and rejected ("oof, terrible").
- Pixel font for ALL game text incl. REJECTED!. Dry academic humour (reviewers, editors, finance, h-index).
- Do not spoil surprises in page copy (the first-person switch is unannounced: "Don't stay too long.").
- Site chrome minimal and clean so the game pops. Doom-style alt game was built then removed at his request.
- Music must be ONE evolving piece for the 3D world (he rejected a two-jingle crossfade). Voices LOUD.
- Short, efficient comms. Separate observed from assumed.

## IN FLIGHT: the endgame (requested 2026-09-20)
User's spec: all 8 facts → force first person + more dread → House of the Dead 2-style boss intro card hinting the
WEAK SPOT → a huge Dark Souls-style boss DROPS FROM THE SKY and the landing DESTROYS ALL BUILDINGS → it shoots
projectiles → only weak-spot hits count → 100 hits → player BLASTS OFF INTO SPACE → game becomes a bullet-hell
shooter "DoDonPachi mixed with Truxton". Also: fix reviewer AI ("they just get stuck"). Music + SFX for all of it.

### Done and regression-tested by me (in `quest.js`)
Endgame host plumbing: `api` object + `startEndgame()`, `retryBoss()`, `launchShmup()` (section "endgame: boss,
then space" near the bottom); shared `hurt()`; hold-to-fire; `setWeapon`; camera `shake`; `setHud`;
`lockEnvironment`; cinematic hand-off (`boss.cinematic` → host freezes player and leaves the camera alone);
buildings/fountain expose `group` + `collider` for destruction; last fact's dialog closing triggers the endgame;
returning players with 8 facts get it after a toast; "Reset progress" link under the game (`data-quest-reset`);
layout loads `boss.js` and `shmup.js` (defer) before `quest.js`; test hooks
`?endgame=1 ?bosshp=N ?skipintro=1 ?god=1 ?shmup=1 ?timescale=N ?dread=0.71 ?maxhits=1`.
THE CONTRACT every module is built against: `.dev/endgame-contract.md` (read it first).

### Background build: STOPPED at 17:30 on 2026-09-20 (credits nearly exhausted). Nothing is running.
The 34-agent Workflow (script: `.dev/endgame-build.workflow.js`) was stopped ~35 min in, during its Build stage,
before any review. State on disk, all verified by me AFTER the stop (both JS files parse; smoke test
`.dev/regress.mjs` passes with zero console errors; agents' debug instrumentation stripped):
| module | file | state |
|---|---|---|
| music | `assets/js/riff.js` (20 → 62 KB) | `Riff.boss`, `Riff.play('space')`, `Riff.stinger` are PRESENT but UNREVIEWED and not listened to. Builder was still measuring levels. |
| reviewer AI | `assets/js/quest.js` (baddie code only; nav grid `navBuild`/`navFlood`/`navLos`, slots, stuck escape) | PRESENT, runs without errors, UNREVIEWED. Builder was on its third measure-and-tune pass; its logs are in the old scratchpad. |
| boss | `assets/js/boss.js` | NOT WRITTEN. Partial draft in `.dev/salvage/boss-build/` (parts p1-p4 + p9 of a planned 9, ~600 lines, with `build.sh` that concatenates them). Read it before starting over. |
| shooter | `assets/js/shmup.js` | NOT WRITTEN. Partial draft in `.dev/salvage/shmup/` (p1-p6, ~800 lines). |
Also in `.dev/salvage/`: `quest.with-ai-debug.js` and `riff.with-temp-logs.js` (the files exactly as the agents left
them, including their test handles), `ai-new-block.js`, `ai-harness2.mjs`. `.dev/quest.pre-endgame.js` is the game before any endgame work.
With boss.js/shmup.js absent the site still works: `?endgame=1` just toasts "THE BOSS IS MISSING".
WARNING for future runs: a user interrupt (Esc mid-turn) KILLS a running workflow. Agents then stop mid-edit:
check every JS file parses and `grep -n "__debug\|TEMP" assets/js/*.js`.

### How to pick this up
1. Assess: `ls -la assets/js; for f in assets/js/*.js; do node -e "new Function(require('fs').readFileSync('$f','utf8'))" && echo ok $f; done`
   and read the run's `journal.jsonl` for which agents finished and what they reported.
2. If the workflow finished: read its result (modules, confirmed findings, play, audit, finalFix), then VERIFY
   YOURSELF end to end (checklist below) before telling Duncan it works.
3. It was stopped (see above): whatever exists on disk is real work — do not rebuild it. Finish boss.js and shmup.js from the salvaged drafts + the briefs inside the workflow script, then review riff.js and the AI. Same session: relaunch
   with `Workflow({scriptPath, resumeFromRunId})` (finished agents return cached). New session: either finish solo,
   or run `.dev/endgame-build.workflow.js` after deleting the Build stage for modules whose file already exists
   and parses (turn their first stage into `() => ({summary: 'already built; review it'})`).
   CREDIT SAVERS: add `model: 'sonnet'` (or 'opus') to the `agent()` opts; drop the Verify stage; or skip straight to
   the Playtest agent. The 34-agent full run is expensive.
4. Afterwards: update README.md (endgame, modules, hooks), and ONLY IF ASKED republish the preview artifact.

### Verification checklist (headless Chrome via `.dev/cdp-lib.mjs`; SwiftShader is slow → use `?timescale=`; LOOK at screenshots)
1. Regression: start, run, jump, reviewers path round obstacles, FP switch (`?dread=0.69`), fire, REJECTED (`?maxhits=1`), resubmit.
2. Real trigger: collect 8 facts, close last sign → endgame starts (FP forced, reviewers vanish).
3. Intro card legible + skippable → boss drops → ALL 8 buildings destroyed, colliders gone, fountain crushed; HP bar OK.
4. Body hits do nothing; weak-spot hits count; projectiles hurt; REJECTED → Space restarts fight (no intro, town still flat);
   `?bosshp=4` kill → MANUSCRIPT ACCEPTED → blast-off → white flash → shooter starts exactly once.
5. Shooter: tap vs hold, 3 weapons, skull bomb, chain, death/CONTINUE, pause, final boss (`?shmupstage=boss`), ending links/buttons.
6. Music: boss layer, space track, stingers, ♫ toggle / M key, silence after REJECTED.
7. Returning player with 8 saved facts; Reset progress link. 8. Narrow/touch layout. 9. Zero console errors; no debug handles left.

## Dev environment
- Server: `export PATH="/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/4.0.0/bin:$PATH"; bundle exec jekyll serve --port 4321`
  (Homebrew Ruby 4; system Ruby 2.6 is too old). Auto-regenerates; NEVER write into `_site/` (wiped on regen).
  `_config.yml` changes need a server restart.
- Test harness: `.dev/cdp-lib.mjs` (Node 22+, no deps): `launch({port, profile})`, `goto`, `startGame`, `keyDown/keyUp/tap`,
  `mouse`, `mobile`, `ev`, `waitFor`, `shot`, `errors`. One debugging port per concurrent Chrome. `.dev/regress.mjs` is a smoke test.
  Old headless `--screenshot` lies about narrow widths; use `b.mobile()` (CDP device metrics) instead.
- Private preview artifact shared with a few of Duncan's friends (feedback came from them):
  https://claude.ai/code/artifact/cc1d096b-aa50-42df-8d1b-bb84423fa908
  Rebuild with `bundle exec jekyll build && python3 .dev/bundle-artifact.py`, then Artifact publish with that `url`.
  Republish ONLY when Duncan asks.
- The public site and repo visibility were discussed; Duncan chose to leave them alone until he is ready.
- Numbers hard-coded on pages (citations 15,821, h-index 28, 16 biobanks, 1.2M) came from Scholar on 2026-09-02 and drift.
