#!/usr/bin/env python3
"""
Extract parent predicates from Biolink hierarchy that cover the most child predicates.
This helps create more comprehensive default predicate sets for queries.
"""

import json
import sys
from collections import defaultdict, Counter

def load_hierarchy_from_html(html_file):
    """Extract the treeData from the HTML file."""
    with open(html_file, 'r') as f:
        content = f.read()
    
    # Find the treeData array in the JavaScript
    start = content.find('var treeData = [')
    if start == -1:
        raise ValueError("Could not find treeData in HTML file")
    
    # Find the end of the array
    bracket_count = 0
    start_pos = start + len('var treeData = ')
    for i, char in enumerate(content[start_pos:], start_pos):
        if char == '[':
            bracket_count += 1
        elif char == ']':
            bracket_count -= 1
            if bracket_count == 0:
                end_pos = i + 1
                break
    else:
        raise ValueError("Could not find end of treeData array")
    
    # Extract and parse the JSON
    json_str = content[start_pos:end_pos]
    return json.loads(json_str)

def count_children_recursive(node, depth=0):
    """Recursively count all children of a node."""
    total_children = 0
    direct_children = 0
    
    if 'children' in node:
        direct_children = len(node['children'])
        total_children = direct_children
        
        for child in node['children']:
            child_total, _ = count_children_recursive(child, depth + 1)
            total_children += child_total
    
    return total_children, direct_children

def extract_all_predicates(node, depth=0):
    """Extract all predicate names from the hierarchy."""
    predicates = []
    
    if 'name' in node:
        predicates.append(node['name'])
    
    if 'children' in node:
        for child in node['children']:
            predicates.extend(extract_all_predicates(child, depth + 1))
    
    return predicates

def analyze_hierarchy(tree_data):
    """Analyze the hierarchy to find the most useful parent predicates."""
    root = tree_data[0]
    
    # Get all predicates
    all_predicates = extract_all_predicates(root)
    print(f"Total predicates in hierarchy: {len(all_predicates)}")
    
    # Analyze each node
    analysis = []
    
    def analyze_node(node, depth=0):
        if 'name' not in node:
            return
        
        total_children, direct_children = count_children_recursive(node)
        
        # Calculate coverage metrics
        coverage_ratio = total_children / len(all_predicates) if all_predicates else 0
        efficiency = total_children / (depth + 1) if depth > 0 else total_children  # Avoid root
        
        analysis.append({
            'name': node['name'],
            'depth': depth,
            'direct_children': direct_children,
            'total_children': total_children,
            'coverage_ratio': coverage_ratio,
            'efficiency': efficiency,
            'has_children': 'children' in node
        })
        
        # Recursively analyze children
        if 'children' in node:
            for child in node['children']:
                analyze_node(child, depth + 1)
    
    analyze_node(root)
    
    return analysis

def find_optimal_parents(analysis, min_children=5, max_depth=3):
    """Find the best parent predicates based on coverage and efficiency."""
    
    # Filter candidates
    candidates = [
        node for node in analysis 
        if (node['has_children'] and 
            node['total_children'] >= min_children and 
            node['depth'] <= max_depth and
            node['name'] != 'related_to')  # Exclude root as it's too broad
    ]
    
    # Sort by efficiency (children per depth level)
    candidates.sort(key=lambda x: x['efficiency'], reverse=True)
    
    return candidates

def create_predicate_sets(analysis):
    """Create different predicate sets for different use cases."""
    
    # Find optimal parents
    optimal_parents = find_optimal_parents(analysis, min_children=10, max_depth=2)
    
    # Create different sets
    sets = {
        'comprehensive': [],  # Top 5 most efficient parents
        'focused': [],        # Parents with 20-50 children
        'minimal': [],        # Parents with 5-20 children
        'high_level': []      # Depth 1-2 parents only
    }
    
    # Comprehensive set (top performers)
    sets['comprehensive'] = [p['name'] for p in optimal_parents[:5]]
    
    # Focused set (moderate coverage)
    focused_candidates = [p for p in optimal_parents if 20 <= p['total_children'] <= 50]
    sets['focused'] = [p['name'] for p in focused_candidates[:8]]
    
    # Minimal set (smaller, more specific)
    minimal_candidates = [p for p in optimal_parents if 5 <= p['total_children'] <= 20]
    sets['minimal'] = [p['name'] for p in minimal_candidates[:6]]
    
    # High-level set (shallow depth)
    high_level_candidates = [p for p in optimal_parents if p['depth'] <= 2]
    sets['high_level'] = [p['name'] for p in high_level_candidates[:6]]
    
    return sets

def main():
    if len(sys.argv) != 2:
        print("Usage: python extract_parent_predicates.py <biolink_hierarchy.html>")
        sys.exit(1)
    
    html_file = sys.argv[1]
    
    try:
        # Load hierarchy
        print("Loading Biolink hierarchy...")
        tree_data = load_hierarchy_from_html(html_file)
        
        # Analyze hierarchy
        print("Analyzing hierarchy...")
        analysis = analyze_hierarchy(tree_data)
        
        # Find optimal parents
        print("Finding optimal parent predicates...")
        optimal_parents = find_optimal_parents(analysis)
        
        # Create predicate sets
        print("Creating predicate sets...")
        predicate_sets = create_predicate_sets(analysis)
        
        # Print results
        print("\n" + "="*60)
        print("BIOLINK PREDICATE HIERARCHY ANALYSIS")
        print("="*60)
        
        print(f"\nTotal predicates analyzed: {len(analysis)}")
        print(f"Optimal parent candidates: {len(optimal_parents)}")
        
        print("\n" + "-"*40)
        print("TOP 10 MOST EFFICIENT PARENT PREDICATES")
        print("-"*40)
        for i, parent in enumerate(optimal_parents[:10], 1):
            print(f"{i:2d}. {parent['name']:<35} "
                  f"Children: {parent['total_children']:3d} "
                  f"Depth: {parent['depth']} "
                  f"Efficiency: {parent['efficiency']:.1f}")
        
        print("\n" + "-"*40)
        print("PREDICATE SETS FOR DIFFERENT USE CASES")
        print("-"*40)
        
        for set_name, predicates in predicate_sets.items():
            print(f"\n{set_name.upper()} SET ({len(predicates)} predicates):")
            for pred in predicates:
                # Find the analysis data for this predicate
                pred_data = next((p for p in analysis if p['name'] == pred), None)
                if pred_data:
                    print(f"  - {pred:<35} ({pred_data['total_children']} children)")
                else:
                    print(f"  - {pred}")
        
        # Generate JavaScript/JSON for easy integration
        print("\n" + "-"*40)
        print("JAVASCRIPT/JSON FOR INTEGRATION")
        print("-"*40)
        
        print("\n// Predicate sets for BTE MCP")
        print("const PREDICATE_SETS = {")
        for set_name, predicates in predicate_sets.items():
            print(f"  {set_name}: [")
            for pred in predicates:
                print(f"    'biolink:{pred}',")
            print("  ],")
        print("};")
        
        # Save detailed analysis
        output_file = "predicate_hierarchy_analysis.json"
        with open(output_file, 'w') as f:
            json.dump({
                'analysis': analysis,
                'optimal_parents': optimal_parents,
                'predicate_sets': predicate_sets
            }, f, indent=2)
        
        print(f"\nDetailed analysis saved to: {output_file}")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
