# Literature Network Analysis & Expansion Strategy
## Implementation Report for Developers

---

## EXECUTIVE SUMMARY

This report defines the network analysis calculations and expansion strategies for the literature review dashboard. The system will build a multi-layered knowledge graph from PubTator-extracted entities and relationships, then strategically expand it through targeted searches to maximize coverage and insight.

**Core Deliverables:**
1. Network topology analysis (modularity, centrality, clustering)
2. Tiered expansion strategy (single searches → pair searches → missing edge searches)
3. Visualization framework distinguishing primary vs. expanded data
4. Bridge/boundary identification for highlighting key connections

---

## PART 1: NETWORK ANALYSIS CALCULATIONS

### 1.1 Input Data Structure

**Entities:**
```python
{
  'name': str,
  'type': str,  # Gene, Disease, Chemical, Species, CellLine, Chromosome, Variant
  'papers': list[str],  # PMIDs
  'id': str  # Optional PubTator ID
}
```

**Relationships:**
```python
{
  'entity1': str,  # entity name
  'entity2': str,
  'type': str,  # Association, Positive_Correlation, Negative_Correlation, Bind, etc.
  'papers': list[str],  # PMIDs where relationship appears
  'relationship_sources': str  # Where extracted from (title/abstract/MeSH)
}
```

**Co-occurrences (optional, for enhanced analysis):**
```python
{
  'entity1': str,
  'entity2': str,
  'shared_papers': int,  # Count of papers mentioning both
  'papers': list[str]  # PMIDs
}
```

### 1.2 Core Metrics to Calculate

#### A. MODULARITY & CLUSTERING

**Purpose:** Determine if network has distinct clusters or is integrated

**Calculation:**
- Algorithm: Louvain method (greedy modularity optimization)
- Input: Network graph
- Output: 
  - `modularity_score`: float (0-1)
  - `cluster_assignments`: dict {node_id: cluster_id}

**Interpretation:**
```
modularity_score > 0.4  → Tight clusters (distinct research domains)
modularity_score 0.2-0.4 → Loose clusters (moderate integration)
modularity_score < 0.1  → Fully integrated OR hub-dependent
```

**Implementation:**
```python
from networkx.algorithms import community

communities = community.greedy_modularity_communities(G)
modularity = community.modularity(G, communities)
clusters = {node: idx for idx, comm in enumerate(communities) 
            for node in comm}
```

#### B. CLUSTERING COEFFICIENT

**Purpose:** Measure local tightness of connections (triadic closure)

**Calculation:** For each node, if A connects to B and C, does B connect to C?

```python
clustering_coeffs = nx.clustering(G)
avg_clustering = np.mean(list(clustering_coeffs.values()))
```

**Interpretation:**
```
avg_clustering > 0.3 → Tightly knit neighborhoods
avg_clustering 0.1-0.3 → Mixed local structure
avg_clustering < 0.1 → Sparse local connections
```

**Output by entity type:**
```python
by_type = defaultdict(list)
for node, coeff in clustering_coeffs.items():
    etype = G.nodes[node]['entity_type']
    by_type[etype].append(coeff)
return {etype: np.mean(vals) for etype, vals in by_type.items()}
```

#### C. CENTRALITY MEASURES

**Purpose:** Identify important/hub entities

**Calculations:**

1. **Degree Centrality** - Direct connections
```python
degree_centrality = nx.degree_centrality(G)
```

2. **Betweenness Centrality** - Appears on shortest paths (bridge potential)
```python
betweenness = nx.betweenness_centrality(G, weight='weight')
```

3. **Closeness Centrality** - Average distance to all other nodes
```python
closeness = nx.closeness_centrality(G, distance='weight')
```

4. **Eigenvector Centrality** - Connected to other important nodes
```python
# Only for networks < 1000 nodes
eigenvector = nx.eigenvector_centrality(G, weight='weight', max_iter=1000)
```

**Output format:**
```python
centrality_measures = {
    'degree': {node: score, ...},
    'betweenness': {node: score, ...},
    'closeness': {node: score, ...},
    'eigenvector': {node: score, ...}
}
```

#### D. NETWORK DENSITY & CONNECTIVITY

**Purpose:** Measure overall connectedness

**Calculations:**

