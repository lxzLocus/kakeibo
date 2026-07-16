'use client';

import { useState } from 'react';
import { importApi, ApiError } from '@/lib/api';
import { ImportResult } from '@/types';
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

export default function ImportPage() {
  const [format, setFormat] = useState<'csv' | 'markdown'>('csv');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setFormat(text.trimStart().startsWith('---') ? 'markdown' : 'csv');
  }

  async function handleImport() {
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await importApi.import(format, content);
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setResult({ totalRows: 0, successCount: 0, errorCount: 1, errors: [err.message], createdEntryIds: [] });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="import-card screen">
      <h1 className="page-title" style={{ marginBottom: 20 }}>データ取込</h1>

      <div className="card pad-lg">
        {/* フォーマット選択 */}
        <div className="segment" style={{ marginBottom: 18 }}>
          <button className={`segment-btn ${format === 'csv' ? 'active' : ''}`} onClick={() => setFormat('csv')}>
            CSV
          </button>
          <button className={`segment-btn ${format === 'markdown' ? 'active' : ''}`} onClick={() => setFormat('markdown')}>
            Markdown
          </button>
        </div>

        {/* ファイルドロップ */}
        <label className="dropzone">
          <Icon name="upload_file" />
          <span>ファイルを選択、またはドラッグ&ドロップ</span>
          <input type="file" accept=".csv,.md,.txt" onChange={handleFileSelect} />
        </label>

        {/* テキスト入力 */}
        <textarea
          className="import-textarea"
          placeholder={format === 'csv' ? CSV_PLACEHOLDER : MD_PLACEHOLDER}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {/* アクション */}
        <div className="import-actions">
          <button
            className="btn-outline import-clear"
            onClick={() => {
              setContent('');
              setResult(null);
            }}
          >
            クリア
          </button>
          <button className="btn-primary import-run" onClick={handleImport} disabled={!content.trim() || loading}>
            {loading ? 'インポート中...' : 'インポート実行'}
          </button>
        </div>

        {/* 結果 */}
        {result && (
          <div className="import-result">
            <div className="import-result-header">
              <div className="import-result-stat">
                成功
                <strong className="success">{result.successCount.toLocaleString()} 件</strong>
              </div>
              <div className="import-result-stat">
                エラー
                <strong className={result.errorCount > 0 ? 'error' : 'success'}>{result.errorCount.toLocaleString()} 件</strong>
              </div>
              <div className="import-result-stat">
                処理行数
                <strong>{result.totalRows.toLocaleString()}</strong>
              </div>
            </div>
            {result.errors.length > 0 && (
              <ul className="import-result-errors">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
