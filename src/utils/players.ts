import { PlayersProps } from "@/types";

/**
 * Generates a list of movie players with their respective titles and source URLs.
 * Each player is constructed using the provided movie ID.
 *
 * @param {string | number} id - The ID of the movie to be embedded in the player URLs.
 * @param {number} [startAt] - The start position in seconds to be embedded in the player URLs. Optional.
 * @returns {PlayersProps[]} - An array of objects, each containing
 * the title of the player and the corresponding source URL.
 */
export const getMoviePlayers = (id: string | number, startAt?: number): PlayersProps[] => {
  return [
    {
      title: "RyuFlix 1",
      source: `https://cinesrc.st/embed/movie/${id}`,
      recommended: true,
      fast: true,
      ads: true,
      resumable: true,
    },
    {
      title: "RyuFlix 2",
      source: `https://vidlink.pro/movie/${id}?player=jw&primaryColor=006fee&secondaryColor=a2a2a2&iconColor=eefdec&autoplay=false&startAt=${startAt || ""}`,
      recommended: true,
      fast: true,
      ads: true,
      resumable: true,
    },
    {
      title: "RyuFlix 3",
      source: `https://embed.filmu.in/movie/${id}`, //&progress=${startAt || ""}`,
      recommended: true,
      fast: true,
      resumable: true,
    },
    {
      title: "<RyuFlix Embed>",
      source: `https://www.2embed.cc/embed/${id}`,
      ads: true,
    },
    {
      title: "RyuFlix Embed 2",
      source: `https://multiembed.mov/?video_id=${id}&tmdb=1`,
      fast: true,
      ads: true,
    },
    {
      title: "RyuFlix 4",
      source: `https://www.nontongo.win/embed/movie/${id}`,
      ads: true,
    },
    {
      title: "RyuFlix 5",
      source: `https://vidcore.org/embed/movie/${id}?autoplay=true`,
      fast: true,
      ads: true,
    },
    {
      title: "Ryuflix 6",
      source: `https://www.2embed.cc/embed/${id}`,
      ads: true,
    },
    {
      title: "RyuFlix 7",
      source: `https://vidsrcme.ru/embed/movie/${id}`,
      ads: true,
    },
    {
      title: "RyuFlix 8",
      source: `https://vidsrcme.su/embed/movie/${id}`,
      ads: true,
    },
    {
      title: "RyuFlix 9",
      source: `https://vidsrc.ir/embed/movie/${id}`,
      ads: true,
    },
    {
      title: "RyuFlix 10",
      source: `https://vidsrc-me.ru/embed/movie/${id}`,
      ads: true,
    },
    {
      title: "RyuFlix 11",
      source: `https://vsembed.ru/embed/movie/${id}`,
      recommended: true,
      fast: true,
      ads: true,
    },
    {
      title: "RyuFlix 12",
      source: `https://moviesapi.club/movie/${id}`,
      ads: true,
    },
  ];
};

/**
 * Generates a list of TV show players with their respective titles and source URLs.
 * Each player is constructed using the provided TV show ID, season, and episode.
 *
 * @param {string | number} id - The ID of the TV show to be embedded in the player URLs.
 * @param {string | number} [season] - The season number of the TV show episode to be embedded.
 * @param {string | number} [episode] - The episode number of the TV show episode to be embedded.
 * @param {number} [startAt] - The start position in seconds to be embedded in the player URLs. Optional.
 * @returns {PlayersProps[]} - An array of objects, each containing
 * the title of the player and the corresponding source URL.
 */
export const getTvShowPlayers = (
  id: string | number,
  season: number,
  episode: number,
  startAt?: number,
): PlayersProps[] => {
  return [
    {
      title: "RyuFlix 1",
      source: `https://vidlink.pro/tv/${id}/${season}/${episode}?player=jw&primaryColor=f5a524&secondaryColor=a2a2a2&iconColor=eefdec&autoplay=false&startAt=${startAt || ""}`,
      recommended: true,
      fast: true,
      ads: true,
      resumable: true,
    },
    {
      title: "RyuFlix 2",
      source: `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=f5a524&autoplay=false&startAt=${startAt}`,
      recommended: true,
      fast: true,
      ads: true,
      resumable: true,
    },
    {
      title: "RyuFlix 3",
      // NOTE: VidKing has a known issue with the `progress` query parameter where it stuck at that timestamp.
      // Currently, this player can save playback progress but cannot resume from a specific timestamp.
      // The `progress` parameter is commented out in the source URL until this is resolved.
      source: `https://embed.filmu.in/tv/${id}/${season}/${episode}`, //&progress=${startAt || ""}`,
      recommended: true,
      fast: true,
      resumable: true,
    },
    {
      title: "<RyuFlix Embed>",
      source: `https://www.embed.cc/embed/tv/${id}/${season}/${episode}`,
      ads: true,
    },
    {
      title: "RyuFlix Embed 2",
      source: `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
      fast: true,
      ads: true,
    },
    {
      title: "RyuFlix 3",
      source: `https://filmku.stream/embed/series?tmdb=${id}&sea=${season}&epi=${episode}`,
      ads: true,
    },
    {
      title: "RyuFlix 4",
      source: `https://www.NontonGo.win/embed/tv/${id}/${season}/${episode}`,
      ads: true,
    },
    {
      title: "RyuFlix 5",
      source: `https://vidcore.org/embed/tv/${id}/${season}/${episode}`,
      fast: true,
      ads: true,
    },
    {
      title: "RyuFlix 6",
      source: `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`,
      ads: true,
    },
    {
      title: "RyuFlix 7",
      source: `https://vidsrc.ru/embed/tv/${id}/${season}/${episode}`,
      ads: true,
    },
    {
      title: "RyuFlix 8",
      source: `https://vidsrc.ir/embed/tv/${id}/${season}/${episode}`,
      ads: true,
    },
    {
      title: "RyuFlix 9",
      source: `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`,
      ads: true,
    },
    {
      title: "RyuFlix 10",
      source: `https://vidsrc-me.ir/embed/tv/${id}/${season}/${episode}?autoPlay=false`,
      ads: true,
    },
    {
      title: "RyuFlix 11",
      source: `https://vsembed.ru/embed/tv/${id}/${season}/${episode}?autoPlay=false`,
      recommended: true,
      fast: true,
      ads: true,
    },
    {
      title: "RyuFlix 12",
      source: `https://moviesapi.club/tv/${id}-${season}-${episode}`,
      ads: true,
    },
  ];
};
