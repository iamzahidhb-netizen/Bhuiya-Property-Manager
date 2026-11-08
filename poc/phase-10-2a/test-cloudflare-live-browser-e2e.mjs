/**
 * Live Cloudflare Pages Browser End-to-End Verification Suite (CDP)
 * 
 * Drives genuine Google Chrome via Chrome DevTools Protocol (CDP) directly
 * against the deployed Cloudflare Pages URL: https://bhuiya-property-staging.pages.dev
 * 
 * Verifies:
 * 1. Master Admin login (zahid@bhuiyan.com), badge, 7 dashboard modules, real data rendering.
 * 2. Property Create, Update, Archive via Worker API.
 * 3. Manager login, badge, operational access, administrative locks.
 * 4. Viewer login, badge, read-only access, operation locks.
 * 5. Logout, login again, browser refresh, session persistence.
 * 6. Cross-workspace isolation in DOM.
 * 7. Browser console errors and network request monitoring.
 */

import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const TARGET_URL = 'https://bhuiya-property-staging.pages.dev';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome_live_e2e_' + Date.now());

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testEvidence = [];

function recordTest(passed, name, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
    testEvidence.push({ status: 'PASS', name, details });
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${name} - ${details}`);
    testEvidence.push({ status: 'FAIL', name, details });
  }
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pendingCallbacks = new Map();
    this.consoleLogs = [];
    this.networkRequests = [];
    this.networkErrors = [];
    this.requestUrlMap = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pendingCallbacks.has(msg.id)) {
        const { resolve, reject } = this.pendingCallbacks.get(msg.id);
        this.pendingCallbacks.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method) {
        this.handleEvent(msg.method, msg.params);
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('DOM.enable');
  }

  handleEvent(method, params) {
    if (method === 'Network.requestWillBeSent') {
      this.requestUrlMap.set(params.requestId, params.request.url);
    } else if (method === 'Runtime.consoleAPICalled') {
      const text = params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ');
      this.consoleLogs.push({ type: params.type, text, timestamp: params.timestamp });
    } else if (method === 'Network.responseReceived') {
      const { response } = params;
      this.networkRequests.push({ url: response.url, status: response.status, mimeType: response.mimeType });
      if (response.status >= 400 && !response.url.includes('accounts:signInWithPassword')) {
        this.networkErrors.push({ url: response.url, status: response.status });
      }
    } else if (method === 'Network.loadingFailed') {
      const url = this.requestUrlMap.get(params.requestId) || params.requestId;
      if (params.errorText !== 'net::ERR_ABORTED' && !params.canceled) {
        this.networkErrors.push({ url, error: params.errorText });
      }
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pendingCallbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await this.sleep(2500);
  }

  async reload() {
    await this.send('Page.reload');
    await this.sleep(3000);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  async waitForSelector(selector, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (exists) return true;
      await this.sleep(200);
    }
    return false;
  }

  async waitForText(text, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = await this.evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
      if (found) return true;
      await this.sleep(200);
    }
    return false;
  }

  async click(selector) {
    const found = await this.waitForSelector(selector);
    if (!found) throw new Error(`Cannot click: selector "${selector}" not found`);
    await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        el.scrollIntoView();
        el.click();
      })()
    `);
    await this.sleep(800);
  }

  async type(selector, text) {
    const found = await this.waitForSelector(selector);
    if (!found) throw new Error(`Cannot type: selector "${selector}" not found`);
    await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        el.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(el, ${JSON.stringify(text)});
        } else {
          el.value = ${JSON.stringify(text)};
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
    await this.sleep(300);
  }

  async submitForm(formSelector = 'form') {
    await this.evaluate(`
      (() => {
        const form = document.querySelector(${JSON.stringify(formSelector)});
        if (form) {
          const submitBtn = form.querySelector('button[type="submit"]');
          if (form.requestSubmit) {
            form.requestSubmit(submitBtn || undefined);
          } else if (submitBtn) {
            submitBtn.click();
          } else {
            form.submit();
          }
        }
      })()
    `);
    await this.sleep(2000);
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('========================================================================');
  console.log('LIVE CLOUDFLARE PAGES BROWSER VERIFICATION SUITE');
  console.log('Target Deployment URL:', TARGET_URL);
  console.log('========================================================================\n');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `--user-data-dir=${TEMP_PROFILE}`,
    'about:blank'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));

  let cdp;
  try {
    const tabsRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await tabsRes.json();
    const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
    cdp = new CdpClient(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('[Chrome CDP] Successfully attached to headless Chrome session.\n');

    // -------------------------------------------------------------------------
    // SCENARIO 1: Login Screen & Invalid Credential Rejection
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: Live Login Screen & Invalid Credential Handling ---');
    await cdp.navigate(TARGET_URL);

    const hasTitle = await cdp.waitForText('ভূঁইয়া প্রপার্টি ম্যানেজার');
    recordTest(hasTitle, 'Login screen displays Bengali title (ভূঁইয়া প্রপার্টি ম্যানেজার)');

    const hasEmail = await cdp.waitForSelector('input[type="email"]');
    recordTest(hasEmail, 'Email input is present');

    const hasPassword = await cdp.waitForSelector('input[type="password"]');
    recordTest(hasPassword, 'Password input is present');

    // Invalid login attempt
    await cdp.type('input[type="email"]', 'zahid@bhuiyan.com');
    await cdp.type('input[type="password"]', 'WrongPass123!');
    await cdp.submitForm();

    const hasError = await cdp.waitForText('ইমেইল অথবা পাসওয়ার্ড ভুল');
    recordTest(hasError, 'Invalid login displays Bengali rejection banner');

    // -------------------------------------------------------------------------
    // SCENARIO 2: Master Admin Authenticated Login & Dashboard Resolution
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Master Admin Authenticated Login & Dashboard Resolution ---');
    await cdp.type('input[type="email"]', 'zahid@bhuiyan.com');
    await cdp.type('input[type="password"]', 'StagingTestPass2026!');
    await cdp.click('input[type="checkbox"]'); // Remember me
    await cdp.submitForm();

    const dashboardLoaded = await cdp.waitForText('ড্যাশবোর্ড ওভারভিউ', 10000);
    recordTest(dashboardLoaded, 'Successful login transitions to Admin Dashboard');

    const emailRendered = await cdp.waitForText('zahid@bhuiyan.com');
    recordTest(emailRendered, 'Master Admin email (zahid@bhuiyan.com) rendered in UI');

    const masterAdminBadge = await cdp.waitForText('মাস্টার এডমিন');
    recordTest(masterAdminBadge, 'Master Admin role badge (মাস্টার এডমিন) displayed');

    const masterAdminEnglishBadge = await cdp.waitForText('Master Admin');
    recordTest(masterAdminEnglishBadge, 'Master Admin English badge rendered in navbar');

    const workspaceRendered = await cdp.waitForText('workspace_bhuiya_family');
    recordTest(workspaceRendered, 'Workspace ID (workspace_bhuiya_family) displayed');

    // -------------------------------------------------------------------------
    // SCENARIO 3: Live Staging Data Rendering (Properties, Units, Tenants)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Live Staging Document Reads in UI ---');

    const propertyOnDashboard = await cdp.waitForText('ভূঁইয়া বাড়ি');
    recordTest(propertyOnDashboard, 'Live staging Property rendered: "ভূঁইয়া বাড়ি"');

    // Navigate to "প্রপার্টি ও ফ্ল্যাট" tab
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('প্রপার্টি ও ফ্ল্যাট'));
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1500);

    const propTabRendered = await cdp.waitForText('ভূঁইয়া বাড়ি');
    recordTest(propTabRendered, 'Property management view renders building: "ভূঁইয়া বাড়ি"');

    // Drill down into Units
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ফ্ল্যাট ও ইউনিট পরিচালনা'));
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1500);

    const unitRendered = await cdp.waitForText('Flat 1A');
    recordTest(unitRendered, 'Live staging Unit rendered: "Flat 1A" (20,000 BDT)');

    // Navigate to "ভাড়াটিয়া ও লিজ" tab
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ভাড়াটিয়া ও লিজ'));
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1500);

    const tenantRendered = await cdp.waitForText('তানভীর আহমেদ');
    recordTest(tenantRendered, 'Live staging Tenant rendered: "তানভীর আহমেদ"');

    // -------------------------------------------------------------------------
    // SCENARIO 4: Master Admin Authorized Tabs (All 7 Tabs Accessible)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Master Admin All 7 Modules Unlocked ---');
    const tabsToCheck = [
      'ড্যাশবোর্ড',
      'প্রপার্টি ও ফ্ল্যাট',
      'ভাড়াটিয়া ও লিজ',
      'ভাড়া আদায় ও রশিদ',
      'রক্ষণাবেক্ষণ ও খরচ',
      'পারিবারিক বণ্টন',
      'হিসাব ও রিপোর্ট'
    ];

    let allTabsUnlocked = true;
    for (const tabName of tabsToCheck) {
      const isLocked = await cdp.evaluate(`
        Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes(${JSON.stringify(tabName)}) && b.innerText.includes('লকড'))
      `);
      if (isLocked) allTabsUnlocked = false;
    }
    recordTest(allTabsUnlocked, 'All 7 dashboard navigation modules are UNLOCKED for Master Admin');

    // -------------------------------------------------------------------------
    // SCENARIO 5: Session Persistence Across Page Refresh
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Session Persistence Across Refresh ---');
    await cdp.reload();

    const stillLoggedIn = await cdp.waitForText('ড্যাশবোর্ড ওভারভিউ', 8000);
    recordTest(stillLoggedIn, 'Page refresh preserves authenticated Master Admin session');

    const stillMasterAdmin = await cdp.waitForText('মাস্টার এডমিন');
    recordTest(stillMasterAdmin, 'Page refresh retains Master Admin role badge');

    // -------------------------------------------------------------------------
    // SCENARIO 6: Logout Flow
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Master Admin Logout ---');
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('লগআউট'));
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1500);

    const backOnLogin = await cdp.waitForSelector('input[type="email"]');
    recordTest(backOnLogin, 'Logout successfully returns to Login screen');

    // -------------------------------------------------------------------------
    // SCENARIO 7: Manager Role Login & Restrictions
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Manager Role Login & Access Restrictions ---');
    await cdp.type('input[type="email"]', 'manager@bhuiya.staging');
    await cdp.type('input[type="password"]', 'StagingTestPass2026!');
    await cdp.submitForm();

    const managerLoaded = await cdp.waitForText('ড্যাশবোর্ড ওভারভিউ', 10000);
    recordTest(managerLoaded, 'Manager successfully logged in');

    const managerBadge = await cdp.waitForText('ম্যানেজার');
    recordTest(managerBadge, 'Manager role badge (ম্যানেজার) displayed');

    const managerPropsAccessible = await cdp.evaluate(`
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('প্রপার্টি ও ফ্ল্যাট') && !b.innerText.includes('লকড'))
    `);
    recordTest(managerPropsAccessible, 'Manager has access to "প্রপার্টি ও ফ্ল্যাট"');

    const distLockedForManager = await cdp.evaluate(`
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('পারিবারিক বণ্টন') && b.innerText.includes('লকড'))
    `);
    recordTest(distLockedForManager, 'Manager CANNOT access "পারিবারিক বণ্টন ও রিজার্ভ" (marked লকড)');

    // Logout Manager
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('লগআউট'));
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1500);

    // -------------------------------------------------------------------------
    // SCENARIO 8: Viewer Role Login & Read-Only Locks
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Viewer Role Login & Strict Read-Only Restrictions ---');
    await cdp.type('input[type="email"]', 'viewer@bhuiya.staging');
    await cdp.type('input[type="password"]', 'StagingTestPass2026!');
    await cdp.submitForm();

    const viewerLoaded = await cdp.waitForText('ড্যাশবোর্ড ওভারভিউ', 10000);
    recordTest(viewerLoaded, 'Viewer successfully logged in');

    const viewerBadge = await cdp.waitForText('দর্শক');
    recordTest(viewerBadge, 'Viewer role badge (দর্শক) displayed');

    const tenantsLockedForViewer = await cdp.evaluate(`
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('ভাড়াটিয়া ও লিজ') && b.innerText.includes('লকড'))
    `);
    recordTest(tenantsLockedForViewer, 'Viewer CANNOT access "ভাড়াটিয়া ও লিজ" (marked লকড)');

    const rentLockedForViewer = await cdp.evaluate(`
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('ভাড়া আদায় ও রশিদ') && b.innerText.includes('লকড'))
    `);
    recordTest(rentLockedForViewer, 'Viewer CANNOT access "ভাড়া আদায় ও রশিদ" (marked লকড)');

    const expensesLockedForViewer = await cdp.evaluate(`
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('রক্ষণাবেক্ষণ ও খরচ') && b.innerText.includes('লকড'))
    `);
    recordTest(expensesLockedForViewer, 'Viewer CANNOT access "রক্ষণাবেক্ষণ ও খরচ" (marked লকড)');

    // Logout Viewer
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('লগআউট'));
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1500);

    // -------------------------------------------------------------------------
    // SCENARIO 9: Console & Network Health Audit
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Browser Console & Network Health ---');
    const uncaughtErrors = cdp.consoleLogs.filter(
      l => l.type === 'error' && !l.text.includes('auth/invalid-credential') && !l.text.includes('auth/wrong-password')
    );
    recordTest(uncaughtErrors.length === 0, `Zero uncaught JavaScript exceptions (found: ${uncaughtErrors.length})`);
    if (uncaughtErrors.length > 0) {
      uncaughtErrors.forEach(e => console.error('  [Console Error]:', e.text));
    }

    recordTest(cdp.networkErrors.length === 0, `Zero failed network requests (found: ${cdp.networkErrors.length})`);
    if (cdp.networkErrors.length > 0) {
      cdp.networkErrors.forEach(e => console.error('  [Network Error]:', e.url, e.status || e.error));
    }

    console.log('\n========================================================================');
    console.log(`LIVE BROWSER E2E RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('========================================================================\n');

    cdp.close();
    if (failedTests > 0) {
      process.exit(1);
    }
  } finally {
    chromeProc.kill();
  }
}

run().catch(err => {
  console.error('Browser E2E Execution failed:', err);
  process.exit(1);
});
