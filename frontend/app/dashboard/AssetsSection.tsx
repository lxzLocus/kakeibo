'use client';

import { useEffect, useState } from 'react';
import { poolApi, transferApi, ApiError } from '@/lib/api';
import { FundPoolResponse, TransferResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { withCommas, toNumber } from '@/lib/format';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function todayStr(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/**
 * 総資産・資金プール（口座）・振替。ホーム画面に統合。
 * プール残高（p.balance）はサーバーで計算済み。プール一覧は親（ホーム）が保持し、
 * 変更時は onReloadPools() で再取得する（収支もプール残高に影響するため）。
 */
export function AssetsSection({
  pools,
  onReloadPools,
}: {
  pools: FundPoolResponse[];
  onReloadPools: () => void | Promise<void>;
}) {
  const [transfers, setTransfers] = useState<TransferResponse[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false); // モバイルのプルタブ（既定は閉じ）

  // 口座モーダル
  const [poolModalOpen, setPoolModalOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<FundPoolResponse | null>(null);
  const [poolName, setPoolName] = useState('');
  const [poolInitial, setPoolInitial] = useState('');
  const [poolPrimary, setPoolPrimary] = useState(false);
  const [poolSaving, setPoolSaving] = useState(false);

  // 振替モーダル
  const [transferOpen, setTransferOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(todayStr());
  const [transferMemo, setTransferMemo] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);

  async function fetchTransfers() {
    try {
      setTransfers(await transferApi.getAll());
    } catch {
      /* 振替履歴は無くても致命的でない */
    }
  }

  useEffect(() => {
    fetchTransfers();
  }, []);

  const total = pools.reduce((sum, p) => sum + p.balance, 0);

  // --- 口座 ---
  function openAddPool() {
    setEditingPool(null);
    setPoolName('');
    setPoolInitial('');
    setPoolPrimary(false);
    setError('');
    setPoolModalOpen(true);
  }

  function openEditPool(p: FundPoolResponse) {
    setEditingPool(p);
    setPoolName(p.name);
    setPoolInitial(withCommas(p.initialBalance ?? 0));
    setPoolPrimary(p.primary);
    setError('');
    setPoolModalOpen(true);
  }

  async function handleSavePool(e: React.FormEvent) {
    e.preventDefault();
    if (!poolName.trim()) return;
    setPoolSaving(true);
    setError('');
    try {
      const initialBalance = poolInitial ? toNumber(poolInitial) : 0;
      if (editingPool) {
        await poolApi.update(editingPool.id, { name: poolName.trim(), initialBalance, primary: poolPrimary || undefined });
      } else {
        await poolApi.create({ name: poolName.trim(), initialBalance, primary: poolPrimary });
      }
      await onReloadPools();
      setPoolModalOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存に失敗しました');
    } finally {
      setPoolSaving(false);
    }
  }

  async function handleDeletePool(p: FundPoolResponse) {
    if (!confirm(`口座「${p.name}」を削除しますか？（この口座の収支は主口座に移ります）`)) return;
    try {
      await poolApi.delete(p.id);
      await onReloadPools();
      fetchTransfers();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '削除に失敗しました');
    }
  }

  // --- 振替 ---
  function openTransfer() {
    setError('');
    setFromId(pools.find((p) => p.primary)?.id.toString() ?? pools[0]?.id.toString() ?? '');
    setToId(pools.find((p) => !p.primary)?.id.toString() ?? '');
    setTransferAmount('');
    setTransferDate(todayStr());
    setTransferMemo('');
    setTransferOpen(true);
  }

  async function handleSaveTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!fromId || !toId || !transferAmount) return;
    setTransferSaving(true);
    setError('');
    try {
      await transferApi.create({
        fromPoolId: parseInt(fromId, 10),
        toPoolId: parseInt(toId, 10),
        amount: toNumber(transferAmount),
        transferDate,
        memo: transferMemo.trim() || null,
      });
      await onReloadPools();
      await fetchTransfers();
      setTransferOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '振替に失敗しました');
    } finally {
      setTransferSaving(false);
    }
  }

  async function handleDeleteTransfer(t: TransferResponse) {
    if (!confirm('この振替を取り消しますか？')) return;
    try {
      await transferApi.delete(t.id);
      await onReloadPools();
      await fetchTransfers();
    } catch {
      alert('取り消しに失敗しました');
    }
  }

  return (
    <div className={`assets${open ? ' assets--open' : ''}`}>
      <div className="assets-head">
        <div className="section-label">総資産</div>
        <button className="btn-outline" onClick={openTransfer} disabled={pools.length < 2}>
          <Icon name="swap_horiz" size={17} />
          振替
        </button>
      </div>
      <div className="assets-total tnum">{formatCurrency(total)}</div>

      <div className="assets-body">
      <div className="pool-grid">
        {pools.map((p) => (
          <div key={p.id} className="pool-card">
            <div className="pool-card-top">
              <span className="pool-name">
                {p.name}
                {p.primary && <span className="pool-badge">主</span>}
              </span>
              <div className="pool-card-actions">
                <button className="shop-icon-btn" onClick={() => openEditPool(p)} aria-label="編集">
                  <Icon name="edit" size={16} />
                </button>
                <button className="shop-icon-btn danger" onClick={() => handleDeletePool(p)} aria-label="削除">
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
            <div className="pool-balance tnum">{formatCurrency(p.balance)}</div>
          </div>
        ))}
        <button className="pool-add" onClick={openAddPool}>
          <Icon name="add" />
          口座を追加
        </button>
      </div>

      {transfers.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 20, marginBottom: 10, display: 'block' }}>最近の振替</div>
          <div className="card flush">
            {transfers.slice(0, 8).map((t) => (
              <div key={t.id} className="transfer-row">
                <div className="transfer-main">
                  <div className="transfer-route">
                    {t.fromPoolName} <Icon name="arrow_forward" size={14} /> {t.toPoolName}
                  </div>
                  <div className="transfer-date">
                    {t.transferDate}
                    {t.memo ? ` · ${t.memo}` : ''}
                  </div>
                </div>
                <span className="transfer-amount tnum">{formatCurrency(t.amount)}</span>
                <button className="shop-icon-btn danger" onClick={() => handleDeleteTransfer(t)} aria-label="取り消し">
                  <Icon name="delete" size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      </div>

      {/* プルタブ（モバイルのみ表示。既定は閉じ・上部だけフェードで覗く） */}
      <button className="assets-tab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={18} />
        {open ? '閉じる' : '口座を見る'}
      </button>

      {/* 口座 追加/編集モーダル */}
      {poolModalOpen && (
        <div className="modal-overlay" onClick={() => setPoolModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingPool ? '口座の編集' : '口座を追加'}</h3>
              <button className="modal-close-btn" onClick={() => setPoolModalOpen(false)} aria-label="閉じる">
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handleSavePool}>
              <div className="modal-body">
                {error && (
                  <div className="error-banner" style={{ margin: 0 }}>
                    <Icon name="error" />
                    {error}
                  </div>
                )}
                <div className="modal-field">
                  <label>口座名</label>
                  <input type="text" value={poolName} onChange={(e) => setPoolName(e.target.value)} placeholder="例: メイン / 投資用" required />
                </div>
                <div className="modal-field">
                  <label>開始残高 (円)</label>
                  <input type="text" inputMode="numeric" value={poolInitial} onChange={(e) => setPoolInitial(withCommas(e.target.value))} placeholder="0" />
                </div>
                <label className="pool-primary-check">
                  <input type="checkbox" checked={poolPrimary} onChange={(e) => setPoolPrimary(e.target.checked)} />
                  主口座にする（収支の既定の紐づけ先）
                </label>
              </div>
              <div className="modal-footer">
                <div className="modal-btn-group">
                  <button type="button" className="modal-btn secondary" onClick={() => setPoolModalOpen(false)}>
                    キャンセル
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={poolSaving}>
                    {poolSaving ? '保存中...' : '保存する'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 振替モーダル */}
      {transferOpen && (
        <div className="modal-overlay" onClick={() => setTransferOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">口座間の振替</h3>
              <button className="modal-close-btn" onClick={() => setTransferOpen(false)} aria-label="閉じる">
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handleSaveTransfer}>
              <div className="modal-body">
                {error && (
                  <div className="error-banner" style={{ margin: 0 }}>
                    <Icon name="error" />
                    {error}
                  </div>
                )}
                <div className="modal-field-row">
                  <div className="modal-field">
                    <label>振替元</label>
                    <select className="select" value={fromId} onChange={(e) => setFromId(e.target.value)} required>
                      {pools.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label>振替先</label>
                    <select className="select" value={toId} onChange={(e) => setToId(e.target.value)} required>
                      <option value="">選択</option>
                      {pools.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-field-row">
                  <div className="modal-field">
                    <label>金額 (円)</label>
                    <input type="text" inputMode="numeric" value={transferAmount} onChange={(e) => setTransferAmount(withCommas(e.target.value))} placeholder="100,000" required />
                  </div>
                  <div className="modal-field">
                    <label>日付</label>
                    <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} required />
                  </div>
                </div>
                <div className="modal-field">
                  <label>メモ (任意)</label>
                  <input type="text" value={transferMemo} onChange={(e) => setTransferMemo(e.target.value)} placeholder="例: 投資用に移動" />
                </div>
                <p className="goal-summary__note" style={{ margin: 0 }}>
                  振替は口座間の移動のため、総資産は変わりません。
                </p>
              </div>
              <div className="modal-footer">
                <div className="modal-btn-group">
                  <button type="button" className="modal-btn secondary" onClick={() => setTransferOpen(false)}>
                    キャンセル
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={transferSaving}>
                    {transferSaving ? '振替中...' : '振替する'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
