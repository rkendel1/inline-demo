# inline-demo

Host product demos, turn each one into a **moving preview GIF + a repointable
email-signature chip**, and track how many clicks turn into views.

It pairs with [`short_url`](https://github.com/rkendel1/short_url) for link management:
`short_url` gives you a stable, editable short link; `inline-demo` hosts the demo, plays
it, makes the preview GIF, and generates the signature HTML. You can also skip `short_url`
and use this app's own repointable `/go/<slot>` link.

---

## What it does

1. **Add a demo** — upload a video, or paste any demo URL (a `short_url` link, a hosted web
   demo, a Loom, etc.).
2. **Auto-generate a preview GIF** — on video upload, ffmpeg makes a short looping GIF. That
   moving GIF is what goes in the signature chip, so it catches the eye and earns the click.
3. **Get the signature snippet** — email-safe HTML (table + inline styles) you paste into
   Gmail / Outlook / Apple Mail. The chip is a clickable thumbnail with a caption.
4. **Repoint anytime** — the signature links to `/go/signature`, a stable slot. Change which
   demo that slot points to and every signature already in the wild now shows the new demo.
   The pasted HTML never has to change.
5. **See what's working** — transparent, first-party counters: signature **clicks** and demo
   **plays**. No recipient fingerprinting.

## An honest note on "autoplay inside the inbox, invisible, unblockable"

That specific behavior isn't buildable, and chasing it backfires. Email clients
deliberately strip `<script>`, `<video>` and most interactivity, proxy or block remote
images, and freeze GIFs in Outlook. There is no supported way to auto-play a demo inside
the message body, and anything engineered to be covert/undetectable is exactly what trips
spam and image-blocking filters — which *lowers* your opens.

So this tool does the version that actually performs: a visible, lively GIF chip that plays
the real demo the instant someone clicks through to the landing page (where browsers *do*
allow muted autoplay). Clear beats covert for deliverability.

---

## Run it locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Zero config: demos are stored in `.data/demos.json`, uploads in `public/uploads/`, and
preview GIFs are generated with your local ffmpeg. Add a demo, upload a video, watch the
GIF generate, click **Make live**, copy the signature.

> Requires **ffmpeg** on your PATH for GIF generation (`brew install ffmpeg` /
> `apt install ffmpeg`). Without it you can still set a chip image manually.

## Wiring it into `short_url`

Point the signature at a managed short link (e.g. `0-2.ca/demo`) so link management lives
in `short_url` — editable destination, revision history, analytics, QR. When set, each time
you make a demo live, inline-demo **repoints that short link** to the new demo's landing
page; the pasted signature (which uses the short link) never changes.

```bash
node scripts/shorturl-keygen.mjs   # prints SHORT_URL_OWNER + SHORT_URL_PRIVATE_KEY + code
# paste the output into .env.local
```

The integration uses `short_url`'s documented signed-request scheme (ECDSA P-256 /
SHA-256). The first time you set a demo live, your key claims `SHORT_URL_CODE` via
trust-on-first-use; keep the private key secret and backed up — it's the only thing that
can edit that link afterward. Without these env vars, the signature falls back to this
app's own `/go/signature` link, which is repointed internally instead.

## Configuration

Copy `.env.example` to `.env.local`:

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Public URL of this app once deployed. Used to build signature + demo links. |
| `ADMIN_TOKEN` | Shared secret protecting the dashboard and write APIs. **Set this in production.** |
| `BLOB_READ_WRITE_TOKEN` | Optional. If set, uploads go to Vercel Blob instead of the local filesystem (`npm i @vercel/blob`). |
| `SHORT_URL_BASE_URL` / `SHORT_URL_OWNER` / `SHORT_URL_CODE` / `SHORT_URL_PRIVATE_KEY` | Optional. Wire the signature to a managed `short_url` link (see above). |

## Deploying

Works on Vercel (`vercel.json` sets the framework). Two things to know:

- **Storage.** The filesystem store and `public/uploads` are fine locally but *ephemeral*
  on serverless. For production, set `BLOB_READ_WRITE_TOKEN` for uploads, and move the demo
  registry in `lib/store.ts` to a real KV/DB (Vercel KV, or mirror `short_url`'s Postgres).
- **ffmpeg.** Vercel's default runtime has no ffmpeg, so `/api/preview` returns 501 there.
  Generate previews where ffmpeg exists — run `scripts/make-preview.sh` locally and upload
  the resulting `preview.gif` as the chip image, or do it on a build step / container.

```bash
# Generate a preview GIF + poster locally:
scripts/make-preview.sh demo.mp4 ./out 2 4 320 12
#                        input    out  start len width fps
```

## How the pieces fit

```
  Email signature (pasted once)
        │  clickable GIF chip, links to…
        ▼
  /go/signature        ← repointable slot (the "manage the link" layer)
        │  307 redirect, never cached
        ▼
  /demo/<id>           ← landing page: muted-autoplay video OR embedded demo
        │  fires a transparent play beacon
        ▼
  /api/track/<id>      ← play counter
```

## Project layout

```
app/
  page.tsx                 Admin dashboard (add / preview / set-live / stats / copy signature)
  demo/[id]/page.tsx       Public demo landing page (the demo "grows" and plays here)
  go/[slot]/route.ts       Repointable redirect — the stable link your signature uses
  api/demos/route.ts       List / create demos
  api/demos/[id]/route.ts  Get / update (repoint src) / delete
  api/upload/route.ts      Upload a video or image asset
  api/preview/route.ts     ffmpeg → looping preview GIF + poster
  api/live/route.ts        Get / set which demo a slot points to
  api/track/[id]/route.ts  Transparent play counter
lib/
  store.ts    Demo registry + slots (filesystem JSON by default)
  blob.ts     Asset storage (filesystem default, Vercel Blob optional)
  gif.ts      ffmpeg preview-GIF generation
  signature.ts  Email-safe signature HTML builder
  shorturl.ts   Optional short_url integration (signed create/repoint)
  auth.ts     Shared-secret gate
components/
  Dashboard.tsx   The admin UI
  DemoPlayer.tsx  Landing-page player/embed + play beacon
scripts/
  make-preview.sh      Generate preview GIF/poster locally with ffmpeg
  shorturl-keygen.mjs  One-time owner id + P-256 key for the short_url integration
```
