import {
  AnimeEpisode,
  AnimeMedia,
  AnimePage,
} from "@/types/anime";

const ANILIST_GRAPHQL_URL =
  "https://graphql.anilist.co";

type AniListResponse<T> = {
  data?: T;
  errors?: {
    message: string;
  }[];
};

async function anilistRequest<T>(
  query: string,
  variables: Record<
    string,
    string | number | boolean | null
  > = {},
): Promise<T> {
  const response = await fetch(
    ANILIST_GRAPHQL_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json",
      },

      body: JSON.stringify({
        query,
        variables,
      }),

      next: {
        revalidate: 300,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `AniList request failed with ${response.status}`,
    );
  }

  const result =
    (await response.json()) as AniListResponse<T>;

  if (
    result.errors &&
    result.errors.length > 0
  ) {
    throw new Error(
      result.errors
        .map(
          (error) =>
            error.message,
        )
        .join(", "),
    );
  }

  if (!result.data) {
    throw new Error(
      "AniList returned no data",
    );
  }

  return result.data;
}

const ANIME_FIELDS = `
  id
  idMal

  title {
    romaji
    english
    native
  }

  description

  episodes
  duration

  status
  format

  season
  seasonYear

  averageScore
  popularity

  genres

  coverImage {
    large
    extraLarge
  }

  bannerImage

  siteUrl
`;

const ANIME_LIST_QUERY = `
  query AnimeList(
    $page: Int
    $perPage: Int
    $sort: [MediaSort]
    $status: MediaStatus
    $season: MediaSeason
  ) {
    Page(
      page: $page
      perPage: $perPage
    ) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        total
      }

      media(
        type: ANIME
        sort: $sort
        status: $status
        season: $season
      ) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

const ANIME_DETAIL_QUERY = `
  query AnimeDetails(
    $id: Int!
  ) {
    Media(
      id: $id
      type: ANIME
    ) {
      ${ANIME_FIELDS}
    }
  }
`;

export async function getAnimePage(
  options: {
    page?: number;
    perPage?: number;
    sort?: string;
    status?: string;
    season?: string;
  } = {},
): Promise<AnimePage> {
  const data =
    await anilistRequest<{
      Page: AnimePage;
    }>(
      ANIME_LIST_QUERY,
      {
        page:
          options.page ?? 1,

        perPage:
          options.perPage ?? 20,

        sort:
          options.sort ?? "TRENDING_DESC",

        status:
          options.status ?? null,

        season:
          options.season ?? null,
      },
    );

  return data.Page;
}

export async function getAnimeById(
  id: number,
): Promise<AnimeMedia> {
  const data =
    await anilistRequest<{
      Media: AnimeMedia;
    }>(
      ANIME_DETAIL_QUERY,
      {
        id,
      },
    );

  if (!data.Media) {
    throw new Error(
      "Anime not found",
    );
  }

  return data.Media;
}

export function getAnimeTitle(
  anime: AnimeMedia,
): string {
  return (
    anime.title.english ||
    anime.title.romaji ||
    anime.title.native ||
    "Unknown Anime"
  );
}

export function getAnimeEpisodes(
  anime: AnimeMedia,
): AnimeEpisode[] {
  const totalEpisodes =
    anime.episodes ?? 0;

  if (
    totalEpisodes <= 0
  ) {
    return [];
  }

  return Array.from(
    {
      length: totalEpisodes,
    },
    (_, index) => ({
      episode:
        index + 1,

      title:
        `Episode ${index + 1}`,
    }),
  );
}
