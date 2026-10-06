"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const ANILIST_API =
  "https://graphql.anilist.co";

type NextEpisode = {
  airingAt: number;
  episode: number;
  timeUntilAiring?: number | null;
};

interface NextEpisodeCountdownProps {
  malId: string | number;
  initialAiringAt?: number | null;
  initialEpisode?: number | null;
}

type AniListMediaResponse = {
  data?: {
    Media?: {
      id?: number | null;

      nextAiringEpisode?: {
        airingAt?: number | null;
        timeUntilAiring?: number | null;
        episode?: number | null;
      } | null;
    } | null;
  };

  errors?: Array<{
    message?: string;
  }>;
};

type AniListScheduleResponse = {
  data?: {
    Page?: {
      airingSchedules?: Array<{
        airingAt?: number | null;
        timeUntilAiring?: number | null;
        episode?: number | null;
        mediaId?: number | null;
      }>;
    } | null;
  };

  errors?: Array<{
    message?: string;
  }>;
};

const MEDIA_QUERY = `
  query ($malId: Int) {
    Media(
      idMal: $malId
      type: ANIME
    ) {
      id

      nextAiringEpisode {
        airingAt
        timeUntilAiring
        episode
      }
    }
  }
`;

const SCHEDULE_QUERY = `
  query ($mediaId: Int) {
    Page(
      page: 1
      perPage: 5
    ) {
      airingSchedules(
        mediaId: $mediaId
        notYetAired: true
        sort: [TIME]
      ) {
        airingAt
        timeUntilAiring
        episode
        mediaId
      }
    }
  }
`;

function isValidNextEpisode(
  value:
    | {
        airingAt?: number | null;
        episode?: number | null;
      }
    | null
    | undefined,
): value is {
  airingAt: number;
  episode: number;
} {
  return Boolean(
    value &&
      Number.isFinite(value.airingAt) &&
      value.airingAt > 0 &&
      Number.isFinite(value.episode) &&
      value.episode > 0,
  );
}

async function postAniList<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const response =
      await fetch(
        ANILIST_API,
        {
          method: "POST",

          cache: "no-store",

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
        },
      );

    if (!response.ok) {
      console.error(
        "[RyuFlix] AniList HTTP error:",
        response.status,
        response.statusText,
      );

      return null;
    }

    const json =
      (await response.json()) as T & {
        errors?: Array<{
          message?: string;
        }>;
      };

    if (json.errors?.length) {
      console.warn(
        "[RyuFlix] AniList GraphQL errors:",
        json.errors,
      );

      // GraphQL can return useful partial data
      // alongside errors, so do NOT discard json.
    }

    return json;
  } catch (error) {
    console.error(
      "[RyuFlix] AniList request failed:",
      error,
    );

    return null;
  }
}

async function getNextEpisode(
  malId: number,
): Promise<NextEpisode | null> {
  const mediaResult =
    await postAniList<AniListMediaResponse>(
      MEDIA_QUERY,
      {
        malId,
      },
    );

  const media =
    mediaResult?.data?.Media;

  if (
    isValidNextEpisode(
      media?.nextAiringEpisode,
    )
  ) {
    return {
      airingAt:
        media.nextAiringEpisode.airingAt,

      episode:
        media.nextAiringEpisode.episode,

      timeUntilAiring:
        media.nextAiringEpisode
          .timeUntilAiring,
    };
  }

  const mediaId =
    media?.id;

  if (
    !Number.isFinite(
      mediaId,
    ) ||
    !mediaId ||
    mediaId <= 0
  ) {
    return null;
  }

  const scheduleResult =
    await postAniList<AniListScheduleResponse>(
      SCHEDULE_QUERY,
      {
        mediaId,
      },
    );

  const schedules =
    scheduleResult?.data?.Page
      ?.airingSchedules ??
    [];

  const now =
    Math.floor(
      Date.now() / 1000,
    );

  const next =
    schedules
      .filter(
        (
          item,
        ) =>
          Number.isFinite(
            item.airingAt,
          ) &&
          (item.airingAt ?? 0) > now &&
          Number.isFinite(
            item.episode,
          ) &&
          (item.episode ?? 0) > 0,
      )
      .sort(
        (a, b) =>
          (a.airingAt ?? 0) -
          (b.airingAt ?? 0),
      )[0];

  if (!next) {
    return null;
  }

  return {
    airingAt:
      next.airingAt!,

    episode:
      next.episode!,

    timeUntilAiring:
      next.timeUntilAiring,
  };
}

