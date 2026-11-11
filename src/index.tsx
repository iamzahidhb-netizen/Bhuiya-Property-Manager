/**
 * Bhuiya Property Manager — App Entry Point
 * Applies global styles and theme system
 *
 * Invariants:
 * - Does NOT modify application logic
 * - Applies theme system globally
 * - S1a: No changes to services or business logic
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { generateCSSVars } from './styles/designTokens';

// Apply theme CSS variables
const themeCSS = generateCSSVars('dark');

// Create a style element to inject theme variables
const styleElement = document.createElement('style');
styleElement.textContent = themeCSS;
document.head.appendChild(styleElement);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
