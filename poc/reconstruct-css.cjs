const fs = require('fs');

const base = fs.readFileSync('C:/Bhuiya-Property-Manager/poc/step6801-liquid-glass.css', 'utf-8');
const target = fs.readFileSync('C:/Bhuiya-Property-Manager/poc/step7128-target.txt', 'utf-8');
const replacement = fs.readFileSync('C:/Bhuiya-Property-Manager/poc/step7128-replacement.txt', 'utf-8');

// Normalize CRLF to LF
const normBase = base.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');
const normReplacement = replacement.replace(/\r\n/g, '\n');

if (normBase.includes(normTarget)) {
  const result = normBase.replace(normTarget, normReplacement);
  fs.writeFileSync('C:/Bhuiya-Property-Manager/poc/pre-redesign-liquid-glass.css', result, 'utf-8');
  console.log('Successfully reconstructed pre-redesign-liquid-glass.css! Length:', result.length);
} else {
  console.log('Target not found directly, inspecting...');
  console.log('Target length:', normTarget.length);
}
