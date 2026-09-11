"use client";

import { Image, Chip, Button } from "@heroui/react";
import {
  getImageUrl,
  movieDurationString,
  mutateMovieTitle,
} from "@/utils/movies";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
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

const OverviewSection: React.FC<OverviewSectionProps> = ({ movie }) => {
  const releaseYear = new Date(movie.release_date).getFullYear();

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
            {/* Poster */}
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

            {/* Information */}
            <div className="flex min-w-0 flex-col gap-7">
              {/* Header */}
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

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-foreground-500">
                  <div className="flex items-center gap-1.5">
                    <Clock />
                    <span>
                      {movieDurationString(movie?.runtime)}
                    </span>
                  </div>

                  <span aria-hidden="true">•</span>

                  <div className="flex items-center gap-1.5">
                    <Calendar />
                    <span>{releaseYear}</span>
                  </div>

                  <span aria-hidden="true">•</span>

                  <Rating
                    rate={movie?.vote_average || 0}
                  />
                </div>

                <Genres genres={movie.genres} />
              </div>

              {/* Actions */}
              <div
                id="action"
                className="flex flex-wrap items-center gap-3"
              >
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

              {/* Story */}
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
