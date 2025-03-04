import {
	Box,
	TextField,
	IconButton,
	Typography,
	CircularProgress,
	useTheme,
	useMediaQuery,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useState } from 'react';
import { useArtifact } from '../contexts/useArtifact';

interface Message {
	role: 'user' | 'assistant';
	content: string;
}

export default function ChatInterface() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const { handleChat } = useArtifact();
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

	const handleSend = async () => {
		if (!input.trim() || isLoading) return;

		// Add user message to chat
		const userMessage: Message = {
			role: 'user',
			content: input,
		};
		setMessages((prev) => [...prev, userMessage]);
		setInput('');
		setIsLoading(true);

		try {
			// Process through artifact system
			const ok = await handleChat(input);

			// Add assistant message to chat
			const assistantMessage: Message = {
				role: 'assistant',
				content: ok ? 'Response added to artifacts' : 'Error',
			};
			setMessages((prev) => [...prev, assistantMessage]);
		} catch (err) {
			console.error('Chat error:', err);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Box
			sx={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
			}}
		>
			{/* Messages area */}
			<Box
				sx={{
					flex: 1,
					overflow: 'auto',
					p: isMobile ? 5 : 2,
					display: 'flex',
					flexDirection: 'column',
					gap: isMobile ? 1 : 2,
				}}
			>
				{messages.map((message, index) => (
					<Box
						key={index}
						sx={{
							alignSelf:
								message.role === 'user'
									? 'flex-end'
									: 'flex-start',
							maxWidth: isMobile ? '80%' : '80%',
							backgroundColor:
								message.role === 'user'
									? 'primary.main'
									: 'grey.100',
							color:
								message.role === 'user'
									? 'white'
									: 'text.primary',
							borderRadius: 2,
							p: isMobile ? 0.75 : 1,
						}}
					>
						<Typography variant={isMobile ? 'body2' : 'body1'}>
							{message.content}
						</Typography>
					</Box>
				))}
			</Box>

			{/* Input area */}
			<Box
				sx={{
					p: isMobile ? 3 : 2,
					borderTop: 1,
					borderColor: 'divider',
				}}
			>
				<Box sx={{ display: 'flex', gap: 1 }}>
					<TextField
						fullWidth
						size='small'
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								if (e.shiftKey) {
									// Let Shift+Enter add a newline
									return;
								}
								// Regular Enter sends the message
								e.preventDefault();
								handleSend();
							}
						}}
						placeholder={
							isMobile
								? 'Message...'
								: 'Type your message... (Shift+Enter for new line)'
						}
						disabled={isLoading}
						multiline
						minRows={isMobile ? 2 : 2}
						maxRows={isMobile ? 4 : 8}
						sx={{
							'& .MuiOutlinedInput-root': {
								alignItems: 'flex-start',
							},
						}}
					/>
					<IconButton
						onClick={handleSend}
						disabled={!input.trim() || isLoading}
						color='primary'
						sx={{ mt: isMobile ? 0 : 0.5 }}
					>
						{isLoading ? (
							<CircularProgress size={isMobile ? 20 : 24} />
						) : (
							<SendIcon
								fontSize={isMobile ? 'small' : 'medium'}
							/>
						)}
					</IconButton>
				</Box>
			</Box>
		</Box>
	);
}
