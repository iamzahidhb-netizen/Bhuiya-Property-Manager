import http from 'http';
import handler from '../api/callable/[action].ts';

// Create a local test server wrapping the Vercel Serverless Function handler
export function createTestServer() {
  const server = http.createServer(async (req, res) => {
    // Collect body
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      const rawBody = Buffer.concat(chunks).toString();
      let parsedBody = {};
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
      }

      // Mock VercelRequest / VercelResponse
      const vercelReq = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: {},
        body: parsedBody,
      };

      // Extract query from URL
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      urlObj.searchParams.forEach((val, key) => {
        vercelReq.query[key] = val;
      });

      const vercelRes = {
        statusCode: 200,
        headers: {},
        setHeader(name, value) {
          this.headers[name.toLowerCase()] = value;
          res.setHeader(name, value);
          return this;
        },
        status(code) {
          this.statusCode = code;
          res.statusCode = code;
          return this;
        },
        json(data) {
          this.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return this;
        },
        end(data) {
          res.end(data);
          return this;
        },
      };

      try {
        await handler(vercelReq, vercelRes);
      } catch (err) {
        console.error('[Test Server Error]:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'internal', message: err.message }));
        }
      }
    });
  });

  return server;
}
