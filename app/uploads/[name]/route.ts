import { NextRequest, NextResponse } from 'next/server';
import { getAsset } from '@/lib/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Serves uploads held in the database or on the local filesystem, with HTTP range support
// so <video> seeking works. (Vercel Blob uploads are served by Vercel at their absolute
// URL and never reach this route.)
export async function GET(request: NextRequest, { params }: { params: { name: string } }) {
  const asset = await getAsset(params.name);
  if (!asset) return new NextResponse('Not found', { status: 404 });

  const { bytes, contentType } = asset;
  const total = bytes.length;
  const range = request.headers.get('range');

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    const body = bytes.subarray(start, end + 1);
    return new NextResponse(body, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(body.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(total),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