```python
# Overall density
total_possible = len(G.nodes()) * (len(G.nodes()) - 1) / 2
actual_edges = len(G.edges())
overall_density = actual_edges / total_possible

# Components
components = list(nx.connected_components(G))
num_components = len(components)
largest_comp_size = max(len(c) for c in components)
largest_comp_pct = largest_comp_size / len(G.nodes())

# Average path length (largest component only)
if nx.is_connected(G):
    avg_path = nx.average_shortest_path_length(G, weight='weight')
    diameter = nx.diameter(G)
else:
    largest = G.subgraph(max(components, key=len))
    avg_path = nx.average_shortest_path_length(largest, weight='weight')
    diameter = nx.diameter(largest)
```

**Output:**
```python
{
    'overall_density': float,
    'num_components': int,
    'largest_component_pct': float,
    'average_path_length': float,
    'diameter': int,
    'is_connected': bool
}
```

#### E. SCALE-FREE PROPERTIES

**Purpose:** Identify power-law distribution (hub + periphery structure)

**Calculation:**

```python
degrees = [d for n, d in G.degree()]

# Gini coefficient (0=equal, 1=unequal)
sorted_deg = sorted(degrees)
n = len(sorted_deg)
gini = (2 * sum(i * d for i, d in enumerate(sorted_deg, 1))) / \
       (n * sum(sorted_deg)) - (n + 1) / n

# Degree distribution stats
scale_free_signature = gini > 0.3
```

**Output:**
```python
{
    'mean_degree': float,
    'median_degree': float,
    'max_degree': int,
    'min_degree': int,
    'std_degree': float,
    'gini_coefficient': float,
    'scale_free_signature': bool,  # gini > 0.3
    'ratio_max_to_median': float
}
```

#### F. CLUSTER ANALYSIS

**Purpose:** Characterize properties of each cluster

**Calculations per cluster:**

```python
for cluster_id, nodes in clusters_by_id.items():
    subgraph = G.subgraph(nodes)
    
    # Entity type composition
    entity_types = defaultdict(int)
    for node in nodes:
        entity_types[G.nodes[node]['entity_type']] += 1
    
    # Internal vs external edges
    internal_edges = 0
    external_edges = 0
    for u, v in G.edges():
        if clusters[u] == clusters[v]:
            internal_edges += 1
        else:
            external_edges += 1
    
    # Cohesion (internal/(internal+external))
    cohesion = internal_edges / (internal_edges + external_edges + 1e-6)
    
    # Homogeneity (entity type uniformity)
    type_counts = np.array(list(entity_types.values()))
    entropy = -np.sum((type_counts/type_counts.sum()) * 
                      np.log2(type_counts/type_counts.sum() + 1e-10))
    max_entropy = np.log2(len(entity_types))
    homogeneity = 1 - (entropy / max_entropy if max_entropy > 0 else 0)
    
    clusters_info[cluster_id] = {
        'size': len(nodes),
        'entity_types': dict(entity_types),
        'internal_edges': internal_edges,
        'external_edges': external_edges,
        'cohesion': cohesion,
        'homogeneity': homogeneity,
        'nodes': list(nodes)
    }
```

#### G. BRIDGE NODE IDENTIFICATION

**Purpose:** Find nodes connecting different clusters

**Calculation:**

```python
bridges = {}
for node in G.nodes():
    cluster_id = clusters[node]
    connected_clusters = set()
    
    for neighbor in G.neighbors(node):
        neighbor_cluster = clusters[neighbor]
        if neighbor_cluster != cluster_id:
            connected_clusters.add(neighbor_cluster)
    
    if len(connected_clusters) > 1:
        bridges[node] = {
            'cluster': cluster_id,
            'bridges_to': list(connected_clusters),
            'num_bridges': len(connected_clusters),
            'bridge_edges': [n for n in G.neighbors(node) 
                           if clusters[n] != cluster_id]
        }

# Sort by bridging importance
sorted_bridges = sorted(bridges.items(), 
                       key=lambda x: x[1]['num_bridges'], 
                       reverse=True)
```

#### H. ORPHANED ENTITY DETECTION

**Purpose:** Find entities with no relationships (potential gaps or frontier)

**Calculation:**

