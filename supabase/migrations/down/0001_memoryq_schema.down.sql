-- Rollback: Drop tables, indexes, triggers, and functions

drop trigger if exists execution_runs_updated_at on execution_runs;

drop function if exists set_updated_at();

drop table if exists code_artifact_summaries;
drop table if exists project_knowledge;
drop table if exists project_lessons;
drop table if exists execution_runs;

drop extension if exists pgcrypto;
