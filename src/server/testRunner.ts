import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { systemPrompt } from './systemPrompt';
import { testSystemPrompt } from './testSystemPrompt';
import { parseString } from 'xml2js';
import { promisify } from 'util';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseXML = promisify(parseString);

// Define the XMLResponse interface
interface XMLResponse {
    response: {
        thinking?: string[];
        conversation: string[];
        artifact?: Array<{
            $: {
                type: string;
                id: string;
                title: string;
            };
            _: string;
        }>;
    };
}

// Copy the validation function here to avoid server initialization
async function isValidXMLResponse(text: string): Promise<boolean> {
    // Wrap content inside main container tags in CDATA
    console.log("Validating XML response...");
    const wrappedText = text.replace(
        /(<(thinking|conversation|artifact)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
        (_match, openTag, _tagName, content, closeTag) => {
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        }
    );

    // Basic check for XML structure
    const hasXMLStructure = wrappedText.trim().startsWith('<response>') &&
        wrappedText.trim().endsWith('</response>') &&
        wrappedText.includes('<conversation>');

    if (!hasXMLStructure) {
        console.log('Server: Invalid XML structure detected');
        return Promise.resolve(false);
    }

    return parseXML(wrappedText)
        .then((result: unknown) => {
            const xmlResult = result as XMLResponse;
            // Check if we have the required structure
            const hasValidStructure =
                xmlResult?.response &&
                (xmlResult.response.conversation || []).length > 0;

            if (!hasValidStructure) {
                console.log('Server: Missing required XML elements');
                return false;
            }

            return true;
        })
        .catch(error => {
            console.log('Server: XML validation error:', error);
            return false;
        });
}

interface TestCase {
    name: string;
    prompt: string;
}

interface ValidationError {
    type: string;
    details: string;
    response: string;
}

interface TestResult {
    testCase: TestCase;
    success: boolean;
    error?: ValidationError;
    rawResponse: string;
    processingTime: number;
}

interface TestSummary {
    totalRuns: number;
    successCount: number;
    failureCount: number;
    errorTypes: Map<string, number>;
    averageProcessingTime: number;
    testResults: TestResult[];
}

const TEST_CASES: TestCase[] = [
    {
        name: "Simple Question",
        prompt: "What is the capital of France?"
    },
    {
        name: "Code Request",
        prompt: "Write a function to calculate fibonacci numbers in Python"
    },
    {
        name: "Complex Analysis",
        prompt: "Analyze the pros and cons of microservices architecture"
    },
    {
        name: "Multi-part Question",
        prompt: "Tell me about neural networks. Include both basic concepts and advanced applications."
    },
    {
        name: "Special Characters",
        prompt: "Explain XML & HTML tags. What's the difference between <div> and <span>?"
    },
    {
        name: "Code with Comments",
        prompt: "Write a JavaScript function with detailed comments that includes regex and XML parsing"
    },
    {
        name: "Markdown Heavy",
        prompt: "Create a detailed markdown document about REST APIs with code examples, tables, and lists"
    },
    {
        name: "Mixed Content",
        prompt: "Explain how to implement authentication in a web app. Include code snippets, security considerations, and best practices"
    },
    {
        name: "Long Response",
        prompt: "Write a comprehensive guide about machine learning algorithms, including examples and use cases for each type"
    },
    {
        name: "Artifact Generation",
        prompt: "Create a sequence diagram showing the authentication flow in a microservices architecture"
    }
];

const RUNS_PER_TEST = 2;

async function runTest(
    client: Anthropic,
    testCase: TestCase,
    useTestPrompt: boolean = false
): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
        const response = await client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: [{ role: 'user', content: testCase.prompt }],
            system: useTestPrompt ? testSystemPrompt : systemPrompt,
            temperature: 0.7,
        });

        if (response.content[0].type !== 'text') {
            throw new Error('Expected text response from Claude');
        }

        const responseText = response.content[0].text;
        const isValid = await isValidXMLResponse(responseText);

        if (!isValid) {
            // Analyze the type of validation failure
            let errorType = 'Unknown';
            let errorDetails = 'Validation failed';

            // Basic structure checks
            if (!responseText.trim().startsWith('<response>')) {
                errorType = 'MissingResponseTag';
                errorDetails = 'Response does not start with <response> tag';
            } else if (!responseText.trim().endsWith('</response>')) {
                errorType = 'UnclosedResponseTag';
                errorDetails = 'Response does not end with </response> tag';
            } else if (!responseText.includes('<conversation>')) {
                errorType = 'MissingConversationTag';
                errorDetails = 'Response missing required <conversation> tag';
            }
            // CDATA issues
            else if (responseText.includes('CDATA') && !responseText.includes(']]>')) {
                errorType = 'MalformedCDATA';
                errorDetails = 'CDATA section not properly closed';
            }
            // Tag matching issues
            else if (responseText.match(/<[^>]*>/g)?.some(tag => !tag.includes('/'))) {
                errorType = 'UnclosedTags';
                errorDetails = 'Contains unclosed XML tags';
            }
            // Special character issues
            else if (responseText.match(/[<>&](?![a-zA-Z]+;|#\d+;)/)) {
                errorType = 'UnescapedSpecialChars';
                errorDetails = 'Contains unescaped special characters';
            }
            // Artifact validation
            else if (responseText.includes('<artifact') && 
                    (!responseText.match(/<artifact[^>]*type=["'][^"']*["']/) ||
                     !responseText.match(/<artifact[^>]*id=["'][^"']*["']/) ||
                     !responseText.match(/<artifact[^>]*title=["'][^"']*["']/))) {
                errorType = 'InvalidArtifactAttributes';
                errorDetails = 'Artifact tag missing required attributes';
            }
            // Nested tag issues
            else if (responseText.match(/<(thinking|conversation|artifact)[^>]*>[^<]*<\1/)) {
                errorType = 'NestedTags';
                errorDetails = 'Contains nested tags of the same type';
            }
            // Empty content
            else if (responseText.match(/<(thinking|conversation|artifact)[^>]*>\s*<\/\1>/)) {
                errorType = 'EmptyContent';
                errorDetails = 'Contains empty tag content';
            }
            // XML parsing errors
            else if (responseText.includes('<?xml') || responseText.includes('<!DOCTYPE')) {
                errorType = 'UnexpectedXMLDeclaration';
                errorDetails = 'Contains XML declaration or DOCTYPE';
            }

            return {
                testCase,
                success: false,
                error: {
                    type: errorType,
                    details: errorDetails,
                    response: responseText
                },
                rawResponse: responseText,
                processingTime: Date.now() - startTime
            };
        }

        return {
            testCase,
            success: true,
            rawResponse: responseText,
            processingTime: Date.now() - startTime
        };

    } catch (error) {
        return {
            testCase,
            success: false,
            error: {
                type: 'APIError',
                details: error instanceof Error ? error.message : 'Unknown error',
                response: ''
            },
            rawResponse: '',
            processingTime: Date.now() - startTime
        };
    }
}

