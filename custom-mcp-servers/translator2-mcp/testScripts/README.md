# ARS (Autonomous Relay System) Test Scripts

This folder contains comprehensive test scripts for querying the NCATS Biomedical Data Translator's Autonomous Relay System (ARS) API. We successfully tested gene queries and solved the sequence variant filtering problem.

## 🎯 **Quick Start**

### Run the latest successful test:
```bash
# From the testScripts directory
node test_ars_query_v5.js

# Analyze results
node summarize_v5_results.js
```

### What we accomplished:
- **Successfully filtered out sequence variants** (3,239 → 0)
- **Achieved 85% data reduction** (3,966 → 598 nodes)
- **Maintained relevant biological relationships**

## 📁 **File Structure**

### Test Scripts (Evolution of our approach):
- `test_ars_query_v2.js` - No category filtering
- `test_ars_query_v3.js` - With BiologicalEntity (still had variants)
- `test_ars_query_v4.js` - Without BiologicalEntity (still had variants)
- `test_ars_query_v5.js` - **Without GenomicEntity (SUCCESS!)** ✅

### Analysis Scripts:
- `summarize_v2_results.js` through `summarize_v5_results.js`
- `ARS_Testing_Summary.md` - Comprehensive documentation

### Result Files:
- `merged_results_v3.json` through `merged_results_v5.json`
- `ars_results_*.json` - Individual query results

## 🧬 **Key Discovery: Sequence Variant Filtering**

**The Problem:** Initial queries returned 3,239 sequence variants even when trying to exclude them.

**The Solution:** We discovered that `biolink:GenomicEntity` was the parent category bringing in sequence variants.

**Final Results:**
- **Before filtering:** 3,966 nodes, 8,415 edges (including 3,239 sequence variants)
- **After filtering:** 598 nodes, 1,556 edges (0 sequence variants)
- **Reduction:** 84.9% fewer nodes, 81.5% fewer edges

## 🔧 **How the Scripts Work**

### 1. **Script Architecture**
```javascript
makeRequest()     // HTTP request handler
submitQuery()     // Submit TRAPI query to ARS
checkQueryStatus() // Poll for completion (30s intervals)
getDetailedResults() // Retrieve final results
runTest()         // Main orchestration
```

### 2. **ARS API Workflow**
```
Submit Query → Get Primary Key → Poll Status → Get Results → Check Merged Version → Analyze
```

### 3. **TRAPI Query Format**
We use the Translator Reasoner API format with:
- **Nodes:** Source gene (`n0`) and target entities (`n1`)
- **Edges:** Relationships between nodes
- **Categories:** Biolink Model entity types

## 📊 **Query Evolution Results**

| Version | Target Categories | Nodes | Edges | Sequence Variants |
|---------|------------------|-------|-------|-------------------|
| v2 | None | 3,966 | 8,415 | 3,239 |
| v3 | With BiologicalEntity | 3,965 | 8,845 | 3,239 |
| v4 | Without BiologicalEntity | 3,839 | 8,802 | 3,239 |
| v5 | **Without GenomicEntity** | **598** | **1,556** | **0** ✅ |

## 🧬 **Biolink Model Insights**

**Categories that brought in sequence variants:**
- `biolink:GenomicEntity` ❌ (main culprit)
- `biolink:BiologicalEntity` ❌ (too broad)

**Categories that worked well:**
- `biolink:Gene` ✅
- `biolink:Protein` ✅
- `biolink:DiseaseOrPhenotypicFeature` ✅
- `biolink:Pathway` ✅
- `biolink:ChemicalMixture` ✅
- `biolink:Drug` ✅
- `biolink:SmallMolecule` ✅

## 🎯 **Top Relationship Types Found**

After filtering, the most relevant relationships were:
1. `occurs_together_in_literature_with` (352 relationships)
2. `gene_associated_with_condition` (321 relationships)
3. `physically_interacts_with` (148 relationships)
4. `coexpressed_with` (138 relationships)

## 🚀 **Usage Examples**

### Run a specific test:
```bash
node test_ars_query_v5.js
```

### Analyze results:
```bash
node summarize_v5_results.js
```

### Check result files:
```bash
ls -la *.json
```

## 🔧 **Script Features**

- **Error Handling:** Network timeouts, HTTP status validation, JSON parsing
- **Data Persistence:** Results saved to timestamped JSON files
- **Monitoring:** Real-time status updates and progress indicators
- **Analysis:** Automated result summarization and comparison

## 📚 **Documentation**

- **`ARS_Testing_Summary.md`** - Comprehensive technical documentation
- **`README.INFO.ARS.md`** - ARS API reference (in main project)
- **`package.json`** - Node.js package configuration

## 🎯 **Key Takeaways**

1. **Category filtering works** - but requires understanding Biolink Model hierarchy
2. **GenomicEntity is the key** - removing it eliminates sequence variants
3. **Massive data reduction possible** - 85% reduction while maintaining relevance
4. **ARS is reliable** - consistent API responses and 3-6 minute processing times
5. **TRAPI format is powerful** - flexible for complex biomedical queries

## 🔧 **Troubleshooting**

If tests fail:
1. Check your internet connection
2. Verify ARS API is accessible: `curl https://ars-prod.transltr.io/ars/api/messages`
3. Check console output for specific error messages
4. Ensure Node.js version 14+ is installed
5. Check that result files are being created

## 🚀 **Future Applications**

This testing framework can be used for:
- **Gene-disease association studies**
- **Drug-target relationship analysis**
- **Pathway enrichment analysis**
- **Chemical-gene interaction studies**
- **Biomarker discovery research**
