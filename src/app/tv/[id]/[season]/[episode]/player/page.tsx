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

const TvShowPlayer =
  dynamic(
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
    isPending:
      isPendingSeason,
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

  const nextEpisodeNumber =
    currentEpisodeIndex <
    seasonDetail.episodes.length - 1
      ? new Date(
          seasonDetail.episodes[
            currentEpisodeIndex + 1
          ].air_date,
        ) > new Date()
        ? null
        : seasonDetail.episodes[
            currentEpisodeIndex + 1
          ].episode_number
      : null;

  const prevEpisodeNumber =
    currentEpisodeIndex > 0
      ? seasonDetail.episodes[
          currentEpisodeIndex - 1
        ].episode_number
      : null;

  return (
    <TvShowPlayer
      tv={tv}
      id={id}
      seriesName={tv.name}
      seasonName={
        seasonDetail.name
      }
      episode={EPISODE}
      episodes={
        seasonDetail.episodes
      }
      nextEpisodeNumber={
        nextEpisodeNumber
      }
      prevEpisodeNumber={
        prevEpisodeNumber
      }
      startAt={startAt}
    />
  );
};

export default TvShowPlayerPage;
