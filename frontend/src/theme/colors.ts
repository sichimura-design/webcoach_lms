/**
 * Color palette for the application
 * Centralizes all color definitions to avoid hardcoding
 */

export const COLORS = {
  // Primary colors
  primary: '#C62828',
  primaryHover: '#8B1A1A',
  primaryLight: '#FF5252',
  primaryDark: '#6D1B1B',

  // Navigation
  darkNav: '#2D2F31',
  lightNav: '#FBE9E7',

  // Backgrounds
  lightBg: '#f5f5f5',
  whiteBg: '#ffffff',
  darkBg: '#1a1a1a',
  lightPink: '#FBE9E7',

  // Text
  textPrimary: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',
  textWhite: '#ffffff',

  // Borders
  borderLight: '#e0e0e0',
  borderMedium: '#bdbdbd',
  borderDark: '#9e9e9e',

  // Status
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',

  // Progress
  progressLow: '#f44336',
  progressMedium: '#ff9800',
  progressHigh: '#4caf50',
} as const;

/**
 * Get progress color based on percentage
 */
export const getProgressColor = (progress: number): string => {
  if (progress >= 80) return COLORS.progressHigh;
  if (progress >= 50) return COLORS.progressMedium;
  return COLORS.progressLow;
};
