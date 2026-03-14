'use client';

/**
 * Tabs — animated sliding indicator. Keyboard navigable.
 * Used for switching between content panels.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../../../utils/cn';

// Context
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  baseId: string;
}
const TabsContext = createContext<TabsContextValue | null>(null);
const useTabsContext = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used inside <Tabs>');
  return ctx;
};

// ─── Tabs Root ────────────────────────────────────────────────

export interface TabsProps {
  defaultTab?: string;
  value?: string;
  onChange?: (tab: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultTab,
  value: controlledValue,
  onChange,
  children,
  className,
}: TabsProps) {
  const baseId = useId();
  const [internalTab, setInternalTab] = useState(defaultTab ?? '');
  const activeTab = controlledValue ?? internalTab;

  const setActiveTab = useCallback(
    (id: string) => {
      if (controlledValue === undefined) setInternalTab(id);
      onChange?.(id);
    },
    [controlledValue, onChange]
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
      <div className={cn('flex flex-col', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// ─── TabList ──────────────────────────────────────────────────

export interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className }: TabListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const { activeTab } = useTabsContext();

  // Animate sliding indicator
  useEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const activeEl = list.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (!activeEl) return;

    const listRect = list.getBoundingClientRect();
    const tabRect  = activeEl.getBoundingClientRect();

    indicator.style.width  = `${tabRect.width}px`;
    indicator.style.left   = `${tabRect.left - listRect.left}px`;
    indicator.style.opacity = '1';
  }, [activeTab]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn(
        'relative flex',
        'border-b border-surface-3',
        className,
      )}
    >
      {children}
      {/* Sliding indicator */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        className={cn(
          'absolute bottom-0 h-0.5',
          'bg-black dark:bg-white rounded-full',
          'transition-all duration-normal ease-spring',
          'opacity-0',
        )}
      />
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────

export interface TabProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Tab({ value, children, disabled, className }: TabProps) {
  const { activeTab, setActiveTab, baseId } = useTabsContext();
  const isActive = activeTab === value;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) setActiveTab(value);
    }
  };

  return (
    <button
      role="tab"
      type="button"
      id={`${baseId}-tab-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={isActive}
      data-active={isActive}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative px-4 py-3 min-h-touch',
        'font-body text-sm font-medium',
        'transition-colors duration-fast ease-standard',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
        isActive
          ? 'text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── TabPanel ─────────────────────────────────────────────────

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const { activeTab, baseId } = useTabsContext();
  const isActive = activeTab === value;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cn('animate-fade-in', className)}
    >
      {children}
    </div>
  );
}
