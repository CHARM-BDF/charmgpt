import {
	Box,
	CssBaseline,
	ThemeProvider,
	createTheme,
	useMediaQuery,
	Tabs,
	Tab,
	Fab,
	Dialog,
	IconButton,
	Slide,
	Tooltip,
} from '@mui/material';
import ChatInterface from './components/ChatInterface';
import CodeEditor from './components/CodeEditor';
//import DataVisualizer from './components/DataVisualizer'
import ArtifactList from './components/ArtifactList';
import ArtifactView from './components/ArtifactView';
import { useEffect, useCallback, useRef, useState, forwardRef } from 'react';
import { ArtifactProvider } from './contexts/ArtifactContext';
import { useArtifact } from './contexts/useArtifact';
import { Artifact } from './contexts/ArtifactContext.types';
import {
	Panel,
	PanelGroup,
	PanelResizeHandle,
	ImperativePanelHandle,
} from 'react-resizable-panels';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import UploadIcon from '@mui/icons-material/Upload';
import { TransitionProps } from '@mui/material/transitions';
import { useParams, useNavigate } from 'react-router-dom';

const theme = createTheme({
	// You can customize your theme here
});

const ResizeHandle = () => (
	<PanelResizeHandle
		style={{
			width: '4px',
			background: '#e0e0e0', // Lighter gray for the handle
			margin: '0',
			cursor: 'col-resize',
			borderLeft: '1px solid #bdbdbd', // Add border for definition
			borderRight: '1px solid #bdbdbd',
		}}
	/>
);

const VerticalResizeHandle = () => (
	<PanelResizeHandle
		style={{
			height: '4px',
			background: '#e0e0e0', // Lighter gray for the handle
			margin: '0',
			cursor: 'row-resize',
			borderTop: '1px solid #bdbdbd', // Add border for definition
			borderBottom: '1px solid #bdbdbd',
		}}
	/>
);

// Slide transition for chat dialog
const Transition = forwardRef(function Transition(
	props: TransitionProps & {
		children: React.ReactElement;
	},
	ref: React.Ref<unknown>
) {
	return (
		<Slide
			direction='up'
			ref={ref}
			{...props}
		/>
	);
});

