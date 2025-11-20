export interface SelectedGraphItems {
  nodes: Array<{ id: string; name: string; type: string }>;
  edges: Array<{ source: string; target: string; label: string }>;
}

export interface GraphToolsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  onAddToChat: (selectedItems: SelectedGraphItems) => void;
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
}

export interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    entityType?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label: string;
  }>;
}
