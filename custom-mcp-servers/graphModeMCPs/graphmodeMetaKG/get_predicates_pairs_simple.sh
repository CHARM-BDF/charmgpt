#!/bin/bash

# Script to get unique predicates for all pairs of categories from SmartAPI MetaKG
# Outputs everything to a single file for easy analysis

echo "🚀 SmartAPI MetaKG Predicate Pairs Extractor (Single File)"
echo "=========================================================="

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
output_file="predicate_pairs_complete.txt"

echo "📊 Fetching predicates for all category pairs..."
echo "Total combinations: $((${#smartapi_classes[@]} * ${#smartapi_classes[@]}))"
echo ""

# Initialize the output file
cat > "$output_file" << 'EOF'
# SmartAPI MetaKG - Complete Predicate Pairs Analysis
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
        
        # Extract unique predicates
        predicates=$(echo "$response" | jq -r '.hits[] | .predicate' | sort | uniq)
        predicate_count=$(echo "$predicates" | wc -l)
        
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
            echo "$predicates" | sed 's/^/- /' >> "$output_file"
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
- Total unique predicates across all pairs: $total_predicates
- Average predicates per pair: $((total_predicates / pairs_with_predicates))

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
        
        # Count predicates for this pair (we need to re-query or store counts)
        response=$(curl -s "https://smart-api.info/api/metakg?subject=$subject_class&object=$object_class&size=1000")
        predicate_count=$(echo "$response" | jq -r '.hits[] | .predicate' | sort | uniq | wc -l)
        
        echo "$predicate_count $subject_name → $object_name"
    done
done | sort -nr | head -10 | while read count pair; do
    echo "- **$pair**: $count predicates" >> "$output_file"
done

echo ""
echo "✅ Complete! Results saved to: $output_file"
echo "📊 Summary:"
echo "   - Total pairs: $total_combinations"
echo "   - Pairs with predicates: $pairs_with_predicates"
echo "   - Total predicates: $total_predicates"
