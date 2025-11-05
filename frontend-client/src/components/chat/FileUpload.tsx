import React, { useCallback, useState, useRef } from 'react';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
import { FileAttachment } from '@charm-mcp/shared';
import { useProjectStore } from '../../store/projectStore';

interface FileUploadProps {
  storageService: APIStorageService;
  onFilesUploaded: (files: FileAttachment[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  className?: string;
}

const DEFAULT_ACCEPTED_TYPES: string[] = []; // Accept all file types

export const FileUpload: React.FC<FileUploadProps> = ({
  storageService,
  onFilesUploaded,
  maxFiles = 5,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedProjectId } = useProjectStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const isValidFileType = (file: File): boolean => {
    // Accept all file types if acceptedTypes is empty, otherwise check the extension
    if (acceptedTypes.length === 0) {
      return true;
    }
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return acceptedTypes.includes(extension);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const generateVariableName = (fileName: string): string => {
    // Generate a Python-friendly variable name from filename
    const baseName = fileName.split('.')[0];
    return baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/^(\d)/, 'file_$1') // Prefix with 'file_' if starts with number
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    // Validate file count
    if (files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file types (only if specific types are required)
    if (acceptedTypes.length > 0) {
      const invalidFiles = files.filter(file => !isValidFileType(file));
      if (invalidFiles.length > 0) {
        alert(`Invalid file types: ${invalidFiles.map(f => f.name).join(', ')}\nAccepted types: ${acceptedTypes.join(', ')}`);
        return;
      }
    }

    setIsUploading(true);
    const uploadedFiles: FileAttachment[] = [];

    try {
      for (const file of files) {
        console.log(`Uploading file: ${file.name}`);
        
        // Update progress
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        // Convert file to Uint8Array
        const arrayBuffer = await file.arrayBuffer();
        const content = new Uint8Array(arrayBuffer);
        
        // Create metadata with project tag if project is selected
        const tags = ['uploaded', 'chat'];
        if (selectedProjectId) {
          tags.push(`project:${selectedProjectId}`);
        }
        
        const metadata = {
          description: file.name,
          schema: {
            type: 'tabular' as const,
            format: file.type || 'application/octet-stream',
            encoding: 'utf-8',
            sampleData: ''
          },
          tags
        };

        // Upload file using createFile method
        const fileEntry = await storageService.createFile(content, metadata);
        const fileId = fileEntry.id;
        
        // Update progress to complete
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        
        // Create file attachment
        const attachment: FileAttachment = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          varName: generateVariableName(file.name)
        };
        
        uploadedFiles.push(attachment);
        console.log(`File uploaded successfully: ${file.name} -> ${fileId}`);
      }

      // Notify parent component
      onFilesUploaded(uploadedFiles);
      
    } catch (error) {
      console.error('File upload error:', error);
      alert('File upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.length > 0 ? acceptedTypes.join(',') : '*/*'}
        onChange={handleFileInput}
        className="hidden"
      />
      
      {/* Upload button */}
      <button
        type="button"
        onClick={openFileDialog}
        disabled={isUploading}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Upload files"
      >
        {isUploading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        )}
      </button>

      {/* Drag and drop overlay */}
      {isDragOver && (
        <div
          className="fixed inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-50"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg border-2 border-dashed border-blue-500">
            <div className="text-center">
              <svg className="w-12 h-12 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Drop files here to upload
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Supported: {acceptedTypes.join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Uploading files...
          </div>
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="mb-2 last:mb-0">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span className="truncate">{fileName}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
