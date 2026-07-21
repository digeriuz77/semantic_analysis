import type { KappaBand } from "@/types";

export const KAPPA_BAND_LABEL: Record<KappaBand, string> = {
  almost_perfect: "Almost perfect",
  substantial: "Substantial",
  moderate: "Moderate",
  fair: "Fair",
  poor: "Poor",
  insufficient_data: "Insufficient data",
};

export const KAPPA_BAND_COLOR: Record<KappaBand, string> = {
  almost_perfect: "#0d9488",
  substantial: "#3b82f6",
  moderate: "#f59e0b",
  fair: "#f97316",
  poor: "#ef4444",
  insufficient_data: "#64748b",
};

export const KAPPA_BAND_DESCRIPTION: Record<KappaBand, string> = {
  almost_perfect:
    "Near-perfect inter-run agreement (Landis & Koch). Themes are highly reproducible.",
  substantial:
    "Strong agreement. Most themes are stable across independent runs.",
  moderate:
    "Moderate agreement. Some themes vary between runs and warrant researcher review.",
  fair: "Weak agreement. Treat consensus themes as exploratory only.",
  poor: "Poor agreement. Results are unstable — revise the prompt or increase runs.",
  insufficient_data:
    "Not enough themes or runs to compute a reliable kappa. Add more runs.",
};

export function cosinePercent(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

export function tierColor(tier: "high" | "moderate"): string {
  return tier === "high" ? "#0d9488" : "#f59e0b";
}
