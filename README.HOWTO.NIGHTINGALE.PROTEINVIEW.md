# How to Integrate Nightingale Web Components for Protein Visualization

This document outlines the plan for integrating [Nightingale web components](https://github.com/ebi-webcomponents/nightingale) to visualize protein domains and genetic variants in the variant-domain MCP.

## Overview

Nightingale is a collection of web components developed by the European Bioinformatics Institute (EBI) specifically for visualizing biological data. We will use these components to create interactive protein domain visualizations showing where variants are located.

## Architecture

### Data Flow
```
Variant-Domain MCP 
    ↓
Returns artifact with type: "application/vnd.protein-visualization"
    ↓
ArtifactContent.tsx recognizes the new type
    ↓
Renders new ProteinVisualizationViewer component
    ↓
Component uses Nightingale web components for visualization
```

## Implementation Plan

### Step 1: Update Variant-Domain MCP ✅ COMPLETE

#### 1.1 Add New Artifact Type ✅ IMPLEMENTED
Update the variant-domain MCP to return a new artifact type for visualization data:

```typescript
// In custom-mcp-servers/variant-domain-mcp/src/index.ts

// Add a new parameter to tools or create a separate visualization tool
const visualizationData = {
  type: "application/vnd.protein-visualization",
  title: `${params.gene_symbol} Domain Visualization`,
  content: JSON.stringify({
    proteinId: uniprotId,
    sequence: uniprotSequence,
    length: uniprotSequence.length,
    tracks: [
      {
        type: "domain",
        label: "Protein Domains",
        features: domains.map(domain => ({
          accession: `domain_${domain.index}`,
          start: domain.begin,
          end: domain.end,
          color: getColorForDomain(domain.index),
          description: domain.description,
          evidence: domain.evidence
        }))
      },
      {
        type: "variant",
        label: "Variant Position",
        features: [{
          accession: "variant",
          start: variantPosition,
          end: variantPosition,
          color: "#FF0000",
          description: `${params.protein_change} (${params.coding_change || 'N/A'})`,
          shape: "diamond"
        }]
      },
      {
        type: "feature",
        label: "Functional Features",
        features: features.map((feature, idx) => ({
          accession: `feature_${idx}`,
          start: feature.begin,
          end: feature.end,
          color: getColorForFeatureType(feature.type),
          description: `${feature.type}: ${feature.description}`,
          shape: feature.begin === feature.end ? "circle" : "rectangle"
        }))
      }
    ]
  })
};
```

#### 1.2 Color Scheme Function ✅ IMPLEMENTED
```typescript
function getColorForDomain(index: number): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57",
    "#FF9FF3", "#54A0FF", "#48DBFB", "#0ABDE3", "#00D2D3"
  ];
  return colors[index % colors.length];
}

function getColorForFeatureType(type: string): string {
  const colorMap: Record<string, string> = {
    "Active site": "#FF5252",
    "Binding site": "#536DFE",
    "Site": "#FFAB40",
    "Motif": "#7C4DFF",
    "Region": "#64FFDA",
    "Default": "#9E9E9E"
  };
  return colorMap[type] || colorMap.Default;
}
```

### Step 2: Install Nightingale Components ✅ COMPLETE

Add Nightingale dependencies to the main application:

```bash
cd /Users/dr.crouse/Documents/GitHubProjects/charm-mcp
npm install @nightingale-elements/nightingale-sequence
npm install @nightingale-elements/nightingale-track
npm install @nightingale-elements/nightingale-navigation
npm install @nightingale-elements/nightingale-manager
npm install @nightingale-elements/nightingale-colored-sequence
```

✅ **Installation Status**: All 5 Nightingale packages installed successfully

### Step 3: Create ProteinVisualizationViewer Component ✅ COMPLETE

Create a new React component at `src/components/artifacts/ProteinVisualizationViewer.tsx`:

```typescript
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
```

### Step 4: Update ArtifactContent.tsx ✅ COMPLETE

Add the new artifact type handling in `src/components/artifacts/ArtifactContent.tsx`:

```typescript
// Add import at the top
import { ProteinVisualizationViewer } from './ProteinVisualizationViewer';

// In the renderContent() switch statement, add:
case 'application/vnd.protein-visualization':
  return (
    <div className="w-full h-full min-h-[500px] flex flex-col">
      <ProteinVisualizationViewer 
        data={artifact.content}
      />
    </div>
  );
```

### Step 5: TypeScript Declarations ✅ COMPLETE

Create type declarations for Nightingale components at `src/types/nightingale.d.ts`:

```typescript
declare module '@nightingale-elements/nightingale-manager' {
  export {};
}

declare module '@nightingale-elements/nightingale-sequence' {
  export {};
}

declare module '@nightingale-elements/nightingale-track' {
  export {};
}

declare module '@nightingale-elements/nightingale-navigation' {
  export {};
}

declare module '@nightingale-elements/nightingale-colored-sequence' {
  export {};
}

// Extend HTMLElementTagNameMap for TypeScript support
declare global {
  interface HTMLElementTagNameMap {
    'nightingale-manager': any;
    'nightingale-sequence': any;
    'nightingale-track': any;
    'nightingale-navigation': any;
    'nightingale-colored-sequence': any;
  }
}
```

## Testing Checkpoints

### Checkpoint 1: After Step 1 (MCP Update) ✅ PASSED
**Stop and test the data structure before proceeding**
- ✅ Test the MCP returns the new artifact type correctly
- ✅ Verify the JSON structure matches the expected format
- ✅ UniProt data retrieval tested and working
- ✅ Visualization data structure validated with real EGFR data
- Expected output:
  ```json
  {
    "type": "application/vnd.protein-visualization",
    "content": "{...valid JSON with sequence, tracks, etc...}"
  }
  ```
- ✅ Test results: 1 domain, 4 features, 1157 AA sequence, 2.1KB JSON

### Checkpoint 2: After Step 2 (Nightingale Installation) ✅ PASSED
**Verify packages installed correctly**
- ✅ Check `node_modules` for Nightingale packages (all 5 components present)
- ✅ Create a simple test HTML file to verify web components load:
  ```html
  <script type="module">
    import '@nightingale-elements/nightingale-sequence';
    console.log('Nightingale loaded successfully');
  </script>
  ```
- ✅ Test file created: `test-nightingale-load.html`

### Checkpoint 3: After Step 3 (Component Creation) ✅ PASSED
**Test the component in isolation**
- ✅ Create a test harness with mock data (`test-protein-viz-component.html`)
- ✅ Test with hardcoded visualization data using real EGFR structure
- ✅ Component structure verified:
  - ProteinVisualizationViewer component created
  - Nightingale web components imported
  - TypeScript interface defined
- Example test data:
  ```typescript
  const mockData = {
    proteinId: "C9JYS6",
    sequence: "MFNNCEVVLGNLEITYVQRNYDLSFLKTIQEVAGYVLIALNTVERIPLEN",
    length: 1157,
    tracks: [{
      type: "domain",
      label: "Protein Domains",
      features: [{
        accession: "domain_0",
        start: 659,
        end: 926,
        color: "#FF6B6B",
        description: "Protein kinase"
      }]
    }]
  };
  ```

### Checkpoint 4: After Step 4 (ArtifactContent Integration) ✅ PASSED
**Test the full integration**
- ✅ Added `application/vnd.protein-visualization` to ArtifactType union
- ✅ ArtifactContent.tsx recognizes and renders the new type  
- ✅ ProteinVisualizationViewer component imported and integrated
- ✅ TypeScript compilation passes without errors
- ✅ Build succeeds with new artifact type

### Checkpoint 5: End-to-End Testing
**Test the complete flow**
1. Call variant-domain MCP tool
2. Verify artifact appears in UI
3. Check visualization renders correctly
4. Test all interactive features
5. Verify legend displays properly

## Testing Plan

1. **Unit Testing**: Test data transformation in the MCP
2. **Integration Testing**: Verify artifact flows correctly through the system
3. **Visual Testing**: Ensure Nightingale components render properly
4. **Edge Cases**: Test with proteins of various lengths, domains, and variant positions

## Benefits

- **Professional Visualization**: EBI-quality protein visualizations
- **Interactive**: Zoom, pan, and hover for details
- **Extensible**: Easy to add more track types (PTMs, conservation scores, etc.)
- **Maintained**: Active development by EBI team
- **Standards-based**: Uses web components, works with any framework

## Future Enhancements

1. Add protein modification tracks
2. Include conservation scores
3. Show 3D structure highlights when available
4. Add export functionality (SVG/PNG)
5. Link to external databases (UniProt, PDB)
6. Support for multiple variants on same protein
7. Comparative view for multiple protein isoforms

## Resources

- [Nightingale Documentation](https://ebi-webcomponents.github.io/nightingale)
- [Nightingale GitHub Repository](https://github.com/ebi-webcomponents/nightingale)
- [Web Components MDN Guide](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [Nightingale Publication](https://doi.org/10.1093/bioadv/vbad064) 