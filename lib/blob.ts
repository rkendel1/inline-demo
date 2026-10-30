// Durable asset storage for uploaded videos, preview GIFs and posters.
//
// Backend is chosen automatically, most-durable-first:
//   1. BLOB_READ_WRITE_TOKEN set -> Vercel Blob. Returns an absolute URL served by Vercel;
//      best for large media. (`npm i @vercel/blob`.)
//   2. DATABASE_URL set          -> Postgres (bytea) via Prisma. One durable place for
//      everything; no extra service. Served through the /uploads/<name> route.
//   3. otherwise                 -> local filesystem under .data/uploads (dev only).
//
// So with just DATABASE_URL (which you set for durable links), media is durable too.

import { promises as fs } from 'fs';
import path from 'path';

export const UPLOAD_DIR = path.join(process.cwd(), '.data', 'uploads');

export type AssetBackend = 'blob' | 'db' | 'fs';

export function assetBackend(): AssetBackend {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  if (process.env.DATABASE_URL) return 'db';
  return 'fs';
}

export interface StoredAsset {
  url: string; // relative /uploads/<name>, or an absolute blob URL
}

function safeName(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}${rand}-${base}`;
}

// Maps a stored /uploads/<name> URL back to its filesystem path, or null if it isn't a
// local-filesystem upload. Used so ffmpeg can read a local file directly.
export function localUploadPath(url: string): string | null {
  const m = /^\/uploads\/([^/?#]+)$/.exec(url);
  if (!m) return null;
  return path.join(UPLOAD_DIR, path.basename(m[1]));
}

export async function storeAsset(filename: string, bytes: Buffer, contentType: string): Promise<StoredAsset> {
  // Normalize a missing/generic type to one derived from the extension, so <video>/<img>
  // get a type they can play/render regardless of what the uploader reported.
  if (!contentType || contentType === 'application/octet-stream') contentType = contentTypeFor(filename);

  const name = safeName(filename);
  const backend = assetBackend();

  if (backend === 'blob') {
    const spec = '@vercel/blob';
    const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    const mod = await dynImport(spec).catch(() => {
      throw new Error('BLOB_READ_WRITE_TOKEN is set but @vercel/blob is not installed. Run: npm i @vercel/blob');
    });
    const result = await mod.put(name, bytes, { access: 'public', contentType });
    return { url: result.url };
  }

  if (backend === 'db') {
    const { prisma } = await import('./db');
    await prisma.asset.create({
      data: { name, contentType, size: bytes.length, bytes, created: BigInt(Date.now()) },
    });
    return { url: `/uploads/${name}` };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), bytes);
  return { url: `/uploads/${name}` };
}

export interface LoadedAsset {
  bytes: Buffer;
  contentType: string;
}

// Reads an asset back by its /uploads/<name> name. Used by the /uploads route for the db
// and fs backends. (Blob assets are served by Vercel at their absolute URL and never reach
// that route.) Tries the database first when configured, then the local filesystem.
export async function getAsset(name: string): Promise<LoadedAsset | null> {
  const safe = path.basename(name);

  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('./db');
      const row = await prisma.asset.findUnique({ where: { name: safe } });
      if (row) {
        // Prefer a concrete type by extension when the stored one is missing/generic, so
        // <video> and <img> get a type they can actually play/render.
        const ct = !row.contentType || row.contentType === 'application/octet-stream' ? contentTypeFor(safe) : row.contentType;
        return { bytes: Buffer.from(row.bytes), contentType: ct };
      }
    } catch {
      // fall through to filesystem
    }
  }

  try {
    const bytes = await fs.readFile(path.join(UPLOAD_DIR, safe));
    return { bytes, contentType: contentTypeFor(safe) };
  } catch {
    return null;
  }
}

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

export function contentTypeFor(name: string): string {
  return TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';
}
