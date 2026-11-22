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
  getPersonalizedRecommendations,
  type RecommendationItem,
} from "@/utils/personalization/recommendation-engine";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const REQUEST_TIMEOUT = 6500;
const CACHE_TTL = 3 * 60 * 1000;
const MAX_CACHE_ENTRIES = 16;

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

const recommendationCache = new Map<
  string,
  CachedRecommendations
>();

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

/**
 * A movie or show becomes a recommendation seed when the active
 * profile has meaningfully watched it.
 *
 * A short opening alone is not treated as a strong preference.
 * Completed titles and substantial viewing progress carry more weight.
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

    if (recentById.size >= 12) {
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
      progress >= 0.25 ||
      signal >= 1.5;

    if (!meaningful) {
      continue;
    }

    // A strong abandonment signal should not become a positive seed.
    if (signal < -0.5 && !entry.completed) {
      continue;
    }

    const score = clamp(
      4 +
        progress * 5 +
        (entry.completed ? 3 : 0) +
        Math.max(0, signal) * 0.35,
      2,
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
    .slice(0, 3);
}

/**
 * Exclude items already present in this profile's watch history
 * or watchlist.
 *
 * The stored structures use `type` and `media_id` / `id`.
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

  // Count each source only once per candidate.
  if (!existing.sources.has(source)) {
    existing.sources.add(source);
    existing.sourceScore += weight;
  }

  // Retain the richest version of the item when sources differ.
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

  const ratingScore = rating * 1.3;

  // Logarithmic weighting prevents huge vote counts from dominating.
  const voteConfidence =
    Math.log10(voteCount + 1) * 1.25;

  const popularityScore =
    Math.log10(popularity + 1) * 1.1;

  return (
    ratingScore +
    voteConfidence +
    popularityScore
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

function pruneCache(): void {
  const now = Date.now();

  for (const [key, value] of recommendationCache) {
    if (value.expiresAt <= now) {
      recommendationCache.delete(key);
    }
  }

  while (recommendationCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey =
      recommendationCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    recommendationCache.delete(oldestKey);
  }
}

/**
 * Gorse-inspired local recommendation pipeline:
 *
 * 1. Retrieve candidates from independent sources.
 * 2. Merge candidates by media identity.
 * 3. Rank using source agreement, catalogue quality and optional taste.
 * 4. Diversify the final list.
 *
 * A profile import is optional. Without one, the system still uses
 * trending, popular, top-rated and behaviour-based similar titles.
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

  pruneCache();

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

  // Similarity retrieval is only possible once the profile has
  // meaningful viewing history.
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

  // Imported taste is an additional source, never an activation gate.
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

      const tastePositionWeight = isTasteSource
        ? Math.max(3, 13 - index * 0.65)
        : source.weight;

      addCandidate(
        candidates,
        item,
        source.name,
        tastePositionWeight,
      );
    });
  }

  const excluded = getExcludedIds();
  const activitySummary = getBehavioralSummary();

  const ranked: RankedCandidate[] = [];

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

    const score =
      qualityScore(item) +
      candidate.sourceScore +
      sourceAgreement +
      mediaPreferenceBoost;

    ranked.push({
      ...item,
      _score: score,
    });
  }

  ranked.sort((a, b) => b._score - a._score);

  const recommendations = diversify(
    ranked,
    safeLimit,
  );

  // Do not cache an empty result. A temporary API failure should
  // be allowed to retry on the next visit.
  if (recommendations.length > 0) {
    recommendationCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL,
      items: recommendations,
    });

    pruneCache();
  }

  return recommendations;
}

export function clearGorseInspiredRecommendationCache(): void {
  recommendationCache.clear();
  }
