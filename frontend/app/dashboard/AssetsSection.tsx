'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { poolApi, transferApi, ApiError } from '@/lib/api';
import { FundPoolResponse, FundPoolKind, TransferResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { withCommas, toNumber } from '@/lib/format';
import { useToast, useConfirm } from '@/app/_components/ui';

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

/** 種別ごとの表示メタ（ラベルとアイコン）。 */
const KIND_META: Record<FundPoolKind, { label: string; icon: string }> = {
  BANK: { label: '銀行', icon: 'account_balance' },
  CASH: { label: '現金', icon: 'payments' },
  CARD: { label: 'カード', icon: 'credit_card' },
};

/** よくあるカードカラーのスウォッチ。 */
const CARD_COLORS = [
  '#C4111B', '#E60012', '#CC0033', '#0B6BB5', '#14357F', '#1E8E5A',
  '#0E8F8F', '#6D3FA0', '#E8730C', '#C8A24B', '#2A2A2A', '#9AA0A6',
];

/** ブランドのクイックプリセット（名前＋色をまとめて設定）。 */
const BRAND_PRESETS: { name: string; color: string }[] = [
  { name: '楽天カード', color: '#C4111B' },
  { name: 'イオンカード', color: '#0B6BB5' },
  { name: '三井住友(Olive)', color: '#1E8E5A' },
  { name: 'JCB', color: '#14357F' },
  { name: 'dカード', color: '#CC0033' },
  { name: 'PayPayカード', color: '#E60012' },
];

const DEFAULT_CARD_COLOR = '#3c4043';

/** 背景色の明度から読みやすい文字色（白 or 濃色）を選ぶ。 */
function readableInk(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length < 6) return '#ffffff';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b; // 0..255
  return lum > 150 ? '#1b1b1f' : '#ffffff';
}

