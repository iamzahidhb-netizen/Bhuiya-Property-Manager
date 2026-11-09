import React, { useMemo } from 'react';
import type { PageTransitionStyle, AnimationSpeed } from '../../../types/settings';
import type { NavigationDirection } from '../../../contexts/NavigationContext';

export interface PageTransitionContainerProps {
  transitionKey: string;
  direction: NavigationDirection;
  style?: PageTransitionStyle;
  speed?: AnimationSpeed;
  reducedMotion?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * PageTransitionContainer: Centralized, GPU-accelerated page transition controller.
 * Supports:
 * - 5 Page transition styles: Default (Fade + Slide), Roll (3D), Cube (3D), Flip (3D), Card (Layered)
 * - 3 Animation speeds: Slow (450ms), Normal (300ms), Fast (180ms)
 * - Direction-aware navigation: forward vs backward
 * - Reduced-motion accessibility fallback
 * - Zero animation on same-page or initial load
 */
export const PageTransitionContainer: React.FC<PageTransitionContainerProps> = ({
  transitionKey,
  direction,
  style = 'default',
  speed = 'normal',
  reducedMotion = false,
  className = '',
  children,
}) => {
  const speedClass = useMemo(() => {
    switch (speed) {
      case 'slow':
        return 'hyper-speed-slow';
      case 'fast':
        return 'hyper-speed-fast';
      case 'normal':
      default:
        return 'hyper-speed-normal';
    }
  }, [speed]);

  const animationClass = useMemo(() => {
    if (direction === 'none') {
      return '';
    }
    if (reducedMotion) {
      return 'hyper-fade-only';
    }
    const dirSuffix = direction === 'backward' ? 'backward' : 'forward';
    return `hyper-trans-${style}-${dirSuffix}`;
  }, [direction, style, reducedMotion]);

  return (
    <div
      className={`hyper-page-transition-viewport ${speedClass} ${
        reducedMotion ? 'hyper-reduced-motion' : ''
      }`}
      data-transition-key={transitionKey}
      data-transition-direction={direction}
      data-transition-style={style}
    >
      <div
        key={transitionKey}
        className={`hyper-page-transition-content ${animationClass} ${className}`}
      >
        {children}
      </div>
    </div>
  );
};

export default PageTransitionContainer;
