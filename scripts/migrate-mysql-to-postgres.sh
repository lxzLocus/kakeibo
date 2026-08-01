#!/usr/bin/env bash
# =============================================================================
# MySQL → PostgreSQL データ移行スクリプト
#
# オンプレ環境 (/opt/docker/kakeibo/) で実行する想定。
# 既存の MySQL コンテナからデータを CSV ダンプし、
# 新しい PostgreSQL コンテナに Flyway スキーマ作成後インポートする。
#
# 前提:
#   - 旧環境: mysql:8.4 コンテナ (kakeibo-database) が起動中
#   - 新環境: docker-compose.prod.yml が PostgreSQL 版に更新済み
#   - このスクリプトは /opt/docker/kakeibo/ で実行する
#
# 使い方:
#   1. アプリを停止:  docker compose -f docker-compose.prod.yml stop kakeibo-app
#   2. このスクリプトを実行:  bash scripts/migrate-mysql-to-postgres.sh
#   3. アプリを起動:  docker compose -f docker-compose.prod.yml up -d
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="${SCRIPT_DIR}/../data/migration_dump"
CF="docker-compose.prod.yml"
MYSQL_CONTAINER="kakeibo-database"
DB_PASSWORD="${DB_PASSWORD:-password}"

# テーブル一覧（外部キー依存順 = インポート順）
TABLES=(
  "user"
  "category"
  "store"
  "fund_pool"
  "entry"
  "fixed_cost"
  "fund_transfer"
  "goal"
  "inventory"
  "meal"
  "meal_item"
  "shopping_item"
  "chat_session"
  "chat_message"
  "user_evaluation"
  "user_llm_config"
  "user_memory"
)

echo "================ MySQL → PostgreSQL データ移行 ================"

# ------------------------------------------------------------------
# Step 1: MySQL からデータをCSVダンプ
# ------------------------------------------------------------------
echo ""
echo "[Step 1] MySQL からデータをCSVダンプ..."

mkdir -p "$WORK_DIR"

# MySQL コンテナが動いているか確認
if ! docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
  echo "ERROR: MySQL コンテナ '${MYSQL_CONTAINER}' が動いていません。"
  echo "  旧 docker-compose.prod.yml で起動してください:"
  echo "  docker compose -f docker-compose.prod.yml up -d kakeibo-database"
  exit 1
fi

for table in "${TABLES[@]}"; do
  echo "  ダンプ中: ${table} ..."

  # BIT(1) を 0/1 ではなく true/false に変換するため、
  # MySQL 側で CASE WHEN で boolean カラムを変換する。
  # まずカラム情報を取得
  columns=$(docker exec "$MYSQL_CONTAINER" mysql -u root -p"$DB_PASSWORD" -N -B kakeibo \
    -e "SELECT GROUP_CONCAT(
          CASE
            WHEN DATA_TYPE = 'bit' THEN CONCAT('CASE WHEN \`', COLUMN_NAME, '\` = 1 THEN ''true'' ELSE ''false'' END')
            ELSE CONCAT('\`', COLUMN_NAME, '\`')
          END
        )
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'kakeibo' AND TABLE_NAME = '${table}'
        ORDER BY ORDINAL_POSITION;" 2>/dev/null)

  if [ -z "$columns" ]; then
    echo "    → テーブルが存在しないかカラム情報取得失敗、スキップ"
    continue
  fi

  # SELECT でデータをTSVダンプ（NULL は \N で出力）
  row_count=$(docker exec "$MYSQL_CONTAINER" mysql -u root -p"$DB_PASSWORD" -N -B kakeibo \
    -e "SELECT ${columns} FROM \`${table}\`;" 2>/dev/null \
    | sed 's/NULL/\\N/g' \
    > "${WORK_DIR}/${table}.tsv" && wc -l < "${WORK_DIR}/${table}.tsv")

  echo "    → ${row_count} 行"
done

echo ""
echo "[Step 1 完了] ダンプファイル: ${WORK_DIR}/"

# ------------------------------------------------------------------
# Step 2: MySQL コンテナを停止し、PostgreSQL コンテナを起動
# ------------------------------------------------------------------
echo ""
echo "[Step 2] MySQL → PostgreSQL コンテナ切替..."

echo "  MySQL コンテナを停止..."
docker stop "$MYSQL_CONTAINER" 2>/dev/null || true

echo "  古いコンテナを削除..."
docker rm "$MYSQL_CONTAINER" 2>/dev/null || true

echo "  PostgreSQL コンテナを起動（新しい docker-compose.prod.yml）..."
# DB だけ先に起動してヘルスチェックが通るまで待つ
docker compose -f "$CF" up -d kakeibo-database

