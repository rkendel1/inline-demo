import { NextRequest, NextResponse } from 'next/server';
import { getSlots, setSlot } from '@/lib/store';
import { isAuthorized } from '@/lib/auth';
import { isShortUrlConfigured, repointShortLink, shortLink } from '@/lib/shorturl';
import { baseUrl } from '@/lib/base';

// GET  -> current slot -> demo-id map (+ short_url wiring status)
// POST { slot, demoId } -> repoint a slot (the "manage the link" action)
export async function GET() {
  const slots = await getSlots();
  return NextResponse.json({ slots, shortUrl: await shortLink(), shortUrlConfigured: isShortUrlConfigured() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const slot = typeof body.slot === 'string' ? body.slot.trim() : '';
  const demoId = typeof body.demoId === 'string' ? body.demoId.trim() : '';
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(slot)) {
    return NextResponse.json({ error: 'slot must be 1-40 letters, digits, - or _' }, { status: 400 });
  }
  const ok = await setSlot(slot, demoId);
  if (!ok) return NextResponse.json({ error: 'Unknown demoId' }, { status: 400 });

  // If short_url is wired in, repoint the managed short link to this demo's landing page.
  // The local slot change already succeeded; we report the short_url outcome alongside so
  // the dashboard can show it without failing the whole action on a transient network error.
  if (slot === 'signature' && isShortUrlConfigured()) {
    const dest = `${baseUrl()}/demo/${demoId}`;
    const r = await repointShortLink(dest);
    return NextResponse.json({ ok: true, shortUrl: r.shortUrl, shortUrlError: r.ok ? undefined : r.error });
  }

  return NextResponse.json({ ok: true });
}
