
"use client";

import type { FeatureVectorItem } from "@/utils/personalization/feature-vector-engine";
import { getProfileStorageKey } from "@/utils/profiles";

export interface LearnedTrainingExample {
  item: FeatureVectorItem;
  label: number;
  weight: number;
  timestamp: string;
}

type SparseFeature = {
  key: string;
  value: number;
};

type TrainingSample = {
  features: SparseFeature[];
  label: number;
  weight: number;
  timestamp: string;
};

type TrainingPair = {
  positive: TrainingSample;
  negative: TrainingSample;
  weight: number;
};

type FactorizationModel = {
  version: 3;
  fingerprint: string;
  bias: number;
  linear: Record<string, number>;
  factors: Record<string, number[]>;
  factorCount: number;
  sampleCount: number;
  validationAuc: number | null;
  trainedAt: string;
};

const STORAGE_KEY = "ryuflix_learned_fm_v3";

const FACTOR_COUNT = 12;
const EPOCHS = 45;
const LEARNING_RATE = 0.018;
const REGULARIZATION = 0.012;
const EARLY_STOPPING_PATIENCE = 8;
const MINIMUM_CLASS_SAMPLES = 2;
const MAX_SAMPLES_PER_CLASS = 80;
const MAX_FEATURES_PER_ITEM = 80;
const MAX_PAIRS = 2048;

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

function addFeature(
  features: Map<string, number>,
  category: string,
  value: string,
  weight: number,
): void {
  const normalized = normalize(value);

  if (
    !normalized ||
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
    return;
  }

  const key = `${category}:${normalized}`;

  features.set(
    key,
    Math.max(features.get(key) ?? 0, weight),
  );
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

  return "before 1970";
}

function extractFeatures(
  item: FeatureVectorItem,
): SparseFeature[] {
  const features = new Map<string, number>();

  addFeature(
    features,
    "media-type",
    item.mediaType,
    0.35,
  );

  item.genres.slice(0, 12).forEach((genre) => {
    addFeature(features, "genre", genre, 1);
  });

  item.keywords.slice(0, 28).forEach((keyword) => {
    addFeature(features, "keyword", keyword, 1);
  });

  item.directors.slice(0, 4).forEach((director) => {
    addFeature(features, "director", director, 1.25);
  });

  item.cast.slice(0, 12).forEach((actor, index) => {
    addFeature(
      features,
      "actor",
      actor,
      0.75 / (1 + index * 0.1),
    );
  });

  item.languages.slice(0, 5).forEach((language) => {
    addFeature(features, "language", language, 0.3);
  });

  item.countries.slice(0, 6).forEach((country) => {
    addFeature(features, "country", country, 0.25);
  });

  const era = getEra(item.releaseDate);

  if (era) {
    addFeature(features, "era", era, 0.35);
  }

  return [...features.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_FEATURES_PER_ITEM);
}

function hashText(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed || 1;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;

    return (state >>> 0) / 4294967296;
  };
}

function sigmoid(value: number): number {
  const safe = clamp(value, -20, 20);

  return 1 / (1 + Math.exp(-safe));
}

function fingerprintSamples(
  samples: TrainingSample[],
): string {
  const signature = samples
    .map((sample) => {
      const features = sample.features
        .map(
          (feature) =>
            `${feature.key}:${feature.value}`,
        )
        .join(",");

      return [
        features,
        sample.label.toFixed(4),
        sample.weight.toFixed(4),
        sample.timestamp,
      ].join("|");
    })
    .sort()
    .join("\n");

  return hashText(signature).toString(36);
}

function deterministicFactor(
  feature: string,
  factor: number,
): number {
  const seed = hashText(`${feature}:${factor}`);
  const normalized = seed / 4294967295;

  return (normalized - 0.5) * 0.08;
}

