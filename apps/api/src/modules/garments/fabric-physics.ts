/**
 * Fabric physics derivation engine.
 *
 * Takes a free-text fabric composition string (e.g. "85% Polyester, 15% Elastane")
 * and returns estimated physical properties used for 3D simulation tuning and
 * consumer-facing fabric quality indicators.
 *
 * Properties (all 0–100 scale):
 *   drape        — how much the fabric falls / flows
 *   stretch      — horizontal/vertical stretch capacity
 *   weight       — heaviness / gsm proxy
 *   breathability — air permeability
 *   sheen        — surface light reflection (0 = matte, 100 = high gloss)
 *
 * Method: parse composition percentages, weight each fibre's known properties
 * by its percentage share. Falls back to a reasonable midpoint for unknown fibres.
 *
 * This is a heuristic model, not a physical simulation. Sufficient for UX and
 * style guidance. Replace with a proper ML model when fibre test data is available.
 */

import type { FabricPhysicsResult } from "./types.js";

// ── Known fibre properties ────────────────────────────────────────────────────

interface FibreProfile {
  drape: number;
  stretch: number;
  weight: number;
  breathability: number;
  sheen: number;
}

// Keys are lowercase keywords found in composition strings.
// Values are the fibre's intrinsic property scores on a 0–100 scale.
const FIBRE_PROFILES: Record<string, FibreProfile> = {
  // ── Naturals ──────────────────────────────────────────────────
  cotton: {
    drape: 40,
    stretch: 15,
    weight: 45,
    breathability: 85,
    sheen: 15,
  },
  organic: {
    drape: 40,
    stretch: 15,
    weight: 45,
    breathability: 85,
    sheen: 15,
  },
  linen: {
    drape: 35,
    stretch: 8,
    weight: 40,
    breathability: 90,
    sheen: 12,
  },
  silk: {
    drape: 88,
    stretch: 20,
    weight: 28,
    breathability: 72,
    sheen: 82,
  },
  satin: {
    drape: 82,
    stretch: 12,
    weight: 32,
    breathability: 45,
    sheen: 90,
  },
  wool: {
    drape: 58,
    stretch: 22,
    weight: 65,
    breathability: 62,
    sheen: 18,
  },
  cashmere: {
    drape: 72,
    stretch: 25,
    weight: 40,
    breathability: 68,
    sheen: 28,
  },
  merino: {
    drape: 65,
    stretch: 28,
    weight: 42,
    breathability: 70,
    sheen: 22,
  },
  alpaca: {
    drape: 68,
    stretch: 20,
    weight: 50,
    breathability: 65,
    sheen: 32,
  },
  mohair: {
    drape: 60,
    stretch: 18,
    weight: 48,
    breathability: 60,
    sheen: 38,
  },
  hemp: {
    drape: 30,
    stretch: 6,
    weight: 50,
    breathability: 88,
    sheen: 10,
  },
  bamboo: {
    drape: 65,
    stretch: 18,
    weight: 38,
    breathability: 82,
    sheen: 35,
  },
  tencel: {
    drape: 70,
    stretch: 15,
    weight: 35,
    breathability: 78,
    sheen: 40,
  },
  lyocell: {
    drape: 70,
    stretch: 15,
    weight: 35,
    breathability: 78,
    sheen: 40,
  },
  modal: {
    drape: 72,
    stretch: 20,
    weight: 32,
    breathability: 75,
    sheen: 38,
  },
  viscose: {
    drape: 75,
    stretch: 18,
    weight: 30,
    breathability: 72,
    sheen: 45,
  },
  rayon: {
    drape: 75,
    stretch: 18,
    weight: 30,
    breathability: 72,
    sheen: 45,
  },

  // ── Synthetics ────────────────────────────────────────────────
  polyester: {
    drape: 55,
    stretch: 30,
    weight: 42,
    breathability: 38,
    sheen: 28,
  },
  nylon: {
    drape: 52,
    stretch: 35,
    weight: 38,
    breathability: 35,
    sheen: 30,
  },
  elastane: {
    drape: 80,
    stretch: 95,
    weight: 20,
    breathability: 30,
    sheen: 15,
  },
  spandex: {
    drape: 80,
    stretch: 95,
    weight: 20,
    breathability: 30,
    sheen: 15,
  },
  lycra: {
    drape: 80,
    stretch: 95,
    weight: 20,
    breathability: 30,
    sheen: 15,
  },
  acrylic: {
    drape: 48,
    stretch: 20,
    weight: 48,
    breathability: 32,
    sheen: 22,
  },
  polypropylene: {
    drape: 40,
    stretch: 25,
    weight: 28,
    breathability: 55,
    sheen: 18,
  },

  // ── Technical ─────────────────────────────────────────────────
  gore: {
    drape: 30,
    stretch: 15,
    weight: 55,
    breathability: 70,
    sheen: 20,
  },
  gore_tex: {
    drape: 30,
    stretch: 15,
    weight: 55,
    breathability: 70,
    sheen: 20,
  },
  schoeller: {
    drape: 45,
    stretch: 55,
    weight: 50,
    breathability: 65,
    sheen: 15,
  },

  // ── Leather / specialty ───────────────────────────────────────
  leather: {
    drape: 42,
    stretch: 5,
    weight: 80,
    breathability: 25,
    sheen: 50,
  },
  suede: {
    drape: 45,
    stretch: 5,
    weight: 72,
    breathability: 30,
    sheen: 20,
  },
  velvet: {
    drape: 65,
    stretch: 12,
    weight: 60,
    breathability: 40,
    sheen: 55,
  },
  denim: {
    drape: 28,
    stretch: 10,
    weight: 70,
    breathability: 62,
    sheen: 8,
  },
  tweed: {
    drape: 25,
    stretch: 8,
    weight: 78,
    breathability: 58,
    sheen: 10,
  },
  fleece: {
    drape: 35,
    stretch: 40,
    weight: 55,
    breathability: 72,
    sheen: 5,
  },
};

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedFibre {
  keyword: string;
  pct: number; // 0–100
}

