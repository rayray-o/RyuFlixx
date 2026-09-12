"use client";

import {
  getLocalWatchlist,
  getWatchHistory,
} from "@/utils/localStorage";
import type { ContentType } from "@/types";
import type { TasteProfile } from "./taste-engine";

const TMDB_TOKEN =
  process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;

const TMDB_BASE =
  "https://api.themoviedb.org/3";

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

type RankedItem =
  RecommendationItem & {
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

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase();
}

function positive(
  map: Record<string, number> | undefined,
  key: string,
) {
  const value = map?.[key];

  return typeof value === "number" &&
    value > 0
    ? value
    : 0;
}

function negative(
  map: Record<string, number> | undefined,
  key: string,
) {
  const value = map?.[key];

  return typeof value === "number" &&
    value < 0
    ? Math.abs(value)
    : 0;
}

function profileMap(
  profile: TasteProfile,
  key: keyof TasteProfile["preferences"],
) {
  return (
    profile.preferences?.[key] ??
    {}
  );
}

function yearOf(
  item: RecommendationItem,
) {
  const date =
    item.release_date ??
    item.first_air_date;

  if (!date) return null;

  const year = Number(
    date.slice(0, 4),
  );

  return Number.isFinite(year)
    ? year
    : null;
}

function eraOf(
  year: number | null,
) {
  if (
    year === null ||
    year < 1880
  ) {
    return null;
  }

  if (year >= 2020)
    return "2020s";

  if (year >= 2010)
    return "2010s";

  if (year >= 2000)
    return "2000s";

  if (year >= 1990)
    return "1990s";

  if (year >= 1980)
    return "1980s";

  if (year >= 1970)
    return "1970s";

  return "Before 1970";
}

async function tmdb<T>(
  path: string,
  params: Record<string, string>,
) {
  if (!TMDB_TOKEN) {
    return null;
  }

  const searchParams =
    new URLSearchParams(params);

  try {
    const response =
      await fetch(
        `${TMDB_BASE}${path}?${searchParams.toString()}`,
        {
          headers: {
            Authorization:
              `Bearer ${TMDB_TOKEN}`,

            Accept:
              "application/json",
          },

          cache: "no-store",
        },
      );

    if (!response.ok) {
      return null;
    }

    return (
      await response.json()
    ) as T;
  } catch {
    return null;
  }
}

async function discover(
  type: ContentType,
  params: Record<string, string>,
) {
  const data =
    await tmdb<{
      results?: RecommendationItem[];
    }>(
      `/discover/${type}`,
      {
        language: "en-US",
        include_adult: "false",
        include_video: "false",
        page: "1",
        ...params,
      },
    );

  return (
    data?.results ?? []
  ).map((item) => ({
    ...item,
    mediaType: type,
  }));
}

async function detail(
  type: ContentType,
  id: number,
) {
  return tmdb<DetailedItem>(
    `/${type}/${id}`,
    {
      language: "en-US",

      append_to_response:
        "credits,keywords",
    },
  );
}

/*
 * Candidate generation deliberately uses
 * several different discovery strategies.
 *
 * This is important:
 *
 * We don't simply ask TMDB for
 * "popular Action movies".
 *
 * We build a large candidate pool from
 * multiple independent paths, then rank
 * those candidates using the user's taste.
 */
