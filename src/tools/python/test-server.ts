import express from 'express';
import { execute } from './execute';

const app = express();
app.use(express.json());

app.post('/execute', async (req, res) => {
  try {
    const { code, dataFiles, timeout } = req.body;
    const result = await execute({ code, dataFiles, timeout });
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.TEST_SERVER_PORT || 3001;

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /execute - Execute Python code');
  console.log('  GET /health - Health check');
}); 