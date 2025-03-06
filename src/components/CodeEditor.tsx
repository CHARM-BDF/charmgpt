import {
	Box,
	ToggleButton,
	ToggleButtonGroup,
	Button,
	CircularProgress,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	SelectChangeEvent,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import Editor from './Editor';
import { useArtifact } from '../contexts/useArtifact';
import { EditorMode } from '../contexts/ArtifactContext.types';
import { useState } from 'react';

type CodeLanguage = 'python' | 'r';

interface EditorProps {
	language?: CodeLanguage;
}

export default function CodeEditor() {
	const {
		mode,
		setMode,
		runArtifact,
		editorContent,
		planContent,
		isRunning,
		handleChat,
	} = useArtifact();

	const [language, setLanguage] = useState<CodeLanguage>('python');

	const handleModeChange = (
		_: React.MouseEvent<HTMLElement>,
		newMode: EditorMode
	) => {
		if (newMode !== null) {
			setMode(newMode);
		}
	};

	const handleLanguageChange = (event: SelectChangeEvent<CodeLanguage>) => {
		setLanguage(event.target.value as CodeLanguage);
	};

	const handleRun = async () => {
		if (!editorContent && !planContent) {
			console.warn('No content to run');
			return;
		}
		try {
			if (mode === 'code') {
				await runArtifact(editorContent, language);
			} else {
				await handleChat();
			}
		} catch (error) {
			console.error('Error in handleRun:', error);
		}
	};

	const handleSave = async () => {
		if (mode === 'plan') {
			try {
				// Create download
				const blob = new Blob([planContent], { type: 'text/markdown' });
				const link = document.createElement('a');
				link.href = URL.createObjectURL(blob);
				link.download = 'plan.md';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(link.href);

				// Save to server
				await fetch('/api/artifacts/plan', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ content: planContent }),
				});
			} catch (err) {
				console.error('Failed to save plan:', err);
			}
		}
	};

	return (
		<Box
			sx={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
				position: 'relative',
				flex: 1,
			}}
		>
			<Box
				sx={{
					p: 1,
					borderBottom: 1,
					borderColor: 'divider',
					display: 'flex',
					alignItems: 'center',
					minHeight: '48px',
					flexShrink: 0,
					backgroundColor: 'background.paper',
					width: '100%',
					gap: 2,
				}}
			>
				<ToggleButtonGroup
					value={mode}
					exclusive
					onChange={handleModeChange}
					size='small'
				>
					<ToggleButton value='code'>Code</ToggleButton>
					<ToggleButton value='plan'>Plan</ToggleButton>
				</ToggleButtonGroup>

				{mode === 'code' && (
					<FormControl size="small" sx={{ minWidth: 120 }}>
						<InputLabel id="language-select-label">Language</InputLabel>
						<Select
							labelId="language-select-label"
							id="language-select"
							value={language}
							label="Language"
							onChange={handleLanguageChange}
						>
							<MenuItem value="python">Python</MenuItem>
							<MenuItem value="r">R</MenuItem>
						</Select>
					</FormControl>
				)}

				<Box
					sx={{
						position: 'absolute',
						right: 8,
						display: 'flex',
						gap: 1,
						backgroundColor: 'background.paper',
						alignItems: 'center',
					}}
				>
					<Button
						variant='contained'
						size='small'
						startIcon={
							isRunning ? (
								<CircularProgress
									size={16}
									color='inherit'
								/>
							) : (
								<PlayArrowIcon />
							)
						}
						onClick={handleRun}
						disabled={isRunning}
					>
						{isRunning ? 'Running...' : 'Run'}
					</Button>
					<Button
						variant='outlined'
						size='small'
						startIcon={<SaveIcon />}
						onClick={handleSave}
						disabled={mode === 'code'} // Enable save only in plan mode
					>
						Save
					</Button>
				</Box>
			</Box>
			<Box sx={{ flex: 1, overflow: 'hidden' }}>
				<Editor language={mode === 'code' ? language : undefined} />
			</Box>
		</Box>
	);
}
