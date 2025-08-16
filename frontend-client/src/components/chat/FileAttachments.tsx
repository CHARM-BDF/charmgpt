import React from 'react';
import { FileAttachment } from '@charm-mcp/shared';

interface FileAttachmentsProps {
  attachments: FileAttachment[];
  onRemove?: (fileId: string) => void;
  onEditVarName?: (fileId: string, newVarName: string) => void;
  editable?: boolean;
  showVarNames?: boolean;
  className?: string;
}

const getFileTypeIcon = (type: string, name: string) => {
  const extension = name.split('.').pop()?.toLowerCase();
  
  if (extension === 'csv' || type.includes('csv')) {
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v10H4V5z"/>
        <path d="M6 7h2v2H6V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zM6 11h2v2H6v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
      </svg>
    );
  }
  
  if (extension === 'json' || type.includes('json')) {
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v10H4V5z"/>
        <path d="M7 8v4l1-1v-2l-1-1zm6 0l-1 1v2l1 1V8z"/>
      </svg>
    );
  }
  
  if (extension === 'xlsx' || extension === 'xls' || type.includes('excel') || type.includes('spreadsheet')) {
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v10H4V5z"/>
        <path d="M6 7l2 2-2 2v-1H5V8h1V7zm8 0v1h1v2h-1v1l-2-2 2-2z"/>
      </svg>
    );
  }
  
  if (extension === 'txt' || type.includes('text')) {
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
      </svg>
    );
  }
  
  // Default file icon
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
    </svg>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileAttachments: React.FC<FileAttachmentsProps> = ({
  attachments,
  onRemove,
  onEditVarName,
  editable = false,
  showVarNames = true,
  className = ''
}) => {
  const [editingVarName, setEditingVarName] = React.useState<string | null>(null);
  const [tempVarName, setTempVarName] = React.useState('');

  const handleVarNameEdit = (fileId: string, currentVarName: string) => {
    setEditingVarName(fileId);
    setTempVarName(currentVarName || '');
  };

  const handleVarNameSave = (fileId: string) => {
    if (onEditVarName && tempVarName.trim()) {
      onEditVarName(fileId, tempVarName.trim());
    }
    setEditingVarName(null);
    setTempVarName('');
  };

  const handleVarNameCancel = () => {
    setEditingVarName(null);
    setTempVarName('');
  };

  if (attachments.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm border border-gray-200 dark:border-gray-600"
        >
          {/* File icon */}
          <div className="text-gray-500 dark:text-gray-400 mr-2">
            {getFileTypeIcon(attachment.type, attachment.name)}
          </div>
          
          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {attachment.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(attachment.size)}
            </div>
            
            {/* Variable name */}
            {showVarNames && attachment.varName && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {editingVarName === attachment.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempVarName}
                      onChange={(e) => setTempVarName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleVarNameSave(attachment.id);
                        if (e.key === 'Escape') handleVarNameCancel();
                      }}
                      className="w-20 px-1 py-0 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                      autoFocus
                    />
                    <button
                      onClick={() => handleVarNameSave(attachment.id)}
                      className="text-green-600 hover:text-green-700"
                      title="Save"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleVarNameCancel}
                      className="text-red-600 hover:text-red-700"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span
                    className={editable ? 'cursor-pointer hover:underline' : ''}
                    onClick={editable ? () => handleVarNameEdit(attachment.id, attachment.varName || '') : undefined}
                    title={editable ? 'Click to edit variable name' : `Available as: ${attachment.varName}`}
                  >
                    {attachment.varName}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Remove button */}
          {editable && onRemove && (
            <button
              onClick={() => onRemove(attachment.id)}
              className="ml-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
              title="Remove file"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
