# 1) builder: install ALL deps, generate Prisma client
FROM node:24 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .

# 2) runtime: install only prod deps + copy over generated client & your code
FROM node:24
WORKDIR /app

RUN adduser --system --no-create-home --group app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy app code (excluding node_modules)
COPY --from=builder /app/index.js ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/utils ./utils
# Copy any other folders your app needs

# Copy generated Prisma client only
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER app

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s \
  CMD curl -f http://localhost:3000/metrics || exit 1

EXPOSE 3000
CMD ["node", "index.js"]
