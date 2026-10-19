-- RLS test for schema boatservice. Runs in one DO block that ends by RAISING, so every row it
-- creates (test users, leads, admin row) is rolled back. Expected final error:
--   "RLS TEST RESULT: ALL PASS (n checks)"
do $$
declare
  staff uuid := gen_random_uuid(); admin uuid := gen_random_uuid();
  n int; ok int := 0; fails text := ''; qid uuid := gen_random_uuid(); s text;
  cq uuid := gen_random_uuid(); pq uuid := gen_random_uuid(); sh1 uuid := gen_random_uuid(); sh2 uuid := gen_random_uuid();
  j jsonb; tok1 text; tok2 text; tokp text; off1 uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (staff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bs-user@test.invalid', '{}', '{}', now(), now()),
         (admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bs-admin@test.invalid', '{}', '{}', now(), now());
  insert into boatservice.admins (user_id, note) values (admin, 'rls test');

  ---------------------------------------------------------------- anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  -- 1 anon can send a quote; staff-only fields are forced
  insert into boatservice.quote_requests (id, name, phone, location, service, urgency, consent_share, status, assigned_shop, staff_note)
  values (qid, 'Test Boater', '508-555-0100', 'Falmouth Harbor', 'engine_outboard', 'this_week', true, 'new', null, null);
  ok := ok + 1;
  -- 2 anon cannot read quotes
  begin select count(*) into n from boatservice.quote_requests; fails := fails || ' anon-read-quotes';
  exception when insufficient_privilege then ok := ok + 1; end;
  -- 3 anon cannot insert with status other than new (policy) -> guard forces 'new', so row is accepted as new
  insert into boatservice.quote_requests (name, phone, location, service, consent_share, status, assigned_shop)
  values ('Spoofer', '508-555-0101', 'Woods Hole', 'other', true, 'closed', 'Evil Shop');
  ok := ok + 1;
  -- 4 consent is required
  begin insert into boatservice.quote_requests (name, phone, location, service, consent_share) values ('x','508-555-0102','Mashpee','other', false);
    fails := fails || ' consent-not-enforced';
  exception when check_violation then ok := ok + 1; end;
  -- 5 bad photo path rejected
  begin insert into boatservice.quote_requests (name, phone, location, service, consent_share, photo_paths) values ('x','508-555-0103','Bourne','other', true, array['../../etc/passwd']);
    fails := fails || ' bad-photo-path';
  exception when others then ok := ok + 1; end;
  -- 6 rate limit by phone (4/hour)
  begin
    for i in 1..5 loop
      insert into boatservice.quote_requests (name, phone, location, service, consent_share) values ('Flood','(508) 555-0199','Hyannis','other', true);
    end loop;
    fails := fails || ' rate-limit';
  exception when sqlstate '54000' then ok := ok + 1; end;
  -- 7 anon can apply as partner, cannot read partners
  insert into boatservice.partner_applications (shop_name, contact_name, phone, email, services, service_area)
  values ('Test Marine', 'Pat', '508-555-0110', 'shop@test.invalid', array['engine_outboard'], 'Falmouth');
  begin select count(*) into n from boatservice.partner_applications; fails := fails || ' anon-read-partners';
  exception when insufficient_privilege then ok := ok + 2; end;
  -- 9 anon data request ok, cannot read
  insert into boatservice.data_requests (contact, note) values ('boater@test.invalid', 'delete please');
  begin select count(*) into n from boatservice.data_requests; fails := fails || ' anon-read-data';
  exception when insufficient_privilege then ok := ok + 2; end;
  -- 11 anon cannot read admins / call admin_stats / update
  begin select count(*) into n from boatservice.admins; fails := fails || ' anon-admins';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin perform boatservice.admin_stats(); fails := fails || ' anon-stats';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin update boatservice.quote_requests set status = 'closed'; fails := fails || ' anon-update';
  exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role';

  ---------------------------------------------------------------- signed-in non-admin
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- 14 non-admin sees zero leads / partners / data requests
  select count(*) into n from boatservice.quote_requests; if n = 0 then ok := ok + 1; else fails := fails || ' user-sees-leads'; end if;
  select count(*) into n from boatservice.partner_applications; if n = 0 then ok := ok + 1; else fails := fails || ' user-sees-partners'; end if;
  select count(*) into n from boatservice.data_requests; if n = 0 then ok := ok + 1; else fails := fails || ' user-sees-data'; end if;
  -- 17 non-admin update affects nothing
  update boatservice.quote_requests set status = 'closed' where id = qid; get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else fails := fails || ' user-update'; end if;
  -- 18 non-admin stats blocked, my_roles false
  begin perform boatservice.admin_stats(); fails := fails || ' user-stats';
  exception when insufficient_privilege then ok := ok + 1; end;
  if (boatservice.my_roles()->>'admin')::boolean = false then ok := ok + 1; else fails := fails || ' user-role'; end if;
  -- 20 non-admin cannot make themself admin
  begin insert into boatservice.admins (user_id) values (staff); fails := fails || ' self-admin';
  exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role';

  ---------------------------------------------------------------- admin
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- 21 admin reads leads (the rate-limited 'Flood' block was rolled back by its exception handler), spoofed status was reset to new
  select count(*) into n from boatservice.quote_requests where name in ('Test Boater','Spoofer'); if n = 2 then ok := ok + 1; else fails := fails || ' admin-read(' || n || ')'; end if;
  select status into s from boatservice.quote_requests where name = 'Spoofer';
  if s = 'new' and (select assigned_shop from boatservice.quote_requests where name = 'Spoofer') is null then ok := ok + 1; else fails := fails || ' spoof-status'; end if;
  -- 23 admin updates status + assigned shop
  update boatservice.quote_requests set status = 'sent_to_shop', assigned_shop = 'Test Marine' where id = qid; get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fails := fails || ' admin-update'; end if;
  -- 24 invalid status rejected
  begin update boatservice.quote_requests set status = 'bogus' where id = qid; fails := fails || ' status-check';
  exception when check_violation then ok := ok + 1; end;
  -- 25 admin stats + partners + data requests
  if (boatservice.admin_stats()->>'leads_total')::int >= 2 then ok := ok + 1; else fails := fails || ' admin-stats'; end if;
  select count(*) into n from boatservice.partner_applications where shop_name = 'Test Marine'; if n = 1 then ok := ok + 1; else fails := fails || ' admin-partners'; end if;
  delete from boatservice.data_requests where contact = 'boater@test.invalid'; get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fails := fails || ' admin-delete'; end if;
  execute 'reset role';

  ---------------------------------------------------------------- v2: parts, customer accounts, blind offers
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  -- 28 anon sends a parts request; consent required; cannot read parts or offers; no admin functions
  insert into boatservice.parts_requests (id, name, phone, part_name, make, model, model_year, fulfillment, location, consent_share, status, staff_note)
  values (pq, 'Parts Guest', '508-555-0120', 'Impeller kit', 'Yamaha', 'F150', 2016, 'pickup', 'Falmouth', true, 'closed', 'spoof');
  ok := ok + 1;
  begin insert into boatservice.parts_requests (name, phone, part_name, make, location, consent_share) values ('x','508-555-0121','Prop','Mercury','Bourne', false);
    fails := fails || ' parts-consent';
  exception when check_violation then ok := ok + 1; end;
  begin select count(*) into n from boatservice.parts_requests; fails := fails || ' anon-read-parts';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin select count(*) into n from boatservice.lead_offers; fails := fails || ' anon-read-offers';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin perform boatservice.create_offer('quote', qid, gen_random_uuid(), 'Falmouth', null); fails := fails || ' anon-create-offer';
  exception when insufficient_privilege then ok := ok + 1; end;
  -- 33 anon cannot claim someone else's user_id on a quote
  -- (the guard overwrites user_id with auth.uid(), so the claim is dropped; checked as admin below)
  begin insert into boatservice.quote_requests (name, phone, location, service, consent_share, user_id) values ('Claim','508-555-0122','Dennis','other', true, staff);
  exception when others then null; end;
  -- 34 bad token -> not found
  if (boatservice.offer_view('zz')->>'found')::boolean = false and (boatservice.offer_view(repeat('a',48))->>'found')::boolean = false then ok := ok + 1; else fails := fails || ' bad-token'; end if;
  insert into boatservice.partner_applications (id, shop_name, contact_name, phone, email, services, service_area) values
    (sh1, 'Offer Shop One', 'A', '508-555-0130', 'one@test.invalid', array['engine_outboard','parts'], 'Falmouth'),
    (sh2, 'Offer Shop Two', 'B', '508-555-0131', 'two@test.invalid', array['engine_outboard'], 'Mashpee');
  execute 'reset role';

  -- signed-in customer (non-admin user "staff")
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into boatservice.quote_requests (id, name, phone, email, boat_make, boat_model, engine, location, service, urgency, details, consent_share)
  values (cq, 'Customer Carla', '508-555-0140', 'carla@test.invalid', 'Grady-White', 'Fisherman 216', 'Yamaha F150', 'Falmouth Inner Harbor slip B12', 'engine_outboard', 'this_week',
          'Rough idle. Call me at 508-555-0140 or carla@test.invalid', true);
  -- 35 my_requests shows only my quote, without staff_note or phone
  j := boatservice.my_requests();
  if jsonb_array_length(j->'quotes') = 1 and (j->'quotes'->0->>'id')::uuid = cq and not (j->'quotes'->0 ? 'staff_note') and not (j->'quotes'->0 ? 'phone') then ok := ok + 1; else fails := fails || ' my-requests'; end if;
  -- 36 customer cannot read the table directly, cannot read offers, cannot create offers
  select count(*) into n from boatservice.quote_requests; if n = 0 then ok := ok + 1; else fails := fails || ' customer-reads-table'; end if;
  begin select count(*) into n from boatservice.lead_offers; if n = 0 then ok := ok + 1; else fails := fails || ' customer-reads-offers'; end if;
  exception when insufficient_privilege then ok := ok + 1; end;
  begin perform boatservice.create_offer('quote', cq, sh1, 'Falmouth', null); fails := fails || ' customer-create-offer';
  exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role';

  -- admin
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- 39 offer to an unapproved shop is refused
  begin perform boatservice.create_offer('quote', cq, sh1, 'Falmouth', 'x'); fails := fails || ' unapproved-shop';
  exception when others then ok := ok + 1; end;
  update boatservice.partner_applications set status = 'approved' where id in (sh1, sh2);
  -- 40 parts guard forced status new + cleared staff fields
  if (select status = 'new' and staff_note is null from boatservice.parts_requests where id = pq) then ok := ok + 1; else fails := fails || ' parts-guard'; end if;
  if not exists (select 1 from boatservice.quote_requests where name = 'Claim' and user_id is not null) then ok := ok + 1; else fails := fails || ' anon-claims-user'; end if;
  j := boatservice.create_offer('quote', cq, sh1, 'Falmouth', 'Rough idle. Call me at 508-555-0140 or carla@test.invalid');
  tok1 := j->>'token'; off1 := (j->>'offer_id')::uuid;
  tok2 := boatservice.create_offer('quote', cq, sh2, 'Falmouth', 'Rough idle')->>'token';
  tokp := boatservice.create_offer('part', pq, sh1, 'Falmouth', null)->>'token';
  -- 41 tokens are 48 hex, only the sha256 hash is stored
  if tok1 ~ '^[0-9a-f]{48}$' and not exists (select 1 from boatservice.lead_offers where token_hash = tok1)
     and exists (select 1 from boatservice.lead_offers where token_hash = encode(extensions.digest(tok1, 'sha256'), 'hex')) then ok := ok + 1; else fails := fails || ' token-hash'; end if;
  -- 42 lead marked offered with the area
  if (select status = 'offered' and area = 'Falmouth' from boatservice.quote_requests where id = cq) then ok := ok + 1; else fails := fails || ' lead-offered'; end if;
  execute 'reset role';

  -- shop (anon, token only)
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  j := boatservice.offer_view(tok1);
  -- 43 summary is anonymous: no name, phone, email or marina slip; contact hidden
  if (j->>'found')::boolean and j->'contact' = 'null'::jsonb and j->>'shop_name' = 'Offer Shop One'
     and position('508-555-0140' in j::text) = 0 and position('carla@' in j::text) = 0 and position('Carla' in j::text) = 0 and position('B12' in j::text) = 0
     and j->'summary'->>'boat_make' = 'Grady-White' then ok := ok + 1; else fails := fails || ' anon-summary'; end if;
  -- 44 shop responds interested with a range; bad range rejected
  begin perform boatservice.offer_respond(tok1, 'interested', 'Thursday OK', 500, 100); fails := fails || ' range-check';
  exception when others then ok := ok + 1; end;
  perform boatservice.offer_respond(tok1, 'interested', 'Thursday OK', 200, 400);
  perform boatservice.offer_respond(tok2, 'passed', null, null, null);
  if boatservice.offer_view(tok1)->>'status' = 'interested' and boatservice.offer_view(tok2)->>'status' = 'passed' then ok := ok + 1; else fails := fails || ' respond'; end if;
  -- 46 part offer summary has the part and no contact
  j := boatservice.offer_view(tokp);
  if j->'summary'->>'part_name' = 'Impeller kit' and position('508-555-0120' in j::text) = 0 then ok := ok + 1; else fails := fails || ' part-summary'; end if;
  -- 47 shop cannot release itself
  begin perform boatservice.release_offer(off1); fails := fails || ' anon-release';
  exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform boatservice.release_offer(off1);
  -- 48 lead assigned to shop one; other offer withdrawn
  if (select status = 'sent_to_shop' and assigned_partner = sh1 and assigned_shop = 'Offer Shop One' from boatservice.quote_requests where id = cq)
     and (select status from boatservice.lead_offers where quote_id = cq and partner_id = sh2) = 'withdrawn' then ok := ok + 1; else fails := fails || ' release'; end if;
  if (boatservice.admin_stats() ? 'offers_awaiting') and (boatservice.admin_stats() ? 'parts_open') then ok := ok + 1; else fails := fails || ' stats-v2'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  -- 50 released shop sees contact; the other shop sees withdrawn
  j := boatservice.offer_view(tok1);
  if j->'contact'->>'name' = 'Customer Carla' and j->'contact'->>'phone' = '508-555-0140' then ok := ok + 1; else fails := fails || ' released-contact'; end if;
  j := boatservice.offer_view(tok2);
  if (j->>'withdrawn')::boolean and not (j ? 'contact') then ok := ok + 1; else fails := fails || ' withdrawn-view'; end if;
  execute 'reset role';
  -- 52 expired links show nothing
  update boatservice.lead_offers set expires_at = now() - interval '1 minute' where part_id = pq;
  execute 'set local role anon';
  j := boatservice.offer_view(tokp);
  if (j->>'expired')::boolean and not (j ? 'summary') then ok := ok + 1; else fails := fails || ' expired'; end if;
  begin perform boatservice.offer_respond(tokp, 'interested', null, null, null); fails := fails || ' expired-respond';
  exception when others then ok := ok + 1; end;
  execute 'reset role';
  -- 54 customer now sees the matched shop name
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := boatservice.my_requests();
  if j->'quotes'->0->>'shop' = 'Offer Shop One' and j->'quotes'->0->>'status' = 'sent_to_shop' then ok := ok + 1; else fails := fails || ' my-requests-shop'; end if;
  execute 'reset role';

  if fails = '' then raise exception 'RLS TEST RESULT: ALL PASS (% checks)', ok;
  else raise exception 'RLS TEST RESULT: FAIL:% (passed %)', fails, ok; end if;
end $$;
