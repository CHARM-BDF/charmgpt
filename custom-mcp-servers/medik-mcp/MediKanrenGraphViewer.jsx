import React, { useState, useEffect } from 'react';
import KnowledgeGraphViewer from '../../src/components/artifacts/KnowledgeGraphViewer';

// This component would be used in the main application to display the mediKanren knowledge graph
const MediKanrenGraphViewer = () => {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // In a real application, you would load this from your data directory
    // Here we're assuming the data has been saved by our demo script
    fetch('/src/data/medikanren-knowledge-graph.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load knowledge graph data');
        }
        return response.json();
      })
      .then(data => {
        setGraphData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading knowledge graph:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 text-gray-500 rounded-md border border-gray-300">
        Loading mediKanren knowledge graph...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-300">
        <h3 className="font-bold mb-2">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">MediKanren Knowledge Graph: Treatments for Gastrointestinal Stromal Tumor</h2>
      <div className="border border-gray-300 rounded-lg p-4 bg-white h-[600px]">
        <KnowledgeGraphViewer data={graphData} />
      </div>
      <div className="mt-4 p-4 bg-gray-50 rounded-md">
        <h3 className="font-semibold mb-2">Graph Information</h3>
        <p>Nodes: {graphData?.nodes?.length || 0}</p>
        <p>Links: {graphData?.links?.length || 0}</p>
        <p className="mt-2 text-sm text-gray-600">
          This knowledge graph shows treatments for gastrointestinal stromal tumor (GIST) 
          retrieved from the mediKanren biomedical knowledge graph.
        </p>
      </div>
    </div>
  );
};

export default MediKanrenGraphViewer;

// Usage example:
/*
import MediKanrenGraphViewer from './path/to/MediKanrenGraphViewer';

function App() {
  return (
    <div className="container mx-auto p-4">
      <MediKanrenGraphViewer />
    </div>
  );
}
*/ 