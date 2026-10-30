import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/blob';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// Serves locally-stored uploads from .data/uploads. (Blob-mode uploads are served by
// Vercel directly and never hit this route.) Supports HTTP range requests so <video>
// seeking works.
export async function GET(request: NextRequest, { params }: { params: { name: string } }) {
  const name = path.basename(params.name); // prevent traversal
  const file = path.join(UPLOAD_DIR, name);

  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = TYPES[ext] || 'application/octet-stream';
  const total = stat.size;
  const range = request.headers.get('range');

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    const chunk = await fs.readFile(file);
    const body = chunk.subarray(start, end + 1);
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

  const data = await fs.readFile(file);
  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(total),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
