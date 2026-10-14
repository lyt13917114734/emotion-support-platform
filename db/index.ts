import { env } from 'cloudflare:workers';

export function getD1(): D1Database {
  if (!env.DB) throw new Error('正式实验数据库暂不可用。');
  return env.DB;
}
