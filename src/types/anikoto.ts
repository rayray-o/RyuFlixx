export type AnikotoEpisode = {
  episode: number;
  title?: string | null;
  episode_embed_id?: string | number | null;
  embed_url?: {
    sub?: string | null;
    dub?: string | null;
  } | null;
};

export type AnikotoAnime = {
  id: string | number;
  title?: string | null;
  name?: string | null;
  romaji?: string | null;
  alternative?: string | null;
  native?: string | null;
  slug?: string | null;
  image?: string | null;
  poster?: string | null;
  cover?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  episodes?: number | null;
  year?: number | null;
  season?: string | null;
  genres?: string[];
  terms_by_type?: Record<
    string,
    string[]
  >;
  rating?: string | number | null;
  duration?: string | number | null;
  airing?: string | null;
  is_sub?: number | boolean | null;
  is_dub?: number | boolean | null;
  mal_id?: number | null;
  anilist_id?: number | null;
  source?: string | null;
  manga?: string | null;
  background_image?: string | null;
};

export type AnikotoRecentResponse = {
  ok: boolean;
  anikoto_domains?: string[];
  data: AnikotoAnime[];
  pagination?: {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
    has_next?: boolean;
  };
};

export type AnikotoSeriesResponse = {
  ok: boolean;
  anime: AnikotoAnime;
  episodes: AnikotoEpisode[];
};
