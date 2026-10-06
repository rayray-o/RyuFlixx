"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  Button,
} from "@heroui/react";
import ShareButton from "@/components/ui/button/ShareButton";
import type { MalAnime } from "@/types/mal";
import type {
  AniListAnime,
  AniListCharacter,
  AniListMediaItem,
} from "@/api/anilist";

interface AnimeDetailClientProps {
  anime: MalAnime;

  aniList: AniListAnime | null;
}

function titleOf(
  item: AniListMediaItem,
): string {
  return (
    item.title?.english ??
    item.title?.romaji ??
    item.title?.native ??
    "Unknown Anime"
  );
}

function imageOf(
  item: AniListMediaItem,
): string | null {
  return (
    item.coverImage?.extraLarge ??
    item.coverImage?.large ??
    null
  );
}

function formatLabel(
  value?: string | null,
): string {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatDuration(
  seconds?: number | null,
): string | null {
  if (
    !seconds ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  const minutes =
    Math.round(seconds / 60);

  return `${minutes} min`;
}

function relationLabel(
  relation?: string | null,
): string {
  switch (relation) {
    case "PREQUEL":
      return "Prequel";

    case "SEQUEL":
      return "Sequel";

    case "SIDE_STORY":
      return "Side Story";

    case "SPIN_OFF":
      return "Spin-Off";

    case "ALTERNATIVE":
      return "Alternative";

    case "PARENT":
      return "Parent Story";

    case "SUMMARY":
      return "Summary";

    case "COMPILATION":
      return "Compilation";

    default:
      return formatLabel(
        relation,
      );
  }
}

function relatedSort(
  a: {
    relationType?: string | null;
    node: AniListMediaItem;
  },
  b: {
    relationType?: string | null;
    node: AniListMediaItem;
  },
) {
  const rank = (
    relation?: string | null,
  ) => {
    switch (relation) {
      case "PREQUEL":
        return 0;

      case "SEQUEL":
        return 1;

      case "SIDE_STORY":
        return 2;

      case "SPIN_OFF":
        return 3;

      case "ALTERNATIVE":
        return 4;

      default:
        return 5;
    }
  };

  const relationDifference =
    rank(a.relationType) -
    rank(b.relationType);

  if (
    relationDifference !== 0
  ) {
    return relationDifference;
  }

  return (
    (a.node.seasonYear ?? 9999) -
    (b.node.seasonYear ?? 9999)
  );
}

function convertAniListToMalAnime(
  item: AniListMediaItem,
): MalAnime | null {
  if (!item.idMal) {
    return null;
  }

  return {
    id: item.idMal,

    title: titleOf(item),

    main_picture:
      imageOf(item)
        ? {
            large:
              imageOf(item),
          }
        : null,

    media_type:
      item.format?.toLowerCase() ??
      null,

    start_date:
      item.startDate?.year
        ? String(
            item.startDate.year,
          )
        : null,

    num_episodes:
      item.episodes ??
      null,
  };
}

export default function AnimeDetailClient({
  anime,
  aniList,
}: AnimeDetailClientProps) {
  const [trailerOpen, setTrailerOpen] =
    useState(false);

  const trailer =
    aniList?.trailer?.site
      ?.toLowerCase() ===
      "youtube" &&
    aniList.trailer.id
      ? aniList.trailer
      : null;

  const backdrop =
    aniList?.bannerImage ??
    anime.background ??
    anime.main_picture?.large ??
    anime.main_picture?.medium ??
    null;

  const poster =
    anime.main_picture?.large ??
    anime.main_picture?.medium ??
    null;

  const photos =
    anime.pictures?.length
      ? anime.pictures
      : poster
        ? [
            {
              large: poster,
            },
          ]
        : [];

  const characters =
    aniList?.characters?.edges ??
    [];

  const recommendations =
    (anime.recommendations ??
      [])
      .map(
        (item) =>
          item.node,
      )
      .filter(Boolean);

  const aniListRecommendations =
    (
      aniList?.recommendations
        ?.nodes ?? []
    )
      .map(
        (item) =>
          item.mediaRecommendation,
      )
      .filter(
        (
          item,
        ): item is AniListMediaItem =>
          Boolean(item),
      );

  const recommendationItems =
    useMemo(() => {
      const combined =
        [
          ...recommendations,
          ...aniListRecommendations
            .map(
              convertAniListToMalAnime,
            )
            .filter(
              (
                item,
              ): item is MalAnime =>
                Boolean(item),
            ),
        ];

      const seen =
        new Set<number>();

      return combined
        .filter(
          (item) => {
            if (
              seen.has(item.id) ||
              item.id === anime.id
            ) {
              return false;
            }

            seen.add(item.id);

            return true;
          },
        )
        .slice(0, 12);
    }, [
      anime.id,
      recommendations,
      aniListRecommendations,
    ]);

  const franchise =
    useMemo(() => {
      const relations =
        (
          aniList?.relations
            ?.edges ?? []
        )
          .filter(
            (edge) =>
              Boolean(
                edge.node?.idMal,
              ),
          )
          .sort(relatedSort);

      const seen =
        new Set<number>();

      return relations
        .filter(
          (edge) => {
            const id =
              edge.node.idMal!;

            if (
              seen.has(id) ||
              id === anime.id
            ) {
              return false;
            }

            seen.add(id);

            return true;
          },
        )
        .slice(0, 18);
    }, [
      aniList,
      anime.id,
    ]);

  const mainStory =
    franchise.filter(
      (entry) =>
        entry.relationType ===
          "PREQUEL" ||
        entry.relationType ===
          "SEQUEL",
    );

  const sideStories =
    franchise.filter(
      (entry) =>
        entry.relationType !==
          "PREQUEL" &&
        entry.relationType !==
          "SEQUEL",
    );

  const year =
    anime.start_date
      ?.slice(0, 4) ?? null;

  const duration =
    formatDuration(
      anime.average_episode_duration,
    );

  const watchUrl =
    `/anime/${anime.id}/watch?episode=1`;

  return (
    <main className="w-full pb-16">
      <section className="relative min-h-[620px] overflow-hidden md:min-h-[700px]">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}

        <div className="absolute inset-0 bg-black/55" />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />

        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />

        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-end px-5 pb-12 md:min-h-[700px] md:px-8 md:pb-16">
          <div className="grid w-full gap-8 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]">
            {poster && (
              <div className="hidden overflow-hidden rounded-2xl border border-white/15 shadow-2xl md:block">
                <img
                  src={poster}
                  alt={anime.title}
                  className="aspect-[2/3] w-full object-cover"
                />
              </div>
            )}

            <div className="max-w-4xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-warning">
                RyuFlix Anime
              </p>

              <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl lg:text-7xl">
                {anime.title}
              </h1>

              {anime.alternative_titles?.ja &&
                anime.alternative_titles.ja !==
                  anime.title && (
                  <p className="mt-2 text-sm text-white/55 md:text-base">
                    {anime.alternative_titles.ja}
                  </p>
                )}

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/65">
                {anime.mean != null && (
                  <span className="font-bold text-warning">
                    ★{" "}
                    {anime.mean.toFixed(
                      1,
                    )}
                  </span>
                )}

                {anime.rank && (
                  <span>
                    #{anime.rank}
                  </span>
                )}

                {year && (
                  <span>
                    {year}
                  </span>
                )}

                {anime.media_type && (
                  <span>
                    {formatLabel(
                      anime.media_type,
                    )}
                  </span>
                )}

                {anime.num_episodes ? (
                  <span>
                    {anime.num_episodes} Episodes
                  </span>
                ) : null}

                {duration && (
                  <span>
                    {duration}
                  </span>
                )}

                {anime.rating && (
                  <span className="rounded border border-white/15 px-2 py-0.5 text-xs uppercase">
                    {anime.rating}
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {anime.genres?.map(
                  (genre) => (
                    <span
                      key={genre.id}
                      className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-white/70 backdrop-blur"
                    >
                      {genre.name}
                    </span>
                  ),
                )}
              </div>

              <p className="mt-6 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                {anime.synopsis ||
                  "No synopsis available."}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href={watchUrl}
                  className="rounded-xl bg-warning px-6 py-3 text-sm font-bold text-black shadow-lg transition-transform hover:scale-[1.02]"
                >
                  Watch Now
                </Link>

                {trailer && (
                  <Button
                    variant="bordered"
                    className="border-white/20 bg-black/30 text-white backdrop-blur"
                    onPress={() =>
                      setTrailerOpen(
                        true,
                      )
                    }
                  >
                    Trailer
                  </Button>
                )}

                <ShareButton
                  title={anime.title}
                  id={anime.id}
                  type="anime"
                />
              </div>

              {anime.studios &&
                anime.studios.length >
                  0 && (
                  <div className="mt-6 text-sm text-white/45">
                    <span className="text-white/65">
                      Studio
                    </span>{" "}
                    {anime.studios
                      .map(
                        (studio) =>
                          studio.name,
                      )
                      .join(
                        " · ",
                      )}
                  </div>
                )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <section className="mt-10 grid gap-4 md:grid-cols-4">
          <InfoCard
            label="Status"
            value={formatLabel(anime.status)}
          />

          <InfoCard
            label="Source"
            value={formatLabel(anime.source)}
          />

          <InfoCard
            label="Air Season"
            value={
              anime.start_season
                ? `${formatLabel(anime.start_season.season)} ${anime.start_season.year ?? ""}`
                : "Unknown"
            }
          />

          <InfoCard
            label="Popularity"
            value={
              anime.popularity
                ? `#${anime.popularity}`
                : "Unknown"
            }
          />
        </section>

        {characters.length >
          0 && (
          <section className="mt-14">
            <SectionHeading>
              Cast & Characters
            </SectionHeading>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {characters.map(
                (
                  character,
                  index,
                ) => {
                  const voice =
                    character.voiceActors?.[0];

                  return (
                    <div
                      key={`${character.node.id}-${index}`}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                    >
                      {character.node.image?.large && (
                        <img
                          src={
                            character
                              .node
                              .image
                              .large
                          }
                          alt={
                            character
                              .node
                              .name
                              ?.full ??
                            "Character"
                          }
                          className="aspect-[3/4] w-full object-cover"
                        />
                      )}

                      <div className="p-3">
                        <p className="truncate text-sm font-bold text-white">
                          {character
                            .node
                            .name
                            ?.full ??
                            "Unknown"}
                        </p>

                        <p className="mt-1 text-[11px] uppercase tracking-wide text-warning">
                          {character.role ??
                            "Character"}
                        </p>

                        {voice?.name?.full && (
                          <p className="mt-2 truncate text-xs text-white/45">
                            VA:{" "}
                            {
                              voice.name.full
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </section>
        )}

        {photos.length >
          0 && (
          <section className="mt-14">
            <SectionHeading>
              Photos
            </SectionHeading>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {photos
                .slice(0, 8)
                .map(
                  (
                    photo,
                    index,
                  ) => {
                    const source =
                      photo.large ??
                      photo.medium;

                    if (!source) {
                      return null;
                    }

                    return (
                      <a
                        key={`${source}-${index}`}
                        href={source}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                      >
                        <img
                          src={source}
                          alt={`${anime.title} photo ${index + 1}`}
                          className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </a>
                    );
                  },
                )}
            </div>
          </section>
        )}

        {franchise.length >
          0 && (
          <section className="mt-14">
            <SectionHeading>
              Seasons & Parts
            </SectionHeading>

            <p className="mb-5 max-w-3xl text-sm leading-6 text-white/45">
              Franchise entries are ordered from the relationship graph rather than treating every release as a numbered season.
            </p>

            {mainStory.length >
              0 && (
              <FranchiseGroup
                title="Main Story"
                entries={mainStory}
              />
            )}

            {sideStories.length >
              0 && (
              <div className="mt-8">
                <FranchiseGroup
                  title="Related & Side Stories"
                  entries={sideStories}
                />
              </div>
            )}
          </section>
        )}

        {recommendationItems.length >
          0 && (
          <section className="mt-14">
            <SectionHeading>
              You May Like
            </SectionHeading>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {recommendationItems.map(
                (item) => (
                  <Link
                    key={item.id}
                    href={`/anime/${item.id}`}
                    className="group"
                  >
                    <div className="overflow-hidden rounded-xl border-2 border-transparent transition-colors group-hover:border-warning">
                      {item.main_picture?.large ||
                      item.main_picture?.medium ? (
                        <img
                          src={
                            item.main_picture
                              ?.large ??
                            item.main_picture
                              ?.medium ??
                            ""
                          }
                          alt={item.title}
                          className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex aspect-[2/3] items-center justify-center bg-white/5 text-xs text-white/30">
                          No Image
                        </div>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                      {item.title}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      {item.start_date?.slice(
                        0,
                        4,
                      ) ?? ""}
                    </p>
                  </Link>
                ),
              )}
            </div>
          </section>
        )}
      </div>

      {trailer && (
        <Modal
          isOpen={trailerOpen}
          onClose={() =>
            setTrailerOpen(false)
          }
          size="5xl"
          backdrop="blur"
        >
          <ModalContent>
            <ModalBody className="p-2 md:p-5">
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${trailer.id}`}
                  title={`${anime.title} Trailer`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
    </main>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-white">
        {value || "Unknown"}
      </p>
    </div>
  );
}

function SectionHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="h-9 w-2 rounded-full bg-warning" />

      <h2 className="text-2xl font-black text-white md:text-3xl">
        {children}
      </h2>
    </div>
  );
}

function FranchiseGroup({
  title,
  entries,
}: {
  title: string;

  entries: Array<{
    relationType?: string | null;
    node: AniListMediaItem;
  }>;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-white/45">
        {title}
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.map(
          (entry) => {
            const item =
              entry.node;

            if (!item.idMal) {
              return null;
            }

            const image =
              imageOf(item);

            return (
              <Link
                key={`${item.id}-${entry.relationType}`}
                href={`/anime/${item.idMal}`}
                className="group"
              >
                <div className="relative overflow-hidden rounded-xl border border-white/10">
                  {image ? (
                    <img
                      src={image}
                      alt={titleOf(item)}
                      className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="aspect-[2/3] bg-white/5" />
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-3 pt-10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-warning">
                      {relationLabel(
                        entry.relationType,
                      )}
                    </span>
                  </div>
                </div>

                <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                  {titleOf(item)}
                </p>

                <p className="mt-1 text-xs text-white/40">
                  {item.seasonYear ??
                    item.startDate?.year ??
                    ""}
                  {item.episodes
                    ? ` · ${item.episodes} eps`
                    : ""}
                </p>
              </Link>
            );
          },
        )}
      </div>
    </div>
  );
}
