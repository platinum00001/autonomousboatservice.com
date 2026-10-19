-- ============================================================================ v2 (Oct 2026)
-- Customer accounts (optional), parts requests, and the BLIND-LEAD offer flow.
-- Safe to re-run. Same rules as v1: own schema only, RLS on every table, no anon reads.
--
-- Blind-lead flow:
--   staff "Offer to shops" -> one row per approved partner shop in boatservice.lead_offers with an
--   ANONYMIZED summary (boat, engine, service/part, general area, urgency, photos; never the
--   customer's name, phone, email, exact marina or free-text notes unless staff wrote them).
--   Each shop gets a random token (shown to staff ONCE); only its SHA-256 hash is stored.
--   The shop opens lead.html#t=<token>: Interested / Pass, note, optional quote range.
--   Staff "Release contact to <shop>" -> that offer becomes 'released', the lead is assigned, other
--   offers are withdrawn, and full contact details appear ONLY through that shop's token.
--   Tokens expire 14 days after they're issued (release extends to 14 days after release).

-- ------------------------------------------------------------- quote changes
alter table boatservice.quote_requests add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table boatservice.quote_requests add column if not exists area text check (char_length(area) <= 120);
alter table boatservice.quote_requests add column if not exists assigned_partner uuid references boatservice.partner_applications (id) on delete set null;
alter table boatservice.quote_requests drop constraint if exists quote_requests_status_check;
alter table boatservice.quote_requests add constraint quote_requests_status_check check (status in ('new','offered','sent_to_shop','closed'));
create index if not exists bs_quotes_user_idx on boatservice.quote_requests (user_id) where user_id is not null;

-- ------------------------------------------------------------- parts requests
create table if not exists boatservice.parts_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete set null,
  name           text not null check (char_length(name) between 1 and 120),
  phone          text not null check (char_length(phone) between 7 and 30),
  email          text check (email is null or (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  part_name      text not null check (char_length(part_name) between 2 and 160),
  part_number    text check (char_length(part_number) <= 80),
  make           text not null check (char_length(make) between 1 and 80),   -- boat or engine make
  model          text check (char_length(model) <= 80),
  model_year     int  check (model_year is null or model_year between 1940 and 2100),
  serial         text check (char_length(serial) <= 80),
  fulfillment    text not null default 'either' check (fulfillment in ('pickup','ship','either')),
  location       text not null check (char_length(location) between 2 and 160), -- town or ZIP
  details        text check (char_length(details) <= 2000),
  photo_paths    text[] not null default '{}' check (cardinality(photo_paths) <= 4),
  consent_share  boolean not null check (consent_share),
  source_page    text check (char_length(source_page) <= 200),
  client_hash    text check (char_length(client_hash) <= 80),
  status         text not null default 'new' check (status in ('new','offered','sent_to_shop','closed')),
  area           text check (char_length(area) <= 120),
  assigned_shop  text check (char_length(assigned_shop) <= 160),
  assigned_partner uuid references boatservice.partner_applications (id) on delete set null,
  staff_note     text check (char_length(staff_note) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists bs_parts_created_idx on boatservice.parts_requests (created_at desc);
create index if not exists bs_parts_user_idx on boatservice.parts_requests (user_id) where user_id is not null;
drop trigger if exists bs_parts_updated on boatservice.parts_requests;
create trigger bs_parts_updated before update on boatservice.parts_requests for each row execute function boatservice.set_updated_at();

-- Quote guard v2: also forces user_id = the signed-in caller (or null) and clears staff-only fields.
create or replace function boatservice.guard_quote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p text; digits text := regexp_replace(coalesce(new.phone,''), '\D', '', 'g');
begin
  new.status := 'new'; new.assigned_shop := null; new.assigned_partner := null; new.area := null; new.staff_note := null;
  new.user_id := (select auth.uid());
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

create or replace function boatservice.guard_part() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p text; digits text := regexp_replace(coalesce(new.phone,''), '\D', '', 'g');
begin
  new.status := 'new'; new.assigned_shop := null; new.assigned_partner := null; new.area := null; new.staff_note := null;
  new.user_id := (select auth.uid());
  new.created_at := now(); new.updated_at := now();
  new.email := nullif(lower(trim(coalesce(new.email,''))), '');
  if char_length(digits) < 7 then raise exception 'Please enter a phone number we can reach you at.' using errcode = '22023'; end if;
  foreach p in array new.photo_paths loop
    if p !~ '^parts/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' then raise exception 'Invalid photo reference' using errcode = '22023'; end if;
  end loop;
  if (select count(*) from boatservice.parts_requests q where regexp_replace(q.phone, '\D', '', 'g') = digits
        and q.created_at > now() - interval '1 hour') >= 5
     or (new.client_hash is not null and (select count(*) from boatservice.parts_requests q
        where q.client_hash = new.client_hash and q.created_at > now() - interval '1 hour') >= 8) then
    raise exception 'Too many requests from you in the last hour. Please try again later.' using errcode = '54000';
  end if;
  if (select count(*) from boatservice.parts_requests q where q.created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'We are very busy right now. Please try again in a few minutes.' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists bs_parts_guard on boatservice.parts_requests;
create trigger bs_parts_guard before insert on boatservice.parts_requests for each row execute function boatservice.guard_part();

-- ------------------------------------------------------------- blind offers
create table if not exists boatservice.lead_offers (
  id           uuid primary key default gen_random_uuid(),
  lead_kind    text not null check (lead_kind in ('quote','part')),
  quote_id     uuid references boatservice.quote_requests (id) on delete cascade,
  part_id      uuid references boatservice.parts_requests (id) on delete cascade,
  partner_id   uuid not null references boatservice.partner_applications (id) on delete cascade,
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  summary      jsonb not null,
  status       text not null default 'offered' check (status in ('offered','interested','passed','released','withdrawn')),
  shop_note    text check (char_length(shop_note) <= 1000),
  quote_low    numeric(10,2) check (quote_low is null or quote_low >= 0),
  quote_high   numeric(10,2) check (quote_high is null or quote_high >= 0),
  viewed_at    timestamptz,
  responded_at timestamptz,
  released_at  timestamptz,
  expires_at   timestamptz not null default now() + interval '14 days',
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lead_offers_kind_ref check ((lead_kind = 'quote' and quote_id is not null and part_id is null) or (lead_kind = 'part' and part_id is not null and quote_id is null)),
  constraint lead_offers_range check (quote_low is null or quote_high is null or quote_high >= quote_low),
  constraint lead_offers_quote_partner unique (quote_id, partner_id),
  constraint lead_offers_part_partner unique (part_id, partner_id)
);
create index if not exists bs_offers_partner_idx on boatservice.lead_offers (partner_id);
create index if not exists bs_offers_part_idx on boatservice.lead_offers (part_id);
drop trigger if exists bs_offers_updated on boatservice.lead_offers;
create trigger bs_offers_updated before update on boatservice.lead_offers for each row execute function boatservice.set_updated_at();

-- ----------------------------------------------------------------------- RLS
alter table boatservice.parts_requests enable row level security;
alter table boatservice.lead_offers    enable row level security;
drop policy if exists parts_requests_insert_public on boatservice.parts_requests;
drop policy if exists parts_requests_admin_select on boatservice.parts_requests;
drop policy if exists parts_requests_admin_update on boatservice.parts_requests;
drop policy if exists parts_requests_admin_delete on boatservice.parts_requests;
create policy parts_requests_insert_public on boatservice.parts_requests for insert to anon, authenticated
  with check (status = 'new' and user_id is not distinct from (select auth.uid()));
create policy parts_requests_admin_select on boatservice.parts_requests for select to authenticated using ((select boatservice.is_admin()));
create policy parts_requests_admin_update on boatservice.parts_requests for update to authenticated using ((select boatservice.is_admin())) with check ((select boatservice.is_admin()));
create policy parts_requests_admin_delete on boatservice.parts_requests for delete to authenticated using ((select boatservice.is_admin()));
-- quotes: tighten insert so nobody can attach a request to someone else's account
drop policy if exists quote_requests_insert_public on boatservice.quote_requests;
create policy quote_requests_insert_public on boatservice.quote_requests for insert to anon, authenticated
  with check (status = 'new' and user_id is not distinct from (select auth.uid()));
-- offers: staff only. Shops never query the table; they go through offer_view/offer_respond with a token.
drop policy if exists lead_offers_admin_all on boatservice.lead_offers;
create policy lead_offers_admin_all on boatservice.lead_offers for all to authenticated
  using ((select boatservice.is_admin())) with check ((select boatservice.is_admin()));

-- ----------------------------------------------------------------- helpers
create or replace function boatservice.token_hash(t text) returns text
language sql immutable set search_path = '' as $$ select encode(extensions.digest(coalesce(t,''), 'sha256'), 'hex') $$;

-- Remove emails and phone-like numbers from free text (used for staff-written job notes).
create or replace function boatservice.scrub(t text) returns text
language sql immutable set search_path = '' as $$
  select nullif(trim(regexp_replace(regexp_replace(coalesce(t,''),
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email removed]', 'g'),
    '(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', '[phone removed]', 'g')), '')
$$;

-- Staff: create (or re-issue) an offer for one approved partner. Returns the raw token ONCE.
create or replace function boatservice.create_offer(p_kind text, p_lead uuid, p_partner uuid, p_area text, p_notes text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare tok text := encode(extensions.gen_random_bytes(24), 'hex'); s jsonb; pa record; oid uuid; q record; pr record;
begin
  if not boatservice.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select id, shop_name, email, status into pa from boatservice.partner_applications where id = p_partner;
  if pa.id is null or pa.status <> 'approved' then raise exception 'Only approved partner shops can receive offers' using errcode = '22023'; end if;
  if coalesce(trim(p_area),'') = '' then raise exception 'Enter a general area (town) for the shop' using errcode = '22023'; end if;
  if p_kind = 'quote' then
    select * into q from boatservice.quote_requests where id = p_lead;
    if q.id is null then raise exception 'Lead not found' using errcode = '22023'; end if;
    if q.status in ('sent_to_shop','closed') then raise exception 'This lead is already assigned or closed' using errcode = '22023'; end if;
    s := jsonb_build_object('kind','quote','service',q.service,'urgency',q.urgency,'boat_make',q.boat_make,'boat_model',q.boat_model,
      'boat_length_ft',q.boat_length_ft,'engine',q.engine,'area',left(trim(p_area),120),'notes',left(boatservice.scrub(p_notes),1500),
      'photos',to_jsonb(q.photo_paths),'requested_at',date_trunc('day', q.created_at));
    update boatservice.quote_requests set area = left(trim(p_area),120), status = case when status = 'new' then 'offered' else status end where id = q.id;
    insert into boatservice.lead_offers (lead_kind, quote_id, partner_id, token_hash, summary, created_by)
      values ('quote', q.id, pa.id, boatservice.token_hash(tok), s, (select auth.uid()))
      on conflict (quote_id, partner_id) do update set token_hash = excluded.token_hash, summary = excluded.summary,
        status = case when boatservice.lead_offers.status = 'withdrawn' then 'offered' else boatservice.lead_offers.status end,
        expires_at = now() + interval '14 days'
      returning id into oid;
  elsif p_kind = 'part' then
    select * into pr from boatservice.parts_requests where id = p_lead;
    if pr.id is null then raise exception 'Request not found' using errcode = '22023'; end if;
    if pr.status in ('sent_to_shop','closed') then raise exception 'This request is already assigned or closed' using errcode = '22023'; end if;
    s := jsonb_build_object('kind','part','part_name',pr.part_name,'part_number',pr.part_number,'make',pr.make,'model',pr.model,
      'model_year',pr.model_year,'serial',pr.serial,'fulfillment',pr.fulfillment,'area',left(trim(p_area),120),
      'notes',left(boatservice.scrub(p_notes),1500),'photos',to_jsonb(pr.photo_paths),'requested_at',date_trunc('day', pr.created_at));
    update boatservice.parts_requests set area = left(trim(p_area),120), status = case when status = 'new' then 'offered' else status end where id = pr.id;
    insert into boatservice.lead_offers (lead_kind, part_id, partner_id, token_hash, summary, created_by)
      values ('part', pr.id, pa.id, boatservice.token_hash(tok), s, (select auth.uid()))
      on conflict (part_id, partner_id) do update set token_hash = excluded.token_hash, summary = excluded.summary,
        status = case when boatservice.lead_offers.status = 'withdrawn' then 'offered' else boatservice.lead_offers.status end,
        expires_at = now() + interval '14 days'
      returning id into oid;
  else raise exception 'Bad kind' using errcode = '22023';
  end if;
  return jsonb_build_object('offer_id', oid, 'token', tok, 'partner_id', pa.id, 'shop_name', pa.shop_name, 'email', pa.email,
    'expires_at', now() + interval '14 days');
end $$;

-- Staff: release the customer's contact details to ONE shop. Withdraws every other offer for the lead.
create or replace function boatservice.release_offer(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record; shop text;
begin
  if not boatservice.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select * into o from boatservice.lead_offers where id = p_offer;
  if o.id is null then raise exception 'Offer not found' using errcode = '22023'; end if;
  if o.status not in ('offered','interested') then raise exception 'You can only release to a shop that has not passed' using errcode = '22023'; end if;
  select shop_name into shop from boatservice.partner_applications where id = o.partner_id;
  update boatservice.lead_offers set status = 'released', released_at = now(), expires_at = greatest(expires_at, now() + interval '14 days') where id = o.id;
  if o.lead_kind = 'quote' then
    update boatservice.lead_offers set status = 'withdrawn' where quote_id = o.quote_id and id <> o.id and status <> 'withdrawn';
    update boatservice.quote_requests set status = 'sent_to_shop', assigned_shop = shop, assigned_partner = o.partner_id where id = o.quote_id;
  else
    update boatservice.lead_offers set status = 'withdrawn' where part_id = o.part_id and id <> o.id and status <> 'withdrawn';
    update boatservice.parts_requests set status = 'sent_to_shop', assigned_shop = shop, assigned_partner = o.partner_id where id = o.part_id;
  end if;
  return jsonb_build_object('ok', true, 'shop_name', shop);
end $$;

create or replace function boatservice.withdraw_offer(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not boatservice.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  update boatservice.lead_offers set status = 'withdrawn' where id = p_offer and status <> 'released';
  return jsonb_build_object('ok', found);
end $$;

-- Shop (no login, token only): view the anonymized lead. Full contact ONLY once released to this shop.
create or replace function boatservice.offer_view(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record; shop text; c jsonb := null;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then return jsonb_build_object('found', false); end if;
  select * into o from boatservice.lead_offers where token_hash = boatservice.token_hash(p_token);
  if o.id is null then return jsonb_build_object('found', false); end if;
  if o.expires_at < now() then return jsonb_build_object('found', true, 'expired', true); end if;
  if o.status = 'withdrawn' then return jsonb_build_object('found', true, 'withdrawn', true); end if;
  update boatservice.lead_offers set viewed_at = coalesce(viewed_at, now()) where id = o.id;
  select shop_name into shop from boatservice.partner_applications where id = o.partner_id;
  if o.status = 'released' then
    if o.lead_kind = 'quote' then
      select jsonb_build_object('name', name, 'phone', phone, 'email', email, 'location', location, 'details', details) into c
        from boatservice.quote_requests where id = o.quote_id and assigned_partner = o.partner_id;
    else
      select jsonb_build_object('name', name, 'phone', phone, 'email', email, 'location', location, 'details', details) into c
        from boatservice.parts_requests where id = o.part_id and assigned_partner = o.partner_id;
    end if;
  end if;
  return jsonb_build_object('found', true, 'status', o.status, 'shop_name', shop, 'summary', o.summary, 'shop_note', o.shop_note,
    'quote_low', o.quote_low, 'quote_high', o.quote_high, 'expires_at', o.expires_at, 'contact', c);
end $$;

create or replace function boatservice.offer_respond(p_token text, p_response text, p_note text, p_low numeric, p_high numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then raise exception 'Link not valid' using errcode = '22023'; end if;
  if p_response not in ('interested','passed') then raise exception 'Choose Interested or Pass' using errcode = '22023'; end if;
  if p_low is not null and p_high is not null and p_high < p_low then raise exception 'The high end of the range is below the low end' using errcode = '22023'; end if;
  select * into o from boatservice.lead_offers where token_hash = boatservice.token_hash(p_token);
  if o.id is null or o.expires_at < now() or o.status = 'withdrawn' then raise exception 'This link has expired or the job is no longer available' using errcode = '22023'; end if;
  if o.status = 'released' then raise exception 'This job is already yours. Contact the customer directly.' using errcode = '22023'; end if;
  update boatservice.lead_offers set status = p_response, shop_note = left(nullif(trim(coalesce(p_note,'')),''),1000),
    quote_low = case when p_response = 'interested' then p_low end, quote_high = case when p_response = 'interested' then p_high end,
    responded_at = now() where id = o.id;
  return jsonb_build_object('ok', true, 'status', p_response);
end $$;

-- Customer (signed in): only their own requests, and only customer-safe columns.
create or replace function boatservice.my_requests() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'quotes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'service', service, 'urgency', urgency,
        'boat', concat_ws(' ', boat_make, boat_model), 'location', location, 'status', status,
        'shop', case when status = 'sent_to_shop' then assigned_shop end) order by created_at desc)
      from boatservice.quote_requests where user_id = (select auth.uid()) and (select auth.uid()) is not null), '[]'::jsonb),
    'parts', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'part_name', part_name, 'part_number', part_number,
        'make', make, 'model', model, 'fulfillment', fulfillment, 'status', status,
        'shop', case when status = 'sent_to_shop' then assigned_shop end) order by created_at desc)
      from boatservice.parts_requests where user_id = (select auth.uid()) and (select auth.uid()) is not null), '[]'::jsonb))
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
    'emergencies_open', (select count(*) from boatservice.quote_requests where urgency = 'emergency' and status in ('new','offered')),
    'parts_open', (select count(*) from boatservice.parts_requests where status in ('new','offered')),
    'offers_awaiting', (select count(*) from boatservice.lead_offers where status = 'interested'),
    'partners_by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from boatservice.partner_applications group by status) s), '{}'::jsonb),
    'data_requests_open', (select count(*) from boatservice.data_requests where status = 'new'));
