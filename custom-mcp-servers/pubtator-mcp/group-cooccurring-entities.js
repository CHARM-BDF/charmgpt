#!/usr/bin/env node

/**
 * Group co-occurring entities based on shared publications
 * Filters out entities with 1M+ publications (too generic)
 * Creates groups of entities that appear together in multiple papers
 */

import fs from 'fs';

// Read the survey data to get publication counts
const surveyData = JSON.parse(fs.readFileSync('entity-count-survey.json', 'utf-8'));

// Read the test results to get co-occurrence data
const testResults = JSON.parse(fs.readFileSync('test-fam177a1-results.json', 'utf-8'));

console.log('🔍 ============================================');
console.log('🔍 Grouping Co-Occurring Entities');
console.log('🔍 ============================================\n');

// Step 1: Filter entities with < 1M publications
const entityCountMap = new Map();
surveyData.entityCounts.forEach(e => {
    entityCountMap.set(e.entityName, e.count);
});

const filteredEntities = surveyData.entityCounts
    .filter(e => e.count < 1000000 && e.count > 0)
    .map(e => e.entityName);

console.log(`📊 Filtering entities:`);
console.log(`   Total entities in survey: ${surveyData.entityCounts.length}`);
console.log(`   Entities with < 1M publications: ${filteredEntities.length}`);
console.log(`   Entities with 1M+ publications (filtered out): ${surveyData.entityCounts.length - filteredEntities.length}\n`);

// Step 2: Get all nodes from test results
const allNodes = testResults.nodes.allNodes || testResults.nodes.topNodes || [];
console.log(`📋 Nodes from test results: ${allNodes.length}`);

// Create a map of entity name -> node data
const nodeMap = new Map();
allNodes.forEach(node => {
    if (filteredEntities.includes(node.name)) {
        nodeMap.set(node.name, {
            id: node.id,
            name: node.name,
            type: node.type,
            publications: new Set(node.publications || [])
        });
    }
});

console.log(`   Nodes matching filtered entities: ${nodeMap.size}\n`);

// Step 3: Find co-occurring pairs
console.log('🔗 Finding co-occurring entity pairs...\n');

const coOccurrenceMap = new Map(); // "entity1|entity2" -> { count, publications }

const nodeArray = Array.from(nodeMap.values());

for (let i = 0; i < nodeArray.length; i++) {
    for (let j = i + 1; j < nodeArray.length; j++) {
        const node1 = nodeArray[i];
        const node2 = nodeArray[j];
        
        // Find shared publications
        const sharedPubs = [...node1.publications].filter(pub => node2.publications.has(pub));
        
        if (sharedPubs.length >= 2) { // Only include if co-occur in 2+ papers
            const key = node1.name < node2.name 
                ? `${node1.name}|${node2.name}`
                : `${node2.name}|${node1.name}`;
            
            coOccurrenceMap.set(key, {
                entity1: node1.name,
                entity2: node2.name,
                type1: node1.type,
                type2: node2.type,
                coOccurrenceCount: sharedPubs.length,
                publications: sharedPubs
            });
        }
    }
}

console.log(`   Found ${coOccurrenceMap.size} co-occurring pairs (2+ shared papers)\n`);

// Step 4: Create groups using a simple clustering approach
// Entities that share many connections will be grouped together
console.log('📦 Creating co-occurrence groups...\n');

// Build an adjacency list
const adjacencyList = new Map();
coOccurrenceMap.forEach((pair, key) => {
    if (!adjacencyList.has(pair.entity1)) {
        adjacencyList.set(pair.entity1, []);
    }
    if (!adjacencyList.has(pair.entity2)) {
        adjacencyList.set(pair.entity2, []);
    }
    
    adjacencyList.get(pair.entity1).push({
        entity: pair.entity2,
        weight: pair.coOccurrenceCount
    });
    adjacencyList.get(pair.entity2).push({
        entity: pair.entity1,
        weight: pair.coOccurrenceCount
    });
});

// Simple clustering: group entities that are strongly connected
const visited = new Set();
const groups = [];

function dfs(entity, currentGroup, minWeight = 2) {
    visited.add(entity);
    currentGroup.push(entity);
    
    const neighbors = adjacencyList.get(entity) || [];
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor.entity) && neighbor.weight >= minWeight) {
            dfs(neighbor.entity, currentGroup, minWeight);
        }
    }
}

// Find connected components
nodeArray.forEach(node => {
    if (!visited.has(node.name) && adjacencyList.has(node.name)) {
        const group = [];
        dfs(node.name, group);
        if (group.length >= 2) { // Only include groups with 2+ entities
            groups.push(group);
        }
    }
});

// Also include isolated entities that have connections but form small groups
const allGroupedEntities = new Set();
groups.forEach(group => group.forEach(e => allGroupedEntities.add(e)));

const isolatedEntities = Array.from(nodeMap.keys())
    .filter(e => !allGroupedEntities.has(e) && adjacencyList.has(e));

