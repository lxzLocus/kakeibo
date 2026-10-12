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

/** 金額マスク表示用の文字（桁はわかるが数字は伏せる）。 */
export const MASK_CHAR = '*';

/**
 * 桁区切り・通貨記号・符号を残したまま、数字の桁を全てマスク文字へ置き換える。
 * 例: "¥1,234,567" → "¥*,***,***" / "-12,345" → "-**,***" / 小数 "-1,234.5" → "-*,***.*"
 * カンマ区切りにより桁数はそのまま読み取れるが、数字そのものはわからない。
 */
export function maskDigits(s: string): string {
  return s.replace(/[0-9]/g, MASK_CHAR);
}
