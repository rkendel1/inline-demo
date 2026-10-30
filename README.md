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

Point the signature at a managed short link so link management lives in `short_url` —
editable destination, revision history, analytics, QR. On the first **Make live**,
`short_url` **generates a random code** (e.g. `0-2.ca/otter0427`), just like any other
short_url link; inline-demo remembers it and **repoints that same link** to the new demo on
later changes. The pasted signature (which uses the short link) never changes.

```bash
node scripts/shorturl-keygen.mjs   # prints SHORT_URL_OWNER + SHORT_URL_PRIVATE_KEY
# paste the output into .env.local
```

The integration uses `short_url`'s documented signed-request scheme (ECDSA P-256 /
SHA-256). The first time you set a demo live, your key claims the generated code via
trust-on-first-use; keep the private key secret and backed up — it's the only thing that
can edit that link afterward. Set `SHORT_URL_CODE` to force a specific code instead of a
random one. Without these env vars, the signature falls back to this app's own
`/go/signature` link, which is repointed internally instead.

## Configuration

Copy `.env.example` to `.env.local`:

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Public URL of this app once deployed. Used to build signature + demo links. Defaults to the Vercel production domain on Vercel; set it for a custom domain. |
| `ADMIN_TOKEN` | Shared secret protecting the dashboard and write APIs. **Set this in production.** |
| `BLOB_READ_WRITE_TOKEN` | Optional. If set, uploads go to Vercel Blob instead of short_url's database (`npm i @vercel/blob`). |
| `SHORT_URL_BASE_URL` / `SHORT_URL_OWNER` / `SHORT_URL_PRIVATE_KEY` | Wire the signature to a managed `short_url` link (random code; see above) **and** store everything in short_url's database. Unset = local files (dev only). `SHORT_URL_CODE` optionally forces a specific code. |

## Storage (durable links)

inline-demo has **no database of its own**. In production everything — demos, the live
slot, the managed short link, and uploaded videos/GIFs/posters — is stored in
**short_url's** database (its existing Neon Postgres), under your `SHORT_URL_OWNER`, through
short_url's signed `/api/inline-demo/*` API. The tables and their migration live in the
short_url repo and are applied by short_url's own deploy (`web/scripts/deploy-db.sh`, run by
its `npm run build`).

Backends, chosen automatically:

- **short_url configured** (`SHORT_URL_BASE_URL` + `SHORT_URL_OWNER` +
  `SHORT_URL_PRIVATE_KEY`) → stored in short_url. Durable across restarts and redeploys.
- **Not configured** → a local `.data/demos.json` + `.data/uploads/`. Zero setup, great for
  dev, ephemeral on serverless.

**Moving local data over:** copy this app's `.data/` folder into the short_url deployment
(e.g. `short_url/web/inline-demo-data/`) and set `INLINE_DEMO_IMPORT=inline-demo-data/demos.json`
and `INLINE_DEMO_OWNER=<your SHORT_URL_OWNER>` on short_url. Its next deploy imports demos,
slots, the short link and media (insert-only, so later deploys never overwrite live edits).

## Deploying

Works on Vercel (`vercel.json` sets the framework). Set these in the project:

- **`SHORT_URL_BASE_URL` / `SHORT_URL_OWNER` / `SHORT_URL_PRIVATE_KEY`** — generate the
  owner + key once with `node scripts/shorturl-keygen.mjs`. These are what make storage
  durable; there is no `DATABASE_URL` to set here. Deploy short_url first so its
  `/api/inline-demo` tables exist.
- **Media** is stored most-durable-first: `BLOB_READ_WRITE_TOKEN` → Vercel Blob (best for
  large videos; `npm i @vercel/blob`); else short_url's database, served through this app's
  `/uploads/<name>` route (proxied, with Range so video seeks); else the local filesystem.
  Note Vercel caps request bodies at ~4.5 MB, so use a Blob token for larger videos.
- **ffmpeg** — Vercel's default runtime has no ffmpeg, so `/api/preview` returns 501 there.
  Generate previews where ffmpeg exists: run `scripts/make-preview.sh` locally and upload
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
  store.ts         Backend dispatcher (short_url if configured, else filesystem)
  store-shorturl.ts  Durable backend: short_url's database via its signed API
  store-fs.ts      Local filesystem backend (.data/demos.json)
  blob.ts     Asset storage (Vercel Blob → short_url → filesystem)
  gif.ts      ffmpeg preview-GIF generation
  signature.ts  Email-safe signature HTML builder
  shorturl.ts   short_url link management (create/repoint the signature link)
  shorturl-api.ts  short_url config + signed requests
  auth.ts     Shared-secret gate
components/
  Dashboard.tsx   The admin UI
  DemoPlayer.tsx  Landing-page player/embed + play beacon
scripts/
  make-preview.sh      Generate preview GIF/poster locally with ffmpeg
  shorturl-keygen.mjs  One-time owner id + P-256 key for the short_url integration
```
