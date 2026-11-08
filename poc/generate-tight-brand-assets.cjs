const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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
  const tempProfile = path.join(os.tmpdir(), 'chrome_logo_gen_' + Date.now());
  const port = 9669;
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

    // Read the original source PNG from Downloads
    const sourcePng = "C:\\Users\\Onty's zZz\\Downloads\\Anwar Bhuiyan Property Logo.png";
    const srcBuf = fs.readFileSync(sourcePng);
    const srcDataUri = `data:image/png;base64,${srcBuf.toString('base64')}`;

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

            // Step 1: Precise BFS Flood-fill from borders to only remove outer background
            // Any pixel connected to border that is near white (r,g,b >= 240) is background.
            // Interior white parts (if any) are protected.
            const bgMask = new Uint8Array(w * h);
            const queue = [];

            function isWhite(x, y) {
              const idx = (y * w + x) * 4;
              return data[idx] >= 238 && data[idx+1] >= 238 && data[idx+2] >= 238;
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

            // Find exact bounding box of the non-background pixels
            let minX = w, minY = h, maxX = 0, maxY = 0;
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                if (bgMask[y * w + x] === 0) {
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }

            const artworkW = maxX - minX + 1;
            const artworkH = maxY - minY + 1;

            // Crop with proportional 2% breathing margin
            const margin = Math.round(Math.max(artworkW, artworkH) * 0.02);
            const cropX = Math.max(0, minX - margin);
            const cropY = Math.max(0, minY - margin);
            const cropW = Math.min(w - cropX, artworkW + margin * 2);
            const cropH = Math.min(h - cropY, artworkH + margin * 2);

            // Transparent cropped canvas
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

                if (bgMask[srcY * w + srcX] === 1) {
                  // Outer background: smooth antialiasing around edges
                  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                  if (lum >= 250) {
                    a = 0;
                  } else if (lum >= 238) {
                    a = Math.round(((250 - lum) / 12) * 255);
                  }
                }

                cropImgData.data[dstIdx] = r;
                cropImgData.data[dstIdx+1] = g;
                cropImgData.data[dstIdx+2] = b;
                cropImgData.data[dstIdx+3] = a;
              }
            }
            cropCtx.putImageData(cropImgData, 0, 0);

            // Also create a 512x512 PWA App Icon with subtle elegant emerald-tinted background
            // or white-to-mint glass background so it looks stunning on Android home screen!
            const pwa512 = document.createElement('canvas');
            pwa512.width = 512;
            pwa512.height = 512;
            const pwaCtx = pwa512.getContext('2d');

            // Draw rounded or solid gradient icon background for Android PWA
            const grad = pwaCtx.createLinearGradient(0, 0, 512, 512);
            grad.addColorStop(0, '#FFFFFF');
            grad.addColorStop(0.5, '#F0FAF6');
            grad.addColorStop(1, '#D8F3E5');
            pwaCtx.fillStyle = grad;
            pwaCtx.fillRect(0, 0, 512, 512);

            // Subtle border
            pwaCtx.strokeStyle = 'rgba(7, 139, 101, 0.25)';
            pwaCtx.lineWidth = 16;
            pwaCtx.strokeRect(8, 8, 496, 496);

            // Draw logo centered in 512x512 icon (fitting 80% of width)
            const targetW = 410;
            const targetH = Math.round(targetW * (cropH / cropW));
            const pwaX = Math.round((512 - targetW) / 2);
            const pwaY = Math.round((512 - targetH) / 2);
            pwaCtx.drawImage(cropCanvas, pwaX, pwaY, targetW, targetH);

            // 192x192 version
            const pwa192 = document.createElement('canvas');
            pwa192.width = 192;
            pwa192.height = 192;
            const p192Ctx = pwa192.getContext('2d');
            p192Ctx.drawImage(pwa512, 0, 0, 192, 192);

            resolve({
              w, h,
              artworkW, artworkH,
              cropW, cropH,
              cropDataUri: cropCanvas.toDataURL('image/png'),
              pwa512DataUri: pwa512.toDataURL('image/png'),
              pwa192DataUri: pwa192.toDataURL('image/png')
            });
          };
          img.src = "${srcDataUri}";
        })
      `,
      awaitPromise: true,
      returnByValue: true
    });

    const val = result.result.value;
    console.log('Processed metrics:', {
      artworkW: val.artworkW,
      artworkH: val.artworkH,
      cropW: val.cropW,
      cropH: val.cropH
    });

    const cropBuf = Buffer.from(val.cropDataUri.split(',')[1], 'base64');
    const pwa512Buf = Buffer.from(val.pwa512DataUri.split(',')[1], 'base64');
    const pwa192Buf = Buffer.from(val.pwa192DataUri.split(',')[1], 'base64');

    // 1. Save transparent PNG for brand
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/brand/anwar-bhuiyan-property.png', cropBuf);
    console.log('Saved public/brand/anwar-bhuiyan-property.png');

    // 2. Generate canonical transparent SVG with tight viewBox
    const tightSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${val.cropW} ${val.cropH}" width="100%" height="100%">
  <image width="${val.cropW}" height="${val.cropH}" href="${val.cropDataUri}"/>
</svg>`;
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/brand/anwar-bhuiyan-property.svg', tightSvg, 'utf8');
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/favicon.svg', tightSvg, 'utf8');
    console.log('Updated public/brand/anwar-bhuiyan-property.svg and public/favicon.svg');

    // 3. Update PWA icons so home screen shows official AB branding!
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/icons/icon-512.png', pwa512Buf);
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/icons/icon-192.png', pwa192Buf);
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/icons/icon-maskable-512.png', pwa512Buf);
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/icons/icon-maskable-192.png', pwa192Buf);
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/icons/apple-touch-icon.png', pwa192Buf);
    fs.writeFileSync('C:/Bhuiya-Property-Manager/public/apple-touch-icon.png', pwa192Buf);
    console.log('Updated all PWA icons in public/icons/ and public/!');

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
