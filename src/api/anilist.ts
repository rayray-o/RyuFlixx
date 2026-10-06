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

/*
 * Direct airing-schedule lookup.
 *
 * This is much more reliable than searching the global
 * schedule and trying to find the MAL ID inside it.
 *
 * AniList's AiringSchedule query supports mediaId,
 * notYetAired, airingAt_greater and sort.
 */
const NEXT_AIRING_QUERY = `
  query (
    $mediaId: Int
    $airingAtGreater: Int
  ) {
    AiringSchedule(
      mediaId: $mediaId
      notYetAired: true
      airingAt_greater: $airingAtGreater
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
`;

export async function getNextAiringEpisode(
  mediaId: string | number,
): Promise<{
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
} | null> {
  const numericMediaId =
    Number(mediaId);

  if (
    !Number.isFinite(
      numericMediaId,
    ) ||
    numericMediaId <= 0
  ) {
    return null;
  }

  const now =
    Math.floor(
      Date.now() / 1000,
    );

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
              NEXT_AIRING_QUERY,

            variables: {
              mediaId:
                numericMediaId,

              airingAtGreater:
                now,
            },
          }),

          next: {
            revalidate: 300,
          },
        },
      );

    if (!response.ok) {
      return null;
    }

    const json =
      (await response.json()) as {
        data?: {
          AiringSchedule?:
            AniListAiringSchedule | null;
        };

        errors?: unknown;
      };

    const schedule =
      json.data?.AiringSchedule;

    if (
      !schedule ||
      !schedule.airingAt ||
      !schedule.episode
    ) {
      return null;
    }

    return {
      airingAt:
        schedule.airingAt,

      timeUntilAiring:
        schedule.timeUntilAiring,

      episode:
        schedule.episode,
    };
  } catch {
    return null;
  }
}

export async function getAniListAnimeByMalId(
  malId: string | number,
): Promise<AniListAnime | null> {
  try {
    const numericMalId =
      Number(malId);

    if (
      !Number.isFinite(
        numericMalId,
      ) ||
      numericMalId <= 0
    ) {
      return null;
    }

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
                numericMalId,
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

    const media =
      json.data?.Media ??
      null;

    if (!media) {
      return null;
    }

    /*
     * Media.nextAiringEpisode is preferred when
     * AniList provides it.
     */
    if (
      media.nextAiringEpisode
        ?.airingAt &&
      media.nextAiringEpisode
        ?.episode
    ) {
      return media;
    }

    /*
     * Fallback to the direct AiringSchedule lookup.
     *
     * IMPORTANT:
     * We use AniList's media ID here,
     * NOT the MAL ID.
     */
    const scheduled =
      await getNextAiringEpisode(
        media.id,
      );

    if (!scheduled) {
      return media;
    }

    return {
      ...media,

      nextAiringEpisode:
        scheduled,
    };
  } catch {
    return null;
  }
  }
