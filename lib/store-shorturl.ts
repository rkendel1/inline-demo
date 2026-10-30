// short_url store — the durable production backend. Demos, slots and the managed short
// link are kept in short_url's database (under SHORT_URL_OWNER) through its signed
// /api/inline-demo API; inline-demo has no database of its own. Same function surface as
// store-fs.ts so the routes don't care which one is active.

import type { Demo } from './types';
import { signedFetch } from './shorturl-api';

const API = '/api/inline-demo';

async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: object): Promise<T | null> {
  const res = await signedFetch(method, `${API}${path}`, body);
  if (res.status === 404) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`short_url ${method} ${path} failed (${res.status}): ${json.error || 'unknown'}`);
  return json as T;
}

const seg = encodeURIComponent;

export async function listDemos(): Promise<Demo[]> {
  return (await call<{ demos: Demo[] }>('GET', '/demos'))?.demos ?? [];
}

export async function getDemo(id: string): Promise<Demo | null> {
  return (await call<{ demo: Demo }>('GET', `/demos/${seg(id)}`))?.demo ?? null;
}

export async function createDemo(input: {
  title: string;
  kind: Demo['kind'];
  src: string;
  poster?: string;
  caption?: string;
}): Promise<Demo> {
  const created = await call<{ demo: Demo }>('POST', '/demos', input);
  if (!created) throw new Error('short_url did not create the demo');
  return created.demo;
}

export async function updateDemo(
  id: string,
  patch: Partial<Pick<Demo, 'title' | 'kind' | 'src' | 'poster' | 'caption'>>
): Promise<Demo | null> {
  return (await call<{ demo: Demo }>('PATCH', `/demos/${seg(id)}`, patch))?.demo ?? null;
}

export async function deleteDemo(id: string): Promise<boolean> {
  return (await call('DELETE', `/demos/${seg(id)}`)) !== null;
}

export async function bump(id: string, field: 'clicks' | 'plays'): Promise<void> {
  try {
    await call('POST', `/demos/${seg(id)}/bump`, { field });
  } catch {
    // counting is best-effort; never break a page view over it
  }
}

export async function getSlots(): Promise<Record<string, string>> {
  return (await call<{ slots: Record<string, string> }>('GET', '/slots'))?.slots ?? {};
}

export async function resolveSlot(slot: string): Promise<Demo | null> {
  return (await call<{ demo: Demo }>('GET', `/slots/${seg(slot)}`))?.demo ?? null;
}

export async function setSlot(slot: string, demoId: string): Promise<boolean> {
  return (await call('PUT', `/slots/${seg(slot)}`, { demoId })) !== null;
}

export async function getShortUrlMeta(): Promise<{ code?: string; shortUrl?: string }> {
  return (await call<{ code?: string; shortUrl?: string }>('GET', '/short-link')) ?? {};
}

export async function setShortUrlMeta(meta: { code: string; shortUrl: string }): Promise<void> {
  await call('PUT', '/short-link', meta);
}
