# Plan: Graph Mode Node Reference System (@ Autocomplete)

## 🎯 **Overview**

This document outlines the implementation of an `@` autocomplete system for Graph Mode conversations that allows users to reference nodes and categories by typing `@` followed by a search term. This solves the critical problem where users reference nodes by display name (e.g., "TP53") but the system needs the actual node ID (e.g., "NCBIGene:7157").

## 🚨 **Problem Statement**

### **Current Issue**
When users say "Remove TP53 gene", the AI receives the display name "TP53" but the MCP needs the actual node ID "NCBIGene:7157" to successfully remove the node from the database.

### **Root Cause**
- **Display Name**: What users see on the graph (e.g., "TP53")
- **Node ID**: What the database uses (e.g., "NCBIGene:7157")
- **Mismatch**: AI tries to remove "TP53" but database has no node with that ID

### **Solution**
Implement `@` autocomplete that:
1. **Shows available nodes** when user types `@`
2. **Displays user-friendly names** (e.g., "TP53")
3. **Inserts actual node IDs** (e.g., "NCBIGene:7157")
4. **Supports category filtering** (e.g., `@gene` shows all genes)

## 🏗️ **System Architecture**

### **Data Flow**
```
User types "@TP" 
↓
Node Reference System detects @
↓
Loads current graph data from database
↓
Filters nodes matching "TP"
↓
Shows popup with matching nodes
↓
User selects "TP53"
↓
System inserts actual node ID "NCBIGene:7157"
↓
User sends: "Remove @NCBIGene:7157"
↓
AI receives correct node ID
↓
MCP successfully removes node
```

### **Integration Points**
- **Chat Input**: Where users type `@` references
- **Graph Data**: Current nodes and categories from database
- **Graph Mode Detection**: Only active in Graph Mode conversations
- **MCP Integration**: Provides correct node IDs to AI

## 🔧 **Implementation Plan**

### **Phase 1: Core Infrastructure (3 hours)**

#### **1.1 Graph Reference Hook**
**File**: `frontend-client/src/hooks/useGraphReference.ts`

**Purpose**: Manage node reference state and detection logic

**Interface**:
```typescript
interface GraphReferenceState {
  isActive: boolean;
  query: string;
  position: { x: number; y: number } | null;
  selectedItem: GraphItem | null;
}

interface GraphItem {
  id: string;           // Database node ID (e.g., "NCBIGene:7157")
  name: string;         // Display name (e.g., "TP53")
  category: string;     // Node category (e.g., "gene")
  type: 'node' | 'category';
}

interface UseGraphReferenceProps {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  conversationId: string | null;
  onItemSelect: (item: GraphItem, position: number) => void;
}

interface UseGraphReferenceReturn {
  graphRefState: GraphReferenceState;
  handleInputChange: (text: string) => void;
  handleItemSelect: (item: GraphItem) => void;
  closeGraphRef: () => void;
}
```

**Key Features**:
- **@ Detection**: Regex pattern `/@(\w*)$/` to detect `@` at end of text
- **Position Calculation**: Calculate popup position relative to cursor
- **Graph Data Loading**: Fetch current graph data from API
- **Item Filtering**: Filter nodes by query string

**Implementation**:
```typescript
export function useGraphReference({ inputRef, conversationId, onItemSelect }: UseGraphReferenceProps): UseGraphReferenceReturn {
  const [graphRefState, setGraphRefState] = useState<GraphReferenceState>({
    isActive: false,
    query: '',
    position: null,
    selectedItem: null
  });

  const [graphData, setGraphData] = useState<{
    nodes: Array<{id: string, label: string, type: string}>;
    categories: string[];
  }>({ nodes: [], categories: [] });

  // Load graph data when conversation changes
  useEffect(() => {
    const loadGraphData = async () => {
      if (!conversationId) return;
      
      try {
        const response = await fetch(`/api/graph/${conversationId}/state`);
        const result = await response.json();
        if (result.success && result.data) {
          const nodes = result.data.nodes || [];
          const categories = [...new Set(nodes.map((n: any) => n.type))];
          setGraphData({ nodes, categories });
        }
      } catch (error) {
        console.error('Error loading graph data:', error);
      }
    };

    loadGraphData();
  }, [conversationId]);

  // Detect @ references in text
  const detectGraphReference = useCallback((text: string): { isActive: boolean; query: string; position: number } => {
    const match = text.match(/@(\w*)$/);
    return {
      isActive: !!match,
      query: match ? match[1] : '',
      position: match ? match.index! : -1
    };
  }, []);

  // Handle input changes and detect @ references
  const handleInputChange = useCallback((text: string) => {
    const { isActive, query, position } = detectGraphReference(text);
    
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

      const popupPosition = {
        x: paddingLeft + textWidth,
        y: paddingTop + (currentLineNumber * lineHeight)
      };

      setGraphRefState({
        isActive: true,
        query,
        position: popupPosition,
        selectedItem: null
      });
    } else {
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

  return {
    graphRefState,
    handleInputChange,
    handleItemSelect,
    closeGraphRef
  };
}
```

