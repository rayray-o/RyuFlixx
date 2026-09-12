"use client";

import { env } from "@/utils/env";
import {
  getLocalWatchlist,
  getWatchHistory,
} from "@/utils/localStorage";
import type { ContentType } from "@/types";
import type { TasteProfile } from "@/utils/personalization/taste-engine";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const REQUEST_TIMEOUT = 6500;

const MOVIE_GENRES: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  "Science Fiction": 878,
  Thriller: 53,
  War: 10752,
  Western: 37,
};

const TV_GENRES: Record<string, number> = {
  Action: 10759,
  Adventure: 10759,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 10765,
  History: 36,
  Horror: 9648,
  Music: 10463,
  Mystery: 9648,
  Romance: 18,
  "Science Fiction": 10765,
  Thriller: 9648,
  War: 10768,
  Western: 37,
};

export interface RecommendationItem {
  id: number;
  mediaType: ContentType;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  overview?: string;
  original_language?: string;
}

interface Candidate extends RecommendationItem {
  _score?: number;
}

interface DetailedCandidate extends Candidate {
  genres?: Array<{
    id: number;
    name: string;
  }>;
  keywords?: {
    keywords?: Array<{
      id: number;
      name: string;
    }>;
    results?: Array<{
      id: number;
      name: string;
    }>;
  };
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
    }>;
    crew?: Array<{
      id: number;
      name: string;
      job?: string;
      department?: string;
    }>;
  };
}

interface DiscoverResponse {
  results?: Array<Record<string, unknown>>;
}

