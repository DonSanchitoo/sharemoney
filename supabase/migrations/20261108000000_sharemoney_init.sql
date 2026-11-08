-- ShareMoney : stockage synchronisé des projets (loyer, projets de groupe, trousseau).
--
-- Modèle d'accès « capacité » : chaque projet a un jeton secret (token) qui
-- circule dans le lien d'invitation. Les tables ne sont pas accessibles
-- directement (RLS activé, aucune policy) : tout passe par des fonctions
-- SECURITY DEFINER qui ne renvoient ou n'écrivent que les projets dont
-- l'appelant fournit le jeton.

create table if not exists public.sm_projects (
  id          uuid primary key,
  token       text not null unique check (length(token) between 16 and 64),
  kind        text not null check (kind in ('rent', 'group', 'keyring')),
  data        jsonb not null default '{}'::jsonb,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default clock_timestamp()
);

create table if not exists public.sm_items (
  id          uuid primary key,
  project_id  uuid not null references public.sm_projects(id) on delete cascade,
  type        text not null check (length(type) <= 32),
  data        jsonb not null default '{}'::jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default clock_timestamp()
);
create index if not exists sm_items_project_updated on public.sm_items (project_id, updated_at);

create table if not exists public.sm_receipts (
  id          uuid primary key,
  project_id  uuid not null references public.sm_projects(id) on delete cascade,
  data        text not null check (length(data) <= 3000000),
  created_at  timestamptz not null default now()
);
create index if not exists sm_receipts_project on public.sm_receipts (project_id);

alter table public.sm_projects enable row level security;
alter table public.sm_items    enable row level security;
alter table public.sm_receipts enable row level security;
revoke all on public.sm_projects, public.sm_items, public.sm_receipts from anon, authenticated;

-- Lecture incrémentale. p_req = [{"t": "<token>", "s": "<timestamp ou null>"}]
create or replace function public.sm_pull(p_req jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r        record;
  v_pid    uuid;
  v_max    timestamptz;
  v_projs  jsonb := '[]'::jsonb;
  v_items  jsonb := '[]'::jsonb;
  v_curs   jsonb := '{}'::jsonb;
  v_miss   jsonb := '[]'::jsonb;
begin
  if p_req is null or jsonb_typeof(p_req) <> 'array' then
    return jsonb_build_object('projects', v_projs, 'items', v_items, 'cursors', v_curs, 'missing', v_miss);
  end if;
  if jsonb_array_length(p_req) > 500 then
    raise exception 'too many tokens';
  end if;

  for r in
    select e->>'t' as t, nullif(e->>'s', '')::timestamptz as s
    from jsonb_array_elements(p_req) as e
  loop
    select p.id into v_pid from public.sm_projects p where p.token = r.t;
    if v_pid is null then
      v_miss := v_miss || to_jsonb(r.t);
      continue;
    end if;

    v_projs := v_projs || coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'token', p.token, 'kind', p.kind, 'data', p.data,
        'deleted', p.deleted, 'updatedAt', p.updated_at))
      from public.sm_projects p
      where p.id = v_pid and (r.s is null or p.updated_at > r.s)
    ), '[]'::jsonb);

    v_items := v_items || coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'projectId', i.project_id, 'type', i.type, 'data', i.data,
        'deleted', i.deleted, 'updatedAt', i.updated_at))
      from public.sm_items i
      where i.project_id = v_pid and (r.s is null or i.updated_at > r.s)
    ), '[]'::jsonb);

    select greatest(
      (select p.updated_at from public.sm_projects p where p.id = v_pid),
      (select max(i.updated_at) from public.sm_items i where i.project_id = v_pid)
    ) into v_max;
    v_curs := v_curs || jsonb_build_object(r.t, v_max);
  end loop;

  return jsonb_build_object('projects', v_projs, 'items', v_items, 'cursors', v_curs, 'missing', v_miss);
end;
$$;

-- Écriture par lot. Un projet n'est créé/modifié que si son jeton est fourni,
-- un élément que si le jeton de son projet est fourni.
create or replace function public.sm_push(p_tokens text[], p_projects jsonb, p_items jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e          jsonb;
  v_pid      uuid;
  v_rejected jsonb := '[]'::jsonb;
begin
  if coalesce(array_length(p_tokens, 1), 0) > 500 then
    raise exception 'too many tokens';
  end if;
  if coalesce(jsonb_array_length(p_projects), 0) > 200 or coalesce(jsonb_array_length(p_items), 0) > 2000 then
    raise exception 'batch too large';
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_projects, '[]'::jsonb)) loop
    if not ((e->>'token') = any(p_tokens)) or pg_column_size(e->'data') > 300000 then
      v_rejected := v_rejected || to_jsonb(e->>'id');
      continue;
    end if;
    insert into public.sm_projects as p (id, token, kind, data, deleted)
    values ((e->>'id')::uuid, e->>'token', e->>'kind', coalesce(e->'data', '{}'::jsonb), coalesce((e->>'deleted')::boolean, false))
    on conflict (id) do update
      set data = excluded.data, deleted = excluded.deleted, updated_at = clock_timestamp()
      where p.token = excluded.token;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select p.id into v_pid
    from public.sm_projects p
    where p.id = (e->>'projectId')::uuid and p.token = any(p_tokens);
    if v_pid is null or pg_column_size(e->'data') > 200000 then
      v_rejected := v_rejected || to_jsonb(e->>'id');
      continue;
    end if;
    insert into public.sm_items as i (id, project_id, type, data, deleted)
    values ((e->>'id')::uuid, v_pid, e->>'type', coalesce(e->'data', '{}'::jsonb), coalesce((e->>'deleted')::boolean, false))
    on conflict (id) do update
      set type = excluded.type, data = excluded.data, deleted = excluded.deleted, updated_at = clock_timestamp()
      where i.project_id = excluded.project_id;
  end loop;

  return jsonb_build_object('ok', true, 'rejected', v_rejected);
end;
$$;

-- Photos de tickets (JPEG compressé en data URL).
create or replace function public.sm_receipt_put(p_token text, p_project uuid, p_id uuid, p_data text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.sm_projects p where p.id = p_project and p.token = p_token) then
    return false;
  end if;
  insert into public.sm_receipts (id, project_id, data)
  values (p_id, p_project, p_data)
  on conflict (id) do nothing;
  return true;
end;
$$;

create or replace function public.sm_receipt_get(p_token text, p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'data', r.data)), '[]'::jsonb)
  from public.sm_receipts r
  join public.sm_projects p on p.id = r.project_id
  where p.token = p_token and r.id = any(p_ids);
$$;

create or replace function public.sm_receipt_del(p_token text, p_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with d as (
    delete from public.sm_receipts r
    using public.sm_projects p
    where p.id = r.project_id and p.token = p_token and r.id = p_id
    returning r.id
  )
  select exists (select 1 from d);
$$;

revoke execute on function public.sm_pull(jsonb) from public;
revoke execute on function public.sm_push(text[], jsonb, jsonb) from public;
revoke execute on function public.sm_receipt_put(text, uuid, uuid, text) from public;
revoke execute on function public.sm_receipt_get(text, uuid[]) from public;
revoke execute on function public.sm_receipt_del(text, uuid) from public;
grant execute on function public.sm_pull(jsonb) to anon, authenticated;
grant execute on function public.sm_push(text[], jsonb, jsonb) to anon, authenticated;
grant execute on function public.sm_receipt_put(text, uuid, uuid, text) to anon, authenticated;
grant execute on function public.sm_receipt_get(text, uuid[]) to anon, authenticated;
grant execute on function public.sm_receipt_del(text, uuid) to anon, authenticated;