function buildCandidateQueries(
  profile: TasteProfile,
  type: ContentType,
) {
  const genreMap =
    profileMap(
      profile,
      "genres",
    );

  const genres =
    Object.entries(genreMap)
      .filter(
        ([, score]) =>
          score > 0,
      )
      .sort(
        (a, b) =>
          b[1] - a[1],
      )
      .slice(0, 6)
      .map(
        ([name]) =>
          GENRE_IDS[name],
      )
      .filter(
        (
          id,
        ): id is number =>
          Number.isInteger(id),
      );

  const queries: Record<
    string,
    string
  >[] = [];

  /*
   * General high-quality pool.
   */
  queries.push({
    sort_by:
      "popularity.desc",

    "vote_count.gte":
      type === "movie"
        ? "150"
        : "80",
  });

  queries.push({
    sort_by:
      "vote_average.desc",

    "vote_count.gte":
      type === "movie"
        ? "500"
        : "250",
  });

  /*
   * Individual strongest genres.
   */
  for (
    const genre of
      genres.slice(0, 4)
  ) {
    queries.push({
      with_genres:
        String(genre),

      sort_by:
        "popularity.desc",

      "vote_count.gte":
        type === "movie"
          ? "100"
          : "60",
    });
  }

  /*
   * Strongest era.
   */
  const preferredEra =
    profile.summary
      ?.preferredEra;

  if (preferredEra) {
    const start =
      Number(
        preferredEra.slice(
          0,
          4,
        ),
      );

    if (
      Number.isFinite(start)
    ) {
      if (
        type === "movie"
      ) {
        queries.push({
          primary_release_date_gte:
            `${start}-01-01`,

          primary_release_date_lte:
            `${start + 9}-12-31`,

          sort_by:
            "popularity.desc",

          "vote_count.gte":
            "60",
        });
      } else {
        queries.push({
          first_air_date_gte:
            `${start}-01-01`,

          first_air_date_lte:
            `${start + 9}-12-31`,

          sort_by:
            "popularity.desc",

          "vote_count.gte":
            "40",
        });
      }
    }
  }

  /*
   * Recent content.
   *
   * This is intentionally weak.
   * Recency must never overpower taste.
   */
  if (type === "movie") {
    queries.push({
      primary_release_date_gte:
        "2020-01-01",

      sort_by:
        "popularity.desc",

      "vote_count.gte":
        "80",
    });
  } else {
    queries.push({
      first_air_date_gte:
        "2020-01-01",

      sort_by:
        "popularity.desc",

      "vote_count.gte":
        "40",
    });
  }

  return queries;
}

/*
 * Score a candidate against the entire
 * taste profile.
 *
 * The important principle here is:
 *
 * one giant match should NOT automatically
 * beat five independent strong matches.
 *
 * A movie matching the user's genre,
 * keywords, director, actor, era and
 * language is a much stronger candidate.
 */
