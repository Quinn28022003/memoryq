create extension if not exists vector;

alter table project_lessons
  add column if not exists embedding vector(384);

alter table project_knowledge
  add column if not exists embedding vector(384);

alter table code_artifact_summaries
  add column if not exists embedding vector(384);

create index if not exists project_lessons_embedding_hnsw_idx
  on project_lessons
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create index if not exists project_knowledge_embedding_hnsw_idx
  on project_knowledge
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create index if not exists code_artifact_summaries_embedding_hnsw_idx
  on code_artifact_summaries
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create or replace function match_project_lessons(
  match_project_id text,
  match_task_type text,
  query_embedding vector(384),
  match_count integer default 6,
  match_threshold real default 0.1
)
returns setof project_lessons
language sql
stable
security definer
as $$
  select *
  from project_lessons
  where project_id = match_project_id
    and embedding is not null
    and confidence >= 0.3
    and (
      match_task_type = 'general'
      or task_type in (match_task_type, 'general')
    )
    and (1 - (embedding <=> query_embedding)) >= match_threshold
  order by embedding <=> query_embedding, reuse_count desc, confidence desc
  limit match_count;
$$;

create or replace function match_project_knowledge(
  match_project_id text,
  query_embedding vector(384),
  match_count integer default 6,
  match_threshold real default 0.1
)
returns setof project_knowledge
language sql
stable
security definer
as $$
  select *
  from project_knowledge
  where project_id = match_project_id
    and embedding is not null
    and confidence >= 0.3
    and (1 - (embedding <=> query_embedding)) >= match_threshold
  order by embedding <=> query_embedding, confidence desc
  limit match_count;
$$;

create or replace function match_code_artifact_summaries(
  match_project_id text,
  query_embedding vector(384),
  match_count integer default 8,
  match_threshold real default 0.1
)
returns setof code_artifact_summaries
language sql
stable
security definer
as $$
  select *
  from code_artifact_summaries
  where project_id = match_project_id
    and embedding is not null
    and confidence >= 0.2
    and (1 - (embedding <=> query_embedding)) >= match_threshold
  order by embedding <=> query_embedding, confidence desc, updated_at desc
  limit match_count;
$$;
