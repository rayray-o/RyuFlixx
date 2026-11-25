
import type { RecommendationItem } from "@/utils/personalization/recommendation-engine";

export type SynopsisSeed = {
  item: RecommendationItem;
  weight: number;
};

type SparseTextVector = Map<string, number>;

const MIN_TOKEN_LENGTH = 3;
const MAX_TERMS_PER_DOCUMENT = 100;
const MAX_SEEDS = 40;

const BIGRAM_WEIGHT = 0.7;
const MIN_IDF = 0.15;

const STOP_WORDS = new Set([
  "about", "above", "after", "again", "against",
  "along", "already", "also", "although", "always",
  "among", "another", "around", "because", "before",
  "being", "below", "between", "both", "could",
  "does", "doing", "during", "each", "either",
  "else", "enough", "even", "ever", "every",
  "everyone", "everything", "few", "from", "further",
  "gets", "getting", "given", "gives", "going",
  "having", "here", "hers", "himself", "however",
  "into", "itself", "just", "least", "less",
  "many", "might", "more", "most", "much",
  "must", "never", "none", "nothing", "often",
  "once", "only", "other", "others", "otherwise",
  "ours", "ourselves", "over", "perhaps", "quite",
  "rather", "really", "same", "seems", "several",
  "since", "some", "someone", "something", "still",
  "such", "than", "that", "their", "theirs",
  "them", "themselves", "then", "there", "these",
  "they", "this", "those", "through", "throughout",
  "together", "under", "until", "upon", "very",
  "want", "wants", "was", "were", "what",
  "whatever", "when", "where", "whether", "which",
  "while", "who", "whom", "whose", "will",
  "with", "within", "without", "would", "your",
  "yours", "yourself", "yourselves",
  "the", "and", "for", "are", "but", "not",
  "you", "all", "any", "can", "had", "has",
  "her", "his", "how", "its", "our", "out",
  "she", "too", "use", "who", "why", "yet",
  "him", "his", "off", "per", "via", "via",
  "one", "two", "three", "first", "second",
  "new", "young", "old", "true", "real",
  "man", "men", "woman", "women", "people",
  "person", "family", "life", "lives", "world",
  "years", "year", "day", "days", "time",
  "times", "way", "ways", "story", "film",
  "movie", "series", "show", "character",
  "characters", "find", "finds", "found",
  "make", "makes", "made", "take", "takes",
  "taken", "come", "comes", "came", "go",
  "goes", "went", "get", "got", "gets",
]);

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");
}

function extractTokens(overview: string): string[] {
  if (!overview.trim()) {
    return [];
  }

  return overview
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map(normalizeToken)
    .filter(
      (token) =>
        token.length >= MIN_TOKEN_LENGTH &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token),
    );
}

function extractTerms(overview: string): Map<string, number> {
  const tokens = extractTokens(overview);
  const frequencies = new Map<string, number>();

  for (const token of tokens) {
    const key = `word:${token}`;

    frequencies.set(
      key,
      (frequencies.get(key) ?? 0) + 1,
    );
  }

  for (let index = 0; index < tokens.length - 1; index++) {
    const left = tokens[index];
    const right = tokens[index + 1];

    if (!left || !right) continue;

    const phrase = `phrase:${left}_${right}`;

    frequencies.set(
      phrase,
      (frequencies.get(phrase) ?? 0) + BIGRAM_WEIGHT,
    );
  }

  return new Map(
    [...frequencies.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TERMS_PER_DOCUMENT),
  );
}

function buildInverseDocumentFrequency(
  overviews: string[],
): Map<string, number> {
  const documentFrequency = new Map<string, number>();

  let documentCount = 0;

  for (const overview of overviews) {
    const terms = extractTerms(overview);

    if (terms.size === 0) continue;

    documentCount++;

    for (const term of terms.keys()) {
      documentFrequency.set(
        term,
        (documentFrequency.get(term) ?? 0) + 1,
      );
    }
  }

  const idf = new Map<string, number>();

  for (const [term, frequency] of documentFrequency) {
    const inverseFrequency =
      Math.log1p(
        (documentCount + 1) / (frequency + 1),
      ) + MIN_IDF;

    idf.set(term, inverseFrequency);
  }

  return idf;
}

function buildTextVector(
  overview: string,
  idf: Map<string, number>,
): SparseTextVector {
  const terms = extractTerms(overview);
  const vector: SparseTextVector = new Map();

  for (const [term, frequency] of terms) {
    const inverseFrequency = idf.get(term);

    if (inverseFrequency === undefined) {
      continue;
    }

    const termFrequency =
      1 + Math.log(Math.max(1, frequency));

    vector.set(
      term,
      termFrequency * inverseFrequency,
    );
  }

  return vector;
}

