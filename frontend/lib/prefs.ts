// ==========================================
// ホーム画面の表示設定（localStorage に永続化）
// ==========================================

const MASK_KEY = 'kakeibo.hideAmounts';
const VIEW_MODE_KEY = 'kakeibo.viewMode';
const CARD_ID_KEY = 'kakeibo.cardPoolId';

export type HomeViewMode = 'month' | 'card';

/** 金額マスク（数字を ● で隠す）の有効状態を読み込む。 */
export function readMasked(): boolean {
  try {
    return localStorage.getItem(MASK_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeMasked(v: boolean) {
  try {
    localStorage.setItem(MASK_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** ホーム画面の期間表示（月ベース / カード締め日ベース）を読み込む。 */
export function readViewMode(): HomeViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'month' || v === 'card') return v;
  } catch {
    /* ignore */
  }
  return 'month';
}

export function writeViewMode(v: HomeViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, v);
  } catch {
    /* ignore */
  }
}

/** カード締め日ベース表示で基準にするカードID（プールID）を読み込む。 */
export function readCardPoolId(): string {
  try {
    return localStorage.getItem(CARD_ID_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeCardPoolId(id: string) {
  try {
    localStorage.setItem(CARD_ID_KEY, id);
  } catch {
    /* ignore */
  }
}