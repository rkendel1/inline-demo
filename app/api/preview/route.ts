import { NextRequest, NextResponse } from 'next/server';
import { makePreview, hasFfmpeg, PreviewOptions } from '@/lib/gif';
import { storeAsset, localUploadPath } from '@/lib/blob';
import { isAuthorized } from '@/lib/auth';
import { baseUrl } from '@/lib/base';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST { src, start?, seconds?, width?, fps? }
// Generates a looping preview GIF + poster from the given video and stores both.
// `src` may be an /uploads path (resolved against this app) or an http(s) URL.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await hasFfmpeg())) {
    return NextResponse.json(
      { error: 'ffmpeg not available on this host. Generate the preview where ffmpeg is installed (see scripts/make-preview.sh), or set a poster image manually.' },
      { status: 501 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let src = typeof body.src === 'string' ? body.src.trim() : '';
  if (!src) return NextResponse.json({ error: 'src is required' }, { status: 400 });

  // Prefer reading a local upload straight from disk — more robust than fetching our own
  // HTTP endpoint. Fall back to the URL (remote http(s), or an absolute blob URL).
  let input = src;
  const diskPath = localUploadPath(src);
  if (diskPath) {
    try {
      await fs.access(diskPath);
      input = diskPath;
    } catch {
      input = src.startsWith('/') ? `${baseUrl()}${src}` : src;
    }
  }

  const opts: PreviewOptions = {
    start: Number.isFinite(body.start) ? Number(body.start) : 0,
    seconds: Number.isFinite(body.seconds) ? Number(body.seconds) : 4,
    width: Number.isFinite(body.width) ? Number(body.width) : 320,
    fps: Number.isFinite(body.fps) ? Number(body.fps) : 12,
  };

  try {
    const { gif, poster } = await makePreview(input, opts);
    const gifAsset = await storeAsset('preview.gif', gif, 'image/gif');
    const posterAsset = await storeAsset('poster.jpg', poster, 'image/jpeg');
    return NextResponse.json({ gifUrl: gifAsset.url, posterUrl: posterAsset.url }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: `Preview failed: ${err?.message || err}` }, { status: 500 });
  }
}
