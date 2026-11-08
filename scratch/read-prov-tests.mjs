import fs from 'fs';
const content = fs.readFileSync('C:/Users/Onty\'s zZz/.gemini/antigravity/brain/67e53663-ba74-4e56-88c5-fa3dd43b6058/scratch/test-phase9-2-provisioning.mjs', 'utf8');
const lines = content.split('\n');
lines.slice(80).forEach((l, i) => {
  if (l.includes('Test ') || l.includes('assert(')) {
    console.log(`${i+81}: ${l}`);
  }
});
