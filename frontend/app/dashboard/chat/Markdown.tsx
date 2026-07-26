import React from 'react';

/**
 * 軽量マークダウン描画（AIチャット用）。外部依存なし・dangerouslySetInnerHTML 不使用で安全。
 * 対応: 見出し / 箇条書き（記号つき）/ 番号付き / チェックリスト / 表(GFM) / 引用 /
 *       コードブロック / 水平線 / 太字 / 斜体 / 取り消し線 / インラインコード / リンク。
 */

// 1行分のインライン装飾（**太字** / *斜体* / ~~取消~~ / `code` / [text](url)）を React ノードに変換
function inline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] != null) nodes.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3] != null) nodes.push(<em key={key++}>{m[3]}</em>);
    else if (m[4] != null) nodes.push(<del key={key++}>{m[4]}</del>);
    else if (m[5] != null) nodes.push(<code key={key++} className="md-code">{m[5]}</code>);
    else if (m[6] != null) {
      const href = m[7];
      const safe = /^(https?:|mailto:)/i.test(href) ? href : undefined;
      nodes.push(
        safe
          ? <a key={key++} href={safe} target="_blank" rel="noreferrer noopener">{m[6]}</a>
          : <span key={key++}>{m[6]}</span>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const UL = /^\s*[-*+]\s+/;
const OL = /^\s*\d+[.)]\s+/;
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+/;
const H = /^(#{1,4})\s+(.*)$/;
const QUOTE = /^\s*>\s?/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;

// GFMの表: 行がパイプを含み、次行が区切り（--- や :--: を | で区切ったもの）
function isTableRow(s: string): boolean {
  return /\|/.test(s) && s.trim().length > 0;
}
function isTableSeparator(s: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(s);
}
function splitCells(row: string): string[] {
  let s = row.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

export function Markdown({ text }: { text: string }) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // コードブロック ```
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++; }
      i++; // 閉じフェンスをスキップ
      out.push(<pre key={key++} className="md-pre"><code>{buf.join('\n')}</code></pre>);
      continue;
    }

    // 水平線
    if (HR.test(line)) {
      out.push(<hr key={key++} className="md-hr" />);
      i++;
      continue;
    }

    // 表（GFM）: 現在行が表の行で、次行が区切り
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitCells(line);
      i += 2; // ヘッダ + 区切りを消費
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        rows.push(splitCells(lines[i]));
        i++;
      }
      out.push(
        <div key={key++} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>{headers.map((hd, j) => <th key={j}>{inline(hd)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => <td key={ci}>{inline(r[ci] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 見出し（# → h3, ## → h4 ...）
    const h = H.exec(line);
    if (h) {
      const level = Math.min(h[1].length + 2, 6);
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      out.push(<Tag key={key++} className="md-h">{inline(h[2])}</Tag>);
      i++;
      continue;
    }

    // チェックリスト（- [ ] / - [x]）: 箇条書きより先に判定
    if (TASK.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && TASK.test(lines[i])) {
        const mt = TASK.exec(lines[i])!;
        const checked = mt[1].toLowerCase() === 'x';
        const body = lines[i].replace(TASK, '');
        items.push(
          <li key={items.length} className="md-task">
            <input type="checkbox" checked={checked} readOnly disabled />
            <span>{inline(body)}</span>
          </li>
        );
        i++;
      }
      out.push(<ul key={key++} className="md-list md-tasklist">{items}</ul>);
      continue;
    }

    // 箇条書き（記号つき）
    if (UL.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && UL.test(lines[i]) && !TASK.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(UL, ''))}</li>);
        i++;
      }
      out.push(<ul key={key++} className="md-list">{items}</ul>);
      continue;
    }

    // 番号付きリスト
    if (OL.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && OL.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(OL, ''))}</li>);
        i++;
      }
      out.push(<ol key={key++} className="md-list">{items}</ol>);
      continue;
    }

    // 引用
    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) { buf.push(lines[i].replace(QUOTE, '')); i++; }
      out.push(
        <blockquote key={key++} className="md-quote">
          {buf.map((b, j) => <div key={j}>{inline(b)}</div>)}
        </blockquote>
      );
      continue;
    }

    // 空行
    if (line.trim() === '') { i++; continue; }

    // 段落（特殊行が来るまで連結。行内改行は <br />）
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !UL.test(lines[i]) && !OL.test(lines[i]) && !H.test(lines[i]) && !HR.test(lines[i]) &&
      !lines[i].trim().startsWith('```') && !QUOTE.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key++} className="md-p">
        {para.map((p, j) => (
          <React.Fragment key={j}>{j > 0 && <br />}{inline(p)}</React.Fragment>
        ))}
      </p>
    );
  }

  return <>{out}</>;
}
