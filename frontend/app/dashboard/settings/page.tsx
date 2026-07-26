'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { llmConfigApi, categoryApi, entryApi, evaluationApi, chatApi, adminApi, userApi, ApiError } from '@/lib/api';
import { LlmConfigResponse, LlmConfigsResponse, LlmPurpose, UserResponse, CategoryResponse, EvaluationResponse, AdminOverview } from '@/types';
import { getUser, removeUser, setUser as persistUser } from '@/lib/auth';
import { Icon } from '@/app/_components/Icon';
import { useConfirm } from '@/app/_components/ui';
import { FixedCostSettings } from './FixedCostSettings';

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
  const confirm = useConfirm();
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
    if (!(await confirm({ title: '設定を削除', message: `${title}の設定を削除しますか？`, confirmText: '削除する', danger: true }))) return;
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

/** チャットが会話から自動学習した「ユーザーメモリ」の確認・消去（手動設定は不要） */
function ChatMemoryCard() {
  const confirm = useConfirm();
  const [memory, setMemory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await chatApi.getMemory();
      setMemory(r.content ?? '');
    } catch {
      setMemory('');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function clear() {
    if (!(await confirm({ title: '学習内容を消去', message: 'AIが会話から学習したユーザーメモリを消去します。よろしいですか？', confirmText: '消去する', danger: true }))) return;
    try {
      await chatApi.clearMemory();
      setMemory('');
      setMsg('学習内容を消去しました');
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : '消去に失敗しました');
    }
  }

  return (
    <div className="settings-section" style={{ marginTop: 20 }}>
      <div className="settings-section__title">AIが会話から学習したこと</div>
      <div className="settings-section__desc">
        チャットでの会話から、あなたの家計の方針や価値観を自動で学習し、次回以降の相談に活かします（手動設定は不要）。学習内容はここで確認・消去できます。
      </div>
      {msg && <div className="success-banner" style={{ marginBottom: 10 }}><Icon name="check_circle" /> {msg}</div>}
      {loading ? (
        <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>
      ) : memory ? (
        <>
          <div className="chat-memory-box">{memory}</div>
          <button
            className="btn btn--outline"
            onClick={clear}
            style={{ marginTop: 10, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            <Icon name="delete_forever" size={17} /> 学習内容を消去
          </button>
        </>
      ) : (
        <p className="goal-summary__note">まだ学習内容はありません。チャットで相談すると少しずつ覚えていきます。</p>
      )}
    </div>
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

      <ChatMemoryCard />
    </>
  );
}

/** 世帯平均比較に使う年代の選択肢（backend の AGE_GROUPS と一致させる） */
const AGE_GROUP_OPTIONS = ['20代', '30代', '40代', '50代', '60代', '70代以上'] as const;

/** アカウントタブ */
function AccountSettings() {
  const router = useRouter();
  const confirm = useConfirm();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [analysisOn, setAnalysisOn] = useState(true);
  const [ageGroup, setAgeGroup] = useState('');
  const [household, setHousehold] = useState<'SINGLE' | 'FAMILY'>('SINGLE');
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState('');
  const [evalCfg, setEvalCfg] = useState<EvaluationResponse | null>(null);
  const [evalBusy, setEvalBusy] = useState(false);
  // プロフィール／パスワード変更
  const [pName, setPName] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [accMsg, setAccMsg] = useState('');
  const [accErr, setAccErr] = useState('');

  useEffect(() => {
    const u = getUser();
    setUser(u);
    setPName(u?.username ?? '');
    setPEmail(u?.email ?? '');
    try {
      setAnalysisOn(localStorage.getItem('kakeibo.analysisEnabled') !== 'false');
      setAgeGroup(localStorage.getItem('kakeibo.ageGroup') ?? '');
      setHousehold(localStorage.getItem('kakeibo.household') === 'FAMILY' ? 'FAMILY' : 'SINGLE');
    } catch { /* 既定 */ }
    evaluationApi.get().then(setEvalCfg).catch(() => { /* 未対応/未起動時は無視 */ });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setAccMsg(''); setAccErr('');
    if (!pName.trim() || !pEmail.trim()) { setAccErr('ユーザー名とメールアドレスを入力してください'); return; }
    setSavingProfile(true);
    try {
      const updated = await userApi.updateProfile({ username: pName.trim(), email: pEmail.trim() });
      persistUser(updated);
      setUser(updated);
      setAccMsg('プロフィールを更新しました');
    } catch (err) {
      setAccErr(err instanceof ApiError ? err.message : '更新に失敗しました');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setAccMsg(''); setAccErr('');
    if (newPw.length < 6) { setAccErr('新しいパスワードは6文字以上にしてください'); return; }
    setSavingPw(true);
    try {
      await userApi.changePassword(curPw, newPw);
      setCurPw(''); setNewPw('');
      setAccMsg('パスワードを変更しました');
    } catch (err) {
      setAccErr(err instanceof ApiError ? err.message : 'パスワード変更に失敗しました');
    } finally {
      setSavingPw(false);
    }
  }

  function changeAgeGroup(v: string) {
    setAgeGroup(v);
    try { localStorage.setItem('kakeibo.ageGroup', v); } catch { /* ignore */ }
  }
  function changeHousehold(v: 'SINGLE' | 'FAMILY') {
    setHousehold(v);
    try { localStorage.setItem('kakeibo.household', v); } catch { /* ignore */ }
  }

  async function changeFrequency(frequency: string) {
    try {
      setEvalCfg(await evaluationApi.setFrequency(frequency));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : '頻度の更新に失敗しました');
    }
  }

  async function runEvalNow() {
    setEvalBusy(true);
    try {
      setEvalCfg(await evaluationApi.runNow());
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : '実行に失敗しました');
    } finally {
      setEvalBusy(false);
    }
  }

  function fmtDateTime(iso: string | null): string {
    if (!iso) return '未実行';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function handleLogout() {
    removeUser();
    router.push('/login');
  }

  function toggleAnalysis() {
    const next = !analysisOn;
    setAnalysisOn(next);
    try {
      localStorage.setItem('kakeibo.analysisEnabled', next ? 'true' : 'false');
    } catch { /* ignore */ }
  }

  async function handleReset() {
    if (!(await confirm({ title: 'データを全削除', message: 'すべての取引データ（収支）を削除します。元に戻せません。よろしいですか？', confirmText: 'すべて削除', danger: true }))) return;
    setMsg('');
    setResetting(true);
    try {
      await entryApi.deleteAll();
      setMsg('すべての取引データを削除しました。');
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'リセットに失敗しました');
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
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

      {/* プロフィール・パスワード変更 */}
      <div className="settings-section" style={{ marginTop: 16 }}>
        <div className="settings-section__title">プロフィール</div>
        {accMsg && <div className="success-banner" style={{ marginBottom: 10 }}><Icon name="check_circle" /> {accMsg}</div>}
        {accErr && <div className="error-banner" style={{ marginBottom: 10 }}><Icon name="error" /> {accErr}</div>}
        <form onSubmit={saveProfile} className="field-grid">
          <div className="field">
            <label className="field__label">ユーザー名</label>
            <input className="field__input" value={pName} onChange={(e) => setPName(e.target.value)} autoComplete="username" />
          </div>
          <div className="field">
            <label className="field__label">メールアドレス</label>
            <input className="field__input" type="email" value={pEmail} onChange={(e) => setPEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field field--full">
            <button type="submit" className="btn btn--primary" disabled={savingProfile}>
              {savingProfile ? '保存中...' : 'プロフィールを保存'}
            </button>
          </div>
        </form>

        <div className="settings-section__desc" style={{ marginTop: 18 }}>パスワード変更</div>
        <form onSubmit={savePassword} className="field-grid">
          <div className="field">
            <label className="field__label">現在のパスワード</label>
            <input className="field__input" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="field">
            <label className="field__label">新しいパスワード（6文字以上）</label>
            <input className="field__input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="field field--full">
            <button type="submit" className="btn btn--primary" disabled={savingPw || !curPw || !newPw}>
              {savingPw ? '変更中...' : 'パスワードを変更'}
            </button>
          </div>
        </form>
      </div>

      <div className="settings-section" style={{ marginTop: 16 }}>
        <div className="settings-section__title">アプリ設定</div>

        <div className="vision-toggle-box">
          <button type="button" className={`toggle${analysisOn ? ' is-on' : ''}`} onClick={toggleAnalysis}>
            <span className="toggle__knob" />
          </button>
          <div className="vision-toggle__text">
            <div className="vision-toggle__title">分析機能を表示</div>
            <div className="vision-toggle__hint">
              分析タブの「分析する」（平均・中央値との比較・LLM不使用）の表示を切り替えます。OFFにすると通常の家計簿として使えます。
            </div>
          </div>
        </div>

        {/* 世帯平均との比較（年代・世帯区分）。収入は記録から直近3ヶ月平均で自動判定するため入力不要 */}
        <div className="settings-section__desc" style={{ marginTop: 18 }}>
          世帯平均との比較（分析タブ）
        </div>
        <div className="field-grid">
          <div className="field">
            <label className="field__label">年代</label>
            <select
              className="field__input"
              value={ageGroup}
              onChange={(e) => changeAgeGroup(e.target.value)}
            >
              <option value="">未設定（同年代比較なし）</option>
              {AGE_GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">世帯区分</label>
            <select
              className="field__input"
              value={household}
              onChange={(e) => changeHousehold(e.target.value === 'FAMILY' ? 'FAMILY' : 'SINGLE')}
            >
              <option value="SINGLE">単身</option>
              <option value="FAMILY">2人以上世帯</option>
            </select>
          </div>
        </div>
        <div className="vision-toggle__hint" style={{ marginTop: 6 }}>
          同年代平均・同収入帯平均との比較に使います。収入は記録から直近3ヶ月平均で自動判定します（入力不要）。参照値は家計調査ベースの概算です。
        </div>

        {/* 評価バッチ（頻度で分析を定期実行・最終更新表示） */}
        <div className="eval-batch">
          <div className="settings-section__desc" style={{ marginBottom: 8 }}>
            評価バッチ（設定した頻度で分析を自動実行・LLM不使用）
          </div>
          <div className="field-grid">
            <div className="field">
              <label className="field__label">実行頻度</label>
              <select
                className="field__input"
                value={evalCfg?.frequency ?? 'OFF'}
                onChange={(e) => changeFrequency(e.target.value)}
              >
                <option value="OFF">オフ（自動実行しない）</option>
                <option value="DAILY">毎日</option>
                <option value="WEEKLY">毎週</option>
                <option value="MONTHLY">毎月</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">最終更新</label>
              <div className="eval-batch__updated">{fmtDateTime(evalCfg?.lastRunAt ?? null)}</div>
            </div>
          </div>
          {evalCfg?.summary && (
            <div className="eval-batch__summary">{evalCfg.summary}</div>
          )}
          <button className="btn btn--outline-accent" onClick={runEvalNow} disabled={evalBusy} style={{ marginTop: 10 }}>
            {evalBusy ? <><span className="loading-spinner" />実行中…</> : <><Icon name="play_arrow" size={17} />今すぐ実行</>}
          </button>
        </div>

        <div className="settings-section__desc" style={{ marginTop: 18 }}>
          データのリセット（元に戻せません）
        </div>
        {msg && <div className="success-banner" style={{ marginBottom: 10 }}><Icon name="check_circle" /> {msg}</div>}
        <button
          className="btn btn--outline"
          onClick={handleReset}
          disabled={resetting}
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
        >
          <Icon name="delete_forever" size={17} />
          {resetting ? '削除中…' : 'すべての取引データを削除'}
        </button>
      </div>
    </>
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
  const [groupEditId, setGroupEditId] = useState<number | null>(null);
  const [groupEditVal, setGroupEditVal] = useState('');
  const [deleting, setDeleting] = useState<CategoryResponse | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const [sortMode, setSortMode] = useState(false);
  // ドラッグ並び替えの状態（translateベース：ドロップ時に一度だけ配列を確定）
  type DragState = { type: 'EXPENSE' | 'INCOME'; from: number; to: number; dy: number; startY: number; rowH: number; count: number };
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

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

  async function saveGroup(id: number) {
    const v = groupEditVal.trim();
    setGroupEditId(null);
    try {
      await categoryApi.setGroup(id, v || null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'グループの設定に失敗しました');
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

  function groupsCurrent() {
    return {
      EXPENSE: cats.filter((c) => c.type === 'EXPENSE'),
      INCOME: cats.filter((c) => c.type === 'INCOME'),
    };
  }
  async function persistOrder(exp: CategoryResponse[], inc: CategoryResponse[]) {
    try {
      await categoryApi.reorder([...exp, ...inc].map((c) => c.categoryId));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '並べ替えに失敗しました');
    }
  }
  async function moveCat(type: 'EXPENSE' | 'INCOME', idx: number, dir: number) {
    const gr = groupsCurrent();
    const g = [...gr[type]];
    const j = idx + dir;
    if (j < 0 || j >= g.length) return;
    [g[idx], g[j]] = [g[j], g[idx]];
    await persistOrder(type === 'EXPENSE' ? g : gr.EXPENSE, type === 'INCOME' ? g : gr.INCOME);
  }
  async function sortByName(type: 'EXPENSE' | 'INCOME') {
    const gr = groupsCurrent();
    const g = [...gr[type]].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    await persistOrder(type === 'EXPENSE' ? g : gr.EXPENSE, type === 'INCOME' ? g : gr.INCOME);
  }

  // 配列内で要素を from → to へ移動した新配列を返す
  function arrayMove<T>(arr: T[], from: number, to: number): T[] {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  // ドラッグ開始（ハンドルの pointerdown）
  function onDragStart(e: React.PointerEvent, type: 'EXPENSE' | 'INCOME', idx: number) {
    if (e.button != null && e.button !== 0) return; // 左ボタン/タッチのみ
    const row = (e.currentTarget as HTMLElement).closest('.cat-row') as HTMLElement | null;
    const rowH = row ? row.getBoundingClientRect().height : 48;
    const count = groupsCurrent()[type].length;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    const d: DragState = { type, from: idx, to: idx, dy: 0, startY: e.clientY, rowH, count };
    dragRef.current = d;
    setDrag(d);
    e.preventDefault();
  }

  // ドラッグ中（pointermove）：指の移動量から移動先インデックスを算出
  function onDragMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    const dy = e.clientY - d.startY;
    let to = d.from + Math.round(dy / d.rowH);
    to = Math.max(0, Math.min(d.count - 1, to));
    const nd: DragState = { ...d, dy, to };
    dragRef.current = nd;
    setDrag(nd);
  }

  // ドロップ（pointerup / pointercancel）：位置が変わっていれば確定して保存
  function onDragEnd(e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (!d || d.to === d.from) return;
    const gr = groupsCurrent();
    const g = arrayMove(gr[d.type], d.from, d.to);
    persistOrder(d.type === 'EXPENSE' ? g : gr.EXPENSE, d.type === 'INCOME' ? g : gr.INCOME);
  }

  // ドラッグ中の各行の transform（掴んだ行は指に追従、間の行はギャップ分ずらす）
  function rowStyle(type: 'EXPENSE' | 'INCOME', idx: number): React.CSSProperties | undefined {
    if (!drag || drag.type !== type) return undefined;
    const { from, to, dy, rowH } = drag;
    if (idx === from) {
      return { transform: `translateY(${dy}px) scale(1.02)`, transition: 'none', zIndex: 5, position: 'relative' };
    }
    let shift = 0;
    if (to > from && idx > from && idx <= to) shift = -rowH;
    else if (to < from && idx >= to && idx < from) shift = rowH;
    return { transform: `translateY(${shift}px)`, transition: 'transform 0.16s ease', position: 'relative' };
  }

  const groups: { type: 'EXPENSE' | 'INCOME'; label: string }[] = [
    { type: 'EXPENSE', label: '支出カテゴリ' },
    { type: 'INCOME', label: '収入カテゴリ' },
  ];

  // グループ（プライマリ）名の候補（既存グループ。入力補完に使う）
  const groupSuggestions = Array.from(
    new Set(cats.map((c) => c.groupName).filter((g): g is string => !!g)),
  );

  return (
    <div className="settings-section">
      <datalist id="cat-group-suggestions">
        {groupSuggestions.map((g) => <option key={g} value={g} />)}
      </datalist>
      <div className="cat-mgmt-head">
        <div className="settings-section__title" style={{ margin: 0 }}>カテゴリ管理</div>
        {cats.length > 1 && (
          <button
            type="button"
            className={`sort-toggle-btn${sortMode ? ' active' : ''}`}
            onClick={() => { setSortMode((s) => !s); setEditingId(null); setDrag(null); dragRef.current = null; }}
          >
            <Icon name={sortMode ? 'check' : 'swap_vert'} size={16} />
            {sortMode ? '完了' : '並び替え'}
          </button>
        )}
      </div>
      <div className="settings-section__desc">
        {sortMode
          ? 'ハンドルをドラッグ、または上下ボタンで並び順を変更できます。「名前順」で自動整列も可能です。'
          : 'カテゴリの改名・削除・グループ設定ができます。グループ（プライマリ）を割り当てると、収支登録のカテゴリ選択でグループごとにまとまって表示されます。'}
      </div>
      {error && <div className="error-banner"><Icon name="error" /> {error}</div>}

      {groups.map((g) => {
        const list = cats.filter((c) => c.type === g.type);
        return (
          <div key={g.type}>
            <div className="cat-group-head">
              <div className="section-label">{g.label}</div>
              {sortMode && list.length > 1 && (
                <button type="button" className="cat-sort-btn" onClick={() => sortByName(g.type)}>
                  <Icon name="sort_by_alpha" size={15} /> 名前順に並べ替え
                </button>
              )}
            </div>
            {list.length === 0 ? (
              <p className="goal-summary__note">カテゴリがありません。</p>
            ) : (
              <div className={`card flush${drag?.type === g.type ? ' cat-list--dragging' : ''}`}>
                {list.map((cat, idx) => {
                  const count = usage[String(cat.categoryId)] ?? 0;
                  const isDragged = drag?.type === g.type && drag.from === idx;
                  return (
                    <div
                      key={cat.categoryId}
                      className={`cat-row${sortMode ? ' cat-row--sortable' : ''}${isDragged ? ' cat-row--dragging' : ''}`}
                      style={rowStyle(g.type, idx)}
                    >
                      {sortMode && (
                        <button
                          className="cat-drag-handle"
                          onPointerDown={(e) => onDragStart(e, g.type, idx)}
                          onPointerMove={onDragMove}
                          onPointerUp={onDragEnd}
                          onPointerCancel={onDragEnd}
                          aria-label="ドラッグして並び替え"
                          title="ドラッグして並び替え"
                        >
                          <Icon name="drag_indicator" size={18} />
                        </button>
                      )}
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
                      {!sortMode && editingId !== cat.categoryId && (
                        groupEditId === cat.categoryId ? (
                          <input
                            className="input cat-group-input"
                            list="cat-group-suggestions"
                            autoFocus
                            placeholder="グループ名"
                            value={groupEditVal}
                            onChange={(e) => setGroupEditVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveGroup(cat.categoryId);
                              if (e.key === 'Escape') setGroupEditId(null);
                            }}
                            onBlur={() => saveGroup(cat.categoryId)}
                          />
                        ) : (
                          <button
                            type="button"
                            className={`cat-group-chip${cat.groupName ? '' : ' is-empty'}`}
                            onClick={() => { setGroupEditId(cat.categoryId); setGroupEditVal(cat.groupName ?? ''); }}
                            title="グループ（プライマリ）を設定"
                          >
                            <Icon name="folder" size={13} />
                            {cat.groupName ?? 'グループ未設定'}
                          </button>
                        )
                      )}
                      <div className="cat-actions">
                        {sortMode ? (
                          <>
                            <button className="cat-icon-btn" onClick={() => moveCat(g.type, idx, -1)} disabled={idx === 0} aria-label="上へ" title="上へ">
                              <Icon name="keyboard_arrow_up" size={18} />
                            </button>
                            <button className="cat-icon-btn" onClick={() => moveCat(g.type, idx, 1)} disabled={idx === list.length - 1} aria-label="下へ" title="下へ">
                              <Icon name="keyboard_arrow_down" size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="cat-icon-btn" onClick={() => { setEditingId(cat.categoryId); setEditName(cat.name); }} aria-label="改名" title="改名">
                              <Icon name="edit" size={16} />
                            </button>
                            <button className="cat-icon-btn danger" onClick={() => startDelete(cat)} aria-label="削除" title="削除">
                              <Icon name="delete" size={16} />
                            </button>
                          </>
                        )}
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
        return createPortal(
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
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

/** 管理タブ: 裏で自動管理しているデータの読み取り専用ビュー */
function AdminSettings() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setData(await adminApi.overview());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function fmtDT(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const toolLabel = (b: boolean | null) => (b == null ? '未判定' : b ? '対応' : '非対応');
  const kindLabel = (k: string) => (k === 'CARD' ? 'カード' : k === 'CASH' ? '現金' : '銀行');

  if (loading) return <div className="loading-state"><span className="loading-spinner" />読み込み中...</div>;
  if (error) return <div className="error-banner"><Icon name="error" /> {error}</div>;
  if (!data) return null;

  const c = data.counts;
  const stats: [string, number][] = [
    ['取引', c.entries], ['カテゴリ', c.categories], ['店舗', c.stores], ['口座', c.pools],
    ['振替', c.transfers], ['固定費', c.fixedCosts], ['チャット', c.chatSessions],
  ];

  return (
    <>
      <div className="settings-section">
        <div className="settings-section__title">管理（自動管理データの参照）</div>
        <div className="settings-section__desc">
          アプリが裏で自動管理しているデータの読み取り専用ビューです（LLMの自動判定・学習メモリ・評価バッチ・固定費の自動記帳・カード決済振替・口座の内部設定など）。
        </div>
      </div>

      <div className="admin-grid">
        {stats.map(([label, v]) => (
          <div key={label} className="admin-stat">
            <div className="admin-stat__value tnum">{v.toLocaleString()}</div>
            <div className="admin-stat__label">{label}</div>
          </div>
        ))}
      </div>

      <div className="section-label" style={{ margin: '20px 0 8px' }}>自動処理</div>
      <div className="card pad-lg">
        {data.llm.map((l) => (
          <div key={l.purpose} className="info-row">
            <span className="info-row__label">LLM（{l.purpose === 'CHAT' ? 'チャット' : '画像/OCR'}）</span>
            <span className="info-row__value">
              {l.configured
                ? `${l.model}｜画像 ${l.supportsVision ? '対応' : '非対応'}／ツール ${toolLabel(l.supportsTools)}`
                : '未設定'}
            </span>
          </div>
        ))}
        <div className="info-row">
          <span className="info-row__label">学習メモリ</span>
          <span className="info-row__value">{data.memory.present ? `${data.memory.length}文字（更新 ${fmtDT(data.memory.updatedAt)}）` : 'なし'}</span>
        </div>
        <div className="info-row">
          <span className="info-row__label">評価バッチ</span>
          <span className="info-row__value">{data.evaluation.frequency}（最終 {fmtDT(data.evaluation.lastRunAt)}）</span>
        </div>
        {data.evaluation.summary && (
          <div className="info-row">
            <span className="info-row__label">評価の所見</span>
            <span className="info-row__value">{data.evaluation.summary}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-row__label">固定費の自動記帳</span>
          <span className="info-row__value">{data.automation.fixedCostPostedEntries.toLocaleString()} 件</span>
        </div>
        <div className="info-row info-row--last">
          <span className="info-row__label">カード決済の自動振替</span>
          <span className="info-row__value">{data.automation.cardSettlementTransfers.toLocaleString()} 件</span>
        </div>
      </div>

      <div className="section-label" style={{ margin: '20px 0 8px' }}>口座・カードの内部設定</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>名前</th><th>種別</th><th>主</th><th>締め日</th><th>引落日</th><th>引落元ID</th><th>自動</th></tr>
          </thead>
          <tbody>
            {data.pools.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{kindLabel(p.kind)}</td>
                <td>{p.primary ? '○' : ''}</td>
                <td className="tnum">{p.closingDay ?? '—'}</td>
                <td className="tnum">{p.paymentDay ?? '—'}</td>
                <td className="tnum">{p.settlementPoolId ?? '—'}</td>
                <td>{p.autoSettle ? 'ON' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn btn--outline" onClick={load} style={{ marginTop: 14 }}>
        <Icon name="refresh" size={16} /> 再読み込み
      </button>
    </>
  );
}

const TABS = [
  { key: 'ai', label: 'AI設定', icon: 'smart_toy' },
  { key: 'fixed', label: '固定費', icon: 'home' },
  { key: 'categories', label: 'カテゴリ', icon: 'category' },
  { key: 'account', label: 'アカウント', icon: 'person' },
  { key: 'admin', label: '管理', icon: 'tune' },
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
          {tab === 'fixed' && <FixedCostSettings />}
          {tab === 'categories' && <CategorySettings />}
          {tab === 'account' && <AccountSettings />}
          {tab === 'admin' && <AdminSettings />}
        </div>
      </div>
    </div>
  );
}
