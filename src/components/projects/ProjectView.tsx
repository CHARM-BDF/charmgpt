import React, { useEffect } from 'react';
import { Project } from '../../store/projectStore';
// @ts-expect-error - Heroicons type definitions mismatch
import { ArrowLeftIcon, StarIcon, EllipsisHorizontalIcon, LockClosedIcon, BookOpenIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useChatStore, ChatState } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { ConversationState } from '../../types/chat';
import { ChatInput } from '../chat/ChatInput';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';

interface ProjectViewProps {
  projectId: string;
  onBack: () => void;
}

export function ProjectView({ projectId, onBack }: ProjectViewProps) {
  const project = useProjectStore((state: { projects: Project[] }) => 
    state.projects.find((p: Project) => p.id === projectId)
  );
  const addConversationToProject = useProjectStore((state: { addConversationToProject: (projectId: string, conversationId: string, title: string) => void }) => 
    state.addConversationToProject
  );
  const createNewChat = useChatStore((state: ChatState) => state.startNewConversation);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">{project.name}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <StarIcon className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <EllipsisHorizontalIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Project info */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-2">
              <LockClosedIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">Private project</span>
            </div>
            <p className="text-gray-600">{project.description || 'No description provided.'}</p>
          </div>

          {/* Chat Input and Conversations */}
          <div className="mb-8">
            <div className="mb-4">
              <ChatInput storageService={new APIStorageService()} />
            </div>
            <h2 className="text-lg font-semibold mb-4">Previous Conversations</h2>
            {(project.conversations || []).length === 0 ? (
              <p className="text-gray-500">No conversations yet. Start typing above to begin collaborating.</p>
            ) : (
              <div className="space-y-2">
                {(project.conversations || []).map((conversation) => (
                  <div
                    key={conversation.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{conversation.title}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(conversation.lastMessageAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-80 border-l p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <BookOpenIcon className="w-5 h-5 mr-2" />
              Project knowledge
            </h2>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-500">No knowledge has been added to this project yet.</p>
        </div>
      </div>
    </div>
  );
} 