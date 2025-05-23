import { Router } from 'express';
import 'dotenv/config';

const router = Router();

/**
 * Check API key availability
 * Returns which LLM providers have API keys configured
 */
router.get('/status', (req, res) => {
  try {
    const keyStatus = {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      ollama: true // Ollama runs locally, always available
    };

    res.json({
      success: true,
      data: keyStatus
    });
  } catch (error) {
    console.error('Error checking API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check API key status'
    });
  }
});

export default router; 