import { execute } from './execute.js';

interface TestCase {
  name: string;
  code: string;
  expectedOutput?: string;
  expectError?: boolean;
  dataFiles?: Record<string, string>;
  timeout?: number;
}

const tests: TestCase[] = [
  {
    name: 'Basic arithmetic',
    code: '(displayln (+ 2 2))',
    expectedOutput: '4'
  },
  {
    name: 'List operations',
    code: `
#lang racket
(require racket/list)
(define arr '(1 2 3 4 5))
(displayln (format "Mean: ~a" (/ (apply + arr) (length arr))))
    `,
    expectedOutput: 'Mean: 3'
  },
  {
    name: 'Plot generation',
    code: `
#lang racket
(require plot)
(require racket/file)
(define output-dir (getenv "OUTPUT_DIR"))
(plot-file (function sin -3.14 3.14) (build-path output-dir "plot.png"))
(displayln "Plot saved successfully")
    `,
    expectedOutput: 'Plot saved successfully'
  },
  {
    name: 'Security block - system operations',
    code: '(system "ls")',
    expectError: true
  },
  {
    name: 'Security block - eval',
    code: '(eval (read (open-input-string "(displayln \'hello)")))',
    expectError: true
  },
  {
    name: 'Memory limit test',
    code: `
#lang racket
(displayln "Starting memory allocation...")
(define (create-large-data n)
  (if (<= n 0)
      '()
      (cons (make-vector 100000 0) (create-large-data (- n 1)))))
(define data (create-large-data 1000))
(displayln "Memory allocation complete")
    `,
    expectError: true,
    timeout: 10
  },
  {
    name: 'Timeout test',
    code: `
#lang racket
(sleep 35)  ; Should exceed default 30 second timeout
    `,
    expectError: true
  },
  {
    name: 'Hash table operations',
    code: `
#lang racket
(require racket/hash)
(define data (hash 'col1 '(1 2 3) 'col2 '(4 5 6)))
(displayln (hash-keys data))
(displayln (hash-values data))
    `
  },
  {
    name: 'Complex calculation',
    code: `
#lang racket
(require racket/random)
(require racket/list)
; Generate random data
(define (make-random-data n)
  (for/list ([i n])
    (random)))
(define dataset (make-random-data 1000))
(define training-size (* 0.8 (length dataset)))
(define training-data (take dataset (exact-floor training-size)))
(displayln (format "Training set size: ~a" (length training-data)))
    `
  }
];

async function runTests() {
  console.log('Starting Racket execution tests...\n');
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`Running test: ${test.name}`);
      const result = await execute({
        code: test.code,
        dataFiles: test.dataFiles,
        timeout: test.timeout
      });
      
      if (test.expectError) {
        console.error(`❌ Test failed: Expected error but got success`);
        failed++;
        continue;
      }
      
      if (!test.expectedOutput || result.output.trim().includes(test.expectedOutput.trim())) {
        console.log(`✅ Test passed`);
        passed++;
      } else {
        console.error(`❌ Test failed: Expected "${test.expectedOutput}" but got "${result.output}"`);
        failed++;
      }
    } catch (error) {
      if (test.expectError) {
        console.log(`✅ Test passed (expected error)`);
        passed++;
      } else {
        console.error(`❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
      }
    }
    console.log('-------------------\n');
  }

  console.log('Test Summary:');
  console.log(`Total tests: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((passed / tests.length) * 100).toFixed(2)}%`);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, tests };
export type { TestCase }; 