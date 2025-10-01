# PubTator MCP Enhancement Plan

**Date:** January 2025  
**Status:** Planning  
**Priority:** High  

## 🎯 Overview

The current PubTator MCP only uses the **article-centric** approach (`/publications/export/biocjson`) which provides entities and relationships within specific papers. However, PubTator 3.0 also supports **entity-centric** queries (`/relations`) that can provide much richer relationship data across all of PubMed.

## 🔍 Current State Analysis

### What We Have Now
- **Single Tool**: `annotate-pmids` - extracts entities from specific PubMed papers
- **Limited Relationships**: Only creates generic "co-occurs with" relationships between entities in the same paper
- **Article-Centric**: Relationships are limited to what's mentioned in specific papers
- **Basic Knowledge Graph**: Simple co-occurrence network without semantic meaning

### What We're Missing
- **Entity-Centric Queries**: Access to relationships across all of PubMed for any entity
- **Semantic Relationships**: Rich relationship types like "treats", "causes", "correlates with"
- **Publication Evidence**: Count of supporting publications for each relationship
- **Comprehensive Networks**: Full biomedical knowledge graphs for entities

## 🚀 Proposed Enhancements

### 1. New Tool: `find-entity-relations`

**Purpose**: Find all relationships for a specific biomedical entity across PubMed

**Input Schema**:
```typescript
{
  name: "find-entity-relations",
  description: "Find all relationships for a specific biomedical entity across PubMed using PubTator's entity-centric API",
  inputSchema: {
    type: "object",
    properties: {
      entity_id: {
        type: "string",
        description: "Entity identifier (e.g., '@GENE_JAK1', '@CHEMICAL_Curcumin', '@DISEASE_Arthritis_Psoriatic')"
      },
      relation_type: {
        type: "string",
        description: "Optional: Filter by relationship type (e.g., 'positive_correlate', 'negative_correlate', 'stimulate', 'associate')"
      },
      max_results: {
        type: "number",
        default: 100,
        description: "Maximum number of relationships to return"
      }
    },
    required: ["entity_id"]
  }
}
```

### 2. Enhanced Knowledge Graph Structure

**Current Structure** (Co-occurrence):
```json
{
  "links": [
    {
      "source": "JAK1",
      "target": "COVID-19", 
      "label": "co-occurs with",
      "value": 1,
      "evidence": ["PMID123"]
    }
  ]
}
```

**Enhanced Structure** (Semantic Relationships):
```json
{
  "links": [
    {
      "source": "@GENE_JAK1",
      "target": "@CHEMICAL_Curcumin",
      "label": "associate",
      "value": 1,
      "evidence": ["PMID1", "PMID2"],
      "relationship_type": "associate",
      "publications": 1,
      "confidence": "high"
    },
    {
      "source": "@DISEASE_Arthritis_Psoriatic",
      "target": "@GENE_JAK1", 
      "label": "stimulate",
      "value": 1,
      "evidence": ["PMID3"],
      "relationship_type": "stimulate",
      "publications": 1,
      "confidence": "medium"
    }
  ]
}
```

### 3. Relationship Types Discovered

From testing `/relations?e1=@GENE_JAK1`, we found these relationship types:

- **`negative_correlate`**: Negative correlations (e.g., JAK1 ↔ IFNG, IL1B)
- **`positive_correlate`**: Positive correlations (e.g., JAK1 ↔ Emodin, Serotonin)
- **`stimulate`**: Disease stimulation relationships (e.g., Arthritis Psoriatic → JAK1)
- **`associate`**: General associations (hundreds of chemicals, diseases, genes)

### 4. Entity ID Formats

**Discovered Formats**:
- **Genes**: `@GENE_JAK1`, `@GENE_IFNG`, `@GENE_IL1B`
- **Chemicals**: `@CHEMICAL_Curcumin`, `@CHEMICAL_Serotonin`, `@CHEMICAL_Emodin`
- **Diseases**: `@DISEASE_Arthritis_Psoriatic`, `@DISEASE_Acne_Vulgaris`

## 📋 Implementation Plan

### Phase 1: Add Entity-Centric Tool
1. **Add new tool** `find-entity-relations` to `src/index.ts`
2. **Implement API call** to `/relations?e1={entity_id}`
3. **Add response parsing** for relationship data
4. **Create formatting functions** for entity-centric responses

### Phase 2: Enhance Knowledge Graph Creation
1. **Update `createKnowledgeGraphFromAnnotations`** to handle entity-centric data
2. **Add relationship type mapping** (negative_correlate → "negatively correlates with")
3. **Include publication evidence** in relationship metadata
4. **Add confidence scoring** based on publication count

### Phase 3: Hybrid Approach
1. **Combine both approaches**: Article-centric for paper analysis, entity-centric for network exploration
2. **Add tool selection logic**: Choose appropriate approach based on user intent
3. **Create unified knowledge graph format** that works with both data sources

### Phase 4: Advanced Features
1. **Add relationship filtering** by type, confidence, publication count
2. **Implement entity ID conversion** (NCBI Gene ID → @GENE_ format)
3. **Add batch entity queries** for multiple entities at once
4. **Create relationship pathfinding** between entities

