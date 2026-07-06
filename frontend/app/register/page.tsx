'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { userApi, ApiError } from '@/lib/api';
import { setUser } from '@/lib/auth';


export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!username.trim()) {
      newErrors.username = 'ユーザー名を入力してください';
    } else if (username.trim().length < 2) {
      newErrors.username = 'ユーザー名は2文字以上にしてください';
    }

    if (!email.trim()) {
      newErrors.email = 'メールアドレスを入力してください';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    if (!password) {
      newErrors.password = 'パスワードを入力してください';
    } else if (password.length < 6) {
      newErrors.password = 'パスワードは6文字以上にしてください';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'パスワード（確認）を入力してください';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'パスワードが一致しません';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError('');

    if (!validate()) return;

    setLoading(true);
    try {
      await userApi.register(username.trim(), email, password);
      // 登録成功したらそのまま自動ログイン
      const loggedInUser = await userApi.login(email, password);
      setUser(loggedInUser);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.validationErrors) {
          setErrors(err.validationErrors);
        } else {
          setApiError(err.message);
        }
      } else {
        setApiError(`通信エラー: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* ロゴ */}
        <div className="auth-logo">
          <div className="auth-logo-icon">💰</div>
          <span className="auth-logo-text">家計簿</span>
        </div>

        <p className="auth-subtitle">
          無料アカウントを作成して、<br />家計管理を始めましょう。
        </p>

        {/* APIエラー */}
        {apiError && (
          <div className="auth-error-banner">
            ⚠️ {apiError}
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="register-username">ユーザー名</label>
            <input
              id="register-username"
              type="text"
              placeholder="太郎"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={errors.username ? 'field-error' : ''}
              autoComplete="name"
              autoFocus
            />
            {errors.username && <div className="field-error-text">{errors.username}</div>}
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">メールアドレス</label>
            <input
              id="register-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? 'field-error' : ''}
              autoComplete="email"
            />
            {errors.email && <div className="field-error-text">{errors.email}</div>}
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">パスワード</label>
            <input
              id="register-password"
              type="password"
              placeholder="6文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? 'field-error' : ''}
              autoComplete="new-password"
            />
            {errors.password && <div className="field-error-text">{errors.password}</div>}
          </div>

          <div className="auth-field">
            <label htmlFor="register-confirm-password">パスワード（確認）</label>
            <input
              id="register-confirm-password"
              type="password"
              placeholder="もう一度入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={errors.confirmPassword ? 'field-error' : ''}
              autoComplete="new-password"
            />
            {errors.confirmPassword && <div className="field-error-text">{errors.confirmPassword}</div>}
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span className="loading-spinner" /> 登録中...
              </span>
            ) : (
              'アカウントを作成'
            )}
          </button>
        </form>

        {/* フッター */}
        <div className="auth-footer">
          <span>すでにアカウントをお持ちの方は </span>
          <Link href="/login">ログイン</Link>
        </div>
      </div>
    </div>
  );
}
