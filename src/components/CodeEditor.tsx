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
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import Editor from './Editor';
import { useArtifact } from '../contexts/useArtifact';
import { EditorMode } from '../contexts/ArtifactContext.types';
import { useState, useEffect } from 'react';

type CodeLanguage = 'python' | 'r';

export default function CodeEditor() {
	const {
		mode,
		setMode,
		runArtifact,
		editorContent,
		planContent,
		isRunning,
		handleChat,
		activeArtifact,
		addArtifact,
	} = useArtifact();

	const [language, setLanguage] = useState<CodeLanguage>('python');
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [artifactName, setArtifactName] = useState('');

	// Update language when active artifact changes
	useEffect(() => {
		if (activeArtifact?.language) {
			setLanguage(activeArtifact.language);
		}
	}, [activeArtifact]);

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
		if (mode === 'code') {
			await runArtifact(editorContent, language);
		} else {
			// In plan mode, send to chat
			await handleChat(planContent);
		}
	};

	const handleSave = () => {
		setSaveDialogOpen(true);
		// Default name based on first line or content preview
		const content = mode === 'code' ? editorContent : planContent;
		const firstLine = content.split('\n')[0].trim();
		const defaultName = firstLine 
			? firstLine.substring(0, 30) + (firstLine.length > 30 ? '...' : '')
			: `${mode === 'code' ? 'Code' : 'Plan'} ${new Date().toLocaleTimeString()}`;
		setArtifactName(defaultName);
	};

	const handleSaveConfirm = async () => {
		if (!artifactName) return;

		try {
			if (mode === 'code') {
				// Save as code artifact
				await addArtifact({
					type: 'code',
					name: artifactName,
					code: editorContent,
					output: '',
					source: 'user',
					language,
					var2val: {},
					var2line: {},
					var2line_end: {},
					pinned: true,
				});
			} else {
				// Save as plan artifact
				// Use a type assertion to work around TypeScript limitations
				const planArtifact = {
					type: 'plan',
					name: artifactName,
					content: planContent,
					source: 'user',
					var2val: {},
					var2line: {},
					var2line_end: {},
					pinned: true,
				};
				// @ts-expect-error - TypeScript doesn't understand plan artifacts yet
				await addArtifact(planArtifact);
			}

			setSaveDialogOpen(false);
			setArtifactName('');
		} catch (error) {
			console.error('Failed to save artifact:', error);
			// You could add error handling UI here
		}
	};

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			<Box
				sx={{
					p: 1,
					display: 'flex',
					justifyContent: 'space-between',
					borderBottom: 1,
					borderColor: 'divider',
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
					<ToggleButtonGroup
						value={mode}
						exclusive
						onChange={handleModeChange}
						aria-label="editor mode"
						size="small"
					>
						<ToggleButton value="plan">Plan</ToggleButton>
						<ToggleButton value="code">Code</ToggleButton>
					</ToggleButtonGroup>

					{mode === 'code' && (
						<FormControl size="small" sx={{ minWidth: 120 }}>
							<InputLabel id="language-select-label">Language</InputLabel>
							<Select
								labelId="language-select-label"
								value={language}
								label="Language"
								onChange={handleLanguageChange}
							>
								<MenuItem value="python">Python</MenuItem>
								<MenuItem value="r">R</MenuItem>
							</Select>
						</FormControl>
					)}
				</Box>

				<Box sx={{ display: 'flex', gap: 1 }}>
					<Button
						variant="contained"
						startIcon={<SaveIcon />}
						onClick={handleSave}
					>
						Save
					</Button>
					<Button
						variant="contained"
						color="primary"
						startIcon={
							isRunning ? (
								<CircularProgress size={20} color="inherit" />
							) : (
								<PlayArrowIcon />
							)
						}
						onClick={handleRun}
						disabled={isRunning}
					>
						Run
					</Button>
				</Box>
			</Box>

			<Box sx={{ flex: 1 }}>
				<Editor language={language} />
			</Box>

			<Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
				<DialogTitle>Save {mode === 'code' ? 'Code' : 'Plan'}</DialogTitle>
				<DialogContent>
					<TextField
						autoFocus
						margin="dense"
						label="Name"
						fullWidth
						value={artifactName}
						onChange={(e) => setArtifactName(e.target.value)}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
					<Button onClick={handleSaveConfirm} disabled={!artifactName}>
						Save
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
