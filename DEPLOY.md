# デプロイ / Docker イメージ

フロントエンド(Next.js)とバックエンド(Spring Boot)を **1 つのイメージ** にまとめた
マルチステージビルドと、GitHub Actions による GHCR への push を用意しています。
DB(PostgreSQL) はデータ永続化のため別コンテナです。

## 構成

```
┌─────────────────────────── combined image ───────────────────────────┐
│  supervisor (PID 1)                                                   │
│   ├─ backend : java -jar app.jar        → :8080 (内部)               │
│   └─ frontend: node server.js           → :3000 (公開)               │
│  同梱: JRE 21 / Node 22 / Tesseract(jpn+eng)                          │
└──────────────────────────────────────────────────────────────────────┘
        │ /api/* を rewrites で 127.0.0.1:8080 へ
        ▼
   PostgreSQL 16 (別コンテナ・ボリューム永続化)
```

- フロントの `next.config.ts` は `/api/:path*` を `BACKEND_URL` へ rewrite。combined image では
  ビルド時・実行時ともに `http://127.0.0.1:8080`（同居バックエンド）に固定。
- バックエンドは OCR に `tesseract` CLI を使うため、ランタイムに tesseract 本体＋日英言語データを同梱。
- DB 接続・暗号鍵などは環境変数で上書き（`SPRING_DATASOURCE_URL` などの Spring relaxed binding）。

## ローカルでビルドして起動

```bash
cp .env.example .env      # APP_ENCRYPTION_* / DB_PASSWORD を設定
docker compose -f docker-compose.prod.yml up --build
# → http://localhost:3000
```

イメージ単体をビルドしたい場合:

```bash
docker build -t kakeibo:local .
```

## CI 済みイメージ(GHCR)を使う

`.github/workflows/docker-image.yml` が master push / `v*` タグ / 手動実行で
`ghcr.io/<owner>/kakeibo` に push します（PR はビルド検証のみ）。

```bash
IMAGE=ghcr.io/lxzlocus/kakeibo:latest docker compose -f docker-compose.prod.yml up -d
```

タグ付けルール（`docker/metadata-action`）:
- ブランチ名 / PR番号 / 短縮SHA
- `vX.Y.Z` タグ push 時: `X.Y.Z`, `X.Y`
- デフォルトブランチ: `latest`

GHCR に push するには追加設定不要（`GITHUB_TOKEN` を使用）。private リポジトリのイメージを
pull する側では `docker login ghcr.io` が必要です。

## Vercel デプロイ（コンテナ）

`Dockerfile.vercel` を使って Vercel のコンテナデプロイが可能です。
DB は外部マネージド PostgreSQL（Neon 等）を使用してください。

Vercel ダッシュボードで以下の環境変数を設定:

| 変数 | 値の例 |
|------|--------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://ep-xxx.us-east-2.aws.neon.tech/kakeibo?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | Neon のユーザー名 |
| `SPRING_DATASOURCE_PASSWORD` | Neon のパスワード |
| `APP_ENCRYPTION_PASSWORD` | 暗号化パスワード |
| `APP_ENCRYPTION_SALT` | 暗号化ソルト |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | `https://your-app.vercel.app` |

## 主な環境変数

| 変数 | 既定 | 説明 |
|------|------|------|
| `BACKEND_URL` | `http://127.0.0.1:8080` | フロント→バックエンドのプロキシ先（combined では固定） |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://kakeibo-database:5432/kakeibo` | DB 接続先 |
| `SPRING_DATASOURCE_USERNAME` / `PASSWORD` | `postgres` / `password` | DB 認証 |
| `APP_ENCRYPTION_PASSWORD` / `APP_ENCRYPTION_SALT` | （必須） | 保存済み LLM API キーの暗号鍵。**変更すると復号不能**なので固定 |
| `JAVA_OPTS` | `-Xmx512m -Xms256m` | JVM オプション |

## MySQL からの移行

`scripts/migrate-mysql-to-postgres.sh` で既存 MySQL データを PostgreSQL に移行できます。

```bash
# オンプレ環境 (/opt/docker/kakeibo/) で実行
cd /opt/docker/kakeibo

# 1. アプリを停止
docker compose -f docker-compose.prod.yml stop kakeibo-app

# 2. 新しい docker-compose.prod.yml と scripts/ をデプロイ先に配置

# 3. 移行スクリプト実行
bash scripts/migrate-mysql-to-postgres.sh

# 4. アプリを起動
docker compose -f docker-compose.prod.yml up -d
```

## 開発環境（従来どおり）

`docker-compose.yml`（bind mount + VS Code の Java デバッグ）はそのまま。
開発環境も PostgreSQL を使用します。本番用は `docker-compose.prod.yml` / ルート `Dockerfile` を使います。

## 補足

- arm64 も配布する場合は workflow の `platforms:` を `linux/amd64,linux/arm64` に。
- フロントとバックを別イメージに分けたい場合は、ルート `Dockerfile` の Stage1/Stage2 を
  それぞれ独立した最終ステージにすれば分離可能（現状は 1 イメージ優先の構成）。
