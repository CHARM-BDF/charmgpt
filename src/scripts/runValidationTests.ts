import { runValidationTests } from '../server/testRunner';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Run the tests
console.log('Starting XML validation tests...');
runValidationTests()
    .then(() => {
        console.log('Tests completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error running tests:', error);
        process.exit(1);
    }); 