// カテゴリ可視化用のカラーパレット。
// ダークテーマ上でも互いに識別しやすいよう、彩度を抑えつつ色相を分散させた多色。
export const CATEGORY_COLORS = [
  '#8AB4F8', // ブルー
  '#81C995', // グリーン
  '#FDD663', // アンバー
  '#F28B82', // レッド
  '#C58AF9', // パープル
  '#6DD9CE', // ティール
  '#FCAD70', // オレンジ
  '#FF8BCB', // ピンク
  '#9AA0FF', // インディゴ
  '#C4EE86', // ライム
  '#F6C445', // ゴールド
  '#7FC8F8', // スカイ
];

/** インデックスに対応するカテゴリ色を返す（負値・範囲外も安全にラップ）。 */
export function categoryColor(i: number): string {
  const n = CATEGORY_COLORS.length;
  return CATEGORY_COLORS[((i % n) + n) % n];
}
