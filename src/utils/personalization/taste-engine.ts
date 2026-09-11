export type TasteSignalMap = Record<string, number>;

export type TasteProfile = {
  version: 1;

  confidence: number;

  preferences: {
    genres: TasteSignalMap;
    keywords: TasteSignalMap;
    directors: TasteSignalMap;
    actors: TasteSignalMap;
    languages: TasteSignalMap;
    countries: TasteSignalMap;
    eras: TasteSignalMap;
    mediaTypes: TasteSignalMap;
  };

  topGenres: {
    id: number;
    name: string;
    score: number;
  }[];

  topKeywords: {
    name: string;
    score: number;
  }[];

  topDirectors: {
    name: string;
    score: number;
  }[];

  topActors: {
    name: string;
    score: number;
  }[];

  summary: {
    preferredMediaType:
      | "movie"
      | "tv"
      | "balanced";

    preferredEra:
      | string
      | null;

    strongestGenre:
      | string
      | null;

    strongestKeyword:
      | string
      | null;
  };

  analyzed: {
    ratedMovies: number;
    ratedTV: number;
    favoritesMovies: number;
    favoritesTV: number;
    watchlistMovies: number;
    watchlistTV: number;
    enrichedItems: number;
  };
};

type BaseItem = {
  id: number;
  title?: string;
  name?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
};

type EnrichedMovie = BaseItem & {
  mediaType: "movie";

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
};

type EnrichedTV = BaseItem & {
  mediaType: "tv";

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

  origin_country?: string[];
};

type InputItem = BaseItem & {
  mediaType: "movie" | "tv";
  userRating?: number | null;
  favorite?: boolean;
  watchlist?: boolean;
};