```python
orphaned = []
for node in G.nodes():
    if G.degree(node) == 0:
        orphaned.append({
            'entity': node,
            'type': G.nodes[node]['entity_type'],
            'publications': G.nodes[node].get('publications', 0),
            'papers': G.nodes[node].get('papers', [])
        })

# Sort by publication frequency
orphaned = sorted(orphaned, 
                 key=lambda x: x['publications'], 
                 reverse=True)
```

### 1.3 Quality Metrics

**Data Completeness:**
```python
entities_in_relationships = len(set(
    e for rel in relationships 
    for e in [rel['entity1'], rel['entity2']]
))
data_completeness = entities_in_relationships / len(entities)
```

**Network Sparsity:**
```python
possible_edges = len(G.nodes()) * (len(G.nodes()) - 1) / 2
actual_edges = len(G.edges())
sparsity = 1 - (actual_edges / possible_edges)
```

**Relationship Type Distribution:**
```python
rel_types = defaultdict(int)
for rel in relationships:
    rel_types[rel['type']] += 1
rel_distribution = {k: (v, v/len(relationships)) 
                    for k, v in rel_types.items()}
```

---

## PART 2: EXPANSION STRATEGIES

### 2.1 Overview

The expansion process adds papers and entities to the network in stages:

1. **TIER 0 (Primary)**: Original search results + extracted entities/relationships
2. **TIER 1 (Expansion)**: Papers from targeted seed searches
3. **TIER 2 (Exploration)**: Papers from pair searches and missing edge searches

Each expansion stage adds:
- New papers (and thus PMIDs to track)
- New entities
- New relationships
- **Bridge edges**: Connections between Tier N and Tier N-1 (HIGH VALUE)

### 2.2 TIER 1: SINGLE-SEED EXPANSION

**Purpose:** Expand coverage by searching entities as new seeds

**When to use:** When initial search returns <100 papers (left capacity)

**Selection criteria (prioritize in order):**

1. **Bridge nodes** (Tier 0 clustering analysis result)
   - Nodes with betweenness_centrality > 0.1
   - Connect multiple clusters
   - Example: "TNF", "NFKB1"

2. **High-frequency orphans** (degree=0, publications > 3)
   - Appear frequently but isolated
   - May indicate extraction issues or emerging research
   - Example: "lipid" (9 papers but 0 connections)

3. **Cluster-specific hubs** (highest degree within cluster)
   - Explore each cluster deeply
   - Example: "FAM177A1" within developmental cluster

4. **Peripheral nodes** (degree 1-2, publications 2-5)
   - Frontier research areas
   - Low redundancy expected
   - Example: Rare gene/disease combinations

**Scoring for automated selection:**

```python
def score_expansion_seeds(G, clusters):
    scores = {}
    
    for node in G.nodes():
        # Base: betweenness centrality (bridge potential)
        betweenness = nx.betweenness_centrality(G)[node]
        
        # Bonus: if orphaned high-frequency entity
        degree = G.degree(node)
        publications = G.nodes[node].get('publications', 1)
        orphan_bonus = (publications / 10) if degree == 0 else 0
        
        # Adjust: avoid hubs (already well-searched)
        if degree > 20:
            betweenness *= 0.3
        
        scores[node] = betweenness + orphan_bonus
    
    return sorted(scores.items(), 
                 key=lambda x: x[1], 
                 reverse=True)
```

**Implementation:**

For each selected seed entity:
```python
1. Query PubTator: papers containing [seed_entity]
2. Limit to papers not already in primary set
3. Extract entities and relationships from new papers
4. Add to network with tier_level='expansion'
5. Track bridge_edges (entities connecting back to Tier 0)
```

**Output tracking:**

```python
expansion_tier_1 = {
    'seed_searches': [
        {
            'seed_entity': str,
            'papers_found': int,
            'new_papers': int,
            'new_entities': int,
            'new_relationships': int,
            'bridge_edges': [(e1, e2, type), ...],
            'status': 'completed'|'in_progress'
        },
        ...
    ],
    'cumulative': {
        'total_new_papers': int,
        'total_new_entities': int,
        'total_new_relationships': int,
        'total_bridge_edges': int
    }
}
```

### 2.3 TIER 2A: PAIR SEARCHES (Co-occurrence Validation)

