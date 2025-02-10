import React, { createContext, useContext, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatContextType {
  messages: Message[]
  sendMessage: (content: string) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])

  const sendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content
    }
    setMessages(prev => [...prev, userMessage])

    try {
      // TODO: Send to backend API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: content })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      
      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your message.'
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
} 