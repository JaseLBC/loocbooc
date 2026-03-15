/**
 * UGI — Unique Garment Identifier generator and validator.
 *
 * Format: LB-XXXX-XXXX-XXXX where X is uppercase alphanumeric.
 * e.g. LB-A3K9-R7MT-2XZQ
 *
 * These are stored in garment.metadata.ugi. On first access, if the UGI
 * is missing it is generated and persisted.
 *
 * UGIs are used as the public API identifier. Internal cuid PKs are never
 * exposed to the frontend.
 */

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomSegment(length: number): string {
  const chars: string[] = [];
  for (let i = 0; i < length; i++) {
    chars.push(CHARS[Math.floor(Math.random() * CHARS.length)]!);
  }
  return chars.join("");
}

export function generateUGI(): string {
  return `LB-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

const UGI_PATTERN = /^LB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isValidUGI(value: string): boolean {
  return UGI_PATTERN.test(value);
}
