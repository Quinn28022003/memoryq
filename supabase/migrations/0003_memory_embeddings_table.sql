create extension if not exists vector;

create table if not exists memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_type text not null default 'project',
  owner_id text not null,
  source_type text not null,
  source_id text not null,
  chunk_index integer not null default 0,
  scene_label text not null default 'Scene',
  content text not null,
  scope text[] not null default '{}',
  task_type text,
  confidence real not null default 0.5,
  embedding vector(384) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_embeddings_owner_type_check check (owner_type in ('project', 'agent', 'user')),
  constraint memory_embeddings_source_type_check check (source_type in ('lesson', 'knowledge', 'artifact')),
  constraint memory_embeddings_confidence_range check (confidence >= 0 and confidence <= 1),
  constraint memory_embeddings_unique_chunk unique (
    project_id,
    owner_type,
    owner_id,
    source_type,
    source_id,
    chunk_index
  )
);

create index if not exists memory_embeddings_owner_source_idx
  on memory_embeddings (project_id, owner_type, owner_id, source_type);

create index if not exists memory_embeddings_scope_gin_idx
  on memory_embeddings using gin (scope);

create index if not exists memory_embeddings_embedding_hnsw_idx
  on memory_embeddings
  using hnsw (embedding vector_cosine_ops);

drop trigger if exists memory_embeddings_updated_at on memory_embeddings;
create trigger memory_embeddings_updated_at
before update on memory_embeddings
for each row
execute function set_updated_at();

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
