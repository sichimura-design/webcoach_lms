import React from 'react';
import { Box, CircularProgress, Container, Typography } from '@mui/material';
import { SPACING } from '../../theme';

interface LoadingStateProps {
  message?: string;
  size?: number;
  fullHeight?: boolean;
  containerized?: boolean;
}

/**
 * Centralized loading state component
 * Replaces 4+ duplicated implementations across the codebase
 */
function LoadingState({
  message = '読み込み中...',
  size = 60,
  fullHeight = false,
  containerized = true,
}: LoadingStateProps) {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: fullHeight ? '100vh' : '50vh',
        gap: SPACING.md,
      }}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
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

export default LoadingState;
