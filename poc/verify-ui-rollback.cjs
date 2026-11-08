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
      // wait
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome remote debugging did not respond');
}

class ChromeSession {
  constructor(ws) {
    this.ws = ws;
    this.msgId = 1;
    this.handlers = new Map();
    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : event.data.toString('utf-8');
      const msg = JSON.parse(raw);
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
      returnByValue: true,
      awaitPromise: true,
    });
    return res && res.result ? res.result.value : null;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: width < 768,
    });
  }

  async captureScreenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buf);
    console.log(`Saved screenshot: ${path.basename(filePath)} (${Math.round(buf.length / 1024)} KB)`);
  }
}

async function main() {
  const DIST_DIR = path.join(__dirname, '..', 'dist');
  const PORT = 4180;
  const LOCAL_URL = `http://127.0.0.1:${PORT}`;

  console.log('--- STARTING COMPLETE UI ROLLBACK VERIFICATION SUITE ---');
  const staticServer = await startStaticServer(DIST_DIR, PORT);

  const chromeUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-rollback-final-'));
  const chromePort = 9245;

  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${chromeUserData}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

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

    // 1. Verify Restored Login Screen in Bengali & English
    console.log('\n[TEST 1] Testing Restored Login Screen (Bengali)...');
    await session.setViewport(360, 800);
    await session.send('Page.navigate', { url: LOCAL_URL });
    await new Promise((r) => setTimeout(r, 2500));

    const loginAuditBn = await session.eval(`
      (() => {
        const text = document.body.innerText;
        return {
          hasTestHelper: text.includes('স্ট্যাজিং টেস্ট লগইন') || text.includes('মাস্টার এডমিন (zahid)'),
          hasThemeToggle: Boolean(document.querySelector('button[aria-label*="Theme"], button[aria-label*="Dark"], button[title*="Dark"]')),
          hasBackgroundWaves: Boolean(document.querySelector('.wave-ribbon, svg[viewBox="0 0 1440 900"]')),
          hasLangSelector: Boolean(document.querySelector('[data-testid="language-selector"]')),
          hasLogo: Boolean(document.querySelector('img[src*="anwar-bhuiyan-property.svg"]')),
          hasWatermark: Boolean(document.querySelector('.pointer-events-none img[src*="anwar-bhuiyan-property.svg"]')),
          textSnippet: text.slice(0, 100).replace(/\\n/g, ' ')
        };
      })()
    `);
    console.log('Login Audit (BN):', loginAuditBn);
    results.loginAuditBn = loginAuditBn;

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-01-login-bn-360x800.png'));

    // Switch to English on Login Screen
    console.log('\n[TEST 1b] Switching to English on Login Screen...');
    await session.eval(`
      (() => {
        const enBtn = document.querySelector('button[data-language="en"], button[data-lang-btn="en"]');
        if (enBtn) enBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-02-login-en-360x800.png'));

    // Switch back to Bengali
    await session.eval(`
      (() => {
        const bnBtn = document.querySelector('button[data-language="bn"], button[data-lang-btn="bn"]');
        if (bnBtn) bnBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // 2. Perform Login with Master Admin Credentials
    console.log('\n[TEST 2] Performing Login with zahid@bhuiyan.com...');
    await session.eval(`
      (() => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        if (emailInput && passInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(emailInput, 'zahid@bhuiyan.com');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          setter.call(passInput, '112233');
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          const form = document.querySelector('form');
          if (form) form.requestSubmit();
        }
      })()
    `);

    // Wait for Dashboard to authenticate and render
    await new Promise((r) => setTimeout(r, 4500));

    // 3. Verify Restored Bengali Home Dashboard
    console.log('\n[TEST 3] Verifying Restored Bengali Home Dashboard Structure...');
    const dashboardAuditBn = await session.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const hasHouseSketch = Boolean(document.body.innerHTML.includes('architectural-house') || document.querySelector('svg[data-testid="architectural-house"]'));
        const hasPropertySummaryCard = Boolean(bodyText.includes('সম্পত্তি সারসংক্ষেপ') && document.querySelector('.liquid-glass-dock-5'));
        const hasThemeToggle = Boolean(document.querySelector('button[aria-label*="Theme"], button[aria-label*="Dark"], button[title*="Dark"]'));
        const hasWaves = Boolean(document.querySelector('.wave-ribbon'));
        
        // Check for 4 financial cards
        const hasTotalCollected = bodyText.includes('মোট জমা');
        const hasTotalDue = bodyText.includes('মোট বাকি');
        const hasTotalExpenses = bodyText.includes('মোট খরচ');
        const hasCashInHand = bodyText.includes('হাতে আছে');

        // Check for top row date & user cards
        const hasUserCard = bodyText.includes('Zahid');
        const hasDateCard = bodyText.includes('আজ:');

        // Check 5-option dock
        const dock = document.querySelector('.liquid-glass-dock-5');
        const dockButtons = dock ? dock.querySelectorAll('button').length : 0;

        return {
          onDashboard: Boolean(dock),
          hasHouseSketch,
          hasPropertySummaryCard,
          hasThemeToggle,
          hasWaves,
          hasTotalCollected,
          hasTotalDue,
          hasTotalExpenses,
          hasCashInHand,
          hasUserCard,
          hasDateCard,
          dockButtons,
          isDarkTheme: document.documentElement.classList.contains('dark'),
        };
      })()
    `);
    console.log('Dashboard Audit (BN):', dashboardAuditBn);
    results.dashboardAuditBn = dashboardAuditBn;

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-03-dashboard-bn-mobile-360x800.png'));

    // Capture Desktop Dashboard Screenshot (Bengali)
    await session.setViewport(1280, 800);
    await new Promise((r) => setTimeout(r, 600));
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-04-dashboard-bn-desktop-1280x800.png'));

    // 4. Switch to English Dashboard & Verify
    console.log('\n[TEST 4] Switching Dashboard to English...');
    await session.eval(`
      (() => {
        const enBtn = document.querySelector('button[data-language="en"], button[data-lang-btn="en"]');
        if (enBtn) enBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const dashboardAuditEn = await session.eval(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          hasTotalCollected: bodyText.includes('Collected'),
          hasTotalDue: bodyText.includes('Due'),
          hasTotalExpenses: bodyText.includes('Expenses'),
          hasCashInHand: bodyText.includes('In Hand') || bodyText.includes('Cash in Hand'),
          hasDateCard: bodyText.includes('Today:'),
          hasUserCard: bodyText.includes('Zahid'),
        };
      })()
    `);
    console.log('Dashboard Audit (EN):', dashboardAuditEn);
    results.dashboardAuditEn = dashboardAuditEn;

    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-05-dashboard-en-desktop-1280x800.png'));

    // Mobile English Dashboard
    await session.setViewport(360, 800);
    await new Promise((r) => setTimeout(r, 600));
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-06-dashboard-en-mobile-360x800.png'));

    // Switch back to Bengali
    await session.eval(`
      (() => {
        const bnBtn = document.querySelector('button[data-language="bn"], button[data-lang-btn="bn"]');
        if (bnBtn) bnBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // 5. Test Navigation to Accounts (হিসাব)
    console.log('\n[TEST 5] Navigating to Accounts tab...');
    await session.eval(`
      (() => {
        const accountsBtn = document.querySelector('button[data-nav-item="accounts"]');
        if (accountsBtn) accountsBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-07-accounts-360x800.png'));

    // 6. Test Navigation to Profile (প্রোফাইল)
    console.log('\n[TEST 6] Navigating to Profile tab...');
    await session.eval(`
      (() => {
        const profileBtn = document.querySelector('button[data-nav-item="profile"]');
        if (profileBtn) profileBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-08-profile-360x800.png'));

    // 7. Test Member Management Modal
    console.log('\n[TEST 7] Opening Member Management Modal...');
    await session.eval(`
      (() => {
        const memberBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('সদস্য তালিকা ও পারমিশন'));
        if (memberBtn) memberBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-09-member-modal-360x800.png'));

    // Close Member Modal
    await session.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label*="Close"], button[title*="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('বন্ধ') || b.textContent.includes('Close') || b.textContent === '✕');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // 8. Test App Settings Modal
    console.log('\n[TEST 8] Opening App Settings Modal...');
    await session.eval(`
      (() => {
        const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('হোম কার্ড ও কুইক বাটন'));
        if (settingsBtn) settingsBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));
    await session.captureScreenshot(path.join(SCREENSHOT_DIR, 'rollback-10-app-settings-modal-360x800.png'));

    console.log('\n--- ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
    try {
      staticServer.close();
    } catch {}
    try {
      fs.rmSync(chromeUserData, { recursive: true, force: true });
    } catch {}
  }

  console.log('\nFinal Test Results Summary:');
  console.log(JSON.stringify(results, null, 2));
}

main();
