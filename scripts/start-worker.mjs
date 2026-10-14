import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
const args = [wrangler, 'dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', '.wrangler/state', '--ip', '127.0.0.1', '--inspector-port', '0'];
if (existsSync('.dev.vars')) {
  const match = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_EXPORT_PASSWORD_HASH=([a-f0-9]{64})$/m);
  if (match) args.push('--var', `ADMIN_EXPORT_PASSWORD_HASH:${match[1]}`);
}
const child = spawn(process.execPath, args, { stdio: 'inherit' });
child.on('exit', code => process.exitCode = code ?? 1);
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
