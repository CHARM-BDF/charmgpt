/**
 * Tests for OpenAI Response Formatter Adapter
 */

import { OpenAIResponseFormatterAdapter } from '../openai';

describe('OpenAIResponseFormatterAdapter', () => {
  let adapter: OpenAIResponseFormatterAdapter;
  
  beforeEach(() => {
    adapter = new OpenAIResponseFormatterAdapter();
  });
  
  describe('getResponseFormatterToolDefinition', () => {
    it('should return a valid OpenAI tool definition', () => {
      const definition = adapter.getResponseFormatterToolDefinition();
      
      // Check structure
      expect(definition).toHaveProperty('type', 'function');
      expect(definition.function).toHaveProperty('name', 'response_formatter');
      expect(definition.function).toHaveProperty('parameters');
      
      // Check parameters schema
      const parameters = definition.function.parameters;
      expect(parameters).toHaveProperty('properties.thinking');
      expect(parameters).toHaveProperty('properties.conversation');
      expect(parameters.properties.conversation).toHaveProperty('type', 'array');
    });
  });
  
  describe('extractFormatterOutput', () => {
    it('should extract formatter output from OpenAI response', () => {
      // Mock OpenAI response with tool call
      const mockResponse = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'response_formatter',
                arguments: JSON.stringify({
                  thinking: 'Test thinking',
                  conversation: [
                    { type: 'text', content: 'Test content' }
                  ]
                })
              }
            }]
          }
        }]
      };
      
      const output = adapter.extractFormatterOutput(mockResponse);
      
      // Check extracted output
      expect(output).toHaveProperty('thinking', 'Test thinking');
      expect(output).toHaveProperty('conversation');
      expect(output.conversation).toBeInstanceOf(Array);
      expect(output.conversation[0]).toHaveProperty('type', 'text');
      expect(output.conversation[0]).toHaveProperty('content', 'Test content');
    });
    
    it('should throw error if no tool calls in response', () => {
      // Mock response without tool calls
      const mockResponse = {
        choices: [{
          message: {}
        }]
      };
      
      expect(() => adapter.extractFormatterOutput(mockResponse))
        .toThrow('Expected response_formatter tool call from OpenAI');
    });
    
    it('should throw error if wrong tool was called', () => {
      // Mock response with wrong tool
      const mockResponse = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'wrong_tool',
                arguments: '{}'
              }
            }]
          }
        }]
      };
      
      expect(() => adapter.extractFormatterOutput(mockResponse))
        .toThrow('Expected response_formatter tool');
    });
  });
  
  describe('convertToStoreFormat', () => {
    it('should convert formatter output to store format', () => {
      // Mock formatter output
      const formatterOutput = {
        thinking: 'Test thinking',
        conversation: [
          { type: 'text', content: 'Text content' },
          { 
            type: 'artifact', 
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
      const formatterOutput = {
        thinking: 'Test thinking',
        conversation: [
          { type: 'text', content: 'Text content only' }
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