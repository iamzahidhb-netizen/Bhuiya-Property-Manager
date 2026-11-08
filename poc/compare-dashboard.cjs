const fs = require('fs');

const current = fs.readFileSync('C:/Bhuiya-Property-Manager/src/components/AdminDashboard.tsx', 'utf-8');
const target8700 = fs.readFileSync('C:/Bhuiya-Property-Manager/poc/step8700-target.txt', 'utf-8');
const repl8700 = fs.readFileSync('C:/Bhuiya-Property-Manager/poc/step8700-replacement.txt', 'utf-8');

console.log('Current AdminDashboard length:', current.length);
console.log('Target 8700 length:', target8700.length);
console.log('Replacement 8700 length:', repl8700.length);

const normCurrent = current.replace(/\r\n/g, '\n');
const normRepl = repl8700.replace(/\r\n/g, '\n');
const normTarget = target8700.replace(/\r\n/g, '\n');

// In current AdminDashboard, we also made minor edits to logo container and activity feed.
// Let's see how much of normRepl is in normCurrent.
const replStart = normRepl.substring(0, 80);
const replEnd = normRepl.substring(normRepl.length - 80);

console.log('Replacement starts at:', normCurrent.indexOf(replStart));
console.log('Replacement end found:', normCurrent.indexOf(replEnd));
