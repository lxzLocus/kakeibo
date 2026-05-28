'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, removeUser } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { UserResponse } from '@/types';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<UserResponse | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push('/login');
      return;
    }
    setUserState(u);
  }, [router]);

  function handleLogout() {
    removeUser();
    router.push('/login');
  }

  if (!user) {
    return (
      <div className="dashboard-layout">
        <div className="loading-state">
          <span className="loading-spinner" />
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* ヘッダー */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <div className="dashboard-header-logo">💰</div>
          <span className="dashboard-header-title">家計簿</span>
          {/* PCナビゲーション（モバイルではCSSで非表示） */}
          <nav className="dashboard-nav">
            <Link
              href="/dashboard"
              className={`dashboard-nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
            >
              ホーム
            </Link>
            <Link
              href="/dashboard/analytics"
              className={`dashboard-nav-link ${pathname === '/dashboard/analytics' ? 'active' : ''}`}
            >
              分析
            </Link>
          </nav>
        </div>

        <div className="dashboard-header-right">
          <div className="dashboard-user-info">
            <div className="dashboard-user-avatar">
              {user.username.charAt(0)}
            </div>
            <span>{user.username}</span>
          </div>
          <button
            className="dashboard-logout-btn"
            onClick={handleLogout}
            id="logout-button"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="dashboard-main">
        {children}
      </main>

      {/* モバイル ボトムナビゲーション */}
      <nav className="bottom-nav mobile-only" aria-label="メインナビゲーション">
        <Link
          href="/dashboard"
          className={`bottom-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
        >
          <span className="bottom-nav-item-icon">🏠</span>
          ホーム
        </Link>
        <Link
          href="/dashboard/analytics"
          className={`bottom-nav-item ${pathname === '/dashboard/analytics' ? 'active' : ''}`}
        >
          <span className="bottom-nav-item-icon">📊</span>
          分析
        </Link>
        {/* 中央の追加ボタンはダッシュボードページのFABで代替 */}
        <button className="bottom-nav-item" style={{ opacity: 0.3, pointerEvents: 'none' }}>
          <span className="bottom-nav-item-icon">⚙️</span>
          設定
        </button>
      </nav>
    </div>
  );
}