#### **1.2 Graph Reference Popup Component**
**File**: `frontend-client/src/components/graphReference/GraphReferencePopup.tsx`

**Purpose**: Display filtered list of nodes and categories

**Interface**:
```typescript
interface GraphReferencePopupProps {
  query: string;
  position: { x: number; y: number };
  graphData: {
    nodes: Array<{id: string, label: string, type: string}>;
    categories: string[];
  };
  onSelect: (item: GraphItem) => void;
  onClose: () => void;
}
```

**Key Features**:
- **Node List**: Show all nodes matching query
- **Category List**: Show all categories matching query
- **Filtering**: Filter by query string
- **Keyboard Navigation**: Arrow keys, Enter, Escape
- **Visual Design**: Icons, colors, node counts

**Implementation**:
```typescript
export const GraphReferencePopup: React.FC<GraphReferencePopupProps> = ({
  query,
  position,
  graphData,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredItems, setFilteredItems] = useState<GraphItem[]>([]);
  const popupRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  useEffect(() => {
    const items: GraphItem[] = [];

    // Add matching nodes
    const matchingNodes = graphData.nodes
      .filter(node => node.label.toLowerCase().includes(query.toLowerCase()))
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

    items.push(...matchingNodes, ...matchingCategories);
    setFilteredItems(items);
    setSelectedIndex(0);
  }, [query, graphData]);

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

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto min-w-64"
      style={{
        left: `${position.x}px`,
        top: `${position.y + 20}px`
      }}
    >
      {filteredItems.map((item, index) => (
        <div
          key={`${item.type}-${item.id}`}
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
            index === selectedIndex ? 'bg-blue-100 dark:bg-blue-900' : ''
          }`}
          onClick={() => onSelect(item)}
        >
          {item.type === 'node' ? (
            <>
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="font-medium">{item.name}</span>
              <span className="text-gray-500 text-sm">({item.category})</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="font-medium">{item.name}</span>
              <span className="text-gray-500 text-sm">({item.nodeCount} nodes)</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
```

### **Phase 2: Chat Input Integration (2 hours)**

#### **2.1 Modify ChatInput Component**
**File**: `frontend-client/src/components/chat/ChatInput.tsx`

**Changes Required**:
1. **Add Graph Mode detection**
2. **Integrate graph reference hook**
3. **Handle graph item selection**
4. **Render graph reference popup**

**Implementation**:
```typescript
// Add imports
import { useGraphReference } from '../../hooks/useGraphReference';
import { GraphReferencePopup } from '../graphReference/GraphReferencePopup';

// Add Graph Mode detection
const currentConversationId = useChatStore(state => state.currentConversationId);
const conversations = useChatStore(state => state.conversations);
const currentConversation = currentConversationId ? conversations[currentConversationId] : null;
const isGraphModeConversation = currentConversation?.metadata.mode === 'graph_mode';

// Add graph reference hook (only in Graph Mode)
const {
  graphRefState,
  handleInputChange: handleGraphRefInputChange,
  handleItemSelect: handleGraphItemSelect,
  closeGraphRef
} = useGraphReference({
  inputRef: textareaRef,
  conversationId: isGraphModeConversation ? currentConversationId : null,
  onItemSelect: (item, position) => {
    const before = localInput.slice(0, position - graphRefState.query.length - 1);
    const after = localInput.slice(position);
    const newInput = `${before}@${item.id}${after}`;
    handleInputChange(newInput);
  }
});

// Modify input change handler
const handleInputChange = (text: string) => {
  setLocalInput(text);
  
  // Handle file references (existing)
  handleFileRefInputChange(text);
  
  // Handle graph references (only in Graph Mode)
  if (isGraphModeConversation) {
    handleGraphRefInputChange(text);
  }
  
  // Update store
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
  }
  timeoutRef.current = setTimeout(() => {
    updateChatInput(text, false);
  }, 300);
};

// Add graph reference popup to render
{isGraphModeConversation && graphRefState.isActive && (
  <GraphReferencePopup
    query={graphRefState.query}
    position={graphRefState.position!}
    graphData={graphData} // Pass current graph data
    onSelect={handleGraphItemSelect}
    onClose={closeGraphRef}
  />
)}
```

#### **2.2 Graph Data Management**
**Approach**: Load graph data in the hook, pass to popup

**Alternative Approaches**:
1. **Hook-based**: Load data in `useGraphReference` hook
2. **Context-based**: Create GraphDataContext
3. **Store-based**: Add graph data to chatStore
4. **Props-based**: Pass from parent component

**Recommended**: Hook-based approach for simplicity

### **Phase 3: Enhanced Features (2 hours)**

#### **3.1 Smart Node ID Resolution**
**Problem**: User sees "TP53" but system needs "NCBIGene:7157"

**Solution**: Popup shows display name, inserts actual ID

```typescript
// In GraphReferencePopup
const handleNodeSelect = (node: GraphNode) => {
  onSelect({
    id: node.id,        // "NCBIGene:7157" (actual ID)
    name: node.label,   // "TP53" (display name)
    category: node.type,
    type: 'node'
  });
};

// In ChatInput
const handleGraphItemSelect = (item: GraphItem, position: number) => {
  const before = localInput.slice(0, position - graphRefState.query.length - 1);
  const after = localInput.slice(position);
  // Insert actual ID for nodes, name for categories
  const insertText = item.type === 'node' ? item.id : item.name;
  const newInput = `${before}@${insertText}${after}`;
  handleInputChange(newInput);
};
```

#### **3.2 Category-Based Filtering**
**Feature**: Show nodes by category

```typescript
// User types: @gene
// Shows: All nodes with category "gene"

// User types: @disease  
// Shows: All nodes with category "disease"

// Implementation in filtering logic
const matchingNodes = graphData.nodes.filter(node => {
  const matchesName = node.label.toLowerCase().includes(query.toLowerCase());
  const matchesCategory = node.type.toLowerCase().includes(query.toLowerCase());
  return matchesName || matchesCategory;
});
```

#### **3.3 Visual Enhancements**
**Features**:
- **Node counts** per category
- **Color coding** matching graph colors
- **Icons** for different node types
- **Search highlighting** in results

```typescript
// Color coding based on category
const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    gene: '#1f77b4',
    protein: '#f39c12',
    drug: '#e74c3c',
    disease: '#2ecc71',
    pathway: '#9b59b6',
    other: '#bdc3c7'
  };
  return colors[category] || colors.other;
};

