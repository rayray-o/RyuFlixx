"use client";

import { env } from "@/utils/env";
import type { ContentType } from "@/types";
import {
  getLocalWatchlist,
  getWatchHistory,
} from "@/utils/localStorage";
import {
  getBehavioralSignal,
  getBehavioralSummary,
} from "@/utils/personalization/behavioral-memory";
import {
  getFeatureSimilarityScores,
  type FeatureVectorItem,
  type FeatureVectorSeed,
} from "@/utils/personalization/feature-vector-engine";
import {
  getPersonalizedRecommendations,
  type RecommendationItem,
} from "@/utils/personalization/recommendation-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const REQUEST_TIMEOUT = 6500;
const CACHE_TTL = 3 * 60 * 1000;
const DETAIL_CACHE_TTL = 12 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 16;
const MAX_DETAIL_CACHE_ENTRIES = 300;
const MAX_ENRICHED_CANDIDATES = 32;
const MAX_HISTORY_SEEDS = 5;
const DETAIL_CONCURRENCY = 4;

type DiscoverResponse = {
  results?: Array<Record<string, unknown>>;
};

type HistorySeed = {
  id: number;
  score: number;
  updatedAt: string;
};

type CandidateRecord = {
  item: RecommendationItem;
  sourceScore: number;
  sources: Set<string>;
};

type RankedCandidate = RecommendationItem & {
  _score: number;
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

type DetailedFeatureItem = FeatureVectorItem;

const recommendationCache = new Map<
  string,
  CachedRecommendations
>();

const detailCache = new Map<string, CachedDetails>();

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asObjects(value: unknown): Record<string, unknown>[] {
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
          accept: "application/json",
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

async function fetchCollection(
  path: string,
  mediaType: ContentType,
): Promise<RecommendationItem[]> {
  const response = await tmdb<DiscoverResponse>(path);

  if (!response?.results) {
    return [];
  }

  return response.results
    .map((item) => normalizeItem(item, mediaType))
    .filter(
      (item): item is RecommendationItem =>
        item !== null,
    );
}

function getNamedValues(
  value: unknown,
  property = "name",
): string[] {
  return asObjects(value)
    .map((item) => string(item[property]).trim())
    .filter(Boolean);
}

function getKeywordValues(
  value: unknown,
): string[] {
  const object = asObject(value);

  if (!object) {
    return [];
  }

  return getNamedValues(
    object.keywords ?? object.results,
  );
}

function getCountryValues(
  raw: Record<string, unknown>,
  mediaType: ContentType,
): string[] {
  if (mediaType === "tv") {
    return Array.isArray(raw.origin_country)
      ? raw.origin_country.filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
      : [];
  }

  return getNamedValues(raw.production_countries);
}

function buildDetailedFeatureItem(
  raw: Record<string, unknown>,
  mediaType: ContentType,
  id: number,
): DetailedFeatureItem {
  const credits = asObject(raw.credits);
  const cast = asObjects(credits?.cast);
  const crew = asObjects(credits?.crew);

  const directors = crew
    .filter(
      (person) =>
        string(person.job).toLowerCase() === "director",
    )
    .map((person) => string(person.name))
    .filter(Boolean);

  if (mediaType === "tv") {
    directors.push(
      ...getNamedValues(raw.created_by),
    );
  }

  const languages = asObjects(raw.spoken_languages)
    .map((language) => string(language.iso_639_1))
    .filter(Boolean);

  const releaseDate =
    mediaType === "movie"
      ? string(raw.release_date)
      : string(raw.first_air_date);

  return {
    id,
    mediaType,
    genres: getNamedValues(raw.genres),
    keywords: getKeywordValues(raw.keywords),
    directors: [...new Set(directors)],
    cast: cast
      .slice(0, 12)
      .map((person) => string(person.name))
      .filter(Boolean),
    languages,
    countries: getCountryValues(raw, mediaType),
    releaseDate: releaseDate || undefined,
  };
}

function pruneDetailCache(): void {
  const now = Date.now();

  for (const [key, value] of detailCache) {
    if (value.expiresAt <= now) {
      detailCache.delete(key);
    }
  }

  while (detailCache.size > MAX_DETAIL_CACHE_ENTRIES) {
    const oldestKey = detailCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    detailCache.delete(oldestKey);
  }
}

async function fetchDetailedItem(
  id: number,
  mediaType: ContentType,
): Promise<DetailedFeatureItem | null> {
  const key = `${mediaType}:${id}`;

  pruneDetailCache();

  const cached = detailCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.item;
  }

  const response = await tmdb<Record<string, unknown>>(
    `/${mediaType}/${id}?append_to_response=credits,keywords`,
  );

  if (!response) {
    return null;
  }

  const item = buildDetailedFeatureItem(
    response,
    mediaType,
    id,
  );

  detailCache.set(key, {
    expiresAt: Date.now() + DETAIL_CACHE_TTL,
    item,
  });

  pruneDetailCache();

  return item;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(
    Math.max(1, concurrency),
    items.length,
  );

  const workers = Array.from(
    { length: workerCount },
    async () => {
      while (true) {
        const index = nextIndex++;

        if (index >= items.length) {
          return;
        }

        results[index] = await mapper(
          items[index],
          index,
        );
      }
    },
  );

  await Promise.all(workers);

  return results;
}

/**
 * A title becomes a positive recommendation seed when the active
 * profile has meaningfully watched it.
 */
function getHistorySeeds(
  mediaType: ContentType,
): HistorySeed[] {
  const history = getWatchHistory();

  const recentById = new Map<
    number,
    (typeof history)[number]
  >();

  for (const entry of history) {
    if (entry.type !== mediaType) {
      continue;
    }

    if (!recentById.has(entry.media_id)) {
      recentById.set(entry.media_id, entry);
    }

    if (recentById.size >= 16) {
      break;
    }
  }

  const seeds: HistorySeed[] = [];

  for (const entry of recentById.values()) {
    const progress =
      entry.duration > 0
        ? clamp(
            entry.last_position / entry.duration,
            0,
            1,
          )
        : 0;

    const signal = getBehavioralSignal(
      entry.media_id,
      mediaType,
    );

    const meaningful =
      entry.completed ||
      progress >= 0.2 ||
      signal >= 1.5;

    if (!meaningful) {
      continue;
    }

    // A strong abandonment signal should not become a positive seed.
    if (signal < -0.5 && !entry.completed) {
      continue;
    }

    const score = clamp(
      2 +
        progress * 6 +
        (entry.completed ? 3 : 0) +
        Math.max(0, signal) * 0.3,
      1,
      12,
    );

    seeds.push({
      id: entry.media_id,
      score,
      updatedAt: entry.updated_at,
    });
  }

  return seeds
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
      );
    })
    .slice(0, MAX_HISTORY_SEEDS);
}