interface ProfileSignal {
  name?: string;
  score?: number;
  id?: number;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function timeoutFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  return fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`,
      accept: "application/json",
      ...(options?.headers ?? {}),
    },
  }).finally(() => {
    window.clearTimeout(timeout);
  });
}

async function tmdb<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T | null> {
  try {
    const searchParams = new URLSearchParams();

    Object.entries(params ?? {}).forEach(
      ([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          String(value).length > 0
        ) {
          searchParams.set(key, String(value));
        }
      },
    );

    const query = searchParams.toString();

    const response = await timeoutFetch(
      `${TMDB_BASE_URL}${path}${query ? `?${query}` : ""}`,
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function profileSignals(
  values: unknown,
): ProfileSignal[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (!value || typeof value !== "object") {
        return null;
      }

      const item =
        value as Record<string, unknown>;

      return {
        name: string(item.name),
        score: number(item.score),
        id: number(item.id),
      };
    })
    .filter(
      (value): value is ProfileSignal =>
        Boolean(value?.name),
    );
}

function getGenreId(
  name: string,
  type: ContentType,
): number | null {
  const normalized = normalizeName(name);

  const map =
    type === "movie"
      ? MOVIE_GENRES
      : TV_GENRES;

  for (const [genreName, id] of Object.entries(
    map,
  )) {
    if (
      normalizeName(genreName) ===
      normalized
    ) {
      return id;
    }
  }

  return null;
}

function getPreferredGenreIds(
  profile: TasteProfile,
  type: ContentType,
): number[] {
  const signals = profileSignals(
    profile.topGenres,
  );

  return signals
    .sort(
      (a, b) =>
        number(b.score) -
        number(a.score),
    )
    .map((signal) =>
      signal.id && signal.id > 0
        ? signal.id
        : getGenreId(
            signal.name ?? "",
            type,
          ),
    )
    .filter(
      (id): id is number =>
        typeof id === "number" &&
        id > 0,
    )
    .slice(0, 5);
}

function getPositiveNames(
  profile: TasteProfile,
  key:
    | "topGenres"
    | "topKeywords"
    | "topDirectors"
    | "topActors",
): Set<string> {
  return new Set(
    profileSignals(profile[key])
      .filter(
        (signal) =>
          number(signal.score) > 0,
      )
      .map((signal) =>
        normalizeName(
          signal.name ?? "",
        ),
      ),
  );
}

function getNegativeNames(
  profile: TasteProfile,
  key:
    | "topGenres"
    | "topKeywords"
    | "topDirectors"
    | "topActors",
): Set<string> {
  return new Set(
    profileSignals(profile[key])
      .filter(
        (signal) =>
          number(signal.score) < 0,
      )
      .map((signal) =>
        normalizeName(
          signal.name ?? "",
        ),
      ),
  );
}

function normalizeCandidate(
  raw: Record<string, unknown>,
  type: ContentType,
): RecommendationItem | null {
  const id = number(raw.id);

  if (!id) {
    return null;
  }

  return {
    id,
    mediaType: type,
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
    vote_average: number(
      raw.vote_average,
    ),
    vote_count: number(
      raw.vote_count,
    ),
    popularity: number(
      raw.popularity,
    ),
    release_date:
      typeof raw.release_date === "string"
        ? raw.release_date
        : undefined,
    first_air_date:
      typeof raw.first_air_date === "string"
        ? raw.first_air_date
        : undefined,
    genre_ids: Array.isArray(
      raw.genre_ids,
    )
      ? raw.genre_ids.filter(
          (id): id is number =>
            typeof id === "number",
        )
      : [],
    overview:
      typeof raw.overview === "string"
        ? raw.overview
        : undefined,
    original_language:
      typeof raw.original_language ===
      "string"
        ? raw.original_language
        : undefined,
  };
}

async function discover(
  type: ContentType,
  params: Record<
    string,
    string | number | undefined
  >,
): Promise<RecommendationItem[]> {
  const response =
    await tmdb<DiscoverResponse>(
      `/discover/${type}`,
      {
        language: "en-US",
        include_adult: "false",
        page: 1,
        ...params,
      },
    );

  if (!response?.results) {
    return [];
  }

  return response.results
    .map((item) =>
      normalizeCandidate(
        item,
        type,
      ),
    )
    .filter(
      (
        item,
      ): item is RecommendationItem =>
        Boolean(item),
    );
}

function excludedIds(): Set<string> {
  const excluded =
    new Set<string>();

  try {
    const history =
      getWatchHistory();

    if (Array.isArray(history)) {
      history.forEach((entry) => {
        const item =
          entry as unknown as Record<
            string,
            unknown
          >;

        const mediaType =
          string(item.mediaType);

        const mediaId =
          number(item.mediaId);

        if (
          mediaType &&
          mediaId
        ) {
          excluded.add(
            `${mediaType}:${mediaId}`,
          );
        }
      });
    }
  } catch {
    // Local history should never break recommendations.
  }

  try {
    const watchlist =
      getLocalWatchlist();

    if (Array.isArray(watchlist)) {
      watchlist.forEach((entry) => {
        const item =
          entry as unknown as Record<
            string,
            unknown
          >;

        const mediaType =
          string(item.mediaType);

        const mediaId =
          number(
            item.mediaId ??
              item.id,
          );

        if (
          mediaType &&
          mediaId
        ) {
          excluded.add(
            `${mediaType}:${mediaId}`,
          );
        }
      });
    }
  } catch {
    // Local watchlist should never break recommendations.
  }

  return excluded;
}

function basicScore(
  item: RecommendationItem,
  profile: TasteProfile,
): number {
  let score = 0;

  const positiveGenres =
    new Set(
      getPreferredGenreIds(
        profile,
        item.mediaType,
      ),
    );

  const genreIds =
    item.genre_ids ?? [];

  for (const genreId of genreIds) {
    if (positiveGenres.has(genreId)) {
      score += 24;
    }
  }

  const voteAverage =
    number(item.vote_average);

  const voteCount =
    number(item.vote_count);

  const popularity =
    number(item.popularity);

  if (voteAverage >= 8.5) {
    score += 10;
  } else if (voteAverage >= 7.5) {
    score += 7;
  } else if (voteAverage >= 6.5) {
    score += 3;
  }

  if (voteCount > 5000) {
    score += 5;
  } else if (voteCount > 1000) {
    score += 3;
  } else if (voteCount > 250) {
    score += 1;
  }

  score += clamp(
    Math.log10(
      Math.max(1, popularity),
    ) * 2,
    0,
    8,
  );

  const preferredMediaType =
    profile.summary
      ?.preferredMediaType;

  if (
    preferredMediaType ===
    item.mediaType
  ) {
    score += 8;
  }

  return score;
}

function detailedScore(
  item: DetailedCandidate,
  profile: TasteProfile,
): number {
  let score =
    basicScore(
      item,
      profile,
    );

  const positiveGenres =
    getPositiveNames(
      profile,
      "topGenres",
    );

  const negativeGenres =
    getNegativeNames(
      profile,
      "topGenres",
    );

  const positiveKeywords =
    getPositiveNames(
      profile,
      "topKeywords",
    );

  const negativeKeywords =
    getNegativeNames(
      profile,
      "topKeywords",
    );

  const positiveDirectors =
    getPositiveNames(
      profile,
      "topDirectors",
    );

  const negativeDirectors =
    getNegativeNames(
      profile,
      "topDirectors",
    );

  const positiveActors =
    getPositiveNames(
      profile,
      "topActors",
    );

  const negativeActors =
    getNegativeNames(
      profile,
      "topActors",
    );

  for (const genre of
    item.genres ?? []) {
    const name =
      normalizeName(
        genre.name,
      );

    if (
      positiveGenres.has(name)
    ) {
      score += 18;
    }

    if (
      negativeGenres.has(name)
    ) {
      score -= 24;
    }
  }

  const keywords = [
    ...(item.keywords
      ?.keywords ?? []),
    ...(item.keywords
      ?.results ?? []),
  ];

  for (const keyword of keywords) {
    const name =
      normalizeName(
        keyword.name,
      );

    if (
      positiveKeywords.has(name)
    ) {
      score += 14;
    }

    if (
      negativeKeywords.has(name)
    ) {
      score -= 18;
    }
  }

  const directors =
    (item.credits?.crew ?? [])
      .filter(
        (person) =>
          person.job ===
            "Director" ||
          person.department ===
            "Directing",
      );

  for (const director of directors) {
    const name =
      normalizeName(
        director.name,
      );

    if (
      positiveDirectors.has(name)
    ) {
      score += 22;
    }

    if (
      negativeDirectors.has(name)
    ) {
      score -= 28;
    }
  }

  for (const actor of
    (item.credits?.cast ?? []).slice(
      0,
      10,
    )) {
    const name =
      normalizeName(
        actor.name,
      );

    if (
      positiveActors.has(name)
    ) {
      score += 8;
    }

    if (
      negativeActors.has(name)
    ) {
      score -= 10;
    }
  }

  const year = Number(
    (
      item.release_date ??
      item.first_air_date ??
      ""
    ).slice(0, 4),
  );

  const preferredEra =
    profile.summary
      ?.preferredEra;

  if (
    preferredEra &&
    year
  ) {
    const eraMatch =
      preferredEra
        .match(/\d{4}/)?.[0];

    if (eraMatch) {
      const preferredYear =
        Number(eraMatch);

      const distance =
        Math.abs(
          year -
            preferredYear,
        );

      if (distance <= 5) {
        score += 8;
      } else if (
        distance <= 10
      ) {
        score += 4;
      }
    }
  }

  return score;
}

function dedupe(
  items: RecommendationItem[],
): RecommendationItem[] {
  const seen =
    new Set<string>();

  return items.filter(
    (item) => {
      const key =
        `${item.mediaType}:${item.id}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    },
  );
}

