import Dashboard from '@/components/Dashboard';
import { baseUrl } from '@/lib/base';
import { adminTokenRequired } from '@/lib/auth';
import { shortLink } from '@/lib/shorturl';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <Dashboard baseUrl={baseUrl()} needsToken={!!adminTokenRequired()} shortUrl={shortLink()} />;
}
