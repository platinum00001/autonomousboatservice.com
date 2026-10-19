-- Autonomous Boat Service — Supabase schema (schema: boatservice) in the shared "james-sites" project.
-- Lives in its OWN schema; never touches other sites' tables, auth.users triggers, or the Site URL.
-- Safe to re-run.
-- Security model (Row Level Security on every table):
--   * Anyone (no login) can SEND a quote request, a partner-shop application, or a data request.
--     Rate limits + validation run in BEFORE INSERT triggers; the honeypot is checked in the
--     edge function "boatservice-api".
--   * Only admins (rows in boatservice.admins) can READ, update or delete anything.
--   * There are no public member accounts. Staff log in with email (magic link or password).
-- Photos go to the PRIVATE storage bucket "boatservice-photos" (upload-only for the public,
-- readable by admins through signed URLs).
-- The website talks to the database through the edge function "boatservice-api", which runs each
-- query as the anon / authenticated role with the caller's identity, so these RLS rules apply.
-- (Optional) exposing "boatservice" in Data API settings also lets supabase-js query it directly.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists boatservice;

create table if not exists boatservice.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists boatservice.quote_requests (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 120),
  phone          text not null check (char_length(phone) between 7 and 30),
  email          text check (email is null or (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  boat_make      text check (char_length(boat_make) <= 80),
  boat_model     text check (char_length(boat_model) <= 80),
  boat_length_ft numeric(5,1) check (boat_length_ft is null or boat_length_ft between 5 and 300),
  engine         text check (char_length(engine) <= 160),
  location       text not null check (char_length(location) between 2 and 160),
  service        text not null check (service in ('engine_outboard','engine_inboard','winterizing','shrink_wrap',
                   'hull_fiberglass','electrical','bottom_paint','mobile_dockside','emergency_towing','other')),
  urgency        text not null default 'flexible' check (urgency in ('emergency','this_week','this_month','flexible')),
  details        text check (char_length(details) <= 3000),
  photo_paths    text[] not null default '{}' check (cardinality(photo_paths) <= 6),
  consent_share  boolean not null check (consent_share),           -- must agree to share with partner shops
  source_page    text check (char_length(source_page) <= 200),
  client_hash    text check (char_length(client_hash) <= 80),     -- salted hash of IP, set by the edge function (rate limits)
  status         text not null default 'new' check (status in ('new','sent_to_shop','closed')),
  assigned_shop  text check (char_length(assigned_shop) <= 160),
  staff_note     text check (char_length(staff_note) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists bs_quotes_created_idx on boatservice.quote_requests (created_at desc);
create index if not exists bs_quotes_status_idx on boatservice.quote_requests (status, created_at desc);

create table if not exists boatservice.partner_applications (
  id           uuid primary key default gen_random_uuid(),
  shop_name    text not null check (char_length(shop_name) between 2 and 160),
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  phone        text not null check (char_length(phone) between 7 and 30),
  email        text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website      text check (char_length(website) <= 300),
  services     text[] not null default '{}' check (cardinality(services) <= 12),
  service_area text not null check (char_length(service_area) between 2 and 300),
  notes        text check (char_length(notes) <= 2000),
  client_hash  text check (char_length(client_hash) <= 80),
  status       text not null default 'new' check (status in ('new','contacted','approved','declined')),
  staff_note   text check (char_length(staff_note) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists bs_partners_created_idx on boatservice.partner_applications (created_at desc);

-- Privacy requests ("delete my data") from the privacy page. No account needed.
create table if not exists boatservice.data_requests (
  id          uuid primary key default gen_random_uuid(),
  contact     text not null check (char_length(contact) between 5 and 200),  -- the phone or email used on the form
  note        text check (char_length(note) <= 1000),
  client_hash text check (char_length(client_hash) <= 80),
  status      text not null default 'new' check (status in ('new','done')),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------- helpers
create or replace function boatservice.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists bs_quotes_updated on boatservice.quote_requests;
create trigger bs_quotes_updated before update on boatservice.quote_requests for each row execute function boatservice.set_updated_at();
drop trigger if exists bs_partners_updated on boatservice.partner_applications;
create trigger bs_partners_updated before update on boatservice.partner_applications for each row execute function boatservice.set_updated_at();

create or replace function boatservice.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from boatservice.admins a where a.user_id = (select auth.uid()))
$$;

-- Insert guards: force staff-only fields, validate photo paths, and rate-limit.
create or replace function boatservice.guard_quote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p text; digits text := regexp_replace(coalesce(new.phone,''), '\D', '', 'g');
begin
  new.status := 'new'; new.assigned_shop := null; new.staff_note := null;
  new.created_at := now(); new.updated_at := now();
  new.email := nullif(lower(trim(coalesce(new.email,''))), '');
  if char_length(digits) < 7 then raise exception 'Please enter a phone number we can reach you at.' using errcode = '22023'; end if;
  foreach p in array new.photo_paths loop
    if p !~ '^quotes/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' then raise exception 'Invalid photo reference' using errcode = '22023'; end if;
  end loop;
  if (select count(*) from boatservice.quote_requests q where regexp_replace(q.phone, '\D', '', 'g') = digits
        and q.created_at > now() - interval '1 hour') >= 4
     or (new.email is not null and (select count(*) from boatservice.quote_requests q
        where q.email = new.email and q.created_at > now() - interval '1 hour') >= 4)
     or (new.client_hash is not null and (select count(*) from boatservice.quote_requests q
        where q.client_hash = new.client_hash and q.created_at > now() - interval '1 hour') >= 6) then
    raise exception 'Too many requests from you in the last hour. Please try again later.' using errcode = '54000';
  end if;
  if (select count(*) from boatservice.quote_requests q where q.created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'We are very busy right now. Please try again in a few minutes.' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists bs_quotes_guard on boatservice.quote_requests;
create trigger bs_quotes_guard before insert on boatservice.quote_requests for each row execute function boatservice.guard_quote();

create or replace function boatservice.guard_partner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.status := 'new'; new.staff_note := null; new.created_at := now(); new.updated_at := now();
  new.email := lower(trim(new.email));
  if (select count(*) from boatservice.partner_applications a where a.email = new.email and a.created_at > now() - interval '1 day') >= 3
     or (new.client_hash is not null and (select count(*) from boatservice.partner_applications a
        where a.client_hash = new.client_hash and a.created_at > now() - interval '1 hour') >= 4) then
    raise exception 'We already have your application. We will be in touch.' using errcode = '54000';
  end if;
  if (select count(*) from boatservice.partner_applications a where a.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'We are very busy right now. Please try again in a few minutes.' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists bs_partners_guard on boatservice.partner_applications;
create trigger bs_partners_guard before insert on boatservice.partner_applications for each row execute function boatservice.guard_partner();

create or replace function boatservice.guard_data_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.status := 'new'; new.created_at := now();
  if (select count(*) from boatservice.data_requests d where d.created_at > now() - interval '1 hour'
        and (d.contact = new.contact or (new.client_hash is not null and d.client_hash = new.client_hash))) >= 3
     or (select count(*) from boatservice.data_requests d where d.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Too many requests. Please try again later.' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists bs_data_guard on boatservice.data_requests;
create trigger bs_data_guard before insert on boatservice.data_requests for each row execute function boatservice.guard_data_request();

-- ----------------------------------------------------------------------- RLS
alter table boatservice.admins               enable row level security;
alter table boatservice.quote_requests       enable row level security;
alter table boatservice.partner_applications enable row level security;
alter table boatservice.data_requests        enable row level security;

drop policy if exists admins_select_self on boatservice.admins;
create policy admins_select_self on boatservice.admins for select to authenticated using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['quote_requests','partner_applications','data_requests'] loop
    execute format('drop policy if exists %I on boatservice.%I', t || '_insert_public', t);
    execute format('drop policy if exists %I on boatservice.%I', t || '_admin_select', t);
    execute format('drop policy if exists %I on boatservice.%I', t || '_admin_update', t);
    execute format('drop policy if exists %I on boatservice.%I', t || '_admin_delete', t);
    execute format('create policy %I on boatservice.%I for insert to anon, authenticated with check (status = %L)', t || '_insert_public', t, 'new');
    execute format('create policy %I on boatservice.%I for select to authenticated using ((select boatservice.is_admin()))', t || '_admin_select', t);
    execute format('create policy %I on boatservice.%I for update to authenticated using ((select boatservice.is_admin())) with check ((select boatservice.is_admin()))', t || '_admin_update', t);
    execute format('create policy %I on boatservice.%I for delete to authenticated using ((select boatservice.is_admin()))', t || '_admin_delete', t);
  end loop;
end $$;

-- ----------------------------------------------------------------- functions
create or replace function boatservice.my_roles() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('admin', boatservice.is_admin())
$$;

create or replace function boatservice.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not boatservice.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'generated_at', now(),
    'leads_total', (select count(*) from boatservice.quote_requests),
    'leads_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from boatservice.quote_requests group by status) s), '{}'::jsonb),
    'leads_last_7d', (select count(*) from boatservice.quote_requests where created_at > now() - interval '7 days'),
    'emergencies_open', (select count(*) from boatservice.quote_requests where urgency = 'emergency' and status = 'new'),
    'partners_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from boatservice.partner_applications group by status) s), '{}'::jsonb),
    'data_requests_open', (select count(*) from boatservice.data_requests where status = 'new'));
end $$;

create or replace function boatservice.health() returns jsonb
language sql stable set search_path = '' as $$ select jsonb_build_object('ok', true, 'schema', 'boatservice', 'version', 'v1') $$;

-- ---------------------------------------------------------------- privileges
revoke all on all tables in schema boatservice from anon, authenticated, public;
revoke all on all functions in schema boatservice from anon, authenticated, public;
grant usage on schema boatservice to anon, authenticated, service_role;
grant insert on boatservice.quote_requests, boatservice.partner_applications, boatservice.data_requests to anon, authenticated;
grant select, update, delete on boatservice.quote_requests, boatservice.partner_applications, boatservice.data_requests to authenticated;
grant select on boatservice.admins to authenticated;
grant all on all tables in schema boatservice to service_role;
grant execute on function boatservice.health(), boatservice.is_admin() to anon, authenticated;  -- is_admin is used in policies; false for anon
grant execute on function boatservice.my_roles(), boatservice.admin_stats() to authenticated;
alter default privileges in schema boatservice revoke execute on functions from public;

-- ------------------------------------------------------------ photo storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boatservice-photos', 'boatservice-photos', false, 8388608,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "boatservice photos: anyone uploads" on storage.objects;
drop policy if exists "boatservice photos: admin read" on storage.objects;
drop policy if exists "boatservice photos: admin delete" on storage.objects;
create policy "boatservice photos: anyone uploads" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'boatservice-photos' and name ~ '^quotes/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$');
create policy "boatservice photos: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'boatservice-photos' and (select boatservice.is_admin()));
create policy "boatservice photos: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'boatservice-photos' and (select boatservice.is_admin()));
