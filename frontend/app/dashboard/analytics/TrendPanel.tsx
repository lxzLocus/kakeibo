'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { analyticsApi, ApiError } from '@/lib/api';
import { TrendSummary } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { categoryColor } from '@/lib/colors';

function yen(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}
function compact(n: number): string {
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString('ja-JP');
}
/** "2026-02" → "26/02" */
function monthLabel(s: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m ? `${m[1].slice(2)}/${m[2]}` : s;
}

/** 軸の最大値を、divisions 等分したとき区切りがキレイになる値へ切り上げる。 */
function niceMax(v: number, divisions: number): number {
  if (v <= 0) return divisions;
  const rough = v / divisions;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  return step * divisions;
}

/** 金額の軸ラベル（1万以上は「万」、それ未満は円のまま）。 */
function axisLabel(v: number): string {
  if (v >= 10000) {
    const man = v / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  return v.toLocaleString('ja-JP');
}

const RANGES = [3, 6, 12];
const CHART_H = 180;
const HIDDEN_KEY = 'kakeibo.trend.hiddenCategories'; // カテゴリ選択（非表示集合）の保存キー

/** カテゴリ別支出の推移を折れ線で描く軽量SVGチャート（外部ライブラリ不使用） */
function CategoryLineChart({
  months,
  cats,
  colorOf,
}: {
  months: string[];
  cats: { categoryId: number; name: string; monthly: number[] }[];
  colorOf: (id: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [w, setW] = useState(680); // 実測コンテナ幅（1 viewBox単位 = 1px にして文字サイズを画面幅によらず一定に保つ）
  const wrapRef = useRef<HTMLDivElement>(null);

  // コンテナ幅を実測して viewBox 幅に使う → スマホでも文字が縮小されず読める大きさになる
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setW(Math.round(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 260;
  const padL = 46;
  const padR = 12;
  const padT = 16;
  const padB = 30;
  const n = months.length;
  const ticks = 4;
  const plotW = Math.max(1, w - padL - padR);
  const maxV = niceMax(Math.max(1, ...cats.flatMap((c) => c.monthly)), ticks);
  // 横軸ラベルは1つ約42px必要。幅に対して多すぎる場合は間引いて重なりを防ぐ（12ヶ月×狭幅で潰れる対策）
  const labelStep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 42))));

  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + (1 - v / maxV) * (height - padT - padB);

  // マウス位置から最も近い月インデックスを求める（PCのみ。スマホのタッチでは発火しない）
  function handleMove(e: MouseEvent<HTMLDivElement>) {
    // スマホなど粗いポインタ（タッチ）では表示しない
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
    const el = wrapRef.current;
    if (!el || n < 1) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const vx = ((e.clientX - rect.left) / rect.width) * w; // ピクセル → viewBox 座標
    const i = n <= 1 ? 0 : Math.round((vx - padL) / (plotW / (n - 1)));
    const clamped = Math.max(0, Math.min(n - 1, i));
    setHover((prev) => (prev === clamped ? prev : clamped));
  }

  const frac = hover != null ? x(hover) / w : 0;
  const flip = frac > 0.62; // 右寄りのときはツールチップを左側へ

  return (
    <div
      ref={wrapRef}
      className="trend-chart-wrap"
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${w} ${height}`} className="trend-line-chart" role="img" aria-label="カテゴリ別支出の推移">
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (maxV / ticks) * i;
          const yy = y(v);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={w - padR} y2={yy} stroke="var(--hairline)" />
              <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
                {axisLabel(v)}
              </text>
            </g>
          );
        })}

        {/* ホバー中の月を示す縦ガイド */}
        {hover != null && (
          <line
            x1={x(hover)}
            y1={padT}
            x2={x(hover)}
            y2={height - padB}
            stroke="var(--text-faint)"
            strokeDasharray="3 3"
            opacity="0.6"
          />
        )}

        {cats.map((c) => {
          const color = colorOf(c.categoryId);
          const d = c.monthly.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
          return (
            <g key={c.categoryId}>
              <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              {c.monthly.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r={hover === i ? 4.6 : 3}
                  fill={color}
                  stroke={hover === i ? 'var(--surface)' : 'none'}
                  strokeWidth={hover === i ? 1.5 : 0}
                />
              ))}
            </g>
          );
        })}

        {months.map((m, i) => {
          // 間引き対象はスキップ（最初と最後は必ず出す）
          if (i % labelStep !== 0 && i !== n - 1) return null;
          // 端のラベルが viewBox からはみ出して切れないよう、両端だけ寄せる
          const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
          return (
            <text key={m} x={x(i)} y={height - 10} textAnchor={anchor} fontSize="11" fill="var(--text-faint)">
              {monthLabel(m)}
            </text>
          );
        })}
      </svg>

      {/* ホバー時のツールチップ（金額表示・PCのみ） */}
      {hover != null && (
        <div
          className="trend-tip"
          style={{ left: `${frac * 100}%`, transform: flip ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)' }}
        >
          <div className="trend-tip-title">{monthLabel(months[hover])}</div>
          {cats.map((c) => (
            <div key={c.categoryId} className="trend-tip-row">
              <span className="legend-chip" style={{ background: colorOf(c.categoryId) }} />
              <span className="trend-tip-name">{c.name}</span>
              <span className="trend-tip-val">{yen(c.monthly[hover])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrendPanel() {
  const now = new Date();
  const [months, setMonths] = useState(6);
  const [ready, setReady] = useState(false); // 初期化（デバイス別の期間・保存済みフィルタの読込）完了フラグ
  const [data, setData] = useState<TrendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState<Set<number>>(new Set()); // 非表示カテゴリID
  const [filterOpen, setFilterOpen] = useState(false); // カテゴリ選択プルタブの開閉

  // 初回: スマホ=半年(6) / PC=1年(12) の初期期間を決定し、保存済みのカテゴリ選択を復元する
  useEffect(() => {
    setMonths(typeof window !== 'undefined' && window.innerWidth <= 768 ? 6 : 12);
    try {
      const saved = localStorage.getItem(HIDDEN_KEY);
      if (saved) setHidden(new Set(JSON.parse(saved) as number[]));
    } catch {
      // 読込失敗時は既定（全表示）
    }
    setReady(true);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await analyticsApi.getTrend(now.getFullYear(), now.getMonth() + 1, months);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '推移データの取得に失敗しました');
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  useEffect(() => {
    if (ready) fetchData();
  }, [ready, fetchData]);

  const hasExpense = !!data && data.monthlyExpense.some((v) => v > 0);
  const incExpMax = data
    ? Math.max(1, ...data.monthlyIncome, ...data.monthlyExpense)
    : 1;

  // カテゴリの色は元の並び（合計降順）で固定 → フィルタしても色が変わらない
  const catIndex = new Map((data?.categories ?? []).map((c, i) => [c.categoryId, i] as const));
  const colorOf = (id: number) => categoryColor(catIndex.get(id) ?? 0);
  const visibleCats = (data?.categories ?? []).filter((c) => !hidden.has(c.categoryId));
  const hasVisible = visibleCats.length > 0;

  // 選択（非表示集合）を更新し、次回のために保存する
  function updateHidden(next: Set<number>) {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      // 保存失敗は無視
    }
  }

  function toggleCat(id: number) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateHidden(next);
  }

  return (
    <div>
      {/* 期間セレクタ */}
      <div className="analytics-toolbar">
        <div className="segment" style={{ maxWidth: 320 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              className={`segment-btn ${months === r ? 'active' : ''}`}
              onClick={() => setMonths(r)}
            >
              {r}ヶ月
            </button>
          ))}
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
          推移データを計算中...
        </div>
      ) : data ? (
        <>
          {/* 収支の推移 */}
          <div className="card pad-lg" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div className="section-label">収支の推移</div>
              <div className="daily-legend">
                <span><span className="legend-dot inc" />収入</span>
                <span><span className="legend-dot exp" />支出</span>
              </div>
            </div>
            <div className="trend-bars-wrap">
            <div className="trend-bars" style={{ height: CHART_H }}>
              {data.months.map((m, i) => {
                const inc = data.monthlyIncome[i];
                const exp = data.monthlyExpense[i];
                const bal = data.monthlyBalance[i];
                return (
                  <div key={m} className="trend-col" title={`${m}  収入 ${yen(inc)} / 支出 ${yen(exp)} / 収支 ${yen(bal)}`}>
                    <div className="trend-col-bars">
                      <div className="trend-bar inc" style={{ height: (inc / incExpMax) * (CHART_H - 20) }} />
                      <div className="trend-bar exp" style={{ height: (exp / incExpMax) * (CHART_H - 20) }} />
                    </div>
                    <span className={`trend-bal ${bal < 0 ? 'neg' : ''}`}>{compact(bal)}</span>
                    <span className="trend-xlabel">{monthLabel(m)}</span>
                  </div>
                );
              })}
            </div>
            </div>
          </div>

          {/* カテゴリ別支出の推移（積み上げ） */}
          <div className="card pad-lg" style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ display: 'block', marginBottom: 16 }}>カテゴリ別支出の推移</div>
            {hasExpense ? (
              <>
                {/* 表示カテゴリ プルタブ（チェックで選択） */}
                <div className="trend-picker">
                  <button
                    type="button"
                    className="trend-picker-tab"
                    onClick={() => setFilterOpen((o) => !o)}
                    aria-expanded={filterOpen}
                  >
                    <Icon name="filter_list" size={18} />
                    表示カテゴリ
                    <span className="trend-picker-count">{visibleCats.length}/{data.categories.length}</span>
                    <Icon name={filterOpen ? 'expand_less' : 'expand_more'} size={18} />
                  </button>
                  {filterOpen && (
                    <div className="trend-picker-body">
                      <div className="trend-picker-actions">
                        <button type="button" onClick={() => updateHidden(new Set())}>すべて選択</button>
                        <button type="button" onClick={() => updateHidden(new Set(data.categories.map((c) => c.categoryId)))}>すべて解除</button>
                      </div>
                      <div className="trend-check-list">
                        {data.categories.map((cat) => (
                          <label key={cat.categoryId} className="trend-check">
                            <input
                              type="checkbox"
                              checked={!hidden.has(cat.categoryId)}
                              onChange={() => toggleCat(cat.categoryId)}
                            />
                            <span className="legend-chip" style={{ background: colorOf(cat.categoryId) }} />
                            <span className="trend-check-name">{cat.name}</span>
                            <span className="trend-check-total">{yen(cat.total)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {hasVisible ? (
                  <>
                    <CategoryLineChart months={data.months} cats={visibleCats} colorOf={colorOf} />
                    <div className="legend" style={{ marginTop: 14 }}>
                      {visibleCats.map((cat) => (
                        <div key={cat.categoryId} className="legend-item">
                          <div className="legend-chip" style={{ background: colorOf(cat.categoryId) }} />
                          <span className="legend-name">{cat.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-text">表示するカテゴリを選択してください</div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon"><Icon name="show_chart" /></div>
                <div className="empty-state-text">この期間の支出データがありません</div>
              </div>
            )}
          </div>

          {/* カテゴリ別 明細（月次・数値。フィルタ中は表示カテゴリのみ） */}
          {hasExpense && hasVisible && (
            <div className="card pad-lg">
              <div className="section-label" style={{ display: 'block', marginBottom: 12 }}>カテゴリ別 明細</div>
              <div className="trend-table-wrap">
                <table className="trend-table">
                  <thead>
                    <tr>
                      <th className="trend-th-cat">カテゴリ</th>
                      {data.months.map((m) => (
                        <th key={m}>{monthLabel(m)}</th>
                      ))}
                      <th className="trend-th-total">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCats.map((cat) => (
                      <tr key={cat.categoryId}>
                        <td className="trend-td-cat">
                          <span className="legend-chip" style={{ background: colorOf(cat.categoryId) }} />
                          {cat.name}
                        </td>
                        {cat.monthly.map((v, i) => (
                          <td key={i} className={v > 0 ? '' : 'trend-zero'}>{v > 0 ? compact(v) : '—'}</td>
                        ))}
                        <td className="trend-td-total">{compact(cat.total)}</td>
                      </tr>
                    ))}
                    <tr className="trend-tr-total">
                      <td className="trend-td-cat">{hidden.size > 0 ? '合計（表示中）' : '支出合計'}</td>
                      {data.months.map((_, i) => (
                        <td key={i}>{compact(visibleCats.reduce((s, c) => s + c.monthly[i], 0))}</td>
                      ))}
                      <td className="trend-td-total">
                        {compact(visibleCats.reduce((s, c) => s + c.total, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