echo "  PostgreSQL の起動を待機中..."
for i in $(seq 1 30); do
  if docker exec "$MYSQL_CONTAINER" pg_isready -U postgres -d kakeibo >/dev/null 2>&1; then
    echo "  → PostgreSQL 起動確認"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "ERROR: PostgreSQL が起動しません"
    exit 2
  fi
  sleep 2
done

# ------------------------------------------------------------------
# Step 3: Flyway でスキーマ作成（アプリを一度起動して即停止）
# ------------------------------------------------------------------
echo ""
echo "[Step 3] Flyway でスキーマ作成..."
echo "  アプリコンテナを起動して Flyway マイグレーション実行..."
docker compose -f "$CF" up -d kakeibo-app

# Spring Boot が起動して Flyway が走るまで待つ
echo "  Flyway マイグレーション完了を待機中（最大120秒）..."
for i in $(seq 1 24); do
  # Flyway が走った後にバックエンドがリッスンし始める
  code=$(docker exec kakeibo-app sh -c \
    "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/users/register --max-time 5" 2>/dev/null || echo "000")
  if [ -n "$code" ] && [ "$code" != "000" ]; then
    echo "  → Flyway + Spring Boot 起動完了 (HTTP ${code})"
    break
  fi
  if [ "$i" = "24" ]; then
    echo "WARNING: Spring Boot がまだ応答しません。ログを確認してください:"
    echo "  docker logs kakeibo-app --tail 50"
  fi
  sleep 5
done

echo "  アプリを停止（データインポート中は停止しておく）..."
docker compose -f "$CF" stop kakeibo-app

# ------------------------------------------------------------------
# Step 4: PostgreSQL にデータをインポート
# ------------------------------------------------------------------
echo ""
echo "[Step 4] PostgreSQL にデータをインポート..."

for table in "${TABLES[@]}"; do
  tsv_file="${WORK_DIR}/${table}.tsv"
  if [ ! -f "$tsv_file" ] || [ ! -s "$tsv_file" ]; then
    echo "  スキップ（データなし）: ${table}"
    continue
  fi

  row_count=$(wc -l < "$tsv_file")
  echo "  インポート中: ${table} (${row_count} 行)..."

  # PostgreSQL の "user" はキーワードなのでダブルクォートで囲む
  pg_table="$table"
  if [ "$table" = "user" ]; then
    pg_table='"user"'
  fi

  # COPY コマンドでインポート（TSV形式、NULL は \N）
  docker cp "$tsv_file" "${MYSQL_CONTAINER}:/tmp/${table}.tsv"
  docker exec "$MYSQL_CONTAINER" psql -U postgres -d kakeibo -c \
    "\\COPY ${pg_table} FROM '/tmp/${table}.tsv' WITH (FORMAT text, NULL '\\N');" 2>&1 \
    | grep -v "^$" || true
done

# ------------------------------------------------------------------
# Step 5: シーケンス（IDENTITY）の現在値を修正
# ------------------------------------------------------------------
echo ""
echo "[Step 5] シーケンスの現在値を修正..."

# GENERATED BY DEFAULT AS IDENTITY のシーケンスを MAX(id)+1 にリセット
for table in "${TABLES[@]}"; do
  pg_table="$table"
  if [ "$table" = "user" ]; then
    pg_table='"user"'
  fi

  docker exec "$MYSQL_CONTAINER" psql -U postgres -d kakeibo -c \
    "SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM ${pg_table};" \
    2>/dev/null || true
done

echo ""
echo "[Step 5 完了] シーケンスリセット完了"

# ------------------------------------------------------------------
# Step 6: 検証
# ------------------------------------------------------------------
echo ""
echo "[Step 6] 検証..."

echo "  各テーブルの行数:"
for table in "${TABLES[@]}"; do
  pg_table="$table"
  if [ "$table" = "user" ]; then
    pg_table='"user"'
  fi

  count=$(docker exec "$MYSQL_CONTAINER" psql -U postgres -d kakeibo -t -c \
    "SELECT COUNT(*) FROM ${pg_table};" 2>/dev/null | tr -d ' ')
  echo "    ${table}: ${count:-ERROR} 行"
done

echo ""
echo "================ 移行完了 ================"
echo ""
echo "次のステップ:"
echo "  1. アプリを起動:  docker compose -f docker-compose.prod.yml up -d"
echo "  2. ブラウザでアクセスして動作確認"
echo "  3. 問題なければ古い MySQL データを削除:"
echo "     rm -rf ./data/mysql"
echo ""
echo "問題があった場合のロールバック:"
echo "  1. PostgreSQL コンテナを停止: docker compose -f docker-compose.prod.yml down"
echo "  2. PostgreSQL データを削除:   rm -rf ./data/postgres"
echo "  3. 旧 docker-compose.prod.yml に戻して MySQL を再起動"