/**
 * Exclude items already present in this profile's watch history
 * or watchlist.
 */
function getExcludedIds(): Set<string> {
  const excluded = new Set<string>();

  for (const entry of getWatchHistory()) {
    if (
      entry &&
      (entry.type === "movie" || entry.type === "tv") &&
      Number.isFinite(entry.media_id)
    ) {
      excluded.add(
        `${entry.type}:${entry.media_id}`,
      );
    }
  }

  for (const entry of getLocalWatchlist()) {
    if (
      entry &&
      (entry.type === "movie" || entry.type === "tv") &&
      Number.isFinite(entry.id)
    ) {
      excluded.add(
        `${entry.type}:${entry.id}`,
      );
    }
  }

  return excluded;
}

function tasteFingerprint(
  profile: TasteProfile | null,
): string {
  if (!profile) {
    return "no-imported-taste";
  }

  return JSON.stringify({
    confidence: profile.confidence,
    genres: profile.topGenres,
    keywords: profile.topKeywords,
    directors: profile.topDirectors,
    actors: profile.topActors,
    preferredMediaType:
      profile.summary?.preferredMediaType,
    preferredEra: profile.summary?.preferredEra,
  });
}

function activityFingerprint(): string {
  const history = getWatchHistory()
    .slice(0, 20)
    .map((entry) => [
      entry.type,
      entry.media_id,
      entry.updated_at,
      entry.completed ? 1 : 0,
    ].join(":"));

  const watchlist = getLocalWatchlist()
    .map((entry) => `${entry.type}:${entry.id}`)
    .sort();

  return JSON.stringify({
    history,
    watchlist,
  });
}

function addCandidate(
  candidates: Map<string, CandidateRecord>,
  item: RecommendationItem,
  source: string,
  weight: number,
): void {
  const key = `${item.mediaType}:${item.id}`;
  const existing = candidates.get(key);

  if (!existing) {
    candidates.set(key, {
      item,
      sourceScore: weight,
      sources: new Set([source]),
    });

    return;
  }

  if (!existing.sources.has(source)) {
    existing.sources.add(source);
    existing.sourceScore += weight;
  }

  // Retain the richest version when sources differ.
  if (
    (!existing.item.overview && item.overview) ||
    (!existing.item.poster_path && item.poster_path) ||
    (!existing.item.genre_ids?.length && item.genre_ids?.length)
  ) {
    existing.item = {
      ...existing.item,
      ...item,
    };
  }
}

function qualityScore(
  item: RecommendationItem,
): number {
  const rating = clamp(
    number(item.vote_average),
    0,
    10,
  );

  const voteCount = Math.max(
    0,
    number(item.vote_count),
  );

  const popularity = Math.max(
    0,
    number(item.popularity),
  );

  return (
    rating * 1.3 +
    Math.log10(voteCount + 1) * 1.25 +
    Math.log10(popularity + 1) * 1.1
  );
}

