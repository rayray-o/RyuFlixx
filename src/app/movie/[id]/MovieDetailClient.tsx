
"use client";

import { Suspense } from "react";
import { Spinner } from "@heroui/spinner";
import { Cast } from "tmdb-ts/dist/types/credits";
import { Image } from "tmdb-ts";
import dynamic from "next/dynamic";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { AppendToResponse } from "tmdb-ts/dist/types/options";

const OverviewSection = dynamic(
  () => import("@/components/sections/Movie/Detail/Overview"),
);

const CastsSection = dynamic(
  () => import("@/components/sections/Movie/Detail/Casts"),
);

const PhotosSection = dynamic(
  () => import("@/components/ui/other/PhotosSection"),
);

const RelatedSection = dynamic(
  () => import("@/components/sections/Movie/Detail/Related"),
);

type MovieDetailsWithData = AppendToResponse<
  MovieDetails,
  (
    | "images"
    | "videos"
    | "credits"
    | "keywords"
    | "recommendations"
    | "similar"
    | "reviews"
    | "watch/providers"
  )[],
  "movie"
>;

interface MovieDetailClientProps {
  movie: MovieDetailsWithData;
}

const MovieDetailClient: React.FC<
  MovieDetailClientProps
> = ({ movie }) => {
  return (
    <main className="relative z-0 min-h-screen w-full overflow-hidden bg-[#09090b]">
      <Suspense
        fallback={
          <div className="flex min-h-[70vh] items-center justify-center">
            <Spinner
              size="lg"
              variant="simple"
            />
          </div>
        }
      >
        <div className="flex w-full flex-col gap-12 pb-16 sm:gap-16 lg:gap-20">
          {/* Cinematic movie hero */}
          <OverviewSection movie={movie} />

          {/* Full cast */}
          <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-7 lg:px-12">
            <CastsSection
              casts={movie.credits.cast as Cast[]}
            />
          </div>

          {/* Movie images */}
          <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-7 lg:px-12">
            <PhotosSection
              images={movie.images.backdrops as Image[]}
            />
          </div>

          {/* Recommendations and similar titles */}
          <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-7 lg:px-12">
            <RelatedSection movie={movie} />
          </div>
        </div>
      </Suspense>
    </main>
  );
};

export default MovieDetailClient;