**Purpose:** Validate suspected relationships and fill inter-cluster connections

**When to use:** After Tier 1 or as alternative to maximize depth

**Selection criteria (prioritize in order):**

1. **Hub-to-hub pairs** (both degree > threshold)
   - Highest structural impact if connected
   - Example: "cancer + TNF", "cancer + lipid"
   - Threshold: Top 15-20 nodes by degree
   - Pairs to search: O(n²) but n is small (~210 pairs)

2. **Same entity-type high-frequency pairs** (no existing edge)
   - Within-domain silos
   - Example: Two genes both 5+ papers but never studied together
   - By type: check Gene-Gene, Disease-Disease, Chemical-Chemical
   - Filter: degree_A > 2 AND degree_B > 2 AND no edge
   - Score by: degree_A × degree_B

3. **Cluster boundary pairs** (from different clusters, no edge)
   - Find cluster boundary nodes (high external edges)
   - Search pairs across clusters
   - Score by: (external_edges_A × external_edges_B)

**Scoring for pair selection:**

```python
def score_pair_searches(G, clusters):
    candidate_pairs = []
    
    nodes = list(G.nodes())
    
    for i, node_a in enumerate(nodes):
        for node_b in nodes[i+1:]:
            if G.has_edge(node_a, node_b):
                continue  # Skip existing edges
            
            deg_a = G.degree(node_a)
            deg_b = G.degree(node_b)
            
            # Hub-to-hub
            hub_score = deg_a * deg_b if deg_a > 5 and deg_b > 5 else 0
            
            # Same type, high frequency
            same_type = 1 if (G.nodes[node_a]['entity_type'] == 
                             G.nodes[node_b]['entity_type']) else 0.3
            
            # Bridge potential
            cluster_a = clusters.get(node_a)
            cluster_b = clusters.get(node_b)
            bridge_bonus = 2 if cluster_a != cluster_b else 0.5
            
            score = (hub_score + deg_a + deg_b) * same_type * bridge_bonus
            
            if score > 5:  # Only include meaningful candidates
                candidate_pairs.append({
                    'pair': (node_a, node_b),
                    'score': score,
                    'type': 'hub' if hub_score > 0 else 'boundary'
                })
    
    return sorted(candidate_pairs, 
                 key=lambda x: x['score'], 
                 reverse=True)[:100]  # Top 100
```

**Implementation:**

```python
For each pair (entity_a, entity_b):
    1. Query PubTator: papers containing BOTH entities
    2. If papers found:
        - Add as relationship (type: 'co-occurrence_validated')
        - Mark confidence by paper count
        - Note: This is HIGH confidence evidence
    3. Track result
```

**Output tracking:**

```python
pair_searches = {
    'searches_completed': int,
    'pairs_with_results': int,
    'new_edges_found': int,
    'results': [
        {
            'entity_a': str,
            'entity_b': str,
            'papers_found': int,
            'pmids': list[str],
            'confidence': 'high'|'medium'|'low'  # Based on paper count
        },
        ...
    ]
}
```

### 2.4 TIER 2B: MISSING EDGE LINK PREDICTION

**Purpose:** Find high-impact missing edges likely to exist

**Selection strategy (do in phases):**

**Phase 1: Hub pairs only** (~50-100 searches)
```python
# Only search top 15-20 nodes by degree
hub_nodes = sorted(G.nodes(), 
                  key=lambda n: G.degree(n), 
                  reverse=True)[:20]

candidate_pairs = []
for i, a in enumerate(hub_nodes):
    for b in hub_nodes[i+1:]:
        if not G.has_edge(a, b):
            score = G.degree(a) * G.degree(b)
            candidate_pairs.append({
                'pair': (a, b),
                'score': score,
                'impact': 'HIGH'
            })

sorted_pairs = sorted(candidate_pairs, 
                     key=lambda x: x['score'], 
                     reverse=True)
```

