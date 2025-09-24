import React, { useMemo, useState, useCallback } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ReagraphKnowledgeGraphViewer } from './ReagraphKnowledgeGraphViewer';
import { Artifact } from '../../types/artifacts';
import { KnowledgeGraphNode, KnowledgeGraphLink } from '../../types/knowledgeGraph';

interface MasterGraphWorkspaceViewerProps {
  onClose: () => void;
}

export const MasterGraphWorkspaceViewer: React.FC<MasterGraphWorkspaceViewerProps> = ({ onClose }) => {
  const masterGraphWorkspace = useChatStore(state => state.masterGraphWorkspace);
  const getWorkspaceStats = useChatStore(state => state.getWorkspaceStats);
  const setWorkspaceFilter = useChatStore(state => state.setWorkspaceFilter);
  
  // Get filter state from workspace (persistent)
  const hideLeafNodes = masterGraphWorkspace?.hideLeafNodes || false;
  
  // Memoize the stats to prevent infinite re-renders
  const stats = useMemo(() => getWorkspaceStats(), [getWorkspaceStats, masterGraphWorkspace]);
  
  // Function to filter out leaf nodes (nodes with only one connection)
  const filterLeafNodes = useCallback((nodes: KnowledgeGraphNode[], edges: KnowledgeGraphLink[]) => {
    if (!hideLeafNodes) return { nodes, edges };
    
    // Count connections for each node
    const connectionCounts = new Map<string, number>();
    edges.forEach(edge => {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    });
    
    // Filter out nodes with only one connection
    const filteredNodes = nodes.filter(node => (connectionCounts.get(node.id) || 0) > 1);
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    
    // Filter edges to only include those between remaining nodes
    const filteredEdges = edges.filter(edge => 
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );
    
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [hideLeafNodes]);
  
  if (!masterGraphWorkspace) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold mb-4">No Master Graph Workspace</h2>
        <p className="text-gray-600 mb-4">
          Create a workspace by clicking "Make Workspace" on any graph.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    );
  }
  
  // Apply leaf node filtering
  const { nodes: filteredNodes, edges: filteredEdges } = useMemo(() => 
    filterLeafNodes(masterGraphWorkspace.nodes, masterGraphWorkspace.edges),
    [masterGraphWorkspace.nodes, masterGraphWorkspace.edges, filterLeafNodes]
  );
  
  // Sanitize and validate graph data to prevent NaN values
  const sanitizedNodes = useMemo(() => {
    return filteredNodes.map(node => {
      // Debug: Log any nodes with invalid position data
      if (typeof node.x !== 'number' || isNaN(node.x) || typeof node.y !== 'number' || isNaN(node.y)) {
        console.warn('Invalid node position data:', {
          id: node.id,
          x: node.x,
          y: node.y,
          z: node.z,
          originalNode: node
        });
      }
      
      return {
        ...node,
        // Ensure position values are valid numbers
        x: typeof node.x === 'number' && !isNaN(node.x) ? node.x : Math.random() * 1000 - 500,
        y: typeof node.y === 'number' && !isNaN(node.y) ? node.y : Math.random() * 1000 - 500,
        z: typeof node.z === 'number' && !isNaN(node.z) ? node.z : 0,
        // Ensure other numeric properties are valid
        val: typeof node.val === 'number' && !isNaN(node.val) ? node.val : 1,
        connections: typeof node.connections === 'number' && !isNaN(node.connections) ? node.connections : 0,
        // Ensure fx and fy are either undefined or valid numbers
        fx: node.fx !== undefined && typeof node.fx === 'number' && !isNaN(node.fx) ? node.fx : undefined,
        fy: node.fy !== undefined && typeof node.fy === 'number' && !isNaN(node.fy) ? node.fy : undefined,
      };
    });
  }, [filteredNodes]);
  
  // Sanitize edge data
  const sanitizedEdges = useMemo(() => {
    return filteredEdges.map(edge => ({
      ...edge,
      // Ensure edge value is valid
      value: typeof edge.value === 'number' && !isNaN(edge.value) ? edge.value : 1,
    }));
  }, [filteredEdges]);
  
  // Create artifact for the workspace graph with sanitized data
  const workspaceArtifact: Artifact = {
    id: 'master-graph-workspace',
    type: 'application/vnd.knowledge-graph-v2',
    title: 'Master Graph Workspace',
    content: JSON.stringify({
      nodes: sanitizedNodes,
      links: sanitizedEdges,
      filteredCount: sanitizedEdges.length,
      filteredNodeCount: sanitizedNodes.length
    }),
    createdAt: masterGraphWorkspace.createdAt
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header with stats and controls */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">Master Graph Workspace</h2>
          <div className="flex space-x-2">
            {/* Leaf Node Filter Toggle */}
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={hideLeafNodes}
                onChange={(e) => setWorkspaceFilter(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Hide Leaf Nodes</span>
            </label>
            
            {/* Reset Filter Button */}
            <button
              onClick={() => setWorkspaceFilter(false)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              title="Reset to show all nodes"
            >
              Reset Filter
            </button>
            
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-semibold">Nodes:</span> {hideLeafNodes ? `${filteredNodes.length} / ${stats.totalNodes}` : stats.totalNodes}
            {hideLeafNodes && <span className="text-gray-500 ml-1">(filtered)</span>}
          </div>
          <div>
            <span className="font-semibold">Edges:</span> {hideLeafNodes ? `${filteredEdges.length} / ${stats.totalEdges}` : stats.totalEdges}
            {hideLeafNodes && <span className="text-gray-500 ml-1">(filtered)</span>}
          </div>
          <div>
            <span className="font-semibold">Included Graphs:</span> {stats.includedGraphs}
          </div>
          <div>
            <span className="font-semibold">Last Updated:</span> {new Date(stats.lastUpdated).toLocaleTimeString()}
          </div>
        </div>
        
        {/* Included/Excluded Graph Lists */}
        <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-semibold text-green-600">Included Graphs:</span>
            <div className="max-h-20 overflow-y-auto">
              {masterGraphWorkspace.includedGraphs.map(graphId => (
                <div key={graphId} className="text-gray-600">
                  {graphId.slice(-8)}
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="font-semibold text-red-600">Excluded Graphs:</span>
            <div className="max-h-20 overflow-y-auto">
              {masterGraphWorkspace.excludedGraphs.map(graphId => (
                <div key={graphId} className="text-gray-600">
                  {graphId.slice(-8)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Graph viewer */}
      <div className="flex-1">
        <ReagraphKnowledgeGraphViewer 
          data={workspaceArtifact.content}
          artifactId={workspaceArtifact.id}
          showVersionControls={false}
        />
      </div>
    </div>
  );
};
