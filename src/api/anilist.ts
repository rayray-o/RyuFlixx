const ANILIST_API =
  "https://graphql.anilist.co";

export type AniListAiringSchedule = {
  id?: number;

  airingAt: number;

  timeUntilAiring: number;

  episode: number;

  mediaId?: number;
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

  airingSchedule?: {
    nodes?: AniListAiringSchedule[];
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

      airingSchedule(
        notYetAired: true
        perPage: 1
      ) {
        nodes {
          id

          airingAt

          timeUntilAiring

          episode

          mediaId
        }
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
            revalidate: 300,
          },
        },
      );

    if (!response.ok) {
      console.error(
        "[AniList] HTTP error:",
        response.status,
        response.statusText,
      );

      return null;
    }

    const json =
      (await response.json()) as {
        data?: {
          Media?: AniListAnime | null;
        };

        errors?: Array<{
          message?: string;

          locations?: Array<{
            line?: number;

            column?: number;
          }>;

          path?: Array<
            string | number
          >;
        }>;
      };

    if (json.errors?.length) {
      console.error(
        "[AniList] GraphQL errors:",
        JSON.stringify(
          json.errors,
          null,
          2,
        ),
      );

      return null;
    }

    const media =
      json.data?.Media ??
      null;

    if (!media) {
      console.error(
        "[AniList] No Media returned for MAL ID:",
        numericMalId,
      );

      return null;
    }

    const directNext =
      media.nextAiringEpisode;

    const scheduledNext =
      media.airingSchedule
        ?.nodes?.[0];

    if (
      directNext?.airingAt &&
      directNext?.episode
    ) {
      return {
        ...media,

        nextAiringEpisode:
          directNext,
      };
    }

    if (
      scheduledNext?.airingAt &&
      scheduledNext?.episode
    ) {
      return {
        ...media,

        nextAiringEpisode: {
          airingAt:
            scheduledNext.airingAt,

          timeUntilAiring:
            scheduledNext.timeUntilAiring,

          episode:
            scheduledNext.episode,
        },
      };
    }

    return media;
  } catch (error) {
    console.error(
      "[AniList] Request failed:",
      error,
    );

    return null;
  }
        }
