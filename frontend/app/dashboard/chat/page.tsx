'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { chatApi, llmConfigApi, sendMessageStream, ApiError } from '@/lib/api';
import { ChatSessionResponse, ChatMessageResponse } from '@/types';

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
  const [sessions, setSessions] = useState<ChatSessionResponse[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [needsConfig, setNeedsConfig] = useState(false);
  const [showSessions, setShowSessions] = useState(false); // モバイルの履歴ドロワー
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [visionEnabled, setVisionEnabled] = useState(false); // チャットモデルが画像対応か
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    if (!confirm('このメッセージを削除しますか？')) return;
    try {
      await chatApi.deleteMessage(activeId, m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function selectSession(id: number) {
    setActiveId(id);
    setError('');
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'チャットの作成に失敗しました');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('このチャットを削除しますか？')) return;
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if ((!input.trim() && !pendingImage) || sending) return;
    setError('');
    setNeedsConfig(false);

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

    const text = input.trim();
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

    try {
      const compressed = image ? await downscaleImage(image) : null;
      await sendMessageStream(sessionId as number, text, compressed, {
        onUser: (m) => {
          userConfirmed = true;
          setMessages((prev) => prev.map((x) => (x.id === tempUserId ? m : x)));
        },
        onChunk: (piece) => {
          assistantText += piece;
          setMessages((prev) => {
            if (!aiAdded) {
              aiAdded = true;
              return [...prev, {
                id: tempAiId,
                sessionId: sessionId as number,
                role: 'assistant',
                content: assistantText,
                imageUrl: null,
                createdAt: new Date().toISOString(),
              }];
            }
            return prev.map((x) => (x.id === tempAiId ? { ...x, content: assistantText } : x));
          });
        },
        onDone: (m) => {
          setMessages((prev) => prev.map((x) => (x.id === tempAiId ? m : x)));
          loadSessions();
        },
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

  return (
    <div className="chat-layout">
      {/* モバイル用トップバー（履歴を開く / 新規作成） */}
      <div className="chat-topbar">
        <button className="chat-topbar-btn" onClick={() => setShowSessions(true)} aria-label="相談履歴を開く">☰ 履歴</button>
        <span className="chat-topbar-title">{activeSession?.title ?? 'AI相談'}</span>
        <button className="chat-topbar-btn" onClick={handleNewChat} aria-label="新しい相談">＋</button>
      </div>

      {/* セッション一覧（PC=固定サイドバー / モバイル=スライドインのドロワー） */}
      <aside className={`chat-sidebar ${showSessions ? 'open' : ''}`}>
        <button className="chat-new-btn" onClick={() => { handleNewChat(); setShowSessions(false); }}>＋ 新しい相談</button>
        <div className="chat-session-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`chat-session-item ${activeId === s.id ? 'active' : ''}`}
              onClick={() => { selectSession(s.id); setShowSessions(false); }}
            >
              <span className="chat-session-title">{s.title}</span>
              <button
                className="chat-session-delete"
                onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                aria-label="削除"
              >🗑️</button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="chat-empty-hint">まだ相談がありません</div>
          )}
        </div>
      </aside>
      {showSessions && <div className="chat-sidebar-overlay" onClick={() => setShowSessions(false)} />}

      <section className="chat-main">
        {error && (
          <div className="auth-error-banner" style={{ margin: '0.75rem' }}>
            ⚠️ {error}
            {needsConfig && (
              <> — <Link href="/dashboard/settings" style={{ textDecoration: 'underline' }}>設定画面でAPIキーを登録</Link></>
            )}
          </div>
        )}

        <div className="chat-messages">
          {messages.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-text">家計のことを何でも相談してみましょう</div>
              <div className="empty-state-hint">例: 「今月は使いすぎ？節約のコツを教えて」</div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`chat-bubble-row ${m.role}`}>
              <div className="chat-bubble-wrap">
                {editingMessageId === m.id ? (
                  <div className="chat-edit-box">
                    <textarea
                      className="chat-input"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                    />
                    <div className="chat-edit-actions">
                      <button className="chat-edit-save" onClick={() => saveEdit(m)}>保存</button>
                      <button className="chat-edit-cancel" onClick={() => { setEditingMessageId(null); setEditContent(''); }}>キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`chat-bubble ${m.role}`}>
                      {m.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.imageUrl} alt="添付画像" className="chat-image" />
                      )}
                      {m.content}
                    </div>
                    <div className="chat-msg-actions">
                      <button onClick={() => startEdit(m)} aria-label="編集" title="編集">✏️</button>
                      <button onClick={() => handleDeleteMessage(m)} aria-label="削除" title="削除">🗑️</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {sending && messages[messages.length - 1]?.role === 'user' && (
            <div className="chat-bubble-row assistant">
              <div className="chat-bubble assistant">…考え中</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {pendingImage && (
          <div className="chat-pending-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(pendingImage)} alt="送信予定の画像" />
            <button onClick={() => setPendingImage(null)} aria-label="画像を外す">✕</button>
          </div>
        )}
        <form className="chat-input-bar" onSubmit={handleSend}>
          {visionEnabled && (
            <label className="chat-image-btn" title="画像を添付">
              📎
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setPendingImage(f); }}
              />
            </label>
          )}
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
            }}
            placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
            rows={2}
          />
          <button type="submit" className="chat-send-btn" disabled={sending || (!input.trim() && !pendingImage)}>
            送信
          </button>
        </form>
      </section>
    </div>
  );
}
