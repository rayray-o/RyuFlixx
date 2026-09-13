import { Image } from "@heroui/image";
import { useWindowScroll } from "@mantine/hooks";
import { AppendToResponse } from "tmdb-ts/dist/types/options";
import { getImageUrl, mutateTvShowTitle } from "@/utils/movies";
import { TvShowDetails } from "tmdb-ts";

const TvShowBackdropSection: React.FC<{
  tv: AppendToResponse<TvShowDetails, "images"[], "tvShow">;
}> = ({ tv }) => {
  const [{ y }] = useWindowScroll();

  const fadeProgress = Math.min(y / 700, 1);
  const backdropOpacity = Math.max(1 - fadeProgress * 0.85, 0.15);
  const backdropScale = 1 + Math.min(y / 12000, 0.035);

  const title = mutateTvShowTitle(tv);

  const backdropImage = getImageUrl(
    tv?.backdrop_path,
    "backdrop",
    true,
  );

  const titleImage = getImageUrl(
    tv?.images.logos.find(
      (logo) => logo.iso_639_1 === "en",
    )?.file_path,
    "title",
  );

  return (
    <section
      id="backdrop"
      aria-hidden="true"
      className="pointer-events-none fixed left-1/2 top-0 z-0 h-[62vh] min-h-[430px] w-screen -translate-x-1/2 md:h-[68vh] lg:h-[76vh]"
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          opacity: backdropOpacity,
        }}
      >
        <Image
          radius="none"
          alt={title}
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

      <div className="absolute inset-0 bg-black/15" />

      <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-background via-background/35 to-transparent" />

      <div className="absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-background/55 via-transparent to-transparent" />

      <div className="absolute inset-x-0 bottom-0 h-[65%] bg-linear-to-t from-background via-background/75 via-35% to-transparent" />

      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-t from-background to-transparent" />

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
            alt={title}
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

export default TvShowBackdropSection;
