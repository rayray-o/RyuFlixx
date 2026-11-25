
"use client";

import { useEffect, useState } from "react";
import { Image, Chip, Button } from "@heroui/react";
import {
  getImageUrl,
  movieDurationString,
  mutateMovieTitle,
} from "@/utils/movies";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import DetailFeedback from "@/components/ui/button/DetailFeedback";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import Rating from "../../../ui/other/Rating";
import ShareButton from "@/components/ui/button/ShareButton";
import { AppendToResponse } from "tmdb-ts/dist/types/options";
import { useDocumentTitle } from "@mantine/hooks";
import { siteConfig } from "@/config/site";
import { FaCirclePlay } from "react-icons/fa6";
import Genres from "@/components/ui/other/Genres";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Trailer from "@/components/ui/overlay/Trailer";
import { Calendar, Clock } from "@/utils/icons";
import Link from "next/link";
import { SavedMovieDetails } from "@/types/movie";

interface OverviewSectionProps {
  movie: AppendToResponse<MovieDetails, "videos"[], "movie">;
}

function parseReleaseDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function hasReleased(date: Date | null): boolean {
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date.getTime() <= today.getTime();
}

function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ movie }) => {
  const releaseDate = parseReleaseDate(movie.release_date);
  const releaseYear = releaseDate?.getFullYear() ?? null;

  const [releaseClock, setReleaseClock] = useState(0);

  useEffect(() => {
    if (!releaseDate) return;

    const delay = releaseDate.getTime() - Date.now();

    if (delay <= 0) return;

    const timer = window.setTimeout(
      () => setReleaseClock((value) => value + 1),
      Math.min(delay + 100, 2147480000),
    );

    return () => window.clearTimeout(timer);
  }, [movie.release_date, releaseClock]);

  const isReleased = hasReleased(releaseDate);

  const posterImage = getImageUrl(movie.poster_path);
  const title = mutateMovieTitle(movie);
  const fullTitle = title;

  const bookmarkData: SavedMovieDetails = {
    type: "movie",
    adult: movie.adult,
    backdrop_path: movie.backdrop_path,
    id: movie.id,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    title: fullTitle,
    vote_average: movie.vote_average,
    saved_date: new Date().toISOString(),
  };

  useDocumentTitle(`${fullTitle} | ${siteConfig.name}`);

  return (
    <section
      id="overview"
      className="relative z-3 flex flex-col gap-12 pt-[40vh] md:pt-[48vh] lg:pt-[54vh]"
    >
      <div className="px-4 md:px-0">
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-background/55 p-4 shadow-2xl backdrop-blur-xl md:p-6 lg:p-7">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/[0.045] via-transparent to-transparent" />

          <div className="relative md:grid md:grid-cols-[210px_1fr] md:gap-7 lg:grid-cols-[230px_1fr] lg:gap-9">
            <div className="hidden md:block">
              <Image
                isBlurred
                shadow="lg"
                alt={fullTitle}
                classNames={{
                  wrapper:
                    "aspect-2/3 w-full overflow-hidden rounded-2xl",
                }}
                className="h-full w-full object-cover object-center"
                src={posterImage}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-7">
              <div
                id="title"
                className="flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip
                    color="primary"
                    variant="faded"
                    size="sm"
                    classNames={{
                      content: "font-bold",
                    }}
                  >
                    Movie
                  </Chip>

                  {movie.adult && (
                    <Chip
                      color="danger"
                      variant="faded"
                      size="sm"
                    >
                      18+
                    </Chip>
                  )}
                </div>

                <h1 className="max-w-4xl text-3xl font-black tracking-tight md:text-4xl lg:text-5xl">
                  {fullTitle}
                </h1>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-foreground-500">
                  <div className="flex items-center gap-1.5">
                    <Clock />
                    <span>
                      {movieDurationString(movie?.runtime)}
                    </span>
                  </div>

                  {releaseYear !== null && (
                    <>
                      <span aria-hidden="true">•</span>
                      <div className="flex items-center gap-1.5">
                        <Calendar />
                        <span>{releaseYear}</span>
                      </div>
                    </>
                  )}

                  <span aria-hidden="true">•</span>

                  <Rating
                    rate={movie?.vote_average || 0}
                  />
                </div>

                <Genres genres={movie.genres} />
              </div>

              <DetailFeedback
                id={movie.id}
                mediaType="movie"
              />

              <div
                id="action"
                className="flex flex-wrap items-center gap-3"
              >
                {isReleased ? (
                  <Button
                    as={Link}
                    href={`/movie/${movie.id}/player`}
                    color="primary"
                    variant="shadow"
                    size="lg"
                    className="font-bold"
                    startContent={
                      <FaCirclePlay size={21} />
                    }
                  >
                    Watch Now
                  </Button>
                ) : (
                  <div className="flex min-h-12 items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning">
                    <Calendar size={18} />
                    <span>
                      {releaseDate
                        ? `Releases ${formatReleaseDate(releaseDate)}`
                        : "Release date TBA"}
                    </span>
                  </div>
                )}

                <Trailer
                  videos={movie.videos.results}
                />

                <div className="flex items-center gap-2">
                  <ShareButton
                    id={movie.id}
                    title={title}
                  />

                  <BookmarkButton
                    data={bookmarkData}
                  />
                </div>
              </div>

              <div
                id="story"
                className="max-w-4xl"
              >
                <SectionTitle>
                  Story Line
                </SectionTitle>

                <p className="mt-2 text-sm leading-7 text-foreground-500 md:text-base md:leading-8">
                  {movie.overview ||
                    "No overview is available for this movie."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
