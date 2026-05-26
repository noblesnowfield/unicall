import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const distDir = join(process.cwd(), 'dist');
const esmPath = join(distDir, 'unicall.browser.mjs');
const globalPath = join(distDir, 'unicall.global.js');
const browserSource = await readFile(esmPath, 'utf8');
const prohibitedMarkers = ['node:', 'EmailProvider', 'SmtpClient'];

for (const marker of prohibitedMarkers) {
  if (browserSource.includes(marker)) {
    throw new Error(`浏览器 ESM 产物包含服务端实现标记: ${marker}`);
  }
}

const browserModule = await import(pathToFileURL(esmPath).href);

if (typeof browserModule.NotificationRuntime !== 'function') {
  throw new Error('浏览器 ESM 产物未导出 NotificationRuntime');
}

const globalSource = await readFile(globalPath, 'utf8');
const sandbox = {
  AbortController,
  URL,
  URLSearchParams,
  console,
  performance,
  setTimeout,
  clearTimeout
};

runInNewContext(globalSource, sandbox);

if (typeof sandbox.Unicall?.NotificationRuntime !== 'function') {
  throw new Error('浏览器全局产物未暴露 Unicall.NotificationRuntime');
}

console.log('Verified browser ESM and global release assets.');
