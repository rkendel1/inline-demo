// Prisma/Postgres store — the durable production backend. Selected when DATABASE_URL is
// set. Same function surface as store-fs.ts so the routes don't care which one is active.

import type { Demo, DemoKind } from './types';
import { prisma } from './db';
import { newId } from './id';

// Prisma returns BigInt timestamps and null (not undefined) for optional columns; map to
// the plain Demo shape the app uses.
function toDemo(row: {
  id: string;
  title: string;
  kind: string;
  src: string;
  poster: string | null;
  caption: string | null;
  clicks: number;
  plays: number;
  created: bigint;
  updated: bigint | null;
}): Demo {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind as DemoKind,
    src: row.src,
    poster: row.poster ?? undefined,
    caption: row.caption ?? undefined,
    clicks: row.clicks,
    plays: row.plays,
    created: Number(row.created),
    updated: row.updated == null ? undefined : Number(row.updated),
  };
}

export async function listDemos(): Promise<Demo[]> {
  const rows = await prisma.demo.findMany({ orderBy: { created: 'desc' } });
  return rows.map(toDemo);
}

export async function getDemo(id: string): Promise<Demo | null> {
  const row = await prisma.demo.findUnique({ where: { id } });
  return row ? toDemo(row) : null;
}

export async function createDemo(input: {
  title: string;
  kind: Demo['kind'];
  src: string;
  poster?: string;
  caption?: string;
}): Promise<Demo> {
  const row = await prisma.demo.create({
    data: {
      id: newId(),
      title: input.title,
      kind: input.kind,
      src: input.src,
      poster: input.poster ?? null,
      caption: input.caption ?? null,
      created: BigInt(Date.now()),
    },
  });
  return toDemo(row);
}

export async function updateDemo(
  id: string,
  patch: Partial<Pick<Demo, 'title' | 'kind' | 'src' | 'poster' | 'caption'>>
): Promise<Demo | null> {
  try {
    const row = await prisma.demo.update({
      where: { id },
      data: { ...patch, updated: BigInt(Date.now()) },
    });
    return toDemo(row);
  } catch {
    return null; // not found
  }
}

export async function deleteDemo(id: string): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.slot.deleteMany({ where: { demoId: id } }), // fail safe: drop pointers to it
      prisma.demo.delete({ where: { id } }),
    ]);
    return true;
  } catch {
    return false; // not found
  }
}

export async function bump(id: string, field: 'clicks' | 'plays'): Promise<void> {
  try {
    await prisma.demo.update({ where: { id }, data: { [field]: { increment: 1 } } });
  } catch {
    // demo gone; ignore
  }
}

export async function getSlots(): Promise<Record<string, string>> {
  const rows = await prisma.slot.findMany();
  const out: Record<string, string> = {};
  for (const r of rows) out[r.name] = r.demoId;
  return out;
}

export async function resolveSlot(slot: string): Promise<Demo | null> {
  const s = await prisma.slot.findUnique({ where: { name: slot } });
  if (!s) return null;
  return getDemo(s.demoId);
}

export async function setSlot(slot: string, demoId: string): Promise<boolean> {
  const exists = await prisma.demo.findUnique({ where: { id: demoId }, select: { id: true } });
  if (!exists) return false;
  await prisma.slot.upsert({
    where: { name: slot },
    create: { name: slot, demoId },
    update: { demoId },
  });
  return true;
}

export async function getShortUrlMeta(): Promise<{ code?: string; shortUrl?: string }> {
  const row = await prisma.shortLink.findUnique({ where: { id: 1 } });
  return row ? { code: row.code, shortUrl: row.shortUrl } : {};
}

export async function setShortUrlMeta(meta: { code: string; shortUrl: string }): Promise<void> {
  await prisma.shortLink.upsert({
    where: { id: 1 },
    create: { id: 1, code: meta.code, shortUrl: meta.shortUrl },
    update: { code: meta.code, shortUrl: meta.shortUrl },
  });
}
