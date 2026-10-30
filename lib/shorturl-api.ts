// Signed client for the short_url service (https://github.com/rkendel1/short_url).
//
// short_url is both where the signature's short link lives and where inline-demo stores
// everything (demos, slots, the managed short link, uploaded media) — in short_url's own
// database, under SHORT_URL_OWNER. inline-demo keeps no database of its own.
//
// Auth follows short_url's signed-request scheme exactly (see its API_INTEGRATION.md):
// ECDSA P-256 / SHA-256 over a canonical string, raw r‖s signature, hex.
//
// Required env:
//   SHORT_URL_BASE_URL     e.g. https://0-2.ca
//   SHORT_URL_OWNER        16–128 chars [A-Za-z0-9_-]  (randomBytes(16).hex)
//   SHORT_URL_PRIVATE_KEY  PKCS8 PEM of a prime256v1 EC private key
// Optional:
//   SHORT_URL_CODE         force a specific custom code instead of a random one
// Generate the owner + key once with: node scripts/shorturl-keygen.mjs

import { createHash, createPrivateKey, createPublicKey, sign } from 'crypto';

const SIGNATURE_VERSION = 'short-url-auth-v1';

export function shortUrlConfig() {
  const base = process.env.SHORT_URL_BASE_URL?.replace(/\/+$/, '');
  const owner = process.env.SHORT_URL_OWNER;
  // Accept the PEM with real newlines or escaped "\n" (how it's often pasted into env settings).
  const privateKeyPem = process.env.SHORT_URL_PRIVATE_KEY?.replace(/\\n/g, '\n');
  // Optional: pin a custom code. Omitted => short_url generates a random one on first use.
  const forcedCode = process.env.SHORT_URL_CODE?.trim() || undefined;
  if (!base || !owner || !privateKeyPem) return null;
  return { base, owner, privateKeyPem, forcedCode };
}

export function isShortUrlConfigured(): boolean {
  return shortUrlConfig() !== null;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Signs and sends a request. `body` is a JSON object, or raw bytes (uploads); the
// signature covers exactly what is sent.
export async function signedFetch(
  method: Method,
  path: string,
  body?: object | Uint8Array,
  headers: Record<string, string> = {}
): Promise<Response> {
  const cfg = shortUrlConfig();
  if (!cfg) throw new Error('short_url is not configured (SHORT_URL_BASE_URL, SHORT_URL_OWNER, SHORT_URL_PRIVATE_KEY)');
  const privateKey = createPrivateKey(cfg.privateKeyPem);
  const publicKeyHex = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('hex');
  const raw: string | Uint8Array = body === undefined ? '' : body instanceof Uint8Array ? body : JSON.stringify(body);
  const timestamp = String(Date.now());
  const bodyHash = createHash('sha256').update(raw).digest('hex');
  const message = [SIGNATURE_VERSION, method, path, timestamp, bodyHash].join('\n');
  const signature = sign('sha256', Buffer.from(message, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return fetch(`${cfg.base}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      ...(body instanceof Uint8Array ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
      'X-Owner': cfg.owner,
      'X-Owner-Key': publicKeyHex,
      'X-Owner-Timestamp': timestamp,
      'X-Owner-Signature': signature.toString('hex'),
    },
    body: raw === '' ? undefined : (raw as BodyInit),
  });
}
