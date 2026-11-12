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
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
