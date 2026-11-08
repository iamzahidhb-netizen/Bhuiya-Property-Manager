import fs from 'fs';
import readline from 'readline';

const fileStream = fs.createReadStream('C:\\Users\\Onty\'s zZz\\.gemini\\antigravity\\brain\\67e53663-ba74-4e56-88c5-fa3dd43b6058\\.system_generated\\logs\\transcript.jsonl');
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

let stepNum = 0;
for await (const line of rl) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.source === 'USER_EXPLICIT' && obj.type === 'USER_INPUT') {
      console.log(`\n=== STEP ${obj.step_index} (${obj.created_at}) ===`);
      const text = obj.content || '';
      const lines = text.split('\n');
      console.log(lines.slice(0, 8).join('\n'));
      // Search for any password in the text
      for (const l of lines) {
        if (/pass(word)?/i.test(l) && !/password input/i.test(l)) {
          console.log('   MATCH:', l.trim().substring(0, 120));
        }
      }
    }
  } catch (e) {}
}
