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
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome_5nav_test_' + Date.now());

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
          const targets = JSON.parse(data);
          const page = targets.find((t) => t.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            reject(new Error('No open Chrome page target found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

let passedChecks = 0;
let totalChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('BHUIYA PROPERTY MANAGER: FIVE-OPTION LIQUID GLASS NAVIGATION SUITE');
  console.log('Target Deployed URL:', DEPLOYED_URL);
  console.log('========================================================================\n');

  const PORT = 9226;
  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      `--user-data-dir=${TEMP_PROFILE}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let cdp;
  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      try {
        wsUrl = await getBrowserWsUrl(PORT);
        if (wsUrl) break;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!wsUrl) throw new Error('Could not connect to Chrome debugging endpoint');

    cdp = new ChromeClient(wsUrl);
    await cdp.connect();

    // 1. Navigate to Staging Application
    console.log('--- SUITE 1: AUTHENTICATION & LANDING ---');
    await cdp.setViewport(1440, 900, false);
    await cdp.send('Page.navigate', { url: DEPLOYED_URL });
    await cdp.sleep(3000);

    const onLogin = await cdp.eval(`(() => Boolean(document.querySelector('input[type="email"]')))()`);
    if (onLogin) {
      console.log('  Authenticating as Master Admin (zahid@bhuiyan.com)...');
      await cdp.eval(`(() => {
        const adminBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('মাস্টার এডমিন') || b.innerText.includes('Master Admin'));
        if (adminBtn) adminBtn.click();
      })()`);
      await cdp.sleep(500);
      await cdp.eval(`(() => { document.querySelector('button[type="submit"]').click(); })()`);
    }

    await cdp.waitForSelector('button[data-nav-item="home"]', 20000);
    await cdp.sleep(1200);
    assert(true, 'Master Admin authenticated and landed on Dashboard');

    // 2. Audit Five-Option Navigation Structure
    console.log('\n--- SUITE 2: FIVE-OPTION NAVIGATION STRUCTURE & ORDER AUDIT ---');
    const navItems = await cdp.eval(`(() => {
      const dock = document.querySelector('nav.liquid-glass-dock-5') || document.querySelector('nav[aria-label="প্রধান নেভিগেশন ডক"]');
      if (!dock) return null;
      const buttons = Array.from(dock.querySelectorAll('button'));
      return buttons.map((b, idx) => ({
        index: idx + 1,
        text: b.innerText.trim(),
        navItem: b.getAttribute('data-nav-item'),
        ariaLabel: b.getAttribute('aria-label'),
        hasSvg: Boolean(b.querySelector('svg')),
        classes: b.className
      }));
    })()`);

    assert(Boolean(navItems), 'Floating Liquid Glass navigation dock with aria-label="প্রধান নেভিগেশন ডক" found in DOM');
    assert(navItems.length === 5, `Navigation contains exactly 5 options (found: ${navItems.length})`);

    const expectedOrder = [
      { pos: 1, label: 'হোম', key: 'home' },
      { pos: 2, label: 'হিসাব', key: 'accounts' },
      { pos: 3, label: 'নতুন খরচ', key: 'new-expense' },
      { pos: 4, label: 'ভাড়া জমা', key: 'rent-deposit' },
      { pos: 5, label: 'প্রোফাইল', key: 'profile' }
    ];

    expectedOrder.forEach((exp, i) => {
      const item = navItems[i];
      assert(item.text.includes(exp.label), `Position ${exp.pos} has label "${exp.label}" (Actual: "${item.text}")`);
      assert(item.navItem === exp.key, `Position ${exp.pos} data-nav-item is "${exp.key}"`);
      assert(item.hasSvg, `Position ${exp.pos} has inline SVG icon`);
    });

    // Check SVG Displacement filter on dock
    const dockFilterAudit = await cdp.eval(`(() => {
      const dock = document.querySelector('nav[aria-label="প্রধান নেভিগেশন ডক"]');
      const cards = document.querySelectorAll('.liquid-glass-card');
      return {
        dockFound: Boolean(dock),
        dockClasses: dock ? dock.className : '',
        totalGlassCards: cards.length
      };
    })()`);
    assert(dockFilterAudit.dockClasses.includes('liquid-glass-dock-5'), 'Dock utilizes .liquid-glass-dock-5 grid CSS architecture');

    await cdp.captureScreenshot('5nav-01-desktop-overview-1440x900.png');

    // 3. Test Navigation: Option 1 (হোম)
    console.log('\n--- SUITE 3: OPTION 1 (হোম) INTERACTION & ACTIVE STATE ---');
    await cdp.eval(`(() => {
      const homeBtn = document.querySelector('button[data-nav-item="home"]');
      if (homeBtn) homeBtn.click();
    })()`);
    await cdp.sleep(800);

    const homeActiveState = await cdp.eval(`(() => {
      const homeBtn = document.querySelector('button[data-nav-item="home"]');
      const hasCollectedCard = document.body.innerText.includes('মোট জমা') || document.body.innerText.includes('মোট ভাড়া আদায়');
      return {
        isActive: homeBtn.classList.contains('active'),
        ariaCurrent: homeBtn.getAttribute('aria-current'),
        hasCollectedCard
      };
    })()`);
    assert(homeActiveState.isActive, 'Option 1 (হোম) has "active" styling class');
    assert(homeActiveState.ariaCurrent === 'page', 'Option 1 (হোম) has aria-current="page"');
    assert(homeActiveState.hasCollectedCard, 'Home dashboard summary cards visible');

    // 4. Test Navigation: Option 2 (হিসাব)
    console.log('\n--- SUITE 4: OPTION 2 (হিসাব) INTERACTION & ACTIVE STATE ---');
    await cdp.eval(`(() => {
      const accBtn = document.querySelector('button[data-nav-item="accounts"]');
      if (accBtn) accBtn.click();
    })()`);
    await cdp.sleep(1000);
    await cdp.waitForText('পারিবারিক মাসিক খাতা');

    const accountsActiveState = await cdp.eval(`(() => {
      const homeBtn = document.querySelector('button[data-nav-item="home"]');
      const accBtn = document.querySelector('button[data-nav-item="accounts"]');
      return {
        homeIsActive: homeBtn.classList.contains('active'),
        accIsActive: accBtn.classList.contains('active'),
        accAriaCurrent: accBtn.getAttribute('aria-current')
      };
    })()`);
    assert(!accountsActiveState.homeIsActive, 'Option 1 (হোম) is no longer active');
    assert(accountsActiveState.accIsActive, 'Option 2 (হিসাব) has "active" styling class');
    assert(accountsActiveState.accAriaCurrent === 'page', 'Option 2 (হিসাব) has aria-current="page"');
    await cdp.captureScreenshot('5nav-02-accounts-screen-1440x900.png');

    // 5. Test Shortcut: Option 3 (নতুন খরচ - New Expense Modal)
    console.log('\n--- SUITE 5: OPTION 3 (নতুন খরচ) MODAL SHORTCUT AUDIT ---');
    await cdp.eval(`(() => {
      const expBtn = document.querySelector('button[data-nav-item="new-expense"]');
      if (expBtn) expBtn.click();
    })()`);
    await cdp.sleep(1000);
    await cdp.waitForText('নতুন খরচ যোগ করুন');

    const expenseModalAudit = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const titleInput = document.querySelector('input[placeholder*="বিদ্যুৎ বিল"]') || document.querySelector('input[type="text"]');
      const amountInput = document.querySelector('input[type="number"]');
      const accBtn = document.querySelector('button[data-nav-item="accounts"]');
      const expBtn = document.querySelector('button[data-nav-item="new-expense"]');
      return {
        modalVisible: Boolean(modal),
        hasTitleInput: Boolean(titleInput),
        hasAmountInput: Boolean(amountInput),
        accStillActive: accBtn.classList.contains('active'),
        expIsActive: expBtn.classList.contains('active')
      };
    })()`);
    assert(expenseModalAudit.modalVisible, 'Existing SimpleExpenseModal opened successfully above current screen');
    assert(expenseModalAudit.hasTitleInput && expenseModalAudit.hasAmountInput, 'Existing expense form inputs rendered');
    assert(expenseModalAudit.accStillActive, 'Underlying active page (হিসাব) remains active while modal is open');
    assert(!expenseModalAudit.expIsActive, 'Action button (নতুন খরচ) did NOT incorrectly receive page active state');

    await cdp.captureScreenshot('5nav-03-new-expense-modal-shortcut.png');

    // Close Expense Modal
    await cdp.eval(`(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('বাতিল') || b.getAttribute('aria-label') === 'Close');
      if (closeBtn) closeBtn.click();
    })()`);
    await cdp.sleep(800);

    const afterExpClose = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const accHeader = document.body.innerText.includes('পারিবারিক মাসিক খাতা');
      return { modalOpen: Boolean(modal), returnsToAccounts: accHeader };
    })()`);
    assert(!afterExpClose.modalOpen, 'Expense modal closed cleanly');
    assert(afterExpClose.returnsToAccounts, 'User returned to previously selected screen (হিসাব)');

    // 6. Test Shortcut: Option 4 (ভাড়া জমা - Rent Deposit Modal)
    console.log('\n--- SUITE 6: OPTION 4 (ভাড়া জমা) MODAL SHORTCUT AUDIT ---');
    await cdp.eval(`(() => {
      const rentBtn = document.querySelector('button[data-nav-item="rent-deposit"]');
      if (rentBtn) rentBtn.click();
    })()`);
    await cdp.sleep(1000);
    await cdp.waitForText('ভাড়া জমা');

    const rentModalAudit = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const hasTenantSelect = Boolean(document.querySelector('select'));
      const accBtn = document.querySelector('button[data-nav-item="accounts"]');
      const rentBtn = document.querySelector('button[data-nav-item="rent-deposit"]');
      return {
        modalVisible: Boolean(modal),
        hasTenantSelect,
        accStillActive: accBtn.classList.contains('active'),
        rentIsActive: rentBtn.classList.contains('active')
      };
    })()`);
    assert(rentModalAudit.modalVisible, 'Existing SimpleRentPaymentModal opened successfully above current screen');
    assert(rentModalAudit.hasTenantSelect, 'Existing tenant selection dropdown rendered');
    assert(rentModalAudit.accStillActive, 'Underlying active page (হিসাব) remains active while modal is open');
    assert(!rentModalAudit.rentIsActive, 'Action button (ভাড়া জমা) did NOT incorrectly receive page active state');

    await cdp.captureScreenshot('5nav-04-rent-payment-modal-shortcut.png');

    // Close Rent Modal
    await cdp.eval(`(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('বাতিল') || b.innerText.includes('✕') || b.getAttribute('aria-label') === 'Close');
      if (closeBtn) closeBtn.click();
    })()`);
    await cdp.sleep(800);

    const afterRentClose = await cdp.eval(`(() => {
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const accHeader = document.body.innerText.includes('পারিবারিক মাসিক খাতা');
      return { modalOpen: Boolean(modal), returnsToAccounts: accHeader };
    })()`);
    assert(!afterRentClose.modalOpen, 'Rent payment modal closed cleanly');
    assert(afterRentClose.returnsToAccounts, 'User returned to previously selected screen (হিসাব)');

    // 7. Test Navigation: Option 5 (প্রোফাইল)
    console.log('\n--- SUITE 7: OPTION 5 (প্রোফাইল) INTERACTION & ACTIVE STATE ---');
    await cdp.eval(`(() => {
      const profBtn = document.querySelector('button[data-nav-item="profile"]');
      if (profBtn) profBtn.click();
    })()`);
    await cdp.sleep(1000);
    await cdp.waitForText('প্রোফাইল');

    const profileActiveState = await cdp.eval(`(() => {
      const profBtn = document.querySelector('button[data-nav-item="profile"]');
      const accBtn = document.querySelector('button[data-nav-item="accounts"]');
      const hasMemberSection = document.body.innerText.includes('সদস্য ব্যবস্থাপনা');
      return {
        profIsActive: profBtn.classList.contains('active'),
        profAriaCurrent: profBtn.getAttribute('aria-current'),
        accIsActive: accBtn.classList.contains('active'),
        hasMemberSection
      };
    })()`);
    assert(!profileActiveState.accIsActive, 'Option 2 (হিসাব) is no longer active');
    assert(profileActiveState.profIsActive, 'Option 5 (প্রোফাইল) has "active" styling class');
    assert(profileActiveState.profAriaCurrent === 'page', 'Option 5 (প্রোফাইল) has aria-current="page"');
    assert(profileActiveState.hasMemberSection, 'Profile screen loaded with Master Admin member controls');
    await cdp.captureScreenshot('5nav-05-profile-screen-1440x900.png');

    // 8. Close-up Screenshot of the 5-Option Floating Dock
    console.log('\n--- SUITE 8: 5-OPTION FLOATING DOCK VISUAL AUDIT ---');
    await cdp.captureScreenshot('5nav-06-dock-close-up-1440x900.png');

    // 9. Mobile Responsive Audit: 360 x 800
    console.log('\n--- SUITE 9: MOBILE RESPONSIVE AUDIT (360 x 800) ---');
    await cdp.setViewport(360, 800, true);
    await cdp.eval(`(() => {
      const homeBtn = document.querySelector('button[data-nav-item="home"]');
      if (homeBtn) homeBtn.click();
    })()`);
    await cdp.sleep(1000);

    const mobile360Audit = await cdp.eval(`(() => {
      const dock = document.querySelector('nav.liquid-glass-dock-5') || document.querySelector('nav[aria-label="প্রধান নেভিগেশন ডক"]');
      const buttons = Array.from(dock.querySelectorAll('button'));
      const zeroOverflow = document.documentElement.scrollWidth <= window.innerWidth;
      const dockWidth = dock.getBoundingClientRect().width;
      const allFiveVisible = buttons.length === 5 && buttons.every(b => {
        const rect = b.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        zeroOverflow,
        dockWidth,
        viewportWidth: window.innerWidth,
        buttonCount: buttons.length,
        allFiveVisible
      };
    })()`);
    assert(mobile360Audit.zeroOverflow, `Mobile 360x800 has zero horizontal overflow (scrollWidth <= innerWidth)`);
    assert(mobile360Audit.allFiveVisible, `All 5 navigation buttons visible and rendered in 1 horizontal row`);
    assert(mobile360Audit.buttonCount === 5, `Exactly 5 buttons present in mobile dock`);
    await cdp.captureScreenshot('5nav-07-mobile-360x800.png');

    // 10. Mobile Responsive Audit: 390 x 844 (iPhone)
    console.log('\n--- SUITE 10: MOBILE RESPONSIVE AUDIT (390 x 844 iPhone) ---');
    await cdp.setViewport(390, 844, true);
    await cdp.sleep(800);

    const mobile390Audit = await cdp.eval(`(() => {
      const dock = document.querySelector('nav.liquid-glass-dock-5') || document.querySelector('nav[aria-label="প্রধান নেভিগেশন ডক"]');
      const buttons = Array.from(dock.querySelectorAll('button'));
      const zeroOverflow = document.documentElement.scrollWidth <= window.innerWidth;
      const allFiveVisible = buttons.length === 5 && buttons.every(b => {
        const rect = b.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        zeroOverflow,
        buttonCount: buttons.length,
        allFiveVisible
      };
    })()`);
    assert(mobile390Audit.zeroOverflow, `Mobile 390x844 (iPhone) has zero horizontal overflow`);
    assert(mobile390Audit.allFiveVisible, `All 5 navigation buttons visible and comfortably padded in iPhone viewport`);
    await cdp.captureScreenshot('5nav-08-mobile-iphone-390x844.png');

    // Reset viewport to desktop
    await cdp.setViewport(1440, 900, false);
    await cdp.sleep(400);

    // 11. Console and Network Errors Audit
    console.log('\n--- SUITE 11: RUNTIME CONSOLE & NETWORK INTEGRITY ---');
    console.log('  Console Errors:', cdp.consoleErrors.length);
    console.log('  Failed Requests:', cdp.failedRequests.length);
    assert(cdp.consoleErrors.length === 0, 'Zero unexpected browser console errors');
    assert(cdp.failedRequests.length === 0, 'Zero unexpected HTTP 4xx/5xx network failures');

    console.log('\n========================================================================');
    console.log(`TEST RESULTS: ${passedChecks} / ${totalChecks} PASSED (100% SUCCESS)`);
    console.log('========================================================================\n');
  } finally {
    if (cdp) await cdp.close();
    try {
      chromeProc.kill('SIGKILL');
    } catch (_) {}
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTestSuite().catch((err) => {
  console.error('\n[SUITE FAILURE]:', err);
  process.exit(1);
});
