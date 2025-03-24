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
	IconButton,
	Menu,
	useMediaQuery,
	useTheme,
	FormControlLabel,
	Checkbox,
	Link,
	Snackbar,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import MenuIcon from '@mui/icons-material/Menu';
import Editor from './Editor';
import { useArtifact } from '../contexts/useArtifact';
import { EditorMode, CodeLanguage } from '../contexts/ArtifactContext.types';
import { useState, useEffect, useRef } from 'react';
import { DepsPanel } from '../components/DepsPanel';
import WorkflowPane, { WorkflowPaneHandle } from '../components/WorkflowPane';

export default function CodeEditor() {
	const {
		mode,
		setMode,
		runArtifact,
		editorContent,
		planContent,
		isRunning,
		setIsRunning,
		handleChat,
		activeArtifact,
		addArtifact,
	} = useArtifact();

	const [language, setLanguage] = useState<CodeLanguage>('python');
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [artifactName, setArtifactName] = useState('');
	const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
	const [createPermalink, setCreatePermalink] = useState(false);
	const [permalinkUrl, setPermalinkUrl] = useState<string | null>(null);
	
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
	
	// Create a ref for the WorkflowPane component
	const workflowPaneRef = useRef<WorkflowPaneHandle>(null);
	
	const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
		setMenuAnchorEl(event.currentTarget);
	};
	
	const handleMenuClose = () => {
		setMenuAnchorEl(null);
	};

	// Update language when active artifact changes
	useEffect(() => {
		if (activeArtifact?.language) {
			setLanguage(activeArtifact.language);
		}
	}, [activeArtifact]);

	const handleModeChange = async (
		_: React.MouseEvent<HTMLElement>,
		newMode: EditorMode
	) => {
		if (newMode !== null && newMode !== mode) {
			// If switching from code to plan, save the code content
			if (mode === 'code' && newMode === 'plan' && activeArtifact && editorContent) {
				// Only update if the code has changed
				if (activeArtifact.code !== editorContent) {
					// Update the active artifact with the current code
					const updatedArtifact = {
						...activeArtifact,
						code: editorContent
					};
					
					try {
						// Use the addArtifact function to update the artifact
						await addArtifact({
							...updatedArtifact,
							pinned: true
						});
					} catch (err) {
						console.error('Failed to save code before switching to plan mode:', err);
					}
				}
			}
			
			// Set the new mode
			setMode(newMode);
		}
	};

	const handleLanguageChange = (event: SelectChangeEvent<CodeLanguage>) => {
		setLanguage(event.target.value as CodeLanguage);
	};

	const handleRun = async () => {
		if (mode === 'code') {
			await runArtifact(editorContent, language);
		} else if (mode === 'plan') {
			// In plan mode, send to chat
			// Set isRunning manually since we're not using runArtifact yet
			setIsRunning(true);
			try {
				await handleChat(planContent);
			} finally {
				setIsRunning(false);
			}
		} else if (mode === 'flow') {
			// In workflow mode, start the workflow
			if (workflowPaneRef.current) {
				workflowPaneRef.current.handleStart();
			}
		}
	};

	const handleSave = () => {
		// If in workflow mode, use the workflow's save function
		if (mode === 'flow') {
			if (workflowPaneRef.current) {
				workflowPaneRef.current.handleSave();
			}
			return;
		}
		
		// Regular save dialog for other modes
		setSaveDialogOpen(true);
		setCreatePermalink(false);
		setPermalinkUrl(null);
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

			// If creating permalink, save current state
			if (createPermalink) {
				const response = await fetch(`/api/artifacts/permalinks/${artifactName}`, {
					method: 'POST'
				});
				
				if (response.ok) {
					// Set the permalink URL for display
					const url = new URL(window.location.href);
					url.pathname = `/link/${artifactName}`;
					setPermalinkUrl(url.toString());
				}
			} else if (mode === 'code') {
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
			console.error('Failed to save:', error);
		}
	};

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			<Box
				sx={{
					p: 1,
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					borderBottom: 1,
					borderColor: 'divider',
					position: 'relative',
				}}
			>
				{/* Left side - Toggle buttons */}
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
					<ToggleButtonGroup
						value={mode}
						exclusive
						onChange={handleModeChange}
						aria-label="editor mode"
						size="small"
					>
						<ToggleButton value="flow">Flow</ToggleButton>
						<ToggleButton value="plan">Plan</ToggleButton>
						<ToggleButton value="code">Code</ToggleButton>
						<ToggleButton value="deps">Deps</ToggleButton>
					</ToggleButtonGroup>

					{/* Language selector - visible on desktop, hidden on mobile */}
					{mode === 'code' && !isMobile && (
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

				{/* Right side - Save and Run buttons on desktop, Run button and Hamburger menu on mobile */}
				<Box sx={{ display: 'flex', gap: 1 }}>
					{!isMobile ? (
						<>
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
						</>
					) : (
						<>
							<Button
								variant="contained"
								color="primary"
								size="small"
								onClick={handleRun}
								disabled={isRunning}
								startIcon={
									isRunning ? (
										<CircularProgress size={20} color="inherit" />
									) : (
										<PlayArrowIcon />
									)
								}
								sx={{ 
									height: '36px', // Increased height to match ToggleButtonGroup
									textTransform: 'none',
									minWidth: 'unset', // Reduce minimum width
									padding: '6px 12px' // Match padding of toggle buttons
								}}
							>
								{isRunning ? 'Running...' : 'Run'}
							</Button>
							<IconButton
								edge="end"
								color="inherit"
								aria-label="menu"
								onClick={handleMenuOpen}
							>
								<MenuIcon />
							</IconButton>
						</>
					)}
				</Box>
			</Box>

			{/* Mobile menu */}
			<Menu
				anchorEl={menuAnchorEl}
				open={Boolean(menuAnchorEl)}
				onClose={handleMenuClose}
				anchorOrigin={{
					vertical: 'bottom',
					horizontal: 'right',
				}}
				transformOrigin={{
					vertical: 'top',
					horizontal: 'right',
				}}
			>
				{mode === 'code' && (
					<MenuItem>
						<FormControl size="small" sx={{ minWidth: 120 }}>
							<InputLabel id="mobile-language-select-label">Language</InputLabel>
							<Select
								labelId="mobile-language-select-label"
								value={language}
								label="Language"
								onChange={handleLanguageChange}
							>
								<MenuItem value="python">Python</MenuItem>
								<MenuItem value="r">R</MenuItem>
							</Select>
						</FormControl>
					</MenuItem>
				)}
				<MenuItem onClick={() => { handleSave(); handleMenuClose(); }}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<SaveIcon fontSize="small" />
						Save
					</Box>
				</MenuItem>
			</Menu>

			<Box sx={{ flex: 1 }}>
				{mode === 'deps' ? (
					<DepsPanel artifact={activeArtifact} />
				) :
				mode === 'flow' ? (
					<WorkflowPane ref={workflowPaneRef} />
				) :
				(
					<Editor language={language} />
				)}
			</Box>

			<Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
				<DialogTitle>Save Permalink or {mode === 'code' ? 'Code' : 'Plan'}</DialogTitle>
				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300 }}>
						<TextField
							autoFocus
							margin="dense"
							label="Name"
							fullWidth
							value={artifactName}
							onChange={(e) => setArtifactName(e.target.value)}
						/>
						<FormControlLabel
							control={
								<Checkbox
									checked={createPermalink}
									onChange={(e) => setCreatePermalink(e.target.checked)}
								/>
							}
							label="Create Permalink"
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
					<Button onClick={handleSaveConfirm} disabled={!artifactName}>
						Save
					</Button>
				</DialogActions>
			</Dialog>

			{/* Permalink URL Snackbar */}
			<Snackbar
				open={!!permalinkUrl}
				autoHideDuration={6000}
				onClose={() => setPermalinkUrl(null)}
				message={
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<span>Permalink created:</span>
						<Link
							href={permalinkUrl || '#'}
							target="_blank"
							rel="noopener"
							color="inherit"
							sx={{ wordBreak: 'break-all' }}
						>
							{permalinkUrl}
						</Link>
					</Box>
				}
			/>
		</Box>
	);
}
