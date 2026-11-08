import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';
import { spawn } from 'child_process';

const INPUT_JPG = 'C:\\Users\\Onty\'s zZz\\.gemini\\antigravity\\brain\\67e53663-ba74-4e56-88c5-fa3dd43b6058\\modern_architectural_house_1794150983257.jpg';
const OUTPUT_DIR = path.resolve('public/illustrations');
const OUTPUT_LIGHT_PNG = path.join(OUTPUT_DIR, 'modern-architectural-house.png');
const OUTPUT_DARK_PNG = path.join(OUTPUT_DIR, 'modern-architectural-house-dark.png');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const jpgBuffer = fs.readFileSync(INPUT_JPG);
const base64Data = jpgBuffer.toString('base64');
const dataUri = `data:image/jpeg;base64,${base64Data}`;

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

async function processIllustration() {
  console.log('Processing architectural sketch into transparent alpha PNGs...');
  const tempProfile = path.join(os.tmpdir(), 'chrome_illus_' + Date.now());
  const port = 9666;
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

    // Function to convert white background to alpha channel
    const renderLightScript = `
      (async function(dataUri) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              // Luminance
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;

              if (lum > 240) {
                // Pure or near-white background
                data[i + 3] = 0;
              } else if (lum > 210) {
                // Soft edge blend
                const alphaFactor = (240 - lum) / 30;
                data[i + 3] = Math.round(255 * alphaFactor);
                // Darken slightly so linework is rich pencil
                data[i] = Math.round(r * 0.85);
                data[i + 1] = Math.round(g * 0.85);
                data[i + 2] = Math.round(b * 0.85);
              } else {
                // Rich graphite/pencil line
                data[i] = Math.round(r * 0.8);
                data[i + 1] = Math.round(g * 0.8);
                data[i + 2] = Math.round(b * 0.8);
              }
            }

            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = dataUri;
        });
      })
    `;

    // Function for Dark mode: Inverted silver-gray luminous pencil lines on transparent
    const renderDarkScript = `
      (async function(dataUri) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;

              if (lum > 240) {
                // Background transparent
                data[i + 3] = 0;
              } else {
                // Invert darkness to lightness for silver/emerald glow
                const darkness = 255 - lum;
                const alpha = Math.min(255, darkness * 1.3);
                data[i + 3] = alpha;
                // Silver-white with subtle cool emerald tint (matching dark reference)
                data[i] = Math.min(255, 180 + Math.round(darkness * 0.3));
                data[i + 1] = Math.min(255, 210 + Math.round(darkness * 0.18));
                data[i + 2] = Math.min(255, 205 + Math.round(darkness * 0.2));
              }
            }

            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = dataUri;
        });
      })
    `;

    console.log('Rendering light mode transparent pencil sketch...');
    const resLight = await send('Runtime.evaluate', {
      expression: `(${renderLightScript})("${dataUri}")`,
      returnByValue: true,
      awaitPromise: true,
    });
    const b64Light = resLight.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(OUTPUT_LIGHT_PNG, Buffer.from(b64Light, 'base64'));
    console.log('Saved Light PNG to:', OUTPUT_LIGHT_PNG);

    console.log('Rendering dark mode silver luminous pencil sketch...');
    const resDark = await send('Runtime.evaluate', {
      expression: `(${renderDarkScript})("${dataUri}")`,
      returnByValue: true,
      awaitPromise: true,
    });
    const b64Dark = resDark.result.value.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(OUTPUT_DARK_PNG, Buffer.from(b64Dark, 'base64'));
    console.log('Saved Dark PNG to:', OUTPUT_DARK_PNG);

    ws.close();
    console.log('Architectural illustrations ready for both Light & Dark modes!');
  } finally {
    chromeProcess.kill('SIGKILL');
  }
}

processIllustration().catch((err) => {
  console.error('Failed to process illustration:', err);
  process.exit(1);
});
