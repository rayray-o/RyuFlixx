"use client";

import {
  useEffect,
  useRef,
} from "react";
import {
  useRouter,
} from "next/navigation";
import {
  saveAnimeWatchProgress,
} from "@/utils/animeHistory";

interface AnimePlayerProps {
  playerUrl: string;

  animeId: string;
  title: string;

  episode: number;
  episodeTitle?: string | null;

  poster?: string | null;
  image?: string | null;

  nextEpisode?: number | null;
  language?: "sub" | "dub";
}

const MEGAPLAY_ORIGIN =
  "https://megaplay.buzz";

const SAVE_INTERVAL_SECONDS = 5;

export default function AnimePlayer(
  {
    playerUrl,

    animeId,
    title,

    episode,
    episodeTitle,

    poster,
    image,

    nextEpisode,
    language = "sub",
  }: AnimePlayerProps,
) {
  const router =
    useRouter();

  const latestProgressRef =
    useRef({
      currentTime: 0,
      duration: 0,
    });

  const lastSavedTimeRef =
    useRef(0);

  const completedRef =
    useRef(false);

  const advancingRef =
    useRef(false);

  useEffect(() => {
    latestProgressRef.current = {
      currentTime: 0,
      duration: 0,
    };

    lastSavedTimeRef.current = 0;

    completedRef.current = false;

    advancingRef.current = false;
  }, [
    animeId,
    episode,
    playerUrl,
  ]);

  useEffect(() => {
    const saveLatest =
      (completed = false) => {
        const latest =
          latestProgressRef.current;

        if (
          latest.currentTime <= 0 &&
          !completed
        ) {
          return;
        }

        saveAnimeWatchProgress(
          {
            animeId,
            episode,
            title,

            poster:
              poster ?? undefined,

            image:
              image ?? undefined,

            episodeTitle,
          },

          latest.currentTime,

          latest.duration,

          completed,
        );

        lastSavedTimeRef.current =
          latest.currentTime;
      };

    const advanceToNextEpisode =
      () => {
        if (
          !nextEpisode ||
          advancingRef.current
        ) {
          return;
        }

        advancingRef.current =
          true;

        router.push(
          `/anime/${encodeURIComponent(
            animeId,
          )}/watch?episode=${nextEpisode}&lang=${language}`,
        );
      };

    const handleMessage =
      (event: MessageEvent) => {
        if (
          event.origin !==
          MEGAPLAY_ORIGIN
        ) {
          return;
        }

        let data =
          event.data;

        if (
          typeof data ===
          "string"
        ) {
          try {
            data =
              JSON.parse(data);
          } catch {
            return;
          }
        }

        if (
          !data ||
          typeof data !==
            "object"
        ) {
          return;
        }

        if (
          data.event ===
          "time"
        ) {
          const currentTime =
            Number(data.time);

          const duration =
            Number(
              data.duration,
            );

          if (
            !Number.isFinite(
              currentTime,
            )
          ) {
            return;
          }

          latestProgressRef.current =
            {
              currentTime:
                Math.max(
                  0,
                  currentTime,
                ),

              duration:
                Number.isFinite(
                  duration,
                )
                  ? Math.max(
                      0,
                      duration,
                    )
                  : latestProgressRef
                      .current
                      .duration,
            };

          if (
            currentTime -
              lastSavedTimeRef.current >=
              SAVE_INTERVAL_SECONDS
          ) {
            saveLatest();
          }

          return;
        }

        if (
          data.type ===
          "watching-log"
        ) {
          const currentTime =
            Number(
              data.currentTime,
            );

          const duration =
            Number(
              data.duration,
            );

          if (
            !Number.isFinite(
              currentTime,
            )
          ) {
            return;
          }

          latestProgressRef.current =
            {
              currentTime:
                Math.max(
                  0,
                  currentTime,
                ),

              duration:
                Number.isFinite(
                  duration,
                )
                  ? Math.max(
                      0,
                      duration,
                    )
                  : latestProgressRef
                      .current
                      .duration,
            };

          if (
            currentTime -
              lastSavedTimeRef.current >=
              SAVE_INTERVAL_SECONDS
          ) {
            saveLatest();
          }

          return;
        }

        if (
          data.event ===
          "complete"
        ) {
          if (
            completedRef.current
          ) {
            return;
          }

          completedRef.current =
            true;

          saveLatest(true);

          advanceToNextEpisode();
        }
      };

    const handlePageHide =
      () => {
        saveLatest(
          completedRef.current,
        );
      };

    window.addEventListener(
      "message",
      handleMessage,
    );

    window.addEventListener(
      "pagehide",
      handlePageHide,
    );

    return () => {
      saveLatest(
        completedRef.current,
      );

      window.removeEventListener(
        "message",
        handleMessage,
      );

      window.removeEventListener(
        "pagehide",
        handlePageHide,
      );
    };
  }, [
    animeId,
    episode,
    title,
    episodeTitle,
    poster,
    image,
    nextEpisode,
    language,
    router,
  ]);

  return (
    <iframe
      key={playerUrl}
      src={playerUrl}
      title={`${title} Episode ${episode}`}
      className="absolute inset-0 h-full w-full border-0"
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="origin"
    />
  );
        }
