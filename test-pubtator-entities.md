# PubTator Entity Testing Guide

## Test Cases for Phase 5

Use these prompts in Graph Mode to test different entities:

### Primary Test (Current Issue)
- **Prompt:** "Find all entities related to DLL1"
- **Expected:** Should show disease/chemical relationships if they exist

### Alternative Test Cases
1. **BRCA1** (well-known cancer gene)
   - **Prompt:** "Find all entities related to BRCA1"
   - **Expected:** Should have disease relationships (breast cancer, ovarian cancer)

2. **TP53** (tumor suppressor gene)
   - **Prompt:** "Find all entities related to TP53"
   - **Expected:** Should have disease relationships (various cancers)

3. **EGFR** (epidermal growth factor receptor)
   - **Prompt:** "Find all entities related to EGFR"
   - **Expected:** Should have disease relationships (lung cancer, etc.)

## What to Look For

### In Server Logs:
1. **PubTator API Response:**
   ```
   🔥 [PUBTATOR-DEBUG] Raw PubTator API response for @GENE_[ENTITY]: [...]
   🔥 [PUBTATOR-DEBUG] Mapped relations: [...]
   ```

2. **Relation Processing:**
   ```
   🔥 [PUBTATOR-DEBUG] Processing relation: @GENE_[ENTITY] -> @DISEASE_[DISEASE] (associate)
   ```

3. **Entity Processing Check:**
   ```
   🔥 [DEBUG] Checking if @DISEASE_[DISEASE] is in processedEntities
   🔥 [DEBUG] processedEntities contains: [...]
   ```

4. **Node Creation:**
   ```
   🔥 [PUBTATOR-DEBUG] Creating node for entity: @DISEASE_[DISEASE]
   🔥 [DEBUG] createNodeInDatabase called with: {...}
   ```

5. **Skipped Entities:**
   ```
   🔥 [DEBUG] SKIPPED - entity already processed: @DISEASE_[DISEASE]
   ```

## Analysis Questions

1. **Does PubTator API return disease/chemical relationships for any entity?**
2. **Are disease/chemical relations being processed in the loop?**
3. **Are disease/chemical entities being skipped due to processedEntities?**
4. **Is createNodeInDatabase being called for disease/chemical entities?**
5. **Do different entities show different patterns?**

## Expected Findings

- **If all entities show same pattern:** Systemic code bug
- **If some entities work:** PubTator API data availability varies
- **If API returns diseases but nodes aren't created:** Code filtering issue
- **If API doesn't return diseases:** PubTator limitation

