# Python Testing Documentation

## Overview
This document details the testing infrastructure for the Python execution environment in our MCP server. The testing setup includes both automated test suites and a manual testing server.

## Test Infrastructure

### 1. Test Files
- `test-suite.ts`: Automated test runner with predefined test cases
- `test-server.ts`: Express server for manual testing via HTTP endpoints

### 2. Environment Setup
```bash
# Virtual Environment
python3 -m venv venv
source venv/bin/activate

# Dependencies
npm install              # Node.js dependencies
pip install -r requirements.txt  # Python packages
```

### 3. Running Tests
```bash
# Run automated test suite
npm run test:python

# Start test server
npm run test:server
```

## Test Results (Initial Run)

### Successful Tests (5/9 passed)

1. **Security Block Tests**
   - `Security block - os module`: ✅ PASSED
   - `Security block - eval`: ✅ PASSED
   - Why successful: Security validation correctly blocks dangerous operations
   - Implementation: `validatePythonCode()` function effectively catches forbidden patterns

2. **Basic Operations**
   - `Pandas operations`: ✅ PASSED
   - `Complex calculation`: ✅ PASSED
   - Why successful: Core Python execution pipeline works for standard operations
   - Implementation: PythonShell correctly handles code execution and output capture

3. **Resource Management**
   - `Timeout test`: ✅ PASSED
   - Why successful: Timeout mechanism effectively stops long-running processes
   - Implementation: PythonShell's timeout setting works as expected

### Failed Tests (4/9 failed)

1. **Basic Output Tests**
   - `Basic arithmetic`: ❌ FAILED
   - `NumPy operations`: ❌ FAILED
   - Issue: Output not being captured correctly
   - Expected behavior: Should return printed output
   - Possible cause: Code being written to file but not executed properly

2. **File Operations**
   - `Matplotlib plotting`: ❌ FAILED
   - Issue: File output not being handled correctly
   - Expected behavior: Should save plot and confirm
   - Possible cause: File path or permission issues

3. **Resource Limits**
   - `Memory limit test`: ❌ FAILED
   - Issue: Memory limits not being enforced
   - Expected behavior: Should error on large array creation
   - Possible cause: Resource limits not properly configured

## Test Categories and Coverage

### 1. Security Testing
- Import restrictions
- Code execution boundaries
- System access prevention
- Current coverage: Strong (100% pass rate)

### 2. Functionality Testing
- Basic Python operations
- Package imports and usage
- Data manipulation
- Current coverage: Partial (50% pass rate)

### 3. Resource Management
- Memory limits
- Execution timeouts
- Process isolation
- Current coverage: Mixed (50% pass rate)

## Manual Testing Server

### Endpoints
```
POST /execute
- Execute Python code
- Body: { code: string, dataFiles?: object, timeout?: number }

GET /health
- Server health check
- Response: { status: "healthy" }
```

### Example Usage
```bash
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{"code": "print(2 + 2)"}'
```

## Test Implementation Details

### 1. Test Case Structure
```typescript
interface TestCase {
  name: string;
  code: string;
  expectedOutput?: string;
  expectError?: boolean;
  dataFiles?: Record<string, string>;
  timeout?: number;
}
```

### 2. Test Execution Flow
1. Environment setup
2. Code validation
3. Execution in isolated environment
4. Output capture
5. Resource cleanup

### 3. Error Handling
- Security violations caught pre-execution
- Runtime errors captured during execution
- Resource limits enforced by PythonShell
- Cleanup procedures run even on failure

## Future Improvements

### 1. Output Handling
- Implement proper output buffering
- Add support for stderr capture
- Improve multiline output handling

### 2. Resource Management
- Implement proper memory limits
- Add CPU usage monitoring
- Improve file system isolation

### 3. Test Coverage
- Add more edge cases
- Test concurrent executions
- Add long-running operation tests

## Troubleshooting Guide

### Common Issues
1. **No Output**
   - Check Python path in virtual environment
   - Verify output capture in PythonShell options
   - Ensure code is actually being executed

2. **Security Blocks**
   - Review allowed packages list
   - Check dangerous patterns configuration
   - Verify environment isolation

3. **Resource Limits**
   - Check PythonShell configuration
   - Verify system resource availability
   - Review limit settings in env.ts

## Maintenance Notes

### Regular Checks
1. Run test suite after dependency updates
2. Verify security blocks still function
3. Check resource limit effectiveness
4. Update test cases for new features

### Version Information
- Node.js: v22.13.0
- Python: 3.11+
- Key packages:
  - python-shell: ^5.0.0
  - numpy: >=1.24.0
  - pandas: >=2.0.0 