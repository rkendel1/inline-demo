#!/usr/bin/env bash
# One-shot database setup for deployment. Run this once per deploy (or whenever the schema
# changes). It is safe to run repeatedly.
#
#   1. Generates the Prisma client.
#   2. Applies pending migrations to the database named by DATABASE_URL.
#   3. If a local .data/demos.json exists (e.g. you're moving off local dev), ingests it so
#      your existing demos, live slot, and short link carry over.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db bash scripts/deploy-db.sh
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export it (your Postgres connection string) and re-run." >&2
  exit 1
fi

echo "==> prisma generate"
npx prisma generate

echo "==> prisma migrate deploy"
npx prisma migrate deploy

if [ -f ".data/demos.json" ]; then
  echo "==> ingesting existing .data/demos.json"
  node scripts/ingest.mjs
else
  echo "==> no .data/demos.json to ingest (fresh database) — skipping"
fi

echo "==> database is ready"
