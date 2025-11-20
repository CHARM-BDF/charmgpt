# Default Category Set Update for BTE Tool

## What Was Added

The `query_bte` tool has been updated with a **default category set** based on your handwritten list of high-priority biomedical categories. When users say "everything" or don't specify categories, the tool will now default to these 11 categories.

## Default Category Set

When users say "everything" or don't specify categories, use these 11 high-priority categories:

| # | Your Handwritten List | SmartAPI Equivalent | Associations | Description |
|---|----------------------|-------------------|--------------|-------------|
| 1 | Biological Process Or Activity | `biolink:BiologicalProcessOrActivity` | 27 | Biological processes and activities |
| 2 | Gene Or Protein | `biolink:Gene` | 1,041 | Genes and genetic elements |
| 3 | Gene Or Protein | `biolink:Protein` | 1,063 | Proteins and protein targets |
| 4 | Gene Family | `biolink:GeneFamily` | 378 | Gene families and target classes |
| 5 | Disease Or Phenotypic Feature | `biolink:DiseaseOrPhenotypicFeature` | 732 | Diseases and phenotypes |
| 6 | Anatomical Entity | `biolink:AnatomicalEntity` | 638 | Tissues, organs, anatomical structures |
| 7 | RNA Product | `biolink:RNAProduct` | 202 | RNA molecules and transcripts |
| 8 | Chemical Mixture | `biolink:ChemicalMixture` | 217 | Chemical mixtures and complexes |
| 9 | Small Molecule | `biolink:SmallMolecule` | 1,063 | Small molecules and drug candidates |
| 10 | Polypeptide | `biolink:Polypeptide` | 642 | Polypeptides and peptide sequences |
| 11 | Protein Family | `biolink:ProteinFamily` | 12 | Protein families and domains |

## Key Features Added

### 1. **Default Behavior**
- When user says "everything" → Use all 11 default categories
- When user doesn't specify categories → Use all 11 default categories
- When user specifies specific categories → Use only those categories

### 2. **Clear Instructions**
```
- User says 'everything' or doesn't specify → Use DEFAULT CATEGORY SET (11 categories above)
```

### 3. **Comprehensive Query Pattern**
Added Pattern 9 showing how to use the default category set:

```javascript
nodes: {
  n0: { ids: ['NCBIGene:4353'], categories: ['biolink:Gene'] },
  n1: { categories: [
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
  ] }  // ← Default comprehensive category set
},
edges: {
  e0: { subject: 'n0', object: 'n1' }  // ← NO predicate for comprehensive search
}
```

### 4. **Enhanced Category Selection Guide**
Added specific guidance for each default category:
- Find proteins related to X → biolink:Protein (NO predicate)
- Find gene families for X → biolink:GeneFamily (NO predicate)
- Find anatomical structures for X → biolink:AnatomicalEntity (NO predicate)
- Find RNA products for X → biolink:RNAProduct (NO predicate)
- Find chemical mixtures for X → biolink:ChemicalMixture (NO predicate)
- Find polypeptides for X → biolink:Polypeptide (NO predicate)
- Find protein families for X → biolink:ProteinFamily (NO predicate)

## Benefits

1. **Comprehensive Coverage**: The 11 default categories cover the most important biomedical entity types
2. **High Association Counts**: Total of 5,974+ associations across all default categories
3. **User-Friendly**: Clear default behavior when users don't specify what they want
4. **Flexible**: Users can still specify other categories when they want something specific
5. **MCP-Optimized**: Language specifically tailored for MCP tool usage

## Usage Examples

**User says:** "Find everything related to BRCA1"
**Tool uses:** All 11 default categories

**User says:** "Find genes related to BRCA1"  
**Tool uses:** Only `biolink:Gene`

**User says:** "Find proteins and diseases related to BRCA1"
**Tool uses:** Only `biolink:Protein` and `biolink:Disease`

## Files Updated

- `custom-mcp-servers/graphModeMCPs/graphmodeBTEMCP/src/index.ts` ✅
- Built successfully with `npm run build` ✅

The LLM will now have clear guidance on when to use the comprehensive default category set versus specific categories, making queries more comprehensive and user-friendly!
