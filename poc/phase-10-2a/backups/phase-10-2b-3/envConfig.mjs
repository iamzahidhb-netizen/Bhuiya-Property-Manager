/**
 * Phase 10.2B-2: Worker Environment & Secrets Configuration
 * 
 * Securely extracts and validates Cloudflare Pages environment bindings and secrets.
 * Ensures credentials never leak and missing secrets are handled cleanly.
 */

export function parseServiceAccountCredentials(env) {
  // Option 1: Full JSON string via FIREBASE_SERVICE_ACCOUNT_KEY
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    let raw = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    // Check if base64 encoded
    if (!raw.startsWith('{') && !raw.startsWith('"')) {
      try {
        raw = atob(raw);
      } catch (_) {
        // Not base64, continue to JSON parse
      }
    }

    try {
      const parsed = typeof raw === 'object' ? raw : JSON.parse(raw);
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Service account JSON must contain "client_email" and "private_key"');
      }
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        project_id: parsed.project_id || env.FIREBASE_PROJECT_ID || 'bhuiya-property-manager'
      };
    } catch (parseErr) {
      throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY secret: ${parseErr.message}`);
    }
  }

  // Option 2: Split secrets via FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      client_email: env.FIREBASE_CLIENT_EMAIL.trim(),
      private_key: env.FIREBASE_PRIVATE_KEY.trim(),
      project_id: env.FIREBASE_PROJECT_ID || 'bhuiya-property-manager'
    };
  }

  return null;
}

export function getWorkerConfig(env = {}) {
  const projectId = env.FIREBASE_PROJECT_ID || 'bhuiya-property-manager';
  
  let credentials = null;
  let credentialsError = null;
  try {
    credentials = parseServiceAccountCredentials(env);
  } catch (err) {
    credentialsError = err.message;
  }

  const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [
        'https://bhuiya-property-manager.pages.dev',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5000',
        'http://127.0.0.1:5000'
      ];

  // Financial writes safety gate:
  // Defaults to TRUE in packaging and testing phases to guarantee zero live writes.
  const disableFinancialWrites = env.DISABLE_FINANCIAL_WRITES !== 'false';

  return {
    projectId,
    credentials,
    credentialsError,
    allowedOrigins,
    disableFinancialWrites,
    executionMode: env.EXECUTION_MODE || 'packaging'
  };
}
