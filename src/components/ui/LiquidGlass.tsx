import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { liquidGlass, type LiquidGlassOptions, type LiquidGlassInstance, isLiquidGlassSupported } from '../../lib/liquid-glass';

export interface LiquidGlassProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
  /** Displacement strength (negative = magnifying bulge; range: -60 to -180). Default: -112 */
  scale?: number;
  /** Per-channel scale stagger for prism fringe. 0 disables. Default: 6 */
  chroma?: number;
  /** Neutral interior inset as fraction of smaller side. Default: 0.07 */
  border?: number;
  /** Edge-curvature softness (px) of the map's gray inset. Default: 12 */
  mapBlur?: number;
  /** Backdrop blur (px) behind the glass interior. Default: 3 */
  blur?: number;
  /** Backdrop saturation boost. Default: 1.5 */
  saturate?: number;
  /** Corner radius override (px); defaults to reading computed border-radius */
  radius?: number | null;
  /** Frosted blur fallback (px) on Safari/Firefox/unsupported. Default: 16 */
  fallbackBlur?: number;
  /** Enable dynamic cursor-tracked specular glare overlay. Default: true */
  glare?: boolean;
}

export interface LiquidGlassHandle {
  refresh: () => void;
  destroy: () => void;
  getElement: () => HTMLElement | null;
  isSupported: boolean;
}

export const LiquidGlass = forwardRef<LiquidGlassHandle, LiquidGlassProps>(function LiquidGlass(
  {
    children,
    className = '',
    style,
    as: Component = 'div',
    scale = -112,
    chroma = 6,
    border = 0.07,
    mapBlur = 12,
    blur = 3,
    saturate = 1.5,
    radius = null,
    fallbackBlur = 16,
    glare = true,
    onPointerMove,
    ...rest
  },
  ref
) {
  const innerRef = useRef<HTMLElement | null>(null);
  const instanceRef = useRef<LiquidGlassInstance | null>(null);

  useImperativeHandle(ref, () => ({
    refresh: () => instanceRef.current?.refresh(),
    destroy: () => instanceRef.current?.destroy(),
    getElement: () => innerRef.current,
    isSupported: isLiquidGlassSupported,
  }));

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const options: LiquidGlassOptions = {
      scale,
      chroma,
      border,
      mapBlur,
      blur,
      saturate,
      radius,
      fallbackBlur,
    };

    instanceRef.current = liquidGlass(el, options);

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [scale, chroma, border, mapBlur, blur, saturate, radius, fallbackBlur]);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    // Disable glare calculation during touch/mobile gestures to prevent scroll jank
    if (glare && innerRef.current && e.pointerType !== 'touch') {
      const rect = innerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const gx = (((e.clientX - rect.left) / rect.width) * 100).toFixed(1) + '%';
        const gy = (((e.clientY - rect.top) / rect.height) * 100).toFixed(1) + '%';
        innerRef.current.style.setProperty('--gx', gx);
        innerRef.current.style.setProperty('--gy', gy);
      }
    }
    if (onPointerMove) {
      onPointerMove(e);
    }
  };

  const combinedClassName = `liquid-glass-card ${glare ? 'liquid-glass-glare' : ''} ${className}`.trim();

  return (
    <Component
      ref={innerRef}
      className={combinedClassName}
      style={style}
      onPointerMove={handlePointerMove}
      {...rest}
    >
      {children}
    </Component>
  );
});

export default LiquidGlass;
