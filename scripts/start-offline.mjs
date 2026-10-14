import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { backupDatabase } from './backup-offline.mjs';
import { dataRoot, databaseDir, passwordHash, projectRoot, queryDatabase, runNode, validateLocations, workerConfig, wrangler } from './offline-common.mjs';

const migrations = [
  '0000_shallow_multiple_man.sql',
  '0001_unique_winter_soldier.sql',
  '0002_flimsy_amphibian.sql',
];
const expectedTables = ['experiment_sessions', 'session_events', 'research_export_attempts'];

try {
  validateLocations();
  const hash = passwordHash();
  mkdirSync(databaseDir, { recursive: true });
  const lockFile = resolve(dataRoot, 'offline-server.lock');
  if (existsSync(lockFile)) {
    const pid = Number(readFileSync(lockFile, 'utf8'));
    try { process.kill(pid, 0); throw new Error('线下实验平台已经在运行，请勿重复启动。'); }
    catch (error) { if (error?.code !== 'ESRCH') throw error; }
    rmSync(lockFile);
  }
  console.log('正在构建线下正式版…');
  runNode([resolve(projectRoot, 'node_modules/vinext/dist/cli.js'), 'build'], {
    env: { VITE_EXPERIMENT_MODE: 'formal' },
  });
  if (!existsSync(workerConfig)) throw new Error('正式版构建文件不存在。');

  const tableRows = queryDatabase("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('experiment_sessions','session_events','research_export_attempts')");
  const tables = new Set(tableRows.map(row => row.name));
  if (tables.size === 0) {
    for (const filename of migrations) {
      runNode([wrangler, 'd1', 'execute', 'DB', '--local', '--config', workerConfig,
        '--persist-to', databaseDir, '--file', resolve(projectRoot, 'drizzle', filename), '--json']);
    }
    console.log('已创建线下实验数据库。');
  } else if (expectedTables.some(name => !tables.has(name))) {
    throw new Error('数据库结构不完整；已停止启动，未尝试覆盖或重建现有数据。');
  }
  const verified = queryDatabase("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('experiment_sessions','session_events','research_export_attempts')");
  if (verified.length !== expectedTables.length) throw new Error('数据库结构验证未通过。');
  const count = Number(queryDatabase('SELECT COUNT(*) AS count FROM experiment_sessions')[0]?.count ?? 0);
  if (count > 0) {
    const destination = backupDatabase();
    console.log(`启动前已备份 ${count} 条实验记录：${destination}`);
  }
  if (queryDatabase("SELECT name FROM sqlite_master WHERE type='table' AND name='researcher_sessions'").length === 0) {
    runNode([wrangler, 'd1', 'execute', 'DB', '--local', '--config', workerConfig,
      '--persist-to', databaseDir, '--file', resolve(projectRoot, 'drizzle/0003_researcher_sessions.sql'), '--json']);
  }
  console.log(`数据库位置：${databaseDir}`);
  console.log('线下正式版仅在本机开放：http://127.0.0.1:8787');
  writeFileSync(lockFile, String(process.pid), { flag: 'w' });
  const args = [wrangler, 'dev', '--config', workerConfig, '--local', '--persist-to', databaseDir,
    '--ip', '127.0.0.1', '--port', '8787', '--inspector-port', '0',
    '--var', `ADMIN_EXPORT_PASSWORD_HASH:${hash}`];
  const child = spawn(process.execPath, args, { cwd: projectRoot, stdio: 'inherit' });
  child.on('error', error => { rmSync(lockFile, { force: true }); console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { rmSync(lockFile, { force: true }); process.exitCode = code ?? 1; });
} catch (error) {
  console.error(`线下正式版未启动：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
