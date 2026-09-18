import React from 'react'
import ReactDOM from 'react-dom/client'
import { initConsoleGuard } from './utils/consoleGuard'
import App from './App.jsx'
import AppErrorBoundary from './components/shared/AppErrorBoundary.jsx'
import './index.css';

initConsoleGuard();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)
