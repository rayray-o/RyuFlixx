
import type { FeatureVectorItem } from "@/utils/personalization/feature-vector-engine";

export type AdaptiveExplorationSignal = {
  item: FeatureVectorItem;
  label: number;
  weight: number;
};

export type AdaptiveExplorationProfile = {
  enrichmentExplorationShare: number;
  rankingBlend: number;
  positiveTitleCount: number;
  genreBreadth: number;
  genreConcentration: number;
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Dynamically balances familiar recommendations and discovery.
 *
 * Sparse profiles receive more exploration.
 * Narrow profiles receive opportunities to discover adjacent tastes.
 * Broad, established profiles receive a more relevance-focused mix.
 *
 * This never creates negative feedback or forces unrelated genres.
 */
export function buildAdaptiveExplorationProfile(
  signals: AdaptiveExplorationSignal[],
): AdaptiveExplorationProfile {
  const uniqueTitles = new Map<
    string,
    AdaptiveExplorationSignal
  >();

  for (const signal of signals) {
    if (
      signal.label < 0.58 ||
      signal.weight < 0.2 ||
      !Number.isFinite(signal.weight) ||
      !Number.isFinite(signal.label)
    ) {
      continue;
    }

    const key =
      `${signal.item.mediaType}:${signal.item.id}`;

    const existing = uniqueTitles.get(key);

    if (!existing || signal.weight > existing.weight) {
      uniqueTitles.set(key, signal);
    }
  }

  const genreMass = new Map<string, number>();

  for (const signal of uniqueTitles.values()) {
    const genres = [
      ...new Set(
        signal.item.genres
          .map(normalize)
          .filter(Boolean),
      ),
    ];

    if (genres.length === 0) continue;

    const influence = clamp(
      signal.weight * (0.5 + signal.label * 0.5),
      0.1,
      3,
    );

    const perGenreInfluence =
      influence / Math.sqrt(genres.length);

    for (const genre of genres) {
      genreMass.set(
        genre,
        (genreMass.get(genre) ?? 0) +
          perGenreInfluence,
      );
    }
  }

  const positiveTitleCount = uniqueTitles.size;
  const genreCount = genreMass.size;

  const totalGenreMass = [...genreMass.values()]
    .reduce((sum, value) => sum + value, 0);

  const dominantGenreMass = Math.max(
    0,
    ...genreMass.values(),
  );

  const genreConcentration =
    totalGenreMass > 0
      ? dominantGenreMass / totalGenreMass
      : 0;

  const genreBreadth = clamp(
    (genreCount - 1) / 6,
    0,
    1,
  );

  // Confidence grows gradually rather than treating
  // a handful of interactions as a mature taste profile.
  const profileMaturity =
    1 - Math.exp(-positiveTitleCount / 7);

  const coldStartBoost =
    (1 - profileMaturity) * 0.2;

  // A concentrated profile gets more room to discover
  // outside its dominant genre.
  const narrowTasteBoost =
    Math.max(0, genreConcentration - 0.4) * 0.18;

  // Broad profiles need less forced exploration.
  const breadthReduction =
    genreBreadth * 0.09;

  const enrichmentExplorationShare = clamp(
    0.22 +
      coldStartBoost +
      narrowTasteBoost -
      breadthReduction,
    0.18,
    0.48,
  );

  // The final ranking blend is deliberately smaller
  // than the candidate-selection exploration share.
  const rankingBlend = clamp(
    enrichmentExplorationShare * 0.68,
    0.12,
    0.33,
  );

  return {
    enrichmentExplorationShare,
    rankingBlend,
    positiveTitleCount,
    genreBreadth,
    genreConcentration,
  };
}
