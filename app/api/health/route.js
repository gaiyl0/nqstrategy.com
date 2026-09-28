import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withApiErrors } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

async function GETHandler() {
  const databaseReady = db.prepare('SELECT 1 ready').get()?.ready === 1;
  return NextResponse.json(
    { success: databaseReady, status: databaseReady ? 'ready' : 'unavailable' },
    { status: databaseReady ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}

export const GET = withApiErrors(GETHandler, { route: '/api/health' });
