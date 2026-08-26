import type { Statement } from "@/types/corpus";

// ---------------------------------------------------------------------------
// Phase 7: Discourse Network Analysis (DNA) computation
//
// Inspired by leifeld-lab/dna. Two network types from the statement atom:
//
// 1. CONGRUENCE (actor ↔ actor): two actors are connected when they share a
//    stance on the same concept (both agree, or both disagree). Edge weight =
//    number of shared congruent stances. This is the core DNA output — it shows
//    which actors align.
//
// 2. CO-OCCURRENCE (concept ↔ concept): two concepts are connected when the same
//    actor expresses a stance on both. Edge weight = number of shared actors.
//    This shows which ideas travel together.
//
// Both support temporal windows: compute the network per time bucket to see
// how alignments evolve.
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: number;
  label: string;
  type: "actor" | "concept";
  color: string;
  size: number;
}

export interface GraphEdge {
  source: number;
  target: number;
  weight: number;
  /** For congruence: the shared concepts. For co-occurrence: the shared actors. */
  sharedItems: string[];
}

export interface NetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  type: "congruence" | "co_occurrence";
}

export type NetworkType = "congruence" | "co_occurrence";

const ACTOR_COLORS = [
  "#0d9488", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899",
  "#10b981", "#ef4444", "#06b6d4", "#f97316", "#84cc16",
];

function colorForIndex(i: number): string {
  return ACTOR_COLORS[i % ACTOR_COLORS.length];
}

/**
 * Build a congruence network: actors connected when they share a stance
 * on the same concept (both agree or both disagree on concept C).
 */
export function buildCongruenceNetwork(statements: Statement[]): NetworkGraph {
  // Index: conceptId → stance → Set<actorId>
  const conceptStanceActors = new Map<string, Set<number>>();
  const actorMap = new Map<number, { label: string; count: number }>();

  for (const s of statements) {
    if (!s.actorId || !s.conceptId || s.stance === "undefined") continue;
    const key = `${s.conceptId}:${s.stance}`;
    if (!conceptStanceActors.has(key)) conceptStanceActors.set(key, new Set());
    conceptStanceActors.get(key)!.add(s.actorId);

    const existing = actorMap.get(s.actorId);
    if (existing) existing.count++;
    else actorMap.set(s.actorId, { label: s.actorName ?? `Actor ${s.actorId}`, count: 1 });
  }

  // For each (concept, stance) group, all actor pairs get an edge.
  const edgeMap = new Map<string, { weight: number; shared: Set<string> }>();
  const conceptNames = new Map<number, string>();
  for (const s of statements) {
    if (s.conceptId && s.conceptName) conceptNames.set(s.conceptId, s.conceptName);
  }

  for (const [key, actors] of conceptStanceActors) {
    const [conceptIdStr] = key.split(":");
    const conceptName = conceptNames.get(Number(conceptIdStr)) ?? `Concept ${conceptIdStr}`;
    const actorList = [...actors].sort((a, b) => a - b);
    for (let i = 0; i < actorList.length; i++) {
      for (let j = i + 1; j < actorList.length; j++) {
        const a = actorList[i];
        const b = actorList[j];
        const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
        const existing = edgeMap.get(edgeKey);
        if (existing) {
          existing.weight++;
          existing.shared.add(conceptName);
        } else {
          edgeMap.set(edgeKey, { weight: 1, shared: new Set([conceptName]) });
        }
      }
    }
  }

  const actorEntries = [...actorMap.entries()];
  const nodes: GraphNode[] = actorEntries.map(([id, info], i) => ({
    id,
    label: info.label,
    type: "actor",
    color: colorForIndex(i),
    size: Math.min(8 + info.count * 3, 30),
  }));

  const edges: GraphEdge[] = [...edgeMap.entries()].map(([key, val]) => {
    const [a, b] = key.split("-").map(Number);
    return { source: a, target: b, weight: val.weight, sharedItems: [...val.shared] };
  });

  return { nodes, edges, type: "congruence" };
}

/**
 * Build a co-occurrence network: concepts connected when the same actor
 * expresses stances on both.
 */
