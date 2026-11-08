import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';
import { spawn } from 'child_process';

const SOURCE_PNG = 'C:\\Users\\Onty\'s zZz\\Downloads\\Anwar Bhuiyan Property Logo.png';
const ICONS_DIR = path.resolve('public/icons');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

const base64Data = fs.readFileSync(SOURCE_PNG).toString('base64');
const dataUri = `data:image/png;base64,${base64Data}`;

async function fetchWsUrl(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json`, (r) => {
          let data = '';
          r.on('data', (c) => (data += c));
          r.on('end', () => {
            try {
              const list = JSON.parse(data);
              const page = list.find((t) => t.type === 'page') || list[0];
              if (page && page.webSocketDebuggerUrl) resolve(page.webSocketDebuggerUrl);
              else reject(new Error('No page WebSocket URL found'));
            } catch (err) {
              reject(err);
            }
          });
        }).on('error', reject);
      });
      if (res) return res;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('Chrome remote debugging did not respond in time');
}

async function generatePngIcons() {
  console.log('Generating high-res PNG icons from:', SOURCE_PNG);
  const tempProfile = path.join(os.tmpdir(), 'chrome_icon_gen_' + Date.now());
  const port = 9444;
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  try {
    const wsUrl = await fetchWsUrl(port);
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Runtime.enable');

    // Function to render icon on canvas and return base64
    const renderScript = `
      (async function(dataUri, size, paddingFraction, bgColor) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            if (bgColor) {
              ctx.fillStyle = bgColor;
              ctx.fillRect(0, 0, size, size);
            }
            
            const padding = size * paddingFraction;
            const drawSize = size - (padding * 2);
            ctx.drawImage(img, padding, padding, drawSize, drawSize);
            
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = dataUri;
        });
      })
    `;

    // 1. icon-192.png (purpose: any, transparent or soft white, padding 0)
    console.log('Rendering 192x192 any icon...');
    const res192Any = await send('Runtime.evaluate', {
      expression: `(${renderScript})("${dataUri}", 192, 0.05, "#ffffff")`,
      returnByValue: true,
      awaitPromise: true,
    });
    const b64_192Any = res192Any.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), Buffer.from(b64_192Any, 'base64'));

    // 2. icon-512.png (purpose: any, padding 0.05, bg white)
    console.log('Rendering 512x512 any icon...');
    const res512Any = await send('Runtime.evaluate', {
      expression: `(${renderScript})("${dataUri}", 512, 0.05, "#ffffff")`,
      returnByValue: true,
      awaitPromise: true,
    });
    const b64_512Any = res512Any.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), Buffer.from(b64_512Any, 'base64'));

    // 3. Maskable icons (padding 0.15 for safe zone, bg #ffffff)
    console.log('Rendering maskable icons (192 and 512)...');
    const res192Mask = await send('Runtime.evaluate', {
      expression: `(${renderScript})("${dataUri}", 192, 0.15, "#ffffff")`,
      returnByValue: true,
      awaitPromise: true,
    });
    const b64_192Mask = res192Mask.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-192.png'), Buffer.from(b64_192Mask, 'base64'));

    const res512Mask = await send('Runtime.evaluate', {
      expression: `(${renderScript})("${dataUri}", 512, 0.15, "#ffffff")`,
      returnByValue: true,
      awaitPromise: true,
    });
    const b64_512Mask = res512Mask.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-512.png'), Buffer.from(b64_512Mask, 'base64'));

    // 4. Apple touch icon (180x180, bg #ffffff, padding 0.08)
    console.log('Rendering apple-touch-icon (180x180)...');
    const resApple = await send('Runtime.evaluate', {
      expression: `(${renderScript})("${dataUri}", 180, 0.08, "#ffffff")`,
      returnByValue: true,
      awaitPromise: true,
    });
    const b64_Apple = resApple.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), Buffer.from(b64_Apple, 'base64'));

    // Also copy apple-touch-icon to public root for maximum device compatibility
    fs.writeFileSync(path.resolve('public/apple-touch-icon.png'), Buffer.from(b64_Apple, 'base64'));

    ws.close();
    console.log('All PNG icons generated successfully!');
  } finally {
    chromeProcess.kill('SIGKILL');
  }
}

generatePngIcons().catch((err) => {
  console.error('Failed to generate PNG icons:', err);
  process.exit(1);
});
