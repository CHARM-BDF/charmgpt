# PubTator MCP Tools Reference

This document provides an overview of all available PubTator tools in the GraphMode PubTator MCP server, explaining what each tool does and how they differ from each other.

## Table of Contents

1. [Node Extraction Tools](#node-extraction-tools)
2. [Relationship Discovery Tools](#relationship-discovery-tools)
3. [Publication Search Tools](#publication-search-tools)
4. [Tool Comparison Matrix](#tool-comparison-matrix)

---

## Node Extraction Tools

These tools extract biomedical entities (nodes) from various sources and add them to the graph.

### `addNodesFromPMIDs`

**Purpose**: Extract entities and their relationships from specific PubMed articles by their PMIDs.

**What it does**:
- Takes an array of PubMed IDs (PMIDs)
- Retrieves entity annotations and relationships from those publications
- Creates nodes for entities found in the literature (genes, diseases, chemicals, etc.)
- Creates edges for relationships between entities when available

**Key Parameters**:
- `pmids`: Array of PubMed IDs (max 100)
- `concepts`: Types of entities to extract (gene, disease, chemical, species, mutation, cellline, snp, protein)
- `databaseContext`: Required

**Data Processing Flow**:
```
Input: Array of PMIDs ["12345678", "23456789", ...]
  ↓
For each PMID:
  API Call: GET /annotations/PMID:{pmid}
  Returns: JSON { 
    annotations: [{id, name, type, mentions, ...}],
    relations: [{e1, e2, type, pmid, ...}] (if available)
  }
  ↓
Processing:
  1. Filter entities by concepts parameter
  2. Deduplicate by entity ID
  3. Map entity types to graph types
  4. Create node data structures with:
     - label: entity.name
     - type: mapped entity type
     - data: { pubtatorId, source: 'pubtator', pmid, entityType, mentions }
  5. Process relations if available:
     - Only create edges for entities that were processed
     - Map relationship types
     - Create edge data structures with PMID in publications array
  ↓
Graph Addition:
  - Nodes: All unique entities from all PMIDs
  - Edges: Relationships between entities (if relations are in response)
  ↓
Summary:
  - Count of nodes created/skipped
  - Count of edges created/skipped
  - List of entity types found
```

---

### `addNodesAndEdgesFromText`

**Purpose**: Extract entities and their relationships from free text input.

**What it does**:
- Takes arbitrary text (abstracts, paragraphs, sentences)
- Uses PubTator's text annotation service
- Creates nodes for identified entities
- Creates edges for relationships between entities found in the text

**Key Parameters**:
- `text`: Free text to analyze (max 100,000 characters)
- `concepts`: Types of entities to extract
- `databaseContext`: Required

**Data Processing Flow**:
```
Input: Free text string
  ↓
API Call: POST /annotations/
  Body: { text: "...", concepts: [...] }
  Returns: JSON { 
    annotations: [{id, name, type, mentions, ...}],
    relations: [{e1, e2, type, pmid, ...}] (if available)
  }
  ↓
Processing:
  1. Filter entities by concepts parameter
  2. Deduplicate by entity ID
  3. Map entity types to graph types
  4. Create node data structures with:
     - label: entity.name
     - type: mapped entity type
     - data: { pubtatorId, source: 'pubtator', entityType, mentions }
  5. Process relations if available:
     - Only create edges for entities found in the text
     - Map relationship types
     - Create edge data structures
  ↓
Graph Addition:
  - Nodes: All unique entities found in text
  - Edges: Relationships between entities (if relations are in response)
  ↓
Summary:
  - Count of nodes created/skipped
  - Count of edges created/skipped
  - List of entity types found
```

---

### `addNodesByName`

**Purpose**: Look up entities by name and add them as nodes (no edges created).

**What it does**:
- Takes an array of entity names (e.g., "BRCA1", "TP53", "EGFR")
- Looks them up in PubTator's database
- Creates individual nodes without any relationships/edges

**Key Parameters**:
- `entityNames`: Array of entity names (max 100)
- `conceptType`: Optional filter by entity type
- `databaseContext`: Required

**Data Processing Flow**:
```
Input: Array of entity names ["BRCA1", "TP53", "EGFR", ...]
  ↓
For each entity name:
  API Call: GET /autocomplete/?query={name}&concept={conceptType}
  Returns: JSON [{id, name, type, ...}]
  ↓
Processing:
  1. Take best match (first result from autocomplete)
  2. If conceptType specified, filter matches
  3. Deduplicate by entity ID
  4. Map entity types to graph types
  5. Create node data structures with:
     - label: entity.name
     - type: mapped entity type
     - data: { pubtatorId, source: 'pubtator', entityType }
  ↓
Graph Addition:
  - Nodes: All successfully looked up entities
  - Edges: None
  ↓
Summary:
  - Count of nodes created/skipped
  - List of found entities
  - List of not found entities
```

---

## Relationship Discovery Tools

These tools find relationships between entities and create edges in the graph.

### `findRelatedEntities`

**Purpose**: Find entities of a specific type related to a given source entity.

**What it does**:
- Takes a source entity (name and type)
- Finds all related entities of a specified target type
- Creates nodes for related entities and edges showing the relationships
- Filters by relationship type if specified

**Key Parameters**:
- `sourceEntity`: Name of source entity (e.g., "FAM177A1")
- `sourceType`: Type of source (gene, disease, chemical, etc.)
- `targetType`: Type of entities to find (e.g., "gene" to find all genes related to source)
- `relationshipTypes`: Optional filter (associate, inhibit, stimulate, etc.)
- `maxResults`: Max entities to return (default: 20, max: 100)
- `databaseContext`: Required

**Data Processing Flow**:
```
Input: sourceEntity name, sourceType, targetType
  ↓
Step 1: Find source entity
  API Call: GET /autocomplete/?query={sourceEntity}&concept={sourceType}
  Returns: JSON [{id, name, type, ...}]
  Takes first match as sourceEntityId
  ↓
Step 2: Find related entities
  API Call: GET /relations?e1={sourceEntityId}
  Returns: JSON [{id, type, e1, e2, pmid, ...}]
  ↓
Processing:
  1. Filter relations by targetType (check e2 entity type)
  2. Filter by relationshipTypes if specified
  3. Limit to maxResults
  4. For each relation:
     - Lookup e2 entity details (autocomplete)
     - Map relationship type (e.g., "associate" → "associated_with")
     - Create node for target entity (if not exists)
     - Create edge: sourceEntity → relationType → targetEntity
  ↓
Graph Addition:
  - Nodes: Source entity + all target entities
  - Edges: Relationship edges with specific types
  ↓
Summary:
  - Count of nodes created/skipped
  - Count of edges created/skipped
  - List of relationship types found
```

---

### `findAllRelatedEntities`

**Purpose**: Find ALL entities related to a given entity, regardless of type.

**What it does**:
- Takes a source entity (name and type)
- Finds related entities of ALL types (genes, diseases, chemicals, etc.)
- Creates a comprehensive network showing all relationships
- Does not filter by target entity type

**Key Parameters**:
- `sourceEntity`: Name of source entity
- `sourceType`: Type of source entity
- `relationshipTypes`: Optional filter by relationship type
- `maxResults`: Max entities to return (default: 30, max: 100)
- `databaseContext`: Required

**Data Processing Flow**:
```
Input: sourceEntity name, sourceType
  ↓
Step 1: Find source entity
  API Call: GET /autocomplete/?query={sourceEntity}&concept={sourceType}
  Returns: JSON [{id, name, type, ...}]
  Takes first match as sourceEntityId
  ↓
Step 2: Find related entities (ALL types)
  API Call: GET /relations?e1={sourceEntityId}
  Returns: JSON [{id, type, e1, e2, pmid, ...}]
  ↓
Processing:
  1. Filter by relationshipTypes if specified
  2. Limit to maxResults
  3. Group relations by target entity type
  4. For each relation:
     - Lookup e2 entity details (autocomplete) - ALL types
     - Map relationship type
     - Create node for target entity (if not exists)
     - Create edge: sourceEntity → relationType → targetEntity
  ↓
Graph Addition:
  - Nodes: Source entity + all related entities (all types)
  - Edges: Relationship edges with specific types
  ↓
Summary:
  - Count of nodes created/skipped
  - Count of edges created/skipped
  - Breakdown by entity type
  - List of relationship types found
```

---

### `addNodesFromEntityNetwork`

**Purpose**: Build a network by searching for entities and their relationships.

**What it does**:
- Takes a search query and entity concept type
- Finds entities matching the query
- Discovers relationships between those entities and their connections
- Creates a network graph with nodes and edges

**Key Parameters**:
- `query`: Search query (e.g., "BRCA1", "cancer", "insulin")
- `concept`: Type of entity to search for
- `max_entities`: Max entities to find (default: 20, max: 50)
- `max_relations_per_entity`: Max relationships per entity (default: 200, max: 500)
- `relationship_types`: Optional filter
- `databaseContext`: Required

**Data Processing Flow**:
```
Input: Search query string, concept type
  ↓
Step 1: Find entities matching query
  API Call: GET /autocomplete/?query={query}&concept={concept}
  Returns: JSON [{id, name, type, ...}]
  Limit to max_entities
  ↓
Step 2: For each entity, find relationships
  For each entity:
    API Call: GET /relations?e1={entityId}
    Returns: JSON [{id, type, e1, e2, pmid, ...}]
    Filter by relationship_types if specified
    Limit to max_relations_per_entity
    ↓
    Processing:
      1. Lookup e2 entity details (autocomplete)
      2. Map relationship type
      3. Create nodes for connected entities
      4. Create edges between entities
  ↓
Graph Addition:
  - Nodes: All entities found + their connected entities
  - Edges: Relationship edges showing connections
  ↓
Summary:
  - Count of nodes created/skipped
  - Count of edges created/skipped
  - Network statistics
```

---

## Publication Search Tools

These tools search publications and extract information from them.

### `findPublicationsByTerm`

**Purpose**: Search for publications containing a term, retrieve abstracts, and optionally extract entities.

**What it does**:
- Searches for publications matching a search term
- Returns abstracts and publication metadata
- Optionally extracts entities from abstracts and adds them to graph
- Creates "publishedTogether" edges between entities from the same publication

**Key Parameters**:
- `searchTerm`: Search term (can be entity ID like @GENE_672 or free text)
- `maxResults`: Max publications (default: 10, max: 50)
- `addEntitiesToGraph`: Boolean to add entities (default: false)
- `databaseContext`: Required if `addEntitiesToGraph` is true

**Data Processing Flow**:
```
Input: searchTerm, maxResults, addEntitiesToGraph
  ↓
Step 1: Search for publications
  API Call: GET /search/?text={searchTerm}
  Returns: JSON { results: [{pmid, title, authors, journal, date, ...}] }
  Limit to maxResults
  ↓
Step 2 (if no results): Try entity ID lookup
  API Call: GET /autocomplete/?query={searchTerm}&concept=gene
  If found, search again with entity ID format
  ↓
Step 3: Extract PMIDs and fetch abstracts
  API Call: GET /publications/export/biocjson?pmids={pmid1,pmid2,...}&full=true
  Returns: BioC JSON format { PubTator3: [{id, passages: [...], ...}] }
  ↓
Step 4: Parse BioC JSON
  Processing:
    - Extract abstracts from passages
    - Extract entities from title/abstract passages only
    - Filter by entity types
    - Create publication metadata map
  ↓
Step 5 (if addEntitiesToGraph=true):
  - Create nodes for unique entities
  - Create "publishedTogether" edges between entities from same publication
  - Consolidate edges (merge PMIDs for same entity pairs)
  ↓
Graph Addition (if enabled):
  - Nodes: All unique entities from abstracts
  - Edges: "publishedTogether" (generic co-occurrence edges)
  ↓
Summary:
  - List of publications with full abstracts
  - Entity summary by type
  - Graph addition stats (if enabled)
```

**Differences from `findSearchTermPublicationRelationships`**:
- Returns full abstracts for reading/summarization
- Creates generic "publishedTogether" edges (not specific relationship types)
- Focuses on entity co-occurrence, not pre-extracted relationships
- Can work without adding to graph (returns publications only)

**Example**: Find publications about "FAM177A1" and optionally extract entities.

---

### `findSearchTermPublicationRelationships`

**Purpose**: Search publications and extract pre-computed relationships between entities.

**What it does**:
- Searches for publications matching a term
- Extracts document-level relations (PRE-EXTRACTED by PubTator)
- Creates edges with actual relationship types (Association, inhibit, stimulate, interact, etc.)
- Returns a simplified response: edges (subject, predicate, object), nodes, and PMID lists
- Does NOT return abstracts (avoids overwhelming summaries)

**Key Parameters**:
- `searchTerm`: Search term (e.g., "FAM177A1")
- `maxResults`: Max publications to process (default: 10, max: 50)
- `relationshipTypes`: Optional filter by relationship type
- `databaseContext`: Required

**Data Processing Flow**:
```
Input: searchTerm, maxResults, relationshipTypes (optional)
  ↓
Step 1: Search for publications
  API Call: GET /search/?text={searchTerm}
  Returns: JSON { results: [{pmid, title, authors, journal, date, ...}] }
  Limit to maxResults
  ↓
Step 2 (if no results): Try entity ID lookup
  API Call: GET /autocomplete/?query={searchTerm}&concept=gene
  If found, search again with entity ID format
  ↓
Step 3: Export publications with relations (PRE-EXTRACTED)
  API Call: GET /publications/export/biocjson?pmids={pmid1,pmid2,...}&full=true
  Returns: BioC JSON { PubTator3: [{id, passages: [...], relations: [...]}] }
  Note: relations array is PRE-EXTRACTED by PubTator (not generated on-the-fly)
  ↓
Step 4: Parse BioC JSON
  Processing:
    - Extract entities from title/abstract passages
    - Extract relations from doc.relations array:
      * relation.infons.type → relationship type
      * relation.infons.role1.accession → entity1 ID
      * relation.infons.role2.accession → entity2 ID
    - Filter by relationshipTypes if specified
    - Consolidate relations (group by entity1+entity2+type, merge PMIDs)
  ↓
Step 5: Create graph elements
  - Create nodes for all entities involved in relations
  - Create edges with actual relationship types (not "publishedTogether")
  - Map relation types (e.g., "Association" → "associated_with")
  - Check for existing edges and merge PMIDs
  ↓
Graph Addition:
  - Nodes: All entities involved in relations
  - Edges: Specific relationship types (inhibits, stimulates, etc.)
  ↓
Summary (simplified, no abstracts):
  - Publication counts (with/without relations)
  - PubMed IDs with relations
  - Relation statistics
  - List of distinct nodes
  - List of edges (subject → predicate → object) with PMIDs
```

**Differences from `findPublicationsByTerm`**:
- Extracts pre-computed relationships (not just entity mentions)
- Creates edges with specific relationship types (not generic "publishedTogether")
- Returns edges in subject-predicate-object format
- No abstracts returned (concise output)
- Lists PMIDs of publications that contained relations

**Example**: Find the edges from papers about FAM177A1.

---

### `findPublicationsForRelationship`

**Purpose**: Find publications that discuss a specific relationship between two entities.

**What it does**:
- Takes two entities (IDs and names)
- Searches for publications discussing their relationship
- Returns abstracts and bibliography in markdown format
- Does NOT add anything to the graph (read-only)

**Key Parameters**:
- `entity1Id`: First entity ID (e.g., @GENE_MPO)
- `entity1Name`: First entity name for display
- `entity2Id`: Second entity ID
- `entity2Name`: Second entity name
- `relationshipType`: Type to search for (associate, inhibit, stimulate, interact, ANY)
- `maxResults`: Max publications (default: 10, max: 20)
- No `databaseContext` needed (read-only)

**Data Processing Flow**:
```
Input: entity1Id, entity1Name, entity2Id, entity2Name, relationshipType
  ↓
Step 1: Search for publications discussing relationship
  API Call: GET /search/?text=relations:{relationshipType}|{entity1Id}|{entity2Id}
  Returns: JSON { results: [{pmid, title, authors, journal, date, text_hl, ...}] }
  Limit to maxResults
  ↓
Processing:
  1. Extract publication metadata (title, authors, journal, year)
  2. Clean abstract text (remove markup from text_hl)
  3. Format as markdown bibliography
  ↓
Graph Addition:
  - Nodes: None (read-only tool)
  - Edges: None
  ↓
Summary:
  - Markdown formatted list of publications
  - Each publication includes:
    * Title, Authors, Journal, Year
    * Full abstract
    * Link to PubMed
  - Bibliography format suitable for reading/reference
```

---

## Tool Comparison Matrix

| Tool | Input Type | Creates Nodes? | Creates Edges? | Edge Types | Returns Abstracts? | Use Case |
|------|-----------|----------------|----------------|------------|-------------------|----------|
| `addNodesFromPMIDs` | PMIDs | Yes | Yes | Specific types | No | Extract entities and relationships from specific papers |
| `addNodesAndEdgesFromText` | Free text | Yes | Yes | Specific types | No | Extract entities and relationships from text |
| `addNodesByName` | Entity names | Yes | No | N/A | No | Add specific entities without relationships |
| `findRelatedEntities` | Source entity + target type | Yes | Yes | Specific types | No | Find related entities of one type |
| `findAllRelatedEntities` | Source entity | Yes | Yes | Specific types | No | Find all related entities (all types) |
| `addNodesFromEntityNetwork` | Search query | Yes | Yes | Specific types | No | Build network from search |
| `findPublicationsByTerm` | Search term | Optional | Optional ("publishedTogether") | Generic | Yes | Search publications, read abstracts |
| `findSearchTermPublicationRelationships` | Search term | Yes | Yes | Specific types | No | Extract relationships from publications |
| `findPublicationsForRelationship` | Two entities | No | No | N/A | Yes | Find papers about specific relationship |

---

## Quick Decision Guide

**I want to...**

- **Add entities from specific papers**: Use `addNodesFromPMIDs`
- **Extract entities and relationships from text I provide**: Use `addNodesAndEdgesFromText`
- **Add specific entities by name**: Use `addNodesByName`
- **Find genes related to a gene**: Use `findRelatedEntities` (sourceType: gene, targetType: gene)
- **Find everything related to an entity**: Use `findAllRelatedEntities`
- **Build a network from a topic**: Use `addNodesFromEntityNetwork`
- **Search and read publications**: Use `findPublicationsByTerm` (set `addEntitiesToGraph: false`)
- **Extract relationships from publications**: Use `findSearchTermPublicationRelationships`
- **Find papers about a specific relationship**: Use `findPublicationsForRelationship`

---

## Notes on Edge Types

### Generic Edges
- **"publishedTogether"**: Created by `findPublicationsByTerm` when entities co-occur in the same publication. Does not indicate a specific relationship type, just that they were mentioned together.

### Specific Relationship Types
Created by relationship tools (`findRelatedEntities`, `findAllRelatedEntities`, `findSearchTermPublicationRelationships`, etc.):
- **"associated_with"**: General association
- **"inhibits"**: One entity inhibits another
- **"stimulates"**: One entity stimulates another
- **"interacts_with"**: Entities interact
- **"negatively_correlates_with"**: Negative correlation
- **"positively_correlates_with"**: Positive correlation
- And others (treats, causes, cotreats, converts, compares, prevents, drug_interacts_with)

---

## Key Differences Summary

1. **`findPublicationsByTerm` vs `findSearchTermPublicationRelationships`**:
   - `findPublicationsByTerm`: Returns abstracts, creates generic "publishedTogether" edges, focuses on entity extraction
   - `findSearchTermPublicationRelationships`: No abstracts, creates specific relationship types, focuses on pre-extracted relations

2. **`findRelatedEntities` vs `findAllRelatedEntities`**:
   - `findRelatedEntities`: Filters by target entity type (e.g., find only genes)
   - `findAllRelatedEntities`: Finds all entity types related to source

3. **Node extraction tools vs Relationship tools**:
   - Node extraction tools (`addNodesFrom*`): Only create nodes, no edges
   - Relationship tools (`find*`): Create both nodes and edges

4. **Publication tools**:
   - `findPublicationsByTerm`: Search and optionally extract entities
   - `findSearchTermPublicationRelationships`: Search and extract relationships
   - `findPublicationsForRelationship`: Find papers about known relationship (read-only)

