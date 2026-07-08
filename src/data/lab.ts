// Shared Lab helpers + index-page copy. Mirrors the src/data/*.ts pattern used
// by the other sections. The markdown collection is the source of truth for
// articles; this file holds only presentation glue (tag order, masthead copy,
// reading-time fallback).
import type { CollectionEntry } from "astro:content";

export type LabEntry = CollectionEntry<"lab">;

// Masthead copy for /lab.
export const LAB_COPY = {
  kicker: "THE LAB",
  deck: "Notes from the build — blockchain, systems, and the craft in between.",
} as const;

// Canonical order for the filter chips. "ALL" is prepended in the component.
// Only tags that actually appear on an article are rendered, but this fixes
// their left-to-right order when they do.
export const TAG_ORDER = [
  "BITCOIN",
  "ETHEREUM",
  "RUST",
  "WEB3",
  "RWA",
  "ENGINEERING",
  "CRAFT",
] as const;

// ~220 wpm reading estimate from the raw markdown body, used when an article
// doesn't set `readingTime` in frontmatter.
export function readingMinutes(body: string | undefined, override?: number): number {
  if (override && override > 0) return override;
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// Newest first; drafts filtered by the caller via getCollection's filter.
export function sortByDate(a: LabEntry, b: LabEntry): number {
  return b.data.date.valueOf() - a.data.date.valueOf();
}

// Distinct tags present across the given entries, ordered by TAG_ORDER (unknown
// tags appended alphabetically) so the chip row is stable + deterministic.
export function collectTags(entries: LabEntry[]): string[] {
  const present = new Set<string>();
  for (const e of entries) for (const t of e.data.tags) present.add(t.toUpperCase());
  const known = TAG_ORDER.filter((t) => present.has(t));
  const extra = [...present].filter((t) => !TAG_ORDER.includes(t as never)).sort();
  return [...known, ...extra];
}

// Zero-padded index numerals (01, 02, …) for the card corner marks.
export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Short, uppercase date for the card meta line: "07 · 2026".
export function shortDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${mm} · ${d.getFullYear()}`;
}
