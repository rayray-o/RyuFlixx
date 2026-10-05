"use client";

import { Suspense } from "react";
import { Spinner } from "@heroui/spinner";
import { Cast } from "tmdb-ts/dist/types/credits";
import { Image } from "tmdb-ts";
import dynamic from "next/dynamic";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { AppendToResponse } from "tmdb-ts/dist/types/options";

const PhotosSection = dynamic(
  () => import("@/components/ui/other/PhotosSection"),
);
const BackdropSection = dynamic(
  () => import("@/components/sections/Movie/Detail/Backdrop"),
);
const OverviewSection = dynamic(
  () => import("@/components/sections/Movie/Detail/Overview"),
);
const CastsSection = dynamic(
  () => import("@/components/sections/Movie/Detail/Casts"),
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
    <div className="mx-auto max-w-5xl">
      <Suspense
        fallback={
          <Spinner
            size="lg"
            className="absolute-center"
            variant="simple"
          />
        }
      >
        <div className="flex flex-col gap-10">
          <BackdropSection movie={movie} />
          <OverviewSection movie={movie} />
          <CastsSection
            casts={movie.credits.cast as Cast[]}
          />
          <PhotosSection
            images={movie.images.backdrops as Image[]}
          />
          <RelatedSection movie={movie} />
        </div>
      </Suspense>
    </div>
  );
};

export default MovieDetailClient;
