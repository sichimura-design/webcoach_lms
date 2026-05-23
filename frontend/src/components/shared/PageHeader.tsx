import React from 'react';
import { Box, Container, Typography, IconButton } from '@mui/material';
import { ArrowBack, Home } from '@mui/icons-material';
import { COLORS, SPACING } from '../../theme';

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  onHome?: () => void;
  actions?: React.ReactNode[];
  backgroundColor?: string;
  textColor?: string;
  variant?: 'dark' | 'light' | 'primary';
}

/**
 * Centralized page header component
 * Replaces multiple navigation bar implementations
 */
function PageHeader({
  title,
  onBack,
  onHome,
  actions = [],
  backgroundColor,
  textColor,
  variant = 'light',
}: PageHeaderProps) {
  // Determine colors based on variant
  const getColors = () => {
    if (backgroundColor && textColor) {
      return { bg: backgroundColor, text: textColor };
    }

    switch (variant) {
      case 'dark':
        return { bg: COLORS.darkNav, text: COLORS.textWhite };
      case 'primary':
        return { bg: COLORS.primary, text: COLORS.textWhite };
      case 'light':
      default:
        return { bg: COLORS.whiteBg, text: COLORS.textPrimary };
    }
  };

  const colors = getColors();
  const borderColor = variant === 'light' ? COLORS.borderLight : 'transparent';

  return (
    <Box
      sx={{
        bgcolor: colors.bg,
        borderBottom: `1px solid ${borderColor}`,
        py: SPACING.md,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
          }}
        >
          {/* Navigation buttons */}
          {onHome && (
            <IconButton
              onClick={onHome}
              sx={{ color: colors.text }}
              size="medium"
            >
              <Home />
            </IconButton>
          )}
          {onBack && (
            <IconButton
              onClick={onBack}
              sx={{ color: colors.text }}
              size="medium"
            >
              <ArrowBack />
            </IconButton>
          )}

          {/* Title */}
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              color: colors.text,
              fontWeight: 600,
            }}
          >
            {title}
          </Typography>

          {/* Action buttons */}
          {actions.map((action, index) => (
            <React.Fragment key={index}>{action}</React.Fragment>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default PageHeader;
