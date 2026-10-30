#!/usr/bin/env node
// Ingest existing demos into Postgres via Prisma. Two uses:
//   1. Migrate a local filesystem store (.data/demos.json) into the database when you
//      switch from local dev to a deployed Postgres — so nothing you built locally is lost.
//   2. Seed/restore from a JSON backup.
//
// Idempotent: upserts by id, so running it twice is safe.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/ingest.mjs [path-to-demos.json]
// Default path: .data/demos.json
import { readFileSync, existsSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const file = process.argv[2] || '.data/demos.json';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Point it at your Postgres database first.');
  process.exit(1);
}
if (!existsSync(file)) {
  console.log(`No data file at ${file} — nothing to ingest. (This is fine on a fresh deploy.)`);
  process.exit(0);
}

const data = JSON.parse(readFileSync(file, 'utf8'));
const demos = Object.values(data.demos || {});
const slots = data.slots || {};
const shortUrl = data.shortUrl;

const prisma = new PrismaClient();

try {
  let d = 0;
  for (const demo of demos) {
    await prisma.demo.upsert({
      where: { id: demo.id },
      create: {
        id: demo.id,
        title: demo.title,
        kind: demo.kind,
        src: demo.src,
        poster: demo.poster ?? null,
        caption: demo.caption ?? null,
        clicks: demo.clicks ?? 0,
        plays: demo.plays ?? 0,
        created: BigInt(demo.created ?? Date.now()),
        updated: demo.updated == null ? null : BigInt(demo.updated),
      },
      update: {
        title: demo.title,
        kind: demo.kind,
        src: demo.src,
        poster: demo.poster ?? null,
        caption: demo.caption ?? null,
        clicks: demo.clicks ?? 0,
        plays: demo.plays ?? 0,
      },
    });
    d++;
  }

  let s = 0;
  for (const [name, demoId] of Object.entries(slots)) {
    await prisma.slot.upsert({
      where: { name },
      create: { name, demoId },
      update: { demoId },
    });
    s++;
  }

  if (shortUrl?.code && shortUrl?.shortUrl) {
    await prisma.shortLink.upsert({
      where: { id: 1 },
      create: { id: 1, code: shortUrl.code, shortUrl: shortUrl.shortUrl },
      update: { code: shortUrl.code, shortUrl: shortUrl.shortUrl },
    });
  }

  console.log(`Ingested ${d} demo(s), ${s} slot(s)${shortUrl?.code ? ', 1 short link' : ''} from ${file}.`);
} catch (err) {
  console.error('Ingest failed:', err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
