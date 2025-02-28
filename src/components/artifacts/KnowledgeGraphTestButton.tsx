import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { useMCPStore } from '../../store/mcpStore';
import { KnowledgeGraphData } from '../../types/knowledgeGraph';

// Sample graph data for testing
const sampleGraphData: KnowledgeGraphData = {
  nodes: [
    { id: 'node1', name: 'Node 1', type: 'person', age: 30 },
    { id: 'node2', name: 'Node 2', type: 'person', age: 25 },
    { id: 'node3', name: 'Node 3', type: 'company', age: null },
    { id: 'node4', name: 'Node 4', type: 'company', age: null },
    { id: 'node5', name: 'Node 5', type: 'location', age: null },
  ],
  links: [
    { source: 'node1', target: 'node2', label: 'knows' },
    { source: 'node1', target: 'node3', label: 'works_at' },
    { source: 'node2', target: 'node4', label: 'works_at' },
    { source: 'node3', target: 'node5', label: 'located_in' },
    { source: 'node4', target: 'node5', label: 'located_in' },
  ]
};

const KnowledgeGraphTestButton: React.FC = () => {
  const { addArtifact, selectArtifact } = useChatStore();
  const { handleGraphCommand } = useMCPStore();

  const createTestGraph = () => {
    // Create a new graph artifact
    const artifactId = addArtifact({
      id: crypto.randomUUID(),
      artifactId: crypto.randomUUID(),
      type: 'application/vnd.ant.knowledge-graph',
      title: 'Test Knowledge Graph',
      content: JSON.stringify(sampleGraphData),
      position: 0,
      versionNumber: 1
    });

    // Select the artifact to display it
    selectArtifact(artifactId);

    return artifactId;
  };

  const testGroupByType = async () => {
    console.log('Starting testGroupByType');
    const artifactId = createTestGraph();
    console.log('Created test graph with ID:', artifactId);
    
    // Test the groupByProperty command
    try {
      const result = await handleGraphCommand({
        type: 'groupByProperty',
        targetGraphId: artifactId,
        params: { propertyName: 'type' }
      });
      console.log('groupByProperty command result:', result);
    } catch (error) {
      console.error('Error in groupByProperty command:', error);
    }
  };

  const testHighlightNodes = async () => {
    console.log('Starting testHighlightNodes - button clicked');
    try {
      const artifactId = createTestGraph();
      console.log('Created test graph with ID:', artifactId);
      
      // Test the highlightNodes command
      console.log('Executing highlightNodes command...');
      const result = await handleGraphCommand({
        type: 'highlightNodes',
        targetGraphId: artifactId,
        params: { 
          nodeIds: ['node1', 'node2'],
          color: '#ff0000'
        }
      });
      console.log('highlightNodes command result:', result);
      alert('Highlight Nodes test completed!');
    } catch (error) {
      console.error('Error in highlightNodes command:', error);
      alert('Error in Highlight Nodes test: ' + error);
    }
  };

  const testFilterNodes = async () => {
    console.log('Starting testFilterNodes - button clicked');
    try {
      const artifactId = createTestGraph();
      console.log('Created test graph with ID:', artifactId);
      
      // Test the filterNodes command
      console.log('Executing filterNodes command...');
      const result = await handleGraphCommand({
        type: 'filterNodes',
        targetGraphId: artifactId,
        params: { 
          predicate: 'type',
          value: 'person'
        }
      });
      console.log('filterNodes command result:', result);
      alert('Filter Nodes test completed!');
    } catch (error) {
      console.error('Error in filterNodes command:', error);
      alert('Error in Filter Nodes test: ' + error);
    }
  };

  const runAllTests = async () => {
    console.log('Starting runAllTests - button clicked');
    try {
      const artifactId = createTestGraph();
      console.log('Created test graph with ID:', artifactId);
      alert('Running all tests in sequence...');
      
      // Run a sequence of commands on the same graph
      console.log('Running groupByProperty command');
      await handleGraphCommand({
        type: 'groupByProperty',
        targetGraphId: artifactId,
        params: { propertyName: 'type' }
      });
      
      // Wait a bit to make the sequence clearer
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Running highlightNodes command');
      await handleGraphCommand({
        type: 'highlightNodes',
        targetGraphId: artifactId,
        params: { 
          nodeIds: ['node1', 'node2'],
          color: '#ff0000'
        }
      });
      
      // Wait a bit to make the sequence clearer
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Running resetView command');
      await handleGraphCommand({
        type: 'resetView',
        targetGraphId: artifactId,
        params: {}
      });
      
      console.log('All tests completed successfully');
      alert('All tests completed successfully!');
    } catch (error) {
      console.error('Error in runAllTests:', error);
      alert('Error in Run All Tests: ' + error);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <button 
        className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors"
        onClick={createTestGraph}
        type="button"
      >
        1. Create Basic Test Graph
      </button>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-1">
        Test Individual Commands:
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        <button 
          className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium transition-colors cursor-pointer"
          onClick={testGroupByType}
          type="button"
        >
          2. Group By Type
        </button>
        <button 
          className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm font-medium transition-colors cursor-pointer"
          onClick={testHighlightNodes}
          type="button"
        >
          3. Highlight Nodes
        </button>
        <button 
          className="w-full px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium transition-colors cursor-pointer"
          onClick={testFilterNodes}
          type="button"
        >
          4. Filter Nodes
        </button>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-2">
        <button 
          className="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium transition-colors cursor-pointer"
          onClick={runAllTests}
          type="button"
        >
          Run All Tests in Sequence
        </button>
      </div>
    </div>
  );
};

export default KnowledgeGraphTestButton; 