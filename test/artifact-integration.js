/**
 * MCP Artifact Integration Test Script
 * 
 * This script tests the integration of different artifact types with the
 * unified enhancement system. It creates mock responses for each artifact type
 * and verifies that they are processed correctly by the system.
 */

import { MessageService } from '../src/server/services/message.js';
import { ArtifactService } from '../src/server/services/artifact.js';
import { createRequire } from 'module';
import crypto from 'crypto';

// For UUIDs in Node.js
const require = createRequire(import.meta.url);
const { v4: uuidv4 } = require('uuid');

// Initialize services
const messageService = new MessageService();
const artifactService = new ArtifactService();

// Log separator function
function logSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`TEST: ${title}`);
  console.log('='.repeat(80));
}

// Helper function to test artifact processing and display basic results
function testArtifactProcessing(storeResponse, artifacts) {
  // Run the enhancement function
  const enhancedResponse = messageService.enhanceResponseWithArtifacts(storeResponse, artifacts);
  
  // Log results
  console.log(`Original artifact count: ${storeResponse.artifacts?.length || 0}`);
  console.log(`Enhanced artifact count: ${enhancedResponse.artifacts?.length || 0}`);
  console.log(`Added ${(enhancedResponse.artifacts?.length || 0) - (storeResponse.artifacts?.length || 0)} new artifacts`);
  
  if (enhancedResponse.artifacts?.length > 0) {
    console.log('\nArtifact types in enhanced response:');
    enhancedResponse.artifacts.forEach((artifact, index) => {
      console.log(`${index + 1}. ${artifact.type} (${artifact.title})`);
    });
  }
  
  // Verify conversation has artifact buttons
  const conversationHasButtons = enhancedResponse.conversation.includes('artifact-button');
  console.log(`\nConversation includes artifact buttons: ${conversationHasButtons ? 'YES' : 'NO'}`);
  
  return enhancedResponse;
}

// Test 1: Bibliography artifact
function testBibliographyArtifact() {
  logSection('Bibliography Artifact');
  
  const storeResponse = {
    thinking: 'Internal reasoning process',
    conversation: 'Here are some articles about the topic.',
    artifacts: []
  };
  
  const bibliographyArtifacts = [{
    type: 'application/vnd.bibliography',
    title: 'PubMed Articles',
    content: [
      {
        authors: ['Smith J', 'Davis A'],
        year: '2022',
        title: 'Example research paper',
        journal: 'Journal of Examples',
        pmid: '12345678'
      },
      {
        authors: ['Johnson B', 'Williams C'],
        year: '2021',
        title: 'Another research paper',
        journal: 'Research Monthly',
        pmid: '87654321'
      }
    ]
  }];
  
  console.log('Testing bibliography artifact with enhanceResponseWithArtifacts...');
  const newResponse = testArtifactProcessing(storeResponse, bibliographyArtifacts);
  
  // Verify content was properly stringified for storage
  const firstArtifact = newResponse.artifacts[0];
  const parsedContent = JSON.parse(firstArtifact.content);
  console.log(`\nParsed content has ${parsedContent.length} bibliography entries`);
  console.log('First entry:', JSON.stringify(parsedContent[0], null, 2));
  
  return newResponse;
}

// Test 2: Knowledge Graph artifact
function testKnowledgeGraphArtifact() {
  logSection('Knowledge Graph Artifact');
  
  const storeResponse = {
    thinking: 'Internal reasoning process',
    conversation: 'Here is a knowledge graph showing relationships.',
    artifacts: []
  };
  
  const knowledgeGraphArtifacts = [{
    type: 'application/vnd.knowledge-graph',
    title: 'Gene Interactions',
    content: {
      nodes: [
        { id: 'node1', name: 'Gene A', group: 1 },
        { id: 'node2', name: 'Gene B', group: 2 },
        { id: 'node3', name: 'Disease X', group: 3 }
      ],
      links: [
        { source: 'node1', target: 'node2', label: 'interacts with' },
        { source: 'node2', target: 'node3', label: 'associated with' }
      ]
    }
  }];
  
  console.log('Testing knowledge graph artifact with enhanceResponseWithArtifacts...');
  const newResponse = testArtifactProcessing(storeResponse, knowledgeGraphArtifacts);
  
  // Verify content was properly stringified for storage
  const firstArtifact = newResponse.artifacts[0];
  const parsedContent = JSON.parse(firstArtifact.content);
  console.log(`\nParsed content has ${parsedContent.nodes.length} nodes and ${parsedContent.links.length} links`);
  console.log('First node:', JSON.stringify(parsedContent.nodes[0], null, 2));
  console.log('First link:', JSON.stringify(parsedContent.links[0], null, 2));
  
  return newResponse;
}

