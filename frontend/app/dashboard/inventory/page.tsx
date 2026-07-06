'use client';

import { useState, useEffect, useCallback } from 'react';
import { inventoryApi, ApiError } from '@/lib/api';
import { InventoryResponse, InventoryRequest } from '@/types';
import { Icon } from '@/app/_components/Icon';

const STORAGE_ICON: Record<string, string> = {
  REFRIGERATED: 'kitchen',
  FROZEN: 'ac_unit',
  ROOM_TEMP: 'shelves',
};

const TABS: { value: string; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'REFRIGERATED', label: '冷蔵' },
  { value: 'FROZEN', label: '冷凍' },
  { value: 'ROOM_TEMP', label: '常温' },
];

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined) return '—';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function expiryLevel(days: number): 'danger' | 'warning' | 'safe' {
  if (days <= 3) return 'danger';
  if (days <= 7) return 'warning';
  return 'safe';
}

export default function InventoryPage() {
  const [inventories, setInventories] = useState<InventoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItemName, setModalItemName] = useState('');
  const [modalQuantity, setModalQuantity] = useState('1');
  const [modalUnit, setModalUnit] = useState('個');
  const [modalPrice, setModalPrice] = useState('');
  const [modalPurchaseDate, setModalPurchaseDate] = useState('');
  const [modalExpiryDate, setModalExpiryDate] = useState('');
  const [modalStorage, setModalStorage] = useState<'REFRIGERATED' | 'FROZEN' | 'ROOM_TEMP'>('REFRIGERATED');

  const [modalLoading, setModalLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchInventories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await inventoryApi.getAll(activeTab || undefined);
      setInventories(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchInventories();
  }, [fetchInventories]);

  function openModal() {
    setModalItemName('');
    setModalQuantity('1');
    setModalUnit('個');
    setModalPrice('');

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setModalPurchaseDate(todayStr);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;
    setModalExpiryDate(nextWeekStr);

    setModalStorage('REFRIGERATED');
    setFormError('');
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!modalItemName.trim() || !modalQuantity) {
      setFormError('必須項目を入力してください');
      return;
    }

    setModalLoading(true);
    try {
      const payload: InventoryRequest = {
        itemName: modalItemName,
        quantity: parseFloat(modalQuantity),
        unit: modalUnit,
        purchasePrice: modalPrice ? parseFloat(modalPrice) : undefined,
        purchaseDate: modalPurchaseDate || undefined,
        expiryDate: modalExpiryDate || undefined,
        storage: modalStorage,
      };

      await inventoryApi.create(payload);
      await fetchInventories();
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '保存に失敗しました');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleConsume(id: number) {
    if (!confirm('この食材を使い切りましたか？')) return;
    try {
      await inventoryApi.consume(id);
      await fetchInventories();
    } catch {
      alert('エラーが発生しました');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await inventoryApi.delete(id);
      await fetchInventories();
    } catch {
      alert('エラーが発生しました');
    }
  }

  return (
    <>
      <div className="page-head tight">
        <h1 className="page-title">食材在庫管理</h1>
        <button className="btn-primary" onClick={openModal}>
          <Icon name="add" />
          在庫を追加
        </button>
      </div>

      <div className="segment" style={{ maxWidth: 480, marginBottom: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`segment-btn ${activeTab === tab.value ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
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
      ) : inventories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="inventory_2" />
          </div>
          <div className="empty-state-text">在庫がありません</div>
          <div className="empty-state-hint">「在庫を追加」から食材を登録しましょう</div>
        </div>
      ) : (
        <div className="inv-grid">
          {inventories.map((inv) => (
            <div key={inv.id} className="inv-card">
              <div className="inv-head">
                <div className="inv-title">
                  <Icon name={STORAGE_ICON[inv.storage] ?? 'kitchen'} />
                  <span className="inv-name">{inv.itemName}</span>
                </div>
                <div className="inv-qty">
                  <strong>{inv.quantity}</strong>
                  <span>{inv.unit}</span>
                </div>
              </div>

              <div className="inv-details">
                <div className="inv-row">
                  <span>購入価格</span>
                  <span>{formatCurrency(inv.purchasePrice)}</span>
                </div>
                <div className="inv-row">
                  <span>購入日</span>
                  <span>{formatDate(inv.purchaseDate)}</span>
                </div>
                <div className="inv-row">
                  <span>消費期限</span>
                  <span>
                    {inv.daysUntilExpiry !== undefined ? (
                      <span className={`exp-badge ${inv.daysUntilExpiry < 0 ? 'danger' : expiryLevel(inv.daysUntilExpiry)}`}>
                        {inv.daysUntilExpiry < 0 ? '期限切れ' : `あと ${inv.daysUntilExpiry} 日`}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>{formatDate(inv.expiryDate)}</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="inv-actions">
                <button className="inv-consume" onClick={() => handleConsume(inv.id)}>
                  使い切った
                </button>
                <button className="inv-del" onClick={() => handleDelete(inv.id)} aria-label="削除">
                  <Icon name="delete" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">在庫の追加</h3>
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
                  <label>食材名</label>
                  <input type="text" value={modalItemName} onChange={(e) => setModalItemName(e.target.value)} required placeholder="例: 豚こま肉" />
                </div>

                <div className="modal-field-row">
                  <div className="modal-field">
                    <label>数量</label>
                    <input type="number" min="0.1" step="0.1" value={modalQuantity} onChange={(e) => setModalQuantity(e.target.value)} required />
                  </div>
                  <div className="modal-field">
                    <label>単位</label>
                    <input type="text" value={modalUnit} onChange={(e) => setModalUnit(e.target.value)} placeholder="個, g, パック" />
                  </div>
                </div>

                <div className="modal-field">
                  <label>購入価格 (円)</label>
                  <input type="number" min="1" value={modalPrice} onChange={(e) => setModalPrice(e.target.value)} placeholder="250" />
                </div>

                <div className="modal-field-row">
                  <div className="modal-field">
                    <label>購入日</label>
                    <input type="date" value={modalPurchaseDate} onChange={(e) => setModalPurchaseDate(e.target.value)} />
                  </div>
                  <div className="modal-field">
                    <label>消費期限</label>
                    <input type="date" value={modalExpiryDate} onChange={(e) => setModalExpiryDate(e.target.value)} />
                  </div>
                </div>

                <div className="modal-field">
                  <label>保管場所</label>
                  <select className="select" value={modalStorage} onChange={(e) => setModalStorage(e.target.value as 'REFRIGERATED' | 'FROZEN' | 'ROOM_TEMP')}>
                    <option value="REFRIGERATED">冷蔵</option>
                    <option value="FROZEN">冷凍</option>
                    <option value="ROOM_TEMP">常温</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <div className="modal-btn-group">
                  <button type="button" className="modal-btn secondary" onClick={() => setIsModalOpen(false)}>
                    キャンセル
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={modalLoading}>
                    {modalLoading ? '保存中...' : '追加する'}
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
