export interface NodeTemplate {
  color: string;
  stroke?: string;
  strokeWidth?: number;
}

export const defaultNodeTemplates: Record<string, NodeTemplate> = {
  'Gene': { color: '#4285F4' },           // Google Blue
  'Gene Group': { color: '#34A853' },     // Google Green
  'Chemical': { color: '#FBBC05' },       // Google Yellow
  'Disease': { color: '#EA4335' },        // Google Red
  'Disease or Phenotype': { color: '#EA4335' },  // Same as Disease
  'Cellular Component': { color: '#8E24AA' }, // Purple
  'Anatomical Structure': { color: '#00ACC1' }, // Cyan
  'Drug': { color: '#FB8C00' },           // Orange
  'UMLS Concept': { color: '#9E9E9E' },   // Gray
  'Cancer Concept': { color: '#D81B60' }, // Pink
  'Reaction': { color: '#43A047' },       // Green
  'Other': { color: '#757575' }           // Dark Gray
};

export const startingNodeTemplate: Partial<NodeTemplate> = {
  stroke: '#000000',
  strokeWidth: 3
}; 