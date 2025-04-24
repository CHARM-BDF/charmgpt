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
    code: 'print(2 + 2)',
    expectedOutput: '4'
  },
  {
    name: 'NumPy operations',
    code: `
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
print(f"Mean: {arr.mean()}")
    `,
    expectedOutput: 'Mean: 3.0'
  },
  {
    name: 'Matplotlib plotting',
    code: `
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.plot(x, y)
plt.title('Sine Wave')
plt.savefig('plot.png')
print('Plot saved successfully')
    `,
    expectedOutput: 'Plot saved successfully'
  },
  {
    name: 'Security block - os module',
    code: 'import os\nos.system("ls")',
    expectError: true
  },
  {
    name: 'Security block - eval',
    code: 'eval("print(\'hello\')")',
    expectError: true
  },
  {
    name: 'Memory limit test',
    code: `
import psutil
import os
import numpy as np
import threading
import time

def monitor_memory():
    process = psutil.Process(os.getpid())
    while True:
        try:
            memory_mb = process.memory_info().rss / (1024 * 1024)
            print(f"Memory usage: {memory_mb:.2f} MB")
            if memory_mb > 256:  # 256 MB limit
                print("Memory limit exceeded!")
                os._exit(1)  # Force exit
            time.sleep(0.1)
        except:
            break

# Start memory monitoring in a separate thread
monitor_thread = threading.Thread(target=monitor_memory)
monitor_thread.daemon = True
monitor_thread.start()

# Allocate memory aggressively
data = []
chunk_size = (1000, 1000)  # 8MB per chunk (8 bytes * 1000 * 1000)
print("Starting memory allocation...")

try:
    while True:
        data.append(np.random.random(chunk_size))
        if len(data) % 10 == 0:
            allocated = len(data) * 8 * chunk_size[0] * chunk_size[1] / (1024*1024)
            print(f"Allocated approximately {allocated:.2f} MB")
except Exception as e:
    print(f"Error occurred: {str(e)}")
    raise
    `,
    expectError: true,
    timeout: 10
  },
  {
    name: 'Timeout test',
    code: `
import time
time.sleep(35)  # Should exceed default 30 second timeout
    `,
    expectError: true
  },
  {
    name: 'Pandas operations',
    code: `
import pandas as pd
data = {'col1': [1, 2, 3], 'col2': [4, 5, 6]}
df = pd.DataFrame(data)
print(df.describe())
    `
  },
  {
    name: 'Complex calculation',
    code: `
import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

# Generate a random classification dataset
X, y = make_classification(n_samples=1000, n_features=20, n_classes=2)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
print(f"Training set shape: {X_train.shape}")
    `
  }
];

async function runTests() {
  console.log('Starting Python execution tests...\n');
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