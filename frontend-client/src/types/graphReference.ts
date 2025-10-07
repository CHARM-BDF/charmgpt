export interface GraphItem {
  id: string;           // Database node ID (e.g., "NCBIGene:7157")
  name: string;         // Display name (e.g., "TP53")
  category: string;     // Node category (e.g., "gene")
  type: 'node' | 'category';
  nodeCount?: number;   // For categories, number of nodes in that category
}

export interface GraphReferenceState {
  isActive: boolean;
  query: string;
  position: { x: number; y: number } | null;
  selectedItem: GraphItem | null;
}

export interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    data?: any;
  }>;
  categories: string[];
}

export interface UseGraphReferenceProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  conversationId: string | null;
  onItemSelect: (item: GraphItem, position: number) => void;
}

export interface UseGraphReferenceReturn {
  graphRefState: GraphReferenceState;
  handleInputChange: (text: string) => void;
  handleItemSelect: (item: GraphItem) => void;
  closeGraphRef: () => void;
  graphData: GraphData;
  loading: boolean;
  error: string | null;
}
