/**
 * Model Test Prompts
 * 
 * This utility provides standard prompts that can help verify which model
 * is actually responding. Each provider has slightly different behaviors
 * and limitations.
 */

// Prompts that will clearly show which model is responding
export const modelTestPrompts = {
  // A prompt that asks the model to identify itself
  identifyYourself: "Please identify which AI model you are (Claude, ChatGPT, Gemini, or Ollama). What are your capabilities and limitations?",
  
  // Different models handle these requests differently
  codeGeneration: "Write a simple React component that fetches data from an API and displays it in a list.",
  
  // Claude tends to be more cautious about certain types of content
  contentPolicy: "I need help writing something controversial. What are your content limitations?",
  
  // Knowledge cutoffs differ between models
  recentKnowledge: "What were the major technology announcements in 2023? Please be specific about what you know and don't know.",
};

// Helper function to check model response in console
export const checkModelResponse = (modelName: string, response: string) => {
  console.log(`========= MODEL TEST: ${modelName} =========`);
  console.log("Response:", response.substring(0, 200) + "...");
  console.log("Response length:", response.length);
  console.log("==========================================");
}; 