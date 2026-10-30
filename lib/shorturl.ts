// Optional integration with the short_url service (https://github.com/rkendel1/short_url).
//
// When configured, inline-demo keeps ONE short link (a fixed custom code) and repoints its
// destination to the live demo's landing page every time you change which demo is live.
// That puts link management where short_url is good at it — editable destination, revision
// history, analytics, QR — while the pasted signature uses the short link as its href.
//
// Auth follows short_url's signed-request scheme exactly (see its API_INTEGRATION.md):
// ECDSA P-256 / SHA-256 over a canonical string, raw r‖s signature, hex.
//
// Required env to enable:
//   SHORT_URL_BASE_URL   e.g. https://0-2.ca
//   SHORT_URL_OWNER      16–128 chars [A-Za-z0-9_-]  (randomBytes(16).hex)
//   SHORT_URL_PRIVATE_KEY  PKCS8 PEM of a prime256v1 EC private key
//   SHORT_URL_CODE       the custom short code to own, e.g. "demo"  (default: "demo")
// Generate the owner + key once with: node scripts/shorturl-keygen.mjs

import { createHash, createPrivateKey, createPublicKey, sign } from 'crypto';

const SIGNATURE_VERSION = 'short-url-auth-v1';

export function shortUrlConfig() {
  const base = process.env.SHORT_URL_BASE_URL?.replace(/\/+$/, '');
  const owner = process.env.SHORT_URL_OWNER;
  const privateKeyPem = process.env.SHORT_URL_PRIVATE_KEY;
  const code = (process.env.SHORT_URL_CODE || 'demo').trim();
  if (!base || !owner || !privateKeyPem) return null;
  return { base, owner, privateKeyPem, code };
}

export function isShortUrlConfigured(): boolean {
  return shortUrlConfig() !== null;
}

// The public short link, if configured. Safe to compute without any network call.
export function shortLink(): string | null {
  const cfg = shortUrlConfig();
  return cfg ? `${cfg.base}/${cfg.code}` : null;
}

async function signedFetch(method: 'POST' | 'PATCH', path: string, body: object) {
  const cfg = shortUrlConfig()!;
  const privateKey = createPrivateKey(cfg.privateKeyPem);
  const publicKeyHex = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('hex');
  const raw = JSON.stringify(body);
  const timestamp = String(Date.now());
  const bodyHash = createHash('sha256').update(raw, 'utf8').digest('hex');
  const message = [SIGNATURE_VERSION, method, path, timestamp, bodyHash].join('\n');
  const signature = sign('sha256', Buffer.from(message, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return fetch(`${cfg.base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Owner': cfg.owner,
      'X-Owner-Key': publicKeyHex,
      'X-Owner-Timestamp': timestamp,
      'X-Owner-Signature': signature.toString('hex'),
    },
    body: raw,
  });
}

export interface RepointResult {
  ok: boolean;
  shortUrl?: string;
  error?: string;
}

// Point the managed short link at `destUrl`. Creates the code on first use (trust-on-first-
// use binds this key), otherwise updates the destination with revision handling.
export async function repointShortLink(destUrl: string): Promise<RepointResult> {
  const cfg = shortUrlConfig();
  if (!cfg) return { ok: false, error: 'short_url is not configured' };
  const path = `/api/links/${cfg.code}`;

  try {
    // Does the code already exist (and do we have its current revision)?
    const meta = await fetch(`${cfg.base}${path}`, { cache: 'no-store' });

    if (meta.status === 404) {
      // Create it.
      const res = await signedFetch('POST', '/api/shorten', { url: destUrl, customCode: cfg.code });
      if (res.ok) return { ok: true, shortUrl: `${cfg.base}/${cfg.code}` };
      const j = await res.json().catch(() => ({}));
      if (res.status === 409) return { ok: false, error: `Short code "${cfg.code}" is already taken by someone else. Choose another SHORT_URL_CODE.` };
      return { ok: false, error: `Create failed (${res.status}): ${j.error || 'unknown'}` };
    }

    if (!meta.ok) {
      const j = await meta.json().catch(() => ({}));
      return { ok: false, error: `Lookup failed (${meta.status}): ${j.error || 'unknown'}` };
    }

    let { revision } = await meta.json();

    // Update the destination, retrying once on a revision conflict.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await signedFetch('PATCH', path, { url: destUrl, revision });
      if (res.ok) return { ok: true, shortUrl: `${cfg.base}/${cfg.code}` };
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && j.currentRevision) {
        revision = j.currentRevision; // reload and retry
        continue;
      }
      if (res.status === 403) return { ok: false, error: `Not authorized to edit "${cfg.code}" — the code is bound to a different key. Use the key that first claimed it, or a fresh SHORT_URL_CODE.` };
      return { ok: false, error: `Update failed (${res.status}): ${j.error || 'unknown'}` };
    }
    return { ok: false, error: 'Update kept conflicting; try again.' };
  } catch (err: any) {
    return { ok: false, error: `Could not reach short_url: ${err?.message || err}` };
  }
}
