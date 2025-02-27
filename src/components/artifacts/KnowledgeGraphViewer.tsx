import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Define the types for our knowledge graph data
export interface KnowledgeGraphNode {
  id: string;
  name: string;
  group?: number;
  val?: number; // Optional size value
  color?: string; // Optional color
  [key: string]: any; // Allow for additional properties
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  value?: number;
  label?: string;
  color?: string;
  [key: string]: any; // Allow for additional properties
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
}

interface KnowledgeGraphViewerProps {
  data: string | KnowledgeGraphData; // Accept either JSON string or parsed object
  width?: number;
  height?: number;
}

export const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({ 
  data, 
  width = 800, 
  height = 600 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });

  // Parse the data if it's a string
  useEffect(() => {
    try {
      if (typeof data === 'string') {
        setGraphData(JSON.parse(data));
      } else {
        setGraphData(data);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to parse knowledge graph data:', err);
      setError('Failed to parse knowledge graph data. Please check the format.');
      setGraphData(null);
    }
  }, [data]);

  // Adjust dimensions based on container size
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({
            width: width || 800,
            height: height || 600
          });
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
      };
    }
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-300">
        <h3 className="font-bold mb-2">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className="p-4 bg-gray-50 text-gray-500 rounded-md border border-gray-300">
        Loading knowledge graph...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <ForceGraph2D
        graphData={graphData}
        nodeLabel="name"
        nodeColor={(node: KnowledgeGraphNode) => node.color || (node.group ? `hsl(${node.group * 45 % 360}, 70%, 50%)` : '#1f77b4')}
        nodeVal={(node: KnowledgeGraphNode) => node.val || 1}
        linkLabel="label"
        linkColor={(link: KnowledgeGraphLink) => link.color || '#999'}
        linkWidth={(link: KnowledgeGraphLink) => link.value || 1}
        width={dimensions.width}
        height={dimensions.height}
        onNodeClick={(node: KnowledgeGraphNode) => {
          // You can add custom node click behavior here
          console.log('Node clicked:', node);
        }}
      />
    </div>
  );
};

export default KnowledgeGraphViewer; 