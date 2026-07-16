'use client';

import { useState } from 'react';
import { importApi, ApiError } from '@/lib/api';
import { ImportResult, ImportPreview } from '@/types';
import { Icon } from '@/app/_components/Icon';

const CSV_PLACEHOLDER = `日付,金額,カテゴリ,店舗,タイプ,メモ,口座,除外
2026-05-01,1500,食費,ライフ,EXPENSE,お昼ご飯,,
2026-04-25,250000,給与,,INCOME,4月給料,,
2026-05-02,320,日用品,セブンイレブン,EXPENSE,"洗剤, 詰め替え",,`;

const MD_PLACEHOLDER = `---
date: 2026-05-01
store: オオゼキ
type: grocery
total: 719
---
- 牛乳 220
- 豚こま 376
- トマト 123`;

function yen(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);
}

export default function ImportPage() {
  const [format, setFormat] = useState<'csv' | 'markdown'>('csv');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setFormat(text.trimStart().startsWith('---') ? 'markdown' : 'csv');
    setPreview(null);
    setResult(null);
  }

  async function handlePreview() {
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setPreview(null);
    try {
      setPreview(await importApi.preview(format, content));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'プレビューに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    setError('');
    try {
      const res = await importApi.import(format, content);
      setResult(res);
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'インポートに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setContent('');
    setPreview(null);
    setResult(null);
    setError('');
  }

  const importable = preview ? preview.okCount + preview.warningCount : 0;

  return (
    <div className="import-card screen">
      <h1 className="page-title" style={{ marginBottom: 20 }}>データ取込</h1>

      <div className="card pad-lg">
        {error && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <Icon name="error" /> {error}
          </div>
        )}

        {/* 入力（結果表示中は隠す） */}
        {!result && (
          <>
            <div className="segment" style={{ marginBottom: 18 }}>
              <button
                className={`segment-btn ${format === 'csv' ? 'active' : ''}`}
                onClick={() => { setFormat('csv'); setPreview(null); }}
              >
                CSV
              </button>
              <button
                className={`segment-btn ${format === 'markdown' ? 'active' : ''}`}
                onClick={() => { setFormat('markdown'); setPreview(null); }}
              >
                Markdown
              </button>
            </div>

            <label className="dropzone">
              <Icon name="upload_file" />
              <span>ファイルを選択、またはドラッグ&ドロップ</span>
              <input type="file" accept=".csv,.md,.txt" onChange={handleFileSelect} />
            </label>

            <textarea
              className="import-textarea"
              placeholder={format === 'csv' ? CSV_PLACEHOLDER : MD_PLACEHOLDER}
              value={content}
              onChange={(e) => { setContent(e.target.value); setPreview(null); }}
            />

            <div className="import-actions">
              <button className="btn-outline import-clear" onClick={resetAll}>クリア</button>
              <button className="btn-primary import-run" onClick={handlePreview} disabled={!content.trim() || loading}>
                {loading && !preview ? '解析中...' : 'プレビュー'}
              </button>
            </div>
          </>
        )}

        {/* プレビュー（保存前） */}
        {preview && !result && (
          <div style={{ marginTop: 20 }}>
            {preview.headerError ? (
              <div className="error-banner"><Icon name="error" /> {preview.headerError}</div>
            ) : (
              <>
                <div className="ip-summary">
                  <span className="ip-chip">全 {preview.totalRows} 行</span>
                  <span className="ip-chip ok">取込 {preview.okCount}</span>
                  {preview.warningCount > 0 && <span className="ip-chip warn">警告 {preview.warningCount}</span>}
                  {preview.errorCount > 0 && <span className="ip-chip err">エラー {preview.errorCount}</span>}
                </div>

                <div className="ip-table-wrap">
                  <table className="ip-table">
                    <thead>
                      <tr>
                        <th>行</th>
                        <th>状態</th>
                        <th>日付</th>
                        <th>金額</th>
                        <th>区分</th>
                        <th>カテゴリ</th>
                        <th>店舗</th>
                        <th>口座</th>
                        <th>メモ</th>
                        <th>除外</th>
                        <th>メッセージ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.line} className={r.status === 'ERROR' ? 'ip-row-err' : r.status === 'WARNING' ? 'ip-row-warn' : ''}>
                          <td>{r.line}</td>
                          <td>
                            <span className={`ip-badge ${r.status === 'OK' ? 'ok' : r.status === 'WARNING' ? 'warn' : 'err'}`}>
                              {r.status === 'OK' ? 'OK' : r.status === 'WARNING' ? '警告' : 'エラー'}
                            </span>
                          </td>
                          <td>{r.date || '—'}</td>
                          <td className="num">{yen(r.amount)}</td>
                          <td>{r.type === 'INCOME' ? '収入' : r.type === 'EXPENSE' ? '支出' : '—'}</td>
                          <td>
                            {r.category || '—'}
                            {r.newCategory && <span className="ip-tag">新規</span>}
                          </td>
                          <td>
                            {r.store || '—'}
                            {r.newStore && <span className="ip-tag">新規</span>}
                          </td>
                          <td>{r.pool || '—'}</td>
                          <td>{r.memo || '—'}</td>
                          <td>{r.excludeFromSimulation ? '除外' : '—'}</td>
                          <td className="ip-msg">{r.message || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="goal-summary__note" style={{ marginTop: 12 }}>
                  エラー行はスキップされます。警告行（口座未検出など）は主口座で取り込みます。
                </p>

                <div className="import-actions" style={{ marginTop: 14 }}>
                  <button className="btn-outline import-clear" onClick={() => setPreview(null)}>入力に戻る</button>
                  <button className="btn-primary import-run" onClick={handleImport} disabled={loading || importable === 0}>
                    {loading ? '取り込み中...' : `この内容で取り込む（${importable}件）`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 取り込み結果 */}
        {result && (
          <div className="import-result">
            <div className="import-result-header">
              <div className="import-result-stat">
                成功<strong className="success">{result.successCount.toLocaleString()} 件</strong>
              </div>
              <div className="import-result-stat">
                エラー<strong className={result.errorCount > 0 ? 'error' : 'success'}>{result.errorCount.toLocaleString()} 件</strong>
              </div>
              <div className="import-result-stat">
                処理行数<strong>{result.totalRows.toLocaleString()}</strong>
              </div>
            </div>
            {result.errors.length > 0 && (
              <ul className="import-result-errors">
                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )}
            <div className="import-actions" style={{ marginTop: 16 }}>
              <button className="btn-primary import-run" onClick={resetAll}>続けて取り込む</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
