import fetch, { RequestInit, Response } from 'node-fetch';
import { URL } from 'url';

interface FetchWebPageArgs {
  url: string;
  timeout?: number;
}

interface FetchWebPageResult {
  content: string;
  contentType: string;
  statusCode: number;
}

export async function fetchWebPage(args: FetchWebPageArgs): Promise<FetchWebPageResult> {
  const { url, timeout = 30 } = args;

  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    // Cast the signal to any to work around type incompatibility between node-fetch and DOM types
    const fetchOptions: RequestInit = {
      signal: controller.signal as any,
      headers: {
        'User-Agent': 'Grant-Fetch-MCP/0.1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    };

    const response: Response = await fetch(url, fetchOptions);

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'text/html';
    const content = await response.text();

    // Basic validation that we got HTML content
    if (!content.includes('<!DOCTYPE html>') && !content.includes('<html')) {
      throw new Error('Response does not appear to be HTML content');
    }

    return {
      content,
      contentType,
      statusCode: response.status,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout} seconds`);
      }
      throw error;
    }
    // If it's not an Error instance, wrap it in one
    throw new Error(String(error));
  }
} 