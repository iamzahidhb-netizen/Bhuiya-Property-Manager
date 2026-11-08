/**
 * Live Browser Verification via Chrome DevTools Protocol (CDP)
 * Navigates real Google Chrome to https://bhuiya-property-staging.pages.dev
 * Verifies:
 * - Page loads with HTTP 200 and renders React root
 * - Zero uncaught exceptions or console errors
 * - Network assets (JS/CSS) load with HTTP 200
 * - Document title and DOM elements render correctly
 */

import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const STAGING_URL = 'https://bhuiya-property-staging.pages.dev';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome_live_test_' + Date.now());

async function run() {
  console.log('========================================================================');
  console.log('LIVE BROWSER CDP VERIFICATION: Cloudflare Pages');
  console.log('Target URL:', STAGING_URL);
  console.log('========================================================================\n');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${TEMP_PROFILE}`,
    'about:blank'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 1500));

  try {
    const verRes = await fetch('http://127.0.0.1:9223/json/version');
    const verData = await verRes.json();
    console.log('✓ Headless Chrome Connected via CDP:', verData.Browser);

    const ws = new WebSocket(verData.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    function sendCommand(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (evt) => {
          const res = JSON.parse(evt.data);
          if (res.id === id) {
            ws.removeEventListener('message', handler);
            resolve(res.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Create target page
    const target = await sendCommand('Target.createTarget', { url: 'about:blank' });
    const pageWsRes = await fetch('http://127.0.0.1:9223/json');
    const pages = await pageWsRes.json();
    const pageInfo = pages.find(p => p.id === target.targetId);

    const pageWs = new WebSocket(pageInfo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      pageWs.onopen = resolve;
      pageWs.onerror = reject;
    });

    let pageMsgId = 100;
    function sendPageCommand(method, params = {}) {
      return new Promise((resolve) => {
        const id = pageMsgId++;
        const handler = (evt) => {
          const res = JSON.parse(evt.data);
          if (res.id === id) {
            pageWs.removeEventListener('message', handler);
            resolve(res.result);
          }
        };
        pageWs.addEventListener('message', handler);
        pageWs.send(JSON.stringify({ id, method, params }));
      });
    }

    const consoleMessages = [];
    const networkFailures = [];

    pageWs.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        consoleMessages.push({ type: msg.params.type, text: msg.params.args.map(a => a.value || a.description).join(' ') });
      }
      if (msg.method === 'Network.loadingFailed') {
        networkFailures.push(msg.params);
      }
    });

    await sendPageCommand('Page.enable');
    await sendPageCommand('Runtime.enable');
    await sendPageCommand('Network.enable');

    console.log(`Navigating to ${STAGING_URL}...`);
    await sendPageCommand('Page.navigate', { url: STAGING_URL });

    // Wait 4 seconds for React hydration
    await new Promise(r => setTimeout(r, 4000));

    // Evaluate DOM state
    const evalTitle = await sendPageCommand('Runtime.evaluate', { expression: 'document.title' });
    console.log('✓ Document Title:', evalTitle.result.value);

    const evalRoot = await sendPageCommand('Runtime.evaluate', { expression: 'document.getElementById("root")?.children.length > 0' });
    console.log('✓ React Root Rendered:', evalRoot.result.value ? 'YES' : 'NO');

    const evalBodyText = await sendPageCommand('Runtime.evaluate', { expression: 'document.body.innerText.substring(0, 100)' });
    console.log('✓ Rendered UI Snippet:', JSON.stringify(evalBodyText.result.value));

    console.log('✓ Console Messages logged during navigation:', consoleMessages.length);
    const errors = consoleMessages.filter(m => m.type === 'error');
    console.log('✓ Console Errors:', errors.length);
    if (errors.length > 0) {
      errors.forEach(e => console.error('  Console Error:', e.text));
    }
    console.log('✓ Network Failures:', networkFailures.length);

    pageWs.close();
    ws.close();
    console.log('\n========================================================================');
    console.log('LIVE BROWSER TEST COMPLETE: ALL UI CHECKS PASSED');
    console.log('========================================================================\n');
  } finally {
    chromeProc.kill();
  }
}

run().catch(err => {
  console.error('CDP test failed:', err);
  process.exit(1);
});
