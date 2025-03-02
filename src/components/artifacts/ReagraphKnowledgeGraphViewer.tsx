import React, { useRef, useEffect, useState, useMemo } from 'react';
import { GraphCanvas } from 'reagraph';
import { KnowledgeGraphNode, KnowledgeGraphLink, KnowledgeGraphData } from '../../types/knowledgeGraph';
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
  const { getGraphVersionHistory, getLatestGraphVersion, selectArtifact, setPinnedGraphId, pinnedGraphId, updateGraphArtifact } = useChatStore();
  const isPinned = artifactId ? pinnedGraphId === artifactId : false;
  
  // New states for ID prefix filtering
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedPrefixes, setSelectedPrefixes] = useState<Record<string, boolean>>({});
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

  // Extract unique ID prefixes from nodes
  const idPrefixes = useMemo(() => {
    if (!parsedData) return [];
    
    const prefixes = new Set<string>();
    
    parsedData.nodes.forEach(node => {
      const parts = node.id.split(':');
      if (parts.length > 1) {
        prefixes.add(parts[0]);
      } else {
        prefixes.add('NO_PREFIX');
      }
    });
    
    return Array.from(prefixes).sort();
  }, [parsedData]);

  // Initialize selected prefixes when prefixes are extracted
  useEffect(() => {
    if (idPrefixes.length > 0) {
      const initialSelectedPrefixes: Record<string, boolean> = {};
      idPrefixes.forEach(prefix => {
        initialSelectedPrefixes[prefix] = true;
      });
      setSelectedPrefixes(initialSelectedPrefixes);
    }
  }, [idPrefixes]);

  // Transform data for Reagraph format
  const graphData = useMemo(() => {
    if (!parsedData) return { nodes: [], edges: [] };
    
    // Map nodes to Reagraph format
    const nodes = parsedData.nodes.map(node => {
      // Log the node color for debugging
      console.log(`Node ${node.id} color: ${node.color}`);
      
      // Get the color value from node or generate one
      const colorValue = node.color || (node.group ? `hsl(${node.group * 45 % 360}, 70%, 50%)` : '#1f77b4');
      
      return {
        id: node.id,
        label: node.name,
        data: { ...node },
        // Include both color and fill properties
        color: colorValue,
        fill: colorValue,
        // Use node.val for size if available
        size: node.val || 1
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

  // Filter nodes based on selected prefixes
  useEffect(() => {
    if (!graphData.nodes.length) return;
    
    // Filter nodes based on selected prefixes
    const nodes = graphData.nodes.filter(node => {
      const parts = node.id.split(':');
      const prefix = parts.length > 1 ? parts[0] : 'NO_PREFIX';
      return selectedPrefixes[prefix];
    });
    
    // Get IDs of filtered nodes
    const nodeIds = new Set(nodes.map(node => node.id));
    
    // Filter edges to only include those connecting filtered nodes
    const edges = graphData.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    setFilteredNodes(nodes);
    setFilteredEdges(edges);
  }, [graphData, selectedPrefixes]);

  // Toggle all prefixes
  const toggleAllPrefixes = (value: boolean) => {
    const updatedPrefixes = { ...selectedPrefixes };
    Object.keys(updatedPrefixes).forEach(prefix => {
      updatedPrefixes[prefix] = value;
    });
    setSelectedPrefixes(updatedPrefixes);
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
          selectedPrefixes
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

  // ID Prefix Filter component
  const PrefixFilter = () => {
    if (!idPrefixes.length) return null;
    
    const allSelected = Object.values(selectedPrefixes).every(value => value);
    const someSelected = Object.values(selectedPrefixes).some(value => value);
    
    return (
      <div className="relative">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Filter size={16} />
          <span className="text-sm">Filter by ID Prefix</span>
          {isFilterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isFilterOpen && (
          <div className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleAllPrefixes(!allSelected)}
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Select All</span>
              </label>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {idPrefixes.map(prefix => (
                <label key={prefix} className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedPrefixes[prefix] || false}
                    onChange={() => {
                      setSelectedPrefixes({
                        ...selectedPrefixes,
                        [prefix]: !selectedPrefixes[prefix]
                      });
                    }}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm">{prefix === 'NO_PREFIX' ? '(No Prefix)' : prefix}</span>
                </label>
              ))}
            </div>
          </div>
        )}
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
          <PrefixFilter />
          
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
        <GraphCanvas
          nodes={filteredNodes.length ? filteredNodes : graphData.nodes}
          edges={filteredEdges.length ? filteredEdges : graphData.edges}
          layoutType="forceDirected2d"
          draggable
          labelType="all"
          onNodeClick={(node) => {
            // You can add custom node click behavior here
            console.log('Node clicked:', node);
          }}
        />
      </div>
    </div>
  );
}; 