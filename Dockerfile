# syntax=docker/dockerfile:1

# ---- build: зависимости + prisma generate + nest build ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# prisma.config.ts читает DATABASE_URL; для generate подключение не нужно — хватает заглушки
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
 && npm run build \
 && test -f dist/src/main.js
# Только runtime-зависимости + prisma CLI той же версии (для `prisma migrate deploy` на сервере)
RUN npm prune --omit=dev \
 && npm install --no-save --no-audit --no-fund \
      "prisma@$(node -p "require('@prisma/client/package.json').version")"

# ---- runtime ----
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/generated ./generated
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
# Сервер stateless: картинки и видео лежат в Selectel S3, локальных файлов нет.
USER node
EXPOSE 4444
CMD ["node", "dist/src/main.js"]
