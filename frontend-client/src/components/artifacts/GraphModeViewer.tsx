import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { GraphCanvas } from 'reagraph';
import { KnowledgeGraphData } from '@charm-mcp/shared';
import { useChatStore } from '../../store/chatStore';
import { ChevronDown, ChevronUp, Filter, Save, Pin, PinOff, Plus, Trash2, Undo, Redo, Settings } from 'lucide-react';
import { useMCPStore } from '../../store/mcpStore';

// --- Category normalization + color palette ---
const normalizeCategory = (value?: string) =>
  (value ?? 'other').toString().trim().toLowerCase();

const categoryColors: Record<string, string> = {
  gene:    '#1f77b4', // blue
  protein: '#f39c12', // orange
  drug:    '#e74c3c', // red
  disease: '#2ecc71', // green
  pathway: '#9b59b6', // purple
  other:   '#bdc3c7', // gray
};

interface GraphModeViewerProps {
  data: string | KnowledgeGraphData;
  width?: number;
  height?: number;
  artifactId?: string;
  showVersionControls?: boolean;
}

// Custom hook for managing search inputs
const useSearchInput = (initialValue = '') => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [inputKey, setInputKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const currentTarget = e.currentTarget;
    const cursorPosition = currentTarget.selectionStart;
    const newValue = e.target.value;
    
    setSearchTerm(newValue);
    
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (cursorPosition !== null) {
          inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    });
  }, []);
  
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setInputKey(prev => prev + 1);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, []);
  
  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, []);
  
  return {
    searchTerm,
    setSearchTerm,
    inputRef,
    inputKey,
    handleChange,
    clearSearch,
    focusInput
  };
};

