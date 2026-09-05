"use client";

import { SpacingClasses } from "@/utils/constants";
import { siteConfig } from "@/config/site";
import useBreakpoints from "@/hooks/useBreakpoints";
import { cn } from "@/utils/helpers";
import { mutateMovieTitle } from "@/utils/movies";
import { getMoviePlayers } from "@/utils/players";
import {
  useDisclosure,
  useDocumentTitle,
  useIdle,
} from "@mantine/hooks";
import dynamic from "next/dynamic";
import {
  parseAsInteger,
  useQueryState,
} from "nuqs";
import {
  useRef,
} from "react";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { usePlayerEvents } from "@/hooks/usePlayerEvents";
import WatchPlayer from "@/components/WatchPlayer";

const MoviePlayerHeader =
  dynamic(
    () => import("./Header"),
  );

const MoviePlayerSourceSelection =
  dynamic(
    () => import("./SourceSelection"),
  );

interface MoviePlayerProps {
  movie: MovieDetails;
  startAt?: number;
}

const MoviePlayer: React.FC<
  MoviePlayerProps
> = ({
  movie,
  startAt,
}) => {
  const players =
    getMoviePlayers(
      movie.id,
      startAt,
    );

  const title =
    mutateMovieTitle(movie);

  const idle =
    useIdle(3000);

  const { mobile } =
    useBreakpoints();

  const [opened, handlers] =
    useDisclosure(false);

  const [
    selectedSource,
    setSelectedSource,
  ] = useQueryState<number>(
    "src",
    parseAsInteger.withDefault(0),
  );

  /*
   * This ref always points at the iframe
   * currently mounted by WatchPlayer.
   */
  const playerFrameRef =
    useRef<HTMLIFrameElement | null>(
      null,
    );

  const {
    getCurrentTime,
    flushProgress,
  } =
    usePlayerEvents({
      saveHistory: true,

      playerFrameRef,

      metadata: {
        mediaId: movie.id,
        mediaType: "movie",

        title,

        backdrop_path:
          movie.backdrop_path ?? "",

        poster_path:
          movie.poster_path ??
          undefined,

        release_date:
          movie.release_date ?? "",

        vote_average:
          movie.vote_average ?? 0,
      },
    });

  useDocumentTitle(
    `Play ${title} | ${siteConfig.name}`,
  );

  const safeSelectedSource =
    players.length > 0
      ? Math.min(
          Math.max(
            selectedSource,
            0,
          ),
          players.length - 1,
        )
      : 0;

  return (
    <>
      <div
        className={cn(
          "relative",
          SpacingClasses.reset,
        )}
      >
        <MoviePlayerHeader
          id={movie.id}
          movieName={title}
          onOpenSource={
            handlers.open
          }
          hidden={
            idle && !mobile
          }
        />

        <WatchPlayer
          title={title}
          servers={players}
          selectedServer={
            safeSelectedSource
          }
          onServerChange={
            setSelectedSource
          }
          getCurrentTime={
            getCurrentTime
          }
          flushProgress={
            flushProgress
          }
          iframeRef={
            playerFrameRef
          }
        />
      </div>

      <MoviePlayerSourceSelection
        opened={opened}
        onClose={handlers.close}
        players={players}
        selectedSource={
          safeSelectedSource
        }
        setSelectedSource={
          setSelectedSource
        }
      />
    </>
  );
};

MoviePlayer.displayName =
  "MoviePlayer";

export default MoviePlayer;