const GENRE_NAMES: Record<number, string> = {
  // Movie genres
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",

  // TV genres
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

function addSignal(
  map: TasteSignalMap,
  key: string,
  amount: number,
) {
  if (!key) return;

  map[key] =
    (map[key] ?? 0) + amount;
}

function ratingWeight(
  rating: number | null | undefined,
): number {
  if (
    typeof rating !== "number" ||
    !Number.isFinite(rating)
  ) {
    return 0;
  }

  if (rating >= 9) return 4;
  if (rating >= 8) return 3;
  if (rating >= 7) return 2;
  if (rating >= 6) return 0.5;
  if (rating >= 5) return -0.5;
  if (rating >= 4) return -1.5;
  if (rating >= 3) return -2.5;

  return -3;
}

function sortSignals(
  map: TasteSignalMap,
  limit = 10,
) {
  return Object.entries(map)
    .sort(
      (a, b) =>
        Math.abs(b[1]) -
        Math.abs(a[1]),
    )
    .slice(0, limit)
    .map(([name, score]) => ({
      name,
      score: Number(
        score.toFixed(2),
      ),
    }));
}

function positiveSignals(
  map: TasteSignalMap,
  limit = 10,
) {
  return Object.entries(map)
    .filter(([, score]) => score > 0)
    .sort(
      (a, b) => b[1] - a[1],
    )
    .slice(0, limit)
    .map(([name, score]) => ({
      name,
      score: Number(
        score.toFixed(2),
      ),
    }));
}

function getEra(
  date: string | undefined,
): string | null {
  if (!date) return null;

  const year = Number(
    date.slice(0, 4),
  );

  if (
    !Number.isFinite(year) ||
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

function applyItemSignals(
  item: InputItem,
  maps: TasteProfile["preferences"],
) {
  let weight = 0;

  if (item.userRating != null) {
    weight += ratingWeight(
      item.userRating,
    );
  }

  if (item.favorite) {
    weight += 3;
  }

  if (item.watchlist) {
    weight += 0.75;
  }

  if (weight === 0) {
    return;
  }

  const mediaType =
    item.mediaType;

  addSignal(
    maps.mediaTypes,
    mediaType,
    weight,
  );

  for (const genreId of
    item.genre_ids ?? []) {
    const genreName =
      GENRE_NAMES[genreId];

    if (genreName) {
      addSignal(
        maps.genres,
        genreName,
        weight,
      );
    }
  }

  const date =
    item.release_date ??
    item.first_air_date;

  const era = getEra(date);

  if (era) {
    addSignal(
      maps.eras,
      era,
      weight,
    );
  }
}

function enrichItemSignals(
  item: EnrichedMovie | EnrichedTV,
  maps: TasteProfile["preferences"],
  baseWeight: number,
) {
  if (baseWeight === 0) {
    return;
  }

  for (const genre of
    item.genres ?? []) {
    addSignal(
      maps.genres,
      genre.name,
      baseWeight * 1.25,
    );
  }

  for (const keyword of
    item.keywords ?? []) {
    addSignal(
      maps.keywords,
      keyword.name,
      baseWeight,
    );
  }

  const directors =
    item.credits?.crew?.filter(
      (person) =>
        person.job ===
          "Director" ||
        person.department ===
          "Directing",
    ) ?? [];

  for (const director of
    directors.slice(0, 3)) {
    addSignal(
      maps.directors,
      director.name,
      baseWeight * 1.5,
    );
  }

  const cast =
    item.credits?.cast ?? [];

  for (const actor of
    cast.slice(0, 8)) {
    addSignal(
      maps.actors,
      actor.name,
      baseWeight * 0.5,
    );
  }

  for (const language of
    item.spoken_languages ?? []) {
    const languageName =
      language.english_name ??
      language.iso_639_1;

    addSignal(
      maps.languages,
      languageName,
      baseWeight * 0.5,
    );
  }

  if (
    "production_countries" in
    item
  ) {
    for (const country of
      item.production_countries ??
      []) {
      if (country.name) {
        addSignal(
          maps.countries,
          country.name,
          baseWeight * 0.35,
        );
      }
    }
  }

  if (
    "origin_country" in
    item
  ) {
    for (const country of
      item.origin_country ?? []) {
      addSignal(
        maps.countries,
        country,
        baseWeight * 0.35,
      );
    }
  }

  const date =
    item.release_date ??
    item.first_air_date;

  const era = getEra(date);

  if (era) {
    addSignal(
      maps.eras,
      era,
      baseWeight,
    );
  }
}

export function buildTasteProfile({
  ratedMovies,
  ratedTV,
  favoritesMovies,
  favoritesTV,
  watchlistMovies,
  watchlistTV,
  enrichedItems,
}: {
  ratedMovies: InputItem[];
  ratedTV: InputItem[];
  favoritesMovies: InputItem[];
  favoritesTV: InputItem[];
  watchlistMovies: InputItem[];
  watchlistTV: InputItem[];
  enrichedItems: (
    EnrichedMovie |
    EnrichedTV
  )[];
}): TasteProfile {
  const preferences: TasteProfile["preferences"] = {
    genres: {},
    keywords: {},
    directors: {},
    actors: {},
    languages: {},
    countries: {},
    eras: {},
    mediaTypes: {},
  };

  const allItems = [
    ...ratedMovies,
    ...ratedTV,
    ...favoritesMovies,
    ...favoritesTV,
    ...watchlistMovies,
    ...watchlistTV,
  ];

  /*
   * First pass:
   * Use the user's own actions.
   */
  for (const item of allItems) {
    applyItemSignals(
      item,
      preferences,
    );
  }

  /*
   * Second pass:
   * Enrich the strongest items with
   * deeper TMDB metadata.
   */
  for (const item of
    enrichedItems) {
    const matching = allItems.find(
      (candidate) =>
        candidate.id === item.id &&
        candidate.mediaType ===
          item.mediaType,
    );

    if (!matching) continue;

    let weight = ratingWeight(
      matching.userRating,
    );

    if (matching.favorite) {
      weight += 3;
    }

    if (matching.watchlist) {
      weight += 0.75;
    }

    enrichItemSignals(
      item,
      preferences,
      weight,
    );
  }

  const topGenres = positiveSignals(
    preferences.genres,
    10,
  ).map((entry) => ({
    id: 0,
    name: entry.name,
    score: entry.score,
  }));

  const topKeywords =
    positiveSignals(
      preferences.keywords,
      10,
    );

  const topDirectors =
    positiveSignals(
      preferences.directors,
      8,
    );

  const topActors =
    positiveSignals(
      preferences.actors,
      10,
    );

  const mediaSignals =
    preferences.mediaTypes;

  const movieScore =
    mediaSignals.movie ?? 0;

  const tvScore =
    mediaSignals.tv ?? 0;

  let preferredMediaType:
    | "movie"
    | "tv"
    | "balanced" = "balanced";

  if (
    movieScore >
    tvScore * 1.25
  ) {
    preferredMediaType =
      "movie";
  } else if (
    tvScore >
    movieScore * 1.25
  ) {
    preferredMediaType =
      "tv";
  }

  const strongestGenre =
    topGenres[0]?.name ??
    null;

  const strongestKeyword =
    topKeywords[0]?.name ??
    null;

  const eraSignals =
    positiveSignals(
      preferences.eras,
      5,
    );

  const preferredEra =
    eraSignals[0]?.name ??
    null;

  /*
   * Confidence grows with the amount
   * of meaningful user activity, but
   * caps at 100.
   */
  const meaningfulItems =
    allItems.filter(
      (item) =>
        item.userRating != null ||
        item.favorite ||
        item.watchlist,
    ).length;

  const confidence = Math.min(
    100,
    Math.round(
      meaningfulItems * 2.5 +
        enrichedItems.length * 1.5,
    ),
  );

  return {
    version: 1,

    confidence,

    preferences,

    topGenres,

    topKeywords,

    topDirectors,

    topActors,

    summary: {
      preferredMediaType,

      preferredEra,

      strongestGenre,

      strongestKeyword,
    },

    analyzed: {
      ratedMovies:
        ratedMovies.length,

      ratedTV:
        ratedTV.length,

      favoritesMovies:
        favoritesMovies.length,

      favoritesTV:
        favoritesTV.length,

      watchlistMovies:
        watchlistMovies.length,

      watchlistTV:
        watchlistTV.length,

      enrichedItems:
        enrichedItems.length,
    },
  };
  }