**Phase 2: Same-type high-frequency pairs** (~200-300 searches)
```python
def score_missing_edges_phase2(G):
    candidates = []
    
    # Group by entity type
    by_type = defaultdict(list)
    for node in G.nodes():
        etype = G.nodes[node]['entity_type']
        if G.degree(node) > 1:  # Only meaningful nodes
            by_type[etype].append(node)
    
    # Within each type, find unconnected high-frequency pairs
    for etype, nodes in by_type.items():
        for i, a in enumerate(nodes):
            for b in nodes[i+1:]:
                if not G.has_edge(a, b):
                    score = (G.degree(a) + G.degree(b)) / 2
                    candidates.append({
                        'pair': (a, b),
                        'score': score,
                        'impact': 'MEDIUM'
                    })
    
    return sorted(candidates, 
                 key=lambda x: x['score'], 
                 reverse=True)[:200]
```

**Phase 3: 2-hop paths with common neighbors** (~100-200 searches)
```python
def score_2hop_same_type(G):
    candidates = []
    
    for node_a in G.nodes():
        if G.degree(node_a) < 1:
            continue
        
        type_a = G.nodes[node_a]['entity_type']
        
        # Find all 2-hop neighbors of same type
        neighbors_1 = set(G.neighbors(node_a))
        
        for neighbor in neighbors_1:
            for node_b in G.neighbors(neighbor):
                if (node_b != node_a and 
                    not G.has_edge(node_a, node_b) and
                    G.nodes[node_b]['entity_type'] == type_a):
                    
                    common = len(neighbors_1 & set(G.neighbors(node_b)))
                    score = common ** 2 / (G.degree(node_a) * G.degree(node_b) + 1)
                    
                    if score > 0.5:
                        candidates.append({
                            'pair': (node_a, node_b),
                            'score': score,
                            'common_neighbors': common,
                            'impact': 'MEDIUM'
                        })
    
    return sorted(candidates, 
                 key=lambda x: x['score'], 
                 reverse=True)[:150]
```

**Implementation:**

```python
For each candidate pair (entity_a, entity_b):
    1. Query PubTator: papers containing BOTH entities
    2. If papers found:
        - Potential link confirmed
        - Mark as 'undiscovered_relationship'
        - High value for users
    3. Track result
```

**Output tracking:**

```python
missing_edge_searches = {
    'phase': 1|2|3,
    'candidates_searched': int,
    'edges_found': int,
    'new_insights': [
        {
            'entity_a': str,
            'entity_b': str,
            'predicted_score': float,
            'actual_papers': int,
            'validation': 'confirmed'|'not_found',
            'pmids': list[str]
        },
        ...
    ]
}
```

### 2.5 ORGANISM VALIDATION SEARCHES (Sub-strategy)

**Purpose:** Map which discoveries are validated in model organisms

**Selection:** Cross each gene/protein hub with major organism models

```python
organisms = ['mouse', 'zebrafish', 'c_elegans', 'drosophila', 'human']

for hub_gene in top_genes:
    for organism in organisms:
        search_pair(hub_gene, organism)
```

**Output:** Shows translation/validation landscape

---

## PART 3: TIERED DATA STRUCTURE

### 3.1 Network Layers

Maintain separate subgraphs but with cross-layer tracking:

```python
class TieredNetwork:
    def __init__(self):
        self.tier_0 = nx.Graph()  # Original search results
        self.tier_1 = nx.Graph()  # Expansion results
        self.tier_2 = nx.Graph()  # Deep exploration (pairs, missing edges)
        self.bridge_edges = []    # Cross-tier edges
        
    @property
    def full_network(self):
        """Combine all tiers"""
        G = nx.compose_all([self.tier_0, self.tier_1, self.tier_2])
        return G
    
    def get_network_by_tier(self, tier):
        """Get subgraph for specific tier"""
        return getattr(self, f'tier_{tier}')
    
    def add_bridge_edge(self, u, v, tier_from, tier_to):
        """Track edges connecting tiers"""
        self.bridge_edges.append({
            'from': u,
            'to': v,
            'tier_from': tier_from,
            'tier_to': tier_to,
            'importance': 'HIGH'
        })
```

### 3.2 Node & Edge Attributes

**Node attributes:**
```python
node_attrs = {
    'entity_type': str,  # Gene, Disease, etc.
    'publications': int,  # Count
    'papers': list,  # PMIDs
    'tier_level': 0|1|2,  # Where discovered
    'date_added': datetime,
    'centrality_measures': {
        'degree': float,
        'betweenness': float,
        'closeness': float,
        'eigenvector': float
    },
    'cluster_id': int  # Assigned cluster
}
```

