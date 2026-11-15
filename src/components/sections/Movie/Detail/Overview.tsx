
"use client";

import Link from "next/link";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { AppendToResponse } from "tmdb-ts/dist/types/options";
import { Cast } from "tmdb-ts/dist/types/credits";

import {
  getImageUrl,
  movieDurationString,
  mutateMovieTitle,
} from "@/utils/movies";

import BookmarkButton from "@/components/ui/button/BookmarkButton";
import ShareButton from "@/components/ui/button/ShareButton";
import Rating from "@/components/ui/other/Rating";
import Genres from "@/components/ui/other/Genres";
import Trailer from "@/components/ui/overlay/Trailer";

import { SavedMovieDetails } from "@/types/movie";
import { FaCirclePlay } from "react-icons/fa6";
import { Calendar, Clock } from "@/utils/icons";
import { Button, Chip } from "@heroui/react";

type MovieDetailData = AppendToResponse<
  MovieDetails,
  ("videos" | "credits" | "images")[],
  "movie"
>;

interface OverviewSectionProps {
  movie: MovieDetailData;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  movie,
}) => {
  const title = mutateMovieTitle(movie);

  const releaseYear = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : null;

  const backdropImage = getImageUrl(
    movie.backdrop_path,
    "backdrop",
    true,
  );

  const posterImage = getImageUrl(
    movie.poster_path,
  );

  const titleImage = getImageUrl(
    movie.images.logos.find(
      (logo) => logo.iso_639_1 === "en",
    )?.file_path,
    "title",
  );

  const casts = (movie.credits.cast as Cast[])
    .filter((cast) => cast.profile_path)
    .slice(0, 6);

  const bookmarkData: SavedMovieDetails = {
    type: "movie",
    adult: movie.adult,
    backdrop_path: movie.backdrop_path,
    id: movie.id,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    title,
    vote_average: movie.vote_average,
    saved_date: new Date().toISOString(),
  };

  return (
    <section
      id="overview"
      className="relative z-3 w-full overflow-hidden bg-[#09090b]"
    >
      <div className="grid min-h-[680px] grid-cols-1 lg:min-h-[760px] lg:grid-cols-[1.08fr_0.92fr]">
        {/* CINEMATIC IMAGE SIDE */}
        <div className="relative min-h-[54svh] overflow-hidden bg-[#111114] sm:min-h-[620px] lg:min-h-[760px]">
          {backdropImage && (
            <img
              src={backdropImage}
              alt={title}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          )}

          {/* Image treatment */}
          <div className="absolute inset-0 bg-black/15" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-black/35 lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#111114]/70" />

          <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#09090b]/90 to-transparent lg:h-[35%]" />

          {/* Film title */}
          <div className="absolute inset-x-0 bottom-12 z-10 flex flex-col items-center px-6 text-center sm:bottom-16 lg:bottom-16 lg:items-start lg:px-12 lg:text-left xl:px-16">
            {titleImage ? (
              <img
                src={titleImage}
                alt={title}
                className="max-h-24 w-[min(85%,520px)] object-contain object-center drop-shadow-[0_8px_30px_rgba(0,0,0,0.65)] lg:object-left"
              />
            ) : (
              <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white drop-shadow-xl sm:text-5xl lg:text-6xl">
                {title}
              </h1>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-white/70 lg:justify-start">
              {releaseYear && <span>{releaseYear}</span>}

              {movie.runtime > 0 && (
                <>
                  <span className="text-white/30">•</span>
                  <span>
                    {movieDurationString(movie.runtime)}
                  </span>
                </>
              )}

              <span className="text-white/30">•</span>

              <Rating rate={movie.vote_average || 0} />
            </div>
          </div>
        </div>

        {/* INFORMATION SIDE */}
        <div className="relative z-10 -mt-7 flex min-w-0 flex-col border-t border-white/[0.08] bg-[#111114] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 lg:mt-0 lg:border-l lg:border-t-0 lg:border-white/[0.07] lg:bg-gradient-to-br lg:from-[#202022] lg:via-[#171719] lg:to-[#101012] lg:px-9 lg:py-12 xl:px-14 xl:py-16">
          {/* Subtle ambient lighting */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.055),transparent_55%)]" />

          <div className="relative flex min-w-0 flex-1 flex-col">
            {/* Movie identity */}
            <div className="flex items-start gap-5 sm:gap-6">
              {posterImage && (
                <div className="hidden w-[104px] shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl sm:block lg:w-[120px]">
                  <img
                    src={posterImage}
                    alt={title}
                    className="aspect-[2/3] h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
                    Feature Film
                  </span>

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

                <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-[2rem] xl:text-4xl">
                  {title}
                </h1>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-white/50 sm:text-sm">
                  {movie.runtime > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={15} />
                      {movieDurationString(movie.runtime)}
                    </span>
                  )}

                  {releaseYear && (
                    <>
                      <span className="text-white/20">•</span>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={15} />
                        {releaseYear}
                      </span>
                    </>
                  )}

                  <span className="text-white/20">•</span>

                  <span className="font-semibold text-amber-400">
                    ★ {movie.vote_average?.toFixed(1) ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Genres */}
            <div className="mt-7">
              <Genres genres={movie.genres} />
            </div>

            {/* Actions */}
            <div
              id="action"
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button
                as={Link}
                href={`/movie/${movie.id}/player`}
                color="primary"
                size="lg"
                radius="lg"
                className="h-12 min-w-[145px] px-5 font-semibold shadow-lg shadow-primary/20"
                startContent={
                  <FaCirclePlay size={19} />
                }
              >
                Watch Now
              </Button>

              <Trailer videos={movie.videos.results} />

              <div className="flex items-center gap-2">
                <ShareButton
                  id={movie.id}
                  title={title}
                />

                <BookmarkButton data={bookmarkData} />
              </div>
            </div>

            {/* Storyline */}
            <div className="mt-10 border-t border-white/[0.09] pt-7 lg:mt-12">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-5 w-[3px] rounded-full bg-white/75" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/85">
                  Synopsis
                </h2>
              </div>

              <p className="max-w-2xl text-sm leading-7 text-white/55 sm:text-[15px] sm:leading-8">
                {movie.overview ||
                  "No overview is available for this movie."}
              </p>
            </div>

            {/* Cast preview */}
            {casts.length > 0 && (
              <div className="mt-9 border-t border-white/[0.09] pt-7">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/85">
                    Starring
                  </h2>

                  <span className="text-[11px] text-white/35">
                    {casts.length} featured
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-3">
                  {casts.map((cast) => (
                    <div
                      key={cast.id}
                      className="flex min-w-0 items-center gap-2.5"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.06] sm:h-11 sm:w-11">
                        <img
                          src={getImageUrl(
                            cast.profile_path,
                            "avatar",
                          )}
                          alt={cast.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-white/80 sm:text-xs">
                          {cast.name}
                        </p>

                        <p className="mt-0.5 truncate text-[10px] text-white/35">
                          {cast.character}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
