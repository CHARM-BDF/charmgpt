# BTE Tool Examples - Specific Predicates for Gene, Protein and Drug Relationships

This document provides specific predicate examples for updating the BTE tool info for `query_bte` with targeted subject-object relationship queries.

## Gene Relationships

### 1. Gene → Gene
**Total Predicates: 50**

**Key Predicates:**
- `affects` - Gene affects another gene
- `interacts_with` - Gene-gene interactions
- `physically_interacts_with` - Direct physical interactions
- `directly_physically_interacts_with` - Direct binding interactions
- `genetically_interacts_with` - Genetic interactions
- `genetically_associated_with` - Genetic associations
- `coexpressed_with` - Co-expression relationships
- `colocalizes_with` - Co-localization
- `homologous_to` - Homology relationships
- `orthologous_to` - Orthology relationships
- `related_to` - General relationships
- `close_match` - Similarity relationships
- `same_as` - Identity relationships
- `subclass_of` - Hierarchical relationships
- `regulates` - Regulatory relationships
- `regulated_by` - Being regulated by
- `produces` - Gene produces another gene product
- `produced_by` - Gene is produced by another gene
- `gene_product_of` - Gene product relationships
- `participates_in` - Participation in processes
- `has_part` - Part-whole relationships
- `has_member` - Membership relationships
- `has_participant` - Participant relationships
- `has_input` - Input relationships
- `derives_from` - Derivation relationships
- `derives_into` - Derivation into
- `correlated_with` - Statistical correlations
- `positively_correlated_with` - Positive correlations
- `negatively_correlated_with` - Negative correlations
- `associated_with` - General associations
- `associated_with_increased_likelihood_of` - Risk associations
- `associated_with_sensitivity_to` - Sensitivity associations
- `associated_with_resistance_to` - Resistance associations
- `biomarker_for` - Biomarker relationships
- `causes` - Causal relationships
- `disrupts` - Disruptive effects
- `capable_of` - Functional capabilities
- `expressed_in` - Expression relationships
- `located_in` - Spatial relationships
- `occurs_in` - Occurrence relationships
- `coexists_with` - Co-occurrence
- `overlaps` - Overlap relationships
- `part_of` - Part relationships
- `lacks_part` - Missing part relationships
- `in_complex_with` - Complex formation
- `chemically_similar_to` - Chemical similarity
- `acts_upstream_of_or_within` - Upstream relationships
- `treats_or_applied_or_studied_to_treat` - Therapeutic relationships
- `preventative_for_condition` - Prevention relationships
- `predisposes_to_condition` - Predisposition relationships
- `sensitivity_associated_with` - Sensitivity associations
- `resistance_associated_with` - Resistance associations

### 2. Gene → Pathway
**Total Predicates: 23**

**Key Predicates:**
- `participates_in` - Gene participates in pathway
- `actively_involved_in` - Active involvement in pathway
- `enables` - Gene enables pathway function
- `regulates` - Gene regulates pathway
- `contributes_to` - Gene contributes to pathway
- `affects` - Gene affects pathway
- `causes` - Gene causes pathway changes
- `disrupts` - Gene disrupts pathway
- `expressed_in` - Gene expressed in pathway context
- `enriched_in` - Gene enriched in pathway
- `acts_upstream_of` - Gene acts upstream of pathway
- `acts_upstream_of_positive_effect` - Positive upstream effects
- `acts_upstream_of_negative_effect` - Negative upstream effects
- `acts_upstream_of_or_within` - Upstream or within pathway
- `acts_upstream_of_or_within_positive_effect` - Positive upstream/within effects
- `acts_upstream_of_or_within_negative_effect` - Negative upstream/within effects
- `correlated_with` - Statistical correlation with pathway
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `gene_associated_with_condition` - Gene-disease associations via pathway
- `related_to` - General relationship
- `occurs_in` - Gene occurs in pathway context

### 3. Gene → MolecularActivity
**Total Predicates: 28**

