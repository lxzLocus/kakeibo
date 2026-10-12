/** 入力文字列を「1,234」形式（整数・カンマ区切り）に整形する。金額入力欄の表示用。 */
export function withCommas(s: string | number): string {
  const digits = String(s).replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ja-JP');
}

/** カンマ付き文字列を数値に変換する（送信・検証用）。 */
export function toNumber(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** マスク適用時に常に返す固定4桁表示。桁数も金額も判別できないようにする。 */
export const MASKED_FIXED_STRING = '¥*,***';

/**
 * 金額を全桁隠して固定表示「¥*,***」にする。
 * 引数（元の金額文字列）は桁数すら推測させないため参照せず、常に固定文字列を返す。
 * 例: "¥1,234,567" → "¥*,***" / "-12,345" → "¥*,***" / "1.5万" → "¥*,***"
 */
export function maskDigits(_s: string): string {
  return MASKED_FIXED_STRING;
}
