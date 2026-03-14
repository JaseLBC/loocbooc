'use client';

/**
 * Sidebar — collapsible, active state, mobile-aware.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../../../utils/cn';

// Context
interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
}
const SidebarContext = createContext<SidebarContextValue>({
  isCollapsed: false,
  toggle: () => {},
});
export const useSidebar = () => useContext(SidebarContext);

// ─── Root ─────────────────────────────────────────────────────

export interface SidebarProps {
  children: ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export function Sidebar({ children, defaultCollapsed = false, className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const toggle = useCallback(() => setIsCollapsed((c) => !c), []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle }}>
      <aside
        aria-label="Sidebar"
        className={cn(
          'flex flex-col h-full',
          'bg-surface-1 shadow-1',
          'transition-all duration-normal ease-standard',
          isCollapsed ? 'w-16' : 'w-64',
          className,
        )}
      >
        {children}
      </aside>
    </SidebarContext.Provider>
  );
}

// ─── Toggle button ────────────────────────────────────────────

export function SidebarToggle({ className }: { className?: string }) {
  const { isCollapsed, toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!isCollapsed}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-md',
        'text-text-secondary hover:text-text-primary',
        'hover:bg-surface-2',
        'transition-all duration-fast ease-standard',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        {isCollapsed ? (
          <path d="M3 8h10M3 4h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        ) : (
          <path d="M9 4L5 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

// ─── Section ──────────────────────────────────────────────────

export interface SidebarSectionProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function SidebarSection({ label, children, className }: SidebarSectionProps) {
  const { isCollapsed } = useSidebar();
  return (
    <div className={cn('py-2', className)}>
      {label && !isCollapsed && (
        <p className="px-4 mb-1 text-xs font-semibold tracking-wider text-text-tertiary font-body uppercase">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

// ─── Item ─────────────────────────────────────────────────────

export interface SidebarItemProps {
  href?: string;
  label: string;
  icon?: ReactNode;
  isActive?: boolean;
  badge?: string | number;
  onClick?: () => void;
  linkComponent?: React.ElementType;
  className?: string;
}

export function SidebarItem({
  href,
  label,
  icon,
  isActive,
  badge,
  onClick,
  linkComponent: LinkComponent = 'a',
  className,
}: SidebarItemProps) {
  const { isCollapsed } = useSidebar();

  const content = (
    <>
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            'shrink-0 flex items-center justify-center',
            'w-5 h-5',
          )}
        >
          {icon}
        </span>
      )}
      {!isCollapsed && (
        <span className="flex-1 truncate text-sm font-medium font-body">
          {label}
        </span>
      )}
      {!isCollapsed && badge !== undefined && (
        <span className={cn(
          'shrink-0 min-w-[20px] h-5 px-1',
          'flex items-center justify-center',
          'text-xs font-semibold rounded-full',
          isActive
            ? 'bg-white/20 text-current'
            : 'bg-surface-2 text-text-secondary',
        )}>
          {badge}
        </span>
      )}
    </>
  );

  const baseClass = cn(
    'flex items-center gap-3 px-3 min-h-touch rounded-md mx-2',
    'transition-all duration-fast ease-standard',
    'outline-none focus-visible:ring-2 focus-visible:ring-accent',
    isActive
      ? 'bg-black text-white dark:bg-white dark:text-black'
      : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
    isCollapsed && 'justify-center px-0',
    className,
  );

  if (href) {
    return (
      <LinkComponent
        href={href}
        aria-label={isCollapsed ? label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={baseClass}
        title={isCollapsed ? label : undefined}
      >
        {content}
      </LinkComponent>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isCollapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(baseClass, 'w-full text-left')}
      title={isCollapsed ? label : undefined}
    >
      {content}
    </button>
  );
}
