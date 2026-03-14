/**
 * Slugify utilities — generate URL-safe slugs from strings.
 */

/**
 * Convert a string to a URL-safe slug.
 * e.g. "The Blue Sundress" → "the-blue-sundress"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique slug by appending a random suffix.
 * Useful when the base slug may already be taken.
 */
export function uniqueSlug(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slugify(base)}-${suffix}`;
}
