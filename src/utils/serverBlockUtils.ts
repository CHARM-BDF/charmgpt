/**
 * Utilities for managing server blocks in localStorage
 */

/**
 * Clear all server block entries from localStorage
 * This is useful for resetting the system if there are persistent issues
 */
export const clearAllServerBlocks = () => {
  console.log('🧹 Clearing all server block entries from localStorage...');
  
  // Get all keys in localStorage that match the server-*-blocked pattern
  const serverBlockKeys = Object.keys(localStorage).filter(key => 
    key.startsWith('server-') && key.endsWith('-blocked')
  );
  
  console.log(`Found ${serverBlockKeys.length} server block entries to clear:`, serverBlockKeys);
  
  // Remove each key
  serverBlockKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Removed: ${key}`);
  });
  
  console.log('✅ All server block entries cleared from localStorage');
};

/**
 * List all server block entries in localStorage
 * Returns an object mapping server names to their blocked status
 */
export const listServerBlocks = () => {
  console.log('📋 Listing all server block entries in localStorage...');
  
  // Get all keys in localStorage that match the server-*-blocked pattern
  const serverBlockKeys = Object.keys(localStorage).filter(key => 
    key.startsWith('server-') && key.endsWith('-blocked')
  );
  
  // Create a mapping of server name to blocked status
  const serverBlocks: Record<string, boolean> = {};
  
  serverBlockKeys.forEach(key => {
    const serverName = key.replace('server-', '').replace('-blocked', '');
    const isBlocked = localStorage.getItem(key) === 'true';
    serverBlocks[serverName] = isBlocked;
  });
  
  console.log('Server blocks:', serverBlocks);
  return serverBlocks;
};

/**
 * Set a server's blocked status manually
 */
export const setServerBlock = (serverName: string, isBlocked: boolean) => {
  console.log(`${isBlocked ? '🔒' : '🔓'} Setting server "${serverName}" blocked status to: ${isBlocked}`);
  
  if (isBlocked) {
    localStorage.setItem(`server-${serverName}-blocked`, 'true');
  } else {
    localStorage.removeItem(`server-${serverName}-blocked`);
  }
  
  console.log(`✅ Server "${serverName}" blocked status updated`);
}; 