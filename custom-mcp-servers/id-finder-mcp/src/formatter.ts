// Formatter utilities for ID Finder MCP

import { randomUUID } from 'crypto';

// Entity identification types
export interface EntityIdentification {
    input: string;
    identifiers: Entity[];
}

export interface Entity {
    identifier: string;
    type: string[];
    name: string;
    description?: string;
    synonyms?: string[];
    confidence?: number;
}

// ARAX specific response types
export interface AraxResponse {
    [entityName: string]: AraxEntityData;
}

export interface AraxEntityData {
    categories: {
        [category: string]: number;
    };
    id: {
        SRI_normalizer_category: string;
        SRI_normalizer_curie: string;
        SRI_normalizer_name: string;
        category: string;
        identifier: string;
        name: string;
    };
    nodes: AraxNode[];
    total_synonyms: number;
}

export interface AraxNode {
    category: string;
    category_kg2pre: string | null;
    category_sri: string | null;
    identifier: string;
    in_kg2pre: boolean;
    in_sri: boolean;
    label: string | null;
    major_branch: string;
    name_kg2pre: string | null;
    name_sri: string | null;
}

// Extract normalizer information from ARAX response
export function extractNormalizerInfo(araxResponse: AraxResponse): NormalizerInfo[] {
    return Object.entries(araxResponse).map(([entityName, data]) => {
        // Check if data.id exists and has the required properties
        if (!data.id) {
            console.error(`[id-finder-mcp] No ID data found for entity: ${entityName}`);
            return {
                input: entityName,
                category: 'Unknown',
                curie: 'Unknown',
                name: 'Unknown'
            };
        }
        
        return {
            input: entityName,
            category: data.id.SRI_normalizer_category || 'Unknown',
            curie: data.id.SRI_normalizer_curie || 'Unknown',
            name: data.id.SRI_normalizer_name || 'Unknown'
        };
    });
}

export interface NormalizerInfo {
    input: string;
    category: string;
    curie: string;
    name: string;
}

// Format ARAX normalizer data as markdown table
export function formatAraxAsMarkdownTable(araxResponse: AraxResponse): string {
    // Start with table header
    let markdown = "| Input Term | Category | Identifier | Name |\n";
    markdown += "|------------|----------|------------|------|\n";
    
    // Add rows for each entity
    Object.entries(araxResponse).forEach(([entityName, data]) => {
        if (data.id) {
            markdown += `| ${entityName} | ${data.id.SRI_normalizer_category || 'Unknown'} | ${data.id.SRI_normalizer_curie || 'Unknown'} | ${data.id.SRI_normalizer_name || 'Unknown'} |\n`;
        } else {
            markdown += `| ${entityName} | Unknown | Unknown | Unknown |\n`;
        }
    });
    
    return markdown;
}

// Convert ARAX response to EntityIdentification format for compatibility
export function convertAraxToEntityIdentification(araxResponse: AraxResponse): EntityIdentification[] {
    return Object.entries(araxResponse).map(([entityName, data]) => {
        // Create an entity from normalizer info
        const mainEntity: Entity = {
            identifier: data.id?.SRI_normalizer_curie || 'Unknown',
            type: [data.id?.SRI_normalizer_category || 'Unknown'],
            name: data.id?.SRI_normalizer_name || 'Unknown'
        };
        
        // Create entities from nodes if needed
        const nodeEntities: Entity[] = (data.nodes || []).map(node => ({
            identifier: node.identifier,
            type: [node.category],
            name: node.label || node.name_sri || node.name_kg2pre || node.identifier
        }));
        
        // Return in EntityIdentification format with the main entity first
        return {
            input: entityName,
            identifiers: [mainEntity, ...nodeEntities]
        };
    });
}

// Format entity data as markdown table for better display
export function formatAsMarkdownTable(entities: EntityIdentification[]): string {
    // Start with table header
    let markdown = "| Input Term | Identifier | Name | Type | Confidence |\n";
    markdown += "|------------|------------|------|------|------------|\n";
    
    // Add rows for each entity and its identifiers
    entities.forEach(entity => {
        if (!entity.identifiers || entity.identifiers.length === 0) {
            markdown += `| ${entity.input} | No identifiers found | - | - | - |\n`;
            return;
        }
        
        // Add first identifier in the row with the input term
        const firstId = entity.identifiers[0];
        markdown += `| ${entity.input} | ${firstId.identifier} | ${firstId.name} | ${firstId.type.join(', ')} | ${firstId.confidence || '-'} |\n`;
        
        // Add additional identifiers if any (without repeating the input term)
        for (let i = 1; i < entity.identifiers.length; i++) {
            const id = entity.identifiers[i];
            markdown += `| | ${id.identifier} | ${id.name} | ${id.type.join(', ')} | ${id.confidence || '-'} |\n`;
        }
    });
    
    return markdown;
}

// Format entity data for graph visualization
export function formatAsGraph(entities: EntityIdentification[]): any {
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map<string, boolean>();
    
    entities.forEach(entity => {
        // Add input term as a node if it has identifiers
        if (entity.identifiers && entity.identifiers.length > 0) {
            const inputNodeId = `input-${randomUUID().split('-')[0]}`;
            
            // Avoid duplicate nodes
            if (!nodeMap.has(entity.input)) {
                nodes.push({
                    id: inputNodeId,
                    label: entity.input,
                    type: 'input',
                    color: '#3498db'
                });
                nodeMap.set(entity.input, true);
            }
            
            // Add each identifier as a node and connect to input
            entity.identifiers.forEach(id => {
                const idNodeId = id.identifier;
                const mainType = id.type[0] || 'unknown';
                
                // Color based on entity type
                let color = '#95a5a6'; // default gray
                if (mainType.includes('gene')) color = '#27ae60';
                else if (mainType.includes('disease')) color = '#e74c3c';
                else if (mainType.includes('chemical') || mainType.includes('drug')) color = '#f39c12';
                
                // Avoid duplicate nodes
                if (!nodeMap.has(idNodeId)) {
                    nodes.push({
                        id: idNodeId,
                        label: id.name,
                        type: mainType,
                        color: color,
                        curie: id.identifier
                    });
                    nodeMap.set(idNodeId, true);
                }
                
                // Add edge
                edges.push({
                    source: inputNodeId,
                    target: idNodeId,
                    type: 'identifies_as'
                });
            });
        }
    });
    
    return {
        nodes: nodes,
        edges: edges
    };
}

// Group entity identifications by type
export function groupByType(entities: EntityIdentification[]): Record<string, Entity[]> {
    const groupedEntities: Record<string, Entity[]> = {};
    
    entities.forEach(entity => {
        if (entity.identifiers && entity.identifiers.length > 0) {
            entity.identifiers.forEach(id => {
                id.type.forEach(type => {
                    if (!groupedEntities[type]) {
                        groupedEntities[type] = [];
                    }
                    groupedEntities[type].push({
                        ...id, 
                        // Add the original input term to each identifier
                        originalInput: entity.input
                    } as any);
                });
            });
        }
    });
    
    return groupedEntities;
} 