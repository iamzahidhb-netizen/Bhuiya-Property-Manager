import fs from 'fs';
const content = fs.readFileSync('C:/Users/Onty\'s zZz/.gemini/antigravity/brain/67e53663-ba74-4e56-88c5-fa3dd43b6058/scratch/test-regression-master.mjs', 'utf8');
const lines = content.split('\n');
console.log('Total lines in test-regression-master:', lines.length);

lines.forEach((l, i) => {
  if (l.match(/\/\/ Scenario \d+/i) || l.match(/console\.log\(['"`]--- Scenario/i)) {
    console.log(`${i+1}: ${l}`);
  }
});
