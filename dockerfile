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

# Copy the generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy your application code
COPY --from=builder /app .

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=3s \
  CMD curl -f http://localhost:3000/metrics || exit 1

EXPOSE 3000
CMD ["node", "index.js"]
