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
