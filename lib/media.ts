// Turns common share links into what each place needs. Pure functions — safe in the
// browser (dashboard) and on the server.
//   - embedUrl:   the frameable player URL. Share links like youtu.be/… refuse to load in
//                 an iframe; their /embed/ form doesn't.
//   - autoPoster: a real image to use as the signature chip when no poster was set.

function parse(src: string): URL | null {
  try {
    return new URL(src);
  } catch {
    return null;
  }
}

export function youTubeId(src: string): string | null {
  const u = parse(src);
  if (!u) return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] || null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname);
      id = m ? m[1] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

export function embedUrl(src: string): string {
  const yt = youTubeId(src);
  if (yt) return `https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&playsinline=1&rel=0`;

  const u = parse(src);
  if (!u) return src;
  const host = u.hostname.replace(/^www\./, '');
  const vimeo = host === 'vimeo.com' && /^\/(\d+)/.exec(u.pathname);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1`;
  const loom = host === 'loom.com' && /^\/share\/([^/?#]+)/.exec(u.pathname);
  if (loom) return `https://www.loom.com/embed/${loom[1]}?autoplay=1`;
  return src;
}

export function autoPoster(src: string): string | undefined {
  const yt = youTubeId(src);
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : undefined;
}
