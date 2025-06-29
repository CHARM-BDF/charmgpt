import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileReferencePopup } from '../FileReferencePopup';
import { FileEntry } from '../../../types/fileManagement';

const mockFiles: FileEntry[] = [
  {
    id: '1',
    name: 'test1.txt',
    path: '/test1.txt',
    mimeType: 'text/plain',
    size: 100,
    hash: { algorithm: 'sha256', value: 'test' },
    status: 'active',
    owner: 'test',
    created: new Date(),
    modified: new Date(),
    lastAccessed: new Date(),
    tags: ['project:test'],
    metadata: {}
  },
  {
    id: '2',
    name: 'test2.md',
    path: '/test2.md',
    mimeType: 'text/markdown',
    size: 200,
    hash: { algorithm: 'sha256', value: 'test' },
    status: 'active',
    owner: 'test',
    created: new Date(),
    modified: new Date(),
    lastAccessed: new Date(),
    tags: ['project:test'],
    metadata: {}
  }
];

const mockStorageService = {
  listFiles: jest.fn().mockResolvedValue(mockFiles)
};

describe('FileReferencePopup', () => {
  const defaultProps = {
    query: '',
    position: { x: 0, y: 0 },
    onSelect: jest.fn(),
    onClose: jest.fn(),
    projectId: 'test',
    storageService: mockStorageService
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<FileReferencePopup {...defaultProps} />);
    expect(screen.getByText('Loading files...')).toBeInTheDocument();
  });

  it('renders files after loading', async () => {
    render(<FileReferencePopup {...defaultProps} />);
    
    // Wait for files to load
    const file1 = await screen.findByText('test1.txt');
    const file2 = await screen.findByText('test2.md');
    
    expect(file1).toBeInTheDocument();
    expect(file2).toBeInTheDocument();
  });

  it('filters files based on query', async () => {
    render(<FileReferencePopup {...defaultProps} query="test1" />);
    
    // Wait for files to load and filter
    const file1 = await screen.findByText('test1.txt');
    expect(file1).toBeInTheDocument();
    expect(screen.queryByText('test2.md')).not.toBeInTheDocument();
  });

  it('calls onSelect when a file is clicked', async () => {
    render(<FileReferencePopup {...defaultProps} />);
    
    // Wait for files to load
    const file1 = await screen.findByText('test1.txt');
    fireEvent.click(file1);
    
    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockFiles[0]);
  });

  it('handles keyboard navigation', async () => {
    render(<FileReferencePopup {...defaultProps} />);
    
    // Wait for files to load
    await screen.findByText('test1.txt');
    
    // Initial state - first item should be selected
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveClass('bg-blue-100');
    
    // Press down arrow
    fireEvent.keyDown(screen.getByRole('list').parentElement!, { key: 'ArrowDown' });
    expect(items[1]).toHaveClass('bg-blue-100');
    
    // Press up arrow
    fireEvent.keyDown(screen.getByRole('list').parentElement!, { key: 'ArrowUp' });
    expect(items[0]).toHaveClass('bg-blue-100');
    
    // Press enter to select
    fireEvent.keyDown(screen.getByRole('list').parentElement!, { key: 'Enter' });
    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockFiles[0]);
  });

  it('calls onClose when Escape is pressed', async () => {
    render(<FileReferencePopup {...defaultProps} />);
    
    // Wait for files to load
    await screen.findByText('test1.txt');
    
    fireEvent.keyDown(screen.getByRole('list').parentElement!, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows appropriate message when no files match query', async () => {
    render(<FileReferencePopup {...defaultProps} query="nonexistent" />);
    
    // Wait for loading to complete
    await screen.findByText('No matching files found');
  });

  it('shows appropriate message when no files are available', async () => {
    mockStorageService.listFiles.mockResolvedValueOnce([]);
    render(<FileReferencePopup {...defaultProps} />);
    
    // Wait for loading to complete
    await screen.findByText('No files available');
  });
}); 