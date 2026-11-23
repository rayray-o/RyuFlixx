
import type { ContentType } from "@/types";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

export interface FeatureVectorItem {
  id: number;
  mediaType: ContentType;
  genres: string[];
  keywords: string[];
  directors: string[];
  cast: string[];
  languages: string[];
  countries: string[];
  releaseDate?: string;
}

export interface FeatureVectorSeed {
  item: FeatureVectorItem;
  weight: number;
}

type SparseVector = Map<string, number>;

const MAX_FEATURES = 1024;

const FEATURE_WEIGHTS = {
  genre: 1.7,
  keyword: 2.5,
  director: 2.4,
  actor: 0.95,
  language: 0.3,
  country: 0.25,
  era: 0.4,
  mediaType: 0.25,
} as const;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function addFeature(
  features: SparseVector,
  category: string,
  value: string,
  weight: number,
): void {
  const normalized = normalize(value);

  if (!normalized || !Number.isFinite(weight) || weight === 0) {
    return;
  }

  const key = `${category}:${normalized}`;

  if (!features.has(key)) {
    features.set(key, weight);
  }
}

function getEra(date?: string): string | null {
  if (!date) return null;

  const year = Number(date.slice(0, 4));

  if (!Number.isFinite(year) || year < 1880) {
    return null;
  }

  if (year >= 2020) return "2020s";
  if (year >= 2010) return "2010s";
  if (year >= 2000) return "2000s";
  if (year >= 1990) return "1990s";
  if (year >= 1980) return "1980s";
  if (year >= 1970) return "1970s";

  return "Before 1970";
}

function extractFeatures(item: FeatureVectorItem): SparseVector {
  const features: SparseVector = new Map();

  for (const genre of item.genres) {
    addFeature(features, "genre", genre, FEATURE_WEIGHTS.genre);
  }

  for (const keyword of item.keywords) {
    addFeature(features, "keyword", keyword, FEATURE_WEIGHTS.keyword);
  }

  for (const director of item.directors) {
    addFeature(features, "director", director, FEATURE_WEIGHTS.director);
  }

  item.cast.slice(0, 12).forEach((actor, index) => {
    const positionWeight = 1 / (1 + index * 0.12);

    addFeature(
      features,
      "actor",
      actor,
      FEATURE_WEIGHTS.actor * positionWeight,
    );
  });

  for (const language of item.languages) {
    addFeature(features, "language", language, FEATURE_WEIGHTS.language);
  }

  for (const country of item.countries) {
    addFeature(features, "country", country, FEATURE_WEIGHTS.country);
  }

  const era = getEra(item.releaseDate);

  if (era) {
    addFeature(features, "era", era, FEATURE_WEIGHTS.era);
  }

  addFeature(
    features,
    "media-type",
    item.mediaType,
    FEATURE_WEIGHTS.mediaType,
  );

  return features;
}

function buildInverseDocumentFrequency(
  items: FeatureVectorItem[],
): Map<string, number> {
  const documentFrequency = new Map<string, number>();
  const uniqueItems = new Map<string, FeatureVectorItem>();

  for (const item of items) {
    uniqueItems.set(`${item.mediaType}:${item.id}`, item);
  }

  const documents = [...uniqueItems.values()];

  for (const item of documents) {
    const features = extractFeatures(item);

    for (const key of features.keys()) {
      documentFrequency.set(
        key,
        (documentFrequency.get(key) ?? 0) + 1,
      );
    }
  }

  const totalDocuments = Math.max(1, documents.length);
  const idf = new Map<string, number>();

  for (const [key, frequency] of documentFrequency) {
    idf.set(
      key,
      Math.log(1 + totalDocuments / Math.max(1, frequency)),
    );
  }

  return idf;
}

function pruneVector(vector: SparseVector): SparseVector {
  if (vector.size <= MAX_FEATURES) {
    return vector;
  }

  return new Map(
    [...vector.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, MAX_FEATURES),
  );
}

function buildWeightedVector(
  item: FeatureVectorItem,
  idf: Map<string, number>,
): SparseVector {
  const raw = extractFeatures(item);
  const weighted: SparseVector = new Map();

  for (const [key, value] of raw) {
    const inverseFrequency =
      idf.get(key) ?? Math.log(1 + Math.max(1, idf.size));

    weighted.set(
      key,
      value * Math.sqrt(Math.max(0, inverseFrequency)),
    );
  }

  return pruneVector(weighted);
}

function addToVector(
  target: SparseVector,
  source: SparseVector,
  weight: number,
): void {
  for (const [key, value] of source) {
    target.set(
      key,
      (target.get(key) ?? 0) + value * weight,
    );
  }
}