console.log(`   Created ${groups.length} co-occurrence groups`);
console.log(`   Isolated entities (connected but not in large groups): ${isolatedEntities.length}\n`);

// Step 5: Sort groups by size and strength
groups.sort((a, b) => {
    // Calculate total co-occurrence weight for each group
    const weightA = calculateGroupWeight(a, coOccurrenceMap);
    const weightB = calculateGroupWeight(b, coOccurrenceMap);
    return weightB - weightA;
});

function calculateGroupWeight(group, coOccMap) {
    let totalWeight = 0;
    for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
            const key = group[i] < group[j] 
                ? `${group[i]}|${group[j]}`
                : `${group[j]}|${group[i]}`;
            if (coOccMap.has(key)) {
                totalWeight += coOccMap.get(key).coOccurrenceCount;
            }
        }
    }
    return totalWeight;
}

// Step 6: Generate report
console.log('📊 ============================================');
console.log('📊 CO-OCCURRENCE GROUPS REPORT');
console.log('📊 ============================================\n');

console.log(`Total Groups: ${groups.length}`);
console.log(`Total Entities in Groups: ${allGroupedEntities.size}`);
console.log(`Isolated Entities: ${isolatedEntities.length}\n`);

// Show top groups
console.log('🏆 Top 20 Co-Occurrence Groups:\n');
groups.slice(0, 20).forEach((group, idx) => {
    const groupWeight = calculateGroupWeight(group, coOccurrenceMap);
    const groupTypes = group.map(e => nodeMap.get(e)?.type || 'unknown');
    const typeCounts = {};
    groupTypes.forEach(t => typeCounts[t] = (typeCounts[t] || 0) + 1);
    const typeSummary = Object.entries(typeCounts)
        .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
        .join(', ');
    
    console.log(`${(idx + 1).toString().padStart(2)}. Group ${idx + 1} (${group.length} entities, weight: ${groupWeight}):`);
    console.log(`    Types: ${typeSummary}`);
    console.log(`    Entities: ${group.slice(0, 10).join(', ')}${group.length > 10 ? ` ... (+${group.length - 10} more)` : ''}`);
    
    // Show top connections within group
    const groupConnections = [];
    for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
            const key = group[i] < group[j] 
                ? `${group[i]}|${group[j]}`
                : `${group[j]}|${group[i]}`;
            if (coOccurrenceMap.has(key)) {
                const pair = coOccurrenceMap.get(key);
                groupConnections.push({
                    entity1: pair.entity1,
                    entity2: pair.entity2,
                    coOccurrenceCount: pair.coOccurrenceCount
                });
            }
        }
    }
    groupConnections.sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount);
    if (groupConnections.length > 0) {
        console.log(`    Top connections:`);
        groupConnections.slice(0, 5).forEach(conn => {
            console.log(`       ${conn.entity1} ↔ ${conn.entity2} (${conn.coOccurrenceCount} papers)`);
        });
    }
    console.log('');
});

// Save results
const output = {
    timestamp: new Date().toISOString(),
    filterCriteria: {
        maxPublications: 1000000,
        minCoOccurrence: 2
    },
    summary: {
        totalEntitiesFiltered: filteredEntities.length,
        entitiesInGroups: allGroupedEntities.size,
        isolatedEntities: isolatedEntities.length,
        totalGroups: groups.length,
        totalCoOccurringPairs: coOccurrenceMap.size
    },
    groups: groups.map((group, idx) => {
        const groupWeight = calculateGroupWeight(group, coOccurrenceMap);
        const groupConnections = [];
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const key = group[i] < group[j] 
                    ? `${group[i]}|${group[j]}`
                    : `${group[j]}|${group[i]}`;
                if (coOccurrenceMap.has(key)) {
                    const pair = coOccurrenceMap.get(key);
                    groupConnections.push({
                        entity1: pair.entity1,
                        entity2: pair.entity2,
                        coOccurrenceCount: pair.coOccurrenceCount,
                        publications: pair.publications
                    });
                }
            }
        }
        return {
            groupId: idx + 1,
            size: group.length,
            weight: groupWeight,
            entities: group.map(e => ({
                name: e,
                type: nodeMap.get(e)?.type || 'unknown',
                publicationCount: nodeMap.get(e)?.publications.size || 0
            })),
            connections: groupConnections.sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
        };
    }),
    isolatedEntities: isolatedEntities.map(e => ({
        name: e,
        type: nodeMap.get(e)?.type || 'unknown',
        publicationCount: nodeMap.get(e)?.publications.size || 0
    })),
    allCoOccurringPairs: Array.from(coOccurrenceMap.values())
        .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
        .slice(0, 100) // Top 100 pairs
};

fs.writeFileSync('cooccurrence-groups.json', JSON.stringify(output, null, 2));
console.log('💾 Results saved to: cooccurrence-groups.json\n');

console.log('✅ ============================================');
console.log('✅ Grouping complete!');
console.log('✅ ============================================\n');

