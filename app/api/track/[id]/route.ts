import { NextRequest, NextResponse } from 'next/server';
import { bump } from '@/lib/store';

// Called by the landing page when the demo actually starts playing / is opened.
// Transparent, first-party, no recipient fingerprinting — just a play counter.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  await bump(params.id, 'plays');
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
