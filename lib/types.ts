// A single demo you can link to from your signature.
export type DemoKind = 'video' | 'embed';

export interface Demo {
  id: string;
  title: string;
  kind: DemoKind;
  // For kind='video': a URL to a playable video file (mp4/webm), hosted here or elsewhere.
  // For kind='embed': any external demo URL (a short_url link, a hosted web demo, a Loom, etc.).
  src: string;
  // Optional poster/thumbnail image URL shown in the signature chip and before play.
  poster?: string;
  // One-line caption shown under the demo on its landing page.
  caption?: string;
  clicks: number; // signature clicks that reached the landing page
  plays: number; // demo actually started playing / opened
  created: number;
  updated?: number;
}

// A "slot" is a stable name your signature points at (e.g. "signature").
// You repoint it to whichever demo is live. The signature HTML never changes.
export interface Slots {
  [slot: string]: string; // slot name -> demo id
}

// The managed short_url link, once short_url has generated it (random code, like any
// other short_url link). Remembered so later "set live" actions repoint this same link.
export interface ShortUrlMeta {
  code?: string;
  shortUrl?: string;
}

export interface StoreData {
  demos: Record<string, Demo>;
  slots: Slots;
  shortUrl?: ShortUrlMeta;
}
