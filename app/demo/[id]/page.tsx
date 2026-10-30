import { getDemo } from '@/lib/store';
import { notFound } from 'next/navigation';
import DemoPlayer from '@/components/DemoPlayer';

// The landing page the chip links to. This is where the demo actually "grows" and plays.
// In the browser, muted autoplay is allowed — so a video demo starts on its own here,
// which is the behavior that isn't possible inside the email body itself.
export default async function DemoPage({ params }: { params: { id: string } }) {
  const demo = await getDemo(params.id);
  if (!demo) notFound();

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 820 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 6 }}>{demo.title}</h1>
        {demo.caption ? (
          <p className="sub" style={{ textAlign: 'center' }}>{demo.caption}</p>
        ) : null}
        <DemoPlayer id={demo.id} kind={demo.kind} src={demo.src} poster={demo.poster} />
      </div>
    </main>
  );
}
