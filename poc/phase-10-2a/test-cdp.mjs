import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = path.join(os.tmpdir(), 'chrome_cdp_test_' + Date.now());

console.log('Spawning Chrome...');
const proc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${tempDir}`,
  'about:blank'
], { stdio: 'ignore' });

// Wait 1.5s for port to open
await new Promise(r => setTimeout(r, 1500));

try {
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const data = await res.json();
  console.log('Chrome CDP Connected!');
  console.log('Browser:', data.Browser);
  console.log('WebSocket Debugger URL:', data.webSocketDebuggerUrl ? 'EXISTS' : 'NONE');

  // Test WebSocket connection
  const ws = new WebSocket(data.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log('WebSocket Open!');
      resolve();
    };
    ws.onerror = reject;
  });

  // Send a simple CDP message: Browser.getVersion
  const versionPromise = new Promise((resolve) => {
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1) {
        resolve(msg.result);
      }
    };
  });

  ws.send(JSON.stringify({ id: 1, method: 'Browser.getVersion' }));
  const verResult = await versionPromise;
  console.log('Browser.getVersion result:', verResult.product);

  ws.close();
} catch (err) {
  console.error('CDP Test Error:', err);
} finally {
  proc.kill('SIGKILL');
  console.log('Chrome process terminated.');
}