**Key Predicates:**
- `participates_in` - Gene participates in molecular activity
- `actively_involved_in` - Active involvement in activity
- `enables` - Gene enables molecular activity
- `regulates` - Gene regulates activity
- `contributes_to` - Gene contributes to activity
- `affects` - Gene affects activity
- `causes` - Gene causes activity changes
- `disrupts` - Gene disrupts activity
- `catalyzes` - Gene catalyzes activity
- `capable_of` - Gene capable of activity
- `produces` - Gene produces activity
- `has_part` - Gene has activity as part
- `interacts_with` - Gene interacts with activity
- `coexists_with` - Gene coexists with activity
- `correlated_with` - Statistical correlation
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `gene_associated_with_condition` - Gene-disease associations via activity
- `exacerbates_condition` - Gene exacerbates conditions via activity
- `derives_from` - Gene derives from activity
- `precedes` - Gene precedes activity
- `close_match` - Similarity to activity
- `subclass_of` - Hierarchical relationship
- `related_to` - General relationship
- `affected_by` - Gene affected by activity
- `acts_upstream_of_positive_effect` - Positive upstream effects
- `acts_upstream_of_or_within_positive_effect` - Positive upstream/within effects
- `acts_upstream_of_or_within_negative_effect` - Negative upstream/within effects
- `acts_upstream_of_negative_effect` - Negative upstream effects

### 4. Gene → GeneFamily
**Total Predicates: 17**

**Key Predicates:**
- `subclass_of` - Gene is subclass of family
- `related_to` - General relationship to family
- `affects` - Gene affects family
- `interacts_with` - Gene interacts with family
- `physically_interacts_with` - Physical interactions
- `directly_physically_interacts_with` - Direct physical interactions
- `overlaps` - Gene overlaps with family
- `colocalizes_with` - Co-localization with family
- `coexists_with` - Co-existence with family
- `close_match` - Similarity to family
- `capable_of` - Gene capable of family functions
- `produces` - Gene produces family members
- `has_part` - Gene has family as part
- `has_input` - Gene has family as input
- `derives_from` - Gene derives from family
- `regulates` - Gene regulates family
- `precedes` - Gene precedes family

### 5. Gene → BiologicalProcess
**Total Predicates: 25**

**Key Predicates:**
- `participates_in` - Gene participates in process
- `actively_involved_in` - Active involvement in process
- `active_in` - Gene active in process
- `enables` - Gene enables process
- `regulates` - Gene regulates process
- `contributes_to` - Gene contributes to process
- `affects` - Gene affects process
- `causes` - Gene causes process changes
- `disrupts` - Gene disrupts process
- `capable_of` - Gene capable of process
- `acts_upstream_of` - Gene acts upstream of process
- `acts_upstream_of_positive_effect` - Positive upstream effects
- `acts_upstream_of_negative_effect` - Negative upstream effects
- `acts_upstream_of_or_within` - Upstream or within process
- `acts_upstream_of_or_within_positive_effect` - Positive upstream/within effects
- `acts_upstream_of_or_within_negative_effect` - Negative upstream/within effects
- `correlated_with` - Statistical correlation
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `gene_associated_with_condition` - Gene-disease associations via process
- `exacerbates_condition` - Gene exacerbates conditions via process
- `contraindicated_in` - Gene contraindicated in process
- `overlaps` - Gene overlaps with process
- `related_to` - General relationship

## Protein Relationships

### 6. Protein → Protein
**Total Predicates: 58**

