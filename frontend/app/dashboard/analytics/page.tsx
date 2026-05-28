'use client';

import { useState, useEffect, useCallback } from 'react';
import { analyticsApi, ApiError } from '@/lib/api';
import { MonthlySummary } from '@/types';

const DONUT_COLORS = [
  '#2dd4a0', '#6366f1', '#f97316', '#ec4899',
  '#06b6d4', '#eab308', '#8b5cf6', '#14b8a6',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(amount: number): string {
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(1)}万`;
  }
  return formatCurrency(amount);
}

export default function AnalyticsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await analyticsApi.getMonthlySummary(year, month);
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('分析データの取得に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else { setMonth(month - 1); }
  }

  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else { setMonth(month + 1); }
  }

  // ドーナツチャート用の conic-gradient を組み立てる
  function buildDonutGradient(): string {
    if (!data || data.byCategory.length === 0) {
      return 'conic-gradient(rgba(148, 163, 184, 0.1) 0deg 360deg)';
    }
    const segments: string[] = [];
    let currentDeg = 0;
    data.byCategory.forEach((cat, i) => {
      const deg = (cat.percentage / 100) * 360;
      const color = DONUT_COLORS[i % DONUT_COLORS.length];
      segments.push(`${color} ${currentDeg}deg ${currentDeg + deg}deg`);
      currentDeg += deg;
    });
    // 端数を埋める
    if (currentDeg < 360) {
      segments.push(`rgba(148, 163, 184, 0.08) ${currentDeg}deg 360deg`);
    }
    return `conic-gradient(${segments.join(', ')})`;
  }

  // 日別推移の最大値
  function getDailyMax(): number {
    if (!data) return 1;
    let max = 0;
    data.dailyTrend.forEach(d => {
      max = Math.max(max, d.income, d.expense);
    });
    return max || 1;
  }

  return (
    <>
      {/* ヘッダー */}
      <div className="dashboard-greeting">
        <h1>📊 月次分析レポート</h1>
        <p>{year}年{month}月の収支分析</p>
      </div>

      {/* 月セレクタ */}
      <div className="month-selector">
        <button onClick={prevMonth} aria-label="前月">◀</button>
        <span className="month-selector-label">{year}年 {month}月</span>
        <button onClick={nextMonth} aria-label="翌月">▶</button>
      </div>

      {error && (
        <div className="auth-error-banner" style={{ marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <span className="loading-spinner" />
          分析データを計算中...
        </div>
      ) : data ? (
        <>
          {/* サマリーミニカード */}
          <div className="analytics-mini-cards">
            <div className="analytics-mini-card">
              <div className="analytics-mini-card-label">収入合計</div>
              <div className="analytics-mini-card-value positive">
                {formatCurrency(data.totalIncome)}
              </div>
            </div>
            <div className="analytics-mini-card">
              <div className="analytics-mini-card-label">支出合計</div>
              <div className="analytics-mini-card-value negative">
                {formatCurrency(data.totalExpense)}
              </div>
            </div>
            <div className="analytics-mini-card">
              <div className="analytics-mini-card-label">収支バランス</div>
              <div className={`analytics-mini-card-value ${data.balance >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(data.balance)}
              </div>
            </div>
            <div className="analytics-mini-card">
              <div className="analytics-mini-card-label">取引件数</div>
              <div className="analytics-mini-card-value neutral">
                {data.transactionCount}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'rgba(148,163,184,0.6)' }}> 件</span>
              </div>
            </div>
            <div className="analytics-mini-card">
              <div className="analytics-mini-card-label">1日あたり平均支出</div>
              <div className="analytics-mini-card-value warn">
                {formatCurrency(data.dailyAverageExpense)}
              </div>
            </div>
          </div>

          {/* グリッドレイアウト */}
          <div className="analytics-grid">
            {/* カテゴリ別ドーナツチャート */}
            <div className="analytics-card">
              <h3 className="analytics-card-title">🍩 カテゴリ別支出</h3>
              {data.byCategory.length > 0 ? (
                <div className="donut-chart-container">
                  <div
                    className="donut-chart"
                    style={{ background: buildDonutGradient() }}
                  >
                    <div className="donut-chart-center">
                      <span className="donut-chart-center-label">支出合計</span>
                      <span className="donut-chart-center-value">
                        {formatCompact(data.totalExpense)}
                      </span>
                    </div>
                  </div>
                  <div className="donut-legend">
                    {data.byCategory.map((cat, i) => (
                      <div key={cat.categoryId} className="donut-legend-item">
                        <div
                          className="donut-legend-color"
                          style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                        />
                        <span className="donut-legend-name">{cat.name}</span>
                        <span className="donut-legend-amount">
                          {cat.percentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📊</div>
                  <div className="empty-state-text">支出データなし</div>
                </div>
              )}
            </div>

            {/* 店舗ランキング */}
            <div className="analytics-card">
              <h3 className="analytics-card-title">🏪 店舗別支出ランキング</h3>
              {data.byStore.length > 0 ? (
                <div className="store-rank-list">
                  {data.byStore.slice(0, 8).map((store, i) => {
                    const maxAmount = data.byStore[0].amount;
                    const widthPct = maxAmount > 0 ? (store.amount / maxAmount) * 100 : 0;
                    const rankClass = i < 3 ? `rank-${i + 1}` : 'rank-default';
                    return (
                      <div key={store.storeId} className="store-rank-item">
                        <div className="store-rank-header">
                          <span className="store-rank-name">
                            <span className={`store-rank-badge ${rankClass}`}>{i + 1}</span>
                            {store.name}
                          </span>
                          <span className="store-rank-amount">
                            {formatCurrency(store.amount)} ({store.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="store-rank-bar-track">
                          <div
                            className="store-rank-bar-fill"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🏪</div>
                  <div className="empty-state-text">店舗データなし</div>
                </div>
              )}
            </div>

            {/* 日別推移グラフ */}
            <div className="analytics-card analytics-full-width">
              <h3 className="analytics-card-title">📈 日別推移</h3>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'rgba(148,163,184,0.6)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(45, 212, 148, 0.6)', display: 'inline-block' }} />
                  収入
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(239, 68, 68, 0.6)', display: 'inline-block' }} />
                  支出
                </span>
              </div>
              <div className="daily-chart">
                <div className="daily-chart-inner">
                  {data.dailyTrend.map((day) => {
                    const max = getDailyMax();
                    const incomeH = max > 0 ? (day.income / max) * 140 : 0;
                    const expenseH = max > 0 ? (day.expense / max) * 140 : 0;
                    const dayNum = new Date(day.date + 'T00:00:00').getDate();
                    return (
                      <div
                        key={day.date}
                        className="daily-bar-group"
                        title={`${dayNum}日: 収入${formatCurrency(day.income)} / 支出${formatCurrency(day.expense)}`}
                      >
                        {day.income > 0 && (
                          <div
                            className="daily-bar income"
                            style={{ height: `${incomeH}px` }}
                          />
                        )}
                        {day.expense > 0 && (
                          <div
                            className="daily-bar expense"
                            style={{ height: `${expenseH}px` }}
                          />
                        )}
                        {dayNum % 5 === 1 && (
                          <span className="daily-bar-label">{dayNum}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
