import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { KnowledgeGraphNode, KnowledgeGraphLink, KnowledgeGraphData } from '../../types/knowledgeGraph';
import { useChatStore } from '../../store/chatStore';

interface KnowledgeGraphViewerProps {
  data: string | KnowledgeGraphData; // Accept either JSON string or parsed object
  width?: number;
  height?: number;
  artifactId?: string; // Add this to track the artifact
  showVersionControls?: boolean; // Option to show/hide version controls
}

export const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({ 
  data, 
  width = 800, 
  height = 600,
  artifactId,
  showVersionControls = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const { getGraphVersionHistory, getLatestGraphVersion, selectArtifact } = useChatStore();

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

  // Version navigation UI component
  const VersionControls = () => {
    if (!artifactId || !showVersionControls) return null;
    
    const versions = getGraphVersionHistory(artifactId);
    if (versions.length <= 1) return null;
    
    const currentIndex = versions.findIndex(v => v.id === artifactId);
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
    <div className="flex flex-col w-full h-full">
      {artifactId && showVersionControls && <VersionControls />}
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
    </div>
  );
};

export default KnowledgeGraphViewer; 