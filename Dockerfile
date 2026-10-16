# syntax=docker/dockerfile:1
#
# TLU Scholar Editor — backend (Fastify 5 + Prisma 7 + native Typst compiler).
#
# Debian (glibc), NOT Alpine: the native N-API addons
# (@myriaddreamin/typst-ts-node-compiler, bcrypt) ship prebuilds for
# linux-<arch>-gnu; the musl prebuilds are unreliable.
# Works on both amd64 and arm64 (Oracle Ampere) — npm ci resolves the prebuild
# for whatever arch the build runs on.

########## builder ##########
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# openssl        : Prisma's Rust schema/query engines link against it.
# build-essential: only used if a native dep has no prebuild for this arch and
#                  has to compile from source (bcrypt's fallback path).
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3 openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Full install (devDependencies included): typescript builds, prisma migrates,
# tsx seeds. Do not add --omit=dev here.
RUN npm ci

COPY . .
RUN test ! -f .env && test ! -f deploy/.env.docker && test ! -d tmp

# Plain `prisma generate` also runs the `erd` generator, which needs a browser
# and dies with ENOENT. Only the client generator is needed.
RUN npx prisma generate --generator client

# tsc + postbuild (copies src/generated -> dist/generated).
RUN npm run build

########## runtime ##########
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl fontconfig ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# node_modules is deliberately UNPRUNED: `prisma migrate deploy` (prisma) and
# `npm run seed:all` (tsx) both live in devDependencies and run as one-shot
# commands against this same image.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# `prisma migrate deploy` needs all three. Prisma 7 reads the connection string
# from prisma.config.ts (`datasource.url = process.env.DATABASE_URL`) — the
# `datasource db` block in schema.prisma declares no url, so without this file
# the CLI has no database to migrate.
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma ./prisma

# `npm run seed:all` runs the TypeScript sources directly through tsx, and they
# import the generated client from ../src/generated/prisma. Both must exist at
# runtime — dist/ alone is not enough.
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/generated ./src/generated

# Typst fonts (~63 MB). A missing font is only a *warning* in Typst: the compile
# still returns 200 and quietly substitutes New Computer Modern for Times New
# Roman, which violates the TLU thesis format. Fail the build instead.
COPY --from=builder /app/var/fonts ./var/fonts
RUN test -f /app/var/fonts/times.ttf || (echo "FATAL: var/fonts/times.ttf missing" && exit 1)
ENV COMPILE_FONT_DIRS=/app/var/fonts

# Named volumes mount here. Creating them as `node` first means Docker copies
# that ownership onto the fresh volumes, so the unprivileged user can write.
# node_modules/.cache: the Prisma 7 CLI transpiles prisma.config.ts through jiti,
# which caches there — the rest of node_modules stays root-owned and read-only.
RUN mkdir -p /app/.storage /app/storage/templates /app/node_modules/.cache \
 && chown -R node:node /app/.storage /app/storage /app/node_modules/.cache
USER node

EXPOSE 3000

# NOT `npm start` — that runs `concurrently` (a devDependency) to co-launch the
# Zotero translation-server, which is a separate container here.
CMD ["node", "dist/index.js"]
