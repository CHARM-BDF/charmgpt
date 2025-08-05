// import React, { useEffect, useState } from 'react';
// import { useMCPStore } from '../../store/mcpStore';
// import type { ResourceInfo, ToolInfo, PromptInfo } from '../../store/mcpStore';

// interface Props {
//   serverId: string;
//   onToolSelect: (tool: ToolInfo) => void;
//   onResourceSelect: (resource: ResourceInfo) => void;
//   onPromptSelect: (prompt: PromptInfo) => void;
// }

// export const MCPTools: React.FC<Props> = ({
//   serverId,
//   onToolSelect,
//   onResourceSelect,
//   onPromptSelect,
// }) => {
//   const { serverResponses, updateServerResponses, servers } = useMCPStore();
//   const [activeTab, setActiveTab] = useState<'tools' | 'resources' | 'prompts'>('tools');
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const fetchServerCapabilities = async () => {
//       setIsLoading(true);
//       setError(null);
//       try {
//         // In Phase 2, this will use MCPService to actually fetch capabilities
//         // For now, we'll simulate the fetch based on server config
//         const server = servers[serverId];
//         if (!server) {
//           throw new Error('Server not found');
//         }

//         // Simulate fetching capabilities
//         const responses = {
//           resources: server.capabilities.resources ? [
//             { name: 'Example Resource', uri: 'example://resource', description: 'Example resource description' }
//           ] : [],
//           tools: server.capabilities.tools ? [
//             { name: 'Example Tool', description: 'Example tool description', parameters: {} }
//           ] : [],
//           prompts: server.capabilities.prompts ? [
//             { name: 'Example Prompt', description: 'Example prompt description', parameters: {} }
//           ] : [],
//         };

//         updateServerResponses(serverId, responses);
//       } catch (err) {
//         setError(err instanceof Error ? err.message : 'Failed to fetch server capabilities');
//         console.error('Failed to fetch server capabilities:', err);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     if (serverId) {
//       fetchServerCapabilities();
//     }
//   }, [serverId, servers, updateServerResponses]);

//   const serverData = serverResponses[serverId] || {
//     tools: [],
//     resources: [],
//     prompts: [],
//   };

//   const renderTabButton = (tab: typeof activeTab, label: string) => (
//     <button
//       onClick={() => setActiveTab(tab)}
//       className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
//         activeTab === tab
//           ? 'bg-white text-blue-600 dark:bg-gray-800 dark:text-blue-400'
//           : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
//       }`}
//     >
//       {label}
//     </button>
//   );

//   if (isLoading) {
//     return (
//       <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
//         <div className="text-center text-gray-600 dark:text-gray-400">
//           Loading server capabilities...
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
//         <div className="text-center text-red-600 dark:text-red-400">
//           Error: {error}
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
//       <div className="max-w-3xl mx-auto px-4">
//         {/* Tabs */}
//         <div className="flex border-b border-gray-200 dark:border-gray-700">
//           {renderTabButton('tools', `Tools (${serverData.tools.length})`)}
//           {renderTabButton('resources', `Resources (${serverData.resources.length})`)}
//           {renderTabButton('prompts', `Prompts (${serverData.prompts.length})`)}
//         </div>

//         {/* Content */}
//         <div className="py-4">
//           {activeTab === 'tools' && (
//             <div className="space-y-2">
//               {serverData.tools.map((tool) => (
//                 <div
//                   key={tool.name}
//                   onClick={() => onToolSelect(tool)}
//                   className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
//                 >
//                   <h3 className="font-medium text-gray-900 dark:text-gray-100">{tool.name}</h3>
//                   {tool.description && (
//                     <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tool.description}</p>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}

//           {activeTab === 'resources' && (
//             <div className="space-y-2">
//               {serverData.resources.map((resource) => (
//                 <div
//                   key={resource.uri}
//                   onClick={() => onResourceSelect(resource)}
//                   className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
//                 >
//                   <h3 className="font-medium text-gray-900 dark:text-gray-100">{resource.name}</h3>
//                   <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{resource.uri}</p>
//                   {resource.description && (
//                     <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{resource.description}</p>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}

//           {activeTab === 'prompts' && (
//             <div className="space-y-2">
//               {serverData.prompts.map((prompt) => (
//                 <div
//                   key={prompt.name}
//                   onClick={() => onPromptSelect(prompt)}
//                   className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
//                 >
//                   <h3 className="font-medium text-gray-900 dark:text-gray-100">{prompt.name}</h3>
//                   {prompt.description && (
//                     <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{prompt.description}</p>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }; 