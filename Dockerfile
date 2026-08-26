FROM node:24.18-alpine3.24 AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

FROM node:24.18-alpine3.24 AS builder
WORKDIR /app
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
ENV REALTIME_SECRET=build-only-realtime-secret-at-least-32-characters
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.18-alpine3.24 AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S atlore && adduser -S -G atlore atlore
COPY --from=dependencies --chown=atlore:atlore /app/node_modules ./node_modules
COPY --from=builder --chown=atlore:atlore /app/build ./build
COPY --from=builder --chown=atlore:atlore /app/server ./server
COPY --from=builder --chown=atlore:atlore /app/package.json ./package.json
USER atlore
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 CMD wget -q -O - http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.js"]
