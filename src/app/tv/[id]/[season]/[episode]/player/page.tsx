"use client";

import { tmdb } from "@/api/tmdb";
import { Params } from "@/types";
import {
  getTvShowLastPosition,
} from "@/utils/localStorage";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import {
  use,
  useEffect,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { NextPage } from "next";

const TvShowPlayer = dynamic(
  () =>
    import(
      "@/components/sections/TV/Player/Player"
    ),
);

const TvShowPlayerPage: NextPage<
  Params<{
    id: number;
    season: number;
    episode: number;
  }>
> = ({ params }) => {
  const {
    id,
    season,
    episode,
  } = use(params);

  const {
    data: tv,
    isPending: isPendingTv,
    error: errorTv,
  } = useQuery({
    queryFn: () =>
      tmdb.tvShows.details(id),
    queryKey: [
      "tv-show-player-details",
      id,
    ],
  });

  const {
    data: seasonDetail,
    isPending: isPendingSeason,
    error: errorSeason,
  } = useQuery({
    queryFn: () =>
      tmdb.tvShows.season(
        id,
        season,
      ),
    queryKey: [
      "tv-show-season",
      id,
      season,
    ],
  });

  const [startAt, setStartAt] =
    useState(0);

  useEffect(() => {
    setStartAt(
      getTvShowLastPosition(
        id,
        season,
        episode,
      ),
    );
  }, [
    id,
    season,
    episode,
  ]);

  if (
    isPendingTv ||
    isPendingSeason
  ) {
    return (
      <Spinner
        size="lg"
        className="absolute-center"
        color="warning"
        variant="simple"
      />
    );
  }

  if (
    !seasonDetail ||
    !tv ||
    errorTv ||
    errorSeason
  ) {
    return notFound();
  }

  const EPISODE =
    seasonDetail.episodes.find(
      (entry) =>
        entry.episode_number.toString() ===
        episode.toString(),
    );

  if (!EPISODE) {
    return notFound();
  }

  const isNotReleased =
    new Date(
      EPISODE.air_date,
    ) > new Date();

  if (isNotReleased) {
    return notFound();
  }

  const currentEpisodeIndex =
    seasonDetail.episodes.findIndex(
      (entry) =>
        entry.episode_number ===
        EPISODE.episode_number,
    );

  /*
   * Normal next episode inside
   * the current season.
   */
  const sameSeasonNextEpisode =
    currentEpisodeIndex <
    seasonDetail.episodes.length - 1
      ? seasonDetail.episodes[
          currentEpisodeIndex + 1
        ]
      : null;

  /*
   * If this is the final episode of
   * the season, look at the first
   * episode of the next season.
   *
   * We use the show's actual
   * number_of_seasons so we never
   * blindly request seasons forever.
   */
  const hasNextSeason =
    !sameSeasonNextEpisode &&
    season <
      (tv.number_of_seasons ?? 0);

  const {
    data: nextSeasonDetail,
    isPending: isPendingNextSeason,
  } = useQuery({
    queryFn: () =>
      tmdb.tvShows.season(
        id,
        season + 1,
      ),
    queryKey: [
      "tv-show-next-season",
      id,
      season + 1,
    ],
    enabled: hasNextSeason,
  });

  const nextSeasonEpisode =
    hasNextSeason &&
    nextSeasonDetail?.episodes
      ? nextSeasonDetail.episodes.find(
          (entry) =>
            new Date(
              entry.air_date,
            ) <= new Date(),
        )
      : null;

  const nextEpisode =
    sameSeasonNextEpisode ??
    nextSeasonEpisode ??
    null;

  /*
   * Only expose a next episode if
   * it has actually been released.
   */
  const nextEpisodeNumber =
    nextEpisode &&
    new Date(
      nextEpisode.air_date,
    ) <= new Date()
      ? nextEpisode.episode_number
      : null;

  const nextEpisodeSeason =
    nextEpisode &&
    new Date(
      nextEpisode.air_date,
    ) <= new Date()
      ? nextEpisode.season_number
      : null;

  const prevEpisodeNumber =
    currentEpisodeIndex > 0
      ? seasonDetail.episodes[
          currentEpisodeIndex - 1
        ].episode_number
      : null;

  const prevEpisodeSeason =
    prevEpisodeNumber !== null
      ? season
      : null;

  return (
    <TvShowPlayer
      tv={tv}
      id={id}
      seriesName={tv.name}
      seasonName={seasonDetail.name}
      episode={EPISODE}
      episodes={seasonDetail.episodes}
      nextEpisodeNumber={
        nextEpisodeNumber
      }
      nextEpisodeSeason={
        nextEpisodeSeason
      }
      prevEpisodeNumber={
        prevEpisodeNumber
      }
      prevEpisodeSeason={
        prevEpisodeSeason
      }
      startAt={startAt}
      nextSeasonLoading={
        isPendingNextSeason
      }
      nextEpisode={
        nextEpisode
      }
    />
  );
};

export default TvShowPlayerPage;
