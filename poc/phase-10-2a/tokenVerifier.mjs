/**
 * Phase 10.2B-1: Edge-Native Firebase ID Token Verifier with Revocation Strategy
 * 
 * Uses standard Web Crypto API (crypto.subtle) without Node.js dependencies.
 * Fully compatible with Cloudflare Workers / Pages Functions and Node 18+.
 * 
 * REVOCATION STRATEGY:
 * 1. Default (Fast Path, ~0.24ms): Offline RS256 signature and claims verification.
 *    Tokens are validated against Google's public JWKS. Fast and zero-network overhead.
 * 2. Instant Workspace Deactivation: The server checks workspace_members status ('active')
 *    on every mutation, providing immediate sub-second access revocation.
 * 3. On-Demand Account Revocation (Optional Deep Check): Calls Firebase Identity Toolkit
 *    REST API (accounts:lookup) for sensitive transactions to verify account status.
 */

// In-memory public key cache across Worker invocations
let cachedJwks = null;
let jwksExpiresAt = 0;

/**
 * Base64URL decode helper for Web Standards runtimes
 */
export function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64UrlDecodeToString(str) {
  const bytes = base64UrlDecode(str);
  return new TextDecoder().decode(bytes);
}

/**
 * Fetches Google Public JWKs for Firebase Auth and respects Cache-Control headers
 */
export async function getGoogleJwks(customJwksProvider = null) {
  if (customJwksProvider) {
    return await customJwksProvider();
  }

  const now = Date.now();
  if (cachedJwks && now < jwksExpiresAt) {
    return cachedJwks;
  }

  const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!res.ok) {
    throw new Error(`Failed to fetch Google JWKS: HTTP ${res.status}`);
  }

  // Parse max-age from Cache-Control
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  cachedJwks = await res.json();
  jwksExpiresAt = now + (maxAgeSeconds * 1000);
  return cachedJwks;
}

/**
 * Verifies a Firebase ID Token using Web Crypto RS256
 */
export async function verifyFirebaseIdToken(token, expectedProjectId, options = {}) {
  const { jwksProvider = null, clockSkewSec = 60, mockJwks = null } = options;

  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token: Expected 3 JWT segments');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecodeToString(headerB64));
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch (err) {
    throw new Error(`Failed to parse token JSON segments: ${err.message}`);
  }

  // 1. Header validation
  if (header.alg !== 'RS256') {
    throw new Error(`Invalid algorithm: Expected RS256 but got ${header.alg}`);
  }
  if (!header.kid) {
    throw new Error('Token header missing "kid" (key ID)');
  }

  // 2. Retrieve Public Keys
  const jwks = mockJwks || await getGoogleJwks(jwksProvider);
  const matchingKey = jwks.keys ? jwks.keys.find(k => k.kid === header.kid) : null;
  if (!matchingKey) {
    throw new Error(`No matching public key found for kid "${header.kid}"`);
  }

  // 3. Import public key via Web Crypto
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    matchingKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['verify']
  );

  // 4. Verify Cryptographic Signature
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlDecode(signatureB64);

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signatureBytes,
    signedData
  );

  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  // 5. Payload Claims Validation
  const nowSec = Math.floor(Date.now() / 1000);

  // Expiration
  if (typeof payload.exp !== 'number' || payload.exp < (nowSec - clockSkewSec)) {
    throw new Error(`Token is expired (exp: ${payload.exp}, now: ${nowSec})`);
  }

  // Issued At
  if (typeof payload.iat !== 'number' || payload.iat > (nowSec + clockSkewSec)) {
    throw new Error(`Token iat is in the future (iat: ${payload.iat}, now: ${nowSec})`);
  }

  // Audience
  if (payload.aud !== expectedProjectId) {
    throw new Error(`Audience mismatch: Expected "${expectedProjectId}" but got "${payload.aud}"`);
  }

  // Issuer
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(`Issuer mismatch: Expected "${expectedIssuer}" but got "${payload.iss}"`);
  }

  // Subject (User UID): must be non-empty string <= 128 chars
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Token subject (sub) must be a non-empty string of at most 128 characters');
  }

  // Auth Time
  if (typeof payload.auth_time === 'number' && payload.auth_time > (nowSec + clockSkewSec)) {
    throw new Error(`Token auth_time is in the future (auth_time: ${payload.auth_time}, now: ${nowSec})`);
  }

  return {
    uid: payload.sub,
    email: payload.email || null,
    claims: payload
  };
}

/**
 * Optional Deep Revocation Check via Firebase Identity Toolkit REST API
 * Call this selectively for high-value actions (e.g. reserve withdrawals > ৳50,000)
 */
export async function checkFirebaseAccountRevocation(idToken, apiKey, fetchImpl = fetch) {
  if (!apiKey) {
    throw new Error('Firebase API Key is required for online account revocation check');
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firebase account lookup failed [HTTP ${res.status}]: ${errText}`);
  }

  const data = await res.json();
  const user = data.users && data.users[0];
  if (!user) {
    throw new Error('User account not found or disabled in Firebase Authentication');
  }

  if (user.disabled) {
    throw new Error('User account is currently disabled in Firebase Authentication');
  }

  return {
    uid: user.localId,
    email: user.email,
    disabled: false,
    validSince: user.validSince
  };
}