async function generateTestSummary(results: TestResult[]): Promise<TestSummary> {
    const errorTypes = new Map<string, number>();
    let successCount = 0;
    let totalProcessingTime = 0;

    results.forEach(result => {
        if (result.success) {
            successCount++;
        } else if (result.error) {
            const currentCount = errorTypes.get(result.error.type) || 0;
            errorTypes.set(result.error.type, currentCount + 1);
        }
        totalProcessingTime += result.processingTime;
    });

    return {
        totalRuns: results.length,
        successCount,
        failureCount: results.length - successCount,
        errorTypes,
        averageProcessingTime: totalProcessingTime / results.length,
        testResults: results
    };
}

async function writeTestResults(summary: TestSummary, useTestPrompt: boolean): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = path.join(path.dirname(__dirname), '../logs');
    
    // Ensure logs directory exists
    await fs.mkdir(logDir, { recursive: true });
    
    const logFile = path.join(logDir, `validation_test_${useTestPrompt ? 'test' : 'main'}_${timestamp}.txt`);
    
    // Create a failures directory for raw responses
    const failuresDir = path.join(logDir, 'failures');
    await fs.mkdir(failuresDir, { recursive: true });
    
    let logContent = `XML Validation Test Results
Timestamp: ${new Date().toISOString()}
System Prompt: ${useTestPrompt ? 'Test' : 'Main'}
===========================================

Summary:
--------
Total Runs: ${summary.totalRuns}
Successful: ${summary.successCount}
Failed: ${summary.failureCount}
Success Rate: ${((summary.successCount / summary.totalRuns) * 100).toFixed(2)}%
Average Processing Time: ${(summary.averageProcessingTime / 1000).toFixed(2)}s

Error Types:
-----------
${Array.from(summary.errorTypes.entries())
    .map(([type, count]) => `${type}: ${count} occurrences (${((count / summary.failureCount) * 100).toFixed(2)}%)`)
    .join('\n')}

Detailed Results:
----------------
${summary.testResults.map((result, index) => `
Test #${index + 1}
Prompt: "${result.testCase.prompt}"
Success: ${result.success}
Processing Time: ${(result.processingTime / 1000).toFixed(2)}s
${result.error ? `Error Type: ${result.error.type}
Error Details: ${result.error.details}
Raw Response Preview (first 500 chars):
${result.rawResponse.substring(0, 500)}...
Full response saved to: failures/test_${index + 1}_${result.error.type}_${timestamp}.txt` : ''}
`).join('\n')}`;

    // Write the main log file
    await fs.writeFile(logFile, logContent);
    console.log(`Test results written to ${logFile}`);

    // Write individual files for failed tests
    for (let i = 0; i < summary.testResults.length; i++) {
        const result = summary.testResults[i];
        if (!result.success && result.error) {
            const failureFile = path.join(failuresDir, `test_${i + 1}_${result.error.type}_${timestamp}.txt`);
            const failureContent = `Test Case: ${result.testCase.name}
Prompt: ${result.testCase.prompt}
Error Type: ${result.error.type}
Error Details: ${result.error.details}
Processing Time: ${(result.processingTime / 1000).toFixed(2)}s

Raw Response:
============
${result.rawResponse}`;
            
            await fs.writeFile(failureFile, failureContent);
            console.log(`Failed test response written to ${failureFile}`);
        }
    }
}