function diversify(
  items: Candidate[],
  limit: number,
): RecommendationItem[] {
  const selected: Candidate[] = [];
  const remaining = [...items];

  const genreCounts =
    new Map<number, number>();

  while (
    selected.length < limit &&
    remaining.length > 0
  ) {
    let bestIndex = 0;
    let bestAdjusted =
      -Infinity;

    remaining.forEach(
      (candidate, index) => {
        let adjusted =
          number(
            candidate._score,
          );

        for (const genreId of
          candidate.genre_ids ?? []) {
          const count =
            genreCounts.get(
              genreId,
            ) ?? 0;

          if (count >= 3) {
            adjusted -=
              10;
          } else if (
            count >= 2
          ) {
            adjusted -=
              4;
          }
        }

        if (
          adjusted >
          bestAdjusted
        ) {
          bestAdjusted =
            adjusted;
          bestIndex = index;
        }
      },
    );

    const chosen =
      remaining.splice(
        bestIndex,
        1,
      )[0];

    if (!chosen) {
      break;
    }

    selected.push(chosen);

    for (const genreId of
      chosen.genre_ids ?? []) {
      genreCounts.set(
        genreId,
        (genreCounts.get(
          genreId,
        ) ?? 0) + 1,
      );
    }
  }

  return selected.map(
    ({
      _score: _ignored,
      ...item
    }) => item,
  );
}

async function enrich(
  candidates: RecommendationItem[],
): Promise<
  Map<string, DetailedCandidate>
> {
  const result =
    new Map<
      string,
      DetailedCandidate
    >();

  const responses =
    await Promise.allSettled(
      candidates.map(
        async (candidate) => {
          const details =
            await tmdb<
              DetailedCandidate
            >(
              `/${candidate.mediaType}/${candidate.id}`,
              {
                language:
                  "en-US",
                append_to_response:
                  "credits,keywords",
              },
            );

          if (!details) {
            return null;
          }

          return {
            ...candidate,
            ...details,
            mediaType:
              candidate.mediaType,
          };
        },
      ),
    );

  responses.forEach(
    (response, index) => {
      if (
        response.status !==
          "fulfilled" ||
        !response.value
      ) {
        return;
      }

      const candidate =
        candidates[index];

      result.set(
        `${candidate.mediaType}:${candidate.id}`,
        response.value,
      );
    },
  );

  return result;
}