end $$;

create or replace function boatservice.health() returns jsonb
language sql stable set search_path = '' as $$ select jsonb_build_object('ok', true, 'schema', 'boatservice', 'version', 'v2') $$;

-- ---------------------------------------------------------------- privileges
revoke all on boatservice.parts_requests, boatservice.lead_offers from anon, authenticated, public;
grant insert on boatservice.parts_requests to anon, authenticated;
grant select, update, delete on boatservice.parts_requests to authenticated;
grant select, insert, update, delete on boatservice.lead_offers to authenticated;   -- RLS: admins only
grant all on boatservice.parts_requests, boatservice.lead_offers to service_role;
revoke all on function boatservice.token_hash(text), boatservice.scrub(text), boatservice.guard_part(),
  boatservice.create_offer(text, uuid, uuid, text, text), boatservice.release_offer(uuid), boatservice.withdraw_offer(uuid),
  boatservice.offer_view(text), boatservice.offer_respond(text, text, text, numeric, numeric), boatservice.my_requests() from public, anon, authenticated;
grant execute on function boatservice.offer_view(text), boatservice.offer_respond(text, text, text, numeric, numeric) to anon, authenticated;
grant execute on function boatservice.my_requests(), boatservice.create_offer(text, uuid, uuid, text, text),
  boatservice.release_offer(uuid), boatservice.withdraw_offer(uuid) to authenticated;

-- ------------------------------------------------------------ photo storage
drop policy if exists "boatservice photos: anyone uploads" on storage.objects;
create policy "boatservice photos: anyone uploads" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'boatservice-photos' and name ~ '^(quotes|parts)/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$');
