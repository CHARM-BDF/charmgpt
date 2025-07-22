import React, { useEffect, useRef } from 'react';
import '@nightingale-elements/nightingale-manager';
import '@nightingale-elements/nightingale-sequence';
import '@nightingale-elements/nightingale-track';
import '@nightingale-elements/nightingale-navigation';
import '@nightingale-elements/nightingale-colored-sequence';

interface ProteinVisualizationData {
  proteinId: string;
  sequence: string;
  length: number;
  tracks: Array<{
    type: string;
    label: string;
    features: Array<{
      accession: string;
      start: number;
      end: number;
      color: string;
      description: string;
      shape?: string;
      evidence?: string[];
    }>;
  }>;
}

export const ProteinVisualizationViewer: React.FC<{
  data: string | ProteinVisualizationData;
}> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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

    // Create navigation
    const navigation = document.createElement('nightingale-navigation');
    navigation.setAttribute('length', vizData.length.toString());
    
    // Create sequence track
    const sequenceTrack = document.createElement('nightingale-sequence');
    sequenceTrack.setAttribute('length', vizData.length.toString());
    sequenceTrack.setAttribute('height', '30');
    sequenceTrack.setAttribute('sequence', vizData.sequence);
    sequenceTrack.setAttribute('display-start', '1');
    sequenceTrack.setAttribute('display-end', vizData.length.toString());

    // Create domain and feature tracks
    vizData.tracks.forEach((track, index) => {
      const trackElement = document.createElement('nightingale-track');
      trackElement.setAttribute('length', vizData.length.toString());
      trackElement.setAttribute('height', '40');
      trackElement.setAttribute('display-start', '1');
      trackElement.setAttribute('display-end', vizData.length.toString());
      trackElement.setAttribute('layout', track.type === 'variant' ? 'non-overlapping' : 'default');
      
      // Set track data
      (trackElement as any).data = track.features;
      
      // Add label
      const label = document.createElement('div');
      label.style.fontWeight = 'bold';
      label.style.marginTop = '10px';
      label.style.marginBottom = '5px';
      label.textContent = track.label;
      
      manager.appendChild(label);
      manager.appendChild(trackElement);
    });

    // Append all elements
    containerRef.current.appendChild(navigation);
    containerRef.current.appendChild(manager);
    containerRef.current.appendChild(sequenceTrack);

    // Connect manager to navigation
    manager.register('navigation', navigation);
    manager.register('sequence', sequenceTrack);

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [data]);

  return (
    <div className="protein-visualization-container">
      <div ref={containerRef} className="nightingale-viewer" />
      <div className="visualization-legend mt-4 p-4 bg-gray-50 rounded">
        <h4 className="font-bold mb-2">Legend</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500"></div>
            <span>Protein Domains</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500"></div>
            <span>Variant Position</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500"></div>
            <span>Functional Features</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 