function scoreCandidate(
  item: DetailedItem,
  profile: TasteProfile,
) {
  const genres =
    item.genres?.map(
      (genre) =>
        genre.name,
    ) ?? [];

  const keywords =
    item.keywords?.map(
      (keyword) =>
        keyword.name,
    ) ?? [];

  const directors =
    item.credits?.crew
      ?.filter(
        (person) =>
          person.job ===
            "Director" ||
          person.department ===
            "Directing",
      )
      .slice(0, 3)
      .map(
        (person) =>
          person.name,
      ) ?? [];

  const actors =
    item.credits?.cast
      ?.slice(0, 12)
      .map(
        (person) =>
          person.name,
      ) ?? [];

  const languages =
    item.spoken_languages
      ?.map(
        (language) =>
          language.english_name ??
          language.iso_639_1,
      ) ?? [];

  const countries =
    item.production_countries
      ?.map(
        (country) =>
          country.name ??
          country.iso_3166_1,
      ) ??
    item.origin_country ??
    [];

  let score = 0;

  let positiveMatches = 0;

  let negativeMatches = 0;

  /*
   * GENRE
   *
   * Strong because genre is one of
   * the most reliable broad taste signals.
   */
  for (
    const genre of genres
  ) {
    const positiveScore =
      positive(
        profileMap(
          profile,
          "genres",
        ),
        genre,
      );

    const negativeScore =
      negative(
        profileMap(
          profile,
          "genres",
        ),
        genre,
      );

    score +=
      positiveScore * 2.8;

    score -=
      negativeScore * 3.8;

    if (
      positiveScore > 0
    ) {
      positiveMatches++;
    }

    if (
      negativeScore > 0
    ) {
      negativeMatches++;
    }
  }

  /*
   * KEYWORDS
   *
   * Keywords are extremely useful
   * for discovering the difference
   * between two movies with the same
   * genre.
   */
  for (
    const keyword of keywords
  ) {
    const positiveScore =
      positive(
        profileMap(
          profile,
          "keywords",
        ),
        keyword,
      );

    const negativeScore =
      negative(
        profileMap(
          profile,
          "keywords",
        ),
        keyword,
      );

    score +=
      positiveScore * 2.15;

    score -=
      negativeScore * 3;

    if (
      positiveScore > 0
    ) {
      positiveMatches++;
    }

    if (
      negativeScore > 0
    ) {
      negativeMatches++;
    }
  }

  /*
   * DIRECTOR
   *
   * High-value signal.
   */
  for (
    const director of directors
  ) {
    const positiveScore =
      positive(
        profileMap(
          profile,
          "directors",
        ),
        director,
      );

    const negativeScore =
      negative(
        profileMap(
          profile,
          "directors",
        ),
        director,
      );

    score +=
      positiveScore * 4.2;

    score -=
      negativeScore * 4.5;

    if (
      positiveScore > 0
    ) {
      positiveMatches++;
    }

    if (
      negativeScore > 0
    ) {
      negativeMatches++;
    }
  }

  /*
   * ACTORS
   */
  for (
    const actor of actors
  ) {
    const positiveScore =
      positive(
        profileMap(
          profile,
          "actors",
        ),
        actor,
      );

    const negativeScore =
      negative(
        profileMap(
          profile,
          "actors",
        ),
        actor,
      );

    score +=
      positiveScore * 1.65;

    score -=
      negativeScore * 2;

    if (
      positiveScore > 0
    ) {
      positiveMatches++;
    }

    if (
      negativeScore > 0
    ) {
      negativeMatches++;
    }
  }

  /*
   * LANGUAGE
   */
  for (
    const language of languages
  ) {
    score +=
      positive(
        profileMap(
          profile,
          "languages",
        ),
        language,
      ) * 1.15;
  }

  /*
   * COUNTRY
   */
  for (
    const country of countries
  ) {
    score +=
      positive(
        profileMap(
          profile,
          "countries",
        ),
        country,
      ) * 0.75;
  }

  /*
   * ERA
   */
  const era =
    eraOf(
      yearOf(item),
    );

  if (era) {
    score +=
      positive(
        profileMap(
          profile,
          "eras",
        ),
        era,
      ) * 1.4;
  }

  /*
   * MOVIE VS TV
   */
  score +=
    positive(
      profileMap(
        profile,
        "mediaTypes",
      ),
      item.mediaType,
    ) * 1.75;

  /*
   * QUALITY
   *
   * TMDB quality is a supporting signal,
   * not the primary recommendation signal.
   *
   * A highly-rated movie the user hates
   * should NOT outrank a slightly lower-rated
   * movie that perfectly matches their taste.
   */
  const voteQuality =
    Math.min(
      1,
      item.vote_count /
        (
          item.mediaType ===
          "movie"
            ? 2500
            : 1200
        ),
    );

  score +=
    Math.max(
      0,
      item.vote_average -
        6.5,
    ) * 1.35;

  score +=
    voteQuality * 1.5;

  /*
   * Popularity is deliberately weak.
   */
  score +=
    Math.log10(
      Math.max(
        10,
        item.popularity + 10,
      ),
    ) * 0.45;

  /*
   * MATCH DENSITY
   *
   * This is extremely important.
   *
   * A candidate matching six
   * independent taste dimensions
   * gets a meaningful bonus.
   */
  const density =
    Math.min(
      positiveMatches,
      10,
    );

  score +=
    density *
    density *
    0.7;

  /*
   * Negative preferences are stronger
   * than positive ones.
   *
   * If someone repeatedly dislikes
   * something, don't keep feeding it
   * because it happens to be popular.
   */
  score -=
    Math.min(
      negativeMatches,
      8,
    ) * 7;

  /*
   * Small recency bonus.
   */
  const year =
    yearOf(item);

  if (year !== null) {
    const recency =
      Math.max(
        0,
        Math.min(
          2.5,
          (year - 2010) /
            20,
        ),
      );

    score += recency;
  }

  return score;
}

