import { NextRequest, NextResponse } from 'next/server';
import { resolveSlot, bump } from '@/lib/store';
import { baseUrl } from '@/lib/base';

// The stable link your signature points at: /go/<slot> (e.g. /go/signature).
// It 307-redirects to the landing page of whichever demo the slot currently points to.
// Repoint the slot in the dashboard and this immediately sends clicks to the new demo —
// the signature HTML never changes.
export async function GET(
  request: NextRequest,
  { params }: { params: { slot: string } }
) {
  const demo = await resolveSlot(params.slot);
  if (!demo) {
    // Fail safe: no live demo for this slot.
    return new NextResponse('No demo is live for this link yet.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Count the signature click.
  await bump(demo.id, 'clicks');

  const dest = `${baseUrl()}/demo/${demo.id}`;
  const res = NextResponse.redirect(dest, { status: 307 });
  // Never cache, so a repoint takes effect on the very next click.
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
