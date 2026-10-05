import Link from "next/link";
import {
  getAnimePage,
  getAnimeTitle,
} from "@/api/anilist";

export const revalidate = 300;

export default async function AnimePage() {
  const anime =
    await getAnimePage({
      page: 1,
      perPage: 24,
      sort: [
        "TRENDING_DESC",
      ],
    });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-warning">
          RyuFlix Anime
        </p>

        <h1 className="text-3xl font-bold text-white md:text-5xl">
          Trending Anime
        </h1>

        <p className="mt-3 max-w-2xl text-sm text-white/55 md:text-base">
          Discover anime powered by AniList,
          with dedicated episode playback.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {anime.media.map(
          (item) => {
            const title =
              getAnimeTitle(item);

            const image =
              item.coverImage.extraLarge ||
              item.coverImage.large;

            return (
              <Link
                key={item.id}
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
                  {item.seasonYear && (
                    <span>
                      {item.seasonYear}
                    </span>
                  )}

                  {item.format && (
                    <span>
                      {item.format}
                    </span>
                  )}

                  {item.averageScore && (
                    <span>
                      {item.averageScore / 10}
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
