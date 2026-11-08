/**
 * Phase 10.2A Proof-of-Concept: Cloudflare Pages Advanced Mode (_worker.js) Router
 * 
 * Demonstrates the Advanced Mode routing architecture:
 * 1. Bypasses the root /functions directory entirely, preserving Firebase Cloud Functions.
 * 2. Intercepts /api/callable/* requests for edge execution.
 * 3. Delegates all static assets to env.ASSETS.fetch().
 * 4. Implements SPA fallback to /index.html for HTML navigation routes.
 * 5. Applies enterprise security headers.
 */

export function createPagesWorker(apiHandler) {
  return {
    async fetch(request, env = {}, ctx = {}) {
      const url = new URL(request.url);

      // 1. Edge API Routes
      if (url.pathname.startsWith('/api/callable/')) {
        const action = url.pathname.replace('/api/callable/', '');
        const response = await apiHandler(request, action, env, ctx);
        
        // Inject security headers
        const headers = new Headers(response.headers);
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('X-Frame-Options', 'DENY');
        headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }

      // 2. Static Assets & SPA Fallback via env.ASSETS
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
