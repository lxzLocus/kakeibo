'use client';

import { useEffect, useState } from 'react';
import { goalApi, fixedCostApi, ApiError } from '@/lib/api';
import { GoalResponse, FixedCostResponse } from '@/types';

function yen(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}

/** 入力文字列を「1,234」形式（整数・カンマ区切り）に整形する */
function withCommas(s: string): string {
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ja-JP');
}
/** カンマ付き文字列を数値に変換する */
function toNumber(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** シミュレーションの前提設定（貯蓄目標・固定費）。設定画面から編集する。 */
export function SimulationSettings() {
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCostResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [targetName, setTargetName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const [fcName, setFcName] = useState('');
  const [fcAmount, setFcAmount] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const g = await goalApi.get();
      if (g) {
        setGoal(g);
        setTargetName(g.targetName);
        setTargetAmount(withCommas(String(g.targetAmount)));
        setTargetDate(g.targetDate);
        setCurrentSavings(withCommas(String(g.currentSavings)));
      }
      setFixedCosts(await fixedCostApi.getAll());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!targetName.trim() || !targetAmount || !targetDate) {
      setError('目標名・金額・目標日は必須です');
      return;
    }
    setSavingGoal(true);
    try {
      const saved = await goalApi.save({
        targetName: targetName.trim(),
        targetAmount: toNumber(targetAmount),
        targetDate,
        currentSavings: toNumber(currentSavings),
      });
      setGoal(saved);
      setMessage('貯蓄目標を保存しました');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '目標の保存に失敗しました');
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleAddFixedCost(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!fcName.trim() || !fcAmount) return;
    try {
      await fixedCostApi.create({ name: fcName.trim(), amount: toNumber(fcAmount) });
      // サーバーの最新一覧で置き換え（追加後の表示を確実にする）
      setFixedCosts(await fixedCostApi.getAll());
      setFcName('');
      setFcAmount('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '固定費の追加に失敗しました');
    }
  }

  async function handleDeleteFixedCost(id: number) {
    setError('');
    try {
      await fixedCostApi.delete(id);
      setFixedCosts(await fixedCostApi.getAll());
    } catch {
      setError('固定費の削除に失敗しました');
    }
  }

  if (loading) {
    return <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>;
  }

  return (
    <>
      {message && <div className="auth-success-banner" style={{ marginBottom: '1rem' }}>✅ {message}</div>}
      {error && <div className="auth-error-banner" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

      {/* 貯蓄目標 */}
      <form onSubmit={handleSaveGoal} className="settings-card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>🎯 貯蓄目標</h3>
        <div className="modal-field">
          <label>目標名</label>
          <input type="text" value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="例: マイホーム頭金" />
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="modal-field" style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label>目標金額 (円)</label>
            <input
              type="text"
              inputMode="numeric"
              value={targetAmount}
              onChange={(e) => setTargetAmount(withCommas(e.target.value))}
              placeholder="3,000,000"
            />
          </div>
          <div className="modal-field" style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label>目標日</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>
        <div className="modal-field">
          <label>現在の貯蓄額 (円)</label>
          <input
            type="text"
            inputMode="numeric"
            value={currentSavings}
            onChange={(e) => setCurrentSavings(withCommas(e.target.value))}
            placeholder="500,000"
          />
        </div>
        <div className="modal-btn-group">
          <button type="submit" className="modal-btn primary" disabled={savingGoal}>
            {savingGoal ? '保存中...' : goal ? '目標を更新' : '目標を設定'}
          </button>
        </div>
      </form>

      {/* 固定費 */}
      <div className="settings-card">
        <h3 style={{ marginTop: 0 }}>🏠 固定費（月額）</h3>
        {fixedCosts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>家賃やサブスクなどの固定費を登録すると精度が上がります。</p>
        ) : (
          <ul className="fixed-cost-list">
            {fixedCosts.map((f) => (
              <li key={f.id}>
                <span>{f.name}</span>
                <span>
                  {yen(f.amount)}
                  <button className="fixed-cost-delete" onClick={() => handleDeleteFixedCost(f.id)} aria-label="削除">🗑️</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAddFixedCost} className="fixed-cost-add">
          <div className="modal-field" style={{ marginBottom: 0 }}>
            <label>項目名</label>
            <input type="text" value={fcName} onChange={(e) => setFcName(e.target.value)} placeholder="例: 家賃 / サブスク" />
          </div>
          <div className="modal-field" style={{ marginBottom: 0 }}>
            <label>金額 (円/月)</label>
            <input
              type="text"
              inputMode="numeric"
              value={fcAmount}
              onChange={(e) => setFcAmount(withCommas(e.target.value))}
              placeholder="80,000"
            />
          </div>
          <button type="submit" className="modal-btn primary" style={{ width: '100%' }}>＋ 固定費を追加</button>
        </form>
      </div>
    </>
  );
}
