import React, { useRef, useEffect, useState, useMemo } from 'react';
import { GraphCanvas } from 'reagraph';
import { KnowledgeGraphData } from '../../types/knowledgeGraph';
import { useChatStore } from '../../store/chatStore';
import { Pin, PinOff, ChevronDown, ChevronUp, Filter, Save } from 'lucide-react';
import { useMCPStore } from '../../store/mcpStore';

interface ReagraphKnowledgeGraphViewerProps {
  data: string | KnowledgeGraphData; // Accept either JSON string or parsed object
  width?: number;
  height?: number;
  artifactId?: string; // Add this to track the artifact
  showVersionControls?: boolean; // Option to show/hide version controls
}

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
  const { getGraphVersionHistory, getLatestGraphVersion, selectArtifact, setPinnedGraphId, pinnedGraphId, updateGraphArtifact, updateChatInput } = useChatStore();
  const isPinned = artifactId ? pinnedGraphId === artifactId : false;
  
  // New state for notification popup
  const [notification, setNotification] = useState<{ show: boolean; message: string }>({ 
    show: false, 
    message: '' 
  });
  
  // New states for entity type filtering (replacing ID prefix filtering)
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Record<string, boolean>>({});
  const [entityTypeCounts, setEntityTypeCounts] = useState<Record<string, number>>({});
  const [entityTypeColors, setEntityTypeColors] = useState<Record<string, string>>({});
  const [filteredNodes, setFilteredNodes] = useState<any[]>([]);
  const [filteredEdges, setFilteredEdges] = useState<any[]>([]);

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

  // Transform data for Reagraph format
  const graphData = useMemo(() => {
    if (!parsedData) return { nodes: [], edges: [] };
    
    // Map nodes to Reagraph format
    const nodes = parsedData.nodes.map(node => {
      // Log the node color for debugging
      console.log(`Node ${node.id} color: ${node.color}`);
      
      // Get the color value from node or generate one
      const colorValue = node.color || (node.group ? `hsl(${node.group * 45 % 360}, 70%, 50%)` : '#1f77b4');
      
      // Get entity type from node
      const entityType = (node as any).entityType || 'Other';
      
      return {
        id: node.id,
        label: node.name,
        data: { ...node },
        // Include both color and fill properties
        color: colorValue,
        fill: colorValue,
        // Use node.val for size if available
        size: node.val || 1,
        // Add entityType directly to the node object
        entityType
      };
    });
    
    // Map links to Reagraph edges format
    const edges = parsedData.links.map(link => ({
      id: `${link.source}->${link.target}${link.label ? `-${link.label}` : ''}`,
      source: link.source,
      target: link.target,
      label: link.label || '',
      data: { ...link },
      color: link.color || '#999',
      size: link.value || 1
    }));
    
    return { nodes, edges };
  }, [parsedData]);

  // Filter nodes based on selected entity types
  useEffect(() => {
    if (!graphData.nodes.length) return;
    
    // Filter nodes based on selected entity types
    const nodes = graphData.nodes.filter(node => {
      const entityType = node.entityType || 'Other';
      return selectedEntityTypes[entityType];
    });
    
    // Get IDs of filtered nodes
    const nodeIds = new Set(nodes.map(node => node.id));
    
    // Filter edges to only include those connecting filtered nodes
    const edges = graphData.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    setFilteredNodes(nodes);
    setFilteredEdges(edges);
  }, [graphData, selectedEntityTypes]);

  // Toggle all entity types
  const toggleAllEntityTypes = (value: boolean) => {
    const updatedTypes = { ...selectedEntityTypes };
    Object.keys(updatedTypes).forEach(type => {
      updatedTypes[type] = value;
    });
    setSelectedEntityTypes(updatedTypes);
  };

  // Save filtered view as a new version
  const saveFilteredView = () => {
    if (!artifactId || !filteredNodes.length) return;
    
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
      const nodes = filteredNodes.map(node => ({
        id: node.id,
        name: node.label,
        ...node.data,
        color: node.color
      }));
      
      // Convert Reagraph edges back to KnowledgeGraph links
      const links = filteredEdges.map(edge => ({
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
          selectedEntityTypes
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
    console.log('Version history for artifact:', {
      artifactId,
      versionsCount: versions.length,
      versions: versions.map(v => ({
        id: v.id,
        title: v.title,
        versionNumber: v.versionNumber,
        previousVersionId: v.previousVersionId,
        nextVersionId: v.nextVersionId
      }))
    });
    
    if (versions.length <= 1) return null;
    
    const currentIndex = versions.findIndex(v => v.id === artifactId);
    console.log('Current version index:', currentIndex, 'out of', versions.length);
    
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
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Filter size={16} />
          <span className="text-sm">Filter by Entity Type</span>
          {isFilterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isFilterOpen && (
          <div className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleAllEntityTypes(!allSelected)}
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Select All</span>
              </label>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {entityTypes.map(({ type, count, color }) => (
                <label key={type} className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedEntityTypes[type] || false}
                    onChange={() => {
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

  // Handle node click with Control/Command key detection
  const handleNodeClick = (node: any, props?: any, event?: any) => {
    // Check if Control key (or Command key on Mac) is pressed
    if (event && (event.ctrlKey || event.metaKey)) {
      // Format node data
      const nodeText = `${node.label} (${node.id})`;
      
      // Update chat input
      updateChatInput(nodeText);
      
      // Pin the graph if not already pinned
      if (artifactId && !isPinned) {
        setPinnedGraphId(artifactId);
      }
      
      // Show notification
      setNotification({
        show: true,
        message: `Graph pinned! "${node.label}" added to chat input.`
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
        <div className="flex items-center space-x-2">
          {showVersionControls && <VersionControls />}
          <EntityTypeFilter />
          
          {/* Save Filtered View button */}
          {artifactId && filteredNodes.length > 0 && filteredNodes.length !== graphData.nodes.length && (
            <button
              onClick={saveFilteredView}
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm transition-colors"
              title="Save current filtered view as a new version"
            >
              <Save size={16} />
              <span className="text-sm">Save Filtered View</span>
            </button>
          )}
        </div>
        
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
      <div ref={containerRef} className="w-full h-full flex-grow relative">
        <NotificationPopup />
        {/* Tooltip for Ctrl/Cmd+Click functionality */}
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