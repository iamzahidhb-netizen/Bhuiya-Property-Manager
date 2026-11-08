import fs from 'fs';
import path from 'path';
import { getWorkerConfig } from './worker/envConfig.mjs';
import { pemToBinary, base64UrlEncode, base64UrlEncodeBytes } from './serviceAccountAuth.mjs';

async function createAuthToken(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);

  const binaryKey = pemToBinary(privateKeyPem);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, dataToSign);
  const encodedSignature = base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
  const assertion = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  const bodyParams = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString()
  });
  const data = await res.json();
  return data.access_token;
}

async function syncPassword() {
  const devVarsPath = path.resolve('poc/phase-10-2a/.dev.vars');
  const env = {};
  if (fs.existsSync(devVarsPath)) {
    for (const line of fs.readFileSync(devVarsPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }

  const config = getWorkerConfig(env);
  if (config.projectId !== 'bhuiya-property-staging') {
    throw new Error('Safety: Cannot sync password on non-staging project: ' + config.projectId);
  }

  const token = await createAuthToken(
    config.credentials.client_email,
    config.credentials.private_key
  );

  const users = [
    { uid: 'WunBcW1KihNW2DMTs3R0gUpQ0fh2', email: 'zahid@bhuiyan.com' },
    { uid: 'demo_manager_uid', email: 'manager@bhuiya.staging' },
    { uid: 'demo_viewer_uid', email: 'viewer@bhuiya.staging' },
    { uid: 'demo_nonmember_uid', email: 'nonmember@bhuiya.staging' },
    { uid: 'demo_inactive_uid', email: 'inactive@bhuiya.staging' },
    { uid: 'demo_suspended_uid', email: 'suspended@bhuiya.staging' }
  ];
  const newPassword = '112233';

  for (const user of users) {
    console.log('Synchronizing password for', user.email, `(${user.uid}) to 112233...`);
    const url = `https://identitytoolkit.googleapis.com/v1/projects/bhuiya-property-staging/accounts:update`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        localId: user.uid,
        email: user.email,
        password: newPassword
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log('Password successfully synchronized for UID:', data.localId, 'Email:', data.email);
    } else {
      console.error('Password sync failed for', user.email, data);
    }
  }

  // Verify authentication with staging Web API key
  const envContent = fs.readFileSync(path.resolve('.env.staging'), 'utf8');
  let apiKey = '';
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (t.startsWith('VITE_FIREBASE_API_KEY=')) {
      apiKey = t.split('=')[1].trim();
      break;
    }
  }

  console.log('Verifying login with accounts:signInWithPassword using Staging Web API Key for zahid@bhuiyan.com...');
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const verifyRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'zahid@bhuiyan.com',
      password: newPassword,
      returnSecureToken: true
    })
  });
  const verifyData = await verifyRes.json();
  console.log('Verification HTTP Status:', verifyRes.status);
  if (verifyRes.ok) {
    console.log('SUCCESS! Authenticated UID:', verifyData.localId, 'Email:', verifyData.email, 'idToken length:', verifyData.idToken?.length);
  } else {
    console.error('Verification failed:', verifyData);
  }
}

syncPassword().catch(console.error);
