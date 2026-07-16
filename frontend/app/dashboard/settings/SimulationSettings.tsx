'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { goalApi, fixedCostApi, poolApi, ApiError } from '@/lib/api';
import { GoalResponse, FixedCostResponse, FundPoolResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';

function yen(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}

/** 'YYYY-MM-DD' を 'YYYY年M月まで' 形式に整形する */
function fmtTargetDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(s);
  if (!m) return s;
  return `${m[1]}年${Number(m[2])}月まで`;
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

/** シミュレーションの前提設定（貯蓄目標・固定費）。分析画面のシミュレーションタブで編集する。 */
export function SimulationSettings({ onGoalChange }: { onGoalChange?: () => void } = {}) {
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCostResponse[]>([]);
  const [pools, setPools] = useState<FundPoolResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [targetName, setTargetName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [savingsSource, setSavingsSource] = useState('total'); // 'total' | pool id
  const [savingGoal, setSavingGoal] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [g, fc, pl] = await Promise.all([goalApi.get(), fixedCostApi.getAll(), poolApi.getAll()]);
      setFixedCosts(fc);
      setPools(pl);
      if (g) {
        setGoal(g);
        setTargetName(g.targetName);
        setTargetAmount(withCommas(String(g.targetAmount)));
        setTargetDate(g.targetDate);
        setCurrentSavings(withCommas(String(g.currentSavings)));
      } else {
        // 新規: 現在の貯蓄額を総資産から初期化
        const total = pl.reduce((s, p) => s + p.balance, 0);
        setCurrentSavings(withCommas(String(Math.round(total))));
        setSavingsSource('total');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  /** 貯蓄額の取得元（総資産 or 特定口座）を切り替え、その残高を反映する。 */
  function applySavingsSource(key: string) {
    setSavingsSource(key);
    const total = pools.reduce((s, p) => s + p.balance, 0);
    const amount = key === 'total' ? total : (pools.find((p) => String(p.id) === key)?.balance ?? 0);
    setCurrentSavings(withCommas(String(Math.round(amount))));
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
      onGoalChange?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '目標の保存に失敗しました');
    } finally {
      setSavingGoal(false);
    }
  }

  if (loading) {
    return <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>;
  }

  const pct = goal && goal.targetAmount > 0
    ? Math.max(0, Math.min(100, Math.round((goal.currentSavings / goal.targetAmount) * 100)))
    : 0;
  const fixedCostTotal = fixedCosts.reduce((sum, f) => sum + f.amount, 0);

  return (
    <>
      {message && <div className="success-banner" style={{ marginBottom: '1rem' }}><Icon name="check_circle" /> {message}</div>}
      {error && <div className="error-banner" style={{ marginBottom: '1rem' }}><Icon name="error" /> {error}</div>}

      {/* 貯蓄目標 */}
      <form onSubmit={handleSaveGoal} className="setting-card">
        <div className="setting-card__header">
          <div className="card-icon"><Icon name="savings" /></div>
          <div className="setting-card__title">貯蓄目標</div>
        </div>

        {goal && (
          <div className="goal-summary">
            <div className="goal-summary__head">
              <span className="goal-summary__name">{goal.targetName}</span>
              <span className="goal-summary__date">{fmtTargetDate(goal.targetDate)}</span>
            </div>
            <div className="goal-summary__amounts">
              <span className="goal-summary__current">{yen(goal.currentSavings)}</span>
              <span className="goal-summary__target">/ {yen(goal.targetAmount)}</span>
            </div>
            <div className="progress-bar"><div className="progress-bar__fill" style={{ width: `${pct}%` }} /></div>
            <div className="goal-summary__note">達成率 {pct}%</div>
          </div>
        )}

        <div className="field-grid">
          <div className="field field--full">
            <label className="field__label">目標名</label>
            <input
              className="field__input"
              type="text"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="例: マイホーム頭金"
            />
          </div>
          <div className="field">
            <label className="field__label">目標金額 (円)</label>
            <input
              className="field__input"
              type="text"
              inputMode="numeric"
              value={targetAmount}
              onChange={(e) => setTargetAmount(withCommas(e.target.value))}
              placeholder="3,000,000"
            />
          </div>
          <div className="field">
            <label className="field__label">目標月</label>
            <input
              className="field__input"
              type="month"
              value={targetDate ? targetDate.slice(0, 7) : ''}
              onChange={(e) => setTargetDate(e.target.value ? `${e.target.value}-01` : '')}
            />
          </div>
          <div className="field field--full">
            <label className="field__label">現在の貯蓄額 (円)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="field__input"
                style={{ flex: '0 0 auto', width: 150 }}
                value={savingsSource}
                onChange={(e) => applySavingsSource(e.target.value)}
                aria-label="貯蓄額の取得元"
              >
                <option value="total">総資産</option>
                {pools.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.primary ? '（主）' : ''}</option>
                ))}
              </select>
              <input
                className="field__input"
                type="text"
                inputMode="numeric"
                value={currentSavings}
                onChange={(e) => { setCurrentSavings(withCommas(e.target.value)); }}
                placeholder="500,000"
              />
            </div>
            <div className="field__label" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
              総資産や特定の口座から取得できます（手入力での調整も可）
            </div>
          </div>
        </div>

        <div className="card-actions">
          <button type="submit" className="btn btn--primary" disabled={savingGoal}>
            {savingGoal ? '保存中...' : goal ? '目標を更新' : '目標を設定'}
          </button>
        </div>
      </form>

      {/* 固定費 */}
      <div className="setting-card setting-card--flush">
        <div className="setting-card__header setting-card__header--split">
          <div className="setting-card__left">
            <div className="card-icon"><Icon name="home" /></div>
            <div className="setting-card__heading">
              <div className="setting-card__title">固定費（月額）</div>
              <div className="setting-card__subtitle">合計 {yen(fixedCostTotal)} / 月</div>
            </div>
          </div>
        </div>

        <div className="fixed-cost-list">
          {fixedCosts.length === 0 ? (
            <p className="goal-summary__note">家賃やサブスクなどを登録すると精度が上がります。</p>
          ) : (
            fixedCosts.map((f) => (
              <div className="fixed-cost-row" key={f.id}>
                <span className="fixed-cost-row__name">
                  {f.name}
                  {f.autoPost && <span className="fc-badge" style={{ marginLeft: 6 }}>自動</span>}
                </span>
                <div className="fixed-cost-row__meta">
                  <span className="fixed-cost-row__amount">{yen(f.amount)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 追加・編集は「設定 > 固定費」に一本化（支払日・カテゴリ・自動記帳まで設定できる） */}
        <p className="goal-summary__note" style={{ padding: '0 16px 16px' }}>
          固定費の追加・編集は <Link href="/dashboard/settings">設定 &gt; 固定費</Link> で行えます。
        </p>
      </div>
    </>
  );
}
