'use client';

import { useMemo, useState } from 'react';
import { EntryResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function yen(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}
function signed(type: 'INCOME' | 'EXPENSE', amount: number): string {
  return `${type === 'INCOME' ? '+' : '-'}${amount.toLocaleString('ja-JP')}`;
}
/** year(4桁) と month(1-12) から 'YYYY-MM' を作る */
function ymOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
function dateOf(year: number, month: number, day: number): string {
  return `${ymOf(year, month)}-${String(day).padStart(2, '0')}`;
}

type DaySummary = { inc: number; exp: number; count: number };

/**
 * 月カレンダーのモーダル。
 * - 記録がある日は日付の下にドットを表示（収入=青 / 支出=グレー）
 * - 日付をタップすると「1日ごとのビュー」に切り替わり、その日の収支を直接編集・追加できる
 *   （取引履歴の「もっと見る」を経由しなくても、任意の日へ飛べる）
 *
 * 月の移動は親の year/month をそのまま動かすため、親側の再取得にそのまま乗る。
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
  /** 表示中の月のエントリー（親が year/month で取得済みのもの） */
  entries: EntryResponse[];
  loading?: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** 明細をタップ → 親が編集モーダルを開く */
  onEditEntry: (entry: EntryResponse) => void;
  /** 「この日に追加」 → 親が追加モーダルをその日付で開く */
  onAddOnDay: (dateStr: string) => void;
  onClose: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const ym = ymOf(year, month);

  // 月が変わったら日の選択を解除してカレンダーに戻す。
  // 残したままだと、日数の少ない月へ移った際に 4月31日 のような不正な日付を
  // 「この日に追加」へ渡してしまう（date入力が空になる）。
  // 描画中に調整する React 推奨パターン（effect 内の setState は cascading render になる）。
  const [prevYm, setPrevYm] = useState(ym);
  if (ym !== prevYm) {
    setPrevYm(ym);
    setSelectedDay(null);
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  // 表示中の月のぶんだけを日ごとに集計（親のデータが別月のままでも混ざらないよう ym で絞る）
  const byDay = useMemo(() => {
    const map = new Map<number, DaySummary>();
    for (const e of entries) {
      if (!e.entryDate.startsWith(ym)) continue;
      const d = Number(e.entryDate.slice(8, 10));
      const cur = map.get(d) ?? { inc: 0, exp: 0, count: 0 };
      if (e.type === 'INCOME') cur.inc += e.amount;
      else cur.exp += e.amount;
      cur.count++;
      map.set(d, cur);
    }
    return map;
  }, [entries, ym]);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;

  // 空セル + 日付セルを週ごとに分割
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const dayEntries = selectedDay
    ? entries
        .filter((e) => e.entryDate === dateOf(year, month, selectedDay))
        .sort((a, b) => a.id - b.id)
    : [];
  const daySum = selectedDay ? byDay.get(selectedDay) : undefined;

  function goPrevDay() {
    if (selectedDay && selectedDay > 1) setSelectedDay(selectedDay - 1);
  }
  function goNextDay() {
    if (selectedDay && selectedDay < daysInMonth) setSelectedDay(selectedDay + 1);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3 className="modal-title">
            {selectedDay == null ? 'カレンダー' : `${month}月${selectedDay}日(${WEEKDAYS[new Date(year, month - 1, selectedDay).getDay()]})`}
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="閉じる">
            <Icon name="close" />
          </button>
        </div>

        <div className="modal-body">
          {selectedDay == null ? (
            <>
              {/* 月ナビ（親の year/month を動かす → 親が自動で再取得する） */}
              <div className="cal-nav">
                <button className="month-pill-btn" onClick={onPrevMonth} aria-label="前月">
                  <Icon name="chevron_left" />
                </button>
                <span className="cal-nav__label">{year}年 {month}月</span>
                <button className="month-pill-btn" onClick={onNextMonth} aria-label="翌月">
                  <Icon name="chevron_right" />
                </button>
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
                    const has = !!sum && sum.count > 0;
                    const cls = [
                      'cal-cell',
                      has ? 'cal-cell--has' : '',
                      isToday(d) ? 'cal-cell--today' : '',
                      di === 0 ? 'sun' : di === 6 ? 'sat' : '',
                    ].filter(Boolean).join(' ');
                    return (
                      <button
                        key={`${wi}-${di}`}
                        type="button"
                        className={cls}
                        onClick={() => setSelectedDay(d)}
                        aria-label={`${month}月${d}日${has ? `（${sum!.count}件）` : ''}`}
                      >
                        <span className="cal-daynum">{d}</span>
                        {/* 記録がある日だけドットを打つ（収入 / 支出 で色分け） */}
                        <span className="cal-dots">
                          {!!sum && sum.exp > 0 && <span className="cal-dot exp" />}
                          {!!sum && sum.inc > 0 && <span className="cal-dot inc" />}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="cal-legend">
                <span><span className="cal-dot exp" /> 支出あり</span>
                <span><span className="cal-dot inc" /> 収入あり</span>
              </div>
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
