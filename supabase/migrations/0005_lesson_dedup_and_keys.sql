-- Migration to add lesson_key and embedding to project_lessons for deduplication and canonical identity

alter table project_lessons
add column if not exists lesson_key text,
add column if not exists embedding vector(384);

-- Create a unique constraint on project_id and lesson_key
-- This allows us to have canonical lessons that are updated rather than duplicated
alter table project_lessons
add constraint project_lessons_unique_key unique (project_id, lesson_key);

-- Create a functional index for case-insensitive lesson text lookups
create index if not exists project_lessons_text_lower_idx
on project_lessons (project_id, lower(lesson_text));

-- Create an HNSW index for similarity search on project_lessons
create index if not exists project_lessons_embedding_hnsw_idx
on project_lessons
using hnsw (embedding vector_cosine_ops);

-- Function to upsert a lesson and merge data if it already exists
create or replace function upsert_project_lesson(
  p_project_id text,
  p_lesson_text text,
  p_lesson_key text,
  p_scope text[],
  p_task_type text,
  p_severity text,
  p_confidence real,
  p_source_run_id uuid,
  p_embedding vector(384)
)
returns project_lessons
language plpgsql
security definer
as $$
declare
  existing_id uuid;
  result project_lessons;
begin
  -- Try to find an existing lesson by key first
  if p_lesson_key is not null then
    -- Check if it matches lesson_key OR if it matches the ID (in case we used ID as key)
    select id into existing_id
    from project_lessons
    where project_id = p_project_id 
      and (lesson_key = p_lesson_key or id::text = p_lesson_key)
    limit 1;
  end if;

  -- If not found by key, try by exact text (case-insensitive)
  if existing_id is null then
    select id into existing_id
    from project_lessons
    where project_id = p_project_id and lower(lesson_text) = lower(p_lesson_text)
    limit 1;
  end if;

  if existing_id is not null then
    -- Update existing lesson
    update project_lessons
    set
      -- We might keep the original text if it's better, or update it
      lesson_text = p_lesson_text,
      -- Merge scopes
      scope = array(select distinct unnest(scope || p_scope)),
      -- Update task type if it was general
      task_type = case when task_type = 'general' then p_task_type else task_type end,
      -- Take the higher severity
      severity = case
        when p_severity = 'high' then 'high'
        when p_severity = 'medium' and severity = 'low' then 'medium'
        else severity
      end,
      -- Update confidence (weighted average or just take higher)
      confidence = (confidence + p_confidence) / 2,
      -- Record the latest source run
      source_run_id = p_source_run_id,
      -- Update embedding
      embedding = p_embedding,
      updated_at = now()
    where id = existing_id
    returning * into result;
  else
    -- Insert new lesson
    insert into project_lessons (
      project_id,
      lesson_text,
      lesson_key,
      scope,
      task_type,
      severity,
      confidence,
      source_run_id,
      embedding
    )
    values (
      p_project_id,
      p_lesson_text,
      p_lesson_key,
      p_scope,
      p_task_type,
      p_severity,
      p_confidence,
      p_source_run_id,
      p_embedding
    )
    returning * into result;
  end if;

  return result;
end;
$$;
