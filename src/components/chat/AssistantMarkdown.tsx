import React, { Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useChatStore } from '../../store/chatStore';
import rehypeRaw from 'rehype-raw';
import { Library } from 'lucide-react';

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
    console.error('MarkdownErrorBoundary caught an error:', error);
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

const ArtifactButton: React.FC<{
  id: string;
  type: string;
  title: string;
}> = ({ id, type, title }) => {
  const { selectArtifact } = useChatStore();

  const handleClick = () => {
    console.log('ArtifactButton: clicked with id:', id);
    selectArtifact(id);  // This will also set showArtifactWindow to true
  };

  const getIcon = () => {
    switch (type) {
      case 'application/vnd.bibliography':
        return <Library className="w-6 h-6" />;
      case 'application/json':
      case 'application/vnd.ant.json':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14c1 0 2 1 2 2v12c0 1-1 2-2 2H5c-1 0-2-1-2-2V6c0-1 1-2 2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8l-2 4 2 4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 8l2 4-2 4" />
          </svg>
        );
      case 'text/markdown':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'application/vnd.ant.code':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'image/svg+xml':
      case 'image/png':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'application/vnd.mermaid':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 3-3M4 6h16M4 18h16" />
          </svg>
        );
      case 'text/html':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'application/vnd.react':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  return (
    <button
      className="inline-flex items-center gap-3 px-3 py-2 
                bg-slate-200 hover:bg-slate-300
                text-slate-700
                rounded-lg border border-slate-300
                shadow-[0_2px_4px_rgba(148,163,184,0.1)] hover:shadow-[0_4px_6px_rgba(148,163,184,0.15)]
                transition-all duration-200
                min-w-[50%] max-w-full"
      onClick={handleClick}
      data-artifact-id={id}
      data-artifact-type={type}
    >
      <div className="flex-shrink-0 p-2 border-r border-slate-300">
        {getIcon()}
      </div>
      <div className="flex flex-col items-start min-w-0">
        <span className="text-sm font-medium truncate w-full">{title}</span>
        <span className="text-xs text-slate-500">Click to open</span>
      </div>
    </button>
  );
};

interface CodeBlockAccumulator {
  lines: string[];
  inCodeBlock: boolean;
}

