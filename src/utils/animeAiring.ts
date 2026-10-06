import type { MalAnime } from "@/types/mal";
import type { AniListAnime } from "@/api/anilist";

export function isAnimeUpcoming(
  anime: MalAnime,
  aniList: AniListAnime | null,
): boolean {
  /*
   * AniList is the primary source.
   *
   * notYetAired means the anime itself has not
   * started airing yet.
   */
  if (
    aniList?.notYetAired === true
  ) {
    return true;
  }

  /*
   * AniList's release status is a secondary
   * confirmation.
   */
  if (
    aniList?.status ===
    "NOT_YET_RELEASED"
  ) {
    return true;
  }

  /*
   * MAL fallback.
   */
  const malStatus =
    anime.status
      ?.trim()
      .toLowerCase();

  if (
    malStatus ===
      "not_yet_aired" ||
    malStatus ===
      "not yet aired"
  ) {
    return true;
  }

  /*
   * Final fallback: if MAL gives us a concrete
   * future start date, treat it as upcoming.
   *
   * This protects us if AniList/MAL status data
   * temporarily disagrees.
   */
  if (anime.start_date) {
    const start =
      Date.parse(
        `${anime.start_date}T00:00:00Z`,
      );

    if (
      Number.isFinite(start) &&
      start > Date.now()
    ) {
      return true;
    }
  }

  return false;
}
