# syntax=docker/dockerfile:1

# =============================================================================
# 家計簿アプリを 1 つのイメージにまとめるマルチステージビルド。
#   - フロントエンド: Next.js (standalone / Node) をビルド
#   - バックエンド  : Spring Boot (fat jar / JVM) をビルド
#   - ランタイム    : JRE + Node + Tesseract(OCR) を同居させ、supervisor で両プロセスを起動
# DB(MySQL) は永続化のため別イメージ（docker-compose.prod.yml を参照）。
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: フロントエンド（Next.js）を standalone でビルド
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app

# 依存だけ先に入れてレイヤキャッシュを効かせる
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY frontend/ ./
# rewrites() の /api → バックエンド先を「同一コンテナ内の :8080」に固定（combined image のため）
ENV BACKEND_URL=http://127.0.0.1:8080
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: バックエンド（Spring Boot）を fat jar にビルド
# -----------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /src

# pom を先に入れて依存を取得（キャッシュ層）
COPY backend/pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

COPY backend/ ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q -DskipTests clean package \
 && cp target/kakeibo-*.jar /app.jar

# -----------------------------------------------------------------------------
# Stage 3: ランタイム（JRE + Node + Tesseract を 1 つに）
# -----------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-jammy AS runtime
ENV DEBIAN_FRONTEND=noninteractive

# Tesseract(日/英) + supervisor + Node.js 22 を導入
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg supervisor \
      tesseract-ocr tesseract-ocr-jpn tesseract-ocr-eng \
 && mkdir -p /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get purge -y gnupg \
 && apt-get autoremove -y \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- バックエンド（fat jar） ---
COPY --from=backend-build /app.jar /app/backend/app.jar

# --- フロントエンド（standalone） ---
# server.js と最小 node_modules（standalone には static / public が含まれないため別途コピー）
COPY --from=frontend-build /app/.next/standalone/ /app/frontend/
COPY --from=frontend-build /app/.next/static/ /app/frontend/.next/static/
COPY --from=frontend-build /app/public/ /app/frontend/public/

# --- プロセス管理 ---
COPY docker/supervisord.conf /etc/supervisor/supervisord.conf

# 実行時の既定値（compose / docker run 時に上書き可能）
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    BACKEND_URL=http://127.0.0.1:8080 \
    JAVA_OPTS="-Xmx512m -Xms256m" \
    SPRING_DATASOURCE_URL="jdbc:postgresql://kakeibo-database:5432/kakeibo" \
    SPRING_DATASOURCE_USERNAME=postgres \
    SPRING_DATASOURCE_PASSWORD=password

# 3000 = フロント(公開) / 8080 = バックエンド(内部・必要なら公開)
EXPOSE 3000 8080

# フロントが立ち上がっていれば healthy とみなす（backend は supervisor が DB 起動まで再試行）
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:3000/login" > /dev/null || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
