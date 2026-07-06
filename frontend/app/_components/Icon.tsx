import type { CSSProperties } from 'react';

/**
 * Material Symbols Outlined アイコン。
 * design/ のデザインに合わせ、絵文字の代わりに線画アイコンを使う。
 * フォント本体は layout.tsx の <link> で読み込む。
 */
export function Icon({
  name,
  size,
  className,
  style,
  fill,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        ...(fill ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : null),
        ...style,
      }}
    >
      {name}
    </span>
  );
}
