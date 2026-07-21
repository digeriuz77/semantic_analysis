import type { Theme, ThemeRun } from "@/types";

/** Deterministic PRNG (mulberry32) so demo runs vary reproducibly by seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Produce a believable ensemble of themes when no LLM key is configured, so the
 * reliability dashboard remains fully explorable in demo mode. Themes are
 * derived from the corpus keywords with deterministic per-seed variation, which
 * yields plausible kappa/cosine ranges and partial consensus.
 */
export function generateDemoRuns(
  topKeywords: { word: string; count: number }[],
  seeds: number[]
): ThemeRun[] {
  if (topKeywords.length === 0) {
    return seeds.map((seed) => ({ seed, themes: [] }));
  }

  const descriptions = [
    "Participants repeatedly returned to this idea, framing it as central to their experience.",
    "A recurring thread across responses, surfacing both opportunities and tensions.",
    "This concept emerged organically, often tied to specific incidents recounted in the data.",
    "Foregrounded by several respondents as a key driver of their behaviour and expectations.",
    "A latent undercurrent that became visible only after cross-reading the corpus.",
  ];

  return seeds.map((seed) => {
    const rng = mulberry32(seed);
    const themeCount = Math.min(topKeywords.length, 3 + Math.floor(rng() * 3));
    const themes: Theme[] = [];
    const used = new Set<number>();

    for (let i = 0; i < themeCount; i++) {
      let idx = Math.floor(rng() * topKeywords.length);
      let guard = 0;
      while (used.has(idx) && guard < 12) {
        idx = Math.floor(rng() * topKeywords.length);
        guard++;
      }
      if (used.has(idx)) continue;
      used.add(idx);
      const kw = topKeywords[idx];
      themes.push({
        name: capitalize(kw.word),
        description: descriptions[Math.floor(rng() * descriptions.length)],
        keywords: [kw.word],
        prevalence: 40 + Math.floor(rng() * 50),
      });
    }
    return { seed, themes };
  });
}
