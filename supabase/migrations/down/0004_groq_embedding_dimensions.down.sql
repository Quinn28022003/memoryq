-- Rollback: Revert embedding dimensions from 768 back to 384

drop function if exists match_memory_embeddings(
  text,
  text,
  text,
  text,
  text,
  vector(768),
  integer,
  real
);

drop index if exists memory_embeddings_embedding_hnsw_idx;

-- Revert embedding column type from 768 to 384
alter table memory_embeddings
  alter column embedding type vector(384)
  using embedding::vector(384);

create index if not exists memory_embeddings_embedding_hnsw_idx
  on memory_embeddings
  using hnsw (embedding vector_cosine_ops);

create or replace function match_memory_embeddings(
  match_project_id text,
  match_owner_type text,
  match_owner_id text,
  match_source_type text,
  match_task_type text,
  query_embedding vector(384),
  match_count integer default 8,
  match_threshold real default 0.1
)
returns setof memory_embeddings
language sql
stable
security definer
as $$
  select *
  from memory_embeddings
  where project_id = match_project_id
    and (match_owner_type is null or owner_type = match_owner_type)
    and (match_owner_id is null or owner_id = match_owner_id)
    and source_type = match_source_type
    and (
      match_task_type is null
      or task_type is null
      or task_type = match_task_type
      or task_type = 'general'
    )
    and (1 - (embedding <=> query_embedding)) >= match_threshold
  order by embedding <=> query_embedding, confidence desc, updated_at desc
  limit match_count;
$$;
