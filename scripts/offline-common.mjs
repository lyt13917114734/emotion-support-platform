import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const projectRoot = resolve(import.meta.dirname, '..');
export const wrangler = resolve(projectRoot, 'node_modules/wrangler/bin/wrangler.js');
export const workerConfig = resolve(projectRoot, 'dist/server/wrangler.json');
export const dataRoot = resolve(process.env.E2_OFFLINE_DATA_DIR || resolve(homedir(), 'Documents', 'ECNU-Experiment2-Offline'));
export const databaseDir = resolve(dataRoot, 'database');
export const backupRoot = resolve(process.env.E2_OFFLINE_BACKUP_DIR || resolve(homedir(), 'Documents', 'ECNU-Experiment2-Backups'));

function inside(path, parent) {
  const relation = relative(parent, path);
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation));
}

export function validateLocations() {
  if (inside(dataRoot, projectRoot) || inside(backupRoot, projectRoot)) {
    throw new Error('正式数据库和备份目录必须位于项目目录之外。');
  }
  if (inside(dataRoot, backupRoot) || inside(backupRoot, dataRoot)) {
    throw new Error('数据库与备份目录必须相互独立。');
  }
  if (dataRoot === resolve(dataRoot, '..') || backupRoot === resolve(backupRoot, '..')) {
    throw new Error('不能把磁盘根目录用作数据库或备份目录。');
  }
}

export function passwordHash() {
  const local = resolve(projectRoot, '.dev.vars');
  const text = existsSync(local) ? readFileSync(local, 'utf8') : '';
  const fromFile = text.match(/^ADMIN_EXPORT_PASSWORD_HASH=([a-f0-9]{64})\s*$/m)?.[1];
  const hash = process.env.ADMIN_EXPORT_PASSWORD_HASH || fromFile;
  if (!/^[a-f0-9]{64}$/.test(hash || '')) {
    throw new Error('缺少研究者导出密码的 SHA-256 配置：请设置 ADMIN_EXPORT_PASSWORD_HASH 或在 .dev.vars 中配置。');
  }
  return hash;
}

export function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `命令失败：${result.status}`).trim());
  return result.stdout;
}

export function queryDatabase(sql) {
  const output = runNode([wrangler, 'd1', 'execute', 'DB', '--local', '--config', workerConfig,
    '--persist-to', databaseDir, '--command', sql, '--json']);
  const results = JSON.parse(output);
  if (!Array.isArray(results) || results.some(item => !item.success)) throw new Error('本地数据库检查失败。');
  return results[0]?.results ?? [];
}
