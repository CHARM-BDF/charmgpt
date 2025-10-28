#!/usr/bin/env python3
"""
Analyze Biolink predicate hierarchy to find optimal parent predicates.
Based on the hierarchy structure provided in the HTML.
"""

def analyze_biolink_hierarchy():
    """Analyze the Biolink hierarchy to find the most useful parent predicates."""
    
    # Key parent predicates from the hierarchy with their coverage
    hierarchy_analysis = {
        # Top level - too broad for most queries
        'related_to': {
            'children': ['related_to_at_concept_level', 'related_to_at_instance_level'],
            'coverage': 'universal',
            'recommendation': 'avoid - too broad'
        },
        
        # High-level parents with good coverage
        'related_to_at_instance_level': {
            'children': [
                'affected_by', 'affects', 'associated_with', 'coexists_with', 
                'interacts_with', 'participates_in', 'similar_to', 'overlaps'
            ],
            'coverage': 'very_high',
            'recommendation': 'excellent for comprehensive queries'
        },
        
        'related_to_at_concept_level': {
            'children': [
                'subclass_of', 'superclass_of', 'exact_match', 'close_match', 
                'broad_match', 'narrow_match'
            ],
            'coverage': 'high',
            'recommendation': 'good for hierarchical queries'
        },
        
        # Mid-level parents with specific coverage
        'affected_by': {
            'children': [
                'regulated_by', 'disrupted_by', 'condition_ameliorated_by',
                'condition_exacerbated_by', 'response_affected_by'
            ],
            'coverage': 'moderate',
            'recommendation': 'good for regulatory relationships'
        },
        
        'affects': {
            'children': [
                'regulates', 'disrupts', 'ameliorates_condition', 'exacerbates_condition',
                'affects_response_to', 'has_side_effect'
            ],
            'coverage': 'moderate',
            'recommendation': 'good for causal relationships'
        },
        
        'associated_with': {
            'children': [
                'correlated_with', 'genetically_associated_with', 'biomarker_for',
                'coexpressed_with'
            ],
            'coverage': 'moderate',
            'recommendation': 'good for association queries'
        },
        
        'interacts_with': {
            'children': [
                'physically_interacts_with', 'genetically_interacts_with',
                'directly_physically_interacts_with', 'binds'
            ],
            'coverage': 'moderate',
            'recommendation': 'good for interaction queries'
        },
        
        'participates_in': {
            'children': [
                'catalyzes', 'enables', 'actively_involved_in', 'has_input',
                'has_output', 'is_substrate_of'
            ],
            'coverage': 'moderate',
            'recommendation': 'good for pathway/process queries'
        },
        
        'coexists_with': {
            'children': [
                'colocalizes_with', 'in_complex_with', 'in_pathway_with',
                'in_cell_population_with'
            ],
            'coverage': 'moderate',
            'recommendation': 'good for co-location queries'
        },
        
        'similar_to': {
            'children': [
                'chemically_similar_to', 'homologous_to', 'orthologous_to',
                'paralogous_to'
            ],
            'coverage': 'moderate',
            'recommendation': 'good for similarity queries'
        },
        
        'overlaps': {
            'children': [
                'part_of', 'has_part', 'has_food_component', 'has_active_ingredient'
            ],
            'coverage': 'moderate',
            'recommendation': 'good for structural relationships'
        }
    }
    
    return hierarchy_analysis

def create_predicate_sets():
    """Create optimized predicate sets for different use cases."""
    
    # Based on the hierarchy analysis, create practical sets
    predicate_sets = {
        'comprehensive': [
            'related_to_at_instance_level',
            'related_to_at_concept_level'
        ],
        
        'focused': [
            'affected_by',
            'affects', 
            'associated_with',
            'interacts_with',
            'participates_in'
        ],
        
        'minimal': [
            'regulates',
            'associated_with',
            'interacts_with',
            'participates_in',
            'similar_to'
        ],
        
        'causal': [
            'affects',
            'affected_by',
            'causes',
            'contributes_to'
        ],
        
        'associational': [
            'associated_with',
            'correlated_with',
            'coexpressed_with',
            'biomarker_for'
        ],
        
        'interaction': [
            'interacts_with',
            'physically_interacts_with',
            'binds',
            'coexists_with'
        ],
        
        'hierarchical': [
            'subclass_of',
            'superclass_of',
            'part_of',
            'has_part'
        ]
    }
    
    return predicate_sets

def main():
    print("="*60)
    print("BIOLINK PREDICATE HIERARCHY ANALYSIS")
    print("="*60)
    
    # Analyze hierarchy
    analysis = analyze_biolink_hierarchy()
    
    print(f"\nAnalyzed {len(analysis)} key parent predicates")
    
    print("\n" + "-"*50)
    print("KEY PARENT PREDICATES BY COVERAGE")
    print("-"*50)
    
    for pred, data in analysis.items():
        if data['coverage'] != 'universal':  # Skip the root
            children_count = len(data['children'])
            print(f"{pred:<35} | {children_count:2d} children | {data['coverage']:<12} | {data['recommendation']}")
    
    # Create predicate sets
    sets = create_predicate_sets()
    
    print("\n" + "-"*50)
    print("OPTIMIZED PREDICATE SETS")
    print("-"*50)
    
    for set_name, predicates in sets.items():
        print(f"\n{set_name.upper()} SET ({len(predicates)} predicates):")
        for pred in predicates:
            print(f"  - biolink:{pred}")
    
    # Generate JavaScript for BTE MCP integration
    print("\n" + "-"*50)
    print("JAVASCRIPT FOR BTE MCP INTEGRATION")
    print("-"*50)
    
    print("\n// Add to BTE MCP query generation")
    print("const BIOLINK_PREDICATE_SETS = {")
    for set_name, predicates in sets.items():
        print(f"  {set_name}: [")
        for pred in predicates:
            print(f"    'biolink:{pred}',")
        print("  ],")
    print("};")
    
    # Recommendations for BTE MCP
    print("\n" + "-"*50)
    print("RECOMMENDATIONS FOR BTE MCP")
    print("-"*50)
    
    print("""
1. DEFAULT COMPREHENSIVE SET:
   Use 'focused' set as default - covers most relationship types
   without being too broad like 'related_to'

2. CATEGORY-SPECIFIC SETS:
   - Gene queries: 'causal' + 'associational' sets
   - Protein queries: 'interaction' + 'causal' sets  
   - Disease queries: 'associational' + 'causal' sets
   - Drug queries: 'causal' + 'interaction' sets

3. QUERY COMPLEXITY:
   - Simple queries: 'minimal' set (5 predicates)
   - Complex queries: 'focused' set (5 predicates)
   - Comprehensive: 'comprehensive' set (2 high-level predicates)

4. AVOID:
   - 'related_to' (too broad, returns everything)
   - Very specific predicates unless user explicitly requests them
   - Mixing hierarchical and instance-level predicates
""")
    
    # Save results
    import json
    with open('biolink_predicate_sets.json', 'w') as f:
        json.dump({
            'hierarchy_analysis': analysis,
            'predicate_sets': sets,
            'recommendations': {
                'default_set': 'focused',
                'category_specific': {
                    'Gene': ['causal', 'associational'],
                    'Protein': ['interaction', 'causal'],
                    'Disease': ['associational', 'causal'],
                    'Drug': ['causal', 'interaction']
                }
            }
        }, f, indent=2)
    
    print(f"\nResults saved to: biolink_predicate_sets.json")

if __name__ == "__main__":
    main()
