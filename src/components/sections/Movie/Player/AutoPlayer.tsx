"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerSource } from "@/utils/playerSources";
import {
  checkPlayerSources,
  chooseHealthySource,
  type PlayerHealthResult,
} from "@/utils/playerHealth";

type AutoPlayerProps = {
  sources: PlayerSource[];
  poster?: string;
  title?: string;
};

type PlayerState =
  | "idle"
  | "checking"
  | "ready"
  | "error";

export default function AutoPlayer({
  sources,
  poster,
  title = "Video",
}: AutoPlayerProps) {
  const [state, setState] =
    useState<PlayerState>("idle");

  const [selectedSource, setSelectedSource] =
    useState<PlayerSource | null>(null);

  const [health, setHealth] = useState<
    PlayerHealthResult[]
  >([]);

  const authorizedSources = useMemo(
    () =>
      sources.filter(
        (source) => source.authorized,
      ),
    [sources],
  );

  useEffect(() => {
    let cancelled = false;

    async function findSource() {
      if (authorizedSources.length === 0) {
        setState("error");
        return;
      }

      setState("checking");
      setSelectedSource(null);

      const results =
        await checkPlayerSources(
          authorizedSources,
          5000,
        );

      if (cancelled) return;

      setHealth(results);

      const best = chooseHealthySource(
        authorizedSources,
        results,
      );

      if (!best) {
        setState("error");
        return;
      }

      setSelectedSource(best);
      setState("ready");
    }

    findSource();

    return () => {
      cancelled = true;
    };
  }, [authorizedSources]);

  if (state === "checking") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {poster && (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />

          <p className="text-sm font-medium text-white">
            Finding the best player…
          </p>

          <p className="mt-1 text-xs text-white/50">
            Checking available sources
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl bg-black text-center">
        <p className="text-base font-medium text-white">
          Unable to start playback
        </p>

        <p className="mt-2 max-w-md px-6 text-sm text-white/50">
          No authorized playback source is
          currently available.
        </p>

        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
        >
          Try again
        </button>
      </div>
    );
  }

  if (
    state !== "ready" ||
    !selectedSource
  ) {
    return null;
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe
        key={selectedSource.id}
        src={selectedSource.url}
        title={title}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />

      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white/70 backdrop-blur">
        RyuFlix Auto
      </div>
    </div>
  );
          }
