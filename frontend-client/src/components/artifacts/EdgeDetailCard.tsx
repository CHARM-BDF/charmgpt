import React from 'react';
import { X, Copy, Pin, PinOff } from 'lucide-react';

interface EdgeDetailCardProps {
  edge: any;
  position: { x: number; y: number };
  onClose: () => void;
  onPin: () => void;
  onCopyToChat: () => void;
  isPinned: boolean;
}

export const EdgeDetailCard: React.FC<EdgeDetailCardProps> = ({
  edge,
  position,
  onClose,
  onPin,
  onCopyToChat,
  isPinned
}) => {
  // Calculate safe position (prevent card from going off-screen)
  const cardWidth = 400;
  const cardMaxHeight = 500;
  const padding = 20;
  
  const safeX = Math.min(position.x, window.innerWidth - cardWidth - padding);
  const safeY = Math.min(position.y, window.innerHeight - cardMaxHeight - padding);
  
  // Get source and target node names if available
  const sourceName = edge.sourceName || edge.source;
  const targetName = edge.targetName || edge.target;
  
  // Get all edges (aggregated or single)
  const edges = edge.data?.edges || [edge];
  const count = edge.data?.count || 1;
  
  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 animate-fade-in"
      style={{
        left: `${safeX}px`,
        top: `${safeY}px`,
        width: `${cardWidth}px`,
        maxHeight: `${cardMaxHeight}px`,
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(255, 255, 255, 0.98)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {sourceName} → {targetName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {count} {count === 1 ? 'relationship' : 'relationships'}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={onPin}
            className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              isPinned ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
            }`}
            title={isPinned ? "Unpin card" : "Pin card"}
          >
            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      {/* Content - Scrollable */}
      <div className="overflow-y-auto" style={{ maxHeight: `${cardMaxHeight - 140}px` }}>
        <div className="p-4 space-y-4">
          {edges.map((e: any, i: number) => {
            const edgeData = e.data || {};
            const publications = edgeData.publications || [];
            const phrase = edgeData.phrase || '';
            const primarySource = edgeData.primary_source || '';
            const agg1 = edgeData.agg1 || '';
            const agg2 = edgeData.agg2 || '';
            const edgeType = edgeData.edgeType || '';
            const qualifiers = edgeData.qualifiers || [];
            
            return (
              <div
                key={i}
                className="pb-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                {/* Relationship header */}
                <div className="flex items-start gap-2 mb-2">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold">
                    {count > 1 ? i + 1 : '✓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {e.label || 'Unknown predicate'}
                    </p>
                    {edgeType && (
                      <span className="inline-block px-2 py-0.5 mt-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                        {edgeType}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Phrase */}
                {phrase && (
                  <div className="ml-8 mb-2">
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                      "{phrase}"
                    </p>
                  </div>
                )}
                
                {/* Publications */}
                <div className="ml-8 mb-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    📚 Publications {publications.length > 0 && `(${publications.length})`}
                  </p>
                  {publications.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {publications.map((pmid: string, idx: number) => {
                        const cleanPmid = pmid.replace('PMID:', '');
                        return (
                          <a
                            key={idx}
                            href={`https://pubmed.ncbi.nlm.nih.gov/${cleanPmid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            {pmid}
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">None</p>
                  )}
                </div>
                
                {/* Source information */}
                {primarySource && (
                  <div className="ml-8 mb-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      🔍 Primary Source
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                      {primarySource}
                    </p>
                  </div>
                )}
                
                {/* Aggregators */}
                {(agg1 || agg2) && (
                  <div className="ml-8 mb-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      🔗 Aggregators
                    </p>
                    <div className="space-y-0.5">
                      {agg1 && (
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                          {agg1}
                        </p>
                      )}
                      {agg2 && (
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                          {agg2}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Qualifiers */}
                {qualifiers.length > 0 && (
                  <div className="ml-8">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      🎯 Qualifiers ({qualifiers.length})
                    </p>
                    <div className="space-y-1">
                      {qualifiers.map((q: any, qIdx: number) => (
                        <div key={qIdx} className="text-xs text-gray-700 dark:text-gray-300">
                          <span className="font-mono text-gray-500 dark:text-gray-400">
                            {q.qualifier_type_id?.split(':').pop() || q.qualifier_type_id}
                          </span>
                          {': '}
                          <span className="font-medium">
                            {q.qualifier_value?.split(':').pop() || q.qualifier_value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <button
          onClick={onCopyToChat}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <Copy size={14} />
          Copy to Chat
        </button>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {isPinned ? 'Card pinned' : 'Hover to view'}
        </div>
      </div>
    </div>
  );
};

