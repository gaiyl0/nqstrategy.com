import { NextResponse } from 'next/server';
import { getSessionUser, destroySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, user: null });
  }
  return NextResponse.json({ success: true, user });
}

export async function POST() {
  await destroySession();
  return NextResponse.json({ success: true });
}