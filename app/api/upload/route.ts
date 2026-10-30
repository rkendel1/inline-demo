import { NextRequest, NextResponse } from 'next/server';
import { storeAsset } from '@/lib/blob';
import { isAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';

// Accepts a multipart form with a single "file" field (video or poster image).
// Returns { url } pointing at the stored asset.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file"' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const asset = await storeAsset(file.name || 'upload', bytes, file.type || 'application/octet-stream');
  return NextResponse.json(asset, { status: 201 });
}
