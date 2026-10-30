// Store facade. Picks the backend once:
//   - short_url configured -> stored in short_url's database via its signed API
//                             (durable; production). Links never break.
//   - otherwise            -> filesystem JSON under .data/ (zero-setup local dev).
//
// All functions keep the same signatures, so the API routes don't need to know which
// backend is active.

import type { Demo } from './types';
import { isShortUrlConfigured } from './shorturl-api';
export { newId } from './id';

type Backend = typeof import('./store-fs');

let backendPromise: Promise<Backend> | null = null;

function backend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = isShortUrlConfigured() ? import('./store-shorturl') : import('./store-fs');
  }
  return backendPromise;
}

export async function listDemos(): Promise<Demo[]> {
  return (await backend()).listDemos();
}
export async function getDemo(id: string): Promise<Demo | null> {
  return (await backend()).getDemo(id);
}
export async function createDemo(input: {
  title: string;
  kind: Demo['kind'];
  src: string;
  poster?: string;
  caption?: string;
}): Promise<Demo> {
  return (await backend()).createDemo(input);
}
export async function updateDemo(
  id: string,
  patch: Partial<Pick<Demo, 'title' | 'kind' | 'src' | 'poster' | 'caption'>>
): Promise<Demo | null> {
  return (await backend()).updateDemo(id, patch);
}
export async function deleteDemo(id: string): Promise<boolean> {
  return (await backend()).deleteDemo(id);
}
export async function bump(id: string, field: 'clicks' | 'plays'): Promise<void> {
  return (await backend()).bump(id, field);
}
export async function getSlots(): Promise<Record<string, string>> {
  return (await backend()).getSlots();
}
export async function resolveSlot(slot: string): Promise<Demo | null> {
  return (await backend()).resolveSlot(slot);
}
export async function setSlot(slot: string, demoId: string): Promise<boolean> {
  return (await backend()).setSlot(slot, demoId);
}
export async function getShortUrlMeta(): Promise<{ code?: string; shortUrl?: string }> {
  return (await backend()).getShortUrlMeta();
}
export async function setShortUrlMeta(meta: { code: string; shortUrl: string }): Promise<void> {
  return (await backend()).setShortUrlMeta(meta);
}
