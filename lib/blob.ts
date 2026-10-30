// Asset storage for uploaded video files and generated previews.
//
// Default (zero setup): write to .data/uploads and serve the bytes through the
// /uploads/<name> route handler (app/uploads/[name]/route.ts). We deliberately do NOT
// rely on Next's static public/ serving, because files written at runtime are not served
// by `next start` — the route handler streams them reliably in dev and self-hosted prod.
//
// Production on Vercel: set BLOB_READ_WRITE_TOKEN and uploads go to Vercel Blob instead
// (install with `npm i @vercel/blob`). Blob URLs are absolute and served by Vercel.

import { promises as fs } from 'fs';
import path from 'path';

export const UPLOAD_DIR = path.join(process.cwd(), '.data', 'uploads');

export interface StoredAsset {
  url: string; // public URL (relative /uploads/<name>, or absolute blob URL)
}

function safeName(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = Date.now().toString(36);
  return `${stamp}-${base}`;
}

// Maps a stored /uploads/<name> URL back to its path on disk, or null if it isn't a
// local upload (e.g. a blob/remote URL). Used so ffmpeg can read the file directly.
export function localUploadPath(url: string): string | null {
  const m = /^\/uploads\/([^/?#]+)$/.exec(url);
  if (!m) return null;
  return path.join(UPLOAD_DIR, path.basename(m[1]));
}

export async function storeAsset(filename: string, bytes: Buffer, contentType: string): Promise<StoredAsset> {
  const name = safeName(filename);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Optional dependency, resolved at runtime only so the app builds/runs without it.
    const spec = '@vercel/blob';
    const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    const mod = await dynImport(spec).catch(() => {
      throw new Error('BLOB_READ_WRITE_TOKEN is set but @vercel/blob is not installed. Run: npm i @vercel/blob');
    });
    const result = await mod.put(name, bytes, { access: 'public', contentType });
    return { url: result.url };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), bytes);
  return { url: `/uploads/${name}` };
}
