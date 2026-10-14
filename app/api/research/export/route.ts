import { createResearchExport, ResearchExportError, type ResearchExportFormat } from '@/lib/server/research-export';
import { checkResearchOrigin, requireResearcher } from '@/lib/server/research-auth';

export const dynamic = 'force-dynamic';
const FORMATS: ResearchExportFormat[] = ['json', 'trials', 'surveys', 'blind', 'all', 'scales', 'texts'];

export async function POST(request: Request) {
  try {
    checkResearchOrigin(request);
    await requireResearcher(request);
    const body = await request.json() as { format?: unknown };
    if (!FORMATS.includes(body.format as ResearchExportFormat)) throw new ResearchExportError('导出格式无效。', 400);
    const file = await createResearchExport(body.format as ResearchExportFormat);
    return new Response(file.data, { status: 200, headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store, private',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    const known = error instanceof ResearchExportError ? error : new ResearchExportError('服务器暂时无法生成数据文件。', 503);
    return Response.json({ ok: false, error: known.message }, { status: known.status, headers: {
      'Cache-Control': 'no-store',
      ...(known.retryAfter ? { 'Retry-After': String(known.retryAfter) } : {}),
    } });
  }
}
