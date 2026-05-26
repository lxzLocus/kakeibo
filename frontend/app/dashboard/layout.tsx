'use client';

import { useRouter } from 'next/navigation';
import { getUser, removeUser } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { UserResponse } from '@/types';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
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
    </div>
  );
}
