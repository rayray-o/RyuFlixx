"use client";

import { Image } from "@heroui/image";
import { useWindowScroll } from "@mantine/hooks";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { AppendToResponse } from "tmdb-ts/dist/types/options";
import { getImageUrl } from "@/utils/movies";

const BackdropSection: React.FC<{
  movie: AppendToResponse<MovieDetails, "images"[], "movie"> | undefined;
}> = ({ movie }) => {
  const [{ y }] = useWindowScroll();

  const opacity = Math.min((y / 1000) * 2, 1);

  const backdropImage = getImageUrl(
    movie?.backdrop_path,
    "backdrop",
    true
  );

  const titleImage = getImageUrl(
    movie?.images.logos.find(
      (logo) => logo.iso_639_1 === "en"
    )?.file_path,
    "title"
  );

  return (
    <section
      id="backdrop"
      className="fixed inset-0 h-[70vh]"
    >
      {/* Original scroll fade */}
      <div
        className="absolute inset-0 z-10 bg-background"
        style={{ opacity }}
      />

      {/* Original top fade */}
      <div className="absolute inset-0 z-20 bg-linear-to-b from-background from-1% via-transparent via-30%" />

      {/* Original image */}
      <Image
        isBlurred
        radius="none"
        alt={
          movie?.original_language === "id"
            ? movie?.original_title
            : movie?.title
        }
        classNames={{
          wrapper: "absolute-center z-1 bg-transparent",
        }}
        className="w-[25vh] max-w-80 drop-shadow-xl md:w-[60vh]"
        src={titleImage}
      />

      <Image
        radius="none"
        alt={
          movie?.original_language === "id"
            ? movie?.original_title
            : movie?.title
        }
        className="z-0 h-[35vh] w-screen object-cover object-center md:h-[50vh] lg:h-[70vh]"
        src={backdropImage}
      />

      {/* =========================================================
          CINEMATIC EDGE TREATMENT
          These do NOT replace or darken the actual image.
          They extend beyond the image and dissolve it into
          the page background.
         ========================================================= */}

      {/* Soft side vignette */}
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          z-30
          bg-[radial-gradient(ellipse_at_center,transparent_45%,hsl(var(--background)/0.35)_78%,hsl(var(--background))_100%)]
        "
      />

      {/* Bottom fade starts BEFORE the image ends */}
      <div
        className="
          pointer-events-none
          absolute
          inset-x-0
          top-[20vh]
          z-30
          h-[50vh]
          bg-linear-to-b
          from-transparent
          via-background/45
          via-[55%]
          to-background
        "
      />

      {/* Very soft final dissolve */}
      <div
        className="
          pointer-events-none
          absolute
          inset-x-0
          top-[38vh]
          z-31
          h-[32vh]
          bg-linear-to-b
          from-transparent
          via-background/55
          to-background
        "
      />

      {/* Keep the logo above the cinematic treatment */}
      <Image
        isBlurred
        radius="none"
        alt={
          movie?.original_language === "id"
            ? movie?.original_title
            : movie?.title
        }
        classNames={{
          wrapper: "absolute-center z-40 bg-transparent",
        }}
        className="w-[25vh] max-w-80 drop-shadow-xl md:w-[60vh]"
        src={titleImage}
      />
    </section>
  );
};

export default BackdropSection;