function formatRemaining(
  seconds: number,
): string {
  const safe =
    Math.max(
      0,
      Math.floor(seconds),
    );

  const days =
    Math.floor(
      safe / 86400,
    );

  const hours =
    Math.floor(
      (safe % 86400) / 3600,
    );

  const minutes =
    Math.floor(
      (safe % 3600) / 60,
    );

  const secs =
    safe % 60;

  if (days > 0) {
    return `${days}d ${String(
      hours,
    ).padStart(
      2,
      "0",
    )}h ${String(
      minutes,
    ).padStart(
      2,
      "0",
    )}m`;
  }

  return `${String(
    hours,
  ).padStart(
    2,
    "0",
  )}:${String(
    minutes,
  ).padStart(
    2,
    "0",
  )}:${String(
    secs,
  ).padStart(
    2,
    "0",
  )}`;
}

export default function NextEpisodeCountdown({
  malId,
  initialAiringAt,
  initialEpisode,
}: NextEpisodeCountdownProps) {
  const numericMalId =
    Number(malId);

  const initialSchedule =
    Number.isFinite(
      Number(initialAiringAt),
    ) &&
    Number(initialAiringAt) > 0 &&
    Number.isFinite(
      Number(initialEpisode),
    ) &&
    Number(initialEpisode) > 0
      ? {
          airingAt:
            Number(
              initialAiringAt,
            ),

          episode:
            Number(
              initialEpisode,
            ),
        }
      : null;

  const [
    schedule,
    setSchedule,
  ] = useState<NextEpisode | null>(
    initialSchedule,
  );

  const [
    loading,
    setLoading,
  ] = useState(
    !initialSchedule,
  );

  const [
    now,
    setNow,
  ] = useState(() =>
    Date.now(),
  );

  const loadSchedule =
    useCallback(
      async () => {
        if (
          !Number.isFinite(
            numericMalId,
          ) ||
          numericMalId <= 0
        ) {
          setLoading(false);
          return;
        }

        try {
          const next =
            await getNextEpisode(
              numericMalId,
            );

          setSchedule(
            next,
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [numericMalId],
    );

  useEffect(() => {
    void loadSchedule();

    const refresh =
      window.setInterval(
        () => {
          void loadSchedule();
        },
        5 * 60 * 1000,
      );

    return () =>
      window.clearInterval(
        refresh,
      );
  }, [
    loadSchedule,
  ]);

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setNow(
            Date.now(),
          );
        },
        1000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, []);

  useEffect(() => {
    if (!schedule?.airingAt) {
      return;
    }

    const target =
      schedule.airingAt *
      1000;

    const refreshDelay =
      Math.max(
        5000,
        target -
          Date.now() +
          5000,
      );

    const timeout =
      window.setTimeout(
        () => {
          void loadSchedule();
        },
        Math.min(
          refreshDelay,
          5 * 60 * 1000,
        ),
      );

    return () =>
      window.clearTimeout(
        timeout,
      );
  }, [
    schedule,
    loadSchedule,
  ]);

  const target =
    schedule
      ? schedule.airingAt *
        1000
      : 0;

  const remaining =
    schedule
      ? Math.max(
          0,
          Math.floor(
            (target - now) /
              1000,
          ),
        )
      : 0;

  const airingDate =
    useMemo(
      () =>
        schedule
          ? new Date(
              target,
            )
          : null,
      [
        schedule,
        target,
      ],
    );

  const localDate =
    useMemo(
      () =>
        airingDate
          ? new Intl.DateTimeFormat(
              undefined,
              {
                weekday:
                  "short",
                month:
                  "short",
                day: "numeric",
                year:
                  "numeric",
              },
            ).format(
              airingDate,
            )
          : "",
      [airingDate],
    );

  const localTime =
    useMemo(
      () =>
        airingDate
          ? new Intl.DateTimeFormat(
              undefined,
              {
                hour:
                  "numeric",
                minute:
                  "2-digit",
                timeZoneName:
                  "short",
              },
            ).format(
              airingDate,
            )
          : "",
      [airingDate],
    );

  const timezone =
    useMemo(
      () =>
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone,
      [],
    );

  if (
    !schedule
  ) {
    if (!loading) {
      return null;
    }

    return (
      <section className="mt-8 overflow-hidden rounded-2xl border border-warning/15 bg-warning/[0.04]">
        <div className="p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-warning/70">
            Next Episode
          </p>

          <p className="mt-2 text-sm text-white/45">
            Checking airing schedule…
          </p>
        </div>
      </section>
    );
  }

  const isAiring =
    remaining <= 0;

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-warning/15 bg-warning/[0.04]">
      <div className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-warning/70">
            Next Episode
          </p>

          <h2 className="mt-1 text-xl font-bold text-white">
            Episode{" "}
            {schedule.episode}
          </h2>

          <p className="mt-2 text-sm text-white/45">
            {isAiring
              ? "Airing now"
              : `In ${formatRemaining(
                  remaining,
                )}`}
          </p>
        </div>

        <div className="md:text-right">
          <p className="text-sm font-semibold text-white/80">
            {localDate}
          </p>

          <p className="mt-1 text-sm font-semibold text-warning">
            {localTime}
          </p>

          <p className="mt-1 text-[11px] text-white/25">
            {timezone}
          </p>
        </div>
      </div>
    </section>
  );
}
