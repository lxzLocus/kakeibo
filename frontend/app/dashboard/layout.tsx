'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, removeUser } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { UserResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';

type NavItem = { href: string; label: string; icon: string; exact?: boolean };

// サイドバー主ナビ（design 準拠）
const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'ホーム', icon: 'home', exact: true },
  { href: '/dashboard/analytics', label: '分析', icon: 'monitoring' },
  { href: '/dashboard/inventory', label: '在庫', icon: 'inventory_2' },
  { href: '/dashboard/meals', label: '食事', icon: 'restaurant' },
  { href: '/dashboard/import', label: 'データ取込', icon: 'upload_file' },
];

// 既存機能（design 対象外だが機能維持）
const SECONDARY_NAV: NavItem[] = [
  { href: '/dashboard/simulation', label: 'シミュレーション', icon: 'show_chart' },
  { href: '/dashboard/chat', label: 'AI相談', icon: 'forum' },
  { href: '/dashboard/settings', label: '設定', icon: 'settings' },
];

// モバイルボトムナビ（主要4項目）
const BOTTOM_NAV = PRIMARY_NAV.slice(0, 4);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<UserResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push('/login');
      return;
    }
    setUserState(u);
  }, [router]);

  // 画面遷移時にシートを閉じる
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  function handleLogout() {
    removeUser();
    router.push('/login');
  }

  function isActive(item: NavItem): boolean {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-state">
          <span className="loading-spinner" />
          読み込み中...
        </div>
      </div>
    );
  }

  const initial = user.username.charAt(0);

  return (
    <div className="app-shell">
      {/* PC サイドバー */}
      <aside className="sidebar" aria-label="サイドナビゲーション">
        <div className="sidebar-logo">
          <div className="sidebar-logo-badge">
            <Icon name="account_balance" />
          </div>
          <span className="sidebar-logo-text">家計簿</span>
        </div>

        <nav className="nav">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-link ${isActive(item) ? 'active' : ''}`}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
          <div className="nav-divider" />
          {SECONDARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-link ${isActive(item) ? 'active' : ''}`}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initial}</div>
          <span className="sidebar-user-name">{user.username}</span>
          <button className="sidebar-logout" onClick={handleLogout} aria-label="ログアウト" title="ログアウト">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      {/* モバイルヘッダー */}
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <div className="mobile-header-badge">
            <Icon name="account_balance" />
          </div>
          <span className="mobile-header-title">家計簿</span>
        </div>
        <button className="avatar" onClick={() => setSheetOpen(true)} aria-label="メニューを開く">
          {initial}
        </button>
      </header>

      {/* メイン */}
      <main className="app-main">{children}</main>

      {/* モバイルボトムナビ */}
      <nav className="bottom-nav" aria-label="ボトムナビゲーション">
        {BOTTOM_NAV.map((item) => (
          <Link key={item.href} href={item.href} className={`bottom-nav-item ${isActive(item) ? 'active' : ''}`}>
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
        <button className="bottom-nav-item" onClick={() => setSheetOpen(true)}>
          <Icon name="menu" />
          その他
        </button>
      </nav>

      {/* モバイル その他シート */}
      {sheetOpen && (
        <div className="mobile-sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <Link href="/dashboard/import" className="nav-link">
              <Icon name="upload_file" />データ取込
            </Link>
            {SECONDARY_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
            <div className="nav-divider" />
            <button className="nav-link" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
              <Icon name="logout" />ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