function createModel(
  samples: TrainingSample[],
  fingerprint: string,
): FactorizationModel {
  const linear: Record<string, number> = {};
  const factors: Record<string, number[]> = {};
  const vocabulary = new Set<string>();

  for (const sample of samples) {
    for (const feature of sample.features) {
      vocabulary.add(feature.key);
    }
  }

  for (const feature of vocabulary) {
    linear[feature] = 0;

    factors[feature] = Array.from(
      { length: FACTOR_COUNT },
      (_, index) =>
        deterministicFactor(feature, index),
    );
  }

  return {
    version: 3,
    fingerprint,
    bias: 0,
    linear,
    factors,
    factorCount: FACTOR_COUNT,
    sampleCount: samples.length,
    validationAuc: null,
    trainedAt: new Date().toISOString(),
  };
}

function cloneModel(
  model: FactorizationModel,
): FactorizationModel {
  return {
    ...model,
    linear: { ...model.linear },
    factors: Object.fromEntries(
      Object.entries(model.factors).map(
        ([key, values]) => [key, [...values]],
      ),
    ),
  };
}

function predictRaw(
  model: FactorizationModel,
  features: SparseFeature[],
): number {
  let score = model.bias;

  const factorSums = new Float64Array(
    model.factorCount,
  );

  const factorSquares = new Float64Array(
    model.factorCount,
  );

  for (const feature of features) {
    score +=
      (model.linear[feature.key] ?? 0) *
      feature.value;

    const vector = model.factors[feature.key];

    if (!vector) continue;

    for (
      let factor = 0;
      factor < model.factorCount;
      factor++
    ) {
      const value =
        vector[factor] * feature.value;

      factorSums[factor] += value;
      factorSquares[factor] += value * value;
    }
  }

  let interaction = 0;

  for (
    let factor = 0;
    factor < model.factorCount;
    factor++
  ) {
    interaction +=
      factorSums[factor] * factorSums[factor] -
      factorSquares[factor];
  }

  return score + interaction * 0.5;
}

function predictProbability(
  model: FactorizationModel,
  features: SparseFeature[],
): number {
  return sigmoid(predictRaw(model, features));
}

function getScoreGradients(
  model: FactorizationModel,
  features: SparseFeature[],
): Map<
  string,
  {
    linear: number;
    factors: number[];
  }
> {
  const factorSums = new Float64Array(
    model.factorCount,
  );

  for (const feature of features) {
    const vector = model.factors[feature.key];

    if (!vector) continue;

    for (
      let factor = 0;
      factor < model.factorCount;
      factor++
    ) {
      factorSums[factor] +=
        vector[factor] * feature.value;
    }
  }

  const gradients = new Map<
    string,
    {
      linear: number;
      factors: number[];
    }
  >();

  for (const feature of features) {
    const vector = model.factors[feature.key];

    const factorGradients = Array.from(
      { length: model.factorCount },
      (_, factor) => {
        if (!vector) return 0;

        return (
          feature.value *
          (
            factorSums[factor] -
            vector[factor] * feature.value
          )
        );
      },
    );

    gradients.set(feature.key, {
      linear: feature.value,
      factors: factorGradients,
    });
  }

  return gradients;
}

/**
 * Finds a small stride that visits every negative sample
 * before repeating an offset.
 */
function greatestCommonDivisor(
  left: number,
  right: number,
): number {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a;
}

function getCoprimeStride(size: number): number {
  if (size <= 1) return 1;

  let stride = Math.min(17, size - 1);

  while (greatestCommonDivisor(stride, size) !== 1) {
    stride += 1;

    if (stride >= size) {
      stride = 1;
    }
  }

  return stride;
}

/**
 * Builds a bounded, balanced set of pairwise comparisons.
 *
 * The previous implementation generated pairs in row-major
 * order and sliced the first 2,048. With larger histories,
 * this could repeatedly train against only a small section
 * of the negative examples.
 *
 * This version rotates through the negative class while
 * ensuring every positive example participates in each
 * sampling round.
 */
