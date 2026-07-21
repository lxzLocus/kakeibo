'use client';

import { useMemo, useState } from 'react';
import { EntryResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { categoryColor } from '@/lib/colors';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// ヒートマップの逐次スケールに使う基準色（= デザインの --accent #a8c7fa）。
// CSS変数はJSから補間できないため、逐次スケールのためだけにRGBを持つ。
const ACCENT_RGB = '168, 199, 250';

type Metric = 'amount' | 'count' | 'category';

function yen(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}
/** セル内に収める短い金額表記（例: 1.5万 / 3.2k / 320）。 */
function compact(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}
function signed(type: 'INCOME' | 'EXPENSE', amount: number): string {
  return `${type === 'INCOME' ? '+' : '-'}${amount.toLocaleString('ja-JP')}`;
}
function ymOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
function dateOf(year: number, month: number, day: number): string {
  return `${ymOf(year, month)}-${String(day).padStart(2, '0')}`;
}

type DaySummary = {
  inc: number;
  exp: number;
  count: number;
  cats: Map<number, { name: string; amount: number }>; // 支出のカテゴリ別合計
};

const METRICS: { key: Metric; label: string }[] = [
  { key: 'amount', label: '金額' },
  { key: 'count', label: '件数' },
  { key: 'category', label: 'カテゴリ' },
];

/**
 * 月カレンダー。各日をヒートマップで表示する。
 *  - 金額 : その日の支出合計を単一色相の濃淡で（外れ値対策に sqrt スケール）
 *  - 件数 : その日の記録件数を濃淡で
 *  - カテゴリ : その日の最大支出カテゴリの色で塗り分け
 * 収入がある日は右上に小さなドットで示す。日付タップで1日ごとのビューへ。
 */
export function CalendarModal({
  year,
  month,
  entries,
  loading = false,
  onPrevMonth,
  onNextMonth,
  onEditEntry,
  onAddOnDay,
  onClose,
}: {
  year: number;
  month: number;
  entries: EntryResponse[];
  loading?: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onEditEntry: (entry: EntryResponse) => void;
  onAddOnDay: (dateStr: string) => void;
  onClose: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>('amount');
  const ym = ymOf(year, month);

  // 月が変わったら日の選択を解除してカレンダーに戻す（描画中に調整するReact推奨パターン）。
  const [prevYm, setPrevYm] = useState(ym);
  if (ym !== prevYm) {
    setPrevYm(ym);
    setSelectedDay(null);
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  // 日ごとの集計 + カテゴリ別合計（色割当と最大値の基準に使う）
  const { byDay, catColorOf, catLegend, maxCount, maxExp } = useMemo(() => {
    const map = new Map<number, DaySummary>();
    const catTotal = new Map<number, { name: string; total: number }>();
    for (const e of entries) {
      if (!e.entryDate.startsWith(ym)) continue;
      const d = Number(e.entryDate.slice(8, 10));
      const cur = map.get(d) ?? { inc: 0, exp: 0, count: 0, cats: new Map() };
      if (e.type === 'INCOME') {
        cur.inc += e.amount;
      } else {
        cur.exp += e.amount;
        const c = cur.cats.get(e.categoryId) ?? { name: e.categoryName, amount: 0 };
        c.amount += e.amount;
        cur.cats.set(e.categoryId, c);
        const ct = catTotal.get(e.categoryId) ?? { name: e.categoryName, total: 0 };
        ct.total += e.amount;
        catTotal.set(e.categoryId, ct);
      }
      cur.count++;
      map.set(d, cur);
    }
    // 支出合計の多い順にカテゴリ色を固定割当（フィルタしても色が動かない考え方に合わせる）
    const ranked = [...catTotal.entries()].sort((a, b) => b[1].total - a[1].total);
    const colorMap = new Map<number, string>();
    ranked.forEach(([id], i) => colorMap.set(id, categoryColor(i)));
    const legend = ranked.map(([id, v], i) => ({ id, name: v.name, color: categoryColor(i), total: v.total }));

    let mc = 0;
    let me = 0;
    for (const s of map.values()) {
      mc = Math.max(mc, s.count);
      me = Math.max(me, s.exp);
    }
    return { byDay: map, catColorOf: colorMap, catLegend: legend, maxCount: mc, maxExp: me };
  }, [entries, ym]);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;

  /** その日の最大支出カテゴリ。 */
  function dominantCat(sum: DaySummary): { id: number; name: string; amount: number } | null {
    let best: { id: number; name: string; amount: number } | null = null;
    for (const [id, c] of sum.cats) {
      if (!best || c.amount > best.amount) best = { id, name: c.name, amount: c.amount };
    }
    return best;
  }

  /** アクセント色の逐次スケール（t:0→1 で薄→濃）。強い時は文字を暗色に。 */
  function accentBg(t: number): { background: string; dark: boolean } {
    const clamped = Math.max(0, Math.min(1, t));
    return { background: `rgba(${ACCENT_RGB}, ${(0.12 + 0.72 * clamped).toFixed(3)})`, dark: clamped > 0.5 };
  }

  /** 選択メトリクスに応じたセルの背景と文字色・セル内表示値。 */
  function cellVisual(sum: DaySummary | undefined): { bg?: string; dark?: boolean; label?: string } {
    if (!sum || sum.count === 0) return {};
    if (metric === 'count') {
      const { background, dark } = accentBg(maxCount ? sum.count / maxCount : 0);
      return { bg: background, dark, label: `${sum.count}` };
    }
    if (metric === 'amount') {
      if (sum.exp <= 0) return { label: sum.inc > 0 ? '収入' : undefined };
      // 家賃や大物購入などの外れ値に潰されないよう sqrt で圧縮
      const { background, dark } = accentBg(maxExp ? Math.sqrt(sum.exp / maxExp) : 0);
      return { bg: background, dark, label: compact(sum.exp) };
    }
    // category
    const dom = dominantCat(sum);
    if (!dom) return {};
    // カテゴリ色は明るいパステルなので、そのまま塗って文字は暗色にする
    return { bg: `${catColorOf.get(dom.id) ?? categoryColor(0)}D9`, dark: true };
  }

  const dayEntries = selectedDay
    ? entries.filter((e) => e.entryDate === dateOf(year, month, selectedDay)).sort((a, b) => a.id - b.id)
    : [];
  const daySum = selectedDay ? byDay.get(selectedDay) : undefined;

  function goPrevDay() {
    if (selectedDay && selectedDay > 1) setSelectedDay(selectedDay - 1);
  }
  function goNextDay() {
    if (selectedDay && selectedDay < daysInMonth) setSelectedDay(selectedDay + 1);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  /** ホバー時のネイティブツールチップ用の要約。 */
  function tip(d: number, sum: DaySummary | undefined): string {
    if (!sum || sum.count === 0) return `${month}月${d}日`;
    const parts = [`${month}月${d}日`, `${sum.count}件`];
    if (sum.exp > 0) parts.push(`支出 ${yen(sum.exp)}`);
    if (sum.inc > 0) parts.push(`収入 ${yen(sum.inc)}`);
    if (metric === 'category') {
      const dom = dominantCat(sum);
      if (dom) parts.push(`最多: ${dom.name} ${yen(dom.amount)}`);
    }
    return parts.join(' ・ ');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3 className="modal-title">
            {selectedDay == null
              ? 'カレンダー'
              : `${month}月${selectedDay}日(${WEEKDAYS[new Date(year, month - 1, selectedDay).getDay()]})`}
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="閉じる">
            <Icon name="close" />
          </button>
        </div>

        <div className="modal-body">
          {selectedDay == null ? (
            <>
              {/* 月ナビ */}
              <div className="cal-nav">
                <button className="month-pill-btn" onClick={onPrevMonth} aria-label="前月">
                  <Icon name="chevron_left" />
                </button>
                <span className="cal-nav__label">{year}年 {month}月</span>
                <button className="month-pill-btn" onClick={onNextMonth} aria-label="翌月">
                  <Icon name="chevron_right" />
                </button>
              </div>

              {/* ヒートマップの指標切替 */}
              <div className="segment cal-metric">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    className={`segment-btn ${metric === m.key ? 'active' : ''}`}
                    onClick={() => setMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="cal-grid cal-grid--head">
                {WEEKDAYS.map((w, i) => (
                  <div key={w} className={`cal-wd${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{w}</div>
                ))}
              </div>

              <div className={`cal-grid${loading ? ' is-loading' : ''}`}>
                {weeks.map((week, wi) =>
                  week.map((d, di) => {
                    if (d == null) return <div key={`${wi}-${di}`} className="cal-cell cal-cell--empty" />;
                    const sum = byDay.get(d);
                    const vis = cellVisual(sum);
                    const cls = [
                      'cal-cell',
                      sum && sum.count > 0 ? 'cal-cell--has' : '',
                      isToday(d) ? 'cal-cell--today' : '',
                      di === 0 ? 'sun' : di === 6 ? 'sat' : '',
                    ].filter(Boolean).join(' ');
                    return (
                      <button
                        key={`${wi}-${di}`}
                        type="button"
                        className={cls}
                        style={vis.bg ? { background: vis.bg } : undefined}
                        onClick={() => setSelectedDay(d)}
                        title={tip(d, sum)}
                        aria-label={tip(d, sum)}
                      >
                        {/* 収入がある日は右上にドット（どの指標でも見えるように） */}
                        {sum && sum.inc > 0 && <span className="cal-inc-dot" />}
                        <span className="cal-daynum" style={vis.dark ? { color: '#1b1b1f' } : undefined}>{d}</span>
                        {vis.label && (
                          <span className="cal-cell-val" style={vis.dark ? { color: '#1b1b1f' } : undefined}>
                            {vis.label}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* 凡例 */}
              {metric === 'category' ? (
                <div className="cal-cat-legend">
                  {catLegend.length === 0 ? (
                    <span className="goal-summary__note" style={{ padding: 0 }}>この月の支出はありません。</span>
                  ) : (
                    <>
                      {catLegend.slice(0, 8).map((c) => (
                        <span key={c.id} className="cal-cat-legend__item">
                          <span className="legend-chip" style={{ background: c.color }} />
                          {c.name}
                        </span>
                      ))}
                      {catLegend.length > 8 && <span className="cal-cat-legend__item">他{catLegend.length - 8}</span>}
                    </>
                  )}
                </div>
              ) : (
                <div className="cal-scale-legend">
                  <span>少</span>
                  <span className="cal-scale-bar" />
                  <span>多</span>
                  <span className="cal-scale-inc"><span className="cal-inc-dot cal-inc-dot--static" /> 収入</span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 1日ごとのビュー */}
              <div className="cal-nav">
                <button className="month-pill-btn" onClick={goPrevDay} disabled={selectedDay <= 1} aria-label="前日">
                  <Icon name="chevron_left" />
                </button>
                <span className="cal-nav__label">
                  {daySum
                    ? `${daySum.count}件 ・ ${daySum.exp > 0 ? `支出 ${yen(daySum.exp)}` : ''}${daySum.exp > 0 && daySum.inc > 0 ? ' / ' : ''}${daySum.inc > 0 ? `収入 ${yen(daySum.inc)}` : ''}`
                    : '記録なし'}
                </span>
                <button className="month-pill-btn" onClick={goNextDay} disabled={selectedDay >= daysInMonth} aria-label="翌日">
                  <Icon name="chevron_right" />
                </button>
              </div>

              {dayEntries.length > 0 ? (
                <div className="card flush">
                  {dayEntries.map((e) => (
                    <button key={e.id} type="button" className="cal-day-row" onClick={() => onEditEntry(e)}>
                      <span className="cal-day-row__main">
                        <span className="cal-day-row__cat">
                          {e.categoryName}
                          {e.storeName ? ` · ${e.storeName}` : ''}
                        </span>
                        {e.memo && <span className="cal-day-row__memo">{e.memo}</span>}
                      </span>
                      <span className={`cal-day-row__amount ${e.type === 'INCOME' ? 'inc' : 'exp'}`}>
                        {signed(e.type, e.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="goal-summary__note">この日の記録はありません。</p>
              )}

              <button className="btn-outline" onClick={() => onAddOnDay(dateOf(year, month, selectedDay))}>
                <Icon name="add" size={17} />
                この日に追加
              </button>
            </>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-btn-group">
            {selectedDay == null ? (
              <>
                <button type="button" className="modal-btn secondary" onClick={onClose}>閉じる</button>
                <button type="button" className="modal-btn primary" onClick={() => setSelectedDay(today.getDate())}
                  disabled={today.getFullYear() !== year || today.getMonth() + 1 !== month}>
                  今日を見る
                </button>
              </>
            ) : (
              <>
                <button type="button" className="modal-btn secondary" onClick={() => setSelectedDay(null)}>
                  カレンダーに戻る
                </button>
                <button type="button" className="modal-btn primary" onClick={onClose}>閉じる</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
