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
    id: number;
    season: number;
    episode: number;
  }>
> = ({ params }) => {
  const { id, season, episode } = use(params);

  const {
    data: tv,
    isPending: isPendingTv,
    error: errorTv,
  } = useQuery({
    queryFn: () => tmdb.tvShows.details(id),
    queryKey: ["tv-show-player-details", id],
  });

  const {
    data: seasonDetail,
    isPending: isPendingSeason,
    error: errorSeason,
  } = useQuery({
    queryFn: () => tmdb.tvShows.season(id, season),
    queryKey: ["tv-show-season", id, season],
  });

  const [startAt, setStartAt] = useState(0);

  useEffect(() => {
    setStartAt(getTvShowLastPosition(id, season, episode));
  }, [id, season, episode]);

  if (isPendingTv || isPendingSeason) {
    return (
      <Spinner
        size="lg"
        className="absolute-center"
        color="warning"
        variant="simple"
      />
    );
  }

  if (!seasonDetail || !tv || errorTv || errorSeason) {
    return notFound();
  }

  const EPISODE = seasonDetail.episodes.find(
    (entry) =>
      entry.episode_number.toString() === episode.toString(),
  );

  if (!EPISODE) {
    return notFound();
  }

  const now = new Date();

  const isNotReleased =
    !EPISODE.air_date ||
    new Date(EPISODE.air_date) > now;

  if (isNotReleased) {
    return notFound();
  }

  const currentEpisodeIndex = seasonDetail.episodes.findIndex(
    (entry) =>
      entry.episode_number === EPISODE.episode_number,
  );

  /*
   * Find the next RELEASED episode in the current season.
   *
   * We don't simply use index + 1 because the next episode
   * may exist in TMDB but have a future air date.
   */
  const sameSeasonNextEpisode =
    seasonDetail.episodes
      .slice(currentEpisodeIndex + 1)
      .filter(
        (entry) =>
          entry.air_date &&
          new Date(entry.air_date) <= now,
      )
      .sort(
        (a, b) =>
          a.episode_number - b.episode_number,
      )[0] ?? null;

  /*
   * Find the previous RELEASED episode in the current season.
   */
  const sameSeasonPreviousEpisode =
    seasonDetail.episodes
      .slice(0, currentEpisodeIndex)
      .filter(
        (entry) =>
          entry.air_date &&
          new Date(entry.air_date) <= now,
      )
      .sort(
        (a, b) =>
          b.episode_number - a.episode_number,
      )[0] ?? null;

  /*
   * We only need the next season when there isn't
   * another released episode in this season.
   */
  const hasNextSeason =
    !sameSeasonNextEpisode &&
    season < (tv.number_of_seasons ?? 0);

  const {
    data: nextSeasonDetail,
    isPending: isPendingNextSeason,
  } = useQuery({
    queryFn: () =>
      tmdb.tvShows.season(id, season + 1),
    queryKey: [
      "tv-show-next-season",
      id,
      season + 1,
    ],
    enabled: hasNextSeason,
  });

  /*
   * First RELEASED episode of the next season.
   *
   * Sorting makes this reliable even if TMDB doesn't return
   * episodes in perfect numerical order.
   */
  const nextSeasonEpisode =
    hasNextSeason && nextSeasonDetail?.episodes
      ? nextSeasonDetail.episodes
          .filter(
            (entry) =>
              entry.air_date &&
              new Date(entry.air_date) <= now,
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

  /*
   * If we're on S2E1, look backwards into S1.
   *
   * We only query the previous season when there isn't
   * already a previous episode in the current season.
   */
  const hasPreviousSeason =
    !sameSeasonPreviousEpisode &&
    season > 1;

  const {
    data: previousSeasonDetail,
    isPending: isPendingPreviousSeason,
  } = useQuery({
    queryFn: () =>
      tmdb.tvShows.season(id, season - 1),
    queryKey: [
      "tv-show-previous-season",
      id,
      season - 1,
    ],
    enabled: hasPreviousSeason,
  });

  /*
   * Last RELEASED episode of the previous season.
   */
  const previousSeasonEpisode =
    hasPreviousSeason &&
    previousSeasonDetail?.episodes
      ? previousSeasonDetail.episodes
          .filter(
            (entry) =>
              entry.air_date &&
              new Date(entry.air_date) <= now,
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

  const nextEpisodeNumber =
    nextEpisode?.episode_number ?? null;

  const nextEpisodeSeason =
    nextEpisode?.season_number ?? null;

  const prevEpisodeNumber =
    previousEpisode?.episode_number ?? null;

  const prevEpisodeSeason =
    previousEpisode?.season_number ?? null;

  return (
    <TvShowPlayer
      tv={tv}
      id={id}
      seriesName={tv.name}
      seasonName={seasonDetail.name}
      episode={EPISODE}
      episodes={seasonDetail.episodes}
      nextEpisodeNumber={nextEpisodeNumber}
      nextEpisodeSeason={nextEpisodeSeason}
      prevEpisodeNumber={prevEpisodeNumber}
      prevEpisodeSeason={prevEpisodeSeason}
      startAt={startAt}
      nextSeasonLoading={
        isPendingNextSeason
      }
      nextEpisode={nextEpisode}
    />
  );
};

export default TvShowPlayerPage;
