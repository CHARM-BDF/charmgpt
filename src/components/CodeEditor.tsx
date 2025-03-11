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
	Typography,
	Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import MenuIcon from '@mui/icons-material/Menu';
import Editor from './Editor';
import { useArtifact } from '../contexts/useArtifact';
import { EditorMode } from '../contexts/ArtifactContext.types';
import { useState, useEffect, useRef, useCallback } from 'react';

type CodeLanguage = 'python' | 'r';

export default function CodeEditor() {
	const {
		mode,
		setMode,
		editorContent,
		planContent,
		pipeContent,
		runArtifact,
		isRunning,
		setIsRunning,
		activeArtifact,
		handleChat,
		addArtifact,
	} = useArtifact();

	const [language, setLanguage] = useState<CodeLanguage>('python');
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [artifactName, setArtifactName] = useState('');
	const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
	const [currentPipelineStep, setCurrentPipelineStep] = useState(1);
	const [pipelineSteps, setPipelineSteps] = useState<{index: number, title: string}[]>([]);
	const [stepCompleted, setStepCompleted] = useState(false);
	const pipelineExecutionRef = useRef<{
		isExecuting: boolean;
		steps: {index: number, title: string}[];
		currentStepIndex: number;
	}>({
		isExecuting: false,
		steps: [],
		currentStepIndex: 0
	});
	
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
	
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
			// Save the current content before switching modes
			// This ensures that users don't lose their work when switching between modes
			
			// If switching from code mode, save the code content
			if (mode === 'code' && activeArtifact && editorContent) {
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
						console.error('Failed to save code before switching modes:', err);
					}
				}
			}
			
			// If switching from plan mode, save the plan content to backend
			if (mode === 'plan') {
				try {
					await fetch('/api/artifacts/plan', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ content: planContent })
					});
				} catch (err) {
					console.error('Failed to save plan content before switching modes:', err);
				}
			}
			
			// If switching from pipe mode, save the pipe content to backend
			if (mode === 'pipe') {
				try {
					await fetch('/api/artifacts/pipe', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ content: pipeContent })
					});
				} catch (err) {
					console.error('Failed to save pipe content before switching modes:', err);
				}
			}
			
			// Set the new mode
			setMode(newMode);
		}
	};

	const handleLanguageChange = (event: SelectChangeEvent<CodeLanguage>) => {
		setLanguage(event.target.value as CodeLanguage);
	};

	// Function to parse pipeline steps
	const parsePipelineSteps = useCallback((pipelineText: string) => {
		const lines = pipelineText.split('\n');
		const steps: {index: number, title: string}[] = [];
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			const match = line.match(/^## Step (\d+):(.*)/);
			if (match) {
				const stepNumber = parseInt(match[1], 10);
				const stepTitle = match[2].trim();
				steps.push({
					index: i,
					title: `Step ${stepNumber}: ${stepTitle}`
				});
			}
		}
		
		return steps;
	}, []);
	
	// Effect to check for chat completion and move to next step
	useEffect(() => {
		// If we're not executing a pipeline, do nothing
		if (!pipelineExecutionRef.current.isExecuting) {
			return;
		}
		
		// If we've completed all steps, reset the execution state
		if (pipelineExecutionRef.current.currentStepIndex >= pipelineExecutionRef.current.steps.length) {
			pipelineExecutionRef.current.isExecuting = false;
			alert('Pipeline execution completed!');
			return;
		}
		
		// If we're currently running a step, don't start another one
		if (isRunning) {
			return;
		}
		
		// If we just completed a step, schedule the next one
		if (stepCompleted) {
			setStepCompleted(false);
			
			// Log the current step for debugging
			console.log(`Completed step ${pipelineExecutionRef.current.currentStepIndex + 1} of ${pipelineExecutionRef.current.steps.length}`);
			
			// Move to the next step - always increment the index after completion
			pipelineExecutionRef.current.currentStepIndex++;
			
			// Log the next step for debugging
			console.log(`Moving to step ${pipelineExecutionRef.current.currentStepIndex + 1} of ${pipelineExecutionRef.current.steps.length}`);
			
			// Use a small delay to ensure UI updates before next step
			const timer = setTimeout(() => {
				// Only trigger the next step if we haven't completed all steps
				if (pipelineExecutionRef.current.currentStepIndex < pipelineExecutionRef.current.steps.length) {
					// Trigger the effect again to execute the next step
					setStepCompleted(true);
				} else {
					// We've completed all steps
					pipelineExecutionRef.current.isExecuting = false;
					alert('Pipeline execution completed!');
				}
			}, 1000);
			return () => clearTimeout(timer);
		}
		
		// Execute the next step
		const executeNextStep = async () => {
			if (!pipelineExecutionRef.current.isExecuting) return;
			
			const currentStepIndex = pipelineExecutionRef.current.currentStepIndex;
			const currentStep = pipelineExecutionRef.current.steps[currentStepIndex];
			
			// Update the UI to show the current step
			setCurrentPipelineStep(currentStepIndex + 1);
			
			// Log the step being executed for debugging
			console.log(`Executing step ${currentStepIndex + 1} of ${pipelineExecutionRef.current.steps.length}: ${currentStep.title}`);
			
			// Create a prompt for the current step
			const prompt = `I'm working on a pipeline with the following steps:\n\n${pipeContent}\n\nPlease help me execute ${currentStep.title} specifically. Focus only on this step for now, and provide detailed results that I can use for the next steps.`;
			
			// Execute the step
			setIsRunning(true);
			try {
				await handleChat(prompt);
				// Mark this step as completed
				setStepCompleted(true);
			} catch (error) {
				console.error('Error executing pipeline step:', error);
				pipelineExecutionRef.current.isExecuting = false;
			} finally {
				setIsRunning(false);
			}
		};
		
		// Schedule the next step execution with a small delay
		const timer = setTimeout(executeNextStep, 500);
		return () => clearTimeout(timer);
	}, [isRunning, pipeContent, handleChat, stepCompleted, setIsRunning]);

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
		} else if (mode === 'pipe') {
			// In pipe mode, parse the pipeline and execute all steps sequentially
			try {
				// Parse the pipeline to identify all steps
				const steps = parsePipelineSteps(pipeContent);
				setPipelineSteps(steps);
				
				if (steps.length === 0) {
					// No steps found
					alert('No steps found in the pipeline. Please define steps using "## Step X:" format.');
					return;
				}
				
				// Ask user if they want to execute all steps or just the current one
				const executeAll = window.confirm('Do you want to execute all steps in the pipeline? Click OK to execute all steps sequentially, or Cancel to execute only the current step.');
				
				if (executeAll) {
					// Reset the step tracking state
					setStepCompleted(false);
					// Set up the pipeline execution
					pipelineExecutionRef.current = {
						isExecuting: true,
						steps,
						currentStepIndex: 0
					};
					// Trigger the initial step execution by setting a timeout
					setTimeout(() => {
						setStepCompleted(true);
					}, 100);
				} else {
					// Execute only the current step (original behavior)
					setIsRunning(true);
					try {
						// Find the current step (look for "# Step X:" pattern)
						let currentStepIndex = -1;
						let currentStepTitle = '';
						
						for (let i = 0; i < steps.length; i++) {
							if (i === 0 || (currentPipelineStep - 1) === i) {
								// Use either the first step or the currently selected step
								currentStepIndex = steps[i].index;
								currentStepTitle = steps[i].title;
								break;
							}
						}
						
						if (currentStepIndex === -1) {
							// No step found
							alert('No steps found in the pipeline. Please define steps using "# Step X:" format.');
							return;
						}
						
						// Create a prompt that includes the pipeline context and focuses on the current step
						const prompt = `I'm working on a pipeline with the following steps:\n\n${pipeContent}\n\nPlease help me execute ${currentStepTitle} specifically. Focus only on this step for now, and provide detailed results that I can use for the next steps.`;
						
						// Send the prompt to the chat
						await handleChat(prompt);
					} finally {
						setIsRunning(false);
					}
				}
			} catch (error) {
				console.error('Error executing pipeline:', error);
				setIsRunning(false);
			}
		}
	};

	const handleSave = () => {
		// Generate a default name based on the current mode and time
		const defaultName = activeArtifact?.name 
			? `${activeArtifact.name} (copy)`
			: `${mode === 'code' ? 'Code' : mode === 'plan' ? 'Plan' : 'Pipe'} ${new Date().toLocaleTimeString()}`;
		setArtifactName(defaultName);
		setSaveDialogOpen(true);
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
			} else if (mode === 'plan') {
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
			} else {
				// Save as pipe artifact
				// Use a type assertion to work around TypeScript limitations
				const pipeArtifact = {
					type: 'pipe',
					name: artifactName,
					content: pipeContent,
					source: 'user',
					var2val: {},
					var2line: {},
					var2line_end: {},
					pinned: true,
				};
				// @ts-expect-error - TypeScript doesn't understand pipe artifacts yet
				await addArtifact(pipeArtifact);
			}

			setSaveDialogOpen(false);
			setArtifactName('');
		} catch (error) {
			console.error('Failed to save artifact:', error);
			// You could add error handling UI here
		}
	};

	// Render the pipeline step indicator
	const renderPipelineStepIndicator = () => {
		if (mode !== 'pipe' || pipelineSteps.length === 0) {
			return null;
		}
		
		return (
			<Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
				<Typography variant="body2" sx={{ mr: 1 }}>
					Current step:
				</Typography>
				<Chip 
					label={`Step ${currentPipelineStep} of ${pipelineSteps.length}`} 
					color="primary" 
					size="small"
					sx={{ mr: 1 }}
				/>
				{pipelineExecutionRef.current.isExecuting && (
					<CircularProgress size={16} sx={{ ml: 1 }} />
				)}
			</Box>
		);
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
						<ToggleButton value="pipe">Pipe</ToggleButton>
						<ToggleButton value="plan">Plan</ToggleButton>
						<ToggleButton value="code">Code</ToggleButton>
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

			{/* Pipeline step indicator */}
			{renderPipelineStepIndicator()}

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
				<Editor language={language} />
			</Box>

			<Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
				<DialogTitle>Save {mode === 'code' ? 'Code' : mode === 'plan' ? 'Plan' : 'Pipe'}</DialogTitle>
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
