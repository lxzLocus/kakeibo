'use client';

import { useState, useEffect, useCallback } from 'react';
import { analyticsApi, entryApi, ApiError } from '@/lib/api';
import { MonthlySummary, EntryResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { SimulationPanel } from './SimulationPanel';
import { TrendPanel } from './TrendPanel';
import { categoryColor } from '@/lib/colors';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSignedCurrency(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatCurrency(Math.abs(amount))}`;
}

function formatCompact(amount: number): string {
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万`;
  return formatCurrency(amount);
}

export default function AnalyticsPage() {
  const now = new Date();
  const [view, setView] = useState<'report' | 'trend' | 'simulation'>('report');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [monthEntries, setMonthEntries] = useState<EntryResponse[]>([]); // 選択月の全取引
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const since = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const until = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const [result, ents] = await Promise.all([
        analyticsApi.getMonthlySummary(year, month),
        entryApi.getAll(since, until),
      ]);
      setData(result);
      setMonthEntries(ents as EntryResponse[]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '分析データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else setMonth(month + 1);
  }

  function buildDonutGradient(): string {
    if (!data || data.byCategory.length === 0) {
      return 'conic-gradient(var(--surface-3) 0deg 360deg)';
    }
    const segments: string[] = [];
    let currentDeg = 0;
    data.byCategory.forEach((cat, i) => {
      const deg = (cat.percentage / 100) * 360;
      segments.push(`${categoryColor(i)} ${currentDeg}deg ${currentDeg + deg}deg`);
      currentDeg += deg;
    });
    if (currentDeg < 360) segments.push(`var(--surface-3) ${currentDeg}deg 360deg`);
    return `conic-gradient(${segments.join(', ')})`;
  }

  function getDailyMax(): number {
    if (!data) return 1;
    let max = 0;
    data.dailyTrend.forEach((d) => {
      max = Math.max(max, d.income, d.expense);
    });
    return max || 1;
  }

  return (
    <div className="screen">
      {/* ヘッダーとタブはタブ切替で不変（月セレクタは下のレポート内に配置し、切替でガタつかせない） */}
      <div className="page-head">
        <h1 className="page-title">分析</h1>
      </div>

      <div className="segment" style={{ maxWidth: 520, marginBottom: 24 }}>
        <button className={`segment-btn ${view === 'report' ? 'active' : ''}`} onClick={() => setView('report')}>
          月次レポート
        </button>
        <button className={`segment-btn ${view === 'trend' ? 'active' : ''}`} onClick={() => setView('trend')}>
          推移
        </button>
        <button className={`segment-btn ${view === 'simulation' ? 'active' : ''}`} onClick={() => setView('simulation')}>
          シミュレーション
        </button>
      </div>

      {view === 'simulation' ? (
        <SimulationPanel />
      ) : view === 'trend' ? (
        <TrendPanel />
      ) : (
        <>
      <div className="analytics-toolbar">
        <div className="month-pill">
          <button className="month-pill-btn" onClick={prevMonth} aria-label="前月">
            <Icon name="chevron_left" />
          </button>
          <span className="month-pill-label">
            {year}年 {month}月
          </span>
          <button className="month-pill-btn" onClick={nextMonth} aria-label="翌月">
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <Icon name="error" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <span className="loading-spinner" />
          分析データを計算中...
        </div>
      ) : data ? (
        <>
          {/* 収支ヒーロー */}
          <div className="hero">
            <div className="section-label">収支バランス</div>
            <div className="hero-value">{formatSignedCurrency(data.balance)}</div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-label">収入合計</span>
                <span className="hero-stat-value accent">{formatCurrency(data.totalIncome)}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">支出合計</span>
                <span className="hero-stat-value">{formatCurrency(data.totalExpense)}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">取引</span>
                <span className="hero-stat-value">{data.transactionCount.toLocaleString()}件</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">1日平均支出</span>
                <span className="hero-stat-value">{formatCurrency(data.dailyAverageExpense)}</span>
              </div>
            </div>
          </div>

          <div className="analytics-grid">
            {/* カテゴリ別ドーナツ */}
            <div className="card pad-lg">
              <div className="section-label" style={{ display: 'block', marginBottom: 18 }}>カテゴリ別支出</div>
              {data.byCategory.length > 0 ? (
                <div className="donut-wrap">
                  <div className="donut" style={{ background: buildDonutGradient() }}>
                    <div className="donut-center">
                      <span className="donut-center-label">支出合計</span>
                      <span className="donut-center-value">{formatCompact(data.totalExpense)}</span>
                    </div>
                  </div>
                  <div className="legend">
                    {data.byCategory.map((cat, i) => (
                      <div key={cat.categoryId} className="legend-item">
                        <div className="legend-chip" style={{ background: categoryColor(i) }} />
                        <span className="legend-name">{cat.name}</span>
                        <span className="legend-pct">{cat.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Icon name="donut_large" />
                  </div>
                  <div className="empty-state-text">支出データなし</div>
                </div>
              )}
            </div>

            {/* 店舗ランキング */}
            <div className="card pad-lg">
              <div className="section-label" style={{ display: 'block', marginBottom: 18 }}>店舗別支出ランキング</div>
              {data.byStore.length > 0 ? (
                <div className="rank-list">
                  {data.byStore.slice(0, 8).map((store, i) => {
                    const maxAmount = data.byStore[0].amount;
                    const widthPct = maxAmount > 0 ? (store.amount / maxAmount) * 100 : 0;
                    return (
                      <div key={store.storeId}>
                        <div className="rank-head">
                          <span className="rank-name">
                            <span className="rank-badge">{i + 1}</span>
                            <span>{store.name}</span>
                          </span>
                          <span className="rank-amount">
                            {formatCurrency(store.amount)}<span className="rank-pct"> ({store.percentage.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Icon name="storefront" />
                  </div>
                  <div className="empty-state-text">店舗データなし</div>
                </div>
              )}
            </div>

            {/* 日別推移 */}
            <div className="card pad-lg grid-full analytics-daily">
              <div className="card-head">
                <div className="section-label">日別推移</div>
                <div className="daily-legend">
                  <span>
                    <span className="legend-dot inc" />収入
                  </span>
                  <span>
                    <span className="legend-dot exp" />支出
                  </span>
                </div>
              </div>
              <div className="daily-chart">
                {data.dailyTrend.map((day) => {
                  const max = getDailyMax();
                  const incomeH = max > 0 ? (day.income / max) * 140 : 0;
                  const expenseH = max > 0 ? (day.expense / max) * 140 : 0;
                  const dayNum = new Date(day.date + 'T00:00:00').getDate();
                  return (
                    <div
                      key={day.date}
                      className="day-col"
                      title={`${dayNum}日: 収入${formatCurrency(day.income)} / 支出${formatCurrency(day.expense)}`}
                    >
                      <div className="day-bar inc" style={{ height: incomeH }} />
                      <div className="day-bar exp" style={{ height: expenseH }} />
                      <span className="day-label">{dayNum % 5 === 1 ? dayNum : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* この月の全取引 */}
          <div className="card pad-lg" style={{ marginTop: 16 }}>
            <div className="section-label" style={{ display: 'block', marginBottom: 12 }}>
              この月の取引（{monthEntries.length}件）
            </div>
            {monthEntries.length > 0 ? (
              <div className="analytics-txn-list">
                {[...monthEntries]
                  .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
                  .map((e) => (
                    <div key={e.id} className="analytics-txn-row">
                      <span className="analytics-txn-date">{e.entryDate.slice(5).replace('-', '/')}</span>
                      <span className="analytics-txn-body">
                        {e.categoryName}{e.storeName ? ` · ${e.storeName}` : ''}
                        {e.memo ? <span className="analytics-txn-memo"> {e.memo}</span> : null}
                      </span>
                      <span className={`analytics-txn-amount ${e.type === 'INCOME' ? 'inc' : ''}`}>
                        {e.type === 'INCOME' ? '+' : '-'}{formatCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-text">この月の取引はありません</div>
              </div>
            )}
          </div>
        </>
      ) : null}
        </>
      )}
    </div>
  );
}
