/**
 * cn — class name utility. Merges class strings cleanly.
 * Lightweight replacement for clsx/classnames without the dep.
 */
export function cn(...classes: (string | undefined | null | false | 0)[]): string {
  return classes.filter(Boolean).join(' ');
}
