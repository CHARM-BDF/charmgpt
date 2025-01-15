import { Tool } from '../types/mcp';

export const webSearchTool: Tool = {
  name: 'web-search',
  description: 'Search the web for information',
  execute: async (query: string) => {
    // Implement actual web search here
    return `Search results for: ${query}`;
  }
};
