export type MalPicture = {
  medium?: string | null;
  large?: string | null;
};

export type MalAlternativeTitles = {
  synonyms?: string[];
  en?: string | null;
  ja?: string | null;
};

export type MalGenre = {
  id: number;
  name: string;
};

export type MalAnime = {
  id: number;

  title: string;

  main_picture?: MalPicture | null;

  alternative_titles?: MalAlternativeTitles | null;

  media_type?: string | null;

  status?: string | null;

  num_episodes?: number | null;

  start_date?: string | null;

  end_date?: string | null;

  synopsis?: string | null;

  mean?: number | null;

  genres?: MalGenre[];

  rank?: number | null;

  popularity?: number | null;
};

export type MalAnimeResponse = {
  data: MalAnime[];

  paging?: {
    next?: string | null;

    previous?: string | null;
  };
};

export type MalAnimeDetailResponse = MalAnime;
