'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { goalApi, simulationApi, ApiError } from '@/lib/api';
import { GoalResponse, SimulationResult } from '@/types';

function yen(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/** P10〜P90の帯とP50ラインを描く軽量SVGチャート（外部ライブラリ不使用） */
function SimulationChart({ result }: { result: SimulationResult }) {
  const width = 720;
  const height = 280;
  const padL = 64, padR = 16, padT = 16, padB = 36;
  const n = result.labels.length;
  if (n < 2) return null;

  const allValues = [...result.p10, ...result.p90, result.goalAmount];
  const maxY = Math.max(...allValues) * 1.05;
  const minY = 0;

  const x = (i: number) => padL + (i / (n - 1)) * (width - padL - padR);
  const y = (v: number) => padT + (1 - (v - minY) / (maxY - minY)) * (height - padT - padB);

  const areaPath = (upper: number[], lower: number[]) => {
    const up = upper.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
    const down = lower.map((v, i) => `L ${x(lower.length - 1 - i)} ${y(lower[lower.length - 1 - i])}`).join(' ');
    return `${up} ${down} Z`;
  };

  const linePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  const goalY = y(result.goalAmount);
  const yTicks = 4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sim-chart" role="img" aria-label="貯蓄予測グラフ">
      {/* Y軸グリッド */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = (maxY / yTicks) * i;
        const yy = y(v);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={width - padR} y2={yy} stroke="rgba(148,163,184,0.15)" />
            <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(v / 10000)}万
            </text>
          </g>
        );
      })}

      {/* P10-P90帯 */}
      <path d={areaPath(result.p90, result.p10)} fill="rgba(99,102,241,0.15)" />
      {/* P25-P75帯 */}
      <path d={areaPath(result.p75, result.p25)} fill="rgba(99,102,241,0.25)" />
      {/* P50ライン */}
      <path d={linePath(result.p50)} fill="none" stroke="#6366f1" strokeWidth="2" />

      {/* 目標ライン */}
      <line x1={padL} y1={goalY} x2={width - padR} y2={goalY} stroke="#22c55e" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={width - padR} y={goalY - 5} textAnchor="end" fontSize="10" fill="#22c55e">目標 {Math.round(result.goalAmount / 10000)}万</text>

      {/* X軸ラベル */}
      {result.labels.map((label, i) =>
        label ? (
          <text key={i} x={x(i)} y={height - 12} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {label}
          </text>
        ) : null
      )}
    </svg>
  );
}

export default function SimulationPage() {
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [age, setAge] = useState('30');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const g = await goalApi.get();
        setGoal(g ?? null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleRun() {
    setError('');
    setRunning(true);
    try {
      const res = await simulationApi.run(age ? parseInt(age, 10) : undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'シミュレーションに失敗しました');
    } finally {
      setRunning(false);
    }
  }

  const dates = result?.goalAchievementDates;

  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '820px', margin: '0 auto' }}>
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">📈 貯蓄シミュレーション</h2>
      </div>

      {error && <div className="auth-error-banner" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

      {loading ? (
        <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>
      ) : (
        <>
          {/* 目標・固定費は設定画面へ移動 */}
          <div className="settings-card" style={{ marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {goal ? (
                <>🎯 目標「<b>{goal.targetName}</b>」（{yen(goal.targetAmount)} / {fmtDate(goal.targetDate)}）が設定されています。</>
              ) : (
                <>🎯 まだ貯蓄目標が未設定です。</>
              )}
              <br />
              目標・固定費は <Link href="/dashboard/settings" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>設定 → シミュレーション</Link> で編集できます。
            </p>
          </div>

          {/* 実行 */}
          <div className="settings-card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div className="modal-field" style={{ flex: 'none', width: '120px', marginBottom: 0 }}>
                <label>現在の年齢</label>
                <input type="number" min="18" max="99" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <button className="modal-btn primary" onClick={handleRun} disabled={running || !goal} style={{ flex: 1 }}>
                {running ? 'シミュレーション中...' : '▶ シミュレーション実行'}
              </button>
            </div>
            {!goal && (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                先に貯蓄目標を設定してください。収支は<Link href="/dashboard" style={{ textDecoration: 'underline' }}>家計簿の記録</Link>から自動で学習します。
              </p>
            )}
          </div>

          {/* 結果 */}
          {result && (
            <div className="settings-card" style={{ marginTop: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>結果</h3>
              <div className="sim-stat-grid">
                <div className="sim-stat">
                  <div className="sim-stat-label">期限内達成率</div>
                  <div className="sim-stat-value">{result.achievementRate}%</div>
                </div>
                <div className="sim-stat">
                  <div className="sim-stat-label">中央値の達成予定</div>
                  <div className="sim-stat-value">{fmtDate(dates?.median ?? null)}</div>
                </div>
                <div className="sim-stat">
                  <div className="sim-stat-label">月の収支余剰</div>
                  <div className="sim-stat-value">{yen(result.monthlySurplus)}</div>
                </div>
                <div className="sim-stat">
                  <div className="sim-stat-label">目標に必要な月貯蓄</div>
                  <div className="sim-stat-value">{yen(result.neededMonthlySavings)}</div>
                </div>
              </div>

              <SimulationChart result={result} />

              <div className="sim-legend">
                <span><i style={{ background: '#6366f1' }} /> 中央値(P50)</span>
                <span><i style={{ background: 'rgba(99,102,241,0.25)' }} /> 25〜75%</span>
                <span><i style={{ background: 'rgba(99,102,241,0.15)' }} /> 10〜90%</span>
                <span><i style={{ background: '#22c55e' }} /> 目標額</span>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                学習値: 月収 {yen(result.monthlyIncome)} / 固定費 {yen(result.fixedExpense)} / 変動費 {yen(result.variableExpense)}。
                {dates && !dates.achievable && ' 現状の収支では目標達成が困難です。支出の見直しを検討しましょう。'}
                {dates?.estimatedOnly && ' （期限内達成は難しいですが、ペースを維持すれば将来的に到達見込みです）'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
