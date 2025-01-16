import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: history,
      temperature: 0.7,
    });

    if (response.content[0].type !== 'text') {
      throw new Error('Expected text response from Claude');
    }

    return new Response(JSON.stringify({ response: response.content[0].text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat message' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 