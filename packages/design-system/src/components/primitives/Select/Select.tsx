'use client';

/**
 * Select — custom dropdown, keyboard navigable, animated.
 * Replaces native <select> with a fully controllable component.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
}

// Chevron icon
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value: controlledValue,
      defaultValue,
      placeholder = 'Select an option',
      label,
      error,
      hint,
      disabled = false,
      fullWidth = false,
      onChange,
      className,
      id: idProp,
    },
    ref
  ) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const listboxId = `${id}-listbox`;
    const errorId = `${id}-error`;

    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);

    const value = controlledValue ?? internalValue;
    const selectedOption = options.find((o) => o.value === value);
    const hasError = Boolean(error);

    const open = useCallback(() => {
      if (disabled) return;
      setIsOpen(true);
      const idx = options.findIndex((o) => o.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }, [disabled, options, value]);

    const close = useCallback(() => {
      setIsOpen(false);
      setFocusedIndex(-1);
      triggerRef.current?.focus();
    }, []);

    const select = useCallback(
      (option: SelectOption) => {
        if (option.disabled) return;
        if (controlledValue === undefined) setInternalValue(option.value);
        onChange?.(option.value);
        close();
      },
      [controlledValue, onChange, close]
    );

    // Keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;
        const enabledOptions = options.filter((o) => !o.disabled);

        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (!isOpen) { open(); return; }
            if (focusedIndex >= 0) select(options[focusedIndex]);
            break;
          case 'Escape':
            e.preventDefault();
            close();
            break;
          case 'ArrowDown':
            e.preventDefault();
            if (!isOpen) { open(); return; }
            setFocusedIndex((prev) => {
              const next = prev + 1;
              return next < options.length ? next : prev;
            });
            break;
          case 'ArrowUp':
            e.preventDefault();
            setFocusedIndex((prev) => {
              const next = prev - 1;
              return next >= 0 ? next : 0;
            });
            break;
          case 'Tab':
            if (isOpen) close();
            break;
        }
      },
      [close, disabled, focusedIndex, isOpen, open, options, select]
    );

    // Scroll focused option into view
    useEffect(() => {
      if (!isOpen || focusedIndex < 0) return;
      const el = listboxRef.current?.children[focusedIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }, [focusedIndex, isOpen]);

    // Close on outside click
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (!triggerRef.current?.contains(target) && !listboxRef.current?.contains(target)) {
          close();
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [close, isOpen]);

    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-1', fullWidth ? 'w-full' : 'w-auto inline-flex flex-col', className)}
      >
        {label && (
          <label
            id={`${id}-label`}
            htmlFor={id}
            className="text-sm font-medium text-text-secondary font-body"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {/* Trigger button */}
          <button
            ref={triggerRef}
            id={id}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-labelledby={label ? `${id}-label` : undefined}
            aria-describedby={hasError ? errorId : undefined}
            aria-invalid={hasError}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onClick={() => (isOpen ? close() : open())}
            className={cn(
              'flex items-center justify-between w-full',
              'min-h-touch px-3 py-2',
              'rounded-md border',
              'bg-surface-2 text-left',
              'font-body text-base',
              'transition-all duration-fast ease-standard',
              'outline-none',
              hasError
                ? 'border-error'
                : isOpen
                ? 'border-black dark:border-white shadow-focus'
                : 'border-surface-3 hover:border-surface-4',
              disabled && 'opacity-50 cursor-not-allowed',
              !selectedOption && 'text-text-secondary',
              selectedOption && 'text-text-primary',
            )}
          >
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown
              className={cn(
                'shrink-0 ml-2 text-text-secondary',
                'transition-transform duration-fast ease-standard',
                isOpen && 'rotate-180',
              )}
            />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <ul
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              aria-label={label ?? 'Options'}
              className={cn(
                'absolute left-0 right-0 z-dropdown',
                'mt-1 py-1',
                'bg-surface-1 rounded-md shadow-3',
                'border border-surface-3',
                'max-h-60 overflow-y-auto',
                'animate-scale-in',
              )}
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled}
                  onClick={() => select(option)}
                  className={cn(
                    'flex items-center justify-between',
                    'px-3 py-2.5 cursor-pointer',
                    'font-body text-base',
                    'transition-colors duration-fast ease-standard',
                    option.disabled && 'opacity-40 cursor-not-allowed',
                    !option.disabled && index === focusedIndex && 'bg-surface-2',
                    !option.disabled && option.value === value && 'font-semibold',
                    !option.disabled && 'hover:bg-surface-2',
                  )}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasError && (
          <p id={errorId} role="alert" className="text-xs text-error font-medium pl-1">
            {error}
          </p>
        )}
        {!hasError && hint && (
          <p className="text-xs text-text-secondary pl-1">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
