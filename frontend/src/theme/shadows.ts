/**
 * Shadow definitions for elevation
 */

export const SHADOWS = {
  none: 'none',
  sm: '0 2px 4px rgba(0,0,0,0.1)',
  md: '0 4px 12px rgba(0,0,0,0.15)',
  lg: '0 8px 24px rgba(0,0,0,0.2)',
  xl: '0 12px 32px rgba(0,0,0,0.25)',
  hover: '0 4px 12px rgba(0,0,0,0.15)',
  card: '0 2px 8px rgba(0,0,0,0.1)',
} as const;

/**
 * Border radius values
 */
export const RADIUS = {
  none: 0,
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;
