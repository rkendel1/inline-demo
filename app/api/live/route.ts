import { NextRequest, NextResponse } from 'next/server';
import { getSlots, setSlot } from '@/lib/store';
import { isAuthorized } from '@/lib/auth';
import { storageError } from '@/lib/shorturl-api';
import { isShortUrlConfigured, repointShortLink, shortLink } from '@/lib/shorturl';
import { baseUrl } from '@/lib/base';

// GET  -> current slot -> demo-id map (+ short_url wiring status)
// POST { slot, demoId } -> repoint a slot (the "manage the link" action)
export async function GET() {
  const slots = await getSlots();
  // Self-heal: keep the short link aimed at the live demo on this app's current base URL
  // (e.g. a link created while the base URL was wrong). A no-op when it already is.
  if (slots.signature && isShortUrlConfigured()) {
    const r = await repointShortLink(`${baseUrl()}/demo/${slots.signature}`);
    if (!r.ok) console.error('short link check failed:', r.error);
  }
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
  let ok: boolean;
  try {
    ok = await setSlot(slot, demoId);
  } catch (err) {
    return storageError(err);
  }
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
