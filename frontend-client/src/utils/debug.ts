// Debug log collector utility
export const collectDebugLogs = () => {
  // Store for collecting logs
  const logs: string[] = [];
  
  // Original console.log
  const originalLog = console.log;
  
  // Categories to track
  const categories = [
    '[STATE UPDATE',
    '[STREAM DEBUG]',
    '[FINAL DEBUG]',
    '[ID DEBUG]',
    'ChatStore:',
    'Error:'
  ];
  
  // Override console.log temporarily
  console.log = function(...args) {
    // Call original log
    originalLog.apply(console, args);
    
    // Convert args to string for checking
    const logString = args.join(' ');
    
    // Check if this log matches our categories
    if (categories.some(cat => logString.includes(cat))) {
      logs.push(logString);
    }
  };
  
  // Function to stop collecting and display results
  const stopCollecting = () => {
    // Restore original console.log
    console.log = originalLog;
    
    // Group logs by category
    const groupedLogs: Record<string, string[]> = {};
    
    logs.forEach(log => {
      const category = categories.find(cat => log.includes(cat)) || 'Other';
      if (!groupedLogs[category]) {
        groupedLogs[category] = [];
      }
      groupedLogs[category].push(log);
    });
    
    // Print grouped logs
    console.log('\n=== Debug Log Summary ===\n');
    Object.entries(groupedLogs).forEach(([category, categoryLogs]) => {
      console.log(`\n== ${category} ==\n`);
      categoryLogs.forEach(log => console.log(log));
    });
    
    // Return logs for potential saving/sharing
    return logs;
  };
  
  console.log('Debug log collection started. Call stopCollecting() to view results.');
  return stopCollecting;
};

// Usage example in console:
// const stop = collectDebugLogs();
// ... do actions that generate logs ...
// const logs = stop(); // Shows summary and returns logs 

// Expose to window for console access
declare global {
  interface Window {
    collectDebugLogs: typeof collectDebugLogs;
  }
}

if (typeof window !== 'undefined') {
  window.collectDebugLogs = collectDebugLogs;
} 