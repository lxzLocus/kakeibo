'use client';

import { useState, useEffect, useCallback } from 'react';
import { entryApi, categoryApi, storeApi, ApiError } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { EntryResponse, CategoryResponse, StoreResponse } from '@/types';

/**
 * 金額を日本円フォーマットで表示
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * 日付をフォーマット (5月23日(金))
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${m}/${d}(${w})`;
}

/**
 * 月の開始日・終了日を取得
 */
function getMonthRange(year: number, month: number) {
  const since = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const until = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { since, until };
}

/**
 * カテゴリ別集計
 */
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

  // 新規追加モーダルを開く
  function openAddModal() {
    setEditingEntry(null);
    setModalType('EXPENSE');
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setModalDate(`${yyyy}-${mm}-${dd}`);
    
    setModalAmount('');
    setModalCategoryId('');
    setModalStoreId('');
    setModalMemo('');
    setFormErrors({});
    setModalSubmitError('');
    setIsAddingCategory(false);
    setIsAddingStore(false);
    
    setIsModalOpen(true);
  }

  // 編集モーダルを開く
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
  }

  // カテゴリをインラインで作成
  async function handleAddCategoryInline() {
    if (!newCategoryName.trim()) return;
    try {
      const newCat = await categoryApi.create(newCategoryName.trim()) as CategoryResponse;
      setCategories([...categories, newCat]);
      setModalCategoryId(String(newCat.id));
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('カテゴリの追加に失敗しました');
      }
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
      setModalStoreId(String(newStore.id));
      setNewStoreName('');
      setNewStoreType('');
      setIsAddingStore(false);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('店舗の追加に失敗しました');
      }
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

      await fetchEntries();
      closeModal();
    } catch (err) {
      if (err instanceof ApiError) {
        setModalSubmitError(err.message);
      } else {
        setModalSubmitError('保存に失敗しました。入力内容を確認してください。');
      }
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
      if (err instanceof ApiError) {
        setModalSubmitError(err.message);
      } else {
        setModalSubmitError('削除に失敗しました。');
      }
    } finally {
      setModalLoading(false);
    }
  }

  // サマリー計算
  const totalIncome = entries
    .filter((e) => e.type === 'INCOME')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries
    .filter((e) => e.type === 'EXPENSE')
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;

  // カテゴリ別
  const categoryData = aggregateByCategory(entries);

  // 月の移動
  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  // 挨拶
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'おはようございます';
    if (hour < 18) return 'こんにちは';
    return 'お疲れさまです';
  }

  return (
    <>
      {/* 挨拶 */}
      <div className="dashboard-greeting">
        <h1>{getGreeting()}、{user?.username}さん</h1>
        <p>{year}年{month}月の家計サマリー</p>
      </div>

      {/* 月セレクタ */}
      <div className="month-selector">
        <button onClick={prevMonth} aria-label="前月" id="prev-month-btn">
          ◀
        </button>
        <span className="month-selector-label">
          {year}年 {month}月
        </span>
        <button onClick={nextMonth} aria-label="翌月" id="next-month-btn">
          ▶
        </button>
      </div>

      {/* サマリーカード */}
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

      {/* エラー表示 */}
      {error && (
        <div className="auth-error-banner" style={{ marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* コンテンツエリア */}
      {loading ? (
        <div className="loading-state">
          <span className="loading-spinner" />
          データを読み込み中...
        </div>
      ) : (
        <>
          {/* カテゴリ別支出 & 取引履歴 */}
          <div className="category-breakdown">
            {/* カテゴリ別支出バーチャート */}
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
                        <span className="category-bar-amount">
                          {formatCurrency(cat.amount)}
                        </span>
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

            {/* 月間統計 */}
            <div className="category-chart">
              <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">月間統計</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(148, 163, 184, 0.6)', marginBottom: '0.25rem' }}>
                    取引件数
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>
                    {entries.length}<span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'rgba(148, 163, 184, 0.7)' }}> 件</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(148, 163, 184, 0.6)', marginBottom: '0.25rem' }}>
                    収入件数
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2dd4a0' }}>
                    {entries.filter(e => e.type === 'INCOME').length}<span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'rgba(148, 163, 184, 0.7)' }}> 件</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(148, 163, 184, 0.6)', marginBottom: '0.25rem' }}>
                    支出件数
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
                    {entries.filter(e => e.type === 'EXPENSE').length}<span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'rgba(148, 163, 184, 0.7)' }}> 件</span>
                  </div>
                </div>
                {totalExpense > 0 && entries.filter(e => e.type === 'EXPENSE').length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(148, 163, 184, 0.6)', marginBottom: '0.25rem' }}>
                      1日あたりの平均支出
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f97316' }}>
                      {formatCurrency(Math.round(totalExpense / new Date(year, month, 0).getDate()))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 取引履歴テーブル */}
          <div className="dashboard-section" style={{ marginTop: '2rem' }}>
            <div className="dashboard-section-header">
              <h2 className="dashboard-section-title">取引履歴</h2>
              <span style={{ fontSize: '0.8rem', color: 'rgba(148, 163, 184, 0.5)' }}>
                {entries.length} 件
              </span>
            </div>

            <div className="entries-table-wrap">
              {entries.length > 0 ? (
                <table className="entries-table">
                  <thead>
                    <tr>
                      <th>日付</th>
                      <th>種別</th>
                      <th>カテゴリ</th>
                      <th className="hide-mobile">店舗</th>
                      <th>金額</th>
                      <th className="hide-mobile">メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries
                      .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
                      .map((entry) => (
                        <tr key={entry.id} onClick={() => openEditModal(entry)}>
                          <td>{formatDate(entry.entryDate)}</td>
                          <td>
                            <span className={`entry-type-badge ${entry.type.toLowerCase()}`}>
                              {entry.type === 'INCOME' ? '収入' : '支出'}
                            </span>
                          </td>
                          <td>{entry.categoryName}</td>
                          <td className="hide-mobile">
                            {entry.storeName || <span style={{ color: 'rgba(148, 163, 184, 0.3)' }}>—</span>}
                          </td>
                          <td>
                            <span className={`entry-amount ${entry.type.toLowerCase()}`}>
                              {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(entry.amount)}
                            </span>
                          </td>
                          <td className="hide-mobile">
                            {entry.memo || <span style={{ color: 'rgba(148, 163, 184, 0.3)' }}>—</span>}
                          </td>
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
        </>
      )}

      {/* 収支追加 FAB ボタン */}
      <button className="fab-btn" onClick={openAddModal} aria-label="収支を追加">
        ＋
      </button>

      {/* 収支追加・編集モーダル */}
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
                    onClick={() => setModalType('EXPENSE')}
                  >
                    支出 (Expense)
                  </button>
                  <button
                    type="button"
                    className={`type-switch-btn income ${modalType === 'INCOME' ? 'active' : ''}`}
                    onClick={() => setModalType('INCOME')}
                  >
                    収入 (Income)
                  </button>
                </div>

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
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
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
                      ➕
                    </button>
                  </div>
                  {formErrors.categoryId && <span className="field-error-text">{formErrors.categoryId}</span>}

                  {/* カテゴリ インライン追加パネル */}
                  {isAddingCategory && (
                    <div className="inline-add-panel">
                      <input
                        type="text"
                        placeholder="新カテゴリ名（例: 外食費）"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                      <button
                        type="button"
                        className="inline-add-save-btn"
                        onClick={handleAddCategoryInline}
                      >
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

                {/* 店舗 */}
                <div className="modal-field">
                  <label htmlFor="modal-store">店舗 (任意)</label>
                  <div className="modal-input-wrap">
                    <select
                      id="modal-store"
                      value={modalStoreId}
                      onChange={(e) => setModalStoreId(e.target.value)}
                    >
                      <option value="">-- なし / 選択解除 --</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
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

                  {/* 店舗 インライン追加パネル */}
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
                        <button
                          type="button"
                          className="inline-add-save-btn"
                          onClick={handleAddStoreInline}
                        >
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
                    type="button"
                    className="modal-btn secondary"
                    onClick={closeModal}
                    disabled={modalLoading}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="modal-btn primary"
                    disabled={modalLoading}
                  >
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
