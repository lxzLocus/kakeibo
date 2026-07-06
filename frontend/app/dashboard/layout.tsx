'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, removeUser } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { UserResponse } from '@/types';
import { useTheme } from '@/app/theme-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [user, setUserState] = useState<UserResponse | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowUserMenu(false);
    }
    if (showUserMenu) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showUserMenu]);

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
      {/* ハンバーガートグル（DOM上でドロワーとオーバーレイの兄弟になるよう配置） */}
      <input id="hamburger-toggle" className="hamburger-toggle" type="checkbox" />
      {/* ヘッダー */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <label htmlFor="hamburger-toggle" className="hamburger-btn" aria-hidden="true">☰</label>
          <div className="dashboard-header-logo">💰</div>
          <span className="dashboard-header-title">家計簿</span>
        </div>

        <div className="dashboard-header-right">
          <button
            className="theme-toggle-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
            title={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="dashboard-user-info">
            <button
              className="dashboard-user-avatar"
              aria-haspopup="dialog"
              aria-expanded={showUserMenu}
              onClick={() => setShowUserMenu((s) => !s)}
              title="ユーザーメニューを開く"
            >
              {user.username.charAt(0)}
            </button>
            <span>{user.username}</span>
          </div>
        </div>
      </header>

      {/* PC固定サイドバー */}
      <aside className="dashboard-nav-sidebar desktop-only" aria-label="サイドナビゲーション">
        <Link href="/dashboard" className={`dashboard-nav-sidebar-link ${pathname === '/dashboard' ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">🏠</span>ホーム
        </Link>
        <Link href="/dashboard/analytics" className={`dashboard-nav-sidebar-link ${pathname === '/dashboard/analytics' ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">📊</span>分析
        </Link>
        <Link href="/dashboard/simulation" className={`dashboard-nav-sidebar-link ${pathname === '/dashboard/simulation' ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">📈</span>シミュレーション
        </Link>
        <Link href="/dashboard/chat" className={`dashboard-nav-sidebar-link ${pathname === '/dashboard/chat' ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">💬</span>AI相談
        </Link>
        <Link href="/dashboard/settings" className={`dashboard-nav-sidebar-link ${pathname.startsWith('/dashboard/settings') ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">⚙️</span>設定
        </Link>
      </aside>

      {/* モバイルドロワー（チェックボックスで開閉） */}
      <nav className="mobile-drawer" aria-label="モバイルメニュー">
        <div className="drawer-section-title">メニュー</div>
        <Link href="/dashboard" className="drawer-link"><span className="nav-icon" aria-hidden="true">🏠</span>ホーム</Link>
        <Link href="/dashboard/analytics" className="drawer-link"><span className="nav-icon" aria-hidden="true">📊</span>分析</Link>
        <Link href="/dashboard/simulation" className="drawer-link"><span className="nav-icon" aria-hidden="true">📈</span>シミュレーション</Link>
        <Link href="/dashboard/chat" className="drawer-link"><span className="nav-icon" aria-hidden="true">💬</span>AI相談</Link>
        <Link href="/dashboard/settings" className="drawer-link"><span className="nav-icon" aria-hidden="true">⚙️</span>設定</Link>
        <hr style={{ margin: '12px 0', borderColor: 'rgba(148,163,184,0.06)' }} />
        <button className="dashboard-logout-btn" onClick={handleLogout}>ログアウト</button>
      </nav>

      {/* ドロワーを閉じるためのオーバーレイ（labelでcheckboxをオフにする） */}
      <label htmlFor="hamburger-toggle" className="mobile-drawer-overlay" aria-hidden="true"></label>

      {/* ユーザーメニュー（モーダル） */}
      {showUserMenu && (
        <div className="modal-overlay" onClick={() => setShowUserMenu(false)}>
          <div
            className="modal-container"
            role="dialog"
            aria-modal="true"
            aria-label="ユーザーメニュー"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">ユーザー</div>
              <button className="modal-close-btn" onClick={() => setShowUserMenu(false)} aria-label="閉じる">✕</button>
            </div>
            <div className="modal-body">
              <div>ユーザー: {user.username}</div>
            </div>
            <div className="modal-footer">
              <div className="modal-btn-group">
                <button className="modal-btn primary" onClick={handleLogout}>ログアウト</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="dashboard-main">
        {children}
      </main>

    </div>
  );
}
