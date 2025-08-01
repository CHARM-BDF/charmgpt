#!/bin/bash

# Script to run the response formatter adapter tests

echo "Running response formatter adapter tests..."
npx tsx test-formatters.js

# Check exit code
if [ $? -eq 0 ]; then
  echo -e "\n🎉 All tests passed!"
else
  echo -e "\n❌ Some tests failed. Please check the output above."
fi 