**Key Predicates:**
- `affects` - Protein affects another protein
- `interacts_with` - Protein-protein interactions
- `physically_interacts_with` - Physical interactions
- `directly_physically_interacts_with` - Direct physical interactions
- `genetically_interacts_with` - Genetic interactions
- `genetically_associated_with` - Genetic associations
- `coexpressed_with` - Co-expression relationships
- `colocalizes_with` - Co-localization
- `homologous_to` - Homology relationships
- `orthologous_to` - Orthology relationships
- `related_to` - General relationships
- `close_match` - Similarity relationships
- `same_as` - Identity relationships
- `similar_to` - Similarity relationships
- `subclass_of` - Hierarchical relationships
- `superclass_of` - Parent class relationships
- `regulates` - Regulatory relationships
- `produces` - Protein produces another protein
- `gene_product_of` - Gene product relationships
- `participates_in` - Participation in processes
- `has_part` - Part-whole relationships
- `has_member` - Membership relationships
- `has_participant` - Participant relationships
- `has_input` - Input relationships
- `has_substrate` - Substrate relationships
- `has_active_ingredient` - Active ingredient relationships
- `has_active_metabolite` - Active metabolite relationships
- `is_substrate_of` - Being substrate of
- `is_active_ingredient_of` - Being active ingredient of
- `is_active_metabolite_of` - Being active metabolite of
- `is_sequence_variant_of` - Sequence variant relationships
- `has_sequence_variant` - Having sequence variants
- `is_assessed_by` - Being assessed by
- `assesses` - Assessing other proteins
- `derives_from` - Derivation relationships
- `derives_into` - Derivation into
- `correlated_with` - Statistical correlations
- `positively_correlated_with` - Positive correlations
- `negatively_correlated_with` - Negative correlations
- `associated_with` - General associations
- `associated_with_sensitivity_to` - Sensitivity associations
- `biomarker_for` - Biomarker relationships
- `causes` - Causal relationships
- `disrupts` - Disruptive effects
- `capable_of` - Functional capabilities
- `expressed_in` - Expression relationships
- `located_in` - Spatial relationships
- `occurs_in` - Occurrence relationships
- `occurs_together_in_literature_with` - Co-occurrence in literature
- `coexists_with` - Co-existence
- `overlaps` - Overlap relationships
- `part_of` - Part relationships
- `lacks_part` - Missing part relationships
- `in_complex_with` - Complex formation
- `chemically_similar_to` - Chemical similarity
- `increases_response_to` - Response enhancement
- `decreases_response_to` - Response reduction
- `acts_upstream_of_or_within` - Upstream relationships
- `treats_or_applied_or_studied_to_treat` - Therapeutic relationships
- `preventative_for_condition` - Prevention relationships
- `predisposes_to_condition` - Predisposition relationships
- `sensitivity_associated_with` - Sensitivity associations

### 7. Protein → Pathway
**Total Predicates: 23**

**Key Predicates:**
- `participates_in` - Protein participates in pathway
- `actively_involved_in` - Active involvement in pathway
- `enables` - Protein enables pathway function
- `regulates` - Protein regulates pathway
- `contributes_to` - Protein contributes to pathway
- `affects` - Protein affects pathway
- `causes` - Protein causes pathway changes
- `disrupts` - Protein disrupts pathway
- `expressed_in` - Protein expressed in pathway context
- `acts_upstream_of` - Protein acts upstream of pathway
- `acts_upstream_of_positive_effect` - Positive upstream effects
- `acts_upstream_of_negative_effect` - Negative upstream effects
- `acts_upstream_of_or_within` - Upstream or within pathway
- `acts_upstream_of_or_within_positive_effect` - Positive upstream/within effects
- `acts_upstream_of_or_within_negative_effect` - Negative upstream/within effects
- `correlated_with` - Statistical correlation with pathway
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `gene_associated_with_condition` - Protein-disease associations via pathway
- `occurs_together_in_literature_with` - Co-occurrence in literature
- `related_to` - General relationship
- `capable_of` - Protein capable of pathway functions

### 8. Protein → MolecularActivity
**Total Predicates: 30**

**Key Predicates:**
- `participates_in` - Protein participates in molecular activity
- `actively_involved_in` - Active involvement in activity
- `enables` - Protein enables molecular activity
- `regulates` - Protein regulates activity
- `regulated_by` - Protein regulated by activity
- `contributes_to` - Protein contributes to activity
- `affects` - Protein affects activity
- `causes` - Protein causes activity changes
- `disrupts` - Protein disrupts activity
- `catalyzes` - Protein catalyzes activity
- `capable_of` - Protein capable of activity
- `produces` - Protein produces activity
- `is_output_of` - Protein is output of activity
- `is_input_of` - Protein is input of activity
- `has_part` - Protein has activity as part
- `interacts_with` - Protein interacts with activity
- `coexists_with` - Protein coexists with activity
- `correlated_with` - Statistical correlation
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `gene_associated_with_condition` - Protein-disease associations via activity
- `exacerbates_condition` - Protein exacerbates conditions via activity
- `derives_from` - Protein derives from activity
- `precedes` - Protein precedes activity
- `preceded_by` - Protein preceded by activity
- `close_match` - Similarity to activity
- `subclass_of` - Hierarchical relationship
- `occurs_together_in_literature_with` - Co-occurrence in literature
- `related_to` - General relationship
- `acts_upstream_of_positive_effect` - Positive upstream effects
- `acts_upstream_of_or_within_positive_effect` - Positive upstream/within effects
- `acts_upstream_of_or_within_negative_effect` - Negative upstream/within effects
- `acts_upstream_of_negative_effect` - Negative upstream effects

### 9. Protein → GeneFamily
**Total Predicates: 17**

