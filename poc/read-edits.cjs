const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream("C:/Users/Onty's zZz/.gemini/antigravity/brain/67e53663-ba74-4e56-88c5-fa3dd43b6058/.system_generated/logs/transcript_full.jsonl"),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('"step_index":8690') || line.includes('"step_index":8694') || line.includes('"step_index":8700')) {
    const o = JSON.parse(line);
    console.log('=== STEP', o.step_index, '===');
    if (o.tool_calls && o.tool_calls[0]) {
      console.log('Target:\n' + o.tool_calls[0].args.Target);
      console.log('--- REPLACEMENT ---');
      console.log(o.tool_calls[0].args.Replacement);
    }
  }
});
