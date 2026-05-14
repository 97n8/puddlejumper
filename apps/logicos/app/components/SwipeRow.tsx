import { useState, useRef, type ReactNode, type TouchEvent } from 'react';

interface SwipeRowProps {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  children: ReactNode;
  threshold?: number;
}

export function SwipeRow({
  onSwipeRight,
  onSwipeLeft,
  children,
  threshold = 100
}: SwipeRowProps) {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const swipeTriggeredRef = useRef(false);

  const handleTouchStart = (e: TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
    swipeTriggeredRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping) return;
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;

    const dx = currentX - startX;

    if (Math.abs(dx) > threshold && !swipeTriggeredRef.current) {
      swipeTriggeredRef.current = true;
      if (dx > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (dx < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setIsSwiping(false);
    setStartX(0);
    setCurrentX(0);
  };

  const offset = isSwiping ? currentX - startX : 0;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${Math.max(-50, Math.min(50, offset))}px)`,
        transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
      }}
    >
      {children}
    </div>
  );
}
