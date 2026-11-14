'use client';

import { Icon } from '@/app/_components/Icon';

export type PacePastStat = {
  label: string;     // 「10月」など
  sameDay: number;   // 期間初日〜同じ経過日数までの支出
  total: number;     // 期間全体の支出
};

type Props = {
  title: string;
  elapsedDays: number;      // 今期の経過日数（今日を含む）
  spentToDate: number;      // 今期の今日までの支出
  dailyAvg: number;
  projected: number;        // 期間末の支出見込み
  projectedBasis: 'past' | 'linear';
  past: PacePastStat[];     // 新しい順。データのある期間のみ
  pastLoading: boolean;
  fmt: (n: number) => string;
};

/**
 * 今期のペース: 「今日時点の支出」を過去数か月の同じ経過日数時点と比べる。
 * 今期（今日を含む期間）を表示しているときだけ出す想定。
 */
export function PaceCard({
  title,
  elapsedDays,
  spentToDate,
  dailyAvg,
  projected,
  projectedBasis,
  past,
  pastLoading,
  fmt,
}: Props) {
  const hasPast = past.length > 0;
  const avgSameDay = hasPast ? Math.round(past.reduce((s, p) => s + p.sameDay, 0) / past.length) : 0;
  const avgTotal = hasPast ? Math.round(past.reduce((s, p) => s + p.total, 0) / past.length) : 0;
  const diff = spentToDate - avgSameDay; // マイナス = 節約できている
  const pct = avgSameDay > 0 ? Math.round((Math.abs(diff) / avgSameDay) * 100) : null;
  const saving = diff <= 0;

  const rows = [{ label: '今期', sameDay: spentToDate, current: true }, ...past.map((p) => ({ ...p, current: false }))];
  const max = Math.max(1, ...rows.map((r) => r.sameDay));

  return (
    <>
      <div className="section-label">{title}</div>
      <div className="card pace-card">
        <div className="kv-row">
          <span className="kv-key">{elapsedDays}日目までの支出</span>
          <span className="kv-val">{fmt(spentToDate)}</span>
        </div>

        {hasPast ? (
          <>
            <div className={`pace-diff ${saving ? 'good' : 'bad'}`}>
              <Icon name={saving ? 'trending_down' : 'trending_up'} size={18} />
              <span>
                過去{past.length}か月の同時点平均より
                <strong> {fmt(Math.abs(diff))} {saving ? '少ない' : '多い'}</strong>
                {pct != null && pct > 0 && <span className="pace-pct">（{saving ? '-' : '+'}{pct}%）</span>}
              </span>
            </div>

            <div className="pace-bars" aria-label={`${elapsedDays}日目時点の支出比較`}>
              {rows.map((r) => (
                <div key={r.label} className={`pace-bar-row${r.current ? ' current' : ''}`}>
                  <span className="pace-bar-label">{r.label}</span>
                  <div className="pace-bar-track">
                    <div className="pace-bar-fill" style={{ width: `${(r.sameDay / max) * 100}%` }} />
                  </div>
                  <span className="pace-bar-amount">{fmt(r.sameDay)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="kv-note" style={{ marginBottom: 8 }}>
            {pastLoading ? '過去の期間と比較中…' : '比較できる過去の記録がまだありません'}
          </div>
        )}

        <div className="kv-note pace-foot">
          1日あたり {fmt(dailyAvg)}・期間末の見込み 約 {fmt(projected)}
          {projectedBasis === 'past' && hasPast && <>（過去平均 {fmt(avgTotal)}）</>}
        </div>
      </div>
    </>
  );
}
