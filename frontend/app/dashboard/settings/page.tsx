'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { llmConfigApi, ApiError } from '@/lib/api';
import { LlmConfigResponse, LlmConfigsResponse, LlmPurpose, UserResponse } from '@/types';
import { getUser, removeUser } from '@/lib/auth';
import { SimulationSettings } from './SimulationSettings';

/** 1系統ぶんのLLM設定フォーム（チャット用 / 画像用で共通利用） */
function LlmConfigForm({
  purpose,
  title,
  hint,
  config,
  onChanged,
}: {
  purpose: LlmPurpose;
  title: string;
  hint: React.ReactNode;
  config: LlmConfigResponse;
  onChanged: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl ?? '');
  const [model, setModel] = useState(config.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [supportsVision, setSupportsVision] = useState(config.supportsVision);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 親のreload後にフォームを同期
  useEffect(() => {
    setBaseUrl(config.baseUrl ?? '');
    setModel(config.model ?? '');
    setSupportsVision(config.supportsVision);
  }, [config]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!baseUrl.trim() || !model.trim()) {
      setError('ベースURLとモデル名は必須です');
      return;
    }
    if (!config.hasKey && !apiKey.trim()) {
      setError('APIキーを入力してください');
      return;
    }
    setSaving(true);
    try {
      await llmConfigApi.save(purpose, {
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        apiKey: apiKey.trim() || undefined,
        supportsVision,
      });
      setApiKey('');
      setMessage('保存しました');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`${title}の設定を削除しますか？`)) return;
    setMessage('');
    setError('');
    try {
      await llmConfigApi.delete(purpose);
      setApiKey('');
      setMessage('削除しました');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました');
    }
  }

  return (
    <form onSubmit={handleSave} className="settings-card" style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '-0.25rem', marginBottom: '0.85rem', lineHeight: 1.6 }}>
        {hint}
      </p>

      {message && <div className="auth-success-banner" style={{ marginBottom: '1rem' }}>✅ {message}</div>}
      {error && <div className="auth-error-banner" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

      <div className="modal-field">
        <label>ベースURL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="例: https://api.deepseek.com / http://localhost:1234"
        />
      </div>

      <div className="modal-field">
        <label>モデル名</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={purpose === 'vision' ? '例: qwen2.5-vl-7b-instruct' : '例: deepseek-chat'}
        />
      </div>

      <div className="modal-field">
        <label>
          APIキー{' '}
          {config.hasKey && <span style={{ color: 'var(--text-muted)' }}>（登録済み: {config.maskedKey}）</span>}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config.hasKey ? '変更する場合のみ入力' : 'sk-...'}
          autoComplete="off"
        />
      </div>

      {purpose === 'chat' && (
        <label className="settings-check">
          <input
            type="checkbox"
            checked={supportsVision}
            onChange={(e) => setSupportsVision(e.target.checked)}
          />
          <span>このモデルは画像に対応（ONにするとチャットで画像を送信できます。例: gpt-4o, gemini, qwen-vl）</span>
        </label>
      )}

      <div className="modal-btn-group" style={{ marginTop: '1rem' }}>
        <button type="submit" className="modal-btn primary" disabled={saving}>
          {saving ? '保存中...' : '保存する'}
        </button>
        {config.configured && (
          <button type="button" className="modal-btn secondary" onClick={handleDelete}>
            削除
          </button>
        )}
      </div>
    </form>
  );
}

/** AI設定タブ（チャット用・OCR補正用のLLM設定） */
function AiSettings() {
  const [configs, setConfigs] = useState<LlmConfigsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setConfigs(await llmConfigApi.get());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
        チャットと画像(OCR)で<b>別々のLLM</b>を設定できます。APIキーは暗号化して保存され、画面には先頭を伏せて表示されます。
      </p>

      {error && <div className="auth-error-banner" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

      {loading || !configs ? (
        <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>
      ) : (
        <>
          <LlmConfigForm
            purpose="chat"
            title="💬 チャット用LLM"
            config={configs.chat}
            onChanged={load}
            hint={
              <>
                家計相談チャットに使用します。テキスト対応モデルでOK（例: <b>DeepSeek</b>）。
                <br />
                例: ベースURL <code>https://api.deepseek.com</code> / モデル <code>deepseek-chat</code>
              </>
            }
          />
          <LlmConfigForm
            purpose="vision"
            title="📄 レシートOCR補正用LLM"
            config={configs.vision}
            onChanged={load}
            hint={
              <>
                レシート画像は<b>端末側でOCR（文字認識）</b>し、その結果を補正・構造化するテキストLLMです。
                <b>画像対応は不要</b>（例: <b>DeepSeek</b> でOK。チャットと同じ設定でも構いません）。
                <br />
                ※ ベースURLはプロバイダのパスまで含めてください（例: <code>https://api.deepseek.com</code>、OpenRouter は <code>https://openrouter.ai/api/v1</code>）。
              </>
            }
          />
        </>
      )}
    </>
  );
}

/** アカウントタブ */
function AccountSettings() {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function handleLogout() {
    removeUser();
    router.push('/login');
  }

  return (
    <div className="settings-card">
      <h3 style={{ marginTop: 0 }}>👤 アカウント</h3>
      <div className="modal-field">
        <label>ユーザー名</label>
        <div style={{ color: 'var(--text-primary)' }}>{user?.username ?? '-'}</div>
      </div>
      <div className="modal-field">
        <label>メールアドレス</label>
        <div style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{user?.email ?? '-'}</div>
      </div>
      <div className="modal-btn-group" style={{ marginTop: '1rem' }}>
        <button className="modal-btn secondary" onClick={handleLogout}>ログアウト</button>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'ai', label: '🤖 AI設定' },
  { key: 'simulation', label: '📈 シミュレーション' },
  { key: 'account', label: '👤 アカウント' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('ai');

  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '680px', margin: '0 auto' }}>
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">⚙️ 設定</h2>
      </div>

      <div className="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`settings-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ai' && <AiSettings />}
      {tab === 'simulation' && <SimulationSettings />}
      {tab === 'account' && <AccountSettings />}
    </div>
  );
}
