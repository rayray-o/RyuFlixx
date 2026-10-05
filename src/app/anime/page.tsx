import Link from "next/link";
import {
  getAnimeTitle,
  getRecentAnime,
} from "@/api/anikoto";
import AnimeContinueWatching from "@/components/anime/AnimeContinueWatching";

export const revalidate = 300;

export default async function AnimePage() {
  const data =
    await getRecentAnime(
      1,
      24,
    );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12">
      <AnimeContinueWatching />

      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-warning">
          RyuFlix Anime
        </p>

        <h1 className="text-3xl font-bold text-white md:text-5xl">
          Latest Anime
        </h1>

        <p className="mt-3 max-w-2xl text-sm text-white/55 md:text-base">
          Discover anime with dedicated
          episode playback.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {data.anime.map(
          (item) => {
            const title =
              getAnimeTitle(item);

            const image =
              item.image ||
              item.poster ||
              item.cover;

            return (
              <Link
                key={String(item.id)}
                href={`/anime/${item.id}`}
                className="group min-w-0"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-white/5">
                  {image ? (
                    <img
                      src={image}
                      alt={title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">
                      No Image
                    </div>
                  )}
                </div>

                <h2 className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                  {title}
                </h2>

                <div className="mt-1 flex items-center gap-2 text-xs text-white/45">
                  {item.year && (
                    <span>
                      {item.year}
                    </span>
                  )}

                  {item.type && (
                    <span>
                      {item.type}
                    </span>
                  )}
                </div>
              </Link>
            );
          },
        )}
      </section>
    </main>
  );
}
