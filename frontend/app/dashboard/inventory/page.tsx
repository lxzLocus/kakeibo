'use client';

import { useState, useEffect, useCallback } from 'react';
import { inventoryApi, ApiError } from '@/lib/api';
import { InventoryResponse, InventoryRequest } from '@/types';

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined) return '---';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '---';
  const date = new Date(dateStr + 'T00:00:00');
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function InventoryPage() {
  const [inventories, setInventories] = useState<InventoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<string>(''); // '' = All

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
    try {
      const data = await inventoryApi.getAll(activeTab || undefined);
      setInventories(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('データの取得に失敗しました');
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
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError('保存に失敗しました');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleConsume(id: number) {
    if (!confirm('この食材を使い切りましたか？')) return;
    try {
      await inventoryApi.consume(id);
      await fetchInventories();
    } catch (err) {
      alert('エラーが発生しました');
    }
  }
  
  async function handleDelete(id: number) {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await inventoryApi.delete(id);
      await fetchInventories();
    } catch (err) {
      alert('エラーが発生しました');
    }
  }

  return (
    <div style={{ padding: '1.5rem 1rem' }}>
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">🥬 食材在庫管理</h2>
      </div>

      <div className="mobile-tabs" style={{ marginBottom: '1.5rem', maxWidth: '500px' }}>
        <button className={`mobile-tab-btn ${activeTab === '' ? 'active' : ''}`} onClick={() => setActiveTab('')}>すべて</button>
        <button className={`mobile-tab-btn ${activeTab === 'REFRIGERATED' ? 'active' : ''}`} onClick={() => setActiveTab('REFRIGERATED')}>🧊 冷蔵</button>
        <button className={`mobile-tab-btn ${activeTab === 'FROZEN' ? 'active' : ''}`} onClick={() => setActiveTab('FROZEN')}>❄️ 冷凍</button>
        <button className={`mobile-tab-btn ${activeTab === 'ROOM_TEMP' ? 'active' : ''}`} onClick={() => setActiveTab('ROOM_TEMP')}>🏠 常温</button>
      </div>

      {loading ? (
        <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>
      ) : error ? (
        <div className="auth-error-banner">⚠️ {error}</div>
      ) : inventories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <div className="empty-state-text">在庫がありません</div>
          <div className="empty-state-hint">右下の「＋」ボタンから食材を登録しましょう</div>
        </div>
      ) : (
        <div className="inventory-grid">
          {inventories.map((inv) => (
            <div key={inv.id} className={`inventory-card storage-${inv.storage.toLowerCase()}`}>
              <div className="inventory-card-header">
                <span className="inventory-item-name">{inv.itemName}</span>
                <div>
                  <span className="inventory-quantity">{inv.quantity}</span>
                  <span className="inventory-quantity-unit">{inv.unit}</span>
                </div>
              </div>
              
              <div className="inventory-details">
                <div className="inventory-detail-row">
                  <span>購入価格</span>
                  <span>{formatCurrency(inv.purchasePrice)}</span>
                </div>
                <div className="inventory-detail-row">
                  <span>購入日</span>
                  <span>{formatDate(inv.purchaseDate)}</span>
                </div>
                <div className="inventory-detail-row" style={{ alignItems: 'center', marginTop: '0.25rem' }}>
                  <span>消費期限</span>
                  <span>
                    {inv.daysUntilExpiry !== undefined ? (
                      <span className={`expiry-badge ${inv.daysUntilExpiry < 0 ? 'expired' : inv.daysUntilExpiry <= 3 ? 'danger' : inv.daysUntilExpiry <= 7 ? 'warning' : 'safe'}`}>
                        {inv.daysUntilExpiry < 0 ? '期限切れ' : `あと ${inv.daysUntilExpiry} 日`}
                      </span>
                    ) : (
                      formatDate(inv.expiryDate)
                    )}
                  </span>
                </div>
              </div>
              
              <div className="inventory-actions">
                <button className="btn-consume" onClick={() => handleConsume(inv.id)}>✅ 使い切った</button>
                <button className="btn-consume" style={{ flex: 'none', width: 'auto', background: 'transparent', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }} onClick={() => handleDelete(inv.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab-btn" onClick={openModal} aria-label="在庫を追加">＋</button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🛒 在庫の追加</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="auth-error-banner" style={{ margin: 0 }}>⚠️ {formError}</div>}
                
                <div className="modal-field">
                  <label>食材名</label>
                  <input type="text" value={modalItemName} onChange={(e) => setModalItemName(e.target.value)} required placeholder="例: 豚こま肉" />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="modal-field" style={{ flex: 1 }}>
                    <label>数量</label>
                    <input type="number" min="0.1" step="0.1" value={modalQuantity} onChange={(e) => setModalQuantity(e.target.value)} required />
                  </div>
                  <div className="modal-field" style={{ flex: 1 }}>
                    <label>単位</label>
                    <input type="text" value={modalUnit} onChange={(e) => setModalUnit(e.target.value)} placeholder="個, g, パック" />
                  </div>
                </div>

                <div className="modal-field">
                  <label>購入価格 (円)</label>
                  <input type="number" min="1" value={modalPrice} onChange={(e) => setModalPrice(e.target.value)} placeholder="250" />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="modal-field" style={{ flex: 1 }}>
                    <label>購入日</label>
                    <input type="date" value={modalPurchaseDate} onChange={(e) => setModalPurchaseDate(e.target.value)} />
                  </div>
                  <div className="modal-field" style={{ flex: 1 }}>
                    <label>消費期限</label>
                    <input type="date" value={modalExpiryDate} onChange={(e) => setModalExpiryDate(e.target.value)} />
                  </div>
                </div>

                <div className="modal-field">
                  <label>保管場所</label>
                  <select value={modalStorage} onChange={(e) => setModalStorage(e.target.value as any)}>
                    <option value="REFRIGERATED">冷蔵 (Refrigerated)</option>
                    <option value="FROZEN">冷凍 (Frozen)</option>
                    <option value="ROOM_TEMP">常温 (Room Temp)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <div className="modal-btn-group">
                  <button type="button" className="modal-btn secondary" onClick={() => setIsModalOpen(false)}>キャンセル</button>
                  <button type="submit" className="modal-btn primary" disabled={modalLoading}>{modalLoading ? '保存中...' : '追加する'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