function addImportedTaste(
  vector: SparseVector,
  profile: TasteProfile,
  idf: Map<string, number>,
): void {
  const mappings = [
    {
      values: profile.preferences.genres,
      category: "genre",
      weight: FEATURE_WEIGHTS.genre,
    },
    {
      values: profile.preferences.keywords,
      category: "keyword",
      weight: FEATURE_WEIGHTS.keyword,
    },
    {
      values: profile.preferences.directors,
      category: "director",
      weight: FEATURE_WEIGHTS.director,
    },
    {
      values: profile.preferences.actors,
      category: "actor",
      weight: FEATURE_WEIGHTS.actor,
    },
    {
      values: profile.preferences.languages,
      category: "language",
      weight: FEATURE_WEIGHTS.language,
    },
    {
      values: profile.preferences.countries,
      category: "country",
      weight: FEATURE_WEIGHTS.country,
    },
    {
      values: profile.preferences.eras,
      category: "era",
      weight: FEATURE_WEIGHTS.era,
    },
    {
      values: profile.preferences.mediaTypes,
      category: "media-type",
      weight: FEATURE_WEIGHTS.mediaType,
    },
  ];

  for (const mapping of mappings) {
    for (const [name, score] of Object.entries(mapping.values)) {
      if (!Number.isFinite(score) || score === 0) {
        continue;
      }

      const normalized = normalize(name);

      if (!normalized) continue;

      const key = `${mapping.category}:${normalized}`;
      const inverseFrequency =
        idf.get(key) ?? Math.log(1 + Math.max(1, idf.size));

      const signal = Math.tanh(score / 6);

      vector.set(
        key,
        (vector.get(key) ?? 0) +
          signal *
            mapping.weight *
            Math.sqrt(Math.max(0, inverseFrequency)),
      );
    }
  }
}

function cosineSimilarity(
  left: SparseVector,
  right: SparseVector,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of left.values()) {
    leftMagnitude += value * value;
  }

  for (const value of right.values()) {
    rightMagnitude += value * value;
  }

  for (const [key, value] of left) {
    dot += value * (right.get(key) ?? 0);
  }

  const denominator =
    Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);

  if (denominator <= 0) {
    return 0;
  }

  return Math.max(-1, Math.min(1, dot / denominator));
}

function buildSeedVectors(
  seeds: FeatureVectorSeed[],
  idf: Map<string, number>,
) {
  return seeds.map((seed) => ({
    vector: buildWeightedVector(seed.item, idf),
    weight: Math.max(0.2, Math.min(2, seed.weight / 7)),
  }));
}

function buildAggregateVector(
  seeds: ReturnType<typeof buildSeedVectors>,
): SparseVector {
  const vector: SparseVector = new Map();

  for (const seed of seeds) {
    addToVector(vector, seed.vector, seed.weight);
  }

  return pruneVector(vector);
}

function getStrongestSeedSimilarity(
  candidateVector: SparseVector,
  seeds: ReturnType<typeof buildSeedVectors>,
): number {
  let strongest = 0;

  for (const seed of seeds) {
    const similarity = cosineSimilarity(
      seed.vector,
      candidateVector,
    );

    strongest = Math.max(
      strongest,
      similarity * Math.min(1, seed.weight),
    );
  }

  return strongest;
}

/**
 * Scores candidates using positive and negative preference profiles.
 *
 * Positive seeds increase similarity.
 * Explicitly disliked seeds reduce similarity.
 * Imported taste remains supported.
 *
 * Negative examples are passed separately so they cannot accidentally
 * become positive preference evidence.
 */
export function getFeatureSimilarityScores(
  candidates: FeatureVectorItem[],
  seeds: FeatureVectorSeed[],
  tasteProfile: TasteProfile | null,
  negativeSeeds: FeatureVectorSeed[] = [],
): Map<string, number> {
  const scores = new Map<string, number>();

  if (candidates.length === 0) {
    return scores;
  }

  const corpus = [
    ...candidates,
    ...seeds.map((seed) => seed.item),
    ...negativeSeeds.map((seed) => seed.item),
  ];

  const idf = buildInverseDocumentFrequency(corpus);

  const positiveSeedVectors = buildSeedVectors(seeds, idf);
  const negativeSeedVectors = buildSeedVectors(negativeSeeds, idf);

  const positiveUserVector =
    buildAggregateVector(positiveSeedVectors);

  const negativeUserVector =
    buildAggregateVector(negativeSeedVectors);

  if (tasteProfile) {
    addImportedTaste(positiveUserVector, tasteProfile, idf);
  }

  const finalPositiveVector = pruneVector(positiveUserVector);
  const finalNegativeVector = pruneVector(negativeUserVector);

  for (const candidate of candidates) {
    const candidateVector = buildWeightedVector(candidate, idf);

    const positiveUserSimilarity = cosineSimilarity(
      finalPositiveVector,
      candidateVector,
    );

    const strongestPositiveSimilarity =
      getStrongestSeedSimilarity(
        candidateVector,
        positiveSeedVectors,
      );

    const positiveScore =
      positiveUserSimilarity * 0.7 +
      strongestPositiveSimilarity * 0.3;

    const negativeUserSimilarity = Math.max(
      0,
      cosineSimilarity(
        finalNegativeVector,
        candidateVector,
      ),
    );

    const strongestNegativeSimilarity = Math.max(
      0,
      getStrongestSeedSimilarity(
        candidateVector,
        negativeSeedVectors,
      ),
    );

    const negativeScore =
      negativeUserSimilarity * 0.7 +
      strongestNegativeSimilarity * 0.3;

    // Negative evidence is deliberately weaker than equally strong
    // positive evidence, but repeated explicit dislikes accumulate.
    const combined =
      positiveScore -
      negativeScore * 0.85;

    scores.set(
      `${candidate.mediaType}:${candidate.id}`,
      Math.max(-1, Math.min(1, combined)),
    );
  }

  return scores;
}
