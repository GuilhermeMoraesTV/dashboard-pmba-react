import { useEffect } from 'react';

let lockCount = 0;
let savedState = null;

export function useBodyScrollLock(isLocked = true, options = {}) {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const body = document.body;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (lockCount === 0) {
      savedState = {
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
        overflow: body.style.overflow,
        overscrollBehavior: body.style.overscrollBehavior,
        scrollY,
      };

      body.style.position = options.fixed === false ? savedState.position : 'fixed';
      body.style.top = options.fixed === false ? savedState.top : `-${scrollY}px`;
      body.style.width = options.fixed === false ? savedState.width : '100%';
      body.style.overflow = 'hidden';
      if (options.overscrollBehavior) body.style.overscrollBehavior = options.overscrollBehavior;
      if (options.bodyClass) body.classList.add(options.bodyClass);
    } else if (options.bodyClass) {
      body.classList.add(options.bodyClass);
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (options.bodyClass) body.classList.remove(options.bodyClass);
      if (lockCount !== 0 || !savedState) return;

      const restoreY = savedState.scrollY || 0;
      body.style.position = savedState.position;
      body.style.top = savedState.top;
      body.style.width = savedState.width;
      body.style.overflow = savedState.overflow;
      body.style.overscrollBehavior = savedState.overscrollBehavior;
      savedState = null;
      if (options.restoreScroll !== false) window.scrollTo(0, restoreY);
    };
  }, [isLocked, options.bodyClass, options.fixed, options.overscrollBehavior, options.restoreScroll]);
}

export default useBodyScrollLock;
