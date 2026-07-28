'use client';

import { useState, useEffect, useCallback } from 'react';
import { analyticsApi, entryApi, categoryApi, storeApi, poolApi, ApiError } from '@/lib/api';
import { MonthlySummary, EntryResponse, CategoryResponse, StoreResponse, FundPoolResponse, AnalysisResult, BenchmarkResult } from '@/types';

const ANALYSIS_ENABLED_KEY = 'kakeibo.analysisEnabled';
import { Icon } from '@/app/_components/Icon';
import { SimulationPanel } from './SimulationPanel';
import { TrendPanel } from './TrendPanel';
import { categoryColor } from '@/lib/colors';
import { readMonthYear, writeMonthYear } from '@/lib/monthStore';
import { withCommas, toNumber } from '@/lib/format';
import { useToast, useConfirm } from '@/app/_components/ui';

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
  const [view, setView] = useState<'report' | 'compare' | 'trend' | 'simulation'>('report');
  const [catMetric, setCatMetric] = useState<'amount' | 'pct' | 'count'>('amount'); // カテゴリ別の表示指標
  const [year, setYear] = useState(() => readMonthYear().year);
  const [month, setMonth] = useState(() => readMonthYear().month);
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [monthEntries, setMonthEntries] = useState<EntryResponse[]>([]); // 選択月の全取引
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 「分析する」（コードベースの平均・中央値比較。設定でオン/オフ）
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisEnabled, setAnalysisEnabled] = useState(true);
  // 「世帯平均との比較」（設定の年代・世帯区分。収入は記録から直近3ヶ月平均）
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [benchAxis, setBenchAxis] = useState<'age' | 'income'>('income');

  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [pools, setPools] = useState<FundPoolResponse[]>([]);

  // フィルタ
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // 取引モーダル
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryResponse | null>(null);
  const [modalType, setModalType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [modalDate, setModalDate] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalCategoryId, setModalCategoryId] = useState('');
  const [modalStoreId, setModalStoreId] = useState('');
  const [modalMemo, setModalMemo] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [modalFundPoolId, setModalFundPoolId] = useState('');
  const [modalExcludeFromSim, setModalExcludeFromSim] = useState(false);
  const [modalSubmitError, setModalSubmitError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setAnalysisEnabled(localStorage.getItem(ANALYSIS_ENABLED_KEY) !== 'false');
    } catch { /* 既定=有効 */ }
  }, []);

  // 世帯平均との比較を読み込む（選択月・設定に追従）。全部出す方針で自動取得。
  useEffect(() => {
    if (!analysisEnabled) return;
    let ageGroup = '';
    let household = 'SINGLE';
    try {
      ageGroup = localStorage.getItem('kakeibo.ageGroup') ?? '';
      household = localStorage.getItem('kakeibo.household') === 'FAMILY' ? 'FAMILY' : 'SINGLE';
    } catch { /* 既定 */ }
    let alive = true;
    analyticsApi
      .benchmark(year, month, ageGroup, household)
      .then((b) => { if (alive) setBenchmark(b); })
      .catch(() => { if (alive) setBenchmark(null); });
    return () => { alive = false; };
  }, [year, month, analysisEnabled]);

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      setAnalysis(await analyticsApi.analyze(year, month));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '分析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    setAnalysis(null); // 月を切り替えたら前月の分析結果はクリア
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

  const fetchHelperData = useCallback(async () => {
    try {
      const [catData, storeData, poolData] = await Promise.all([
        categoryApi.getAll() as Promise<CategoryResponse[]>,
        storeApi.getAll() as Promise<StoreResponse[]>,
        poolApi.getAll() as Promise<FundPoolResponse[]>,
      ]);
      setCategories(catData);
      setStores(storeData);
      setPools(poolData);
    } catch (err) {
      console.error('カテゴリ/店舗/口座の取得に失敗しました', err);
    }
  }, []);

  useEffect(() => {
    fetchHelperData();
  }, [fetchHelperData]);

  // モーダル
  function openEditModal(entry: EntryResponse) {
    setEditingEntry(entry);
    setModalType(entry.type);
    setModalDate(entry.entryDate);
    setModalAmount(withCommas(entry.amount));
    setModalCategoryId(String(entry.categoryId));
    setModalStoreId(entry.storeId ? String(entry.storeId) : '');
    setModalMemo(entry.memo || '');
    setModalNote(entry.note || '');
    setModalFundPoolId(entry.fundPoolId != null ? String(entry.fundPoolId) : (pools.find((p) => p.primary)?.id?.toString() ?? ''));
    setModalExcludeFromSim(entry.excludeFromSimulation ?? false);
    setFormErrors({});
    setModalSubmitError('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingEntry(null);
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!modalDate) errors.date = '日付を入力してください';
    if (!modalAmount || toNumber(modalAmount) <= 0) errors.amount = '1円以上の金額を入力してください';
    if (!modalCategoryId) errors.categoryId = 'カテゴリを選択してください';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalSubmitError('');
    if (!validateForm()) return;
    setModalLoading(true);
    try {
      const payload = {
        entryDate: modalDate,
        amount: toNumber(modalAmount),
        categoryId: parseInt(modalCategoryId, 10),
        storeId: modalStoreId ? parseInt(modalStoreId, 10) : null,
        type: modalType,
        memo: modalMemo.trim() || null,
        note: modalNote.trim() || null,
        fundPoolId: modalFundPoolId ? parseInt(modalFundPoolId, 10) : null,
        excludeFromSimulation: modalExcludeFromSim,
      };
      if (editingEntry) {
        await entryApi.update(editingEntry.id, payload);
      }
      await fetchData();
      closeModal();
    } catch (err) {
      setModalSubmitError(err instanceof ApiError ? err.message : '保存に失敗しました。');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDeleteEntry() {
    if (!editingEntry) return;
    if (!(await confirm({ title: '取引を削除', message: 'この取引レコードを削除してよろしいですか？', confirmText: '削除する', danger: true }))) return;
    setModalLoading(true);
    try {
      await entryApi.delete(editingEntry.id);
      await fetchData();
      closeModal();
    } catch (err) {
      setModalSubmitError(err instanceof ApiError ? err.message : '削除に失敗しました。');
    } finally {
      setModalLoading(false);
    }
  }

  function prevMonth() {
    let ny = year, nm = month;
    if (month === 1) { ny = year - 1; nm = 12; }
    else nm = month - 1;
    setYear(ny); setMonth(nm);
    writeMonthYear(ny, nm);
  }
  function nextMonth() {
    let ny = year, nm = month;
    if (month === 12) { ny = year + 1; nm = 1; }
    else nm = month + 1;
    setYear(ny); setMonth(nm);
    writeMonthYear(ny, nm);
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

  // 分析: 過去平均と差がある費目だけ（住居費など ±10%以内=flat は除外）、差額の大きい順。
  // 「その他」は catch-all で必ず上位に来てノイズになるため一覧から除外する。
  const changedCats = analysis
    ? [...analysis.categories]
        .filter((c) => c.name !== 'その他')
        .filter((c) => c.direction === 'up' || c.direction === 'down' || c.direction === 'new')
        .sort((a, b) => Math.abs(b.amount - b.avgAmount) - Math.abs(a.amount - a.avgAmount))
        .slice(0, 10)
    : [];

  // カテゴリ名→色のマップ（一貫した色付けのため）
  const catColorMap = new Map<string, string>();
  categories.forEach((cat, i) => { catColorMap.set(cat.name, categoryColor(i)); });

  // フィルタ適用後 + ソート
  const filteredEntries = monthEntries
    .filter((e) => {
      if (filterType !== 'ALL' && e.type !== filterType) return false;
      if (filterCategoryId && String(e.categoryId) !== filterCategoryId) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const haystack = [e.categoryName, e.storeName ?? '', e.memo ?? '', e.note ?? ''].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate));

  // カテゴリオプション（グループ付き）
  function categoryOptionsForType(type: 'ALL' | 'INCOME' | 'EXPENSE') {
    const filtered = type === 'ALL' ? categories : categories.filter((c) => c.type === type);
    const hasGroups = filtered.some((c) => c.groupName);
    if (!hasGroups) {
      return filtered.map((cat, i) => (
        <option key={`fopt-${cat.categoryId}-${i}`} value={cat.categoryId}>{cat.name}</option>
      ));
    }
    const UNGROUPED = '未分類';
    const order: string[] = [];
    const map = new Map<string, CategoryResponse[]>();
    for (const c of filtered) {
      const g = c.groupName || UNGROUPED;
      if (!map.has(g)) { map.set(g, []); if (g !== UNGROUPED) order.push(g); }
      map.get(g)!.push(c);
    }
    if (map.has(UNGROUPED)) order.push(UNGROUPED);
    return order.map((g) => (
      <optgroup key={g} label={g}>
        {map.get(g)!.map((cat, i) => (
          <option key={`fopt-${cat.categoryId}-${i}`} value={cat.categoryId}>{cat.name}</option>
        ))}
      </optgroup>
    ));
  }

  return (
    <div className="screen">
      {/* ヘッダーとタブはタブ切替で不変（月セレクタは下のレポート内に配置し、切替でガタつかせない） */}
      <div className="page-head">
        <h1 className="page-title">分析</h1>
      </div>

      <div className="segment" style={{ maxWidth: 640, marginBottom: 24 }}>
        <button className={`segment-btn ${view === 'report' ? 'active' : ''}`} onClick={() => setView('report')}>
          月次
        </button>
        {analysisEnabled && (
          <button className={`segment-btn ${view === 'compare' ? 'active' : ''}`} onClick={() => setView('compare')}>
            比較
          </button>
        )}
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
          {/* 収支ヒーロー（月次タブ） */}
          {view === 'report' && (
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
          )}

          {/* 分析する（自分の過去比。比較タブ・LLM不使用・設定でオン/オフ） */}
          {view === 'compare' && analysisEnabled && (
            <div className="card pad-lg" style={{ marginBottom: 16 }}>
              <div className="card-head">
                <div className="section-label">分析（自分の過去比）</div>
                <button className="btn btn--outline" onClick={runAnalyze} disabled={analyzing}>
                  {analyzing ? <><span className="loading-spinner" />分析中…</> : <><Icon name="insights" size={16} />分析する</>}
                </button>
              </div>
              {analysis ? (
                analysis.monthsAnalyzed === 0 ? (
                  <p className="goal-summary__note" style={{ marginTop: 10 }}>{analysis.highlights[0]}</p>
                ) : (
                  <>
                    <div className="analysis-stat-row">
                      <div className="sim-stat"><div className="sim-stat-label">今月の支出</div><div className="sim-stat-value">{formatCurrency(analysis.totalExpense)}</div></div>
                      <div className="sim-stat"><div className="sim-stat-label">あなたの平均</div><div className="sim-stat-value">{formatCurrency(analysis.avgMonthlyExpense)}</div></div>
                      <div className="sim-stat"><div className="sim-stat-label">中央値</div><div className="sim-stat-value">{formatCurrency(analysis.medianMonthlyExpense)}</div></div>
                    </div>
                    {analysis.totalVsAvgPct != null && (
                      <div
                        className={`analysis-total-note ${
                          analysis.totalVsAvgPct > 5 ? 'up' : analysis.totalVsAvgPct < -5 ? 'down' : ''
                        }`}
                      >
                        今月は平均より {analysis.totalVsAvgPct >= 0 ? '+' : ''}
                        {Math.round(analysis.totalVsAvgPct)}%
                        {analysis.totalVsAvgPct > 5 ? '（高め）' : analysis.totalVsAvgPct < -5 ? '（抑えめ）' : '（ほぼ平均）'}
                      </div>
                    )}
                    {changedCats.length > 0 ? (
                      <div className="analysis-cat-list">
                        <div className="analysis-cat-caption">過去平均との差（変化があった費目のみ）</div>
                        {changedCats.map((c) => {
                          const diff = c.amount - c.avgAmount;
                          return (
                            <div key={c.name} className="analysis-cat-row">
                              <span className="analysis-cat-name">{c.name}</span>
                              <span className={`analysis-cat-diff ${c.direction}`}>
                                <span className="analysis-cat-diff-yen tnum">
                                  {diff >= 0 ? '+' : '-'}{formatCurrency(Math.abs(diff))}
                                </span>
                                <span className="analysis-cat-diff-pct">
                                  {c.direction === 'new'
                                    ? '新規'
                                    : c.diffPct != null
                                      ? `${c.diffPct >= 0 ? '+' : ''}${Math.round(c.diffPct)}%`
                                      : ''}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="goal-summary__note" style={{ marginTop: 12 }}>
                        過去平均と比べて大きく変化した費目はありません。
                      </p>
                    )}
                  </>
                )
              ) : (
                <p className="goal-summary__note" style={{ marginTop: 10 }}>
                  「分析する」で、この月の支出をあなたの過去の平均・中央値と比較します（LLMは使いません）。
                </p>
              )}
            </div>
          )}

          {/* 世帯平均との比較（比較タブ・同年代/同収入帯・家計調査ベースの概算・LLM不使用） */}
          {view === 'compare' && analysisEnabled && benchmark && benchmark.totalExpense > 0 && (() => {
            const hasAge = benchmark.byAge.length > 0;
            const hasIncome = benchmark.byIncome.length > 0;
            const axis: 'age' | 'income' | null =
              (benchAxis === 'age' && hasAge) || (benchAxis === 'income' && hasIncome)
                ? benchAxis
                : hasIncome ? 'income' : hasAge ? 'age' : null;
            // 「その他」は catch-all で必ず上位に来るため比較一覧から除外（%は総額基準のまま）
            const items = (axis === 'age' ? benchmark.byAge : axis === 'income' ? benchmark.byIncome : [])
              .filter((it) => it.category !== 'その他');
            const hhLabel = benchmark.household === 'FAMILY' ? '2人以上' : '単身';
            return (
              <div className="card pad-lg" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div className="section-label">世帯平均との比較</div>
                  <span className="bench-source">{benchmark.sourceNote}</span>
                </div>

                <div className="analysis-stat-row">
                  <div className="sim-stat"><div className="sim-stat-label">今月の支出</div><div className="sim-stat-value">{formatCurrency(benchmark.totalExpense)}</div></div>
                  <div className="sim-stat"><div className="sim-stat-label">直近3ヶ月平均収入</div><div className="sim-stat-value">{benchmark.avgIncome3m != null ? formatCurrency(benchmark.avgIncome3m) : '—'}</div></div>
                  <div className="sim-stat"><div className="sim-stat-label">収支率</div><div className="sim-stat-value">{benchmark.spendingRate != null ? `${Math.round(benchmark.spendingRate)}%` : '—'}</div></div>
                </div>

                {axis == null ? (
                  <p className="goal-summary__note" style={{ marginTop: 12 }}>
                    設定で「年代」を選ぶと同年代平均と、収入を記録すると同収入帯平均と比較できます。
                  </p>
                ) : (
                  <>
                    {hasAge && hasIncome && (
                      <div className="type-segment bench-seg">
                        <button type="button" className={`type-segment-btn ${axis === 'income' ? 'active' : ''}`} onClick={() => setBenchAxis('income')}>
                          同収入帯{benchmark.incomeBand ? `（${benchmark.incomeBand}）` : ''}
                        </button>
                        <button type="button" className={`type-segment-btn ${axis === 'age' ? 'active' : ''}`} onClick={() => setBenchAxis('age')}>
                          同年代{benchmark.ageGroup ? `（${benchmark.ageGroup}）` : ''}
                        </button>
                      </div>
                    )}
                    <div className="bench-caption">
                      {axis === 'age'
                        ? `同年代平均（${benchmark.ageGroup}・${hhLabel}）との構成比の差`
                        : `同収入帯平均（${benchmark.incomeBand}・${hhLabel}）との構成比の差`}
                    </div>
                    <div className="bench-list">
                      {items.map((it) => (
                        <div key={it.category} className="bench-row">
                          <span className="bench-cat">
                            {it.category}
                            <span className="bench-amt tnum">{formatCurrency(it.amount)}</span>
                          </span>
                          <span className="bench-nums tnum">
                            <span className="bench-you">{it.userPct}%</span>
                            <span className="bench-avg">平均 {it.avgPct}%</span>
                          </span>
                          <span className={`bench-diff ${it.diffPct >= 0.5 ? 'up' : it.diffPct <= -0.5 ? 'down' : ''}`}>
                            {it.diffPct > 0 ? '+' : ''}{it.diffPct}pt
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* 月次タブ本体（カテゴリ別・店舗・日別・取引） */}
          {view === 'report' && (<>
          <div className="analytics-grid">
            {/* カテゴリ別ドーナツ */}
            <div className="card pad-lg">
              <div className="cat-head">
                <div className="section-label">カテゴリ別支出</div>
                {data.byCategory.length > 0 && (
                  <div className="type-segment cat-metric-seg">
                    {([['amount', '金額'], ['pct', '割合'], ['count', '件数']] as const).map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        className={`type-segment-btn ${catMetric === m ? 'active' : ''}`}
                        onClick={() => setCatMetric(m)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                        <span className="legend-pct tnum">
                          {catMetric === 'amount'
                            ? formatCurrency(cat.amount)
                            : catMetric === 'count'
                              ? `${cat.transactionCount}件`
                              : `${cat.percentage.toFixed(1)}%`}
                        </span>
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
            <div className="card-head" style={{ marginBottom: 12 }}>
              <div className="section-label">
                この月の取引（{filteredEntries.length}件{filteredEntries.length !== monthEntries.length ? ` / 全${monthEntries.length}件` : ''}）
              </div>
            </div>
            {/* フィルタバー */}
            <div className="analytics-filter-bar">
              <div className="type-segment" style={{ flexShrink: 0 }}>
                {(['ALL', 'EXPENSE', 'INCOME'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`type-segment-btn ${filterType === t ? 'active' : ''} ${t === 'EXPENSE' ? 'expense' : t === 'INCOME' ? 'income' : ''}`}
                    onClick={() => { setFilterType(t); setFilterCategoryId(''); }}
                  >
                    {t === 'ALL' ? 'すべて' : t === 'INCOME' ? '収入' : '支出'}
                  </button>
                ))}
              </div>
              <select
                className="select"
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                style={{ minWidth: 140 }}
              >
                <option value="">全カテゴリ</option>
                {categoryOptionsForType(filterType)}
              </select>
              <div className="analytics-search-wrap">
                <Icon name="search" size={15} />
                <input
                  className="input"
                  type="text"
                  placeholder="検索..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
                {filterSearch && (
                  <button type="button" className="analytics-search-clear" onClick={() => setFilterSearch('')}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            </div>
            {filteredEntries.length > 0 ? (
              <div className="analytics-txn-list">
                {filteredEntries.map((e) => {
                  const color = catColorMap.get(e.categoryName) || 'var(--surface-3)';
                  return (
                    <div
                      key={e.id}
                      className="analytics-txn-row"
                      onClick={() => openEditModal(e)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="cat-color-chip" style={{ background: color }} />
                      <span className="analytics-txn-date">{e.entryDate.slice(5).replace('-', '/')}</span>
                      <span className="analytics-txn-body">
                        {e.categoryName}{e.storeName ? ` · ${e.storeName}` : ''}
                        {e.memo ? <span className="analytics-txn-memo"> {e.memo}</span> : null}
                      </span>
                      <span className={`analytics-txn-amount ${e.type === 'INCOME' ? 'inc' : ''}`}>
                        {e.type === 'INCOME' ? '+' : '-'}{formatCurrency(e.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-text">
                  {monthEntries.length > 0 ? '条件に一致する取引はありません' : 'この月の取引はありません'}
                </div>
              </div>
            )}
          </div>
          </>)}
        </>
      ) : null}
        </>
      )}
      {/* 取引編集モーダル */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">取引の編集</h3>
              <button className="modal-close-btn" onClick={closeModal} aria-label="閉じる">
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handleModalSubmit}>
              <div className="modal-body">
                {modalSubmitError && (
                  <div className="error-banner" style={{ margin: 0 }}>
                    <Icon name="error" />
                    {modalSubmitError}
                  </div>
                )}
                <div className="type-segment">
                  <button
                    type="button"
                    className={`type-segment-btn expense ${modalType === 'EXPENSE' ? 'active' : ''}`}
                    onClick={() => setModalType('EXPENSE')}
                  >
                    支出
                  </button>
                  <button
                    type="button"
                    className={`type-segment-btn income ${modalType === 'INCOME' ? 'active' : ''}`}
                    onClick={() => setModalType('INCOME')}
                  >
                    収入
                  </button>
                </div>
                <div className="modal-field-row">
                  <div className="modal-field">
                    <label htmlFor="amodal-date">日付</label>
                    <input id="amodal-date" type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} className={formErrors.date ? 'field-error' : ''} required />
                    {formErrors.date && <span className="field-error-text">{formErrors.date}</span>}
                  </div>
                  <div className="modal-field">
                    <label htmlFor="amodal-amount">金額 (円)</label>
                    <input id="amodal-amount" type="text" inputMode="numeric" placeholder="1,000" value={modalAmount} onChange={(e) => setModalAmount(withCommas(e.target.value))} className={formErrors.amount ? 'field-error' : ''} required />
                    {formErrors.amount && <span className="field-error-text">{formErrors.amount}</span>}
                  </div>
                </div>
                <div className="modal-field">
                  <label htmlFor="amodal-category">カテゴリ</label>
                  <select id="amodal-category" className="select" value={modalCategoryId} onChange={(e) => setModalCategoryId(e.target.value)} required>
                    <option value="">カテゴリを選択</option>
                    {(() => {
                      const cats = categories.filter((cat) => cat.type === modalType);
                      const hasGroups = cats.some((c) => c.groupName);
                      if (!hasGroups) return cats.map((cat, i) => (<option key={`mopt-${cat.categoryId}-${i}`} value={cat.categoryId}>{cat.name}</option>));
                      const UNGROUPED = '未分類';
                      const order: string[] = [];
                      const map = new Map<string, CategoryResponse[]>();
                      for (const c of cats) {
                        const g = c.groupName || UNGROUPED;
                        if (!map.has(g)) { map.set(g, []); if (g !== UNGROUPED) order.push(g); }
                        map.get(g)!.push(c);
                      }
                      if (map.has(UNGROUPED)) order.push(UNGROUPED);
                      return order.map((g) => (
                        <optgroup key={g} label={g}>
                          {map.get(g)!.map((cat, i) => (<option key={`mopt-${cat.categoryId}-${i}`} value={cat.categoryId}>{cat.name}</option>))}
                        </optgroup>
                      ));
                    })()}
                  </select>
                  {formErrors.categoryId && <span className="field-error-text">{formErrors.categoryId}</span>}
                </div>
                {modalType === 'EXPENSE' && (
                  <div className="modal-field">
                    <label htmlFor="amodal-store">店舗 (任意)</label>
                    <select id="amodal-store" className="select" value={modalStoreId} onChange={(e) => setModalStoreId(e.target.value)}>
                      <option value="">なし</option>
                      {stores.map((store, index) => (
                        <option key={`amodal-store-${store.storeId}-${index}`} value={store.storeId}>
                          {store.name} {store.type ? `(${store.type})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="modal-field">
                  <label htmlFor="amodal-memo">品名 (任意)</label>
                  <textarea id="amodal-memo" rows={2} placeholder="購入した物・明細" value={modalMemo} onChange={(e) => setModalMemo(e.target.value)} />
                </div>
                <div className="modal-field">
                  <label htmlFor="amodal-note">メモ (任意)</label>
                  <textarea id="amodal-note" rows={2} placeholder="補足・メモなど" value={modalNote} onChange={(e) => setModalNote(e.target.value)} />
                </div>
                {pools.length > 0 && (
                  <div className="modal-field">
                    <label htmlFor="amodal-pool">口座・カード</label>
                    <select id="amodal-pool" className="select" value={modalFundPoolId} onChange={(e) => setModalFundPoolId(e.target.value)}>
                      {pools.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.kind === 'CARD' ? '💳 ' : ''}{p.name}{p.primary ? '（既定）' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="modal-field">
                  <label className="modal-check">
                    <input type="checkbox" checked={modalExcludeFromSim} onChange={(e) => setModalExcludeFromSim(e.target.checked)} />
                    <span>
                      シミュレーションに反映しない
                      <small>手持ちを実額に合わせるための調整などに。</small>
                    </span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <div className="modal-btn-group has-delete">
                  <button type="button" className="modal-btn danger" onClick={handleDeleteEntry} disabled={modalLoading} title="削除する">
                    <Icon name="delete" />
                  </button>
                  <button type="button" className="modal-btn secondary" onClick={closeModal} disabled={modalLoading}>
                    キャンセル
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={modalLoading}>
                    {modalLoading ? '保存中...' : '保存する'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
