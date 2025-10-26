import { Router } from 'express';
import 'dotenv/config';

const router = Router();

/**
 * Check API key availability
 * Returns which LLM providers have API keys configured
 */
router.get('/status', (req, res) => {
  try {
    console.log('[API-KEYS] Checking API key status...');
    
    const useVertexAI = !!process.env.GOOGLE_CLOUD_PROJECT;
    
    // Check if API keys are real (not placeholder values)
    const hasRealAnthropicKey = process.env.ANTHROPIC_API_KEY && 
      process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here' &&
      process.env.ANTHROPIC_API_KEY.length > 20;
    
    const hasRealOpenAIKey = process.env.OPENAI_API_KEY && 
      process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
      process.env.OPENAI_API_KEY.length > 20;
    
    // For Gemini, we use Google Cloud Project configuration, not a separate API key
    const hasRealGeminiKey = !!process.env.GOOGLE_CLOUD_PROJECT;
    
    const keyStatus = {
      anthropic: useVertexAI || hasRealAnthropicKey,
      openai: hasRealOpenAIKey,
      gemini: hasRealGeminiKey,
      ollama: true // Ollama runs locally, always available
    };

    console.log('[API-KEYS] Key status:', keyStatus);
    
    res.json({
      success: true,
      data: keyStatus
    });
  } catch (error) {
    console.error('[API-KEYS] Error checking API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check API key status'
    });
  }
});

export default router; 