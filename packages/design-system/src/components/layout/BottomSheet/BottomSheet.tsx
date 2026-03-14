'use client';

/**
 * BottomSheet — mobile-first, drag to dismiss.
 * Slides up from bottom. Spring animation. Drag handle.
 * Falls back to a modal-style sheet on desktop.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../utils/cn';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Snap points as % of viewport height (default: 50% and 90%) */
  snapPoints?: number[];
  children: ReactNode;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  snapPoints = [50, 90],
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartTranslate = useRef(0);

  const minSnap = Math.min(...snapPoints);
  const maxHeight = Math.max(...snapPoints);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) setTranslateY(0);
  }, [isOpen]);

  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartTranslate.current = translateY;
  }, [translateY]);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const delta = clientY - dragStartY.current;
    const newTranslate = Math.max(0, dragStartTranslate.current + delta);
    setTranslateY(newTranslate);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    const threshold = 100; // px to dismiss
    if (translateY > threshold) {
      onClose();
      setTranslateY(0);
    } else {
      setTranslateY(0); // snap back
    }
  }, [translateY, onClose]);

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY);
  const onTouchMove  = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientY);
  const onTouchEnd   = () => handleDragEnd();

  // Mouse events for desktop testing
  const onMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientY);
  useEffect(() => {
    if (!isDragging) return;
    const move = (e: MouseEvent) => handleDragMove(e.clientY);
    const up   = () => handleDragEnd();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-end"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-surface-overlay backdrop-blur-sm',
          'animate-fade-in',
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          maxHeight: `${maxHeight}vh`,
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        className={cn(
          'relative z-10 w-full',
          'bg-surface-1 rounded-t-2xl shadow-modal',
          'flex flex-col',
          !isDragging && 'animate-slide-in-bottom',
          className,
        )}
      >
        {/* Drag handle */}
        <div
          className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
        >
          <div className="w-10 h-1 rounded-full bg-surface-3" aria-hidden="true" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-6 pb-4">
            <h2 className="text-lg font-semibold text-text-primary font-body">
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
