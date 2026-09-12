"use client";

import {
  getLocalWatchlist,
  getWatchHistory,
} from "@/utils/localStorage";
import type { ContentType } from "@/types";
import type { TasteProfile } from "./taste-engine";

const TMDB_TOKEN = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
const TMDB_BASE = "https://api.themoviedb.org/3";

export type RecommendationItem = {
  id: number;
  adult: boolean;
  backdrop_path: string | null;
  poster_path: string | null;
  genre_ids: number[];
  overview: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  mediaType: ContentType;

  title?: string;
  name?: string;

  release_date?: string;
  first_air_date?: string;
};

type DetailedItem = RecommendationItem & {
  genres?: {
    id: number;
    name: string;
  }[];

  keywords?: {
    id: number;
    name: string;
  }[];

  credits?: {
    cast?: {
      id: number;
      name: string;
      order?: number;
    }[];

    crew?: {
      id: number;
      name: string;
      job?: string;
      department?: string;
    }[];
  };

  spoken_languages?: {
    iso_639_1: string;
    english_name?: string;
  }[];

  production_countries?: {
    iso_3166_1: string;
    name?: string;
  }[];

  origin_country?: string[];
};

type RankedItem = DetailedItem & {
  _score: number;
};

const GENRE_IDS: Record<string, number> = {
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

  "Action & Adventure": 10759,
  Kids: 10762,
  News: 10763,
  Reality: 10764,
  "Sci-Fi & Fantasy": 10765,
  Soap: 10766,
  Talk: 10767,
  "War & Politics": 10768,
};

const GENRE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(GENRE_IDS).map(([name, id]) => [id, name]),
);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getPositive(
  profile: TasteProfile,
  category: keyof TasteProfile["preferences"],
  key: string,
) {
  const map = profile.preferences?.[category] as
    | Record<string, number>
    | undefined;

  const value = map?.[key];

  return typeof value === "number" && value > 0 ? value : 0;
}

function getNegative(
  profile: TasteProfile,
  category: keyof TasteProfile["preferences"],
  key: string,
) {
  const map = profile.preferences?.[category] as
    | Record<string, number>
    | undefined;

  const value = map?.[key];

  return typeof value === "number" && value < 0 ? Math.abs(value) : 0;
}

function yearOf(item: RecommendationItem) {
  const date = item.release_date ?? item.first_air_date;

  if (!date) {
    return null;
  }

  const year = Number(date.slice(0, 4));

  return Number.isFinite(year) ? year : null;
}

