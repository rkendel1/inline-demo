// Minimal shared-secret gate for the admin dashboard and write APIs.
// If ADMIN_TOKEN is unset, everything is open — acceptable for local dev only.
// In production, set ADMIN_TOKEN and the admin page will prompt for it (stored in
// the browser) and send it as a Bearer token on write requests.

import { NextRequest } from 'next/server';

export function adminTokenRequired(): string | null {
  return process.env.ADMIN_TOKEN || null;
}

export function isAuthorized(request: NextRequest): boolean {
  const required = adminTokenRequired();
  if (!required) return true; // open in dev
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token === required;
}