**Edge attributes:**
```python
edge_attrs = {
    'relationship_type': str,  # Association, Bind, etc.
    'weight': float,  # Co-occurrence count or explicit count
    'papers': list,  # PMIDs where relationship appears
    'confidence': float,  # Based on paper count / total papers mentioning each
    'tier_level': 0|1|2,  # Where discovered
    'is_bridge': bool,  # Connects to previous tier
    'discovery_method': 'direct'|'cooccurrence'|'pair_search'|'missing_edge'
}
```

---

## PART 4: VISUALIZATION & REPORTING

### 4.1 Data Layers for Display

**Primary Section (Tier 0):**
- Entities from original search
- Relationships explicitly extracted
- All calculations on Tier 0 data
- Visualization: Full opacity, bold edges

**Expansion Section (Tier 1):**
- New entities from seed searches
- New relationships within expanded papers
- Visualization: Medium opacity, lighter edges

**Bridge Connections (Tier 1 ↔ Tier 0):**
- Edges connecting new entities back to original network
- **HIGHLIGHT THESE** - show user these are the connecting points
- Visualization: Bright color, emphasized

**Deep Exploration (Tier 2):**
- Results from pair searches and link prediction
- Usually sparse; validate with user
- Visualization: Dashed lines or special marker

### 4.2 Reporting Output Format

**Summary Statistics:**

```json
{
  "primary_network": {
    "tier": 0,
    "source": "FAM177A1 search",
    "papers": 97,
    "entities": 512,
    "relationships": 306,
    "orphaned_entities": 441,
    "network_metrics": {
      "modularity": 0.25,
      "clustering_coefficient": 0.18,
      "average_path_length": 3.2,
      "diameter": 8,
      "scale_free": true,
      "components": 1
    }
  },
  "expansion_tier_1": {
    "seed_searches_completed": 5,
    "new_papers": 23,
    "new_entities": 47,
    "new_relationships": 18,
    "bridge_edges": 12
  },
  "pair_searches": {
    "candidates_evaluated": 150,
    "confirmed_edges": 8,
    "validation_rate": 0.053
  }
}
```

**Entity Importance Ranking:**

```json
{
  "top_entities": [
    {
      "entity": "patients",
      "type": "Species",
      "degree": 48,
      "betweenness": 0.45,
      "cluster": 0,
      "role": "hub",
      "papers": 48
    },
    {
      "entity": "TNF",
      "type": "Gene",
      "degree": 12,
      "betweenness": 0.23,
      "cluster": 1,
      "role": "bridge",
      "bridges_to": [0, 2],
      "papers": 5
    },
    ...
  ]
}
```

**Bridge Analysis:**

```json
{
  "bridge_nodes": [
    {
      "entity": "TNF",
      "from_cluster": 1,
      "to_clusters": [0, 2],
      "cross_cluster_edges": 7,
      "papers_with_both": 3,
      "innovation_potential": "HIGH"
    },
    ...
  ],
  "cluster_connectivity": {
    "0-1": {"edges": 5, "bridge_nodes": ["TNF", "NFKB1"]},
    "1-2": {"edges": 2, "bridge_nodes": ["cancer"]},
    ...
  }
}
```

**Expansion Status:**

```json
{
  "expansion_history": [
    {
      "stage": 1,
      "seed_entity": "TNF",
      "papers_found": 34,
      "new_to_dataset": 12,
      "bridge_edges_created": 3,
      "status": "completed"
    },
    ...
  ]
}
```

### 4.3 Visualization Requirements

**Network Graph:**
- **Color by tier**: Tier 0 = solid, Tier 1 = lighter, Tier 2 = dashed
- **Color by cluster**: Distinct colors per cluster
- **Size by degree**: Node size ∝ connection count
- **Highlight bridges**: Special marker or glow effect
- **Edge width**: Proportional to confidence/paper count

**Network Statistics Panel:**
- Display modularity, clustering coefficient, scale-free properties
- Show "Integrated vs. Clustered" interpretation
- Display component count and connectivity

**Expansion Timeline:**
- Show progression of expansions
- Display cumulative metrics
- Show paper accumulation curve

