import React, { useEffect, useState, useRef, KeyboardEvent, useMemo } from 'react';
import { GraphItem, GraphData } from '../../types/graphReference';
// @ts-ignore - Heroicons type definitions mismatch
import { CircleStackIcon, TagIcon, BeakerIcon, HeartIcon, CpuChipIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface GraphReferencePopupProps {
  query: string;
  position: { x: number; y: number };
  graphData: GraphData;
  onSelect: (item: GraphItem) => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
}

// Helper functions for visual enhancements
const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    gene: '#1f77b4',
    protein: '#f39c12',
    drug: '#e74c3c',
    disease: '#2ecc71',
    pathway: '#9b59b6',
    compound: '#e67e22',
    organism: '#27ae60',
    other: '#bdc3c7'
  };
  return colors[category.toLowerCase()] || colors.other;
};

const getCategoryIcon = (category: string) => {
  const icons: Record<string, React.ComponentType<any>> = {
    gene: CpuChipIcon,
    protein: BeakerIcon,
    drug: BeakerIcon,
    disease: HeartIcon,
    pathway: DocumentTextIcon,
    compound: BeakerIcon,
    organism: HeartIcon,
    other: CircleStackIcon
  };
  return icons[category.toLowerCase()] || CircleStackIcon;
};

export const GraphReferencePopup: React.FC<GraphReferencePopupProps> = ({
  query,
  position,
  graphData,
  onSelect,
  onClose,
  loading = false,
  error = null
}) => {
  console.log('[NEW] GraphReferencePopup rendered with:', { query, position, loading, error, nodeCount: graphData.nodes.length });
  console.log('[NEW] Popup position details:', { x: position.x, y: position.y, left: `${position.x}px`, top: `${position.y + 20}px` });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

  // Memoize filtered items for performance
  const filteredItems = useMemo(() => {
    const items: GraphItem[] = [];

    // Add matching nodes
    const matchingNodes = graphData.nodes
      .filter(node => {
        const matchesName = node.label.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = node.type.toLowerCase().includes(query.toLowerCase());
        return matchesName || matchesCategory;
      })
      .map(node => ({
        id: node.id,
        name: node.label,
        category: node.type,
        type: 'node' as const
      }));

    // Add matching categories
    const matchingCategories = graphData.categories
      .filter(category => category.toLowerCase().includes(query.toLowerCase()))
      .map(category => {
        const nodeCount = graphData.nodes.filter(n => n.type === category).length;
        return {
          id: category,
          name: category,
          category: category,
          type: 'category' as const,
          nodeCount
        };
      });

    // Sort items: categories first, then nodes
    items.push(...matchingCategories, ...matchingNodes);
    return items;
  }, [query, graphData]);

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
    console.log('[NEW] Filtered items for popup:', filteredItems.map(item => ({ 
      type: item.type, 
      name: item.name, 
      id: item.id, 
      category: item.category 
    })));
  }, [filteredItems]);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Adjust popup position to stay within viewport
  useEffect(() => {
    const adjustPosition = () => {
      if (!popupRef.current) return;
      
      const popup = popupRef.current;
      const rect = popup.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      // Ensure popup stays within viewport bounds
      if (rect.right > viewport.width) {
        popup.style.left = `${viewport.width - rect.width - 16}px`;
      }
      if (rect.bottom > viewport.height) {
        popup.style.top = `${viewport.height - rect.height - 16}px`;
      }
    };

    adjustPosition();
    window.addEventListener('resize', adjustPosition);
    return () => window.removeEventListener('resize', adjustPosition);
  }, [position]);

  // Handle loading state
  if (loading) {
    return (
      <div
        ref={popupRef}
        className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-64"
        style={{
          left: `${position.x}px`,
          top: `${position.y + 20}px`
        }}
      >
        <div className="p-4 text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span>Loading graph data...</span>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div
        ref={popupRef}
        className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-64"
        style={{
          left: `${position.x}px`,
          top: `${position.y + 20}px`
        }}
      >
        <div className="p-4 text-red-500 dark:text-red-400">
          <div className="font-medium">Error loading graph data</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      </div>
    );
  }

  // Handle empty state
  if (filteredItems.length === 0) {
    return (
      <div
        ref={popupRef}
        className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-64"
        style={{
          left: `${position.x}px`,
          top: `${position.y + 20}px`
        }}
      >
        <div className="p-4 text-gray-500 dark:text-gray-400">
          {query ? 'No matching nodes found' : 'No nodes available in current graph'}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto min-w-64"
      style={{
        left: `${position.x}px`,
        bottom: `${window.innerHeight - position.y}px`
      }}
    >
      <div className="text-sm font-medium text-gray-600 dark:text-gray-300 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        Reference a node
      </div>
      {filteredItems.map((item, index) => {
        const categoryColor = getCategoryColor(item.category);
        const CategoryIcon = getCategoryIcon(item.category);
        
        return (
          <div
            key={`${item.type}-${item.id}`}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
              index === selectedIndex ? 'bg-blue-100 dark:bg-blue-900' : ''
            }`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {item.type === 'node' ? (
              <>
                <CategoryIcon 
                  className="w-4 h-4 flex-shrink-0" 
                  style={{ color: categoryColor }}
                />
                <span className="font-medium truncate">{item.name}</span>
                <span 
                  className="text-xs px-2 py-0.5 rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: categoryColor }}
                >
                  {item.category}
                </span>
              </>
            ) : (
              <>
                <TagIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="font-medium truncate">{item.name}</span>
                <span 
                  className="text-xs px-2 py-0.5 rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: categoryColor }}
                >
                  {item.nodeCount} nodes
                </span>
              </>
            )}
            {index === selectedIndex && (
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded ml-auto">
                Enter
              </kbd>
            )}
          </div>
        );
      })}
    </div>
  );
};
