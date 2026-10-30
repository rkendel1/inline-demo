// Public base URL of this app, used in links that leave it (short link destinations,
// signature images, landing pages). NEXT_PUBLIC_BASE_URL wins; on Vercel it falls back
// to the project's production domain (then the deployment URL), so links never point at
// localhost in production. localhost is only the local-dev default.
export function baseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  return 'http://localhost:3000';
}
