import { NextRequest, NextResponse } from 'next/server';
import { listDemos, createDemo } from '@/lib/store';
import { isAuthorized } from '@/lib/auth';
import { storageError } from '@/lib/shorturl-api';
import { storeAsset } from '@/lib/blob';
import { youTubeChipGif } from '@/lib/youtube-gif';

// A YouTube demo gets its animated chip GIF automatically; anything else keeps no poster
// (the dashboard builds video GIFs in the browser before creating).
async function autoChip(src: string): Promise<string | undefined> {
  try {
    const gif = await youTubeChipGif(src);
    return gif ? (await storeAsset('preview.gif', Buffer.from(gif), 'image/gif')).url : undefined;
  } catch (err) {
    console.error('auto chip GIF failed', err);
    return undefined;
  }
}

export async function GET() {
  const demos = await listDemos();
  return NextResponse.json({ demos });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const kind = body.kind === 'video' || body.kind === 'embed' ? body.kind : null;
  const src = typeof body.src === 'string' ? body.src.trim() : '';
  const poster = typeof body.poster === 'string' ? body.poster.trim() : undefined;
  const caption = typeof body.caption === 'string' ? body.caption.trim() : undefined;

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!kind) return NextResponse.json({ error: "kind must be 'video' or 'embed'" }, { status: 400 });
  if (!/^https?:\/\//i.test(src) && !src.startsWith('/')) {
    return NextResponse.json({ error: 'src must be an http(s) URL or an /uploads path' }, { status: 400 });
  }

  try {
    const demo = await createDemo({ title, kind, src, poster: poster || (await autoChip(src)), caption });
    return NextResponse.json({ demo }, { status: 201 });
  } catch (err) {
    return storageError(err);
  }
}
