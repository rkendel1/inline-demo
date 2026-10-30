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
// On first use the code is generated randomly by short_url (e.g. "otter0427"), exactly
// like any other short_url link, then remembered so later changes repoint the same link.
//
// Required env to enable:
//   SHORT_URL_BASE_URL   e.g. https://0-2.ca
//   SHORT_URL_OWNER      16–128 chars [A-Za-z0-9_-]  (randomBytes(16).hex)
//   SHORT_URL_PRIVATE_KEY  PKCS8 PEM of a prime256v1 EC private key
// Optional:
//   SHORT_URL_CODE       force a specific custom code instead of a random one
// Generate the owner + key once with: node scripts/shorturl-keygen.mjs

import { createHash, createPrivateKey, createPublicKey, sign } from 'crypto';
import { getShortUrlMeta, setShortUrlMeta } from './store';

const SIGNATURE_VERSION = 'short-url-auth-v1';

export function shortUrlConfig() {
  const base = process.env.SHORT_URL_BASE_URL?.replace(/\/+$/, '');
  const owner = process.env.SHORT_URL_OWNER;
  const privateKeyPem = process.env.SHORT_URL_PRIVATE_KEY;
  // Optional: pin a custom code. Omitted => short_url generates a random one on first use.
  const forcedCode = process.env.SHORT_URL_CODE?.trim() || undefined;
  if (!base || !owner || !privateKeyPem) return null;
  return { base, owner, privateKeyPem, forcedCode };
}

export function isShortUrlConfigured(): boolean {
  return shortUrlConfig() !== null;
}

// The public short link once it exists (after the first "set live"). Reads the remembered
// code from the store; null if short_url isn't configured or no link has been created yet.
export async function shortLink(): Promise<string | null> {
  if (!isShortUrlConfigured()) return null;
  const meta = await getShortUrlMeta();
  return meta.shortUrl ?? null;
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

// Create the short link on first use (short_url picks a random code unless SHORT_URL_CODE
// forces one), then on later calls repoint that same remembered link to `destUrl`.
async function createLink(destUrl: string, cfg: NonNullable<ReturnType<typeof shortUrlConfig>>): Promise<RepointResult> {
  const body: Record<string, unknown> = { url: destUrl };
  if (cfg.forcedCode) body.customCode = cfg.forcedCode; // omit => server generates one
  const res = await signedFetch('POST', '/api/shorten', body);
  const j = await res.json().catch(() => ({} as any));
  if (res.ok && j.shortCode) {
    const shortUrl: string = j.shortUrl || `${cfg.base}/${j.shortCode}`;
    await setShortUrlMeta({ code: j.shortCode, shortUrl });
    return { ok: true, shortUrl };
  }
  if (res.status === 409) {
    return { ok: false, error: cfg.forcedCode ? `Short code "${cfg.forcedCode}" is already taken. Pick another SHORT_URL_CODE or leave it unset for a random one.` : 'Generated code collided; try again.' };
  }
  return { ok: false, error: `Create failed (${res.status}): ${j.error || 'unknown'}` };
}

export async function repointShortLink(destUrl: string): Promise<RepointResult> {
  const cfg = shortUrlConfig();
  if (!cfg) return { ok: false, error: 'short_url is not configured' };

  try {
    const remembered = await getShortUrlMeta();
    const code = remembered.code;

    // No link yet → create one (random code, or the forced code).
    if (!code) return await createLink(destUrl, cfg);

    const path = `/api/links/${code}`;
    const lookup = await fetch(`${cfg.base}${path}`, { cache: 'no-store' });

    // The remembered link is gone (deleted upstream) → make a fresh one.
    if (lookup.status === 404 || lookup.status === 410) return await createLink(destUrl, cfg);
    if (!lookup.ok) {
      const j = await lookup.json().catch(() => ({} as any));
      return { ok: false, error: `Lookup failed (${lookup.status}): ${j.error || 'unknown'}` };
    }

    let { revision } = await lookup.json();
    const shortUrl = remembered.shortUrl || `${cfg.base}/${code}`;

    // Update the destination, retrying once on a revision conflict.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await signedFetch('PATCH', path, { url: destUrl, revision });
      if (res.ok) return { ok: true, shortUrl };
      const j = await res.json().catch(() => ({} as any));
      if (res.status === 409 && j.currentRevision) {
        revision = j.currentRevision; // reload and retry
        continue;
      }
      if (res.status === 403) return { ok: false, error: `Not authorized to edit ${code} — it's bound to a different key. Use the key that first claimed it.` };
      return { ok: false, error: `Update failed (${res.status}): ${j.error || 'unknown'}` };
    }
    return { ok: false, error: 'Update kept conflicting; try again.' };
  } catch (err: any) {
    return { ok: false, error: `Could not reach short_url: ${err?.message || err}` };
  }
}
