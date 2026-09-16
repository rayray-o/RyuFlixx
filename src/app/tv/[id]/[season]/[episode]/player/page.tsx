"use client";

import { tmdb } from "@/api/tmdb";
import { Params } from "@/types";
import { getTvShowLastPosition } from "@/utils/localStorage";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { NextPage } from "next";

const TvShowPlayer = dynamic(
  () => import("@/components/sections/TV/Player/Player"),
);

const TvShowPlayerPage: NextPage<
  Params<{
    id: string;
    season: string;
    episode: string;
  }>
> = ({ params }) => {
  const routeParams = use(params);

  const id = Number(routeParams.id);
  const season = Number(routeParams.season);
  const episode = Number(routeParams.episode);

  const validParams =
    Number.isInteger(id) &&
    id > 0 &&
    Number.isInteger(season) &&
    season > 0 &&
    Number.isInteger(episode) &&
    episode > 0;

  const {
    data: tv,
    isPending: isPendingTv,
    error: errorTv,
  } = useQuery({
    queryFn: () => tmdb.tvShows.details(id),
    queryKey: ["tv-show-player-details", id],
    enabled: validParams,
  });

  const {
    data: seasonDetail,
    isPending: isPendingSeason,
    error: errorSeason,
  } = useQuery({
    queryFn: () =>
      tmdb.tvShows.season(id, season),
    queryKey: [
      "tv-show-season",
      id,
      season,
    ],
    enabled: validParams,
  });

  const [startAt, setStartAt] = useState(0);

  useEffect(() => {
    if (!validParams) {
      return;
    }

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
    validParams,
  ]);

  const now = new Date();

  const EPISODE =
    seasonDetail?.episodes.find(
      (entry) =>
        entry.episode_number ===
        episode,
    ) ?? null;

  const currentEpisodeIndex =
    EPISODE
      ? seasonDetail?.episodes.findIndex(
          (entry) =>
            entry.episode_number ===
            EPISODE.episode_number,
        ) ?? -1
      : -1;

  const sameSeasonNextEpisode =
    EPISODE &&
    currentEpisodeIndex >= 0
      ? seasonDetail?.episodes
          .slice(
            currentEpisodeIndex + 1,
          )
          .filter(
            (entry) =>
              entry.air_date &&
              new Date(entry.air_date) <=
                now,
          )
          .sort(
            (a, b) =>
              a.episode_number -
              b.episode_number,
          )[0] ?? null
      : null;

  const sameSeasonPreviousEpisode =
    EPISODE &&
    currentEpisodeIndex >= 0
      ? seasonDetail?.episodes
          .slice(
            0,
            currentEpisodeIndex,
          )
          .filter(
            (entry) =>
              entry.air_date &&
              new Date(entry.air_date) <=
                now,
          )
          .sort(
            (a, b) =>
              b.episode_number -
              a.episode_number,
          )[0] ?? null
      : null;

  const hasNextSeason =
    validParams &&
    Boolean(tv) &&
    Boolean(seasonDetail) &&
    !sameSeasonNextEpisode &&
    season <
      (tv?.number_of_seasons ?? 0);

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

  const hasPreviousSeason =
    validParams &&
    Boolean(tv) &&
    Boolean(seasonDetail) &&
    !sameSeasonPreviousEpisode &&
    season > 1;

  const {
    data: previousSeasonDetail,
  } = useQuery({
    queryFn: () =>
      tmdb.tvShows.season(
        id,
        season - 1,
      ),
    queryKey: [
      "tv-show-previous-season",
      id,
      season - 1,
    ],
    enabled: hasPreviousSeason,
  });

  const nextSeasonEpisode =
    hasNextSeason &&
    nextSeasonDetail?.episodes
      ? nextSeasonDetail.episodes
          .filter(
            (entry) =>
              entry.air_date &&
              new Date(entry.air_date) <=
                now,
          )
          .sort(
            (a, b) =>
              a.episode_number -
              b.episode_number,
          )[0] ?? null
      : null;

  const nextEpisode =
    sameSeasonNextEpisode ??
    nextSeasonEpisode ??
    null;

  const previousSeasonEpisode =
    hasPreviousSeason &&
    previousSeasonDetail?.episodes
      ? previousSeasonDetail.episodes
          .filter(
            (entry) =>
              entry.air_date &&
              new Date(entry.air_date) <=
                now,
          )
          .sort(
            (a, b) =>
              b.episode_number -
              a.episode_number,
          )[0] ?? null
      : null;

  const previousEpisode =
    sameSeasonPreviousEpisode ??
    previousSeasonEpisode ??
    null;

  if (!validParams) {
    return notFound();
  }

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

  if (!EPISODE) {
    return notFound();
  }

  const isNotReleased =
    !EPISODE.air_date ||
    new Date(EPISODE.air_date) > now;

  if (isNotReleased) {
    return notFound();
  }

  const nextEpisodeNumber =
    nextEpisode?.episode_number ??
    null;

  const nextEpisodeSeason =
    nextEpisode?.season_number ??
    null;

  const prevEpisodeNumber =
    previousEpisode?.episode_number ??
    null;

  const prevEpisodeSeason =
    previousEpisode?.season_number ??
    null;

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
      nextEpisode={nextEpisode}
    />
  );
};

export default TvShowPlayerPage;
