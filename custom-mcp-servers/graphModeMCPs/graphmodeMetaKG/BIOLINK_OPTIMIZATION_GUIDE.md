# Biolink Predicate Optimization Guide

## Overview

This guide explains how to use the Biolink predicate hierarchy to create more efficient and targeted queries for the BTE MCP, replacing the current broad 11-category default approach.

**Note**: This analysis excludes `occurs_together_in_literature_with` as it tends to produce too many low-quality co-occurrence relationships.

## Problem with Current Approach

The current Pattern 9 in the BTE MCP uses:
```javascript
// Current Pattern 9 - Too broad
n1: { 
  categories: [
    'biolink:BiologicalProcessOrActivity',
    'biolink:Gene',
    'biolink:Protein',
    'biolink:GeneFamily',
    'biolink:DiseaseOrPhenotypicFeature',
    'biolink:AnatomicalEntity',
    'biolink:RNAProduct',
    'biolink:ChemicalMixture',
    'biolink:SmallMolecule',
    'biolink:Polypeptide',
    'biolink:ProteinFamily'
  ]
}
```

**Issues:**
- Returns too many irrelevant results
- Slower query performance
- Poor relationship quality
- No category-specific optimization

## Solution: Predicate-Based Optimization

Instead of filtering by categories, use **intelligent predicate selection** based on the Biolink hierarchy.

### Key Insight

The Biolink hierarchy shows that a few **parent predicates** cover most child predicates:

- `biolink:related_to_at_instance_level` → 8 major child categories
- `biolink:affected_by` → 5 regulatory relationships  
- `biolink:affects` → 6 causal relationships
- `biolink:associated_with` → 5 association relationships
- `biolink:interacts_with` → 4 interaction relationships

## Optimized Approach

### 1. Focused Predicate Set (Recommended Default)

```javascript
// Optimized Pattern 9 - Focused
n1: {
  // No categories = get all types (more efficient)
},
edges: {
  e0: {
    subject: 'n0',
    object: 'n1',
    predicates: [
      'biolink:affected_by',
      'biolink:affects', 
      'biolink:associated_with',
      'biolink:interacts_with',
      'biolink:participates_in'
    ]
  }
}
```

### 2. Category-Specific Optimization

```javascript
// Gene queries
predicates: [
  'biolink:affects', 'biolink:affected_by', 'biolink:causes', 'biolink:contributes_to',
  'biolink:associated_with', 'biolink:correlated_with', 'biolink:coexpressed_with', 'biolink:biomarker_for'
]

// Protein queries  
predicates: [
  'biolink:interacts_with', 'biolink:physically_interacts_with', 'biolink:binds', 'biolink:coexists_with',
  'biolink:affects', 'biolink:affected_by', 'biolink:causes', 'biolink:contributes_to'
]

// Disease queries
predicates: [
  'biolink:associated_with', 'biolink:correlated_with', 'biolink:coexpressed_with', 'biolink:biomarker_for',
  'biolink:affects', 'biolink:affected_by', 'biolink:causes', 'biolink:contributes_to'
]
```

## Implementation for BTE MCP

### Step 1: Add Predicate Sets

Add this to the BTE MCP `src/index.ts`:

```typescript
const BIOLINK_PREDICATE_SETS = {
  focused: [
    'biolink:affected_by',
    'biolink:affects', 
    'biolink:associated_with',
    'biolink:interacts_with',
    'biolink:participates_in'
  ],
  causal: [
    'biolink:affects',
    'biolink:affected_by',
    'biolink:causes',
    'biolink:contributes_to'
  ],
  associational: [
    'biolink:associated_with',
    'biolink:correlated_with',
    'biolink:coexpressed_with',
    'biolink:biomarker_for'
  ],
  interaction: [
    'biolink:interacts_with',
    'biolink:physically_interacts_with',
    'biolink:binds',
    'biolink:coexists_with'
  ]
};

const CATEGORY_PREDICATE_MAP = {
  'biolink:Gene': ['causal', 'associational'],
  'biolink:Protein': ['interaction', 'causal'],
  'biolink:Disease': ['associational', 'causal'],
  'biolink:ChemicalEntity': ['causal', 'interaction'],
  'biolink:SmallMolecule': ['causal', 'interaction'],
  'biolink:Drug': ['causal', 'interaction']
};
```

### Step 2: Update Pattern 9

Replace the current Pattern 9 with:

```typescript
"Pattern 9 - Optimized comprehensive query (when user says 'everything'):\n" +
"```\n" +
"nodes: {\n" +
"  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },\n" +
"  n1: {}  // No categories = get all types efficiently\n" +
"},\n" +
"edges: {\n" +
"  e0: { \n" +
"    subject: 'n0', \n" +
"    object: 'n1',\n" +
"    predicates: [\n" +
"      'biolink:affected_by',\n" +
"      'biolink:affects',\n" +
"      'biolink:associated_with',\n" +
"      'biolink:interacts_with',\n" +
"      'biolink:participates_in'\n" +
"    ]\n" +
"  }\n" +
"}\n" +
"```\n\n" +
```

### Step 3: Add Smart Predicate Selection

Add a function to select predicates based on entity category:

```typescript
function getOptimizedPredicates(entityCategory: string): string[] {
  if (CATEGORY_PREDICATE_MAP[entityCategory]) {
    const recommendedSets = CATEGORY_PREDICATE_MAP[entityCategory];
    const predicates: string[] = [];
    
    for (const setName of recommendedSets) {
      if (BIOLINK_PREDICATE_SETS[setName]) {
        predicates.push(...BIOLINK_PREDICATE_SETS[setName]);
      }
    }
    
    return [...new Set(predicates)]; // Remove duplicates
  }
  
  return BIOLINK_PREDICATE_SETS.focused; // Default fallback
}
```

## Benefits

### Performance
- **Faster queries**: Fewer predicates = faster execution
- **Better targeting**: More relevant results
- **Reduced noise**: Less irrelevant data

### Quality
- **Higher precision**: Targeted relationship types
- **Category-aware**: Optimized for specific entity types
- **Hierarchy-based**: Leverages Biolink structure

### Flexibility
- **Multiple sets**: Different approaches for different needs
- **Easy to extend**: Add new sets as needed
- **Backward compatible**: Can still use old approach

## Comparison

| Approach | Categories | Predicates | Performance | Quality |
|----------|------------|------------|-------------|---------|
| **Current** | 11 specific | None (all) | Slow | Low precision |
| **Optimized** | None (all) | 5 focused | Fast | High precision |
| **Category-specific** | None (all) | 4-8 targeted | Fast | Very high precision |

## Migration Strategy

1. **Phase 1**: Add optimized Pattern 9 alongside current
2. **Phase 2**: Test with real queries, compare results
3. **Phase 3**: Replace current Pattern 9 with optimized version
4. **Phase 4**: Add category-specific optimization

## Files Generated

- `biolink_predicate_sets.json` - Complete predicate sets and analysis
- `biolink_predicate_optimizer.js` - JavaScript implementation
- `analyze_biolink_hierarchy.py` - Analysis script
- `BIOLINK_OPTIMIZATION_GUIDE.md` - This guide

## Next Steps

1. Integrate the optimized predicate sets into BTE MCP
2. Update Pattern 9 documentation
3. Test with real user queries
4. Monitor performance improvements
5. Add more category-specific optimizations as needed

This approach will significantly improve the quality and performance of "find all nodes related to X" queries in the BTE MCP.