function eraOf(year: number | null) {
  if (year === null || year < 1880) {
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

async function tmdb<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  if (!TMDB_TOKEN) {
    return null;
  }

  try {
    const searchParams = new URLSearchParams(params);

    const response = await fetch(
      `${TMDB_BASE}${path}?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${TMDB_TOKEN}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function discover(
  type: ContentType,
  params: Record<string, string>,
) {
  const data = await tmdb<{
    results?: RecommendationItem[];
  }>(`/discover/${type}`, {
    language: "en-US",
    include_adult: "false",
    include_video: "false",
    page: "1",
    ...params,
  });

  return (data?.results ?? []).map((item) => ({
    ...item,
    mediaType: type,
  }));
}

async function getDetails(
  type: ContentType,
  id: number,
) {
  return tmdb<DetailedItem>(`/${type}/${id}`, {
    language: "en-US",
    append_to_response: "credits,keywords",
  });
}

function getTopGenreIds(profile: TasteProfile) {
  const genreScores =
    (profile.preferences?.genres as Record<string, number> | undefined) ??
    {};

  return Object.entries(genreScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => GENRE_IDS[name])
    .filter((id): id is number => Number.isInteger(id));
}

function buildDiscoverQueries(
  profile: TasteProfile,
  type: ContentType,
) {
  const queries: Record<string, string>[] = [];

  const topGenres = getTopGenreIds(profile);

  /*
   * General high-quality pool.
   * This is only a candidate source — the ranking engine
   * decides what actually reaches the user.
   */
  queries.push({
    sort_by: "popularity.desc",
    "vote_count.gte": type === "movie" ? "100" : "50",
  });

  queries.push({
    sort_by: "vote_average.desc",
    "vote_count.gte": type === "movie" ? "300" : "150",
  });

  /*
   * Dedicated pools for the strongest genres.
   * This makes the candidate generator much more
   * personalized than simply taking trending content.
   */
  for (const genreId of topGenres.slice(0, 5)) {
    queries.push({
      with_genres: String(genreId),
      sort_by: "popularity.desc",
      "vote_count.gte": type === "movie" ? "50" : "30",
    });

    queries.push({
      with_genres: String(genreId),
      sort_by: "vote_average.desc",
      "vote_count.gte": type === "movie" ? "150" : "75",
    });
  }

  const preferredEra = profile.summary?.preferredEra;

  if (preferredEra) {
    const start = Number(preferredEra.slice(0, 4));

    if (Number.isFinite(start)) {
      if (type === "movie") {
        queries.push({
          primary_release_date_gte: `${start}-01-01`,
          primary_release_date_lte: `${start + 9}-12-31`,
          sort_by: "popularity.desc",
          "vote_count.gte": "40",
        });
      } else {
        queries.push({
          first_air_date_gte: `${start}-01-01`,
          first_air_date_lte: `${start + 9}-12-31`,
          sort_by: "popularity.desc",
          "vote_count.gte": "25",
        });
      }
    }
  }

  return queries;
}

function scoreBasicCandidate(
  item: RecommendationItem,
  profile: TasteProfile,
) {
  let score = 0;

  let positiveMatches = 0;
  let negativeMatches = 0;

  /*
   * Genre matching is intentionally strong because
   * discover results already contain genre_ids.
   */
  for (const genreId of item.genre_ids ?? []) {
    const genreName = GENRE_NAMES[genreId];

    if (!genreName) {
      continue;
    }

    const positiveScore = getPositive(
      profile,
      "genres",
      genreName,
    );

    const negativeScore = getNegative(
      profile,
      "genres",
      genreName,
    );

    score += positiveScore * 4.2;
    score -= negativeScore * 5.5;

    if (positiveScore > 0) {
      positiveMatches++;
    }

    if (negativeScore > 0) {
      negativeMatches++;
    }
  }

  /*
   * Media type preference.
   */
  score +=
    getPositive(
      profile,
      "mediaTypes",
      item.mediaType,
    ) * 2;

  /*
   * Era preference.
   */
  const era = eraOf(yearOf(item));

  if (era) {
    score +=
      getPositive(
        profile,
        "eras",
        era,
      ) * 1.6;

    score -=
      getNegative(
        profile,
        "eras",
        era,
      ) * 2;
  }

  /*
   * Multiple matching genres get a nonlinear bonus.
   * Someone who likes Crime + Thriller + Mystery
   * should get a candidate containing all three
   * above a candidate matching only one.
   */
  if (positiveMatches > 0) {
    score += positiveMatches * positiveMatches * 1.25;
  }

  /*
   * Explicit negative signals are powerful.
   */
  score -= Math.min(negativeMatches, 5) * 8;

  /*
   * Quality is a supporting signal, not the main signal.
   */
  score +=
    Math.max(
      0,
      item.vote_average - 6,
    ) * 1.35;

  const voteQuality = Math.min(
    1,
    item.vote_count /
      (item.mediaType === "movie" ? 2500 : 1200),
  );

  score += voteQuality * 1.4;

  /*
   * Popularity prevents obscure garbage from dominating,
   * but deliberately has a small weight so "popular"
   * doesn't become the recommendation algorithm.
   */
  score +=
    Math.log10(
      Math.max(10, item.popularity + 10),
    ) * 0.35;

  /*
   * Small recency preference.
   */
  const year = yearOf(item);

  if (year !== null) {
    score += Math.max(
      0,
      Math.min(
        2.5,
        (year - 2010) / 20,
      ),
    );
  }

  return score;
}

function scoreDetailedCandidate(
  item: DetailedItem,
  profile: TasteProfile,
) {
  let score = scoreBasicCandidate(
    item,
    profile,
  );

  let positiveMatches = 0;
  let negativeMatches = 0;

  const genres =
    item.genres?.map(
      (genre) => genre.name,
    ) ?? [];

  const keywords =
    item.keywords?.map(
      (keyword) => keyword.name,
    ) ?? [];

  const directors =
    item.credits?.crew
      ?.filter(
        (person) =>
          person.job === "Director" ||
          person.department === "Directing",
      )
      .slice(0, 5)
      .map(
        (person) => person.name,
      ) ?? [];

  const actors =
    item.credits?.cast
      ?.slice(0, 15)
      .map(
        (person) => person.name,
      ) ?? [];

  const languages =
    item.spoken_languages?.map(
      (language) =>
        language.english_name ??
        language.iso_639_1,
    ) ?? [];

  const countries =
    item.production_countries?.map(
      (country) =>
        country.name ??
        country.iso_3166_1,
    ) ??
    item.origin_country ??
    [];

  /*
   * Genres.
   */
  for (const genre of genres) {
    const positiveScore = getPositive(
      profile,
      "genres",
      genre,
    );

    const negativeScore = getNegative(
      profile,
      "genres",
      genre,
    );

    score += positiveScore * 2.4;
    score -= negativeScore * 3.2;

    if (positiveScore > 0) {
      positiveMatches++;
    }

    if (negativeScore > 0) {
      negativeMatches++;
    }
  }

  /*
   * Keywords are extremely useful because they
   * distinguish two movies with the same broad genre.
   */
  for (const keyword of keywords) {
    const positiveScore = getPositive(
      profile,
      "keywords",
      keyword,
    );

    const negativeScore = getNegative(
      profile,
      "keywords",
      keyword,
    );

    score += positiveScore * 2.8;
    score -= negativeScore * 3.5;

    if (positiveScore > 0) {
      positiveMatches++;
    }

    if (negativeScore > 0) {
      negativeMatches++;
    }
  }

  /*
   * Directors are a very strong taste signal.
   */
  for (const director of directors) {
    const positiveScore = getPositive(
      profile,
      "directors",
      director,
    );

    const negativeScore = getNegative(
      profile,
      "directors",
      director,
    );

    score += positiveScore * 5.5;
    score -= negativeScore * 6;

    if (positiveScore > 0) {
      positiveMatches++;
    }

    if (negativeScore > 0) {
      negativeMatches++;
    }
  }

  /*
   * Cast matters, but less than director/genre/keyword.
   */
  for (const actor of actors) {
    const positiveScore = getPositive(
      profile,
      "actors",
      actor,
    );

    const negativeScore = getNegative(
      profile,
      "actors",
      actor,
    );

    score += positiveScore * 2.1;
    score -= negativeScore * 2.5;

    if (positiveScore > 0) {
      positiveMatches++;
    }

    if (negativeScore > 0) {
      negativeMatches++;
    }
  }

  for (const language of languages) {
    score +=
      getPositive(
        profile,
        "languages",
        language,
      ) * 1.4;
  }

  for (const country of countries) {
    score +=
      getPositive(
        profile,
        "countries",
        country,
      ) * 0.9;
  }

  const era = eraOf(yearOf(item));

  if (era) {
    score +=
      getPositive(
        profile,
        "eras",
        era,
      ) * 1.3;
  }

  /*
   * Dense independent matches are worth more.
   */
  const matchDensity = Math.min(
    positiveMatches,
    12,
  );

  score +=
    matchDensity *
    matchDensity *
    0.8;

  score -=
    Math.min(
      negativeMatches,
      8,
    ) * 7;

  return score;
}

function diversityPenalty(
  item: RankedItem,
  selected: RankedItem[],
) {
  let penalty = 0;

  const itemGenres =
    item.genres?.map(
      (genre) =>
        normalize(genre.name),
    ) ??
    (item.genre_ids ?? [])
      .map(
        (id) =>
          GENRE_NAMES[id] &&
          normalize(GENRE_NAMES[id]),
      )
      .filter(
        (value): value is string =>
          Boolean(value),
      );

  const itemDirector =
    item.credits?.crew?.find(
      (person) =>
        person.job === "Director",
    );

  for (const existing of selected) {
    const existingGenres =
      existing.genres?.map(
        (genre) =>
          normalize(genre.name),
      ) ??
      (existing.genre_ids ?? [])
        .map(
          (id) =>
            GENRE_NAMES[id] &&
            normalize(GENRE_NAMES[id]),
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        );

    const sharedGenres =
      itemGenres.filter(
        (genre) =>
          existingGenres.includes(
            genre,
          ),
      ).length;

    if (sharedGenres >= 2) {
      penalty += 1.25;
    } else if (sharedGenres === 1) {
      penalty += 0.35;
    }

    if (
      itemDirector &&
      existing.credits?.crew?.some(
        (person) =>
          person.job === "Director" &&
          normalize(person.name) ===
            normalize(itemDirector.name),
      )
    ) {
      penalty += 1.1;
    }
  }

  return penalty;
}

function excludedIds() {
  const excluded = new Set<string>();

  for (const item of getWatchHistory()) {
    excluded.add(
      `${item.type}:${item.media_id}`,
    );
  }

  for (const item of getLocalWatchlist()) {
    excluded.add(
      `${item.type}:${item.id}`,
    );
  }

  return excluded;
}

export async function getPersonalizedRecommendations(
  profile: TasteProfile,
  type: ContentType,
  limit = 12,
): Promise<RecommendationItem[]> {
  if (
    !profile ||
    profile.confidence < 8
  ) {
    return [];
  }

  const excluded = excludedIds();

  const queries =
    buildDiscoverQueries(
      profile,
      type,
    );

  /*
   * Candidate generation.
   *
   * We intentionally run the discover requests in parallel,
   * but we only retain a controlled pool.
   */
  const batches =
    await Promise.all(
      queries.map(
        (query) =>
          discover(
            type,
            query,
          ),
      ),
    );

  const candidateMap =
    new Map<
      number,
      RecommendationItem
    >();

  for (const batch of batches) {
    for (const item of batch) {
      const key =
        `${type}:${item.id}`;

      if (excluded.has(key)) {
        continue;
      }

      if (!item.poster_path) {
        continue;
      }

      if (
        !Number.isFinite(item.id)
      ) {
        continue;
      }

      candidateMap.set(
        item.id,
        item,
      );
    }
  }

  /*
   * If discover returned nothing, fail gracefully.
   * The homepage itself must never break because
   * personalization failed.
   */
  if (candidateMap.size === 0) {
    return [];
  }

  /*
   * First-pass ranking works WITHOUT details.
   *
   * This is the important reliability change.
   */
  const basicRanked =
    Array.from(
      candidateMap.values(),
    )
      .map(
        (item) => ({
          ...item,
          _score:
            scoreBasicCandidate(
              item,
              profile,
            ),
        }),
      )
      .sort(
        (a, b) =>
          b._score -
          a._score,
      );

  /*
   * Only enrich the strongest 30 candidates.
   *
   * Even if every detail request fails, we still
   * have the basic ranked candidates.
   */
  const enrichmentPool =
    basicRanked.slice(
      0,
      Math.min(
        30,
        basicRanked.length,
      ),
    );

  const detailedMap =
    new Map<
      number,
      DetailedItem
    >();

  for (
    let index = 0;
    index < enrichmentPool.length;
    index += 6
  ) {
    const chunk =
      enrichmentPool.slice(
        index,
        index + 6,
      );

    const resolved =
      await Promise.all(
        chunk.map(
          (candidate) =>
            getDetails(
              type,
              candidate.id,
            ),
        ),
      );

    for (const detail of resolved) {
      if (detail) {
        detailedMap.set(
          detail.id,
          detail,
        );
      }
    }
  }

  /*
   * Re-score enriched candidates.
   * Un-enriched candidates keep their reliable
   * basic score.
   */
  const ranked: RankedItem[] =
    basicRanked.map(
      (candidate) => {
        const detailed =
          detailedMap.get(
            candidate.id,
          );

        if (!detailed) {
          return candidate;
        }

        return {
          ...candidate,
          ...detailed,
          mediaType: type,
          _score:
            scoreDetailedCandidate(
              {
                ...candidate,
                ...detailed,
                mediaType: type,
              },
              profile,
            ),
        };
      },
    );

  ranked.sort(
    (a, b) =>
      b._score -
      a._score,
  );

  /*
   * Final selection.
   *
   * We don't simply take the top 12 because that can
   * produce twelve near-identical movies.
   */
  const selected: RankedItem[] =
    [];

  for (const item of ranked) {
    if (
      selected.length >=
      limit
    ) {
      break;
    }

    const penalty =
      diversityPenalty(
        item,
        selected,
      );

    const adjustedScore =
      item._score -
      penalty;

    selected.push({
      ...item,
      _score:
        adjustedScore,
    });
  }

  return selected
    .sort(
      (a, b) =>
        b._score -
        a._score,
    )
    .map(
      ({
        _score: _ignored,
        ...item
      }) => item,
    );
      }
