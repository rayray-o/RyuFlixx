import type { PlayersProps } from "@/types";

/**
 * Movie/TV iframe providers. WatchPlayer applies the current resume point to
 * the final, selected iframe URL, so a remembered server cannot lose it.
 */
export const getMoviePlayers = (id: string | number, startAt?: number): PlayersProps[] => {
  const start = Number.isFinite(startAt) && (startAt ?? 0) > 0 ? `&startAt=${Math.floor(startAt!)}` : "";
  return [
    { title: "RyuFlix 1", source: `https://vidlink.pro/movie/${id}?primaryColor=006fee&autoplay=false${start}`, recommended: true, fast: true, ads: true, resumable: true },
    { title: "RyuFlix 2", source: `https://vidlink.pro/movie/${id}?player=jw&primaryColor=006fee&secondaryColor=a2a2a2&iconColor=eefdec&autoplay=false${start}`, recommended: true, fast: true, ads: true, resumable: true },
    { title: "RyuFlix 3", source: `https://embed.filmu.in/movie/${id}${start ? `?${start.slice(1)}` : ""}`, recommended: true, fast: true, resumable: true },
    { title: "<RyuFlix Embed>", source: `https://embed.vidrift.net/embed/movie/${id}?brand=Ryuflix&brandColor=00d1b2`, ads: true },
    { title: "RyuFlix Embed 2", source: `https://multiembed.mov/?video_id=${id}&tmdb=1`, fast: true, ads: true },
    { title: "RyuFlix 4", source: `https://www.nontongo.win/embed/movie/${id}`, ads: true },
    { title: "RyuFlix 5", source: `https://vidcore.org/embed/movie/${id}?autoplay=true`, fast: true, ads: true },
    { title: "Ryuflix 6", source: `https://www.2embed.cc/embed/${id}`, ads: true },
    { title: "RyuFlix 7", source: `https://vidsrcme.ru/embed/movie/${id}`, ads: true },
    { title: "RyuFlix 8", source: `https://vidsrcme.su/embed/movie/${id}`, ads: true },
    { title: "RyuFlix 9", source: `https://vidsrc.ir/embed/movie/${id}`, ads: true },
    { title: "RyuFlix 10", source: `https://vidsrc-me.ru/embed/movie/${id}`, ads: true },
    { title: "RyuFlix 11", source: `https://vidstuck.xyz/embed/movie/${id}?branding=Ryuflix`, recommended: true, fast: true, ads: true },
    // Videasy's published docs use the .ws /embed route, not the old .to/movie path.
    { title: "RyuFlix 12", source: `https://player.videasy.ws/embed/movie/${id}`, ads: true, resumable: true },
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
    { title: "RyuFlix 1", source: `https://vidlink.pro/tv/${id}/${season}/${episode}?player=jw&primaryColor=f5a524&secondaryColor=a2a2a2&iconColor=eefdec&autoplay=false${start}`, recommended: true, fast: true, ads: true, resumable: true },
    { title: "RyuFlix 2", source: `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=f5a524&autoplay=false${start}`, recommended: true, fast: true, ads: true, resumable: true },
    { title: "RyuFlix 3", source: `https://embed.filmu.in/tv/${id}/${season}/${episode}${start ? `?${start.slice(1)}` : ""}`, recommended: true, fast: true, resumable: true },
    { title: "<RyuFlix Embed>", source: `https://vidsrc.in/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "RyuFlix Embed 2", source: `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${season}&e=${episode}`, fast: true, ads: true },
    { title: "RyuFlix 3", source: `https://filmku.stream/embed/series?tmdb=${id}&sea=${season}&epi=${episode}`, ads: true },
    { title: "RyuFlix 4", source: `https://www.nontongo.win/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "RyuFlix 5", source: `https://vidcore.org/embed/tv/${id}/${season}/${episode}`, fast: true, ads: true },
    { title: "RyuFlix 6", source: `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`, ads: true },
    { title: "RyuFlix 7", source: `https://vidsrc.ru/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "RyuFlix 8", source: `https://vidsrc.ir/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "RyuFlix 9", source: `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`, ads: true },
    { title: "RyuFlix 10", source: `https://vidsrc-me.ir/embed/tv/${id}/${season}/${episode}?autoPlay=false`, ads: true },
    { title: "RyuFlix 11", source: `https://vidstuck.xyz/embed/tv/${id}/${season}/${episode}?episodeSelector=true`, recommended: true, fast: true, ads: true },
    { title: "RyuFlix 12", source: `https://player.videasy.ws/embed/tv/${id}/${season}/${episode}`, ads: true, resumable: true },
  ];
};
