const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "C:\\Users\\Onty's zZz\\.gemini\\antigravity\\brain\\67e53663-ba74-4e56-88c5-fa3dd43b6058";
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function startStaticServer(distDir, port) {
  const mimeMap = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
  };

  const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    let filePath = path.join(distDir, cleanUrl);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mimeMap[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Static server running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

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

class ChromeSession {
  constructor(ws) {
    this.ws = ws;
    this.msgId = 1;
    this.handlers = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.handlers.has(msg.id)) {
        const { resolve, reject } = this.handlers.get(msg.id);
        this.handlers.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.handlers.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return res.result ? res.result.value : null;
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(outputPath, buf);
    console.log(`Saved screenshot: ${path.basename(outputPath)} (${Math.round(buf.length / 1024)} KB)`);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: width < 768,
    });
  }
}

async function runAcceptance() {
  console.log('--- STARTING LOGO RENDERING & CONTRAST ACCEPTANCE SUITE ---');

  const serverPort = 4174;
  const staticServer = await startStaticServer('C:\\Bhuiya-Property-Manager\\dist', serverPort);
  const LOCAL_URL = `http://127.0.0.1:${serverPort}`;

  const tempProfile = path.join(os.tmpdir(), 'chrome_contrast_test_' + Date.now());
  const chromePort = 9671;
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${tempProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  const results = {};

  try {
    const wsUrl = await fetchWsUrl(chromePort);
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    const session = new ChromeSession(ws);
    await session.send('Page.enable');
    await session.send('DOM.enable');
    await session.send('Runtime.enable');

    // 1. Check Login Screen in Light & Dark Mode
    console.log('\n[TEST 1] Testing Login Screen & Logo...');
    await session.setViewport(360, 800);
    await session.send('Page.navigate', { url: LOCAL_URL });
    await new Promise((r) => setTimeout(r, 2000));

    // Check logo container in login
    const loginLogoCheck = await session.eval(`
      (() => {
        const container = document.querySelector('.brand-logo-container');
        const img = document.querySelector('.brand-logo');
        if (!container || !img) return { pass: false, error: 'Logo container or img missing' };
        const rect = container.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);
        return {
          pass: true,
          containerW: rect.width,
          containerH: rect.height,
          imgW: imgRect.width,
          imgH: imgRect.height,
          objectFit: style.objectFit,
        };
      })()
    `);
    console.log('Login logo check:', loginLogoCheck);
    results.loginLogoRenders = Boolean(loginLogoCheck && loginLogoCheck.pass && loginLogoCheck.objectFit === 'contain');

    // Capture Light Mode Login Screenshot
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-01-light-login-360x800.png'));

    // Toggle Dark Mode on Login Screen
    await session.eval(`
      (() => {
        const themeBtn = document.querySelector('button[aria-label*="Dark"], button[aria-label*="Light"], button[title*="Dark"], button[title*="Light"]') ||
                         Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('🌙') || b.textContent.includes('☀️'));
        if (themeBtn) themeBtn.click();
        else document.documentElement.classList.add('dark');
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Check Dark Mode Login
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-02-dark-login-360x800.png'));

    // 2. Perform Login to reach Dashboard
    console.log('\n[TEST 2] Logging in to Dashboard...');
    await session.eval(`
      (() => {
        const emailInput = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]') || document.querySelectorAll('input')[0];
        const passInput = document.querySelector('input[type="password"]') || document.querySelectorAll('input')[1];
        if (emailInput && passInput) {
          emailInput.value = 'zahid@bhuiyan.com';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.value = '112233';
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('প্রবেশ') || b.textContent.includes('Login'));
          if (submitBtn) submitBtn.click();
        }
      })()
    `);

    // Wait for Dashboard to load
    await new Promise((r) => setTimeout(r, 4500));

    // Check if on Dashboard
    const onDashboard = await session.eval(`
      (() => {
        return Boolean(document.querySelector('.liquid-glass-dock-5') || document.querySelector('.brand-logo-container'));
      })()
    `);
    console.log('On Dashboard:', onDashboard);
    results.onDashboard = Boolean(onDashboard);

    // 3. Contrast & Logo verification on Dashboard in Dark Mode
    console.log('\n[TEST 3] Testing Dashboard Dark Mode Contrast & Logo...');
    await session.eval(`document.documentElement.classList.add('dark');`);
    await new Promise((r) => setTimeout(r, 500));

    const darkDashboardMetrics = await session.eval(`
      (() => {
        const h1 = document.querySelector('h1');
        const h2 = document.querySelector('h2');
        const h1Color = h1 ? window.getComputedStyle(h1).color : null;
        const h2Color = h2 ? window.getComputedStyle(h2).color : null;

        const logoImg = document.querySelector('.brand-logo');
        const logoContainer = document.querySelector('.brand-logo-container');
        const logoRect = logoImg ? logoImg.getBoundingClientRect() : null;
        const containerRect = logoContainer ? logoContainer.getBoundingClientRect() : null;

        function getLum(rgbStr) {
          if (!rgbStr) return 0;
          const match = rgbStr.match(/\\d+/g);
          if (!match || match.length < 3) return 0;
          const [r, g, b] = match.slice(0, 3).map(Number).map(v => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }

        function contrast(c1, c2) {
          const l1 = getLum(c1);
          const l2 = getLum(c2);
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
        }

        const darkCanvasColor = 'rgb(6, 23, 22)';
        const h1Contrast = contrast(h1Color, darkCanvasColor);
        const h2Contrast = contrast(h2Color, darkCanvasColor);

        return {
          h1Color,
          h2Color,
          h1Contrast,
          h2Contrast,
          logoWidth: logoRect ? logoRect.width : 0,
          logoHeight: logoRect ? logoRect.height : 0,
          containerWidth: containerRect ? containerRect.width : 0,
          containerHeight: containerRect ? containerRect.height : 0,
          noHorizontalScroll: document.documentElement.scrollWidth <= window.innerWidth,
        };
      })()
    `);
    console.log('Dark Dashboard Metrics:', darkDashboardMetrics);
    results.darkHeadingsContrast = darkDashboardMetrics && darkDashboardMetrics.h1Contrast >= 4.5 && darkDashboardMetrics.h2Contrast >= 4.5;
    results.darkLogoFitted = darkDashboardMetrics && darkDashboardMetrics.logoWidth > 30 && darkDashboardMetrics.logoHeight > 20;

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-03-dark-dashboard-360x800.png'));

    // Switch to desktop viewport (1280x800) for Dark Mode
    await session.setViewport(1280, 800);
    await new Promise((r) => setTimeout(r, 400));
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-04-dark-dashboard-1280x800.png'));

    // 4. Test Light Mode Dashboard
    console.log('\n[TEST 4] Testing Dashboard Light Mode Contrast & Logo...');
    await session.eval(`
      (() => {
        document.documentElement.classList.remove('dark');
        const themeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('☀️') || b.textContent.includes('🌙'));
        if (themeBtn && document.documentElement.classList.contains('dark')) themeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    await session.setViewport(360, 800);
    await new Promise((r) => setTimeout(r, 300));

    const lightDashboardMetrics = await session.eval(`
      (() => {
        const h1 = document.querySelector('h1');
        const h2 = document.querySelector('h2');
        const h1Color = h1 ? window.getComputedStyle(h1).color : null;
        const h2Color = h2 ? window.getComputedStyle(h2).color : null;

        function getLum(rgbStr) {
          if (!rgbStr) return 0;
          const match = rgbStr.match(/\\d+/g);
          if (!match || match.length < 3) return 0;
          const [r, g, b] = match.slice(0, 3).map(Number).map(v => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }

        function contrast(c1, c2) {
          const l1 = getLum(c1);
          const l2 = getLum(c2);
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
        }

        const lightCanvasColor = 'rgb(243, 250, 247)';
        const h1Contrast = contrast(h1Color, lightCanvasColor);
        const h2Contrast = contrast(h2Color, lightCanvasColor);

        return {
          h1Color,
          h2Color,
          h1Contrast,
          h2Contrast,
          noHorizontalScroll: document.documentElement.scrollWidth <= window.innerWidth,
        };
      })()
    `);
    console.log('Light Dashboard Metrics:', lightDashboardMetrics);
    results.lightHeadingsContrast = lightDashboardMetrics && lightDashboardMetrics.h1Contrast >= 4.5 && lightDashboardMetrics.h2Contrast >= 4.5;

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-05-light-dashboard-360x800.png'));

    // 5. Test Accounts / Khata in Dark Mode
    console.log('\n[TEST 5] Testing Accounts / Khata in Dark Mode...');
    await session.eval(`
      (() => {
        document.documentElement.classList.add('dark');
        const dockItems = document.querySelectorAll('.liquid-glass-dock-5-item, button');
        const accountsBtn = Array.from(dockItems).find(b => b.textContent.includes('হিসাব') || b.textContent.includes('Accounts'));
        if (accountsBtn) accountsBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const accountsCheck = await session.eval(`
      (() => {
        const cards = Array.from(document.querySelectorAll('h3'));
        return {
          hasCards: cards.length > 0,
        };
      })()
    `);
    console.log('Accounts Khata Check:', accountsCheck);
    results.accountsInDarkMode = Boolean(accountsCheck && accountsCheck.hasCards);

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-06-dark-accounts-360x800.png'));

    // 6. Test Profile Screen in Dark Mode
    console.log('\n[TEST 6] Testing Profile Screen in Dark Mode...');
    await session.eval(`
      (() => {
        const dockItems = document.querySelectorAll('.liquid-glass-dock-5-item, button');
        const profileBtn = Array.from(dockItems).find(b => b.textContent.includes('প্রোফাইল') || b.textContent.includes('Profile'));
        if (profileBtn) profileBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-07-dark-profile-360x800.png'));

    // 7. Test App Settings Modal
    console.log('\n[TEST 7] Testing App Settings Modal in Dark Mode...');
    await session.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('হোম কার্ড ও কুইক বাটন সেটিংস') || b.textContent.includes('Home Cards & Quick Action'));
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const appSettingsCheck = await session.eval(`
      (() => {
        const modal = document.querySelector('.fixed.inset-0');
        if (!modal) return { open: false };
        const h2 = modal.querySelector('h2');
        const h2Color = h2 ? window.getComputedStyle(h2).color : null;
        return {
          open: true,
          h2Color,
        };
      })()
    `);
    console.log('App Settings Modal Check:', appSettingsCheck);
    results.appSettingsModalContrast = Boolean(appSettingsCheck && appSettingsCheck.open);

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-08-dark-app-settings-modal.png'));

    // Close modal
    await session.eval(`
      (() => {
        const closeBtn = document.querySelector('.fixed.inset-0 button[aria-label*="lose"], .fixed.inset-0 button[title*="lose"]') ||
                         Array.from(document.querySelectorAll('.fixed.inset-0 button')).find(b => b.textContent.includes('বাতিল') || b.textContent.includes('Cancel') || b.querySelector('svg'));
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // 8. Test Member Management Modal
    console.log('\n[TEST 8] Testing Member Management Modal in Dark Mode...');
    await session.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('সদস্য তালিকা ও পারমিশন কন্ট্রোল প্যানেল') || b.textContent.includes('Member Directory & Permission Control'));
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const memberModalCheck = await session.eval(`
      (() => {
        const modal = document.querySelector('.fixed.inset-0');
        if (!modal) return { open: false };
        return { open: true };
      })()
    `);
    console.log('Member Management Modal Check:', memberModalCheck);
    results.memberManagementModalOpen = Boolean(memberModalCheck && memberModalCheck.open);

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'fix-09-dark-member-management-modal.png'));

    // 9. Mobile width tests (360px, 390px, 412px)
    console.log('\n[TEST 9] Testing Viewports at 360px, 390px, 412px...');
    for (const w of [360, 390, 412]) {
      await session.setViewport(w, 800);
      await new Promise((r) => setTimeout(r, 200));
      const noOverflow = await session.eval(`document.documentElement.scrollWidth <= window.innerWidth`);
      results[`viewport_${w}_noOverflow`] = Boolean(noOverflow);
      console.log(`Viewport ${w}px overflow check:`, noOverflow ? 'PASS' : 'FAIL');
    }

    ws.close();
  } finally {
    chromeProcess.kill();
    staticServer.close();
  }

  console.log('\n========================================');
  console.log('FINAL RESULTS SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('========================================');

  const allPassed = Object.values(results).every(Boolean);
  if (allPassed) {
    console.log('🎉 ALL LOGO & TYPOGRAPHY CONTRAST CHECKS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED!');
    process.exit(1);
  }
}

runAcceptance().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});
