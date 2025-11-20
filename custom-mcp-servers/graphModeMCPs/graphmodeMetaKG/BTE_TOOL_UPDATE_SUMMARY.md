# BTE Tool Update Summary

## What Was Updated

The `query_bte` tool in the BioThings Explorer (BTE) MCP server has been updated with comprehensive predicate information for Gene and Protein relationships, replacing the previous "what to avoid" section with affirmative examples of what to use.

## Changes Made

### 1. Replaced Negative Examples with Positive Guidance

**Before:**
- ❌ AVOID: biolink:has_molecular_function (not a valid predicate)
- ❌ AVOID: biolink:has_pathway (not a valid predicate)
- Limited list of 10 basic predicates

**After:**
- ✅ Comprehensive predicate reference with 100+ predicates
- ✅ Organized by relationship type and use case
- ✅ Clear examples of when to use each predicate

### 2. Added Comprehensive Predicate Categories

**Most Common Predicates (use these first):**
- biolink:affects, biolink:interacts_with, biolink:related_to
- biolink:regulates, biolink:causes, biolink:disrupts
- biolink:participates_in, biolink:produces, biolink:correlated_with

**Gene-Specific Predicates (40+ predicates):**
- Co-expression: biolink:coexpressed_with, biolink:colocalizes_with
- Homology: biolink:homologous_to, biolink:orthologous_to
- Genetic interactions: biolink:genetically_interacts_with
- Functional: biolink:capable_of, biolink:catalyzes, biolink:enables
- Regulatory: biolink:regulates, biolink:regulated_by
- Upstream effects: biolink:acts_upstream_of_positive_effect
- Associations: biolink:associated_with_increased_likelihood_of
- And many more...

**Protein-Specific Predicates (20+ predicates):**
- Physical interactions: biolink:physically_interacts_with
- Substrate relationships: biolink:is_substrate_of, biolink:has_substrate
- Active ingredients: biolink:is_active_ingredient_of
- Sequence variants: biolink:is_sequence_variant_of
- Assessment: biolink:assesses, biolink:is_assessed_by
- Response: biolink:increases_response_to, biolink:decreases_response_to
- And many more...

**Therapeutic Focus Predicates:**
- biolink:treats, biolink:treats_or_applied_or_studied_to_treat
- biolink:applied_to_treat, biolink:preventative_for_condition

**Functional Relationship Predicates:**
- biolink:enables, biolink:contributes_to, biolink:capable_of
- biolink:catalyzes, biolink:assesses

**Hierarchical Relationship Predicates:**
- biolink:subclass_of, biolink:superclass_of
- biolink:part_of, biolink:has_part, biolink:has_member

**Interaction Type Predicates:**
- biolink:physically_interacts_with, biolink:directly_physically_interacts_with
- biolink:genetically_interacts_with, biolink:in_complex_with

**Response/Pharmacology Predicates:**
- biolink:increases_response_to, biolink:decreases_response_to
- biolink:response_affected_by, biolink:sensitivity_associated_with

**Literature/Co-occurrence Predicates:**
- biolink:occurs_together_in_literature_with
- biolink:coexpressed_with, biolink:colocalizes_with, biolink:coexists_with

### 3. Added New Query Pattern Examples

**Pattern 4 - Gene-Protein relationships:**
```javascript
nodes: {
  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },
  n1: { categories: ['biolink:Protein'] }
},
edges: {
  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:produces'] }
}
```

**Pattern 5 - Protein-Protein interactions:**
```javascript
nodes: {
  n0: { ids: ['UniProtKB:P12345'], categories: ['biolink:Protein'] },
  n1: { categories: ['biolink:Protein'] }
},
edges: {
  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:physically_interacts_with'] }
}
```

**Pattern 6 - Drug-target relationships:**
```javascript
nodes: {
  n0: { ids: ['DrugBank:DB00001'], categories: ['biolink:Drug'] },
  n1: { categories: ['biolink:Protein'] }
},
edges: {
  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:affects'] }
}
```

**Pattern 7 - Gene regulation:**
```javascript
nodes: {
  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },
  n1: { categories: ['biolink:Gene'] }
},
edges: {
  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:regulates'] }
}
```

**Pattern 8 - Molecular functions:**
```javascript
nodes: {
  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },
  n1: { categories: ['biolink:MolecularActivity'] }
},
edges: {
  e0: { subject: 'n0', object: 'n1', predicates: ['biolink:capable_of'] }
}
```

## Benefits

1. **Comprehensive Coverage**: 100+ predicates covering all major relationship types
2. **Better LLM Guidance**: Clear examples of what to use instead of what to avoid
3. **Organized by Use Case**: Predicates grouped by relationship type for easy reference
4. **Real Examples**: Concrete query patterns showing proper usage
5. **Gene & Protein Focus**: Extensive coverage of the most important biomedical entities

## Files Modified

- `custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP/src/index.ts` - Updated tool description
- Built successfully with `npm run build`

## Impact

The LLM will now have access to:
- 100+ specific predicates with clear descriptions
- 8 concrete query pattern examples
- Organized predicate categories for easy selection
- Positive guidance on what to use rather than what to avoid

This should significantly improve the quality and specificity of BTE queries generated by the LLM, especially for Gene and Protein relationship queries.
