import { apiError, json } from '@/lib/server/responses';
import { bearerToken } from '@/lib/server/session-auth';
import { loadFormalSession } from '@/lib/server/session-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { participantId?: unknown };
    return json({ ok: true, session: await loadFormalSession(body.participantId, bearerToken(request)) });
  } catch (error) {
    return apiError(error);
  }
}