**Key Predicates:**
- `subclass_of` - Protein is subclass of family
- `related_to` - General relationship to family
- `affects` - Protein affects family
- `interacts_with` - Protein interacts with family
- `physically_interacts_with` - Physical interactions
- `directly_physically_interacts_with` - Direct physical interactions
- `overlaps` - Protein overlaps with family
- `colocalizes_with` - Co-localization with family
- `coexists_with` - Co-existence with family
- `close_match` - Similarity to family
- `capable_of` - Protein capable of family functions
- `produces` - Protein produces family members
- `has_part` - Protein has family as part
- `has_input` - Protein has family as input
- `derives_from` - Protein derives from family
- `regulates` - Protein regulates family
- `positively_correlated_with` - Positive correlation

### 10. Protein → BiologicalProcess
**Total Predicates: 25**

**Key Predicates:**
- `participates_in` - Protein participates in process
- `actively_involved_in` - Active involvement in process
- `enables` - Protein enables process
- `regulates` - Protein regulates process
- `contributes_to` - Protein contributes to process
- `affects` - Protein affects process
- `causes` - Protein causes process changes
- `disrupts` - Protein disrupts process
- `capable_of` - Protein capable of process
- `acts_upstream_of` - Protein acts upstream of process
- `acts_upstream_of_positive_effect` - Positive upstream effects
- `acts_upstream_of_negative_effect` - Negative upstream effects
- `acts_upstream_of_or_within` - Upstream or within process
- `acts_upstream_of_or_within_positive_effect` - Positive upstream/within effects
- `acts_upstream_of_or_within_negative_effect` - Negative upstream/within effects
- `correlated_with` - Statistical correlation
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `gene_associated_with_condition` - Protein-disease associations via process
- `exacerbates_condition` - Protein exacerbates conditions via process
- `contraindicated_in` - Protein contraindicated in process
- `expressed_in` - Protein expressed in process context
- `occurs_together_in_literature_with` - Co-occurrence in literature
- `temporally_related_to` - Temporal relationships
- `related_to` - General relationship

## Drug/SmallMolecule Relationships

### 11. Drug → Gene
**Total Predicates: 40**

**Key Predicates:**
- `affects` - Drug affects gene
- `interacts_with` - Drug interacts with gene
- `physically_interacts_with` - Physical interactions
- `directly_physically_interacts_with` - Direct physical interactions
- `regulates` - Drug regulates gene
- `disrupts` - Drug disrupts gene
- `causes` - Drug causes gene changes
- `produces` - Drug produces gene products
- `has_participant` - Drug has gene as participant
- `has_part` - Drug has gene as part
- `has_member` - Drug has gene as member
- `has_input` - Drug has gene as input
- `has_metabolite` - Drug has gene as metabolite
- `gene_product_of` - Drug is gene product
- `derives_from` - Drug derives from gene
- `correlated_with` - Statistical correlation
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `associated_with_increased_likelihood_of` - Risk associations
- `coexists_with` - Co-existence
- `close_match` - Similarity
- `chemically_similar_to` - Chemical similarity
- `same_as` - Identity
- `similar_to` - Similarity
- `subclass_of` - Hierarchical relationship
- `capable_of` - Drug capable of gene functions
- `located_in` - Drug located in gene context
- `response_affected_by` - Drug response affected by gene
- `increases_response_to` - Drug increases response to gene
- `decreases_response_to` - Drug decreases response to gene
- `treats_or_applied_or_studied_to_treat` - Therapeutic relationships
- `applied_to_treat` - Applied to treat gene-related conditions
- `preventative_for_condition` - Prevention relationships
- `predisposes_to_condition` - Predisposition relationships
- `transcribed_from` - Drug transcribed from gene
- `translates_to` - Drug translates to gene
- `related_to` - General relationship

### 12. Drug → Protein
**Total Predicates: 40**

