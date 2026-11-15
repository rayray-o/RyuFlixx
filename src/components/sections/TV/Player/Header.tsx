
"use client";

import Link from "next/link";
import { cn } from "@/utils/helpers";
import {
  ArrowLeft,
  List,
  Next,
  Prev,
} from "@/utils/icons";

import { TvShowPlayerProps } from "./Player";

interface TvShowPlayerHeaderProps
  extends Omit<
    TvShowPlayerProps,
    "episodes" | "tv" | "startAt"
  > {
  selectedSource: number;
  onOpenEpisode: () => void;
}

const baseButton =
  "group flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.045] px-4 text-sm font-medium text-white/75 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.09] hover:text-white active:scale-[0.97]";

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

  return (
    <section className="mt-6 mb-8 w-full">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]/90 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        {/* Current episode information */}
        <div className="flex min-w-0 items-center gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
          <Link
            href={`/tv/${id}`}
            aria-label="Back to show"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/65 transition-colors hover:bg-white/[0.09] hover:text-white"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white/40">
              {seriesName} <span className="px-1">/</span>{" "}
              {seasonName}
            </p>

            <p className="mt-0.5 truncate text-sm font-semibold text-white/90 sm:text-base">
              {episode.name}
            </p>
          </div>

          <span className="hidden shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/45 sm:inline-flex">
            S{String(episode.season_number).padStart(2, "0")}
            {" · "}
            E{String(episode.episode_number).padStart(2, "0")}
          </span>
        </div>

        {/* Navigation controls */}
        <div className="grid grid-cols-3 gap-2 p-3 sm:p-4">
          {previousHref ? (
            <Link
              href={previousHref}
              className={cn(
                baseButton,
                "min-w-0",
              )}
            >
              <Prev
                size={19}
                className="shrink-0 text-white/65 transition-colors group-hover:text-white"
              />

              <span className="truncate">
                Previous
              </span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className={cn(
                baseButton,
                "min-w-0 cursor-not-allowed opacity-25",
              )}
            >
              <Prev size={19} />
              <span className="truncate">Previous</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenEpisode}
            className={cn(
              baseButton,
              "min-w-0 border-warning/20 bg-warning/[0.09] text-warning hover:border-warning/40 hover:bg-warning/[0.15] hover:text-warning",
            )}
          >
            <List size={19} className="shrink-0" />

            <span className="truncate">
              Episodes
            </span>
          </button>

          {nextHref ? (
            <Link
              href={nextHref}
              className={cn(
                baseButton,
                "min-w-0",
              )}
            >
              <span className="truncate">
                Next
              </span>

              <Next
                size={19}
                className="shrink-0 text-white/65 transition-colors group-hover:text-white"
              />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className={cn(
                baseButton,
                "min-w-0 cursor-not-allowed opacity-25",
              )}
            >
              <span className="truncate">Next</span>
              <Next size={19} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default TvShowPlayerHeader;