function buildDiscoverQueries(
  profile: TasteProfile,
  type: ContentType,
): Array<
  Record<
    string,
    string | number | undefined
  >
> {
  const genres =
    getPreferredGenreIds(
      profile,
      type,
    );

  const queries: Array<
    Record<
      string,
      string | number | undefined
    >
  > = [];

  if (genres.length > 0) {
    queries.push({
      with_genres:
        genres
          .slice(0, 3)
          .join("|"),
      sort_by:
        "vote_average.desc",
      "vote_count.gte":
        type === "movie"
          ? 150
          : 100,
      page: 1,
    });

    queries.push({
      with_genres:
        genres
          .slice(0, 5)
          .join("|"),
      sort_by:
        "popularity.desc",
      "vote_count.gte":
        type === "movie"
          ? 100
          : 75,
      page: 1,
    });
  }

  const strongestGenre =
    genres[0];

  if (strongestGenre) {
    queries.push({
      with_genres:
        strongestGenre,
      sort_by:
        "popularity.desc",
      "vote_average.gte":
        6.5,
      page: 1,
    });
  }

  queries.push({
    sort_by:
      "vote_average.desc",
    "vote_count.gte":
      type === "movie"
        ? 1000
        : 500,
    page: 1,
  });

  return queries.slice(0, 4);
}

export async function getPersonalizedRecommendations(
  profile: TasteProfile,
  type: ContentType,
  limit = 12,
): Promise<RecommendationItem[]> {
  if (
    !profile ||
    typeof profile.confidence !==
      "number"
  ) {
    return [];
  }

  const excluded =
    excludedIds();

  const queries =
    buildDiscoverQueries(
      profile,
      type,
    );

  const personalizedResults =
    await Promise.allSettled(
      queries.map(
        (query) =>
          discover(
            type,
            query,
          ),
      ),
    );

  let candidates =
    personalizedResults.flatMap(
      (result) =>
        result.status ===
        "fulfilled"
          ? result.value
          : [],
    );

  candidates = dedupe(
    candidates,
  ).filter(
    (item) =>
      !excluded.has(
        `${item.mediaType}:${item.id}`,
      ),
  );

  /*
   * TMDB can occasionally return no personalized
   * candidates because of filters/rate limits.
   *
   * Do not make the For You row disappear.
   * Fall back to a broad, high-quality pool and
   * still rank it using the user's taste profile.
   */
  if (
    candidates.length <
    Math.min(8, limit)
  ) {
    const fallback =
      await discover(
        type,
        {
          sort_by:
            "popularity.desc",
          "vote_count.gte":
            type === "movie"
              ? 250
              : 150,
          page: 1,
        },
      );

    candidates = dedupe([
      ...candidates,
      ...fallback,
    ]).filter(
      (item) =>
        !excluded.has(
          `${item.mediaType}:${item.id}`,
        ),
    );
  }

  if (
    candidates.length === 0
  ) {
    return [];
  }

  /*
   * First ranking pass is immediate.
   * This means the engine always has a usable
   * candidate pool even if detailed TMDB requests
   * fail or time out.
   */
  const basicRanked =
    candidates
      .map((candidate) => ({
        ...candidate,
        _score:
          basicScore(
            candidate,
            profile,
          ),
      }))
      .sort(
        (a, b) =>
          number(b._score) -
          number(a._score),
      );

  /*
   * Only enrich the strongest candidates.
   * 12 detailed requests are enough to identify
   * directors, actors and keywords without turning
   * the homepage into a giant API waterfall.
   */
  const enrichmentPool =
    basicRanked.slice(
      0,
      Math.min(
        12,
        basicRanked.length,
      ),
    );

  const details =
    await enrich(
      enrichmentPool,
    );

  const ranked =
    basicRanked.map(
      (candidate) => {
        const detailed =
          details.get(
            `${candidate.mediaType}:${candidate.id}`,
          );

        if (!detailed) {
          return candidate;
        }

        return {
          ...candidate,
          ...detailed,
          _score:
            detailedScore(
              detailed,
              profile,
            ),
        };
      },
    );

  ranked.sort(
    (a, b) =>
      number(b._score) -
      number(a._score),
  );

  return diversify(
    ranked,
    limit,
  );
  }
