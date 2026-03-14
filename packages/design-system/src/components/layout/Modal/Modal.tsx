'use client';

/**
 * Modal — backdrop blur, spring animation, keyboard trap, focus management.
 * Closes on backdrop click and Escape key.
 * WCAG 2.1 AA compliant: focus trap, aria-modal, aria-labelledby.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../utils/cn';
import { Button } from '../../primitives/Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Max width variant */
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Show default close button in header */
  showClose?: boolean;
  children: ReactNode;
  /** Footer — typically action buttons */
  footer?: ReactNode;
  className?: string;
}

const sizeClasses = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  full: 'max-w-full mx-4',
};

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function useFocusTrap(ref: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [active, ref]);
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  showClose = true,
  children,
  footer,
  className,
}: ModalProps) {
  const titleId = useId();
  const descId  = useId();
  const dialogRef = useRef<HTMLDivElement>(null!);

  useFocusTrap(dialogRef, isOpen);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen && typeof window === 'undefined') return null;
  if (!isOpen) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-modal flex items-center justify-center p-4',
        'animate-fade-in',
      )}
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0',
          'bg-surface-overlay',
          'backdrop-blur-md',
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'relative z-10 w-full',
          sizeClasses[size],
          'bg-surface-1 rounded-xl shadow-modal',
          'animate-spring-in',
          'max-h-[90vh] overflow-y-auto',
          'flex flex-col',
          className,
        )}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-4 p-6 pb-0">
            <div>
              {title && (
                <h2
                  id={titleId}
                  className="text-xl font-semibold text-text-primary font-body leading-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-text-secondary font-body">
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className={cn(
                  'shrink-0 flex items-center justify-center',
                  'w-8 h-8 rounded-full',
                  'text-text-secondary hover:text-text-primary',
                  'hover:bg-surface-2',
                  'transition-all duration-fast ease-standard',
                  'outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pb-6 flex items-center justify-end gap-3 flex-wrap">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
