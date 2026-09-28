import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { getSessionUser, destroySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function GETHandler() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, user: null });
  }
  return NextResponse.json({ success: true, user });
}

async function POSTHandler() {
  await destroySession();
  return NextResponse.json({ success: true });
}

export const GET = withApiErrors(GETHandler, { route: '/api/auth/me' });
export const POST = withApiErrors(POSTHandler, { route: '/api/auth/me' });
