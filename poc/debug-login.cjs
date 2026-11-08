const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    let filePath = path.join('dist', cleanUrl);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) filePath = path.join('dist', 'index.html');
    const ext = path.extname(filePath);
    const mimeMap = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise(r => server.listen(4182, r));

  const chromePort = 9249;
  const tempProfile = path.join(os.tmpdir(), 'chrome_debug_' + Date.now());
  const proc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${tempProfile}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1000));
  const res = await new Promise(resolve => http.get('http://127.0.0.1:9249/json', r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
  }));
  const page = res.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    const handler = (evt) => {
      const msg = JSON.parse(evt.data.toString());
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4182' });
  await new Promise(r => setTimeout(r, 2000));

  // Check form submit
  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const email = document.querySelector('input[type="email"]');
        const pass = document.querySelector('input[type="password"]');
        const form = document.querySelector('form');
        const btn = document.querySelector('button[type="submit"]');
        return { hasEmail: Boolean(email), hasPass: Boolean(pass), hasForm: Boolean(form), hasBtn: Boolean(btn) };
      })()
    `,
    returnByValue: true
  });
  console.log('Form inputs:', evalRes.result.value);

  // Fill in inputs and submit via React synthetic input setter
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const email = document.querySelector('input[type="email"]');
        const pass = document.querySelector('input[type="password"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(email, 'zahid@bhuiyan.com');
        email.dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(pass, '112233');
        pass.dispatchEvent(new Event('input', { bubbles: true }));
        const form = document.querySelector('form');
        form.requestSubmit();
      })()
    `,
    returnByValue: true
  });

  console.log('Submitted form, waiting 5s...');
  await new Promise(r => setTimeout(r, 5000));

  const pageState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const err = document.querySelector('.text-red-700, .bg-red-50, [class*="red"]');
        const dock = document.querySelector('.liquid-glass-dock-5');
        return {
          hasDock: Boolean(dock),
          bodySnippet: document.body.innerText.slice(0, 300),
          errorText: err ? err.innerText : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Page state after login:', pageState.result.value);

  try {
    proc.kill();
  } catch {}
  try {
    server.close();
  } catch {}
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}
}

test();
