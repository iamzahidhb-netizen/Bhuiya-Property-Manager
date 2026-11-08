const fs = require('fs');

const svgContent = fs.readFileSync('C:/Bhuiya-Property-Manager/public/brand/anwar-bhuiyan-property.svg', 'utf-8');
const match = svgContent.match(/href="data:image\/png;base64,([^"]+)"/);

if (match) {
  const buf = Buffer.from(match[1], 'base64');
  console.log('PNG buffer length:', buf.length);
  fs.writeFileSync('C:/Bhuiya-Property-Manager/public/brand/extracted-logo.png', buf);
  console.log('Saved C:/Bhuiya-Property-Manager/public/brand/extracted-logo.png');
} else {
  console.log('No data url match found');
}
