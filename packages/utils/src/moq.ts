/**
 * MOQ (Minimum Order Quantity) utility functions.
 * Used in Back It campaign progress calculations.
 */

/**
 * Calculate what percentage of MOQ has been reached.
 * Returns 0–100 (capped at 100).
 */
export function calculateMoqProgress(
  currentCount: number,
  moq: number,
): number {
  if (moq <= 0) return 100;
  return Math.min(100, Math.round((currentCount / moq) * 100));
}

/**
 * How many more backings are needed to hit MOQ.
 */
export function backingsNeeded(currentCount: number, moq: number): number {
  return Math.max(0, moq - currentCount);
}

/**
 * Whether a campaign has reached MOQ.
 */
export function isMoqReached(currentCount: number, moq: number): boolean {
  return currentCount >= moq;
}

/**
 * Calculate backing velocity — backings per day since campaign start.
 */
export function backingVelocity(
  currentCount: number,
  campaignStart: Date,
  now: Date = new Date(),
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.max(
    1,
    (now.getTime() - campaignStart.getTime()) / msPerDay,
  );
  return currentCount / daysElapsed;
}

/**
 * Estimate days until MOQ is reached at current velocity.
 * Returns null if velocity is 0 (no backings yet).
 */
export function estimatedDaysToMoq(
  currentCount: number,
  moq: number,
  campaignStart: Date,
  now: Date = new Date(),
): number | null {
  const remaining = backingsNeeded(currentCount, moq);
  if (remaining === 0) return 0;
  const velocity = backingVelocity(currentCount, campaignStart, now);
  if (velocity === 0) return null;
  return Math.ceil(remaining / velocity);
}
