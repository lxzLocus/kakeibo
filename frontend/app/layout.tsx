import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "家計簿 - Kakeibo",
  description: "あなたの家計を、もっとスマートに。収支を記録し、家計を見える化する家計簿アプリ。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,0&family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Sans+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