**Key Predicates:**
- `affects` - Drug affects protein
- `interacts_with` - Drug interacts with protein
- `physically_interacts_with` - Physical interactions
- `directly_physically_interacts_with` - Direct physical interactions
- `regulates` - Drug regulates protein
- `disrupts` - Drug disrupts protein
- `causes` - Drug causes protein changes
- `produces` - Drug produces protein
- `has_participant` - Drug has protein as participant
- `has_part` - Drug has protein as part
- `has_member` - Drug has protein as member
- `has_input` - Drug has protein as input
- `has_metabolite` - Drug has protein as metabolite
- `has_active_ingredient` - Drug has protein as active ingredient
- `gene_product_of` - Drug is protein product
- `derives_from` - Drug derives from protein
- `correlated_with` - Statistical correlation
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `coexists_with` - Co-existence
- `close_match` - Similarity
- `chemically_similar_to` - Chemical similarity
- `same_as` - Identity
- `similar_to` - Similarity
- `subclass_of` - Hierarchical relationship
- `capable_of` - Drug capable of protein functions
- `located_in` - Drug located in protein context
- `response_affected_by` - Drug response affected by protein
- `increases_response_to` - Drug increases response to protein
- `decreases_response_to` - Drug decreases response to protein
- `treats` - Drug treats protein-related conditions
- `treats_or_applied_or_studied_to_treat` - Therapeutic relationships
- `applied_to_treat` - Applied to treat protein-related conditions
- `preventative_for_condition` - Prevention relationships
- `predisposes_to_condition` - Predisposition relationships
- `contraindicated_in` - Drug contraindicated in protein context
- `transcribed_from` - Drug transcribed from protein
- `translates_to` - Drug translates to protein
- `related_to` - General relationship

### 13. SmallMolecule → Gene
**Total Predicates: 50**

**Key Predicates:**
- `affects` - Small molecule affects gene
- `interacts_with` - Small molecule interacts with gene
- `physically_interacts_with` - Physical interactions
- `directly_physically_interacts_with` - Direct physical interactions
- `regulates` - Small molecule regulates gene
- `disrupts` - Small molecule disrupts gene
- `causes` - Small molecule causes gene changes
- `produces` - Small molecule produces gene products
- `produced_by` - Small molecule produced by gene
- `has_participant` - Small molecule has gene as participant
- `has_part` - Small molecule has gene as part
- `has_input` - Small molecule has gene as input
- `has_metabolite` - Small molecule has gene as metabolite
- `gene_product_of` - Small molecule is gene product
- `derives_from` - Small molecule derives from gene
- `derives_into` - Small molecule derives into gene
- `correlated_with` - Statistical correlation
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `associated_with_increased_likelihood_of` - Risk associations
- `associated_with_decreased_likelihood_of` - Protective associations
- `associated_with_sensitivity_to` - Sensitivity associations
- `associated_with_resistance_to` - Resistance associations
- `sensitivity_associated_with` - Sensitivity associations
- `resistance_associated_with` - Resistance associations
- `coexists_with` - Co-existence
- `close_match` - Similarity
- `chemically_similar_to` - Chemical similarity
- `same_as` - Identity
- `similar_to` - Similarity
- `subclass_of` - Hierarchical relationship
- `capable_of` - Small molecule capable of gene functions
- `located_in` - Small molecule located in gene context
- `part_of` - Small molecule part of gene
- `overlaps` - Small molecule overlaps with gene
- `occurs_together_in_literature_with` - Co-occurrence in literature
- `response_affected_by` - Small molecule response affected by gene
- `increases_response_to` - Small molecule increases response to gene
- `decreases_response_to` - Small molecule decreases response to gene
- `is_substrate_of` - Small molecule is substrate of gene
- `output_of` - Small molecule is output of gene
- `treats_or_applied_or_studied_to_treat` - Therapeutic relationships
- `applied_to_treat` - Applied to treat gene-related conditions
- `preventative_for_condition` - Prevention relationships
- `predisposes_to_condition` - Predisposition relationships
- `transcribed_from` - Small molecule transcribed from gene
- `translates_to` - Small molecule translates to gene
- `related_to` - General relationship
- `related_to_at_instance_level` - Instance-level relationship
- `affected_by` - Small molecule affected by gene

### 14. SmallMolecule → Protein
**Total Predicates: 50**

