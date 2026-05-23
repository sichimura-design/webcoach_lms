import React from 'react';
import { Box, Alert, Button, Container } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { SPACING } from '../../theme';

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
  fullHeight?: boolean;
  containerized?: boolean;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Centralized error state component
 * Replaces 4+ duplicated implementations across the codebase
 */
function ErrorState({
  error,
  onRetry,
  fullHeight = false,
  containerized = true,
  severity = 'error',
}: ErrorStateProps) {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: fullHeight ? '100vh' : 'auto',
        py: SPACING.xl,
      }}
    >
      <Alert
        severity={severity}
        sx={{
          maxWidth: 600,
          width: '100%',
        }}
        action={
          onRetry && (
            <Button
              color="inherit"
              size="small"
              startIcon={<Refresh />}
              onClick={onRetry}
            >
              再試行
            </Button>
          )
        }
      >
        {error}
      </Alert>
    </Box>
  );

  if (containerized) {
    return (
      <Container maxWidth="lg" sx={{ py: SPACING.lg }}>
        {content}
      </Container>
    );
  }

  return content;
};

export default ErrorState;
