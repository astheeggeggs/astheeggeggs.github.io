import { launch } from './cdp-lib.mjs';
const b = await launch({ port: 9400, profile: 'regress' });
// headless Chrome throttles rAF to ~1 Hz; a tiny screenshot asks for a frame, so this is how game time passes
const run = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 1, clip: { x: 0, y: 0, width: 64, height: 48, scale: 0.2 } }).catch(() => {}); };
const q = s => `document.querySelector('#quest ${s}')`;
let fails = 0; const check = (ok, name, detail) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '   ' + detail : '')); };
await b.goto('http://127.0.0.1:4321/?timescale=3');
await b.startGame();
await b.keyDown('KeyW'); await run(2500); await b.keyUp('KeyW');
await b.tap('Space'); await run(800);
console.log('A hud:', await b.ev(`${q('.q-hud .q-pill')}.textContent.replace(/\\s+/g,' ')`));
// dread past 0.7 darkens the town but never takes the camera: first person waits for the eighth fact
await b.goto('http://127.0.0.1:4321/?dread=0.95&timescale=3');
await b.startGame(); await run(3000);
check(await b.ev(`${q('.q-cross')}.hidden && ${q('.q-hits')}.hidden`), 'A2 dread 0.95: still third person (no crosshair, no hearts)');
// ?endgame=1: straight into the fight, in first person, behind the boss's dossier card
await b.goto('http://127.0.0.1:4321/?endgame=1&timescale=3');
await b.startGame(); await run(2500);
check(await b.ev(`!!document.querySelector('#quest .qb-card, #quest .qm-card')`), 'B the boss card is up');
check(/♥/.test(await b.ev(`${q('[data-hud=hits]')}.textContent`)) && !(await b.ev(`${q('.q-hits')}.hidden`)), 'B first person (hearts shown)', await b.ev(`${q('[data-hud=hits]')}.textContent`));
check(await b.ev(`${q('.q-cross')}.hidden`), 'B no crosshair behind the card (the swoop waits for it)');
await b.keyDown('KeyF'); await run(2500); await b.keyUp('KeyF');
for (let i = 0; i < 30 && (await b.ev(`${q('.q-cross')}.hidden`)); i++) await run(500);   // the 1.2 s swoop, at whatever frame rate
check(!(await b.ev(`${q('.q-cross')}.hidden`)), 'B card closed, swoop landed: crosshair shown');
await b.shot('/Users/dpalmer/Repositories/astheeggeggs.github.io/.dev/tmp/regress.png');
const errs = b.errors.filter(e => !/404|Failed to load resource/.test(e));
check(errs.length === 0, 'no console errors', errs.join('\n') || undefined);
console.log(fails ? fails + ' FAILED' : 'all passed', '| errors (incl. 404s):', b.errors.length);
await b.close(); process.exit(fails ? 1 : 0);
