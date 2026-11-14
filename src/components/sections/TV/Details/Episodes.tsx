
"use client";

import { tmdb } from "@/api/tmdb";
import { cn, formatDate, isEmpty } from "@/utils/helpers";
import { PlayOutline } from "@/utils/icons";
import {
  getLoadingLabel,
  movieDurationString,
} from "@/utils/movies";

import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { memo, useMemo } from "react";
import { Episode } from "tmdb-ts/dist/types/tv-episode";

interface TvShowEpisodesSelectionProps {
  id: number;
  seasonNumber: number;
  filters?: {
    searchQuery?: string;
    sortedByName?: boolean;
    layout?: "list" | "grid";
  };
}

interface EpisodeCardProps {
  id: number;
  episode: Episode;
  order?: number;
  withAnimation?: boolean;
}

function isEpisodeUnavailable(episode: Episode): boolean {
  if (!episode.air_date) return true;

  const releaseDate = new Date(`${episode.air_date}T00:00:00`);

  return releaseDate > new Date();
}

/**
 * Use HTTPS for TMDB stills.
 * The old image helper returned HTTP URLs, which can be blocked
 * as mixed content when RyuFlixx is opened over HTTPS.
 */
function getEpisodeImage(path: string | null): string | null {
  if (!path) return null;

  return `https://image.tmdb.org/t/p/w780${path}`;
}

function EpisodeArtwork({
  episode,
}: {
  episode: Episode;
}) {
  const image = getEpisodeImage(episode.still_path);

  return (
    <div className="relative aspect-video h-full min-w-0 overflow-hidden bg-[#252529]">
      {image ? (
        <img
          src={image}
          alt={episode.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 -z-0 flex items-center justify-center bg-gradient-to-br from-white/[0.07] to-black/40">
        <span className="text-xs font-semibold tracking-[0.2em] text-white/20">
          EPISODE
        </span>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      <span className="absolute bottom-3 left-3 flex h-8 min-w-8 items-center justify-center rounded-lg border border-white/15 bg-black/65 px-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
        {episode.episode_number}
      </span>

      <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/65 px-2.5 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
        {movieDurationString(episode.runtime)}
      </span>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl backdrop-blur-md">
          <PlayOutline className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

const TvShowEpisodesSelection: React.FC<
  TvShowEpisodesSelectionProps
> = ({
  id,
  seasonNumber,
  filters: {
    searchQuery = "",
    sortedByName = false,
    layout = "list",
  } = {},
}) => {
  const { data, isPending, isError } = useQuery({
    queryKey: ["tv-show-episodes", id, seasonNumber],
    queryFn: () => tmdb.tvShows.season(id, seasonNumber),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 45,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const episodes = useMemo(() => {
    if (!data?.episodes) return [];

    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filtered = data.episodes.filter((episode) => {
      if (!normalizedSearch) return true;

      return (
        episode.name.toLowerCase().includes(normalizedSearch) ||
        episode.overview?.toLowerCase().includes(normalizedSearch) ||
        `episode ${episode.episode_number}`.includes(normalizedSearch)
      );
    });

    if (sortedByName) {
      filtered.sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    return filtered;
  }, [data?.episodes, searchQuery, sortedByName]);

  if (isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner
          variant="simple"
          size="lg"
          color="warning"
          label={getLoadingLabel()}
        />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold text-white/85">
          Episodes couldn't be loaded.
        </p>
        <p className="text-sm text-white/40">
          Try selecting the season again.
        </p>
      </div>
    );
  }

  if (isEmpty(episodes)) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p className="text-center text-sm text-white/40">
          No episodes found.
        </p>
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {episodes.map((episode) => (
          <EpisodeGridCard
            key={episode.id}
            episode={episode}
            id={id}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {episodes.map((episode, index) => (
        <EpisodeListCard
          key={episode.id}
          episode={episode}
          order={index + 1}
          id={id}
          withAnimation={false}
        />
      ))}
    </div>
  );
};

export const EpisodeListCard: React.FC<EpisodeCardProps> = memo(
  ({ episode, id }) => {
    const unavailable = isEpisodeUnavailable(episode);

    const href = `/tv/${id}/${episode.season_number}/${episode.episode_number}/player`;

    const content = (
      <>
        <div className="relative min-w-0 overflow-hidden">
          <EpisodeArtwork episode={episode} />
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-2 p-3 sm:gap-2.5 sm:p-5">
          <p
            title={episode.name}
            className="line-clamp-2 text-sm font-semibold leading-snug text-white transition-colors duration-150 group-hover:text-warning sm:text-base"
          >
            {episode.name}
          </p>

          <p className="text-[11px] font-medium tracking-wide text-white/40 sm:text-xs">
            {formatDate(episode.air_date, "en-US")}
          </p>

          <p
            title={episode.overview}
            className="line-clamp-2 text-xs leading-relaxed text-white/50 sm:text-sm"
          >
            {episode.overview || "No episode description available."}
          </p>

          {unavailable && (
            <span className="mt-1 w-fit rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
              Coming soon
            </span>
          )}
        </div>
      </>
    );

    const className = cn(
      "group grid min-w-0 grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1b1b1f] transition-[border-color,background-color,transform] duration-200",
      unavailable
        ? "cursor-not-allowed opacity-55"
        : "cursor-pointer hover:border-white/20 hover:bg-[#222226] active:scale-[0.995]",
    );

    if (unavailable) {
      return (
        <div
          aria-disabled="true"
          className={className}
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        href={href}
        className={className}
      >
        {content}
      </Link>
    );
  },
);

EpisodeListCard.displayName = "EpisodeListCard";

const EpisodeGridCard: React.FC<EpisodeCardProps> = memo(
  ({ episode, id }) => {
    const unavailable = isEpisodeUnavailable(episode);

    const href = `/tv/${id}/${episode.season_number}/${episode.episode_number}/player`;

    const content = (
      <>
        <EpisodeArtwork episode={episode} />

        <div className="flex min-w-0 flex-col gap-2 p-3 sm:p-4">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white transition-colors group-hover:text-warning sm:text-base">
            {episode.name}
          </p>

          <p className="text-[11px] text-white/40 sm:text-xs">
            {formatDate(episode.air_date, "en-US")}
          </p>

          <p className="line-clamp-3 text-xs leading-relaxed text-white/50 sm:text-sm">
            {episode.overview || "No episode description available."}
          </p>

          {unavailable && (
            <span className="mt-1 w-fit rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
              Coming soon
            </span>
          )}
        </div>
      </>
    );

    const className = cn(
      "group min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1b1b1f] transition-[border-color,background-color,transform] duration-200",
      unavailable
        ? "cursor-not-allowed opacity-55"
        : "cursor-pointer hover:border-white/20 hover:bg-[#222226] active:scale-[0.995]",
    );

    if (unavailable) {
      return (
        <div
          aria-disabled="true"
          className={className}
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        href={href}
        className={className}
      >
        {content}
      </Link>
    );
  },
);

EpisodeGridCard.displayName = "EpisodeGridCard";

export default memo(TvShowEpisodesSelection);
