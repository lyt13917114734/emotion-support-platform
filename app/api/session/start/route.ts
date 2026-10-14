import { apiError, json } from '@/lib/server/responses';
import { startFormalSession } from '@/lib/server/session-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { profile?: unknown };
    return json({ ok: true, ...(await startFormalSession(body.profile)) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
