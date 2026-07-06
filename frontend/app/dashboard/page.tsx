'use client';

import { useState, useEffect, useCallback } from 'react';
import { entryApi, categoryApi, storeApi, importApi, receiptApi, ApiError } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { EntryResponse, CategoryResponse, StoreResponse, ImportResult, ReceiptDraft } from '@/types';

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
    // 変換に失敗した場合は元ファイルをそのまま使う
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${m}/${d}(${w})`;
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
      const name = e.categoryName;
      map.set(name, (map.get(name) || 0) + e.amount);
    });

  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const maxAmount = sorted.length > 0 ? sorted[0][1] : 1;
  return sorted.map(([name, amount], i) => ({
    name,
    amount,
    percentage: (amount / maxAmount) * 100,
    colorIndex: i % 8,
  }));
}

// ==========================================
// インポートパネル コンポーネント
// ==========================================

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [format, setFormat] = useState<'csv' | 'markdown'>('csv');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const CSV_PLACEHOLDER = `日付,店舗,カテゴリ,金額,メモ
2026-05-01,ライフ,食費,1500,お昼ご飯
2026-05-02,セブンイレブン,日用品,320,洗剤`;

  const MD_PLACEHOLDER = `---
date: 2026-05-01
store: オオゼキ
type: grocery
total: 719
---
- 牛乳 220
- 豚こま 376
- トマト 123`;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    // フォーマット自動判定
    if (text.trimStart().startsWith('---')) {
      setFormat('markdown');
    } else {
      setFormat('csv');
    }
  }

  async function handleImport() {
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await importApi.import(format, content);
      setResult(res);
      if (res.successCount > 0) {
        onImported();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setResult({
          totalRows: 0, successCount: 0, errorCount: 1,
          errors: [err.message], createdEntryIds: [],
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="import-panel">
      <h3>📥 データ取込</h3>

      {/* フォーマット選択 */}
      <div className="import-format-selector">
        <button
          className={`import-format-btn ${format === 'csv' ? 'active' : ''}`}
          onClick={() => setFormat('csv')}
        >
          CSV
        </button>
        <button
          className={`import-format-btn ${format === 'markdown' ? 'active' : ''}`}
          onClick={() => setFormat('markdown')}
        >
          Markdown
        </button>
      </div>

      {/* ファイル選択 */}
      <div className="import-file-drop">
        <label>
          📎 ファイルを選択、またはドラッグ&ドロップ
          <input type="file" accept=".csv,.md,.txt" onChange={handleFileSelect} />
        </label>
      </div>

      {/* テキスト入力 */}
      <textarea
        className="import-textarea"
        placeholder={format === 'csv' ? CSV_PLACEHOLDER : MD_PLACEHOLDER}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {/* アクション */}
      <div className="import-actions">
        <button
          className="import-btn secondary"
          onClick={() => { setContent(''); setResult(null); }}
        >
          クリア
        </button>
        <button
          className="import-btn primary"
          onClick={handleImport}
          disabled={!content.trim() || loading}
        >
          {loading ? 'インポート中...' : 'インポート実行'}
        </button>
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="import-result">
          <div className="import-result-header">
            <div className="import-result-stat">
              成功
              <strong className="success">{result.successCount.toLocaleString()} 件</strong>
            </div>
            <div className="import-result-stat">
              エラー
              <strong className={result.errorCount > 0 ? 'error' : 'success'}>{result.errorCount.toLocaleString()} 件</strong>
            </div>
            <div className="import-result-stat">
              処理行数
              <strong>{result.totalRows}</strong>
            </div>
          </div>
          {result.errors.length > 0 && (
            <ul className="import-result-errors">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// メインダッシュボードページ
// ==========================================

export default function DashboardPage() {
  const [entries, setEntries] = useState<EntryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const user = getUser();

  // カテゴリ・店舗の一覧データ
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [stores, setStores] = useState<StoreResponse[]>([]);

  // モーダル表示状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryResponse | null>(null);

  // フォーム入力値
  const [modalType, setModalType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [modalDate, setModalDate] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalCategoryId, setModalCategoryId] = useState('');
  const [modalStoreId, setModalStoreId] = useState('');
  const [modalMemo, setModalMemo] = useState('');

  // レシートOCR状態
  const [receiptScanning, setReceiptScanning] = useState(false);
  const [receiptScanMsg, setReceiptScanMsg] = useState('');
  const [receiptScanError, setReceiptScanError] = useState('');

  // インライン追加状態
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreType, setNewStoreType] = useState('');

  // フォームのエラーと送信状態
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalSubmitError, setModalSubmitError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // モバイルタブ
  const [mobileTab, setMobileTab] = useState<'entries' | 'import'>('entries');

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
      const data = await entryApi.getAll(since, until) as EntryResponse[];
      setEntries(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('データの取得に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const fetchCategoriesAndStores = useCallback(async () => {
    try {
      const catData = await categoryApi.getAll() as CategoryResponse[];
      const storeData = await storeApi.getAll() as StoreResponse[];
      setCategories(catData);
      setStores(storeData);
    } catch (err) {
      console.error('カテゴリまたは店舗の取得に失敗しました', err);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchCategoriesAndStores();
  }, [fetchEntries, fetchCategoriesAndStores]);

  // --- モーダル操作 ---
  // 指定タイプで前回選択したカテゴリを復元（存在すれば）。無ければ空。
  function lastCategoryFor(type: 'INCOME' | 'EXPENSE'): string {
    const last = readLast(lastCategoryKey(type));
    return categories.some((c) => String(c.categoryId) === last && c.type === type) ? last : '';
  }

  // 収支タイプ切り替え（カテゴリはタイプ別のため選択を調整）
  function handleModalTypeChange(type: 'INCOME' | 'EXPENSE') {
    setModalType(type);
    setModalCategoryId(lastCategoryFor(type));
    if (type === 'INCOME') setModalStoreId(''); // 収入に店舗は不要
    setIsAddingCategory(false);
  }

  function openAddModal() {
    setEditingEntry(null);
    setModalType('EXPENSE');
    const today = new Date();
    setModalDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    setModalAmount('');
    // 前回入力を復元
    setModalCategoryId(lastCategoryFor('EXPENSE'));
    const lastStore = readLast(LAST_STORE_KEY);
    setModalStoreId(stores.some((s) => String(s.storeId) === lastStore) ? lastStore : '');
    setModalMemo('');
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
    setModalAmount(String(entry.amount));
    setModalCategoryId(String(entry.categoryId));
    setModalStoreId(entry.storeId ? String(entry.storeId) : '');
    setModalMemo(entry.memo || '');
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

  // レシート画像を選択 → 縮小 → ローカルOCR+LLM補正 → フォームへ反映
  async function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを連続で選べるようにリセット
    if (!file) return;
    setReceiptScanMsg('');
    setReceiptScanError('');
    setReceiptScanning(true);
    try {
      const compressed = await downscaleImage(file);
      const draft: ReceiptDraft = await receiptApi.scan(compressed);

      if (draft.entryDate) setModalDate(draft.entryDate);
      if (draft.totalAmount != null) setModalAmount(String(draft.totalAmount));

      if (draft.suggestedCategoryName) {
        // レシートは支出。支出カテゴリの中から照合
        const cat = categories.find((c) => c.name === draft.suggestedCategoryName && c.type === 'EXPENSE');
        if (cat) setModalCategoryId(String(cat.categoryId));
      }
      if (draft.storeName) {
        const store = stores.find((s) => s.name === draft.storeName);
        if (store) setModalStoreId(String(store.storeId));
      }
      const itemsMemo = (draft.items ?? [])
        .map((i) => `${i.name}${i.price != null ? ` ¥${i.price.toLocaleString()}` : ''}`)
        .join(', ');
      const memo = [draft.storeName, itemsMemo].filter(Boolean).join(' / ');
      if (memo) setModalMemo(memo);

      setReceiptScanMsg('読み取りました。内容を確認して登録してください。');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'レシートの読み取りに失敗しました';
      setReceiptScanError(msg);
    } finally {
      setReceiptScanning(false);
    }
  }

  // カテゴリをインラインで作成
  async function handleAddCategoryInline() {
    if (!newCategoryName.trim()) return;
    try {
      // 現在の収支タイプでカテゴリを作成
      const newCat = await categoryApi.create(newCategoryName.trim(), modalType) as CategoryResponse;
      setCategories([...categories, newCat]);
      setModalCategoryId(String(newCat.categoryId));
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert('カテゴリの追加に失敗しました');
    }
  }

  // 店舗をインラインで作成
  async function handleAddStoreInline() {
    if (!newStoreName.trim()) return;
    try {
      const newStore = await storeApi.create(
        newStoreName.trim(),
        newStoreType.trim() ? newStoreType.trim() : undefined
      ) as StoreResponse;
      setStores([...stores, newStore]);
      setModalStoreId(String(newStore.storeId));
      setNewStoreName('');
      setNewStoreType('');
      setIsAddingStore(false);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert('店舗の追加に失敗しました');
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!modalDate) errors.date = '日付を入力してください';
    if (!modalAmount || parseFloat(modalAmount) <= 0) errors.amount = '1円以上の金額を入力してください';
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
        amount: parseFloat(modalAmount),
        categoryId: parseInt(modalCategoryId, 10),
        storeId: modalStoreId ? parseInt(modalStoreId, 10) : null,
        type: modalType,
        memo: modalMemo.trim() || null,
      };

      if (editingEntry) {
        await entryApi.update(editingEntry.id, payload);
      } else {
        await entryApi.create(payload);
      }

      // 前回入力を記憶（次回の初期値に）
      writeLast(lastCategoryKey(modalType), modalCategoryId);
      if (modalType === 'EXPENSE' && modalStoreId) writeLast(LAST_STORE_KEY, modalStoreId);

      await fetchEntries();
      closeModal();
    } catch (err) {
      if (err instanceof ApiError) setModalSubmitError(err.message);
      else setModalSubmitError('保存に失敗しました。入力内容を確認してください。');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDeleteEntry() {
    if (!editingEntry) return;
    if (!confirm('この取引レコードを削除してよろしいですか？')) return;

    setModalLoading(true);
    try {
      await entryApi.delete(editingEntry.id);
      await fetchEntries();
      closeModal();
    } catch (err) {
      if (err instanceof ApiError) setModalSubmitError(err.message);
      else setModalSubmitError('削除に失敗しました。');
    } finally {
      setModalLoading(false);
    }
  }

  // クイック入力 (PC)
  async function handleQuickEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!quickDate || !quickAmount || !quickCategoryId) return;
    setQuickLoading(true);
    try {
      await entryApi.create({
        entryDate: quickDate,
        amount: parseFloat(quickAmount),
        categoryId: parseInt(quickCategoryId, 10),
        type: 'EXPENSE',
        memo: quickMemo.trim() || null,
      });
      setQuickAmount('');
      setQuickMemo('');
      await fetchEntries();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert('登録に失敗しました');
    } finally {
      setQuickLoading(false);
    }
  }

  // --- 計算値 ---
  const totalIncome = entries.filter((e) => e.type === 'INCOME').reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;
  const categoryData = aggregateByCategory(entries);
  const sortedEntries = [...entries].sort((a, b) => b.entryDate.localeCompare(a.entryDate));

  // 月の移動
  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else { setMonth(month + 1); }
  }

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'おはようございます';
    if (hour < 18) return 'こんにちは';
    return 'お疲れさまです';
  }

  // ==========================================
  // サマリーカード (共通)
  // ==========================================
  const summaryCards = (
    <div className="summary-cards">
      <div className="summary-card income">
        <div className="summary-card-header">
          <span className="summary-card-label">収入</span>
          <div className="summary-card-icon">📈</div>
        </div>
        <div className="summary-card-amount positive">
          {loading ? '---' : formatCurrency(totalIncome)}
        </div>
      </div>
      <div className="summary-card expense">
        <div className="summary-card-header">
          <span className="summary-card-label">支出</span>
          <div className="summary-card-icon">📉</div>
        </div>
        <div className="summary-card-amount negative">
          {loading ? '---' : formatCurrency(totalExpense)}
        </div>
      </div>
      <div className="summary-card balance">
        <div className="summary-card-header">
          <span className="summary-card-label">残高</span>
          <div className="summary-card-icon">💎</div>
        </div>
        <div className={`summary-card-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
          {loading ? '---' : formatCurrency(balance)}
        </div>
      </div>
    </div>
  );

  // ==========================================
  // モバイル サマリー（横スクロール）
  // ==========================================
  const mobileSummary = (
    <div className="mobile-summary-scroll">
      <div className="mobile-summary-card">
        <div className="mobile-summary-card-label">収入</div>
        <div className="mobile-summary-card-value positive">{loading ? '---' : formatCurrency(totalIncome)}</div>
      </div>
      <div className="mobile-summary-card">
        <div className="mobile-summary-card-label">支出</div>
        <div className="mobile-summary-card-value negative">{loading ? '---' : formatCurrency(totalExpense)}</div>
      </div>
      <div className="mobile-summary-card">
        <div className="mobile-summary-card-label">残高</div>
        <div className={`mobile-summary-card-value ${balance >= 0 ? 'positive' : 'negative'}`}>
          {loading ? '---' : formatCurrency(balance)}
        </div>
      </div>
      <div className="mobile-summary-card">
        <div className="mobile-summary-card-label">件数</div>
        <div className="mobile-summary-card-value neutral">{entries.length.toLocaleString()}</div>
      </div>
    </div>
  );

  // ==========================================
  // カテゴリ別支出チャート (共通)
  // ==========================================
  const categoryChart = (
    <div className="category-chart">
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">カテゴリ別支出</h2>
      </div>
      {categoryData.length > 0 ? (
        <div className="category-bar-chart">
          {categoryData.map((cat) => (
            <div key={cat.name} className="category-bar-item">
              <div className="category-bar-header">
                <span className="category-bar-name">{cat.name}</span>
                <span className="category-bar-amount">{formatCurrency(cat.amount)}</span>
              </div>
              <div className="category-bar-track">
                <div
                  className={`category-bar-fill cat-color-${cat.colorIndex}`}
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">支出データなし</div>
        </div>
      )}
    </div>
  );

  // ==========================================
  // 取引履歴テーブル (PC)
  // ==========================================
  const entriesTable = (
    <div className="dashboard-section">
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">取引履歴</h2>
        <span style={{ fontSize: '0.8rem', color: 'rgba(148, 163, 184, 0.5)' }}>
          {entries.length.toLocaleString()} 件
        </span>
      </div>
      <div className="entries-table-wrap">
        {sortedEntries.length > 0 ? (
          <table className="entries-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>種別</th>
                <th>カテゴリ</th>
                <th>店舗</th>
                <th>金額</th>
                <th>メモ</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => (
                <tr key={entry.id} onClick={() => openEditModal(entry)}>
                  <td>{formatDate(entry.entryDate)}</td>
                  <td>
                    <span className={`entry-type-badge ${entry.type.toLowerCase()}`}>
                      {entry.type === 'INCOME' ? '収入' : '支出'}
                    </span>
                  </td>
                  <td>{entry.categoryName}</td>
                  <td>{entry.storeName || <span style={{ color: 'rgba(148, 163, 184, 0.3)' }}>—</span>}</td>
                  <td>
                    <span className={`entry-amount ${entry.type.toLowerCase()}`}>
                      {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </span>
                  </td>
                  <td>{entry.memo || <span style={{ color: 'rgba(148, 163, 184, 0.3)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-text">この月の取引はまだありません</div>
            <div className="empty-state-hint">右下の「＋」ボタンから最初の収支を登録しましょう</div>
          </div>
        )}
      </div>
    </div>
  );

  // ==========================================
  // 取引カードリスト (モバイル)
  // ==========================================
  const entriesCardList = (
    <div className="entry-card-list">
      {sortedEntries.length > 0 ? (
        sortedEntries.map((entry) => (
          <div key={entry.id} className="entry-card" onClick={() => openEditModal(entry)}>
            <div className="entry-card-top">
              <span className="entry-card-date">{formatDate(entry.entryDate)}</span>
              <span className={`entry-card-amount ${entry.type.toLowerCase()}`}>
                {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(entry.amount)}
              </span>
            </div>
            <div className="entry-card-bottom">
              <span className="entry-card-category">{entry.categoryName}</span>
              {entry.storeName && <span className="entry-card-store">{entry.storeName}</span>}
              {entry.memo && <span style={{ color: 'rgba(148,163,184,0.3)' }}>· {entry.memo}</span>}
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-text">この月の取引はまだありません</div>
          <div className="empty-state-hint">下の「＋」ボタンから収支を登録しましょう</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ヘッダー */}
      <div className="dashboard-greeting">
        <h1>{getGreeting()}、{user?.username}さん</h1>
        <p>{year}年{month}月の家計サマリー</p>
      </div>

      {/* 月セレクタ */}
      <div className="month-selector">
        <button onClick={prevMonth} aria-label="前月" id="prev-month-btn">◀</button>
        <span className="month-selector-label">{year}年 {month}月</span>
        <button onClick={nextMonth} aria-label="翌月" id="next-month-btn">▶</button>
      </div>

      {error && (
        <div className="auth-error-banner" style={{ marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <span className="loading-spinner" />
          データを読み込み中...
        </div>
      ) : (
        <>
          {/* ======================================== */}
          {/* PC レイアウト (2カラム)                    */}
          {/* ======================================== */}
          <div className="desktop-only">
            {summaryCards}

            <div className="dashboard-2col" style={{ marginTop: '1.5rem' }}>
              {/* 左カラム: カテゴリ + クイック入力 + インポート */}
              <div className="dashboard-sidebar">
                {categoryChart}

                {/* クイック入力ウィジェット */}
                <div className="quick-entry-widget">
                  <h3>⚡ クイック支出登録</h3>
                  <form onSubmit={handleQuickEntry}>
                    <div className="quick-entry-row">
                      <input
                        type="date"
                        value={quickDate}
                        onChange={(e) => setQuickDate(e.target.value)}
                        required
                      />
                      <input
                        type="number"
                        placeholder="金額"
                        min="1"
                        value={quickAmount}
                        onChange={(e) => setQuickAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="quick-entry-row">
                      <select
                        value={quickCategoryId}
                        onChange={(e) => setQuickCategoryId(e.target.value)}
                        required
                      >
                        <option value="">カテゴリ</option>
                        {categories.filter((cat) => cat.type === 'EXPENSE').map((cat, index) => (
                          <option key={`quick-cat-${cat.categoryId}-${index}`} value={cat.categoryId}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="quick-entry-row">
                      <input
                        type="text"
                        placeholder="メモ（任意）"
                        value={quickMemo}
                        onChange={(e) => setQuickMemo(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="quick-entry-submit" disabled={quickLoading}>
                      {quickLoading ? '登録中...' : '登録する'}
                    </button>
                  </form>
                </div>

                {/* インポートパネル (PC) */}
                <ImportPanel onImported={() => { fetchEntries(); fetchCategoriesAndStores(); }} />
              </div>

              {/* 右カラム: 取引テーブル */}
              {entriesTable}
            </div>
          </div>

          {/* ======================================== */}
          {/* モバイル レイアウト (タブ切り替え)          */}
          {/* ======================================== */}
          <div className="mobile-only">
            {/* 横スクロールサマリー */}
            {mobileSummary}

            {/* タブ */}
            <div className="mobile-tabs" style={{ marginTop: '1rem' }}>
              <button
                className={`mobile-tab-btn ${mobileTab === 'entries' ? 'active' : ''}`}
                onClick={() => setMobileTab('entries')}
              >
                📋 取引
              </button>
              <button
                className={`mobile-tab-btn ${mobileTab === 'import' ? 'active' : ''}`}
                onClick={() => setMobileTab('import')}
              >
                📥 取込
              </button>
            </div>

            {/* タブコンテンツ */}
            {mobileTab === 'entries' && entriesCardList}
            {mobileTab === 'import' && (
              <ImportPanel onImported={() => { fetchEntries(); fetchCategoriesAndStores(); }} />
            )}
          </div>
        </>
      )}

      {/* 収支追加 FAB ボタン */}
      <button className="fab-btn mobile-only" onClick={openAddModal} aria-label="収支を追加">
        ＋
      </button>

      {/* ======================================== */}
      {/* 収支追加・編集モーダル                      */}
      {/* ======================================== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingEntry ? '💰 取引の編集' : '💰 収支の追加'}
              </h3>
              <button className="modal-close-btn" onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="modal-body">
                {modalSubmitError && (
                  <div className="auth-error-banner" style={{ margin: 0 }}>
                    ⚠️ {modalSubmitError}
                  </div>
                )}

                {/* 収支タイプ切り替え */}
                <div className="type-switch-group">
                  <button
                    type="button"
                    className={`type-switch-btn expense ${modalType === 'EXPENSE' ? 'active' : ''}`}
                    onClick={() => handleModalTypeChange('EXPENSE')}
                  >
                    支出 (Expense)
                  </button>
                  <button
                    type="button"
                    className={`type-switch-btn income ${modalType === 'INCOME' ? 'active' : ''}`}
                    onClick={() => handleModalTypeChange('INCOME')}
                  >
                    収入 (Income)
                  </button>
                </div>

                {/* レシートから入力（新規の支出のみ）: 撮影 or 画像選択 → OCR → 反映 */}
                {!editingEntry && modalType === 'EXPENSE' && (
                  <div className="receipt-inline">
                    <div className="receipt-upload-actions">
                      <label className={`receipt-action-btn ${receiptScanning ? 'disabled' : ''}`}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptFile}
                          disabled={receiptScanning}
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: '1.5rem' }}>📷</span>
                        レシートを撮影 / 画像を選択
                      </label>
                    </div>
                    {receiptScanning && (
                      <div className="loading-state" style={{ padding: '0.5rem 0' }}>
                        <span className="loading-spinner" />レシートを読み取り中...
                      </div>
                    )}
                    {receiptScanMsg && (
                      <div className="auth-success-banner" style={{ margin: '0.5rem 0 0' }}>✅ {receiptScanMsg}</div>
                    )}
                    {receiptScanError && (
                      <div className="auth-error-banner" style={{ margin: '0.5rem 0 0' }}>⚠️ {receiptScanError}</div>
                    )}
                  </div>
                )}

                {/* 日付 */}
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

                {/* 金額 */}
                <div className="modal-field">
                  <label htmlFor="modal-amount">金額 (円)</label>
                  <input
                    id="modal-amount"
                    type="number"
                    min="1"
                    placeholder="1000"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    className={formErrors.amount ? 'field-error' : ''}
                    required
                  />
                  {formErrors.amount && <span className="field-error-text">{formErrors.amount}</span>}
                </div>

                {/* カテゴリ */}
                <div className="modal-field">
                  <label htmlFor="modal-category">カテゴリ</label>
                  <div className="modal-input-wrap">
                    <select
                      id="modal-category"
                      value={modalCategoryId}
                      onChange={(e) => setModalCategoryId(e.target.value)}
                      className={formErrors.categoryId ? 'field-error' : ''}
                      required
                    >
                      <option value="">-- カテゴリを選択してください --</option>
                      {categories.filter((cat) => cat.type === modalType).map((cat, index) => (
                        <option key={`modal-cat-${cat.categoryId}-${index}`} value={cat.categoryId}>{cat.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="modal-inline-add-btn"
                      onClick={() => setIsAddingCategory(!isAddingCategory)}
                      title="新規カテゴリ追加"
                    >
                      ➕
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
                      <button type="button" className="inline-add-save-btn" onClick={handleAddCategoryInline}>追加</button>
                      <button type="button" className="inline-add-cancel-btn" onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}>閉じる</button>
                    </div>
                  )}
                </div>

                {/* 店舗（支出のみ。収入では非表示） */}
                {modalType === 'EXPENSE' && (
                <div className="modal-field">
                  <label htmlFor="modal-store">店舗 (任意)</label>
                  <div className="modal-input-wrap">
                    <select
                      id="modal-store"
                      value={modalStoreId}
                      onChange={(e) => setModalStoreId(e.target.value)}
                    >
                      <option value="">-- なし / 選択解除 --</option>
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
                      ➕
                    </button>
                  </div>

                  {isAddingStore && (
                    <div className="inline-add-panel" style={{ flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          type="text"
                          placeholder="新店舗名（例: セブンイレブン）"
                          value={newStoreName}
                          onChange={(e) => setNewStoreName(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="text"
                          placeholder="種別（例: コンビニ）"
                          value={newStoreType}
                          onChange={(e) => setNewStoreType(e.target.value)}
                          style={{ width: '100px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button type="button" className="inline-add-save-btn" onClick={handleAddStoreInline}>追加</button>
                        <button type="button" className="inline-add-cancel-btn" onClick={() => { setIsAddingStore(false); setNewStoreName(''); setNewStoreType(''); }}>閉じる</button>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* メモ */}
                <div className="modal-field">
                  <label htmlFor="modal-memo">メモ (任意)</label>
                  <textarea
                    id="modal-memo"
                    rows={2}
                    placeholder="購入したものや詳細など"
                    value={modalMemo}
                    onChange={(e) => setModalMemo(e.target.value)}
                  />
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
                      🗑️
                    </button>
                  )}
                  <button
                    type="submit"
                    className="modal-btn primary"
                    disabled={modalLoading}
                  >
                    {modalLoading ? '保存中...' : '保存する'}
                  </button>
                  <button
                    type="button"
                    className="modal-btn secondary"
                    onClick={closeModal}
                    disabled={modalLoading}
                  >
                    キャンセル
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
