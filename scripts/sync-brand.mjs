import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const copies = [
  ['branding/mark/puddlejumper-mark.svg', 'apps/web/public/brand/puddlejumper-mark.svg'],
  ['branding/mark/puddlejumper-mark-reverse.svg', 'apps/web/public/brand/puddlejumper-mark-reverse.svg'],
  ['branding/mark/favicon.svg', 'apps/web/app/icon.svg'],
  ['branding/mark/favicon.svg', 'apps/web/app/apple-icon.svg'],
  ['branding/wordmark/puddlejumper-wordmark-tagline.svg', 'apps/web/public/brand/puddlejumper-wordmark-tagline.svg'],
  ['branding/wordmark/puddlejumper-wordmark-reverse.svg', 'apps/web/public/brand/puddlejumper-wordmark-reverse.svg'],
  ['branding/lockup/puddlejumper-horizontal.svg', 'apps/web/public/brand/puddlejumper-horizontal.svg'],
  ['branding/lockup/puddlejumper-stacked.svg', 'apps/web/public/brand/puddlejumper-stacked.svg'],
  ['branding/mascot/puddlejumper-duck-flat.svg', 'apps/web/public/brand/puddlejumper-duck-flat.svg']
];

let drift = false;

for (const [srcRel, destRel] of copies) {
  const src = path.join(root, srcRel);
  const dest = path.join(root, destRel);

  if (!fs.existsSync(src)) {
    console.error(`brand: missing source: ${srcRel}`);
    process.exitCode = 1;
    continue;
  }

  const content = `<!-- GENERATED FROM ${srcRel}. DO NOT EDIT DIRECTLY. -->\n` + fs.readFileSync(src, 'utf8');

  if (check) {
    if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== content) {
      console.error(`❌ brand drift: ${destRel}`);
      drift = true;
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    console.log(`synced ${destRel}`);
  }
}

if (check && drift) {
  process.exit(1);
}

if (process.exitCode) {
  console.error('brand: sync failed because one or more source assets are missing');
  process.exit(process.exitCode);
}

console.log(check ? '✅ brand assets in sync' : '✅ brand assets synced');
