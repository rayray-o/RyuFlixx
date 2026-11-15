
"use client";

import { siteConfig } from "@/config/site";
import { cn } from "@/utils/helpers";
import { getTvShowPlayers } from "@/utils/players";
import { setTvContinuation } from "@/utils/localStorage";
import {
  useDisclosure,
  useDocumentTitle,
} from "@mantine/hooks";
import dynamic from "next/dynamic";
import { parseAsInteger, useQueryState } from "nuqs";
import { memo, useCallback, useRef } from "react";
import type { Episode, TvShowDetails } from "tmdb-ts";
import { SpacingClasses } from "@/utils/constants";
import { usePlayerEvents } from "@/hooks/usePlayerEvents";
import WatchPlayer from "@/components/WatchPlayer";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@/utils/icons";

const TvShowPlayerHeader = dynamic(() => import("./Header"));

const TvShowPlayerEpisodeSelection = dynamic(
  () => import("./EpisodeSelection"),
);

export interface TvShowPlayerProps {
  tv: TvShowDetails;
  id: number;
  seriesName: string;
  seasonName: string;
  episode: Episode;
  episodes: Episode[];
  nextEpisodeNumber: number | null;
  nextEpisodeSeason: number | null;
  prevEpisodeNumber: number | null;
  prevEpisodeSeason: number | null;
  startAt?: number;
  nextSeasonLoading?: boolean;
  nextEpisode?: Episode | null;
}

const TvShowPlayer: React.FC<TvShowPlayerProps> = ({
  tv,
  id,
  episode,
  episodes,
  startAt = 0,
  nextEpisode,
  ...props
}) => {
  const router = useRouter();

  const [episodeOpened, episodeHandlers] =
    useDisclosure(false);

  const [selectedSource, setSelectedSource] =
    useQueryState<number>(
      "src",
      parseAsInteger.withDefault(0),
    );

  const playerFrameRef =
    useRef<HTMLIFrameElement | null>(null);

  const transitioningRef = useRef(false);

  const players = getTvShowPlayers(
    id,
    episode.season_number,
    episode.episode_number,
    startAt,
  );

  const {
    getCurrentTime,
    flushProgress,
  } = usePlayerEvents({
    saveHistory: true,
    playerFrameRef,
    metadata: {
      mediaId: id,
      mediaType: "tv",
      title: tv.name,
      backdrop_path: tv.backdrop_path ?? "",
      poster_path: tv.poster_path ?? undefined,
      release_date: tv.first_air_date ?? "",
      vote_average: tv.vote_average ?? 0,
      season: episode.season_number,
      episode: episode.episode_number,
      expectedDuration:
        episode.runtime && episode.runtime > 0
          ? episode.runtime * 60
          : undefined,
    },

    onEnded: useCallback(() => {
      if (transitioningRef.current) return;

      if (!nextEpisode) {
        setTvContinuation({
          mediaId: id,
          season: episode.season_number,
          episode: episode.episode_number,
        });
        return;
      }

      transitioningRef.current = true;

      setTvContinuation({
        mediaId: id,
        season: nextEpisode.season_number,
        episode: nextEpisode.episode_number,
      });

      router.push(
        `/tv/${id}/${nextEpisode.season_number}/${nextEpisode.episode_number}/player?src=${selectedSource}`,
      );
    }, [
      id,
      episode,
      nextEpisode,
      router,
      selectedSource,
    ]),
  });

  useDocumentTitle(
    `Play ${props.seriesName} - ${props.seasonName} - ${episode.name} | ${siteConfig.name}`,
  );

  const safeSelectedSource =
    players.length > 0
      ? Math.min(
          Math.max(selectedSource, 0),
          players.length - 1,
        )
      : 0;

  return (
    <>
      <div
        className={cn(
          "relative flex w-screen max-w-none flex-col sm:w-full",
          SpacingClasses.reset,
        )}
      >
        {/* Video and original-position back overlay */}
        <div className="relative w-full">
          <WatchPlayer
            title={`${props.seriesName} — ${props.seasonName} — ${episode.name}`}
            servers={players}
            selectedServer={safeSelectedSource}
            onServerChange={setSelectedSource}
            getCurrentTime={getCurrentTime}
            flushProgress={flushProgress}
            iframeRef={playerFrameRef}
            serverMemoryKey={`tv:${id}:s${episode.season_number}:e${episode.episode_number}`}
            serverFallbackMemoryKey={`tv:${id}`}
            resumeAt={startAt}
          />

          <Link
            href={`/tv/${id}`}
            aria-label="Back to show"
            className="absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/90 shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-black/65 active:scale-95 sm:left-4 sm:top-4"
          >
            <ArrowLeft size={21} />
          </Link>
        </div>

        {/* Episode information and navigation */}
        <TvShowPlayerHeader
          id={id}
          episode={episode}
          selectedSource={safeSelectedSource}
          onOpenEpisode={episodeHandlers.open}
          {...props}
        />
      </div>

      <TvShowPlayerEpisodeSelection
        id={id}
        opened={episodeOpened}
        onClose={episodeHandlers.close}
        episodes={episodes}
        currentSeason={episode.season_number}
        totalSeasons={tv.number_of_seasons ?? 1}
      />
    </>
  );
};

export default memo(TvShowPlayer);
