import { NextRequest, NextResponse } from 'next/server';
import { getDemo, updateDemo, deleteDemo } from '@/lib/store';
import { isAuthorized } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const demo = await getDemo(params.id);
  if (!demo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ demo });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const patch: any = {};
  for (const key of ['title', 'kind', 'src', 'poster', 'caption'] as const) {
    if (typeof body[key] === 'string') patch[key] = body[key].trim();
  }
  if (patch.kind && patch.kind !== 'video' && patch.kind !== 'embed') {
    return NextResponse.json({ error: "kind must be 'video' or 'embed'" }, { status: 400 });
  }
  const demo = await updateDemo(params.id, patch);
  if (!demo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ demo });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ok = await deleteDemo(params.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
