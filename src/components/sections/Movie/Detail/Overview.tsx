
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

  const titleImage = getImageUrl(
    movie.images.logos.find(
      (logo) => logo.iso_639_1 === "en",
    )?.file_path,
    "title",
  );

  const casts = (movie.credits.cast as Cast[])
    .filter((cast) => cast.profile_path)
    .slice(0, 7);

  const stills = movie.images.backdrops
    .filter((image) => image.file_path)
    .slice(0, 4);

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
      className="relative isolate w-full overflow-hidden bg-[#09090b]"
    >
      {/* FULL-BLEED BACKDROP */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {backdropImage && (
          <img
            src={backdropImage}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}

        <div className="absolute inset-0 bg-black/20" />

        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-black/40" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-black/30" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_45%,transparent_0%,rgba(0,0,0,0.25)_100%)]" />
      </div>

      {/* DESKTOP COMPOSITION */}
      <div className="relative hidden min-h-[850px] w-full lg:grid lg:min-h-[calc(100svh-64px)] lg:grid-cols-[1.08fr_0.92fr] xl:min-h-[900px]">
        {/* LEFT CINEMATIC SIDE */}
        <div className="relative flex min-w-0 flex-col justify-end overflow-hidden px-12 pb-12 pt-20 xl:px-16 xl:pb-16">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/35 to-transparent" />

          <div className="relative z-10 mb-10 max-w-[680px]">
            <span className="mb-5 inline-flex rounded-full border border-white/20 bg-white/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur-md">
              Featured Film
            </span>

            {titleImage ? (
              <img
                src={titleImage}
                alt={title}
                className="mb-5 max-h-[125px] max-w-[min(90%,560px)] object-contain object-left drop-shadow-[0_10px_35px_rgba(0,0,0,0.65)]"
              />
            ) : (
              <h1 className="mb-5 max-w-2xl text-6xl font-black tracking-tight text-white xl:text-7xl">
                {title}
              </h1>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/75">
              {releaseYear && <span>{releaseYear}</span>}

              {movie.runtime > 0 && (
                <>
                  <span className="text-white/30">•</span>
                  <span>{movieDurationString(movie.runtime)}</span>
                </>
              )}

              <span className="text-white/30">•</span>

              <span className="font-semibold text-amber-400">
                ★ {movie.vote_average?.toFixed(1) ?? "—"}
              </span>
            </div>

            <div className="mt-5 max-w-xl">
              <Genres genres={movie.genres} />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                as={Link}
                href={`/movie/${movie.id}/player`}
                color="primary"
                size="lg"
                radius="lg"
                className="h-12 px-7 font-semibold shadow-lg shadow-primary/20"
                startContent={<FaCirclePlay size={19} />}
              >
                Watch Now
              </Button>

              <Trailer videos={movie.videos.results} />

              <ShareButton id={movie.id} title={title} />

              <BookmarkButton data={bookmarkData} />
            </div>
          </div>

          {/* CINEMATIC STILL STRIP */}
          {stills.length > 0 && (
            <div className="relative z-10 grid max-w-[720px] grid-cols-4 gap-3">
              {stills.map((still, index) => (
                <div
                  key={still.file_path}
                  className="group relative aspect-[16/9] overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
                >
                  <img
                    src={getImageUrl(
                      still.file_path,
                      "backdrop",
                      true,
                    )}
                    alt={`${title} still ${index + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT GLASS INFORMATION PANEL */}
        <div className="relative flex min-w-0 items-center justify-center p-7 xl:p-12">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/20 to-transparent" />

          <div className="relative w-full max-w-[620px] overflow-hidden rounded-[28px] border border-white/[0.17] bg-[#171719]/65 p-7 shadow-[0_25px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl xl:p-10">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.09] via-transparent to-transparent" />

            <div className="relative">
              {/* Panel movie image */}
              <div className="relative h-[190px] overflow-hidden rounded-xl border border-white/10 xl:h-[220px]">
                {backdropImage && (
                  <img
                    src={backdropImage}
                    alt={title}
                    loading="lazy"
                    className="h-full w-full object-cover object-center"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                <div className="absolute bottom-4 left-5 right-5">
                  <p className="text-2xl font-bold tracking-tight text-white xl:text-3xl">
                    {title}
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    Movie details
                  </p>
                </div>
              </div>

              {/* Rating */}
              <div className="mt-5 flex items-center gap-3 border-b border-white/15 pb-5">
                <Rating rate={movie.vote_average || 0} />
                <span className="text-sm font-semibold text-white/75">
                  {movie.vote_average?.toFixed(1) ?? "—"}
                </span>
                <span className="text-xs text-white/35">
                  {movie.vote_count?.toLocaleString() ?? "0"} ratings
                </span>
              </div>

              {/* Synopsis */}
              <div className="mt-6">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  About the film
                </h2>

                <p className="line-clamp-6 text-[13px] leading-7 text-white/65 xl:text-sm">
                  {movie.overview ||
                    "No overview is available for this movie."}
                </p>
              </div>

              {/* Cast */}
              {casts.length > 0 && (
                <div className="mt-8">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                      Cast
                    </h2>

                    <span className="text-[10px] text-white/35">
                      Featured performers
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                    {casts.slice(0, 8).map((cast) => (
                      <div
                        key={cast.id}
                        className="flex min-w-0 flex-col items-center text-center"
                      >
                        <div className="h-12 w-12 overflow-hidden rounded-full border border-white/20 bg-white/[0.06] xl:h-14 xl:w-14">
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

                        <p className="mt-2 w-full truncate text-[10px] font-semibold text-white/80">
                          {cast.name}
                        </p>

                        <p className="w-full truncate text-[9px] text-white/40">
                          {cast.character}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional metadata */}
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-5 text-xs text-white/45">
                {releaseYear && (
                  <span className="flex items-center gap-2">
                    <Calendar size={15} />
                    {releaseYear}
                  </span>
                )}

                {movie.runtime > 0 && (
                  <span className="flex items-center gap-2">
                    <Clock size={15} />
                    {movieDurationString(movie.runtime)}
                  </span>
                )}

                {movie.adult && (
                  <Chip color="danger" variant="faded" size="sm">
                    18+
                  </Chip>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE COMPOSITION */}
      <div className="relative flex min-h-[100svh] flex-col lg:hidden">
        {/* Full-width mobile backdrop */}
        <div className="absolute inset-x-0 top-0 h-[65svh] overflow-hidden">
          {backdropImage && (
            <img
              src={backdropImage}
              alt={title}
              fetchPriority="high"
              className="h-full w-full object-cover object-center"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-[#09090b]" />
        </div>

        {/* Mobile movie identity */}
        <div className="relative z-10 flex min-h-[43svh] flex-col justify-end px-5 pb-7 pt-20">
          {titleImage ? (
            <img
              src={titleImage}
              alt={title}
              className="max-h-[90px] max-w-[90%] object-contain object-left drop-shadow-[0_8px_25px_rgba(0,0,0,0.7)]"
            />
          ) : (
            <h1 className="max-w-lg text-4xl font-black tracking-tight text-white drop-shadow-xl">
              {title}
            </h1>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-white/75">
            {releaseYear && <span>{releaseYear}</span>}

            {movie.runtime > 0 && (
              <>
                <span className="text-white/30">•</span>
                <span>{movieDurationString(movie.runtime)}</span>
              </>
            )}

            <span className="text-white/30">•</span>

            <span className="font-semibold text-amber-400">
              ★ {movie.vote_average?.toFixed(1) ?? "—"}
            </span>
          </div>
        </div>

        {/* Mobile glass panel */}
        <div className="relative z-10 mx-3 mb-6 flex-1 overflow-hidden rounded-[25px] border border-white/[0.14] bg-[#151517]/80 p-5 shadow-[0_15px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:mx-5 sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
                Feature Film
              </span>

              {movie.adult && (
                <Chip color="danger" variant="faded" size="sm">
                  18+
                </Chip>
              )}
            </div>

            <h2 className="mt-4 text-[26px] font-bold leading-tight tracking-tight text-white sm:text-3xl">
              {title}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
              {movie.runtime > 0 && (
                <span>{movieDurationString(movie.runtime)}</span>
              )}

              {releaseYear && (
                <>
                  <span className="text-white/25">•</span>
                  <span>{releaseYear}</span>
                </>
              )}

              <span className="text-white/25">•</span>

              <span className="font-semibold text-amber-400">
                ★ {movie.vote_average?.toFixed(1) ?? "—"}
              </span>
            </div>

            <div className="mt-5">
              <Genres genres={movie.genres} />
            </div>

            {/* Mobile actions */}
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Button
                as={Link}
                href={`/movie/${movie.id}/player`}
                color="primary"
                size="lg"
                radius="lg"
                className="h-12 px-5 font-semibold shadow-lg shadow-primary/20"
                startContent={<FaCirclePlay size={18} />}
              >
                Watch Now
              </Button>

              <Trailer videos={movie.videos.results} />

              <ShareButton id={movie.id} title={title} />

              <BookmarkButton data={bookmarkData} />
            </div>

            {/* Synopsis */}
            <div className="mt-8 border-t border-white/10 pt-6">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                About the film
              </h3>

              <p className="text-[13px] leading-7 text-white/65">
                {movie.overview ||
                  "No overview is available for this movie."}
              </p>
            </div>

            {/* Cast */}
            {casts.length > 0 && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <h3 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  Cast
                </h3>

                <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
                  {casts.map((cast) => (
                    <div
                      key={cast.id}
                      className="flex min-w-0 flex-col items-center text-center"
                    >
                      <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
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

                      <p className="mt-2 w-full truncate text-[10px] font-semibold text-white/80">
                        {cast.name}
                      </p>

                      <p className="w-full truncate text-[9px] text-white/40">
                        {cast.character}
                      </p>
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
