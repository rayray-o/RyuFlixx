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

const GENRE_NAMES: Record<number, string> =
  Object.fromEntries(
    Object.entries(GENRE_IDS).map(
      ([name, id]) => [id, name],
    ),
  );

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getSignal(
  profile: TasteProfile,
  category: keyof TasteProfile["preferences"],
  key: string,
) {
  const map =
    profile.preferences?.[category] as
      | Record<string, number>
      | undefined;

  const value = map?.[key];

  return typeof value === "number"
    ? value
    : 0;
}

function yearOf(
  item: RecommendationItem,
) {
  const date =
    item.release_date ??
    item.first_air_date;

  if (!date) {
    return null;
  }

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
    const searchParams =
      new URLSearchParams(params);

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

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function discover(
  type: ContentType,
  params: Record<string, string>,
  page: number,
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
        page: String(page),
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

async function getDetails(
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

function getTopGenres(
  profile: TasteProfile,
) {
  const genres =
    (profile.preferences?.genres ??
      {}) as Record<
      string,
      number
    >;

  return Object.entries(
    genres,
  )
    .filter(
      ([, score]) =>
        typeof score === "number" &&
        score > 0,
    )
    .sort(
      (a, b) =>
        b[1] - a[1],
    )
    .slice(0, 8)
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
}

function buildQueries(
  profile: TasteProfile,
  type: ContentType,
) {
  const queries:
    Record<string, string>[] = [];

  /*
   * Broad quality pools.
   *
   * These deliberately use low thresholds so a
   * smaller/niche taste profile cannot produce zero
   * candidates.
   */
  queries.push({
    sort_by:
      "popularity.desc",
    "vote_count.gte":
      type === "movie"
        ? "20"
        : "10",
  });

  queries.push({
    sort_by:
      "vote_average.desc",
    "vote_count.gte":
      type === "movie"
        ? "50"
        : "25",
  });

  const genres =
    getTopGenres(profile);

  for (
    const genreId of genres.slice(
      0,
      6,
    )
  ) {
    queries.push({
      with_genres:
        String(genreId),
      sort_by:
        "popularity.desc",
      "vote_count.gte":
        type === "movie"
          ? "10"
          : "5",
    });

    queries.push({
      with_genres:
        String(genreId),
      sort_by:
        "vote_average.desc",
      "vote_count.gte":
        type === "movie"
          ? "30"
          : "15",
    });
  }

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
      if (type === "movie") {
        queries.push({
          primary_release_date_gte:
            `${start}-01-01`,
          primary_release_date_lte:
            `${start + 9}-12-31`,
          sort_by:
            "popularity.desc",
          "vote_count.gte":
            "10",
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
            "5",
        });
      }
    }
  }

  return queries;
}

function scoreBasic(
  item: RecommendationItem,
  profile: TasteProfile,
) {
  let score = 0;

  let positiveGenres = 0;
  let negativeGenres = 0;

  for (
    const genreId of
      item.genre_ids ?? []
  ) {
    const name =
      GENRE_NAMES[genreId];

    if (!name) {
      continue;
    }

    const signal =
      getSignal(
        profile,
        "genres",
        name,
      );

    if (signal > 0) {
      positiveGenres++;
      score +=
        signal * 5;
    }

    if (signal < 0) {
      negativeGenres++;
      score +=
        signal * 6;
    }
  }

  const mediaSignal =
    getSignal(
      profile,
      "mediaTypes",
      item.mediaType,
    );

  score +=
    mediaSignal * 2.5;

  const year =
    yearOf(item);

  const era =
    eraOf(year);

  if (era) {
    score +=
      getSignal(
        profile,
        "eras",
        era,
      ) * 2;
  }

  /*
   * Strong bonus when multiple preferred genres
   * overlap.
   */
  if (
    positiveGenres > 0
  ) {
    score +=
      positiveGenres *
      positiveGenres *
      1.5;
  }

  /*
   * Strong negative penalty.
   */
  score -=
    negativeGenres * 10;

  /*
   * Quality.
   */
  score +=
    Math.max(
      0,
      item.vote_average - 5,
    ) * 1.4;

  /*
   * Community confidence.
   */
  const voteConfidence =
    Math.min(
      1,
      item.vote_count /
        (typeVoteTarget(
          item.mediaType,
        )),
    );

  score +=
    voteConfidence * 2;

  /*
   * Popularity is only a weak supporting signal.
   */
  score +=
    Math.log10(
      Math.max(
        10,
        item.popularity + 10,
      ),
    ) * 0.3;

  return score;
}

function typeVoteTarget(
  type: ContentType,
) {
  return type === "movie"
    ? 2500
    : 1200;
}

function scoreDetailed(
  item: DetailedItem,
  profile: TasteProfile,
) {
  let score =
    scoreBasic(
      item,
      profile,
    );

  let positiveMatches = 0;
  let negativeMatches = 0;

  const genres =
    item.genres?.map(
      (x) => x.name,
    ) ?? [];

  const keywords =
    item.keywords?.map(
      (x) => x.name,
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
      .slice(0, 5)
      .map(
        (person) =>
          person.name,
      ) ?? [];

  const actors =
    item.credits?.cast
      ?.slice(0, 15)
      .map(
        (person) =>
          person.name,
      ) ?? [];

  const languages =
    item.spoken_languages?.map(
      (x) =>
        x.english_name ??
        x.iso_639_1,
    ) ?? [];

  const countries =
    item.production_countries?.map(
      (x) =>
        x.name ??
        x.iso_3166_1,
    ) ??
    item.origin_country ??
    [];

  for (
    const genre of genres
  ) {
    const signal =
      getSignal(
        profile,
        "genres",
        genre,
      );

    if (signal > 0) {
      positiveMatches++;
      score +=
        signal * 3;
    }

    if (signal < 0) {
      negativeMatches++;
      score +=
        signal * 4;
    }
  }

  for (
    const keyword of
      keywords
  ) {
    const signal =
      getSignal(
        profile,
        "keywords",
        keyword,
      );

    if (signal > 0) {
      positiveMatches++;
      score +=
        signal * 3.2;
    }

    if (signal < 0) {
      negativeMatches++;
      score +=
        signal * 4;
    }
  }

  for (
    const director of
      directors
  ) {
    const signal =
      getSignal(
        profile,
        "directors",
        director,
      );

    if (signal > 0) {
      positiveMatches++;
      score +=
        signal * 6;
    }

    if (signal < 0) {
      negativeMatches++;
      score +=
        signal * 7;
    }
  }

  for (
    const actor of
      actors
  ) {
    const signal =
      getSignal(
        profile,
        "actors",
        actor,
      );

    if (signal > 0) {
      positiveMatches++;
      score +=
        signal * 2.2;
    }

    if (signal < 0) {
      negativeMatches++;
      score +=
        signal * 3;
    }
  }

  for (
    const language of
      languages
  ) {
    const signal =
      getSignal(
        profile,
        "languages",
        language,
      );

    score +=
      signal * 1.5;
  }

  for (
    const country of
      countries
  ) {
    const signal =
      getSignal(
        profile,
        "countries",
        country,
      );

    score +=
      signal * 0.9;
  }

  const year =
    yearOf(item);

  const era =
    eraOf(year);

  if (era) {
    score +=
      getSignal(
        profile,
        "eras",
        era,
      ) * 1.4;
  }

  /*
   * Reward dense matches.
   */
  score +=
    Math.min(
      positiveMatches,
      15,
    ) **
      2 *
      0.7;

  /*
   * Punish multiple negative matches.
   */
  score -=
    Math.min(
      negativeMatches,
      10,
    ) * 8;

  return score;
}

function diversityPenalty(
  item: RankedItem,
  selected: RankedItem[],
) {
  let penalty = 0;

  const genres =
    item.genres?.map(
      (x) =>
        normalize(x.name),
    ) ??
    item.genre_ids
      .map(
        (id) =>
          GENRE_NAMES[id] &&
          normalize(
            GENRE_NAMES[id],
          ),
      )
      .filter(
        (
          x,
        ): x is string =>
          Boolean(x),
      );

  const director =
    item.credits?.crew?.find(
      (person) =>
        person.job ===
        "Director",
    );

  for (
    const existing of
      selected
  ) {
    const existingGenres =
      existing.genres?.map(
        (x) =>
          normalize(x.name),
      ) ??
      existing.genre_ids
        .map(
          (id) =>
            GENRE_NAMES[id] &&
            normalize(
              GENRE_NAMES[id],
            ),
        )
        .filter(
          (
            x,
          ): x is string =>
            Boolean(x),
        );

    const shared =
      genres.filter(
        (genre) =>
          existingGenres.includes(
            genre,
          ),
      ).length;

    if (shared >= 2) {
      penalty += 1.5;
    } else if (
      shared === 1
    ) {
      penalty += 0.35;
    }

    if (
      director &&
      existing.credits?.crew?.some(
        (person) =>
          person.job ===
            "Director" &&
          normalize(
            person.name,
          ) ===
            normalize(
              director.name,
            ),
      )
    ) {
      penalty += 1;
    }
  }

  return penalty;
}

function getExcludedIds() {
  const excluded =
    new Set<string>();

  for (
    const item of
      getWatchHistory()
  ) {
    excluded.add(
      `${item.type}:${item.media_id}`,
    );
  }

  for (
    const item of
      getLocalWatchlist()
  ) {
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
    !TMDB_TOKEN
  ) {
    return [];
  }

  const excluded =
    getExcludedIds();

  const queries =
    buildQueries(
      profile,
      type,
    );

  /*
   * Generate candidates from several pages.
   *
   * More pages = much larger candidate pool
   * before ranking.
   */
  const requests =
    queries.flatMap(
      (query) =>
        [1, 2, 3].map(
          (page) =>
            discover(
              type,
              query,
              page,
            ),
        ),
    );

  const batches =
    await Promise.all(
      requests,
    );

  const candidates =
    new Map<
      number,
      RecommendationItem
    >();

  for (
    const batch of
      batches
  ) {
    for (
      const item of
        batch
    ) {
      if (
        !Number.isFinite(
          item.id,
        )
      ) {
        continue;
      }

      /*
       * Poster is preferred but NOT required.
       * This prevents legitimate TMDB results from
       * being thrown away too early.
       */
      const key =
        `${type}:${item.id}`;

      if (
        excluded.has(key)
      ) {
        continue;
      }

      candidates.set(
        item.id,
        item,
      );
    }
  }

  /*
   * If the normal personalized pools are empty,
   * perform a broad safety-net query.
   */
  if (
    candidates.size === 0
  ) {
    const fallback =
      await Promise.all([
        discover(
          type,
          {
            sort_by:
              "popularity.desc",
          },
          1,
        ),
        discover(
          type,
          {
            sort_by:
              "vote_average.desc",
            "vote_count.gte":
              "10",
          },
          1,
        ),
        discover(
          type,
          {
            sort_by:
              "popularity.desc",
          },
          2,
        ),
      ]);

    for (
      const batch of
        fallback
    ) {
      for (
        const item of
          batch
      ) {
        const key =
          `${type}:${item.id}`;

        if (
          excluded.has(key)
        ) {
          continue;
        }

        candidates.set(
          item.id,
          item,
        );
      }
    }
  }

  if (
    candidates.size === 0
  ) {
    return [];
  }

  /*
   * First ranking pass.
   */
  let ranked: RankedItem[] =
    Array.from(
      candidates.values(),
    )
      .map(
        (item) => ({
          ...item,
          _score:
            scoreBasic(
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
   * Enrich a much larger pool than before.
   *
   * Details provide the strongest signals:
   * keywords, directors, cast, languages, countries.
   */
  const enrichmentPool =
    ranked.slice(
      0,
      Math.min(
        48,
        ranked.length,
      ),
    );

  const detailed =
    new Map<
      number,
      DetailedItem
    >();

  for (
    let index = 0;
    index <
      enrichmentPool.length;
    index += 8
  ) {
    const chunk =
      enrichmentPool.slice(
        index,
        index + 8,
      );

    const results =
      await Promise.all(
        chunk.map(
          (item) =>
            getDetails(
              type,
              item.id,
            ),
        ),
      );

    for (
      const detail of
        results
    ) {
      if (detail) {
        detailed.set(
          detail.id,
          detail,
        );
      }
    }
  }

  /*
   * Detailed re-ranking.
   */
  ranked =
    ranked.map(
      (item) => {
        const detail =
          detailed.get(
            item.id,
          );

        if (!detail) {
          return item;
        }

        const merged = {
          ...item,
          ...detail,
          mediaType: type,
        };

        return {
          ...merged,
          _score:
            scoreDetailed(
              merged,
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
   * Diversity-aware final selection.
   */
  const selected:
    RankedItem[] = [];

  for (
    const item of
      ranked
  ) {
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

    selected.push({
      ...item,
      _score:
        item._score -
        penalty,
    });
  }

  /*
   * Final safety fallback.
   *
   * If something weird happens during scoring,
   * return the strongest available candidates instead
   * of producing an empty For You row.
   */
  if (
    selected.length === 0
  ) {
    return ranked
      .slice(0, limit)
      .map(
        ({
          _score,
          ...item
        }) => item,
      );
  }

  return selected
    .sort(
      (a, b) =>
        b._score -
        a._score,
    )
    .map(
      ({
        _score,
        ...item
      }) => item,
    );
  }
