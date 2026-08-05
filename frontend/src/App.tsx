import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import AppRoutes from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { theme } from './theme';
import { FloatingStudyTimer, StudySessionFinishHost } from './components/shared';
import { useStudyTimerSync } from './hooks/useStudyTimerSync';

// Markdown rendering styles
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';

function AppContent() {
  // 別タブでタイマーを終了したときに、このタブのタイマーも止まるようにする
  useStudyTimerSync();

  return (
    <BrowserRouter basename={process.env.PUBLIC_URL || '/'}>
      <AnimatePresence mode="wait">
        <AppRoutes />
      </AnimatePresence>
      {/* タイマーと学習終了カードはルート遷移で消えないよう AppRoutes の外に常駐させる */}
      <FloatingStudyTimer />
      <StudySessionFinishHost />
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
