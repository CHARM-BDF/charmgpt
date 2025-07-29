/**
 * Tests for Gemini Response Formatter Adapter
 */

import { jest } from '@jest/globals';
import { GeminiResponseFormatterAdapter } from '../gemini.js';
import { FormatterOutput } from '../types.js';

describe('GeminiResponseFormatterAdapter', () => {
  let adapter: GeminiResponseFormatterAdapter;
  
  beforeEach(() => {
    adapter = new GeminiResponseFormatterAdapter();
  });
  
  describe('getResponseFormatterToolDefinition', () => {
    it('should return a valid Gemini tool definition', () => {
      const definition = adapter.getResponseFormatterToolDefinition();
      
      // Check structure
      expect(definition).toHaveProperty('functionDeclarations');
      expect(definition.functionDeclarations).toBeInstanceOf(Array);
      expect(definition.functionDeclarations[0]).toHaveProperty('name', 'response_formatter');
      expect(definition.functionDeclarations[0]).toHaveProperty('parameters');
      
      // Check parameters schema
      const parameters = definition.functionDeclarations[0].parameters;
      expect(parameters).toHaveProperty('properties.thinking');
      expect(parameters).toHaveProperty('properties.conversation');
      expect(parameters.properties.conversation).toHaveProperty('type', 'array');
    });
  });
  
  describe('extractFormatterOutput', () => {
    it('should extract formatter output from Gemini response', () => {
      // Mock Gemini response with function calls
      const functionCallsMethod = jest.fn().mockReturnValue([
        {
          name: 'response_formatter',
          args: {
            thinking: 'Test thinking',
            conversation: [
              { type: 'text' as const, content: 'Test content' }
            ]
          }
        }
      ]);
      
      const mockResponse = {
        functionCalls: functionCallsMethod
      };
      
      const output = adapter.extractFormatterOutput(mockResponse);
      
      // Check extracted output
      expect(output).toHaveProperty('thinking', 'Test thinking');
      expect(output).toHaveProperty('conversation');
      expect(output.conversation).toBeInstanceOf(Array);
      expect(output.conversation[0]).toHaveProperty('type', 'text');
      expect(output.conversation[0]).toHaveProperty('content', 'Test content');
      expect(functionCallsMethod).toHaveBeenCalled();
    });
    
    it('should throw error if functionCalls() returns empty array', () => {
      // Mock response with empty function calls
      const mockResponse = {
        functionCalls: jest.fn().mockReturnValue([])
      };
      
      expect(() => adapter.extractFormatterOutput(mockResponse))
        .toThrow('No function calls found in Gemini response');
    });
    
    it('should throw error if functionCalls() returns undefined', () => {
      // Mock response with undefined function calls
      const mockResponse = {
        functionCalls: jest.fn().mockReturnValue(undefined)
      };
      
      expect(() => adapter.extractFormatterOutput(mockResponse))
        .toThrow('No function calls found in Gemini response');
    });
    
    it('should throw error if wrong function was called', () => {
      // Mock response with wrong function
      const mockResponse = {
        functionCalls: jest.fn().mockReturnValue([
          {
            name: 'wrong_function',
            args: {}
          }
        ])
      };
      
      expect(() => adapter.extractFormatterOutput(mockResponse))
        .toThrow('Expected response_formatter function call in Gemini response');
    });
  });
  
  describe('convertToStoreFormat', () => {
    it('should convert formatter output to store format', () => {
      // Mock formatter output
      const formatterOutput: FormatterOutput = {
        thinking: 'Test thinking',
        conversation: [
          { type: 'text' as const, content: 'Text content' },
          { 
            type: 'artifact' as const, 
            artifact: {
              type: 'text/markdown',
              title: 'Test artifact',
              content: '# Test content'
            }
          }
        ]
      };
      
      const storeFormat = adapter.convertToStoreFormat(formatterOutput);
      
      // Check store format
      expect(storeFormat).toHaveProperty('thinking', 'Test thinking');
      expect(storeFormat).toHaveProperty('conversation');
      expect(storeFormat.conversation).toContain('Text content');
      expect(storeFormat).toHaveProperty('artifacts');
      expect(storeFormat.artifacts).toBeInstanceOf(Array);
      expect(storeFormat.artifacts?.[0]).toHaveProperty('type', 'text/markdown');
      expect(storeFormat.artifacts?.[0]).toHaveProperty('title', 'Test artifact');
      expect(storeFormat.artifacts?.[0]).toHaveProperty('content', '# Test content');
    });
    
    it('should handle missing artifacts', () => {
      // Mock formatter output with no artifacts
      const formatterOutput: FormatterOutput = {
        thinking: 'Test thinking',
        conversation: [
          { type: 'text' as const, content: 'Text content only' }
        ]
      };
      
      const storeFormat = adapter.convertToStoreFormat(formatterOutput);
      
      // Check store format
      expect(storeFormat).toHaveProperty('thinking', 'Test thinking');
      expect(storeFormat).toHaveProperty('conversation', 'Text content only');
      expect(storeFormat).not.toHaveProperty('artifacts');
    });
  });
}); 