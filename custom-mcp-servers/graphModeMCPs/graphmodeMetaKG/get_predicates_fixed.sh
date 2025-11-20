#!/bin/bash

# Script to get unique predicates for each category from SmartAPI MetaKG
# Fixed version for older bash versions that don't support associative arrays

echo "🚀 SmartAPI MetaKG Predicate Extractor (Fixed)"
echo "=============================================="

# Define categories as arrays (compatible with older bash)
smartapi_classes=(
    "BiologicalProcessOrActivity"
    "Gene"
    "Protein"
    "GeneFamily"
    "DiseaseOrPhenotypicFeature"
    "AnatomicalEntity"
    "RNAProduct"
    "ChemicalMixture"
    "SmallMolecule"
    "Polypeptide"
    "ProteinFamily"
)

display_names=(
    "Biological Process Or Activity"
    "Gene Or Protein (Gene)"
    "Gene Or Protein (Protein)"
    "Gene Family"
    "Disease Or Phenotypic Feature"
    "Anatomical Entity"
    "RNA Product"
    "Chemical Mixture"
    "Small Molecule"
    "Polypeptide"
    "Protein Family"
)

# Create output directory
mkdir -p predicates_output

echo "📊 Fetching predicates for each category..."
echo ""

# Process each category
for i in "${!smartapi_classes[@]}"; do
    smartapi_class="${smartapi_classes[$i]}"
    display_name="${display_names[$i]}"
    
    echo "🔍 Processing: $display_name ($smartapi_class)"
    
    # Get the data
    response=$(curl -s "https://smart-api.info/api/metakg?subject=$smartapi_class&size=1000")
    
    # Extract total count
    total=$(echo "$response" | jq -r '.total // 0')
    
    # Extract unique predicates
    predicates=$(echo "$response" | jq -r '.hits[] | .predicate' | sort | uniq)
    predicate_count=$(echo "$predicates" | wc -l)
    
    echo "   📈 Total associations: $total"
    echo "   🔗 Unique predicates: $predicate_count"
    
    # Save predicates to file
    echo "$predicates" > "predicates_output/${smartapi_class}_predicates.txt"
    
    # Show first 10 predicates
    echo "   📋 Sample predicates: $(echo "$predicates" | head -10 | tr '\n' ', ' | sed 's/,$//')"
    echo ""
    
    # Be respectful to the API
    sleep 0.5
done

echo "✅ All data collected!"
echo "📁 Results saved in predicates_output/ directory"

# Create summary file
echo "📋 Creating summary..."
cat > predicates_output/SUMMARY.md << 'EOF'
# SmartAPI MetaKG - Predicates by Category

This directory contains the unique predicates available for each category in the SmartAPI MetaKG.

## Files:
- `{category}_predicates.txt` - List of unique predicates for each category
- `SUMMARY.md` - This summary file

## Categories:
EOF

for i in "${!smartapi_classes[@]}"; do
    smartapi_class="${smartapi_classes[$i]}"
    display_name="${display_names[$i]}"
    predicate_count=$(wc -l < "predicates_output/${smartapi_class}_predicates.txt")
    echo "- **$display_name** ($smartapi_class): $predicate_count predicates" >> predicates_output/SUMMARY.md
done

echo "📄 Summary created: predicates_output/SUMMARY.md"
