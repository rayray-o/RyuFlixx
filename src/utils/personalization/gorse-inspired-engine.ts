
"use client";

import { env } from "@/utils/env";
import type { ContentType } from "@/types";
import {
  getLocalWatchlist,
  getWatchHistory,
} from "@/utils/localStorage";
import {
  getBehavioralSummary,
} from "@/utils/personalization/behavioral-memory";
import {
  getFeedbackVectors,
} from "@/utils/personalization/feedback-vector-engine";
import {
  getFeatureSimilarityScores,
  type FeatureVectorItem,
  type FeatureVectorSeed,
} from "@/utils/personalization/feature-vector-engine";
import {
  getSynopsisSimilarityScores,
  type SynopsisSeed,
} from "@/utils/personalization/synopsis-feature-engine";
import {
  getLearnedRankingScores,
  type LearnedTrainingExample,
} from "@/utils/personalization/learned-ranking-engine";
import {
  getPersonalizedRecommendations,
  type RecommendationItem,
} from "@/utils/personalization/recommendation-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";
import {
  buildInterestDiscoveryTargets,
  type InterestDiscoverySeed,
} from "@/utils/personalization/interest-cluster-discovery";
import {
  buildInterestClusterSourceRequests,
} from "@/utils/personalization/interest-cluster-retrieval";
import {
  applyTemporalInterestWeights,
} from "@/utils/personalization/temporal-interest-engine";
import {
  buildEmergingInterestTargets,
} from "@/utils/personalization/emerging-interest-engine";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const REQUEST_TIMEOUT = 6500;
const CACHE_TTL = 3 * 60 * 1000;
const DETAIL_CACHE_TTL = 12 * 60 * 60 * 1000;
const GENRE_CACHE_TTL = 24 * 60 * 60 * 1000;

const MAX_CACHE_ENTRIES = 16;
const MAX_DETAIL_CACHE_ENTRIES = 400;

const MAX_ENRICHED_CANDIDATES = 48;
const MAX_HISTORY_SEEDS = 5;
const MAX_FEATURE_POSITIVE_SEEDS = 24;
const MAX_NEGATIVE_SEEDS = 10;
const MAX_TRAINING_TITLES = 40;

const MAX_DISCOVERY_GENRES = 4;
const MAX_DISCOVERY_KEYWORDS = 2;

const DETAIL_CONCURRENCY = 4;
const PRIMARY_ENRICHMENT_SHARE = 0.75;

type DiscoverResponse = {
  results?: Array<Record<string, unknown>>;
};

type GenreResponse = {
  genres?: Array<{
    id?: number;
    name?: string;
  }>;
};

type KeywordResponse = {
  results?: Array<{
    id?: number;
    name?: string;
  }>;
};

type GenreEntry = {
  id: number;
  name: string;
};

type HistorySeed = {
  id: number;
  score: number;
  updatedAt: string;
};

type TrainingSignal = {
  id: number;
  mediaType: ContentType;
  label: number;
  weight: number;
  timestamp: string;
};

type CandidateRecord = {
  item: RecommendationItem;
  sourceScore: number;
  sources: Set<string>;
};

type RankedCandidate = RecommendationItem & {
  _score: number;
  _clusterSources: string[];
};

type PreliminaryCandidate = {
  item: RecommendationItem;
  score: number;
  explorationScore: number;
  clusterSources: string[];
};

type SourceRequest = {
  name: string;
  weight: number;
  run: () => Promise<RecommendationItem[]>;
};

type CachedRecommendations = {
  expiresAt: number;
  items: RecommendationItem[];
};

type CachedDetails = {
  expiresAt: number;
  item: DetailedFeatureItem;
};

type CachedGenres = {
  expiresAt: number;
  genres: GenreEntry[];
};

type DetailedFeatureItem = FeatureVectorItem & {
  overview?: string;
};

type DetailedFeatureSeed = Omit<FeatureVectorSeed, "item"> & {
  item: DetailedFeatureItem;
};

type FeaturePreference = {
  name: string;
  score: number;
};

type AdaptiveExplorationProfile = {
  enrichmentExplorationShare: number;
  rankingBlend: number;
};

const recommendationCache = new Map<
  string,
  CachedRecommendations
>();

const detailCache = new Map<string, CachedDetails>();

const detailInFlight = new Map<
  string,
  Promise<DetailedFeatureItem | null>
>();

const genreCache = new Map<
  ContentType,
  CachedGenres
>();
export function clearGorseInspiredRecommendationCache(): void {
  recommendationCache.clear();
}

function number(value: unknown): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : 0;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, value));
}

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asObjects(
  value: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(asObject)
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null,
    );
}

function normalizeFeatureName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeItem(
  raw: Record<string, unknown>,
  mediaType: ContentType,
): RecommendationItem | null {
  const id = number(raw.id);

  if (!id) {
    return null;
  }

  return {
    id,
    mediaType,
    title:
      typeof raw.title === "string"
        ? raw.title
        : undefined,
    name:
      typeof raw.name === "string"
        ? raw.name
        : undefined,
    poster_path:
      typeof raw.poster_path === "string"
        ? raw.poster_path
        : null,
    backdrop_path:
      typeof raw.backdrop_path === "string"
        ? raw.backdrop_path
        : null,
    vote_average: number(raw.vote_average),
    vote_count: number(raw.vote_count),
    popularity: number(raw.popularity),
    release_date:
      typeof raw.release_date === "string"
        ? raw.release_date
        : undefined,
    first_air_date:
      typeof raw.first_air_date === "string"
        ? raw.first_air_date
        : undefined,
    genre_ids: Array.isArray(raw.genre_ids)
      ? raw.genre_ids.filter(
          (id): id is number =>
            typeof id === "number" &&
            Number.isFinite(id),
        )
      : [],
    overview:
      typeof raw.overview === "string"
        ? raw.overview
        : undefined,
    original_language:
      typeof raw.original_language === "string"
        ? raw.original_language
        : undefined,
  };
}