function addToVector(
  target: SparseTextVector,
  source: SparseTextVector,
  weight: number,
): void {
  for (const [term, value] of source) {
    target.set(
      term,
      (target.get(term) ?? 0) + value * weight,
    );
  }
}

function cosineSimilarity(
  left: SparseTextVector,
  right: SparseTextVector,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of left.values()) {
    leftMagnitude += value * value;
  }

  for (const value of right.values()) {
    rightMagnitude += value * value;
  }

  for (const [term, value] of left) {
    dotProduct += value * (right.get(term) ?? 0);
  }

  const denominator =
    Math.sqrt(leftMagnitude) *
    Math.sqrt(rightMagnitude);

  if (denominator <= 0) {
    return 0;
  }

  return clamp(
    dotProduct / denominator,
    0,
    1,
  );
}

function getSeedInfluence(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }

  return clamp(
    Math.log1p(Math.min(weight, 12)) /
      Math.log1p(12),
    0.12,
    1,
  );
}

function buildSeedVectors(
  seeds: SynopsisSeed[],
  idf: Map<string, number>,
) {
  return seeds
    .filter(
      (seed) =>
        seed.item.overview?.trim() &&
        Number.isFinite(seed.weight) &&
        seed.weight > 0,
    )
    .slice(0, MAX_SEEDS)
    .map((seed) => ({
      vector: buildTextVector(
        seed.item.overview ?? "",
        idf,
      ),
      weight: getSeedInfluence(seed.weight),
    }))
    .filter((seed) => seed.vector.size > 0);
}

function buildAggregateVector(
  seeds: ReturnType<typeof buildSeedVectors>,
): SparseTextVector {
  const aggregate: SparseTextVector = new Map();

  for (const seed of seeds) {
    addToVector(
      aggregate,
      seed.vector,
      seed.weight,
    );
  }

  return aggregate;
}

function getStrongestSeedSimilarity(
  candidate: SparseTextVector,
  seeds: ReturnType<typeof buildSeedVectors>,
): number {
  let strongest = 0;

  for (const seed of seeds) {
    const similarity = cosineSimilarity(
      candidate,
      seed.vector,
    );

    strongest = Math.max(
      strongest,
      similarity * Math.min(1, seed.weight),
    );
  }

  return strongest;
}

/**
 * Scores candidates by plot and theme similarity.
 *
 * This is lexical text matching, not an embedding model:
 * it uses weighted terms and phrases from TMDB overviews.
 *
 * Positive examples establish preferred story themes.
 * Negative examples reduce similarity to explicitly disliked
 * story patterns without treating ordinary abandonment as dislike.
 */
export function getSynopsisSimilarityScores(
  candidates: RecommendationItem[],
  positiveSeeds: SynopsisSeed[],
  negativeSeeds: SynopsisSeed[] = [],
): Map<string, number> {
  const scores = new Map<string, number>();

  if (candidates.length === 0) {
    return scores;
  }

  const corpus = [
    ...candidates.map((item) => item.overview ?? ""),
    ...positiveSeeds.map(
      (seed) => seed.item.overview ?? "",
    ),
    ...negativeSeeds.map(
      (seed) => seed.item.overview ?? "",
    ),
  ];

  const idf = buildInverseDocumentFrequency(corpus);

  const positiveVectors = buildSeedVectors(
    positiveSeeds,
    idf,
  );

  const negativeVectors = buildSeedVectors(
    negativeSeeds,
    idf,
  );

  const positiveProfile =
    buildAggregateVector(positiveVectors);

  const negativeProfile =
    buildAggregateVector(negativeVectors);

  for (const candidate of candidates) {
    const key = `${candidate.mediaType}:${candidate.id}`;

    const overview = candidate.overview ?? "";

    if (!overview.trim()) {
      scores.set(key, 0);
      continue;
    }

    const candidateVector = buildTextVector(
      overview,
      idf,
    );

    if (candidateVector.size === 0) {
      scores.set(key, 0);
      continue;
    }

    const positiveAggregate =
      cosineSimilarity(
        candidateVector,
        positiveProfile,
      );

    const positiveStrongest =
      getStrongestSeedSimilarity(
        candidateVector,
        positiveVectors,
      );

    const positiveScore =
      positiveVectors.length === 0
        ? 0
        : positiveAggregate * 0.65 +
          positiveStrongest * 0.35;

    const negativeAggregate =
      cosineSimilarity(
        candidateVector,
        negativeProfile,
      );

    const negativeStrongest =
      getStrongestSeedSimilarity(
        candidateVector,
        negativeVectors,
      );

    const negativeScore =
      negativeVectors.length === 0
        ? 0
        : negativeAggregate * 0.65 +
          negativeStrongest * 0.35;

    scores.set(
      key,
      clamp(
        positiveScore - negativeScore * 0.8,
        -1,
        1,
      ),
    );
  }

  return scores;
}
