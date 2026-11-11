/**
 * Bhuiya Property Manager — Design System Gallery (Development Only)
 * Displays color tokens, themes, typography, and formatters
 *
 * Invariants:
 * - Development-only component
 * - Cannot be accessed in production build
 * - S1a: No changes to services or business logic
 */

import { ThemeProvider, useTheme, type ThemePreference } from '../../contexts/ThemeContext';
import {
  formatMoney,
  formatDate,
  formatMonth,
  formatNumber,
} from '../../utils/uiFormatters';

// Gallery Component
function DesignSystemGallery() {
  const { theme, setTheme } = useTheme();

  const themes = ['light', 'dark', 'oled'] as const;
  const themeNames: Record<string, string> = {
    light: 'Light',
    dark: 'Dark',
    oled: 'OLED',
  };

  const handleThemeChange = (newTheme: ThemePreference) => {
    setTheme(newTheme);
  };

  const sampleValues = {
    money: [125000, -5000, 12500000],
    date: new Date('2026-11-10'),
    month: '2026-11',
    number: [1234, 567890, 1234567890],
  };

  return (
    <div className="gallery-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="gallery-header" style={{ marginBottom: '2rem' }}>
        <h1>Design System Gallery</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Development-only component for reviewing design tokens and theme variables
        </p>
      </div>

      {/* Theme Selector */}
      <div className="theme-selector" style={{ marginBottom: '2rem' }}>
        <h2>Theme Selector</h2>
        <div className="theme-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {themes.map((t) => (
            <button
              key={t}
              onClick={() => handleThemeChange(t)}
              style={{
                padding: '0.75rem 1.5rem',
                border: `2px solid ${t === theme ? 'var(--color-primary-fill)' : 'var(--border-subtle)'}`,
                borderRadius: '8px',
                backgroundColor: t === theme ? 'var(--color-primary-fill)' : 'var(--surface-canvas)',
                color: t === theme ? '#FFFFFF' : 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              {themeNames[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Color Tokens */}
      <div className="color-tokens" style={{ marginBottom: '3rem' }}>
        <h2>Color Tokens (Fill + Ink)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {['primary', 'secondary', 'info', 'warning', 'danger', 'admin'].map((role) => (
            <div
              key={role}
              className="color-token"
              style={{
                padding: '1.5rem',
                borderRadius: '12px',
                backgroundColor: `var(--color-${role}-fill)`,
                color: `var(--color-${role}-ink)`,
                boxShadow: 'var(--shadow-card)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontWeight: '700', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                Fill: var(--color-{role}-fill)<br />
                Ink: var(--color-{role}-ink)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme Surfaces */}
      <div className="theme-surfaces" style={{ marginBottom: '3rem' }}>
        <h2>Theme Surfaces</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {[
            { name: 'Canvas', value: 'var(--surface-canvas)' },
            { name: 'Card', value: 'var(--surface-card)' },
            { name: 'Card Subtle', value: 'var(--surface-card-subtle)' },
            { name: 'Input', value: 'var(--surface-input)' },
            { name: 'Hover', value: 'var(--surface-hover)' },
            { name: 'Border', value: 'var(--border-subtle)' },
          ].map((surface) => (
            <div
              key={surface.name}
              className="theme-surface"
              style={{
                padding: '2rem',
                borderRadius: '12px',
                backgroundColor: surface.value,
                border: `2px solid ${theme === 'light' ? '#E0E2E5' : '#2D3036'}`,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ fontWeight: '700', marginBottom: '0.5rem', color: theme === 'light' ? '#202124' : '#F5F5F5' }}>
                {surface.name}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                {surface.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="typography" style={{ marginBottom: '3rem' }}>
        <h2>Typography</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { size: 'h1', text: 'Heading 1' },
            { size: 'h2', text: 'Heading 2' },
            { size: 'h3', text: 'Heading 3' },
            { size: 'h4', text: 'Heading 4' },
            { size: 'h5', text: 'Heading 5' },
            { size: 'h6', text: 'Heading 6' },
            { size: 'body', text: 'Body text with proper line-height (1.5)' },
          ].map((typo) => (
            <div
              key={typo.size}
              className="typography-sample"
              style={{
                padding: '1rem',
                borderRadius: '12px',
                backgroundColor: 'var(--surface-card)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                style={{
                  fontSize: typo.size === 'body' ? '1rem' : typo.size === 'h1' ? '2.5rem' : typo.size === 'h2' ? '2rem' : typo.size === 'h3' ? '1.75rem' : typo.size === 'h4' ? '1.5rem' : typo.size === 'h5' ? '1.25rem' : '1rem',
                  fontWeight: typo.size === 'body' ? '400' : '700',
                  lineHeight: typo.size === 'body' ? '1.5' : '1.3',
                  color: 'var(--text-primary)',
                }}
              >
                {typo.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Formatters */}
      <div className="formatters" style={{ marginBottom: '3rem' }}>
        <h2>Formatters</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {/* Money Formatter */}
          <div
            className="formatter-card"
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-card)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              formatMoney()
            </div>
            {sampleValues.money.map((amount) => (
              <div
                key={amount}
                style={{
                  fontSize: '1rem',
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {formatMoney(amount, { useBanglaDigits: true })}
              </div>
            ))}
          </div>

          {/* Date Formatter */}
          <div
            className="formatter-card"
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-card)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              formatDate()
            </div>
            <div
              style={{
                fontSize: '1rem',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              {formatDate(sampleValues.date, { locale: 'bn', useBanglaDigits: true })}
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
              }}
            >
              {formatDate(sampleValues.date, { locale: 'en', useBanglaDigits: false })}
            </div>
          </div>

          {/* Month Formatter */}
          <div
            className="formatter-card"
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-card)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              formatMonth()
            </div>
            <div
              style={{
                fontSize: '1rem',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              {formatMonth(sampleValues.month, { locale: 'bn', useBanglaDigits: true })}
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
              }}
            >
              {formatMonth(sampleValues.month, { locale: 'en', useBanglaDigits: false })}
            </div>
          </div>

          {/* Number Formatter */}
          <div
            className="formatter-card"
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-card)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              formatNumber()
            </div>
            {sampleValues.number.map((num) => (
              <div
                key={num}
                style={{
                  fontSize: '1rem',
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {formatNumber(num, { useBanglaDigits: true })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Theme Comparison */}
      <div className="theme-comparison" style={{ marginBottom: '3rem' }}>
        <h2>Theme Comparison</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {themes.map((t) => (
            <div
              key={t}
              className="theme-comparison-card"
              style={{
                padding: '1.5rem',
                borderRadius: '12px',
                backgroundColor: t === 'light' ? '#F2F3F5' : t === 'dark' ? '#0B0D10' : '#000000',
                border: t === theme ? '3px solid var(--color-primary-fill)' : '2px solid transparent',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ fontWeight: '700', marginBottom: '1rem', color: t === 'light' ? '#202124' : '#F5F5F5' }}>
                {themeNames[t]} Theme
              </div>
              <div style={{ fontSize: '0.875rem', color: t === 'light' ? '#5F6368' : '#B0B3B8' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  Canvas: {t === 'light' ? '#F2F3F5' : t === 'dark' ? '#0B0D10' : '#000000'}
                </div>
                <div>
                  Text Primary: {t === 'light' ? '#202124' : '#F5F5F5'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Example */}
      <div className="code-example" style={{ marginBottom: '3rem' }}>
        <h2>Using Theme Variables in Components</h2>
        <div
          className="code-block"
          style={{
            padding: '1.5rem',
            borderRadius: '12px',
            backgroundColor: 'var(--surface-card)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: '1.6',
            color: 'var(--text-secondary)',
          }}
        >
          <pre>{`// Access theme variables directly in CSS
.button {
  background-color: var(--color-primary-fill);
  color: var(--color-primary-ink);
}

.card {
  background-color: var(--surface-card);
  border: 1px solid var(--border-subtle);
}

// Access in TypeScript/JavaScript
import { useTheme } from '@/contexts/ThemeContext';
import { formatMoney } from '@/utils/uiFormatters';

function MyComponent() {
  const { theme } = useTheme();
  
  return (
    <div style={{
      backgroundColor: theme === 'oled' ? '#000000' : theme === 'dark' ? '#0B0D10' : '#F2F3F5',
      color: 'var(--text-primary)',
    }}>
      <span>{formatMoney(125000, { useBanglaDigits: true })}</span>
    </div>
  );
}`}</pre>
        </div>
      </div>
    </div>
  );
}

// Main Gallery Component
export function DesignSystemGalleryWrapper() {
  return (
    <ThemeProvider>
      <DesignSystemGallery />
    </ThemeProvider>
  );
}

export default DesignSystemGalleryWrapper;
