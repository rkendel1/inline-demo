'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Demo } from '@/lib/types';
import { buildSignatureHtml } from '@/lib/signature';
import { autoPoster } from '@/lib/media';

const SLOT = 'signature'; // the single repointable slot this UI manages

export default function Dashboard({
  baseUrl,
  needsToken,
  shortUrl,
}: {
  baseUrl: string;
  needsToken: boolean;
  shortUrl?: string | null;
}) {
  const [token, setToken] = useState('');
  const [demos, setDemos] = useState<Demo[]>([]);
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [resolvedShortUrl, setResolvedShortUrl] = useState<string | null>(shortUrl ?? null);
  const [shortConfigured, setShortConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'video' | 'embed'>('video');
  const [src, setSrc] = useState('');
  const [poster, setPoster] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (needsToken) setToken(localStorage.getItem('inline-demo-token') || '');
  }, [needsToken]);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, s] = await Promise.all([
      fetch('/api/demos').then((r) => r.json()),
      fetch('/api/live').then((r) => r.json()),
    ]);
    setDemos(d.demos || []);
    setSlots(s.slots || {});
    setResolvedShortUrl(s.shortUrl ?? null);
    setShortConfigured(!!s.shortUrlConfigured);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function saveToken() {
    localStorage.setItem('inline-demo-token', token);
    setMsg('Token saved.');
  }

  async function uploadFile(file: File, label: string): Promise<string | null> {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    const j = await r.json();
    if (!r.ok) {
      setMsg(`${label} upload failed: ${j.error || r.status}`);
      return null;
    }
    return j.url as string;
  }

  async function onVideoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg('Uploading video…');
    const url = await uploadFile(file, 'Video');
    if (url) {
      setSrc(url);
      setMsg('Video uploaded. Generating preview GIF…');
      await generatePreview(url);
    }
    setBusy(false);
  }

  async function onPosterPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = await uploadFile(file, 'Image');
    if (url) setPoster(url);
    setBusy(false);
  }

  async function generatePreview(videoSrc?: string) {
    const input = (videoSrc ?? src).trim();
    if (!input) {
      setMsg('Add a video first.');
      return;
    }
    setBusy(true);
    setMsg('Generating preview GIF…');
    const r = await fetch('/api/preview', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ src: input, seconds: 4, width: 320, fps: 12 }),
    });
    const j = await r.json();
    if (!r.ok) {
      setMsg(j.error || 'Preview generation failed.');
    } else {
      setPoster(j.gifUrl); // the moving GIF becomes the chip image
      setMsg('Preview GIF ready — it will be used as the signature chip image.');
    }
    setBusy(false);
  }

  async function createDemo() {
    if (!title.trim() || !src.trim()) {
      setMsg('Title and a video/link are required.');
      return;
    }
    setBusy(true);
    const r = await fetch('/api/demos', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title, kind, src, poster: poster || undefined, caption: caption || undefined }),
    });
    const j = await r.json();
    if (!r.ok) {
      setMsg(j.error || 'Create failed.');
    } else {
      setMsg('Demo added.');
      setTitle(''); setSrc(''); setPoster(''); setCaption('');
      await load();
    }
    setBusy(false);
  }

  async function setLive(demoId: string) {
    setBusy(true);
    const r = await fetch('/api/live', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ slot: SLOT, demoId }),
    });
    const j = await r.json();
    if (!r.ok) setMsg(j.error || 'Could not set live.');
    else {
      if (j.shortUrlError) setMsg(`Live demo updated locally, but short_url repoint failed: ${j.shortUrlError}`);
      else if (j.shortUrl) setMsg(`Live demo updated. Short link ${j.shortUrl} now points to it.`);
      else setMsg('Live demo updated. Your signature now points here.');
      await load();
    }
    setBusy(false);
  }

  async function remove(demoId: string) {
    if (!confirm('Delete this demo?')) return;
    setBusy(true);
    const r = await fetch(`/api/demos/${demoId}`, { method: 'DELETE', headers: authHeaders });
    if (!r.ok) { const j = await r.json(); setMsg(j.error || 'Delete failed.'); }
    else await load();
    setBusy(false);
  }

  const liveId = slots[SLOT];
  const liveDemo = demos.find((d) => d.id === liveId);
  // When short_url has created the managed link, the signature points at it (short_url
  // generates the code). Until then — or when short_url isn't wired in — it points at this
  // app's own repointable /go/<slot> link.
  const goUrl = resolvedShortUrl || `${baseUrl}/go/${SLOT}`;

  // Signature points at the repointable /go/signature link, and shows the live demo's
  // GIF/poster as the chip image.
  // The demo's poster/GIF, else a thumbnail derived from its link (e.g. YouTube), else none.
  function chipImage(d: Demo): string | undefined {
    const img = d.poster || autoPoster(d.src);
    return img && img.startsWith('/') ? baseUrl + img : img;
  }

  const signatureHtml = liveDemo
    ? buildSignatureHtml({
        href: goUrl,
        imageUrl: chipImage(liveDemo),
        title: liveDemo.title,
        subtitle: liveDemo.caption || 'See it in action →',
      })
    : '';

  return (
    <div className="wrap">
      <h1>inline-demo</h1>
      <p className="sub">Host a demo, generate a preview GIF, and get a repointable email-signature chip. Repoint it anytime without changing your signature.</p>

      {needsToken && (
        <div className="panel">
          <h2>Admin token</h2>
          <div className="row">
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" />
            <button className="ghost" onClick={saveToken}>Save</button>
          </div>
          <p className="muted">Stored in this browser and sent as a Bearer token on write actions.</p>
        </div>
      )}

      {msg && <div className="panel" style={{ borderColor: 'var(--accent)' }}>{msg}</div>}

      <div className="panel">
        <h2>Add a demo</h2>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Watch the 45-sec demo" />

        <div className="grid">
          <div>
            <label>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="video">Hosted video (mp4/webm)</option>
              <option value="embed">External link / web demo (iframe)</option>
            </select>
          </div>
          <div>
            <label>Caption (optional)</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="See it in action →" />
          </div>
        </div>

        {kind === 'video' ? (
          <>
            <label>Upload video (auto-generates the preview GIF)</label>
            <input type="file" accept="video/*" onChange={onVideoPicked} disabled={busy} />
            <label>…or paste a video URL</label>
            <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="https://…/demo.mp4 or /uploads/…mp4" />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="ghost" onClick={() => generatePreview()} disabled={busy || !src}>Generate preview GIF</button>
            </div>
          </>
        ) : (
          <>
            <label>Demo link (short_url link, hosted web demo, Loom, etc.)</label>
            <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="https://0-2.ca/abc123" />
          </>
        )}

        <label>Chip image (GIF/poster) — auto-filled after preview, or upload your own</label>
        <input type="file" accept="image/*" onChange={onPosterPicked} disabled={busy} />
        <input value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="/uploads/preview.gif or https://…" />
        {poster && (
          <img src={poster.startsWith('/') ? baseUrl + poster : poster} alt="preview" style={{ marginTop: 10, maxWidth: 240, borderRadius: 8, border: '1px solid var(--border)' }} />
        )}

        <hr className="hr" />
        <button onClick={createDemo} disabled={busy}>Add demo</button>
      </div>

      <div className="panel">
        <h2>Your signature snippet</h2>
        {liveDemo ? (
          <>
            <p className="muted">
              Links to <code>{goUrl}</code>{resolvedShortUrl ? ' (managed in short_url)' : shortConfigured ? ' (short_url link is created on first “Make live”)' : ' (repointable slot)'} → currently <b>{liveDemo.title}</b>. Click <b>Copy signature</b>, then paste into Gmail / Outlook / Apple Mail signature settings — it pastes as the chip below, not as code.
            </p>
            <div className="sig-preview" dangerouslySetInnerHTML={{ __html: signatureHtml }} />
            <div className="row" style={{ marginTop: 10 }}>
              <CopySignature html={signatureHtml} plain={`${liveDemo.title}: ${goUrl}`} />
            </div>
            <details style={{ marginTop: 12 }}>
              <summary className="muted">HTML source (only for tools that take raw HTML)</summary>
              <pre className="snippet">{signatureHtml}</pre>
              <CopySource text={signatureHtml} />
            </details>
          </>
        ) : (
          <p className="muted">Mark a demo as <b>Live</b> below to generate your signature.</p>
        )}
      </div>

      <div className="panel">
        <h2>Demos {loading ? '…' : `(${demos.length})`}</h2>
        {demos.length === 0 && !loading && <p className="muted">None yet.</p>}
        {demos.map((d) => {
          const isLive = d.id === liveId;
          const img = chipImage(d);
          return (
            <div key={d.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
              <div className="demo-card">
                {img ? <img className="demo-thumb" src={img} alt="" /> : <div className="demo-thumb" />}
                <div className="demo-meta">
                  <div className="demo-title">
                    {d.title} {isLive && <span className="badge live">LIVE</span>} <span className="badge">{d.kind}</span>
                  </div>
                  <div className="demo-src">{d.src}</div>
                  <div className="muted stat" style={{ marginTop: 6 }}>
                    {d.clicks} clicks · {d.plays} plays · <a href={`${baseUrl}/demo/${d.id}`} target="_blank" rel="noopener">open landing ↗</a>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    {!isLive && <button onClick={() => setLive(d.id)} disabled={busy}>Make live</button>}
                    <button className="danger" onClick={() => remove(d.id)} disabled={busy}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Signature editors (Gmail, Outlook, Apple Mail) take rich content, not HTML source: put
// the rendered chip on the clipboard as text/html so it pastes as the chip itself.
function CopySignature({ html, plain }: { html: string; plain: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      // Older browsers: copy a rendered selection the classic way (still rich).
      const holder = document.createElement('div');
      holder.innerHTML = html;
      holder.style.position = 'fixed';
      holder.style.left = '-9999px';
      document.body.appendChild(holder);
      const range = document.createRange();
      range.selectNodeContents(holder);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand('copy');
      sel?.removeAllRanges();
      holder.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return <button onClick={copy}>{copied ? 'Copied — now paste into your signature' : 'Copy signature'}</button>;
}

function CopySource({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied!' : 'Copy HTML source'}
    </button>
  );
}
