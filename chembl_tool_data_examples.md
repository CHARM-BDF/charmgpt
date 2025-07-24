# ChEMBL MCP Tools - Data Examples and Analysis

## Overview
This document showcases actual data returned from the four ChEMBL MCP tools, demonstrating the rich mechanism of action information available for drug discovery research.

---

## 🔍 Tool 1: `search-mechanisms` 

**Query**: Search for "cyclooxygenase" mechanisms  
**Purpose**: Find drugs that target cyclooxygenase enzymes

### Text Response Format:
```
# ChEMBL Mechanism of Action Results: cyclooxygenase

Found 3 mechanism(s):

**Drug**: CHEMBL3989408
**Target**: CHEMBL2094253
**Mechanism**: Cyclooxygenase inhibitor
**Action Type**: INHIBITOR
**References**: http://www.isbnsearch.org/isbn/0443059748, http://en.wikipedia.org/wiki/Ibuprofen
---

**Drug**: CHEMBL112
**Target**: CHEMBL2094253
**Mechanism**: Cyclooxygenase inhibitor
**Action Type**: INHIBITOR
**References**: http://europepmc.org/abstract/MED/12660052, http://europepmc.org/abstract/MED/15662292, ...
---

**Drug**: CHEMBL154
**Target**: CHEMBL2094253
**Mechanism**: Cyclooxygenase inhibitor
**Action Type**: INHIBITOR
**References**: http://europepmc.org/abstract/MED/17521299, http://europepmc.org/abstract/MED/17604186, ...
---
```

### Structured Data (Artifact):
```json
{
  "type": "application/vnd.bibliography",
  "title": "Mechanism of Action Data",
  "content": [
    {
      "molecule_chembl_id": "CHEMBL3989408",
      "target_chembl_id": "CHEMBL2094253",
      "mechanism_of_action": "Cyclooxygenase inhibitor",
      "action_type": "INHIBITOR",
      "references": [
        {"ref_type": "ISBN", "ref_id": "0443-059748 PP. 229"},
        {"ref_type": "Wikipedia", "ref_id": "Ibuprofen"}
      ]
    },
    {
      "molecule_chembl_id": "CHEMBL112",
      "target_chembl_id": "CHEMBL2094253",
      "mechanism_of_action": "Cyclooxygenase inhibitor",
      "action_type": "INHIBITOR",
      "references": [
        {"ref_type": "PubMed", "ref_id": "12660052"},
        {"ref_type": "PubMed", "ref_id": "15662292"},
        {"ref_type": "Wikipedia", "ref_id": "Acetaminophen#Mechanism_of_action"}
      ]
    }
  ]
}
```

---

## 💊 Tool 2: `get-drug-details`

**Query**: Get details for CHEMBL112 (Acetaminophen)
**Purpose**: Comprehensive drug information including all mechanisms

### Text Response Format:
```
# Drug Details: ACETAMINOPHEN

**Name**: ACETAMINOPHEN
**ChEMBL ID**: CHEMBL112
**Max Phase**: Phase 4
**Molecular Weight**: 151.16
**Formula**: C8H9NO2
**Synonyms**: Paracetamol, Tylenol, N-acetyl-p-aminophenol
---

## All Mechanisms of Action:
1. Cyclooxygenase inhibitor (INHIBITOR) - Target: CHEMBL2094253
2. Prostaglandin-endoperoxide synthase inhibitor (INHIBITOR) - Target: CHEMBL230
```

### Structured Data (Artifact):
```json
{
  "type": "application/json",
  "title": "Complete Drug Data",
  "content": {
    "drug": {
      "chembl_id": "CHEMBL112",
      "pref_name": "ACETAMINOPHEN",
      "max_phase": 4,
      "molecular_weight": 151.16,
      "molecular_formula": "C8H9NO2",
      "synonyms": ["Paracetamol", "Tylenol", "N-acetyl-p-aminophenol"]
    },
    "mechanisms": [
      {
        "target_chembl_id": "CHEMBL2094253",
        "mechanism_of_action": "Cyclooxygenase inhibitor",
        "action_type": "INHIBITOR"
      }
    ]
  }
}
```

---

## 🎯 Tool 3: `search-targets`

**Query**: Search for "EGFR" targets
**Purpose**: Find EGFR-related protein targets and their properties

### Text Response Format:
```
# ChEMBL Target Search Results: EGFR

Found 2 target(s):

**Target**: MER intracellular domain/EGFR extracellular domain chimera
**ChEMBL ID**: CHEMBL3137284
**Type**: CHIMERIC PROTEIN
**Organism**: Homo sapiens
---

**Target**: EGFR/PPP1CA
**ChEMBL ID**: CHEMBL4523747
**Type**: PROTEIN-PROTEIN INTERACTION
**Organism**: Homo sapiens
---
```

### Structured Data (Artifact):
```json
{
  "type": "application/json",
  "title": "Target Search Results",
  "content": [
    {
      "target_chembl_id": "CHEMBL3137284",
      "pref_name": "MER intracellular domain/EGFR extracellular domain chimera",
      "target_type": "CHIMERIC PROTEIN",
      "organism": "Homo sapiens",
      "target_components": [
        {
          "accession": "P00533",
          "component_description": "Epidermal growth factor receptor",
          "component_type": "PROTEIN",
          "relationship": "FUSION PROTEIN",
          "target_component_synonyms": [
            {"component_synonym": "EGFR", "syn_type": "GENE_SYMBOL"},
            {"component_synonym": "ERBB1", "syn_type": "GENE_SYMBOL_OTHER"}
          ]
        }
      ]
    }
  ]
}
```

