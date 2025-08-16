import { useEffect, useState } from 'react';
import { useChatStore } from '../../store/chatStore';

/**
 * This component handles one-time migrations for the application.
 * It runs silently in the background without rendering any UI.
 */
export const ConversationProjectMigration: React.FC = () => {
  // Use state to track if migration has run during this component lifecycle
  const [hasMigrated, setHasMigrated] = useState(false);
  
  useEffect(() => {
    // Only proceed if we haven't already migrated during this component lifecycle
    if (hasMigrated) return;
    
    // Check if we've already run the conversation-project migration in a previous session
    const migrationCompleted = localStorage.getItem('conversation-project-migration-completed');
    
    if (!migrationCompleted) {
      try {
        console.log('Running conversation-project migration...');
        // Run the migration
        useChatStore.getState().migrateConversationsToProjects();
        // Mark as complete in localStorage to prevent future runs
        localStorage.setItem('conversation-project-migration-completed', 'true');
        console.log('Conversation-project migration completed');
      } catch (error) {
        console.error('Error during conversation-project migration:', error);
      }
    }
    
    // Mark as migrated in this component lifecycle to prevent additional attempts
    setHasMigrated(true);
  }, [hasMigrated]);
  
  // This component doesn't render anything
  return null;
}; 