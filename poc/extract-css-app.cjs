const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream("C:/Users/Onty's zZz/.gemini/antigravity/brain/67e53663-ba74-4e56-88c5-fa3dd43b6058/.system_generated/logs/transcript_full.jsonl"),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('"step_index":6801') || line.includes('"step_index":7128') || line.includes('"step_index":7312')) {
    const o = JSON.parse(line);
    console.log('=== STEP', o.step_index, '===');
    if (o.tool_calls && o.tool_calls[0]) {
      const tc = o.tool_calls[0];
      if (o.step_index === 6801) {
        fs.writeFileSync('C:/Bhuiya-Property-Manager/poc/step6801-liquid-glass.css', tc.args.Content, 'utf-8');
        console.log('Saved step6801-liquid-glass.css');
      } else if (o.step_index === 7128) {
        fs.writeFileSync('C:/Bhuiya-Property-Manager/poc/step7128-replacement.txt', tc.args.Replacement, 'utf-8');
        fs.writeFileSync('C:/Bhuiya-Property-Manager/poc/step7128-target.txt', tc.args.Target, 'utf-8');
        console.log('Saved step7128-replacement.txt');
      } else if (o.step_index === 7312) {
        fs.writeFileSync('C:/Bhuiya-Property-Manager/poc/step7312-replacement.txt', tc.args.Replacement, 'utf-8');
        fs.writeFileSync('C:/Bhuiya-Property-Manager/poc/step7312-target.txt', tc.args.Target, 'utf-8');
        console.log('Saved step7312 files');
      }
    }
  }
});
