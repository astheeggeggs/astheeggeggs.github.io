import { launch } from './cdp-lib.mjs';
const b = await launch({ port: 9400, profile: 'regress' });
await b.goto('http://127.0.0.1:4321/?timescale=3');
await b.startGame();
await b.keyDown('KeyW'); await b.sleep(2500); await b.keyUp('KeyW');
await b.tap('Space'); await b.sleep(800);
console.log('A hud:', await b.ev(`document.querySelector('#quest .q-hud .q-pill').textContent.replace(/\\s+/g,' ')`));
// endgame hook with no boss module present yet
await b.goto('http://127.0.0.1:4321/?endgame=1&timescale=3');
await b.startGame(); await b.sleep(4000);
console.log('B toast:', await b.ev(`document.querySelector('#quest .q-toast').textContent`), '| cross hidden:', await b.ev(`document.querySelector('#quest .q-cross').hidden`), '| hearts:', await b.ev(`document.querySelector('#quest [data-hud=hits]').textContent`));
await b.keyDown('KeyF'); await b.sleep(2500); await b.keyUp('KeyF');
await b.shot('/Users/dpalmer/Repositories/astheeggeggs.github.io/.dev/tmp/regress.png');
console.log('errors:', b.errors.filter(e => !/404|Failed to load resource/.test(e)).join('\n') || 'none', '| all:', b.errors.length);
await b.close(); process.exit(0);
