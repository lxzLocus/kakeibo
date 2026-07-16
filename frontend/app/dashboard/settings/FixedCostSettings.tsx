'use client';

import { useEffect, useState } from 'react';
import { fixedCostApi, categoryApi, ApiError } from '@/lib/api';
import { FixedCostResponse, CategoryResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { useConfirm } from '@/app/_components/ui';

function yen(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}
function withCommas(s: string): string {
  const digits = s.replace(/[^0-9]/g, '');
  return digits ? Number(digits).toLocaleString('ja-JP') : '';
}
function toNumber(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 固定費の管理（シミュレーション設定の外＝通常の設定画面）。
 * 「自動記帳」をONにすると、毎月の支払日に収支へ自動で追加される。
 */
export function FixedCostSettings() {
  const confirm = useConfirm();
  const [list, setList] = useState<FixedCostResponse[]>([]);
  const [cats, setCats] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);

  // 追加/編集フォーム（editingId が null なら追加モード）
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [autoPost, setAutoPost] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [fc, c] = await Promise.all([fixedCostApi.getAll(), categoryApi.getAll()]);
      setList(fc);
      setCats((c as CategoryResponse[]).filter((x) => x.type === 'EXPENSE'));
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '固定費の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditingId(null);
    setName('');
    setAmount('');
    setPaymentDay('');
    setCategoryId('');
    setAutoPost(true);
  }

  function startEdit(f: FixedCostResponse) {
    setEditingId(f.id);
    setName(f.name);
    setAmount(withCommas(String(f.amount)));
    setPaymentDay(f.paymentDay != null ? String(f.paymentDay) : '');
    setCategoryId(f.categoryId != null ? String(f.categoryId) : '');
    setAutoPost(f.autoPost);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!name.trim() || !amount) {
      setError('項目名と金額は必須です');
      return;
    }
    const day = paymentDay ? Number(paymentDay) : null;
    if (day != null && (day < 1 || day > 31)) {
      setError('支払日は1〜31で指定してください');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        amount: toNumber(amount),
        paymentDay: day,
        autoPost,
        categoryId: categoryId ? Number(categoryId) : null,
      };
      if (editingId != null) await fixedCostApi.update(editingId, payload);
      else await fixedCostApi.create(payload);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAuto(f: FixedCostResponse) {
    setError('');
    try {
      await fixedCostApi.update(f.id, {
        name: f.name,
        amount: f.amount,
        paymentDay: f.paymentDay,
        autoPost: !f.autoPost,
        categoryId: f.categoryId,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更新に失敗しました');
    }
  }

  async function handleDelete(f: FixedCostResponse) {
    if (!(await confirm({ title: '固定費を削除', message: `「${f.name}」を削除しますか？（記帳済みの収支は残ります）`, confirmText: '削除する', danger: true }))) return;
    setError('');
    try {
      await fixedCostApi.delete(f.id);
      if (editingId === f.id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました');
    }
  }

  async function handleApply() {
    setApplying(true);
    setError('');
    setMessage('');
    try {
      const res = await fixedCostApi.apply();
      setMessage(res.created > 0 ? `${res.created}件を収支に追加しました` : '追加すべき固定費はありません（反映済み）');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '反映に失敗しました');
    } finally {
      setApplying(false);
    }
  }

  const total = list.reduce((s, f) => s + f.amount, 0);
  const autoTotal = list.filter((f) => f.autoPost).reduce((s, f) => s + f.amount, 0);
  const catName = (id: number | null) => cats.find((c) => c.categoryId === id)?.name ?? '固定費';

  if (loading) {
    return <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>;
  }

  return (
    <div className="settings-section">
      <div className="settings-section__title">固定費</div>
      <div className="settings-section__desc">
        家賃・サブスクなど毎月かかる費用を登録します。「自動記帳」をONにすると、毎月の支払日に収支へ自動で追加されます
        （追加された分はシミュレーションで固定費として別途計算されるため、学習からは除外されます）。
      </div>

      {message && <div className="success-banner" style={{ marginBottom: 10 }}><Icon name="check_circle" /> {message}</div>}
      {error && <div className="error-banner" style={{ marginBottom: 10 }}><Icon name="error" /> {error}</div>}

      <div className="fc-summary">
        <div className="fc-summary__item">
          <span className="fc-summary__label">合計</span>
          <strong>{yen(total)} / 月</strong>
        </div>
        <div className="fc-summary__item">
          <span className="fc-summary__label">うち自動記帳</span>
          <strong>{yen(autoTotal)} / 月</strong>
        </div>
        <button className="btn btn--outline-accent" onClick={handleApply} disabled={applying}>
          {applying ? <><span className="loading-spinner" />反映中…</> : <><Icon name="sync" size={17} />今すぐ反映</>}
        </button>
      </div>

      {/* 一覧 */}
      {list.length === 0 ? (
        <p className="goal-summary__note">まだ登録がありません。下のフォームから追加してください。</p>
      ) : (
        <div className="card flush">
          {list.map((f) => (
            <div className="fc-row" key={f.id}>
              <div className="fc-row__main">
                <div className="fc-row__name">
                  {f.name}
                  {f.autoPost && <span className="fc-badge">自動</span>}
                </div>
                <div className="fc-row__meta">
                  毎月{f.paymentDay ?? 1}日 ・ {catName(f.categoryId)}
                </div>
              </div>
              <span className="fc-row__amount">{yen(f.amount)}</span>
              <button
                type="button"
                className={`toggle${f.autoPost ? ' is-on' : ''}`}
                onClick={() => handleToggleAuto(f)}
                aria-label="自動記帳の切り替え"
                title="自動記帳"
              >
                <span className="toggle__knob" />
              </button>
              <button className="cat-icon-btn" onClick={() => startEdit(f)} aria-label="編集" title="編集">
                <Icon name="edit" size={16} />
              </button>
              <button className="cat-icon-btn danger" onClick={() => handleDelete(f)} aria-label="削除" title="削除">
                <Icon name="delete" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 追加・編集フォーム */}
      <form onSubmit={handleSubmit} className="setting-card" style={{ marginTop: 16 }}>
        <div className="setting-card__header">
          <div className="card-icon"><Icon name={editingId != null ? 'edit' : 'add'} /></div>
          <div className="setting-card__title">{editingId != null ? '固定費を編集' : '固定費を追加'}</div>
        </div>

        <div className="field-grid">
          <div className="field">
            <label className="field__label">項目名</label>
            <input className="field__input" type="text" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="例: 家賃 / サブスク" />
          </div>
          <div className="field">
            <label className="field__label">金額 (円/月)</label>
            <input className="field__input" type="text" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(withCommas(e.target.value))} placeholder="99,000" />
          </div>
          <div className="field">
            <label className="field__label">支払日</label>
            <select className="field__input" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)}>
              <option value="">月初（1日）</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}日</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">カテゴリ</label>
            <select className="field__input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">「固定費」を自動作成</option>
              {cats.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="vision-toggle-box">
          <button type="button" className={`toggle${autoPost ? ' is-on' : ''}`} onClick={() => setAutoPost(!autoPost)}>
            <span className="toggle__knob" />
          </button>
          <div className="vision-toggle__text">
            <div className="vision-toggle__title">毎月自動で収支に追加する</div>
            <div className="vision-toggle__hint">
              支払日が来た月ぶんを自動で記帳します。同じ月に二重登録はされません。
            </div>
          </div>
        </div>

        <div className="card-actions">
          {editingId != null && (
            <button type="button" className="btn btn--outline" onClick={resetForm}>キャンセル</button>
          )}
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? '保存中...' : editingId != null ? '更新する' : '＋ 追加'}
          </button>
        </div>
      </form>
    </div>
  );
}
