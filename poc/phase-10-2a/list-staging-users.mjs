import fs from 'fs';
import path from 'path';
import { getWorkerConfig } from './worker/envConfig.mjs';
import { pemToBinary, base64UrlEncode, base64UrlEncodeBytes } from './serviceAccountAuth.mjs';

async function createAuthToken(clientEmail, privateKeyPem, scope) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope,
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

async function listUsers() {
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
    config.credentials.private_key,
    'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform'
  );

  const url = `https://identitytoolkit.googleapis.com/v1/projects/bhuiya-property-staging/accounts:batchGet?maxResults=50`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await res.json();
  console.log('HTTP Status:', res.status);
  if (!res.ok) {
    console.error('API Error:', data);
    return;
  }
  console.log('Users count:', data.users ? data.users.length : 0);
  if (data.users) {
    for (const u of data.users) {
      console.log('User found:', {
        localId: u.localId,
        email: u.email,
        emailVerified: u.emailVerified,
        disabled: u.disabled,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt
      });
    }
  }
}

listUsers().catch(console.error);