function diversityScore(
  item: RankedItem,
  selected: RankedItem[],
) {
  const itemGenres =
    item.genres
      ?.map(
        (genre) =>
          normalize(
            genre.name,
          ),
      ) ?? [];

  const itemDirector =
    item.credits?.crew
      ?.find(
        (person) =>
          person.job ===
          "Director",
      );

  let penalty = 0;

  /*
   * Don't destroy a great recommendation
   * just because it shares a genre.
   *
   * Diversity is a secondary layer.
   */
  for (
    const existing of selected
  ) {
    const existingGenres =
      existing.genres
        ?.map(
          (genre) =>
            normalize(
              genre.name,
            ),
        ) ?? [];

    const sharedGenre =
      itemGenres.some(
        (genre) =>
          existingGenres.includes(
            genre,
          ),
      );

    if (sharedGenre) {
      penalty += 0.8;
    }

    if (
      itemDirector &&
      existing.credits?.crew?.some(
        (person) =>
          person.job ===
            "Director" &&
          normalize(
            person.name,
          ) ===
            normalize(
              itemDirector.name,
            ),
      )
    ) {
      penalty += 1.2;
    }
  }

  return penalty;
}

export async function
  getPersonalizedRecommendations(
    profile: TasteProfile,
    type: ContentType,
    limit = 12,
  ): Promise<
    RecommendationItem[]
  > {
  /*
   * Don't make recommendations from
   * a practically empty profile.
   */
  if (
    !profile ||
    profile.confidence < 8
  ) {
    return [];
  }

  /*
   * Never recommend something the
   * user is already watching,
   * already watched or explicitly
   * saved.
   */
  const history =
    getWatchHistory();

  const watchlist =
    getLocalWatchlist();

  const excluded =
    new Set<string>();

  for (
    const item of history
  ) {
    excluded.add(
      `${item.type}:${item.media_id}`,
    );
  }

  for (
    const item of watchlist
  ) {
    excluded.add(
      `${item.type}:${item.id}`,
    );
  }

  /*
   * Generate a large candidate pool.
   */
  const queries =
    buildCandidateQueries(
      profile,
      type,
    );

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

  for (
    const batch of batches
  ) {
    for (
      const item of batch
    ) {
      const key =
        `${type}:${item.id}`;

      if (
        excluded.has(key)
      ) {
        continue;
      }

      if (
        !item.poster_path
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
   * Keep a substantial pool.
   *
   * We intentionally do NOT rank
   * based on the shallow discover
   * response alone.
   */
  const candidates =
    Array.from(
      candidateMap.values(),
    ).slice(0, 100);

  /*
   * Fetch deep metadata so ranking
   * can actually understand the content.
   */
  const details: DetailedItem[] =
    [];

  /*
   * Batched requests prevent a giant
   * Promise.all from hammering TMDB.
   */
  for (
    let index = 0;
    index < candidates.length;
    index += 8
  ) {
    const chunk =
      candidates.slice(
        index,
        index + 8,
      );

    const resolved =
      await Promise.all(
        chunk.map(
          (candidate) =>
            detail(
              type,
              candidate.id,
            ),
        ),
      );

    for (
      const item of resolved
    ) {
      if (item) {
        details.push(item);
      }
    }
  }

  /*
   * Deep ranking.
   */
  const ranked =
    details
      .map(
        (item) => ({
          ...item,

          _score:
            scoreCandidate(
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
   * Final selection.
   *
   * Taste ranking comes FIRST.
   * Diversity only prevents the
   * final row from becoming repetitive.
   */
  const selected: RankedItem[] =
    [];

  for (
    const item of ranked
  ) {
    if (
      selected.length >=
      limit
    ) {
      break;
    }

    const penalty =
      diversityScore(
        item,
        selected,
      );

    const adjustedScore =
      item._score -
      penalty;

    /*
     * Don't let diversity override
     * an exceptional match.
     */
    if (
      selected.length >= 4 &&
      adjustedScore <
        ranked[0]._score *
          0.32
    ) {
      continue;
    }

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
