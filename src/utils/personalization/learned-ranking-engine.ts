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

type FactorizationModel = {
  version: 1;
  fingerprint: string;
  bias: number;
  linear: Record<string, number>;
  factors: Record<string, number[]>;
  factorCount: number;
  sampleCount: number;
  validationAuc: number | null;
  trainedAt: string;
};

const STORAGE_KEY = "ryuflix_learned_fm_v1";

const FACTOR_COUNT = 8;
const EPOCHS = 35;
const LEARNING_RATE = 0.025;
const REGULARIZATION = 0.015;
const EARLY_STOPPING_PATIENCE = 7;
const MINIMUM_SAMPLES = 6;
const MAX_FEATURES_PER_ITEM = 80;

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

  if (!normalized || !Number.isFinite(weight) || weight <= 0) {
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

function fingerprintExamples(
  examples: TrainingSample[],
): string {
  const signature = examples
    .map((sample) => {
      const features = sample.features
        .map((feature) => `${feature.key}:${feature.value}`)
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

function sigmoid(value: number): number {
  const safe = clamp(value, -20, 20);

  return 1 / (1 + Math.exp(-safe));
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
    version: 1,
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

function predictProbability(
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
    const linearWeight = model.linear[feature.key];

    if (linearWeight !== undefined) {
      score += linearWeight * feature.value;
    }

    const vector = model.factors[feature.key];

    if (!vector) continue;

    for (let factor = 0; factor < model.factorCount; factor++) {
      const value = vector[factor] * feature.value;

      factorSums[factor] += value;
      factorSquares[factor] += value * value;
    }
  }

  let interaction = 0;

  for (let factor = 0; factor < model.factorCount; factor++) {
    interaction +=
      factorSums[factor] * factorSums[factor] -
      factorSquares[factor];
  }

  score += interaction * 0.5;

  return sigmoid(score);
}

function updateSample(
  model: FactorizationModel,
  sample: TrainingSample,
): void {
  const prediction = predictProbability(
    model,
    sample.features,
  );

  const error =
    (prediction - sample.label) * sample.weight;

  const factorSums = new Float64Array(
    model.factorCount,
  );

  for (const feature of sample.features) {
    const vector = model.factors[feature.key];

    if (!vector) continue;

    for (let factor = 0; factor < model.factorCount; factor++) {
      factorSums[factor] +=
        vector[factor] * feature.value;
    }
  }

  model.bias = clamp(
    model.bias - LEARNING_RATE * error,
    -5,
    5,
  );

  for (const feature of sample.features) {
    const key = feature.key;
    const value = feature.value;

    const currentLinear = model.linear[key] ?? 0;

    const linearGradient =
      error * value +
      REGULARIZATION * currentLinear;

    model.linear[key] = clamp(
      currentLinear -
        LEARNING_RATE * linearGradient,
      -5,
      5,
    );

    const vector = model.factors[key];

    if (!vector) continue;

    const gradients = new Float64Array(
      model.factorCount,
    );

    for (let factor = 0; factor < model.factorCount; factor++) {
      const current = vector[factor];

      const interactionGradient =
        value *
        (factorSums[factor] - current * value);

      gradients[factor] =
        error * interactionGradient +
        REGULARIZATION * current;
    }

    for (let factor = 0; factor < model.factorCount; factor++) {
      vector[factor] = clamp(
        vector[factor] -
          LEARNING_RATE * gradients[factor],
        -3,
        3,
      );
    }
  }
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

function shuffleSamples(
  samples: TrainingSample[],
  random: () => number,
): TrainingSample[] {
  const shuffled = [...samples];

  for (let index = shuffled.length - 1; index > 0; index--) {
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

function hasBothClasses(
  samples: TrainingSample[],
): boolean {
  return (
    samples.some((sample) => sample.label >= 0.55) &&
    samples.some((sample) => sample.label <= 0.25)
  );
}

function calculateAuc(
  model: FactorizationModel,
  samples: TrainingSample[],
): number | null {
  const positive: number[] = [];
  const negative: number[] = [];

  for (const sample of samples) {
    const score = predictProbability(
      model,
      sample.features,
    );

    if (sample.label >= 0.55) {
      positive.push(score);
    } else if (sample.label <= 0.25) {
      negative.push(score);
    }
  }

  if (positive.length === 0 || negative.length === 0) {
    return null;
  }

  let wins = 0;
  let comparisons = 0;

  for (const positiveScore of positive) {
    for (const negativeScore of negative) {
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

  if (
    !hasBothClasses(training) ||
    !hasBothClasses(validation)
  ) {
    return {
      training: ordered,
      validation: [],
    };
  }

  return { training, validation };
}

function trainModel(
  samples: TrainingSample[],
  fingerprint: string,
): FactorizationModel | null {
  const positiveCount = samples.filter(
    (sample) => sample.label >= 0.55,
  ).length;

  const negativeCount = samples.filter(
    (sample) => sample.label <= 0.25,
  ).length;

  if (
    samples.length < MINIMUM_SAMPLES ||
    positiveCount < 2 ||
    negativeCount < 2
  ) {
    return null;
  }

  const split = splitByTime(samples);

  if (!hasBothClasses(split.training)) {
    return null;
  }

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

  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    const shuffled = shuffleSamples(
      split.training,
      random,
    );

    for (const sample of shuffled) {
      updateSample(model, sample);
    }

    let improved = false;

    if (split.validation.length > 0) {
      const auc = calculateAuc(
        model,
        split.validation,
      );

      if (auc !== null && auc > bestAuc + 0.0001) {
        bestAuc = auc;
        bestModel = cloneModel(model);
        improved = true;
      }
    } else {
      const loss = calculateLogLoss(
        model,
        split.training,
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
      split.validation.length > 0 &&
      epochsWithoutImprovement >= EARLY_STOPPING_PATIENCE
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

function calculateLogLoss(
  model: FactorizationModel,
  samples: TrainingSample[],
): number {
  let totalLoss = 0;
  let totalWeight = 0;

  for (const sample of samples) {
    const prediction = clamp(
      predictProbability(model, sample.features),
      0.0001,
      0.9999,
    );

    const loss =
      -sample.label * Math.log(prediction) -
      (1 - sample.label) * Math.log(1 - prediction);

    totalLoss += loss * sample.weight;
    totalWeight += sample.weight;
  }

  return totalWeight > 0
    ? totalLoss / totalWeight
    : Infinity;
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
      parsed.version !== 1 ||
      typeof parsed.fingerprint !== "string" ||
      typeof parsed.bias !== "number" ||
      typeof parsed.linear !== "object" ||
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

function saveModel(model: FactorizationModel): void {
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
    // The recommender continues to work without model persistence.
  }
}

function prepareSamples(
  examples: LearnedTrainingExample[],
): TrainingSample[] {
  return examples
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
    .filter((sample) => sample.features.length > 0);
}

/**
 * Train a profile-specific second-order Factorization Machine
 * and return predicted engagement probabilities for candidates.
 *
 * The model is trained only from actual viewing-history examples.
 * It does not treat unshown or ignored recommendations as dislikes.
 */
export function getLearnedRankingScores(
  candidates: FeatureVectorItem[],
  examples: LearnedTrainingExample[],
): Map<string, number> {
  const scores = new Map<string, number>();

  if (candidates.length === 0 || typeof window === "undefined") {
    return scores;
  }

  const samples = prepareSamples(examples);

  if (samples.length < MINIMUM_SAMPLES) {
    return scores;
  }

  const fingerprint = fingerprintExamples(samples);

  let model = readStoredModel();

  if (!model || model.fingerprint !== fingerprint) {
    model = trainModel(samples, fingerprint);

    if (!model) {
      return scores;
    }

    saveModel(model);
  }

  for (const candidate of candidates) {
    const features = extractFeatures(candidate);

    if (features.length === 0) continue;

    const probability = predictProbability(
      model,
      features,
    );

    scores.set(
      `${candidate.mediaType}:${candidate.id}`,
      probability,
    );
  }

  return scores;
}

/**
 * Clears only the active profile's learned ranking model.
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
