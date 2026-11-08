import fs from 'fs';

const original = fs.readFileSync('C:/Users/Onty\'s zZz/.gemini/antigravity/brain/67e53663-ba74-4e56-88c5-fa3dd43b6058/scratch/test-regression-master.mjs', 'utf8');

// Replace import of firebase/functions
let adapted = original.replace(
  /import \{\s*getFunctions,\s*connectFunctionsEmulator,\s*httpsCallable\s*\} from 'firebase\/functions';/,
  `import { createTestServer } from './test-vercel-api.mjs';`
);

// Replace functions emulator setup with Vercel API test server setup
const serverSetupCode = `
  // Start Vercel API test server
  const server = createTestServer();
  let baseUrl;
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = \`http://127.0.0.1:\${port}\`;
      resolve();
    });
  });

  async function callVercelApi(actionName, payload = {}) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Unauthenticated test call');

    const res = await fetch(\`\${baseUrl}/api/callable/\${actionName}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${token}\`,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok) {
      const error = new Error(body.message || 'API error');
      error.code = body.code || body.error || 'unknown';
      error.status = res.status;
      throw error;
    }
    return body.data;
  }

  function httpsCallable(_fns, actionName) {
    return async (payload = {}) => {
      const data = await callVercelApi(actionName, payload);
      return { data };
    };
  }
`;

adapted = adapted.replace(
  /const functions = getFunctions\(app\);\s*connectFunctionsEmulator\(functions, '127\.0\.0\.1', 5001\);/,
  serverSetupCode
);

// Close server before final summary
adapted = adapted.replace(
  "console.log('MASTER REGRESSION RESULT:');",
  "server.close();\n  console.log('MASTER REGRESSION RESULT:');"
);

fs.writeFileSync('C:/Bhuiya-Property-Manager/scratch/test-regression-master-vercel.mjs', adapted, 'utf8');
console.log('Successfully written test-regression-master-vercel.mjs!');
