'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { userApi, ApiError } from '@/lib/api';
import { setUser } from '@/lib/auth';
import { UserResponse } from '@/types';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'メールアドレスを入力してください';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    if (!password) {
      newErrors.password = 'パスワードを入力してください';
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
      const user = await userApi.login(email, password) as UserResponse;
      setUser(user);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('通信エラーが発生しました。もう一度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      {/* ロゴ */}
      <div className="auth-logo">
        <div className="auth-logo-icon">💰</div>
        <span className="auth-logo-text">家計簿</span>
      </div>

      <p className="auth-subtitle">
        あなたの家計を、もっとスマートに。
      </p>

      {/* 登録成功メッセージ */}
      {registered && (
        <div className="auth-success-banner">
          ✅ アカウント登録が完了しました。ログインしてください。
        </div>
      )}

      {/* APIエラー */}
      {apiError && (
        <div className="auth-error-banner">
          ⚠️ {apiError}
        </div>
      )}

      {/* フォーム */}  
      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="login-email">メールアドレス</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={errors.email ? 'field-error' : ''}
            autoComplete="email"
            autoFocus
          />
          {errors.email && <div className="field-error-text">{errors.email}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="login-password">パスワード</label>
          <input
            id="login-password"
            type="password"
            placeholder="パスワードを入力"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={errors.password ? 'field-error' : ''}
            autoComplete="current-password"
          />
          {errors.password && <div className="field-error-text">{errors.password}</div>}
        </div>

        <button
          type="submit"
          className="auth-submit"
          disabled={loading}
          id="login-submit-btn"
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span className="loading-spinner" /> ログイン中...
            </span>
          ) : (
            'ログイン'
          )}
        </button>
      </form>

      {/* フッター */}
      <div className="auth-footer">
        <span>アカウントをお持ちでない方は </span>
        <Link href="/register">新規登録</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-page">
      <Suspense fallback={
        <div className="auth-card">
          <div className="loading-state">
            <span className="loading-spinner" />
          </div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
