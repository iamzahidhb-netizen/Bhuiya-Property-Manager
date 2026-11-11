/**
 * Bhuiya Property Manager — Design System v3.1
 * Centralized Color Tokens & Theme Variables
 *
 * Provides:
 * - Semantic Fill & Ink color pairs for 6 roles
 * - Light, Dark, and OLED theme surfaces
 * - CSS custom properties for React components
 *
 * Invariants:
 * - Does NOT modify existing application logic
 * - Does NOT duplicate font downloads
 * - Preserves offline Android font availability
 * - S1a: No changes to services, rules, or Firebase config
 */

// ============================================================================
// SEMANTIC COLOR PAIRS (Fill + Ink)
// ============================================================================

export const COLOR_PRIMARY: { fill: string; ink: string } = {
  fill: '#22B84A',
  ink: '#064420', // Darker green for text
};

export const COLOR_SECONDARY: { fill: string; ink: string } = {
  fill: '#0D9488',
  ink: '#0F4741', // Teal ink
};

export const COLOR_INFO: { fill: string; ink: string } = {
  fill: '#1685E8',
  ink: '#0D345C', // Blue ink
};

export const COLOR_WARNING: { fill: string; ink: string } = {
  fill: '#F28A24',
  ink: '#7A3A00', // Orange ink
};

export const COLOR_DANGER: { fill: string; ink: string } = {
  fill: '#E94B4B',
  ink: '#7A1F1F', // Red ink
};

export const COLOR_ADMIN: { fill: string; ink: string } = {
  fill: '#7655E8',
  ink: '#3A1F7A', // Purple ink
};

// ============================================================================
// THEME SURFACES
// ============================================================================

export const THEME_LIGHT: {
  canvas: string;
  card: string;
  cardSubtle: string;
  input: string;
  hover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  divider: string;
} = {
  canvas: '#F2F3F5',
  card: '#FFFFFF',
  cardSubtle: '#F8F9FA',
  input: '#FFFFFF',
  hover: '#F0F2F5',
  border: '#E0E2E5',
  textPrimary: '#202124',
  textSecondary: '#5F6368',
  textMuted: '#8F9499',
  divider: '#E0E2E5',
};

export const THEME_DARK: {
  canvas: string;
  card: string;
  cardSubtle: string;
  input: string;
  hover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  divider: string;
} = {
  canvas: '#0B0D10',
  card: '#181A1F',
  cardSubtle: '#222529',
  input: '#222529',
  hover: '#2A2D33',
  border: '#2D3036',
  textPrimary: '#F5F5F5',
  textSecondary: '#B0B3B8',
  textMuted: '#6E7177',
  divider: '#2D3036',
};

export const THEME_OLED: {
  canvas: string;
  card: string;
  cardSubtle: string;
  input: string;
  hover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  divider: string;
} = {
  canvas: '#000000',
  card: '#0A0A0A',
  cardSubtle: '#121212',
  input: '#121212',
  hover: '#1A1A1A',
  border: '#1A1A1A',
  textPrimary: '#F5F5F5',
  textSecondary: '#B0B3B8',
  textMuted: '#6E7177',
  divider: '#1A1A1A',
};

// ============================================================================
// CSS CUSTOM PROPERTIES (Generated dynamically)
// ============================================================================

export function generateCSSVars(theme: 'light' | 'dark' | 'oled'): string {
  const themeVars =
    theme === 'oled'
      ? THEME_OLED
      : theme === 'dark'
      ? THEME_DARK
      : THEME_LIGHT;

  return `
    :root {
      /* Color Tokens */
      --color-primary-fill: ${COLOR_PRIMARY.fill};
      --color-primary-ink: ${COLOR_PRIMARY.ink};
      --color-secondary-fill: ${COLOR_SECONDARY.fill};
      --color-secondary-ink: ${COLOR_SECONDARY.ink};
      --color-info-fill: ${COLOR_INFO.fill};
      --color-info-ink: ${COLOR_INFO.ink};
      --color-warning-fill: ${COLOR_WARNING.fill};
      --color-warning-ink: ${COLOR_WARNING.ink};
      --color-danger-fill: ${COLOR_DANGER.fill};
      --color-danger-ink: ${COLOR_DANGER.ink};
      --color-admin-fill: ${COLOR_ADMIN.fill};
      --color-admin-ink: ${COLOR_ADMIN.ink};

      /* Theme Surfaces */
      --surface-canvas: ${themeVars.canvas};
      --surface-card: ${themeVars.card};
      --surface-card-subtle: ${themeVars.cardSubtle};
      --surface-input: ${themeVars.input};
      --surface-hover: ${themeVars.hover};
      --border-subtle: ${themeVars.border};
      --border-divider: ${themeVars.divider};

      /* Text Colors */
      --text-primary: ${themeVars.textPrimary};
      --text-secondary: ${themeVars.textSecondary};
      --text-muted: ${themeVars.textMuted};

      /* Shadows */
      --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);
      --shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.12);
    }
  `;
}

// ============================================================================
// THEME UTILITY FUNCTIONS
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'oled';

export function getThemeSurface(
  theme: ThemeMode,
  surface: keyof typeof THEME_LIGHT
): string {
  if (theme === 'oled') return THEME_OLED[surface];
  if (theme === 'dark') return THEME_DARK[surface];
  return THEME_LIGHT[surface];
}

export function getTextColor(theme: ThemeMode, level: 'primary' | 'secondary' | 'muted'): string {
  const themeVars =
    theme === 'oled'
      ? THEME_OLED
      : theme === 'dark'
      ? THEME_DARK
      : THEME_LIGHT;

  switch (level) {
    case 'primary':
      return themeVars.textPrimary;
    case 'secondary':
      return themeVars.textSecondary;
    case 'muted':
      return themeVars.textMuted;
    default:
      return themeVars.textPrimary;
  }
}

export function getTintedSurface(
  theme: ThemeMode,
  fillColor: string
): string {
  // Convert hex to RGB and darken/lighten for tint
  const hex = fillColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create tinted version (lighten for dark themes, darken for light themes)
  const isDark = theme === 'dark' || theme === 'oled';
  const factor = isDark ? 1.5 : 0.85; // Lighten dark, darken light

  const tintR = Math.round(isDark ? Math.min(r * factor, 255) : Math.max(r * factor, 0));
  const tintG = Math.round(isDark ? Math.min(g * factor, 255) : Math.max(g * factor, 0));
  const tintB = Math.round(isDark ? Math.min(b * factor, 255) : Math.max(b * factor, 0));

  return `#${tintR.toString(16).padStart(2, '0')}${tintG.toString(16).padStart(2, '0')}${tintB.toString(16).padStart(2, '0')}`;
}

export function getInkColor(fillColor: string): string {
  const hex = fillColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Determine ink color based on brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // If fill is light, use dark ink; if fill is dark, use light ink
  return brightness > 128 ? '#202124' : '#F5F5F5';
}
