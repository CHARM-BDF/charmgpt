import React, { useState } from 'react';
import { useModelStore } from '../../store/modelStore';
import { modelTestPrompts } from '../../utils/modelTestPrompts';

/**
 * Debug component for testing if the correct model is being used
 * Add this temporarily to your UI to run quick tests
 */
export const ModelTester: React.FC = () => {
  const { selectedModel } = useModelStore();
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testModel = async (prompt: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/chat-artifacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: prompt,
          history: [],
          modelProvider: selectedModel
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Process the streaming response
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete JSON objects
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            if (data.type === 'content') {
              fullResponse += data.content;
            }
          } catch (e) {
            console.error('Error parsing response:', e);
          }
        }
      }

      setResult(fullResponse);
      console.log(`MODEL TEST (${selectedModel}):`, fullResponse);
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">Model Tester (Debug Tool)</h2>
      <div className="text-sm mb-2">Current Model: <span className="font-bold">{selectedModel}</span></div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(modelTestPrompts).map(([key, prompt]) => (
          <button
            key={key}
            onClick={() => testModel(prompt)}
            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 rounded text-sm transition-colors"
            disabled={loading}
          >
            Test: {key}
          </button>
        ))}
      </div>
      
      {loading && <div className="text-sm text-gray-500 animate-pulse mb-2">Testing model response...</div>}
      
      {result && (
        <div className="mt-2">
          <h3 className="font-medium mb-1">Response:</h3>
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm max-h-40 overflow-y-auto">
            {result}
          </div>
        </div>
      )}
    </div>
  );
}; 