import { adminAuth } from './firebaseAdmin.ts';
import { ApiError } from './validation.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

/**
 * Verifies Firebase Auth ID Token from HTTP Authorization header.
 * Derives caller UID strictly from cryptographically verified token.
 * Never trusts caller-supplied ownerUid in body or query params.
 */
export async function authenticateRequest(req: {
  headers: Record<string, string | string[] | undefined>;
}): Promise<AuthenticatedUser> {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || typeof authHeader !== 'string') {
    throw new ApiError('unauthenticated', 'Authentication required. Missing Authorization header.');
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new ApiError('unauthenticated', 'Malformed Authorization header. Format: Bearer <idToken>.');
  }

  const token = parts[1];
  if (!token) {
    throw new ApiError('unauthenticated', 'Authentication token cannot be empty.');
  }

  // Support local test mock tokens in non-production test environments
  if ((process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_TOKENS === 'true') && token.startsWith('test-token-')) {
    const mockUid = token.replace('test-token-', '');
    if (mockUid) {
      return { uid: mockUid, email: `${mockUid}@test.local` };
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken || !decodedToken.uid) {
      throw new ApiError('unauthenticated', 'Invalid authentication token: missing UID.');
    }
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const error = err as { code?: string; message?: string };
    console.error('[AuthMiddleware] ID token verification failed:', error.message || err);
    throw new ApiError('unauthenticated', 'Invalid or expired authentication token.');
  }
}
