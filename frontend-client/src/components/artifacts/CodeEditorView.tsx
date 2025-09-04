import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { StreamLanguage } from '@codemirror/language';
import { r } from '@codemirror/legacy-modes/mode/r';
import { scheme } from '@codemirror/legacy-modes/mode/scheme';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { Play } from 'lucide-react';

interface CodeEditorViewProps {
  code: string;
  language: string;
  title?: string;
  isDarkMode?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onExecute?: (code: string, language: string) => void;
}

export const CodeEditorView: React.FC<CodeEditorViewProps> = ({
  code,
  language,
  title,
  isDarkMode = false,
  readOnly = true,
  onChange,
  onExecute
}) => {
  const extensions = useMemo(() => {
    const baseExtensions = [
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          fontSize: '14px',
          fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", monospace'
        },
        '.cm-content': {
          padding: '16px',
          minHeight: '200px'
        },
        '.cm-focused': {
          outline: 'none'
        },
        '.cm-editor': {
          borderRadius: '8px'
        },
        '.cm-scroller': {
          fontFamily: 'inherit'
        }
      })
    ];

    // Add language-specific extension
    switch (language.toLowerCase()) {
      case 'python':
      case 'py':
        baseExtensions.push(python());
        break;
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        baseExtensions.push(javascript({ typescript: language.includes('typescript') || language.includes('ts') }));
        break;
      case 'r':
        baseExtensions.push(StreamLanguage.define(r));
        break;
      case 'racket':
      case 'scheme':
        baseExtensions.push(StreamLanguage.define(scheme));
        break;
      default:
        // Fallback to plain text for unknown languages
        break;
    }

    return baseExtensions;
  }, [language]);

  // Check if language supports execution
  const supportsExecution = ['python', 'py', 'r', 'racket', 'scheme'].includes(language.toLowerCase());

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md">
      {title && (
        <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            {!readOnly && supportsExecution && onExecute && (
              <button
                onClick={() => onExecute(code, language)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                title={`Execute ${language} code`}
              >
                <Play size={12} />
                Run
              </button>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
              {language}
            </span>
          </div>
        </div>
      )}
      <div className="relative">
        <CodeMirror
          value={code}
          onChange={onChange}
          extensions={extensions}
          theme={isDarkMode ? oneDark : undefined}
          editable={!readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: false,
            bracketMatching: true,
            closeBrackets: false,
            autocompletion: false,
            highlightSelectionMatches: false,
            searchKeymap: true
          }}
        />
      </div>
    </div>
  );
};
