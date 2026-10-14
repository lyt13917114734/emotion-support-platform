import { loginResearcher, logoutResearcher, requireResearcher, researchJSON, researchError } from '@/lib/server/research-auth';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { return researchJSON({ authenticated: true, expiresAt: await requireResearcher(request) }); }
  catch (error) { return researchError(error); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { password?: unknown };
    const session = await loginResearcher(request, body.password);
    return researchJSON({ authenticated: true, expiresAt: session.expiresAt }, 200, { 'Set-Cookie': session.cookie });
  } catch (error) { return researchError(error); }
}
export async function DELETE(request: Request) {
  try { return researchJSON({ authenticated: false }, 200, { 'Set-Cookie': await logoutResearcher(request) }); }
  catch (error) { return researchError(error); }
}
