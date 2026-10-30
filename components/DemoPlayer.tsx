'use client';

import { useEffect, useRef } from 'react';
import type { DemoKind } from '@/lib/types';

// Plays a hosted video (muted autoplay, allowed in browsers) or embeds an external demo
// URL in an iframe. Fires a one-time transparent "play" beacon so you can see how many
// clicks turned into actual views.
export default function DemoPlayer({
  id,
  kind,
  src,
  poster,
}: {
  id: string;
  kind: DemoKind;
  src: string;
  poster?: string;
}) {
  const fired = useRef(false);

  function trackPlay() {
    if (fired.current) return;
    fired.current = true;
    navigator.sendBeacon?.(`/api/track/${id}`) ||
      fetch(`/api/track/${id}`, { method: 'POST', keepalive: true }).catch(() => {});
  }

  useEffect(() => {
    if (kind === 'embed') trackPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const frame = {
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid var(--border)',
    background: '#000',
    aspectRatio: '16 / 9',
    width: '100%',
  } as const;

  if (kind === 'video') {
    return (
      <div style={frame}>
        <video
          src={src}
          poster={poster}
          controls
          autoPlay
          muted
          playsInline
          loop
          onPlay={trackPlay}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', background: '#000' }}
        />
      </div>
    );
  }

  return (
    <div style={frame}>
      <iframe
        src={src}
        allow="autoplay; fullscreen; clipboard-write; encrypted-media"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    </div>
  );
}
