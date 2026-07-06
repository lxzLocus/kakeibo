'use client';

import { useState, useEffect, useCallback } from 'react';
import { mealApi, inventoryApi, ApiError } from '@/lib/api';
import { MealResponse, MealRequest, InventoryResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';

const MEAL_ICONS: Record<string, string> = {
  BREAKFAST: 'wb_twilight',
  LUNCH: 'light_mode',
  DINNER: 'dark_mode',
  SNACK: 'cookie',
};

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: '朝食',
  LUNCH: '昼食',
  DINNER: '夕食',
  SNACK: '間食',
};

const MEAL_TYPES: ('BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK')[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function MealsPage() {
  const [meals, setMeals] = useState<MealResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventories, setInventories] = useState<InventoryResponse[]>([]);

  const [modalDatetime, setModalDatetime] = useState('');
  const [modalType, setModalType] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'>('DINNER');
  const [modalTitle, setModalTitle] = useState('');
  const [modalServings, setModalServings] = useState('1');
  const [modalNote, setModalNote] = useState('');
  const [modalItems, setModalItems] = useState<{ inventoryId: string; quantity: string }[]>([]);

  const [modalLoading, setModalLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchMeals = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const since = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
      const until = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

      const data = await mealApi.getAll(since, until);
      setMeals(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInventories = async () => {
    try {
      const data = await inventoryApi.getAll();
      setInventories(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMeals();
    fetchInventories();
  }, [fetchMeals]);

  function openModal() {
    const today = new Date();
    const dt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T${String(today.getHours()).padStart(2, '0')}:00`;
    setModalDatetime(dt);
    setModalType('DINNER');
    setModalTitle('');
    setModalServings('1');
    setModalNote('');
    setModalItems([]);
    setFormError('');
    setIsModalOpen(true);
  }

  function addModalItem() {
    setModalItems([...modalItems, { inventoryId: '', quantity: '1' }]);
  }

  function updateModalItem(index: number, field: 'inventoryId' | 'quantity', value: string) {
    const newItems = [...modalItems];
    newItems[index][field] = value;
    setModalItems(newItems);
  }

  function removeModalItem(index: number) {
    const newItems = [...modalItems];
    newItems.splice(index, 1);
    setModalItems(newItems);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!modalTitle.trim() || !modalDatetime) {
      setFormError('必須項目を入力してください');
      return;
    }

    const validItems = modalItems
      .filter((i) => i.inventoryId && parseFloat(i.quantity) > 0)
      .map((i) => ({ inventoryId: parseInt(i.inventoryId), quantityUsed: parseFloat(i.quantity) }));

    setModalLoading(true);
    try {
      const payload: MealRequest = {
        mealDatetime: modalDatetime + ':00',
        mealType: modalType,
        title: modalTitle,
        servings: parseInt(modalServings),
        note: modalNote || undefined,
        items: validItems,
      };

      await mealApi.create(payload);
      await fetchMeals();
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '保存に失敗しました');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await mealApi.delete(id);
      await fetchMeals();
    } catch {
      alert('エラーが発生しました');
    }
  }

  return (
    <>
      <div className="page-head tight">
        <h1 className="page-title">食事ログ</h1>
        <button className="btn-primary" onClick={openModal}>
          <Icon name="add" />
          食事を記録
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <span className="loading-spinner" />
          読み込み中...
        </div>
      ) : error ? (
        <div className="error-banner">
          <Icon name="error" />
          {error}
        </div>
      ) : meals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="restaurant" />
          </div>
          <div className="empty-state-text">食事の記録がありません</div>
          <div className="empty-state-hint">「食事を記録」から登録しましょう</div>
        </div>
      ) : (
        <div className="meal-list">
          {meals.map((meal) => (
            <div key={meal.id} className="meal-card">
              <div className="meal-head">
                <div className="meal-left">
                  <div className="meal-badge">
                    <Icon name={MEAL_ICONS[meal.mealType] ?? 'restaurant'} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="meal-title">{meal.title}</div>
                    <div className="meal-meta">
                      {formatDate(meal.mealDatetime)} · {MEAL_LABELS[meal.mealType]} · {meal.servings}人分
                    </div>
                  </div>
                </div>
                <div className="meal-right">
                  <div className="meal-cost">
                    <div className="meal-cost-label">総コスト</div>
                    <div className="meal-cost-value">{formatCurrency(meal.estimatedTotalCost)}</div>
                  </div>
                  <div className="meal-cost">
                    <div className="meal-cost-label">1人分</div>
                    <div className="meal-cost-value accent">{formatCurrency(meal.costPerServing)}</div>
                  </div>
                  <button className="meal-del" onClick={() => handleDelete(meal.id)} aria-label="削除">
                    <Icon name="delete" />
                  </button>
                </div>
              </div>

              {meal.items.length > 0 && (
                <div className="meal-items">
                  {meal.items.map((item) => (
                    <div key={item.id} className="meal-item">
                      <span className="meal-item-name">
                        {item.itemName} <span className="meal-item-qty">× {item.quantityUsed}</span>
                      </span>
                      <span className="meal-item-cost">{formatCurrency(item.estimatedCost)}</span>
                    </div>
                  ))}
                </div>
              )}

              {meal.note && <div className="meal-note">{meal.note}</div>}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">食事の記録</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="閉じる">
                <Icon name="close" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="error-banner" style={{ margin: 0 }}>
                    <Icon name="error" />
                    {formError}
                  </div>
                )}

                <div className="modal-field">
                  <label>日時</label>
                  <input type="datetime-local" value={modalDatetime} onChange={(e) => setModalDatetime(e.target.value)} required />
                </div>

                <div className="modal-field">
                  <label>食事タイプ</label>
                  <div className="segment">
                    {MEAL_TYPES.map((t) => (
                      <button key={t} type="button" className={`segment-btn ${modalType === t ? 'active' : ''}`} onClick={() => setModalType(t)}>
                        {MEAL_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="modal-field">
                  <label>メニュー名</label>
                  <input type="text" value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} required placeholder="例: カレーライス" />
                </div>

                <div className="modal-field">
                  <label>何人分？</label>
                  <input type="number" min="1" value={modalServings} onChange={(e) => setModalServings(e.target.value)} required />
                </div>

                <div className="modal-field">
                  <label>使用した食材</label>
                  <div className="ingredient-selector">
                    {modalItems.map((item, index) => (
                      <div key={index} className="ingredient-row">
                        <select className="select" value={item.inventoryId} onChange={(e) => updateModalItem(index, 'inventoryId', e.target.value)}>
                          <option value="">食材を選択</option>
                          {inventories.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.itemName}（残り {inv.quantity}{inv.unit}）
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          placeholder="使用量"
                          value={item.quantity}
                          onChange={(e) => updateModalItem(index, 'quantity', e.target.value)}
                          style={{ flex: '0 0 84px' }}
                        />
                        <button type="button" className="remove-btn" onClick={() => removeModalItem(index)} aria-label="削除">
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="add-ingredient-btn" onClick={addModalItem}>
                      ＋ 食材を追加
                    </button>
                  </div>
                </div>

                <div className="modal-field">
                  <label>メモ (任意)</label>
                  <textarea rows={2} value={modalNote} onChange={(e) => setModalNote(e.target.value)} placeholder="美味しかった！など" />
                </div>
              </div>
              <div className="modal-footer">
                <div className="modal-btn-group">
                  <button type="button" className="modal-btn secondary" onClick={() => setIsModalOpen(false)}>
                    キャンセル
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={modalLoading}>
                    {modalLoading ? '保存中...' : '記録する'}
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
