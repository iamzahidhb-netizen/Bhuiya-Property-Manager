const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream("C:/Users/Onty's zZz/.gemini/antigravity/brain/67e53663-ba74-4e56-88c5-fa3dd43b6058/.system_generated/logs/transcript_full.jsonl"),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('"step_index":8700')) {
    const o = JSON.parse(line);
    if (o.tool_calls && o.tool_calls[0]) {
      fs.writeFileSync('C:/Bhuiya-Property-Manager/poc/step8700-target.txt', o.tool_calls[0].args.Target, 'utf-8');
      fs.writeFileSync('C:/Bhuiya-Property-Manager/poc/step8700-replacement.txt', o.tool_calls[0].args.Replacement, 'utf-8');
      console.log('Saved step8700-target.txt and step8700-replacement.txt');
    }
  }
});
