"use client";

import { useCallback, useState } from "react";
import type { ThemeAnnotation } from "@/types";

/**
 * Persists researcher annotations per analysis to localStorage so case-by-case
 * judgements survive page reloads (full DB-backed persistence arrives in
 * Phase 5). Keyed by analysis id + theme label.
 */
const STORAGE_PREFIX = "ta:annotations:";

export function useAnnotations(analysisId: string) {
  const storageKey = `${STORAGE_PREFIX}${analysisId}`;
  const [annotations, setAnnotations] = useState<Record<string, ThemeAnnotation>>(
    () => {
      if (typeof window === "undefined") return {};
      try {
        const raw = window.localStorage.getItem(storageKey);
        return raw ? (JSON.parse(raw) as Record<string, ThemeAnnotation>) : {};
      } catch {
        return {};
      }
    }
  );

  const annotate = useCallback(
    (label: string, annotation: ThemeAnnotation) => {
      setAnnotations((prev) => {
        const next = { ...prev, [label]: annotation };
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* storage may be unavailable; keep in-memory */
        }
        return next;
      });
    },
    [storageKey]
  );

  return { annotations, annotate };
}
