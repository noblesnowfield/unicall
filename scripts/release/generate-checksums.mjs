import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const assets = [
  'unicall.global.js',
  'unicall.browser.mjs',
  'browser/index.d.ts'
];

const lines = [];

for (const asset of assets) {
  const content = await readFile(join(distDir, asset));
  const checksum = createHash('sha256').update(content).digest('hex');

  lines.push(`${checksum}  ${asset}`);
}

await writeFile(join(distDir, 'SHA256SUMS'), `${lines.join('\n')}\n`, 'utf8');

console.log(`Generated checksums for ${assets.length} release assets.`);
