'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { goalApi, simulationApi, ApiError, SimulationOptions } from '@/lib/api';
import { GoalResponse, SimulationResult } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { withCommas, toNumber } from '@/lib/format';
import { SimulationSettings } from '../settings/SimulationSettings';

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
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = (maxY / yTicks) * i;
        const yy = y(v);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={width - padR} y2={yy} stroke="var(--hairline)" />
            <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="var(--text-faint)">
              {Math.round(v / 10000)}万
            </text>
          </g>
        );
      })}

      {/* P10-P90帯（悲観〜楽観の幅）/ P25-P75帯 / P50ライン（中央値） */}
      <path d={areaPath(result.p90, result.p10)} fill="rgba(168,199,250,0.10)" />
      <path d={areaPath(result.p75, result.p25)} fill="rgba(168,199,250,0.22)" />
      {/* 悲観(P10)・中央(P50)・楽観(P90) の3本 */}
      <path d={linePath(result.p90)} fill="none" stroke="var(--success)" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={linePath(result.p10)} fill="none" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={linePath(result.p50)} fill="none" stroke="var(--accent)" strokeWidth="2" />

      {/* 目標ライン */}
      <line x1={padL} y1={goalY} x2={width - padR} y2={goalY} stroke="var(--warning)" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={width - padR} y={goalY - 5} textAnchor="end" fontSize="10" fill="var(--warning)">目標 {Math.round(result.goalAmount / 10000)}万</text>

      {result.labels.map((label, i) =>
        label ? (
          <text key={i} x={x(i)} y={height - 12} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
            {label}
          </text>
        ) : null
      )}
    </svg>
  );
}

/**
 * 分析画面に統合された貯蓄シミュレーション。
 * タブに来たら（目標が設定済みなら）自動で計算してグラフを表示する。
 */
