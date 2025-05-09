import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { collectDebugLogs } from './utils/debug'

// Make debug utility available globally
if (typeof window !== 'undefined') {
  (window as any).collectDebugLogs = collectDebugLogs;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
