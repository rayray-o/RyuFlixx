import Link from "next/link";
import {
  getAnimeImage,
  getAnimeTitle,
  getAnimeYear,
} from "@/api/mal";
import type { MalAnime } from "@/types/mal";

interface AnimePosterCardProps {
  anime: MalAnime;
}

const AnimePosterCard: React.FC<
  AnimePosterCardProps
> = ({ anime }) => {
  const title =
    getAnimeTitle(anime);

  const image =
    getAnimeImage(anime);

  const year =
    getAnimeYear(anime);

  return (
    <Link
      href={`/anime/${anime.id}`}
      className="group block w-[166.6667px] motion-preset-focus text-white md:w-[200px]"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-lg border-[3px] border-transparent transition-colors hover:border-warning">
        {image ? (
          <img
            alt={title}
            src={image}
            loading="lazy"
            className="h-[250px] w-full object-cover object-center transition group-hover:scale-110 md:h-[300px]"
          />
        ) : (
          <div className="flex h-[250px] items-center justify-center bg-white/5 text-xs text-white/30 md:h-[300px]">
            No Image
          </div>
        )}
      </div>

      <div className="flex h-[44px] items-center overflow-hidden px-1 pt-1">
        <h2 className="line-clamp-2 text-sm font-semibold">
          {title}
        </h2>
      </div>

      <div className="flex justify-between px-1 pt-1 text-xs text-white/50">
        <p>
          {year ?? ""}
        </p>

        <p>
          {anime.media_type ?? ""}
        </p>
      </div>
    </Link>
  );
};

export default AnimePosterCard;
