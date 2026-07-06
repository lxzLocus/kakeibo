'use client';

import { Theme } from '@radix-ui/themes';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const ThemeContext = createContext<{ theme: ThemeMode; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/**
 * ライト/ダークのテーマ管理。
 * - 初期値は localStorage → OS設定(prefers-color-scheme) の順で決定
 * - <html data-theme="..."> を切り替え、globals.css のトークンが反応する
 * - Radix Theme の appearance も同期
 * FOUC 防止の初期 data-theme 設定は layout.tsx の inline script が担う。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme') as ThemeMode | null;
    const stored = (localStorage.getItem('kakeibo-theme') as ThemeMode | null);
    const initial: ThemeMode =
      stored ??
      attr ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('kakeibo-theme', next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <Theme appearance={theme} accentColor="jade" grayColor="sage" radius="large" scaling="100%">
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}
