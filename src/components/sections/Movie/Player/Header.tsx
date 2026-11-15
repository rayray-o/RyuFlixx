
import Link from "next/link";
import { cn } from "@/utils/helpers";
import { ArrowLeft } from "@/utils/icons";

interface MoviePlayerHeaderProps {
  id: number;
  movieName: string;
  hidden?: boolean;
  onOpenSource: () => void;
}

const MoviePlayerHeader: React.FC<MoviePlayerHeaderProps> = ({
  id,
  movieName,
  hidden,
}) => {
  return (
    <div
      aria-hidden={hidden ? true : undefined}
      className={cn(
        "pointer-events-none absolute top-0 z-10 flex h-28 w-full items-start gap-4",
        "bg-linear-to-b from-black/80 to-transparent p-2 text-white",
        "transition-opacity md:p-4",
        {
          "opacity-0": hidden,
        },
      )}
    >
      <Link
        href={`/movie/${id}`}
        aria-label="Back to movie"
        className="pointer-events-auto absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/90 shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-black/65 active:scale-95 sm:left-4 sm:top-4"
      >
        <ArrowLeft size={21} />
      </Link>

      <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 flex-col justify-center text-center sm:flex">
        <p className="text-sm text-white text-shadow-lg sm:text-lg lg:text-xl">
          {movieName}
        </p>
      </div>
    </div>
  );
};

export default MoviePlayerHeader;
