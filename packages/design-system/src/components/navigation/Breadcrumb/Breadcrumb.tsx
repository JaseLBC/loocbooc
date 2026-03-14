/**
 * Breadcrumb — navigation trail.
 * Last item is current page (aria-current="page").
 */

import React, { type ReactNode } from 'react';
import { cn } from '../../../utils/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  className?: string;
  /** Link component override (e.g. Next.js <Link>) */
  linkComponent?: React.ElementType;
}

export function Breadcrumb({
  items,
  separator,
  className,
  linkComponent: LinkComponent = 'a',
}: BreadcrumbProps) {
  const defaultSeparator = (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const sep = separator ?? defaultSeparator;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    'text-sm font-body',
                    isLast
                      ? 'text-text-primary font-medium'
                      : 'text-text-secondary',
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <LinkComponent
                  href={item.href}
                  className={cn(
                    'text-sm font-body text-text-secondary',
                    'hover:text-text-primary',
                    'transition-colors duration-fast ease-standard',
                    'underline-offset-2 hover:underline',
                    'outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm',
                  )}
                >
                  {item.label}
                </LinkComponent>
              )}
              {!isLast && (
                <span className="text-text-tertiary" aria-hidden="true">
                  {sep}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
