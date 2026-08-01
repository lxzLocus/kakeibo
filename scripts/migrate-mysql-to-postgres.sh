#!/usr/bin/env bash
# =============================================================================
# MySQL → PostgreSQL データ移行スクリプト (簡易版)
#
# /opt/docker/kakeibo/ に置いてそのまま実行する。
#
# 前提:
#   - 旧 MySQL コンテナ (kakeibo-database) が起動中
#   - kakeibo-app は停止済み
#   - .env に DB_PASSWORD が設定済み
#
# 使い方:
#   docker compose -f docker-compose.prod.yml stop kakeibo-app
#   bash migrate.sh
# =============================================================================
set -uo pipefail

# .env があれば読み込む
if [ -f .env ]; then
  set -a; source .env; set +a
fi

DB_PASSWORD="${DB_PASSWORD:-password}"
DUMP_DIR="./data/migration_dump"
MYSQL_CTR="kakeibo-database"
PG_CTR="kakeibo-pg-temp"

# テーブル一覧（外部キー依存順）
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

echo "================ MySQL → PostgreSQL データ移行 ================"
echo ""

# ------------------------------------------------------------------
# Step 1: MySQL コンテナが動いているか確認
# ------------------------------------------------------------------
if ! docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CTR}$"; then
  echo "ERROR: MySQL コンテナ '${MYSQL_CTR}' が動いていません。"
  echo "  先に旧 docker-compose.prod.yml で MySQL を起動してください。"
  exit 1
fi

# ------------------------------------------------------------------
# Step 2: MySQL からデータをTSVダンプ
# ------------------------------------------------------------------
echo "[Step 1/5] MySQL からデータダンプ中..."
mkdir -p "$DUMP_DIR"

