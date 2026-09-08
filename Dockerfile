FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Generate Prisma Client and build app
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat curl

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/app/data/miner.db"

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 3000

# Push DB schema if needed on start and launch server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.cjs"]
