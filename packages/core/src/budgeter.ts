import type { Tier } from "./types.js";

export interface BudgetCandidate {
  key: string;
  /** Higher survives longer. */
  priority: number;
  declaredTier: Tier;
  /** When the group was opened, for LRU among unlocked groups. 0 for declared-resident. */
  openedAt: number;
  /** Declaration order, oldest first. */
  order: number;
}

export interface BudgetDecision {
  keep: string[];
  evicted: string[];
}

/**
 * Chooses which candidates may stay resident under a hard cap.
 * Order of survival: priority desc, then most recently opened (an explicit
 * open_capability beats declared-resident tools of equal priority, otherwise
 * opening a group could load nothing), then declared tier asc, then most
 * recently declared.
 */
export function applyBudget(candidates: BudgetCandidate[], max: number): BudgetDecision {
  if (candidates.length <= max) return { keep: candidates.map((c) => c.key), evicted: [] };
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.openedAt !== b.openedAt) return b.openedAt - a.openedAt;
    if (a.declaredTier !== b.declaredTier) return a.declaredTier - b.declaredTier;
    return b.order - a.order;
  });
  const keep = sorted.slice(0, Math.max(0, max)).map((c) => c.key);
  const keepSet = new Set(keep);
  return { keep, evicted: candidates.filter((c) => !keepSet.has(c.key)).map((c) => c.key) };
}
