import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Error as ErrorIcon,
  ExpandMore,
  Refresh
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error Stack:', error.stack);

  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box sx={{ p: 3, m: 2 }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h4" component="h2" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              An error occurred while rendering this component.
            </Typography>

            {this.state.error && (
              <Accordion sx={{ mb: 3, textAlign: 'left' }}>
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  aria-controls="error-details-content"
                  id="error-details-header"
                >
                  <Typography variant="subtitle1">Error Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="error">
                    <Box
                      component="pre"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        m: 0,
                        overflow: 'auto'
                      }}
                    >
                      {this.state.error.toString()}
                    </Box>
                  </Alert>
                </AccordionDetails>
              </Accordion>
            )}

            <Button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              variant="contained"
              startIcon={<Refresh />}
              size="large"
            >
              Try Again
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;