create schema if not exists kinoquiz;

create table if not exists kinoquiz.questions (
  id bigserial primary key,
  tmdb_id bigint not null,
  media_type text not null check (media_type in ('movie', 'series', 'anime')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  title text not null,
  title_ru text not null,
  original_title text not null,
  year int,
  image_url text not null,
  backdrop_path text,
  poster_path text,
  popularity numeric,
  vote_average numeric,
  vote_count int,
  created_at timestamptz not null default now(),
  unique (media_type, tmdb_id)
);

create index if not exists kinoquiz_questions_media_type_idx
  on kinoquiz.questions (media_type);

create index if not exists kinoquiz_questions_difficulty_idx
  on kinoquiz.questions (difficulty);

create index if not exists kinoquiz_questions_media_difficulty_idx
  on kinoquiz.questions (media_type, difficulty);