export function buildCoOccurrenceNetwork(statements: Statement[]): NetworkGraph {
  // Index: actorId → Set<conceptId>
  const actorConcepts = new Map<number, Set<number>>();
  const conceptMap = new Map<number, { label: string; color: string; count: number }>();

  for (const s of statements) {
    if (!s.actorId || !s.conceptId) continue;
    if (!actorConcepts.has(s.actorId)) actorConcepts.set(s.actorId, new Set());
    actorConcepts.get(s.actorId)!.add(s.conceptId);

    const existing = conceptMap.get(s.conceptId);
    if (existing) existing.count++;
    else
      conceptMap.set(s.conceptId, {
        label: s.conceptName ?? `Concept ${s.conceptId}`,
        color: s.conceptColor ?? "#0d9488",
        count: 1,
      });
  }

  const actorNames = new Map<number, string>();
  for (const s of statements) {
    if (s.actorId && s.actorName) actorNames.set(s.actorId, s.actorName);
  }

  const edgeMap = new Map<string, { weight: number; shared: Set<string> }>();

  for (const [, concepts] of actorConcepts) {
    const conceptList = [...concepts].sort((a, b) => a - b);
    for (let i = 0; i < conceptList.length; i++) {
      for (let j = i + 1; j < conceptList.length; j++) {
        const a = conceptList[i];
        const b = conceptList[j];
        const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
        const existing = edgeMap.get(edgeKey);
        if (existing) {
          existing.weight++;
        } else {
          edgeMap.set(edgeKey, { weight: 1, shared: new Set() });
        }
      }
    }
  }

  const nodes: GraphNode[] = [...conceptMap.entries()].map(([id, info]) => ({
    id,
    label: info.label,
    type: "concept",
    color: info.color,
    size: Math.min(8 + info.count * 3, 30),
  }));

  const edges: GraphEdge[] = [...edgeMap.entries()].map(([key, val]) => {
    const [a, b] = key.split("-").map(Number);
    return { source: a, target: b, weight: val.weight, sharedItems: [] };
  });

  return { nodes, edges, type: "co_occurrence" };
}

export function buildNetwork(
  statements: Statement[],
  type: NetworkType
): NetworkGraph {
  return type === "congruence"
    ? buildCongruenceNetwork(statements)
    : buildCoOccurrenceNetwork(statements);
}

// ---------------------------------------------------------------------------
// Temporal windowing — split statements into time buckets
// ---------------------------------------------------------------------------

export type WindowSize = "day" | "week" | "month" | "year";

export interface TemporalBucket {
  bucket: string;
  statements: Statement[];
}

/** Bucket statements by temporal window. Returns sorted buckets. */
export function bucketByWindow(statements: Statement[], size: WindowSize): TemporalBucket[] {
  const buckets = new Map<string, Statement[]>();
  for (const s of statements) {
    if (!s.stmtDate) continue;
    const key = windowKey(s.stmtDate, size);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }
  return [...buckets.entries()]
    .map(([bucket, stmts]) => ({ bucket, statements: stmts }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function windowKey(date: string, size: WindowSize): string {
  const d = date.slice(0, 10); // YYYY-MM-DD
  if (size === "day") return d;
  if (size === "year") return d.slice(0, 4);
  if (size === "month") return d.slice(0, 7);
  // week: ISO-ish approximation
  const jsDate = new Date(d);
  const day = jsDate.getUTCDay();
  const diff = (jsDate.getUTCDate() - day + 7) % 7;
  jsDate.setUTCDate(jsDate.getUTCDate() - diff);
  return jsDate.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Entity comparison — build a profile for an actor across all dimensions
// ---------------------------------------------------------------------------

export interface ActorProfile {
  actorId: number;
  actorName: string;
  totalStatements: number;
  byConcept: { name: string; count: number; stance: string }[];
  byStance: Record<string, number>;
  byDate: { date: string; count: number }[];
  byLocation: { location: string; count: number }[];
}

export function buildActorProfile(
  statements: Statement[],
  actorId: number
): ActorProfile | null {
  const stmts = statements.filter((s) => s.actorId === actorId);
  if (stmts.length === 0) return null;
  const actorName = stmts[0].actorName ?? "Unknown";

  const conceptMap = new Map<string, { count: number; stance: string }>();
  const byStance: Record<string, number> = {};
  const dateMap = new Map<string, number>();
  const locMap = new Map<string, number>();

  for (const s of stmts) {
    if (s.conceptName) {
      const existing = conceptMap.get(s.conceptName);
      if (existing) existing.count++;
      else conceptMap.set(s.conceptName, { count: 1, stance: s.stance });
    }
    byStance[s.stance] = (byStance[s.stance] ?? 0) + 1;
    if (s.stmtDate) {
      const k = s.stmtDate.slice(0, 10);
      dateMap.set(k, (dateMap.get(k) ?? 0) + 1);
    }
    if (s.location) locMap.set(s.location, (locMap.get(s.location) ?? 0) + 1);
  }

  return {
    actorId,
    actorName,
    totalStatements: stmts.length,
    byConcept: [...conceptMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count),
    byStance,
    byDate: [...dateMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byLocation: [...locMap.entries()]
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count),
  };
}
