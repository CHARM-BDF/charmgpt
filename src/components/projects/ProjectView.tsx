import React, { useState, useEffect, useRef } from 'react';
import { Project, ProjectFile } from '../../store/projectStore';
import { FileEntry } from '../../types/fileManagement';
// @ts-expect-error - Heroicons type definitions mismatch
import { ArrowLeftIcon, StarIcon, EllipsisHorizontalIcon, LockClosedIcon, BookOpenIcon, PlusIcon, TrashIcon, PencilIcon, ArrowUpTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
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
    const [selectedFileContent, setSelectedFileContent] = useState<{ title: string; content: string | null } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showAddTextModal, setShowAddTextModal] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [textTitle, setTextTitle] = useState('');
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

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            
            // Define allowed MIME types
            const allowedTypes = [
                'text/plain',
                'text/markdown'
            ];
            
            // Check if file type is allowed
            if (!allowedTypes.includes(file.type)) {
                alert('Only text and markdown files are supported.');
                return;
            }

            try {
                const arrayBuffer = await file.arrayBuffer();
                const content = new Uint8Array(arrayBuffer);
                const timestamp = new Date();

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
                        timestamp: timestamp
                    },
                    version: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        branch: {
                            name: 'main',
                            parent: '',
                            created: timestamp,
                            description: 'Initial version'
                        },
                        history: [{
                            id: crypto.randomUUID(),
                            timestamp: timestamp,
                            message: 'Initial upload',
                            user: 'system',
                            branch: 'main',
                            parent: ''
                        }]
                    },
                    analysisInfo: {
                        summary: {},
                        quality: {
                            nullCount: 0,
                            duplicateCount: 0,
                            errorCount: 0,
                            completeness: 100
                        }
                    },
                    tags: [`project:${projectId}`],
                    llmNotes: ''
                };

                // Upload the file
                const fileEntry = await storageService.createFile(content, metadata);
                addFileToProject(projectId, fileEntry.id, file.name);

                // Start text extraction
                try {
                    await fetch(`/api/storage/files/${fileEntry.id}/extract`, {
                        method: 'POST'
                    });
                } catch (extractError) {
                    console.error('Text extraction failed:', extractError);
                    // Don't block the upload process if extraction fails
                }

                // Refresh file list
                const fileList = await storageService.listFiles({
                    tags: [`project:${projectId}`]
                });
                setProjectFiles(fileList);
                setShowFileManager(false);
            } catch (error) {
                console.error('Error uploading file:', error);
            }
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

    const handleAddTextContent = async () => {
        try {
            const metadata = {
                description: textTitle,
                schema: {
                    type: "json" as const,
                    format: 'text/plain',
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

            const fileEntry = await storageService.createFile(new TextEncoder().encode(textContent), metadata);
            addFileToProject(projectId, fileEntry.id, textTitle);
            const fileList = await storageService.listFiles({
                tags: [`project:${projectId}`]
            });
            setProjectFiles(fileList);
            setShowAddTextModal(false);
            setTextContent('');
            setTextTitle('');
        } catch (error) {
            console.error('Error adding text content:', error);
        }
    };

    const handleViewFile = async (file: FileEntry) => {
        try {
            // Get the raw content without updating metadata
            const content = await fetch(`/api/storage/files/${file.id}/content`).then(r => r.arrayBuffer());
            let textContent: string;
            
            // If text has been extracted, use that
            if (file.metadata?.textExtraction?.content) {
                textContent = file.metadata.textExtraction.content;
            } else {
                // Otherwise decode the raw content
                const decoder = new TextDecoder();
                textContent = decoder.decode(new Uint8Array(content));
            }
            
            setSelectedFileContent({
                title: file.name,
                content: textContent
            });
        } catch (error) {
            console.error('Error reading file:', error);
            alert('Error reading file content');
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
                                <div className="px-6 overflow-y-auto max-h-[calc(100vh-300px)]">
                                    <h2 className="text-lg font-semibold mb-3">Previous Conversations</h2>
                                    {(project.conversations || []).length === 0 ? (
                                        <p className="text-gray-500">No conversations yet. Start typing above to begin collaborating.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {(project.conversations || []).map((projectConversation) => {
                                                // Get the full conversation data from the chat store
                                                const conversation = useChatStore(state => state.conversations[projectConversation.id]);
                                                return (
                                                    <div
                                                        key={projectConversation.id}
                                                        className="p-4 border border-gray-400 dark:border-gray-500 rounded-lg hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => {
                                                            switchConversation(projectConversation.id);
                                                            onClose();
                                                        }}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm mb-1">{conversation?.metadata.name || projectConversation.title}</span>
                                                            <span className="text-xs text-gray-500">
                                                                {getRelativeTimeString(new Date(projectConversation.lastMessageAt))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowFileManager(!showFileManager)}
                                            className="p-1 hover:bg-gray-100 rounded-full"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                        </button>
                                        {showFileManager && (
                                            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            fileInputRef.current?.click();
                                                            setShowFileManager(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                                    >
                                                        <ArrowUpTrayIcon className="h-5 w-5 mr-3 text-gray-400" />
                                                        Upload from device
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowAddTextModal(true);
                                                            setShowFileManager(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                                    >
                                                        <DocumentTextIcon className="h-5 w-5 mr-3 text-gray-400" />
                                                        Add text content
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Document guidance for grant review projects */}
                                {project.type === 'grant_review' && (
                                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Expected Documents</h3>
                                        <ul className="text-xs space-y-1.5 text-blue-700 dark:text-blue-400">
                                            <li className="flex items-center">
                                                <DocumentTextIcon className="h-4 w-4 mr-2" />
                                                Request for Application (RFA)
                                            </li>
                                            <li className="flex items-center">
                                                <DocumentTextIcon className="h-4 w-4 mr-2" />
                                                Specific Aims
                                            </li>
                                            <li className="flex items-center">
                                                <DocumentTextIcon className="h-4 w-4 mr-2" />
                                                Research Proposal
                                            </li>
                                            <li className="flex items-center">
                                                <DocumentTextIcon className="h-4 w-4 mr-2" />
                                                Supplemental Information
                                            </li>
                                        </ul>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {projectFiles.map((file) => (
                                        <div key={file.id} className="flex flex-col">
                                            <div className="flex items-center justify-between group">
                                                <div 
                                                    className="flex items-center space-x-2 cursor-pointer"
                                                    onClick={() => handleViewFile(file)}
                                                >
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
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleFileUpload}
            />

            {/* File Content Modal */}
            {selectedFileContent && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {selectedFileContent.title}
                            </h2>
                            <button
                                onClick={() => setSelectedFileContent(null)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <span className="sr-only">Close</span>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                                {selectedFileContent.content || 'No content available'}
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Text Content Modal */}
            {showAddTextModal && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Add text content</h2>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={textTitle}
                                    onChange={(e) => setTextTitle(e.target.value)}
                                    placeholder="Name your content"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                                <textarea
                                    value={textContent}
                                    onChange={(e) => setTextContent(e.target.value)}
                                    placeholder="Type or paste in content..."
                                    rows={10}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setShowAddTextModal(false);
                                        setTextContent('');
                                        setTextTitle('');
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddTextContent}
                                    disabled={!textTitle || !textContent}
                                    className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add Content
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 