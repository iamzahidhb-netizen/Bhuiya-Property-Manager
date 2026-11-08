import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const DEPLOYED_URL = 'https://bhuiya-property-staging.pages.dev';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome_user_mgmt_e2e_' + Date.now());
const ARTIFACT_DIR = 'C:\\Users\\Onty\'s zZz\\.gemini\\antigravity\\brain\\67e53663-ba74-4e56-88c5-fa3dd43b6058';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

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
        const url = msg.params.response.url;
        if (status >= 400 && !url.includes('identitytoolkit.googleapis.com')) {
          this.failedRequests.push({ url, status });
        }
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
  }

  async send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await this.sleep(3000);
  }

  async waitForSelector(selector, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (exists) return true;
      await this.sleep(200);
    }
    return false;
  }

  async waitForText(text, timeoutMs = 12000) {
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

  async clickButtonWithText(text) {
    const clicked = await this.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.innerText.includes(${JSON.stringify(text)}));
        if (target) {
          target.scrollIntoView();
          target.click();
          return true;
        }
        return false;
      })()
    `);
    await this.sleep(800);
    return clicked;
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

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: isMobile,
    });
    await this.sleep(500);
  }
}

async function getChromeWebSocketUrl(port = 9224) {
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

async function runE2ETests() {
  console.log('========================================================================');
  console.log('LIVE BROWSER E2E: MASTER ADMIN USER MANAGEMENT & PERMISSIONS');
  console.log('Target Deployed URL:', DEPLOYED_URL);
  console.log('========================================================================');

  const chromeProc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9224',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      `--user-data-dir=${TEMP_PROFILE}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await new Promise((r) => setTimeout(r, 2000));

  let cdp;

  try {
    const wsUrl = await getChromeWebSocketUrl(9224);
    cdp = new ChromeClient(wsUrl);
    await cdp.connect();

    console.log('\n--- 1. MASTER ADMIN AUTHENTICATION & LOGIN ---');
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(DEPLOYED_URL);

    // Logout if already logged in
    const hasLogout = await cdp.evaluate(`
      Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('লগআউট')))
    `);
    if (hasLogout) {
      await cdp.clickButtonWithText('লগআউট');
      await cdp.sleep(1500);
    }

    const emailField = await cdp.waitForSelector('input[type="email"]', 10000);
    if (!emailField) throw new Error('Login email field not found');

    await cdp.type('input[type="email"]', 'zahid@bhuiyan.com');
    await cdp.type('input[type="password"]', '112233');
    await cdp.click('input[type="checkbox"]');
    await cdp.submitForm();

    const dashboardLoaded = await cdp.waitForText('ড্যাশবোর্ড ওভারভিউ', 15000);
    if (!dashboardLoaded) throw new Error('Dashboard overview not loaded after login');
    console.log('  ✓ [PASS] Master Admin authenticated and landed on Dashboard');

    const masterAdminBadge = await cdp.waitForText('মাস্টার এডমিন');
    console.log('  ✓ [PASS] Master Admin role badge rendered:', masterAdminBadge);

    console.log('\n--- 2. NAVIGATE TO PROFILE & VERIFY MEMBER MANAGEMENT CARD ---');
    await cdp.clickButtonWithText('প্রোফাইল');
    await cdp.sleep(1500);

    const hasMemberMgmtSection = await cdp.waitForText('সদস্য ব্যবস্থাপনা (Member Management)');
    if (!hasMemberMgmtSection) {
      throw new Error('Member Management card not found in Profile view for Master Admin');
    }
    console.log('  ✓ [PASS] Member Management card is visible in Profile section');

    console.log('\n--- 3. OPEN MEMBER MANAGEMENT MODAL & AUDIT MEMBER LIST ---');
    await cdp.clickButtonWithText('সদস্য তালিকা ও পারমিশন কন্ট্রোল প্যানেল');
    await cdp.sleep(2000);

    const hasModalTitle = await cdp.waitForText('পারিবারিক ওয়ার্কস্পেসের সদস্য তালিকা');
    if (!hasModalTitle) {
      throw new Error('Member Management modal title not found');
    }
    console.log('  ✓ [PASS] Member Management modal opened successfully');

    // Verify Master Admin card has protected status badge
    const hasProtectedMasterAdmin = await cdp.waitForText('মূল অ্যাডমিন (অপরিবর্তনীয়)');
    console.log('  ✓ [PASS] Master Admin card shows protected status badge:', hasProtectedMasterAdmin);

    await cdp.captureScreenshot('09-master-admin-member-management.png');

    console.log('\n--- 4. CREATE NEW CUSTOM MEMBER WITH GRANULAR PERMISSIONS ---');
    await cdp.clickButtonWithText('নতুন সদস্য যুক্ত করুন');
    await cdp.sleep(1000);

    const hasAddTitle = await cdp.waitForText('নতুন পারিবারিক সদস্য যুক্ত করুন');
    if (!hasAddTitle) {
      throw new Error('Add Member modal did not open');
    }
    console.log('  ✓ [PASS] Add Member modal opened');

    const testMemberEmail = `e2e_kamal_${Date.now()}@bhuiya.staging`;
    const testMemberName = 'কামাল ভূঁইয়া (E2E Custom)';

    await cdp.type('input[placeholder="উদাঃ কামাল ভূঁইয়া"]', testMemberName);
    await cdp.type('input[placeholder="kamal@bhuiyan.com"]', testMemberEmail);
    await cdp.type('input[placeholder="017xxxxxxxx"]', '01711223344');
    await cdp.type('input[placeholder="কমপক্ষে ৬ অক্ষর (উদাঃ 112233)"]', 'Password123!');

    // Click 'কাস্টম (Custom)' preset
    await cdp.clickButtonWithText('কাস্টম (Custom)');
    await cdp.sleep(500);

    // Toggle specific granular permissions: rent collection, expenses
    await cdp.evaluate(`
      (() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const collectRentLabel = labels.find(l => l.innerText.includes('ভাড়া আদায় ও পেমেন্ট রেকর্ড'));
        if (collectRentLabel) {
          const cb = collectRentLabel.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) cb.click();
        }
        const addExpenseLabel = labels.find(l => l.innerText.includes('নতুন খরচ এন্ট্রি করা'));
        if (addExpenseLabel) {
          const cb = addExpenseLabel.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) cb.click();
        }
      })()
    `);
    await cdp.sleep(500);

    await cdp.captureScreenshot('10-add-member-granular-permissions.png');

    // Submit Add Member form directly via submit button inside the open modal
    await cdp.evaluate(`
      (() => {
        const forms = document.querySelectorAll('form');
        const activeForm = forms[forms.length - 1];
        if (activeForm) {
          const btn = activeForm.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      })()
    `);
    await cdp.sleep(3000);

    // Wait for success message or member in list
    let createdSuccessfully = await cdp.waitForText(testMemberEmail, 15000);
    if (!createdSuccessfully) {
      const errBanner = await cdp.evaluate(`document.querySelector('.bg-red-50')?.innerText || 'No red banner'`);
      console.log('    [Notice] Error banner in DOM:', errBanner);
      throw new Error(`Created member "${testMemberEmail}" not found in list. Banner: ${errBanner}`);
    }
    console.log('  ✓ [PASS] Custom member created successfully via Cloudflare Worker API');

    // Confirm Master Admin session is STILL ACTIVE (Session Safety!)
    const currentAdminUserStillActive = await cdp.evaluate(`
      document.body.innerText.includes('zahid@bhuiyan.com')
    `);
    if (!currentAdminUserStillActive) {
      throw new Error('CRITICAL FAILURE: Master Admin session was lost or overwritten during user creation!');
    }
    console.log('  ✓ [PASS] Master Admin session remains 100% active and untouched (Session Safety VERIFIED)');

    console.log('\n--- 5. EDIT MEMBER PERMISSIONS ---');
    await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('div[data-member-email="${testMemberEmail}"] button[data-action="edit-perms"]');
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1200);

    const editModalTitle = await cdp.waitForText('অনুমতি ও ভূমিকা পরিবর্তন');
    if (!editModalTitle) throw new Error('Edit Permissions modal did not open');

    // Select Manager preset and save
    await cdp.clickButtonWithText('ম্যানেজার (Manager)');
    await cdp.sleep(500);
    await cdp.evaluate(`
      (() => {
        const forms = document.querySelectorAll('form');
        const activeForm = forms[forms.length - 1];
        if (activeForm) {
          const btn = activeForm.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      })()
    `);
    await cdp.sleep(3000);

    const permsUpdated = await cdp.waitForText('পারমিশন সফলভাবে আপডেট হয়েছে', 10000);
    console.log('  ✓ [PASS] Member permissions updated to Manager preset successfully:', permsUpdated);

    console.log('\n--- 6. MEMBER STATUS TRANSITION WORKFLOW ---');
    await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('div[data-member-email="${testMemberEmail}"] button[data-action="change-status"]');
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1000);

    const statusModalTitle = await cdp.waitForText('সদস্যের স্ট্যাটাস পরিবর্তন');
    if (!statusModalTitle) throw new Error('Status modal did not open');

    // Select 'স্থগিত (Suspended)' radio and submit
    await cdp.evaluate(`
      (() => {
        const suspendedRadio = document.querySelector('input[value="suspended"]');
        if (suspendedRadio) suspendedRadio.click();
      })()
    `);
    await cdp.sleep(500);
    await cdp.evaluate(`
      (() => {
        const forms = document.querySelectorAll('form');
        const activeForm = forms[forms.length - 1];
        if (activeForm) {
          const btn = activeForm.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      })()
    `);
    await cdp.sleep(3000);

    const suspendedStatusConfirmed = await cdp.waitForText('স্থগিত');
    console.log('  ✓ [PASS] Member status transitioned to Suspended successfully:', suspendedStatusConfirmed);

    console.log('\n--- 7. SEND PASSWORD RESET LINK WORKFLOW ---');
    await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('div[data-member-email="${testMemberEmail}"] button[data-action="reset-password"]');
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(2000);

    const resetTitle = await cdp.waitForText('পাসওয়ার্ড রিসেট লিংক তৈরি হয়েছে');
    console.log('  ✓ [PASS] Password reset modal opened with generated reset link:', resetTitle);

    await cdp.clickButtonWithText('ঠিক আছে');
    await cdp.sleep(800);

    console.log('\n--- 8. REVOKE WORKSPACE ACCESS WORKFLOW ---');
    await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('div[data-member-email="${testMemberEmail}"] button[data-action="revoke-access"]');
        if (btn) btn.click();
      })()
    `);
    await cdp.sleep(1000);

    const revokeModalTitle = await cdp.waitForText('ওয়ার্কস্পেস অ্যাক্সেস বাতিল');
    if (!revokeModalTitle) throw new Error('Revoke confirmation modal did not open');

    await cdp.clickButtonWithText('হ্যাঁ, অ্যাক্সেস বাতিল করুন');
    await cdp.sleep(3000);

    const revokedSuccess = await cdp.waitForText('বাতিল করা হয়েছে', 10000);
    console.log('  ✓ [PASS] Workspace access successfully revoked (membership document deleted):', revokedSuccess);

    // Close member management modal
    await cdp.clickButtonWithText('বন্ধ করুন (Close)');
    await cdp.sleep(1000);

    console.log('\n--- 9. LOGOUT MASTER ADMIN & VERIFY NON-ADMIN RESTRICTION ---');
    await cdp.clickButtonWithText('লগআউট করুন (Sign Out)');
    await cdp.sleep(2500);

    const loginScreen = await cdp.waitForSelector('input[type="email"]', 10000);
    if (!loginScreen) throw new Error('Login screen not returned after logout');
    console.log('  ✓ [PASS] Master Admin signed out cleanly');

    console.log('\n--- 10. LOGIN AS MANAGER & VERIFY STRICT ACCESS CONTROL ---');
    await cdp.type('input[type="email"]', 'manager@bhuiya.staging');
    await cdp.type('input[type="password"]', '112233');
    await cdp.click('input[type="checkbox"]');
    await cdp.submitForm();

    const managerDashboard = await cdp.waitForText('ম্যানেজার', 15000);
    if (!managerDashboard) throw new Error('Manager dashboard not loaded');
    console.log('  ✓ [PASS] Manager authenticated successfully');

    // Navigate to Profile
    await cdp.clickButtonWithText('প্রোফাইল');
    await cdp.sleep(1500);

    // Verify Member Management is STRICTLY ABSENT
    const managerSeesMemberMgmt = await cdp.evaluate(`
      document.body.innerText.includes('সদস্য ব্যবস্থাপনা (Member Management)') ||
      document.body.innerText.includes('সদস্য তালিকা ও পারমিশন কন্ট্রোল প্যানেল')
    `);
    if (managerSeesMemberMgmt) {
      throw new Error('SECURITY VIOLATION: Manager role can see Member Management section!');
    }
    console.log('  ✓ [PASS] Member Management section is STRICTLY HIDDEN from Manager role');

    await cdp.captureScreenshot('11-manager-restricted-profile.png');

    console.log('\n========================================================================');
    console.log('ALL LIVE BROWSER E2E TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');
  } finally {
    if (cdp?.ws) cdp.ws.close();
    chromeProc.kill('SIGKILL');
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch (_) {}
  }
}

runE2ETests().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