**Bridge Explorer:**
- Interactive tool to find paths between entities
- Highlight bridge nodes on paths
- Show papers supporting each hop

---

## PART 5: IMPLEMENTATION PHASES

### Phase 1: Core Analysis (Required)
- [x] Build network from PubTator output
- [x] Calculate all metrics in Section 1.2
- [x] Detect clusters and bridges
- [x] Generate summary statistics

### Phase 2: Primary Display (Required)
- [x] Display network with Tier 0 data
- [x] Show entity rankings by centrality
- [x] Display cluster structure
- [x] Highlight orphaned entities

### Phase 3: Expansion Framework (Recommended)
- [x] Implement Tier 1 seed search scoring
- [x] Execute seed searches and integration
- [x] Track and display bridge edges
- [x] Show expansion statistics

### Phase 4: Pair Search Validation (Recommended)
- [x] Implement Phase 1 hub-pair searches
- [x] Validate key relationships
- [x] Display confirmed edges separately
- [x] Show confidence scoring

### Phase 5: Link Prediction (Optional)
- [x] Implement Phase 1 missing edge detection
- [x] Show high-probability missing edges
- [x] Allow user validation

### Phase 6: Advanced Analysis (Optional)
- [x] Temporal evolution tracking
- [x] Citation network expansion
- [x] Conflicting evidence searches
- [x] Synonym expansion with ontologies

---

## PART 6: CONFIGURATION & THRESHOLDS

### Default Parameters

```python
CONFIG = {
    # Clustering
    'clustering_algorithm': 'louvain',
    'modularity_threshold_tight': 0.4,
    'modularity_threshold_loose': 0.2,
    
    # Expansion seeds
    'max_tier1_seeds': 10,
    'seed_degree_threshold': 3,
    'seed_betweenness_threshold': 0.05,
    
    # Pair searches
    'max_hub_pairs': 100,
    'max_sametype_pairs': 300,
    'max_2hop_pairs': 150,
    'hub_degree_threshold': 5,
    
    # Centrality calculations
    'eigenvector_max_iter': 1000,
    'betweenness_normalized': True,
    
    # Quality thresholds
    'min_papers_for_entity': 1,
    'min_papers_for_relationship': 1,
    'confidence_threshold': 0.0
}
```

### Adjustable Parameters

```python
# User-facing parameters
ADJUSTABLE = {
    'min_entity_frequency': int,  # Minimum papers to include entity
    'min_edge_confidence': float,  # Minimum papers for relationship
    'cluster_sensitivity': float,  # Affects modularity detection
    'expansion_depth': 0|1|2,  # How far to expand
    'tie_breaking_metric': 'degree'|'betweenness'|'publication_count'
}
```

---

## PART 7: ERROR HANDLING & VALIDATION

### Data Quality Checks

```python
def validate_input(entities, relationships):
    errors = []
    
    # Check entity uniqueness
    entity_names = [e['name'] for e in entities]
    if len(entity_names) != len(set(entity_names)):
        errors.append("Duplicate entity names")
    
    # Check relationships reference valid entities
    valid_entities = set(entity_names)
    for rel in relationships:
        if rel['entity1'] not in valid_entities:
            errors.append(f"Unknown entity in relationship: {rel['entity1']}")
        if rel['entity2'] not in valid_entities:
            errors.append(f"Unknown entity in relationship: {rel['entity2']}")
    
    # Check for self-loops
    for rel in relationships:
        if rel['entity1'] == rel['entity2']:
            errors.append(f"Self-loop detected: {rel['entity1']}")
    
    return errors if errors else True
```

### Calculation Robustness

- Handle disconnected graphs (compute on largest component when needed)
- Handle single-node networks (return appropriate defaults)
- Handle eigenvector centrality failures (use alternative if needed)
- Timeout protection on expensive calculations (betweenness, eigenvector)

---

## PART 8: TESTING & VALIDATION

### Unit Tests

```python
def test_modularity_calculation():
    # Test on known structures
    # Fully connected graph: modularity ~0
    # Two clusters: modularity > 0.4
    
def test_centrality_measures():
    # Verify against hand-calculated examples
    # Check bounds (0 ≤ centrality ≤ 1)
    
def test_bridge_detection():
    # Create network with clear bridges
    # Verify correct identification
    
def test_orphaned_detection():
    # Add isolated nodes
    # Verify detection
```

