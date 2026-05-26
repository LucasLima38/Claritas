import './i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import './index.css'

// Apply theme class immediately before React renders to avoid flash
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.toggle('dark', isDark)

// Listen for theme changes from main process
window.electronAPI.onThemeChanged(({ isDark }) => {
  document.documentElement.classList.toggle('dark', isDark)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
)