// Icons for different types
const getTypeIcon = (type: string) => {
  const icons: Record<string, React.ComponentType> = {
    node: NodeIcon,
    category: CategoryIcon
  };
  return icons[type] || DefaultIcon;
};
```

### **Phase 4: Testing & Polish (1 hour)**

#### **4.1 Testing Strategy**
**Test Cases**:
1. **Basic @ detection** - Type `@` and see popup
2. **Node filtering** - Type `@TP` and see TP53
3. **Node selection** - Select node and verify ID insertion
4. **Category filtering** - Type `@gene` and see all genes
5. **Keyboard navigation** - Arrow keys, Enter, Escape
6. **Graph Mode detection** - Only works in Graph Mode
7. **Error handling** - No graph data, API failures

#### **4.2 Error Handling**
```typescript
// Handle API failures
try {
  const response = await fetch(`/api/graph/${conversationId}/state`);
  const result = await response.json();
  if (result.success && result.data) {
    setGraphData(result.data);
  }
} catch (error) {
  console.error('Error loading graph data:', error);
  // Show error state or fallback
}

// Handle empty graph
if (graphData.nodes.length === 0) {
  return (
    <div className="text-gray-500 text-sm px-3 py-2">
      No nodes available in current graph
    </div>
  );
}
```

#### **4.3 Performance Optimization**
```typescript
// Debounce graph data loading
const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);

useEffect(() => {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
  }
  
  const timeout = setTimeout(() => {
    loadGraphData();
  }, 300);
  
  setLoadingTimeout(timeout);
  
  return () => {
    if (timeout) clearTimeout(timeout);
  };
}, [conversationId]);

