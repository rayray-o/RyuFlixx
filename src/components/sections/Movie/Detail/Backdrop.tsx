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
      className="fixed inset-0 z-0 h-[35vh] md:h-[50vh] lg:h-[70vh] pointer-events-none overflow-hidden"
    >
      {/* Scroll fade */}
      <div
        className="absolute inset-0 z-20 bg-background"
        style={{ opacity }}
      />

      {/* Top cinematic fade */}
      <div className="absolute inset-x-0 top-0 z-10 h-[28%] bg-linear-to-b from-background via-background/50 to-transparent" />

      {/* Main bottom cinematic fade */}
      <div className="absolute inset-x-0 bottom-0 z-10 h-[55%] bg-linear-to-t from-background via-background/75 via-25% to-transparent" />

      {/* Extra-long soft transition into the page */}
      <div className="absolute inset-x-0 bottom-0 z-11 h-[30%] bg-linear-to-t from-background/95 via-background/45 to-transparent" />

      {/* Cinematic side vignette */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_35%,hsl(var(--background)/0.18)_65%,hsl(var(--background)/0.75)_100%)]" />

      {/* Existing old top gradient */}
      <div className="absolute inset-0 z-10 bg-linear-to-b from-background from-1% via-transparent via-30%" />

      {/* Existing old bottom gradient */}
      <div className="absolute inset-0 z-10 translate-y-px bg-linear-to-t from-background from-1% via-transparent via-55%" />

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
          wrapper: "absolute-center z-15 bg-transparent",
        }}
        className="w-[25vh] max-w-80 drop-shadow-xl md:w-[60vh]"
        src={titleImage}
      />

      {/* Backdrop */}
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
    </section>
  );
};

export default BackdropSection;
