import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface PFOCRData {
  summary?: {
    total_genesets: number;
    genesets_with_genes: number;
    genesets_with_chemicals: number;
    genesets_with_diseases: number;
  };
  genesets?: Array<{
    id: string;
    title: string;
    description: string;
    pmc: string;
    figureUrl: string;
    pfocrUrl: string;
    associatedWith: {
      figureUrl: string;
      pfocrUrl: string;
      pmc: string;
      mentions: {
        genes: {
          ncbigene: string[];
        };
        chemicals: {
          mesh: string[];
          chebi: string[];
        };
        diseases: {
          mesh: string[];
          doid: string[];
        };
      };
    };
  }>;
  metadata?: {
    biothing_type: string;
    build_date: string;
    build_version: string;
    stats: {
      total: number;
    };
    version: string;
    [key: string]: any;
  };
  fields?: any;
}

interface PFOCRViewerProps {
  data: PFOCRData;
}

interface PFOCRViewerState {
  viewMode: 'rendered' | 'source';
}

export const PFOCRViewer: React.FC<PFOCRViewerProps> = ({ data }) => {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');

  // Parse data if it's a string
  const parsedData = React.useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error('Failed to parse PFOCR data:', error);
        return null;
      }
    }
    return data;
  }, [data]);

  const handleImageError = (genesetId: string) => {
    setImageErrors(prev => new Set(prev).add(genesetId));
  };

  const formatTitle = (id: string): string => {
    // Extract meaningful title from ID
    const parts = id.split('__');
    if (parts.length > 1) {
      return parts[1].replace(/_/g, ' ').replace(/fig/g, 'Figure ');
    }
    return id;
  };

  const renderAnnotations = (mentions: any, type: 'genes' | 'chemicals' | 'diseases') => {
    const items: string[] = [];
    
    if (type === 'genes' && mentions.genes?.ncbigene) {
      items.push(...mentions.genes.ncbigene.map((gene: string) => `NCBIGene:${gene}`));
    }
    
    if (type === 'chemicals') {
      if (mentions.chemicals?.mesh) {
        items.push(...mentions.chemicals.mesh.map((chem: string) => `MeSH:${chem}`));
      }
      if (mentions.chemicals?.chebi) {
        items.push(...mentions.chemicals.chebi.map((chem: string) => `ChEBI:${chem}`));
      }
    }
    
    if (type === 'diseases') {
      if (mentions.diseases?.mesh) {
        items.push(...mentions.diseases.mesh.map((disease: string) => `MeSH:${disease}`));
      }
      if (mentions.diseases?.doid) {
        items.push(...mentions.diseases.doid.map((disease: string) => `DOID:${disease}`));
      }
    }

    if (items.length === 0) return null;

    const displayItems = items.slice(0, 10);
    const remaining = items.length - 10;

    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          {type === 'genes' && '🧬 Genes'}
          {type === 'chemicals' && '🧪 Chemicals'}
          {type === 'diseases' && '🦠 Diseases'}
          <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">
            {items.length}
          </span>
        </h4>
        <div className="flex flex-wrap gap-2">
          {displayItems.map((item, index) => (
            <span
              key={index}
              className={`px-3 py-1 rounded-full text-xs font-mono ${
                type === 'genes' ? 'bg-green-100 text-green-800 border border-green-200' :
                type === 'chemicals' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {item}
            </span>
          ))}
          {remaining > 0 && (
            <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600 border border-gray-200">
              +{remaining} more
            </span>
          )}
        </div>
      </div>
    );
  };

  // Handle source view
  if (viewMode === 'source') {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">PFOCR Data Source</h3>
          <button
            onClick={() => setViewMode('rendered')}
            className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
          >
            View Rendered
          </button>
        </div>
        <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md">
          <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
            PFOCR JSON Data
          </div>
          <div className="p-4">
            <SyntaxHighlighter
              language="json"
              style={oneLight}
              customStyle={{ margin: 0, background: 'transparent' }}
            >
              {JSON.stringify(parsedData, null, 2)}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
    );
  }

  // Handle no data case
  if (!parsedData || (!parsedData.genesets && !parsedData.metadata)) {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">PFOCR Data</h3>
          <button
            onClick={() => setViewMode('source')}
            className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
          >
            View Source
          </button>
        </div>
        <div className="p-8 text-center text-gray-500">
          <h3 className="text-lg font-semibold mb-2">No PFOCR Data Available</h3>
          <p>No pathway figures or metadata found in the artifact data.</p>
        </div>
      </div>
    );
  }

  // Handle metadata-only case
  if (parsedData.metadata && !parsedData.genesets) {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">PFOCR Database Metadata</h3>
          <button
            onClick={() => setViewMode('source')}
            className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
          >
            View Source
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">📊 Database Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Genesets</div>
              <div className="text-2xl font-bold text-blue-600">{parsedData.metadata.stats?.total || 'Unknown'}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Build Date</div>
              <div className="text-lg font-semibold text-green-600">
                {parsedData.metadata.build_date ? new Date(parsedData.metadata.build_date).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Version</div>
              <div className="text-lg font-semibold text-purple-600">{parsedData.metadata.version || 'Unknown'}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Biothing Type</div>
              <div className="text-lg font-semibold text-orange-600">{parsedData.metadata.biothing_type || 'Unknown'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div></div>
        <button
          onClick={() => setViewMode('source')}
          className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
        >
          View Source
        </button>
      </div>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">🧬 PFOCR Pathway Figures</h1>
        <p className="text-blue-100">Biomedical pathway analysis from scientific literature</p>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">📊 Analysis Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{parsedData.summary?.total_genesets || 0}</div>
            <div className="text-sm text-gray-600">Total Pathway Figures</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{parsedData.summary?.genesets_with_genes || 0}</div>
            <div className="text-sm text-gray-600">With Gene Annotations</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{parsedData.summary?.genesets_with_chemicals || 0}</div>
            <div className="text-sm text-gray-600">With Chemical Annotations</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{parsedData.summary?.genesets_with_diseases || 0}</div>
            <div className="text-sm text-gray-600">With Disease Annotations</div>
          </div>
        </div>
      </div>

      {/* Genesets */}
      <div className="space-y-6">
        {parsedData.genesets?.map((geneset, index) => {
          const title = geneset.title || formatTitle(geneset.id);
          const figureUrl = geneset.associatedWith?.figureUrl || geneset.figureUrl;
          const pfocrUrl = geneset.associatedWith?.pfocrUrl || geneset.pfocrUrl;
          const pmc = geneset.associatedWith?.pmc || geneset.pmc;
          const mentions = geneset.associatedWith?.mentions || {};

          return (
            <div key={geneset.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4">
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <div className="flex items-center gap-2">
                  <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-mono">
                    {geneset.id}
                  </span>
                  {pmc && (
                    <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">
                      PMC: {pmc}
                    </span>
                  )}
                </div>
              </div>

              {/* Figure */}
              <div className="p-6">
                {figureUrl && !imageErrors.has(geneset.id) ? (
                  <div className="text-center mb-4">
                    <img
                      src={figureUrl}
                      alt={title}
                      className="max-w-full h-auto rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                      onError={() => handleImageError(geneset.id)}
                      onClick={() => window.open(figureUrl, '_blank')}
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center mb-4">
                    <div className="text-gray-400 text-4xl mb-2">📷</div>
                    <p className="text-gray-600">Figure image not available</p>
                    {pmc && (
                      <p className="text-sm text-gray-500 mt-1">PMC ID: {pmc}</p>
                    )}
                  </div>
                )}

                {/* Links */}
                <div className="flex flex-wrap gap-3 justify-center mb-6">
                  {pfocrUrl && (
                    <a
                      href={pfocrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      🔗 PFOCR View
                    </a>
                  )}
                  {pmc && (
                    <a
                      href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmc}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      📄 PMC Article
                    </a>
                  )}
                  {figureUrl && (
                    <a
                      href={figureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      🖼️ View Image
                    </a>
                  )}
                </div>

                {/* Annotations */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Biomedical Annotations</h4>
                  {renderAnnotations(mentions, 'genes')}
                  {renderAnnotations(mentions, 'chemicals')}
                  {renderAnnotations(mentions, 'diseases')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