export const GraphModeViewer: React.FC<GraphModeViewerProps> = ({ 
  data, 
  width = 800, 
  height = 600,
  artifactId,
  showVersionControls = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [parsedData, setParsedData] = useState<KnowledgeGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  
  // Graph Mode specific state
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [showAddNodeForm, setShowAddNodeForm] = useState(false);
  const [showAddEdgeForm, setShowAddEdgeForm] = useState(false);
  
  // Use selector functions to only subscribe to the specific state we need
  const getGraphVersionHistory = useChatStore(state => state.getGraphVersionHistory);
  const getLatestGraphVersion = useChatStore(state => state.getLatestGraphVersion);
  const selectArtifact = useChatStore(state => state.selectArtifact);
  const setPinnedGraphId = useChatStore(state => state.setPinnedGraphId);
  const getPinnedGraphId = useChatStore(state => state.getPinnedGraphId);
  const updateGraphArtifact = useChatStore(state => state.updateGraphArtifact);
  const updateChatInput = useChatStore(state => state.updateChatInput);
  
  // Get current conversation ID and messages for auto-reload
  const currentConversationId = useChatStore(state => state.currentConversationId);
  const messages = useChatStore(state => 
    currentConversationId ? state.conversations[currentConversationId]?.messages || [] : []
  );
  
  const isPinned = artifactId ? getPinnedGraphId() === artifactId : false;
  
  // New state for notification popup
  const [notification, setNotification] = useState<{ show: boolean; message: string }>({ 
    show: false, 
    message: '' 
  });
  
  // Entity type filter states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Record<string, boolean>>({});
  const [entityTypeCounts, setEntityTypeCounts] = useState<Record<string, number>>({});
  const [entityTypeColors, setEntityTypeColors] = useState<Record<string, string>>({});
  const typeSearchInput = useSearchInput();
  const typeFilterRef = useRef<HTMLDivElement>(null);
  
  // Node name filter states
  const [isNodeFilterOpen, setIsNodeFilterOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Record<string, boolean>>({});
  const [nodeNameCounts, setNodeNameCounts] = useState<Record<string, number>>({});
  const nodeSearchInput = useSearchInput();
  const nodeFilterRef = useRef<HTMLDivElement>(null);
  
  // Edge label filter states
  const [isEdgeFilterOpen, setIsEdgeFilterOpen] = useState(false);
  const [selectedEdgeLabels, setSelectedEdgeLabels] = useState<Record<string, boolean>>({});
  const [edgeLabelCounts, setEdgeLabelCounts] = useState<Record<string, number>>({});
  const edgeSearchInput = useSearchInput();
  const edgeFilterRef = useRef<HTMLDivElement>(null);
  
  const [filteredNodes, setFilteredNodes] = useState<any[]>([]);
  const [filteredEdges, setFilteredEdges] = useState<any[]>([]);

  // Helper function to get color based on entity group
  const getColorForGroup = (group: number): string => {
    const colors = [
      '#e74c3c', // Red - Group 1 (Gene)
      '#3498db', // Blue - Group 2 (Drug) 
      '#e67e22', // Orange - Group 3 (Disease)
      '#9b59b6', // Purple - Group 4 (Protein)
      '#2ecc71', // Green - Group 5 (Pathway)
      '#95a5a6'  // Gray - Group 6 (Other)
    ];
    return colors[group - 1] || colors[5]; // Default to gray for unknown groups
  };

  const getGroupForCategory = (category: string) => {
    const categoryMap: { [key: string]: number } = {
      'Gene': 1,
      'Protein': 2,
      'Disease': 3,
      'Drug': 4,
      'Pathway': 5,
      'Other': 6
    };
    return categoryMap[category] || 6;
  };

  // Color coding is now handled by Reagraph's clusterAttribute="category"

  // Parse the data if it's a string
  useEffect(() => {
    try {
      if (typeof data === 'string') {
        setParsedData(JSON.parse(data));
      } else {
        setParsedData(data);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to parse knowledge graph data:', err);
      setError('Failed to parse knowledge graph data. Please check the format.');
      setParsedData(null);
    }
  }, [data]);

  // Load graph data from database for Graph Mode conversations
  const loadGraphDataFromDatabase = useCallback(async () => {
    // Check if this is a Graph Mode conversation
    if (!currentConversationId) {
      console.log('No conversation ID available, skipping database load');
      return;
    }
    
    console.log('Loading graph data for conversation:', currentConversationId);

    try {
      console.log('Loading graph data from database for conversation:', currentConversationId);
      const response = await fetch(`/api/graph/${currentConversationId}/state`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log('📊 Graph data loaded from database:', {
            nodeCount: result.data.nodes?.length || 0,
            edgeCount: result.data.edges?.length || 0,
            nodeIds: result.data.nodes?.map((n: any) => n.id) || []
          });
          
          // Convert database format to knowledge graph format
          const graphData = {
            nodes: result.data.nodes.map((node: any) => {
              const category = normalizeCategory(node.data?.category || node.type);
              
              return {
                id: node.id, // Use canonical ID as primary ID
                name: node.label,
                canonicalId: node.id, // Store canonical ID
                category,
                group: getGroupForCategory(category),
                val: 15,  // Slightly larger for better visibility
                entityType: node.type,
                data: node.data // Put data in data field, not metadata
              };
            }),
            links: result.data.edges.map((edge: any) => ({
              source: edge.source,
              target: edge.target,
              label: edge.label,
              value: 1
            }))
          };
          
          console.log('Converted graph data:', graphData);
          console.log('Node IDs in converted data:', graphData.nodes.map((n: any) => ({ id: n.id, name: n.name, fill: n.fill, color: n.color })));
          console.log('Edge sources/targets:', graphData.links.map((e: any) => ({ source: e.source, target: e.target })));
          console.log('🎨 First node with color:', graphData.nodes[0]);
          setParsedData(graphData);
        }
      }
    } catch (error) {
      console.error('Error loading graph data from database:', error);
    }
  }, [currentConversationId]);

  useEffect(() => {
    // Load from database when conversation changes
    if (currentConversationId) {
      loadGraphDataFromDatabase();
    }
  }, [currentConversationId, loadGraphDataFromDatabase]);
  
  // Reload graph when new messages arrive (MCP responses) - Approach 2
  useEffect(() => {
    if (!currentConversationId) return;
    
    const unsubscribe = useChatStore.subscribe((state, prevState) => {
      const currentLoading = state.isLoading;
      const prevLoading = prevState.isLoading;
      
      // Only reload when loading changes from true to false (response complete)
      if (prevLoading === true && currentLoading === false) {
        console.log('🔄 MCP response complete, reloading graph data');
        loadGraphDataFromDatabase();
      }
    });
    
    return unsubscribe;
  }, [currentConversationId, loadGraphDataFromDatabase]);

  // Adjust dimensions based on container size
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setDimensions({
            width: rect.width,
            height: rect.height
          });
        }
      };

      updateDimensions();

      const resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });

      resizeObserver.observe(containerRef.current);
      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
      };
    }
  }, []);

  // Extract unique entity types from nodes
  const entityTypes = useMemo(() => {
    if (!parsedData || !parsedData.nodes) return [];
    
    const types = new Map<string, { count: number; color: string }>();
    
    parsedData.nodes.forEach(node => {
      const entityType = (node as any).entityType || 'Other';
      const color = (node as any).color || '#757575';
      
      if (types.has(entityType)) {
        const current = types.get(entityType)!;
        types.set(entityType, { 
          count: current.count + 1,
          color: current.color
        });
      } else {
        types.set(entityType, { count: 1, color });
      }
    });
    
    return Array.from(types.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([type, { count, color }]) => ({ type, count, color }));
  }, [parsedData]);

  // Extract unique node names
  const nodeNames = useMemo(() => {
    if (!parsedData || !parsedData.nodes) return [];
    
    const names = new Map<string, number>();
    
    parsedData.nodes.forEach(node => {
      const name = node.name;
      names.set(name, (names.get(name) || 0) + 1);
    });
    
    return Array.from(names.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [parsedData]);

  // Extract unique edge labels
  const edgeLabels = useMemo(() => {
    if (!parsedData || !parsedData.links) return [];
    
    const labels = new Map<string, number>();
    
    if (parsedData.links) {
      parsedData.links.forEach(link => {
        const label = link.label || 'No Label';
        labels.set(label, (labels.get(label) || 0) + 1);
      });
    }
    
    return Array.from(labels.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
  }, [parsedData]);

  // Initialize selected entity types when entity types are extracted
  useEffect(() => {
    if (entityTypes.length > 0) {
      const initialSelectedTypes: Record<string, boolean> = {};
      const typeCounts: Record<string, number> = {};
      const typeColors: Record<string, string> = {};
      
      entityTypes.forEach(({ type, count, color }) => {
        initialSelectedTypes[type] = true;
        typeCounts[type] = count;
        typeColors[type] = color;
      });
      
      setSelectedEntityTypes(initialSelectedTypes);
      setEntityTypeCounts(typeCounts);
      setEntityTypeColors(typeColors);
    }
  }, [entityTypes]);

  // Initialize selected node names when node names are extracted
  useEffect(() => {
    if (nodeNames.length > 0) {
      const initialSelectedNodes: Record<string, boolean> = {};
      const counts: Record<string, number> = {};
      
      nodeNames.forEach(({ name, count }) => {
        initialSelectedNodes[name] = true;
        counts[name] = count;
      });
      
      setSelectedNodes(initialSelectedNodes);
      setNodeNameCounts(counts);
    }
  }, [nodeNames]);

  // Initialize selected edge labels when edge labels are extracted
  useEffect(() => {
    if (edgeLabels.length > 0) {
      const initialSelectedLabels: Record<string, boolean> = {};
      const counts: Record<string, number> = {};
      
      edgeLabels.forEach(({ label, count }) => {
        initialSelectedLabels[label] = true;
        counts[label] = count;
      });
      
      setSelectedEdgeLabels(initialSelectedLabels);
      setEdgeLabelCounts(counts);
    }
  }, [edgeLabels]);

  // Transform the data to reagraph format
  const graphData = useMemo(() => {
    if (!parsedData || !parsedData.nodes) return { nodes: [], edges: [] };

    // Convert nodes (preserve custom fill if present; otherwise compute from category)
    const nodes = parsedData.nodes.map((raw: any) => {
      const category = normalizeCategory(raw.category || raw.entityType || 'other');
      const fill = raw.fill ?? categoryColors[category] ?? categoryColors.other;

      const node = {
        id: raw.id,
        label: raw.name || raw.id,
        size: raw.val ?? 10,
        entityType: raw.entityType,
        category,                 // normalized, consistent category
        startingId: raw.startingId,
        metadata: raw.metadata,
        isStartingNode: raw.isStartingNode,
        fill,                     // <<< CRITICAL: carry fill into GraphCanvas
        fx: undefined as number | undefined,
        fy: undefined as number | undefined,
      };

      return node;
    });

    // Check if we have exactly 2 starting nodes (connecting path scenario)
    const startingNodes = nodes.filter(node => node.isStartingNode);
    if (startingNodes.length === 2) {
      startingNodes[0].fx = -200;
      startingNodes[0].fy = 0;
      startingNodes[1].fx = 200;
      startingNodes[1].fy = 0;
    }

    // Convert edges
    let edges: any[] = [];
    if (parsedData.links) {
      edges = parsedData.links.map((link: any, index: number) => ({
        id: `${link.source}-${link.target}-${index}`,
        source: link.source,
        target: link.target,
        label: link.label?.replace('biolink:', '') || '',
        color: '#888',
        size: Math.max(1, link.value || 1)
      }));
    }

    return { nodes, edges };
  }, [parsedData]);

  // Apply filters when selections change
  useEffect(() => {
    if (!parsedData || !parsedData.nodes) return;
    
    const nodes = graphData.nodes.filter(node => {
      const entityType = node.entityType || 'Other';
      const nodeName = node.label;
      
      return (
        (selectedEntityTypes[entityType] || false) && 
        (selectedNodes[nodeName] || false)
      );
    });
    
    const nodeIds = new Set(nodes.map(node => node.id));
    
    const edges = graphData.edges.filter(edge => {
      const edgeLabel = edge.label || 'No Label';
      
      return (
        (selectedEdgeLabels[edgeLabel] || false) &&
        nodeIds.has(edge.source) && 
        nodeIds.has(edge.target)
      );
    });
    
    setFilteredNodes(nodes);
    setFilteredEdges(edges);
  }, [parsedData, graphData, selectedEntityTypes, selectedNodes, selectedEdgeLabels]);

  // Graph Mode specific handlers
  const handleAddNode = useCallback(() => {
    setShowAddNodeForm(true);
  }, []);

  const handleAddEdge = useCallback(() => {
    setShowAddEdgeForm(true);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    // TODO: Implement node deletion via MCP
    console.log('Delete node:', nodeId);
  }, []);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    // TODO: Implement edge deletion via MCP
    console.log('Delete edge:', edgeId);
  }, []);

  const handleUndo = useCallback(() => {
    // TODO: Implement undo functionality
    console.log('Undo');
  }, []);

  const handleRedo = useCallback(() => {
    // TODO: Implement redo functionality
    console.log('Redo');
  }, []);

  // Add cancer research data handler
  const handleAddCancerData = useCallback(async () => {
    console.log('🧬 CANCER DATA BUTTON CLICKED! 🧬');
    console.log('Artifact ID:', artifactId);
    
    const currentConversationId = useChatStore.getState().currentConversationId;
    if (!currentConversationId) {
      console.error('No conversation ID available');
      return;
    }
    
    console.log('Adding cancer research data to graph...');
    console.log('Current conversation ID:', currentConversationId);
    
    try {
      console.log('Making request to:', `/api/graph/${currentConversationId}/mock-data`);
      console.log('Request method: POST');
      console.log('Request headers:', { 'Content-Type': 'application/json' });
      
      const response = await fetch(`/api/graph/${currentConversationId}/mock-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataset: 'cancer' })
      });
      
      console.log('Response received:', response);
      console.log('Response status:', response.status);
      console.log('Response status text:', response.statusText);
      
      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Cancer data response:', result);
      
      if (result.success) {
        console.log('✅ Cancer data added successfully!');
        // Show success notification
        setNotification({ show: true, message: 'Cancer research data added successfully!' });
        setTimeout(() => setNotification({ show: false, message: '' }), 3000);
        
        // Refresh the graph data
        try {
          const stateResponse = await fetch(`/api/graph/${currentConversationId}/state`);
          if (stateResponse.ok) {
            const stateData = await stateResponse.json();
            console.log('Updated graph state:', stateData);
            
            if (stateData.success && stateData.data) {
              // Convert database format to knowledge graph format
              const graphData = {
                nodes: stateData.data.nodes.map((node: any) => {
                  const category = normalizeCategory(node.data?.category || node.type);
                  return {
                    id: node.id, // Use canonical ID as primary ID
                    name: node.label,
                    canonicalId: node.id, // Store canonical ID
                    category,
                    group: getGroupForCategory(category),
                    val: 15,  // Slightly larger for better visibility
                    entityType: node.type,
                    metadata: node.data
                  };
                }),
                links: stateData.data.edges.map((edge: any) => ({
                  source: edge.source,
                  target: edge.target,
                  label: edge.label,
                  value: 1
                }))
              };
              
              console.log('Updating graph display with new cancer data:', graphData);
              console.log('Node IDs in updated data:', graphData.nodes.map((n: any) => ({ id: n.id, name: n.name })));
              console.log('Edge sources/targets in updated data:', graphData.links.map((e: any) => ({ source: e.source, target: e.target })));
              setParsedData(graphData);
            }
          }
        } catch (fetchError) {
          console.error('Error fetching updated graph state:', fetchError);
        }
      } else {
        console.error('❌ Failed to add cancer data:', result.error);
        setNotification({ show: true, message: `Failed to add cancer data: ${result.error}` });
        setTimeout(() => setNotification({ show: false, message: '' }), 5000);
      }
    } catch (error) {
      console.error('Error adding cancer data:', error);
      setNotification({ show: true, message: `Error adding cancer data: ${error instanceof Error ? error.message : 'Unknown error'}` });
      setTimeout(() => setNotification({ show: false, message: '' }), 5000);
    }
  }, [artifactId, setNotification]);

  // Add mock data handler
  const handleAddMockData = useCallback(async () => {
    console.log('🔥 MOCK DATA BUTTON CLICKED! 🔥');
    console.log('Artifact ID:', artifactId);
    
    if (!artifactId) {
      console.error('No artifact ID available');
      return;
    }
    
    try {
      console.log('Adding mock data to graph...');
      
      // Get conversation ID from the current conversation
      const currentConversationId = useChatStore.getState().currentConversationId;
      console.log('Current conversation ID:', currentConversationId);
      
      if (!currentConversationId) {
        console.error('No current conversation ID');
        return;
      }
      
      const requestUrl = `/api/graph/${currentConversationId}/mock-data`;
      console.log('Making request to:', requestUrl);
      console.log('Request method: POST');
      console.log('Request headers:', { 'Content-Type': 'application/json' });
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response received:', response);
      console.log('Response status:', response.status);
      console.log('Response status text:', response.statusText);
      
      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('Response is OK, parsing JSON...');
      const result = await response.json();
      console.log('Parsed response:', result);
      
      if (result.success) {
        console.log('✅ Mock data added successfully:', result.data);
        
        // Show notification
        setNotification({
          show: true,
          message: 'Mock data added successfully!'
        });
        
        setTimeout(() => {
          setNotification({ show: false, message: '' });
        }, 3000);
        
        // Fetch the updated graph data from the database
        console.log('Fetching updated graph data from database...');
        try {
          const stateResponse = await fetch(`/api/graph/${currentConversationId}/state`);
          if (stateResponse.ok) {
            const stateData = await stateResponse.json();
            console.log('Updated graph state:', stateData);
            
            if (stateData.success && stateData.data) {
                  // Convert database format to knowledge graph format
                  const graphData = {
                    nodes: stateData.data.nodes.map((node: any) => {
                      const category = normalizeCategory(node.data?.category || node.type);
                      
                      return {
                        id: node.id, // Use canonical ID as primary ID
                        name: node.label,
                        canonicalId: node.id, // Store canonical ID
                        category,
                        group: getGroupForCategory(category),
                        val: 15,  // Slightly larger for better visibility
                        entityType: node.type,
                        data: node.data // Put data in data field, not metadata
                      };
                    }),
                links: stateData.data.edges.map((edge: any) => ({
                  source: edge.source,
                  target: edge.target,
                  label: edge.label,
                  value: 1
                }))
              };
              
              console.log('Updating graph display with new data:', graphData);
              console.log('Node IDs in updated data:', graphData.nodes.map((n: any) => ({ id: n.id, name: n.name })));
              console.log('Edge sources/targets in updated data:', graphData.links.map((e: any) => ({ source: e.source, target: e.target })));
              setParsedData(graphData);
            }
          }
        } catch (fetchError) {
          console.error('Error fetching updated graph state:', fetchError);
        }
      } else {
        console.error('❌ Failed to add mock data:', result.error);
        console.error('Full error response:', result);
        setNotification({
          show: true,
          message: `Error: ${result.error}`
        });
        
        setTimeout(() => {
          setNotification({ show: false, message: '' });
        }, 5000);
      }
    } catch (error) {
      console.error('Error adding mock data:', error);
      setNotification({
        show: true,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      setTimeout(() => {
        setNotification({ show: false, message: '' });
      }, 5000);
    }
  }, [artifactId]);

  // Handle node click with Control/Command key detection
  const handleNodeClick = (node: any, props?: any, event?: any) => {
    if (event && (event.ctrlKey || event.metaKey)) {
      const nodeInfo = [
        `${node.label} (${node.id})`,
        node.entityType ? `Type: ${node.entityType}` : '',
        node.startingId ? `Original IDs: ${node.startingId.join(', ')}` : '',
        node.metadata?.description ? `Description: ${node.metadata.description}` : ''
      ].filter(Boolean).join('\n');
      
      updateChatInput(nodeInfo, true);
      
      if (artifactId && !isPinned) {
        setPinnedGraphId(artifactId);
      }
      
      setNotification({
        show: true,
        message: `Graph pinned! Node information added to chat input.`
      });
      
      setTimeout(() => {
        setNotification({ show: false, message: '' });
      }, 3000);
    }
    
    console.log('Node clicked:', node);
  };

  // Notification popup component
  const NotificationPopup = () => {
    if (!notification.show) return null;
    
    return (
      <div className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in-out">
        {notification.message}
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-300">
        <h3 className="font-bold mb-2">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!parsedData) {
    return (
      <div className="p-4 bg-gray-50 text-gray-500 rounded-md border border-gray-300">
        Loading knowledge graph...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Graph Mode Toolbar */}
      <div className="flex items-center justify-between p-2 bg-purple-100 dark:bg-purple-900/20 rounded mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
            Graph Mode
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                isEditMode 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isEditMode ? 'Exit Edit' : 'Edit Mode'}
            </button>
            
            {isEditMode && (
              <>
                <button
                  onClick={handleAddNode}
                  className="flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm"
                >
                  <Plus size={14} />
                  Add Node
                </button>
                <button
                  onClick={handleAddEdge}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                >
                  <Plus size={14} />
                  Add Edge
                </button>
              </>
            )}
            
            <button
              onClick={handleAddMockData}
              className="flex items-center gap-1 px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm"
              title="Add diabetes/obesity mock data for testing"
            >
              <Plus size={14} />
              Add Test Data
            </button>
            
            <button
              onClick={handleAddCancerData}
              className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
              title="Add cancer research mock data for testing"
            >
              <Plus size={14} />
              Add Cancer Data
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="Undo"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={handleRedo}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="Redo"
          >
            <Redo size={16} />
          </button>
          
          {artifactId && (
            <button
              onClick={() => {
                if (artifactId) {
                  setPinnedGraphId(isPinned ? null : artifactId);
                }
              }}
              className={`p-2 rounded-full ${
                isPinned 
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
              title={isPinned ? "Unpin graph (stop sending with messages)" : "Pin graph (send with messages)"}
            >
              {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
            </button>
          )}
        </div>
      </div>
      
      <div ref={containerRef} className="w-full h-full flex-grow relative" style={{ minWidth: '900px' }}>
        <NotificationPopup />
        <div className="absolute bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-md opacity-70 z-40 pointer-events-none">
          Ctrl/Cmd + Click on a node to add it to chat
        </div>
        <GraphCanvas
          nodes={filteredNodes.length ? filteredNodes : graphData.nodes}
          edges={filteredEdges.length ? filteredEdges : graphData.edges}
          layoutType="forceDirected2d"
          draggable
          labelType="all"
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
};
