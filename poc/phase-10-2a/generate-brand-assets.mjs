import fs from 'fs';
import path from 'path';

const SOURCE_PNG = 'C:\\Users\\Onty\'s zZz\\Downloads\\Anwar Bhuiyan Property Logo.png';
const BRAND_DIR = path.resolve('public/brand');
const ICONS_DIR = path.resolve('public/icons');

if (!fs.existsSync(BRAND_DIR)) {
  fs.mkdirSync(BRAND_DIR, { recursive: true });
}
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

console.log('Reading source PNG from:', SOURCE_PNG);
const pngBuffer = fs.readFileSync(SOURCE_PNG);
const base64Data = pngBuffer.toString('base64');
const dataUri = `data:image/png;base64,${base64Data}`;

// Create canonical SVG
const canonicalSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1254 1254" width="100%" height="100%">
  <image width="1254" height="1254" href="${dataUri}"/>
</svg>`;

const svgDest = path.join(BRAND_DIR, 'anwar-bhuiyan-property.svg');
fs.writeFileSync(svgDest, canonicalSvg, 'utf8');
console.log('Created canonical SVG at:', svgDest, `(${Math.round(canonicalSvg.length / 1024)} KB)`);

// Also copy to favicon.svg
const faviconSvgDest = path.resolve('public/favicon.svg');
fs.writeFileSync(faviconSvgDest, canonicalSvg, 'utf8');
console.log('Updated public/favicon.svg');

// Create icon-192.svg and icon-512.svg
const icon192SvgDest = path.join(ICONS_DIR, 'icon-192.svg');
const icon512SvgDest = path.join(ICONS_DIR, 'icon-512.svg');
fs.writeFileSync(icon192SvgDest, canonicalSvg, 'utf8');
fs.writeFileSync(icon512SvgDest, canonicalSvg, 'utf8');
console.log('Updated public/icons/icon-192.svg and icon-512.svg');

console.log('Brand SVG generation complete!');
