import { apiError, json } from '@/lib/server/responses';
import { bearerToken } from '@/lib/server/session-auth';
import { saveFormalSession } from '@/lib/server/session-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { participantId?: unknown; expectedRevision?: unknown; session?: unknown };
    const session = await saveFormalSession(body.participantId, bearerToken(request), body.expectedRevision, body.session);
    return json({ ok: true, session });
  } catch (error) {
    return apiError(error);
  }
}
