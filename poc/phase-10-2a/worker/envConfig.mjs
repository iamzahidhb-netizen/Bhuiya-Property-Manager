
/**
 * Phase 10.2B-2: Worker Environment & Secrets Configuration
 */

export function parseServiceAccountCredentials(env) {
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    let raw = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();

    if (!raw.startsWith('{') && !raw.startsWith('"')) {
      try {
        raw = atob(raw);
      } catch (_) {}
    }

    try {
      const parsed = JSON.parse(raw);

      if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Service account credentials are incomplete');
      }

      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        project_id: parsed.project_id
      };
    } catch (err) {
      throw new Error(`Invalid service account JSON: ${err.message}`);
    }
  }

  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      client_email: env.FIREBASE_CLIENT_EMAIL.trim(),
      private_key: env.FIREBASE_PRIVATE_KEY.trim(),
      project_id: env.FIREBASE_PROJECT_ID
    };
  }

  return null;
}

const VALID_EXECUTION_MODES = ['packaging', 'test', 'staging', 'production'];

export function getWorkerConfig(env = {}) {
  const executionMode = env.EXECUTION_MODE || 'packaging';

  let credentials = null;
  let credentialsError = null;

  // 1. Explicitly validate execution mode
  if (env.EXECUTION_MODE && !VALID_EXECUTION_MODES.includes(env.EXECUTION_MODE)) {
    credentialsError = `Invalid execution mode: "${env.EXECUTION_MODE}". Allowed modes: ${VALID_EXECUTION_MODES.join(', ')}`;
  }

  // 2. Parse service account credentials (if present)
  try {
    credentials = parseServiceAccountCredentials(env);
  } catch (err) {
    credentialsError = err.message;
  }

  // 3. Resolve Project ID without silent fallback to production
  let projectId = env.FIREBASE_PROJECT_ID ? env.FIREBASE_PROJECT_ID.trim() : null;

  if (!projectId) {
    if (executionMode === 'packaging') {
      projectId = 'packaging-mode';
    } else if (executionMode === 'test') {
      projectId = 'test-project';
    } else if (executionMode === 'staging') {
      credentialsError = credentialsError || 'Missing required FIREBASE_PROJECT_ID for staging mode (expected "bhuiya-property-staging")';
    } else if (executionMode === 'production') {
      credentialsError = credentialsError || 'Missing required FIREBASE_PROJECT_ID for production execution mode';
    }
  }

  // 4. Validate staging configuration strictly
  if (executionMode === 'staging' && !credentialsError) {
    if (projectId !== 'bhuiya-property-staging') {
      credentialsError = `Invalid Staging Project ID: "${projectId}". Staging execution mode strictly requires "bhuiya-property-staging"`;
    } else if (!credentials) {
      credentialsError = 'Staging credentials are missing. Staging mode requires valid service account credentials';
    } else if (credentials.project_id && credentials.project_id !== projectId) {
      credentialsError = `Service account project mismatch: credentials target "${credentials.project_id}", expected "${projectId}"`;
    }
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

  return {
    projectId,
    credentials,
    credentialsError,
    allowedOrigins,
    disableFinancialWrites: env.DISABLE_FINANCIAL_WRITES !== 'false',
    executionMode,
    apiKey: env.FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || null
  };
}
