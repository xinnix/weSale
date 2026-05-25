#!/bin/bash
set -e

echo "Generating Prisma Client..."
pnpm --filter @opencode/database exec prisma generate

echo "Building shared package..."
pnpm --filter @opencode/shared build

echo "Sync complete."
