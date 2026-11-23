"use client";

import Link from "next/link";
import type { Movie, TV } from "tmdb-ts/dist/types";
import { mutateMovieTitle, mutateTvShowTitle } from "@/utils/movies";
import { cn } from "@/utils/helpers";

type CinematicMediaCardProps = {
  media: Movie | TV;
};

export default function CinematicMediaCard({
  media,
}: CinematicMediaCardProps) {
  const isMovie = "title" in media;

  const title = isMovie
    ? mutateMovieTitle(media as Movie)
    : mutateTvShowTitle(media as TV);

  const content = isMovie ? "movie" : "tv";

  const year = isMovie
    ? (media as Movie).release_date?.slice(0, 4)
    : (media as TV).first_air_date?.slice(0, 4);

  const image =
    media.backdrop_path || media.poster_path;

  const imageUrl = image
    ? `https://image.tmdb.org/t/p/w1280${image}`
    : "";

  return (
    <Link
      href={`/${content}/${media.id}`}
      className={cn(
        "group block shrink-0 text-white",
        "w-[185px] sm:w-[210px]",
        "lg:w-[270px] xl:w-[310px] 2xl:w-[350px]",
      )}
    >
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden rounded-xl",
          "border border-white/[0.07] bg-white/[0.025]",
          "transition duration-500 ease-out",
          "group-hover:-translate-y-1 group-hover:scale-[1.015] group-hover:border-white/20",
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/[0.06]">
            <span className="text-sm text-white/40">
              {title}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        <div className="absolute inset-x-3 bottom-3 md:inset-x-4 md:bottom-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white md:text-base lg:text-lg">
                {title}
              </p>

              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/60 md:text-xs">
                {content === "movie" ? "Movie" : "Series"}
                {year && ` · ${year}`}
              </p>
            </div>

            <span className="shrink-0 text-[11px] font-semibold text-white/80 md:text-sm">
              {media.vote_average?.toFixed(1) ?? "—"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
