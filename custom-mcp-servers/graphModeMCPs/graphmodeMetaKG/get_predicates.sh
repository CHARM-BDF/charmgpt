#!/bin/bash

# Script to get unique predicates for each category from SmartAPI MetaKG

echo "🚀 SmartAPI MetaKG Predicate Extractor"
echo "======================================"

# Define categories and their SmartAPI equivalents
declare -A categories=(
    ["BiologicalProcessOrActivity"]="Biological Process Or Activity"
    ["Gene"]="Gene Or Protein (Gene)"
    ["Protein"]="Gene Or Protein (Protein)"
    ["GeneFamily"]="Gene Family"
    ["DiseaseOrPhenotypicFeature"]="Disease Or Phenotypic Feature"
    ["AnatomicalEntity"]="Anatomical Entity"
    ["RNAProduct"]="RNA Product"
    ["ChemicalMixture"]="Chemical Mixture"
    ["SmallMolecule"]="Small Molecule"
    ["Polypeptide"]="Polypeptide"
    ["ProteinFamily"]="Protein Family"
)

# Create output directory
mkdir -p predicates_output

echo "📊 Fetching predicates for each category..."
echo ""

for smartapi_class in "${!categories[@]}"; do
    display_name="${categories[$smartapi_class]}"
    
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

for smartapi_class in "${!categories[@]}"; do
    display_name="${categories[$smartapi_class]}"
    predicate_count=$(wc -l < "predicates_output/${smartapi_class}_predicates.txt")
    echo "- **$display_name** ($smartapi_class): $predicate_count predicates" >> predicates_output/SUMMARY.md
done

echo "📄 Summary created: predicates_output/SUMMARY.md"
