const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const SOURCE_PNG = "C:\\Users\\Onty's zZz\\Downloads\\Anwar Bhuiyan Property Logo.png";
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const pngBuffer = fs.readFileSync(SOURCE_PNG);
const base64Data = pngBuffer.toString('base64');
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
  throw new Error('Chrome remote debugging did not respond');
}

async function run() {
  const tempProfile = path.join(os.tmpdir(), 'chrome_logo_inspect_' + Date.now());
  const port = 9667;
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
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
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

    const result = await send('Runtime.evaluate', {
      expression: `
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;

            // Find bounding box of non-white pixels
            let minX = w, minY = h, maxX = 0, maxY = 0;
            let totalNonWhite = 0;
            let corners = [
              [0, 0], [w-1, 0], [0, h-1], [w-1, h-1]
            ].map(([x, y]) => {
              const idx = (y * w + x) * 4;
              return [data[idx], data[idx+1], data[idx+2], data[idx+3]];
            });

            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const r = data[idx];
                const g = data[idx+1];
                const b = data[idx+2];
                const a = data[idx+3];
                // Non-white if not pure white/near white (e.g. r < 245 || g < 245 || b < 245) or a < 255
                if (a > 10 && (r < 245 || g < 245 || b < 245)) {
                  totalNonWhite++;
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }

            resolve({
              w, h,
              corners,
              totalNonWhite,
              boundingBox: { minX, minY, maxX, maxY, boxW: maxX - minX + 1, boxH: maxY - minY + 1 }
            });
          };
          img.src = "${dataUri}";
        })
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Analysis result:', JSON.stringify(result.result.value, null, 2));

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
