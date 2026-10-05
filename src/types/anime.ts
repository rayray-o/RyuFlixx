export type AnimeTitle = {
  romaji: string | null;
  english: string | null;
  native: string | null;
};

export type AnimeImage = {
  large: string | null;
  extraLarge: string | null;
};

export type AnimeGenre = string;

export type AnimeStatus =
  | "FINISHED"
  | "RELEASING"
  | "NOT_YET_RELEASED"
  | "CANCELLED"
  | "HIATUS";

export type AnimeFormat =
  | "TV"
  | "TV_SHORT"
  | "MOVIE"
  | "SPECIAL"
  | "OVA"
  | "ONA"
  | "MUSIC";

export type AnimeMedia = {
  id: number;
  idMal: number | null;

  title: AnimeTitle;

  description: string | null;

  episodes: number | null;

  duration: number | null;

  status: AnimeStatus | null;

  format: AnimeFormat | null;

  season: string | null;

  seasonYear: number | null;

  averageScore: number | null;

  popularity: number | null;

  genres: AnimeGenre[];

  coverImage: AnimeImage;

  bannerImage: string | null;

  siteUrl: string | null;
};

export type AnimePage = {
  pageInfo: {
    currentPage: number;
    hasNextPage: boolean;
    lastPage: number;
    total: number;
  };

  media: AnimeMedia[];
};

export type AnimeEpisode = {
  episode: number;
  title: string;
};
