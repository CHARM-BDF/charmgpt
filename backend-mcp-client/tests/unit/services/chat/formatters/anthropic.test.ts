/**
 * Tests for Anthropic Response Formatter Adapter
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { AnthropicResponseFormatterAdapter } from '@/services/chat/formatters/anthropic';
import { FormatterOutput } from '@/services/chat/formatters/types.js';

describe('AnthropicResponseFormatterAdapter', () => {
  let adapter: AnthropicResponseFormatterAdapter;
  
  beforeEach(() => {
    adapter = new AnthropicResponseFormatterAdapter();
  });
  
  describe('getResponseFormatterToolDefinition', () => {
    test('should return a valid Anthropic tool definition', () => {
      const definition = adapter.getResponseFormatterToolDefinition();
      
      // Check structure
      expect(definition).toHaveProperty('name', 'response_formatter');
      expect(definition).toHaveProperty('description');
      expect(definition).toHaveProperty('input_schema');
      
      // Check schema
      const schema = definition.input_schema;
      expect(schema).toHaveProperty('properties.thinking');
      expect(schema).toHaveProperty('properties.conversation');
      expect(schema.properties.conversation).toHaveProperty('type', 'array');
    });
  });
  
  describe('extractFormatterOutput', () => {
    test('should extract formatter output from Anthropic response', () => {
      // Mock Anthropic response wtesth tool_use
      const mockResponse = {
        content: [
          { 
            type: 'text', 
            text: 'Processing your request' 
          },
          {
            type: 'tool_use',
            name: 'response_formatter',
            id: 'tool_123',
            input: {
              thinking: 'Test thinking',
              conversation: [
                { type: 'text' as const, content: 'Test content' }
              ]
            }
          }
        ]
      };
      
      const output = adapter.extractFormatterOutput(mockResponse);
      
      // Check extracted output
      expect(output).toHaveProperty('thinking', 'Test thinking');
      expect(output).toHaveProperty('conversation');
      expect(output.conversation).toBeInstanceOf(Array);
      expect(output.conversation[0]).toHaveProperty('type', 'text');
      expect(output.conversation[0]).toHaveProperty('content', 'Test content');
    });
    
    test('should throw error if no content in response', () => {
      // Mock empty response
      const mockResponse = {
        content: []
      };
      
      expect(() => adapter.extractFormatterOutput(mockResponse))
        .toThrow('Empty response from Anthropic');
    });
    
    test('should throw error if no tool_use block', () => {
      // Mock response wtesth no tool_use
      const mockResponse = {
        content: [
          { type: 'text', text: 'Just text response' }
        ]
      };
      
      expect(() => adapter.extractFormatterOutput(mockResponse))
        .toThrow('Expected response_formatter tool use in Anthropic response');
    });
    
    test('should throw error if wrong tool was used', () => {
      // Mock response wtesth wrong tool
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            name: 'wrong_tool',
            id: 'tool_123',
            input: {}
          }
        ]
      };
      
      expect(() => adapter.extractFormatterOutput(mockResponse))
        .toThrow('Expected response_formatter tool use in Anthropic response');
    });
  });
  
  describe('convertToStoreFormat', () => {
    test('should convert formatter output to store format', () => {
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
      expect(storeFormat.artifacts?.[0]).toHaveProperty('ttestle', 'Test artifact');
      expect(storeFormat.artifacts?.[0]).toHaveProperty('content', '# Test content');
    });
    
    test('should handle missing artifacts', () => {
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