const ANILIST_API =
  "https://graphql.anilist.co";

export type AniListAiringSchedule = {
  id: number;
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
  mediaId: number;

  media?: {
    id: number;
    idMal?: number | null;

    title?: {
      romaji?: string | null;
      english?: string | null;
      native?: string | null;
    } | null;

    format?: string | null;
    status?: string | null;

    coverImage?: {
      large?: string | null;
      extraLarge?: string | null;
    } | null;
  } | null;
};

export type AniListMediaItem = {
  id: number;

  idMal?: number | null;

  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;

  format?: string | null;

  season?: string | null;

  seasonYear?: number | null;

  episodes?: number | null;

  duration?: number | null;

  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;

  coverImage?: {
    large?: string | null;
    extraLarge?: string | null;
  } | null;
};

export type AniListCharacter = {
  role?: string | null;

  node: {
    id: number;

    name?: {
      full?: string | null;
      native?: string | null;
    } | null;

    image?: {
      large?: string | null;
    } | null;
  };

  voiceActors?: Array<{
    id: number;

    name?: {
      full?: string | null;
    } | null;

    image?: {
      large?: string | null;
    } | null;
  }>;
};

export type AniListRelation = {
  relationType?: string | null;

  node: AniListMediaItem;
};

export type AniListRecommendation = {
  mediaRecommendation?: AniListMediaItem | null;
};

export type AniListAnime = {
  id: number;

  idMal?: number | null;

  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;

  format?: string | null;

  status?: string | null;

  notYetAired?: boolean | null;

  season?: string | null;

  seasonYear?: number | null;

  episodes?: number | null;

  duration?: number | null;

  bannerImage?: string | null;

  nextAiringEpisode?: {
    airingAt?: number | null;
    timeUntilAiring?: number | null;
    episode?: number | null;
  } | null;

  trailer?: {
    id?: string | null;
    site?: string | null;
    thumbnail?: string | null;
  } | null;

  relations?: {
    edges?: AniListRelation[];
  } | null;

  characters?: {
    edges?: AniListCharacter[];
  } | null;

  recommendations?: {
    nodes?: AniListRecommendation[];
  } | null;
};

const QUERY = `
  query ($malId: Int) {
    Media(
      idMal: $malId
      type: ANIME
    ) {
      id
      idMal

      title {
        romaji
        english
        native
      }

      format
      status
      notYetAired
      season
      seasonYear
      episodes
      duration

      nextAiringEpisode {
        airingAt
        timeUntilAiring
        episode
      }

      bannerImage

      trailer {
        id
        site
        thumbnail
      }

      relations {
        edges {
          relationType

          node {
            id
            idMal

            title {
              romaji
              english
              native
            }

            format
            season
            seasonYear
            episodes

            startDate {
              year
              month
              day
            }

            coverImage {
              large
              extraLarge
            }
          }
        }
      }

      characters(
        page: 1
        perPage: 12
      ) {
        edges {
          role

          node {
            id

            name {
              full
              native
            }

            image {
              large
            }
          }

          voiceActors {
            id

            name {
              full
            }

            image {
              large
            }
          }
        }
      }

      recommendations(
        page: 1
        perPage: 12
      ) {
        nodes {
          mediaRecommendation {
            id
            idMal

            title {
              romaji
              english
              native
            }

            format

            startDate {
              year
            }

            coverImage {
              large
              extraLarge
            }
          }
        }
      }
    }
  }
`;

const AIRING_SCHEDULE_QUERY = `
  query (
    $page: Int
    $perPage: Int
    $airingAtGreater: Int
    $airingAtLesser: Int
  ) {
    Page(
      page: $page
      perPage: $perPage
    ) {
      pageInfo {
        hasNextPage
      }

      airingSchedules(
        notYetAired: true
        airingAt_greater: $airingAtGreater
        airingAt_lesser: $airingAtLesser
        sort: [TIME]
      ) {
        id
        airingAt
        timeUntilAiring
        episode
        mediaId

        media {
          id
          idMal

          title {
            romaji
            english
            native
          }

          format
          status

          coverImage {
            large
            extraLarge
          }
        }
      }
    }
  }
`;

export async function getAniListAnimeByMalId(
  malId: string | number,
): Promise<AniListAnime | null> {
  try {
    const response =
      await fetch(
        ANILIST_API,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            query: QUERY,

            variables: {
              malId:
                Number(malId),
            },
          }),

          next: {
            revalidate: 1800,
          },
        },
      );

    if (!response.ok) {
      return null;
    }

    const json =
      (await response.json()) as {
        data?: {
          Media?: AniListAnime | null;
        };
      };

    return (
      json.data?.Media ??
      null
    );
  } catch {
    return null;
  }
}

export async function getAniListAiringSchedule(
  options: {
    page?: number;
    perPage?: number;
    from?: number;
    to?: number;
  } = {},
): Promise<{
  items: AniListAiringSchedule[];
  hasNextPage: boolean;
}> {
  const page =
    Number.isFinite(options.page) &&
    (options.page ?? 1) > 0
      ? Math.floor(options.page ?? 1)
      : 1;

  const perPage =
    Number.isFinite(options.perPage) &&
    (options.perPage ?? 50) > 0
      ? Math.min(
          50,
          Math.floor(
            options.perPage ?? 50,
          ),
        )
      : 50;

  try {
    const response =
      await fetch(
        ANILIST_API,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            query:
              AIRING_SCHEDULE_QUERY,

            variables: {
              page,
              perPage,

              airingAtGreater:
                options.from,

              airingAtLesser:
                options.to,
            },
          }),

          next: {
            revalidate: 300,
          },
        },
      );

    if (!response.ok) {
      return {
        items: [],
        hasNextPage: false,
      };
    }

    const json =
      (await response.json()) as {
        data?: {
          Page?: {
            pageInfo?: {
              hasNextPage?: boolean;
            } | null;

            airingSchedules?: AniListAiringSchedule[];
          } | null;
        };
      };

    return {
      items:
        json.data?.Page
          ?.airingSchedules ??
        [],

      hasNextPage:
        Boolean(
          json.data?.Page
            ?.pageInfo
            ?.hasNextPage,
        ),
    };
  } catch {
    return {
      items: [],
      hasNextPage: false,
    };
  }
  }
