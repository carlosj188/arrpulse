# --- Stage 1: build do frontend ---
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend + frontend estático ---
FROM node:22-bookworm-slim
WORKDIR /app

# Vincula a imagem ao repositório no ghcr (aparece em Packages do repo)
LABEL org.opencontainers.image.source="https://github.com/carlosj188/arrpulse"
LABEL org.opencontainers.image.description="ArrPulse — monitor de saúde do stack arr (Radarr/Sonarr/Prowlarr/Jellyfin/qBittorrent)"

# build tools como fallback caso better-sqlite3 não tenha binário pré-compilado
# tzdata: necessário para o fuso (TZ) do "horário silencioso" funcionar
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ tzdata \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./public

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/server.js"]
