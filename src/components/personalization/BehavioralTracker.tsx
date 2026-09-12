"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
} from "react";
import {
  getMediaBehavior,
  recordBehavioralEvent,
} from "@/utils/personalization/behavioral-memory";
import type { ContentType } from "@/types";

const PLAYER_ORIGINS = new Set([
  "https://vidlink.pro",
  "https://embed.filmu.in",
  "https://www.2embed.cc",
  "https://2embed.cc",
  "https://multiembed.mov",
  "https://www.nontongo.win",
  "https://vidcore.org",
  "https://vidsrcme.ru",
  "https://vidsrcme.su",
  "https://vidsrc.ir",
  "https://vidsrc-me.ru",
  "https://vsembed.ru",
  "https://player.videasy.to",
  "https://filmku.stream",
  "https://vidsrc.ru",
  "https://vidsrc.su",
  "https://vidsrc-me.ir",
]);

interface RouteMedia {
  mediaId: number;
  mediaType: ContentType;
  season?: number;
  episode?: number;
  isPlayer: boolean;
}

interface RuntimeState {
  mediaId: number;
  mediaType: ContentType;
  season?: number;
  episode?: number;

  progress: number;
  duration: number;

  started: boolean;
  completed: boolean;

  lastProgressEventAt: number;
}

function parseRoute(
  pathname: string,
): RouteMedia | null {
  const parts = pathname
    .split("/")
    .filter(Boolean);

  if (parts[0] === "movie") {
    const mediaId =
      Number(parts[1]);

    if (
      Number.isFinite(mediaId) &&
      mediaId > 0
    ) {
      return {
        mediaId,
        mediaType: "movie",
        isPlayer: false,
      };
    }
  }

  if (parts[0] === "tv") {
    const mediaId =
      Number(parts[1]);

    const season =
      Number(parts[2]);

    const episode =
      Number(parts[3]);

    const isPlayer =
      parts[4] === "player";

    if (
      Number.isFinite(mediaId) &&
      mediaId > 0
    ) {
      return {
        mediaId,
        mediaType: "tv",

        season:
          Number.isFinite(season) &&
          season > 0
            ? season
            : undefined,

        episode:
          Number.isFinite(episode) &&
          episode > 0
            ? episode
            : undefined,

        isPlayer,
      };
    }
  }

  return null;
}

function parseProviderMessage(
  value: unknown,
) {
  let raw: any;

  try {
    raw =
      typeof value === "string"
        ? JSON.parse(value)
        : value;
  } catch {
    return null;
  }

  if (
    !raw ||
    typeof raw !== "object" ||
    raw.type !== "PLAYER_EVENT" ||
    !raw.data ||
    typeof raw.data !== "object"
  ) {
    return null;
  }

  const data = raw.data;

  const event =
    typeof data.event === "string"
      ? data.event
      : typeof data.eventType === "string"
        ? data.eventType
        : typeof data.action === "string"
          ? data.action
          : null;

  if (
    event !== "play" &&
    event !== "pause" &&
    event !== "seeked" &&
    event !== "ended" &&
    event !== "timeupdate"
  ) {
    return null;
  }

  const mediaId =
    Number(
      data.tmdbId ??
        data.tmdb_id ??
        data.mediaId ??
        data.media_id ??
        data.id ??
        data.videoId ??
        data.video_id,
    );

  if (
    !Number.isFinite(mediaId) ||
    mediaId <= 0
  ) {
    return null;
  }

    const mediaType: ContentType | null =
    data.mediaType === "tv" ||
    data.media_type === "tv"
      ? "tv"
      : data.mediaType === "movie" ||
          data.media_type === "movie"
        ? "movie"
        : null;

  if (!mediaType) {
    return null;
  }

  const currentTime =
    Number(
      data.currentTime ??
        data.current_time ??
        data.position ??
        data.time ??
        0,
    );

  const duration =
    Number(
      data.duration ??
        data.totalDuration ??
        data.total_duration ??
        0,
    );

  const progressValue =
    Number(
      data.progress ??
        data.percent ??
        0,
    );

  const safeCurrentTime =
    Number.isFinite(currentTime)
      ? Math.max(
          0,
          currentTime,
        )
      : 0;

  const safeDuration =
    Number.isFinite(duration)
      ? Math.max(
          0,
          duration,
        )
      : 0;

  let progress =
    Number.isFinite(
      progressValue,
    )
      ? progressValue
      : 0;

  if (
    safeDuration > 0 &&
    progress <= 1
  ) {
    progress =
      safeCurrentTime /
      safeDuration;
  } else if (
    progress > 1
  ) {
    progress /= 100;
  }

  return {
    mediaId,
    mediaType,

    season:
      typeof data.season === "number"
        ? data.season
        : undefined,

    episode:
      typeof data.episode === "number"
        ? data.episode
        : undefined,

    event,

    currentTime:
      safeCurrentTime,

    duration:
      safeDuration,

    progress: Math.min(
      1,
      Math.max(
        0,
        progress,
      ),
    ),
  };
}

