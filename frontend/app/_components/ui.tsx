'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/**
 * アプリ内トースト + Promise ベースの確認ダイアログ。
 * ブラウザの alert() / confirm() を置き換える。
 *   const toast = useToast();   toast('保存しました', 'success');
 *   const confirm = useConfirm(); if (!(await confirm('削除しますか？'))) return;
 */

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; type: ToastType; message: string };

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type UiContextValue = {
  toast: (message: string, type?: ToastType) => void;
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
};

const UiContext = createContext<UiContextValue | null>(null);

let idSeq = 0;

const TOAST_MS = 3800;

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const [mounted, setMounted] = useState(false);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  useEffect(() => setMounted(true), []);

  const removeToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) {
      clearTimeout(tm);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++idSeq;
      setToasts((list) => [...list, { id, type, message }]);
      timers.current[id] = setTimeout(() => removeToast(id), TOAST_MS);
    },
    [removeToast]
  );

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    const options = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      // 既に開いている確認があれば、前の Promise を false で解決してから差し替える
      if (resolverRef.current) resolverRef.current(false);
      resolverRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setConfirmState(null);
    r?.(result);
  }, []);

  // キーボード操作（Esc=キャンセル / Enter=決定）
  useEffect(() => {
    if (!confirmState) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeConfirm(false);
      else if (e.key === 'Enter') closeConfirm(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);

  // アンマウント時にタイマーを掃除
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const iconFor = (t: ToastType) => (t === 'success' ? 'check_circle' : t === 'error' ? 'error' : 'info');

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}

      {mounted &&
        createPortal(
          <div className="toast-stack" role="status" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id} className={`toast toast--${t.type}`} onClick={() => removeToast(t.id)}>
                <Icon name={iconFor(t.type)} size={18} />
                <span className="toast__msg">{t.message}</span>
              </div>
            ))}
          </div>,
          document.body
        )}

      {mounted &&
        confirmState &&
        createPortal(
          <div className="modal-overlay" onClick={() => closeConfirm(false)}>
            <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h3 className="modal-title">{confirmState.title ?? '確認'}</h3>
                <button className="modal-close-btn" onClick={() => closeConfirm(false)} aria-label="閉じる">
                  <Icon name="close" />
                </button>
              </div>
              <div className="modal-body">
                <p className="confirm-modal__msg">{confirmState.message}</p>
              </div>
              <div className="modal-footer">
                <div className="modal-btn-group">
                  <button className="modal-btn secondary" onClick={() => closeConfirm(false)}>
                    {confirmState.cancelText ?? 'キャンセル'}
                  </button>
                  <button
                    className={`modal-btn ${confirmState.danger ? 'confirm-danger' : 'primary'}`}
                    onClick={() => closeConfirm(true)}
                    autoFocus
                  >
                    {confirmState.confirmText ?? 'OK'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </UiContext.Provider>
  );
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used within a UiProvider');
  return ctx;
}

export function useToast() {
  return useUi().toast;
}

export function useConfirm() {
  return useUi().confirm;
}
