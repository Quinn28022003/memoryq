-- Rollback: Remove embedding columns and vector extension

drop function if exists match_code_artifact_summaries(
  text,
  vector(384),
  integer,
  real
);

drop function if exists match_project_knowledge(
  text,
  vector(384),
  integer,
  real
);

drop function if exists match_project_lessons(
  text,
  text,
  vector(384),
  integer,
  real
);

drop index if exists code_artifact_summaries_embedding_hnsw_idx;
drop index if exists project_knowledge_embedding_hnsw_idx;
drop index if exists project_lessons_embedding_hnsw_idx;

alter table code_artifact_summaries
  drop column if exists embedding;

alter table project_knowledge
  drop column if exists embedding;

alter table project_lessons
  drop column if exists embedding;

drop extension if exists vector;