export async function runValidationTests() {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const totalTests = TEST_CASES.length * RUNS_PER_TEST * 2; // *2 for both prompts
    const MAX_TEST_RUNS = 1000; // Stop after 3 runs total
    let completedTests = 0;

    function updateProgress() {
        const percentage = ((completedTests / totalTests) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${completedTests}/${totalTests} (${percentage}%)`);
    }

    try {
        // Run tests with main system prompt
        console.log('\nRunning tests with main system prompt...');
        const mainPromptResults: TestResult[] = [];
        for (const testCase of TEST_CASES) {
            for (let i = 0; i < RUNS_PER_TEST; i++) {
                console.log(`\nRunning test: ${testCase.name} (${i + 1}/${RUNS_PER_TEST})`);
                const result = await runTest(client, testCase, false);
                mainPromptResults.push(result);
                completedTests++;
                updateProgress();

                if (completedTests >= MAX_TEST_RUNS) {
                    // Write early results and exit
                    const mainPromptSummary = await generateTestSummary(mainPromptResults);
                    await writeTestResults(mainPromptSummary, false);
                    console.log('\n\nTest run completed early (reached maximum test count)');
                    console.log(`Results written to logs directory: ${path.join(path.dirname(__dirname), '../logs')}`);
                    return;
                }
            }
        }

        const mainPromptSummary = await generateTestSummary(mainPromptResults);
        await writeTestResults(mainPromptSummary, false);

        // Run tests with test system prompt
        console.log('\n\nRunning tests with test system prompt...');
        const testPromptResults: TestResult[] = [];
        for (const testCase of TEST_CASES) {
            for (let i = 0; i < RUNS_PER_TEST; i++) {
                console.log(`\nRunning test: ${testCase.name} (${i + 1}/${RUNS_PER_TEST})`);
                const result = await runTest(client, testCase, true);
                testPromptResults.push(result);
                completedTests++;
                updateProgress();
            }
        }
        const testPromptSummary = await generateTestSummary(testPromptResults);
        await writeTestResults(testPromptSummary, true);

        console.log('\n\nAll tests completed!');
        console.log(`Results written to logs directory: ${path.join(path.dirname(__dirname), '../logs')}`);
    } catch (error) {
        console.error('\n\nError during test execution:', error);
        throw error;
    }
} 