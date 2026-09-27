# Handover — astheeggeggs.github.io (updated 2026-09-27; the 2026-09-21 text follows below)

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

**Open, for Duncan to judge (nobody has played or listened):**
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
- Private preview artifact: https://claude.ai/code/artifact/cc1d096b-aa50-42df-8d1b-bb84423fa908
  Rebuild with `bundle exec jekyll build && python3 .dev/bundle-artifact.py`, then Artifact publish with
  that `url`. **Only when Duncan asks.**
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
