import React from 'react';
import { ChatInterface } from './components/chat/ChatInterface';
// Import commented out until we fix the infinite loop issue
// import { ConversationProjectMigration } from './components/migrations/ConversationProjectMigration';

function App() {
  return (
    <div className="h-screen">
      {/* Migration component temporarily removed to fix infinite loop */}
      {/* <ConversationProjectMigration /> */}
      <ChatInterface />
    </div>
  );
}

export default App;
