import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { Components } from 'react-markdown';
import { Box } from '@mui/material';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  compact?: boolean;
}

function MarkdownRenderer({ content, className, compact = false }: MarkdownRendererProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: Partial<Components> = {
    h1: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/heading-has-content
      <h1
        style={{
          fontSize: compact ? '1.2em' : '2.5rem',
          fontWeight: 'bold',
          marginTop: compact ? '0.75rem' : '1.5rem',
          marginBottom: compact ? '0.5rem' : '1rem',
          color: '#C62828',
          borderBottom: '2px solid #C62828',
          paddingBottom: '0.5rem',
        }}
        {...props}
      />
    ),
    h2: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/heading-has-content
      <h2
        style={{
          fontSize: compact ? '1.05em' : '2rem',
          fontWeight: 'bold',
          marginTop: compact ? '0.75rem' : '1.25rem',
          marginBottom: compact ? '0.375rem' : '0.875rem',
          color: '#C62828',
          borderBottom: '1px solid #E0E0E0',
          paddingBottom: '0.375rem',
        }}
        {...props}
      />
    ),
    h3: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/heading-has-content
      <h3
        style={{
          fontSize: compact ? '1em' : '1.5rem',
          fontWeight: '600',
          marginTop: compact ? '0.5rem' : '1rem',
          marginBottom: compact ? '0.25rem' : '0.75rem',
          color: '#C62828',
        }}
        {...props}
      />
    ),
    h4: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/heading-has-content
      <h4
        style={{
          fontSize: compact ? '0.95em' : '1.25rem',
          fontWeight: '600',
          marginTop: compact ? '0.5rem' : '0.875rem',
          marginBottom: compact ? '0.25rem' : '0.625rem',
          color: '#333',
        }}
        {...props}
      />
    ),
    h5: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/heading-has-content
      <h5
        style={{
          fontSize: compact ? '0.9em' : '1.125rem',
          fontWeight: '600',
          marginTop: compact ? '0.375rem' : '0.75rem',
          marginBottom: compact ? '0.25rem' : '0.5rem',
          color: '#333',
        }}
        {...props}
      />
    ),
    h6: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/heading-has-content
      <h6
        style={{
          fontSize: compact ? '0.875em' : '1rem',
          fontWeight: '600',
          marginTop: compact ? '0.375rem' : '0.625rem',
          marginBottom: compact ? '0.25rem' : '0.5rem',
          color: '#555',
        }}
        {...props}
      />
    ),
    p: ({ node, ...props }) => (
      <p
        style={{
          marginTop: compact ? '0.375rem' : '0.75rem',
          marginBottom: compact ? '0.375rem' : '0.75rem',
          lineHeight: '1.75',
          color: '#333',
          fontSize: compact ? '0.875rem' : 'inherit',
        }}
        {...props}
      />
    ),
    a: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/anchor-has-content
      <a
        style={{
          color: '#C62828',
          textDecoration: 'none',
          borderBottom: '1px solid transparent',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderBottomColor = '#C62828';
          e.currentTarget.style.color = '#8B1A1A';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderBottomColor = 'transparent';
          e.currentTarget.style.color = '#C62828';
        }}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    // react-markdown v10: inline code has no className, block code has className="language-xxx"
    pre: ({ node, ...props }) => (
      <pre
        style={{
          backgroundColor: '#F8F8F8',
          padding: '1rem',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          overflow: 'auto',
          border: '1px solid #E0E0E0',
          marginTop: compact ? '0.5rem' : '1rem',
          marginBottom: compact ? '0.5rem' : '1rem',
        }}
        {...props}
      />
    ),
    code: ({ node, className, children, ...props }: any) => {
      const isBlock = Boolean(className);
      if (isBlock) {
        return (
          <code className={className} style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }} {...props}>
            {children}
          </code>
        );
      }
      return (
        <code
          style={{
            backgroundColor: '#F5F5F5',
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem',
            fontSize: '0.875em',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
            color: '#C62828',
          }}
          {...props}
        >
          {children}
        </code>
      );
    },
    img: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/alt-text
      <img
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '0.5rem',
          marginTop: '1rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
        loading="lazy"
        {...props}
      />
    ),
    blockquote: ({ node, ...props }) => (
      <blockquote
        style={{
          borderLeft: '4px solid #C62828',
          paddingLeft: '1rem',
          marginLeft: 0,
          marginRight: 0,
          marginTop: compact ? '0.5rem' : '1rem',
          marginBottom: compact ? '0.5rem' : '1rem',
          fontStyle: 'italic',
          color: '#555',
          backgroundColor: '#FFF5F5',
          padding: '0.75rem 1rem',
          borderRadius: '0.25rem',
        }}
        {...props}
      />
    ),
    ul: ({ node, ...props }) => (
      <ul
        style={{
          marginTop: compact ? '0.25rem' : '0.75rem',
          marginBottom: compact ? '0.25rem' : '0.75rem',
          paddingLeft: '1.5rem',
          lineHeight: '1.75',
          listStyleType: 'disc',
        }}
        {...props}
      />
    ),
    ol: ({ node, ...props }) => (
      <ol
        style={{
          marginTop: compact ? '0.25rem' : '0.75rem',
          marginBottom: compact ? '0.25rem' : '0.75rem',
          paddingLeft: '1.5rem',
          lineHeight: '1.75',
          listStyleType: 'decimal',
        }}
        {...props}
      />
    ),
    li: ({ node, ...props }) => (
      <li
        style={{
          marginTop: compact ? '0.125rem' : '0.375rem',
          marginBottom: compact ? '0.125rem' : '0.375rem',
          color: '#333',
          fontSize: compact ? '0.875rem' : 'inherit',
        }}
        {...props}
      />
    ),
    table: ({ node, ...props }) => (
      <div style={{ overflowX: 'auto', marginTop: '1rem', marginBottom: '1rem' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #E0E0E0',
          }}
          {...props}
        />
      </div>
    ),
    thead: ({ node, ...props }) => (
      <thead style={{ backgroundColor: '#F5F5F5' }} {...props} />
    ),
    tr: ({ node, ...props }) => (
      <tr style={{ borderBottom: '1px solid #E0E0E0' }} {...props} />
    ),
    th: ({ node, ...props }) => (
      <th
        style={{
          padding: '0.75rem',
          textAlign: 'left',
          fontWeight: 'bold',
          color: '#C62828',
          borderBottom: '2px solid #C62828',
        }}
        {...props}
      />
    ),
    td: ({ node, ...props }) => (
      <td
        style={{
          padding: '0.75rem',
          borderRight: '1px solid #F0F0F0',
        }}
        {...props}
      />
    ),
    hr: ({ node, ...props }) => (
      <hr
        style={{
          border: 'none',
          borderTop: '2px solid #E0E0E0',
          marginTop: compact ? '0.75rem' : '2rem',
          marginBottom: compact ? '0.75rem' : '2rem',
        }}
        {...props}
      />
    ),
    strong: ({ node, ...props }) => (
      <strong style={{ fontWeight: 'bold', color: '#C62828' }} {...props} />
    ),
    em: ({ node, ...props }) => (
      <em style={{ fontStyle: 'italic', color: '#555' }} {...props} />
    ),
  };

  return (
    <Box className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex,
          rehypeHighlight,
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }],
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}

export default MarkdownRenderer;
