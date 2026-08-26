"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThemeAnnotation } from "@/types";

/**
 * Persists researcher annotations per analysis to localStorage so case-by-case
 * judgements survive page reloads (full DB-backed persistence arrives in
 * Phase 5). Keyed by analysis id + consensus-theme index (labels can collide).
 * Listens for the storage event so two open tabs stay in sync.
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

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      try {
        setAnnotations(
          e.newValue ? (JSON.parse(e.newValue) as Record<string, ThemeAnnotation>) : {}
        );
      } catch {
        /* malformed external write; keep current state */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  const annotate = useCallback(
    (key: string, annotation: ThemeAnnotation) => {
      setAnnotations((prev) => {
        const next = { ...prev, [key]: annotation };
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
