// Pure-JS animated GIF building for the signature chip — no ffmpeg, so it works on Vercel
// and in the browser alike. Frames are RGBA buffers of one size.
//
// Every frame gets a play button baked in: email clients can't run a player, so the chip
// has to *look* playable and invite the click.

import { GIFEncoder, applyPalette, quantize } from 'gifenc';

export type Rgba = Uint8Array | Uint8ClampedArray;

export interface Frame {
  rgba: Rgba;
  delay: number; // ms
}

// Translucent dark disc with a white triangle, centered.
export function drawPlayButton(rgba: Rgba, width: number, height: number): void {
  const r = Math.round(Math.min(width, height) * 0.16);
  const cx = width / 2;
  const cy = height / 2;
  // Triangle pointing right, optically centered.
  const tx0 = cx - r * 0.32;
  const tx1 = cx + r * 0.48;
  const th = r * 0.45;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    if (y < 0 || y >= height) continue;
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (x < 0 || x >= width) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      // 1px soft edge on the disc.
      const disc = Math.max(0, Math.min(1, r - d + 0.5));
      if (disc <= 0) continue;
      const i = (y * width + x) * 4;
      const px = x + 0.5;
      const dy = Math.abs(y + 0.5 - cy);
      const inTri = px >= tx0 && px <= tx1 && dy <= th * (1 - (px - tx0) / (tx1 - tx0));
      const alpha = inTri ? disc : disc * 0.6;
      const c = inTri ? 255 : 0;
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(rgba[i + k] * (1 - alpha) + c * alpha);
    }
  }
}

// Linear blend of two frames, for smooth crossfades between stills.
export function blend(a: Rgba, b: Rgba, t: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - t) + b[i] * t;
  return out;
}

export function encodeGif(frames: Frame[], width: number, height: number): Uint8Array {
  const gif = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.rgba, 256);
    gif.writeFrame(applyPalette(f.rgba, palette), width, height, { palette, delay: f.delay, repeat: 0 });
  }
  gif.finish();
  return gif.bytes();
}

// Slideshow GIF from a few stills: hold each, crossfade to the next, loop.
export function slideshowGif(stills: Rgba[], width: number, height: number, holdMs = 900, fadeSteps = 4): Uint8Array {
  const marked = stills.map((s) => {
    const copy = new Uint8ClampedArray(s);
    drawPlayButton(copy, width, height);
    return copy;
  });
  if (marked.length === 1) return encodeGif([{ rgba: marked[0], delay: holdMs }], width, height);
  const frames: Frame[] = [];
  marked.forEach((cur, i) => {
    const next = marked[(i + 1) % marked.length];
    frames.push({ rgba: cur, delay: holdMs });
    for (let s = 1; s <= fadeSteps; s++) frames.push({ rgba: blend(cur, next, s / (fadeSteps + 1)), delay: 60 });
  });
  return encodeGif(frames, width, height);
}
