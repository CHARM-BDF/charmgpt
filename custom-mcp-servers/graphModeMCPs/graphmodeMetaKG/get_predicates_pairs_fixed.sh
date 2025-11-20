#!/bin/bash

# Script to get unique predicates for all pairs of categories from SmartAPI MetaKG
# Fixed version that properly handles empty results

echo "🚀 SmartAPI MetaKG Predicate Pairs Extractor (Fixed)"
echo "===================================================="

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

# Create output file
output_file="predicate_pairs_fixed.txt"

echo "📊 Fetching predicates for all category pairs..."
echo "Total combinations: $((${#smartapi_classes[@]} * ${#smartapi_classes[@]}))"
echo ""

# Initialize the output file
cat > "$output_file" << 'EOF'
# SmartAPI MetaKG - Complete Predicate Pairs Analysis (Fixed)
# Generated: $(date)
# Total Categories: 11
# Total Pairs: 121

EOF

# Initialize counters
total_combinations=$((${#smartapi_classes[@]} * ${#smartapi_classes[@]}))
current=0
total_predicates=0
pairs_with_predicates=0

echo "Processing pairs..."

# Process each pair
for i in "${!smartapi_classes[@]}"; do
    subject_class="${smartapi_classes[$i]}"
    subject_name="${display_names[$i]}"
    
    for j in "${!smartapi_classes[@]}"; do
        object_class="${smartapi_classes[$j]}"
        object_name="${display_names[$j]}"
        
        current=$((current + 1))
        echo "[$current/$total_combinations] $subject_name → $object_name"
        
        # Get the data for this pair
        response=$(curl -s "https://smart-api.info/api/metakg?subject=$subject_class&object=$object_class&size=1000")
        
        # Extract total count
        total=$(echo "$response" | jq -r '.total // 0')
        
        # Extract unique predicates - FIXED: handle empty results properly
        predicates=$(echo "$response" | jq -r '.hits[] | .predicate' 2>/dev/null | sort | uniq)
        
        # Count predicates properly - only count non-empty lines
        if [ -z "$predicates" ]; then
            predicate_count=0
        else
            predicate_count=$(echo "$predicates" | grep -v '^$' | wc -l)
        fi
        
        # Add to output file
        echo "" >> "$output_file"
        echo "## $subject_name → $object_name" >> "$output_file"
        echo "**Subject:** $subject_class" >> "$output_file"
        echo "**Object:** $object_class" >> "$output_file"
        echo "**Total Associations:** $total" >> "$output_file"
        echo "**Unique Predicates:** $predicate_count" >> "$output_file"
        echo "" >> "$output_file"
        
        if [ $predicate_count -gt 0 ]; then
            echo "**Predicates:**" >> "$output_file"
            echo "$predicates" | grep -v '^$' | sed 's/^/- /' >> "$output_file"
            total_predicates=$((total_predicates + predicate_count))
            pairs_with_predicates=$((pairs_with_predicates + 1))
        else
            echo "**Predicates:** None found" >> "$output_file"
        fi
        
        echo "   📈 Associations: $total, Predicates: $predicate_count"
        
        # Be respectful to the API
        sleep 0.2
    done
done

# Add summary to the end
cat >> "$output_file" << EOF

# Summary
- Total pairs processed: $total_combinations
- Pairs with predicates: $pairs_with_predicates
- Pairs with no predicates: $((total_combinations - pairs_with_predicates))
- Total unique predicates across all pairs: $total_predicates
- Average predicates per pair with data: $((total_predicates / pairs_with_predicates))

# Top Pairs by Predicate Count
EOF

# Find and add top pairs
echo "Finding top pairs..."
for i in "${!smartapi_classes[@]}"; do
    subject_class="${smartapi_classes[$i]}"
    subject_name="${display_names[$i]}"
    
    for j in "${!smartapi_classes[@]}"; do
        object_class="${smartapi_classes[$j]}"
        object_name="${display_names[$j]}"
        
        # Count predicates for this pair properly
        response=$(curl -s "https://smart-api.info/api/metakg?subject=$subject_class&object=$object_class&size=1000")
        predicates=$(echo "$response" | jq -r '.hits[] | .predicate' 2>/dev/null | sort | uniq)
        
        if [ -z "$predicates" ]; then
            predicate_count=0
        else
            predicate_count=$(echo "$predicates" | grep -v '^$' | wc -l)
        fi
        
        if [ $predicate_count -gt 0 ]; then
            echo "$predicate_count $subject_name → $object_name"
        fi
    done
done | sort -nr | head -10 | while read count pair; do
    echo "- **$pair**: $count predicates" >> "$output_file"
done

echo ""
echo "✅ Complete! Results saved to: $output_file"
echo "📊 Summary:"
echo "   - Total pairs: $total_combinations"
echo "   - Pairs with predicates: $pairs_with_predicates"
echo "   - Pairs with no predicates: $((total_combinations - pairs_with_predicates))"
echo "   - Total predicates: $total_predicates"
