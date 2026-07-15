'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, removeUser } from '@/lib/auth';
import { useEffect, useRef, useState } from 'react';
import { UserResponse } from '@/types';
import { Icon } from '@/app/_components/Icon';
import { UiProvider } from '@/app/_components/ui';

type NavItem = { href: string; label: string; icon: string; exact?: boolean };

// サイドバー / ドロワー / ボトムナビ
// 分析にシミュレーションを統合したため、シミュレーションは独立ナビにしない。
const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'ホーム', icon: 'home', exact: true },
  { href: '/dashboard/analytics', label: '分析', icon: 'monitoring' },
  { href: '/dashboard/shopping', label: '買い物リスト', icon: 'shopping_cart' },
  { href: '/dashboard/chat', label: 'AI相談', icon: 'forum' },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/dashboard/import', label: 'データ取込', icon: 'upload_file' },
  { href: '/dashboard/settings', label: '設定', icon: 'settings' },
];

// モバイルボトムナビ（主要4項目・「その他」は廃止しハンバーガーへ集約）
const BOTTOM_NAV = PRIMARY_NAV.slice(0, 4);

const MOBILE_TITLES: { match: (p: string) => boolean; title: string }[] = [
  { match: (p) => p === '/dashboard', title: '家計簿' },
  { match: (p) => p.startsWith('/dashboard/analytics'), title: '分析' },
  { match: (p) => p.startsWith('/dashboard/shopping'), title: '買い物リスト' },
  { match: (p) => p.startsWith('/dashboard/chat'), title: 'AI相談' },
  { match: (p) => p.startsWith('/dashboard/import'), title: 'データ取込' },
  { match: (p) => p.startsWith('/dashboard/settings'), title: '設定' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<UserResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const navHiddenRef = useRef(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push('/login');
      return;
    }
    setUserState(u);
  }, [router]);

  // 画面遷移時: シートを閉じ、ボトムナビ格納をリセット
  useEffect(() => {
    setSheetOpen(false);
    navHiddenRef.current = false;
    setNavHidden(false);
  }, [pathname]);

  // スクロールでボトムナビ/入力バーを格納（design §12）。
  // capture フェーズで内側スクロール要素（app-main / チャットメッセージ）も拾う。
  useEffect(() => {
    let lastST = 0;
    function onScroll(e: Event) {
      const el = e.target as (HTMLElement & { scrollTop?: number }) | Document | null;
      let st: number;
      if (!el || el === document || el === document.documentElement || el === document.body) {
        st = window.scrollY || document.documentElement.scrollTop || 0;
      } else if (typeof (el as HTMLElement).scrollTop === 'number') {
        st = (el as HTMLElement).scrollTop;
      } else {
        return;
      }
      if (st > lastST + 6 && st > 28) {
        if (!navHiddenRef.current) {
          navHiddenRef.current = true;
          setNavHidden(true);
        }
      } else if (st < lastST - 6) {
        if (navHiddenRef.current) {
          navHiddenRef.current = false;
          setNavHidden(false);
        }
      }
      lastST = st;
    }
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);

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
  const mobileTitle = MOBILE_TITLES.find((t) => t.match(pathname))?.title ?? '家計簿';
  const isChat = pathname.startsWith('/dashboard/chat');

  return (
    <UiProvider>
    <div className="app-shell" data-nav-hidden={navHidden ? 'true' : undefined} data-chat={isChat ? 'true' : undefined}>
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

      {/* モバイルヘッダー（ユーザーメニューは左のハンバーガーから開く） */}
      <header className="mobile-header">
        <div className="mobile-header__left">
          <button className="mobile-header__menu" onClick={() => setSheetOpen(true)} aria-label="メニューを開く">
            <Icon name="menu" />
          </button>
          <span className="mobile-header__title">{mobileTitle}</span>
        </div>
      </header>

      {/* メイン */}
      <main className={`app-main${isChat ? ' app-main--chat' : ''}`}>{children}</main>

      {/* モバイルボトムナビ */}
      <nav className="bottom-nav" aria-label="ボトムナビゲーション">
        {BOTTOM_NAV.map((item) => (
          <Link key={item.href} href={item.href} className={`bottom-nav-item ${isActive(item) ? 'active' : ''}`}>
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* ハンバーガードロワー */}
      {sheetOpen && (
        <div className="drawer-overlay" onClick={() => setSheetOpen(false)}>
          <div className="nav-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="nav-drawer__header">
              <div className="nav-drawer__brand-group">
                <div className="nav-drawer__logo-box">
                  <Icon name="account_balance" />
                </div>
                <span className="nav-drawer__brand">家計簿</span>
              </div>
              <button className="nav-drawer__close" onClick={() => setSheetOpen(false)} aria-label="閉じる">
                <Icon name="close" />
              </button>
            </div>

            <nav className="nav-drawer__nav">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`drawer-nav-item ${isActive(item) ? 'drawer-nav-item--active' : ''}`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
              <div className="nav-drawer__divider" />
              {SECONDARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`drawer-nav-item ${isActive(item) ? 'drawer-nav-item--active' : ''}`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="nav-drawer__user">
              <div className="nav-drawer__avatar">{initial}</div>
              <span className="nav-drawer__username">{user.username}</span>
              <button className="nav-drawer__logout" onClick={handleLogout} aria-label="ログアウト">
                <Icon name="logout" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </UiProvider>
  );
}
