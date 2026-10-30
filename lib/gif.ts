// Generate a short, looping, optimized preview GIF (and a poster JPG) from a video,
// using ffmpeg. The GIF is what goes in the signature chip so it *moves* and earns the
// click. ffmpeg can read a local path or a remote http(s) URL as input.
//
// Requirements: ffmpeg on PATH. This works on your machine and on any host where you can
// install ffmpeg. On Vercel's default serverless runtime ffmpeg is NOT present, so run
// preview generation where ffmpeg exists:
//   - locally before deploy (recommended for a personal tool), or
//   - via scripts/make-preview.sh, or
//   - a container/VM build step.
// If ffmpeg is missing at runtime, the caller falls back to using the poster frame.

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export interface PreviewOptions {
  start?: number; // seconds into the video to start (default 0)
  seconds?: number; // clip length (default 4)
  width?: number; // output width in px (default 320)
  fps?: number; // frames per second (default 12)
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`));
    });
  });
}

export async function hasFfmpeg(): Promise<boolean> {
  try {
    await run('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

// Produces { gif: Buffer, poster: Buffer }. Uses a two-pass palette for clean colors and
// small size.
export async function makePreview(input: string, opts: PreviewOptions = {}): Promise<{ gif: Buffer; poster: Buffer }> {
  const start = opts.start ?? 0;
  const seconds = opts.seconds ?? 4;
  const width = opts.width ?? 320;
  const fps = opts.fps ?? 12;

  const tmp = path.join(os.tmpdir(), 'inline-demo-' + crypto.randomBytes(4).toString('hex'));
  await fs.mkdir(tmp, { recursive: true });
  const palette = path.join(tmp, 'palette.png');
  const gifPath = path.join(tmp, 'preview.gif');
  const posterPath = path.join(tmp, 'poster.jpg');

  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos`;

  try {
    // Pass 1: palette
    await run('ffmpeg', ['-y', '-ss', String(start), '-t', String(seconds), '-i', input, '-vf', `${vf},palettegen=stats_mode=diff`, palette]);
    // Pass 2: GIF using palette
    await run('ffmpeg', ['-y', '-ss', String(start), '-t', String(seconds), '-i', input, '-i', palette, '-lavfi', `${vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3`, '-loop', '0', gifPath]);
    // Poster: single frame at start
    await run('ffmpeg', ['-y', '-ss', String(start), '-i', input, '-frames:v', '1', '-vf', `scale=${width}:-1:flags=lanczos`, '-q:v', '3', posterPath]);

    const [gif, poster] = await Promise.all([fs.readFile(gifPath), fs.readFile(posterPath)]);
    return { gif, poster };
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
