import fs from 'fs';

// Read API key and project ID from .env.staging safely
const envContent = fs.readFileSync('.env.staging', 'utf8');
const apiKeyMatch = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';

console.log('Testing Identity Toolkit accounts:signInWithPassword...');
console.log('API Key length:', apiKey.length, 'prefix:', apiKey.substring(0, 5));

const email = 'zahid@bhuiyan.com';
const passwordsToTest = ['StagingTestPass2026!', 'WrongPass123!'];

async function testPassword(pwd, label) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: pwd,
      returnSecureToken: true
    })
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`[${label}] SUCCESS! HTTP 200. LocalId (UID):`, data.localId, 'Email:', data.email);
  } else {
    console.log(`[${label}] FAILED: HTTP ${res.status}:`, data.error?.message, data.error?.details || '');
  }
}

async function main() {
  for (const pwd of passwordsToTest) {
    await testPassword(pwd, pwd === 'WrongPass123!' ? 'KNOWN_WRONG' : 'CANDIDATE_PWD');
  }
}

main().catch(console.error);
