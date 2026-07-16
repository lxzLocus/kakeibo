'use client';

import { useState, useEffect, useCallback } from 'react';
import { entryApi, categoryApi, storeApi, receiptApi, poolApi, fixedCostApi, ApiError } from '@/lib/api';
import { CalendarModal } from './CalendarModal';
import { EntryResponse, CategoryResponse, StoreResponse, ReceiptDraft, FundPoolResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { withCommas, toNumber } from '@/lib/format';
import { AssetsSection } from './AssetsSection';
import { useToast, useConfirm } from '@/app/_components/ui';

/**
 * アップロード前に画像を縮小してJPEG化する（大きな写真によるアップロードエラー/低速を防ぐ）。
 */
async function downscaleImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

// --- 前回入力の記憶（localStorage） ---
const lastCategoryKey = (type: string) => `kakeibo_last_category_${type}`;
const LAST_STORE_KEY = 'kakeibo_last_store';
function readLast(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function writeLast(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

// ==========================================
// ユーティリティ
// ==========================================

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** 取引テーブル用: 符号付き（¥なし・design 準拠） */
function formatSigned(type: 'INCOME' | 'EXPENSE', amount: number): string {
  return `${type === 'INCOME' ? '+' : '-'}${amount.toLocaleString('ja-JP')}`;
}

/** 「7/25 土」形式 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAYS[date.getDay()]}`;
}

function getMonthRange(year: number, month: number) {
  const since = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const until = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { since, until };
}

function aggregateByCategory(entries: EntryResponse[]) {
  const map = new Map<string, number>();
  entries
    .filter((e) => e.type === 'EXPENSE')
    .forEach((e) => {
      map.set(e.categoryName, (map.get(e.categoryName) || 0) + e.amount);
    });
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const maxAmount = sorted.length > 0 ? sorted[0][1] : 1;
  return sorted.map(([name, amount]) => ({
    name,
    amount,
    percentage: (amount / maxAmount) * 100,
  }));
}

// ==========================================
// メインダッシュボードページ（ホーム）
// ==========================================

const RECENT_STEPS = [7, 31, 92, 366]; // 取引履歴の表示期間（日）。もっと見るで拡大

export default function DashboardPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [entries, setEntries] = useState<EntryResponse[]>([]);
  const [recentEntries, setRecentEntries] = useState<EntryResponse[]>([]); // 履歴用（月に依存しない直近データ）
  const [recentDays, setRecentDays] = useState(7); // 履歴の表示期間（直近N日）
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [pools, setPools] = useState<FundPoolResponse[]>([]);

  // カレンダー（月ラベルのタップで開く。1日ごとのビューもこの中）
  const [calendarOpen, setCalendarOpen] = useState(false);

  // モーダル
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryResponse | null>(null);
  const [modalType, setModalType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [modalDate, setModalDate] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalCategoryId, setModalCategoryId] = useState('');
  const [modalStoreId, setModalStoreId] = useState('');
  const [modalMemo, setModalMemo] = useState(''); // 品名（購入した物・明細）
  const [modalNote, setModalNote] = useState(''); // 自由記入のメモ
  const [modalFundPoolId, setModalFundPoolId] = useState('');
  const [modalExcludeFromSim, setModalExcludeFromSim] = useState(false); // シミュレーション学習から除外

  // レシートOCR
  const [receiptScanning, setReceiptScanning] = useState(false);
  const [receiptScanMsg, setReceiptScanMsg] = useState('');
  const [receiptScanError, setReceiptScanError] = useState('');

  // インライン追加
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreType, setNewStoreType] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalSubmitError, setModalSubmitError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // クイック入力 (PC)
  const [quickDate, setQuickDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategoryId, setQuickCategoryId] = useState('');
  const [quickMemo, setQuickMemo] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { since, until } = getMonthRange(year, month);
      const data = (await entryApi.getAll(since, until)) as EntryResponse[];
      setEntries(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // 履歴用: 月に依存せず直近1年分を読み込み（表示は recentDays でクライアント側に絞る）
  const fetchRecent = useCallback(async () => {
    try {
      const from = new Date();
      from.setDate(from.getDate() - 366);
      const since = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
      const data = (await entryApi.getAll(since, todayStr())) as EntryResponse[];
      setRecentEntries(data);
    } catch {
      // 履歴取得失敗は致命的ではない（月次の表示は別途行う）
    }
  }, []);

  const fetchCategoriesAndStores = useCallback(async () => {
    try {
      const catData = (await categoryApi.getAll()) as CategoryResponse[];
      const storeData = (await storeApi.getAll()) as StoreResponse[];
      setCategories(catData);
      setStores(storeData);
    } catch (err) {
      console.error('カテゴリまたは店舗の取得に失敗しました', err);
    }
  }, []);

  const fetchPools = useCallback(async () => {
    try {
      setPools(await poolApi.getAll());
    } catch (err) {
      console.error('口座の取得に失敗しました', err);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchRecent();
    fetchCategoriesAndStores();
    fetchPools();
  }, [fetchEntries, fetchRecent, fetchCategoriesAndStores, fetchPools]);

  // 自動記帳が有効な固定費のうち、未記帳の月ぶんを反映してから表示を更新する（冪等）。
  // 常駐ジョブに頼らず「アプリを開いたときに追いつく」方式。初回マウント時のみ実行。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fixedCostApi.apply();
        if (!cancelled && res.created > 0) {
          fetchEntries();
          fetchRecent();
          fetchPools();
        }
      } catch {
        // 反映に失敗しても通常表示は続行する
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- モーダル操作 ---
  function lastCategoryFor(type: 'INCOME' | 'EXPENSE'): string {
    const last = readLast(lastCategoryKey(type));
    return categories.some((c) => String(c.categoryId) === last && c.type === type) ? last : '';
  }

  function handleModalTypeChange(type: 'INCOME' | 'EXPENSE') {
    setModalType(type);
    setModalCategoryId(lastCategoryFor(type));
    if (type === 'INCOME') setModalStoreId('');
    setIsAddingCategory(false);
  }

  function todayStr() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  /** dateStr を渡すとその日付で開く（カレンダーの「この日に追加」用）。既定は今日。 */
  function openAddModal(dateStr?: string) {
    setEditingEntry(null);
    setModalType('EXPENSE');
    setModalDate(dateStr ?? todayStr());
    setModalAmount('');
    setModalCategoryId(lastCategoryFor('EXPENSE'));
    const lastStore = readLast(LAST_STORE_KEY);
    setModalStoreId(stores.some((s) => String(s.storeId) === lastStore) ? lastStore : '');
    setModalMemo('');
    setModalNote('');
    setModalFundPoolId(pools.find((p) => p.primary)?.id?.toString() ?? pools[0]?.id?.toString() ?? '');
    setModalExcludeFromSim(false);
    setFormErrors({});
    setModalSubmitError('');
    setIsAddingCategory(false);
    setIsAddingStore(false);
    setIsModalOpen(true);
  }

  function openEditModal(entry: EntryResponse) {
    setEditingEntry(entry);
    setModalType(entry.type);
    setModalDate(entry.entryDate);
    setModalAmount(withCommas(entry.amount));
    setModalCategoryId(String(entry.categoryId));
    setModalStoreId(entry.storeId ? String(entry.storeId) : '');
    setModalMemo(entry.memo || '');
    setModalNote(entry.note || '');
    setModalFundPoolId(entry.fundPoolId != null ? String(entry.fundPoolId) : (pools.find((p) => p.primary)?.id?.toString() ?? ''));
    setModalExcludeFromSim(entry.excludeFromSimulation ?? false);
    setFormErrors({});
    setModalSubmitError('');
    setIsAddingCategory(false);
    setIsAddingStore(false);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingEntry(null);
    setReceiptScanning(false);
    setReceiptScanMsg('');
    setReceiptScanError('');
  }

  async function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReceiptScanMsg('');
    setReceiptScanError('');
    setReceiptScanning(true);
    try {
      const compressed = await downscaleImage(file);
      const draft: ReceiptDraft = await receiptApi.scan(compressed);

      if (draft.entryDate) setModalDate(draft.entryDate);
      if (draft.totalAmount != null) setModalAmount(withCommas(draft.totalAmount));
      if (draft.suggestedCategoryName) {
        const cat = categories.find((c) => c.name === draft.suggestedCategoryName && c.type === 'EXPENSE');
        if (cat) setModalCategoryId(String(cat.categoryId));
      }
      if (draft.storeName) {
        const store = stores.find((s) => s.name === draft.storeName);
        if (store) setModalStoreId(String(store.storeId));
      }
      // 品名は「店舗\n商品, 値段」形式（バックエンドで構築）。無ければ明細から簡易生成。
      const fallbackMemo = [
        draft.storeName,
        ...(draft.items ?? []).map((i) => `${i.name}${i.price != null ? `, ${i.price}` : ''}`),
      ].filter(Boolean).join('\n');
      const itemMemo = draft.memo ?? fallbackMemo;
      if (itemMemo) setModalMemo(itemMemo);

      setReceiptScanMsg('読み取りました。内容を確認して登録してください。');
    } catch (err) {
      setReceiptScanError(err instanceof ApiError ? err.message : 'レシートの読み取りに失敗しました');
    } finally {
      setReceiptScanning(false);
    }
  }

  async function handleAddCategoryInline() {
    if (!newCategoryName.trim()) return;
    try {
      const newCat = (await categoryApi.create(newCategoryName.trim(), modalType)) as CategoryResponse;
      setCategories([...categories, newCat]);
      setModalCategoryId(String(newCat.categoryId));
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'カテゴリの追加に失敗しました', 'error');
    }
  }

  async function handleAddStoreInline() {
    if (!newStoreName.trim()) return;
    try {
      const newStore = (await storeApi.create(
        newStoreName.trim(),
        newStoreType.trim() ? newStoreType.trim() : undefined
      )) as StoreResponse;
      setStores([...stores, newStore]);
      setModalStoreId(String(newStore.storeId));
      setNewStoreName('');
      setNewStoreType('');
      setIsAddingStore(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '店舗の追加に失敗しました', 'error');
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!modalDate) errors.date = '日付を入力してください';
    if (!modalAmount || toNumber(modalAmount) <= 0) errors.amount = '1円以上の金額を入力してください';
    if (!modalCategoryId) errors.categoryId = 'カテゴリを選択してください';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalSubmitError('');
    if (!validateForm()) return;

    setModalLoading(true);
    try {
      const payload = {
        entryDate: modalDate,
        amount: toNumber(modalAmount),
        categoryId: parseInt(modalCategoryId, 10),
        storeId: modalStoreId ? parseInt(modalStoreId, 10) : null,
        type: modalType,
        memo: modalMemo.trim() || null,
        note: modalNote.trim() || null,
        fundPoolId: modalFundPoolId ? parseInt(modalFundPoolId, 10) : null,
        excludeFromSimulation: modalExcludeFromSim,
      };

      if (editingEntry) {
        await entryApi.update(editingEntry.id, payload);
      } else {
        await entryApi.create(payload);
      }

      writeLast(lastCategoryKey(modalType), modalCategoryId);
      if (modalType === 'EXPENSE' && modalStoreId) writeLast(LAST_STORE_KEY, modalStoreId);

      await fetchEntries();
      fetchRecent();
      fetchPools();
      closeModal();
    } catch (err) {
      setModalSubmitError(err instanceof ApiError ? err.message : '保存に失敗しました。入力内容を確認してください。');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDeleteEntry() {
    if (!editingEntry) return;
    if (!(await confirm({ title: '取引を削除', message: 'この取引レコードを削除してよろしいですか？', confirmText: '削除する', danger: true }))) return;

    setModalLoading(true);
    try {
      await entryApi.delete(editingEntry.id);
      await fetchEntries();
      fetchRecent();
      fetchPools();
      closeModal();
    } catch (err) {
      setModalSubmitError(err instanceof ApiError ? err.message : '削除に失敗しました。');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleQuickEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!quickDate || !quickAmount || !quickCategoryId) {
      toast('日付・金額・カテゴリを入力してください', 'error');
      return;
    }
    setQuickLoading(true);
    try {
      await entryApi.create({
        entryDate: quickDate,
        amount: toNumber(quickAmount),
        categoryId: parseInt(quickCategoryId, 10),
        type: 'EXPENSE',
        memo: quickMemo.trim() || null,
        fundPoolId: pools.find((p) => p.primary)?.id ?? null,
      });
      setQuickAmount('');
      setQuickMemo('');
      await fetchEntries();
      fetchRecent();
      fetchPools();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '登録に失敗しました', 'error');
    } finally {
      setQuickLoading(false);
    }
  }

  // --- 計算値 ---
  const totalIncome = entries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;
  const categoryData = aggregateByCategory(entries).slice(0, 6);
  // 取引履歴は月に依存せず「直近 recentDays 日」を新しい順に表示（もっと見るで拡大）
  const recentCutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - recentDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const sortedEntries = [...recentEntries]
    .filter((e) => e.entryDate >= recentCutoff)
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  const hasMoreRecent = recentDays < 366 && recentEntries.some((e) => e.entryDate < recentCutoff);
  const recentLabel = recentDays <= 7 ? '直近1週間' : recentDays <= 31 ? '直近1ヶ月' : recentDays <= 92 ? '直近3ヶ月' : '直近1年';
  function showMoreRecent() {
    setRecentDays((d) => RECENT_STEPS.find((s) => s > d) ?? 366);
  }

  // 今月のペース
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
  const dailyAvg = daysElapsed > 0 ? Math.round(totalExpense / daysElapsed) : 0;
  const projected = Math.round(dailyAvg * daysInMonth);

  // 日別推移（モバイル ミニグラフ用）
  const dailyInc = new Array(daysInMonth).fill(0);
  const dailyExp = new Array(daysInMonth).fill(0);
  entries.forEach((e) => {
    const d = parseInt(e.entryDate.slice(8, 10), 10);
    if (d >= 1 && d <= daysInMonth) {
      if (e.type === 'INCOME') dailyInc[d - 1] += e.amount;
      else dailyExp[d - 1] += e.amount;
    }
  });
  const maxDaily = Math.max(1, ...dailyInc, ...dailyExp);

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else setMonth(month + 1);
  }

  const monthPill = (
    <div className="month-pill">
      <button className="month-pill-btn" onClick={prevMonth} aria-label="前月" id="prev-month-btn">
        <Icon name="chevron_left" />
      </button>
      <button
        className="month-pill-label"
        onClick={() => setCalendarOpen(true)}
        aria-label="カレンダーを開く"
        title="カレンダーを開く"
      >
        {year}年 {month}月
        <Icon name="calendar_month" size={16} />
      </button>
      <button className="month-pill-btn" onClick={nextMonth} aria-label="翌月" id="next-month-btn">
        <Icon name="chevron_right" />
      </button>
    </div>
  );

  const txnRows = sortedEntries.map((entry) => {
    const line = entry.storeName ? `${entry.categoryName} · ${entry.storeName}` : entry.categoryName;
    return { entry, line };
  });

  return (
    <>
      {/* ============ PC レイアウト ============ */}
      <div className="desktop-only screen">
        <div className="page-head">
          {monthPill}
          <button className="btn-primary" onClick={() => openAddModal()}>
            <Icon name="add" />
            収支を追加
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <Icon name="error" />
            {error}
          </div>
        )}

        <div className="hero">
          <div className="section-label">今月の残高</div>
          <div className="hero-value">{loading ? '—' : formatCurrency(balance)}</div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-label">収入</span>
              <span className="hero-stat-value accent">{loading ? '—' : formatCurrency(totalIncome)}</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">支出</span>
              <span className="hero-stat-value">{loading ? '—' : formatCurrency(totalExpense)}</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">取引</span>
              <span className="hero-stat-value">{loading ? '—' : `${entries.length}件`}</span>
            </div>
          </div>
        </div>

        {/* 総資産・口座 */}
        <div style={{ marginBottom: 28 }}>
          <AssetsSection pools={pools} onReloadPools={fetchPools} />
        </div>

        {loading ? (
          <div className="loading-state">
            <span className="loading-spinner" />
            データを読み込み中...
          </div>
        ) : (
          <div className="home-grid">
            {/* 左: 取引履歴 */}
            <div>
              <div className="section-label stack-label">取引履歴（{recentLabel}）</div>
              {sortedEntries.length > 0 ? (
                <>
                  <div className="card flush">
                    <table className="txn-table">
                      <tbody>
                        {txnRows.map(({ entry, line }) => (
                          <tr
                            key={entry.id}
                            className={`txn-row ${entry.type === 'INCOME' ? 'income' : ''}`}
                            onClick={() => openEditModal(entry)}
                          >
                            <td className="txn-date">{formatDate(entry.entryDate)}</td>
                            <td className="txn-body">
                              {line}
                              {entry.memo && <span className="txn-memo"> {entry.memo}</span>}
                            </td>
                            <td className={`txn-amount ${entry.type === 'INCOME' ? 'income' : ''}`}>
                              {formatSigned(entry.type, entry.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasMoreRecent && (
                    <button className="load-more-btn" onClick={showMoreRecent}>もっと見る</button>
                  )}
                </>
              ) : (
                <div className="card">
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Icon name="receipt_long" />
                    </div>
                    <div className="empty-state-text">{recentLabel}の取引はまだありません</div>
                    <div className="empty-state-hint">「収支を追加」から最初の収支を登録しましょう</div>
                  </div>
                </div>
              )}
            </div>

            {/* 右: カテゴリ別 / ペース / クイック登録 */}
            <div className="home-side">
              <div className="section-label">カテゴリ別支出</div>
              <div className="card">
                {categoryData.length > 0 ? (
                  <div className="bar-list">
                    {categoryData.map((cat) => (
                      <div key={cat.name}>
                        <div className="bar-head">
                          <span className="bar-name">{cat.name}</span>
                          <span className="bar-amount">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${cat.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="kv-note">支出データはまだありません</div>
                )}
              </div>

              <div className="section-label">今月のペース</div>
              <div className="card">
                <div className="kv-row">
                  <span className="kv-key">1日あたり平均支出</span>
                  <span className="kv-val">{formatCurrency(dailyAvg)}</span>
                </div>
                <div className="kv-note">
                  このペースだと月末支出は約 {formatCurrency(projected)} の見込み
                </div>
              </div>

              <div className="section-label">クイック支出登録</div>
              <div className="card">
                <form className="quick-form" onSubmit={handleQuickEntry}>
                  <div className="quick-row">
                    <input
                      className="input"
                      type="date"
                      value={quickDate}
                      onChange={(e) => setQuickDate(e.target.value)}
                      required
                    />
                    <input
                      className="input"
                      type="text"
                      inputMode="numeric"
                      placeholder="金額"
                      value={quickAmount}
                      onChange={(e) => setQuickAmount(withCommas(e.target.value))}
                      required
                    />
                  </div>
                  <select
                    className="select"
                    value={quickCategoryId}
                    onChange={(e) => setQuickCategoryId(e.target.value)}
                    required
                  >
                    <option value="">カテゴリを選択</option>
                    {categories
                      .filter((cat) => cat.type === 'EXPENSE')
                      .map((cat, index) => (
                        <option key={`quick-cat-${cat.categoryId}-${index}`} value={cat.categoryId}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                  <input
                    className="input"
                    type="text"
                    placeholder="メモ（任意）"
                    value={quickMemo}
                    onChange={(e) => setQuickMemo(e.target.value)}
                  />
                  <button type="submit" className="quick-submit" disabled={quickLoading}>
                    {quickLoading ? '登録中...' : '登録する'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ モバイル レイアウト ============ */}
      <div className="mobile-only screen">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="month-pill-btn" onClick={prevMonth} aria-label="前月">
            <Icon name="chevron_left" />
          </button>
          <button
            className="month-pill-label"
            style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}
            onClick={() => setCalendarOpen(true)}
            aria-label="カレンダーを開く"
          >
            {year}年 {month}月
            <Icon name="calendar_month" size={16} />
          </button>
          <button className="month-pill-btn" onClick={nextMonth} aria-label="翌月">
            <Icon name="chevron_right" />
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <Icon name="error" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <span className="loading-spinner" />
            読み込み中...
          </div>
        ) : (
          <>
            {/* 残高カード */}
            <div className="card" style={{ borderRadius: 16, padding: '20px 18px 16px', marginBottom: 20 }}>
              <div className="section-label">今月の残高</div>
              <div className="hero-value" style={{ fontSize: 38, marginTop: 8 }}>
                {formatCurrency(balance)}
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 14, marginBottom: 18 }}>
                <div className="hero-stat">
                  <span className="hero-stat-label" style={{ fontSize: '11.5px' }}>収入</span>
                  <span className="hero-stat-value accent" style={{ fontSize: '14.5px' }}>{formatCurrency(totalIncome)}</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-label" style={{ fontSize: '11.5px' }}>支出</span>
                  <span className="hero-stat-value" style={{ fontSize: '14.5px' }}>{formatCurrency(totalExpense)}</span>
                </div>
              </div>
              {/* ミニ日別推移 */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 52, borderTop: '1px solid var(--hairline-row)', paddingTop: 12 }}>
                {dailyInc.map((inc, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1, minWidth: 4, height: '100%', justifyContent: 'flex-end' }}
                  >
                    <div style={{ width: '100%', borderRadius: 1, background: 'var(--accent)', height: (inc / maxDaily) * 40 }} />
                    <div style={{ width: '100%', borderRadius: 1, background: 'var(--text-faint)', height: (dailyExp[i] / maxDaily) * 40 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '9.5px', color: 'var(--text-faint)' }}>
                <span>{month}/1</span>
                <span>{month}/{Math.round(daysInMonth / 2)}</span>
                <span>{month}/{daysInMonth}</span>
              </div>
            </div>

            {/* 総資産・口座 */}
            <div style={{ marginBottom: 20 }}>
              <AssetsSection pools={pools} onReloadPools={fetchPools} />
            </div>

            <div className="section-label stack-label">取引履歴（{recentLabel}）</div>
            {sortedEntries.length > 0 ? (
              <>
                <div className="card flush">
                  {txnRows.map(({ entry, line }) => (
                    <div
                      key={entry.id}
                      onClick={() => openEditModal(entry)}
                      className={entry.type === 'INCOME' ? 'txn-row income' : 'txn-row'}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', borderBottom: '1px solid var(--hairline-row)' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {formatDate(entry.entryDate)}
                          {entry.memo ? ` ${entry.memo}` : ''}
                        </div>
                      </div>
                      <span className={`txn-amount ${entry.type === 'INCOME' ? 'income' : ''}`} style={{ marginLeft: 12 }}>
                        {formatSigned(entry.type, entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                {hasMoreRecent && (
                  <button className="load-more-btn" onClick={showMoreRecent}>もっと見る</button>
                )}
              </>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Icon name="receipt_long" />
                  </div>
                  <div className="empty-state-text">{recentLabel}の取引はまだありません</div>
                  <div className="empty-state-hint">下の「＋」ボタンから収支を登録しましょう</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB (モバイル) */}
      <button className="fab-btn" onClick={() => openAddModal()} aria-label="収支を追加">
        <Icon name="add" />
      </button>

      {/* ============ カレンダー（記録のある日にドット / 1日ごとのビュー） ============ */}
      {calendarOpen && (
        <CalendarModal
          year={year}
          month={month}
          entries={entries}
          loading={loading}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onEditEntry={(entry) => {
            setCalendarOpen(false);
            openEditModal(entry);
          }}
          onAddOnDay={(dateStr) => {
            setCalendarOpen(false);
            openAddModal(dateStr);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {/* ============ 取引モーダル ============ */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingEntry ? '取引の編集' : '収支の追加'}</h3>
              <button className="modal-close-btn" onClick={closeModal} aria-label="閉じる">
                <Icon name="close" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="modal-body">
                {modalSubmitError && (
                  <div className="error-banner" style={{ margin: 0 }}>
                    <Icon name="error" />
                    {modalSubmitError}
                  </div>
                )}

                {/* 種別セグメント */}
                <div className="type-segment">
                  <button
                    type="button"
                    className={`type-segment-btn expense ${modalType === 'EXPENSE' ? 'active' : ''}`}
                    onClick={() => handleModalTypeChange('EXPENSE')}
                  >
                    支出
                  </button>
                  <button
                    type="button"
                    className={`type-segment-btn income ${modalType === 'INCOME' ? 'active' : ''}`}
                    onClick={() => handleModalTypeChange('INCOME')}
                  >
                    収入
                  </button>
                </div>

                {/* レシート読み取り（新規支出のみ） */}
                {!editingEntry && modalType === 'EXPENSE' && (
                  <div className="receipt-inline">
                    <label className={`receipt-action-btn ${receiptScanning ? 'disabled' : ''}`}>
                      <input type="file" accept="image/*" onChange={handleReceiptFile} disabled={receiptScanning} style={{ display: 'none' }} />
                      <Icon name="photo_camera" />
                      レシートを撮影 / 画像を選択
                    </label>
                    {receiptScanning && (
                      <div className="loading-state" style={{ padding: '4px 0' }}>
                        <span className="loading-spinner" />
                        レシートを読み取り中...
                      </div>
                    )}
                    {receiptScanMsg && (
                      <div className="success-banner" style={{ margin: 0 }}>
                        <Icon name="check_circle" />
                        {receiptScanMsg}
                      </div>
                    )}
                    {receiptScanError && (
                      <div className="error-banner" style={{ margin: 0 }}>
                        <Icon name="error" />
                        {receiptScanError}
                      </div>
                    )}
                  </div>
                )}

                {/* 日付 + 金額 */}
                <div className="modal-field-row">
                  <div className="modal-field">
                    <label htmlFor="modal-date">日付</label>
                    <input
                      id="modal-date"
                      type="date"
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      className={formErrors.date ? 'field-error' : ''}
                      required
                    />
                    {formErrors.date && <span className="field-error-text">{formErrors.date}</span>}
                  </div>
                  <div className="modal-field">
                    <label htmlFor="modal-amount">金額 (円)</label>
                    <input
                      id="modal-amount"
                      type="text"
                      inputMode="numeric"
                      placeholder="1,000"
                      value={modalAmount}
                      onChange={(e) => setModalAmount(withCommas(e.target.value))}
                      className={formErrors.amount ? 'field-error' : ''}
                      required
                    />
                    {formErrors.amount && <span className="field-error-text">{formErrors.amount}</span>}
                  </div>
                </div>

                {/* カテゴリ */}
                <div className="modal-field">
                  <label htmlFor="modal-category">カテゴリ</label>
                  <div className="modal-input-wrap">
                    <select
                      id="modal-category"
                      className="select"
                      value={modalCategoryId}
                      onChange={(e) => setModalCategoryId(e.target.value)}
                      required
                    >
                      <option value="">カテゴリを選択</option>
                      {categories
                        .filter((cat) => cat.type === modalType)
                        .map((cat, index) => (
                          <option key={`modal-cat-${cat.categoryId}-${index}`} value={cat.categoryId}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="modal-inline-add-btn"
                      onClick={() => setIsAddingCategory(!isAddingCategory)}
                      title="新規カテゴリ追加"
                    >
                      <Icon name="add" />
                    </button>
                  </div>
                  {formErrors.categoryId && <span className="field-error-text">{formErrors.categoryId}</span>}

                  {isAddingCategory && (
                    <div className="inline-add-panel">
                      <input
                        type="text"
                        placeholder="新カテゴリ名（例: 外食費）"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                      <button type="button" className="inline-add-save-btn" onClick={handleAddCategoryInline}>
                        追加
                      </button>
                      <button
                        type="button"
                        className="inline-add-cancel-btn"
                        onClick={() => {
                          setIsAddingCategory(false);
                          setNewCategoryName('');
                        }}
                      >
                        閉じる
                      </button>
                    </div>
                  )}
                </div>

                {/* 店舗（支出のみ） */}
                {modalType === 'EXPENSE' && (
                  <div className="modal-field">
                    <label htmlFor="modal-store">店舗 (任意)</label>
                    <div className="modal-input-wrap">
                      <select
                        id="modal-store"
                        className="select"
                        value={modalStoreId}
                        onChange={(e) => setModalStoreId(e.target.value)}
                      >
                        <option value="">なし / 選択解除</option>
                        {stores.map((store, index) => (
                          <option key={`modal-store-${store.storeId}-${index}`} value={store.storeId}>
                            {store.name} {store.type ? `(${store.type})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="modal-inline-add-btn"
                        onClick={() => setIsAddingStore(!isAddingStore)}
                        title="新規店舗追加"
                      >
                        <Icon name="add" />
                      </button>
                    </div>

                    {isAddingStore && (
                      <div className="inline-add-panel" style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            placeholder="新店舗名（例: セブンイレブン）"
                            value={newStoreName}
                            onChange={(e) => setNewStoreName(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <input
                            type="text"
                            placeholder="種別（コンビニ）"
                            value={newStoreType}
                            onChange={(e) => setNewStoreType(e.target.value)}
                            style={{ width: 110, flex: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button type="button" className="inline-add-save-btn" onClick={handleAddStoreInline}>
                            追加
                          </button>
                          <button
                            type="button"
                            className="inline-add-cancel-btn"
                            onClick={() => {
                              setIsAddingStore(false);
                              setNewStoreName('');
                              setNewStoreType('');
                            }}
                          >
                            閉じる
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 品名（購入した物・明細） */}
                <div className="modal-field">
                  <label htmlFor="modal-memo">品名 (任意)</label>
                  <textarea
                    id="modal-memo"
                    rows={2}
                    placeholder="購入した物・明細（例: 牛乳, 220 / 卵, 250）"
                    value={modalMemo}
                    onChange={(e) => setModalMemo(e.target.value)}
                  />
                </div>

                {/* メモ（自由記入） */}
                <div className="modal-field">
                  <label htmlFor="modal-note">メモ (任意)</label>
                  <textarea
                    id="modal-note"
                    rows={2}
                    placeholder="補足・メモなど"
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                  />
                </div>

                {/* 口座（資金プール） */}
                {pools.length > 0 && (
                  <div className="modal-field">
                    <label htmlFor="modal-pool">口座</label>
                    <select
                      id="modal-pool"
                      className="select"
                      value={modalFundPoolId}
                      onChange={(e) => setModalFundPoolId(e.target.value)}
                    >
                      {pools.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.primary ? '（主口座）' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* シミュレーション除外（手持ち残高の調整用など） */}
                <div className="modal-field">
                  <label className="modal-check">
                    <input
                      type="checkbox"
                      checked={modalExcludeFromSim}
                      onChange={(e) => setModalExcludeFromSim(e.target.checked)}
                    />
                    <span>
                      シミュレーションに反映しない
                      <small>
                        手持ちを実額に合わせるための調整などに。口座残高・総資産には反映されますが、貯蓄予測の収支学習からは除外されます。
                      </small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <div className={`modal-btn-group ${editingEntry ? 'has-delete' : ''}`}>
                  {editingEntry && (
                    <button
                      type="button"
                      className="modal-btn danger"
                      onClick={handleDeleteEntry}
                      disabled={modalLoading}
                      title="削除する"
                    >
                      <Icon name="delete" />
                    </button>
                  )}
                  <button type="button" className="modal-btn secondary" onClick={closeModal} disabled={modalLoading}>
                    キャンセル
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={modalLoading}>
                    {modalLoading ? '保存中...' : '保存する'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
