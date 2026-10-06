export type MalEpisode = {
  mal_id: number;
  title: string | null;
  title_japanese?: string | null;
  title_romanji?: string | null;
  filler?: boolean;
  recap?: boolean;
  aired?: string | null;
  score?: number | null;
  duration?: string | null;
};

type JikanEpisodeResponse = {
  data?: MalEpisode[];

  pagination?: {
    last_visible_page?: number;
    has_next_page?: boolean;
  };
};

const JIKAN_API_BASE =
  "https://api.jikan.moe/v4";

async function fetchEpisodePage(
  animeId: string | number,
  page: number,
): Promise<JikanEpisodeResponse> {
  const response =
    await fetch(
      `${JIKAN_API_BASE}/anime/${encodeURIComponent(
        String(animeId),
      )}/episodes?page=${page}`,
      {
        headers: {
          Accept:
            "application/json",
        },

        next: {
          revalidate: 1800,
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `Episode request failed with ${response.status}`,
    );
  }

  return (
    (await response.json()) as JikanEpisodeResponse
  );
}

export async function getAnimeEpisodes(
  animeId: string | number,
): Promise<MalEpisode[]> {
  try {
    const firstPage =
      await fetchEpisodePage(
        animeId,
        1,
      );

    const episodes = [
      ...(firstPage.data ?? []),
    ];

    const lastVisiblePage =
      firstPage.pagination
        ?.last_visible_page ??
      1;

    if (
      lastVisiblePage <= 1
    ) {
      return episodes.sort(
        (a, b) =>
          a.mal_id - b.mal_id,
      );
    }

    for (
      let page = 2;
      page <= lastVisiblePage;
      page += 1
    ) {
      const response =
        await fetchEpisodePage(
          animeId,
          page,
        );

      episodes.push(
        ...(response.data ?? []),
      );

      if (
        !response.pagination
          ?.has_next_page
      ) {
        break;
      }
    }

    return episodes.sort(
      (a, b) =>
        a.mal_id - b.mal_id,
    );
  } catch {
    return [];
  }
      }
