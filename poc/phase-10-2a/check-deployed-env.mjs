import { getWorkerConfig } from './worker/envConfig.mjs';

async function main() {
  console.log('Fetching live index from https://bhuiya-property-staging.pages.dev ...');
  const res = await fetch('https://bhuiya-property-staging.pages.dev');
  const html = await res.text();
  console.log('HTTP Status:', res.status);
  console.log('CF-Ray:', res.headers.get('cf-ray'));
  
  const matches = html.match(/src="(\/assets\/[^"]+\.js)"/g) || [];
  console.log('Referenced scripts:', matches);
  
  for (const m of matches) {
    const scriptPath = m.match(/src="([^"]+)"/)[1];
    const scriptUrl = 'https://bhuiya-property-staging.pages.dev' + scriptPath;
    const sRes = await fetch(scriptUrl);
    const text = await sRes.text();
    const projMatches = text.match(/bhuiya-property-[a-z0-9-]+/g) || [];
    const authMatches = text.match(/bhuiya-property-[a-z0-9-]+\.firebaseapp\.com/g) || [];
    if (projMatches.length > 0 || authMatches.length > 0) {
      console.log(`Script ${scriptPath}:`);
      console.log('  Projects found:', [...new Set(projMatches)]);
      console.log('  Auth domains found:', [...new Set(authMatches)]);
    }
  }
}

main().catch(console.error);