function AppContent() {
	const { runArtifact, editorContent, updateArtifact } = useArtifact();
	const mainPanelRef = useRef<ImperativePanelHandle>(null);
	const editorPanelRef = useRef<ImperativePanelHandle>(null);
	const rightPanelRef = useRef<ImperativePanelHandle>(null);
	const isMobile = useMediaQuery('(max-width:768px)');
	const [mobileTab, setMobileTab] = useState(0);
	const [chatOpen, setChatOpen] = useState(false);
	const [uploadRef, setUploadRef] = useState<HTMLInputElement | null>(null);
	const { name } = useParams();
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(false);

	// Check for permalink on mount
	useEffect(() => {
		const loadPermalink = async () => {
			if (!name || isLoading) return;

			try {
				setIsLoading(true);
				// Check if permalink exists
				const checkResponse = await fetch(`/api/artifacts/permalinks/${name}`);
				const { exists } = await checkResponse.json();

				if (!exists) {
					// Silently redirect to main page if permalink doesn't exist
					navigate('/', { replace: true });
					return;
				}

				// Load permalink content
				const loadResponse = await fetch(`/api/artifacts/permalinks/${name}/load`);
				const { pinned, plan } = await loadResponse.json();

				// Update plan content and pinned artifacts
				await Promise.all([
					fetch('/api/artifacts/plan', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							content: plan
						})
					}),
					...pinned.map((artifact: Artifact) => 
						fetch('/api/artifacts/pin', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								artifactId: artifact.id,
								pinned: true,
								artifact
							})
						}).then(() => {
							// Update application state after pinning
							updateArtifact({ ...artifact, pinned: true });
						})
					)
				]);

				// Navigate to home to show the loaded state
				navigate('/', { replace: true });

			} catch (error) {
				console.error('Failed to load permalink:', error);
				// Silently redirect on error
				navigate('/', { replace: true });
			} finally {
				setIsLoading(false);
			}
		};

		loadPermalink();
	}, [name, navigate, isLoading, updateArtifact]);

	const handleTabChange = (
		_event: React.SyntheticEvent,
		newValue: number
	) => {
		setMobileTab(newValue);
	};

	const toggleChat = () => {
		setChatOpen(!chatOpen);
	};

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				event.preventDefault();
				runArtifact(editorContent);
			}
		},
		[runArtifact, editorContent]
	);

	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleKeyDown]);

	useEffect(() => {
		const handleResize = () => {
			if (!isMobile) {
				mainPanelRef.current?.resize(80);
				editorPanelRef.current?.resize(65);
				rightPanelRef.current?.resize(50);
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [isMobile]);

	// Create a ref callback to get access to the upload input from ArtifactList
	const uploadRefCallback = useCallback((node: HTMLInputElement | null) => {
		if (node !== null) {
			setUploadRef(node);
		}
	}, []);

	// Function to trigger the file upload dialog
	const triggerUpload = () => {
		if (uploadRef) {
			uploadRef.click();
		}
	};

	return (
		<Box
			sx={{
				height: '100vh',
				display: 'flex',
				overflow: 'hidden',
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				bgcolor: '#f5f5f5', // Light gray background
			}}
		>
			{isMobile ? (
				// Mobile layout - vertical stack with equal panels and floating chat
				<>
					<PanelGroup
						direction='vertical'
						style={{ width: '100%' }}
					>
						{/* Editor Panel - 50% height */}
						<Panel
							defaultSize={50}
							minSize={30}
							maxSize={70}
							style={{
								display: 'flex',
								padding: '4px',
								backgroundColor: '#fff',
								borderRadius: '4px',
								boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
							}}
						>
							<Box sx={{ flex: 1, overflow: 'auto', p: 0.5 }}>
								<CodeEditor />
							</Box>
						</Panel>

						<VerticalResizeHandle />

						{/* Tabbed Artifact Panel - 50% height */}
						<Panel
							defaultSize={50}
							minSize={30}
							maxSize={70}
							style={{
								display: 'flex',
								flexDirection: 'column',
								padding: '4px',
								backgroundColor: '#fff',
								borderRadius: '4px',
								boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
							}}
						>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									borderBottom: 1,
									borderColor: 'divider',
								}}
							>
								<Tabs
									value={mobileTab}
									onChange={handleTabChange}
									variant='fullWidth'
									sx={{
										flex: 1,
										minHeight: '40px',
										'& .MuiTab-root': {
											minHeight: '40px',
											py: 0.5,
										},
									}}
								>
									<Tab label='Artifact View' />
									<Tab label='Artifact List' />
								</Tabs>
								{mobileTab === 1 && (
									<Tooltip title='Upload File'>
										<IconButton
											size='small'
											onClick={triggerUpload}
											sx={{ mr: 1 }}
										>
											<UploadIcon fontSize='small' />
										</IconButton>
									</Tooltip>
								)}
							</Box>
							<Box
								sx={{
									flex: 1,
									overflow: 'auto',
									p: 0.5,
									display: 'flex',
									flexDirection: 'column',
								}}
							>
								{mobileTab === 0 ? (
									<ArtifactView />
								) : (
									<ArtifactList
										uploadRefCallback={uploadRefCallback}
									/>
								)}
							</Box>
						</Panel>
					</PanelGroup>

					{/* Floating Chat Button */}
					<Fab
						color='primary'
						aria-label='chat'
						onClick={toggleChat}
						sx={{
							position: 'fixed',
							bottom: 16,
							right: 16,
							zIndex: 1000,
						}}
					>
						<ChatIcon />
					</Fab>

					{/* Chat Dialog */}
					<Dialog
						fullScreen={isMobile}
						open={chatOpen}
						onClose={toggleChat}
						TransitionComponent={Transition}
						sx={{
							'& .MuiDialog-paper': {
								margin: isMobile ? 0 : 2,
								width: isMobile ? '100%' : '80%',
								maxWidth: isMobile ? '100%' : '500px',
								height: isMobile ? '100%' : '70%',
								maxHeight: isMobile ? '100%' : '600px',
								position: isMobile ? 'fixed' : 'absolute',
								bottom: isMobile ? 0 : 16,
								right: isMobile ? 0 : 16,
								borderRadius: isMobile ? 0 : 2,
							},
						}}
					>
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								height: '100%',
								position: 'relative',
							}}
						>
							<IconButton
								edge='start'
								color='inherit'
								onClick={toggleChat}
								aria-label='close'
								sx={{
									position: 'absolute',
									right: 8,
									top: 8,
									zIndex: 1,
								}}
							>
								<CloseIcon />
							</IconButton>
							<ChatInterface />
						</Box>
					</Dialog>
				</>
			) : (
				// Desktop layout - horizontal with nested vertical
				<PanelGroup
					direction='horizontal'
					style={{ width: '100%' }}
				>
					<Panel
						defaultSize={80}
						minSize={70}
						maxSize={85}
						ref={mainPanelRef}
						style={{
							display: 'flex',
							padding: '8px',
							backgroundColor: '#fff', // White background for panels
							borderRadius: '4px',
							boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
						}}
					>
						<PanelGroup
							direction='vertical'
							style={{ height: '100%', width: '100%' }}
						>
							<Panel
								defaultSize={65}
								minSize={50}
								maxSize={75}
								ref={editorPanelRef}
								style={{
									display: 'flex',
									backgroundColor: '#fff',
									borderRadius: '4px',
									boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
								}}
							>
								<Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
									<CodeEditor />
								</Box>
							</Panel>

							<VerticalResizeHandle />

							<Panel
								minSize={25}
								maxSize={50}
								style={{
									display: 'flex',
									backgroundColor: '#fff',
									borderRadius: '4px',
									boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
								}}
							>
								<Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
									<ArtifactView />
								</Box>
							</Panel>
						</PanelGroup>
					</Panel>

					<ResizeHandle />

					<Panel
						defaultSize={20}
						minSize={15}
						maxSize={30}
						style={{
							display: 'flex',
							padding: '8px',
							backgroundColor: '#fff',
							borderRadius: '4px',
							boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
						}}
					>
						<PanelGroup
							direction='vertical'
							style={{ height: '100%', width: '100%' }}
						>
							<Panel
								defaultSize={50}
								minSize={30}
								maxSize={70}
								ref={rightPanelRef}
								style={{
									display: 'flex',
									backgroundColor: '#fff',
									borderRadius: '4px',
									boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
								}}
							>
								<Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
									<ArtifactList />
								</Box>
							</Panel>

							<VerticalResizeHandle />

							<Panel
								minSize={30}
								maxSize={70}
								style={{
									display: 'flex',
									backgroundColor: '#fff',
									borderRadius: '4px',
									boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
								}}
							>
								<Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
									<ChatInterface />
								</Box>
							</Panel>
						</PanelGroup>
					</Panel>
				</PanelGroup>
			)}
		</Box>
	);
}

export default function App() {
	useEffect(() => {
		document.title = 'CHARMGPT';
	}, []);

	return (
		<ArtifactProvider>
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<AppContent />
			</ThemeProvider>
		</ArtifactProvider>
	);
}
