#!/usr/bin/env python3
"""
Script to get unique predicates for each category from SmartAPI MetaKG
"""

import requests
import json
import time
from collections import defaultdict

# Your handwritten categories mapped to SmartAPI equivalents
CATEGORIES = {
    "Biological Process Or Activity": "BiologicalProcessOrActivity",
    "Gene Or Protein": ["Gene", "Protein"],  # Handle both
    "Gene Family": "GeneFamily", 
    "Disease Or Phenotypic Feature": "DiseaseOrPhenotypicFeature",
    "Anatomical Entity": "AnatomicalEntity",
    "RNA Product": "RNAProduct",
    "Chemical Mixture": "ChemicalMixture", 
    "Small Molecule": "SmallMolecule",
    "Polypeptide": "Polypeptide",
    "Protein Family": "ProteinFamily"
}

def get_predicates_for_category(category_name, smartapi_class, max_size=1000):
    """
    Get unique predicates for a given category from SmartAPI MetaKG
    """
    print(f"\n🔍 Getting predicates for: {category_name} ({smartapi_class})")
    
    url = "https://smart-api.info/api/metakg"
    params = {
        "subject": smartapi_class,
        "size": max_size
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        total_hits = data.get('total', 0)
        hits = data.get('hits', [])
        
        print(f"   📊 Total associations: {total_hits}")
        print(f"   📥 Retrieved: {len(hits)}")
        
        # Extract unique predicates
        predicates = set()
        for hit in hits:
            predicate = hit.get('predicate')
            if predicate:
                predicates.add(predicate)
        
        return sorted(list(predicates)), total_hits
        
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Error fetching data: {e}")
        return [], 0
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
        return [], 0

def get_predicates_for_multiple_classes(category_name, classes):
    """
    Get predicates for categories that map to multiple SmartAPI classes
    """
    all_predicates = set()
    total_associations = 0
    
    for smartapi_class in classes:
        predicates, associations = get_predicates_for_category(f"{category_name} ({smartapi_class})", smartapi_class)
        all_predicates.update(predicates)
        total_associations += associations
    
    return sorted(list(all_predicates)), total_associations

def main():
    print("🚀 SmartAPI MetaKG Predicate Extractor")
    print("=" * 50)
    
    results = {}
    
    for category_name, smartapi_class in CATEGORIES.items():
        # Add small delay to be respectful to the API
        time.sleep(0.5)
        
        if isinstance(smartapi_class, list):
            # Handle categories that map to multiple classes
            predicates, total_associations = get_predicates_for_multiple_classes(category_name, smartapi_class)
        else:
            # Handle single class categories
            predicates, total_associations = get_predicates_for_category(category_name, smartapi_class)
        
        results[category_name] = {
            "predicates": predicates,
            "count": len(predicates),
            "total_associations": total_associations
        }
        
        print(f"   ✅ Found {len(predicates)} unique predicates")
    
    # Generate summary report
    print("\n" + "=" * 80)
    print("📋 SUMMARY REPORT")
    print("=" * 80)
    
    # Sort by predicate count (descending)
    sorted_results = sorted(results.items(), key=lambda x: x[1]['count'], reverse=True)
    
    for category_name, data in sorted_results:
        print(f"\n🔸 {category_name}")
        print(f"   Predicates: {data['count']}")
        print(f"   Total Associations: {data['total_associations']}")
        print(f"   Predicates: {', '.join(data['predicates'][:10])}{'...' if len(data['predicates']) > 10 else ''}")
    
    # Save detailed results to JSON
    output_file = "predicates_by_category.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Detailed results saved to: {output_file}")
    
    # Generate a simple text summary
    summary_file = "predicates_summary.txt"
    with open(summary_file, 'w') as f:
        f.write("SmartAPI MetaKG - Predicates by Category\n")
        f.write("=" * 50 + "\n\n")
        
        for category_name, data in sorted_results:
            f.write(f"{category_name} ({data['count']} predicates, {data['total_associations']} associations)\n")
            f.write("-" * 60 + "\n")
            for predicate in data['predicates']:
                f.write(f"  • {predicate}\n")
            f.write("\n")
    
    print(f"📄 Text summary saved to: {summary_file}")

if __name__ == "__main__":
    main()