## 🔧 Technical Implementation Details

### API Endpoint Integration
```typescript
// New function for entity-centric queries
async function makeEntityRelationsRequest(entityId: string, relationType?: string, maxResults: number = 100): Promise<any> {
  const url = new URL(`${API_BASE_URL}/relations`);
  url.searchParams.set('e1', entityId);
  if (relationType) {
    url.searchParams.set('type', relationType);
  }
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Entity relations request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}
```

### Enhanced Knowledge Graph Creation
```typescript
function createKnowledgeGraphFromEntityRelations(relationsData: any[]): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  
  for (const relation of relationsData) {
    // Create nodes for source and target entities
    const sourceNode = createNodeFromEntityId(relation.source);
    const targetNode = createNodeFromEntityId(relation.target);
    
    // Create semantic relationship link
    links.push({
      source: relation.source,
      target: relation.target,
      label: mapRelationshipType(relation.type),
      value: relation.publications,
      evidence: [], // Could be populated with PMIDs if available
      relationship_type: relation.type,
      publications: relation.publications,
      confidence: calculateConfidence(relation.publications)
    });
  }
  
  return { nodes: Array.from(nodes.values()), links, filteredCount: 0, filteredNodeCount: 0 };
}
```

## 🎯 Expected Benefits

### For Users
1. **Richer Knowledge Graphs**: Semantic relationships instead of generic co-occurrence
2. **Comprehensive Entity Networks**: Full relationship networks across all of PubMed
3. **Evidence-Based Relationships**: Publication counts supporting each relationship
4. **Flexible Querying**: Both paper-specific and entity-specific analysis

### For Biomedical Research
1. **Drug Discovery**: Find all chemicals associated with a gene
2. **Disease Research**: Discover all genes related to a disease
3. **Pathway Analysis**: Map complete biological pathways
4. **Literature Mining**: Comprehensive relationship extraction from PubMed

## 🚧 Challenges and Considerations

### Technical Challenges
1. **Entity ID Format**: Need to handle different ID formats (@GENE_ vs NCBI Gene IDs)
2. **Response Size**: Entity-centric queries can return hundreds of relationships
3. **Rate Limiting**: PubTator API may have rate limits for entity queries
4. **Data Consistency**: Ensuring consistent entity representation across tools

### User Experience
1. **Tool Selection**: Users need guidance on when to use which approach
2. **Result Size**: Large relationship networks may be overwhelming
3. **Performance**: Entity-centric queries may be slower than article-centric
4. **Visualization**: Complex relationship networks need good visualization

## 📊 Success Metrics

### Quantitative
- **Relationship Coverage**: Number of semantic relationships vs. co-occurrence relationships
- **Entity Coverage**: Number of entities with comprehensive relationship data
- **Response Time**: Performance comparison between article-centric and entity-centric queries
- **User Adoption**: Usage statistics for new entity-centric tool

### Qualitative
- **User Feedback**: Satisfaction with enhanced knowledge graphs
- **Research Impact**: Usefulness for biomedical research workflows
- **Visualization Quality**: Effectiveness of relationship network visualization
- **Integration Success**: Seamless integration with existing MCP ecosystem

## 🔄 Migration Strategy

### Backward Compatibility
1. **Keep existing `annotate-pmids` tool** unchanged
2. **Add new tool alongside** existing functionality
3. **Maintain current knowledge graph format** for existing users
4. **Provide migration path** for users wanting enhanced features

### Gradual Rollout
1. **Phase 1**: Add entity-centric tool (basic functionality)
2. **Phase 2**: Enhance knowledge graph creation (semantic relationships)
3. **Phase 3**: Add hybrid approach (best of both worlds)
4. **Phase 4**: Advanced features (filtering, pathfinding, etc.)

## 📚 Documentation Updates

### Required Updates
1. **README.md**: Add new tool documentation and examples
2. **QUICK_REFERENCE.md**: Include entity-centric query examples
3. **INDEX.md**: Update feature list and capabilities
4. **API Documentation**: Document new endpoints and response formats

### Example Documentation
```markdown
## Entity-Centric Queries

### Find All Relationships for JAK1
```bash
find-entity-relations entity_id="@GENE_JAK1" max_results=50
```

### Find Only Drug-Gene Associations
```bash
find-entity-relations entity_id="@GENE_JAK1" relation_type="associate" max_results=20
```

### Find Disease-Gene Stimulation Relationships
```bash
find-entity-relations entity_id="@GENE_JAK1" relation_type="stimulate"
```
```

## 🎉 Conclusion

The entity-centric approach represents a **major enhancement** to the PubTator MCP, transforming it from a simple paper annotation tool into a comprehensive biomedical relationship discovery platform. This enhancement will provide users with:

- **Semantic relationships** instead of generic co-occurrence
- **Comprehensive entity networks** across all of PubMed
- **Evidence-based relationships** with publication support
- **Flexible querying** for both paper and entity analysis

The implementation should be **phased and backward-compatible**, ensuring existing users can continue using the current functionality while new users can access the enhanced capabilities.

---

**Next Steps**: Begin Phase 1 implementation by adding the `find-entity-relations` tool to the PubTator MCP.
