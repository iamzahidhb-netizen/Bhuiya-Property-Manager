/**
 * Web Crypto AES-256-GCM and HMAC-SHA256 Utilities
 * Cloudflare Worker / Browser / Node.js 18+ Native
 * 
 * Zero Node.js-only dependencies; 100% pure Web Crypto API.
 */

const subtle = (typeof crypto !== 'undefined' && crypto.subtle)
  ? crypto.subtle
  : (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle)
  ? globalThis.crypto.subtle
  : null;

/**
 * Derives a 256-bit CryptoKey for AES-GCM from a secret string.
 */
async function importAesKey(rawSecret) {
  if (!subtle) throw new Error('Web Crypto API (crypto.subtle) is not available in this environment');
  
  let keyBytes;
  if (typeof rawSecret === 'string') {
    // Check if 64-character hex string
    if (/^[0-9a-fA-F]{64}$/.test(rawSecret)) {
      const match = rawSecret.match(/.{1,2}/g) || [];
      keyBytes = new Uint8Array(match.map(byte => parseInt(byte, 16)));
    } else if (rawSecret.length === 44 && /^[A-Za-z0-9+/=]+$/.test(rawSecret)) {
      try {
        keyBytes = base64ToBuffer(rawSecret);
      } catch (_) {
        const encoder = new TextEncoder();
        keyBytes = await subtle.digest('SHA-256', encoder.encode(rawSecret));
      }
    } else {
      // Hash arbitrary string to 256 bits via SHA-256
      const encoder = new TextEncoder();
      keyBytes = await subtle.digest('SHA-256', encoder.encode(rawSecret));
    }
  } else if (rawSecret instanceof Uint8Array) {
    keyBytes = rawSecret;
  } else {
    throw new Error('Invalid encryption key format');
  }

  return await subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns an object with base64 ciphertext and base64 IV.
 */
export async function encryptAesGcm(plaintext, secretKey) {
  if (!plaintext) return null;
  const key = await importAesKey(secretKey);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
  const encodedPlaintext = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedPlaintext
  );

  const ciphertextBase64 = bufferToBase64(new Uint8Array(encryptedBuffer));
  const ivBase64 = bufferToBase64(iv);

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64
  };
}

/**
 * Decrypts AES-256-GCM ciphertext using the base64 IV and secret key.
 */
export async function decryptAesGcm(encryptedPayload, secretKey) {
  if (!encryptedPayload || !encryptedPayload.ciphertext || !encryptedPayload.iv) {
    throw new Error('Malformed encrypted payload');
  }

  const key = await importAesKey(secretKey);
  const iv = base64ToBuffer(encryptedPayload.iv);
  const ciphertext = base64ToBuffer(encryptedPayload.ciphertext);

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Signs an OAuth state payload with HMAC-SHA256 to prevent CSRF and tampering.
 */
export async function signOAuthState(data, secret) {
  if (!subtle) throw new Error('Web Crypto API is not available');
  
  const encoder = new TextEncoder();
  const keyBytes = await subtle.digest('SHA-256', encoder.encode(secret));
  const cryptoKey = await subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  const timestamp = Date.now();
  const payloadToSign = JSON.stringify({ ...data, ts: timestamp });
  const payloadBase64 = bufferToBase64(encoder.encode(payloadToSign));

  const signatureBuffer = await subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(payloadBase64)
  );

  const signatureBase64 = bufferToBase64(new Uint8Array(signatureBuffer));
  return `${payloadBase64}.${signatureBase64}`;
}

/**
 * Verifies an HMAC-SHA256 signed OAuth state.
 * Rejects expired states (default 15 minutes TTL).
 */
export async function verifyOAuthState(signedState, secret, maxAgeMs = 15 * 60 * 1000) {
  if (!signedState || typeof signedState !== 'string' || !signedState.includes('.')) {
    throw new Error('Invalid state format');
  }

  const [payloadBase64, signatureBase64] = signedState.split('.');
  const encoder = new TextEncoder();
  const keyBytes = await subtle.digest('SHA-256', encoder.encode(secret));
  const cryptoKey = await subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = base64ToBuffer(signatureBase64);
  const isValid = await subtle.verify(
    'HMAC',
    cryptoKey,
    signature,
    encoder.encode(payloadBase64)
  );

  if (!isValid) {
    throw new Error('Invalid OAuth state signature (potential CSRF attempt)');
  }

  const payloadText = new TextDecoder().decode(base64ToBuffer(payloadBase64));
  const payload = JSON.parse(payloadText);

  if (!payload.ts || Date.now() - payload.ts > maxAgeMs) {
    throw new Error('OAuth state has expired. Please try connecting again.');
  }

  return payload;
}

// Base64 Web-Safe Helpers
export function bufferToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64ToBuffer(base64) {
  let standard = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (standard.length % 4) {
    standard += '=';
  }
  const binary = atob(standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
