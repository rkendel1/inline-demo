// Builds the email-signature snippet.
//
// WHAT THIS IS: a small, clickable demo "chip" — a thumbnail (static image or animated
// GIF) with a caption, linking to a demo landing page where the demo actually plays.
//
// WHY IT'S BUILT THIS WAY (and not "autoplay video, invisible, undetectable"):
//   - Email clients strip <script>, <video>, <iframe> and most interactivity. There is
//     no supported way to auto-play a video inside the message body. An animated GIF is
//     the only thing that moves, and Outlook freezes it to the first frame.
//   - So the chip is a thumbnail that *looks* alive (GIF where supported, poster frame
//     otherwise) and invites a click. The real demo plays on the landing page, where the
//     browser allows muted autoplay.
//   - Everything here is visible and standard. A deliverable, non-covert signature keeps
//     you OUT of spam/clipping filters, which is what actually protects your open rate.
//
// The link target is whatever you pass as `href` — a repointable /go/<slot> link on this
// app, a short_url short link, or a direct demo URL. "Attach any link and it works."

export interface SignatureOptions {
  href: string; // where the chip links (demo landing page, /go/<slot>, or a short link)
  imageUrl: string; // thumbnail/GIF/poster shown in the chip
  title: string; // e.g. "Watch the 45-sec demo"
  subtitle?: string; // e.g. "See it in action →"
  width?: number; // chip image width in px (default 220)
  accent?: string; // accent/border color (default #2563eb)
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Returns HTML suitable for pasting into an email signature editor. Uses table layout and
// inline styles only — the subset email clients actually render consistently.
export function buildSignatureHtml(opts: SignatureOptions): string {
  const width = opts.width ?? 220;
  const accent = opts.accent ?? '#2563eb';
  const href = esc(opts.href);
  const img = esc(opts.imageUrl);
  const title = esc(opts.title);
  const subtitle = opts.subtitle ? esc(opts.subtitle) : '';

  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td style="padding:0;">
      <a href="${href}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:inline-block;">
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${accent};border-radius:10px;overflow:hidden;width:${width}px;">
          <tr>
            <td style="padding:0;line-height:0;">
              <img src="${img}" alt="${title}" width="${width}" style="display:block;width:${width}px;height:auto;border:0;outline:none;" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 10px;background:#ffffff;">
              <div style="font-size:13px;font-weight:bold;color:#111111;line-height:1.2;">${title}</div>
              ${subtitle ? `<div style="font-size:12px;color:${accent};line-height:1.3;margin-top:2px;">${subtitle}</div>` : ''}
            </td>
          </tr>
        </table>
      </a>
    </td>
  </tr>
</table>`;
}
