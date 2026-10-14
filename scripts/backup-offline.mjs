import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupRoot, dataRoot, databaseDir, validateLocations } from './offline-common.mjs';

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(path, name) : [{ name, path }];
  });
}

export function backupDatabase() {
  validateLocations();
  const lockFile = resolve(dataRoot, 'offline-server.lock');
  if (existsSync(lockFile)) {
    const pid = Number(readFileSync(lockFile, 'utf8'));
    try { process.kill(pid, 0); throw new Error('请先关闭线下实验平台，再备份数据库。'); }
    catch (error) { if (error?.code !== 'ESRCH') throw error; }
  }
  if (!existsSync(databaseDir) || listFiles(databaseDir).length === 0) throw new Error('没有可备份的线下数据库。');
  mkdirSync(backupRoot, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const destination = resolve(backupRoot, `backup-${stamp}-${randomUUID().slice(0, 8)}`);
  mkdirSync(destination);
  cpSync(databaseDir, resolve(destination, 'database'), { recursive: true, errorOnExist: true, force: false });
  const files = listFiles(resolve(destination, 'database')).map(({ name, path }) => ({
    path: name, bytes: statSync(path).size,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  }));
  writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify({ created_at: new Date().toISOString(), files }, null, 2));
  return destination;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`备份完成：${backupDatabase()}`); }
  catch (error) { console.error(`备份失败：${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
}
