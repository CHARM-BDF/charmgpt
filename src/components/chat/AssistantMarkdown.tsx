import React, { Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useChatStore } from '../../store/chatStore';

interface AssistantMarkdownProps {
  content: string;
}

// Error Boundary Component
class MarkdownErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MarkdownErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-red-500">Error rendering markdown content.</div>;
    }

    return this.props.children;
  }
}

export const AssistantMarkdown: React.FC<AssistantMarkdownProps> = ({ content }) => {
  const { selectArtifact } = useChatStore();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Clean up content by removing leading spaces while preserving markdown
  const cleanContent = content.split('\n').map(line => {
    // Preserve markdown syntax while cleaning spaces
    if (line.startsWith('    ') && !line.trim().startsWith('```')) {
      // Remove exactly 4 spaces from the start if it's not a code block
      return line.slice(4);
    }
    return line;
  }).join('\n');

  const markdownComponents = {
    h1: ({node, ...props}: any) => <h1 className="text-4xl font-bold mb-6 mt-8 text-gray-900 dark:text-gray-100" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-3xl font-semibold mb-4 mt-6 text-gray-800 dark:text-gray-200" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-2xl font-medium mb-3 mt-5 text-gray-700 dark:text-gray-300" {...props} />,
    p: ({node, ...props}: any) => <p className="mb-4 leading-relaxed text-gray-700 dark:text-gray-300" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc pl-6 mb-4" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-6 mb-4" {...props} />,
    li: ({node, ...props}: any) => <li className="mb-2 text-gray-700 dark:text-gray-300" {...props} />,
    blockquote: ({node, ...props}: any) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-gray-600 dark:text-gray-400" {...props} />
    ),
    pre: ({node, ...props}: any) => (
      <pre className="bg-white dark:bg-gray-900" {...props} />
    ),
    code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const isFenced = className?.includes('language-');
      
      if (inline) {
        return (
          <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm" {...props}>
            {children}
          </code>
        );
      }
      
      if (isFenced) {
        return (
          <div className="mb-4 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 flex justify-between items-center">
              <span className="uppercase font-semibold">{language || 'Text'}</span>
              <button 
                onClick={() => copyToClipboard(String(children))} 
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Copy code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
              </button>
            </div>
            <div className="bg-white dark:bg-gray-900">
              <SyntaxHighlighter
                style={oneLight as any}
                language={language}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  background: 'transparent',
                  padding: '1rem'
                }}
                wrapLines={true}
                wrapLongLines={true}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          </div>
        );
      }
      
      return String(children);
    },
    img: ({node, ...props}: any) => (
      <img className="max-w-full h-auto rounded-lg shadow-md my-4" {...props} />
    ),
    hr: ({node, ...props}: any) => (
      <hr className="my-8 border-t border-gray-300 dark:border-gray-700" {...props} />
    ),
    a: ({node, href, children, ...props}: any) => {
      if (href?.startsWith('artifact:')) {
        return (
          <button
            onClick={() => selectArtifact(href.replace('artifact:', ''))}
            className="text-blue-500 hover:underline"
            type="button"
          >
            {children}
          </button>
        );
      }
      if (href?.startsWith('javascript:')) {
        return (
          <button
            onClick={(e) => e.preventDefault()}
            className="text-blue-500 hover:underline"
            type="button"
          >
            {children}
          </button>
        );
      }
      return (
        <a 
          href={href} 
          className="text-blue-500 hover:underline" 
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    table: ({node, ...props}: any) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-gray-200 border dark:divide-gray-700" {...props} />
      </div>
    ),
    thead: ({node, ...props}: any) => (
      <thead className="bg-gray-50 dark:bg-gray-800" {...props} />
    ),
    tbody: ({node, ...props}: any) => (
      <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700" {...props} />
    ),
    tr: ({node, ...props}: any) => (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800" {...props} />
    ),
    th: ({node, ...props}: any) => (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400" {...props} />
    ),
    td: ({node, ...props}: any) => (
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" {...props} />
    ),
  };

  return (
    <MarkdownErrorBoundary>
      <div className="prose max-w-none dark:prose-invert">
        <ReactMarkdown 
          children={cleanContent}
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        />
      </div>
    </MarkdownErrorBoundary>
  );
}; 