import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, CheckIcon } from '@heroicons/react/24/outline';
import { GraphToolsWindowProps, FilterOption, GraphData, SelectedGraphItems } from '../../types/graphTools';
import { useChatStore } from '../../store/chatStore';

export const GraphToolsWindow: React.FC<GraphToolsWindowProps> = ({
  isOpen,
  onClose,
  conversationId,
  onAddToChat
}) => {
  // Local state variables removed - now using store-based data
  
  // Filter states
  const [entityTypes, setEntityTypes] = useState<FilterOption[]>([]);
  const [nodeNames, setNodeNames] = useState<FilterOption[]>([]);
  const [edgeLabels, setEdgeLabels] = useState<FilterOption[]>([]);

  // Get shared filter state from chatStore
  const { graphFilters, updateGraphFilter, resetGraphFilters } = useChatStore();
  
  // Get graph data from store
  const graphData = useChatStore(state => 
    conversationId ? state.graphData[conversationId] : null
  );
  const graphLoading = useChatStore(state => 
    conversationId ? state.graphLoading[conversationId] : false
  );
  const graphError = useChatStore(state => 
    conversationId ? state.graphError[conversationId] : null
  );
  const loadGraphData = useChatStore(state => state.loadGraphData);
  
  // Search states
  const [entityTypeSearch, setEntityTypeSearch] = useState('');
  const [nodeNameSearch, setNodeNameSearch] = useState('');
  const [edgeLabelSearch, setEdgeLabelSearch] = useState('');
  
  // Filtered results
  const [filteredNodes, setFilteredNodes] = useState<any[]>([]);
  const [filteredEdges, setFilteredEdges] = useState<any[]>([]);
  
  // UI states
  const [showEntityTypes, setShowEntityTypes] = useState(true);
  const [showNodeNames, setShowNodeNames] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);

  // Load graph data from store
  useEffect(() => {
    if (isOpen && conversationId && !graphData) {
      loadGraphData(conversationId);
    }
  }, [isOpen, conversationId, graphData, loadGraphData]);

  // Initialize filter options when graph data loads
  useEffect(() => {
    if (!graphData) return;
    
    console.log('🔄 GraphToolsWindow: Initializing filter options', {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length
    });
    
    // Initialize entity types
    const uniqueEntityTypes = Array.from(new Set(graphData.nodes.map(node => node.type || 'Other')))
      .map(type => ({
        value: type,
        label: type,
        count: graphData.nodes.filter(node => (node.type || 'Other') === type).length,
        selected: graphFilters.selectedEntityTypes[type] ?? true,
      }));
    setEntityTypes(uniqueEntityTypes);

    // Initialize node names
    const uniqueNodeNames = Array.from(new Set(graphData.nodes.map(node => node.label || node.id)))
      .map(name => ({
        value: name,
        label: name,
        count: graphData.nodes.filter(node => (node.label || node.id) === name).length,
        selected: graphFilters.selectedNodes[name] ?? true,
      }));
    setNodeNames(uniqueNodeNames);

    // Initialize edge labels
    const uniqueEdgeLabels = Array.from(new Set(graphData.edges.map(edge => edge.label || 'No Label')))
      .map(label => ({
        value: label,
        label: label,
        count: graphData.edges.filter(edge => (edge.label || 'No Label') === label).length,
        selected: graphFilters.selectedEdgeLabels[label] ?? true,
      }));
    setEdgeLabels(uniqueEdgeLabels);
  }, [graphData, graphFilters]);

  // Sync local UI state with shared filter state
  useEffect(() => {
    setEntityTypes(prev => prev.map(opt => ({
      ...opt,
      selected: graphFilters.selectedEntityTypes[opt.value] ?? true
    })));
    setNodeNames(prev => prev.map(opt => ({
      ...opt,
      selected: graphFilters.selectedNodes[opt.value] ?? true
    })));
    setEdgeLabels(prev => prev.map(opt => ({
      ...opt,
      selected: graphFilters.selectedEdgeLabels[opt.value] ?? true
    })));
  }, [graphFilters]);

  // Apply filters when selections change
  useEffect(() => {
    if (!graphData.nodes.length) return;
    
    // Use shared filter state
    const selectedEntityTypes = new Set(Object.keys(graphFilters.selectedEntityTypes).filter(key => graphFilters.selectedEntityTypes[key]));
    const selectedNodeNames = new Set(Object.keys(graphFilters.selectedNodes).filter(key => graphFilters.selectedNodes[key]));
    const selectedEdgeLabels = new Set(Object.keys(graphFilters.selectedEdgeLabels).filter(key => graphFilters.selectedEdgeLabels[key]));
    
    console.log('🔍 GraphToolsWindow: Applying filters', {
      selectedEntityTypes: Array.from(selectedEntityTypes),
      selectedNodeNames: Array.from(selectedNodeNames),
      selectedEdgeLabels: Array.from(selectedEdgeLabels),
      totalNodes: graphData.nodes.length,
      totalEdges: graphData.edges.length
    });
    
    const filteredNodes = graphData.nodes.filter(node => {
      const entityType = node.type || 'Other';
      const nodeName = node.label || node.id;
      return selectedEntityTypes.has(entityType) && selectedNodeNames.has(nodeName);
    });
    
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    const filteredEdges = graphData.edges.filter(edge => {
      const label = edge.label || 'No Label';
      return selectedEdgeLabels.has(label) && 
             nodeIds.has(edge.source) && 
             nodeIds.has(edge.target);
    });
    
    console.log('📊 GraphToolsWindow: Filter results', {
      filteredNodes: filteredNodes.length,
      filteredEdges: filteredEdges.length,
      sampleNodes: filteredNodes.slice(0, 3).map(n => ({ id: n.id, label: n.label, type: n.type }))
    });
    
    setFilteredNodes(filteredNodes);
    setFilteredEdges(filteredEdges);
  }, [graphData.nodes, graphData.edges, graphFilters]);

  const handleFilterToggle = useCallback((type: 'entityTypes' | 'nodeNames' | 'edgeLabels', value: string) => {
    console.log('🔧 GraphToolsWindow: Filter toggle clicked', {
      type,
      value
    });
    
    // Update shared filter state
    const filterType = type === 'nodeNames' ? 'nodes' : type === 'edgeLabels' ? 'edgeLabels' : 'entityTypes';
    const currentValue = graphFilters[filterType === 'entityTypes' ? 'selectedEntityTypes' : 
                                    filterType === 'nodes' ? 'selectedNodes' : 'selectedEdgeLabels'][value] || false;
    updateGraphFilter(filterType, value, !currentValue);
  }, [graphFilters, updateGraphFilter]);

  const handleSelectAll = useCallback((type: 'entityTypes' | 'nodeNames' | 'edgeLabels', selected: boolean) => {
    console.log('🔧 GraphToolsWindow: Select all clicked', {
      type,
      selected
    });
    
    // Update shared filter state for all items
    const filterType = type === 'nodeNames' ? 'nodes' : type === 'edgeLabels' ? 'edgeLabels' : 'entityTypes';
    const options = type === 'entityTypes' ? entityTypes : type === 'nodeNames' ? nodeNames : edgeLabels;
    
    options.forEach(opt => {
      updateGraphFilter(filterType, opt.value, selected);
    });
  }, [entityTypes, nodeNames, edgeLabels, updateGraphFilter]);

  const handleAddToChat = useCallback(() => {
    const selectedItems: SelectedGraphItems = {
      nodes: filteredNodes.map(node => ({
        id: node.id,
        name: node.label || node.id,
        type: node.type || 'Other'
      })),
      edges: filteredEdges.map(edge => ({
        source: edge.source,
        target: edge.target,
        label: edge.label || 'No Label'
      }))
    };
    
    onAddToChat(selectedItems);
  }, [filteredNodes, filteredEdges, onAddToChat]);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveFilteredView = useCallback(async () => {
    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const response = await fetch(`/api/graph/${conversationId}/filtered-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeIds: filteredNodes.map(node => node.id),
          edgeIds: filteredEdges.map(edge => edge.id)
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setSaveSuccess(true);
        
        // Store-based architecture automatically updates all components when the store changes
        console.log('🔄 GraphToolsWindow: Filtered view saved successfully');
        
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error(result.error || 'Failed to save filtered view');
      }
    } catch (err) {
      console.error('Error saving filtered view:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save filtered view');
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaveLoading(false);
    }
  }, [conversationId, filteredNodes, filteredEdges]);

  const handleResetFilters = useCallback(() => {
    console.log('🔧 GraphToolsWindow: Reset filters clicked');
    
    // Reset shared filter state
    resetGraphFilters();
  }, [resetGraphFilters]);

  if (!isOpen) return null;

  if (graphLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mx-4 mb-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading graph data...</span>
        </div>
      </div>
    );
  }

  if (graphError) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mx-4 mb-4">
        <div className="text-red-500 dark:text-red-400">
          <div className="font-medium">Error loading graph data</div>
          <div className="text-sm mt-1">{graphError}</div>
        </div>
      </div>
    );
  }

      return (
        <div className="flex justify-start" style={{margin: '24px 0'}}>
          <div className="w-full max-w-3xl rounded-lg p-6 shadow-sm relative bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 shadow-gray-100 dark:shadow-gray-900/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-200/60 dark:border-gray-700/60 pb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Graph Tools</h3>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6 w-full">
        {/* Selection Summary */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <strong>{filteredNodes.length}</strong> nodes, <strong>{filteredEdges.length}</strong> edges selected
            {graphData.nodes.length > 0 && (
              <span className="ml-2 text-gray-500">
                (from {graphData.nodes.length} total nodes, {graphData.edges.length} total edges)
              </span>
            )}
          </div>
        </div>

        {/* Entity Type Filter */}
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Entity Types</h4>
            <div className="flex gap-2">
              <button
                onClick={() => handleSelectAll('entityTypes', true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded shadow-lg transition-colors"
              >
                All
              </button>
              <button
                onClick={() => handleSelectAll('entityTypes', false)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded shadow-lg transition-colors"
              >
                None
              </button>
              <button
                onClick={() => setShowEntityTypes(!showEntityTypes)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded shadow-lg transition-colors"
              >
                {showEntityTypes ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          
          {showEntityTypes && (
            <div className="space-y-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search entity types..."
                  value={entityTypeSearch}
                  onChange={(e) => setEntityTypeSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                />
              </div>
              
              <div className="max-h-32 overflow-y-auto space-y-1">
                {entityTypes
                  .filter(opt => opt.label.toLowerCase().includes(entityTypeSearch.toLowerCase()))
                  .map(opt => (
                    <label key={opt.value} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={opt.selected}
                        onChange={() => handleFilterToggle('entityTypes', opt.value)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{opt.label}</span>
                      <span className="text-gray-500">({opt.count})</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Node Name Filter */}
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Node Names</h4>
            <div className="flex gap-2">
              <button
                onClick={() => handleSelectAll('nodeNames', true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded shadow-lg transition-colors"
              >
                All
              </button>
              <button
                onClick={() => handleSelectAll('nodeNames', false)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded shadow-lg transition-colors"
              >
                None
              </button>
              <button
                onClick={() => setShowNodeNames(!showNodeNames)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded shadow-lg transition-colors"
              >
                {showNodeNames ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          
          {showNodeNames && (
            <div className="space-y-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search node names..."
                  value={nodeNameSearch}
                  onChange={(e) => setNodeNameSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                />
              </div>
              
              <div className="max-h-32 overflow-y-auto space-y-1">
                {nodeNames
                  .filter(opt => opt.label.toLowerCase().includes(nodeNameSearch.toLowerCase()))
                  .map(opt => (
                    <label key={opt.value} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={opt.selected}
                        onChange={() => handleFilterToggle('nodeNames', opt.value)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{opt.label}</span>
                      <span className="text-gray-500">({opt.count})</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Edge Label Filter */}
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Edge Labels</h4>
            <div className="flex gap-2">
              <button
                onClick={() => handleSelectAll('edgeLabels', true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded shadow-lg transition-colors"
              >
                All
              </button>
              <button
                onClick={() => handleSelectAll('edgeLabels', false)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded shadow-lg transition-colors"
              >
                None
              </button>
              <button
                onClick={() => setShowEdgeLabels(!showEdgeLabels)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded shadow-lg transition-colors"
              >
                {showEdgeLabels ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          
          {showEdgeLabels && (
            <div className="space-y-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search edge labels..."
                  value={edgeLabelSearch}
                  onChange={(e) => setEdgeLabelSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                />
              </div>
              
              <div className="max-h-32 overflow-y-auto space-y-1">
                {edgeLabels
                  .filter(opt => opt.label.toLowerCase().includes(edgeLabelSearch.toLowerCase()))
                  .map(opt => (
                    <label key={opt.value} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={opt.selected}
                        onChange={() => handleFilterToggle('edgeLabels', opt.value)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{opt.label}</span>
                      <span className="text-gray-500">({opt.count})</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        {saveError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <div className="flex items-center">
              <span className="text-sm font-medium">Error:</span>
              <span className="ml-2 text-sm">{saveError}</span>
            </div>
          </div>
        )}
        
        {saveSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <div className="flex items-center">
              <CheckIcon className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Filtered view saved successfully!</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-6 border-t border-gray-200/60 dark:border-gray-700/60 w-full">
          <button
            onClick={handleAddToChat}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded shadow-lg transition-colors"
          >
            Add to Chat ({filteredNodes.length} nodes, {filteredEdges.length} edges)
          </button>
          <button
            onClick={handleSaveFilteredView}
            disabled={saveLoading}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded shadow-lg transition-colors ${
              saveLoading
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {saveLoading ? 'Saving...' : 'Save Filtered View'}
          </button>
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded shadow-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
    </div>
  );
};
