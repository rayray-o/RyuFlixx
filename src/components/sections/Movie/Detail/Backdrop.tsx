"use client";

import { Image } from "@heroui/image";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { Video } from "tmdb-ts/dist/types/credits";
import { getImageUrl } from "@/utils/movies";

type MovieWithVideos = MovieDetails & {
  videos?: {
    results?: Video[];
  };
};

interface BackdropSectionProps {
  movie: MovieWithVideos;
}

const BackdropSection: React.FC<BackdropSectionProps> = ({ movie }) => {
  const backdropImage = getImageUrl(
    movie.backdrop_path,
    "backdrop",
    true,
  );

  const trailers =
    movie.videos?.results?.filter(
      (video) =>
        video.site === "YouTube" &&
        video.type === "Trailer" &&
        Boolean(video.key),
    ) ?? [];

  const trailer = trailers[0];

  return (
    <section
      id="backdrop"
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[68vh] overflow-hidden md:h-[72vh]"
    >
      {/* Trailer / fallback backdrop */}
      <div className="absolute inset-0 overflow-hidden bg-black">
        {trailer ? (
          <iframe
            key={trailer.key}
            className="absolute left-1/2 top-1/2 h-[115%] w-[205%] min-w-[205%] -translate-x-1/2 -translate-y-1/2 md:h-[125%] md:w-[180%] md:min-w-[180%]"
            src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailer.key}&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1`}
            title={`${movie.title} trailer`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
          />
        ) : (
          <Image
            radius="none"
            alt={movie.title}
            className="h-full w-full object-cover object-center"
            src={backdropImage}
          />
        )}
      </div>

      {/* Cinematic vignette */}
      <div className="absolute inset-0 bg-black/10" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.5)_100%)]" />

      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-[25%] bg-linear-to-b from-black/75 via-black/20 to-transparent" />

      {/* Large cinematic transition */}
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-linear-to-b from-transparent via-background/55 via-45% to-background" />

      {/* Final black melt */}
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-b from-transparent to-background" />
    </section>
  );
};

export default BackdropSection;
