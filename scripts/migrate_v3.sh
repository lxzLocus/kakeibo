#!/usr/bin/env bash
# =============================================================================
# MySQL → PostgreSQL 完全データ移行スクリプト (復旧用)
#
# 前回 COPY に失敗してテーブルが空になった状態から、
# 正確にカラム順序とデータ型（BIT→boolean等）を合わせて再インポートします。
# =============================================================================
set -uo pipefail

if [ -f .env ]; then
  set -a; source .env; set +a
fi
DB_PASSWORD="${DB_PASSWORD:-password}"
DUMP_DIR="./migration_dump"
MYSQL_CTR="kakeibo-mysql-temp"
PG_CTR="kakeibo-database"
APP_CTR="kakeibo-app"

TABLES=(
  user
  category
  store
  fund_pool
  entry
  fixed_cost
  fund_transfer
  goal
  inventory
  meal
  meal_item
  shopping_item
  chat_session
  chat_message
  user_evaluation
  user_llm_config
  user_memory
)

echo "================ 移行リトライ開始 ================"

# 1. 古い PostgreSQL データを一度リセット（空の状態でFlywayをかけ直すため）
echo "1. 古い PostgreSQL データをリセットします..."
docker compose -f docker-compose.prod.yml down
rm -rf ./data/postgres

# 2. MySQL をテンポラリ起動（残っている ./data/mysql をマウント）
echo "2. MySQL データからテンポラリコンテナを起動します..."
docker stop "$MYSQL_CTR" 2>/dev/null || true
docker rm "$MYSQL_CTR" 2>/dev/null || true

docker run -d --name "$MYSQL_CTR" \
  -e MYSQL_ROOT_PASSWORD="$DB_PASSWORD" \
  -v "$(pwd)/data/mysql:/var/lib/mysql" \
  mysql:8.4 --innodb-flush-log-at-trx-commit=2 --sync-binlog=0

# MySQL 起動待ち
for i in {1..30}; do
  if docker exec "$MYSQL_CTR" mysqladmin ping -u root -p"$DB_PASSWORD" --silent 2>/dev/null; then
    break
  fi
  sleep 2
done

# 3. PostgreSQL 起動 & Flyway スキーマ作成
echo "3. PostgreSQL を起動し、Flyway でスキーマを作成します..."
docker compose -f docker-compose.prod.yml up -d "$PG_CTR"
sleep 5 # PG起動待ち

docker compose -f docker-compose.prod.yml up -d "$APP_CTR"
# Spring Boot 起動（Flyway実行完了）待ち
for i in {1..40}; do
  if docker logs "$APP_CTR" 2>&1 | grep -q "Tomcat started on port(s): 8080"; then
    echo "  → Spring Boot 起動完了（Flyway適用完了）"
    break
  fi
  sleep 5
done
# インポート中はアプリを止める
docker compose -f docker-compose.prod.yml stop "$APP_CTR"

# 4. データ抽出とインポート
echo "4. データ変換とインポートを実行します..."
mkdir -p "$DUMP_DIR"

for table in "${TABLES[@]}"; do
  pg_table="$table"
  if [ "$table" = "user" ]; then pg_table='"user"'; fi

  # PostgreSQL 側のカラム順序を正確に取得（これが COPY で期待される順序）
  pg_cols=$(docker exec "$PG_CTR" psql -U postgres -d kakeibo -t -A -c \
    "SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position;")
  
  if [ -z "$pg_cols" ]; then
    echo "  SKIP: ${table} (PostgreSQL に存在しません)"
    continue
  fi

  # MySQL 用の SELECT 句を構築（BIT 型は true/false にキャスト）
  select_expr=""
  for col in $pg_cols; do
    col_type=$(docker exec "$MYSQL_CTR" mysql --default-character-set=utf8mb4 -u root -p"$DB_PASSWORD" -N -B kakeibo -e \
      "SELECT DATA_TYPE FROM information_schema.columns WHERE table_schema='kakeibo' AND table_name='${table}' AND column_name='${col}';")
    
    expr="\`${col}\`"
    if [ "$col_type" = "bit" ]; then
      expr="CASE WHEN \`${col}\` = 1 THEN 'true' ELSE 'false' END"
    fi
    
    if [ -z "$select_expr" ]; then
      select_expr="$expr"
    else
      select_expr="$select_expr, $expr"
    fi
  done

  # MySQL から TSV ダンプ
  docker exec "$MYSQL_CTR" mysql --default-character-set=utf8mb4 -u root -p"$DB_PASSWORD" -N -B kakeibo -e \
    "SELECT $select_expr FROM \`${table}\`;" | sed 's/NULL/\\N/g' > "${DUMP_DIR}/${table}.tsv"
  
  rows=$(wc -l < "${DUMP_DIR}/${table}.tsv" | tr -d ' ')
  if [ "$rows" -eq 0 ]; then
    echo "  SKIP: ${table} (データ0行)"
    continue
  fi

  # PostgreSQL に COPY
  docker cp "${DUMP_DIR}/${table}.tsv" "${PG_CTR}:/tmp/${table}.tsv"
  copy_result=$(docker exec "$PG_CTR" psql -U postgres -d kakeibo -c \
    "\\COPY ${pg_table} FROM '/tmp/${table}.tsv' WITH (FORMAT text, NULL '\\N');" 2>&1)

  if echo "$copy_result" | grep -q "ERROR"; then
    echo "  ERROR: ${table} のインポートに失敗しました:"
    echo "$copy_result"
  else
    echo "  OK: ${table} (${rows} 行インポート完了)"
  fi

  # シーケンスのリセット
  docker exec "$PG_CTR" psql -U postgres -d kakeibo -c \
    "SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM ${pg_table};" >/dev/null 2>&1 || true

done

echo "5. クリーンアップ..."
docker stop "$MYSQL_CTR" 2>/dev/null || true
docker rm "$MYSQL_CTR" 2>/dev/null || true

echo "================ 復旧完了 ================"
echo "docker compose -f docker-compose.prod.yml up -d  で起動してください。"