export function SimulationPanel() {
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [age, setAge] = useState('30');
  const [insurance, setInsurance] = useState('30'); // 医療保険カバー率 %
  const [incomeOverride, setIncomeOverride] = useState(''); // 月収の上書き（空=実績）
  const [variableOverride, setVariableOverride] = useState(''); // 変動費の上書き（空=実績）
  // 確率的ショックの強度（%。100=既定）
  const [illnessPct, setIllnessPct] = useState('100');
  const [seasonalPct, setSeasonalPct] = useState('100');
  const [impulsePct, setImpulsePct] = useState('100');
  const [editOpen, setEditOpen] = useState(false);
  const reqSeq = useRef(0); // 同時実行時に最新リクエストの結果だけを採用するためのシーケンス番号

  // 現在の what-if 条件を組み立てる（頻繁に変わる値は override で明示指定して stale を避ける）
  function buildOptions(override?: Partial<SimulationOptions>): SimulationOptions {
    return {
      age: age ? parseInt(age, 10) : undefined,
      insuranceCoverageRate: insurance !== '' ? parseInt(insurance, 10) / 100 : undefined,
      monthlyIncome: incomeOverride ? toNumber(incomeOverride) : undefined,
      variableExpense: variableOverride ? toNumber(variableOverride) : undefined,
      illnessRiskMultiplier: illnessPct !== '' ? parseInt(illnessPct, 10) / 100 : undefined,
      seasonalIntensity: seasonalPct !== '' ? parseInt(seasonalPct, 10) / 100 : undefined,
      impulseIntensity: impulsePct !== '' ? parseInt(impulsePct, 10) / 100 : undefined,
      ...override,
    };
  }

  async function runSimulation(override?: Partial<SimulationOptions>) {
    const seq = ++reqSeq.current;
    setRunning(true);
    setError('');
    try {
      const res = await simulationApi.run(buildOptions(override));
      if (seq === reqSeq.current) setResult(res); // 最新リクエストのみ結果を反映（連続操作時のちらつき防止）
    } catch (err) {
      // エラー時も直前のグラフは保持し、バナーだけ表示する
      if (seq === reqSeq.current) setError(err instanceof ApiError ? err.message : 'シミュレーションに失敗しました');
    } finally {
      if (seq === reqSeq.current) setRunning(false);
    }
  }

  async function loadGoal(): Promise<GoalResponse | null> {
    try {
      const g = (await goalApi.get()) ?? null;
      setGoal(g);
      return g;
    } catch {
      setGoal(null);
      return null;
    }
  }

  // 初回表示: 目標を読み込み、設定済みなら自動でシミュレーション実行
  useEffect(() => {
    (async () => {
      const g = await loadGoal();
      if (g) await runSimulation();
      setInitializing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 目標・固定費を編集して保存したら再計算
  async function handleGoalChange() {
    const g = await loadGoal();
    if (g) await runSimulation();
  }

  // 条件（年齢・保険・各強度）を変更したら、少し待ってから自動で再計算する（リアルタイム更新）。
  // 初回ロード（initializing）中は mount 側の実行に任せて二重実行を避ける。
  useEffect(() => {
    if (initializing || !goal) return;
    const t = setTimeout(() => { runSimulation(); }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age, insurance, incomeOverride, variableOverride, illnessPct, seasonalPct, impulsePct]);

  // 条件を既定値に戻す（上の effect が変更を検知して再計算する）
  function resetConditions() {
    setAge('30');
    setInsurance('30');
    setIncomeOverride('');
    setVariableOverride('');
    setIllnessPct('100');
    setSeasonalPct('100');
    setImpulsePct('100');
  }

  const dates = result?.goalAchievementDates;

  return (
    <div>
      {error && (
        <div className="error-banner">
          <Icon name="error" />
          {error}
        </div>
      )}

      {/* 予測結果（タブ遷移時に自動表示） */}
      {initializing ? (
        <div className="loading-state">
          <span className="loading-spinner" />
          シミュレーションを計算中...
        </div>
      ) : !goal ? (
        <div className="setting-card">
          <div className="setting-card__header">
            <div className="card-icon"><Icon name="show_chart" /></div>
            <div className="setting-card__title">貯蓄予測シミュレーション</div>
          </div>
          <p className="goal-summary__note">
            貯蓄目標を設定すると、目標日までの貯蓄予測グラフが自動で表示されます。収支は家計簿の記録から自動で学習します。
          </p>
          <div className="card-actions">
            <button className="btn btn--primary" onClick={() => setEditOpen(true)}>
              <Icon name="edit" size={17} />
              シミュレーション設定
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="setting-card">
          <div className="setting-card__header setting-card__header--split">
            <div className="setting-card__left">
              <div className="card-icon"><Icon name="show_chart" /></div>
              <div className="setting-card__title">貯蓄予測シミュレーション</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {running && <span className="loading-spinner" />}
              <button className="btn btn--outline" onClick={() => setEditOpen(true)} title="目標・固定費を編集">
                <Icon name="edit" size={17} />
                編集
              </button>
            </div>
          </div>

          {!result ? (
            <p className="goal-summary__note" style={{ marginTop: 4 }}>
              シミュレーションを表示できませんでした。目標日が今日より後になっているか、条件をご確認ください。
              <button className="btn btn--outline" style={{ marginLeft: 8 }} onClick={() => runSimulation()}>再試行</button>
            </p>
          ) : (
          <>
          {/* グラフをトップに表示 */}
          <SimulationChart result={result} />

          <div className="sim-legend">
            <span><i style={{ background: 'var(--danger)' }} /> 悲観(P10)</span>
            <span><i style={{ background: 'var(--accent)' }} /> 中央値(P50)</span>
            <span><i style={{ background: 'var(--success)' }} /> 楽観(P90)</span>
            <span><i style={{ background: 'var(--warning)' }} /> 目標額</span>
          </div>

          {/* 楽観値・中央値・悲観値（目標日時点の予測貯蓄額） */}
          <div className="section-label" style={{ display: 'block', margin: '22px 0 10px' }}>目標日時点の予測貯蓄額</div>
          <div className="sim-stat-grid" style={{ marginBottom: 20 }}>
            <div className="sim-stat">
              <div className="sim-stat-label">楽観的（上位10%）</div>
              <div className="sim-stat-value" style={{ color: 'var(--success)' }}>{yen(result.finalP90)}</div>
            </div>
            <div className="sim-stat">
              <div className="sim-stat-label">中央値（50%）</div>
              <div className="sim-stat-value accent" style={{ color: 'var(--accent)' }}>{yen(result.finalP50)}</div>
            </div>
            <div className="sim-stat">
              <div className="sim-stat-label">悲観的（下位10%）</div>
              <div className="sim-stat-value" style={{ color: 'var(--danger)' }}>{yen(result.finalP10)}</div>
            </div>
          </div>

          {/* 補助指標 */}
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
            <div className="sim-stat">
              <div className="sim-stat-label">予測の振れ幅 (P10〜P90)</div>
              <div className="sim-stat-value">{yen(result.finalP90 - result.finalP10)}</div>
            </div>
          </div>

          <p className="goal-summary__note" style={{ marginTop: 16 }}>
            学習値: 月収 {yen(result.monthlyIncome)} / 固定費 {yen(result.fixedExpense)} / 変動費 {yen(result.variableExpense)}。
            {dates && !dates.achievable && ' 現状の収支では目標達成が困難です。支出の見直しを検討しましょう。'}
            {dates?.estimatedOnly && ' （期限内達成は難しいですが、ペースを維持すれば将来的に到達見込みです）'}
            {result.variableExpense < 20000 && ' ※支出の記録が少なく変動費が小さいため、季節支出・衝動買い・病気などの「振れ幅」系スライダーの効果がほとんど出ません。下の「変動費の上書き」に実際の月の変動費を入れるか、支出を記録すると精度が上がります。'}
          </p>
          </>
          )}
        </div>

        {/* シミュレーション条件（画面上でリアルタイム調整） */}
        <div className="setting-card">
          <div className="setting-card__header setting-card__header--split">
            <div className="setting-card__left">
              <div className="card-icon"><Icon name="tune" /></div>
              <div className="setting-card__heading">
                <div className="setting-card__title">シミュレーション条件</div>
                <div className="setting-card__subtitle">スライダーを動かすとリアルタイムで再計算されます</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {running && <span className="loading-spinner" />}
              <button className="btn btn--outline" onClick={resetConditions} title="条件を既定値に戻す">
                <Icon name="restart_alt" size={16} />
                リセット
              </button>
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label className="field__label">現在の年齢</label>
              <input
                className="field__input"
                type="number"
                inputMode="numeric"
                min="18"
                max="99"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                aria-label="現在の年齢"
              />
              <div className="field__label" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                年齢が高いほど病気（医療費）リスクが上がります
              </div>
            </div>
            <div className="field">
              <label className="field__label">医療保険カバー率: {insurance}%</label>
              <input
                type="range" min="0" max="100" step="5" value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                aria-label="医療保険カバー率"
              />
              <div className="field__label" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                医療費の自己負担 = 費用 ×(1−カバー率)
              </div>
            </div>
            <div className="field">
              <label className="field__label">月収の上書き (円・任意)</label>
              <input
                className="field__input"
                type="text"
                inputMode="numeric"
                value={incomeOverride}
                onChange={(e) => setIncomeOverride(withCommas(e.target.value))}
                placeholder={result ? withCommas(String(Math.round(result.monthlyIncome))) : '実績'}
              />
            </div>
            <div className="field">
              <label className="field__label">変動費の上書き (円・任意)</label>
              <input
                className="field__input"
                type="text"
                inputMode="numeric"
                value={variableOverride}
                onChange={(e) => setVariableOverride(withCommas(e.target.value))}
                placeholder={result ? withCommas(String(Math.round(result.variableExpense))) : '実績'}
              />
            </div>
            <div className="field">
              <label className="field__label">病気リスク: {illnessPct}%</label>
              <input
                type="range" min="0" max="200" step="10" value={illnessPct}
                onChange={(e) => setIllnessPct(e.target.value)}
                aria-label="病気リスク倍率"
              />
            </div>
            <div className="field">
              <label className="field__label">季節支出の強度: {seasonalPct}%</label>
              <input
                type="range" min="0" max="200" step="10" value={seasonalPct}
                onChange={(e) => setSeasonalPct(e.target.value)}
                aria-label="季節支出の強度"
              />
            </div>
            <div className="field">
              <label className="field__label">衝動買いの強度: {impulsePct}%</label>
              <input
                type="range" min="0" max="200" step="10" value={impulsePct}
                onChange={(e) => setImpulsePct(e.target.value)}
                aria-label="衝動買いの強度"
              />
            </div>
          </div>
          <div className="field__label" style={{ fontWeight: 400, color: 'var(--text-secondary)', marginTop: 8 }}>
            各ショックは 100%=既定、0%で無効化、200%で2倍。変更するとリアルタイムに再計算します。
          </div>
        </div>
        </>
      )}

      {/* 編集モーダル: 貯蓄目標・固定費。保存すると自動で再計算される（条件はシミュレーション画面で直接調整）。
          祖先の transform 等に影響されず常にウィンドウ中央に出すため body へポータルする。 */}
      {editOpen && createPortal(
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">目標・固定費の設定</h3>
              <button className="modal-close-btn" onClick={() => setEditOpen(false)} aria-label="閉じる">
                <Icon name="close" />
              </button>
            </div>
            <div className="modal-body">
              <SimulationSettings onGoalChange={handleGoalChange} />
            </div>
            <div className="modal-footer">
              <button className="btn btn--primary btn--block" onClick={() => setEditOpen(false)}>閉じる</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