/** カードのCSSカスタムプロパティ(--card-color / --card-ink)を型安全に渡す。 */
function cardVar(color: string | null | undefined): React.CSSProperties {
  const c = color || DEFAULT_CARD_COLOR;
  return { ['--card-color' as string]: c, ['--card-ink' as string]: readableInk(c) } as React.CSSProperties;
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
  const toast = useToast();
  const confirm = useConfirm();
  const [transfers, setTransfers] = useState<TransferResponse[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false); // モバイルのプルタブ（既定は閉じ）

  // 口座モーダル
  const [poolModalOpen, setPoolModalOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<FundPoolResponse | null>(null);
  const [poolName, setPoolName] = useState('');
  const [poolInitial, setPoolInitial] = useState('');
  const [poolPrimary, setPoolPrimary] = useState(false);
  const [poolKind, setPoolKind] = useState<FundPoolKind>('BANK');
  const [poolColor, setPoolColor] = useState('');
  // カードの引き落とし設定
  const [poolClosingDay, setPoolClosingDay] = useState('');       // '' = 月末
  const [poolPaymentDay, setPoolPaymentDay] = useState('');
  const [poolSettlePoolId, setPoolSettlePoolId] = useState('');
  const [poolAutoSettle, setPoolAutoSettle] = useState(false);
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
  function openAddPool(kind: FundPoolKind = 'BANK') {
    setEditingPool(null);
    setPoolName('');
    setPoolInitial('');
    setPoolPrimary(false);
    setPoolKind(kind);
    setPoolColor(kind === 'CARD' ? CARD_COLORS[0] : '');
    setPoolClosingDay('');
    setPoolPaymentDay('');
    setPoolSettlePoolId('');
    setPoolAutoSettle(false);
    setError('');
    setPoolModalOpen(true);
  }

  function openEditPool(p: FundPoolResponse) {
    setEditingPool(p);
    setPoolName(p.name);
    setPoolInitial(withCommas(p.initialBalance ?? 0));
    setPoolPrimary(p.primary);
    setPoolKind(p.kind ?? 'BANK');
    setPoolColor(p.color ?? '');
    setPoolClosingDay(p.closingDay != null ? String(p.closingDay) : '');
    setPoolPaymentDay(p.paymentDay != null ? String(p.paymentDay) : '');
    setPoolSettlePoolId(p.settlementPoolId != null ? String(p.settlementPoolId) : '');
    setPoolAutoSettle(p.autoSettle);
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
      const isCard = poolKind === 'CARD';
      const payload = {
        name: poolName.trim(),
        initialBalance,
        kind: poolKind,
        color: isCard ? (poolColor || null) : null,
        closingDay: isCard && poolClosingDay ? Number(poolClosingDay) : null,
        paymentDay: isCard && poolPaymentDay ? Number(poolPaymentDay) : null,
        settlementPoolId: isCard && poolSettlePoolId ? Number(poolSettlePoolId) : null,
        autoSettle: isCard ? poolAutoSettle : false,
      };
      if (editingPool) {
        await poolApi.update(editingPool.id, { ...payload, primary: poolPrimary || undefined });
      } else {
        await poolApi.create({ ...payload, primary: poolPrimary });
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
    if (!(await confirm({ title: '口座を削除', message: `口座「${p.name}」を削除しますか？（この口座の収支は主口座に移ります）`, confirmText: '削除する', danger: true }))) return;
    try {
      await poolApi.delete(p.id);
      await onReloadPools();
      fetchTransfers();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '削除に失敗しました', 'error');
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
    if (!(await confirm({ title: '振替を取り消し', message: 'この振替を取り消しますか？', confirmText: '取り消す', danger: true }))) return;
    try {
      await transferApi.delete(t.id);
      await onReloadPools();
      await fetchTransfers();
    } catch {
      toast('取り消しに失敗しました', 'error');
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
      {/* 口座（銀行・現金） */}
      <div className="assets-subhead">口座</div>
      <div className="pool-grid">
        {pools.filter((p) => p.kind !== 'CARD').map((p) => (
          <div key={p.id} className="pool-card">
            <div className="pool-card-top">
              <span className="pool-name">
                <Icon className="pool-kind-icon" name={KIND_META[p.kind]?.icon ?? 'account_balance'} size={15} />
                <span className="pool-name__text">{p.name}</span>
                {p.primary && <span className="pool-badge">既定</span>}
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
        <button className="pool-add" onClick={() => openAddPool('BANK')}>
          <Icon name="add" />
          口座を追加
        </button>
      </div>

      {/* カード（クレジットカード） */}
      <div className="assets-subhead">カード</div>
      <div className="pool-grid">
        {pools.filter((p) => p.kind === 'CARD').map((c) => (
          <div key={c.id} className="card-tile" style={cardVar(c.color)}>
            <div className="card-tile__top">
              <Icon className="card-tile__brand" name="credit_card" size={18} />
              <span className="card-tile__name">{c.name}</span>
              {c.primary && <span className="card-tile__badge">既定</span>}
              <div className="card-tile__actions">
                <button className="shop-icon-btn" onClick={() => openEditPool(c)} aria-label="編集">
                  <Icon name="edit" size={15} />
                </button>
                <button className="shop-icon-btn danger" onClick={() => handleDeletePool(c)} aria-label="削除">
                  <Icon name="delete" size={15} />
                </button>
              </div>
            </div>
            <div className="card-tile__bottom">
              <div className="card-tile__bal">
                {c.balance < 0 ? (
                  <><span className="card-tile__unpaid">未払</span> <span className="tnum">{formatCurrency(-c.balance)}</span></>
                ) : (
                  <span className="tnum">{formatCurrency(c.balance)}</span>
                )}
              </div>
              {c.autoSettle && c.paymentDay != null && (
                <div className="card-tile__sub">毎月{c.paymentDay}日 自動引落</div>
              )}
            </div>
          </div>
        ))}
        <button className="pool-add" onClick={() => openAddPool('CARD')}>
          <Icon name="credit_card" />
          カードを追加
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

      {/* 口座 追加/編集モーダル（親に transform が掛かる領域内なので、全画面オーバーレイにするため body へポータルする） */}
      {poolModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setPoolModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingPool
                  ? (poolKind === 'CARD' ? 'カードの編集' : '口座の編集')
                  : (poolKind === 'CARD' ? 'カードを追加' : '口座を追加')}
              </h3>
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
                  <label>種別</label>
                  <div className="type-segment">
                    {(['BANK', 'CASH', 'CARD'] as FundPoolKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`type-segment-btn ${poolKind === k ? 'active' : ''}`}
                        onClick={() => { setPoolKind(k); if (k === 'CARD' && !poolColor) setPoolColor(CARD_COLORS[0]); }}
                      >
                        {KIND_META[k].label}
                      </button>
                    ))}
                  </div>
                </div>

                {poolKind === 'CARD' && (
                  <div className="modal-field">
                    <label>カードカラー</label>
                    <div className="brand-presets">
                      {BRAND_PRESETS.map((b) => (
                        <button
                          key={b.name}
                          type="button"
                          className="brand-chip"
                          style={cardVar(b.color)}
                          onClick={() => { setPoolColor(b.color); if (!poolName.trim()) setPoolName(b.name); }}
                        >
                          <span className="brand-chip__dot" />
                          {b.name}
                        </button>
                      ))}
                    </div>
                    <div className="color-swatches">
                      {CARD_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          className={`color-swatch${poolColor.toLowerCase() === col.toLowerCase() ? ' is-selected' : ''}`}
                          style={{ background: col }}
                          onClick={() => setPoolColor(col)}
                          aria-label={`色 ${col}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="modal-field">
                  <label>{poolKind === 'CARD' ? 'カード名' : '口座名'}</label>
                  <input
                    type="text"
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    placeholder={poolKind === 'CARD' ? '例: 楽天カード' : '例: メイン / 投資用'}
                    required
                  />
                </div>
                <div className="modal-field">
                  <label>{poolKind === 'CARD' ? '開始時の未払い残高 (円)' : '開始残高 (円)'}</label>
                  <input type="text" inputMode="numeric" value={poolInitial} onChange={(e) => setPoolInitial(withCommas(e.target.value))} placeholder="0" />
                </div>

                {poolKind === 'CARD' && (
                  <>
                    <div className="modal-field-row">
                      <div className="modal-field">
                        <label>締め日</label>
                        <select value={poolClosingDay} onChange={(e) => setPoolClosingDay(e.target.value)}>
                          <option value="">月末</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>{d}日</option>
                          ))}
                        </select>
                      </div>
                      <div className="modal-field">
                        <label>引き落とし日</label>
                        <select value={poolPaymentDay} onChange={(e) => setPoolPaymentDay(e.target.value)}>
                          <option value="">未設定</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>{d}日</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="modal-field">
                      <label>引き落とし元の口座</label>
                      <select value={poolSettlePoolId} onChange={(e) => setPoolSettlePoolId(e.target.value)}>
                        <option value="">未設定</option>
                        {pools
                          .filter((p) => p.kind !== 'CARD' && p.id !== editingPool?.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                    </div>
                    <label className="pool-primary-check">
                      <input type="checkbox" checked={poolAutoSettle} onChange={(e) => setPoolAutoSettle(e.target.checked)} />
                      毎月自動で引き落とす（締め→引き落とし日に「口座→カード」振替を自動生成）
                    </label>
                    <p className="goal-summary__note" style={{ margin: 0 }}>
                      引き落とし日と引き落とし元の口座を設定すると有効化できます。このカードで払った支出は締め日ごとに集計され、引き落とし日に口座から自動で精算されます。
                    </p>
                  </>
                )}

                <label className="pool-primary-check">
                  <input type="checkbox" checked={poolPrimary} onChange={(e) => setPoolPrimary(e.target.checked)} />
                  {poolKind === 'CARD' ? 'デフォルトカードにする（新規支出の既定）' : '主口座にする（収支の既定の紐づけ先）'}
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
        </div>,
        document.body,
      )}

      {/* 振替モーダル（同上・全画面オーバーレイのため body へポータル） */}
      {transferOpen && createPortal(
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
        </div>,
        document.body,
      )}
    </div>
  );
}
