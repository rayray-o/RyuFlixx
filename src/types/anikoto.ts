export type AnikotoEpisode = {
  episode: number;
  title?: string | null;
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
};

export type AnikotoRecentResponse = {
  ok: boolean;
  anime: AnikotoAnime[];
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