**Key Predicates:**
- `affects` - Small molecule affects protein
- `interacts_with` - Small molecule interacts with protein
- `physically_interacts_with` - Physical interactions
- `directly_physically_interacts_with` - Direct physical interactions
- `regulates` - Small molecule regulates protein
- `disrupts` - Small molecule disrupts protein
- `causes` - Small molecule causes protein changes
- `produces` - Small molecule produces protein
- `produced_by` - Small molecule produced by protein
- `has_participant` - Small molecule has protein as participant
- `has_part` - Small molecule has protein as part
- `has_input` - Small molecule has protein as input
- `has_metabolite` - Small molecule has protein as metabolite
- `has_active_metabolite` - Small molecule has protein as active metabolite
- `has_active_ingredient` - Small molecule has protein as active ingredient
- `gene_product_of` - Small molecule is protein product
- `derives_from` - Small molecule derives from protein
- `derives_into` - Small molecule derives into protein
- `correlated_with` - Statistical correlation
- `positively_correlated_with` - Positive correlation
- `negatively_correlated_with` - Negative correlation
- `associated_with` - General association
- `associated_with_increased_likelihood_of` - Risk associations
- `associated_with_decreased_likelihood_of` - Protective associations
- `associated_with_sensitivity_to` - Sensitivity associations
- `associated_with_resistance_to` - Resistance associations
- `sensitivity_associated_with` - Sensitivity associations
- `resistance_associated_with` - Resistance associations
- `coexists_with` - Co-existence
- `close_match` - Similarity
- `chemically_similar_to` - Chemical similarity
- `same_as` - Identity
- `similar_to` - Similarity
- `subclass_of` - Hierarchical relationship
- `capable_of` - Small molecule capable of protein functions
- `located_in` - Small molecule located in protein context
- `part_of` - Small molecule part of protein
- `overlaps` - Small molecule overlaps with protein
- `occurs_together_in_literature_with` - Co-occurrence in literature
- `response_affected_by` - Small molecule response affected by protein
- `increases_response_to` - Small molecule increases response to protein
- `decreases_response_to` - Small molecule decreases response to protein
- `is_substrate_of` - Small molecule is substrate of protein
- `has_substrate` - Small molecule has protein as substrate
- `is_active_metabolite_of` - Small molecule is active metabolite of protein
- `is_active_ingredient_of` - Small molecule is active ingredient of protein
- `output_of` - Small molecule is output of protein
- `treats` - Small molecule treats protein-related conditions
- `treats_or_applied_or_studied_to_treat` - Therapeutic relationships
- `applied_to_treat` - Applied to treat protein-related conditions
- `preventative_for_condition` - Prevention relationships
- `predisposes_to_condition` - Predisposition relationships
- `contraindicated_in` - Small molecule contraindicated in protein context
- `assesses` - Small molecule assesses protein
- `assess` - Small molecule assess protein
- `transcribed_from` - Small molecule transcribed from protein
- `translates_to` - Small molecule translates to protein
- `related_to` - General relationship
- `affected_by` - Small molecule affected by protein

## Summary for BTE Tool Examples

### Most Common Predicates Across All Relationships:
1. **`affects`** - Causal/functional relationships
2. **`interacts_with`** - Molecular interactions
3. **`related_to`** - General relationships
4. **`regulates`** - Regulatory relationships
5. **`causes`** - Causal relationships
6. **`disrupts`** - Disruptive effects
7. **`participates_in`** - Participation relationships
8. **`produces`** - Production relationships
9. **`correlated_with`** - Statistical correlations
10. **`associated_with`** - General associations

### Therapeutic Focus:
- `treats_or_applied_or_studied_to_treat`
- `applied_to_treat`
- `treats`
- `preventative_for_condition`
- `predisposes_to_condition`

### Functional Relationships:
- `enables`
- `contributes_to`
- `capable_of`
- `catalyzes`
- `assesses`

### Hierarchical Relationships:
- `subclass_of`
- `superclass_of`
- `part_of`
- `has_part`
- `has_member`

### Interaction Types:
- `physically_interacts_with`
- `directly_physically_interacts_with`
- `genetically_interacts_with`
- `in_complex_with`

### Protein-Specific Relationships:
- `is_substrate_of` / `has_substrate`
- `is_active_ingredient_of` / `has_active_ingredient`
- `is_active_metabolite_of` / `has_active_metabolite`
- `is_sequence_variant_of` / `has_sequence_variant`
- `is_output_of` / `is_input_of`
- `regulated_by` / `preceded_by`

### Response/Pharmacology Relationships:
- `increases_response_to`
- `decreases_response_to`
- `response_affected_by`
- `sensitivity_associated_with`
- `resistance_associated_with`

### Literature/Co-occurrence:
- `occurs_together_in_literature_with`
- `coexpressed_with`
- `colocalizes_with`
- `coexists_with`

These predicates provide comprehensive coverage for building BTE tool examples that demonstrate the rich relationship types available in the biomedical knowledge graph, with particular strength in protein-protein interactions, drug-target relationships, and therapeutic applications.
