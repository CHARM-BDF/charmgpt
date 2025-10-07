import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  GraphReferenceState, 
  GraphData, 
  GraphItem, 
  UseGraphReferenceProps, 
  UseGraphReferenceReturn 
} from '../types/graphReference';

export function useGraphReference({ 
  inputRef, 
  conversationId, 
  onItemSelect 
}: UseGraphReferenceProps): UseGraphReferenceReturn {
  const [graphRefState, setGraphRefState] = useState<GraphReferenceState>({
    isActive: false,
    query: '',
    position: null,
    selectedItem: null
  });

  const [graphData, setGraphData] = useState<GraphData>({ 
    nodes: [], 
    categories: [] 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load graph data when conversation changes with debouncing
  useEffect(() => {
    const loadGraphData = async () => {
      if (!conversationId) {
        setGraphData({ nodes: [], categories: [] });
        setError(null);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Loading graph data for conversation:', conversationId);
        const response = await fetch(`/api/graph/${conversationId}/state`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          const nodes = result.data.nodes || [];
          console.log('[DEBUG] Raw API response nodes:', nodes.slice(0, 2));
          console.log('[DEBUG] Node structure:', nodes[0] ? Object.keys(nodes[0]) : 'No nodes');
          
          const categories = [...new Set(nodes.map((n: any) => n.type))];
          setGraphData({ nodes, categories });
          console.log('[NEW] Graph data loaded:', { nodeCount: nodes.length, categories, nodes: nodes.slice(0, 3) });
        } else {
          console.log('[NEW] No graph data available for conversation:', conversationId);
          setGraphData({ nodes: [], categories: [] });
        }
      } catch (error) {
        console.error('Error loading graph data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load graph data');
        setGraphData({ nodes: [], categories: [] });
      } finally {
        setLoading(false);
      }
    };

    // Debounce the loading to avoid excessive API calls
    const timeoutId = setTimeout(loadGraphData, 300);
    return () => clearTimeout(timeoutId);
  }, [conversationId]);

  // Detect @ references in text
  const detectGraphReference = useCallback((text: string): { isActive: boolean; query: string; position: number } => {
    const match = text.match(/@([^\s]*)$/);
    console.log('[NEW] Regex match result:', { text, match });
    return {
      isActive: !!match,
      query: match ? match[1] : '',
      position: match ? match.index! : -1
    };
  }, []);

  // Handle input changes and detect @ references
  const handleInputChange = useCallback((text: string) => {
    const { isActive, query, position } = detectGraphReference(text);
    console.log('[NEW] Graph reference detection:', { isActive, query, position, text });
    
    if (isActive && inputRef.current) {
      // Calculate popup position
      const textarea = inputRef.current;
      const computedStyle = getComputedStyle(textarea);
      const paddingLeft = parseInt(computedStyle.paddingLeft);
      const paddingTop = parseInt(computedStyle.paddingTop);
      const lineHeight = parseInt(computedStyle.lineHeight);

      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = text.substring(0, cursorPosition);
      const lines = textBeforeCursor.split('\n');
      const currentLineNumber = lines.length - 1;
      const currentLineText = lines[currentLineNumber];

      // Calculate text width for positioning
      const span = document.createElement('span');
      span.style.font = computedStyle.font;
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.textContent = currentLineText;
      document.body.appendChild(span);
      
      const textWidth = span.offsetWidth;
      document.body.removeChild(span);

      // Get textarea's position relative to viewport
      const textareaRect = textarea.getBoundingClientRect();
      
      const popupPosition = {
        x: textareaRect.left + paddingLeft + textWidth,
        y: textareaRect.top + paddingTop + (currentLineNumber * lineHeight)
      };

      console.log('[NEW] Setting graph ref state active:', { query, popupPosition });
      setGraphRefState({
        isActive: true,
        query,
        position: popupPosition,
        selectedItem: null
      });
    } else {
      console.log('[NEW] Setting graph ref state inactive');
      setGraphRefState(prev => ({
        ...prev,
        isActive: false,
        query: '',
        position: null
      }));
    }
  }, [detectGraphReference, inputRef]);

  // Handle item selection
  const handleItemSelect = useCallback((item: GraphItem) => {
    if (graphRefState.position) {
      onItemSelect(item, graphRefState.position);
    }
    closeGraphRef();
  }, [graphRefState.position, onItemSelect]);

  // Close popup
  const closeGraphRef = useCallback(() => {
    setGraphRefState(prev => ({
      ...prev,
      isActive: false,
      query: '',
      position: null
    }));
  }, []);

  // Close graph reference popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        closeGraphRef();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputRef, closeGraphRef]);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(() => ({
    graphRefState,
    handleInputChange,
    handleItemSelect,
    closeGraphRef,
    graphData,
    loading,
    error
  }), [graphRefState, handleInputChange, handleItemSelect, closeGraphRef, graphData, loading, error]);
}
