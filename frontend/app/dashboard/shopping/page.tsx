'use client';

import { useEffect, useRef, useState } from 'react';
import { shoppingApi, ApiError } from '@/lib/api';
import { ShoppingItemResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { useToast, useConfirm } from '@/app/_components/ui';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ShoppingPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<ShoppingItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [reestimatingId, setReestimatingId] = useState<number | null>(null);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setItems(await shoppingApi.getAll());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // アンマウント時に保留中の自動見積りタイマーを解除
  useEffect(() => () => {
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
  }, []);

  // 未見積りのアイテムを1回のLLM呼び出しでまとめて見積る
  async function runEstimate() {
    if (estimateTimer.current) {
      clearTimeout(estimateTimer.current);
      estimateTimer.current = null;
    }
    if (estimating) return;
    setEstimating(true);
    setError('');
    try {
      setItems(await shoppingApi.estimatePending());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '見積りに失敗しました');
    } finally {
      setEstimating(false);
    }
  }

  // 操作から5秒なにもなければ自動で見積る（連続追加時はまとめて1回だけ）
  function scheduleEstimate() {
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
    estimateTimer.current = setTimeout(() => {
      estimateTimer.current = null;
      runEstimate();
    }, 5000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || adding) return;
    setError('');
    setAdding(true);
    try {
      // 追加は即時（この時点では試算しない）。試算はまとめて後から行う。
      const item = await shoppingApi.create(name.trim());
      setItems((prev) => [...prev, item]);
      setName('');
      scheduleEstimate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '追加に失敗しました');
    } finally {
      setAdding(false);
    }
  }

  async function toggle(it: ShoppingItemResponse) {
    const next = !it.checked;
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, checked: next } : x)));
    try {
      await shoppingApi.update(it.id, { checked: next });
    } catch {
      // 失敗時は元に戻す
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, checked: it.checked } : x)));
    }
  }

  async function reestimate(it: ShoppingItemResponse) {
    setReestimatingId(it.id);
    setError('');
    try {
      const updated = await shoppingApi.reestimate(it.id);
      setItems((prev) => prev.map((x) => (x.id === it.id ? updated : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '再見積りに失敗しました');
    } finally {
      setReestimatingId(null);
    }
  }

  async function remove(it: ShoppingItemResponse) {
    if (!(await confirm({ title: 'アイテムを削除', message: `「${it.name}」を削除しますか？`, confirmText: '削除する', danger: true }))) return;
    try {
      await shoppingApi.delete(it.id);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch {
      toast('削除に失敗しました', 'error');
    }
  }

  // 未購入（未チェック）の見積り合計 = これから使いそうな金額
  const remainingTotal = items
    .filter((i) => !i.checked)
    .reduce((sum, i) => sum + (i.estimatedPrice ?? 0), 0);
  const checkedCount = items.filter((i) => i.checked).length;
  const pendingCount = items.filter((i) => i.estimatedPrice == null).length;

  return (
    <div className="screen">
      <div className="page-head">
        <h1 className="page-title">買い物リスト</h1>
      </div>

      {/* 合計ヒーロー */}
      <div className="hero">
        <div className="section-label">買い物の目安（未購入）</div>
        <div className="hero-value">{loading ? '—' : formatCurrency(remainingTotal)}</div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-label">品目</span>
            <span className="hero-stat-value">{items.length}件</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">購入済み</span>
            <span className="hero-stat-value">{checkedCount}件</span>
          </div>
        </div>
      </div>

      {/* 追加フォーム */}
      <form className="shop-add" onSubmit={handleAdd}>
        <input
          className="input"
          type="text"
          placeholder="品名を入力（例: トイレットペーパー）"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={adding || !name.trim()}>
          {adding ? (
            <>
              <span className="loading-spinner" />
              追加中…
            </>
          ) : (
            <>
              <Icon name="add" />
              追加
            </>
          )}
        </button>
      </form>
      <div className="shop-hint">
        品名を追加すると、少し待ってからAIが数量・価格の目安を<strong>まとめて</strong>見積もります（設定でチャット用LLMの登録が必要）。
      </div>

      {/* まとめて見積りバー（未見積りがあるときだけ表示） */}
      {(estimating || pendingCount > 0) && (
        <div className="shop-estimate-bar">
          {estimating ? (
            <>
              <span className="loading-spinner" />
              AIがまとめて見積り中…
            </>
          ) : (
            <>
              <Icon name="schedule" />
              <span>{pendingCount}件が見積り待ち（5秒後に自動で見積もります）</span>
              <button type="button" className="shop-estimate-now" onClick={runEstimate}>
                今すぐ見積り
              </button>
            </>
          )}
        </div>
      )}

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
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="shopping_cart" />
          </div>
          <div className="empty-state-text">買い物リストは空です</div>
          <div className="empty-state-hint">上の入力欄に品名を追加しましょう</div>
        </div>
      ) : (
        <div className="card flush shop-list">
          {items.map((it) => (
            <div key={it.id} className={`shop-row ${it.checked ? 'checked' : ''}`}>
              <button
                className="shop-check"
                onClick={() => toggle(it)}
                aria-label={it.checked ? '未購入に戻す' : '購入済みにする'}
              >
                <Icon name={it.checked ? 'check_box' : 'check_box_outline_blank'} />
              </button>
              <div className="shop-main">
                <div className="shop-name">{it.name}</div>
                {it.quantity && <div className="shop-qty">{it.quantity}</div>}
              </div>
              <div className="shop-price tnum">
                {it.estimatedPrice != null
                  ? formatCurrency(it.estimatedPrice)
                  : <span className="shop-pending">見積り待ち</span>}
              </div>
              <button
                className="shop-icon-btn"
                onClick={() => reestimate(it)}
                disabled={reestimatingId === it.id}
                aria-label="再見積り"
                title="AIで再見積り"
              >
                {reestimatingId === it.id ? <span className="loading-spinner" /> : <Icon name="refresh" />}
              </button>
              <button className="shop-icon-btn danger" onClick={() => remove(it)} aria-label="削除" title="削除">
                <Icon name="delete" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
