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
	Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import MenuIcon from '@mui/icons-material/Menu';
import Editor from './Editor';
import { useArtifact } from '../contexts/useArtifact';
import { EditorMode, Artifact } from '../contexts/ArtifactContext.types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatArtifact } from '../utils/artifactFormatters';

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
		artifacts,
		updateArtifact,
	} = useArtifact();

	const [language, setLanguage] = useState<CodeLanguage>('python');
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [artifactName, setArtifactName] = useState('');
	const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
	const [currentPipelineStep, setCurrentPipelineStep] = useState(1);
	const [pipelineSteps, setPipelineSteps] = useState<{index: number, title: string}[]>([]);
	const pipelineExecutionRef = useRef<{
		isExecuting: boolean;
		steps: {index: number, title: string}[];
		currentStepIndex: number;
		stepArtifacts: Artifact[];
		startTime?: number;
		isPaused: boolean;
		lastError?: string;
		userModifiedArtifact?: Artifact;
	}>({
		isExecuting: false,
		steps: [],
		currentStepIndex: 0,
		stepArtifacts: [],
		isPaused: false
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
	
	// Function to execute the next step in the pipeline
	const executeNextStep = async () => {
		// Check if we're already executing or if the execution is complete
		if (!pipelineExecutionRef.current || !pipelineExecutionRef.current.isExecuting) {
			console.log('Pipeline execution is not active');
			return;
		}
		
		// Get the current step index and step
		const currentStepIndex = pipelineExecutionRef.current.currentStepIndex;
		const currentStep = pipelineExecutionRef.current.steps[currentStepIndex];
		
		if (!currentStep) {
			console.log('No step found at index', currentStepIndex);
			return;
		}
		
		// Update the UI to show the current step (1-indexed for display)
		setCurrentPipelineStep(currentStepIndex + 1);
		
		// Log the step being executed for debugging
		console.log(`Executing step ${currentStepIndex + 1} of ${pipelineExecutionRef.current.steps.length}: ${currentStep.title}`);
		
		// Extract the first # heading from the pipeline document
		const lines = pipeContent.split('\n');
		let pipelineTitle = '';
		for (const line of lines) {
			const trimmedLine = line.trim();
			if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('## ')) {
				pipelineTitle = trimmedLine.substring(2).trim();
				break;
			}
		}
		
		// Create a one-liner for the code docstring
		const docstringOneLiner = pipelineTitle 
			? `${pipelineTitle} - ${currentStep.title}`
			: currentStep.title;
		
		// Check if we have a user-modified artifact for this step
		const userModifiedArtifact = pipelineExecutionRef.current.userModifiedArtifact;
		
		// Store the current artifacts for comparison after execution
		const artifactsBeforeExecution = [...artifacts];
		// Log all current artifacts for debugging
		console.log(`[DEBUG] Step ${currentStepIndex + 1}: All artifacts before execution (${artifactsBeforeExecution.length}):`, 
			artifacts.map(a => ({ id: a.id, name: a.name, type: a.type, timestamp: a.timestamp })));
		
		// Record the timestamp before executing the step
		const stepStartTime = Date.now();
		console.log(`[DEBUG] Step ${currentStepIndex + 1}: Recording start time ${stepStartTime}`);
		
		// Execute the step
		setIsRunning(true);
		try {
			let success = false;
			
			// If we have a user-modified artifact, use it directly instead of generating new code
			if (userModifiedArtifact && userModifiedArtifact.pipelineStep === currentStepIndex + 1) {
				console.log(`[DEBUG] Step ${currentStepIndex + 1}: Using user-modified code directly:`, userModifiedArtifact.id);
				
				// Extract the pipeline title if available
				const pipelineTitle = getPipelineTitle(pipeContent);
				
				// Run the user-modified code directly
				if (userModifiedArtifact.code) {
					// Get the actual modified code from the editor content, not the original artifact
					// This ensures we're using the latest user changes
					const modifiedCode = editorContent || userModifiedArtifact.code;
					
					// Create a new artifact name based on the pipeline step
					const artifactName = `${pipelineTitle ? pipelineTitle + ' - ' : ''}${currentStep.title} (Modified)`;
					
					// Create a new artifact with the user-modified code
					const newArtifact = {
						type: 'code' as const,
						name: artifactName,
						code: modifiedCode.includes('# Pipeline:') ? modifiedCode : 
							`# Pipeline: ${pipelineTitle || 'Unnamed Pipeline'}\n# Step: ${currentStepIndex + 1} of ${pipelineExecutionRef.current.steps.length} - ${currentStep.title}\n\n${modifiedCode}`,
						output: '',
						language: userModifiedArtifact.language || 'python',
						source: 'user',
						var2val: {},
						var2line: {},
						var2line_end: {},
						pipelineStep: currentStepIndex + 1,
						pipelineTotalSteps: pipelineExecutionRef.current.steps.length,
						pipelineTitle: pipelineTitle,
						pipelineStepTitle: currentStep.title
					};
					
					// Add the new artifact
					try {
						// Add the artifact and get the result with ID
						const createdArtifact = await addArtifact(newArtifact);
						console.log(`[DEBUG] Step ${currentStepIndex + 1}: Created new artifact from user-modified code:`, createdArtifact.id);
						
						// Now run the code to get the results - use the modified code from the new artifact
						if (createdArtifact.code) {
							await runArtifact(createdArtifact.code, createdArtifact.language || 'python');
							success = true;
						} else {
							console.error(`[DEBUG] Step ${currentStepIndex + 1}: Created artifact has no code`);
							success = false;
						}
						
						// Add the created artifact to the step artifacts list
						if (!pipelineExecutionRef.current.stepArtifacts) {
							pipelineExecutionRef.current.stepArtifacts = [];
						}
						pipelineExecutionRef.current.stepArtifacts.push(createdArtifact);
						console.log(`[DEBUG] Step ${currentStepIndex + 1}: Added user-modified artifact to stepArtifacts:`, 
							{ id: createdArtifact.id, name: createdArtifact.name, type: createdArtifact.type });
					} catch (error) {
						console.error(`[DEBUG] Step ${currentStepIndex + 1}: Failed to create artifact from user-modified code:`, error);
						success = false;
					}
				} else {
					console.error(`[DEBUG] Step ${currentStepIndex + 1}: User-modified artifact has no code`);
					success = false;
				}
				
				// Clear the user-modified artifact reference since we've used it
				pipelineExecutionRef.current.userModifiedArtifact = undefined;
			} else {
				// Create a prompt that includes the pipeline context and focuses on the current step
				let prompt = `I'm working on a pipeline with the following steps:\n\n${pipeContent}\n\n`;
				
				// Simple condition: if we're not on the first step (index 0), include previous artifacts
				if (currentStepIndex > 0) {
					prompt += `I've already completed the previous steps and here are the results:\n\n`;
					
					// Get the step artifacts tracked in pipelineExecutionRef
					const stepArtifacts = pipelineExecutionRef.current.stepArtifacts || [];
					console.log(`[DEBUG] Step ${currentStepIndex + 1}: Found ${stepArtifacts.length} step artifacts in pipelineExecutionRef:`, 
						stepArtifacts.map(a => ({ id: a.id, name: a.name, type: a.type, timestamp: a.timestamp })));
					
					if (stepArtifacts.length > 0) {
						prompt += `Found ${stepArtifacts.length} relevant artifacts from previous steps:\n\n`;
						stepArtifacts.forEach((artifact) => {
							prompt += `Previous step created the following artifact:\n`;
							prompt += formatArtifact(artifact, true);
							prompt += '\n';
						});
					} else {
						prompt += `No relevant artifacts were created by previous steps.\n\n`;
					}
				}
				
				// Add the docstring one-liner to the prompt
				prompt += `Please help me execute ${currentStep.title} specifically. Focus only on this step for now, and provide detailed results that I can use for the next steps.\n\n`;
				
				// Generate code for this step using the AI
				console.log(`Sending prompt for step ${currentStepIndex + 1} with docstring: "${docstringOneLiner}"`);
				success = await handleChat(prompt, docstringOneLiner);
			}
			
			console.log(`Step ${currentStepIndex + 1} execution ${success ? 'succeeded' : 'failed'}`);
			
			// If the step was successful, check if there are more steps
			if (success) {
				// Add a longer delay to allow time for artifacts to be created and processed
				console.log(`[DEBUG] Step ${currentStepIndex + 1}: Waiting for artifacts to be processed...`);
				await new Promise(resolve => setTimeout(resolve, 3000)); // Increase to 3 seconds
				
				// Get the latest artifacts after execution
				// We need to ensure we're looking at the most recent artifacts
				let latestArtifacts = [...artifacts]; // Default to current artifacts as fallback
				
				// Try to refresh artifacts from the server to get the most up-to-date list
				try {
					const response = await fetch('/api/artifacts/all');
					if (response.ok) {
						const refreshedArtifacts = await response.json();
						console.log(`[DEBUG] Step ${currentStepIndex + 1}: Refreshed artifacts from server (${refreshedArtifacts.length})`);
						latestArtifacts = refreshedArtifacts;
					} else {
						console.error(`[DEBUG] Step ${currentStepIndex + 1}: Failed to refresh artifacts from server:`, response.statusText);
					}
				} catch (error) {
					console.error(`[DEBUG] Step ${currentStepIndex + 1}: Error refreshing artifacts:`, error);
				}
				
				// Log all artifacts after execution for debugging
				console.log(`[DEBUG] Step ${currentStepIndex + 1}: All artifacts after execution (${latestArtifacts.length}):`, 
					latestArtifacts.map(a => ({ id: a.id, name: a.name, type: a.type, timestamp: a.timestamp })));
				
				// Check if we already have an artifact for this step in the stepArtifacts array
				// This prevents duplicate executions of the same step
				const existingStepArtifact = pipelineExecutionRef.current.stepArtifacts.find(
					a => a.pipelineStep === currentStepIndex + 1
				);
				
				if (existingStepArtifact) {
					console.log(`[DEBUG] Step ${currentStepIndex + 1}: Already have an artifact for this step:`, 
						{ id: existingStepArtifact.id, name: existingStepArtifact.name });
					
					// Move to the next step without creating a new artifact
					pipelineExecutionRef.current.currentStepIndex++;
					
					// If we've completed all steps, finish the pipeline execution
					if (pipelineExecutionRef.current.currentStepIndex >= pipelineExecutionRef.current.steps.length) {
						console.log('Pipeline execution completed!');
						pipelineExecutionRef.current.isExecuting = false;
						setCurrentPipelineStep(1); // Reset to first step for next execution
					} else {
						// Schedule the next step execution without delay
						console.log(`Scheduling next step (${pipelineExecutionRef.current.currentStepIndex + 1}) execution`);
						executeNextStep();
					}
					return; // Skip the rest of the artifact processing
				}
				
				// Log artifact types for debugging
				const artifactTypes = latestArtifacts.reduce((acc, a) => {
					acc[a.type] = (acc[a.type] || 0) + 1;
					return acc;
				}, {} as Record<string, number>);
				console.log(`[DEBUG] Step ${currentStepIndex + 1}: Artifact types:`, artifactTypes);
				
				// Log timestamp range for debugging
				const timestamps = latestArtifacts.map(a => a.timestamp).sort((a, b) => a - b);
				const now = Date.now();
				console.log(`[DEBUG] Step ${currentStepIndex + 1}: Timestamp range:`, {
					oldest: timestamps[0],
					newest: timestamps[timestamps.length - 1],
					current: now,
					oldestDiff: now - timestamps[0],
					newestDiff: now - timestamps[timestamps.length - 1]
				});
				
				// Find new artifacts created during this step
				const newArtifacts = latestArtifacts.filter(artifact => 
					// Check if this artifact is new (not in the before-execution array)
					!artifactsBeforeExecution.some(a => a.id === artifact.id) && 
					// Only include code artifacts
					artifact.type === 'code'
				).sort((a, b) => b.timestamp - a.timestamp);
				
				console.log(`[DEBUG] Step ${currentStepIndex + 1}: Found ${newArtifacts.length} new artifacts by ID comparison:`, 
					newArtifacts.map(a => ({ id: a.id, name: a.name, type: a.type, timestamp: a.timestamp })));
				
				// As a fallback, also try the timestamp-based approach
				const timestampBasedArtifacts = latestArtifacts
					.filter(artifact => artifact.timestamp > stepStartTime && artifact.type === 'code')
					.sort((a, b) => b.timestamp - a.timestamp);
				
				console.log(`[DEBUG] Step ${currentStepIndex + 1}: Found ${timestampBasedArtifacts.length} new artifacts by timestamp > ${stepStartTime}:`, 
					timestampBasedArtifacts.map(a => ({ id: a.id, name: a.name, type: a.type, timestamp: a.timestamp })));
				
				// Combine both approaches to ensure we don't miss any artifacts
				const combinedArtifacts = Array.from(
					new Set([...newArtifacts, ...timestampBasedArtifacts].map(a => a.id))
				)
					.map(id => latestArtifacts.find(a => a.id === id))
					.filter((a): a is Artifact => a !== undefined)
					.sort((a, b) => b.timestamp - a.timestamp);
				
				console.log(`[DEBUG] Step ${currentStepIndex + 1}: Combined ${combinedArtifacts.length} artifacts from both approaches:`, 
					combinedArtifacts.map(a => ({ id: a.id, name: a.name, type: a.type, timestamp: a.timestamp })));
				
				// Add the most recent artifact to the step artifacts list
				if (combinedArtifacts.length > 0) {
					// Initialize stepArtifacts if it doesn't exist
					if (!pipelineExecutionRef.current.stepArtifacts) {
						pipelineExecutionRef.current.stepArtifacts = [];
					}
					
					// Get the most recent artifact
					const mostRecentArtifact = combinedArtifacts[0];
					
					// Extract the pipeline title if available
					const pipelineTitle = getPipelineTitle(pipeContent);
					
					// Add pipeline metadata to the artifact
					try {
						// Update the artifact with pipeline metadata
						const updatedArtifact = {
							...mostRecentArtifact,
							name: `${pipelineTitle ? pipelineTitle + ' - ' : ''}${currentStep.title} (Result)`,
							// Add metadata as a comment in the code
							code: mostRecentArtifact.code ? 
								`# Pipeline: ${pipelineTitle || 'Unnamed Pipeline'}\n# Step: ${currentStepIndex + 1} of ${pipelineExecutionRef.current.steps.length} - ${currentStep.title}\n\n${mostRecentArtifact.code}` : 
								mostRecentArtifact.code,
							// Store pipeline info in the artifact
							pipelineStep: currentStepIndex + 1,
							pipelineTotalSteps: pipelineExecutionRef.current.steps.length,
							pipelineTitle: pipelineTitle,
							pipelineStepTitle: currentStep.title
						};
						
						// Update the artifact with the pipeline metadata
						await updateArtifact(updatedArtifact);
						console.log(`[DEBUG] Step ${currentStepIndex + 1}: Updated artifact with pipeline metadata:`, updatedArtifact);
						
						// Add the updated artifact to the step artifacts list
						// Make sure we're adding the updated artifact with pipeline metadata
						pipelineExecutionRef.current.stepArtifacts.push(updatedArtifact);
						console.log(`[DEBUG] Step ${currentStepIndex + 1}: Added artifact to stepArtifacts:`, 
							{ id: updatedArtifact.id, name: updatedArtifact.name, type: updatedArtifact.type });
					} catch (error) {
						console.error(`[DEBUG] Step ${currentStepIndex + 1}: Failed to update artifact with pipeline metadata:`, error);
						
						// Even if updating metadata fails, still add the original artifact to step artifacts
						pipelineExecutionRef.current.stepArtifacts.push(mostRecentArtifact);
						console.log(`[DEBUG] Step ${currentStepIndex + 1}: Added original artifact to stepArtifacts due to metadata update failure:`, 
							{ id: mostRecentArtifact.id, name: mostRecentArtifact.name, type: mostRecentArtifact.type });
					}
				} else {
					console.log(`[DEBUG] Step ${currentStepIndex + 1}: No new artifacts found, stopping pipeline execution`);
					// If no new artifacts were found, stop the pipeline execution
					console.log(`Pipeline execution stopped: No new artifacts were created during step ${currentStepIndex + 1}`);
					pipelineExecutionRef.current.isExecuting = false;
					setIsRunning(false);
					return; // Exit the function early to prevent moving to the next step
				}
				
				// Move to the next step
				pipelineExecutionRef.current.currentStepIndex++;
				
				// If we've completed all steps, finish the pipeline execution
				if (pipelineExecutionRef.current.currentStepIndex >= pipelineExecutionRef.current.steps.length) {
					console.log('Pipeline execution completed!');
					pipelineExecutionRef.current.isExecuting = false;
					setCurrentPipelineStep(1); // Reset to first step for next execution
				} else {
					// Schedule the next step execution without delay
					console.log(`Scheduling next step (${pipelineExecutionRef.current.currentStepIndex + 1}) execution`);
					executeNextStep();
				}
			} else {
				// If the step failed, stop the pipeline execution
				console.log('Pipeline step failed, stopping execution');
				pipelineExecutionRef.current.isExecuting = false;
			}
		} catch (error) {
			console.error('Error executing pipeline step:', error);
			pipelineExecutionRef.current.isExecuting = false;
			setIsRunning(false);
		} finally {
			if (!pipelineExecutionRef.current.isExecuting) {
				setIsRunning(false);
			}
		}
	};

	// Effect to handle pipeline execution - now simplified since we're directly calling executeNextStep
	useEffect(() => {
		// This effect is now only used for cleanup
		return () => {
			// If there's any active pipeline execution when the component unmounts, clean it up
			if (pipelineExecutionRef.current.isExecuting) {
				pipelineExecutionRef.current.isExecuting = false;
				console.log("Cleaned up pipeline execution on unmount");
			}
		};
	}, []);

	// Helper function to extract the pipeline title from the content
	const getPipelineTitle = (content: string): string => {
		const lines = content.split('\n');
		for (const line of lines) {
			const trimmedLine = line.trim();
			if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('## ')) {
				return trimmedLine.substring(2).trim();
			}
		}
		return '';
	};

	const handleRun = async () => {
		if (mode === 'code') {
			// Check if the current artifact is part of a pipeline
			if (activeArtifact && 
				typeof activeArtifact.pipelineStep === 'number' && 
				typeof activeArtifact.pipelineTotalSteps === 'number') {
				
				console.log(`Current artifact is part of a pipeline (Step ${activeArtifact.pipelineStep} of ${activeArtifact.pipelineTotalSteps})`);
				
				// First, save the current code to the artifact
				if (editorContent && activeArtifact.code !== editorContent) {
					console.log(`[DEBUG] Saving modified code to artifact before pipeline execution`);
					
					// Extract the pipeline title if available
					const pipelineTitle = activeArtifact.pipelineTitle || '';
					const stepTitle = activeArtifact.pipelineStepTitle || '';
					
					// Update the artifact with the modified code but keep pipeline metadata
					const updatedArtifact = {
						...activeArtifact,
						// Preserve the pipeline metadata comment if it exists
						code: editorContent.includes('# Pipeline:') ? editorContent : 
							`# Pipeline: ${pipelineTitle || 'Unnamed Pipeline'}\n# Step: ${activeArtifact.pipelineStep} of ${activeArtifact.pipelineTotalSteps} - ${stepTitle}\n\n${editorContent}`
					};
					
					try {
						// Update the artifact with the modified code
						await updateArtifact(updatedArtifact);
						console.log(`[DEBUG] Updated artifact with modified code:`, updatedArtifact.id);
					} catch (error) {
						console.error(`[DEBUG] Failed to update artifact with modified code:`, error);
					}
				}
				
				// Switch to pipe mode to execute the pipeline
				await handleModeChange({} as React.MouseEvent<HTMLElement>, 'pipe');
				
				// Parse the pipeline steps
				const steps = parsePipelineSteps(pipeContent);
				
				if (steps.length === 0) {
					alert('No steps found in the pipeline. Please define steps using "## Step X:" format.');
					return;
				}
				
				// Set the current step indicator
				setPipelineSteps(steps);
				
				// Find all artifacts from this pipeline
				const pipelineArtifacts = artifacts.filter(a => 
					a.type === 'code' && 
					a.pipelineTitle === activeArtifact.pipelineTitle &&
					typeof a.pipelineStep === 'number'
				).sort((a, b) => (a.pipelineStep || 0) - (b.pipelineStep || 0));
				
				// Find artifacts from previous steps only (not including the current step)
				const previousStepArtifacts = pipelineArtifacts.filter(a => 
					(a.pipelineStep || 0) < (activeArtifact.pipelineStep || 0)
				);
				
				console.log(`[DEBUG] Found ${previousStepArtifacts.length} artifacts from previous steps`);
				
				// Initialize pipeline execution to re-run the current step
				// We use currentStepIndex = activeArtifact.pipelineStep - 1 because executeNextStep will execute the step at currentStepIndex + 1
				pipelineExecutionRef.current = {
					isExecuting: true,
					steps,
					currentStepIndex: (activeArtifact.pipelineStep || 1) - 1, // Set to execute the current step again
					stepArtifacts: previousStepArtifacts, // Only include artifacts from previous steps
					startTime: Date.now(),
					isPaused: false,
					userModifiedArtifact: activeArtifact // Store the user-modified artifact
				};
				
				// Make sure the UI shows the correct step (1-indexed for display)
				setCurrentPipelineStep(activeArtifact.pipelineStep || 1);
				
				console.log(`[DEBUG] Re-executing pipeline step ${activeArtifact.pipelineStep || 1} with user-modified code:`, {
					pipelineTitle: activeArtifact.pipelineTitle,
					currentStep: activeArtifact.pipelineStep || 1,
					totalSteps: activeArtifact.pipelineTotalSteps || 1,
					previousArtifactsCount: previousStepArtifacts.length,
					codeModified: activeArtifact.code !== editorContent,
					userModifiedArtifactId: activeArtifact.id
				});
				
				// Start execution of the current step
				executeNextStep();
				return;
			}
			
			// Regular code execution if not part of a pipeline
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
			// Check if there's a paused pipeline execution that can be resumed
			if (pipelineExecutionRef.current && pipelineExecutionRef.current.isPaused) {
				console.log('Resuming paused pipeline execution from step', pipelineExecutionRef.current.currentStepIndex + 1);
				
				// Clear the pause state and error
				pipelineExecutionRef.current.isPaused = false;
				pipelineExecutionRef.current.lastError = undefined;
				
				// Set the executing flag back to true
				pipelineExecutionRef.current.isExecuting = true;
				
				// Resume execution
				executeNextStep();
				return;
			}
			
			// In pipe mode, parse the pipeline and execute all steps sequentially
			try {
				// Parse the pipeline steps
				const steps = parsePipelineSteps(pipeContent);
				
				if (steps.length === 0) {
					alert('No steps found in the pipeline. Please define steps using "## Step X:" format.');
					return;
				}
				
				// Set the current step indicator
				setPipelineSteps(steps);
				
				// Start pipeline execution immediately without confirmation
				// Log the previous state of pipelineExecutionRef if it exists
				if (pipelineExecutionRef.current) {
					console.log(`[DEBUG] Previous pipelineExecutionRef state before reset:`, {
						isExecuting: pipelineExecutionRef.current.isExecuting,
						currentStepIndex: pipelineExecutionRef.current.currentStepIndex,
						stepsCount: pipelineExecutionRef.current.steps?.length,
						artifactsCount: pipelineExecutionRef.current.stepArtifacts?.length,
						artifacts: pipelineExecutionRef.current.stepArtifacts?.map(a => ({ id: a.id, name: a.name, type: a.type }))
					});
				}

				// Initialize pipeline execution
				pipelineExecutionRef.current = {
					isExecuting: true,
					steps,
					currentStepIndex: 0,
					stepArtifacts: [],
					startTime: Date.now(),
					isPaused: false
				};
				
				console.log(`[DEBUG] Initialized new pipelineExecutionRef:`, {
					isExecuting: pipelineExecutionRef.current.isExecuting,
					currentStepIndex: pipelineExecutionRef.current.currentStepIndex,
					stepsCount: pipelineExecutionRef.current.steps.length,
					artifactsCount: pipelineExecutionRef.current.stepArtifacts.length
				});
				
				// Make sure the UI shows step 1
				setCurrentPipelineStep(1);
				
				// Start execution immediately
				console.log("Starting pipeline execution directly...");
				executeNextStep();
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
		if (pipelineSteps.length === 0 || !pipelineExecutionRef.current.isExecuting) {
			return null;
		}
		
		return (
			<Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
				<Chip 
					label={`Step ${currentPipelineStep} of ${pipelineSteps.length}`} 
					color="primary" 
					size="small"
					sx={{ mr: 1 }}
				/>
				<CircularProgress size={16} />
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
					
					{/* Pipeline step indicator - now in the top bar */}
					{renderPipelineStepIndicator()}
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
