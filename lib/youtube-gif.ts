// Server-side: builds the animated chip GIF for a YouTube demo from the video's
// auto-generated stills (YouTube publishes frames from ~25/50/75% of the video), with
// crossfades and a play button. Pure JS, so it runs on Vercel.

import jpeg from 'jpeg-js';
import { slideshowGif, type Rgba } from './gif-frames';
import { youTubeId } from './media';

export const CHIP_WIDTH = 320;
export const CHIP_HEIGHT = 180; // 16:9

async function fetchJpeg(url: string): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('image/jpeg')) return null;
    return jpeg.decode(Buffer.from(await res.arrayBuffer()), { useTArray: true, formatAsRGBA: true });
  } catch {
    return null;
  }
}

// YouTube's 4:3 stills letterbox 16:9 videos: crop to 16:9 and scale to the chip size
// (bilinear, so text in screen recordings stays legible).
function cropScale(img: { data: Uint8Array; width: number; height: number }): Rgba {
  const srcH = Math.min(img.height, Math.round((img.width * 9) / 16));
  const top = Math.floor((img.height - srcH) / 2);
  const out = new Uint8ClampedArray(CHIP_WIDTH * CHIP_HEIGHT * 4);
  const sx = img.width / CHIP_WIDTH;
  const sy = srcH / CHIP_HEIGHT;
  for (let y = 0; y < CHIP_HEIGHT; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5);
    const y0 = Math.min(Math.floor(fy), srcH - 1);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const wy = fy - y0;
    for (let x = 0; x < CHIP_WIDTH; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5);
      const x0 = Math.min(Math.floor(fx), img.width - 1);
      const x1 = Math.min(x0 + 1, img.width - 1);
      const wx = fx - x0;
      const o = (y * CHIP_WIDTH + x) * 4;
      for (let k = 0; k < 3; k++) {
        const p = (yy: number, xx: number) => img.data[((top + yy) * img.width + xx) * 4 + k];
        out[o + k] = (p(y0, x0) * (1 - wx) + p(y0, x1) * wx) * (1 - wy) + (p(y1, x0) * (1 - wx) + p(y1, x1) * wx) * wy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

// The animated GIF bytes, or null if this isn't a YouTube link or no stills could be read.
export async function youTubeChipGif(src: string): Promise<Uint8Array | null> {
  const id = youTubeId(src);
  if (!id) return null;
  const base = `https://i.ytimg.com/vi/${id}`;
  let stills = (await Promise.all(['hq1', 'hq2', 'hq3'].map((n) => fetchJpeg(`${base}/${n}.jpg`)))).filter(
    (x): x is NonNullable<typeof x> => x !== null
  );
  if (stills.length === 0) {
    const cover = (await fetchJpeg(`${base}/hqdefault.jpg`)) ?? (await fetchJpeg(`${base}/mqdefault.jpg`));
    stills = cover ? [cover] : [];
  }
  if (stills.length === 0) return null;
  return slideshowGif(stills.map(cropScale), CHIP_WIDTH, CHIP_HEIGHT);
}
