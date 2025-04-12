import React, { useState, useEffect } from 'react';
import { Project, ProjectFile } from '../../store/projectStore';
import { FileEntry } from '../../types/fileManagement';
// @ts-expect-error - Heroicons type definitions mismatch
import { ArrowLeftIcon, StarIcon, EllipsisHorizontalIcon, LockClosedIcon, BookOpenIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useChatStore, ChatState } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { ConversationState } from '../../types/chat';
import { ProjectChatInput } from './ProjectChatInput';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
import { FileManager } from '../files/FileManager';
import { getRelativeTimeString } from '../../utils/dateUtils';

interface ProjectViewProps {
    projectId: string;
    onBack: () => void;
    onClose: () => void;
}

export function ProjectView({ projectId, onBack, onClose }: ProjectViewProps) {
    const [showFileManager, setShowFileManager] = useState(false);
    const [projectFiles, setProjectFiles] = useState<FileEntry[]>([]);
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editingFileName, setEditingFileName] = useState('');
    const storageService = new APIStorageService();
    const project = useProjectStore((state) => 
        state.projects.find((p) => p.id === projectId)
    );
    const addConversationToProject = useProjectStore((state) => state.addConversationToProject);
    const addFileToProject = useProjectStore((state) => state.addFileToProject);
    const createNewChat = useChatStore((state: ChatState) => state.startNewConversation);
    const switchConversation = useChatStore((state: ChatState) => state.switchConversation);

    // Load files when component mounts or when showFileManager changes
    useEffect(() => {
        const loadFiles = async () => {
            try {
                const fileList = await storageService.listFiles({
                    tags: [`project:${projectId}`]
                });
                setProjectFiles(fileList);
            } catch (error) {
                console.error('Error loading files:', error);
            }
        };
        loadFiles();
    }, [projectId, showFileManager]);

    // Debug log to see project data
    console.log('Project data:', { projectId, project, files: project?.files });

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

    const handleDeleteFile = async (fileId: string) => {
        if (window.confirm('Are you sure you want to delete this file?')) {
            try {
                await storageService.deleteFile(fileId);
                setProjectFiles(files => files.filter(f => f.id !== fileId));
            } catch (error) {
                console.error('Error deleting file:', error);
            }
        }
    };

    const handleRenameFile = async (fileId: string) => {
        const file = projectFiles.find(f => f.id === fileId);
        if (file) {
            setEditingFileId(fileId);
            setEditingFileName(file.name);
        }
    };

    const handleSaveFileName = async (fileId: string) => {
        try {
            const metadata = await storageService.getMetadata(fileId);
            metadata.description = editingFileName;
            await storageService.updateMetadata(fileId, metadata);
            setProjectFiles(files => files.map(f => 
                f.id === fileId ? { ...f, name: editingFileName } : f
            ));
            setEditingFileId(null);
        } catch (error) {
            console.error('Error renaming file:', error);
        }
    };

    if (!project) {
        return <div>Project not found</div>;
    }

    return (
        <div className="fixed inset-0 flex flex-col bg-gray-100 dark:bg-gray-900 z-50">
            <div className="px-6 pt-4">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
                {/* Main content area with Project Knowledge sidebar */}
                <div className="flex-1 flex justify-center">
                    {/* Container using golden ratio of screen width (61.8%) */}
                    <div className="w-[61.8%] flex">
                        {/* Main content using golden ratio of container (61.8%) */}
                        <div className="w-[61.8%] px-8 pt-6">
                            {/* Project info */}
                            <div className="mb-6">
                                <h1 className="font-[var(--font-copernicus),ui-serif,Georgia,Cambria,'Times New Roman',Times,serif] text-2xl font-bold leading-tight tracking-tight text-[hsl(var(--text-200))] mb-4">{project.name}</h1>
                                <div className="flex items-center space-x-2 mb-2">
                                    <LockClosedIcon className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-500">Private project</span>
                                </div>
                                <p className="text-gray-600">{project.description || 'No description provided.'}</p>
                            </div>

                            {/* Chat Input and Conversations */}
                            <div className="mb-6">
                                <div className="mb-4">
                                    <ProjectChatInput storageService={storageService} onBack={onClose} />
                                </div>
                                <div className="px-6">
                                    <h2 className="text-lg font-semibold mb-3">Previous Conversations</h2>
                                    {(project.conversations || []).length === 0 ? (
                                        <p className="text-gray-500">No conversations yet. Start typing above to begin collaborating.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {(project.conversations || []).map((conversation) => (
                                                <div
                                                    key={conversation.id}
                                                    className="p-3 border border-gray-400 dark:border-gray-500 rounded-lg hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => {
                                                        switchConversation(conversation.id);
                                                        onClose();
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-sm">{conversation.title}</span>
                                                        <span className="text-xs text-gray-500">
                                                            {getRelativeTimeString(new Date(conversation.lastMessageAt))}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right sidebar using remaining space (38.2%) */}
                        <div className="w-[38.2%] border-l overflow-y-auto pt-6">
                            <div className="px-4 py-3 border border-gray-400 dark:border-gray-500 rounded-lg m-3">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-semibold">Project Knowledge</h2>
                                    <button
                                        onClick={() => setShowFileManager(true)}
                                        className="p-1 hover:bg-gray-100 rounded-full"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {projectFiles.map((file) => (
                                        <div key={file.id} className="flex flex-col">
                                            <div className="flex items-center justify-between group">
                                                <div className="flex items-center space-x-2">
                                                    <BookOpenIcon className="h-5 w-5 text-gray-500" />
                                                    {editingFileId === file.id ? (
                                                        <input
                                                            type="text"
                                                            value={editingFileName}
                                                            onChange={(e) => setEditingFileName(e.target.value)}
                                                            onBlur={() => handleSaveFileName(file.id)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleSaveFileName(file.id);
                                                                } else if (e.key === 'Escape') {
                                                                    setEditingFileId(null);
                                                                }
                                                            }}
                                                            className="text-sm border rounded px-1"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="text-sm">{file.name}</span>
                                                    )}
                                                </div>
                                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleRenameFile(file.id)}
                                                        className="p-1 hover:bg-gray-100 rounded"
                                                    >
                                                        <PencilIcon className="h-3 w-3 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteFile(file.id)}
                                                        className="p-1 hover:bg-gray-100 rounded"
                                                    >
                                                        <TrashIcon className="h-3 w-3 text-gray-500" />
                                                    </button>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-gray-500 ml-6">
                                                {new Date(file.created).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* File Manager Modal */}
            {showFileManager && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-lg w-full max-w-4xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">Add File</h2>
                            <button
                                onClick={() => setShowFileManager(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                Close
                            </button>
                        </div>
                        <FileManager 
                            storageService={storageService} 
                            projectId={projectId}
                        />
                    </div>
                </div>
            )}
        </div>
    );
} 