"use client";

import Rating from "@/components/ui/other/Rating";
import VaulDrawer from "@/components/ui/overlay/VaulDrawer";
import useBreakpoints from "@/hooks/useBreakpoints";
import useDeviceVibration from "@/hooks/useDeviceVibration";
import { getImageUrl, mutateMovieTitle } from "@/utils/movies";
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Image,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useDisclosure, useHover } from "@mantine/hooks";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Movie } from "tmdb-ts/dist/types";
import { useLongPress } from "use-long-press";
import HoverPosterCard from "./Hover";

interface MoviePosterCardProps {
  movie: Movie;
  variant?: "full" | "bordered";
}

const MoviePosterCard: React.FC<MoviePosterCardProps> = ({
  movie,
  variant = "full",
}) => {
  const { hovered, ref } = useHover();
  const [opened, handlers] = useDisclosure(false);
  const [logo, setLogo] = useState<string | null>(null);

  const releaseYear = new Date(movie.release_date).getFullYear();
  const posterImage = getImageUrl(movie.poster_path);
  const title = mutateMovieTitle(movie);
  const { mobile } = useBreakpoints();
  const { startVibration } = useDeviceVibration();

  useEffect(() => {
    let cancelled = false;

    const loadLogo = async () => {
      try {
        const response = await fetch(`/api/movie-logo?id=${movie.id}`);

        if (!response.ok) return;

        const data: { logo?: string | null } = await response.json();

        if (!cancelled) {
          setLogo(data.logo ?? null);
        }
      } catch {
        if (!cancelled) {
          setLogo(null);
        }
      }
    };

    loadLogo();

    return () => {
      cancelled = true;
    };
  }, [movie.id]);

  const callback = useCallback(() => {
    handlers.open();
    setTimeout(() => startVibration([100]), 300);
  }, [handlers, startVibration]);

  const longPress = useLongPress(mobile ? callback : null, {
    cancelOnMovement: true,
    threshold: 300,
  });

  const titleContent = logo ? (
    <div
      aria-label={title}
      role="img"
      className="h-9 w-full bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: `url("${logo}")` }}
    />
  ) : (
    <h6 className="max-w-full truncate text-center text-sm font-semibold">
      {title}
    </h6>
  );

  return (
    <>
      <Tooltip
        isDisabled={mobile}
        showArrow
        className="bg-secondary-background p-0"
        shadow="lg"
        delay={1000}
        placement="right-start"
        content={<HoverPosterCard id={movie.id} />}
      >
        <Link href={`/movie/${movie.id}`} ref={ref} {...longPress()}>
          {variant === "full" && (
            <div className="group motion-preset-focus text-white">
              <div className="relative aspect-2/3 overflow-hidden rounded-lg border-[3px] border-transparent transition-colors hover:border-primary">
                {hovered && (
                  <Icon
                    icon="line-md:play-filled"
                    width="64"
                    height="64"
                    className="absolute-center z-20 text-white"
                  />
                )}

                {movie.adult && (
                  <Chip
                    color="danger"
                    size="sm"
                    variant="flat"
                    className="absolute left-2 top-2 z-20"
                  >
                    18+
                  </Chip>
                )}

                <Image
                  alt={title}
                  src={posterImage}
                  radius="none"
                  className="z-0 aspect-2/3 h-[250px] object-cover object-center transition group-hover:scale-110 md:h-[300px]"
                  classNames={{
                    img: "group-hover:opacity-70",
                  }}
                />
              </div>

              <div className="flex h-[44px] items-center justify-center overflow-hidden px-1 pt-1">
                {titleContent}
              </div>

              <div className="flex justify-between px-1 pt-1 text-xs">
                <p>{releaseYear}</p>
                <Rating rate={movie?.vote_average} />
              </div>
            </div>
          )}

          {variant === "bordered" && (
            <Card
              isHoverable
              fullWidth
              shadow="md"
              className="group h-full bg-secondary-background"
            >
              <CardHeader className="flex items-center justify-center pb-0">
                <div className="relative size-full">
                  {hovered && (
                    <Icon
                      icon="line-md:play-filled"
                      width="64"
                      height="64"
                      className="absolute-center z-20 text-white"
                    />
                  )}

                  {movie.adult && (
                    <Chip
                      color="danger"
                      size="sm"
                      variant="shadow"
                      className="absolute left-2 top-2 z-20"
                    >
                      18+
                    </Chip>
                  )}

                  <div className="relative overflow-hidden rounded-large">
                    <Image
                      isBlurred
                      alt={title}
                      className="aspect-2/3 rounded-lg object-cover object-center group-hover:scale-110"
                      src={posterImage}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardBody className="justify-end pb-1">
                <div className="flex h-[44px] items-center justify-center overflow-hidden">
                  {titleContent}
                </div>
              </CardBody>

              <CardFooter className="justify-between pt-0 text-xs">
                <p>{releaseYear}</p>
                <Rating rate={movie.vote_average} />
              </CardFooter>
            </Card>
          )}
        </Link>
      </Tooltip>

      {mobile && (
        <VaulDrawer
          backdrop="blur"
          open={opened}
          onOpenChange={handlers.toggle}
          title={title}
          hiddenTitle
        >
          <HoverPosterCard id={movie.id} fullWidth />
        </VaulDrawer>
      )}
    </>
  );
};

export default MoviePosterCard;
