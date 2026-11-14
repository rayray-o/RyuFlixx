
"use client";

import { tmdb } from "@/api/tmdb";
import { cn, formatDate, isEmpty } from "@/utils/helpers";
import { PlayOutline } from "@/utils/icons";
import {
  getImageUrl,
  getLoadingLabel,
  movieDurationString,
} from "@/utils/movies";

import {
  Card,
  CardBody,
  CardFooter,
  Chip,
  Image,
  Spinner,
} from "@heroui/react";

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
        <p className="font-semibold">
          Episodes couldn't be loaded.
        </p>
        <p className="text-sm text-foreground-500">
          Please try selecting this season again.
        </p>
      </div>
    );
  }

  if (isEmpty(episodes)) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p className="text-center text-sm text-foreground-500">
          No episodes found.
        </p>
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
    <div className="grid grid-cols-1 gap-3 sm:gap-4">
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
    const imageUrl = getImageUrl(episode.still_path);
    const unavailable = isEpisodeUnavailable(episode);

    const href = !unavailable
      ? `/tv/${id}/${episode.season_number}/${episode.episode_number}/player`
      : undefined;

    return (
      <Card
        isPressable={!unavailable}
        as={(unavailable ? "div" : Link) as "a"}
        href={href}
        shadow="none"
        className={cn(
          "group grid grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] overflow-hidden rounded-2xl border border-foreground-200/80 bg-foreground-100/80 transition-[border-color,background-color] duration-200 ease-out",
          {
            "cursor-pointer hover:border-warning/70 hover:bg-foreground-200/80":
              !unavailable,
            "cursor-not-allowed opacity-55": unavailable,
          },
        )}
      >
        <div className="relative aspect-video min-h-full overflow-hidden bg-foreground-200">
          <Image
            removeWrapper
            alt={episode.name}
            src={imageUrl}
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
            className="h-full w-full rounded-none object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
          />

          {!unavailable && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/20">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                <PlayOutline className="h-5 w-5" />
              </div>
            </div>
          )}

          <Chip
            size="sm"
            color={unavailable ? "warning" : "default"}
            variant="flat"
            className={cn(
              "absolute right-2 top-2 z-10 font-semibold",
              !unavailable &&
                "border border-white/15 bg-black/55 text-white backdrop-blur-md",
            )}
          >
            {unavailable
              ? "Coming Soon"
              : movieDurationString(episode.runtime)}
          </Chip>

          <Chip
            size="sm"
            className="absolute bottom-2 left-2 z-10 min-w-9 border border-white/10 bg-black/60 text-center font-semibold text-white backdrop-blur-md"
          >
            {episode.episode_number}
          </Chip>
        </div>

        <CardBody className="flex min-w-0 flex-col justify-center gap-1.5 p-3 sm:gap-2 sm:p-4">
          <p
            title={episode.name}
            className={cn(
              "line-clamp-2 text-sm font-bold leading-snug sm:text-lg",
              !unavailable &&
                "transition-colors group-hover:text-warning",
            )}
          >
            {episode.name}
          </p>

          <p className="line-clamp-1 text-xs text-foreground-500">
            {formatDate(episode.air_date, "en-US")}
          </p>

          <p
            title={episode.overview}
            className="line-clamp-2 text-xs leading-relaxed text-foreground-500 sm:text-sm"
          >
            {episode.overview || "No episode description available."}
          </p>
        </CardBody>
      </Card>
    );
  },
);

EpisodeListCard.displayName = "EpisodeListCard";

const EpisodeGridCard: React.FC<EpisodeCardProps> = memo(
  ({ episode, id }) => {
    const imageUrl = getImageUrl(episode.still_path);
    const unavailable = isEpisodeUnavailable(episode);

    const href = !unavailable
      ? `/tv/${id}/${episode.season_number}/${episode.episode_number}/player`
      : undefined;

    return (
      <Card
        isPressable={!unavailable}
        as={(unavailable ? "div" : Link) as "a"}
        href={href}
        shadow="none"
        className={cn(
          "group overflow-hidden rounded-2xl border border-foreground-200/80 bg-foreground-100/80 transition-[border-color,background-color] duration-200 ease-out",
          {
            "cursor-pointer hover:border-warning/70 hover:bg-foreground-200/80":
              !unavailable,
            "cursor-not-allowed opacity-55": unavailable,
          },
        )}
      >
        <CardBody className="overflow-hidden p-0">
          <div className="relative aspect-video overflow-hidden bg-foreground-200">
            <Image
              removeWrapper
              alt={episode.name}
              src={imageUrl}
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
              className="h-full w-full rounded-none object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
            />

            {!unavailable && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/20">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                  <PlayOutline className="h-5 w-5" />
                </div>
              </div>
            )}

            <Chip
              size="sm"
              color={unavailable ? "warning" : "default"}
              variant="flat"
              className={cn(
                "absolute right-2 top-2 z-10 font-semibold",
                !unavailable &&
                  "border border-white/15 bg-black/55 text-white backdrop-blur-md",
              )}
            >
              {unavailable
                ? "Coming Soon"
                : movieDurationString(episode.runtime)}
            </Chip>

            <Chip
              size="sm"
              className="absolute bottom-2 left-2 z-10 min-w-9 border border-white/10 bg-black/60 text-center font-semibold text-white backdrop-blur-md"
            >
              {episode.episode_number}
            </Chip>
          </div>
        </CardBody>

        <CardFooter className="flex h-full items-start p-3 sm:p-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p
              title={episode.name}
              className={cn(
                "line-clamp-2 text-base font-bold leading-snug sm:text-lg",
                !unavailable &&
                  "transition-colors group-hover:text-warning",
              )}
            >
              {episode.name}
            </p>

            <p className="text-xs text-foreground-500">
              {formatDate(episode.air_date, "en-US")}
            </p>

            <p
              title={episode.overview}
              className="line-clamp-3 text-sm leading-relaxed text-foreground-500"
            >
              {episode.overview || "No episode description available."}
            </p>
          </div>
        </CardFooter>
      </Card>
    );
  },
);

EpisodeGridCard.displayName = "EpisodeGridCard";

export default memo(TvShowEpisodesSelection);
