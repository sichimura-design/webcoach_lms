/**
 * Spacing constants for consistent layout
 * Used with MUI's spacing system (1 = 8px by default)
 */

export const SPACING = {
  xs: 0.5,  // 4px
  sm: 1,    // 8px
  md: 2,    // 16px
  lg: 3,    // 24px
  xl: 4,    // 32px
  xxl: 6,   // 48px
} as const;

/**
 * Gap values for flexbox and grid layouts
 */
export const GAPS = {
  xs: '0.5rem',   // 8px
  sm: '1rem',     // 16px
  md: '1.5rem',   // 24px
  lg: '2rem',     // 32px
  xl: '3rem',     // 48px
} as const;

/**
 * Container max widths
 */
export const CONTAINER_WIDTHS = {
  sm: 'sm',   // 600px
  md: 'md',   // 900px
  lg: 'lg',   // 1200px
  xl: 'xl',   // 1536px
} as const;
