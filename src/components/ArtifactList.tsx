import { useRef } from 'react';
import {
	Box,
	List,
	ListItem,
	ListItemButton,
	ListItemText,
	IconButton,
	ToggleButtonGroup,
	ToggleButton,
	Tooltip,
	Typography,
} from '@mui/material';
import { useArtifact } from '../contexts/useArtifact';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import {
	ViewMode,
	ArtifactType,
	getDisplayName,
	hasData,
} from '../contexts/ArtifactContext.types';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';

interface UploadResponse {
	filepath: string;
	filename: string;
	mimetype: string;
	size: number;
	viewMode: ViewMode;
}

interface ArtifactListProps {
	uploadRefCallback?: (node: HTMLInputElement | null) => void;
}

export default function ArtifactList({
	uploadRefCallback,
}: ArtifactListProps = {}) {
	const {
		artifacts,
		addArtifact,
		activeArtifact,
		setActiveArtifact: selectArtifact,
		viewMode,
		setViewMode,
		togglePin,
	} = useArtifact();
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const handleUploadClick = () => {
		fileInputRef.current?.click();
	};

	const handleViewModeChange = (
		_: React.MouseEvent<HTMLElement>,
		newMode: ViewMode
	) => {
		if (newMode !== null) {
			setViewMode(newMode);
		}
	};

	const handleDownload = async () => {
		if (!activeArtifact?.dataFile) return;

		try {
			const fullPath = activeArtifact.dataFile.startsWith('/api/data/')
				? activeArtifact.dataFile.substring('/api/data/'.length)
				: activeArtifact.dataFile;

			// Get the original filename from the path
			const serverFilename = fullPath.split('/').pop();
			if (!serverFilename) {
				throw new Error('Invalid file path');
			}

			const response = await fetch(`/api/data/${serverFilename}`);
			if (!response.ok) {
				throw new Error('Failed to download file');
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = getDisplayName(activeArtifact);
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (err) {
			console.error('Download failed:', err);
		}
	};

	const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			if (
				file.type === 'application/pdf' ||
				file.type ===
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
			) {
				const formData = new FormData();
				formData.append('file', file);

				const response = await fetch(
					'/api/service/summarize-document',
					{
						method: 'POST',
						body: formData,
					}
				);

				if (!response.ok) {
					throw new Error('Failed to process document');
				}

				const data = await response.json();

				// Create artifact for the processing document
				const now = Date.now();
				const newArtifact = {
					id: now,
					type: 'data' as ArtifactType,
					name: `Processing: ${file.name}`,
					output: 'Document is being processed...',
					timestamp: now,
					source: 'upload',
					processingJob: {
						jobId: data.conversionJobId,
						status: 'processing' as const,
						type: 'conversion' as const,
					},
					dataFiles: {},
					lineNumbers: {},
				};

				addArtifact(newArtifact);
				selectArtifact(newArtifact);
			} else {
				// Handle other file types as before
				const formData = new FormData();
				formData.append('file', file);

				const response = await fetch('/api/upload', {
					method: 'POST',
					body: formData,
				});

				if (!response.ok) {
					throw new Error('Upload failed');
				}

				const data: UploadResponse = await response.json();
				const now = Date.now();

				const newArtifact = {
					id: now,
					type: 'upload' as ArtifactType,
					name: data.filename,
					dataFile: data.filepath,
					output: `Uploaded file: ${data.filename}\nSize: ${data.size} bytes\nType: ${data.mimetype}`,
					timestamp: now,
					pinned: true,
				};

				addArtifact(newArtifact);
				selectArtifact(newArtifact);
			}
		} catch (error) {
			console.error('Upload failed:', error);
		}

		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	return (
		<Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			<Box
				sx={{
					p: 1,
					borderBottom: { xs: 0, sm: 1 },
					borderColor: 'divider',
					display: 'flex',
					justifyContent: 'flex-end',
				}}
			>
				<ToggleButtonGroup
					value={viewMode}
					exclusive
					onChange={handleViewModeChange}
					size='small'
				>
					{activeArtifact && activeArtifact.plotFile && (
						<ToggleButton value='plot'>Plot</ToggleButton>
					)}
					{activeArtifact && hasData(activeArtifact) && (
						<ToggleButton value='data'>Data</ToggleButton>
					)}
					{activeArtifact && activeArtifact.output && (
						<ToggleButton value='output'>Output</ToggleButton>
					)}
					{activeArtifact && activeArtifact.dataFile && (
						<Tooltip title='Download data'>
							<IconButton
								onClick={handleDownload}
								size='small'
							>
								<DownloadIcon />
							</IconButton>
						</Tooltip>
					)}
					<Box sx={{ display: { xs: 'none', sm: 'block' } }}>
						<Tooltip title='Upload file'>
							<IconButton
								size='small'
								onClick={handleUploadClick}
							>
								<UploadIcon />
							</IconButton>
						</Tooltip>
					</Box>
					<input
						type='file'
						ref={(node) => {
							if (node) fileInputRef.current = node;
							if (uploadRefCallback) uploadRefCallback(node);
						}}
						onChange={handleUpload}
						style={{ display: 'none' }}
						accept='.py,.ipynb,.csv,.json,.txt,.md'
					/>
				</ToggleButtonGroup>
			</Box>

			{artifacts.length == 0 ? (
				<Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
					<Typography
						sx={{ fontStyle: 'italic', color: 'text.disabled' }}
					>
						(artifact list)
					</Typography>
				</Box>
			) : (
				<List sx={{ flex: 1, overflow: 'auto' }}>
					{[...artifacts]
						.sort((a, b) => b.timestamp - a.timestamp)
						.map((artifact) => (
						<ListItem
							key={`artifact-${artifact.id}`}
							disablePadding
							secondaryAction={
								<IconButton
									edge='end'
									onClick={() => togglePin(artifact.id)}
								>
									{artifact.pinned ? (
										<PushPinIcon />
									) : (
										<PushPinOutlinedIcon />
									)}
								</IconButton>
							}
						>
							<ListItemButton
								selected={activeArtifact?.id === artifact.id}
								onClick={() => selectArtifact(artifact)}
							>
								<ListItemText
									primary={artifact.name}
									secondary={new Date(
										artifact.timestamp
									).toLocaleString()}
								/>
							</ListItemButton>
						</ListItem>
					))}
				</List>
			)}
		</Box>
	);
}
