'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark, oneLight} from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  node: any;
  inline: boolean;
  className: string;
  children: any;
}

export function CodeBlock({
  node,
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!inline) {
    const language = className?.replace('language-', '') || 'text';

    return (
      <div className="not-prose flex flex-col rounded-[8px] border border-zinc-300 dark:border-[#303030] overflow-hidden my-1">
        <div className="flex justify-between items-center bg-zinc-100 dark:bg-[#303030] text-zinc-500 dark:text-zinc-400 px-4 py-2 text-[9pt]">
          <span>{language}</span>
          <button
            onClick={handleCopy}
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="text-sm w-full overflow-x-auto p-4 text-zinc-800 dark:text-zinc-50">
          <SyntaxHighlighter
            language={language}
            style={resolvedTheme === 'dark' ? materialDark : oneLight}
            customStyle={{
              background: resolvedTheme === 'dark' ? '#1B1B1B' : '#F9F9F9',
              fontSize: '10pt',
              margin: 0,
              padding: 0,
            }}
            codeTagProps={{
              style: {
                textDecoration: 'none',
              },
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  } else {
    return (
      <code
        className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
        {...props}
      >
        {children}
      </code>
    );
  }
}
