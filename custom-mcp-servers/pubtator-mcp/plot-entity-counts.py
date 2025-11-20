#!/usr/bin/env python3
"""
Plot entity publication count distribution from survey results
"""

import json
import matplotlib.pyplot as plt
import numpy as np
from collections import Counter

# Read the survey results
with open('entity-count-survey.json', 'r') as f:
    data = json.load(f)

# Extract entity counts
entity_counts = data['entityCounts']
counts = [min(e['count'], 1000000) for e in entity_counts]  # Cap at 1M
names = [e['entityName'] for e in entity_counts]
types = [e.get('type', 'unknown') for e in entity_counts]

# Sort by count (descending)
sorted_data = sorted(zip(counts, names, types), reverse=True)

# Create figure with subplots
fig, axes = plt.subplots(2, 2, figsize=(16, 12))
fig.suptitle('Entity Publication Count Distribution (Capped at 1M)', fontsize=16, fontweight='bold')

# 1. Bar chart of top 30 entities
ax1 = axes[0, 0]
top_30 = sorted_data[:30]
top_counts = [x[0] for x in top_30]
top_names = [x[1] for x in top_30]

bars = ax1.barh(range(len(top_30)), top_counts, color='steelblue')
ax1.set_yticks(range(len(top_30)))
ax1.set_yticklabels(top_names, fontsize=8)
ax1.set_xlabel('Publication Count (capped at 1M)', fontsize=10)
ax1.set_title('Top 30 Entities by Publication Count', fontsize=12, fontweight='bold')
ax1.invert_yaxis()
ax1.grid(axis='x', alpha=0.3)

# Add value labels on bars
for i, (bar, count) in enumerate(zip(bars, top_counts)):
    width = bar.get_width()
    label = f'{count:,}' if count < 1000000 else '1M+'
    ax1.text(width, bar.get_y() + bar.get_height()/2, 
             label, ha='left', va='center', fontsize=7)

# 2. Histogram of count distribution
ax2 = axes[0, 1]
bins = [0, 10, 100, 1000, 10000, 100000, 500000, 1000000]
bin_labels = ['0-10', '11-100', '101-1K', '1K-10K', '10K-100K', '100K-500K', '500K-1M+']
hist_counts, _ = np.histogram(counts, bins=bins)

colors = plt.cm.viridis(np.linspace(0, 1, len(hist_counts)))
bars2 = ax2.bar(range(len(hist_counts)), hist_counts, color=colors)
ax2.set_xticks(range(len(hist_counts)))
ax2.set_xticklabels(bin_labels, rotation=45, ha='right', fontsize=9)
ax2.set_ylabel('Number of Entities', fontsize=10)
ax2.set_title('Distribution of Publication Counts', fontsize=12, fontweight='bold')
ax2.grid(axis='y', alpha=0.3)

# Add value labels on bars
for bar, count in zip(bars2, hist_counts):
    height = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2., height,
             f'{int(count)}', ha='center', va='bottom', fontsize=9)

# 3. Log scale scatter plot
ax3 = axes[1, 0]
log_counts = [np.log10(max(c, 1)) for c in counts]  # Log scale, avoid log(0)
type_colors = {
    'Gene': 'blue',
    'Disease': 'red',
    'Chemical': 'orange',
    'Species': 'green',
    'Chromosome': 'purple',
    'unknown': 'gray'
}

for i, (count, name, etype) in enumerate(sorted_data):
    color = type_colors.get(etype, 'gray')
    ax3.scatter(i, count, c=color, alpha=0.6, s=50, label=etype if i == 0 or etype not in [x[2] for x in sorted_data[:i]] else '')

ax3.set_yscale('log')
ax3.set_xlabel('Entity Rank', fontsize=10)
ax3.set_ylabel('Publication Count (log scale, capped at 1M)', fontsize=10)
ax3.set_title('Publication Counts by Rank (Log Scale)', fontsize=12, fontweight='bold')
ax3.grid(alpha=0.3)
ax3.set_ylim(1, 1000000)

# Create legend for types
from matplotlib.patches import Patch
legend_elements = [Patch(facecolor=color, label=etype) 
                   for etype, color in type_colors.items() 
                   if etype in types]
ax3.legend(handles=legend_elements, loc='upper right', fontsize=8)

# 4. Box plot by entity type
ax4 = axes[1, 1]
type_data = {}
for count, name, etype in sorted_data:
    if etype not in type_data:
        type_data[etype] = []
    type_data[etype].append(count)

# Prepare data for box plot
box_data = []
box_labels = []
for etype in sorted(type_data.keys()):
    if len(type_data[etype]) > 0:
        box_data.append(type_data[etype])
        box_labels.append(f"{etype}\n(n={len(type_data[etype])})")

bp = ax4.boxplot(box_data, labels=box_labels, patch_artist=True)
ax4.set_yscale('log')
ax4.set_ylabel('Publication Count (log scale, capped at 1M)', fontsize=10)
ax4.set_title('Distribution by Entity Type', fontsize=12, fontweight='bold')
ax4.grid(axis='y', alpha=0.3)
ax4.set_ylim(1, 1000000)

# Color the boxes
colors_list = [type_colors.get(label.split('\n')[0], 'gray') for label in box_labels]
for patch, color in zip(bp['boxes'], colors_list):
    patch.set_facecolor(color)
    patch.set_alpha(0.7)

plt.tight_layout()
plt.savefig('entity-count-distribution.png', dpi=300, bbox_inches='tight')
print("✅ Plot saved to: entity-count-distribution.png")

# Also create a simpler single plot
fig2, ax = plt.subplots(figsize=(14, 8))

# Bar chart of all entities (capped)
all_counts = [x[0] for x in sorted_data]
all_names = [x[1] for x in sorted_data]

bars = ax.bar(range(len(all_counts)), all_counts, color='steelblue', alpha=0.7)
ax.set_xlabel('Entity Rank', fontsize=12)
ax.set_ylabel('Publication Count (capped at 1M)', fontsize=12)
ax.set_title('All Entities Publication Count Distribution (Capped at 1M)', fontsize=14, fontweight='bold')
ax.set_xticks(range(0, len(all_counts), max(1, len(all_counts)//20)))
ax.set_xticklabels([all_names[i] for i in range(0, len(all_counts), max(1, len(all_counts)//20))], 
                   rotation=45, ha='right', fontsize=8)
ax.grid(axis='y', alpha=0.3)
ax.axhline(y=1000000, color='red', linestyle='--', linewidth=2, label='1M Cap')
ax.legend()

plt.tight_layout()
plt.savefig('entity-count-all.png', dpi=300, bbox_inches='tight')
print("✅ Plot saved to: entity-count-all.png")

# Print summary statistics
print("\n📊 Summary Statistics:")
print(f"   Total entities: {len(counts)}")
print(f"   Entities at 1M cap: {sum(1 for c in counts if c >= 1000000)}")
print(f"   Mean count (capped): {np.mean(counts):,.0f}")
print(f"   Median count: {np.median(counts):,.0f}")
print(f"   Min count: {min(counts):,}")
print(f"   Max count (capped): {max(counts):,}")

plt.show()

