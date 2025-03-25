'use client';

import { useState, useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';

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
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (editorContainerRef.current && !editorRef.current) {
      const startState = EditorState.create({
        doc: children,
        extensions: [basicSetup, python(), oneDark],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: editorContainerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [children]);

  if (!inline) {
    // Extract language from className (e.g., "language-python")
    const language = className?.replace('language-', '') || 'text';

    return (
      <div className="not-prose flex flex-col bg-[#191919] rounded-xl border border-[#303030] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center bg-[#303030] text-zinc-400 px-4 py-2 text-[9pt]">
          <span>{language}</span>
          <button
            onClick={handleCopy}
            className="text-zinc-400 hover:text-zinc-200"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {/* Code Editor */}
        <div
          ref={editorContainerRef}
          className="text-sm w-full overflow-x-auto p-4 dark:bg-[#191919] text-zinc-50"
        />
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