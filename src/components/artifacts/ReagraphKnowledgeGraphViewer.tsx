import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { GraphCanvas } from 'reagraph';
import { KnowledgeGraphData } from '../../types/knowledgeGraph';
import { useChatStore } from '../../store/chatStore';
import {  ChevronDown, ChevronUp, Filter, Save, Pin, PinOff } from 'lucide-react';
import { useMCPStore } from '../../store/mcpStore';

interface ReagraphKnowledgeGraphViewerProps {
  data: string | KnowledgeGraphData; // Accept either JSON string or parsed object
  width?: number;
  height?: number;
  artifactId?: string; // Add this to track the artifact
  showVersionControls?: boolean; // Option to show/hide version controls
}

// Custom hook for managing search inputs
const useSearchInput = (initialValue = '') => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [inputKey, setInputKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use a more direct approach to maintain focus
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const currentTarget = e.currentTarget;
    const cursorPosition = currentTarget.selectionStart;
    const newValue = e.target.value;
    
    console.log('Search input changed:', newValue, 'Cursor at:', cursorPosition);
    
    // Update the state
    setSearchTerm(newValue);
    
    // Force focus to remain on the input and restore cursor position
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
    console.log('Clearing search term');
    setSearchTerm('');
    // Force re-render of input by changing key
    setInputKey(prev => prev + 1);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, []);
  
  const focusInput = useCallback(() => {
    console.log('Focusing input');
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

export const ReagraphKnowledgeGraphViewer: React.FC<ReagraphKnowledgeGraphViewerProps> = ({ 
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
  
  // Use selector functions to only subscribe to the specific state we need
  const getGraphVersionHistory = useChatStore(state => state.getGraphVersionHistory);
  const getLatestGraphVersion = useChatStore(state => state.getLatestGraphVersion);
  const selectArtifact = useChatStore(state => state.selectArtifact);
  const setPinnedGraphId = useChatStore(state => state.setPinnedGraphId);
  const getPinnedGraphId = useChatStore(state => state.getPinnedGraphId);
  const updateGraphArtifact = useChatStore(state => state.updateGraphArtifact);
  const updateChatInput = useChatStore(state => state.updateChatInput);
  
  // Workspace state and functions
  const masterGraphWorkspace = useChatStore(state => state.masterGraphWorkspace);
  const createMasterGraphWorkspace = useChatStore(state => state.createMasterGraphWorkspace);
  const addGraphToWorkspace = useChatStore(state => state.addGraphToWorkspace);
  const removeGraphFromWorkspace = useChatStore(state => state.removeGraphFromWorkspace);
  
  const isPinned = artifactId ? getPinnedGraphId() === artifactId : false;
  
  // Workspace button states
  const isWorkspaceActive = masterGraphWorkspace?.isActive || false;
  const isGraphIncluded = isWorkspaceActive && artifactId && masterGraphWorkspace?.includedGraphs.includes(artifactId);
  const isGraphExcluded = isWorkspaceActive && artifactId && masterGraphWorkspace?.excludedGraphs.includes(artifactId);
  
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

      // Initial update
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
    if (!parsedData) return [];
    
    const types = new Map<string, { count: number; color: string }>();
    
    parsedData.nodes.forEach(node => {
      // Access entityType from the node object
      const entityType = (node as any).entityType || 'Other';
      const color = (node as any).color || '#757575'; // Default gray color
      
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
    
    // Convert to array and sort by count (descending)
    return Array.from(types.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([type, { count, color }]) => ({ type, count, color }));
  }, [parsedData]);

  // Extract unique node names
  const nodeNames = useMemo(() => {
    if (!parsedData) return [];
    
    const names = new Map<string, number>();
    
    parsedData.nodes.forEach(node => {
      const name = node.name;
      names.set(name, (names.get(name) || 0) + 1);
    });
    
    // Convert to array and sort alphabetically
    return Array.from(names.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [parsedData]);

  // Extract unique edge labels
  const edgeLabels = useMemo(() => {
    if (!parsedData) return [];
    
    const labels = new Map<string, number>();
    
    parsedData.links.forEach(link => {
      const label = link.label || 'No Label';
      labels.set(label, (labels.get(label) || 0) + 1);
    });
    
    // Convert to array and sort by count (descending)
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

  // Helper function to count edges for each node
  const calculateNodeSizes = (nodes: any[], edges: any[]): Map<string, number> => {
    const edgeCounts = new Map<string, number>();
    
    // Count edges for each node
    edges.forEach(edge => {
      edgeCounts.set(edge.source, (edgeCounts.get(edge.source) || 0) + 1);
      edgeCounts.set(edge.target, (edgeCounts.get(edge.target) || 0) + 1);
    });
    
    return edgeCounts;
  };

  // Helper function to calculate node size based on edge count
  const getNodeSizeFromEdgeCount = (edgeCount: number): number => {
    // Bucket-based sizing similar to edge width scaling
    if (edgeCount >= 20) return 25;      // Highly connected nodes
    else if (edgeCount >= 15) return 20; // Well connected nodes
    else if (edgeCount >= 10) return 15; // Moderately connected nodes
    else if (edgeCount >= 5) return 12;  // Somewhat connected nodes
    else if (edgeCount >= 2) return 10;  // Few connections
    else return 8;                       // Minimal connections (including isolated nodes)
  };

  // Transform the data to reagraph format with filtering and dynamic sizing
  const graphData = useMemo(() => {
    if (!parsedData) return { nodes: [], edges: [] };

    // Sanitize and validate all node data to prevent NaN values
    const sanitizedNodes = parsedData.nodes.map(node => {
      // Most knowledge graph nodes don't have position data - this is normal
      const hasValidPosition = typeof node.x === 'number' && !isNaN(node.x) && 
                              typeof node.y === 'number' && !isNaN(node.y);
      
      return {
        ...node,
        // Generate random positions for nodes that don't have position data (most nodes)
        x: hasValidPosition ? node.x : Math.random() * 1000 - 500,
        y: hasValidPosition ? node.y : Math.random() * 1000 - 500,
        z: typeof node.z === 'number' && !isNaN(node.z) ? node.z : 0,
        // Ensure other numeric properties are valid
        val: typeof node.val === 'number' && !isNaN(node.val) ? node.val : 1,
        connections: typeof node.connections === 'number' && !isNaN(node.connections) ? node.connections : 0,
        // Ensure fx and fy are either undefined or valid numbers
        fx: node.fx !== undefined && typeof node.fx === 'number' && !isNaN(node.fx) ? node.fx : undefined,
        fy: node.fy !== undefined && typeof node.fy === 'number' && !isNaN(node.fy) ? node.fy : undefined,
      };
    });

    // Sanitize edge data
    const sanitizedEdges = parsedData.links.map(edge => ({
      ...edge,
      // Ensure edge value is valid
      value: typeof edge.value === 'number' && !isNaN(edge.value) ? edge.value : 1,
    }));

    // Debug: Log summary of sanitized data
    if (sanitizedNodes.length > 0) {
      const nodesWithPositions = sanitizedNodes.filter(node => 
        typeof node.x === 'number' && !isNaN(node.x) && 
        typeof node.y === 'number' && !isNaN(node.y)
      ).length;
      
      console.log(`Graph data sanitized: ${sanitizedNodes.length} nodes, ${nodesWithPositions} had positions, ${sanitizedNodes.length - nodesWithPositions} got random positions`);
    }

    // Apply filters first
    const filteredEdges = sanitizedEdges.filter(link => {
      const sourceNode = sanitizedNodes.find(n => n.id === link.source);
      const targetNode = sanitizedNodes.find(n => n.id === link.target);
      
      if (!sourceNode || !targetNode) return false;
      
      const sourceEntityType = sourceNode.entityType || 'Other';
      const targetEntityType = targetNode.entityType || 'Other';
      const sourceNodeName = sourceNode.name || sourceNode.id;
      const targetNodeName = targetNode.name || targetNode.id;
      const edgeLabel = link.label?.replace('biolink:', '') || 'No Label';
      
      return (
        selectedEntityTypes[sourceEntityType] !== false &&
        selectedEntityTypes[targetEntityType] !== false &&
        selectedNodes[sourceNodeName] !== false &&
        selectedNodes[targetNodeName] !== false &&
        selectedEdgeLabels[edgeLabel] !== false
      );
    });

    const filteredNodes = sanitizedNodes.filter(node => {
      const entityType = node.entityType || 'Other';
      const nodeName = node.name || node.id;
      
      return (
        selectedEntityTypes[entityType] !== false &&
        selectedNodes[nodeName] !== false
      );
    });

    // Get the IDs of nodes that have edges after filtering
    const connectedNodeIds = new Set<string>();
    filteredEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    // Filter out nodes that have no edges (disconnected nodes)
    const connectedNodes = filteredNodes.filter(node => 
      connectedNodeIds.has(node.id)
    );

    // Calculate edge counts for filtered data
    const edgeCounts = calculateNodeSizes(connectedNodes, filteredEdges);

    // Convert nodes with dynamic sizing
    const nodes = connectedNodes.map((node: any) => ({
      id: node.id,
      label: node.name || node.id,
      color: getColorForGroup(node.group),
      size: getNodeSizeFromEdgeCount(edgeCounts.get(node.id) || 0),
      entityType: node.entityType,
      startingId: node.startingId,
      metadata: node.metadata,
      isStartingNode: node.isStartingNode,
      fx: undefined as number | undefined, // Fixed x position
      fy: undefined as number | undefined  // Fixed y position
    }));

    // Check if we have exactly 2 starting nodes (connecting path scenario)
    const startingNodes = nodes.filter(node => node.isStartingNode);
    if (startingNodes.length === 2) {
      // Position starting nodes on opposite sides
      startingNodes[0].fx = -200; // Fixed x position (left side)
      startingNodes[0].fy = 0;    // Center vertically
      startingNodes[1].fx = 200;  // Fixed x position (right side)  
      startingNodes[1].fy = 0;    // Center vertically
    }

    // Convert edges
    const edges = filteredEdges.map((link: any, index: number) => ({
      id: `${link.source}-${link.target}-${index}`,
      source: link.source,
      target: link.target,
      label: link.label?.replace('biolink:', '') || '',
      color: '#888',
      size: Math.max(1, link.value || 1)
    }));

    return { nodes, edges };
  }, [parsedData, selectedEntityTypes, selectedNodes, selectedEdgeLabels]);


  // Toggle all entity types
  const toggleAllEntityTypes = (value: boolean) => {
    const updatedTypes = { ...selectedEntityTypes };
    Object.keys(updatedTypes).forEach(type => {
      updatedTypes[type] = value;
    });
    setSelectedEntityTypes(updatedTypes);
  };
  
  // Toggle all node names
  const toggleAllNodes = (value: boolean) => {
    const updatedNodes = { ...selectedNodes };
    Object.keys(updatedNodes).forEach(name => {
      updatedNodes[name] = value;
    });
    setSelectedNodes(updatedNodes);
  };
  
  // Toggle all edge labels
  const toggleAllEdgeLabels = (value: boolean) => {
    const updatedLabels = { ...selectedEdgeLabels };
    Object.keys(updatedLabels).forEach(label => {
      updatedLabels[label] = value;
    });
    setSelectedEdgeLabels(updatedLabels);
  };

  // Toggle filtered entity types
  const toggleFilteredEntityTypes = (value: boolean) => {
    if (!typeSearchInput.searchTerm) {
      toggleAllEntityTypes(value);
      return;
    }
    
    const updatedTypes = { ...selectedEntityTypes };
    entityTypes
      .filter(({ type }) => type.toLowerCase().includes(typeSearchInput.searchTerm.toLowerCase()))
      .forEach(({ type }) => {
        updatedTypes[type] = value;
      });
    
    setSelectedEntityTypes(updatedTypes);
  };
  
  // Toggle filtered node names
  const toggleFilteredNodes = (value: boolean) => {
    if (!nodeSearchInput.searchTerm) {
      toggleAllNodes(value);
      return;
    }
    
    const updatedNodes = { ...selectedNodes };
    nodeNames
      .filter(({ name }) => name.toLowerCase().includes(nodeSearchInput.searchTerm.toLowerCase()))
      .forEach(({ name }) => {
        updatedNodes[name] = value;
      });
    
    setSelectedNodes(updatedNodes);
  };
  
  // Toggle filtered edge labels
  const toggleFilteredEdgeLabels = (value: boolean) => {
    if (!edgeSearchInput.searchTerm) {
      toggleAllEdgeLabels(value);
      return;
    }
    
    const updatedLabels = { ...selectedEdgeLabels };
    edgeLabels
      .filter(({ label }) => label.toLowerCase().includes(edgeSearchInput.searchTerm.toLowerCase()))
      .forEach(({ label }) => {
        updatedLabels[label] = value;
      });
    
    setSelectedEdgeLabels(updatedLabels);
  };

  // Workspace button handlers
  const handleMakeWorkspace = () => {
    createMasterGraphWorkspace();
    // Automatically add current graph to workspace
    if (artifactId && parsedData) {
      try {
        addGraphToWorkspace(artifactId, parsedData);
      } catch (error) {
        console.error('Failed to add graph to workspace:', error);
      }
    }
  };

  const handleAddToWorkspace = () => {
    if (artifactId && parsedData) {
      try {
        addGraphToWorkspace(artifactId, parsedData);
      } catch (error) {
        console.error('Failed to add graph to workspace:', error);
      }
    }
  };

  const handleRemoveFromWorkspace = () => {
    if (artifactId) {
      removeGraphFromWorkspace(artifactId);
    }
  };

  // Save filtered view as a new version
  const saveFilteredView = () => {
    if (!artifactId || !graphData.nodes.length) return;
    
    try {
      console.log('Saving filtered view for artifact:', artifactId);
      
      // Get the latest version of the graph artifact
      const latestVersion = getLatestGraphVersion(artifactId);
      
      if (!latestVersion) {
        console.error('Cannot find latest version of graph:', artifactId);
        return;
      }
      
      const latestArtifactId = latestVersion.id;
      console.log('Using latest version ID:', latestArtifactId);
      
      // Convert Reagraph nodes back to KnowledgeGraph nodes
      const nodes = graphData.nodes.map(node => ({
        id: node.id,
        name: node.label,
        ...node.data,
        color: node.color
      }));
      
      // Convert Reagraph edges back to KnowledgeGraph links
      const links = graphData.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        label: edge.label,
        ...edge.data,
        color: edge.color
      }));
      
      // Use the MCPStore's handleGraphCommand which handles both types of knowledge graph artifacts
      const { handleGraphCommand } = useMCPStore.getState();
      
      handleGraphCommand({
        type: 'filterNodes',
        targetGraphId: latestArtifactId,
        params: { 
          customNodes: nodes,
          customLinks: links,
          selectedEntityTypes,
          selectedNodes,
          selectedEdgeLabels
        }
      }).then(success => {
        if (success) {
          console.log('Successfully saved filtered view');
        } else {
          console.error('Failed to save filtered view');
          // Could add UI feedback here
        }
      });
    } catch (error) {
      console.error('Error saving filtered view:', error);
    }
  };

  // Version navigation UI component
  const VersionControls = () => {
    if (!artifactId || !showVersionControls) return null;
    
    const versions = getGraphVersionHistory(artifactId);
    // Only log in development mode
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('Version history for artifact:', {
    //     artifactId,
    //     versionsCount: versions.length,
    //     versions: versions.map(v => ({
    //       id: v.id,
    //       title: v.title,
    //       versionNumber: v.versionNumber,
    //       previousVersionId: v.previousVersionId,
    //       nextVersionId: v.nextVersionId
    //     }))
    //   });
    // }
    
    if (versions.length <= 1) return null;
    
    const currentIndex = versions.findIndex(v => v.id === artifactId);
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('Current version index:', currentIndex, 'out of', versions.length);
    }
    
    const isLatest = currentIndex === versions.length - 1;
    
    return (
      <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded">
        <span className="text-sm text-gray-600">
          Version {currentIndex + 1} of {versions.length}
        </span>
        
        <button 
          disabled={currentIndex === 0}
          className="px-2 py-1 bg-white rounded border disabled:opacity-50"
          onClick={() => {
            if (currentIndex > 0) {
              selectArtifact(versions[currentIndex - 1].id);
            }
          }}
        >
          Previous
        </button>
        
        <button
          disabled={isLatest}
          className="px-2 py-1 bg-white rounded border disabled:opacity-50"
          onClick={() => {
            if (!isLatest) {
              selectArtifact(versions[currentIndex + 1].id);
            }
          }}
        >
          Next
        </button>
        
        {!isLatest && (
          <button
            className="px-2 py-1 bg-blue-500 text-white rounded"
            onClick={() => {
              const latest = getLatestGraphVersion(artifactId);
              if (latest) selectArtifact(latest.id);
            }}
          >
            Latest
          </button>
        )}
      </div>
    );
  };

  // Entity Type Filter component
  const EntityTypeFilter = () => {
    if (!entityTypes.length) return null;
    
    const allSelected = Object.values(selectedEntityTypes).every(value => value);
    const someSelected = Object.values(selectedEntityTypes).some(value => value);
    
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFilterOpen(!isFilterOpen);
          }}
          className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Filter size={16} />
          <span className="text-sm">Filter by Entity Type</span>
          {Object.values(selectedEntityTypes).filter(Boolean).length !== entityTypes.length && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
              {Object.values(selectedEntityTypes).filter(Boolean).length}/{entityTypes.length}
            </span>
          )}
          {isFilterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isFilterOpen && (
          <div ref={typeFilterRef} className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative mb-2">
                <input
                  key={typeSearchInput.inputKey}
                  type="text"
                  placeholder="Search entity types..."
                  value={typeSearchInput.searchTerm}
                  onChange={typeSearchInput.handleChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white pr-8"
                  ref={typeSearchInput.inputRef}
                  autoFocus
                />
                {typeSearchInput.searchTerm && (
                  <button
                    onClick={typeSearchInput.clearSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleAllEntityTypes(!allSelected);
                    }}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
                <div className="flex space-x-2">
                  {typeSearchInput.searchTerm && (
                    <button
                      onClick={() => toggleFilteredEntityTypes(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Select Filtered
                    </button>
                  )}
                  <button
                    onClick={() => toggleAllEntityTypes(false)}
                    className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {entityTypes
                .filter(({ type }) => 
                  type.toLowerCase().includes(typeSearchInput.searchTerm.toLowerCase())
                )
                .map(({ type, count, color }) => (
                <label key={type} className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedEntityTypes[type] || false}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedEntityTypes({
                        ...selectedEntityTypes,
                        [type]: !selectedEntityTypes[type]
                      });
                    }}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm">{type === 'Other' ? '(Other)' : type}</span>
                  <span className="text-xs text-gray-500 ml-auto">({count})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Node Name Filter component
  const NodeNameFilter = () => {
    if (!nodeNames.length) return null;
    
    const allSelected = Object.values(selectedNodes).every(value => value);
    const someSelected = Object.values(selectedNodes).some(value => value);
    
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsNodeFilterOpen(!isNodeFilterOpen);
          }}
          className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Filter size={16} />
          <span className="text-sm">Filter by Node Name</span>
          {Object.values(selectedNodes).filter(Boolean).length !== nodeNames.length && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
              {Object.values(selectedNodes).filter(Boolean).length}/{nodeNames.length}
            </span>
          )}
          {isNodeFilterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isNodeFilterOpen && (
          <div ref={nodeFilterRef} className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative mb-2">
                <input
                  key={nodeSearchInput.inputKey}
                  type="text"
                  placeholder="Search node names..."
                  value={nodeSearchInput.searchTerm}
                  onChange={nodeSearchInput.handleChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white pr-8"
                  ref={nodeSearchInput.inputRef}
                  autoFocus
                />
                {nodeSearchInput.searchTerm && (
                  <button
                    onClick={nodeSearchInput.clearSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleAllNodes(!allSelected);
                    }}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
                <div className="flex space-x-2">
                  {nodeSearchInput.searchTerm && (
                    <button
                      onClick={() => toggleFilteredNodes(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Select Filtered
                    </button>
                  )}
                  <button
                    onClick={() => toggleAllNodes(false)}
                    className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {nodeNames
                .filter(({ name }) => 
                  name.toLowerCase().includes(nodeSearchInput.searchTerm.toLowerCase())
                )
                .map(({ name, count }) => (
                <label key={name} className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedNodes[name] || false}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedNodes({
                        ...selectedNodes,
                        [name]: !selectedNodes[name]
                      });
                    }}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm truncate">{name}</span>
                  <span className="text-xs text-gray-500 ml-auto">({count})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Edge Label Filter component
  const EdgeLabelFilter = () => {
    if (!edgeLabels.length) return null;
    
    const allSelected = Object.values(selectedEdgeLabels).every(value => value);
    const someSelected = Object.values(selectedEdgeLabels).some(value => value);
    
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEdgeFilterOpen(!isEdgeFilterOpen);
          }}
          className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Filter size={16} />
          <span className="text-sm">Filter by Relationship</span>
          {Object.values(selectedEdgeLabels).filter(Boolean).length !== edgeLabels.length && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
              {Object.values(selectedEdgeLabels).filter(Boolean).length}/{edgeLabels.length}
            </span>
          )}
          {isEdgeFilterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isEdgeFilterOpen && (
          <div ref={edgeFilterRef} className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative mb-2">
                <input
                  key={edgeSearchInput.inputKey}
                  type="text"
                  placeholder="Search relationships..."
                  value={edgeSearchInput.searchTerm}
                  onChange={edgeSearchInput.handleChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white pr-8"
                  ref={edgeSearchInput.inputRef}
                  autoFocus
                />
                {edgeSearchInput.searchTerm && (
                  <button
                    onClick={edgeSearchInput.clearSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleAllEdgeLabels(!allSelected);
                    }}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
                <div className="flex space-x-2">
                  {edgeSearchInput.searchTerm && (
                    <button
                      onClick={() => toggleFilteredEdgeLabels(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Select Filtered
                    </button>
                  )}
                  <button
                    onClick={() => toggleAllEdgeLabels(false)}
                    className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {edgeLabels
                .filter(({ label }) => 
                  label.toLowerCase().includes(edgeSearchInput.searchTerm.toLowerCase())
                )
                .map(({ label, count }) => (
                <label key={label} className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedEdgeLabels[label] || false}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeLabels({
                        ...selectedEdgeLabels,
                        [label]: !selectedEdgeLabels[label]
                      });
                    }}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm truncate">{label === 'No Label' ? '(No Label)' : label}</span>
                  <span className="text-xs text-gray-500 ml-auto">({count})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Handle node click with Control/Command key detection
  const handleNodeClick = (node: any, props?: any, event?: any) => {
    // Check if Control key (or Command key on Mac) is pressed
    if (event && (event.ctrlKey || event.metaKey)) {
      // Format node data with comprehensive information
      const nodeInfo = [
        `${node.label} (${node.id})`,
        node.entityType ? `Type: ${node.entityType}` : '',
        node.startingId ? `Original IDs: ${node.startingId.join(', ')}` : '',
        node.metadata?.description ? `Description: ${node.metadata.description}` : ''
      ].filter(Boolean).join('\n');
      
      // Update chat input with append=true to add to existing text
      updateChatInput(nodeInfo, true);
      
      // Pin the graph if not already pinned
      if (artifactId && !isPinned) {
        setPinnedGraphId(artifactId);
      }
      
      // Show notification
      setNotification({
        show: true,
        message: `Graph pinned! Node information added to chat input.`
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '' });
      }, 3000);
    }
    
    // Log for debugging
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

  // Focus search input when filter is opened
  useEffect(() => {
    if (isFilterOpen && typeSearchInput.inputRef.current) {
      typeSearchInput.focusInput();
    }
  }, [isFilterOpen]);
  
  // Focus search input when node filter is opened
  useEffect(() => {
    if (isNodeFilterOpen && nodeSearchInput.inputRef.current) {
      nodeSearchInput.focusInput();
    }
  }, [isNodeFilterOpen]);
  
  // Focus search input when edge filter is opened
  useEffect(() => {
    if (isEdgeFilterOpen && edgeSearchInput.inputRef.current) {
      edgeSearchInput.focusInput();
    }
  }, [isEdgeFilterOpen]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close entity type filter dropdown if clicked outside
      if (isFilterOpen && 
          typeFilterRef.current && 
          !typeFilterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      
      // Close node name filter dropdown if clicked outside
      if (isNodeFilterOpen && 
          nodeFilterRef.current && 
          !nodeFilterRef.current.contains(event.target as Node)) {
        setIsNodeFilterOpen(false);
      }
      
      // Close edge label filter dropdown if clicked outside
      if (isEdgeFilterOpen && 
          edgeFilterRef.current && 
          !edgeFilterRef.current.contains(event.target as Node)) {
        setIsEdgeFilterOpen(false);
      }
    };
    
    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen, isNodeFilterOpen, isEdgeFilterOpen]);

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
      <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded mb-2">
        <div className="flex flex-wrap items-center gap-2">
          {showVersionControls && <VersionControls />}
          <EntityTypeFilter />
          <NodeNameFilter />
          <EdgeLabelFilter />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Pin/Unpin button */}
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
          
          {/* Save Filtered View button */}
          {artifactId && graphData.nodes.length > 0 && (
            <button
              onClick={saveFilteredView}
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm transition-colors"
              title="Save current filtered view as a new version"
            >
              <Save size={16} />
              <span className="text-sm">Save Filtered View</span>
            </button>
          )}
          
          {/* View Source button */}
          <button
            onClick={() => {
              // TODO: Implement view source functionality
              console.log('View Source clicked');
            }}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-md shadow-sm transition-colors"
            title="View source data"
          >
            <span className="text-sm">View Source</span>
          </button>
          
          {/* Make Workspace Button - only show when no workspace exists */}
          {!isWorkspaceActive && (
            <button
              onClick={handleMakeWorkspace}
              className="flex items-center space-x-1 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-md shadow-sm transition-colors"
              title="Create a master graph workspace from this graph"
            >
              <span className="text-sm">Make Workspace</span>
            </button>
          )}
          
          {/* Add to Workspace Button - only show when workspace exists and graph not included */}
          {isWorkspaceActive && !isGraphIncluded && (
            <button
              onClick={handleAddToWorkspace}
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm transition-colors"
              title="Add this graph to the master workspace"
            >
              <span className="text-sm">Add to Workspace</span>
            </button>
          )}
          
          {/* Remove from Workspace Button - only show when workspace exists and graph is included */}
          {isWorkspaceActive && isGraphIncluded && (
            <button
              onClick={handleRemoveFromWorkspace}
              className="flex items-center space-x-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm transition-colors"
              title="Remove this graph from the master workspace"
            >
              <span className="text-sm">Remove from Workspace</span>
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="w-full h-full flex-grow relative" style={{ minWidth: '900px' }}>
        <NotificationPopup />
        {/* Tooltip for Ctrl/Cmd+Click functionality */}
        <div className="absolute bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-md opacity-70 z-40 pointer-events-none">
          Ctrl/Cmd + Click on a node to add it to chat
        </div>
        <GraphCanvas
          nodes={graphData.nodes.map(node => ({
            ...node,
            // Final validation to ensure no NaN values reach GraphCanvas
            x: typeof node.x === 'number' && !isNaN(node.x) ? node.x : 0,
            y: typeof node.y === 'number' && !isNaN(node.y) ? node.y : 0,
            z: typeof node.z === 'number' && !isNaN(node.z) ? node.z : 0,
            val: typeof node.val === 'number' && !isNaN(node.val) ? node.val : 1,
            connections: typeof node.connections === 'number' && !isNaN(node.connections) ? node.connections : 0,
          }))}
          edges={graphData.edges.map(edge => ({
            ...edge,
            // Final validation for edge values
            value: typeof edge.value === 'number' && !isNaN(edge.value) ? edge.value : 1,
          }))}
          layoutType="forceDirected2d"
          draggable
          labelType="all"
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
}; 