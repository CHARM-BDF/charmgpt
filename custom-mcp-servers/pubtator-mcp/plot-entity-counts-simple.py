#!/usr/bin/env python3
"""
Simple text-based visualization of entity publication counts
Uses only standard library - no external dependencies
"""

import json
import math

def create_bar_chart(data, max_width=60):
    """Create a simple ASCII bar chart"""
    max_val = max(data)
    scale = max_width / max_val
    
    bars = []
    for i, val in enumerate(data):
        bar_length = int(val * scale)
        bar = '█' * bar_length
        bars.append((i, bar, val))
    
    return bars

# Read the survey results
with open('entity-count-survey.json', 'r') as f:
    data = json.load(f)

# Process data - cap at 1M
entity_counts = data['entityCounts']
entities = [(e['entityName'], min(e['count'], 1000000), e.get('type', 'unknown'), e['count']) 
            for e in entity_counts]
entities.sort(key=lambda x: x[1], reverse=True)

print("=" * 80)
print("ENTITY PUBLICATION COUNT DISTRIBUTION (Capped at 1M)")
print("=" * 80)
print()

# Summary statistics
total = len(entities)
capped = sum(1 for _, _, _, orig in entities if orig >= 1000000)
mean = sum(count for _, count, _, _ in entities) / total
sorted_counts = sorted([count for _, count, _, _ in entities])
median = sorted_counts[len(sorted_counts) // 2]
min_count = min(count for _, count, _, _ in entities)
max_count = max(count for _, count, _, _ in entities)

print("📊 SUMMARY STATISTICS:")
print(f"   Total entities: {total}")
print(f"   Entities at 1M cap: {capped}")
print(f"   Mean count (capped): {mean:,.0f}")
print(f"   Median count: {median:,.0f}")
print(f"   Min count: {min_count:,}")
print(f"   Max count (capped): {max_count:,}")
print()

# Top 30 entities
print("=" * 80)
print("TOP 30 ENTITIES BY PUBLICATION COUNT")
print("=" * 80)
print()

top_30 = entities[:30]
max_name_len = max(len(name) for name, _, _, _ in top_30)
max_count = top_30[0][1]

for i, (name, count, etype, orig_count) in enumerate(top_30, 1):
    bar_length = int((count / max_count) * 50)
    bar = '█' * bar_length
    label = '1M+' if orig_count >= 1000000 else f'{count:,}'
    print(f"{i:2d}. {name:<{max_name_len}} [{etype:10s}] {bar} {label}")

print()
print("=" * 80)
print("DISTRIBUTION BY COUNT RANGES")
print("=" * 80)
print()

# Distribution bins
bins = [
    ('0-10', 0, 10),
    ('11-100', 11, 100),
    ('101-1K', 101, 1000),
    ('1K-10K', 1001, 10000),
    ('10K-100K', 10001, 100000),
    ('100K-500K', 100001, 500000),
    ('500K-1M+', 500001, 1000000)
]

bin_counts = []
for label, min_val, max_val in bins:
    count = sum(1 for _, cnt, _, _ in entities if min_val <= cnt <= max_val)
    bin_counts.append((label, count))
    bar_length = int((count / total) * 50)
    bar = '█' * bar_length
    percentage = (count / total) * 100
    print(f"{label:12s} {bar} {count:3d} entities ({percentage:5.1f}%)")

print()
print("=" * 80)
print("STATISTICS BY ENTITY TYPE")
print("=" * 80)
print()

# Group by type
type_stats = {}
for name, count, etype, orig_count in entities:
    if etype not in type_stats:
        type_stats[etype] = {'counts': [], 'names': []}
    type_stats[etype]['counts'].append(count)
    type_stats[etype]['names'].append(name)

for etype in sorted(type_stats.keys()):
    counts = type_stats[etype]['counts']
    total_pubs = sum(counts)
    avg = total_pubs / len(counts)
    median_val = sorted(counts)[len(counts) // 2]
    min_val = min(counts)
    max_val = max(counts)
    
    print(f"{etype}:")
    print(f"   Entities: {len(counts)}")
    print(f"   Total Publications: {total_pubs:,}")
    print(f"   Average: {avg:,.0f}")
    print(f"   Median: {median_val:,}")
    print(f"   Range: {min_val:,} - {max_val:,}")
    print()

# Entities at cap
capped_entities = [(name, orig) for name, _, _, orig in entities if orig >= 1000000]
if capped_entities:
    print("=" * 80)
    print(f"ENTITIES AT 1M CAP ({len(capped_entities)} entities)")
    print("=" * 80)
    print()
    for name, orig_count in capped_entities[:20]:
        print(f"   {name:<40s} {orig_count:>15,} (shown as 1M+)")
    if len(capped_entities) > 20:
        print(f"   ... and {len(capped_entities) - 20} more")

print()
print("=" * 80)
print("✅ Visualization complete!")
print("=" * 80)

