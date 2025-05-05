# Debug Components

This directory contains components meant for debugging and testing purposes.

## ModelTester

The `ModelTester` component helps verify that the correct LLM provider (Claude, ChatGPT, Gemini, or Ollama) is being used when switching models in the UI.

### How to Use

1. Temporarily import the ModelTester in your ChatInterface.tsx file:

```tsx
import { ModelTester } from '../debug/ModelTester';
```

2. Add it to your render method right after the main header component:

```tsx
{/* Main Header */}
<div className="bg-white/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm">
  {/* ... existing header code ... */}
</div>

{/* Add ModelTester for debugging */}
<div className="max-w-screen-2xl mx-auto px-4 py-3">
  <ModelTester />
</div>

{/* Main Content */}
<div className="flex flex-1 overflow-hidden">
  {/* ... existing content code ... */}
</div>
```

3. Use the testing buttons to send specific prompts that help identify which model is responding.

4. Remove the ModelTester component when you're done testing.

### Example Usage

1. Select a model using the ModelSelector in the UI
2. Click one of the test buttons (e.g., "Test: identifyYourself")
3. Observe the response to confirm it's from the expected model
4. Check the browser console for additional details

### How It Works

The ModelTester sends direct requests to the `/api/chat-artifacts` endpoint, bypassing the normal chat flow but still using the selected model from the ModelStore. This allows for quick verification tests without affecting your ongoing conversations.

The test prompts are designed to elicit responses that help identify specific models based on their unique characteristics, knowledge cutoffs, and policy limitations. 