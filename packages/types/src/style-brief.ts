/**
 * Style Brief types — consumer requests to stylists.
 * Part of the Styling Marketplace module.
 */

export type StyleBriefStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "delivered"
  | "accepted"
  | "closed";

export interface StyleBrief {
  id: string;
  userId: string;
  title: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  occasion: string[]; // work, casual, event, travel, etc.
  styleNotes: string | null;
  brandPreferences: string[];
  excludedBrands: string[];
  sizeInfo: Record<string, unknown> | null; // references avatarId or inline
  avatarId: string | null;
  status: StyleBriefStatus;
  stylistId: string | null;
  assignedAt: Date | null;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStyleBriefInput {
  title?: string;
  budgetMinCents?: number;
  budgetMaxCents?: number;
  currency?: string;
  occasion?: string[];
  styleNotes?: string;
  brandPreferences?: string[];
  excludedBrands?: string[];
  avatarId?: string;
  deadline?: string; // ISO 8601
}
