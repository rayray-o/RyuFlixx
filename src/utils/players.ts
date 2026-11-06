import type { PlayersProps } from "@/types";

/**
 * Movie/TV iframe providers. WatchPlayer applies the current resume point to
 * the final, selected iframe URL, so a remembered server cannot lose it.
 */
export const getMoviePlayers = (id: string | number, startAt?: number): PlayersProps[] => {
  const start = Number.isFinite(startAt) && (startAt ?? 0) > 0 ? `&startAt=${Math.floor(startAt!)}` : "";
  return [
    { title: "Ryuflix 1", source: `https://www.vidy.st/movie/${id}?color=00FFFF&autoplay=true`, recommended: true, fast: true, ads: true, resumable: true },
    { title: "Ryuflix 2", source: `https://vidstuck.cc/embed/movie/${id}?branding=Ryuflix&loading=2&back=true`, recommended: true, fast: true, ads: true, resumable: true },
    { title: "Ryuflix 3", source: `https://embed.filmu.in/movie/${id}${start ? `?${start.slice(1)}` : ""}`, recommended: true, fast: true, resumable: true },
    { title: "RyuFlix 4", source: `https://embed.vidrift.net/embed/movie/${id}?brand=Ryuflix&brandColor=00d1b2`, ads: true },
    { title: "Ryuflix 5", source: `https://multiembed.mov/?video_id=${id}&tmdb=1`, fast: true, ads: true },
    { title: "Ryuflix 6", source: `https://www.nontongo.win/embed/movie/${id}`, ads: true },
    { title: "Ryuflix 7", source: `https://vidcore.org/embed/movie/${id}?autoplay=true`, fast: true, ads: true },
    { title: "Ryuflix 8", source: `https://www.2embed.cc/embed/${id}`, ads: true },
    { title: "Ryuflix 9", source: `https://vidsrc2.ru/embed/movie/${id}`, ads: true },
    { title: "Ryuflix 10", source: `https://vidsrcme.ir/embed/movie/${id}`, ads: true },
    { title: "Ryuflix 11", source: `https://vidsrc.ir/embed/movie/${id}`, ads: true },
    { title: "Ryuflix 12", source: `https://vidsrc.sh/embed/movie/${id}`, ads: true },
    { title: "Ryuflix 13", source: `https://vidstuck.xyz/embed/movie/${id}?branding=Ryuflix`, recommended: true, fast: true, ads: true },
    // Videasy's published docs use the .ws /embed route, not the old .to/movie path.
    { title: "Ryuflix 14", source: `https://player.videasy.ws/embed/movie/${id}`, ads: true, resumable: true },
  ];
};

export const getTvShowPlayers = (
  id: string | number,
  season: number,
  episode: number,
  startAt?: number,
): PlayersProps[] => {
  const start = Number.isFinite(startAt) && (startAt ?? 0) > 0 ? `&startAt=${Math.floor(startAt!)}` : "";
  return [
    { title: "Ryuflix 1", source: `https://www.vidy.st/tv/${id}/${season}/${episode}?color=00FFFF&nextEpisode=true&episodeSelector=true&autoplay=true`, recommended: true, fast: true, ads: true, resumable: true },
    { title: "Ryuflix 2", source: `https://vidstuck.cc/embed/tv/${id}/${season}/${episode}?branding=Ryuflix&loading=2&back=true`, recommended: true, fast: true, ads: true, resumable: true },
    { title: "Ryuflix 3", source: `https://embed.filmu.in/tv/${id}/${season}/${episode}${start ? `?${start.slice(1)}` : ""}`, recommended: true, fast: true, resumable: true },
    { title: "Ryuflix 4", source: `https://embed.vidrift.net/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "Ryuflix 5", source: `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${season}&e=${episode}`, fast: true, ads: true },
    { title: "Ryuflix 6", source: `https://filmku.stream/embed/series?tmdb=${id}&sea=${season}&epi=${episode}`, ads: true },
    { title: "Ryuflix 7", source: `https://www.nontongo.win/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "Ryuflix 8", source: `https://vidcore.org/embed/tv/${id}/${season}/${episode}`, fast: true, ads: true },
    { title: "Ryuflix 9", source: `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`, ads: true },
    { title: "Ryuflix 10", source: `https://vidsrc2.ru/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "Ryuflix 11", source: `https://vidsrc.ir/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "Ryuflix 12", source: `https://vidsrc.ir/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "Ryuflix 13", source: `https://vidsrc.sh/embed/tv/${id}/${season}/${episode}?autoPlay=false`, ads: true },
    { title: "Ryuflix 14", source: `https://vidstuck.xyz/embed/tv/${id}/${season}/${episode}?episodeSelector=true`, recommended: true, fast: true, ads: true },
    { title: "Ryuflix 15", source: `https://player.videasy.ws/embed/tv/${id}/${season}/${episode}`, ads: true, resumable: true },
  ];
};
