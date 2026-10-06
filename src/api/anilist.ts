const ANILIST_API =
  "https://graphql.anilist.co";

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

  season?: string | null;

  seasonYear?: number | null;

  episodes?: number | null;

  duration?: number | null;

  bannerImage?: string | null;

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
      season
      seasonYear
      episodes
      duration

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