### Integration Tests

```python
def test_full_analysis_pipeline():
    # Load test data (provided PubTator output)
    # Run full analysis
    # Validate output structure
    # Check numeric ranges
```

### Manual Validation

- Compare clustering against domain expert knowledge
- Validate bridge nodes make logical sense
- Check visualization against actual network structure
- Spot-check papers for extracted relationships

---

## PART 9: PERFORMANCE CONSIDERATIONS

### Computational Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Modularity (Louvain) | O(n log n) | Fast, suitable for real-time |
| Betweenness centrality | O(n³) | Expensive; use for <5k nodes |
| Eigenvector centrality | O(n²) | Iterative; use max_iter=1000 |
| Clustering coefficient | O(n³) worst | Usually much faster in practice |
| Average path length | O(n+m) | Only on largest component |

### Optimization Strategies

- Cache centrality calculations (reuse when network doesn't change)
- Compute betweenness only for top N nodes if network > 2k nodes
- Use approximate algorithms for large networks
- Parallelize pair search queries if implemented

### Expected Runtime

- Network analysis (512 entities): < 5 seconds
- Expansion Phase 1 (5-10 seed searches): 1-2 minutes
- Pair searches Phase 1 (50-100 pairs): 5-15 minutes
- Full pipeline to completion: 30-60 minutes

---

## PART 10: DELIVERABLES CHECKLIST

**Core Implementation:**
- [ ] Network construction from PubTator output
- [ ] All metrics calculations (Section 1.2 A-H)
- [ ] Tiered data structure (Section 3)
- [ ] Cluster/bridge detection
- [ ] Summary statistics generation

**Expansion Implementation:**
- [ ] Tier 1 seed search scoring
- [ ] Tier 2A pair search execution
- [ ] Bridge edge tracking
- [ ] Expansion status reporting

**Display & Reporting:**
- [ ] Network visualization with tier differentiation
- [ ] Entity ranking displays
- [ ] Bridge node highlighting
- [ ] Summary statistics panels
- [ ] Expansion history timeline

**Documentation:**
- [ ] Code comments for all calculations
- [ ] API documentation for network operations
- [ ] Configuration documentation
- [ ] Example output formats

---

## PART 11: REFERENCE IMPLEMENTATION NOTES

### Key Libraries

```python
# Graph analysis
import networkx as nx
from networkx.algorithms import community

# Numerical operations
import numpy as np
from collections import defaultdict

# Data handling
import pandas as pd
import json

# API calls (for expansion)
import requests  # or httpx for async
```

### Example Data Flow

```python
# 1. Parse PubTator output
entities, relationships = parse_pubtator_output(pubtator_json)

# 2. Validate
if not validate_input(entities, relationships):
    raise ValueError("Invalid input")

# 3. Build network
net = LiteratureNetwork(entities, relationships)

# 4. Calculate all metrics
analysis = {
    'modularity': net.calculate_modularity(),
    'clustering': net.calculate_clustering_coefficients(),
    'centrality': net.calculate_centrality_measures(),
    'density': net.calculate_density_metrics(),
    'scale_free': net.analyze_scale_free_properties(),
    'clusters': net.analyze_clusters(clusters),
    'bridges': net.find_bridge_nodes(clusters),
    'orphaned': net.find_orphaned_entities()
}

# 5. Generate report
report = generate_analysis_report(net, analysis)

# 6. Expansion (optional)
if user_wants_expansion:
    expansion = plan_tier1_seeds(net, analysis)
    execute_expansions(expansion)
    update_network(net, new_entities, new_relationships)
```

---

## CONCLUSION

This report provides a complete specification for implementing network analysis and strategic expansion of literature mining datasets. The approach balances computational efficiency with depth of analysis, providing users with insights into research structure, opportunities for discovery, and organized navigation through complex literature landscapes.

**Key principles:**
1. **Layered analysis**: Primary results → expanded coverage → deep exploration
2. **Smart prioritization**: Focus expansion on high-impact nodes and edges
3. **Transparent layering**: Show users exactly what's primary vs. expanded
4. **Bridge-centric**: Highlight connections between research domains
5. **Validation-ready**: Provide metrics and evidence for all findings