// Test 3: Markdown artifact
function testMarkdownArtifact() {
  logSection('Markdown Artifact');
  
  const storeResponse = {
    thinking: 'Internal reasoning process',
    conversation: 'Here is a markdown document.',
    artifacts: []
  };
  
  const markdownArtifacts = [{
    type: 'text/markdown',
    title: 'Research Summary',
    content: `# Research Summary
    
## Introduction
This is a markdown document that summarizes research findings.

## Methods
- Literature review
- Data analysis
- Expert interviews

## Results
1. Finding one
2. Finding two
3. Finding three`,
    language: 'markdown'
  }];
  
  console.log('Testing markdown artifact with enhanceResponseWithArtifacts...');
  const newResponse = testArtifactProcessing(storeResponse, markdownArtifacts);
  
  // Verify content
  const firstArtifact = newResponse.artifacts[0];
  console.log(`\nMarkdown content length: ${firstArtifact.content.length} characters`);
  console.log('First 100 characters:', firstArtifact.content.substring(0, 100));
  
  return newResponse;
}

// Test 4: Code artifact
function testCodeArtifact() {
  logSection('Code Artifact');
  
  const storeResponse = {
    thinking: 'Internal reasoning process',
    conversation: 'Here is some example code.',
    artifacts: []
  };
  
  const codeArtifacts = [{
    type: 'application/vnd.ant.python',
    title: 'Example Python Script',
    content: `def analyze_data(data):
    """
    Analyze the provided data and return results.
    
    Parameters:
    data (list): Input data to analyze
    
    Returns:
    dict: Analysis results
    """
    results = {
        'count': len(data),
        'mean': sum(data) / len(data) if data else 0,
        'max': max(data) if data else None,
        'min': min(data) if data else None
    }
    return results`,
    language: 'python'
  }];
  
  console.log('Testing code artifact with enhanceResponseWithArtifacts...');
  const newResponse = testArtifactProcessing(storeResponse, codeArtifacts);
  
  // Verify content
  const firstArtifact = newResponse.artifacts[0];
  console.log(`\nCode content length: ${firstArtifact.content.length} characters`);
  console.log('Language:', firstArtifact.language);
  console.log('First 100 characters:', firstArtifact.content.substring(0, 100));
  
  return newResponse;
}

// Test 5: Binary output (image)
function testBinaryOutput() {
  logSection('Binary Output (Image)');
  
  const storeResponse = {
    thinking: 'Internal reasoning process',
    conversation: 'Here is a generated image.',
    artifacts: []
  };
  
  // Mock base64 encoded image
  const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  
  // Create binary output
  const binaryOutput = {
    type: 'image/png',
    data: mockBase64,
    metadata: {
      size: 100,
      sourceCode: 'import matplotlib.pyplot as plt\nplt.plot([1, 2, 3, 4])\nplt.savefig("chart.png")'
    }
  };
  
  console.log('Testing binary output processing...');
  const processedArtifacts = artifactService.processBinaryOutput(binaryOutput, 0);
  console.log(`\nProcessed ${processedArtifacts.length} artifacts from binary output`);
  
  processedArtifacts.forEach((artifact, i) => {
    console.log(`\nArtifact ${i+1}:`);
    console.log(`- Type: ${artifact.type}`);
    console.log(`- Title: ${artifact.title}`);
    console.log(`- Position: ${artifact.position}`);
    console.log(`- Has source code: ${artifact.type === 'application/vnd.ant.python'}`);
  });
  
  // Now test with the enhance function
  const newResponse = testArtifactProcessing(storeResponse, processedArtifacts);
  
  return newResponse;
}

