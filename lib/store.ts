// Demo registry + repointable slots.
//
// Zero-setup default: a JSON file under .data/. This is intentionally simple so the
// app runs with `npm run dev` and nothing else. For production with multiple serverless
// instances, swap this module's read/write for a real KV/DB (e.g. Vercel KV, Postgres).
// The short_url repo already shows a Prisma/Postgres setup you can mirror if you want to
// unify storage later.

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Demo, StoreData } from './types';

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'demos.json');

const empty: StoreData = { demos: {}, slots: {} };

async function readAll(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoreData;
    return { demos: parsed.demos ?? {}, slots: parsed.slots ?? {} };
  } catch (err: any) {
    if (err?.code === 'ENOENT') return { ...empty };
    throw err;
  }
}

async function writeAll(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function newId(): string {
  // Short, URL-safe, unguessable enough for a personal tool.
  return crypto.randomBytes(5).toString('hex');
}

export async function listDemos(): Promise<Demo[]> {
  const { demos } = await readAll();
  return Object.values(demos).sort((a, b) => b.created - a.created);
}

export async function getDemo(id: string): Promise<Demo | null> {
  const { demos } = await readAll();
  return demos[id] ?? null;
}

export async function createDemo(input: {
  title: string;
  kind: Demo['kind'];
  src: string;
  poster?: string;
  caption?: string;
}): Promise<Demo> {
  const data = await readAll();
  const id = newId();
  const demo: Demo = {
    id,
    title: input.title,
    kind: input.kind,
    src: input.src,
    poster: input.poster,
    caption: input.caption,
    clicks: 0,
    plays: 0,
    created: Date.now(),
  };
  data.demos[id] = demo;
  await writeAll(data);
  return demo;
}

export async function updateDemo(
  id: string,
  patch: Partial<Pick<Demo, 'title' | 'kind' | 'src' | 'poster' | 'caption'>>
): Promise<Demo | null> {
  const data = await readAll();
  const demo = data.demos[id];
  if (!demo) return null;
  Object.assign(demo, patch, { updated: Date.now() });
  await writeAll(data);
  return demo;
}

export async function deleteDemo(id: string): Promise<boolean> {
  const data = await readAll();
  if (!data.demos[id]) return false;
  delete data.demos[id];
  // Drop any slot that pointed here so the signature fails safe (shows nothing) rather
  // than resolving to a deleted demo.
  for (const slot of Object.keys(data.slots)) {
    if (data.slots[slot] === id) delete data.slots[slot];
  }
  await writeAll(data);
  return true;
}

export async function bump(id: string, field: 'clicks' | 'plays'): Promise<void> {
  const data = await readAll();
  const demo = data.demos[id];
  if (!demo) return;
  demo[field] += 1;
  await writeAll(data);
}

// --- Slots: the repointable "manage the link" layer ---

export async function getSlots(): Promise<Record<string, string>> {
  const { slots } = await readAll();
  return slots;
}

export async function resolveSlot(slot: string): Promise<Demo | null> {
  const data = await readAll();
  const id = data.slots[slot];
  if (!id) return null;
  return data.demos[id] ?? null;
}

export async function setSlot(slot: string, demoId: string): Promise<boolean> {
  const data = await readAll();
  if (!data.demos[demoId]) return false;
  data.slots[slot] = demoId;
  await writeAll(data);
  return true;
}