function buildPairs(
  samples: TrainingSample[],
): TrainingPair[] {
  const positives = samples.filter(
    (sample) => sample.label >= 0.55,
  );

  const negatives = samples.filter(
    (sample) => sample.label <= 0.25,
  );

  if (
    positives.length < MINIMUM_CLASS_SAMPLES ||
    negatives.length < MINIMUM_CLASS_SAMPLES
  ) {
    return [];
  }

  const pairs: TrainingPair[] = [];
  const stride = getCoprimeStride(negatives.length);

  const rounds = Math.ceil(
    MAX_PAIRS / positives.length,
  );

  for (
    let round = 0;
    round < rounds && pairs.length < MAX_PAIRS;
    round++
  ) {
    const offset =
      (round * stride) % negatives.length;

    for (
      let positiveIndex = 0;
      positiveIndex < positives.length &&
      pairs.length < MAX_PAIRS;
      positiveIndex++
    ) {
      const negativeIndex =
        (positiveIndex + offset) % negatives.length;

      const positive = positives[positiveIndex];
      const negative = negatives[negativeIndex];

      if (!positive || !negative) continue;

      const weight = Math.sqrt(
        positive.weight * negative.weight,
      );

      pairs.push({
        positive,
        negative,
        weight: clamp(weight, 0.1, 3),
      });
    }
  }

  return pairs;
}

function updatePair(
  model: FactorizationModel,
  pair: TrainingPair,
): void {
  const positiveScore = predictRaw(
    model,
    pair.positive.features,
  );

  const negativeScore = predictRaw(
    model,
    pair.negative.features,
  );

  const difference =
    positiveScore - negativeScore;

  const pairError =
    sigmoid(-difference) * pair.weight;

  const positiveGradients = getScoreGradients(
    model,
    pair.positive.features,
  );

  const negativeGradients = getScoreGradients(
    model,
    pair.negative.features,
  );

  const allKeys = new Set([
    ...positiveGradients.keys(),
    ...negativeGradients.keys(),
  ]);

  for (const key of allKeys) {
    const positive =
      positiveGradients.get(key);

    const negative =
      negativeGradients.get(key);

    const currentLinear =
      model.linear[key] ?? 0;

    const linearGradient =
      (positive?.linear ?? 0) -
      (negative?.linear ?? 0);

    model.linear[key] = clamp(
      currentLinear +
        LEARNING_RATE *
          (
            pairError * linearGradient -
            REGULARIZATION * currentLinear
          ),
      -5,
      5,
    );

    const vector = model.factors[key];

    if (!vector) continue;

    for (
      let factor = 0;
      factor < model.factorCount;
      factor++
    ) {
      const gradient =
        (positive?.factors[factor] ?? 0) -
        (negative?.factors[factor] ?? 0);

      vector[factor] = clamp(
        vector[factor] +
          LEARNING_RATE *
            (
              pairError * gradient -
              REGULARIZATION * vector[factor]
            ),
        -3,
        3,
      );
    }
  }
}

