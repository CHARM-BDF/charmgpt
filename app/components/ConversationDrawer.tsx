// import React, { useEffect, useState } from 'react';
// import { useChatStore } from '../stores/chatStore';
// import { useProjectStore } from '../stores/projectStore';

// export default function ConversationDrawer() {
//   const chatStore = useChatStore();
//   const projectStore = useProjectStore();
//   const unassociatedConversations = chatStore.getUnassociatedConversations();
//   const conversations = chatStore.conversations;
//   const currentConversationId = chatStore.currentConversationId;

//   const handleConversationClick = (id: string) => {
//     chatStore.switchConversation(id);
//   };

//   return (
//     <div className="flex flex-col h-full">
//       <div className="flex-grow overflow-y-auto">
//         {/* Unassociated Conversations */}
//         <div className="p-2">
//           <div className="text-sm font-semibold text-gray-500 mb-2">Unassociated Conversations</div>
//           {unassociatedConversations.map((id) => (
//             <div
//               key={id}
//               className={`p-2 rounded cursor-pointer hover:bg-gray-100 ${
//                 currentConversationId === id ? 'bg-gray-100' : ''
//               }`}
//               onClick={() => handleConversationClick(id)}
//             >
//               <div className="text-sm truncate">{conversations[id]?.name || 'Untitled'}</div>
//             </div>
//           ))}
//         </div>

//         {/* Projects and their conversations */}
//         {projectStore.projects.map((project) => (
//           <div key={project.id} className="p-2">
//             <div className="text-sm font-semibold text-gray-500 mb-2">{project.name}</div>
//             {project.conversations.map((conv) => (
//               <div
//                 key={conv.id}
//                 className={`p-2 rounded cursor-pointer hover:bg-gray-100 ${
//                   currentConversationId === conv.id ? 'bg-gray-100' : ''
//                 }`}
//                 onClick={() => handleConversationClick(conv.id)}
//               >
//                 <div className="text-sm truncate">
//                   {conversations[conv.id]?.name || 'Untitled'}
//                 </div>
//               </div>
//             ))}
//           </div>
//         ))}
//       </div>

//       {/* New Conversation Button */}
//       <div className="p-2 border-t">
//         <button
//           className="w-full p-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
//           onClick={() => {
//             const newId = chatStore.startNewConversation();
//             chatStore.switchConversation(newId);
//           }}
//         >
//           New Conversation
//         </button>
//       </div>
//     </div>
//   );
// } 