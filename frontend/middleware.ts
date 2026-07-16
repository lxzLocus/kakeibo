import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

/**
 * 外部公開時の最低限のアクセスゲート（HTTP Basic 認証）。
 * BASIC_AUTH_USER と BASIC_AUTH_PASSWORD の両方がセットされたときだけ有効化する。
 * 未設定ならゲート無効＝素通り（ローカル開発の既定）。
 * ページ・/api プロキシを含む全リクエストに効く（フロントが唯一の公開面のため、
 * これだけでバックエンドAPIも保護される）。self-host(standalone node)前提で
 * process.env は実行時に評価する（関数内で参照）。
 */
function checkBasicAuth(request: NextRequest): NextResponse | null {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return null; // ゲート無効

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      decoded = '';
    }
    const sep = decoded.indexOf(':');
    if (sep >= 0) {
      const u = decoded.slice(0, sep);
      const p = decoded.slice(sep + 1);
      if (u === user && p === pass) return null; // 認証OK
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="kakeibo", charset="UTF-8"' },
  });
}

export function middleware(request: NextRequest) {
  // まず Basic 認証ゲート（有効時のみ）。落ちたら 401 を即返す。
  const gate = checkBasicAuth(request);
  if (gate) return gate;

  const { pathname } = request.nextUrl;
  const userCookie = request.cookies.get('kakeibo_user');
  const isAuthenticated = !!userCookie?.value;

  // 静的ファイル・API・Next.js内部パスはスキップ
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ルートパス: 認証状態に応じてリダイレクト
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 認証済みユーザーがログイン/登録画面にアクセス → ダッシュボードへ
  if (isAuthenticated && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 未認証ユーザーが保護されたページにアクセス → ログインへ
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
