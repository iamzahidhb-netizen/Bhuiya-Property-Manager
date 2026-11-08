import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import os from 'os';
import { spawn } from 'child_process';

const DEPLOYED_URL = 'https://bhuiya-property-staging.pages.dev';
const ARTIFACT_DIR = "C:\\Users\\Onty's zZz\\.gemini\\antigravity\\brain\\67e53663-ba74-4e56-88c5-fa3dd43b6058";
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome_contrast_audit_' + Date.now());

class ChromeClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };

    await this.send('Page.enable');
    await this.send('DOM.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Runtime.evaluate threw an exception');
    }
    return res.result ? res.result.value : null;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`    [SCREENSHOT] Saved: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
    return outPath;
  }

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile,
    });
  }

  async close() {
    if (this.ws) this.ws.close();
  }
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
  throw new Error('Chrome remote debugging did not respond in time');
}

async function runAudit() {
  console.log('========================================================================');
  console.log('AB LOGO RENDERING & GLOBAL TYPOGRAPHY CONTRAST VERIFICATION');
  console.log('Live Target:', DEPLOYED_URL);
  console.log('========================================================================\n');

  const port = 9672;
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${TEMP_PROFILE}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  const results = {};

  try {
    const wsUrl = await fetchWsUrl(port);
    const client = new ChromeClient(wsUrl);
    await client.connect();

    // 1. Audit Login Screen
    console.log('>>> [1/5] Auditing Login Screen & Logo...');
    await client.setViewport(360, 800, true);
    await client.send('Page.navigate', { url: DEPLOYED_URL });
    await new Promise((r) => setTimeout(r, 2500));

    // Check login logo container & object-fit
    const loginLogo = await client.eval(`
      (() => {
        const container = document.querySelector('.brand-logo-container');
        const img = document.querySelector('.brand-logo');
        if (!container || !img) return { pass: false, error: 'Logo missing' };
        const cRect = container.getBoundingClientRect();
        const iRect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);
        return {
          pass: true,
          containerW: cRect.width,
          containerH: cRect.height,
          imgW: iRect.width,
          imgH: iRect.height,
          objectFit: style.objectFit,
        };
      })()
    `);
    console.log('    Login Logo Audit:', loginLogo);
    results.loginLogoValid = loginLogo.pass && loginLogo.objectFit === 'contain';

    await client.captureScreenshot('contrast-01-login-light-360x800.png');

    // Toggle Dark mode on Login screen
    await client.eval(`
      (() => {
        const toggle = document.querySelector('button[aria-label="Toggle theme"]');
        if (toggle) toggle.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));
    await client.captureScreenshot('contrast-02-login-dark-360x800.png');

    // Toggle back to Light mode
    await client.eval(`
      (() => {
        const toggle = document.querySelector('button[aria-label="Toggle theme"]');
        if (toggle && document.documentElement.classList.contains('dark')) toggle.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // 2. Perform Master Admin Login
    console.log('\n>>> [2/5] Performing Master Admin Login on Live Staging...');
    await client.eval(`
      (() => {
        const emailInput = document.querySelector('input#email');
        const passInput = document.querySelector('input#password');
        const submitBtn = document.querySelector('button[type="submit"]');

        const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSet.call(emailInput, 'zahid@bhuiyan.com');
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));

        nativeSet.call(passInput, '112233');
        passInput.dispatchEvent(new Event('input', { bubbles: true }));

        submitBtn.click();
      })()
    `);

    // Wait for Dashboard to mount
    let dashboardMounted = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const hasNav = await client.eval(`Boolean(document.querySelector('button[data-nav-item="home"]'))`);
      if (hasNav) {
        dashboardMounted = true;
        break;
      }
    }
    if (!dashboardMounted) throw new Error('Dashboard did not mount in time');
    console.log('    ✓ Master Admin Dashboard mounted.');

    // 3. Audit Light Mode Dashboard Contrast & Header Logo
    console.log('\n>>> [3/5] Auditing Light Mode Dashboard Contrast & Logo...');
    // Ensure Light Mode
    await client.eval(`
      (() => {
        if (document.documentElement.classList.contains('dark')) {
          const toggle = document.querySelector('button[aria-label="Toggle theme"]');
          if (toggle) toggle.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const lightAudit = await client.eval(`
      (() => {
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

        const canvasBg = 'rgb(243, 250, 247)';
        const h1 = document.querySelector('header h1');
        const h1Color = h1 ? window.getComputedStyle(h1).color : null;
        const h1Contrast = contrast(h1Color, canvasBg);

        const welcomeH2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.includes('স্বাগতম') || h.textContent.includes('Welcome'));
        const h2Color = welcomeH2 ? window.getComputedStyle(welcomeH2).color : null;
        const h2Contrast = contrast(h2Color, canvasBg);

        const logoContainer = document.querySelector('header .brand-logo-container');
        const logoImg = document.querySelector('header .brand-logo');
        const cRect = logoContainer ? logoContainer.getBoundingClientRect() : null;
        const iRect = logoImg ? logoImg.getBoundingClientRect() : null;
        const objFit = logoImg ? window.getComputedStyle(logoImg).objectFit : null;

        return {
          h1Color,
          h1Contrast,
          h2Color,
          h2Contrast,
          logoContainerW: cRect ? cRect.width : 0,
          logoContainerH: cRect ? cRect.height : 0,
          logoImgW: iRect ? iRect.width : 0,
          logoImgH: iRect ? iRect.height : 0,
          objFit,
        };
      })()
    `);
    console.log('    Light Mode Contrast & Logo:', lightAudit);
    results.lightH1Contrast = lightAudit.h1Contrast >= 4.5;
    results.lightH2Contrast = lightAudit.h2Contrast >= 4.5;
    results.lightLogoFitted = lightAudit.logoImgW > 30 && lightAudit.objFit === 'contain';

    await client.captureScreenshot('contrast-03-dashboard-light-360x800.png');

    // 4. Audit Dark Mode Dashboard Contrast & Header Logo
    console.log('\n>>> [4/5] Auditing Dark Mode Dashboard Contrast & Logo...');
    // Switch to Dark mode
    await client.eval(`
      (() => {
        const toggle = document.querySelector('button[aria-label="Toggle theme"]');
        if (toggle) toggle.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const darkAudit = await client.eval(`
      (() => {
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

        const darkCanvas = 'rgb(6, 23, 22)';
        const h1 = document.querySelector('header h1');
        const h1Color = h1 ? window.getComputedStyle(h1).color : null;
        const h1Contrast = contrast(h1Color, darkCanvas);

        const welcomeH2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.includes('স্বাগতম') || h.textContent.includes('Welcome'));
        const h2Color = welcomeH2 ? window.getComputedStyle(welcomeH2).color : null;
        const h2Contrast = contrast(h2Color, darkCanvas);

        const logoContainer = document.querySelector('header .brand-logo-container');
        const logoImg = document.querySelector('header .brand-logo');
        const cRect = logoContainer ? logoContainer.getBoundingClientRect() : null;
        const iRect = logoImg ? logoImg.getBoundingClientRect() : null;
        const objFit = logoImg ? window.getComputedStyle(logoImg).objectFit : null;

        return {
          isDark: document.documentElement.classList.contains('dark'),
          h1Color,
          h1Contrast,
          h2Color,
          h2Contrast,
          logoContainerW: cRect ? cRect.width : 0,
          logoContainerH: cRect ? cRect.height : 0,
          logoImgW: iRect ? iRect.width : 0,
          logoImgH: iRect ? iRect.height : 0,
          objFit,
        };
      })()
    `);
    console.log('    Dark Mode Contrast & Logo:', darkAudit);
    results.darkThemeActive = darkAudit.isDark;
    results.darkH1Contrast = darkAudit.h1Contrast >= 4.5;
    results.darkH2Contrast = darkAudit.h2Contrast >= 4.5;
    results.darkLogoFitted = darkAudit.logoImgW > 30 && darkAudit.objFit === 'contain';

    await client.captureScreenshot('contrast-04-dashboard-dark-360x800.png');

    // Desktop view in Dark Mode
    await client.setViewport(1280, 800, false);
    await new Promise((r) => setTimeout(r, 500));
    await client.captureScreenshot('contrast-05-dashboard-dark-1280x800.png');

    // 5. Audit Accounts / Khata & Profile & Modals in Dark Mode
    console.log('\n>>> [5/5] Auditing Accounts, Profile & Modals in Dark Mode...');
    await client.setViewport(360, 800, true);

    // Navigate to Accounts
    await client.eval(`
      (() => {
        const accountsBtn = document.querySelector('button[data-nav-item="accounts"]');
        if (accountsBtn) accountsBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const accountsCheck = await client.eval(`
      (() => {
        const headings = Array.from(document.querySelectorAll('h3')).map(h => window.getComputedStyle(h).color);
        return {
          h3Count: headings.length,
          firstH3Color: headings[0] || null,
        };
      })()
    `);
    console.log('    Accounts View Check:', accountsCheck);
    results.accountsH3Visible = accountsCheck.h3Count > 0 && accountsCheck.firstH3Color !== 'rgb(0, 0, 0)';
    await client.captureScreenshot('contrast-06-accounts-dark-360x800.png');

    // Navigate to Profile
    await client.eval(`
      (() => {
        const profileBtn = document.querySelector('button[data-nav-item="profile"]');
        if (profileBtn) profileBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));
    await client.captureScreenshot('contrast-07-profile-dark-360x800.png');

    // Open App Settings Modal
    await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('হোম কার্ড ও কুইক বাটন সেটিংস') || b.textContent.includes('Home Cards & Quick Action'));
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));
    await client.captureScreenshot('contrast-08-app-settings-modal-dark.png');

    // Close App Settings Modal
    await client.eval(`
      (() => {
        const closeBtn = document.querySelector('.fixed.inset-0 button[aria-label="বন্ধ করুন"]') ||
                         document.querySelector('.fixed.inset-0 button[aria-label="Close"]') ||
                         document.querySelector('.fixed.inset-0 button');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Open Member Management Modal
    await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('সদস্য তালিকা ও পারমিশন কন্ট্রোল প্যানেল') || b.textContent.includes('Member Directory & Permission Control'));
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));
    await client.captureScreenshot('contrast-09-member-management-modal-dark.png');

    // Close Member Management Modal
    await client.eval(`
      (() => {
        const closeBtn = document.querySelector('.fixed.inset-0 button[aria-label="বন্ধ করুন"]') ||
                         document.querySelector('.fixed.inset-0 button[aria-label="Close"]') ||
                         document.querySelector('.fixed.inset-0 button');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Responsive Viewports
    console.log('\n>>> Auditing Mobile Widths (360px, 390px, 412px)...');
    for (const w of [360, 390, 412]) {
      await client.setViewport(w, 800, true);
      await new Promise((r) => setTimeout(r, 200));
      const noOverflow = await client.eval(`document.documentElement.scrollWidth <= window.innerWidth`);
      results[`viewport_${w}_noOverflow`] = Boolean(noOverflow);
      console.log(`    Viewport ${w}px horizontal overflow check: ${noOverflow ? 'PASS' : 'FAIL'}`);
    }

    await client.close();
  } finally {
    chromeProcess.kill();
  }

  console.log('\n========================================================================');
  console.log('AUDIT RESULTS SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('========================================================================');

  const allPassed = Object.values(results).every(Boolean);
  if (allPassed) {
    console.log('🎉 ALL LOGO RENDERING & TYPOGRAPHY CONTRAST CHECKS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED!');
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