async function tmdb<T>(
  path: string,
): Promise<T | null> {
  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT,
  );

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}${path}`,
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function pruneRecommendationCache(): void {
  const now = Date.now();

  for (const [key, entry] of recommendationCache) {
    if (entry.expiresAt <= now) {
      recommendationCache.delete(key);
    }
  }

  while (
    recommendationCache.size > MAX_CACHE_ENTRIES
  ) {
    const oldestKey =
      recommendationCache.keys().next().value;

    if (!oldestKey) break;

    recommendationCache.delete(oldestKey);
  }
}

function pruneDetailCache(): void {
  const now = Date.now();

  for (const [key, entry] of detailCache) {
    if (entry.expiresAt <= now) {
      detailCache.delete(key);
    }
  }

  while (
    detailCache.size > MAX_DETAIL_CACHE_ENTRIES
  ) {
    const oldestKey =
      detailCache.keys().next().value;

    if (!oldestKey) break;

    detailCache.delete(oldestKey);
  }
}

function pruneGenreCache(): void {
  const now = Date.now();

  for (const [key, entry] of genreCache) {
    if (entry.expiresAt <= now) {
      genreCache.delete(key);
    }
  }
}

function tasteFingerprint(
  tasteProfile: TasteProfile | null,
): string {
  if (!tasteProfile) {
    return "no-profile";
  }

  const preferences = tasteProfile.preferences;

  return [
    preferences.genres
      .map((item) => `${item.name}:${item.score}`)
      .sort()
      .join(","),
    preferences.keywords
      .map((item) => `${item.name}:${item.score}`)
      .sort()
      .join(","),
    preferences.languages
      .map((item) => `${item.name}:${item.score}`)
      .sort()
      .join(","),
    preferences.countries
      .map((item) => `${item.name}:${item.score}`)
      .sort()
      .join(","),
  ].join("|");
}

function activityFingerprint(): string {
  const vectors = getFeedbackVectors();

  return vectors
    .map(
      (vector) =>
        `${vector.mediaType}:${vector.id}:${vector.label.toFixed(3)}:${vector.weight.toFixed(3)}:${vector.timestamp}`,
    )
    .sort()
    .join("|");
}

function getExcludedIds(): Set<string> {
  const excluded = new Set<string>();

  for (const entry of getAllExplicitFeedbackSafe()) {
    if (
      entry.value === "dislike" ||
      entry.value === "not_interested"
    ) {
      excluded.add(`${entry.mediaType}:${entry.id}`);
    }
  }

  return excluded;
}

function getAllExplicitFeedbackSafe(): Array<{
  id: number;
  mediaType: ContentType;
  value: string;
}> {
  try {
    const { getAllExplicitFeedback } = requireExplicitFeedback();
    return getAllExplicitFeedback();
  } catch {
    return [];
  }
}

function requireExplicitFeedback(): typeof import("@/utils/personalization/explicit-feedback-engine") {
  return explicitFeedbackModule;
}

import * as explicitFeedbackModule from "@/utils/personalization/explicit-feedback-engine";

function qualityScore(
  item: RecommendationItem,
): number {
  const rating = clamp(
    number(item.vote_average),
    0,
    10,
  );

  const votes = Math.max(
    0,
    number(item.vote_count),
  );

  const popularity = Math.max(
    0,
    number(item.popularity),
  );

  const ratingConfidence =
    votes / (votes + 250);

  const weightedRating =
    rating * ratingConfidence +
    6.2 * (1 - ratingConfidence);

  const popularityScore =
    Math.log1p(popularity) * 1.4;

  return weightedRating * 2.2 + popularityScore;
}

function addCandidate(
  candidates: Map<string, CandidateRecord>,
  item: RecommendationItem,
  source: string,
  weight: number,
): void {
  const key = `${item.mediaType}:${item.id}`;

  const existing = candidates.get(key);

  if (existing) {
    existing.sourceScore += weight;
    existing.sources.add(source);
    return;
  }

  candidates.set(key, {
    item,
    sourceScore: weight,
    sources: new Set([source]),
  });
}

async function fetchCollection(
  path: string,
  mediaType: ContentType,
): Promise<RecommendationItem[]> {
  const response = await tmdb<DiscoverResponse>(path);

  return asObjects(response?.results)
    .map((item) => normalizeItem(item, mediaType))
    .filter(
      (item): item is RecommendationItem =>
        item !== null,
    );
}

async function fetchGenreCatalog(
  mediaType: ContentType,
): Promise<GenreEntry[]> {
  pruneGenreCache();

  const cached = genreCache.get(mediaType);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.genres;
  }

  const response = await tmdb<GenreResponse>(
    `/genre/${mediaType}/list`,
  );

  const genres = (response?.genres ?? [])
    .filter(
      (genre): genre is {
        id: number;
        name: string;
      } =>
        typeof genre.id === "number" &&
        typeof genre.name === "string",
    )
    .map((genre) => ({
      id: genre.id,
      name: genre.name,
    }));

  genreCache.set(mediaType, {
    expiresAt: Date.now() + GENRE_CACHE_TTL,
    genres,
  });

  return genres;
}

function buildDiscoverPath(
  mediaType: ContentType,
  parameters: Record<string, string>,
): string {
  const query = new URLSearchParams({
    include_adult: "false",
    include_video: "false",
    language: "en-US",
    page: "1",
    ...parameters,
  });

  return `/discover/${mediaType}?${query.toString()}`;
}

async function fetchDetailedItem(
  id: number,
  mediaType: ContentType,
): Promise<DetailedFeatureItem | null> {
  pruneDetailCache();

  const key = `${mediaType}:${id}`;
  const cached = detailCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.item;
  }

  const pending = detailInFlight.get(key);

  if (pending) {
    return pending;
  }

  const request = (async () => {
    const raw = await tmdb<Record<string, unknown>>(
      `/${mediaType}/${id}?append_to_response=keywords,credits`,
    );

    if (!raw) return null;

    const normalized = normalizeItem(raw, mediaType);

    if (!normalized) return null;

    const genreNames = asObjects(raw.genres)
      .map((genre) => string(genre.name))
      .filter(Boolean);

    const keywordRoot = asObject(raw.keywords);
    const keywordItems = mediaType === "movie"
      ? asObjects(keywordRoot?.keywords)
      : asObjects(keywordRoot?.results);

    const keywordNames = keywordItems
      .map((keyword) => string(keyword.name))
      .filter(Boolean);

    const credits = asObject(raw.credits);
    const cast = asObjects(credits?.cast)
      .slice(0, 20)
      .map((person) => string(person.name))
      .filter(Boolean);

    const crew = asObjects(credits?.crew);

    const directors = crew
      .filter(
        (person) =>
          string(person.job).toLowerCase() === "director",
      )
      .slice(0, 5)
      .map((person) => string(person.name))
      .filter(Boolean);

    const languages = [
      string(raw.original_language),
    ].filter(Boolean);

    const countries = asObjects(raw.production_countries)
      .map((country) => string(country.name))
      .filter(Boolean);

    const item: DetailedFeatureItem = {
      ...normalized,
      genres: genreNames,
      keywords: keywordNames,
      cast,
      directors,
      languages,
      countries,
      releaseDate:
        string(raw.release_date) ||
        string(raw.first_air_date),
      overview: string(raw.overview),
    };

    detailCache.set(key, {
      expiresAt: Date.now() + DETAIL_CACHE_TTL,
      item,
    });

    return item;
  })();

  detailInFlight.set(key, request);

  try {
    return await request;
  } finally {
    detailInFlight.delete(key);
  }
}

function getHistorySeeds(
  mediaType: ContentType,
): HistorySeed[] {
  const history = getWatchHistory()
    .filter(
      (entry) =>
        entry.type === mediaType &&
        Number.isFinite(entry.media_id),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime(),
    );

  const result = new Map<number, HistorySeed>();

  for (const entry of history) {
    const progress = entry.completed
      ? 1
      : entry.duration > 0
        ? clamp(
            entry.last_position / entry.duration,
            0,
            1,
          )
        : 0;

    const score =
      progress * 0.75 +
      (entry.completed ? 0.35 : 0);

    const existing = result.get(entry.media_id);

    if (!existing || score > existing.score) {
      result.set(entry.media_id, {
        id: entry.media_id,
        score,
        updatedAt: entry.updated_at,
      });
    }
  }

  return [...result.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HISTORY_SEEDS);
}

function getNegativeHistorySeeds(
  mediaType: ContentType,
): HistorySeed[] {
  return getFeedbackVectors(mediaType)
    .filter(
      (vector) =>
        vector.negative >= 0.2 ||
        vector.explicitFeedback === "dislike" ||
        vector.explicitFeedback === "not_interested",
    )
    .map((vector) => ({
      id: vector.id,
      score: vector.negative,
      updatedAt: vector.timestamp,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NEGATIVE_SEEDS);
}

function getTrainingSignals(): TrainingSignal[] {
  return getFeedbackVectors()
    .map((vector) => ({
      id: vector.id,
      mediaType: vector.mediaType,
      label: vector.label,
      weight: vector.weight,
      timestamp: vector.timestamp,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_TRAINING_TITLES);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from(
    {
      length: Math.min(
        Math.max(1, concurrency),
        items.length,
      ),
    },
    async () => {
      while (true) {
        const index = cursor++;

        if (index >= items.length) {
          return;
        }

        results[index] = await mapper(items[index]);
      }
    },
  );

  await Promise.all(workers);

  return results;
}

function getFeaturePreferenceTargets(
  category: "genre" | "keyword",
  items: DetailedFeatureItem[],
  signals: TrainingSignal[],
  imported: Array<{
    name: string;
    score: number;
  }> = [],
): FeaturePreference[] {
  const scores = new Map<string, number>();

  const signalById = new Map(
    signals.map((signal) => [
      signal.id,
      signal,
    ]),
  );

  for (const item of items) {
    const signal = signalById.get(item.id);

    if (!signal) continue;

    const values =
      category === "genre"
        ? item.genres
        : item.keywords;

    const influence =
      signal.label >= 0.55
        ? signal.weight * signal.label
        : -signal.weight * (1 - signal.label);

    for (const value of values) {
      const key = normalizeFeatureName(value);

      if (!key) continue;

      scores.set(
        key,
        (scores.get(key) ?? 0) + influence,
      );
    }
  }

  for (const preference of imported) {
    const key = normalizeFeatureName(preference.name);

    if (!key) continue;

    scores.set(
      key,
      (scores.get(key) ?? 0) + preference.score,
    );
  }

  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .map(([name, score]) => ({
      name,
      score,
    }))
    .sort((a, b) => b.score - a.score);
}

async function getGenrePreferenceMap(
  mediaType: ContentType,
  items: DetailedFeatureItem[],
  signals: TrainingSignal[],
  tasteProfile: TasteProfile | null,
): Promise<Map<number, number>> {
  const preferences = getFeaturePreferenceTargets(
    "genre",
    items,
    signals,
    tasteProfile?.preferences.genres,
  );

  if (preferences.length === 0) {
    return new Map();
  }

  const catalog = await fetchGenreCatalog(mediaType);

  if (catalog.length === 0) {
    return new Map();
  }

  const idsByName = new Map(
    catalog.map((genre) => [
      normalizeFeatureName(genre.name),
      genre.id,
    ]),
  );

  const maximum = Math.max(
    1,
    ...preferences.map((item) => item.score),
  );

  const result = new Map<number, number>();

  for (const preference of preferences) {
    const id = idsByName.get(
      normalizeFeatureName(preference.name),
    );

    if (id === undefined) continue;

    result.set(
      id,
      clamp(preference.score / maximum, -1, 1),
    );
  }

  return result;
}

async function searchKeywordId(
  keyword: string,
): Promise<number | null> {
  const query = new URLSearchParams({
    query: keyword,
    page: "1",
  });

  const response = await tmdb<KeywordResponse>(
    `/search/keyword?${query.toString()}`,
  );

  const normalized = normalizeFeatureName(keyword);

  const exactMatch = (response?.results ?? []).find(
    (result) =>
      typeof result.id === "number" &&
      typeof result.name === "string" &&
      normalizeFeatureName(result.name) === normalized,
  );

  return typeof exactMatch?.id === "number"
    ? exactMatch.id
    : null;
}

/* =========================================================
   MULTI-SOURCE CANDIDATE RETRIEVAL
   ========================================================= */

async function buildPersonalizedSourceRequests(
  mediaType: ContentType,
  trainingDetails: DetailedFeatureItem[],
  trainingSignals: TrainingSignal[],
  tasteProfile: TasteProfile | null,
): Promise<SourceRequest[]> {
  const requests: SourceRequest[] = [];

  const genrePreferences = getFeaturePreferenceTargets(
    "genre",
    trainingDetails,
    trainingSignals,
    tasteProfile?.preferences.genres,
  ).slice(0, MAX_DISCOVERY_GENRES);

  const genreCatalog =
    genrePreferences.length > 0
      ? await fetchGenreCatalog(mediaType)
      : [];

  const genreIdsByName = new Map(
    genreCatalog.map((genre) => [
      normalizeFeatureName(genre.name),
      genre.id,
    ]),
  );

  const genreTargets = genrePreferences
    .map((preference) => ({
      id: genreIdsByName.get(
        normalizeFeatureName(preference.name),
      ),
      name: preference.name,
      score: preference.score,
    }))
    .filter(
      (
        target,
      ): target is {
        id: number;
        name: string;
        score: number;
      } => target.id !== undefined,
    );

  for (const target of genreTargets) {
    const preferenceBoost = clamp(
      target.score,
      0,
      3,
    );

    requests.push({
      name: `genre-popularity-${target.id}`,
      weight: 5 + preferenceBoost,
      run: () =>
        fetchCollection(
          buildDiscoverPath(mediaType, {
            with_genres: String(target.id),
            sort_by: "popularity.desc",
            page: "1",
          }),
          mediaType,
        ),
    });

    requests.push({
      name: `genre-rated-${target.id}`,
      weight: 4 + preferenceBoost,
      run: () =>
        fetchCollection(
          buildDiscoverPath(mediaType, {
            with_genres: String(target.id),
            sort_by: "vote_average.desc",
            "vote_count.gte":
              mediaType === "movie" ? "100" : "50",
            page: "1",
          }),
          mediaType,
        ),
    });
  }

  if (genreTargets.length >= 2) {
    const combinedGenres = genreTargets
      .slice(0, 3)
      .map((target) => target.id)
      .join("|");

    requests.push({
      name: "genre-combination",
      weight: 5.5,
      run: () =>
        fetchCollection(
          buildDiscoverPath(mediaType, {
            with_genres: combinedGenres,
            sort_by: "popularity.desc",
            page: "1",
          }),
          mediaType,
        ),
    });
  }

  if (genreTargets.length > 0) {
    const recentDate = new Date();

    recentDate.setFullYear(
      recentDate.getFullYear() - 2,
    );

    const dateParameter =
      mediaType === "movie"
        ? "primary_release_date.gte"
        : "first_air_date.gte";

    const sortParameter =
      mediaType === "movie"
        ? "primary_release_date.desc"
        : "first_air_date.desc";

    requests.push({
      name: "recent-personalized-releases",
      weight: 4.5,
      run: () =>
        fetchCollection(
          buildDiscoverPath(mediaType, {
            with_genres: genreTargets
              .slice(0, 3)
              .map((target) => target.id)
              .join("|"),
            [dateParameter]: recentDate
              .toISOString()
              .slice(0, 10),
            sort_by: sortParameter,
            page: "1",
          }),
          mediaType,
        ),
    });
  }

  const keywordPreferences = getFeaturePreferenceTargets(
    "keyword",
    trainingDetails,
    trainingSignals,
    tasteProfile?.preferences.keywords,
  ).slice(0, MAX_DISCOVERY_KEYWORDS);

  const keywordResults = await Promise.all(
    keywordPreferences.map(async (preference) => ({
      preference,
      id: await searchKeywordId(preference.name),
    })),
  );

  for (const result of keywordResults) {
    if (result.id === null) continue;

    requests.push({
      name: `keyword-${result.id}`,
      weight: 6 + clamp(result.preference.score, 0, 2),
      run: () =>
        fetchCollection(
          buildDiscoverPath(mediaType, {
            with_keywords: String(result.id),
            sort_by: "popularity.desc",
            page: "1",
          }),
          mediaType,
        ),
    });
  }

  return requests;
}

/* =========================================================
   ADAPTIVE EXPLORATION
   ========================================================= */

/**
 * Adapts discovery to the strength and breadth of the active
 * profile. Sparse or narrowly concentrated profiles get more
 * exploration; broad, established profiles stay more focused.
 */
function buildAdaptiveExplorationProfile(
  signals: Array<{
    item: DetailedFeatureItem;
    signal: TrainingSignal;
  }>,
): AdaptiveExplorationProfile {
  const positiveTitles = new Map<
    string,
    {
      item: DetailedFeatureItem;
      weight: number;
      label: number;
    }
  >();

  for (const { item, signal } of signals) {
    if (
      signal.label < 0.58 ||
      signal.weight < 0.2 ||
      !Number.isFinite(signal.weight) ||
      !Number.isFinite(signal.label)
    ) {
      continue;
    }

    const key = `${item.mediaType}:${item.id}`;
    const existing = positiveTitles.get(key);

    if (!existing || signal.weight > existing.weight) {
      positiveTitles.set(key, {
        item,
        weight: signal.weight,
        label: signal.label,
      });
    }
  }

  const genreMass = new Map<string, number>();

  for (const {
    item,
    weight,
    label,
  } of positiveTitles.values()) {
    const genres = [
      ...new Set(
        item.genres
          .map(normalizeFeatureName)
          .filter(Boolean),
      ),
    ];

    if (genres.length === 0) continue;

    const influence = clamp(
      weight * (0.5 + label * 0.5),
      0.1,
      3,
    );

    const genreInfluence =
      influence / Math.sqrt(genres.length);

    for (const genre of genres) {
      genreMass.set(
        genre,
        (genreMass.get(genre) ?? 0) + genreInfluence,
      );
    }
  }

  const titleCount = positiveTitles.size;

  const totalGenreMass = [...genreMass.values()].reduce(
    (sum, value) => sum + value,
    0,
  );

  const dominantGenreMass = Math.max(
    0,
    ...genreMass.values(),
  );

  const concentration =
    totalGenreMass > 0
      ? dominantGenreMass / totalGenreMass
      : 0;

  const breadth = clamp(
    (genreMass.size - 1) / 6,
    0,
    1,
  );

  const maturity = 1 - Math.exp(-titleCount / 7);

  const coldStartBoost =
    (1 - maturity) * 0.2;

  const narrowTasteBoost =
    Math.max(0, concentration - 0.4) * 0.18;

  const breadthReduction =
    breadth * 0.09;

  const enrichmentExplorationShare = clamp(
    0.22 +
      coldStartBoost +
      narrowTasteBoost -
      breadthReduction,
    0.18,
    0.48,
  );

  return {
    enrichmentExplorationShare,
    rankingBlend: clamp(
      enrichmentExplorationShare * 0.68,
      0.12,
      0.33,
    ),
  };
}

/* =========================================================
   PRE-ENRICHMENT SELECTION
   ========================================================= */

function selectCandidatesForEnrichment(
  candidates: PreliminaryCandidate[],
  explorationShare = 1 - PRIMARY_ENRICHMENT_SHARE,
): PreliminaryCandidate[] {
  if (candidates.length <= MAX_ENRICHED_CANDIDATES) {
    return [...candidates].sort(
      (a, b) => b.score - a.score,
    );
  }

  const sortedPersonalized = [...candidates].sort(
    (a, b) => b.score - a.score,
  );

  const safeExplorationShare = clamp(
    explorationShare,
    0.18,
    0.48,
  );

  const primaryCount = Math.max(
    1,
    Math.floor(
      MAX_ENRICHED_CANDIDATES *
        (1 - safeExplorationShare),
    ),
  );

  const primary = sortedPersonalized.slice(
    0,
    primaryCount,
  );

  /*
   * Reserve representation for independent interest clusters.
   * Without this, a dominant taste can occupy the entire
   * enrichment pool before smaller interests are evaluated.
   */
  const clusterRepresentatives = new Map<
    string,
    PreliminaryCandidate
  >();

  for (const candidate of sortedPersonalized) {
    for (const clusterSource of candidate.clusterSources) {
      if (!clusterRepresentatives.has(clusterSource)) {
        clusterRepresentatives.set(
          clusterSource,
          candidate,
        );
      }
    }
  }

  const selectedKeys = new Set(
    primary.map(
      (candidate) =>
        `${candidate.item.mediaType}:${candidate.item.id}`,
    ),
  );

  const representatives = [...clusterRepresentatives.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  for (const representative of representatives) {
    const key = `${representative.item.mediaType}:${representative.item.id}`;

    if (selectedKeys.has(key)) {
      continue;
    }

    if (primary.length >= primaryCount) {
      const removed = primary.pop();

      if (removed) {
        selectedKeys.delete(
          `${removed.item.mediaType}:${removed.item.id}`,
        );
      }
    }

    primary.push(representative);
    selectedKeys.add(key);
  }

  const exploration = sortedPersonalized
    .filter(
      (candidate) =>
        !selectedKeys.has(
          `${candidate.item.mediaType}:${candidate.item.id}`,
        ),
    )
    .sort(
      (a, b) =>
        b.explorationScore - a.explorationScore,
    )
    .slice(
      0,
      MAX_ENRICHED_CANDIDATES - primary.length,
    );

  return [...primary, ...exploration];
}

/* =========================================================
   MAIN RECOMMENDATION PIPELINE
   ========================================================= */

export async function getGorseInspiredRecommendations(
  mediaType: ContentType,
  limit = 12,
  tasteProfile: TasteProfile | null = null,
): Promise<RecommendationItem[]> {
  const safeLimit = Math.max(
    1,
    Math.min(30, Math.floor(limit)),
  );

  const cacheKey = [
    mediaType,
    safeLimit,
    tasteFingerprint(tasteProfile),
    activityFingerprint(),
  ].join("|");

  pruneRecommendationCache();

  const cached = recommendationCache.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return [...cached.items];
  }

  const seeds = getHistorySeeds(mediaType);
  const negativeSeeds = getNegativeHistorySeeds(mediaType);
  const trainingSignals = getTrainingSignals();

  /*
   * First enrich the profile's own history.
   * This allows discovery to use the profile's actual
   * metadata preferences before selecting candidates.
   */
  const [
    seedDetails,
    negativeSeedDetails,
    trainingDetails,
  ] = await Promise.all([
    mapWithConcurrency(
      seeds,
      DETAIL_CONCURRENCY,
      (seed) =>
        fetchDetailedItem(seed.id, mediaType),
    ),
    mapWithConcurrency(
      negativeSeeds,
      DETAIL_CONCURRENCY,
      (seed) =>
        fetchDetailedItem(seed.id, mediaType),
    ),
    mapWithConcurrency(
      trainingSignals,
      DETAIL_CONCURRENCY,
      (signal) =>
        fetchDetailedItem(
          signal.id,
          signal.mediaType,
        ),
    ),
  ]);

  const validSeedDetails = seedDetails.filter(
    (item): item is DetailedFeatureItem =>
      item !== null,
  );

  const validNegativeDetails = negativeSeedDetails.filter(
    (item): item is DetailedFeatureItem =>
      item !== null,
  );

  const validTrainingDetails = trainingDetails
    .map((item, index) => {
      const signal = trainingSignals[index];

      if (!item || !signal) return null;

      return {
        item,
        signal,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        item: DetailedFeatureItem;
        signal: TrainingSignal;
      } => entry !== null,
    );

  const temporalTrainingSignals =
    applyTemporalInterestWeights(
      validTrainingDetails.map(({ signal }) => signal),
    );

  const temporalSignalById = new Map(
    temporalTrainingSignals.map((signal) => [
      `${signal.mediaType}:${signal.id}`,
      signal,
    ]),
  );

  const temporallyWeightedTrainingDetails =
    validTrainingDetails.map(({ item, signal }) => ({
      item,
      signal:
        temporalSignalById.get(
          `${signal.mediaType}:${signal.id}`,
        ) ?? signal,
    }));

  const positiveSeeds = temporallyWeightedTrainingDetails
    .filter(
      ({ signal }) =>
        signal.label >= 0.55 &&
        signal.weight >= 0.2,
    )
    .map(({ item, signal }) => ({
      item,
      weight: signal.weight,
      timestamp: signal.timestamp,
    }));

  const negativeSynopsisSeeds: SynopsisSeed[] =
    validTrainingDetails
      .filter(
        ({ signal }) =>
          signal.label <= 0.25 &&
          signal.weight >= 0.2,
      )
      .map(({ item, signal }) => ({
        item,
        weight: signal.weight,
        timestamp: signal.timestamp,
      }));

  const positiveSynopsisSeeds: SynopsisSeed[] =
    positiveSeeds.map((seed) => ({
      item: seed.item,
      weight: seed.weight,
      timestamp: seed.timestamp,
    }));

  const clusterSeedMap = new Map<
    string,
    InterestDiscoverySeed
  >();

  for (const seed of positiveSeeds) {
    const key =
      `${seed.item.mediaType}:${seed.item.id}`;

    const existing = clusterSeedMap.get(key);

    if (!existing || seed.weight > existing.weight) {
      clusterSeedMap.set(key, {
        item: seed.item,
        weight: seed.weight,
        timestamp: seed.timestamp,
      });
    }
  }

  const interestTargets = [
    ...buildInterestDiscoveryTargets(
      [...clusterSeedMap.values()],
      mediaType,
    ),

    ...buildEmergingInterestTargets(
      validTrainingDetails
        .filter(
          ({ signal }) =>
            signal.label >= 0.58 &&
            signal.weight >= 0.2,
        )
        .map(({ item, signal }) => ({
          item,
          weight: signal.weight,
          timestamp: signal.timestamp,
        })),
      mediaType,
    ),
  ];

  const clusterRequests =
    buildInterestClusterSourceRequests(
      mediaType,
      interestTargets,
    );

  const personalizedRequests =
    await buildPersonalizedSourceRequests(
      mediaType,
      validTrainingDetails.map((entry) => entry.item),
      validTrainingDetails.map((entry) => entry.signal),
      tasteProfile,
    );

  const sourceRequests: SourceRequest[] = [
    {
      name: "trending",
      weight: 7,
      run: () =>
        fetchCollection(
          `/trending/${mediaType}/week`,
          mediaType,
        ),
    },
    {
      name: "popular",
      weight: 4,
      run: () =>
        fetchCollection(
          `/${mediaType}/popular`,
          mediaType,
        ),
    },
    {
      name: "top-rated",
      weight: 5,
      run: () =>
        fetchCollection(
          `/${mediaType}/top_rated`,
          mediaType,
        ),
    },
    ...personalizedRequests,
    ...clusterRequests,
  ];

  const sourceResults = await Promise.all(
    sourceRequests.map(async (source) => {
      try {
        return {
          name: source.name,
          weight: source.weight,
          items: await source.run(),
        };
      } catch {
        return {
          name: source.name,
          weight: source.weight,
          items: [],
        };
      }
    }),
  );

  const candidates = new Map<string, CandidateRecord>();

  for (const source of sourceResults) {
    source.items.forEach((item, index) => {
      const isTasteSource =
        source.name === "imported-taste";

      const sourceWeight = isTasteSource
        ? Math.max(3, 13 - index * 0.65)
        : source.weight;

      addCandidate(
        candidates,
        item,
        source.name,
        sourceWeight,
      );
    });
  }

  const excluded = getExcludedIds();
  const activitySummary = getBehavioralSummary();

  const genrePreferenceMap =
    await getGenrePreferenceMap(
      mediaType,
      validTrainingDetails.map((entry) => entry.item),
      validTrainingDetails.map((entry) => entry.signal),
      tasteProfile,
    );

  const preliminary: PreliminaryCandidate[] = [];

  for (const candidate of candidates.values()) {
    const item = candidate.item;
    const key = `${item.mediaType}:${item.id}`;

    if (excluded.has(key)) {
      continue;
    }

    const sourceAgreement =
      Math.max(0, candidate.sources.size - 1) * 1.5;

    const mediaPreferenceBoost =
      activitySummary.preferredMediaType === mediaType
        ? 2
        : 0;

    const genreAffinity = getGenreAffinityScore(
      item,
      genrePreferenceMap,
    );

    const quality = qualityScore(item);

    const personalizedScore =
      quality * 0.55 +
      candidate.sourceScore +
      sourceAgreement +
      mediaPreferenceBoost +
      genreAffinity * 18;

    /*
     * Exploration intentionally gives some room to
     * quality titles outside the strongest known genres.
     * It does not reward titles with negative genre affinity.
     */
    const explorationScore =
      quality * 0.45 +
      candidate.sourceScore * 0.45 +
      (candidate.sources.size === 1 ? 2 : 0) +
      (genreAffinity < 0.2 ? 1.5 : 0) -
      Math.max(0, -genreAffinity) * 8;

    preliminary.push({
      item,
      score: personalizedScore,
      explorationScore,
      clusterSources: [...candidate.sources].filter(
        (source) =>
          source.startsWith("interest-cluster-"),
      ),
    });
  }

  const explorationProfile =
    buildAdaptiveExplorationProfile(validTrainingDetails);

  const candidatesToEnrich =
    selectCandidatesForEnrichment(
      preliminary,
      explorationProfile.enrichmentExplorationShare,
    );

  /*
   * Only the selected pool receives expensive metadata
   * enrichment. Selection is now influenced by profile taste.
   */
  const candidateDetails = await mapWithConcurrency(
    candidatesToEnrich,
    DETAIL_CONCURRENCY,
    (candidate) =>
      fetchDetailedItem(
        candidate.item.id,
        candidate.item.mediaType,
      ),
  );

  const enrichedCandidates = candidateDetails.filter(
    (item): item is DetailedFeatureItem =>
      item !== null,
  );

  const enrichedCandidateKeys = new Set(
    enrichedCandidates.map(
      (item) => `${item.mediaType}:${item.id}`,
    ),
  );

  const featureSeeds: FeatureVectorSeed[] =
    positiveSeeds.map((seed) => ({
      item: seed.item,
      weight: seed.weight,
      timestamp: seed.timestamp,
    }));

  const negativeFeatureSeeds: FeatureVectorSeed[] =
    negativeSynopsisSeeds.map((seed) => ({
      item: seed.item,
      weight: seed.weight,
      timestamp: seed.timestamp,
    }));

  const contentSimilarity = getFeatureSimilarityScores(
    enrichedCandidates,
    featureSeeds,
    negativeFeatureSeeds,
  );

  const synopsisSimilarity = getSynopsisSimilarityScores(
    enrichedCandidates,
    positiveSynopsisSeeds,
    negativeSynopsisSeeds,
  );

  const trainingExamples: LearnedTrainingExample[] =
    validTrainingDetails.map(({ item, signal }) => ({
      item,
      label: signal.label,
      weight: signal.weight,
      timestamp: signal.timestamp,
    }));

  const learnedScores = getLearnedRankingScores(
    enrichedCandidates,
    trainingExamples,
  );

  /*
   * If enough candidates were enriched, rank that pool.
   * If TMDB failed to enrich enough items, retain the
   * remaining candidates as a lower-confidence fallback.
   */
  const rankingPool =
    enrichedCandidateKeys.size >= safeLimit
      ? preliminary.filter((candidate) =>
          enrichedCandidateKeys.has(
            `${candidate.item.mediaType}:${candidate.item.id}`,
          ),
        )
      : preliminary;

  const ranked: RankedCandidate[] = rankingPool.map(
    ({
      item,
      score,
      explorationScore,
      clusterSources,
    }) => {
      const key = `${item.mediaType}:${item.id}`;

      const isEnriched =
        enrichedCandidateKeys.has(key);

      const similarity =
        contentSimilarity.get(key) ?? 0;

      const synopsisScore =
        synopsisSimilarity.get(key) ?? 0;

      const learnedProbability =
        learnedScores.get(key);

      const learnedBoost =
        learnedProbability === undefined
          ? 0
          : (learnedProbability - 0.5) * 28;

      const enrichmentPenalty =
        isEnriched ? 0 : 14;

      const calibratedBaseScore =
        score * (1 - explorationProfile.rankingBlend) +
        explorationScore * explorationProfile.rankingBlend;

      return {
        ...item,
        _score:
          calibratedBaseScore +
          similarity * 20 +
          synopsisScore * 22 +
          learnedBoost -
          enrichmentPenalty,
        _clusterSources: clusterSources,
      };
    },
  );

  ranked.sort((a, b) => b._score - a._score);

  const clusterStrengths = new Map(
    interestTargets.map((target) => [
      `interest-cluster-${target.id}`,
      clamp(target.strength, 0, 1),
    ]),
  );

  const recommendations = diversify(
    ranked,
    safeLimit,
    clusterStrengths,
  );

  if (recommendations.length > 0) {
    recommendationCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL,
      items: recommendations,
    });
  }

  return recommendations;
}

function getGenreAffinityScore(
  item: RecommendationItem,
  preferences: Map<number, number>,
): number {
  if (
    !item.genre_ids ||
    item.genre_ids.length === 0 ||
    preferences.size === 0
  ) {
    return 0;
  }

  let total = 0;
  let count = 0;

  for (const genreId of item.genre_ids) {
    const preference = preferences.get(genreId);

    if (preference === undefined) continue;

    total += preference;
    count += 1;
  }

  return count > 0
    ? total / count
    : 0;
}

function diversify(
  candidates: RankedCandidate[],
  limit: number,
  clusterStrengths: Map<string, number>,
): RecommendationItem[] {
  const selected: RankedCandidate[] = [];
  const selectedKeys = new Set<string>();
  const genreCounts = new Map<number, number>();
  const clusterCounts = new Map<string, number>();

  const remaining = [...candidates];

  while (
    selected.length < limit &&
    remaining.length > 0
  ) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];

      const key =
        `${candidate.mediaType}:${candidate.id}`;

      if (selectedKeys.has(key)) continue;

      let penalty = 0;

      for (const genreId of candidate.genre_ids ?? []) {
        const count = genreCounts.get(genreId) ?? 0;

        if (count >= 3) {
          penalty += 3.5;
        } else if (count >= 2) {
          penalty += 1.5;
        }
      }

      let clusterBoost = 0;

      for (const cluster of candidate._clusterSources) {
        const count = clusterCounts.get(cluster) ?? 0;
        const strength = clusterStrengths.get(cluster) ?? 0.5;

        if (count === 0) {
          clusterBoost += strength * 2.5;
        } else if (count === 1) {
          clusterBoost += strength * 0.7;
        } else {
          penalty += count * 1.2;
        }
      }

      const adjustedScore =
        candidate._score +
        clusterBoost -
        penalty;

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIndex = index;
      }
    }

    if (bestIndex < 0) break;

    const [chosen] = remaining.splice(bestIndex, 1);

    if (!chosen) break;

    selected.push(chosen);

    selectedKeys.add(
      `${chosen.mediaType}:${chosen.id}`,
    );

    for (const genreId of chosen.genre_ids ?? []) {
      genreCounts.set(
        genreId,
        (genreCounts.get(genreId) ?? 0) + 1,
      );
    }

    for (const cluster of chosen._clusterSources) {
      clusterCounts.set(
        cluster,
        (clusterCounts.get(cluster) ?? 0) + 1,
      );
    }
  }

  return selected.map(
    ({ _score, _clusterSources, ...item }) => item,
  );
}