// Test 6: Backward compatibility with legacy formats
function testBackwardCompatibility() {
  logSection('Backward Compatibility');
  
  // Legacy bibliography property
  const bibliographyResponse = {
    thinking: 'Internal reasoning process',
    conversation: 'Testing legacy bibliography format.',
    bibliography: [
      {
        authors: ['Legacy A', 'Legacy B'],
        year: '2020',
        title: 'Legacy paper',
        journal: 'Legacy Journal',
        pmid: '11111111'
      }
    ]
  };
  
  // Legacy knowledge graph property
  const knowledgeGraphResponse = {
    thinking: 'Internal reasoning process',
    conversation: 'Testing legacy knowledge graph format.',
    knowledgeGraph: {
      nodes: [{ id: 'legacyNode1', name: 'Legacy Node', group: 1 }],
      links: [{ source: 'legacyNode1', target: 'legacyNode1', label: 'self-reference' }]
    }
  };
  
  // Legacy grant markdown property
  const grantMarkdownResponse = {
    thinking: 'Internal reasoning process',
    conversation: 'Testing legacy grant markdown format.',
    grantMarkdown: {
      title: 'Legacy Grant',
      content: '# Legacy Grant Proposal\n\nThis is a test.',
      metadata: { grantId: 'G12345' }
    }
  };
  
  // Test bibliography compatibility
  console.log('Testing backward compatibility for bibliography...');
  const enhancedBibliography = messageService.formatResponseWithBibliography(
    { conversation: 'Testing bibliography', artifacts: [] },
    bibliographyResponse.bibliography
  );
  console.log(`Bibliography enhanced with ${enhancedBibliography.artifacts?.length || 0} artifacts`);
  
  // Test knowledge graph compatibility
  console.log('\nTesting backward compatibility for knowledge graph...');
  const enhancedKnowledgeGraph = messageService.formatResponseWithKnowledgeGraph(
    { conversation: 'Testing knowledge graph', artifacts: [] },
    knowledgeGraphResponse.knowledgeGraph,
    'Legacy Knowledge Graph'
  );
  console.log(`Knowledge graph enhanced with ${enhancedKnowledgeGraph.artifacts?.length || 0} artifacts`);
  
  // Test grant markdown compatibility
  console.log('\nTesting backward compatibility for grant markdown...');
  const enhancedMarkdown = messageService.formatResponseWithMarkdown(
    { conversation: 'Testing grant markdown', artifacts: [] },
    grantMarkdownResponse.grantMarkdown
  );
  console.log(`Grant markdown enhanced with ${enhancedMarkdown.artifacts?.length || 0} artifacts`);
  
  return {
    bibliography: enhancedBibliography,
    knowledgeGraph: enhancedKnowledgeGraph,
    grantMarkdown: enhancedMarkdown
  };
}

// Run all tests
function runAllTests() {
  logSection('STARTING ALL TESTS');
  
  const results = {
    bibliography: testBibliographyArtifact(),
    knowledgeGraph: testKnowledgeGraphArtifact(),
    markdown: testMarkdownArtifact(),
    code: testCodeArtifact(),
    binaryOutput: testBinaryOutput(),
    backwardCompatibility: testBackwardCompatibility()
  };
  
  logSection('ALL TESTS COMPLETED');
  
  // Summary
  console.log('TEST SUMMARY:');
  Object.keys(results).forEach(testName => {
    console.log(`- ${testName}: ✅ Completed`);
  });
  
  console.log('\nNext steps:');
  console.log('1. Refactor chat.ts to exclusively use the unified approach');
  console.log('2. Remove the old enhancement functions after complete validation');
  console.log('3. Update all type imports to use the standardized interfaces');
}

// Run the test script
runAllTests(); 