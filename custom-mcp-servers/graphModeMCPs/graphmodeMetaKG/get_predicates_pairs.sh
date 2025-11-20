#!/bin/bash

# Script to get unique predicates for all pairs of categories from SmartAPI MetaKG
# This creates an N×N matrix of category relationships

echo "🚀 SmartAPI MetaKG Predicate Pairs Extractor"
echo "============================================="

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
mkdir -p predicates_pairs_output

echo "📊 Fetching predicates for all category pairs..."
echo "Total combinations: $((${#smartapi_classes[@]} * ${#smartapi_classes[@]}))"
echo ""

# Initialize counters
total_combinations=$((${#smartapi_classes[@]} * ${#smartapi_classes[@]}))
current=0

# Process each pair
for i in "${!smartapi_classes[@]}"; do
    subject_class="${smartapi_classes[$i]}"
    subject_name="${display_names[$i]}"
    
    for j in "${!smartapi_classes[@]}"; do
        object_class="${smartapi_classes[$j]}"
        object_name="${display_names[$j]}"
        
        current=$((current + 1))
        echo "[$current/$total_combinations] 🔍 Processing: $subject_name → $object_name"
        
        # Get the data for this pair
        response=$(curl -s "https://smart-api.info/api/metakg?subject=$subject_class&object=$object_class&size=1000")
        
        # Extract total count
        total=$(echo "$response" | jq -r '.total // 0')
        
        # Extract unique predicates
        predicates=$(echo "$response" | jq -r '.hits[] | .predicate' | sort | uniq)
        predicate_count=$(echo "$predicates" | wc -l)
        
        echo "   📈 Total associations: $total"
        echo "   🔗 Unique predicates: $predicate_count"
        
        # Save predicates to file
        pair_name="${subject_class}_to_${object_class}"
        echo "$predicates" > "predicates_pairs_output/${pair_name}_predicates.txt"
        
        # Show first 5 predicates if any exist
        if [ $predicate_count -gt 0 ]; then
            echo "   📋 Sample predicates: $(echo "$predicates" | head -5 | tr '\n' ', ' | sed 's/,$//')"
        else
            echo "   📋 No predicates found"
        fi
        echo ""
        
        # Be respectful to the API
        sleep 0.3
    done
done

echo "✅ All pair data collected!"
echo "📁 Results saved in predicates_pairs_output/ directory"

# Create summary file
echo "📋 Creating summary..."
cat > predicates_pairs_output/SUMMARY.md << 'EOF'
# SmartAPI MetaKG - Predicates by Category Pairs

This directory contains the unique predicates available for each pair of categories in the SmartAPI MetaKG.

## Files:
- `{subject}_to_{object}_predicates.txt` - List of unique predicates for each category pair
- `SUMMARY.md` - This summary file
- `matrix.csv` - Predicate count matrix (CSV format)

## Category Pairs:
EOF

# Create a matrix summary
echo "Creating predicate count matrix..."
cat > predicates_pairs_output/matrix.csv << 'EOF'
Subject,Object,Predicate_Count,Total_Associations
EOF

for i in "${!smartapi_classes[@]}"; do
    subject_class="${smartapi_classes[$i]}"
    subject_name="${display_names[$i]}"
    
    for j in "${!smartapi_classes[@]}"; do
        object_class="${smartapi_classes[$j]}"
        object_name="${display_names[$j]}"
        
        pair_name="${subject_class}_to_${object_class}"
        predicate_count=$(wc -l < "predicates_pairs_output/${pair_name}_predicates.txt")
        
        # Get total associations from the file (we'll need to re-query or store this)
        # For now, just use predicate count as a proxy
        echo "$subject_name,$object_name,$predicate_count,0" >> predicates_pairs_output/matrix.csv
        
        # Add to summary
        echo "- **$subject_name** → **$object_name**: $predicate_count predicates" >> predicates_pairs_output/SUMMARY.md
    done
done

echo "📄 Summary created: predicates_pairs_output/SUMMARY.md"
echo "📊 Matrix created: predicates_pairs_output/matrix.csv"

# Create a simple analysis
echo "📈 Creating analysis..."
cat > predicates_pairs_output/ANALYSIS.md << 'EOF'
# Predicate Pairs Analysis

## Top Category Pairs by Predicate Count

EOF

# Find top 10 pairs by predicate count
echo "Finding top pairs..."
for file in predicates_pairs_output/*_predicates.txt; do
    if [ -f "$file" ]; then
        count=$(wc -l < "$file")
        pair_name=$(basename "$file" _predicates.txt)
        echo "$count $pair_name"
    fi
done | sort -nr | head -10 | while read count pair; do
    echo "- **$pair**: $count predicates" >> predicates_pairs_output/ANALYSIS.md
done

echo "📊 Analysis created: predicates_pairs_output/ANALYSIS.md"
echo ""
echo "🎉 Complete! Check the predicates_pairs_output/ directory for all results."
