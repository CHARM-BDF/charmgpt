# Plan: Debug Claude Tools Formatting Issue

## Current Understanding
- Error: "tools.0.custom.input_schema: Field required"
- AnthropicToolAdapter correctly formats tools with custom.input_schema
- Two adapter implementations exist:
  1. src/server/services/chat/adapters/anthropic.ts
  2. src/server/services/llm/adapters/claude.ts
- Index.ts was updated to use chat adapter instead of LLM adapter
- Tools appear correctly formatted in adapter but issue persists

## Investigation Steps

### 1. Verify Current Adapter Usage
- Confirm index.ts is using the correct adapter
- Check for any other potential imports of the LLM adapter
- Add logging to verify which adapter is being instantiated

### 2. Add Pipeline Logging
- Add detailed logging points throughout the request pipeline:
  - Before leaving the adapter
  - At any middleware/transformation points
  - Just before API call
- Log the complete tool structure at each point

### 3. Compare Request Formats
- Capture a successful request format from Claude documentation
- Compare with our current request format at each pipeline stage
- Identify any discrepancies

### 4. Check Transformation Logic
- Review any middleware or transformation logic that touches the request
- Look for unintended modifications to the tools structure
- Verify schema validation steps

### 5. Test Direct API Call
- Create a test that bypasses middleware
- Make direct call to Claude API with known good format
- Compare results with full pipeline call

## Next Steps
1. Begin with Step 1 to verify adapter usage
2. Add comprehensive logging
3. Report findings before proceeding to next steps

## Success Criteria
- Identify where tool format is being modified
- Successfully send properly formatted tools to Claude API
- Error "tools.0.custom.input_schema: Field required" resolved 