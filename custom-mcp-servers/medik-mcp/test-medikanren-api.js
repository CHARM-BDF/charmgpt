#!/usr/bin/env node

/**
 * MediKanren API Test Script
 * 
 * Tests reliability, query patterns, and optimal retry strategies for the MediKanren API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // MediKanren API base URL
  apiBase: "https://medikanren2.metareflective.app",
  // apiBase: "http://bore.pub:9191",

  // http://bore.pub:9191
  
  // Test entities to query - all IDs from logs
  testEntities: [
    // "NCBIGene:841",  // CASP8 - initially failed but succeeded later
    // "NCBIGene:5594", // MAPK1 - initially failed but succeeded later
    // "HGNC:1509",     // Consistently succeeded in logs
    // "HGNC:6871",     // Consistently succeeded in logs
    // "HGNC:1100",     // BRCA1 - showed mixed success/failure in original test
    "MONDO:0007254", // Breast cancer
    "MONDO:0005015", // diabetes
    "MONDO:0850306"  //latent autoimmune diagetes
  ],
  
  // Number of times to repeat each test (reduced for quicker results)
  repeatCount: 2,
  
  // Delay between requests in ms (longer to give API more time)
  defaultDelay: 2000,
  
  // Maximum number of retries (increased for more thorough testing)
  maxRetries: 4,
  
  // Log file location
  logFile: path.join(__dirname, 'medikanren-api-test.log')
};

// Setup logging
const logStream = fs.createWriteStream(CONFIG.logFile, { flags: 'a' });
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  
  // Write to console and file
  console.log(logLine.trim());
  logStream.write(logLine);
}

// Helper to wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Basic API request function with retry
async function makeRequest(url, retryCount = 0) {
  const startTime = Date.now();
  try {
    log(`Making request to: ${url}`, 'DEBUG');
    
    const response = await fetch(url);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (!response.ok) {
      log(`Request failed with status: ${response.status} (${duration}ms)`, 'ERROR');
      
      if (retryCount < CONFIG.maxRetries) {
        log(`Retrying (attempt ${retryCount + 1}/${CONFIG.maxRetries})...`, 'INFO');
        await sleep(CONFIG.defaultDelay);
        return makeRequest(url, retryCount + 1);
      }
      
      return {
        success: false,
        status: response.status,
        duration,
        error: `HTTP error: ${response.status}`,
        retryCount
      };
    }
    
    const data = await response.json();
    log(`Request successful (${duration}ms)`, 'INFO');
    
    return {
      success: true,
      data,
      duration,
      retryCount
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    log(`Request error: ${error.message} (${duration}ms)`, 'ERROR');
    
    if (retryCount < CONFIG.maxRetries) {
      log(`Retrying (attempt ${retryCount + 1}/${CONFIG.maxRetries})...`, 'INFO');
      await sleep(CONFIG.defaultDelay);
      return makeRequest(url, retryCount + 1);
    }
    
    return {
      success: false,
      duration,
      error: error.message,
      retryCount
    };
  }
}

// MediKanren query function
async function runQuery(params) {
  const { e1, e2, e3, description } = params;
  
  // Construct query URL
  const queryParams = new URLSearchParams();
  queryParams.append('e1', e1);
  queryParams.append('e2', e2);
  queryParams.append('e3', e3);
  
  const url = `${CONFIG.apiBase}/query?${queryParams.toString()}`;
  log(`Running query: ${description || `${e1} ${e2} ${e3}`}`, 'INFO');
  
  return makeRequest(url);
}

// Test a specific query pattern
async function testQueryPattern(pattern, entity) {
  const result = {
    pattern,
    entity,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
    avgDuration: 0,
    results: []
  };
  
  let params;
  if (pattern === 'X->Known') {
    params = {
      e1: 'X->Known',
      e2: 'biolink:related_to',
      e3: entity,
      description: `${pattern} for ${entity}`
    };
  } else if (pattern === 'Known->X') {
    params = {
      e1: 'Known->X',
      e2: 'biolink:related_to',
      e3: entity,
      description: `${pattern} for ${entity}`
    };
  } else {
    throw new Error(`Unknown pattern: ${pattern}`);
  }
  
  log(`===== TESTING PATTERN: ${pattern} for ${entity} =====`, 'TEST');
  
  // Run the pattern test multiple times
  for (let i = 0; i < CONFIG.repeatCount; i++) {
    log(`Run ${i + 1}/${CONFIG.repeatCount}`, 'INFO');
    const queryResult = await runQuery(params);
    result.results.push(queryResult);
    
    if (queryResult.success) {
      result.successCount++;
      result.totalDuration += queryResult.duration;
      
      if (Array.isArray(queryResult.data)) {
        log(`Query returned ${queryResult.data.length} results`, 'SUCCESS');
      } else {
        log(`Query returned non-array result: ${JSON.stringify(queryResult.data).substring(0, 100)}...`, 'WARNING');
      }
    } else {
      result.failureCount++;
    }
    
    // Wait between iterations
    if (i < CONFIG.repeatCount - 1) {
      await sleep(CONFIG.defaultDelay);
    }
  }
  
  // Calculate stats
  if (result.successCount > 0) {
    result.avgDuration = Math.round(result.totalDuration / result.successCount);
  }
  
  // Log summary
  log(`
Pattern: ${pattern} for ${entity}
Success rate: ${result.successCount}/${CONFIG.repeatCount} (${(result.successCount/CONFIG.repeatCount*100).toFixed(1)}%)
Average duration: ${result.avgDuration}ms
  `, 'SUMMARY');
  
  return result;
}

// Test query reliability for a single entity
async function testEntityQueries(entity) {
  log(`\n===== ENTITY TEST: ${entity} =====`, 'TEST');
  
  const results = {
    entity,
    patterns: {},
    startTime: new Date().toISOString(),
    endTime: null
  };
  
  // Test X->Known pattern
  results.patterns['X->Known'] = await testQueryPattern('X->Known', entity);
  
  // Test Known->X pattern
  results.patterns['Known->X'] = await testQueryPattern('Known->X', entity);
  
  // Record end time
  results.endTime = new Date().toISOString();
  
  // Calculate overall success rate
  const totalQueries = CONFIG.repeatCount * 2; // 2 patterns
  const totalSuccesses = results.patterns['X->Known'].successCount + 
                         results.patterns['Known->X'].successCount;
  
  // Log summary
  log(`
===== ENTITY SUMMARY: ${entity} =====
Overall success rate: ${totalSuccesses}/${totalQueries} (${(totalSuccesses/totalQueries*100).toFixed(1)}%)
X->Known success: ${results.patterns['X->Known'].successCount}/${CONFIG.repeatCount}
Known->X success: ${results.patterns['Known->X'].successCount}/${CONFIG.repeatCount}
  `, 'SUMMARY');
  
  return results;
}

// Main function
async function main() {
  log('====================', 'START');
  log('MediKanren API Test Script', 'START');
  log(`Testing against API: ${CONFIG.apiBase}`, 'INFO');
  log(`Testing ${CONFIG.testEntities.length} entities: ${CONFIG.testEntities.join(', ')}`, 'INFO');
  log('====================', 'START');
  
  // Record all test results
  const allResults = {
    timestamp: new Date().toISOString(),
    apiBase: CONFIG.apiBase,
    entityResults: {},
    inconsistentResults: [],
    strategyResults: {},
    batchVsSequentialResults: {},
    recommendations: []
  };
  
  // Start with basic connectivity test
  const isConnected = await testConnectivity();
  if (!isConnected) {
    log('Attempting to wake up the server before continuing...', 'WARNING');
    await wakeUpServer();
  }
  
  // Test each entity one by one
  for (const entity of CONFIG.testEntities) {
    // Try to wake up the server before testing each entity
    log(`Sending a wake-up ping before testing ${entity}...`, 'INFO');
    await wakeUpServer();
    
    allResults.entityResults[entity] = await testEntityQueries(entity);
    
    // Check for inconsistent behavior
    const results = allResults.entityResults[entity];
    const xToKnownResults = results.patterns['X->Known'].results;
    const knownToXResults = results.patterns['Known->X'].results;
    
    let hasInconsistentBehavior = false;
    
    // Check if X->Known has mixed success/failure
    const xToKnownHasMixed = xToKnownResults.some(r => r.success) && xToKnownResults.some(r => !r.success);
    
    // Check if Known->X has mixed success/failure 
    const knownToXHasMixed = knownToXResults.some(r => r.success) && knownToXResults.some(r => !r.success);
    
    if (xToKnownHasMixed || knownToXHasMixed) {
      hasInconsistentBehavior = true;
      allResults.inconsistentResults.push({
        entity,
        xToKnownInconsistent: xToKnownHasMixed,
        knownToXInconsistent: knownToXHasMixed,
        details: {
          xToKnown: xToKnownResults.map(r => ({ success: r.success, error: r.error || null })),
          knownToX: knownToXResults.map(r => ({ success: r.success, error: r.error || null }))
        }
      });
      
      log(`⚠️ INCONSISTENT BEHAVIOR DETECTED for ${entity}`, 'WARNING');
      if (xToKnownHasMixed) {
        log(`  - X->Known pattern shows mixed success/failure`, 'WARNING');
      }
      if (knownToXHasMixed) {
        log(`  - Known->X pattern shows mixed success/failure`, 'WARNING');
      }
    }
    
    // Add a delay between entity tests to avoid overwhelming the API
    await sleep(3000);
  }
  
  // Log specific details about inconsistent entities
  if (allResults.inconsistentResults.length > 0) {
    log('\n===== INCONSISTENT ENTITIES DETECTED =====', 'WARNING');
    for (const result of allResults.inconsistentResults) {
      log(`Entity: ${result.entity}`, 'WARNING');
      log(`  X->Known inconsistent: ${result.xToKnownInconsistent}`, 'WARNING');
      log(`  Known->X inconsistent: ${result.knownToXInconsistent}`, 'WARNING');
    }
  } else {
    log('\n===== NO INCONSISTENT BEHAVIOR DETECTED =====', 'SUCCESS');
    log('All entities showed consistent behavior (either all success or all failure for each pattern)', 'SUCCESS');
  }
  
  // Additional analysis for NCBIGene vs HGNC prefixes
  const ncbiGeneEntities = CONFIG.testEntities.filter(e => e.startsWith('NCBIGene:'));
  const hgncEntities = CONFIG.testEntities.filter(e => e.startsWith('HGNC:'));
  
  // Compare success rates by prefix
  if (ncbiGeneEntities.length > 0 && hgncEntities.length > 0) {
    log('\n===== PREFIX COMPARISON =====', 'ANALYSIS');
    
    const calculateSuccessRate = (entityList) => {
      let totalQueries = 0;
      let totalSuccesses = 0;
      
      for (const entity of entityList) {
        if (!allResults.entityResults[entity]) continue;
        
        const xToKnownSuccess = allResults.entityResults[entity].patterns['X->Known'].successCount;
        const knownToXSuccess = allResults.entityResults[entity].patterns['Known->X'].successCount;
        
        totalSuccesses += xToKnownSuccess + knownToXSuccess;
        totalQueries += CONFIG.repeatCount * 2;
      }
      
      return totalQueries > 0 ? totalSuccesses / totalQueries : 0;
    };
    
    const ncbiSuccessRate = calculateSuccessRate(ncbiGeneEntities);
    const hgncSuccessRate = calculateSuccessRate(hgncEntities);
    
    log(`NCBIGene prefix success rate: ${(ncbiSuccessRate * 100).toFixed(1)}%`, 'ANALYSIS');
    log(`HGNC prefix success rate: ${(hgncSuccessRate * 100).toFixed(1)}%`, 'ANALYSIS');
    
    if (ncbiSuccessRate > hgncSuccessRate) {
      log('NCBIGene prefix has better overall success rate', 'CONCLUSION');
    } else if (hgncSuccessRate > ncbiSuccessRate) {
      log('HGNC prefix has better overall success rate', 'CONCLUSION');
    } else {
      log('Both prefixes have equal success rates', 'CONCLUSION');
    }
  }
  
  // Identify the most reliable entity for further tests
  let mostReliableEntity = null;
  let highestReliability = -1;
  
  for (const [entity, results] of Object.entries(allResults.entityResults)) {
    const totalQueries = CONFIG.repeatCount * 2; // 2 patterns per entity
    const totalSuccesses = results.patterns['X->Known'].successCount + 
                          results.patterns['Known->X'].successCount;
    const reliability = totalSuccesses / totalQueries;
    
    if (reliability > highestReliability) {
      highestReliability = reliability;
      mostReliableEntity = entity;
    }
  }
  
  log(`\n===== INTERMEDIATE RESULTS =====`, 'SUMMARY');
  log(`Most reliable entity: ${mostReliableEntity} (${(highestReliability * 100).toFixed(1)}% success rate)`, 'SUMMARY');
  
  // Continue with retry strategy tests using the most reliable entity
  if (mostReliableEntity) {
    allResults.strategyResults = await testRetryStrategies(mostReliableEntity);
    
    // Test batch vs sequential queries
    allResults.batchVsSequentialResults = await testBatchVsSequential(mostReliableEntity);
  } else {
    log('⚠️ No reliable entity found for advanced tests', 'WARNING');
  }
  
  // Generate final recommendations
  log('\n\n===== FINAL ANALYSIS AND RECOMMENDATIONS =====', 'CONCLUSION');
  
  // 1. Pattern recommendations
  const patternRecommendations = {};
  
  for (const [entity, results] of Object.entries(allResults.entityResults)) {
    const xToKnownRate = results.patterns['X->Known'].successCount / CONFIG.repeatCount;
    const knownToXRate = results.patterns['Known->X'].successCount / CONFIG.repeatCount;
    
    patternRecommendations[entity] = {
      recommendedPattern: xToKnownRate > knownToXRate ? 'X->Known' : 'Known->X',
      reason: xToKnownRate > knownToXRate 
        ? `X->Known has a higher success rate (${(xToKnownRate * 100).toFixed(1)}% vs ${(knownToXRate * 100).toFixed(1)}%)`
        : `Known->X has a higher success rate (${(knownToXRate * 100).toFixed(1)}% vs ${(xToKnownRate * 100).toFixed(1)}%)`
    };
    
    if (xToKnownRate === knownToXRate) {
      const xToKnownDuration = results.patterns['X->Known'].avgDuration;
      const knownToXDuration = results.patterns['Known->X'].avgDuration;
      
      patternRecommendations[entity].recommendedPattern = xToKnownDuration < knownToXDuration ? 'X->Known' : 'Known->X';
      patternRecommendations[entity].reason = `Both patterns have the same success rate (${(xToKnownRate * 100).toFixed(1)}%), but ${patternRecommendations[entity].recommendedPattern} is faster`;
    }
    
    log(`Entity ${entity}: ${patternRecommendations[entity].recommendedPattern} is recommended - ${patternRecommendations[entity].reason}`, 'CONCLUSION');
  }
  
  allResults.recommendations.push({
    title: 'Query pattern recommendations',
    recommendations: patternRecommendations
  });
  
  // 2. Retry strategy recommendation
  if (allResults.strategyResults && allResults.strategyResults.strategies) {
    let bestStrategy = null;
    let bestSuccessRate = -1;
    
    for (const [name, data] of Object.entries(allResults.strategyResults.strategies)) {
      const successRate = data.successCount / data.attempts;
      if (successRate > bestSuccessRate) {
        bestSuccessRate = successRate;
        bestStrategy = name;
      }
    }
    
    if (bestStrategy) {
      const recommendation = {
        strategy: bestStrategy,
        successRate: (bestSuccessRate * 100).toFixed(1) + '%',
        delay: allResults.strategyResults.strategies[bestStrategy].delay
      };
      
      allResults.recommendations.push({
        title: 'Retry strategy recommendation',
        recommendation
      });
      
      log(`Retry strategy: ${recommendation.strategy} with ${recommendation.delay}ms delay is recommended (${recommendation.successRate} success rate)`, 'CONCLUSION');
    }
  }
  
  // 3. Batch vs sequential recommendation
  if (allResults.batchVsSequentialResults) {
    const batchRate = allResults.batchVsSequentialResults.batch.successCount / 4; // 4 queries
    const seqRate = allResults.batchVsSequentialResults.sequential.successCount / 4;
    
    let recommendation;
    
    if (batchRate > seqRate) {
      recommendation = {
        approach: 'Batch',
        reason: `Higher success rate (${(batchRate * 100).toFixed(1)}% vs ${(seqRate * 100).toFixed(1)}%)`
      };
    } else if (seqRate > batchRate) {
      recommendation = {
        approach: 'Sequential',
        reason: `Higher success rate (${(seqRate * 100).toFixed(1)}% vs ${(batchRate * 100).toFixed(1)}%)`
      };
    } else {
      const batchDuration = allResults.batchVsSequentialResults.batch.totalDuration;
      const seqDuration = allResults.batchVsSequentialResults.sequential.totalDuration;
      
      recommendation = {
        approach: batchDuration < seqDuration ? 'Batch' : 'Sequential',
        reason: `Same success rate (${(batchRate * 100).toFixed(1)}%) but ${batchDuration < seqDuration ? 'Batch' : 'Sequential'} is faster (${batchDuration < seqDuration ? batchDuration : seqDuration}ms vs ${batchDuration < seqDuration ? seqDuration : batchDuration}ms)`
      };
    }
    
    allResults.recommendations.push({
      title: 'Query approach recommendation',
      recommendation
    });
    
    log(`Query approach: ${recommendation.approach} is recommended - ${recommendation.reason}`, 'CONCLUSION');
  }
  
  // 4. Final overall recommendation
  let finalStrategy = "Based on all test results, the recommended approach is:";
  
  // 4.1 For each entity, recommend specific pattern
  finalStrategy += "\n\n1. Use specific patterns for each entity:";
  for (const [entity, rec] of Object.entries(patternRecommendations)) {
    finalStrategy += `\n   - ${entity}: Use ${rec.recommendedPattern}`;
  }
  
  // 4.2 Recommend retry strategy
  if (allResults.recommendations.find(r => r.title === 'Retry strategy recommendation')) {
    const retryRec = allResults.recommendations.find(r => r.title === 'Retry strategy recommendation').recommendation;
    finalStrategy += `\n\n2. When retries are needed, use ${retryRec.strategy} (${retryRec.delay}ms delay)`;
  }
  
  // 4.3 Recommend batch vs sequential
  if (allResults.recommendations.find(r => r.title === 'Query approach recommendation')) {
    const approachRec = allResults.recommendations.find(r => r.title === 'Query approach recommendation').recommendation;
    finalStrategy += `\n\n3. Use ${approachRec.approach} queries when possible`;
  }
  
  // 4.4 General best practices
  finalStrategy += "\n\n4. Additional best practices:";
  finalStrategy += "\n   - Always implement retry logic for all queries";
  finalStrategy += "\n   - Consider caching successful results to reduce API load";
  finalStrategy += "\n   - Implement exponential backoff for persistent failures";
  
  log(`\n${finalStrategy}`, 'FINAL');
  
  // Save complete results to JSON file
  try {
    const resultsFile = path.join(__dirname, 'medikanren-api-test-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
    log(`Complete test results saved to: ${resultsFile}`, 'INFO');
  } catch (error) {
    log(`Failed to save results file: ${error.message}`, 'ERROR');
  }
  
  return allResults;
}

// Run the main function
main().catch(error => {
  log(`Unhandled error: ${error.message}`, 'CRITICAL');
  log(error.stack, 'CRITICAL');
  logStream.end();
  process.exit(1);
}).finally(() => {
  log('Tests complete', 'END');
  logStream.end();
});

// Basic connectivity test
async function testConnectivity() {
  log('===== BASIC CONNECTIVITY TEST =====', 'TEST');
  
  // Instead of using a ping endpoint, test the actual query endpoint with a minimal query
  const queryParams = new URLSearchParams();
  queryParams.append('e1', 'X->Known');
  queryParams.append('e2', 'biolink:related_to');
  queryParams.append('e3', 'MONDO:0005148'); // Using a different entity for testing connectivity
  
  const url = `${CONFIG.apiBase}/query?${queryParams.toString()}`;
  log(`Testing connectivity to query endpoint: ${CONFIG.apiBase}/query`, 'INFO');
  
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      log(`✅ Query endpoint is reachable (status: ${response.status}, returned ${Array.isArray(data) ? data.length : 'non-array'} result)`, 'SUCCESS');
      return true;
    } else {
      log(`❌ Query endpoint returned status: ${response.status}`, 'ERROR');
      return false;
    }
  } catch (error) {
    log(`❌ Query endpoint is not reachable: ${error.message}`, 'ERROR');
    log(`Continuing with tests anyway - the server may need to wake up`, 'WARNING');
    return false;
  }
}

// Try to wake up the server
async function wakeUpServer() {
  log('Attempting to wake up the server with some simple queries...', 'INFO');
  
  // We'll try a few different simple queries
  const wakeupQueries = [
    { e1: 'Known->X', e2: 'biolink:related_to', e3: 'MONDO:0005148' },
    { e1: 'X->Known', e2: 'biolink:related_to', e3: 'MONDO:0005148' },
    { e1: 'Known->X', e2: 'biolink:related_to', e3: 'NCBIGene:841' }
  ];
  
  for (const params of wakeupQueries) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      queryParams.append(key, value);
    }
    
    const url = `${CONFIG.apiBase}/query?${queryParams.toString()}`;
    log(`Sending wake-up ping with: ${params.e1} ${params.e2} ${params.e3}`, 'INFO');
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        log(`✅ Server responded to wake-up ping! (${Array.isArray(data) ? data.length : 'non-array'} result)`, 'SUCCESS');
        return true;
      }
    } catch (error) {
      log(`Wake-up ping failed: ${error.message}`, 'WARNING');
    }
    
    // Wait a bit before the next attempt
    await sleep(2000);
  }
  
  log(`Server wake-up attempts complete. Proceeding with tests.`, 'INFO');
  return false;
}

// Test retry strategies with different delays
async function testRetryStrategies(entity) {
  log('\n===== RETRY STRATEGY TEST =====', 'TEST');
  log(`Testing different retry strategies for ${entity}`, 'INFO');
  
  const delayStrategies = [
    {name: 'Short delay', delay: 500},
    {name: 'Medium delay', delay: 1500},
    {name: 'Long delay', delay: 3000}
  ];
  
  const results = {
    entity,
    strategies: {}
  };
  
  for (const strategy of delayStrategies) {
    log(`\nTesting strategy: ${strategy.name} (${strategy.delay}ms delay)`, 'TEST');
    
    const strategyResults = {
      name: strategy.name,
      delay: strategy.delay,
      attempts: 3,
      successCount: 0,
      failures: [],
      durations: []
    };
    
    // Run X->Known query 3 times with this delay strategy
    for (let i = 0; i < strategyResults.attempts; i++) {
      const params = {
        e1: 'X->Known',
        e2: 'biolink:related_to',
        e3: entity,
        description: `${strategy.name} retry test (${i+1}/${strategyResults.attempts})`
      };
      
      // First try - expect it to fail
      log(`Initial attempt (expecting failure)...`, 'INFO');
      const initialResult = await runQuery(params);
      
      if (initialResult.success) {
        log(`✅ Unexpectedly succeeded on first try!`, 'SUCCESS');
        strategyResults.successCount++;
        strategyResults.durations.push(initialResult.duration);
        continue;
      }
      
      // Wait according to strategy
      log(`Waiting ${strategy.delay}ms before retry...`, 'INFO');
      await sleep(strategy.delay);
      
      // Retry
      log(`Retrying after delay...`, 'INFO');
      const retryResult = await runQuery(params);
      
      if (retryResult.success) {
        log(`✅ Retry succeeded after ${strategy.delay}ms delay`, 'SUCCESS');
        strategyResults.successCount++;
        strategyResults.durations.push(retryResult.duration);
      } else {
        log(`❌ Retry failed even after delay`, 'ERROR');
        strategyResults.failures.push({
          initialError: initialResult.error,
          retryError: retryResult.error
        });
      }
      
      // Wait between test iterations
      if (i < strategyResults.attempts - 1) {
        await sleep(1000);
      }
    }
    
    // Calculate success rate
    const successRate = (strategyResults.successCount / strategyResults.attempts) * 100;
    
    log(`
Strategy: ${strategy.name} (${strategy.delay}ms)
Success rate: ${strategyResults.successCount}/${strategyResults.attempts} (${successRate.toFixed(1)}%)
Avg duration on success: ${strategyResults.durations.length > 0 
  ? Math.round(strategyResults.durations.reduce((a, b) => a + b, 0) / strategyResults.durations.length) 
  : 'N/A'}ms
    `, 'SUMMARY');
    
    results.strategies[strategy.name] = strategyResults;
  }
  
  // Determine best strategy
  let bestStrategy = null;
  let bestSuccessRate = -1;
  
  for (const [name, data] of Object.entries(results.strategies)) {
    const successRate = (data.successCount / data.attempts) * 100;
    if (successRate > bestSuccessRate) {
      bestSuccessRate = successRate;
      bestStrategy = name;
    }
  }
  
  if (bestStrategy) {
    log(`Best retry strategy: ${bestStrategy} with ${bestSuccessRate.toFixed(1)}% success rate`, 'CONCLUSION');
  } else {
    log(`No successful retry strategy found`, 'CONCLUSION');
  }
  
  return results;
}

// Test batch vs sequential queries
async function testBatchVsSequential(entity) {
  log('\n===== BATCH VS SEQUENTIAL TEST =====', 'TEST');
  
  const results = {
    entity,
    batch: {
      successCount: 0,
      failureCount: 0,
      totalDuration: 0
    },
    sequential: {
      successCount: 0,
      failureCount: 0,
      totalDuration: 0
    }
  };
  
  // Number of queries to run in each test
  const queryCount = 4;
  
  // 1. Test batch queries (all at once)
  log('Testing batch queries (all at once)...', 'INFO');
  const batchStartTime = Date.now();
  
  const batchPromises = [];
  for (let i = 0; i < queryCount; i++) {
    const params = {
      e1: 'X->Known',
      e2: 'biolink:related_to',
      e3: entity,
      description: `Batch query ${i+1}/${queryCount}`
    };
    
    batchPromises.push(runQuery(params));
  }
  
  const batchResults = await Promise.all(batchPromises);
  const batchEndTime = Date.now();
  results.batch.totalDuration = batchEndTime - batchStartTime;
  
  for (const result of batchResults) {
    if (result.success) {
      results.batch.successCount++;
    } else {
      results.batch.failureCount++;
    }
  }
  
  log(`
Batch queries complete:
Success rate: ${results.batch.successCount}/${queryCount} (${(results.batch.successCount/queryCount*100).toFixed(1)}%)
Total duration: ${results.batch.totalDuration}ms
  `, 'SUMMARY');
  
  // Wait between tests
  await sleep(3000);
  
  // 2. Test sequential queries (one after another)
  log('Testing sequential queries (one after another)...', 'INFO');
  const seqStartTime = Date.now();
  
  for (let i = 0; i < queryCount; i++) {
    const params = {
      e1: 'X->Known',
      e2: 'biolink:related_to',
      e3: entity,
      description: `Sequential query ${i+1}/${queryCount}`
    };
    
    const result = await runQuery(params);
    
    if (result.success) {
      results.sequential.successCount++;
    } else {
      results.sequential.failureCount++;
    }
    
    // Wait between sequential queries
    if (i < queryCount - 1) {
      await sleep(CONFIG.defaultDelay);
    }
  }
  
  const seqEndTime = Date.now();
  results.sequential.totalDuration = seqEndTime - seqStartTime;
  
  log(`
Sequential queries complete:
Success rate: ${results.sequential.successCount}/${queryCount} (${(results.sequential.successCount/queryCount*100).toFixed(1)}%)
Total duration: ${results.sequential.totalDuration}ms
  `, 'SUMMARY');
  
  // Compare and make recommendation
  const batchSuccessRate = results.batch.successCount / queryCount;
  const seqSuccessRate = results.sequential.successCount / queryCount;
  
  if (batchSuccessRate > seqSuccessRate) {
    log('CONCLUSION: Batch queries have a better success rate', 'CONCLUSION');
  } else if (seqSuccessRate > batchSuccessRate) {
    log('CONCLUSION: Sequential queries have a better success rate', 'CONCLUSION');
  } else {
    if (results.sequential.totalDuration < results.batch.totalDuration) {
      log('CONCLUSION: Both approaches have the same success rate, but sequential queries are faster', 'CONCLUSION');
    } else {
      log('CONCLUSION: Both approaches have the same success rate, but batch queries are faster', 'CONCLUSION');
    }
  }
  
  return results;
} 