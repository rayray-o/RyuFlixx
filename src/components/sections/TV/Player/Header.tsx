
"use client";

import Link from "next/link";
import { cn } from "@/utils/helpers";
import {
  List,
  Next,
  Prev,
} from "@/utils/icons";

import type { TvShowPlayerProps } from "./Player";

interface TvShowPlayerHeaderProps
  extends Omit<
    TvShowPlayerProps,
    "episodes" | "tv" | "startAt"
  > {
  selectedSource: number;
  onOpenEpisode: () => void;
}

const TvShowPlayerHeader: React.FC<
  TvShowPlayerHeaderProps
> = ({
  id,
  seriesName,
  seasonName,
  episode,
  selectedSource,
  nextEpisodeNumber,
  nextEpisodeSeason,
  prevEpisodeNumber,
  prevEpisodeSeason,
  onOpenEpisode,
}) => {
  const hasPrevious =
    Boolean(prevEpisodeNumber && prevEpisodeSeason);

  const hasNext =
    Boolean(nextEpisodeNumber && nextEpisodeSeason);

  const previousHref = hasPrevious
    ? `/tv/${id}/${prevEpisodeSeason}/${prevEpisodeNumber}/player?src=${selectedSource}`
    : undefined;

  const nextHref = hasNext
    ? `/tv/${id}/${nextEpisodeSeason}/${nextEpisodeNumber}/player?src=${selectedSource}`
    : undefined;

  const controlClass =
    "flex h-[50px] min-w-0 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.045] px-2 text-white/70 backdrop-blur-xl transition-all duration-200 hover:border-white/20 hover:bg-white/[0.09] hover:text-white active:scale-[0.97]";

  const disabledClass =
    "pointer-events-none opacity-25";

  return (
    <section className="mt-6 mb-8 w-full px-3 sm:px-0">
      {/* Episode identification */}
      <div className="mb-4 flex min-w-0 items-center gap-3 px-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white/40">
            {seriesName}
            <span className="mx-1.5 text-white/20">/</span>
            {seasonName}
          </p>

          <p className="mt-0.5 truncate text-sm font-semibold tracking-tight text-white/90 sm:text-base">
            {episode.name}
          </p>
        </div>

        <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/35">
          S{String(episode.season_number).padStart(2, "0")}
          {" · "}
          E{String(episode.episode_number).padStart(2, "0")}
        </span>
      </div>

      {/* Neutral navigation controls */}
      <div className="grid grid-cols-3 gap-2">
        {previousHref ? (
          <Link
            href={previousHref}
            aria-label="Previous episode"
            className={controlClass}
          >
            <Prev size={18} className="shrink-0" />
            <span className="truncate text-xs font-semibold sm:text-sm">
              Previous
            </span>
          </Link>
        ) : (
          <div
            aria-disabled="true"
            className={cn(controlClass, disabledClass)}
          >
            <Prev size={18} />
            <span className="truncate text-xs font-semibold sm:text-sm">
              Previous
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenEpisode}
          className={controlClass}
        >
          <List size={18} className="shrink-0" />
          <span className="truncate text-xs font-semibold sm:text-sm">
            Episodes
          </span>
        </button>

        {nextHref ? (
          <Link
            href={nextHref}
            aria-label="Next episode"
            className={controlClass}
          >
            <span className="truncate text-xs font-semibold sm:text-sm">
              Next
            </span>
            <Next size={18} className="shrink-0" />
          </Link>
        ) : (
          <div
            aria-disabled="true"
            className={cn(controlClass, disabledClass)}
          >
            <span className="truncate text-xs font-semibold sm:text-sm">
              Next
            </span>
            <Next size={18} />
          </div>
        )}
      </div>
    </section>
  );
};

export default TvShowPlayerHeader;
