#!/bin/sh
# Applies pending migrations (Prisma serialises concurrent runs with an advisory lock), then starts the API.
set -e
if [ "${DB_AUTO_MIGRATE:-true}" = "true" ]; then
  node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
fi
exec node dist/main.js
