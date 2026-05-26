import { UserResponse } from '@/types';

const COOKIE_NAME = 'kakeibo_user';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7日間

/**
 * ログインユーザー情報をCookieに保存
 */
export function setUser(user: UserResponse): void {
  const value = encodeURIComponent(JSON.stringify(user));
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * CookieからログインユーザーIDを取得
 */
export function getUserId(): number | null {
  const user = getUser();
  return user?.id ?? null;
}

/**
 * Cookieからログインユーザー情報を取得
 */
export function getUser(): UserResponse | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === COOKIE_NAME) {
      try {
        return JSON.parse(decodeURIComponent(rest.join('=')));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Cookieからログインユーザー情報を削除（ログアウト）
 */
export function removeUser(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * ログイン済みか判定
 */
export function isAuthenticated(): boolean {
  return getUser() !== null;
}
