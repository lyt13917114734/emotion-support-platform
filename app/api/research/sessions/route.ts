import { getD1 } from '@/db';
import { currentStep } from '@/lib/experiment';
import { validResearchSession as validSession } from '@/lib/research-history';
import { requireResearcher, researchJSON, researchError } from '@/lib/server/research-auth';
import { ResearchExportError } from '@/lib/server/research-export';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireResearcher(request);
    const params = new URL(request.url).searchParams;
    const db = getD1(), id = params.get('id');
    if (id) {
      const row = await db.prepare('SELECT session_json FROM experiment_sessions WHERE id = ?').bind(id).first<{session_json: string}>();
      if (!row) throw new ResearchExportError('记录不存在。', 404);
      const session: unknown = JSON.parse(row.session_json);
      if (!validSession(session)) throw new ResearchExportError('此记录无法通过完整性检查，请保留原数据并联系维护人员。', 500);
      return researchJSON({ session });
    }
    const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
    const search = (params.get('search') ?? '').trim().toUpperCase().slice(0, 20);
    const pattern = `%${search.replaceAll('%', '').replaceAll('_', '')}%`;
    const totals = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM experiment_sessions").first();
    const matched = await db.prepare('SELECT COUNT(*) AS total FROM experiment_sessions WHERE participant_id LIKE ?').bind(pattern).first<{total: number}>();
    const rows = await db.prepare('SELECT id, participant_id, status, sequence, created_at, updated_at, session_json FROM experiment_sessions WHERE participant_id LIKE ? ORDER BY created_at DESC, id LIMIT 50 OFFSET ?')
      .bind(pattern, (page - 1) * 50).all<{id:string;participant_id:string;status:string;sequence:string;created_at:number;updated_at:number;session_json:string}>();
    const sessions = rows.results.map(({session_json, ...row}) => {
      try {
        const session: unknown = JSON.parse(session_json);
        if (validSession(session)) return { ...row, completed_tasks: Object.values(session.trials).filter(t => t.phase === 'formal' && t.sentAt !== null).length, total_tasks: session.plan.filter(p => p.phase === 'formal').length, current_step: currentStep(session).id };
      } catch { /* Show the record, but flag invalid content instead of hiding it. */ }
      return { ...row, completed_tasks: null, total_tasks: null, current_step: '记录待核查' };
    });
    return researchJSON({ totals, sessions, page, matched: matched?.total ?? 0 });
  } catch (error) { return researchError(error); }
}
