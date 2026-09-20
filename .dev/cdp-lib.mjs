// Headless-Chrome test harness over the DevTools protocol. No npm deps (Node 22+ has WebSocket + fetch).
//   import { launch } from '/Users/dpalmer/Repositories/astheeggeggs.github.io/.dev/cdp-lib.mjs'
//   const b = await launch({ port: 9401, profile: 'agent-boss' });
//   await b.goto('http://127.0.0.1:4321/?endgame=1&bosshp=5&god=1&timescale=4');
//   await b.startGame();                      // scrolls to the game and clicks PRESS START
//   await b.keyDown('KeyW'); await b.sleep(2000); await b.keyUp('KeyW');
//   console.log(await b.ev(`document.querySelector('#quest .q-toast').textContent`));
//   await b.shot('/abs/path/out.png');        // then Read the PNG to look at it
//   console.log(b.errors); await b.close();
// SwiftShader WebGL is slow (5-10 fps). Game dt is capped at 0.05 s per frame, so game time runs
// slower than wall time; use ?timescale=N (1..20) to speed the simulation up in tests.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SP = '/Users/dpalmer/Repositories/astheeggeggs.github.io/.dev/tmp';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
const VK = { Space: 32, Enter: 13, Escape: 27, ShiftLeft: 16, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
export async function launch({ port, profile, width = 1280, height = 900 }) {
  const chrome = spawn(CH, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required', `--window-size=${width},${height}`, `--remote-debugging-port=${port}`,
    `--user-data-dir=${SP}/chrome-${profile}`, 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(t => t.type === 'page'); if (p) wsUrl = p.webSocketDebuggerUrl; } catch (e) {} if (!wsUrl) await sleep(250); }
  if (!wsUrl) { chrome.kill(); throw new Error('chrome did not start on port ' + port); }
  const ws = new WebSocket(wsUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {}, errors = [], logs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending[m.id]) { m.error ? pending[m.id].rej(new Error(JSON.stringify(m.error))) : pending[m.id].res(m.result); delete pending[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(((d.exception && d.exception.description) || d.text || '').slice(0, 500)); }
    if (m.method === 'Runtime.consoleAPICalled') { const txt = m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' '); logs.push(m.params.type + ': ' + txt); if (m.params.type === 'error') errors.push('console.error: ' + String(txt).slice(0, 500)); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('ev failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
  const keyEv = (type, code) => { const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code.startsWith('Digit') ? code.slice(5) : code; const vk = VK[code] || (code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0); return send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); };
  return {
    errors, logs, sleep, ev, send,
    goto: async (url, wait = 3500) => { await send('Page.navigate', { url }); await sleep(wait); },
    startGame: async () => { await ev(`document.documentElement.style.scrollBehavior='auto'; document.getElementById('quest').scrollIntoView({block:'start'}); document.querySelector('#quest .q-start').click(); 'ok'`); await sleep(600); },
    keyDown: code => keyEv('keyDown', code), keyUp: code => keyEv('keyUp', code),
    tap: async (code, ms = 60) => { await keyEv('keyDown', code); await sleep(ms); await keyEv('keyUp', code); },
    mouse: (type, x, y, button = 'left') => send('Input.dispatchMouseEvent', { type, x, y, button, buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }),   // type: mousePressed | mouseReleased | mouseMoved
    mobile: async (w = 390, h = 844) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true }); },
    waitFor: async (expr, timeout = 60000, every = 500) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true; } catch (e) {} await sleep(every); } return false; },
    shot: async path => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(s.data, 'base64')); return path; },
    close: async () => { try { ws.close(); } catch (e) {} chrome.kill(); await sleep(200); }
  };
}
