import React, { useEffect, useRef } from 'react';
import '@nightingale-elements/nightingale-manager';
import '@nightingale-elements/nightingale-sequence';
import '@nightingale-elements/nightingale-track';
import '@nightingale-elements/nightingale-navigation';
import '@nightingale-elements/nightingale-colored-sequence';
import '@nightingale-elements/nightingale-interpro-track';

interface ProteinVisualizationData {
  proteinId: string;
  sequence: string;
  length: number;
  tracks: Array<{
    type: string;
    label: string;
    expandable?: boolean;
    expanded?: boolean;
    features: Array<{
      accession: string;
      start: number;
      end: number;
      color: string;
      description: string;
      shape?: string;
      evidence?: string[];
      contributors?: Array<{
        database: string;
        accession: string;
        name: string;
      }>;
      residues?: Array<{
        position: number;
        type: string;
        description: string;
      }>;
    }>;
  }>;
}

export const ProteinVisualizationViewer: React.FC<{
  data: string | ProteinVisualizationData;
}> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<any>(null);
  const [expandedTracks, setExpandedTracks] = React.useState<Set<number>>(new Set());
  const [showJson, setShowJson] = React.useState<boolean>(false);

  useEffect(() => {
    if (!containerRef.current || showJson) return;

    // Parse data if it's a string
    const vizData: ProteinVisualizationData = typeof data === 'string' 
      ? JSON.parse(data) 
      : data;

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Create the Nightingale manager element
    const manager = document.createElement('nightingale-manager');
    manager.setAttribute('sequence', vizData.sequence);
    manager.setAttribute('height', '500');
    managerRef.current = manager;

    // Create navigation with proper attributes for numbering
    const navigation = document.createElement('nightingale-navigation');
    navigation.setAttribute('length', vizData.length.toString());
    navigation.setAttribute('display-start', '1');
    navigation.setAttribute('display-end', vizData.length.toString());
    navigation.setAttribute('height', '40');
    
    // Create sequence track
    const sequenceTrack = document.createElement('nightingale-sequence');
    sequenceTrack.setAttribute('length', vizData.length.toString());
    sequenceTrack.setAttribute('height', '30');
    sequenceTrack.setAttribute('sequence', vizData.sequence);
    sequenceTrack.setAttribute('display-start', '1');
    sequenceTrack.setAttribute('display-end', vizData.length.toString());

            // Create domain and feature tracks
        vizData.tracks.forEach((track, index) => {
          // Add track label with expandable functionality
          const labelContainer = document.createElement('div');
          labelContainer.style.display = 'flex';
          labelContainer.style.alignItems = 'center';
          labelContainer.style.marginTop = '10px';
          labelContainer.style.marginBottom = '5px';
          
          const label = document.createElement('div');
          label.style.fontWeight = 'bold';
          label.textContent = track.label;
          labelContainer.appendChild(label);

          // Add expand/collapse button for expandable tracks
          if (track.expandable) {
            const isExpanded = expandedTracks.has(index);
            const expandButton = document.createElement('button');
            expandButton.textContent = isExpanded ? '▼' : '▶';
            expandButton.style.marginLeft = '8px';
            expandButton.style.border = 'none';
            expandButton.style.background = 'transparent';
            expandButton.style.cursor = 'pointer';
            expandButton.style.fontSize = '12px';
            
            expandButton.onclick = () => {
              const newExpanded = new Set(expandedTracks);
              if (isExpanded) {
                newExpanded.delete(index);
              } else {
                newExpanded.add(index);
              }
              setExpandedTracks(newExpanded);
            };
            
            labelContainer.appendChild(expandButton);
          }

          // Use InterPro track for domains to get better styling and numbering
          const trackElement = track.type === 'domain'
            ? document.createElement('nightingale-interpro-track')
            : document.createElement('nightingale-track');

          trackElement.setAttribute('length', vizData.length.toString());
          trackElement.setAttribute('height', '40');
          trackElement.setAttribute('display-start', '1');
          trackElement.setAttribute('display-end', vizData.length.toString());
          trackElement.setAttribute('layout', track.type === 'variant' ? 'non-overlapping' : 'default');
          
          // Set expanded attribute for InterPro tracks
          if (track.type === 'domain' && track.expandable && expandedTracks.has(index)) {
            trackElement.setAttribute('expanded', 'true');
          }

          // Set track data
          (trackElement as any).data = track.features;

          manager.appendChild(labelContainer);
          manager.appendChild(trackElement);

          // Add expanded content below track if expanded
          if (track.expandable && expandedTracks.has(index)) {
            const expandedContent = document.createElement('div');
            expandedContent.style.marginLeft = '20px';
            expandedContent.style.marginBottom = '10px';
            expandedContent.style.fontSize = '12px';
            expandedContent.style.backgroundColor = '#f8f9fa';
            expandedContent.style.padding = '8px';
            expandedContent.style.borderRadius = '4px';
            expandedContent.style.border = '1px solid #dee2e6';

            track.features.forEach((feature, featureIndex) => {
              if (feature.contributors || feature.residues) {
                const featureDiv = document.createElement('div');
                featureDiv.style.marginBottom = '8px';
                
                const featureTitle = document.createElement('div');
                featureTitle.style.fontWeight = 'bold';
                featureTitle.style.marginBottom = '4px';
                featureTitle.textContent = `${feature.description} (${feature.start}-${feature.end})`;
                featureDiv.appendChild(featureTitle);

                // Add contributors
                if (feature.contributors && feature.contributors.length > 0) {
                  const contributorsDiv = document.createElement('div');
                  contributorsDiv.style.marginBottom = '4px';
                  contributorsDiv.innerHTML = `<strong>Contributors:</strong> ${feature.contributors.map(c => `${c.database}:${c.accession}`).join(', ')}`;
                  featureDiv.appendChild(contributorsDiv);
                }

                // Add residues
                if (feature.residues && feature.residues.length > 0) {
                  const residuesDiv = document.createElement('div');
                  residuesDiv.innerHTML = `<strong>Key Residues:</strong> ${feature.residues.map(r => `${r.position}(${r.type})`).join(', ')}`;
                  featureDiv.appendChild(residuesDiv);
                }

                expandedContent.appendChild(featureDiv);
              }
            });

            manager.appendChild(expandedContent);
          }
        });

    // Append elements in the correct order: navigation first, then manager
    containerRef.current.appendChild(navigation);
    containerRef.current.appendChild(manager);

    // Register components with manager for synchronization (with proper typing)
    (manager as any).register('navigation', navigation);
    
    // Add sequence track to manager, not container
    manager.appendChild(sequenceTrack);
    (manager as any).register('sequence', sequenceTrack);

    // Add CSS for better styling and rounded domain ends
    const style = document.createElement('style');
    style.textContent = `
      nightingale-navigation {
        font-family: monospace;
        font-size: 12px;
        background-color: #f8f9fa;
        border-bottom: 1px solid #dee2e6;
      }
      nightingale-manager {
        font-family: monospace;
      }
      .nightingale-viewer {
        border: 1px solid #dee2e6;
        border-radius: 4px;
        overflow: hidden;
      }
      .nightingale-viewer nightingale-track rect,
      .nightingale-viewer nightingale-interpro-track rect,
      .nightingale-viewer svg rect,
      .nightingale-viewer g rect {
        rx: 12px !important;
        ry: 12px !important;
      }
      .nightingale-viewer .feature rect {
        rx: 12px !important;
        ry: 12px !important;
      }
      .nightingale-viewer .rounded-rectangle {
        rx: 12px !important;
        ry: 12px !important;
      }
    `;
    containerRef.current.appendChild(style);

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [data, showJson, expandedTracks]);

  // Parse data for JSON display
  const vizData: ProteinVisualizationData = typeof data === 'string' 
    ? JSON.parse(data) 
    : data;

  return (
    <div className="protein-visualization-container">
      {/* Toggle Button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Protein Visualization</h3>
        <button
          onClick={() => setShowJson(!showJson)}
          className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          {showJson ? '📊 Show Visualization' : '📋 Show JSON Data'}
        </button>
      </div>

      {/* Conditional Content */}
      {showJson ? (
        // JSON Data View
        <div className="json-view bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(vizData, null, 2)}
          </pre>
        </div>
      ) : (
        // Visualization View
        <>
          <div ref={containerRef} className="nightingale-viewer" />
          <div className="visualization-legend mt-4 p-4 bg-gray-50 rounded">
        <h4 className="font-bold mb-4 text-lg text-gray-800 border-b border-gray-300 pb-2">🔑 Visualization Key</h4>
        
        {/* Domain Track */}
        <div className="mb-4">
          <h5 className="font-semibold text-base mb-3 text-blue-700 flex items-center">
            🎯 <span className="ml-2">Protein Domains</span>
          </h5>
          <div className="ml-6 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-6 h-3 bg-blue-500 rounded-lg shadow-sm"></div>
                <span className="text-gray-700">Domain regions</span>
              </div>
            </div>
            
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Confidence Levels:</p>
              <div className="ml-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-green-500 rounded bg-green-50"></div>
                  <span className="text-gray-600">High confidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-orange-500 rounded bg-orange-50"></div>
                  <span className="text-gray-600">Medium confidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-red-500 rounded bg-red-50"></div>
                  <span className="text-gray-600">Low confidence</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Functional Sites */}
        <div className="mb-4">
          <h5 className="font-semibold text-base mb-3 text-orange-700 flex items-center">
            ⚙️ <span className="ml-2">Functional Sites</span>
          </h5>
          <div className="ml-6">
            <p className="text-xs font-medium text-gray-600 mb-2">Importance Levels:</p>
            <div className="ml-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-700 rounded-full shadow-sm"></div>
                <span className="text-gray-700">Critical sites</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded-full shadow-sm"></div>
                <span className="text-gray-700">Important sites</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-600 rounded-full shadow-sm"></div>
                <span className="text-gray-700">Moderate sites</span>
              </div>
            </div>
          </div>
        </div>

        {/* PTM Sites */}
        <div className="mb-4">
          <h5 className="font-semibold text-base mb-3 text-purple-700 flex items-center">
            🔄 <span className="ml-2">Post-Translational Modifications (PTMs)</span>
          </h5>
          <div className="ml-6">
            <p className="text-xs font-medium text-gray-600 mb-2">Modification Types:</p>
            <div className="ml-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-600 rounded-full shadow-sm"></div>
                <span className="text-gray-600">Phosphorylation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full shadow-sm"></div>
                <span className="text-gray-600">Glycosylation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-700 rounded-full shadow-sm"></div>
                <span className="text-gray-600">Ubiquitination</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full shadow-sm"></div>
                <span className="text-gray-600">Methylation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-teal-600 rounded-full shadow-sm"></div>
                <span className="text-gray-600">Acetylation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-sm"></div>
                <span className="text-gray-600">Other PTMs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Variant Position */}
        <div className="mb-2">
          <h5 className="font-semibold text-base mb-3 text-red-700 flex items-center">
            🧬 <span className="ml-2">Variant Information</span>
          </h5>
          <div className="ml-6">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-4 h-4 bg-red-500 rounded-full shadow-sm"></div>
              <span className="text-gray-700">Variant position</span>
            </div>
            <p className="ml-7 text-xs text-gray-500 mt-1">Shows the exact amino acid position of the variant</p>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <h6 className="font-medium text-sm text-gray-600 mb-2">💡 How to Use:</h6>
          <div className="ml-4 text-xs text-gray-500 space-y-1">
            <p>• Click the dropdown arrows (▶/▼) next to domain tracks to expand details</p>
            <p>• Hover over features to see additional information</p>
            <p>• Use the JSON toggle to view raw data structure</p>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}; 