"use client";

import { tmdb } from "@/api/tmdb";
import { getMovieLastPosition, getWatchHistory } from "@/utils/localStorage";
import MoviePlayer from "@/components/sections/Movie/Player/Player";
import { Params } from "@/types";
import { isEmpty } from "@/utils/helpers";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { NextPage } from "next";
import { notFound } from "next/navigation";
import { use, useEffect, useState } from "react";

const MoviePlayerPage: NextPage<Params<{ id: number }>> = ({ params }) => {
  const { id } = use(params);
  const [startAt, setStartAt] = useState<number | null>(null);
  const { data: movie, isPending, error } = useQuery({
    queryFn: () => tmdb.movies.details(id),
    queryKey: ["movie-player-detail", id],
  });

  // Read the latest localStorage position every time this route mounts.
  // A cached React Query result can otherwise keep an old startAt (often 0).
  useEffect(() => {
    if (!movie) return;
    const expectedDuration = movie.runtime && movie.runtime > 0 ? movie.runtime * 60 : 0;
    const saved = getWatchHistory().find((entry) => entry.key === `movie-${id}`);

    // Recover progress from older entries that were falsely clamped to a short
    // provider duration or marked completed by the old 90% heuristic.
    if (saved && expectedDuration > 0 && saved.last_position > 0 && saved.last_position < expectedDuration * 0.95) {
      const durationLooksWrong = saved.duration > 0 &&
        (saved.duration < expectedDuration * 0.55 || saved.duration > expectedDuration * 1.8);
      const falselyCompleted = saved.completed || (saved.duration > 0 && saved.last_position >= saved.duration);
      if (durationLooksWrong || falselyCompleted) {
        setStartAt(saved.last_position);
        return;
      }
    }

    setStartAt(getMovieLastPosition(id));
  }, [id, movie]);

  if (isPending || startAt === null) return <Spinner size="lg" className="absolute-center" variant="simple" />;
  if (error || isEmpty(movie)) return notFound();
  return <MoviePlayer movie={movie} startAt={startAt} />;
};

export default MoviePlayerPage;
