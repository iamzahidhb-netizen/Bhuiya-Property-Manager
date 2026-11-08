/**
 * Phase 10.2A Proof-of-Concept: Service Account OAuth 2.0 Auth for Cloudflare Workers
 * 
 * Implements RFC 7523 JWT Bearer Profile using standard Web Crypto API.
 * Requires ZERO external dependencies and runs in pure Cloudflare Workers V8 environment.
 */

// Opportunistic in-memory token cache for worker isolates
let cachedAccessToken = null;
let tokenExpiresAt = 0; // Milliseconds epoch

/**
 * Converts a PEM-formatted PKCS#8 private key string to binary Uint8Array
 */
export function pemToBinary(pem) {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\r\n\s]/g, '');

  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Base64URL encode helper
 */
export function base64UrlEncode(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates an RS256-signed OAuth2 JWT Assertion for Google OAuth
 */
export async function createGoogleOAuthAssertion(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour validity

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
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
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    dataToSign
  );

  const encodedSignature = base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Retrieves a Google OAuth2 Access Token using the service account credentials
 */
export async function getFirestoreAccessToken(credentials, fetchImpl = fetch) {
  const { client_email, private_key } = credentials;

  // Opportunistic in-memory cache check (refresh 5 minutes before expiration)
  const now = Date.now();
  if (cachedAccessToken && now < (tokenExpiresAt - 300000)) {
    return { token: cachedAccessToken, cached: true };
  }

  const assertion = await createGoogleOAuthAssertion(client_email, private_key);

  const bodyParams = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: bodyParams.toString()
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth2 token request failed [HTTP ${res.status}]: ${errText}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in * 1000);

  return { token: cachedAccessToken, cached: false };
}

/**
 * Clears in-memory token cache (useful for testing or key rotation)
 */
export function clearTokenCache() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}
