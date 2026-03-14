'use client';

/**
 * DataTable — sortable, filterable, minimal.
 * Column-level sorting. Global filter search. Keyboard navigable headers.
 */

import React, {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../../../utils/cn';
import { Input } from '../../primitives/Input';
import { EmptyState } from '../EmptyState';

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  /** Custom cell renderer */
  cell?: (row: T, index: number) => ReactNode;
  /** Enable sorting on this column */
  sortable?: boolean;
  /** Width hint (CSS value) */
  width?: string;
  /** Align text */
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Row unique identifier */
  rowKey: keyof T;
  /** Show search input */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Custom filter function */
  filterFn?: (row: T, query: string) => boolean;
  /** Loading state */
  loading?: boolean;
  /** Empty state props */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  className?: string;
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M6 2L3 5h6L6 2z"
        fill="currentColor"
        opacity={direction === 'asc' ? 1 : 0.3}
      />
      <path
        d="M6 10l-3-3h6l-3 3z"
        fill="currentColor"
        opacity={direction === 'desc' ? 1 : 0.3}
      />
    </svg>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  searchable = false,
  searchPlaceholder = 'Search…',
  filterFn,
  loading = false,
  emptyTitle = 'No results',
  emptyDescription = 'There\'s nothing here yet.',
  emptyAction,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((dir) => {
          if (dir === 'asc') return 'desc';
          if (dir === 'desc') return null;
          return 'asc';
        });
        return key;
      } else {
        setSortDir('asc');
        return key;
      }
    });
  }, []);

  const processed = useMemo(() => {
    let rows = [...data];

    // Filter
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((row) => {
        if (filterFn) return filterFn(row, q);
        return Object.values(row).some((v) =>
          String(v ?? '').toLowerCase().includes(q)
        );
      });
    }

    // Sort
    if (sortKey && sortDir) {
      rows.sort((a, b) => {
        const av = String(a[sortKey] ?? '');
        const bv = String(b[sortKey] ?? '');
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, query, sortKey, sortDir, filterFn]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Search */}
      {searchable && (
        <Input
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          clearable
          onClear={() => setQuery('')}
          iconLeft={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          fullWidth
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-surface-3">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-surface-3 bg-surface-2">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  scope="col"
                  style={{ width: col.width }}
                  className={cn(
                    'px-4 py-3',
                    'text-xs font-semibold tracking-wider font-body text-text-secondary uppercase',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    !col.align && 'text-left',
                    col.sortable && 'cursor-pointer select-none',
                    col.sortable && 'hover:text-text-primary',
                  )}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                  onKeyDown={col.sortable ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSort(String(col.key));
                  } : undefined}
                  tabIndex={col.sortable ? 0 : undefined}
                  role={col.sortable ? 'button' : undefined}
                  aria-sort={
                    sortKey === String(col.key)
                      ? sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : undefined
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon direction={sortKey === String(col.key) ? sortDir : null} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-surface-3 last:border-0">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <div
                        className="h-4 rounded bg-surface-2 animate-pulse"
                        style={{ width: `${50 + Math.random() * 40}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : processed.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    variant="search"
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                    illustrationSize="sm"
                  />
                </td>
              </tr>
            ) : (
              processed.map((row, rowIndex) => (
                <tr
                  key={String(row[rowKey])}
                  className={cn(
                    'border-b border-surface-3 last:border-0',
                    'transition-colors duration-fast',
                    onRowClick && 'cursor-pointer hover:bg-surface-2',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter') onRowClick(row);
                  } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn(
                        'px-4 py-3',
                        'text-sm text-text-primary font-body',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                      )}
                    >
                      {col.cell
                        ? col.cell(row, rowIndex)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