/**
 * Parse a composition string into fibre percentages.
 * Handles common formats: "85% Polyester, 15% Elastane", "Polyester 85%", etc.
 * Returns a list of matched fibres with their percentages.
 */
function parseComposition(composition: string): ParsedFibre[] {
  const lower = composition.toLowerCase();

  // Try to find percentage + fibre name pairs
  // Pattern 1: "85% polyester" or "85 % polyester"
  // Pattern 2: "polyester 85%" or "polyester 85 %"
  const matches: ParsedFibre[] = [];

  const pattern = /(\d{1,3})\s*%\s*([a-z\s-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(lower)) !== null) {
    const pct = parseInt(m[1]!, 10);
    const raw = m[2]!.trim();
    if (pct > 0 && pct <= 100) {
      matches.push({ keyword: raw, pct });
    }
  }

  // Pattern 2: fibre name then percentage
  if (matches.length === 0) {
    const pattern2 = /([a-z\s-]+)\s+(\d{1,3})\s*%/g;
    while ((m = pattern2.exec(lower)) !== null) {
      const pct = parseInt(m[2]!, 10);
      const raw = m[1]!.trim();
      if (pct > 0 && pct <= 100) {
        matches.push({ keyword: raw, pct });
      }
    }
  }

  // If we couldn't parse percentages, treat the whole string as a list of fibres
  // and assign equal shares
  if (matches.length === 0) {
    const fibres = lower
      .split(/[,/&+]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const share = Math.round(100 / fibres.length);
    fibres.forEach((f) => matches.push({ keyword: f, pct: share }));
  }

  return matches;
}

/**
 * Find the best matching fibre profile for a keyword string.
 * Tries exact match first, then substring match.
 */
function matchFibre(keyword: string): FibreProfile | null {
  const k = keyword.toLowerCase().trim();

  // Exact match
  if (FIBRE_PROFILES[k]) return FIBRE_PROFILES[k]!;

  // Substring match — keyword contains a known fibre name
  for (const [name, profile] of Object.entries(FIBRE_PROFILES)) {
    if (k.includes(name) || name.includes(k)) {
      return profile;
    }
  }

  return null;
}

// ── Main derivation function ──────────────────────────────────────────────────

/**
 * Derive fabric physics from a composition string.
 * Returns weighted average of known fibre profiles.
 * Unknown fibres are treated as a neutral mid-range fabric.
 */
export function deriveFabricPhysics(composition: string): FabricPhysicsResult {
  const neutral: FibreProfile = {
    drape: 50,
    stretch: 25,
    weight: 50,
    breathability: 55,
    sheen: 20,
  };

  if (!composition || composition.trim().length === 0) {
    return { ...neutral };
  }

  const parsed = parseComposition(composition);

  if (parsed.length === 0) {
    return { ...neutral };
  }

  // Normalize percentages to sum to 100 (handles rounding in labels like "50% Wool, 50% Cashmere = 100")
  const totalPct = parsed.reduce((sum, f) => sum + f.pct, 0);
  const normalizer = totalPct > 0 ? 100 / totalPct : 1;

  let drape = 0;
  let stretch = 0;
  let weight = 0;
  let breathability = 0;
  let sheen = 0;
  let matchedPct = 0;

  for (const fibre of parsed) {
    const profile = matchFibre(fibre.keyword);
    const weight_ = (fibre.pct * normalizer) / 100; // fraction of total

    if (profile) {
      drape += profile.drape * weight_;
      stretch += profile.stretch * weight_;
      weight += profile.weight * weight_;
      breathability += profile.breathability * weight_;
      sheen += profile.sheen * weight_;
      matchedPct += fibre.pct * normalizer;
    }
  }

  // If we only matched some fibres, fill remaining with neutral values
  const unmatchedFraction = Math.max(0, (100 - matchedPct) / 100);
  if (unmatchedFraction > 0) {
    drape += neutral.drape * unmatchedFraction;
    stretch += neutral.stretch * unmatchedFraction;
    weight += neutral.weight * unmatchedFraction;
    breathability += neutral.breathability * unmatchedFraction;
    sheen += neutral.sheen * unmatchedFraction;
  }

  return {
    drape: Math.round(Math.max(0, Math.min(100, drape))),
    stretch: Math.round(Math.max(0, Math.min(100, stretch))),
    weight: Math.round(Math.max(0, Math.min(100, weight))),
    breathability: Math.round(Math.max(0, Math.min(100, breathability))),
    sheen: Math.round(Math.max(0, Math.min(100, sheen))),
  };
}

/**
 * Derive a human-readable physics label set for display.
 * Used as descriptive text alongside the numeric values.
 */
export function getFabricLabel(composition: string): {
  drapeLabel: string;
  stretchLabel: string;
  weightLabel: string;
} {
  const physics = deriveFabricPhysics(composition);

  const drapeLabel =
    physics.drape >= 75
      ? "Very fluid"
      : physics.drape >= 55
      ? "Fluid"
      : physics.drape >= 35
      ? "Semi-structured"
      : "Structured";

  const stretchLabel =
    physics.stretch >= 75
      ? "Very stretchy"
      : physics.stretch >= 45
      ? "Some stretch"
      : physics.stretch >= 20
      ? "Slight give"
      : "Non-stretch";

  const weightLabel =
    physics.weight >= 70
      ? "Heavy"
      : physics.weight >= 50
      ? "Medium-heavy"
      : physics.weight >= 30
      ? "Lightweight"
      : "Very lightweight";

  return { drapeLabel, stretchLabel, weightLabel };
}
