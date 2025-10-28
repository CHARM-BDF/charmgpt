/**
 * Biolink Predicate Optimizer for BTE MCP
 * 
 * This module provides optimized predicate sets based on the Biolink hierarchy
 * to improve query generation and reduce the need for the overly broad default
 * category set currently used in Pattern 9.
 */

const BIOLINK_PREDICATE_SETS = {
  // Comprehensive sets (high coverage)
  comprehensive: [
    'biolink:related_to_at_instance_level',
    'biolink:related_to_at_concept_level'
  ],
  
  // Focused sets (balanced coverage)
  focused: [
    'biolink:affected_by',
    'biolink:affects', 
    'biolink:associated_with',
    'biolink:interacts_with',
    'biolink:participates_in'
  ],
  
  // Minimal sets (specific coverage)
  minimal: [
    'biolink:regulates',
    'biolink:associated_with',
    'biolink:interacts_with',
    'biolink:participates_in',
    'biolink:similar_to'
  ],
  
  // Category-specific sets
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
  ],
  
  hierarchical: [
    'biolink:subclass_of',
    'biolink:superclass_of',
    'biolink:part_of',
    'biolink:has_part'
  ]
};

// Category-specific predicate recommendations
const CATEGORY_PREDICATE_MAP = {
  'biolink:Gene': ['causal', 'associational'],
  'biolink:Protein': ['interaction', 'causal'],
  'biolink:Disease': ['associational', 'causal'],
  'biolink:ChemicalEntity': ['causal', 'interaction'],
  'biolink:SmallMolecule': ['causal', 'interaction'],
  'biolink:Drug': ['causal', 'interaction'],
  'biolink:AnatomicalEntity': ['associational', 'hierarchical'],
  'biolink:Pathway': ['participates_in', 'interaction'],
  'biolink:BiologicalProcess': ['participates_in', 'causal'],
  'biolink:SequenceVariant': ['causal', 'associational']
};

/**
 * Get optimized predicates for a query based on context
 * @param {string} queryType - Type of query ('comprehensive', 'focused', 'minimal')
 * @param {string} subjectCategory - Biolink category of the subject
 * @param {string} objectCategory - Biolink category of the object (optional)
 * @returns {string[]} Array of optimized predicates
 */
function getOptimizedPredicates(queryType = 'focused', subjectCategory = null, objectCategory = null) {
  // If we have category-specific recommendations, use them
  if (subjectCategory && CATEGORY_PREDICATE_MAP[subjectCategory]) {
    const recommendedSets = CATEGORY_PREDICATE_MAP[subjectCategory];
    const predicates = [];
    
    // Combine predicates from recommended sets
    for (const setName of recommendedSets) {
      if (BIOLINK_PREDICATE_SETS[setName]) {
        predicates.push(...BIOLINK_PREDICATE_SETS[setName]);
      }
    }
    
    // Remove duplicates and return
    return [...new Set(predicates)];
  }
  
  // Fall back to query type
  return BIOLINK_PREDICATE_SETS[queryType] || BIOLINK_PREDICATE_SETS.focused;
}

/**
 * Generate an improved query pattern for "all nodes related to X"
 * @param {string} entityId - The entity ID (e.g., 'NCBIGene:695')
 * @param {string} entityCategory - The entity category (e.g., 'biolink:Gene')
 * @param {string} queryType - Type of query ('comprehensive', 'focused', 'minimal')
 * @returns {object} TRAPI query graph
 */
function generateOptimizedQuery(entityId, entityCategory, queryType = 'focused') {
  const predicates = getOptimizedPredicates(queryType, entityCategory);
  
  return {
    nodes: {
      n0: {
        ids: [entityId],
        categories: [entityCategory]
      },
      n1: {
        // No categories specified = get all types
        // This is more efficient than the current 11-category default
      }
    },
    edges: {
      e0: {
        subject: 'n0',
        object: 'n1',
        predicates: predicates
      }
    }
  };
}

/**
 * Compare with current Pattern 9 approach
 */
function compareWithCurrentPattern() {
  console.log('=== COMPARISON: Current vs Optimized ===');
  
  console.log('\nCURRENT PATTERN 9 (11 categories):');
  const currentCategories = [
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
  ];
  console.log(`Categories: ${currentCategories.length}`);
  console.log('Predicates: None (gets all)');
  
  console.log('\nOPTIMIZED APPROACH:');
  console.log('Categories: None (gets all - more efficient)');
  console.log(`Predicates: ${BIOLINK_PREDICATE_SETS.focused.length} focused predicates`);
  console.log('Benefits:');
  console.log('- More targeted results');
  console.log('- Faster queries');
  console.log('- Better relationship quality');
  console.log('- Category-specific optimization');
}

// Example usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BIOLINK_PREDICATE_SETS,
    CATEGORY_PREDICATE_MAP,
    getOptimizedPredicates,
    generateOptimizedQuery,
    compareWithCurrentPattern
  };
}

// Example queries
console.log('=== EXAMPLE OPTIMIZED QUERIES ===');

// Gene query
const geneQuery = generateOptimizedQuery('NCBIGene:695', 'biolink:Gene', 'focused');
console.log('\nGene Query (NCBIGene:695):');
console.log(JSON.stringify(geneQuery, null, 2));

// Disease query  
const diseaseQuery = generateOptimizedQuery('MONDO:0005148', 'biolink:Disease', 'focused');
console.log('\nDisease Query (MONDO:0005148):');
console.log(JSON.stringify(diseaseQuery, null, 2));

// Comprehensive query
const comprehensiveQuery = generateOptimizedQuery('NCBIGene:695', 'biolink:Gene', 'comprehensive');
console.log('\nComprehensive Query:');
console.log(JSON.stringify(comprehensiveQuery, null, 2));

compareWithCurrentPattern();