function shufflePairs(
  pairs: TrainingPair[],
  random: () => number,
): TrainingPair[] {
  const shuffled = [...pairs];

  for (
    let index = shuffled.length - 1;
    index > 0;
    index--
  ) {
    const swapIndex = Math.floor(
      random() * (index + 1),
    );

    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function calculateAuc(
  model: FactorizationModel,
  samples: TrainingSample[],
): number | null {
  const positives = samples.filter(
    (sample) => sample.label >= 0.55,
  );

  const negatives = samples.filter(
    (sample) => sample.label <= 0.25,
  );

  if (
    positives.length === 0 ||
    negatives.length === 0
  ) {
    return null;
  }

  let wins = 0;
  let comparisons = 0;

  for (const positive of positives) {
    const positiveScore = predictRaw(
      model,
      positive.features,
    );

    for (const negative of negatives) {
      const negativeScore = predictRaw(
        model,
        negative.features,
      );

      if (positiveScore > negativeScore) {
        wins += 1;
      } else if (positiveScore === negativeScore) {
        wins += 0.5;
      }

      comparisons += 1;
    }
  }

  return comparisons > 0
    ? wins / comparisons
    : null;
}

function calculatePairwiseLoss(
  model: FactorizationModel,
  pairs: TrainingPair[],
): number {
  if (pairs.length === 0) return Infinity;

  let total = 0;
  let totalWeight = 0;

  for (const pair of pairs) {
    const difference =
      predictRaw(model, pair.positive.features) -
      predictRaw(model, pair.negative.features);

    const loss = Math.log1p(
      Math.exp(-clamp(difference, -20, 20)),
    );

    total += loss * pair.weight;
    totalWeight += pair.weight;
  }

  return totalWeight > 0
    ? total / totalWeight
    : Infinity;
}

function splitByTime(
  samples: TrainingSample[],
): {
  training: TrainingSample[];
  validation: TrainingSample[];
} {
  const ordered = [...samples].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() -
      new Date(b.timestamp).getTime(),
  );

  if (ordered.length < 10) {
    return {
      training: ordered,
      validation: [],
    };
  }

  const splitIndex = Math.floor(
    ordered.length * 0.8,
  );

  const training = ordered.slice(0, splitIndex);
  const validation = ordered.slice(splitIndex);

  const hasBothClasses = (items: TrainingSample[]) =>
    items.some((sample) => sample.label >= 0.55) &&
    items.some((sample) => sample.label <= 0.25);

  if (
    !hasBothClasses(training) ||
    !hasBothClasses(validation)
  ) {
    return {
      training: ordered,
      validation: [],
    };
  }

  return {
    training,
    validation,
  };
}

function sortByTrainingValue(
  a: TrainingSample,
  b: TrainingSample,
): number {
  if (b.weight !== a.weight) {
    return b.weight - a.weight;
  }

  return (
    new Date(b.timestamp).getTime() -
    new Date(a.timestamp).getTime()
  );
}

function balanceSamples(
  samples: TrainingSample[],
): TrainingSample[] {
  const positives = samples
    .filter((sample) => sample.label >= 0.55)
    .sort(sortByTrainingValue);

  const negatives = samples
    .filter((sample) => sample.label <= 0.25)
    .sort(sortByTrainingValue);

  if (
    positives.length < MINIMUM_CLASS_SAMPLES ||
    negatives.length < MINIMUM_CLASS_SAMPLES
  ) {
    return [];
  }

  const positiveLimit = Math.min(
    MAX_SAMPLES_PER_CLASS,
    negatives.length * 4,
  );

  const negativeLimit = Math.min(
    MAX_SAMPLES_PER_CLASS,
    positives.length * 4,
  );

  return [
    ...positives.slice(0, positiveLimit),
    ...negatives.slice(0, negativeLimit),
  ].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() -
      new Date(b.timestamp).getTime(),
  );
}

function prepareSamples(
  examples: LearnedTrainingExample[],
): TrainingSample[] {
  const samples = examples
    .filter(
      (example) =>
        Number.isFinite(example.label) &&
        Number.isFinite(example.weight) &&
        example.weight > 0,
    )
    .map((example) => ({
      features: extractFeatures(example.item),
      label: clamp(example.label, 0, 1),
      weight: clamp(example.weight, 0.1, 3),
      timestamp: example.timestamp,
    }))
    .filter(
      (sample) =>
        sample.features.length > 0 &&
        Number.isFinite(
          new Date(sample.timestamp).getTime(),
        ),
    );

  return balanceSamples(samples);
}

