import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const allowedBumps = new Set([
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
  'prerelease'
]);

const bump = process.argv[2] ?? 'patch';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: options.capture ? 'pipe' : 'inherit'
  });

  if (result.status !== 0) {
    const rendered = [command, ...args].join(' ');
    throw new Error(`命令执行失败: ${rendered}`);
  }

  return result.stdout?.trim() ?? '';
}

function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

  if (typeof packageJson.version !== 'string') {
    throw new Error('package.json 缺少 version 字段。');
  }

  return packageJson.version;
}

function ensureValidBump() {
  const isExactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(bump);

  if (!allowedBumps.has(bump) && !isExactVersion) {
    throw new Error(
      `版本参数无效: ${bump}\n` +
        '可用参数: patch, minor, major, prepatch, preminor, premajor, prerelease 或明确版本号。'
    );
  }
}

function ensureCleanWorktree() {
  const status = run('git', ['status', '--short'], { capture: true });

  if (status.length > 0) {
    throw new Error(
      '工作区不干净，请先提交或暂存当前改动后再发布版本。\n' + status
    );
  }
}

function getCurrentBranch() {
  const branch = run('git', ['branch', '--show-current'], { capture: true });

  if (branch.length === 0) {
    throw new Error('当前不在普通分支上，无法自动 push 分支。');
  }

  return branch;
}

function ensureTagDoesNotExist(tagName) {
  const localTag = run('git', ['tag', '--list', tagName], { capture: true });

  if (localTag.length > 0) {
    throw new Error(`本地 tag 已存在: ${tagName}`);
  }
}

function main() {
  ensureValidBump();
  ensureCleanWorktree();

  const branch = getCurrentBranch();
  const beforeVersion = readPackageVersion();

  console.log(`[release] 当前版本: ${beforeVersion}`);
  console.log(`[release] 升级类型: ${bump}`);
  run('npm', ['version', bump, '--no-git-tag-version']);

  const nextVersion = readPackageVersion();
  const tagName = `v${nextVersion}`;
  ensureTagDoesNotExist(tagName);

  console.log(`[release] 提交版本文件: ${nextVersion}`);
  run('git', ['add', 'package.json', 'pnpm-lock.yaml']);
  run('git', ['commit', '-m', `chore: 发布版本 ${nextVersion}`]);
  run('git', ['tag', tagName]);

  console.log(`[release] 新版本: ${nextVersion}`);
  console.log(`[release] 推送分支: ${branch}`);
  run('git', ['push', 'origin', branch]);

  console.log(`[release] 推送 tag: ${tagName}`);
  run('git', ['push', 'origin', tagName]);

  console.log(
    `[release] 已推送 ${tagName}，GitHub Actions 将自动发布 npm 包。`
  );
}

try {
  main();
} catch (error) {
  console.error(`[release] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