function identity(
  mediaId: number,
  mediaType: ContentType,
  season?: number,
  episode?: number,
): string {
  return [
    mediaType,
    mediaId,
    season ?? "",
    episode ?? "",
  ].join(":");
}

function routeIdentity(
  route: RouteMedia,
): string {
  return identity(
    route.mediaId,
    route.mediaType,
    route.season,
    route.episode,
  );
}

function safeProgress(
  currentTime: number,
  duration: number,
): number {
  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(
      0,
      currentTime /
        duration,
    ),
  );
}

function recordPlaybackEvent(
  state: RuntimeState,
  event:
    | "started"
    | "rewatched"
    | "progress"
    | "paused"
    | "seeked"
    | "completed"
    | "abandoned",
  progress = state.progress,
): void {
  recordBehavioralEvent({
    mediaId:
      state.mediaId,

    mediaType:
      state.mediaType,

    season:
      state.season,

    episode:
      state.episode,

    event,

    progress: Math.min(
      1,
      Math.max(
        0,
        progress,
      ),
    ),

    timestamp:
      new Date().toISOString(),
  });
}

export default function BehavioralTracker() {
  const pathname =
    usePathname();

  const routeRef =
    useRef<RouteMedia | null>(
      null,
    );

  const routeIdentityRef =
    useRef<string | null>(
      null,
    );

  const runtimeRef =
    useRef<RuntimeState | null>(
      null,
    );

  const attachedVideosRef =
    useRef(
      new WeakSet<
        HTMLVideoElement
      >(),
    );

  useEffect(() => {
    const route =
      parseRoute(pathname);

    if (!route) {
      routeRef.current = null;
      routeIdentityRef.current =
        null;
      runtimeRef.current = null;
      return;
    }

    const nextIdentity =
      routeIdentity(route);

    const previousRoute =
      routeRef.current;

    const previousIdentity =
      routeIdentityRef.current;

    if (
      previousRoute?.isPlayer &&
      previousIdentity &&
      previousIdentity !==
        nextIdentity
    ) {
      const previousRuntime =
        runtimeRef.current;

      if (
        previousRuntime &&
        !previousRuntime.completed &&
        previousRuntime.progress >=
          0.12 &&
        previousRuntime.progress <
          0.9
      ) {
        recordPlaybackEvent(
          previousRuntime,
          "abandoned",
        );
      }
    }

    routeRef.current =
      route;

    routeIdentityRef.current =
      nextIdentity;

    runtimeRef.current =
      route.isPlayer
        ? {
            mediaId:
              route.mediaId,

            mediaType:
              route.mediaType,

            season:
              route.season,

            episode:
              route.episode,

            progress: 0,

            duration: 0,

            started: false,

            completed: false,

            lastProgressEventAt: 0,
          }
        : null;

    recordBehavioralEvent({
      mediaId:
        route.mediaId,

      mediaType:
        route.mediaType,

      season:
        route.season,

      episode:
        route.episode,

      event: "opened",

      progress: 0,

      timestamp:
        new Date().toISOString(),
    });
  }, [pathname]);

  useEffect(() => {
    const handleProviderMessage =
      (
        event: MessageEvent,
      ) => {
        if (
          !PLAYER_ORIGINS.has(
            event.origin,
          )
        ) {
          return;
        }

        const parsed =
          parseProviderMessage(
            event.data,
          );

        if (!parsed) {
          return;
        }

        const route =
          routeRef.current;

        if (
          !route?.isPlayer
        ) {
          return;
        }

        const currentIdentity =
          routeIdentity(route);

        const eventIdentity =
          identity(
            parsed.mediaId,
            parsed.mediaType,
            parsed.season,
            parsed.episode,
          );

        if (
          currentIdentity !==
          eventIdentity
        ) {
          return;
        }

        const runtime =
          runtimeRef.current;

        if (!runtime) {
          return;
        }

        runtime.duration =
          Math.max(
            runtime.duration,
            parsed.duration,
          );

        if (
          parsed.duration > 0
        ) {
          runtime.progress =
            Math.max(
              runtime.progress,
              parsed.progress,
            );
        }

        if (
          parsed.event ===
          "play"
        ) {
          if (
            !runtime.started
          ) {
            const existing =
              getMediaBehavior(
                runtime.mediaId,
                runtime.mediaType,
                runtime.season,
                runtime.episode,
              );

            runtime.started =
              true;

            recordPlaybackEvent(
              runtime,
              existing &&
                (
                  existing.starts >
                    0 ||
                  existing.completions >
                    0 ||
                  existing.rewatches >
                    0
                )
                ? "rewatched"
                : "started",
              runtime.progress,
            );
          }

          return;
        }

        if (
          parsed.event ===
          "timeupdate"
        ) {
          const now =
            Date.now();

          if (
            now -
              runtime.lastProgressEventAt >=
              15000 &&
            runtime.progress >=
              0.05
          ) {
            runtime.lastProgressEventAt =
              now;

            recordPlaybackEvent(
              runtime,
              "progress",
              runtime.progress,
            );
          }

          if (
            parsed.duration > 0 &&
            parsed.progress >= 0.9 &&
            !runtime.completed
          ) {
            runtime.completed =
              true;

            runtime.progress =
              Math.max(
                runtime.progress,
                0.9,
              );

            recordPlaybackEvent(
              runtime,
              "completed",
              runtime.progress,
            );
          }

          return;
        }

        if (
          parsed.event ===
          "pause"
        ) {
          if (
            runtime.progress >
            0
          ) {
            recordPlaybackEvent(
              runtime,
              "paused",
              runtime.progress,
            );
          }

          return;
        }

        if (
          parsed.event ===
          "seeked"
        ) {
          recordPlaybackEvent(
            runtime,
            "seeked",
            runtime.progress,
          );

          return;
        }

        if (
          parsed.event ===
          "ended"
        ) {
          if (
            !runtime.completed
          ) {
            runtime.completed =
              true;

            runtime.progress =
              1;

            recordPlaybackEvent(
              runtime,
              "completed",
              1,
            );
          }
        }
      };

    window.addEventListener(
      "message",
      handleProviderMessage,
    );

    return () => {
      window.removeEventListener(
        "message",
        handleProviderMessage,
      );
    };
  }, []);

  useEffect(() => {
    const attachVideo = (
      video: HTMLVideoElement,
    ) => {
      if (
        attachedVideosRef.current.has(
          video,
        )
      ) {
        return;
      }

      attachedVideosRef.current.add(
        video,
      );

      const handlePlay = () => {
        const route =
          routeRef.current;

        if (
          !route?.isPlayer
        ) {
          return;
        }

        const runtime =
          runtimeRef.current;

        if (!runtime) {
          return;
        }

        if (
          !runtime.started
        ) {
          const existing =
            getMediaBehavior(
              runtime.mediaId,
              runtime.mediaType,
              runtime.season,
              runtime.episode,
            );

          runtime.started =
            true;

          recordPlaybackEvent(
            runtime,
            existing &&
              (
                existing.starts >
                  0 ||
                existing.completions >
                  0 ||
                existing.rewatches >
                  0
              )
              ? "rewatched"
              : "started",
            safeProgress(
              video.currentTime,
              video.duration,
            ),
          );
        }
      };

      const handleTimeUpdate =
        () => {
          const route =
            routeRef.current;

          if (
            !route?.isPlayer
          ) {
            return;
          }

          const runtime =
            runtimeRef.current;

          if (!runtime) {
            return;
          }

          const progress =
            safeProgress(
              video.currentTime,
              video.duration,
            );

          runtime.duration =
            Number.isFinite(
              video.duration,
            )
              ? video.duration
              : runtime.duration;

          runtime.progress =
            progress;

          const now =
            Date.now();

          if (
            now -
              runtime.lastProgressEventAt >=
              15000 &&
            progress >= 0.05
          ) {
            runtime.lastProgressEventAt =
              now;

            recordPlaybackEvent(
              runtime,
              "progress",
              progress,
            );
          }

          if (
            progress >= 0.9 &&
            !runtime.completed
          ) {
            runtime.completed =
              true;

            recordPlaybackEvent(
              runtime,
              "completed",
              progress,
            );
          }
        };

      const handlePause = () => {
        const route =
          routeRef.current;

        if (
          !route?.isPlayer
        ) {
          return;
        }

        const runtime =
          runtimeRef.current;

        if (
          runtime &&
          runtime.progress >
            0
        ) {
          recordPlaybackEvent(
            runtime,
            "paused",
            runtime.progress,
          );
        }
      };

      const handleSeeking = () => {
        const route =
          routeRef.current;

        if (
          !route?.isPlayer
        ) {
          return;
        }

        const runtime =
          runtimeRef.current;

        if (runtime) {
          recordPlaybackEvent(
            runtime,
            "seeked",
            runtime.progress,
          );
        }
      };

      const handleEnded = () => {
        const route =
          routeRef.current;

        if (
          !route?.isPlayer
        ) {
          return;
        }

        const runtime =
          runtimeRef.current;

        if (
          runtime &&
          !runtime.completed
        ) {
          runtime.completed =
            true;

          runtime.progress =
            1;

          recordPlaybackEvent(
            runtime,
            "completed",
            1,
          );
        }
      };

      video.addEventListener(
        "play",
        handlePlay,
      );

      video.addEventListener(
        "timeupdate",
        handleTimeUpdate,
      );

      video.addEventListener(
        "pause",
        handlePause,
      );

      video.addEventListener(
        "seeking",
        handleSeeking,
      );

      video.addEventListener(
        "ended",
        handleEnded,
      );
    };

    const scan = () => {
      document
        .querySelectorAll("video")
        .forEach(
          (video) => {
            attachVideo(
              video,
            );
          },
        );
    };

    scan();

    const observer =
      new MutationObserver(
        scan,
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      },
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handlePageHide =
      () => {
        const runtime =
          runtimeRef.current;

        if (
          !runtime ||
          runtime.completed ||
          runtime.progress <
            0.12 ||
          runtime.progress >=
            0.9
        ) {
          return;
        }

        recordPlaybackEvent(
          runtime,
          "abandoned",
          runtime.progress,
        );
      };

    window.addEventListener(
      "pagehide",
      handlePageHide,
    );

    return () => {
      window.removeEventListener(
        "pagehide",
        handlePageHide,
      );
    };
  }, []);

  return null;
  }
