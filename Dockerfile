# Build and run Study Buddy AI on Google Cloud Run.
FROM oven/bun:1 AS app
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Bun executes the TypeScript entry point and honours Cloud Run's PORT.
CMD ["bun", "--bun", "run", "start"]
