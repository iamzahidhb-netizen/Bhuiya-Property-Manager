/**
 * Phase 10.2B-1: Hardened Cloudflare Pages Advanced Mode (_worker.js) Router
 * 
 * Implements:
 * 1. Strict CORS preflight (OPTIONS) with configured origin matching (no wildcard '*')
 * 2. POST-only enforcement with HTTP 405 Method Not Allowed
 * 3. Safe API action normalization, path traversal prevention, and whitelist verification
 * 4. Mandatory Authorization Bearer header validation
 * 5. Structured JSON error responses
 * 6. Edge security headers (nosniff, DENY, strict-origin)
 * 7. Static asset delegation & SPA fallback to /index.html
 */

import { ACTION_PERMISSIONS } from './workspaceAuth.mjs';

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://bhuiya-property-manager.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

/**
 * Safely normalizes and validates an API action name
 * 
 * Rejects:
 * - Empty action names
 * - Leading/trailing whitespace
 * - Path traversal (.., /, \)
 * - Malformed characters
 * - Unknown actions not present in ACTION_PERMISSIONS whitelist
 */
export function normalizeActionName(rawPath, allowedActions = Object.keys(ACTION_PERMISSIONS)) {
  if (!rawPath || typeof rawPath !== 'string') {
    const err = new Error('Action name is missing or invalid');
    err.code = 'INVALID_ACTION_NAME';
    err.status = 400;
    throw err;
  }

  // 1. Remove leading/trailing whitespace
  let action = rawPath.trim();

  // 2. Strip leading /api/callable/ if full path passed
  if (action.startsWith('/api/callable/')) {
    action = action.replace('/api/callable/', '');
  }

  // 3. Strip trailing slashes
  action = action.replace(/\/+$/, '');

  // 4. Reject empty string
  if (action.length === 0) {
    const err = new Error('Action name cannot be empty');
    err.code = 'EMPTY_ACTION_NAME';
    err.status = 400;
    throw err;
  }

  // 5. Detect and reject path traversal attempts
  if (
    action.includes('..') ||
    action.includes('/') ||
    action.includes('\\') ||
    action.toLowerCase().includes('%2e') ||
    action.toLowerCase().includes('%2f') ||
    action.toLowerCase().includes('%5c')
  ) {
    const err = new Error(`Malformed action path detected: "${rawPath}"`);
    err.code = 'PATH_TRAVERSAL_DETECTED';
    err.status = 400;
    throw err;
  }

  // 6. Strict character whitelist (alphanumeric only)
  if (!/^[a-zA-Z0-9_]+$/.test(action)) {
    const err = new Error(`Action contains invalid characters: "${action}"`);
    err.code = 'INVALID_CHARACTERS';
    err.status = 400;
    throw err;
  }

  // 7. Whitelist verification against ACTION_PERMISSIONS
  if (!allowedActions.includes(action)) {
    const err = new Error(`Unknown action: "${action}"`);
    err.code = 'ACTION_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return action;
}

/**
 * Helper to build standard JSON response with security headers
 */
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...extraHeaders
  });

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

export function errorResponse(code, message, status = 400, extraHeaders = {}) {
  return jsonResponse({ error: { code, message } }, status, extraHeaders);
}

/**
 * Factory for Cloudflare Pages Advanced Mode Worker
 */
export function createPagesWorker(apiHandler, options = {}) {
  const allowedOrigins = options.allowedOrigins || DEFAULT_ALLOWED_ORIGINS;

  return {
    async fetch(request, env = {}, ctx = {}) {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin');

      // Resolve CORS origin header
      const corsHeaders = {};
      if (origin && allowedOrigins.includes(origin)) {
        corsHeaders['Access-Control-Allow-Origin'] = origin;
        corsHeaders['Access-Control-Allow-Credentials'] = 'true';
        corsHeaders['Vary'] = 'Origin';
      }

      // 1. CORS Preflight (OPTIONS)
      if (request.method === 'OPTIONS') {
        if (url.pathname.startsWith('/api/')) {
          return new Response(null, {
            status: 204,
            headers: {
              ...corsHeaders,
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
              'Access-Control-Max-Age': '86400',
              'X-Content-Type-Options': 'nosniff'
            }
          });
        }
      }

      // 2. Edge API Routes (/api/callable/*)
      if (url.pathname.startsWith('/api/callable')) {
        // Enforce POST-only for API mutations
        if (request.method !== 'POST') {
          return errorResponse(
            'METHOD_NOT_ALLOWED',
            `Method ${request.method} is not allowed. API actions accept POST only.`,
            405,
            { ...corsHeaders, 'Allow': 'POST, OPTIONS' }
          );
        }

        // Validate Authorization Bearer Header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return errorResponse(
            'UNAUTHENTICATED',
            'Missing or malformed Authorization header. Bearer token is required.',
            401,
            corsHeaders
          );
        }

        // Normalize and validate action name
        let action;
        try {
          const rawAction = url.pathname.replace(/^\/api\/callable\/?/, '');
          action = normalizeActionName(rawAction);
        } catch (normErr) {
          return errorResponse(
            normErr.code || 'BAD_REQUEST',
            normErr.message,
            normErr.status || 400,
            corsHeaders
          );
        }

        // Execute API Handler
        try {
          const response = await apiHandler(request, action, env, ctx);
          const responseHeaders = new Headers(response.headers);
          
          // Apply security and CORS headers
          responseHeaders.set('X-Content-Type-Options', 'nosniff');
          responseHeaders.set('X-Frame-Options', 'DENY');
          responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
          for (const [k, v] of Object.entries(corsHeaders)) {
            responseHeaders.set(k, v);
          }

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
          });
        } catch (handlerErr) {
          return errorResponse(
            handlerErr.code || 'INTERNAL_ERROR',
            handlerErr.message || 'An internal error occurred',
            handlerErr.status || 500,
            corsHeaders
          );
        }
      }

      // Reject non-callable /api/* requests with 404
      if (url.pathname.startsWith('/api/')) {
        return errorResponse('NOT_FOUND', 'API route not found', 404, corsHeaders);
      }

      // 3. Static Assets & SPA Fallback via env.ASSETS
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetRes = await env.ASSETS.fetch(request);
        if (assetRes.status !== 404) {
          return assetRes;
        }

        // SPA Navigation Fallback: if HTML request not found, serve /index.html
        const acceptHeader = request.headers.get('accept') || '';
        if (request.method === 'GET' && acceptHeader.includes('text/html')) {
          const spaRequest = new Request(new URL('/index.html', request.url), request);
          return await env.ASSETS.fetch(spaRequest);
        }

        return assetRes;
      }

      // Fallback for isolated unit testing
      return new Response('Mock Static Asset Server', { status: 200 });
    }
  };
}
