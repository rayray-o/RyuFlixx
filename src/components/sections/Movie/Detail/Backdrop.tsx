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
      className="fixed inset-x-0 top-0 z-0 h-[65vh] pointer-events-none"
    >
      {/* Scroll fade */}
      <div
        className="absolute inset-0 z-30 bg-background"
        style={{ opacity }}
      />

      {/* Actual backdrop image */}
      <Image
        radius="none"
        alt={
          movie?.original_language === "id"
            ? movie?.original_title
            : movie?.title
        }
        className="absolute left-0 top-0 z-0 h-[35vh] w-screen object-cover object-center md:h-[50vh] lg:h-[70vh]"
        src={backdropImage}
      />

      {/* Soft top cinematic fade */}
      <div className="absolute inset-x-0 top-0 z-10 h-[18vh] bg-linear-to-b from-background/80 via-background/20 to-transparent" />

      {/* Side vignette */}
      <div className="absolute inset-x-0 top-0 z-10 h-[35vh] bg-[radial-gradient(ellipse_at_center,transparent_35%,hsl(var(--background)/0.35)_75%,hsl(var(--background)/0.8)_100%)] md:h-[50vh] lg:h-[70vh]" />

      {/* THE IMPORTANT PART:
          This gradient continues OUTSIDE the image itself. */}
      <div className="absolute inset-x-0 top-[22vh] z-20 h-[43vh] bg-linear-to-b from-transparent via-background/65 via-45% to-background" />

      {/* Extra-soft lower transition */}
      <div className="absolute inset-x-0 top-[32vh] z-21 h-[33vh] bg-linear-to-b from-transparent via-background/55 to-background" />

      {/* Movie title/logo */}
      <Image
        isBlurred
        radius="none"
        alt={
          movie?.original_language === "id"
            ? movie?.original_title
            : movie?.title
        }
        classNames={{
          wrapper: "absolute-center z-25 bg-transparent",
        }}
        className="w-[25vh] max-w-80 drop-shadow-xl md:w-[60vh]"
        src={titleImage}
      />
    </section>
  );
};

export default BackdropSection;
