// Browser-side: builds the animated chip GIF (+ a poster JPEG) from a video by sampling
// frames with <video> + <canvas>. No ffmpeg, so it works on Vercel. The video must be
// same-origin (e.g. /uploads/…) or served with CORS, or the canvas can't be read.

import { drawPlayButton, encodeGif, type Frame } from './gif-frames';

export interface VideoGifOptions {
  start?: number; // seconds (default: 10% in, max 1s)
  seconds?: number; // clip length (default 3)
  fps?: number; // default 8
  width?: number; // default 320
}

function once(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => { el.removeEventListener('error', fail); resolve(); };
    const fail = () => { el.removeEventListener(event, ok); reject(new Error('Could not read the video')); };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener('error', fail, { once: true });
  });
}

export async function videoChipGif(src: string, opts: VideoGifOptions = {}): Promise<{ gif: Blob; poster: Blob }> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = src;
  await once(video, 'loadeddata');

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const fps = opts.fps ?? 8;
  const start = Math.min(opts.start ?? Math.min(1, duration * 0.1), Math.max(0, duration - 0.5));
  const seconds = Math.max(0.5, Math.min(opts.seconds ?? 3, duration - start || 3));
  const width = opts.width ?? 320;
  const height = Math.round((width * (video.videoHeight || 9)) / (video.videoWidth || 16) / 2) * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const frames: Frame[] = [];
  let poster: Blob | null = null;
  const count = Math.max(1, Math.round(seconds * fps));
  for (let i = 0; i < count; i++) {
    video.currentTime = start + i / fps;
    await once(video, 'seeked');
    ctx.drawImage(video, 0, 0, width, height);
    if (!poster) poster = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    const rgba = ctx.getImageData(0, 0, width, height).data;
    drawPlayButton(rgba, width, height);
    frames.push({ rgba, delay: Math.round(1000 / fps) });
  }
  video.removeAttribute('src');
  video.load();

  const bytes = encodeGif(frames, width, height);
  return { gif: new Blob([bytes as BlobPart], { type: 'image/gif' }), poster: poster ?? new Blob([], { type: 'image/jpeg' }) };
}
