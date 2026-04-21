create extension if not exists pgcrypto;

create table if not exists execution_runs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  prompt text not null,
  task_type text not null,
  scope text[] not null default '{}',
  status text not null default 'planned',
  brief_payload jsonb,
  result_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint execution_runs_confidence_payload check (
    brief_payload is null
    or jsonb_typeof(brief_payload) = 'object'
  )
);

create index if not exists execution_runs_project_created_idx
  on execution_runs (project_id, created_at desc);
create index if not exists execution_runs_task_type_idx
  on execution_runs (project_id, task_type);
create index if not exists execution_runs_scope_gin_idx
  on execution_runs using gin (scope);

create table if not exists project_lessons (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  lesson_text text not null,
  scope text[] not null default '{}',
  task_type text not null,
  severity text not null default 'medium',
  confidence real not null default 0.5,
  source_run_id uuid references execution_runs (id) on delete set null,
  reuse_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_lessons_confidence_range check (confidence >= 0 and confidence <= 1)
);

create index if not exists project_lessons_project_task_idx
  on project_lessons (project_id, task_type);
create index if not exists project_lessons_project_reuse_conf_idx
  on project_lessons (project_id, reuse_count desc, confidence desc);
create index if not exists project_lessons_scope_gin_idx
  on project_lessons using gin (scope);

create table if not exists project_knowledge (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  note_type text not null,
  note_text text not null,
  scope text[] not null default '{}',
  confidence real not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_knowledge_confidence_range check (confidence >= 0 and confidence <= 1),
  constraint project_knowledge_unique_note unique (project_id, note_type, note_text)
);

create index if not exists project_knowledge_project_conf_idx
  on project_knowledge (project_id, confidence desc);
create index if not exists project_knowledge_scope_gin_idx
  on project_knowledge using gin (scope);

create table if not exists code_artifact_summaries (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  file_path text not null,
  module_name text not null,
  summary text not null,
  scope text[] not null default '{}',
  confidence real not null default 0.5,
  updated_at timestamptz not null default now(),
  constraint code_artifact_summaries_confidence_range check (confidence >= 0 and confidence <= 1),
  constraint code_artifact_summaries_unique_file unique (project_id, file_path)
);

create index if not exists code_artifact_summaries_project_updated_idx
  on code_artifact_summaries (project_id, updated_at desc);
create index if not exists code_artifact_summaries_scope_gin_idx
  on code_artifact_summaries using gin (scope);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists execution_runs_updated_at on execution_runs;
create trigger execution_runs_updated_at
before update on execution_runs
for each row
execute function set_updated_at();

drop trigger if exists project_lessons_updated_at on project_lessons;
create trigger project_lessons_updated_at
before update on project_lessons
for each row
execute function set_updated_at();

drop trigger if exists project_knowledge_updated_at on project_knowledge;
create trigger project_knowledge_updated_at
before update on project_knowledge
for each row
execute function set_updated_at();

create or replace function increment_lesson_reuse_count(lesson_ids uuid[])
returns void
language sql
security definer
as $$
  update project_lessons
  set reuse_count = reuse_count + 1,
      updated_at = now()
  where id = any(lesson_ids);
$$;