for table in "${TABLES[@]}"; do
  # テーブルが存在するか確認
  exists=$(docker exec "$MYSQL_CTR" mysql -u root -p"$DB_PASSWORD" -N -B kakeibo \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='kakeibo' AND table_name='${table}';" 2>/dev/null)

  if [ "$exists" != "1" ]; then
    echo "  SKIP: ${table} (テーブルなし)"
    continue
  fi

  # シンプルに SELECT * でダンプ（TSV形式）
  # BIT(1) は MySQL が 0/1 で出力するので、後で PostgreSQL 側で変換する
  docker exec "$MYSQL_CTR" mysql -u root -p"$DB_PASSWORD" -N -B kakeibo \
    -e "SELECT * FROM \`${table}\`;" 2>/dev/null \
    > "${DUMP_DIR}/${table}.tsv"

  rows=$(wc -l < "${DUMP_DIR}/${table}.tsv" | tr -d ' ')
  echo "  OK: ${table} → ${rows} 行"
done

echo ""

# ------------------------------------------------------------------
# Step 3: MySQL を停止、PostgreSQL を起動
# ------------------------------------------------------------------
echo "[Step 2/5] MySQL 停止 → PostgreSQL 起動..."

docker stop "$MYSQL_CTR" 2>/dev/null || true
docker rm "$MYSQL_CTR" 2>/dev/null || true

# 新しい docker-compose.prod.yml で PostgreSQL だけ起動
# (docker-compose.prod.yml は既に PostgreSQL 版に更新済みの前提)
docker compose -f docker-compose.prod.yml up -d kakeibo-database

echo "  PostgreSQL 起動待ち..."
for i in $(seq 1 30); do
  if docker exec "$MYSQL_CTR" pg_isready -U postgres -d kakeibo >/dev/null 2>&1; then
    echo "  → PostgreSQL 起動OK"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "ERROR: PostgreSQL が起動しません。docker logs ${MYSQL_CTR} で確認してください。"
    exit 2
  fi
  sleep 2
done

echo ""

# ------------------------------------------------------------------
# Step 4: Flyway でスキーマ作成 → データインポート
# ------------------------------------------------------------------
echo "[Step 3/5] アプリ起動（Flyway スキーマ作成）..."

docker compose -f docker-compose.prod.yml up -d kakeibo-app

echo "  Spring Boot 起動待ち（90-120秒かかります）..."
for i in $(seq 1 30); do
  code=$(docker exec kakeibo-app sh -c \
    "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/users/register --max-time 5" 2>/dev/null || echo "000")
  if [ "$code" != "000" ] && [ "$code" != "" ]; then
    echo "  → Spring Boot 起動OK (HTTP ${code})"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "WARNING: 応答なし。docker logs kakeibo-app --tail 30 で確認してください。"
  fi
  sleep 5
done

echo "  アプリ停止（インポート中は止める）..."
docker compose -f docker-compose.prod.yml stop kakeibo-app

echo ""

# ------------------------------------------------------------------
# Step 5: データインポート
# ------------------------------------------------------------------
echo "[Step 4/5] PostgreSQL にデータインポート..."

for table in "${TABLES[@]}"; do
  tsv="${DUMP_DIR}/${table}.tsv"
  if [ ! -f "$tsv" ] || [ ! -s "$tsv" ]; then
    echo "  SKIP: ${table} (データなし)"
    continue
  fi

  rows=$(wc -l < "$tsv" | tr -d ' ')

  # PostgreSQL の user は予約語なのでダブルクォートで囲む
  pg_table="$table"
  if [ "$table" = "user" ]; then
    pg_table='"user"'
  fi

  # BIT(1) カラムの 0/1 → true/false 変換用の一時テーブルは使わず、
  # まず TEXT としてインポートしてから UPDATE で変換する方法を取る。
  #
  # ただし、シンプルに COPY する場合は PostgreSQL が boolean カラムに
  # 0/1 を受け付けないため、事前に sed で変換する。
  #
  # boolean カラムの位置はテーブルごとに異なるが、
  # TSV の値としての 0 と 1 は他のカラム（amount 等）にもあるため、
  # フィールド単位での変換が必要。
  #
  # → 最もシンプルな方法: カラム名を取得して COPY with header なし + 一時テーブル経由

  # まずはそのまま COPY を試す
  docker cp "$tsv" "${MYSQL_CTR}:/tmp/${table}.tsv"
  result=$(docker exec "$MYSQL_CTR" psql -U postgres -d kakeibo -c \
    "\\COPY ${pg_table} FROM '/tmp/${table}.tsv' WITH (FORMAT text, NULL '\\N');" 2>&1) || true

  if echo "$result" | grep -q "ERROR"; then
    echo "  WARN: ${table} → COPY 失敗。BIT→boolean 変換を試みます..."

    # boolean カラムの位置を特定して sed で 0→f, 1→t に変換
    # PostgreSQL の text format では boolean は t/f
    bool_cols=$(docker exec "$MYSQL_CTR" psql -U postgres -d kakeibo -t -c \
      "SELECT string_agg(ordinal_position::text, ',')
       FROM information_schema.columns
       WHERE table_name = '${table}' AND data_type = 'boolean';" 2>/dev/null | tr -d ' ')

    if [ -n "$bool_cols" ]; then
      # awk で該当カラム位置の 0→f, 1→t に変換
      cp "$tsv" "${tsv}.bak"
      awk -F'\t' -v cols="$bool_cols" '
        BEGIN { OFS="\t"; split(cols, c, ","); for(i in c) boolcol[c[i]]=1 }
        {
          for(i=1; i<=NF; i++) {
            if(i in boolcol) {
              if($i == "0") $i = "f"
              else if($i == "1") $i = "t"
            }
          }
          print
        }
      ' "${tsv}.bak" > "$tsv"

      docker cp "$tsv" "${MYSQL_CTR}:/tmp/${table}.tsv"
      docker exec "$MYSQL_CTR" psql -U postgres -d kakeibo -c \
        "\\COPY ${pg_table} FROM '/tmp/${table}.tsv' WITH (FORMAT text, NULL '\\N');" 2>&1 || true
    fi
  fi

  echo "  OK: ${table} (${rows} 行)"
done

echo ""

# ------------------------------------------------------------------
# Step 6: シーケンスリセット
# ------------------------------------------------------------------
echo "[Step 5/5] シーケンスリセット..."

for table in "${TABLES[@]}"; do
  # pg_get_serial_sequence で IDENTITY のシーケンス名を取得
  seq_name=$(docker exec "$MYSQL_CTR" psql -U postgres -d kakeibo -t -c \
    "SELECT pg_get_serial_sequence('${table}', 'id');" 2>/dev/null | tr -d ' ')

  if [ -n "$seq_name" ] && [ "$seq_name" != "" ]; then
    pg_table="$table"
    if [ "$table" = "user" ]; then
      pg_table='"user"'
    fi
    docker exec "$MYSQL_CTR" psql -U postgres -d kakeibo -c \
      "SELECT setval('${seq_name}', COALESCE((SELECT MAX(id) FROM ${pg_table}), 0) + 1, false);" \
      2>/dev/null | tail -1
  fi
done

echo ""
echo "================ 移行完了 ================"
echo ""
echo "次のステップ:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "確認:"
echo "  docker exec kakeibo-database psql -U postgres -d kakeibo -c '\\dt'"
echo ""
echo "ロールバック（問題時）:"
echo "  docker compose -f docker-compose.prod.yml down"
echo "  rm -rf ./data/postgres"
echo "  旧 docker-compose.prod.yml に戻して: docker compose -f docker-compose.prod.yml up -d"
echo "  (旧 MySQL データは ./bk_data/ か ./data/mysql/ にあるはず)"