function trainModel(
  samples: TrainingSample[],
  fingerprint: string,
): FactorizationModel | null {
  const split = splitByTime(samples);

  const trainingPairs = buildPairs(
    split.training,
  );

  if (trainingPairs.length === 0) {
    return null;
  }

  const validationPairs = buildPairs(
    split.validation,
  );

  const model = createModel(
    split.training,
    fingerprint,
  );

  const random = createRandom(
    hashText(fingerprint),
  );

  let bestModel = cloneModel(model);
  let bestAuc = -Infinity;
  let bestLoss = Infinity;
  let epochsWithoutImprovement = 0;

  for (
    let epoch = 0;
    epoch < EPOCHS;
    epoch++
  ) {
    const shuffled = shufflePairs(
      trainingPairs,
      random,
    );

    for (const pair of shuffled) {
      updatePair(model, pair);
    }

    let improved = false;

    if (validationPairs.length > 0) {
      const auc = calculateAuc(
        model,
        split.validation,
      );

      if (
        auc !== null &&
        auc > bestAuc + 0.0001
      ) {
        bestAuc = auc;
        bestModel = cloneModel(model);
        improved = true;
      }
    } else {
      const loss = calculatePairwiseLoss(
        model,
        trainingPairs,
      );

      if (loss < bestLoss - 0.0001) {
        bestLoss = loss;
        bestModel = cloneModel(model);
        improved = true;
      }
    }

    if (improved) {
      epochsWithoutImprovement = 0;
    } else {
      epochsWithoutImprovement += 1;
    }

    if (
      epochsWithoutImprovement >=
      EARLY_STOPPING_PATIENCE
    ) {
      break;
    }
  }

  bestModel.fingerprint = fingerprint;
  bestModel.sampleCount = samples.length;
  bestModel.validationAuc =
    Number.isFinite(bestAuc)
      ? bestAuc
      : null;
  bestModel.trainedAt = new Date().toISOString();

  return bestModel;
}

function readStoredModel(): FactorizationModel | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const key = getProfileStorageKey(STORAGE_KEY);
    const raw = window.localStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as FactorizationModel;

    if (
      parsed.version !== 3 ||
      typeof parsed.fingerprint !== "string" ||
      typeof parsed.bias !== "number" ||
      !parsed.linear ||
      typeof parsed.linear !== "object" ||
      !parsed.factors ||
      typeof parsed.factors !== "object" ||
      !Number.isFinite(parsed.factorCount) ||
      parsed.factorCount <= 0
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveModel(
  model: FactorizationModel,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getProfileStorageKey(STORAGE_KEY);

    window.localStorage.setItem(
      key,
      JSON.stringify(model),
    );
  } catch {
    // Recommendations remain usable without model persistence.
  }
}

/**
 * Pairwise Factorization Machine:
 * learns to rank positively engaged titles above negative examples.
 *
 * Only actual interactions and explicit feedback are supplied by
 * the caller. Unseen titles are never converted into negative labels.
 */
export function getLearnedRankingScores(
  candidates: FeatureVectorItem[],
  examples: LearnedTrainingExample[],
): Map<string, number> {
  const scores = new Map<string, number>();

  if (
    candidates.length === 0 ||
    typeof window === "undefined"
  ) {
    return scores;
  }

  const samples = prepareSamples(examples);

  if (samples.length === 0) {
    return scores;
  }

  const fingerprint = fingerprintSamples(samples);

  let model = readStoredModel();

  if (
    !model ||
    model.fingerprint !== fingerprint
  ) {
    model = trainModel(samples, fingerprint);

    if (!model) {
      return scores;
    }

    saveModel(model);
  }

  for (const candidate of candidates) {
    const features = extractFeatures(candidate);

    if (features.length === 0) continue;

    scores.set(
      `${candidate.mediaType}:${candidate.id}`,
      predictProbability(model, features),
    );
  }

  return scores;
}

/**
 * Clears the active profile's learned ranking model.
 */
export function clearLearnedRankingModel(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(
      getProfileStorageKey(STORAGE_KEY),
    );
  } catch {
    // Ignore unavailable local storage.
  }
}
