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
  const tempProfile = path.join(os.tmpdir(), 'chrome_logo_colors_' + Date.now());
  const port = 9668;
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

            // Crop tightly to bounding box with small 16px safety padding
            const minX = 102;
            const minY = 325;
            const maxX = 1153;
            const maxY = 930;
            const pad = 24;

            const cropX = Math.max(0, minX - pad);
            const cropY = Math.max(0, minY - pad);
            const cropW = Math.min(w - cropX, (maxX - minX + 1) + pad * 2);
            const cropH = Math.min(h - cropY, (maxY - minY + 1) + pad * 2);

            // Let's check background flood fill from (0,0) to only remove exterior background
            // BFS flood fill from edges to find true exterior background pixels
            const bgMask = new Uint8Array(w * h); // 1 = exterior background
            const queue = [];

            // Add all 4 borders to queue if near white
            function isWhite(x, y) {
              const idx = (y * w + x) * 4;
              return data[idx] >= 240 && data[idx+1] >= 240 && data[idx+2] >= 240;
            }

            for (let x = 0; x < w; x++) {
              if (isWhite(x, 0)) { queue.push(x, 0); bgMask[0 * w + x] = 1; }
              if (isWhite(x, h - 1)) { queue.push(x, h - 1); bgMask[(h - 1) * w + x] = 1; }
            }
            for (let y = 0; y < h; y++) {
              if (isWhite(0, y)) { queue.push(0, y); bgMask[y * w + 0] = 1; }
              if (isWhite(w - 1, y)) { queue.push(w - 1, y); bgMask[y * w + (w - 1)] = 1; }
            }

            let head = 0;
            while (head < queue.length) {
              const x = queue[head++];
              const y = queue[head++];

              const neighbors = [[x+1, y], [x-1, y], [x, y+1], [x, y-1]];
              for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  const nidx = ny * w + nx;
                  if (bgMask[nidx] === 0 && isWhite(nx, ny)) {
                    bgMask[nidx] = 1;
                    queue.push(nx, ny);
                  }
                }
              }
            }

            // Create transparent canvas with cropped tight bounds!
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d');
            const cropImgData = cropCtx.createImageData(cropW, cropH);

            for (let cy = 0; cy < cropH; cy++) {
              for (let cx = 0; cx < cropW; cx++) {
                const srcX = cropX + cx;
                const srcY = cropY + cy;
                const srcIdx = (srcY * w + srcX) * 4;
                const dstIdx = (cy * cropW + cx) * 4;

                const r = data[srcIdx];
                const g = data[srcIdx+1];
                const b = data[srcIdx+2];
                let a = data[srcIdx+3];

                // If this pixel was reached by exterior background flood fill:
                if (bgMask[srcY * w + srcX] === 1) {
                  // Transparent or soft antialiased edge
                  // Distance from white threshold
                  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                  if (lum >= 250) {
                    a = 0;
                  } else if (lum >= 240) {
                    a = Math.round(((250 - lum) / 10) * 255);
                  }
                }

                cropImgData.data[dstIdx] = r;
                cropImgData.data[dstIdx+1] = g;
                cropImgData.data[dstIdx+2] = b;
                cropImgData.data[dstIdx+3] = a;
              }
            }

            cropCtx.putImageData(cropImgData, 0, 0);

            // Also create a square version (centered) with transparent padding
            const sqSize = Math.max(cropW, cropH);
            const sqCanvas = document.createElement('canvas');
            sqCanvas.width = sqSize;
            sqCanvas.height = sqSize;
            const sqCtx = sqCanvas.getContext('2d');
            const offX = Math.round((sqSize - cropW) / 2);
            const offY = Math.round((sqSize - cropH) / 2);
            sqCtx.drawImage(cropCanvas, offX, offY);

            resolve({
              w, h,
              cropW, cropH,
              sqSize,
              cropDataUri: cropCanvas.toDataURL('image/png'),
              sqDataUri: sqCanvas.toDataURL('image/png')
            });
          };
          img.src = "${dataUri}";
        })
      `,
      awaitPromise: true,
      returnByValue: true
    });

    const val = result.result.value;
    console.log('Processed:', {
      w: val.w, h: val.h,
      cropW: val.cropW, cropH: val.cropH,
      sqSize: val.sqSize
    });

    // Save tight cropped PNG
    const cropBuf = Buffer.from(val.cropDataUri.split(',')[1], 'base64');
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/brand/anwar-bhuiyan-property-transparent.png', cropBuf);
    console.log('Saved anwar-bhuiyan-property-transparent.png');

    // Save square centered transparent PNG
    const sqBuf = Buffer.from(val.sqDataUri.split(',')[1], 'base64');
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/brand/anwar-bhuiyan-property-square-transparent.png', sqBuf);
    console.log('Saved anwar-bhuiyan-property-square-transparent.png');

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
