import type {
  TasteProfile,
  TasteSignalMap,
} from "@/utils/personalization/taste-engine";

function mergeSignalMaps(
  first: TasteSignalMap,
  second: TasteSignalMap,
): TasteSignalMap {
  const result: TasteSignalMap = {};

  for (const [key, value] of Object.entries(first)) {
    result[key] = value;
  }

  for (const [key, value] of Object.entries(second)) {
    result[key] =
      (result[key] ?? 0) + value;
  }

  return result;
}

function topSignals(
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

function topPositiveSignals(
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

function topGenres(
  map: TasteSignalMap,
  first: TasteProfile,
  second: TasteProfile,
) {
  const names =
    new Set<string>();

  for (const genre of first.topGenres) {
    names.add(genre.name);
  }

  for (const genre of second.topGenres) {
    names.add(genre.name);
  }

  return Array.from(names)
    .map((name) => {
      const score =
        map[name] ?? 0;

      const firstGenre =
        first.topGenres.find(
          (genre) =>
            genre.name === name,
        );

      const secondGenre =
        second.topGenres.find(
          (genre) =>
            genre.name === name,
        );

      const id =
        firstGenre?.id ??
        secondGenre?.id ??
        0;

      return {
        id,
        name,
        score: Number(
          score.toFixed(2),
        ),
      };
    })
    .filter(
      (genre) =>
        genre.score !== 0,
    )
    .sort(
      (a, b) =>
        Math.abs(b.score) -
        Math.abs(a.score),
    )
    .slice(0, 10);
}

function combineMediaPreference(
  first: TasteProfile,
  second: TasteProfile,
): "movie" | "tv" | "balanced" {
  const movie =
    (first.preferences.mediaTypes.movie ?? 0) +
    (second.preferences.mediaTypes.movie ?? 0);

  const tv =
    (first.preferences.mediaTypes.tv ?? 0) +
    (second.preferences.mediaTypes.tv ?? 0);

  const total =
    Math.abs(movie) +
    Math.abs(tv);

  if (total === 0) {
    return "balanced";
  }

  const difference =
    Math.abs(movie - tv);

  if (
    difference <=
    total * 0.15
  ) {
    return "balanced";
  }

  return movie > tv
    ? "movie"
    : "tv";
}

function strongestPositive(
  map: TasteSignalMap,
): string | null {
  const result =
    Object.entries(map)
      .filter(
        ([, score]) =>
          score > 0,
      )
      .sort(
        (a, b) =>
          b[1] - a[1],
      )[0];

  return result?.[0] ?? null;
}

function strongestEra(
  map: TasteSignalMap,
): string | null {
  return (
    Object.entries(map)
      .filter(
        ([, score]) =>
          score > 0,
      )
      .sort(
        (a, b) =>
          b[1] - a[1],
      )[0]?.[0] ?? null
  );
}

function combineConfidence(
  first: TasteProfile,
  second: TasteProfile,
): number {
  const firstItems =
    first.analyzed.ratedMovies +
    first.analyzed.ratedTV +
    first.analyzed.favoritesMovies +
    first.analyzed.favoritesTV +
    first.analyzed.watchlistMovies +
    first.analyzed.watchlistTV;

  const secondItems =
    second.analyzed.ratedMovies +
    second.analyzed.ratedTV +
    second.analyzed.favoritesMovies +
    second.analyzed.favoritesTV +
    second.analyzed.watchlistMovies +
    second.analyzed.watchlistTV;

  const totalItems =
    firstItems +
    secondItems;

  if (totalItems <= 0) {
    return Math.max(
      first.confidence,
      second.confidence,
    );
  }

  /*
   * Weight each source by the amount
   * of behavioral evidence it contributes.
   */
  const weighted =
    first.confidence *
      firstItems +
    second.confidence *
      secondItems;

  return Math.round(
    Math.min(
      100,
      weighted / totalItems,
    ),
  );
}

export function mergeTasteProfiles(
  first: TasteProfile,
  second: TasteProfile,
): TasteProfile {
  const preferences: TasteProfile["preferences"] =
    {
      genres: mergeSignalMaps(
        first.preferences.genres,
        second.preferences.genres,
      ),

      keywords: mergeSignalMaps(
        first.preferences.keywords,
        second.preferences.keywords,
      ),

      directors: mergeSignalMaps(
        first.preferences.directors,
        second.preferences.directors,
      ),

      actors: mergeSignalMaps(
        first.preferences.actors,
        second.preferences.actors,
      ),

      languages: mergeSignalMaps(
        first.preferences.languages,
        second.preferences.languages,
      ),

      countries: mergeSignalMaps(
        first.preferences.countries,
        second.preferences.countries,
      ),

      eras: mergeSignalMaps(
        first.preferences.eras,
        second.preferences.eras,
      ),

      mediaTypes: mergeSignalMaps(
        first.preferences.mediaTypes,
        second.preferences.mediaTypes,
      ),
    };

  const mergedTopGenres =
    topGenres(
      preferences.genres,
      first,
      second,
    );

  const mergedTopKeywords =
    topPositiveSignals(
      preferences.keywords,
      10,
    );

  const mergedTopDirectors =
    topPositiveSignals(
      preferences.directors,
      10,
    );

  const mergedTopActors =
    topPositiveSignals(
      preferences.actors,
      10,
    );

  return {
    version: 1,

    confidence:
      combineConfidence(
        first,
        second,
      ),

    preferences,

    topGenres:
      mergedTopGenres,

    topKeywords:
      mergedTopKeywords,

    topDirectors:
      mergedTopDirectors,

    topActors:
      mergedTopActors,

    summary: {
      preferredMediaType:
        combineMediaPreference(
          first,
          second,
        ),

      preferredEra:
        strongestEra(
          preferences.eras,
        ),

      strongestGenre:
        strongestPositive(
          preferences.genres,
        ),

      strongestKeyword:
        strongestPositive(
          preferences.keywords,
        ),
    },

    analyzed: {
      ratedMovies:
        first.analyzed.ratedMovies +
        second.analyzed.ratedMovies,

      ratedTV:
        first.analyzed.ratedTV +
        second.analyzed.ratedTV,

      favoritesMovies:
        first.analyzed.favoritesMovies +
        second.analyzed.favoritesMovies,

      favoritesTV:
        first.analyzed.favoritesTV +
        second.analyzed.favoritesTV,

      watchlistMovies:
        first.analyzed.watchlistMovies +
        second.analyzed.watchlistMovies,

      watchlistTV:
        first.analyzed.watchlistTV +
        second.analyzed.watchlistTV,

      enrichedItems:
        first.analyzed.enrichedItems +
        second.analyzed.enrichedItems,
    },
  };
      }
