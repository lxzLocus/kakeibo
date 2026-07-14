'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { llmConfigApi, categoryApi, ApiError } from '@/lib/api';
import { LlmConfigResponse, LlmConfigsResponse, LlmPurpose, UserResponse, CategoryResponse } from '@/types';
import { getUser, removeUser } from '@/lib/auth';
import { Icon } from '@/app/_components/Icon';

/** プロバイダのクイックプリセット */
const PROVIDER_PRESETS = [
  { key: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { key: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { key: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o' },
  { key: 'local', label: 'ローカル', baseUrl: 'http://localhost:1234/v1', model: '' },
] as const;

/** 1系統ぶんのLLM設定フォーム（チャット用 / 画像用で共通利用） */
function LlmConfigForm({
  purpose,
  title,
  subtitle,
  icon,
  config,
  onChanged,
}: {
  purpose: LlmPurpose;
  title: string;
  subtitle: string;
  icon: string;
  config: LlmConfigResponse;
  onChanged: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl ?? '');
  const [model, setModel] = useState(config.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [supportsVision, setSupportsVision] = useState(config.supportsVision);
  const [directOcr, setDirectOcr] = useState(config.directOcr);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 親のreload後にフォームを同期
  useEffect(() => {
    setBaseUrl(config.baseUrl ?? '');
    setModel(config.model ?? '');
    setSupportsVision(config.supportsVision);
    setDirectOcr(config.directOcr);
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
        directOcr,
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

  // ベースURLから選択中のプロバイダを推定
  const selectedProvider = PROVIDER_PRESETS.find((p) => p.baseUrl === baseUrl.trim())?.key ?? null;

  function applyPreset(preset: (typeof PROVIDER_PRESETS)[number]) {
    setBaseUrl(preset.baseUrl);
    // ローカルはモデル名を保持、それ以外はプリセットのモデル名を設定
    if (preset.model) {
      setModel(preset.model);
    }
  }

  return (
    <form onSubmit={handleSave} className="llm-card">
      <div className="llm-card__header">
        <div className="card-icon">
          <Icon name={icon} />
        </div>
        <div className="llm-card__heading">
          <div className="llm-card__title">{title}</div>
          <div className="llm-card__subtitle">{subtitle}</div>
        </div>
        <span className={`status-pill ${config.configured ? 'status-pill--connected' : 'status-pill--unset'}`}>
          <span className="status-pill__dot" />
          {config.configured ? '接続済み' : '未設定'}
        </span>
      </div>

      {message && (
        <div className="success-banner">
          <Icon name="check_circle" />
          {message}
        </div>
      )}
      {error && (
        <div className="error-banner">
          <Icon name="error" />
          {error}
        </div>
      )}

      <div className="provider-chips">
        {PROVIDER_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`provider-chip${selectedProvider === preset.key ? ' is-selected' : ''}`}
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="field-grid">
        <div className="field">
          <label className="field__label">ベースURL</label>
          <input
            className="field__input"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="例: https://api.deepseek.com / http://localhost:1234"
          />
        </div>

        <div className="field">
          <label className="field__label">モデル名</label>
          <input
            className="field__input"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={purpose === 'vision' ? '例: qwen2.5-vl-7b-instruct' : '例: deepseek-chat'}
          />
        </div>

        <div className="field field--full">
          <label className="field__label">
            APIキー{config.hasKey && ` (登録済み: ${config.maskedKey})`}
          </label>
          <input
            className="field__input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config.hasKey ? '変更する場合のみ入力' : 'sk-...'}
            autoComplete="off"
          />
        </div>
      </div>

      {purpose === 'chat' && (
        <div className="vision-toggle-box">
          <button
            type="button"
            className={`toggle${supportsVision ? ' is-on' : ''}`}
            onClick={() => setSupportsVision(!supportsVision)}
          >
            <span className="toggle__knob" />
          </button>
          <div className="vision-toggle__text">
            <div className="vision-toggle__title">このモデルは画像に対応</div>
            <div className="vision-toggle__hint">
              ONにするとチャットで画像を送信できます（例: gpt-4o, gemini, qwen-vl）
            </div>
          </div>
        </div>
      )}

      {purpose === 'vision' && (
        <div className="vision-toggle-box">
          <button
            type="button"
            className={`toggle${directOcr ? ' is-on' : ''}`}
            onClick={() => setDirectOcr(!directOcr)}
          >
            <span className="toggle__knob" />
          </button>
          <div className="vision-toggle__text">
            <div className="vision-toggle__title">レシート画像を直接LLMで読み取る</div>
            <div className="vision-toggle__hint">
              ON: レシート画像をそのままLLMへ送信（半角カナ等に強い・要画像対応モデル）。
              OFF: 手元でTesseract OCR→テキストLLMで補正（安価なテキストモデルでも可）。
            </div>
          </div>
        </div>
      )}

      <div className="card-actions">
        {config.configured && (
          <button type="button" className="btn btn--outline" onClick={handleDelete}>
            削除
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? '保存中...' : '保存する'}
        </button>
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
      <div className="settings-section">
        <div className="settings-section__title">AI設定</div>
        <div className="settings-section__desc">
          チャットと画像(OCR)で別々のLLMを設定できます。APIキーは暗号化して保存され、画面には先頭を伏せて表示されます。
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <Icon name="error" />
          {error}
        </div>
      )}

      {loading || !configs ? (
        <div className="loading-state">
          <span className="loading-spinner" />
          読み込み中...
        </div>
      ) : (
        <>
          <LlmConfigForm
            purpose="chat"
            title="チャット用LLM"
            subtitle="家計相談チャットに使用します（例: DeepSeek / deepseek-chat）"
            icon="forum"
            config={configs.chat}
            onChanged={load}
          />
          <LlmConfigForm
            purpose="vision"
            title="レシートOCR補正用LLM"
            subtitle="OCR結果を補正・構造化するテキストLLM（画像対応は不要）"
            icon="receipt_long"
            config={configs.vision}
            onChanged={load}
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
    <div className="account-card">
      <div className="account-card__profile">
        <div className="account-card__avatar">{user?.username?.charAt(0)}</div>
        <div>
          <div className="account-card__name">{user?.username}</div>
          <div className="account-card__since">ようこそ</div>
        </div>
      </div>
      <div className="info-row">
        <span className="info-row__label">ユーザー名</span>
        <span className="info-row__value">{user?.username}</span>
      </div>
      <div className="info-row info-row--last">
        <span className="info-row__label">メールアドレス</span>
        <span className="info-row__value">{user?.email}</span>
      </div>
      <div className="account-card__footer">
        <button className="btn btn--logout" onClick={handleLogout}>
          <Icon name="logout" />
          ログアウト
        </button>
      </div>
    </div>
  );
}

/** カテゴリ管理（一覧・改名・削除。削除時は別カテゴリへ付け替え） */
function CategorySettings() {
  const [cats, setCats] = useState<CategoryResponse[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<CategoryResponse | null>(null);
  const [reassignTo, setReassignTo] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([categoryApi.getAll(), categoryApi.usage()]);
      setCats(c as CategoryResponse[]);
      setUsage(u);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'カテゴリの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function saveRename(id: number) {
    const name = editName.trim();
    setEditingId(null);
    if (!name) return;
    try {
      await categoryApi.update(id, name);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '改名に失敗しました');
    }
  }

  function startDelete(cat: CategoryResponse) {
    setError('');
    setDeleting(cat);
    const others = cats.filter((c) => c.type === cat.type && c.categoryId !== cat.categoryId);
    setReassignTo(others[0] ? String(others[0].categoryId) : '');
  }

  async function confirmDelete() {
    if (!deleting) return;
    const count = usage[String(deleting.categoryId)] ?? 0;
    try {
      await categoryApi.delete(deleting.categoryId, count > 0 ? Number(reassignTo) : undefined);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました');
    }
  }

  if (loading) {
    return <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>;
  }

  const groups: { type: 'EXPENSE' | 'INCOME'; label: string }[] = [
    { type: 'EXPENSE', label: '支出カテゴリ' },
    { type: 'INCOME', label: '収入カテゴリ' },
  ];

  return (
    <div className="settings-section">
      <div className="settings-section__title">カテゴリ管理</div>
      <div className="settings-section__desc">
        カテゴリの改名・削除ができます。削除時に取引がある場合は、別のカテゴリへ付け替えてから削除します。
      </div>
      {error && <div className="error-banner"><Icon name="error" /> {error}</div>}

      {groups.map((g) => {
        const list = cats.filter((c) => c.type === g.type);
        return (
          <div key={g.type}>
            <div className="section-label" style={{ display: 'block', margin: '16px 0 8px' }}>{g.label}</div>
            {list.length === 0 ? (
              <p className="goal-summary__note">カテゴリがありません。</p>
            ) : (
              <div className="card flush">
                {list.map((cat) => {
                  const count = usage[String(cat.categoryId)] ?? 0;
                  return (
                    <div key={cat.categoryId} className="cat-row">
                      {editingId === cat.categoryId ? (
                        <input
                          className="input"
                          value={editName}
                          autoFocus
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(cat.categoryId);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => saveRename(cat.categoryId)}
                        />
                      ) : (
                        <span className="cat-name">
                          {cat.name}
                          <span className="cat-count">{count}件</span>
                        </span>
                      )}
                      <div className="cat-actions">
                        <button className="cat-icon-btn" onClick={() => { setEditingId(cat.categoryId); setEditName(cat.name); }} aria-label="改名" title="改名">
                          <Icon name="edit" size={16} />
                        </button>
                        <button className="cat-icon-btn danger" onClick={() => startDelete(cat)} aria-label="削除" title="削除">
                          <Icon name="delete" size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* 削除確認 */}
      {deleting && (() => {
        const count = usage[String(deleting.categoryId)] ?? 0;
        const others = cats.filter((c) => c.type === deleting.type && c.categoryId !== deleting.categoryId);
        const blocked = count > 0 && others.length === 0;
        return (
          <div className="modal-overlay" onClick={() => setDeleting(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <h3 className="modal-title">カテゴリを削除</h3>
                <button className="modal-close-btn" onClick={() => setDeleting(null)} aria-label="閉じる"><Icon name="close" /></button>
              </div>
              <div className="modal-body">
                <p>「{deleting.name}」を削除します。</p>
                {count > 0 ? (
                  others.length > 0 ? (
                    <div className="modal-field">
                      <label htmlFor="reassign-select">この {count} 件の取引の移動先カテゴリ</label>
                      <select id="reassign-select" className="select" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                        {others.map((o) => <option key={o.categoryId} value={o.categoryId}>{o.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <p className="goal-summary__note">移動先の同区分カテゴリがありません。先に別のカテゴリを作成してください。</p>
                  )
                ) : (
                  <p className="goal-summary__note">紐づく取引はありません。そのまま削除できます。</p>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn--primary btn--block" onClick={confirmDelete} disabled={blocked}>削除する</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const TABS = [
  { key: 'ai', label: 'AI設定', icon: 'smart_toy' },
  { key: 'categories', label: 'カテゴリ', icon: 'category' },
  { key: 'account', label: 'アカウント', icon: 'person' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('ai');

  return (
    <div className="settings screen">
      <h1 className="settings__title">設定</h1>

      <div className="settings-seg">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`settings-seg__btn${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="settings__layout">
        <nav className="settings-rail">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`settings-rail__tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <Icon className="settings-rail__icon" name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="settings__content">
          {tab === 'ai' && <AiSettings />}
          {tab === 'categories' && <CategorySettings />}
          {tab === 'account' && <AccountSettings />}
        </div>
      </div>
    </div>
  );
}