// Memoize filtered items
const filteredItems = useMemo(() => {
  return graphData.nodes.filter(node => 
    node.label.toLowerCase().includes(query.toLowerCase())
  );
}, [graphData.nodes, query]);
```

## 📊 **Implementation Timeline**

### **Phase 1: Core Infrastructure (3 hours)**
- **Hour 1**: Create `useGraphReference` hook
- **Hour 2**: Create `GraphReferencePopup` component
- **Hour 3**: Basic integration and testing

### **Phase 2: Chat Input Integration (2 hours)**
- **Hour 1**: Modify `ChatInput` component
- **Hour 2**: Graph Mode detection and conditional rendering

### **Phase 3: Enhanced Features (2 hours)**
- **Hour 1**: Smart node ID resolution
- **Hour 2**: Category filtering and visual enhancements

### **Phase 4: Testing & Polish (1 hour)**
- **Hour 1**: Error handling, performance optimization, testing

**Total Estimated Time**: 8 hours

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ **@ Detection**: System detects `@` in text input
- ✅ **Node List**: Shows all available nodes in popup
- ✅ **Node Selection**: User can select nodes from popup
- ✅ **ID Insertion**: Inserts actual node ID, not display name
- ✅ **Category Filtering**: Can filter by node categories
- ✅ **Graph Mode Only**: Only active in Graph Mode conversations
- ✅ **Keyboard Navigation**: Arrow keys, Enter, Escape work
- ✅ **Error Handling**: Graceful handling of API failures

### **User Experience Requirements**
- ✅ **Intuitive**: Easy to discover and use
- ✅ **Fast**: Quick response to user input
- ✅ **Visual**: Clear distinction between nodes and categories
- ✅ **Accessible**: Keyboard navigation support
- ✅ **Consistent**: Matches existing UI patterns

### **Technical Requirements**
- ✅ **Performance**: No lag in popup display
- ✅ **Memory**: No memory leaks from event listeners
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Error Handling**: Robust error handling
- ✅ **Testing**: Comprehensive test coverage

## 🔧 **File Structure**

### **New Files**
```
frontend-client/src/
├── hooks/
│   └── useGraphReference.ts          # Graph reference hook
├── components/
│   └── graphReference/
│       └── GraphReferencePopup.tsx   # Graph reference popup
└── types/
    └── graphReference.ts             # Type definitions
```

### **Modified Files**
```
frontend-client/src/components/chat/
└── ChatInput.tsx                     # Add graph reference integration
```

## 🚀 **Deployment Strategy**

### **Development Approach**
1. **Feature Flag**: Add feature flag to enable/disable
2. **Gradual Rollout**: Test with specific Graph Mode conversations
3. **Fallback**: Graceful degradation if system fails
4. **Monitoring**: Track usage and performance

### **Testing Strategy**
1. **Unit Tests**: Test hook and component logic
2. **Integration Tests**: Test with real graph data
3. **User Testing**: Test with actual Graph Mode conversations
4. **Performance Tests**: Test with large graphs

## 📚 **Related Documentation**

- **Main Plan**: `/docs/cursor-plans/README.PLAN.Graphmode2.md`
- **MCP Architecture**: `/custom-mcp-servers/graphModeMCPs/README.INFO.graphMode.MCP.md`
- **UI Reload Plan**: `/docs/cursor-plans/README.PLAN.graphMode.mcp_reloadUI.md`
- **Backend API**: `/backend-mcp-client/src/routes/graph.ts`
- **Frontend Viewer**: `/frontend-client/src/components/artifacts/GraphModeViewer.tsx`

## 🎉 **Expected Benefits**

### **For Users**
- **Easier Node Reference**: No need to remember exact node IDs
- **Visual Discovery**: See all available nodes and categories
- **Faster Operations**: Quick selection from popup
- **Reduced Errors**: Correct node IDs inserted automatically

### **For Developers**
- **Cleaner Architecture**: Reusable hook and component
- **Better UX**: Consistent with existing patterns
- **Extensible**: Easy to add new features
- **Maintainable**: Well-structured code

### **For System**
- **Reliability**: MCPs receive correct node IDs
- **Performance**: Efficient filtering and display
- **Scalability**: Works with any graph size
- **Integration**: Seamless with existing Graph Mode

---

**Created**: December 2024  
**Status**: 🚧 Ready for Implementation  
**Estimated Time**: 8 hours  
**Priority**: High (solves critical node ID mismatch issue)  
**Next Steps**: Start with Phase 1 (Core Infrastructure)