function diversify(
  candidates: RankedCandidate[],
  limit: number,
): RecommendationItem[] {
  const remaining = [...candidates];
  const selected: RankedCandidate[] = [];
  const genreCounts = new Map<number, number>();

  while (
    selected.length < limit &&
    remaining.length > 0
  ) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      let adjustedScore = candidate._score;

      for (const genreId of candidate.genre_ids ?? []) {
        const count = genreCounts.get(genreId) ?? 0;

        if (count >= 3) {
          adjustedScore -= 9;
        } else if (count >= 2) {
          adjustedScore -= 3;
        }
      }

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIndex = index;
      }
    }

    const chosen = remaining.splice(bestIndex, 1)[0];

    if (!chosen) {
      break;
    }

    selected.push(chosen);

    for (const genreId of chosen.genre_ids ?? []) {
      genreCounts.set(
        genreId,
        (genreCounts.get(genreId) ?? 0) + 1,
      );
    }
  }

  return selected.map(
    ({ _score: _ignored, ...item }) => item,
  );
}

function pruneRecommendationCache(): void {
  const now = Date.now();

  for (const [key, value] of recommendationCache) {
    if (value.expiresAt <= now) {
      recommendationCache.delete(key);
    }
  }

  while (recommendationCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = recommendationCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    recommendationCache.delete(oldestKey);
  }
}

/**
 * Local multi-source recommendation pipeline:
 *
 * 1. Retrieve candidates from independent sources.
 * 2. Merge candidates by media identity.
 * 3. Build sparse metadata feature vectors.
 * 4. Weight rare features using inverse document frequency.
 * 5. Compare candidates with the user's weighted feature vector
 *    and individual watched titles.
 * 6. Rank and diversify the final list.
 *
 * Imported taste is optional. Viewing history can build the
 * recommendation profile automatically.
 */
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

  if (cached && cached.expiresAt > Date.now()) {
    return [...cached.items];
  }

  const seeds = getHistorySeeds(mediaType);

  const requests: SourceRequest[] = [
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
  ];

  for (const seed of seeds) {
    requests.push({
      name: `similar-to-${seed.id}`,
      weight: 8 + seed.score * 0.45,
      run: () =>
        fetchCollection(
          `/${mediaType}/${seed.id}/recommendations`,
          mediaType,
        ),
    });
  }

  if (tasteProfile) {
    requests.push({
      name: "imported-taste",
      weight: 0,
      run: () =>
        getPersonalizedRecommendations(
          tasteProfile,
          mediaType,
          16,
        ),
    });
  }

  const sourceResults = await Promise.all(
    requests.map(async (request) => {
      try {
        return {
          name: request.name,
          weight: request.weight,
          items: await request.run(),
        };
      } catch {
        return {
          name: request.name,
          weight: request.weight,
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

  const preliminary: Array<{
    item: RecommendationItem;
    score: number;
  }> = [];

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

    preliminary.push({
      item,
      score:
        qualityScore(item) +
        candidate.sourceScore +
        sourceAgreement +
        mediaPreferenceBoost,
    });
  }

  preliminary.sort((a, b) => b.score - a.score);

  // Enrich only the strongest preliminary candidates.
  const candidatesToEnrich = preliminary.slice(
    0,
    MAX_ENRICHED_CANDIDATES,
  );

  const [candidateDetails, seedDetails] = await Promise.all([
    mapWithConcurrency(
      candidatesToEnrich,
      DETAIL_CONCURRENCY,
      (candidate) =>
        fetchDetailedItem(
          candidate.item.id,
          candidate.item.mediaType,
        ),
    ),
    mapWithConcurrency(
      seeds,
      DETAIL_CONCURRENCY,
      (seed) =>
        fetchDetailedItem(
          seed.id,
          mediaType,
        ),
    ),
  ]);

  const enrichedCandidates = candidateDetails.filter(
    (item): item is DetailedFeatureItem =>
      item !== null,
  );

  const enrichedSeeds: FeatureVectorSeed[] = [];

  seedDetails.forEach((item, index) => {
    if (!item) return;

    enrichedSeeds.push({
      item,
      weight: seeds[index]?.score ?? 1,
    });
  });

  const contentSimilarity = getFeatureSimilarityScores(
    enrichedCandidates,
    enrichedSeeds,
    tasteProfile,
  );

  const ranked: RankedCandidate[] = preliminary.map(
    ({ item, score }) => {
      const similarity =
        contentSimilarity.get(
          `${item.mediaType}:${item.id}`,
        ) ?? 0;

      // Content similarity is a ranking signal, not the only signal.
      return {
        ...item,
        _score: score + similarity * 18,
      };
    },
  );

  ranked.sort((a, b) => b._score - a._score);

  const recommendations = diversify(
    ranked,
    safeLimit,
  );

  if (recommendations.length > 0) {
    recommendationCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL,
      items: recommendations,
    });

    pruneRecommendationCache();
  }

  return recommendations;
}

export function clearGorseInspiredRecommendationCache(): void {
  recommendationCache.clear();
  detailCache.clear();
    }
