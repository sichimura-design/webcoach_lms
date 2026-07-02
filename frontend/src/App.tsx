import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import AppRoutes from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { theme } from './theme';

// Markdown rendering styles
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';

function AppContent() {
  return (
    <BrowserRouter basename={process.env.PUBLIC_URL || '/'}>
      <AnimatePresence mode="wait">
        <AppRoutes />
      </AnimatePresence>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