---

## 📊 Tool 4: `analyze-interactions`

**Query**: Analyze IC50 activities for CHEMBL112 (Acetaminophen)
**Purpose**: Understand drug-target bioactivity relationships

### Text Response Format:
```
# Drug-Target Interaction Analysis: CHEMBL112

## Activity Summary

**IC50**: 3 measurements, Range: 8.67e+4 - 5.00e+5, Average: 2.62e+5

## Individual Activities (3)

**Compound**: CHEMBL112
**Target**: CHEMBL612545
**Activity**: IC50
**Value**: >500000.0 nM
---

**Compound**: CHEMBL112
**Target**: CHEMBL364
**Activity**: IC50
**Value**: >198400.0 nM
---

**Compound**: CHEMBL112
**Target**: CHEMBL364
**Activity**: IC50
**Value**: =86700.0 nM
---
```

### Structured Data (Artifact):
```json
{
  "type": "application/vnd.analytics",
  "title": "Bioactivity Analysis",
  "content": {
    "summary": {
      "IC50": [500000, 198400, 86700]
    },
    "total_activities": 3,
    "activities": [
      {
        "activity_id": 544904,
        "molecule_chembl_id": "CHEMBL112",
        "molecule_pref_name": "ACETAMINOPHEN",
        "target_chembl_id": "CHEMBL612545",
        "target_pref_name": "Unchecked",
        "standard_type": "IC50",
        "standard_value": "500000.0",
        "standard_units": "nM",
        "standard_relation": ">",
        "assay_description": "Inhibition of PGH synthase in tissues",
        "document_journal": "J Med Chem",
        "document_year": 1987
      },
      {
        "activity_id": 2108540,
        "molecule_chembl_id": "CHEMBL112",
        "target_chembl_id": "CHEMBL364",
        "target_pref_name": "Plasmodium falciparum",
        "standard_type": "IC50",
        "standard_value": "198400.0",
        "standard_units": "nM",
        "assay_description": "Antiparasitic activity against chloroquine-sensitive Plasmodium falciparum 3D7"
      }
    ]
  }
}
```

---

## 🔬 Data Analysis Insights

### Pattern Recognition

#### 1. **Mechanism Consistency**
- **Cyclooxygenase inhibitors**: All three drugs (CHEMBL3989408, CHEMBL112, CHEMBL154) share the same target (CHEMBL2094253)
- **Action type uniformity**: All are classified as "INHIBITOR" type mechanisms
- **Reference diversity**: Mix of PubMed articles, Wikipedia, and ISBN references

#### 2. **Target Complexity**
- **EGFR variants**: Multiple target types including chimeric proteins and protein-protein interactions
- **Species specificity**: Targets clearly annotated with organism (Homo sapiens)
- **Structural information**: Rich metadata including UniProt accessions and GO terms

#### 3. **Bioactivity Patterns**
- **IC50 variability**: Wide range from 86.7 μM to >500 μM for acetaminophen
- **Target specificity**: Different IC50 values against different targets (CHEMBL612545 vs CHEMBL364)
- **Assay context**: Activities linked to specific assay descriptions and publications

### Interesting Differences

#### **Drug Selectivity Profiles**
1. **CHEMBL112 (Acetaminophen)**:
   - Very weak activity (high IC50 values: 86-500 μM)
   - Tested against diverse targets (PGH synthase, Plasmodium falciparum)
   - Primarily known for COX inhibition but shows poor selectivity

#### **Target Classification Diversity**
1. **Single Proteins**: Traditional drug targets
2. **Chimeric Proteins**: Engineered research constructs  
3. **Protein-Protein Interactions**: Complex binding interfaces
4. **Organism-specific**: Pathogen vs human targets

#### **Reference Quality Spectrum**
- **High-quality**: PubMed-indexed peer-reviewed articles
- **Educational**: Wikipedia entries for well-known drugs
- **Historical**: ISBN references for older pharmaceutical texts

### Research Applications

#### **Drug Repurposing**
The bioactivity data reveals unexpected activities:
- Acetaminophen shows antiparasitic activity against *Plasmodium falciparum*
- IC50 values suggest very weak activity, explaining why it's not used as antimalarial

#### **Target Validation**
- EGFR chimeric constructs suggest active research into modified receptors
- Protein-protein interaction targets indicate modern drug discovery approaches

#### **Mechanism Understanding**
- Multiple references per mechanism provide comprehensive literature coverage
- Action type classification (INHIBITOR) enables systematic analysis of drug classes

---

## 💡 Key Takeaways

1. **Rich Annotation**: ChEMBL provides extensive cross-references and metadata
2. **Research Context**: Activities linked to specific assays and publications  
3. **Target Diversity**: From simple proteins to complex engineered constructs
4. **Mechanism Clarity**: Clear action type classification enables systematic analysis
5. **Literature Integration**: Comprehensive reference linking for validation

This data structure enables researchers to quickly identify mechanism patterns, compare drug activities, and explore target relationships for informed drug discovery decisions. 