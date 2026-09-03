import { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { color, font } from '../../theme/webcoachTheme';
import { ChatVariant, chatFontSize } from './chatTheme';

/**
 * AIの回答（Markdown）の描画。
 *
 * 【なぜ専用に作るか】
 * ドロワーはインラインの component map（text-brand-*）、教材ページのパネルは
 * MarkdownRenderer compact を使っていて、後者は見出しが旧デザインの #C62828 だった。
 * 同じ会話を映す2面で回答の見え方が違っていたので1本にした。
 *
 * MarkdownRenderer（教材本文用）は残す。あちらは rehypeSlug と
 * rehypeAutolinkHeadings で見出しに id とアンカーを付けるが、チャットでは
 *   ・300pxの吹き出しの中の見出しが全部リンクになってタブ順に入る
 *   ・付いた id が教材本文側の目次ジャンプ先の id と衝突しうる
 * ので、ここでは remarkGfm だけにしている。数式もチャットの回答には出てこない。
 */
interface ChatMarkdownProps {
  content: string;
  variant: ChatVariant;
}

export function ChatMarkdown({ content, variant }: ChatMarkdownProps) {
  const size = chatFontSize(variant);

  const heading = (weight: number, scale: number) => ({ children }: { children?: ReactNode }) => (
    <p
      style={{
        fontSize: Math.round(size * scale * 10) / 10,
        fontWeight: weight,
        color: color.text,
        margin: '10px 0 6px',
        lineHeight: 1.6,
      }}
    >
      {children}
    </p>
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: heading(800, 1.12),
        h2: heading(800, 1.06),
        h3: heading(700, 1),
        p: ({ children }) => (
          <p style={{ margin: '0 0 8px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 700, color: color.text }}>{children}</strong>
        ),
        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: color.primary, textDecoration: 'underline' }}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.2em', margin: '4px 0 8px' }}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol style={{ listStyleType: 'decimal', paddingLeft: '1.2em', margin: '4px 0 8px' }}>
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li style={{ listStyleType: 'inherit', marginBottom: 3, lineHeight: 1.8 }}>{children}</li>
        ),
        code: ({ children, className }) =>
          className ? (
            // ブロック。狭い吹き出しなので中で横スクロールさせる
            <code
              style={{
                display: 'block',
                background: color.hoverBg,
                border: `1px solid ${color.border}`,
                borderRadius: 8,
                padding: '8px 9px',
                margin: '6px 0',
                fontSize: size - 1,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                overflowX: 'auto',
                whiteSpace: 'pre',
              }}
            >
              {children}
            </code>
          ) : (
            <code
              style={{
                background: color.hoverBg,
                borderRadius: 4,
                padding: '1px 4px',
                fontSize: size - 1,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {children}
            </code>
          ),
        // 表は吹き出しの幅を超えるので、必ず自前でスクロールさせる
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '6px 0' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: size - 1 }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th
            style={{
              border: `1px solid ${color.border}`,
              padding: '4px 7px',
              background: color.hoverBg,
              fontWeight: 700,
              textAlign: 'left',
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ border: `1px solid ${color.border}`, padding: '4px 7px' }}>{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote
            style={{
              borderLeft: `3px solid ${color.primaryBorder}`,
              paddingLeft: 9,
              margin: '6px 0',
              color: color.textMuted,
            }}
          >
            {children}
          </blockquote>
        ),
        hr: () => <hr style={{ border: 0, borderTop: `1px solid ${color.border}`, margin: '8px 0' }} />,
      }}
    >
      {/*
        「✅ 見出し - 本文」形式で1行に詰めて返ってくることがあるので改行に割る。
        実際のAIの出力に合わせた前処理で、消すと1行に潰れて読めなくなる。
      */}
      {content.replace(/^(✅[^\n-]*?) - (.+)$/gm, '$1\n$2')}
    </ReactMarkdown>
  );
}

export default ChatMarkdown;

/** 「あなた」側の素のテキスト。改行を保つ */
export function ChatPlainText({ content }: { content: string }) {
  return (
    <span style={{ whiteSpace: 'pre-wrap', fontFamily: font.family }}>{content}</span>
  );
}
