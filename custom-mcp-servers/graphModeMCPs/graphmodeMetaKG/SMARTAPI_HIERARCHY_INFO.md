# SmartAPI MetaKG - Hierarchy Information

## Overview

Yes, **predicates and categories DO have hierarchies** in the Biolink Model, and you can access some of this information through the SmartAPI MetaKG API.

## How to Access Hierarchy Information

### 1. Using the `subclass_of` Predicate

The SmartAPI MetaKG contains hierarchy relationships through the `subclass_of` predicate. You can query for these directly:

```bash
curl -s "https://smart-api.info/api/metakg?predicate=subclass_of&size=1000"
```

**Example Results:**
```
Protein -> subclass_of -> MolecularEntity
Protein -> subclass_of -> ChemicalEntity
SmallMolecule -> subclass_of -> ChemicalEntity
SmallMolecule -> subclass_of -> Drug
Gene -> subclass_of -> GenomicEntity
Drug -> subclass_of -> ChemicalEntity
MolecularEntity -> subclass_of -> ChemicalEntity
```

### 2. Using the `expand` Parameter

The API documentation mentions an `expand` parameter that should expand queries based on the Biolink Model hierarchical structure:

```bash
curl -s "https://smart-api.info/api/metakg?subject=Protein&expand=all&size=100"
```

**Expand Options:**
- `subject` - Expand subject hierarchy
- `object` - Expand object hierarchy
- `predicate` - Expand predicate hierarchy
- `node` - Expand node hierarchies
- `edge` - Expand edge hierarchies
- `all` - Expand all hierarchies

**Note:** In practice, the expand parameter appears to expand the **query** to include hierarchical relationships (e.g., querying for Protein will also return results for its parent classes), but it doesn't return explicit hierarchy metadata in the response.

## Biolink Model Hierarchy

The formal Biolink Model hierarchy is defined externally at:
- **Model Specification:** https://biolink.github.io/biolink-model/
- **GitHub:** https://github.com/biolink/biolink-model
- **YAML File:** https://raw.githubusercontent.com/biolink/biolink-model/master/biolink-model.yaml

### Category (Class) Hierarchy Examples

The Biolink Model defines entity classes in a hierarchy:

```
NamedThing (root)
├── BiologicalEntity
│   ├── GenomicEntity
│   │   ├── Gene
│   │   ├── Transcript
│   │   └── Exon
│   ├── MolecularEntity
│   │   ├── ChemicalEntity
│   │   │   ├── SmallMolecule
│   │   │   ├── Drug
│   │   │   └── MolecularMixture
│   │   ├── Protein
│   │   ├── Polypeptide
│   │   └── NucleicAcidEntity
│   │       ├── RNAProduct
│   │       └── NoncodingRNAProduct
│   ├── OrganismalEntity
│   │   ├── IndividualOrganism
│   │   └── PopulationOfIndividualOrganisms
│   └── AnatomicalEntity
│       ├── Cell
│       ├── CellularComponent
│       └── GrossAnatomicalStructure
├── Disease
├── PhenotypicFeature
└── InformationContentEntity
    └── Publication
```

### Predicate (Relationship) Hierarchy Examples

Predicates also have a hierarchy:

```
related_to (root)
├── associated_with
│   ├── correlated_with
│   │   ├── positively_correlated_with
│   │   └── negatively_correlated_with
│   └── genetically_associated_with
├── interacts_with
│   ├── physically_interacts_with
│   │   └── directly_physically_interacts_with
│   └── genetically_interacts_with
├── affects
│   ├── regulates
│   │   ├── positively_regulates
│   │   └── negatively_regulates
│   └── disrupts
├── causes
│   └── contributes_to
└── treats
    ├── treats_or_applied_or_studied_to_treat
    └── prevents
```

## Important Notes

### 1. Data-Driven vs. Model-Defined Hierarchy

The SmartAPI MetaKG returns `subclass_of` relationships **from the actual data sources**, not necessarily the formal Biolink Model hierarchy. This means:

- Some relationships may be **inferred from data** rather than the formal model
- There may be **inconsistencies** or **unexpected relationships**
- The data reflects what **APIs actually provide**, not just theoretical model relationships

### 2. Querying with Hierarchy Awareness

When using the `expand` parameter, the API will:
- Include results for **parent classes** (more general)
- Include results for **child classes** (more specific)
- Apply the same logic to predicates

**Example:**
```bash
# Query for Protein with expansion
curl "https://smart-api.info/api/metakg?subject=Protein&expand=subject&size=100"

# This will return relationships for:
# - Protein (exact match)
# - MolecularEntity (parent class)
# - ChemicalEntity (grandparent class)
# - BiologicalEntity (ancestor class)
# - Polypeptide (child class, if applicable)
```

### 3. Missing Formal Hierarchy in API Response

The API **does not return** explicit hierarchy metadata in the response (e.g., "Protein is a subclass of MolecularEntity"). To get the formal hierarchy, you need to:

1. **Query the Biolink Model directly** from GitHub
2. **Use the `subclass_of` relationships** in the MetaKG data
3. **Reference the Biolink documentation** at https://biolink.github.io/biolink-model/

## Recommendations for Using Hierarchy

### For MCP Server Implementation:

1. **Download the Biolink Model YAML** and parse it to build a hierarchy tree
2. **Cache the hierarchy** locally for fast lookups
3. **Use the expand parameter** when querying to get broader/narrower results
4. **Validate category names** against the Biolink Model to ensure compatibility

### Example Implementation:

```typescript
// Fetch Biolink Model hierarchy
const biolinkModel = await fetch('https://raw.githubusercontent.com/biolink/biolink-model/master/biolink-model.yaml');

// Parse YAML to build hierarchy
const hierarchy = parseYamlToHierarchy(biolinkModel);

// When querying, use expand to get hierarchical results
const results = await fetch(
  'https://smart-api.info/api/metakg?subject=Protein&expand=subject,object,predicate&size=1000'
);

// Validate and enrich results with hierarchy information
const enrichedResults = enrichWithHierarchy(results, hierarchy);
```

## Summary

✅ **YES** - Hierarchies exist for both categories and predicates
✅ **YES** - You can access some hierarchy through the `subclass_of` predicate
✅ **YES** - The `expand` parameter uses hierarchy for query expansion
❌ **NO** - The API doesn't return explicit parent/child metadata in responses
✅ **YES** - You can get the full formal hierarchy from the Biolink Model repository

For a comprehensive MCP server implementation, combine:
1. SmartAPI MetaKG for actual data relationships
2. Biolink Model YAML for formal hierarchy definitions
3. Local caching for performance

