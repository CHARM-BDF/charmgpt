# Vertex AI Integration

This document describes the Google Vertex AI integration for the Charm MCP application.

## Overview

When the `GOOGLE_CLOUD_PROJECT` environment variable is set, the application will automatically use Google Vertex AI instead of direct API keys for Anthropic and Gemini providers. This provides several benefits:

- **Better Security**: Uses Google Cloud's Application Default Credentials (ADC) instead of API keys
- **Cost Management**: Leverages Google Cloud's billing and quota management
- **Enterprise Features**: Access to enterprise-grade security and compliance features
- **Unified Authentication**: Single authentication mechanism for all Google Cloud services

## Setup

### 1. Enable Vertex AI API

First, enable the Vertex AI API in your Google Cloud project:

```bash
gcloud services enable aiplatform.googleapis.com
```

### 2. Configure Authentication

Set up Application Default Credentials (ADC) using one of these methods:

#### Option A: Service Account (Recommended for production)

1. Create a service account:
```bash
gcloud iam service-accounts create charm-mcp-sa \
    --display-name="Charm MCP Service Account"
```

2. Grant necessary permissions:
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:charm-mcp-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"
```

3. Create and download a key file:
```bash
gcloud iam service-accounts keys create charm-mcp-key.json \
    --iam-account=charm-mcp-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

4. Set the environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="path/to/charm-mcp-key.json"
```

#### Option B: User Authentication (Development)

```bash
gcloud auth application-default login
```

### 3. Set Environment Variables

Add the following to your `.env` file:

```env
# Google Cloud Configuration (for Vertex AI)
GOOGLE_CLOUD_PROJECT=your_google_cloud_project_id_here
```

**Note**: When `GOOGLE_CLOUD_PROJECT` is set, the application will automatically use Vertex AI for both Anthropic and Gemini providers, and you won't need to set `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`.

## Usage

### Automatic Provider Selection

When `GOOGLE_CLOUD_PROJECT` is set, the application will automatically:

1. **Anthropic Provider**: Use `AnthropicVertexProvider` instead of `AnthropicProvider`
2. **Gemini Provider**: Use `GeminiVertexProvider` instead of `GeminiProvider`

### Model Names

Vertex AI uses slightly different model names:

| Provider | Standard API | Vertex AI |
|----------|-------------|-----------|
| Anthropic | `claude-3-5-sonnet-20241022` | `claude-sonnet-4@20250514` |
| Gemini | `gemini-2.5-flash` | `gemini-2.0-flash-exp` |

The application automatically selects the correct model name based on whether Vertex AI is enabled.

### Testing

Run the Vertex AI test script to verify the integration:

```bash
# Build the project first
npm run build

# Run the test
node test-vertex-ai.cjs
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLOUD_PROJECT` | Google Cloud Project ID | Yes (for Vertex AI) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key file | Yes (if using service account) |

### Fallback Behavior

If `GOOGLE_CLOUD_PROJECT` is not set, the application will:

1. Use the standard API providers (`AnthropicProvider`, `GeminiProvider`)
2. Require `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY` to be set
3. Use the standard model names

## Troubleshooting

### Common Issues

1. **Authentication Error**: Ensure ADC is properly configured
   ```bash
   gcloud auth application-default login
   ```

2. **Permission Error**: Ensure the service account has the `aiplatform.user` role
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
       --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
       --role="roles/aiplatform.user"
   ```

3. **API Not Enabled**: Enable the Vertex AI API
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```

4. **Rate Limiting (429 Error)**: You've hit the quota limits
   ```bash
   # Check your quotas
   node check-quotas.cjs
   
   # The application now includes automatic retry logic with exponential backoff
   # for 429 errors, but you may need to request quota increases for production use
   ```

### Debugging

Enable debug logging by setting:

```env
DEBUG=true
```

This will show detailed logs about which provider is being used and any authentication issues.

## Security Considerations

1. **Service Account Keys**: Store service account keys securely and never commit them to version control
2. **IAM Roles**: Use the principle of least privilege when assigning IAM roles
3. **Environment Variables**: Use environment variables or secret management systems for sensitive configuration

## Cost Optimization

1. **Quotas**: Set up quotas in Google Cloud Console to prevent unexpected charges
2. **Monitoring**: Use Google Cloud Monitoring to track API usage
3. **Billing Alerts**: Set up billing alerts to monitor costs

## Migration from API Keys

To migrate from API keys to Vertex AI:

1. Set up Google Cloud authentication (see Setup section)
2. Set `GOOGLE_CLOUD_PROJECT` in your environment
3. Remove `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` from your environment
4. Test the integration using the test script
5. Update your deployment configuration

The application will automatically detect the change and use Vertex AI providers. 