export const AssistantMarkdown: React.FC<AssistantMarkdownProps> = ({ content }) => {
  const { artifacts, selectArtifact, showArtifactWindow, toggleArtifactWindow } = useChatStore();

  // Add debug logging
  // console.log('AssistantMarkdown received content:', {
  //   contentLength: content?.length || 0,
  //   firstChars: content?.substring(0, 100) || 'empty',
  //   isString: typeof content === 'string'
  // });

  // Process content to properly format buttons and sections
  const processContent = (rawContent: string): string => {
    // Split content into sections and wrap each in a div
    return rawContent
      .split(/(<button.*?<\/button>)/g)
      .map((section, _index) => {
        if (section.startsWith('<button')) {
          return `<div class="my-4">${section}</div>`;
        } else if (section.trim()) {
          // Don't wrap sections that start with heading markers in divs
          if (section.trim().match(/^#+\s/)) {
            return section;
          }
          return `<div>${section}</div>`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  };

  const cleanContent = processContent(content)
    // First, replace [BACKTICK] tags with actual backticks
    .replace(/\[BACKTICK\]/g, '`')
    // Handle code blocks and spacing
    .split('\n')
    .reduce<CodeBlockAccumulator>((acc: CodeBlockAccumulator, line: string) => {
      // Track if we're in a code block
      const isStartOfCodeBlock = line.trim().startsWith('```');
      if (isStartOfCodeBlock) {
        // If this is a start/end of code block, update the state
        acc.inCodeBlock = !acc.inCodeBlock;
        // Trim only the code block markers
        acc.lines.push(line.trimStart());
      } else if (acc.inCodeBlock) {
        // If we're in a code block, preserve all spacing
        acc.lines.push(line);
      } else {
        // Outside code blocks, clean up indentation while preserving markdown structure
        const trimmed = line.trimStart();
        if (trimmed.startsWith('#')) {
          // Ensure proper heading format with space after #
          const headingMatch = trimmed.match(/^(#+)(.*)$/);
          if (headingMatch) {
            const [, hashes, content] = headingMatch;
            const processedLine = `${hashes} ${content.trim()}`;
            acc.lines.push(processedLine);
          } else {
            acc.lines.push(trimmed);
          }
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('1. ')) {
          acc.lines.push(trimmed); // Preserve list markers
        } else if (trimmed.startsWith('> ')) {
          acc.lines.push(trimmed); // Preserve blockquotes
        } else {
          acc.lines.push(trimmed); // Remove indentation for regular text
        }
      }
      return acc;
    }, { lines: [], inCodeBlock: false })
    .lines
    .join('\n');

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  /**
   * Handle clicking an artifact link
   * Uses the internal UUID, not the original XML artifactId
   */
  const handleArtifactClick = (uuid: string) => {
    console.log('AssistantMarkdown: handleArtifactClick called with uuid:', uuid);
    selectArtifact(uuid);
    if (!showArtifactWindow) {
      console.log('AssistantMarkdown: Opening artifact window');
      toggleArtifactWindow();
    }
  };

  // Clean up content by removing leading spaces while preserving markdown
  const markdownComponents = {
    h1: ({node, children, ...props}: any) => {
      return <h1 className="font-display text-2xl font-extrabold mb-4 mt-6 text-gray-900 dark:text-gray-100 tracking-tight" {...props}>{children}</h1>;
    },
    h2: ({node, children, ...props}: any) => {
      return <h2 className="font-display text-xl font-bold mb-3 mt-5 text-gray-800 dark:text-gray-200 tracking-tight" {...props}>{children}</h2>;
    },
    h3: ({node, ...props}: any) => <h3 className="font-display text-lg font-bold mb-2 mt-4 text-gray-700 dark:text-gray-300 tracking-tight" {...props} />,
    p: ({node, ...props}: any) => <p className="font-sans text-[15px] mb-3 leading-relaxed text-gray-700 dark:text-gray-300" {...props} />,
    ul: ({node, ordered, className, ...props}: any) => <ul className="font-sans list-disc pl-5 mb-3 space-y-1.5" {...props} />,
    ol: ({node, ordered, className, ...props}: any) => <ol className="font-sans list-decimal pl-5 mb-3 space-y-1.5" {...props} />,
    li: ({node, ordered, checked, className, ...props}: any) => {
      const liClassName = "font-sans text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed";
      if (checked !== null && checked !== undefined) {
        return (
          <li className={liClassName}>
            <input type="checkbox" checked={checked} readOnly className="mr-2" /> {props.children}
          </li>
        );
      }
      return <li className={liClassName} {...props} />;
    },
    blockquote: ({node, ...props}: any) => (
      <blockquote className="font-sans border-l-3 border-blue-500 pl-4 my-3 text-gray-600 dark:text-gray-400" {...props} />
    ),
    pre: ({node, children, ...props}: any) => {
      // If this is a code block, just return it directly
      if (children?.[0]?.type === 'code') {
        return children;
      }
      // For regular pre blocks (not code)
      return (
        <pre className="bg-white dark:bg-gray-800 p-4 rounded-md" {...props}>
          {children}
        </pre>
      );
    },
    code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (inline) {
        return (
          <code className="font-mono bg-gray-100 dark:bg-[#1F2937] rounded px-1.5 py-0.5 text-sm" {...props}>
            {children}
          </code>
        );
      }

      return (
        <div className="mb-4 overflow-hidden rounded-md border-2 border-gray-200 dark:border-gray-700 shadow-md">
          <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 flex justify-between items-center">
            <span className="uppercase font-semibold">{language || 'Output'}</span>
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
          <div className="overflow-x-auto bg-gray-50 dark:bg-[#1F2937] max-w-full mx-auto" style={{ width: '600px' }}>
            <SyntaxHighlighter
              style={typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? oneDark : oneLight}
              language={language || 'text'}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: 0,
                background: 'inherit',
                padding: '1rem',
                width: '100%'
              }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        </div>
      );
    },
    img: ({node, ...props}: any) => (
      <img className="max-w-full h-auto rounded-lg shadow-md my-4" {...props} />
    ),
    hr: ({node, ...props}: any) => (
      <hr className="my-8 border-t border-gray-300 dark:border-gray-700" {...props} />
    ),
    a: ({node, href, children, ...props}: any) => {
      if (href?.startsWith('artifact:')) {
        const uuid = href.replace('artifact:', '');
        console.log('AssistantMarkdown: Processing artifact link with uuid:', uuid);
        const artifact = artifacts.find(a => a.id === uuid);
        
        if (!artifact) {
          console.log('AssistantMarkdown: No artifact found for uuid:', uuid);
          return null;
        }
        
        return (
          <button
            onClick={() => selectArtifact(uuid)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
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
    table: ({node, isHeader, ...props}: any) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-gray-200 border dark:divide-gray-700" {...props} />
      </div>
    ),
    thead: ({node, isHeader, ...props}: any) => (
      <thead className="bg-gray-50 dark:bg-gray-800" {...props} />
    ),
    tbody: ({node, isHeader, ...props}: any) => (
      <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700" {...props} />
    ),
    tr: ({node, isHeader, ...props}: any) => (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800" {...props} />
    ),
    th: ({node, isHeader, ...props}: any) => (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400" {...props} />
    ),
    td: ({node, isHeader, ...props}: any) => (
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" {...props} />
    ),
    contactform: ({node, ...props}: any) => {
      // Create a proper submit handler function
      const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        console.log('Form submitted:', Object.fromEntries(formData));
        // Add your form submission logic here
      };

      // Return a form element instead of a div
      return (
        <form 
          className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"
          onSubmit={handleSubmit}
          {...Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'onSubmit'))}
        >
          {props.children}
        </form>
      );
    },
  };

  return (
    <MarkdownErrorBoundary>
      <div className="prose max-w-none dark:prose-invert !text-gray-900 dark:!text-gray-100">
        <ReactMarkdown 
          children={cleanContent}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw as any]}
          components={{
            ...markdownComponents,
            button: ({node, ...props}: any) => {
              if (props.className?.includes('artifact-button')) {
                const id = props['data-artifact-id'];
                const type = props['data-artifact-type'];
                const title = props.children[0]?.toString().replace('📎 ', '');
                
                if (id && type && title) {
                  return (
                    <ArtifactButton
                      id={id}
                      type={type}
                      title={title}
                    />
                  );
                }
              }
              return <button {...props}>{props.children}</button>;
            }
          }}
        />
      </div>
    </MarkdownErrorBoundary>
  );
}; 