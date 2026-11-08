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

async function checkConfig() {
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
  const token = await createAuthToken(
    config.credentials.client_email,
    config.credentials.private_key
  );

  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/bhuiya-property-staging/config`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Authorized Domains:', data.authorizedDomains);
}

checkConfig().catch(console.error);
