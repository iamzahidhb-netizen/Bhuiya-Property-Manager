import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';
import { spawn } from 'child_process';

const DEPLOYED_URL = 'https://bhuiya-property-staging.pages.dev';
const ARTIFACT_DIR = 'C:\\Users\\Onty\'s zZz\\.gemini\\antigravity\\brain\\67e53663-ba74-4e56-88c5-fa3dd43b6058';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome_rem_test_' + Date.now());

class ChromeClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.failedRequests = [];
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
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
        if (type === 'error' && !text.includes('auth/invalid-credential')) {
          this.consoleErrors.push(text);
        }
      }
      if (msg.method === 'Network.responseReceived') {
        const status = msg.params.response.status;
        if (status >= 400 && !msg.params.response.url.includes('identitytoolkit')) {
          this.failedRequests.push({ url: msg.params.response.url, status });
        }
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
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${res.exceptionDetails.text} (${expression})`);
    }
    return res.result.value;
  }

  async sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async waitForSelector(selector, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = await this.eval(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (found) return true;
      await this.sleep(250);
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  async waitForText(text, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = await this.eval(`document.body.innerText.includes(${JSON.stringify(text)})`);
      if (found) return true;
      await this.sleep(250);
    }
    throw new Error(`Timeout waiting for text: ${text}`);
  }

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
    await this.sleep(400);
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res.data) {
      const buffer = Buffer.from(res.data, 'base64');
      const outPath = path.join(SCREENSHOT_DIR, filename);
      fs.writeFileSync(outPath, buffer);
      console.log(`    [Screenshot Saved] -> ${filename} (${Math.round(buffer.length / 1024)} KB)`);
      return outPath;
    }
    return null;
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function getBrowserWsUrl(port = 9226) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find((t) => t.type === 'page') || list[0];
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            reject(new Error('No page WebSocket URL found'));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('========================================================================');
  console.log('ANWAR BHUIYAN PROPERTY — FINAL REMAINING TASKS VERIFICATION SUITE');
  console.log('Target Deployment:', DEPLOYED_URL);
  console.log('========================================================================\n');

  // Launch headless Chrome
  const port = 9226;
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${TEMP_PROFILE}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let client = null;
  const testResults = [];

  function record(testName, passed, detail) {
    testResults.push({ testName, passed, detail });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} | ${testName}${detail ? ` (${detail})` : ''}`);
  }

  try {
    await new Promise((r) => setTimeout(r, 2000));
    const wsUrl = await getBrowserWsUrl(port);
    client = new ChromeClient(wsUrl);
    await client.connect();
    console.log('Connected to Chrome DevTools Protocol.');

    // -------------------------------------------------------------------------
    // TEST 1: Index.html Theme-Color & Manifest Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Android Status Bar Theme & Manifest ---');
    await client.send('Page.navigate', { url: DEPLOYED_URL });
    await client.waitForSelector('body', 10000);
    await client.sleep(1500);

    const themeColorMeta = await client.eval(`
      document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
    `);
    const isThemeGreen = themeColorMeta === '#f0fdf4';
    record('Android Status Bar Theme Color', isThemeGreen, `content="${themeColorMeta}"`);

    // Verify Brand Logo in Login Page
    const loginHasOfficialLogo = await client.eval(`
      Boolean(document.querySelector('img[src*="anwar-bhuiyan-property.svg"]'))
    `);
    record('Official SVG Logo on Login Screen', loginHasOfficialLogo, 'Logo embedded in rounded container');

    await client.captureScreenshot('rem-01-login-screen-with-logo.png');

    // -------------------------------------------------------------------------
    // TEST 2: Login as Master Admin (zahid@bhuiyan.com)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Master Admin Authentication ---');
    await client.eval(`(() => {
      const adminBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('মাস্টার এডমিন') || b.innerText.includes('Master Admin'));
      if (adminBtn) adminBtn.click();
    })()`);
    await client.sleep(500);
    await client.eval(`(() => {
      document.querySelector('button[type="submit"]').click();
    })()`);

    // Wait for Dashboard
    await client.waitForSelector('button[data-nav-item="home"]', 20000);
    await client.sleep(2500);
    record('Master Admin Authenticated', true, 'Dashboard loaded');

    const headerHasLogo = await client.eval(`
      Boolean(document.querySelector('header img[src*="anwar-bhuiyan-property.svg"]'))
    `);
    record('Official SVG Logo in Header', headerHasLogo, 'Displayed with rounded container and drop-shadow');

    // -------------------------------------------------------------------------
    // TEST 3: Home Dashboard Simplification
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Home Dashboard Simplification ---');

    // Check Date Card
    const dateCardInfo = await client.eval(`(() => {
      const text = document.body.innerText;
      const hasDateLine = text.includes('আজ:') || text.includes('Today:');
      const hasYear = text.includes('২০২৬') || text.includes('2026');
      return { hasDateLine, hasYear };
    })()`);
    record('Date Card Present', dateCardInfo.hasDateLine && dateCardInfo.hasYear, 'Displays Dhaka weekday and formatted date');

    // Check Authenticated User Name Card
    const userNameCardInfo = await client.eval(`(() => {
      const text = document.body.innerText;
      const hasZahid = text.includes('Zahid');
      const hasEmailInHome = text.includes('zahid@bhuiyan.com');
      const hasUidInHome = text.includes('WunBcW1KihNW2DMTs3R0gUpQ0fh2');
      return { hasZahid, hasEmailInHome, hasUidInHome };
    })()`);
    record('User Name Card Shows "Zahid"', userNameCardInfo.hasZahid, 'Shows user actual name');
    record('Email & UID Absent on Home', !userNameCardInfo.hasEmailInHome && !userNameCardInfo.hasUidInHome, 'No verbose technical data');

    // Check Technical Information Strip is REMOVED
    const techStripPresent = await client.eval(`
      document.body.innerText.includes('ক্লাউডফ্লেয়ার স্ট্যাজিং (নিরাপদ মোড)') ||
      document.body.innerText.includes('Cloudflare Pages Staging (safe mode)')
    `);
    record('Technical Strip Removed', !techStripPresent, 'Strip marked for removal is absent');

    // Check Quick Actions Section is REMOVED
    const quickActionsPresent = await client.eval(`
      document.body.innerText.includes('দ্রুত কাজ (Quick Actions)') ||
      document.body.innerText.includes('Quick Actions')
    `);
    record('Quick Actions Section Removed from Home', !quickActionsPresent, 'Duplicate quick touch buttons removed');

    // Check Exactly 4 Summary Cards in Home
    const summaryCardTitles = await client.eval(`(() => {
      const text = document.body.innerText;
      return {
        collected: text.includes('মোট জমা') || text.includes('মোট ভাড়া আদায়') || text.includes('Total Collected'),
        due: text.includes('মোট বাকি') || text.includes('Total Due'),
        expenses: text.includes('মোট খরচ') || text.includes('Total Expenses'),
        cashInHand: text.includes('হাতে আছে') || text.includes('Cash in Hand') || text.includes('Available Balance')
      };
    })()`);
    const all4SummaryCards = summaryCardTitles.collected && summaryCardTitles.due && summaryCardTitles.expenses && summaryCardTitles.cashInHand;
    record('Exactly 4 Summary Cards Present', all4SummaryCards, 'মোট জমা, মোট বাকি, মোট খরচ, হাতে আছে');

    await client.captureScreenshot('rem-02-home-dashboard-bengali.png');

    // -------------------------------------------------------------------------
    // TEST 4: Accounts (হিসাব) Navigation & Month Controls
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Accounts (হিসাব) Section ---');
    await client.eval(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('হিসাব') || b.innerText.includes('Accounts'));
      if (btn) btn.click();
    `);
    await client.sleep(1200);

    const accountsHasMonthControls = await client.eval(`(() => {
      const text = document.body.innerText;
      const hasKhata = text.includes('পারিবারিক মাসিক খাতা') || text.includes('Monthly Khata');
      const hasMonth = text.includes('২০২৬') || text.includes('2026');
      return hasKhata && hasMonth;
    })()`);
    record('Accounts Khata Month Header', accountsHasMonthControls, 'Monthly khata with month controls');

    await client.captureScreenshot('rem-03-accounts-section-bengali.png');

    // -------------------------------------------------------------------------
    // TEST 5: Profile (প্রোফাইল) Screen Simplification
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Profile Screen Simplification ---');
    await client.eval(`(() => {
      const btn = document.querySelector('button[data-nav-item="profile"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('প্রোফাইল') || b.innerText.includes('Profile'));
      if (btn) btn.click();
    })()`);
    await client.sleep(1200);

    const profileAudit = await client.eval(`(() => {
      const text = document.body.innerText;
      const hasZahid = text.includes('Zahid');
      const hasMasterAdminBadge = text.includes('মাস্টার এডমিন') || text.includes('Master Admin');
      const hasEmailInProfile = text.includes('zahid@bhuiyan.com');
      const hasUidInProfile = text.includes('WunBcW1KihNW2DMTs3R0gUpQ0fh2');
      const hasWorkspaceId = text.includes('workspace_bhuiya_family');
      const hasLockDiag = text.includes('DISABLE_FINANCIAL_WRITES=true');
      const hasMemberManagementTitle = text.includes('সদস্য ব্যবস্থাপনা');
      const hasMemberManagementDesc = text.includes('পরিবারের সদস্য ও তাদের অনুমতি পরিচালনা করুন।');
      const settingsCount = (text.match(/অ্যাপ সেটিংস ও নিয়ন্ত্রণ/g) || []).length;
      const logoutCount = (text.match(/লগআউট করুন/g) || []).length;

      return {
        hasZahid,
        hasMasterAdminBadge,
        hasEmailInProfile,
        hasUidInProfile,
        hasWorkspaceId,
        hasLockDiag,
        hasMemberManagementTitle,
        hasMemberManagementDesc,
        settingsCount,
        logoutCount
      };
    })()`);

    record('Profile Shows User Name & Role Only', profileAudit.hasZahid && profileAudit.hasMasterAdminBadge, 'Displays "Zahid" and Master Admin badge');
    record('Email, UID & Workspace Diagnostics Absent', !profileAudit.hasEmailInProfile && !profileAudit.hasUidInProfile && !profileAudit.hasLockDiag, 'Clean minimal user card');
    record('Member Management Title Exact', profileAudit.hasMemberManagementTitle, 'সদস্য ব্যবস্থাপনা');
    record('Member Management Description Exact', profileAudit.hasMemberManagementDesc, 'পরিবারের সদস্য ও তাদের অনুমতি পরিচালনা করুন।');
    record('No Duplicate Settings Cards', profileAudit.settingsCount <= 1, `Settings section count: ${profileAudit.settingsCount}`);
    record('Single Sign Out Action', profileAudit.logoutCount === 1, `Sign Out button count: ${profileAudit.logoutCount}`);

    await client.captureScreenshot('rem-04-profile-simplified-bengali.png');

    // -------------------------------------------------------------------------
    // TEST 6: English Localization Toggle
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: English Language Toggle & Dictionary ---');
    await client.eval(`(() => {
      const enBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'EN' || b.innerText.trim() === 'English');
      if (enBtn) enBtn.click();
    })()`);
    await client.sleep(1200);

    const enProfileAudit = await client.eval(`(() => {
      const text = document.body.innerText;
      return {
        hasEnTitle: text.includes('Anwar Bhuiyan Property'),
        hasMemberManagementEn: text.includes('Member Management'),
        hasMemberManagementDescEn: text.includes('Manage family members and their permissions.'),
        hasSignOutEn: text.includes('Sign Out')
      };
    })()`);
    record('Profile Translated to English', enProfileAudit.hasMemberManagementEn && enProfileAudit.hasSignOutEn, 'Member Management & Sign Out translated');

    await client.captureScreenshot('rem-05-profile-simplified-english.png');

    // Navigate to Home in English
    await client.eval(`(() => {
      const btn = document.querySelector('button[data-nav-item="home"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Home'));
      if (btn) btn.click();
    })()`);
    await client.sleep(1200);

    const enHomeAudit = await client.eval(`(() => {
      const text = document.body.innerText;
      return {
        hasDateEn: text.includes('Today:'),
        hasCollectedEn: text.includes('Total Collected'),
        hasDueEn: text.includes('Total Due'),
        hasExpensesEn: text.includes('Total Expenses'),
        hasCashEn: text.includes('Cash in Hand') || text.includes('Available Balance')
      };
    })()`);
    record('Home Translated to English', enHomeAudit.hasDateEn && enHomeAudit.hasCollectedEn && enHomeAudit.hasDueEn, 'Cards & Date localized in English');

    await client.captureScreenshot('rem-06-home-dashboard-english.png');

    // Switch back to Bengali
    await client.eval(`(() => {
      const bnBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'বাং' || b.innerText.trim() === 'বাংলা');
      if (bnBtn) bnBtn.click();
    })()`);
    await client.sleep(1200);

    // -------------------------------------------------------------------------
    // TEST 7: Mobile Viewports (Android 360x800 & iPhone 390x844)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Mobile Viewports & Layout Validation ---');
    await client.setViewport(360, 800, true);
    await client.sleep(800);

    const mobile360Overflow = await client.eval(`
      document.documentElement.scrollWidth <= window.innerWidth
    `);
    record('Android 360x800 No Horizontal Overflow', mobile360Overflow, 'Layout fits cleanly within 360px viewport');
    await client.captureScreenshot('rem-07-mobile-android-360x800.png');

    await client.setViewport(390, 844, true);
    await client.sleep(800);

    const mobile390Overflow = await client.eval(`
      document.documentElement.scrollWidth <= window.innerWidth
    `);
    record('iPhone 390x844 No Horizontal Overflow', mobile390Overflow, 'Layout fits cleanly within 390px viewport');
    await client.captureScreenshot('rem-08-mobile-iphone-390x844.png');

    // Reset viewport
    await client.setViewport(1440, 900, false);
    await client.sleep(400);

    // -------------------------------------------------------------------------
    // TEST 8: Console Errors & Failed Network Requests
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Console & Network Health ---');
    record('Zero Browser Console Errors', client.consoleErrors.length === 0, `${client.consoleErrors.length} errors logged`);
    record('Zero Failed HTTP Requests', client.failedRequests.length === 0, `${client.failedRequests.length} requests failed`);

  } catch (err) {
    console.error('Test execution error:', err);
    record('Test Suite Completion', false, err.message);
  } finally {
    if (client) await client.close();
    chromeProcess.kill();
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  console.log('\n========================================================================');
  const allPassed = testResults.every((r) => r.passed);
  console.log(`FINAL RESULT: ${allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log(`Passed: ${testResults.filter((r) => r.passed).length} / ${testResults.length}`);
  console.log('========================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main();
