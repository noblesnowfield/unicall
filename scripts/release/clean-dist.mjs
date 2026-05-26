import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const projectDir = resolve(process.cwd());
const distDir = resolve(projectDir, 'dist');

if (dirname(distDir) !== projectDir) {
  throw new Error('拒绝清理项目目录之外的构建输出');
}

await rm(distDir, {
  recursive: true,
  force: true
});
