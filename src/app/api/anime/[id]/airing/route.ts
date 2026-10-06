import { NextResponse } from "next/server";

const ANIMESCHEDULE_API =
  "https://animeschedule.net/api/v3";

const CACHE_SECONDS = 300;

interface AnimeScheduleAnime {
  route?: string;
  title?: string;
  status?: string;
}

interface AnimeScheduleTimetable {
  route?: string;
  title?: string;
  episodeDate?: string;
  episodeNumber?: number;
  airingStatus?: string;
}

interface AnimeScheduleAnimeResponse {
  anime?: AnimeScheduleAnime[];
  data?: AnimeScheduleAnime[];
}

function getIsoWeek(
  date: Date,
): {
  year: number;
  week: number;
} {
  const utc = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );

  const day =
    utc.getUTCDay() || 7;

  utc.setUTCDate(
    utc.getUTCDate() +
      4 -
      day,
  );

  const year =
    utc.getUTCFullYear();

  const yearStart =
    new Date(
      Date.UTC(
        year,
        0,
        1,
      ),
    );

  const week =
    Math.ceil(
      (
        (
          utc.getTime() -
          yearStart.getTime()
        ) /
          86400000 +
        1
      ) /
        7,
    );

  return {
    year,
    week,
  };
}

function getNextIsoWeek(
  year: number,
  week: number,
): {
  year: number;
  week: number;
} {
  const date =
    new Date(
      Date.UTC(
        year,
        0,
        4,
      ),
    );

  const day =
    date.getUTCDay() || 7;

  date.setUTCDate(
    date.getUTCDate() -
      day +
      1 +
      (week - 1) * 7 +
      7,
  );

  return getIsoWeek(
    date,
  );
}

async function animeScheduleFetch<T>(
  path: string,
): Promise<T | null> {
  const token =
    process.env
      .ANIMESCHEDULE_API_TOKEN;

  if (!token) {
    console.error(
      "[RyuFlix] ANIMESCHEDULE_API_TOKEN is missing.",
    );

    return null;
  }

  const response =
    await fetch(
      `${ANIMESCHEDULE_API}${path}`,
      {
        headers: {
          Accept:
            "application/json",
          Authorization:
            `Bearer ${token}`,
        },

        next: {
          revalidate:
            CACHE_SECONDS,
        },
      },
    );

  if (!response.ok) {
    console.error(
      "[RyuFlix] AnimeSchedule API:",
      response.status,
      response.statusText,
    );

    return null;
  }

  return (await response.json()) as T;
}

async function getAnimeRoute(
  malId: number,
): Promise<string | null> {
  const data =
    await animeScheduleFetch<
      | AnimeScheduleAnime[]
      | AnimeScheduleAnimeResponse
    >(
      `/anime?mal-ids=${encodeURIComponent(
        String(malId),
      )}`,
    );

  if (!data) {
    return null;
  }

  const animeList =
    Array.isArray(data)
      ? data
      : data.anime ??
        data.data ??
        [];

  return (
    animeList[0]?.route ??
    null
  );
}

async function getTimetable(
  year: number,
  week: number,
): Promise<
  AnimeScheduleTimetable[]
> {
  const data =
    await animeScheduleFetch<
      AnimeScheduleTimetable[]
    >(
      `/timetables?year=${year}&week=${week}&tz=UTC`,
    );

  return Array.isArray(data)
    ? data
    : [];
}

export const dynamic =
  "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } =
    await params;

  const malId =
    Number(id);

  if (
    !Number.isInteger(
      malId,
    ) ||
    malId <= 0
  ) {
    return NextResponse.json(
      {
        airingAt: null,
        episode: null,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const route =
      await getAnimeRoute(
        malId,
      );

    if (!route) {
      return NextResponse.json({
        airingAt: null,
        episode: null,
      });
    }

    const now =
      new Date();

    const currentWeek =
      getIsoWeek(now);

    const nextWeek =
      getNextIsoWeek(
        currentWeek.year,
        currentWeek.week,
      );

    const [
      currentTimetable,
      nextTimetable,
    ] = await Promise.all([
      getTimetable(
        currentWeek.year,
        currentWeek.week,
      ),
      getTimetable(
        nextWeek.year,
        nextWeek.week,
      ),
    ]);

    const candidates = [
      ...currentTimetable,
      ...nextTimetable,
    ]
      .filter(
        (entry) =>
          entry.route ===
          route,
      )
      .filter(
        (entry) =>
          typeof entry.episodeDate ===
            "string" &&
          Number.isFinite(
            Number(
              entry.episodeNumber,
            ),
          ),
      )
      .map(
        (entry) => ({
          airingAt:
            new Date(
              entry.episodeDate!,
            ).getTime() /
            1000,

          episode:
            Number(
              entry.episodeNumber,
            ),
        }),
      )
      .filter(
        (entry) =>
          Number.isFinite(
            entry.airingAt,
          ) &&
          entry.airingAt >
            now.getTime() /
              1000,
      )
      .sort(
        (a, b) =>
          a.airingAt -
          b.airingAt,
      );

    const nextEpisode =
      candidates[0];

    if (!nextEpisode) {
      return NextResponse.json({
        airingAt: null,
        episode: null,
      });
    }

    return NextResponse.json(
      {
        airingAt:
          nextEpisode.airingAt,

        episode:
          nextEpisode.episode,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error(
      "[RyuFlix] AnimeSchedule airing lookup failed:",
      error,
    );

    return NextResponse.json(
      {
        airingAt: null,
        episode: null,
      },
      {
        status: 502,
      },
    );
  }
      }
