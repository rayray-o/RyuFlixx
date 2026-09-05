"use client";

import { Image, Chip, Button } from "@heroui/react";
import {
  getImageUrl,
  movieDurationString,
  mutateMovieTitle,
} from "@/utils/movies";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { Video } from "tmdb-ts/dist/types/credits";
import Rating from "../../../ui/other/Rating";
import ShareButton from "@/components/ui/button/ShareButton";
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
  movie: MovieDetails & {
    videos?: {
      results?: Video[];
    };
  };
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  movie,
}) => {
  const releaseYear = new Date(movie.release_date).getFullYear();

  const title = mutateMovieTitle(movie);
  const fullTitle = title;

  const posterImage = getImageUrl(movie.poster_path);

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
      className="relative z-10 flex flex-col gap-12 pt-[46vh] md:pt-[52vh]"
    >
      <div className="flex flex-col gap-10">
        {/* Main cinematic information */}
        <div className="relative">
          {/* Subtle desktop poster */}
          <div className="hidden md:block">
            <Image
              isBlurred
              shadow="md"
              alt={fullTitle}
              classNames={{
                wrapper:
                  "absolute right-0 top-8 hidden w-44 aspect-2/3 opacity-20 xl:w-52 xl:opacity-30",
              }}
              className="object-cover object-center"
              src={posterImage}
            />
          </div>

          <div className="relative flex max-w-3xl flex-col gap-6">
            {/* Movie type */}
            <div className="flex gap-2">
              <Chip
                color="primary"
                variant="faded"
                className="text-xs md:text-sm"
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
                  className="text-xs md:text-sm"
                >
                  18+
                </Chip>
              )}
            </div>

            {/* Title + metadata */}
            <div className="flex flex-col gap-3">
              <h2 className="text-4xl font-black leading-none tracking-tight md:text-6xl lg:text-7xl">
                {fullTitle}
              </h2>

              {/* Cinematic metadata row */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/75 md:text-base">
                <div className="flex items-center gap-1.5">
                  <Clock />
                  <span>
                    {movieDurationString(movie.runtime)}
                  </span>
                </div>

                <span className="text-foreground/40">·</span>

                <div className="flex items-center gap-1.5">
                  <Calendar />
                  <span>{releaseYear}</span>
                </div>

                <span className="text-foreground/40">·</span>

                <Rating rate={movie.vote_average || 0} />
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2">
                <Genres genres={movie.genres} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                as={Link}
                href={`/movie/${movie.id}/player`}
                color="primary"
                variant="shadow"
                size="lg"
                className="font-semibold"
                startContent={<FaCirclePlay size={21} />}
              >
                Play Now
              </Button>

              <Trailer videos={movie.videos?.results ?? []} />

              <div className="flex gap-2">
                <ShareButton
                  id={movie.id}
                  title={title}
                />

                <BookmarkButton data={bookmarkData} />
              </div>
            </div>
          </div>
        </div>

        {/* Story */}
        <div
          id="story"
          className="flex max-w-3xl flex-col gap-4 pt-4 md:pt-8"
        >
          <SectionTitle>Story Line</SectionTitle>

          <p className="text-base leading-7 text-foreground/85 md:text-lg md:leading-8">
            {movie.overview}
          </p>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
