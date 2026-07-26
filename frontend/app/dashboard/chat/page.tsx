'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { chatApi, llmConfigApi, sendMessageStream, ApiError } from '@/lib/api';
import { ChatSessionResponse, ChatMessageResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { Markdown } from './Markdown';
import { useConfirm } from '@/app/_components/ui';

const SUGGESTIONS = [
  '今月は使いすぎ？',
  '節約のコツを教えて',
  '食費の平均は？',
];

/** 送信前に画像を縮小してJPEG化する */
async function downscaleImage(file: File, maxDim = 1280, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function ChatPage() {
  const confirm = useConfirm();
  const [sessions, setSessions] = useState<ChatSessionResponse[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [needsConfig, setNeedsConfig] = useState(false);
  const [chatDrawer, setChatDrawer] = useState(false); // モバイルの履歴ドロワー
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [visionEnabled, setVisionEnabled] = useState(false); // チャットモデルが画像対応か
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  // 関連質問（バックエンドが最初の数ターンのみ生成。画面下部に表示）
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const bottomRefMobile = useRef<HTMLDivElement>(null);

  // 添付画像プレビュー用の Object URL を一度だけ生成し、差し替え/破棄時に解放
  useEffect(() => {
    if (!pendingImage) {
      setPendingUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

  // チャット用LLMが画像対応かを取得（対応時のみ画像ボタンを表示）
  useEffect(() => {
    llmConfigApi.get()
      .then((c) => setVisionEnabled(c.chat?.supportsVision ?? false))
      .catch(() => setVisionEnabled(false));
  }, []);

  const activeSession = sessions.find((s) => s.id === activeId);

  function startEdit(m: ChatMessageResponse) {
    setEditingMessageId(m.id);
    setEditContent(m.content);
  }

  async function saveEdit(m: ChatMessageResponse) {
    if (activeId === null || !editContent.trim()) return;
    try {
      const updated = await chatApi.editMessage(activeId, m.id, editContent.trim());
      setMessages((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      setEditingMessageId(null);
      setEditContent('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'メッセージの編集に失敗しました');
    }
  }

  async function handleDeleteMessage(m: ChatMessageResponse) {
    if (activeId === null) return;
    // このメッセージ以降（AI返信や以降の履歴を含む）をまとめて削除する
    if (!(await confirm({ title: '履歴を削除', message: 'このメッセージ以降の履歴を削除しますか？', confirmText: '削除する', danger: true }))) return;
    try {
      await chatApi.deleteMessage(activeId, m.id);
      const idx = messages.findIndex((x) => x.id === m.id);
      setMessages((prev) => (idx >= 0 ? prev.slice(0, idx) : prev.filter((x) => x.id !== m.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'メッセージの削除に失敗しました');
    }
  }

  async function loadSessions() {
    try {
      const data = await chatApi.listSessions();
      setSessions(data);
      if (data.length > 0 && activeId === null) {
        selectSession(data[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'チャット一覧の取得に失敗しました');
    }
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // PC/モバイル両方のアンカーへ（非表示側は no-op）
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    bottomRefMobile.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function selectSession(id: number) {
    setActiveId(id);
    setError('');
    setRelatedQuestions([]);
    try {
      const msgs = await chatApi.listMessages(id);
      setMessages(msgs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'メッセージの取得に失敗しました');
    }
  }

  async function handleNewChat() {
    try {
      const session = await chatApi.createSession();
      setSessions((prev) => [session, ...prev]);
      setActiveId(session.id);
      setMessages([]);
      setRelatedQuestions([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'チャットの作成に失敗しました');
    }
  }

  async function handleDelete(id: number) {
    if (!(await confirm({ title: 'チャットを削除', message: 'このチャットを削除しますか？', confirmText: '削除する', danger: true }))) return;
    try {
      await chatApi.deleteSession(id);
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
        if (remaining.length > 0) selectSession(remaining[0].id);
      }
    } catch {
      setError('削除に失敗しました');
    }
  }

  async function handleSend(e?: React.SyntheticEvent, presetText?: string) {
    e?.preventDefault();
    const source = presetText !== undefined ? presetText : input;
    if ((!source.trim() && !pendingImage) || sending) return;
    setError('');
    setNeedsConfig(false);
    setRelatedQuestions([]);

    let sessionId = activeId;
    if (sessionId === null) {
      try {
        const session = await chatApi.createSession();
        setSessions((prev) => [session, ...prev]);
        sessionId = session.id;
        setActiveId(session.id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'チャットの作成に失敗しました');
        return;
      }
    }

    const text = source.trim();
    const image = pendingImage;
    setInput('');
    setPendingImage(null);

    const tempUserId = Date.now();
    const tempAiId = tempUserId + 1;
    // 楽観的にユーザーメッセージを表示
    setMessages((prev) => [...prev, {
      id: tempUserId,
      sessionId: sessionId as number,
      role: 'user',
      content: text,
      imageUrl: image ? URL.createObjectURL(image) : null,
      createdAt: new Date().toISOString(),
    }]);
    setSending(true);

    let userConfirmed = false;
    let aiAdded = false;
    let assistantText = '';
    let assistantReasoning = '';

    // 本文・思考の到着ごとに仮AIメッセージを追加/更新（reasoningは本文より先に来る）
    const upsertAi = () => {
      setMessages((prev) => {
        const patch = { content: assistantText, reasoning: assistantReasoning || undefined };
        if (!aiAdded) {
          aiAdded = true;
          return [...prev, {
            id: tempAiId,
            sessionId: sessionId as number,
            role: 'assistant' as const,
            imageUrl: null,
            createdAt: new Date().toISOString(),
            ...patch,
          }];
        }
        return prev.map((x) => (x.id === tempAiId ? { ...x, ...patch } : x));
      });
    };

    try {
      const compressed = image ? await downscaleImage(image) : null;
      await sendMessageStream(sessionId as number, text, compressed, {
        onUser: (m) => {
          userConfirmed = true;
          setMessages((prev) => prev.map((x) => (x.id === tempUserId ? m : x)));
        },
        onReasoning: (piece) => { assistantReasoning += piece; upsertAi(); },
        onChunk: (piece) => { assistantText += piece; upsertAi(); },
        onDone: (m) => {
          // チャンクが届かず仮AIメッセージが未追加でも、完成メッセージを必ず表示する。
          // 思考の過程（reasoning）はサーバに保存しないので、表示継続のためクライアント側で引き継ぐ。
          setMessages((prev) =>
            prev.some((x) => x.id === tempAiId)
              ? prev.map((x) => (x.id === tempAiId ? { ...m, reasoning: assistantReasoning || undefined } : x))
              : [...prev, m]
          );
          loadSessions();
        },
        onTitle: (t) => {
          if (t) setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: t } : s)));
        },
        onRelated: (qs) => setRelatedQuestions(qs),
        onError: (msg) => {
          setMessages((prev) => prev.filter((x) => x.id !== tempAiId && (userConfirmed || x.id !== tempUserId)));
          if (!userConfirmed) {
            setInput(text);
            setPendingImage(image);
          }
          setError(msg);
          if (msg.includes('API設定') || msg.includes('APIキー')) setNeedsConfig(true);
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '送信に失敗しました');
    } finally {
      setSending(false);
    }
  }

  const title = activeSession?.title ?? 'AI相談';

  function copyText(text: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }

  // 指定AIメッセージを再生成: 元になったユーザーメッセージ以降を消して同じ内容で送り直す（＝置き換え）
  async function regenerate(aiMsg: ChatMessageResponse) {
    if (activeId === null || sending) return;
    const idx = messages.findIndex((x) => x.id === aiMsg.id);
    if (idx < 0) return;
    let uIdx = -1;
    for (let j = idx - 1; j >= 0; j--) {
      if (messages[j].role === 'user') { uIdx = j; break; }
    }
    if (uIdx < 0) return;
    const userContent = messages[uIdx].content;
    try {
      await chatApi.deleteMessage(activeId, messages[uIdx].id); // ユーザー以降をカスケード削除
      setMessages((prev) => prev.slice(0, uIdx));
      await handleSend(undefined, userContent);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '再生成に失敗しました');
    }
  }

  const errorBanner = error ? (
    <div className="error-banner">
      <Icon name="error" />
      {error}
      {needsConfig && (
        <> — <Link href="/dashboard/settings">設定画面でAPIキーを登録</Link></>
      )}
    </div>
  ) : null;

  const pendingPreview = pendingImage && pendingUrl ? (
    <div className="chat-pending-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pendingUrl} alt="送信予定の画像" />
      <button onClick={() => setPendingImage(null)} aria-label="画像を外す"><Icon name="close" /></button>
    </div>
  ) : null;

  const inputField = (
    <div className="chat-input__field">
      {visionEnabled && (
        <label className="chat-input__attach" title="画像を添付">
          <Icon name="attach_file" />
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setPendingImage(f); }}
          />
        </label>
      )}
      <textarea
        className="chat-input__textarea"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
        }}
        placeholder=""
        rows={1}
      />
      <button
        type="button"
        className="chat-input__send"
        onClick={(e) => handleSend(e)}
        disabled={sending || (!input.trim() && !pendingImage)}
        aria-label="送信"
      >
        <Icon name="arrow_upward" />
      </button>
    </div>
  );

  // 関連質問ボックス（画面下部・入力バーの上）。バックエンドが最初の数ターンのみ生成。
  const relatedBox = relatedQuestions.length > 0 ? (
    <div className="chat-related chat-related--bottom">
      <div className="chat-related__heading">関連質問</div>
      {relatedQuestions.map((q) => (
        <button key={q} className="chat-related__question" onClick={() => handleSend(undefined, q)}>
          <span className="chat-related__question-text">{q}</span>
          <Icon className="chat-related__question-add" name="add" />
        </button>
      ))}
    </div>
  ) : null;

  function renderMessages() {
    return (
      <>
        {messages.length === 0 && !error && (
          <div className="chat-empty">家計のことを何でも相談してみましょう</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={'chat-msg ' + (m.role === 'user' ? 'chat-msg--user' : 'chat-msg--ai')}>
            <div className="chat-msg__body">
              {editingMessageId === m.id ? (
                <div className="chat-edit-box">
                  <textarea
                    className="chat-input__textarea"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={12}
                    autoFocus
                  />
                  <div className="chat-edit-actions">
                    <button className="chat-edit-save" onClick={() => saveEdit(m)}>保存</button>
                    <button className="chat-edit-cancel" onClick={() => { setEditingMessageId(null); setEditContent(''); }}>キャンセル</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={'chat-bubble ' + (m.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--ai')}>
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt="添付画像" className="chat-msg__image" />
                    )}
                    {m.role === 'assistant' && m.reasoning && (
                      <details className="chat-reasoning" open={!m.content}>
                        <summary>思考の過程</summary>
                        <div className="chat-reasoning__body">{m.reasoning}</div>
                      </details>
                    )}
                    {m.role === 'user' ? m.content : <Markdown text={m.content} />}
                  </div>
                  <div className="chat-msg__actions">
                    <button className="chat-msg__action-btn" onClick={() => startEdit(m)} aria-label="編集" title="編集"><Icon name="edit_square" size={15} /></button>
                    <button className="chat-msg__action-btn" onClick={() => handleDeleteMessage(m)} aria-label="削除" title="削除"><Icon name="delete" size={15} /></button>
                    {m.role !== 'user' && (
                      <>
                        <button className="chat-msg__action-btn" onClick={() => copyText(m.content)} aria-label="コピー" title="コピー"><Icon name="content_copy" size={15} /></button>
                        <button className="chat-msg__action-btn" onClick={() => regenerate(m)} aria-label="再生成" title="再生成"><Icon name="refresh" size={15} /></button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        {sending && messages[messages.length - 1]?.role === 'user' && (
          <div className="chat-msg chat-msg--ai">
            <div className="chat-msg__body">
              <div className="chat-bubble chat-bubble--ai">…考え中</div>
            </div>
          </div>
        )}
      </>
    );
  }

  function renderSession(s: ChatSessionResponse, onSelect: () => void) {
    return (
      <div
        key={s.id}
        className={'chat-session' + (activeId === s.id ? ' chat-session--active' : '')}
        onClick={onSelect}
      >
        <div className="chat-session__row">
          <Icon className="chat-session__icon" name="chat_bubble" />
          <span className="chat-session__title">{s.title}</span>
          <button
            className="chat-session__delete"
            onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
            aria-label="削除"
          >
            <Icon name="delete" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* PC レイアウト */}
      <div className="chat-desktop screen">
        <div className="chat-screen__header">
          <h1 className="chat-screen__title">AI相談</h1>
          <p className="chat-screen__subtitle">家計データを踏まえて、支出や貯蓄について相談できます。</p>
        </div>

        <div className="chat-layout">
          <aside className="chat-history">
            <div className="chat-history__new-wrap">
              <button className="chat-history__new-btn" onClick={handleNewChat}><Icon name="add" />新しい相談</button>
            </div>
            <div className="chat-history__label">相談履歴</div>
            <div className="chat-history__list">
              {sessions.map((s) => renderSession(s, () => selectSession(s.id)))}
            </div>
          </aside>

          <section className="chat-convo">
            <div className="chat-convo__header">
              <div>
                <div className="chat-convo__name">{title}</div>
              </div>
            </div>

            <div className="chat-convo__messages">
              {renderMessages()}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input">
              {relatedBox}
              {errorBanner}
              {pendingPreview}
              {inputField}
              {messages.length === 0 && (
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((q) => (
                    <button key={q} className="chat-suggestion" onClick={() => handleSend(undefined, q)}>{q}</button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* モバイル レイアウト */}
      <div className="chat-mobile screen">
        <div className="chat-mobile__header">
          <button className="chat-mobile__drawer-btn" onClick={() => setChatDrawer(true)} aria-label="相談履歴を開く"><Icon name="forum" /></button>
          <div className="chat-mobile__meta">
            <div className="chat-mobile__name">{title}</div>
          </div>
          <button className="chat-mobile__new-btn" onClick={handleNewChat} aria-label="新しい相談"><Icon name="edit_square" /></button>
        </div>

        <div className="chat-mobile__messages">
          {renderMessages()}
          <div ref={bottomRefMobile} />
        </div>

        <div className="chat-mobile__input">
          {relatedBox}
          {errorBanner}
          {pendingPreview}
          {inputField}
        </div>
      </div>

      {/* モバイル履歴ドロワー */}
      {chatDrawer && (
        <div className="drawer-overlay drawer-overlay--chat" onClick={() => setChatDrawer(false)}>
          <div className="chat-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="chat-drawer__header">
              <span className="chat-drawer__title">相談履歴</span>
              <button className="chat-drawer__close" onClick={() => setChatDrawer(false)} aria-label="閉じる"><Icon name="close" /></button>
            </div>
            <button className="chat-drawer__new-btn" onClick={() => { handleNewChat(); setChatDrawer(false); }}><Icon name="add" />新しい相談</button>
            <div className="chat-drawer__list">
              {sessions.map((s) => renderSession(s, () => { selectSession(s.id); setChatDrawer(false); }))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
