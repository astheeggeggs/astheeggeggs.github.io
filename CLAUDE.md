# astheeggeggs.github.io

Personal Jekyll site for Duncan Palmer with a Three.js game on the home page. README.md describes the structure.

**Work is in flight: read `.dev/HANDOVER.md` before doing anything** (current state, the endgame build, Duncan's
preferences, test harness, verification checklist). Module interfaces: `.dev/endgame-contract.md`.

- Nothing here is committed or pushed yet; the live site is still the old one. Commit/push only on request.
- Serve: `export PATH="/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/4.0.0/bin:$PATH"; bundle exec jekyll serve --port 4321`
- Never write into `_site/`. Test the game with `.dev/cdp-lib.mjs` (headless Chrome over CDP) and look at screenshots.
- Keep the box-art characters, the pixel font, synthesised-only audio, and the minimal site chrome.
