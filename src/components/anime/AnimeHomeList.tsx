import Link from "next/link";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import AnimePosterCard from "./AnimePosterCard";
import type { MalAnime } from "@/types/mal";

interface AnimeHomeListProps {
  anime: MalAnime[];
  title: string;
  href: string;
  id: string;
}

const AnimeHomeList: React.FC<
  AnimeHomeListProps
> = ({
  anime,
  title,
  href,
  id,
}) => {
  return (
    <section
      id={id}
      className="min-h-[250px] md:min-h-[300px]"
    >
      <div className="z-3 flex flex-col gap-2">
        <div className="flex grow items-center justify-between">
          <SectionTitle color="warning">
            {title}
          </SectionTitle>

          <Link
            href={href}
            className="rounded-full px-2 py-1 text-sm text-white transition-colors hover:bg-white/5"
          >
            See All &gt;
          </Link>
        </div>

        <Carousel
          classNames={{
            wrapper: "justify-start",
            container: "gap-0",
          }}
        >
          {anime.map((item) => (
            <div
              key={String(item.id)}
              className="embla__slide !flex-none !basis-auto flex min-h-fit max-w-fit items-center px-1 py-1"
            >
              <AnimePosterCard
                anime={item}
              />
            </div>
          ))}
        </Carousel>
      </div>
    </section>
  );
};

export default AnimeHomeList;
