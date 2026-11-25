
import type { ContentType } from "@/types";
import type { RecommendationItem } from "@/utils/personalization/recommendation-engine";
import type {
  GenreEntry,
} from "@/utils/personalization/gorse-inspired-engine";
import type {
  InterestDiscoveryTarget,
} from "@/utils/personalization/interest-cluster-discovery";

export type InterestClusterSourceRequest = {
  name: string;
  weight: number;
  run: () => Promise<RecommendationItem[]>;
};

type RetrievalDependencies = {
  fetchCollection: (
    path: string,
    mediaType: ContentType,
  ) => Promise<RecommendationItem[]>;
  buildDiscoverPath: (
    mediaType: ContentType,
    parameters: Record<string, string>,
  ) => string;
  genreCatalog: GenreEntry[];
  searchKeywordId: (
    keyword: string,
  ) => Promise<number | null>;
};

function normalizeFeatureName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Turns independent interest clusters into bounded TMDB
 * discovery requests.
 *
 * Each cluster gets its own query. This prevents a smaller
 * interest from being swallowed by the user's dominant taste.
 */
export async function buildInterestClusterSourceRequests(
  targets: InterestDiscoveryTarget[],
  mediaType: ContentType,
  dependencies: RetrievalDependencies,
): Promise<InterestClusterSourceRequest[]> {
  const {
    fetchCollection,
    buildDiscoverPath,
    genreCatalog,
    searchKeywordId,
  } = dependencies;

  const genreIdsByName = new Map(
    genreCatalog.map((genre) => [
      normalizeFeatureName(genre.name),
      genre.id,
    ]),
  );

  const boundedTargets = targets
    .filter(
      (target) =>
        Number.isFinite(target.strength) &&
        target.strength > 0 &&
        (target.genres.length > 0 ||
          target.keywords.length > 0),
    )
    .slice(0, 3);

  const resolved = await Promise.all(
    boundedTargets.map(async (target) => {
      const genreIds = target.genres
        .map((genre) =>
          genreIdsByName.get(
            normalizeFeatureName(genre),
          ),
        )
        .filter(
          (id): id is number =>
            typeof id === "number",
        );

      // Resolve at most two keywords per cluster.
      const keywordIds = (
        await Promise.all(
          target.keywords
            .slice(0, 2)
            .map((keyword) => searchKeywordId(keyword)),
        )
      ).filter(
        (id): id is number =>
          typeof id === "number",
      );

      return {
        target,
        genreIds,
        keywordIds,
      };
    }),
  );

  const requests: InterestClusterSourceRequest[] = [];

  for (const cluster of resolved) {
    const { target, genreIds, keywordIds } = cluster;

    // Do not create a broad query if none of the metadata
    // could be resolved to a TMDB identifier.
    if (genreIds.length === 0 && keywordIds.length === 0) {
      continue;
    }

    const parameters: Record<string, string> = {
      sort_by: "popularity.desc",
      page: "1",
    };

    if (genreIds.length > 0) {
      parameters.with_genres = genreIds.join("|");
    }

    if (keywordIds.length > 0) {
      parameters.with_keywords = keywordIds.join("|");
    }

    const strength = clamp(target.strength, 0, 1);

    requests.push({
      name: `interest-cluster-${target.id}`,
      weight: 6 + strength * 5,
      run: () =>
        fetchCollection(
          buildDiscoverPath(mediaType, parameters),
          mediaType,
        ),
    });
  }

  return requests;
}
