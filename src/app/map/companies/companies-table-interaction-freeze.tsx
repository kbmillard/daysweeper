'use client';

import { useEffect, useRef } from 'react';

type Props = {
  active: boolean;
  children: React.ReactNode;
};

/** Blocks pointer and wheel on the table area (demo: open companies from map pins only). */
export function CompaniesTableInteractionFreeze({ active, children }: Props) {
  const blockerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const el = blockerRef.current;
    if (!el) return;
    const stopWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const stopTouch = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('wheel', stopWheel, { passive: false });
    el.addEventListener('touchmove', stopTouch, { passive: false });
    return () => {
      el.removeEventListener('wheel', stopWheel);
      el.removeEventListener('touchmove', stopTouch);
    };
  }, [active]);

  if (!active) return children;

  return (
    <div className='relative isolate'>
      <div className='pointer-events-none select-none'>{children}</div>
      <div
        ref={blockerRef}
        className='absolute inset-0 z-20 cursor-not-allowed touch-none bg-transparent'
        aria-hidden
        style={{ pointerEvents: 'auto' }}
      />
    </div>
  );
}
