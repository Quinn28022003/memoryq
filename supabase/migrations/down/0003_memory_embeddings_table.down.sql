-- Rollback: Drop memory_embeddings table and related objects

drop function if exists match_memory_embeddings(
  text,
  text,
  text,
  text,
  text,
  vector(384),
  integer,
  real
);

drop trigger if exists memory_embeddings_updated_at on memory_embeddings;

drop index if exists memory_embeddings_embedding_hnsw_idx;
drop index if exists memory_embeddings_scope_gin_idx;
drop index if exists memory_embeddings_owner_source_idx;

drop table if exists memory_embeddings;
