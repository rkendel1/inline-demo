// Durable asset storage for uploaded videos, preview GIFs and posters.
//
// Backend is chosen automatically, most-durable-first:
//   1. BLOB_READ_WRITE_TOKEN set -> Vercel Blob. Returns an absolute URL served by Vercel;
//      best for large media. (`npm i @vercel/blob`.)
//   2. short_url configured      -> short_url's database, next to the demos. No extra
//      service. Served through this app's /uploads/<name> route, which proxies it.
//   3. otherwise                 -> local filesystem under .data/uploads (dev only).
//
// So with just short_url configured (which you need for durable links), media is durable too.

import { promises as fs } from 'fs';
import path from 'path';
import { isShortUrlConfigured, shortUrlConfig, signedFetch } from './shorturl-api';

export const UPLOAD_DIR = path.join(process.cwd(), '.data', 'uploads');

export type AssetBackend = 'blob' | 'shorturl' | 'fs';

export function assetBackend(): AssetBackend {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  if (isShortUrlConfigured()) return 'shorturl';
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

  const backend = assetBackend();

  if (backend === 'shorturl') {
    // short_url names the asset; the body (and signature) is the raw bytes.
    const res = await signedFetch('POST', '/api/inline-demo/assets', new Uint8Array(bytes), {
      'Content-Type': contentType,
      'X-Filename': path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_'),
    });
    const j = await res.json().catch(() => ({} as any));
    if (!res.ok || !j.name) throw new Error(`short_url upload failed (${res.status}): ${j.error || 'unknown'}`);
    return { url: `/uploads/${j.name}` };
  }

  const name = safeName(filename);

  if (backend === 'blob') {
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

export interface LoadedAsset {
  bytes: Buffer;
  contentType: string;
}

// Where short_url serves an uploaded asset, or null when short_url isn't the store.
// The /uploads route proxies it there (passing Range through, so <video> can seek).
export function shortUrlAssetUrl(name: string): string | null {
  const cfg = shortUrlConfig();
  return cfg ? `${cfg.base}/api/inline-demo/assets/${encodeURIComponent(path.basename(name))}` : null;
}

// Reads a local-filesystem asset back by its /uploads/<name> name (dev backend).
export async function getAsset(name: string): Promise<LoadedAsset | null> {
  const safe = path.basename(name);
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
