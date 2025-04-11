import React, { useState } from 'react';
import { Project, ProjectFile } from '../../store/projectStore';
// @ts-expect-error - Heroicons type definitions mismatch
import { ArrowLeftIcon, StarIcon, EllipsisHorizontalIcon, LockClosedIcon, BookOpenIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useChatStore, ChatState } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { ConversationState } from '../../types/chat';
import { ChatInput } from '../chat/ChatInput';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
import { FileManager } from '../files/FileManager';

interface ProjectViewProps {
    projectId: string;
    onBack: () => void;
    onClose: () => void;
}

export function ProjectView({ projectId, onBack, onClose }: ProjectViewProps) {
    const [showFileManager, setShowFileManager] = useState(false);
    const storageService = new APIStorageService();
    const project = useProjectStore((state: { projects: Project[] }) =>
        state.projects.find((p: Project) => p.id === projectId)
    );
    const addConversationToProject = useProjectStore((state: { addConversationToProject: (projectId: string, conversationId: string, title: string) => void }) =>
        state.addConversationToProject
    );
    const addFileToProject = useProjectStore((state: { addFileToProject: (projectId: string, fileId: string, name: string) => void }) =>
        state.addFileToProject
    );
    const createNewChat = useChatStore((state: ChatState) => state.startNewConversation);
    const switchConversation = useChatStore((state: ChatState) => state.switchConversation);

    const handleFileUpload = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const content = new Uint8Array(arrayBuffer);

            const metadata = {
                description: file.name,
                schema: {
                    type: "json" as const,
                    format: file.type || 'application/octet-stream',
                    encoding: 'utf-8',
                    sampleData: ''
                },
                origin: {
                    type: 'upload' as const,
                    timestamp: new Date()
                },
                tags: [`project:${projectId}`],
                llmNotes: ''
            };

            const fileEntry = await storageService.createFile(content, metadata);
            addFileToProject(projectId, fileEntry.id, file.name);
            setShowFileManager(false);
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };

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
                            <ChatInput storageService={new APIStorageService()} onBack={onClose} />
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
                                        onClick={() => {
                                            switchConversation(conversation.id);
                                            onClose();
                                        }}
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
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Project Knowledge</h2>
                            <button
                                onClick={() => setShowFileManager(true)}
                                className="p-1 hover:bg-gray-100 rounded-full"
                            >
                                <PlusIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {project?.files?.map((file: ProjectFile) => (
                            <div key={file.id} className="flex items-center space-x-2">
                                <BookOpenIcon className="h-5 w-5" />
                                <span>{file.name}</span>
                                <span className="text-sm text-gray-500">
                                    {new Date(file.timestamp).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* File Manager Modal */}
            {showFileManager && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-lg w-full max-w-4xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">File Manager</h2>
                            <button
                                onClick={() => setShowFileManager(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                Close
                            </button>
                        </div>
                        <FileManager storageService={storageService} />
                    </div>
                </div>
            )}
        </div>
    );
} 