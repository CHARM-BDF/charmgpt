import { useState, useCallback, useEffect } from 'react';
import { FileEntry } from '../types/fileManagement';

interface FileReferenceState {
  isActive: boolean;
  query: string;
  position: { x: number; y: number } | null;
  selectedFile: FileEntry | null;
}

interface UseFileReferenceProps {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onFileSelect?: (file: FileEntry, cursorPosition: number) => void;
  onFilePreview?: (file: FileEntry | null) => void;
}

interface UseFileReferenceReturn {
  fileRefState: FileReferenceState;
  handleInputChange: (text: string) => void;
  handleFileSelect: (file: FileEntry) => void;
  handleFilePreview: (file: FileEntry | null) => void;
  closeFileRef: () => void;
}

export function useFileReference({ inputRef, onFileSelect, onFilePreview }: UseFileReferenceProps): UseFileReferenceReturn {
  const [fileRefState, setFileRefState] = useState<FileReferenceState>({
    isActive: false,
    query: '',
    position: null,
    selectedFile: null
  });

  const detectFileReference = useCallback((text: string, cursorPosition: number): { isActive: boolean; query: string; position: number } => {
    // Only check text up to cursor position to avoid re-triggering after file is inserted
    const textBeforeCursor = text.substring(0, cursorPosition);
    console.log('🔍 TEXT BEFORE CURSOR:', textBeforeCursor);
    console.log('🎯 FOUND @ SYMBOL?', textBeforeCursor.includes('@'));
    const match = textBeforeCursor.match(/@(\w*)$/);
    console.log('🎯 REGEX MATCH RESULT:', match);
    return {
      isActive: !!match,
      query: match ? match[1] : '',
      position: match ? match.index! : -1
    };
  }, []);

  const handleInputChange = useCallback((text: string) => {
    console.log('handleInputChange called with:', text);

    // Get cursor position from the textarea
    const cursorPosition = inputRef.current?.selectionStart || text.length;
    const { isActive, query, position } = detectFileReference(text, cursorPosition);
    console.log('File reference detected:', { isActive, query, position, cursorPosition });

    if (isActive && inputRef.current) {
      const textarea = inputRef.current;
      const computedStyle = getComputedStyle(textarea);
      const paddingLeft = parseInt(computedStyle.paddingLeft);
      const paddingTop = parseInt(computedStyle.paddingTop);
      const lineHeight = parseInt(computedStyle.lineHeight);

      // Get cursor position
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = text.substring(0, cursorPosition);
      const lines = textBeforeCursor.split('\n');
      const currentLineNumber = lines.length - 1;
      const currentLineText = lines[currentLineNumber];

      // Create a temporary span to measure text width
      const span = document.createElement('span');
      span.style.font = computedStyle.font;
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.textContent = currentLineText;
      document.body.appendChild(span);
      
      // Calculate position
      const textWidth = span.offsetWidth;
      document.body.removeChild(span);

      console.log('Position calculation:', {
        paddingLeft,
        paddingTop,
        lineHeight,
        textWidth,
        currentLineNumber,
        currentLineText
      });

      // Calculate popup position relative to textarea's content area
      const popupPosition = {
        x: paddingLeft + textWidth,
        y: paddingTop + (currentLineNumber * lineHeight)
      };

      console.log('Calculated popup position:', popupPosition);

      setFileRefState({
        isActive: true,
        query,
        position: popupPosition,
        selectedFile: null
      });
    } else {
      setFileRefState(prev => ({
        ...prev,
        isActive: false,
        query: '',
        position: null
      }));
    }
  }, [inputRef, detectFileReference]);

  const handleFileSelect = useCallback((file: FileEntry) => {
    console.log('🔥 handleFileSelect in hook called with file:', file?.name);
    console.log('🔥 inputRef.current:', inputRef.current);
    console.log('🔥 onFileSelect callback exists:', !!onFileSelect);
    
    setFileRefState(prev => ({
      ...prev,
      isActive: false,
      selectedFile: file
    }));

    if (inputRef.current && onFileSelect) {
      const cursorPosition = inputRef.current.selectionStart;
      console.log('🔥 Calling onFileSelect with cursor position:', cursorPosition);
      onFileSelect(file, cursorPosition);
    } else {
      console.error('🔥 ERROR: Cannot call onFileSelect - inputRef:', !!inputRef.current, 'onFileSelect:', !!onFileSelect);
    }
  }, [inputRef, onFileSelect]);

  const handleFilePreview = useCallback((file: FileEntry | null) => {
    if (onFilePreview) {
      onFilePreview(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Don't include onFilePreview in deps to prevent recreating callback

  const closeFileRef = useCallback(() => {
    setFileRefState({
      isActive: false,
      query: '',
      position: null,
      selectedFile: null
    });
  }, []);

  // Close file reference popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        closeFileRef();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputRef, closeFileRef]);

  return {
    fileRefState,
    handleInputChange,
    handleFileSelect,
    handleFilePreview,
    closeFileRef
  };
} 