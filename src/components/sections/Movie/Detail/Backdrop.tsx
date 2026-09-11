import { Image } from "@heroui/image";
import { useWindowScroll } from "@mantine/hooks";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { AppendToResponse } from "tmdb-ts/dist/types/options";
import { getImageUrl } from "@/utils/movies";

const BackdropSection: React.FC<{
  movie: AppendToResponse<MovieDetails, "images"[], "movie"> | undefined;
}> = ({ movie }) => {
  const [{ y }] = useWindowScroll();

  const fadeProgress = Math.min(y / 700, 1);
  const backdropOpacity = Math.max(1 - fadeProgress * 0.85, 0.15);
  const backdropScale = 1 + Math.min(y / 12000, 0.035);

  const backdropImage = getImageUrl(
    movie?.backdrop_path,
    "backdrop",
    true,
  );

  const titleImage = getImageUrl(
    movie?.images.logos.find(
      (logo) => logo.iso_639_1 === "en",
    )?.file_path,
    "title",
  );

  const movieTitle =
    movie?.original_language === "id"
      ? movie?.original_title
      : movie?.title;

  return (
    <section
      id="backdrop"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-[62vh] min-h-[430px] md:h-[68vh] lg:h-[76vh]"
    >
      {/* Main backdrop */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          opacity: backdropOpacity,
        }}
      >
        <Image
          radius="none"
          alt={movieTitle || ""}
          className="h-full w-full object-cover object-center"
          classNames={{
            wrapper: "absolute inset-0 h-full w-full",
          }}
          src={backdropImage}
          style={{
            transform: `scale(${backdropScale})`,
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* Dark cinematic layer */}
      <div className="absolute inset-0 bg-black/15" />

      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-background via-background/35 to-transparent" />

      {/* Side fade */}
      <div className="absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-background/55 via-transparent to-transparent" />

      {/* Bottom fade into page */}
      <div className="absolute inset-x-0 bottom-0 h-[65%] bg-linear-to-t from-background via-background/75 via-35% to-transparent" />

      {/* Extra cinematic depth */}
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-t from-background to-transparent" />

      {/* TMDB title artwork */}
      {titleImage && (
        <div
          className="absolute inset-x-0 bottom-[18%] z-10 flex justify-center px-8 transition-opacity duration-300 md:bottom-[20%]"
          style={{
            opacity: Math.max(1 - fadeProgress * 1.5, 0),
          }}
        >
          <Image
            isBlurred
            radius="none"
            alt={movieTitle || ""}
            classNames={{
              wrapper:
                "flex w-[min(72vw,420px)] justify-center md:w-[min(45vw,520px)]",
            }}
            className="max-h-28 w-full object-contain object-center drop-shadow-[0_8px_30px_rgba(0,0,0,0.8)] md:max-h-40"
            src={titleImage}
          />
        </div>
      )}
    </section>
  );
};

export default BackdropSection;
