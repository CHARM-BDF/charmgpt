const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Read the example files
const rfa = fs.readFileSync(path.join(__dirname, '../examples/RFA.md'), 'utf8');
const aims = fs.readFileSync(path.join(__dirname, '../examples/specificaims.md'), 'utf8');

// Server configuration
const SERVER_URL = 'http://localhost:3000';

async function testReview() {
  try {
    console.log('Starting review test...');
    
    // First check if server is running
    const health = await axios.get(`${SERVER_URL}/health`);
    console.log('Server health check:', health.data);

    // Make the review request
    const response = await axios.post(`${SERVER_URL}/tools/review_specific_aims`, {
      aims_text: aims,
      rfa_text: rfa
    });

    // Extract the review content from the response
    const review = response.data.artifacts[0].content;

    // Save the review to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(__dirname, '../examples', `review-${timestamp}.md`);
    fs.writeFileSync(outputPath, review);

    console.log(`Review saved to: ${outputPath}`);
    console.log('Test completed successfully!');

  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testReview(); 