import { redirect } from 'next/navigation';

/**
 * ルートページ — middleware.ts が Cookie を見て
 * /login か /dashboard にリダイレクトするため、
 * ここに到達した場合は /login へフォールバック。
 */
export default function RootPage() {
  redirect('/login');
}
