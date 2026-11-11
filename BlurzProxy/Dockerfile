FROM node:22.12.0-bookworm-slim

ENV NODE_ENV=production
ENV HOST=0.0.0.0
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY public ./public
COPY server ./server

USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
