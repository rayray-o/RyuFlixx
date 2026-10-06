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

export type MalStudio = {
  id: number;
  name: string;
};

export type MalStartSeason = {
  year?: number | null;
  season?: string | null;
};

export type MalBroadcast = {
  day_of_the_week?: string | null;
  start_time?: string | null;
};

export type MalRelatedAnime = {
  node: MalAnime;

  relation_type?: string | null;

  relation_type_formatted?: string | null;
};

export type MalRecommendation = {
  node: MalAnime;

  num_recommendations?: number | null;
};

export type MalStatistics = {
  status?: {
    watching?: number | null;
    completed?: number | null;
    on_hold?: number | null;
    dropped?: number | null;
    plan_to_watch?: number | null;
  } | null;

  num_list_users?: number | null;
};

export type MalAnime = {
  id: number;

  title: string;

  main_picture?: MalPicture | null;

  alternative_titles?: MalAlternativeTitles | null;

  start_date?: string | null;

  end_date?: string | null;

  synopsis?: string | null;

  mean?: number | null;

  rank?: number | null;

  popularity?: number | null;

  media_type?: string | null;

  status?: string | null;

  genres?: MalGenre[];

  num_episodes?: number | null;

  start_season?: MalStartSeason | null;

  broadcast?: MalBroadcast | null;

  source?: string | null;

  average_episode_duration?: number | null;

  rating?: string | null;

  studios?: MalStudio[];

  pictures?: MalPicture[];

  background?: string | null;

  related_anime?: MalRelatedAnime[];

  recommendations?: MalRecommendation[];

  statistics?: MalStatistics | null;
};

export type MalAnimeListItem = {
  node: MalAnime;

  ranking?: {
    rank?: number | null;
  } | null;
};

export type MalAnimeResponse = {
  data: MalAnimeListItem[];

  paging?: {
    next?: string | null;

    previous?: string | null;
  };
};

export type MalAnimeDetailResponse =
  MalAnime;
